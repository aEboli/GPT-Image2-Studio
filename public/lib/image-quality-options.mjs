import { supportsExtendedImageQuality } from "./model-defaults.mjs";

// 官方 image_generation 工具接受的质量档。`xhigh` 与 `max` 是 GPT Image 2.5 新增的，
// 旧模型最高只到 `high`，送上去会被上游拒绝，所以归一化必须按模型收敛。
const IMAGE_QUALITY_DEFINITIONS = [
  { value: "auto", label: "自动", extended: false },
  { value: "low", label: "Low", extended: false },
  { value: "medium", label: "Medium", extended: false },
  { value: "high", label: "High", extended: false },
  { value: "xhigh", label: "XHigh", extended: true },
  { value: "max", label: "Max", extended: true },
];

export const IMAGE_QUALITY_OPTIONS = IMAGE_QUALITY_DEFINITIONS.map((option) => option.value);
export const EXTENDED_IMAGE_QUALITY_OPTIONS = IMAGE_QUALITY_DEFINITIONS.filter((option) => option.extended).map(
  (option) => option.value,
);
// 仓库既有行为是默认 `high`（官方 API 默认为 `auto`）。保持 `high`，避免给所有
// 未改配置的用户悄悄换掉出图质量。
export const DEFAULT_IMAGE_QUALITY = "high";
// 旧模型上 `xhigh` / `max` 的降级目标。
const EXTENDED_QUALITY_FALLBACK = "high";

export function isExtendedImageQuality(value) {
  return EXTENDED_IMAGE_QUALITY_OPTIONS.includes(String(value || "").trim().toLowerCase());
}

export function getImageQualityOptions(imageModel) {
  const allowExtended = supportsExtendedImageQuality(imageModel);
  return IMAGE_QUALITY_DEFINITIONS.filter((option) => allowExtended || !option.extended).map(({ value, label }) => ({
    value,
    label,
  }));
}

export function isImageQualitySupportedByModel(value, imageModel) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!IMAGE_QUALITY_OPTIONS.includes(normalized)) {
    return false;
  }
  return isExtendedImageQuality(normalized) ? supportsExtendedImageQuality(imageModel) : true;
}

export function normalizeImageQuality(value, { imageModel, fallback = DEFAULT_IMAGE_QUALITY } = {}) {
  const normalized = String(value || "").trim().toLowerCase();

  if (IMAGE_QUALITY_OPTIONS.includes(normalized)) {
    // 档位本身合法，但模型不支持扩展档时降到 high，而不是让上游报错。
    if (isExtendedImageQuality(normalized) && !supportsExtendedImageQuality(imageModel)) {
      return EXTENDED_QUALITY_FALLBACK;
    }
    return normalized;
  }

  const normalizedFallback = String(fallback || "").trim().toLowerCase();
  if (normalizedFallback && normalizedFallback !== normalized) {
    return normalizeImageQuality(normalizedFallback, { imageModel, fallback: "" });
  }

  return DEFAULT_IMAGE_QUALITY;
}
