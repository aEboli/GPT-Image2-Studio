import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const execFileAsync = promisify(execFile);
const scriptsDir = dirname(fileURLToPath(import.meta.url));
const projectRootDir = resolve(scriptsDir, "..");

async function readJson(path, label) {
  try {
    return JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    throw new Error(`${label} 无法读取或不是有效 JSON：${error instanceof Error ? error.message : String(error)}`);
  }
}

async function requireVersionFact(path, label, versionLabel, pattern) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`${label} 缺失：${error instanceof Error ? error.message : String(error)}`);
  }
  const matches = [...content.matchAll(pattern)];
  if (matches.length !== 1) {
    throw new Error(`${label} 必须包含唯一明确的当前版本事实 ${versionLabel}`);
  }
  const actualVersion = String(matches[0][1] || "").trim();
  if (actualVersion !== versionLabel) {
    throw new Error(`${label} 当前版本为 ${actualVersion || "未知"}，必须与 ${versionLabel} 一致`);
  }
}

async function runGit(rootDir, args) {
  try {
    return await execFileAsync("git", args, { cwd: rootDir, encoding: "utf8" });
  } catch (error) {
    throw new Error(`git ${args.join(" ")} 执行失败：${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function checkReleaseReadiness({ rootDir = projectRootDir, strict = false } = {}) {
  const packageJson = await readJson(join(rootDir, "package.json"), "package.json");
  const packageLock = await readJson(join(rootDir, "package-lock.json"), "package-lock.json");
  const version = String(packageJson.version || "").trim();
  if (!version) {
    throw new Error("package.json 缺少有效 version");
  }

  if (packageLock.version !== version || packageLock.packages?.[""]?.version !== version) {
    throw new Error(`package-lock.json 版本必须与 package.json 的 ${version} 一致`);
  }

  const versionLabel = `v${version}`;
  await Promise.all([
    requireVersionFact(
      join(rootDir, "README.md"),
      "README.md",
      versionLabel,
      /^当前版本：\s*`(v[0-9A-Za-z.+-]+)`\s*$/gmu,
    ),
    requireVersionFact(
      join(rootDir, "docs", "windows-desktop.md"),
      "docs/windows-desktop.md",
      versionLabel,
      /^`GPT-Image2-Studio-Desktop-Setup-(v[0-9A-Za-z.+-]+)-x64\.exe`\s+是/gmu,
    ),
    requireVersionFact(
      join(rootDir, "docs", "releases", `${versionLabel}.md`),
      `docs/releases/${versionLabel}.md`,
      versionLabel,
      /^\uFEFF?# GPT-Image2-Studio (v[0-9A-Za-z.+-]+)[\t ]*(?:\r?\n|$)/gu,
    ),
  ]);

  if (strict) {
    const status = await runGit(rootDir, ["status", "--porcelain=v1"]);
    if (status.stdout.trim()) {
      throw new Error("严格发布检查要求工作树完全干净");
    }

    const tags = await runGit(rootDir, ["tag", "--points-at", "HEAD"]);
    const currentTags = tags.stdout.split(/\r?\n/).map((tag) => tag.trim()).filter(Boolean);
    if (!currentTags.includes(versionLabel)) {
      throw new Error(`严格发布检查要求当前提交带有标签 ${versionLabel}`);
    }
  }

  return { version, versionLabel, strict };
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  try {
    const result = await checkReleaseReadiness({ strict: process.argv.includes("--strict") });
    console.log(`发布一致性检查通过：${result.versionLabel}${result.strict ? "（严格模式）" : ""}`);
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
