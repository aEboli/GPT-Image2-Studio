import { mkdir, readdir, readFile, rename, rmdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, extname, isAbsolute, join, relative, resolve } from "node:path";

const DATE_FOLDER_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_FOLDER_PATTERN = /^\d{2}-\d{2}$/;
const LEGACY_MONTH_FOLDER_PATTERN = /^\d{2}$/;
const YEAR_MONTH_FOLDER_PATTERN = /^\d{4}-\d{2}$/;
const OUTPUT_URL_PATTERN = /^\/output\/(.+)$/;

function normalizeRelativePath(value) {
  return String(value || "")
    .replace(/\\/g, "/")
    .split("/")
    .filter(Boolean)
    .join("/");
}

function isDateFolderName(value) {
  return DATE_FOLDER_PATTERN.test(String(value || ""));
}

function datePathPartsFromDateFolder(dateFolder) {
  const normalized = String(dateFolder || "");
  return {
    yearMonthFolder: normalized.slice(0, 7),
    dayFolder: normalized.slice(5, 10),
  };
}

async function pathStat(filePath) {
  try {
    return await stat(filePath);
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

function assertWithinBase(baseDir, targetPath) {
  const base = resolve(baseDir);
  const target = resolve(targetPath);
  const pathFromBase = relative(base, target);
  if (pathFromBase.startsWith("..") || isAbsolute(pathFromBase)) {
    throw new Error("输出目录迁移路径无效。");
  }
}

async function uniqueTargetPath(targetPath) {
  if (!(await pathStat(targetPath))) {
    return targetPath;
  }

  const extension = extname(targetPath);
  const stem = extension ? targetPath.slice(0, -extension.length) : targetPath;
  for (let index = 1; index < 1000; index += 1) {
    const nextPath = `${stem}-${index}${extension}`;
    if (!(await pathStat(nextPath))) {
      return nextPath;
    }
  }

  throw new Error(`无法为迁移文件创建唯一名称: ${basename(targetPath)}`);
}

async function moveDirectoryContents({ baseDir, sourcePath, targetPath }) {
  assertWithinBase(baseDir, sourcePath);
  assertWithinBase(baseDir, targetPath);

  const sourceStat = await pathStat(sourcePath);
  if (!sourceStat?.isDirectory()) {
    return false;
  }

  await mkdir(targetPath, { recursive: true });
  const entries = await readdir(sourcePath, { withFileTypes: true });
  for (const entry of entries) {
    const sourceChild = join(sourcePath, entry.name);
    const targetChild = join(targetPath, entry.name);
    const targetStat = await pathStat(targetChild);

    if (entry.isDirectory() && targetStat?.isDirectory()) {
      await moveDirectoryContents({ baseDir, sourcePath: sourceChild, targetPath: targetChild });
      continue;
    }

    await mkdir(dirname(targetChild), { recursive: true });
    await rename(sourceChild, await uniqueTargetPath(targetChild));
  }

  await rmdir(sourcePath);
  return true;
}

async function removeDirectoryIfEmpty(targetPath) {
  try {
    await rmdir(targetPath);
  } catch (error) {
    if (
      !(
        error &&
        typeof error === "object" &&
        (error.code === "ENOENT" || error.code === "ENOTEMPTY" || error.code === "EEXIST")
      )
    ) {
      throw error;
    }
  }
}

async function moveDateFolderIntoYearMonth({ baseDir, rootPath, sourcePath, dateFolder }) {
  const { yearMonthFolder, dayFolder } = datePathPartsFromDateFolder(dateFolder);
  const targetPath = join(rootPath, yearMonthFolder, dayFolder);
  if (resolve(sourcePath) === resolve(targetPath)) {
    return false;
  }

  return moveDirectoryContents({ baseDir, sourcePath, targetPath });
}

async function moveDateFoldersIntoYearMonth({ baseDir, relativeRoot = "" }) {
  const rootPath = relativeRoot ? join(baseDir, ...normalizeRelativePath(relativeRoot).split("/")) : baseDir;
  const rootStat = await pathStat(rootPath);
  if (!rootStat?.isDirectory()) {
    return 0;
  }

  let movedCount = 0;
  const entries = await readdir(rootPath, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const sourcePath = join(rootPath, entry.name);
    if (isDateFolderName(entry.name)) {
      if (await moveDateFolderIntoYearMonth({ baseDir, rootPath, sourcePath, dateFolder: entry.name })) {
        movedCount += 1;
      }
      continue;
    }

    if (!LEGACY_MONTH_FOLDER_PATTERN.test(entry.name)) {
      continue;
    }

    const legacyEntries = await readdir(sourcePath, { withFileTypes: true });
    for (const legacyEntry of legacyEntries) {
      if (!legacyEntry.isDirectory() || !isDateFolderName(legacyEntry.name)) {
        continue;
      }

      if (
        await moveDateFolderIntoYearMonth({
          baseDir,
          rootPath,
          sourcePath: join(sourcePath, legacyEntry.name),
          dateFolder: legacyEntry.name,
        })
      ) {
        movedCount += 1;
      }
    }

    await removeDirectoryIfEmpty(sourcePath);
  }

  return movedCount;
}

function migrateDatePathSegments(segments) {
  const [first = "", second = "", ...rest] = segments;
  if (YEAR_MONTH_FOLDER_PATTERN.test(first) && DAY_FOLDER_PATTERN.test(second)) {
    return segments;
  }

  if (LEGACY_MONTH_FOLDER_PATTERN.test(first) && isDateFolderName(second)) {
    const { yearMonthFolder, dayFolder } = datePathPartsFromDateFolder(second);
    return [yearMonthFolder, dayFolder, ...rest];
  }

  if (isDateFolderName(first)) {
    const { yearMonthFolder, dayFolder } = datePathPartsFromDateFolder(first);
    return [yearMonthFolder, dayFolder, ...segments.slice(1)];
  }

  return segments;
}

function migrateDatePrefixedRelativePath(value) {
  const normalized = normalizeRelativePath(value);
  if (!normalized) {
    return normalized;
  }

  const segments = normalized.split("/").filter(Boolean);
  if (segments[0] === "json") {
    return ["json", ...migrateDatePathSegments(segments.slice(1))].join("/");
  }

  return migrateDatePathSegments(segments).join("/");
}

function buildOutputUrl(relativePath) {
  const normalized = normalizeRelativePath(relativePath);
  return normalized ? `/output/${normalized}` : "";
}

function migrateOutputUrl(value) {
  const text = String(value || "").trim();
  const match = text.match(OUTPUT_URL_PATTERN);
  if (!match) {
    return text;
  }

  return buildOutputUrl(migrateDatePrefixedRelativePath(match[1]));
}

function migratePptManifestPayload(payload) {
  let changed = false;
  const next = { ...payload };
  const nextPptxRelativePath = migrateDatePrefixedRelativePath(
    next.pptxRelativePath || String(next.pptxUrl || "").replace(/^\/?output\/?/, ""),
  );

  if (nextPptxRelativePath && nextPptxRelativePath !== normalizeRelativePath(next.pptxRelativePath)) {
    next.pptxRelativePath = nextPptxRelativePath;
    next.pptxUrl = buildOutputUrl(nextPptxRelativePath);
    changed = true;
  } else if (next.pptxUrl && migrateOutputUrl(next.pptxUrl) !== next.pptxUrl) {
    next.pptxUrl = migrateOutputUrl(next.pptxUrl);
    changed = true;
  }

  if (Array.isArray(next.slides)) {
    next.slides = next.slides.map((slide) => {
      const migratedSlide = { ...slide };
      const nextRelativePath = migrateDatePrefixedRelativePath(
        migratedSlide.relativePath || String(migratedSlide.imageUrl || "").replace(/^\/?output\/?/, ""),
      );

      if (nextRelativePath && nextRelativePath !== normalizeRelativePath(migratedSlide.relativePath)) {
        migratedSlide.relativePath = nextRelativePath;
        migratedSlide.imageUrl = buildOutputUrl(nextRelativePath);
        migratedSlide.thumbnailUrl = buildOutputUrl(nextRelativePath);
        changed = true;
        return migratedSlide;
      }

      for (const field of ["imageUrl", "thumbnailUrl"]) {
        const migratedUrl = migrateOutputUrl(migratedSlide[field]);
        if (migratedUrl && migratedUrl !== migratedSlide[field]) {
          migratedSlide[field] = migratedUrl;
          changed = true;
        }
      }

      return migratedSlide;
    });
  }

  return { changed, payload: next };
}

function migrateCreationManifestPayload(payload) {
  let changed = false;
  const next = { ...payload };
  const nextRelativeDir = migrateDatePrefixedRelativePath(next.relativeDir);

  if (nextRelativeDir && nextRelativeDir !== normalizeRelativePath(next.relativeDir)) {
    next.relativeDir = nextRelativeDir;
    changed = true;
  }

  if (Array.isArray(next.items)) {
    next.items = next.items.map((item) => {
      const migratedItem = { ...item };
      const nextRelativePath = migrateDatePrefixedRelativePath(migratedItem.relativePath);

      if (nextRelativePath && nextRelativePath !== normalizeRelativePath(migratedItem.relativePath)) {
        migratedItem.relativePath = nextRelativePath;
        changed = true;
      }

      for (const field of ["imageUrl", "thumbnailUrl"]) {
        const migratedUrl = migrateOutputUrl(migratedItem[field]);
        if (migratedUrl && migratedUrl !== migratedItem[field]) {
          migratedItem[field] = migratedUrl;
          changed = true;
        }
      }

      return migratedItem;
    });
  }

  return { changed, payload: next };
}

async function migratePptManifests({ outputDir }) {
  const manifestsDir = join(outputDir, "json", "ppt-decks");
  const manifestsStat = await pathStat(manifestsDir);
  if (!manifestsStat?.isDirectory()) {
    return 0;
  }

  let updatedCount = 0;
  const entries = await readdir(manifestsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = join(manifestsDir, entry.name);
    const raw = await readFile(filePath, "utf8");
    const { changed, payload } = migratePptManifestPayload(JSON.parse(raw.replace(/^\uFEFF/, "")));
    if (!changed) {
      continue;
    }

    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    updatedCount += 1;
  }

  return updatedCount;
}

async function migrateCreationManifests({ outputDir }) {
  const manifestsDir = join(outputDir, "json", "creation-sets");
  const manifestsStat = await pathStat(manifestsDir);
  if (!manifestsStat?.isDirectory()) {
    return 0;
  }

  let updatedCount = 0;
  const entries = await readdir(manifestsDir, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const filePath = join(manifestsDir, entry.name);
    const raw = await readFile(filePath, "utf8");
    const { changed, payload } = migrateCreationManifestPayload(JSON.parse(raw.replace(/^\uFEFF/, "")));
    if (!changed) {
      continue;
    }

    await writeFile(filePath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");
    updatedCount += 1;
  }

  return updatedCount;
}

export async function migrateOutputDirectoryMonths({ outputDir }) {
  await mkdir(outputDir, { recursive: true });
  const movedDateFolders = await moveDateFoldersIntoYearMonth({ baseDir: outputDir });
  const movedMetadataDateFolders = await moveDateFoldersIntoYearMonth({ baseDir: outputDir, relativeRoot: "json" });
  const updatedPptManifests = await migratePptManifests({ outputDir });
  const updatedCreationManifests = await migrateCreationManifests({ outputDir });

  return {
    movedDateFolders,
    movedMetadataDateFolders,
    updatedPptManifests,
    updatedCreationManifests,
  };
}
