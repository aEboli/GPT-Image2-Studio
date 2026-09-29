import { buildParameterText } from "./studio-formatters.mjs";
import { normalizeStoredImageQuality } from "./image-quality-options.mjs";
import { getDefaultGenerationSize, getDefaultModelProtocolImageSize } from "./generation-size-options.mjs";

function getNow(nowIso) {
  return typeof nowIso === "function" ? nowIso() : new Date().toISOString();
}

function cleanString(value) {
  return String(value || "").trim();
}

function parseStoredBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "on", "yes", "enabled"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "off", "no", "disabled"].includes(normalized)) {
    return false;
  }
  return undefined;
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
    ratioLabel: cleanString(ratio),
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
    imageBackground: cleanString(item.imageBackground || item.image_background),
    ...(Object.prototype.hasOwnProperty.call(item, "includeImageToolModel")
      ? { includeImageToolModel: parseStoredBoolean(item.includeImageToolModel) }
      : Object.prototype.hasOwnProperty.call(item, "include_image_tool_model")
        ? { includeImageToolModel: parseStoredBoolean(item.include_image_tool_model) }
        : {}),
    ...(Object.prototype.hasOwnProperty.call(item, "directImageStream")
      ? { directImageStream: parseStoredBoolean(item.directImageStream) }
      : Object.prototype.hasOwnProperty.call(item, "direct_image_stream")
        ? { directImageStream: parseStoredBoolean(item.direct_image_stream) }
        : {}),
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
