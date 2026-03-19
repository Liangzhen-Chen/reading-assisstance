"use client";

import type { StoredAnnotation } from "@/lib/storage";

const TYPE_CONFIG: Record<string, { icon: string; color: string }> = {
  核心论点: { icon: "🎯", color: "#c9a96e" },
  逻辑链梳理: { icon: "⛓️", color: "#8b7ec8" },
  术语定义: { icon: "📖", color: "#5b9bd5" },
  速读提示: { icon: "⚡", color: "#e6a23c" },
  跨章节关联: { icon: "🔗", color: "#67c23a" },
  位置感知: { icon: "🗺️", color: "#909399" },
};

interface Props {
  annotations: StoredAnnotation[];
  loading: boolean;
  visible: boolean;
  onToggle: () => void;
  currentPage: number;
}

export default function AnnotationPanel({
  annotations,
  loading,
  visible,
  onToggle,
  currentPage,
}: Props) {
  if (!visible) return null;

  return (
    <aside className="fixed right-0 top-14 bottom-0 w-[340px] bg-white border-l border-[#e5e2db] overflow-y-auto z-40">
      <div className="p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-[#bbb] uppercase tracking-wide">
              批注
            </span>
            <span className="text-xs bg-[#f0efe9] text-[#666] px-2.5 py-0.5 rounded-full">
              {annotations.length} 条
            </span>
          </div>
          <button
            onClick={onToggle}
            className="text-xs text-[#999] hover:text-[#666] transition-colors"
          >
            收起 ›
          </button>
        </div>

        {loading ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-6 h-6 border-2 border-[#5b7f6a] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#999]">AI 正在生成批注...</p>
          </div>
        ) : annotations.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-sm text-[#999]">本页暂无批注</p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="text-xs text-[#ccc] font-semibold mb-2">
              第 {currentPage} 页
            </div>
            {annotations.map((anno, i) => {
              const cfg = TYPE_CONFIG[anno.type] || {
                icon: "💬",
                color: "#999",
              };
              return (
                <div
                  key={i}
                  className="rounded-xl p-3.5 border border-[#eee] hover:shadow-md transition-shadow"
                  style={{ borderLeftWidth: 3, borderLeftColor: cfg.color }}
                >
                  <div
                    className="text-xs font-bold mb-1.5 flex items-center gap-1.5"
                    style={{ color: cfg.color }}
                  >
                    <span>{cfg.icon}</span>
                    {anno.type}
                  </div>
                  <div className="text-sm leading-relaxed text-[#444]">
                    {anno.content}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </aside>
  );
}
