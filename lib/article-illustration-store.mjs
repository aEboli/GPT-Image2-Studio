import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { formatDateFolder, formatDayFolder, formatMonthFolder } from "./gallery-store.mjs";

const MANIFEST_DIRNAME = "article-illustration-sets";
const DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET = "realist-magazine";
const VALID_SET_STATUSES = new Set([
  "planned",
  "reference_generating",
  "references_completed",
  "in_progress",
  "generating",
  "completed",
  "partial_failed",
  "failed",
]);

function cleanString(value) {
  return String(value || "").trim();
}

function parsePositiveInteger(value, fallback = 0) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function normalizeRelativePath(value) {
  return cleanString(value)
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function normalizeDateValue(value, fallback = new Date()) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? fallback : date;
}

function sanitizeSegment(value, fallback = "article") {
  const sanitized = cleanString(value)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "")
    .slice(0, 40);
  return sanitized || fallback;
}

function setIdSuffix(setId) {
  const clean = sanitizeSegment(setId, "set");
  return clean.slice(-8) || "set";
}

function buildOutputUrl(publicBasePath, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return normalized ? `${publicBasePath.replace(/\/+$/, "")}/${normalized}` : "";
}

function normalizeStringArray(value) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];
}

export function buildArticleRelativeDir({ createdAt = new Date(), title = "", setId = "" } = {}) {
  const date = normalizeDateValue(createdAt);
  const monthFolder = formatMonthFolder(date);
  const dayFolder = formatDayFolder(date);
  const dateFolder = formatDateFolder(date);
  const folderName = `${sanitizeSegment(title, "article")}-${setIdSuffix(setId)}`;
  return `${monthFolder}/${dayFolder}/${dateFolder}-article/${folderName}`;
}

function normalizeArticleEntity(entity = {}) {
  return {
    id: cleanString(entity.id),
    name: cleanString(entity.name),
    role: cleanString(entity.role),
    visualContinuity: cleanString(entity.visualContinuity),
    emotionalRange: cleanString(entity.emotionalRange),
    mood: cleanString(entity.mood),
    prompt: cleanString(entity.prompt),
  };
}

function normalizeArticleReferenceCard(card = {}) {
  return {
    cardId: cleanString(card.cardId || card.id),
    targetType: cleanString(card.targetType) || "character",
    targetId: cleanString(card.targetId),
    title: cleanString(card.title),
    prompt: cleanString(card.prompt),
    firstAppearanceIndex: Number(card.firstAppearanceIndex) || 1,
    reason: cleanString(card.reason),
    itemId: cleanString(card.itemId),
    relativePath: normalizeRelativePath(card.relativePath),
    imageUrl: cleanString(card.imageUrl),
  };
}

function normalizeArticleItem(item = {}, publicBasePath) {
  const relativePath = normalizeRelativePath(item.relativePath);
  const imageUrl = cleanString(item.imageUrl) || buildOutputUrl(publicBasePath, relativePath);
  return {
    itemId: cleanString(item.itemId),
    slotIndex: Number(item.slotIndex) || 0,
    itemKind: cleanString(item.itemKind) || "storyboard",
    cardId: cleanString(item.cardId),
    title: cleanString(item.title),
    paragraphIndex: parsePositiveInteger(item.paragraphIndex, 0),
    timelineIndex: parsePositiveInteger(item.timelineIndex, 0),
    narrativeBeat: cleanString(item.narrativeBeat),
    prompt: cleanString(item.prompt),
    originalText: cleanString(item.originalText),
    captionText: cleanString(item.captionText),
    modelTextHint: cleanString(item.modelTextHint),
    referencedCardIds: normalizeStringArray(item.referencedCardIds),
    emotion: cleanString(item.emotion),
    rhythm: cleanString(item.rhythm),
    status: cleanString(item.status) || (relativePath ? "completed" : "planned"),
    filename: cleanString(item.filename) || basename(relativePath),
    relativePath,
    imageUrl,
    thumbnailUrl: cleanString(item.thumbnailUrl) || imageUrl,
    error: cleanString(item.error),
    generationStartedAt: cleanString(item.generationStartedAt),
    generationCompletedAt: cleanString(item.generationCompletedAt),
    generationDurationMs: Number(item.generationDurationMs) || 0,
    size: cleanString(item.size),
    format: cleanString(item.format),
  };
}

