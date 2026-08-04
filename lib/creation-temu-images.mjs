import { createHash } from "node:crypto";
import { lstat, readFile, realpath } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";

import { TEMU_EXPORT_LIMITS, isPublicHttpsImageUrl } from "./creation-temu-export.mjs";

const CLOUDINARY_HOST = "res.cloudinary.com";
const DEFAULT_UPLOAD_ATTEMPTS = 2;
const DEFAULT_UPLOAD_TIMEOUT_MS = 15_000;
const DEFAULT_RESPONSE_BYTES = 1024 * 1024;
const DEFAULT_RESOLVE_CONCURRENCY = 4;
const CLOUD_NAME_PATTERN = /^[a-z0-9_-]{1,128}$/iu;
const UPLOAD_PRESET_PATTERN = /^[a-z0-9_.-]{1,128}$/iu;
const TEMU_IMAGE_ERROR = Symbol("temuImageError");

const IMAGE_TYPES = Object.freeze({
  ".avif": {
    mimeType: "image/avif",
    matches(bytes) {
      if (bytes.length < 12 || bytes.toString("ascii", 4, 8) !== "ftyp") return false;
      for (let offset = 8; offset + 4 <= bytes.length; offset += 4) {
        const brand = bytes.toString("ascii", offset, offset + 4);
        if (brand === "avif" || brand === "avis") return true;
      }
      return false;
    },
  },
  ".gif": {
    mimeType: "image/gif",
    matches(bytes) {
      const signature = bytes.toString("ascii", 0, 6);
      return signature === "GIF87a" || signature === "GIF89a";
    },
  },
  ".jpeg": {
    mimeType: "image/jpeg",
    matches(bytes) {
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    },
  },
  ".jpg": {
    mimeType: "image/jpeg",
    matches(bytes) {
      return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
    },
  },
  ".png": {
    mimeType: "image/png",
    matches(bytes) {
      return bytes.length >= 8 && bytes.subarray(0, 8).equals(
        Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      );
    },
  },
  ".webp": {
    mimeType: "image/webp",
    matches(bytes) {
      return bytes.length >= 12 &&
        bytes.toString("ascii", 0, 4) === "RIFF" &&
        bytes.toString("ascii", 8, 12) === "WEBP";
    },
  },
});

function cleanString(value) {
  return String(value ?? "").trim();
}

function imageError(code, message) {
  const error = new Error(message);
  error.code = code;
  error[TEMU_IMAGE_ERROR] = true;
  return error;
}

function isTemuImageError(error) {
  return error?.[TEMU_IMAGE_ERROR] === true;
}

function normalizeRelativeImagePath(value) {
  const normalized = cleanString(value).replace(/\\/gu, "/");
  const segments = normalized.split("/");
  if (
    !normalized ||
    normalized.includes("\0") ||
    normalized.startsWith("/") ||
    isAbsolute(normalized) ||
    /^[a-z]:/iu.test(normalized) ||
    segments.some((segment) => !segment || segment === "." || segment === ".." || segment.includes(":"))
  ) {
    throw imageError("UNSAFE_IMAGE_PATH", "图片相对路径不在允许的输出目录范围内。");
  }
  return { normalized, segments };
}

function isStrictDescendant(root, target) {
  const offset = relative(resolve(root), resolve(target));
  return Boolean(
    offset &&
    offset !== ".." &&
    !offset.startsWith("..\\") &&
    !offset.startsWith("../") &&
    !isAbsolute(offset)
  );
}

async function checkedLstat(path, { target = false } = {}) {
  try {
    const stats = await lstat(path);
    if (stats.isSymbolicLink()) {
      throw imageError("UNSAFE_IMAGE_PATH", "图片路径包含不允许的符号链接。");
    }
    if (target && !stats.isFile()) {
      throw imageError("UNSAFE_IMAGE_PATH", "图片路径不是普通文件。");
    }
    if (!target && !stats.isDirectory()) {
      throw imageError("UNSAFE_IMAGE_PATH", "图片路径包含非目录节点。");
    }
    return stats;
  } catch (error) {
    if (isTemuImageError(error)) throw error;
    if (error?.code === "ENOENT") {
      throw imageError("IMAGE_FILE_MISSING", "本地图片文件不存在。");
    }
    if (error?.code === "ELOOP") {
      throw imageError("UNSAFE_IMAGE_PATH", "图片路径包含不允许的符号链接。");
    }
    throw imageError("IMAGE_FILE_UNREADABLE", "本地图片文件无法安全读取。");
  }
}

