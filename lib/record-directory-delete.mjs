import { lstat, realpath, rm } from "node:fs/promises";
import { isAbsolute, relative, resolve } from "node:path";

function cleanRelativePath(value) {
  return String(value || "").trim().replace(/\\/g, "/");
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

async function removeVerifiedDirectory(outputDir, target) {
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
  if (!targetStat.isDirectory()) {
    return false;
  }

  const outputRoot = await realpath(resolve(outputDir)).catch(() => resolve(outputDir));
  const realTarget = await realpath(target);
  if (!isStrictDescendant(outputRoot, realTarget)) {
    return false;
  }

  await rm(target, { recursive: true, force: true });
  return true;
}

export function createRecordDirectoryDeleteGuard({
  outputDir,
  manifestsDir,
  markerPattern,
}) {
  const outputRoot = resolve(outputDir);
  const manifestRoot = resolve(manifestsDir);

  function resolveDirectory(relativeDir, { metadata = false } = {}) {
    const rawRelativeDir = cleanRelativePath(relativeDir);
    if (!rawRelativeDir || isAbsolute(rawRelativeDir) || rawRelativeDir.startsWith("/")) {
      return null;
    }

    const segments = rawRelativeDir.split("/");
    if (segments.some((segment) => !segment || segment === "." || segment === "..")) {
      return null;
    }
    const markerIndex = segments.findIndex((segment) => markerPattern.test(segment));
    if (markerIndex < 0 || markerIndex >= segments.length - 1) {
      return null;
    }

    const target = resolve(outputRoot, ...(metadata ? ["json"] : []), ...segments);
    if (!isStrictDescendant(outputRoot, target)) {
      return null;
    }
    if (target === manifestRoot || isStrictDescendant(manifestRoot, target)) {
      return null;
    }
    return target;
  }

  async function deleteDedicatedDirectories(relativeDir) {
    const normalizedRelativeDir = cleanRelativePath(relativeDir);
    if (!normalizedRelativeDir) {
      return { skipped: false };
    }
    const imageDirectory = resolveDirectory(normalizedRelativeDir);
    const metadataDirectory = resolveDirectory(normalizedRelativeDir, { metadata: true });
    if (!imageDirectory || !metadataDirectory) {
      return { skipped: true };
    }

    const imageRemoved = await removeVerifiedDirectory(outputRoot, imageDirectory);
    const metadataRemoved = await removeVerifiedDirectory(outputRoot, metadataDirectory);
    return { skipped: !imageRemoved || !metadataRemoved };
  }

  return {
    deleteDedicatedDirectories,
    resolveDirectory,
  };
}

export async function removeVerifiedOutputFile({
  outputDir,
  relativePath,
  allowedExtensions = [],
}) {
  const normalized = cleanRelativePath(relativePath);
  const segments = normalized.split("/");
  if (
    !normalized ||
    isAbsolute(normalized) ||
    normalized.startsWith("/") ||
    segments.some((segment) => !segment || segment === "." || segment === "..")
  ) {
    return { removed: false, unsafe: true };
  }

  const target = resolve(outputDir, ...segments);
  if (!isStrictDescendant(outputDir, target)) {
    return { removed: false, unsafe: true };
  }
  const normalizedExtensions = allowedExtensions.map((extension) => String(extension).toLowerCase());
  if (normalizedExtensions.length > 0 && !normalizedExtensions.some((extension) => target.toLowerCase().endsWith(extension))) {
    return { removed: false, unsafe: true };
  }

  let targetStat;
  try {
    targetStat = await lstat(target);
  } catch (error) {
    if (error?.code === "ENOENT") return { removed: false, unsafe: false };
    throw error;
  }
  if (!targetStat.isFile() && !targetStat.isSymbolicLink()) {
    return { removed: false, unsafe: true };
  }
  await rm(target, { force: true });
  return { removed: true, unsafe: false };
}
