import { mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { basename, extname, isAbsolute, join, relative, resolve } from "node:path";

import { normalizeAssetRecordDeleteIds } from "./asset-record-delete.mjs";
import { normalizePptExportMode } from "./ppt-export-mode.mjs";
import { createRecordDirectoryDeleteGuard, removeVerifiedOutputFile } from "./record-directory-delete.mjs";

const PPTX_EXTENSION = ".pptx";
const DATE_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const LEGACY_MONTH_FOLDER_PATTERN = /^\d{2}$/;
const YEAR_MONTH_FOLDER_PATTERN = /^\d{4}-\d{2}$/;

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

function buildOutputUrl(publicBasePath, relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return normalized ? `${publicBasePath.replace(/\/+$/, "")}/${normalized}` : "";
}

function titleFromPptxPath(relativePath) {
  const filename = basename(normalizeRelativePath(relativePath));
  return filename.toLowerCase().endsWith(PPTX_EXTENSION)
    ? filename.slice(0, -PPTX_EXTENSION.length)
    : filename;
}

function makeFolderDeckId(relativePath) {
  return `ppt-file-${Buffer.from(normalizeRelativePath(relativePath)).toString("base64url").slice(0, 96)}`;
}

function shouldScanPptFolder(relativeDir, entryName) {
  if (!relativeDir) {
    return (
      YEAR_MONTH_FOLDER_PATTERN.test(entryName) ||
      LEGACY_MONTH_FOLDER_PATTERN.test(entryName) ||
      DATE_FOLDER_PATTERN.test(entryName)
    );
  }

  const depth = relativeDir.split("/").filter(Boolean).length;
  return depth < 4 && entryName !== "json";
}

function inferFolderPptCreatedAt(relativePath, fileStat) {
  if (fileStat?.mtime instanceof Date && !Number.isNaN(fileStat.mtime.getTime())) {
    return fileStat.mtime.toISOString();
  }

  const dateFolder = normalizeRelativePath(relativePath).match(/(?:^|\/)(\d{4}-\d{2}-\d{2})(?:\/|$)/)?.[1];
  return dateFolder ? `${dateFolder}T00:00:00.000Z` : new Date().toISOString();
}

function normalizeSlide(slide, publicBasePath) {
  const relativePath = normalizeRelativePath(slide?.relativePath);
  return {
    slideNumber: Number(slide?.slideNumber) || 0,
    title: cleanString(slide?.title),
    filename: cleanString(slide?.filename) || basename(relativePath),
    relativePath,
    imageUrl: cleanString(slide?.imageUrl) || buildOutputUrl(publicBasePath, relativePath),
    thumbnailUrl: cleanString(slide?.thumbnailUrl) || buildOutputUrl(publicBasePath, relativePath),
    prompt: cleanString(slide?.prompt),
  };
}

export function normalizePptDeckManifest(manifest = {}, { publicBasePath = "/output" } = {}) {
  const pptxRelativePath = normalizeRelativePath(manifest.pptxRelativePath || manifest.pptxUrl?.replace(/^\/?output\/?/, ""));
  const editablePptxRelativePath = normalizeRelativePath(
    manifest.editablePptxRelativePath || manifest.editablePptxUrl?.replace(/^\/?output\/?/, ""),
  );
  const slides = Array.isArray(manifest.slides)
    ? manifest.slides.map((slide) => normalizeSlide(slide, publicBasePath)).sort((a, b) => a.slideNumber - b.slideNumber)
    : [];

  return {
    deckId: cleanString(manifest.deckId || manifest.id),
    title: cleanString(manifest.title) || "未命名演示文稿",
    pageCount: Number(manifest.pageCount) || slides.length,
    createdAt: cleanString(manifest.createdAt) || new Date().toISOString(),
    sources: manifest.sources && typeof manifest.sources === "object" ? manifest.sources : {},
    outline: manifest.outline && typeof manifest.outline === "object" ? manifest.outline : null,
    slides,
    pptxRelativePath,
    pptxUrl: cleanString(manifest.pptxUrl) || buildOutputUrl(publicBasePath, pptxRelativePath),
    pptxFilename: cleanString(manifest.pptxFilename) || basename(pptxRelativePath),
    editablePptxRelativePath,
    editablePptxUrl: cleanString(manifest.editablePptxUrl) || buildOutputUrl(publicBasePath, editablePptxRelativePath),
    editablePptxFilename: cleanString(manifest.editablePptxFilename) || basename(editablePptxRelativePath),
    editablePptxWarnings: Array.isArray(manifest.editablePptxWarnings)
      ? manifest.editablePptxWarnings.map(cleanString).filter(Boolean)
      : [],
    exportMode: normalizePptExportMode(manifest.exportMode),
    fileSize: Number(manifest.fileSize) || 0,
    responsesModel: cleanString(manifest.responsesModel),
    imageModel: cleanString(manifest.imageModel || "gpt-image-2"),
    reasoningEffort: cleanString(manifest.reasoningEffort),
    recordSource: cleanString(manifest.recordSource) || "manifest",
  };
}

async function collectFolderPptRecords({ outputDir, publicBasePath, relativeDir = "" }) {
  let entries = [];
  try {
    entries = await readdir(join(outputDir, relativeDir), { withFileTypes: true });
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return [];
    }
    throw error;
  }

  const records = [];
  for (const entry of entries) {
    const relativePath = normalizeRelativePath(relativeDir ? `${relativeDir}/${entry.name}` : entry.name);
    const absolutePath = join(outputDir, relativePath);

    if (entry.isDirectory()) {
      if (shouldScanPptFolder(relativeDir, entry.name)) {
        records.push(...(await collectFolderPptRecords({ outputDir, publicBasePath, relativeDir: relativePath })));
      }
      continue;
    }

    if (!entry.isFile() || !entry.name.toLowerCase().endsWith(PPTX_EXTENSION)) {
      continue;
    }

    const fileStat = await stat(absolutePath);
    records.push(
      normalizePptDeckManifest(
        {
          deckId: makeFolderDeckId(relativePath),
          title: titleFromPptxPath(relativePath),
          pageCount: 0,
          createdAt: inferFolderPptCreatedAt(relativePath, fileStat),
          slides: [],
          pptxRelativePath: relativePath,
          pptxFilename: basename(relativePath),
          fileSize: fileStat.size,
          recordSource: "folder",
        },
        { publicBasePath },
      ),
    );
  }

  return records;
}

