import {
  getProductImageAssetIdentityForPlatform,
  getProductImagePlatformForSourceUrl,
  getProductImagePlatformLabel,
  isTrustedProductImageUrl,
  isTrustedProductImageUrlForSource,
  isTrustedProductSourceUrl,
  normalizeProductImageUrlForPlatform,
} from "./product-image-platforms.mjs";

export {
  isTrustedProductImageUrl,
  isTrustedProductImageUrlForSource,
  isTrustedProductSourceUrl,
};

export const PRODUCT_IMAGE_IMPORT_MAGIC = "GPT_IMAGE2_STUDIO_PRODUCT_IMAGES_V1";
export const PRODUCT_IMAGE_IMPORT_VERSION = 1;
export const MAX_PRODUCT_IMAGE_IMPORT_ITEMS = 120;
export const MAX_PRODUCT_IMAGE_IMPORT_TEXT_BYTES = 256 * 1024;

export const PRODUCT_IMAGE_CATEGORIES = Object.freeze(["main", "detail", "sku"]);

const PRODUCT_IMAGE_CATEGORY_SET = new Set(PRODUCT_IMAGE_CATEGORIES);
const PRODUCT_IMAGE_SELECTION_PRIORITY = new Map([
  ["main", 0],
  ["sku", 1],
  ["detail", 2],
]);
const PRODUCT_IMAGE_DISPLAY_PRIORITY = new Map(PRODUCT_IMAGE_CATEGORIES.map((category, index) => [category, index]));
const PRODUCT_IMAGE_EXTENSIONS = new Set(["jpg", "jpeg", "png", "webp", "avif"]);
const PRODUCT_IMAGE_FILENAME_PREFIXES = Object.freeze({ main: "主图", detail: "详情图", sku: "SKU" });
const WINDOWS_RESERVED_NAMES = /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\..*)?$/i;
const MAX_PRODUCT_IMAGE_VARIANT_LABELS = 32;
const MAX_PRODUCT_IMAGE_VARIANT_LABEL_LENGTH = 80;
const MAX_PRODUCT_IMAGE_VARIANT_KEY_LENGTH = 160;

function stringWithin(value, maxLength) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function parseTrustedHttpsUrl(value) {
  try {
    const url = new URL(String(value || ""));
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      (url.port && url.port !== "443")
    ) {
      return null;
    }
    url.hash = "";
    return url;
  } catch {
    return null;
  }
}

export function sanitizeProductImagePathSegment(value, { fallback = "product", maxLength = 96 } = {}) {
  const normalized = String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "-")
    .replace(/\s+/g, " ")
    .replace(/-+/g, "-")
    .replace(/[. ]+$/g, "")
    .replace(/^[. ]+/g, "")
    .trim()
    .slice(0, Math.max(1, maxLength))
    .replace(/[. ]+$/g, "");
  const safe = normalized || fallback;
  return WINDOWS_RESERVED_NAMES.test(safe) ? `_${safe}` : safe;
}

function normalizeImageExtension(value) {
  const candidate = String(value || "").toLowerCase().replace(/^\./, "");
  return PRODUCT_IMAGE_EXTENSIONS.has(candidate) ? (candidate === "jpeg" ? "jpg" : candidate) : "";
}

export function getProductImageExtension(urlValue, filename = "") {
  try {
    const pathnameMatch = new URL(String(urlValue || "")).pathname.match(/\.([a-z0-9]+)$/i);
    const urlExtension = normalizeImageExtension(pathnameMatch?.[1]);
    if (urlExtension) {
      return urlExtension;
    }
  } catch {}

  const filenameMatch = String(filename || "").match(/\.([a-z0-9]+)$/i);
  return normalizeImageExtension(filenameMatch?.[1]) || "jpg";
}

function normalizeSuggestedFilename(value, item, index) {
  const raw = String(value || "").split(/[\\/]/).at(-1) || "";
  const extension = getProductImageExtension(item.url, raw);
  const order = Number.isSafeInteger(Number(item.order)) && Number(item.order) > 0 ? Number(item.order) : index + 1;
  const prefix = PRODUCT_IMAGE_FILENAME_PREFIXES[item.category] || item.category;
  const variantSuffix = item.category === "sku" && Array.isArray(item.variantLabels)
    ? item.variantLabels.filter(Boolean).join("-")
    : "";
  const fallback = `${prefix}-${order}`;
  const base = [fallback, variantSuffix].filter(Boolean).join("-");
  return `${sanitizeProductImagePathSegment(base, { fallback, maxLength: 100 })}.${extension}`;
}

