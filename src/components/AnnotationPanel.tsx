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
  { id: "casual", label: "轻松", desc: "口语化，简短直接" },
  { id: "balanced", label: "平衡", desc: "简洁有见地" },
  { id: "academic", label: "学术", desc: "专业术语+方法论" },
];

function getErrorInfo(error: string): { icon: string; title: string; hint: string } {
  if (error.includes("429"))
    return { icon: "⏳", title: "请求太频繁，API 限流了", hint: "免费额度有限，稍等一分钟再试" };
  if (error.includes("503"))
    return { icon: "⏳", title: "Gemini 服务暂时不可用", hint: "服务器过载或维护中，等一会儿再试" };
  if (error.includes("500"))
    return { icon: "⚠️", title: "服务器内部错误", hint: "可能是 API 密钥未配置，请检查环境变量" };
  if (error.includes("403"))
    return { icon: "🔒", title: "API 密钥无效或已过期", hint: "请检查 GEMINI_API_KEY 是否正确" };
  if (error.includes("404"))
    return { icon: "❓", title: "模型不可用", hint: "请切换其他模型再试" };
  if (error.includes("400"))
    return { icon: "⚠️", title: "请求参数有误", hint: "页面内容可能无法被处理，试试其他页" };
  if (error.includes("无可提取"))
    return { icon: "📄", title: "本页是扫描图片或无文字内容", hint: "正在尝试用图片识别，可能需要更长时间" };
  if (error.includes("Failed to fetch") || error.includes("network") || error.includes("NetworkError"))
    return { icon: "🌐", title: "网络连接失败", hint: "请检查网络连接后重试" };
  return { icon: "⚠️", title: "批注生成失败", hint: "请稍后重试，或切换模型" };
}

function ErrorDisplay({ error, onRetry, loading }: { error: string; onRetry: () => void; loading: boolean }) {
  const { icon, title, hint } = getErrorInfo(error);
  return (
    <div className="text-center py-10 px-2">
      <div className="text-2xl mb-3">{icon}</div>
      <p className="text-sm text-[#666] mb-1.5">{title}</p>
      <p className="text-xs text-[#999] mb-4">{hint}</p>
      <button
        onClick={onRetry}
        disabled={loading}
        className="text-xs px-4 py-2 bg-[#5b7f6a] text-white rounded-lg hover:bg-[#4d6e5b] transition-colors disabled:opacity-40"
      >
        重试
      </button>
    </div>
  );
}

export const ANNOTATION_TYPES = Object.keys(TYPE_CONFIG) as Array<keyof typeof TYPE_CONFIG>;

interface Props {
  annotations: StoredAnnotation[];
  loading: boolean;
  visible: boolean;
  onToggle: () => void;
  onRegenerate: () => void;
  onRegenerateAll: () => void;
  currentPage: number;
  model: string;
  onModelChange: (model: string) => void;
  density: string;
  onDensityChange: (density: string) => void;
  style: string;
  onStyleChange: (style: string) => void;
  error?: string;
  enabledTypes: string[];
  onEnabledTypesChange: (types: string[]) => void;
}

export default function AnnotationPanel({
  annotations,
  loading,
  visible,
  onToggle,
  onRegenerate,
  onRegenerateAll,
  currentPage,
  model,
  onModelChange,
  density,
  onDensityChange,
  style,
  onStyleChange,
  error,
  enabledTypes,
  onEnabledTypesChange,
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
            className="text-xs px-2 py-1.5 border border-[#e5e2db] rounded-md hover:bg-[#f5f4f0] text-[#666] disabled:opacity-40 transition-colors whitespace-nowrap"
            title="重新生成本页批注"
          >
            {loading ? "生成中..." : "重新生成"}
          </button>
          <button
            onClick={onRegenerateAll}
            disabled={loading}
            className="text-xs px-2 py-1.5 border border-[#e5e2db] rounded-md hover:bg-[#fff0f0] text-[#c66] disabled:opacity-40 transition-colors whitespace-nowrap"
            title="清除全书批注缓存，当前页将重新生成"
          >
            清除全部
          </button>
        </div>

        {/* Settings row: density + style */}
        <div className="flex items-center gap-2 mb-2">
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

        {/* Annotation type filter chips */}
        <div className="flex flex-wrap gap-1 mb-4">
          {ANNOTATION_TYPES.map((type) => {
            const cfg = TYPE_CONFIG[type];
            const isEnabled = enabledTypes.includes(type);
            return (
              <button
                key={type}
                onClick={() => {
                  if (isEnabled) {
                    onEnabledTypesChange(enabledTypes.filter((t) => t !== type));
                  } else {
                    onEnabledTypesChange([...enabledTypes, type]);
                  }
                }}
                className={`inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-full border transition-colors ${
                  isEnabled
                    ? "border-current bg-white"
                    : "border-[#e5e2db] bg-[#f5f4f0] text-[#ccc]"
                }`}
                style={isEnabled ? { color: cfg.color } : undefined}
              >
                <span>{cfg.icon}</span>
                {type}
              </button>
            );
          })}
        </div>

        {/* Model badge */}
        {annotations.length > 0 && !loading && (
          <div className="text-xs text-[#bbb] mb-3 flex items-center gap-1.5">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#5b7f6a]" />
            由 {modelLabel} 生成
          </div>
        )}

        {/* Content */}
        {(() => {
          const filteredAnnotations = annotations.filter((a) => enabledTypes.includes(a.type));
          return loading ? (
            <div className="flex flex-col items-center py-12 gap-3">
              <div className="w-6 h-6 border-2 border-[#5b7f6a] border-t-transparent rounded-full animate-spin" />
              <p className="text-sm text-[#999]">AI 正在生成批注...</p>
            </div>
          ) : error ? (
            <ErrorDisplay error={error} onRetry={onRegenerate} loading={loading} />
          ) : filteredAnnotations.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-sm text-[#999]">
                {annotations.length === 0 ? "本页暂无批注" : "所有批注已被筛选隐藏"}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-[#ccc] font-semibold mb-2">
                第 {currentPage} 页
              </div>
              {filteredAnnotations.map((anno, i) => {
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
                    {anno.anchor_text && anno.anchor_text.length > 3 && (
                      <div
                        className="mt-2 text-xs italic text-[#999] border-l-2 border-[#e5e2db] pl-2 leading-relaxed"
                      >
                        {"\u300C"}{anno.anchor_text}{"\u300D"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          );
        })()}
      </div>
    </aside>
  );
}
