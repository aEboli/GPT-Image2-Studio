export const BROWSER_IMAGE_CACHE_DB_NAME = "image-studio-browser-image-cache-v1";
export const BROWSER_IMAGE_CACHE_STORE_NAME = "generated-images";
export const BROWSER_IMAGE_CACHE_INDEX_KEY = "image-studio-browser-image-cache-index-v1";

function nowIso() {
  return new Date().toISOString();
}

export function isCacheableBrowserImageUrl(url) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(url || ""));
}

export function isServerImageProxyUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return false;
  }

  if (raw.startsWith("/api/images/")) {
    return true;
  }

  try {
    const origin = globalThis.window?.location?.origin || "http://localhost";
    const parsed = new URL(raw, origin);
    return parsed.origin === origin && parsed.pathname.startsWith("/api/images/");
  } catch (_error) {
    return false;
  }
}

export function getServerImageUrl(item = {}) {
  const imageUrl = String(item.serverImageUrl || item.imageUrl || "");
  const thumbnailUrl = String(item.serverThumbnailUrl || item.thumbnailUrl || "");
  if (isServerImageProxyUrl(imageUrl)) {
    return imageUrl;
  }
  if (isServerImageProxyUrl(thumbnailUrl)) {
    return thumbnailUrl;
  }
  return "";
}

export function getServerThumbnailUrl(item = {}) {
  const thumbnailUrl = String(item.serverThumbnailUrl || item.thumbnailUrl || "");
  if (isServerImageProxyUrl(thumbnailUrl)) {
    return thumbnailUrl;
  }
  return getServerImageUrl(item);
}

export function getImageUrl(item) {
  return item?.imageUrl || item?.thumbnailUrl || item?.previewUrl || item?.serverImageUrl || item?.serverThumbnailUrl || "";
}

export function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