function assertSupportedImage(bytes, extension) {
  const imageType = IMAGE_TYPES[extension];
  if (!imageType || !imageType.matches(bytes)) {
    throw imageError("UNSUPPORTED_IMAGE_TYPE", "本地文件的扩展名和图片内容类型不匹配或不受支持。");
  }
  return imageType.mimeType;
}

export async function inspectLocalTemuImage({
  outputDir,
  relativePath,
  maxBytes = TEMU_EXPORT_LIMITS.maxImageBytes,
} = {}) {
  try {
    const { normalized, segments } = normalizeRelativeImagePath(relativePath);
    const normalizedOutputDir = cleanString(outputDir);
    if (!normalizedOutputDir) {
      throw imageError("UNSAFE_IMAGE_PATH", "本地图片输出目录无效。");
    }
    const outputRoot = resolve(normalizedOutputDir);
    const target = resolve(outputRoot, ...segments);
    if (!isStrictDescendant(outputRoot, target)) {
      throw imageError("UNSAFE_IMAGE_PATH", "图片相对路径不在允许的输出目录范围内。");
    }

    let realOutputRoot;
    try {
      realOutputRoot = await realpath(outputRoot);
    } catch {
      throw imageError("IMAGE_FILE_UNREADABLE", "本地图片输出目录无法安全读取。");
    }

    let cursor = outputRoot;
    for (let index = 0; index < segments.length; index += 1) {
      cursor = join(cursor, segments[index]);
      await checkedLstat(cursor, { target: index === segments.length - 1 });
    }

    const fileStats = await checkedLstat(target, { target: true });
    if (!Number.isSafeInteger(fileStats.size) || fileStats.size > maxBytes) {
      throw imageError(
        "IMAGE_FILE_TOO_LARGE",
        `单张本地图片不得超过 ${Math.floor(maxBytes / (1024 * 1024))} MiB。`,
      );
    }

    let realTarget;
    try {
      realTarget = await realpath(target);
    } catch {
      throw imageError("IMAGE_FILE_UNREADABLE", "本地图片文件无法安全读取。");
    }
    if (!isStrictDescendant(realOutputRoot, realTarget)) {
      throw imageError("UNSAFE_IMAGE_PATH", "图片真实路径不在允许的输出目录范围内。");
    }

    const extension = extname(target).toLowerCase();
    if (!Object.prototype.hasOwnProperty.call(IMAGE_TYPES, extension)) {
      throw imageError("UNSUPPORTED_IMAGE_TYPE", "本地图片扩展名不受支持。");
    }

    let bytes;
    try {
      bytes = await readFile(target);
    } catch {
      throw imageError("IMAGE_FILE_UNREADABLE", "本地图片文件无法安全读取。");
    }
    if (bytes.length > maxBytes) {
      throw imageError(
        "IMAGE_FILE_TOO_LARGE",
        `单张本地图片不得超过 ${Math.floor(maxBytes / (1024 * 1024))} MiB。`,
      );
    }
    const mimeType = assertSupportedImage(bytes, extension);

    const [finalStats, finalRealTarget] = await Promise.all([
      checkedLstat(target, { target: true }),
      realpath(target).catch(() => ""),
    ]);
    if (
      !finalRealTarget ||
      finalRealTarget !== realTarget ||
      !isStrictDescendant(realOutputRoot, finalRealTarget) ||
      finalStats.size !== bytes.length ||
      finalStats.dev !== fileStats.dev ||
      finalStats.ino !== fileStats.ino
    ) {
      throw imageError("UNSAFE_IMAGE_PATH", "图片文件在读取期间发生变化。");
    }

    return {
      relativePath: normalized,
      absolutePath: target,
      mimeType,
      size: bytes.length,
      sourceSha256: `sha256:${createHash("sha256").update(bytes).digest("hex")}`,
      bytes,
    };
  } catch (error) {
    if (isTemuImageError(error)) throw error;
    throw imageError("IMAGE_FILE_UNREADABLE", "本地图片文件无法安全读取。");
  }
}

