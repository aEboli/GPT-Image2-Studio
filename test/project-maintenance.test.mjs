import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { checkReleaseReadiness } from "../scripts/check-release-readiness.mjs";

test("package scripts pin deterministic tests, OpenSpec, and release checks", async () => {
  const packageJson = JSON.parse(await readFile(new URL("../package.json", import.meta.url), "utf8"));

  assert.equal(packageJson.scripts.test, "node --test --test-concurrency=1 ./test/*.test.mjs");
  assert.equal(packageJson.scripts["check:release"], "node scripts/check-release-readiness.mjs");
  assert.equal(packageJson.scripts["check:release:strict"], "node scripts/check-release-readiness.mjs --strict");
  assert.equal(packageJson.devDependencies["@fission-ai/openspec"], "1.6.0");
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
    "npm run build:pages",
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
  await writeFile(join(fixtureRoot, "package.json"), '{"version":"1.2.3"}\n', "utf8");
  await writeFile(
    join(fixtureRoot, "package-lock.json"),
    '{"version":"1.2.3","packages":{"":{"version":"1.2.3"}}}\n',
    "utf8",
  );
  await writeFile(join(fixtureRoot, "README.md"), "当前版本：`v1.2.3`\n", "utf8");
  await writeFile(
    join(fixtureRoot, "docs", "windows-desktop.md"),
    "`GPT-Image2-Studio-Desktop-Setup-v1.2.3-x64.exe` 是桌面安装包。\n",
    "utf8",
  );
  await writeFile(
    join(fixtureRoot, "docs", "releases", "v1.2.3.md"),
    "# GPT-Image2-Studio v1.2.3\n",
    "utf8",
  );

  const result = await checkReleaseReadiness({ rootDir: fixtureRoot });
  assert.equal(result.version, "1.2.3");

  await writeFile(join(fixtureRoot, "README.md"), "当前版本：`v1.2.2`\n示例标签：v1.2.3\n", "utf8");
  await assert.rejects(checkReleaseReadiness({ rootDir: fixtureRoot }), /README\.md.*v1\.2\.3/);

  await writeFile(join(fixtureRoot, "README.md"), "当前版本：`v1.2.3`\n", "utf8");
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
  const [readme, security, contributing] = await Promise.all([
    readFile(new URL("../README.md", import.meta.url), "utf8"),
    readFile(new URL("../SECURITY.md", import.meta.url), "utf8"),
    readFile(new URL("../CONTRIBUTING.md", import.meta.url), "utf8"),
  ]);

  assert.match(security, /Basic/i);
  assert.match(security, /Bearer/i);
  assert.match(security, /X-Image-Studio-Token/i);
  assert.match(security, /反向代理/);
  assert.match(security, /不会由后端发起 Basic 登录挑战/u);
  assert.match(security, /显式配置的固定 Bearer 或 `X-Image-Studio-Token` 令牌/u);
  assert.match(readme, /TLS 反向代理不能依赖后端弹出登录框/u);
  assert.match(readme, /长期运行的反向代理应显式配置固定强令牌/u);
  assert.match(contributing, /OpenSpec/);
  assert.match(contributing, /sync:public-lib/);
  assert.match(contributing, /check:release/);
});
