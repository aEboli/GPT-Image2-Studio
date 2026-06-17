import {
  IMAGE_DECOMPOSITION_MODE,
  IMAGE_DECOMPOSITION_REFERENCE_LABEL,
} from "./image-decomposition-prompt.mjs";
import {
  QUICK_BLEND_GROUPS,
  QUICK_BLEND_MODE,
  QUICK_BLEND_REFERENCE_LABELS,
  buildQuickBlendReferenceLabels,
} from "./quick-blend-prompt.mjs";

export const STYLE_TRANSFER_REFERENCE_IMAGE_LABELS = [
  "Reference image 1: SOURCE image. Preserve content, identity, pose, composition, and layout only. Do not preserve its visual style.",
  "Reference image 2: STYLE reference. This image is the style authority for final rendering, realism level, lighting, texture, color, and material finish.",
];

export const STYLE_TRANSFER_SOURCE_IMAGE_LABELS = [STYLE_TRANSFER_REFERENCE_IMAGE_LABELS[0]];

function normalizeReferenceImages(referenceImages = []) {
  if (!Array.isArray(referenceImages)) {
    return referenceImages ? [referenceImages] : [];
  }

  return referenceImages.filter(Boolean);
}

export function buildPromptModeReferenceImageLabels(referenceImages = []) {
  const images = normalizeReferenceImages(referenceImages);
  const count = images.length;
  return images.map((image, index) => {
    const filename = String(image?.filename || `reference image ${index + 1}`).trim();
    return [
      `Prompt mode reference image ${index + 1} of ${count}: ${filename}.`,
      "Use this uploaded image as the visual source for the generation.",
      "Treat the user prompt as an edit or enhancement instruction for this reference image.",
      "Preserve the visible subject, composition, pose, structure, style cues, and important details unless the user prompt explicitly asks to change them.",
      "Do not ignore the reference image or replace it with an unrelated subject.",
    ].join(" ");
  });
}

export function buildGenerationReferenceImageLabels(
  generationMode = "",
  styleTransferStylePreset = "",
  referenceImages = [],
  options = {},
) {
  if (generationMode === IMAGE_DECOMPOSITION_MODE) {
    return [IMAGE_DECOMPOSITION_REFERENCE_LABEL];
  }

  if (generationMode === QUICK_BLEND_MODE) {
    const quickBlendGroups = Array.isArray(options.quickBlendGroups) && options.quickBlendGroups.length > 0
      ? options.quickBlendGroups
      : QUICK_BLEND_GROUPS.slice(0, normalizeReferenceImages(referenceImages).length || QUICK_BLEND_REFERENCE_LABELS.length);
    return buildQuickBlendReferenceLabels({ groups: quickBlendGroups });
  }

  if (generationMode === "style-transfer") {
    return styleTransferStylePreset ? STYLE_TRANSFER_SOURCE_IMAGE_LABELS : STYLE_TRANSFER_REFERENCE_IMAGE_LABELS;
  }

  if (generationMode) {
    return [];
  }

  return buildPromptModeReferenceImageLabels(referenceImages);
}
