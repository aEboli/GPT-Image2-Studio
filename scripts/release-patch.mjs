import { randomUUID } from "node:crypto";
import { access, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

import { replaceWorkbenchVersionFact } from "./check-release-readiness.mjs";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectRootDir = resolve(scriptsDir, "..");
const defaultFileOperations = { access, readFile, rename, stat, unlink, writeFile };
const maintainedVersionFiles = [
  {
    relativePath: "public/index.html",
    replace: (content, previousVersion, version) =>
      replaceWorkbenchVersionFact(content, `v${previousVersion}`, `v${version}`),
  },
  {
    relativePath: "README.md",
    factPattern: /^Current version:\s*`(v[0-9A-Za-z.+-]+)`\s*$/gmu,
  },
  {
    relativePath: "README.zh-CN.md",
    factPattern: /^当前版本：\s*`(v[0-9A-Za-z.+-]+)`\s*$/gmu,
  },
  {
    relativePath: "docs/windows-desktop.md",
    factPattern: /^`GPT-Image2-Studio-Desktop-Setup-(v[0-9A-Za-z.+-]+)-x64\.exe`\s+是/gmu,
  },
  {
    relativePath: "docs/windows-installer.md",
    factPattern: /^`GPT-Image2-Studio-Setup-(v[0-9A-Za-z.+-]+)\.exe`\s+是/gmu,
  },
];

export function incrementPatchVersion(version) {
  const match = String(version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Expected a stable semantic version, received: ${version || "empty"}`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function replaceMaintainedVersion(content, previousVersion, version, { relativePath, factPattern, replace }) {
  if (replace) {
    return replace(content, previousVersion, version);
  }
  const matches = [...content.matchAll(factPattern)];
  if (matches.length !== 1) {
    throw new Error(`${relativePath} must contain exactly one maintained current-version fact`);
  }
  const previousVersionLabel = `v${previousVersion}`;
  if (matches[0][1] !== previousVersionLabel) {
    throw new Error(`${relativePath} current version must match ${previousVersionLabel}`);
  }
  const match = matches[0];
  const replacement = match[0].replace(previousVersion, version);
  const updatedContent = `${content.slice(0, match.index)}${replacement}${content.slice(match.index + match[0].length)}`;
  const updatedMatches = [...updatedContent.matchAll(factPattern)];
  if (updatedMatches.length !== 1 || updatedMatches[0][1] !== `v${version}`) {
    throw new Error(`${relativePath} updated current-version fact is invalid`);
  }
  return updatedContent;
}

async function removeFileIfPresent(path, fileOperations) {
  try {
    await fileOperations.unlink(path);
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ENOENT")) {
      throw error;
    }
  }
}

function describeError(error) {
  return error instanceof Error ? error.message : String(error);
}

function createOperationError(label, error, path) {
  const contextualError = new Error(`${label}: ${describeError(error)}`, { cause: error });
  if (path) {
    contextualError.path = path;
  }
  return contextualError;
}

function createTransactionError(message, errors, details = {}) {
  const transactionError = new AggregateError(errors, `${message}: ${errors.map(describeError).join("; ")}`);
  Object.assign(transactionError, details);
  return transactionError;
}

async function cleanupTransactionFiles(entries, pathKey, fileOperations, label) {
  const cleanupEntries = entries.filter((entry) => entry[pathKey]);
  const results = await Promise.allSettled(
    cleanupEntries.map((entry) => removeFileIfPresent(entry[pathKey], fileOperations)),
  );
  return results.flatMap((result, index) =>
    result.status === "rejected"
      ? [
          createOperationError(
            `${label} for ${cleanupEntries[index].relativePath} (${cleanupEntries[index][pathKey]})`,
            result.reason,
            cleanupEntries[index][pathKey],
          ),
        ]
      : [],
  );
}

async function validateWriteTargets(targets, fileOperations) {
  await Promise.all(
    targets.map(async ({ path, relativePath, existing }) => {
      let parentStats;
      try {
        parentStats = await fileOperations.stat(dirname(path));
      } catch (error) {
        throw new Error(
          `${dirname(relativePath)} parent directory is unavailable: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
      if (!parentStats.isDirectory()) {
        throw new Error(`${dirname(relativePath)} parent directory is unavailable`);
      }
      if (!existing) {
        return;
      }
      const targetStats = await fileOperations.stat(path);
      if (!targetStats.isFile()) {
        throw new Error(`${relativePath} must be a regular file`);
      }
    }),
  );
}

