export const DEFAULT_RESPONSES_MODEL = "gpt-5.4-mini";
export const DEFAULT_DIRECT_RESPONSES_MODEL = DEFAULT_RESPONSES_MODEL;
export const DEFAULT_DIRECT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_PROTOCOL_IMAGE_MODEL = "gemini-3.1-flash-image-preview";

// 路由模式的生图工具模型只接受官方 image_generation 工具支持的这几个模型 ID，
// 顺序与官方文档的模型目录一致。界面只提供下拉选择，不允许自定义，因此这里既是
// 选项来源也是校验白名单。
export const IMAGE_TOOL_MODEL_OPTIONS = [
  "gpt-image-2",
  "gpt-image-2.5-sunburst",
  "gpt-image-2.5-flare",
];
export const DEFAULT_IMAGE_TOOL_MODEL = DEFAULT_DIRECT_IMAGE_MODEL;

// GPT Image 2.5 才支持 `xhigh` / `max` 质量档；`gpt-image-2` 及更早的模型最高 `high`。
const EXTENDED_QUALITY_IMAGE_MODELS = ["gpt-image-2.5-sunburst", "gpt-image-2.5-flare"];

export function supportsExtendedImageQuality(imageModel) {
  return EXTENDED_QUALITY_IMAGE_MODELS.includes(String(imageModel || "").trim());
}

export function normalizeImageToolModel(value, fallback = DEFAULT_IMAGE_TOOL_MODEL) {
  const normalized = String(value || "").trim();
  if (IMAGE_TOOL_MODEL_OPTIONS.includes(normalized)) {
    return normalized;
  }

  const normalizedFallback = String(fallback || "").trim();
  return IMAGE_TOOL_MODEL_OPTIONS.includes(normalizedFallback) ? normalizedFallback : DEFAULT_IMAGE_TOOL_MODEL;
}
