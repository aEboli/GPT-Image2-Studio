import { mkdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

import { createJimp } from "@jimp/core";
import decodeWebp, { init as initWebpDecoder } from "@jsquash/webp/decode.js";
import encodeWebp, { init as initWebpEncoder } from "@jsquash/webp/encode.js";
import { defaultFormats, defaultPlugins } from "jimp";

const THUMBNAIL_MAX_EDGE = 512;
const THUMBNAIL_QUALITY = 72;
const THUMBNAIL_DIRNAME = "thumbnails";
const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const require = createRequire(import.meta.url);
const webpPackageDir = dirname(require.resolve("@jsquash/webp/package.json"));
const thumbnailGenerationPromises = new Map();
const scheduledThumbnailPromises = new Map();
let thumbnailQueue = Promise.resolve();
let webpCodecInitialization = null;

function normalizeRelativePath(value) {
  const rawValue = String(value || "").replace(/\\/g, "/");
  if (
    !rawValue ||
    rawValue.includes("\0") ||
    rawValue.includes(":") ||
    rawValue.startsWith("/") ||
    /^[a-z]:($|\/)/i.test(rawValue)
  ) {
    return "";
  }

  const segments = rawValue.split("/").filter(Boolean);

  if (segments.length === 0 || segments.some((segment) => segment === "." || segment === "..")) {
    return "";
  }

  return segments.join("/");
}

function resolvePathWithin(baseDir, relativePath) {
  const normalizedRelativePath = normalizeRelativePath(relativePath);
  if (!normalizedRelativePath) {
    return null;
  }

  const normalizedBaseDir = resolve(baseDir);
  const targetPath = resolve(normalizedBaseDir, ...normalizedRelativePath.split("/"));
  const backToBase = relative(normalizedBaseDir, targetPath);
  if (backToBase.startsWith("..") || isAbsolute(backToBase)) {
    return null;
  }

  return targetPath;
}

function isGalleryImageRelativePath(relativeImagePath) {
  const normalizedRelativePath = normalizeRelativePath(relativeImagePath);
  if (!normalizedRelativePath || normalizedRelativePath.startsWith("json/")) {
    return false;
  }

  return IMAGE_EXTENSIONS.has(extname(normalizedRelativePath).toLowerCase());
}

async function readWebpModule(relativePath) {
  return WebAssembly.compile(await readFile(join(webpPackageDir, ...relativePath)));
}

async function ensureWebpCodecInitialized() {
  if (!webpCodecInitialization) {
    webpCodecInitialization = (async () => {
      const [encoderModule, decoderModule] = await Promise.all([
        readWebpModule(["codec", "enc", "webp_enc_simd.wasm"]),
        readWebpModule(["codec", "dec", "webp_dec.wasm"]),
      ]);
      await initWebpEncoder(encoderModule);
      await initWebpDecoder(decoderModule);
    })().catch((error) => {
      webpCodecInitialization = null;
      throw error;
    });
  }

  return webpCodecInitialization;
}

const galleryWebpFormat = () => ({
  mime: "image/webp",
  hasAlpha: true,
  async encode(bitmap, options = {}) {
    await ensureWebpCodecInitialized();
    const sourceData = new Uint8ClampedArray(bitmap.data.buffer, bitmap.data.byteOffset, bitmap.data.byteLength);
    const encoded = await encodeWebp(
      {
        data: sourceData,
        width: bitmap.width,
        height: bitmap.height,
      },
      {
        quality: Number(options.quality) || THUMBNAIL_QUALITY,
        method: Number(options.method) || 4,
      },
    );
    return Buffer.from(encoded);
  },
  async decode(data) {
    await ensureWebpCodecInitialized();
    const source = Buffer.isBuffer(data) ? data : Buffer.from(data);
    const sourceBuffer = source.buffer.slice(source.byteOffset, source.byteOffset + source.byteLength);
    const decoded = await decodeWebp(sourceBuffer);
    return {
      data: Buffer.from(decoded.data.buffer, decoded.data.byteOffset, decoded.data.byteLength),
      width: decoded.width,
      height: decoded.height,
    };
  },
});

const GalleryThumbnailJimp = createJimp({
  formats: [...defaultFormats, galleryWebpFormat],
  plugins: defaultPlugins,
});

function thumbnailRelativePathFor(relativeImagePath) {
  const normalizedRelativePath = normalizeRelativePath(relativeImagePath);
  return normalizedRelativePath ? `json/${THUMBNAIL_DIRNAME}/${normalizedRelativePath}.webp` : "";
}

function isMissingFileError(error) {
  return Boolean(error && typeof error === "object" && error.code === "ENOENT");
}

async function fileExists(filePath) {
  try {
    await stat(filePath);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

async function createGalleryThumbnail(sourcePath, thumbnailPath) {
  const image = await GalleryThumbnailJimp.read(await readFile(sourcePath));
  if (Math.max(image.bitmap.width, image.bitmap.height) > THUMBNAIL_MAX_EDGE) {
    image.scaleToFit({ w: THUMBNAIL_MAX_EDGE, h: THUMBNAIL_MAX_EDGE });
  }

  const buffer = await image.getBuffer("image/webp", {
    quality: THUMBNAIL_QUALITY,
    method: 4,
  });
  await mkdir(dirname(thumbnailPath), { recursive: true });
  const temporaryPath = `${thumbnailPath}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(temporaryPath, buffer);
  await rename(temporaryPath, thumbnailPath);
}

export function resolveGalleryImageAsset({ outputDir, relativeImagePath }) {
  const normalizedRelativePath = normalizeRelativePath(relativeImagePath);
  if (!isGalleryImageRelativePath(normalizedRelativePath)) {
    return null;
  }

  const sourcePath = resolvePathWithin(outputDir, normalizedRelativePath);
  const thumbnailRelativePath = thumbnailRelativePathFor(normalizedRelativePath);
  const thumbnailPath = resolvePathWithin(outputDir, thumbnailRelativePath);
  if (!sourcePath || !thumbnailPath) {
    return null;
  }

  return {
    relativeImagePath: normalizedRelativePath,
    sourcePath,
    thumbnailRelativePath,
    thumbnailPath,
  };
}

export function buildGalleryThumbnailUrl(relativeImagePath, createdAt) {
  const normalizedRelativePath = normalizeRelativePath(relativeImagePath);
  if (!isGalleryImageRelativePath(normalizedRelativePath)) {
    return "";
  }

  const query = new URLSearchParams({
    path: normalizedRelativePath,
    v: String(createdAt || ""),
  });
  return `/api/gallery/thumbnail?${query.toString()}`;
}

export async function ensureGalleryThumbnail({ outputDir, relativeImagePath }) {
  const asset = resolveGalleryImageAsset({ outputDir, relativeImagePath });
  if (!asset) {
    return null;
  }

  try {
    if (await fileExists(asset.thumbnailPath)) {
      return asset;
    }
  } catch {
    return null;
  }

  const existingPromise = thumbnailGenerationPromises.get(asset.thumbnailPath);
  if (existingPromise) {
    return existingPromise;
  }

  const generationPromise = (async () => {
    try {
      if (!(await fileExists(asset.sourcePath))) {
        return null;
      }
      if (!(await fileExists(asset.thumbnailPath))) {
        await createGalleryThumbnail(asset.sourcePath, asset.thumbnailPath);
      }
      return asset;
    } catch {
      return null;
    } finally {
      thumbnailGenerationPromises.delete(asset.thumbnailPath);
    }
  })();
  thumbnailGenerationPromises.set(asset.thumbnailPath, generationPromise);
  return generationPromise;
}

export function scheduleGalleryThumbnail(options) {
  const asset = resolveGalleryImageAsset(options);
  if (!asset) {
    return Promise.resolve(null);
  }

  const existingPromise = scheduledThumbnailPromises.get(asset.thumbnailPath);
  if (existingPromise) {
    return existingPromise;
  }

  const scheduledPromise = (async () => {
    try {
      if (await fileExists(asset.thumbnailPath)) {
        return asset;
      }
    } catch {
      return null;
    }

    const queuedPromise = thumbnailQueue
      .catch(() => null)
      .then(() => ensureGalleryThumbnail(options))
      .catch(() => null);
    thumbnailQueue = queuedPromise;
    return queuedPromise;
  })();
  scheduledThumbnailPromises.set(asset.thumbnailPath, scheduledPromise);
  scheduledPromise.finally(() => {
    if (scheduledThumbnailPromises.get(asset.thumbnailPath) === scheduledPromise) {
      scheduledThumbnailPromises.delete(asset.thumbnailPath);
    }
  });
  return scheduledPromise;
}

export async function deleteGalleryThumbnail({ outputDir, relativeImagePath }) {
  const asset = resolveGalleryImageAsset({ outputDir, relativeImagePath });
  if (!asset) {
    return false;
  }

  try {
    await unlink(asset.thumbnailPath);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}

export async function moveGalleryThumbnail({ outputDir, fromRelativeImagePath, toRelativeImagePath }) {
  const fromAsset = resolveGalleryImageAsset({ outputDir, relativeImagePath: fromRelativeImagePath });
  const toAsset = resolveGalleryImageAsset({ outputDir, relativeImagePath: toRelativeImagePath });
  if (!fromAsset || !toAsset) {
    return false;
  }

  try {
    await mkdir(dirname(toAsset.thumbnailPath), { recursive: true });
    await rename(fromAsset.thumbnailPath, toAsset.thumbnailPath);
    return true;
  } catch (error) {
    if (isMissingFileError(error)) {
      return false;
    }
    throw error;
  }
}
