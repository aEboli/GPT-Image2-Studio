const OUTPUT_FORMAT_OPTIONS = [
  { value: "png", label: "PNG" },
  { value: "jpg", label: "JPG" },
];

export function getOutputFormatOptions() {
  return OUTPUT_FORMAT_OPTIONS.map((option) => ({ ...option }));
}

export function normalizeOutputFormat(value = "png") {
  const normalized = String(value || "png").trim().replace(/^\./, "").toLowerCase();
  if (normalized === "jpg" || normalized === "jpeg") {
    return "jpg";
  }
  return "png";
}

export function toApiOutputFormat(value = "png") {
  return normalizeOutputFormat(value) === "jpg" ? "jpeg" : "png";
}

export function toOutputFormatExtension(value = "png") {
  return normalizeOutputFormat(value);
}

export function toOutputFormatMimeType(value = "png") {
  return normalizeOutputFormat(value) === "jpg" ? "image/jpeg" : "image/png";
}