function normalizeCloudinaryConfig(value) {
  const cloudName = cleanString(value?.cloudName);
  const uploadPreset = cleanString(value?.uploadPreset);
  if (!CLOUD_NAME_PATTERN.test(cloudName) || !UPLOAD_PRESET_PATTERN.test(uploadPreset)) {
    throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary unsigned upload 配置无效。");
  }
  return { cloudName, uploadPreset };
}

function isCloudinaryDeliveryUrl(value, cloudName) {
  if (!isPublicHttpsImageUrl(value)) return false;
  try {
    const url = new URL(value);
    const expectedPrefix = `/${cloudName}/image/upload/`;
    return url.hostname.toLowerCase() === CLOUDINARY_HOST &&
      !url.port &&
      url.pathname.startsWith(expectedPrefix) &&
      url.pathname.length > expectedPrefix.length;
  } catch {
    return false;
  }
}

function boundedInteger(value, fallback, minimum, maximum) {
  const number = Number(value);
  if (!Number.isFinite(number)) return fallback;
  return Math.min(maximum, Math.max(minimum, Math.trunc(number)));
}

async function cancelResponse(response) {
  try {
    const cancellation = response?.body?.cancel();
    cancellation?.catch?.(() => {});
  } catch {
    // Cancellation is best-effort; response details are intentionally discarded.
  }
}

function awaitWithAbort(promise, signal) {
  if (!signal) return promise;
  if (signal.aborted) {
    return Promise.reject(imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 图片上传请求超时。"));
  }
  return new Promise((resolvePromise, rejectPromise) => {
    const onAbort = () => rejectPromise(imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 图片上传请求超时。"));
    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolvePromise(value);
      },
      (error) => {
        signal.removeEventListener("abort", onAbort);
        rejectPromise(error);
      },
    );
  });
}

async function readBoundedResponseText(response, maxBytes, signal) {
  const declaredLength = Number(response.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    await cancelResponse(response);
    throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 上传响应超过允许大小。");
  }
  if (!response.body?.getReader) {
    const text = await awaitWithAbort(response.text(), signal);
    if (Buffer.byteLength(text, "utf8") > maxBytes) {
      throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 上传响应超过允许大小。");
    }
    return text;
  }

  const reader = response.body.getReader();
  const chunks = [];
  let totalBytes = 0;
  try {
    while (true) {
      const { done, value } = await awaitWithAbort(reader.read(), signal);
      if (done) break;
      totalBytes += value.byteLength;
      if (totalBytes > maxBytes) {
        await reader.cancel();
        throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 上传响应超过允许大小。");
      }
      chunks.push(Buffer.from(value));
    }
  } catch (error) {
    if (signal?.aborted) {
      reader.cancel().catch(() => {});
    }
    if (isTemuImageError(error)) throw error;
    throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 上传响应无法读取。");
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // A timed-out custom stream may keep a read pending; it has already been cancelled.
    }
  }
  return Buffer.concat(chunks, totalBytes).toString("utf8");
}

function createUploadForm(localImage, uploadPreset) {
  if (!Buffer.isBuffer(localImage?.bytes) || localImage.bytes.length !== localImage.size) {
    throw imageError("IMAGE_UPLOAD_FAILED", "本地图片未通过安全检查。");
  }
  const body = new FormData();
  body.append("file", new Blob([localImage.bytes], { type: localImage.mimeType }), basename(localImage.relativePath));
  body.append("upload_preset", uploadPreset);
  return body;
}

