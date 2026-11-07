const OUTPUT_FORMAT_OPTIONS = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
  { value: "webp", label: "WebP" },
];

export function getOutputFormatOptions({ operation = "generate", special = false, automatic = false } = {}) {
  return [...(automatic ? [{ value: "auto", label: "自动（根据提示词）" }] : []), ...OUTPUT_FORMAT_OPTIONS, ...(operation === "generate" && special ? [{ value: "gif", label: "GIF 动画" }, { value: "svg", label: "SVG 矢量" }] : [])].map((option) => ({ ...option }));
}

export function normalizeOutputFormat(value = "png") {
  const normalized = String(value || "png").trim().replace(/^\./, "").toLowerCase();
  if (normalized === "jpg" || normalized === "jpeg") {
    return "jpg";
  }
  if (["webp", "gif", "svg"].includes(normalized)) return normalized;
  return "png";
}

export function toApiOutputFormat(value = "png") {
  return normalizeOutputFormat(value) === "jpg" ? "jpeg" : normalizeOutputFormat(value);
}

export function toOutputFormatExtension(value = "png") {
  return normalizeOutputFormat(value);
}

export function toOutputFormatMimeType(value = "png") {
  const format = normalizeOutputFormat(value);
  return format === "jpg" ? "image/jpeg" : format === "svg" ? "image/svg+xml" : `image/${format}`;
}
