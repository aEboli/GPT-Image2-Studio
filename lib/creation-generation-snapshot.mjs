import { normalizeImageQualityForRoute } from "./image-quality-options.mjs";
import { getDefaultGenerationSize, getDefaultModelProtocolImageSize } from "./generation-size-options.mjs";

function cleanString(value) {
  return String(value || "").trim();
}

function migrateAutomaticResolution(value, fallback) {
  const normalized = cleanString(value);
  return normalized.toLowerCase() === "auto" ? cleanString(fallback) : normalized;
}

function getDefaultSnapshotSize(generationConfig = {}, parameters = {}) {
  const imageRoute = cleanString(generationConfig.imageRoute).toLowerCase();
  if (imageRoute === "c") {
    return getDefaultModelProtocolImageSize();
  }
  return getDefaultGenerationSize(cleanString(parameters.ratioOption?.value) || "4:5");
}

function normalizeReferenceImageNames(referenceImages = []) {
  return [...new Set(
    (Array.isArray(referenceImages) ? referenceImages : [])
      .map((image) => cleanString(image?.filename || image?.name || image))
      .filter(Boolean),
  )];
}

export function buildCreationGenerationSnapshot({
  generationPrompt,
  generationConfig = {},
  parameters = {},
  effectiveSize,
  format,
  quality,
  reasoningEffort,
  referenceImages = [],
} = {}) {
  const referenceImageNames = normalizeReferenceImageNames(referenceImages);
  const defaultSize = getDefaultSnapshotSize(generationConfig, parameters);
  const resolvedEffectiveSize = migrateAutomaticResolution(effectiveSize || parameters.finalSize, defaultSize) || defaultSize;
  const resolvedRequestedSize = migrateAutomaticResolution(parameters.requestedSize, resolvedEffectiveSize) || resolvedEffectiveSize;
  const resolvedResolutionTier = migrateAutomaticResolution(parameters.resolutionTier, resolvedRequestedSize) || resolvedRequestedSize;
  return {
    generationPrompt: cleanString(generationPrompt),
    baseUrl: cleanString(generationConfig.baseUrl),
    imageRoute: cleanString(generationConfig.imageRoute),
    responsesModel: cleanString(generationConfig.responsesModel),
    imageModel: cleanString(generationConfig.imageModel),
    endpointPath: cleanString(generationConfig.endpointPath),
    ratio: cleanString(parameters.ratioOption?.value),
    ratioLabel: cleanString(parameters.ratioOption?.label),
    resolutionTier: resolvedResolutionTier,
    requestedSize: resolvedRequestedSize,
    effectiveSize: migrateAutomaticResolution(resolvedEffectiveSize, resolvedRequestedSize),
    size: migrateAutomaticResolution(resolvedEffectiveSize, resolvedRequestedSize),
    format: cleanString(format),
    quality: normalizeImageQualityForRoute(quality, {
      imageRoute: generationConfig.imageRoute,
      imageModel: generationConfig.imageModel,
    }),
    ...(String(generationConfig.imageRoute || "").trim().toLowerCase() === "d"
      ? {}
      : { reasoningEffort: cleanString(reasoningEffort) }),
    targetLanguage: cleanString(parameters.targetLanguage),
    hasReferenceImage: referenceImageNames.length > 0,
    referenceImageNames,
    referenceImageName: referenceImageNames[0] || "",
  };
}