function normalizeManifestItem(rawItem, index, platform, sourcePageUrl) {
  if (!rawItem || typeof rawItem !== "object" || Array.isArray(rawItem)) {
    throw new Error(`第 ${index + 1} 个商品图条目无效。`);
  }

  const category = stringWithin(rawItem.category, 20).toLowerCase();
  if (!PRODUCT_IMAGE_CATEGORY_SET.has(category)) {
    throw new Error(`第 ${index + 1} 个商品图类别不受支持。`);
  }

  const parsedUrl = parseTrustedHttpsUrl(rawItem.url);
  if (!parsedUrl || !isTrustedProductImageUrlForSource(parsedUrl.href, sourcePageUrl, platform)) {
    throw new Error(`第 ${index + 1} 个商品图图片地址不受支持。`);
  }
  const normalizedUrl = normalizeProductImageUrlForPlatform(parsedUrl, platform);
  if (!normalizedUrl || !isTrustedProductImageUrl(normalizedUrl.href, platform)) {
    throw new Error(`第 ${index + 1} 个商品图图片地址不受支持。`);
  }

  const order = Number.isSafeInteger(Number(rawItem.order)) && Number(rawItem.order) > 0
    ? Number(rawItem.order)
    : index + 1;
  const id = stringWithin(rawItem.id, 120) || `${category}-${order}`;
  const width = Math.max(0, Math.min(100000, Number.parseInt(rawItem.width, 10) || 0));
  const height = Math.max(0, Math.min(100000, Number.parseInt(rawItem.height, 10) || 0));
  const confidence = ["high", "medium", "low"].includes(String(rawItem.confidence || "").toLowerCase())
    ? String(rawItem.confidence).toLowerCase()
    : "medium";
  const item = {
    id,
    category,
    order,
    url: normalizedUrl.href,
    width,
    height,
    confidence,
  };
  if (category === "sku") {
    const seenVariantLabels = new Set();
    const variantLabels = [];
    for (const value of Array.isArray(rawItem.variantLabels) ? rawItem.variantLabels : []) {
      const label = stringWithin(value, MAX_PRODUCT_IMAGE_VARIANT_LABEL_LENGTH).replace(/\s+/g, " ");
      if (!label || seenVariantLabels.has(label)) continue;
      seenVariantLabels.add(label);
      variantLabels.push(label);
      if (variantLabels.length >= MAX_PRODUCT_IMAGE_VARIANT_LABELS) break;
    }
    const variantCount = Math.max(
      variantLabels.length,
      Math.min(10000, Number.parseInt(rawItem.variantCount, 10) || 0),
    );
    const variantKey = stringWithin(rawItem.variantKey, MAX_PRODUCT_IMAGE_VARIANT_KEY_LENGTH);
    const platformPrefix = `${platform}:`;
    const sourceVariantId = variantKey.startsWith(platformPrefix) ? variantKey.slice(platformPrefix.length) : "";
    if (variantLabels.length) item.variantLabels = variantLabels;
    if (/^[a-z0-9._-]{1,120}$/i.test(sourceVariantId)) item.variantKey = `${platform}:${sourceVariantId}`;
    if (variantCount > 0) item.variantCount = variantCount;
  }
  item.filename = normalizeSuggestedFilename(rawItem.filename, item, index);
  return item;
}

function manifestItemIdentity(item, platform) {
  const assetIdentity = getProductImageAssetIdentityForPlatform(item.url, platform) || item.url;
  if (item.category !== "sku") return assetIdentity;
  if (item.variantKey) return `${assetIdentity}\nkey:${item.variantKey}`;
  const variantLabels = Array.isArray(item.variantLabels) ? item.variantLabels.filter(Boolean) : [];
  return variantLabels.length ? `${assetIdentity}\nlabels:${JSON.stringify(variantLabels)}` : assetIdentity;
}

