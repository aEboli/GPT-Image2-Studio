import { randomUUID } from "node:crypto";
import { mkdir, open, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);
const IMAGE_OUTPUT_DIRNAME = "prompt";
const METADATA_DIRNAME = "json";
const FILENAME_FALLBACK_KEYWORD = "未命名";
const galleryIndexLocks = new Map();
const FILENAME_PRIORITY_TERMS = [
  "直播",
  "带货",
  "礼盒",
  "护肤",
  "服饰",
  "汉服",
  "耳机",
  "数码",
  "产品",
  "城市",
  "夜景",
  "电商",
  "主播",
  "上新",
  "展示",
];
const FILENAME_GENERIC_TERMS = [
  "主视觉",
  "宣传图",
  "海报",
  "封面",
  "图片",
  "图像",
  "画面",
  "效果图",
  "壁纸",
  "写真",
  "照片",
  "风格",
];
const FILENAME_DISMISSIBLE_TERMS = [
  "主视觉",
  "宣传图",
  "海报",
  "封面图",
  "封面",
  "图片",
  "图像",
  "画面",
  "效果图",
  "壁纸",
  "写真",
  "照片",
  "商业摄影",
  "写实风格",
  "写实风",
  "写实",
  "直播间",
];
const FILENAME_LEADING_DESCRIPTORS = [
  "美女",
  "帅哥",
  "女主播",
  "男主播",
  "主播",
  "抖音",
  "中国风",
];
const STORED_STRING_METADATA_FIELDS = [
  "prompt",
  "createdAt",
  "baseUrl",
  "imageRoute",
  "responsesModel",
  "imageModel",
  "endpointPath",
  "generationMode",
  "styleTransferSourceImageName",
  "styleTransferReferenceImageName",
  "styleTransferStylePreset",
  "quickBlendPairIndex",
  "quickBlendAImageName",
  "quickBlendBImageName",
  "quickBlendCImageName",
  "quickBlendDImageName",
  "quickBlendLayoutOrder",
  "quickBlendPlacementShape",
  "editInstruction",
  "editMode",
  "executionStrategy",
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
  "assetKind",
  "deckId",
  "slideNumber",
  "creationSetId",
  "creationItemId",
  "creationRole",
  "portraitSetId",
  "portraitItemId",
  "portraitStyle",
  "portraitShotType",
  "subjectName",
  "subjectSummary",
  "targetLanguage",
  "sourceImageName",
];

function normalizeStoredBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value || "").trim().toLowerCase();
  return normalized === "1" || normalized === "true" || normalized === "on" || normalized === "yes";
}

function normalizeStoredRegionInstructions(value) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((region, position) => {
      const index = Number.parseInt(String(region?.index || position + 1), 10);
      const resolvedIndex = Number.isFinite(index) && index > 0 ? index : position + 1;
      const instruction = String(region?.instruction || "").trim();
      if (!instruction) {
        return null;
      }

      return {
        id: String(region?.id || `region-${resolvedIndex}`).trim() || `region-${resolvedIndex}`,
        index: resolvedIndex,
        color: String(region?.color || "#f5506e").trim() || "#f5506e",
        instruction,
        hasMask: region?.hasMask !== false,
      };
    })
    .filter(Boolean);
}

function pad(value) {
  return String(value).padStart(2, "0");
}

