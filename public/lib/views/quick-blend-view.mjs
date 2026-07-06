import { getImageUrl, fetchServerImageAsDataUrl } from "../browser-image-cache.mjs";
import { sortGalleryItemsByCreatedAtDesc } from "../gallery-organizer.mjs";
import { getDefaultGenerationSize, normalizeGenerationSize } from "../generation-size-options.mjs";
import { normalizeOutputFormat } from "../output-format-options.mjs";
import { formatLoadingThumbnailStatusLabel, getPreviewPlaceholderState } from "../preview-placeholder-state.mjs";
import { shouldReusePreviewLoadingShell } from "../preview-loading-shell.mjs";
import { createViewRendererController } from "./view-renderer.mjs";

const DEFAULT_QUICK_BLEND_RATIO_VALUE = "1:1";
const QUICK_BLEND_GROUPS = Object.freeze(["a", "b", "c", "d"]);
const QUICK_BLEND_REQUIRED_GROUPS = Object.freeze(["a", "b"]);
const QUICK_BLEND_OPTIONAL_GROUPS = Object.freeze(["c", "d"]);
const QUICK_BLEND_RESERVED_SLOT_COUNT = 6;

function getQuickBlendRefs() {
  if (typeof document === "undefined") {
    return {};
  }

  return {
    baseUrlInput: document.querySelector("#baseUrlInput"),
    outputFormatInput: document.querySelector("#outputFormatInput"),
    quickBlendACount: document.querySelector("#quickBlendACount"),
    quickBlendAClearButton: document.querySelector("#quickBlendAClearButton"),
    quickBlendADropzone: document.querySelector("#quickBlendADropzone"),
    quickBlendAGrid: document.querySelector("#quickBlendAGrid"),
    quickBlendAInput: document.querySelector("#quickBlendAInput"),
    quickBlendBCount: document.querySelector("#quickBlendBCount"),
    quickBlendBClearButton: document.querySelector("#quickBlendBClearButton"),
    quickBlendBDropzone: document.querySelector("#quickBlendBDropzone"),
    quickBlendBGrid: document.querySelector("#quickBlendBGrid"),
    quickBlendBInput: document.querySelector("#quickBlendBInput"),
    quickBlendCCount: document.querySelector("#quickBlendCCount"),
    quickBlendCClearButton: document.querySelector("#quickBlendCClearButton"),
    quickBlendCDropzone: document.querySelector("#quickBlendCDropzone"),
    quickBlendCGrid: document.querySelector("#quickBlendCGrid"),
    quickBlendCInput: document.querySelector("#quickBlendCInput"),
    quickBlendDCount: document.querySelector("#quickBlendDCount"),
    quickBlendDClearButton: document.querySelector("#quickBlendDClearButton"),
    quickBlendDDropzone: document.querySelector("#quickBlendDDropzone"),
    quickBlendDGrid: document.querySelector("#quickBlendDGrid"),
    quickBlendDInput: document.querySelector("#quickBlendDInput"),
    quickBlendFeedback: document.querySelector("#quickBlendFeedback"),
    quickBlendGenerateButton: document.querySelector("#quickBlendGenerateButton"),
    quickBlendGenerationCanvas: document.querySelector("#quickBlendGenerationCanvas"),
    quickBlendGenerationDownloadButton: document.querySelector("#quickBlendGenerationDownloadButton"),
    quickBlendGenerationEmpty: document.querySelector("#quickBlendGenerationEmpty"),
    quickBlendGenerationImage: document.querySelector("#quickBlendGenerationImage"),
    quickBlendGenerationLightboxButton: document.querySelector("#quickBlendGenerationLightboxButton"),
    quickBlendGenerationMeta: document.querySelector("#quickBlendGenerationMeta"),
    quickBlendGenerationStrip: document.querySelector("#quickBlendGenerationStrip"),
    quickBlendPairCount: document.querySelector("#quickBlendPairCount"),
    quickBlendPairList: document.querySelector("#quickBlendPairList"),
    quickBlendPreviewStatus: document.querySelector("#quickBlendPreviewStatus"),
    quickBlendLayoutOrderInput: document.querySelector("#quickBlendLayoutOrderInput"),
    quickBlendPlacementShapeInput: document.querySelector("#quickBlendPlacementShapeInput"),
    quickBlendRatioGrid: document.querySelector("#quickBlendRatioGrid"),
    quickBlendRatioInput: document.querySelector("#quickBlendRatioInput"),
    quickBlendSizeInput: document.querySelector("#quickBlendSizeInput"),
    quickBlendThumbnailEmpty: document.querySelector("#quickBlendThumbnailEmpty"),
    reasoningEffortInput: document.querySelector("#reasoningEffortInput"),
    referencePreviewImage: document.querySelector("#referencePreviewImage"),
    referencePreviewViewer: document.querySelector("#referencePreviewViewer"),
    responsesModelInput: document.querySelector("#responsesModelInput"),
  };
}

function hasQuickBlendContext({ refs, state } = {}) {
  return Boolean(refs?.quickBlendAInput && refs?.quickBlendBInput && state?.quickBlend);
}

