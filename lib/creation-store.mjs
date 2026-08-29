import { lstat, mkdir, readdir, readFile, realpath, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";

import { normalizeCreationLogoOptions, normalizeCreationPlatform, normalizeCreationVisualLanguage } from "./creation-planner.mjs";
import { resolveCreationPlanCounts } from "./creation-plan-counts.mjs";
import { formatDateFolder, formatDayFolder, formatMonthFolder } from "./gallery-store.mjs";
import { normalizeCreationRecordDeleteSetIds } from "./creation-record-delete.mjs";
import { mergeTemuImageCache as mergeTemuImageCacheValue } from "./creation-temu-images.mjs";

const MANIFEST_DIRNAME = "creation-sets";
const VALID_SET_STATUSES = new Set(["planning", "queued", "generating", "saving", "completed", "partial_failed", "failed"]);

function cleanString(value) {
  return String(value || "").trim();
}

function normalizePlainJsonObject(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  try {
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== Object.prototype && prototype !== null) {
      return null;
    }
    const normalized = JSON.parse(JSON.stringify(value));
    return normalized && typeof normalized === "object" && !Array.isArray(normalized)
      ? normalized
      : null;
  } catch {
    return null;
  }
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

function normalizeTemuExcelExportState(value) {
  const state = normalizePlainJsonObject(value);
  if (!state) {
    return null;
  }
  const version = Number(state.version);
  const mode = cleanString(state.mode);
  const exportedAt = cleanString(state.exportedAt);
  const sourceUpdatedAt = cleanString(state.sourceUpdatedAt);
  const rowCount = Number(state.rowCount);
  const issueCount = Number(state.issueCount);
  if (
    version !== 1 ||
    !["strict", "draft"].includes(mode) ||
    !exportedAt ||
    Number.isNaN(new Date(exportedAt).getTime()) ||
    !sourceUpdatedAt ||
    Number.isNaN(new Date(sourceUpdatedAt).getTime()) ||
    !hasExplicitFiniteNumber(state.rowCount) ||
    !Number.isInteger(rowCount) ||
    rowCount < 0 ||
    !hasExplicitFiniteNumber(state.issueCount) ||
    !Number.isInteger(issueCount) ||
    issueCount < 0
  ) {
    return null;
  }
  return {
    version: 1,
    mode,
    exportedAt,
    sourceUpdatedAt,
    rowCount,
    issueCount,
  };
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
  const normalized = {
    itemId: cleanString(item.itemId),
    slotIndex: Number(item.slotIndex) || 0,
    role: cleanString(item.role),
    title: cleanString(item.title),
    prompt: cleanString(item.prompt),
    generationPrompt: cleanString(item.generationPrompt),
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
    generationAttemptCount: Number.isFinite(Number(item.generationAttemptCount))
      ? Math.max(0, Math.floor(Number(item.generationAttemptCount)))
      : 0,
    size: cleanString(item.size),
    requestedSize: cleanString(item.requestedSize),
    effectiveSize: cleanString(item.effectiveSize),
    actualSize: cleanString(item.actualSize),
    format: cleanString(item.format),
    ...(skuSubject.id || skuSubject.filenames.length ? { skuSubject } : {}),
    ...(sourceInfographic ? { sourceInfographic } : {}),
  };
  for (const key of [
    "imageType", "imageTypeLabel", "ratio", "ratioLabel", "resolutionTier",
    "baseUrl", "imageRoute", "responsesModel", "imageModel", "endpointPath", "quality", "reasoningEffort",
    "targetLanguage", "targetLanguageLabel", "composition", "textDensity", "scenePolicy",
    "logoPolicy", "constraints", "warnings", "sourceIds", "filenameToken", "itemKind",
  ]) {
    if (item[key] !== undefined) {
      normalized[key] = Array.isArray(item[key]) ? [...item[key]] : item[key];
    }
  }
  if (item.conversionIntent && typeof item.conversionIntent === "object") {
    normalized.conversionIntent = structuredClone(item.conversionIntent);
  }
  if (Object.prototype.hasOwnProperty.call(item, "hasReferenceImage")) {
    normalized.hasReferenceImage = Boolean(item.hasReferenceImage);
  }
  if (Array.isArray(item.referenceImageNames)) {
    normalized.referenceImageNames = item.referenceImageNames.map(cleanString).filter(Boolean);
  }
  if (item.referenceImageName !== undefined) {
    normalized.referenceImageName = cleanString(item.referenceImageName);
  }
  return normalized;
}

function normalizeReferenceImageRole(entry = {}, index = 0) {
  return {
    index: Number(entry.index) > 0 ? Number(entry.index) : index + 1,
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
  const temuExport = normalizePlainJsonObject(entry.temuExport);
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
    ...(temuExport ? { temuExport } : {}),
  };
}

export function normalizeCreationSetManifest(manifest = {}, { publicBasePath = "/output" } = {}) {
  const createdAt = cleanString(manifest.createdAt) || new Date().toISOString();
  const status = cleanString(manifest.status);
  const items = Array.isArray(manifest.items)
    ? manifest.items.map((item) => normalizeCreationItem(item, publicBasePath)).sort((a, b) => a.slotIndex - b.slotIndex)
    : [];
  const listingDrafts = Array.isArray(manifest.listingDrafts)
    ? structuredClone(manifest.listingDrafts)
    : [];
  const logo = normalizeCreationLogoOptions(manifest.logo || manifest.creationLogo || {});
  const platform = normalizeCreationPlatform(manifest.platform || manifest.creationPlatform || manifest.ecommercePlatform);
  const visualLanguage = normalizeCreationVisualLanguage(manifest.visualLanguage || manifest.visual_language);
  const infographicRebuildEnabled = normalizeDefaultEnabledBoolean(
    manifest.infographicRebuildEnabled ?? manifest.infographic_rebuild_enabled,
    items.some((item) => item.role === "infographic-rebuild"),
  );
  const skuGenerationEnabled = normalizeDefaultEnabledBoolean(
    manifest.skuGenerationEnabled ?? manifest.sku_generation_enabled,
    true,
  );
  const hasPlatformMetadata = ["platform", "creationPlatform", "ecommercePlatform", "platformPolicyId", "strategyVersion", "platformProvenance"]
    .some((key) => Object.prototype.hasOwnProperty.call(manifest, key));
  const platformProvenance = cleanString(manifest.platformProvenance) || (hasPlatformMetadata ? "explicit" : "legacy-missing");
  const planCounts = resolveCreationPlanCounts({ ...manifest, items });
  const effectivePlan = manifest.effectivePlan && typeof manifest.effectivePlan === "object"
    ? structuredClone(manifest.effectivePlan)
    : null;
  const temuExcelImageCache = manifest.temuExcelImageCache && typeof manifest.temuExcelImageCache === "object"
    ? mergeTemuImageCacheValue({}, manifest.temuExcelImageCache.entries).temuExcelImageCache
    : null;
  const temuExport = normalizePlainJsonObject(manifest.temuExport);
  const temuExcelExportState = normalizeTemuExcelExportState(manifest.temuExcelExportState);
  if (effectivePlan) Object.assign(effectivePlan, resolveCreationPlanCounts(effectivePlan));

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
    platform: platform.value,
    platformLabel: cleanString(manifest.platformLabel || manifest.platform_label) || platform.label,
    ...planCounts,
    strategyVersion: cleanString(manifest.strategyVersion),
    platformPolicyId: hasPlatformMetadata
      ? cleanString(manifest.platformPolicyId || manifest.platform_policy_id) || platform.value
      : "",
    platformEvidenceLevel: cleanString(manifest.platformEvidenceLevel || manifest.platform_evidence_level),
    platformProvenance,
    platformSetOverrides: manifest.platformSetOverrides && typeof manifest.platformSetOverrides === "object"
      ? structuredClone(manifest.platformSetOverrides)
      : {},
    platformItemOverrides: Array.isArray(manifest.platformItemOverrides)
      ? structuredClone(manifest.platformItemOverrides)
      : [],
    effectivePlan,
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
    skuGenerationEnabled,
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
    ...(temuExport ? { temuExport } : {}),
    ...(temuExcelImageCache ? { temuExcelImageCache } : {}),
    ...(temuExcelExportState ? { temuExcelExportState } : {}),
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

  function resolveDedicatedCreationDirectory(relativeDir, { metadata = false } = {}) {
    const rawRelativeDir = cleanString(relativeDir).replace(/\\/g, "/");
    if (!rawRelativeDir || isAbsolute(rawRelativeDir) || rawRelativeDir.startsWith("/")) {
      return null;
    }

    const segments = rawRelativeDir.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
      return null;
    }
    const creationFolderIndex = segments.findIndex((segment) => /^\d{4}-\d{2}-\d{2}-creation$/u.test(segment));
    if (creationFolderIndex < 0 || creationFolderIndex >= segments.length - 1) {
      return null;
    }

    const outputRoot = resolve(outputDir);
    const target = resolve(outputRoot, ...(metadata ? ["json"] : []), ...segments);
    const pathOffset = relative(outputRoot, target);
    if (!pathOffset || pathOffset === ".." || pathOffset.startsWith("..\\") || pathOffset.startsWith("../") || isAbsolute(pathOffset)) {
      return null;
    }

    const manifestRoot = resolve(manifestsDir);
    const manifestOffset = relative(manifestRoot, target);
    if (!manifestOffset || (!manifestOffset.startsWith("..\\") && !manifestOffset.startsWith("../") && manifestOffset !== "..")) {
      return null;
    }
    return target;
  }

  async function removeVerifiedCreationDirectory(target) {
    if (!target) return false;

    let targetStat;
    try {
      targetStat = await lstat(target);
    } catch (error) {
      if (error?.code === "ENOENT") return true;
      throw error;
    }

    if (targetStat.isSymbolicLink()) {
      await rm(target, { force: true });
      return true;
    }

    const outputRoot = await realpath(resolve(outputDir)).catch(() => resolve(outputDir));
    const realTarget = await realpath(target);
    const realOffset = relative(outputRoot, realTarget);
    if (!realOffset || realOffset === ".." || realOffset.startsWith("..\\") || realOffset.startsWith("../") || isAbsolute(realOffset)) {
      return false;
    }

    await rm(target, { recursive: true, force: true });
    return true;
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
    const legacyMissingPlatformMetadata =
      normalized.platformProvenance === "legacy-missing" &&
      !cleanString(manifestToSave.strategyVersion) &&
      !cleanString(manifestToSave.platformPolicyId) &&
      !manifestToSave.effectivePlan;
    if (legacyMissingPlatformMetadata) {
      for (const key of [
        "strategyVersion", "platformPolicyId", "platformEvidenceLevel", "platformProvenance",
        "platformSetOverrides", "platformItemOverrides", "effectivePlan", "carouselImageCount",
        "skuImageCount", "infographicRebuildCount", "totalPlannedItemCount",
      ]) {
        delete normalized[key];
      }
    }
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

  function sidecarPath(relativePath) {
    const normalized = normalizeRelativePath(relativePath);
    if (!normalized) {
      return "";
    }
    const segments = normalized.split("/");
    const filename = segments.pop() || "";
    const stem = basename(filename, extname(filename));
    const outputRoot = resolve(outputDir);
    const absolutePath = resolve(outputRoot, "json", ...segments, `${stem}.json`);
    const pathOffset = relative(outputRoot, absolutePath);
    if (pathOffset === ".." || pathOffset.startsWith("..\\") || pathOffset.startsWith("../") || isAbsolute(pathOffset)) {
      return "";
    }
    return absolutePath;
  }

  async function recoverCreationItemSnapshot(item) {
    const metadataPath = sidecarPath(item.relativePath);
    if (!metadataPath) {
      return item;
    }

    let sidecar;
    try {
      sidecar = JSON.parse((await readFile(metadataPath, "utf8")).replace(/^\uFEFF/, ""));
    } catch (error) {
      if (error?.code === "ENOENT") {
        return item;
      }
      throw error;
    }

    const recovered = { ...item };
    const generationPrompt = cleanString(sidecar.generationPrompt || sidecar.prompt);
    if (generationPrompt) {
      recovered.generationPrompt = generationPrompt;
    }
    for (const key of [
      "baseUrl", "imageRoute", "responsesModel", "imageModel", "endpointPath", "ratio", "ratioLabel",
      "resolutionTier", "actualSize", "format", "quality", "reasoningEffort", "generationStartedAt",
      "generationCompletedAt",
    ]) {
      const value = cleanString(sidecar[key]);
      if (value) {
        recovered[key] = value;
      }
    }
    const requestedSize = cleanString(sidecar.requestedSize || item.requestedSize || sidecar.size);
    const effectiveSize = cleanString(sidecar.effectiveSize || sidecar.size);
    if (requestedSize) {
      recovered.requestedSize = requestedSize;
    }
    if (effectiveSize) {
      recovered.effectiveSize = effectiveSize;
      recovered.size = effectiveSize;
    }
    if (hasExplicitFiniteNumber(sidecar.generationDurationMs)) {
      recovered.generationDurationMs = Number(sidecar.generationDurationMs);
    }
    if (Array.isArray(sidecar.referenceImageNames)) {
      recovered.referenceImageNames = sidecar.referenceImageNames.map(cleanString).filter(Boolean);
      recovered.referenceImageName = cleanString(sidecar.referenceImageName || recovered.referenceImageNames[0]);
      recovered.hasReferenceImage = Boolean(sidecar.hasReferenceImage || recovered.referenceImageNames.length);
    } else if (Object.prototype.hasOwnProperty.call(sidecar, "hasReferenceImage")) {
      recovered.hasReferenceImage = Boolean(sidecar.hasReferenceImage);
      recovered.referenceImageName = cleanString(sidecar.referenceImageName);
    }
    return recovered;
  }

  async function reconcileMissingCompletedItems(manifest) {
    const normalized = normalizeCreationSetManifest(manifest, { publicBasePath });
    let changed = false;
    const items = [];

    for (const normalizedItem of normalized.items) {
      const item = await recoverCreationItemSnapshot(normalizedItem);
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
      return { ...normalized, items };
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

  async function mergeTemuExcelImageCache(setIdValue, entries) {
    const setId = cleanString(setIdValue);
    if (!setId) {
      throw new Error("setId is required");
    }
    return enqueueManifestSave(setId, async () => {
      const raw = await readFile(manifestPath(setId), "utf8");
      const latest = JSON.parse(raw.replace(/^\uFEFF/, ""));
      if (cleanString(latest.setId || latest.id) !== setId) {
        const error = new Error("Creation manifest identity does not match the requested set ID.");
        error.code = "MANIFEST_ID_MISMATCH";
        throw error;
      }
      return saveManifestNow(mergeTemuImageCacheValue(latest, entries));
    });
  }

  async function mergeTemuExcelExportState(setIdValue, exportStateValue) {
    const setId = cleanString(setIdValue);
    if (!setId) {
      throw new Error("setId is required");
    }
    const exportState = normalizeTemuExcelExportState(exportStateValue);
    if (!exportState) {
      const error = new Error("Invalid Temu Excel export state.");
      error.code = "INVALID_TEMU_EXCEL_EXPORT_STATE";
      throw error;
    }
    return enqueueManifestSave(setId, async () => {
      const raw = await readFile(manifestPath(setId), "utf8");
      const latest = JSON.parse(raw.replace(/^\uFEFF/, ""));
      if (cleanString(latest.setId || latest.id) !== setId) {
        const error = new Error("Creation manifest identity does not match the requested set ID.");
        error.code = "MANIFEST_ID_MISMATCH";
        throw error;
      }
      return saveManifestNow({
        ...latest,
        temuExcelExportState: exportState,
        updatedAt: latest.updatedAt,
      });
    });
  }

  async function deleteManifestNow(setId) {
    const targetManifestPath = manifestPath(setId);
    let rawManifest;
    try {
      rawManifest = JSON.parse((await readFile(targetManifestPath, "utf8")).replace(/^\uFEFF/, ""));
    } catch (error) {
      if (error?.code === "ENOENT") {
        return { setId, deleted: false, skippedUnsafePaths: [] };
      }
      throw error;
    }

    const storedSetId = cleanString(rawManifest?.setId || rawManifest?.id);
    if (storedSetId !== setId) {
      return { setId, deleted: false, skippedUnsafePaths: [] };
    }

    const relativeDir = cleanString(rawManifest.relativeDir);
    const imageDirectory = resolveDedicatedCreationDirectory(relativeDir);
    const metadataDirectory = resolveDedicatedCreationDirectory(relativeDir, { metadata: true });
    const skippedUnsafePaths = [];
    if (relativeDir && (!imageDirectory || !metadataDirectory)) {
      skippedUnsafePaths.push(relativeDir);
    } else if (relativeDir) {
      const imageRemoved = await removeVerifiedCreationDirectory(imageDirectory);
      const metadataRemoved = await removeVerifiedCreationDirectory(metadataDirectory);
      if (!imageRemoved || !metadataRemoved) skippedUnsafePaths.push(relativeDir);
    }

    await rm(targetManifestPath, { force: true });
    return { setId, deleted: true, skippedUnsafePaths };
  }

  async function deleteManifests(setIds) {
    const normalizedSetIds = normalizeCreationRecordDeleteSetIds(setIds);
    const results = await Promise.all(
      normalizedSetIds.map((setId) => enqueueManifestSave(setId, () => deleteManifestNow(setId))),
    );
    return {
      deletedSetIds: results.filter((result) => result.deleted).map((result) => result.setId),
      notFoundSetIds: results.filter((result) => !result.deleted).map((result) => result.setId),
      skippedUnsafePaths: [...new Set(results.flatMap((result) => result.skippedUnsafePaths))],
    };
  }

  return {
    manifestsDir,
    saveManifest,
    mergeTemuExcelImageCache,
    mergeTemuExcelExportState,
    readManifest,
    listManifests,
    deleteManifests,
    manifestPath,
  };
}
