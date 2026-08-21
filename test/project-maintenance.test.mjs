import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkReleaseReadiness, replaceWorkbenchVersionFact } from "../scripts/check-release-readiness.mjs";

test("package scripts pin deterministic tests, OpenSpec, and release checks", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.scripts.test, "node --test --test-concurrency=1 ./test/*.test.mjs");
  assert.equal(packageJson.scripts["release:patch"], "node scripts/release-patch.mjs");
  assert.equal(packageJson.scripts["check:release"], "node scripts/check-release-readiness.mjs");
  assert.equal(packageJson.scripts["check:release:strict"], "node scripts/check-release-readiness.mjs --strict");
  assert.equal(packageJson.devDependencies["@fission-ai/openspec"], "1.6.0");
  assert.equal(packageJson.devDependencies.parse5, "8.0.1");
});

test("shared browser-module registry includes model defaults", async () => {
  const syncSource = await readFile(new URL("../scripts/sync-public-lib.mjs", import.meta.url), "utf8");
  assert.match(syncSource, /["']model-defaults\.mjs["']/);
});

test("CI runs the maintained verification contract on Node 22", async () => {
  const workflow = await readFile(new URL("../.github/workflows/ci.yml", import.meta.url), "utf8");

  assert.match(workflow, /actions\/checkout@v4/);
  assert.match(workflow, /actions\/setup-node@v4/);
  assert.match(workflow, /node-version:\s*["']?22["']?/);
  for (const command of [
    "npm ci",
    "npm test",
    "npm run sync:public-lib -- --check",
    "npm run check:release",
    "npx --no-install openspec validate --all --strict",
    "git diff --check",
    "git diff --exit-code",
  ]) {
    assert.ok(workflow.includes(command), `CI is missing: ${command}`);
  }
});

test("release readiness detects consistent and inconsistent version facts", async () => {
  const fixtureRoot = await mkdtemp(join(tmpdir(), "image-studio-release-check-"));
  await mkdir(join(fixtureRoot, "docs", "releases"), { recursive: true });
  await mkdir(join(fixtureRoot, "public"), { recursive: true });
  await writeFile(join(fixtureRoot, "package.json"), '{"version":"1.2.3"}\n', "utf8");
  await writeFile(
    join(fixtureRoot, "package-lock.json"),
    '{"version":"1.2.3","packages":{"":{"version":"1.2.3"}}}\n',
    "utf8",
  );
  await writeFile(join(fixtureRoot, "README.md"), "Current version: `v1.2.3`\n", "utf8");
  await writeFile(join(fixtureRoot, "README.zh-CN.md"), "当前版本：`v1.2.3`\n", "utf8");
  await writeFile(
    join(fixtureRoot, "docs", "windows-desktop.md"),
    "`GPT-Image2-Studio-Desktop-Setup-v1.2.3-x64.exe` 是桌面安装包。\n",
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "docs", "windows-installer.md"),
    "`GPT-Image2-Studio-Setup-v1.2.3.exe` 是兼容安装包。\n",
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "public", "index.html"),
    '<small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small>\n',
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "docs", "releases", "v1.2.3.md"),
    "# GPT-Image2-Studio v1.2.3\n",
    "utf8",
  );

  const result = await checkReleaseReadiness({ rootDir: fixtureRoot });
  assert.equal(result.version, "1.2.3");

  for (const markup of [
    '<small class="app-version" aria-label="当前版本 v1.2.3"><span hidden>v1.2.3</span></small>\n',
    '<small class="app-version" aria-label="当前版本 v1.2.3"><span style="display:none">v1.2.3</span></small>\n',
    '<small class="app-version" aria-label="当前版本 v1.2.3"><script>v1.2.3</script></small>\n',
  ]) {
    await writeFile(join(fixtureRoot, "public", "index.html"), markup, "utf8");
    await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /public\/index\.html.*v1\.2\.3/);
  }

  await writeFile(
    join(fixtureRoot, "public", "index.html"),
    '<small class="app&#45;version" aria-label="当前版本&#32;v1&#46;2.3">v1&#46;2.3</small>\n',
    "utf8",
  );
  await checkReleaseReadiness({ rootDir: fixtureRoot });
  const encodedReplacement = replaceWorkbenchVersionFact(
    '<small class="app&#45;version" aria-label="当前版本&#32;v1&#46;2.3">v1&#46;2.3</small>\n',
    "v1.2.3",
    "v1.2.4",
  );
  assert.match(encodedReplacement, /class="app&#45;version"/u);
  assert.match(encodedReplacement, /aria-label="当前版本 v1\.2\.4"/u);
  assert.match(encodedReplacement, />v1\.2\.4<\/small>/u);

  for (const [markup, expected] of [
    ['<small class="app-version" aria-label="当前版本 v1.2.3" style="display:none/*;*/">v1.2.3</small>\n', false],
    ['<small class="app-version" aria-label="当前版本 v1.2.3" style="display:none;display:block">v1.2.3</small>\n', true],
    ['<small class="app-version" aria-label="当前版本 v1.2.3" style="display:block!important;display:none">v1.2.3</small>\n', true],
    ['<small class="app-version" aria-label="当前版本 v1.2.3" style="display:none!important;display:block">v1.2.3</small>\n', false],
    ['<small class="app-version" aria-label="当前版本 v1.2.3" style="visibility:hidden"><span style="visibility:visible">v1.2.3</span></small>\n', false],
  ]) {
    await writeFile(join(fixtureRoot, "public", "index.html"), markup, "utf8");
    if (expected) {
      await checkReleaseReadiness({ rootDir: fixtureRoot });
    } else {
      await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /public\/index\.html.*v1\.2\.3/);
    }
  }

  for (const markup of [
    '<!doctype html><html><head><title>Workbench</title><body><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></body></html>\n',
    '<!-- comment --!><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small>\n',
  ]) {
    await writeFile(join(fixtureRoot, "public", "index.html"), markup, "utf8");
    await checkReleaseReadiness({ rootDir: fixtureRoot });
  }

  for (const [markup, expected] of [
    ['<dialog><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></dialog>\n', false],
    ['<dialog open><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></dialog>\n', true],
    ['<details><summary>Summary</summary><div><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></div></details>\n', false],
    ['<details><summary><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></summary></details>\n', true],
  ]) {
    await writeFile(join(fixtureRoot, "public", "index.html"), markup, "utf8");
    if (expected) {
      await checkReleaseReadiness({ rootDir: fixtureRoot });
    } else {
      await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /public\/index\.html.*v1\.2\.3/);
    }
  }

  await writeFile(
    join(fixtureRoot, "public", "index.html"),
    '<!-- 😀 -->\n<small aria-label="当前版本 v1.2.3" class="build-fact app-version">v1.2.3</small>\n',
    "utf8",
  );
  await checkReleaseReadiness({ rootDir: fixtureRoot });

  await writeFile(
    join(fixtureRoot, "public", "index.html"),
    '<!-- 😀\n<small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small>\n-->\n',
    "utf8",
  );
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /public\/index\.html.*v1\.2\.3/);

  for (const nonRenderingMarkup of [
    '<title><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></title>\n',
    '<template><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></template>\n',
    '<script><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></script>\n',
    '<style><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></style>\n',
    '<textarea><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></textarea>\n',
    '<iframe><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></iframe>\n',
    '<noscript><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></noscript>\n',
    '<xmp><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></xmp>\n',
    '<plaintext><small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></plaintext>\n',
  ]) {
    await writeFile(join(fixtureRoot, "public", "index.html"), nonRenderingMarkup, "utf8");
    await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /public\/index\.html.*v1\.2\.3/);
  }

  for (const hiddenContainer of [
    '<div hidden>$VERSION</div>',
    '<div aria-hidden="TRUE">$VERSION</div>',
    '<div style="color: red; display: none !important">$VERSION</div>',
    '<div style="visibility : hidden">$VERSION</div>',
  ]) {
    await writeFile(
      join(fixtureRoot, "public", "index.html"),
      `${hiddenContainer.replace(
        "$VERSION",
        '<section><small class="build-fact app-version" aria-label="当前版本 v1.2.3">v1.2.3</small></section>',
      )}\n`,
      "utf8",
    );
    await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /public\/index\.html.*v1\.2\.3/);
  }

  for (const hiddenAttribute of ["hidden", 'aria-hidden="true"', 'style="display:none"', 'style="visibility:hidden"']) {
    await writeFile(
      join(fixtureRoot, "public", "index.html"),
      `<small class="app-version" aria-label="当前版本 v1.2.3" ${hiddenAttribute}>v1.2.3</small>\n`,
      "utf8",
    );
    await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /public\/index\.html.*v1\.2\.3/);
  }

  await writeFile(
    join(fixtureRoot, "public", "index.html"),
    '<small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small>\n' +
      '<small aria-label="当前版本 v1.2.2" class="app-version">v1.2.2</small>\n',
    "utf8",
  );
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /public\/index\.html.*v1\.2\.3/);

  await writeFile(
    join(fixtureRoot, "public", "index.html"),
    '<small aria-label="当前版本 v1.2.3" class="build-fact app-version">v1.2.3</small>\n',
    "utf8",
  );

  await writeFile(join(fixtureRoot, "README.md"), "Current version: `v1.2.2`\nExample tag: v1.2.3\n", "utf8");
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /README\.md.*v1\.2\.3/);

  await writeFile(join(fixtureRoot, "README.md"), "Current version: `v1.2.3`\n", "utf8");
  await writeFile(join(fixtureRoot, "README.zh-CN.md"), "当前版本：`v1.2.2`\n示例标签：v1.2.3\n", "utf8");
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /README\.zh-CN\.md.*v1\.2\.3/);
  await writeFile(join(fixtureRoot, "README.zh-CN.md"), "当前版本：`v1.2.3`\n", "utf8");
  await writeFile(
    join(fixtureRoot, "docs", "windows-desktop.md"),
    "`GPT-Image2-Studio-Desktop-Setup-v1.2.2-x64.exe` 是桌面安装包。\n示例标签：v1.2.3\n",
    "utf8",
  );
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /docs\/windows-desktop\.md.*v1\.2\.3/);

  await writeFile(
    join(fixtureRoot, "docs", "windows-desktop.md"),
    "`GPT-Image2-Studio-Desktop-Setup-v1.2.3-x64.exe` 是桌面安装包。\n",
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "docs", "windows-installer.md"),
    "`GPT-Image2-Studio-Setup-v1.2.2.exe` 是兼容安装包。\n示例标签：v1.2.3\n",
    "utf8",
  );
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /docs\/windows-installer\.md.*v1\.2\.3/);
  await writeFile(
    join(fixtureRoot, "docs", "windows-installer.md"),
    "`GPT-Image2-Studio-Setup-v1.2.3.exe` 是兼容安装包。\n",
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "public", "index.html"),
    '<small class="app-version" aria-label="当前版本 v1.2.2">v1.2.2</small>\n',
    "utf8",
  );
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /public\/index\.html.*v1\.2\.3/);
  await writeFile(
    join(fixtureRoot, "public", "index.html"),
    '<small class="app-version" aria-label="当前版本 v1.2.3">v1.2.3</small>\n',
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "docs", "releases", "v1.2.3.md"),
    "# GPT-Image2-Studio v1.2.2\n示例标签：v1.2.3\n",
    "utf8",
  );
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /docs\/releases\/v1\.2\.3\.md.*v1\.2\.3/);

  await writeFile(
    join(fixtureRoot, "docs", "releases", "v1.2.3.md"),
    "前言\n# GPT-Image2-Studio v1.2.3\n",
    "utf8",
  );
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /docs\/releases\/v1\.2\.3\.md.*v1\.2\.3/);

  await writeFile(
    join(fixtureRoot, "docs", "releases", "v1.2.3.md"),
    "\uFEFF# GPT-Image2-Studio v1.2.3\n",
    "utf8",
  );
  await checkReleaseReadiness({ rootDir: fixtureRoot });
});

test("security and contribution guidance are tracked project documents", async () => {
  const [readme, chineseReadme, security, contributing] = await Promise.all([
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../README.zh-CN.md", import.meta.url), "utf8"),
    readFile(new URL("../SECURITY.md", import.meta.url), "utf8"),
    readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8"),
  ]);

  assert.match(security, /Basic/i);
  assert.match(security, /Bearer/i);
  assert.match(security, /X-Image-Studio-Token/i);
  assert.match(security, /反向代理/);
  assert.match(security, /不会由后端发起 Basic 登录挑战/u);
  assert.match(security, /显式配置的固定 Bearer 或 `X-Image-Studio-Token` 令牌/u);
  assert.match(readme, /reverse proxy/i);
  assert.match(readme, /fixed token/i);
  assert.match(chineseReadme, /TLS 反向代理不能依赖后端弹出登录框/u);
  assert.match(chineseReadme, /长期运行的反向代理应显式配置固定强令牌/u);
  assert.match(contributing, /OpenSpec/);
  assert.match(contributing, /sync:public-lib/);
  assert.match(contributing, /check:release/);
});
