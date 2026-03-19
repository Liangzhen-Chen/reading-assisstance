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

export const AVAILABLE_MODELS = [
  { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash Lite" },
  { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { id: "gemini-2.5-pro", label: "Gemini 2.5 Pro" },
];

export const DENSITY_OPTIONS = [
  { id: "low", label: "精简", desc: "每页 1 条" },
  { id: "medium", label: "适中", desc: "每页 2-3 条" },
  { id: "high", label: "详细", desc: "每页 4-6 条" },
];

export const STYLE_OPTIONS = [
  { id: "casual", label: "轻松", desc: "像朋友聊天" },
  { id: "balanced", label: "学长", desc: "有见解不居高临下" },
  { id: "academic", label: "学术", desc: "专业术语+方法论" },
];

interface Props {
  annotations: StoredAnnotation[];
  loading: boolean;
  visible: boolean;
  onToggle: () => void;
  onRegenerate: () => void;
  currentPage: number;
  model: string;
  onModelChange: (model: string) => void;
  density: string;
  onDensityChange: (density: string) => void;
  style: string;
  onStyleChange: (style: string) => void;
  error?: string;
}

export default function AnnotationPanel({
  annotations,
  loading,
  visible,
  onToggle,
  onRegenerate,
  currentPage,
  model,
  onModelChange,
  density,
  onDensityChange,
  style,
  onStyleChange,
  error,
}: Props) {
  if (!visible) return null;

  const modelLabel =
    AVAILABLE_MODELS.find((m) => m.id === model)?.label || model;

  return (
    <aside className="fixed right-0 top-14 bottom-0 w-[340px] bg-white border-l border-[#e5e2db] overflow-y-auto z-40">
      <div className="p-5">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
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

        {/* Settings row: model */}
        <div className="flex items-center gap-2 mb-2">
          <select
            value={model}
            onChange={(e) => onModelChange(e.target.value)}
            className="flex-1 text-xs border border-[#e5e2db] rounded-md px-2 py-1.5 bg-white text-[#666] focus:outline-none focus:border-[#5b7f6a]"
          >
            {AVAILABLE_MODELS.map((m) => (
              <option key={m.id} value={m.id}>
                {m.label}
              </option>
            ))}
          </select>
          <button
            onClick={onRegenerate}
            disabled={loading}
            className="text-xs px-2.5 py-1.5 border border-[#e5e2db] rounded-md hover:bg-[#f5f4f0] text-[#666] disabled:opacity-40 transition-colors whitespace-nowrap"
            title="清除缓存并重新生成本页批注"
          >
            {loading ? "生成中..." : "重新生成"}
          </button>
        </div>

        {/* Settings row: density + style */}
        <div className="flex items-center gap-2 mb-4">
          {/* Density toggle */}
          <div className="flex-1 flex bg-[#f5f4f0] rounded-lg p-0.5">
            {DENSITY_OPTIONS.map((d) => (
              <button
                key={d.id}
                onClick={() => onDensityChange(d.id)}
                className={`flex-1 text-xs py-1 rounded-md transition-colors ${
                  density === d.id
                    ? "bg-white text-[#2c2c2c] shadow-sm font-medium"
                    : "text-[#999] hover:text-[#666]"
                }`}
                title={d.desc}
              >
                {d.label}
              </button>
            ))}
          </div>

          {/* Style toggle */}
          <div className="flex-1 flex bg-[#f5f4f0] rounded-lg p-0.5">
            {STYLE_OPTIONS.map((s) => (
              <button
                key={s.id}
                onClick={() => onStyleChange(s.id)}
                className={`flex-1 text-xs py-1 rounded-md transition-colors ${
                  style === s.id
                    ? "bg-white text-[#2c2c2c] shadow-sm font-medium"
                    : "text-[#999] hover:text-[#666]"
                }`}
                title={s.desc}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>

        {/* Model badge */}
        {annotations.length > 0 && !loading && (
          <div className="text-xs text-[#bbb] mb-3 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#5b7f6a]" />
            由 {modelLabel} 生成
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="flex flex-col items-center py-12 gap-3">
            <div className="w-6 h-6 border-2 border-[#5b7f6a] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[#999]">AI 正在生成批注...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-sm text-[#999] mb-2">本页暂无批注</p>
            <p className="text-xs text-red-400 bg-red-50 rounded-lg p-3">
              {error}
            </p>
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
