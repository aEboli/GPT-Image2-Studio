export const QUICK_BLEND_MODE = "quick-blend";
export const QUICK_BLEND_ASSET_KIND = "quick-blend";
export const QUICK_BLEND_METADATA_FIELDS = Object.freeze([
  "quickBlendPairIndex",
  "quickBlendAImageName",
  "quickBlendBImageName",
  "quickBlendCImageName",
  "quickBlendDImageName",
  "quickBlendLayoutOrder",
  "quickBlendPlacementShape",
]);

export const QUICK_BLEND_REFERENCE_LABELS = Object.freeze([
  "Reference image 1: A image. Use only the visible A subject or subjects. Preserve identity cues, shape, color, material, markings, and proportions. Do not render this label.",
  "Reference image 2: B image. Use only the visible B subject or subjects. Preserve identity cues, shape, color, material, markings, and proportions. Do not render this label.",
]);

export const QUICK_BLEND_LAYOUT_ORDERS = Object.freeze(["vertical", "horizontal"]);
export const QUICK_BLEND_PLACEMENT_SHAPES = Object.freeze(["square", "rectangle"]);
export const QUICK_BLEND_GROUPS = Object.freeze(["A", "B", "C", "D"]);

function sanitizeQuickBlendFilename(value = "") {
  return String(value || "").replace(/[\s\p{C}]+/gu, " ").trim();
}

function getQuickBlendFilenameStem(value = "") {
  const rawFilename = String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .pop()
    ?.trim() || "";
  return rawFilename
    .replace(/\.[a-z0-9]{1,10}$/i, "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .trim();
}

function normalizeQuickBlendGroup(value = "") {
  const normalized = String(value || "").trim().toUpperCase();
  return QUICK_BLEND_GROUPS.includes(normalized) ? normalized : "";
}

function getQuickBlendGroupFilename(group, input = {}) {
  const normalizedGroup = normalizeQuickBlendGroup(group);
  if (normalizedGroup === "A") return input.aImageName || "";
  if (normalizedGroup === "B") return input.bImageName || "";
  if (normalizedGroup === "C") return input.cImageName || "";
  if (normalizedGroup === "D") return input.dImageName || "";
  return "";
}

export function getQuickBlendEnabledGroups({
  aImageName = "",
  bImageName = "",
  cImageName = "",
  dImageName = "",
  groups,
} = {}) {
  if (Array.isArray(groups) && groups.length > 0) {
    const normalizedGroups = groups.map(normalizeQuickBlendGroup).filter(Boolean);
    return QUICK_BLEND_GROUPS.filter((group) => normalizedGroups.includes(group));
  }

  return [
    "A",
    "B",
    sanitizeQuickBlendFilename(cImageName) ? "C" : "",
    sanitizeQuickBlendFilename(dImageName) ? "D" : "",
  ].filter(Boolean);
}

export function normalizeQuickBlendLayoutOrder(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "horizontal" || normalized === "left-right" || normalized === "left_to_right") {
    return "horizontal";
  }
  return "vertical";
}

export function normalizeQuickBlendPlacementShape(value = "") {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "rectangle" || normalized === "rect" || normalized === "rectangular") {
    return "rectangle";
  }
  return "square";
}

export function buildQuickBlendReferenceLabels({ groups } = {}) {
  return getQuickBlendEnabledGroups({ groups }).map((group, index) =>
    [
      `Reference image ${index + 1}: ${group} image.`,
      `Use only the visible product group ${group} subject or subjects.`,
      "Preserve identity cues, shape, color, material, markings, and proportions.",
      "Do not render this label.",
    ].join(" "),
  );
}

export function buildQuickBlendFilenameToken({
  aImageName = "",
  bImageName = "",
  cImageName = "",
  dImageName = "",
} = {}) {
  return [
    getQuickBlendFilenameStem(aImageName),
    getQuickBlendFilenameStem(bImageName),
    getQuickBlendFilenameStem(cImageName),
    getQuickBlendFilenameStem(dImageName),
  ]
    .filter(Boolean)
    .join("-")
    .slice(0, 100)
    .replace(/-+$/g, "");
}

export function normalizeQuickBlendPairIndex(value = 1) {
  const parsed = Number(String(value || "1").trim());
  return String(Number.isInteger(parsed) && parsed > 0 ? parsed : 1);
}

function buildQuickBlendSourceLines(input = {}, enabledGroups = []) {
  return enabledGroups.flatMap((group, index) => {
    const filename = sanitizeQuickBlendFilename(getQuickBlendGroupFilename(group, input));
    return [
      `Reference image ${index + 1} is product group ${group}.`,
      filename ? `${group} filename: ${filename}.` : "",
    ].filter(Boolean);
  });
}

function getQuickBlendOrderInstruction(layoutOrder, enabledGroups = []) {
  const groupList = enabledGroups.join(", ");
  if (layoutOrder === "horizontal") {
    return [
      `Use left-to-right sorting order for ${groupList}: place groups from left to right, then continue on the next row when the selected shape needs multiple rows.`,
      "For two enabled groups, A must sit left of B.",
    ].join(" ");
  }

  const verticalInstruction = [
    `Use top-to-bottom sorting order for ${groupList}: place groups from top to bottom, then continue in the next column when the selected shape needs multiple columns.`,
    "For two enabled groups, A must sit above B.",
  ].join(" ");
  return enabledGroups.length === 2
    ? `${verticalInstruction} Arrange the A subject group above the B subject group in one vertical image.`
    : verticalInstruction;
}