export async function uploadTemuImageToCloudinary({
  localImage,
  cloudinary,
  fetchImpl = globalThis.fetch,
  maxAttempts = DEFAULT_UPLOAD_ATTEMPTS,
  timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_RESPONSE_BYTES,
} = {}) {
  const config = normalizeCloudinaryConfig(cloudinary);
  if (typeof fetchImpl !== "function") {
    throw imageError("IMAGE_UPLOAD_FAILED", "当前运行时不支持 Cloudinary 图片上传。");
  }
  const attempts = boundedInteger(maxAttempts, DEFAULT_UPLOAD_ATTEMPTS, 1, 3);
  const requestTimeoutMs = boundedInteger(timeoutMs, DEFAULT_UPLOAD_TIMEOUT_MS, 1, 60_000);
  const responseLimit = boundedInteger(maxResponseBytes, DEFAULT_RESPONSE_BYTES, 1, 2 * 1024 * 1024);
  const endpoint = `https://api.cloudinary.com/v1_1/${config.cloudName}/image/upload`;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);
    let response;
    try {
      response = await awaitWithAbort(fetchImpl(endpoint, {
        method: "POST",
        body: createUploadForm(localImage, config.uploadPreset),
        redirect: "error",
        signal: controller.signal,
      }), controller.signal);
    } catch {
      clearTimeout(timeout);
      if (attempt < attempts) continue;
      throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 图片上传请求失败。");
    }

    if (!response?.ok) {
      const retryable = response?.status === 408 || response?.status === 429 || response?.status >= 500;
      await cancelResponse(response);
      clearTimeout(timeout);
      if (retryable && attempt < attempts) continue;
      throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 图片上传未成功。");
    }

    let payload;
    try {
      const responseText = await readBoundedResponseText(response, responseLimit, controller.signal);
      payload = JSON.parse(responseText);
    } catch (error) {
      clearTimeout(timeout);
      if (isTemuImageError(error)) throw error;
      throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 上传响应格式无效。");
    }
    if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
      clearTimeout(timeout);
      throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 上传响应格式无效。");
    }

    const secureUrl = cleanString(payload.secure_url);
    if (secureUrl.length > 8192 || !isCloudinaryDeliveryUrl(secureUrl, config.cloudName)) {
      clearTimeout(timeout);
      throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 上传响应未包含有效安全图片地址。");
    }
    clearTimeout(timeout);
    return {
      url: secureUrl,
      secureUrl,
      cloudName: config.cloudName,
      assetId: cleanString(payload.asset_id).slice(0, 512),
      publicId: cleanString(payload.public_id).slice(0, 1024),
      uploadedAt: new Date().toISOString(),
      source: "cloudinary-upload",
    };
  }

  throw imageError("IMAGE_UPLOAD_FAILED", "Cloudinary 图片上传请求失败。");
}

function itemCacheKey(requirement) {
  const stableId = cleanString(requirement?.item?.itemId || requirement?.item?.id);
  if (stableId) return stableId;
  const itemKey = cleanString(requirement?.itemKey);
  const setPrefix = `${cleanString(requirement?.setId)}:`;
  return itemKey.startsWith(setPrefix) ? itemKey.slice(setPrefix.length) : itemKey;
}

function getSetId(set) {
  return cleanString(set?.setId || set?.id);
}

function getCacheEntry(set, key) {
  if (!key || Number(set?.temuExcelImageCache?.version) !== 1) return null;
  const entries = set.temuExcelImageCache.entries;
  if (entries instanceof Map) return entries.get(key) || null;
  if (!entries || typeof entries !== "object" || Array.isArray(entries)) return null;
  return Object.prototype.hasOwnProperty.call(entries, key) ? entries[key] : null;
}

function isReusableCacheEntry(entry, localImage, requestedCloudName) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return false;
  const cloudName = cleanString(entry.cloudName);
  return Boolean(
    cloudName &&
    (!requestedCloudName || cloudName === requestedCloudName) &&
    cleanString(entry.sourceRelativePath).replace(/\\/gu, "/") === localImage.relativePath &&
    cleanString(entry.sourceSha256) === localImage.sourceSha256 &&
    isCloudinaryDeliveryUrl(entry.secureUrl, cloudName)
  );
}

