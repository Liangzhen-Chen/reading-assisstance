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
