import type { PDFDocumentProxy } from "pdfjs-dist";

export async function extractPageText(
  pdf: PDFDocumentProxy,
  pageNum: number
): Promise<string> {
  const page = await pdf.getPage(pageNum);
  const content = await page.getTextContent();
  return content.items
    .filter((item): item is Extract<typeof item, { str: string }> => "str" in item)
    .map((item) => item.str)
    .join("");
}

export async function extractPagesText(
  pdf: PDFDocumentProxy,
  startPage: number,
  endPage: number
): Promise<{ page: number; text: string }[]> {
  const results: { page: number; text: string }[] = [];
  for (let i = startPage; i <= Math.min(endPage, pdf.numPages); i++) {
    const text = await extractPageText(pdf, i);
    if (text.trim()) {
      results.push({ page: i, text });
    }
  }
  return results;
}

export async function extractAllPagesText(
  pdf: PDFDocumentProxy,
  onProgress?: (current: number, total: number) => void
): Promise<{ page: number; text: string }[]> {
  const results: { page: number; text: string }[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const text = await extractPageText(pdf, i);
    results.push({ page: i, text: text.trim() });
    onProgress?.(i, pdf.numPages);
  }
  return results;
}

export async function detectScannedPdf(
  pdf: PDFDocumentProxy,
  sampleSize = 5
): Promise<boolean> {
  const total = pdf.numPages;
  const step = Math.max(1, Math.floor(total / sampleSize));
  let withText = 0;
  for (let i = 1; i <= total && withText < 2; i += step) {
    const text = await extractPageText(pdf, Math.min(i, total));
    if (text.trim().length > 30) withText++;
  }
  return withText < 2;
}
