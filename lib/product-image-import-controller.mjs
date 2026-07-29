import {
  PRODUCT_IMAGE_IMPORT_MAGIC,
  parseProductImageImportText,
  selectProductImageImportItemIds,
} from "./product-image-import.mjs";

const CATEGORY_LABELS = Object.freeze({ main: "主图", detail: "详情图", sku: "SKU 图" });
const VIEWER_MIN_SCALE = 0.5;
const VIEWER_MAX_SCALE = 4;
const VIEWER_SCALE_FACTOR = 1.15;
const VIEWER_DRAG_THRESHOLD = 3;
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

export function readProductImageImportPaste(clipboardData) {
  const text = typeof clipboardData?.getData === "function" ? clipboardData.getData("text/plain") : "";
  if (!String(text || "").startsWith(PRODUCT_IMAGE_IMPORT_MAGIC)) return null;
  return parseProductImageImportText(text);
}

export function buildProductImagePreviewUrl(manifest, item) {
  const search = new URLSearchParams();
  search.set("sourcePageUrl", String(manifest?.source?.pageUrl || ""));
  search.set("imageUrl", String(item?.url || ""));
  return `/api/product-image-collector/image?${search.toString()}`;
}

export function selectProductImageImportIdsForAction(items, selectedIds, action, capacity) {
  const candidates = Array.isArray(items) ? items : [];
  const current = new Set([...(selectedIds || [])]);
  let eligible = [];
  if (action === "all") {
    eligible = candidates;
  } else if (action === "invert") {
    eligible = candidates.filter((item) => !current.has(item.id));
  } else if (["main", "detail", "sku"].includes(action)) {
    eligible = candidates.filter((item) => item.category === action);
  }
  return selectProductImageImportItemIds(eligible, capacity);
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

function createProductImageImportZoomIcon(documentRef) {
  const namespace = "http://www.w3.org/2000/svg";
  const svg = documentRef.createElementNS(namespace, "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  const circle = documentRef.createElementNS(namespace, "circle");
  circle.setAttribute("cx", "11");
  circle.setAttribute("cy", "11");
  circle.setAttribute("r", "7");
  const path = documentRef.createElementNS(namespace, "path");
  path.setAttribute("d", "M21 21l-5-5M11 8v6M8 11h6");
  svg.append(circle, path);
  return svg;
}

const VIEWER_ICON_SHAPES = Object.freeze({
  close: [{ tag: "path", attrs: { d: "M18 6 6 18" } }, { tag: "path", attrs: { d: "m6 6 12 12" } }],
  previous: [{ tag: "path", attrs: { d: "m15 18-6-6 6-6" } }],
  next: [{ tag: "path", attrs: { d: "m9 18 6-6-6-6" } }],
  fit: [
    { tag: "path", attrs: { d: "M8 3H5a2 2 0 0 0-2 2v3" } },
    { tag: "path", attrs: { d: "M16 3h3a2 2 0 0 1 2 2v3" } },
    { tag: "path", attrs: { d: "M8 21H5a2 2 0 0 1-2-2v-3" } },
    { tag: "path", attrs: { d: "M16 21h3a2 2 0 0 0 2-2v-3" } },
  ],
  reset: [
    { tag: "path", attrs: { d: "M8 3v3a2 2 0 0 1-2 2H3" } },
    { tag: "path", attrs: { d: "M21 8h-3a2 2 0 0 1-2-2V3" } },
    { tag: "path", attrs: { d: "M3 16h3a2 2 0 0 1 2 2v3" } },
    { tag: "path", attrs: { d: "M16 21v-3a2 2 0 0 1 2-2h3" } },
  ],
  rotateLeft: [{ tag: "path", attrs: { d: "M3 12a9 9 0 1 0 3-6.7L3 8" } }, { tag: "path", attrs: { d: "M3 3v5h5" } }],
  rotateRight: [{ tag: "path", attrs: { d: "M21 12a9 9 0 1 1-3-6.7L21 8" } }, { tag: "path", attrs: { d: "M21 3v5h-5" } }],
  zoomIn: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "8" } },
    { tag: "path", attrs: { d: "m21 21-4.3-4.3" } },
    { tag: "path", attrs: { d: "M11 8v6" } },
    { tag: "path", attrs: { d: "M8 11h6" } },
  ],
  zoomOut: [
    { tag: "circle", attrs: { cx: "11", cy: "11", r: "8" } },
    { tag: "path", attrs: { d: "m21 21-4.3-4.3" } },
    { tag: "path", attrs: { d: "M8 11h6" } },
  ],
});

