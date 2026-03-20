"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import type { PDFDocumentProxy } from "pdfjs-dist";
import {
  getBookMeta,
  getBookData,
  updateBookProgress,
  getPageAnnotations,
  savePageAnnotations,
  deletePageAnnotations,
  deleteAllBookAnnotations,
  getBookStructure,
  type StoredAnnotation,
  type BookStructure,
} from "@/lib/storage";
import { resolveAnnotationContext } from "@/lib/structureContext";
import AnnotationPanel from "@/components/AnnotationPanel";
import TableOfContents from "@/components/TableOfContents";

export default function ReaderPage() {
  const { bookId } = useParams<{ bookId: string }>();
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [title, setTitle] = useState("");
  const [scale, setScale] = useState(1.5);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const renderingRef = useRef(false);

  // Annotation state
  const [annotations, setAnnotations] = useState<StoredAnnotation[]>([]);
  const [annoLoading, setAnnoLoading] = useState(false);
  const [sidebarVisible, setSidebarVisible] = useState(true);
  const [selectedModel, setSelectedModel] = useState("gemini-2.5-flash-lite");
  const [density, setDensity] = useState("medium");
  const [style, setStyle] = useState("balanced");
  const [regenerateKey, setRegenerateKey] = useState(0);
  const [annoError, setAnnoError] = useState("");

  // Structure & TOC state
  const [structure, setStructure] = useState<BookStructure | null>(null);
  const [tocVisible, setTocVisible] = useState(false);
  const pageTextCache = useRef<Map<number, string>>(new Map());

  // Load PDF from IndexedDB
  useEffect(() => {
    (async () => {
      try {
        const meta = await getBookMeta(bookId);
        if (!meta) {
          router.push("/");
          return;
        }
        setTitle(meta.title);
        setCurrentPage(meta.lastPage);

        const bookData = await getBookData(bookId);
        if (!bookData) {
          setLoadError("PDF 数据丢失，请重新上传");
          setLoading(false);
          return;
        }

        const { loadPdf } = await import("@/lib/pdf");
        const doc = await loadPdf(bookData.slice(0));
        setPdf(doc);
        setTotalPages(doc.numPages);
        setLoading(false);

        // Load structure if available
        try {
          const struct = await getBookStructure(bookId);
          if (struct) {
            setStructure(struct);
            setTocVisible(true);
          }
        } catch {
          // Structure not available, continue without it
        }
      } catch (err) {
        console.error("Failed to load book:", err);
        setLoadError(`加载失败: ${String(err)}`);
        setLoading(false);
      }
    })();
  }, [bookId, router]);

  // Render current page
  const renderPage = useCallback(
    async (pageNum: number) => {
      if (!pdf || !canvasRef.current || renderingRef.current) return;
      renderingRef.current = true;

      try {
        const page = await pdf.getPage(pageNum);
        const dpr = window.devicePixelRatio || 1;
        const viewport = page.getViewport({ scale });
        const canvas = canvasRef.current;

        canvas.width = Math.floor(viewport.width * dpr);
        canvas.height = Math.floor(viewport.height * dpr);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;

        const scaledViewport = page.getViewport({ scale: scale * dpr });
        await page.render({ canvas, viewport: scaledViewport }).promise;
      } catch {
        // render cancelled or failed
      } finally {
        renderingRef.current = false;
      }
    },
    [pdf, scale]
  );

  useEffect(() => {
    if (pdf) renderPage(currentPage);
  }, [pdf, currentPage, renderPage]);

  // Save progress
  useEffect(() => {
    if (bookId && currentPage > 0) {
      updateBookProgress(bookId, currentPage);
    }
  }, [bookId, currentPage]);

  // Extract text for a range of pages, using cache
  const extractContextPages = useCallback(
    async (start: number, end: number): Promise<Map<number, string>> => {
      if (!pdf) return pageTextCache.current;
      const { extractPageText } = await import("@/lib/pdfParser");
      for (let p = start; p <= end; p++) {
        if (!pageTextCache.current.has(p)) {
          const text = await extractPageText(pdf, p);
          pageTextCache.current.set(p, text);
        }
      }
      return pageTextCache.current;
    },
    [pdf]
  );

  // Load or generate annotations for current page
  const fetchAnnotations = useCallback(
    async (forceRegenerate = false) => {
      if (!pdf || !bookId) return;

      // Check cache first (unless forcing regeneration)
      if (!forceRegenerate) {
        const cached = await getPageAnnotations(bookId, currentPage);
        if (cached) {
          setAnnotations(cached.annotations);
          return;
        }
      } else {
        await deletePageAnnotations(bookId, currentPage);
      }

      setAnnoLoading(true);
      setAnnotations([]);
      setAnnoError("");

      try {
        const { extractPageText } = await import("@/lib/pdfParser");
        const text = await extractPageText(pdf, currentPage);
        const hasText = text.trim().length > 30;

        // Resolve structure context if available
        let contextFields: Record<string, string> = {};
        if (structure) {
          const ctx = resolveAnnotationContext(
            structure,
            currentPage,
            pageTextCache.current
          );

          // If we need pages we haven't cached yet, extract them
          if (
            ctx.contextRange.start > 0 &&
            ctx.contextRange.end > 0
          ) {
            const cached = await extractContextPages(
              ctx.contextRange.start,
              ctx.contextRange.end
            );
            // Re-resolve with updated cache
            const updatedCtx = resolveAnnotationContext(
              structure,
              currentPage,
              cached
            );
            contextFields = {
              structureOverview: updatedCtx.structureOverview,
              chapterSummary: updatedCtx.chapterSummary,
              contextText: updatedCtx.contextText,
            };
          } else {
            contextFields = {
              structureOverview: ctx.structureOverview,
              chapterSummary: ctx.chapterSummary,
              contextText: ctx.contextText,
            };
          }
        }

        // Build request body — use text if available, otherwise capture page as image
        let body: Record<string, unknown>;
        if (hasText) {
          body = {
            bookTitle: title,
            pageText: text,
            pageNumber: currentPage,
            model: selectedModel,
            density,
            style,
            ...contextFields,
          };
        } else {
          // Scanned PDF: render page to image and send to Gemini vision
          const page = await pdf.getPage(currentPage);
          const vp = page.getViewport({ scale: 2 });
          const offscreen = document.createElement("canvas");
          offscreen.width = vp.width;
          offscreen.height = vp.height;
          await page.render({ canvas: offscreen, viewport: vp }).promise;
          const dataUrl = offscreen.toDataURL("image/png");
          const base64 = dataUrl.split(",")[1];
          body = {
            bookTitle: title,
            pageImage: base64,
            pageNumber: currentPage,
            model: selectedModel,
            density,
            style,
            ...contextFields,
          };
        }

        const res = await fetch("/api/annotate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        if (res.ok) {
          const data = await res.json();
          const annos: StoredAnnotation[] = data.annotations || [];
          setAnnotations(annos);
          await savePageAnnotations(
            bookId,
            currentPage,
            annos,
            data.model || selectedModel
          );
        } else {
          const errData = await res.json().catch(() => ({}));
          setAnnoError(
            `API 错误 ${res.status}: ${errData.error || "未知错误"}`
          );
        }
      } catch (err) {
        setAnnoError(`生成失败: ${String(err)}`);
      } finally {
        setAnnoLoading(false);
      }
    },
    [pdf, bookId, currentPage, title, selectedModel, density, style, structure, extractContextPages]
  );

  useEffect(() => {
    if (pdf) fetchAnnotations();
  }, [pdf, currentPage, fetchAnnotations, regenerateKey]);

  const handleRegenerate = () => {
    setRegenerateKey((k) => k + 1);
    fetchAnnotations(true);
  };

  const handleRegenerateAll = async () => {
    if (!bookId) return;
    await deleteAllBookAnnotations(bookId);
    setRegenerateKey((k) => k + 1);
    fetchAnnotations(true);
  };

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLSelectElement
      )
        return;
      if (e.key === "ArrowRight" || e.key === "ArrowDown") {
        setCurrentPage((p) => Math.min(p + 1, totalPages));
      } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
        setCurrentPage((p) => Math.max(p - 1, 1));
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [totalPages]);

  const goToPage = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#faf9f6]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-8 h-8 border-3 border-[#5b7f6a] border-t-transparent rounded-full animate-spin" />
          <p className="text-[#666]">加载中...</p>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#faf9f6]">
        <div className="flex flex-col items-center gap-4 max-w-md text-center">
          <p className="text-red-500 text-sm">{loadError}</p>
          <div className="flex gap-3">
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 bg-[#5b7f6a] text-white text-sm rounded-lg hover:bg-[#4d6e5b]"
            >
              重试
            </button>
            <a
              href="/"
              className="px-4 py-2 border border-[#e5e2db] text-[#666] text-sm rounded-lg hover:bg-[#f5f4f0]"
            >
              返回书架
            </a>
          </div>
        </div>
      </div>
    );
  }

  const leftMargin = tocVisible ? "ml-[280px]" : "";
  const rightMargin = sidebarVisible ? "mr-[340px]" : "";

  return (
    <div className="min-h-screen bg-[#faf9f6] flex flex-col">
      {/* Top Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 h-14 bg-white border-b border-[#e5e2db] flex items-center justify-between px-7">
        <div className="flex items-center gap-3">
          <a
            href="/"
            className="flex items-center justify-center w-8 h-8 rounded-lg hover:bg-[#f5f4f0] text-[#666] transition-colors"
            title="返回书架"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-4 h-4"
            >
              <path d="M15 18l-6-6 6-6" />
            </svg>
          </a>
          <a
            href="/"
            className="flex items-center gap-2 text-[#5b7f6a] font-bold text-lg"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
            ReadLens
          </a>
        </div>

        <div className="text-sm text-[#666] max-w-[400px] truncate">
          {title}
        </div>

        <div className="flex items-center gap-2">
          {/* TOC toggle */}
          <button
            onClick={() => setTocVisible((v) => !v)}
            className={`px-3 py-1 text-xs border rounded-md transition-colors ${
              tocVisible
                ? "border-[#5b7f6a] bg-[#eef4f0] text-[#5b7f6a]"
                : "border-[#e5e2db] text-[#999] hover:bg-[#f5f4f0]"
            }`}
            title={structure ? "切换目录" : "暂无目录结构"}
          >
            目录
          </button>
          <button
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            className="px-2 py-1 text-xs border border-[#e5e2db] rounded-md hover:bg-[#f5f4f0] text-[#666]"
          >
            A-
          </button>
          <span className="text-xs text-[#999] w-12 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button
            onClick={() => setScale((s) => Math.min(3, s + 0.25))}
            className="px-2 py-1 text-xs border border-[#e5e2db] rounded-md hover:bg-[#f5f4f0] text-[#666]"
          >
            A+
          </button>
          <button
            onClick={() => setSidebarVisible((v) => !v)}
            className={`ml-2 px-3 py-1 text-xs border rounded-md transition-colors ${
              sidebarVisible
                ? "border-[#5b7f6a] bg-[#eef4f0] text-[#5b7f6a]"
                : "border-[#e5e2db] text-[#999] hover:bg-[#f5f4f0]"
            }`}
          >
            批注 {sidebarVisible ? "ON" : "OFF"}
          </button>
        </div>
      </header>

      {/* Edge tab to reopen TOC */}
      {!tocVisible && structure && (
        <button
          onClick={() => setTocVisible(true)}
          className="fixed left-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-l-0 border-[#e5e2db] rounded-r-lg px-1.5 py-4 shadow-md hover:bg-[#f5f4f0] transition-colors group"
          title="展开目录"
        >
          <span className="text-xs text-[#999] group-hover:text-[#5b7f6a] [writing-mode:vertical-rl]">
            目录 ›
          </span>
        </button>
      )}

      {/* Edge tab to reopen annotations */}
      {!sidebarVisible && (
        <button
          onClick={() => setSidebarVisible(true)}
          className="fixed right-0 top-1/2 -translate-y-1/2 z-40 bg-white border border-r-0 border-[#e5e2db] rounded-l-lg px-1.5 py-4 shadow-md hover:bg-[#f5f4f0] transition-colors group"
          title="展开批注"
        >
          <span className="text-xs text-[#999] group-hover:text-[#5b7f6a] [writing-mode:vertical-rl]">
            ‹ 批注
          </span>
        </button>
      )}

      {/* Table of Contents Sidebar */}
      <TableOfContents
        structure={structure}
        currentPage={currentPage}
        visible={tocVisible}
        onToggle={() => setTocVisible(false)}
        onNavigate={goToPage}
      />

      {/* Reader area */}
      <main
        className={`flex-1 mt-14 mb-16 flex justify-center overflow-auto py-8 transition-all ${leftMargin} ${rightMargin}`}
      >
        <canvas ref={canvasRef} className="shadow-lg" />
      </main>

      {/* Annotation Sidebar */}
      <AnnotationPanel
        annotations={annotations}
        loading={annoLoading}
        visible={sidebarVisible}
        onToggle={() => setSidebarVisible(false)}
        onRegenerate={handleRegenerate}
        onRegenerateAll={handleRegenerateAll}
        currentPage={currentPage}
        model={selectedModel}
        onModelChange={setSelectedModel}
        density={density}
        onDensityChange={setDensity}
        style={style}
        onStyleChange={setStyle}
        error={annoError}
      />

      {/* Bottom Page Nav */}
      <nav
        className={`fixed bottom-6 flex items-center gap-1.5 bg-white border border-[#e5e2db] rounded-xl px-4 py-2 shadow-lg transition-all ${
          tocVisible && sidebarVisible
            ? "left-[calc(50%+(-340px+280px)/2)] -translate-x-1/2"
            : tocVisible
              ? "left-[calc(50%+140px)] -translate-x-1/2"
              : sidebarVisible
                ? "left-[calc(50%-170px)] -translate-x-1/2"
                : "left-1/2 -translate-x-1/2"
        }`}
      >
        <button
          onClick={() => goToPage(1)}
          disabled={currentPage <= 1}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#f5f4f0] hover:bg-[#e8e7e2] text-[#666] disabled:opacity-30 text-sm"
        >
          ⟨⟨
        </button>
        <button
          onClick={() => goToPage(currentPage - 1)}
          disabled={currentPage <= 1}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#f5f4f0] hover:bg-[#e8e7e2] text-[#666] disabled:opacity-30"
        >
          ‹
        </button>

        <input
          type="number"
          value={currentPage}
          onChange={(e) => {
            const v = parseInt(e.target.value, 10);
            if (!isNaN(v)) goToPage(v);
          }}
          className="w-14 text-center text-sm text-[#666] border border-[#e5e2db] rounded-md py-1 bg-white [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
          min={1}
          max={totalPages}
        />
        <span className="text-sm text-[#999] px-1">/ {totalPages}</span>

        <button
          onClick={() => goToPage(currentPage + 1)}
          disabled={currentPage >= totalPages}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#f5f4f0] hover:bg-[#e8e7e2] text-[#666] disabled:opacity-30"
        >
          ›
        </button>
        <button
          onClick={() => goToPage(totalPages)}
          disabled={currentPage >= totalPages}
          className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#f5f4f0] hover:bg-[#e8e7e2] text-[#666] disabled:opacity-30 text-sm"
        >
          ⟩⟩
        </button>
      </nav>
    </div>
  );
}