function normalizeDateValue(dateLike, fallback = new Date()) {
  const date = new Date(dateLike);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

export function formatDateFolder(dateLike) {
  const date = normalizeDateValue(dateLike);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function formatMonthFolder(dateLike) {
  const date = normalizeDateValue(dateLike);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

export function formatDayFolder(dateLike) {
  const date = normalizeDateValue(dateLike);
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function formatCompactHourMinutePart(dateLike) {
  const date = normalizeDateValue(dateLike);
  return `${pad(date.getHours())}${pad(date.getMinutes())}`;
}

function normalizeRelativePath(relativePath) {
  return String(relativePath || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function sanitizeFilenamePart(value) {
  return String(value || "")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "")
    .trim();
}

function stripPromptBoilerplate(prompt) {
  let result = String(prompt || "").trim();
  result = result.replace(/^(请|帮我|麻烦|需要)?\s*(生成|制作|做|来|给我)\s*(一张|一幅|一个|一组|一套|一版)?/u, "");

  for (const term of FILENAME_DISMISSIBLE_TERMS) {
    result = result.replaceAll(term, " ");
  }

  result = result
    .replace(/[“”‘’【】（）《》〈〉「」『』]/g, " ")
    .replace(/[!,.;:?~`@#$%^&*+=_|/\\-]+/g, " ")
    .replace(/[，。！？；：、]/g, " ")
    .replace(/\s+/g, " ")
    .replace(/的/g, "")
    .trim();

  return result;
}

function stripLeadingDescriptors(value) {
  let result = String(value || "");

  let changed = true;
  while (changed && result.length > 0) {
    changed = false;
    for (const descriptor of FILENAME_LEADING_DESCRIPTORS) {
      if (result.startsWith(descriptor)) {
        result = result.slice(descriptor.length);
        changed = true;
      }
    }
  }

  return result;
}

function scoreChineseCandidate(candidate, start) {
  let score = start === 0 ? 1 : 0;

  if (candidate.length === 4) {
    score += 1;
  } else if (candidate.length === 5) {
    score += 0.5;
  }

  for (const term of FILENAME_PRIORITY_TERMS) {
    if (candidate.includes(term)) {
      score += 3;
    }
  }

  for (const term of FILENAME_GENERIC_TERMS) {
    if (candidate.includes(term)) {
      score -= 4;
    }
  }

  return score;
}

function extractChineseKeyword(value) {
  const hanOnly = (String(value || "").match(/\p{Script=Han}+/gu) || []).join("");
  if (!hanOnly) {
    return "";
  }

  if (hanOnly.length <= 5) {
    return hanOnly;
  }

  const maxLength = Math.min(5, hanOnly.length);
  let best = {
    candidate: hanOnly.slice(0, Math.min(4, hanOnly.length)),
    score: Number.NEGATIVE_INFINITY,
    start: 0,
    length: Math.min(4, hanOnly.length),
  };

  for (let length = 4; length <= maxLength; length += 1) {
    for (let start = 0; start + length <= hanOnly.length; start += 1) {
      const candidate = hanOnly.slice(start, start + length);
      const score = scoreChineseCandidate(candidate, start);

      if (
        score > best.score ||
        (score === best.score && start < best.start) ||
        (score === best.score && start === best.start && length < best.length)
      ) {
        best = { candidate, score, start, length };
      }
    }
  }

  return best.candidate;
}

function extractReadableKeyword(prompt) {
  const normalized = stripPromptBoilerplate(prompt);
  if (!normalized) {
    return FILENAME_FALLBACK_KEYWORD;
  }

  const segments = normalized
    .split(/\s+/)
    .map((segment) => stripLeadingDescriptors(sanitizeFilenamePart(segment)))
    .filter(Boolean);

  let bestKeyword = "";
  let bestScore = Number.NEGATIVE_INFINITY;

  for (const segment of segments) {
    const chineseKeyword = extractChineseKeyword(segment);
    if (chineseKeyword) {
      const score = scoreChineseCandidate(chineseKeyword, 0);
      if (score > bestScore) {
        bestKeyword = chineseKeyword;
        bestScore = score;
      }
      continue;
    }

    const latinKeyword = sanitizeFilenamePart(segment).slice(0, 10);
    if (latinKeyword && bestScore < 0) {
      bestKeyword = latinKeyword;
      bestScore = 0;
    }
  }

  return sanitizeFilenamePart(bestKeyword) || FILENAME_FALLBACK_KEYWORD;
}

function extractIdTail(idSource) {
  const normalized = sanitizeFilenamePart(String(idSource || randomUUID()).replace(/\.[^.]+$/, "").toLowerCase()).replace(
    /[^a-z0-9]/g,
    "",
  );
  if (normalized.length >= 4) {
    return normalized.slice(-4);
  }

  return normalized.padStart(4, "0") || randomUUID().slice(-4);
}

function isReadableGeneratedFilename(filename) {
  const stem = basename(filename, extname(filename));
  return (
    /^\d{6}-.+-(?:\d{6}-[a-z0-9]{4}|[a-z0-9]{4}-\d{6})$/i.test(stem) ||
    /^\d{4}-.+-(?:\d{4}-)?[a-z0-9]{4}$/i.test(stem)
  );
}

function looksLikeGenericFilenameStem(stem) {
  const normalized = String(stem || "").trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    normalized.startsWith("generated-") ||
    normalized.startsWith("asset_") ||
    normalized.startsWith("asset-") ||
    /^img[-_ ]?\d+$/i.test(normalized)
  );
}

function deriveKeywordSourceFromFilename(filename) {
  const stem = basename(filename, extname(filename));
  if (isReadableGeneratedFilename(filename) || looksLikeGenericFilenameStem(stem)) {
    return "";
  }

  return stem.replace(/[_-]+/g, " ");
}

async function moveFileIfExists(fromPath, toPath) {
  try {
    await mkdir(dirname(toPath), { recursive: true });
    await rename(fromPath, toPath);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return false;
    }

    throw error;
  }
}

function createCollisionResistantFilename(filename, sequence) {
  if (sequence <= 1) {
    return filename;
  }

  const extension = extname(filename);
  const stem = basename(filename, extension);
  return `${stem}-${sequence}${extension}`;
}

function datedAssetDirName(createdAt, assetDirName) {
  return `${formatDateFolder(createdAt)}-${assetDirName}`;
}

function resolveDefaultImageOutputDirName(metadata = {}) {
  const generationMode = String(metadata.generationMode || "").trim();
  const assetKind = String(metadata.assetKind || "").trim();

  if (generationMode === "style-transfer") {
    return "style-transfer";
  }

  if (generationMode === "reference-analysis") {
    return "reference-analysis";
  }

  if (generationMode === "image-decomposition" || assetKind === "image-decomposition") {
    return "image-decomposition";
  }

  if (generationMode === "quick-blend" || assetKind === "quick-blend") {
    return "quick-blend";
  }

  if (generationMode === "image-edit" || assetKind === "image-edit") {
    return "image-edit";
  }

  return IMAGE_OUTPUT_DIRNAME;
}

function defaultImageRelativeDir(createdAt, metadata = {}) {
  const monthFolder = formatMonthFolder(createdAt);
  const dayFolder = formatDayFolder(createdAt);
  const outputDirName = resolveDefaultImageOutputDirName(metadata);
  return `${monthFolder}/${dayFolder}/${datedAssetDirName(createdAt, outputDirName)}`;
}

function relativeImagePathFor(filename, createdAt, relativeDir, metadata = {}) {
  const normalizedDir = normalizeRelativePath(relativeDir) || defaultImageRelativeDir(createdAt, metadata);
  return `${normalizedDir}/${filename}`;
}

function imagePathFor(filename, outputDir, createdAt, relativeDir, metadata = {}) {
  return join(outputDir, ...relativeImagePathFor(filename, createdAt, relativeDir, metadata).split("/"));
}

function metadataRelativePathFor(relativeImagePath) {
  const normalized = normalizeRelativePath(relativeImagePath);
  const segments = normalized.split("/").filter(Boolean);
  const filename = segments.pop() || "";
  const stem = basename(filename, extname(filename));
  return [METADATA_DIRNAME, ...segments, `${stem}.json`].join("/");
}

function metadataPathFor(relativeImagePath, outputDir) {
  return join(outputDir, ...metadataRelativePathFor(relativeImagePath).split("/"));
}

function legacyMetadataPathFor(filename, outputDir) {
  return join(outputDir, `${filename}.json`);
}

function encodePublicPath(relativePath) {
  return normalizeRelativePath(relativePath)
    .split("/")
    .filter(Boolean)
    .map(encodeURIComponent)
    .join("/");
}

export function buildPublicAssetUrl(publicBasePath, relativePath, createdAt) {
  return `${publicBasePath}/${encodePublicPath(relativePath)}?v=${encodeURIComponent(createdAt)}`;
}

function resolveIndexPath(outputDir, explicitIndexPath) {
  return explicitIndexPath || join(dirname(outputDir), ".local", "gallery-index.json");
}

async function readFileHeader(filePath, maxBytes = 256 * 1024) {
  const handle = await open(filePath, "r");
  try {
    const buffer = Buffer.alloc(maxBytes);
    const { bytesRead } = await handle.read(buffer, 0, maxBytes, 0);
    return buffer.subarray(0, bytesRead);
  } finally {
    await handle.close();
  }
}

function inferPngSize(buffer) {
  if (buffer.length < 24) {
    return "";
  }

  const signature = "89504e470d0a1a0a";
  if (buffer.subarray(0, 8).toString("hex") !== signature) {
    return "";
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return width > 0 && height > 0 ? `${width}x${height}` : "";
}

function inferJpegSize(buffer) {
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return "";
  }

  let offset = 2;
  while (offset + 9 < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let markerOffset = offset + 1;
    while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) {
      markerOffset += 1;
    }

    const marker = buffer[markerOffset];
    if (marker === undefined) {
      return "";
    }

    if (marker === 0xd8 || marker === 0xd9 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset = markerOffset + 1;
      continue;
    }

    const lengthOffset = markerOffset + 1;
    if (lengthOffset + 1 >= buffer.length) {
      return "";
    }

    const segmentLength = buffer.readUInt16BE(lengthOffset);
    if (segmentLength < 2) {
      return "";
    }

    const isStartOfFrame =
      (marker >= 0xc0 && marker <= 0xc3) ||
      (marker >= 0xc5 && marker <= 0xc7) ||
      (marker >= 0xc9 && marker <= 0xcb) ||
      (marker >= 0xcd && marker <= 0xcf);

    if (isStartOfFrame) {
      const frameOffset = lengthOffset + 2;
      if (frameOffset + 4 >= buffer.length) {
        return "";
      }

      const height = buffer.readUInt16BE(frameOffset + 1);
      const width = buffer.readUInt16BE(frameOffset + 3);
      return width > 0 && height > 0 ? `${width}x${height}` : "";
    }

    offset = lengthOffset + segmentLength;
  }

  return "";
}

async function inferImageSize(absolutePath, extension) {
  try {
    const buffer = await readFileHeader(absolutePath);

    if (extension === ".png") {
      return inferPngSize(buffer);
    }

    if (extension === ".jpg" || extension === ".jpeg") {
      return inferJpegSize(buffer);
    }
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ENOENT")) {
      throw error;
    }
  }

  return "";
}

async function readGalleryIndex(indexPath) {
  try {
    const raw = await readFile(indexPath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return {};
    }

    throw error;
  }
}

async function withGalleryIndexLock(indexPath, operation) {
  const key = String(indexPath);
  const previous = galleryIndexLocks.get(key) || Promise.resolve();
  let releaseCurrent;
  const current = new Promise((resolve) => {
    releaseCurrent = resolve;
  });
  const next = previous.catch(() => {}).then(() => current);
  galleryIndexLocks.set(key, next);

  await previous.catch(() => {});

  try {
    return await operation();
  } finally {
    releaseCurrent();
    if (galleryIndexLocks.get(key) === next) {
      galleryIndexLocks.delete(key);
    }
  }
}

async function writeGalleryIndex(indexPath, payload) {
  await mkdir(dirname(indexPath), { recursive: true });
  const tempPath = `${indexPath}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  await writeFile(tempPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  await rename(tempPath, indexPath);
}

async function readMetadataJson(filePath) {
  try {
    const raw = await readFile(filePath, "utf8");
    return JSON.parse(raw.replace(/^\uFEFF/, ""));
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }

    throw error;
  }
}

async function writeMetadataSidecar(outputDir, relativeImagePath, payload) {
  const filePath = metadataPathFor(relativeImagePath, outputDir);
  await mkdir(dirname(filePath), { recursive: true });
  await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
  return filePath;
}

async function readMetadataSidecar(outputDir, relativeImagePath) {
  return readMetadataJson(metadataPathFor(relativeImagePath, outputDir));
}

function metadataMatches(left = null, right = null) {
  return JSON.stringify(compactStoredMetadata(left) || null) === JSON.stringify(compactStoredMetadata(right) || null);
}

function normalizeStoredMetadata(metadata = {}, createdAt, filename) {
  const normalizedReferenceImageNames = Array.isArray(metadata.referenceImageNames)
    ? metadata.referenceImageNames.filter(Boolean).map((value) => String(value))
    : [];
  const normalizedReferenceImageName = String(
    metadata.referenceImageName || normalizedReferenceImageNames[0] || "",
  ).trim();
  const normalizedRegionInstructions = normalizeStoredRegionInstructions(metadata.regionInstructions);
  const numericRegionCount = Number.parseInt(String(metadata.regionCount || normalizedRegionInstructions.length), 10);
  const normalizedRegionCount = Number.isFinite(numericRegionCount) && numericRegionCount > 0
    ? numericRegionCount
    : normalizedRegionInstructions.length;

  return {
    prompt: String(metadata.prompt || ""),
    createdAt,
    baseUrl: String(metadata.baseUrl || ""),
    imageRoute: String(metadata.imageRoute || metadata.generationRoute || ""),
    responsesModel: String(metadata.responsesModel || ""),
    imageModel: String(metadata.imageModel || ""),
    endpointPath: String(metadata.endpointPath || ""),
    generationMode: String(metadata.generationMode || ""),
    styleTransferSourceImageName: String(metadata.styleTransferSourceImageName || ""),
    styleTransferReferenceImageName: String(metadata.styleTransferReferenceImageName || ""),
    styleTransferStylePreset: String(metadata.styleTransferStylePreset || ""),
    quickBlendPairIndex: String(metadata.quickBlendPairIndex || ""),
    quickBlendAImageName: String(metadata.quickBlendAImageName || ""),
    quickBlendBImageName: String(metadata.quickBlendBImageName || ""),
    quickBlendCImageName: String(metadata.quickBlendCImageName || ""),
    quickBlendDImageName: String(metadata.quickBlendDImageName || ""),
    quickBlendLayoutOrder: String(metadata.quickBlendLayoutOrder || ""),
    quickBlendPlacementShape: String(metadata.quickBlendPlacementShape || ""),
    editInstruction: String(metadata.editInstruction || ""),
    editMode: String(metadata.editMode || ""),
    executionStrategy: String(metadata.executionStrategy || ""),
    regionCount: normalizedRegionCount,
    regionInstructions: normalizedRegionInstructions,
    hasReferenceImage: Boolean(
      metadata.hasReferenceImage || normalizedReferenceImageName || normalizedReferenceImageNames.length > 0,
    ),
    referenceImageNames: normalizedReferenceImageNames,
    referenceImageName: normalizedReferenceImageName,
    ratio: String(metadata.ratio || ""),
    ratioLabel: String(metadata.ratioLabel || ""),
    size: String(metadata.size || ""),
    actualSize: String(metadata.actualSize || metadata.generatedSize || ""),
    quality: String(metadata.quality || ""),
    format: String(metadata.format || extname(filename).replace(/^\./, "")),
    reasoningEffort: String(metadata.reasoningEffort || ""),
    generationStartedAt: String(metadata.generationStartedAt || ""),
    generationCompletedAt: String(metadata.generationCompletedAt || ""),
    generationDurationMs: String(metadata.generationDurationMs || ""),
    assetKind: String(metadata.assetKind || ""),
    deckId: String(metadata.deckId || ""),
    slideNumber: String(metadata.slideNumber || ""),
    creationSetId: String(metadata.creationSetId || ""),
    creationItemId: String(metadata.creationItemId || ""),
    creationRole: String(metadata.creationRole || ""),
    portraitSetId: String(metadata.portraitSetId || ""),
    portraitItemId: String(metadata.portraitItemId || ""),
    portraitStyle: String(metadata.portraitStyle || ""),
    portraitShotType: String(metadata.portraitShotType || ""),
    subjectName: String(metadata.subjectName || ""),
    subjectSummary: String(metadata.subjectSummary || ""),
    targetLanguage: String(metadata.targetLanguage || ""),
    sourceImageName: String(metadata.sourceImageName || ""),
    selectedStyles: Array.isArray(metadata.selectedStyles)
      ? metadata.selectedStyles.map((value) => String(value).trim()).filter(Boolean)
      : [],
    featureCardsEnabled: normalizeStoredBoolean(metadata.featureCardsEnabled),
    galleryVisible: metadata.galleryVisible !== false && String(metadata.galleryVisible || "").toLowerCase() !== "false",
  };
}

function compactStoredMetadata(metadata = {}) {
  const source = metadata && typeof metadata === "object" ? metadata : {};
  const result = {};

  for (const field of STORED_STRING_METADATA_FIELDS) {
    const value = String(source[field] || "").trim();
    if (value) {
      result[field] = value;
    }
  }

  const referenceImageNames = Array.isArray(source.referenceImageNames)
    ? [...new Set(source.referenceImageNames.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  const referenceImageName = String(source.referenceImageName || referenceImageNames[0] || "").trim();

  if (referenceImageNames.length > 0) {
    result.referenceImageNames = referenceImageNames;
  }

  if (referenceImageName) {
    result.referenceImageName = referenceImageName;
  }

  const selectedStyles = Array.isArray(source.selectedStyles)
    ? [...new Set(source.selectedStyles.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  if (selectedStyles.length > 0) {
    result.selectedStyles = selectedStyles;
  }

  const regionInstructions = normalizeStoredRegionInstructions(source.regionInstructions);
  const regionCount = Number.parseInt(String(source.regionCount || regionInstructions.length), 10);
  if (Number.isFinite(regionCount) && regionCount > 0) {
    result.regionCount = regionCount;
  } else if (regionInstructions.length > 0) {
    result.regionCount = regionInstructions.length;
  }
  if (regionInstructions.length > 0) {
    result.regionInstructions = regionInstructions;
  }

  if (Boolean(source.hasReferenceImage || referenceImageNames.length > 0 || referenceImageName)) {
    result.hasReferenceImage = true;
  }

  if (Object.hasOwn(source, "featureCardsEnabled")) {
    result.featureCardsEnabled = normalizeStoredBoolean(source.featureCardsEnabled);
  }

  if (source.galleryVisible === false || String(source.galleryVisible || "").toLowerCase() === "false") {
    result.galleryVisible = false;
  }

  return result;
}

function mergeMetadataPatch(baseMetadata = {}, patchMetadata = {}, createdAt, filename) {
  const merged = normalizeStoredMetadata(baseMetadata, createdAt, filename);

  for (const field of STORED_STRING_METADATA_FIELDS) {
    const nextValue = String(patchMetadata[field] || "").trim();
    if (nextValue) {
      merged[field] = nextValue;
    }
  }

  const patchedReferenceImageNames = Array.isArray(patchMetadata.referenceImageNames)
    ? [...new Set(patchMetadata.referenceImageNames.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  if (patchedReferenceImageNames.length > 0) {
    merged.referenceImageNames = patchedReferenceImageNames;
  }

  const patchedReferenceImageName = String(
    patchMetadata.referenceImageName || merged.referenceImageNames[0] || "",
  ).trim();
  if (patchedReferenceImageName) {
    merged.referenceImageName = patchedReferenceImageName;
  }

  const patchedSelectedStyles = Array.isArray(patchMetadata.selectedStyles)
    ? [...new Set(patchMetadata.selectedStyles.map((value) => String(value).trim()).filter(Boolean))]
    : [];
  if (patchedSelectedStyles.length > 0) {
    merged.selectedStyles = patchedSelectedStyles;
  }

  const patchedRegionInstructions = normalizeStoredRegionInstructions(patchMetadata.regionInstructions);
  const patchedRegionCount = Number.parseInt(
    String(patchMetadata.regionCount || patchedRegionInstructions.length),
    10,
  );
  if (patchedRegionInstructions.length > 0) {
    merged.regionInstructions = patchedRegionInstructions;
  }
  if (Number.isFinite(patchedRegionCount) && patchedRegionCount > 0) {
    merged.regionCount = patchedRegionCount;
  } else if (patchedRegionInstructions.length > 0) {
    merged.regionCount = patchedRegionInstructions.length;
  }

  merged.hasReferenceImage = Boolean(
    merged.hasReferenceImage ||
      patchMetadata.hasReferenceImage ||
      merged.referenceImageNames.length > 0 ||
      merged.referenceImageName,
  );

  if (Object.hasOwn(patchMetadata, "featureCardsEnabled")) {
    merged.featureCardsEnabled = normalizeStoredBoolean(patchMetadata.featureCardsEnabled);
  }

  if (!merged.referenceImageName && merged.referenceImageNames.length > 0) {
    merged.referenceImageName = merged.referenceImageNames[0];
  }

  return merged;
}

async function readLegacyMetadata(filename, outputDir) {
  return readMetadataJson(legacyMetadataPathFor(filename, outputDir));
}

export function createTimestampedFilename(input, overrides = {}) {
  const options =
    typeof input === "string"
      ? {
          format: input,
          ...overrides,
        }
      : input || {};

  const createdAt = normalizeDateValue(options.createdAt);
  const format = String(options.format || "png")
    .trim()
    .replace(/^\./, "")
    .toLowerCase();
  const keyword = sanitizeFilenamePart(options.filenameKeyword).slice(0, 100) || extractReadableKeyword(options.prompt);
  const idTail = extractIdTail(options.idSource);

  return `${formatCompactHourMinutePart(createdAt)}-${keyword}-${idTail}.${format || "png"}`;
}

export async function renameGalleryAssets({
  outputDir,
  indexPath,
}) {
  await mkdir(outputDir, { recursive: true });
  const resolvedIndexPath = resolveIndexPath(outputDir, indexPath);
  const metadataIndex = await readGalleryIndex(resolvedIndexPath);
  const imageEntries = (await collectImageEntries(outputDir)).sort((left, right) =>
    left.relativePath.localeCompare(right.relativePath),
  );
  const reservedByFolder = new Map();
  const renamed = [];
  let metadataChanged = false;

  for (const imageEntry of imageEntries) {
    const sidecarMetadata = await readMetadataSidecar(outputDir, imageEntry.relativePath);
    const metadata = {
      ...(metadataIndex[imageEntry.filename] || {}),
      ...((await readLegacyMetadata(imageEntry.filename, outputDir)) || {}),
      ...(sidecarMetadata || {}),
    };

    let imageStat;
    try {
      imageStat = await stat(imageEntry.absolutePath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        continue;
      }

      throw error;
    }

    const createdAt = metadata.createdAt || imageStat.mtime.toISOString();
    const inferredSize = metadata.size || (await inferImageSize(imageEntry.absolutePath, imageEntry.extension));
    const normalizedMetadata = normalizeStoredMetadata(
      {
        ...metadata,
        size: metadata.size || inferredSize,
      },
      createdAt,
      imageEntry.filename,
    );

    const parentRelativeDir = normalizeRelativePath(dirname(imageEntry.relativePath));
    const folderKey = parentRelativeDir || ".";
    const reserved = reservedByFolder.get(folderKey) || new Set();
    if (reserved.size === 0) {
      imageEntries
        .filter((entry) => normalizeRelativePath(dirname(entry.relativePath)) === parentRelativeDir)
        .forEach((entry) => reserved.add(entry.filename));
      reservedByFolder.set(folderKey, reserved);
    }

    const desiredBaseName = isReadableGeneratedFilename(imageEntry.filename)
      ? imageEntry.filename
      : createTimestampedFilename({
          format: normalizedMetadata.format || imageEntry.extension.replace(/^\./, ""),
          prompt: normalizedMetadata.prompt || deriveKeywordSourceFromFilename(imageEntry.filename),
          createdAt,
          idSource: basename(imageEntry.filename, imageEntry.extension),
        });

    let nextFilename = desiredBaseName;
    let sequence = 1;
    while (nextFilename !== imageEntry.filename && reserved.has(nextFilename)) {
      sequence += 1;
      nextFilename = createCollisionResistantFilename(desiredBaseName, sequence);
    }

    const nextRelativePath = normalizeRelativePath(join(parentRelativeDir, nextFilename));
    const nextImagePath = join(outputDir, ...nextRelativePath.split("/"));

    if (nextFilename !== imageEntry.filename) {
      reserved.delete(imageEntry.filename);
      reserved.add(nextFilename);

      await mkdir(dirname(nextImagePath), { recursive: true });
      await rename(imageEntry.absolutePath, nextImagePath);

      const currentSidecarPath = metadataPathFor(imageEntry.relativePath, outputDir);
      const nextSidecarPath = metadataPathFor(nextRelativePath, outputDir);
      const movedSidecar = await moveFileIfExists(currentSidecarPath, nextSidecarPath);
      if (!movedSidecar) {
        await writeMetadataSidecar(outputDir, nextRelativePath, compactStoredMetadata(normalizedMetadata));
      }

      const currentLegacyMetadataPath = legacyMetadataPathFor(imageEntry.filename, outputDir);
      const nextLegacyMetadataPath = legacyMetadataPathFor(nextFilename, outputDir);
      await moveFileIfExists(currentLegacyMetadataPath, nextLegacyMetadataPath);

      if (metadataIndex[imageEntry.filename]) {
        delete metadataIndex[imageEntry.filename];
      }
      metadataIndex[nextFilename] = compactStoredMetadata(normalizedMetadata);
      metadataChanged = true;

      renamed.push({
        from: imageEntry.relativePath,
        to: nextRelativePath,
      });
      continue;
    }

    if (!metadataMatches(metadataIndex[imageEntry.filename], normalizedMetadata)) {
      metadataIndex[imageEntry.filename] = compactStoredMetadata(normalizedMetadata);
      metadataChanged = true;
    }

    if (!metadataMatches(sidecarMetadata, normalizedMetadata)) {
      await writeMetadataSidecar(outputDir, imageEntry.relativePath, compactStoredMetadata(normalizedMetadata));
    }
  }

  if (metadataChanged) {
    await writeGalleryIndex(resolvedIndexPath, metadataIndex);
  }

  return {
    renamedCount: renamed.length,
    renamed,
  };
}

async function collectImageEntries(dir, relativeDir = "") {
  const entries = await readdir(dir, { withFileTypes: true });
  const files = [];

  for (const entry of entries) {
    const relativePath = relativeDir ? `${relativeDir}/${entry.name}` : entry.name;
    const absolutePath = join(dir, entry.name);

    if (entry.isDirectory()) {
      if (entry.name === METADATA_DIRNAME) {
        continue;
      }
      files.push(...(await collectImageEntries(absolutePath, relativePath)));
      continue;
    }

    if (!entry.isFile()) {
      continue;
    }

    const extension = extname(entry.name).toLowerCase();
    if (!IMAGE_EXTENSIONS.has(extension)) {
      continue;
    }

    files.push({
      absolutePath,
      filename: entry.name,
      relativePath,
      extension,
    });
  }

  return files;
}

function createNotFoundError(message) {
  const error = new Error(message);
  error.code = "ENOENT";
  return error;
}

export async function saveGeneratedAsset({
  outputDir,
  indexPath,
  relativeDir,
  filename,
  imageBuffer,
  metadata = {},
}) {
  const createdAt = normalizeDateValue(metadata.createdAt).toISOString();
  const pathMetadata = normalizeStoredMetadata(metadata, createdAt, filename);
  const relativePath = relativeImagePathFor(filename, createdAt, relativeDir, pathMetadata);
  const imagePath = imagePathFor(filename, outputDir, createdAt, relativeDir, pathMetadata);
  const resolvedIndexPath = resolveIndexPath(outputDir, indexPath);

  await mkdir(dirname(imagePath), { recursive: true });
  await writeFile(imagePath, imageBuffer);

  const actualSize = pathMetadata.actualSize || (await inferImageSize(imagePath, extname(filename).toLowerCase()));
  const normalizedMetadata = normalizeStoredMetadata({ ...pathMetadata, actualSize }, createdAt, filename);
  const compactMetadata = compactStoredMetadata(normalizedMetadata);

  await withGalleryIndexLock(resolvedIndexPath, async () => {
    const metadataIndex = await readGalleryIndex(resolvedIndexPath);
    metadataIndex[filename] = compactMetadata;
    await writeGalleryIndex(resolvedIndexPath, metadataIndex);
  });
  await writeMetadataSidecar(outputDir, relativePath, compactMetadata);

  return {
    filename,
    absolutePath: imagePath,
    relativePath,
    createdAt,
    metadata: normalizedMetadata,
  };
}

export async function deleteGeneratedAsset({ outputDir, indexPath, filename }) {
  let imagePath = join(outputDir, filename);
  const imageEntries = await collectImageEntries(outputDir);
  const matchedEntry = imageEntries.find((entry) => entry.filename === filename);
  const candidates = matchedEntry
    ? [matchedEntry.absolutePath, join(outputDir, filename)]
    : [join(outputDir, filename)];
  const resolvedIndexPath = resolveIndexPath(outputDir, indexPath);

  let deleted = false;

  for (const candidate of candidates) {
    try {
      await unlink(candidate);
      imagePath = candidate;
      deleted = true;
      break;
    } catch (error) {
      if (!(error && typeof error === "object" && error.code === "ENOENT")) {
        throw error;
      }
    }
  }

  try {
    await unlink(legacyMetadataPathFor(filename, outputDir));
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ENOENT")) {
      throw error;
    }
  }

  if (matchedEntry) {
    try {
      await unlink(metadataPathFor(matchedEntry.relativePath, outputDir));
    } catch (error) {
      if (!(error && typeof error === "object" && error.code === "ENOENT")) {
        throw error;
      }
    }
  }

  if (!deleted) {
    throw createNotFoundError(`Image not found: ${filename}`);
  }

  const metadataIndex = await readGalleryIndex(resolvedIndexPath);
  if (metadataIndex[filename]) {
    delete metadataIndex[filename];

    if (Object.keys(metadataIndex).length === 0) {
      try {
        await unlink(resolvedIndexPath);
      } catch (error) {
        if (!(error && typeof error === "object" && error.code === "ENOENT")) {
          throw error;
        }
      }
    } else {
      await writeGalleryIndex(resolvedIndexPath, metadataIndex);
    }
  }

  return {
    filename,
    absolutePath: imagePath,
  };
}

export async function repairGeneratedAssetMetadata({
  outputDir,
  indexPath,
  filename,
  metadata = {},
}) {
  await mkdir(outputDir, { recursive: true });

  const resolvedIndexPath = resolveIndexPath(outputDir, indexPath);
  const imageEntries = await collectImageEntries(outputDir);
  const imageEntry = imageEntries.find((entry) => entry.filename === filename);
  if (!imageEntry) {
    throw createNotFoundError(`Image not found: ${filename}`);
  }

  const metadataIndex = await readGalleryIndex(resolvedIndexPath);
  const sidecarMetadata = await readMetadataSidecar(outputDir, imageEntry.relativePath);
  const legacyMetadata = (await readLegacyMetadata(filename, outputDir)) || {};
  const imageStat = await stat(imageEntry.absolutePath);
  const createdAt = String(
    metadata.createdAt ||
      sidecarMetadata?.createdAt ||
      metadataIndex[filename]?.createdAt ||
      legacyMetadata.createdAt ||
      imageStat.mtime.toISOString(),
  ).trim();
  const actualSize =
    String(
      metadata.actualSize ||
        sidecarMetadata?.actualSize ||
        metadataIndex[filename]?.actualSize ||
        legacyMetadata.actualSize ||
        "",
    ).trim() || (await inferImageSize(imageEntry.absolutePath, imageEntry.extension));
  const inferredSize =
    String(metadata.size || sidecarMetadata?.size || metadataIndex[filename]?.size || legacyMetadata.size || "").trim() ||
    actualSize;
  const baseMetadata = normalizeStoredMetadata(
    {
      ...(metadataIndex[filename] || {}),
      ...legacyMetadata,
      ...(sidecarMetadata || {}),
      size: inferredSize,
      actualSize,
    },
    createdAt,
    filename,
  );
  const mergedMetadata = mergeMetadataPatch(baseMetadata, metadata, createdAt, filename);
  const compactMetadata = compactStoredMetadata(mergedMetadata);

  metadataIndex[filename] = compactMetadata;
  await writeGalleryIndex(resolvedIndexPath, metadataIndex);
  await writeMetadataSidecar(outputDir, imageEntry.relativePath, compactMetadata);

  return {
    filename,
    absolutePath: imageEntry.absolutePath,
    relativePath: imageEntry.relativePath,
    createdAt,
    metadata: mergedMetadata,
  };
}

export async function listGalleryItems({
  outputDir,
  publicBasePath = "/output",
  indexPath,
}) {
  await mkdir(outputDir, { recursive: true });
  const resolvedIndexPath = resolveIndexPath(outputDir, indexPath);
  const metadataIndex = await readGalleryIndex(resolvedIndexPath);
  const imageEntries = await collectImageEntries(outputDir);
  const items = [];
  let metadataChanged = false;

  for (const imageEntry of imageEntries) {
    const sidecarMetadata = await readMetadataSidecar(outputDir, imageEntry.relativePath);
    const metadata = {
      ...(metadataIndex[imageEntry.filename] || {}),
      ...((await readLegacyMetadata(imageEntry.filename, outputDir)) || {}),
      ...(sidecarMetadata || {}),
    };

    try {
      const imageStat = await stat(imageEntry.absolutePath);
      const createdAt = metadata.createdAt || imageStat.mtime.toISOString();
      const actualSize =
        String(metadata.actualSize || "").trim() ||
        (await inferImageSize(imageEntry.absolutePath, imageEntry.extension));
      const inferredSize = metadata.size || actualSize;
      const normalizedMetadata = normalizeStoredMetadata(
        {
          ...metadata,
          size: metadata.size || inferredSize,
          actualSize,
        },
        createdAt,
        imageEntry.filename,
      );

      if (!metadataMatches(metadataIndex[imageEntry.filename], normalizedMetadata)) {
        metadataIndex[imageEntry.filename] = compactStoredMetadata(normalizedMetadata);
        metadataChanged = true;
      }

      if (!metadataMatches(sidecarMetadata, normalizedMetadata)) {
        await writeMetadataSidecar(outputDir, imageEntry.relativePath, compactStoredMetadata(normalizedMetadata));
      }

      if (!normalizedMetadata.galleryVisible) {
        continue;
      }

      items.push({
        id: `${basename(imageEntry.filename, imageEntry.extension)}-${createdAt}`,
        filename: imageEntry.filename,
        absolutePath: imageEntry.absolutePath,
        relativePath: imageEntry.relativePath,
        imageUrl: buildPublicAssetUrl(publicBasePath, imageEntry.relativePath, createdAt),
        thumbnailUrl: buildPublicAssetUrl(publicBasePath, imageEntry.relativePath, createdAt),
        createdAt,
        prompt: normalizedMetadata.prompt || "",
        baseUrl: normalizedMetadata.baseUrl || "",
        imageRoute: normalizedMetadata.imageRoute || "",
        responsesModel: normalizedMetadata.responsesModel || "",
        imageModel: normalizedMetadata.imageModel || "",
        generationMode: normalizedMetadata.generationMode || "",
        hasReferenceImage: Boolean(normalizedMetadata.hasReferenceImage),
        referenceImageNames: Array.isArray(normalizedMetadata.referenceImageNames)
          ? normalizedMetadata.referenceImageNames
          : [],
        referenceImageName: normalizedMetadata.referenceImageName || "",
        ratio: normalizedMetadata.ratio || "",
        ratioLabel: normalizedMetadata.ratioLabel || "",
        size: inferredSize || "",
        actualSize: normalizedMetadata.actualSize || "",
        quality: normalizedMetadata.quality || "",
        format: normalizedMetadata.format || imageEntry.extension.replace(/^\./, ""),
        reasoningEffort: normalizedMetadata.reasoningEffort || "",
        generationStartedAt: normalizedMetadata.generationStartedAt || "",
        generationCompletedAt: normalizedMetadata.generationCompletedAt || "",
        generationDurationMs: normalizedMetadata.generationDurationMs || "",
        assetKind: normalizedMetadata.assetKind || "",
        styleTransferSourceImageName: normalizedMetadata.styleTransferSourceImageName || "",
        styleTransferReferenceImageName: normalizedMetadata.styleTransferReferenceImageName || "",
        styleTransferStylePreset: normalizedMetadata.styleTransferStylePreset || "",
        quickBlendPairIndex: normalizedMetadata.quickBlendPairIndex || "",
        quickBlendAImageName: normalizedMetadata.quickBlendAImageName || "",
        quickBlendBImageName: normalizedMetadata.quickBlendBImageName || "",
        quickBlendCImageName: normalizedMetadata.quickBlendCImageName || "",
        quickBlendDImageName: normalizedMetadata.quickBlendDImageName || "",
        quickBlendLayoutOrder: normalizedMetadata.quickBlendLayoutOrder || "",
        quickBlendPlacementShape: normalizedMetadata.quickBlendPlacementShape || "",
        editInstruction: normalizedMetadata.editInstruction || "",
        editMode: normalizedMetadata.editMode || "",
        executionStrategy: normalizedMetadata.executionStrategy || "",
        regionCount: Number(normalizedMetadata.regionCount || 0),
        regionInstructions: Array.isArray(normalizedMetadata.regionInstructions)
          ? normalizedMetadata.regionInstructions
          : [],
        deckId: normalizedMetadata.deckId || "",
        slideNumber: normalizedMetadata.slideNumber || "",
        creationSetId: normalizedMetadata.creationSetId || "",
        creationItemId: normalizedMetadata.creationItemId || "",
        creationRole: normalizedMetadata.creationRole || "",
        portraitSetId: normalizedMetadata.portraitSetId || "",
        portraitItemId: normalizedMetadata.portraitItemId || "",
        portraitStyle: normalizedMetadata.portraitStyle || "",
        portraitShotType: normalizedMetadata.portraitShotType || "",
        subjectName: normalizedMetadata.subjectName || "",
        subjectSummary: normalizedMetadata.subjectSummary || "",
        selectedStyles: Array.isArray(normalizedMetadata.selectedStyles)
          ? normalizedMetadata.selectedStyles
          : [],
        targetLanguage: normalizedMetadata.targetLanguage || "",
        sourceImageName: normalizedMetadata.sourceImageName || "",
        featureCardsEnabled: normalizeStoredBoolean(normalizedMetadata.featureCardsEnabled),
      });
    } catch (error) {
      if (!(error && typeof error === "object" && error.code === "ENOENT")) {
        throw error;
      }
    }
  }

  if (metadataChanged) {
    await writeGalleryIndex(resolvedIndexPath, metadataIndex);
  }

  items.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  return items;
}
