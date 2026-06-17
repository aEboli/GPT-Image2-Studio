import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";

import { formatDateFolder, formatDayFolder, formatMonthFolder } from "./gallery-store.mjs";

const MANIFEST_DIRNAME = "portrait-sets";
const VALID_SET_STATUSES = new Set(["planning", "queued", "generating", "saving", "completed", "partial_failed", "failed"]);

function cleanString(value) {
  return String(value || "").trim();
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

function sanitizeSegment(value, fallback = "portrait") {
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

function formatHourMinutePrefix(date) {
  return `${String(date.getHours()).padStart(2, "0")}${String(date.getMinutes()).padStart(2, "0")}`;
}

function buildOutputUrl(publicBasePath, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return normalized ? `${publicBasePath.replace(/\/+$/, "")}/${normalized}` : "";
}

export function formatPortraitSlotPrefix(slotIndex) {
  const parsed = Number.parseInt(cleanString(slotIndex), 10);
  return String(Number.isFinite(parsed) && parsed > 0 ? parsed : 1).padStart(3, "0");
}

export function buildPortraitItemFilename(item = {}, extension = "png") {
  const prefix = formatPortraitSlotPrefix(item.slotIndex);
  const token = sanitizeSegment(item.filenameToken || item.shotType || item.style || item.itemId || "portrait", "portrait");
  const ext = cleanString(extension).replace(/^\.+/, "") || "png";
  return `${prefix}-${token}.${ext}`;
}

export function buildPortraitRelativeDir({ createdAt = new Date(), subjectName = "", setId = "" } = {}) {
  const date = normalizeDateValue(createdAt);
  const monthFolder = formatMonthFolder(date);
  const dayFolder = formatDayFolder(date);
  const dateFolder = formatDateFolder(date);
  const folderName = `${formatHourMinutePrefix(date)}-${sanitizeSegment(subjectName, "portrait")}-${setIdSuffix(setId)}`;
  return `${monthFolder}/${dayFolder}/${dateFolder}-portrait/${folderName}`;
}

function normalizeStringArray(value = []) {
  return Array.isArray(value) ? value.map(cleanString).filter(Boolean) : [];
}

function normalizeAnalysis(value = {}) {
  const analysis = value && typeof value === "object" ? value : {};
  return {
    visiblePresentation: cleanString(analysis.visiblePresentation) || "unclear",
    heightImpression: cleanString(analysis.heightImpression) || "unclear",
    bodyBuild: cleanString(analysis.bodyBuild) || "unclear",
    pose: cleanString(analysis.pose),
    clothing: cleanString(analysis.clothing),
    hair: cleanString(analysis.hair),
    faceVisibility: cleanString(analysis.faceVisibility),
    distinctVisibleFeatures: normalizeStringArray(analysis.distinctVisibleFeatures),
    referenceRoles: normalizeStringArray(analysis.referenceRoles),
    risks: normalizeStringArray(analysis.risks),
    confidence: cleanString(analysis.confidence),
  };
}

function normalizePortraitItem(item = {}, publicBasePath) {
  const relativePath = normalizeRelativePath(item.relativePath);
  const imageUrl = cleanString(item.imageUrl) || buildOutputUrl(publicBasePath, relativePath);
  return {
    itemId: cleanString(item.itemId),
    slotIndex: Number(item.slotIndex) || 0,
    title: cleanString(item.title),
    style: cleanString(item.style),
    styleLabel: cleanString(item.styleLabel),
    customStyle: cleanString(item.customStyle),
    shotType: cleanString(item.shotType),
    shotLabel: cleanString(item.shotLabel),
    action: cleanString(item.action),
    actionLabel: cleanString(item.actionLabel),
    actionInstruction: cleanString(item.actionInstruction),
    lens: cleanString(item.lens),
    aperture: cleanString(item.aperture),
    depthOfField: cleanString(item.depthOfField),
    lighting: cleanString(item.lighting),
    scene: cleanString(item.scene),
    prompt: cleanString(item.prompt),
    status: cleanString(item.status) || (relativePath ? "completed" : "queued"),
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

export function normalizePortraitSetManifest(manifest = {}, { publicBasePath = "/output" } = {}) {
  const createdAt = cleanString(manifest.createdAt) || new Date().toISOString();
  const status = cleanString(manifest.status);
  const items = Array.isArray(manifest.items)
    ? manifest.items.map((item) => normalizePortraitItem(item, publicBasePath)).sort((a, b) => a.slotIndex - b.slotIndex)
    : [];
  return {
    setId: cleanString(manifest.setId || manifest.id),
    subjectName: cleanString(manifest.subjectName),
    subjectSummary: cleanString(manifest.subjectSummary || manifest.personSummary),
    analysis: normalizeAnalysis(manifest.analysis || manifest.visibleProfile || {}),
    referenceImageNames: normalizeStringArray(manifest.referenceImageNames),
    selectedStyles: normalizeStringArray(manifest.selectedStyles),
    selectedShotTypes: normalizeStringArray(manifest.selectedShotTypes),
    selectedActions: normalizeStringArray(manifest.selectedActions),
    customStyle: cleanString(manifest.customStyle),
    notes: cleanString(manifest.notes || manifest.photographyNotes),
    ratio: cleanString(manifest.ratio) || "4:5",
    size: cleanString(manifest.size) || "auto",
    format: cleanString(manifest.format) || "png",
    imageCount: Number(manifest.imageCount) || items.length || 1,
    createdAt,
    updatedAt: cleanString(manifest.updatedAt) || createdAt,
    status: VALID_SET_STATUSES.has(status) ? status : "planning",
    relativeDir: normalizeRelativePath(manifest.relativeDir),
    items,
  };
}

function comparePortraitSets(left, right) {
  const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
  return byCreatedAt || left.subjectName.localeCompare(right.subjectName) || left.setId.localeCompare(right.setId);
}

export function createPortraitSetStore({ outputDir, publicBasePath = "/output" }) {
  const manifestsDir = join(outputDir, "json", MANIFEST_DIRNAME);

  function manifestPath(setId) {
    return join(manifestsDir, `${sanitizeSegment(setId, "portrait-set")}.json`);
  }

  async function saveManifest(manifest) {
    const normalized = normalizePortraitSetManifest(manifest, { publicBasePath });
    if (!normalized.setId) {
      throw new Error("setId is required");
    }
    await mkdir(manifestsDir, { recursive: true });
    await writeFile(manifestPath(normalized.setId), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  async function readManifest(setId) {
    const raw = await readFile(manifestPath(setId), "utf8");
    return normalizePortraitSetManifest(JSON.parse(raw.replace(/^\uFEFF/, "")), { publicBasePath });
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
      manifests.push(normalizePortraitSetManifest(JSON.parse(raw.replace(/^\uFEFF/, "")), { publicBasePath }));
    }
    return manifests.sort(comparePortraitSets);
  }

  return {
    manifestsDir,
    saveManifest,
    readManifest,
    listManifests,
    manifestPath,
  };
}
