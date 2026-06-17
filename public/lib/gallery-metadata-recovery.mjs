const STRING_METADATA_FIELDS = [
  "prompt",
  "createdAt",
  "baseUrl",
  "imageRoute",
  "responsesModel",
  "imageModel",
  "generationMode",
  "assetKind",
  "referenceImageName",
  "ratio",
  "ratioLabel",
  "size",
  "actualSize",
  "quality",
  "format",
  "reasoningEffort",
  "generationStartedAt",
  "generationCompletedAt",
  "generationDurationMs",
  "portraitSetId",
  "portraitItemId",
  "portraitStyle",
  "portraitShotType",
  "portraitAction",
  "subjectName",
  "subjectSummary",
];

function normalizeString(value) {
  return String(value || "").trim();
}

function normalizeStringArray(values) {
  if (!Array.isArray(values)) {
    return [];
  }

  return [...new Set(values.map((value) => normalizeString(value)).filter(Boolean))];
}

function hasMeaningfulString(value) {
  return normalizeString(value).length > 0;
}

export function buildGalleryMetadataCacheEntry(item = {}) {
  const entry = {};

  for (const field of STRING_METADATA_FIELDS) {
    const value = normalizeString(item[field]);
    if (value) {
      entry[field] = value;
    }
  }

  const referenceImageNames = normalizeStringArray(item.referenceImageNames);
  const referenceImageName = normalizeString(item.referenceImageName || referenceImageNames[0]);

  if (referenceImageNames.length > 0) {
    entry.referenceImageNames = referenceImageNames;
  }

  if (referenceImageName) {
    entry.referenceImageName = referenceImageName;
  }

  if (Boolean(item.hasReferenceImage || referenceImageNames.length > 0 || referenceImageName)) {
    entry.hasReferenceImage = true;
  }

  const selectedStyles = normalizeStringArray(item.selectedStyles);
  if (selectedStyles.length > 0) {
    entry.selectedStyles = selectedStyles;
  }

  const selectedActions = normalizeStringArray(item.selectedActions);
  if (selectedActions.length > 0) {
    entry.selectedActions = selectedActions;
  }

  return entry;
}

export function mergeGalleryItemWithCachedMetadata(item = {}, cachedEntry = {}) {
  const merged = { ...item };

  for (const field of STRING_METADATA_FIELDS) {
    const currentValue = normalizeString(item[field]);
    const cachedValue = normalizeString(cachedEntry[field]);
    merged[field] = currentValue || cachedValue || "";
  }

  const currentReferenceNames = normalizeStringArray(item.referenceImageNames);
  const cachedReferenceNames = normalizeStringArray(cachedEntry.referenceImageNames);
  const nextReferenceNames = currentReferenceNames.length > 0 ? currentReferenceNames : cachedReferenceNames;
  const nextReferenceName =
    normalizeString(item.referenceImageName) ||
    normalizeString(nextReferenceNames[0]) ||
    normalizeString(cachedEntry.referenceImageName);

  merged.referenceImageNames = nextReferenceNames;
  merged.referenceImageName = nextReferenceName;
  merged.hasReferenceImage = Boolean(
    item.hasReferenceImage || cachedEntry.hasReferenceImage || nextReferenceNames.length > 0 || nextReferenceName,
  );
  const currentSelectedStyles = normalizeStringArray(item.selectedStyles);
  const cachedSelectedStyles = normalizeStringArray(cachedEntry.selectedStyles);
  merged.selectedStyles = currentSelectedStyles.length > 0 ? currentSelectedStyles : cachedSelectedStyles;
  const currentSelectedActions = normalizeStringArray(item.selectedActions);
  const cachedSelectedActions = normalizeStringArray(cachedEntry.selectedActions);
  merged.selectedActions = currentSelectedActions.length > 0 ? currentSelectedActions : cachedSelectedActions;

  return merged;
}

export function collectGalleryMetadataRepairPatch(sourceItem = {}, recoveredItem = {}) {
  const patch = {};

  for (const field of STRING_METADATA_FIELDS) {
    if (!hasMeaningfulString(sourceItem[field]) && hasMeaningfulString(recoveredItem[field])) {
      patch[field] = normalizeString(recoveredItem[field]);
    }
  }

  const sourceReferenceNames = normalizeStringArray(sourceItem.referenceImageNames);
  const recoveredReferenceNames = normalizeStringArray(recoveredItem.referenceImageNames);
  if (sourceReferenceNames.length === 0 && recoveredReferenceNames.length > 0) {
    patch.referenceImageNames = recoveredReferenceNames;
  }

  const sourceReferenceName = normalizeString(sourceItem.referenceImageName);
  const recoveredReferenceName =
    normalizeString(recoveredItem.referenceImageName) || normalizeString(recoveredReferenceNames[0]);
  if (!sourceReferenceName && recoveredReferenceName) {
    patch.referenceImageName = recoveredReferenceName;
  }

  if (
    !sourceItem.hasReferenceImage &&
    Boolean(recoveredItem.hasReferenceImage || recoveredReferenceNames.length > 0 || recoveredReferenceName)
  ) {
    patch.hasReferenceImage = true;
  }

  const sourceSelectedStyles = normalizeStringArray(sourceItem.selectedStyles);
  const recoveredSelectedStyles = normalizeStringArray(recoveredItem.selectedStyles);
  if (sourceSelectedStyles.length === 0 && recoveredSelectedStyles.length > 0) {
    patch.selectedStyles = recoveredSelectedStyles;
  }

  const sourceSelectedActions = normalizeStringArray(sourceItem.selectedActions);
  const recoveredSelectedActions = normalizeStringArray(recoveredItem.selectedActions);
  if (sourceSelectedActions.length === 0 && recoveredSelectedActions.length > 0) {
    patch.selectedActions = recoveredSelectedActions;
  }

  return patch;
}

export function pruneGalleryMetadataCache(cache = {}, galleryItems = []) {
  const allowedFilenames = new Set(
    galleryItems
      .map((item) => normalizeString(item?.filename))
      .filter(Boolean),
  );

  return Object.fromEntries(
    Object.entries(cache).filter(([filename]) => allowedFilenames.has(normalizeString(filename))),
  );
}
