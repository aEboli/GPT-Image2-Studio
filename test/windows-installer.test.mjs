import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const installerScriptPath = new URL("../scripts/build-windows-installer.mjs", import.meta.url);

test("Windows installer build gives IExpress enough time for large payloads", async () => {
  const script = await readFile(installerScriptPath, "utf8");

  assert.match(script, /const IEXPRESS_TIMEOUT_MS = 600000;/);
  assert.match(script, /run\("iexpress\.exe", \["\/N", sedPath\], \{ timeout: IEXPRESS_TIMEOUT_MS \}\);/);
  assert.doesNotMatch(script, /run\("iexpress\.exe", \["\/N", sedPath\], \{ timeout: 120000 \}\);/);
});

test("Windows installer payload keeps DNS fallback module, docs, and env switches", async () => {
  const script = await readFile(installerScriptPath, "utf8");

  assert.match(script, /"lib",/);
  assert.match(script, /"\.env\.example",/);
  assert.match(script, /"docs",/);
  assert.match(script, /env: \{ \.\.\.process\.env, PORT: String\(port\) \}/);
});