async function writeFilesTransaction(targets, fileOperations) {
  const transactionId = `${process.pid}-${randomUUID()}`;
  const entries = targets.map((target) => ({
    ...target,
    temporaryPath: join(dirname(target.path), `.${basename(target.path)}.${transactionId}.tmp`),
    backupPath: target.existing
      ? join(dirname(target.path), `.${basename(target.path)}.${transactionId}.bak`)
      : null,
    backupCreated: false,
    installed: false,
  }));

  const staged = await Promise.allSettled(
    entries.map((entry) =>
      fileOperations.writeFile(entry.temporaryPath, entry.content, { encoding: "utf8", flag: "wx" }),
    ),
  );
  const stageFailureResults = staged.flatMap((result, index) =>
    result.status === "rejected"
      ? [{ relativePath: entries[index].relativePath, reason: result.reason }]
      : [],
  );
  if (stageFailureResults.length) {
    const stageFailures = stageFailureResults.map(({ relativePath, reason }) =>
      createOperationError(`Staging temporary file for ${relativePath}`, reason),
    );
    const cleanupFailures = await cleanupTransactionFiles(
      entries,
      "temporaryPath",
      fileOperations,
      "Temporary-file cleanup failed",
    );
    if (cleanupFailures.length) {
      throw createTransactionError(
        "Patch release staging failed; no version files were committed and temporary-file cleanup was incomplete",
        [...stageFailures, ...cleanupFailures],
        {
          stageFailures,
          cleanupFailures,
          pendingTemporaryPaths: cleanupFailures.map((failure) => failure.path).filter(Boolean),
          committed: false,
        },
      );
    }
    throw createTransactionError(
      "Patch release staging failed; no version files were committed",
      stageFailures,
      { stageFailures, cleanupFailures, pendingTemporaryPaths: [], committed: false },
    );
  }

  let commitOperation = "Committing patch release";
  try {
    for (const entry of entries) {
      if (entry.existing) {
        commitOperation = `Creating backup for ${entry.relativePath}`;
        await fileOperations.rename(entry.path, entry.backupPath);
        entry.backupCreated = true;
      }
      commitOperation = `Installing staged file for ${entry.relativePath}`;
      await fileOperations.rename(entry.temporaryPath, entry.path);
      entry.installed = true;
    }
  } catch (error) {
    const rollbackFailures = [];
    for (const entry of [...entries].reverse()) {
      if (entry.installed) {
        try {
          await removeFileIfPresent(entry.path, fileOperations);
          entry.installed = false;
        } catch (rollbackError) {
          rollbackFailures.push(
            createOperationError(`Removing installed file during rollback for ${entry.relativePath}`, rollbackError),
          );
        }
      }
      if (entry.backupCreated) {
        try {
          await fileOperations.rename(entry.backupPath, entry.path);
          entry.backupCreated = false;
        } catch (rollbackError) {
          rollbackFailures.push(
            createOperationError(
              `Restoring backup during rollback for ${entry.relativePath} (${entry.backupPath})`,
              rollbackError,
              entry.backupPath,
            ),
          );
        }
      }
    }
    const cleanupFailures = await cleanupTransactionFiles(
      entries,
      "temporaryPath",
      fileOperations,
      "Temporary-file cleanup failed",
    );
    const failures = [error, ...rollbackFailures, ...cleanupFailures];
    const pendingBackupPaths = entries
      .filter((entry) => entry.backupCreated)
      .map((entry) => entry.backupPath)
      .filter(Boolean);
    const pendingTemporaryPaths = cleanupFailures.map((failure) => failure.path).filter(Boolean);
    if (rollbackFailures.length) {
      throw createTransactionError(
        "Patch release failed and rollback was incomplete",
        failures,
        {
          originalError: error,
          operation: commitOperation,
          rollbackFailures,
          cleanupFailures,
          pendingBackupPaths,
          pendingTemporaryPaths,
          committed: false,
        },
      );
    }
    if (cleanupFailures.length) {
      throw createTransactionError(
        "Patch release failed; version files were rolled back, but transaction cleanup was incomplete",
        failures,
        {
          originalError: error,
          operation: commitOperation,
          rollbackFailures,
          cleanupFailures,
          pendingBackupPaths,
          pendingTemporaryPaths,
          committed: false,
        },
      );
    }
    throw createTransactionError(
      "Patch release failed; version files were rolled back",
      [error],
      {
        originalError: error,
        operation: commitOperation,
        rollbackFailures,
        cleanupFailures,
        pendingBackupPaths,
        pendingTemporaryPaths,
        committed: false,
      },
    );
  }

  const backupCleanupFailures = await cleanupTransactionFiles(
    entries.filter((entry) => entry.backupCreated),
    "backupPath",
    fileOperations,
    "Backup cleanup failed",
  );
  if (backupCleanupFailures.length) {
    throw createTransactionError(
      "Patch release was committed, but backup cleanup was incomplete; version files remain updated",
      backupCleanupFailures,
      {
        committed: true,
        backupCleanupFailures,
        pendingBackupPaths: backupCleanupFailures.map((failure) => failure.path).filter(Boolean),
      },
    );
  }
}

