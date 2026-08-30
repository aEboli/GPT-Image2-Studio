import { CREATION_REFERENCE_PRODUCT_ROLE, isCreationSubjectReferenceRole } from "./creation-reference-roles.mjs";

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeImages(referenceImages = []) {
  if (!Array.isArray(referenceImages)) {
    return referenceImages ? [referenceImages] : [];
  }
  return referenceImages.filter(Boolean);
}

function getReferenceImageName(image = {}, index = 0) {
  return cleanString(image.filename || image.name || `reference-image-${index + 1}`);
}

function getExplicitReferenceIndex(image = {}) {
  const parsed = Number.parseInt(
    cleanString(
      image?.referenceIndex ||
        image?.originalReferenceIndex ||
        image?.reference_index ||
        image?.original_reference_index,
    ),
    10,
  );
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
}

function getStableReferenceIndex(image = {}, index = 0) {
  return getExplicitReferenceIndex(image) || index + 1;
}

function normalizeReferenceName(value) {
  return cleanString(value).toLowerCase();
}

function getSkuSubjectReferenceNames(item = {}) {
  const subject = item?.skuSubject || item?.sku_subject || {};
  return [
    ...(Array.isArray(subject.filenames) ? subject.filenames : []),
    ...(Array.isArray(subject.referenceFilenames) ? subject.referenceFilenames : []),
    ...(Array.isArray(subject.reference_filenames) ? subject.reference_filenames : []),
    subject.filename,
    subject.name,
  ]
    .map(normalizeReferenceName)
    .filter(Boolean);
}

