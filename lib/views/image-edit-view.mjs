import { getImageUrl, fetchServerImageAsDataUrl } from "../browser-image-cache.mjs";
import { sortGalleryItemsByCreatedAtDesc } from "../gallery-organizer.mjs";
import { getDefaultGenerationSize, normalizeGenerationSize } from "../generation-size-options.mjs";
import {
  IMAGE_EDIT_LOCAL_MASK_MODE,
  buildLocalMaskMergedPrompt,
  normalizeLocalMaskExecutionStrategy,
} from "../image-edit-local-mask.mjs";
import { getOutputFormatOptions, normalizeOutputFormat } from "../output-format-options.mjs";
import { formatLoadingThumbnailStatusLabel, getPreviewPlaceholderState } from "../preview-placeholder-state.mjs";
import { shouldReusePreviewLoadingShell } from "../preview-loading-shell.mjs";
import { createViewRendererController } from "./view-renderer.mjs";

const DEFAULT_IMAGE_EDIT_RATIO = "1:1";
const DEFAULT_IMAGE_EDIT_RATIO_LABEL = "电商主图、头像、社交媒体 · 方形 1:1";

const LOCAL_MASK_COLORS = ["#f5506e", "#14b8a6", "#f59e0b", "#6366f1", "#22c55e", "#ec4899"];
const LOCAL_MASK_UNDO_LIMIT = 24;

function getImageEditRefs() {
  if (typeof document === "undefined") {
    return {};
  }

  return {
    baseUrlInput: document.querySelector("#baseUrlInput"),
    imageEditAddRegionButton: document.querySelector("#imageEditAddRegionButton"),
    imageEditBrushSizeInput: document.querySelector("#imageEditBrushSizeInput"),
    imageEditBrushToolButton: document.querySelector("#imageEditBrushToolButton"),
    imageEditDropzone: document.querySelector("#imageEditDropzone"),
    imageEditEraserToolButton: document.querySelector("#imageEditEraserToolButton"),
    imageEditExecutionStrategyInput: document.querySelector("#imageEditExecutionStrategyInput"),
    imageEditFeedback: document.querySelector("#imageEditFeedback"),
    imageEditGenerateButton: document.querySelector("#imageEditGenerateButton"),
    imageEditGenerationCanvas: document.querySelector("#imageEditGenerationCanvas"),
    imageEditGenerationDownloadButton: document.querySelector("#imageEditGenerationDownloadButton"),
    imageEditGenerationImage: document.querySelector("#imageEditGenerationImage"),
    imageEditGenerationLightboxButton: document.querySelector("#imageEditGenerationLightboxButton"),
    imageEditGenerationMeta: document.querySelector("#imageEditGenerationMeta"),
    imageEditGenerationPlaceholder: document.querySelector("#imageEditGenerationPlaceholder"),
    imageEditGenerationStrip: document.querySelector("#imageEditGenerationStrip"),
    imageEditLocalMaskPanel: document.querySelector("#imageEditLocalMaskPanel"),
    imageEditLocalMaskStage: document.querySelector("#imageEditLocalMaskStage"),
    imageEditLocalMaskStatus: document.querySelector("#imageEditLocalMaskStatus"),
    imageEditMaskOverlayCanvas: document.querySelector("#imageEditMaskOverlayCanvas"),
    imageEditPreviewStatus: document.querySelector("#imageEditPreviewStatus"),
    imageEditPromptInput: document.querySelector("#imageEditPromptInput"),
    imageEditOutputFormatInput: document.querySelector("#imageEditOutputFormatInput"),
    imageEditRatioGrid: document.querySelector("#imageEditRatioGrid"),
    imageEditRatioInput: document.querySelector("#imageEditRatioInput"),
    imageEditSizeInput: document.querySelector("#imageEditSizeInput"),
    imageEditSourceCount: document.querySelector("#imageEditSourceCount"),
    imageEditSourceCanvas: document.querySelector("#imageEditSourceCanvas"),
    imageEditSourceGrid: document.querySelector("#imageEditSourceGrid"),
    imageEditSourceInput: document.querySelector("#imageEditSourceInput"),
    imageEditThumbnailEmpty: document.querySelector("#imageEditThumbnailEmpty"),
    imageEditRedoMaskButton: document.querySelector("#imageEditRedoMaskButton"),
    imageEditRegionList: document.querySelector("#imageEditRegionList"),
    imageEditUndoMaskButton: document.querySelector("#imageEditUndoMaskButton"),
    outputFormatInput: document.querySelector("#outputFormatInput"),
    reasoningEffortInput: document.querySelector("#reasoningEffortInput"),
    referencePreviewImage: document.querySelector("#referencePreviewImage"),
    referencePreviewViewer: document.querySelector("#referencePreviewViewer"),
    responsesModelInput: document.querySelector("#responsesModelInput"),
  };
}

function hasImageEditContext({ refs, state } = {}) {
  return Boolean(refs?.imageEditSourceInput && refs?.imageEditPromptInput && state?.imageEdit);
}

