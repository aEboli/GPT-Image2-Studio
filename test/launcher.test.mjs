import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const launcherPath = new URL("../launch-studio.ps1", import.meta.url);

test("launcher snapshots local listeners while avoiding an incompatible stale server on the requested port", async () => {
  const script = await readFile(launcherPath, "utf8");

  assert.match(script, /function Get-ListeningLocalPorts/);
  assert.match(script, /\[System\.Collections\.Generic\.HashSet\[int\]\]::new\(\)/);
  assert.match(script, /IPGlobalProperties\]::GetIPGlobalProperties\(\)\.GetActiveTcpListeners\(\)/);
  assert.equal((script.match(/GetActiveTcpListeners\(\)/g) || []).length, 1);
  assert.match(script, /\$listeningPorts = Get-ListeningLocalPorts/);
  assert.match(script, /Find-StudioPort -StartPort \$Port -ListeningPorts \$listeningPorts/);
  assert.match(script, /\[System\.Collections\.Generic\.HashSet\[int\]\]\$ListeningPorts/);
  assert.match(script, /\$targetPortInUse = \$listeningPorts\.Contains\(\$targetPort\)/);
  assert.doesNotMatch(script, /Get-StudioPortListener/);
  assert.doesNotMatch(script, /Get-NetTCPConnection/);
  assert.match(script, /function Test-StudioServer/);
  assert.match(script, /\/api\/article-illustration\/sets/);
  assert.match(script, /function Find-StudioPort/);
  assert.match(script, /Remove-Item Env:IMAGE_STUDIO_MOCK_IMAGE_GENERATION/);
  assert.match(script, /set IMAGE_STUDIO_MOCK_IMAGE_GENERATION=&& set PORT=\$targetPort&& node server\.mjs/);
  assert.match(script, /Start-Process "http:\/\/localhost:\$targetPort"/);
  assert.doesNotMatch(script, /Start-Process "http:\/\/localhost:\$Port"/);
});
