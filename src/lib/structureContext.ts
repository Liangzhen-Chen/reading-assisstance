import type { BookStructure, BookChapter, BookSection } from "./storage";

export interface AnnotationContext {
  structureOverview: string;
  chapterSummary: string;
  contextText: string;
  contextRange: { start: number; end: number };
  strategy: "full-chapter" | "full-section" | "window";
}

const MAX_CONTEXT_PAGES = 30;

function findChapter(
  structure: BookStructure,
  page: number
): BookChapter | undefined {
  return structure.chapters.find(
    (ch) => page >= ch.startPage && page <= ch.endPage
  );
}

function findSection(
  chapter: BookChapter,
  page: number
): BookSection | undefined {
  return chapter.sections.find(
    (s) => page >= s.startPage && page <= s.endPage
  );
}

function buildStructureOverview(structure: BookStructure): string {
  const lines: string[] = [];
  if (structure.overview) {
    lines.push(`全书概述：${structure.overview}`);
    lines.push("");
  }
  lines.push("章节目录：");
  for (const ch of structure.chapters) {
    lines.push(`- ${ch.title}（第${ch.startPage}-${ch.endPage}页）`);
    for (const sec of ch.sections) {
      lines.push(`  - ${sec.title}（第${sec.startPage}-${sec.endPage}页）`);
    }
  }
  return lines.join("\n");
}

function clampRange(
  center: number,
  windowSize: number,
  min: number,
  max: number
): { start: number; end: number } {
  const half = Math.floor(windowSize / 2);
  let start = center - half;
  let end = center + half;
  if (start < min) {
    start = min;
    end = Math.min(start + windowSize - 1, max);
  }
  if (end > max) {
    end = max;
    start = Math.max(end - windowSize + 1, min);
  }
  return { start, end };
}

export function resolveAnnotationContext(
  structure: BookStructure,
  currentPage: number,
  pageTexts: Map<number, string>
): AnnotationContext {
  const structureOverview = buildStructureOverview(structure);
  const chapter = findChapter(structure, currentPage);

  if (!chapter) {
    return {
      structureOverview,
      chapterSummary: "",
      contextText: "",
      contextRange: { start: currentPage, end: currentPage },
      strategy: "window",
    };
  }

  const chapterPages = chapter.endPage - chapter.startPage + 1;
  const chapterSummaryParts = [`当前章节：${chapter.title}（第${chapter.startPage}-${chapter.endPage}页）\n${chapter.summary}`];

  const section = findSection(chapter, currentPage);
  if (section) {
    chapterSummaryParts.push(`当前小节：${section.title}（第${section.startPage}-${section.endPage}页）\n${section.summary}`);
  }
  const chapterSummary = chapterSummaryParts.join("\n\n");

  let range: { start: number; end: number };
  let strategy: AnnotationContext["strategy"];

  if (chapterPages <= MAX_CONTEXT_PAGES) {
    // Full chapter fits
    range = { start: chapter.startPage, end: chapter.endPage };
    strategy = "full-chapter";
  } else if (section) {
    const sectionPages = section.endPage - section.startPage + 1;
    if (sectionPages <= MAX_CONTEXT_PAGES) {
      // Full section fits
      range = { start: section.startPage, end: section.endPage };
      strategy = "full-section";
    } else {
      // Section too large, use window within section
      range = clampRange(
        currentPage,
        MAX_CONTEXT_PAGES,
        section.startPage,
        section.endPage
      );
      strategy = "window";
    }
  } else {
    // No sections, use window within chapter (quarter of chapter, min 15, max 30)
    const windowSize = Math.min(
      MAX_CONTEXT_PAGES,
      Math.max(15, Math.ceil(chapterPages / 4))
    );
    range = clampRange(
      currentPage,
      windowSize,
      chapter.startPage,
      chapter.endPage
    );
    strategy = "window";
  }

  // Build context text from cached page texts
  const contextLines: string[] = [];
  for (let p = range.start; p <= range.end; p++) {
    const text = pageTexts.get(p);
    if (text && text.trim()) {
      contextLines.push(`--- 第 ${p} 页 ---\n${text}`);
    }
  }

  return {
    structureOverview,
    chapterSummary,
    contextText: contextLines.join("\n\n"),
    contextRange: range,
    strategy,
  };
}
