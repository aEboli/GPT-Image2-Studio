import {
  generateSkuMatrix,
  normalizeAsset,
  normalizeDraft,
  truncateProductDescription,
} from "./domain.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "./template-headers.mjs";

export const STUDIO_CAROUSEL_LIMIT = 10;
const STUDIO_IMAGE_SUFFIX_PATTERN = /(?:\.(?:avif|bmp|gif|jpe?g|png|webp))+$/iu;
const HAN_CHARACTERS_PATTERN = /\p{Script=Han}+/gu;

function asText(value) {
  return value == null ? "" : String(value).trim();
}

export function stripStudioImageSuffix(value) {
  return asText(value).replace(STUDIO_IMAGE_SUFFIX_PATTERN, "").trim();
}

function studioPreviewUrl(value) {
  const text = asText(value);
  if (!text) return "";
  try {
    const url = new URL(text, "http://listing.local");
    if (url.origin !== "http://listing.local" || url.pathname !== TEMU_STUDIO_IMAGE_PATH) return "";
    return `${url.pathname}${url.search}`;
  } catch {
    return "";
  }
}

export function createStudioAsset(setId, image) {
  if (!image || typeof image !== "object") return normalizeAsset();
  const previewUrl = studioPreviewUrl(image.previewUrl);
  return normalizeAsset({
    id: ["studio", asText(setId), asText(image.itemId)].filter(Boolean).join(":"),
    name: asText(image.name),
    url: "",
    width: image.width,
    height: image.height,
    format: asText(image.format),
    status: previewUrl ? "local" : "error",
    error: previewUrl ? "" : "Studio 图片代理地址无效",
    source: "studio",
    studioSetId: asText(setId),
    studioItemId: asText(image.itemId),
    studioPreviewUrl: previewUrl,
  });
}

export function groupStudioAssetsForUpload(candidate) {
  const groups = new Map();
  const add = (asset) => {
    if (!asset?.studioPreviewUrl) return;
    if (!groups.has(asset.studioPreviewUrl)) groups.set(asset.studioPreviewUrl, []);
    groups.get(asset.studioPreviewUrl).push(asset);
  };
  (candidate?.assets?.carousel || []).forEach(add);
  (candidate?.skus || []).forEach((sku) => {
    add(sku.image);
  });
  return [...groups].map(([previewUrl, assets]) => ({ previewUrl, assets }));
}

function uniqueSkuSubjects(value) {
  if (!Array.isArray(value)) return [];
  const seenIds = new Set();
  const seenTitles = new Set();
  return value.reduce((subjects, subject) => {
    const id = asText(subject?.id);
    const baseTitle = stripStudioImageSuffix(subject?.title);
    if (!baseTitle || (id && seenIds.has(id))) return subjects;
    if (id) seenIds.add(id);

    let title = baseTitle;
    let duplicateIndex = 2;
    while (seenTitles.has(title)) {
      title = `${baseTitle} (${duplicateIndex})`;
      duplicateIndex += 1;
    }
    seenTitles.add(title);
    subjects.push({ ...subject, title });
    return subjects;
  }, []);
}

function studioSkuCodePart(value) {
  return stripStudioImageSuffix(value)
    .replace(HAN_CHARACTERS_PATTERN, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "");
}

function uniqueStudioSkuCode(value, usedCodes, fallbackIndex) {
  const base = studioSkuCodePart(value) || `SKU-${fallbackIndex + 1}`;
  let code = base;
  let duplicateIndex = 2;
  while (usedCodes.has(code.toLowerCase())) {
    code = `${base}-${duplicateIndex}`;
    duplicateIndex += 1;
  }
  usedCodes.add(code.toLowerCase());
  return code;
}

function skuSubjectSelectionKey(subject, index) {
  const id = asText(subject?.id);
  return id ? `id:${id}` : `title:${asText(subject?.title)}:${index}`;
}

export function studioSkuSubjectEntries(studioSet) {
  return uniqueSkuSubjects(studioSet?.skuSubjects)
    .map((subject, index) => ({ ...subject, selectionKey: skuSubjectSelectionKey(subject, index) }));
}

export function defaultStudioSkuSubjectKeys(studioSet) {
  return studioSkuSubjectEntries(studioSet).map(({ selectionKey }) => selectionKey);
}

export function toggleStudioSkuSubjectSelection(keys, studioSet, selectionKey) {
  const validKeys = new Set(defaultStudioSkuSubjectKeys(studioSet));
  const normalized = [...new Set((Array.isArray(keys) ? keys : []).map(asText).filter((key) => validKeys.has(key)))];
  const key = asText(selectionKey);
  if (!validKeys.has(key)) return normalized;
  return normalized.includes(key)
    ? normalized.filter((value) => value !== key)
    : [...normalized, key];
}

function selectedStudioSkuSubjects(studioSet, selectionKeys) {
  const entries = studioSkuSubjectEntries(studioSet);
  const selectedKeys = new Set(
    (Array.isArray(selectionKeys) ? selectionKeys : entries.map(({ selectionKey }) => selectionKey))
      .map(asText),
  );
  return entries.filter(({ selectionKey }) => selectedKeys.has(selectionKey)).map(({ selectionKey, ...subject }) => subject);
}

