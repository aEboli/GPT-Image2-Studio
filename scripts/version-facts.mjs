// `release:patch` rewrites one anchored fact per maintained file, and `check:release`
// validated only those. But the current version also appears in the shields.io badge, the
// installer and portable filenames quoted in prose, the release-note link, and the
// build-output paths. Nothing checked them, so a bump could pass every check while the
// README still advertised the previous version's download — v0.2.10 shipped as a
// documentation-only release to repair exactly that drift.
//
// Each entry below is a literal template with a `{version}` hole. Every template ends in a
// delimiter, so matching cannot bleed across a longer version: `v1.2.3` never matches
// inside `v1.2.30`. Free-form prose, historical sections, and tag examples carry no
// template and are therefore left byte-for-byte alone, as the maintenance spec requires.

const VERSION_HOLE = "{version}";
const VERSION_CAPTURE = "(\\d+\\.\\d+\\.\\d+)";

export const MAINTAINED_VERSION_FACT_TEMPLATES = [
  {
    relativePath: "README.md",
    templates: [
      "version-v{version}-2563eb.svg",
      "GPT-Image2-Studio-Desktop-Setup-v{version}-x64.exe",
      "GPT-Image2-Studio-Portable-v{version}-x64.zip",
      "[v{version}](./docs/releases/v{version}.md)",
      "`v{version}` GitHub Release",
    ],
  },
  {
    relativePath: "README.zh-CN.md",
    templates: [
      "version-v{version}-2563eb.svg",
      "GPT-Image2-Studio-Desktop-Setup-v{version}-x64.exe",
      "GPT-Image2-Studio-Portable-v{version}-x64.zip",
      "GPT-Image2-Studio-Setup-v{version}.exe",
      "[v{version}](./docs/releases/v{version}.md)",
      "`v{version}` GitHub Release",
    ],
  },
  {
    relativePath: "docs/windows-desktop.md",
    templates: [
      "GPT-Image2-Studio-Desktop-Setup-v{version}-x64.exe",
      "GPT-Image2-Studio-Portable-v{version}-x64.zip",
      "GPT-Image2-Studio-Setup-v{version}.exe",
    ],
  },
  {
    relativePath: "docs/windows-installer.md",
    templates: ["GPT-Image2-Studio-Setup-v{version}.exe", "`v{version}` GitHub Release"],
  },
];

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

export function renderVersionFact(template, version) {
  return template.split(VERSION_HOLE).join(version);
}

// Matches the template for ANY semantic version, capturing each version it names. A file
// that does not use a template at all is unconstrained by it; a file that does use it must
// name the current version everywhere it appears.
function buildTemplatePattern(template) {
  return new RegExp(template.split(VERSION_HOLE).map(escapeRegExp).join(VERSION_CAPTURE), "gu");
}

export function findVersionFactDrift({ text, templates, version }) {
  const drift = [];
  for (const template of templates) {
    for (const match of String(text).matchAll(buildTemplatePattern(template))) {
      const named = match.slice(1).filter(Boolean);
      if (named.every((value) => value === version)) {
        continue;
      }
      drift.push({
        template,
        found: match[0],
        expected: renderVersionFact(template, version),
        lineNumber: text.slice(0, match.index).split("\n").length,
      });
    }
  }
  return drift.sort((left, right) => left.lineNumber - right.lineNumber);
}

export function replaceVersionFacts({ text, templates, previousVersion, version }) {
  let updated = String(text);
  let replaced = 0;
  for (const template of templates) {
    const previousFact = renderVersionFact(template, previousVersion);
    const nextFact = renderVersionFact(template, version);
    const occurrences = updated.split(previousFact).length - 1;
    if (!occurrences) {
      continue;
    }
    updated = updated.split(previousFact).join(nextFact);
    replaced += occurrences;
  }
  return { text: updated, replaced };
}

export function getMaintainedVersionFactTemplates(relativePath) {
  return MAINTAINED_VERSION_FACT_TEMPLATES.find((entry) => entry.relativePath === relativePath)?.templates || [];
}
