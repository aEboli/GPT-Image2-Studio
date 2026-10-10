import { app, BrowserWindow, ipcMain } from "electron";
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { registerDesktopConfigBridge } from "../../desktop/config-bridge.mjs";

const [userDataDir, mode] = process.argv.slice(2);
app.setPath("userData", userDataDir);
app.disableHardwareAcceleration();
const root = fileURLToPath(new URL("../../", import.meta.url));

async function run() {
  const reservedServer = createServer();
  if (mode === "read") {
    const saved = JSON.parse(await readFile(join(userDataDir, "probe-origin.json"), "utf8"));
    await new Promise((resolveListen) => reservedServer.listen(new URL(saved.origin).port, "127.0.0.1", resolveListen));
  }
  const server = createServer(async (request, response) => {
    if (request.url.startsWith("/lib/")) {
      response.writeHead(200, { "Content-Type": "text/javascript" });
      response.end(await readFile(resolve(root, `.${request.url}`)));
      return;
    }
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end("<!doctype html><title>Desktop Config Probe</title>");
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  const origin = `http://127.0.0.1:${server.address().port}`;
  let window;
  const dispose = registerDesktopConfigBridge({ ipcMain, userDataDir, studioUrl: origin, getWebContents: () => window?.webContents });
  window = new BrowserWindow({ show: false, webPreferences: { preload: join(root, "desktop", "preload.cjs"), nodeIntegration: false, contextIsolation: true, sandbox: true } });
  try {
    await window.loadURL(origin);
    const result = await window.webContents.executeJavaScript(`(async () => {
      const config = await import('/lib/browser-config.mjs');
      await config.restoreDesktopBrowserConfig();
      if (${mode === "save"}) {
        const saved = config.saveBrowserPrivateConfig({ apiKey: 'synthetic-desktop-key', baseUrl: 'https://provider.example.test/v1', generationConcurrency: 3 });
        await window.studioDesktopConfig.saveConfig(saved);
      }
      const saved = config.readBrowserPrivateConfig();
      return { origin: location.origin, apiKey: saved?.apiKey, generationConcurrency: saved?.generationConcurrency, nodeExposed: typeof require !== 'undefined' };
    })()`);
    if (mode === "save") {
      const { writeFile } = await import("node:fs/promises");
      await writeFile(join(userDataDir, "probe-origin.json"), JSON.stringify({ origin }));
    }
    console.log(`DESKTOP_CONFIG_PROBE=${JSON.stringify(result)}`);
  } finally {
    dispose();
    window.destroy();
    server.closeAllConnections();
    await new Promise((resolveClose) => server.close(resolveClose));
    if (reservedServer.listening) await new Promise((resolveClose) => reservedServer.close(resolveClose));
    app.quit();
  }
}

app.whenReady().then(run).catch((error) => { console.error(error); app.exit(1); });
