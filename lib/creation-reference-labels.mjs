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

const SINGLE_PRODUCT_REFERENCE_ITEM_ROLES = new Set([
  "hero",
  "benefit",
  "scene",
  "multi-angle",
  "atmosphere",
  "product-detail",
  "brand-story",
  "size-capacity-fit",
  "effect-comparison",
  "spec-table",
  "craft-process",
  "accessory-gift",
  "series-showcase",
  "ingredient-material",
  "after-sales",
  "usage-suggestion",
]);

const ITEM_SUPPORTING_REFERENCE_ROLES = {
  hero: ["style"],
  benefit: ["material", "style"],
  scene: ["scene", "style"],
  "multi-angle": ["product", "material", "style"],
  atmosphere: ["scene", "style"],
  "product-detail": ["material"],
  "brand-story": ["material", "scene", "style"],
  "size-capacity-fit": ["dimensions", "material"],
  "effect-comparison": ["product", "material", "dimensions"],
  "spec-table": ["dimensions", "material"],
  "craft-process": ["material", "usage", "style"],
  "accessory-gift": ["package"],
  "series-showcase": ["product", "style"],
  "ingredient-material": ["material", "package"],
  "after-sales": ["material", "usage", "style"],
  "usage-suggestion": ["usage", "scene", "material"],
};

function getReferenceRoleForImage(referenceImageRoles = [], index = 0, filename = "") {
  const roles = Array.isArray(referenceImageRoles) ? referenceImageRoles : [];
  const normalizedFilename = cleanString(filename).toLowerCase();
  return (
    roles.find((entry) => cleanString(entry?.filename || entry?.name).toLowerCase() === normalizedFilename) ||
    roles[index] ||
    null
  );
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

export function buildCreationItemReferenceImages(item = {}, referenceImages = [], referenceImageRoles = []) {
  const images = normalizeImages(referenceImages);
  if (cleanString(item?.role) !== "sku") {
    const role = cleanString(item?.role);
    if (role === "infographic-rebuild") {
      const selected = [];
      const seen = new Set();
      const sourceNames = new Set(getInfographicSourceReferenceNames(item));
      const sourceIndexes = new Set(getInfographicSourceReferenceIndexes(item));
      filterImagesByReferenceRoles(images, referenceImageRoles, ["product"]).forEach((image) =>
        pushUniqueImage(selected, seen, image),
      );
      if (selected.length === 0) {
        const primaryProductImage = getPrimaryProductReferenceImage(images, referenceImageRoles);
        if (primaryProductImage) {
          pushUniqueImage(selected, seen, primaryProductImage);
        }
      }
      images.forEach((image, index) => {
        const name = normalizeReferenceName(getReferenceImageName(image, index));
        if (sourceNames.has(name) || sourceIndexes.has(index + 1)) {
          pushUniqueImage(selected, seen, image);
        }
      });
      return selected.length > 0 ? selected : images;
    }

    const coverageNames = new Set(getCoverageSourceReferenceNames(item));
    const coverageIndexes = new Set(getCoverageSourceReferenceIndexes(item));
    if (coverageNames.size > 0 || coverageIndexes.size > 0) {
      const selected = [];
      const seen = new Set();
      const primaryProductImage = getPrimaryProductReferenceImage(images, referenceImageRoles);
      if (primaryProductImage) {
        pushUniqueImage(selected, seen, primaryProductImage);
      }
      images.forEach((image, index) => {
        const name = normalizeReferenceName(getReferenceImageName(image, index));
        if (coverageNames.has(name) || coverageIndexes.has(index + 1)) {
          pushUniqueImage(selected, seen, image);
        }
      });
      return selected.length > 0 ? selected : images;
    }

    const roleFilters = ITEM_SUPPORTING_REFERENCE_ROLES[role];
    if (!Array.isArray(referenceImageRoles) || referenceImageRoles.length === 0 || !roleFilters) {
      return images;
    }
    if (SINGLE_PRODUCT_REFERENCE_ITEM_ROLES.has(role)) {
      const selected = [];
      const seen = new Set();
      const primaryProductImage = getPrimaryProductReferenceImage(images, referenceImageRoles);
      if (primaryProductImage) {
        pushUniqueImage(selected, seen, primaryProductImage);
      }
      filterImagesByReferenceRoles(images, referenceImageRoles, roleFilters).forEach((image) =>
        pushUniqueImage(selected, seen, image),
      );
      return selected.length > 0 ? selected : images;
    }

    const selected = filterImagesByReferenceRoles(images, referenceImageRoles, roleFilters);
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

export function appendCreationStyleReferences(referenceImages = [], styleReferenceImages = []) {
  return [...normalizeImages(referenceImages), ...normalizeImages(styleReferenceImages)];
}

export function buildCreationStyleReferenceImageLabels(styleReferenceImages = []) {
  const images = normalizeImages(styleReferenceImages);
  if (images.length === 0) {
    return [];
  }

  const names = images.map((image, index) => getReferenceImageName(image, index));
  const uploadedFileList = names.map((name, index) => `${index + 1}. ${name}`).join("; ");

  return names.map((name, index) =>
    [
      `Creation style reference image ${index + 1} of ${names.length}: ${name}.`,
      `Style reference files: ${uploadedFileList}.`,
      "Use this image only for style, lighting, color grading, background mood, material treatment, composition language, and overall atmosphere.",
      "Do not copy the style reference subject, product identity, logo, text, packaging, or exact layout.",
    ].join(" "),
  );
}

export function buildCreationGenerationReferenceImageLabels(
  referenceImages = [],
  referenceImageRoles = [],
  styleReferenceImages = [],
) {
  return [
    ...buildCreationReferenceImageLabels(referenceImages, referenceImageRoles),
    ...buildCreationStyleReferenceImageLabels(styleReferenceImages),
  ];
}
