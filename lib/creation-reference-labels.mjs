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

function getCoverageSourceReferenceNames(item = {}) {
  const sources = Array.isArray(item?.coverageSources)
    ? item.coverageSources
    : Array.isArray(item?.coverage_sources)
      ? item.coverage_sources
      : [];
  return sources.map((source) => normalizeReferenceName(source?.filename || source?.name)).filter(Boolean);
}

function getCoverageSourceReferenceIndexes(item = {}) {
  const sources = Array.isArray(item?.coverageSources)
    ? item.coverageSources
    : Array.isArray(item?.coverage_sources)
      ? item.coverage_sources
      : [];
  return sources
    .map((source) => Number.parseInt(cleanString(source?.index || source?.referenceIndex || source?.reference_index), 10))
    .filter((value) => Number.isFinite(value) && value > 0);
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

// Each item type declares its own reference budget instead of a flat allow list: the subject
// anchor, the supporting roles in relevance order, and how many supporting images that item
// can actually use. Selection walks the supporting order and stops at the cap, so uploading
// several images of one role no longer fans every one of them into every matching item.
const ITEM_REFERENCE_BUDGETS = {
  hero: { supporting: [], maxSupporting: 0 },
  benefit: { supporting: ["material"], maxSupporting: 1 },
  scene: { supporting: ["scene"], maxSupporting: 1 },
  "multi-angle": { supporting: ["material"], maxSupporting: 1 },
  atmosphere: { supporting: ["scene"], maxSupporting: 1 },
  "product-detail": { supporting: ["material"], maxSupporting: 1 },
  "brand-story": { supporting: ["scene", "material"], maxSupporting: 2 },
  "size-capacity-fit": { supporting: ["dimensions"], maxSupporting: 1 },
  "effect-comparison": { supporting: ["material", "dimensions"], maxSupporting: 1 },
  "spec-table": { supporting: ["dimensions"], maxSupporting: 1 },
  "craft-process": { supporting: ["material", "usage"], maxSupporting: 2 },
  "accessory-gift": { supporting: ["package"], maxSupporting: 1 },
  "series-showcase": { supporting: ["product"], maxSupporting: 2 },
  "ingredient-material": { supporting: ["material", "package"], maxSupporting: 2 },
  "after-sales": { supporting: ["usage", "material"], maxSupporting: 1 },
  "usage-suggestion": { supporting: ["usage", "scene"], maxSupporting: 2 },
  "human-handheld": { supporting: ["scene", "usage"], maxSupporting: 1 },
  "human-wearable": { supporting: ["scene", "dimensions"], maxSupporting: 1 },
};

function getItemReferenceBudget(role = "") {
  return ITEM_REFERENCE_BUDGETS[cleanString(role)] || null;
}

function getReferenceRoleForImage(referenceImageRoles = [], index = 0, filename = "") {
  const roles = Array.isArray(referenceImageRoles) ? referenceImageRoles : [];
  const normalizedFilename = cleanString(filename).toLowerCase();
  const matchedRole = roles.find(
    (entry) => cleanString(entry?.filename || entry?.name).toLowerCase() === normalizedFilename,
  );
  if (matchedRole) {
    return matchedRole;
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

function getReferenceRoleIdentityInstruction(role = null) {
  if (!role) {
    return "";
  }
  const roleValue = cleanString(role.role).toLowerCase();
  const roleLabel = cleanString(role.rolePromptLabel || role.promptLabel || role.roleLabel || role.role).toLowerCase();
  if (isCreationSubjectReferenceRole(roleValue) || roleLabel.includes("product subject") || roleLabel.includes("reference subject")) {
    return "Product identity authority: preserve this product's body shape, colorway, logo, hardware, and proportions as the subject anchor.";
  }
  return "Supporting-only reference: use this for its assigned constraint only; do not replace the primary product identity, colorway, logo, shape, or hardware.";
}

function getReferenceRoleValue(referenceImageRoles = [], image = {}, index = 0) {
  return cleanString(getReferenceRoleForImage(referenceImageRoles, index, getReferenceImageName(image, index))?.role);
}

function pushUniqueImage(target, seen, image) {
  const key = normalizeReferenceName(getReferenceImageName(image, target.length));
  if (!key || seen.has(key)) {
    return;
  }
  seen.add(key);
  target.push(image);
}

function getPrimaryProductReferenceImage(images = [], referenceImageRoles = []) {
  return (
    images.find((image, index) => getReferenceRoleValue(referenceImageRoles, image, index) === CREATION_REFERENCE_PRODUCT_ROLE) ||
    images.find((image, index) => isCreationSubjectReferenceRole(getReferenceRoleValue(referenceImageRoles, image, index))) ||
    images[0] ||
    null
  );
}

function filterImagesByReferenceRoles(images = [], referenceImageRoles = [], allowedRoles = []) {
  const allowed = new Set(allowedRoles.map(cleanString).filter(Boolean));
  if (allowed.size === 0) {
    return [];
  }
  return images.filter((image, index) => {
    const role = getReferenceRoleValue(referenceImageRoles, image, index);
    return allowed.has(role) || (allowed.has("product") && isCreationSubjectReferenceRole(role));
  });
}

// Priority decides which supporting images survive the cap; upload order decides how they are
// emitted, because the numbered reference labels tell the model to read them in that order.
function selectBudgetedSupportingImages(images = [], referenceImageRoles = [], budget = null, excludedImage = null) {
  if (!budget || budget.maxSupporting <= 0) {
    return [];
  }

  const excludedName = excludedImage ? normalizeReferenceName(getReferenceImageName(excludedImage, 0)) : "";
  const picked = new Set();
  for (const supportingRole of budget.supporting) {
    if (picked.size >= budget.maxSupporting) {
      break;
    }
    for (const image of filterImagesByReferenceRoles(images, referenceImageRoles, [supportingRole])) {
      if (picked.size >= budget.maxSupporting) {
        break;
      }
      const name = normalizeReferenceName(getReferenceImageName(image, images.indexOf(image)));
      if (name && name !== excludedName) {
        picked.add(name);
      }
    }
  }

  return images.filter((image, index) => picked.has(normalizeReferenceName(getReferenceImageName(image, index))));
}

export function buildCreationItemReferenceImages(item = {}, referenceImages = [], referenceImageRoles = []) {
  const images = normalizeImages(referenceImages);
  const itemRole = cleanString(item?.role || item?.itemKind);
  if (itemRole !== "sku") {
    const role = itemRole;
    if (role === "infographic-rebuild") {
      const sourceNames = new Set(getInfographicSourceReferenceNames(item));
      const namedSource = images.find((image, index) =>
        sourceNames.has(normalizeReferenceName(getReferenceImageName(image, index))),
      );
      if (namedSource) {
        return [namedSource];
      }
      const indexedSource = getInfographicSourceReferenceIndexes(item)
        .map((sourceIndex) => images[sourceIndex - 1])
        .find(Boolean);
      if (indexedSource) {
        return [indexedSource];
      }
      const source = getInfographicSource(item);
      const sourceLabel = cleanString(source.filename || source.name || source.index || "unknown");
      throw new Error(`信息图重构源图缺失：${sourceLabel}`);
    }

    const budget = getItemReferenceBudget(role);
    const primaryProductImage = getPrimaryProductReferenceImage(images, referenceImageRoles);
    const coverageNames = new Set(getCoverageSourceReferenceNames(item));
    const coverageIndexes = new Set(getCoverageSourceReferenceIndexes(item));
    if (coverageNames.size > 0 || coverageIndexes.size > 0) {
      const selected = [];
      const seen = new Set();
      if (primaryProductImage) {
        pushUniqueImage(selected, seen, primaryProductImage);
      }
      const maxSupporting = budget ? budget.maxSupporting : Number.POSITIVE_INFINITY;
      let supportingCount = 0;
      images.forEach((image, index) => {
        if (supportingCount >= maxSupporting) {
          return;
        }
        const name = normalizeReferenceName(getReferenceImageName(image, index));
        if (coverageNames.has(name) || coverageIndexes.has(index + 1)) {
          const before = selected.length;
          pushUniqueImage(selected, seen, image);
          if (selected.length > before) {
            supportingCount += 1;
          }
        }
      });
      return selected.length > 0 ? selected : images;
    }

    if (!Array.isArray(referenceImageRoles) || referenceImageRoles.length === 0 || !budget) {
      return primaryProductImage ? [primaryProductImage] : images;
    }

    const selected = [];
    const seen = new Set();
    if (primaryProductImage) {
      pushUniqueImage(selected, seen, primaryProductImage);
    }
    selectBudgetedSupportingImages(images, referenceImageRoles, budget, primaryProductImage).forEach((image) =>
      pushUniqueImage(selected, seen, image),
    );
    return selected.length > 0 ? selected : images;
  }

  const subjectNames = new Set(getSkuSubjectReferenceNames(item));
  const subjectIndexes = new Set(getSkuSubjectReferenceIndexes(item));
  if (subjectNames.size === 0 && subjectIndexes.size === 0) {
    return [];
  }

  const supportingRoles = new Set(getSkuSupportingReferenceRoles(item));
  return images.filter((image, index) => {
    const name = normalizeReferenceName(getReferenceImageName(image, index));
    return (
      subjectNames.has(name) ||
      subjectIndexes.has(index + 1) ||
      supportingRoles.has(getReferenceRoleValue(referenceImageRoles, image, index))
    );
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
    const role = getReferenceRoleForImage(referenceImageRoles, index, name);
    const roleText = buildRoleText(role);
    const identityInstruction = getReferenceRoleIdentityInstruction(role);
    return [
      `Creation reference image ${index + 1} of ${names.length}: ${name}.`,
      `Uploaded reference count: ${names.length}.`,
      `Uploaded reference files: ${uploadedFileList}.`,
      roleText,
      identityInstruction,
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
