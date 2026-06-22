import { buildCreationPlan } from "./creation-planner.mjs";

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeName(value) {
  return cleanString(value).toLowerCase();
}

function isIncompleteCreationItem(item = {}) {
  return item.missingAsset || item.missing_asset || cleanString(item.status) !== "completed" || !cleanString(item.filename) || !hasCompletedCreationAsset(item);
}

function isFailedCreationItem(item = {}) {
  return cleanString(item.status) === "failed";
}

function hasCompletedCreationAsset(item = {}) {
  return Boolean(
    cleanString(item.relativePath) ||
      cleanString(item.imageUrl) ||
      cleanString(item.thumbnailUrl) ||
      cleanString(item.storageKey),
  );
}

const SKU_SERIES_CONSISTENCY_LOCK_MARKER = "SKU SERIES CONSISTENCY LOCK";

export function needsCreationRepairPlanRefresh(items = []) {
  const skuItems = (Array.isArray(items) ? items : []).filter((item) => cleanString(item.role) === "sku");
  return skuItems.length > 1 && skuItems.some((item) => !cleanString(item.prompt).includes(SKU_SERIES_CONSISTENCY_LOCK_MARKER));
}

function getCreationRepairSelectedRoles(creationSet = {}) {
  if (Array.isArray(creationSet.selectedRoles) && creationSet.selectedRoles.length > 0) {
    return creationSet.selectedRoles.map(cleanString).filter(Boolean);
  }

  return (Array.isArray(creationSet.items) ? creationSet.items : [])
    .map((item) => cleanString(item.role))
    .filter((role) => role && role !== "sku" && role !== "infographic-rebuild");
}

function getOverrideValue(overrides = {}, key, fallback = "") {
  const value = cleanString(overrides[key]);
  return value || fallback;
}

function getOverridePayload(overrides = {}, key, fallback) {
  return overrides[key] === undefined || overrides[key] === null ? fallback : overrides[key];
}

function parseArrayPayload(value) {
  if (Array.isArray(value)) {
    return value;
  }
  if (typeof value !== "string") {
    return null;
  }
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : null;
  } catch (_error) {
    return null;
  }
}

function getRepairSkuSubjectsPayload(overrides = {}, fallback) {
  const override = getOverridePayload(overrides, "skuSubjects", fallback);
  const fallbackItems = Array.isArray(fallback) ? fallback : [];
  if (fallbackItems.length > 0 && typeof override === "string" && !cleanString(override)) {
    return fallbackItems;
  }
  const overrideItems = parseArrayPayload(override);
  if (fallbackItems.length > 0 && overrideItems && overrideItems.length === 0) {
    return fallbackItems;
  }
  return override;
}

export function hasCreationRepairPlanningOverride(creationSet = {}, overrides = {}) {
  return [
    "productName",
    "productDescription",
    "sellingPoints",
    "dimensionSpecs",
    "dimensionUnitMode",
    "targetLanguage",
    "scenario",
    "visualLanguage",
    "industryTemplate",
    "infographicRebuildEnabled",
    "skuBundleCount",
    "skuGenerationRule",
  ].some((key) => {
    const value = cleanString(overrides[key]);
    return Boolean(value) && value !== cleanString(creationSet[key]);
  });
}

export function buildCreationRepairPlan(creationSet = {}, overrides = {}) {
  const selectedRoles = getCreationRepairSelectedRoles(creationSet);

  return buildCreationPlan({
    productName: getOverrideValue(overrides, "productName", creationSet.productName),
    productDescription: getOverrideValue(overrides, "productDescription", creationSet.productDescription),
    sellingPoints: getOverridePayload(overrides, "sellingPoints", creationSet.sellingPoints),
    dimensionSpecs: getOverrideValue(overrides, "dimensionSpecs", creationSet.dimensionSpecs),
    dimensionUnitMode: getOverrideValue(overrides, "dimensionUnitMode", creationSet.dimensionUnitMode),
    targetLanguage: getOverrideValue(overrides, "targetLanguage", creationSet.targetLanguage),
    imageCount: creationSet.imageCount || selectedRoles.length,
    scenario: getOverrideValue(overrides, "scenario", creationSet.scenario),
    visualLanguage: getOverrideValue(overrides, "visualLanguage", creationSet.visualLanguage),
    industryTemplate: getOverrideValue(overrides, "industryTemplate", creationSet.industryTemplate),
    selectedRoles,
    referenceImageRoles: getOverridePayload(overrides, "referenceImageRoles", creationSet.referenceImageRoles),
    infographicRebuildEnabled: getOverridePayload(overrides, "infographicRebuildEnabled", creationSet.infographicRebuildEnabled),
    skuSubjects: getRepairSkuSubjectsPayload(overrides, creationSet.skuSubjects),
    skuBundleCount: getOverrideValue(overrides, "skuBundleCount", creationSet.skuBundleCount),
    skuGenerationRule: getOverrideValue(overrides, "skuGenerationRule", creationSet.skuGenerationRule),
    logoOptions: getOverridePayload(overrides, "logoOptions", creationSet.logo),
  });
}

function findPlannedRepairItem(item = {}, planItems = []) {
  const itemId = cleanString(item.itemId);
  const role = cleanString(item.role);
  const slotIndex = Number(item.slotIndex) || 0;

  return (
    planItems.find((entry) => cleanString(entry.itemId) === itemId) ||
    planItems.find((entry) => Number(entry.slotIndex) === slotIndex && cleanString(entry.role) === role) ||
    planItems.find((entry) => cleanString(entry.role) === role)
  );
}