function publicItemUrl(item) {
  for (const key of ["temuPublicUrl", "publicUrl", "secureUrl", "imageUrl"]) {
    const value = cleanString(item?.[key]);
    if (isPublicHttpsImageUrl(value)) return value;
  }
  return "";
}

function addCacheEntry(cacheEntriesBySet, setId, cacheKey, entry) {
  if (!setId || !cacheKey) return;
  if (!cacheEntriesBySet.has(setId)) cacheEntriesBySet.set(setId, new Map());
  cacheEntriesBySet.get(setId).set(cacheKey, entry);
}

function cacheEntryFromUpload(localImage, upload) {
  return {
    sourceRelativePath: localImage.relativePath,
    sourceSha256: localImage.sourceSha256,
    cloudName: upload.cloudName,
    secureUrl: upload.secureUrl,
    assetId: upload.assetId,
    publicId: upload.publicId,
    uploadedAt: upload.uploadedAt,
  };
}

function unresolvedImageResult(code, message, suggestion) {
  return {
    url: "",
    code,
    source: "local-image",
    message,
    suggestion,
  };
}

async function runWorkerPool(items, worker, concurrency) {
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
}

export async function resolveTemuImageRequirements({
  requirements = [],
  sets = [],
  outputDir,
  cloudinary = null,
  fetchImpl = globalThis.fetch,
  maxConcurrency = DEFAULT_RESOLVE_CONCURRENCY,
  maxAttempts = DEFAULT_UPLOAD_ATTEMPTS,
  timeoutMs = DEFAULT_UPLOAD_TIMEOUT_MS,
  maxResponseBytes = DEFAULT_RESPONSE_BYTES,
} = {}) {
  const uniqueRequirements = new Map();
  for (const requirement of Array.isArray(requirements) ? requirements : []) {
    const key = cleanString(requirement?.itemKey);
    if (key && !uniqueRequirements.has(key)) uniqueRequirements.set(key, requirement);
  }
  if (uniqueRequirements.size > TEMU_EXPORT_LIMITS.maxUniqueImages) {
    throw imageError(
      "IMAGE_LIMIT_EXCEEDED",
      `Temu 导出唯一图片不得超过 ${TEMU_EXPORT_LIMITS.maxUniqueImages} 张。`,
    );
  }

  const results = new Map();
  const cacheEntriesBySet = new Map();
  const setsById = new Map((Array.isArray(sets) ? sets : []).map((set) => [getSetId(set), set]));
  const inspectedRequirements = [];

  // Complete all local size and path checks before the first network upload.
  for (const [itemKey, requirement] of uniqueRequirements) {
    const directUrl = publicItemUrl(requirement?.item);
    if (directUrl) {
      results.set(itemKey, { url: directUrl, source: "saved-public-url" });
      continue;
    }

    const relativePath = cleanString(requirement?.item?.relativePath);
    if (!relativePath) {
      results.set(itemKey, unresolvedImageResult(
        "MISSING_PUBLIC_IMAGE_URL",
        "图片没有可复用的公网 HTTPS 地址或本地输出文件。",
        "补充公网 HTTPS 图片 URL，或重新生成本地图片后导出。",
      ));
      continue;
    }

    try {
      const localImage = await inspectLocalTemuImage({ outputDir, relativePath });
      inspectedRequirements.push({ itemKey, requirement, localImage });
    } catch (error) {
      if (error?.code === "IMAGE_FILE_TOO_LARGE") throw error;
      results.set(itemKey, unresolvedImageResult(
        cleanString(error?.code) || "IMAGE_FILE_UNREADABLE",
        isTemuImageError(error) ? error.message : "本地图片文件无法安全读取。",
        "检查套图记录中的图片文件后重新导出。",
      ));
    }
  }

  const pendingUploads = [];
  for (const inspected of inspectedRequirements) {
    const { itemKey, requirement, localImage } = inspected;
    const setId = cleanString(requirement?.setId);
    const cacheKey = itemCacheKey(requirement);
    const set = setsById.get(setId);
    const cached = getCacheEntry(set, cacheKey);
    if (isReusableCacheEntry(cached, localImage, cleanString(cloudinary?.cloudName))) {
      results.set(itemKey, {
        url: cleanString(cached.secureUrl),
        source: "cloudinary-cache",
        sourceSha256: localImage.sourceSha256,
      });
      continue;
    }
    if (!cloudinary) {
      results.set(itemKey, unresolvedImageResult(
        "MISSING_PUBLIC_IMAGE_URL",
        "本地图片尚未发布为公网 HTTPS 地址，且未配置 Cloudinary unsigned upload。",
        "配置 Cloudinary cloudName 和 unsigned uploadPreset，或手工补入公网图片 URL。",
      ));
      continue;
    }
    pendingUploads.push(inspected);
  }

  if (pendingUploads.length > 0) normalizeCloudinaryConfig(cloudinary);
  const uploadByFingerprint = new Map();
  const concurrency = boundedInteger(maxConcurrency, DEFAULT_RESOLVE_CONCURRENCY, 1, 8);
  await runWorkerPool(pendingUploads, async ({ itemKey, requirement, localImage }) => {
    let uploadPromise = uploadByFingerprint.get(localImage.sourceSha256);
    if (!uploadPromise) {
      uploadPromise = uploadTemuImageToCloudinary({
        localImage,
        cloudinary,
        fetchImpl,
        maxAttempts,
        timeoutMs,
        maxResponseBytes,
      });
      uploadByFingerprint.set(localImage.sourceSha256, uploadPromise);
    }
    try {
      const upload = await uploadPromise;
      results.set(itemKey, {
        url: upload.secureUrl,
        source: "cloudinary-upload",
        sourceSha256: localImage.sourceSha256,
      });
      addCacheEntry(
        cacheEntriesBySet,
        cleanString(requirement?.setId),
        itemCacheKey(requirement),
        cacheEntryFromUpload(localImage, upload),
      );
    } catch {
      results.set(itemKey, unresolvedImageResult(
        "IMAGE_UPLOAD_FAILED",
        "Cloudinary 图片上传失败，未使用任何未验证的上游地址。",
        "检查网络和 unsigned upload preset 后重试，或手工补入公网 HTTPS 图片 URL。",
      ));
    }
  }, concurrency);

  return { results, cacheEntriesBySet };
}

