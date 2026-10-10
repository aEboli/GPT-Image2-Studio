const { contextBridge, ipcRenderer } = require("electron");

if (process.isMainFrame) {
  contextBridge.exposeInMainWorld("studioDesktopConfig", {
    readConfig: () => ipcRenderer.invoke("studio:config:read"),
    saveConfig: (config) => ipcRenderer.invoke("studio:config:save", config),
  });
}