function compareArticleItems(left, right) {
  const leftKind = left.itemKind === "reference-card" ? 0 : 1;
  const rightKind = right.itemKind === "reference-card" ? 0 : 1;
  const leftTimeline = left.itemKind === "reference-card" ? 0 : left.timelineIndex || left.slotIndex;
  const rightTimeline = right.itemKind === "reference-card" ? 0 : right.timelineIndex || right.slotIndex;
  const leftParagraph = left.itemKind === "reference-card" ? 0 : left.paragraphIndex || leftTimeline;
  const rightParagraph = right.itemKind === "reference-card" ? 0 : right.paragraphIndex || rightTimeline;
  return (
    leftKind - rightKind ||
    leftTimeline - rightTimeline ||
    leftParagraph - rightParagraph ||
    left.slotIndex - right.slotIndex ||
    left.title.localeCompare(right.title) ||
    left.itemId.localeCompare(right.itemId)
  );
}

function normalizeArticleItemOrder(items = []) {
  let storyboardOrdinal = 0;
  return [...items].sort(compareArticleItems).map((item, index) => {
    if (item.itemKind === "reference-card") {
      return {
        ...item,
        paragraphIndex: 0,
        timelineIndex: 0,
        slotIndex: index + 1,
      };
    }
    storyboardOrdinal += 1;
    return {
      ...item,
      paragraphIndex: item.paragraphIndex || storyboardOrdinal,
      timelineIndex: item.timelineIndex || storyboardOrdinal,
      slotIndex: index + 1,
    };
  });
}

export function normalizeArticleIllustrationSetManifest(manifest = {}, { publicBasePath = "/output" } = {}) {
  const createdAt = cleanString(manifest.createdAt) || new Date().toISOString();
  const status = cleanString(manifest.status);
  const items = Array.isArray(manifest.items)
    ? normalizeArticleItemOrder(manifest.items.map((item) => normalizeArticleItem(item, publicBasePath)))
    : [];

  return {
    setId: cleanString(manifest.setId || manifest.id),
    title: cleanString(manifest.title),
    sourceSummary: cleanString(manifest.sourceSummary),
    contentType: cleanString(manifest.contentType) || "mixed",
    stylePreset: cleanString(manifest.stylePreset) || DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET,
    styleBible: cleanString(manifest.styleBible),
    recommendedImageCount: Number(manifest.recommendedImageCount) || items.length,
    articleBundle: manifest.articleBundle && typeof manifest.articleBundle === "object" ? manifest.articleBundle : null,
    characters: Array.isArray(manifest.characters) ? manifest.characters.map(normalizeArticleEntity).filter((item) => item.id || item.name) : [],
    scenes: Array.isArray(manifest.scenes) ? manifest.scenes.map(normalizeArticleEntity).filter((item) => item.id || item.name) : [],
    referenceCards: Array.isArray(manifest.referenceCards)
      ? manifest.referenceCards.map(normalizeArticleReferenceCard).filter((item) => item.cardId || item.title)
      : [],
    createdAt,
    updatedAt: cleanString(manifest.updatedAt) || createdAt,
    status: VALID_SET_STATUSES.has(status) ? status : "planned",
    relativeDir: normalizeRelativePath(manifest.relativeDir),
    items,
  };
}

function compareArticleSets(left, right) {
  const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
  return byCreatedAt || left.title.localeCompare(right.title) || left.setId.localeCompare(right.setId);
}

export function createArticleIllustrationSetStore({ outputDir, publicBasePath = "/output" }) {
  const manifestsDir = join(outputDir, "json", MANIFEST_DIRNAME);

  function manifestPath(setId) {
    return join(manifestsDir, `${sanitizeSegment(setId, "article-set")}.json`);
  }

  async function saveManifest(manifest) {
    const normalized = normalizeArticleIllustrationSetManifest(manifest, { publicBasePath });
    if (!normalized.setId) {
      throw new Error("setId is required");
    }

    await mkdir(manifestsDir, { recursive: true });
    await writeFile(manifestPath(normalized.setId), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  async function readManifest(setId) {
    const raw = await readFile(manifestPath(setId), "utf8");
    return normalizeArticleIllustrationSetManifest(JSON.parse(raw.replace(/^\uFEFF/, "")), { publicBasePath });
  }

  async function listManifests() {
    await mkdir(manifestsDir, { recursive: true });
    const entries = await readdir(manifestsDir, { withFileTypes: true });
    const manifests = [];

    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith(".json")) {
        continue;
      }

      const raw = await readFile(join(manifestsDir, entry.name), "utf8");
      manifests.push(normalizeArticleIllustrationSetManifest(JSON.parse(raw.replace(/^\uFEFF/, "")), { publicBasePath }));
    }

    return manifests.sort(compareArticleSets);
  }

  return {
    manifestsDir,
    saveManifest,
    readManifest,
    listManifests,
    manifestPath,
  };
}
