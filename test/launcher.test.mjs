import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launcherPath = new URL("../launch-studio.ps1", import.meta.url);

test("launcher avoids opening an incompatible stale server on the requested port", async () => {
  const script = await readFile(launcherPath, "utf8");

  assert.match(script, /function Get-StudioPortListener/);
  assert.match(script, /function Test-StudioServer/);
  assert.match(script, /\/api\/article-illustration\/sets/);
  assert.match(script, /function Find-StudioPort/);
  assert.match(script, /set PORT=\$targetPort&& node server\.mjs/);
  assert.match(script, /Start-Process "http:\/\/localhost:\$targetPort"/);
  assert.doesNotMatch(script, /Start-Process "http:\/\/localhost:\$Port"/);
});
