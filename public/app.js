import {
  buildParameterText,
  formatImageModelLabel,
  formatRecentOutputMeta,
} from "/lib/studio-formatters.mjs";
import { getPreviewPlaceholderState } from "/lib/preview-placeholder-state.mjs";
import {
  buildGalleryReferenceFilterOptions,
  buildGallerySections,
  buildGallerySizeFilterOptions,
  buildGalleryTimeFilterOptions,
  distributeGalleryItemsIntoColumns,
  filterGalleryItems,
  getGalleryLayoutModeForWidth,
  getRecentGalleryItems,
  normalizeGalleryFilters,
  paginateGallerySections,
  sortGalleryItemsByCreatedAtDesc,
} from "/lib/gallery-organizer.mjs";
import {
  buildGalleryMetadataCacheEntry,
  collectGalleryMetadataRepairPatch,
  mergeGalleryItemWithCachedMetadata,
  pruneGalleryMetadataCache,
} from "/lib/gallery-metadata-recovery.mjs";
import {
  getDefaultGenerationSize,
  getGenerationSizeOptions,
  normalizeGenerationSize,
} from "/lib/generation-size-options.mjs?v=20260504-vercel-static-lib-1";
import {
  getOutputFormatOptions,
  normalizeOutputFormat,
} from "/lib/output-format-options.mjs?v=20260504-vercel-static-lib-1";
import {
  getPreviewLoadingShellTheme,
  shouldReusePreviewLoadingShell,
} from "/lib/preview-loading-shell.mjs";
import {
  getGenerationRequestRetryPlan,
  isGenerationRequestRetryMessage,
} from "/lib/generation-request-retry.mjs";
import {
  cancelQueuedGenerationJob,
  isQueuedGenerationJob,
  selectNextQueuedGenerationJobs,
} from "/lib/generation-queue.mjs?v=20260504-vercel-static-lib-1";
import {
  sortGenerationActivityFeed,
  upsertGenerationActivityEntry,
} from "/lib/generation-activity-feed.mjs?v=20260504-vercel-static-lib-1";
import { getStudioDensitySettings, getStudioLayoutMode, ALL_VARIABLE_NAMES } from "/lib/studio-density.mjs?v=20260504-vercel-static-lib-1";
import { injectSpeedInsights } from "/lib/speed-insights.mjs";

const SURPRISE_PROMPTS = [
  {
    name: "清晨通勤",
    prompt: "生成一张清晨城市通勤生活照，年轻上班族手拿咖啡走出地铁站，晨光穿过街边树影，画面自然真实，轻微运动模糊，适合生活方式摄影。",
  },
  {
    name: "家庭早餐",
    prompt: "生成一张温暖家庭早餐场景，木质餐桌上有吐司、煎蛋、牛奶和水果，家人围坐聊天，窗外柔和日光洒入，构图干净，有真实居家氛围。",
  },
  {
    name: "居家阅读",
    prompt: "生成一张安静居家阅读画面，人物坐在窗边单人椅上看书，旁边有茶杯和落地灯，浅色窗帘、柔和阴影，画面舒适松弛，细节清晰。",
  },
  {
    name: "厨房做饭",
    prompt: "生成一张周末厨房做饭场景，人物在明亮厨房里切菜备餐，台面摆放新鲜蔬菜和锅具，暖白色顶光，生活化抓拍视角，干净有烟火气。",
  },
  {
    name: "超市采购",
    prompt: "生成一张日常超市采购场景，人物推着购物车经过蔬果区，货架陈列丰富但不杂乱，室内灯光明亮，色彩自然，像真实生活纪录照片。",
  },
  {
    name: "午后办公",
    prompt: "生成一张午后居家办公场景，人物坐在整洁书桌前使用笔记本电脑，桌上有记事本、耳机和半杯咖啡，窗边自然光，画面专注而安静。",
  },
  {
    name: "健身运动",
    prompt: "生成一张清爽健身运动场景，人物在公园步道上做拉伸，穿着简洁运动服，背景有晨间草地和远处城市轮廓，光线清透，健康积极。",
  },
  {
    name: "朋友聚会",
    prompt: "生成一张朋友小聚生活场景，几位朋友围坐在餐桌边分享披萨和饮料，表情自然放松，暖色室内灯光，桌面细节丰富，氛围亲密真实。",
  },
  {
    name: "亲子手作",
    prompt: "生成一张亲子手作场景，家长和孩子在桌前一起制作彩色纸艺，桌上有剪刀、彩纸和胶水，画面明亮安全，表情专注，充满家庭陪伴感。",
  },
  {
    name: "夜晚学习",
    prompt: "生成一张夜晚学习场景，人物坐在书桌前整理笔记，台灯形成温暖光区，窗外是安静夜色，桌面有书本和便签，整体专注、平静、有秩序。",
  },
];

const REASONING_LABELS = {
  low: "低",
  medium: "中",
  high: "高",
  xhigh: "超高",
};

const DEFAULT_LIMITS = {
  maxConcurrentTasksPerSession: 20,
  maxParallelTasksPerSession: 4,
  maxReferenceImages: 6,
};
const PROMPT_TEMPLATE_STORAGE_KEY = "image-studio-prompt-templates-v2";
const DEFAULT_PROMPT_TEMPLATES = SURPRISE_PROMPTS.map((template, index) => ({
  id: `default-template-${index + 1}`,
  name: template.name,
  prompt: template.prompt,
}));

const DEFAULT_GALLERY_CONTROLS = {
  query: "",
  window: "all",
  date: "",
  size: "all",
  reference: "all",
};

const GALLERY_COLUMN_PRESETS = [6, 9, 12, 15, 18];
const DEFAULT_GALLERY_COLUMN_PRESET = 12;
const DEFAULT_REASONING_EFFORTS = ["low", "medium", "high", "xhigh"];
const DEFAULT_UI_RATIO = "1:1";
const DEFAULT_UI_RATIO_LABEL = "方形 1:1";
const GALLERY_METADATA_CACHE_KEY = "image-studio-gallery-metadata-cache-v2";
const GENERATION_ACTIVITY_STORAGE_KEY = "image-studio-generation-activity-v1";
const BROWSER_CONFIG_STORAGE_KEY = "image-studio-browser-config-v1";
const THEME_STORAGE_KEY = "image-studio-ui-theme-v1";
const BROWSER_IMAGE_CACHE_INDEX_KEY = "image-studio-browser-image-cache-index-v1";
const BROWSER_IMAGE_CACHE_DB_NAME = "image-studio-browser-image-cache-v1";
const BROWSER_IMAGE_CACHE_STORE_NAME = "generated-images";
const GENERATION_TASK_POLL_INTERVAL_MS = 2500;
const GENERATION_TASK_STATUS_LABELS = {
  running: "生成中",
  completed: "生成完成",
  error: "错误",
};
const GENERATION_TASK_TIMELINE_STATUS = {
  running: "active",
  completed: "done",
  error: "error",
};
const GALLERY_WINDOW_LABELS = {
  today: "今天",
  recent: "近 7 天",
  older: "更早",
};
const GALLERY_REFERENCE_LABELS = {
  "with-reference": "带参考图",
  "without-reference": "无参考图",
};
const STACKED_STUDIO_LAYOUT_MODES = new Set(["stacked", "tablet", "mobile"]);
const PPT_SOURCE_MODES = new Set(["upload", "text", "topic"]);

let studioHeightSyncFrame = 0;
let studioHeightObserver = null;
let studioDensitySyncFrame = 0;
let galleryPanelHeightSyncFrame = 0;
let galleryPanelHeightObserver = null;
let galleryScrollSyncFrame = 0;
let galleryScrollObserver = null;
let generationTaskPollTimer = 0;
let promptCopyFeedbackTimer = 0;
let previewLoadingShellNodes = null;
const galleryScrollDrag = {
  active: false,
  pointerId: null,
  startOffset: 0,
  startY: 0,
};

const state = {
  activeView: "studio",
  activityFeed: [],
  aspectRatios: [],
  clientSessionId: "",
  config: null,
  gallery: [],
  galleryMetadataCache: {},
  galleryControls: { ...DEFAULT_GALLERY_CONTROLS },
  galleryHistoryPage: 0,
  galleryColumnPreset: DEFAULT_GALLERY_COLUMN_PRESET,
  generationTasks: [],
  jobs: [],
  lightboxItem: null,
  lightboxZoomed: false,
  limits: { ...DEFAULT_LIMITS },
  promptAgent: {
    file: null,
    history: [],
    previewUrl: "",
    result: null,
    running: false,
    viewerOpen: false,
  },
  ppt: {
    deckId: "",
    decks: [],
    edit: {
      active: false,
      drawing: false,
      erasing: false,
      slideNumber: 0,
      hasMarks: false,
      imageUrl: "",
    },
    files: [],
    generating: false,
    outline: null,
    pptxUrl: "",
    slides: [],
    sourceMode: "upload",
    statusText: "等待生成",
    currentSlideNumber: 0,
  },
  promptTemplates: [],
  reasoningEfforts: [...DEFAULT_REASONING_EFFORTS],
  referenceFiles: [],
  selectedPromptTemplateId: "",
  selectedPreviewKey: "",
  timelineHasRendered: false,
  timelineSignatures: new Map(),
  timelineUnreadCount: 0,
  uiTheme: "dark",
  zoom: 1,
};

const refs = {
  apiKeyInput: document.querySelector("#apiKeyInput"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  closeConfigBackdrop: document.querySelector("#closeConfigBackdrop"),
  closeConfigButton: document.querySelector("#closeConfigButton"),
  configDrawer: document.querySelector("#configDrawer"),
  configFeedback: document.querySelector("#configFeedback"),
  configForm: document.querySelector("#configForm"),
  configStatus: document.querySelector("#configStatus"),
  connectionLabel: document.querySelector("#connectionLabel"),
  connectionStatus: document.querySelector("#connectionStatus"),
  errorBanner: document.querySelector("#errorBanner"),
  filmstrip: document.querySelector("#filmstrip"),
  focusGalleryButton: document.querySelector("#focusGalleryButton"),
  galleryCount: document.querySelector("#galleryCount"),
  galleryColumnButtons: [...document.querySelectorAll("[data-gallery-column-preset]")],
  galleryDateInput: document.querySelector("#galleryDateInput"),
  galleryEmpty: document.querySelector("#galleryEmpty"),
  galleryFilters: document.querySelector("#galleryFilters"),
  galleryHelperText: document.querySelector("#galleryHelperText"),
  galleryNextPageButton: document.querySelector("#galleryNextPageButton"),
  galleryPageStatus: document.querySelector("#galleryPageStatus"),
  galleryPagination: document.querySelector("#galleryPagination"),
  galleryPanel: document.querySelector(".gallery-panel"),
  galleryPreviousPageButton: document.querySelector("#galleryPreviousPageButton"),
  galleryReferenceFilterInput: document.querySelector("#galleryReferenceFilterInput"),
  galleryResetFiltersButton: document.querySelector("#galleryResetFiltersButton"),
  gallerySearchInput: document.querySelector("#gallerySearchInput"),
  gallerySections: document.querySelector("#gallerySections"),
  gallerySizeFilterInput: document.querySelector("#gallerySizeFilterInput"),
  galleryScrollbar: document.querySelector("#galleryScrollbar"),
  galleryScrollDown: document.querySelector("#galleryScrollDown"),
  galleryScrollRegion: document.querySelector("#galleryScrollRegion"),
  galleryScrollThumb: document.querySelector("#galleryScrollThumb"),
  galleryScrollTrack: document.querySelector("#galleryScrollTrack"),
  galleryScrollUp: document.querySelector("#galleryScrollUp"),
  galleryView: document.querySelector(".gallery-view"),
  generateButton: document.querySelector("#generateButton"),
  generateForm: document.querySelector("#generateForm"),
  globalNav: document.querySelector(".global-nav"),
  globalNavItems: [...document.querySelectorAll("[data-nav-section]")],
  lightbox: document.querySelector("#lightbox"),
  lightboxAmbient: document.querySelector("#lightboxAmbient"),
  lightboxBackdrop: document.querySelector("#lightboxBackdrop"),
  lightboxClose: document.querySelector("#lightboxClose"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  lightboxDelete: document.querySelector("#lightboxDelete"),
  lightboxDownload: document.querySelector("#lightboxDownload"),
  lightboxId: document.querySelector("#lightboxId"),
  lightboxImage: document.querySelector("#lightboxImage"),
  lightboxImageShell: document.querySelector(".lightbox-image-shell"),
  lightboxMediaStage: document.querySelector(".lightbox-media-stage"),
  lightboxModel: document.querySelector("#lightboxModel"),
  lightboxParams: document.querySelector("#lightboxParams"),
  lightboxPrompt: document.querySelector("#lightboxPrompt"),
  lightboxTime: document.querySelector("#lightboxTime"),
  liveCount: document.querySelector("#liveCount"),
  openConfigButton: document.querySelector("#openConfigButton"),
  openOutputButton: document.querySelector("#openOutputButton"),
  openPromptAgentButton: document.querySelector("#openPromptAgentButton"),
  outputFormatInput: document.querySelector("#outputFormatInput"),
  previewDeleteButton: document.querySelector("#previewDeleteButton"),
  previewDownloadButton: document.querySelector("#previewDownloadButton"),
  previewId: document.querySelector("#previewId"),
  previewImage: document.querySelector("#previewImage"),
  previewLightboxButton: document.querySelector("#previewLightboxButton"),
  previewModel: document.querySelector("#previewModel"),
  previewPlaceholder: document.querySelector("#previewPlaceholder"),
  previewSize: document.querySelector("#previewSize"),
  previewTime: document.querySelector("#previewTime"),
  promptCounter: document.querySelector("#promptCounter"),
  promptAgentAnalyzeButton: document.querySelector("#promptAgentAnalyzeButton"),
  promptAgentBackdrop: document.querySelector("#promptAgentBackdrop"),
  promptAgentCloseButton: document.querySelector("#promptAgentCloseButton"),
  copyPromptAgentJsonButton: document.querySelector("#copyPromptAgentJsonButton"),
  promptAgentDropzone: document.querySelector("#promptAgentDropzone"),
  promptAgentFeedback: document.querySelector("#promptAgentFeedback"),
  promptAgentFilename: document.querySelector("#promptAgentFilename"),
  promptAgentFileMeta: document.querySelector("#promptAgentFileMeta"),
  promptAgentHistoryCount: document.querySelector("#promptAgentHistoryCount"),
  promptAgentHistoryEmpty: document.querySelector("#promptAgentHistoryEmpty"),
  promptAgentHistoryList: document.querySelector("#promptAgentHistoryList"),
  promptAgentImageViewer: document.querySelector("#promptAgentImageViewer"),
  promptAgentImageViewerBackdrop: document.querySelector("#promptAgentImageViewerBackdrop"),
  promptAgentImageViewerClose: document.querySelector("#promptAgentImageViewerClose"),
  promptAgentImageViewerImage: document.querySelector("#promptAgentImageViewerImage"),
  promptAgentImageInput: document.querySelector("#promptAgentImageInput"),
  promptAgentModal: document.querySelector("#promptAgentModal"),
  promptAgentAnalysisMotion: document.querySelector("#promptAgentAnalysisMotion"),
  promptAgentPreview: document.querySelector("#promptAgentPreview"),
  promptAgentPreviewButton: document.querySelector("#promptAgentPreviewButton"),
  promptAgentPreviewImage: document.querySelector("#promptAgentPreviewImage"),
  promptAgentResult: document.querySelector("#promptAgentResult"),
  pptCompleteMissingButton: document.querySelector("#pptCompleteMissingButton"),
  pptCompletionRatio: document.querySelector("#pptCompletionRatio"),
  pptDeckCount: document.querySelector("#pptDeckCount"),
  pptDownloadLink: document.querySelector("#pptDownloadLink"),
  pptDropzone: document.querySelector("#pptDropzone"),
  pptAutoAdvanceInput: document.querySelector("#pptAutoAdvanceInput"),
  pptDynamicPresetInput: document.querySelector("#pptDynamicPresetInput"),
  pptEditBackdrop: document.querySelector("#pptEditBackdrop"),
  pptEditCanvas: document.querySelector("#pptEditCanvas"),
  pptEditClearButton: document.querySelector("#pptEditClearButton"),
  pptEditCloseButton: document.querySelector("#pptEditCloseButton"),
  pptEditDrawButton: document.querySelector("#pptEditDrawButton"),
  pptEditEraseButton: document.querySelector("#pptEditEraseButton"),
  pptEditFeedback: document.querySelector("#pptEditFeedback"),
  pptEditImage: document.querySelector("#pptEditImage"),
  pptEditInstructionInput: document.querySelector("#pptEditInstructionInput"),
  pptEditModal: document.querySelector("#pptEditModal"),
  pptEditTitle: document.querySelector("#pptEditTitle"),
  pptFeedback: document.querySelector("#pptFeedback"),
  pptFileCount: document.querySelector("#pptFileCount"),
  pptFileList: document.querySelector("#pptFileList"),
  pptForm: document.querySelector("#pptForm"),
  pptGenerateButton: document.querySelector("#pptGenerateButton"),
  pptHistoryEmpty: document.querySelector("#pptHistoryEmpty"),
  pptHistoryList: document.querySelector("#pptHistoryList"),
  pptOutlineBox: document.querySelector("#pptOutlineBox"),
  pptPageCountInput: document.querySelector("#pptPageCountInput"),
  pptProgressBar: document.querySelector("#pptProgressBar"),
  pptRecordCount: document.querySelector("#pptRecordCount"),
  pptRecordEmpty: document.querySelector("#pptRecordEmpty"),
  pptRecordList: document.querySelector("#pptRecordList"),
  pptRecordRefreshButton: document.querySelector("#pptRecordRefreshButton"),
  pptRefreshHistoryButton: document.querySelector("#pptRefreshHistoryButton"),
  pptSlideList: document.querySelector("#pptSlideList"),
  pptSourceInput: document.querySelector("#pptSourceInput"),
  pptSourceModeInputs: [...document.querySelectorAll("input[name=\"pptSourceMode\"]")],
  pptSourcePanels: [...document.querySelectorAll("[data-ppt-source-panel]")],
  pptSourceTextInput: document.querySelector("#pptSourceTextInput"),
  pptStatusText: document.querySelector("#pptStatusText"),
  pptStylePresetInput: document.querySelector("#pptStylePresetInput"),
  pptSubmitEditButton: document.querySelector("#pptSubmitEditButton"),
  pptTopicInput: document.querySelector("#pptTopicInput"),
  pptTransitionPresetInput: document.querySelector("#pptTransitionPresetInput"),
  pptTransitionSpeedInput: document.querySelector("#pptTransitionSpeedInput"),
  promptInput: document.querySelector("#promptInput"),
  promptTemplateFeedback: document.querySelector("#promptTemplateFeedback"),
  promptTemplateForm: document.querySelector("#promptTemplateForm"),
  promptTemplateList: document.querySelector("#promptTemplateList"),
  promptTemplateNameInput: document.querySelector("#promptTemplateNameInput"),
  promptTemplatePopover: document.querySelector("#promptTemplatePopover"),
  promptTemplateTextInput: document.querySelector("#promptTemplateTextInput"),
  ratioGrid: document.querySelector("#ratioGrid"),
  ratioInput: document.querySelector("#ratioInput"),
  reasoningEffortInput: document.querySelector("#reasoningEffortInput"),
  recentEmpty: document.querySelector("#recentEmpty"),
  recentList: document.querySelector("#recentList"),
  referenceCount: document.querySelector("#referenceCount"),
  referenceDropzone: document.querySelector("#referenceDropzone"),
  referenceGrid: document.querySelector("#referenceGrid"),
  referenceInput: document.querySelector("#referenceInput"),
  refreshGalleryButton: document.querySelector("#refreshGalleryButton"),
  responsesModelInput: document.querySelector("#responsesModelInput"),
  savedKeyMask: document.querySelector("#savedKeyMask"),
  sizeInput: document.querySelector("#sizeInput"),
  surprisePromptButton: document.querySelector("#surprisePromptButton"),
  applyPromptTemplateButton: document.querySelector("#applyPromptTemplateButton"),
  closePromptTemplateButton: document.querySelector("#closePromptTemplateButton"),
  deletePromptTemplateButton: document.querySelector("#deletePromptTemplateButton"),
  newPromptTemplateButton: document.querySelector("#newPromptTemplateButton"),
  settingsPanel: document.querySelector(".settings-panel"),
  sideColumn: document.querySelector(".side-column"),
  themeToggleButton: document.querySelector("#themeToggleButton"),
  themeToggleLabel: document.querySelector("#themeToggleLabel"),
  topbar: document.querySelector(".topbar"),
  timelineList: document.querySelector("#timelineList"),
  timelineNewCount: document.querySelector("#timelineNewCount"),
  timelineNewIndicator: document.querySelector("#timelineNewIndicator"),
  viewPanels: [...document.querySelectorAll("[data-view-panel]")],
  viewTabs: [...document.querySelectorAll("[data-view-tab]")],
  viewRoot: document.querySelector(".view-root"),
  previewPanel: document.querySelector(".preview-panel"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomLabel: document.querySelector("#zoomLabel"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomResetButton: document.querySelector("#zoomResetButton"),
};

function pad(value) {
  return String(value).padStart(2, "0");
}

function formatTime(dateLike) {
  if (!dateLike) {
    return "--";
  }

  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatClock(dateLike) {
  if (!dateLike) {
    return "--:--:--";
  }

  const date = new Date(dateLike);
  if (Number.isNaN(date.getTime())) {
    return "--:--:--";
  }

  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

function formatFileSize(bytes) {
  const value = Number(bytes || 0);
  if (value <= 0) {
    return "--";
  }

  if (value < 1024 * 1024) {
    return `${Math.max(1, Math.round(value / 1024))} KB`;
  }

  return `${(value / 1024 / 1024).toFixed(1)} MB`;
}

function nowIso() {
  return new Date().toISOString();
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, milliseconds);
  });
}

function buildReferenceFingerprint(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}

function makeJobPreviewKey(jobId) {
  return `job:${jobId}`;
}

function makeGalleryPreviewKey(filename) {
  return `file:${filename}`;
}

function getDisplayPrompt(item) {
  const raw = String(item?.prompt || "").trim();
  if (raw && raw.replace(/\?/g, "").trim().length > 0) {
    return raw;
  }

  if (item?.createdAt) {
    return `本地输出 ${formatClock(item.createdAt)}`;
  }

  return "未命名输出";
}

function getImageUrl(item) {
  return item?.imageUrl || item?.thumbnailUrl || item?.previewUrl || "";
}

function isCacheableBrowserImageUrl(url) {
  return /^data:image\/[a-z0-9.+-]+;base64,/i.test(String(url || ""));
}

function isServerImageProxyUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) {
    return false;
  }

  if (raw.startsWith("/api/images/")) {
    return true;
  }

  try {
    const parsed = new URL(raw, window.location.origin);
    return parsed.origin === window.location.origin && parsed.pathname.startsWith("/api/images/");
  } catch (_error) {
    return false;
  }
}

function readBlobAsDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(reader.error || new Error("FileReader failed"));
    reader.readAsDataURL(blob);
  });
}