export function createQuickBlendController(options = {}) {
  const refs = options.refs || getQuickBlendRefs();
  const state = options.state;
  if (!hasQuickBlendContext({ refs, state })) {
    return null;
  }

  const {
    buildReferenceFingerprint,
    clearError = () => {},
    closeReferencePreview = () => {},
    compactErrorMessage = (message, fallback) => String(message || fallback || ""),
    createPreviewLoadingShellNodes,
    createReferenceAddCard,
    DEFAULT_QUICK_BLEND_RATIO = DEFAULT_QUICK_BLEND_RATIO_VALUE,
    formatCanvasLabel = (value) => String(value || ""),
    formatClock = (value) => String(value || ""),
    formatFilmstripSizeLabel = (item) => String(item?.size || ""),
    formatTime = formatClock,
    getDisplayPrompt = (item) => String(item?.prompt || ""),
    getGenerationReferenceFile,
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

  let quickBlendLoadingShellNodes = null;
  let quickBlendDragState = null;

function renderQuickBlendFeedback(message = "", kind = "") {
  refs.quickBlendFeedback.textContent = message ? compactErrorMessage(message, "快速溶图失败") : "";
  refs.quickBlendFeedback.dataset.state = kind;
}

function setQuickBlendFeedback(message = "", kind = "") {
  state.quickBlend.feedback = message;
  state.quickBlend.feedbackKind = kind;
  renderQuickBlendFeedback(message, kind);
}

function getQuickBlendGroupKey(group) {
  return QUICK_BLEND_GROUPS.includes(group) ? `${group}Files` : "aFiles";
}

function getQuickBlendGroupLabel(group) {
  return String(group || "a").trim().toUpperCase() || "A";
}

function getQuickBlendGroupFiles(group) {
  return state.quickBlend[getQuickBlendGroupKey(group)];
}

function getQuickBlendGroupInput(group) {
  const label = getQuickBlendGroupLabel(group);
  return refs[`quickBlend${label}Input`] || refs.quickBlendAInput;
}

function getQuickBlendGroupGrid(group) {
  const label = getQuickBlendGroupLabel(group);
  return refs[`quickBlend${label}Grid`] || refs.quickBlendAGrid;
}

function getQuickBlendGroupDropzone(group) {
  const label = getQuickBlendGroupLabel(group);
  return refs[`quickBlend${label}Dropzone`] || null;
}

function getQuickBlendGroupCountRef(group) {
  const label = getQuickBlendGroupLabel(group);
  return refs[`quickBlend${label}Count`] || null;
}

function getQuickBlendGroupClearButton(group) {
  const label = getQuickBlendGroupLabel(group);
  return refs[`quickBlend${label}ClearButton`] || null;
}

function getEnabledQuickBlendOptionalGroups() {
  return QUICK_BLEND_OPTIONAL_GROUPS.filter((group) => getQuickBlendGroupFiles(group).length > 0);
}

function getQuickBlendPairGroups() {
  return [...QUICK_BLEND_REQUIRED_GROUPS, ...getEnabledQuickBlendOptionalGroups()];
}

function createQuickBlendItem(group, file) {
  return {
    id: `quick-blend-${group}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    group,
    fingerprint: buildReferenceFingerprint(file),
    file,
    generationFile: file,
    generationFilePromise: null,
    generationCompressed: false,
    previewUrl: URL.createObjectURL(file),
  };
}

function getQuickBlendGenerationFile(item) {
  return item?.generationFile || item?.file || null;
}

function hasPendingQuickBlendGenerationFiles() {
  return QUICK_BLEND_GROUPS.flatMap((group) => getQuickBlendGroupFiles(group)).some((item) => item.generationFilePromise);
}

function startQuickBlendGenerationCompression(item) {
  if (!item?.file) {
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
      renderQuickBlendView();
    });

  renderQuickBlendView();
  return item.generationFilePromise;
}

async function ensureQuickBlendGenerationFilesReady() {
  const pending = QUICK_BLEND_GROUPS.flatMap((group) => getQuickBlendGroupFiles(group))
    .map((item) => item.generationFilePromise)
    .filter(Boolean);
  if (pending.length === 0) {
    return;
  }

  try {
    await Promise.allSettled(pending);
  } finally {
    renderQuickBlendView();
  }
}

function applyQuickBlendFiles(group, fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  const input = getQuickBlendGroupInput(group);
  if (incomingFiles.length === 0) {
    if (input) input.value = "";
    return;
  }

  const key = getQuickBlendGroupKey(group);
  const next = [...state.quickBlend[key]];
  let addedCount = 0;

  for (const file of incomingFiles) {
    const referenceItem = createQuickBlendItem(group, file);
    startQuickBlendGenerationCompression(referenceItem);
    next.push(referenceItem);
    addedCount += 1;
  }

  state.quickBlend[key] = next;
  if (input) input.value = "";
  if (addedCount > 0) {
    state.quickBlend.feedback = "";
    state.quickBlend.feedbackKind = "";
  }
  renderQuickBlendView();
}

function reorderQuickBlendFile(group, itemId, targetId = "", placement = "before") {
  const key = getQuickBlendGroupKey(group);
  const files = [...state.quickBlend[key]];
  const fromIndex = files.findIndex((item) => item.id === itemId);
  if (fromIndex < 0) {
    return false;
  }

  const [item] = files.splice(fromIndex, 1);
  let insertIndex = files.length;
  const targetIndex = targetId ? files.findIndex((entry) => entry.id === targetId) : -1;
  if (targetIndex >= 0) {
    insertIndex = placement === "after" ? targetIndex + 1 : targetIndex;
  }

  files.splice(Math.max(0, Math.min(insertIndex, files.length)), 0, item);
  state.quickBlend[key] = files;
  state.quickBlend.feedback = "";
  state.quickBlend.feedbackKind = "";
  renderQuickBlendView();
  return true;
}

function getQuickBlendDropIntent(event) {
  const card = event.target?.closest?.(".quick-blend-reference-card[data-quick-blend-id]");
  if (!card) {
    return { targetId: "", placement: "after" };
  }

  const rect = card.getBoundingClientRect();
  const placement = event.clientY > rect.top + rect.height * 0.65 || event.clientX > rect.left + rect.width / 2 ? "after" : "before";
  return { targetId: card.dataset.quickBlendId || "", placement };
}

function clearQuickBlendDragState() {
  quickBlendDragState = null;
  QUICK_BLEND_GROUPS.forEach((group) => getQuickBlendGroupGrid(group)?.classList.remove("is-dragover"));
}

function removeQuickBlendFile(group, itemId) {
  const key = getQuickBlendGroupKey(group);
  const target = state.quickBlend[key].find((item) => item.id === itemId);
  if (!target) {
    return;
  }

  if (state.quickBlendPreviewItem?.id === target.id) {
    closeReferencePreview();
  }

  revokeReferencePreview(target);
  state.quickBlend[key] = state.quickBlend[key].filter((item) => item.id !== itemId);
  const input = getQuickBlendGroupInput(group);
  if (input) input.value = "";
  state.quickBlend.feedback = "";
  state.quickBlend.feedbackKind = "";
  renderQuickBlendView();
}

function removeQuickBlendPair(pairIndex) {
  const normalizedIndex = Number(pairIndex);
  if (!Number.isInteger(normalizedIndex) || normalizedIndex < 0) {
    return false;
  }

  let removedAny = false;
  for (const group of QUICK_BLEND_GROUPS) {
    const key = getQuickBlendGroupKey(group);
    const files = state.quickBlend[key] || [];
    if (normalizedIndex >= files.length) {
      continue;
    }

    const next = [...files];
    const [removedItem] = next.splice(normalizedIndex, 1);
    state.quickBlend[key] = next;
    if (!removedItem) {
      continue;
    }

    removedAny = true;
    if (state.quickBlendPreviewItem?.id === removedItem.id) {
      closeReferencePreview();
    }
    revokeReferencePreview(removedItem);
    const input = getQuickBlendGroupInput(group);
    if (input) input.value = "";
  }

  if (!removedAny) {
    return false;
  }

  state.quickBlend.feedback = "";
  state.quickBlend.feedbackKind = "";
  renderQuickBlendView();
  return true;
}

function clearQuickBlendGroup(group) {
  const key = getQuickBlendGroupKey(group);
  const files = state.quickBlend[key] || [];
  if (files.length === 0) {
    const input = getQuickBlendGroupInput(group);
    if (input) input.value = "";
    return false;
  }

  let shouldClosePreview = false;
  for (const item of files) {
    if (state.quickBlendPreviewItem?.id === item.id) {
      shouldClosePreview = true;
    }
    revokeReferencePreview(item);
  }
  if (shouldClosePreview) {
    closeReferencePreview();
  }

  state.quickBlend[key] = [];
  const input = getQuickBlendGroupInput(group);
  if (input) input.value = "";
  state.quickBlend.feedback = "";
  state.quickBlend.feedbackKind = "";
  renderQuickBlendView();
  return true;
}

function openQuickBlendPreview(group, itemId) {
  const item = getQuickBlendGroupFiles(group).find((entry) => entry.id === itemId);
  if (!item?.previewUrl) {
    return;
  }

  closeReferencePreview();
  state.quickBlendPreviewItem = item;
  setReferencePreviewNavigationContext({
    items: getQuickBlendReferencePreviewEntries(),
    currentId: item.id,
  });
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}

function getQuickBlendReferencePreviewEntries() {
  return QUICK_BLEND_GROUPS.flatMap((group) => getQuickBlendGroupFiles(group)).filter((item) => item?.previewUrl);
}

function getQuickBlendPairs() {
  const maxCount = Math.max(state.quickBlend.aFiles.length, state.quickBlend.bFiles.length, state.quickBlend.cFiles.length, state.quickBlend.dFiles.length);
  return Array.from({ length: maxCount }, (_, index) => ({
    index,
    a: state.quickBlend.aFiles[index] || null,
    b: state.quickBlend.bFiles[index] || null,
    c: state.quickBlend.cFiles[index] || null,
    d: state.quickBlend.dFiles[index] || null,
  }));
}

function validateQuickBlendPairs() {
  const pairs = getQuickBlendPairs();
  if (state.quickBlend.aFiles.length === 0 && state.quickBlend.bFiles.length === 0) {
    return { ok: false, message: "请先上传产品图 / A 组和 B 组图片。", pairs };
  }
  if (state.quickBlend.aFiles.length === 0) {
    return { ok: false, message: "产品图 / A 组不能为空，请至少上传一张产品图。", pairs };
  }
  if (state.quickBlend.bFiles.length === 0) {
    return { ok: false, message: "B 组不能为空，请至少上传一张 B 图。", pairs };
  }
  if (state.quickBlend.aFiles.length !== state.quickBlend.bFiles.length) {
    return {
      ok: false,
      message: `产品图 / A 组和 B 组数量必须一致：当前产品图 ${state.quickBlend.aFiles.length} 张，B 组 ${state.quickBlend.bFiles.length} 张。`,
      pairs,
    };
  }
  for (const group of getEnabledQuickBlendOptionalGroups()) {
    const files = getQuickBlendGroupFiles(group);
    if (files.length !== state.quickBlend.aFiles.length) {
      return {
        ok: false,
        message: `${getQuickBlendGroupLabel(group)} 组数量必须与 A/B 一致：当前 A 组 ${state.quickBlend.aFiles.length} 张，${getQuickBlendGroupLabel(group)} 组 ${files.length} 张。`,
        pairs,
      };
    }
  }
  return { ok: true, message: `${pairs.length} 对图片已准备。`, pairs };
}

function normalizeQuickBlendLayoutOrderValue(value = "") {
  return String(value || "").trim() === "horizontal" ? "horizontal" : "vertical";
}

function normalizeQuickBlendPlacementShapeValue(value = "") {
  return String(value || "").trim() === "rectangle" ? "rectangle" : "square";
}

function syncQuickBlendLayoutOptions() {
  state.quickBlend.layoutOrder = normalizeQuickBlendLayoutOrderValue(refs.quickBlendLayoutOrderInput?.value || state.quickBlend.layoutOrder);
  state.quickBlend.placementShape = normalizeQuickBlendPlacementShapeValue(refs.quickBlendPlacementShapeInput?.value || state.quickBlend.placementShape);
  if (refs.quickBlendLayoutOrderInput) refs.quickBlendLayoutOrderInput.value = state.quickBlend.layoutOrder;
  if (refs.quickBlendPlacementShapeInput) refs.quickBlendPlacementShapeInput.value = state.quickBlend.placementShape;
}

function createQuickBlendJobs() {
  syncQuickBlendLayoutOptions();
  const ratioOption = getRatioOption(refs.quickBlendRatioInput?.value || DEFAULT_QUICK_BLEND_RATIO);
  const ratioValue = ratioOption?.value || DEFAULT_QUICK_BLEND_RATIO;
  const sizeSetting = normalizeSizeForSelectedRoute(ratioValue, refs.quickBlendSizeInput?.value || "auto");
  const size = resolveGenerationSizeForSelectedRoute(ratioOption, sizeSetting);
  const baseUrlValue = String(state.config?.baseUrl || refs.baseUrlInput?.value || "").trim();
  const responsesModelValue = String(state.config?.responsesModel || refs.responsesModelInput?.value || "gpt-5.4").trim();
  const outputFormatValue = refs.outputFormatInput?.value || state.config?.defaults?.format || "png";
  const reasoningEffortValue = refs.reasoningEffortInput?.value || state.config?.defaults?.reasoningEffort || "xhigh";

  return getQuickBlendPairs().filter((pair) => pair.a && pair.b).map((pair, index) => ({
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    mode: "quick-blend",
    prompt: `快速溶图 ${index + 1}`,
    ratio: ratioValue,
    ratioLabel: ratioOption?.label || DEFAULT_QUICK_BLEND_RATIO,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(outputFormatValue),
    baseUrl: baseUrlValue,
    responsesModel: responsesModelValue || "gpt-5.4",
    imageModel: "gpt-image-2",
    reasoningEffort: reasoningEffortValue,
    requestRetryCount: 0,
    quickBlendPairIndex: String(index + 1),
    quickBlendAImageName: pair.a.file.name,
    quickBlendBImageName: pair.b.file.name,
    quickBlendCImageName: pair.c?.file?.name || "",
    quickBlendDImageName: pair.d?.file?.name || "",
    quickBlendLayoutOrder: state.quickBlend.layoutOrder,
    quickBlendPlacementShape: state.quickBlend.placementShape,
    quickBlendAFile: getQuickBlendGenerationFile(pair.a),
    quickBlendBFile: getQuickBlendGenerationFile(pair.b),
    quickBlendCFile: getQuickBlendGenerationFile(pair.c),
    quickBlendDFile: getQuickBlendGenerationFile(pair.d),
    referenceFiles: [getQuickBlendGenerationFile(pair.a), getQuickBlendGenerationFile(pair.b), getQuickBlendGenerationFile(pair.c), getQuickBlendGenerationFile(pair.d)].filter(Boolean),
    hasReferenceImage: true,
    referenceImageName: pair.a.file.name,
    referenceImageNames: [pair.a.file.name, pair.b.file.name, pair.c?.file?.name, pair.d?.file?.name].filter(Boolean),
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: "等待排队",
    previewUrl: "",
  }));
}

function syncQuickBlendRatio(value) {
  const nextValue = getRatioOption(value)?.value || DEFAULT_QUICK_BLEND_RATIO;
  refs.quickBlendRatioInput.value = nextValue;
  renderQuickBlendRatioGrid();
  renderQuickBlendSizeOptions();
}

function renderQuickBlendRatioGrid() {
  renderRatioGrid(refs.quickBlendRatioGrid, refs.quickBlendRatioInput, syncQuickBlendRatio);
}

function renderQuickBlendSizeOptions() {
  renderSizeOptions(refs.quickBlendSizeInput, refs.quickBlendRatioInput);
}

function syncQuickBlendSize(value) {
  const ratioValue = refs.quickBlendRatioInput.value || DEFAULT_QUICK_BLEND_RATIO;
  refs.quickBlendSizeInput.value = normalizeSizeForSelectedRoute(ratioValue, value || "auto");
}

function renderQuickBlendPairList() {
  const pairs = getQuickBlendPairs();
  const pairGroups = getQuickBlendPairGroups();
  refs.quickBlendPairList.replaceChildren();
  refs.quickBlendPairCount.textContent = `${pairs.filter((pair) => pair.a && pair.b).length} 对`;

  if (pairs.length === 0) {
    const empty = document.createElement("div");
    empty.className = "reference-analysis-thumbnail-empty";
    empty.textContent = "上传产品图和 B 组图片后会按顺序显示配对。";
    refs.quickBlendPairList.appendChild(empty);
    return;
  }

  pairs.forEach((pair) => {
    const row = document.createElement("div");
    row.className = "quick-blend-pair-row";
    row.classList.toggle("is-missing", pairGroups.some((group) => !pair[group]));
    row.style.setProperty("--quick-blend-pair-groups", String(pairGroups.length));
    const aLabel = document.createElement("strong");
    aLabel.textContent = `A${pair.index + 1}`;
    const aName = document.createElement("span");
    aName.textContent = pair.a?.file?.name || "缺少 A 图";
    const bLabel = document.createElement("strong");
    bLabel.textContent = `B${pair.index + 1}`;
    const bName = document.createElement("span");
    bName.textContent = pair.b?.file?.name || "缺少 B 图";
    row.append(aLabel, aName, bLabel, bName);
    for (const group of pairGroups.filter((entry) => entry === "c" || entry === "d")) {
      const label = getQuickBlendGroupLabel(group);
      const groupLabel = document.createElement("strong");
      groupLabel.textContent = `${label}${pair.index + 1}`;
      const groupName = document.createElement("span");
      groupName.textContent = pair[group]?.file?.name || `缺少 ${label} 图`;
      row.append(groupLabel, groupName);
    }
    const removeButton = document.createElement("button");
    removeButton.type = "button";
    removeButton.className = "quick-blend-pair-remove";
    removeButton.dataset.quickBlendPairRemoveIndex = String(pair.index);
    removeButton.textContent = "x";
    removeButton.setAttribute("aria-label", `删除第 ${pair.index + 1} 对参考图`);
    removeButton.title = `删除第 ${pair.index + 1} 对`;
    removeButton.addEventListener("click", () => removeQuickBlendPair(pair.index));
    row.appendChild(removeButton);
    refs.quickBlendPairList.appendChild(row);
  });
}

function renderQuickBlendFileGrid(group) {
  const files = getQuickBlendGroupFiles(group);
  const grid = getQuickBlendGroupGrid(group);
  if (!grid) {
    return;
  }

  grid.replaceChildren();
  grid.dataset.quickBlendGroup = group;
  grid.classList.toggle("hidden", files.length === 0);

  if (files.length === 0) {
    return;
  }

  files.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "reference-card quick-blend-reference-card";
    card.draggable = true;
    card.dataset.quickBlendGroup = group;
    card.dataset.quickBlendId = item.id;
    card.addEventListener("dragstart", (event) => {
      quickBlendDragState = { group, itemId: item.id };
      card.classList.add("is-dragging");
      event.dataTransfer.effectAllowed = "move";
      event.dataTransfer.setData("text/plain", item.id);
    });
    card.addEventListener("dragend", () => {
      card.classList.remove("is-dragging");
      clearQuickBlendDragState();
    });

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "reference-preview-button";
    previewButton.draggable = false;
    previewButton.dataset.quickBlendPreviewGroup = group;
    previewButton.dataset.quickBlendPreviewId = item.id;
    previewButton.setAttribute("aria-label", `放大查看 ${getQuickBlendGroupLabel(group)}${index + 1}`);

    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.draggable = false;
    image.alt = `${getQuickBlendGroupLabel(group)}${index + 1} 预览`;
    previewButton.appendChild(image);
    card.appendChild(previewButton);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", `移除 ${getQuickBlendGroupLabel(group)}${index + 1}`);
    remove.addEventListener("click", () => removeQuickBlendFile(group, item.id));
    card.appendChild(remove);

    grid.appendChild(card);
  });

  grid.appendChild(
    createReferenceAddCard({
      input: getQuickBlendGroupInput(group),
      label: `继续上传 ${getQuickBlendGroupLabel(group)} 组图片`,
      onFiles: (fileList) => applyQuickBlendFiles(group, fileList),
    }),
  );

  while (grid.children.length < QUICK_BLEND_RESERVED_SLOT_COUNT) {
    const placeholder = document.createElement("div");
    placeholder.className = "reference-card quick-blend-placeholder-card";
    placeholder.setAttribute("aria-hidden", "true");
    grid.appendChild(placeholder);
  }
}

function syncQuickBlendGroupClearButton(group) {
  const files = getQuickBlendGroupFiles(group);
  const button = getQuickBlendGroupClearButton(group);
  if (!button) {
    return;
  }

  button.disabled = files.length === 0;
  button.title = files.length > 0 ? `清空 ${getQuickBlendGroupLabel(group)} 组图片` : `${getQuickBlendGroupLabel(group)} 组暂无图片`;
}

function renderQuickBlendSources() {
  refs.quickBlendACount.textContent = `${state.quickBlend.aFiles.length} 张`;
  refs.quickBlendBCount.textContent = `${state.quickBlend.bFiles.length} 张`;
  if (refs.quickBlendCCount) refs.quickBlendCCount.textContent = `${state.quickBlend.cFiles.length} 张`;
  if (refs.quickBlendDCount) refs.quickBlendDCount.textContent = `${state.quickBlend.dFiles.length} 张`;
  syncQuickBlendGroupClearButton("a");
  syncQuickBlendGroupClearButton("b");
  syncQuickBlendGroupClearButton("c");
  syncQuickBlendGroupClearButton("d");
  syncReferenceDropzoneCompact(refs.quickBlendADropzone, state.quickBlend.aFiles.length > 0);
  syncReferenceDropzoneCompact(refs.quickBlendBDropzone, state.quickBlend.bFiles.length > 0);
  syncReferenceDropzoneCompact(refs.quickBlendCDropzone, state.quickBlend.cFiles.length > 0);
  syncReferenceDropzoneCompact(refs.quickBlendDDropzone, state.quickBlend.dFiles.length > 0);
  renderQuickBlendFileGrid("a");
  renderQuickBlendFileGrid("b");
  renderQuickBlendFileGrid("c");
  renderQuickBlendFileGrid("d");
}

function renderQuickBlendView() {
  syncQuickBlendLayoutOptions();
  renderQuickBlendRatioGrid();
  renderQuickBlendSizeOptions();
  renderQuickBlendSources();
  renderQuickBlendPairList();
  renderQuickBlendGenerationPreview();
  const validation = validateQuickBlendPairs();
  const preparingReference = hasPendingQuickBlendGenerationFiles();
  refs.quickBlendGenerateButton.disabled = !validation.ok || preparingReference;
  refs.quickBlendGenerateButton.textContent = preparingReference
    ? "处理参考图..."
    : getQueuedJobCount() > 0
      ? "继续生成"
      : "开始快速溶图";
  const hasStoredFeedback = Boolean(state.quickBlend.feedback);
  const message = hasStoredFeedback ? state.quickBlend.feedback : preparingReference ? "正在处理上传图片..." : validation.message;
  const fallbackKind = validation.ok ? "success" : "";
  renderQuickBlendFeedback(message, hasStoredFeedback ? state.quickBlend.feedbackKind || fallbackKind : fallbackKind);
}

function getQuickBlendGenerationItemByKey(key) {
  const normalizedKey = String(key || "");
  if (normalizedKey.startsWith("job:")) {
    return state.jobs.find((job) => job.id === normalizedKey.slice(4) && job.mode === "quick-blend") || null;
  }

  if (normalizedKey.startsWith("file:")) {
    return state.quickBlend.generationItems[normalizedKey] || state.gallery.find((item) => item.filename === normalizedKey.slice(5)) || null;
  }

  return null;
}

function storeQuickBlendGenerationItem(item) {
  const filename = String(item?.filename || "").trim();
  if (!filename) {
    return "";
  }

  const key = makeGalleryPreviewKey(filename);
  const current = state.quickBlend.generationItems[key] || {};
  state.quickBlend.generationItems[key] = {
    ...current,
    ...item,
    mode: "quick-blend",
    assetKind: item.assetKind || "quick-blend",
  };
  return key;
}

function registerQuickBlendGenerationKey(key) {
  const nextKey = String(key || "").trim();
  if (!nextKey) {
    return;
  }

  state.quickBlend.generationKeys = [
    nextKey,
    ...state.quickBlend.generationKeys.filter((entry) => entry !== nextKey),
  ];
}

function registerQuickBlendGenerationKeys(keys = []) {
  const nextKeys = [];
  const seen = new Set();
  for (const key of keys) {
    const nextKey = String(key || "").trim();
    if (!nextKey || seen.has(nextKey)) {
      continue;
    }
    seen.add(nextKey);
    nextKeys.push(nextKey);
  }
  if (nextKeys.length === 0) {
    return;
  }

  state.quickBlend.generationKeys = [
    ...nextKeys,
    ...state.quickBlend.generationKeys.filter((entry) => !seen.has(entry)),
  ];
}

function replaceQuickBlendGenerationKey(oldKey, newKey) {
  const currentKey = String(oldKey || "").trim();
  const nextKey = String(newKey || "").trim();
  if (!nextKey) {
    return;
  }

  const keys = state.quickBlend.generationKeys.filter((entry) => entry !== nextKey);
  const index = keys.indexOf(currentKey);
  if (index >= 0) {
    keys[index] = nextKey;
    state.quickBlend.generationKeys = keys;
    return;
  }

  if (state.quickBlend.generationKeys.includes(nextKey)) {
    return;
  }

  state.quickBlend.generationKeys = [nextKey, ...keys.filter((entry) => entry !== currentKey)];
}

function removeQuickBlendGenerationKey(key) {
  const targetKey = String(key || "").trim();
  if (!targetKey) {
    return;
  }

  state.quickBlend.generationKeys = state.quickBlend.generationKeys.filter((entry) => entry !== targetKey);
  if (state.quickBlend.previewKey === targetKey) {
    state.quickBlend.previewKey = "";
  }
}

function getQuickBlendGenerationEntries() {
  const entries = [];
  const seen = new Set();
  const addKey = (key) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || seen.has(normalizedKey)) {
      return;
    }

    const item = getQuickBlendGenerationItemByKey(normalizedKey);
    if (!item) {
      return;
    }

    seen.add(normalizedKey);
    entries.push({ key: normalizedKey, item });
  };

  state.quickBlend.generationKeys.forEach(addKey);
  sortGalleryItemsByCreatedAtDesc(state.jobs)
    .filter((job) => job.mode === "quick-blend")
    .forEach((job) => addKey(makeJobPreviewKey(job.id)));
  sortGalleryItemsByCreatedAtDesc(state.gallery)
    .filter(
      (item) =>
        item.mode === "quick-blend" ||
        item.generationMode === "quick-blend" ||
        item.assetKind === "quick-blend",
    )
    .forEach((item) => addKey(makeGalleryPreviewKey(item.filename)));

  return entries.sort((left, right) =>
    String(right.item?.createdAt || "").localeCompare(String(left.item?.createdAt || "")),
  );
}

function syncQuickBlendGenerationPreviewKey() {
  if (getQuickBlendGenerationItemByKey(state.quickBlend.previewKey || "")) {
    return;
  }

  const fallback = getQuickBlendGenerationEntries()[0];
  state.quickBlend.previewKey = fallback?.key || "";
}

function getQuickBlendGenerationPreviewItem() {
  syncQuickBlendGenerationPreviewKey();
  return getQuickBlendGenerationItemByKey(state.quickBlend.previewKey || "");
}

function setQuickBlendGenerationPreviewKey(key) {
  const nextKey = String(key || "").trim();
  if (!getQuickBlendGenerationItemByKey(nextKey)) {
    return;
  }

  state.quickBlend.previewKey = nextKey;
  renderQuickBlendGenerationPreview();
}

function setQuickBlendGenerationPlaceholderText(message, hidden = false) {
  quickBlendLoadingShellNodes = null;
  refs.quickBlendGenerationEmpty.className = "quick-blend-generation-empty preview-placeholder";
  refs.quickBlendGenerationEmpty.classList.toggle("hidden", hidden);
  refs.quickBlendGenerationEmpty.replaceChildren();
  if (!message) {
    return;
  }

  const title = document.createElement("h3");
  title.textContent = message;
  refs.quickBlendGenerationEmpty.appendChild(title);

  const detail = document.createElement("span");
  detail.textContent = "A/B 配对提交后，最新生成图会显示在这里。";
  refs.quickBlendGenerationEmpty.appendChild(detail);
}

function renderQuickBlendGenerationLoading(item) {
  const placeholderState = {
    ...getPreviewPlaceholderState({
      item,
      imageUrl: "",
      prompt: item ? getDisplayPrompt(item) : "",
      runningCount: state.jobs.length,
      runningItems: state.jobs,
      maxConcurrentTasks: getMaxParallelJobCount(),
    }),
    eyebrow: "Quick Blend",
    title: "快速溶图生成中",
    detail: item?.statusText || "正在生成上下排列的 A/B 主体图",
  };

  if (
    !quickBlendLoadingShellNodes ||
    !shouldReusePreviewLoadingShell(quickBlendLoadingShellNodes.state || {}, placeholderState)
  ) {
    quickBlendLoadingShellNodes = createPreviewLoadingShellNodes();
  }

  updatePreviewLoadingShell(quickBlendLoadingShellNodes, placeholderState);
  refs.quickBlendGenerationEmpty.className = "quick-blend-generation-empty preview-placeholder preview-placeholder-loading";
  refs.quickBlendGenerationEmpty.classList.remove("hidden");

  if (
    refs.quickBlendGenerationEmpty.firstChild !== quickBlendLoadingShellNodes.eyebrow ||
    refs.quickBlendGenerationEmpty.lastChild !== quickBlendLoadingShellNodes.shell
  ) {
    refs.quickBlendGenerationEmpty.replaceChildren(
      quickBlendLoadingShellNodes.eyebrow,
      quickBlendLoadingShellNodes.shell,
    );
  }
}

function openQuickBlendGeneratedPreview() {
  const item = getQuickBlendGenerationPreviewItem();
  if (item && getImageUrl(item)) {
    openLightbox(item, {
      items: getQuickBlendGenerationEntries().map((entry) => entry.item),
    });
  }
}

function renderQuickBlendGenerationPreview() {
  const item = getQuickBlendGenerationPreviewItem();
  const imageUrl = item ? getImageUrl(item) : "";
  const isRunning = Boolean(item?.isRunning || (item?.started && !item?.filename));

  refs.quickBlendGenerationCanvas.classList.toggle("has-image", Boolean(imageUrl));
  refs.quickBlendGenerationCanvas.classList.toggle("is-running", isRunning && !imageUrl);
  if (imageUrl) {
    refs.quickBlendGenerationCanvas.setAttribute("role", "button");
    refs.quickBlendGenerationCanvas.setAttribute("aria-label", "查看快速溶图生成图");
    refs.quickBlendGenerationCanvas.tabIndex = 0;
  } else {
    refs.quickBlendGenerationCanvas.removeAttribute("role");
    refs.quickBlendGenerationCanvas.removeAttribute("aria-label");
    refs.quickBlendGenerationCanvas.tabIndex = -1;
  }

  if (imageUrl) {
    setQuickBlendGenerationPlaceholderText("", true);
  } else if (isRunning) {
    renderQuickBlendGenerationLoading(item);
  } else {
    setQuickBlendGenerationPlaceholderText("快速溶图结果会显示在这里");
  }

  if (imageUrl) {
    refs.quickBlendGenerationImage.src = imageUrl;
    refs.quickBlendGenerationImage.alt = getDisplayPrompt(item) || "快速溶图生成结果";
    refs.quickBlendGenerationImage.classList.add("is-mounted", "is-visible");
    refs.quickBlendGenerationDownloadButton.href = imageUrl;
    refs.quickBlendGenerationDownloadButton.download = item.filename || "quick-blend.png";
    refs.quickBlendGenerationDownloadButton.classList.remove("disabled");
    refs.quickBlendGenerationDownloadButton.setAttribute("aria-disabled", "false");
    refs.quickBlendGenerationLightboxButton.disabled = false;
  } else {
    refs.quickBlendGenerationImage.removeAttribute("src");
    refs.quickBlendGenerationImage.classList.remove("is-mounted", "is-visible");
    refs.quickBlendGenerationDownloadButton.href = "#";
    refs.quickBlendGenerationDownloadButton.removeAttribute("download");
    refs.quickBlendGenerationDownloadButton.classList.add("disabled");
    refs.quickBlendGenerationDownloadButton.setAttribute("aria-disabled", "true");
    refs.quickBlendGenerationLightboxButton.disabled = true;
  }

  const pairLabel = item?.quickBlendPairIndex ? `第 ${item.quickBlendPairIndex} 对` : "";
  refs.quickBlendGenerationMeta.textContent = item
    ? [formatTime(item.createdAt), pairLabel, formatCanvasLabel(item.size), item.statusText || ""].filter(Boolean).join(" · ")
    : "等待生成";
  refs.quickBlendPreviewStatus.textContent = item ? imageUrl ? "已生成" : item.statusText || "生成中" : "等待任务";
  renderQuickBlendGenerationStrip();
}

function renderQuickBlendGenerationStrip() {
  const entries = getQuickBlendGenerationEntries();
  refs.quickBlendGenerationStrip.replaceChildren();
  refs.quickBlendGenerationStrip.classList.toggle("hidden", entries.length === 0);
  refs.quickBlendThumbnailEmpty.classList.toggle("hidden", entries.length > 0);

  entries.forEach(({ key, item }, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filmstrip-item quick-blend-generation-thumb";
    button.dataset.quickBlendGenerationKey = key;
    button.setAttribute("aria-pressed", String(key === state.quickBlend.previewKey));
    button.title = `切换到第 ${index + 1} 张快速溶图结果`;
    button.classList.toggle("active", key === state.quickBlend.previewKey);
    button.classList.toggle("is-running", Boolean(item?.isRunning || (item?.started && !item?.filename)));

    const imageUrl = getImageUrl(item);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = getDisplayPrompt(item) || "快速溶图结果";
      image.loading = "lazy";
      button.appendChild(image);
    } else {
      const ghost = document.createElement("div");
      ghost.className = "filmstrip-ghost";
      if (item?.isRunning || item?.started) {
        const loader = document.createElement("div");
        loader.className = "quick-blend-thumb-loader";
        loader.setAttribute("aria-hidden", "true");
        const label = document.createElement("span");
        label.textContent = formatLoadingThumbnailStatusLabel(item);
        loader.appendChild(label);
        ghost.appendChild(loader);
        ghost.setAttribute("aria-label", label.textContent);
      } else {
        ghost.textContent = "等待";
      }
      button.appendChild(ghost);
    }

    const caption = document.createElement("span");
    caption.textContent = formatClock(item?.createdAt) || item?.statusText || formatFilmstripSizeLabel(item);
    button.appendChild(caption);

    const shell = document.createElement("div");
    shell.className = "filmstrip-entry";
    shell.appendChild(button);
    refs.quickBlendGenerationStrip.appendChild(shell);
  });
}

async function preserveQuickBlendGenerationItemForDelete(item) {
  if (!item?.filename) {
    return;
  }

  const key = makeGalleryPreviewKey(item.filename);
  const isTrackedQuickBlendItem =
    item.mode === "quick-blend" ||
    item.generationMode === "quick-blend" ||
    item.assetKind === "quick-blend" ||
    state.quickBlend.generationKeys.includes(key) ||
    Boolean(state.quickBlend.generationItems[key]);
  if (!isTrackedQuickBlendItem) {
    return;
  }

  const imageUrl = getImageUrl(item);
  if (!imageUrl || String(imageUrl).startsWith("data:image/")) {
    storeQuickBlendGenerationItem(item);
    return;
  }

  try {
    const dataUrl = await fetchServerImageAsDataUrl(imageUrl);
    if (dataUrl) {
      storeQuickBlendGenerationItem({
        ...item,
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
      });
      return;
    }
  } catch (_error) {
    // Keep existing metadata if the image cannot be copied before deletion.
  }

  storeQuickBlendGenerationItem(item);
}

async function startQuickBlendGeneration() {
  clearError();
  const validation = validateQuickBlendPairs();
  if (!validation.ok) {
    state.quickBlend.feedback = validation.message;
    renderQuickBlendView();
    return;
  }

  await ensureQuickBlendGenerationFilesReady();
  const readyValidation = validateQuickBlendPairs();
  if (!readyValidation.ok) {
    state.quickBlend.feedback = readyValidation.message;
    renderQuickBlendView();
    return;
  }
  const jobs = createQuickBlendJobs();
  if (jobs.length === 0) {
    state.quickBlend.feedback = "没有可提交的 A/B 配对。";
    renderQuickBlendView();
    return;
  }

  registerQuickBlendGenerationKeys(jobs.map((job) => makeJobPreviewKey(job.id)));
  state.jobs.unshift(...jobs);
  state.quickBlend.previewKey = makeJobPreviewKey(jobs[0].id);
  jobs.forEach((job) => recordJobQueued(job));
  state.quickBlend.feedback = `已提交 ${jobs.length} 个快速溶图任务。`;
  renderAll();
  setActiveView("quick-blend");
  scheduleGenerationQueue();
}

  function bindQuickBlendEvents() {
    refs.quickBlendSizeInput?.addEventListener("change", (event) => {
      syncQuickBlendSize(event.target.value);
    });
    refs.quickBlendLayoutOrderInput?.addEventListener("change", () => {
      syncQuickBlendLayoutOptions();
      renderQuickBlendView();
    });
    refs.quickBlendPlacementShapeInput?.addEventListener("change", () => {
      syncQuickBlendLayoutOptions();
      renderQuickBlendView();
    });
    refs.quickBlendAInput?.addEventListener("change", (event) => {
      applyQuickBlendFiles("a", event.target.files);
    });
    refs.quickBlendBInput?.addEventListener("change", (event) => {
      applyQuickBlendFiles("b", event.target.files);
    });
    refs.quickBlendCInput?.addEventListener("change", (event) => {
      applyQuickBlendFiles("c", event.target.files);
    });
    refs.quickBlendDInput?.addEventListener("change", (event) => {
      applyQuickBlendFiles("d", event.target.files);
    });
    refs.quickBlendAClearButton?.addEventListener("click", () => clearQuickBlendGroup("a"));
    refs.quickBlendBClearButton?.addEventListener("click", () => clearQuickBlendGroup("b"));
    refs.quickBlendCClearButton?.addEventListener("click", () => clearQuickBlendGroup("c"));
    refs.quickBlendDClearButton?.addEventListener("click", () => clearQuickBlendGroup("d"));
    refs.quickBlendADropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      refs.quickBlendADropzone.classList.add("dragover");
    });
    refs.quickBlendADropzone?.addEventListener("dragleave", () => {
      refs.quickBlendADropzone.classList.remove("dragover");
    });
    refs.quickBlendADropzone?.addEventListener("drop", (event) => {
      event.preventDefault();
      refs.quickBlendADropzone.classList.remove("dragover");
      applyQuickBlendFiles("a", event.dataTransfer?.files);
    });
    refs.quickBlendBDropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      refs.quickBlendBDropzone.classList.add("dragover");
    });
    refs.quickBlendBDropzone?.addEventListener("dragleave", () => {
      refs.quickBlendBDropzone.classList.remove("dragover");
    });
    refs.quickBlendBDropzone?.addEventListener("drop", (event) => {
      event.preventDefault();
      refs.quickBlendBDropzone.classList.remove("dragover");
      applyQuickBlendFiles("b", event.dataTransfer?.files);
    });
    refs.quickBlendCDropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      refs.quickBlendCDropzone.classList.add("dragover");
    });
    refs.quickBlendCDropzone?.addEventListener("dragleave", () => {
      refs.quickBlendCDropzone.classList.remove("dragover");
    });
    refs.quickBlendCDropzone?.addEventListener("drop", (event) => {
      event.preventDefault();
      refs.quickBlendCDropzone.classList.remove("dragover");
      applyQuickBlendFiles("c", event.dataTransfer?.files);
    });
    refs.quickBlendDDropzone?.addEventListener("dragover", (event) => {
      event.preventDefault();
      refs.quickBlendDDropzone.classList.add("dragover");
    });
    refs.quickBlendDDropzone?.addEventListener("dragleave", () => {
      refs.quickBlendDDropzone.classList.remove("dragover");
    });
    refs.quickBlendDDropzone?.addEventListener("drop", (event) => {
      event.preventDefault();
      refs.quickBlendDDropzone.classList.remove("dragover");
      applyQuickBlendFiles("d", event.dataTransfer?.files);
    });
    refs.quickBlendAGrid?.addEventListener("click", (event) => {
      const target = event.target.closest("[data-quick-blend-preview-id]");
      if (!target) return;
      openQuickBlendPreview(target.dataset.quickBlendPreviewGroup, target.dataset.quickBlendPreviewId);
    });
    refs.quickBlendBGrid?.addEventListener("click", (event) => {
      const target = event.target.closest("[data-quick-blend-preview-id]");
      if (!target) return;
      openQuickBlendPreview(target.dataset.quickBlendPreviewGroup, target.dataset.quickBlendPreviewId);
    });
    refs.quickBlendCGrid?.addEventListener("click", (event) => {
      const target = event.target.closest("[data-quick-blend-preview-id]");
      if (!target) return;
      openQuickBlendPreview(target.dataset.quickBlendPreviewGroup, target.dataset.quickBlendPreviewId);
    });
    refs.quickBlendDGrid?.addEventListener("click", (event) => {
      const target = event.target.closest("[data-quick-blend-preview-id]");
      if (!target) return;
      openQuickBlendPreview(target.dataset.quickBlendPreviewGroup, target.dataset.quickBlendPreviewId);
    });
    refs.quickBlendGenerateButton?.addEventListener("click", () => {
      startQuickBlendGeneration().catch((error) => {
        const message = error instanceof Error ? error.message : String(error);
        setQuickBlendFeedback(message, "error");
        showError(message);
      });
    });
    refs.quickBlendGenerationLightboxButton?.addEventListener("click", openQuickBlendGeneratedPreview);
    refs.quickBlendGenerationCanvas?.addEventListener("click", openQuickBlendGeneratedPreview);
    refs.quickBlendGenerationCanvas?.addEventListener("keydown", (event) => {
      const shouldOpenPreview = event.key === "Enter" || event.key === " ";
      if (!shouldOpenPreview) return;
      const item = getQuickBlendGenerationPreviewItem();
      if (!item || !getImageUrl(item)) return;
      event.preventDefault();
      openQuickBlendGeneratedPreview();
    });
    refs.quickBlendGenerationStrip?.addEventListener("click", (event) => {
      const target = event.target.closest("[data-quick-blend-generation-key]");
      if (!target) return;
      setQuickBlendGenerationPreviewKey(target.dataset.quickBlendGenerationKey);
    });
    [refs.quickBlendAGrid, refs.quickBlendBGrid, refs.quickBlendCGrid, refs.quickBlendDGrid].forEach((grid) => {
      grid?.addEventListener("dragover", (event) => {
        if (!quickBlendDragState || quickBlendDragState.group !== grid.dataset.quickBlendGroup) return;
        event.preventDefault();
        event.dataTransfer.dropEffect = "move";
        grid.classList.add("is-dragover");
      });
      grid?.addEventListener("dragleave", (event) => {
        if (!grid.contains(event.relatedTarget)) {
          grid.classList.remove("is-dragover");
        }
      });
      grid?.addEventListener("drop", (event) => {
        if (!quickBlendDragState || quickBlendDragState.group !== grid.dataset.quickBlendGroup) return;
        event.preventDefault();
        const { targetId, placement } = getQuickBlendDropIntent(event);
        reorderQuickBlendFile(quickBlendDragState.group, quickBlendDragState.itemId, targetId, placement);
        clearQuickBlendDragState();
      });
    });
  }

  bindQuickBlendEvents();

  return {
    preserveQuickBlendGenerationItemForDelete,
    removeQuickBlendGenerationKey,
    renderQuickBlendView,
    replaceQuickBlendGenerationKey,
    setQuickBlendFeedback,
    storeQuickBlendGenerationItem,
  };
}

export function mountView(options = {}) {
  const controller = createQuickBlendController(options);
  if (!controller) {
    return createViewRendererController({
      ...options,
      view: options.view || "quick-blend",
      rendererKey: "quickBlend",
    });
  }

  return {
    view: options.view || "quick-blend",
    loaded: true,
    renderView() {
      controller.renderQuickBlendView();
      return true;
    },
    ...controller,
  };
}
