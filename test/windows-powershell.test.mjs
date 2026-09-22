import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { mkdtemp, mkdir, readFile, writeFile, copyFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const windows = process.platform === "win32";
const quote = (value) => `'${value.replaceAll("'", "''")}'`;
const ps = (code, options = {}) => spawnSync("pwsh.exe", ["-NoLogo", "-NoProfile", "-Command", "[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false); " + code], {
  cwd: root, encoding: "utf8", timeout: 30000, windowsHide: true, ...options,
});
function success(result) {
  assert.ifError(result.error);
  assert.equal(result.status, 0, result.stderr || result.stdout);
}
async function temporary(run) {
  const dir = await mkdtemp(join(tmpdir(), "studio-ps7 中文 ' "));
  try { await run(dir); } finally { await rm(dir, { recursive: true, force: true }); }
}

test("owned PowerShell scripts parse and declare the Windows 7.4 boundary", { skip: !windows }, () => {
  const files = execFileSync("git", ["ls-files", "*.ps1"], { cwd: root, encoding: "utf8" }).trim().split(/\r?\n/);
  assert.equal(files.length, 4);
  for (const file of files) {
    success(ps(`$ErrorActionPreference='Stop'; $tokens=$null; $errors=$null
      $ast=[System.Management.Automation.Language.Parser]::ParseFile(${quote(join(root, file))},[ref]$tokens,[ref]$errors)
      if ($errors.Count) { throw ($errors | Out-String) }
      if ($ast.ScriptRequirements.RequiredPSVersion -ne [version]'7.4') { throw 'Missing minimum version' }
      $source=$ast.Extent.Text
      foreach ($required in @('Set-StrictMode -Version Latest', '$ErrorActionPreference = "Stop"', '$IsWindows')) {
        if (-not $source.Contains($required)) { throw "Missing $required" }
      }`));
  }
});

test("CMD wrappers forward quoted arguments, preserve failures and reject missing prerequisites", { skip: !windows }, async () => {
  for (const file of ["launch-studio.cmd", "extensions/product-image-collector/native-host/install-native-host.cmd", "extensions/product-image-collector/native-host/uninstall-native-host.cmd"]) {
    await temporary(async (dir) => {
      const name = file.split("/").at(-1);
      const wrapper = join(dir, name);
      const script = wrapper.replace(/\.cmd$/, ".ps1");
      const source = await readFile(join(root, file), "utf8");
      assert.doesNotMatch(source, /powershell(?:\.exe)?\s+-/i);
      assert.match(source, /pwsh\.exe -NoLogo -NoProfile -ExecutionPolicy Bypass -File/);
      await writeFile(wrapper, source.replace(/\r?\n/g, "\r\n"));
      const run = (env = process.env) => spawnSync(process.env.ComSpec, ["/d", "/c", `""${wrapper}" "中文 value""`], {
        cwd: tmpdir(), env, input: "\r\n", encoding: "utf8", timeout: 15000, windowsHide: true, windowsVerbatimArguments: true,
      });
      assert.equal(run().status, 2);
      await writeFile(script, `if ($args[0] -ne '中文 value') { exit 99 }; exit 42`);
      assert.equal(run().status, 42);
      const env = { ...process.env };
      for (const key of Object.keys(env)) if (key.toLowerCase() === "path") delete env[key];
      env.PATH = join(process.env.SystemRoot, "System32");
      const missing = run(env);
      assert.equal(missing.status, 9009);
      assert.match(missing.stdout, /PowerShell 7\.4/);
    });
  }
});

test("launcher executes discovery, environment isolation, readiness and error paths without opening a browser", { skip: !windows }, async () => {
  const original = await readFile(join(root, "launch-studio.ps1"), "utf8");
  for (const scenario of ["available", "reuse", "conflict", "timeout", "exit", "start-failure"]) {
    await temporary(async (dir) => {
      await writeFile(join(dir, "server.mjs"), "");
      const script = join(dir, "launch-studio.ps1");
      const occupied = ["reuse", "conflict"].includes(scenario) ? "@(3600)" : "@()";
      await writeFile(script, original.replace("$listeningPorts = Get-ListeningLocalPorts", `$listeningPorts = [System.Collections.Generic.HashSet[int]]::new([int[]]${occupied})`));
      const result = ps(`$ErrorActionPreference='Stop'
        $env:IMAGE_STUDIO_MOCK_IMAGE_GENERATION='1'
        $global:opened=0; $global:started=0; $global:clock=0
        function Start-Sleep { param($Milliseconds) }
        function Get-Date { $global:clock++; [datetime]::new(2026,1,1).AddSeconds($global:clock * 30) }
        function Invoke-WebRequest {
          param($Uri,$Method,[switch]$UseBasicParsing,$TimeoutSec)
          if (${quote(scenario)} -in @('timeout','exit','start-failure')) { throw 'not ready' }
          if (${quote(scenario)} -eq 'conflict' -and $Uri -match ':3600/') { throw 'unrelated service' }
          if ($Uri -notmatch '/api/article-illustration/sets$') { throw 'wrong endpoint' }
          @{ StatusCode=200 }
        }
        function Start-Process {
          param($FilePath,$WorkingDirectory,$ArgumentList,$Environment,$WindowStyle,[switch]$PassThru,$ErrorAction)
          if ($FilePath -like 'http*') {
            $expected=if (${quote(scenario)} -eq 'conflict') {3601} else {3600}
            if ($FilePath -ne "http://localhost:$expected") { throw 'wrong browser port' }
            $global:opened++; return
          }
          if (${quote(scenario)} -eq 'start-failure') { throw 'injected start failure' }
          if ($ArgumentList -ne 'server.mjs' -or $Environment.IMAGE_STUDIO_MOCK_IMAGE_GENERATION -ne $null) { throw 'wrong process arguments' }
          $expected=if (${quote(scenario)} -eq 'conflict') {'3601'} else {'3600'}
          if ($Environment.PORT -ne $expected) { throw 'wrong child port' }
          $global:started++
          @{ HasExited=(${quote(scenario)} -eq 'exit'); ExitCode=23 }
        }
        try { & ${quote(script)} -Root ${quote(dir)} } catch {
          if (${quote(scenario)} -eq 'timeout' -and $_ -notmatch 'timed out') { throw }
          if (${quote(scenario)} -eq 'exit' -and $_ -notmatch 'code 23') { throw }
          if (${quote(scenario)} -eq 'start-failure' -and $_ -notmatch 'injected start failure') { throw }
          if (${quote(scenario)} -notin @('timeout','exit','start-failure')) { throw }
          if ($global:opened) { throw 'opened browser on failure' }
          Write-Output 'EXPECTED_FAILURE'; exit 0
        }
        if (${quote(scenario)} -in @('timeout','exit','start-failure')) { throw 'expected failure' }
        if ($global:opened -ne 1) { throw 'browser not opened exactly once' }
        if (${quote(scenario)} -eq 'reuse' -and $global:started) { throw 'started duplicate server' }
        if (${quote(scenario)} -ne 'reuse' -and $global:started -ne 1) { throw 'server not started' }
        if (Test-Path Env:IMAGE_STUDIO_MOCK_IMAGE_GENERATION) { throw 'mock leaked' }`);
      success(result);
    });
  }
});

test("launcher resolves relative Root after Set-Location and starts a healthy Node child", { skip: !windows }, async () => {
  await temporary(async (dir) => {
    await writeFile(join(dir, "server.mjs"), `import http from 'node:http';
      if (process.env.IMAGE_STUDIO_MOCK_IMAGE_GENERATION) process.exit(23);
      http.createServer((req,res) => { res.writeHead(req.url === '/api/article-illustration/sets' ? 200 : 404); res.end('{}'); }).listen(Number(process.env.PORT),'127.0.0.1');`);
    success(ps(`$ErrorActionPreference='Stop'
      $env:IMAGE_STUDIO_MOCK_IMAGE_GENERATION='1'
      $global:child=$null; $global:opened=$false
      Set-Location -LiteralPath ${quote(dir)}
      $listener=[System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback,0)
      $listener.Start(); $port=$listener.LocalEndpoint.Port; $listener.Stop()
      function Start-Process {
        param($FilePath,$WorkingDirectory,$ArgumentList,$Environment,$WindowStyle,[switch]$PassThru,$ErrorAction)
        if ($FilePath -like 'http*') { $global:opened=$true; return }
        if ($WorkingDirectory -ne ${quote(dir)}) { throw 'Root resolved against the wrong working directory' }
        $global:child=Microsoft.PowerShell.Management\\Start-Process -FilePath $FilePath -WorkingDirectory $WorkingDirectory -ArgumentList $ArgumentList -Environment $Environment -WindowStyle Hidden -PassThru
        $global:child
      }
      try {
        & ${quote(join(root, "launch-studio.ps1"))} -Root . -Port $port
        if (-not $global:opened -or $null -eq $global:child -or $global:child.HasExited) { throw 'server not healthy' }
      } finally {
        if ($null -ne $global:child) { $global:child.Kill(); $global:child.WaitForExit(); $global:child.Dispose() }
      }`));
  });
});

test("Native Messaging install and uninstall use isolated filesystem and intercepted registry calls", { skip: !windows }, async () => {
  await temporary(async (dir) => {
    for (const name of ["install-native-host.ps1", "uninstall-native-host.ps1"]) {
      await copyFile(join(root, "extensions/product-image-collector/native-host", name), join(dir, name));
    }
    await writeFile(join(dir, "ProductImageClipboardHost.exe"), "fixture exe");
    const code = `$ErrorActionPreference='Stop'
      Remove-PSDrive HKCU -Force
      $env:LOCALAPPDATA=${quote(dir)}
      $global:keys=@{}; $global:removed=@()
      function New-Item {
        param($Path,$ItemType,[switch]$Force)
        if ($Path -like 'HKCU:*') { $global:keys[$Path]=$null; return }
        Microsoft.PowerShell.Management\\New-Item -Path $Path -ItemType $ItemType -Force:$Force
      }
      function Set-Item { param($Path,$Value) if ($Path -notlike 'HKCU:*') { throw 'unexpected registry write' }; $global:keys[$Path]=$Value }
      function Test-Path {
        param($LiteralPath,$PathType)
        if ($LiteralPath -like 'HKCU:*') { return $global:keys.ContainsKey($LiteralPath) }
        if ($PathType) { Microsoft.PowerShell.Management\\Test-Path -LiteralPath $LiteralPath -PathType $PathType }
        else { Microsoft.PowerShell.Management\\Test-Path -LiteralPath $LiteralPath }
      }
      function Remove-Item {
        param($LiteralPath,[switch]$Recurse,[switch]$Force)
        if ($LiteralPath -like 'HKCU:*') { $global:removed += $LiteralPath; $global:keys.Remove($LiteralPath); return }
        if (-not $LiteralPath.StartsWith($env:LOCALAPPDATA)) { throw 'unsafe removal' }
        Microsoft.PowerShell.Management\\Remove-Item -LiteralPath $LiteralPath -Recurse:$Recurse -Force:$Force
      }
      & ${quote(join(dir, "install-native-host.ps1"))}
      $name='com.aeboli.gpt_image2_studio.product_image_clipboard'
      foreach ($browser in @('Google\\Chrome','Microsoft\\Edge')) {
        if (-not $global:keys.ContainsKey("HKCU:\\Software\\$browser\\NativeMessagingHosts\\$name")) { throw 'wrong registry path' }
      }
      if ($global:keys.Count -ne 2) { throw 'unexpected registry keys' }
      $target=Join-Path $env:LOCALAPPDATA 'GPT-Image2-Studio\\ProductImageClipboardHost'
      $manifest=Join-Path $target "$name.json"
      $bytes=[IO.File]::ReadAllBytes($manifest)
      if ($bytes[0] -eq 239 -and $bytes[1] -eq 187 -and $bytes[2] -eq 191) { throw 'BOM in manifest' }
      $data=[IO.File]::ReadAllText($manifest) | ConvertFrom-Json
      if ($data.name -ne $name -or $data.type -ne 'stdio' -or $data.allowed_origins.Count -ne 1 -or $data.allowed_origins[0] -ne 'chrome-extension://gbdkgkooddcicpkikaklapgeakhjjcan/') { throw 'wrong manifest identity' }
      if ([IO.File]::ReadAllText($data.path) -ne 'fixture exe') { throw 'wrong EXE copy' }
      & ${quote(join(dir, "uninstall-native-host.ps1"))}
      if ($global:keys.Count -or $global:removed.Count -ne 2 -or (Test-Path -LiteralPath $target)) { throw 'uninstall incomplete' }
      Microsoft.PowerShell.Management\\Remove-Item -LiteralPath ${quote(join(dir, "ProductImageClipboardHost.exe"))}
      try { & ${quote(join(dir, "install-native-host.ps1"))}; throw 'expected missing EXE failure' } catch {
        if ($_ -notmatch '缺少 ProductImageClipboardHost.exe') { throw }
      }
      if ($global:keys.Count) { throw 'registry written without EXE' }
      exit 0`;
    success(ps(code));
  });
});

test("asset generator works from another directory and reports missing output and Node failure", { skip: !windows }, async () => {
  await temporary(async (dir) => {
    await mkdir(join(dir, "scripts"));
    await mkdir(join(dir, "lib"));
    const script = join(dir, "scripts/generate-portrait-accessory-color-assets.ps1");
    await copyFile(join(root, "scripts/generate-portrait-accessory-color-assets.ps1"), script);
    await copyFile(join(root, "lib/portrait-accessory-assets.mjs"), join(dir, "lib/portrait-accessory-assets.mjs"));
    const missing = ps(`& ${quote(script)}`, { cwd: tmpdir() });
    assert.notEqual(missing.status, 0);
    assert.match(missing.stderr, /资源输出目录不存在/);
    await mkdir(join(dir, "public/assets/portrait-accessories"), { recursive: true });
    success(ps(`& ${quote(script)}`, { cwd: tmpdir() }));
    const failure = ps(`function node { $global:LASTEXITCODE=19 }; & ${quote(script)}`);
    assert.notEqual(failure.status, 0);
    assert.match(failure.stderr, /19/);
  });
});

test("installer fallback uses PS7 and expands quoted paths without executing path contents", { skip: !windows }, async () => {
  const source = await readFile(join(root, "scripts/build-windows-installer.mjs"), "utf8");
  assert.doesNotMatch(source, /powershell(?:\.exe)?\s+-/i);
  const command = source.match(/pwsh\.exe .*?-Command "([^\r\n]+)"/)[1];
  await temporary(async (dir) => {
    const input = join(dir, "input.txt");
    const zip = join(dir, "payload.zip");
    const output = join(dir, "output");
    await writeFile(input, "payload");
    success(ps(`Compress-Archive -LiteralPath ${quote(input)} -DestinationPath ${quote(zip)}`));
    success(ps(command, { env: { ...process.env, STUDIO_PAYLOAD: zip, LOCALAPPDATA: output } }));
    assert.equal(await readFile(join(output, "input.txt"), "utf8"), "payload");
    const failure = ps(command, { env: { ...process.env, STUDIO_PAYLOAD: join(dir, "missing.zip"), LOCALAPPDATA: output } });
    assert.notEqual(failure.status, 0);
  });
});
