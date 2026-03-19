"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { saveBook } from "@/lib/storage";

export default function UploadPage() {
  const router = useRouter();
  const [dragging, setDragging] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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

        await saveBook({
          id,
          title: file.name.replace(/\.pdf$/i, ""),
          fileName: file.name,
          data: buffer,
          totalPages: pdf.numPages,
          lastPage: 1,
          addedAt: Date.now(),
        });

        router.push(`/reader/${id}`);
      } catch {
        setError("PDF 解析失败，请确认文件有效");
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
        className={`w-full max-w-lg border-2 border-dashed rounded-2xl p-16 text-center transition-colors cursor-pointer ${
          dragging
            ? "border-[#5b7f6a] bg-[#eef4f0]"
            : "border-[#e5e2db] bg-white hover:border-[#5b7f6a]/50"
        }`}
        onClick={() => document.getElementById("file-input")?.click()}
      >
        {loading ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-3 border-[#5b7f6a] border-t-transparent rounded-full animate-spin" />
            <p className="text-[#666]">正在解析 PDF...</p>
          </div>
        ) : (
          <>
            <div className="text-4xl mb-4">📄</div>
            <p className="text-lg font-medium text-[#2c2c2c] mb-2">
              拖拽 PDF 到这里
            </p>
            <p className="text-sm text-[#666]">或点击选择文件</p>
          </>
        )}
      </div>

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
