import { execFileSync } from "node:child_process";
import { copyFile, mkdir, readdir, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const packageJson = JSON.parse(
  await import("node:fs/promises").then((fs) =>
    fs.readFile(join(rootDir, "package.json"), "utf8"),
  ),
);

const appName = "GPT-Image2-Studio";
const version = packageJson.version || "0.1.0";
const buildId = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
const buildRoot = join(rootDir, "artifacts", "windows-installer", buildId);
const stageRoot = join(buildRoot, "stage");
const appStageDir = join(stageRoot, appName);
const runtimeDir = join(appStageDir, "runtime");
const installerDir = join(buildRoot, "installer");
const payloadZip = join(installerDir, "payload.zip");
const installCmd = join(installerDir, "install.cmd");
const sedPath = join(installerDir, "installer.sed");
const setupExe = join(buildRoot, `${appName}-Setup-v${version}.exe`);
const IEXPRESS_TIMEOUT_MS = 600000;

const includePaths = [
  ".env.example",
  "README.md",
  "docs",
  "examples",
  "generate-image.mjs",
  "launch-studio.cmd",
  "launch-studio.ps1",
  "lib",
  "package-lock.json",
  "package.json",
  "node_modules",
  "public",
  "server.mjs",
  "stop-studio-services.cmd",
];

function run(command, args, options = {}) {
  return execFileSync(command, args, {
    cwd: rootDir,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    ...options,
  });
}

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error && typeof error === "object" && error.code === "ENOENT") {
      return false;
    }
    throw error;
  }
}

async function copyRecursive(source, target) {
  const sourceStat = await stat(source);
  if (sourceStat.isDirectory()) {
    await mkdir(target, { recursive: true });
    const entries = await readdir(source, { withFileTypes: true });
    for (const entry of entries) {
      await copyRecursive(join(source, entry.name), join(target, entry.name));
    }
    return;
  }

  await mkdir(dirname(target), { recursive: true });
  await copyFile(source, target);
}

function findNodeExe() {
  const candidates = run("where", ["node"])
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  const preferred = candidates.find((candidate) =>
    /\\nodejs\\node\.exe$/i.test(candidate),
  );
  return preferred || candidates.find((candidate) => /node\.exe$/i.test(candidate));
}

function writeLauncherFiles() {
  const launcherMjs = `import { spawn } from "node:child_process";
import { createConnection } from "node:net";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const rootDir = dirname(fileURLToPath(import.meta.url));
const requestedPort = Number(process.env.PORT || process.argv[2] || 3600);

function isPortListening(port) {
  return new Promise((resolve) => {
    const socket = createConnection({ host: "127.0.0.1", port });
    socket.once("connect", () => {
      socket.destroy();
      resolve(true);
    });
    socket.once("error", () => resolve(false));
    socket.setTimeout(700, () => {
      socket.destroy();
      resolve(false);
    });
  });
}

async function findPort(startPort) {
  for (let port = startPort; port <= startPort + 20; port += 1) {
    if (!(await isPortListening(port))) {
      return port;
    }
  }
  throw new Error("没有找到可用端口，请关闭占用 3600-3620 的程序后重试。");
}

function openBrowser(port) {
  const url = \`http://127.0.0.1:\${port}/\`;
  const child = spawn("cmd.exe", ["/d", "/s", "/c", "start", "", url], {
    detached: true,
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();
}

async function main() {
  const port = await findPort(requestedPort);
  const child = spawn(process.execPath, [join(rootDir, "server.mjs")], {
    cwd: rootDir,
    detached: true,
    env: { ...process.env, PORT: String(port) },
    stdio: "ignore",
    windowsHide: true,
  });
  child.unref();

  const deadline = Date.now() + 15000;
  while (Date.now() < deadline) {
    if (await isPortListening(port)) {
      openBrowser(port);
      return;
    }
    await delay(350);
  }

  throw new Error(\`服务启动超时，请手动访问 http://127.0.0.1:\${port}/ 或重新启动。\`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
`;

  const launcherCmd = `@echo off\r\nsetlocal\r\n"%~dp0runtime\\node.exe" "%~dp0launch-installed.mjs" %*\r\nif errorlevel 1 pause\r\nendlocal\r\n`;
  return Promise.all([
    writeFile(join(appStageDir, "launch-installed.mjs"), launcherMjs, "utf8"),
    writeFile(join(appStageDir, `${appName}.cmd`), launcherCmd, "utf8"),
  ]);
}

