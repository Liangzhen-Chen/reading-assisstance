"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import {
  saveBook,
  saveBookStructure,
  updateBookStructureStatus,
  type BookChapter,
} from "@/lib/storage";

const BATCH_SIZE = 60;
const BATCH_DELAY_MS = 1500;

interface AnalysisProgress {
  phase: "idle" | "extracting" | "analyzing" | "overview" | "done" | "skipped";
  current: number;
  total: number;
  message: string;
}

const LANGUAGE_OPTIONS = [
  { id: "zh", label: "中文", desc: "摘要和概括使用中文" },
  { id: "en", label: "English", desc: "Summaries in English" },
];

export default function UploadPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [language, setLanguage] = useState("zh");
  const [progress, setProgress] = useState<AnalysisProgress>({
    phase: "idle",
    current: 0,
    total: 0,
    message: "",
  });

  const handleFile = useCallback(
    async (file: File) => {
      if (file.type !== "application/pdf") {
        setError("请上传 PDF 文件");
        return;
      }
      setLoading(true);
      setError("");

      try {
        const buffer = await file.arrayBuffer();
        const { loadPdf } = await import("@/lib/pdf");
        const pdf = await loadPdf(buffer.slice(0));
        const id = crypto.randomUUID();
        const bookTitle = file.name.replace(/\.pdf$/i, "");

        await saveBook({
          id,
          title: bookTitle,
          fileName: file.name,
          data: buffer,
          totalPages: pdf.numPages,
          lastPage: 1,
          addedAt: Date.now(),
          structureStatus: "pending",
        });

        // Phase 1: Detect if scanned
        setProgress({
          phase: "extracting",
          current: 0,
          total: pdf.numPages,
          message: "检测 PDF 类型...",
        });

        const { detectScannedPdf, extractAllPagesText } = await import(
          "@/lib/pdfParser"
        );
        const isScanned = await detectScannedPdf(pdf);

        if (isScanned) {
          await updateBookStructureStatus(id, "skipped");
          setProgress({
            phase: "skipped",
            current: 0,
            total: 0,
            message: "扫描版 PDF，跳过结构分析",
          });
          router.push(`/reader/${id}`);
          return;
        }

        // Phase 2: Extract all text
        setProgress({
          phase: "extracting",
          current: 0,
          total: pdf.numPages,
          message: "正在提取文字...",
        });

        await updateBookStructureStatus(id, "analyzing");

        const allPages = await extractAllPagesText(pdf, (current, total) => {
          setProgress({
            phase: "extracting",
            current,
            total,
            message: `正在提取文字... ${current}/${total} 页`,
          });
        });

        // Phase 3: Batch analyze structure
        const batches: { page: number; text: string }[][] = [];
        for (let i = 0; i < allPages.length; i += BATCH_SIZE) {
          batches.push(allPages.slice(i, i + BATCH_SIZE));
        }

        let accumulatedChapters: BookChapter[] = [];
        let overview: string | undefined;

        for (let i = 0; i < batches.length; i++) {
          setProgress({
            phase: "analyzing",
            current: i + 1,
            total: batches.length,
            message: `正在分析结构... 批次 ${i + 1}/${batches.length}`,
          });

          const isLast = i === batches.length - 1;

          const res = await fetch("/api/analyze-structure", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              bookTitle,
              pageTexts: batches[i],
              previousChapters:
                accumulatedChapters.length > 0
                  ? accumulatedChapters
                  : undefined,
              batchIndex: i,
              totalBatches: batches.length,
              generateOverview: isLast,
              language,
            }),
          });

          if (!res.ok) {
            console.warn(`Batch ${i} failed:`, res.status);
            // Continue with remaining batches
            if (!isLast) {
              await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
              continue;
            }
            break;
          }

          const data = await res.json();
          const batchChapters: BookChapter[] = data.chapters || [];

          // Merge CONTINUE chapters
          for (const ch of batchChapters) {
            if (
              ch.title === "CONTINUE" &&
              accumulatedChapters.length > 0
            ) {
              const last =
                accumulatedChapters[accumulatedChapters.length - 1];
              last.endPage = ch.endPage;
              last.sections = [...last.sections, ...(ch.sections || [])];
              if (ch.summary) last.summary += " " + ch.summary;
            } else {
              accumulatedChapters.push(ch);
            }
          }

          if (isLast && data.overview) {
            overview = data.overview;
          }

          // Delay between batches to avoid rate limits
          if (!isLast) {
            await new Promise((r) => setTimeout(r, BATCH_DELAY_MS));
          }
        }

        // Save structure
        if (accumulatedChapters.length > 0) {
          await saveBookStructure({
            bookId: id,
            analyzedAt: Date.now(),
            overview: overview || "",
            language,
            chapters: accumulatedChapters,
          });
          await updateBookStructureStatus(id, "ready");
        } else {
          await updateBookStructureStatus(id, "failed");
        }

        setProgress({
          phase: "done",
          current: 0,
          total: 0,
          message: `分析完成！识别了 ${accumulatedChapters.length} 个章节`,
        });

        // Brief pause so user sees the result
        await new Promise((r) => setTimeout(r, 800));
        router.push(`/reader/${id}`);
      } catch (err) {
        console.error("Upload/analysis error:", err);
        setError("处理失败，请重试");
        setLoading(false);
      }
    },
    [router]
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragging(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const onFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const showProgress = progress.phase !== "idle";
  const progressPercent =
    progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : 0;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#faf9f6] px-4">
      <a href="/" className="flex items-center gap-2 mb-8 text-[#5b7f6a]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-6 h-6"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        <span className="text-xl font-bold">ReadLens</span>
      </a>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-16 text-center transition-colors ${
          loading ? "" : "cursor-pointer"
        } ${
          dragging
            ? "border-[#5b7f6a] bg-[#eef4f0]"
            : "border-[#e5e2db] bg-white hover:border-[#5b7f6a]/50"
        }`}
        onClick={() =>
          !loading && document.getElementById("file-input")?.click()
        }
      >
        {loading ? (
          <div className="flex flex-col items-center gap-4">
            <div className="w-8 h-8 border-3 border-[#5b7f6a] border-t-transparent rounded-full animate-spin" />
            {showProgress ? (
              <>
                <p className="text-[#666] text-sm">{progress.message}</p>
                {progress.total > 0 && (
                  <div className="w-full max-w-xs">
                    <div className="h-1.5 bg-[#e5e2db] rounded-full overflow-hidden">
                      <div
                        className="h-full bg-[#5b7f6a] rounded-full transition-all duration-300"
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                    <p className="text-xs text-[#999] mt-1.5">
                      {progressPercent}%
                    </p>
                  </div>
                )}
                {progress.phase === "done" && (
                  <p className="text-xs text-[#5b7f6a] font-medium">
                    {progress.message}
                  </p>
                )}
              </>
            ) : (
              <p className="text-[#666]">正在解析 PDF...</p>
            )}
          </div>
        ) : (
          <>
            <div className="text-4xl mb-4">📄</div>
            <p className="text-lg font-medium text-[#2c2c2c] mb-2">
              拖拽 PDF 到这里
            </p>
            <p className="text-sm text-[#666]">
              或点击选择文件
            </p>
            <p className="text-xs text-[#999] mt-3">
              上传后将自动分析书籍结构，生成智能目录
            </p>
          </>
        )}
      </div>

      {/* Language selector */}
      {!loading && (
        <div className="mt-4 flex items-center gap-3">
          <span className="text-xs text-[#999]">分析语言</span>
          <div className="flex bg-[#f5f4f0] rounded-lg p-0.5">
            {LANGUAGE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => setLanguage(opt.id)}
                className={`px-3 py-1.5 text-xs rounded-md transition-colors ${
                  language === opt.id
                    ? "bg-white text-[#2c2c2c] shadow-sm font-medium"
                    : "text-[#999] hover:text-[#666]"
                }`}
                title={opt.desc}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>
      )}

      <input
        id="file-input"
        type="file"
        accept=".pdf"
        onChange={onFileSelect}
        className="hidden"
      />

      {error && <p className="mt-4 text-sm text-red-500">{error}</p>}
    </div>
  );
}
