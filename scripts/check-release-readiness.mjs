import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

import { parse } from "parse5";

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

const NON_RENDERING_CONTEXT_TAGS = new Set([
  "head",
  "iframe",
  "noembed",
  "noframes",
  "noscript",
  "plaintext",
  "script",
  "style",
  "template",
  "textarea",
  "title",
  "xmp",
]);

function getElementAttributes(node) {
  return new Map((Array.isArray(node?.attrs) ? node.attrs : []).map((attribute) => [attribute.name, attribute.value]));
}

function parseInlineStyle(value) {
  const properties = new Map();
  const source = String(value || "").replace(/\/\*[\s\S]*?(?:\*\/|$)/gu, "");
  for (const declaration of source.split(";")) {
    const separatorIndex = declaration.indexOf(":");
    if (separatorIndex < 0) {
      continue;
    }
    const name = declaration.slice(0, separatorIndex).trim().toLowerCase();
    const rawValue = declaration.slice(separatorIndex + 1).trim();
    if (!name || !rawValue) {
      continue;
    }
    const important = /!\s*important\s*$/iu.test(rawValue);
    const normalizedValue = rawValue.replace(/!\s*important\s*$/iu, "").trim().toLowerCase();
    const current = properties.get(name);
    if (!current || important || !current.important) {
      properties.set(name, { value: normalizedValue, important });
    }
  }
  return properties;
}

function getVisibility(style, inheritedVisibility) {
  const value = style.get("visibility")?.value;
  if (value === "hidden" || value === "collapse") {
    return "hidden";
  }
  if (value === "visible" || value === "initial") {
    return "visible";
  }
  return inheritedVisibility;
}

function elementIsHardHidden(tagName, attributes, style) {
  return Boolean(
    NON_RENDERING_CONTEXT_TAGS.has(tagName) ||
      (tagName === "dialog" && !attributes.has("open")) ||
      attributes.has("hidden") ||
      String(attributes.get("aria-hidden") || "").trim().toLowerCase() === "true" ||
      style.get("display")?.value === "none" ||
      style.get("content-visibility")?.value === "hidden",
  );
}

function getDirectText(node) {
  const children = Array.isArray(node?.childNodes) ? node.childNodes : [];
  if (!children.every((child) => child.nodeName === "#text")) {
    return null;
  }
  return children.map((child) => String(child.value || "")).join("").trim();
}

function findAppVersionElements(content) {
  const document = parse(content, { sourceCodeLocationInfo: true, scriptingEnabled: true });
  const elements = [];

  function visit(node, { hardHidden = false, visibility = "visible" } = {}) {
    const tagName = String(node?.tagName || "").toLowerCase();
    const attributes = getElementAttributes(node);
    const style = parseInlineStyle(attributes.get("style"));
    const nodeHardHidden = hardHidden || elementIsHardHidden(tagName, attributes, style);
    const nodeVisibility = getVisibility(style, visibility);
    const closedDetails = tagName === "details" && !attributes.has("open");
    const classNames = String(attributes.get("class") || "").split(/\s+/u).filter(Boolean);
    if (classNames.includes("app-version")) {
      const location = node.sourceCodeLocation;
      elements.push({
        tagName,
        attributes,
        renderable: !nodeHardHidden && nodeVisibility === "visible" && !closedDetails,
        text: getDirectText(node),
        openingStart: location?.startTag?.startOffset,
        openingEnd: location?.startTag?.endOffset,
        closingStart: location?.endTag?.startOffset,
        closingEnd: location?.endTag?.endOffset,
        ariaLocation: location?.attrs?.["aria-label"],
      });
    }

    const children = Array.isArray(node?.childNodes) ? node.childNodes : [];
    const visibleSummary = closedDetails
      ? children.find((child) => String(child?.tagName || "").toLowerCase() === "summary")
      : null;
    for (const child of children) {
      visit(child, {
        hardHidden: nodeHardHidden || (closedDetails && child !== visibleSummary),
        visibility: nodeVisibility,
      });
    }
    if (node?.content) {
      visit(node.content, { hardHidden: true, visibility: nodeVisibility });
    }
  }

  visit(document);
  return elements;
}

function requireWorkbenchVersionElement(content, versionLabel, label = "public/index.html") {
  const elements = findAppVersionElements(content);
  if (elements.length !== 1) {
    throw new Error(`${label} 必须包含唯一明确的当前版本事实 ${versionLabel}`);
  }
  const [element] = elements;
  const actualAriaLabel = element.attributes.get("aria-label") || "";
  if (
    element.tagName !== "small" ||
    !element.renderable ||
    actualAriaLabel !== `当前版本 ${versionLabel}` ||
    element.text !== versionLabel ||
    !Number.isInteger(element.openingStart) ||
    !Number.isInteger(element.openingEnd) ||
    !Number.isInteger(element.closingStart) ||
    !Number.isInteger(element.closingEnd) ||
    !element.ariaLocation
  ) {
    throw new Error(`${label} 当前版本必须与 ${versionLabel} 一致且可渲染`);
  }
  return element;
}

export function replaceWorkbenchVersionFact(content, previousVersionLabel, versionLabel) {
  const element = requireWorkbenchVersionElement(content, previousVersionLabel);
  const openingSource = content.slice(element.openingStart, element.openingEnd);
  const innerSource = content.slice(element.openingEnd, element.closingStart);
  const ariaStart = element.ariaLocation.startOffset - element.openingStart;
  const ariaEnd = element.ariaLocation.endOffset - element.openingStart;
  const ariaSource = openingSource.slice(ariaStart, ariaEnd);
  const ariaPrefix = ariaSource.match(/^([^=]+=\s*)/u)?.[1];
  if (!ariaPrefix) {
    throw new Error("public/index.html 当前版本元素缺少可更新的 aria-label");
  }
  const quote = ariaSource.slice(ariaPrefix.length).trim().match(/^["']/u)?.[0] || '"';
  const updatedAria = `${ariaPrefix}${quote}当前版本 ${versionLabel}${quote}`;
  const updatedOpening = `${openingSource.slice(0, ariaStart)}${updatedAria}${openingSource.slice(ariaEnd)}`;
  const leadingWhitespace = innerSource.match(/^\s*/u)?.[0] || "";
  const trailingWhitespace = innerSource.match(/\s*$/u)?.[0] || "";
  const updatedInner = `${leadingWhitespace}${versionLabel}${trailingWhitespace}`;
  const updatedContent = `${content.slice(0, element.openingStart)}${updatedOpening}${updatedInner}${content.slice(
    element.closingStart,
  )}`;
  requireWorkbenchVersionElement(updatedContent, versionLabel);
  return updatedContent;
}

async function requireWorkbenchVersionFact(path, versionLabel) {
  let content;
  try {
    content = await readFile(path, "utf8");
  } catch (error) {
    throw new Error(`public/index.html 缺失：${error instanceof Error ? error.message : String(error)}`);
  }
  requireWorkbenchVersionElement(content, versionLabel);
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
      /^Current version:\s*`(v[0-9A-Za-z.+-]+)`\s*$/gmu,
    ),
    requireVersionFact(
      join(rootDir, "README.zh-CN.md"),
      "README.zh-CN.md",
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
      join(rootDir, "docs", "windows-installer.md"),
      "docs/windows-installer.md",
      versionLabel,
      /^`GPT-Image2-Studio-Setup-(v[0-9A-Za-z.+-]+)\.exe`\s+是/gmu,
    ),
    requireWorkbenchVersionFact(join(rootDir, "public", "index.html"), versionLabel),
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