function getSkuSubjectReferenceIndexes(item = {}) {
  const subject = item?.skuSubject || item?.sku_subject || {};
  const values = [
    ...(Array.isArray(subject.referenceIndexes) ? subject.referenceIndexes : []),
    ...(Array.isArray(subject.reference_indexes) ? subject.reference_indexes : []),
    subject.referenceIndex,
    subject.reference_index,
    subject.index,
  ];
  return values
    .map((value) => Number.parseInt(cleanString(value), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

function getSkuSupportingReferenceRoles(item = {}) {
  const values = Array.isArray(item?.skuSupportingReferenceRoles)
    ? item.skuSupportingReferenceRoles
    : Array.isArray(item?.sku_supporting_reference_roles)
      ? item.sku_supporting_reference_roles
      : [];
  return values
    .map(cleanString)
    .filter((role) => role && role !== "package");
}

function getInfographicSource(item = {}) {
  const source = item?.sourceInfographic || item?.source_infographic || item?.infographicSource || item?.infographic_source || {};
  return source && typeof source === "object" ? source : {};
}

function getInfographicSourceReferenceNames(item = {}) {
  const source = getInfographicSource(item);
  return [
    source.filename,
    source.name,
    source.referenceFilename,
    source.reference_filename,
  ]
    .map(normalizeReferenceName)
    .filter(Boolean);
}

function getInfographicSourceReferenceIndexes(item = {}) {
  const source = getInfographicSource(item);
  const values = [source.index, source.referenceIndex, source.reference_index];
  return values
    .map((value) => Number.parseInt(cleanString(value), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
}

// Reference selection is deliberately bounded globally rather than by a fixed number per
// image type. A small, information-rich set can therefore use more than three images while
// a set of large uploads stops as soon as its request budget is exhausted.
export const MAX_CREATION_ITEM_REFERENCE_IMAGES = 8;
export const MAX_CREATION_ITEM_REFERENCE_BYTES = 6 * 1024 * 1024;
export const CREATION_REFERENCE_SELECTION_MAX_IMAGES = MAX_CREATION_ITEM_REFERENCE_IMAGES;
export const CREATION_REFERENCE_SELECTION_MAX_BYTES = MAX_CREATION_ITEM_REFERENCE_BYTES;

const DEFAULT_REFERENCE_IMAGE_BYTES = 512 * 1024;
const MIN_REFERENCE_CANDIDATE_SCORE = 0.22;

// These are relevance hints, not quotas. The scheduler may take several images from one
// role when they are useful and fit the shared count/byte budget, and may skip a role when a
// stronger item-specific coverage source is available.
const ITEM_REFERENCE_ROLE_PRIORITIES = {
  hero: [],
  benefit: ["material"],
  scene: ["scene"],
  "multi-angle": ["material"],
  atmosphere: ["scene"],
  "product-detail": ["material"],
  "brand-story": ["scene", "material"],
  "size-capacity-fit": ["dimensions"],
  "effect-comparison": ["material", "dimensions"],
  "spec-table": ["dimensions"],
  "craft-process": ["material", "usage"],
  "accessory-gift": ["package"],
  "series-showcase": ["product"],
  "ingredient-material": ["material", "package"],
  "after-sales": ["usage", "material"],
  "usage-suggestion": ["usage", "scene"],
  "human-handheld": ["scene", "usage"],
  "human-wearable": ["scene", "dimensions"],
  sku: ["dimensions", "material", "usage", "scene"],
};

function getItemReferenceRolePriorities(role = "") {
  return ITEM_REFERENCE_ROLE_PRIORITIES[cleanString(role)] || [];
}

function normalizeSelectionLimit(value, fallback, maximum) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }
  return Math.min(maximum, Math.max(1, Math.floor(parsed)));
}

function getReferenceSelectionLimits(item = {}, options = {}) {
  const itemOptions = item?.referenceSelection || item?.reference_selection || item?.referenceImageSelection || {};
  return {
    maxImages: normalizeSelectionLimit(
      options.maxImages ?? itemOptions.maxImages ?? itemOptions.max_images,
      MAX_CREATION_ITEM_REFERENCE_IMAGES,
      MAX_CREATION_ITEM_REFERENCE_IMAGES,
    ),
    maxBytes: normalizeSelectionLimit(
      options.maxBytes ?? itemOptions.maxBytes ?? itemOptions.max_bytes,
      MAX_CREATION_ITEM_REFERENCE_BYTES,
      MAX_CREATION_ITEM_REFERENCE_BYTES,
    ),
  };
}

function getReferenceRoleForImage(
  referenceImageRoles = [],
  index = 0,
  filename = "",
  { preferIndex = false, referenceIndex = 0 } = {},
) {
  const roles = Array.isArray(referenceImageRoles) ? referenceImageRoles : [];
  const normalizedFilename = cleanString(filename).toLowerCase();
  const stableIndex = Number.parseInt(cleanString(referenceIndex), 10);
  const indexedRole = roles.find((entry) => {
    const entryIndex = Number.parseInt(
      cleanString(entry?.index || entry?.referenceIndex || entry?.reference_index),
      10,
    );
    return Number.isFinite(entryIndex) && entryIndex === (Number.isFinite(stableIndex) && stableIndex > 0 ? stableIndex : index + 1);
  });
  const matchedRole = roles.find(
    (entry) => cleanString(entry?.filename || entry?.name).toLowerCase() === normalizedFilename,
  );
  // Selection operates on the original upload array, where an explicit stable index
  // disambiguates two different uploads with the same filename. Labels operate on a trimmed
  // output list, so their position is no longer the original input index and filename wins.
  if ((preferIndex || (Number.isFinite(stableIndex) && stableIndex > 0)) && indexedRole) {
    return indexedRole;
  }
  if (matchedRole) {
    return matchedRole;
  }
  if (indexedRole) {
    return indexedRole;
  }
  const hasNamedRoles = roles.some((entry) => cleanString(entry?.filename || entry?.name));
  return hasNamedRoles ? null : roles[index] || null;
}

function buildRoleText(role = null) {
  if (!role) {
    return "";
  }

  const label = cleanString(role.rolePromptLabel || role.promptLabel || role.roleLabel || role.role);
  const instruction = cleanString(role.promptInstruction || role.instruction);
  const note = cleanString(role.note || role.analysisNote || role.description);
  const parts = [];

  if (label || instruction) {
    parts.push(`Role: ${label || "supporting reference"}.${instruction ? ` ${instruction}` : ""}`);
  }
  if (note) {
    parts.push(`Note: ${note}.`);
  }

  return parts.join(" ");
}

function getReferenceRoleIdentityInstruction(role = null, { primaryAnchor = false } = {}) {
  if (!role) {
    return "";
  }
  const roleValue = cleanString(role.role).toLowerCase();
  const roleLabel = cleanString(role.rolePromptLabel || role.promptLabel || role.roleLabel || role.role).toLowerCase();
  if (isCreationSubjectReferenceRole(roleValue) || roleLabel.includes("product subject") || roleLabel.includes("reference subject")) {
    return primaryAnchor
      ? "Product identity authority: preserve this product's body shape, colorway, logo, hardware, and proportions as the subject anchor."
      : "Supporting product reference: the primary Product identity authority remains the first attached image; use this only for its assigned comparison, view, or variant evidence and do not redefine the primary product identity, colorway, logo, shape, or hardware.";
  }
  return "Supporting-only reference: use this for its assigned constraint only; do not replace the primary product identity, colorway, logo, shape, or hardware.";
}

function getReferenceRoleValue(referenceImageRoles = [], image = {}, index = 0) {
  return cleanString(
    getReferenceRoleForImage(referenceImageRoles, index, getReferenceImageName(image, index), {
      preferIndex: true,
      referenceIndex: getStableReferenceIndex(image, index),
    })?.role,
  );
}

function getPrimaryProductReferenceImage(images = [], referenceImageRoles = []) {
  return (
    images.find((image, index) => getReferenceRoleValue(referenceImageRoles, image, index) === CREATION_REFERENCE_PRODUCT_ROLE) ||
    images.find((image, index) => isCreationSubjectReferenceRole(getReferenceRoleValue(referenceImageRoles, image, index))) ||
    images[0] ||
    null
  );
}

function getReferenceImageByteLength(image = {}) {
  const directValues = [image?.byteLength, image?.size, image?.bytes?.byteLength, image?.buffer?.byteLength];
  for (const value of directValues) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) {
      return Math.max(1, Math.floor(parsed));
    }
  }

  if (typeof image?.base64 === "string" && image.base64.trim()) {
    const normalized = image.base64.replace(/^data:[^;]+;base64,/i, "").replace(/\s+/g, "");
    if (normalized) {
      const padding = normalized.endsWith("==") ? 2 : normalized.endsWith("=") ? 1 : 0;
      const estimated = Math.floor((normalized.length * 3) / 4) - padding;
      if (Number.isFinite(estimated) && estimated > 0) {
        return estimated;
      }
    }
  }

  return DEFAULT_REFERENCE_IMAGE_BYTES;
}

function getCoverageSources(item = {}) {
  const sources = Array.isArray(item?.coverageSources)
    ? item.coverageSources
    : Array.isArray(item?.coverage_sources)
      ? item.coverage_sources
      : [];
  return sources.filter((source) => source && typeof source === "object");
}

function getCoverageMatch(source, image, index) {
  const sourceName = normalizeReferenceName(source?.filename || source?.name);
  const imageName = normalizeReferenceName(getReferenceImageName(image, index));
  if (sourceName && sourceName === imageName) {
    return true;
  }
  const sourceIndex = Number.parseInt(
    cleanString(source?.index || source?.referenceIndex || source?.reference_index),
    10,
  );
  return Number.isFinite(sourceIndex) && sourceIndex > 0 && sourceIndex === getStableReferenceIndex(image, index);
}

function getReferenceRolePriority(role, priorities = []) {
  const normalizedRole = cleanString(role);
  const index = priorities.indexOf(normalizedRole);
  if (index < 0) {
    return 0;
  }
  // The values are relevance scores, not quotas. Keeping a non-zero floor allows a useful
  // lower-priority role to be selected when the high-priority role has no remaining evidence.
  return Math.max(0.35, 1.7 - index * 0.22);
}

function getReferenceCandidateScore(candidate, selectedRoleCounts, priorities) {
  const roleCount = selectedRoleCounts.get(candidate.role) || 0;
  const roleScore = getReferenceRolePriority(candidate.role, priorities);
  const coverageScore = candidate.coverageMatch ? 3.4 : 0;
  const noteScore = Math.min(0.35, cleanString(candidate.roleEntry?.note || candidate.coverageSource?.note).length / 180);
  const diversityBonus = roleCount === 0 ? 0.42 : -Math.min(0.42, roleCount * 0.12);
  const sizePenalty = Math.min(0.55, Math.log2(Math.max(1, candidate.byteLength) / DEFAULT_REFERENCE_IMAGE_BYTES) * 0.08);
  const sizeBonus = Number.isFinite(sizePenalty) ? -sizePenalty : 0;
  return coverageScore + roleScore + noteScore + diversityBonus + sizeBonus;
}

function buildReferenceCandidates({ images, referenceImageRoles, item, anchorIndex, explicitSubjectNames = new Set(), explicitSubjectIndexes = new Set() }) {
  const role = cleanString(item?.role || item?.itemKind);
  const priorities = getItemReferenceRolePriorities(role);
  const skuSupportingRoles = new Set(getSkuSupportingReferenceRoles(item));
  const coverageSources = getCoverageSources(item);
  const hasAfterSalesUsageEvidence =
    role === "after-sales" &&
    images.some((image, index) => getReferenceRoleValue(referenceImageRoles, image, index) === "usage");
  const candidates = [];

  images.forEach((image, index) => {
    const name = normalizeReferenceName(getReferenceImageName(image, index));
    const roleEntry = getReferenceRoleForImage(
      referenceImageRoles,
      index,
      getReferenceImageName(image, index),
      { preferIndex: true, referenceIndex: getStableReferenceIndex(image, index) },
    );
    const referenceRole = getReferenceRoleValue(referenceImageRoles, image, index);
    const subjectMatch = explicitSubjectNames.has(name) || explicitSubjectIndexes.has(getStableReferenceIndex(image, index));
    const coverageSource = coverageSources.find((source) => getCoverageMatch(source, image, index)) || null;
    const coverageMatch = Boolean(coverageSource);
    // A filename is display metadata, not a unique image identity. Different uploads can
    // legitimately share a name, so keep the chosen anchor scoped to its source position.
    const isAnchor = index === anchorIndex;
    if (!name || isAnchor) {
      return;
    }

    const isSubjectRole = isCreationSubjectReferenceRole(referenceRole);
    // Material is a useful after-sales fallback when no usage guide exists, but when a usage
    // source is present it would duplicate the same proof and make the item noisy.
    if (role === "after-sales" && referenceRole === "material" && hasAfterSalesUsageEvidence && !coverageMatch) {
      return;
    }
    // Product variants are supporting evidence only for roles that explicitly rank product;
    // the selected primary subject remains the sole anchor for all other roles.
    if (
      !coverageMatch &&
      !subjectMatch &&
      (role === "sku"
        ? !skuSupportingRoles.has(referenceRole)
        : !priorities.includes(referenceRole) && !(priorities.includes("product") && isSubjectRole))
    ) {
      return;
    }
    if (!coverageMatch && !subjectMatch && isSubjectRole && !priorities.includes("product")) {
      return;
    }

    candidates.push({
      image,
      index,
      name,
      role: referenceRole || (subjectMatch ? "product" : "other"),
      roleEntry,
      coverageSource,
      coverageMatch,
      subjectMatch,
      byteLength: getReferenceImageByteLength(image),
    });
  });

  return { candidates, priorities };
}

function selectSmartReferenceImages({
  images = [],
  referenceImageRoles = [],
  item = {},
  anchor = null,
  explicitSubjectNames = new Set(),
  explicitSubjectIndexes = new Set(),
  options = {},
} = {}) {
  const normalizedImages = normalizeImages(images);
  if (normalizedImages.length === 0) {
    return [];
  }
  const requestedAnchorIndex = anchor ? normalizedImages.indexOf(anchor) : -1;
  const anchorIndex = requestedAnchorIndex >= 0 ? requestedAnchorIndex : 0;
  const selectedAnchor = normalizedImages[anchorIndex];
  const limits = getReferenceSelectionLimits(item, options);
  const { candidates, priorities } = buildReferenceCandidates({
    images: normalizedImages,
    referenceImageRoles,
    item,
    anchorIndex,
    explicitSubjectNames,
    explicitSubjectIndexes,
  });
  const selectedIndexes = new Set();
  const selectedRoleCounts = new Map();
  let usedBytes = 0;

  const add = (image, index) => {
    if (!Number.isInteger(index) || index < 0 || selectedIndexes.has(index)) {
      return false;
    }
    selectedIndexes.add(index);
    usedBytes += getReferenceImageByteLength(image);
    return true;
  };

  add(selectedAnchor, anchorIndex);
  const remaining = [...candidates];
  while (remaining.length > 0 && selectedIndexes.size < limits.maxImages) {
    let bestIndex = -1;
    let bestScore = -Infinity;
    remaining.forEach((candidate, index) => {
      if (usedBytes + candidate.byteLength > limits.maxBytes) {
        return;
      }
      const score = getReferenceCandidateScore(candidate, selectedRoleCounts, priorities) + (candidate.subjectMatch ? 2.2 : 0);
      if (
        score > bestScore + 1e-9 ||
        (Math.abs(score - bestScore) <= 1e-9 && candidate.index < (remaining[bestIndex]?.index ?? Number.POSITIVE_INFINITY))
      ) {
        bestIndex = index;
        bestScore = score;
      }
    });

    if (bestIndex < 0) {
      break;
    }
    const [candidate] = remaining.splice(bestIndex, 1);
    const isExplicit = candidate.coverageMatch || candidate.subjectMatch;
    if (!isExplicit && bestScore < MIN_REFERENCE_CANDIDATE_SCORE) {
      break;
    }
    if (add(candidate.image, candidate.index)) {
      selectedRoleCounts.set(candidate.role, (selectedRoleCounts.get(candidate.role) || 0) + 1);
    }
  }

  // Keep the anchor first so the model establishes product identity before reading supporting
  // evidence. The remaining references retain their original upload order, which keeps the
  // numbered labels stable across generation and repair.
  const supporting = normalizedImages.filter((image, index) => {
    return index !== anchorIndex && selectedIndexes.has(index);
  });
  return [selectedAnchor, ...supporting];
}

export function selectCreationReferenceImages(item = {}, referenceImages = [], referenceImageRoles = [], options = {}) {
  const images = normalizeImages(referenceImages);
  if (images.length === 0) {
    return [];
  }
  const anchor = getPrimaryProductReferenceImage(images, referenceImageRoles);
  const hasRoleMetadata = Array.isArray(referenceImageRoles) && referenceImageRoles.some((entry) => cleanString(entry?.role));
  const hasExplicitCoverage = getCoverageSources(item).some(
    (source) => normalizeReferenceName(source?.filename || source?.name) || Number(source?.index || source?.referenceIndex || source?.reference_index) > 0,
  );
  if (!hasRoleMetadata && !hasExplicitCoverage) {
    return anchor ? [anchor] : [];
  }
  return selectSmartReferenceImages({ images, referenceImageRoles, item, anchor, options });
}

export function buildCreationItemReferenceImages(item = {}, referenceImages = [], referenceImageRoles = [], options = {}) {
  const images = normalizeImages(referenceImages);
  const itemRole = cleanString(item?.role || item?.itemKind);
  if (itemRole !== "sku") {
    const role = itemRole;
    if (role === "infographic-rebuild") {
      const sourceNames = new Set(getInfographicSourceReferenceNames(item));
      const indexedSource = getInfographicSourceReferenceIndexes(item)
        .map((sourceIndex) => images.find((image, index) => getStableReferenceIndex(image, index) === sourceIndex))
        .find(Boolean);
      if (indexedSource) {
        return [indexedSource];
      }
      const namedSource = images.find((image, index) =>
        sourceNames.has(normalizeReferenceName(getReferenceImageName(image, index))),
      );
      if (namedSource) {
        return [namedSource];
      }
      const source = getInfographicSource(item);
      const sourceLabel = cleanString(source.filename || source.name || source.index || "unknown");
      throw new Error(`信息图重构源图缺失：${sourceLabel}`);
    }

    return selectCreationReferenceImages(item, images, referenceImageRoles, options);
  }

  const subjectNames = new Set(getSkuSubjectReferenceNames(item));
  const subjectIndexes = new Set(getSkuSubjectReferenceIndexes(item));
  if (subjectNames.size === 0 && subjectIndexes.size === 0) {
    return [];
  }

  const subjectMatches = images.filter((image, index) => {
    const name = normalizeReferenceName(getReferenceImageName(image, index));
    return subjectNames.has(name) || subjectIndexes.has(getStableReferenceIndex(image, index));
  });
  if (subjectMatches.length === 0) {
    return [];
  }

  // SKU subject files are explicit identity evidence. Keep the first matching subject as the
  // anchor and let the same scheduler decide whether additional views and factual support fit.
  return selectSmartReferenceImages({
    images,
    referenceImageRoles,
    item,
    anchor: subjectMatches[0],
    explicitSubjectNames: subjectNames,
    explicitSubjectIndexes: subjectIndexes,
    options,
  });
}

export function buildCreationReferenceImageLabels(referenceImages = [], referenceImageRoles = []) {
  const images = normalizeImages(referenceImages);
  if (images.length === 0) {
    return [];
  }

  const names = images.map((image, index) => getReferenceImageName(image, index));
  const uploadedFileList = names.map((name, index) => `${index + 1}. ${name}`).join("; ");

  return names.map((name, index) => {
    const image = images[index];
    const role = getReferenceRoleForImage(referenceImageRoles, index, name, {
      referenceIndex: getExplicitReferenceIndex(image),
    });
    const roleText = buildRoleText(role);
    const identityInstruction = getReferenceRoleIdentityInstruction(role, { primaryAnchor: index === 0 });
    const primaryAnchorInstruction = index === 0
      ? "Primary subject anchor: this first attached image is the identity authority for the generated item. Keep the same physical product and variant; scene, camera, layout, and background changes never replace the subject."
      : "This is a supporting reference after the primary subject anchor; it contributes only its assigned role content while the primary product identity remains unchanged.";
    return [
      `Creation reference image ${index + 1} of ${names.length}: ${name}.`,
      `Uploaded reference count: ${names.length}.`,
      `Uploaded reference files: ${uploadedFileList}.`,
      roleText,
      identityInstruction,
      primaryAnchorInstruction,
      "Use the attached references by this numbered order; do not assume missing reference images.",
    ]
      .filter(Boolean)
      .join(" ");
  });
}

export function buildCreationGenerationReferenceImageLabels(
  referenceImages = [],
  referenceImageRoles = [],
  item = {},
) {
  if (cleanString(item?.role || item?.itemKind) === "infographic-rebuild") {
    return [];
  }
  return buildCreationReferenceImageLabels(referenceImages, referenceImageRoles);
}
