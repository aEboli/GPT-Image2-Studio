import {
  PRODUCT_IMAGE_IMPORT_MAGIC,
  parseProductImageImportText,
  selectProductImageImportItemIds,
} from "./product-image-import.mjs";

const CATEGORY_LABELS = Object.freeze({ main: "主图", detail: "详情图", sku: "SKU 图" });
const MIME_EXTENSIONS = Object.freeze({
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
});

function toErrorMessage(error, fallback) {
  const message = error instanceof Error ? error.message : String(error || "");
  return message.trim() || fallback;
}

function makeNativeClipboardFilename(type, index) {
  return `clipboard-image-${String(index + 1).padStart(2, "0")}.${MIME_EXTENSIONS[type] || "png"}`;
}

export async function readNativeClipboardImageFiles({ clipboard, FileCtor = File } = {}) {
  if (!clipboard || typeof clipboard.read !== "function") {
    throw new Error("当前浏览器不支持读取剪贴板图片，请改用上传文件。");
  }
  const clipboardItems = await clipboard.read();
  const files = [];
  for (const clipboardItem of clipboardItems || []) {
    for (const type of (clipboardItem.types || []).filter((value) => String(value).startsWith("image/"))) {
      const blob = await clipboardItem.getType(type);
      files.push(new FileCtor([blob], makeNativeClipboardFilename(type, files.length), {
        type,
        lastModified: Date.now(),
      }));
    }
  }
  return files;
}

export async function readProductImageImportClipboard({ clipboard, FileCtor = File } = {}) {
  let text = "";
  let textError = null;
  if (clipboard && typeof clipboard.readText === "function") {
    try {
      text = await clipboard.readText();
    } catch (error) {
      textError = error;
    }
  }

  if (text.startsWith(PRODUCT_IMAGE_IMPORT_MAGIC)) {
    return { kind: "manifest", manifest: parseProductImageImportText(text) };
  }

  try {
    const files = await readNativeClipboardImageFiles({ clipboard, FileCtor });
    if (files.length > 0) return { kind: "files", files };
    if (textError) {
      throw new Error("浏览器未允许读取剪贴板，请允许权限后重试，或直接上传图片。");
    }
  } catch (error) {
    if (textError) {
      throw new Error("浏览器未允许读取剪贴板，请允许权限后重试，或直接上传图片。");
    }
    throw error;
  }

  throw new Error("剪贴板中没有可导入的图片或受支持的商品图清单。");
}

async function readResponseError(response) {
  const text = await response.text().catch(() => "");
  try {
    return JSON.parse(text)?.message || `HTTP ${response.status}`;
  } catch {
    return text.trim() || `HTTP ${response.status}`;
  }
}

export async function fetchProductImageImportFiles({
  manifest,
  selectedIds,
  fetchImpl = fetch,
  FileCtor = File,
} = {}) {
  const selected = new Set([...(selectedIds || [])]);
  const files = [];
  const failures = [];
  for (const item of manifest?.items || []) {
    if (!selected.has(item.id)) continue;
    try {
      const response = await fetchImpl("/api/product-image-collector/image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourcePageUrl: manifest.source.pageUrl, imageUrl: item.url }),
      });
      if (!response.ok) throw new Error(await readResponseError(response));
      const blob = await response.blob();
      if (!String(blob.type || "").startsWith("image/")) throw new Error("返回内容不是图片。");
      files.push(new FileCtor([blob], item.filename, { type: blob.type, lastModified: 0 }));
    } catch (error) {
      failures.push({ item, message: toErrorMessage(error, "商品图获取失败。") });
    }
  }
  return { files, failures };
}

function createElement(documentRef, tagName, className = "", text = "") {
  const element = documentRef.createElement(tagName);
  if (className) element.className = className;
  if (text) element.textContent = text;
  return element;
}

function getPackageFilename(response) {
  const disposition = response.headers.get("content-disposition") || "";
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ||
    "GPT-Image2-Studio-Product-Image-Collector-v1.0.3.zip";
}

