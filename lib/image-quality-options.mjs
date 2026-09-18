import { supportsExtendedImageQuality } from "./model-defaults.mjs";

// 官方 image_generation 工具接受的质量档。`xhigh` 与 `max` 是 GPT Image 2.5 新增的，
// 旧模型最高只到 `high`，送上去会被上游拒绝，所以归一化必须按模型收敛。
const IMAGE_QUALITY_DEFINITIONS = [
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
// 仓库既有行为是默认 `high`。保持 `high`，避免给所有未改配置的用户
// 悄悄换掉出图质量。
export const DEFAULT_IMAGE_QUALITY = "high";
// 旧模型上 `xhigh` / `max` 的降级目标。
const EXTENDED_QUALITY_FALLBACK = "high";
const GROK_IMAGE_QUALITY_DEFINITIONS = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
];
export const DEFAULT_GROK_IMAGE_QUALITY = "medium";

function normalizeQualityValue(value) {
  return String(value || "").trim().toLowerCase();
}

function isGrokImageRoute(value) {
  const normalized = normalizeQualityValue(value);
  return normalized === "d" || normalized === "route-d" || normalized === "grok";
}

function isGrokQuality(value) {
  return GROK_IMAGE_QUALITY_DEFINITIONS.some((option) => option.value === value);
}

export function getGrokImageQualityOptions() {
  return GROK_IMAGE_QUALITY_DEFINITIONS.map((option) => ({ ...option }));
}

export function normalizeGrokImageQuality(value, fallback = DEFAULT_GROK_IMAGE_QUALITY) {
  const normalized = normalizeQualityValue(value);
  if (isGrokQuality(normalized)) {
    return normalized;
  }

  // GPT quality tiers are not valid Grok values. Keep the closest deterministic
  // tier instead of forwarding an unsupported value to xAI.
  if (["high", "xhigh", "max"].includes(normalized)) {
    return "medium";
  }

  const normalizedFallback = normalizeQualityValue(fallback);
  if (isGrokQuality(normalizedFallback)) {
    return normalizedFallback;
  }

  return DEFAULT_GROK_IMAGE_QUALITY;
}

export function normalizeImageQualityForRoute(
  value,
  { imageRoute = "a", imageModel, fallback = DEFAULT_IMAGE_QUALITY } = {},
) {
  if (isGrokImageRoute(imageRoute)) {
    return normalizeGrokImageQuality(
      value,
      fallback === DEFAULT_IMAGE_QUALITY ? DEFAULT_GROK_IMAGE_QUALITY : fallback,
    );
  }

  return normalizeImageQuality(value, { imageModel, fallback });
}

// Historical records may omit quality, so preserve an empty field while
// migrating every non-empty legacy value to a supported deterministic tier.
export function normalizeStoredImageQuality(value, options = {}) {
  const normalized = normalizeQualityValue(value);
  return normalized
    ? normalizeImageQualityForRoute(normalized, options)
    : "";
}

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
  const normalized = normalizeQualityValue(value);
  if (!IMAGE_QUALITY_OPTIONS.includes(normalized)) {
    return false;
  }
  return isExtendedImageQuality(normalized) ? supportsExtendedImageQuality(imageModel) : true;
}

export function normalizeImageQuality(value, { imageModel, fallback = DEFAULT_IMAGE_QUALITY } = {}) {
  const normalized = normalizeQualityValue(value);

  if (normalized && IMAGE_QUALITY_OPTIONS.includes(normalized)) {
    // 档位本身合法，但模型不支持扩展档时降到 high，而不是让上游报错。
    if (isExtendedImageQuality(normalized) && !supportsExtendedImageQuality(imageModel)) {
      return EXTENDED_QUALITY_FALLBACK;
    }
    return normalized;
  }

  const normalizedFallback = normalizeQualityValue(fallback);
  if (normalizedFallback && normalizedFallback !== normalized) {
    return normalizeImageQuality(normalizedFallback, { imageModel, fallback: "" });
  }

  return DEFAULT_IMAGE_QUALITY;
}