export function normalizeProductImageImportManifest(rawManifest) {
  if (!rawManifest || typeof rawManifest !== "object" || Array.isArray(rawManifest)) {
    throw new Error("商品图采集清单格式无效。");
  }
  if (Number(rawManifest.version) !== PRODUCT_IMAGE_IMPORT_VERSION) {
    throw new Error("商品图采集清单版本不受支持。");
  }

  const sourceUrl = parseTrustedHttpsUrl(rawManifest.source?.pageUrl);
  const detectedPlatform = sourceUrl ? getProductImagePlatformForSourceUrl(sourceUrl.href) : "";
  const platform = stringWithin(rawManifest.source?.platform, 20).toLowerCase();
  if (!detectedPlatform || platform !== detectedPlatform || !isTrustedProductSourceUrl(sourceUrl.href, platform)) {
    throw new Error("商品图采集清单必须来自受支持平台的商品详情页。");
  }

  if (!Array.isArray(rawManifest.items) || rawManifest.items.length === 0) {
    throw new Error("商品图采集清单中没有可导入图片。");
  }
  if (rawManifest.items.length > MAX_PRODUCT_IMAGE_IMPORT_ITEMS) {
    throw new Error(`商品图采集清单最多包含 ${MAX_PRODUCT_IMAGE_IMPORT_ITEMS} 张图片。`);
  }

  const capturedDate = new Date(String(rawManifest.capturedAt || ""));
  if (Number.isNaN(capturedDate.getTime())) {
    throw new Error("商品图采集时间无效。");
  }

  const items = [];
  const seenIds = new Set();
  const seenItemsByCategory = new Map(PRODUCT_IMAGE_CATEGORIES.map((category) => [category, new Set()]));
  for (let index = 0; index < rawManifest.items.length; index += 1) {
    const item = normalizeManifestItem(rawManifest.items[index], index, platform, sourceUrl.href);
    if (seenIds.has(item.id)) {
      throw new Error(`第 ${index + 1} 个商品图 ID 重复。`);
    }
    const seenItems = seenItemsByCategory.get(item.category);
    const identity = manifestItemIdentity(item, platform);
    if (seenItems.has(identity)) {
      continue;
    }
    seenIds.add(item.id);
    seenItems.add(identity);
    items.push(item);
  }
  if (items.length === 0) {
    throw new Error("商品图采集清单中没有可导入图片。");
  }

  return {
    version: PRODUCT_IMAGE_IMPORT_VERSION,
    source: {
      platform,
      pageUrl: sourceUrl.href,
    },
    product: {
      id: stringWithin(rawManifest.product?.id, 120),
      title: stringWithin(rawManifest.product?.title, 200) || `${getProductImagePlatformLabel(platform)} 商品`,
    },
    capturedAt: capturedDate.toISOString(),
    items,
  };
}

function getUtf8ByteLength(value) {
  return new TextEncoder().encode(String(value || "")).byteLength;
}

export function parseProductImageImportText(value) {
  const text = String(value || "");
  if (getUtf8ByteLength(text) > MAX_PRODUCT_IMAGE_IMPORT_TEXT_BYTES) {
    throw new Error("商品图采集清单超过允许大小。");
  }
  const newlineIndex = text.indexOf("\n");
  const magic = (newlineIndex >= 0 ? text.slice(0, newlineIndex) : text).replace(/\r$/, "");
  if (magic !== PRODUCT_IMAGE_IMPORT_MAGIC) {
    throw new Error("剪贴板内容不是受支持的商品图采集清单。");
  }

  let rawManifest;
  try {
    rawManifest = JSON.parse(text.slice(newlineIndex + 1));
  } catch {
    throw new Error("商品图采集清单 JSON 无效。");
  }
  return normalizeProductImageImportManifest(rawManifest);
}

export function serializeProductImageImportManifest(rawManifest) {
  const manifest = normalizeProductImageImportManifest(rawManifest);
  const text = `${PRODUCT_IMAGE_IMPORT_MAGIC}\n${JSON.stringify(manifest)}`;
  if (getUtf8ByteLength(text) > MAX_PRODUCT_IMAGE_IMPORT_TEXT_BYTES) {
    throw new Error("商品图采集清单超过允许大小。");
  }
  return text;
}

function sortProductImageItems(items, priority) {
  return [...(items || [])]
    .map((item, index) => ({ item, index }))
    .sort((left, right) =>
      (priority.get(left.item.category) ?? 99) - (priority.get(right.item.category) ?? 99) ||
      (Number(left.item.order) || left.index + 1) - (Number(right.item.order) || right.index + 1) ||
      left.index - right.index,
    )
    .map(({ item }) => item);
}

export function selectProductImageImportItemIds(items, capacity) {
  const limit = Math.max(0, Math.floor(Number(capacity) || 0));
  return sortProductImageItems(items, PRODUCT_IMAGE_SELECTION_PRIORITY)
    .slice(0, limit)
    .map((item) => item.id);
}

function formatProductImageDownloadDate(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) throw new Error("商品图下载日期无效。");
  const year = String(date.getFullYear()).slice(-2).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}${month}${day}`;
}

export function buildProductImageDownloadPlan(rawManifest, selectedIds, { clock = () => new Date() } = {}) {
  const manifest = normalizeProductImageImportManifest(rawManifest);
  const selected = new Set([...(selectedIds || [])].map((value) => String(value || "")));
  const dateSegment = formatProductImageDownloadDate(typeof clock === "function" ? clock() : clock);
  const productSegment = sanitizeProductImagePathSegment(
    [manifest.product.id, manifest.product.title].filter(Boolean).join("-") || `${manifest.source.platform}-product`,
    { fallback: `${manifest.source.platform}-product`, maxLength: 96 },
  );
  const folder = `GPT-Image2-Studio/${dateSegment}/${productSegment}`;
  const items = sortProductImageItems(
    manifest.items.filter((item) => selected.has(item.id)),
    PRODUCT_IMAGE_DISPLAY_PRIORITY,
  ).map((item) => ({ ...item, path: `${folder}/${item.filename}` }));

  return { folder, items };
}
