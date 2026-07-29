import {
  buildProductImageDownloadPlan,
  normalizeProductImageImportManifest,
  serializeProductImageImportManifest,
} from "./lib/product-image-import.mjs";
import { getProductImagePlatformForSourceUrl } from "./lib/product-image-platforms.mjs";

const MESSAGE_COLLECT = "product-image-collector:collect";
const MESSAGE_COPY = "product-image-collector:copy";
const MESSAGE_COPY_IMAGES = "product-image-collector:copy-images";
const MESSAGE_DOWNLOAD = "product-image-collector:download";
const MESSAGE_OPEN = "product-image-collector:open";
const NATIVE_CLIPBOARD_HOST = "com.aeboli.gpt_image2_studio.product_image_clipboard";

function isSupportedProductTab(value) {
  return Boolean(getProductImagePlatformForSourceUrl(value));
}

async function collectFromTab(tab, pageUrl) {
  if (!tab?.id || !isSupportedProductTab(pageUrl || tab.url)) {
    throw new Error("请在受支持平台的商品详情页中使用商品图采集。");
  }
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["collector.js"],
  });
  const result = results?.[0]?.result;
  if (!result?.ok) {
    throw new Error(result?.message || "当前页面没有找到商品图。");
  }
  return { ...result, manifest: normalizeProductImageImportManifest(result.manifest) };
}

async function openPanel(tab, pageUrl) {
  if (!tab?.id || !isSupportedProductTab(pageUrl || tab.url)) {
    throw new Error("请在受支持平台的商品详情页中使用商品图采集。");
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["floating-launcher.js", "floating-panel.js"],
  });
  return { ok: true };
}

function selectedItemIds(value) {
  return new Set(Array.isArray(value) ? value.map((id) => String(id || "")) : []);
}

function serializeSelection(message) {
  const manifest = normalizeProductImageImportManifest(message.manifest);
  const selected = selectedItemIds(message.selectedIds);
  const items = manifest.items.filter((item) => selected.has(item.id));
  if (items.length === 0) {
    throw new Error("请先选择要复制的商品图。");
  }
  return {
    ok: true,
    count: items.length,
    text: serializeProductImageImportManifest({ ...manifest, items }),
  };
}

function selectedManifest(message) {
  const manifest = normalizeProductImageImportManifest(message.manifest);
  const selected = selectedItemIds(message.selectedIds);
  const items = manifest.items.filter((item) => selected.has(item.id));
  if (items.length === 0) {
    throw new Error("请先选择要复制的商品图。");
  }
  return { ...manifest, items };
}

async function copyImagesSelection(message) {
  const manifest = selectedManifest(message);
  let result;
  try {
    result = await chrome.runtime.sendNativeMessage(NATIVE_CLIPBOARD_HOST, {
      type: "copy-images",
      manifest,
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : String(error || "");
    if (/native messaging host|specified native host|not found|not registered|forbidden/i.test(messageText)) {
      throw new Error("未安装商品图本地剪贴板助手。请运行插件 native-host 目录中的 install-native-host.cmd，随后重试。");
    }
    throw new Error(messageText || "本地剪贴板助手连接失败。");
  }
  if (!result?.ok) {
    throw new Error(result?.message || "本地剪贴板助手未能写入批量图片。");
  }
  return result;
}

async function downloadSelection(message) {
  const plan = buildProductImageDownloadPlan(message.manifest, selectedItemIds(message.selectedIds));
  if (plan.items.length === 0) {
    throw new Error("请先选择要下载的商品图。");
  }
  for (const item of plan.items) {
    await chrome.downloads.download({
      url: item.url,
      filename: item.path,
      conflictAction: "uniquify",
      saveAs: false,
    });
  }
  return { ok: true, count: plan.items.length, folder: plan.folder };
}

chrome.action.onClicked.addListener(async (tab) => {
  if (!tab?.id) return;
  try {
    if (isSupportedProductTab(tab.url)) {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["floating-launcher.js", "floating-panel.js"],
      });
    } else {
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ["floating-panel.js"],
      });
    }
  } catch (error) {
    console.warn("商品图采集悬浮窗注入失败。", error);
  }
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!sender.tab?.id || !message || typeof message !== "object") return false;
  let operation;
  if (message.type === MESSAGE_COLLECT) {
    operation = collectFromTab(sender.tab, message.pageUrl);
  } else if (message.type === MESSAGE_OPEN) {
    operation = openPanel(sender.tab, message.pageUrl);
  } else if (message.type === MESSAGE_COPY) {
    operation = Promise.resolve().then(() => serializeSelection(message));
  } else if (message.type === MESSAGE_COPY_IMAGES) {
    operation = copyImagesSelection(message);
  } else if (message.type === MESSAGE_DOWNLOAD) {
    operation = downloadSelection(message);
  } else {
    return false;
  }

  operation
    .then((result) => sendResponse(result))
    .catch((error) => sendResponse({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }));
  return true;
});
