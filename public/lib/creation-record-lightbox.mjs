import { buildParameterText } from "./studio-formatters.mjs";
import { normalizeStoredImageQuality } from "./image-quality-options.mjs";
import { getDefaultGenerationSize, getDefaultModelProtocolImageSize } from "./generation-size-options.mjs";

function getNow(nowIso) {
  return typeof nowIso === "function" ? nowIso() : new Date().toISOString();
}

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeSnapshotSize(value, { imageRoute = "", ratio = "" } = {}) {
  const normalized = cleanString(value);
  if (normalized && normalized.toLowerCase() !== "auto") {
    return normalized;
  }
  return cleanString(imageRoute).toLowerCase() === "c"
    ? getDefaultModelProtocolImageSize()
    : getDefaultGenerationSize(ratio || "4:5");
}

export function normalizeCreationGenerationSnapshotForView(item = {}) {
  const imageRoute = item.imageRoute || item.image_route || item.generationRoute;
  const ratio = item.ratio || item.aspectRatio;
  const effectiveSize = normalizeSnapshotSize(item.effectiveSize || item.effective_size || item.size, { imageRoute, ratio });
  const normalized = {
    generationPrompt: cleanString(item.generationPrompt || item.generation_prompt),
    baseUrl: cleanString(item.baseUrl || item.base_url),
    imageRoute: cleanString(imageRoute),
    responsesModel: cleanString(item.responsesModel || item.responses_model),
    imageModel: cleanString(item.imageModel || item.image_model),
    endpointPath: cleanString(item.endpointPath || item.endpoint_path),
    ratioLabel: cleanString(item.ratioLabel || item.ratio_label),
    requestedSize: normalizeSnapshotSize(item.requestedSize || item.requested_size, { imageRoute, ratio }),
    effectiveSize,
    actualSize: cleanString(item.actualSize || item.actual_size),
    size: normalizeSnapshotSize(item.size || effectiveSize, { imageRoute, ratio }),
    format: cleanString(item.format),
    quality: normalizeStoredImageQuality(item.quality, {
      imageRoute,
      imageModel: item.imageModel || item.image_model,
    }),
    reasoningEffort: cleanString(item.reasoningEffort || item.reasoning_effort),
    referenceImageNames: Array.isArray(item.referenceImageNames)
      ? item.referenceImageNames.map(cleanString).filter(Boolean)
      : [],
    referenceImageName: cleanString(item.referenceImageName || item.reference_image_name),
  };
  if (Object.prototype.hasOwnProperty.call(item, "hasReferenceImage")) {
    normalized.hasReferenceImage = Boolean(item.hasReferenceImage);
  } else if (Object.prototype.hasOwnProperty.call(item, "has_reference_image")) {
    normalized.hasReferenceImage = Boolean(item.has_reference_image);
  }
  return normalized;
}

export function buildCreationRecordLightboxItem(item = {}, set = {}, { nowIso } = {}) {
  const relativeFilename = String(item.relativePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
  return {
    ...item,
    id: `creation-record:${set.setId || ""}:${item.itemId || item.filename || relativeFilename}`,
    creationItemId: item.itemId || "",
    creationSetId: set.setId || "",
    filename: item.filename || relativeFilename || "creation-item.png",
    createdAt: item.generationCompletedAt || set.updatedAt || set.createdAt || getNow(nowIso),
    prompt: item.generationPrompt || item.prompt || "",
    imageModel: item.imageModel || "未记录",
    paramsText: buildParameterText(item, {}, { strictSnapshot: true }),
    isCreationRecordItem: true,
  };
}