function buildInstallCmd() {
  return `@echo off
setlocal EnableExtensions
set "APP_NAME=${appName}"
set "INSTALL_DIR=%LOCALAPPDATA%\\${appName}"
set "START_MENU_DIR=%APPDATA%\\Microsoft\\Windows\\Start Menu\\Programs\\${appName}"
set "DESKTOP_DIR=%USERPROFILE%\\Desktop"

if not exist "%LOCALAPPDATA%" (
  echo Cannot find LOCALAPPDATA.
  exit /b 1
)

where tar.exe >nul 2>nul
if errorlevel 1 (
  powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath '%~dp0payload.zip' -DestinationPath $env:LOCALAPPDATA -Force"
) else (
  tar.exe -xf "%~dp0payload.zip" -C "%LOCALAPPDATA%"
)

if not exist "%INSTALL_DIR%\\${appName}.cmd" (
  echo Install failed: "%INSTALL_DIR%\\${appName}.cmd" was not found.
  exit /b 1
)

if not exist "%START_MENU_DIR%" mkdir "%START_MENU_DIR%"
>"%START_MENU_DIR%\\${appName}.cmd" echo @echo off
>>"%START_MENU_DIR%\\${appName}.cmd" echo call "%INSTALL_DIR%\\${appName}.cmd" %%*

if exist "%DESKTOP_DIR%" (
  >"%DESKTOP_DIR%\\${appName}.cmd" echo @echo off
  >>"%DESKTOP_DIR%\\${appName}.cmd" echo call "%INSTALL_DIR%\\${appName}.cmd" %%*
)

echo ${appName} has been installed to:
echo %INSTALL_DIR%
echo.
echo Starting ${appName}...
start "" "%INSTALL_DIR%\\${appName}.cmd"
endlocal
`;
}

function buildSedFile() {
  const installerSource = installerDir.replaceAll("\\", "\\\\");
  const targetName = setupExe.replaceAll("\\", "\\\\");
  return `[Version]
Class=IEXPRESS
SEDVersion=3
[Options]
PackagePurpose=InstallApp
ShowInstallProgramWindow=1
HideExtractAnimation=1
UseLongFileName=1
InsideCompressed=0
CAB_FixedSize=0
CAB_ResvCodeSigning=0
RebootMode=N
InstallPrompt=%InstallPrompt%
DisplayLicense=%DisplayLicense%
FinishMessage=%FinishMessage%
TargetName=%TargetName%
FriendlyName=%FriendlyName%
AppLaunched=%AppLaunched%
PostInstallCmd=<None>
AdminQuietInstCmd=%AppLaunched%
UserQuietInstCmd=%AppLaunched%
SourceFiles=SourceFiles
[Strings]
InstallPrompt=
DisplayLicense=
FinishMessage=${appName} 安装完成。
TargetName=${targetName}
FriendlyName=${appName}
AppLaunched=install.cmd
FILE0=payload.zip
FILE1=install.cmd
[SourceFiles]
SourceFiles0=${installerSource}
[SourceFiles0]
%FILE0%=
%FILE1%=
`;
}

async function main() {
  if (await exists(buildRoot)) {
    throw new Error(`Build directory already exists: ${buildRoot}`);
  }

  await mkdir(runtimeDir, { recursive: true });
  await mkdir(installerDir, { recursive: true });

  for (const relativePath of includePaths) {
    await copyRecursive(join(rootDir, relativePath), join(appStageDir, relativePath));
  }

  const nodeExe = findNodeExe();
  if (!nodeExe) {
    throw new Error("Cannot find node.exe. Please install Node.js first.");
  }
  await copyFile(nodeExe, join(runtimeDir, "node.exe"));
  await writeLauncherFiles();
  await writeFile(installCmd, buildInstallCmd(), "utf8");

  run("tar.exe", ["-a", "-cf", payloadZip, "-C", stageRoot, appName]);
  await writeFile(sedPath, buildSedFile(), "utf8");
  run("iexpress.exe", ["/N", sedPath], { timeout: IEXPRESS_TIMEOUT_MS });

  console.log(`${appName} installer created:`);
  console.log(setupExe);
}

await main();