export async function fetchServerImageAsDataUrl(imageUrl) {
  const response = await fetch(imageUrl, {
    credentials: "same-origin",
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error(`server image fetch failed with status ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("server image response is not an image");
  }
  return readBlobAsDataUrl(blob);
}

export function dataUrlToBlob(dataUrl) {
  const [header, base64 = ""] = String(dataUrl || "").split(",", 2);
  const mimeType = header.match(/^data:([^;]+);base64$/i)?.[1] || "application/octet-stream";
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return new Blob([bytes], { type: mimeType });
}

export function normalizeBrowserCachedGalleryItem(item = {}) {
  const filename = String(item.filename || "").trim();
  if (!filename) {
    return null;
  }

  const serverImageUrl = getServerImageUrl(item);
  const serverThumbnailUrl = getServerThumbnailUrl(item);
  const normalized = {
    id: String(item.id || ""),
    filename,
    createdAt: String(item.createdAt || nowIso()),
    prompt: String(item.prompt || ""),
    baseUrl: String(item.baseUrl || ""),
    imageRoute: String(item.imageRoute || item.generationRoute || ""),
    responsesModel: String(item.responsesModel || ""),
    imageModel: String(item.imageModel || "gpt-image-2"),
    hasReferenceImage: Boolean(item.hasReferenceImage),
    referenceImageNames: Array.isArray(item.referenceImageNames) ? item.referenceImageNames.map(String).filter(Boolean) : [],
    referenceImageName: String(item.referenceImageName || ""),
    ratio: String(item.ratio || ""),
    ratioLabel: String(item.ratioLabel || ""),
    size: String(item.size || ""),
    quality: String(item.quality || ""),
    format: String(item.format || ""),
    reasoningEffort: String(item.reasoningEffort || ""),
    generationStartedAt: String(item.generationStartedAt || ""),
    generationCompletedAt: String(item.generationCompletedAt || ""),
    generationDurationMs: String(item.generationDurationMs || ""),
  };

  if (serverImageUrl) {
    normalized.imageUrl = serverImageUrl;
  }
  if (serverThumbnailUrl) {
    normalized.thumbnailUrl = serverThumbnailUrl;
  } else if (normalized.imageUrl) {
    normalized.thumbnailUrl = normalized.imageUrl;
  }

  return normalized;
}

export function readBrowserImageCacheIndex() {
  try {
    const raw = window.localStorage.getItem(BROWSER_IMAGE_CACHE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map(normalizeBrowserCachedGalleryItem).filter(Boolean)
      : [];
  } catch (_error) {
    return [];
  }
}

export function writeBrowserImageCacheIndex(items) {
  try {
    window.localStorage.setItem(
      BROWSER_IMAGE_CACHE_INDEX_KEY,
      JSON.stringify(items.map(normalizeBrowserCachedGalleryItem).filter(Boolean)),
    );
  } catch (_error) {
    // Ignore storage quota or privacy-mode failures; IndexedDB still keeps images for this session.
  }
}

export function openBrowserImageCacheDB() {
  if (!window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(BROWSER_IMAGE_CACHE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BROWSER_IMAGE_CACHE_STORE_NAME, { keyPath: "filename" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

export async function withBrowserImageCacheStore(mode, operation) {
  const db = await openBrowserImageCacheDB();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BROWSER_IMAGE_CACHE_STORE_NAME, mode);
    const store = transaction.objectStore(BROWSER_IMAGE_CACHE_STORE_NAME);
    let operationResult = null;
    transaction.oncomplete = () => {
      db.close();
      resolve(operationResult);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB transaction failed"));
    };
    operationResult = operation(store);
  });
}

export async function putBrowserCachedImageData(filename, dataUrl) {
  await withBrowserImageCacheStore("readwrite", (store) => {
    store.put({ filename, dataUrl, updatedAt: nowIso() });
  });
}

export async function getBrowserCachedImageData(filename) {
  return withBrowserImageCacheStore("readonly", (store) => {
    const request = store.get(filename);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.dataUrl || "");
      request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
    });
  });
}

export async function deleteBrowserCachedImageData(filename) {
  await withBrowserImageCacheStore("readwrite", (store) => {
    store.delete(filename);
  });
}

export async function cacheBrowserGalleryItem(item) {
  const cachedItem = normalizeBrowserCachedGalleryItem(item);
  const serverImageUrl = getServerImageUrl(item);
  let imageUrl = getImageUrl(item);
  if (!isCacheableBrowserImageUrl(imageUrl) && serverImageUrl) {
    imageUrl = serverImageUrl;
  }
  const hasServerImageUrl = isServerImageProxyUrl(imageUrl);
  const hasDataUrl = isCacheableBrowserImageUrl(imageUrl);
  if (!cachedItem || (!hasDataUrl && !hasServerImageUrl)) {
    return;
  }

  const writeIndex = () => {
    const nextIndex = [
      cachedItem,
      ...readBrowserImageCacheIndex().filter((entry) => entry.filename !== cachedItem.filename),
    ];
    writeBrowserImageCacheIndex(nextIndex);
  };

  try {
    if (hasServerImageUrl) {
      writeIndex();
    }
    const dataUrl = hasDataUrl ? imageUrl : await fetchServerImageAsDataUrl(imageUrl);
    await putBrowserCachedImageData(cachedItem.filename, dataUrl);
    writeIndex();
    await navigator.storage?.persist?.();
  } catch (error) {
    console.warn("cache generated image in browser failed", cachedItem.filename, error);
  }
}

export async function readBrowserCachedGalleryItems() {
  const entries = readBrowserImageCacheIndex();
  const restoredItems = [];
  const missingFilenames = new Set();

  for (const entry of entries) {
    try {
      const dataUrl = await getBrowserCachedImageData(entry.filename);
      const fallbackImageUrl = isServerImageProxyUrl(entry.imageUrl) ? entry.imageUrl : "";
      const fallbackThumbnailUrl = isServerImageProxyUrl(entry.thumbnailUrl) ? entry.thumbnailUrl : fallbackImageUrl;
      if (!isCacheableBrowserImageUrl(dataUrl)) {
        if (fallbackImageUrl) {
          restoredItems.push({
            ...entry,
            imageUrl: fallbackImageUrl,
            thumbnailUrl: fallbackThumbnailUrl,
          });
        } else {
          missingFilenames.add(entry.filename);
        }
        continue;
      }

      restoredItems.push({
        ...entry,
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
      });
    } catch (_error) {
      missingFilenames.add(entry.filename);
    }
  }

  if (missingFilenames.size > 0) {
    writeBrowserImageCacheIndex(entries.filter((entry) => !missingFilenames.has(entry.filename)));
  }

  return restoredItems;
}

export async function deleteBrowserCachedGalleryItem(filename) {
  const normalizedFilename = String(filename || "").trim();
  if (!normalizedFilename) {
    return;
  }

  writeBrowserImageCacheIndex(readBrowserImageCacheIndex().filter((entry) => entry.filename !== normalizedFilename));
  try {
    await deleteBrowserCachedImageData(normalizedFilename);
  } catch (_error) {
    // The in-page gallery has already been updated; stale browser data can be ignored.
  }
}

export async function clearBrowserImageCache() {
  window.localStorage.removeItem(BROWSER_IMAGE_CACHE_INDEX_KEY);
  try {
    await withBrowserImageCacheStore("readwrite", (store) => {
      store.clear();
    });
  } catch (_error) {
    // Ignore unavailable IndexedDB or privacy-mode failures.
  }
}

export function mergeServerAndBrowserGalleryItems(serverItems, browserItems) {
  const mergedByFilename = new Map();

  for (const item of browserItems) {
    if (item?.filename) {
      mergedByFilename.set(item.filename, item);
    }
  }

  for (const item of serverItems) {
    if (!item?.filename) {
      continue;
    }
    const cachedItem = mergedByFilename.get(item.filename);
    const cachedImageUrl = isCacheableBrowserImageUrl(cachedItem?.imageUrl) ? cachedItem.imageUrl : "";
    const cachedThumbnailUrl = isCacheableBrowserImageUrl(cachedItem?.thumbnailUrl)
      ? cachedItem.thumbnailUrl
      : cachedImageUrl;
    mergedByFilename.set(item.filename, {
      ...cachedItem,
      ...item,
      imageUrl: cachedImageUrl || item.imageUrl || cachedItem?.imageUrl || "",
      thumbnailUrl: cachedThumbnailUrl || item.thumbnailUrl || cachedItem?.thumbnailUrl || cachedImageUrl || "",
    });
  }

  return [...mergedByFilename.values()];
}
