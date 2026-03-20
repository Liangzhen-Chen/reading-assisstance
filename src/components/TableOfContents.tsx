"use client";

import type { BookStructure, BookChapter } from "@/lib/storage";

interface Props {
  structure: BookStructure | null;
  currentPage: number;
  visible: boolean;
  onToggle: () => void;
  onNavigate: (page: number) => void;
}

function isInRange(page: number, start: number, end: number): boolean {
  return page >= start && page <= end;
}

export default function TableOfContents({
  structure,
  currentPage,
  visible,
  onToggle,
  onNavigate,
}: Props) {
  if (!visible) return null;

  if (!structure || structure.chapters.length === 0) {
    return (
      <aside className="fixed left-0 top-14 bottom-0 w-[280px] bg-white border-r border-[#e5e2db] overflow-y-auto z-40">
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-semibold text-[#bbb] uppercase tracking-wide">
              目录
            </span>
            <button
              onClick={onToggle}
              className="text-xs text-[#999] hover:text-[#666] transition-colors"
            >
              ‹ 收起
            </button>
          </div>
          <div className="text-center py-12">
            <p className="text-sm text-[#999]">暂无目录结构</p>
            <p className="text-xs text-[#ccc] mt-1">上传时将自动分析</p>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className="fixed left-0 top-14 bottom-0 w-[280px] bg-white border-r border-[#e5e2db] overflow-y-auto z-40">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#bbb] uppercase tracking-wide">
              目录
            </span>
            <span className="text-xs bg-[#f0efe9] text-[#666] px-2.5 py-0.5 rounded-full">
              {structure.chapters.length} 章
            </span>
          </div>
          <button
            onClick={onToggle}
            className="text-xs text-[#999] hover:text-[#666] transition-colors"
          >
            ‹ 收起
          </button>
        </div>

        {structure.overview && (
          <p className="text-xs text-[#999] leading-relaxed mb-4 pb-3 border-b border-[#f0efe9]">
            {structure.overview}
          </p>
        )}

        <nav className="space-y-0.5">
          {structure.chapters.map((ch, i) => {
            const chActive = isInRange(currentPage, ch.startPage, ch.endPage);
            return (
              <div key={i}>
                {/* Level 1: Chapter */}
                <button
                  onClick={() => onNavigate(ch.startPage)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors ${
                    chActive
                      ? "bg-[#eef4f0] text-[#2c2c2c] font-medium"
                      : "text-[#666] hover:bg-[#f5f4f0]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="truncate pr-2">{ch.title}</span>
                    <span className="text-xs text-[#bbb] shrink-0">
                      {ch.startPage}
                    </span>
                  </div>
                </button>

                {/* Level 2: Sections — show when chapter is active */}
                {ch.sections.length > 0 && chActive && (
                  <div className="ml-3 border-l border-[#e5e2db] pl-2 my-0.5">
                    {ch.sections.map((sec, j) => {
                      const secActive = isInRange(
                        currentPage,
                        sec.startPage,
                        sec.endPage
                      );
                      return (
                        <div key={j}>
                          <button
                            onClick={() => onNavigate(sec.startPage)}
                            className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                              secActive
                                ? "bg-[#f0efe9] text-[#2c2c2c] font-medium"
                                : "text-[#999] hover:text-[#666] hover:bg-[#f5f4f0]"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="truncate pr-2">
                                {sec.title}
                              </span>
                              <span className="text-xs text-[#ccc] shrink-0">
                                {sec.startPage}
                              </span>
                            </div>
                          </button>

                          {/* Level 3: Subsections — show when section is active */}
                          {sec.subsections &&
                            sec.subsections.length > 0 &&
                            secActive && (
                              <div className="ml-3 border-l border-[#f0efe9] pl-2 my-0.5">
                                {sec.subsections.map((sub, k) => {
                                  const subActive = isInRange(
                                    currentPage,
                                    sub.startPage,
                                    sub.endPage
                                  );
                                  return (
                                    <button
                                      key={k}
                                      onClick={() =>
                                        onNavigate(sub.startPage)
                                      }
                                      className={`w-full text-left px-2 py-1 rounded-md text-xs transition-colors ${
                                        subActive
                                          ? "text-[#5b7f6a] font-medium"
                                          : "text-[#bbb] hover:text-[#999]"
                                      }`}
                                    >
                                      <div className="flex items-center justify-between">
                                        <span className="truncate pr-2">
                                          {sub.title}
                                        </span>
                                        <span className="text-xs text-[#ddd] shrink-0">
                                          {sub.startPage}
                                        </span>
                                      </div>
                                    </button>
                                  );
                                })}
                              </div>
                            )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </nav>
      </div>
    </aside>
  );
}
