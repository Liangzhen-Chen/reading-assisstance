import type { PDFDocumentProxy } from "pdfjs-dist";

let initialized = false;

export async function initPdfJs() {
  if (initialized) return;
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  initialized = true;
}

export async function loadPdf(data: ArrayBuffer): Promise<PDFDocumentProxy> {
  await initPdfJs();
  const pdfjs = await import("pdfjs-dist");
  return pdfjs.getDocument({ data }).promise;
}

export async function getPdfPageCount(data: ArrayBuffer): Promise<number> {
  const doc = await loadPdf(data);
  return doc.numPages;
}