function getPptRecordKey(record) {
  return record.pptxRelativePath || record.deckId;
}

function getPptBrowserRecordKey(record) {
  return cleanString(record?.deckId || record?.pptxRelativePath || record?.pptxUrl || record?.pptxFilename);
}

function getPptDedicatedRelativeDir(record) {
  const paths = [
    record?.pptxRelativePath,
    record?.editablePptxRelativePath,
    ...(Array.isArray(record?.slides) ? record.slides.map((slide) => slide?.relativePath) : []),
  ];
  for (const value of paths) {
    const segments = normalizeRelativePath(value).split("/").filter(Boolean);
    const markerIndex = segments.findIndex((segment) => /^\d{4}-\d{2}-\d{2}-ppt$/u.test(segment));
    if (markerIndex >= 0 && markerIndex < segments.length - 2) {
      return segments.slice(0, markerIndex + 2).join("/");
    }
  }
  return "";
}

function getPptRecordAssetPaths(record) {
  return [...new Set([
    record?.pptxRelativePath,
    record?.editablePptxRelativePath,
    ...(Array.isArray(record?.slides) ? record.slides.map((slide) => slide?.relativePath) : []),
  ].map(normalizeRelativePath).filter(Boolean))];
}

function getPptSidecarRelativePath(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || ![".png", ".jpg", ".jpeg", ".webp"].includes(extname(normalized).toLowerCase())) {
    return "";
  }
  const segments = normalized.split("/");
  const filename = segments.pop() || "";
  return ["json", ...segments, `${basename(filename, extname(filename))}.json`].join("/");
}

function comparePptRecords(left, right) {
  const byCreatedAt = right.createdAt.localeCompare(left.createdAt);
  return byCreatedAt || left.title.localeCompare(right.title) || left.pptxRelativePath.localeCompare(right.pptxRelativePath);
}

