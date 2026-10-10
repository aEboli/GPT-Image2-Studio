import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { normalizeBrowserPrivateConfig } from "../lib/browser-config.mjs";
import { withFileTransaction, writeJsonFileAtomic } from "../lib/atomic-json-file.mjs";
import { isAllowedStudioNavigation } from "./url-policy.mjs";

export function registerDesktopConfigBridge({ ipcMain, userDataDir, studioUrl, getWebContents }) {
  const configPath = join(userDataDir, ".local", "desktop-browser-config.json");
  const studioOrigin = new URL(studioUrl).origin;
  function validateSender(event) {
    const contents = getWebContents();
    const frame = event.senderFrame;
    if (!contents || contents.isDestroyed() || event.sender !== contents || !frame ||
        frame !== contents.mainFrame || frame.origin !== studioOrigin || !isAllowedStudioNavigation(frame.url, studioUrl)) {
      throw new Error("桌面配置请求来源不是主 Studio frame。");
    }
  }
  ipcMain.handle("studio:config:read", async (event) => {
    validateSender(event);
    try {
      const saved = JSON.parse(await readFile(configPath, "utf8"));
      return normalizeBrowserPrivateConfig(saved, { preserveRootBaseUrls: true });
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  });
  ipcMain.handle("studio:config:save", async (event, config) => {
    validateSender(event);
    if (!config || typeof config !== "object" || Array.isArray(config) || JSON.stringify(config).length > 64 * 1024) {
      throw new Error("桌面 API 配置无效或超过大小限制。");
    }
    const normalized = normalizeBrowserPrivateConfig(config, { preserveRootBaseUrls: true });
    await withFileTransaction(configPath, () => writeJsonFileAtomic(configPath, normalized));
    return normalized;
  });
  return () => {
    ipcMain.removeHandler("studio:config:read");
    ipcMain.removeHandler("studio:config:save");
  };
}