function getQuickBlendPlacementInstruction(placementShape, layoutOrder, enabledGroups = []) {
  const count = enabledGroups.length;
  const horizontalSquareFour = "For four enabled groups, use exactly a 2 by 2 grid: A and B on the first row, then C and D on the second row when left-to-right sorting is selected.";
  const verticalSquareFour = "For four enabled groups, use exactly a 2 by 2 grid: A and B in the first column, then C and D in the second column when top-to-bottom sorting is selected.";
  const horizontalRectangleFour = "For four enabled groups, use a 2 by 2 matrix inside the rectangular canvas: A and B on the first row, then C and D on the second row when left-to-right sorting is selected.";
  const verticalRectangleFour = "For four enabled groups, use a 2 by 2 matrix inside the rectangular canvas: A and B in the first column, then C and D in the second column when top-to-bottom sorting is selected.";
  const squareDetail = count === 4
    ? layoutOrder === "horizontal" ? horizontalSquareFour : verticalSquareFour
    : "For three enabled groups, use a compact 2 by 2-style matrix with one neutral empty space if needed; for two enabled groups, follow the selected sorting direction.";
  const rectangleDetail = count === 4
    ? layoutOrder === "horizontal" ? horizontalRectangleFour : verticalRectangleFour
    : "For three enabled groups, use a compact rectangular matrix with one neutral empty slot if needed; for two enabled groups, follow the selected sorting direction.";
  if (placementShape === "rectangle") {
    return [
      "Use a rectangular sorting layout.",
      rectangleDetail,
      layoutOrder === "horizontal"
        ? "Prefer a wider row-first matrix while preserving the chosen left-to-right reading order."
        : "Prefer a taller column-first matrix while preserving the chosen top-to-bottom reading order.",
      "Treat the rectangle choice as the shape of the sorted positions.",
      "Keep consistent margins and no visible borders.",
    ].join(" ");
  }

  return [
    "Use a near-square sorting layout.",
    squareDetail,
    "For four enabled groups, use only the balanced 2 by 2 matrix.",
    "Treat the square choice as the shape of the sorted positions.",
    "Keep consistent margins and no visible borders.",
  ].join(" ");
}

function getQuickBlendSubjectIntegrityInstruction() {
  return [
    "Preserve subject shape, colors, materials, markings, proportions, and identity cues from each source image.",
    "Place each subject in its assigned layout slot using contain-style proportional scaling.",
    "Preserve each subject's natural aspect ratio, silhouette, outline, and geometry.",
    "Do not stretch, squash, warp, bend, elongate, compress, crop, or force any subject to fill its slot.",
    "If a subject is tall, wide, or irregular, leave extra neutral padding around it instead of deforming it.",
    "Do not redesign, recolor, relabel, or merge the two subjects into one object.",
  ].join(" ");
}

export function buildQuickBlendPrompt({
  pairIndex = 1,
  aImageName = "",
  bImageName = "",
  cImageName = "",
  dImageName = "",
  layoutOrder = "vertical",
  placementShape = "square",
} = {}) {
  const normalizedPairIndex = normalizeQuickBlendPairIndex(pairIndex);
  const normalizedAImageName = sanitizeQuickBlendFilename(aImageName);
  const normalizedBImageName = sanitizeQuickBlendFilename(bImageName);
  const normalizedCImageName = sanitizeQuickBlendFilename(cImageName);
  const normalizedDImageName = sanitizeQuickBlendFilename(dImageName);
  const normalizedLayoutOrder = normalizeQuickBlendLayoutOrder(layoutOrder);
  const normalizedPlacementShape = normalizeQuickBlendPlacementShape(placementShape);
  const promptInput = {
    aImageName: normalizedAImageName,
    bImageName: normalizedBImageName,
    cImageName: normalizedCImageName,
    dImageName: normalizedDImageName,
  };
  const enabledGroups = getQuickBlendEnabledGroups(promptInput);
  const sourceLine = [
    `Quick Blend pair ${normalizedPairIndex}.`,
    ...buildQuickBlendSourceLines(promptInput, enabledGroups),
  ].filter(Boolean).join(" ");

  return {
    prompt: [
      sourceLine,
      "Use the first reference image as A and the second reference image as B.",
      "Use the uploaded reference images only as their assigned A/B/C/D product groups.",
      `Extract the visible main subject or subjects from ${enabledGroups.join(", ")}. Remove or neutralize the original backgrounds so the final image reads like clean cutout composition work.`,
      getQuickBlendOrderInstruction(normalizedLayoutOrder, enabledGroups),
      getQuickBlendPlacementInstruction(normalizedPlacementShape, normalizedLayoutOrder, enabledGroups),
      getQuickBlendSubjectIntegrityInstruction(),
      "Use a clean neutral studio background or transparent-looking neutral surface. Keep the composition product-like and uncluttered.",
      "Do not add text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements.",
      "Do not create a gallery grid or exhaustive combination set. Generate only this matched indexed pair. Generate separate C or D outputs is forbidden.",
    ].join(" "),
    pairIndex: normalizedPairIndex,
    aImageName: normalizedAImageName,
    bImageName: normalizedBImageName,
    cImageName: normalizedCImageName,
    dImageName: normalizedDImageName,
    layoutOrder: normalizedLayoutOrder,
    placementShape: normalizedPlacementShape,
    enabledGroups,
  };
}
