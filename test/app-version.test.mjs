import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, readdir, rename, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const patchTargetRelativePaths = [
  "package.json",
  "package-lock.json",
  "public/index.html",
  "README.md",
  "README.zh-CN.md",
  "docs/windows-desktop.md",
  "docs/windows-installer.md",
];

async function createPatchReleaseFixture({ includeReleasesDirectory = true } = {}) {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "image-studio-version-patch-"));
  await mkdir(join(fixtureRoot, "public"), { recursive: true });
  await mkdir(join(fixtureRoot, "docs"), { recursive: true });
  if (includeReleasesDirectory) {
    await mkdir(join(fixtureRoot, "docs", "releases"), { recursive: true });
  }
  await mkdir(join(fixtureRoot, "extensions", "product-image-collector"), { recursive: true });
  await writeFile(join(fixtureRoot, "package.json"), '{"name":"fixture","version":"1.2.3"}\n', "utf8");
  await writeFile(
    join(fixtureRoot, "package-lock.json"),
    '{"name":"fixture","version":"1.2.3","packages":{"":{"version":"1.2.3"}}}\n',
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "public", "index.html"),
    '<small data-surface="workbench" aria-label="当前版本 v1.2.3" class="build-fact app-version">v1.2.3</small>\n',
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "README.md"),
    'Current version: `v1.2.3`\nHistorical releases: v1.2.3 and v1.2.30.\nExample command: `git tag v1.2.3`.\n',
    "utf8",
  );
  await writeFile(join(fixtureRoot, "README.zh-CN.md"), '当前版本：`v1.2.3`\n', "utf8");
  await writeFile(
    join(fixtureRoot, "docs", "windows-desktop.md"),
    '`GPT-Image2-Studio-Desktop-Setup-v1.2.3-x64.exe` 是桌面安装包。\n',
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "docs", "windows-installer.md"),
    '`GPT-Image2-Studio-Setup-v1.2.3.exe` 是兼容安装包。\n',
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "extensions", "product-image-collector", "manifest.json"),
    '{"version":"9.8.7"}\n',
    "utf8",
  );
  return fixtureRoot;
}

async function readPatchTargets(fixtureRoot) {
  return Promise.all(
    patchTargetRelativePaths.map((relativePath) => readFile(join(fixtureRoot, relativePath), "utf8")),
  );
}

async function assertNoTransactionFiles(fixtureRoot) {
  const fixtureFiles = await readdir(fixtureRoot, { recursive: true });
  assert.equal(fixtureFiles.some((path) => /\.(?:tmp|bak)$/u.test(String(path))), false);
}