async function fetchServerImageAsDataUrl(imageUrl) {
  const response = await fetch(imageUrl, {
    credentials: "same-origin",
    cache: "force-cache",
  });
  if (!response.ok) {
    throw new Error(`server image fetch failed with status ${response.status}`);
  }

  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) {
    throw new Error("server image response is not an image");
  }
  return readBlobAsDataUrl(blob);
}

function normalizeBrowserCachedGalleryItem(item = {}) {
  const filename = String(item.filename || "").trim();
  if (!filename) {
    return null;
  }

  const imageUrl = String(item.imageUrl || "");
  const thumbnailUrl = String(item.thumbnailUrl || "");
  const normalized = {
    id: String(item.id || ""),
    filename,
    createdAt: String(item.createdAt || nowIso()),
    prompt: String(item.prompt || ""),
    baseUrl: String(item.baseUrl || ""),
    responsesModel: String(item.responsesModel || ""),
    imageModel: String(item.imageModel || "gpt-image-2"),
    hasReferenceImage: Boolean(item.hasReferenceImage),
    referenceImageNames: Array.isArray(item.referenceImageNames) ? item.referenceImageNames.map(String).filter(Boolean) : [],
    referenceImageName: String(item.referenceImageName || ""),
    ratio: String(item.ratio || ""),
    ratioLabel: String(item.ratioLabel || ""),
    size: String(item.size || ""),
    quality: String(item.quality || ""),
    format: String(item.format || ""),
    reasoningEffort: String(item.reasoningEffort || ""),
    generationStartedAt: String(item.generationStartedAt || ""),
    generationCompletedAt: String(item.generationCompletedAt || ""),
    generationDurationMs: String(item.generationDurationMs || ""),
  };

  if (isServerImageProxyUrl(imageUrl)) {
    normalized.imageUrl = imageUrl;
  }
  if (isServerImageProxyUrl(thumbnailUrl)) {
    normalized.thumbnailUrl = thumbnailUrl;
  } else if (normalized.imageUrl) {
    normalized.thumbnailUrl = normalized.imageUrl;
  }

  return normalized;
}

function readBrowserImageCacheIndex() {
  try {
    const raw = window.localStorage.getItem(BROWSER_IMAGE_CACHE_INDEX_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.map(normalizeBrowserCachedGalleryItem).filter(Boolean)
      : [];
  } catch (_error) {
    return [];
  }
}

function writeBrowserImageCacheIndex(items) {
  try {
    window.localStorage.setItem(
      BROWSER_IMAGE_CACHE_INDEX_KEY,
      JSON.stringify(items.map(normalizeBrowserCachedGalleryItem).filter(Boolean)),
    );
  } catch (_error) {
    // Ignore storage quota or privacy-mode failures; IndexedDB still keeps images for this session.
  }
}

function openBrowserImageCacheDB() {
  if (!window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(BROWSER_IMAGE_CACHE_DB_NAME, 1);
    request.onupgradeneeded = () => {
      request.result.createObjectStore(BROWSER_IMAGE_CACHE_STORE_NAME, { keyPath: "filename" });
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("IndexedDB open failed"));
  });
}

async function withBrowserImageCacheStore(mode, operation) {
  const db = await openBrowserImageCacheDB();
  if (!db) {
    return null;
  }

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(BROWSER_IMAGE_CACHE_STORE_NAME, mode);
    const store = transaction.objectStore(BROWSER_IMAGE_CACHE_STORE_NAME);
    let operationResult = null;
    transaction.oncomplete = () => {
      db.close();
      resolve(operationResult);
    };
    transaction.onerror = () => {
      db.close();
      reject(transaction.error || new Error("IndexedDB transaction failed"));
    };
    operationResult = operation(store);
  });
}

async function putBrowserCachedImageData(filename, dataUrl) {
  await withBrowserImageCacheStore("readwrite", (store) => {
    store.put({ filename, dataUrl, updatedAt: nowIso() });
  });
}

async function getBrowserCachedImageData(filename) {
  return withBrowserImageCacheStore("readonly", (store) => {
    const request = store.get(filename);
    return new Promise((resolve, reject) => {
      request.onsuccess = () => resolve(request.result?.dataUrl || "");
      request.onerror = () => reject(request.error || new Error("IndexedDB read failed"));
    });
  });
}

async function deleteBrowserCachedImageData(filename) {
  await withBrowserImageCacheStore("readwrite", (store) => {
    store.delete(filename);
  });
}

async function cacheBrowserGalleryItem(item) {
  const cachedItem = normalizeBrowserCachedGalleryItem(item);
  const imageUrl = getImageUrl(item);
  const hasServerImageUrl = isServerImageProxyUrl(imageUrl);
  const hasDataUrl = isCacheableBrowserImageUrl(imageUrl);
  if (!cachedItem || (!hasDataUrl && !hasServerImageUrl)) {
    return;
  }

  const writeIndex = () => {
    const nextIndex = [
      cachedItem,
      ...readBrowserImageCacheIndex().filter((entry) => entry.filename !== cachedItem.filename),
    ];
    writeBrowserImageCacheIndex(nextIndex);
  };

  try {
    if (hasServerImageUrl) {
      writeIndex();
    }
    const dataUrl = hasDataUrl ? imageUrl : await fetchServerImageAsDataUrl(imageUrl);
    await putBrowserCachedImageData(cachedItem.filename, dataUrl);
    writeIndex();
    await navigator.storage?.persist?.();
  } catch (error) {
    console.warn("cache generated image in browser failed", cachedItem.filename, error);
  }
}

async function readBrowserCachedGalleryItems() {
  const entries = readBrowserImageCacheIndex();
  const restoredItems = [];
  const missingFilenames = new Set();

  for (const entry of entries) {
    try {
      const dataUrl = await getBrowserCachedImageData(entry.filename);
      const fallbackImageUrl = isServerImageProxyUrl(entry.imageUrl) ? entry.imageUrl : "";
      const fallbackThumbnailUrl = isServerImageProxyUrl(entry.thumbnailUrl) ? entry.thumbnailUrl : fallbackImageUrl;
      if (!isCacheableBrowserImageUrl(dataUrl)) {
        if (fallbackImageUrl) {
          restoredItems.push({
            ...entry,
            imageUrl: fallbackImageUrl,
            thumbnailUrl: fallbackThumbnailUrl,
          });
        } else {
          missingFilenames.add(entry.filename);
        }
        continue;
      }

      restoredItems.push({
        ...entry,
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
      });
    } catch (_error) {
      missingFilenames.add(entry.filename);
    }
  }

  if (missingFilenames.size > 0) {
    writeBrowserImageCacheIndex(entries.filter((entry) => !missingFilenames.has(entry.filename)));
  }

  return restoredItems;
}

async function deleteBrowserCachedGalleryItem(filename) {
  const normalizedFilename = String(filename || "").trim();
  if (!normalizedFilename) {
    return;
  }

  writeBrowserImageCacheIndex(readBrowserImageCacheIndex().filter((entry) => entry.filename !== normalizedFilename));
  try {
    await deleteBrowserCachedImageData(normalizedFilename);
  } catch (_error) {
    // The in-page gallery has already been updated; stale browser data can be ignored.
  }
}

async function clearBrowserImageCache() {
  window.localStorage.removeItem(BROWSER_IMAGE_CACHE_INDEX_KEY);
  try {
    await withBrowserImageCacheStore("readwrite", (store) => {
      store.clear();
    });
  } catch (_error) {
    // Ignore unavailable IndexedDB or privacy-mode failures.
  }
}

function mergeServerAndBrowserGalleryItems(serverItems, browserItems) {
  const mergedByFilename = new Map();

  for (const item of browserItems) {
    if (item?.filename) {
      mergedByFilename.set(item.filename, item);
    }
  }

  for (const item of serverItems) {
    if (!item?.filename) {
      continue;
    }
    const cachedItem = mergedByFilename.get(item.filename);
    mergedByFilename.set(item.filename, {
      ...cachedItem,
      ...item,
      imageUrl: item.imageUrl || cachedItem?.imageUrl || "",
      thumbnailUrl: item.thumbnailUrl || cachedItem?.thumbnailUrl || "",
    });
  }

  return [...mergedByFilename.values()];
}

function getDisplayId(item) {
  const raw = String(item?.id || "");
  if (!raw) {
    return "--";
  }

  if (raw.length <= 28) {
    return raw;
  }

  return `${raw.slice(0, 24)}...`;
}

function formatCanvasLabel(size) {
  if (!size) {
    return "--";
  }

  return size.replace("x", " × ");
}

function formatCompactSizeLabel(size) {
  const normalized = String(size || "")
    .trim()
    .replace(/\s*[x×]\s*/i, "x");

  return /^\d+x\d+$/.test(normalized) ? normalized : "";
}

function formatCompactRatioLabel(ratio) {
  const normalized = String(ratio || "")
    .trim()
    .replace(/\s*[：:]\s*/g, ":");

  return /^\d+:\d+$/.test(normalized) ? normalized : "";
}

function formatFilmstripSizeLabel(item) {
  return formatCompactSizeLabel(item?.size);
}

function compactTimelineText(value, fallback = "未命名任务") {
  const raw = String(value || "").trim();
  if (!raw) {
    return fallback;
  }

  return raw.length > 34 ? `${raw.slice(0, 34)}...` : raw;
}

function normalizeGenerationTaskStatus(status) {
  return status === "completed" || status === "error" ? status : "running";
}

function normalizeActivityEntry(entry) {
  const key = String(entry?.key || "").trim();
  const title = String(entry?.title || "").trim();
  const detail = String(entry?.detail || "");
  if (!key || !title) {
    return null;
  }

  if (isGenerationRequestRetryMessage(detail)) {
    return null;
  }

  return {
    key,
    title,
    detail,
    ratio: formatCompactRatioLabel(entry?.ratio),
    size: formatCompactSizeLabel(entry?.size),
    status: ["active", "done", "error", "pending"].includes(entry?.status) ? entry.status : "active",
    at: String(entry?.at || ""),
    orderAt: String(entry?.orderAt || entry?.at || ""),
  };
}

function normalizePersistedActivityEntry(entry) {
  const normalized = normalizeActivityEntry(entry);
  if (!normalized) {
    return null;
  }

  if (normalized.status === "active") {
    return {
      ...normalized,
      title: GENERATION_TASK_STATUS_LABELS.error,
      detail: "上次页面关闭前生成未完成，请重新生成",
      status: "error",
    };
  }

  return normalized;
}

function readGenerationActivityFeed() {
  try {
    const raw = window.localStorage.getItem(GENERATION_ACTIVITY_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    const entries = Array.isArray(parsed) ? parsed.map(normalizePersistedActivityEntry).filter(Boolean) : [];
    return sortGenerationActivityFeed(entries).slice(0, 12);
  } catch (_error) {
    return [];
  }
}

function writeGenerationActivityFeed() {
  try {
    window.localStorage.setItem(GENERATION_ACTIVITY_STORAGE_KEY, JSON.stringify(state.activityFeed.slice(0, 12)));
  } catch (_error) {
    // Ignore storage quota or privacy-mode failures; the in-memory feed still works.
  }
}

function readGalleryMetadataCache() {
  try {
    const raw = window.localStorage.getItem(GALLERY_METADATA_CACHE_KEY);
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch (_error) {
    return {};
  }
}

function writeGalleryMetadataCache(cache) {
  try {
    window.localStorage.setItem(GALLERY_METADATA_CACHE_KEY, JSON.stringify(cache));
  } catch (_error) {
    // Ignore storage quota or browser privacy restrictions and keep the in-memory copy.
  }
}

function syncGalleryMetadataCache(items) {
  const nextCache = pruneGalleryMetadataCache(state.galleryMetadataCache, items);

  items.forEach((item) => {
    const filename = String(item?.filename || "").trim();
    if (!filename) {
      return;
    }

    const entry = buildGalleryMetadataCacheEntry(item);
    if (Object.keys(entry).length > 0) {
      nextCache[filename] = entry;
    }
  });

  state.galleryMetadataCache = nextCache;
  writeGalleryMetadataCache(nextCache);
}

function forgetGalleryMetadata(filename) {
  const normalizedFilename = String(filename || "").trim();
  if (!normalizedFilename || !state.galleryMetadataCache[normalizedFilename]) {
    return;
  }

  const nextCache = { ...state.galleryMetadataCache };
  delete nextCache[normalizedFilename];
  state.galleryMetadataCache = nextCache;
  writeGalleryMetadataCache(nextCache);
}

function hydrateGalleryItems(serverItems) {
  const repairQueue = [];
  const hydratedItems = serverItems.map((item) => {
    const cachedEntry = state.galleryMetadataCache[item.filename];
    if (!cachedEntry) {
      return item;
    }

    const mergedItem = mergeGalleryItemWithCachedMetadata(item, cachedEntry);
    const metadataPatch = collectGalleryMetadataRepairPatch(item, mergedItem);
    if (Object.keys(metadataPatch).length > 0) {
      repairQueue.push({
        filename: item.filename,
        metadata: metadataPatch,
      });
    }

    return mergedItem;
  });

  syncGalleryMetadataCache(hydratedItems);

  return {
    items: hydratedItems,
    repairQueue,
  };
}

async function repairGalleryMetadataQueue(repairQueue = []) {
  for (const repair of repairQueue) {
    try {
      const response = await fetch("/api/gallery/metadata", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(repair),
      });
      if (!response.ok) {
        throw new Error(`repair failed with status ${response.status}`);
      }
    } catch (error) {
      console.warn("repair gallery metadata failed", repair.filename, error);
    }
  }
}

function getNormalizedGalleryControls() {
  state.galleryControls = normalizeGalleryFilters(state.galleryControls, state.gallery);
  return state.galleryControls;
}

function getGalleryFilterSnapshot(overrides = {}) {
  return normalizeGalleryFilters({ ...getNormalizedGalleryControls(), ...overrides }, state.gallery);
}

function hasActiveGalleryFilters(filters) {
  return Boolean(
    filters.query ||
      filters.window !== "all" ||
      filters.date ||
      filters.size !== "all" ||
      filters.reference !== "all",
  );
}

function formatGalleryQuerySummary(query) {
  const compact = query.length > 18 ? `${query.slice(0, 18)}...` : query;
  return `关键词“${compact}”`;
}

function formatGalleryFilterSummary(filters) {
  const parts = [];

  if (filters.query) {
    parts.push(formatGalleryQuerySummary(filters.query));
  }

  if (filters.date) {
    parts.push(filters.date);
  } else if (filters.window !== "all") {
    parts.push(GALLERY_WINDOW_LABELS[filters.window] || filters.window);
  }

  if (filters.size !== "all") {
    parts.push(formatCanvasLabel(filters.size));
  }

  if (filters.reference !== "all") {
    parts.push(GALLERY_REFERENCE_LABELS[filters.reference] || filters.reference);
  }

  return parts.join(" · ");
}

function renderGallerySelectOptions(select, options, activeValue) {
  if (!select) {
    return;
  }

  select.innerHTML = "";
  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = `${option.label} · ${option.count}`;
    select.appendChild(element);
  });

  if (options.some((option) => option.value === activeValue)) {
    select.value = activeValue;
    return;
  }

  select.value = options[0]?.value || "all";
}

function getRatioOption(value) {
  return state.aspectRatios.find((option) => option.value === value) || state.aspectRatios[0] || null;
}

function getVisibleRatios() {
  return [...state.aspectRatios];
}

function normalizeUiTheme(theme) {
  return theme === "light" ? "light" : "dark";
}

function readUiTheme() {
  try {
    return normalizeUiTheme(window.localStorage.getItem(THEME_STORAGE_KEY) || document.documentElement.dataset.theme);
  } catch {
    return normalizeUiTheme(document.documentElement.dataset.theme);
  }
}

function syncThemeToggle() {
  if (!refs.themeToggleButton || !refs.themeToggleLabel) {
    return;
  }

  const isLight = state.uiTheme === "light";
  refs.themeToggleButton.setAttribute("aria-pressed", String(isLight));
  refs.themeToggleButton.title = isLight ? "切换到深色主题" : "切换到白色主题";
  refs.themeToggleLabel.textContent = isLight ? "深色主题" : "白色主题";
}

function setUiTheme(theme) {
  const normalized = normalizeUiTheme(theme);
  state.uiTheme = normalized;
  document.documentElement.dataset.theme = normalized;
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, normalized);
  } catch {
    // Ignore storage restrictions; the current page can still switch theme.
  }
  syncThemeToggle();
}

function toggleUiTheme() {
  setUiTheme(state.uiTheme === "light" ? "dark" : "light");
}

function getViewFromHash() {
  if (window.location.hash === "#gallery") {
    return "gallery";
  }
  if (window.location.hash === "#ppt-record") {
    return "ppt-record";
  }
  if (window.location.hash === "#ppt") {
    return "ppt";
  }
  return "studio";
}

function syncHash(view) {
  const nextHash =
    view === "gallery" ? "#gallery" : view === "ppt-record" ? "#ppt-record" : view === "ppt" ? "#ppt" : "#studio";
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}