function buildReleaseNote({ previousVersion, version, summary }) {
  return `# GPT-Image2-Studio v${version}

\`v${version}\` 将主应用版本从 \`${previousVersion}\` 更新到 \`${version}\`。

## 更新内容

- ${summary}

## 升级说明

- 主应用每次更新仅递增一个补丁版本，即 \`+0.0.1\`。
- 既有配置、生成记录和图片资产不需要迁移。
- 商品图采集扩展使用独立版本线，本次主应用更新不会修改扩展版本。

## 验证

- 发布前需运行项目测试、构建、发行一致性检查和 OpenSpec 严格校验；实际结果以本次发布交付记录为准。
`;
}

export async function bumpPatchRelease({ rootDir = projectRootDir, summary, fileOperations } = {}) {
  const normalizedSummary = String(summary || "").trim();
  if (!normalizedSummary) {
    throw new Error("Patch release summary is required");
  }

  const operations = { ...defaultFileOperations, ...fileOperations };
  const packagePath = join(rootDir, "package.json");
  const lockPath = join(rootDir, "package-lock.json");
  const [packageSource, lockSource, ...maintainedSources] = await Promise.all([
    operations.readFile(packagePath, "utf8"),
    operations.readFile(lockPath, "utf8"),
    ...maintainedVersionFiles.map(({ relativePath }) => operations.readFile(join(rootDir, relativePath), "utf8")),
  ]);
  const packageJson = JSON.parse(packageSource);
  const packageLock = JSON.parse(lockSource);
  const previousVersion = String(packageJson.version || "").trim();
  const version = incrementPatchVersion(previousVersion);
  const versionLabel = `v${version}`;

  if (packageLock.version !== previousVersion || packageLock.packages?.[""]?.version !== previousVersion) {
    throw new Error(`package-lock.json must match package.json version ${previousVersion} before updating`);
  }

  const releaseNotePath = join(rootDir, "docs", "releases", `${versionLabel}.md`);
  try {
    await operations.access(releaseNotePath);
    throw new Error(`Release note already exists: docs/releases/${versionLabel}.md`);
  } catch (error) {
    if (!(error && typeof error === "object" && error.code === "ENOENT")) {
      throw error;
    }
  }

  const updatedMaintainedSources = maintainedSources.map((content, index) =>
    replaceMaintainedVersion(content, previousVersion, version, maintainedVersionFiles[index]),
  );
  packageJson.version = version;
  packageLock.version = version;
  packageLock.packages[""].version = version;

  const targets = [
    {
      path: packagePath,
      relativePath: "package.json",
      content: `${JSON.stringify(packageJson, null, 2)}\n`,
      existing: true,
    },
    {
      path: lockPath,
      relativePath: "package-lock.json",
      content: `${JSON.stringify(packageLock, null, 2)}\n`,
      existing: true,
    },
    ...maintainedVersionFiles.map(({ relativePath }, index) => ({
      path: join(rootDir, relativePath),
      relativePath,
      content: updatedMaintainedSources[index],
      existing: true,
    })),
    {
      path: releaseNotePath,
      relativePath: `docs/releases/${versionLabel}.md`,
      content: buildReleaseNote({ previousVersion, version, summary: normalizedSummary }),
      existing: false,
    },
  ];
  await validateWriteTargets(targets, operations);
  await writeFilesTransaction(targets, operations);

  return { previousVersion, version, versionLabel };
}

function readSummaryArgument(args) {
  const summaryIndex = args.indexOf("--summary");
  return summaryIndex >= 0 ? args[summaryIndex + 1] : "";
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const result = await bumpPatchRelease({ summary: readSummaryArgument(process.argv.slice(2)) });
    console.log(`主应用版本已从 v${result.previousVersion} 更新到 ${result.versionLabel}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
