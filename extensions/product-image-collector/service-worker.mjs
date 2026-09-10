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
const EXTENSION_VERSION = "1.1.33";
const NATIVE_CLIPBOARD_HOST = "com.aeboli.gpt_image2_studio.product_image_clipboard";

function isSupportedProductTab(value) {
  return Boolean(getProductImagePlatformForSourceUrl(value));
}

async function collectFromTab(tab, pageUrl) {
  const expectedPageUrl = pageUrl || tab?.url || "";
  if (!tab?.id || !isSupportedProductTab(expectedPageUrl)) {
    throw new Error("请在受支持平台的商品详情页中使用商品图采集。");
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["collector.js"],
  });
  const results = await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    func: collectInjectedPage,
    args: [String(expectedPageUrl)],
  });
  const result = results?.[0]?.result;
  if (!result?.ok) {
    throw new Error(result?.message || "当前页面没有找到商品图。");
  }
  return { ...result, manifest: normalizeProductImageImportManifest(result.manifest) };
}

function collectInjectedPage(expectedPageUrl) {
  if (expectedPageUrl && location.href !== expectedPageUrl) {
    return { ok: false, message: "商品页已切换，请在当前页面重新采集。" };
  }
  const controller = globalThis["__gptImage2StudioProductImageCollectorController"];
  if (controller?.version !== EXTENSION_VERSION || typeof controller?.collect !== "function") {
    return { ok: false, message: "商品页采集器尚未就绪，请刷新页面后重试。" };
  }
  return controller.collect();
}

function openInjectedPanel(expectedPageUrl) {
  if (expectedPageUrl && location.href !== expectedPageUrl) {
    return { ok: false, message: "商品页已切换，请在当前页面重新打开采集窗。" };
  }
  const controller = globalThis.__gptImage2StudioProductImagePanelController;
  if (controller?.version !== EXTENSION_VERSION || typeof controller?.open !== "function") {
    return { ok: false, message: "商品图采集窗尚未就绪，请刷新页面后重试。" };
  }
  try {
    controller.open();
    return { ok: true };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : String(error || "商品图采集窗打开失败。") };
  }
}

async function injectPanel(tabId, files, pageUrl = "") {
  await chrome.scripting.executeScript({ target: { tabId }, files });
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    func: openInjectedPanel,
    args: [String(pageUrl || "")],
  });
  const result = results?.[0]?.result;
  if (!result?.ok) throw new Error(result?.message || "商品图采集窗尚未就绪，请刷新页面后重试。");
  return result;
}

async function openPanel(tab, pageUrl) {
  if (!tab?.id || !isSupportedProductTab(pageUrl || tab.url)) {
    throw new Error("请在受支持平台的商品详情页中使用商品图采集。");
  }
  await injectPanel(tab.id, ["collector.js", "floating-launcher.js", "floating-panel.js"], pageUrl || tab.url);
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
    await injectPanel(
      tab.id,
      isSupportedProductTab(tab.url)
        ? ["collector.js", "floating-launcher.js", "floating-panel.js"]
        : ["floating-panel.js"],
      tab.url,
    );
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
