import { mkdir, readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, isAbsolute, join, relative, resolve } from "node:path";

import { normalizeCreationListingDraft } from "./creation-listing-draft.mjs";
import { normalizeCreationLogoOptions, normalizeCreationVisualLanguage } from "./creation-planner.mjs";
import { formatDateFolder, formatDayFolder, formatMonthFolder } from "./gallery-store.mjs";

const MANIFEST_DIRNAME = "creation-sets";
const VALID_SET_STATUSES = new Set(["planning", "queued", "generating", "saving", "completed", "partial_failed", "failed"]);

function cleanString(value) {
  return String(value || "").trim();
}

function hasExplicitFiniteNumber(value) {
  return value !== undefined && value !== null && String(value).trim() !== "" && Number.isFinite(Number(value));
}

function normalizeDefaultEnabledBoolean(value, fallback = false) {
  if (value === undefined || value === null || value === "") {
    return fallback;
  }
  if (typeof value === "boolean") {
    return value;
  }
  const normalized = cleanString(value).toLowerCase();
  if (["false", "0", "off", "no"].includes(normalized)) {
    return false;
  }
  if (["true", "1", "on", "yes"].includes(normalized)) {
    return true;
  }
  return fallback;
}

function normalizeCreationDimensionUnitMode(value) {
  const normalized = cleanString(value);
  return ["metric", "imperial", "both"].includes(normalized) ? normalized : "both";
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

function sanitizeSegment(value, fallback = "creation") {
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

function normalizeSourceInfographic(entry = {}) {
  const source = entry.sourceInfographic || entry.source_infographic || entry.infographicSource || entry.infographic_source || {};
  const normalized = {
    filename: cleanString(source.filename || source.name),
    role: cleanString(source.role),
  };
  const roleLabel = cleanString(source.roleLabel || source.role_label || source.label);
  const rolePromptLabel = cleanString(source.rolePromptLabel || source.role_prompt_label || source.promptLabel);
  const note = cleanString(source.note || source.analysisNote || source.description);
  const index = Number(source.index);
  if (roleLabel) {
    normalized.roleLabel = roleLabel;
  }
  if (rolePromptLabel) {
    normalized.rolePromptLabel = rolePromptLabel;
  }
  if (note) {
    normalized.note = note;
  }
  if (Number.isFinite(index)) {
    normalized.index = index;
  }
  return normalized.filename || normalized.role ? normalized : null;
}

export function buildCreationRelativeDir({ createdAt = new Date(), productName = "", setId = "" } = {}) {
  const date = normalizeDateValue(createdAt);
  const monthFolder = formatMonthFolder(date);
  const dayFolder = formatDayFolder(date);
  const dateFolder = formatDateFolder(date);
  const folderName = `${formatHourMinutePrefix(date)}-${sanitizeSegment(productName, "creation")}-${setIdSuffix(setId)}`;
  return `${monthFolder}/${dayFolder}/${dateFolder}-creation/${folderName}`;
}

function normalizeCreationItem(item = {}, publicBasePath) {
  const relativePath = normalizeRelativePath(item.relativePath);
  const imageUrl = cleanString(item.imageUrl) || buildOutputUrl(publicBasePath, relativePath);
  const skuSubject = normalizeSkuSubject(item.skuSubject || item.sku_subject || {});
  const sourceInfographic = normalizeSourceInfographic(item);
  return {
    itemId: cleanString(item.itemId),
    slotIndex: Number(item.slotIndex) || 0,
    role: cleanString(item.role),
    title: cleanString(item.title),
    prompt: cleanString(item.prompt),
    marketingCopy: cleanString(item.marketingCopy),
    status: cleanString(item.status) || (relativePath ? "completed" : "queued"),
    filename: cleanString(item.filename) || basename(relativePath),
    relativePath,
    imageUrl,
    thumbnailUrl: cleanString(item.thumbnailUrl) || imageUrl,
    error: cleanString(item.error),
    ...(item.missingAsset || item.missing_asset ? { missingAsset: true } : {}),
    generationStartedAt: cleanString(item.generationStartedAt),
    generationCompletedAt: cleanString(item.generationCompletedAt),
    generationDurationMs: Number(item.generationDurationMs) || 0,
    size: cleanString(item.size),
    format: cleanString(item.format),
    ...(skuSubject.id || skuSubject.filenames.length ? { skuSubject } : {}),
    ...(sourceInfographic ? { sourceInfographic } : {}),
  };
}

function normalizeReferenceImageRole(entry = {}) {
  return {
    filename: cleanString(entry.filename || entry.name),
    role: cleanString(entry.role) || "product",
    roleLabel: cleanString(entry.roleLabel),
    note: cleanString(entry.note || entry.analysisNote || entry.description),
  };
}

function normalizeSkuBundleCount(value) {
  const normalized = Number.parseInt(cleanString(value), 10);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : 1;
}

function hasSkuSubjectCountValue(entry = {}, keys = []) {
  return keys.some((key) => Object.prototype.hasOwnProperty.call(entry, key) && cleanString(entry[key]));
}

function normalizeOptionalSkuSubjectCount(entry = {}, keys = []) {
  if (!hasSkuSubjectCountValue(entry, keys)) {
    return undefined;
  }
  return normalizeSkuBundleCount(keys.map((key) => entry[key]).find((value) => cleanString(value)));
}

function normalizeSkuSubject(entry = {}) {
  const bundleCount = normalizeOptionalSkuSubjectCount(entry, ["bundleCount", "bundle_count", "quantity", "count"]);
  const subjectUnitCount = normalizeOptionalSkuSubjectCount(entry, [
    "subjectUnitCount",
    "subject_unit_count",
    "visibleUnitCount",
    "visible_unit_count",
    "unitCount",
    "unit_count",
  ]);
  return {
    id: cleanString(entry.id || entry.subjectId || entry.subject_id),
    title: cleanString(entry.title || entry.name),
    referenceIndexes: Array.isArray(entry.referenceIndexes)
      ? entry.referenceIndexes.map((item) => Number(item) || 0).filter(Boolean)
      : Array.isArray(entry.reference_indexes)
        ? entry.reference_indexes.map((item) => Number(item) || 0).filter(Boolean)
        : [],
    filenames: Array.isArray(entry.filenames) ? entry.filenames.map(cleanString).filter(Boolean) : [],
    note: cleanString(entry.note || entry.description || entry.summary),
    ...(bundleCount ? { bundleCount } : {}),
    ...(subjectUnitCount ? { subjectUnitCount } : {}),
  };
}

export function normalizeCreationSetManifest(manifest = {}, { publicBasePath = "/output" } = {}) {
  const createdAt = cleanString(manifest.createdAt) || new Date().toISOString();
  const status = cleanString(manifest.status);
  const items = Array.isArray(manifest.items)
    ? manifest.items.map((item) => normalizeCreationItem(item, publicBasePath)).sort((a, b) => a.slotIndex - b.slotIndex)
    : [];
  const listingDrafts = Array.isArray(manifest.listingDrafts)
    ? manifest.listingDrafts.map((draft) => normalizeCreationListingDraft(draft, manifest)).filter((draft) => draft.id)
    : [];
  const logo = normalizeCreationLogoOptions(manifest.logo || manifest.creationLogo || {});
  const visualLanguage = normalizeCreationVisualLanguage(manifest.visualLanguage || manifest.visual_language);
  const infographicRebuildEnabled = normalizeDefaultEnabledBoolean(
    manifest.infographicRebuildEnabled ?? manifest.infographic_rebuild_enabled,
    items.some((item) => item.role === "infographic-rebuild"),
  );

  return {
    setId: cleanString(manifest.setId || manifest.id),
    productName: cleanString(manifest.productName),
    productDescription: cleanString(manifest.productDescription),
    sellingPoints: Array.isArray(manifest.sellingPoints)
      ? manifest.sellingPoints.map(cleanString).filter(Boolean)
      : [],
    dimensionSpecs: cleanString(manifest.dimensionSpecs),
    dimensionUnitMode: normalizeCreationDimensionUnitMode(manifest.dimensionUnitMode),
    targetLanguage: cleanString(manifest.targetLanguage) || "en",
    targetLanguageLabel: cleanString(manifest.targetLanguageLabel),
    imageCount: hasExplicitFiniteNumber(manifest.imageCount) ? Number(manifest.imageCount) : items.length || 10,
    selectedRoles: Array.isArray(manifest.selectedRoles)
      ? manifest.selectedRoles.map(cleanString).filter(Boolean)
      : items.map((item) => item.role).filter(Boolean),
    scenario: cleanString(manifest.scenario) || "standard",
    scenarioLabel: cleanString(manifest.scenarioLabel),
    visualLanguage: visualLanguage.value,
    visualLanguageLabel: cleanString(manifest.visualLanguageLabel || manifest.visual_language_label) || visualLanguage.label,
    industryTemplate: cleanString(manifest.industryTemplate) || "general",
    industryTemplateLabel: cleanString(manifest.industryTemplateLabel),
    industryTemplatePath: cleanString(manifest.industryTemplatePath),
    infographicRebuildEnabled,
    referenceImageNames: Array.isArray(manifest.referenceImageNames)
      ? manifest.referenceImageNames.map(cleanString).filter(Boolean)
      : [],
    referenceImageRoles: Array.isArray(manifest.referenceImageRoles)
      ? manifest.referenceImageRoles.map(normalizeReferenceImageRole).filter((entry) => entry.filename)
      : [],
    skuSubjects: Array.isArray(manifest.skuSubjects)
      ? manifest.skuSubjects.map(normalizeSkuSubject).filter((entry) => entry.id || entry.filenames.length)
      : [],
    skuBundleCount: normalizeSkuBundleCount(manifest.skuBundleCount || manifest.sku_bundle_count || manifest.skuSubjects?.[0]?.bundleCount),
    skuGenerationRule: cleanString(manifest.skuGenerationRule || manifest.sku_generation_rule) || "none",
    skuGenerationRuleLabel: cleanString(manifest.skuGenerationRuleLabel || manifest.sku_generation_rule_label),
    logo: logo.enabled ? logo : null,
    createdAt,
    updatedAt: cleanString(manifest.updatedAt) || createdAt,
    status: VALID_SET_STATUSES.has(status) ? status : "planning",
    relativeDir: normalizeRelativePath(manifest.relativeDir),
    items,
    listingDrafts,
  };
}

function compareCreationSets(left, right) {
  const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
  return byCreatedAt || left.productName.localeCompare(right.productName) || left.setId.localeCompare(right.setId);
}

export function createCreationSetStore({ outputDir, publicBasePath = "/output" }) {
  const manifestsDir = join(outputDir, "json", MANIFEST_DIRNAME);
  const manifestSaveQueues = new Map();

  function manifestPath(setId) {
    return join(manifestsDir, `${sanitizeSegment(setId, "creation-set")}.json`);
  }

  function enqueueManifestSave(setId, operation) {
    const previous = manifestSaveQueues.get(setId) || Promise.resolve();
    const savePromise = previous.then(operation);
    const tail = savePromise.catch(() => {});
    manifestSaveQueues.set(setId, tail);
    tail.finally(() => {
      if (manifestSaveQueues.get(setId) === tail) {
        manifestSaveQueues.delete(setId);
      }
    });
    return savePromise;
  }

  async function saveManifestNow(manifest) {
    let manifestToSave = manifest;
    if (!Object.prototype.hasOwnProperty.call(manifest, "listingDrafts")) {
      const setId = cleanString(manifest.setId || manifest.id);
      if (setId) {
        try {
          const raw = await readFile(manifestPath(setId), "utf8");
          const existing = JSON.parse(raw.replace(/^\uFEFF/, ""));
          if (Array.isArray(existing.listingDrafts)) {
            manifestToSave = { ...manifest, listingDrafts: existing.listingDrafts };
          }
        } catch (error) {
          if (error?.code !== "ENOENT") {
            throw error;
          }
        }
      }
    }

    const normalized = normalizeCreationSetManifest(manifestToSave, { publicBasePath });
    if (!normalized.setId) {
      throw new Error("setId is required");
    }

    await mkdir(manifestsDir, { recursive: true });
    await writeFile(manifestPath(normalized.setId), `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
  }

  async function outputFileExists(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) {
      return false;
    }

    const outputRoot = resolve(outputDir);
    const absolutePath = resolve(outputRoot, ...normalized.split("/"));
    const pathOffset = relative(outputRoot, absolutePath);
    if (pathOffset === ".." || pathOffset.startsWith("..\\") || pathOffset.startsWith("../") || isAbsolute(pathOffset)) {
      return false;
    }

    try {
      const fileStat = await stat(absolutePath);
      return fileStat.isFile();
    } catch (error) {
      if (error?.code === "ENOENT") {
        return false;
      }

      throw error;
    }
  }

  async function reconcileMissingCompletedItems(manifest) {
    const normalized = normalizeCreationSetManifest(manifest, { publicBasePath });
    let changed = false;
    const items = [];

    for (const item of normalized.items) {
      if (item.status !== "completed" || !item.relativePath || (await outputFileExists(item.relativePath))) {
        items.push(item);
        continue;
      }

      changed = true;
      items.push({
        ...item,
        status: "failed",
        imageUrl: "",
        thumbnailUrl: "",
        missingAsset: true,
        error: "图片文件缺失，可一键补图。",
      });
    }

    if (!changed) {
      return normalized;
    }

    const completedCount = items.filter((item) => item.status === "completed" && item.filename && item.relativePath).length;
    const status =
      normalized.status === "completed" || normalized.status === "partial_failed" || normalized.status === "failed"
        ? completedCount > 0
          ? "partial_failed"
          : "failed"
        : normalized.status;

    return {
      ...normalized,
      status,
      items,
    };
  }

  async function saveManifest(manifest = {}) {
    const setId = cleanString(manifest.setId || manifest.id);
    if (!setId) {
      throw new Error("setId is required");
    }
    return enqueueManifestSave(setId, () => saveManifestNow(manifest));
  }

  async function readManifest(setId) {
    const raw = await readFile(manifestPath(setId), "utf8");
    return reconcileMissingCompletedItems(JSON.parse(raw.replace(/^\uFEFF/, "")));
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
      manifests.push(await reconcileMissingCompletedItems(JSON.parse(raw.replace(/^\uFEFF/, ""))));
    }

    return manifests.sort(compareCreationSets);
  }

  return {
    manifestsDir,
    saveManifest,
    readManifest,
    listManifests,
    manifestPath,
  };
}