export function createPptDeckStore({ outputDir, publicBasePath = "/output" }) {
  const manifestsDir = join(outputDir, "json", "ppt-decks");
  const deleteGuard = createRecordDirectoryDeleteGuard({
    outputDir,
    manifestsDir,
    markerPattern: /^\d{4}-\d{2}-\d{2}-ppt$/u,
  });

  function safeManifestPath(deckId) {
    const target = resolve(manifestsDir, `${cleanString(deckId)}.json`);
    const offset = relative(resolve(manifestsDir), target);
    if (!offset || offset === ".." || offset.startsWith("..\\") || offset.startsWith("../") || isAbsolute(offset)) {
      return "";
    }
    return target;
  }

  async function saveManifest(manifest) {
    const normalized = normalizePptDeckManifest(manifest, { publicBasePath });
    if (!normalized.deckId) {
      throw new Error("deckId is required");
    }

    await mkdir(manifestsDir, { recursive: true });
    const filePath = join(manifestsDir, `${normalized.deckId}.json`);
    await writeFile(filePath, `${JSON.stringify(normalized, null, 2)}\n`, "utf8");
    return normalized;
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
      manifests.push(normalizePptDeckManifest(JSON.parse(raw), { publicBasePath }));
    }

    const merged = new Map();
    for (const manifest of manifests) {
      merged.set(getPptRecordKey(manifest), manifest);
    }

    const folderRecords = await collectFolderPptRecords({ outputDir, publicBasePath });
    for (const record of folderRecords) {
      const key = getPptRecordKey(record);
      if (!merged.has(key)) {
        merged.set(key, record);
      }
    }

    return [...merged.values()].sort(comparePptRecords);
  }

  async function removeExactRecordFiles(record) {
    const skippedUnsafePaths = [];
    let removedAny = false;
    for (const relativePath of getPptRecordAssetPaths(record)) {
      const result = await removeVerifiedOutputFile({
        outputDir,
        relativePath,
        allowedExtensions: [".pptx", ".png", ".jpg", ".jpeg", ".webp"],
      });
      removedAny = removedAny || result.removed;
      if (result.unsafe) skippedUnsafePaths.push(relativePath);

      const sidecarRelativePath = getPptSidecarRelativePath(relativePath);
      if (sidecarRelativePath) {
        const sidecarResult = await removeVerifiedOutputFile({
          outputDir,
          relativePath: sidecarRelativePath,
          allowedExtensions: [".json"],
        });
        if (sidecarResult.unsafe) skippedUnsafePaths.push(sidecarRelativePath);
      }
    }
    return { removedAny, skippedUnsafePaths };
  }

  async function deleteRecord(recordKey, record) {
    if (!record) {
      return { recordKey, deleted: false, skippedUnsafePaths: [] };
    }

    let deletionRecord = record;
    let targetManifestPath = "";
    if (record.recordSource === "manifest") {
      targetManifestPath = safeManifestPath(record.deckId);
      if (!targetManifestPath) {
        return { recordKey, deleted: false, skippedUnsafePaths: [record.deckId] };
      }
      let storedManifest;
      try {
        storedManifest = JSON.parse((await readFile(targetManifestPath, "utf8")).replace(/^\uFEFF/, ""));
      } catch (error) {
        if (error?.code === "ENOENT") return { recordKey, deleted: false, skippedUnsafePaths: [] };
        throw error;
      }
      if (cleanString(storedManifest?.deckId || storedManifest?.id) !== recordKey) {
        return { recordKey, deleted: false, skippedUnsafePaths: [] };
      }
      deletionRecord = normalizePptDeckManifest(storedManifest, { publicBasePath });
    }

    const dedicatedRelativeDir = getPptDedicatedRelativeDir(deletionRecord);
    let skippedUnsafePaths = [];
    let removedAny = false;
    if (dedicatedRelativeDir) {
      const directoryResult = await deleteGuard.deleteDedicatedDirectories(dedicatedRelativeDir);
      if (directoryResult.skipped) skippedUnsafePaths.push(dedicatedRelativeDir);
      removedAny = !directoryResult.skipped;
    } else {
      const fileResult = await removeExactRecordFiles(deletionRecord);
      removedAny = fileResult.removedAny;
      skippedUnsafePaths = fileResult.skippedUnsafePaths;
    }

    if (record.recordSource === "manifest") {
      await rm(targetManifestPath, { force: true });
      return { recordKey, deleted: true, skippedUnsafePaths };
    }

    return { recordKey, deleted: removedAny, skippedUnsafePaths };
  }

  async function deleteRecords(recordKeys) {
    const normalizedRecordKeys = normalizeAssetRecordDeleteIds(recordKeys, { recordLabel: "PPT 记录" });
    const records = await listManifests();
    const recordsByKey = new Map(records.map((record) => [getPptBrowserRecordKey(record), record]));
    const results = [];
    for (const recordKey of normalizedRecordKeys) {
      results.push(await deleteRecord(recordKey, recordsByKey.get(recordKey)));
    }
    return {
      deletedRecordKeys: results.filter((result) => result.deleted).map((result) => result.recordKey),
      notFoundRecordKeys: results.filter((result) => !result.deleted).map((result) => result.recordKey),
      skippedUnsafePaths: [...new Set(results.flatMap((result) => result.skippedUnsafePaths))],
    };
  }

  return {
    manifestsDir,
    saveManifest,
    listManifests,
    deleteRecords,
    manifestPath(deckId) {
      return join(manifestsDir, `${cleanString(deckId)}.json`);
    },
  };
}
