function cleanString(value) {
  return String(value || "").trim();
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
  const resolvedEffectiveSize = cleanString(effectiveSize || parameters.finalSize);
  return {
    generationPrompt: cleanString(generationPrompt),
    baseUrl: cleanString(generationConfig.baseUrl),
    imageRoute: cleanString(generationConfig.imageRoute),
    responsesModel: cleanString(generationConfig.responsesModel),
    imageModel: cleanString(generationConfig.imageModel),
    endpointPath: cleanString(generationConfig.endpointPath),
    ratio: cleanString(parameters.ratioOption?.value),
    ratioLabel: cleanString(parameters.ratioOption?.label),
    resolutionTier: cleanString(parameters.resolutionTier),
    requestedSize: cleanString(parameters.requestedSize),
    effectiveSize: resolvedEffectiveSize,
    size: resolvedEffectiveSize,
    format: cleanString(format),
    quality: cleanString(quality),
    reasoningEffort: cleanString(reasoningEffort),
    targetLanguage: cleanString(parameters.targetLanguage),
    hasReferenceImage: referenceImageNames.length > 0,
    referenceImageNames,
    referenceImageName: referenceImageNames[0] || "",
  };
}
