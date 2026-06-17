export const PPT_EXPORT_MODE_FLAT_IMAGE = "flat-image";
export const PPT_EXPORT_MODE_EDITABLE_RECONSTRUCTION = "editable-reconstruction";

export const PPT_EXPORT_MODES = [
  PPT_EXPORT_MODE_FLAT_IMAGE,
  PPT_EXPORT_MODE_EDITABLE_RECONSTRUCTION,
];

const PPT_EXPORT_MODE_SET = new Set(PPT_EXPORT_MODES);

export function normalizePptExportMode(value) {
  const mode = String(value || "").trim().toLowerCase();
  return PPT_EXPORT_MODE_SET.has(mode) ? mode : PPT_EXPORT_MODE_FLAT_IMAGE;
}

export function isEditablePptExportMode(value) {
  return normalizePptExportMode(value) === PPT_EXPORT_MODE_EDITABLE_RECONSTRUCTION;
}
