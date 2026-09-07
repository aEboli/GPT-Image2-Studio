import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MAINTAINED_VERSION_FACT_TEMPLATES,
  findVersionFactDrift,
  getMaintainedVersionFactTemplates,
  renderVersionFact,
  replaceVersionFacts,
} from "../scripts/version-facts.mjs";
import { checkReleaseReadiness } from "../scripts/check-release-readiness.mjs";
import { bumpPatchRelease } from "../scripts/release-patch.mjs";

const README_TEMPLATES = getMaintainedVersionFactTemplates("README.md");

test("maintained version facts cover the badge, installers, and release-note link", () => {
  assert.ok(README_TEMPLATES.includes("version-v{version}-2563eb.svg"));
  assert.ok(README_TEMPLATES.includes("GPT-Image2-Studio-Desktop-Setup-v{version}-x64.exe"));
  assert.ok(README_TEMPLATES.includes("GPT-Image2-Studio-Portable-v{version}-x64.zip"));
  assert.ok(README_TEMPLATES.includes("[v{version}](./docs/releases/v{version}.md)"));
  assert.equal(getMaintainedVersionFactTemplates("does/not/exist.md").length, 0);
  for (const { templates } of MAINTAINED_VERSION_FACT_TEMPLATES) {
    for (const template of templates) {
      assert.ok(template.includes("{version}"), `${template} must carry a version hole`);
    }
  }
});

test("drift detection reports stale facts and ignores absent or current ones", () => {
  const stale = [
    "[![Version](https://img.shields.io/badge/version-v1.2.2-2563eb.svg)](x)",
    "Download `GPT-Image2-Studio-Desktop-Setup-v1.2.3-x64.exe` today.",
  ].join("\n");

  const drift = findVersionFactDrift({ text: stale, templates: README_TEMPLATES, version: "1.2.3" });
  assert.equal(drift.length, 1);
  assert.equal(drift[0].found, "version-v1.2.2-2563eb.svg");
  assert.equal(drift[0].expected, "version-v1.2.3-2563eb.svg");
  assert.equal(drift[0].lineNumber, 1);

  // A document that never mentions a template is unconstrained by it.
  assert.equal(findVersionFactDrift({ text: "no facts here\n", templates: README_TEMPLATES, version: "1.2.3" }).length, 0);

  // A link naming two versions is drift even when only one half is stale.
  const link = findVersionFactDrift({
    text: "- Current release notes: [v1.2.3](./docs/releases/v1.2.2.md).\n",
    templates: README_TEMPLATES,
    version: "1.2.3",
  });
  assert.equal(link.length, 1);
});

test("fact replacement never bleeds into a longer version or into prose", () => {
  const source = [
    "version-v1.2.3-2563eb.svg",
    "`GPT-Image2-Studio-Desktop-Setup-v1.2.30-x64.exe` stays on its own version.",
    "Historical releases: v1.2.3 and v1.2.30.",
    "Example command: `git tag v1.2.3`.",
  ].join("\n");

  const { text, replaced } = replaceVersionFacts({
    text: source,
    templates: README_TEMPLATES,
    previousVersion: "1.2.3",
    version: "1.2.4",
  });

  assert.equal(replaced, 1);
  assert.ok(text.includes("version-v1.2.4-2563eb.svg"));
  assert.ok(text.includes("Setup-v1.2.30-x64.exe"), "a longer version must not be rewritten");
  assert.ok(text.includes("Historical releases: v1.2.3 and v1.2.30."), "prose must stay byte-for-byte");
  assert.ok(text.includes("`git tag v1.2.3`"), "tag examples must stay byte-for-byte");
  assert.equal(renderVersionFact("v{version}", "9.9.9"), "v9.9.9");
});

async function createReleaseFixture(version) {
  const root = await mkdtemp(join(tmpdir(), "image-studio-version-facts-"));
  await mkdir(join(root, "docs", "releases"), { recursive: true });
  await mkdir(join(root, "public"), { recursive: true });
  await writeFile(join(root, "package.json"), `{"version":"${version}"}\n`, "utf8");
  await writeFile(
    join(root, "package-lock.json"),
    `{"version":"${version}","packages":{"":{"version":"${version}"}}}\n`,
    "utf8",
  );
  await writeFile(
    join(root, "README.md"),
    `Current version: \`v${version}\`\n\n![badge](https://img.shields.io/badge/version-v${version}-2563eb.svg)\n`,
    "utf8",
  );
  await writeFile(join(root, "README.zh-CN.md"), `当前版本：\`v${version}\`\n`, "utf8");
  await writeFile(
    join(root, "docs", "windows-desktop.md"),
    `\`GPT-Image2-Studio-Desktop-Setup-v${version}-x64.exe\` 是桌面安装包。\n`,
    "utf8",
  );
  await writeFile(
    join(root, "docs", "windows-installer.md"),
    `\`GPT-Image2-Studio-Setup-v${version}.exe\` 是兼容安装包。\n`,
    "utf8",
  );
  await writeFile(
    join(root, "public", "index.html"),
    `<small class="app-version" aria-label="当前版本 v${version}">v${version}</small>\n`,
    "utf8",
  );
  await writeFile(join(root, "docs", "releases", `v${version}.md`), `# GPT-Image2-Studio v${version}\n`, "utf8");
  return root;
}

test("release readiness rejects a stale badge that the anchored fact cannot catch", async () => {
  const root = await createReleaseFixture("1.2.3");

  // The anchored `Current version:` fact is correct; only the badge lagged behind. This is
  // exactly the drift that used to pass every check.
  await writeFile(
    join(root, "README.md"),
    "Current version: `v1.2.3`\n\n![badge](https://img.shields.io/badge/version-v1.2.2-2563eb.svg)\n",
    "utf8",
  );
  await assert.rejects(checkReleaseReadiness({ rootDir: root }), /README\.md.*version-v1\.2\.2-2563eb\.svg/s);

  await writeFile(
    join(root, "README.md"),
    "Current version: `v1.2.3`\n\n![badge](https://img.shields.io/badge/version-v1.2.3-2563eb.svg)\n",
    "utf8",
  );
  const result = await checkReleaseReadiness({ rootDir: root });
  assert.equal(result.versionLabel, "v1.2.3");
});

test("patch release updates the badge alongside the anchored fact", async () => {
  const root = await createReleaseFixture("1.2.3");

  const result = await bumpPatchRelease({ rootDir: root, summary: "同步版本事实。" });
  assert.equal(result.version, "1.2.4");

  const readme = await readFile(join(root, "README.md"), "utf8");
  assert.ok(readme.includes("Current version: `v1.2.4`"));
  assert.ok(readme.includes("version-v1.2.4-2563eb.svg"), "the badge must follow the bump");
  assert.equal(readme.includes("v1.2.3"), false);

  const desktopDoc = await readFile(join(root, "docs", "windows-desktop.md"), "utf8");
  assert.ok(desktopDoc.includes("GPT-Image2-Studio-Desktop-Setup-v1.2.4-x64.exe"));

  // The freshly bumped tree must satisfy the check that previously missed the badge.
  const check = await checkReleaseReadiness({ rootDir: root });
  assert.equal(check.versionLabel, "v1.2.4");
});