export function normalizeStudioLogisticsEstimate(value) {
  if (!value || !["package", "product"].includes(value.source)) return null;
  const normalized = {};
  for (const key of ["lengthCm", "widthCm", "heightCm", "weightG"]) {
    const number = Number(value[key]);
    if (!Number.isFinite(number) || number <= 0) return null;
    normalized[key] = String(number);
  }
  return { source: value.source, ...normalized };
}

function studioCarouselImages(studioSet) {
  return Array.isArray(studioSet?.carouselImages) ? studioSet.carouselImages : [];
}

export function defaultStudioCarouselItemIds(studioSet) {
  return studioCarouselImages(studioSet)
    .map((image) => asText(image?.itemId))
    .filter(Boolean)
    .slice(0, STUDIO_CAROUSEL_LIMIT);
}

export function remainingStudioCarouselImages(studioSet, carouselAssets = []) {
  const setId = asText(studioSet?.setId);
  if (!setId) return [];
  const selectedItemIds = new Set((Array.isArray(carouselAssets) ? carouselAssets : [])
    .filter((asset) => asText(asset?.studioSetId) === setId)
    .map((asset) => asText(asset?.studioItemId))
    .filter(Boolean));
  return studioCarouselImages(studioSet)
    .filter((image) => {
      const itemId = asText(image?.itemId);
      return itemId && !selectedItemIds.has(itemId);
    });
}

export function toggleStudioCarouselSelection(itemIds, itemIdInput) {
  const itemId = asText(itemIdInput);
  const normalized = [...new Set((Array.isArray(itemIds) ? itemIds : []).map(asText).filter(Boolean))]
    .slice(0, STUDIO_CAROUSEL_LIMIT);
  if (!itemId) return { itemIds: normalized, limitReached: false };
  if (normalized.includes(itemId)) {
    return { itemIds: normalized.filter((value) => value !== itemId), limitReached: false };
  }
  if (normalized.length >= STUDIO_CAROUSEL_LIMIT) return { itemIds: normalized, limitReached: true };
  return { itemIds: [...normalized, itemId], limitReached: false };
}

function selectedStudioCarouselImages(studioSet, itemIds) {
  const candidates = studioCarouselImages(studioSet);
  const byId = new Map(candidates.map((image) => [asText(image?.itemId), image]));
  const selectedIds = Array.isArray(itemIds) ? itemIds : defaultStudioCarouselItemIds(studioSet);
  return [...new Set(selectedIds.map(asText).filter(Boolean))]
    .slice(0, STUDIO_CAROUSEL_LIMIT)
    .map((itemId) => byId.get(itemId))
    .filter(Boolean);
}

export function mergeStudioSetIntoDraft(inputDraft, studioSet, {
  importedAt = new Date().toISOString(),
  importEstimates = false,
  carouselItemIds,
  skuSubjectKeys,
} = {}) {
  if (!studioSet || typeof studioSet !== "object" || !asText(studioSet.setId)) {
    throw new TypeError("Studio 创作记录无效");
  }

  const next = normalizeDraft(inputDraft);
  const listing = studioSet.listing && typeof studioSet.listing === "object" ? studioSet.listing : {};
  const subjects = selectedStudioSkuSubjects(studioSet, skuSubjectKeys);
  const logisticsEstimate = importEstimates ? normalizeStudioLogisticsEstimate(studioSet.logisticsEstimate) : null;
  const importedLogistics = logisticsEstimate || { lengthCm: "", widthCm: "", heightCm: "", weightG: "" };
  const carouselAssets = selectedStudioCarouselImages(studioSet, carouselItemIds)
    .map((image) => createStudioAsset(studioSet.setId, image));

  next.product.title = asText(listing.chineseTitle) || asText(studioSet.productName);
  next.product.englishTitle = asText(listing.englishTitle);
  next.product.description = truncateProductDescription(asText(listing.englishDescription) || asText(listing.chineseDescription));
  if (importEstimates) {
    Object.assign(next.product, {
      length: importedLogistics.lengthCm,
      width: importedLogistics.widthCm,
      height: importedLogistics.heightCm,
      weight: importedLogistics.weightG,
    });
  }
  next.variants = subjects.length
    ? { name1: "颜色", values1: subjects.map((subject) => asText(subject.title)), name2: "", values2: [] }
    : { name1: "颜色", values1: ["默认"], name2: "", values2: [] };
  next.assets.carousel = carouselAssets;

  const usedSkuCodes = new Set();
  next.skus = generateSkuMatrix(next).map((sku, index) => {
    const subject = subjects[index];
    const subjectImage = subject?.image ? createStudioAsset(studioSet.setId, subject.image) : null;
    const image = subjectImage?.studioPreviewUrl ? subjectImage : normalizeAsset(carouselAssets[0]);
    return {
      ...sku,
      skuCode: uniqueStudioSkuCode(asText(subject?.id) || sku.skuCode, usedSkuCodes, index),
      image,
      ...(importEstimates ? {
        length: importedLogistics.lengthCm,
        width: importedLogistics.widthCm,
        height: importedLogistics.heightCm,
        weight: importedLogistics.weightG,
      } : {}),
    };
  });
  next.assets.packaging = [];
  next.studioImport = {
    setId: asText(studioSet.setId),
    productName: asText(studioSet.productName),
    importedAt: asText(importedAt),
    ...(logisticsEstimate ? { logisticsEstimate } : {}),
  };

  return normalizeDraft(next);
}
