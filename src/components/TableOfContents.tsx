"use client";

import type { BookStructure, BookChapter } from "@/lib/storage";

interface Props {
  structure: BookStructure | null;
  currentPage: number;
  visible: boolean;
  onToggle: () => void;
  onNavigate: (page: number) => void;
}

function isActiveChapter(ch: BookChapter, page: number): boolean {
  return page >= ch.startPage && page <= ch.endPage;
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
            const active = isActiveChapter(ch, currentPage);
            return (
              <div key={i}>
                <button
                  onClick={() => onNavigate(ch.startPage)}
                  className={`w-full text-left px-2.5 py-2 rounded-lg text-sm transition-colors group ${
                    active
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

                {/* Sections — only show for active chapter or if few sections */}
                {ch.sections.length > 0 && active && (
                  <div className="ml-3 border-l border-[#e5e2db] pl-2 my-0.5">
                    {ch.sections.map((sec, j) => {
                      const secActive =
                        currentPage >= sec.startPage &&
                        currentPage <= sec.endPage;
                      return (
                        <button
                          key={j}
                          onClick={() => onNavigate(sec.startPage)}
                          className={`w-full text-left px-2 py-1.5 rounded-md text-xs transition-colors ${
                            secActive
                              ? "bg-[#f0efe9] text-[#2c2c2c] font-medium"
                              : "text-[#999] hover:text-[#666] hover:bg-[#f5f4f0]"
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <span className="truncate pr-2">{sec.title}</span>
                            <span className="text-xs text-[#ccc] shrink-0">
                              {sec.startPage}
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
        </nav>
      </div>
    </aside>
  );
}