export function createImageEditController(options = {}) {
  const refs = options.refs || getImageEditRefs();
  const state = options.state;
  if (!hasImageEditContext({ refs, state })) {
    return null;
  }

  const {
    buildReferenceFingerprint,
    clearError = () => {},
    closeReferencePreview = () => {},
    compactErrorMessage = (message, fallback) => String(message || fallback || ""),
    createPreviewLoadingShellNodes,
    formatCanvasLabel = (value) => String(value || ""),
    formatClock = (value) => String(value || ""),
    formatFilmstripSizeLabel = (item) => String(item?.size || ""),
    formatTime = formatClock,
    getDisplayPrompt = (item) => String(item?.prompt || ""),
    getMaxParallelJobCount = () => 1,
    getQueuedJobCount = () => 0,
    getRatioOption,
    makeGalleryPreviewKey = (filename) => "file:" + filename,
    makeJobPreviewKey = (jobId) => "job:" + jobId,
    nowIso = () => new Date().toISOString(),
    normalizeSizeForSelectedRoute = normalizeGenerationSize,
    openLightbox = () => {},
    prepareGenerationReferenceImageFile,
    recordJobQueued = () => {},
    renderAll = () => {},
    renderRatioGrid,
    renderSizeOptions,
    resolveGenerationSizeForSelectedRoute = (ratioOption, sizeSetting) =>
      sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting,
    revokeReferencePreview = () => {},
    scheduleGenerationQueue = () => {},
    setActiveView = () => {},
    setReferencePreviewNavigationContext = () => {},
    showError = () => {},
    syncReferenceDropzoneCompact = () => {},
    updatePreviewLoadingShell,
  } = options;

  let imageEditLoadingShellNodes = null;
  let localMaskSourceKey = "";
  let localMaskSourceLoadId = 0;
  let localMaskSourceReady = false;
  let localMaskPointerId = null;
  let localMaskLastPoint = null;
  let localMaskUndoTransaction = null;

  function createDefaultLocalEditState() {
    return {
      enabled: false,
      activeRegionId: "",
      brushSize: 48,
      tool: "brush",
      executionStrategy: "merge",
      nextRegionIndex: 1,
      regions: [],
    };
  }

  function ensureLocalEditState() {
    const current = state.imageEdit.localEdit && typeof state.imageEdit.localEdit === "object"
      ? state.imageEdit.localEdit
      : {};
    const localEdit = {
      ...createDefaultLocalEditState(),
      ...current,
      regions: Array.isArray(current.regions) ? current.regions : [],
    };
    localEdit.brushSize = Number.parseInt(String(localEdit.brushSize || 48), 10) || 48;
    localEdit.tool = localEdit.tool === "eraser" ? "eraser" : "brush";
    localEdit.executionStrategy = normalizeLocalMaskExecutionStrategy(localEdit.executionStrategy);
    localEdit.nextRegionIndex = Number.parseInt(String(localEdit.nextRegionIndex || 1), 10) || 1;
    state.imageEdit.localEdit = localEdit;
    return localEdit;
  }

  function resetCanvasElement(canvas) {
    if (!canvas) {
      return;
    }
    canvas.width = 1;
    canvas.height = 1;
    canvas.getContext("2d")?.clearRect(0, 0, 1, 1);
  }

  function resetLocalEditState() {
    const localEdit = ensureLocalEditState();
    Object.assign(localEdit, createDefaultLocalEditState());
    localMaskSourceKey = "";
    localMaskSourceReady = false;
    localMaskSourceLoadId += 1;
    localMaskPointerId = null;
    localMaskLastPoint = null;
    localMaskUndoTransaction = null;
    resetCanvasElement(refs.imageEditSourceCanvas);
    resetCanvasElement(refs.imageEditMaskOverlayCanvas);
    refs.imageEditLocalMaskStage?.style.removeProperty("aspect-ratio");
    refs.imageEditRegionList?.replaceChildren();
    if (refs.imageEditLocalMaskStatus) {
      refs.imageEditLocalMaskStatus.textContent = "";
    }
  }

  function createLocalMaskRegion() {
    const localEdit = ensureLocalEditState();
    const index = localEdit.nextRegionIndex || 1;
    const region = {
      id: `region-${index}-${Date.now().toString(36)}`,
      index,
      color: LOCAL_MASK_COLORS[(index - 1) % LOCAL_MASK_COLORS.length],
      instruction: "",
      hasMask: false,
      visible: true,
      maskCanvas: null,
      undoStack: [],
      redoStack: [],
    };
    localEdit.nextRegionIndex = index + 1;
    localEdit.regions.push(region);
    localEdit.activeRegionId = region.id;
    ensureRegionMaskCanvas(region);
    return region;
  }

  function getActiveLocalMaskRegion() {
    const localEdit = ensureLocalEditState();
    let activeRegion = localEdit.regions.find((region) => region.id === localEdit.activeRegionId) || null;
    if (!activeRegion && localEdit.regions.length > 0) {
      activeRegion = localEdit.regions[0];
      localEdit.activeRegionId = activeRegion.id;
    }
    return activeRegion;
  }

  function setActiveLocalMaskRegion(regionId) {
    const localEdit = ensureLocalEditState();
    const target = localEdit.regions.find((region) => region.id === regionId);
    if (!target) {
      return;
    }
    localEdit.activeRegionId = target.id;
    renderImageEditLocalMaskEditor();
  }

  function getRegionMaskSize() {
    const width = refs.imageEditSourceCanvas?.width || 1;
    const height = refs.imageEditSourceCanvas?.height || 1;
    return { width, height };
  }

  function ensureRegionMaskCanvas(region) {
    if (!region || typeof document === "undefined") {
      return null;
    }
    const { width, height } = getRegionMaskSize();
    if (!region.maskCanvas || region.maskCanvas.width !== width || region.maskCanvas.height !== height) {
      const nextCanvas = document.createElement("canvas");
      nextCanvas.width = width;
      nextCanvas.height = height;
      if (region.maskCanvas && region.hasMask) {
        nextCanvas.getContext("2d")?.drawImage(region.maskCanvas, 0, 0, width, height);
      }
      region.maskCanvas = nextCanvas;
    }
    return region.maskCanvas;
  }

  function maskCanvasHasPixels(canvas) {
    const context = canvas?.getContext("2d", { willReadFrequently: true });
    if (!canvas || !context || canvas.width <= 0 || canvas.height <= 0) {
      return false;
    }
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    for (let index = 3; index < data.length; index += 4) {
      if (data[index] > 0) {
        return true;
      }
    }
    return false;
  }

  function recomputeRegionHasMask(region) {
    const canvas = ensureRegionMaskCanvas(region);
    region.hasMask = maskCanvasHasPixels(canvas);
    region.maskDirty = false;
    return region.hasMask;
  }

  function getPaintedLocalMaskRegions() {
    const localEdit = ensureLocalEditState();
    return localEdit.regions.filter((region) => region.hasMask);
  }

  function getValidLocalMaskRegions() {
    return getPaintedLocalMaskRegions().filter((region) => region.instruction.trim());
  }

  function getLocalMaskGenerationState() {
    const paintedRegions = getPaintedLocalMaskRegions();
    const missingInstructionRegions = paintedRegions.filter((region) => !region.instruction.trim());
    return {
      paintedRegions,
      validRegions: paintedRegions.filter((region) => region.instruction.trim()),
      hasPaintedRegions: paintedRegions.length > 0,
      hasMissingInstruction: missingInstructionRegions.length > 0,
      missingInstructionRegions,
    };
  }

  function setLocalMaskStatus(message = "") {
    if (refs.imageEditLocalMaskStatus) {
      refs.imageEditLocalMaskStatus.textContent = message;
    }
  }

  function syncLocalMaskStatus() {
    if (!state.imageEdit.source) {
      setLocalMaskStatus("");
      return;
    }
    if (!localMaskSourceReady) {
      setLocalMaskStatus("正在准备局部编辑画布...");
      return;
    }

    const maskState = getLocalMaskGenerationState();
    if (!maskState.hasPaintedRegions) {
      setLocalMaskStatus("可选：在图片上涂抹局部区域；不涂抹则按整图编辑。");
      return;
    }
    if (maskState.hasMissingInstruction) {
      setLocalMaskStatus("请为已涂抹区域填写说明。");
      return;
    }
    setLocalMaskStatus(`已标记 ${maskState.validRegions.length} 个局部编辑区域。`);
  }

  function loadImageEditLocalMaskSource(item) {
    if (!item?.previewUrl || !refs.imageEditSourceCanvas || !refs.imageEditMaskOverlayCanvas) {
      return;
    }
    if (localMaskSourceKey === item.previewUrl) {
      return;
    }

    localMaskSourceLoadId += 1;
    const loadId = localMaskSourceLoadId;
    localMaskSourceKey = item.previewUrl;
    localMaskSourceReady = false;
    resetCanvasElement(refs.imageEditSourceCanvas);
    resetCanvasElement(refs.imageEditMaskOverlayCanvas);
    setLocalMaskStatus("正在准备局部编辑画布...");

    const image = new Image();
    image.onload = () => {
      if (loadId !== localMaskSourceLoadId) {
        return;
      }
      const width = Math.max(1, image.naturalWidth || image.width || 1);
      const height = Math.max(1, image.naturalHeight || image.height || 1);
      refs.imageEditSourceCanvas.width = width;
      refs.imageEditSourceCanvas.height = height;
      refs.imageEditMaskOverlayCanvas.width = width;
      refs.imageEditMaskOverlayCanvas.height = height;
      refs.imageEditLocalMaskStage?.style.setProperty("aspect-ratio", `${width} / ${height}`);

      const sourceContext = refs.imageEditSourceCanvas.getContext("2d");
      sourceContext?.clearRect(0, 0, width, height);
      sourceContext?.drawImage(image, 0, 0, width, height);

      const localEdit = ensureLocalEditState();
      localEdit.enabled = true;
      localEdit.regions.forEach((region) => ensureRegionMaskCanvas(region));
      if (localEdit.regions.length === 0) {
        createLocalMaskRegion();
      }
      localMaskSourceReady = true;
      renderImageEditView();
    };
    image.onerror = () => {
      if (loadId !== localMaskSourceLoadId) {
        return;
      }
      localMaskSourceReady = false;
      setLocalMaskStatus("源图预览加载失败，请重新上传。");
    };
    image.src = item.previewUrl;
  }

  function hexToRgba(hex, alpha) {
    const normalized = String(hex || "").replace("#", "").trim();
    const value = normalized.length === 3
      ? normalized.split("").map((part) => part + part).join("")
      : normalized.padEnd(6, "0").slice(0, 6);
    const red = Number.parseInt(value.slice(0, 2), 16) || 0;
    const green = Number.parseInt(value.slice(2, 4), 16) || 0;
    const blue = Number.parseInt(value.slice(4, 6), 16) || 0;
    return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
  }

  function renderLocalMaskOverlay() {
    const overlayCanvas = refs.imageEditMaskOverlayCanvas;
    const overlayContext = overlayCanvas?.getContext("2d");
    if (!overlayCanvas || !overlayContext) {
      return;
    }
    overlayContext.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);
    if (!localMaskSourceReady) {
      return;
    }

    const localEdit = ensureLocalEditState();
    const activeRegion = getActiveLocalMaskRegion();
    localEdit.regions.forEach((region) => {
      if (region.visible === false || !region.hasMask) {
        return;
      }
      const maskCanvas = ensureRegionMaskCanvas(region);
      const colorCanvas = document.createElement("canvas");
      colorCanvas.width = overlayCanvas.width;
      colorCanvas.height = overlayCanvas.height;
      const colorContext = colorCanvas.getContext("2d");
      if (!colorContext || !maskCanvas) {
        return;
      }
      colorContext.drawImage(maskCanvas, 0, 0);
      colorContext.globalCompositeOperation = "source-in";
      colorContext.fillStyle = hexToRgba(region.color, region.id === activeRegion?.id ? 0.48 : 0.32);
      colorContext.fillRect(0, 0, colorCanvas.width, colorCanvas.height);
      overlayContext.drawImage(colorCanvas, 0, 0);
    });
  }

  function syncLocalMaskControls() {
    const localEdit = ensureLocalEditState();
    const activeRegion = getActiveLocalMaskRegion();
    refs.imageEditBrushToolButton?.classList.toggle("is-active", localEdit.tool === "brush");
    refs.imageEditBrushToolButton?.setAttribute("aria-pressed", String(localEdit.tool === "brush"));
    refs.imageEditEraserToolButton?.classList.toggle("is-active", localEdit.tool === "eraser");
    refs.imageEditEraserToolButton?.setAttribute("aria-pressed", String(localEdit.tool === "eraser"));
    if (refs.imageEditBrushSizeInput) {
      refs.imageEditBrushSizeInput.value = String(localEdit.brushSize);
    }
    if (refs.imageEditExecutionStrategyInput) {
      refs.imageEditExecutionStrategyInput.value = localEdit.executionStrategy;
    }
    if (refs.imageEditUndoMaskButton) {
      refs.imageEditUndoMaskButton.disabled = !activeRegion?.undoStack?.length;
    }
    if (refs.imageEditRedoMaskButton) {
      refs.imageEditRedoMaskButton.disabled = !activeRegion?.redoStack?.length;
    }
  }

  function renderImageEditRegionList() {
    const list = refs.imageEditRegionList;
    if (!list) {
      return;
    }
    list.replaceChildren();
    if (!state.imageEdit.source || !localMaskSourceReady) {
      return;
    }

    const localEdit = ensureLocalEditState();
    const activeRegion = getActiveLocalMaskRegion();
    localEdit.regions.forEach((region) => {
      const card = document.createElement("article");
      card.className = "image-edit-region-card";
      card.classList.toggle("is-active", region.id === activeRegion?.id);
      card.dataset.imageEditRegionId = region.id;

      const header = document.createElement("div");
      header.className = "image-edit-region-card-header";

      const title = document.createElement("div");
      title.className = "image-edit-region-title";
      const swatch = document.createElement("span");
      swatch.className = "image-edit-region-swatch";
      swatch.style.background = region.color;
      swatch.setAttribute("aria-hidden", "true");
      const label = document.createElement("strong");
      label.textContent = `区域 ${region.index}`;
      title.append(swatch, label);
      header.appendChild(title);

      const actions = document.createElement("div");
      actions.className = "image-edit-region-actions";
      const select = document.createElement("select");
      select.className = "image-edit-region-select";
      select.dataset.imageEditRegionSelect = "true";
      select.setAttribute("aria-label", "切换编辑区域");
      localEdit.regions.forEach((optionRegion) => {
        const option = document.createElement("option");
        option.value = optionRegion.id;
        option.textContent = `区域 ${optionRegion.index}`;
        select.appendChild(option);
      });
      select.value = activeRegion?.id || region.id;
      actions.appendChild(select);

      const activateButton = document.createElement("button");
      activateButton.className = "toolbar-button";
      activateButton.type = "button";
      activateButton.dataset.imageEditRegionAction = "activate";
      activateButton.dataset.imageEditRegionId = region.id;
      activateButton.textContent = region.id === activeRegion?.id ? "编辑中" : "选择";
      actions.appendChild(activateButton);

      const visibleButton = document.createElement("button");
      visibleButton.className = "toolbar-button";
      visibleButton.type = "button";
      visibleButton.dataset.imageEditRegionAction = "toggle-visible";
      visibleButton.dataset.imageEditRegionId = region.id;
      visibleButton.textContent = region.visible === false ? "显示" : "隐藏";
      actions.appendChild(visibleButton);

      const clearButton = document.createElement("button");
      clearButton.className = "toolbar-button";
      clearButton.type = "button";
      clearButton.dataset.imageEditRegionAction = "clear";
      clearButton.dataset.imageEditRegionId = region.id;
      clearButton.textContent = "清空";
      actions.appendChild(clearButton);

      const deleteButton = document.createElement("button");
      deleteButton.className = "toolbar-button danger";
      deleteButton.type = "button";
      deleteButton.dataset.imageEditRegionAction = "delete";
      deleteButton.dataset.imageEditRegionId = region.id;
      deleteButton.textContent = "删除";
      actions.appendChild(deleteButton);

      header.appendChild(actions);
      card.appendChild(header);

      const instruction = document.createElement("textarea");
      instruction.className = "image-edit-region-instruction";
      instruction.dataset.imageEditRegionInstruction = region.id;
      instruction.rows = 3;
      instruction.maxLength = 500;
      instruction.placeholder = `区域 ${region.index} 的编辑说明`;
      instruction.value = region.instruction;
      card.appendChild(instruction);
      list.appendChild(card);
    });
  }

  function renderImageEditLocalMaskEditor() {
    const localEdit = ensureLocalEditState();
    const hasSource = Boolean(state.imageEdit.source?.previewUrl);
    refs.imageEditLocalMaskPanel?.classList.toggle("hidden", !hasSource);
    if (!hasSource) {
      if (localEdit.enabled || localEdit.regions.length > 0 || localMaskSourceReady || localMaskSourceKey) {
        resetLocalEditState();
      }
      return;
    }

    localEdit.enabled = true;
    loadImageEditLocalMaskSource(state.imageEdit.source);
    if (localMaskSourceReady && localEdit.regions.length === 0) {
      createLocalMaskRegion();
    }
    renderImageEditRegionList();
    renderLocalMaskOverlay();
    syncLocalMaskControls();
    syncLocalMaskStatus();
  }

  function getRegionById(regionId) {
    return ensureLocalEditState().regions.find((region) => region.id === regionId) || null;
  }

  function clearLocalMaskRegion(region) {
    const maskCanvas = ensureRegionMaskCanvas(region);
    const context = maskCanvas?.getContext("2d");
    if (!maskCanvas || !context) {
      return;
    }
    if (region.hasMask) {
      pushRegionUndo(region);
    }
    context.clearRect(0, 0, maskCanvas.width, maskCanvas.height);
    region.hasMask = false;
    region.redoStack = [];
    renderImageEditLocalMaskEditor();
    syncImageEditGenerateButton();
  }

  function deleteLocalMaskRegion(region) {
    const localEdit = ensureLocalEditState();
    localEdit.regions = localEdit.regions.filter((entry) => entry.id !== region.id);
    if (localEdit.activeRegionId === region.id) {
      localEdit.activeRegionId = localEdit.regions[0]?.id || "";
    }
    if (state.imageEdit.source && localMaskSourceReady && localEdit.regions.length === 0) {
      createLocalMaskRegion();
    }
    renderImageEditLocalMaskEditor();
    syncImageEditGenerateButton();
  }

  function setLocalMaskTool(tool) {
    const localEdit = ensureLocalEditState();
    localEdit.tool = tool === "eraser" ? "eraser" : "brush";
    syncLocalMaskControls();
  }

  function getCanvasPoint(event) {
    const canvas = refs.imageEditMaskOverlayCanvas;
    const rect = canvas?.getBoundingClientRect();
    if (!canvas || !rect?.width || !rect.height) {
      return null;
    }
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    return {
      x: (event.clientX - rect.left) * scaleX,
      y: (event.clientY - rect.top) * scaleY,
    };
  }

  function normalizeBoundedSnapshotRect(maskCanvas, rect) {
    if (!maskCanvas || !rect) {
      return null;
    }
    const left = Number.isFinite(rect.x) ? rect.x : 0;
    const top = Number.isFinite(rect.y) ? rect.y : 0;
    const right = Number.isFinite(rect.width) ? left + rect.width : left;
    const bottom = Number.isFinite(rect.height) ? top + rect.height : top;
    const x = Math.max(0, Math.floor(left));
    const y = Math.max(0, Math.floor(top));
    const width = Math.min(maskCanvas.width, Math.ceil(right)) - x;
    const height = Math.min(maskCanvas.height, Math.ceil(bottom)) - y;
    if (width <= 0 || height <= 0) {
      return null;
    }
    return { x, y, width, height };
  }

  function getStrokeSnapshotRect(maskCanvas, fromPoint, toPoint, radius) {
    if (!maskCanvas || !fromPoint) {
      return null;
    }
    const targetPoint = toPoint || fromPoint;
    const padding = Math.ceil(radius + 2);
    const left = Math.min(fromPoint.x, targetPoint.x) - padding;
    const top = Math.min(fromPoint.y, targetPoint.y) - padding;
    const right = Math.max(fromPoint.x, targetPoint.x) + padding;
    const bottom = Math.max(fromPoint.y, targetPoint.y) + padding;
    return normalizeBoundedSnapshotRect(maskCanvas, {
      x: left,
      y: top,
      width: right - left,
      height: bottom - top,
    });
  }

  function captureBoundedMaskSnapshot(region, rect) {
    const maskCanvas = ensureRegionMaskCanvas(region);
    const context = maskCanvas?.getContext("2d", { willReadFrequently: true });
    const normalizedRect = normalizeBoundedSnapshotRect(maskCanvas, rect);
    if (!maskCanvas || !context || !normalizedRect) {
      return null;
    }
    const { x, y, width, height } = normalizedRect;
    const imageData = context.getImageData(x, y, width, height);
    return { x, y, width, height, imageData };
  }

  function getRegionMaskContentBounds(region) {
    const maskCanvas = ensureRegionMaskCanvas(region);
    const context = maskCanvas?.getContext("2d", { willReadFrequently: true });
    if (!maskCanvas || !context || maskCanvas.width <= 0 || maskCanvas.height <= 0) {
      return null;
    }
    let minX = maskCanvas.width;
    let minY = maskCanvas.height;
    let maxX = -1;
    let maxY = -1;
    for (let y = 0; y < maskCanvas.height; y += 1) {
      const data = context.getImageData(0, y, maskCanvas.width, 1).data;
      for (let x = 0; x < maskCanvas.width; x += 1) {
        if (data[(x * 4) + 3] > 0) {
          minX = Math.min(minX, x);
          minY = Math.min(minY, y);
          maxX = Math.max(maxX, x);
          maxY = Math.max(maxY, y);
        }
      }
    }
    if (maxX < 0 || maxY < 0) {
      return null;
    }
    return {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    };
  }

  function createRegionContentUndoEntry(region) {
    const bounds = getRegionMaskContentBounds(region);
    const segment = captureBoundedMaskSnapshot(region, bounds);
    return segment ? { segments: [segment], hadMask: Boolean(region?.hasMask) } : null;
  }

  function pushRegionUndo(region, entry = null) {
    const undoEntry = entry || createRegionContentUndoEntry(region);
    if (!undoEntry?.segments?.length) {
      return;
    }
    region.undoStack ||= [];
    region.redoStack ||= [];
    region.undoStack.push({
      segments: undoEntry.segments.filter(Boolean),
      hadMask: Boolean(undoEntry.hadMask),
    });
    if (region.undoStack.length > LOCAL_MASK_UNDO_LIMIT) {
      region.undoStack.shift();
    }
    region.redoStack = [];
  }

  function beginRegionUndoTransaction(region) {
    localMaskUndoTransaction = {
      regionId: region.id,
      segments: [],
      hadMask: Boolean(region.hasMask),
    };
  }

  function recordRegionUndoSegment(region, fromPoint, toPoint, radius) {
    if (!localMaskUndoTransaction || localMaskUndoTransaction.regionId !== region?.id) {
      return;
    }
    const maskCanvas = ensureRegionMaskCanvas(region);
    const rect = getStrokeSnapshotRect(maskCanvas, fromPoint, toPoint, radius);
    const segment = captureBoundedMaskSnapshot(region, rect);
    if (segment) {
      localMaskUndoTransaction.segments.push(segment);
    }
  }

  function commitRegionUndoTransaction(region) {
    const transaction = localMaskUndoTransaction;
    localMaskUndoTransaction = null;
    if (!region || transaction?.regionId !== region.id || !transaction.segments.length) {
      return;
    }
    pushRegionUndo(region, transaction);
  }

  function captureUndoEntryForSegments(region, segments) {
    const capturedSegments = [];
    segments.forEach((segment) => {
      const captured = captureBoundedMaskSnapshot(region, segment);
      if (captured) {
        capturedSegments.push(captured);
      }
    });
    return {
      segments: capturedSegments,
      hadMask: Boolean(region?.hasMask),
    };
  }

  function restoreRegionSnapshot(region, snapshot) {
    const maskCanvas = ensureRegionMaskCanvas(region);
    const context = maskCanvas?.getContext("2d", { willReadFrequently: true });
    if (!maskCanvas || !context || !snapshot?.segments?.length) {
      return;
    }
    [...snapshot.segments].reverse().forEach((segment) => {
      if (segment?.imageData) {
        context.putImageData(segment.imageData, segment.x, segment.y);
      }
    });
    region.hasMask = Boolean(snapshot.hadMask);
    region.maskDirty = true;
    recomputeRegionHasMask(region);
  }

  function undoLocalMaskRegion() {
    const region = getActiveLocalMaskRegion();
    if (!region || !region.undoStack?.length) {
      return;
    }
    const undoEntry = region.undoStack.pop();
    const redoEntry = captureUndoEntryForSegments(region, undoEntry.segments);
    region.redoStack ||= [];
    if (redoEntry.segments.length) {
      region.redoStack.push(redoEntry);
    }
    restoreRegionSnapshot(region, undoEntry);
    renderImageEditLocalMaskEditor();
    syncImageEditGenerateButton();
  }

  function redoLocalMaskRegion() {
    const region = getActiveLocalMaskRegion();
    if (!region || !region.redoStack?.length) {
      return;
    }
    const redoEntry = region.redoStack.pop();
    const undoEntry = captureUndoEntryForSegments(region, redoEntry.segments);
    region.undoStack ||= [];
    if (undoEntry.segments.length) {
      region.undoStack.push(undoEntry);
      if (region.undoStack.length > LOCAL_MASK_UNDO_LIMIT) {
        region.undoStack.shift();
      }
    }
    restoreRegionSnapshot(region, redoEntry);
    renderImageEditLocalMaskEditor();
    syncImageEditGenerateButton();
  }

  function drawLocalMaskStroke(region, fromPoint, toPoint = fromPoint) {
    const localEdit = ensureLocalEditState();
    const maskCanvas = ensureRegionMaskCanvas(region);
    const context = maskCanvas?.getContext("2d");
    if (!region || !maskCanvas || !context || !fromPoint) {
      return;
    }

    const radius = Math.max(1, Number.parseInt(String(localEdit.brushSize || 48), 10) || 48);
    recordRegionUndoSegment(region, fromPoint, toPoint, radius);
    context.save();
    context.lineCap = "round";
    context.lineJoin = "round";
    context.lineWidth = radius * 2;
    context.globalCompositeOperation = localEdit.tool === "eraser" ? "destination-out" : "source-over";
    context.strokeStyle = "#ffffff";
    context.fillStyle = "#ffffff";
    context.beginPath();
    if (toPoint && (fromPoint.x !== toPoint.x || fromPoint.y !== toPoint.y)) {
      context.moveTo(fromPoint.x, fromPoint.y);
      context.lineTo(toPoint.x, toPoint.y);
      context.stroke();
    } else {
      context.arc(fromPoint.x, fromPoint.y, radius, 0, Math.PI * 2);
      context.fill();
    }
    context.restore();
    if (localEdit.tool !== "eraser") {
      region.hasMask = true;
      region.maskDirty = false;
    } else {
      region.maskDirty = true;
    }
    renderLocalMaskOverlay();
    syncLocalMaskStatus();
    syncLocalMaskControls();
  }

  function beginLocalMaskStroke(event) {
    if (!localMaskSourceReady) {
      return;
    }
    const region = getActiveLocalMaskRegion() || createLocalMaskRegion();
    const point = getCanvasPoint(event);
    if (!region || !point) {
      return;
    }
    event.preventDefault();
    localMaskPointerId = event.pointerId;
    localMaskLastPoint = point;
    refs.imageEditMaskOverlayCanvas?.setPointerCapture?.(event.pointerId);
    beginRegionUndoTransaction(region);
    drawLocalMaskStroke(region, point);
  }

  function continueLocalMaskStroke(event) {
    if (localMaskPointerId !== event.pointerId || !localMaskLastPoint) {
      return;
    }
    const region = getActiveLocalMaskRegion();
    const point = getCanvasPoint(event);
    if (!region || !point) {
      return;
    }
    event.preventDefault();
    drawLocalMaskStroke(region, localMaskLastPoint, point);
    localMaskLastPoint = point;
  }

  function endLocalMaskStroke(event) {
    if (localMaskPointerId !== event.pointerId) {
      return;
    }
    const region = localMaskUndoTransaction?.regionId
      ? getRegionById(localMaskUndoTransaction.regionId)
      : getActiveLocalMaskRegion();
    if (region?.maskDirty) {
      recomputeRegionHasMask(region);
    }
    commitRegionUndoTransaction(region);
    refs.imageEditMaskOverlayCanvas?.releasePointerCapture?.(event.pointerId);
    localMaskPointerId = null;
    localMaskLastPoint = null;
    renderImageEditLocalMaskEditor();
    syncImageEditGenerateButton();
  }

  function canvasToPngFile(canvas, filename) {
    return new Promise((resolve, reject) => {
      canvas.toBlob((blob) => {
        if (!blob) {
          reject(new Error("无法导出局部编辑蒙版。"));
          return;
        }
        resolve(new File([blob], filename, { type: "image/png" }));
      }, "image/png");
    });
  }

  async function exportSourceCanvasFile() {
    if (!localMaskSourceReady || !refs.imageEditSourceCanvas) {
      throw new Error("局部编辑画布尚未准备好。");
    }
    return canvasToPngFile(refs.imageEditSourceCanvas, "image-edit-source.png");
  }

  function createApiMaskCanvas(regions) {
    const { width, height } = getRegionMaskSize();
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = width;
    maskCanvas.height = height;
    const context = maskCanvas.getContext("2d");
    context.fillStyle = "#000000";
    context.fillRect(0, 0, width, height);
    context.globalCompositeOperation = "destination-out";
    regions.forEach((region) => {
      const regionCanvas = ensureRegionMaskCanvas(region);
      if (regionCanvas) {
        context.drawImage(regionCanvas, 0, 0, width, height);
      }
    });
    context.globalCompositeOperation = "source-over";
    return maskCanvas;
  }

  async function exportMergedApiMaskFile(validRegions) {
    return canvasToPngFile(createApiMaskCanvas(validRegions), "image-edit-local-mask.png");
  }

  async function exportRegionApiMaskFile(region) {
    return canvasToPngFile(createApiMaskCanvas([region]), `image-edit-region-${region.index}-mask.png`);
  }

  async function buildLocalMaskPayload() {
    const validRegions = getValidLocalMaskRegions();
    const executionStrategy = normalizeLocalMaskExecutionStrategy(refs.imageEditExecutionStrategyInput?.value);
    const basePayload = {
      editMode: IMAGE_EDIT_LOCAL_MASK_MODE,
      executionStrategy,
      sourceFile: await exportSourceCanvasFile(),
      regionInstructions: validRegions.map((region) => ({
        id: region.id,
        index: region.index,
        color: region.color,
        instruction: region.instruction.trim(),
        hasMask: true,
      })),
    };

    if (executionStrategy === "sequential") {
      return {
        ...basePayload,
        masks: await Promise.all(validRegions.map(exportRegionApiMaskFile)),
        prompt: basePayload.regionInstructions
          .map((region) => `Region ${region.index}: ${region.instruction}`)
          .join("\n"),
      };
    }

    return {
      ...basePayload,
      executionStrategy: "merge",
      mask: await exportMergedApiMaskFile(validRegions),
      prompt: buildLocalMaskMergedPrompt(basePayload.regionInstructions),
    };
  }

  function setImageEditFeedback(message = "", kind = "") {
    state.imageEdit.feedback = message;
    state.imageEdit.feedbackKind = kind;
    refs.imageEditFeedback.textContent = message ? compactErrorMessage(message, "图片编辑失败") : "";
    refs.imageEditFeedback.dataset.state = kind;
  }

  function createImageEditItem(file) {
    return {
      id: `image-edit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint: buildReferenceFingerprint(file),
      file,
      generationFile: file,
      generationFilePromise: null,
      generationCompressed: false,
      previewUrl: URL.createObjectURL(file),
    };
  }

  function startImageEditGenerationCompression(item) {
    if (!item?.file || typeof prepareGenerationReferenceImageFile !== "function") {
      return null;
    }

    item.generationFile = item.file;
    item.generationCompressed = false;
    item.generationFilePromise = prepareGenerationReferenceImageFile(item.file)
      .then((preparedFile) => {
        item.generationFile = preparedFile || item.file;
        item.generationCompressed = Boolean(preparedFile && preparedFile !== item.file);
        return item.generationFile;
      })
      .catch(() => {
        item.generationFile = item.file;
        item.generationCompressed = false;
        return item.file;
      })
      .finally(() => {
        item.generationFilePromise = null;
        renderImageEditView();
      });

    renderImageEditView();
    return item.generationFilePromise;
  }

  async function ensureImageEditGenerationFileReady() {
    const pending = state.imageEdit.source?.generationFilePromise;
    if (!pending) {
      return;
    }

    try {
      await pending;
    } finally {
      renderImageEditView();
    }
  }

  function applyImageEditFile(fileList) {
    const incomingFiles = [...(fileList || [])].filter((file) => String(file.type || "").startsWith("image/"));
    if (incomingFiles.length === 0) {
      setImageEditFeedback("请选择一张图片文件。", "error");
      return;
    }
    if (incomingFiles.length !== 1) {
      setImageEditFeedback("图片编辑模式一次只支持一张源图。", "error");
      if (refs.imageEditSourceInput) refs.imageEditSourceInput.value = "";
      return;
    }

    const file = incomingFiles[0];
    if (state.imageEdit.source?.fingerprint === buildReferenceFingerprint(file)) {
      return;
    }

    if (state.imageEdit.source) {
      revokeReferencePreview(state.imageEdit.source);
    }
    resetLocalEditState();
    const nextItem = createImageEditItem(file);
    startImageEditGenerationCompression(nextItem);
    state.imageEdit.source = nextItem;
    refs.imageEditSourceInput.value = "";
    setImageEditFeedback("", "");
    renderImageEditView();
  }

  function removeImageEditSource() {
    const target = state.imageEdit.source;
    if (!target) {
      return;
    }

    if (state.imageEditPreviewItem?.id === target.id) {
      closeReferencePreview();
      state.imageEditPreviewItem = null;
    }

    revokeReferencePreview(target);
    state.imageEdit.source = null;
    resetLocalEditState();
    refs.imageEditSourceInput.value = "";
    renderImageEditView();
  }

  function openImageEditSourcePreview(referenceId) {
    const item = state.imageEdit.source;
    if (item?.id !== referenceId || !item.previewUrl) {
      return;
    }

    state.imageEditPreviewItem = item;
    setReferencePreviewNavigationContext({
      items: [item],
      currentId: item.id,
    });
    refs.referencePreviewImage.src = item.previewUrl;
    refs.referencePreviewViewer.classList.add("open");
    refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
  }

  function renderImageEditSource() {
    const item = state.imageEdit.source;
    refs.imageEditSourceCount.textContent = item ? "1 / 1" : "0 / 1";
    syncReferenceDropzoneCompact(refs.imageEditDropzone, Boolean(item));
    refs.imageEditSourceGrid.classList.toggle("hidden", !item);
    refs.imageEditSourceGrid.replaceChildren();

    if (!item) {
      return;
    }

    const card = document.createElement("div");
    card.className = "reference-card image-edit-source-card";

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "reference-preview-button";
    previewButton.dataset.imageEditPreviewId = item.id;
    previewButton.setAttribute("aria-label", "放大查看源图");

    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "源图预览";
    previewButton.appendChild(image);
    card.appendChild(previewButton);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", "移除源图");
    remove.addEventListener("click", removeImageEditSource);
    card.appendChild(remove);

    refs.imageEditSourceGrid.appendChild(card);
  }

  function syncImageEditRatio(value) {
    const nextValue = getRatioOption(value)?.value || DEFAULT_IMAGE_EDIT_RATIO;
    refs.imageEditRatioInput.value = nextValue;
    renderImageEditRatioGrid();
    renderImageEditSizeOptions();
  }

  function renderImageEditRatioGrid() {
    renderRatioGrid(refs.imageEditRatioGrid, refs.imageEditRatioInput, syncImageEditRatio);
  }

  function renderImageEditSizeOptions() {
    renderSizeOptions(refs.imageEditSizeInput, refs.imageEditRatioInput);
  }

  function renderImageEditOutputFormatOptions() {
    if (!refs.imageEditOutputFormatInput) {
      return;
    }

    const currentValue = normalizeOutputFormat(
      refs.imageEditOutputFormatInput.value || refs.outputFormatInput?.value || state.config?.defaults?.format || "png",
    );
    refs.imageEditOutputFormatInput.innerHTML = "";
    getOutputFormatOptions().forEach((option) => {
      const element = document.createElement("option");
      element.value = option.value;
      element.textContent = option.label;
      refs.imageEditOutputFormatInput.appendChild(element);
    });
    refs.imageEditOutputFormatInput.value = currentValue;
  }

  function syncImageEditSize(value) {
    const ratioValue = refs.imageEditRatioInput.value || DEFAULT_IMAGE_EDIT_RATIO;
    refs.imageEditSizeInput.value = normalizeSizeForSelectedRoute(ratioValue, value || "auto");
  }

  function createImageEditJob(payload = null) {
    const prompt = payload?.prompt || refs.imageEditPromptInput.value.trim();
    const ratioOption = getRatioOption(refs.imageEditRatioInput.value || DEFAULT_IMAGE_EDIT_RATIO);
    const ratioValue = ratioOption?.value || DEFAULT_IMAGE_EDIT_RATIO;
    const sizeSetting = normalizeSizeForSelectedRoute(ratioValue, refs.imageEditSizeInput.value || "auto");
    const size = resolveGenerationSizeForSelectedRoute(ratioOption, sizeSetting);
    const sourceItem = state.imageEdit.source;

    return {
      id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: nowIso(),
      mode: "image-edit",
      prompt,
      editInstruction: prompt,
      editMode: payload?.editMode || "",
      executionStrategy: payload?.executionStrategy || "",
      regionInstructions: payload?.regionInstructions || [],
      localMask: payload
        ? { mask: payload.mask || null, masks: payload.masks || [] }
        : null,
      ratio: ratioValue,
      ratioLabel: ratioOption?.label || DEFAULT_IMAGE_EDIT_RATIO_LABEL,
      sizeSetting,
      size,
      quality: state.config?.defaults?.quality || "high",
      format: normalizeOutputFormat(
        refs.imageEditOutputFormatInput?.value || refs.outputFormatInput?.value || state.config?.defaults?.format || "png",
      ),
      baseUrl: state.config?.baseUrl || refs.baseUrlInput?.value?.trim() || "",
      responsesModel: state.config?.responsesModel || refs.responsesModelInput?.value?.trim() || "gpt-5.4",
      imageModel: "gpt-image-2",
      reasoningEffort: refs.reasoningEffortInput?.value || state.config?.defaults?.reasoningEffort || "xhigh",
      requestRetryCount: 0,
      referenceFiles: payload?.sourceFile ? [payload.sourceFile] : sourceItem ? [sourceItem.generationFile || sourceItem.file] : [],
      hasReferenceImage: Boolean(sourceItem),
      referenceImageName: sourceItem?.file?.name || "",
      referenceImageNames: sourceItem?.file?.name ? [sourceItem.file.name] : [],
      sourceImageName: sourceItem?.file?.name || "",
      isRunning: false,
      started: false,
      statusStage: "queued",
      statusText: "等待排队",
      previewUrl: "",
    };
  }

  function getImageEditGenerationItemByKey(key) {
    if (String(key || "").startsWith("job:")) {
      return state.jobs.find((job) => job.id === String(key).slice(4) && job.mode === "image-edit") || null;
    }

    if (String(key || "").startsWith("file:")) {
      return state.imageEdit.generationItems[key] || state.gallery.find((item) => item.filename === String(key).slice(5)) || null;
    }

    return null;
  }

  function storeImageEditGenerationItem(item) {
    const filename = String(item?.filename || "").trim();
    if (!filename) {
      return "";
    }

    const key = makeGalleryPreviewKey(filename);
    state.imageEdit.generationItems[key] = {
      ...(state.imageEdit.generationItems[key] || {}),
      ...item,
      mode: "image-edit",
      assetKind: item.assetKind || "image-edit",
    };
    return key;
  }

  function registerImageEditGenerationKey(key) {
    const nextKey = String(key || "").trim();
    if (!nextKey) {
      return;
    }

    state.imageEdit.generationKeys = [
      nextKey,
      ...state.imageEdit.generationKeys.filter((entry) => entry !== nextKey),
    ];
  }

  function replaceImageEditGenerationKey(oldKey, newKey) {
    const currentKey = String(oldKey || "").trim();
    const nextKey = String(newKey || "").trim();
    if (!nextKey) {
      return;
    }

    const keys = state.imageEdit.generationKeys.filter((entry) => entry !== nextKey && entry !== currentKey);
    state.imageEdit.generationKeys = [nextKey, ...keys];
  }

  function removeImageEditGenerationKey(key) {
    const targetKey = String(key || "").trim();
    if (!targetKey) {
      return;
    }

    state.imageEdit.generationKeys = state.imageEdit.generationKeys.filter((entry) => entry !== targetKey);
    if (state.imageEdit.previewKey === targetKey) {
      state.imageEdit.previewKey = "";
    }
  }

  function getImageEditGenerationEntries() {
    const entries = [];
    const seen = new Set();
    const addKey = (key) => {
      const normalizedKey = String(key || "").trim();
      if (!normalizedKey || seen.has(normalizedKey)) {
        return;
      }

      const item = getImageEditGenerationItemByKey(normalizedKey);
      if (!item) {
        return;
      }

      seen.add(normalizedKey);
      entries.push({ key: normalizedKey, item });
    };

    state.imageEdit.generationKeys.forEach(addKey);
    sortGalleryItemsByCreatedAtDesc(state.jobs)
      .filter((job) => job.mode === "image-edit")
      .forEach((job) => addKey(makeJobPreviewKey(job.id)));
    sortGalleryItemsByCreatedAtDesc(state.gallery)
      .filter(
        (item) =>
          item.mode === "image-edit" ||
          item.generationMode === "image-edit" ||
          item.assetKind === "image-edit",
      )
      .forEach((item) => addKey(makeGalleryPreviewKey(item.filename)));

    return entries;
  }

  function syncImageEditGenerationPreviewKey() {
    if (getImageEditGenerationItemByKey(state.imageEdit.previewKey || "")) {
      return;
    }

    const fallback = getImageEditGenerationEntries()[0];
    state.imageEdit.previewKey = fallback?.key || "";
  }

  function getImageEditGenerationPreviewItem() {
    syncImageEditGenerationPreviewKey();
    return getImageEditGenerationItemByKey(state.imageEdit.previewKey || "");
  }

  function setImageEditGenerationPreviewKey(key) {
    const nextKey = String(key || "").trim();
    if (!getImageEditGenerationItemByKey(nextKey)) {
      return;
    }

    state.imageEdit.previewKey = nextKey;
    renderImageEditGenerationPreview();
  }

  function setImageEditGenerationPlaceholderText(message, hidden = false) {
    imageEditLoadingShellNodes = null;
    refs.imageEditGenerationPlaceholder.className = "image-edit-generation-placeholder preview-placeholder";
    refs.imageEditGenerationPlaceholder.classList.toggle("hidden", hidden);
    refs.imageEditGenerationPlaceholder.replaceChildren();
    if (!message) {
      return;
    }

    const title = document.createElement("h3");
    title.textContent = message;
    refs.imageEditGenerationPlaceholder.appendChild(title);

    const detail = document.createElement("span");
    detail.textContent = "上传源图并填写编辑指令后开始生成。";
    refs.imageEditGenerationPlaceholder.appendChild(detail);
  }

  function renderImageEditGenerationLoading(item) {
    const placeholderState = {
      ...getPreviewPlaceholderState({
        item,
        imageUrl: "",
        prompt: item ? getDisplayPrompt(item) : "",
        runningCount: state.jobs.length,
        runningItems: state.jobs,
        maxConcurrentTasks: getMaxParallelJobCount(),
      }),
      eyebrow: "Image Edit",
      title: "图片编辑生成中",
      detail: item?.statusText || "正在按编辑指令生成结果",
    };

    if (
      !imageEditLoadingShellNodes ||
      !shouldReusePreviewLoadingShell(imageEditLoadingShellNodes.state || {}, placeholderState)
    ) {
      imageEditLoadingShellNodes = createPreviewLoadingShellNodes();
    }

    updatePreviewLoadingShell(imageEditLoadingShellNodes, placeholderState);
    refs.imageEditGenerationPlaceholder.className =
      "image-edit-generation-placeholder preview-placeholder preview-placeholder-loading";
    refs.imageEditGenerationPlaceholder.classList.remove("hidden");

    if (
      refs.imageEditGenerationPlaceholder.firstChild !== imageEditLoadingShellNodes.eyebrow ||
      refs.imageEditGenerationPlaceholder.lastChild !== imageEditLoadingShellNodes.shell
    ) {
      refs.imageEditGenerationPlaceholder.replaceChildren(
        imageEditLoadingShellNodes.eyebrow,
        imageEditLoadingShellNodes.shell,
      );
    }
  }

  function openImageEditGeneratedPreview() {
    const item = getImageEditGenerationPreviewItem();
    if (item && getImageUrl(item)) {
      openLightbox(item, {
        items: getImageEditGenerationEntries().map((entry) => entry.item),
      });
    }
  }

  function renderImageEditGenerationPreview() {
    const item = getImageEditGenerationPreviewItem();
    const imageUrl = item ? getImageUrl(item) : "";
    const isRunning = Boolean(item?.isRunning || (item?.started && !item?.filename));

    refs.imageEditGenerationCanvas.classList.toggle("has-image", Boolean(imageUrl));
    refs.imageEditGenerationCanvas.classList.toggle("is-running", isRunning && !imageUrl);
    if (imageUrl) {
      refs.imageEditGenerationCanvas.setAttribute("role", "button");
      refs.imageEditGenerationCanvas.setAttribute("aria-label", "查看图片编辑结果");
      refs.imageEditGenerationCanvas.tabIndex = 0;
    } else {
      refs.imageEditGenerationCanvas.removeAttribute("role");
      refs.imageEditGenerationCanvas.removeAttribute("aria-label");
      refs.imageEditGenerationCanvas.tabIndex = -1;
    }

    if (imageUrl) {
      setImageEditGenerationPlaceholderText("", true);
    } else if (isRunning) {
      renderImageEditGenerationLoading(item);
    } else {
      setImageEditGenerationPlaceholderText("编辑结果会显示在这里");
    }

    if (imageUrl) {
      refs.imageEditGenerationImage.src = imageUrl;
      refs.imageEditGenerationImage.alt = getDisplayPrompt(item) || "图片编辑生成结果";
      refs.imageEditGenerationImage.classList.add("is-mounted", "is-visible");
      refs.imageEditGenerationDownloadButton.href = imageUrl;
      refs.imageEditGenerationDownloadButton.download = item.filename || "image-edit.png";
      refs.imageEditGenerationDownloadButton.classList.remove("disabled");
      refs.imageEditGenerationDownloadButton.setAttribute("aria-disabled", "false");
      refs.imageEditGenerationLightboxButton.disabled = false;
    } else {
      refs.imageEditGenerationImage.removeAttribute("src");
      refs.imageEditGenerationImage.classList.remove("is-mounted", "is-visible");
      refs.imageEditGenerationDownloadButton.href = "#";
      refs.imageEditGenerationDownloadButton.removeAttribute("download");
      refs.imageEditGenerationDownloadButton.classList.add("disabled");
      refs.imageEditGenerationDownloadButton.setAttribute("aria-disabled", "true");
      refs.imageEditGenerationLightboxButton.disabled = true;
    }

    refs.imageEditGenerationMeta.textContent = item
      ? [formatTime(item.createdAt), formatCanvasLabel(item.size), item.statusText || ""].filter(Boolean).join(" · ")
      : "等待生成";
    refs.imageEditPreviewStatus.textContent = item ? imageUrl ? "已生成" : item.statusText || "生成中" : "等待任务";
    renderImageEditGenerationStrip();
  }

  function renderImageEditGenerationStrip() {
    const entries = getImageEditGenerationEntries();
    refs.imageEditGenerationStrip.replaceChildren();
    refs.imageEditGenerationStrip.classList.toggle("hidden", entries.length === 0);
    refs.imageEditThumbnailEmpty.classList.toggle("hidden", entries.length > 0);

    entries.forEach(({ key, item }, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "filmstrip-item image-edit-generation-thumb";
      button.dataset.imageEditGenerationKey = key;
      button.setAttribute("aria-pressed", String(key === state.imageEdit.previewKey));
      button.title = `切换到第 ${index + 1} 张图片编辑结果`;
      button.classList.toggle("active", key === state.imageEdit.previewKey);
      button.classList.toggle("is-running", Boolean(item?.isRunning || (item?.started && !item?.filename)));

      const imageUrl = getImageUrl(item);
      if (imageUrl) {
        const image = document.createElement("img");
        image.src = imageUrl;
        image.alt = getDisplayPrompt(item) || "图片编辑结果";
        image.loading = "lazy";
        button.appendChild(image);
      } else {
        const ghost = document.createElement("div");
        ghost.className = "filmstrip-ghost";
        ghost.textContent = formatLoadingThumbnailStatusLabel(item, { idleLabel: "等待" });
        button.appendChild(ghost);
      }

      const caption = document.createElement("span");
      caption.textContent = formatFilmstripSizeLabel(item) || item?.statusText || formatClock(item?.createdAt);
      button.appendChild(caption);

      const shell = document.createElement("div");
      shell.className = "filmstrip-entry";
      shell.appendChild(button);
      refs.imageEditGenerationStrip.appendChild(shell);
    });
  }

  async function preserveImageEditGenerationItemForDelete(item) {
    if (!item?.filename) {
      return;
    }

    const key = makeGalleryPreviewKey(item.filename);
    const tracked =
      item.mode === "image-edit" ||
      item.generationMode === "image-edit" ||
      item.assetKind === "image-edit" ||
      state.imageEdit.generationKeys.includes(key) ||
      Boolean(state.imageEdit.generationItems[key]);
    if (!tracked) {
      return;
    }

    const imageUrl = getImageUrl(item);
    if (!imageUrl || String(imageUrl).startsWith("data:image/")) {
      storeImageEditGenerationItem(item);
      return;
    }

    try {
      const dataUrl = await fetchServerImageAsDataUrl(imageUrl);
      if (dataUrl) {
        storeImageEditGenerationItem({
          ...item,
          imageUrl: dataUrl,
          thumbnailUrl: dataUrl,
        });
        return;
      }
    } catch (_error) {
      // Keep existing metadata if the image cannot be copied before deletion.
    }

    storeImageEditGenerationItem(item);
  }

  function syncImageEditGenerateButton() {
    const hasSource = Boolean(state.imageEdit.source);
    const hasPrompt = Boolean(refs.imageEditPromptInput.value.trim());
    const hasPendingFile = Boolean(state.imageEdit.source?.generationFilePromise);
    const maskState = state.imageEdit.source && localMaskSourceReady
      ? getLocalMaskGenerationState()
      : { hasPaintedRegions: false, hasMissingInstruction: false };
    const canUseLocalMask = maskState.hasPaintedRegions && !maskState.hasMissingInstruction;

    refs.imageEditGenerateButton.disabled =
      !hasSource || hasPendingFile || maskState.hasMissingInstruction || (!hasPrompt && !canUseLocalMask);
    refs.imageEditGenerateButton.textContent = hasPendingFile
      ? "\u5904\u7406\u4e2d..."
      : maskState.hasMissingInstruction
        ? "\u8865\u5168\u533a\u57df\u8bf4\u660e"
        : canUseLocalMask
          ? "\u751f\u6210\u5c40\u90e8\u7f16\u8f91"
          : getQueuedJobCount() > 0
            ? "\u7ee7\u7eed\u7f16\u8f91"
            : "\u5f00\u59cb\u7f16\u8f91";
  }

  async function startImageEditGeneration() {
    clearError();

    if (!state.imageEdit.source?.file) {
      setImageEditFeedback("请先上传一张源图。", "error");
      return;
    }

    const prompt = refs.imageEditPromptInput.value.trim();
    const maskState = localMaskSourceReady
      ? getLocalMaskGenerationState()
      : { hasPaintedRegions: false, hasMissingInstruction: false };
    if (maskState.hasMissingInstruction) {
      setImageEditFeedback("\u8bf7\u4e3a\u5df2\u6d82\u62b9\u533a\u57df\u586b\u5199\u8bf4\u660e\u3002", "error");
      return;
    }
    if (!prompt && !maskState.hasPaintedRegions) {
      setImageEditFeedback("请填写编辑指令。", "error");
      refs.imageEditPromptInput.focus();
      return;
    }
    if (maskState.hasPaintedRegions && !localMaskSourceReady) {
      setImageEditFeedback("\u5c40\u90e8\u7f16\u8f91\u753b\u5e03\u5c1a\u672a\u51c6\u5907\u597d\uff0c\u8bf7\u7a0d\u540e\u518d\u8bd5\u3002", "error");
      return;
    }

    await ensureImageEditGenerationFileReady();
    const localMaskPayload = maskState.hasPaintedRegions ? await buildLocalMaskPayload() : null;
    const job = createImageEditJob(localMaskPayload);
    registerImageEditGenerationKey(makeJobPreviewKey(job.id));
    state.jobs.unshift(job);
    state.imageEdit.previewKey = makeJobPreviewKey(job.id);
    state.selectedPreviewKey = makeJobPreviewKey(job.id);
    recordJobQueued(job);
    setImageEditFeedback("图片编辑任务已提交，正在生成...", "busy");
    renderAll();
    setActiveView("image-edit");
    scheduleGenerationQueue();
  }

  function renderImageEditView() {
    renderImageEditSource();
    renderImageEditLocalMaskEditor();
    renderImageEditRatioGrid();
    renderImageEditSizeOptions();
    renderImageEditOutputFormatOptions();
    renderImageEditGenerationPreview();
    syncImageEditGenerateButton();
    refs.imageEditFeedback.textContent = state.imageEdit.feedback
      ? compactErrorMessage(state.imageEdit.feedback, "图片编辑失败")
      : "";
    refs.imageEditFeedback.dataset.state = state.imageEdit.feedbackKind || "";
  }

  function handleImageEditRegionListClick(event) {
    const actionTarget = event.target.closest("[data-image-edit-region-action]");
    if (!actionTarget) {
      const card = event.target.closest("[data-image-edit-region-id]");
      if (card && !event.target.closest("textarea, select, button")) {
        setActiveLocalMaskRegion(card.dataset.imageEditRegionId);
      }
      return;
    }

    const region = getRegionById(actionTarget.dataset.imageEditRegionId);
    if (!region) {
      return;
    }
    const action = actionTarget.dataset.imageEditRegionAction;
    if (action === "activate") {
      setActiveLocalMaskRegion(region.id);
      return;
    }
    if (action === "toggle-visible") {
      region.visible = region.visible === false;
      renderImageEditLocalMaskEditor();
      return;
    }
    if (action === "clear") {
      clearLocalMaskRegion(region);
      return;
    }
    if (action === "delete") {
      deleteLocalMaskRegion(region);
    }
  }

  function handleImageEditRegionListInput(event) {
    const instruction = event.target.closest("[data-image-edit-region-instruction]");
    if (!instruction) {
      return;
    }
    const region = getRegionById(instruction.dataset.imageEditRegionInstruction);
    if (!region) {
      return;
    }
    region.instruction = instruction.value;
    syncLocalMaskStatus();
    syncImageEditGenerateButton();
  }

  function handleImageEditRegionListChange(event) {
    const select = event.target.closest("[data-image-edit-region-select]");
    if (!select) {
      return;
    }
    setActiveLocalMaskRegion(select.value);
  }

  function bindImageEditEvents() {
    refs.imageEditSourceInput?.addEventListener("change", (event) => {
      applyImageEditFile(event.target.files);
    });
    refs.imageEditDropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      refs.imageEditDropzone.classList.add("dragover");
    });
    refs.imageEditDropzone?.addEventListener("dragleave", () => {
      refs.imageEditDropzone.classList.remove("dragover");
    });
    refs.imageEditDropzone?.addEventListener("drop", (event) => {
      event.preventDefault();
      refs.imageEditDropzone.classList.remove("dragover");
      applyImageEditFile(event.dataTransfer?.files);
    });
    refs.imageEditSourceGrid?.addEventListener("click", (event) => {
      const target = event.target.closest("[data-image-edit-preview-id]");
      if (!target) return;
      openImageEditSourcePreview(target.dataset.imageEditPreviewId);
    });
    refs.imageEditPromptInput?.addEventListener("input", renderImageEditView);
    refs.imageEditBrushToolButton?.addEventListener("click", () => setLocalMaskTool("brush"));
    refs.imageEditEraserToolButton?.addEventListener("click", () => setLocalMaskTool("eraser"));
    refs.imageEditUndoMaskButton?.addEventListener("click", undoLocalMaskRegion);
    refs.imageEditRedoMaskButton?.addEventListener("click", redoLocalMaskRegion);
    refs.imageEditBrushSizeInput?.addEventListener("input", (event) => {
      const localEdit = ensureLocalEditState();
      localEdit.brushSize = Number.parseInt(String(event.target.value || 48), 10) || 48;
      syncLocalMaskControls();
    });
    refs.imageEditExecutionStrategyInput?.addEventListener("change", (event) => {
      const localEdit = ensureLocalEditState();
      localEdit.executionStrategy = normalizeLocalMaskExecutionStrategy(event.target.value);
      refs.imageEditExecutionStrategyInput.value = localEdit.executionStrategy;
    });
    refs.imageEditAddRegionButton?.addEventListener("click", () => {
      createLocalMaskRegion();
      renderImageEditLocalMaskEditor();
      syncImageEditGenerateButton();
    });
    refs.imageEditRegionList?.addEventListener("click", handleImageEditRegionListClick);
    refs.imageEditRegionList?.addEventListener("input", handleImageEditRegionListInput);
    refs.imageEditRegionList?.addEventListener("change", handleImageEditRegionListChange);
    refs.imageEditMaskOverlayCanvas?.addEventListener("pointerdown", beginLocalMaskStroke);
    refs.imageEditMaskOverlayCanvas?.addEventListener("pointermove", continueLocalMaskStroke);
    refs.imageEditMaskOverlayCanvas?.addEventListener("pointerup", endLocalMaskStroke);
    refs.imageEditMaskOverlayCanvas?.addEventListener("pointercancel", endLocalMaskStroke);
    refs.imageEditMaskOverlayCanvas?.addEventListener("pointerleave", endLocalMaskStroke);
    refs.imageEditSizeInput?.addEventListener("change", (event) => {
      syncImageEditSize(event.target.value);
    });
    refs.imageEditGenerateButton.addEventListener("click", () => {
      startImageEditGeneration().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setImageEditFeedback(message, "error");
        showError(message);
      });
    });
    refs.imageEditGenerationLightboxButton?.addEventListener("click", openImageEditGeneratedPreview);
    refs.imageEditGenerationCanvas?.addEventListener("click", openImageEditGeneratedPreview);
    refs.imageEditGenerationCanvas?.addEventListener("keydown", (event) => {
      const shouldOpenPreview = event.key === "Enter" || event.key === " ";
      if (!shouldOpenPreview) return;
      const item = getImageEditGenerationPreviewItem();
      if (!item || !getImageUrl(item)) return;
      event.preventDefault();
      openImageEditGeneratedPreview();
    });
    refs.imageEditGenerationStrip?.addEventListener("click", (event) => {
      const target = event.target.closest("[data-image-edit-generation-key]");
      if (!target) return;
      setImageEditGenerationPreviewKey(target.dataset.imageEditGenerationKey);
    });
  }

  bindImageEditEvents();

  return {
    preserveImageEditGenerationItemForDelete,
    removeImageEditGenerationKey,
    renderImageEditView,
    replaceImageEditGenerationKey,
    setImageEditFeedback,
    storeImageEditGenerationItem,
  };
}

export function mountView(options = {}) {
  const controller = createImageEditController(options);
  if (!controller) {
    return createViewRendererController({
      ...options,
      view: options.view || "image-edit",
      rendererKey: "imageEdit",
    });
  }

  return {
    view: options.view || "image-edit",
    loaded: true,
    renderView() {
      controller.renderImageEditView();
      return true;
    },
    ...controller,
  };
}
