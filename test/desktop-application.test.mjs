import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createConnection } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packagePath = join(rootDir, "package.json");
const desktopMainPath = join(rootDir, "desktop", "main.mjs");

function isPortListening(port) {
  return new Promise((resolveListening) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolveListening(true);
    });
    socket.once("error", () => resolveListening(false));
    socket.setTimeout(500, () => {
      socket.destroy();
      resolveListening(false);
    });
  });
}

async function runLifecycleProbe(tempRoot) {
  const source = `
process.env.HOST = "127.0.0.1";
process.env.PORT = "0";
const runtime = await import("./server.mjs");
if (!runtime.studioServerUrl || typeof runtime.closeStudioServer !== "function") {
  console.error("MISSING_STUDIO_SERVER_LIFECYCLE");
  process.exit(7);
}
const response = await fetch(runtime.studioServerUrl);
const body = await response.text();
console.log("LIFECYCLE_URL=" + runtime.studioServerUrl);
console.log("LIFECYCLE_PAGE_OK=" + String(response.status === 200 && body.includes("<title>Image Studio</title>")));
await runtime.closeStudioServer();
await runtime.closeStudioServer();
try {
  await fetch(runtime.studioServerUrl, { signal: AbortSignal.timeout(500) });
  console.log("LIFECYCLE_CLOSED=false");
} catch {
  console.log("LIFECYCLE_CLOSED=true");
}
`;
  const child = spawn(process.execPath, ["--input-type=module", "--eval", source], {
    cwd: rootDir,
    env: {
      ...process.env,
      IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local-data"),
      IMAGE_STUDIO_OUTPUT_DIR: join(tempRoot, "output"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  let stdout = "";
  let stderr = "";
  child.stdout.setEncoding("utf8");
  child.stderr.setEncoding("utf8");
  child.stdout.on("data", (chunk) => {
    stdout += chunk;
  });
  child.stderr.on("data", (chunk) => {
    stderr += chunk;
  });

  let timeoutId;
  const timeout = new Promise((resolveTimeout) => {
    timeoutId = setTimeout(() => {
      child.kill("SIGKILL");
      resolveTimeout([null, "timeout"]);
    }, 10000);
  });
  const exit = await Promise.race([once(child, "exit"), timeout]);
  clearTimeout(timeoutId);
  return { code: exit[0], signal: exit[1], stderr, stdout };
}

test("server exposes a dynamic loopback lifecycle that closes idempotently", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "image-studio-desktop-lifecycle-"));
  t.after(() => rm(tempRoot, { recursive: true, force: true }));

  const result = await runLifecycleProbe(tempRoot);
  assert.equal(result.code, 0, `${result.stderr}\n${result.stdout}`);
  assert.equal(result.signal, null);
  assert.match(result.stdout, /LIFECYCLE_PAGE_OK=true/);
  assert.match(result.stdout, /LIFECYCLE_CLOSED=true/);

  const url = result.stdout.match(/LIFECYCLE_URL=(http:\/\/127\.0\.0\.1:(\d+))/)?.[1];
  const port = Number(result.stdout.match(/LIFECYCLE_URL=http:\/\/127\.0\.0\.1:(\d+)/)?.[1]);
  assert.ok(url, result.stdout);
  assert.ok(Number.isInteger(port) && port > 0, result.stdout);
  assert.equal(await isPortListening(port), false);
});

test("desktop URL policy only allows the exact Studio origin and explicit project HTTPS links", async () => {
  const {
    isAllowedExternalUrl,
    isAllowedStudioNavigation,
  } = await import("../desktop/url-policy.mjs");
  const studioOrigin = "http://127.0.0.1:49152";

  assert.equal(isAllowedStudioNavigation(`${studioOrigin}/#creation`, studioOrigin), true);
  assert.equal(isAllowedStudioNavigation(`${studioOrigin}/api/config`, studioOrigin), true);
  assert.equal(isAllowedStudioNavigation("http://127.0.0.1:49153/", studioOrigin), false);
  assert.equal(isAllowedStudioNavigation("https://127.0.0.1:49152/", studioOrigin), false);
  assert.equal(isAllowedStudioNavigation("https://evil.example/", studioOrigin), false);
  assert.equal(isAllowedStudioNavigation("not a url", studioOrigin), false);

  assert.equal(isAllowedExternalUrl("https://github.com/aEboli/GPT-Image2-Studio"), true);
  assert.equal(isAllowedExternalUrl("https://github.com/aEboli/GPT-Image2-Studio/releases"), true);
  assert.equal(isAllowedExternalUrl("http://github.com/aEboli/GPT-Image2-Studio"), false);
  assert.equal(isAllowedExternalUrl("https://github.com/another/project"), false);
  assert.equal(isAllowedExternalUrl("file:///C:/Windows/System32/calc.exe"), false);
  assert.equal(isAllowedExternalUrl("powershell:Write-Host%20unsafe"), false);
});

test("desktop main process fixes single-instance, sandbox, navigation, data, and shutdown contracts", async () => {
  const source = await readFile(desktopMainPath, "utf8");

  assert.match(source, /app\.requestSingleInstanceLock\(\)/);
  assert.match(source, /app\.on\("second-instance"/);
  assert.match(source, /nodeIntegration:\s*false/);
  assert.match(source, /contextIsolation:\s*true/);
  assert.match(source, /sandbox:\s*true/);
  assert.doesNotMatch(source, /preload\s*:/);
  assert.match(source, /setWindowOpenHandler/);
  assert.match(source, /will-navigate/);
  assert.match(source, /page-title-updated/);
  assert.match(source, /window\.setTitle\(APP_NAME\)/);
  assert.match(source, /process\.env\.HOST\s*=\s*"127\.0\.0\.1"/);
  assert.match(source, /process\.env\.PORT\s*=\s*"0"/);
  assert.match(source, /IMAGE_STUDIO_LOCAL_DATA_DIR/);
  assert.match(source, /delete process\.env\.IMAGE_STUDIO_MOCK_IMAGE_GENERATION/);
  assert.match(source, /closeStudioServer/);
});

test("desktop package config uses a minimal x64 NSIS distribution", async () => {
  const packageJson = JSON.parse(await readFile(packagePath, "utf8"));
  const files = packageJson.build?.files || [];

  assert.equal(packageJson.main, "desktop/main.mjs");
  assert.equal(packageJson.scripts.desktop, "electron .");
  assert.equal(packageJson.scripts["test:desktop-smoke"], "electron . --desktop-smoke");
  assert.equal(packageJson.scripts["build:desktop"], "electron-builder --win nsis --x64");
  assert.ok(packageJson.devDependencies?.electron);
  assert.ok(packageJson.devDependencies?.["electron-builder"]);
  assert.equal(packageJson.build.appId, "com.aeboli.gptimage2studio");
  assert.equal(packageJson.build.productName, "GPT-Image2-Studio");
  assert.equal(packageJson.build.asar, true);
  assert.deepEqual(files, [
    "desktop/**/*",
    "server.mjs",
    "generate-image.mjs",
    "lib/**/*",
    "public/**/*",
    "extensions/product-image-collector/**/*",
    "build/desktop/icon.png",
    "README.md",
    "docs/windows-desktop.md",
    "package.json",
  ]);
  assert.equal(files.some((entry) => /test|\.env|artifact|output/i.test(entry)), false);
  assert.equal(packageJson.build.win.icon, "build/desktop/icon.ico");
  assert.deepEqual(packageJson.build.win.target, [{ target: "nsis", arch: ["x64"] }]);
  assert.equal(packageJson.build.nsis.oneClick, false);
  assert.equal(packageJson.build.nsis.perMachine, false);
  assert.equal(packageJson.build.nsis.createDesktopShortcut, true);
  assert.equal(packageJson.build.nsis.createStartMenuShortcut, true);
});