export function createProductImageImportController({
  documentRef = document,
  clipboard = navigator.clipboard,
  fetchImpl = fetch,
  FileCtor = File,
  getRemainingCapacity,
  getMaximumCount,
  applyFiles,
  setFeedback = () => {},
  onError = () => {},
} = {}) {
  const refs = {
    availableCount: documentRef.querySelector("#productImageImportAvailableCount"),
    cancelButton: documentRef.querySelector("#productImageImportCancelButton"),
    capacityCount: documentRef.querySelector("#productImageImportCapacityCount"),
    closeButton: documentRef.querySelector("#productImageImportCloseButton"),
    confirmButton: documentRef.querySelector("#productImageImportConfirmButton"),
    dialog: documentRef.querySelector("#productImageImportDialog"),
    feedback: documentRef.querySelector("#productImageImportFeedback"),
    groups: documentRef.querySelector("#productImageImportGroups"),
    importButton: documentRef.querySelector("#creationClipboardImportButton"),
    packageButton: documentRef.querySelector("[data-product-image-extension-action]"),
    productTitle: documentRef.querySelector("#productImageImportProductTitle"),
    selectedCount: documentRef.querySelector("#productImageImportSelectedCount"),
    toast: documentRef.querySelector("#globalActionToast"),
  };
  const state = { busy: false, manifest: null, selectedIds: new Set(), toastTimer: 0 };

  function remainingCapacity() {
    return Math.max(0, Math.floor(Number(getRemainingCapacity?.()) || 0));
  }

  function setModalFeedback(message = "", kind = "") {
    if (!refs.feedback) return;
    refs.feedback.textContent = message;
    refs.feedback.dataset.state = kind;
  }

  function showToast(message, kind = "success") {
    if (!refs.toast) return;
    clearTimeout(state.toastTimer);
    refs.toast.textContent = message;
    refs.toast.dataset.state = kind;
    refs.toast.classList.add("is-visible");
    state.toastTimer = setTimeout(() => refs.toast.classList.remove("is-visible"), 4200);
  }

  function closeDialog() {
    if (refs.dialog?.open && !state.busy) refs.dialog.close();
  }

  function syncCounts() {
    const available = state.manifest?.items.length || 0;
    const selected = state.selectedIds.size;
    const capacity = remainingCapacity();
    if (refs.availableCount) refs.availableCount.textContent = String(available);
    if (refs.selectedCount) refs.selectedCount.textContent = String(selected);
    if (refs.capacityCount) refs.capacityCount.textContent = String(capacity);
    if (refs.confirmButton) {
      refs.confirmButton.disabled = state.busy || selected === 0 || selected > capacity;
      refs.confirmButton.textContent = state.busy ? "正在导入..." : `导入所选 (${selected})`;
    }
    if (refs.cancelButton) refs.cancelButton.disabled = state.busy;
    if (refs.closeButton) refs.closeButton.disabled = state.busy;
  }

  function toggleSelection(itemId, checked) {
    if (!checked) {
      state.selectedIds.delete(itemId);
      setModalFeedback("");
      render();
      return;
    }
    if (state.selectedIds.size >= remainingCapacity()) {
      setModalFeedback("已达到当前剩余槽位，请先取消一张再选择。", "error");
      render();
      return;
    }
    state.selectedIds.add(itemId);
    setModalFeedback("");
    render();
  }

  function render() {
    if (!refs.groups) return;
    refs.groups.replaceChildren();
    if (refs.productTitle) refs.productTitle.textContent = state.manifest?.product.title || "1688 商品图";
    for (const category of ["main", "detail", "sku"]) {
      const items = (state.manifest?.items || []).filter((item) => item.category === category);
      if (items.length === 0) continue;
      const section = createElement(documentRef, "section", "product-image-import-group");
      const head = createElement(documentRef, "div", "product-image-import-group-head");
      const skuVariantCount = category === "sku"
        ? items.reduce((total, item) => total + Math.max(Array.isArray(item.variantLabels) ? item.variantLabels.length : 0, Number.parseInt(item.variantCount, 10) || 0, 1), 0)
        : 0;
      head.append(
        createElement(documentRef, "h3", "", CATEGORY_LABELS[category]),
        createElement(documentRef, "span", "", `${items.length} 张${skuVariantCount ? ` · ${skuVariantCount} 个规格` : ""}`),
      );
      const grid = createElement(documentRef, "div", "product-image-import-grid");
      for (const item of items) {
        const label = createElement(documentRef, "label", `product-image-import-card${state.selectedIds.has(item.id) ? " is-selected" : ""}`);
        const checkbox = createElement(documentRef, "input");
        checkbox.type = "checkbox";
        checkbox.checked = state.selectedIds.has(item.id);
        checkbox.disabled = state.busy;
        checkbox.addEventListener("change", () => toggleSelection(item.id, checkbox.checked));
        const preview = createElement(documentRef, "span", "product-image-import-preview");
        preview.appendChild(createElement(documentRef, "strong", "", `${CATEGORY_LABELS[category]} ${item.order}`));
        const variantLabels = category === "sku" && Array.isArray(item.variantLabels) ? item.variantLabels : [];
        const variantCount = Math.max(variantLabels.length, Number.parseInt(item.variantCount, 10) || 0);
        const metaText = variantCount > 0
          ? (variantCount === 1 && variantLabels[0]
              ? variantLabels[0]
              : `${variantCount} 个规格${variantLabels.length ? `：${variantLabels.join(" / ")}` : ""}`)
          : (item.width && item.height ? `${item.width}×${item.height}` : `第 ${item.order} 张`);
        const meta = createElement(documentRef, "small", "", metaText);
        if (variantLabels.length) meta.title = variantLabels.join(" / ");
        preview.appendChild(meta);
        label.append(checkbox, preview);
        grid.appendChild(label);
      }
      section.append(head, grid);
      refs.groups.appendChild(section);
    }
    syncCounts();
  }

  function openManifest(manifest) {
    const capacity = remainingCapacity();
    if (capacity <= 0) throw new Error(`套图参考图最多支持 ${getMaximumCount?.() || 15} 张。`);
    state.manifest = manifest;
    state.selectedIds = new Set(selectProductImageImportItemIds(manifest.items, capacity));
    setModalFeedback(manifest.items.length > capacity ? "候选图超过剩余槽位，已按主图、SKU 图、详情图顺序预选。" : "");
    render();
    refs.dialog?.showModal();
  }

  async function importFromClipboard() {
    if (remainingCapacity() <= 0) {
      const message = `套图参考图最多支持 ${getMaximumCount?.() || 15} 张。`;
      setFeedback(message, "error");
      onError(message);
      return;
    }
    refs.importButton.disabled = true;
    try {
      const result = await readProductImageImportClipboard({ clipboard, FileCtor });
      if (result.kind === "manifest") {
        openManifest(result.manifest);
        return;
      }
      const outcome = applyFiles(result.files) || {};
      const imported = Number(outcome.importedCount ?? result.files.length);
      const duplicates = Number(outcome.duplicateCount || 0);
      const overflow = Number(outcome.overflowCount || 0);
      setFeedback(`剪贴板导入完成：导入 ${imported} 张，重复 ${duplicates} 张，未导入 ${overflow} 张。`, "success");
    } catch (error) {
      const message = toErrorMessage(error, "剪贴板导入失败。");
      setFeedback(message, "error");
      onError(message);
    } finally {
      refs.importButton.disabled = false;
    }
  }

  async function confirmImport() {
    const capacity = remainingCapacity();
    if (state.selectedIds.size === 0) return setModalFeedback("请至少选择一张商品图。", "error");
    if (state.selectedIds.size > capacity) return setModalFeedback("所选图片超过当前剩余槽位。", "error");
    state.busy = true;
    setModalFeedback("正在逐张获取所选商品图...");
    render();
    try {
      const selectedCount = state.selectedIds.size;
      const result = await fetchProductImageImportFiles({
        manifest: state.manifest,
        selectedIds: state.selectedIds,
        fetchImpl,
        FileCtor,
      });
      const outcome = applyFiles(result.files) || {};
      const imported = Number(outcome.importedCount ?? result.files.length);
      const duplicates = Number(outcome.duplicateCount || 0);
      const overflow = Number(outcome.overflowCount || 0);
      const failed = result.failures.length;
      const unselected = Math.max(0, state.manifest.items.length - selectedCount) + overflow;
      const message = `商品图导入完成：导入 ${imported} 张，重复 ${duplicates} 张，失败 ${failed} 张，未选择 ${unselected} 张。`;
      state.busy = false;
      refs.dialog?.close();
      setFeedback(message, failed > 0 ? "warning" : "success");
    } catch (error) {
      const message = toErrorMessage(error, "商品图导入失败。");
      state.busy = false;
      setModalFeedback(message, "error");
      setFeedback(message, "error");
      onError(message);
      render();
    }
  }

  async function downloadExtensionPackage() {
    refs.packageButton.disabled = true;
    try {
      const response = await fetchImpl("/api/product-image-collector/package");
      if (!response.ok) throw new Error(await readResponseError(response));
      const blobUrl = URL.createObjectURL(await response.blob());
      const anchor = createElement(documentRef, "a");
      anchor.href = blobUrl;
      anchor.download = getPackageFilename(response);
      documentRef.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
      showToast("商品图采集插件 ZIP 已下载。", "success");
    } catch (error) {
      const message = toErrorMessage(error, "插件包下载失败。");
      showToast(message, "error");
      onError(message);
    } finally {
      refs.packageButton.disabled = false;
    }
  }

  function bind() {
    refs.importButton?.addEventListener("click", importFromClipboard);
    refs.confirmButton?.addEventListener("click", confirmImport);
    refs.cancelButton?.addEventListener("click", closeDialog);
    refs.closeButton?.addEventListener("click", closeDialog);
    refs.packageButton?.addEventListener("click", downloadExtensionPackage);
    refs.dialog?.addEventListener("cancel", (event) => { if (state.busy) event.preventDefault(); });
  }

  return { bind, confirmImport, downloadExtensionPackage, importFromClipboard, openManifest, render };
}