async function assertPatchFailureLeftNoChanges(fixtureRoot, before) {
  assert.deepEqual(await readPatchTargets(fixtureRoot), before);
  await assert.rejects(readFile(join(fixtureRoot, "docs", "releases", "v1.2.4.md"), "utf8"), { code: "ENOENT" });
  await assertNoTransactionFiles(fixtureRoot);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

test("workbench displays the package version at the lower-left safe area", async () => {
  const [packageJson, html, styles] = await Promise.all([
    readFile(new URL("../package.json", import.meta.url), "utf8").then(JSON.parse),
    readFile(new URL("../public/index.html", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  const versionLabel = `v${packageJson.version}`;
  const versionMarkup = new RegExp(
    `<small class="app-version" aria-label="当前版本 ${escapeRegExp(versionLabel)}">${escapeRegExp(versionLabel)}</small>`,
    "g",
  );

  assert.equal([...html.matchAll(versionMarkup)].length, 1);

  const versionRule = styles.match(/\.app-version\s*\{([\s\S]*?)\n\}/)?.[1] || "";
  assert.match(versionRule, /position:\s*fixed/);
  assert.match(versionRule, /left:\s*max\([^;]*env\(safe-area-inset-left\)[^;]*\)/);
  assert.match(versionRule, /bottom:\s*max\([^;]*env\(safe-area-inset-bottom\)[^;]*\)/);
  assert.match(versionRule, /pointer-events:\s*none/);
  assert.match(versionRule, /font-variant-numeric:\s*tabular-nums/);
});

test("patch release increments exactly 0.0.1 and synchronizes maintained version facts", async () => {
  const { bumpPatchRelease, incrementPatchVersion } = await import("../scripts/release-patch.mjs");
  assert.equal(incrementPatchVersion("0.2.6"), "0.2.7");
  assert.equal(incrementPatchVersion("1.9.9"), "1.9.10");
  assert.throws(() => incrementPatchVersion("1.2"), /semantic version/i);

  const fixtureRoot = await createPatchReleaseFixture();

  const result = await bumpPatchRelease({ rootDir: fixtureRoot, summary: "新增版本号显示。" });
  assert.deepEqual(result, { previousVersion: "1.2.3", version: "1.2.4", versionLabel: "v1.2.4" });

  const [packageJson, packageLock, html, readme, chineseReadme, desktopDoc, installerDoc, releaseNote] = await Promise.all([
    readFile(join(fixtureRoot, "package.json"), "utf8").then(JSON.parse),
    readFile(join(fixtureRoot, "package-lock.json"), "utf8").then(JSON.parse),
    readFile(join(fixtureRoot, "public", "index.html"), "utf8"),
    readFile(join(fixtureRoot, "README.md"), "utf8"),
    readFile(join(fixtureRoot, "README.zh-CN.md"), "utf8"),
    readFile(join(fixtureRoot, "docs", "windows-desktop.md"), "utf8"),
    readFile(join(fixtureRoot, "docs", "windows-installer.md"), "utf8"),
    readFile(join(fixtureRoot, "docs", "releases", "v1.2.4.md"), "utf8"),
  ]);

  assert.equal(packageJson.version, "1.2.4");
  assert.equal(packageLock.version, "1.2.4");
  assert.equal(packageLock.packages[""].version, "1.2.4");
  for (const content of [html, chineseReadme, desktopDoc, installerDoc]) {
    assert.match(content, /v1\.2\.4/);
    assert.doesNotMatch(content, /v1\.2\.3/);
  }
  assert.match(readme, /^Current version: `v1\.2\.4`$/m);
  assert.match(readme, /^Historical releases: v1\.2\.3 and v1\.2\.30\.$/m);
  assert.match(readme, /^Example command: `git tag v1\.2\.3`\.$/m);
  assert.match(releaseNote, /^# GPT-Image2-Studio v1\.2\.4$/m);
  assert.match(releaseNote, /新增版本号显示。/);
  const extensionManifest = JSON.parse(
    await readFile(join(fixtureRoot, "extensions", "product-image-collector", "manifest.json"), "utf8"),
  );
  assert.equal(extensionManifest.version, "9.8.7");
  await assertNoTransactionFiles(fixtureRoot);
});

test("patch release leaves every target unchanged when the release-note directory is unavailable", async () => {
  const { bumpPatchRelease } = await import("../scripts/release-patch.mjs");
  const fixtureRoot = await createPatchReleaseFixture({ includeReleasesDirectory: false });
  const before = await readPatchTargets(fixtureRoot);

  await assert.rejects(
    bumpPatchRelease({ rootDir: fixtureRoot, summary: "不应写入的版本。" }),
    /docs[\\/]releases|父目录|directory/i,
  );
  assert.deepEqual(await readPatchTargets(fixtureRoot), before);
  await assertNoTransactionFiles(fixtureRoot);
});

test("patch release cleans staged files when a temporary write fails", async () => {
  const { bumpPatchRelease } = await import("../scripts/release-patch.mjs");
  const fixtureRoot = await createPatchReleaseFixture();
  const before = await readPatchTargets(fixtureRoot);
  let temporaryWriteCount = 0;

  await assert.rejects(
    bumpPatchRelease({
      rootDir: fixtureRoot,
      summary: "不应提交的版本。",
      fileOperations: {
        writeFile: async (path, ...args) => {
          if (/\.tmp$/u.test(String(path)) && ++temporaryWriteCount === 3) {
            throw new Error("injected staging failure");
          }
          return writeFile(path, ...args);
        },
      },
    }),
    /injected staging failure/,
  );

  await assertPatchFailureLeftNoChanges(fixtureRoot, before);
});

test("patch release rolls back replaced targets when a later commit fails", async () => {
  const { bumpPatchRelease } = await import("../scripts/release-patch.mjs");
  const fixtureRoot = await createPatchReleaseFixture();
  const before = await readPatchTargets(fixtureRoot);
  let temporaryInstallCount = 0;

  await assert.rejects(
    bumpPatchRelease({
      rootDir: fixtureRoot,
      summary: "不应提交的版本。",
      fileOperations: {
        rename: async (from, to) => {
          if (/\.tmp$/u.test(String(from)) && ++temporaryInstallCount === 3) {
            throw new Error("injected commit failure");
          }
          return rename(from, to);
        },
      },
    }),
    /injected commit failure/,
  );

  await assertPatchFailureLeftNoChanges(fixtureRoot, before);
});

test("patch release rejects missing or duplicate maintained version facts before writing", async () => {
  const { bumpPatchRelease } = await import("../scripts/release-patch.mjs");
  for (const readme of [
    "Historical releases: v1.2.3 and v1.2.30.\n",
    "Current version: `v1.2.3`\nCurrent version: `v1.2.3`\n",
  ]) {
    const fixtureRoot = await createPatchReleaseFixture();
    await writeFile(join(fixtureRoot, "README.md"), readme, "utf8");
    const before = await readPatchTargets(fixtureRoot);

    await assert.rejects(
      bumpPatchRelease({ rootDir: fixtureRoot, summary: "不应提交的版本。" }),
      /README\.md.*exactly one/i,
    );
    await assertPatchFailureLeftNoChanges(fixtureRoot, before);
  }
});