function normalizeCacheEntry(rawEntry) {
  if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) return null;
  return {
    sourceRelativePath: cleanString(rawEntry.sourceRelativePath).replace(/\\/gu, "/"),
    sourceSha256: cleanString(rawEntry.sourceSha256),
    cloudName: cleanString(rawEntry.cloudName),
    secureUrl: cleanString(rawEntry.secureUrl),
    assetId: cleanString(rawEntry.assetId),
    publicId: cleanString(rawEntry.publicId),
    uploadedAt: cleanString(rawEntry.uploadedAt),
  };
}

function copyEntries(value) {
  const output = {};
  const sourceEntries = value instanceof Map
    ? value
    : Object.entries(value && typeof value === "object" && !Array.isArray(value) ? value : {});
  for (const [rawKey, rawEntry] of sourceEntries) {
    const key = cleanString(rawKey);
    const entry = normalizeCacheEntry(rawEntry);
    if (!key || !entry) continue;
    Object.defineProperty(output, key, {
      value: entry,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return output;
}

export function mergeTemuImageCache(set, newEntries = new Map()) {
  const existingEntries = Number(set?.temuExcelImageCache?.version) === 1
    ? set.temuExcelImageCache.entries
    : null;
  const entries = copyEntries(existingEntries);
  const additions = newEntries instanceof Map
    ? newEntries
    : Object.entries(newEntries && typeof newEntries === "object" ? newEntries : {});
  for (const [rawKey, rawEntry] of additions) {
    const key = cleanString(rawKey);
    if (!key || !rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) continue;
    const entry = normalizeCacheEntry(rawEntry);
    if (!entry) continue;
    Object.defineProperty(entries, key, {
      value: entry,
      enumerable: true,
      configurable: true,
      writable: true,
    });
  }
  return {
    ...set,
    temuExcelImageCache: {
      version: 1,
      entries,
    },
  };
}
