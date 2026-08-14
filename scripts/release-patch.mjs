import { access, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectRootDir = resolve(scriptsDir, "..");
const maintainedVersionFiles = [
  "public/index.html",
  "README.md",
  "README.zh-CN.md",
  "docs/windows-desktop.md",
  "docs/windows-installer.md",
];

export function incrementPatchVersion(version) {
  const match = String(version || "").trim().match(/^(\d+)\.(\d+)\.(\d+)$/);
  if (!match) {
    throw new Error(`Expected a stable semantic version, received: ${version || "empty"}`);
  }
  return `${match[1]}.${match[2]}.${Number(match[3]) + 1}`;
}

function replaceMaintainedVersion(content, previousVersion, version, relativePath) {
  if (!content.includes(previousVersion)) {
    throw new Error(`${relativePath} does not contain the current version ${previousVersion}`);
  }
  return content.replaceAll(previousVersion, version);
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

export async function bumpPatchRelease({ rootDir = projectRootDir, summary } = {}) {
  const normalizedSummary = String(summary || "").trim();
  if (!normalizedSummary) {
    throw new Error("Patch release summary is required");
  }

  const packagePath = join(rootDir, "package.json");
  const lockPath = join(rootDir, "package-lock.json");
  const [packageSource, lockSource, ...maintainedSources] = await Promise.all([
    readFile(packagePath, "utf8"),
    readFile(lockPath, "utf8"),
    ...maintainedVersionFiles.map((relativePath) => readFile(join(rootDir, relativePath), "utf8")),
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
    await access(releaseNotePath);
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

  await Promise.all([
    writeFile(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`, "utf8"),
    writeFile(lockPath, `${JSON.stringify(packageLock, null, 2)}\n`, "utf8"),
    ...maintainedVersionFiles.map((relativePath, index) =>
      writeFile(join(rootDir, relativePath), updatedMaintainedSources[index], "utf8"),
    ),
    writeFile(releaseNotePath, buildReleaseNote({ previousVersion, version, summary: normalizedSummary }), "utf8"),
  ]);

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