function createProductImageViewerIcon(documentRef, name) {
  const svg = documentRef.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("viewBox", "0 0 24 24");
  svg.setAttribute("aria-hidden", "true");
  svg.setAttribute("focusable", "false");
  svg.setAttribute("class", "product-image-import-viewer-icon");
  for (const shape of VIEWER_ICON_SHAPES[name] || []) {
    const element = documentRef.createElementNS("http://www.w3.org/2000/svg", shape.tag);
    for (const [attribute, value] of Object.entries(shape.attrs)) element.setAttribute(attribute, value);
    svg.appendChild(element);
  }
  return svg;
}

function getPackageFilename(response) {
  const disposition = response.headers.get("content-disposition") || "";
  return disposition.match(/filename="?([^";]+)"?/i)?.[1] ||
    "GPT-Image2-Studio-Product-Image-Collector-v1.1.23.zip";
}

export function createProductImageImportController({
  documentRef = document,
  clipboard = navigator.clipboard,
  fetchImpl = fetch,
  FileCtor = File,
  getRemainingCapacity,
  getMaximumCount,
  applyFiles,
  canHandlePaste = () => true,
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
    imageViewer: documentRef.querySelector("#productImageImportImageViewer"),
    importButton: documentRef.querySelector("#creationClipboardImportButton"),
    invertButton: documentRef.querySelector("#productImageImportInvertButton"),
    packageButton: documentRef.querySelector("[data-product-image-extension-action]"),
    productTitle: documentRef.querySelector("#productImageImportProductTitle"),
    selectAllButton: documentRef.querySelector("#productImageImportSelectAllButton"),
    selectDetailButton: documentRef.querySelector("#productImageImportSelectDetailButton"),
    selectMainButton: documentRef.querySelector("#productImageImportSelectMainButton"),
    selectSkuButton: documentRef.querySelector("#productImageImportSelectSkuButton"),
    selectedCount: documentRef.querySelector("#productImageImportSelectedCount"),
    toast: documentRef.querySelector("#globalActionToast"),
    viewer: documentRef.querySelector("#productImageImportImageViewer"),
    viewerCloseButton: documentRef.querySelector("#productImageImportViewerCloseButton"),
    viewerFitButton: documentRef.querySelector("#productImageImportViewerFitButton"),
    viewerImage: documentRef.querySelector("#productImageImportViewerImage"),
    viewerNextButton: documentRef.querySelector("#productImageImportViewerNextButton"),
    viewerOriginalSizeButton: documentRef.querySelector("#productImageImportViewerOriginalSizeButton"),
    viewerPreviousButton: documentRef.querySelector("#productImageImportViewerPreviousButton"),
    viewerRotateLeftButton: documentRef.querySelector("#productImageImportViewerRotateLeftButton"),
    viewerRotateRightButton: documentRef.querySelector("#productImageImportViewerRotateRightButton"),
    viewerStage: documentRef.querySelector("#productImageImportViewerStage"),
    viewerTitle: documentRef.querySelector("#productImageImportViewerTitle"),
    viewerZoomInButton: documentRef.querySelector("#productImageImportViewerZoomInButton"),
    viewerZoomLabel: documentRef.querySelector("#productImageImportViewerZoomLabel"),
    viewerZoomOutButton: documentRef.querySelector("#productImageImportViewerZoomOutButton"),
  };
  const viewerWindow = documentRef?.defaultView || (typeof window !== "undefined" ? window : null);
  const state = {
    busy: false,
    itemControls: new Map(),
    manifest: null,
    previewTrigger: null,
    selectedIds: new Set(),
    toastTimer: 0,
    viewerDrag: null,
    viewerIndex: -1,
    viewerItem: null,
    viewerOffsetX: 0,
    viewerOffsetY: 0,
    viewerRotation: 0,
    viewerScale: 1,
  };

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
    if (refs.dialog?.open && !state.busy) {
      closeImagePreview({ restoreFocus: false });
      refs.dialog.close();
    }
  }

  function closeImagePreview({ restoreFocus = true } = {}) {
    if (!refs.imageViewer || refs.imageViewer.hidden) return;
    endViewerDrag();
    refs.imageViewer.hidden = true;
    refs.imageViewer.setAttribute("aria-hidden", "true");
    refs.viewerImage?.removeAttribute("src");
    if (refs.viewerImage) refs.viewerImage.alt = "";
    state.viewerIndex = -1;
    state.viewerItem = null;
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerRotation = 0;
    state.viewerScale = 1;
    const trigger = state.previewTrigger;
    state.previewTrigger = null;
    if (restoreFocus) trigger?.focus?.();
  }

  function openImagePreview(item, trigger) {
    if (!refs.imageViewer || !refs.viewerImage || !state.manifest) return;
    const items = state.manifest.items || [];
    const index = items.findIndex((candidate) => candidate.id === item.id);
    const label = `${CATEGORY_LABELS[item.category] || "商品图"} ${item.order}`;
    if (refs.viewerTitle) refs.viewerTitle.textContent = label;
    refs.imageViewer.hidden = false;
    refs.imageViewer.setAttribute("aria-hidden", "false");
    state.previewTrigger = trigger || null;
    showViewerItemAt(index >= 0 ? index : 0);
    refs.viewerCloseButton?.focus?.();
  }

  function viewerImageDimensions() {
    const itemWidth = Number(state.viewerItem?.width) || 0;
    const itemHeight = Number(state.viewerItem?.height) || 0;
    const width = Number(refs.viewerImage?.naturalWidth) || itemWidth || Number(refs.viewerImage?.clientWidth) || 0;
    const height = Number(refs.viewerImage?.naturalHeight) || itemHeight || Number(refs.viewerImage?.clientHeight) || 0;
    const rotatedQuarterTurn = Math.abs(state.viewerRotation / 90) % 2 === 1;
    return {
      width: rotatedQuarterTurn ? height : width,
      height: rotatedQuarterTurn ? width : height,
    };
  }

  function viewerStageMetrics() {
    const style = viewerWindow?.getComputedStyle?.(refs.viewerStage) || refs.viewerStage?.style || {};
    const rect = refs.viewerStage?.getBoundingClientRect?.() || {};
    const clientWidth = Number(refs.viewerStage?.clientWidth) || Number(rect.width) || 0;
    const clientHeight = Number(refs.viewerStage?.clientHeight) || Number(rect.height) || 0;
    const width = Math.max(1, clientWidth - (Number.parseFloat(style.paddingLeft) || 0) - (Number.parseFloat(style.paddingRight) || 0));
    const height = Math.max(1, clientHeight - (Number.parseFloat(style.paddingTop) || 0) - (Number.parseFloat(style.paddingBottom) || 0));
    const image = viewerImageDimensions();
    return { width, height, imageWidth: image.width, imageHeight: image.height };
  }

  function viewerFitScale() {
    const metrics = viewerStageMetrics();
    if (!metrics.imageWidth || !metrics.imageHeight) return 1;
    return Math.min(1, metrics.width / metrics.imageWidth, metrics.height / metrics.imageHeight);
  }

  function viewerMinimumScale() {
    return Math.min(VIEWER_MIN_SCALE, viewerFitScale());
  }

  function clampViewerScale(value) {
    return Math.min(VIEWER_MAX_SCALE, Math.max(viewerMinimumScale(), Number(value) || 1));
  }

  function viewerFullscreenScale() {
    const metrics = viewerStageMetrics();
    if (!metrics.imageWidth || !metrics.imageHeight) return 1;
    return Math.min(VIEWER_MAX_SCALE, Math.max(metrics.width / metrics.imageWidth, metrics.height / metrics.imageHeight));
  }

  function viewerOffsetBounds() {
    const metrics = viewerStageMetrics();
    if (!metrics.imageWidth || !metrics.imageHeight) return { x: 0, y: 0 };
    return {
      x: Math.abs(metrics.imageWidth * state.viewerScale - metrics.width) / 2,
      y: Math.abs(metrics.imageHeight * state.viewerScale - metrics.height) / 2,
    };
  }

  function syncViewerScale() {
    if (!refs.viewerImage) return;
    state.viewerScale = clampViewerScale(state.viewerScale);
    const bounds = viewerOffsetBounds();
    state.viewerOffsetX = Math.min(bounds.x, Math.max(-bounds.x, state.viewerOffsetX));
    state.viewerOffsetY = Math.min(bounds.y, Math.max(-bounds.y, state.viewerOffsetY));
    if (refs.viewerImage.style) {
      refs.viewerImage.style.transform = `translate3d(${Math.round(state.viewerOffsetX)}px, ${Math.round(state.viewerOffsetY)}px, 0) rotate(${state.viewerRotation}deg) scale(${state.viewerScale})`;
    }
    if (refs.viewerZoomLabel) refs.viewerZoomLabel.textContent = `${Math.round(state.viewerScale * 100)}%`;
    if (refs.viewerZoomOutButton) refs.viewerZoomOutButton.disabled = state.viewerScale <= viewerMinimumScale() + 0.001;
    if (refs.viewerZoomInButton) refs.viewerZoomInButton.disabled = state.viewerScale >= VIEWER_MAX_SCALE;
  }

  function setViewerScale(value) {
    state.viewerScale = clampViewerScale(value);
    syncViewerScale();
  }

  function runViewerCommand(event, command) {
    command();
    if (Number(event?.detail) > 0) event.currentTarget?.blur?.();
  }

  function fitViewerWithinPanel() {
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerScale = viewerFitScale();
    syncViewerScale();
  }

  function fitViewerToPanel() {
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerScale = viewerFullscreenScale();
    syncViewerScale();
  }

  function resetViewerView() {
    endViewerDrag();
    state.viewerRotation = 0;
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerScale = viewerFitScale();
    syncViewerScale();
  }

  function rotateViewer(degrees) {
    state.viewerRotation = ((state.viewerRotation + degrees) % 360 + 360) % 360;
    state.viewerScale = 1;
    fitViewerWithinPanel();
  }

  function showViewerItemAt(index) {
    const items = state.manifest?.items || [];
    if (items.length === 0) return closeImagePreview({ restoreFocus: false });
    const safeIndex = Math.min(items.length - 1, Math.max(0, Number(index) || 0));
    const item = items[safeIndex];
    state.viewerIndex = safeIndex;
    state.viewerItem = item;
    state.viewerScale = 1;
    state.viewerOffsetX = 0;
    state.viewerOffsetY = 0;
    state.viewerRotation = 0;
    if (refs.viewerTitle) refs.viewerTitle.textContent = `${CATEGORY_LABELS[item.category] || "商品图"} ${item.order}`;
    refs.viewerImage.src = buildProductImagePreviewUrl(state.manifest, item);
    refs.viewerImage.alt = `放大查看${CATEGORY_LABELS[item.category] || "商品图"} ${item.order}`;
    if (refs.viewerPreviousButton) refs.viewerPreviousButton.disabled = safeIndex === 0;
    if (refs.viewerNextButton) refs.viewerNextButton.disabled = safeIndex === items.length - 1;
    syncViewerScale();
  }

  function handleViewerWheel(event) {
    if (!refs.imageViewer || refs.imageViewer.hidden) return;
    event.preventDefault?.();
    const factor = Number(event.deltaY) < 0 ? VIEWER_SCALE_FACTOR : 1 / VIEWER_SCALE_FACTOR;
    setViewerScale(state.viewerScale * factor);
  }

  function clampViewerOffset(x, y) {
    const bounds = viewerOffsetBounds();
    return {
      x: Math.min(bounds.x, Math.max(-bounds.x, Number(x) || 0)),
      y: Math.min(bounds.y, Math.max(-bounds.y, Number(y) || 0)),
    };
  }

  function beginViewerDrag(event) {
    if (!refs.imageViewer || refs.imageViewer.hidden || state.viewerDrag || event.button !== 0) return;
    event.preventDefault?.();
    event.stopPropagation?.();
    state.viewerDrag = {
      pointerId: event.pointerId,
      startX: Number(event.clientX) || 0,
      startY: Number(event.clientY) || 0,
      originX: state.viewerOffsetX,
      originY: state.viewerOffsetY,
      moved: false,
    };
    refs.viewerImage.classList?.add("is-dragging");
    viewerWindow?.addEventListener?.("pointermove", moveViewerDrag);
    viewerWindow?.addEventListener?.("pointerup", endViewerDrag);
    viewerWindow?.addEventListener?.("pointercancel", endViewerDrag);
    try {
      refs.viewerImage.setPointerCapture?.(event.pointerId);
    } catch {}
  }

  function moveViewerDrag(event) {
    const drag = state.viewerDrag;
    if (!drag || (event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    event.preventDefault?.();
    const deltaX = (Number(event.clientX) || 0) - drag.startX;
    const deltaY = (Number(event.clientY) || 0) - drag.startY;
    if (Math.hypot(deltaX, deltaY) >= VIEWER_DRAG_THRESHOLD) drag.moved = true;
    const next = clampViewerOffset(drag.originX + deltaX, drag.originY + deltaY);
    state.viewerOffsetX = next.x;
    state.viewerOffsetY = next.y;
    syncViewerScale();
  }

  function endViewerDrag(event) {
    const drag = state.viewerDrag;
    if (!drag || (event && event.pointerId !== undefined && event.pointerId !== drag.pointerId)) return;
    state.viewerDrag = null;
    refs.viewerImage?.classList?.remove("is-dragging");
    viewerWindow?.removeEventListener?.("pointermove", moveViewerDrag);
    viewerWindow?.removeEventListener?.("pointerup", endViewerDrag);
    viewerWindow?.removeEventListener?.("pointercancel", endViewerDrag);
    if (refs.viewerImage?.hasPointerCapture?.(drag.pointerId)) {
      try {
        refs.viewerImage.releasePointerCapture(drag.pointerId);
      } catch {}
    }
  }

  function handleViewerBackdropClick(event) {
    if (!refs.imageViewer || refs.imageViewer.hidden) return;
    const target = event.target;
    if (target === refs.viewerImage || target?.closest?.("button, .product-image-import-viewer-toolbar")) return;
    closeImagePreview();
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
    const items = state.manifest?.items || [];
    const selectionDisabled = state.busy || items.length === 0 || capacity <= 0;
    if (refs.selectAllButton) refs.selectAllButton.disabled = selectionDisabled;
    if (refs.invertButton) refs.invertButton.disabled = selectionDisabled;
    if (refs.selectMainButton) refs.selectMainButton.disabled = selectionDisabled || !items.some((item) => item.category === "main");
    if (refs.selectDetailButton) refs.selectDetailButton.disabled = selectionDisabled || !items.some((item) => item.category === "detail");
    if (refs.selectSkuButton) refs.selectSkuButton.disabled = selectionDisabled || !items.some((item) => item.category === "sku");
  }

  function syncSelectionUi() {
    for (const [itemId, controls] of state.itemControls) {
      const selected = state.selectedIds.has(itemId);
      controls.card.classList.toggle("is-selected", selected);
      controls.checkbox.checked = selected;
      controls.checkbox.disabled = state.busy;
      controls.zoomButton.disabled = state.busy;
    }
    syncCounts();
  }

  function applyBatchSelection(action) {
    if (state.busy || !state.manifest) return;
    const items = state.manifest.items || [];
    const currentSelection = state.selectedIds;
    const eligibleCount = action === "invert"
      ? items.filter((item) => !currentSelection.has(item.id)).length
      : action === "all"
        ? items.length
        : items.filter((item) => item.category === action).length;
    const capacity = remainingCapacity();
    state.selectedIds = new Set(selectProductImageImportIdsForAction(items, currentSelection, action, capacity));
    setModalFeedback(eligibleCount > capacity ? `当前剩余槽位最多可选择 ${capacity} 张。` : "");
    syncSelectionUi();
  }

  function toggleSelection(itemId, checked) {
    if (!checked) {
      state.selectedIds.delete(itemId);
      setModalFeedback("");
      syncSelectionUi();
      return;
    }
    if (state.selectedIds.size >= remainingCapacity()) {
      setModalFeedback("已达到当前剩余槽位，请先取消一张再选择。", "error");
      syncSelectionUi();
      return;
    }
    state.selectedIds.add(itemId);
    setModalFeedback("");
    syncSelectionUi();
  }

  function render() {
    if (!refs.groups) return;
    state.itemControls = new Map();
    refs.groups.replaceChildren();
    if (refs.productTitle) refs.productTitle.textContent = state.manifest?.product.title || "商品图";
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
        const card = createElement(documentRef, "div", `product-image-import-card${state.selectedIds.has(item.id) ? " is-selected" : ""}`);
        const media = createElement(documentRef, "label", "product-image-import-media");
        const checkbox = createElement(documentRef, "input");
        checkbox.type = "checkbox";
        checkbox.checked = state.selectedIds.has(item.id);
        checkbox.disabled = state.busy;
        checkbox.addEventListener("change", () => toggleSelection(item.id, checkbox.checked));
        const preview = createElement(documentRef, "span", "product-image-import-preview");
        const image = createElement(documentRef, "img", "product-image-import-thumbnail");
        image.alt = `${CATEGORY_LABELS[category]} ${item.order}`;
        image.loading = "lazy";
        image.decoding = "async";
        image.src = buildProductImagePreviewUrl(state.manifest, item);
        const previewError = createElement(documentRef, "span", "product-image-import-preview-error", "图片加载失败");
        previewError.hidden = true;
        image.addEventListener("error", () => {
          preview.classList.add("is-error");
          previewError.hidden = false;
        });
        const info = createElement(documentRef, "div", "product-image-import-card-info");
        info.appendChild(createElement(documentRef, "strong", "", `${CATEGORY_LABELS[category]} ${item.order}`));
        const variantLabels = category === "sku" && Array.isArray(item.variantLabels) ? item.variantLabels : [];
        const variantCount = Math.max(variantLabels.length, Number.parseInt(item.variantCount, 10) || 0);
        const metaText = variantCount > 0
              ? (variantCount === 1 && variantLabels[0]
              ? variantLabels[0]
              : `${variantCount} 个规格${variantLabels.length ? `：${variantLabels.join(" / ")}` : ""}`)
          : (item.width && item.height ? `${item.width}×${item.height}` : `第 ${item.order} 张`);
        const meta = createElement(documentRef, "small", "", metaText);
        if (variantLabels.length) meta.title = variantLabels.join(" / ");
        info.appendChild(meta);
        preview.append(image, previewError);
        const actions = createElement(documentRef, "div", "product-image-import-card-actions");
        const zoomButton = createElement(documentRef, "button", "product-image-import-zoom-button");
        zoomButton.type = "button";
        zoomButton.disabled = state.busy;
        zoomButton.title = `放大查看${CATEGORY_LABELS[category]} ${item.order}`;
        zoomButton.setAttribute("aria-label", `放大查看${CATEGORY_LABELS[category]} ${item.order}`);
        zoomButton.appendChild(createProductImageImportZoomIcon(documentRef));
        zoomButton.addEventListener("click", () => openImagePreview(item, zoomButton));
        media.append(checkbox, preview);
        actions.append(info, zoomButton);
        card.append(media, actions);
        grid.appendChild(card);
        state.itemControls.set(item.id, { card, checkbox, zoomButton });
      }
      section.append(head, grid);
      refs.groups.appendChild(section);
    }
    syncSelectionUi();
  }

  function openManifest(manifest) {
    const capacity = remainingCapacity();
    if (capacity <= 0) throw new Error(`套图参考图最多支持 ${getMaximumCount?.() || 15} 张。`);
    closeImagePreview({ restoreFocus: false });
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

  function handlePaste(event) {
    if (event.defaultPrevented || state.busy || refs.dialog?.open || !canHandlePaste(event)) return;
    try {
      const manifest = readProductImageImportPaste(event.clipboardData);
      if (!manifest) return;
      event.preventDefault();
      openManifest(manifest);
    } catch (error) {
      event.preventDefault();
      const message = toErrorMessage(error, "商品图清单粘贴失败。");
      setFeedback(message, "error");
      onError(message);
    }
  }

  async function confirmImport() {
    const capacity = remainingCapacity();
    if (state.selectedIds.size === 0) return setModalFeedback("请至少选择一张商品图。", "error");
    if (state.selectedIds.size > capacity) return setModalFeedback("所选图片超过当前剩余槽位。", "error");
    state.busy = true;
    setModalFeedback("正在逐张获取所选商品图...");
    syncSelectionUi();
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
      closeImagePreview({ restoreFocus: false });
      refs.dialog?.close();
      setFeedback(message, failed > 0 ? "warning" : "success");
    } catch (error) {
      const message = toErrorMessage(error, "商品图导入失败。");
      state.busy = false;
      setModalFeedback(message, "error");
      setFeedback(message, "error");
      onError(message);
      syncSelectionUi();
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
    const viewerIcons = [
      [refs.viewerCloseButton, "close"],
      [refs.viewerFitButton, "fit"],
      [refs.viewerRotateLeftButton, "rotateLeft"],
      [refs.viewerRotateRightButton, "rotateRight"],
      [refs.viewerZoomInButton, "zoomIn"],
      [refs.viewerZoomOutButton, "zoomOut"],
      [refs.viewerOriginalSizeButton, "reset"],
      [refs.viewerPreviousButton, "previous"],
      [refs.viewerNextButton, "next"],
    ];
    for (const [button, icon] of viewerIcons) {
      if (button && !(button.children?.length > 0)) button.appendChild(createProductImageViewerIcon(documentRef, icon));
    }
    documentRef.addEventListener("paste", handlePaste);
    refs.importButton?.addEventListener("click", importFromClipboard);
    refs.selectAllButton?.addEventListener("click", () => applyBatchSelection("all"));
    refs.invertButton?.addEventListener("click", () => applyBatchSelection("invert"));
    refs.selectMainButton?.addEventListener("click", () => applyBatchSelection("main"));
    refs.selectDetailButton?.addEventListener("click", () => applyBatchSelection("detail"));
    refs.selectSkuButton?.addEventListener("click", () => applyBatchSelection("sku"));
    refs.confirmButton?.addEventListener("click", confirmImport);
    refs.cancelButton?.addEventListener("click", closeDialog);
    refs.closeButton?.addEventListener("click", closeDialog);
    refs.viewerCloseButton?.addEventListener("click", closeImagePreview);
    refs.viewerFitButton?.addEventListener("click", (event) => runViewerCommand(event, fitViewerToPanel));
    refs.viewerPreviousButton?.addEventListener("click", () => showViewerItemAt(state.viewerIndex - 1));
    refs.viewerNextButton?.addEventListener("click", () => showViewerItemAt(state.viewerIndex + 1));
    refs.viewerRotateLeftButton?.addEventListener("click", (event) => runViewerCommand(event, () => rotateViewer(-90)));
    refs.viewerRotateRightButton?.addEventListener("click", (event) => runViewerCommand(event, () => rotateViewer(90)));
    refs.viewerZoomInButton?.addEventListener("click", (event) => runViewerCommand(event, () => setViewerScale(state.viewerScale * VIEWER_SCALE_FACTOR)));
    refs.viewerZoomOutButton?.addEventListener("click", (event) => runViewerCommand(event, () => setViewerScale(state.viewerScale / VIEWER_SCALE_FACTOR)));
    refs.viewerOriginalSizeButton?.addEventListener("click", (event) => runViewerCommand(event, resetViewerView));
    refs.viewerStage?.addEventListener?.("wheel", handleViewerWheel, { passive: false });
    refs.imageViewer?.addEventListener?.("click", handleViewerBackdropClick);
    refs.viewerImage?.addEventListener?.("load", resetViewerView);
    refs.viewerImage?.addEventListener?.("dblclick", resetViewerView);
    refs.viewerImage?.addEventListener?.("pointerdown", beginViewerDrag);
    refs.packageButton?.addEventListener("click", downloadExtensionPackage);
    refs.dialog?.addEventListener("keydown", (event) => {
      if (event.key === "ArrowLeft" && refs.imageViewer && !refs.imageViewer.hidden) {
        showViewerItemAt(state.viewerIndex - 1);
        event.preventDefault();
        return;
      }
      if (event.key === "ArrowRight" && refs.imageViewer && !refs.imageViewer.hidden) {
        showViewerItemAt(state.viewerIndex + 1);
        event.preventDefault();
        return;
      }
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopPropagation();
      if (refs.imageViewer && !refs.imageViewer.hidden) {
        closeImagePreview();
      }
    });
    refs.dialog?.addEventListener("cancel", (event) => {
      event.preventDefault();
      if (refs.imageViewer && !refs.imageViewer.hidden) {
        closeImagePreview();
      }
    });
    refs.dialog?.addEventListener("close", () => closeImagePreview({ restoreFocus: false }));
  }

  return { bind, confirmImport, downloadExtensionPackage, importFromClipboard, openManifest, render };
}
