import type { BookStructure, BookChapter, BookSection, BookSubsection } from "./storage";

export interface AnnotationContext {
  structureOverview: string;
  chapterSummary: string;
  contextText: string;
  contextRange: { start: number; end: number };
  strategy: "full-chapter" | "full-section" | "full-subsection" | "window";
}

const MAX_CONTEXT_PAGES = 30;

function inRange(page: number, start: number, end: number): boolean {
  return page >= start && page <= end;
}

function findChapter(
  structure: BookStructure,
  page: number
): BookChapter | undefined {
  return structure.chapters.find((ch) => inRange(page, ch.startPage, ch.endPage));
}

function findSection(
  chapter: BookChapter,
  page: number
): BookSection | undefined {
  return chapter.sections.find((s) => inRange(page, s.startPage, s.endPage));
}

function findSubsection(
  section: BookSection,
  page: number
): BookSubsection | undefined {
  return section.subsections?.find((sub) => inRange(page, sub.startPage, sub.endPage));
}

function buildStructureOverview(structure: BookStructure): string {
  const lines: string[] = [];
  if (structure.overview) {
    lines.push(`Overview: ${structure.overview}`);
    lines.push("");
  }
  lines.push("Table of Contents:");
  for (const ch of structure.chapters) {
    lines.push(`- ${ch.title} (p.${ch.startPage}-${ch.endPage})`);
    for (const sec of ch.sections) {
      lines.push(`  - ${sec.title} (p.${sec.startPage}-${sec.endPage})`);
      if (sec.subsections) {
        for (const sub of sec.subsections) {
          lines.push(`    - ${sub.title} (p.${sub.startPage}-${sub.endPage})`);
        }
      }
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
  const summaryParts = [`Chapter: ${chapter.title} (p.${chapter.startPage}-${chapter.endPage})\n${chapter.summary}`];

  const section = findSection(chapter, currentPage);
  if (section) {
    summaryParts.push(`Section: ${section.title} (p.${section.startPage}-${section.endPage})\n${section.summary}`);
    const subsection = findSubsection(section, currentPage);
    if (subsection) {
      summaryParts.push(`Subsection: ${subsection.title} (p.${subsection.startPage}-${subsection.endPage})\n${subsection.summary}`);
    }
  }
  const chapterSummary = summaryParts.join("\n\n");

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
      // Section too large — try subsection
      const subsection = findSubsection(section, currentPage);
      if (subsection) {
        const subPages = subsection.endPage - subsection.startPage + 1;
        if (subPages <= MAX_CONTEXT_PAGES) {
          range = { start: subsection.startPage, end: subsection.endPage };
          strategy = "full-subsection";
        } else {
          range = clampRange(currentPage, MAX_CONTEXT_PAGES, subsection.startPage, subsection.endPage);
          strategy = "window";
        }
      } else {
        range = clampRange(currentPage, MAX_CONTEXT_PAGES, section.startPage, section.endPage);
        strategy = "window";
      }
    }
  } else {
    // No sections, use window within chapter
    const windowSize = Math.min(
      MAX_CONTEXT_PAGES,
      Math.max(15, Math.ceil(chapterPages / 4))
    );
    range = clampRange(currentPage, windowSize, chapter.startPage, chapter.endPage);
    strategy = "window";
  }

  // Build context text from cached page texts
  const contextLines: string[] = [];
  for (let p = range.start; p <= range.end; p++) {
    const text = pageTexts.get(p);
    if (text && text.trim()) {
      contextLines.push(`--- Page ${p} ---\n${text}`);
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
