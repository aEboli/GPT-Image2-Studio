import test from "node:test";
import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { access, mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

import { registerDesktopConfigBridge } from "../desktop/config-bridge.mjs";
import { BROWSER_CONFIG_STORAGE_KEY, readBrowserPrivateConfig, restoreDesktopBrowserConfig } from "../lib/browser-config.mjs";

function createStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) || null, setItem: (key, value) => values.set(key, value) };
}

test("desktop configuration is persistent, normalized and restricted to the primary Studio frame", async (t) => {
  const userDataDir = await mkdtemp(join(tmpdir(), "studio-desktop-config-"));
  t.after(() => rm(userDataDir, { recursive: true, force: true }));
  const handlers = new Map();
  const ipcMain = { handle: (name, fn) => handlers.set(name, fn), removeHandler: (name) => handlers.delete(name) };
  const mainFrame = { origin: "http://127.0.0.1:41001", url: "http://127.0.0.1:41001/" };
  const contents = { mainFrame, isDestroyed: () => false };
  const dispose = registerDesktopConfigBridge({ ipcMain, userDataDir, studioUrl: mainFrame.url, getWebContents: () => contents });
  const event = { sender: contents, senderFrame: mainFrame };
  const read = handlers.get("studio:config:read");
  const save = handlers.get("studio:config:save");
  assert.equal(await read(event), null);
  const config = await save(event, { apiKey: "synthetic-desktop-key", baseUrl: "https://provider.example.test/v1", generationConcurrency: 3, unexpected: "ignored" });
  assert.equal(config.apiKey, "synthetic-desktop-key");
  assert.equal(config.unexpected, undefined);
  const invalidEvents = [
    { sender: {}, senderFrame: mainFrame },
    { sender: contents, senderFrame: null },
    { sender: contents, senderFrame: { ...mainFrame } },
  ];
  for (const invalidEvent of invalidEvents) {
    await assert.rejects(read(invalidEvent), /来源|frame|Studio/);
    await assert.rejects(save(invalidEvent, { apiKey: "changed" }), /来源|frame|Studio/);
  }
  mainFrame.origin = "https://unrelated.example.test";
  await assert.rejects(read(event), /来源|frame|Studio/);
  mainFrame.origin = "http://127.0.0.1:41001";
  assert.equal((await read(event)).apiKey, "synthetic-desktop-key");
  dispose();
  assert.equal(handlers.size, 0);

  mainFrame.origin = "http://127.0.0.1:41002";
  mainFrame.url = `${mainFrame.origin}/`;
  registerDesktopConfigBridge({ ipcMain, userDataDir, studioUrl: mainFrame.url, getWebContents: () => contents });
  const storage = createStorage();
  await restoreDesktopBrowserConfig(storage, {
    readConfig: () => handlers.get("studio:config:read")(event),
    saveConfig: (value) => handlers.get("studio:config:save")(event, value),
  });
  assert.equal(readBrowserPrivateConfig(storage).apiKey, "synthetic-desktop-key");
  assert.equal(readBrowserPrivateConfig(storage).generationConcurrency, 3);
});

test("desktop persistence migrates an existing browser configuration only when no disk configuration exists", async () => {
  const storage = createStorage();
  storage.setItem(BROWSER_CONFIG_STORAGE_KEY, JSON.stringify({ apiKey: "existing-port-key" }));
  let saved;
  await restoreDesktopBrowserConfig(storage, { readConfig: async () => null, saveConfig: async (value) => { saved = value; } });
  assert.equal(saved.apiKey, "existing-port-key");
  await restoreDesktopBrowserConfig(storage, { readConfig: async () => ({ apiKey: "disk-key" }), saveConfig: async () => assert.fail("must not overwrite saved configuration") });
  assert.equal(readBrowserPrivateConfig(storage).apiKey, "disk-key");
});

test("sandboxed Electron restores configuration after a process restart with a new port", { skip: process.platform !== "win32", timeout: 30000 }, async (t) => {
  const repoRoot = fileURLToPath(new URL("../", import.meta.url));
  const electronPath = join(repoRoot, "node_modules", "electron", "dist", "electron.exe");
  try {
    await access(electronPath);
  } catch {
    t.skip("Electron runtime is unavailable in this environment");
    return;
  }

  const userDataDir = await mkdtemp(join(tmpdir(), "studio-electron-config-restart-"));
  t.after(() => rm(userDataDir, { recursive: true, force: true, maxRetries: 6, retryDelay: 100 }));
  const probePath = fileURLToPath(new URL("./fixtures/desktop-config-restart-probe.mjs", import.meta.url));
  const run = promisify(execFile);
  const env = { ...process.env };
  delete env.ELECTRON_RUN_AS_NODE;
  const first = await run(electronPath, [probePath, userDataDir, "save"], { cwd: repoRoot, env, windowsHide: true, timeout: 12000 });
  const second = await run(electronPath, [probePath, userDataDir, "read"], { cwd: repoRoot, env, windowsHide: true, timeout: 12000 });
  const firstResult = JSON.parse(first.stdout.match(/DESKTOP_CONFIG_PROBE=(.+)/)[1]);
  const secondResult = JSON.parse(second.stdout.match(/DESKTOP_CONFIG_PROBE=(.+)/)[1]);
  assert.notEqual(firstResult.origin, secondResult.origin);
  assert.equal(secondResult.apiKey, "synthetic-desktop-key");
  assert.equal(secondResult.generationConcurrency, 3);
  assert.equal(secondResult.nodeExposed, false);
  const persisted = JSON.parse(await readFile(join(userDataDir, ".local", "desktop-browser-config.json"), "utf8"));
  assert.equal(persisted.apiKey, "synthetic-desktop-key");
});
