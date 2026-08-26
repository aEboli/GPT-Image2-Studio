import { app, BrowserWindow, dialog, shell } from "electron";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import {
  isAllowedExternalUrl,
  isAllowedStudioNavigation,
} from "./url-policy.mjs";

const APP_ID = "com.aeboli.gptimage2studio";
const APP_NAME = "GPT-Image2-Studio";
const isDesktopSmoke = process.argv.includes("--desktop-smoke");

let allowQuit = false;
let mainWindow = null;
let shutdownPromise = null;
let studioRuntime = null;

app.setName(APP_NAME);
app.setAppUserModelId(APP_ID);

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return;
  }
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.show();
  mainWindow.focus();
}

function openAllowedExternalUrl(url) {
  if (!isAllowedExternalUrl(url)) {
    return;
  }
  void shell.openExternal(url).catch((error) => {
    console.error(`无法打开外部链接：${error instanceof Error ? error.message : String(error)}`);
  });
}

function configureWindowNavigation(window, studioOrigin) {
  window.webContents.setWindowOpenHandler(({ url }) => {
    openAllowedExternalUrl(url);
    return { action: "deny" };
  });
  window.webContents.on("will-navigate", (event, url) => {
    if (isAllowedStudioNavigation(url, studioOrigin)) {
      return;
    }
    event.preventDefault();
    openAllowedExternalUrl(url);
  });
  window.webContents.on("will-attach-webview", (event) => {
    event.preventDefault();
  });
}

async function runDesktopSmoke(window, studioUrl) {
  const screenshotPath =
    process.env.IMAGE_STUDIO_DESKTOP_SMOKE_SCREENSHOT ||
    join(process.cwd(), "artifacts", "desktop-smoke.png");
  await delay(300);
  const title = await window.webContents.executeJavaScript("document.title", true);
  const image = await window.webContents.capturePage();
  await mkdir(dirname(screenshotPath), { recursive: true });
  await writeFile(screenshotPath, image.toPNG());
  console.log(`DESKTOP_SMOKE_READY=${JSON.stringify({ screenshotPath, studioUrl, title })}`);
  app.quit();
}

async function createMainWindow(studioUrl) {
  const studioOrigin = new URL(studioUrl).origin;
  const window = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: "#101111",
    title: APP_NAME,
    icon: join(app.getAppPath(), "build", "desktop", "icon.png"),
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
    },
  });
  mainWindow = window;
  configureWindowNavigation(window, studioOrigin);
  window.on("page-title-updated", (event) => {
    event.preventDefault();
    window.setTitle(APP_NAME);
  });
  window.once("ready-to-show", () => window.show());
  window.on("closed", () => {
    if (mainWindow === window) {
      mainWindow = null;
    }
  });

  try {
    await window.loadURL(studioUrl);
  } catch (error) {
    window.destroy();
    throw new Error(`桌面工作台加载失败：${error instanceof Error ? error.message : String(error)}`);
  }

  if (isDesktopSmoke) {
    await runDesktopSmoke(window, studioUrl);
  }
}

async function startDesktopApplication() {
  process.env.HOST = "127.0.0.1";
  process.env.PORT = "0";
  process.env.IMAGE_STUDIO_LOCAL_DATA_DIR = app.getPath("userData");
  // Never inherit the test-only mock image generator into the desktop app.
  delete process.env.IMAGE_STUDIO_MOCK_IMAGE_GENERATION;
  studioRuntime = await import("../server.mjs");
  await createMainWindow(studioRuntime.studioServerUrl);
}

function shutdownDesktopApplication() {
  if (shutdownPromise) {
    return shutdownPromise;
  }

  shutdownPromise = (async () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.destroy();
    }
    mainWindow = null;
    await studioRuntime?.closeStudioServer?.();
    allowQuit = true;
    app.quit();
  })().catch((error) => {
    console.error(`桌面应用关闭失败：${error instanceof Error ? error.message : String(error)}`);
    allowQuit = true;
    app.exit(1);
  });
  return shutdownPromise;
}

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  app.quit();
} else {
  app.on("second-instance", () => {
    focusMainWindow();
  });
  app.on("window-all-closed", () => {
    app.quit();
  });
  app.on("before-quit", (event) => {
    if (allowQuit || !studioRuntime) {
      return;
    }
    event.preventDefault();
    void shutdownDesktopApplication();
  });
  app.whenReady().then(startDesktopApplication).catch((error) => {
    dialog.showErrorBox(
      `${APP_NAME} 启动失败`,
      error instanceof Error ? error.message : String(error),
    );
    app.quit();
  });
}