function getOrCreateClientSessionId() {
  const storageKey = "image-studio-client-session-id";
  const existing = window.localStorage.getItem(storageKey);
  if (existing) {
    return existing;
  }

  const next = `studio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(storageKey, next);
  return next;
}

function maskBrowserApiKey(apiKey) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`;
  }

  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`;
}

function normalizeBrowserPrivateConfig(source = {}) {
  const baseUrl = String(source.baseUrl || "https://api.openai.com/v1").trim();
  const apiKey = String(source.apiKey || "").trim();
  const responsesModel = String(source.responsesModel || "gpt-5.5").trim();

  return {
    baseUrl: baseUrl || "https://api.openai.com/v1",
    apiKey,
    responsesModel: responsesModel || "gpt-5.5",
  };
}

function readBrowserPrivateConfig() {
  try {
    const raw = window.localStorage.getItem(BROWSER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeBrowserPrivateConfig(JSON.parse(raw));
  } catch {
    return null;
  }
}

function toPublicBrowserConfig(privateConfig, baseConfig = {}) {
  const normalized = normalizeBrowserPrivateConfig(privateConfig);
  return {
    ...baseConfig,
    baseUrl: normalized.baseUrl,
    apiKeyConfigured: Boolean(normalized.apiKey),
    apiKeyMask: maskBrowserApiKey(normalized.apiKey),
    responsesModel: normalized.responsesModel,
  };
}

function saveBrowserPrivateConfig(payload) {
  const current = readBrowserPrivateConfig() || normalizeBrowserPrivateConfig();
  const next = normalizeBrowserPrivateConfig({
    ...current,
    baseUrl: payload.baseUrl,
    apiKey: payload.apiKey ? payload.apiKey : current.apiKey,
    responsesModel: payload.responsesModel,
  });

  window.localStorage.setItem(BROWSER_CONFIG_STORAGE_KEY, JSON.stringify(next));
  return next;
}

function appendBrowserConfigToFormData(formData) {
  const browserConfig = readBrowserPrivateConfig();
  if (!browserConfig) {
    return formData;
  }

  formData.set("baseUrl", browserConfig.baseUrl);
  formData.set("apiKey", browserConfig.apiKey);
  formData.set("responsesModel", browserConfig.responsesModel);
  return formData;
}

function getBrowserPrivateConfigRequestPayload() {
  const browserConfig = readBrowserPrivateConfig();
  return browserConfig
    ? {
        baseUrl: browserConfig.baseUrl,
        apiKey: browserConfig.apiKey,
        responsesModel: browserConfig.responsesModel,
      }
    : {};
}

function compactErrorMessage(message, fallbackLabel = "请求失败") {
  const raw = String(message || fallbackLabel).trim();
  const httpStatus = raw.match(/HTTP\s+(\d{3})/i)?.[1] || raw.match(/"status"\s*:\s*(\d{3})/i)?.[1] || "";
  const errorCode =
    raw.match(/错误码\s*([A-Za-z0-9_.-]+)/i)?.[1] ||
    raw.match(/"error_code"\s*:\s*"?([A-Za-z0-9_.-]+)"?/i)?.[1] ||
    raw.match(/"code"\s*:\s*"([^"]+)"/i)?.[1] ||
    httpStatus;

  if (!httpStatus && !errorCode) {
    return raw;
  }

  let label = fallbackLabel;
  if (/图片分析|Prompt Agent/i.test(raw)) {
    label = "图片分析请求失败";
  } else if (/生成|接口请求|image_generation/i.test(raw)) {
    label = "生成请求失败";
  }

  return `${label}：${[httpStatus ? `HTTP ${httpStatus}` : "", errorCode ? `错误码 ${errorCode}` : ""]
    .filter(Boolean)
    .join("，")}`;
}

function showError(message) {
  refs.errorBanner.textContent = compactErrorMessage(message);
  refs.errorBanner.classList.remove("hidden");
}

function clearError() {
  refs.errorBanner.textContent = "";
  refs.errorBanner.classList.add("hidden");
}

function setConnectionState(kind, label) {
  refs.connectionStatus.dataset.state = kind;
  refs.connectionLabel.textContent = label;
}

function syncConnectionState() {
  const queuedCount = getQueuedJobCount();
  if (queuedCount > 0) {
    setConnectionState("busy", `并发 ${getRunningJobCount()}/${getMaxParallelJobCount()} · 队列 ${queuedCount}/${getMaxQueuedJobCount()}`);
    return;
  }

  if (state.config?.apiKeyConfigured) {
    setConnectionState("ready", "API 已就绪");
    return;
  }

  setConnectionState("idle", "请先配置 API");
}

function setDrawerOpen(open) {
  refs.configDrawer.classList.toggle("open", open);
  refs.configDrawer.setAttribute("aria-hidden", String(!open));
}

function setLightboxOpen(open) {
  refs.lightbox.classList.toggle("hidden", !open);
  refs.lightbox.classList.toggle("open", open);
  refs.lightbox.setAttribute("aria-hidden", String(!open));
}

function resetPromptCopyFeedback() {
  if (promptCopyFeedbackTimer) {
    window.clearTimeout(promptCopyFeedbackTimer);
    promptCopyFeedbackTimer = 0;
  }

  if (!refs.copyPromptButton) {
    return;
  }

  refs.copyPromptButton.textContent = "复制";
  refs.copyPromptButton.dataset.copied = "false";
}

function markPromptCopied() {
  if (!refs.copyPromptButton) {
    return;
  }

  resetPromptCopyFeedback();
  refs.copyPromptButton.textContent = "已复制";
  refs.copyPromptButton.dataset.copied = "true";
  promptCopyFeedbackTimer = window.setTimeout(() => {
    promptCopyFeedbackTimer = 0;
    resetPromptCopyFeedback();
  }, 1600);
}

function syncLightboxZoomState() {
  refs.lightboxImage.classList.toggle("is-zoomed", state.lightboxZoomed);
  refs.lightboxImageShell?.classList.toggle("is-zoomed", state.lightboxZoomed);
  refs.lightboxMediaStage?.classList.toggle("is-zoomed", state.lightboxZoomed);
}

function getCurrentStudioLayoutMode() {
  return (
    document.documentElement.dataset.uiLayout ||
    getStudioLayoutMode({
      width: window.innerWidth,
      outerWidth: window.outerWidth,
    })
  );
}

function getGalleryLayoutWidth() {
  return Math.max(
    refs.galleryPanel?.clientWidth || 0,
    refs.galleryView?.clientWidth || 0,
    refs.viewRoot?.clientWidth || 0,
    window.innerWidth || 0,
  );
}

function syncGalleryLayoutMode() {
  if (!refs.galleryView) {
    return;
  }

  refs.galleryView.dataset.galleryLayout = getGalleryLayoutModeForWidth(getGalleryLayoutWidth());
}

function syncStudioDensity() {
  const settings = getStudioDensitySettings({
    width: window.innerWidth,
    height: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    outerWidth: window.outerWidth,
    visualScale: window.visualViewport?.scale || 1,
  });
  const layoutMode = settings.layoutMode || getStudioLayoutMode({
    width: window.innerWidth,
    outerWidth: window.outerWidth,
  });

  document.documentElement.dataset.uiDensity = settings.mode;
  document.documentElement.dataset.uiLayout = layoutMode;

  for (const name of ALL_VARIABLE_NAMES) {
    document.documentElement.style.removeProperty(name);
  }

  for (const [name, value] of Object.entries(settings.variables)) {
    document.documentElement.style.setProperty(name, value);
  }
}

function scheduleStudioDensitySync() {
  if (studioDensitySyncFrame) {
    window.cancelAnimationFrame(studioDensitySyncFrame);
  }

  studioDensitySyncFrame = window.requestAnimationFrame(() => {
    studioDensitySyncFrame = 0;
    syncStudioDensity();
    window.requestAnimationFrame(() => {
      syncGalleryLayoutMode();
      scheduleStudioHeightSync();
      scheduleGalleryPanelHeightSync();
      scheduleGalleryScrollSync();
      renderGalleryView();
    });
  });
}

let densityZoomEndTimer = 0;

function bindStudioDensitySync() {
  window.addEventListener("resize", scheduleStudioDensitySync);
  window.visualViewport?.addEventListener("resize", scheduleStudioDensitySync);

  if (window.visualViewport) {
    window.visualViewport.addEventListener("scroll", () => {
      if (densityZoomEndTimer) {
        window.clearTimeout(densityZoomEndTimer);
      }
      densityZoomEndTimer = window.setTimeout(() => {
        densityZoomEndTimer = 0;
        scheduleStudioDensitySync();
      }, 150);
    });
  }
}

function setActiveView(view) {
  state.activeView = view;
  syncHash(view);

  refs.viewTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTab === view);
  });

  refs.viewPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== view);
  });

  syncGalleryLayoutMode();
  scheduleStudioHeightSync();
  scheduleGalleryPanelHeightSync();
  scheduleGalleryScrollSync();
}

function updatePromptCounter() {
  refs.promptCounter.textContent = String(refs.promptInput.value.length);
}

function getQueuedJobCount() {
  return state.jobs.length;
}

function getRunningJobCount() {
  return state.jobs.filter((job) => job.isRunning).length;
}

function getMaxQueuedJobCount() {
  return state.limits.maxConcurrentTasksPerSession || DEFAULT_LIMITS.maxConcurrentTasksPerSession;
}

function getMaxParallelJobCount() {
  return state.limits.maxParallelTasksPerSession || DEFAULT_LIMITS.maxParallelTasksPerSession;
}

function updateGenerateButton() {
  const runningCount = getRunningJobCount();
  const queuedCount = getQueuedJobCount();
  const maxQueuedCount = getMaxQueuedJobCount();
  const maxParallelCount = getMaxParallelJobCount();
  refs.generateButton.disabled = queuedCount >= maxQueuedCount;
  refs.generateButton.textContent =
    queuedCount > 0 ? `队列 ${queuedCount}/${maxQueuedCount}` : "开始生成";
  refs.liveCount.textContent = `${runningCount} / ${maxParallelCount}`;
}

function setPromptAgentFeedback(message, kind = "") {
  refs.promptAgentFeedback.textContent =
    kind === "error" ? compactErrorMessage(message, "图片分析请求失败") : message || "";
  refs.promptAgentFeedback.dataset.state = kind;
}

function revokePromptAgentPreview() {
  if (state.promptAgent.previewUrl) {
    URL.revokeObjectURL(state.promptAgent.previewUrl);
  }
}

function setPromptAgentOpen(open) {
  refs.promptAgentModal.classList.toggle("hidden", !open);
  refs.promptAgentModal.setAttribute("aria-hidden", String(!open));
  if (open) {
    renderPromptAgent();
    loadPromptAgentHistory().catch((error) => setPromptAgentFeedback(error.message, "error"));
  }
}

function getPromptAgentItem(itemId) {
  const current = state.promptAgent.result;
  if (current?.id === itemId) {
    return current;
  }

  return state.promptAgent.history.find((item) => item.id === itemId) || null;
}

function getPromptAgentPrompt(item) {
  return String(item?.json?.prompt || "").trim();
}

function getPromptAgentJsonText(item = state.promptAgent.result) {
  if (!item?.json) {
    return "";
  }

  return JSON.stringify(item.json, null, 2);
}

function getPromptAgentTemplateId(item) {
  const rawId = String(item?.id || item?.createdAt || item?.filename || "latest").trim();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "-") || "latest";
  return `prompt-agent-${safeId}`;
}

function savePromptAgentResultAsTemplate(item) {
  const prompt = getPromptAgentJsonText(item);
  if (!prompt) {
    return;
  }

  const template = {
    id: getPromptAgentTemplateId(item),
    name: item.json?.title || item.filename || "图片 JSON 提示词",
    prompt,
  };
  state.promptTemplates = [
    template,
    ...state.promptTemplates.filter((entry) => entry.id !== template.id),
  ];
  state.selectedPromptTemplateId = template.id;
  writePromptTemplates();
  renderPromptTemplates();
}

function renderPromptAgentPreview() {
  const file = state.promptAgent.file;
  refs.promptAgentPreview.classList.toggle("hidden", !file);
  refs.promptAgentPreview.classList.toggle("is-analyzing", state.promptAgent.running);
  refs.promptAgentAnalysisMotion.classList.toggle("is-active", state.promptAgent.running);

  if (!file) {
    refs.promptAgentPreviewImage.removeAttribute("src");
    refs.promptAgentFilename.textContent = "--";
    refs.promptAgentFileMeta.textContent = "--";
    return;
  }

  refs.promptAgentPreviewImage.src = state.promptAgent.previewUrl;
  refs.promptAgentFilename.textContent = file.name || "uploaded-image";
  refs.promptAgentFileMeta.textContent = `${file.type || "image"} · ${formatFileSize(file.size)}`;
}

function openPromptAgentImageViewer() {
  if (!state.promptAgent.previewUrl) {
    return;
  }

  state.promptAgent.viewerOpen = true;
  refs.promptAgentImageViewerImage.src = state.promptAgent.previewUrl;
  refs.promptAgentImageViewer.classList.add("open");
  refs.promptAgentImageViewer.setAttribute("aria-hidden", "false");
}

function closePromptAgentImageViewer() {
  state.promptAgent.viewerOpen = false;
  refs.promptAgentImageViewer.classList.remove("open");
  refs.promptAgentImageViewer.setAttribute("aria-hidden", "true");
}

function createPromptAgentHistoryCard(item) {
  const card = document.createElement("article");
  card.className = "prompt-agent-history-card";
  card.dataset.expanded = "false";

  const titleRow = document.createElement("div");
  titleRow.className = "prompt-agent-history-title";

  const titleButton = document.createElement("button");
  titleButton.className = "prompt-agent-history-title-button";
  titleButton.type = "button";
  titleButton.dataset.promptAgentMapId = item.id;
  titleButton.textContent = item.json?.title || "图片提示词";
  titleButton.title = titleButton.textContent;

  const time = document.createElement("span");
  time.className = "prompt-agent-history-time";
  time.textContent = formatTime(item.createdAt);

  const expandButton = document.createElement("button");
  expandButton.className = "prompt-agent-history-expand-button";
  expandButton.type = "button";
  expandButton.dataset.promptAgentExpandId = item.id;
  expandButton.setAttribute("aria-expanded", "false");
  expandButton.textContent = "展开";

  const detail = document.createElement("div");
  detail.className = "prompt-agent-history-detail hidden";
  detail.id = `prompt-agent-history-detail-${String(item.id).replace(/[^a-zA-Z0-9_-]/g, "-")}`;
  expandButton.setAttribute("aria-controls", detail.id);
  expandButton.setAttribute("aria-label", `展开 ${titleButton.textContent}`);

  titleRow.append(titleButton, time, expandButton);

  const promptText = document.createElement("p");
  promptText.className = "prompt-agent-history-prompt";
  promptText.textContent = getPromptAgentPrompt(item) || "未返回 prompt 字段";

  const meta = document.createElement("div");
  meta.className = "prompt-agent-history-meta";
  const tags = Array.isArray(item.json?.style_tags) ? item.json.style_tags.slice(0, 4).join(" / ") : "";
  meta.textContent = [item.filename, item.json?.aspect_ratio, tags].filter(Boolean).join(" · ");

  const actions = document.createElement("div");
  actions.className = "prompt-agent-history-actions";

  const copyButton = document.createElement("button");
  copyButton.className = "inline-button";
  copyButton.type = "button";
  copyButton.dataset.promptAgentCopyId = item.id;
  copyButton.textContent = "复制 JSON";

  actions.append(copyButton);
  detail.append(promptText, meta, actions);
  card.append(titleRow, detail);
  return card;
}

function setPromptAgentHistoryCardExpanded(card, expanded) {
  const detail = card.querySelector(".prompt-agent-history-detail");
  const expandButton = card.querySelector(".prompt-agent-history-expand-button");
  card.dataset.expanded = expanded ? "true" : "false";
  detail?.classList.toggle("hidden", !expanded);
  if (expandButton) {
    expandButton.setAttribute("aria-expanded", String(expanded));
    expandButton.textContent = expanded ? "收起" : "展开";
  }
}

function togglePromptAgentHistoryCard(button) {
  const card = button.closest(".prompt-agent-history-card");
  if (!card) {
    return;
  }
  setPromptAgentHistoryCardExpanded(card, card.dataset.expanded !== "true");
}

function renderPromptAgentHistory() {
  refs.promptAgentHistoryList.replaceChildren();
  refs.promptAgentHistoryCount.textContent = `${state.promptAgent.history.length} 条`;
  refs.promptAgentHistoryEmpty.classList.toggle("hidden", state.promptAgent.history.length > 0);

  state.promptAgent.history.forEach((item) => {
    refs.promptAgentHistoryList.append(createPromptAgentHistoryCard(item));
  });
}

function renderPromptAgent() {
  renderPromptAgentPreview();
  refs.promptAgentAnalyzeButton.disabled = state.promptAgent.running || !state.promptAgent.file;
  refs.promptAgentAnalyzeButton.textContent = state.promptAgent.running ? "分析中..." : "分析图片";
  refs.copyPromptAgentJsonButton.disabled = !state.promptAgent.result?.json;
  refs.promptAgentResult.value = getPromptAgentJsonText();
  renderPromptAgentHistory();
}

function revokeReferencePreview(item) {
  if (item?.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}

function resetReferenceFiles() {
  state.referenceFiles.forEach(revokeReferencePreview);
  state.referenceFiles = [];
  refs.referenceInput.value = "";
  renderReferenceGrid();
}

function removeReferenceFile(referenceId) {
  const target = state.referenceFiles.find((item) => item.id === referenceId);
  revokeReferencePreview(target);
  state.referenceFiles = state.referenceFiles.filter((item) => item.id !== referenceId);
  renderReferenceGrid();
}

function applyReferenceFiles(fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return;
  }

  const next = [...state.referenceFiles];
  const fingerprints = new Set(next.map((item) => item.fingerprint));
  let overflowed = false;

  for (const file of incomingFiles) {
    if (next.length >= state.limits.maxReferenceImages) {
      overflowed = true;
      break;
    }

    const fingerprint = buildReferenceFingerprint(file);
    if (fingerprints.has(fingerprint)) {
      continue;
    }

    next.push({
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint,
      file,
      previewUrl: URL.createObjectURL(file),
    });
    fingerprints.add(fingerprint);
  }

  state.referenceFiles = next;
  refs.referenceInput.value = "";
  renderReferenceGrid();

  if (overflowed) {
    showError(`参考图最多支持 ${state.limits.maxReferenceImages} 张。`);
  }
}

function renderReferenceGrid() {
  refs.referenceGrid.innerHTML = "";
  refs.referenceCount.textContent = `${state.referenceFiles.length} / ${state.limits.maxReferenceImages}`;
  refs.referenceGrid.classList.toggle("hidden", state.referenceFiles.length === 0);

  state.referenceFiles.forEach((item) => {
    const card = document.createElement("div");
    card.className = "reference-card";

    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "参考图预览";
    card.appendChild(image);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "移除";
    remove.addEventListener("click", () => removeReferenceFile(item.id));
    card.appendChild(remove);
    refs.referenceGrid.appendChild(card);
  });
}

function renderReasoningOptions() {
  const currentValue = refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh";
  refs.reasoningEffortInput.innerHTML = "";

  state.reasoningEfforts.forEach((value) => {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = REASONING_LABELS[value] || value;
    refs.reasoningEffortInput.appendChild(option);
  });

  if (state.reasoningEfforts.includes(currentValue)) {
    refs.reasoningEffortInput.value = currentValue;
  } else {
    refs.reasoningEffortInput.value = state.reasoningEfforts[0] || "xhigh";
  }
}

function renderOutputFormatOptions() {
  const currentValue = normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png");
  refs.outputFormatInput.innerHTML = "";

  getOutputFormatOptions().forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    refs.outputFormatInput.appendChild(element);
  });

  refs.outputFormatInput.value = currentValue;
}

function renderSizeOptions() {
  const ratioValue = refs.ratioInput.value || DEFAULT_UI_RATIO;
  const currentValue = normalizeGenerationSize(ratioValue, refs.sizeInput.value || "auto");
  refs.sizeInput.innerHTML = "";

  getGenerationSizeOptions(ratioValue).forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    refs.sizeInput.appendChild(element);
  });

  refs.sizeInput.value = currentValue;
}

function getSettingsFormScrollTop() {
  return refs.generateForm?.scrollTop || 0;
}

function restoreSettingsFormScrollTop(scrollTop) {
  if (!refs.generateForm || !Number.isFinite(scrollTop)) {
    return;
  }

  const restore = () => {
    refs.generateForm.scrollTop = scrollTop;
  };

  restore();
  window.requestAnimationFrame(restore);
}

function syncStudioHeight() {
  if (!refs.settingsPanel || !refs.previewPanel || !refs.sideColumn || !refs.viewRoot) {
    return;
  }

  const settingsScrollTop = getSettingsFormScrollTop();

  if (STACKED_STUDIO_LAYOUT_MODES.has(getCurrentStudioLayoutMode()) || state.activeView !== "studio") {
    document.documentElement.style.removeProperty("--studio-column-height");
    restoreSettingsFormScrollTop(settingsScrollTop);
    return;
  }

  document.documentElement.style.removeProperty("--studio-column-height");

  void refs.settingsPanel.offsetHeight;

  const viewRootRect = refs.viewRoot.getBoundingClientRect();
  const availableHeight = Math.max(600, Math.floor(window.innerHeight - viewRootRect.top - 12));
  const resolvedHeight = availableHeight;

  if (resolvedHeight > 0) {
    document.documentElement.style.setProperty("--studio-column-height", `${resolvedHeight}px`);
  }

  restoreSettingsFormScrollTop(settingsScrollTop);
}

function scheduleStudioHeightSync() {
  if (studioHeightSyncFrame) {
    window.cancelAnimationFrame(studioHeightSyncFrame);
  }

  studioHeightSyncFrame = window.requestAnimationFrame(() => {
    studioHeightSyncFrame = 0;
    syncStudioHeight();
    window.requestAnimationFrame(() => {
      syncStudioHeight();
    });
  });
}

function syncGalleryPanelHeight() {
  if (!refs.galleryPanel || !refs.viewRoot) {
    return;
  }

  syncGalleryLayoutMode();
  document.documentElement.style.removeProperty("--gallery-panel-height");

  void refs.viewRoot.offsetHeight;

  const viewRootRect = refs.viewRoot.getBoundingClientRect();
  const availableHeight = Math.max(320, Math.floor(window.innerHeight - viewRootRect.top - 12));
  document.documentElement.style.setProperty("--gallery-panel-height", `${availableHeight}px`);
}

function scheduleGalleryPanelHeightSync() {
  if (galleryPanelHeightSyncFrame) {
    window.cancelAnimationFrame(galleryPanelHeightSyncFrame);
  }

  galleryPanelHeightSyncFrame = window.requestAnimationFrame(() => {
    galleryPanelHeightSyncFrame = 0;
    syncGalleryPanelHeight();
    syncGalleryScrollUi();
  });
}

function bindStudioHeightSync() {
  window.addEventListener("resize", () => scheduleStudioHeightSync());

  if (typeof ResizeObserver === "function" && refs.settingsPanel) {
    studioHeightObserver = new ResizeObserver(() => {
      scheduleStudioHeightSync();
    });
    studioHeightObserver.observe(refs.settingsPanel);
  }
}

function bindGalleryPanelHeightSync() {
  const handleChange = () => scheduleGalleryPanelHeightSync();
  window.addEventListener("resize", handleChange);

  if (typeof ResizeObserver === "function") {
    galleryPanelHeightObserver = new ResizeObserver(() => {
      scheduleGalleryPanelHeightSync();
    });

    if (refs.topbar) {
      galleryPanelHeightObserver.observe(refs.topbar);
    }

    if (refs.viewRoot) {
      galleryPanelHeightObserver.observe(refs.viewRoot);
    }
  }
}

function getGalleryMaxScroll() {
  if (!refs.galleryScrollRegion) {
    return 0;
  }

  return Math.max(0, refs.galleryScrollRegion.scrollHeight - refs.galleryScrollRegion.clientHeight);
}

function getGalleryScrollMetrics() {
  const trackHeight = refs.galleryScrollTrack?.clientHeight || 0;
  const maxScroll = getGalleryMaxScroll();
  const clientHeight = refs.galleryScrollRegion?.clientHeight || 0;
  const scrollHeight = refs.galleryScrollRegion?.scrollHeight || 0;
  const disabled = maxScroll <= 0 || trackHeight <= 0;
  const thumbHeight = disabled
    ? trackHeight
    : Math.min(trackHeight, Math.max(54, Math.round((clientHeight / scrollHeight) * trackHeight)));
  const maxOffset = Math.max(0, trackHeight - thumbHeight);
  const currentScroll = Math.min(maxScroll, Math.max(0, refs.galleryScrollRegion?.scrollTop || 0));
  const offset = disabled || maxOffset === 0 ? 0 : (currentScroll / maxScroll) * maxOffset;

  return {
    currentScroll,
    disabled,
    maxOffset,
    maxScroll,
    offset,
    thumbHeight,
  };
}

function syncGalleryScrollUi() {
  if (
    !refs.galleryScrollRegion ||
    !refs.galleryScrollbar ||
    !refs.galleryScrollThumb ||
    !refs.galleryScrollTrack ||
    !refs.galleryScrollUp ||
    !refs.galleryScrollDown
  ) {
    return;
  }

  const metrics = getGalleryScrollMetrics();

  refs.galleryScrollbar.dataset.disabled = String(metrics.disabled);
  refs.galleryScrollbar.setAttribute("aria-hidden", String(metrics.disabled));
  refs.galleryScrollThumb.style.height = `${metrics.thumbHeight}px`;
  refs.galleryScrollThumb.style.transform = `translateY(${Math.round(metrics.offset)}px)`;
  refs.galleryScrollUp.disabled = metrics.disabled || metrics.currentScroll <= 0;
  refs.galleryScrollDown.disabled = metrics.disabled || metrics.currentScroll >= metrics.maxScroll - 1;
}

function scheduleGalleryScrollSync() {
  if (galleryScrollSyncFrame) {
    window.cancelAnimationFrame(galleryScrollSyncFrame);
  }

  galleryScrollSyncFrame = window.requestAnimationFrame(() => {
    galleryScrollSyncFrame = 0;
    syncGalleryScrollUi();
  });
}

function getSelectedGenerationSize() {
  return normalizeGenerationSize(refs.ratioInput.value || DEFAULT_UI_RATIO, refs.sizeInput.value || "auto");
}

function scrollGalleryBy(direction) {
  if (!refs.galleryScrollRegion) {
    return;
  }

  const distance = Math.max(260, Math.round(refs.galleryScrollRegion.clientHeight * 0.78));
  refs.galleryScrollRegion.scrollBy({
    top: direction * distance,
    behavior: "smooth",
  });
}

function setGalleryDragging(active) {
  refs.galleryScrollbar?.classList.toggle("is-dragging", active);
}

function endGalleryThumbDrag() {
  if (!galleryScrollDrag.active) {
    return;
  }

  galleryScrollDrag.active = false;
  galleryScrollDrag.pointerId = null;
  setGalleryDragging(false);
}

function scrollGalleryTrackTo(clientY, smooth = false) {
  if (!refs.galleryScrollTrack || !refs.galleryScrollRegion) {
    return;
  }

  const metrics = getGalleryScrollMetrics();
  if (metrics.disabled || metrics.maxOffset <= 0) {
    return;
  }

  const rect = refs.galleryScrollTrack.getBoundingClientRect();
  const rawOffset = clientY - rect.top - metrics.thumbHeight / 2;
  const nextOffset = Math.min(metrics.maxOffset, Math.max(0, rawOffset));
  const nextScroll = (nextOffset / metrics.maxOffset) * metrics.maxScroll;

  if (smooth) {
    refs.galleryScrollRegion.scrollTo({
      top: nextScroll,
      behavior: "smooth",
    });
  } else {
    refs.galleryScrollRegion.scrollTop = nextScroll;
  }
}

function handleGalleryThumbPointerMove(event) {
  if (!galleryScrollDrag.active || !refs.galleryScrollRegion) {
    return;
  }

  const metrics = getGalleryScrollMetrics();
  if (metrics.maxOffset <= 0) {
    return;
  }

  const nextOffset = Math.min(
    metrics.maxOffset,
    Math.max(0, galleryScrollDrag.startOffset + (event.clientY - galleryScrollDrag.startY)),
  );
  refs.galleryScrollRegion.scrollTop = (nextOffset / metrics.maxOffset) * metrics.maxScroll;
}

function bindGalleryScrollSync() {
  if (
    !refs.galleryScrollRegion ||
    !refs.gallerySections ||
    !refs.galleryScrollThumb ||
    !refs.galleryScrollTrack ||
    !refs.galleryScrollUp ||
    !refs.galleryScrollDown
  ) {
    return;
  }

  refs.galleryScrollRegion.addEventListener(
    "scroll",
    () => {
      syncGalleryScrollUi();
    },
    { passive: true },
  );

  refs.galleryScrollTrack.addEventListener("pointerdown", (event) => {
    if (event.target === refs.galleryScrollThumb) {
      return;
    }

    scrollGalleryTrackTo(event.clientY, true);
  });

  refs.galleryScrollThumb.addEventListener("pointerdown", (event) => {
    const metrics = getGalleryScrollMetrics();
    if (metrics.disabled) {
      return;
    }

    event.preventDefault();
    galleryScrollDrag.active = true;
    galleryScrollDrag.pointerId = event.pointerId;
    galleryScrollDrag.startY = event.clientY;
    galleryScrollDrag.startOffset = metrics.offset;
    refs.galleryScrollThumb.setPointerCapture?.(event.pointerId);
    setGalleryDragging(true);
  });

  refs.galleryScrollUp.addEventListener("click", () => {
    scrollGalleryBy(-1);
  });

  refs.galleryScrollDown.addEventListener("click", () => {
    scrollGalleryBy(1);
  });

  window.addEventListener("pointermove", handleGalleryThumbPointerMove);
  window.addEventListener("pointerup", endGalleryThumbDrag);
  window.addEventListener("pointercancel", endGalleryThumbDrag);

  window.addEventListener("resize", () => {
    scheduleGalleryScrollSync();
  });

  if (typeof ResizeObserver === "function") {
    galleryScrollObserver = new ResizeObserver(() => {
      scheduleGalleryScrollSync();
    });
    galleryScrollObserver.observe(refs.galleryScrollRegion);
    galleryScrollObserver.observe(refs.gallerySections);
  }
}

function renderRatioGrid() {
  refs.ratioGrid.innerHTML = "";

  getVisibleRatios().forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ratio-chip";
    if (refs.ratioInput.value === option.value) {
      button.classList.add("active");
    }

    const title = document.createElement("strong");
    title.textContent = option.value;
    button.appendChild(title);

    button.addEventListener("click", () => {
      refs.ratioInput.value = option.value;
      renderRatioGrid();
      renderSizeOptions();
    });

    refs.ratioGrid.appendChild(button);
  });
}

function syncConfigUi(config) {
  refs.baseUrlInput.value = config.baseUrl || "";
  refs.responsesModelInput.value = config.responsesModel || "gpt-5.5";
  refs.savedKeyMask.textContent = config.apiKeyConfigured ? `已保存 ${config.apiKeyMask || ""}` : "未保存";
  refs.configStatus.textContent = config.apiKeyConfigured ? "配置已保存" : "配置未保存";
  state.aspectRatios = config.aspectRatios || [];
  const configLimits = config.limits || {};
  state.limits = {
    ...DEFAULT_LIMITS,
    ...configLimits,
    maxConcurrentTasksPerSession:
      "maxConcurrentTasksPerSession" in configLimits
        ? configLimits.maxConcurrentTasksPerSession || DEFAULT_LIMITS.maxConcurrentTasksPerSession
        : DEFAULT_LIMITS.maxConcurrentTasksPerSession,
  };
  state.reasoningEfforts = [...(config.reasoningEfforts || DEFAULT_REASONING_EFFORTS)];

  if (!refs.ratioInput.value || !getRatioOption(refs.ratioInput.value)) {
    refs.ratioInput.value = DEFAULT_UI_RATIO;
  }

  renderRatioGrid();
  renderReasoningOptions();
  renderOutputFormatOptions();
  renderSizeOptions();
  syncConnectionState();
  updateGenerateButton();
  renderReferenceGrid();
}

function ensureSelectedPreview() {
  if (state.selectedPreviewKey.startsWith("job:")) {
    const selectedJobId = state.selectedPreviewKey.slice(4);
    if (state.jobs.some((job) => job.id === selectedJobId)) {
      return;
    }
  }

  if (state.selectedPreviewKey.startsWith("file:")) {
    const selectedFilename = state.selectedPreviewKey.slice(5);
    if (state.gallery.some((item) => item.filename === selectedFilename)) {
      return;
    }
  }

  const latestJob = sortGalleryItemsByCreatedAtDesc(state.jobs)[0];
  if (latestJob) {
    state.selectedPreviewKey = makeJobPreviewKey(latestJob.id);
    return;
  }

  const sortedGallery = sortGalleryItemsByCreatedAtDesc(state.gallery);
  const preferredGalleryItem = sortedGallery[0] || null;
  state.selectedPreviewKey = preferredGalleryItem ? makeGalleryPreviewKey(preferredGalleryItem.filename) : "";
}

function setSelectedPreviewKey(key) {
  state.selectedPreviewKey = key || "";
  state.zoom = 1;
  renderStudio();
}

function getSelectedJob() {
  if (!state.selectedPreviewKey.startsWith("job:")) {
    return null;
  }

  return state.jobs.find((job) => job.id === state.selectedPreviewKey.slice(4)) || null;
}

function getSelectedGalleryItem() {
  if (!state.selectedPreviewKey.startsWith("file:")) {
    return null;
  }

  return state.gallery.find((item) => item.filename === state.selectedPreviewKey.slice(5)) || null;
}

function getCurrentPreviewItem() {
  return getSelectedJob() || getSelectedGalleryItem() || null;
}

function openLightbox(item) {
  if (!item || !getImageUrl(item)) {
    return;
  }

  state.lightboxItem = item;
  state.lightboxZoomed = false;
  syncLightboxItem();
  syncLightboxZoomState();
  setLightboxOpen(true);
}

function closeLightbox() {
  state.lightboxItem = null;
  state.lightboxZoomed = false;
  resetPromptCopyFeedback();
  syncLightboxZoomState();
  setLightboxOpen(false);
}

function syncLightboxItem() {
  if (!state.lightboxItem) {
    refs.copyPromptButton.disabled = true;
    resetPromptCopyFeedback();
    return;
  }

  const fresh =
    (state.lightboxItem.filename && state.gallery.find((item) => item.filename === state.lightboxItem.filename)) ||
    (state.lightboxItem.id && state.jobs.find((job) => job.id === state.lightboxItem.id)) ||
    state.lightboxItem;

  const imageUrl = getImageUrl(fresh);
  state.lightboxItem = fresh;
  refs.lightboxModel.textContent = formatImageModelLabel(fresh.imageModel);
  refs.lightboxTime.textContent = formatTime(fresh.createdAt);
  refs.lightboxId.textContent = `ID: ${getDisplayId(fresh)}`;
  refs.lightboxPrompt.value = getDisplayPrompt(fresh);
  refs.lightboxParams.value = buildParameterText(fresh, state.config || {});
  refs.copyPromptButton.disabled = refs.lightboxPrompt.value.trim().length === 0;
  resetPromptCopyFeedback();
  refs.lightboxImage.src = imageUrl;
  refs.lightboxImage.alt = getDisplayPrompt(fresh);
  refs.lightboxAmbient.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "";
  refs.lightboxDownload.href = imageUrl || "#";
  refs.lightboxDownload.download = fresh.filename || "preview.png";
  refs.lightboxDelete.disabled = !fresh.filename;
  syncLightboxZoomState();
}

function getJobActivitySize(jobId) {
  return state.jobs.find((job) => job.id === jobId)?.size || "";
}

function getJobActivityRatio(jobId) {
  return state.jobs.find((job) => job.id === jobId)?.ratio || "";
}

function recordActivity({ key, title, detail, ratio, size, status, at }) {
  const nextAt = at || nowIso();
  const nextRatio = formatCompactRatioLabel(ratio);
  const nextSize = formatCompactSizeLabel(size);
  const existing = state.activityFeed.find((item) => item.key === key);
  state.activityFeed = upsertGenerationActivityEntry(state.activityFeed, {
    key,
    title,
    detail,
    ratio: nextRatio || existing?.ratio || "",
    size: nextSize || existing?.size || "",
    status,
    at: nextAt,
  });
  writeGenerationActivityFeed();
}

async function copyLightboxPrompt() {
  const promptText = refs.lightboxPrompt.value;
  if (!promptText.trim()) {
    return;
  }

  if (!navigator.clipboard || typeof navigator.clipboard.writeText !== "function") {
    throw new Error("当前浏览器不支持复制提示词。");
  }

  await navigator.clipboard.writeText(refs.lightboxPrompt.value);
  markPromptCopied();
}

function recordJobQueued(job) {
  recordActivity({
    key: `${job.id}:task`,
    title: GENERATION_TASK_STATUS_LABELS.running,
    detail: "等待资源分配",
    ratio: job.ratio,
    size: job.size,
    status: "active",
    at: job.createdAt,
  });
}

function handleActivityStatus(jobId, stage, message) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.running,
    detail: message || (stage === "saving" ? "正在保存到本地图片目录" : "正在生成图片"),
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "active",
    at: nowIso(),
  });
}

function handleActivityPartial(jobId) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.running,
    detail: "已收到中途预览",
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "active",
    at: nowIso(),
  });
}

function handleActivityFinal(jobId) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.running,
    detail: "正在写入本地 output",
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "active",
    at: nowIso(),
  });
}

function handleActivitySuccess(jobId) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.completed,
    detail: "图像已成功生成",
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "done",
    at: nowIso(),
  });
}

function handleActivityFailure(jobId, message) {
  recordActivity({
    key: `${jobId}:task`,
    title: GENERATION_TASK_STATUS_LABELS.error,
    detail: compactErrorMessage(message, "生成请求失败"),
    ratio: getJobActivityRatio(jobId),
    size: getJobActivitySize(jobId),
    status: "error",
    at: nowIso(),
  });
}

function handleActivityCanceled(job) {
  recordActivity({
    key: `${job.id}:task`,
    title: "已取消",
    detail: `已取消排队任务 · ${compactTimelineText(job.prompt)}`,
    ratio: job.ratio,
    size: job.size,
    status: "pending",
    at: nowIso(),
  });
}

function recordGenerationTaskActivity(task) {
  const status = normalizeGenerationTaskStatus(task?.status);
  const statusText =
    status === "error"
      ? compactErrorMessage(task?.errorMessage || task?.statusText, "生成请求失败")
      : String(task?.statusText || "").trim();
  const promptText = compactTimelineText(task?.prompt);
  const detail = statusText ? `${statusText} · ${promptText}` : promptText;

  recordActivity({
    key: `${task.id}:task`,
    title: GENERATION_TASK_STATUS_LABELS[status],
    detail,
    ratio: formatCompactRatioLabel(task?.ratio),
    size: formatCompactSizeLabel(task?.size),
    status: GENERATION_TASK_TIMELINE_STATUS[status],
    at: task.updatedAt || task.createdAt,
  });
}

function getTimelineItems() {
  if (state.activityFeed.length > 0) {
    return state.activityFeed;
  }

  const current = getCurrentPreviewItem();
  if (current?.createdAt) {
    return [
      {
        key: "complete:fallback",
        title: GENERATION_TASK_STATUS_LABELS.completed,
        detail: "图像已成功生成",
        ratio: current.ratio || current.json?.aspect_ratio,
        size: current.size,
        status: "done",
        at: current.createdAt,
      },
    ];
  }

  return [
    {
      key: "running:idle",
      title: GENERATION_TASK_STATUS_LABELS.running,
      detail: "等待任务开始",
      status: "pending",
      at: "",
    },
    {
      key: "completed:idle",
      title: GENERATION_TASK_STATUS_LABELS.completed,
      detail: "等待生成结果",
      status: "pending",
      at: "",
    },
    {
      key: "error:idle",
      title: GENERATION_TASK_STATUS_LABELS.error,
      detail: "暂无错误",
      status: "pending",
      at: "",
    },
  ];
}

function isTimelineAtTop() {
  return refs.timelineList.scrollTop <= 4;
}

function getTimelineItemSignature(item) {
  return [item.key, item.title, item.detail, item.ratio || "", item.size || "", item.status, item.at || ""].join("\u001f");
}

function countTimelineChanges(items) {
  if (!state.timelineHasRendered) {
    return 0;
  }

  return items.reduce((count, item) => {
    return state.timelineSignatures.get(item.key) === getTimelineItemSignature(item) ? count : count + 1;
  }, 0);
}

function getTimelineScrollAnchor() {
  const listRect = refs.timelineList.getBoundingClientRect();
  return [...refs.timelineList.children].reduce((anchor, row) => {
    if (anchor) {
      return anchor;
    }

    const rowRect = row.getBoundingClientRect();
    return rowRect.bottom >= listRect.top + 1
      ? { key: row.dataset.timelineKey, offset: rowRect.top - listRect.top }
      : null;
  }, null);
}

function restoreTimelineScrollAnchor(anchor, fallbackScrollTop) {
  if (!anchor?.key) {
    refs.timelineList.scrollTop = fallbackScrollTop;
    return;
  }

  const row = [...refs.timelineList.children].find((candidate) => candidate.dataset.timelineKey === anchor.key);
  if (!row) {
    refs.timelineList.scrollTop = fallbackScrollTop;
    return;
  }

  const rowRect = row.getBoundingClientRect();
  const listRect = refs.timelineList.getBoundingClientRect();
  refs.timelineList.scrollTop += rowRect.top - listRect.top - anchor.offset;
}

function setTimelineSignatures(items) {
  state.timelineSignatures = new Map(items.map((item) => [item.key, getTimelineItemSignature(item)]));
  state.timelineHasRendered = true;
}

function renderTimelineNewIndicator() {
  refs.timelineNewCount.textContent = String(state.timelineUnreadCount);
  refs.timelineNewIndicator.classList.toggle("hidden", state.timelineUnreadCount <= 0);
}

function handleTimelineScroll() {
  if (!isTimelineAtTop()) {
    return;
  }

  state.timelineUnreadCount = 0;
  renderTimelineNewIndicator();
}

function scrollTimelineToNewest() {
  refs.timelineList.scrollTo({ top: 0, behavior: "smooth" });
  state.timelineUnreadCount = 0;
  renderTimelineNewIndicator();
}

function renderTimeline() {
  const items = getTimelineItems();
  const isAtTop = isTimelineAtTop();
  const previousScrollTop = refs.timelineList.scrollTop;
  const scrollAnchor = isAtTop ? null : getTimelineScrollAnchor();
  const changedCount = countTimelineChanges(items);

  refs.timelineList.innerHTML = "";

  items.forEach((item) => {
    const row = document.createElement("li");
    row.className = `timeline-item ${item.status}`;
    row.dataset.timelineKey = item.key;

    const dot = document.createElement("span");
    dot.className = "timeline-dot";
    row.appendChild(dot);

    const copy = document.createElement("div");
    copy.className = "timeline-copy";

    const title = document.createElement("strong");
    title.textContent = item.title;
    copy.appendChild(title);

    const detail = document.createElement("span");
    detail.textContent = item.detail;
    copy.appendChild(detail);

    row.appendChild(copy);

    const ratio = document.createElement("span");
    ratio.className = "timeline-ratio";
    ratio.textContent = formatCompactRatioLabel(item.ratio);
    row.appendChild(ratio);

    const resolution = document.createElement("span");
    resolution.className = "timeline-resolution";
    resolution.textContent = formatCompactSizeLabel(item.size);
    row.appendChild(resolution);

    const time = document.createElement("time");
    time.textContent = formatClock(item.at);
    row.appendChild(time);

    refs.timelineList.appendChild(row);
  });

  if (isAtTop) {
    state.timelineUnreadCount = 0;
    refs.timelineList.scrollTop = 0;
  } else {
    restoreTimelineScrollAnchor(scrollAnchor, previousScrollTop);
    state.timelineUnreadCount += changedCount;
  }

  setTimelineSignatures(items);
  renderTimelineNewIndicator();
}

function createPreviewMotionNode() {
  const motion = document.createElement("div");
  motion.className = "preview-loading-motion";
  motion.setAttribute("aria-hidden", "true");

  const track = document.createElement("span");
  track.className = "preview-loading-track";

  const progress = document.createElement("span");
  progress.className = "preview-loading-progress";
  track.appendChild(progress);

  const signal = document.createElement("span");
  signal.className = "preview-loading-signal";

  motion.append(track, signal);

  return motion;
}

function createPreviewLoadingShellNodes() {
  const eyebrow = document.createElement("p");
  const shell = document.createElement("div");
  shell.className = "preview-loading-shell";
  shell.appendChild(createPreviewMotionNode());

  const copy = document.createElement("div");
  copy.className = "preview-loading-copy";

  const title = document.createElement("h3");
  copy.appendChild(title);

  const metrics = document.createElement("div");
  metrics.className = "preview-loading-metrics";

  const jobMetric = document.createElement("span");
  jobMetric.className = "preview-loading-metric";
  metrics.appendChild(jobMetric);

  const progressMetric = document.createElement("span");
  progressMetric.className = "preview-loading-metric";
  metrics.appendChild(progressMetric);

  copy.appendChild(metrics);

  const status = document.createElement("strong");
  status.className = "preview-loading-status";
  copy.appendChild(status);

  const detail = document.createElement("span");
  detail.className = "preview-loading-detail";
  copy.appendChild(detail);

  shell.appendChild(copy);

  const steps = document.createElement("div");
  steps.className = "preview-loading-steps";
  steps.setAttribute("aria-hidden", "true");
  shell.appendChild(steps);

  return {
    eyebrow,
    shell,
    title,
    jobMetric,
    progressMetric,
    status,
    detail,
    steps,
    state: null,
  };
}

function syncPreviewLoadingSteps(container, steps) {
  const signature = steps.map((step) => `${step.key}:${step.state}:${step.label}`).join("|");
  if (container.dataset.stepsSignature === signature) {
    return;
  }

  container.replaceChildren();
  steps.forEach((step) => {
    const chip = document.createElement("span");
    chip.className = `preview-loading-step is-${step.state}`;
    chip.textContent = step.label;
    container.appendChild(chip);
  });
  container.dataset.stepsSignature = signature;
}

function updatePreviewLoadingShell(nodes, placeholderState) {
  const theme = getPreviewLoadingShellTheme(placeholderState);
  nodes.eyebrow.textContent = placeholderState.eyebrow;
  nodes.shell.dataset.stage = theme.stage;
  nodes.shell.dataset.jobs = String(placeholderState.activeJobCount);
  nodes.shell.style.setProperty("--loading-progress", theme.progress);
  nodes.shell.style.setProperty("--loading-progress-position", theme.progressPosition);
  nodes.shell.style.setProperty("--loading-sweep-duration", theme.sweepDuration);
  nodes.shell.style.setProperty("--loading-signal-duration", theme.signalDuration);
  nodes.shell.style.setProperty("--loading-motion-scale", theme.motionScale);
  nodes.title.textContent = placeholderState.title;
  nodes.jobMetric.textContent = placeholderState.jobCountLabel;
  nodes.progressMetric.textContent = placeholderState.progressLabel;
  nodes.status.textContent = placeholderState.statusText;
  nodes.detail.textContent = placeholderState.detail;
  syncPreviewLoadingSteps(nodes.steps, placeholderState.steps);
  nodes.state = {
    mode: placeholderState.mode,
    stage: placeholderState.stage,
  };
}

function renderPreviewPlaceholder(placeholderState) {
  refs.previewPlaceholder.className = "preview-placeholder";
  if (placeholderState.mode === "loading") {
    refs.previewPlaceholder.classList.add("preview-placeholder-loading");

    if (
      !previewLoadingShellNodes ||
      !shouldReusePreviewLoadingShell(previewLoadingShellNodes.state || {}, placeholderState)
    ) {
      previewLoadingShellNodes = createPreviewLoadingShellNodes();
    }

    updatePreviewLoadingShell(previewLoadingShellNodes, placeholderState);

    if (
      refs.previewPlaceholder.firstChild !== previewLoadingShellNodes.eyebrow ||
      refs.previewPlaceholder.lastChild !== previewLoadingShellNodes.shell
    ) {
      refs.previewPlaceholder.replaceChildren(previewLoadingShellNodes.eyebrow, previewLoadingShellNodes.shell);
    }

    return;
  }

  previewLoadingShellNodes = null;
  refs.previewPlaceholder.replaceChildren();

  const eyebrow = document.createElement("p");
  eyebrow.textContent = placeholderState.eyebrow;
  refs.previewPlaceholder.appendChild(eyebrow);

  const title = document.createElement("h3");
  title.textContent = placeholderState.title;
  refs.previewPlaceholder.appendChild(title);

  const detail = document.createElement("span");
  detail.textContent = placeholderState.detail;
  refs.previewPlaceholder.appendChild(detail);
}

function renderPreview() {
  const item = getCurrentPreviewItem();
  const imageUrl = getImageUrl(item);
  const placeholderState = getPreviewPlaceholderState({
    item,
    imageUrl,
    prompt: item ? getDisplayPrompt(item) : "",
    runningCount: state.jobs.length,
    maxConcurrentTasks: state.limits.maxConcurrentTasksPerSession,
  });

  refs.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;

  if (placeholderState.mode === "idle") {
    refs.previewModel.textContent = "GPT Image 2.0";
    refs.previewTime.textContent = "等待生成";
    refs.previewId.textContent = "ID: --";
    refs.previewSize.textContent = "--";
    refs.previewPlaceholder.classList.remove("hidden");
    renderPreviewPlaceholder(placeholderState);
    refs.previewImage.removeAttribute("src");
    refs.previewImage.classList.remove("is-mounted", "is-visible");
    refs.previewDownloadButton.removeAttribute("href");
    refs.previewDownloadButton.removeAttribute("download");
    refs.previewDownloadButton.classList.add("disabled");
    refs.previewLightboxButton.disabled = true;
    refs.previewDeleteButton.disabled = true;
    return;
  }

  refs.previewModel.textContent = formatImageModelLabel(item.imageModel);
  refs.previewTime.textContent = formatTime(item.createdAt);
  refs.previewId.textContent = `ID: ${getDisplayId(item)}`;
  refs.previewSize.textContent = formatCanvasLabel(item.size);

  if (placeholderState.mode === "loading") {
    refs.previewPlaceholder.classList.remove("hidden");
    renderPreviewPlaceholder(placeholderState);
    refs.previewImage.removeAttribute("src");
    refs.previewImage.classList.remove("is-mounted", "is-visible");
    refs.previewDownloadButton.removeAttribute("href");
    refs.previewDownloadButton.removeAttribute("download");
    refs.previewDownloadButton.classList.add("disabled");
    refs.previewLightboxButton.disabled = true;
    refs.previewDeleteButton.disabled = true;
    return;
  }

  refs.previewPlaceholder.classList.add("hidden");
  refs.previewImage.classList.remove("is-visible");
  refs.previewImage.classList.add("is-mounted");
  refs.previewImage.onload = () => {
    refs.previewImage.classList.add("is-visible");
  };
  refs.previewImage.style.transform = `scale(${state.zoom})`;
  refs.previewImage.src = imageUrl;
  refs.previewImage.alt = getDisplayPrompt(item);
  refs.previewDownloadButton.href = imageUrl;
  refs.previewDownloadButton.download = item.filename || "preview.png";
  refs.previewDownloadButton.classList.remove("disabled");
  refs.previewLightboxButton.disabled = false;
  refs.previewDeleteButton.disabled = !item.filename;
}

function getFilmstripItems() {
  const activeJobs = sortGalleryItemsByCreatedAtDesc(state.jobs).map((job) => ({
    key: makeJobPreviewKey(job.id),
    item: job,
    label: formatFilmstripSizeLabel(job) || job.statusText || formatClock(job.createdAt),
  }));

  const recentGallery = sortGalleryItemsByCreatedAtDesc(state.gallery).slice(0, 12).map((item) => ({
    key: makeGalleryPreviewKey(item.filename),
    item,
    label: formatFilmstripSizeLabel(item) || formatClock(item.createdAt),
  }));

  return [...activeJobs, ...recentGallery].slice(0, 14);
}

function renderFilmstrip() {
  refs.filmstrip.innerHTML = "";

  getFilmstripItems().forEach(({ key, item, label }) => {
    const shell = document.createElement("div");
    shell.className = "filmstrip-entry";

    const button = document.createElement("button");
    button.type = "button";
    button.className = "filmstrip-item";
    if (key === state.selectedPreviewKey) {
      button.classList.add("active");
    }

    const imageUrl = getImageUrl(item);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = getDisplayPrompt(item);
      image.loading = "lazy";
      button.appendChild(image);
    } else {
      const ghost = document.createElement("div");
      ghost.className = "filmstrip-ghost";
      ghost.textContent = "处理中";
      button.appendChild(ghost);
    }

    const caption = document.createElement("span");
    caption.textContent = label;
    button.appendChild(caption);

    button.addEventListener("click", () => {
      setSelectedPreviewKey(key);
    });

    shell.appendChild(button);

    if (key.startsWith("job:") && isQueuedGenerationJob(item)) {
      const cancelButton = document.createElement("button");
      cancelButton.type = "button";
      cancelButton.className = "filmstrip-cancel";
      cancelButton.textContent = "×";
      cancelButton.title = "取消排队任务";
      cancelButton.setAttribute("aria-label", "取消排队任务");
      cancelButton.addEventListener("click", (event) => {
        event.stopPropagation();
        cancelQueuedJob(item.id);
      });
      shell.appendChild(cancelButton);
    }

    refs.filmstrip.appendChild(shell);
  });
}

function createRecentOutputItem(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "recent-item";
  if (makeGalleryPreviewKey(item.filename) === state.selectedPreviewKey) {
    button.classList.add("active");
  }

  button.addEventListener("click", () => {
    setSelectedPreviewKey(makeGalleryPreviewKey(item.filename));
  });

  const image = document.createElement("img");
  image.src = getImageUrl(item);
  image.alt = getDisplayPrompt(item);
  image.loading = "lazy";
  button.appendChild(image);

  const copy = document.createElement("div");
  copy.className = "recent-copy";
  copy.innerHTML = `
    <strong>${getDisplayPrompt(item)}</strong>
    <span>${formatRecentOutputMeta(item)}</span>
    <time>${formatClock(item.createdAt)}</time>
  `;
  button.appendChild(copy);

  const actions = document.createElement("div");
  actions.className = "recent-actions";

  const download = document.createElement("a");
  download.className = "mini-action";
  download.href = getImageUrl(item);
  download.download = item.filename;
  download.textContent = "↓";
  download.addEventListener("click", (event) => {
    event.stopPropagation();
  });
  actions.appendChild(download);

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "mini-action";
  remove.textContent = "⋯";
  remove.addEventListener("click", (event) => {
    event.stopPropagation();
    deleteGalleryItem(item).catch((error) => {
      showError(error.message);
    });
  });
  actions.appendChild(remove);

  button.appendChild(actions);
  return button;
}

function renderRecentOutputs() {
  if (!refs.recentList || !refs.recentEmpty) {
    return;
  }

  refs.recentList.innerHTML = "";
  refs.recentEmpty.classList.toggle("hidden", state.gallery.length > 0);

  getRecentGalleryItems(state.gallery).forEach((item) => {
    refs.recentList.appendChild(createRecentOutputItem(item));
  });
}

function createGalleryTile(item) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "gallery-tile";
  button.addEventListener("click", () => {
    openLightbox(item);
  });

  const image = document.createElement("img");
  image.src = getImageUrl(item);
  image.alt = getDisplayPrompt(item);
  image.loading = "lazy";
  button.appendChild(image);
  return button;
}

function normalizeGalleryColumnPreset(value) {
  const preset = Number(value);
  return GALLERY_COLUMN_PRESETS.includes(preset) ? preset : DEFAULT_GALLERY_COLUMN_PRESET;
}

function getGalleryColumnCount() {
  return normalizeGalleryColumnPreset(state.galleryColumnPreset);
}

function renderGalleryColumnPresetButtons() {
  refs.galleryColumnButtons.forEach((button) => {
    const isActive = normalizeGalleryColumnPreset(button.dataset.galleryColumnPreset) === state.galleryColumnPreset;
    button.classList.toggle("active", isActive);
    button.setAttribute("aria-pressed", String(isActive));
  });
}

function getVisibleGalleryItems(overrides = {}) {
  return filterGalleryItems(state.gallery, getGalleryFilterSnapshot(overrides));
}

function getGallerySectionItemCount(sections) {
  return sections.reduce((total, section) => total + section.items.length, 0);
}

function getSearchGalleryPagination(sections) {
  return {
    page: 0,
    pageSize: sections.length || 1,
    totalPages: 1,
    totalSections: sections.length,
    startSection: sections.length === 0 ? 0 : 1,
    endSection: sections.length,
    hasPrevious: false,
    hasNext: false,
    sections,
  };
}

function renderGalleryPagination(pagination, shouldPaginateHistory) {
  if (
    !refs.galleryPagination ||
    !refs.galleryPreviousPageButton ||
    !refs.galleryNextPageButton ||
    !refs.galleryPageStatus
  ) {
    return;
  }

  const isHidden = !shouldPaginateHistory || pagination.totalPages <= 1;
  refs.galleryPagination.classList.toggle("hidden", isHidden);
  refs.galleryPreviousPageButton.disabled = !pagination.hasPrevious;
  refs.galleryNextPageButton.disabled = !pagination.hasNext;
  refs.galleryPageStatus.textContent = `第 ${pagination.page + 1} / ${pagination.totalPages} 页`;
}

function resetGalleryHistoryPage() {
  state.galleryHistoryPage = 0;
}

function setGalleryHistoryPage(page) {
  state.galleryHistoryPage = Math.max(0, Number(page) || 0);
  renderGalleryView();
  refs.galleryScrollRegion?.scrollTo({ top: 0, behavior: "smooth" });
}

function renderGalleryFilters(visibleItems, sections, pagination, shouldPaginateHistory) {
  const filters = getGalleryFilterSnapshot();
  const timeOptions = buildGalleryTimeFilterOptions(getVisibleGalleryItems({ window: "all" }));
  const sizeOptions = buildGallerySizeFilterOptions(getVisibleGalleryItems({ size: "all" }));
  const referenceOptions = buildGalleryReferenceFilterOptions(getVisibleGalleryItems({ reference: "all" }));
  const resolvedSizeOptions =
    filters.size === "all" || sizeOptions.some((option) => option.value === filters.size)
      ? sizeOptions
      : [...sizeOptions, { value: filters.size, label: formatCanvasLabel(filters.size), count: 0 }];

  refs.gallerySearchInput.value = filters.query;
  refs.galleryDateInput.value = filters.date;
  renderGallerySelectOptions(refs.gallerySizeFilterInput, resolvedSizeOptions, filters.size);
  renderGallerySelectOptions(refs.galleryReferenceFilterInput, referenceOptions, filters.reference);
  refs.galleryResetFiltersButton.disabled = !hasActiveGalleryFilters(filters);

  refs.galleryFilters.innerHTML = "";
  timeOptions.forEach((option) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "gallery-filter-chip";

    if (option.value === filters.window) {
      button.classList.add("active");
    }

    button.textContent = `${option.label} · ${option.count}`;
    button.addEventListener("click", () => {
      state.galleryControls.window = option.value;
      if (option.value !== "all") {
        state.galleryControls.date = "";
      }
      resetGalleryHistoryPage();
      renderGalleryView();
    });
    refs.galleryFilters.appendChild(button);
  });

  const summary = formatGalleryFilterSummary(filters);
  if (visibleItems.length === 0) {
    refs.galleryHelperText.textContent = summary
      ? `没有匹配 ${summary} 的结果。`
      : "按日期分组显示，可按关键词、日期、尺寸和参考图快速筛选。";
    return;
  }

  const prefix = summary ? `已按 ${summary} 筛选，` : "";
  const displayedCount = getGallerySectionItemCount(sections);
  if (!shouldPaginateHistory) {
    refs.galleryHelperText.textContent = `${prefix}搜索模式仅显示命中的 ${visibleItems.length} / ${state.gallery.length} 张。`;
    return;
  }

  if (pagination.totalPages > 1) {
    refs.galleryHelperText.textContent = `${prefix}每页显示 5 天历史，第 ${pagination.page + 1} / ${pagination.totalPages} 页，当前 ${sections.length} 组、${displayedCount} / ${visibleItems.length} 张。`;
    return;
  }

  refs.galleryHelperText.textContent = `${prefix}按日期分组显示，当前共 ${sections.length} 组，显示 ${visibleItems.length} / ${state.gallery.length} 张。`;
}

function createGallerySection(section) {
  const wrapper = document.createElement("section");
  wrapper.className = "gallery-section";

  const header = document.createElement("div");
  header.className = "gallery-section-head";

  const copy = document.createElement("div");
  copy.className = "gallery-section-copy";

  const dateText = document.createElement("strong");
  dateText.textContent = section.dateText || section.label;
  copy.appendChild(dateText);

  header.appendChild(copy);

  const count = document.createElement("span");
  count.className = "count-pill small";
  count.textContent = `${section.count} 张`;
  header.appendChild(count);

  wrapper.appendChild(header);

  const masonry = document.createElement("div");
  masonry.className = "gallery-masonry";
  const columnCount = Math.min(section.items.length || 1, getGalleryColumnCount());
  masonry.style.setProperty("--gallery-columns", String(columnCount));
  distributeGalleryItemsIntoColumns(section.items, columnCount).forEach((columnItems) => {
    const column = document.createElement("div");
    column.className = "gallery-masonry-column";
    columnItems.forEach((item) => {
      column.appendChild(createGalleryTile(item));
    });
    masonry.appendChild(column);
  });
  wrapper.appendChild(masonry);

  return wrapper;
}

function renderGalleryView() {
  const filters = getGalleryFilterSnapshot();
  const visibleItems = getVisibleGalleryItems();
  const allSections = buildGallerySections(visibleItems);
  const shouldPaginateHistory = !filters.query;
  const pagination = shouldPaginateHistory
    ? paginateGallerySections(allSections, state.galleryHistoryPage)
    : getSearchGalleryPagination(allSections);
  if (shouldPaginateHistory && pagination.page !== state.galleryHistoryPage) {
    state.galleryHistoryPage = pagination.page;
  }
  const sections = pagination.sections;
  const displayedCount = getGallerySectionItemCount(sections);

  refs.gallerySections.innerHTML = "";
  refs.galleryCount.textContent =
    displayedCount === state.gallery.length
      ? `${state.gallery.length} 张`
      : `${displayedCount} / ${state.gallery.length} 张`;
  refs.galleryEmpty.textContent =
    state.gallery.length === 0
      ? "还没有本地输出，先回到 Studio 生成一张图。"
      : hasActiveGalleryFilters(filters)
        ? "当前筛选没有命中结果，试试清空部分筛选。"
        : "当前还没有可展示的本地输出。";
  refs.galleryEmpty.classList.toggle("hidden", displayedCount > 0);
  renderGalleryPagination(pagination, shouldPaginateHistory);
  renderGalleryFilters(visibleItems, sections, pagination, shouldPaginateHistory);
  renderGalleryColumnPresetButtons();

  sections.forEach((section) => {
    refs.gallerySections.appendChild(createGallerySection(section));
  });

  scheduleGalleryPanelHeightSync();
  scheduleGalleryScrollSync();
}

function renderStudio() {
  ensureSelectedPreview();
  renderPreview();
  renderFilmstrip();
  renderRecentOutputs();
  scheduleStudioHeightSync();
}

function renderAll() {
  const settingsScrollTop = getSettingsFormScrollTop();

  ensureSelectedPreview();
  syncConnectionState();
  updateGenerateButton();
  renderTimeline();
  renderStudio();
  renderPptView();
  renderGalleryView();
  syncLightboxItem();

  restoreSettingsFormScrollTop(settingsScrollTop);
}

function upsertGalleryItem(item) {
  const hydratedItem = mergeGalleryItemWithCachedMetadata(item, state.galleryMetadataCache[item?.filename]);
  const next = state.gallery.filter((entry) => entry.filename !== hydratedItem.filename);
  next.unshift(hydratedItem);
  state.gallery = sortGalleryItemsByCreatedAtDesc(next);
  resetGalleryHistoryPage();
  syncGalleryMetadataCache(state.gallery);
  void cacheBrowserGalleryItem(hydratedItem);
}

function createPromptTemplateId() {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizePromptTemplate(template, index = 0) {
  const prompt = String(template?.prompt || "").trim();
  if (!prompt) {
    return null;
  }

  return {
    id: String(template?.id || createPromptTemplateId()),
    name: String(template?.name || `模板 ${index + 1}`).trim() || `模板 ${index + 1}`,
    prompt,
  };
}

function readPromptTemplates() {
  try {
    const raw = window.localStorage.getItem(PROMPT_TEMPLATE_STORAGE_KEY);
    if (raw === null) {
      return DEFAULT_PROMPT_TEMPLATES.map((template) => ({ ...template }));
    }

    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.map(normalizePromptTemplate).filter(Boolean) : [];
  } catch {
    return DEFAULT_PROMPT_TEMPLATES.map((template) => ({ ...template }));
  }
}

function writePromptTemplates() {
  window.localStorage.setItem(PROMPT_TEMPLATE_STORAGE_KEY, JSON.stringify(state.promptTemplates));
}

function getSelectedPromptTemplate() {
  return state.promptTemplates.find((template) => template.id === state.selectedPromptTemplateId) || null;
}

function setPromptTemplateFeedback(message = "") {
  refs.promptTemplateFeedback.textContent = message;
}

function selectPromptTemplate(templateId) {
  const template = state.promptTemplates.find((entry) => entry.id === templateId) || state.promptTemplates[0] || null;
  state.selectedPromptTemplateId = template?.id || "";
  refs.promptTemplateNameInput.value = template?.name || "";
  refs.promptTemplateTextInput.value = template?.prompt || "";
  renderPromptTemplates();
}

function renderPromptTemplates() {
  refs.promptTemplateList.innerHTML = "";

  if (state.promptTemplates.length === 0) {
    const empty = document.createElement("div");
    empty.className = "prompt-template-empty";
    empty.textContent = "暂无模板";
    refs.promptTemplateList.appendChild(empty);
    return;
  }

  state.promptTemplates.forEach((template) => {
    const row = document.createElement("div");
    row.className = "prompt-template-item";
    row.classList.toggle("active", template.id === state.selectedPromptTemplateId);

    const titleButton = document.createElement("button");
    titleButton.className = "prompt-template-title-button";
    titleButton.type = "button";
    titleButton.textContent = template.name;
    titleButton.title = template.name;
    titleButton.addEventListener("click", () => {
      applyPromptTemplate(template.id);
      setPromptTemplateFeedback("");
    });
    row.appendChild(titleButton);

    const actions = document.createElement("div");
    actions.className = "prompt-template-row-actions";

    const editButton = document.createElement("button");
    editButton.className = "mini-action";
    editButton.type = "button";
    editButton.textContent = "编辑";
    editButton.addEventListener("click", () => {
      editPromptTemplate(template.id);
    });
    actions.appendChild(editButton);

    const deleteButton = document.createElement("button");
    deleteButton.className = "mini-action danger";
    deleteButton.type = "button";
    deleteButton.textContent = "删除";
    deleteButton.addEventListener("click", () => {
      deletePromptTemplate(template.id);
    });
    actions.appendChild(deleteButton);

    row.appendChild(actions);
    refs.promptTemplateList.appendChild(row);
  });
}

function resetPromptTemplateForm() {
  state.selectedPromptTemplateId = "";
  refs.promptTemplateNameInput.value = "";
  refs.promptTemplateTextInput.value = "";
  refs.promptTemplateNameInput.focus();
  setPromptTemplateFeedback("");
  renderPromptTemplates();
}

function savePromptTemplate(event) {
  event.preventDefault();
  const prompt = refs.promptTemplateTextInput.value.trim();
  if (!prompt) {
    setPromptTemplateFeedback("模板内容不能为空。");
    refs.promptTemplateTextInput.focus();
    return;
  }

  const existing = getSelectedPromptTemplate();
  const name = refs.promptTemplateNameInput.value.trim() || existing?.name || `模板 ${state.promptTemplates.length + 1}`;
  if (existing) {
    existing.name = name;
    existing.prompt = prompt;
  } else {
    const template = {
      id: createPromptTemplateId(),
      name,
      prompt,
    };
    state.promptTemplates.unshift(template);
    state.selectedPromptTemplateId = template.id;
  }

  writePromptTemplates();
  selectPromptTemplate(state.selectedPromptTemplateId);
  setPromptTemplateFeedback("模板已保存。");
}

function applyPromptTemplate(templateId = "") {
  const template = templateId ? state.promptTemplates.find((entry) => entry.id === templateId) : getSelectedPromptTemplate();
  const prompt = (template?.prompt || refs.promptTemplateTextInput.value).trim();
  if (!prompt) {
    setPromptTemplateFeedback("先选择或填写一个模板。");
    refs.promptTemplateTextInput.focus();
    return;
  }

  if (template) {
    state.selectedPromptTemplateId = template.id;
  }
  refs.promptInput.value = prompt;
  updatePromptCounter();
  setPromptTemplatePopoverOpen(false);
  refs.promptInput.focus();
}

function editPromptTemplate(templateId) {
  selectPromptTemplate(templateId);
  setPromptTemplateFeedback("");
  refs.promptTemplateNameInput.focus();
}

function deletePromptTemplate(templateId = "") {
  const selected = templateId
    ? state.promptTemplates.find((template) => template.id === templateId)
    : getSelectedPromptTemplate();
  if (!selected) {
    setPromptTemplateFeedback("先选择一个模板。");
    return;
  }

  if (!window.confirm(`删除提示词模板「${selected.name}」？`)) {
    return;
  }

  state.promptTemplates = state.promptTemplates.filter((template) => template.id !== selected.id);
  writePromptTemplates();
  const next =
    state.selectedPromptTemplateId === selected.id
      ? state.promptTemplates[0] || null
      : getSelectedPromptTemplate() || state.promptTemplates[0] || null;
  state.selectedPromptTemplateId = next?.id || "";
  selectPromptTemplate(state.selectedPromptTemplateId);
  setPromptTemplateFeedback("模板已删除。");
}

function setPromptTemplatePopoverOpen(open) {
  refs.promptTemplatePopover.classList.toggle("hidden", !open);
  refs.promptTemplatePopover.setAttribute("aria-hidden", open ? "false" : "true");
  refs.surprisePromptButton.setAttribute("aria-expanded", open ? "true" : "false");

  if (open) {
    if (!state.selectedPromptTemplateId && state.promptTemplates.length > 0) {
      state.selectedPromptTemplateId = state.promptTemplates[0].id;
    }
    selectPromptTemplate(state.selectedPromptTemplateId);
    refs.promptTemplateTextInput.focus();
  }
}

function selectRandomPrompt() {
  setPromptTemplatePopoverOpen(true);
}

function resetZoom() {
  state.zoom = 1;
  renderPreview();
}

function stepZoom(delta) {
  const next = Math.min(1.8, Math.max(0.6, state.zoom + delta));
  state.zoom = Number(next.toFixed(2));
  renderPreview();
}

function parseSseChunk(chunk) {
  const lines = chunk
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter(Boolean);

  let eventName = "";
  const dataLines = [];

  for (const line of lines) {
    if (line.startsWith(":")) {
      continue;
    }

    if (line.startsWith("event:")) {
      eventName = line.slice("event:".length).trim();
      continue;
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trim());
    }
  }

  return {
    eventName,
    data: dataLines.join("\n"),
  };
}

async function consumeSse(body, onEvent) {
  const reader = body.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const chunks = buffer.split(/\r?\n\r?\n/);
    buffer = chunks.pop() ?? "";

    for (const chunk of chunks) {
      const parsed = parseSseChunk(chunk);
      if (!parsed.data || parsed.data === "[DONE]") {
        continue;
      }

      await onEvent(parsed.eventName, JSON.parse(parsed.data));
    }
  }
}

function recordFinalImageChunk(finalImageChunks, payload = {}) {
  const filename = String(payload.filename || "").trim();
  const index = Number(payload.index);
  const total = Number(payload.total);
  const chunk = String(payload.chunk || "");
  const mimeType = String(payload.mimeType || "image/png");
  if (!filename || !Number.isInteger(index) || !Number.isInteger(total) || total <= 0 || index < 0 || index >= total || !chunk) {
    return "";
  }

  const existing = finalImageChunks.get(filename) || {
    chunks: new Array(total).fill(""),
    received: 0,
    total,
    mimeType,
    dataUrl: "",
  };

  if (!existing.chunks[index]) {
    existing.chunks[index] = chunk;
    existing.received += 1;
  }

  if (existing.received === existing.total && !existing.dataUrl) {
    existing.dataUrl = `data:${existing.mimeType};base64,${existing.chunks.join("")}`;
  }

  finalImageChunks.set(filename, existing);
  return existing.dataUrl;
}

function attachChunkedImageToSavedItem(item, finalImageChunks) {
  if (!item) {
    return item;
  }

  const entry =
    finalImageChunks.get(String(item.filename || "")) ||
    [...finalImageChunks.values()].find((candidate) => candidate.dataUrl);

  if (!entry?.dataUrl) {
    return item;
  }

  const imageUrl = String(item.imageUrl || "");
  const thumbnailUrl = String(item.thumbnailUrl || "");
  const serverImageUrl = isServerImageProxyUrl(imageUrl) ? imageUrl : "";
  const serverThumbnailUrl = isServerImageProxyUrl(thumbnailUrl) ? thumbnailUrl : serverImageUrl;

  return {
    ...item,
    serverImageUrl,
    serverThumbnailUrl,
    imageUrl: entry.dataUrl,
    thumbnailUrl: entry.dataUrl,
  };
}

function setPptFeedback(message = "", kind = "") {
  refs.pptFeedback.textContent = message ? compactErrorMessage(message, "PPT 请求失败") : "";
  refs.pptFeedback.dataset.state = kind;
}

function setPptEditFeedback(message = "", kind = "") {
  refs.pptEditFeedback.textContent = message ? compactErrorMessage(message, "PPT 页面编辑失败") : "";
  refs.pptEditFeedback.dataset.state = kind;
}

function setPptSourceMode(mode) {
  state.ppt.sourceMode = PPT_SOURCE_MODES.has(mode) ? mode : "upload";
  refs.pptSourceModeInputs.forEach((input) => {
    input.checked = input.value === state.ppt.sourceMode;
  });
  refs.pptSourcePanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.pptSourcePanel !== state.ppt.sourceMode);
  });
}

function applyPptFiles(files) {
  state.ppt.files = [...(files || [])];
  renderPptView();
}

function renderPptFiles() {
  refs.pptFileList.innerHTML = "";
  refs.pptFileCount.textContent = `${state.ppt.files.length} 个文件`;

  state.ppt.files.forEach((file) => {
    const item = document.createElement("div");
    item.className = "ppt-file-item";

    const name = document.createElement("strong");
    name.textContent = file.name || "未命名文档";
    item.appendChild(name);

    const meta = document.createElement("span");
    meta.textContent = `${file.type || "application/octet-stream"} · ${formatFileSize(file.size)}`;
    item.appendChild(meta);

    refs.pptFileList.appendChild(item);
  });
}

function resetPptGenerationState() {
  state.ppt.deckId = "";
  state.ppt.outline = null;
  state.ppt.pptxUrl = "";
  state.ppt.slides = [];
  state.ppt.statusText = "正在生成 PPT 大纲";
  state.ppt.currentSlideNumber = 0;
}

function isPptSlideComplete(slide) {
  return Boolean(slide?.slideNumber && slide?.relativePath && (slide?.imageUrl || slide?.thumbnailUrl));
}

function getPptTotalSlideCount() {
  return Array.isArray(state.ppt.outline?.slides) ? state.ppt.outline.slides.length : 0;
}

function getPptCompletionStats() {
  const total = getPptTotalSlideCount();
  const completed = new Set(
    state.ppt.slides
      .filter(isPptSlideComplete)
      .map((slide) => Number(slide.slideNumber))
      .filter((slideNumber) => slideNumber >= 1 && slideNumber <= total),
  ).size;

  return { completed, total };
}

function getPptMissingSlideNumbers() {
  const { total } = getPptCompletionStats();
  const completed = new Set(
    state.ppt.slides
      .filter(isPptSlideComplete)
      .map((slide) => Number(slide.slideNumber)),
  );
  const missing = [];

  for (let slideNumber = 1; slideNumber <= total; slideNumber += 1) {
    if (!completed.has(slideNumber)) {
      missing.push(slideNumber);
    }
  }

  return missing;
}

function getCompletedPptSlides() {
  return state.ppt.slides.filter(isPptSlideComplete).map((slide) => ({
    slideNumber: slide.slideNumber,
    title: slide.title,
    filename: slide.filename,
    relativePath: slide.relativePath,
    imageUrl: slide.imageUrl,
    thumbnailUrl: slide.thumbnailUrl,
    prompt: slide.prompt,
  }));
}

function upsertPptSlide(slide) {
  const slideNumber = Number(slide?.slideNumber);
  if (!slideNumber) {
    return;
  }

  const next = state.ppt.slides.filter((entry) => Number(entry.slideNumber) !== slideNumber);
  next.push({ ...slide, slideNumber });
  state.ppt.slides = next.sort((left, right) => Number(left.slideNumber) - Number(right.slideNumber));
}

function markPptSlideFailed(slideNumber, message) {
  const number = Number(slideNumber);
  if (!number) {
    return;
  }

  const outlineSlide = state.ppt.outline?.slides?.find((slide) => Number(slide.slideNumber) === number);
  upsertPptSlide({
    slideNumber: number,
    title: outlineSlide?.title || `第 ${number} 页`,
    statusText: "生成失败",
    errorMessage: compactErrorMessage(message, "PPT 页面生成失败"),
  });
}

function getPptRenderableSlides() {
  if (!state.ppt.outline?.slides?.length) {
    return state.ppt.slides;
  }

  const slidesByNumber = new Map(state.ppt.slides.map((slide) => [Number(slide.slideNumber), slide]));
  return state.ppt.outline.slides.map((outlineSlide) => ({
    ...outlineSlide,
    ...(slidesByNumber.get(Number(outlineSlide.slideNumber)) || {}),
  }));
}

function getPptSlideByNumber(slideNumber) {
  return state.ppt.slides.find((slide) => Number(slide.slideNumber) === Number(slideNumber)) || null;
}

function resizePptEditCanvas() {
  const canvas = refs.pptEditCanvas;
  canvas.width = 2048;
  canvas.height = 1152;
  const context = canvas.getContext("2d");
  context.clearRect(0, 0, canvas.width, canvas.height);
  state.ppt.edit.hasMarks = false;
}

function openPptSlideEditor(slideNumber) {
  const slide = getPptSlideByNumber(slideNumber);
  const imageUrl = slide?.imageUrl || slide?.thumbnailUrl || "";
  if (!slide || !imageUrl) {
    setPptFeedback("这一页还没有生成图片，无法编辑。", "error");
    return;
  }

  state.ppt.edit = {
    active: true,
    drawing: false,
    erasing: false,
    slideNumber: Number(slideNumber),
    hasMarks: false,
    imageUrl,
  };
  refs.pptEditTitle.textContent = `编辑第 ${slideNumber} 页`;
  refs.pptEditInstructionInput.value = "";
  refs.pptEditImage.src = imageUrl;
  refs.pptEditModal.classList.remove("hidden");
  refs.pptEditModal.setAttribute("aria-hidden", "false");
  setPptEditFeedback("");
  resizePptEditCanvas();
}

function closePptSlideEditor() {
  state.ppt.edit.active = false;
  state.ppt.edit.drawing = false;
  refs.pptEditModal.classList.add("hidden");
  refs.pptEditModal.setAttribute("aria-hidden", "true");
}

function setPptEditTool(tool) {
  state.ppt.edit.erasing = tool === "erase";
  refs.pptEditDrawButton.classList.toggle("active", !state.ppt.edit.erasing);
  refs.pptEditEraseButton.classList.toggle("active", state.ppt.edit.erasing);
}

function getPptEditCanvasPoint(event) {
  const rect = refs.pptEditCanvas.getBoundingClientRect();
  return {
    x: ((event.clientX - rect.left) / rect.width) * refs.pptEditCanvas.width,
    y: ((event.clientY - rect.top) / rect.height) * refs.pptEditCanvas.height,
  };
}

function drawPptEditStroke(from, to) {
  const context = refs.pptEditCanvas.getContext("2d");
  context.save();
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = state.ppt.edit.erasing ? 70 : 18;
  context.strokeStyle = state.ppt.edit.erasing ? "rgba(0,0,0,1)" : "rgba(255,72,72,0.92)";
  context.globalCompositeOperation = state.ppt.edit.erasing ? "destination-out" : "source-over";
  context.beginPath();
  context.moveTo(from.x, from.y);
  context.lineTo(to.x, to.y);
  context.stroke();
  context.restore();
  state.ppt.edit.hasMarks = true;
}

function beginPptEditStroke(event) {
  event.preventDefault();
  refs.pptEditCanvas.setPointerCapture(event.pointerId);
  state.ppt.edit.drawing = true;
  state.ppt.edit.lastPoint = getPptEditCanvasPoint(event);
}

function continuePptEditStroke(event) {
  if (!state.ppt.edit.drawing) {
    return;
  }
  const point = getPptEditCanvasPoint(event);
  drawPptEditStroke(state.ppt.edit.lastPoint, point);
  state.ppt.edit.lastPoint = point;
}

function endPptEditStroke(event) {
  state.ppt.edit.drawing = false;
  try {
    refs.pptEditCanvas.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released by the browser.
  }
}

function clearPptEditCanvas() {
  resizePptEditCanvas();
  setPptEditFeedback("");
}

async function canvasToBlob(canvas, type = "image/png") {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("无法导出标注图片。"));
      }
    }, type);
  });
}

async function buildAnnotatedPptSlideBlob() {
  if (!refs.pptEditImage.complete) {
    await refs.pptEditImage.decode().catch(() => {});
  }
  const canvas = document.createElement("canvas");
  canvas.width = refs.pptEditCanvas.width;
  canvas.height = refs.pptEditCanvas.height;
  const context = canvas.getContext("2d");
  context.fillStyle = "#0b1020";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(refs.pptEditImage, 0, 0, canvas.width, canvas.height);
  context.drawImage(refs.pptEditCanvas, 0, 0, canvas.width, canvas.height);
  return canvasToBlob(canvas);
}

async function requestPptSlideEditStream() {
  const slideNumber = state.ppt.edit.slideNumber;
  const instruction = refs.pptEditInstructionInput.value.trim();
  if (!state.ppt.edit.hasMarks && !instruction) {
    throw new Error("请先在页面上涂抹/标注，或填写修改说明。");
  }

  const sourceResponse = await fetch(state.ppt.edit.imageUrl);
  if (!sourceResponse.ok) {
    throw new Error("读取当前 PPT 页面图片失败。");
  }

  const formData = new FormData();
  formData.set("deckId", state.ppt.deckId);
  formData.set("outline", JSON.stringify(state.ppt.outline));
  formData.set("existingSlides", JSON.stringify(getCompletedPptSlides()));
  formData.set("slideNumber", String(slideNumber));
  formData.set("stylePreset", refs.pptStylePresetInput.value);
  formData.set("dynamicPreset", refs.pptDynamicPresetInput.value);
  formData.set("transitionPreset", refs.pptTransitionPresetInput.value);
  formData.set("transitionSpeed", refs.pptTransitionSpeedInput.value);
  formData.set("autoAdvanceSeconds", refs.pptAutoAdvanceInput.value);
  formData.set("editInstruction", instruction);
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("sourceSlideImage", await sourceResponse.blob(), `slide-${slideNumber}-source.png`);
  formData.set("annotatedSlideImage", await buildAnnotatedPptSlideBlob(), `slide-${slideNumber}-annotated.png`);
  appendBrowserConfigToFormData(formData);

  const response = await fetch("/api/ppt/slide/edit", {
    method: "POST",
    body: formData,
  });
  if (!response.ok || !response.body) {
    throw new Error("PPT 页面编辑请求失败");
  }
  return response;
}

async function submitPptSlideEdit() {
  if (state.ppt.generating) {
    return;
  }

  state.ppt.generating = true;
  state.ppt.statusText = `正在重新生成第 ${state.ppt.edit.slideNumber} 页`;
  setPptEditFeedback("正在提交标注并重新生成...", "");
  renderPptView();

  try {
    await runPptStream(await requestPptSlideEditStream());
    closePptSlideEditor();
    await loadPptDecks();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "PPT 页面编辑失败");
    setPptEditFeedback(message, "error");
    setPptFeedback(message, "error");
  } finally {
    state.ppt.generating = false;
    renderPptView();
  }
}

function buildPptFormData() {
  const formData = new FormData();
  state.ppt.files.forEach((file) => formData.append("sourceFiles", file));
  formData.set("sourceText", refs.pptSourceTextInput.value.trim());
  formData.set("topic", refs.pptTopicInput.value.trim());
  formData.set("pageCount", refs.pptPageCountInput.value);
  formData.set("stylePreset", refs.pptStylePresetInput.value);
  formData.set("dynamicPreset", refs.pptDynamicPresetInput.value);
  formData.set("transitionPreset", refs.pptTransitionPresetInput.value);
  formData.set("transitionSpeed", refs.pptTransitionSpeedInput.value);
  formData.set("autoAdvanceSeconds", refs.pptAutoAdvanceInput.value);
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  appendBrowserConfigToFormData(formData);
  return formData;
}

function buildPptCompletionRequest(slideNumbers) {
  return {
    ...getBrowserPrivateConfigRequestPayload(),
    deckId: state.ppt.deckId,
    outline: state.ppt.outline,
    existingSlides: getCompletedPptSlides(),
    slideNumbers,
    stylePreset: refs.pptStylePresetInput.value,
    dynamicPreset: refs.pptDynamicPresetInput.value,
    transitionPreset: refs.pptTransitionPresetInput.value,
    transitionSpeed: refs.pptTransitionSpeedInput.value,
    autoAdvanceSeconds: refs.pptAutoAdvanceInput.value,
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
  };
}

async function requestPptGenerationStream() {
  const response = await fetch("/api/ppt/generate", {
    method: "POST",
    body: buildPptFormData(),
  });
  if (!response.ok || !response.body) {
    throw new Error("PPT 生成请求失败");
  }
  return response;
}

async function requestPptCompletionStream(slideNumbers) {
  const response = await fetch("/api/ppt/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(buildPptCompletionRequest(slideNumbers)),
  });
  if (!response.ok || !response.body) {
    throw new Error("PPT 补页请求失败");
  }
  return response;
}

function handlePptStreamEvent(eventName, payload) {
  if (eventName === "status") {
    state.ppt.statusText = payload.message || state.ppt.statusText;
    renderPptView();
    return;
  }

  if (eventName === "outline") {
    state.ppt.deckId = payload.deckId || state.ppt.deckId;
    state.ppt.outline = payload.outline || state.ppt.outline;
    state.ppt.statusText = "正在逐页生成图片";
    renderPptView();
    return;
  }

  if (eventName === "slide_started") {
    state.ppt.currentSlideNumber = Number(payload.slideNumber) || 0;
    state.ppt.statusText = `正在生成第 ${payload.slideNumber} 页`;
    upsertPptSlide({
      slideNumber: Number(payload.slideNumber),
      title: payload.title || `第 ${payload.slideNumber} 页`,
      statusText: "生成中",
    });
    renderPptView();
    return;
  }

  if (eventName === "partial_image") {
    upsertPptSlide({
      slideNumber: Number(payload.slideNumber || state.ppt.currentSlideNumber),
      previewUrl: payload.dataUrl,
      statusText: "已收到预览",
    });
    renderPptView();
    return;
  }

  if (eventName === "slide_saved") {
    upsertPptSlide(payload.slide);
    state.ppt.statusText = "页面已保存";
    renderPptView();
    return;
  }

  if (eventName === "slide_failed") {
    markPptSlideFailed(payload.slideNumber || state.ppt.currentSlideNumber, payload.message);
    state.ppt.statusText = "部分页面生成失败";
    renderPptView();
    return;
  }

  if (eventName === "deck_saved") {
    const deck = payload.deck;
    state.ppt.pptxUrl = deck?.pptxUrl || "";
    state.ppt.statusText = "PPTX 已生成";
    if (deck) {
      state.ppt.decks = [deck, ...state.ppt.decks.filter((entry) => entry.deckId !== deck.deckId)];
    }
    renderPptView();
    return;
  }

  if (eventName === "complete") {
    const missing = Array.isArray(payload.missingSlideNumbers) ? payload.missingSlideNumbers : getPptMissingSlideNumbers();
    state.ppt.statusText = missing.length > 0 ? `仍有 ${missing.length} 页未完成` : "生成完成";
    if (payload.deck?.pptxUrl) {
      state.ppt.pptxUrl = payload.deck.pptxUrl;
    }
    renderPptView();
    return;
  }

  if (eventName === "error") {
    const message = compactErrorMessage(payload.message, "PPT 请求失败");
    if (payload.slideNumber || state.ppt.currentSlideNumber) {
      markPptSlideFailed(payload.slideNumber || state.ppt.currentSlideNumber, message);
    }
    setPptFeedback(message, "error");
    state.ppt.statusText = message;
    renderPptView();
  }
}

async function runPptStream(response) {
  await consumeSse(response.body, async (eventName, payload) => {
    handlePptStreamEvent(eventName, payload);
  });
}

async function startPptGeneration(event) {
  event.preventDefault();
  clearError();
  setPptFeedback("");

  const hasInput =
    state.ppt.files.length > 0 ||
    refs.pptSourceTextInput.value.trim().length > 0 ||
    refs.pptTopicInput.value.trim().length > 0;
  if (!hasInput) {
    setPptFeedback("请先上传文档、输入文本或输入主题。", "error");
    return;
  }

  state.ppt.generating = true;
  resetPptGenerationState();
  renderPptView();

  try {
    await runPptStream(await requestPptGenerationStream());
    await loadPptDecks();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "PPT 请求失败");
    setPptFeedback(message, "error");
    state.ppt.statusText = message;
    showError(message);
  } finally {
    state.ppt.generating = false;
    renderPptView();
  }
}

async function runPptCompletion(slideNumbers) {
  if (!state.ppt.outline || state.ppt.generating) {
    return;
  }

  const numbers = [...new Set(slideNumbers.map((value) => Number(value)).filter(Boolean))];
  if (numbers.length === 0) {
    return;
  }

  state.ppt.generating = true;
  state.ppt.statusText = numbers.length === 1 ? `正在重试第 ${numbers[0]} 页` : `正在补齐 ${numbers.length} 页`;
  setPptFeedback("");
  renderPptView();

  try {
    await runPptStream(await requestPptCompletionStream(numbers));
    await loadPptDecks();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "PPT 补页请求失败");
    setPptFeedback(message, "error");
    showError(message);
  } finally {
    state.ppt.generating = false;
    renderPptView();
  }
}

function retryPptSlide(slideNumber) {
  runPptCompletion([slideNumber]).catch((error) => setPptFeedback(error.message, "error"));
}

function completeMissingPptSlides() {
  runPptCompletion(getPptMissingSlideNumbers()).catch((error) => setPptFeedback(error.message, "error"));
}

async function loadPptDecks() {
  const response = await fetch("/api/ppt/decks");
  if (!response.ok) {
    throw new Error("读取 PPT 历史失败");
  }
  const payload = await response.json();
  state.ppt.decks = Array.isArray(payload) ? payload : [];
  renderPptView();
  renderPptRecordView();
}

function createPptSlideCard(slide) {
  const card = document.createElement("article");
  card.className = "ppt-slide-card";
  const complete = isPptSlideComplete(slide);
  card.dataset.status = complete ? "saved" : slide.errorMessage ? "failed" : "pending";

  const thumb = document.createElement("div");
  thumb.className = "ppt-slide-thumb";
  const imageUrl = slide.imageUrl || slide.thumbnailUrl || slide.previewUrl || "";
  if (imageUrl) {
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = slide.title || `第 ${slide.slideNumber} 页`;
    thumb.appendChild(image);
  } else {
    thumb.textContent = slide.errorMessage || slide.statusText || "等待生成";
  }
  card.appendChild(thumb);

  const copy = document.createElement("div");
  copy.className = "ppt-slide-copy";

  const title = document.createElement("strong");
  title.textContent = `${slide.slideNumber}. ${slide.title || "未命名页面"}`;
  copy.appendChild(title);

  const message = document.createElement("p");
  message.textContent = slide.keyMessage || slide.prompt || slide.statusText || "";
  copy.appendChild(message);

  const status = document.createElement("span");
  status.textContent = complete ? "已生成" : slide.errorMessage || slide.statusText || "待生成";
  copy.appendChild(status);

  if (state.ppt.outline && !complete) {
    const retryButton = document.createElement("button");
    retryButton.className = "inline-button ppt-slide-retry-button";
    retryButton.type = "button";
    retryButton.dataset.pptRetrySlide = String(slide.slideNumber);
    retryButton.setAttribute("data-ppt-retry-slide", String(slide.slideNumber));
    retryButton.textContent = slide.errorMessage ? "重试本页" : "生成本页";
    retryButton.disabled = state.ppt.generating;
    copy.appendChild(retryButton);
  }

  if (complete) {
    const editButton = document.createElement("button");
    editButton.className = "inline-button ppt-slide-edit-button";
    editButton.type = "button";
    editButton.dataset.pptEditSlide = String(slide.slideNumber);
    editButton.setAttribute("data-ppt-edit-slide", String(slide.slideNumber));
    editButton.textContent = "编辑本页";
    editButton.disabled = state.ppt.generating;
    copy.appendChild(editButton);
  }

  card.appendChild(copy);
  return card;
}

function renderPptSlides() {
  refs.pptSlideList.innerHTML = "";
  getPptRenderableSlides().forEach((slide) => {
    refs.pptSlideList.appendChild(createPptSlideCard(slide));
  });
}

function getPptDeckPageCount(deck) {
  return Number(deck?.pageCount) || Number(deck?.slides?.length) || 0;
}

function getPptDeckSourceLabel(deck) {
  return deck?.recordSource === "folder" ? "文件夹历史" : "生成记录";
}

function formatPptDeckMeta(deck) {
  const pageCount = getPptDeckPageCount(deck);
  const parts = [pageCount > 0 ? `${pageCount} 页` : "PPTX", formatTime(deck?.createdAt), getPptDeckSourceLabel(deck)];
  if (deck?.fileSize) {
    parts.push(formatFileSize(deck.fileSize));
  }
  return parts.filter(Boolean).join(" · ");
}

function createPptDeckRecordItem(deck, variant = "history") {
  const item = document.createElement("article");
  item.className = variant === "record" ? "ppt-record-card" : "ppt-history-item";

  const title = document.createElement("strong");
  title.textContent = deck.title || "未命名演示";
  item.appendChild(title);

  const meta = document.createElement("span");
  meta.textContent = formatPptDeckMeta(deck);
  item.appendChild(meta);

  if (variant === "record") {
    const path = document.createElement("p");
    path.textContent = deck.pptxFilename || deck.pptxRelativePath || "PPTX 文件";
    item.appendChild(path);

    const source = document.createElement("span");
    source.className = "ppt-record-source";
    source.textContent = getPptDeckSourceLabel(deck);
    item.appendChild(source);
  }

  const actions = document.createElement("div");
  actions.className = variant === "record" ? "ppt-record-card-actions" : "ppt-history-actions";
  const link = document.createElement("a");
  link.className = "toolbar-button";
  link.href = deck.pptxUrl || "#";
  link.download = deck.pptxFilename || "";
  link.textContent = "下载 PPTX";
  if (!deck.pptxUrl) {
    link.classList.add("disabled");
    link.setAttribute("aria-disabled", "true");
  }
  actions.appendChild(link);
  item.appendChild(actions);

  return item;
}

function renderPptHistory() {
  refs.pptDeckCount.textContent = `${state.ppt.decks.length} 套`;
  refs.pptHistoryEmpty.classList.toggle("hidden", state.ppt.decks.length > 0);
  refs.pptHistoryList.innerHTML = "";

  state.ppt.decks.forEach((deck) => {
    refs.pptHistoryList.appendChild(createPptDeckRecordItem(deck));
  });
}

function renderPptRecordView() {
  refs.pptRecordCount.textContent = `${state.ppt.decks.length} 个`;
  refs.pptRecordEmpty.classList.toggle("hidden", state.ppt.decks.length > 0);
  refs.pptRecordList.innerHTML = "";

  state.ppt.decks.forEach((deck) => {
    refs.pptRecordList.appendChild(createPptDeckRecordItem(deck, "record"));
  });
}

function renderPptView() {
  setPptSourceMode(state.ppt.sourceMode);
  renderPptFiles();

  const stats = getPptCompletionStats();
  const missing = getPptMissingSlideNumbers();
  refs.pptStatusText.textContent = state.ppt.statusText;
  refs.pptCompletionRatio.textContent = `${stats.completed} / ${stats.total} 页成功`;
  refs.pptProgressBar.style.width = stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : "0%";
  refs.pptCompleteMissingButton.classList.toggle("hidden", missing.length === 0 || !state.ppt.outline);
  refs.pptCompleteMissingButton.disabled = state.ppt.generating || missing.length === 0;
  refs.pptCompleteMissingButton.textContent = missing.length > 0 ? `补齐缺页 (${missing.length})` : "补齐缺页";
  refs.pptGenerateButton.disabled = state.ppt.generating;
  refs.pptGenerateButton.textContent = state.ppt.generating ? "正在生成..." : "生成 PPT 演示文稿";

  refs.pptDownloadLink.href = state.ppt.pptxUrl || "#";
  refs.pptDownloadLink.classList.toggle("disabled", !state.ppt.pptxUrl);
  refs.pptDownloadLink.setAttribute("aria-disabled", String(!state.ppt.pptxUrl));

  if (state.ppt.outline) {
    refs.pptOutlineBox.textContent = `${state.ppt.outline.title} · ${state.ppt.outline.slides.length} 页`;
  } else {
    refs.pptOutlineBox.textContent = "生成后会在这里显示大纲和每一页图片。";
  }

  renderPptSlides();
  renderPptHistory();
  renderPptRecordView();
}

function createJob() {
  const ratioOption = getRatioOption(refs.ratioInput.value || DEFAULT_UI_RATIO);
  const referenceFiles = state.referenceFiles.map((item) => item.file);
  const referenceImageNames = referenceFiles.map((file) => file.name);
  const sizeSetting = getSelectedGenerationSize();
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    prompt: refs.promptInput.value.trim(),
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png"),
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || "gpt-5.4",
    imageModel: "gpt-image-2",
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    requestRetryCount: 0,
    referenceFiles,
    hasReferenceImage: referenceFiles.length > 0,
    referenceImageName: referenceImageNames[0] || "",
    referenceImageNames,
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: "等待并发槽位",
    previewUrl: "",
  };
}

function updateJob(jobId, patch) {
  const job = state.jobs.find((entry) => entry.id === jobId);
  if (!job) {
    return null;
  }

  Object.assign(job, patch);
  renderAll();
  return job;
}

function removeJob(jobId) {
  state.jobs = state.jobs.filter((job) => job.id !== jobId);
}

function cancelQueuedJob(jobId) {
  const { jobs, canceledJob } = cancelQueuedGenerationJob(state.jobs, jobId);
  if (!canceledJob) {
    return false;
  }

  state.jobs = jobs;
  if (state.selectedPreviewKey === makeJobPreviewKey(canceledJob.id)) {
    state.selectedPreviewKey = "";
  }
  handleActivityCanceled(canceledJob);
  scheduleGenerationQueue();
  renderAll();
  return true;
}

async function requestGenerationStream(job) {
  while (true) {
    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: {
          "x-client-session-id": state.clientSessionId,
        },
        body: buildGenerationFormData(job),
      });

      if (!response.ok || !response.body) {
        throw new Error("生成请求失败");
      }

      return response;
    } catch (error) {
      const retryPlan = getGenerationRequestRetryPlan({
        error,
        retryCount: job.requestRetryCount || 0,
      });
      if (!retryPlan.shouldRetry) {
        if (retryPlan.retryable && !retryPlan.shouldSurfaceError) {
          return null;
        }
        throw error;
      }

      job.requestRetryCount = retryPlan.nextRetryCount;
      updateJob(job.id, {
        requestRetryCount: retryPlan.nextRetryCount,
        statusStage: "connecting",
        statusText: retryPlan.message,
      });
      await wait(900);
    }
  }
}

async function loadConfig() {
  let serverConfig = null;
  try {
    const response = await fetch("/api/config");
    if (response.ok) {
      serverConfig = await response.json();
    }
  } catch (_error) {
    serverConfig = null;
  }

  const browserConfig = readBrowserPrivateConfig();
  if (!serverConfig && !browserConfig) {
    throw new Error("读取配置失败");
  }

  state.config = browserConfig ? toPublicBrowserConfig(browserConfig, serverConfig || {}) : serverConfig;
  syncConfigUi(state.config);
}

async function loadGallery() {
  const response = await fetch("/api/gallery");
  if (!response.ok) {
    throw new Error("读取本地画廊失败");
  }

  const payload = await response.json();
  const browserCachedItems = await readBrowserCachedGalleryItems();
  const sortedItems = sortGalleryItemsByCreatedAtDesc(
    mergeServerAndBrowserGalleryItems(Array.isArray(payload) ? payload : [], browserCachedItems),
  );
  const hydratedGallery = hydrateGalleryItems(sortedItems);
  state.gallery = sortGalleryItemsByCreatedAtDesc(hydratedGallery.items);
  renderAll();
  void repairGalleryMetadataQueue(hydratedGallery.repairQueue);
}

function normalizeGenerationTaskSnapshot(task) {
  const id = String(task?.id || "").trim();
  if (!id) {
    return null;
  }

  const status = normalizeGenerationTaskStatus(task.status);
  return {
    ...task,
    id,
    status,
    createdAt: String(task.createdAt || nowIso()),
    updatedAt: String(task.updatedAt || task.createdAt || nowIso()),
    prompt: String(task.prompt || ""),
    statusText: String(task.statusText || ""),
    errorMessage: String(task.errorMessage || ""),
    referenceFiles: [],
    started: status === "running",
    isRunning: status === "running",
    statusStage: String(task.statusStage || status),
  };
}

function applyGenerationTaskSnapshots(tasks, { render = true } = {}) {
  const snapshots = (Array.isArray(tasks) ? tasks : []).map(normalizeGenerationTaskSnapshot).filter(Boolean);
  const snapshotIds = new Set(snapshots.map((task) => task.id));
  const existingJobs = new Map(state.jobs.map((job) => [job.id, job]));

  snapshots.forEach((task) => {
    if (task.status === "completed" && task.item) {
      upsertGalleryItem(task.item);
      if (state.selectedPreviewKey === makeJobPreviewKey(task.id) && task.item.filename) {
        state.selectedPreviewKey = makeGalleryPreviewKey(task.item.filename);
      }
    }

    if (task.status === "error" && state.selectedPreviewKey === makeJobPreviewKey(task.id)) {
      state.selectedPreviewKey = "";
    }

    recordGenerationTaskActivity(task);
  });

  const remoteRunningJobs = snapshots
    .filter((task) => task.status === "running")
    .map((task) => {
      const existing = existingJobs.get(task.id);
      return {
        ...task,
        referenceFiles: existing?.referenceFiles || [],
        previewUrl: existing?.previewUrl || task.previewUrl || "",
        requestRetryCount: existing?.requestRetryCount || 0,
      };
    });
  const localTransientJobs = state.jobs.filter((job) => !snapshotIds.has(job.id) && (job.isRunning || !job.started));

  state.generationTasks = snapshots;
  state.jobs = sortGalleryItemsByCreatedAtDesc([...remoteRunningJobs, ...localTransientJobs]);

  if (!state.selectedPreviewKey && state.jobs.length > 0) {
    state.selectedPreviewKey = makeJobPreviewKey(state.jobs[0].id);
  }

  if (render) {
    renderAll();
  }

  scheduleGenerationTaskPolling();
}

async function loadGenerationTasks({ render = true } = {}) {
  const response = await fetch("/api/generation/tasks", {
    headers: {
      "x-client-session-id": state.clientSessionId,
    },
  });
  if (response.status === 404) {
    applyGenerationTaskSnapshots([], { render });
    return;
  }
  if (!response.ok) {
    throw new Error("读取生成任务失败");
  }

  applyGenerationTaskSnapshots(await response.json(), { render });
}

function hasRunningGenerationTasks() {
  return state.jobs.some((job) => normalizeGenerationTaskStatus(job.status) === "running" || job.isRunning);
}

function scheduleGenerationTaskPolling() {
  if (generationTaskPollTimer || !hasRunningGenerationTasks()) {
    return;
  }

  generationTaskPollTimer = window.setTimeout(async () => {
    generationTaskPollTimer = 0;
    try {
      await loadGenerationTasks();
    } catch (error) {
      console.warn("load generation tasks failed", error);
    }
    scheduleGenerationTaskPolling();
  }, GENERATION_TASK_POLL_INTERVAL_MS);
}

async function loadPromptAgentHistory() {
  const response = await fetch("/api/prompt-agent/history");
  if (!response.ok) {
    throw new Error("读取图片提示词历史失败");
  }

  const payload = await response.json();
  state.promptAgent.history = Array.isArray(payload) ? payload : [];
  renderPromptAgent();
}

async function saveConfig(event) {
  event.preventDefault();
  clearError();

  const payload = {
    baseUrl: refs.baseUrlInput.value.trim(),
    apiKey: refs.apiKeyInput.value.trim(),
    responsesModel: refs.responsesModelInput.value.trim() || "gpt-5.5",
  };

  const browserConfig = saveBrowserPrivateConfig(payload);
  state.config = toPublicBrowserConfig(browserConfig, state.config || {});
  refs.apiKeyInput.value = "";
  refs.configFeedback.textContent = "配置已保存到当前浏览器，本项目不会把 API Key 写入源码或 Cloudflare 环境变量。";
  syncConfigUi(state.config);
}

async function openOutputDirectory() {
  const response = await fetch("/api/output/open", {
    method: "POST",
  });

  if (!response.ok) {
    throw new Error("打开输出目录失败");
  }
}

async function deleteGalleryItem(item) {
  if (!item?.filename) {
    return;
  }

  const confirmed = window.confirm(`确认删除 ${item.filename} 吗？`);
  if (!confirmed) {
    return;
  }

  const response = await fetch("/api/output/delete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      filename: item.filename,
    }),
  });

  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "删除失败");
  }

  state.gallery = state.gallery.filter((entry) => entry.filename !== item.filename);
  forgetGalleryMetadata(item.filename);
  await deleteBrowserCachedGalleryItem(item.filename);

  if (state.selectedPreviewKey === makeGalleryPreviewKey(item.filename)) {
    state.selectedPreviewKey = "";
  }

  if (state.lightboxItem?.filename === item.filename) {
    closeLightbox();
  }

  renderAll();
}

async function clearHistory() {
  if (state.gallery.length === 0) {
    return;
  }

  const confirmed = window.confirm("确认清空所有历史输出吗？");
  if (!confirmed) {
    return;
  }

  for (const item of [...state.gallery]) {
    const response = await fetch("/api/output/delete", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filename: item.filename,
      }),
    });

    if (!response.ok) {
      throw new Error(`删除失败：${item.filename}`);
    }
  }

  state.gallery = [];
  state.galleryMetadataCache = {};
  writeGalleryMetadataCache(state.galleryMetadataCache);
  await clearBrowserImageCache();
  state.selectedPreviewKey = "";
  closeLightbox();
  renderAll();
}

function buildGenerationFormData(job) {
  const formData = new FormData();
  formData.set("jobId", job.id);
  formData.set("prompt", job.prompt);
  formData.set("ratio", job.ratio);
  formData.set("size", job.size);
  formData.set("format", job.format);
  formData.set("reasoningEffort", job.reasoningEffort);
  formData.set("clientSessionId", state.clientSessionId);
  appendBrowserConfigToFormData(formData);

  job.referenceFiles.forEach((file) => {
    formData.append("referenceImages", file);
  });

  return formData;
}

function applyPromptAgentFile(fileList) {
  const file = [...(fileList || [])].find((item) => item.type.startsWith("image/"));
  if (!file) {
    setPromptAgentFeedback("请选择一张图片。", "error");
    return;
  }

  revokePromptAgentPreview();
  state.promptAgent.file = file;
  state.promptAgent.previewUrl = URL.createObjectURL(file);
  state.promptAgent.result = null;
  refs.promptAgentImageInput.value = "";
  setPromptAgentFeedback("", "");
  renderPromptAgent();
}

function buildPromptAgentFormData() {
  const formData = new FormData();
  formData.set("image", state.promptAgent.file);
  formData.set(
    "reasoningEffort",
    refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
  );
  return formData;
}

async function analyzePromptAgentImage() {
  clearError();
  if (!state.promptAgent.file) {
    setPromptAgentFeedback("请先上传一张图片。", "error");
    return;
  }

  state.promptAgent.running = true;
  setPromptAgentFeedback("正在分析图片...", "busy");
  renderPromptAgent();

  try {
    const response = await fetch("/api/prompt-agent/analyze", {
      method: "POST",
      body: buildPromptAgentFormData(),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "图片分析失败。");
    }

    state.promptAgent.result = payload.item;
    state.promptAgent.history = [
      payload.item,
      ...state.promptAgent.history.filter((item) => item.id !== payload.item.id),
    ];
    savePromptAgentResultAsTemplate(payload.item);
    setPromptAgentFeedback("已生成 JSON 提示词。", "success");
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setPromptAgentFeedback(message, "error");
    showError(message);
  } finally {
    state.promptAgent.running = false;
    renderPromptAgent();
  }
}

function mapPromptAgentPrompt(itemId) {
  const item = getPromptAgentItem(itemId);
  const promptText = getPromptAgentPrompt(item);
  if (!promptText) {
    setPromptAgentFeedback("这条记录没有可映射的 prompt 字段。", "error");
    return;
  }

  refs.promptInput.value = promptText;
  updatePromptCounter();
  setPromptAgentFeedback("已映射到 Studio 提示词。", "success");
  setPromptAgentOpen(false);
  refs.promptInput.focus();
}

async function copyPromptAgentJson(itemId) {
  const item = itemId ? getPromptAgentItem(itemId) : state.promptAgent.result;
  const jsonText = getPromptAgentJsonText(item);
  if (!jsonText) {
    setPromptAgentFeedback("没有可复制的 JSON。", "error");
    return;
  }

  await navigator.clipboard.writeText(jsonText);
  setPromptAgentFeedback("JSON 已复制。", "success");
}

function scheduleGenerationQueue() {
  const availableSlots = Math.max(0, getMaxParallelJobCount() - getRunningJobCount());
  if (availableSlots === 0) {
    return;
  }

  const nextJobs = selectNextQueuedGenerationJobs(state.jobs, availableSlots);
  nextJobs.forEach((job) => {
    job.started = true;
    job.isRunning = true;
    job.statusStage = "uploading";
    job.statusText = "正在准备生成请求";
    void runGeneration(job);
  });

  if (nextJobs.length > 0) {
    renderAll();
    scheduleGenerationTaskPolling();
  }
}

async function runGeneration(job) {
  job.started = true;
  job.isRunning = true;
  const finalImageChunks = new Map();
  let terminalEventReceived = false;
  let queuedForPolling = false;
  try {
    const response = await requestGenerationStream(job);
    if (!response) {
      removeJob(job.id);
      renderAll();
      return;
    }

    await consumeSse(response.body, async (eventName, payload) => {
      if (eventName === "status") {
        updateJob(job.id, {
          statusStage: payload.stage,
          statusText: payload.message,
        });
        handleActivityStatus(job.id, payload.stage, payload.message);
        renderAll();
        return;
      }

      if (eventName === "partial_image") {
        updateJob(job.id, {
          previewUrl: payload.dataUrl,
          statusText: "已收到中途预览",
        });
        handleActivityPartial(job.id);
        renderAll();
        return;
      }

      if (eventName === "final_image") {
        updateJob(job.id, {
          previewUrl: payload.dataUrl,
          statusText: "已拿到最终图像，正在写入本地",
        });
        handleActivityFinal(job.id);
        renderAll();
        return;
      }

      if (eventName === "final_image_chunk") {
        const dataUrl = recordFinalImageChunk(finalImageChunks, payload);
        updateJob(job.id, {
          previewUrl: dataUrl || job.previewUrl,
          statusText: dataUrl ? "最终图已接收，正在写入浏览器缓存" : "正在接收最终图数据",
        });
        if (dataUrl) {
          handleActivityFinal(job.id);
        }
        renderAll();
        return;
      }

      if (eventName === "saved") {
        terminalEventReceived = true;
        payload.item = attachChunkedImageToSavedItem(payload.item, finalImageChunks);
        if (payload.item) {
          upsertGalleryItem(payload.item);
          state.selectedPreviewKey = makeGalleryPreviewKey(payload.item.filename);
        }
        handleActivitySuccess(job.id);
        removeJob(job.id);
        renderAll();
        return;
      }

      if (eventName === "queued") {
        queuedForPolling = true;
        const task = payload.task || {};
        updateJob(job.id, {
          status: "running",
          statusStage: task.statusStage || "queued",
          statusText: task.statusText || "已提交到服务器队列，等待后台生成",
        });
        handleActivityStatus(job.id, "queued", task.statusText || "已提交到服务器队列，等待后台生成");
        scheduleGenerationTaskPolling();
        renderAll();
        return;
      }

      if (eventName === "error") {
        terminalEventReceived = true;
        const message = compactErrorMessage(payload.message, "生成请求失败");
        handleActivityFailure(job.id, message);
        showError(message);
        removeJob(job.id);
        renderAll();
      }
    });
    if (!terminalEventReceived && !queuedForPolling) {
      const message = "生成连接已中断，未收到完成事件。请稍后重试，或降低分辨率。";
      handleActivityFailure(job.id, message);
      showError(message);
      removeJob(job.id);
      renderAll();
    }
  } catch (error) {
    if (terminalEventReceived) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    handleActivityFailure(job.id, message);
    showError(message);
    removeJob(job.id);
    renderAll();
  } finally {
    const currentJob = state.jobs.find((entry) => entry.id === job.id);
    if (currentJob) {
      currentJob.isRunning = queuedForPolling;
      if (queuedForPolling) {
        currentJob.status = "running";
      }
    }
    updateGenerateButton();
    scheduleGenerationQueue();
  }
}

function startGeneration(event) {
  event.preventDefault();
  clearError();

  const prompt = refs.promptInput.value.trim();
  if (!prompt) {
    showError("提示词不能为空。");
    refs.promptInput.focus();
    return;
  }

  if (getQueuedJobCount() >= getMaxQueuedJobCount()) {
    showError(`同一会话最多排队 ${getMaxQueuedJobCount()} 个生成任务。`);
    return;
  }

  const job = createJob();
  state.jobs.unshift(job);
  state.selectedPreviewKey = makeJobPreviewKey(job.id);
  recordJobQueued(job);
  renderAll();
  setActiveView("studio");

  scheduleGenerationQueue();
}

function isStartGenerationShortcut(event) {
  return event.ctrlKey && !event.altKey && !event.metaKey && event.key === "Enter";
}

function handlePromptGenerationShortcut(event) {
  if (!isStartGenerationShortcut(event) || event.isComposing) {
    return;
  }

  event.preventDefault();
  refs.generateButton.click();
}

function setActiveGlobalNavItem(item) {
  refs.globalNavItems.forEach((navItem) => {
    const isOpen = navItem === item;
    navItem.classList.toggle("is-nav-open", isOpen);

    const button = navItem.querySelector(".view-tab");
    if (button) {
      button.setAttribute("aria-expanded", String(isOpen));
    }

    const flyout = navItem.querySelector(".nav-flyout");
    if (flyout) {
      flyout.setAttribute("aria-hidden", String(!isOpen));
    }
  });
}

function bindGlobalNavEvents() {
  refs.globalNavItems.forEach((item) => {
    const button = item.querySelector(".view-tab");
    if (!button) {
      return;
    }

    button.addEventListener("pointerenter", () => setActiveGlobalNavItem(item));
    button.addEventListener("mouseenter", () => setActiveGlobalNavItem(item));
    button.addEventListener("focus", () => setActiveGlobalNavItem(item));
    button.addEventListener("click", () => setActiveGlobalNavItem(item));
  });

  refs.globalNav?.addEventListener("click", (event) => {
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".global-nav")) {
      return;
    }

    setActiveGlobalNavItem(null);
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      setActiveGlobalNavItem(null);
    }
  });
}

function handleGlobalNavAction(action) {
  if (action === "prompt-agent") {
    setPromptAgentOpen(true);
    return;
  }

  if (action === "config") {
    setDrawerOpen(true);
    return;
  }

  if (action === "theme") {
    toggleUiTheme();
    return;
  }

  if (action === "output") {
    openOutputDirectory().catch((error) => showError(error.message));
  }
}

function bindEvents() {
  bindGlobalNavEvents();

  refs.viewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTab);
    });
  });

  document.querySelectorAll("[data-nav-action]").forEach((button) => {
    button.addEventListener("click", () => handleGlobalNavAction(button.dataset.navAction));
  });

  window.addEventListener("hashchange", () => {
    setActiveView(getViewFromHash());
  });

  refs.themeToggleButton.addEventListener("click", () => {
    toggleUiTheme();
  });
  refs.connectionStatus.addEventListener("click", () => setDrawerOpen(true));
  refs.openConfigButton.addEventListener("click", () => setDrawerOpen(true));
  refs.closeConfigButton.addEventListener("click", () => setDrawerOpen(false));
  refs.closeConfigBackdrop.addEventListener("click", () => setDrawerOpen(false));
  refs.openPromptAgentButton.addEventListener("click", () => setPromptAgentOpen(true));
  refs.promptAgentCloseButton.addEventListener("click", () => setPromptAgentOpen(false));
  refs.promptAgentBackdrop.addEventListener("click", () => setPromptAgentOpen(false));
  refs.promptAgentPreviewButton.addEventListener("click", openPromptAgentImageViewer);
  refs.promptAgentImageViewerBackdrop.addEventListener("click", closePromptAgentImageViewer);
  refs.promptAgentImageViewerClose.addEventListener("click", closePromptAgentImageViewer);
  refs.openOutputButton.addEventListener("click", () => {
    openOutputDirectory().catch((error) => showError(error.message));
  });
  refs.configForm.addEventListener("submit", (event) => {
    saveConfig(event).catch((error) => showError(error.message));
  });
  refs.generateForm.addEventListener("submit", startGeneration);
  refs.pptForm.addEventListener("submit", startPptGeneration);
  refs.pptCompleteMissingButton.addEventListener("click", completeMissingPptSlides);
  refs.pptRefreshHistoryButton.addEventListener("click", () => {
    loadPptDecks().catch((error) => setPptFeedback(error.message, "error"));
  });
  refs.pptRecordRefreshButton.addEventListener("click", () => {
    loadPptDecks().catch((error) => showError(error.message));
  });
  refs.pptSourceModeInputs.forEach((input) => {
    input.addEventListener("change", () => {
      setPptSourceMode(input.value);
    });
  });
  refs.pptSourceInput.addEventListener("change", (event) => {
    applyPptFiles(event.target.files);
  });
  refs.pptDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.pptDropzone.classList.add("dragover");
  });
  refs.pptDropzone.addEventListener("dragleave", () => {
    refs.pptDropzone.classList.remove("dragover");
  });
  refs.pptDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.pptDropzone.classList.remove("dragover");
    applyPptFiles(event.dataTransfer?.files);
  });
  refs.pptSlideList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-ppt-retry-slide]");
    if (target) {
      retryPptSlide(Number(target.dataset.pptRetrySlide));
      return;
    }

    const editTarget = event.target.closest("[data-ppt-edit-slide]");
    if (editTarget) {
      openPptSlideEditor(Number(editTarget.dataset.pptEditSlide));
    }
  });
  refs.pptEditBackdrop.addEventListener("click", closePptSlideEditor);
  refs.pptEditCloseButton.addEventListener("click", closePptSlideEditor);
  refs.pptEditDrawButton.addEventListener("click", () => setPptEditTool("draw"));
  refs.pptEditEraseButton.addEventListener("click", () => setPptEditTool("erase"));
  refs.pptEditClearButton.addEventListener("click", clearPptEditCanvas);
  refs.pptSubmitEditButton.addEventListener("click", () => {
    submitPptSlideEdit().catch((error) => setPptEditFeedback(error.message, "error"));
  });
  refs.pptEditCanvas.addEventListener("pointerdown", beginPptEditStroke);
  refs.pptEditCanvas.addEventListener("pointermove", continuePptEditStroke);
  refs.pptEditCanvas.addEventListener("pointerup", endPptEditStroke);
  refs.pptEditCanvas.addEventListener("pointercancel", endPptEditStroke);
  refs.timelineNewIndicator.addEventListener("click", scrollTimelineToNewest);
  refs.timelineList.addEventListener("scroll", handleTimelineScroll, { passive: true });
  refs.surprisePromptButton.addEventListener("click", selectRandomPrompt);
  refs.closePromptTemplateButton.addEventListener("click", () => setPromptTemplatePopoverOpen(false));
  refs.promptTemplateForm.addEventListener("submit", savePromptTemplate);
  refs.newPromptTemplateButton.addEventListener("click", resetPromptTemplateForm);
  refs.applyPromptTemplateButton.addEventListener("click", applyPromptTemplate);
  refs.deletePromptTemplateButton.addEventListener("click", deletePromptTemplate);
  refs.promptInput.addEventListener("input", updatePromptCounter);
  refs.promptInput.addEventListener("keydown", handlePromptGenerationShortcut);
  refs.referenceInput.addEventListener("change", (event) => {
    applyReferenceFiles(event.target.files);
  });
  refs.referenceDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.referenceDropzone.classList.add("dragover");
  });
  refs.referenceDropzone.addEventListener("dragleave", () => {
    refs.referenceDropzone.classList.remove("dragover");
  });
  refs.referenceDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.referenceDropzone.classList.remove("dragover");
    applyReferenceFiles(event.dataTransfer?.files);
  });
  refs.promptAgentImageInput.addEventListener("change", (event) => {
    applyPromptAgentFile(event.target.files);
  });
  refs.promptAgentDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.promptAgentDropzone.classList.add("dragover");
  });
  refs.promptAgentDropzone.addEventListener("dragleave", () => {
    refs.promptAgentDropzone.classList.remove("dragover");
  });
  refs.promptAgentDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.promptAgentDropzone.classList.remove("dragover");
    applyPromptAgentFile(event.dataTransfer?.files);
  });
  refs.promptAgentAnalyzeButton.addEventListener("click", () => {
    analyzePromptAgentImage().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setPromptAgentFeedback(message, "error");
      showError(message);
    });
  });
  refs.copyPromptAgentJsonButton.addEventListener("click", () => {
    copyPromptAgentJson().catch((error) => setPromptAgentFeedback(error.message, "error"));
  });
  refs.promptAgentHistoryList.addEventListener("click", (event) => {
    const expandTarget = event.target.closest("[data-prompt-agent-expand-id]");
    if (expandTarget) {
      togglePromptAgentHistoryCard(expandTarget);
      return;
    }

    const mapTarget = event.target.closest("[data-prompt-agent-map-id]");
    if (mapTarget) {
      mapPromptAgentPrompt(mapTarget.dataset.promptAgentMapId);
      return;
    }

    const copyTarget = event.target.closest("[data-prompt-agent-copy-id]");
    if (copyTarget) {
      copyPromptAgentJson(copyTarget.dataset.promptAgentCopyId).catch((error) => {
        setPromptAgentFeedback(error.message, "error");
      });
    }
  });
  refs.refreshGalleryButton.addEventListener("click", () => {
    loadGallery().catch((error) => showError(error.message));
  });
  refs.galleryColumnButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const preset = normalizeGalleryColumnPreset(button.dataset.galleryColumnPreset);
      if (preset === state.galleryColumnPreset) {
        return;
      }

      state.galleryColumnPreset = preset;
      renderGalleryView();
    });
  });
  refs.gallerySearchInput.addEventListener("input", (event) => {
    state.galleryControls.query = event.target.value;
    resetGalleryHistoryPage();
    renderGalleryView();
  });
  refs.galleryDateInput.addEventListener("input", (event) => {
    state.galleryControls.date = event.target.value;
    if (event.target.value) {
      state.galleryControls.window = "all";
    }
    resetGalleryHistoryPage();
    renderGalleryView();
  });
  refs.gallerySizeFilterInput.addEventListener("change", (event) => {
    state.galleryControls.size = event.target.value;
    resetGalleryHistoryPage();
    renderGalleryView();
  });
  refs.galleryReferenceFilterInput.addEventListener("change", (event) => {
    state.galleryControls.reference = event.target.value;
    resetGalleryHistoryPage();
    renderGalleryView();
  });
  refs.galleryResetFiltersButton.addEventListener("click", () => {
    state.galleryControls = { ...DEFAULT_GALLERY_CONTROLS };
    resetGalleryHistoryPage();
    renderGalleryView();
    refs.gallerySearchInput.focus();
  });
  refs.galleryPreviousPageButton.addEventListener("click", () => {
    setGalleryHistoryPage(state.galleryHistoryPage - 1);
  });
  refs.galleryNextPageButton.addEventListener("click", () => {
    setGalleryHistoryPage(state.galleryHistoryPage + 1);
  });
  refs.focusGalleryButton?.addEventListener("click", () => {
    setActiveView("gallery");
  });
  refs.clearHistoryButton?.addEventListener("click", () => {
    clearHistory().catch((error) => showError(error.message));
  });
  refs.previewLightboxButton.addEventListener("click", () => {
    const item = getCurrentPreviewItem();
    if (item && getImageUrl(item)) {
      openLightbox(item);
    }
  });
  refs.previewDeleteButton.addEventListener("click", () => {
    const item = getCurrentPreviewItem();
    if (!item?.filename) {
      return;
    }

    deleteGalleryItem(item).catch((error) => showError(error.message));
  });
  refs.previewImage.addEventListener("click", () => {
    const item = getCurrentPreviewItem();
    if (item && getImageUrl(item)) {
      openLightbox(item);
    }
  });
  refs.zoomOutButton.addEventListener("click", () => stepZoom(-0.1));
  refs.zoomInButton.addEventListener("click", () => stepZoom(0.1));
  refs.zoomResetButton.addEventListener("click", resetZoom);
  refs.lightboxBackdrop.addEventListener("click", closeLightbox);
  refs.lightboxClose.addEventListener("click", closeLightbox);
  refs.lightboxDelete.addEventListener("click", () => {
    if (!state.lightboxItem?.filename) {
      return;
    }

    deleteGalleryItem(state.lightboxItem).catch((error) => showError(error.message));
  });
  refs.copyPromptButton.addEventListener("click", () => {
    copyLightboxPrompt().catch((error) => {
      showError(error.message);
    });
  });
  refs.lightboxImage.addEventListener("click", () => {
    if (!state.lightboxItem || !getImageUrl(state.lightboxItem)) {
      return;
    }

    state.lightboxZoomed = !state.lightboxZoomed;
    syncLightboxZoomState();
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (!refs.promptTemplatePopover.classList.contains("hidden")) {
        setPromptTemplatePopoverOpen(false);
        return;
      }

      if (!refs.lightbox.classList.contains("hidden")) {
        closeLightbox();
        return;
      }

      if (refs.promptAgentImageViewer.classList.contains("open")) {
        closePromptAgentImageViewer();
        return;
      }

      if (refs.configDrawer.classList.contains("open")) {
        setDrawerOpen(false);
        return;
      }

      if (!refs.promptAgentModal.classList.contains("hidden")) {
        setPromptAgentOpen(false);
      }
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (refs.promptTemplatePopover.classList.contains("hidden")) {
      return;
    }

    if (
      refs.promptTemplatePopover.contains(event.target) ||
      refs.surprisePromptButton.contains(event.target)
    ) {
      return;
    }

    setPromptTemplatePopoverOpen(false);
  });
}

async function bootstrap() {
  state.clientSessionId = getOrCreateClientSessionId();
  state.uiTheme = readUiTheme();
  setUiTheme(state.uiTheme);
  state.activityFeed = readGenerationActivityFeed();
  state.galleryMetadataCache = readGalleryMetadataCache();
  state.promptTemplates = readPromptTemplates();
  state.selectedPromptTemplateId = state.promptTemplates[0]?.id || "";
  bindEvents();
  bindStudioDensitySync();
  bindStudioHeightSync();
  bindGalleryPanelHeightSync();
  bindGalleryScrollSync();
  scheduleStudioDensitySync();
  syncGalleryLayoutMode();
  updatePromptCounter();
  renderRatioGrid();
  renderReasoningOptions();
  renderSizeOptions();
  updateGenerateButton();
  renderReferenceGrid();
  renderPromptTemplates();
  renderTimeline();
  renderStudio();
  renderPptView();
  renderGalleryView();
  setActiveView(getViewFromHash());
  scheduleGalleryPanelHeightSync();
  scheduleGalleryScrollSync();

  try {
    await loadConfig();
    await loadGallery();
    await loadGenerationTasks();
    await loadPromptAgentHistory();
    await loadPptDecks();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    setConnectionState("error", "初始化失败");
  }
  
  // Initialize Vercel Speed Insights
  injectSpeedInsights();
}

bootstrap();