export function refreshCreationRepairItemsFromPlan(items = [], plan = {}) {
  const planItems = Array.isArray(plan.items) ? plan.items : [];
  return (Array.isArray(items) ? items : []).map((item) => {
    const planned = findPlannedRepairItem(item, planItems);
    if (!planned) {
      return item;
    }

    return {
      ...item,
      title: planned.title || item.title,
      filenameToken: planned.filenameToken || item.filenameToken,
      prompt: planned.prompt || item.prompt,
      marketingCopy: planned.marketingCopy || item.marketingCopy,
      sourceFocus: planned.sourceFocus || item.sourceFocus,
      ...(planned.skuSubject ? { skuSubject: planned.skuSubject } : {}),
      ...(planned.sourceInfographic ? { sourceInfographic: planned.sourceInfographic } : {}),
    };
  });
}

export function applyCreationRepairOverrides(
  item = {},
  { promptOverride = "", marketingCopyOverride = "" } = {},
) {
  const prompt = cleanString(promptOverride);
  const marketingCopy = cleanString(marketingCopyOverride);

  return {
    ...item,
    ...(prompt ? { prompt } : {}),
    ...(marketingCopy ? { marketingCopy } : {}),
  };
}

export function selectCreationRepairItems(creationSet = {}, { itemId = "", scope = "" } = {}) {
  const items = Array.isArray(creationSet.items) ? creationSet.items : [];
  const requestedItemId = cleanString(itemId);

  if (requestedItemId) {
    return items.filter((item) => cleanString(item.itemId) === requestedItemId);
  }

  if (cleanString(scope).toLowerCase() === "incomplete") {
    return items.filter(isIncompleteCreationItem);
  }

  return items.filter(isFailedCreationItem);
}

function normalizeRepairSkuSubject(entry = {}) {
  const filenames = Array.isArray(entry.filenames) ? entry.filenames.map(cleanString).filter(Boolean) : [];
  const referenceIndexes = Array.isArray(entry.referenceIndexes)
    ? entry.referenceIndexes.map((item) => Number.parseInt(cleanString(item), 10)).filter((item) => Number.isFinite(item) && item > 0)
    : Array.isArray(entry.reference_indexes)
      ? entry.reference_indexes.map((item) => Number.parseInt(cleanString(item), 10)).filter((item) => Number.isFinite(item) && item > 0)
      : [];
  const id = cleanString(entry.id || entry.subjectId || entry.subject_id || filenames[0]);

  return {
    id,
    title: cleanString(entry.title || entry.name || id),
    referenceIndexes,
    filenames,
    note: cleanString(entry.note || entry.description || entry.summary),
    bundleCount: Number.parseInt(cleanString(entry.bundleCount || entry.bundle_count || entry.quantity || entry.count), 10) || 1,
  };
}

function getSkuSubjectIndexFromTitle(item = {}) {
  const match = cleanString(item.title).match(/\bSKU\s+image\s+(\d+)\b/i);
  if (!match) {
    return -1;
  }
  const index = Number.parseInt(match[1], 10) - 1;
  return Number.isFinite(index) ? index : -1;
}

function findRepairSkuSubject(item = {}, creationSet = {}) {
  const subjects = Array.isArray(creationSet.skuSubjects)
    ? creationSet.skuSubjects.map(normalizeRepairSkuSubject).filter((subject) => subject.id || subject.filenames.length)
    : [];
  if (subjects.length === 0) {
    return null;
  }

  const itemId = normalizeName(item.itemId);
  const matchByItemId = subjects.find((subject) => {
    const subjectId = normalizeName(subject.id);
    return subjectId && (itemId.endsWith(`-sku-${subjectId}`) || itemId.includes(`sku-${subjectId}`));
  });
  if (matchByItemId) {
    return matchByItemId;
  }

  const titleIndex = getSkuSubjectIndexFromTitle(item);
  if (titleIndex >= 0 && subjects[titleIndex]) {
    return subjects[titleIndex];
  }

  const slotIndex = Number.parseInt(cleanString(item.slotIndex), 10);
  const carouselCount = Number.parseInt(cleanString(creationSet.imageCount), 10);
  const slotSubjectIndex = slotIndex - carouselCount - 1;
  if (Number.isFinite(slotSubjectIndex) && slotSubjectIndex >= 0 && subjects[slotSubjectIndex]) {
    return subjects[slotSubjectIndex];
  }

  return subjects.length === 1 ? subjects[0] : null;
}

export function hydrateCreationRepairSkuSubject(item = {}, creationSet = {}) {
  const existingSubject = normalizeRepairSkuSubject(item.skuSubject || item.sku_subject || {});
  if (existingSubject.id || existingSubject.filenames.length || cleanString(item.role) !== "sku") {
    return existingSubject.id || existingSubject.filenames.length ? { ...item, skuSubject: existingSubject } : item;
  }

  const matchedSubject = findRepairSkuSubject(item, creationSet);
  return matchedSubject ? { ...item, skuSubject: matchedSubject } : item;
}

export function hydrateCreationRepairSkuSubjects(items = [], creationSet = {}) {
  return Array.isArray(items) ? items.map((item) => hydrateCreationRepairSkuSubject(item, creationSet)) : [];
}
