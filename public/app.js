import { buildParameterText, formatImageModelLabel, formatRecentOutputMeta, resolveDisplayImageSize } from "/lib/studio-formatters.mjs";
import { formatLoadingThumbnailStatusLabel, getPreviewPlaceholderState, getStablePreviewLoadingItems, isWaitingPreviewItem } from "/lib/preview-placeholder-state.mjs?v=20260826-waiting-loading-1";
import { buildGalleryReferenceFilterOptions, buildGallerySections, buildGallerySizeFilterOptions, buildGalleryTimeFilterOptions, distributeGalleryItemsIntoColumns, filterGalleryItems, getGalleryHistorySectionLayouts, getGalleryLayoutModeForWidth, getPromptGenerationGalleryItems, getRecentGalleryItems, normalizeGalleryFilters, paginateGallerySections, sortGalleryItemsByCreatedAtDesc } from "/lib/gallery-organizer.mjs?v=20260806-gallery-five-date-page-1";
import { buildGalleryMetadataCacheEntry, collectGalleryMetadataRepairPatch, mergeGalleryItemWithCachedMetadata, pruneGalleryMetadataCache } from "/lib/gallery-metadata-recovery.mjs";
import { getDefaultGenerationSize, getGenerationSizeOptions, getModelProtocolImageSizeOptions, normalizeGenerationSize, normalizeModelProtocolImageSize } from "/lib/generation-size-options.mjs?v=20260614-image2-sizes-1";
import { getOutputFormatOptions, normalizeOutputFormat, } from "/lib/output-format-options.mjs?v=20260504-vercel-static-lib-1";
import { normalizeReferenceAnalysisLanguage, } from "/lib/reference-analysis-language.mjs?v=20260522-reference-language-1";
import { shouldReusePreviewLoadingShell } from "/lib/preview-loading-shell.mjs";
import { createGenerationLoadingShell, updateGenerationLoadingShell, stopGenerationLoadingShell, stopGenerationLoadingShells, getGenerationLoadingItemStage, beatGenerationLoadingHeartbeat, releaseGenerationLoadingSource, releaseGenerationLoadingSourcesByPrefix, GENERATION_LOADING_GENERATING_MODE, GENERATION_LOADING_WAITING_MODE } from "/lib/generation-loading.mjs";
import { registerHeartbeatMorphEngine } from "/lib/heartbeat-morph-icon.mjs";
/* morphicons 的浏览器产物只存在于 public/lib/vendor/（public/ 拿不到 node_modules），
   同步与版本校验由 scripts/sync-public-lib.mjs 负责。 */
import { createMorph as createHeartbeatMorph } from "/lib/vendor/morphicons/dom.js";
import { beatCreationCardHeartbeat, createCreationCardLoading as createCreationCardLoadingShell, getCreationCardDomKey, getCreationCardLoadingKey, syncCreationLoadingCard, syncCreationResultGrid as syncCreationResultGridShell } from "/lib/creation-card-loading.mjs";
import { createCreationCardIdleRippleController } from "/lib/creation-card-idle-ripple.mjs?v=20260725-creation-card-idle-ripple-1";
import { createDisabledShakeController } from "/lib/disabled-shake.mjs";
import { createFilmstripRevealTracker, renderFilmstripPreservingSelection, syncFilmstripSelectedMarker } from "/lib/filmstrip-selection.mjs?v=20260829-filmstrip-selection-1";
import { isGenerationRequestRetryMessage, } from "/lib/generation-request-retry.mjs";
import { cancelQueuedGenerationJob, getGenerationJobMode, getGenerationJobQueueKey, getQueuedGenerationJobCount, getRunningGenerationJobCount, isQueuedGenerationJob, selectNextQueuedGenerationJobsByMode } from "/lib/generation-queue.mjs?v=20260821-prompt-global-queue-1";
import { buildCanceledGenerationActivityDetail, buildGenerationTaskActivityDetail, buildGenerationTaskStatusText, formatGenerationActivityModeLabel, getGenerationActivityDisplayText, hasHeartbeatPrefix, sanitizeGenerationActivityDetail } from "/lib/generation-activity-feed.mjs?v=20260829-heartbeat-morph-1";
import { GENERATION_LOG_ALL_CHANNELS, GENERATION_LOG_CHANNELS, createGenerationLogStore, getGenerationLogAllEntries, getGenerationLogChannelEntries, getGenerationLogChannelLabel, getGenerationLogGroupItemDetail, normalizeGenerationLogChannel, normalizeGenerationLogRelayUrl, parseGenerationLogStore, serializeGenerationLogStore, upsertGenerationLogEntry, upsertGenerationLogGroupEntry } from "/lib/generation-log-store.mjs?v=20260828-generation-log-partition-1";
import { readGenerationLogChannelTabValue, readGenerationLogGroupToggleId, renderGenerationLogChannelTabs, renderGenerationLogRows, toggleGenerationLogGroup } from "/lib/generation-log-panel.mjs?v=20260828-generation-log-partition-1";
import { CREATION_STREAM_EVENTS, GENERATION_STREAM_EVENTS, clearFinalImageChunks, recordFinalImageChunk, recordPartialImageChunk } from "/lib/generation-stream-protocol.mjs";
import { mergeCreationItemStreamUpdate, mergeCreationSetPreviews, shouldRetainCompletedCreationItem } from "/lib/creation-preview-retention.mjs";
import {
  PROMPT_ATTEMPT_KIND,
  PROMPT_ATTEMPT_STATUS,
  completePromptAttemptDeck,
  createPromptAttemptDeckStore,
  failPromptAttemptDeck,
  getPromptAttemptCards,
  getPromptAttemptDeck,
  getTerminalPromptAttemptDecks,
  markPromptAttemptSaved,
  recordPromptAttemptImage,
  rekeyPromptAttemptDeck,
  removePromptAttemptDeck,
  startPromptAttemptRetry,
} from "/lib/prompt-attempt-deck.mjs";
import { filterLocallyTerminatedGenerationTaskSnapshots } from "/lib/generation-task-reconciler.mjs";
import { readHttpResponseErrorMessage } from "/lib/http-response-error.mjs";
import { consumeSseUntilTerminal } from "/lib/sse-terminal-client.mjs";
import { getStudioDensitySettings, getStudioLayoutMode, ALL_VARIABLE_NAMES } from "/lib/studio-density.mjs?v=20260713-cross-device-1";
import { buildStyleTransferPresetComparisonItem } from "/lib/style-transfer-preset-lightbox.mjs";
import { buildCreationRecordLightboxItem, normalizeCreationGenerationSnapshotForView } from "/lib/creation-record-lightbox.mjs";
import { buildCreationRecordDeleteConfirmation, getCreationRecordDeleteTargets, normalizeCreationRecordDeleteSetIds, resolveCreationRecordSelectionAfterDelete } from "/lib/creation-record-delete.mjs?v=20260722-creation-record-delete-flow-1";
import { createCreationTemuExportController } from "/lib/creation-temu-export-ui.mjs";
import { createTemuWorkbenchLauncher } from "/lib/temu-workbench-launcher.mjs";
import { createAssetRecordDeleteController } from "/lib/asset-record-delete-controller.mjs?v=20260722-asset-record-delete-1";
import { createAssetRecordTimeFilterController, getArticleRecordSearchText, getPortraitRecordSearchText } from "/lib/asset-record-time-filter-controller.mjs?v=20260724-asset-record-time-filter-controller-1";
import { buildCreationRecordTimeFilterOptions, filterCreationRecordSetsByTime, formatCreationRecordTimeFilterLabel, hasActiveCreationRecordTimeFilter, normalizeCreationRecordDateFilter, normalizeCreationRecordTimeFilter } from "/lib/creation-record-filter.mjs?v=20260722-creation-record-time-filter-1";
import { buildCreationRecordListModel, createCreationRecordListState, loadMoreCreationRecordListState } from "/lib/creation-record-list-model.mjs?v=20260807-creation-record-split-workspace-1";
import { createCreationRecordListRow } from "/lib/creation-record-list-view.mjs?v=20260807-creation-record-split-workspace-1";
import { ensureLazyViewModule, getMountedLazyViewModule } from "/lib/view-mode-loader.mjs?v=20260608-quick-blend-time-sort-1";
import { appendBrowserConfigToFormData, getBrowserPrivateConfigRequestPayload, getOrCreateClientSessionId, readBrowserPrivateConfig, saveBrowserPrivateConfig, toPublicBrowserConfig } from "/lib/browser-config.mjs";
import { cacheBrowserGalleryItem, clearBrowserImageCache, dataUrlToBlob, deleteBrowserCachedGalleryItem, fetchServerImageAsDataUrl, getBrowserCachedImageData, getImageUrl, getServerImageUrl, getServerThumbnailUrl, getThumbnailUrl, isCacheableBrowserImageUrl, mergeServerAndBrowserGalleryItems, readBrowserCachedGalleryItems } from "/lib/browser-image-cache.mjs";
import { createImageEditShellBridge } from "/lib/image-edit-shell-bridge.mjs";
import { createCreationLogoLibraryController } from "/lib/creation-logo-library.mjs";
import { consumeSse, requestGenerationStream } from "/lib/generation-client.mjs";
import { createConfigModelPickerController } from "/lib/config-model-picker.mjs";
import { createLightboxImageViewer, createLightboxViewerState } from "/lib/lightbox-image-viewer.mjs";
import { createAssetWorkspaceController } from "/lib/asset-workspace.mjs";
import { clearImageReveal, setImageRevealSource } from "/lib/image-reveal.mjs";
import { createPreviewKeyboardNavigationController } from "/lib/preview-keyboard-navigation.mjs";
import { createProductImageImportController } from "/lib/product-image-import-controller.mjs";
import {
  API_ENDPOINT_CHAT_COMPLETIONS,
  API_ENDPOINT_IMAGE_EDITS,
  API_ENDPOINT_IMAGE_GENERATIONS,
  API_ENDPOINT_RESPONSES,
  DEFAULT_DIRECT_IMAGE_MODEL,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  DEFAULT_PROTOCOL_IMAGE_MODEL,
  DEFAULT_RESPONSES_MODEL,
  appendApiEndpointPath,
  normalizeApiEndpointPath,
  splitApiEndpointUrl,
  splitModelProtocolUrl,
} from "/lib/image-route-config.mjs";
import { createPptAnalysisController } from "/lib/ppt-analysis-client.mjs?v=20260527-density-overlap-1";
import { createPortraitReferenceAnalysisController } from "/lib/portrait-reference-analysis-client.mjs";
import { appendPptDeckDownloadLinks } from "/lib/ppt-record-links.mjs";
import { buildCreationSkuSubjectsForPayload, normalizeCreationSkuBundleCountForPayload, normalizeCreationSkuSubjectForPayload } from "/lib/creation-sku-subjects.mjs";
import { buildCreationReferenceLightboxItem } from "/lib/creation-reference-lightbox.mjs";
import { bindCreationReferenceDrag, reorderCreationReferenceFiles } from "/lib/creation-reference-drag.mjs";
import { isCreationSubjectReferenceRole } from "/lib/creation-reference-roles.mjs";
import { applyCreationReferenceCoverageRolePlan, normalizeCreationCoverageFields, toggleCreationSelectedRoles } from "/lib/creation-reference-coverage.mjs?v=20260703-latest-restore-1";
import { applyCreationReferenceAnalysisProductNameValue, buildCreationReferenceAnalysisAppliedFeedbackMessage, buildCreationReferenceAnalysisCategoryMatchText, getCreationReferenceAnalysisCategoryProductName, getCreationReferenceAnalysisDisplayRoleLabel, getCreationReferenceAnalysisGroupedSubjectUnitCount, getCreationReferenceAnalysisRoleCorrectionReason, normalizeCreationReferenceAnalysisUnitCountNote, resolveCreationReferenceAnalysisCategoryValue, resolveCreationReferenceAnalysisContextCategoryValue, shouldDowngradeReferenceProductAnalysisRole } from "/lib/creation-reference-analysis-view.mjs";
import { createCreationListingController, getCreationRecordListingMetaLabel, getCreationListingSearchValues, normalizeCreationListingDraftForView, renderCreationListingDrafts } from "/lib/creation-listing-view.mjs";
import { getCreationItemDisplayTitle } from "/lib/creation-item-display.mjs";
import { getCreationAutoRepairNotice, getCreationAutoRepairableItems, getCreationCompletionFeedback, getCreationIncompleteItems, shouldAutoRepairCreationSet } from "/lib/creation-auto-repair.mjs?v=20260829-generation-schedule-1";
import { getRequeueNotice } from "/lib/generation-item-retry.mjs";
import { canRepairCreationItem as canRepairCreationItemFromQueue, getCreationRepairButtonText as getCreationRepairButtonTextFromQueue, isCreationItemRepairActive as isCreationItemRepairActiveInQueue, queueCreationItemRepair as queueCreationItemRepairInState, removeQueuedCreationItemRepair, shiftNextQueuedCreationItemRepair } from "/lib/creation-item-repair-queue.mjs";
import { cloneCreationPlanValue, createCreationPlanPreviewRequestCoordinator, createCreationPlatformPayloadSnapshot, deepFreezeCreationPlanValue, formatCreationPlanWarning, getCreationCompatibleImageTypeState, getCreationEditablePlanDisplayCounts, getCreationSetPlanSource, getVisibleCreationPlanWarnings, mergeCreationPlatformSetParameters, resolveCreationDisplayedPlanContext, resolveCreationPlatformImageCountState, resolveCreationSelectedRolesSubmission, shouldDisableCreationGenerateButton, updateCreationPlatformItemOverride } from "/lib/creation-browser-plan-state.mjs";
import { normalizeCreationModuleEnabled, resolveCreationPlanCounts } from "/lib/creation-plan-counts.mjs";
import { buildCreationQueuedRepairFormData, buildCreationQueuedSet as buildCreationQueuedSetFromState, createCreationQueueJob, getActiveCreationQueueJob as getActiveCreationQueueJobFromState, getCreationQueueJobs as getCreationQueueJobsFromState, getCreationRepairTargetSet as getCreationRepairTargetSetFromState, getPendingCreationQueueCount as getPendingCreationQueueCountFromState, getSelectedCreationQueueJob as getSelectedCreationQueueJobFromState, renderCreationQueueStrip as renderCreationQueueStripView, runCreationQueuedJob as runCreationQueuedJobFromQueue, scheduleCreationGenerationQueue as scheduleCreationGenerationQueueFromState, selectCreationQueueJob as selectCreationQueueJobInState, shouldSyncCreationQueueJobCurrentSet, syncActiveCreationQueueSet as syncActiveCreationQueueSetInState } from "/lib/creation-suite-queue.mjs?v=20260829-generation-schedule-1";
import { DEFAULT_PORTRAIT_ACCESSORY_ASSETS, PORTRAIT_ACCESSORY_ASSET_CATEGORIES, getPortraitAccessoryAssetFileDescriptor } from "/lib/portrait-accessory-assets.mjs?v=20260528-portrait-assets-sort-1";
import { createDefaultPortraitLocationState, createPortraitLocationSelectorController } from "/lib/portrait-location-selector.mjs?v=20260527-portrait-location-1";
import { getLegacyPromptAgentTemplatePrompt, getPromptAgentDisplayName, getPromptAgentTemplateDisplayName, isStructuredImagePromptJson } from "/lib/prompt-agent-display-name.mjs?v=20260819-prompt-history-mode-1";
import { mergePromptAgentHistoryTemplates } from "/lib/prompt-agent-template-sync.mjs?v=20260819-history-template-mode-1";
import { DEFAULT_GENERATION_CONCURRENCY, DEFAULT_GENERATION_START_DELAY_MS, MAX_PROMPT_PARALLEL_TASKS, MAX_PROMPT_QUEUE_SIZE } from "/lib/studio-constants.mjs?v=20260829-generation-schedule-1";
import { GENERATION_START_DELAY_FIELD, normalizeGenerationStartDelayMs } from "/lib/generation-start-delay.mjs?v=20260829-generation-schedule-1";
import { GENERATION_CONCURRENCY_FIELD, normalizeGenerationConcurrency } from "/lib/generation-concurrency.mjs?v=20260829-generation-schedule-1";
const SURPRISE_PROMPTS = [
  { name: "清晨通勤", prompt: "生成一张清晨城市通勤生活照，年轻上班族手拿咖啡走出地铁站，晨光穿过街边树影，画面自然真实，轻微运动模糊，适合生活方式摄影。" },
  { name: "家庭早餐", prompt: "生成一张温暖家庭早餐场景，木质餐桌上有吐司、煎蛋、牛奶和水果，家人围坐聊天，窗外柔和日光洒入，构图干净，有真实居家氛围。" },
  { name: "居家阅读", prompt: "生成一张安静居家阅读画面，人物坐在窗边单人椅上看书，旁边有茶杯和落地灯，浅色窗帘、柔和阴影，画面舒适松弛，细节清晰。" },
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
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
};
const REASONING_ESTIMATES = {
  low: "30s+",
  medium: "90s+",
  high: "150s+",
  xhigh: "210s+",
};
const DEFAULT_LIMITS = { maxParallelTasksPerSession: 15, maxReferenceImages: 15, maxCreationReferenceImages: 15, maxPortraitPersonReferenceImages: 3, maxPortraitActionReferenceImages: 3, maxPortraitAccessoryReferenceImages: 9 }; const PROMPT_FILMSTRIP_INITIAL_HISTORY_LIMIT = 10; const PROMPT_FILMSTRIP_MAX_HISTORY_LIMIT = 50; const PROMPT_FILMSTRIP_JOB_LIMIT = MAX_PROMPT_QUEUE_SIZE;
const CREATION_IMAGE_COUNT_OPTIONS = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];
const DEFAULT_PROMPT_ENHANCE_TEXT = ",sharp focus, macro details, rich textures, crisp edges, photorealistic texture, visible grain, detailed surface material, cinematic lighting"; function buildPromptModePrompt() { const prompt = refs.promptInput.value.trim(); if (!state.promptEnhanceEnabled) { return prompt; } const enhanceText = String(refs.promptEnhanceInput?.value || "").trim(); return enhanceText ? `${prompt}${enhanceText.startsWith(",") ? "" : "\n\n"}${enhanceText}` : prompt; } function syncPromptEnhanceMode() { refs.promptEnhanceToggle.classList.toggle("is-active", state.promptEnhanceEnabled); refs.promptEnhanceToggle.setAttribute("aria-checked", String(state.promptEnhanceEnabled)); refs.promptEnhanceToggle.querySelector("small").textContent = getUiLanguageText(state.promptEnhanceEnabled ? "promptEnhanceOn" : "promptEnhanceOff"); refs.promptEnhanceField.classList.toggle("hidden", !state.promptEnhanceEnabled); } function togglePromptEnhanceMode() { state.promptEnhanceEnabled = !state.promptEnhanceEnabled; syncPromptEnhanceMode(); if (state.promptEnhanceEnabled) { refs.promptEnhanceInput.focus(); } }
const PROMPT_TEMPLATE_STORAGE_KEY = "image-studio-prompt-templates-v2";
const PROMPT_TEMPLATE_DISMISSED_HISTORY_KEY = "image-studio-prompt-template-dismissed-history-v1";
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
const ARTICLE_RECORD_COLUMN_PRESETS = [2, 4, 6, 8];
const DEFAULT_ARTICLE_RECORD_COLUMN_PRESET = 4;
const DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET = "realist-magazine";
const DEFAULT_REASONING_EFFORTS = ["low", "medium", "high", "xhigh"];
const CREATION_REFERENCE_ANALYSIS_REASONING_EFFORT = "low";
const PROMPT_AGENT_ANALYSIS_REASONING_EFFORT = "medium";
const REFERENCE_ORCHESTRATION_REASONING_EFFORT = "low";
const DEFAULT_UI_RATIO = "1:1";
const DEFAULT_QUICK_BLEND_RATIO = "1:1";
const DEFAULT_PORTRAIT_RATIO = "4:5";
const RATIO_ORIENTATION_LABELS = {
  landscape: "\u6a2a\u5411",
  portrait: "\u7ad6\u5411",
  square: "\u65b9\u5f62",
};
const PORTRAIT_ANALYSIS_FEEDBACK_MIN_MS = 520;
const PORTRAIT_STYLE_LABELS = {
  "business-profile": "商务形象",
  "fashion-magazine": "时尚杂志",
  "cinematic-street": "电影街拍",
  "studio-texture": "棚拍质感",
  "natural-light-lifestyle": "自然光生活",
  "retro-film": "复古胶片",
  "black-white-portrait": "黑白肖像",
  "outdoor-travel": "户外旅拍",
  "social-avatar": "社媒头像",
  custom: "自定义风格",
};
const PORTRAIT_STATUS_LABELS = {
  idle: "待生成",
  planning: "计划中",
  queued: "排队中",
  generating: "生成中",
  completed: "已完成",
  failed: "失败",
  partial_failed: "部分失败",
};
const PORTRAIT_SHOT_TYPE_LABELS = {
  "long-shot": "远景",
  "full-body": "全身",
  "medium-shot": "中景",
  "close-up": "近景",
  "extreme-close-up": "特写",
};
const DEFAULT_UI_RATIO_LABEL = "电商主图、头像、社交媒体 · 方形 1:1";
const CREATION_LOGO_PLACEMENTS = new Set([
  "top-left",
  "top-center",
  "top-right",
  "center-left",
  "center",
  "center-right",
  "bottom-left",
  "bottom-center",
  "bottom-right",
]);
const CREATION_LOGO_PLACEMENT_LABELS = {
  "top-left": "左上",
  "top-center": "上中",
  "top-right": "右上",
  "center-left": "左中",
  center: "居中",
  "center-right": "右中",
  "bottom-left": "左下",
  "bottom-center": "下中",
  "bottom-right": "右下",
};
const CREATION_LOGO_BACKGROUNDS = new Set(["transparent", "remove-background"]);
const CREATION_LOGO_BACKGROUND_LABELS = {
  transparent: "透明底，直接放置",
  "remove-background": "非透明底，先抠图",
};
const STYLE_TRANSFER_CUSTOM_PRESET = "custom";
const STYLE_TRANSFER_DEFAULT_PRESET = "clay-toy";
const STYLE_TRANSFER_PRESET_BEFORE_IMAGE = "./assets/style-presets/cinematic-photo.png";
const STYLE_TRANSFER_PRESET_REFERENCE_SIZE = 1024;
const STYLE_TRANSFER_PRESETS = [
  {
    value: STYLE_TRANSFER_CUSTOM_PRESET,
    label: "上传风格图",
    description: "上传自己的风格参考图；下方示意为自定义风格迁移入口。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/custom-style-reference.svg",
    prompt: "",
  },
  {
    value: "cinematic-photo",
    label: "电影写实",
    description: "真实镜头、胶片色调、自然光影和电影级景深。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/style-before.png",
    prompt: "Use a cinematic photoreal look with natural lens behavior, realistic lighting, filmic color grading, and believable texture.",
  },
  {
    value: "anime-cel",
    label: "日系赛璐璐",
    description: "干净线条、块面阴影、高饱和角色动画质感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/anime-cel.png",
    prompt: "Use Japanese cel animation styling with clean outlines, controlled flat shadows, vivid colors, and crisp character-focused rendering.",
  },
  {
    value: "hand-drawn",
    label: "手绘插画",
    description: "松弛笔触、温和配色和纸面手作感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/hand-drawn.png",
    prompt: "Use an expressive hand-drawn illustration look with visible sketch texture, warm imperfect strokes, and soft handmade color.",
  },
  {
    value: "pencil-sketch",
    label: "铅笔素描",
    description: "石墨线稿、排线明暗和纸张颗粒。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/pencil-sketch.png",
    prompt: "Use a graphite pencil sketch style with visible hatching, tonal shading, paper grain, and monochrome drawing texture.",
  },
  {
    value: "cyberpunk-neon",
    label: "赛博霓虹",
    description: "高反差夜景、霓虹边光和湿润反射。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/cyberpunk-neon.png",
    prompt: "Use a cyberpunk neon night style with high contrast, saturated colored rim lights, reflective surfaces, and dense urban mood.",
  },
  {
    value: "pixel-game",
    label: "像素游戏",
    description: "低分辨率像素块、限定调色和复古游戏画面。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/pixel-game.png",
    prompt: "Use a retro pixel game style with blocky pixel forms, limited palette, crisp grid edges, and readable sprite-like shapes.",
  },
  {
    value: "low-poly-3d",
    label: "低多边形3D",
    description: "几何切面、硬边体块和轻量 3D 玩具感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/low-poly-3d.png",
    prompt: "Use a low-poly 3D style with faceted geometry, clean hard edges, simplified volumes, and soft studio lighting.",
  },
  {
    value: "editorial-watercolor",
    label: "编辑水彩",
    description: "透明水色、留白边缘和杂志插画气质。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/editorial-watercolor.png",
    prompt: "Use an editorial watercolor style with translucent pigment washes, soft blooms, paper texture, and elegant magazine illustration restraint.",
  },
  {
    value: "paper-cut-collage",
    label: "纸雕拼贴",
    description: "层叠纸片、投影厚度和剪贴画装饰感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/paper-cut-collage.png",
    prompt: "Use a paper cut collage style with layered paper shapes, tactile edges, shallow shadows, and handcrafted poster composition.",
  },
  {
    value: "risograph-poster",
    label: "Riso海报",
    description: "套色错位、网点颗粒和独立出版物质感。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/risograph-poster.png",
    prompt: "Use a risograph poster style with limited spot colors, offset registration, halftone grain, and bold printmaking texture.",
  },
  {
    value: "vintage-film",
    label: "复古胶片",
    description: "过期胶片、暖色偏移、暗角和颗粒噪点。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/vintage-film.png",
    prompt: "Use a vintage film style with warm color shift, soft contrast, visible grain, subtle vignetting, and aged photographic mood.",
  },
  {
    value: "comic-ink",
    label: "漫画墨线",
    description: "粗黑轮廓、速度线、网点阴影和分镜张力。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/comic-ink.png",
    prompt: "Use a bold comic ink style with heavy linework, graphic contrast, screentone shadows, and energetic panel-like clarity.",
  },
  {
    value: "clay-toy",
    label: "黏土手作",
    description: "柔软手工材质、圆润体块、玩具灯箱和微缩场景。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/clay-toy.png",
    prompt: "Use a handmade clay toy diorama style with rounded forms, soft material texture, playful miniature lighting, and tactile surface detail.",
  },
  {
    value: "ink-gongbi",
    label: "国风工笔",
    description: "细线勾勒、淡彩晕染、宣纸纹理和东方留白。",
    beforeImage: STYLE_TRANSFER_PRESET_BEFORE_IMAGE,
    image: "./assets/style-presets/ink-gongbi.png",
    prompt: "Use a Chinese gongbi painting style with precise fine lines, restrained ink-and-color washes, rice paper texture, and elegant negative space.",
  },
];
const GALLERY_METADATA_CACHE_KEY = "image-studio-gallery-metadata-cache-v2";
const GENERATION_ACTIVITY_STORAGE_KEY = "image-studio-generation-activity-v1";
const GENERATION_LOG_STORAGE_KEY = "image-studio-generation-activity-v2";
const THEME_STORAGE_KEY = "image-studio-ui-theme-v1";
const UI_LANGUAGE_STORAGE_KEY = "image-studio-ui-language-v1";
const UI_LANGUAGE_TEXT = {
  "zh-CN": { activityLog: "生成日志", activityLogAllPanels: "全部板块", activityLogPanels: "生成日志板块", baseUrl: "基础 URL", brandSubtitle: "AI 图像生成工作流", close: "关闭", config: "配置", configApi: "配置 API", configSaved: "配置已保存", configTitle: "连接配置", configUnsaved: "配置未保存", connectionBusy: "并发 {running}/{max} · 队列 {queued}", connectionOpen: "打开 API、LOG", connectionSection: "调用通道", connectionStatusEmpty: "待填写API、LOG", connectionStatusEntry: "API、LOG", delete: "删除", directEndpointSuffix: "直接调用模式请求协议后缀", directMode: "直接调用模式", download: "下载", endpointUrl: "接口地址", expandModels: "展开可用模型列表", fetchModels: "获取模型列表", fetchModelsLoading: "获取中...", fit: "适配", functionMenu: "功能菜单导航", fullUrl: "完整 URL", generate: "开始生成", generateTitle: "开始生成（Ctrl+Enter）", generationRouteLabel: "生图调用模式", globalNav: "全局导航", imageModel: "生图模型", keepSavedKey: "保持已保存 Key", languageEn: "English UI", languageSwitch: "切换界面语言", languageZh: "简体中文界面", menuArticleIllustration: "文章插图", menuArticleRecord: "文章插图记录", menuAssetTools: "资产工具", menuCreation: "套图模式", menuCreationRecord: "套图记录", menuCreateTools: "创作工具", menuGallery: "瀑布画廊", menuImageCompress: "图片压缩", menuImageDecomposition: "图片拆解", menuImageEdit: "图片编辑", menuPortrait: "写真模式", menuPortraitRecord: "写真记录", menuPpt: "PPT生成", menuPptRecord: "PPT记录", menuPromptStudio: "提示词生图", menuQuickBlend: "快速溶图", menuReferenceAnalysis: "融图分析", menuSectionAssets: "资产区", menuSectionCreate: "创作区", menuSectionSettings: "配置区", menuSettings: "设置", menuStyleTransfer: "风格迁移", menuTools: "工具", modeDirect: "直接调用模式", modeProtocol: "Gemini模型", modeRoute: "路由模式", modelFetchBusy: "正在获取模型列表...", modelFetchFailed: "获取模型列表失败。", modelFetchSuccess: "已获取 {count} 个可调用模型。", modelNoCallable: "未获取到可调用模型。", modelNoMatch: "没有匹配的模型", modelNoMatchWithQuery: "没有匹配的模型：{query}", modelTestBusy: "正在测试连接...", modelTestSuccess: "连接测试成功，获取到 {count} 个模型。", navAssets: "资产", navCreate: "创作", navSettings: "配置", notSaved: "未保存", openOutput: "打开输出目录", outputFormat: "输出格式", parameters: "参数设置", previewIdleDetail: "生成日志可在配置中查看，底部胶片条可快速切换查看。", previewIdleEyebrow: "Output Preview", previewIdleTitle: "生成结果会在这里实时更新。", previewWaiting: "等待生成", prompt: "提示词", promptAgent: "图片转提示词", promptCounterSuffix: "字", promptEnhance: "增强模式", promptEnhanceAria: "开启或关闭提示词增强模式", promptEnhanceField: "增强提示词", promptEnhanceOff: "关闭", promptEnhanceOn: "开启", promptPlaceholder: "写下你要生成的画面，也可以先上传参考图说明修改方向。", promptTemplate: "提示词模板", protocolHint: "Gemini 图像模型按 AGICTO 图像生成协议调用；基础 URL 通常填写到 /v1，实际请求为 /images/generations。", protocolImageModel: "图像模型", protocolMode: "Gemini模型", quality: "质量", "ratio.1:1": "电商主图、头像、社交媒体 · 方形 1:1", "ratio.1:2": "长海报 · 竖屏 1:2", "ratio.1:3": "超长竖版广告 · 竖屏 1:3", "ratio.2:1": "Banner横幅 · 横屏 2:1", "ratio.2:3": "竖版摄影 · 竖屏 2:3", "ratio.3:1": "超宽广告图 · 横屏 3:1", "ratio.3:2": "摄影风格 · 横屏 3:2", "ratio.3:4": "海报、人像 · 竖屏 3:4", "ratio.4:3": "PPT、网页配图 · 横屏 4:3", "ratio.4:5": "Instagram帖子 · 竖屏 4:5", "ratio.5:4": "商品展示 · 横屏 5:4", "ratio.9:16": "短视频封面、手机壁纸 · 竖屏 9:16", "ratio.9:21": "超长竖图 · 竖屏 9:21", "ratio.16:9": "横版封面、YouTube · 横屏 16:9", "ratio.21:9": "超宽横幅 · 横屏 21:9", ratioLandscape: "横向", ratioPortrait: "竖向", ratioSquare: "方形", reasoningEffort: "思考等级", reference: "参考图", referenceUploadAction: "上传参考图", referenceUploadTitle: "拖入图片或点击上传", responsesModel: "Responses 模型", routeEndpointSuffix: "路由模式请求协议后缀", routeMode: "路由模式", save: "保存", schedulingSection: "生成调度", schedulingLockNote: "有生图任务正在进行或排队，暂时不能修改生成调度参数。任务全部结束后会自动恢复。", concurrencyLabel: "请求并发数量", concurrencyUnit: "个", concurrencyHint: "批量生成时同一会话内同时在跑的请求总数，默认 20 个，范围 1 到 50。调低可以减轻上游压力、降低限流和超时概率，但整批更慢；调高更快，但上游更容易限流。", size: "分辨率", startDelayHint: "同一会话内相邻两个上游请求的提交间隔，默认 1000 毫秒，范围 200 到 5000 毫秒。间隔越大越不容易触发上游限流，但最后一张开始得越晚。", startDelayLabel: "任务提交间隔", startDelayUnit: "毫秒", sizeAuto: "自动适配", sizeMax: "最大", testConnection: "测试连接", testConnectionLoading: "测试中...", themeDark: "深色主题", themeLight: "白色主题", themeMenu: "主题颜色", themeToDark: "切换到深色主题", themeToLight: "切换到白色主题", thumbnailEmpty: "暂无缩略图", thumbnailFailed: "缩略图加载失败", thumbnailLoading: "缩略图加载中", timelineNoErrors: "暂无错误", timelineWaitingResult: "等待生成结果", timelineWaitingTask: "等待任务开始", toolModel: "工具模型", toolModelAndQuality: "工具模型与质量", view: "查看", visionTextModel: "视觉/文本模型" },
  en: { activityLog: "Generation Log", activityLogAllPanels: "All Panels", activityLogPanels: "Generation log panels", baseUrl: "Base URL", brandSubtitle: "AI image workflow", close: "Close", config: "Settings", configApi: "Configure API", configSaved: "Config saved", configTitle: "Connection Settings", configUnsaved: "Config not saved", connectionBusy: "Concurrent {running}/{max} · Queue {queued}", connectionOpen: "open API and log", connectionSection: "Request Channel", connectionStatusEmpty: "API/Log missing", connectionStatusEntry: "API, Log", delete: "Delete", directEndpointSuffix: "Direct mode endpoint suffix", directMode: "Direct Mode", download: "Download", endpointUrl: "Endpoint", expandModels: "Show available models", fetchModels: "Fetch Models", fetchModelsLoading: "Fetching...", fit: "Fit", functionMenu: "Function menu", fullUrl: "Full URL", generate: "Generate", generateTitle: "Generate (Ctrl+Enter)", generationRouteLabel: "Image request mode", globalNav: "Global navigation", imageModel: "Image Model", keepSavedKey: "Keep saved key", languageEn: "English UI", languageSwitch: "Switch interface language", languageZh: "Simplified Chinese UI", menuArticleIllustration: "Article Illustration", menuArticleRecord: "Article Records", menuAssetTools: "Asset Tools", menuCreation: "Product Suite", menuCreationRecord: "Suite Records", menuCreateTools: "Creation Tools", menuGallery: "Gallery", menuImageCompress: "Image Compress", menuImageDecomposition: "Image Decomposition", menuImageEdit: "Image Edit", menuPortrait: "Portrait Mode", menuPortraitRecord: "Portrait Records", menuPpt: "PPT Generation", menuPptRecord: "PPT Records", menuPromptStudio: "Prompt to Image", menuQuickBlend: "Quick Blend", menuReferenceAnalysis: "Reference Analysis", menuSectionAssets: "Assets", menuSectionCreate: "Creation", menuSectionSettings: "Settings", menuSettings: "Settings", menuStyleTransfer: "Style Transfer", menuTools: "Tools", modeDirect: "Direct Mode", modeProtocol: "Gemini Model", modeRoute: "Route Mode", modelFetchBusy: "Fetching model list...", modelFetchFailed: "Failed to fetch model list.", modelFetchSuccess: "Fetched {count} callable models.", modelNoCallable: "No callable models found.", modelNoMatch: "No matching models", modelNoMatchWithQuery: "No matching models: {query}", modelTestBusy: "Testing connection...", modelTestSuccess: "Connection test succeeded. Found {count} models.", navAssets: "Assets", navCreate: "Create", navSettings: "Settings", notSaved: "Not saved", openOutput: "Open Output", outputFormat: "Output Format", parameters: "Parameters", previewIdleDetail: "Generation log is in Settings. Use the filmstrip below to switch results.", previewIdleEyebrow: "Output Preview", previewIdleTitle: "Generated results update here in real time.", previewWaiting: "Waiting", prompt: "Prompt", promptAgent: "Image to Prompt", promptCounterSuffix: "chars", promptEnhance: "Enhance Mode", promptEnhanceAria: "Toggle prompt enhancement mode", promptEnhanceField: "Enhancement Prompt", promptEnhanceOff: "Off", promptEnhanceOn: "On", promptPlaceholder: "Describe the image you want, or upload references first and describe the edit direction.", promptTemplate: "Prompt templates", protocolHint: "Gemini image models use the AGICTO image generation protocol. Base URL usually ends at /v1; requests go to /images/generations.", protocolImageModel: "Image Model", protocolMode: "Gemini Model", quality: "Quality", "ratio.1:1": "Ecommerce, Avatar, Social · Square 1:1", "ratio.1:2": "Long Poster · Portrait 1:2", "ratio.1:3": "Tall Ad · Portrait 1:3", "ratio.2:1": "Banner · Landscape 2:1", "ratio.2:3": "Vertical Photo · Portrait 2:3", "ratio.3:1": "Ultrawide Ad · Landscape 3:1", "ratio.3:2": "Photography · Landscape 3:2", "ratio.3:4": "Poster, Portrait · Portrait 3:4", "ratio.4:3": "PPT, Web Graphic · Landscape 4:3", "ratio.4:5": "Instagram Post · Portrait 4:5", "ratio.5:4": "Product Display · Landscape 5:4", "ratio.9:16": "Short Video Cover, Wallpaper · Portrait 9:16", "ratio.9:21": "Tall Scroll Image · Portrait 9:21", "ratio.16:9": "Cover, YouTube · Landscape 16:9", "ratio.21:9": "Ultrawide Banner · Landscape 21:9", ratioLandscape: "Landscape", ratioPortrait: "Portrait", ratioSquare: "Square", reasoningEffort: "Reasoning", reference: "Reference", referenceUploadAction: "Upload Reference", referenceUploadTitle: "Drop images or click to upload", responsesModel: "Responses Model", routeEndpointSuffix: "Route mode endpoint suffix", routeMode: "Route Mode", save: "Save", schedulingSection: "Generation Scheduling", schedulingLockNote: "Generation tasks are running or queued, so the scheduling parameters cannot be changed right now. They unlock automatically once every task finishes.", concurrencyLabel: "Request Concurrency", concurrencyUnit: "requests", concurrencyHint: "The total number of generation requests that may run at once in one session. Default 20, range 1 to 50. Lowering it eases upstream pressure and reduces rate limiting and timeouts; raising it is faster but reaches limits sooner.", size: "Size", startDelayHint: "Interval between adjacent upstream submissions in one session. Default 1000 ms, range 200 to 5000 ms. A larger interval is gentler on a rate-limited upstream but starts the last image later.", startDelayLabel: "Task Submit Interval", startDelayUnit: "ms", sizeAuto: "Auto", sizeMax: "Max", testConnection: "Test Connection", testConnectionLoading: "Testing...", themeDark: "Dark theme", themeLight: "Light theme", themeMenu: "Theme color", themeToDark: "Switch to dark theme", themeToLight: "Switch to light theme", thumbnailEmpty: "No thumbnails", thumbnailFailed: "Thumbnail load failed", thumbnailLoading: "Loading thumbnails", timelineNoErrors: "No errors", timelineWaitingResult: "Waiting for result", timelineWaitingTask: "Waiting for task", toolModel: "Tool Model", toolModelAndQuality: "Tool model and quality", view: "View", visionTextModel: "Vision/Text Model" },
};
Object.assign(UI_LANGUAGE_TEXT["zh-CN"], {
  directImageApi: "生图 API",
  directImageApiKey: "生图 API Key",
  directImageEndpointSuffix: "直接调用模式生图请求协议后缀",
  directTextApi: "文本/视觉 API",
  directTextApiKey: "文本/视觉 API Key",
  directTextEndpointSuffix: "直接调用模式文本请求协议后缀",
  visionTextModel: "文本/视觉模型",
});
Object.assign(UI_LANGUAGE_TEXT.en, {
  directImageApi: "Image API",
  directImageApiKey: "Image API key",
  directImageEndpointSuffix: "Direct image endpoint suffix",
  directTextApi: "Text/Vision API",
  directTextApiKey: "Text/Vision API key",
  directTextEndpointSuffix: "Direct text endpoint suffix",
  visionTextModel: "Text/Vision Model",
});
const CONNECTION_STATUS_ENTRY_LABEL = "API、LOG";
const CONNECTION_STATUS_EMPTY_LABEL = "待填写API、LOG";
const PROMPT_ANALYSIS_IMAGE_MAX_EDGE = 1024;
const PROMPT_ANALYSIS_IMAGE_COMPRESS_THRESHOLD_BYTES = 900 * 1024;
const PROMPT_ANALYSIS_IMAGE_JPEG_QUALITY = 0.82;
const GENERATION_REFERENCE_IMAGE_MAX_EDGE = 1024;
const GENERATION_REFERENCE_IMAGE_COMPRESS_THRESHOLD_BYTES = 900 * 1024;
const GENERATION_REFERENCE_IMAGE_JPEG_QUALITY = 0.82;
const CREATION_PRIMARY_SUBJECT_IMAGE_MAX_EDGE = 2048;
const CREATION_PRIMARY_SUBJECT_IMAGE_JPEG_QUALITY = 0.9;
// 服务端按 MAX_CREATION_ITEM_REFERENCE_BYTES = 6 MiB 计算单项参考图字节预算，主体锚点也计入其中。
// 这里必须严格小于那个预算，否则一张接近上限的主体图会吃掉整项额度，支撑参考图全部被跳过。
// 取一半即为锚点保留 3 MiB、为支撑候选留下 3 MiB 剩余名额。
const CREATION_PRIMARY_SUBJECT_IMAGE_MAX_BYTES = 3 * 1024 * 1024;
const PREVIEW_REFERENCE_DRAG_MIME = "application/x-gpt-image2-preview";
const GENERATION_TASK_POLL_INTERVAL_MS = 10000;
const GENERATION_TASK_STATUS_LABELS = { running: "生成中", completed: "生成完成", error: "错误" };
const GENERATION_TASK_TIMELINE_STATUS = { running: "active", completed: "done", error: "error" };
const GALLERY_WINDOW_LABELS = { today: "今天", recent: "近 7 天", older: "更早" };
const GALLERY_REFERENCE_LABELS = {
  "with-reference": "带参考图",
  "without-reference": "无参考图",
};
const STACKED_STUDIO_LAYOUT_MODES = new Set(["stacked", "tablet", "mobile"]);
const ADAPTIVE_COLLAPSIBLE_LAYOUTS = new Set(["stacked", "tablet", "mobile"]);
const TOPBAR_REVEAL_CLASS = "topbar-reveal";
const TOPBAR_SUPPRESSED_CLASS = "topbar-suppressed";
const TOPBAR_REVEAL_EDGE_PX = 16;
const WORKSPACE_BOTTOM_GAP_PX = 2;
const APP_TOOLTIP_TRIGGER_SELECTOR = "[data-tooltip]";
const PPT_SOURCE_MODES = new Set(["upload", "text", "topic"]);
const CREATE_VIEW_IDS = new Set(["studio", "style-transfer", "reference-analysis", "image-decomposition", "image-edit", "quick-blend", "image-compress", "creation", "portrait", "article-illustration", "ppt"]);
const ASSET_VIEW_IDS = new Set(["gallery", "article-record", "ppt-record", "creation-record", "portrait-record"]);
let studioHeightSyncFrame = 0;
let studioHeightObserver = null;
let studioDensitySyncFrame = 0;
let adaptiveSectionSyncing = false;
let adaptiveSectionLayoutMode = "";
let galleryPanelHeightSyncFrame = 0;
let galleryPanelHeightObserver = null;
let galleryScrollSyncFrame = 0;
let galleryScrollObserver = null;
let generationTaskPollTimer = 0;
let appTooltipTrigger = null;
let appTooltipDescribedBy = "";
let creationRecordRefreshPromise = null;
let creationRecordDeleteRestoreFocus = null;
let portraitRecordRefreshPromise = null;
let promptCopyFeedbackTimer = 0;
let previewLoadingShellNodes = null;
/* 变形引擎注册一次即可，之后所有加载外壳共用；放在模块顶层而不是 bootstrap 里，
   是因为外壳可能在 bootstrap 完成前就被首次渲染。 */
registerHeartbeatMorphEngine(createHeartbeatMorph);
let referenceAnalysisLoadingShellNodes = null;
let imageDecompositionLoadingShellNodes = null;
let quickBlendLoadingShellNodes = null;
const galleryScrollDrag = {
  active: false,
  pointerId: null,
  startOffset: 0,
  startY: 0,
};
const state = {
  activeView: "studio",
  assetRecordDeletion: { busy: false, request: null },
  assetLoading: { article: false, creation: false, portrait: false, ppt: false },
  assetLoadErrors: { article: "", creation: "", portrait: "", ppt: "" },
  generationLog: createGenerationLogStore(),
  generationLogExpandedGroups: new Set(),
  /* 空串表示跟随当前板块；用户点过切换后存具体 channel 或 "all"。 */
  generationLogChannel: "",
  aspectRatios: [],
  clientSessionId: "",
  config: null,
  articleIllustration: {
    currentSet: null,
    feedback: "",
    files: [],
    generating: false,
    generationSnapshot: null,
    planning: false,
    recordCheckedSetIds: [],
    recordColumnPreset: DEFAULT_ARTICLE_RECORD_COLUMN_PRESET,
    recordSetId: "",
    referenceGenerating: false,
    sets: [],
  },
  creationCategoryTemplatesModule: null,
  creationPlatformPoliciesModule: null,
  creationPlatformResolverModule: null,
  creation: {
    currentSet: null,
    draftSet: null,
    activeQueueId: "",
    autoRepairAttemptCount: 0,
    effectivePlan: null,
    feedback: "",
    generationScope: "",
    generating: false,
    listingGeneratingSetId: "",
    logoBatchLoadingKey: "",
    planning: false,
    planDirty: true,
    platformItemOverrides: [],
    platformPayload: null,
    platformSetOverrides: {},
    queue: [],
    queuedRepairItemIds: [],
    recordQuery: "",
    recordTimeFilter: "all",
    recordDateFilter: "",
    recordCheckedSetIds: [],
    recordDeleteBusy: false,
    recordDeleteRequest: null,
    recordDetailExpanded: false,
    recordListScrollTop: 0,
    recordListState: createCreationRecordListState(),
    recordSetId: "",
    recordTemuExportBusy: false,
    repairingItemId: "",
    selectedQueueId: "",
    sets: [],
  },
  portrait: {
    accessoryAssetCategory: "upper",
    accessoryAssetColors: {},
    currentSet: null,
    feedback: "",
    accessoryFiles: [],
    actionFiles: [],
    files: [],
    generating: false,
    location: createDefaultPortraitLocationState(),
    planning: false,
    referenceAnalysis: {
      applied: false,
      result: null,
      running: false,
    },
    recordCheckedSetIds: [],
    recordSetId: "",
    sets: [],
  },
  creationBranch: "set",
  creationLogoBatchFiles: [],
  creationReferenceFiles: [],
  creationLogo: {
    background: "transparent",
    file: null,
    generationCompressed: false,
    generationFile: null,
    generationFilePromise: null,
    placement: "top-left",
    previewUrl: "",
  },
  creationReferenceRestoreQueue: [],
  creationReferenceAnalysis: {
    applied: false,
    categoryManuallyEdited: false, categorySuggestionStale: false, categoryTemplateSuggestion: "",
    collapsed: false,
    dirty: false,
    productNameSuggestion: "",
    result: null,
    running: false,
  },
  creationIndustryTemplateBrowser: {
    level1: "",
    level2: "",
    level3: "",
  },
  creationReferencePreviewItem: null,
  creationRoleSelectionManuallyEdited: false,
  creationSelectedRoles: [],
  gallery: [],
  galleryCheckedFilenames: [],
  gallerySelectionMode: false,
  galleryCurrentFilename: "",
  galleryDeleteFeedback: "",
  galleryLoading: true,
  galleryLoadError: "", promptFilmstripBaselineCaptured: false, promptFilmstripBaselineFilenames: [], promptFilmstripSessionJobIds: [], promptFilmstripSessionFilenames: [],
  galleryMetadataCache: {},
  galleryControls: { ...DEFAULT_GALLERY_CONTROLS },
  galleryHistoryPage: 0,
  galleryColumnPreset: DEFAULT_GALLERY_COLUMN_PRESET,
  generationTasks: [],
  locallyTerminatedGenerationTaskIds: new Set(),
  // Keyed by preview key, not stored on jobs: removeJob() has to drop failed jobs
  // from state.jobs, which queue concurrency and cancellation both read.
  promptAttemptDecks: createPromptAttemptDeckStore(),
  expandedPromptDeckKey: "",
  selectedPromptAttempt: null,
  jobs: [],
  lightboxItem: null,
  lightboxNavigation: {
    items: [],
    index: -1,
    buildItem: null,
  },
  lightboxViewer: createLightboxViewerState(),
  limits: { ...DEFAULT_LIMITS },
  promptAgent: {
    file: null,
    history: [],
    historyLoaded: false,
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
    editablePptxUrl: "",
    pptxUrl: "",
    slides: [],
    sourceMode: "upload",
    statusText: "等待生成",
    currentSlideNumber: 0,
    recordCheckedKeys: [],
    recordDetail: {
      deckKey: "",
      slideNumber: 0,
    },
  },
  promptTemplates: [], promptTemplateDismissedHistoryIds: new Set(), promptEnhanceEnabled: false,
  reasoningEfforts: [...DEFAULT_REASONING_EFFORTS],
  referenceAnalysis: {
    files: [],
    autoCollapseOnApply: true,
    collapsed: false,
    dirty: false,
    generationKeys: [],
    generationItems: {},
    previewKey: "",
    result: null,
    running: false,
    outputLanguage: "zh-CN",
    selectedPrompt: "",
  },
  imageDecomposition: {
    file: null,
    feedback: "",
    language: "zh-CN",
    customLanguage: "",
    featureCardsEnabled: false,
    generationKeys: [],
    generationItems: {},
    previewKey: "",
  },
  imageEdit: {
    source: null,
    feedback: "",
    feedbackKind: "",
    generationKeys: [],
    generationItems: {},
    localEdit: {
      enabled: false,
      activeRegionId: "",
      brushSize: 48,
      tool: "brush",
      executionStrategy: "merge",
      nextRegionIndex: 1,
      regions: [],
    },
    previewKey: "",
  },
  quickBlend: {
    aFiles: [],
    bFiles: [],
    cFiles: [], dFiles: [],
    layoutOrder: "vertical", placementShape: "square",
    feedback: "",
    feedbackKind: "",
    generationKeys: [],
    generationItems: {},
    previewKey: "",
  },
  referenceCompressionRunning: false,
  referenceFiles: [],
  imageDecompositionPreviewItem: null,
  imageEditPreviewItem: null,
  quickBlendPreviewItem: null,
  referenceAnalysisPreviewItem: null,
  referencePreviewNavigation: {
    items: [],
    index: -1,
  },
  referencePreviewItem: null,
  selectedPromptTemplateId: "",
  selectedPreviewKey: "",
  studioMode: "prompt",
  styleTransfer: {
    source: null,
    style: null,
    selectedPreset: STYLE_TRANSFER_DEFAULT_PRESET,
    presetReferenceFile: null,
    presetReferenceFileKey: "",
  },
  styleTransferPreviewItem: null,
  timelineHasRendered: false,
  timelineSignatures: new Map(),
  timelineUnreadCount: 0,
  uiTheme: "dark",
  uiLanguage: "zh-CN",
  zoom: 1,
};
let creationReferenceAnalysisRequestToken = 0;
let creationReferenceAnalysisAbortController = null;
let creationReferenceAnalysisApplyGuard = null;
let promptAgentAnalysisRequestToken = 0;
let promptAgentAnalysisAbortController = null;
let referenceAnalysisRequestToken = 0;
let referenceAnalysisAbortController = null;
let creationPreviousPlatformValue = "universal";
const refs = {
  appTooltip: document.querySelector("#appTooltip"),
  apiKeyInput: document.querySelector("#apiKeyInput"),
  assetRecordDeleteCancelButton: document.querySelector("#assetRecordDeleteCancelButton"),
  assetRecordDeleteConfirmButton: document.querySelector("#assetRecordDeleteConfirmButton"),
  assetRecordDeleteDialog: document.querySelector("#assetRecordDeleteDialog"),
  assetRecordDeleteDialogMessage: document.querySelector("#assetRecordDeleteDialogMessage"),
  assetRecordDeleteDialogTitle: document.querySelector("#assetRecordDeleteDialogTitle"),
  assetRecordDeleteForm: document.querySelector("#assetRecordDeleteForm"),
  baseUrlInput: document.querySelector("#baseUrlInput"),
  baseUrlFullToggle: document.querySelector("#baseUrlFullToggle"),
  directApiKeyInput: document.querySelector("#directApiKeyInput"),
  directBaseUrlInput: document.querySelector("#directBaseUrlInput"),
  directBaseUrlFullToggle: document.querySelector("#directBaseUrlFullToggle"),
  directEndpointPathSelect: document.querySelector("#directEndpointPathSelect"),
  directImageApiKeyInput: document.querySelector("#directApiKeyInput"),
  directImageBaseUrlInput: document.querySelector("#directBaseUrlInput"),
  directImageEndpointPathSelect: document.querySelector("#directEndpointPathSelect"),
  directFetchModelsButton: document.querySelector("#directFetchModelsButton"),
  directImageModelInput: document.querySelector("#directImageModelInput"),
  directModelOptionsList: document.querySelector("#directModelOptionsList"),
  directModelPickerToggle: document.querySelector("#directModelPickerToggle"),
  directResponsesFetchModelsButton: document.querySelector("#directResponsesFetchModelsButton"),
  directResponsesModelInput: document.querySelector("#directResponsesModelInput"),
  directResponsesModelOptionsList: document.querySelector("#directResponsesModelOptionsList"),
  directResponsesModelPickerToggle: document.querySelector("#directResponsesModelPickerToggle"),
  directSavedKeyMask: document.querySelector("#directSavedKeyMask"),
  directTextApiKeyInput: document.querySelector("#directTextApiKeyInput"),
  directTextBaseUrlInput: document.querySelector("#directTextBaseUrlInput"),
  directTextBaseUrlFullToggle: document.querySelector("#directTextBaseUrlFullToggle"),
  directTextEndpointPathSelect: document.querySelector("#directTextEndpointPathSelect"),
  directTextSavedKeyMask: document.querySelector("#directTextSavedKeyMask"),
  endpointPathSelect: document.querySelector("#endpointPathSelect"),
  imageRouteInputs: [...document.querySelectorAll('input[name="imageRoute"]')],
  protocolApiKeyInput: document.querySelector("#protocolApiKeyInput"),
  protocolBaseUrlInput: document.querySelector("#protocolBaseUrlInput"),
  protocolEndpointPreview: document.querySelector("#protocolEndpointPreview"),
  protocolFetchModelsButton: document.querySelector("#protocolFetchModelsButton"),
  protocolImageModelInput: document.querySelector("#protocolImageModelInput"),
  protocolModelOptionsList: document.querySelector("#protocolModelOptionsList"),
  protocolModelPickerToggle: document.querySelector("#protocolModelPickerToggle"),
  protocolSavedKeyMask: document.querySelector("#protocolSavedKeyMask"),
  clearHistoryButton: document.querySelector("#clearHistoryButton"),
  closeConfigBackdrop: document.querySelector("#closeConfigBackdrop"),
  closeConfigButton: document.querySelector("#closeConfigButton"),
  configDrawer: document.querySelector("#configDrawer"),
  configFeedback: document.querySelector("#configFeedback"),
  configForm: document.querySelector("#configForm"),
  configGenerationLogPanel: document.querySelector("#configGenerationLogPanel"),
  configStatus: document.querySelector("#configStatus"),
  generationStartDelayInput: document.querySelector("#generationStartDelayInput"),
  generationConcurrencyInput: document.querySelector("#generationConcurrencyInput"),
  generationSchedulingLockNote: document.querySelector("#generationSchedulingLockNote"),
  fetchModelsButton: document.querySelector("#fetchModelsButton"),
  connectionLabel: document.querySelector("#connectionLabel"),
  connectionStatus: document.querySelector("#connectionStatus"),
  articleIllustrationContentTypeInput: document.querySelector("#articleIllustrationContentTypeInput"),
  articleIllustrationCount: document.querySelector("#articleIllustrationCount"),
  articleIllustrationDropzone: document.querySelector("#articleIllustrationDropzone"),
  articleIllustrationFeedback: document.querySelector("#articleIllustrationFeedback"),
  articleIllustrationFileCount: document.querySelector("#articleIllustrationFileCount"),
  articleIllustrationFileList: document.querySelector("#articleIllustrationFileList"),
  articleIllustrationForm: document.querySelector("#articleIllustrationForm"),
  articleIllustrationGenerateButton: document.querySelector("#articleIllustrationGenerateButton"),
  articleIllustrationPlanButton: document.querySelector("#articleIllustrationPlanButton"),
  articleIllustrationReferenceButton: document.querySelector("#articleIllustrationReferenceButton"),
  articleIllustrationReferenceList: document.querySelector("#articleIllustrationReferenceList"),
  articleIllustrationSetMeta: document.querySelector("#articleIllustrationSetMeta"),
  articleIllustrationSourceFilesInput: document.querySelector("#articleIllustrationSourceFilesInput"),
  articleIllustrationSourceLength: document.querySelector("#articleIllustrationSourceLength"),
  articleIllustrationSourceTextInput: document.querySelector("#articleIllustrationSourceTextInput"),
  articleIllustrationStoryboardList: document.querySelector("#articleIllustrationStoryboardList"),
  articleIllustrationStyleBibleInput: document.querySelector("#articleIllustrationStyleBibleInput"),
  articleIllustrationStylePresetInput: document.querySelector("#articleIllustrationStylePresetInput"),
  articleIllustrationSupplementInput: document.querySelector("#articleIllustrationSupplementInput"),
  articleIllustrationTitleInput: document.querySelector("#articleIllustrationTitleInput"),
  articleReferenceSectionCount: document.querySelector("#articleReferenceSectionCount"),
  articleRecordContinueButton: document.querySelector("#articleRecordContinueButton"),
  articleRecordCopyCaptionsButton: document.querySelector("#articleRecordCopyCaptionsButton"),
  articleRecordCopyPromptsButton: document.querySelector("#articleRecordCopyPromptsButton"),
  articleRecordColumnButtons: [...document.querySelectorAll("[data-article-record-column-preset]")],
  articleRecordDetail: document.querySelector("#articleRecordDetail"),
  articleRecordDeleteCurrentButton: document.querySelector("#articleRecordDeleteCurrentButton"),
  articleRecordDeleteSelectedButton: document.querySelector("#articleRecordDeleteSelectedButton"),
  articleRecordFeedback: document.querySelector("#articleRecordFeedback"),
  articleRecordList: document.querySelector("#articleRecordList"),
  articleRecordRefreshButton: document.querySelector("#articleRecordRefreshButton"),
  articleRecordSelection: document.querySelector("#articleRecordSelection"),
  articleStoryboardSectionCount: document.querySelector("#articleStoryboardSectionCount"),
  creationBranchInputs: document.querySelectorAll('[name="creationBranch"]'),
  creationFeedback: document.querySelector("#creationFeedback"),
  creationForm: document.querySelector("#creationForm"),
  creationGenerateButton: document.querySelector("#creationGenerateButton"),
  creationInfographicRebuildEnabledInput: document.querySelector("#creationInfographicRebuildEnabledInput"),
  creationListingAgentEnabledInput: document.querySelector("#creationListingAgentEnabledInput"),
  creationDimensionSpecsInput: document.querySelector("#creationDimensionSpecsInput"),
  creationDimensionUnitModeInput: document.querySelector("#creationDimensionUnitModeInput"),
  creationImageCountInput: document.querySelector("#creationImageCountInput"),
  creationInlineListingDrafts: document.querySelector("#creationInlineListingDrafts"),
  creationInlineListingStatus: document.querySelector("#creationInlineListingStatus"),
  creationIndustryTemplateBrowser: document.querySelector("#creationIndustryTemplateBrowser"),
  creationIndustryTemplateBackButton: document.querySelector("#creationIndustryTemplateBackButton"),
  creationIndustryTemplateCurrent: document.querySelector("#creationIndustryTemplateCurrent"),
  creationIndustryTemplateInput: document.querySelector("#creationIndustryTemplateInput"),
  creationIndustryTemplateLevels: document.querySelector("#creationIndustryTemplateLevels"),
  creationIndustryTemplatePopover: document.querySelector("#creationIndustryTemplatePopover"),
  creationIndustryTemplateSearchInput: document.querySelector("#creationIndustryTemplateSearchInput"),
  creationIndustryTemplateStepLabel: document.querySelector("#creationIndustryTemplateStepLabel"),
  creationIndustryTemplateTrigger: document.querySelector("#creationIndustryTemplateTrigger"),
  creationLogoBackgroundInput: document.querySelector("#creationLogoBackgroundInput"),
  creationLogoDropzone: document.querySelector("#creationLogoDropzone"),
  creationLogoInput: document.querySelector("#creationLogoInput"),
  creationLogoLibraryButton: document.querySelector("#creationLogoLibraryButton"), creationLogoLibraryCloseButton: document.querySelector("#creationLogoLibraryCloseButton"), creationLogoLibraryCount: document.querySelector("#creationLogoLibraryCount"), creationLogoLibraryEmpty: document.querySelector("#creationLogoLibraryEmpty"), creationLogoLibraryInput: document.querySelector("#creationLogoLibraryInput"), creationLogoLibraryPanel: document.querySelector("#creationLogoLibraryPanel"),
  creationLogoBatchOnly: [...document.querySelectorAll("[data-creation-logo-batch-only]")],
  creationLogoBatchSourceCount: document.querySelector("#creationLogoBatchSourceCount"),
  creationLogoBatchSourceDropzone: document.querySelector("#creationLogoBatchSourceDropzone"),
  creationLogoBatchSourceGrid: document.querySelector("#creationLogoBatchSourceGrid"),
  creationLogoBatchSourceInput: document.querySelector("#creationLogoBatchSourceInput"),
  creationLogoPlacementInput: document.querySelector("#creationLogoPlacementInput"),
  creationLogoPreview: document.querySelector("#creationLogoPreview"),
  creationLogoPreviewImage: document.querySelector("#creationLogoPreviewImage"),
  creationLogoRemoveButton: document.querySelector("#creationLogoRemoveButton"),
  creationSavedLogoGrid: document.querySelector("#creationSavedLogoGrid"),
  creationOutputFormatInput: document.querySelector("#creationOutputFormatInput"),
  creationPlanButton: document.querySelector("#creationPlanButton"),
  creationPlanRestoreButton: document.querySelector("#creationPlanRestoreButton"),
  creationPlanSummary: document.querySelector("#creationPlanSummary"),
  creationPlanValidation: document.querySelector("#creationPlanValidation"),
  creationPlanWarnings: document.querySelector("#creationPlanWarnings"),
  creationProductDescriptionInput: document.querySelector("#creationProductDescriptionInput"),
  creationProductNameInput: document.querySelector("#creationProductNameInput"),
  creationProgressText: document.querySelector("#creationProgressText"),
  creationReferenceAnalysisFeedback: document.querySelector("#creationReferenceAnalysisFeedback"),
  creationReferenceAnalysisList: document.querySelector("#creationReferenceAnalysisList"),
  creationReferenceAnalysisMeta: document.querySelector("#creationReferenceAnalysisMeta"),
  creationReferenceAnalysisPanel: document.querySelector("#creationReferenceAnalysisPanel"),
  creationReferenceAnalysisSummary: document.querySelector("#creationReferenceAnalysisSummary"),
  creationReferenceAnalysisToggleButton: document.querySelector("#creationReferenceAnalysisToggleButton"),
  creationReferenceAnalyzeButton: document.querySelector("#creationReferenceAnalyzeButton"),
  creationReferenceCount: document.querySelector("#creationReferenceCount"),
  creationReferenceDropzone: document.querySelector("#creationReferenceDropzone"),
  creationReferenceGrid: document.querySelector("#creationReferenceGrid"),
  creationReferenceInput: document.querySelector("#creationReferenceInput"),
  creationReferenceResetButton: document.querySelector("#creationReferenceResetButton"),
  creationReferenceRestoreList: document.querySelector("#creationReferenceRestoreList"),
  portraitCustomStyleInput: document.querySelector("#portraitCustomStyleInput"),
  portraitDetail: document.querySelector("#portraitDetail"),
  portraitFeedback: document.querySelector("#portraitFeedback"),
  portraitForm: document.querySelector("#portraitForm"),
  portraitGenerateButton: document.querySelector("#portraitGenerateButton"),
  portraitImageCountInput: document.querySelector("#portraitImageCountInput"),
  portraitNotesInput: document.querySelector("#portraitNotesInput"),
  portraitOutputFormatInput: document.querySelector("#portraitOutputFormatInput"),
  portraitPlanButton: document.querySelector("#portraitPlanButton"),
  portraitProgressText: document.querySelector("#portraitProgressText"),
  portraitRatioInput: document.querySelector("#portraitRatioInput"),
  portraitRecordActionFeedback: document.querySelector("#portraitRecordActionFeedback"),
  portraitRecordArchiveDetail: document.querySelector("#portraitRecordArchiveDetail"),
  portraitRecordCopyPromptsButton: document.querySelector("#portraitRecordCopyPromptsButton"),
  portraitRecordCopyPathsButton: document.querySelector("#portraitRecordCopyPathsButton"),
  portraitRecordDeleteCurrentButton: document.querySelector("#portraitRecordDeleteCurrentButton"),
  portraitRecordDeleteSelectedButton: document.querySelector("#portraitRecordDeleteSelectedButton"),
  portraitRecordExportManifestButton: document.querySelector("#portraitRecordExportManifestButton"),
  portraitRecordExportPromptsButton: document.querySelector("#portraitRecordExportPromptsButton"),
  portraitRecordOpenFolderButton: document.querySelector("#portraitRecordOpenFolderButton"),
  portraitRecordRefreshButton: document.querySelector("#portraitRecordRefreshButton"),
  portraitRecordResultGrid: document.querySelector("#portraitRecordResultGrid"),
  portraitRecordReuseButton: document.querySelector("#portraitRecordReuseButton"),
  portraitRecordSelection: document.querySelector("#portraitRecordSelection"),
  portraitRecordSetList: document.querySelector("#portraitRecordSetList"),
  portraitAccessoryAssetButton: document.querySelector("#portraitAccessoryAssetButton"),
  portraitAccessoryAssetCloseButton: document.querySelector("#portraitAccessoryAssetCloseButton"),
  portraitAccessoryAssetFeedback: document.querySelector("#portraitAccessoryAssetFeedback"),
  portraitAccessoryAssetList: document.querySelector("#portraitAccessoryAssetList"),
  portraitAccessoryAssetPopover: document.querySelector("#portraitAccessoryAssetPopover"),
  portraitAccessoryAssetTabs: document.querySelector("#portraitAccessoryAssetTabs"),
  portraitAccessoryReferenceCount: document.querySelector("#portraitAccessoryReferenceCount"),
  portraitAccessoryReferenceDropzone: document.querySelector("#portraitAccessoryReferenceDropzone"),
  portraitAccessoryReferenceGrid: document.querySelector("#portraitAccessoryReferenceGrid"),
  portraitAccessoryReferenceInput: document.querySelector("#portraitAccessoryReferenceInput"),
  portraitActionReferenceCount: document.querySelector("#portraitActionReferenceCount"),
  portraitActionReferenceDropzone: document.querySelector("#portraitActionReferenceDropzone"),
  portraitActionReferenceGrid: document.querySelector("#portraitActionReferenceGrid"),
  portraitActionReferenceInput: document.querySelector("#portraitActionReferenceInput"),
  portraitActionInputs: [...document.querySelectorAll("[name=\"portraitActions\"]")],
  portraitReferenceCount: document.querySelector("#portraitReferenceCount"),
  portraitReferenceAnalyzeButton: document.querySelector("#portraitReferenceAnalyzeButton"),
  portraitReferenceApplyAnalysisButton: document.querySelector("#portraitReferenceApplyAnalysisButton"),
  portraitReferenceAnalysisFeedback: document.querySelector("#portraitReferenceAnalysisFeedback"),
  portraitReferenceAnalysisPanel: document.querySelector("#portraitReferenceAnalysisPanel"),
  portraitReferenceDropzone: document.querySelector("#portraitReferenceDropzone"),
  portraitReferenceGrid: document.querySelector("#portraitReferenceGrid"),
  portraitReferenceInput: document.querySelector("#portraitReferenceInput"),
  portraitRepairFailedButton: document.querySelector("#portraitRepairFailedButton"),
  portraitResultGrid: document.querySelector("#portraitResultGrid"),
  portraitSetMeta: document.querySelector("#portraitSetMeta"),
  portraitShotTypeInputs: [...document.querySelectorAll("[name=\"portraitShotTypes\"]")],
  portraitSizeInput: document.querySelector("#portraitSizeInput"),
  portraitStyleInputs: [...document.querySelectorAll("[name=\"portraitStyles\"]")],
  portraitSubjectSummaryInput: document.querySelector("#portraitSubjectSummaryInput"),
  creationRecordActionFeedback: document.querySelector("#creationRecordActionFeedback"),
  creationRecordArchiveDetail: document.querySelector("#creationRecordArchiveDetail"),
  creationRecordCopyFullPathsButton: document.querySelector("#creationRecordCopyFullPathsButton"),
  creationRecordCopyListingsButton: document.querySelector("#creationRecordCopyListingsButton"),
  creationRecordCopyPromptsButton: document.querySelector("#creationRecordCopyPromptsButton"),
  creationRecordCount: document.querySelector("#creationRecordCount"),
  creationRecordDateInput: document.querySelector("#creationRecordDateInput"),
  creationRecordDeleteCancelButton: document.querySelector("#creationRecordDeleteCancelButton"),
  creationRecordDeleteConfirmButton: document.querySelector("#creationRecordDeleteConfirmButton"),
  creationRecordDeleteCurrentButton: document.querySelector("#creationRecordDeleteCurrentButton"),
  creationRecordDeleteCurrentMenuButton: document.querySelector("#creationRecordDeleteCurrentMenuButton"),
  creationRecordDeleteDialog: document.querySelector("#creationRecordDeleteDialog"),
  creationRecordDeleteDialogMessage: document.querySelector("#creationRecordDeleteDialogMessage"),
  creationRecordDeleteDialogTitle: document.querySelector("#creationRecordDeleteDialogTitle"),
  creationRecordDeleteFilteredButton: document.querySelector("#creationRecordDeleteFilteredButton"),
  creationRecordDeleteFilteredMenuButton: document.querySelector("#creationRecordDeleteFilteredMenuButton"),
  creationRecordDeleteForm: document.querySelector("#creationRecordDeleteForm"),
  creationRecordDeleteSelectedButton: document.querySelector("#creationRecordDeleteSelectedButton"),
  creationRecordDeleteSelectedMenuButton: document.querySelector("#creationRecordDeleteSelectedMenuButton"),
  creationRecordDetail: document.querySelector("#creationRecordDetail"),
  creationRecordExportListingsButton: document.querySelector("#creationRecordExportListingsButton"),
  creationRecordExportManifestButton: document.querySelector("#creationRecordExportManifestButton"),
  creationRecordExportPromptsButton: document.querySelector("#creationRecordExportPromptsButton"),
  creationRecordGenerateListingsButton: document.querySelector("#creationRecordGenerateListingsButton"),
  creationRecordRegenerateListingsButton: document.querySelector("#creationRecordRegenerateListingsButton"),
  creationRecordListingDrafts: document.querySelector("#creationRecordListingDrafts"),
  creationRecordListingStatus: document.querySelector("#creationRecordListingStatus"),
  creationRecordOpenFolderButton: document.querySelector("#creationRecordOpenFolderButton"),
  creationRecordRepairIncompleteButton: document.querySelector("#creationRecordRepairIncompleteButton"),
  creationRecordRepairIncompleteMenuButton: document.querySelector("#creationRecordRepairIncompleteMenuButton"),
  creationRecordRefreshButton: document.querySelector("#creationRecordRefreshButton"),
  creationRecordRefreshMenuButton: document.querySelector("#creationRecordRefreshMenuButton"),
  creationRecordResetFiltersButton: document.querySelector("#creationRecordResetFiltersButton"),
  creationRecordReuseButton: document.querySelector("#creationRecordReuseButton"),
  creationRecordResultGrid: document.querySelector("#creationRecordResultGrid"),
  creationRecordSearchInput: document.querySelector("#creationRecordSearchInput"),
  creationRecordSelection: document.querySelector("#creationRecordSelection"),
  creationRecordSetList: document.querySelector("#creationRecordSetList"),
  creationRecordListSummary: document.querySelector("#creationRecordListSummary"),
  creationRecordLoadMoreButton: document.querySelector("#creationRecordLoadMoreButton"),
  creationRecordTimeFilters: document.querySelector("#creationRecordTimeFilters"),
  creationQueueStrip: document.querySelector("#creationQueueStrip"),
  creationRepairFailedButton: document.querySelector("#creationRepairFailedButton"),
  creationResultGrid: document.querySelector("#creationResultGrid"),
  creationRoleCount: document.querySelector("#creationRoleCount"),
  creationRoleGrid: document.querySelector("#creationRoleGrid"),
  creationPlatformInput: document.querySelector("#creationPlatformInput"),
  creationSellingPointsInput: document.querySelector("#creationSellingPointsInput"),
  creationSetOnly: [...document.querySelectorAll("[data-creation-set-only]")],
  creationSetMeta: document.querySelector("#creationSetMeta"),
  creationSizeInput: document.querySelector("#creationSizeInput"),
  creationSkuBundleCountInput: document.querySelector("#creationSkuBundleCountInput"),
  creationSkuGenerationEnabledInput: document.querySelector("#creationSkuGenerationEnabledInput"),
  creationSkuGenerationRuleInput: document.querySelector("#creationSkuGenerationRuleInput"),
  creationRatioInput: document.querySelector("#creationRatioInput"),
  creationTargetLanguageInput: document.querySelector("#creationTargetLanguageInput"),
  errorBanner: document.querySelector("#errorBanner"),
  filmstrip: document.querySelector("#filmstrip"),
  focusGalleryButton: document.querySelector("#focusGalleryButton"),
  galleryActionFeedback: document.querySelector("#galleryActionFeedback"),
  galleryCount: document.querySelector("#galleryCount"),
  galleryColumnButtons: [...document.querySelectorAll("[data-gallery-column-preset]")],
  galleryColumnSwitch: document.querySelector("#galleryColumnSwitch"),
  galleryDateInput: document.querySelector("#galleryDateInput"),
  galleryDeleteCurrentButton: document.querySelector("#galleryDeleteCurrentButton"),
  galleryDeleteSelectedButton: document.querySelector("#galleryDeleteSelectedButton"),
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
  gallerySelectionModeButton: document.querySelector("#gallerySelectionModeButton"),
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
  generationModeStatus: document.querySelector("#generationModeStatus"),
  globalNav: document.querySelector(".global-nav"),
  globalNavItems: [...document.querySelectorAll("[data-nav-section]")],
  lightbox: document.querySelector("#lightbox"),
  lightboxAmbient: document.querySelector("#lightboxAmbient"),
  lightboxBackdrop: document.querySelector("#lightboxBackdrop"),
  lightboxClose: document.querySelector("#lightboxClose"),
  lightboxComparison: document.querySelector("#lightboxComparison"),
  copyPromptButton: document.querySelector("#copyPromptButton"),
  lightboxDownload: document.querySelector("#lightboxDownload"),
  lightboxId: document.querySelector("#lightboxId"),
  lightboxFilename: document.querySelector("#lightboxFilename"),
  lightboxImage: document.querySelector("#lightboxImage"),
  lightboxImageShell: document.querySelector(".lightbox-image-shell"),
  lightboxFields: document.querySelector(".lightbox-fields"),
  lightboxMediaStage: document.querySelector(".lightbox-media-stage"),
  lightboxModel: document.querySelector("#lightboxModel"),
  lightboxParams: document.querySelector("#lightboxParams"),
  lightboxPrompt: document.querySelector("#lightboxPrompt"),
  lightboxPromptStructured: document.querySelector("#lightboxPromptStructured"),
  lightboxRelativePath: document.querySelector("#lightboxRelativePath"),
  lightboxTime: document.querySelector("#lightboxTime"),
  lightboxActualSizeButton: document.querySelector("#lightboxActualSizeButton"),
  lightboxFitButton: document.querySelector("#lightboxFitButton"),
  lightboxViewerControls: document.querySelector(".lightbox-viewer-controls"),
  lightboxZoomInButton: document.querySelector("#lightboxZoomInButton"),
  lightboxZoomLabel: document.querySelector("#lightboxZoomLabel"),
  lightboxZoomOutButton: document.querySelector("#lightboxZoomOutButton"),
  liveCount: document.querySelector("#liveCount"),
  openConfigButton: document.querySelector("#openConfigButton"),
  openOutputButton: document.querySelector("#openOutputButton"),
  openPromptAgentButton: document.querySelector("#openPromptAgentButton"),
  outputFormatInput: document.querySelector("#outputFormatInput"),
  previewDeleteButton: document.querySelector("#previewDeleteButton"),
  previewDownloadButton: document.querySelector("#previewDownloadButton"),
  previewId: document.querySelector("#previewId"),
  previewImage: document.querySelector("#previewImage"),
  previewAddReferenceButton: document.querySelector("#previewAddReferenceButton"),
  previewLightboxButton: document.querySelector("#previewLightboxButton"),
  previewModel: document.querySelector("#previewModel"),
  previewPlaceholder: document.querySelector("#previewPlaceholder"),
  previewSize: document.querySelector("#previewSize"),
  previewTime: document.querySelector("#previewTime"),
  promptCounter: document.querySelector("#promptCounter"), promptEnhanceField: document.querySelector("#promptEnhanceField"), promptEnhanceInput: document.querySelector("#promptEnhanceInput"), promptEnhanceToggle: document.querySelector("#promptEnhanceToggle"),
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
  pptDownloadLink: document.querySelector("#pptDownloadLink"),
  pptEditableDownloadLink: document.querySelector("#pptEditableDownloadLink"),
  pptDropzone: document.querySelector("#pptDropzone"),
  pptAutoAdvanceInput: document.querySelector("#pptAutoAdvanceInput"),
  pptDynamicPresetInput: document.querySelector("#pptDynamicPresetInput"),
  pptExportModeInput: document.querySelector("#pptExportModeInput"),
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
  pptOutlineBox: document.querySelector("#pptOutlineBox"),
  pptPageCountInput: document.querySelector("#pptPageCountInput"),
  pptProgressBar: document.querySelector("#pptProgressBar"),
  pptRecordDeleteCurrentButton: document.querySelector("#pptRecordDeleteCurrentButton"),
  pptRecordDeleteSelectedButton: document.querySelector("#pptRecordDeleteSelectedButton"),
  pptRecordDetail: document.querySelector("#pptRecordDetail"),
  pptRecordEmpty: document.querySelector("#pptRecordEmpty"),
  pptRecordFeedback: document.querySelector("#pptRecordFeedback"),
  pptRecordList: document.querySelector("#pptRecordList"),
  pptRecordRefreshButton: document.querySelector("#pptRecordRefreshButton"),
  pptRecordSelection: document.querySelector("#pptRecordSelection"),
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
  clearPromptButton: document.querySelector("#clearPromptButton"),
  promptInput: document.querySelector("#promptInput"),
  promptModeBlocks: [document.querySelector(".reference-field-group"), ...document.querySelectorAll("[data-prompt-mode-block]")].filter(Boolean),
  promptTemplateFeedback: document.querySelector("#promptTemplateFeedback"),
  promptTemplateForm: document.querySelector("#promptTemplateForm"),
  promptTemplateList: document.querySelector("#promptTemplateList"),
  promptTemplateNameInput: document.querySelector("#promptTemplateNameInput"),
  promptTemplatePopover: document.querySelector("#promptTemplatePopover"),
  promptTemplateTextInput: document.querySelector("#promptTemplateTextInput"),
  ratioGrid: document.querySelector("#ratioGrid"),
  ratioInput: document.querySelector("#ratioInput"),
  ratioOrientationSummary: document.querySelector("#ratioOrientationSummary"),
  reasoningEffortInput: document.querySelector("#reasoningEffortInput"),
  recentEmpty: document.querySelector("#recentEmpty"),
  recentList: document.querySelector("#recentList"),
  clearReferenceButton: document.querySelector("#clearReferenceButton"),
  referenceCount: document.querySelector("#referenceCount"),
  referenceAnalysisAutoCollapseButton: document.querySelector("#referenceAnalysisAutoCollapseButton"),
  referenceAnalysisCount: document.querySelector("#referenceAnalysisCount"),
  referenceAnalysisDropzone: document.querySelector("#referenceAnalysisDropzone"),
  referenceAnalysisEmpty: document.querySelector("#referenceAnalysisEmpty"),
  referenceAnalysisFeedback: document.querySelector("#referenceAnalysisFeedback"),
  referenceAnalysisGrid: document.querySelector("#referenceAnalysisGrid"),
  referenceAnalysisHead: document.querySelector("#referenceAnalysisHead"),
  referenceAnalysisInput: document.querySelector("#referenceAnalysisInput"),
  referenceAnalysisLanguageInput: document.querySelector("#referenceAnalysisLanguageInput"),
  referenceAnalysisList: document.querySelector("#referenceAnalysisList"),
  referenceAnalysisMeta: document.querySelector("#referenceAnalysisMeta"),
  referenceAnalysisPanel: document.querySelector("#referenceAnalysisPanel"),
  referenceAnalysisRatioGrid: document.querySelector("#referenceAnalysisRatioGrid"),
  referenceAnalysisRatioInput: document.querySelector("#referenceAnalysisRatioInput"),
  referenceAnalysisSizeInput: document.querySelector("#referenceAnalysisSizeInput"),
  referenceAnalysisSelectedPrompt: document.querySelector("#referenceAnalysisSelectedPrompt"),
  referenceAnalysisSelectedPromptPanel: document.querySelector("#referenceAnalysisSelectedPromptPanel"),
  referenceAnalysisCopyPromptButton: document.querySelector("#referenceAnalysisCopyPromptButton"),
  referenceAnalysisGenerateButton: document.querySelector("#referenceAnalysisGenerateButton"),
  referenceAnalysisGenerationCanvas: document.querySelector("#referenceAnalysisGenerationCanvas"),
  referenceAnalysisGenerationDownloadButton: document.querySelector("#referenceAnalysisGenerationDownloadButton"),
  referenceAnalysisGenerationImage: document.querySelector("#referenceAnalysisGenerationImage"),
  referenceAnalysisGenerationMeta: document.querySelector("#referenceAnalysisGenerationMeta"),
  referenceAnalysisGenerationPlaceholder: document.querySelector("#referenceAnalysisGenerationPlaceholder"),
  referenceAnalysisGenerationStrip: document.querySelector("#referenceAnalysisGenerationStrip"),
  referenceAnalysisThumbnailEmpty: document.querySelector("#referenceAnalysisThumbnailEmpty"),
  referenceAnalysisSummary: document.querySelector("#referenceAnalysisSummary"),
  referenceAnalysisToggleButton: document.querySelector("#referenceAnalysisToggleButton"),
  imageDecompositionCount: document.querySelector("#imageDecompositionCount"),
  imageDecompositionCustomLanguageField: document.querySelector("#imageDecompositionCustomLanguageField"),
  imageDecompositionCustomLanguageInput: document.querySelector("#imageDecompositionCustomLanguageInput"),
  imageDecompositionDropzone: document.querySelector("#imageDecompositionDropzone"),
  imageDecompositionFeedback: document.querySelector("#imageDecompositionFeedback"),
  imageDecompositionFeatureCardsInput: document.querySelector("#imageDecompositionFeatureCardsInput"),
  imageDecompositionGenerateButton: document.querySelector("#imageDecompositionGenerateButton"),
  imageDecompositionGenerationCanvas: document.querySelector("#imageDecompositionGenerationCanvas"),
  imageDecompositionGenerationDownloadButton: document.querySelector("#imageDecompositionGenerationDownloadButton"),
  imageDecompositionGenerationImage: document.querySelector("#imageDecompositionGenerationImage"),
  imageDecompositionGenerationLightboxButton: document.querySelector("#imageDecompositionGenerationLightboxButton"),
  imageDecompositionGenerationMeta: document.querySelector("#imageDecompositionGenerationMeta"),
  imageDecompositionGenerationPlaceholder: document.querySelector("#imageDecompositionGenerationPlaceholder"),
  imageDecompositionGenerationStrip: document.querySelector("#imageDecompositionGenerationStrip"),
  imageDecompositionGrid: document.querySelector("#imageDecompositionGrid"),
  imageDecompositionInput: document.querySelector("#imageDecompositionInput"),
  imageDecompositionLanguageInput: document.querySelector("#imageDecompositionLanguageInput"),
  imageDecompositionRatioGrid: document.querySelector("#imageDecompositionRatioGrid"),
  imageDecompositionRatioInput: document.querySelector("#imageDecompositionRatioInput"),
  imageDecompositionSizeInput: document.querySelector("#imageDecompositionSizeInput"),
  imageDecompositionThumbnailEmpty: document.querySelector("#imageDecompositionThumbnailEmpty"),
  referenceAnalyzeButton: document.querySelector("#referenceAnalyzeButton"),
  referenceDropzone: document.querySelector("#referenceDropzone"),
  referenceGrid: document.querySelector("#referenceGrid"),
  referenceInput: document.querySelector("#referenceInput"),
  referencePreviewBackdrop: document.querySelector("#referencePreviewBackdrop"),
  referencePreviewClose: document.querySelector("#referencePreviewClose"),
  referencePreviewImage: document.querySelector("#referencePreviewImage"),
  referencePreviewViewer: document.querySelector("#referencePreviewViewer"),
  refreshGalleryButton: document.querySelector("#refreshGalleryButton"),
  modelOptionsList: document.querySelector("#modelOptionsList"),
  modelPickerToggle: document.querySelector("#modelPickerToggle"),
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
  studioView: document.querySelector(".studio-view"),
  styleTransferBlock: document.querySelector("#styleTransferBlock"),
  testConnectionButton: document.querySelector("#testConnectionButton"),
  styleTransferInstructionInput: document.querySelector("#styleTransferInstructionInput"),
  styleTransferPresetComparison: document.querySelector("#styleTransferPresetComparison"),
  styleTransferPresetDescription: document.querySelector("#styleTransferPresetDescription"),
  styleTransferPresetInput: document.querySelector("#styleTransferPresetInput"),
  styleTransferPresetLabel: document.querySelector("#styleTransferPresetLabel"),
  styleTransferPresetPreview: document.querySelector("#styleTransferPresetPreview"),
  styleTransferSourceDropzone: document.querySelector("#styleTransferSourceDropzone"),
  styleTransferSourceGrid: document.querySelector("#styleTransferSourceGrid"),
  styleTransferSourceInput: document.querySelector("#styleTransferSourceInput"),
  styleTransferStyleDropzone: document.querySelector("#styleTransferStyleDropzone"),
  styleTransferStyleGrid: document.querySelector("#styleTransferStyleGrid"),
  styleTransferStyleInput: document.querySelector("#styleTransferStyleInput"),
  styleTransferUploadGrid: document.querySelector("#styleTransferUploadGrid"),
  themeNavAction: document.querySelector("#themeNavAction"),
  themeToggleButton: document.querySelector("#themeToggleButton"),
  themeToggleLabel: document.querySelector("#themeToggleLabel"),
  topbar: document.querySelector(".topbar"),
  topbarRevealButton: document.querySelector("#topbarRevealButton"),
  timelineChannelTabs: document.querySelector("#timelineChannelTabs"),
  timelineList: document.querySelector("#timelineList"),
  timelineNewCount: document.querySelector("#timelineNewCount"),
  timelineNewIndicator: document.querySelector("#timelineNewIndicator"),
  viewPanels: [...document.querySelectorAll("[data-view-panel]")],
  viewTabs: [...document.querySelectorAll("[data-view-tab]")],
  viewRoot: document.querySelector(".view-root"),
  uiLanguageInput: document.querySelector("#uiLanguageInput"),
  uiLanguageOptions: [...document.querySelectorAll("[data-ui-language-option]")],
  previewPanel: document.querySelector(".preview-panel"),
  zoomInButton: document.querySelector("#zoomInButton"),
  zoomLabel: document.querySelector("#zoomLabel"),
  zoomOutButton: document.querySelector("#zoomOutButton"),
  zoomResetButton: document.querySelector("#zoomResetButton"),
};
// One tracker per rail: each strip reveals its own selection independently, and a
// shared tracker would make one rail suppress another's reveal.
const promptFilmstripRevealTracker = createFilmstripRevealTracker();
const imageDecompositionFilmstripRevealTracker = createFilmstripRevealTracker();
const referenceAnalysisFilmstripRevealTracker = createFilmstripRevealTracker();
const assetRecordTimeFilterController = createAssetRecordTimeFilterController({
  pages: {
    article: { countSuffix: "套", getRecords: () => state.articleIllustration.sets, getSearchText: getArticleRecordSearchText, prefix: "articleRecord", renderView: renderArticleRecordView },
    portrait: { countSuffix: "组", getRecords: () => state.portrait.sets, getSearchText: (record) => getPortraitRecordSearchText(record, formatPortraitStyleSummary), prefix: "portraitRecord", renderView: renderPortraitRecordView },
    ppt: { countSuffix: "个", getRecords: () => state.ppt.decks, prefix: "pptRecord", renderView: renderPptRecordView },
  },
});
const lightboxViewerController = createLightboxImageViewer({ refs, state });
const assetWorkspaceController = createAssetWorkspaceController({ refs, state });
const creationCardIdleRippleController = createCreationCardIdleRippleController();
const disabledShakeController = createDisabledShakeController();
const previewKeyboardNavigation = createPreviewKeyboardNavigationController({
  refs,
  state,
  getImageUrl,
  resetLightboxViewer,
  syncLightboxImageMetrics,
  syncLightboxItem,
});
const handlePreviewArrowNavigation = previewKeyboardNavigation.handlePreviewArrowNavigation;
const setReferencePreviewNavigationContext = previewKeyboardNavigation.setReferencePreviewNavigationContext;
const portraitLocationController = createPortraitLocationSelectorController({ refs, state, renderPortraitView });
const configModelPicker = createConfigModelPickerController({ refs, state, getBrowserPrivateConfigRequestPayload, getUiText: getUiLanguageText }); const creationLogoLibrary = createCreationLogoLibraryController({ applyLogoFile: applyCreationLogoFile, refs, setFeedback: setCreationFeedback, showError });
const pptAnalysis = createPptAnalysisController({
  state,
  buildFormData: buildPptFormData,
  compactErrorMessage,
  renderPptView,
});
const portraitReferenceAnalysis = createPortraitReferenceAnalysisController({
  state,
  appendCurrentConfigToFormData,
  buildReferenceFingerprint,
  compactErrorMessage,
  renderPortraitView,
  showError,
});
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
function createInlineBusyMotion(className = "inline-busy-motion") {
  const motion = Object.assign(document.createElement("span"), { className });
  motion.setAttribute("aria-hidden", "true");
  motion.append(document.createElement("span"), document.createElement("span"), document.createElement("span"));
  return motion;
}
function renderInlineBusyButton(button, { busy = false, busyText = "", idleText = "", motionClassName = "inline-busy-motion" } = {}) {
  if (!button) return;
  button.classList.toggle("is-loading", busy);
  button.setAttribute("aria-busy", String(busy));
  if (busy) {
    if (!button.dataset.busyMinWidth) {
      const width = Math.ceil(button.offsetWidth || 0);
      if (width > 0) button.dataset.busyMinWidth = `${width}px`;
    }
    if (button.dataset.busyMinWidth) button.style.minWidth = button.dataset.busyMinWidth;
    button.replaceChildren(busyText, createInlineBusyMotion(motionClassName));
    return;
  }
  delete button.dataset.busyMinWidth;
  button.style.minWidth = "";
  button.replaceChildren(idleText);
}
function buildReferenceFingerprint(file) {
  return `${file.name}:${file.size}:${file.lastModified}`;
}
function makePromptAnalysisImageName(filename) {
  const raw = String(filename || "reference-image").trim();
  const base = raw.replace(/\.[^.]+$/, "") || "reference-image";
  return `${base}-analysis.jpg`;
}
function makeGenerationReferenceImageName(filename) {
  const raw = String(filename || "reference-image").trim();
  const base = raw.replace(/\.[^.]+$/, "") || "reference-image";
  return `${base}-reference.jpg`;
}
async function preparePromptAnalysisImageFile(file) {
  if (
    !file ||
    typeof file !== "object" ||
    !String(file.type || "").startsWith("image/") ||
    Number(file.size || 0) <= PROMPT_ANALYSIS_IMAGE_COMPRESS_THRESHOLD_BYTES
  ) {
    return file;
  }
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxEdge = Math.max(bitmap.width, bitmap.height);
    const scale = Math.min(1, PROMPT_ANALYSIS_IMAGE_MAX_EDGE / maxEdge);
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const context = canvas.getContext("2d");
    if (!context) {
      return file;
    }
    context.imageSmoothingEnabled = true;
    context.imageSmoothingQuality = "high";
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, width, height);
    context.drawImage(bitmap, 0, 0, width, height);
    const blob = await canvasToBlob(
      canvas,
      "image/jpeg",
      PROMPT_ANALYSIS_IMAGE_JPEG_QUALITY,
    );
    if (!blob || blob.size <= 0 || blob.size >= file.size) {
      return file;
    }
    return new File([blob], makePromptAnalysisImageName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  } finally {
    if (bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
}
function getGenerationReferenceImageCompressionProfile({ primarySubject = false } = {}) {
  if (primarySubject) {
    return {
      key: "creation-primary-subject",
      maxEdge: CREATION_PRIMARY_SUBJECT_IMAGE_MAX_EDGE,
      jpegQuality: CREATION_PRIMARY_SUBJECT_IMAGE_JPEG_QUALITY,
      maxBytes: CREATION_PRIMARY_SUBJECT_IMAGE_MAX_BYTES,
      preserveWithinBounds: true,
      thresholdBytes: 0,
    };
  }
  return {
    key: "reference",
    maxEdge: GENERATION_REFERENCE_IMAGE_MAX_EDGE,
    jpegQuality: GENERATION_REFERENCE_IMAGE_JPEG_QUALITY,
    maxBytes: CREATION_PRIMARY_SUBJECT_IMAGE_MAX_BYTES,
    preserveWithinBounds: false,
    thresholdBytes: GENERATION_REFERENCE_IMAGE_COMPRESS_THRESHOLD_BYTES,
  };
}
async function prepareGenerationReferenceImageFile(
  file,
  profile = getGenerationReferenceImageCompressionProfile(),
) {
  if (
    !file ||
    typeof file !== "object" ||
    !String(file.type || "").startsWith("image/") ||
    (profile.thresholdBytes > 0 && Number(file.size || 0) <= profile.thresholdBytes) ||
    typeof createImageBitmap !== "function"
  ) {
    return file;
  }
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file);
    const maxEdge = Math.max(bitmap.width, bitmap.height);
    if (
      profile.preserveWithinBounds &&
      maxEdge <= profile.maxEdge &&
      (!profile.maxBytes || Number(file.size || 0) <= profile.maxBytes)
    ) {
      return file;
    }
    const needsResize = profile.maxEdge > 0 && maxEdge > profile.maxEdge;
    const needsByteLimit = profile.maxBytes > 0 && Number(file.size || 0) > profile.maxBytes;
    let scale = Math.min(1, profile.maxEdge / maxEdge);
    let jpegQuality = profile.jpegQuality;
    let blob = null;
    for (let attempt = 0; attempt < 12; attempt += 1) {
      const width = Math.max(1, Math.round(bitmap.width * scale));
      const height = Math.max(1, Math.round(bitmap.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const context = canvas.getContext("2d");
      if (!context) {
        return file;
      }
      context.imageSmoothingEnabled = true;
      context.imageSmoothingQuality = "high";
      context.fillStyle = "#ffffff";
      context.fillRect(0, 0, width, height);
      context.drawImage(bitmap, 0, 0, width, height);
      blob = await canvasToBlob(canvas, "image/jpeg", jpegQuality);
      if (!blob || blob.size <= 0 || !profile.maxBytes || blob.size <= profile.maxBytes) {
        break;
      }
      const nextScale = scale * Math.max(0.5, Math.min(0.9, Math.sqrt(profile.maxBytes / blob.size) * 0.96));
      if (nextScale < scale) {
        scale = nextScale;
      } else {
        jpegQuality = Math.max(0.7, jpegQuality - 0.05);
      }
    }
    if (
      !blob ||
      blob.size <= 0 ||
      (profile.maxBytes && blob.size > profile.maxBytes) ||
      (blob.size >= file.size && !needsResize && !needsByteLimit)
    ) {
      return file;
    }
    return new File([blob], makeGenerationReferenceImageName(file.name), {
      type: "image/jpeg",
      lastModified: file.lastModified || Date.now(),
    });
  } catch {
    return file;
  } finally {
    if (bitmap && typeof bitmap.close === "function") {
      bitmap.close();
    }
  }
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
function imageElementToBlob(imageElement) {
  if (!imageElement?.complete || !imageElement.naturalWidth || !imageElement.naturalHeight) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const canvas = document.createElement("canvas");
      canvas.width = imageElement.naturalWidth;
      canvas.height = imageElement.naturalHeight;
      const context = canvas.getContext("2d");
      if (!context) {
        resolve(null);
        return;
      }
      context.drawImage(imageElement, 0, 0);
      canvas.toBlob((blob) => resolve(blob?.type?.startsWith("image/") ? blob : null), "image/png");
    } catch (_error) {
      resolve(null);
    }
  });
}
async function resolveDownloadImageBlob(item, imageElement) {
  const elementUrl = imageElement?.currentSrc || imageElement?.src || "";
  const imageUrl = getImageUrl(item) || elementUrl;
  if (isCacheableBrowserImageUrl(imageUrl)) {
    return dataUrlToBlob(imageUrl);
  }
  if (isCacheableBrowserImageUrl(elementUrl)) {
    return dataUrlToBlob(elementUrl);
  }
  if (item?.filename) {
    try {
      const cachedDataUrl = await getBrowserCachedImageData(item.filename);
      if (isCacheableBrowserImageUrl(cachedDataUrl)) {
        return dataUrlToBlob(cachedDataUrl);
      }
    } catch (_error) {
      // Keep download available through the rendered image or server URL when IndexedDB is unavailable.
    }
  }
  if (imageUrl) {
    try {
      const response = await fetch(imageUrl, {
        credentials: "same-origin",
        cache: "force-cache",
      });
      if (response.ok) {
        const blob = await response.blob();
        if (blob.type.startsWith("image/")) {
          return blob;
        }
      }
    } catch (_error) {
      // Fall through to the rendered image fallback.
    }
  }
  const renderedBlob = await imageElementToBlob(imageElement);
  if (renderedBlob) {
    return renderedBlob;
  }
  throw new Error("无法读取当前图片，请刷新页面后重试。");
}
function triggerBrowserImageDownload(blob, filename) {
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "preview.png";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}
async function downloadGalleryItem(item, imageElement) {
  if (!item && !imageElement) {
    return;
  }
  const blob = await resolveDownloadImageBlob(item, imageElement);
  triggerBrowserImageDownload(blob, item.filename || "preview.png");
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
/* 中转地址在入队时就按当前路由解析一次并存进条目，失败路径拿不到 item 也能显示 URL。 */
function resolveGenerationRelayUrl(source = {}) {
  const route = String(source?.imageRoute || source?.generationRoute || getSelectedImageRoute() || "").toLowerCase();
  const routeBaseUrl = route === "c"
    ? source?.protocolBaseUrl || state.config?.protocolBaseUrl
    : route === "b"
      ? source?.directImageBaseUrl || source?.directBaseUrl || state.config?.directImageBaseUrl || state.config?.directBaseUrl
      : source?.baseUrl || state.config?.baseUrl;
  return normalizeGenerationLogRelayUrl(routeBaseUrl || state.config?.baseUrl || "");
}
function buildGenerationActivityRelayUrl(item = {}) { return normalizeGenerationLogRelayUrl(item?.baseUrl || "") || resolveGenerationRelayUrl(item); }
function formatFilmstripSizeLabel(item) {
  return formatCompactSizeLabel(resolveDisplayImageSize(item));
}
function normalizeGenerationTaskStatus(status) {
  return status === "completed" || status === "error" ? status : "running";
}
function normalizeActivityEntry(entry) {
  const key = String(entry?.key || "").trim();
  const title = String(entry?.title || "").trim();
  const detail = sanitizeGenerationActivityDetail(entry?.detail);
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
    modeLabel: String(entry?.modeLabel || "").trim(), imageUrl: String(entry?.imageUrl || "").trim(), relayUrl: normalizeGenerationLogRelayUrl(entry?.relayUrl || entry?.paramsText),
    status: ["active", "done", "error", "pending"].includes(entry?.status) ? entry.status : "active",
    at: String(entry?.at || ""),
    generationStartedAt: String(entry?.generationStartedAt || ""),
    generationCompletedAt: String(entry?.generationCompletedAt || ""),
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
function readGenerationLogStore() {
  try {
    const raw = window.localStorage.getItem(GENERATION_LOG_STORAGE_KEY) || window.localStorage.getItem(GENERATION_ACTIVITY_STORAGE_KEY);
    return parseGenerationLogStore(raw, { normalizeRow: normalizePersistedActivityEntry });
  } catch (_error) {
    return createGenerationLogStore();
  }
}
function writeGenerationLogStore() {
  try {
    window.localStorage.setItem(GENERATION_LOG_STORAGE_KEY, JSON.stringify(serializeGenerationLogStore(state.generationLog)));
  } catch (_error) {
    // Ignore storage quota or privacy-mode failures; the in-memory log still works.
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
function getRatioOrientationLabel(orientation) {
  return RATIO_ORIENTATION_LABELS[orientation] || RATIO_ORIENTATION_LABELS.square;
}
function getUiTextWithReplacements(key, replacements = {}, fallback = "") { let text = getUiLanguageText(key) || fallback; Object.entries(replacements).forEach(([name, value]) => { text = text.replaceAll(`{${name}}`, String(value)); }); return text; }
function getUiRatioOrientationLabel(orientation) { return getUiLanguageText(orientation === "landscape" ? "ratioLandscape" : orientation === "portrait" ? "ratioPortrait" : "ratioSquare") || getRatioOrientationLabel(orientation); }
function getUiRatioLabel(option) { return getUiLanguageText(`ratio.${option?.value}`) || option?.label || getUiRatioOrientationLabel(option?.orientation); }
function getUiSizeLabel(option) { const label = option?.label || ""; if (option?.value === "auto") return getUiLanguageText("sizeAuto") || label; return label.replace(/^最大(?=\s|$)/, getUiLanguageText("sizeMax") || "最大"); }
function getUiPreviewPlaceholderState(placeholderState) { if (!placeholderState || placeholderState.mode === "ready") return placeholderState; if (placeholderState.mode === "idle") return { ...placeholderState, eyebrow: getUiLanguageText("previewIdleEyebrow"), title: getUiLanguageText("previewIdleTitle"), detail: getUiLanguageText("previewIdleDetail") }; return { ...placeholderState, title: state.uiLanguage === "en" ? "Generation running" : placeholderState.title }; }
function rerenderUiLanguageSensitiveViews() { updatePromptCounter(); syncPromptEnhanceMode(); updateGenerateButton(); syncConnectionState(); syncRatioOrientationSummary(); renderRatioGrid(); renderReferenceAnalysisRatioGrid(); renderReasoningOptions(); renderSizeOptions(); renderReferenceAnalysisSizeOptions(); syncEndpointFieldsFromFullUrlModes(); { const c = state.config || {}, s = state.uiLanguage === "en" ? "Saved" : "已保存"; if (refs.savedKeyMask) refs.savedKeyMask.textContent = c.apiKeyConfigured ? `${s} ${c.apiKeyMask || ""}` : getUiLanguageText("notSaved") || "未保存"; if (refs.directSavedKeyMask) refs.directSavedKeyMask.textContent = (c.directImageApiKeyConfigured || c.directApiKeyConfigured) ? `${s} ${c.directImageApiKeyMask || c.directApiKeyMask || ""}` : getUiLanguageText("notSaved") || "未保存"; if (refs.directTextSavedKeyMask) refs.directTextSavedKeyMask.textContent = c.directTextApiKeyConfigured ? `${s} ${c.directTextApiKeyMask || ""}` : getUiLanguageText("notSaved") || "未保存"; if (refs.protocolSavedKeyMask) refs.protocolSavedKeyMask.textContent = c.protocolApiKeyConfigured ? `${s} ${c.protocolApiKeyMask || ""}` : getUiLanguageText("notSaved") || "未保存"; } renderPreview(); renderFilmstrip(); renderTimeline(); }
function syncRatioOrientationSummary() {
  if (!refs.ratioOrientationSummary) {
    return;
  }
  const ratioOption = getRatioOption(refs.ratioInput.value || DEFAULT_UI_RATIO);
  refs.ratioOrientationSummary.textContent = getUiRatioLabel(ratioOption);
  refs.ratioOrientationSummary.dataset.orientation = ratioOption?.orientation || "square";
}
function normalizeUiTheme(theme) { return theme === "light" ? "light" : "dark"; }
function readUiTheme() { try { return normalizeUiTheme(window.localStorage.getItem(THEME_STORAGE_KEY) || document.documentElement.dataset.theme); } catch { return normalizeUiTheme(document.documentElement.dataset.theme); } }
function normalizeUiLanguage(language) { return language === "en" ? "en" : "zh-CN"; }
function readUiLanguage() { try { return normalizeUiLanguage(window.localStorage.getItem(UI_LANGUAGE_STORAGE_KEY) || document.documentElement.lang); } catch { return normalizeUiLanguage(document.documentElement.lang); } }
function getUiLanguageText(key) { return UI_LANGUAGE_TEXT[state.uiLanguage]?.[key] || UI_LANGUAGE_TEXT["zh-CN"][key] || ""; }
function applyUiLanguageText() { document.querySelectorAll("[data-ui-i18n]").forEach((element) => { const text = getUiLanguageText(element.dataset.uiI18n); if (text) element.textContent = text; }); document.querySelectorAll("[data-ui-i18n-aria-label]").forEach((element) => { const text = getUiLanguageText(element.dataset.uiI18nAriaLabel); if (text) element.setAttribute("aria-label", text); }); document.querySelectorAll("[data-ui-i18n-placeholder]").forEach((element) => { const text = getUiLanguageText(element.dataset.uiI18nPlaceholder); if (text) element.setAttribute("placeholder", text); }); document.querySelectorAll("[data-ui-i18n-title]").forEach((element) => { const text = getUiLanguageText(element.dataset.uiI18nTitle); if (text && !element.matches(APP_TOOLTIP_TRIGGER_SELECTOR)) element.setAttribute("title", text); }); document.querySelectorAll("[data-ui-i18n-tooltip]").forEach((element) => { const text = getUiLanguageText(element.dataset.uiI18nTooltip); if (text) element.dataset.tooltip = text; }); }
function getUiImageRouteLabel(imageRoute) { if (imageRoute === "b") return getUiLanguageText("modeDirect"); if (imageRoute === "c") return getUiLanguageText("modeProtocol"); return getUiLanguageText("modeRoute"); }
function getUiImageRouteStatusText(label) { return state.uiLanguage === "en" ? `Current image request mode: ${label}` : `当前生图调用模式：${label}`; }
function syncUiLanguage() { const normalized = normalizeUiLanguage(state.uiLanguage); state.uiLanguage = normalized; document.documentElement.lang = normalized; document.documentElement.dataset.uiLanguage = normalized; if (refs.uiLanguageInput) refs.uiLanguageInput.value = normalized; refs.uiLanguageOptions.forEach((button) => { const isActive = button.dataset.uiLanguageOption === normalized; button.classList.toggle("is-active", isActive); button.setAttribute("aria-pressed", String(isActive)); }); applyUiLanguageText(); configModelPicker.render(); rerenderUiLanguageSensitiveViews(); if (refs.themeNavAction) refs.themeNavAction.textContent = getUiLanguageText("themeMenu"); updateGenerationModeStatus(); syncThemeToggle(); }
function setUiLanguage(language) { state.uiLanguage = normalizeUiLanguage(language); try { window.localStorage.setItem(UI_LANGUAGE_STORAGE_KEY, state.uiLanguage); } catch {} syncUiLanguage(); }
function syncThemeToggle() {
  if (!refs.themeToggleButton || !refs.themeToggleLabel) {
    return;
  }
  const isLight = state.uiTheme === "light";
  refs.themeToggleButton.setAttribute("aria-pressed", String(isLight));
  refs.themeToggleButton.title = getUiLanguageText(isLight ? "themeToDark" : "themeToLight");
  refs.themeToggleLabel.textContent = getUiLanguageText(isLight ? "themeDark" : "themeLight");
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
  if (window.location.hash === "#style-transfer") {
    return "style-transfer";
  }
  if (window.location.hash === "#reference-analysis") {
    return "reference-analysis";
  }
  if (window.location.hash === "#image-decomposition") {
    return "image-decomposition";
  }
  if (window.location.hash === "#image-edit") {
    return "image-edit";
  }
  if (window.location.hash === "#quick-blend") {
    return "quick-blend";
  }
  if (window.location.hash === "#image-compress") {
    return "image-compress";
  }
  if (window.location.hash === "#creation") {
    return "creation";
  }
  if (window.location.hash === "#portrait") {
    return "portrait";
  }
  if (window.location.hash === "#article-illustration") {
    return "article-illustration";
  }
  if (window.location.hash === "#gallery") {
    return "gallery";
  }
  if (window.location.hash === "#article-record") {
    return "article-record";
  }
  if (window.location.hash === "#creation-record") {
    return "creation-record";
  }
  if (window.location.hash === "#portrait-record") {
    return "portrait-record";
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
    view === "portrait" ? "#portrait" : view === "creation" ? "#creation" : view === "style-transfer"
        ? "#style-transfer"
        : view === "reference-analysis"
          ? "#reference-analysis"
          : view === "image-decomposition"
            ? "#image-decomposition"
          : view === "image-edit"
            ? "#image-edit"
          : view === "quick-blend"
            ? "#quick-blend"
          : view === "image-compress"
            ? "#image-compress"
          : view === "article-illustration"
            ? "#article-illustration"
          : view === "gallery"
            ? "#gallery"
            : view === "article-record"
              ? "#article-record"
            : view === "portrait-record"
              ? "#portrait-record"
            : view === "creation-record"
              ? "#creation-record"
              : view === "ppt-record"
                ? "#ppt-record"
                : view === "ppt"
                  ? "#ppt"
                  : "#studio";
  if (window.location.hash !== nextHash) {
    window.history.replaceState(null, "", nextHash);
  }
}
function setStudioGenerationMode(mode = "prompt") {
  const nextMode = mode === "style-transfer" ? "style-transfer" : "prompt";
  state.studioMode = nextMode;
  if (refs.studioView) {
    refs.studioView.dataset.studioMode = nextMode;
  }
  refs.promptModeBlocks.forEach((block) => {
    block.classList.toggle("hidden", nextMode === "style-transfer");
  });
  refs.styleTransferBlock?.classList.toggle("hidden", nextMode !== "style-transfer");
  updateGenerateButton();
}
async function ensureActiveViewModule(view) {
  if (view === "studio") {
    return true;
  }
  try {
    await ensureLazyViewModule(view, {
      context: {
        DEFAULT_QUICK_BLEND_RATIO,
        buildReferenceFingerprint,
        clearError,
        closeReferencePreview,
        compactErrorMessage,
        createGenerationLoadingShell,
        createPreviewLoadingShellNodes,
        createReferenceAddCard,
        formatCanvasLabel,
        formatClock,
        formatFilmstripSizeLabel,
        formatTime,
        getDisplayPrompt,
        getGenerationLoadingItemStage,
        getGenerationReferenceFile,
        getMaxParallelJobCount,
        getMaxQueuedJobCount,
        getQueuedJobCount,
        getRatioOption,
        makeGalleryPreviewKey,
        makeJobPreviewKey,
        nowIso,
        normalizeSizeForSelectedRoute,
        openLightbox,
        prepareGenerationReferenceImageFile,
        recordJobQueued,
        renderAll,
        renderRatioGrid,
        renderers: VIEW_RENDERERS,
        renderSizeOptions,
        resolveGenerationSizeForSelectedRoute,
        revokeReferencePreview,
        scheduleGenerationQueue,
        setActiveView,
        showError,
        state,
        stopGenerationLoadingShell,
        stopGenerationLoadingShells,
        syncReferenceDropzoneCompact,
        setReferencePreviewNavigationContext,
        updatePreviewLoadingShell,
      },
    });
    return true;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    showError(`工作区模块加载失败：${message}`);
    return false;
  }
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
  return `${label}：${[httpStatus ? `HTTP ${httpStatus}` : "", errorCode ? `错误码 ${errorCode}` : "", Number(httpStatus) >= 500 || !errorCode ? "" : (() => { const text = String(raw || "").trim(); const codeMarker = `错误码 ${errorCode}`; let payload = null; if (text.startsWith("{")) { try { payload = JSON.parse(text); } catch {} } const messageText = String(payload?.error?.message || payload?.message || payload?.detail || (text.includes(codeMarker) ? text.slice(text.indexOf(codeMarker) + codeMarker.length).replace(/^[，,：:\s]+/, "") : "")).replace(/\s+/g, " ").trim(); const param = String(payload?.error?.param || payload?.param || "").replace(/\s+/g, " ").trim(); const detail = messageText ? (param ? `${messageText}（参数 ${param}）` : messageText) : param ? `参数 ${param}` : ""; return detail.length > 220 ? `${detail.slice(0, 217)}...` : detail; })()]
    .filter(Boolean)
    .join("，")}`;
}
function showError(message) {
  refs.errorBanner.classList.remove("hidden");
  refs.errorBanner.textContent = compactErrorMessage(message);
}
function clearError() {
  refs.errorBanner.textContent = "";
  refs.errorBanner.classList.add("hidden");
}
const overlayFocusTriggers = new Map();
function captureOverlayTrigger(name) {
  const active = document.activeElement;
  if (active instanceof HTMLElement && document.contains(active)) {
    overlayFocusTriggers.set(name, active);
  }
}
function focusOverlayTarget(target) {
  window.requestAnimationFrame(() => {
    if (target instanceof HTMLElement && document.contains(target)) {
      target.focus({ preventScroll: true });
    }
  });
}
function restoreOverlayTriggerFocus(name) {
  const trigger = overlayFocusTriggers.get(name);
  overlayFocusTriggers.delete(name);
  if (trigger instanceof HTMLElement && document.contains(trigger)) {
    focusOverlayTarget(trigger);
  }
}
function setConnectionState(kind, label, entryLabel = CONNECTION_STATUS_ENTRY_LABEL) {
  refs.connectionStatus.dataset.state = kind;
  refs.connectionStatus.title = label;
  refs.connectionStatus.setAttribute("aria-label", `${entryLabel}, ${getUiLanguageText("connectionOpen")}`);
  refs.connectionLabel.textContent = entryLabel;
}
function syncConnectionState() {
  const queuedCount = getTotalQueuedJobCount();
  const runningCount = getTotalRunningJobCount();
  if (queuedCount > 0 || runningCount > 0) {
    setConnectionState("busy", getUiTextWithReplacements("connectionBusy", { running: runningCount, max: getMaxParallelJobCount(), queued: queuedCount }), getUiLanguageText("connectionStatusEntry"));
    return;
  }
  if (state.config?.apiKeyConfigured) {
    setConnectionState("ready", getUiLanguageText("apiReady") || (state.uiLanguage === "en" ? "API ready" : "API 已就绪"), getUiLanguageText("connectionStatusEntry"));
    return;
  }
  setConnectionState("idle", getUiLanguageText("apiIdle") || (state.uiLanguage === "en" ? "Configure API first" : "请先配置 API"), getUiLanguageText("connectionStatusEmpty") || CONNECTION_STATUS_EMPTY_LABEL);
}
function setDrawerOpen(open) {
  const wasOpen = refs.configDrawer.classList.contains("open");
  refs.configDrawer.classList.toggle("open", open);
  document.documentElement.classList.toggle(TOPBAR_SUPPRESSED_CLASS, open);
  refs.configDrawer.setAttribute("aria-hidden", String(!open));
  if (open) {
    setTopbarReveal(false);
    if (!wasOpen) {
      captureOverlayTrigger("config");
    }
    // The drawer can be opened after a generation already started, so reflect
    // the lock on open instead of only when generation state changes.
    syncGenerationSchedulingLock();
    focusOverlayTarget(refs.closeConfigButton);
  } else {
    restoreOverlayTriggerFocus("config");
  }
}
function openConfigGenerationLog() {
  setDrawerOpen(true);
  window.requestAnimationFrame(() => {
    refs.configGenerationLogPanel?.scrollIntoView({ block: "start", behavior: "smooth" });
  });
}
function setLightboxOpen(open) {
  lightboxViewerController.setOpen(open);
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
function resetLightboxViewer(options) {
  lightboxViewerController.reset(options);
}
function syncLightboxImageMetrics(options) {
  lightboxViewerController.syncMetrics(options);
}
function getStudioViewportMetrics() {
  return {
    width: window.innerWidth,
    height: window.innerHeight,
    visualViewportHeight: window.visualViewport?.height || window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
    outerWidth: window.outerWidth,
    visualScale: window.visualViewport?.scale || 1,
    coarsePointer: window.matchMedia?.("(pointer: coarse)")?.matches || false,
  };
}
function getCurrentStudioLayoutMode() {
  return (
    document.documentElement.dataset.uiLayout ||
    getStudioLayoutMode(getStudioViewportMetrics())
  );
}
function isAdaptiveCompactLayout(layoutMode = getCurrentStudioLayoutMode()) {
  return ADAPTIVE_COLLAPSIBLE_LAYOUTS.has(layoutMode);
}
function getAdaptiveWorkbenchSections() {
  return [...document.querySelectorAll("[data-adaptive-section]")].filter((section) => section.tagName === "DETAILS");
}
function syncAdaptiveWorkbenchSections(layoutMode = getCurrentStudioLayoutMode()) {
  const isCompactLayout = isAdaptiveCompactLayout(layoutMode);
  const layoutChanged = adaptiveSectionLayoutMode !== layoutMode;
  const sections = getAdaptiveWorkbenchSections();
  adaptiveSectionSyncing = true;
  sections.forEach((section) => {
    if (!isCompactLayout) {
      section.open = true;
      section.dataset.adaptiveUserToggled = "false";
      return;
    }
    if (layoutChanged && section.dataset.adaptiveUserToggled !== "true") {
      section.open = section.dataset.compactOpen === "true";
    }
  });
  adaptiveSectionLayoutMode = layoutMode;
  window.setTimeout(() => {
    adaptiveSectionSyncing = false;
  }, 0);
}
function bindAdaptiveWorkbenchSections() {
  getAdaptiveWorkbenchSections().forEach((section) => {
    const summary = section.querySelector("summary");
    summary?.addEventListener("click", (event) => {
      if (!isAdaptiveCompactLayout()) {
        event.preventDefault();
        section.open = true;
      }
    });
    section.addEventListener("toggle", () => {
      if (adaptiveSectionSyncing || !isAdaptiveCompactLayout()) {
        return;
      }
      section.dataset.adaptiveUserToggled = "true";
    });
  });
}
function getGalleryLayoutWidth() {
  return Math.max(
    refs.galleryPanel?.clientWidth || 0,
    refs.galleryView?.clientWidth || 0,
    refs.viewRoot?.clientWidth || 0,
    window.innerWidth || 0,
  );
}
function syncGalleryLayoutMode() { if (!refs.galleryView) return; const layoutMode = getGalleryLayoutModeForWidth(getGalleryLayoutWidth()); const changed = refs.galleryView.dataset.galleryLayout !== layoutMode; refs.galleryView.dataset.galleryLayout = layoutMode; if (changed && state.activeView === "gallery" && !state.galleryLoading) renderGalleryView(); }
function syncStudioDensity() {
  const viewportMetrics = getStudioViewportMetrics();
  const settings = getStudioDensitySettings(viewportMetrics);
  const layoutMode = settings.layoutMode || getStudioLayoutMode(viewportMetrics);
  document.documentElement.dataset.uiDensity = settings.mode;
  document.documentElement.dataset.uiLayout = layoutMode;
  document.documentElement.dataset.uiOrientation = viewportMetrics.width >= viewportMetrics.height ? "landscape" : "portrait";
  document.documentElement.dataset.uiInput = viewportMetrics.coarsePointer ? "coarse" : "fine";
  const visualViewportHeight = Math.max(1, Math.round(viewportMetrics.visualViewportHeight || viewportMetrics.height));
  document.documentElement.style.setProperty("--visual-viewport-height", `${visualViewportHeight}px`);
  syncAdaptiveWorkbenchSections(layoutMode);
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
async function setActiveView(view) {
  state.activeView = view;
  document.querySelector("[data-product-image-extension-menu-entry]").hidden = view !== "creation";
  syncHash(view);
  const activeNavSection = CREATE_VIEW_IDS.has(view) ? "create" : ASSET_VIEW_IDS.has(view) ? "assets" : "";
  const activeTabView = CREATE_VIEW_IDS.has(view) ? "studio" : ASSET_VIEW_IDS.has(view) ? "gallery" : view;
  const activePanelView = view === "style-transfer" ? "studio" : view === "reference-analysis" ? "reference-analysis" : view;
  refs.globalNavItems.forEach((item) => {
    const button = item.querySelector("[data-nav-menu]");
    button?.classList.toggle("active", item.dataset.navSection === activeNavSection);
  });
  refs.viewTabs.forEach((button) => {
    button.classList.toggle("active", button.dataset.viewTab === activeTabView);
  });
  refs.viewPanels.forEach((panel) => {
    panel.classList.toggle("hidden", panel.dataset.viewPanel !== activePanelView);
  });
  const moduleReady = await ensureActiveViewModule(view);
  if (!moduleReady || state.activeView !== view) {
    return false;
  }
  if (view === "studio" || view === "style-transfer") {
    setStudioGenerationMode(view === "style-transfer" ? "style-transfer" : "prompt");
  }
  if (view === "creation") {
    ensureCreationCategoryTemplatesReady({ render: true });
  }
  if (view === "creation-record") {
    refreshCreationRecordSets();
  }
  if (view === "article-record") loadArticleIllustrationSets().catch((error) => setArticleRecordFeedback(error.message, "error"));
  if (view === "portrait-record") {
    loadPortraitSets().catch((error) => setPortraitRecordFeedback(error.message, "error"));
  }
  if (view === "ppt-record") loadPptDecks().catch((error) => showError(error.message));
  renderActiveView();
  syncGalleryLayoutMode();
  scheduleStudioHeightSync();
  scheduleGalleryPanelHeightSync();
  scheduleGalleryScrollSync();
  return true;
}
function updatePromptCounter() {
  refs.promptCounter.textContent = `${refs.promptInput.value.length} ${getUiLanguageText("promptCounterSuffix") || "字"}`;
}
function clearPromptInput() {
  refs.promptInput.value = "";
  updatePromptCounter();
  updateGenerateButton();
  refs.promptInput.focus();
}
function getMaxQueuedJobCount(mode = getCurrentGenerationQueueMode()) {
  return mode === "prompt" ? MAX_PROMPT_QUEUE_SIZE : Number.POSITIVE_INFINITY;
}
function getMaxParallelJobCount(mode = getCurrentGenerationQueueMode()) {
  return mode === "prompt" ? MAX_PROMPT_PARALLEL_TASKS : state.limits.maxParallelTasksPerSession || DEFAULT_LIMITS.maxParallelTasksPerSession;
}
function getMaxParallelJobCountForJob(job) {
  return getMaxParallelJobCount(getGenerationJobMode(job));
}
// The creation queue reserves item slots against the same configurable request
// concurrency the server fans out with. Reading a hardcoded limit here let the
// browser start a second suite the server had no slots for, so a lowered
// concurrency never bound how much work was in flight across suites.
function getCreationMaxParallelTaskCount() {
  return getConfiguredGenerationConcurrency();
}
function getGenerationJobSchedulingKey(job) {
  return getGenerationJobMode(job) === "prompt" ? "prompt" : getGenerationJobQueueKey(job);
}
function getCurrentGenerationQueueMode() { return ["style-transfer", "reference-analysis", "image-decomposition", "image-edit", "quick-blend"].includes(state.activeView) ? state.activeView : state.activeView === "studio" && state.studioMode === "style-transfer" ? "style-transfer" : "prompt"; }
function getCurrentGenerationQueueRoute() { return getSelectedImageRoute(); }
function getQueuedJobCount(mode = getCurrentGenerationQueueMode(), route = getCurrentGenerationQueueRoute()) { return getQueuedGenerationJobCount(state.jobs, mode, route); }
function getRunningJobCount(mode = getCurrentGenerationQueueMode(), route = getCurrentGenerationQueueRoute()) { return getRunningGenerationJobCount(state.jobs, mode, route); }
function getCurrentGenerationQueueSize(mode = getCurrentGenerationQueueMode(), route = getCurrentGenerationQueueRoute()) { return getQueuedJobCount(mode, mode === "prompt" ? "" : route) + getRunningJobCount(mode, mode === "prompt" ? "" : route); }
function hasReachedGenerationQueueLimit(mode = getCurrentGenerationQueueMode(), route = getCurrentGenerationQueueRoute()) { const limit = getMaxQueuedJobCount(mode); return Number.isFinite(limit) && getCurrentGenerationQueueSize(mode, route) >= limit; }
function getTotalQueuedJobCount() { return getQueuedGenerationJobCount(state.jobs); }
function getTotalRunningJobCount() { return getRunningGenerationJobCount(state.jobs); }
function getCreationMaxReferenceImageCount() { return state.limits.maxCreationReferenceImages || DEFAULT_LIMITS.maxCreationReferenceImages || state.limits.maxReferenceImages || DEFAULT_LIMITS.maxReferenceImages; }
function getCreationMaxProductReferenceImageCount() { return getCreationMaxReferenceImageCount(); }
function getPortraitPersonMaxReferenceImageCount() {
  return (
    state.limits.maxPortraitPersonReferenceImages ||
    DEFAULT_LIMITS.maxPortraitPersonReferenceImages ||
    state.limits.maxReferenceImages ||
    DEFAULT_LIMITS.maxReferenceImages
  );
}
function getPortraitAccessoryMaxReferenceImageCount() {
  return (
    state.limits.maxPortraitAccessoryReferenceImages ||
    DEFAULT_LIMITS.maxPortraitAccessoryReferenceImages ||
    getCreationMaxReferenceImageCount()
  );
}
function getPortraitActionMaxReferenceImageCount() {
  return (
    state.limits.maxPortraitActionReferenceImages ||
    DEFAULT_LIMITS.maxPortraitActionReferenceImages ||
    getPortraitPersonMaxReferenceImageCount()
  );
}
function updateGenerateButton() {
  const runningCount = getRunningJobCount();
  const queuedCount = getQueuedJobCount();
  const maxParallelCount = getMaxParallelJobCount();
  const preparingReference =
    state.referenceCompressionRunning ||
    hasPendingReferenceGenerationFiles() ||
    hasPendingStyleTransferGenerationFiles();
  refs.generateButton.disabled = preparingReference;
  const idleLabel = state.studioMode === "style-transfer" ? getUiLanguageText("menuStyleTransfer") || "风格迁移" : getUiLanguageText("generate") || "开始生成";
  refs.generateButton.textContent = preparingReference ? state.uiLanguage === "en" ? "Processing references..." : "处理参考图..." : queuedCount > 0 ? state.uiLanguage === "en" ? `Queue ${queuedCount}` : `队列 ${queuedCount}` : idleLabel;
  refs.liveCount.textContent = `${runningCount} / ${maxParallelCount}`;
  syncGenerationSchedulingLock();
}

// True while any panel could still launch a generation request. Queued prompt
// jobs count: they read the scheduling parameters at launch, so letting the
// values change mid-queue would split one batch across two schedules.
function hasPendingGenerationWork() {
  return (
    getTotalRunningJobCount() > 0
    || getTotalQueuedJobCount() > 0
    || Boolean(state.creation?.generating)
    || Boolean(state.portrait?.generating)
    || Boolean(state.articleIllustration?.generating)
    || Boolean(state.articleIllustration?.referenceGenerating)
    || Boolean(state.ppt?.generating)
  );
}

// Locking reverts the controls to the saved values so an edit typed just before
// a generation started cannot be written by a later save.
function syncGenerationSchedulingLock() {
  const locked = hasPendingGenerationWork();
  const inputs = [refs.generationConcurrencyInput, refs.generationStartDelayInput].filter(Boolean);
  const becameLocked = locked && inputs.some((input) => !input.disabled);

  inputs.forEach((input) => {
    input.disabled = locked;
  });
  refs.generationSchedulingLockNote?.classList.toggle("hidden", !locked);

  if (becameLocked && state.config) {
    if (refs.generationConcurrencyInput) {
      refs.generationConcurrencyInput.value = String(
        normalizeGenerationConcurrency(state.config.defaults?.[GENERATION_CONCURRENCY_FIELD], DEFAULT_GENERATION_CONCURRENCY),
      );
    }
    if (refs.generationStartDelayInput) {
      refs.generationStartDelayInput.value = String(
        normalizeGenerationStartDelayMs(state.config.defaults?.[GENERATION_START_DELAY_FIELD], DEFAULT_GENERATION_START_DELAY_MS),
      );
    }
  }
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
function setPromptAgentOpen(open, { restoreFocus = true } = {}) {
  const wasOpen = !refs.promptAgentModal.classList.contains("hidden");
  refs.promptAgentModal.classList.toggle("hidden", !open);
  refs.promptAgentModal.setAttribute("aria-hidden", String(!open));
  if (open) {
    if (!wasOpen) {
      captureOverlayTrigger("prompt-agent");
    }
    renderPromptAgent();
    loadPromptAgentHistory({ force: true }).catch((error) => setPromptAgentFeedback(error.message, "error"));
    focusOverlayTarget(refs.promptAgentCloseButton);
  } else if (restoreFocus) {
    restoreOverlayTriggerFocus("prompt-agent");
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
  return String(item?.json?.prompt || item?.json?.prompts?.[0]?.prompt || "").trim();
}
function getPromptAgentJsonText(item = state.promptAgent.result) {
  if (!item?.json) {
    return "";
  }
  return JSON.stringify(item.json, null, 2);
}
function getPromptAgentReusableText(item) {
  if (isStructuredImagePromptJson(item?.json)) {
    return getPromptAgentJsonText(item);
  }
  return getPromptAgentPrompt(item) || getPromptAgentJsonText(item);
}
function getPromptAgentTemplateId(item) {
  const rawId = String(item?.id || item?.createdAt || item?.filename || "latest").trim();
  const safeId = rawId.replace(/[^a-zA-Z0-9_-]/g, "-") || "latest";
  return `prompt-agent-${safeId}`;
}
function savePromptAgentResultAsTemplate(item) {
  const prompt = getPromptAgentReusableText(item);
  if (!prompt) {
    return;
  }

  const nextTemplates = mergePromptAgentHistoryTemplates({
    history: [item],
    templates: state.promptTemplates,
    getTemplateId: getPromptAgentTemplateId,
    getPrompt: getPromptAgentReusableText,
    getName: getPromptAgentDisplayName,
    skipItem: (historyItem) => state.promptTemplateDismissedHistoryIds.has(getPromptAgentTemplateId(historyItem)),
  });
  const template = nextTemplates.find((entry) => entry.id === getPromptAgentTemplateId(item));
  if (!template) {
    return;
  }

  const changed = nextTemplates.length !== state.promptTemplates.length;
  state.promptTemplates = nextTemplates;
  state.selectedPromptTemplateId = template.id;
  if (changed) {
    writePromptTemplates();
  }
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
  titleButton.textContent = getPromptAgentDisplayName(item);
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
  promptText.textContent = getPromptAgentReusableText(item) || "未返回可复用结果";
  const meta = document.createElement("div");
  meta.className = "prompt-agent-history-meta";
  const tags = Array.isArray(item.json?.style_tags) ? item.json.style_tags.slice(0, 4).join(" / ") : "";
  meta.textContent = [item.filename, item.json?.framing?.aspect_ratio || item.json?.aspect_ratio, tags]
    .filter(Boolean)
    .join(" · ");
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
  renderInlineBusyButton(refs.promptAgentAnalyzeButton, {
    busy: state.promptAgent.running,
    busyText: "分析中",
    idleText: "分析图片",
  });
  const resultText = getPromptAgentReusableText(state.promptAgent.result);
  refs.copyPromptAgentJsonButton.disabled = !resultText;
  refs.promptAgentResult.value = resultText;
  renderPromptAgentHistory();
}
function revokeReferencePreview(item) {
  if (item?.previewUrl) {
    URL.revokeObjectURL(item.previewUrl);
  }
}
function getGenerationReferenceFile(item) {
  return item?.generationFile || item?.file;
}
function isCreationPrimarySubjectReference(item, referenceFiles = state.creationReferenceFiles) {
  const items = Array.isArray(referenceFiles) ? referenceFiles.filter(Boolean) : [];
  const primary =
    items.find((entry) => entry?.role === "reference-product") ||
    items.find((entry) => isCreationSubjectReferenceRole(entry?.role || "product")) ||
    items[0] ||
    null;
  return Boolean(
    primary &&
      (primary === item || (primary.id && item?.id && primary.id === item.id)),
  );
}
function getCreationReferenceGenerationCompressionProfile(
  item,
  referenceFiles = state.creationReferenceFiles,
) {
  return getGenerationReferenceImageCompressionProfile({
    primarySubject: isCreationPrimarySubjectReference(item, referenceFiles),
  });
}
function syncCreationReferenceGenerationCompressionProfiles() {
  state.creationReferenceFiles.forEach((item) => {
    const profile = getCreationReferenceGenerationCompressionProfile(item);
    if (item.generationCompressionProfile !== profile.key) {
      startCreationReferenceGenerationCompression(item, profile);
    }
  });
}
function getCreationReferenceGenerationFile(item) {
  return item?.generationFile || item?.file;
}
function getCreationLogoBatchSourceGenerationFile(item) {
  return item?.generationFile || item?.file || null;
}
function normalizeCreationLogoPlacement(value) {
  return CREATION_LOGO_PLACEMENTS.has(String(value || "")) ? String(value) : "top-left";
}
function normalizeCreationLogoBackground(value) {
  return CREATION_LOGO_BACKGROUNDS.has(String(value || "")) ? String(value) : "transparent";
}
function normalizeCreationLogoPayload(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  const filename = String(source.filename || source.name || source.logoFilename || "").trim();
  if (!filename) {
    return null;
  }
  const placement = normalizeCreationLogoPlacement(source.placement || source.logoPlacement);
  const background = normalizeCreationLogoBackground(source.background || source.backgroundMode || source.logoBackground);
  return {
    enabled: true,
    filename,
    placement,
    placementLabel: CREATION_LOGO_PLACEMENT_LABELS[placement] || placement,
    background,
    backgroundLabel: CREATION_LOGO_BACKGROUND_LABELS[background] || background,
  };
}
function getCreationLogoGenerationFile() {
  return state.creationLogo?.generationFile || state.creationLogo?.file || null;
}
function getReferenceAnalysisGenerationFile(item) {
  return item?.generationFile || item?.file;
}
function getImageDecompositionGenerationFile(item = state.imageDecomposition.file) {
  return item?.generationFile || item?.file;
}
function hasPendingReferenceGenerationFiles() {
  return state.referenceFiles.some((item) => item.generationFilePromise);
}
function hasPendingCreationReferenceGenerationFiles() {
  return state.creationReferenceFiles.some((item) => item.generationFilePromise);
}
function hasPendingCreationLogoGenerationFile() {
  return Boolean(state.creationLogo?.generationFilePromise);
}
function hasPendingCreationLogoBatchGenerationFiles() {
  return state.creationLogoBatchFiles.some((item) => item.generationFilePromise);
}
function hasPendingCreationBranchGenerationFiles() {
  return isCreationLogoBatchBranch()
    ? hasPendingCreationLogoBatchGenerationFiles() || hasPendingCreationLogoGenerationFile()
    : hasPendingCreationReferenceGenerationFiles();
}
function hasPendingReferenceAnalysisGenerationFiles() {
  return state.referenceAnalysis.files.some((item) => item.generationFilePromise);
}
function hasPendingImageDecompositionGenerationFiles() {
  return Boolean(state.imageDecomposition.file?.generationFilePromise);
}
function startReferenceGenerationCompression(item) {
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
      updateGenerateButton();
    });
  updateGenerateButton();
  return item.generationFilePromise;
}
function startReferenceAnalysisGenerationCompression(item) {
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
      renderReferenceAnalysisGrid();
      renderReferenceAnalysis();
    });
  renderReferenceAnalysisGrid();
  renderReferenceAnalysis();
  return item.generationFilePromise;
}
function startImageDecompositionGenerationCompression(item) {
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
      renderImageDecompositionView();
    });
  renderImageDecompositionView();
  return item.generationFilePromise;
}
function getStyleTransferReferenceItem(slot) {
  return slot === "style" ? state.styleTransfer.style : state.styleTransfer.source;
}
function getStyleTransferGenerationFile(slot) {
  return getGenerationReferenceFile(getStyleTransferReferenceItem(slot));
}
function hasPendingStyleTransferGenerationFiles() {
  return Boolean(state.styleTransfer.source?.generationFilePromise || state.styleTransfer.style?.generationFilePromise);
}
function startStyleTransferGenerationCompression(item) {
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
      renderStyleTransferReferences();
      updateGenerateButton();
    });
  renderStyleTransferReferences();
  updateGenerateButton();
  return item.generationFilePromise;
}
function updateCreationReferenceGenerationCompressionState(referenceId, revision, profileKey, patch = {}) {
  let updated = false;
  const next = state.creationReferenceFiles.map((entry) => {
    if (
      entry.id !== referenceId ||
      entry.generationCompressionRevision !== revision ||
      entry.generationCompressionProfile !== profileKey
    ) {
      return entry;
    }
    updated = true;
    return { ...entry, ...patch };
  });
  if (updated) {
    state.creationReferenceFiles = next;
  }
  return updated;
}
function startCreationReferenceGenerationCompression(
  item,
  profile = getCreationReferenceGenerationCompressionProfile(item),
) {
  if (!item?.file || !item.id) {
    return null;
  }
  const referenceId = item.id;
  const sourceFile = item.file;
  const revision = Number(item.generationCompressionRevision || 0) + 1;
  const profileKey = profile.key;
  const updateCurrentItem = (patch) =>
    updateCreationReferenceGenerationCompressionState(referenceId, revision, profileKey, patch);
  let generationFilePromise = prepareGenerationReferenceImageFile(sourceFile, profile)
    .then((preparedFile) => {
      const generationFile = preparedFile || sourceFile;
      updateCurrentItem({
        generationFile,
        generationCompressed: Boolean(preparedFile && preparedFile !== sourceFile),
      });
      return generationFile;
    })
    .catch(() => {
      updateCurrentItem({ generationFile: sourceFile, generationCompressed: false });
      return sourceFile;
    });
  generationFilePromise = generationFilePromise.finally(() => {
    updateCurrentItem({ generationFilePromise: null });
    renderCreationView();
  });

  const initialState = {
    generationFile: sourceFile,
    generationCompressed: false,
    generationCompressionProfile: profileKey,
    generationCompressionRevision: revision,
    generationFilePromise,
  };
  Object.assign(item, initialState);
  state.creationReferenceFiles = state.creationReferenceFiles.map((entry) =>
    entry.id === referenceId ? { ...entry, ...initialState } : entry,
  );
  renderCreationView();
  return generationFilePromise;
}
function startCreationLogoGenerationCompression(item = state.creationLogo) {
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
      renderCreationView();
    });
  renderCreationView();
  return item.generationFilePromise;
}
function startCreationLogoBatchGenerationCompression(item) {
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
      renderCreationLogoBatchSourceGrid();
      renderCreationView();
    });
  renderCreationLogoBatchSourceGrid();
  renderCreationView();
  return item.generationFilePromise;
}
async function ensureStyleTransferGenerationFilesReady() {
  const pending = [state.styleTransfer.source?.generationFilePromise, state.styleTransfer.style?.generationFilePromise].filter(
    Boolean,
  );
  if (pending.length === 0) {
    return;
  }
  try {
    await Promise.allSettled(pending);
  } finally {
    renderStyleTransferReferences();
  }
}
async function ensureReferenceGenerationFilesReady() {
  const pending = state.referenceFiles.map((item) => item.generationFilePromise).filter(Boolean);
  if (pending.length === 0) {
    return;
  }
  state.referenceCompressionRunning = true;
  updateGenerateButton();
  try {
    await Promise.allSettled(pending);
  } finally {
    state.referenceCompressionRunning = false;
    updateGenerateButton();
  }
}
async function ensureCreationReferenceGenerationFilesReady() {
  try {
    for (;;) {
      // Role changes, reordering, and restored bindings can start a newer compression task
      // while the previous snapshot is still settling. Re-sync after every batch so the
      // generation request never captures a stale uncompressed subject.
      syncCreationReferenceGenerationCompressionProfiles();
      const pending = state.creationReferenceFiles.map((item) => item.generationFilePromise).filter(Boolean);
      if (pending.length === 0) {
        break;
      }
      await Promise.allSettled(pending);
    }
  } finally {
    renderCreationView();
  }
}
async function ensureCreationLogoBatchGenerationFilesReady() {
  const pending = [
    ...state.creationLogoBatchFiles.map((item) => item.generationFilePromise),
    state.creationLogo?.generationFilePromise,
  ].filter(Boolean);
  if (pending.length === 0) {
    return;
  }
  try {
    await Promise.allSettled(pending);
  } finally {
    renderCreationView();
  }
}
async function ensureReferenceAnalysisGenerationFilesReady() {
  const pending = state.referenceAnalysis.files.map((item) => item.generationFilePromise).filter(Boolean);
  if (pending.length === 0) {
    return;
  }
  try {
    await Promise.allSettled(pending);
  } finally {
    renderReferenceAnalysisGrid();
    renderReferenceAnalysis();
  }
}
async function ensureImageDecompositionGenerationFilesReady() {
  const pending = [state.imageDecomposition.file?.generationFilePromise].filter(Boolean);
  if (pending.length === 0) {
    return;
  }
  try {
    await Promise.allSettled(pending);
  } finally {
    renderImageDecompositionView();
  }
}
function isPromptReferenceWorkflow() {
  return state.activeView === "studio" && state.studioMode === "prompt";
}
function getPreviewReferenceDragKey(dataTransfer) {
  const key = String(dataTransfer?.getData?.(PREVIEW_REFERENCE_DRAG_MIME) || "").trim();
  return key && key === state.selectedPreviewKey ? key : "";
}
function getPreviewReferenceFilename(item, blob) {
  const rawName = String(item?.filename || "")
    .split(/[\\/]/)
    .pop()
    ?.trim();
  if (rawName && /\.[a-z\d]{2,8}$/i.test(rawName)) {
    return rawName;
  }
  const extension = String(blob?.type || "image/png").split("/")[1]?.replace(/[^a-z\d]/gi, "") || "png";
  return `${rawName || "preview"}.${extension}`;
}
function getStablePreviewFileTimestamp(item) {
  const source = String(item?.id || item?.filename || "preview");
  let hash = 0;
  for (const character of source) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return hash || 1;
}
async function addCurrentPreviewToReferences(previewKey = state.selectedPreviewKey) {
  if (!isPromptReferenceWorkflow() || !previewKey || previewKey !== state.selectedPreviewKey) {
    return;
  }
  const item = getCurrentPreviewItem();
  if (!item || !getImageUrl(item)) {
    showError("当前没有可添加的图片。");
    return;
  }
  try {
    const blob = await resolveDownloadImageBlob(item, refs.previewImage);
    if (!blob?.type?.startsWith("image/")) {
      throw new Error("当前预览不是有效图片。");
    }
    if (!isPromptReferenceWorkflow() || previewKey !== state.selectedPreviewKey) {
      return;
    }
    const file = new File([blob], getPreviewReferenceFilename(item, blob), {
      type: blob.type,
      lastModified: getStablePreviewFileTimestamp(item),
    });
    applyReferenceFiles([file], { feedback: true });
  } catch (error) {
    showError(error instanceof Error ? error.message : "无法读取当前图片，请刷新页面后重试。");
  }
}
function handleReferenceDrop(event) {
  event.preventDefault();
  refs.referenceDropzone.classList.remove("dragover");
  refs.referenceGrid.classList.remove("dragover");
  const previewKey = getPreviewReferenceDragKey(event.dataTransfer);
  if (previewKey) {
    void addCurrentPreviewToReferences(previewKey);
    return;
  }
  applyReferenceFiles(event.dataTransfer?.files);
}
function resetReferenceFiles() {
  closeReferencePreview();
  state.referenceFiles.forEach(revokeReferencePreview);
  state.referenceFiles = [];
  refs.referenceInput.value = "";
  renderReferenceGrid();
  updateGenerateButton();
}
function openReferencePreview(referenceId) {
  const item = state.referenceFiles.find((entry) => entry.id === referenceId);
  if (!item?.previewUrl) {
    return;
  }
  state.referencePreviewItem = item;
  setReferencePreviewNavigationContext({ items: state.referenceFiles, currentId: item.id });
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}
function closeReferencePreview() {
  state.referencePreviewItem = null;
  state.creationReferencePreviewItem = null;
  state.referenceAnalysisPreviewItem = null;
  state.imageDecompositionPreviewItem = null;
  state.imageEditPreviewItem = null;
  state.quickBlendPreviewItem = null;
  state.referencePreviewNavigation = { items: [], index: -1 };
  state.styleTransferPreviewItem = null;
  refs.referencePreviewViewer.classList.remove("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "true");
  refs.referencePreviewImage.removeAttribute("src");
}
function removeReferenceFile(referenceId) {
  const target = state.referenceFiles.find((item) => item.id === referenceId);
  if (state.referencePreviewItem?.id === referenceId) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.referenceFiles = state.referenceFiles.filter((item) => item.id !== referenceId);
  renderReferenceGrid();
  updateGenerateButton();
}
function applyReferenceFiles(fileList, { feedback = false } = {}) {
  const allFiles = [...(fileList || [])];
  const incomingFiles = allFiles.filter((file) => file.type.startsWith("image/"));
  const result = { addedCount: 0, duplicateCount: 0, invalidCount: allFiles.length - incomingFiles.length, overflowed: false };
  if (incomingFiles.length === 0) {
    if (feedback && result.invalidCount > 0) {
      showError("当前预览不是有效图片。");
    }
    return result;
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
      result.duplicateCount += 1;
      continue;
    }
    const referenceItem = {
      id: `ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint,
      file,
      generationFile: file,
      generationFilePromise: null,
      generationCompressed: false,
      previewUrl: URL.createObjectURL(file),
    };
    startReferenceGenerationCompression(referenceItem);
    next.push(referenceItem);
    fingerprints.add(fingerprint);
    result.addedCount += 1;
  }
  result.overflowed = overflowed;
  state.referenceFiles = next;
  refs.referenceInput.value = "";
  renderReferenceGrid();
  updateGenerateButton();
  if (overflowed) {
    showError(`参考图最多支持 ${state.limits.maxReferenceImages} 张。`);
  } else if (feedback && result.duplicateCount > 0 && result.addedCount === 0) {
    showError("这张图片已经在参考图中。");
  } else if (feedback && result.duplicateCount > 0) {
    showError(`已添加 ${result.addedCount} 张，${result.duplicateCount} 张重复图片未添加。`);
  }
  return result;
}
function createReferenceAnalysisItem(file) {
  return {
    id: `reference-analysis-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fingerprint: buildReferenceFingerprint(file),
    file,
    generationFile: file,
    generationFilePromise: null,
    generationCompressed: false,
    previewUrl: URL.createObjectURL(file),
  };
}
function applyReferenceAnalysisFiles(fileList) {
  invalidateReferenceAnalysisRequest();
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return;
  }
  const next = [...state.referenceAnalysis.files];
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
    const referenceItem = createReferenceAnalysisItem(file);
    startReferenceAnalysisGenerationCompression(referenceItem);
    next.push(referenceItem);
    fingerprints.add(fingerprint);
  }
  state.referenceAnalysis.files = next;
  refs.referenceAnalysisInput.value = "";
  markReferenceAnalysisDirty();
  renderReferenceAnalysisGrid();
  renderReferenceAnalysis();
  if (overflowed) {
    setReferenceAnalysisFeedback(`融图分析最多支持 ${state.limits.maxReferenceImages} 张图片。`, "error");
  }
}
function removeReferenceAnalysisFile(referenceId) {
  invalidateReferenceAnalysisRequest();
  const target = state.referenceAnalysis.files.find((item) => item.id === referenceId);
  if (state.referenceAnalysisPreviewItem?.id === referenceId) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.referenceAnalysis.files = state.referenceAnalysis.files.filter((item) => item.id !== referenceId);
  markReferenceAnalysisDirty();
  renderReferenceAnalysisGrid();
  renderReferenceAnalysis();
}
function getQuickBlendController() {
  return getMountedLazyViewModule("quick-blend");
}
function renderQuickBlendView() {
  return getQuickBlendController()?.renderQuickBlendView?.() || false;
}
function setQuickBlendFeedback(message = "", kind = "") {
  state.quickBlend.feedback = message;
  state.quickBlend.feedbackKind = kind;
  getQuickBlendController()?.setQuickBlendFeedback?.(message, kind);
}
function storeQuickBlendGenerationItem(item) {
  const controller = getQuickBlendController();
  if (controller?.storeQuickBlendGenerationItem) {
    return controller.storeQuickBlendGenerationItem(item);
  }
  const filename = String(item?.filename || "").trim();
  if (!filename) {
    return "";
  }
  const key = makeGalleryPreviewKey(filename);
  state.quickBlend.generationItems[key] = {
    ...(state.quickBlend.generationItems[key] || {}),
    ...item,
    mode: "quick-blend",
    assetKind: item.assetKind || "quick-blend",
  };
  return key;
}
function replaceQuickBlendGenerationKey(oldKey, newKey) {
  const controller = getQuickBlendController();
  if (controller?.replaceQuickBlendGenerationKey) {
    controller.replaceQuickBlendGenerationKey(oldKey, newKey);
    return;
  }
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
  state.quickBlend.generationKeys = [...keys.filter((entry) => entry !== currentKey), nextKey];
}
function removeQuickBlendGenerationKey(key) {
  const controller = getQuickBlendController();
  if (controller?.removeQuickBlendGenerationKey) {
    controller.removeQuickBlendGenerationKey(key);
    return;
  }
  const targetKey = String(key || "").trim();
  if (!targetKey) {
    return;
  }
  state.quickBlend.generationKeys = state.quickBlend.generationKeys.filter((entry) => entry !== targetKey);
  if (state.quickBlend.previewKey === targetKey) {
    state.quickBlend.previewKey = "";
  }
}
async function preserveQuickBlendGenerationItemForDelete(item) {
  const controller = getQuickBlendController();
  if (controller?.preserveQuickBlendGenerationItemForDelete) {
    await controller.preserveQuickBlendGenerationItemForDelete(item);
    return;
  }
  if (!item?.filename) {
    return;
  }
  const key = makeGalleryPreviewKey(item.filename);
  const tracked =
    item.mode === "quick-blend" ||
    item.generationMode === "quick-blend" ||
    item.assetKind === "quick-blend" ||
    state.quickBlend.generationKeys.includes(key) ||
    Boolean(state.quickBlend.generationItems[key]);
  if (!tracked) {
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
      storeQuickBlendGenerationItem({ ...item, imageUrl: dataUrl, thumbnailUrl: dataUrl });
      return;
    }
  } catch (_error) {
    // Keep existing metadata if the image cannot be copied before deletion.
  }
  storeQuickBlendGenerationItem(item);
}
const {
  preserveImageEditGenerationItemForDelete,
  removeImageEditGenerationKey,
  renderImageEditView,
  replaceImageEditGenerationKey,
  setImageEditFeedback,
  storeImageEditGenerationItem,
} = createImageEditShellBridge({
  getMountedLazyViewModule,
  state,
  makeGalleryPreviewKey,
});
function createImageDecompositionItem(file) {
  return {
    id: `image-decomposition-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    fingerprint: buildReferenceFingerprint(file),
    file,
    generationFile: file,
    generationFilePromise: null,
    generationCompressed: false,
    previewUrl: URL.createObjectURL(file),
  };
}
function setImageDecompositionFeedback(message = "", kind = "") {
  refs.imageDecompositionFeedback.textContent = message ? compactErrorMessage(message, "图片拆解失败") : "";
  refs.imageDecompositionFeedback.dataset.state = kind;
}
function getImageDecompositionGenerationItemByKey(key) {
  if (String(key || "").startsWith("job:")) {
    return state.jobs.find((job) => job.id === String(key).slice(4) && job.mode === "image-decomposition") || null;
  }
  if (String(key || "").startsWith("file:")) {
    return state.imageDecomposition.generationItems[key] || state.gallery.find((item) => item.filename === String(key).slice(5)) || null;
  }
  return null;
}
function storeImageDecompositionGenerationItem(item) {
  const filename = String(item?.filename || "").trim();
  if (!filename) {
    return "";
  }
  const key = makeGalleryPreviewKey(filename);
  const current = state.imageDecomposition.generationItems[key] || {};
  state.imageDecomposition.generationItems[key] = {
    ...current,
    ...item,
    mode: "image-decomposition",
  };
  return key;
}
function registerImageDecompositionGenerationKey(key) {
  const nextKey = String(key || "").trim();
  if (!nextKey) {
    return;
  }
  state.imageDecomposition.generationKeys = [
    nextKey,
    ...state.imageDecomposition.generationKeys.filter((entry) => entry !== nextKey),
  ];
}
function replaceImageDecompositionGenerationKey(oldKey, newKey) {
  const currentKey = String(oldKey || "").trim();
  const nextKey = String(newKey || "").trim();
  if (!nextKey) {
    return;
  }
  const keys = state.imageDecomposition.generationKeys.filter((entry) => entry !== nextKey && entry !== currentKey);
  state.imageDecomposition.generationKeys = [nextKey, ...keys];
}
function removeImageDecompositionGenerationKey(key) {
  const targetKey = String(key || "").trim();
  if (!targetKey) {
    return;
  }
  state.imageDecomposition.generationKeys = state.imageDecomposition.generationKeys.filter((entry) => entry !== targetKey);
  if (state.imageDecomposition.previewKey === targetKey) {
    state.imageDecomposition.previewKey = "";
  }
}
function getImageDecompositionGenerationPreviewEntries() {
  const entries = [];
  const seen = new Set();
  const addKey = (key) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || seen.has(normalizedKey)) {
      return;
    }
    const item = getImageDecompositionGenerationItemByKey(normalizedKey);
    if (!item) {
      return;
    }
    seen.add(normalizedKey);
    entries.push({ key: normalizedKey, item });
  };
  state.imageDecomposition.generationKeys.forEach(addKey);
  sortGalleryItemsByCreatedAtDesc(state.jobs)
    .filter((job) => job.mode === "image-decomposition")
    .forEach((job) => addKey(makeJobPreviewKey(job.id)));
  sortGalleryItemsByCreatedAtDesc(state.gallery)
    .filter(
      (item) =>
        item.mode === "image-decomposition" ||
        item.generationMode === "image-decomposition" ||
        item.assetKind === "image-decomposition",
    )
    .forEach((item) => addKey(makeGalleryPreviewKey(item.filename)));
  return entries;
}
function syncImageDecompositionGenerationPreviewKey() {
  if (getImageDecompositionGenerationItemByKey(state.imageDecomposition.previewKey || "")) {
    return;
  }
  const fallback = getImageDecompositionGenerationPreviewEntries()[0];
  state.imageDecomposition.previewKey = fallback?.key || "";
}
function getImageDecompositionGenerationPreviewItem() {
  syncImageDecompositionGenerationPreviewKey();
  return getImageDecompositionGenerationItemByKey(state.imageDecomposition.previewKey || "");
}
function setImageDecompositionGenerationPreviewKey(key) {
  const nextKey = String(key || "").trim();
  if (!getImageDecompositionGenerationItemByKey(nextKey)) {
    return;
  }
  state.imageDecomposition.previewKey = nextKey;
  renderImageDecompositionGenerationPreview();
}
function setImageDecompositionGenerationPlaceholderText(message, hidden = false) {
  stopGenerationLoadingShell(imageDecompositionLoadingShellNodes?.loading);
  imageDecompositionLoadingShellNodes = null;
  refs.imageDecompositionGenerationPlaceholder.className = "image-decomposition-generation-placeholder preview-placeholder";
  refs.imageDecompositionGenerationPlaceholder.classList.toggle("hidden", hidden);
  refs.imageDecompositionGenerationPlaceholder.replaceChildren();
  if (!message) {
    return;
  }
  const title = document.createElement("h3");
  title.textContent = message;
  refs.imageDecompositionGenerationPlaceholder.appendChild(title);
  const detail = document.createElement("span");
  detail.textContent = "上传一张源图后开始生成，底部胶片条可快速切换结果。";
  refs.imageDecompositionGenerationPlaceholder.appendChild(detail);
}
function renderImageDecompositionGenerationLoading(item) {
  const placeholderState = {
    ...getPreviewPlaceholderState({
      item,
      imageUrl: "",
      prompt: item ? getDisplayPrompt(item) : "",
      runningCount: state.jobs.length,
      runningItems: state.jobs,
      maxConcurrentTasks: getMaxParallelJobCount(),
    }),
    eyebrow: "Image Decomposition",
    title: "拆解信息图生成中",
    detail: item?.statusText || "正在生成图片",
  };
  if (
    !imageDecompositionLoadingShellNodes ||
    !shouldReusePreviewLoadingShell(imageDecompositionLoadingShellNodes.state || {}, placeholderState)
  ) {
    const previousLoadingShellNodes = imageDecompositionLoadingShellNodes;
    imageDecompositionLoadingShellNodes = createPreviewLoadingShellNodes();
    stopGenerationLoadingShell(previousLoadingShellNodes?.loading, { retainSource: true });
  }
  updatePreviewLoadingShell(imageDecompositionLoadingShellNodes, placeholderState);
  refs.imageDecompositionGenerationPlaceholder.className =
    "image-decomposition-generation-placeholder preview-placeholder preview-placeholder-loading";
  refs.imageDecompositionGenerationPlaceholder.classList.remove("hidden");
  if (
    refs.imageDecompositionGenerationPlaceholder.firstChild !== imageDecompositionLoadingShellNodes.shell ||
    refs.imageDecompositionGenerationPlaceholder.childElementCount !== 1
  ) {
    refs.imageDecompositionGenerationPlaceholder.replaceChildren(imageDecompositionLoadingShellNodes.shell);
  }
}
function openImageDecompositionGeneratedPreview() {
  const item = getImageDecompositionGenerationPreviewItem();
  if (item && getImageUrl(item)) {
    openLightbox(item, {
      items: getImageDecompositionGenerationPreviewEntries().map((entry) => entry.item),
    });
  }
}
function renderImageDecompositionGenerationPreview() {
  const item = getImageDecompositionGenerationPreviewItem();
  const imageUrl = item ? getImageUrl(item) : "";
  const isRunning = Boolean(item?.isRunning || (item?.started && !item?.filename));
  refs.imageDecompositionGenerationCanvas.classList.toggle("has-image", Boolean(imageUrl));
  refs.imageDecompositionGenerationCanvas.classList.toggle("is-running", isRunning && !imageUrl);
  if (imageUrl) {
    refs.imageDecompositionGenerationCanvas.setAttribute("role", "button");
    refs.imageDecompositionGenerationCanvas.setAttribute("aria-label", "查看图片拆解生成图");
    refs.imageDecompositionGenerationCanvas.tabIndex = 0;
  } else {
    refs.imageDecompositionGenerationCanvas.removeAttribute("role");
    refs.imageDecompositionGenerationCanvas.removeAttribute("aria-label");
    refs.imageDecompositionGenerationCanvas.tabIndex = -1;
  }
  if (imageUrl) {
    setImageDecompositionGenerationPlaceholderText("", true);
  } else if (isRunning) {
    renderImageDecompositionGenerationLoading(item);
  } else {
    setImageDecompositionGenerationPlaceholderText("拆解信息图会显示在这里");
  }
  if (imageUrl) {
    setImageRevealSource(refs.imageDecompositionGenerationImage, imageUrl, {
      alt: getDisplayPrompt(item) || "图片拆解生成结果",
      decoding: "async",
      loading: "eager",
    });
    refs.imageDecompositionGenerationDownloadButton.href = imageUrl;
    refs.imageDecompositionGenerationDownloadButton.download = item.filename || "image-decomposition.png";
    refs.imageDecompositionGenerationDownloadButton.classList.remove("disabled");
    refs.imageDecompositionGenerationDownloadButton.setAttribute("aria-disabled", "false");
    refs.imageDecompositionGenerationLightboxButton.disabled = false;
  } else {
    clearImageReveal(refs.imageDecompositionGenerationImage);
    refs.imageDecompositionGenerationDownloadButton.href = "#";
    refs.imageDecompositionGenerationDownloadButton.removeAttribute("download");
    refs.imageDecompositionGenerationDownloadButton.classList.add("disabled");
    refs.imageDecompositionGenerationDownloadButton.setAttribute("aria-disabled", "true");
    refs.imageDecompositionGenerationLightboxButton.disabled = true;
  }
  refs.imageDecompositionGenerationMeta.textContent = item
    ? [formatTime(item.createdAt), formatCanvasLabel(resolveDisplayImageSize(item)), item.statusText || ""].filter(Boolean).join(" · ")
    : "等待生成";
  renderImageDecompositionGenerationStrip();
}
function renderImageDecompositionGenerationStrip() {
  renderFilmstripPreservingSelection({
    strip: refs.imageDecompositionGenerationStrip,
    selectedKey: state.imageDecomposition.previewKey,
    getEntryKey: (entry) => entry.dataset?.imageDecompositionGenerationEntryKey || "",
    tracker: imageDecompositionFilmstripRevealTracker,
    render: renderImageDecompositionGenerationStripEntries,
  });
}

function renderImageDecompositionGenerationStripEntries() {
  const entries = getImageDecompositionGenerationPreviewEntries();
  const nextEntries = entries.map(({ key, item }, index) => {
    const isSelected = key === state.imageDecomposition.previewKey;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "filmstrip-item image-decomposition-generation-thumb";
    button.dataset.imageDecompositionGenerationKey = key;
    button.setAttribute("aria-pressed", String(isSelected));
    button.setAttribute("aria-current", isSelected ? "true" : "false");
    button.title = `切换到第 ${index + 1} 张图片拆解结果`;
    button.classList.toggle("active", isSelected);
    button.classList.toggle("is-running", Boolean(item?.isRunning || (item?.started && !item?.filename)));
    const imageUrl = getImageUrl(item);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = getDisplayPrompt(item);
      image.loading = "lazy";
      button.appendChild(image);
      } else if (item?.isRunning || (item?.started && !item?.filename)) {
        const loading = createGenerationLoadingShell(document, { key, active: true, stage: getGenerationLoadingItemStage(item) });
        button.appendChild(loading.shell);
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
    shell.dataset.imageDecompositionGenerationEntryKey = key;
    shell.appendChild(button);
    syncFilmstripSelectedMarker(shell, isSelected, { documentRef: document });
    return shell;
  });
  stopGenerationLoadingShells(refs.imageDecompositionGenerationStrip);
  refs.imageDecompositionGenerationStrip.replaceChildren(...nextEntries);
  refs.imageDecompositionGenerationStrip.classList.toggle("hidden", entries.length === 0);
  refs.imageDecompositionThumbnailEmpty.classList.toggle("hidden", entries.length > 0);
}
async function preserveImageDecompositionGenerationItemForDelete(item) {
  if (!item?.filename) {
    return;
  }
  const key = makeGalleryPreviewKey(item.filename);
  const isTrackedImageDecompositionItem =
    item.mode === "image-decomposition" ||
    item.assetKind === "image-decomposition" ||
    state.imageDecomposition.generationKeys.includes(key) ||
    Boolean(state.imageDecomposition.generationItems[key]);
  if (!isTrackedImageDecompositionItem) {
    return;
  }
  const imageUrl = getImageUrl(item);
  if (!imageUrl || String(imageUrl).startsWith("data:image/")) {
    storeImageDecompositionGenerationItem(item);
    return;
  }
  try {
    const dataUrl = await fetchServerImageAsDataUrl(imageUrl);
    if (dataUrl) {
      storeImageDecompositionGenerationItem({
        ...item,
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
      });
      return;
    }
  } catch (_error) {
    // Keep existing metadata if the image cannot be copied before deletion.
  }
  storeImageDecompositionGenerationItem(item);
}
function createImageDecompositionGenerationFile(item) {
  return item?.generationFile || item?.file;
}
function syncImageDecompositionLanguageUI() {
  const isCustom = refs.imageDecompositionLanguageInput.value === "custom";
  refs.imageDecompositionCustomLanguageField.classList.toggle("hidden", !isCustom);
  refs.imageDecompositionCustomLanguageInput.disabled = !isCustom;
}
function renderImageDecompositionSource() {
  const item = state.imageDecomposition.file;
  refs.imageDecompositionCount.textContent = item ? "1 / 1" : "0 / 1";
  syncReferenceDropzoneCompact(refs.imageDecompositionDropzone, Boolean(item));
  refs.imageDecompositionGrid.classList.toggle("hidden", !item);
  refs.imageDecompositionGrid.replaceChildren();
  if (!item) {
    return;
  }
  const card = document.createElement("div");
  card.className = "reference-card";
  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.className = "reference-preview-button";
  previewButton.dataset.imageDecompositionPreviewId = item.id;
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
  remove.addEventListener("click", () => removeImageDecompositionFile());
  card.appendChild(remove);
  refs.imageDecompositionGrid.appendChild(card);
}
function createImageDecompositionGenerationItem(file) {
  return createImageDecompositionItem(file);
}
function applyImageDecompositionFile(fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return;
  }
  if (incomingFiles.length !== 1) {
    setImageDecompositionFeedback("图片拆解模式一次只能上传一张源图。", "error");
    return;
  }
  const file = incomingFiles[0];
  if (state.imageDecomposition.file?.fingerprint === buildReferenceFingerprint(file)) {
    return;
  }
  const nextItem = createImageDecompositionGenerationItem(file);
  startImageDecompositionGenerationCompression(nextItem);
  if (state.imageDecomposition.file) {
    revokeReferencePreview(state.imageDecomposition.file);
  }
  state.imageDecomposition.file = nextItem;
  refs.imageDecompositionInput.value = "";
  setImageDecompositionFeedback("", "");
  renderImageDecompositionView();
}
function removeImageDecompositionFile() {
  const target = state.imageDecomposition.file;
  if (!target) {
    return;
  }
  if (state.imageDecompositionPreviewItem?.id === target.id) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.imageDecomposition.file = null;
  refs.imageDecompositionInput.value = "";
  renderImageDecompositionView();
}
function openImageDecompositionPreview(referenceId) {
  const item = state.imageDecomposition.file;
  if (item?.id !== referenceId || !item.previewUrl) {
    return;
  }
  state.imageDecompositionPreviewItem = item;
  setReferencePreviewNavigationContext({ items: [item], currentId: item.id });
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}
function syncImageDecompositionRatio(value) {
  const nextValue = getRatioOption(value)?.value || DEFAULT_UI_RATIO;
  refs.imageDecompositionRatioInput.value = nextValue;
  renderImageDecompositionRatioGrid();
  renderImageDecompositionSizeOptions();
}
function renderImageDecompositionRatioGrid() {
  renderRatioGrid(refs.imageDecompositionRatioGrid, refs.imageDecompositionRatioInput, syncImageDecompositionRatio);
}
function renderImageDecompositionSizeOptions() {
  renderSizeOptions(refs.imageDecompositionSizeInput, refs.imageDecompositionRatioInput);
}
function syncImageDecompositionSize(value) {
  const ratioValue = refs.imageDecompositionRatioInput.value || DEFAULT_UI_RATIO;
  refs.imageDecompositionSizeInput.value = normalizeSizeForSelectedRoute(ratioValue, value || "auto");
}
function createImageDecompositionJob() {
  const ratioOption = getRatioOption(refs.imageDecompositionRatioInput.value || DEFAULT_UI_RATIO);
  const sourceItem = state.imageDecomposition.file;
  const sizeSetting = normalizeSizeForSelectedRoute(ratioOption.value, refs.imageDecompositionSizeInput.value || "auto");
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;
  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    mode: "image-decomposition",
    prompt: "图片拆解信息图",
    targetLanguage: refs.imageDecompositionLanguageInput.value,
    customTargetLanguage: refs.imageDecompositionCustomLanguageInput.value.trim(),
    featureCardsEnabled: refs.imageDecompositionFeatureCardsInput.value === "on",
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png"),
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || DEFAULT_RESPONSES_MODEL,
    imageModel: DEFAULT_DIRECT_IMAGE_MODEL,
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    requestRetryCount: 0,
    referenceFiles: sourceItem ? [createImageDecompositionGenerationFile(sourceItem)] : [],
    hasReferenceImage: Boolean(sourceItem),
    referenceImageName: sourceItem?.file?.name || "",
    referenceImageNames: sourceItem?.file?.name ? [sourceItem.file.name] : [],
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: buildGenerationTaskStatusText({ statusStage: "queued", statusText: "等待排队" }),
    previewUrl: "",
  };
}
async function startImageDecompositionGeneration() {
  clearError();
  if (!state.imageDecomposition.file?.file) {
    setImageDecompositionFeedback("请先上传一张源图。", "error");
    return;
  }
  const targetLanguage = String(refs.imageDecompositionLanguageInput.value || "").trim();
  const customLanguage = String(refs.imageDecompositionCustomLanguageInput.value || "").trim();
  if (targetLanguage === "custom" && !customLanguage) {
    setImageDecompositionFeedback("请填写自定义语言。", "error");
    return;
  }
  await ensureImageDecompositionGenerationFilesReady();
  const job = createImageDecompositionJob();
  registerImageDecompositionGenerationKey(makeJobPreviewKey(job.id));
  state.jobs.unshift(job);
  state.imageDecomposition.previewKey = makeJobPreviewKey(job.id);
  state.selectedPreviewKey = makeJobPreviewKey(job.id);
  recordJobQueued(job);
  setImageDecompositionFeedback("图片拆解任务已提交，正在生成...", "busy");
  renderAll();
  setActiveView("image-decomposition");
  scheduleGenerationQueue();
}
function renderImageDecompositionView() {
  syncImageDecompositionLanguageUI();
  renderImageDecompositionSource();
  renderImageDecompositionGenerationPreview();
  refs.imageDecompositionGenerateButton.disabled =
    !state.imageDecomposition.file || hasPendingImageDecompositionGenerationFiles();
  refs.imageDecompositionGenerateButton.textContent = hasPendingImageDecompositionGenerationFiles()
    ? "处理中..."
    : getQueuedJobCount() > 0
      ? "继续生成"
      : "开始拆解";
}
function openReferenceAnalysisPreview(referenceId) {
  const item = state.referenceAnalysis.files.find((entry) => entry.id === referenceId);
  if (!item?.previewUrl) {
    return;
  }
  state.referenceAnalysisPreviewItem = item;
  setReferencePreviewNavigationContext({ items: state.referenceAnalysis.files, currentId: item.id });
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}
function syncReferenceDropzoneCompact(dropzone, hasFiles) {
  if (!dropzone) {
    return;
  }
  dropzone.classList.toggle("is-compact-hidden", Boolean(hasFiles));
}
function createReferenceAddCard({ input, label, onFiles }) {
  const card = document.createElement("div");
  card.className = "reference-card reference-add-card";
  const button = document.createElement("button");
  button.type = "button";
  button.className = "reference-add-button";
  button.textContent = "+";
  button.title = label;
  button.setAttribute("aria-label", label);
  button.addEventListener("click", () => input?.click());
  card.addEventListener("dragover", (event) => {
    event.preventDefault();
    card.classList.add("dragover");
  });
  card.addEventListener("dragleave", () => {
    card.classList.remove("dragover");
  });
  card.addEventListener("drop", (event) => {
    event.preventDefault();
    card.classList.remove("dragover");
    onFiles?.(event.dataTransfer?.files);
  });
  card.appendChild(button);
  return card;
}
function normalizeStyleTransferPresetValue(value) {
  const candidate = String(value || "").trim();
  return STYLE_TRANSFER_PRESETS.some((preset) => preset.value === candidate) ? candidate : STYLE_TRANSFER_DEFAULT_PRESET;
}
function getStyleTransferPreset(value = state.styleTransfer.selectedPreset) {
  const normalizedValue = normalizeStyleTransferPresetValue(value);
  return STYLE_TRANSFER_PRESETS.find((preset) => preset.value === normalizedValue) || STYLE_TRANSFER_PRESETS[0];
}
function hasSelectedStyleTransferPreset() {
  return getStyleTransferPreset()?.value !== STYLE_TRANSFER_CUSTOM_PRESET;
}
function getStyleTransferPresetFileName(preset) {
  const raw = String(preset?.value || "style-preset").replace(/[^a-z0-9-]+/gi, "-") || "style-preset";
  return `${raw}-style-reference.png`;
}
function loadStyleTransferPresetImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("预设风格图加载失败。"));
    image.decoding = "async";
    image.src = src;
  });
}
async function createStyleTransferPresetReferenceFile(preset) {
  if (!preset?.image) {
    return null;
  }
  const image = await loadStyleTransferPresetImage(preset.image);
  const sourceWidth = image.naturalWidth || STYLE_TRANSFER_PRESET_REFERENCE_SIZE;
  const sourceHeight = image.naturalHeight || Math.round((STYLE_TRANSFER_PRESET_REFERENCE_SIZE * 3) / 4);
  const width = STYLE_TRANSFER_PRESET_REFERENCE_SIZE;
  const height = Math.max(1, Math.round((width * sourceHeight) / sourceWidth));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("预设风格图准备失败。");
  }
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);
  const blob = await canvasToBlob(canvas, "image/png");
  return new File([blob], getStyleTransferPresetFileName(preset), {
    type: "image/png",
    lastModified: Date.now(),
  });
}
async function ensureStyleTransferPresetReferenceFileReady() {
  const preset = getStyleTransferPreset();
  if (!preset || preset.value === STYLE_TRANSFER_CUSTOM_PRESET) {
    state.styleTransfer.presetReferenceFile = null;
    state.styleTransfer.presetReferenceFileKey = "";
    return null;
  }
  if (state.styleTransfer.presetReferenceFile && state.styleTransfer.presetReferenceFileKey === preset.value) {
    return state.styleTransfer.presetReferenceFile;
  }
  const file = await createStyleTransferPresetReferenceFile(preset);
  state.styleTransfer.presetReferenceFile = file;
  state.styleTransfer.presetReferenceFileKey = preset.value;
  return file;
}
function getStyleTransferPresetReferenceFile() {
  return hasSelectedStyleTransferPreset() ? state.styleTransfer.presetReferenceFile : null;
}
function openStyleTransferPresetComparison() {
  const preset = getStyleTransferPreset();
  const comparisonItem = buildStyleTransferPresetComparisonItem({ preset, nowIso });
  if (comparisonItem) {
    openLightbox(comparisonItem);
  }
}
function handleStyleTransferPresetComparisonClick(event) {
  const trigger = event.target?.closest?.("[data-style-transfer-preset-preview]");
  if (trigger && refs.styleTransferPresetComparison?.contains(trigger)) openStyleTransferPresetComparison();
}
function createStyleTransferComparisonCard({ label, src, alt, preset = getStyleTransferPreset() }) {
  const card = document.createElement("div");
  card.className = "style-transfer-comparison-card";
  const caption = document.createElement("span");
  caption.className = "style-transfer-comparison-label"; caption.textContent = label;
  card.appendChild(caption);
  const button = document.createElement("button");
  button.type = "button"; button.className = "style-transfer-comparison-button";
  button.dataset.styleTransferPresetPreview = "comparison";
  button.title = `放大查看 ${preset.label}${label}`;
  button.setAttribute("aria-label", button.title);
  const frame = document.createElement("span");
  frame.className = "style-transfer-comparison-frame";
  const image = document.createElement("img");
  image.loading = "lazy"; image.decoding = "async"; image.src = src; image.alt = alt;
  frame.appendChild(image);
  button.appendChild(frame);
  card.appendChild(button);
  return card;
}
function renderStyleTransferPresetOptions() {
  if (!refs.styleTransferPresetInput) {
    return;
  }
  const selectedValue = normalizeStyleTransferPresetValue(state.styleTransfer.selectedPreset);
  if (refs.styleTransferPresetInput.options.length !== STYLE_TRANSFER_PRESETS.length) {
    refs.styleTransferPresetInput.replaceChildren(
      ...STYLE_TRANSFER_PRESETS.map((preset) => {
        const option = document.createElement("option");
        option.value = preset.value;
        option.textContent = preset.label;
        return option;
      }),
    );
  }
  refs.styleTransferPresetInput.value = selectedValue;
}
function renderStyleTransferPresetPreview() {
  renderStyleTransferPresetOptions();
  const preset = getStyleTransferPreset();
  const showPreview = Boolean(preset.beforeImage && preset.image);
  refs.styleTransferPresetPreview?.classList.toggle("hidden", !preset);
  refs.styleTransferPresetComparison?.classList.toggle("hidden", !showPreview);
  if (refs.styleTransferPresetLabel) {
    refs.styleTransferPresetLabel.textContent = preset?.label || "";
  }
  if (refs.styleTransferPresetDescription) {
    refs.styleTransferPresetDescription.textContent = preset?.description || "";
  }
  if (refs.styleTransferPresetComparison) {
    refs.styleTransferPresetComparison.replaceChildren();
    if (showPreview) {
      refs.styleTransferPresetComparison.append(
        createStyleTransferComparisonCard({
          label: "风格前",
          src: preset.beforeImage,
          alt: `${preset.label} 风格前示意图`,
        }),
        createStyleTransferComparisonCard({
          label: "风格后",
          src: preset.image,
          alt: `${preset.label} 风格后示意图`,
        }),
      );
    }
  }
  refs.styleTransferUploadGrid?.classList.toggle("uses-preset-style", hasSelectedStyleTransferPreset());
}
function handleStyleTransferPresetChange(event) {
  state.styleTransfer.selectedPreset = normalizeStyleTransferPresetValue(event.target.value);
  state.styleTransfer.presetReferenceFile = null;
  state.styleTransfer.presetReferenceFileKey = "";
  renderStyleTransferReferences();
  updateGenerateButton();
}
function renderReferenceAnalysisGrid() {
  refs.referenceAnalysisGrid.replaceChildren();
  refs.referenceAnalysisCount.textContent = `${state.referenceAnalysis.files.length} / ${state.limits.maxReferenceImages}`;
  syncReferenceDropzoneCompact(refs.referenceAnalysisDropzone, state.referenceAnalysis.files.length > 0);
  refs.referenceAnalysisGrid.classList.toggle("hidden", state.referenceAnalysis.files.length === 0);
  state.referenceAnalysis.files.forEach((item) => {
    const card = document.createElement("div");
    card.className = "reference-card";
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "reference-preview-button";
    previewButton.dataset.referenceAnalysisPreviewId = item.id;
    previewButton.setAttribute("aria-label", "放大查看待分析图片");
    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "待分析图片预览";
    previewButton.appendChild(image);
    card.appendChild(previewButton);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", "移除待分析图片");
    remove.addEventListener("click", () => removeReferenceAnalysisFile(item.id));
    card.appendChild(remove);
    refs.referenceAnalysisGrid.appendChild(card);
  });
  if (state.referenceAnalysis.files.length > 0 && state.referenceAnalysis.files.length < state.limits.maxReferenceImages) {
    refs.referenceAnalysisGrid.appendChild(
      createReferenceAddCard({
        input: refs.referenceAnalysisInput,
        label: "继续上传待分析图片",
        onFiles: applyReferenceAnalysisFiles,
      }),
    );
  }
}
function createStyleTransferReferenceItem(slot, file) {
  return {
    id: `style-transfer-${slot}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    slot,
    fingerprint: buildReferenceFingerprint(file),
    file,
    generationFile: file,
    generationFilePromise: null,
    generationCompressed: false,
    previewUrl: URL.createObjectURL(file),
  };
}
function applyStyleTransferReferenceFile(slot, fileList) {
  const imageFiles = [...(fileList || [])].filter((item) => item.type.startsWith("image/"));
  if (imageFiles.length === 0) {
    showError("请选择一张图片。");
    return;
  }
  if (imageFiles.length > 1) {
    showError("原图和风格参考图每个区域只能上传一张图片。");
    return;
  }
  const file = imageFiles[0];
  const current = getStyleTransferReferenceItem(slot);
  const nextFingerprint = buildReferenceFingerprint(file);
  if (current?.fingerprint === nextFingerprint) {
    refs[slot === "style" ? "styleTransferStyleInput" : "styleTransferSourceInput"].value = "";
    return;
  }
  if (state.styleTransferPreviewItem?.id === current?.id) {
    closeReferencePreview();
  }
  revokeReferencePreview(current);
  const nextItem = createStyleTransferReferenceItem(slot, file);
  state.styleTransfer[slot === "style" ? "style" : "source"] = nextItem;
  refs[slot === "style" ? "styleTransferStyleInput" : "styleTransferSourceInput"].value = "";
  startStyleTransferGenerationCompression(nextItem);
  renderStyleTransferReferences();
  updateGenerateButton();
}
function removeStyleTransferReference(slot) {
  const key = slot === "style" ? "style" : "source";
  const target = state.styleTransfer[key];
  if (state.styleTransferPreviewItem?.id === target?.id) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.styleTransfer[key] = null;
  renderStyleTransferReferences();
  updateGenerateButton();
}
function openStyleTransferPreview(slot) {
  const item = getStyleTransferReferenceItem(slot);
  if (!item?.previewUrl) {
    return;
  }
  closeReferencePreview();
  state.styleTransferPreviewItem = item;
  setReferencePreviewNavigationContext({
    items: [state.styleTransfer.source, state.styleTransfer.style].filter(Boolean),
    currentId: item.id,
  });
  refs.referencePreviewImage.src = item.previewUrl;
  refs.referencePreviewViewer.classList.add("open");
  refs.referencePreviewViewer.setAttribute("aria-hidden", "false");
}
function renderStyleTransferReferenceSlot(slot, grid) {
  if (!grid) {
    return;
  }
  const item = getStyleTransferReferenceItem(slot);
  grid.replaceChildren();
  grid.classList.toggle("hidden", !item);
  if (!item) {
    return;
  }
  const card = document.createElement("div");
  card.className = "reference-card";
  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.className = "reference-preview-button";
  previewButton.dataset.styleTransferPreviewRole = slot;
  previewButton.setAttribute("aria-label", slot === "style" ? "放大查看风格参考图" : "放大查看原图");
  previewButton.addEventListener("click", () => openStyleTransferPreview(slot));
  const image = document.createElement("img");
  image.src = item.previewUrl;
  image.alt = slot === "style" ? "风格参考图预览" : "原图预览";
  previewButton.appendChild(image);
  card.appendChild(previewButton);
  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "reference-remove";
  remove.textContent = "x";
  remove.setAttribute("aria-label", slot === "style" ? "移除风格参考图" : "移除原图");
  remove.addEventListener("click", () => removeStyleTransferReference(slot));
  card.appendChild(remove);
  grid.appendChild(card);
}
function renderStyleTransferReferences() {
  renderStyleTransferPresetPreview();
  syncReferenceDropzoneCompact(refs.styleTransferSourceDropzone, Boolean(getStyleTransferReferenceItem("source")));
  syncReferenceDropzoneCompact(refs.styleTransferStyleDropzone, Boolean(getStyleTransferReferenceItem("style")));
  renderStyleTransferReferenceSlot("source", refs.styleTransferSourceGrid);
  renderStyleTransferReferenceSlot("style", refs.styleTransferStyleGrid);
}
function renderReferenceGrid() {
  refs.referenceGrid.innerHTML = "";
  refs.referenceCount.textContent = `${state.referenceFiles.length} / ${state.limits.maxReferenceImages}`;
  syncReferenceDropzoneCompact(refs.referenceDropzone, state.referenceFiles.length > 0);
  refs.referenceGrid.classList.toggle("hidden", state.referenceFiles.length === 0);
  state.referenceFiles.forEach((item) => {
    const card = document.createElement("div");
    card.className = "reference-card";
    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "reference-preview-button";
    previewButton.dataset.referencePreviewId = item.id;
    previewButton.setAttribute("aria-label", "放大查看参考图");
    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "参考图预览";
    previewButton.appendChild(image);
    card.appendChild(previewButton);
    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", "移除参考图");
    remove.addEventListener("click", () => removeReferenceFile(item.id));
    card.appendChild(remove);
    refs.referenceGrid.appendChild(card);
  });
  if (state.referenceFiles.length > 0 && state.referenceFiles.length < state.limits.maxReferenceImages) {
    refs.referenceGrid.appendChild(
      createReferenceAddCard({
        input: refs.referenceInput,
        label: "继续上传参考图",
        onFiles: applyReferenceFiles,
      }),
    );
  }
}
function getReferenceAnalysisPrompts(item = state.referenceAnalysis.result) {
  const prompts = Array.isArray(item?.json?.prompts)
    ? item.json.prompts
        .map((entry) => ({
          title: String(entry?.title || "编排提示词").trim(),
          intent: String(entry?.intent || "").trim(),
          prompt: String(entry?.prompt || "").trim(),
        }))
        .filter((entry) => entry.prompt)
        .slice(0, 3)
    : [];
  const fallbackPrompt = getPromptAgentPrompt(item);
  return prompts.length > 0
    ? prompts
    : fallbackPrompt
      ? [
          {
            title: item?.json?.title || "编排提示词",
            intent: "",
            prompt: fallbackPrompt,
          },
        ]
      : [];
}
function setReferenceAnalysisFeedback(message, kind = "") {
  refs.referenceAnalysisFeedback.textContent = message ? compactErrorMessage(message, "参考图分析失败") : "";
  refs.referenceAnalysisFeedback.dataset.state = kind;
}
function markReferenceAnalysisDirty() {
  if (state.referenceAnalysis.result) {
    state.referenceAnalysis.dirty = true;
    state.referenceAnalysis.previewKey = "";
    state.referenceAnalysis.selectedPrompt = "";
    setReferenceAnalysisFeedback("参考图已变化，请重新分析。", "busy");
  } else {
    setReferenceAnalysisFeedback("", "");
  }
  renderReferenceAnalysisSelectedPrompt();
}
function toggleReferenceAnalysisPanel() {
  if (!state.referenceAnalysis.result?.json) {
    return;
  }
  state.referenceAnalysis.collapsed = !state.referenceAnalysis.collapsed;
  renderReferenceAnalysis();
}
function toggleReferenceAnalysisAutoCollapse() {
  state.referenceAnalysis.autoCollapseOnApply = !state.referenceAnalysis.autoCollapseOnApply;
  renderReferenceAnalysisSelectedPrompt();
}
function createReferenceAnalysisCard(option, index) {
  const card = document.createElement("article");
  card.className = "reference-analysis-card";
  const title = document.createElement("strong");
  title.textContent = option.title || `编排提示词 ${index + 1}`;
  const intent = document.createElement("span");
  intent.textContent = option.intent || "可直接应用到主提示词";
  const prompt = document.createElement("p");
  prompt.textContent = option.prompt;
  const button = document.createElement("button");
  const isSelected = state.referenceAnalysis.selectedPrompt === option.prompt;
  button.className = "inline-button reference-analysis-apply-pill";
  button.classList.toggle("is-selected", isSelected);
  button.type = "button";
  button.dataset.referenceAnalysisPromptIndex = String(index);
  button.textContent = isSelected ? "已应用" : "应用提示词";
  button.setAttribute("aria-pressed", String(isSelected));
  button.setAttribute("aria-label", `${button.textContent}: ${option.title || `编排提示词 ${index + 1}`}`);
  card.append(title, intent, prompt, button);
  return card;
}
function getReferenceAnalysisGenerationItemByKey(key) {
  if (key.startsWith("job:")) {
    return state.jobs.find((job) => job.id === key.slice(4) && job.mode === "reference-analysis") || null;
  }
  if (key.startsWith("file:")) {
    return state.referenceAnalysis.generationItems[key] || state.gallery.find((item) => item.filename === key.slice(5)) || null;
  }
  return null;
}
function storeReferenceAnalysisGenerationItem(item) {
  const filename = String(item?.filename || "").trim();
  if (!filename) {
    return "";
  }
  const key = makeGalleryPreviewKey(filename);
  const current = state.referenceAnalysis.generationItems[key] || {};
  state.referenceAnalysis.generationItems[key] = {
    ...current,
    ...item,
    mode: "reference-analysis",
  };
  return key;
}
function registerReferenceAnalysisGenerationKey(key) {
  const nextKey = String(key || "").trim();
  if (!nextKey) {
    return;
  }
  state.referenceAnalysis.generationKeys = [
    nextKey,
    ...state.referenceAnalysis.generationKeys.filter((entry) => entry !== nextKey),
  ];
}
function replaceReferenceAnalysisGenerationKey(oldKey, newKey) {
  const currentKey = String(oldKey || "").trim();
  const nextKey = String(newKey || "").trim();
  if (!nextKey) {
    return;
  }
  const keys = state.referenceAnalysis.generationKeys.filter((entry) => entry !== nextKey);
  const index = keys.indexOf(currentKey);
  if (index >= 0) {
    keys[index] = nextKey;
    state.referenceAnalysis.generationKeys = keys;
    return;
  }
  state.referenceAnalysis.generationKeys = [nextKey, ...keys];
}
function removeReferenceAnalysisGenerationKey(key) {
  const targetKey = String(key || "").trim();
  if (!targetKey) {
    return;
  }
  state.referenceAnalysis.generationKeys = state.referenceAnalysis.generationKeys.filter((entry) => entry !== targetKey);
  if (state.referenceAnalysis.previewKey === targetKey) {
    state.referenceAnalysis.previewKey = "";
  }
}
function getReferenceAnalysisGenerationPreviewEntries() {
  const entries = [];
  const seen = new Set();
  const addKey = (key) => {
    const normalizedKey = String(key || "").trim();
    if (!normalizedKey || seen.has(normalizedKey)) {
      return;
    }
    const item = getReferenceAnalysisGenerationItemByKey(normalizedKey);
    if (!item) {
      return;
    }
    seen.add(normalizedKey);
    entries.push({ key: normalizedKey, item });
  };
  state.referenceAnalysis.generationKeys.forEach(addKey);
  sortGalleryItemsByCreatedAtDesc(state.jobs)
    .filter((job) => job.mode === "reference-analysis")
    .forEach((job) => addKey(makeJobPreviewKey(job.id)));
  return entries;
}
function syncReferenceAnalysisGenerationPreviewKey() {
  if (getReferenceAnalysisGenerationItemByKey(state.referenceAnalysis.previewKey || "")) {
    return;
  }
  const fallback = getReferenceAnalysisGenerationPreviewEntries()[0];
  state.referenceAnalysis.previewKey = fallback?.key || "";
}
function getReferenceAnalysisGenerationPreviewItem() {
  syncReferenceAnalysisGenerationPreviewKey();
  return getReferenceAnalysisGenerationItemByKey(state.referenceAnalysis.previewKey || "");
}
function setReferenceAnalysisGenerationPreviewKey(key) {
  const nextKey = String(key || "").trim();
  if (!getReferenceAnalysisGenerationItemByKey(nextKey)) {
    return;
  }
  state.referenceAnalysis.previewKey = nextKey;
  renderReferenceAnalysisSelectedPrompt();
}
function renderReferenceAnalysisGenerationStrip() {
  renderFilmstripPreservingSelection({
    strip: refs.referenceAnalysisGenerationStrip,
    selectedKey: state.referenceAnalysis.previewKey,
    getEntryKey: (entry) => entry.dataset?.referenceAnalysisGenerationKey || "",
    tracker: referenceAnalysisFilmstripRevealTracker,
    render: renderReferenceAnalysisGenerationStripEntries,
  });
}

function renderReferenceAnalysisGenerationStripEntries() {
  const entries = getReferenceAnalysisGenerationPreviewEntries();
  const nextEntries = entries.map(({ key, item }, index) => {
    const isSelected = key === state.referenceAnalysis.previewKey;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "reference-analysis-generation-thumb";
    button.dataset.referenceAnalysisGenerationKey = key;
    button.setAttribute("aria-pressed", String(isSelected));
    button.setAttribute("aria-current", isSelected ? "true" : "false");
    button.title = `切换到第 ${index + 1} 张融图结果`;
    button.classList.toggle("active", isSelected);
    button.classList.toggle("is-running", Boolean(item?.isRunning || (item?.started && !item?.filename)));
    const imageUrl = getImageUrl(item);
    if (imageUrl) {
      const image = document.createElement("img");
      image.src = imageUrl;
      image.alt = getDisplayPrompt(item);
      image.loading = "lazy";
      button.appendChild(image);
    } else if (item?.isRunning || (item?.started && !item?.filename)) {
      const loading = createGenerationLoadingShell(document, { key, active: true, stage: getGenerationLoadingItemStage(item) });
      button.appendChild(loading.shell);
    } else {
      const ghost = document.createElement("span");
      ghost.textContent = formatLoadingThumbnailStatusLabel(item, { idleLabel: "等待" });
      button.appendChild(ghost);
    }
    // This rail has no shell wrapper, so the button itself hosts the marker.
    syncFilmstripSelectedMarker(button, isSelected, { documentRef: document });
    return button;
  });
  stopGenerationLoadingShells(refs.referenceAnalysisGenerationStrip);
  refs.referenceAnalysisGenerationStrip.replaceChildren(...nextEntries);
  refs.referenceAnalysisGenerationStrip.classList.toggle("hidden", entries.length === 0);
  refs.referenceAnalysisThumbnailEmpty.classList.toggle("hidden", entries.length > 0);
}
async function preserveReferenceAnalysisGenerationItemForDelete(item) {
  if (!item?.filename) {
    return;
  }
  const key = makeGalleryPreviewKey(item.filename);
  const isTrackedReferenceAnalysisItem =
    item.mode === "reference-analysis" ||
    state.referenceAnalysis.generationKeys.includes(key) ||
    Boolean(state.referenceAnalysis.generationItems[key]);
  if (!isTrackedReferenceAnalysisItem) {
    return;
  }
  const imageUrl = getImageUrl(item);
  if (!imageUrl || String(imageUrl).startsWith("data:image/")) {
    storeReferenceAnalysisGenerationItem(item);
    return;
  }
  try {
    const dataUrl = await fetchServerImageAsDataUrl(imageUrl);
    if (dataUrl) {
      storeReferenceAnalysisGenerationItem({
        ...item,
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
      });
      return;
    }
  } catch (_error) {
    // Keep the existing item metadata if the image cannot be copied before deletion.
  }
  storeReferenceAnalysisGenerationItem(item);
}
function setReferenceAnalysisGenerationPlaceholderText(message, hidden = false) {
  stopGenerationLoadingShell(referenceAnalysisLoadingShellNodes?.loading);
  referenceAnalysisLoadingShellNodes = null;
  refs.referenceAnalysisGenerationPlaceholder.className = "reference-analysis-generation-placeholder";
  refs.referenceAnalysisGenerationPlaceholder.classList.toggle("hidden", hidden);
  refs.referenceAnalysisGenerationPlaceholder.textContent = message;
}
function renderReferenceAnalysisGenerationLoading(item) {
  const placeholderState = {
    ...getPreviewPlaceholderState({
      item,
      imageUrl: "",
      prompt: item ? getDisplayPrompt(item) : "",
      runningCount: state.jobs.length,
      runningItems: state.jobs,
      maxConcurrentTasks: getMaxParallelJobCount(),
    }),
    eyebrow: "Reference Analysis",
    title: "提示词模式生成中",
    detail: item ? getDisplayPrompt(item) : "正在生成融图分析图片。",
  };
  if (
    !referenceAnalysisLoadingShellNodes ||
    !shouldReusePreviewLoadingShell(referenceAnalysisLoadingShellNodes.state || {}, placeholderState)
  ) {
    const previousLoadingShellNodes = referenceAnalysisLoadingShellNodes;
    referenceAnalysisLoadingShellNodes = createPreviewLoadingShellNodes();
    stopGenerationLoadingShell(previousLoadingShellNodes?.loading, { retainSource: true });
  }
  updatePreviewLoadingShell(referenceAnalysisLoadingShellNodes, placeholderState);
  refs.referenceAnalysisGenerationPlaceholder.className =
    "reference-analysis-generation-placeholder preview-placeholder preview-placeholder-loading";
  refs.referenceAnalysisGenerationPlaceholder.classList.remove("hidden");
  if (
    refs.referenceAnalysisGenerationPlaceholder.firstChild !== referenceAnalysisLoadingShellNodes.shell ||
    refs.referenceAnalysisGenerationPlaceholder.childElementCount !== 1
  ) {
    refs.referenceAnalysisGenerationPlaceholder.replaceChildren(referenceAnalysisLoadingShellNodes.shell);
  }
}
function openReferenceAnalysisGeneratedPreview() {
  const item = getReferenceAnalysisGenerationPreviewItem();
  if (item && getImageUrl(item)) {
    openLightbox(item, {
      items: getReferenceAnalysisGenerationPreviewEntries().map((entry) => entry.item),
    });
  }
}
function renderReferenceAnalysisGenerationPreview() {
  const item = getReferenceAnalysisGenerationPreviewItem();
  const imageUrl = item ? getImageUrl(item) : "";
  const isRunning = Boolean(item?.isRunning || (item?.started && !item?.filename));
  refs.referenceAnalysisGenerationCanvas.classList.toggle("has-image", Boolean(imageUrl));
  refs.referenceAnalysisGenerationCanvas.classList.toggle("is-running", isRunning && !imageUrl);
  if (imageUrl) {
    refs.referenceAnalysisGenerationCanvas.setAttribute("role", "button");
    refs.referenceAnalysisGenerationCanvas.setAttribute("aria-label", "查看融图分析生成图");
    refs.referenceAnalysisGenerationCanvas.tabIndex = 0;
  } else {
    refs.referenceAnalysisGenerationCanvas.removeAttribute("role");
    refs.referenceAnalysisGenerationCanvas.removeAttribute("aria-label");
    refs.referenceAnalysisGenerationCanvas.tabIndex = -1;
  }
  if (imageUrl) {
    setReferenceAnalysisGenerationPlaceholderText("", true);
  } else if (isRunning) {
    renderReferenceAnalysisGenerationLoading(item);
  } else {
    setReferenceAnalysisGenerationPlaceholderText("生成图展示框");
  }
  if (imageUrl) {
    setImageRevealSource(refs.referenceAnalysisGenerationImage, imageUrl, {
      alt: getDisplayPrompt(item) || "融图分析生成结果",
      decoding: "async",
      loading: "eager",
    });
    refs.referenceAnalysisGenerationDownloadButton.href = imageUrl;
    refs.referenceAnalysisGenerationDownloadButton.download = item.filename || "reference-analysis.png";
    refs.referenceAnalysisGenerationDownloadButton.classList.remove("disabled");
    refs.referenceAnalysisGenerationDownloadButton.setAttribute("aria-disabled", "false");
  } else {
    clearImageReveal(refs.referenceAnalysisGenerationImage);
    refs.referenceAnalysisGenerationDownloadButton.href = "#";
    refs.referenceAnalysisGenerationDownloadButton.removeAttribute("download");
    refs.referenceAnalysisGenerationDownloadButton.classList.add("disabled");
    refs.referenceAnalysisGenerationDownloadButton.setAttribute("aria-disabled", "true");
  }
  refs.referenceAnalysisGenerationMeta.textContent = item
    ? [formatTime(item.createdAt), formatCanvasLabel(resolveDisplayImageSize(item)), item.statusText || ""].filter(Boolean).join(" · ")
    : "等待生成";
  renderReferenceAnalysisGenerationStrip();
}
function renderReferenceAnalysisSelectedPrompt() {
  const promptText = String(state.referenceAnalysis.selectedPrompt || "").trim();
  refs.referenceAnalysisSelectedPromptPanel.classList.toggle("hidden", !promptText);
  refs.referenceAnalysisSelectedPrompt.value = promptText;
  refs.referenceAnalysisCopyPromptButton.disabled = !promptText;
  const preparingReference = hasPendingReferenceAnalysisGenerationFiles();
  refs.referenceAnalysisGenerateButton.disabled =
    !promptText || preparingReference;
  refs.referenceAnalysisGenerateButton.textContent = preparingReference
    ? "处理参考图..."
    : getQueuedJobCount() > 0
      ? "继续生成"
      : "开始生成";
  refs.referenceAnalysisAutoCollapseButton.classList.toggle("is-active", state.referenceAnalysis.autoCollapseOnApply);
  refs.referenceAnalysisAutoCollapseButton.setAttribute("aria-checked", String(state.referenceAnalysis.autoCollapseOnApply));
  renderReferenceAnalysisGenerationPreview();
}
function renderReferenceAnalysis() {
  refs.referenceAnalyzeButton.disabled = state.referenceAnalysis.running;
  renderInlineBusyButton(refs.referenceAnalyzeButton, {
    busy: state.referenceAnalysis.running,
    busyText: "分析中",
    idleText: "融图分析",
  });
  renderReferenceAnalysisSelectedPrompt();
  const item = state.referenceAnalysis.result;
  refs.referenceAnalysisPanel.classList.toggle("hidden", !item?.json);
  refs.referenceAnalysisEmpty?.classList.toggle("hidden", Boolean(item?.json));
  refs.referenceAnalysisList.replaceChildren();
  if (!item?.json) {
    state.referenceAnalysis.collapsed = false;
    refs.referenceAnalysisSummary.textContent = "--";
    refs.referenceAnalysisMeta.textContent = "--";
    refs.referenceAnalysisToggleButton.classList.add("hidden");
    refs.referenceAnalysisToggleButton.disabled = true;
    refs.referenceAnalysisToggleButton.setAttribute("aria-expanded", "false");
    refs.referenceAnalysisToggleButton.textContent = "折叠提示词";
    refs.referenceAnalysisHead.classList.remove("hidden");
    refs.referenceAnalysisList.classList.remove("hidden");
    return;
  }
  const json = item.json;
  const prompts = getReferenceAnalysisPrompts(item);
  const roles = Array.isArray(json.image_roles) ? json.image_roles.filter(Boolean) : [];
  const risks = Array.isArray(json.risks) ? json.risks.filter(Boolean) : [];
  refs.referenceAnalysisSummary.textContent = json.summary || json.relationship || json.title || "已生成编排提示词";
  refs.referenceAnalysisMeta.textContent = [
    json.relationship,
    roles.length ? `${roles.length} 个参考角色` : "",
    state.referenceAnalysis.dirty ? "参考图已变化" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  refs.referenceAnalysisToggleButton.classList.remove("hidden");
  refs.referenceAnalysisToggleButton.disabled = false;
  refs.referenceAnalysisToggleButton.setAttribute("aria-expanded", String(!state.referenceAnalysis.collapsed));
  refs.referenceAnalysisToggleButton.textContent = state.referenceAnalysis.collapsed ? "展开提示词" : "折叠提示词";
  refs.referenceAnalysisHead.classList.toggle("hidden", state.referenceAnalysis.collapsed);
  refs.referenceAnalysisList.classList.toggle("hidden", state.referenceAnalysis.collapsed);
  if (roles.length > 0) {
    const roleGroup = document.createElement("div");
    roleGroup.className = "reference-analysis-roles";
    roles.slice(0, 6).forEach((role) => {
      const rolePill = document.createElement("span");
      rolePill.className = "reference-analysis-role";
      rolePill.textContent = role;
      roleGroup.append(rolePill);
    });
    refs.referenceAnalysisList.append(roleGroup);
  }
  prompts.forEach((option, index) => {
    refs.referenceAnalysisList.append(createReferenceAnalysisCard(option, index));
  });
  if (risks.length > 0) {
    const risk = document.createElement("p");
    risk.className = "reference-analysis-risk";
    risk.textContent = risks.join("；");
    refs.referenceAnalysisList.append(risk);
  }
}
function renderReasoningOptions() {
  const currentValue = refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh";
  refs.reasoningEffortInput.innerHTML = "";
  state.reasoningEfforts.forEach((value) => {
    const option = document.createElement("option");
    const label = REASONING_LABELS[value] || value;
    const estimate = REASONING_ESTIMATES[value] || "";
    option.value = value;
    option.textContent = estimate ? `${label} ~${estimate}` : label;
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
function syncGenerationSize(value) {
  const ratioValue = refs.ratioInput.value || DEFAULT_UI_RATIO;
  const nextValue = normalizeSizeForSelectedRoute(ratioValue, value || "auto");
  refs.sizeInput.value = nextValue;
}
function renderSizeOptions(sizeInput = refs.sizeInput, ratioInput = refs.ratioInput) {
  if (!sizeInput || !ratioInput) {
    return;
  }
  const ratioValue = ratioInput.value || DEFAULT_UI_RATIO;
  const currentValue = normalizeSizeForSelectedRoute(ratioValue, sizeInput.value || "auto");
  sizeInput.innerHTML = "";
  const sizeOptions = isModelProtocolImageRoute() ? getModelProtocolImageSizeOptions() : getGenerationSizeOptions(ratioValue);
  sizeOptions.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = getUiSizeLabel(option);
    sizeInput.appendChild(element);
  });
  sizeInput.value = currentValue;
}
function renderReferenceAnalysisSizeOptions() {
  renderSizeOptions(refs.referenceAnalysisSizeInput, refs.referenceAnalysisRatioInput);
}
function syncReferenceAnalysisGenerationSize(value) {
  const ratioValue = refs.referenceAnalysisRatioInput.value || DEFAULT_UI_RATIO;
  refs.referenceAnalysisSizeInput.value = normalizeSizeForSelectedRoute(ratioValue, value || "auto");
}
function syncGenerationRatio(value) {
  const nextValue = getRatioOption(value)?.value || DEFAULT_UI_RATIO;
  refs.ratioInput.value = nextValue;
  renderRatioGrid();
  syncRatioOrientationSummary();
  renderSizeOptions();
  syncGenerationSize(refs.sizeInput.value);
}
function syncReferenceAnalysisRatio(value) {
  const nextValue = getRatioOption(value)?.value || DEFAULT_UI_RATIO;
  refs.referenceAnalysisRatioInput.value = nextValue;
  renderReferenceAnalysisRatioGrid();
  renderReferenceAnalysisSizeOptions();
  syncReferenceAnalysisGenerationSize(refs.referenceAnalysisSizeInput.value);
}
function getCreationRatioCompactLabel(option) {
  return String(option?.value || DEFAULT_UI_RATIO);
}
function setCreationRatioOptionLabels({ expanded = false } = {}) {
  refs.creationRatioInput?.querySelectorAll("option").forEach((option) => {
    option.textContent = expanded ? option.dataset.fullLabel || option.value : option.value;
  });
}
function renderCreationRatioOptions() {
  const currentValue = refs.creationRatioInput.value || DEFAULT_UI_RATIO;
  const options = getVisibleRatios();
  refs.creationRatioInput.innerHTML = "";
  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.dataset.fullLabel = option.label;
    element.textContent = getCreationRatioCompactLabel(option);
    refs.creationRatioInput.appendChild(element);
  });
  refs.creationRatioInput.value = options.some((option) => option.value === currentValue)
    ? currentValue
    : DEFAULT_UI_RATIO;
  setCreationRatioOptionLabels({ expanded: false });
  renderCreationSizeOptions();
}
function renderCreationSizeOptions() {
  const ratioValue = refs.creationRatioInput.value || DEFAULT_UI_RATIO;
  const currentValue = normalizeSizeForSelectedRoute(ratioValue, refs.creationSizeInput.value || "auto");
  refs.creationSizeInput.innerHTML = "";
  const sizeOptions = isModelProtocolImageRoute() ? getModelProtocolImageSizeOptions() : getGenerationSizeOptions(ratioValue);
  sizeOptions.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    refs.creationSizeInput.appendChild(element);
  });
  refs.creationSizeInput.value = currentValue;
}
function renderPortraitRatioOptions() {
  if (!refs.portraitRatioInput) {
    return;
  }
  const currentValue = refs.portraitRatioInput.value || DEFAULT_PORTRAIT_RATIO;
  const options = getVisibleRatios();
  refs.portraitRatioInput.innerHTML = "";
  options.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    refs.portraitRatioInput.appendChild(element);
  });
  refs.portraitRatioInput.value = options.some((option) => option.value === currentValue)
    ? currentValue
    : DEFAULT_PORTRAIT_RATIO;
  renderPortraitSizeOptions();
}
function renderPortraitSizeOptions() {
  if (!refs.portraitSizeInput || !refs.portraitRatioInput) {
    return;
  }
  const ratioValue = refs.portraitRatioInput.value || DEFAULT_PORTRAIT_RATIO;
  const currentValue = normalizeSizeForSelectedRoute(ratioValue, refs.portraitSizeInput.value || "auto");
  refs.portraitSizeInput.innerHTML = "";
  const sizeOptions = isModelProtocolImageRoute() ? getModelProtocolImageSizeOptions() : getGenerationSizeOptions(ratioValue);
  sizeOptions.forEach((option) => {
    const element = document.createElement("option");
    element.value = option.value;
    element.textContent = option.label;
    refs.portraitSizeInput.appendChild(element);
  });
  refs.portraitSizeInput.value = currentValue;
}
function syncPortraitRatio(value) {
  const nextValue = getRatioOption(value)?.value || DEFAULT_PORTRAIT_RATIO;
  refs.portraitRatioInput.value = nextValue;
  renderPortraitSizeOptions();
  renderPortraitView();
}
function syncPortraitSize(value) {
  const ratioValue = refs.portraitRatioInput.value || DEFAULT_PORTRAIT_RATIO;
  refs.portraitSizeInput.value = normalizeSizeForSelectedRoute(ratioValue, value || "auto");
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
function syncPromptTemplateSettingsEdge() {
  const rootStyle = document.documentElement.style;
  const layoutMode = getCurrentStudioLayoutMode();
  const isStudioLikeView =
    state.activeView === "studio" || state.activeView === "style-transfer" || state.activeView === "image-decomposition" || state.activeView === "quick-blend";
  if (!refs.settingsPanel || STACKED_STUDIO_LAYOUT_MODES.has(layoutMode) || !isStudioLikeView) {
    rootStyle.removeProperty("--prompt-template-settings-edge");
    return;
  }
  const settingsRect = refs.settingsPanel.getBoundingClientRect();
  if (!Number.isFinite(settingsRect.right) || settingsRect.width <= 0) {
    rootStyle.removeProperty("--prompt-template-settings-edge");
    return;
  }
  rootStyle.setProperty("--prompt-template-settings-edge", `${Math.round(settingsRect.right)}px`);
}
function syncStudioHeight() {
  syncPromptTemplateSettingsEdge();
  if (!refs.settingsPanel || !refs.previewPanel || !refs.viewRoot) {
    return;
  }
  const settingsScrollTop = getSettingsFormScrollTop();
  const isStudioLikeView =
    state.activeView === "studio" || state.activeView === "style-transfer" || state.activeView === "image-decomposition" || state.activeView === "quick-blend";
  if (STACKED_STUDIO_LAYOUT_MODES.has(getCurrentStudioLayoutMode()) || !isStudioLikeView) {
    document.documentElement.style.removeProperty("--studio-column-height");
    restoreSettingsFormScrollTop(settingsScrollTop);
    return;
  }
  document.documentElement.style.removeProperty("--studio-column-height");
  void refs.settingsPanel.offsetHeight;
  const viewRootRect = refs.viewRoot.getBoundingClientRect();
  const availableHeight = Math.max(320, Math.floor(Math.max(1, Math.round(window.visualViewport?.height || window.innerHeight)) - viewRootRect.top - WORKSPACE_BOTTOM_GAP_PX));
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
  const availableHeight = Math.max(320, Math.floor(window.innerHeight - viewRootRect.top - WORKSPACE_BOTTOM_GAP_PX));
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
  if (typeof ResizeObserver === "function") {
    studioHeightObserver = new ResizeObserver(() => {
      scheduleStudioHeightSync();
    });
    if (refs.settingsPanel) {
      studioHeightObserver.observe(refs.settingsPanel);
    }
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
  refs.galleryScrollbar.setAttribute("aria-disabled", String(metrics.disabled));
  refs.galleryScrollThumb.disabled = metrics.disabled;
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
  if (isModelProtocolImageRoute()) {
    return normalizeModelProtocolImageSize(refs.sizeInput.value || "auto");
  }
  return normalizeSizeForSelectedRoute(refs.ratioInput.value || DEFAULT_UI_RATIO, refs.sizeInput.value || "auto");
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

function renderRatioGrid(ratioGrid = refs.ratioGrid, ratioInput = refs.ratioInput, onSelect = syncGenerationRatio) {
  if (!ratioGrid || !ratioInput) {
    return;
  }

  ratioGrid.innerHTML = "";

  getVisibleRatios().forEach((option) => {
    const orientationLabel = getUiRatioOrientationLabel(option.orientation);
    const button = document.createElement("button");
    button.type = "button";
    button.className = "ratio-chip";
    button.dataset.orientation = option.orientation || "square";
    button.setAttribute("aria-label", getUiRatioLabel(option) || `${option.value} ${orientationLabel}`);
    if (ratioInput.value === option.value) {
      button.classList.add("active");
    }

    const title = document.createElement("strong");
    title.textContent = option.value;
    button.appendChild(title);

    button.addEventListener("click", () => {
      onSelect(option.value);
    });

    ratioGrid.appendChild(button);
  });
}

function renderReferenceAnalysisRatioGrid() {
  renderRatioGrid(refs.referenceAnalysisRatioGrid, refs.referenceAnalysisRatioInput, syncReferenceAnalysisRatio);
}

function getSelectedImageRoute() {
  const route = refs.imageRouteInputs.find((input) => input.checked)?.value;
  return route === "c" ? "c" : route === "b" ? "b" : "a";
}

function isModelProtocolImageRoute() {
  return getSelectedImageRoute() === "c";
}

function normalizeSizeForSelectedRoute(ratioValue, sizeValue = "auto") {
  return isModelProtocolImageRoute()
    ? normalizeModelProtocolImageSize(sizeValue || "auto")
    : normalizeGenerationSize(ratioValue || DEFAULT_UI_RATIO, sizeValue || "auto");
}

function resolveGenerationSizeForSelectedRoute(ratioOption, sizeValue = "auto") {
  const ratioValue = ratioOption?.value || DEFAULT_UI_RATIO;
  const normalizedSize = normalizeSizeForSelectedRoute(ratioValue, sizeValue || "auto");
  if (isModelProtocolImageRoute()) {
    return normalizedSize;
  }
  return normalizedSize === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioValue) : normalizedSize;
}

function updateGenerationModeStatus() {
  if (!refs.generationModeStatus) return;
  const imageRoute = getSelectedImageRoute();
  const label = getUiImageRouteLabel(imageRoute);
  const statusText = getUiImageRouteStatusText(label);
  refs.generationModeStatus.textContent = label;
  refs.generationModeStatus.dataset.imageRoute = imageRoute;
  refs.generationModeStatus.title = statusText;
  refs.generationModeStatus.setAttribute("aria-label", statusText);
}

function getEndpointControls(imageRoute = "a") {
  if (imageRoute === "b-text") {
    return {
      input: refs.directTextBaseUrlInput,
      select: refs.directTextEndpointPathSelect,
      toggle: refs.directTextBaseUrlFullToggle,
      defaultEndpointPath: API_ENDPOINT_RESPONSES,
       fallbackBaseUrl: state.config?.directTextBaseUrl || state.config?.directBaseUrl || state.config?.baseUrl || "https://api.openai.com/v1",
    };
  }
  if (imageRoute === "b" || imageRoute === "b-image") {
    return {
      input: refs.directBaseUrlInput,
      select: refs.directEndpointPathSelect,
      toggle: refs.directBaseUrlFullToggle,
      defaultEndpointPath: API_ENDPOINT_IMAGE_GENERATIONS,
      fallbackBaseUrl: state.config?.directImageBaseUrl || state.config?.directBaseUrl || state.config?.baseUrl || "https://api.openai.com/v1",
    };
  }
  return {
    input: refs.baseUrlInput,
    select: refs.endpointPathSelect,
    toggle: refs.baseUrlFullToggle,
    defaultEndpointPath: API_ENDPOINT_RESPONSES,
    fallbackBaseUrl: state.config?.baseUrl || "https://api.openai.com/v1",
  };
}
function isEndpointFullUrlMode(imageRoute = "a") { return getEndpointControls(imageRoute).toggle?.getAttribute("aria-pressed") === "true"; }
function normalizeEndpointSelectValue(imageRoute = "a", endpointPath = "", fallbackEndpointPath = "") {
  const normalizedEndpointPath = normalizeApiEndpointPath(endpointPath, fallbackEndpointPath);
  return (imageRoute === "b" || imageRoute === "b-image") && normalizedEndpointPath === API_ENDPOINT_IMAGE_EDITS ? API_ENDPOINT_IMAGE_GENERATIONS : normalizedEndpointPath;
}
function readEndpointFields(imageRoute = "a") {
  const controls = getEndpointControls(imageRoute);
  const endpoint = splitApiEndpointUrl(controls.input?.value || controls.fallbackBaseUrl, {
    fallbackBaseUrl: controls.fallbackBaseUrl,
    fallbackEndpointPath: controls.select?.value || controls.defaultEndpointPath,
  });
  return {
    ...endpoint,
    endpointPath: normalizeEndpointSelectValue(imageRoute, endpoint.endpointPath, controls.defaultEndpointPath),
  };
}
function setEndpointSelectValue(select, endpointPath, fallbackEndpointPath, imageRoute = "a") {
  if (select) select.value = normalizeEndpointSelectValue(imageRoute, endpointPath, fallbackEndpointPath);
}
function syncEndpointInputDisplay(imageRoute = "a", baseUrl = "", endpointPath = "") { const controls = getEndpointControls(imageRoute); const fullMode = isEndpointFullUrlMode(imageRoute); const normalizedEndpointPath = normalizeEndpointSelectValue(imageRoute, endpointPath, controls.defaultEndpointPath); setEndpointSelectValue(controls.select, normalizedEndpointPath, controls.defaultEndpointPath, imageRoute); if (controls.input) { controls.input.value = fullMode ? appendApiEndpointPath(baseUrl || controls.fallbackBaseUrl, normalizedEndpointPath) : baseUrl || controls.fallbackBaseUrl; controls.input.placeholder = fullMode ? appendApiEndpointPath("https://api.openai.com/v1", normalizedEndpointPath) : "https://api.openai.com/v1"; } if (controls.toggle) controls.toggle.textContent = fullMode ? getUiLanguageText("baseUrl") || "基础 URL" : getUiLanguageText("fullUrl") || "完整 URL"; }
function toggleEndpointFullUrlMode(imageRoute = "a") { const controls = getEndpointControls(imageRoute); if (!controls.toggle) return; const endpoint = readEndpointFields(imageRoute); controls.toggle.setAttribute("aria-pressed", String(!isEndpointFullUrlMode(imageRoute))); syncEndpointInputDisplay(imageRoute, endpoint.baseUrl, endpoint.endpointPath); }
function syncEndpointFieldsFromFullUrlModes() { ["a", "b", "b-text"].forEach((imageRoute) => { const endpoint = readEndpointFields(imageRoute); syncEndpointInputDisplay(imageRoute, endpoint.baseUrl, endpoint.endpointPath); }); }
function getProtocolImageGenerationsUrlPreview(baseUrl = refs.protocolBaseUrlInput?.value || "") { const normalizedProtocolEndpoint = splitModelProtocolUrl(String(baseUrl || state.config?.protocolBaseUrl || "https://api.openai.com/v1").trim(), { fallbackBaseUrl: state.config?.protocolBaseUrl || "https://api.openai.com/v1" }); return appendApiEndpointPath(normalizedProtocolEndpoint.baseUrl, API_ENDPOINT_IMAGE_GENERATIONS); }
function syncProtocolEndpointPreview() { if (refs.protocolEndpointPreview) refs.protocolEndpointPreview.textContent = getProtocolImageGenerationsUrlPreview(); }

function getCurrentPrivateConfigRequestPayload() {
  const browserPayload = getBrowserPrivateConfigRequestPayload();
  const routeAEndpoint = readEndpointFields("a");
  const directImageEndpoint = readEndpointFields("b");
  const directTextEndpoint = readEndpointFields("b-text");
  const directImageBaseUrl = directImageEndpoint.baseUrl || browserPayload.directImageBaseUrl || browserPayload.directBaseUrl || state.config?.directImageBaseUrl || state.config?.directBaseUrl || "";
  const directTextBaseUrl = directTextEndpoint.baseUrl || browserPayload.directTextBaseUrl || browserPayload.directBaseUrl || state.config?.directTextBaseUrl || state.config?.directBaseUrl || "";
  const directImageApiKey = refs.directImageApiKeyInput?.value.trim() || browserPayload.directImageApiKey || browserPayload.directApiKey || "";
  const directTextApiKey = refs.directTextApiKeyInput?.value.trim() || browserPayload.directTextApiKey || browserPayload.directApiKey || "";
  const directImageModel = refs.directImageModelInput.value.trim() || browserPayload.directImageModel || state.config?.directImageModel || DEFAULT_DIRECT_IMAGE_MODEL;
  const directTextModel = refs.directResponsesModelInput.value.trim() || browserPayload.directTextModel || browserPayload.directResponsesModel || state.config?.directTextModel || state.config?.directResponsesModel || DEFAULT_DIRECT_RESPONSES_MODEL;
  return {
    imageRoute: getSelectedImageRoute(),
    baseUrl: routeAEndpoint.baseUrl || browserPayload.baseUrl || state.config?.baseUrl || "",
    endpointPath: routeAEndpoint.endpointPath || browserPayload.endpointPath || state.config?.endpointPath || API_ENDPOINT_RESPONSES,
    apiKey: refs.apiKeyInput.value.trim() || browserPayload.apiKey || "",
    responsesModel: refs.responsesModelInput.value.trim() || browserPayload.responsesModel || state.config?.responsesModel || DEFAULT_RESPONSES_MODEL,
    directImageBaseUrl,
    directImageEndpointPath: directImageEndpoint.endpointPath || browserPayload.directImageEndpointPath || browserPayload.directEndpointPath || state.config?.directImageEndpointPath || state.config?.directEndpointPath || API_ENDPOINT_IMAGE_GENERATIONS,
    directImageApiKey,
    directImageModel,
    directTextBaseUrl,
    directTextEndpointPath: directTextEndpoint.endpointPath || browserPayload.directTextEndpointPath || state.config?.directTextEndpointPath || browserPayload.directEndpointPath || state.config?.directEndpointPath || API_ENDPOINT_RESPONSES,
    directTextApiKey,
    directTextModel,
    // Legacy aliases are emitted for older server/runtime versions.
    directBaseUrl: directImageBaseUrl,
    directEndpointPath: directImageEndpoint.endpointPath || API_ENDPOINT_IMAGE_GENERATIONS,
    directApiKey: directImageApiKey,
    directImageModel,
    directResponsesModel: directTextModel,
    protocolBaseUrl: refs.protocolBaseUrlInput.value.trim() || browserPayload.protocolBaseUrl || state.config?.protocolBaseUrl || "",
    protocolApiKey: refs.protocolApiKeyInput.value.trim() || browserPayload.protocolApiKey || "",
    protocolImageModel: refs.protocolImageModelInput.value.trim() || browserPayload.protocolImageModel || state.config?.protocolImageModel || DEFAULT_PROTOCOL_IMAGE_MODEL,
    [GENERATION_START_DELAY_FIELD]: getConfiguredGenerationStartDelayMs(browserPayload),
    [GENERATION_CONCURRENCY_FIELD]: getConfiguredGenerationConcurrency(browserPayload),
  };
}

// A blank input means "use the saved value"; an explicit 0 is a real choice and
// must survive, so the empty check cannot be a falsy check.
function getConfiguredGenerationStartDelayMs(browserPayload = {}) {
  const fallback = normalizeGenerationStartDelayMs(
    browserPayload[GENERATION_START_DELAY_FIELD] ?? state.config?.defaults?.[GENERATION_START_DELAY_FIELD],
  );
  // While generation is in flight the control is locked, so the saved value is
  // authoritative and the field is ignored entirely.
  if (hasPendingGenerationWork()) {
    return fallback;
  }

  return normalizeGenerationStartDelayMs(refs.generationStartDelayInput?.value, fallback);
}

// A blank input means "use the saved value"; out-of-range input is clamped here
// so it never fails native form validation and blocks saving other fields.
function getConfiguredGenerationConcurrency(browserPayload = {}) {
  const fallback = normalizeGenerationConcurrency(
    browserPayload[GENERATION_CONCURRENCY_FIELD] ?? state.config?.defaults?.[GENERATION_CONCURRENCY_FIELD],
  );
  // While generation is in flight the control is locked, so the saved value is
  // authoritative and the field is ignored entirely.
  if (hasPendingGenerationWork()) {
    return fallback;
  }

  return normalizeGenerationConcurrency(refs.generationConcurrencyInput?.value, fallback);
}

function appendCurrentConfigToFormData(formData) { appendBrowserConfigToFormData(formData, undefined, getCurrentPrivateConfigRequestPayload()); return formData; }

function applyQueuedJobConfigSnapshot(job) { if (!job) return job; const payload = getCurrentPrivateConfigRequestPayload(); const { imageRoute, baseUrl, endpointPath, responsesModel, protocolBaseUrl, protocolImageModel } = payload; Object.assign(job, { imageRoute, generationRoute: imageRoute, baseUrl, endpointPath, responsesModel, directImageBaseUrl: payload.directImageBaseUrl, directImageEndpointPath: payload.directImageEndpointPath, directImageModel: payload.directImageModel, directTextBaseUrl: payload.directTextBaseUrl, directTextEndpointPath: payload.directTextEndpointPath, directTextModel: payload.directTextModel, directBaseUrl: payload.directBaseUrl, directEndpointPath: payload.directEndpointPath, directImageModel: payload.directImageModel, directResponsesModel: payload.directResponsesModel, protocolBaseUrl, protocolImageModel }); return job; }

function appendJobConfigToFormData(formData, job) {
  const payload = getCurrentPrivateConfigRequestPayload();
  ["baseUrl", "endpointPath", "responsesModel", "directImageBaseUrl", "directImageEndpointPath", "directImageModel", "directTextBaseUrl", "directTextEndpointPath", "directTextModel", "directBaseUrl", "directEndpointPath", "directResponsesModel", "protocolBaseUrl", "protocolImageModel"].forEach((key) => { if (job?.[key]) payload[key] = job[key]; });
  payload.imageRoute = job?.imageRoute || job?.generationRoute || payload.imageRoute;
  appendBrowserConfigToFormData(formData, undefined, payload); return formData;
}

function syncConfigUi(config) {
  syncEndpointInputDisplay("a", config.baseUrl || "", config.endpointPath || API_ENDPOINT_RESPONSES);
  refs.responsesModelInput.value = config.responsesModel || DEFAULT_RESPONSES_MODEL;
  syncEndpointInputDisplay("b", config.directImageBaseUrl || config.directBaseUrl || config.baseUrl || "", config.directImageEndpointPath || config.directEndpointPath || API_ENDPOINT_IMAGE_GENERATIONS);
  refs.directImageModelInput.value = config.directImageModel || DEFAULT_DIRECT_IMAGE_MODEL;
  syncEndpointInputDisplay("b-text", config.directTextBaseUrl || config.directBaseUrl || config.baseUrl || "", config.directTextEndpointPath || API_ENDPOINT_RESPONSES);
  refs.directResponsesModelInput.value = config.directTextModel || config.directResponsesModel || DEFAULT_DIRECT_RESPONSES_MODEL;
  refs.protocolBaseUrlInput.value = config.protocolBaseUrl || config.baseUrl || "https://api.openai.com/v1";
  refs.protocolImageModelInput.value = config.protocolImageModel || DEFAULT_PROTOCOL_IMAGE_MODEL;
  if (refs.generationStartDelayInput) {
    refs.generationStartDelayInput.value = String(
      normalizeGenerationStartDelayMs(config.defaults?.[GENERATION_START_DELAY_FIELD], DEFAULT_GENERATION_START_DELAY_MS),
    );
  }
  if (refs.generationConcurrencyInput) {
    refs.generationConcurrencyInput.value = String(
      normalizeGenerationConcurrency(config.defaults?.[GENERATION_CONCURRENCY_FIELD], DEFAULT_GENERATION_CONCURRENCY),
    );
  }
  syncProtocolEndpointPreview();
  refs.imageRouteInputs.forEach((input) => {
    input.checked = input.value === (config.imageRoute === "c" ? "c" : config.imageRoute === "b" ? "b" : "a");
  });
  updateGenerationModeStatus();
  const savedKeyLabel = state.uiLanguage === "en" ? "Saved" : "已保存";
  refs.savedKeyMask.textContent = config.apiKeyConfigured ? `${savedKeyLabel} ${config.apiKeyMask || ""}` : getUiLanguageText("notSaved") || "未保存";
  refs.directSavedKeyMask.textContent = (config.directImageApiKeyConfigured || config.directApiKeyConfigured) ? `${savedKeyLabel} ${config.directImageApiKeyMask || config.directApiKeyMask || ""}` : getUiLanguageText("notSaved") || "未保存";
  if (refs.directTextSavedKeyMask) refs.directTextSavedKeyMask.textContent = config.directTextApiKeyConfigured ? `${savedKeyLabel} ${config.directTextApiKeyMask || ""}` : getUiLanguageText("notSaved") || "未保存";
  if (refs.protocolSavedKeyMask) refs.protocolSavedKeyMask.textContent = config.protocolApiKeyConfigured ? `${savedKeyLabel} ${config.protocolApiKeyMask || ""}` : getUiLanguageText("notSaved") || "未保存";
  const activeRouteConfigured = config.imageRoute === "c" ? config.protocolApiKeyConfigured : config.imageRoute === "b" ? (config.directImageApiKeyConfigured || config.directTextApiKeyConfigured || config.directApiKeyConfigured) : config.apiKeyConfigured;
  refs.configStatus.textContent = getUiLanguageText(activeRouteConfigured ? "configSaved" : "configUnsaved");
  configModelPicker.render();
  state.aspectRatios = config.aspectRatios || [];
  const configLimits = config.limits || {};
  state.limits = {
    ...DEFAULT_LIMITS,
    ...configLimits,
    maxCreationReferenceImages: "maxCreationReferenceImages" in configLimits ? configLimits.maxCreationReferenceImages || DEFAULT_LIMITS.maxCreationReferenceImages : DEFAULT_LIMITS.maxCreationReferenceImages,
    maxPortraitPersonReferenceImages:
      "maxPortraitPersonReferenceImages" in configLimits
        ? configLimits.maxPortraitPersonReferenceImages || DEFAULT_LIMITS.maxPortraitPersonReferenceImages
        : DEFAULT_LIMITS.maxPortraitPersonReferenceImages,
    maxPortraitActionReferenceImages:
      "maxPortraitActionReferenceImages" in configLimits
        ? configLimits.maxPortraitActionReferenceImages || DEFAULT_LIMITS.maxPortraitActionReferenceImages
        : DEFAULT_LIMITS.maxPortraitActionReferenceImages,
    maxPortraitAccessoryReferenceImages:
      "maxPortraitAccessoryReferenceImages" in configLimits
        ? configLimits.maxPortraitAccessoryReferenceImages || DEFAULT_LIMITS.maxPortraitAccessoryReferenceImages
        : DEFAULT_LIMITS.maxPortraitAccessoryReferenceImages,
  };
  state.reasoningEfforts = [...(config.reasoningEfforts || DEFAULT_REASONING_EFFORTS)];

  if (!refs.ratioInput.value || !getRatioOption(refs.ratioInput.value)) {
    refs.ratioInput.value = DEFAULT_UI_RATIO;
  }
  if (refs.referenceAnalysisRatioInput) {
    refs.referenceAnalysisRatioInput.value = refs.ratioInput.value || DEFAULT_UI_RATIO;
  }
  if (refs.referenceAnalysisSizeInput) {
    refs.referenceAnalysisSizeInput.value = refs.sizeInput.value || "auto";
  }
  if (refs.imageDecompositionRatioInput && !refs.imageDecompositionRatioInput.value) {
    refs.imageDecompositionRatioInput.value = DEFAULT_UI_RATIO;
  }
  if (refs.imageDecompositionSizeInput && !refs.imageDecompositionSizeInput.value) {
    refs.imageDecompositionSizeInput.value = "auto";
  }
  if (refs.quickBlendRatioInput && !refs.quickBlendRatioInput.value) {
    refs.quickBlendRatioInput.value = DEFAULT_QUICK_BLEND_RATIO;
  }
  if (refs.quickBlendSizeInput && !refs.quickBlendSizeInput.value) {
    refs.quickBlendSizeInput.value = "auto";
  }

  renderRatioGrid();
  syncRatioOrientationSummary();
  renderReferenceAnalysisRatioGrid();
  renderImageDecompositionRatioGrid();
  renderReasoningOptions();
  renderOutputFormatOptions();
  refs.creationOutputFormatInput.value = normalizeOutputFormat(
    refs.creationOutputFormatInput.value || config.defaults?.format || "png",
  );
  renderSizeOptions();
  renderReferenceAnalysisSizeOptions();
  renderImageDecompositionSizeOptions();
  renderCreationRatioOptions();
  renderPortraitRatioOptions();
  syncConnectionState();
  updateGenerateButton();
  renderReferenceGrid();
  renderImageDecompositionView();
  renderQuickBlendView();
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

  state.selectedPreviewKey = "";
}

function setSelectedPreviewKey(key, { attemptIndex = -1 } = {}) {
  state.selectedPreviewKey = key || "";
  // Picking a specific attempt card pins the main preview to that image; any
  // other selection clears the pin so it never leaks onto another item.
  state.selectedPromptAttempt = Number(attemptIndex) >= 0 ? { deckKey: key, attemptIndex: Number(attemptIndex) } : null;
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

function getSelectedFailedDeckItem() {
  const key = state.selectedPreviewKey;
  if (!key || getPromptDeckCardsForKey(key).length === 0) {
    return null;
  }
  return getFilmstripItems().find((entry) => entry.key === key)?.item || null;
}

function getCurrentPreviewItem() {
  const item = getSelectedJob() || getSelectedGalleryItem() || getSelectedFailedDeckItem() || null;
  const pinned = state.selectedPromptAttempt;
  if (!item || !pinned || pinned.deckKey !== state.selectedPreviewKey) {
    return item;
  }

  const previewUrl = getPromptDeckAttemptPreviewUrl(pinned.deckKey, pinned.attemptIndex);
  if (!previewUrl) {
    return item;
  }

  const card = getPromptDeckCardsForKey(pinned.deckKey).find((entry) => entry.attemptIndex === pinned.attemptIndex);
  return {
    ...item,
    imageUrl: previewUrl,
    thumbnailUrl: previewUrl,
    previewUrl,
    unfinishedAttemptPreview: card?.status !== PROMPT_ATTEMPT_STATUS.COMPLETED,
  };
}

function openLightbox(item, navigation = null) {
  if (!item || !getImageUrl(item)) {
    return;
  }

  previewKeyboardNavigation.normalizeLightboxNavigation(item, navigation);
  state.lightboxItem = item;
  resetLightboxViewer();
  syncLightboxItem();
  captureOverlayTrigger("lightbox");
  setLightboxOpen(true);
  focusOverlayTarget(refs.lightboxClose);
  window.requestAnimationFrame(() => syncLightboxImageMetrics());
}

function closeLightbox() {
  state.lightboxItem = null;
  previewKeyboardNavigation.clearLightboxNavigation();
  resetPromptCopyFeedback();
  resetLightboxViewer();
  refs.lightbox.classList.remove("is-style-transfer-comparison");
  renderStyleTransferLightboxComparison(null);
  setLightboxOpen(false);
  restoreOverlayTriggerFocus("lightbox");
}

function renderStyleTransferLightboxComparison(item) {
  if (!refs.lightboxComparison) {
    return;
  }

  refs.lightboxComparison.replaceChildren();
  if (!item?.isStyleTransferComparisonItem) {
    return;
  }

  const images = Array.isArray(item.comparisonImages) ? item.comparisonImages : [];
  images.forEach((comparisonImage) => {
    const imageUrl = String(comparisonImage?.imageUrl || "").trim();
    if (!imageUrl) {
      return;
    }

    const figure = document.createElement("figure");
    figure.className = "lightbox-comparison-figure";
    figure.dataset.comparisonSlot = comparisonImage.slot === "after" ? "after" : "before";
    const image = document.createElement("img");
    image.src = imageUrl;
    image.alt = String(comparisonImage.alt || "风格迁移对比图");
    image.decoding = "async";
    figure.appendChild(image);
    refs.lightboxComparison.appendChild(figure);
  });
}

function syncLightboxItem() {
  if (!state.lightboxItem) {
    clearImageReveal(refs.lightboxImage);
    refs.copyPromptButton.disabled = true;
    refs.lightbox.classList.remove("is-image-only-preview");
    refs.lightbox.classList.remove("is-style-transfer-comparison");
    renderStyleTransferLightboxComparison(null);
    resetPromptCopyFeedback();
    resetLightboxViewer();
    return;
  }

  const shouldResolveLightboxItem = !state.lightboxItem.isCreationRecordItem && !state.lightboxItem.isImageOnlyLightboxItem && !state.lightboxItem.isPreviewLightboxItem;
  const fresh =
    (shouldResolveLightboxItem && state.lightboxItem.filename && state.gallery.find((item) => item.filename === state.lightboxItem.filename)) ||
    (shouldResolveLightboxItem && state.lightboxItem.id && state.jobs.find((job) => job.id === state.lightboxItem.id)) ||
    state.lightboxItem;

  const imageUrl = getImageUrl(fresh);
  state.lightboxItem = fresh;
  refs.lightbox.classList.toggle("is-image-only-preview", Boolean(fresh.isImageOnlyLightboxItem));
  refs.lightbox.classList.toggle("is-style-transfer-comparison", Boolean(fresh.isStyleTransferComparisonItem));
  renderStyleTransferLightboxComparison(fresh);
  refs.lightboxModel.textContent = formatImageModelLabel(fresh.imageModel);
  refs.lightboxTime.textContent = formatTime(fresh.createdAt);
  refs.lightboxId.textContent = `ID: ${getDisplayId(fresh)}`;
  refs.lightboxPrompt.value = getDisplayPrompt(fresh);
  refs.lightboxParams.value = String(fresh.paramsText || "").trim() || buildParameterText(fresh, state.config || {});
  assetWorkspaceController.renderStructuredPrompt(refs.lightboxPrompt.value);
  if (refs.lightboxFilename) refs.lightboxFilename.textContent = fresh.filename || "--";
  if (refs.lightboxRelativePath) refs.lightboxRelativePath.textContent = fresh.relativePath || fresh.filename || "--";
  refs.copyPromptButton.disabled = refs.lightboxPrompt.value.trim().length === 0;
  resetPromptCopyFeedback();
  resetLightboxViewer();
  if (imageUrl) {
    setImageRevealSource(refs.lightboxImage, imageUrl, {
      alt: fresh.filename ? `图片详情 ${fresh.filename}` : "生成图片详情",
      decoding: "async",
    });
  } else {
    clearImageReveal(refs.lightboxImage);
  }
  refs.lightboxAmbient.style.backgroundImage = imageUrl ? `url("${imageUrl}")` : "";
  refs.lightboxDownload.href = imageUrl || "#";
  refs.lightboxDownload.download = fresh.filename || "preview.png";
  if (refs.lightboxImage.complete) {
    syncLightboxImageMetrics();
  }
}

function getJobActivitySize(jobId) {
  return state.jobs.find((job) => job.id === jobId)?.size || "";
}

function getJobActivityRatio(jobId) {
  return state.jobs.find((job) => job.id === jobId)?.ratio || "";
}

function getJobLogChannel(jobOrId) {
  const job = typeof jobOrId === "string" ? state.jobs.find((entry) => entry.id === jobOrId) : jobOrId;
  return normalizeGenerationLogChannel(getGenerationJobMode(job));
}

/* 日志只存在于配置区那一个面板。板块之间靠面板顶部的板块切换保持独立：
   默认跟随当前所在板块，用户显式点过某个板块后以那次选择为准。 */
function getActiveViewLogChannel() {
  if (state.activeView === "studio") {
    return normalizeGenerationLogChannel(getCurrentGenerationQueueMode());
  }
  return GENERATION_LOG_CHANNELS.includes(state.activeView) ? state.activeView : "";
}

function getResolvedGenerationLogChannel() {
  const picked = String(state.generationLogChannel || "").trim();
  if (picked === GENERATION_LOG_ALL_CHANNELS || GENERATION_LOG_CHANNELS.includes(picked)) {
    return picked;
  }
  return getActiveViewLogChannel() || GENERATION_LOG_ALL_CHANNELS;
}

function getGenerationLogTabChannels(activeChannel) {
  /* 只列出有条目的板块，外加当前板块本身，这样刚进入的空板块也能看到自己的空态。 */
  const withEntries = GENERATION_LOG_CHANNELS.filter((channel) => getGenerationLogChannelEntries(state.generationLog, channel).length > 0);
  const scoped = activeChannel === GENERATION_LOG_ALL_CHANNELS ? withEntries : [...new Set([...withEntries, activeChannel])];
  return [GENERATION_LOG_ALL_CHANNELS, ...GENERATION_LOG_CHANNELS.filter((channel) => scoped.includes(channel))];
}

function handleGenerationLogChannelPick(event) {
  const channel = readGenerationLogChannelTabValue(event.target);
  if (!channel) {
    return;
  }
  state.generationLogChannel = channel;
  renderTimeline();
}

function handleGenerationLogGroupToggle(event) {
  const groupId = readGenerationLogGroupToggleId(event.target);
  if (!groupId) {
    return;
  }
  state.generationLogExpandedGroups = toggleGenerationLogGroup(state.generationLogExpandedGroups, groupId);
  renderTimeline();
}

function recordActivity({ channel, key, title, detail, ratio, size, modeLabel, imageUrl, relayUrl, status, at, generationStartedAt, generationCompletedAt }) {
  state.generationLog = upsertGenerationLogEntry(state.generationLog, {
    channel: normalizeGenerationLogChannel(channel), key, title, detail: sanitizeGenerationActivityDetail(detail),
    ratio: formatCompactRatioLabel(ratio), size: formatCompactSizeLabel(size), modeLabel, imageUrl,
    relayUrl: normalizeGenerationLogRelayUrl(relayUrl),
    status, at: at || nowIso(), generationStartedAt, generationCompletedAt,
  });
  writeGenerationLogStore();
  renderTimeline();
}

/* 批量板块一个批次一条组行：子条目按图写入，组行汇总由子条目实时推导。 */
function recordGroupActivity({ channel, groupId, groupLabel, groupUnit, groupItemId, totalCount, title, detail, status, ratio, size, modeLabel, imageUrl, relayUrl, at, generationStartedAt, generationCompletedAt }) {
  if (!String(groupId || "").trim()) {
    return;
  }
  state.generationLog = upsertGenerationLogGroupEntry(state.generationLog, {
    channel: normalizeGenerationLogChannel(channel), groupId, groupLabel, groupUnit, groupItemId, totalCount,
    title, detail: sanitizeGenerationActivityDetail(detail), status, ratio: formatCompactRatioLabel(ratio), size: formatCompactSizeLabel(size),
    modeLabel, imageUrl, relayUrl: normalizeGenerationLogRelayUrl(relayUrl),
    at: at || nowIso(), generationStartedAt, generationCompletedAt,
  });
  writeGenerationLogStore();
  renderTimeline();
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
  applyQueuedJobConfigSnapshot(job);
  recordActivity({
    channel: getJobLogChannel(job),
    key: `${job.id}:task`, title: GENERATION_TASK_STATUS_LABELS.running,
    detail: buildGenerationTaskActivityDetail({ statusStage: "queued", statusText: "等待资源分配" }),
    ratio: job.ratio, size: job.size, modeLabel: formatGenerationActivityModeLabel(job.imageRoute || getSelectedImageRoute()),
    relayUrl: resolveGenerationRelayUrl(job), status: "active", at: job.createdAt,
  });
}

function recordJobTaskActivity(jobId, { title = GENERATION_TASK_STATUS_LABELS.running, detail, imageUrl, relayUrl, status = "active", generationStartedAt, generationCompletedAt }) {
  const job = state.jobs.find((entry) => entry.id === jobId);
  recordActivity({ channel: getJobLogChannel(job || jobId), key: `${jobId}:task`, title, detail, ratio: getJobActivityRatio(jobId), size: getJobActivitySize(jobId), imageUrl, relayUrl: relayUrl || (job ? resolveGenerationRelayUrl(job) : ""), status, at: nowIso(), generationStartedAt: generationStartedAt || job?.generationStartedAt || job?.item?.generationStartedAt || "", generationCompletedAt: generationCompletedAt || job?.generationCompletedAt || job?.item?.generationCompletedAt || "" });
}

function handleActivityStatus(jobId, stage, message) {
  recordJobTaskActivity(jobId, { detail: buildGenerationTaskActivityDetail({ statusStage: stage, statusText: message, fallback: stage === "saving" ? "正在保存到本地图片目录" : "正在生成图片" }) });
}

function handleActivityPartial(jobId) {
  recordJobTaskActivity(jobId, { detail: "已收到中途预览" });
}

function handleActivityFinal(jobId) {
  recordJobTaskActivity(jobId, { detail: "正在写入本地 output" });
}

function handleActivitySuccess(jobId, item) {
  recordJobTaskActivity(jobId, { title: GENERATION_TASK_STATUS_LABELS.completed, detail: "图像已成功生成", imageUrl: getImageUrl(item), relayUrl: buildGenerationActivityRelayUrl(item), status: "done", generationStartedAt: item?.generationStartedAt, generationCompletedAt: item?.generationCompletedAt });
}

/* 失败时任务可能已从 state.jobs 移除，所以中转地址直接从调用点的 job 解析。 */
function handleActivityFailure(job, message, imageUrl = "") {
  const detail = compactErrorMessage(message, "生成请求失败");
  const jobId = typeof job === "string" ? job : job?.id;
  recordJobTaskActivity(jobId, {
    title: GENERATION_TASK_STATUS_LABELS.error, detail: buildGenerationTaskActivityDetail({ status: "error", statusStage: "error", statusText: detail, errorMessage: detail }), status: "error", imageUrl,
    relayUrl: typeof job === "string" ? "" : resolveGenerationRelayUrl(job || {}),
  });
}

function handleActivityCanceled(job) {
  recordActivity({
    channel: getJobLogChannel(job),
    key: `${job.id}:task`,
    title: "已取消",
    detail: buildCanceledGenerationActivityDetail(job),
    ratio: job.ratio,
    size: job.size,
    relayUrl: resolveGenerationRelayUrl(job),
    status: "pending",
    at: nowIso(),
  });
}

function recordGenerationTaskActivity(task) {
  const status = normalizeGenerationTaskStatus(task?.status);
  const rawStatusText =
    status === "error"
      ? compactErrorMessage(task?.errorMessage || task?.statusText, "生成请求失败")
      : String(task?.statusText || "").trim();
  const detail = buildGenerationTaskActivityDetail({ status, statusStage: task?.statusStage || status, statusText: rawStatusText, errorMessage: task?.errorMessage, prompt: task?.prompt });

  recordActivity({
    key: `${task.id}:task`,
    title: GENERATION_TASK_STATUS_LABELS[status],
    detail,
    ratio: formatCompactRatioLabel(task?.ratio),
    size: formatCompactSizeLabel(task?.size),
    channel: getJobLogChannel(task?.id),
    modeLabel: formatGenerationActivityModeLabel(task?.imageRoute), imageUrl: getImageUrl(task?.item), relayUrl: task?.item ? buildGenerationActivityRelayUrl(task.item) : resolveGenerationRelayUrl(task),
    status: GENERATION_TASK_TIMELINE_STATUS[status],
    at: task.updatedAt || task.createdAt,
    generationStartedAt: task?.generationStartedAt || task?.item?.generationStartedAt || "",
    generationCompletedAt: task?.generationCompletedAt || task?.item?.generationCompletedAt || "",
  });
}

function getTimelineItems(channel = GENERATION_LOG_ALL_CHANNELS) {
  const entries = channel === GENERATION_LOG_ALL_CHANNELS
    ? getGenerationLogAllEntries(state.generationLog)
    : getGenerationLogChannelEntries(state.generationLog, channel);
  if (entries.length > 0) {
    return entries;
  }

  /* 某个板块还没有条目时给空态，不要拿别的板块或当前预览来填。 */
  if (channel !== GENERATION_LOG_ALL_CHANNELS) {
    return [];
  }

  const current = getCurrentPreviewItem();
  if (current?.createdAt) {
    return [
      {
        key: "complete:fallback",
        channel: normalizeGenerationLogChannel(current.mode),
        title: GENERATION_TASK_STATUS_LABELS.completed,
        detail: "图像已成功生成",
        ratio: current.ratio || current.json?.aspect_ratio,
        size: current.size,
        imageUrl: getImageUrl(current), modeLabel: formatGenerationActivityModeLabel(current.imageRoute || current.generationRoute), relayUrl: buildGenerationActivityRelayUrl(current),
        status: "done",
        at: current.createdAt,
        generationStartedAt: current.generationStartedAt || "",
        generationCompletedAt: current.generationCompletedAt || "",
      },
    ];
  }

  return [
    {
      key: "running:idle",
      title: GENERATION_TASK_STATUS_LABELS.running,
      detail: getUiLanguageText("timelineWaitingTask") || "等待任务开始",
      status: "pending",
      at: "",
    },
    {
      key: "completed:idle",
      title: GENERATION_TASK_STATUS_LABELS.completed,
      detail: getUiLanguageText("timelineWaitingResult") || "等待生成结果",
      status: "pending",
      at: "",
    },
    {
      key: "error:idle",
      title: GENERATION_TASK_STATUS_LABELS.error,
      detail: getUiLanguageText("timelineNoErrors") || "暂无错误",
      status: "pending",
      at: "",
    },
  ];
}

function isTimelineAtTop() {
  return refs.timelineList.scrollTop <= 4;
}

function getTimelineItemSignature(item) {
  /* 组行的签名要带上子条目状态，否则批次内某张图翻转状态不会计入未读。 */
  const childSignature = (Array.isArray(item.children) ? item.children : []).map((child) => `${child.key}:${child.status}:${child.detail || ""}`).join(",");
  return [item.key, item.channel || "", item.title, item.detail, item.modeLabel || "", item.imageUrl || "", item.relayUrl || "", item.ratio || "", item.size || "", item.status, item.at || "", item.generationStartedAt || "", item.generationCompletedAt || "", childSignature].join("\u001f");
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
  const channel = getResolvedGenerationLogChannel();
  const items = getTimelineItems(channel);
  const isAtTop = isTimelineAtTop();
  const previousScrollTop = refs.timelineList.scrollTop;
  const scrollAnchor = isAtTop ? null : getTimelineScrollAnchor();
  const changedCount = countTimelineChanges(items);

  renderGenerationLogChannelTabs(refs.timelineChannelTabs, {
    channels: getGenerationLogTabChannels(channel),
    activeChannel: channel,
    getChannelLabel: getGenerationLogChannelLabel,
    allLabel: getUiLanguageText("activityLogAllPanels") || "全部板块",
  });
  renderGenerationLogRows(refs.timelineList, {
    entries: items,
    channel,
    expandedGroupIds: state.generationLogExpandedGroups,
    formatTime: formatClock,
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

function createPreviewLoadingShellNodes(variant = "") {
  const loading = createGenerationLoadingShell(document, { active: false });
  loading.shell.classList.add("preview-loading-shell");
  return { shell: loading.shell, loading, state: null };
}

function normalizePreviewGenerationLoadingKey(value) {
  const key = String(value || "").trim();
  if (!key || key.startsWith("job:") || key.startsWith("file:")) {
    return key;
  }
  return makeJobPreviewKey(key);
}

function updatePreviewLoadingShell(nodes, placeholderState) {
  nodes.shell.dataset.stage = String(placeholderState.stage || "generating");
  nodes.shell.dataset.jobs = String(placeholderState.activeJobCount || 1);
  nodes.shell.setAttribute("aria-label", placeholderState.statusText || placeholderState.title || "Generation running");
  updateGenerationLoadingShell(nodes.loading, {
    key: normalizePreviewGenerationLoadingKey(placeholderState.loadingKey || placeholderState.itemId || ""),
    active: true,
    mode: placeholderState.waiting ? GENERATION_LOADING_WAITING_MODE : GENERATION_LOADING_GENERATING_MODE,
    stage: placeholderState.waiting ? "queued" : placeholderState.stage || "",
    /* 主预览空间足够，直接显示该任务的最新状态文本。 */
    showLog: true,
    logText: placeholderState.statusText || "",
  });
  nodes.state = {
    mode: placeholderState.mode,
    stage: placeholderState.stage,
    loadingKey: placeholderState.loadingKey || placeholderState.itemId || "",
  };
}

function renderPreviewPlaceholder(placeholderState) {
  placeholderState = getUiPreviewPlaceholderState(placeholderState);
  refs.previewPlaceholder.className = "preview-placeholder";
  if (placeholderState.mode === "loading") {
    refs.previewPlaceholder.classList.add("preview-placeholder-loading");

    if (
      !previewLoadingShellNodes ||
      !shouldReusePreviewLoadingShell(previewLoadingShellNodes.state || {}, placeholderState)
    ) {
      const previousLoadingShellNodes = previewLoadingShellNodes;
      previewLoadingShellNodes = createPreviewLoadingShellNodes("prompt");
      stopGenerationLoadingShell(previousLoadingShellNodes?.loading, { retainSource: true });
    }

    updatePreviewLoadingShell(previewLoadingShellNodes, placeholderState);

    if (
      refs.previewPlaceholder.firstChild !== previewLoadingShellNodes.shell ||
      refs.previewPlaceholder.childElementCount !== 1
    ) {
      refs.previewPlaceholder.replaceChildren(previewLoadingShellNodes.shell);
    }

    return;
  }

  stopGenerationLoadingShell(previewLoadingShellNodes?.loading);
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
    runningItems: state.jobs,
    maxConcurrentTasks: getMaxParallelJobCount(),
  });

  refs.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;

  if (placeholderState.mode === "idle") {
    refs.previewModel.textContent = "GPT Image 2.0";
    refs.previewTime.textContent = getUiLanguageText("previewWaiting");
    refs.previewId.textContent = "ID: --";
    refs.previewSize.textContent = "--";
    refs.previewPlaceholder.classList.remove("hidden");
    renderPreviewPlaceholder(placeholderState);
    clearImageReveal(refs.previewImage);
    refs.previewDownloadButton.removeAttribute("href");
    refs.previewDownloadButton.removeAttribute("download");
    refs.previewDownloadButton.classList.add("disabled");
    refs.previewAddReferenceButton.setAttribute("aria-disabled", "true");
    refs.previewImage.draggable = false;
    refs.previewImage.removeAttribute("title");
    refs.previewImage.classList.remove("is-dragging");
    refs.previewLightboxButton.disabled = true;
    refs.previewDeleteButton.disabled = true;
    return;
  }

  refs.previewModel.textContent = formatImageModelLabel(item.imageModel);
  refs.previewTime.textContent = formatTime(item.createdAt);
  refs.previewId.textContent = `ID: ${getDisplayId(item)}`;
  refs.previewSize.textContent = formatCanvasLabel(resolveDisplayImageSize(item));

  if (placeholderState.mode === "loading") {
    refs.previewPlaceholder.classList.remove("hidden");
    renderPreviewPlaceholder(placeholderState);
    clearImageReveal(refs.previewImage);
    refs.previewDownloadButton.removeAttribute("href");
    refs.previewDownloadButton.removeAttribute("download");
    refs.previewDownloadButton.classList.add("disabled");
    refs.previewAddReferenceButton.setAttribute("aria-disabled", "true");
    refs.previewImage.draggable = false;
    refs.previewImage.removeAttribute("title");
    refs.previewImage.classList.remove("is-dragging");
    refs.previewLightboxButton.disabled = true;
    refs.previewDeleteButton.disabled = true;
    return;
  }

  refs.previewPlaceholder.classList.add("hidden");
  refs.previewImage.style.transform = `scale(${state.zoom})`;
  setImageRevealSource(refs.previewImage, imageUrl, {
    alt: getDisplayPrompt(item),
    decoding: "async",
    loading: "eager",
  });
  refs.previewDownloadButton.href = imageUrl;
  refs.previewDownloadButton.download = item.filename || "preview.png";
  refs.previewDownloadButton.classList.remove("disabled");
  const canAddPreviewReference = isPromptReferenceWorkflow() && Boolean(imageUrl);
  refs.previewAddReferenceButton.setAttribute("aria-disabled", String(!canAddPreviewReference));
  refs.previewImage.draggable = canAddPreviewReference;
  refs.previewImage.title = canAddPreviewReference ? "拖动到参考图区域即可添加" : "";
  refs.previewLightboxButton.disabled = false;
  refs.previewDeleteButton.disabled = !item.filename;
}

function syncPromptFilmstripBaseline() {
  const sessionFilenames = new Set(state.promptFilmstripSessionFilenames);
  state.promptFilmstripBaselineFilenames = getPromptGenerationGalleryItems(state.gallery)
    .map((item) => String(item?.filename || "").trim())
    .filter((filename) => filename && !sessionFilenames.has(filename))
    .slice(0, PROMPT_FILMSTRIP_INITIAL_HISTORY_LIMIT);
  state.promptFilmstripBaselineCaptured = true;
}

function capturePromptFilmstripBaseline() {
  if (!state.promptFilmstripBaselineCaptured) {
    syncPromptFilmstripBaseline();
  }
}

function registerPromptFilmstripSessionJob(job) {
  const jobId = String(job?.id || "").trim();
  if (jobId && !state.promptFilmstripSessionJobIds.includes(jobId)) {
    state.promptFilmstripSessionJobIds.push(jobId);
  }
}

function recordPromptFilmstripSessionFilename(filename) {
  const normalized = String(filename || "").trim();
  if (!normalized) {
    return;
  }

  state.promptFilmstripSessionFilenames = [
    normalized,
    ...state.promptFilmstripSessionFilenames.filter((candidate) => candidate !== normalized),
  ];
}

function recordPromptFilmstripSessionResult(job, item) {
  const jobId = String(job?.id || "").trim();
  const filename = String(item?.filename || "").trim();
  if (!jobId || !filename || !state.promptFilmstripSessionJobIds.includes(jobId)) {
    return;
  }

  recordPromptFilmstripSessionFilename(filename);
}

function getFilmstripItems() {
  const activeJobs = getStablePreviewLoadingItems(state.jobs).slice(0, PROMPT_FILMSTRIP_JOB_LIMIT).map((job) => ({
    key: makeJobPreviewKey(job.id),
    item: job,
    label: formatFilmstripSizeLabel(job) || job.statusText || formatClock(job.createdAt),
  }));
  const visibleFilenames = new Set([
    ...state.promptFilmstripBaselineFilenames,
    ...state.promptFilmstripSessionFilenames,
  ]);
  const recentGallery = getPromptGenerationGalleryItems(state.gallery)
    .filter((item) => visibleFilenames.has(String(item?.filename || "").trim()))
    .slice(0, PROMPT_FILMSTRIP_MAX_HISTORY_LIMIT)
    .map((item) => ({
    key: makeGalleryPreviewKey(item.filename),
    item,
    label: formatFilmstripSizeLabel(item) || formatClock(item.createdAt),
  }));
  // Failed jobs leave state.jobs, so their preserved attempt cards would vanish
  // with them. Surface those decks as their own entries instead.
  const activeKeys = new Set(activeJobs.map((entry) => entry.key));
  const galleryKeys = new Set(recentGallery.map((entry) => entry.key));
  const failedDecks = getTerminalPromptAttemptDecks(state.promptAttemptDecks)
    .filter((deck) => !activeKeys.has(deck.deckKey) && !galleryKeys.has(deck.deckKey))
    .map((deck) => {
      const cards = deck.attempts.filter((attempt) => attempt.previewUrl);
      const lastCard = cards[cards.length - 1];
      return {
        key: deck.deckKey,
        item: {
          id: deck.deckKey,
          previewUrl: lastCard.previewUrl,
          imageUrl: lastCard.previewUrl,
          thumbnailUrl: lastCard.previewUrl,
          createdAt: deck.updatedAt,
          status: "failed",
          statusText: "未完成",
          unfinishedAttemptPreview: true,
        },
        label: "未完成",
      };
    });
  return [...activeJobs, ...failedDecks, ...recentGallery];
} function getCurrentPreviewNavigationItems() {
  return getFilmstripItems().map((entry) => entry.item).filter((item) => item && getImageUrl(item));
}

function getFilmstripPlaceholderState() {
  if (state.galleryLoading) {
    return {
      kind: "loading",
      label: getUiLanguageText("thumbnailLoading"),
      count: 4,
    };
  }

  if (state.galleryLoadError) {
    return {
      kind: "error",
      label: getUiLanguageText("thumbnailFailed"),
      count: 1,
    };
  }

  return {
    kind: "empty",
    label: getUiLanguageText("thumbnailEmpty"),
    count: 1,
  };
}

function createFilmstripPlaceholderEntry(placeholderState, index) {
  const shell = document.createElement("div");
  shell.className = "filmstrip-entry filmstrip-placeholder-entry";
  shell.dataset.filmstripPlaceholder = placeholderState.kind;

  const ghost = document.createElement("div");
  ghost.className = `filmstrip-ghost filmstrip-placeholder-ghost${placeholderState.kind === "loading" ? " is-loading" : ""}`;
  ghost.setAttribute("aria-hidden", "true");
  shell.appendChild(ghost);

  const label = document.createElement("span");
  label.className = "filmstrip-placeholder-label";
  label.textContent = index === 0 ? placeholderState.label : "";
  shell.appendChild(label);

  return shell;
}

function renderFilmstripPlaceholder() {
  const placeholderState = getFilmstripPlaceholderState();
  const fragment = document.createDocumentFragment();

  for (let index = 0; index < placeholderState.count; index += 1) {
    fragment.appendChild(createFilmstripPlaceholderEntry(placeholderState, index));
  }

  refs.filmstrip.replaceChildren(fragment);
}

function createFilmstripEntry(key) {
  const shell = document.createElement("div");
  shell.className = "filmstrip-entry";
  shell.dataset.filmstripKey = key;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "filmstrip-item";
  button.addEventListener("click", () => {
    setSelectedPreviewKey(key);
  });

  shell.appendChild(button);
  return shell;
}

function syncFilmstripMedia(button, item, key = "") {
  const imageUrl = getThumbnailUrl(item);
  const existingImage = button.querySelector("img");
  const existingGhost = button.querySelector(".filmstrip-ghost");
  const existingLoading = button.querySelector(".generation-loading-shell");

  if (imageUrl) {
    stopGenerationLoadingShell(existingLoading?.__generationLoadingNodes);
    existingLoading?.remove();
    existingGhost?.remove();
    const image = existingImage || document.createElement("img");
    if (image.getAttribute("src") !== imageUrl) {
      image.src = imageUrl;
    }
    image.alt = getDisplayPrompt(item);
    image.loading = "lazy";
    if (!existingImage) {
      existingGhost?.remove();
      button.insertBefore(image, button.firstChild);
    }
    return;
  }

  const isGenerating = Boolean(item?.isRunning || item?.started || ["queued", "uploading", "connecting", "generating", "saving"].includes(item?.statusStage || item?.stage || item?.status));
  if (isGenerating) {
    existingImage?.remove();
    existingGhost?.remove();
    const mode = isWaitingPreviewItem(item) ? GENERATION_LOADING_WAITING_MODE : GENERATION_LOADING_GENERATING_MODE;
    if (existingLoading) {
      updateGenerationLoadingShell(existingLoading.__generationLoadingNodes, { key, active: true, mode, stage: getGenerationLoadingItemStage(item) });
      return;
    }
    button.insertBefore(createGenerationLoadingShell(document, { key, active: true, mode, stage: getGenerationLoadingItemStage(item) }).shell, button.firstChild);
    return;
  }

  stopGenerationLoadingShell(existingLoading?.__generationLoadingNodes);
  existingLoading?.remove();
  existingImage?.remove();

  const ghost = existingGhost || document.createElement("div");
  ghost.className = "filmstrip-ghost";
  ghost.textContent = formatLoadingThumbnailStatusLabel(item);
  if (!existingGhost) {
    existingImage?.remove();
    button.insertBefore(ghost, button.firstChild);
  }
}

function syncFilmstripCancelButton(shell, key, item) {
  const existingCancelButton = shell.querySelector(".filmstrip-cancel");
  const shouldRenderCancelButton = key.startsWith("job:") && isQueuedGenerationJob(item);
  if (!shouldRenderCancelButton) {
    existingCancelButton?.remove();
    return;
  }

  if (existingCancelButton) {
    return;
  }

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

function syncFilmstripEntry(shell, { key, item, label }) {
  const button = shell.querySelector(".filmstrip-item");
  const isSelected = key === state.selectedPreviewKey;
  button.classList.toggle("active", isSelected);
  button.setAttribute("aria-current", isSelected ? "true" : "false");
  shell.classList.toggle("is-selected", isSelected);
  syncFilmstripMedia(button, item, key);

  let caption = button.querySelector("[data-filmstrip-label]");
  if (!caption) {
    caption = document.createElement("span");
    caption.dataset.filmstripLabel = "true";
    button.appendChild(caption);
  }
  caption.textContent = label;

  syncFilmstripSelectedMarker(shell, isSelected, { documentRef: document });
  syncFilmstripCancelButton(shell, key, item);
  syncFilmstripDeck(shell, key);
}

function syncFilmstripDeck(shell, key) {
  const cards = getPromptDeckCardsForKey(key);
  const existingBadge = shell.querySelector(".filmstrip-deck-badge");
  const existingTray = shell.querySelector(".filmstrip-deck-tray");

  // One card is the ordinary case and must look exactly as before.
  if (cards.length < 2) {
    existingBadge?.remove();
    existingTray?.remove();
    shell.classList.remove("has-deck");
    return;
  }

  shell.classList.add("has-deck");
  const expanded = state.expandedPromptDeckKey === key;
  const trayId = `filmstrip-deck-tray-${key.replace(/[^a-zA-Z0-9_-]/g, "-")}`;

  const badge = existingBadge || document.createElement("button");
  if (!existingBadge) {
    badge.type = "button";
    badge.className = "filmstrip-deck-badge";
    badge.addEventListener("click", (event) => {
      event.stopPropagation();
      togglePromptDeckExpanded(key);
    });
    shell.appendChild(badge);
  }
  badge.textContent = `${cards.length}`;
  badge.title = expanded ? "收起生成尝试" : `展开 ${cards.length} 次生成尝试`;
  badge.setAttribute("aria-label", badge.title);
  badge.setAttribute("aria-expanded", String(expanded));
  badge.setAttribute("aria-controls", trayId);

  if (!expanded) {
    existingTray?.remove();
    return;
  }

  const tray = existingTray || document.createElement("div");
  if (!existingTray) {
    tray.className = "filmstrip-deck-tray";
    tray.id = trayId;
    shell.appendChild(tray);
  }
  tray.replaceChildren(...cards.map((card) => createDeckCardNode(key, card)));
}

function createDeckCardNode(deckKey, card) {
  const wrapper = document.createElement("div");
  wrapper.className = "filmstrip-deck-card";
  wrapper.dataset.attemptStatus = card.status;

  const button = document.createElement("button");
  button.type = "button";
  button.className = "filmstrip-deck-card-button";
  const attemptLabel = `尝试 ${card.attemptIndex + 1}`;
  const unfinished = card.status !== PROMPT_ATTEMPT_STATUS.COMPLETED;
  button.setAttribute("aria-label", unfinished ? `${attemptLabel}（未完成）` : attemptLabel);
  button.addEventListener("click", () => {
    setSelectedPreviewKey(deckKey, { attemptIndex: card.attemptIndex });
  });

  const image = document.createElement("img");
  image.src = card.previewUrl;
  image.alt = unfinished ? `${attemptLabel} 未完成预览` : `${attemptLabel} 最终结果`;
  image.loading = "lazy";
  button.appendChild(image);

  const caption = document.createElement("span");
  caption.className = "filmstrip-deck-card-label";
  caption.textContent = unfinished ? `${attemptLabel} · 未完成` : attemptLabel;
  button.appendChild(caption);
  wrapper.appendChild(button);

  if (unfinished) {
    const saveButton = document.createElement("button");
    saveButton.type = "button";
    saveButton.className = "filmstrip-deck-save";
    const alreadySaved = Boolean(card.savedFilename);
    saveButton.textContent = alreadySaved ? "已另存" : "另存";
    saveButton.disabled = alreadySaved;
    saveButton.title = alreadySaved ? "该预览已另存为正式图片" : "把这张未完成预览另存为正式图片";
    saveButton.setAttribute("aria-label", saveButton.title);
    saveButton.addEventListener("click", (event) => {
      event.stopPropagation();
      void savePromptAttemptPreview(deckKey, card.attemptIndex);
    });
    wrapper.appendChild(saveButton);
  }

  return wrapper;
}

function renderFilmstripEntries() {
  const entries = getFilmstripItems();
  const existingEntries = new Map(
    [...refs.filmstrip.querySelectorAll(".filmstrip-entry[data-filmstrip-key]")].map((entry) => [
      entry.dataset.filmstripKey,
      entry,
    ]),
  );
  const nextKeys = new Set(entries.map((entry) => entry.key));
  existingEntries.forEach((shell, key) => {
    if (!nextKeys.has(key)) {
      stopGenerationLoadingShells(shell);
    }
  });
  const fragment = document.createDocumentFragment();

  entries.forEach((entry) => {
    const shell = existingEntries.get(entry.key) || createFilmstripEntry(entry.key);
    syncFilmstripEntry(shell, entry);
    fragment.appendChild(shell);
  });

  refs.filmstrip.replaceChildren(fragment);
}

function renderFilmstrip() {
  const entries = getFilmstripItems();
  if (entries.length === 0) {
    stopGenerationLoadingShells(refs.filmstrip);
    renderFilmstripPlaceholder();
    return;
  }

  renderFilmstripPreservingSelection({
    strip: refs.filmstrip,
    selectedKey: state.selectedPreviewKey,
    getEntryKey: (entry) => entry.dataset?.filmstripKey || "",
    tracker: promptFilmstripRevealTracker,
    render: renderFilmstripEntries,
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
  image.src = getThumbnailUrl(item);
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
    event.preventDefault();
    event.stopPropagation();
    downloadGalleryItem(item, image).catch((error) => {
      showError(error.message);
    });
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

  const promptGalleryItems = getPromptGenerationGalleryItems(state.gallery);

  refs.recentList.innerHTML = "";
  refs.recentEmpty.classList.toggle("hidden", promptGalleryItems.length > 0);

  getRecentGalleryItems(promptGalleryItems).forEach((item) => {
    refs.recentList.appendChild(createRecentOutputItem(item));
  });
}

function createGalleryTile(item) {
  const shell = document.createElement("div");
  shell.className = "gallery-tile-shell";
  const filename = String(item?.filename || "图片").trim();
  const isChecked = state.galleryCheckedFilenames.includes(filename);
  shell.classList.toggle("is-checked", state.gallerySelectionMode && isChecked);

  const button = document.createElement("button");
  button.type = "button";
  button.className = "gallery-tile";
  button.classList.toggle("is-current", state.galleryCurrentFilename === filename);
  button.setAttribute("aria-label", `查看图片 ${filename}`);
  button.setAttribute("aria-current", state.galleryCurrentFilename === filename ? "true" : "false");
  button.addEventListener("click", () => {
    state.galleryCurrentFilename = filename;
    renderGalleryView();
    openLightbox(item, { items: state.gallery });
  });

  const image = document.createElement("img");
  image.src = getThumbnailUrl(item);
  image.alt = filename === "图片" ? "生成图片" : `生成图片 ${filename}`;
  image.loading = "lazy";
  button.appendChild(image);

  const overlay = document.createElement("span");
  overlay.className = "gallery-tile-overlay";
  const name = document.createElement("strong");
  name.textContent = filename;
  const meta = document.createElement("span");
  meta.textContent = [resolveDisplayImageSize(item) || item?.dimensions, formatClock(item?.createdAt)].filter(Boolean).join(" · ");
  overlay.append(name, meta);
  button.appendChild(overlay);

  shell.append(button); if (state.gallerySelectionMode) { const selectLabel = document.createElement("label"); selectLabel.className = "gallery-tile-select"; selectLabel.title = `选择 ${filename}`; const checkbox = document.createElement("input"); checkbox.type = "checkbox"; checkbox.checked = isChecked; checkbox.disabled = state.assetRecordDeletion.busy; checkbox.dataset.gallerySelectFilename = filename; checkbox.setAttribute("aria-label", `选择画廊图片 ${filename}`); selectLabel.appendChild(checkbox); shell.appendChild(selectLabel); }
  return shell;
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

function normalizeArticleRecordColumnPreset(value) {
  const preset = Number(value);
  return ARTICLE_RECORD_COLUMN_PRESETS.includes(preset) ? preset : DEFAULT_ARTICLE_RECORD_COLUMN_PRESET;
}

function getArticleRecordColumnCount() {
  return normalizeArticleRecordColumnPreset(state.articleIllustration.recordColumnPreset);
}

function renderArticleRecordColumnPresetButtons() {
  const columnPreset = getArticleRecordColumnCount();
  state.articleIllustration.recordColumnPreset = columnPreset;
  refs.articleRecordColumnButtons.forEach((button) => {
    const isActive = normalizeArticleRecordColumnPreset(button.dataset.articleRecordColumnPreset) === columnPreset;
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

function renderGalleryFilters(visibleItems, sections, pagination, shouldPaginateHistory, sectionLayouts) {
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
    const layoutText = sectionLayouts.map((layout) => `${layout.columnCount} 列`).join(" / ");
    refs.galleryHelperText.textContent = `${prefix}每页显示 5 个日期，第 ${pagination.page + 1} / ${pagination.totalPages} 页，自动 ${layoutText}，每 2 个日期最多 3 行，当前 ${displayedCount} / ${visibleItems.length} 张。`;
    return;
  }

  refs.galleryHelperText.textContent = `${prefix}按日期分组显示，当前共 ${sections.length} 组，显示 ${visibleItems.length} / ${state.gallery.length} 张。`;
}

function createGallerySection(section, columnCount) {
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
  const layoutMode = getGalleryLayoutModeForWidth(getGalleryLayoutWidth());
  refs.galleryView.dataset.galleryLayout = layoutMode;
  const historyLayouts = shouldPaginateHistory && layoutMode === "desktop" ? getGalleryHistorySectionLayouts(allSections) : [];
  const layoutBySectionKey = new Map(historyLayouts.map((layout) => [layout.key, layout]));
  const sectionLayouts = sections.map((section) => layoutBySectionKey.get(section.key) || ({ key: section.key, columnCount: layoutMode === "mobile" ? 2 : layoutMode === "tablet" ? 4 : getGalleryColumnCount() }));
  refs.galleryColumnSwitch?.classList.toggle("hidden", shouldPaginateHistory);

  refs.gallerySections.innerHTML = "";
  refs.galleryCount.textContent =
    displayedCount === state.gallery.length
      ? `${state.gallery.length} 张`
      : `${displayedCount} / ${state.gallery.length} 张`;
  const visibleFilenames = new Set(visibleItems.map((item) => item.filename));
  const checkedCount = state.galleryCheckedFilenames.filter((filename) => visibleFilenames.has(filename)).length;
  const deleteBlocked = state.galleryLoading || state.assetRecordDeletion.busy;
  refs.gallerySelectionModeButton.disabled = deleteBlocked; refs.gallerySelectionModeButton.setAttribute("aria-pressed", String(state.gallerySelectionMode)); refs.gallerySelectionModeButton.setAttribute("aria-label", state.gallerySelectionMode ? "关闭图片勾选" : "开启图片勾选"); refs.gallerySelectionModeButton.textContent = `勾选图片${checkedCount > 0 ? ` (${checkedCount})` : ""}`;
  refs.refreshGalleryButton.disabled = state.assetRecordDeletion.busy;
  refs.galleryDeleteCurrentButton.disabled = deleteBlocked || !visibleFilenames.has(state.galleryCurrentFilename);
  refs.galleryDeleteSelectedButton.disabled = deleteBlocked || !state.gallerySelectionMode || checkedCount === 0;
  refs.galleryDeleteSelectedButton.textContent = checkedCount > 0 ? `删除选中 (${checkedCount})` : "删除选中";
  if (refs.galleryActionFeedback && refs.galleryActionFeedback.textContent !== state.galleryDeleteFeedback) {
    refs.galleryActionFeedback.textContent = state.galleryDeleteFeedback;
  }
  refs.galleryEmpty.replaceChildren();
  const emptyTitle = document.createElement("strong");
  const emptyCopy = document.createElement("p");
  const emptyAction = document.createElement("a");
  emptyAction.className = "toolbar-button asset-primary-action";
  if (state.galleryLoading) {
    emptyTitle.textContent = "正在加载图片";
    emptyCopy.textContent = "正在读取本地资产，请稍候。";
    emptyAction.classList.add("hidden");
  } else if (state.galleryLoadError) {
    emptyTitle.textContent = "画廊加载失败";
    emptyCopy.textContent = state.galleryLoadError;
    emptyAction.href = "#gallery";
    emptyAction.textContent = "重新加载";
    emptyAction.addEventListener("click", (event) => {
      event.preventDefault();
      loadGallery().catch((error) => showError(error.message));
    });
  } else if (state.gallery.length === 0) {
    emptyTitle.textContent = "暂无图片";
    emptyCopy.textContent = "还没有本地输出。";
    emptyAction.href = "#studio";
    emptyAction.textContent = "前往提示词生图";
  } else if (hasActiveGalleryFilters(filters)) {
    emptyTitle.textContent = "没有匹配的图片";
    emptyCopy.textContent = "调整搜索词或清空筛选后重试。";
    emptyAction.href = "#gallery";
    emptyAction.textContent = "清空筛选";
    emptyAction.addEventListener("click", (event) => {
      event.preventDefault();
      state.galleryControls = { ...DEFAULT_GALLERY_CONTROLS };
      resetGalleryHistoryPage();
      renderGalleryView();
    });
  } else {
    emptyTitle.textContent = "暂无可展示图片";
    emptyCopy.textContent = "刷新画廊后重试。";
    emptyAction.href = "#gallery";
    emptyAction.textContent = "刷新";
    emptyAction.addEventListener("click", (event) => {
      event.preventDefault();
      loadGallery().catch((error) => showError(error.message));
    });
  }
  refs.galleryEmpty.append(emptyTitle, emptyCopy, emptyAction);
  refs.galleryEmpty.classList.toggle("hidden", displayedCount > 0);
  renderGalleryPagination(pagination, shouldPaginateHistory);
  renderGalleryFilters(visibleItems, sections, pagination, shouldPaginateHistory, sectionLayouts);
  renderGalleryColumnPresetButtons();

  sectionLayouts.forEach((layout, index) => {
    refs.gallerySections.appendChild(createGallerySection(sections[index], layout.columnCount));
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

const VIEW_RENDERERS = Object.freeze({
  studio: renderStudio,
  styleTransfer: renderStudio,
  referenceAnalysis() {
    renderReferenceAnalysisGrid();
    renderReferenceAnalysis();
  },
  imageDecomposition: renderImageDecompositionView,
  imageEdit: renderImageEditView,
  quickBlend: renderQuickBlendView,
  articleIllustration: renderArticleIllustrationView,
  articleRecord: renderArticleRecordView,
  creation: renderCreationView,
  creationRecord: renderCreationRecordView,
  portrait: renderPortraitView,
  portraitRecord: renderPortraitRecordView,
  ppt: renderPptView,
  pptRecord: renderPptRecordView,
  gallery: renderGalleryView,
});

function renderActiveView() {
  if (state.activeView === "studio") {
    renderStudio();
    return true;
  }

  const mountedView = getMountedLazyViewModule(state.activeView);
  if (mountedView && typeof mountedView.renderView === "function") {
    return mountedView.renderView({
      renderers: VIEW_RENDERERS,
    });
  }

  return false;
}

function renderAll() {
  const settingsScrollTop = getSettingsFormScrollTop();

  ensureSelectedPreview();
  syncConnectionState();
  updateGenerateButton();
  renderTimeline();
  renderActiveView();
  syncLightboxItem();

  restoreSettingsFormScrollTop(settingsScrollTop);
}

function mergeGalleryItemWithExistingBrowserImage(item) {
  const filename = String(item?.filename || "").trim();
  if (!filename) {
    return item;
  }

  const current = state.gallery.find((entry) => entry.filename === filename);
  const browserImageUrl = isCacheableBrowserImageUrl(current?.imageUrl)
    ? current.imageUrl
    : isCacheableBrowserImageUrl(current?.thumbnailUrl)
      ? current.thumbnailUrl
      : "";
  if (!browserImageUrl) {
    return item;
  }

  const browserThumbnailUrl = isCacheableBrowserImageUrl(current?.thumbnailUrl) ? current.thumbnailUrl : browserImageUrl;
  const serverImageUrl = getServerImageUrl(item) || getServerImageUrl(current);
  const serverThumbnailUrl = getServerThumbnailUrl(item) || getServerThumbnailUrl(current) || serverImageUrl;
  return {
    ...item,
    serverImageUrl,
    serverThumbnailUrl,
    imageUrl: browserImageUrl,
    thumbnailUrl: browserThumbnailUrl,
  };
}

function upsertGalleryItem(item) {
  const imageMergedItem = mergeGalleryItemWithExistingBrowserImage(item);
  const hydratedItem = mergeGalleryItemWithCachedMetadata(imageMergedItem, state.galleryMetadataCache[item?.filename]);
  const next = state.gallery.filter((entry) => entry.filename !== hydratedItem.filename);
  next.unshift(hydratedItem);
  state.gallery = sortGalleryItemsByCreatedAtDesc(next);
  if (hydratedItem.mode === "reference-analysis") {
    storeReferenceAnalysisGenerationItem(hydratedItem);
  }
  if (hydratedItem.mode === "image-decomposition" || hydratedItem.assetKind === "image-decomposition") {
    storeImageDecompositionGenerationItem(hydratedItem);
  }
  if (
    hydratedItem.mode === "image-edit" ||
    hydratedItem.generationMode === "image-edit" ||
    hydratedItem.assetKind === "image-edit"
  ) {
    storeImageEditGenerationItem(hydratedItem);
  }
  if (
    hydratedItem.mode === "quick-blend" ||
    hydratedItem.generationMode === "quick-blend" ||
    hydratedItem.assetKind === "quick-blend"
  ) {
    storeQuickBlendGenerationItem(hydratedItem);
  }
  resetGalleryHistoryPage();
  syncGalleryMetadataCache(state.gallery);
  void cacheBrowserGalleryItem(hydratedItem);
}

function createPromptTemplateId() {
  return `template-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function parsePromptAgentTemplateJson(template, prompt) {
  if (!String(template?.id || "").startsWith("prompt-agent-") || !prompt.startsWith("{")) {
    return null;
  }

  try {
    const parsed = JSON.parse(prompt);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function normalizePromptTemplate(template, index = 0) {
  const rawPrompt = String(template?.prompt || "").trim();
  const parsedPromptJson = parsePromptAgentTemplateJson(template, rawPrompt);
  const prompt = getLegacyPromptAgentTemplatePrompt(template, parsedPromptJson) || rawPrompt;
  if (!prompt) {
    return null;
  }

  return {
    id: String(template?.id || createPromptTemplateId()),
    name: getPromptAgentTemplateDisplayName(template, parsedPromptJson, index),
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

function readDismissedPromptAgentTemplateIds() {
  try {
    const raw = window.localStorage.getItem(PROMPT_TEMPLATE_DISMISSED_HISTORY_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((id) => String(id || "").trim()).filter(Boolean) : []);
  } catch {
    return new Set();
  }
}

function writeDismissedPromptAgentTemplateIds() {
  window.localStorage.setItem(
    PROMPT_TEMPLATE_DISMISSED_HISTORY_KEY,
    JSON.stringify([...state.promptTemplateDismissedHistoryIds]),
  );
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

  const appendPromptTemplateGroup = (templates, label) => {
    if (templates.length === 0) {
      return;
    }

    const group = document.createElement("section");
    group.className = "prompt-template-group";
    if (label) {
      const head = document.createElement("div");
      head.className = "prompt-template-group-head";
      const title = document.createElement("span");
      title.textContent = label;
      const count = document.createElement("span");
      count.className = "prompt-template-group-count";
      count.textContent = `${templates.length} 条`;
      head.append(title, count);
      group.appendChild(head);
    }

    templates.forEach((template) => {
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
      group.appendChild(row);
    });

    refs.promptTemplateList.appendChild(group);
  };

  const historyTemplates = state.promptTemplates.filter((template) => String(template.id || "").startsWith("prompt-agent-"));
  const otherTemplates = state.promptTemplates.filter((template) => !String(template.id || "").startsWith("prompt-agent-"));
  appendPromptTemplateGroup(historyTemplates, historyTemplates.length > 0 ? "长期保留" : "");
  appendPromptTemplateGroup(otherTemplates, historyTemplates.length > 0 ? "其他模板" : "");
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
  if (String(selected.id || "").startsWith("prompt-agent-")) {
    state.promptTemplateDismissedHistoryIds.add(selected.id);
    writeDismissedPromptAgentTemplateIds();
  }
  const next =
    state.selectedPromptTemplateId === selected.id
      ? state.promptTemplates[0] || null
      : getSelectedPromptTemplate() || state.promptTemplates[0] || null;
  state.selectedPromptTemplateId = next?.id || "";
  selectPromptTemplate(state.selectedPromptTemplateId);
  setPromptTemplateFeedback("模板已删除。");
}

function setPromptTemplatePopoverOpen(open) {
  if (open) {
    syncPromptTemplateSettingsEdge();
  }
  refs.promptTemplatePopover.classList.toggle("hidden", !open);
  refs.promptTemplatePopover.setAttribute("aria-hidden", open ? "false" : "true");
  refs.surprisePromptButton.setAttribute("aria-expanded", open ? "true" : "false");

  if (open) {
    setPortraitAccessoryAssetPopoverOpen(false);
    if (!state.selectedPromptTemplateId && state.promptTemplates.length > 0) {
      state.selectedPromptTemplateId = state.promptTemplates[0].id;
    }
    selectPromptTemplate(state.selectedPromptTemplateId);
    refs.promptTemplateTextInput.focus();
    loadPromptAgentHistory().catch((error) => {
      console.warn("load prompt agent history for templates failed", error);
    });
  }
}

function selectRandomPrompt() {
  setPromptTemplatePopoverOpen(true);
}

function formatAppTooltipText(value) {
  return String(value || "")
    .trim()
    .replace(/([。；])[^\S\r\n]*(?=\S)/gu, "$1\n");
}

function restoreAppTooltipDescription(trigger) {
  if (!trigger) {
    return;
  }
  if (appTooltipDescribedBy) {
    trigger.setAttribute("aria-describedby", appTooltipDescribedBy);
  } else {
    trigger.removeAttribute("aria-describedby");
  }
}

function hideAppTooltip() {
  if (!refs.appTooltip) {
    return;
  }
  restoreAppTooltipDescription(appTooltipTrigger);
  appTooltipTrigger = null;
  appTooltipDescribedBy = "";
  refs.appTooltip.classList.remove("is-visible");
  if (typeof refs.appTooltip.hidePopover === "function" && refs.appTooltip.matches(":popover-open")) {
    refs.appTooltip.hidePopover();
  }
}

function positionAppTooltip(trigger) {
  const triggerRect = trigger.getBoundingClientRect();
  const tooltipRect = refs.appTooltip.getBoundingClientRect();
  const viewport = window.visualViewport;
  const viewportLeft = viewport?.offsetLeft || 0;
  const viewportTop = viewport?.offsetTop || 0;
  const viewportWidth = viewport?.width || window.innerWidth;
  const viewportHeight = viewport?.height || window.innerHeight;
  const safeInset = 12;
  const gap = 8;
  const leftBoundary = viewportLeft + safeInset;
  const rightBoundary = viewportLeft + viewportWidth - safeInset;
  const topBoundary = viewportTop + safeInset;
  const bottomBoundary = viewportTop + viewportHeight - safeInset;
  const centeredLeft = triggerRect.left + triggerRect.width / 2 - tooltipRect.width / 2;
  const left = Math.min(rightBoundary - tooltipRect.width, Math.max(leftBoundary, centeredLeft));
  const topAbove = triggerRect.top - tooltipRect.height - gap;
  const topBelow = triggerRect.bottom + gap;
  const top = topAbove >= topBoundary
    ? topAbove
    : Math.min(bottomBoundary - tooltipRect.height, Math.max(topBoundary, topBelow));

  refs.appTooltip.style.left = `${Math.round(left)}px`;
  refs.appTooltip.style.top = `${Math.round(top)}px`;
}

function showAppTooltip(trigger) {
  if (!refs.appTooltip || !trigger) {
    return;
  }
  const text = formatAppTooltipText(trigger.dataset.tooltip);
  if (!text) {
    return;
  }
  if (appTooltipTrigger !== trigger) {
    hideAppTooltip();
    appTooltipTrigger = trigger;
    appTooltipDescribedBy = trigger.getAttribute("aria-describedby") || "";
  }
  refs.appTooltip.textContent = text;
  trigger.setAttribute("aria-describedby", [appTooltipDescribedBy, refs.appTooltip.id].filter(Boolean).join(" "));
  if (typeof refs.appTooltip.showPopover === "function" && !refs.appTooltip.matches(":popover-open")) {
    refs.appTooltip.showPopover();
  }
  refs.appTooltip.classList.add("is-visible");
  positionAppTooltip(trigger);
}

function bindAppTooltips() {
  if (!refs.appTooltip) {
    return;
  }
  document.addEventListener("pointerover", (event) => {
    const trigger = event.target.closest?.(APP_TOOLTIP_TRIGGER_SELECTOR);
    if (!trigger || trigger.contains(event.relatedTarget)) {
      return;
    }
    showAppTooltip(trigger);
  });
  document.addEventListener("pointerout", (event) => {
    if (!appTooltipTrigger || appTooltipTrigger !== event.target.closest?.(APP_TOOLTIP_TRIGGER_SELECTOR) || appTooltipTrigger.contains(event.relatedTarget)) {
      return;
    }
    hideAppTooltip();
  });
  document.addEventListener("focusin", (event) => {
    const trigger = event.target.closest?.(APP_TOOLTIP_TRIGGER_SELECTOR);
    if (trigger) {
      showAppTooltip(trigger);
    }
  });
  document.addEventListener("focusout", (event) => {
    if (appTooltipTrigger && appTooltipTrigger === event.target.closest?.(APP_TOOLTIP_TRIGGER_SELECTOR)) {
      hideAppTooltip();
    }
  });
  document.addEventListener("pointerdown", hideAppTooltip, true);
  document.addEventListener("scroll", hideAppTooltip, true);
  window.addEventListener("resize", hideAppTooltip);
  window.visualViewport?.addEventListener("resize", hideAppTooltip);
  window.visualViewport?.addEventListener("scroll", hideAppTooltip);
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

function attachChunkedImageToSavedItem(item, finalImageChunks, fallbackDataUrl = "") {
  if (!item) {
    return item;
  }

  const entry =
    finalImageChunks.get(String(item.filename || "")) ||
    [...finalImageChunks.values()].find((candidate) => candidate.dataUrl);

  const dataUrl = entry?.dataUrl || (isCacheableBrowserImageUrl(fallbackDataUrl) ? fallbackDataUrl : "");
  if (!dataUrl) {
    return item;
  }

  const serverImageUrl = getServerImageUrl(item);
  const serverThumbnailUrl = getServerThumbnailUrl(item) || serverImageUrl;

  return {
    ...item,
    serverImageUrl,
    serverThumbnailUrl,
    imageUrl: dataUrl,
    thumbnailUrl: dataUrl,
  };
}

function applyServerImageToGalleryItem(item) {
  const filename = String(item?.filename || "").trim();
  const serverImageUrl = getServerImageUrl(item);
  if (!filename || !serverImageUrl) {
    return;
  }

  const serverThumbnailUrl = getServerThumbnailUrl(item) || serverImageUrl;
  const current = state.gallery.find((entry) => entry.filename === filename) || {};
  const browserImageUrl = isCacheableBrowserImageUrl(current.imageUrl)
    ? current.imageUrl
    : isCacheableBrowserImageUrl(current.thumbnailUrl)
      ? current.thumbnailUrl
      : "";
  const browserThumbnailUrl = isCacheableBrowserImageUrl(current.thumbnailUrl) ? current.thumbnailUrl : browserImageUrl;
  const mergedItem = mergeGalleryItemWithCachedMetadata(
    {
      ...current,
      ...item,
      imageUrl: browserImageUrl || serverImageUrl,
      thumbnailUrl: browserThumbnailUrl || serverThumbnailUrl,
      serverImageUrl,
      serverThumbnailUrl,
    },
    state.galleryMetadataCache[filename],
  );
  const next = state.gallery.filter((entry) => entry.filename !== filename);
  next.unshift(mergedItem);
  state.gallery = sortGalleryItemsByCreatedAtDesc(next);
  if (
    mergedItem.mode === "image-edit" ||
    mergedItem.generationMode === "image-edit" ||
    mergedItem.assetKind === "image-edit"
  ) {
    storeImageEditGenerationItem(mergedItem);
  }
  if (
    mergedItem.mode === "quick-blend" ||
    mergedItem.generationMode === "quick-blend" ||
    mergedItem.assetKind === "quick-blend"
  ) {
    storeQuickBlendGenerationItem(mergedItem);
  }
  syncGalleryMetadataCache(state.gallery);
  void cacheBrowserGalleryItem(mergedItem);
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
  pptAnalysis.clear();
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
  state.ppt.editablePptxUrl = "";
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

async function canvasToBlob(canvas, type = "image/png", quality) {
  return await new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob);
      } else {
        reject(new Error("无法导出标注图片。"));
      }
    }, type, quality);
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
  formData.set("exportMode", refs.pptExportModeInput.value);
  formData.set("dynamicPreset", refs.pptDynamicPresetInput.value);
  formData.set("transitionPreset", refs.pptTransitionPresetInput.value);
  formData.set("transitionSpeed", refs.pptTransitionSpeedInput.value);
  formData.set("autoAdvanceSeconds", refs.pptAutoAdvanceInput.value);
  formData.set("editInstruction", instruction);
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("sourceSlideImage", await sourceResponse.blob(), `slide-${slideNumber}-source.png`);
  formData.set("annotatedSlideImage", await buildAnnotatedPptSlideBlob(), `slide-${slideNumber}-annotated.png`);
  appendCurrentConfigToFormData(formData);

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
  formData.set("exportMode", refs.pptExportModeInput.value);
  formData.set("dynamicPreset", refs.pptDynamicPresetInput.value);
  formData.set("transitionPreset", refs.pptTransitionPresetInput.value);
  formData.set("transitionSpeed", refs.pptTransitionSpeedInput.value);
  formData.set("autoAdvanceSeconds", refs.pptAutoAdvanceInput.value);
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  appendCurrentConfigToFormData(formData);
  return formData;
}

function getPptGenerationSnapshot() {
  return { requestConfig: getCurrentPrivateConfigRequestPayload(), stylePreset: refs.pptStylePresetInput.value, exportMode: refs.pptExportModeInput.value, dynamicPreset: refs.pptDynamicPresetInput.value, transitionPreset: refs.pptTransitionPresetInput.value, transitionSpeed: refs.pptTransitionSpeedInput.value, autoAdvanceSeconds: refs.pptAutoAdvanceInput.value, reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh" };
}

function buildPptCompletionRequest(slideNumbers) {
  const snapshot = state.ppt.generationSnapshot || getPptGenerationSnapshot();
  return {
    ...snapshot.requestConfig,
    deckId: state.ppt.deckId,
    outline: state.ppt.outline,
    existingSlides: getCompletedPptSlides(),
    slideNumbers,
    stylePreset: snapshot.stylePreset,
    exportMode: snapshot.exportMode,
    dynamicPreset: snapshot.dynamicPreset,
    transitionPreset: snapshot.transitionPreset,
    transitionSpeed: snapshot.transitionSpeed,
    autoAdvanceSeconds: snapshot.autoAdvanceSeconds,
    reasoningEffort: snapshot.reasoningEffort,
  };
}

async function requestPptGenerationStream() {
  const response = await fetch("/api/ppt/generate", {
    method: "POST",
    body: buildPptFormData(),
  });
  if (!response.ok || !response.body) {
    throw new Error(await readHttpResponseErrorMessage(response, "PPT 生成请求失败"));
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
    throw new Error(await readHttpResponseErrorMessage(response, "PPT 补页请求失败"));
  }
  return response;
}

/* PPT 以 deckId 为批次、页码为子条目，单位是「页」而不是「张」。 */
function recordPptLogEvent({ slideNumber, slideTitle, status, detail, imageUrl } = {}) {
  const deckId = String(state.ppt.deckId || "").trim();
  const normalizedSlideNumber = Number(slideNumber) || 0;
  if (!deckId || !normalizedSlideNumber) {
    return;
  }
  recordBatchLogEvent({
    channel: "ppt",
    groupId: deckId,
    groupLabel: `PPT · ${state.ppt.outline?.title || "未命名演示"}`,
    groupUnit: "页",
    totalCount: Array.isArray(state.ppt.outline?.slides) ? state.ppt.outline.slides.length : state.ppt.slides.length,
    itemId: `slide-${normalizedSlideNumber}`,
    itemTitle: slideTitle || `第 ${normalizedSlideNumber} 页`,
    status,
    detail,
    imageUrl,
  });
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
    (Array.isArray(payload.outline?.slides) ? payload.outline.slides : []).forEach((slide, index) => {
      recordPptLogEvent({
        slideNumber: Number(slide.slideNumber) || index + 1,
        slideTitle: slide.title,
        status: "pending",
        detail: buildGenerationTaskActivityDetail({ statusStage: "queued", statusText: "等待后台生成" }),
      });
    });
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
    recordPptLogEvent({ slideNumber: payload.slideNumber, slideTitle: payload.title, status: "active", detail: "正在生成图片" });
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
    recordPptLogEvent({
      slideNumber: payload.slide?.slideNumber || payload.slideNumber || state.ppt.currentSlideNumber,
      slideTitle: payload.slide?.title,
      status: "done",
      detail: "图像已成功生成",
      imageUrl: payload.slide?.imageUrl || "",
    });
    renderPptView();
    return;
  }

  if (eventName === "slide_failed") {
    markPptSlideFailed(payload.slideNumber || state.ppt.currentSlideNumber, payload.message);
    state.ppt.statusText = "部分页面生成失败";
    const pptFailureDetail = compactErrorMessage(payload.message, "生成请求失败");
    recordPptLogEvent({
      slideNumber: payload.slideNumber || state.ppt.currentSlideNumber,
      status: "error",
      detail: buildGenerationTaskActivityDetail({ status: "error", statusStage: "error", statusText: pptFailureDetail, errorMessage: pptFailureDetail }),
    });
    renderPptView();
    return;
  }

  if (eventName === "deck_saved") {
    const deck = payload.deck;
    state.ppt.pptxUrl = deck?.pptxUrl || "";
    state.ppt.editablePptxUrl = deck?.editablePptxUrl || state.ppt.editablePptxUrl || "";
    state.ppt.statusText = "PPTX 已生成";
    if (deck) {
      state.ppt.decks = [deck, ...state.ppt.decks.filter((entry) => entry.deckId !== deck.deckId)];
    }
    renderPptView();
    return;
  }

  if (eventName === "editable_reconstruction_started" || eventName === "editable_reconstruction_warning") {
    state.ppt.statusText = eventName === "editable_reconstruction_started" ? "正在重建可编辑 PPTX" : compactErrorMessage(payload.message, "可编辑 PPTX 重建降级");
    renderPptView();
    return;
  }

  if (eventName === "editable_deck_saved") {
    state.ppt.editablePptxUrl = payload.editablePptxUrl || payload.deck?.editablePptxUrl || state.ppt.editablePptxUrl || "";
    state.ppt.statusText = "可编辑 PPTX 已生成";
    if (payload.deck) {
      state.ppt.decks = [payload.deck, ...state.ppt.decks.filter((entry) => entry.deckId !== payload.deck.deckId)];
    }
    renderPptView();
    return;
  }

  if (eventName === "complete") {
    const missing = Array.isArray(payload.missingSlideNumbers) ? payload.missingSlideNumbers : getPptMissingSlideNumbers();
    state.ppt.statusText = missing.length > 0 ? `仍有 ${missing.length} 页未完成` : "生成完成";
    if (payload.deck?.pptxUrl) state.ppt.pptxUrl = payload.deck.pptxUrl;
    state.ppt.editablePptxUrl = payload.deck?.editablePptxUrl || state.ppt.editablePptxUrl;
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
  return consumeSseUntilTerminal({ stream: response.body, consumeSse, onEvent: handlePptStreamEvent, missingTerminalMessage: "PPT 生成连接已中断，未收到完成事件。" });
}

async function startPptGeneration(event) {
  event.preventDefault();
  if (state.ppt.generating) {
    return;
  }
  clearError();
  setPptFeedback("");

  if (!pptAnalysis.hasInput()) {
    setPptFeedback("请先上传文档、输入文本或输入主题。", "error");
    return;
  }

  state.ppt.generationSnapshot = getPptGenerationSnapshot();
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

const CREATION_ITEM_STATUS_LABELS = {
  idle: "等待开始",
  queued: "排队中",
  generating: "生成中",
  completed: "已完成",
  failed: "生成失败",
  partial_failed: "部分失败",
  planning: "待开始",
};

const CREATION_PREVIEW_SLOTS = "1-hero|hero|首图成交主视觉|主商品占主视觉，合并除尺寸外的可靠信息并用目标语言电商排版，周围保留多个小圆框展示工具、穿搭或使用场景;2-benefit|benefit|目标人群共鸣图|锁定一个目标买家和熟悉的需求或犹豫瞬间，让商品成为有共情的选择，不重复卖点列表;3-scene|scene|适用多场景图|用 2-4 个真实适用场景展示产品价值，带宣传片式层次和购买代入感;4-multi-angle|multi-angle|多角度产品展示图|3-4 个清晰视角展示形态、结构、厚度和表面，不堆营销字;5-atmosphere|atmosphere|冲动下单氛围图|把商品融入有动作、有目标人群、有情绪触发的决定性使用或拥有瞬间，而不是平淡陈列;6-product-detail|product-detail|产品细节特写图|用微距、局部和指向标注证明材质、结构、做工或关键部位;7-brand-story|brand-story|品牌质感/礼品价值图|做成多场景用途与风格拼贴，展示多种真实使用场景和底部使用方式小图标;8-size-capacity-fit|size-capacity-fit|尺寸容量适配图|用准确尺寸、容量、比例和适配参照降低买错风险;9-effect-comparison|effect-comparison|功能效果渲染图|以一个清晰完整的商品主体为核心覆盖所有可靠功能；同屏不清晰时使用连续无损场景拼接，不做对比或遗漏;10-spec-table|spec-table|参数规格图|用清晰参数表呈现型号、尺寸、单位和关键规格，便于快速核对;11-craft-process|craft-process|品质工艺证明图|把工艺、材料处理、装配或检测事实转成质量证据;12-accessory-gift|accessory-gift|到手清单/配件图|完整展示到手包含物、数量、包装和配件，减少到货不确定;13-series-showcase|series-showcase|多款式/SKU选择图|只展示已提供的颜色、款式、尺码、套装或 SKU，帮助快速选择;14-ingredient-material|ingredient-material|材质成分解析图|用材质、成分、结构或组件解释为什么值得信任或偏好;15-after-sales|after-sales|痛点图|用真实使用困扰、解决路径和结果变化，让买家知道它具体替我解决什么问题;16-usage-suggestion|usage-suggestion|卖点图|用 3-5 个核心卖点连接功能证据和买后收益，让买家知道买它能获得什么好处;17-human-handheld|human-handheld|真人手持展示图|真人出镜，手持、举到镜头前或用鱼线悬挂展示商品，让尺度、细节和真实使用感更直观;18-human-wearable|human-wearable|真人穿戴场景图|真人穿着、背着、提着或佩戴商品，在真实场景里展示版型、比例、背负关系和生活代入感".split(";").map((entry) => { const [itemId, role, title, brief] = entry.split("|"); return { itemId, role, title, brief }; });

const CREATION_SCENARIO_LABELS = { standard: "标准电商", "detail-page": "详情页转化", "social-seeding": "社媒种草", launch: "新品发布", promotion: "活动促销", livestream: "直播电商", "gift-guide": "礼品推荐", "marketplace-search": "平台搜索", "brand-story": "品牌故事" };
const CREATION_VISUAL_LANGUAGE_LABELS = { "classic-commercial": "经典商业摄影", "premium-studio": "高端棚拍", "clean-marketplace": "平台清爽白底", "lifestyle-editorial": "生活方式杂志", "social-ugc": "社媒实拍", "detail-infographic": "详情页信息图", "macro-material": "微距材质", "outdoor-context": "户外场景", "minimal-luxury": "极简奢华", "bold-campaign": "活动海报", "warm-handcrafted": "手作温度" };
const CREATION_PLATFORM_POLICY_MODULE_URL = "/lib/creation-platform-policies.mjs?v=20260711-platform-policy-1";
const CREATION_PLATFORM_RESOLVER_MODULE_URL = "/lib/creation-platform-resolver.mjs?v=20260711-platform-policy-1";
const CREATION_PLATFORM_FORM_DATA_FIELDS = [
  "platformSetOverrides",
  "platformItemOverrides",
  "platformEvidence",
  "categorySignals",
  "platformReferenceCoverage",
];
const CREATION_PLATFORM_EVIDENCE_FIELDS = [
  "dimensions",
  "materials",
  "packageContents",
  "performance",
  "specifications",
  "craft",
  "condition",
  "defects",
  "skuVariants",
];
const FALLBACK_CREATION_PLATFORM_OPTIONS = [
  { value: "universal", label: "通用电商", defaultRatio: "1:1", recommendedImageCount: 18, resolutionTier: "1K", targetLanguage: "en", promptInstruction: "Use a platform-neutral ecommerce gallery strategy." },
];
const CREATION_DIMENSION_UNIT_MODE_LABELS = { metric: "公制", imperial: "英制", both: "公制和英制" };
const DEFAULT_CREATION_SKU_GENERATION_RULE = "color-name-under-subject";
const CREATION_SKU_GENERATION_RULE_LABELS = { "color-name-under-subject": "显示颜色", none: "无", "package-list": "显示清单", dimensions: "显示尺寸", "package-list-dimensions": "显示清单和尺寸" };

const CREATION_CATEGORY_TEMPLATE_MODULE_URL = "/lib/creation-category-templates.mjs?v=20260509-category-search-2";
const CREATION_BASE_INDUSTRY_TEMPLATE_OPTIONS = [
  { value: "general", label: "通用电商", categoryPath: "", rolePreset: [] },
  { value: "apparel", label: "服饰鞋包", categoryPath: "", rolePreset: ["hero", "human-wearable", "scene", "product-detail", "size-capacity-fit", "benefit", "series-showcase", "after-sales"] },
  { value: "beauty", label: "美妆个护", categoryPath: "", rolePreset: ["hero", "benefit", "product-detail", "usage-suggestion", "ingredient-material", "atmosphere", "accessory-gift", "after-sales"] },
  { value: "food", label: "食品饮料", categoryPath: "", rolePreset: ["hero", "benefit", "scene", "accessory-gift", "ingredient-material", "atmosphere", "effect-comparison", "after-sales"] },
  { value: "electronics", label: "3C 数码", categoryPath: "", rolePreset: ["hero", "benefit", "spec-table", "usage-suggestion", "product-detail", "effect-comparison", "accessory-gift", "after-sales"] },
  { value: "home", label: "家居生活", categoryPath: "", rolePreset: ["hero", "scene", "size-capacity-fit", "product-detail", "usage-suggestion", "benefit", "effect-comparison", "after-sales"] },
];
const CREATION_INDUSTRY_TEMPLATE_LABELS = Object.fromEntries(
  CREATION_BASE_INDUSTRY_TEMPLATE_OPTIONS.map((template) => [template.value, template.label]),
);
const CREATION_INDUSTRY_TEMPLATE_LEVEL_LABELS = ["一级类目", "二级类目", "三级类目", "四级类目"];
const CREATION_INDUSTRY_TEMPLATE_EMPTY_LABEL = "未选择四级类目";

const CREATION_SCENARIO_ROLE_PRESETS = {
  standard: ["hero", "benefit", "scene", "multi-angle"],
  "detail-page": [
    "hero",
    "benefit",
    "product-detail",
    "size-capacity-fit",
    "effect-comparison",
    "spec-table",
    "accessory-gift",
    "usage-suggestion",
  ],
  "social-seeding": ["hero", "scene", "atmosphere", "benefit", "brand-story", "usage-suggestion"],
  launch: ["hero", "benefit", "atmosphere", "multi-angle", "product-detail", "brand-story", "series-showcase", "accessory-gift"],
  promotion: ["hero", "benefit", "effect-comparison", "after-sales", "accessory-gift", "usage-suggestion"],
  livestream: [
    "hero",
    "benefit",
    "scene",
    "usage-suggestion",
    "product-detail",
    "effect-comparison",
    "accessory-gift",
    "after-sales",
    "spec-table",
    "size-capacity-fit",
  ],
  "gift-guide": ["hero", "accessory-gift", "scene", "benefit", "brand-story", "after-sales"],
  "marketplace-search": ["hero", "benefit", "effect-comparison", "size-capacity-fit", "product-detail", "spec-table"],
  "brand-story": [
    "hero",
    "scene",
    "brand-story",
    "craft-process",
    "ingredient-material",
    "product-detail",
    "atmosphere",
    "series-showcase",
    "usage-suggestion",
    "after-sales",
  ],
};

const CREATION_INDUSTRY_ROLE_PRESETS = {
  general: [],
  apparel: ["hero", "human-wearable", "scene", "product-detail", "size-capacity-fit", "benefit", "series-showcase", "after-sales"],
  beauty: ["hero", "benefit", "product-detail", "usage-suggestion", "ingredient-material", "atmosphere", "accessory-gift", "after-sales"],
  food: ["hero", "benefit", "scene", "accessory-gift", "ingredient-material", "atmosphere", "effect-comparison", "after-sales"],
  electronics: ["hero", "benefit", "spec-table", "usage-suggestion", "product-detail", "effect-comparison", "accessory-gift", "after-sales"],
  home: ["hero", "scene", "size-capacity-fit", "product-detail", "usage-suggestion", "benefit", "effect-comparison", "after-sales"],
};

const CREATION_REFERENCE_ROLE_OPTIONS = [
  { value: "product", label: "商品主体" },
  { value: "reference-product", label: "参考主体" },
  { value: "package", label: "包装清单" },
  { value: "material", label: "材质结构细节" },
  { value: "feature", label: "功能卖点" },
  { value: "dimensions", label: "尺寸规格" },
  { value: "usage", label: "使用说明" },
  { value: "scene", label: "使用场景" },
  { value: "other", label: "其他" },
];

const CREATION_REFERENCE_COVERAGE_ROLE_TARGETS = { usage: ["usage-suggestion"], scene: ["scene", "atmosphere"], material: ["product-detail", "ingredient-material"], feature: ["effect-comparison", "usage-suggestion", "after-sales"], dimensions: ["size-capacity-fit", "spec-table"], package: ["accessory-gift"] };

function getCreationReferenceRoleLabel(role) {
  return CREATION_REFERENCE_ROLE_OPTIONS.find((option) => option.value === role)?.label || CREATION_REFERENCE_ROLE_OPTIONS[0].label;
}

function getCreationSelectedImageCount() {
  const value = Number.parseInt(refs.creationImageCountInput?.value || "", 10);
  if (Number.isFinite(value) && CREATION_IMAGE_COUNT_OPTIONS.includes(value)) return value;
  return normalizeCreationPlatform(getCreationSelectedPlatform().value).recommendedImageCount || 8;
}

function isCreationZeroImageCountMode() { return getCreationSelectedImageCount() === 0; } function isCreationInfographicRebuildRequired() { return isCreationZeroImageCountMode(); }

function createEmptyCreationReferenceAnalysisState() {
  return {
    applied: false,
    categoryManuallyEdited: false, categorySuggestionStale: false, categoryTemplateSuggestion: "",
    collapsed: false,
    dirty: false,
    productNameSuggestion: "",
    result: null,
    running: false,
  };
}

function setCreationSelectValue(select, value, fallback = "") {
  if (!select) {
    return;
  }

  const normalizedValue = String(value || fallback || "");
  const fallbackValue = String(fallback || "");
  const hasOption = Array.from(select.options).some((option) => option.value === normalizedValue);
  select.value = hasOption ? normalizedValue : fallbackValue;
}

let creationCategoryTemplatesModulePromise = null;
let creationPlatformModulesPromise = null;

function getCreationPlatformOptions() {
  const options = state.creationPlatformPoliciesModule?.CREATION_PLATFORM_OPTIONS;
  return Array.isArray(options) && options.length > 0 ? options : FALLBACK_CREATION_PLATFORM_OPTIONS;
}

function renderCreationPlatformOptions() {
  const select = refs.creationPlatformInput;
  if (!select) return;
  const previousValue = String(select.value || "universal").trim();
  const options = getCreationPlatformOptions();
  select.replaceChildren(
    ...options.map((platform) => {
      const option = document.createElement("option");
      option.value = platform.value;
      option.textContent = platform.label;
      return option;
    }),
  );
  select.value = options.some((platform) => platform.value === previousValue) ? previousValue : "universal";
  select.dataset.policyState = state.creationPlatformPoliciesModule ? "ready" : "fallback";
  select.title = state.creationPlatformPoliciesModule ? "" : "平台自动规划模块不可用，当前仅提供通用电商兜底。";
  syncCreationPlatformImageCountOptions();
  if (!state.creation.effectivePlan && Object.keys(state.creation.platformSetOverrides || {}).length === 0) {
    syncCreationAutomaticPlatformControls(select.value);
  }
}

function getCreationPlatformImageCountProfile(platformValue = refs.creationPlatformInput?.value || "universal") {
  const platform = getCreationPlatformOptions().find((entry) => entry.value === platformValue)
    || getCreationPlatformOptions().find((entry) => entry.value === "universal")
    || FALLBACK_CREATION_PLATFORM_OPTIONS[0];
  return state.creationPlatformPoliciesModule?.getCreationPlatformProfile?.(platform.value) || platform;
}

function syncCreationPlatformImageCountOptions({ preferredValue } = {}) {
  const select = refs.creationImageCountInput;
  if (!select) return null;
  const countState = resolveCreationPlatformImageCountState({
    baseOptions: CREATION_IMAGE_COUNT_OPTIONS,
    currentValue: preferredValue ?? select.value,
    profile: getCreationPlatformImageCountProfile(),
  });
  select.replaceChildren(...countState.options.map((count) => {
    const option = document.createElement("option");
    option.value = String(count);
    option.textContent = `${count} 张`;
    return option;
  }));
  select.value = String(countState.value);
  select.dataset.maxImageCount = String(countState.maxImageCount);
  return countState;
}

function setCreationResolutionTierValue(value = "auto") {
  if (!refs.creationSizeInput) return;
  const normalized = String(value || "auto").trim();
  const matchingOption = Array.from(refs.creationSizeInput.options).find((option) => option.value === normalized);
  refs.creationSizeInput.value = matchingOption ? normalized : "auto";
}

function syncCreationAutomaticPlatformControls(platformValue = refs.creationPlatformInput?.value || "universal") {
  const profile = getCreationPlatformImageCountProfile(platformValue);
  setCreationSelectValue(refs.creationTargetLanguageInput, profile.targetLanguage, "en");
  setCreationSelectValue(refs.creationRatioInput, profile.defaultRatio, DEFAULT_UI_RATIO);
  renderCreationSizeOptions();
  setCreationResolutionTierValue("auto");
}

function syncCreationControlsFromEffectivePlan(plan = {}) {
  const overrides = plan.platformSetOverrides || plan.setOverrides || {};
  const profile = plan.platformProfile || getCreationPlatformImageCountProfile(plan.platform || plan.requestedPlatform);
  setCreationSelectValue(refs.creationTargetLanguageInput, overrides.targetLanguage || plan.targetLanguage || profile.targetLanguage, "en");
  setCreationSelectValue(refs.creationRatioInput, overrides.ratio || profile.defaultRatio, DEFAULT_UI_RATIO);
  renderCreationSizeOptions();
  setCreationResolutionTierValue(overrides.resolutionTier || "auto");
}

async function loadCreationPlatformModules() {
  if (state.creationPlatformPoliciesModule && state.creationPlatformResolverModule) {
    return {
      policies: state.creationPlatformPoliciesModule,
      resolver: state.creationPlatformResolverModule,
    };
  }

  if (!creationPlatformModulesPromise) {
    creationPlatformModulesPromise = Promise.all([
      import(CREATION_PLATFORM_POLICY_MODULE_URL),
      import(CREATION_PLATFORM_RESOLVER_MODULE_URL),
    ])
      .then(([policies, resolver]) => {
        if (!Array.isArray(policies.CREATION_PLATFORM_OPTIONS) || policies.CREATION_PLATFORM_OPTIONS.length !== 19) {
          throw new Error("平台策略注册表不完整");
        }
        state.creationPlatformPoliciesModule = policies;
        state.creationPlatformResolverModule = resolver;
        return { policies, resolver };
      })
      .catch((error) => {
        creationPlatformModulesPromise = null;
        state.creationPlatformPoliciesModule = null;
        state.creationPlatformResolverModule = null;
        throw error;
      });
  }
  return creationPlatformModulesPromise;
}

async function ensureCreationPlatformModulesReady({ render = false } = {}) {
  try {
    const modules = await loadCreationPlatformModules();
    if (render) renderCreationPlatformOptions();
    return modules;
  } catch (error) {
    if (render) renderCreationPlatformOptions();
    console.warn("Creation platform automatic planning is unavailable", error);
    return null;
  }
}

function createFrozenCreationPlatformPayload(source = {}) {
  const resolver = state.creationPlatformResolverModule;
  return createCreationPlatformPayloadSnapshot(source, {
    formDataFields: CREATION_PLATFORM_FORM_DATA_FIELDS,
    evidenceFields: CREATION_PLATFORM_EVIDENCE_FIELDS,
    normalizeSetOverrides: resolver?.normalizeCreationPlatformSetOverrides,
    normalizeItemOverrides: resolver?.normalizeCreationPlatformItemOverrides,
  });
}

function setFrozenCreationPlatformPayload(source = {}) {
  const snapshot = createFrozenCreationPlatformPayload(source);
  state.creation.platformPayload = snapshot;
  state.creation.platformSetOverrides = snapshot.values.platformSetOverrides;
  state.creation.platformItemOverrides = snapshot.values.platformItemOverrides;
  return snapshot;
}

function getFrozenCreationPlatformPayload() {
  return state.creation.platformPayload || setFrozenCreationPlatformPayload({
    platformSetOverrides: state.creation.platformSetOverrides,
    platformItemOverrides: state.creation.platformItemOverrides,
  });
}

function appendFrozenCreationPlatformPayload(formData, snapshot = getFrozenCreationPlatformPayload()) {
  CREATION_PLATFORM_FORM_DATA_FIELDS.forEach((field) => {
    formData.set(field, snapshot.serialized[field]);
  });
  return formData;
}

function hasCreationEffectivePlanData(plan = {}) {
  return Boolean(
    plan?.strategyVersion ||
    plan?.platformPolicyId ||
    plan?.effectivePlan?.strategyVersion ||
    (Array.isArray(plan?.items) && plan.items.some((item) => item?.imageType || item?.slotKey)),
  );
}

function normalizeCreationEffectivePlanForBrowser(plan = {}) {
  const source = plan?.effectivePlan && typeof plan.effectivePlan === "object" ? plan.effectivePlan : plan;
  if (!hasCreationEffectivePlanData(source)) return null;
  const payload = createFrozenCreationPlatformPayload(source);
  const items = (Array.isArray(source.items) ? source.items : [])
    .map((item, index) => normalizeCreationItemForView(item, index))
    .sort((left, right) => left.slotIndex - right.slotIndex);
  const warnings = cloneCreationPlanValue(source.warnings ?? source.validation?.warnings, []);
  const errors = cloneCreationPlanValue(source.errors ?? source.validation?.errors, []);
  const isValid = source.validation?.isValid !== false && source.canGenerate !== false && errors.length === 0;
  const planCounts = resolveCreationPlanCounts({ ...source, items });
  return {
    ...cloneCreationPlanValue(source, {}),
    requestedPlatform: String(source.requestedPlatform || source.platform || "universal"),
    platform: String(source.platform || source.platformPolicyId || "universal"),
    platformPolicyId: String(source.platformPolicyId || source.platform || "universal"),
    platformEvidenceLevel: String(source.platformEvidenceLevel || source.evidenceLevel || ""),
    strategyVersion: String(source.strategyVersion || ""),
    strategyVerifiedAt: String(source.strategyVerifiedAt || source.verifiedAt || ""),
    platformSetOverrides: payload.values.platformSetOverrides,
    platformItemOverrides: payload.values.platformItemOverrides,
    platformEvidence: payload.values.platformEvidence,
    categorySignals: payload.values.categorySignals,
    platformReferenceCoverage: payload.values.platformReferenceCoverage,
    validation: { isValid, errors, warnings },
    warnings: warnings,
    errors,
    canGenerate: isValid,
    imageCount: planCounts.imageCount,
    carouselImageCount: planCounts.carouselImageCount,
    skuImageCount: planCounts.skuImageCount,
    infographicRebuildCount: planCounts.infographicRebuildCount,
    totalPlannedItemCount: planCounts.totalPlannedItemCount,
    items,
  };
}

function hydrateCreationEffectivePlan(plan = {}) {
  const normalized = normalizeCreationEffectivePlanForBrowser(plan);
  state.creation.effectivePlan = deepFreezeCreationPlanValue(normalized);
  state.creation.planDirty = !normalized;
  if (normalized) {
    setFrozenCreationPlatformPayload(normalized);
    setCreationImageCountValue(normalized.carouselImageCount);
    syncCreationControlsFromEffectivePlan(normalized);
  }
  return state.creation.effectivePlan;
}

function restoreCreationEffectivePlanFromSet(set = {}) {
  if (!hasCreationEffectivePlanData(set)) {
    state.creation.effectivePlan = null;
    state.creation.planDirty = true;
    setFrozenCreationPlatformPayload({});
    return null;
  }
  return hydrateCreationEffectivePlan(set.effectivePlan || set);
}

function getFrozenCreationEffectivePlan() {
  return state.creation.effectivePlan;
}

function getFallbackCreationIndustryTemplate(value) {
  const normalizedValue = String(value || "").trim();
  const fallback =
    CREATION_BASE_INDUSTRY_TEMPLATE_OPTIONS.find((template) => template.value === normalizedValue) ||
    CREATION_BASE_INDUSTRY_TEMPLATE_OPTIONS[0];

  return {
    ...fallback,
    rolePreset: Array.isArray(fallback.rolePreset) ? [...fallback.rolePreset] : [],
  };
}

function normalizeCreationIndustryTemplate(value) {
  const module = state.creationCategoryTemplatesModule;
  if (module?.normalizeCreationIndustryTemplate) {
    return module.normalizeCreationIndustryTemplate(value);
  }

  const normalizedValue = String(value || "").trim();
  if (normalizedValue.startsWith("category:")) {
    return {
      value: normalizedValue,
      label: normalizedValue.replace(/^category:/, ""),
      categoryPath: "",
      rolePreset: [],
    };
  }

  return getFallbackCreationIndustryTemplate(normalizedValue);
}

function getCreationCategoryTemplateOptions() {
  return state.creationCategoryTemplatesModule?.CREATION_CATEGORY_TEMPLATE_OPTIONS || [];
}

function getCreationIndustryTemplateRolePreset(value) {
  const module = state.creationCategoryTemplatesModule;
  if (module?.getCreationIndustryTemplateRolePreset) {
    return module.getCreationIndustryTemplateRolePreset(value);
  }

  return normalizeCreationIndustryTemplate(value).rolePreset || [];
}

function searchCreationIndustryTemplates(query, options) {
  return state.creationCategoryTemplatesModule?.searchCreationIndustryTemplates?.(query, options) || [];
}

function findCreationIndustryTemplateMatch(text) {
  return state.creationCategoryTemplatesModule?.findCreationIndustryTemplateMatch?.(text) || null;
}

function findCreationIndustryTemplateProductNameMatch(productName) {
  return state.creationCategoryTemplatesModule?.findCreationIndustryTemplateProductNameMatch?.(productName) || null;
}

async function loadCreationCategoryTemplatesModule() {
  if (state.creationCategoryTemplatesModule) {
    return state.creationCategoryTemplatesModule;
  }

  if (!creationCategoryTemplatesModulePromise) {
    creationCategoryTemplatesModulePromise = import(CREATION_CATEGORY_TEMPLATE_MODULE_URL)
      .then((module) => {
        state.creationCategoryTemplatesModule = module;
        return module;
      })
      .catch((error) => {
        creationCategoryTemplatesModulePromise = null;
        throw error;
      });
  }

  return creationCategoryTemplatesModulePromise;
}

async function ensureCreationCategoryTemplatesReady({ render = false } = {}) {
  try {
    const module = await loadCreationCategoryTemplatesModule();
    if (render) {
      renderCreationIndustryTemplateBrowser();
      renderCreationRolePicker();
    }
    return module;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    setCreationFeedback(`类目模板加载失败：${message}`, "error");
    return null;
  }
}

function setCreationIndustryTemplateBrowserPath(source = {}) {
  state.creationIndustryTemplateBrowser = {
    level1: String(source.level1Name || source.level1 || "").trim(),
    level2: String(source.level2Name || source.level2 || "").trim(),
    level3: String(source.level3Name || source.level3 || "").trim(),
  };
}

function sortCreationIndustryTemplateRows(left, right) {
  return (
    (Number(left.level1Order) || 0) - (Number(right.level1Order) || 0) ||
    (Number(left.level2Order) || 0) - (Number(right.level2Order) || 0) ||
    (Number(left.level3Order) || 0) - (Number(right.level3Order) || 0) ||
    (Number(left.level4Order) || 0) - (Number(right.level4Order) || 0) ||
    String(left.categoryPath || left.label || "").localeCompare(String(right.categoryPath || right.label || ""), "zh-Hans-CN")
  );
}

function filterCreationIndustryTemplateRowsForLevel(level, browserPath = state.creationIndustryTemplateBrowser) {
  return getCreationCategoryTemplateOptions().filter((template) => {
    if (level > 1 && template.level1Name !== browserPath.level1) {
      return false;
    }
    if (level > 2 && template.level2Name !== browserPath.level2) {
      return false;
    }
    if (level > 3 && template.level3Name !== browserPath.level3) {
      return false;
    }
    return true;
  }).sort(sortCreationIndustryTemplateRows);
}

function getCreationIndustryTemplateLevelOptions(level, browserPath = state.creationIndustryTemplateBrowser) {
  if (level === 2 && !browserPath.level1) {
    return [];
  }
  if (level === 3 && (!browserPath.level1 || !browserPath.level2)) {
    return [];
  }
  if (level === 4 && (!browserPath.level1 || !browserPath.level2 || !browserPath.level3)) {
    return [];
  }

  const rows = filterCreationIndustryTemplateRowsForLevel(level, browserPath);
  if (level === 4) {
    return rows.map((template) => ({
      count: 1,
      name: template.label,
      order: Number(template.level4Order) || 0,
      template,
    }));
  }

  const nameKey = `level${level}Name`;
  const orderKey = `level${level}Order`;
  const map = new Map();
  rows.forEach((template) => {
    const name = String(template[nameKey] || "").trim();
    if (!name) {
      return;
    }

    const entry = map.get(name) || {
      categoryPath: getCreationIndustryTemplateLevelPath(level, name, browserPath),
      count: 0,
      name,
      order: Number(template[orderKey]) || 0,
    };
    entry.count += 1;
    map.set(name, entry);
  });

  return [...map.values()].sort((left, right) => {
    return left.order - right.order || left.name.localeCompare(right.name, "zh-Hans-CN");
  });
}

function updateCreationIndustryTemplateBrowserLevel(level, name) {
  const key = `level${level}`;
  const nextPath = { ...state.creationIndustryTemplateBrowser, [key]: String(name || "").trim() };
  if (level <= 1) {
    nextPath.level2 = "";
  }
  if (level <= 2) {
    nextPath.level3 = "";
  }
  if (refs.creationIndustryTemplateInput) {
    refs.creationIndustryTemplateInput.value = "general";
  }
  setCreationIndustryTemplateBrowserPath(nextPath);
  if (refs.creationIndustryTemplateSearchInput) {
    refs.creationIndustryTemplateSearchInput.value = "";
  }
  renderCreationIndustryTemplateBrowser();
  setCreationIndustryTemplateBrowserOpen(true);
}

function getCreationIndustryTemplateLevelPath(level, name, browserPath = state.creationIndustryTemplateBrowser) {
  if (level === 2) {
    return [browserPath.level1, name].filter(Boolean).join(" > ");
  }
  if (level === 3) {
    return [browserPath.level1, browserPath.level2, name].filter(Boolean).join(" > ");
  }
  return "";
}

function createCreationIndustryTemplateButton({
  categoryPath = "",
  level = 1,
  name = "",
  selected = false,
  template = null,
} = {}) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "creation-industry-option";
  button.classList.toggle("is-selected", selected);
  const title = document.createElement("strong");
  const meta = document.createElement("small");
  let metaText = categoryPath;

  if (template) {
    button.dataset.creationIndustryTemplateValue = template.value;
    title.textContent = template.label;
    metaText = template.categoryPath || template.code || "";
    meta.textContent = metaText;
    button.title = [template.label, metaText].filter(Boolean).join(" · ");
    button.append(title, meta);
    return button;
  }

  button.dataset.creationIndustryLevel = String(level);
  button.dataset.creationIndustryName = name;
  button.setAttribute("aria-expanded", selected ? "true" : "false");
  title.textContent = name;
  meta.textContent = metaText;
  button.title = [name, metaText].filter(Boolean).join(" · ");
  button.appendChild(title);
  if (metaText) {
    button.appendChild(meta);
  }
  return button;
}

function getCreationIndustryTemplateActiveLevel() {
  const browserPath = state.creationIndustryTemplateBrowser;
  if (!browserPath.level1) {
    return 1;
  }
  if (!browserPath.level2) {
    return 2;
  }
  if (!browserPath.level3) {
    return 3;
  }
  return 4;
}

function focusCreationIndustryTemplateBrowserOnSelectedTemplate() {
  const currentTemplate = getCreationSelectedIndustryTemplate();
  if (!currentTemplate.categoryPath) {
    return;
  }

  setCreationIndustryTemplateBrowserPath(currentTemplate);
  if (refs.creationIndustryTemplateSearchInput) {
    refs.creationIndustryTemplateSearchInput.value = "";
  }
}

function goBackCreationIndustryTemplateLevel() {
  const activeLevel = getCreationIndustryTemplateActiveLevel();
  if (activeLevel <= 1) {
    return;
  }

  const nextPath = { ...state.creationIndustryTemplateBrowser };
  if (activeLevel === 2) {
    nextPath.level1 = "";
    nextPath.level2 = "";
    nextPath.level3 = "";
  } else if (activeLevel === 3) {
    nextPath.level2 = "";
    nextPath.level3 = "";
  } else {
    nextPath.level3 = "";
  }

  if (refs.creationIndustryTemplateInput) {
    refs.creationIndustryTemplateInput.value = "general";
  }
  if (refs.creationIndustryTemplateSearchInput) {
    refs.creationIndustryTemplateSearchInput.value = "";
  }
  setCreationIndustryTemplateBrowserPath(nextPath);
  renderCreationIndustryTemplateBrowser();
  setCreationIndustryTemplateBrowserOpen(true);
}

function getCreationIndustryTemplateDisplayName(currentTemplate = getCreationSelectedIndustryTemplate()) {
  if (currentTemplate.categoryPath) {
    return currentTemplate.label || CREATION_INDUSTRY_TEMPLATE_EMPTY_LABEL;
  }
  if (currentTemplate.value && currentTemplate.value !== "general") {
    return currentTemplate.label || currentTemplate.value;
  }
  return (
    state.creationIndustryTemplateBrowser.level3 ||
    state.creationIndustryTemplateBrowser.level2 ||
    state.creationIndustryTemplateBrowser.level1 ||
    CREATION_INDUSTRY_TEMPLATE_EMPTY_LABEL
  );
}

function setCreationIndustryTemplateBrowserOpen(open) {
  const nextOpen = Boolean(open);
  if (refs.creationIndustryTemplatePopover) {
    refs.creationIndustryTemplatePopover.hidden = !nextOpen;
  }
  refs.creationIndustryTemplateTrigger?.setAttribute("aria-expanded", nextOpen ? "true" : "false");
  refs.creationIndustryTemplateBrowser?.classList.toggle("is-open", nextOpen);
}

function renderCreationIndustryTemplateCurrentLevel(level) {
  const options = getCreationIndustryTemplateLevelOptions(level);
  const currentTemplate = getCreationSelectedIndustryTemplate();
  const selectedName = state.creationIndustryTemplateBrowser[`level${level}`] || "";
  const list = document.createElement("div");
  list.className = "creation-industry-option-list";

  if (!state.creationCategoryTemplatesModule) {
    const loading = document.createElement("p");
    loading.className = "creation-industry-empty";
    loading.textContent = "正在载入类目模板...";
    list.appendChild(loading);
  } else if (options.length === 0) {
    const empty = document.createElement("p");
    empty.className = "creation-industry-empty";
    empty.textContent = "暂无下一级类目。";
    list.appendChild(empty);
  } else {
    options.forEach((option) => {
      const selected = option.template
        ? currentTemplate.value === option.template.value
        : selectedName === option.name;
      list.appendChild(createCreationIndustryTemplateButton({ ...option, level, selected }));
    });
  }

  return {
    count: options.length,
    label: CREATION_INDUSTRY_TEMPLATE_LEVEL_LABELS[level - 1],
    node: list,
  };
}

function renderCreationIndustryTemplateSearchResults(query) {
  const results = searchCreationIndustryTemplates(query, { limit: 48, includeBase: false }).filter(
    (template) => template.categoryPath,
  );
  const list = document.createElement("div");
  list.className = "creation-industry-option-list";
  if (!state.creationCategoryTemplatesModule) {
    const loading = document.createElement("p");
    loading.className = "creation-industry-empty";
    loading.textContent = "正在载入类目模板...";
    list.appendChild(loading);
  } else if (results.length === 0) {
    const empty = document.createElement("p");
    empty.className = "creation-industry-empty";
    empty.textContent = "没有匹配的四级类目。";
    list.appendChild(empty);
  } else {
    results.forEach((template) => {
      list.appendChild(
        createCreationIndustryTemplateButton({
          selected: getCreationSelectedIndustryTemplate().value === template.value,
          template,
        }),
      );
    });
  }

  return {
    count: results.length,
    label: "搜索结果",
    node: list,
  };
}

function renderCreationIndustryTemplateBrowser() {
  if (!refs.creationIndustryTemplateLevels) {
    return;
  }

  const currentTemplate = getCreationSelectedIndustryTemplate();
  if (refs.creationIndustryTemplateCurrent) {
    refs.creationIndustryTemplateCurrent.textContent = getCreationIndustryTemplateDisplayName(currentTemplate);
  }

  const query = String(refs.creationIndustryTemplateSearchInput?.value || "").trim();
  const activeLevel = getCreationIndustryTemplateActiveLevel();
  const viewModel = query
    ? renderCreationIndustryTemplateSearchResults(query)
    : renderCreationIndustryTemplateCurrentLevel(activeLevel);

  refs.creationIndustryTemplateBrowser?.classList.toggle("is-searching", Boolean(query));
  if (refs.creationIndustryTemplateStepLabel) {
    refs.creationIndustryTemplateStepLabel.textContent = viewModel.label;
  }
  if (refs.creationIndustryTemplateBackButton) {
    const canGoBack = !query && activeLevel > 1;
    refs.creationIndustryTemplateBackButton.classList.toggle("hidden", !canGoBack);
    refs.creationIndustryTemplateBackButton.disabled = !canGoBack;
  }
  refs.creationIndustryTemplateLevels.replaceChildren(viewModel.node);
  if (query) {
    setCreationIndustryTemplateBrowserOpen(true);
  }
}

function setCreationIndustryTemplateValue(value, { searchText = "" } = {}) {
  const normalizedTemplate = normalizeCreationIndustryTemplate(value);
  const nextValue = normalizedTemplate.value || "general";
  if (refs.creationIndustryTemplateInput) {
    refs.creationIndustryTemplateInput.value = nextValue;
  }
  if (normalizedTemplate.categoryPath) {
    setCreationIndustryTemplateBrowserPath(normalizedTemplate);
  } else {
    setCreationIndustryTemplateBrowserPath();
  }
  if (refs.creationIndustryTemplateSearchInput) {
    refs.creationIndustryTemplateSearchInput.value = searchText;
  }
  renderCreationIndustryTemplateBrowser();
}

function markCreationIndustryTemplateManuallyEdited() { state.creationReferenceAnalysis.categoryManuallyEdited = true; state.creationReferenceAnalysis.categorySuggestionStale = false; state.creationReferenceAnalysis.categoryTemplateSuggestion = ""; }

function setCreationImageCountValue(count) { syncCreationPlatformImageCountOptions({ preferredValue: Number(count) }); }
function getFiniteCreationImageCount(value) { return value !== undefined && value !== null && String(value).trim() !== "" && Number.isFinite(Number(value)) ? Number(value) : null; }

function getCreationSelectedScenario() {
  const value = "standard";
  return {
    value,
    label: CREATION_SCENARIO_LABELS[value] || value,
  };
}

function getCreationSelectedPlatform() {
  return normalizeCreationPlatform(refs.creationPlatformInput?.value || "universal");
}

function getCreationSelectedIndustryTemplate() {
  return normalizeCreationIndustryTemplate(refs.creationIndustryTemplateInput?.value || "general");
}

function getDefaultCreationRoleIds(count = getCreationSelectedImageCount()) {
  return getCreationRoleIdsForCount(count);
}

function normalizeCreationRoleIds(roles) {
  if (!Array.isArray(roles)) {
    return [];
  }

  const supportedRoles = new Set(CREATION_PREVIEW_SLOTS.map((slot) => slot.role));
  const seen = new Set();
  return roles
    .map((role) => String(role || "").trim())
    .filter((role) => supportedRoles.has(role))
    .filter((role) => {
      if (seen.has(role)) {
        return false;
      }

      seen.add(role);
      return true;
    });
}

function getCreationScenarioRolePreset(scenarioValue = getCreationSelectedScenario().value) {
  return normalizeCreationRoleIds(
    CREATION_SCENARIO_ROLE_PRESETS[scenarioValue] || CREATION_SCENARIO_ROLE_PRESETS.standard,
  );
}

function getCreationIndustryRolePreset(industryValue = getCreationSelectedIndustryTemplate().value) {
  return normalizeCreationRoleIds(getCreationIndustryTemplateRolePreset(industryValue));
}

function getCreationRecommendedRolePreset({
  scenarioValue = getCreationSelectedScenario().value,
  industryValue = getCreationSelectedIndustryTemplate().value,
} = {}) {
  const industryRoles = getCreationIndustryRolePreset(industryValue);
  return industryRoles.length > 0 ? industryRoles : getCreationScenarioRolePreset(scenarioValue);
}

function getCreationRoleIdsForCount(
  count = getCreationSelectedImageCount(),
  scenarioValue = getCreationSelectedScenario().value,
  industryValue = getCreationSelectedIndustryTemplate().value,
) {
  const presetRoles = getCreationRecommendedRolePreset({ scenarioValue, industryValue });
  const presetRoleSet = new Set(presetRoles);
  const fallbackRoles = CREATION_PREVIEW_SLOTS.map((slot) => slot.role).filter((role) => !presetRoleSet.has(role));
  return [...presetRoles, ...fallbackRoles].slice(0, count);
}

function alignCreationRoleIdsToCount(roles, count = getCreationSelectedImageCount()) { const normalizedCount = CREATION_IMAGE_COUNT_OPTIONS.includes(Number(count)) ? Number(count) : getCreationSelectedImageCount(), roleIds = normalizeCreationRoleIds(roles), roleSet = new Set(roleIds); return [...roleIds, ...getCreationRoleIdsForCount(normalizedCount).filter((role) => !roleSet.has(role))].slice(0, normalizedCount); }

function getCreationSelectedRoles() { if (isCreationZeroImageCountMode()) return []; const selectedRoles = normalizeCreationRoleIds(state.creationSelectedRoles); return selectedRoles.length > 0 ? selectedRoles : getDefaultCreationRoleIds(); }

function syncCreationInfographicRebuildRequiredState() { if (!refs.creationInfographicRebuildEnabledInput) return; const required = isCreationInfographicRebuildRequired(); if (required) refs.creationInfographicRebuildEnabledInput.checked = true; refs.creationInfographicRebuildEnabledInput.disabled = required; }
function syncCreationSelectedRolesToCount() {
  const imageCount = getCreationSelectedImageCount();
  const selectedRoles = alignCreationRoleIdsToCount([], imageCount);
  const frozenPayload = getFrozenCreationPlatformPayload();
  state.creationRoleSelectionManuallyEdited = false;
  state.creationSelectedRoles = selectedRoles;
  setFrozenCreationPlatformPayload({
    ...getFrozenCreationEffectivePlan(),
    platformSetOverrides: { ...frozenPayload.values.platformSetOverrides, imageCount },
  });
  syncCreationInfographicRebuildRequiredState();
  resetCreationDraftPreview();
}
function syncCreationSelectedRolesToCurrentCount() { if (getCreationSelectedRoles().length !== getCreationSelectedImageCount()) syncCreationSelectedRolesToCount(); }
function syncCreationSelectedRolesToPreset(selectedRoles) {
  if (state.creationRoleSelectionManuallyEdited) { resetCreationDraftPreview(); return; }
  if (isCreationZeroImageCountMode()) { state.creationSelectedRoles = []; resetCreationDraftPreview(); return; }
  const count = CREATION_IMAGE_COUNT_OPTIONS.includes(selectedRoles.length) ? selectedRoles.length : getCreationSelectedImageCount();
  state.creationSelectedRoles = alignCreationRoleIdsToCount(selectedRoles, count);
  if (refs.creationImageCountInput && CREATION_IMAGE_COUNT_OPTIONS.includes(selectedRoles.length)) {
    refs.creationImageCountInput.value = String(selectedRoles.length);
  }
  resetCreationDraftPreview();
}
function syncCreationSelectedRolesToIndustry() { syncCreationSelectedRolesToPreset(getCreationRecommendedRolePreset()); }
function syncCreationSelectedRolesToReferenceCoverage(analysis = state.creationReferenceAnalysis.result) { if (state.creationRoleSelectionManuallyEdited) { resetCreationDraftPreview(); return; } const selectedRoles = applyCreationReferenceCoverageRolePlan({ roles: getCreationSelectedRoles(), analysis, supportedRoles: CREATION_PREVIEW_SLOTS.map((slot) => slot.role), roleTargets: CREATION_REFERENCE_COVERAGE_ROLE_TARGETS }); if (selectedRoles.length > 0) state.creationSelectedRoles = alignCreationRoleIdsToCount(selectedRoles, getCreationSelectedImageCount()); resetCreationDraftPreview(); }

function toggleCreationSelectedRole(role) {
  state.creationRoleSelectionManuallyEdited = true;
  const selectedRoles = toggleCreationSelectedRoles(role, getCreationSelectedRoles(), CREATION_PREVIEW_SLOTS.map((slot) => slot.role));
  if (!selectedRoles) { renderCreationRolePicker(); return; }
  state.creationSelectedRoles = selectedRoles;
  resetCreationDraftPreview();
}

function getCreationPreviewSlots(count = getCreationSelectedImageCount()) { if (Number(count) === 0) return []; const selectedRoles = normalizeCreationRoleIds(state.creationSelectedRoles); const roleIds = selectedRoles.length > 0 ? selectedRoles : getDefaultCreationRoleIds(count); return roleIds.map((role) => CREATION_PREVIEW_SLOTS.find((slot) => slot.role === role)).filter(Boolean); }

function resetCreationDraftPreview() {
  creationPlanPreviewRequests.invalidate();
  state.creation.planning = false;
  state.creation.draftSet = null;
  state.creation.effectivePlan = null;
  state.creation.planDirty = true;
  if (!state.creation.generating && !state.creation.planning) {
    state.creation.currentSet = null;
  }
  renderCreationView();
}

function getCreationStatusLabel(status) {
  return CREATION_ITEM_STATUS_LABELS[String(status || "")] || "处理中";
}

function getCreationItemStatusLabel(item = {}) {
  const base = getCreationStatusLabel(item.status);
  // A fallback image was never confirmed by the upstream, and a retained preview is
  // an image from an earlier attempt. Both are in the output, so both say so.
  if (item.partialImageFallback === true) {
    return `${base}（中途预览，未完全渲染）`;
  }
  if (item.previewRetained === true) {
    return `${base}（保留中途预览）`;
  }
  return base;
}

function getCreationSellingPoints(value) {
  return String(value || "")
    .split(/[\n,，;；、]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function getCreationSelectedLanguage() {
  const select = refs.creationTargetLanguageInput;
  const option = select?.selectedOptions?.[0];
  return {
    value: select?.value || "en",
    label: option?.textContent || select?.value || "English",
  };
}

function normalizeCreationDimensionUnitMode(value) {
  const normalized = String(value || "").trim();
  return CREATION_DIMENSION_UNIT_MODE_LABELS[normalized] ? normalized : "both";
}

function formatCreationDimensionUnitModeLabel(value) {
  return CREATION_DIMENSION_UNIT_MODE_LABELS[normalizeCreationDimensionUnitMode(value)];
}

function normalizeCreationVisualLanguage(value) { const normalized = String(value || "").trim(); return CREATION_VISUAL_LANGUAGE_LABELS[normalized] ? normalized : "classic-commercial"; }

function formatCreationVisualLanguageLabel(value) { return CREATION_VISUAL_LANGUAGE_LABELS[normalizeCreationVisualLanguage(value)]; }

function normalizeCreationPlatform(value) { const normalized = String(value || "").trim(); const options = getCreationPlatformOptions(); return options.find((platform) => platform.value === normalized) || options.find((platform) => platform.value === "universal") || FALLBACK_CREATION_PLATFORM_OPTIONS[0]; }

function formatCreationPlatformLabel(value) { return normalizeCreationPlatform(value).label; }

function getCreationSelectedDimensionUnitMode() {
  return normalizeCreationDimensionUnitMode(refs.creationDimensionUnitModeInput?.value || "both");
}

function getCreationSelectedSkuGenerationRule() { const value = refs.creationSkuGenerationRuleInput?.value || DEFAULT_CREATION_SKU_GENERATION_RULE; const normalizedValue = CREATION_SKU_GENERATION_RULE_LABELS[value] ? value : DEFAULT_CREATION_SKU_GENERATION_RULE; return { value: normalizedValue, label: CREATION_SKU_GENERATION_RULE_LABELS[normalizedValue] || CREATION_SKU_GENERATION_RULE_LABELS[DEFAULT_CREATION_SKU_GENERATION_RULE] }; }

function setCreationFeedback(message = "", kind = "") {
  if (!refs.creationFeedback) {
    return;
  }

  refs.creationFeedback.textContent = message || "";
  refs.creationFeedback.dataset.state = kind || "";
  state.creation.feedback = message || "";
}

function setCreationRecordFeedback(message = "", kind = "") {
  if (!refs.creationRecordActionFeedback) {
    return;
  }

  refs.creationRecordActionFeedback.textContent = message || "";
  refs.creationRecordActionFeedback.dataset.state = kind || "";
}

function refreshCreationRecordSets() {
  if (state.creation.generating || state.creation.planning || state.creation.recordDeleteBusy || state.creation.recordTemuExportBusy || creationRecordRefreshPromise) {
    return;
  }

  creationRecordRefreshPromise = loadCreationSets()
    .catch((error) => {
      setCreationRecordFeedback(error instanceof Error ? error.message : String(error), "error");
    })
    .finally(() => {
      creationRecordRefreshPromise = null;
      renderCreationRecordView();
    });
}

async function writeTextToClipboard(text, failureMessage = "当前浏览器不支持复制图片路径。") {
  const value = String(text || "");
  if (!value) {
    return;
  }

  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(value);
      return;
    } catch (_error) {
      // Fall through to the legacy copy path used by stricter embedded browsers.
    }
  }

  const activeElement = document.activeElement;
  const textarea = document.createElement("textarea");
  textarea.value = value;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();

  try {
    if (!document.execCommand("copy")) {
      throw new Error("copy command failed");
    }
  } catch (_error) {
    throw new Error(failureMessage);
  } finally {
    textarea.remove();
    activeElement?.focus?.();
  }
}

function setArticleIllustrationFeedback(message = "", kind = "") {
  if (!refs.articleIllustrationFeedback) {
    return;
  }

  refs.articleIllustrationFeedback.textContent = message || "";
  refs.articleIllustrationFeedback.dataset.state = kind || "";
  state.articleIllustration.feedback = message || "";
}

function setArticleRecordFeedback(message = "", kind = "") {
  if (!refs.articleRecordFeedback) {
    return;
  }

  refs.articleRecordFeedback.textContent = message || "";
  refs.articleRecordFeedback.dataset.state = kind || "";
}

function getArticleItemStatusLabel(status) {
  const labels = {
    planned: "待生成",
    queued: "排队中",
    generating: "生成中",
    reference_generating: "参考图生成中",
    in_progress: "部分完成",
    partial_failed: "部分失败",
    completed: "已完成",
    failed: "失败",
  };
  return labels[String(status || "")] || "待生成";
}

function parsePositiveInteger(value, fallback = 0) {
  const number = Number.parseInt(String(value || ""), 10);
  return Number.isFinite(number) && number > 0 ? number : fallback;
}

function formatChineseNumber(value) {
  const number = parsePositiveInteger(value, 0);
  const digits = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (number <= 0) {
    return "";
  }
  if (number < 10) {
    return digits[number];
  }
  if (number === 10) {
    return "十";
  }
  if (number < 20) {
    return `十${digits[number % 10]}`;
  }
  if (number < 100) {
    const tens = Math.floor(number / 10);
    const ones = number % 10;
    return `${digits[tens]}十${ones ? digits[ones] : ""}`;
  }
  return String(number);
}

function normalizeArticleItemForView(item = {}, fallbackIndex = 0) {
  const imageUrl = String(item.imageUrl || item.thumbnailUrl || "");
  return {
    itemId: String(item.itemId || `article-item-${fallbackIndex + 1}`),
    slotIndex: Number(item.slotIndex) || fallbackIndex + 1,
    itemKind: String(item.itemKind || "storyboard"),
    cardId: String(item.cardId || ""),
    title: String(item.title || `插图 ${fallbackIndex + 1}`),
    paragraphIndex: parsePositiveInteger(item.paragraphIndex, 0),
    timelineIndex: parsePositiveInteger(item.timelineIndex, 0),
    narrativeBeat: String(item.narrativeBeat || ""),
    prompt: String(item.prompt || ""),
    originalText: String(item.originalText || ""),
    captionText: String(item.captionText || ""),
    modelTextHint: String(item.modelTextHint || ""),
    referencedCardIds: Array.isArray(item.referencedCardIds) ? item.referencedCardIds.map(String).filter(Boolean) : [],
    emotion: String(item.emotion || ""),
    rhythm: String(item.rhythm || ""),
    status: String(item.status || (imageUrl ? "completed" : "planned")),
    filename: String(item.filename || ""),
    relativePath: String(item.relativePath || ""),
    imageUrl,
    thumbnailUrl: String(item.thumbnailUrl || imageUrl),
    error: String(item.error || ""),
  };
}

function getArticleItemKindSortValue(item) {
  return item?.itemKind === "reference-card" ? 0 : 1;
}

function orderArticleItemsForView(items = []) {
  let storyboardOrdinal = 0;
  return [...items]
    .sort((left, right) => {
      const leftKind = getArticleItemKindSortValue(left);
      const rightKind = getArticleItemKindSortValue(right);
      const leftTimeline = leftKind === 0 ? 0 : left.timelineIndex || left.slotIndex;
      const rightTimeline = rightKind === 0 ? 0 : right.timelineIndex || right.slotIndex;
      const leftParagraph = leftKind === 0 ? 0 : left.paragraphIndex || leftTimeline;
      const rightParagraph = rightKind === 0 ? 0 : right.paragraphIndex || rightTimeline;
      return (
        leftKind - rightKind ||
        leftTimeline - rightTimeline ||
        leftParagraph - rightParagraph ||
        left.slotIndex - right.slotIndex ||
        left.title.localeCompare(right.title) ||
        left.itemId.localeCompare(right.itemId)
      );
    })
    .map((item, index) => {
      if (item.itemKind === "reference-card") {
        return {
          ...item,
          paragraphIndex: 0,
          timelineIndex: 0,
          slotIndex: index + 1,
        };
      }
      storyboardOrdinal += 1;
      return {
        ...item,
        paragraphIndex: item.paragraphIndex || storyboardOrdinal,
        timelineIndex: item.timelineIndex || storyboardOrdinal,
        slotIndex: index + 1,
      };
    });
}

function normalizeArticleSetForView(set = {}) {
  const items = orderArticleItemsForView(
    (Array.isArray(set.items) ? set.items : []).map((item, index) => normalizeArticleItemForView(item, index)),
  );
  return {
    setId: String(set.setId || ""),
    title: String(set.title || "未命名文章"),
    sourceSummary: String(set.sourceSummary || ""),
    contentType: String(set.contentType || "mixed"),
    stylePreset: String(set.stylePreset || DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET),
    styleBible: String(set.styleBible || ""),
    recommendedImageCount: Number(set.recommendedImageCount) || items.length,
    articleBundle: set.articleBundle || null,
    characters: Array.isArray(set.characters) ? set.characters : [],
    scenes: Array.isArray(set.scenes) ? set.scenes : [],
    referenceCards: Array.isArray(set.referenceCards) ? set.referenceCards : [],
    createdAt: String(set.createdAt || nowIso()),
    updatedAt: String(set.updatedAt || set.createdAt || nowIso()),
    status: String(set.status || "planned"),
    relativeDir: String(set.relativeDir || ""),
    items,
  };
}

function createArticleImageOrderBadge(item) {
  const badge = document.createElement("span");
  badge.className = `article-image-order-badge ${item.itemKind === "reference-card" ? "reference" : "storyboard"}`;
  badge.textContent = String(item.slotIndex || 0).padStart(2, "0");
  badge.title = item.itemKind === "reference-card" ? "参考图排序" : "正文插图排序";
  return badge;
}

function getArticleParagraphLabel(item) {
  if (item.itemKind === "reference-card") {
    return "参考图";
  }
  const paragraphIndex = parsePositiveInteger(item.paragraphIndex || item.timelineIndex || item.slotIndex, 0);
  return paragraphIndex ? `第${formatChineseNumber(paragraphIndex)}段` : "正文段落";
}

function getArticleTimelineLabel(item) {
  if (item.itemKind === "reference-card") {
    return "";
  }
  const timelineIndex = parsePositiveInteger(item.timelineIndex || item.paragraphIndex || item.slotIndex, 0);
  return timelineIndex ? `时间线 ${String(timelineIndex).padStart(2, "0")}` : "";
}

function getArticleCardHeadingLabel(item) {
  if (item.itemKind === "reference-card") {
    return `${String(item.slotIndex).padStart(2, "0")} · 参考图`;
  }
  return `${String(item.slotIndex).padStart(2, "0")} · ${getArticleParagraphLabel(item)}`;
}

function appendArticleRecordMetaPill(container, text, variant = "") {
  if (!text) {
    return;
  }
  const pill = document.createElement("span");
  pill.className = `article-record-card-kind ${variant}`.trim();
  pill.textContent = text;
  container.appendChild(pill);
}

function getArticleCurrentSet() {
  return state.articleIllustration.currentSet ? normalizeArticleSetForView(state.articleIllustration.currentSet) : null;
}

function upsertArticleSet(set) {
  const normalized = normalizeArticleSetForView(set);
  if (!normalized.setId) {
    return;
  }

  state.articleIllustration.currentSet = normalized;
  const nextSets = state.articleIllustration.sets.filter((entry) => entry.setId !== normalized.setId);
  nextSets.unshift(normalized);
  state.articleIllustration.sets = nextSets.sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  renderArticleIllustrationView();
  renderArticleRecordView();
}

function updateArticleCurrentItem(itemId, patch = {}) {
  const currentSet = getArticleCurrentSet();
  if (!currentSet) {
    return;
  }

  state.articleIllustration.currentSet = normalizeArticleSetForView({
    ...currentSet,
    updatedAt: nowIso(),
    items: currentSet.items.map((item) => (item.itemId === itemId ? { ...item, ...patch } : item)),
  });
}

function getArticleProgressSummary(set = getArticleCurrentSet()) {
  const items = Array.isArray(set?.items) ? set.items : [];
  const total = items.length || Number(set?.recommendedImageCount) || 0;
  const completed = items.filter((item) => item.status === "completed").length;
  const failed = items.filter((item) => item.status === "failed").length;
  const references = items.filter((item) => item.itemKind === "reference-card");
  const referenceCompleted = references.filter((item) => item.status === "completed").length;
  return { total, completed, failed, references: references.length, referenceCompleted };
}

function formatArticleDisplayText(value, fallback = "未命名文章") {
  const text = String(value || "").trim();
  return text && !/^[?？\s]+$/.test(text) ? text : fallback;
}

function syncArticlePlanEditsFromDom() {
  const currentSet = getArticleCurrentSet();
  if (!currentSet) {
    return null;
  }

  const styleBible = refs.articleIllustrationStyleBibleInput?.value || currentSet.styleBible;
  const nextItems = currentSet.items.map((item) => {
    const selector = `[data-article-item-id="${CSS.escape(item.itemId)}"]`;
    const root = [
      refs.articleIllustrationReferenceList,
      refs.articleIllustrationStoryboardList,
      refs.articleRecordDetail,
    ]
      .filter(Boolean)
      .map((container) => container.querySelector(selector))
      .find(Boolean);
    if (!root) {
      return item;
    }

    return {
      ...item,
      title: root.querySelector("[data-article-item-title]")?.value || item.title,
      prompt: root.querySelector("[data-article-item-prompt]")?.value || item.prompt,
      captionText: root.querySelector("[data-article-item-caption]")?.value || item.captionText,
      modelTextHint: root.querySelector("[data-article-item-text-hint]")?.value || item.modelTextHint,
    };
  });

  state.articleIllustration.currentSet = normalizeArticleSetForView({
    ...currentSet,
    styleBible,
    items: nextItems,
    updatedAt: nowIso(),
  });
  return getArticleCurrentSet();
}

function applyArticleIllustrationFiles(fileList) {
  const files = [...(fileList || [])];
  state.articleIllustration.files.forEach((file) => {
    if (file.previewUrl) {
      URL.revokeObjectURL(file.previewUrl);
    }
  });
  state.articleIllustration.files = files.map((file, index) => ({
    id: `article-source-${Date.now()}-${index}`,
    file,
  }));
  renderArticleIllustrationFiles();
}

function renderArticleIllustrationFiles() {
  if (!refs.articleIllustrationFileList) {
    return;
  }

  refs.articleIllustrationFileList.replaceChildren();
  refs.articleIllustrationFileCount.textContent = `${state.articleIllustration.files.length} 个文件`;
  state.articleIllustration.files.forEach((item) => {
    const row = document.createElement("div");
    row.className = "article-file-item";
    const name = document.createElement("span");
    name.textContent = item.file?.name || "未命名文件";
    const meta = document.createElement("small");
    meta.textContent = formatFileSize(item.file?.size || 0);
    row.append(name, meta);
    refs.articleIllustrationFileList.appendChild(row);
  });
}

function updateArticleSourceLength() {
  if (!refs.articleIllustrationSourceLength || !refs.articleIllustrationSourceTextInput) {
    return;
  }

  const length = Array.from(refs.articleIllustrationSourceTextInput.value || "").length;
  refs.articleIllustrationSourceLength.textContent = `${length} 字`;
}

function createArticleStoryboardCard(item) {
  const card = document.createElement("article");
  card.className = "article-story-card";
  card.dataset.status = item.status || "planned";
  card.dataset.articleItemId = item.itemId;
  card.dataset.itemKind = item.itemKind;

  const head = document.createElement("div");
  head.className = "article-card-head";
  const title = document.createElement("strong");
  title.textContent = getArticleCardHeadingLabel(item);
  const status = document.createElement("span");
  status.textContent = getArticleItemStatusLabel(item.status);
  head.append(title, status);
  card.appendChild(head);

  const imageUrl = item.imageUrl || item.thumbnailUrl;
  const isGenerating = ["queued", "generating", "reference_generating"].includes(String(item.status || ""));
  const media = document.createElement(imageUrl ? "button" : "div");
  media.className = "article-card-image";
  if (imageUrl) {
    media.type = "button";
    media.classList.add("article-card-image-button");
    media.dataset.articlePreviewItemId = item.itemId;
    media.setAttribute("aria-label", `${item.title || "文章插图"} 查看大图`);
  }
  media.appendChild(createArticleImageOrderBadge(item));
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = item.title || "文章插图";
    media.appendChild(img);
  } else if (isGenerating) {
    const loading = createGenerationLoadingShell(document, { key: item.itemId, active: true, stage: getGenerationLoadingItemStage(item), showLog: true, logText: item.statusText || "" });
    media.classList.add("is-loading");
    media.setAttribute("aria-busy", "true");
    media.appendChild(loading.shell);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "article-card-image-placeholder";
    placeholder.textContent = item.error || (item.itemKind === "reference-card" ? "参考图会用于后续一致性" : "确认后生成");
    media.appendChild(placeholder);
  }
  card.appendChild(media);

  const titleField = document.createElement("textarea");
  titleField.rows = 1;
  titleField.className = "article-caption-field";
  titleField.dataset.articleItemTitle = "true";
  titleField.value = item.title || "";
  titleField.placeholder = "标题";
  card.appendChild(titleField);

  const promptField = document.createElement("textarea");
  promptField.dataset.articleItemPrompt = "true";
  promptField.value = item.prompt || "";
  promptField.placeholder = "标准生图提示词";
  card.appendChild(promptField);

  const captionField = document.createElement("textarea");
  captionField.rows = 2;
  captionField.className = "article-caption-field";
  captionField.dataset.articleItemCaption = "true";
  captionField.value = item.captionText || "";
  captionField.placeholder = "准确题注 / 原文句子";
  card.appendChild(captionField);

  const hintField = document.createElement("textarea");
  hintField.rows = 2;
  hintField.className = "article-caption-field";
  hintField.dataset.articleItemTextHint = "true";
  hintField.value = item.modelTextHint || "";
  hintField.placeholder = "对话用漫画对话框/旁白框呈现，不要直接印在画面物体上";
  card.appendChild(hintField);

  const actions = document.createElement("div");
  actions.className = "article-card-actions";
  const copyPromptButton = document.createElement("button");
  copyPromptButton.className = "mini-action";
  copyPromptButton.type = "button";
  copyPromptButton.dataset.articleCopyPromptItemId = item.itemId;
  copyPromptButton.textContent = "复制提示词";
  const copyCaptionButton = document.createElement("button");
  copyCaptionButton.className = "mini-action";
  copyCaptionButton.type = "button";
  copyCaptionButton.dataset.articleCopyCaptionItemId = item.itemId;
  copyCaptionButton.textContent = "复制题注";
  const retryButton = document.createElement("button");
  retryButton.className = "mini-action";
  retryButton.type = "button";
  retryButton.dataset.articleRetryItemId = item.itemId;
  retryButton.textContent = item.status === "completed" ? "重生成" : "补图";
  actions.append(copyPromptButton, copyCaptionButton, retryButton);
  card.appendChild(actions);

  return card;
}

function createArticleRecordCard(item, setId = "") {
  const card = document.createElement("article");
  card.className = "article-record-image-card article-story-card";
  card.dataset.status = item.status || "planned";
  card.dataset.articleItemId = item.itemId;
  card.dataset.itemKind = item.itemKind;

  const head = document.createElement("div");
  head.className = "article-card-head";
  const title = document.createElement("strong");
  title.textContent = getArticleCardHeadingLabel(item);
  const status = document.createElement("span");
  status.textContent = getArticleItemStatusLabel(item.status);
  head.append(title, status);
  card.appendChild(head);

  const imageUrl = item.imageUrl || item.thumbnailUrl;
  const isGenerating = ["queued", "generating", "reference_generating"].includes(String(item.status || ""));
  const media = document.createElement(imageUrl ? "button" : "div");
  media.className = "article-card-image";
  if (imageUrl) {
    media.type = "button";
    media.classList.add("article-card-image-button");
    media.dataset.articleRecordPreviewItemId = item.itemId;
    media.dataset.articleRecordPreviewSetId = setId;
    media.setAttribute("aria-label", `${item.title || "文章插图"} 查看大图`);
  }
  media.appendChild(createArticleImageOrderBadge(item));
  if (imageUrl) {
    const img = document.createElement("img");
    img.src = imageUrl;
    img.alt = item.title || "文章插图";
    media.appendChild(img);
  } else if (isGenerating) {
    const loading = createGenerationLoadingShell(document, { key: item.itemId, active: true, stage: getGenerationLoadingItemStage(item), showLog: true, logText: item.statusText || "" });
    media.classList.add("is-loading");
    media.setAttribute("aria-busy", "true");
    media.appendChild(loading.shell);
  } else {
    const placeholder = document.createElement("span");
    placeholder.className = "article-card-image-placeholder";
    placeholder.textContent = item.error || (item.itemKind === "reference-card" ? "参考图会用于后续一致性" : "确认后生成");
    media.appendChild(placeholder);
  }
  card.appendChild(media);

  const body = document.createElement("div");
  body.className = "article-record-card-body";
  const meta = document.createElement("div");
  meta.className = "article-record-card-meta";
  appendArticleRecordMetaPill(meta, getArticleParagraphLabel(item));
  appendArticleRecordMetaPill(meta, getArticleTimelineLabel(item), "timeline");
  const titleText = document.createElement("div");
  titleText.className = "article-record-card-title";
  titleText.textContent = item.title || "";
  const caption = document.createElement("p");
  caption.className = "article-record-card-caption";
  caption.textContent = item.captionText || item.originalText || item.prompt || "暂无题注";
  body.append(meta, titleText, caption);
  card.appendChild(body);

  const actions = document.createElement("div");
  actions.className = "article-card-actions";
  const copyPromptButton = document.createElement("button");
  copyPromptButton.className = "mini-action";
  copyPromptButton.type = "button";
  copyPromptButton.dataset.articleCopyPromptItemId = item.itemId;
  copyPromptButton.textContent = "复制提示词";
  const copyCaptionButton = document.createElement("button");
  copyCaptionButton.className = "mini-action";
  copyCaptionButton.type = "button";
  copyCaptionButton.dataset.articleCopyCaptionItemId = item.itemId;
  copyCaptionButton.textContent = "复制题注";
  const retryButton = document.createElement("button");
  retryButton.className = "mini-action";
  retryButton.type = "button";
  retryButton.dataset.articleRetryItemId = item.itemId;
  retryButton.textContent = item.status === "completed" ? "重生成" : "补图";
  actions.append(copyPromptButton, copyCaptionButton, retryButton);
  card.appendChild(actions);

  return card;
}

function renderArticleIllustrationView() {
  syncGenerationSchedulingLock();
  if (!refs.articleIllustrationStoryboardList) {
    return;
  }

  renderArticleIllustrationFiles();
  updateArticleSourceLength();
  const currentSet = getArticleCurrentSet();
  const progress = getArticleProgressSummary(currentSet);
  const busy = state.articleIllustration.planning || state.articleIllustration.generating || state.articleIllustration.referenceGenerating;
  const referenceItems = currentSet?.items?.filter((item) => item.itemKind === "reference-card") || [];
  const storyboardItems = currentSet?.items?.filter((item) => item.itemKind !== "reference-card") || [];

  refs.articleIllustrationPlanButton.textContent = state.articleIllustration.planning ? "解析中..." : "解析文章";
  refs.articleIllustrationPlanButton.disabled = busy;
  refs.articleIllustrationReferenceButton.disabled =
    busy || !currentSet || progress.references === 0 || progress.referenceCompleted === progress.references;
  refs.articleIllustrationReferenceButton.textContent = state.articleIllustration.referenceGenerating ? "参考图生成中..." : "生成参考图";
  refs.articleIllustrationGenerateButton.disabled = busy || !currentSet;
  refs.articleIllustrationGenerateButton.textContent = state.articleIllustration.generating ? "生成中..." : "确认并生成插图";
  refs.articleIllustrationCount.textContent = `${progress.completed} / ${progress.total || 0} 张`;
  refs.articleReferenceSectionCount.textContent = `${referenceItems.length} 张`;
  refs.articleStoryboardSectionCount.textContent = `${storyboardItems.length} 张`;
  refs.articleIllustrationSetMeta.textContent = currentSet
    ? `${formatArticleDisplayText(currentSet.title)} · ${currentSet.contentType} · ${currentSet.stylePreset} · ${getArticleItemStatusLabel(currentSet.status)}`
    : "等待解析";
  if (currentSet && document.activeElement !== refs.articleIllustrationStyleBibleInput) {
    refs.articleIllustrationStyleBibleInput.value = currentSet.styleBible || "";
  }

  const referenceCards = referenceItems.map((item) => createArticleStoryboardCard(item));
  const storyboardCards = storyboardItems.map((item) => createArticleStoryboardCard(item));
  stopGenerationLoadingShells(refs.articleIllustrationReferenceList);
  refs.articleIllustrationReferenceList.replaceChildren();
  refs.articleIllustrationReferenceList.append(...referenceCards);
  if (referenceItems.length === 0) {
    const empty = document.createElement("div");
    empty.className = "article-reference-card";
    empty.textContent = currentSet ? "本次计划没有单独参考图。" : "解析后会显示人物和高频场景参考图。";
    refs.articleIllustrationReferenceList.appendChild(empty);
  }

  stopGenerationLoadingShells(refs.articleIllustrationStoryboardList);
  refs.articleIllustrationStoryboardList.replaceChildren();
  if (storyboardItems.length === 0) {
    const empty = document.createElement("article");
    empty.className = "article-story-card";
    empty.textContent = currentSet ? "正文插图会显示在参考图之后。" : "先输入文章并解析，模型会生成可编辑的分镜表。";
    refs.articleIllustrationStoryboardList.appendChild(empty);
    return;
  }
  refs.articleIllustrationStoryboardList.append(...storyboardCards);
}

function buildArticleIllustrationPlanFormData() {
  const formData = new FormData();
  formData.set("title", refs.articleIllustrationTitleInput.value.trim());
  formData.set("sourceText", refs.articleIllustrationSourceTextInput.value.trim());
  formData.set("supplementalPrompt", refs.articleIllustrationSupplementInput.value.trim());
  formData.set("contentType", refs.articleIllustrationContentTypeInput.value || "auto");
  formData.set("stylePreset", refs.articleIllustrationStylePresetInput.value || DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET);
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  state.articleIllustration.files.forEach((item) => {
    if (item.file) {
      formData.append("sourceFiles", item.file);
    }
  });
  appendCurrentConfigToFormData(formData);
  return formData;
}

function buildArticleIllustrationGenerateFormData({ itemIds = [], regenerate = false } = {}) {
  const currentSet = syncArticlePlanEditsFromDom();
  const formData = new FormData();
  formData.set("setId", currentSet?.setId || "");
  formData.set("styleBible", currentSet?.styleBible || "");
  formData.set("items", JSON.stringify(currentSet?.items || []));
  formData.set("ratio", "3:2");
  formData.set("size", "auto");
  formData.set("format", "png");
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("clientSessionId", state.clientSessionId);
  if (itemIds.length > 0) {
    formData.set("itemIds", JSON.stringify(itemIds));
  }
  if (regenerate) {
    formData.set("regenerate", "1");
  }
  appendCurrentConfigToFormData(formData);
  return formData;
}

function recordArticleIllustrationLogEvent({ setId, itemId, itemTitle, status, detail, imageUrl, set = null } = {}) {
  const currentSet = set || getArticleCurrentSet();
  recordBatchLogEvent({
    channel: "article-illustration",
    groupId: setId || currentSet?.setId,
    groupLabel: `文章插图 · ${currentSet?.title || currentSet?.articleTitle || "未命名文章"}`,
    set: currentSet,
    itemId,
    itemTitle: itemTitle || itemId || "插图",
    status,
    detail,
    imageUrl,
  });
}

function handleArticleIllustrationStreamEvent(eventName, payload = {}) {
  if (eventName === "references_started" || eventName === "set_started") {
    if (payload.set) {
      upsertArticleSet(payload.set);
    }
    setArticleIllustrationFeedback(eventName === "references_started" ? "正在生成重点参考图..." : "正在生成文章插图...", "busy");
    (Array.isArray(payload.set?.items) ? payload.set.items : []).forEach((item) => {
      recordArticleIllustrationLogEvent({ setId: payload.set?.setId, itemId: item.itemId, itemTitle: item.title, status: "pending", detail: buildGenerationTaskActivityDetail({ statusStage: "queued", statusText: "等待后台生成" }), set: payload.set });
    });
    return;
  }

  if (eventName === "item_started") {
    updateArticleCurrentItem(payload.itemId, { status: "generating", error: "" });
    setArticleIllustrationFeedback(`正在生成：${payload.title || payload.itemId}`, "busy");
    recordArticleIllustrationLogEvent({ setId: payload.setId, itemId: payload.itemId, itemTitle: payload.title, status: "active", detail: "正在生成图片" });
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "item_partial_image" || eventName === "item_final_image") {
    updateArticleCurrentItem(payload.itemId, {
      status: "generating",
      imageUrl: payload.dataUrl,
      thumbnailUrl: payload.dataUrl,
    });
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "item_saved") {
    if (payload.set) {
      upsertArticleSet(payload.set);
    } else if (payload.item) {
      updateArticleCurrentItem(payload.item.itemId, payload.item);
    }
    setArticleIllustrationFeedback("已保存一张文章插图。", "success");
    recordArticleIllustrationLogEvent({ setId: payload.setId || payload.set?.setId, itemId: payload.item?.itemId || payload.itemId, itemTitle: payload.item?.title, status: "done", detail: "图像已成功生成", imageUrl: getImageUrl(payload.item), set: payload.set });
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "item_failed") {
    if (payload.set) {
      upsertArticleSet(payload.set);
    } else if (payload.itemId) {
      updateArticleCurrentItem(payload.itemId, { status: "failed", error: payload.message || "" });
    }
    setArticleIllustrationFeedback(payload.message || "文章插图生成失败。", "error");
    const articleFailureDetail = compactErrorMessage(payload.message, "生成请求失败");
    recordArticleIllustrationLogEvent({ setId: payload.setId || payload.set?.setId, itemId: payload.itemId, status: "error", detail: buildGenerationTaskActivityDetail({ status: "error", statusStage: "error", statusText: articleFailureDetail, errorMessage: articleFailureDetail }), set: payload.set });
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "complete") {
    if (payload.set) {
      upsertArticleSet(payload.set);
    }
    setArticleIllustrationFeedback("文章插图任务已完成。", "success");
    renderArticleIllustrationView();
    return;
  }

  if (eventName === "error") {
    const message = compactErrorMessage(payload.message, "文章插图请求失败");
    setArticleIllustrationFeedback(message, "error");
    showError(message);
  }
}

async function runArticleIllustrationStream(response) {
  return consumeSseUntilTerminal({ stream: response.body, consumeSse, onEvent: handleArticleIllustrationStreamEvent, missingTerminalMessage: "文章插图生成连接已中断，未收到完成事件。" });
}

async function previewArticleIllustrationPlan() {
  if (state.articleIllustration.planning || state.articleIllustration.generating) {
    return;
  }

  clearError();
  setArticleIllustrationFeedback("");
  if (!refs.articleIllustrationSourceTextInput.value.trim() && state.articleIllustration.files.length === 0 && !refs.articleIllustrationSupplementInput.value.trim()) {
    const message = "请先粘贴文章正文、上传文本文件，或填写补充说明。";
    setArticleIllustrationFeedback(message, "error");
    showError(message);
    return;
  }

  state.articleIllustration.planning = true;
  const planSnapshot = getArticleIllustrationPlanSnapshot();
  setArticleIllustrationFeedback("正在解析整篇文章...", "busy");
  renderArticleIllustrationView();

  try {
    const response = await fetch("/api/article-illustration/plan", {
      method: "POST",
      body: buildArticleIllustrationPlanFormData(),
    });
    const payload = await response.json().catch(() => ({}));
    if (planSnapshot !== getArticleIllustrationPlanSnapshot()) {
      setArticleIllustrationFeedback("文章输入已变化，请重新解析。", "busy");
      return;
    }
    if (!response.ok) {
      throw new Error(payload.message || "文章插图解析失败");
    }

    state.articleIllustration.currentSet = normalizeArticleSetForView(payload.set || payload.plan || {});
    if (refs.articleIllustrationStyleBibleInput) {
      refs.articleIllustrationStyleBibleInput.value = state.articleIllustration.currentSet.styleBible || "";
    }
    upsertArticleSet(state.articleIllustration.currentSet);
    setArticleIllustrationFeedback("已生成分镜、风格圣经和参考图计划，可编辑后继续。", "success");
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "文章插图解析失败");
    setArticleIllustrationFeedback(message, "error");
    showError(message);
  } finally {
    state.articleIllustration.planning = false;
    renderArticleIllustrationView();
  }
}

async function generateArticleIllustrations({ referenceOnly = false, itemIds = [], regenerate = false } = {}) {
  if (state.articleIllustration.generating || state.articleIllustration.referenceGenerating) {
    return;
  }

  const currentSet = getArticleCurrentSet();
  if (!currentSet?.setId) {
    const message = "请先解析文章，确认分镜后再生成。";
    setArticleIllustrationFeedback(message, "error");
    showError(message);
    return;
  }

  clearError();
  state.articleIllustration.generating = !referenceOnly;
  state.articleIllustration.referenceGenerating = referenceOnly;
  setArticleIllustrationFeedback(referenceOnly ? "正在生成重点参考图..." : "正在生成正式插图...", "busy");
  renderArticleIllustrationView();

  try {
    const requestOptions = {
      method: "POST",
      body: buildArticleIllustrationGenerateFormData({ itemIds, regenerate }),
    };
    const response = referenceOnly
      ? await fetch("/api/article-illustration/generate-references", requestOptions)
      : await fetch("/api/article-illustration/generate", requestOptions);
    if (!response.ok || !response.body) {
      throw new Error(await readHttpResponseErrorMessage(response, referenceOnly ? "参考图生成请求失败" : "文章插图生成请求失败"));
    }

    await runArticleIllustrationStream(response);
    await loadArticleIllustrationSets();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "文章插图生成请求失败");
    setArticleIllustrationFeedback(message, "error");
    showError(message);
  } finally {
    state.articleIllustration.generating = false;
    state.articleIllustration.referenceGenerating = false;
    renderArticleIllustrationView();
  }
}

async function loadArticleIllustrationSets() {
  state.assetLoading.article = true;
  state.assetLoadErrors.article = "";
  renderArticleRecordView();
  let response;
  try {
    response = await fetch("/api/article-illustration/sets", { cache: "no-store" });
  } catch (error) {
    state.assetLoading.article = false;
    state.assetLoadErrors.article = error instanceof Error ? error.message : String(error);
    renderArticleRecordView();
    throw error;
  }
  if (response.status === 404) {
    state.assetLoading.article = false;
    state.articleIllustration.sets = [];
    state.articleIllustration.recordSetId = "";
    state.articleIllustration.recordCheckedSetIds = [];
    renderArticleRecordView();
    return;
  }
  if (!response.ok) {
    state.assetLoading.article = false;
    state.assetLoadErrors.article = "读取文章插图记录失败";
    renderArticleRecordView();
    throw new Error("读取文章插图记录失败");
  }

  const payload = await response.json();
  const nextSets = Array.isArray(payload) ? payload.map(normalizeArticleSetForView).filter(Boolean) : [];
  const currentSetId = state.articleIllustration.currentSet?.setId || "";
  state.articleIllustration.sets = nextSets;
  const availableSetIds = new Set(nextSets.map((set) => set.setId));
  state.articleIllustration.recordCheckedSetIds = state.articleIllustration.recordCheckedSetIds.filter((setId) => availableSetIds.has(setId));
  state.assetLoading.article = false;
  state.assetLoadErrors.article = "";
  if (currentSetId) {
    const matched = nextSets.find((set) => set.setId === currentSetId);
    if (matched) {
      state.articleIllustration.currentSet = matched;
    }
  }
  if (state.articleIllustration.recordSetId && !nextSets.some((set) => set.setId === state.articleIllustration.recordSetId)) {
    state.articleIllustration.recordSetId = "";
  }
  renderArticleIllustrationView();
  renderArticleRecordView();
}

function getArticleRecordSelectedSet() {
  const filtered = assetRecordTimeFilterController.filter("article");
  return (
    filtered.find((set) => set.setId === state.articleIllustration.recordSetId) ||
    filtered[0] ||
    null
  );
}

function getArticleRecordItemById(itemId, setId = "") {
  const selectedSet = setId
    ? state.articleIllustration.sets.find((set) => set.setId === setId) ||
      (state.articleIllustration.currentSet?.setId === setId ? state.articleIllustration.currentSet : null)
    : getArticleRecordSelectedSet() || getArticleCurrentSet();
  if (!selectedSet || !itemId) {
    return null;
  }

  const item = selectedSet.items.find((entry) => entry.itemId === itemId) || null;
  return item ? { item, set: selectedSet } : null;
}

function buildArticleRecordLightboxItem(item, set) {
  const relativeFilename = String(item.relativePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
  return {
    ...item,
    id: `article-record:${set.setId}:${item.itemId || item.filename || relativeFilename}`,
    articleItemId: item.itemId || "",
    articleSetId: set.setId || "",
    filename: item.filename || relativeFilename || "article-illustration.png",
    createdAt: item.generationCompletedAt || set.updatedAt || set.createdAt || nowIso(),
    prompt: item.prompt || item.captionText || item.title || "",
    imageModel: item.imageModel || "gpt-image-2",
    isArticleRecordItem: true,
  };
}

function openArticleRecordItemPreview(itemId, setId = "") {
  const record = getArticleRecordItemById(itemId, setId);
  if (!record?.item || !getImageUrl(record.item)) {
    setArticleRecordFeedback("当前单张还没有可查看的大图。", "error");
    return;
  }

  openLightbox(buildArticleRecordLightboxItem(record.item, record.set), {
    items: record.set.items,
    buildItem: (item) => buildArticleRecordLightboxItem(item, record.set),
  });
}

function openArticleIllustrationItemPreview(itemId) {
  const currentSet = syncArticlePlanEditsFromDom() || getArticleCurrentSet();
  const item = currentSet?.items?.find((entry) => entry.itemId === itemId);
  if (!currentSet || !item || !getImageUrl(item)) {
    setArticleIllustrationFeedback("当前单张还没有可查看的大图。", "error");
    return;
  }

  openLightbox(buildArticleRecordLightboxItem(item, currentSet), {
    items: currentSet.items,
    buildItem: (entry) => buildArticleRecordLightboxItem(entry, currentSet),
  });
}

function buildArticlePromptText(set = getArticleRecordSelectedSet()) {
  if (!set) {
    return "";
  }
  return set.items
    .map((item) => [`# ${getArticleCardHeadingLabel(item)} ${getArticleTimelineLabel(item)} ${item.title}`.trim(), item.prompt].filter(Boolean).join("\n"))
    .join("\n\n");
}

function buildArticleCaptionText(set = getArticleRecordSelectedSet()) {
  if (!set) {
    return "";
  }
  return set.items
    .map((item) => [`# ${getArticleCardHeadingLabel(item)} ${getArticleTimelineLabel(item)} ${item.title}`.trim(), item.captionText || item.originalText].filter(Boolean).join("\n"))
    .join("\n\n");
}

function renderArticleRecordList() {
  if (!refs.articleRecordList) {
    return;
  }
  const filteredSets = assetRecordTimeFilterController.filter("article");
  const selectedSet = getArticleRecordSelectedSet();
  const checkedSetIds = new Set(state.articleIllustration.recordCheckedSetIds);
  refs.articleRecordList.replaceChildren();
  refs.articleRecordList.setAttribute("aria-busy", String(state.assetLoading.article));
  if (state.assetLoading.article || state.assetLoadErrors.article || filteredSets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "asset-list-state";
    empty.textContent = state.assetLoading.article
      ? "正在加载文章记录..."
      : state.assetLoadErrors.article
        ? `加载失败：${state.assetLoadErrors.article}`
        : assetRecordTimeFilterController.hasActive("article")
          ? "没有匹配的文章记录"
          : "暂无文章插图记录";
    refs.articleRecordList.appendChild(empty);
    return;
  }
  filteredSets.forEach((set) => {
    const row = document.createElement("div");
    row.className = "asset-record-select-row";
    row.classList.toggle("is-checked", checkedSetIds.has(set.setId));

    const selectLabel = document.createElement("label");
    selectLabel.className = "asset-record-select";
    selectLabel.title = `选择 ${formatArticleDisplayText(set.title)}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checkedSetIds.has(set.setId);
    checkbox.disabled = state.assetRecordDeletion.busy || state.articleIllustration.generating || state.articleIllustration.planning;
    checkbox.dataset.articleRecordSelectSetId = set.setId;
    checkbox.setAttribute("aria-label", `选择文章插图 ${formatArticleDisplayText(set.title)}`);
    selectLabel.appendChild(checkbox);

    const button = document.createElement("button");
    button.className = `article-record-card ${selectedSet?.setId === set.setId ? "active" : ""}`;
    button.type = "button";
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(selectedSet?.setId === set.setId));
    button.dataset.articleRecordSetId = set.setId;
    const title = document.createElement("strong");
    title.textContent = formatArticleDisplayText(set.title);
    const meta = document.createElement("small");
    const progress = getArticleProgressSummary(set);
    meta.textContent = `${set.stylePreset || "默认风格"} · ${progress.completed}/${progress.total} · ${formatTime(set.updatedAt || set.createdAt)}`;
    const status = document.createElement("span");
    status.className = "asset-record-status";
    status.dataset.state = progress.failed > 0 ? "failed" : progress.completed >= progress.total && progress.total > 0 ? "completed" : "running";
    status.textContent = progress.failed > 0 ? `${progress.failed} 项失败` : progress.completed >= progress.total && progress.total > 0 ? "已完成" : "处理中";
    button.append(title, meta, status);
    row.append(selectLabel, button);
    refs.articleRecordList.appendChild(row);
  });
}

function renderArticleRecordDetail(set) {
  if (!refs.articleRecordDetail) {
    return;
  }
  const columnCount = getArticleRecordColumnCount();
  refs.articleRecordDetail.dataset.recordColumns = String(columnCount);
  stopGenerationLoadingShells(refs.articleRecordDetail);
  refs.articleRecordDetail.replaceChildren();
  if (!set) {
    const empty = document.createElement("div");
    empty.className = "article-record-summary";
    empty.textContent = "还没有文章插图记录。";
    refs.articleRecordDetail.appendChild(empty);
    return;
  }

  const progress = getArticleProgressSummary(set);
  const summary = document.createElement("div");
  summary.className = "article-record-summary";
  [
    ["标题", formatArticleDisplayText(set.title)],
    ["类型", set.contentType],
    ["风格", set.stylePreset],
    ["进度", `${progress.completed}/${progress.total}`],
  ].forEach(([label, value]) => {
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    item.append(strong, document.createTextNode(value || "--"));
    summary.appendChild(item);
  });
  refs.articleRecordDetail.appendChild(summary);

  const referenceItems = (Array.isArray(set.items) ? set.items : []).filter((item) => item.itemKind === "reference-card");
  const storyboardItems = (Array.isArray(set.items) ? set.items : []).filter((item) => item.itemKind !== "reference-card");
  const sections = document.createElement("div");
  sections.className = "article-record-sections";

  const appendRecordSection = (items, titleText, descriptionText, emptyText) => {
    const section = document.createElement("section");
    section.className = "article-record-section";
    const head = document.createElement("div");
    head.className = "article-record-section-head";
    const copy = document.createElement("div");
    const title = document.createElement("h3");
    title.textContent = titleText;
    const description = document.createElement("p");
    description.textContent = descriptionText;
    copy.append(title, description);
    const count = document.createElement("span");
    count.className = "count-pill small";
    count.textContent = `${items.length} 张`;
    head.append(copy, count);

    const grid = document.createElement("div");
    grid.className = "article-record-image-grid";
    grid.style.setProperty("--article-record-columns", String(columnCount));
    if (items.length === 0) {
      const empty = document.createElement("div");
      empty.className = "article-record-empty";
      empty.textContent = emptyText;
      grid.appendChild(empty);
    } else {
      items.forEach((item) => {
        grid.appendChild(createArticleRecordCard(item, set.setId));
      });
    }

    section.append(head, grid);
    sections.appendChild(section);
  };

  appendRecordSection(referenceItems, "参考图", "人物和高频场景集中在这里，后续插图用它们保持一致性。", "本组记录没有单独参考图。");
  appendRecordSection(storyboardItems, "正文插图", "按正文阅读顺序排列，和参考图分开查看。", "本组记录没有正文插图。");
  refs.articleRecordDetail.appendChild(sections);
}

function renderArticleRecordView() {
  if (!refs.articleRecordList) {
    return;
  }

  assetRecordTimeFilterController.render("article");
  const selectedSet = getArticleRecordSelectedSet();
  const deleteBlocked = state.articleIllustration.generating || state.articleIllustration.planning || state.articleIllustration.referenceGenerating || state.assetLoading.article || state.assetRecordDeletion.busy;
  const visibleSetIds = new Set(assetRecordTimeFilterController.filter("article").map((set) => set.setId));
  const checkedCount = state.articleIllustration.recordCheckedSetIds.filter((setId) => visibleSetIds.has(setId)).length;
  refs.articleRecordCopyPromptsButton.disabled = state.assetRecordDeletion.busy || !buildArticlePromptText(selectedSet);
  refs.articleRecordCopyCaptionsButton.disabled = state.assetRecordDeletion.busy || !buildArticleCaptionText(selectedSet);
  refs.articleRecordRefreshButton.disabled = state.assetRecordDeletion.busy;
  refs.articleRecordDeleteCurrentButton.disabled = deleteBlocked || !selectedSet;
  refs.articleRecordDeleteSelectedButton.disabled = deleteBlocked || checkedCount === 0;
  refs.articleRecordDeleteSelectedButton.textContent = checkedCount > 0 ? `删除选中 (${checkedCount})` : "删除选中";
  const hasFailedItems = Boolean(selectedSet?.items?.some((item) => item.status === "failed"));
  refs.articleRecordContinueButton.disabled = state.assetRecordDeletion.busy || !hasFailedItems;
  refs.articleRecordContinueButton.classList.toggle("hidden", !hasFailedItems);
  if (refs.articleRecordSelection) refs.articleRecordSelection.textContent = selectedSet ? formatArticleDisplayText(selectedSet.title) : "尚未选择";

  renderArticleRecordColumnPresetButtons();
  renderArticleRecordList();
  state.articleIllustration.recordSetId = selectedSet?.setId || "";
  renderArticleRecordDetail(selectedSet);
}

function normalizeCreationItemForView(item = {}, fallbackIndex = 0) {
  const imageUrl = String(item.imageUrl || item.thumbnailUrl || item.previewUrl || "");
  const status = String(item.status || (imageUrl ? "completed" : "queued"));
  const skuSubject = item.skuSubject && typeof item.skuSubject === "object" ? item.skuSubject : item.sku_subject;
  const sourceInfographic = item.sourceInfographic && typeof item.sourceInfographic === "object"
    ? item.sourceInfographic
    : item.source_infographic;
  const skuSubjectId = String(item.skuSubjectId || item.sku_subject_id || skuSubject?.id || "");
  const skuTitle = String(item.skuTitle || item.sku_title || skuSubject?.title || "");
  const role = String(item.role || CREATION_PREVIEW_SLOTS[fallbackIndex]?.role || "");
  return {
    itemId: String(item.itemId || `slot-${fallbackIndex + 1}`),
    slotIndex: Number(item.slotIndex) || fallbackIndex + 1,
    slotKey: String(item.slotKey || item.itemId || `slot-${fallbackIndex + 1}`),
    itemKind: String(item.itemKind || (role === "sku" ? "sku" : role === "infographic-rebuild" ? "infographic-rebuild" : "carousel")),
    imageType: String(item.imageType || ""),
    imageTypeLabel: String(item.imageTypeLabel || ""),
    enabled: item.enabled !== false,
    role,
    title: String(item.title || CREATION_PREVIEW_SLOTS[fallbackIndex]?.title || ""),
    brief: String(item.brief || CREATION_PREVIEW_SLOTS[fallbackIndex]?.brief || ""),
    ratio: String(item.ratio || ""),
    resolutionTier: String(item.resolutionTier || item.resolution_tier || ""),
    effectiveSize: String(item.effectiveSize || item.effective_size || item.size || ""),
    targetLanguage: String(item.targetLanguage || item.target_language || ""),
    composition: String(item.composition || ""),
    textPolicy: String(item.textPolicy || item.text_policy || ""),
    scenePolicy: String(item.scenePolicy || item.scene_policy || ""),
    logoPolicy: String(item.logoPolicy || item.logo_policy || ""),
    required: item.required === true,
    advisory: item.advisory === true,
    constraints: cloneCreationPlanValue(Array.isArray(item.constraints) ? item.constraints : [], []),
    sourceIds: Array.isArray(item.sourceIds) ? item.sourceIds.map((entry) => String(entry)).filter(Boolean) : [],
    recommendationSource: String(item.recommendationSource || ""),
    conversionIntent: cloneCreationPlanValue(item.conversionIntent, null),
    filenameToken: String(item.filenameToken || item.filename_token || ""),
    filename: String(item.filename || ""),
    relativePath: String(item.relativePath || ""),
    prompt: String(item.prompt || ""),
    marketingCopy: String(item.marketingCopy || ""),
    status,
    imageUrl,
    thumbnailUrl: String(item.thumbnailUrl || imageUrl),
    error: String(item.error || ""),
    // This normalizer is an allowlist, so both provenance flags must be listed or a
    // round-trip through it silently drops them.
    partialImageFallback: item.partialImageFallback === true || item.partial_image_fallback === true,
    previewRetained: item.previewRetained === true,
    generationStartedAt: String(item.generationStartedAt || ""),
    generationCompletedAt: String(item.generationCompletedAt || ""),
    generationDurationMs: String(item.generationDurationMs || ""),
    generationAttemptCount: Math.max(0, Math.floor(Number(item.generationAttemptCount) || 0)),
    originalResponseRecovery: String(item.originalResponseRecovery || ""),
    originalResponseRecoveryReason: String(item.originalResponseRecoveryReason || ""),
    originalResponseStatus: String(item.originalResponseStatus || ""),
    originalResponseCheckedAt: String(item.originalResponseCheckedAt || ""),
    originalResponseAutoRetryBlocked: item.originalResponseAutoRetryBlocked === true,
    ...normalizeCreationGenerationSnapshotForView(item),
    ...normalizeCreationCoverageFields(item),
    skuSubjectId,
    skuTitle,
    skuSubject: skuSubject ? { ...skuSubject } : null,
    sourceInfographic: sourceInfographic ? cloneCreationPlanValue(sourceInfographic, null) : null,
  };
}

function normalizeCreationSetForView(set = {}) {
  const planSource = getCreationSetPlanSource(set);
  const items = (Array.isArray(set.items) ? set.items : Array.isArray(planSource.items) ? planSource.items : [])
    .map((item, index) => normalizeCreationItemForView(item, index))
    .sort((left, right) => left.slotIndex - right.slotIndex);
  const hasInfographicRebuildItems = items.some((item) => item.role === "infographic-rebuild");
  const status = String(set.status || planSource.status || "");
  const resolvedStatus =
    status || (items.every((item) => item.status === "completed") && items.length > 0
      ? "completed"
      : items.some((item) => item.status === "failed")
        ? "partial_failed"
        : items.some((item) => item.status === "generating" || item.status === "queued")
          ? "generating"
          : "planning");
  const industryTemplate = normalizeCreationIndustryTemplate(set.industryTemplate || planSource.industryTemplate || "general");
  const platform = normalizeCreationPlatform(set.platform);
  if (!set.platform && planSource.platform) Object.assign(platform, normalizeCreationPlatform(planSource.platform));
  const visualLanguage = normalizeCreationVisualLanguage(set.visualLanguage || planSource.visualLanguage);
  const platformPayload = createFrozenCreationPlatformPayload(planSource);
  const effectivePlan = normalizeCreationEffectivePlanForBrowser(planSource);
  const rawDimensionSpecGroups = [
    set.dimensionSpecGroups,
    set.dimension_spec_groups,
    planSource.dimensionSpecGroups,
    planSource.dimension_spec_groups,
  ].find((value) => (Array.isArray(value) ? value.length > 0 : Boolean(value)));
  const dimensionSpecGroups = normalizeCreationDimensionGroupsForPayload(rawDimensionSpecGroups);
  const warnings = cloneCreationPlanValue(set.warnings ?? set.validation?.warnings ?? planSource.warnings ?? planSource.validation?.warnings, []);
  const errors = cloneCreationPlanValue(set.errors ?? set.validation?.errors ?? planSource.errors ?? planSource.validation?.errors, []);
  const validationIsValid = (set.validation?.isValid ?? planSource.validation?.isValid) !== false && (set.canGenerate ?? planSource.canGenerate) !== false && errors.length === 0;
  const planCounts = resolveCreationPlanCounts({ ...planSource, ...set, items });
  const skuGenerationEnabledValue = set.skuGenerationEnabled
    ?? set.sku_generation_enabled
    ?? planSource.skuGenerationEnabled
    ?? planSource.sku_generation_enabled;
  const infographicRebuildEnabledValue = set.infographicRebuildEnabled
    ?? set.infographic_rebuild_enabled
    ?? planSource.infographicRebuildEnabled
    ?? planSource.infographic_rebuild_enabled;
  return {
    setId: String(set.setId || ""),
    productName: String(set.productName || ""),
    productDescription: String(set.productDescription || ""),
    sellingPoints: Array.isArray(set.sellingPoints) ? set.sellingPoints.map((item) => String(item)).filter(Boolean) : [],
    dimensionSpecs: String(set.dimensionSpecs || ""),
    ...(dimensionSpecGroups.length > 0 ? { dimensionSpecGroups } : {}),
    dimensionUnitMode: normalizeCreationDimensionUnitMode(set.dimensionUnitMode),
    dimensionUnitModeLabel: String(set.dimensionUnitModeLabel || formatCreationDimensionUnitModeLabel(set.dimensionUnitMode)),
    targetLanguage: String(set.targetLanguage || "en"),
    targetLanguageLabel: String(set.targetLanguageLabel || ""),
    requestedPlatform: String(set.requestedPlatform || planSource.requestedPlatform || set.platform || planSource.platform || "universal"),
    platform: platform.value,
    platformLabel: String(set.platformLabel || formatCreationPlatformLabel(platform.value)),
    platformPolicyId: String(set.platformPolicyId || planSource.platformPolicyId || set.platform || planSource.platform || platform.value),
    platformEvidenceLevel: String(set.platformEvidenceLevel || planSource.platformEvidenceLevel || set.evidenceLevel || planSource.evidenceLevel || ""),
    platformProvenance: String(set.platformProvenance || planSource.platformProvenance || ""),
    strategyVersion: String(set.strategyVersion || planSource.strategyVersion || ""),
    strategyVerifiedAt: String(set.strategyVerifiedAt || planSource.strategyVerifiedAt || set.verifiedAt || planSource.verifiedAt || ""),
    platformSourceIds: Array.isArray(set.platformSourceIds || set.sourceIds || planSource.platformSourceIds || planSource.sourceIds)
      ? (set.platformSourceIds || set.sourceIds || planSource.platformSourceIds || planSource.sourceIds).map((entry) => String(entry)).filter(Boolean)
      : [],
    platformProfile: cloneCreationPlanValue(set.platformProfile || set.profile || planSource.platformProfile || planSource.profile, null),
    platformSetOverrides: platformPayload.values.platformSetOverrides,
    platformItemOverrides: platformPayload.values.platformItemOverrides,
    platformEvidence: platformPayload.values.platformEvidence,
    categorySignals: platformPayload.values.categorySignals,
    platformReferenceCoverage: platformPayload.values.platformReferenceCoverage,
    validation: { isValid: validationIsValid, errors, warnings },
    warnings: warnings,
    errors,
    canGenerate: validationIsValid,
    imageCount: planCounts.imageCount,
    carouselImageCount: planCounts.carouselImageCount,
    skuImageCount: planCounts.skuImageCount,
    infographicRebuildCount: planCounts.infographicRebuildCount,
    totalPlannedItemCount: planCounts.totalPlannedItemCount,
    selectedRoles: normalizeCreationRoleIds(set.selectedRoles || items.map((item) => item.role)),
    scenario: String(set.scenario || "standard"),
    scenarioLabel: String(set.scenarioLabel || CREATION_SCENARIO_LABELS[set.scenario] || ""),
    visualLanguage,
    visualLanguageLabel: String(set.visualLanguageLabel || formatCreationVisualLanguageLabel(visualLanguage)),
    industryTemplate: String(set.industryTemplate || industryTemplate.value || "general"),
    industryTemplateLabel: String(set.industryTemplateLabel || industryTemplate.label || ""),
    industryTemplatePath: String(set.industryTemplatePath || industryTemplate.categoryPath || ""),
    skuGenerationEnabled: normalizeCreationModuleEnabled(skuGenerationEnabledValue, true),
    infographicRebuildEnabled: normalizeCreationModuleEnabled(infographicRebuildEnabledValue, hasInfographicRebuildItems),
    referenceImageNames: Array.isArray(set.referenceImageNames)
      ? set.referenceImageNames.map((item) => String(item)).filter(Boolean)
      : [],
    referenceImageRoles: Array.isArray(set.referenceImageRoles)
      ? set.referenceImageRoles
          .map((item, index) => ({
            index: Number(item?.index) > 0 ? Number(item.index) : index + 1,
            filename: String(item?.filename || ""),
            role: String(item?.role || "product"),
            roleLabel: String(item?.roleLabel || getCreationReferenceRoleLabel(item?.role || "product")),
            note: String(item?.note || item?.analysisNote || item?.description || ""),
            ...(normalizeCreationDimensionGroupsForPayload(item?.dimensionGroups || item?.dimension_groups).length > 0
              ? { dimensionGroups: normalizeCreationDimensionGroupsForPayload(item?.dimensionGroups || item?.dimension_groups) }
              : {}),
          }))
          .filter((item) => item.filename)
      : [],
    skuSubjects: Array.isArray(set.skuSubjects) ? set.skuSubjects.map((item, index) => normalizeCreationSkuSubjectForPayload(item, index)).filter(Boolean) : [],
    skuBundleCount: normalizeCreationSkuBundleCountForPayload(set.skuBundleCount || set.sku_bundle_count || set.skuSubjects?.[0]?.bundleCount || "1"),
    skuGenerationRule: CREATION_SKU_GENERATION_RULE_LABELS[set.skuGenerationRule || set.sku_generation_rule] ? String(set.skuGenerationRule || set.sku_generation_rule) : DEFAULT_CREATION_SKU_GENERATION_RULE,
    skuGenerationRuleLabel: String(set.skuGenerationRuleLabel || set.sku_generation_rule_label || CREATION_SKU_GENERATION_RULE_LABELS[set.skuGenerationRule || set.sku_generation_rule] || CREATION_SKU_GENERATION_RULE_LABELS[DEFAULT_CREATION_SKU_GENERATION_RULE]),
    logo: normalizeCreationLogoPayload(set.logo || set.creationLogo || null),
    listingDrafts: Array.isArray(set.listingDrafts)
      ? set.listingDrafts.map((draft, index) => normalizeCreationListingDraftForView(draft, index)).filter((draft) => draft.id)
      : [],
    temuExcelExportState: cloneCreationPlanValue(set.temuExcelExportState, null),
    createdAt: String(set.createdAt || nowIso()),
    updatedAt: String(set.updatedAt || set.createdAt || nowIso()),
    status: resolvedStatus,
    relativeDir: String(set.relativeDir || ""),
    effectivePlan: effectivePlan,
    items,
  };
}

function isCreationMissingAssetItem(item = {}) {
  return Boolean(item.missingAsset || item.missing_asset);
}

function getCreationRecordRepairButtonLabel(recordIncompleteItems = []) {
  return recordIncompleteItems.length > 0 ? `补齐未生成图像 ${recordIncompleteItems.length}` : "补齐未生成图像";
}

function buildCreationReferenceRestoreQueue(set = {}) {
  const normalized = normalizeCreationSetForView(set);
  const roles = Array.isArray(normalized.referenceImageRoles) ? normalized.referenceImageRoles : [];
  const names = Array.isArray(normalized.referenceImageNames) ? normalized.referenceImageNames : [];
  const usedRoleIndexes = new Set();
  const queue = [];

  const createEntry = (roleEntry = {}, filename = "", index = 0) => {
    const resolvedFilename = String(filename || roleEntry?.filename || `reference-image-${index + 1}`).trim();
    if (!resolvedFilename) {
      return null;
    }

    const role = String(roleEntry?.role || "product").trim();
    const requestedReferenceIndex = Number.parseInt(
      String(roleEntry?.index || roleEntry?.referenceIndex || roleEntry?.reference_index || "").trim(),
      10,
    );
    const dimensionGroups = normalizeCreationDimensionGroupsForPayload(
      roleEntry?.dimensionGroups || roleEntry?.dimension_groups,
    );
    return {
      id: `creation-reference-restore-${index}-${resolvedFilename.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
      filename: resolvedFilename,
      role,
      roleLabel: String(roleEntry?.roleLabel || getCreationReferenceRoleLabel(role)).trim(),
      note: String(roleEntry?.note || "").trim(),
      originalReferenceIndex:
        Number.isFinite(requestedReferenceIndex) && requestedReferenceIndex > 0 ? requestedReferenceIndex : index + 1,
      ...(dimensionGroups.length > 0 ? { dimensionGroups } : {}),
      status: "missing",
      referenceId: "",
      uploadedFilename: "",
    };
  };

  names.forEach((filename, index) => {
    const normalizedName = filename.toLowerCase();
    let roleIndex = roles.findIndex(
      (entry, entryIndex) => !usedRoleIndexes.has(entryIndex) && String(entry.filename || "").toLowerCase() === normalizedName,
    );
    if (roleIndex < 0 && roles[index] && !usedRoleIndexes.has(index)) {
      roleIndex = index;
    }
    if (roleIndex >= 0) {
      usedRoleIndexes.add(roleIndex);
    }

    const entry = createEntry(roleIndex >= 0 ? roles[roleIndex] : {}, filename, queue.length);
    if (entry) {
      queue.push(entry);
    }
  });

  roles.forEach((entry, index) => {
    if (usedRoleIndexes.has(index)) {
      return;
    }
    const restoreEntry = createEntry(entry, entry.filename, queue.length);
    if (restoreEntry) {
      queue.push(restoreEntry);
    }
  });

  return queue;
}

function findCreationReferenceRestoreEntryForFile(file, restoreQueue = state.creationReferenceRestoreQueue) {
  const missingEntries = (Array.isArray(restoreQueue) ? restoreQueue : []).filter((entry) => entry.status !== "uploaded");
  if (missingEntries.length === 0) {
    return null;
  }

  const filename = String(file?.name || "").trim().toLowerCase();
  return (
    missingEntries.find((entry) => entry.filename.toLowerCase() === filename) ||
    (missingEntries.length === 1 ? missingEntries[0] : null)
  );
}

function markCreationReferenceRestoreEntryMissing(restoreEntryId) {
  if (!restoreEntryId) {
    return;
  }

  state.creationReferenceRestoreQueue = state.creationReferenceRestoreQueue.map((entry) =>
    entry.id === restoreEntryId
      ? {
          ...entry,
          status: "missing",
          referenceId: "",
          uploadedFilename: "",
        }
      : entry,
  );
}

function syncCreationReferenceRestoreQueueBindings(referenceFiles = state.creationReferenceFiles) {
  state.creationReferenceRestoreQueue = state.creationReferenceRestoreQueue.map((entry) => {
    const boundFile = referenceFiles.find((item) => item.restoreEntryId === entry.id);
    if (!boundFile) {
      return {
        ...entry,
        status: "missing",
        referenceId: "",
        uploadedFilename: "",
      };
    }

    return {
      ...entry,
      status: "uploaded",
      referenceId: boundFile.id,
      uploadedFilename: boundFile.file?.name || boundFile.uploadedFilename || "",
    };
  });
}

function bindCreationReferenceToRestoreEntry(referenceId, restoreEntryId) {
  const normalizedReferenceId = String(referenceId || "").trim();
  const normalizedRestoreId = String(restoreEntryId || "").trim();
  const target = state.creationReferenceFiles.find((item) => item.id === normalizedReferenceId);
  if (!target) {
    return;
  }

  const nextRestoreEntry = state.creationReferenceRestoreQueue.find((entry) => entry.id === normalizedRestoreId);
  state.creationReferenceFiles = state.creationReferenceFiles.map((item) => {
    if (item.id !== normalizedReferenceId) {
      if (normalizedRestoreId && item.restoreEntryId === normalizedRestoreId) {
        return {
          ...item,
          restoreEntryId: "",
          restoredFromRecordFilename: "",
          note: "",
          dimensionGroups: [],
        };
      }

      return item;
    }

    if (!nextRestoreEntry) {
      return {
        ...item,
        restoreEntryId: "",
        restoredFromRecordFilename: "",
        note: "",
        dimensionGroups: [],
      };
    }

    const dimensionGroups = normalizeCreationDimensionGroupsForPayload(
      nextRestoreEntry.dimensionGroups || nextRestoreEntry.dimension_groups,
    );
    return {
      ...item,
      restoreEntryId: normalizedRestoreId,
      restoredFromRecordFilename: nextRestoreEntry.filename,
      role: nextRestoreEntry.role || item.role || "product",
      note: nextRestoreEntry.note || "",
      dimensionGroups,
    };
  });
  syncCreationReferenceGenerationCompressionProfiles();
  syncCreationReferenceRestoreQueueBindings();
  markCreationReferenceAnalysisDirty();
  renderCreationReferenceGrid();
}

function renderCreationReferenceRestoreList() {
  if (!refs.creationReferenceRestoreList) {
    return;
  }

  const restoreQueue = state.creationReferenceRestoreQueue;
  refs.creationReferenceRestoreList.replaceChildren();
  refs.creationReferenceRestoreList.classList.toggle("hidden", restoreQueue.length === 0);
  if (restoreQueue.length === 0) {
    return;
  }

  const missingCount = restoreQueue.filter((entry) => entry.status !== "uploaded").length;
  const summary = document.createElement("div");
  summary.className = "creation-reference-restore-summary";
  summary.textContent =
    missingCount > 0
      ? `历史参考图需重传：${missingCount}/${restoreQueue.length} 张待补齐，重传后才会参与预览、生成和补图。`
      : `历史参考图已重传：${restoreQueue.length}/${restoreQueue.length} 张会参与预览、生成和补图。`;
  refs.creationReferenceRestoreList.appendChild(summary);

  restoreQueue.forEach((entry) => {
    const item = document.createElement("div");
    item.className = `creation-reference-restore-item ${entry.status === "uploaded" ? "is-uploaded" : "is-missing"}`;

    const copy = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = entry.filename;
    const meta = document.createElement("small");
    meta.textContent = [entry.roleLabel || getCreationReferenceRoleLabel(entry.role), entry.note].filter(Boolean).join(" · ");
    copy.append(title, meta);

    const status = document.createElement("em");
    status.className = "creation-reference-restore-status";
    status.textContent = entry.status === "uploaded" ? `已重传${entry.uploadedFilename ? ` · ${entry.uploadedFilename}` : ""}` : "待重传";

    item.append(copy, status);
    refs.creationReferenceRestoreList.appendChild(item);
  });
}

function hasCreationReferenceInputData() { return state.creationReferenceFiles.length > 0; }

function syncCreationReferenceResetButton() {
  if (refs.creationReferenceResetButton) refs.creationReferenceResetButton.disabled = !hasCreationReferenceInputData();
}

function clearCreationReferenceFiles() {
  if (
    state.creationReferencePreviewItem &&
    state.creationReferenceFiles.some((item) => item.id === state.creationReferencePreviewItem.id)
  ) {
    closeReferencePreview();
  }
  creationReferenceAnalysisRequestToken += 1;
  state.creationReferenceFiles.forEach((item) => {
    revokeReferencePreview(item);
    markCreationReferenceRestoreEntryMissing(item.restoreEntryId);
  });
  state.creationReferenceFiles = [];
  clearCreationReferenceAnalysisManagedCategory();
  state.creation.planDirty = true;
  state.creationReferenceAnalysis.running = false;
  if (refs.creationReferenceInput) {
    refs.creationReferenceInput.value = "";
  }
  renderCreationReferenceGrid();
}

function resetCreationReferenceFilesForRecordReuse(normalized = null) {
  state.creationReferenceFiles.forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
  state.creationReferenceFiles = [];
  state.creationReferenceRestoreQueue = buildCreationReferenceRestoreQueue(normalized);
  state.creationReferenceAnalysis = createEmptyCreationReferenceAnalysisState();
  if (refs.creationReferenceInput) {
    refs.creationReferenceInput.value = "";
  }
  setCreationReferenceAnalysisFeedback("", "");
  renderCreationReferenceRestoreList();
  renderCreationReferenceAnalysis();
}

function resetCreationLogoForRecordReuse(normalized = null) {
  const logo = normalizeCreationLogoPayload(normalized?.logo || null);
  revokeReferencePreview(state.creationLogo);
  state.creationLogo = {
    background: logo?.background || "transparent",
    file: null,
    generationCompressed: false,
    generationFile: null,
    generationFilePromise: null,
    placement: logo?.placement || "top-left",
    previewUrl: "",
  };
  if (refs.creationLogoInput) {
    refs.creationLogoInput.value = "";
  }
  renderCreationLogo();
}

function applyCreationSetToForm(set) {
  const normalized = normalizeCreationSetForView(set);
  state.creation.draftSet = normalized;
  refs.creationProductNameInput.value = normalized.productName || "";
  refs.creationProductDescriptionInput.value = normalized.productDescription || "";
  refs.creationSellingPointsInput.value = normalized.sellingPoints.join("\n");
  refs.creationDimensionSpecsInput.value = normalized.dimensionSpecs || "";
  if (refs.creationSkuBundleCountInput) refs.creationSkuBundleCountInput.value = String(normalized.skuBundleCount || 1);
  if (refs.creationSkuGenerationEnabledInput) refs.creationSkuGenerationEnabledInput.checked = normalized.skuGenerationEnabled !== false;
  if (refs.creationInfographicRebuildEnabledInput) refs.creationInfographicRebuildEnabledInput.checked = normalized.infographicRebuildEnabled === true;
  setCreationSelectValue(refs.creationSkuGenerationRuleInput, normalized.skuGenerationRule, DEFAULT_CREATION_SKU_GENERATION_RULE);
  setCreationSelectValue(refs.creationDimensionUnitModeInput, normalized.dimensionUnitMode, "both");
  setCreationSelectValue(refs.creationTargetLanguageInput, normalized.targetLanguage, "en");
  setCreationSelectValue(refs.creationPlatformInput, normalized.platform, "universal");
  setCreationIndustryTemplateValue(normalized.industryTemplate, {
    searchText: normalized.industryTemplatePath || "",
  });
  restoreCreationEffectivePlanFromSet(normalized);

  const normalizedRoles = normalizeCreationRoleIds(
    normalized.selectedRoles.length > 0 ? normalized.selectedRoles : normalized.items.map((item) => item.role),
  );
  state.creationRoleSelectionManuallyEdited = false;
  setCreationImageCountValue(normalized.imageCount);
  syncCreationInfographicRebuildRequiredState();
  state.creationSelectedRoles = alignCreationRoleIdsToCount(normalizedRoles, getCreationSelectedImageCount());
  resetCreationReferenceFilesForRecordReuse(normalized);
  resetCreationLogoForRecordReuse(normalized);
  renderCreationRolePicker();
  renderCreationReferenceGrid();
}

function getCreationCurrentSet() {
  return state.creation.currentSet ? normalizeCreationSetForView(state.creation.currentSet) : null;
}

function getCreationDraftSet() {
  return state.creation.draftSet ? normalizeCreationSetForView(state.creation.draftSet) : null;
}

function getCreationDisplayedSet() {
  const selectedQueueJob = isCreationLogoBatchBranch() ? null : getSelectedCreationQueueJob();
  return selectedQueueJob?.set ? normalizeCreationSetForView(selectedQueueJob.set) : getCreationCurrentSet();
}

function getCreationDisplayedPlanContext() {
  return resolveCreationDisplayedPlanContext({
    frozenPlan: getFrozenCreationEffectivePlan(),
    selectedCarouselCount: getCreationSelectedImageCount(),
  });
}

function getCreationPlatformPlanDisplayCounts(plan = null, selectedCarouselCount = getCreationSelectedImageCount()) {
  return getCreationEditablePlanDisplayCounts(plan, selectedCarouselCount);
}

function getCreationQueueJobs() { return getCreationQueueJobsFromState(state.creation); }
function getPendingCreationQueueCount() { return getPendingCreationQueueCountFromState(state.creation); }
function getActiveCreationQueueJob() { return getActiveCreationQueueJobFromState(state.creation); }
function getSelectedCreationQueueJob() { return getSelectedCreationQueueJobFromState(state.creation); }
function getCreationQueueJobForSet(set = {}) {
  const setId = String(set?.setId || "");
  return setId ? getCreationQueueJobs().find((job) => String(job.set?.setId || "") === setId) || null : null;
}
function getCreationRepairTargetSet() { return getCreationRepairTargetSetFromState(state.creation, getCreationCurrentSet(), normalizeCreationSetForView); }
function syncActiveCreationQueueSet(set) { syncActiveCreationQueueSetInState(state.creation, set, normalizeCreationSetForView); }
function selectCreationQueueJob(queueId) {
  if (!selectCreationQueueJobInState(state.creation, queueId)) return;
  renderCreationView();
}

function syncCreationExplicitSetParameters(parameters = {}) {
  const frozenPayload = getFrozenCreationPlatformPayload();
  setFrozenCreationPlatformPayload({
    ...frozenPayload.values,
    platformSetOverrides: mergeCreationPlatformSetParameters(
      frozenPayload.values.platformSetOverrides,
      parameters,
    ),
  });
  resetCreationDraftPreview();
}

function refreshCreationPlanAfterExplicitSetParameterChange(parameters = {}) {
  syncCreationExplicitSetParameters(parameters);
  if (!hasCreationPlanPreviewInput()) return;
  requestCreationPlanPreview().catch((error) => setCreationFeedback(error.message, "error"));
}

function isCreationDraftSet(set = getCreationCurrentSet()) {
  const setId = String(set?.setId || "");
  return setId.startsWith("creation-local-") || setId.startsWith("creation-draft-");
}

function getCreationProgressSummary(set = getCreationCurrentSet()) {
  const items = Array.isArray(set?.items) ? set.items : [];
  const imageCount = getFiniteCreationImageCount(set?.imageCount);
  const total = (items.length || imageCount) ?? getCreationSelectedImageCount();
  const completed = items.filter((item) => item.status === "completed").length;
  const failed = items.filter((item) => item.status === "failed").length;
  return { total, completed, failed };
}

function canRepairCreationSet(set = getCreationCurrentSet()) {
  return Boolean(set?.setId && !isCreationDraftSet(set));
}

function isCreationItemRepairActive(itemId) { return isCreationItemRepairActiveInQueue(state.creation, itemId); }
function canRepairCreationItem(itemId) { return canRepairCreationItemFromQueue({ creationState: state.creation, itemId, canRepairSet: canRepairCreationSet(getCreationRepairTargetSet()) }); }
function getCreationRepairButtonText(item = {}) { return getCreationRepairButtonTextFromQueue({ creationState: state.creation, item }); }
function queueCreationItemRepair(itemId) { if (!canRepairCreationItem(itemId) || !queueCreationItemRepairInState(state.creation, itemId)) return false; setCreationFeedback("已加入单图重生成队列。", "busy"); renderCreationView(); return true; }
async function runNextQueuedCreationItemRepair() { const nextItemId = shiftNextQueuedCreationItemRepair(state.creation, (candidate) => Boolean(getCreationCurrentSet()?.items.some((item) => item.itemId === candidate))); if (!nextItemId) { renderCreationView(); return; } renderCreationView(); await repairCreationItems({ itemId: nextItemId }); }

function renderCreationRecordDetail(set) {
  if (!refs.creationRecordDetail) {
    return;
  }

  refs.creationRecordDetail.innerHTML = "";
  const hasRepairableSet = canRepairCreationSet(set);
  const incompleteItems = getCreationIncompleteItems(set);
  if (refs.creationRepairFailedButton) {
    refs.creationRepairFailedButton.disabled = state.creation.generating || !hasRepairableSet || incompleteItems.length === 0;
    refs.creationRepairFailedButton.textContent = incompleteItems.length > 0 ? `补齐未完成项 ${incompleteItems.length}` : "补齐未完成项";
  }

  if (!set) {
    const empty = document.createElement("span");
    empty.textContent = "还没有选中套图记录。";
    refs.creationRecordDetail.appendChild(empty);
    return;
  }

  const progress = getCreationProgressSummary(set);
  const detailSections = [
    { items: [["商品", set.productName || "未命名商品"], ["平台", set.platformLabel || formatCreationPlatformLabel(set.platform)], ["商品类目", set.industryTemplateLabel || CREATION_INDUSTRY_TEMPLATE_LABELS[set.industryTemplate] || "通用电商"]] },
    { items: [["尺寸规格", set.dimensionSpecs || ""], ["规格单位", set.dimensionUnitModeLabel || formatCreationDimensionUnitModeLabel(set.dimensionUnitMode)], ["语言", set.targetLanguageLabel || set.targetLanguage || "English"], ["进度", `${progress.completed}/${progress.total}`]] },
    { wide: true, items: [["类目路径", set.industryTemplatePath || ""]] },
    { wide: true, items: [["参考图", set.referenceImageNames.length > 0 ? set.referenceImageNames.join("、") : "未使用"]] },
    { wide: true, items: [["参考用途", formatCreationReferenceRoleSummary(set.referenceImageRoles)], ["Logo", formatCreationLogoSummary(set.logo)]] },
  ];

  detailSections.forEach(({ items, wide = false }) => {
    const visibleItems = items.filter(([, value]) => value);
    if (visibleItems.length === 0) return;

    const section = document.createElement("div");
    section.className = `creation-record-section${wide ? " is-wide" : ""}`;
    visibleItems.forEach(([label, value]) => {
      const item = document.createElement("span");
      item.className = "creation-record-field";
      const labelNode = document.createElement("strong");
      labelNode.className = "creation-record-label"; labelNode.textContent = `${label}:`;
      const valueNode = document.createElement("span");
      valueNode.className = "creation-record-value"; valueNode.textContent = value;
      item.append(labelNode, valueNode); section.appendChild(item);
    });
    refs.creationRecordDetail.appendChild(section);
  });
}

function upsertCreationSet(set) {
  const normalized = normalizeCreationSetForView(set);
  if (!normalized.setId) {
    return null;
  }

  state.creation.sets = [normalized, ...state.creation.sets.filter((entry) => entry.setId !== normalized.setId)];
  const currentSetId = state.creation.currentSet?.setId || "";
  if (!currentSetId || currentSetId === normalized.setId || currentSetId.startsWith("creation-local-") || state.creation.generating) {
    state.creation.currentSet = normalized;
  }
  syncActiveCreationQueueSet(normalized);
  renderCreationRecordView();

  return normalized;
}

function updateCreationCurrentItem(itemId, patch = {}, { protectCompletedAsset = false } = {}) {
  const currentSet = getCreationCurrentSet();
  if (!currentSet || !itemId) {
    return null;
  }

  const nextItems = [...currentSet.items];
  const index = nextItems.findIndex((item) => item.itemId === itemId);
  const existing = index >= 0 ? nextItems[index] : { itemId };
  const incomingItem = { ...patch, itemId };
  const nextItem = normalizeCreationItemForView(
    protectCompletedAsset
      ? mergeCreationItemStreamUpdate(existing, incomingItem)
      : { ...existing, ...incomingItem },
    index >= 0 ? index : nextItems.length,
  );

  if (index >= 0) {
    nextItems[index] = nextItem;
  } else {
    nextItems.push(nextItem);
  }

  const nextSet = normalizeCreationSetForView({
    ...currentSet,
    ...patch.set,
    items: nextItems,
    updatedAt: patch.updatedAt || nowIso(),
    status: patch.setStatus || currentSet.status,
  });
  state.creation.currentSet = nextSet;
  if (!isCreationDraftSet(nextSet)) {
    state.creation.sets = [nextSet, ...state.creation.sets.filter((entry) => entry.setId !== nextSet.setId)];
  }
  syncActiveCreationQueueSet(nextSet);
  return nextSet;
}

function getCreationPreviousSetForStream(set, { queueJob } = {}) {
  const incomingSetId = String(set?.setId || "");
  const candidates = [queueJob?.set, getCreationCurrentSet(), ...state.creation.sets].filter(Boolean);
  if (!incomingSetId) {
    return candidates[0] || null;
  }
  return candidates.find((candidate) => String(candidate?.setId || "") === incomingSetId) || null;
}

function upsertCreationSetForStream(set, { queueJob } = {}) {
  // The manifest never carries mid-generation previews, so replacing the local set
  // with it wholesale would drop an image the user already watched appear. Carry
  // previews forward for items the manifest has no stored asset for.
  const previousSet = getCreationPreviousSetForStream(set, { queueJob });
  const normalized = normalizeCreationSetForView(mergeCreationSetPreviews(set, previousSet));
  if (!normalized.setId) {
    return null;
  }

  if (queueJob) {
    queueJob.set = normalized;
    state.creation.sets = [normalized, ...state.creation.sets.filter((entry) => entry.setId !== normalized.setId)];
    if (shouldSyncCreationQueueJobCurrentSet(state.creation, queueJob)) {
      state.creation.currentSet = normalized;
    }
    renderCreationRecordView();
    return normalized;
  }

  return upsertCreationSet(normalized);
}

function getCreationStreamCurrentSet({ queueJob } = {}) {
  return queueJob?.set ? normalizeCreationSetForView(queueJob.set) : getCreationCurrentSet();
}

function shouldApplyCreationStreamItemUpdate(itemId, patch = {}, context = {}) {
  if (!itemId) {
    return true;
  }
  const currentSet = getCreationStreamCurrentSet(context);
  const existing = currentSet?.items?.find((item) => item.itemId === itemId) || null;
  return !shouldRetainCompletedCreationItem(existing, { ...patch, itemId });
}

function updateCreationStreamItem(itemId, patch = {}, context = {}) {
  const { queueJob } = context;
  if (!queueJob) {
    return updateCreationCurrentItem(itemId, patch, { protectCompletedAsset: true });
  }

  const currentSet = getCreationStreamCurrentSet(context);
  if (!currentSet || !itemId) {
    return null;
  }

  const nextItems = [...currentSet.items];
  const index = nextItems.findIndex((item) => item.itemId === itemId);
  const existing = index >= 0 ? nextItems[index] : { itemId };
  const nextItem = normalizeCreationItemForView(
    mergeCreationItemStreamUpdate(existing, { ...patch, itemId }),
    index >= 0 ? index : nextItems.length,
  );
  if (index >= 0) {
    nextItems[index] = nextItem;
  } else {
    nextItems.push(nextItem);
  }

  const nextSet = normalizeCreationSetForView({
    ...currentSet,
    ...patch.set,
    items: nextItems,
    updatedAt: patch.updatedAt || nowIso(),
    status: patch.setStatus || currentSet.status,
  });
  queueJob.set = nextSet;
  state.creation.sets = [nextSet, ...state.creation.sets.filter((entry) => entry.setId !== nextSet.setId)];
  if (shouldSyncCreationQueueJobCurrentSet(state.creation, queueJob)) {
    state.creation.currentSet = nextSet;
  }
  return nextSet;
}

function shouldShowCreationCardLoading(item = {}, showRecordActions = false) {
  if (showRecordActions || !state.creation.generating) {
    return false;
  }

  if (getImageUrl(item)) {
    return false;
  }

  const status = String(item.status || "queued");
  return !["completed", "failed"].includes(status);
}

function shouldHideCreationCardDetails(item = {}, showRecordActions = false) {
  if (showRecordActions || !state.creation.generating) {
    return false;
  }
  if (state.creation.generationScope === "single") {
    return isCreationItemRepairActive(item.itemId) && !getImageUrl(item);
  }
  return true;
}

function createCreationCardLoading(status = "generating", sequenceIndex = 0, key = "", logText = "") {
  const isQueued = status === "queued";
  return createCreationCardLoadingShell(isQueued ? "queued" : "generating", null, { sequenceIndex, key, logText });
}

/* 卡片上的实时日志取该项在日志里的最新明细：视图项经过白名单归一化，
   不带 statusText，所以只有日志里存着这一行的真实状态。 */
function getGenerationLogItemDetail(channel, itemId, groupId = "") {
  return getGenerationLogGroupItemDetail(state.generationLog, channel, groupId, itemId);
}

function getCreationCardLogText(item = {}, channel = "creation", groupId = "") {
  if (item.status === "failed") {
    return compactErrorMessage(item.error, "生成请求失败");
  }
  return getGenerationLogItemDetail(channel, item.itemId, groupId) || String(getCreationItemStatusLabel(item) || "").trim();
}

function createCreationCard(item = {}, fallbackIndex = 0, options = {}) {
  const showActions = options.showActions !== false;
  const showRecordActions = options.showRecordActions === true;
  const isLoadingCard = shouldShowCreationCardLoading(item, showRecordActions);
  const hideGenerationDetails = shouldHideCreationCardDetails(item, showRecordActions);
  const card = document.createElement("article");
  card.className = "creation-card";
  card.dataset.creationCardKey = getCreationCardDomKey(item, fallbackIndex);
  card.classList.toggle("is-record-card", showRecordActions);
  card.classList.toggle("is-generating", isLoadingCard);
  card.classList.toggle("is-sku", item.role === "sku");
  card.classList.toggle("is-sku-start", options.isSkuStart === true);
  card.classList.toggle("is-infographic-rebuild", item.role === "infographic-rebuild");
  card.classList.toggle("is-infographic-rebuild-start", options.isInfographicRebuildStart === true);

  const head = document.createElement("div");
  head.className = "creation-card-head";

  const title = document.createElement("strong");
  title.dataset.creationCardTitle = "true";
  title.textContent = getCreationItemDisplayTitle(item, CREATION_PREVIEW_SLOTS[fallbackIndex]?.title || `第 ${fallbackIndex + 1} 张`);
  head.appendChild(title);

  const status = document.createElement("span");
  status.className = "creation-card-status";
  status.dataset.creationCardStatus = "true";
  status.textContent = getCreationItemStatusLabel(item);
  head.appendChild(status);

  card.appendChild(head);

  const imageUrl = getImageUrl(item);
  const isResultPreviewMedia = Boolean(imageUrl && !showRecordActions);
  const media = document.createElement((showRecordActions || isResultPreviewMedia) && imageUrl ? "button" : "div");
  media.className = "creation-card-media";
  media.dataset.creationCardMedia = "true";
  if (showRecordActions && imageUrl) {
    media.type = "button";
    media.classList.add("creation-record-preview-media");
    media.dataset.creationRecordPreviewItemId = item.itemId;
    media.dataset.creationRecordPreviewSetId = options.creationSetId || "";
    media.setAttribute("aria-label", `${getCreationItemDisplayTitle(item, "套图项")}查看大图`);
  } else if (isResultPreviewMedia) {
    media.type = "button";
    media.classList.add("creation-result-preview-media");
    media.dataset.creationPreviewItemId = item.itemId;
    media.setAttribute("aria-label", `${getCreationItemDisplayTitle(item, "Creation item")} preview image`);
  }

  if (isLoadingCard) {
    media.classList.add("is-loading");
    media.setAttribute("aria-busy", "true");
    media.appendChild(createCreationCardLoading(
      item.status,
      fallbackIndex,
      getCreationCardLoadingKey(item, fallbackIndex, options.keyScope),
      getCreationCardLogText(item, "creation", options.logGroupId),
    ));
  } else if (imageUrl) {
    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = getCreationItemDisplayTitle(item, `套图 ${fallbackIndex + 1}`);
    image.src = imageUrl;
    media.appendChild(image);
  } else {
    const placeholder = document.createElement("span");
    const isWaitingPlaceholder = item.status !== "failed";
    if (isWaitingPlaceholder) {
      media.classList.add("is-waiting");
      media.setAttribute("aria-busy", "true");
    }
    placeholder.textContent = isCreationMissingAssetItem(item) ? "历史图片文件缺失，可一键补图" : item.status === "failed" ? item.error || "生成失败" : "等待生成";
    media.appendChild(placeholder);
  }
  card.appendChild(media);

  const shouldRenderPath = !imageUrl && !showRecordActions && !hideGenerationDetails;
  if (shouldRenderPath) {
    const path = document.createElement("span");
    path.className = "creation-card-path";
    path.textContent = item.error || "";
    path.title = path.textContent;
    path.hidden = !path.textContent;
    card.appendChild(path);
  }

  if (showActions && !hideGenerationDetails) {
    const actions = document.createElement("div");
    actions.className = "creation-card-actions";
    const button = document.createElement("button");
    button.className = "mini-action";
    button.type = "button";
    button.dataset.creationRetryItemId = item.itemId;
    button.textContent = getCreationRepairButtonText(item);
    button.disabled = !canRepairCreationItem(item.itemId);
    button.setAttribute("aria-label", `${getCreationItemDisplayTitle(item, "套图项")}${button.textContent}`);
    actions.appendChild(button);
    card.appendChild(actions);
  }

  return card;
}

function syncCreationResultGrid(items = [], { showActions = true, keyScope = "", logGroupId = "" } = {}) {
  syncCreationResultGridShell({
    grid: refs.creationResultGrid,
    items,
    createCard: (item, index, options) => createCreationCard(item, index, options),
    getItemOptions: (item, _index, { firstSkuItem, firstInfographicRebuildItem }) => ({
      showActions,
      keyScope,
      logGroupId,
      isSkuStart: item === firstSkuItem,
      isInfographicRebuildStart: item === firstInfographicRebuildItem,
    }),
    syncCard: (card, item, index, options) => syncCreationLoadingCard(card, item, index, {
      ...options,
      getFallbackTitle: (slotIndex) => CREATION_PREVIEW_SLOTS[slotIndex]?.title || "",
      getImageUrl,
      getStatusLabel: getCreationItemStatusLabel,
      getLogText: (entry) => getCreationCardLogText(entry, "creation", options.logGroupId),
      shouldShowLoading: (entry) => shouldShowCreationCardLoading(entry, false),
    }),
    shouldRetainLoadingSource: ({ existingCard }) => {
      const loadingKey = String(
        existingCard?.querySelector?.(".creation-card-loading")?.dataset?.generationLoadingKey || "",
      );
      return Boolean(keyScope && loadingKey && !loadingKey.startsWith(`${keyScope}::`));
    },
  });
}

function getCreationRecordSearchText(set = {}) {
  return [
    set.productName,
    set.productDescription,
    set.platform,
    set.platformLabel,
    set.scenario,
    set.scenarioLabel,
    set.visualLanguage,
    set.visualLanguageLabel,
    set.industryTemplate,
    set.industryTemplateLabel,
    set.industryTemplatePath,
    set.targetLanguage,
    set.targetLanguageLabel,
    ...(Array.isArray(set.sellingPoints) ? set.sellingPoints : []),
    ...(Array.isArray(set.referenceImageNames) ? set.referenceImageNames : []),
    ...getCreationListingSearchValues(set),
    ...(Array.isArray(set.items)
      ? set.items.flatMap((item) => [item.title, item.role, item.prompt, item.marketingCopy, item.filename, item.relativePath])
      : []),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function getCreationRecordKeywordMatchedSets() {
  const query = String(state.creation.recordQuery || "").trim().toLowerCase();
  if (!query) {
    return state.creation.sets;
  }

  return state.creation.sets.filter((set) => getCreationRecordSearchText(set).includes(query));
}

function getCreationRecordTimeFilterSnapshot() {
  const date = normalizeCreationRecordDateFilter(state.creation.recordDateFilter);
  const window = date ? "all" : normalizeCreationRecordTimeFilter(state.creation.recordTimeFilter);
  state.creation.recordDateFilter = date;
  state.creation.recordTimeFilter = window;
  return { window, date };
}

function filterCreationRecordSets() {
  return filterCreationRecordSetsByTime(
    getCreationRecordKeywordMatchedSets(),
    getCreationRecordTimeFilterSnapshot(),
  );
}

function hasCreationRecordActiveFilters() {
  return Boolean(
    String(state.creation.recordQuery || "").trim() ||
      hasActiveCreationRecordTimeFilter(getCreationRecordTimeFilterSnapshot()),
  );
}

function getCreationRecordFilterLabel() {
  const labels = [];
  const query = String(state.creation.recordQuery || "").trim();
  const timeLabel = formatCreationRecordTimeFilterLabel(getCreationRecordTimeFilterSnapshot());
  if (query) labels.push(`关键词：${query}`);
  if (timeLabel) labels.push(`时间：${timeLabel}`);
  return labels.join("、");
}

function renderCreationRecordTimeFilters(keywordMatchedSets = getCreationRecordKeywordMatchedSets()) {
  if (!refs.creationRecordTimeFilters) return;
  const filters = getCreationRecordTimeFilterSnapshot();
  refs.creationRecordTimeFilters.replaceChildren();
  buildCreationRecordTimeFilterOptions(keywordMatchedSets).forEach((option) => {
    const button = document.createElement("button");
    const isActive = option.value === filters.window;
    button.type = "button";
    button.className = "toolbar-button creation-record-time-filter";
    button.dataset.creationRecordTimeFilter = option.value;
    button.setAttribute("aria-pressed", String(isActive));
    button.textContent = `${option.label} · ${option.count}`;
    button.addEventListener("click", () => {
      state.creation.recordTimeFilter = option.value;
      state.creation.recordDateFilter = "";
      state.creation.recordDetailExpanded = false;
      state.creation.recordListScrollTop = 0;
      if (refs.creationRecordSetList) refs.creationRecordSetList.scrollTop = 0;
      renderCreationRecordView();
    });
    refs.creationRecordTimeFilters.appendChild(button);
  });
}

function getCreationRecordSelectedSet() {
  const sets = filterCreationRecordSets();
  return sets.find((set) => set.setId === state.creation.recordSetId) || sets[0] || null;
}

function getCreationRecordDeleteTargetsForMode(mode) {
  return getCreationRecordDeleteTargets({
    mode,
    allSets: state.creation.sets,
    filteredSets: filterCreationRecordSets(),
    currentSetId: getCreationRecordSelectedSet()?.setId || "",
    checkedSetIds: state.creation.recordCheckedSetIds,
    query: state.creation.recordQuery,
    hasFilter: hasCreationRecordActiveFilters(),
  });
}

function closeCreationRecordDeleteDialog({ force = false } = {}) {
  if (!refs.creationRecordDeleteDialog?.open || (state.creation.recordDeleteBusy && !force)) return;
  refs.creationRecordDeleteDialog.close();
}

function requestCreationRecordDelete(mode) {
  if (state.creation.generating || state.creation.planning || state.creation.recordDeleteBusy || state.creation.recordTemuExportBusy) return;
  let targets;
  try {
    targets = getCreationRecordDeleteTargetsForMode(mode);
  } catch (error) {
    setCreationRecordFeedback(error instanceof Error ? error.message : String(error), "error");
    return;
  }
  if (targets.length === 0) {
    const message = mode === "filtered" && !hasCreationRecordActiveFilters()
      ? "请先输入搜索条件或选择时间，再删除筛选结果。"
      : mode === "selected"
        ? "请先勾选需要删除的套图。"
        : "请先选择一套记录。";
    setCreationRecordFeedback(message, "error");
    return;
  }

  const copy = buildCreationRecordDeleteConfirmation({
    mode,
    targets,
    query: state.creation.recordQuery,
    filterLabel: getCreationRecordFilterLabel(),
  });
  state.creation.recordDeleteRequest = {
    mode,
    query: state.creation.recordQuery,
    setIds: targets.map((set) => set.setId),
  };
  refs.creationRecordDeleteDialogTitle.textContent = copy.title;
  refs.creationRecordDeleteDialogMessage.textContent = copy.message;
  refs.creationRecordDeleteConfirmButton.textContent = copy.confirmLabel;
  refs.creationRecordDeleteConfirmButton.disabled = false;
  refs.creationRecordDeleteCancelButton.disabled = false;
  creationRecordDeleteRestoreFocus = document.activeElement;
  refs.creationRecordDeleteDialog.showModal();
}

async function confirmCreationRecordDelete() {
  if (state.creation.recordDeleteBusy || !state.creation.recordDeleteRequest) return;
  const setIds = normalizeCreationRecordDeleteSetIds(state.creation.recordDeleteRequest.setIds);
  const deletedIds = new Set(setIds);
  const filteredSetsBeforeDelete = filterCreationRecordSets();
  const selectedSetIdBeforeDelete = getCreationRecordSelectedSet()?.setId || "";
  state.creation.recordDeleteBusy = true;
  refs.creationRecordDeleteConfirmButton.disabled = true;
  refs.creationRecordDeleteCancelButton.disabled = true;
  refs.creationRecordDeleteConfirmButton.textContent = "正在删除...";
  renderCreationRecordView();

  try {
    const response = await fetch("/api/creation/sets/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setIds }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.message || "删除套图记录失败。");
    }

    state.creation.sets = state.creation.sets.filter((set) => !deletedIds.has(set.setId));
    state.creation.recordCheckedSetIds = state.creation.recordCheckedSetIds.filter((setId) => !deletedIds.has(setId));
    state.creation.recordSetId = resolveCreationRecordSelectionAfterDelete({
      filteredSets: filteredSetsBeforeDelete,
      currentSetId: selectedSetIdBeforeDelete,
      deletedSetIds: setIds,
    });
    if (deletedIds.has(selectedSetIdBeforeDelete)) {
      state.creation.recordDetailExpanded = false;
    }
    if (deletedIds.has(state.creation.currentSet?.setId)) state.creation.currentSet = null;
    state.creation.queue = state.creation.queue.filter((job) => !deletedIds.has(job?.set?.setId));
    if (!state.creation.queue.some((job) => job.id === state.creation.selectedQueueId)) state.creation.selectedQueueId = "";
    if (deletedIds.has(state.lightboxItem?.creationSetId)) closeLightbox();
    closeCreationRecordDeleteDialog({ force: true });

    const deletedCount = Number(payload.deletedCount) || 0;
    const skippedUnsafeCount = Array.isArray(payload.skippedUnsafePaths) ? payload.skippedUnsafePaths.length : 0;
    if (skippedUnsafeCount > 0) {
      setCreationRecordFeedback(`已删除 ${deletedCount} 套记录；${skippedUnsafeCount} 个异常目录未自动清理。`, "error");
    } else if (deletedCount > 0) {
      setCreationRecordFeedback(`已删除 ${deletedCount} 套套图。`, "success");
    } else {
      setCreationRecordFeedback("所选套图记录已不存在，已从当前列表移除。", "success");
    }
  } catch (error) {
    closeCreationRecordDeleteDialog({ force: true });
    setCreationRecordFeedback(error instanceof Error ? error.message : String(error), "error");
  } finally {
    state.creation.recordDeleteBusy = false;
    renderCreationView();
    renderCreationRecordView();
  }
}

function getCreationRecordImagePaths(set) {
  return Array.isArray(set?.items) ? set.items.map((item) => item.relativePath).filter(Boolean) : [];
}

function buildCreationRecordPromptText(set) {
  const items = Array.isArray(set?.items) ? set.items : [];
  if (!set || items.length === 0) {
    return "";
  }

  return [
    `套图: ${set.productName || "未命名商品"}`,
    `记录: ${set.setId || "unknown"}`,
    `场景: ${set.scenarioLabel || set.scenario || "standard"}`,
    `行业: ${set.industryTemplateLabel || set.industryTemplate || "general"}`,
    "",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${getCreationItemDisplayTitle(item, item.role || item.itemId || "套图单张")}`,
      item.prompt ? item.prompt : "",
      item.marketingCopy ? `文案: ${item.marketingCopy}` : "",
      "",
    ]),
  ]
    .map((line) => String(line || "").trimEnd())
    .join("\n")
    .trim();
}

function triggerBrowserTextDownload(text, filename, mimeType = "text/plain;charset=utf-8") {
  const blob = new Blob([text], { type: mimeType });
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = objectUrl;
  link.download = filename || "creation-record.txt";
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
}

function downloadCreationRecordTextFile(text, filename, mimeType = "text/plain;charset=utf-8") {
  const value = String(text || "").trim();
  if (!value) {
    return;
  }

  triggerBrowserTextDownload(value, filename, mimeType);
}

const creationListingController = createCreationListingController({
  refs,
  state,
  compactErrorMessage,
  downloadTextFile: downloadCreationRecordTextFile,
  fetchImpl: (...args) => fetch(...args),
  getRequestConfig: getBrowserPrivateConfigRequestPayload,
  getSelectedSet: getCreationRecordSelectedSet,
  normalizeSet: normalizeCreationSetForView,
  nowIso,
  renderCurrentView: renderCreationView,
  renderRecordView: renderCreationRecordView,
  setFeedback: setCreationRecordFeedback,
  upsertSet: upsertCreationSet,
  writeTextToClipboard,
});
const creationRecordTemuExportController = createCreationTemuExportController({
  state,
  getCurrentSetIds: () => state.creation.sets.map((set) => set?.setId),
  getCurrentSets: () => state.creation.sets,
  isMutationBusy: () => Boolean(
    state.creation.generating ||
    state.creation.planning ||
    state.creation.recordDeleteBusy ||
    state.creation.listingGeneratingSetId ||
    creationRecordRefreshPromise
  ),
  refreshSets: () => loadCreationSets(),
  setRecordFeedback: setCreationRecordFeedback,
  renderRecordView: renderCreationRecordView,
  compactErrorMessage,
  // 点击「temuexcel导出工作台」打开上品工作台覆盖层；批量导出成为覆盖层内第二个标签。
  openWorkbench: (setIds) => temuWorkbenchLauncher.open(setIds),
});

const temuWorkbenchLauncher = createTemuWorkbenchLauncher({
  openExportDialog: () => creationRecordTemuExportController.openExportDialog(),
});
async function fetchCreationRecordPathReport(set) {
  if (!set?.setId) {
    throw new Error("请先选择一套记录。");
  }

  const response = await fetch("/api/creation/sets/paths", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      setId: set.setId,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "读取套图完整路径失败。");
  }

  return payload;
}

function buildCreationRecordFullPathText(payload, set) {
  const items = Array.isArray(payload?.items) ? payload.items.filter((item) => item.absolutePath) : [];
  if (!set || items.length === 0) {
    return "";
  }

  return [
    `套图: ${set.productName || payload.productName || "未命名商品"}`,
    `目录: ${payload.absoluteDir || set.relativeDir || "未记录目录"}`,
    "图片:",
    ...items.map((item, index) => `${index + 1}. ${item.absolutePath}`),
  ].join("\n");
}

async function copyCreationRecordPrompts() {
  const selectedSet = getCreationRecordSelectedSet();
  const text = buildCreationRecordPromptText(selectedSet);
  if (!text) {
    setCreationRecordFeedback("当前套图还没有可复制的提示词。", "error");
    return;
  }

  await writeTextToClipboard(text);
  setCreationRecordFeedback("已复制当前套图提示词。", "success");
}

function exportCreationRecordPrompts() {
  const selectedSet = getCreationRecordSelectedSet();
  const text = buildCreationRecordPromptText(selectedSet);
  if (!text) {
    setCreationRecordFeedback("当前套图还没有可导出的提示词。", "error");
    return;
  }

  downloadCreationRecordTextFile(text, `creation-prompts-${selectedSet.setId || "record"}.txt`);
  setCreationRecordFeedback("已导出当前套图提示词。", "success");
}

function exportCreationRecordManifest() {
  const selectedSet = getCreationRecordSelectedSet();
  if (!selectedSet) {
    setCreationRecordFeedback("请先选择一套记录。", "error");
    return;
  }

  downloadCreationRecordTextFile(
    `${JSON.stringify(selectedSet, null, 2)}\n`,
    `creation-record-${selectedSet.setId || "record"}.json`,
    "application/json;charset=utf-8",
  );
  setCreationRecordFeedback("已导出当前套图清单。", "success");
}

function shouldAutoGenerateCreationListings(completedSet = getCreationCurrentSet(), queueJob = null) {
  const listingAgentEnabled = queueJob?.listingAgentEnabled
    ?? queueJob?.set?.listingAgentEnabled
    ?? completedSet?.listingAgentEnabled
    ?? Boolean(refs.creationListingAgentEnabledInput?.checked);
  return Boolean(listingAgentEnabled) && state.creation.generationScope === "full";
}

function getCreationRecordItemById(itemId, setId = "") {
  const selectedSet = setId
    ? state.creation.sets.find((set) => set.setId === setId) || null
    : getCreationRecordSelectedSet();
  if (!selectedSet || !itemId) {
    return null;
  }

  const item = selectedSet.items.find((entry) => entry.itemId === itemId) || null;
  return item ? { item, set: selectedSet } : null;
}

function buildCreationCurrentLightboxItem(item = {}) {
  const imageUrl = getImageUrl(item);
  if (!imageUrl) return null;
  const itemId = String(item.itemId || item.id || item.filename || "item").trim() || "item";
  const relativeFilename = String(item.relativePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
  const filename = String(item.filename || relativeFilename || "creation-preview.png").trim() || "creation-preview.png";
  return { ...item, id: `creation-current:${itemId}`, filename, imageUrl, thumbnailUrl: item.thumbnailUrl || imageUrl, prompt: "", isImageOnlyLightboxItem: true, };
}

function openCreationCurrentItemPreview(itemId) {
  const currentSet = getCreationDisplayedSet();
  const item = currentSet?.items?.find((entry) => entry.itemId === itemId);
  const lightboxItem = buildCreationCurrentLightboxItem(item);
  if (!lightboxItem) return;
  openLightbox(lightboxItem, {
    items: currentSet?.items || [],
    buildItem: buildCreationCurrentLightboxItem,
  });
}

function openCreationRecordItemPreview(itemId, setId = "") {
  const record = getCreationRecordItemById(itemId, setId);
  if (!record?.item || !getImageUrl(record.item)) {
    setCreationRecordFeedback("当前单张还没有可查看的大图。", "error");
    return;
  }

  openLightbox(buildCreationRecordLightboxItem(record.item, record.set), {
    items: record.set.items,
    buildItem: (item) => buildCreationRecordLightboxItem(item, record.set),
  });
}

async function copyCreationRecordItemPath(itemId, setId = "") {
  const record = getCreationRecordItemById(itemId, setId);
  const pathText = String(record?.item?.relativePath || "").trim();
  if (!pathText) {
    setCreationRecordFeedback("当前单张没有可复制的图片路径。", "error");
    return;
  }

  await writeTextToClipboard(pathText);
  setCreationRecordFeedback("已复制单张图片路径。", "success");
}

async function copyCreationRecordItemFullPath(itemId, setId = "") {
  const record = getCreationRecordItemById(itemId, setId);
  if (!record?.item) {
    setCreationRecordFeedback("请先选择一个套图单张。", "error");
    return;
  }

  const payload = await fetchCreationRecordPathReport(record.set);
  const item = Array.isArray(payload?.items) ? payload.items.find((entry) => entry.itemId === itemId) : null;
  const pathText = String(item?.absolutePath || "").trim();
  if (!pathText) {
    setCreationRecordFeedback("当前单张没有可复制的完整路径。", "error");
    return;
  }

  await writeTextToClipboard(pathText);
  setCreationRecordFeedback("已复制单张完整路径。", "success");
}

function getCreationRecordListFilterSignature() {
  const filters = getCreationRecordTimeFilterSnapshot();
  return JSON.stringify([
    String(state.creation.recordQuery || "").trim().toLowerCase(),
    filters.window,
    filters.date,
  ]);
}

function renderCreationRecordSetList(filteredSets = filterCreationRecordSets()) {
  if (!refs.creationRecordSetList) {
    return;
  }

  const filterSignature = getCreationRecordListFilterSignature();
  if (state.creation.recordListState?.filterSignature === filterSignature) {
    state.creation.recordListScrollTop = Number(refs.creationRecordSetList.scrollTop) || 0;
  } else {
    state.creation.recordListScrollTop = 0;
  }
  const listModel = buildCreationRecordListModel(filteredSets, {
    state: state.creation.recordListState,
    filterSignature,
  });
  state.creation.recordListState = listModel.state;
  refs.creationRecordSetList.replaceChildren();
  const selectedSet = getCreationRecordSelectedSet();
  const selectedSetId = selectedSet?.setId || "";
  const checkedSetIds = new Set(state.creation.recordCheckedSetIds);
  refs.creationRecordSetList.setAttribute("aria-busy", String(state.assetLoading.creation));
  if (refs.creationRecordListSummary) {
    refs.creationRecordListSummary.textContent = `已显示 ${listModel.shownCount} / 匹配 ${listModel.totalCount}`;
  }
  if (refs.creationRecordLoadMoreButton) {
    refs.creationRecordLoadMoreButton.hidden = !listModel.hasMore;
    refs.creationRecordLoadMoreButton.disabled = state.assetLoading.creation;
    refs.creationRecordLoadMoreButton.textContent = listModel.hasMore
      ? `加载更多（剩余 ${listModel.totalCount - listModel.shownCount}）`
      : "已显示全部";
  }

  if (state.assetLoading.creation || state.assetLoadErrors.creation || listModel.visibleSets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "creation-record asset-list-state";
    empty.textContent = state.assetLoading.creation
      ? "正在加载套图记录..."
      : state.assetLoadErrors.creation
        ? `加载失败：${state.assetLoadErrors.creation}`
        : hasCreationRecordActiveFilters() ? "没有匹配的套图记录" : "暂无套图记录";
    refs.creationRecordSetList.appendChild(empty);
    return;
  }

  listModel.visibleSets.forEach((set) => {
    refs.creationRecordSetList.appendChild(createCreationRecordListRow({
      set,
      selectedSetId,
      checked: checkedSetIds.has(set.setId),
      checkboxDisabled: state.creation.recordDeleteBusy,
      getProgressSummary: getCreationProgressSummary,
      getListingLabel: getCreationRecordListingMetaLabel,
      formatPlatformLabel: formatCreationPlatformLabel,
      formatTime,
      documentRef: document,
    }));
  });
  refs.creationRecordSetList.scrollTop = state.creation.recordListScrollTop;
}

function selectCreationRecord(setId) {
  const set = filterCreationRecordSets().find((entry) => entry.setId === setId);
  if (!set) {
    return;
  }

  state.creation.recordListScrollTop = Number(refs.creationRecordSetList?.scrollTop) || 0;
  state.creation.recordSetId = set.setId;
  state.creation.recordDetailExpanded = false;
  setCreationRecordFeedback();
  renderCreationRecordView();
}

async function openCreationRecordFolder() {
  const selectedSet = getCreationRecordSelectedSet();
  if (!selectedSet?.setId) {
    setCreationRecordFeedback("请先选择一套记录。", "error");
    return;
  }

  const response = await fetch("/api/creation/sets/open-folder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      setId: selectedSet.setId,
    }),
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.message || "打开套图文件夹失败。");
  }

  setCreationRecordFeedback("已打开套图文件夹。", "success");
}

async function copyCreationRecordFullPaths() {
  const selectedSet = getCreationRecordSelectedSet();
  if (getCreationRecordImagePaths(selectedSet).length === 0) {
    setCreationRecordFeedback("当前套图还没有可复制的完整图片路径。", "error");
    return;
  }

  const payload = await fetchCreationRecordPathReport(selectedSet);
  const text = buildCreationRecordFullPathText(payload, selectedSet);
  if (!text) {
    setCreationRecordFeedback("当前套图还没有可复制的完整图片路径。", "error");
    return;
  }

  await writeTextToClipboard(text);
  setCreationRecordFeedback("已复制当前套图完整图片路径。", "success");
}

function reuseCreationRecordSet() {
  const selectedSet = getCreationRecordSelectedSet();
  if (!selectedSet) {
    return;
  }

  applyCreationSetToForm(selectedSet);
  state.creation.currentSet = normalizeCreationSetForView(selectedSet);
  setCreationFeedback("已载入历史套图，商品信息与角色已同步；如需沿用参考图，请重新上传原图。", "success");
  setActiveView("creation");
  renderCreationView();
}

async function repairCreationRecordIncompleteImages() {
  if (state.creation.generating) return;
  const selectedSet = getCreationRecordSelectedSet();
  if (!canRepairCreationSet(selectedSet)) {
    setCreationRecordFeedback("请先选择一个已保存的套图记录。", "error");
    return;
  }
  const targetItems = getCreationIncompleteItems(selectedSet);
  const missingAssetCount = targetItems.filter(isCreationMissingAssetItem).length;
  if (targetItems.length === 0) {
    setCreationRecordFeedback("当前套图没有需要补齐的图像。", "success");
    renderCreationRecordView();
    return;
  }

  clearError();
  state.creation.recordSetId = selectedSet.setId;
  state.creation.generating = true;
  state.creation.generationScope = "repair";
  setCreationRecordFeedback(missingAssetCount > 0 ? `正在补齐缺失的历史图像文件 ${missingAssetCount} 张...` : `正在补齐未生成图像 ${targetItems.length} 张...`, "busy");
  renderCreationView();
  renderCreationRecordView();

  const recordRepairJob = { id: `creation-record-repair-${selectedSet.setId}`, set: normalizeCreationSetForView(selectedSet) };
  try {
    await runCreationRepairRequest({ scope: "incomplete", set: selectedSet, streamContext: { queueJob: recordRepairJob } });
    const refreshedSet = getCreationRecordSelectedSet();
    const remainingCount = getCreationIncompleteItems(refreshedSet).length;
    setCreationRecordFeedback(remainingCount > 0 ? `仍有 ${remainingCount} 张图像未生成。` : missingAssetCount > 0 ? "缺失图像文件已补齐。" : "未生成图像已补齐。", remainingCount > 0 ? "error" : "success");
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "套图补图请求失败");
    setCreationRecordFeedback(message, "error");
    showError(message);
  } finally {
    releaseCreationLoadingSources({
      queueId: getCreationQueueJobForSet(selectedSet)?.id,
      setId: selectedSet.setId,
    });
    state.creation.generating = false;
    state.creation.generationScope = "";
    renderCreationView();
    renderCreationRecordView();
  }
}

function toggleCreationRecordArchiveDetail() { state.creation.recordDetailExpanded = !state.creation.recordDetailExpanded; renderCreationRecordView(); }

function renderCreationRecordArchiveDetail(set) {
  if (!refs.creationRecordArchiveDetail) return;
  refs.creationRecordArchiveDetail.innerHTML = ""; const archive = refs.creationRecordArchiveDetail.closest(".creation-record-archive"); archive?.classList.toggle("is-empty", !set); refs.creationRecordArchiveDetail.classList.remove("is-toggleable", "is-expanded", "is-collapsed");
  if (!set) { const empty = document.createElement("span"); empty.textContent = "还没有套图记录。"; refs.creationRecordArchiveDetail.appendChild(empty); return; }
  const progress = getCreationProgressSummary(set); const isExpanded = state.creation.recordDetailExpanded === true; refs.creationRecordArchiveDetail.classList.add("is-toggleable", isExpanded ? "is-expanded" : "is-collapsed");
  const detailSummary = document.createElement("div"); detailSummary.className = "creation-record-detail-summary"; const summaryTitle = document.createElement("strong"); summaryTitle.textContent = set.productName || "未命名商品"; const summaryMeta = document.createElement("span"); summaryMeta.textContent = [set.platformLabel || formatCreationPlatformLabel(set.platform), `${progress.completed}/${progress.total}`, formatClock(set.createdAt)].filter(Boolean).join(" / "); detailSummary.append(summaryTitle, summaryMeta);
  const detailToggle = document.createElement("button"); detailToggle.className = "creation-record-detail-toggle"; detailToggle.type = "button"; detailToggle.dataset.creationRecordDetailToggle = "true"; detailToggle.setAttribute("aria-expanded", String(isExpanded)); detailToggle.setAttribute("aria-label", isExpanded ? "折叠套图详情" : "展开套图详情"); detailToggle.title = isExpanded ? "折叠套图详情" : "展开套图详情";
  const detailBody = document.createElement("div"); detailBody.className = "creation-record-detail-body"; refs.creationRecordArchiveDetail.append(detailSummary, detailToggle, detailBody);
  if (refs.creationRecordGenerateListingsButton) refs.creationRecordArchiveDetail.insertBefore(refs.creationRecordGenerateListingsButton, detailToggle);
  if (!isExpanded) return;

  const detailItems = [
    ["商品", set.productName || "未命名商品"],
    ["平台", set.platformLabel || formatCreationPlatformLabel(set.platform)],
    ["商品类目", set.industryTemplateLabel || CREATION_INDUSTRY_TEMPLATE_LABELS[set.industryTemplate] || "通用电商"],
    ["类目路径", set.industryTemplatePath || ""],
    ["尺寸规格", set.dimensionSpecs || ""],
    ["规格单位", set.dimensionUnitModeLabel || formatCreationDimensionUnitModeLabel(set.dimensionUnitMode)],
    ["语言", set.targetLanguageLabel || set.targetLanguage || "English"],
    ["进度", `${progress.completed}/${progress.total}`],
    ["创建时间", formatClock(set.createdAt)],
    ["参考图", set.referenceImageNames.length > 0 ? set.referenceImageNames.join("、") : "未使用"],
    ["参考用途", formatCreationReferenceRoleSummary(set.referenceImageRoles)],
  ];

  detailItems.filter(([, value]) => value).forEach(([label, value]) => { const item = document.createElement("span"); const strong = document.createElement("strong"); strong.textContent = `${label}: `; item.appendChild(strong); item.append(document.createTextNode(value)); detailBody.appendChild(item); });
}

function renderCreationRecordView() {
  const keywordMatchedSets = getCreationRecordKeywordMatchedSets();
  const filteredSets = filterCreationRecordSets();
  const selectedSet = getCreationRecordSelectedSet();
  const recordIncompleteItems = getCreationIncompleteItems(selectedSet);
  const existingSetIds = new Set(state.creation.sets.map((set) => set.setId));
  const checkedCount = new Set(state.creation.recordCheckedSetIds.filter((setId) => existingSetIds.has(setId))).size;
  const deleteBlocked = state.creation.generating || state.creation.planning || state.creation.recordDeleteBusy || state.creation.recordTemuExportBusy;
  const temuStartBlocked = deleteBlocked || Boolean(state.creation.listingGeneratingSetId);
  if (refs.creationRecordSearchInput && refs.creationRecordSearchInput.value !== state.creation.recordQuery) {
    refs.creationRecordSearchInput.value = state.creation.recordQuery;
  }
  const timeFilters = getCreationRecordTimeFilterSnapshot();
  if (refs.creationRecordDateInput && refs.creationRecordDateInput.value !== timeFilters.date) {
    refs.creationRecordDateInput.value = timeFilters.date;
  }
  renderCreationRecordTimeFilters(keywordMatchedSets);
  const hasActiveFilters = hasCreationRecordActiveFilters();
  if (refs.creationRecordResetFiltersButton) {
    refs.creationRecordResetFiltersButton.disabled = !hasActiveFilters;
  }
  if (refs.creationRecordCount) {
    refs.creationRecordCount.textContent = hasActiveFilters
      ? `${filteredSets.length} / ${state.creation.sets.length} 套`
      : `${state.creation.sets.length} 套`;
  }
  if (refs.creationRecordReuseButton) {
    refs.creationRecordReuseButton.disabled = !selectedSet;
  }
  creationRecordTemuExportController.syncControls(temuStartBlocked, checkedCount);
  const refreshBlocked = state.creation.recordTemuExportBusy || Boolean(creationRecordRefreshPromise);
  if (refs.creationRecordRefreshButton) refs.creationRecordRefreshButton.disabled = refreshBlocked;
  if (refs.creationRecordRefreshMenuButton) refs.creationRecordRefreshMenuButton.disabled = refreshBlocked;
  if (refs.creationRecordDeleteCurrentButton) {
    refs.creationRecordDeleteCurrentButton.disabled = deleteBlocked || !selectedSet;
  }
  if (refs.creationRecordDeleteCurrentMenuButton) {
    refs.creationRecordDeleteCurrentMenuButton.disabled = deleteBlocked || !selectedSet;
  }
  if (refs.creationRecordDeleteSelectedButton) {
    refs.creationRecordDeleteSelectedButton.disabled = deleteBlocked || checkedCount === 0;
    refs.creationRecordDeleteSelectedButton.textContent = checkedCount > 0 ? `删除选中 (${checkedCount})` : "删除选中";
  }
  if (refs.creationRecordDeleteSelectedMenuButton) {
    refs.creationRecordDeleteSelectedMenuButton.disabled = deleteBlocked || checkedCount === 0;
    refs.creationRecordDeleteSelectedMenuButton.textContent = checkedCount > 0 ? `删除选中 (${checkedCount})` : "删除选中";
  }
  if (refs.creationRecordDeleteFilteredButton) {
    refs.creationRecordDeleteFilteredButton.disabled = deleteBlocked || !hasActiveFilters || filteredSets.length === 0;
    refs.creationRecordDeleteFilteredButton.textContent = hasActiveFilters && filteredSets.length > 0
      ? `删除筛选结果 (${filteredSets.length})`
      : "删除筛选结果";
  }
  if (refs.creationRecordDeleteFilteredMenuButton) {
    refs.creationRecordDeleteFilteredMenuButton.disabled = deleteBlocked || !hasActiveFilters || filteredSets.length === 0;
    refs.creationRecordDeleteFilteredMenuButton.textContent = hasActiveFilters && filteredSets.length > 0
      ? `删除筛选结果 (${filteredSets.length})`
      : "删除筛选结果";
  }
  if (refs.creationRecordOpenFolderButton) {
    refs.creationRecordOpenFolderButton.disabled = !selectedSet?.relativeDir;
  }
  if (refs.creationRecordCopyFullPathsButton) {
    refs.creationRecordCopyFullPathsButton.disabled = getCreationRecordImagePaths(selectedSet).length === 0;
  }
  if (refs.creationRecordCopyPromptsButton) {
    refs.creationRecordCopyPromptsButton.disabled = !buildCreationRecordPromptText(selectedSet);
  }
  if (refs.creationRecordExportPromptsButton) {
    refs.creationRecordExportPromptsButton.disabled = !buildCreationRecordPromptText(selectedSet);
  }
  if (refs.creationRecordExportManifestButton) {
    refs.creationRecordExportManifestButton.disabled = !selectedSet;
  }
  const repairBlocked = state.creation.generating || state.creation.recordTemuExportBusy || !canRepairCreationSet(selectedSet) || recordIncompleteItems.length === 0;
  if (refs.creationRecordRepairIncompleteButton) { refs.creationRecordRepairIncompleteButton.disabled = repairBlocked; refs.creationRecordRepairIncompleteButton.textContent = getCreationRecordRepairButtonLabel(recordIncompleteItems); }
  if (refs.creationRecordRepairIncompleteMenuButton) { refs.creationRecordRepairIncompleteMenuButton.disabled = repairBlocked; refs.creationRecordRepairIncompleteMenuButton.textContent = getCreationRecordRepairButtonLabel(recordIncompleteItems); }
  refs.creationRecordRepairIncompleteButton?.classList.toggle("hidden", recordIncompleteItems.length === 0);
  refs.creationRecordRepairIncompleteMenuButton?.classList.toggle("hidden", recordIncompleteItems.length === 0);
  refs.creationRecordReuseButton?.classList.toggle("hidden", recordIncompleteItems.length > 0);
  if (refs.creationRecordSelection) refs.creationRecordSelection.textContent = selectedSet?.productName || "尚未选择";
  creationListingController.syncRecordControls(selectedSet);
  if (state.creation.recordTemuExportBusy) {
    if (refs.creationRecordGenerateListingsButton) refs.creationRecordGenerateListingsButton.disabled = true;
    if (refs.creationRecordRegenerateListingsButton) refs.creationRecordRegenerateListingsButton.disabled = true;
  }

  renderCreationRecordSetList(filteredSets);
  state.creation.recordSetId = selectedSet?.setId || "";
  renderCreationRecordArchiveDetail(selectedSet);
  if (!refs.creationRecordResultGrid) {
    return;
  }

  refs.creationRecordResultGrid.innerHTML = "";
  refs.creationRecordResultGrid.classList.toggle("hidden", !selectedSet);
  if (!selectedSet) {
    return;
  }

  const firstRecordSkuItem = selectedSet.items.find((item) => item.role === "sku");
  const firstRecordInfographicRebuildItem = selectedSet.items.find((item) => item.role === "infographic-rebuild");
  selectedSet.items.forEach((item, index) =>
    refs.creationRecordResultGrid.appendChild(
      createCreationCard(item, index, {
        showActions: false,
        showRecordActions: true,
        creationSetId: selectedSet.setId,
        isSkuStart: item === firstRecordSkuItem,
        isInfographicRebuildStart: item === firstRecordInfographicRebuildItem,
      }),
    ),
  );
}

function openCreationReferencePreview(referenceId) {
  const item = state.creationReferenceFiles.find((entry) => entry.id === referenceId);
  const lightboxItem = buildCreationReferenceLightboxItem(item);
  if (!lightboxItem) {
    return;
  }

  state.creationReferencePreviewItem = item;
  openLightbox(lightboxItem, {
    items: state.creationReferenceFiles,
    buildItem: buildCreationReferenceLightboxItem,
  });
}

function removeCreationReferenceFile(referenceId) {
  const target = state.creationReferenceFiles.find((item) => item.id === referenceId);
  if (state.creationReferencePreviewItem?.id === referenceId) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.creationReferenceFiles = state.creationReferenceFiles.filter((item) => item.id !== referenceId);
  syncCreationReferenceGenerationCompressionProfiles();
  markCreationReferenceRestoreEntryMissing(target?.restoreEntryId);
  markCreationReferenceAnalysisDirty();
  if (state.creationReferenceFiles.length === 0) {
    clearCreationReferenceAnalysisManagedCategory();
  }
  renderCreationReferenceGrid();
}

function normalizeCreationReferenceNoteText(value) {
  return String(value || "")
    .replace(/\u00a0/g, " ")
    .replace(/\r\n?/g, "\n")
    .trim();
}

function updateCreationReferenceNote(referenceId, noteText) {
  const referenceIndex = state.creationReferenceFiles.findIndex((item) => item.id === referenceId);
  if (referenceIndex < 0) return false;

  const note = normalizeCreationReferenceNoteText(noteText);
  const reference = state.creationReferenceFiles[referenceIndex];
  if (reference.note === note) return false;
  const filename = reference.file?.name || `reference-image-${referenceIndex + 1}`;
  state.creationReferenceFiles = state.creationReferenceFiles.map((item) =>
    item.id === referenceId ? { ...item, note } : item,
  );

  const analysis = state.creationReferenceAnalysis.result;
  const recommendations = Array.isArray(analysis?.recommendations) ? analysis.recommendations : [];
  const filenameMatchIndex = recommendations.findIndex((entry) => entry.filename === filename);
  const recommendationIndex = filenameMatchIndex >= 0 ? filenameMatchIndex : referenceIndex;
  if (recommendations[recommendationIndex]) {
    state.creationReferenceAnalysis.result = {
      ...analysis,
      recommendations: recommendations.map((entry, index) =>
        index === recommendationIndex ? { ...entry, note } : entry,
      ),
    };
  }

  if (state.creationReferenceAnalysis.applied && !state.creationReferenceAnalysis.dirty) {
    refreshCreationAppliedReferencePlanningSignals();
  }
  resetCreationDraftPreview();
  return true;
}

function beginCreationReferenceNoteEditing(event) {
  const note = event.target.closest?.("[data-creation-reference-note-id]");
  if (!note || !refs.creationReferenceGrid.contains(note)) return;

  const activeNote = refs.creationReferenceGrid.querySelector('.creation-reference-note[contenteditable="true"]');
  if (activeNote && activeNote !== note) activeNote.blur();

  event.preventDefault();
  note.setAttribute("contenteditable", "true");
  note.setAttribute("role", "textbox");
  note.setAttribute("aria-label", "编辑套图参考图说明");
  note.setAttribute("aria-multiline", "true");
  note.closest("[data-creation-reference-card-id]")?.setAttribute("draggable", "false");
  note.focus();

  const selection = window.getSelection();
  if (!selection?.anchorNode || !note.contains(selection.anchorNode)) {
    const range = document.createRange();
    range.selectNodeContents(note);
    range.collapse(false);
    selection?.removeAllRanges();
    selection?.addRange(range);
  }
}

function commitCreationReferenceNoteEditing(note) {
  if (!note?.matches?.('.creation-reference-note[contenteditable="true"]')) return;

  const referenceId = note.dataset.creationReferenceNoteId || "";
  const nextNote = normalizeCreationReferenceNoteText(note.innerText || note.textContent);
  note.textContent = nextNote;
  note.removeAttribute("contenteditable");
  note.removeAttribute("role");
  note.removeAttribute("aria-label");
  note.removeAttribute("aria-multiline");
  updateCreationReferenceNote(referenceId, nextNote);

  const reference = state.creationReferenceFiles.find((item) => item.id === referenceId);
  const card = note.closest("[data-creation-reference-card-id]");
  if (card) card.draggable = isCreationSubjectReferenceRole(reference?.role || "product");
}

function updateCreationReferenceRole(referenceId, role) {
  state.creationReferenceFiles = state.creationReferenceFiles.map((item) => {
    const nextRole = CREATION_REFERENCE_ROLE_OPTIONS.some((option) => option.value === role) ? role : "product";
    return item.id === referenceId
      ? { ...item, role: nextRole || "product" }
      : nextRole === "reference-product" && item.role === "reference-product"
        ? { ...item, role: item.role === "reference-product" ? "product" : item.role }
        : item;
  });
  syncCreationReferenceGenerationCompressionProfiles();
  markCreationReferenceAnalysisDirty({ invalidateCategorySuggestion: false });
  resetCreationDraftPreview();
  renderCreationReferenceGrid();
}

function reorderCreationReferenceFile(referenceId, beforeReferenceId) {
  const next = reorderCreationReferenceFiles(state.creationReferenceFiles, referenceId, beforeReferenceId);
  if (!next) return false;
  state.creationReferenceFiles = next;
  syncCreationReferenceGenerationCompressionProfiles();
  markCreationReferenceAnalysisDirty({ invalidateCategorySuggestion: false }); resetCreationDraftPreview(); renderCreationReferenceGrid(); renderCreationView();
  return true;
}

function removeCreationLogoFile() {
  revokeReferencePreview(state.creationLogo);
  state.creationLogo = {
    ...state.creationLogo,
    file: null,
    generationCompressed: false,
    generationFile: null,
    generationFilePromise: null,
    previewUrl: "",
  };
  if (refs.creationLogoInput) {
    refs.creationLogoInput.value = "";
  }
  renderCreationLogo();
  renderCreationView();
}

function applyCreationLogoFile(fileList, { persist = true } = {}) {
  const file = [...(fileList || [])].find((item) => item.type.startsWith("image/"));
  if (!file) {
    return;
  }

  revokeReferencePreview(state.creationLogo);
  state.creationLogo = {
    background: normalizeCreationLogoBackground(refs.creationLogoBackgroundInput?.value || state.creationLogo.background),
    file,
    generationCompressed: false,
    generationFile: file,
    generationFilePromise: null,
    placement: normalizeCreationLogoPlacement(refs.creationLogoPlacementInput?.value || state.creationLogo.placement),
    previewUrl: URL.createObjectURL(file),
  };
  if (refs.creationLogoInput) {
    refs.creationLogoInput.value = "";
  }
  if (isCreationLogoBatchBranch()) {
    setCreationFeedback("");
    clearError();
  }
  startCreationLogoGenerationCompression(state.creationLogo);
  renderCreationLogo();
  renderCreationView();
  if (persist) {
    creationLogoLibrary.saveFiles([file], { applySaved: false }).catch((error) => showError(error instanceof Error ? error.message : String(error)));
  }
}

function isCreationLogoBatchBranch() {
  return state.creationBranch === "logo-batch";
}

function syncCreationBranchPanels() {
  const logoBatchBranch = isCreationLogoBatchBranch();
  refs.creationBranchInputs.forEach((input) => {
    input.checked = input.value === state.creationBranch;
  });
  refs.creationSetOnly.forEach((element) => {
    element.classList.toggle("hidden", logoBatchBranch);
  });
  refs.creationLogoBatchOnly.forEach((element) => {
    element.classList.toggle("hidden", !logoBatchBranch);
  });
}

function setCreationBranch(branch = "set") {
  const nextBranch = branch === "logo-batch" ? "logo-batch" : "set";
  const changed = state.creationBranch !== nextBranch;
  state.creationBranch = nextBranch;
  syncCreationBranchPanels();

  if (changed && !state.creation.generating && !state.creation.planning) {
    state.creation.currentSet = null;
    state.creation.generationScope = "";
    setCreationFeedback("");
  }
  renderCreationView();
}

function openCreationLogoBatchSourcePreview(sourceId) {
  const item = state.creationLogoBatchFiles.find((entry) => entry.id === sourceId);
  const lightboxItem = buildCreationReferenceLightboxItem(item);
  if (!lightboxItem) {
    return;
  }

  state.creationReferencePreviewItem = item;
  openLightbox(lightboxItem, {
    items: state.creationLogoBatchFiles,
    buildItem: buildCreationReferenceLightboxItem,
  });
}

function removeCreationLogoBatchSourceFile(sourceId) {
  const target = state.creationLogoBatchFiles.find((item) => item.id === sourceId);
  if (state.creationReferencePreviewItem?.id === sourceId) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  state.creationLogoBatchFiles = state.creationLogoBatchFiles.filter((item) => item.id !== sourceId);
  if (refs.creationLogoBatchSourceInput) {
    refs.creationLogoBatchSourceInput.value = "";
  }
  if (!state.creation.generating && isCreationLogoBatchBranch()) {
    state.creation.currentSet = null;
  }
  renderCreationLogoBatchSourceGrid();
  renderCreationView();
}

function applyCreationLogoBatchSourceFiles(fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return;
  }

  const next = [...state.creationLogoBatchFiles];
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

    const sourceItem = {
      id: `creation-logo-source-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint,
      file,
      generationFile: file,
      generationFilePromise: null,
      generationCompressed: false,
      previewUrl: URL.createObjectURL(file),
    };
    startCreationLogoBatchGenerationCompression(sourceItem);
    next.push(sourceItem);
    fingerprints.add(fingerprint);
  }

  state.creationLogoBatchFiles = next;
  setCreationFeedback("");
  clearError();
  if (refs.creationLogoBatchSourceInput) {
    refs.creationLogoBatchSourceInput.value = "";
  }
  if (!state.creation.generating && isCreationLogoBatchBranch()) {
    state.creation.currentSet = null;
  }
  renderCreationLogoBatchSourceGrid();
  renderCreationView();

  if (overflowed) {
    showError(`上传图加 Logo 最多支持 ${state.limits.maxReferenceImages} 张。`);
  }
}

function renderCreationLogoBatchSourceGrid() {
  if (!refs.creationLogoBatchSourceGrid) {
    return;
  }

  refs.creationLogoBatchSourceGrid.innerHTML = "";
  if (refs.creationLogoBatchSourceCount) {
    refs.creationLogoBatchSourceCount.textContent = `${state.creationLogoBatchFiles.length} / ${state.limits.maxReferenceImages}`;
  }
  syncReferenceDropzoneCompact(refs.creationLogoBatchSourceDropzone, state.creationLogoBatchFiles.length > 0);
  refs.creationLogoBatchSourceGrid.classList.toggle("hidden", state.creationLogoBatchFiles.length === 0);

  state.creationLogoBatchFiles.forEach((item) => {
    const card = document.createElement("div");
    card.className = "reference-card";

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "reference-preview-button";
    previewButton.dataset.creationLogoBatchSourcePreviewId = item.id;
    previewButton.setAttribute("aria-label", "放大查看待加 Logo 图片");

    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "待加 Logo 图片预览";
    previewButton.appendChild(image);
    previewButton.addEventListener("click", () => openCreationLogoBatchSourcePreview(item.id));
    card.appendChild(previewButton);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", "移除待加 Logo 图片");
    remove.addEventListener("click", () => removeCreationLogoBatchSourceFile(item.id));
    card.appendChild(remove);

    refs.creationLogoBatchSourceGrid.appendChild(card);
  });

  if (state.creationLogoBatchFiles.length > 0 && state.creationLogoBatchFiles.length < state.limits.maxReferenceImages) {
    refs.creationLogoBatchSourceGrid.appendChild(
      createReferenceAddCard({
        input: refs.creationLogoBatchSourceInput,
        label: "继续上传待加 Logo 图片",
        onFiles: applyCreationLogoBatchSourceFiles,
      }),
    );
  }
}

function applyCreationReferenceFiles(fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return { importedCount: 0, duplicateCount: 0, overflowCount: 0 };
  }

  const maxReferenceImages = getCreationMaxProductReferenceImageCount();
  const next = [...state.creationReferenceFiles];
  let restoreQueue = [...state.creationReferenceRestoreQueue];
  const fingerprints = new Set(next.map((item) => item.fingerprint));
  let importedCount = 0; let duplicateCount = 0; let overflowCount = 0;

  for (const [index, file] of incomingFiles.entries()) {
    if (next.length >= maxReferenceImages) {
      overflowCount = incomingFiles.length - index;
      break;
    }

    const fingerprint = buildReferenceFingerprint(file);
    if (fingerprints.has(fingerprint)) {
      duplicateCount += 1;
      continue;
    }

    const restoreEntry = findCreationReferenceRestoreEntryForFile(file, restoreQueue);
    const referenceItem = {
      id: `creation-ref-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint,
      file,
      generationFile: file,
      generationFilePromise: null,
      generationCompressed: false,
      generationCompressionProfile: "",
      generationCompressionRevision: 0,
      previewUrl: URL.createObjectURL(file),
      role: restoreEntry?.role || "product",
      note: restoreEntry?.note || "",
      ...(restoreEntry?.dimensionGroups?.length > 0 ? { dimensionGroups: restoreEntry.dimensionGroups } : {}),
      restoreEntryId: restoreEntry?.id || "",
      restoredFromRecordFilename: restoreEntry?.filename || "",
    };
    next.push(referenceItem);
    importedCount += 1;
    if (restoreEntry) {
      restoreQueue = restoreQueue.map((entry) =>
        entry.id === restoreEntry.id
          ? {
              ...entry,
              status: "uploaded",
              referenceId: referenceItem.id,
              uploadedFilename: file.name,
            }
          : entry,
      );
    }
    fingerprints.add(fingerprint);
  }

  state.creationReferenceFiles = next;
  syncCreationReferenceGenerationCompressionProfiles();
  state.creationReferenceRestoreQueue = restoreQueue;
  markCreationReferenceAnalysisDirty();
  if (refs.creationReferenceInput) {
    refs.creationReferenceInput.value = "";
  }
  renderCreationReferenceGrid();
  renderCreationView();

  if (overflowCount > 0) {
    showError(`套图参考图最多支持 ${maxReferenceImages} 张。`);
  }
  return { importedCount, duplicateCount, overflowCount };
}

function renderCreationLogo() {
  if (!refs.creationLogoPreview) {
    return;
  }

  const logo = state.creationLogo || {};
  const hasLogo = Boolean(logo.file && logo.previewUrl);
  state.creationLogo.placement = normalizeCreationLogoPlacement(refs.creationLogoPlacementInput?.value || logo.placement);
  state.creationLogo.background = normalizeCreationLogoBackground(refs.creationLogoBackgroundInput?.value || logo.background);

  if (refs.creationLogoPlacementInput) {
    refs.creationLogoPlacementInput.value = state.creationLogo.placement;
  }
  if (refs.creationLogoBackgroundInput) {
    refs.creationLogoBackgroundInput.value = state.creationLogo.background;
  }

  refs.creationLogoPreview.classList.toggle("hidden", !hasLogo);
  if (refs.creationLogoPreviewImage) {
    if (hasLogo) {
      refs.creationLogoPreviewImage.src = logo.previewUrl;
    } else {
      refs.creationLogoPreviewImage.removeAttribute("src");
    }
  }
  creationLogoLibrary.render({ selectedFilename: hasLogo ? logo.file.name || "" : "" });
  syncReferenceDropzoneCompact(refs.creationLogoDropzone, hasLogo);
}

function renderCreationReferenceGrid() {
  if (!refs.creationReferenceGrid) {
    return;
  }

  refs.creationReferenceGrid.innerHTML = "";
  const maxReferenceImages = getCreationMaxProductReferenceImageCount();
  refs.creationReferenceCount.textContent = `${state.creationReferenceFiles.length} / ${maxReferenceImages}`;
  syncReferenceDropzoneCompact(refs.creationReferenceDropzone, state.creationReferenceFiles.length > 0);
  refs.creationReferenceGrid.classList.toggle("hidden", state.creationReferenceFiles.length === 0);

  state.creationReferenceFiles.forEach((item) => {
    const card = document.createElement("div");
    const isProductReference = isCreationSubjectReferenceRole(item.role || "product");
    card.className = `reference-card creation-reference-card${isProductReference ? " is-draggable" : ""}`;
    card.dataset.creationReferenceCardId = item.id;
    card.draggable = isProductReference;

    const previewButton = document.createElement("button");
    previewButton.type = "button";
    previewButton.className = "reference-preview-button";
    previewButton.dataset.creationReferencePreviewId = item.id;
    previewButton.setAttribute("aria-label", "放大查看套图参考图");

    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = "套图参考图预览";
    previewButton.appendChild(image);
    card.appendChild(previewButton);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.setAttribute("aria-label", "移除套图参考图");
    remove.addEventListener("click", () => removeCreationReferenceFile(item.id));
    card.appendChild(remove);

    const roleSelect = document.createElement("select");
    roleSelect.className = "creation-reference-role";
    roleSelect.dataset.creationReferenceRoleId = item.id;
    roleSelect.setAttribute("aria-label", "选择套图参考图用途");
    CREATION_REFERENCE_ROLE_OPTIONS.forEach((option) => {
      const choice = document.createElement("option");
      choice.value = option.value;
      choice.textContent = getCreationReferenceAnalysisDisplayRoleLabel({ role: option.value, roleLabel: option.label, subjectUnitCount: item.subjectUnitCount });
      choice.selected = (item.role || "product") === option.value;
      roleSelect.appendChild(choice);
    });
    card.appendChild(roleSelect);

    if (state.creationReferenceRestoreQueue.length > 0) {
      const select = document.createElement("select");
      select.className = "creation-reference-bind";
      select.dataset.creationReferenceRestoreBindId = item.id;
      select.setAttribute("aria-label", "绑定历史参考图");

      const blank = document.createElement("option");
      blank.value = "";
      blank.textContent = "不绑定历史参考图";
      blank.selected = !item.restoreEntryId;
      select.appendChild(blank);

      state.creationReferenceRestoreQueue.forEach((entry) => {
        const option = document.createElement("option");
        option.value = entry.id;
        option.textContent = `${entry.filename}${entry.referenceId && entry.referenceId !== item.id ? "（已绑定）" : ""}`;
        option.selected = item.restoreEntryId === entry.id;
        select.appendChild(option);
      });

      card.appendChild(select);
    }

    const note = document.createElement("span");
    note.className = "creation-reference-note";
    note.dataset.creationReferenceNoteId = item.id;
    note.dataset.placeholder = "暂无说明";
    note.textContent = item.note || "";
    card.appendChild(note);

    refs.creationReferenceGrid.appendChild(card);
  });
  if (state.creationReferenceFiles.length > 0 && state.creationReferenceFiles.length < maxReferenceImages) {
    refs.creationReferenceGrid.appendChild(
      createReferenceAddCard({
        input: refs.creationReferenceInput,
        label: "继续上传套图参考图",
        onFiles: applyCreationReferenceFiles,
      }),
    );
  }
  renderCreationReferenceRestoreList();
  renderCreationReferenceAnalysis();
  syncCreationReferenceResetButton();
}

function buildCreationRestoredReferenceBindingMaps(
  referenceFiles = state.creationReferenceFiles,
  restoreQueue = state.creationReferenceRestoreQueue,
) {
  const restoreEntriesById = new Map(
    (Array.isArray(restoreQueue) ? restoreQueue : []).map((entry) => [entry.id, entry]),
  );
  const indexTargets = new Map();
  const filenameTargets = new Map();

  (Array.isArray(referenceFiles) ? referenceFiles : []).forEach((item, index) => {
    const restoreEntry = restoreEntriesById.get(item.restoreEntryId);
    if (!restoreEntry) {
      return;
    }
    const currentIndex = index + 1;
    const currentFilename = String(item.file?.name || item.uploadedFilename || "").trim();
    const originalIndex = Number.parseInt(String(restoreEntry.originalReferenceIndex || "").trim(), 10);
    if (Number.isFinite(originalIndex) && originalIndex > 0) {
      const targets = indexTargets.get(originalIndex) || new Set();
      targets.add(currentIndex);
      indexTargets.set(originalIndex, targets);
    }
    const originalFilename = String(restoreEntry.filename || "").trim().toLowerCase();
    if (originalFilename && currentFilename) {
      const targets = filenameTargets.get(originalFilename) || new Set();
      targets.add(currentFilename);
      filenameTargets.set(originalFilename, targets);
    }
  });

  return {
    indexMap: new Map(
      [...indexTargets.entries()]
        .filter(([, targets]) => targets.size === 1)
        .map(([index, targets]) => [index, [...targets][0]]),
    ),
    filenameMap: new Map(
      [...filenameTargets.entries()]
        .filter(([, targets]) => targets.size === 1)
        .map(([filename, targets]) => [filename, [...targets][0]]),
    ),
  };
}

function remapRestoredCreationDimensionGroupsForPayload(value, item = {}, bindingMaps) {
  const groups = normalizeCreationDimensionGroupsForPayload(value);
  if (!item.restoreEntryId || groups.length === 0) {
    return groups;
  }
  const { indexMap, filenameMap } = bindingMaps || buildCreationRestoredReferenceBindingMaps();
  return groups.map((group) => ({
    ...group,
    reference_indexes: group.reference_indexes
      .map((index) => indexMap.get(index))
      .filter((index, position, indexes) => Number.isFinite(index) && indexes.indexOf(index) === position),
    filenames: group.filenames
      .map((filename) => filenameMap.get(String(filename || "").trim().toLowerCase()))
      .filter((filename, position, filenames) => filename && filenames.indexOf(filename) === position),
  }));
}

function buildCreationReferenceRolePayload() {
  const restoredBindingMaps = buildCreationRestoredReferenceBindingMaps();
  return state.creationReferenceFiles
    .map((item, index) => {
      const dimensionGroups = remapRestoredCreationDimensionGroupsForPayload(
        item.dimensionGroups,
        item,
        restoredBindingMaps,
      );
      return {
        index: index + 1,
        filename: item.file?.name || `reference-image-${index + 1}`,
        role: item.role || "product",
        note: item.note || "",
        subjectUnitCount: item.subjectUnitCount || 0,
        ...(dimensionGroups.length > 0 ? { dimension_groups: dimensionGroups } : {}),
      };
    })
    .filter((item) => item.role !== "style");
}

function normalizeCreationDimensionGroupsForPayload(value) {
  const groups = Array.isArray(value) ? value : [];
  return groups
    .slice(0, 32)
    .map((group, index) => {
      if (!group || typeof group !== "object") {
        return null;
      }
      const referenceIndexes = [
        ...(Array.isArray(group.reference_indexes) ? group.reference_indexes : []),
        ...(Array.isArray(group.referenceIndexes) ? group.referenceIndexes : []),
        ...(Array.isArray(group.indexes) ? group.indexes : []),
      ]
        .map((item) => Number.parseInt(String(item || "").trim(), 10))
        .filter((item, itemIndex, items) => Number.isFinite(item) && item > 0 && items.indexOf(item) === itemIndex);
      const filenames = [
        ...(Array.isArray(group.filenames) ? group.filenames : []),
        ...(Array.isArray(group.reference_filenames) ? group.reference_filenames : []),
        ...(Array.isArray(group.referenceFilenames) ? group.referenceFilenames : []),
        group.filename,
      ]
        .map((item) => String(item || "").trim())
        .filter((item, itemIndex, items) => item && items.indexOf(item) === itemIndex);
      const specs = [
        ...(Array.isArray(group.specs) ? group.specs : []),
        ...(Array.isArray(group.facts) ? group.facts : []),
        ...(Array.isArray(group.lines) ? group.lines : []),
      ]
        .map((item) => String(item || "").trim())
        .filter(Boolean)
        .slice(0, 64);
      const variant = String(group.variant || group.variantLabel || group.variant_label || "").trim();
      const color = String(group.color || group.colorName || group.color_name || "").trim();
      const size = String(group.size || group.sizeLabel || group.size_label || "").trim();
      const label = String(
        group.label || group.name || group.title || group.variantLabel || group.variant_label || group.variant ||
          group.color || group.colorName || group.color_name || group.size || group.sizeLabel || group.size_label || "",
      ).trim();
      const note = String(group.note || group.description || "").trim();
      if (!label && referenceIndexes.length === 0 && filenames.length === 0 && specs.length === 0 && !note) {
        return null;
      }
      return {
        id: String(group.id || group.key || group.groupId || group.group_id || label || `dimension-group-${index + 1}`).trim(),
        label,
        reference_indexes: referenceIndexes,
        filenames,
        specs,
        ...(note ? { note } : {}),
        ...(variant ? { variant } : {}),
        ...(color ? { color } : {}),
        ...(size ? { size } : {}),
      };
    })
    .filter(Boolean);
}

function buildCreationSkuSubjectPayload() { return buildCreationSkuSubjectsForPayload({ analysis: state.creationReferenceAnalysis.result, applied: state.creationReferenceAnalysis.applied, dirty: state.creationReferenceAnalysis.dirty, referenceRoles: buildCreationReferenceRolePayload() }); }

function getCreationLogoPayload() {
  const logoFile = getCreationLogoGenerationFile();
  const placement = normalizeCreationLogoPlacement(refs.creationLogoPlacementInput?.value || state.creationLogo.placement);
  const background = normalizeCreationLogoBackground(refs.creationLogoBackgroundInput?.value || state.creationLogo.background);

  state.creationLogo.placement = placement;
  state.creationLogo.background = background;

  return {
    enabled: Boolean(logoFile),
    filename: logoFile?.name || "",
    placement,
    background,
  };
}

function formatCreationReferenceRoleSummary(referenceImageRoles = []) {
  const roles = Array.isArray(referenceImageRoles) ? referenceImageRoles : [];
  if (roles.length === 0) {
    return "未标注";
  }

  return roles
    .map((item) => {
      const filename = String(item?.filename || "").trim();
      const role = String(item?.role || "product").trim();
      const roleLabel = String(item?.roleLabel || getCreationReferenceRoleLabel(role)).trim();
      const note = String(item?.note || "").trim();
      return `${filename || "参考图"}: ${roleLabel}${note ? ` (${note})` : ""}`;
    })
    .join("、");
}

function formatCreationLogoSummary(logo = null) {
  const normalized = normalizeCreationLogoPayload(logo);
  if (!normalized) {
    return "未使用";
  }

  return `${normalized.filename} · ${normalized.placementLabel} · ${normalized.backgroundLabel}`;
}

function getCreationRepairReferenceRolePayload(set = getCreationCurrentSet()) {
  const uploadedRoles = buildCreationReferenceRolePayload();
  if (uploadedRoles.length > 0) {
    return uploadedRoles;
  }
  if (state.creationReferenceRestoreQueue.length > 0) {
    return [];
  }
  return Array.isArray(set?.referenceImageRoles) ? set.referenceImageRoles : [];
}

function setCreationReferenceAnalysisFeedback(message, kind = "") {
  if (!refs.creationReferenceAnalysisFeedback) {
    return;
  }

  refs.creationReferenceAnalysisFeedback.textContent = message ? compactErrorMessage(message, "套图参考图识别失败") : "";
  refs.creationReferenceAnalysisFeedback.dataset.state = kind;
  syncCreationReferenceResetButton();
}

function setCreationReferenceProductNameValue(value) {
  if (!refs.creationProductNameInput) {
    return false;
  }
  const nextValue = String(value || "").trim();
  if (refs.creationProductNameInput.value === nextValue) {
    return false;
  }
  refs.creationProductNameInput.value = nextValue;
  refs.creationProductNameInput.dispatchEvent(new Event("input", { bubbles: true }));
  return true;
}

function markCreationReferenceAnalysisDirty({ invalidateCategorySuggestion = true } = {}) {
  invalidateCreationReferenceAnalysisRequest();
  resetCreationDraftPreview();
  if (state.creationReferenceAnalysis.result) {
    state.creationReferenceAnalysis.applied = false;
    state.creationReferenceAnalysis.dirty = true;
    if (invalidateCategorySuggestion) state.creationReferenceAnalysis.categorySuggestionStale = true;
    setCreationReferenceAnalysisFeedback("参考图已变化，请重新识别。", "busy");
  } else {
    setCreationReferenceAnalysisFeedback("", "");
  }
}

function clearCreationReferenceAnalysisManagedCategory() {
  const currentCategoryValue = refs.creationIndustryTemplateInput?.value || "general";
  const resolution = resolveCreationReferenceAnalysisCategoryValue({
    categoryManuallyEdited: state.creationReferenceAnalysis.categoryManuallyEdited,
    currentCategoryValue,
    matchedCategoryValue: "",
    previousAutoCategoryValue: state.creationReferenceAnalysis.categoryTemplateSuggestion,
  });
  if (!resolution.cleared) {
    return false;
  }

  state.creationReferenceAnalysis.categoryTemplateSuggestion = "";
  state.creationReferenceAnalysis.categorySuggestionStale = false;
  setCreationIndustryTemplateValue(resolution.categoryValue, { searchText: "" });
  syncCreationSelectedRolesToIndustry();
  return true;
}
const hasCreationReferenceDimensionSpecIntent = (value) => /dimension(s)?\s*(chart|guide|card|table|sheet|info|information|specifications?|feel|reference|focus|value|values)|size\s*(chart|guide|card|table|sheet|feel|reference|focus|value|values)|spec(ification)?\s*(table|chart|card|sheet|info|information|feel|reference|focus|value|values)|measurement\s*(chart|guide|card|table)|尺寸\s*(图|表|卡|规格|信息|参数|感|参考|依据|值|数值|重点|焦点)|规格\s*(图|表|卡|信息|参数|感|参考|依据|值|数值|重点|焦点)|尺码\s*(图|表|卡|信息|指南)|实物握持尺度|规格信息|尺寸规格|规格感|尺寸感/.test(String(value || "").trim().toLowerCase());
const hasCreationReferenceDimensionSpecValue = (value) => { const text = String(value || "").trim().toLowerCase(); return /#\s*\d+|\d+\s*#\s*(?:hook|hooks|钩)?|\d+\s*(?:号|號)\s*钩|size\s*#?\s*\d+\s*hooks?/iu.test(text) || /(^|[^\p{L}\p{N}_])([+-]?(?:\d+(?:\.\d+)?|\.\d+))\s*(fl\.?\s*oz|fluid\s*ounces?|inches?|inch|in\.?|ft\.?|feet|foot|yards?|yard|yd\.?|毫米|厘米|英寸|英尺|毫升|液量盎司|千克|克|磅|盎司|升|mm|cm|kg|g|ml|lb|lbs|oz|m|l)(?=$|[^\p{L}\p{N}_])/iu.test(text); };
const hasCreationReferenceDimensionSignal = (value) => { const text = String(value || "").trim().toLowerCase(); return hasCreationReferenceDimensionSpecIntent(text) || (hasCreationReferenceDimensionSpecValue(text) && /dimension|size|measurement|capacity|length|width|height|weight|hook|尺寸|规格|尺码|容量|长度|宽度|高度|重量|比例|尺度|钩/iu.test(text)); };
const hasCreationReferenceUsageInstructionSignal = (value) => /usage\s*(guide|manual|instructions?|steps?|diagram|method)|user\s*(guide|manual|instructions?)|operation\s*(guide|manual|instructions?|steps?|method|diagram)|instruction(s)?|manual|tutorial|step[-\s]?by[-\s]?step|how\s*to|setup\s*(guide|instructions?|steps?)|assembly\s*(guide|instructions?|steps?)|install(?:ation)?\s*(guide|instructions?|steps?)|charging\s*(guide|instructions?|steps?|method|connection|diagram)|connection\s*(guide|instructions?|steps?|method|diagram)|polarity|positive\s*(pole|terminal|electrode)|negative\s*(pole|terminal|electrode)|使用\s*(指南|说明|教程|步骤|方法|方式|指引)|操作\s*(指南|说明|教程|步骤|方法|流程)|安装\s*(指南|说明|教程|步骤|方法|流程)|装配\s*(指南|说明|教程|步骤|方法|流程)|充电\s*(指南|说明|教程|步骤|方式|方法|连接|接线)|连接\s*(指南|说明|教程|步骤|方式|方法|示意|接线)|接线|正负极|正极|负极|请按照|注意事项|说明书|教程图|步骤图/iu.test(String(value || "").trim().toLowerCase());
const hasCreationReferenceDetailSignal = (value) => /detail|close.?up|callout|structure\s*(callout|breakdown|detail|annotation|notes?)|component\s*(callout|breakdown|detail|annotation)|material|texture|surface|fabric|finish|seams?|craft|细节|质感|纹理|表面|工艺|外观结构|结构表现|结构说明|结构标注|部件标注|结构拆解/iu.test(String(value || "").trim().toLowerCase());
const hasCreationReferenceFeatureSignal = (value) => /feature\s*(callout|breakdown|point|annotation|benefit|effect|demo|diagram)|functional\s*(benefit|effect|feature|proof|callout|diagram)|selling\s*point|benefit\s*(callout|diagram|proof)|功能(?:图|内容|卖点|效果|展示|说明|拆解|证据|亮点|对比|演示|结构(?:表现|说明|标注)?)|卖点(?:图|说明|拆解|展示|证据)|效果(?:图|说明|展示|证据|对比|演示)/iu.test(String(value || "").trim().toLowerCase());
const hasCreationReferenceProductSubjectSignal = (value) => /product\s*(subject|photo|main|hero)|hero\s*product|sku\s*subject|sellable\s*(product|sku|subject)|商品主体|主体图|主图|白底主图|正面主体|可售|色款|配色|整体轮廓/iu.test(String(value || "").trim().toLowerCase()), hasCreationReferencePackageSignal = (value) => /package|packaging|box|bundle|included\s*(items?|contents?)?|contents?|accessor(?:y|ies)|in\s+the\s+box|what'?s\s+included|包装|包装清单|清单|套装|配件|盒|到手|收到|内含物/iu.test(String(value || "").trim().toLowerCase()), hasCreationReferencePackageContentSignal = (value) => /included\s*(items?|contents?)?|contents?|accessor(?:y|ies)|in\s+the\s+box|comes?\s+with|what'?s\s+included|包装清单|清单包含|包装内容|到手内容|实际收到|用户实际收到|配件清单|套装内容|内含物|标配清单|附带配件|随附配件|(?:includes?|included|comes?\s+with|包含|内含|含有|附带|随附|标配)[^。.;；\n]{0,40}(?:usb|cables?|charging\s*cable|charger|manual|accessor(?:y|ies)|propeller|eva|float|充电线|数据线|线缆|螺旋桨|叶片|漂浮|浮漂|说明书|配件|收纳袋|备用)/iu.test(String(value || "").trim().toLowerCase());
function inferCreationReferenceAnalysisRole(entry = {}) { const explicitRole = String(entry.role || "").trim(), hasExplicitRole = CREATION_REFERENCE_ROLE_OPTIONS.some((option) => option.value === explicitRole), text = [entry.roleLabel, entry.title, entry.note, entry.description, entry.reason, entry.summary, entry.filename].map((item) => String(item || "").trim()).filter(Boolean).join(" "), evidenceText = [entry.title, entry.note, entry.description, entry.reason, entry.summary, entry.filename].map((item) => String(item || "").trim()).filter(Boolean).join(" "); if (explicitRole === "style") return "style"; const shouldUsePackageRole = (hasCreationReferencePackageContentSignal(evidenceText) && (!hasExplicitRole || explicitRole === "other" || explicitRole === "product" || explicitRole === "dimensions")) || (hasCreationReferencePackageSignal(evidenceText) && (!hasExplicitRole || explicitRole === "other" || explicitRole === "product")); const shouldUseDimensionRole = hasCreationReferenceDimensionSignal(text) && (!hasExplicitRole || explicitRole === "other" || (explicitRole === "product" && hasCreationReferenceDimensionSpecIntent(text))); const shouldUseUsageRole = hasCreationReferenceUsageInstructionSignal(text) && (!hasExplicitRole || explicitRole === "other" || explicitRole === "product" || explicitRole === "scene"); const shouldUseFeatureRole = hasCreationReferenceFeatureSignal(evidenceText) && (!hasExplicitRole || explicitRole === "other" || explicitRole === "product"); const shouldUseDetailRole = hasCreationReferenceDetailSignal(evidenceText) && (!hasExplicitRole || explicitRole === "other" || (explicitRole === "product" && !hasCreationReferenceProductSubjectSignal(evidenceText))); return shouldUsePackageRole ? "package" : shouldUseDimensionRole ? "dimensions" : shouldUseUsageRole ? "usage" : shouldUseFeatureRole ? "feature" : shouldUseDetailRole ? "material" : hasExplicitRole ? explicitRole : "product"; }

function normalizeCreationReferenceAnalysisRecommendation(entry = {}, index = 0, skuSubjects = []) {
  const filename = String(state.creationReferenceFiles[index]?.file?.name || entry.filename || `reference-image-${index + 1}`).trim();
  if (!filename) return null;
  const normalizedEntry = { ...entry, filename, index: Number(entry.index) || index + 1 };
  const subjectUnitCount = getCreationReferenceAnalysisGroupedSubjectUnitCount(normalizedEntry, skuSubjects);
  const roleCorrectionReason = getCreationReferenceAnalysisRoleCorrectionReason(normalizedEntry, subjectUnitCount);
  const shouldCorrectRole = Boolean(roleCorrectionReason) || shouldDowngradeReferenceProductAnalysisRole(normalizedEntry, subjectUnitCount);
  const role = shouldCorrectRole ? "product" : inferCreationReferenceAnalysisRole(normalizedEntry);
  const suppliedRole = String(entry.role || "").trim();
  const dimensionGroups = normalizeCreationDimensionGroupsForPayload(entry.dimensionGroups || entry.dimension_groups);
  return { index: Number(entry.index) || index + 1, filename, role, subjectUnitCount, roleLabel: getCreationReferenceAnalysisDisplayRoleLabel({ role, roleLabel: String(role !== suppliedRole ? getCreationReferenceRoleLabel(role) : entry.roleLabel || getCreationReferenceRoleLabel(role)), subjectUnitCount }), roleCorrectionReason: roleCorrectionReason, note: normalizeCreationReferenceAnalysisUnitCountNote(entry.note, subjectUnitCount), ...(dimensionGroups.length > 0 ? { dimensionGroups } : {}) };
}

function normalizeCreationReferenceAnalysisPayload(payload = {}) {
  const analysis = payload.analysis || payload;
  const rawRecommendations = Array.isArray(analysis?.recommendations) ? analysis.recommendations : Array.isArray(analysis?.reference_roles) ? analysis.reference_roles : [];
  const rawSkuSubjects = Array.isArray(analysis?.skuSubjects) ? analysis.skuSubjects : Array.isArray(analysis?.sku_subjects) ? analysis.sku_subjects : [];
  const skuSubjects = rawSkuSubjects.map((entry, index) => normalizeCreationSkuSubjectForPayload(entry, index)).filter(Boolean);
  const recommendations = rawRecommendations.length > 0 ? rawRecommendations.map((entry, index) => normalizeCreationReferenceAnalysisRecommendation(entry, index, skuSubjects)).filter(Boolean)
    : [];
  const rawAudienceStrategy = analysis?.audienceStrategy || analysis?.audience_strategy;
  const normalizeAudienceList = (value) => [...new Set((Array.isArray(value) ? value : value ? [value] : []).map((item) => String(item).trim()).filter(Boolean))].slice(0, 5);
  const audienceStrategy = rawAudienceStrategy && typeof rawAudienceStrategy === "object" && !Array.isArray(rawAudienceStrategy)
    ? {
        targetAudience: String(rawAudienceStrategy.targetAudience || rawAudienceStrategy.target_audience || "").trim(),
        purchaseMotivations: normalizeAudienceList(rawAudienceStrategy.purchaseMotivations || rawAudienceStrategy.purchase_motivations),
        purchaseObjections: normalizeAudienceList(rawAudienceStrategy.purchaseObjections || rawAudienceStrategy.purchase_objections),
        desiredOutcome: String(rawAudienceStrategy.desiredOutcome || rawAudienceStrategy.desired_outcome || "").trim(),
        evidenceBasis: normalizeAudienceList(rawAudienceStrategy.evidenceBasis || rawAudienceStrategy.evidence_basis),
        confidence: ["low", "medium", "high"].includes(String(rawAudienceStrategy.confidence || "").trim().toLowerCase()) ? String(rawAudienceStrategy.confidence).trim().toLowerCase() : "low",
        source: String(rawAudienceStrategy.source || "analysis-suggestion").trim() || "analysis-suggestion",
      }
    : null;

  return {
    summary: String(analysis?.summary || "已识别套图参考图用途").trim(),
    productName: String(analysis?.productName || analysis?.product_name || analysis?.subjectName || analysis?.subject_name || analysis?.productTitle || analysis?.product_title || "").trim(),
    categoryHint: String(analysis?.categoryHint || analysis?.category_hint || analysis?.category || "").trim(),
    categoryPath: String(analysis?.categoryPath || analysis?.category_path || "").trim(),
    recommendations,
    skuSubjects,
    ...(audienceStrategy ? { audienceStrategy } : {}),
    risks: Array.isArray(analysis?.risks) ? analysis.risks.map((item) => String(item).trim()).filter(Boolean) : [],
  };
}

function getCreationReferenceAnalysisCategoryText(analysis = {}) {
  return buildCreationReferenceAnalysisCategoryMatchText(analysis);
}

async function applyCreationReferenceAnalysisCategoryMatch(analysis, isCurrent = () => true) {
  await loadCreationCategoryTemplatesModule();
  if (!isCurrent()) return { applied: false, cleared: false, template: null };
  const match =
    findCreationIndustryTemplateMatch(getCreationReferenceAnalysisCategoryText(analysis)) ||
    findCreationIndustryTemplateProductNameMatch(getCreationReferenceAnalysisCategoryProductName(analysis));
  const template = match?.template || null;
  const previousValue = refs.creationIndustryTemplateInput?.value || "general";
  if (template) {
    analysis.categoryTemplateValue = template.value;
    analysis.categoryTemplateLabel = template.label;
    analysis.categoryTemplatePath = template.categoryPath || "";
  }
  const resolution = resolveCreationReferenceAnalysisCategoryValue({
    categoryManuallyEdited: state.creationReferenceAnalysis.categoryManuallyEdited,
    currentCategoryValue: previousValue,
    matchedCategoryValue: template?.value || "",
    previousAutoCategoryValue: state.creationReferenceAnalysis.categoryTemplateSuggestion,
  });
  if (!isCurrent()) return { applied: false, cleared: false, template: null };
  state.creationReferenceAnalysis.categoryTemplateSuggestion = resolution.autoCategoryValue;
  if (resolution.applied) {
    state.creationReferenceAnalysis.categoryManuallyEdited = false;
    setCreationIndustryTemplateValue(resolution.categoryValue, {
      searchText: resolution.categoryValue === template?.value ? template.categoryPath || template.label : "",
    });
    syncCreationSelectedRolesToIndustry();
  }
  return { applied: resolution.applied, cleared: resolution.cleared, template: template && resolution.categoryValue === template.value ? template : null };
}

async function applyCreationReferenceAnalysis(analysis) {
  const isCurrent = creationReferenceAnalysisApplyGuard || (() => true);
  if (!isCurrent()) return { matchedTemplate: null, productNameApplied: false, stale: true };
  const normalized = normalizeCreationReferenceAnalysisPayload(analysis);
  if (!isCurrent()) return { matchedTemplate: null, productNameApplied: false, stale: true };
  const categoryMatch = await applyCreationReferenceAnalysisCategoryMatch(normalized, isCurrent);
  if (!isCurrent()) return { matchedTemplate: null, productNameApplied: false, stale: true };
  state.creationReferenceAnalysis.result = normalized;
  state.creationReferenceAnalysis.applied = false;
  state.creationReferenceAnalysis.collapsed = false;
  state.creationReferenceAnalysis.dirty = false;
  state.creationReferenceAnalysis.categorySuggestionStale = false;
  const appliedResult = applyCreationReferenceAnalysisRecommendations();
  return {
    categoryApplied: categoryMatch.applied,
    categoryCleared: categoryMatch.cleared,
    matchedTemplate: categoryMatch.template,
    ...appliedResult,
  };
}

function applyCreationReferenceAnalysisProductNameSuggestion(analysis = {}) {
  if (!refs.creationProductNameInput) {
    return false;
  }

  const result = applyCreationReferenceAnalysisProductNameValue({
    analysis,
    currentProductName: refs.creationProductNameInput.value,
    previousAutoProductName: state.creationReferenceAnalysis.productNameSuggestion,
  });
  state.creationReferenceAnalysis.productNameSuggestion = result.autoProductName;
  setCreationReferenceProductNameValue(result.productName);
  return result.applied;
}

function refreshCreationAppliedReferencePlanningSignals() {
  const buildCreationReferencePlanningSignals = state.creationPlatformResolverModule?.buildCreationReferencePlanningSignals;
  if (typeof buildCreationReferencePlanningSignals !== "function") return false;
  const frozenPayload = getFrozenCreationPlatformPayload();
  const signals = buildCreationReferencePlanningSignals(buildCreationReferenceRolePayload());
  setFrozenCreationPlatformPayload({
    ...frozenPayload.values,
    platformSetOverrides: frozenPayload.values.platformSetOverrides,
    platformItemOverrides: frozenPayload.values.platformItemOverrides,
    categorySignals: frozenPayload.values.categorySignals,
    platformReferenceCoverage: signals.referenceCoverage,
    platformEvidence: signals.evidence,
  });
  return true;
}

function toggleCreationReferenceAnalysisPanel() {
  if (!state.creationReferenceAnalysis.result) {
    return;
  }

  state.creationReferenceAnalysis.collapsed = !state.creationReferenceAnalysis.collapsed;
  renderCreationReferenceAnalysis();
}

function applyCreationReferenceAnalysisRecommendations() {
  const analysis = state.creationReferenceAnalysis.result;
  if (!analysis || state.creationReferenceAnalysis.dirty) {
    return { applied: false, appliedMessage: "", productNameApplied: false };
  }

  const recommendationsByFilename = new Map(analysis.recommendations.map((entry) => [entry.filename, entry]));
  state.creationReferenceFiles = state.creationReferenceFiles.map((item, index) => {
    const filename = item.file?.name || `reference-image-${index + 1}`;
    const recommendation = recommendationsByFilename.get(filename) || analysis.recommendations[index];
    if (!recommendation) {
      return item;
    }
    const nextItem = { ...item };
    delete nextItem.roleLocked;
    delete nextItem.dimensionGroups;
    return {
      ...nextItem,
      role: recommendation.role || item.role || "product",
      note: recommendation.note || "",
      subjectUnitCount: recommendation.subjectUnitCount || 0,
      ...(recommendation.dimensionGroups?.length > 0 ? { dimensionGroups: recommendation.dimensionGroups } : {}),
    };
  });
  syncCreationReferenceGenerationCompressionProfiles();
  state.creationReferenceAnalysis.applied = true;
  state.creationReferenceAnalysis.collapsed = true;
  const productNameApplied = applyCreationReferenceAnalysisProductNameSuggestion(analysis);
  refreshCreationAppliedReferencePlanningSignals();
  syncCreationSelectedRolesToReferenceCoverage(analysis);
  const appliedMessage = buildCreationReferenceAnalysisAppliedFeedbackMessage({
    recommendationCount: analysis.recommendations.length,
    productNameApplied,
    recommendations: analysis.recommendations,
  });
  setCreationReferenceAnalysisFeedback(appliedMessage, "success");
  renderCreationReferenceGrid();
  renderCreationReferenceAnalysis();
  return { applied: true, appliedMessage, productNameApplied };
}

function renderCreationReferenceAnalysis() {
  if (!refs.creationReferenceAnalysisPanel) return;

  const analyzingReferences = state.creationReferenceAnalysis.running;
  refs.creationReferenceAnalyzeButton.disabled = analyzingReferences || state.creationReferenceFiles.length === 0;
  refs.creationReferenceAnalyzeButton.classList.toggle("is-loading", analyzingReferences);
  refs.creationReferenceAnalyzeButton.replaceChildren(analyzingReferences ? "识别中" : "智能识别", ...(analyzingReferences ? [Object.assign(document.createElement("span"), { className: "creation-reference-analyze-spinner", ariaHidden: "true" })] : []));

  const analysis = state.creationReferenceAnalysis.result;
  refs.creationReferenceAnalysisPanel.classList.toggle("hidden", !analysis);
  refs.creationReferenceAnalysisList.replaceChildren();

  if (!analysis) {
    state.creationReferenceAnalysis.collapsed = false;
    refs.creationReferenceAnalysisPanel.classList.remove("is-collapsed");
    refs.creationReferenceAnalysisSummary.textContent = "--";
    refs.creationReferenceAnalysisSummary.classList.remove("hidden");
    refs.creationReferenceAnalysisMeta.textContent = "--";
    refs.creationReferenceAnalysisMeta.classList.remove("hidden");
    refs.creationReferenceAnalysisToggleButton.classList.add("hidden");
    refs.creationReferenceAnalysisToggleButton.disabled = true;
    refs.creationReferenceAnalysisToggleButton.setAttribute("aria-expanded", "false");
    refs.creationReferenceAnalysisToggleButton.textContent = "收起结果";
    refs.creationReferenceAnalysisList.classList.remove("hidden");
    syncCreationReferenceResetButton();
    return;
  }

  refs.creationReferenceAnalysisSummary.textContent = analysis.summary || "已识别套图参考图用途";
  refs.creationReferenceAnalysisMeta.textContent = [
    `${analysis.recommendations.length} 张已识别`,
    analysis.categoryTemplatePath || analysis.categoryPath || analysis.categoryHint
      ? `类目: ${analysis.categoryTemplatePath || analysis.categoryPath || analysis.categoryHint}`
      : "",
    state.creationReferenceAnalysis.applied ? "已自动应用" : "",
    state.creationReferenceAnalysis.dirty ? "参考图已变化" : "",
  ]
    .filter(Boolean)
    .join(" · ");
  refs.creationReferenceAnalysisToggleButton.classList.remove("hidden");
  refs.creationReferenceAnalysisToggleButton.disabled = false;
  refs.creationReferenceAnalysisToggleButton.setAttribute("aria-expanded", String(!state.creationReferenceAnalysis.collapsed));
  refs.creationReferenceAnalysisToggleButton.textContent = state.creationReferenceAnalysis.collapsed ? "展开结果" : "收起结果";
  refs.creationReferenceAnalysisPanel.classList.toggle("is-collapsed", state.creationReferenceAnalysis.collapsed);
  refs.creationReferenceAnalysisSummary.classList.toggle("hidden", state.creationReferenceAnalysis.collapsed);
  refs.creationReferenceAnalysisMeta.classList.toggle("hidden", state.creationReferenceAnalysis.collapsed);
  refs.creationReferenceAnalysisList.classList.toggle("hidden", state.creationReferenceAnalysis.collapsed);

  analysis.recommendations.forEach((entry) => {
    const item = document.createElement("article");
    item.className = "reference-analysis-card creation-reference-analysis-card";

    const title = document.createElement("strong");
    title.textContent = `${entry.filename} · ${entry.roleLabel || getCreationReferenceRoleLabel(entry.role)}`;
    item.appendChild(title);

    const note = document.createElement("p");
    note.textContent = entry.note || "已应用到参考图用途。";
    item.appendChild(note);

    if (entry.roleCorrectionReason) {
      const correction = document.createElement("p");
      correction.className = "creation-reference-analysis-role-correction";
      correction.textContent = entry.roleCorrectionReason;
      item.appendChild(correction);
    }

    refs.creationReferenceAnalysisList.appendChild(item);
  });

  analysis.risks.forEach((riskText) => {
    const risk = document.createElement("p");
    risk.className = "reference-analysis-risk";
    risk.textContent = riskText;
    refs.creationReferenceAnalysisList.appendChild(risk);
  });
  syncCreationReferenceResetButton();
}

async function buildCreationReferenceAnalysisFormData() {
  const formData = new FormData();
  formData.set(
    "reasoningEffort",
    CREATION_REFERENCE_ANALYSIS_REASONING_EFFORT,
  );
  const analysisFiles = await Promise.all(
    state.creationReferenceFiles.map((item) => preparePromptAnalysisImageFile(item.file)),
  );
  analysisFiles.forEach((file) => {
    formData.append("referenceImages", file);
  });
  formData.set("platform", getCreationSelectedPlatform().value);
  formData.set("platformLabel", getCreationSelectedPlatform().label);
  const selectedIndustryTemplate = getCreationSelectedIndustryTemplate();
  const contextIndustryTemplateValue = resolveCreationReferenceAnalysisContextCategoryValue({
    analysisDirty: state.creationReferenceAnalysis.dirty,
    categoryManuallyEdited: state.creationReferenceAnalysis.categoryManuallyEdited,
    categorySuggestionStale: state.creationReferenceAnalysis.categorySuggestionStale,
    currentCategoryValue: selectedIndustryTemplate.value,
    previousAutoCategoryValue: state.creationReferenceAnalysis.categoryTemplateSuggestion,
  });
  const contextIndustryTemplate = normalizeCreationIndustryTemplate(contextIndustryTemplateValue);
  formData.set("industryTemplate", contextIndustryTemplate.value);
  formData.set("industryTemplateLabel", contextIndustryTemplate.label);
  formData.set("industryTemplatePath", contextIndustryTemplate.categoryPath || "");
  formData.set("productName", refs.creationProductNameInput?.value?.trim() || "");
  formData.set("productDescription", refs.creationProductDescriptionInput?.value?.trim() || "");
  formData.set("sellingPoints", refs.creationSellingPointsInput?.value?.trim() || "");
  appendCurrentConfigToFormData(formData);
  return formData;
}

async function analyzeCreationReferenceImages() {
  clearError();
  if (state.creationReferenceFiles.length === 0) {
    setCreationReferenceAnalysisFeedback("请先上传套图参考图。", "error");
    return;
  }

  const referenceSnapshot = getCreationReferenceAnalysisSnapshot();
  const requestToken = creationReferenceAnalysisRequestToken + 1;
  creationReferenceAnalysisRequestToken = requestToken;
  creationReferenceAnalysisAbortController?.abort();
  const requestController = new AbortController();
  creationReferenceAnalysisAbortController = requestController;
  state.creationReferenceAnalysis.running = true;
  setCreationReferenceAnalysisFeedback("", "busy");
  renderCreationReferenceAnalysis();

  try {
    const response = await fetch("/api/creation/reference/analyze", {
      method: "POST",
      signal: requestController.signal,
      body: await buildCreationReferenceAnalysisFormData(),
    });
    const payload = await response.json().catch(() => ({}));
    if (requestToken !== creationReferenceAnalysisRequestToken || referenceSnapshot !== getCreationReferenceAnalysisSnapshot()) {
      return;
    }
    if (!response.ok) {
      throw new Error(payload.message || "套图参考图识别失败。");
    }

    creationReferenceAnalysisApplyGuard = () => requestToken === creationReferenceAnalysisRequestToken && referenceSnapshot === getCreationReferenceAnalysisSnapshot();
    // Compatibility shape retained for browser static contracts: applyCreationReferenceAnalysis(payload, { isCurrent })
    const { appliedMessage, categoryApplied, categoryCleared, matchedTemplate } = await applyCreationReferenceAnalysis(payload);
    creationReferenceAnalysisApplyGuard = null;
    if (requestToken !== creationReferenceAnalysisRequestToken || referenceSnapshot !== getCreationReferenceAnalysisSnapshot()) {
      return;
    }
    const categoryMessage = categoryApplied && matchedTemplate
      ? ` 类目已切换到 ${matchedTemplate.categoryPath || matchedTemplate.label}。`
      : categoryCleared
        ? " 本轮未识别到可靠商品类目，已恢复为通用电商。"
      : "";
    setCreationReferenceAnalysisFeedback(`${appliedMessage}${categoryMessage}`.trim(), "success");
  } catch (error) {
    if (requestToken !== creationReferenceAnalysisRequestToken || referenceSnapshot !== getCreationReferenceAnalysisSnapshot()) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    setCreationReferenceAnalysisFeedback(message, "error");
    showError(message);
  } finally {
    creationReferenceAnalysisApplyGuard = null;
    if (requestToken === creationReferenceAnalysisRequestToken) {
      creationReferenceAnalysisAbortController = null;
      state.creationReferenceAnalysis.running = false;
      renderCreationReferenceAnalysis();
    }
  }
}

function renderCreationRolePicker() {
  if (!refs.creationRoleGrid) {
    return;
  }

  const displayedPlanContext = getCreationDisplayedPlanContext();
  const compatibleImageTypes = getCreationCompatibleImageTypeState(displayedPlanContext.plan);
  if (compatibleImageTypes) {
    if (refs.creationRoleCount) {
      refs.creationRoleCount.textContent = `${compatibleImageTypes.enabledCount} / ${compatibleImageTypes.totalCount}`;
    }

    refs.creationRoleGrid.innerHTML = "";
    compatibleImageTypes.slots.forEach((slot) => {
      const label = document.createElement("label");
      label.className = "creation-role-option";
      label.classList.toggle("is-selected", slot.enabled !== false);

      const input = document.createElement("input");
      input.type = "checkbox";
      input.value = slot.role;
      input.checked = slot.enabled !== false;
      input.dataset.creationPlanSlotKey = slot.slotKey;

      const text = document.createElement("span");
      text.textContent = slot.imageTypeLabel || slot.title || slot.imageType || slot.role;

      label.append(input, text);
      refs.creationRoleGrid.appendChild(label);
    });
    return;
  }

  if (displayedPlanContext.pending) {
    if (refs.creationRoleCount) {
      refs.creationRoleCount.textContent = "待刷新";
    }
    refs.creationRoleGrid.replaceChildren();
    return;
  }

  const selectedRoles = getCreationSelectedRoles();
  const selectedRoleSet = new Set(selectedRoles);
  if (refs.creationRoleCount) {
    refs.creationRoleCount.textContent = `${selectedRoles.length} / ${CREATION_PREVIEW_SLOTS.length}`;
  }

  refs.creationRoleGrid.innerHTML = "";
  CREATION_PREVIEW_SLOTS.forEach((slot) => {
    const label = document.createElement("label");
    label.className = "creation-role-option";
    label.classList.toggle("is-selected", selectedRoleSet.has(slot.role));

    const input = document.createElement("input");
    input.type = "checkbox";
    input.value = slot.role;
    input.checked = selectedRoleSet.has(slot.role);
    input.dataset.creationRole = slot.role;

    const text = document.createElement("span");
    text.textContent = slot.title;

    label.append(input, text);
    refs.creationRoleGrid.appendChild(label);
  });
}

function buildCreationLogoBatchPreviewItems(status = "idle") {
  return state.creationLogoBatchFiles.map((item, index) => ({
    itemId: `logo-batch-preview-${index + 1}`,
    slotIndex: index + 1,
    role: "logo-batch",
    title: `加 Logo ${index + 1}`,
    brief: item.file?.name || "上传图加 Logo",
    status,
    imageUrl: status === "idle" ? item.previewUrl : "",
    thumbnailUrl: status === "idle" ? item.previewUrl : "",
    prompt: "",
  }));
}

function renderCreationQueueStrip() {
  renderCreationQueueStripView({ strip: refs.creationQueueStrip, queueJobs: getCreationQueueJobs(), selectedQueueId: state.creation.selectedQueueId, normalizeSet: normalizeCreationSetForView, getProgressSummary: getCreationProgressSummary, getStatusLabel: getCreationStatusLabel, formatClock });
}

function getCreationInlineListingRefs() { return { creationRecordListingDrafts: refs.creationInlineListingDrafts, creationRecordListingStatus: refs.creationInlineListingStatus }; }

async function restoreCurrentCreationPlatformRecommendations() {
  const modules = await ensureCreationPlatformModulesReady();
  const restoreCreationPlatformRecommendations = modules?.resolver?.restoreCreationPlatformRecommendations;
  if (typeof restoreCreationPlatformRecommendations !== "function") {
    throw new Error("平台自动规划模块不可用，无法恢复当前平台推荐。");
  }

  const currentPlan = getFrozenCreationEffectivePlan() || getCreationCurrentSet() || {};
  const currentPayload = getFrozenCreationPlatformPayload();
  const restored = restoreCreationPlatformRecommendations({
    platform: currentPlan.requestedPlatform || currentPlan.platform || getCreationSelectedPlatform().value,
    category: currentPlan.industryTemplate || getCreationSelectedIndustryTemplate(),
    categorySignals: currentPayload.values.categorySignals,
    referenceCoverage: currentPayload.values.platformReferenceCoverage,
    evidence: currentPayload.values.platformEvidence,
    skuSubjects: currentPlan.skuGenerationEnabled === false ? [] : currentPlan.skuSubjects || buildCreationSkuSubjectPayload(),
    infographicRebuildCount: currentPlan.infographicRebuildCount || 0,
    platformSetOverrides: {},
    platformItemOverrides: [],
  });
  const previousItems = Array.isArray(currentPlan.items) ? currentPlan.items : [];
  const previousItemsBySlotKey = new Map(previousItems.map((item) => [item.slotKey, item]));
  const restoredCarouselItems = restored.items.map((item) => ({
    ...(previousItemsBySlotKey.get(item.slotKey) || {}),
    ...item,
  }));
  const appendedItems = previousItems.filter((item) => {
    if (item.itemKind === "carousel" && item.role !== "sku" && item.role !== "infographic-rebuild") return false;
    if (item.itemKind === "sku" || item.role === "sku") return currentPlan.skuGenerationEnabled !== false;
    if (item.itemKind === "infographic-rebuild" || item.role === "infographic-rebuild") return currentPlan.infographicRebuildEnabled === true;
    return true;
  });
  const restoredPlan = {
    ...cloneCreationPlanValue(currentPlan, {}),
    ...restored,
    platformPolicyId: restored.platform,
    platformEvidenceLevel: restored.evidenceLevel,
    platformSetOverrides: {},
    platformItemOverrides: [],
    platformEvidence: restored.evidence,
    platformReferenceCoverage: restored.referenceCoverage,
    items: [...restoredCarouselItems, ...appendedItems],
  };
  hydrateCreationEffectivePlan(restoredPlan);
  const currentDraft = getCreationDraftSet();
  if (currentDraft) {
    const restoredDraft = normalizeCreationSetForView({
      ...currentDraft,
      ...restoredPlan,
      effectivePlan: restoredPlan,
      items: restoredPlan.items,
      updatedAt: nowIso(),
    });
    state.creation.draftSet = restoredDraft;
    if (!state.creation.generating) state.creation.currentSet = restoredDraft;
  }
  renderCreationView();
  await requestCreationPlanPreview();
}

const creationPlanPreviewRequests = createCreationPlanPreviewRequestCoordinator();

function requestCreationPlanPreview() {
  return creationPlanPreviewRequests.track(previewCreationPlan());
}

async function waitForPendingCreationPlanPreview() {
  await creationPlanPreviewRequests.waitForPending();
}

function refreshCreationPlanAfterSkuGenerationToggle() {
  state.creation.planDirty = true;
  renderCreationView();
  if (!hasCreationPlanPreviewInput()) return;
  requestCreationPlanPreview().catch((error) => setCreationFeedback(error.message, "error"));
}

function renderCreationPlatformPlan() {
  const displayedPlanContext = getCreationDisplayedPlanContext();
  const effectivePlan = displayedPlanContext.plan;
  const payload = effectivePlan ? createFrozenCreationPlatformPayload(effectivePlan) : getFrozenCreationPlatformPayload();
  const hasOverrides = Object.keys(payload.values.platformSetOverrides).length > 0 || payload.values.platformItemOverrides.length > 0;
  const plan = effectivePlan || null;
  const counts = getCreationPlatformPlanDisplayCounts(plan);
  const isPlanPending = displayedPlanContext.pending;

  if (refs.creationPlanSummary) {
    refs.creationPlanSummary.dataset.planState = isPlanPending ? "pending" : hasOverrides ? "overridden" : "automatic";
    const stateLabel = refs.creationPlanSummary.querySelector("[data-creation-plan-state-label]");
    if (stateLabel) stateLabel.textContent = isPlanPending ? "待刷新" : hasOverrides ? "已覆盖" : "自动";
    refs.creationPlanSummary.dataset.summaryText = plan
      ? `${plan.platformLabel || formatCreationPlatformLabel(plan.platform)} 自动方案 · 轮播 ${counts.carouselImageCount} + SKU ${counts.skuImageCount} + 重构 ${counts.infographicRebuildCount} = 总计 ${counts.totalPlannedItemCount}`
      : `当前轮播 ${counts.carouselImageCount} 张，SKU、重构和总计待刷新`;
    const platformLabel = refs.creationPlanSummary.querySelector("#creationPlanPlatformLabel");
    if (platformLabel) platformLabel.textContent = plan?.platformLabel || (plan ? formatCreationPlatformLabel(plan.platform) : "");
    [["#creationPlanCarouselCount", counts.carouselImageCount], ["#creationPlanSkuCount", counts.skuImageCount], ["#creationPlanRebuildCount", counts.infographicRebuildCount], ["#creationPlanTotalCount", counts.totalPlannedItemCount]].forEach(([selector, value]) => { const node = refs.creationPlanSummary.querySelector(selector); if (node) node.textContent = value === null ? "待刷新" : String(value); });
  }
  if (refs.creationPlanRestoreButton) {
    refs.creationPlanRestoreButton.disabled = !plan || !hasOverrides || state.creation.planning || isPlanPending;
  }
  if (refs.creationPlanWarnings) {
    const warnings = getVisibleCreationPlanWarnings(plan?.warnings);
    refs.creationPlanWarnings.replaceChildren(
      ...warnings.map((warning) => {
        const item = document.createElement("li");
        item.textContent = formatCreationPlanWarning(warning, plan.platformLabel || formatCreationPlatformLabel(plan.platform));
        return item;
      }),
    );
    refs.creationPlanWarnings.classList.toggle("hidden", warnings.length === 0);
  }
  if (refs.creationPlanValidation) {
    const errors = Array.isArray(plan?.errors) ? plan.errors : [];
    refs.creationPlanValidation.dataset.state = errors.length > 0 ? "blocking" : plan ? "valid" : "idle";
    refs.creationPlanValidation.textContent = errors.length > 0
      ? errors.map((error) => String(error?.message || error)).filter(Boolean).join("；")
      : plan ? "计划已通过生成前约束校验" : ""; refs.creationPlanValidation.classList.toggle("hidden", !plan);
  }
}

function renderCreationView() {
  syncGenerationSchedulingLock();
  if (!refs.creationResultGrid) {
    return;
  }

  syncCreationBranchPanels();
  const logoBatchBranch = isCreationLogoBatchBranch();
  const selectedQueueJob = logoBatchBranch ? null : getSelectedCreationQueueJob();
  const currentSet = getCreationDisplayedSet();
  if (refs.creationListingAgentEnabledInput) {
    refs.creationListingAgentEnabledInput.disabled = false;
    refs.creationListingAgentEnabledInput.title = "Listing";
  }
  const showCreationResultActions = !selectedQueueJob;
  syncCreationInfographicRebuildRequiredState();
  const previewSlots = logoBatchBranch
    ? buildCreationLogoBatchPreviewItems(state.creation.generating ? "queued" : "idle")
    : getCreationPreviewSlots(Number.isFinite(Number(currentSet?.imageCount)) ? Number(currentSet.imageCount) : getCreationSelectedImageCount());
  const items = currentSet?.items.length ? currentSet.items : previewSlots.map((slot, index) => ({
    ...slot,
    itemId: slot.itemId,
    slotIndex: index + 1,
    status: state.creation.generating ? "queued" : slot.status || "idle",
  }));
  const progress = currentSet
    ? getCreationProgressSummary(currentSet)
    : logoBatchBranch
      ? { total: state.creationLogoBatchFiles.length, completed: 0, failed: 0 }
      : getCreationProgressSummary(currentSet);
  const preparingReferences = hasPendingCreationBranchGenerationFiles();
  const targetLanguageLabel =
    currentSet?.targetLanguageLabel ||
    getCreationSelectedLanguage().label ||
    refs.creationTargetLanguageInput?.value ||
    "English";

  refs.creationGenerateButton.textContent = logoBatchBranch
    ? state.creation.generating
      ? "添加中..."
      : "批量添加 Logo"
    : state.creation.generating || getPendingCreationQueueCount() > 0
      ? "加入队列"
      : "生成套图";
  refs.creationGenerateButton.disabled = shouldDisableCreationGenerateButton({ planning: state.creation.planning, preparingReferences, effectivePlan: state.creation.effectivePlan });
  if (logoBatchBranch && state.creation.generating) {
    refs.creationGenerateButton.disabled = true;
  }
  if (refs.creationPlanButton) {
    refs.creationPlanButton.textContent = state.creation.planning ? "预览中..." : "预览计划";
    refs.creationPlanButton.disabled = state.creation.planning;
  }
  refs.creationProgressText.textContent = `${progress.completed} / ${progress.total}`;
  renderCreationRolePicker();
  renderCreationReferenceGrid();
  renderCreationLogoBatchSourceGrid();
  renderCreationLogo();
  renderCreationPlatformPlan();
  const currentIndustryLabel = currentSet?.industryTemplateLabel || CREATION_INDUSTRY_TEMPLATE_LABELS[currentSet?.industryTemplate] || "通用电商";
  const currentPlatformLabel = currentSet?.platformLabel || formatCreationPlatformLabel(currentSet?.platform);
  refs.creationSetMeta.textContent = currentSet
    ? `${currentSet.productName || "未命名商品"} · ${currentPlatformLabel} · ${currentIndustryLabel} · ${targetLanguageLabel} · ${CREATION_ITEM_STATUS_LABELS[currentSet.status] || currentSet.status} · ${formatClock(currentSet.createdAt)}`
    : logoBatchBranch
      ? state.creationLogoBatchFiles.length > 0
        ? `${state.creationLogoBatchFiles.length} 张待添加 Logo · ${getCreationLogoGenerationFile() ? "Logo 已上传" : "待上传 Logo"}`
        : "上传图片后批量添加 Logo"
      : "等待生成";

  renderCreationQueueStrip();
  renderCreationRecordDetail(currentSet);

  /* 队列 id 在整轮生成里不变，而 setId 会在首个流事件里从本地 id 换成服务端 id，
     所以进度作用域优先取队列 id：既能隔开队列之间，也不会在运行中途把进度清零。 */
  const loadingKeyScope =
    state.creation.generationScope === "logo-batch" && state.creation.logoBatchLoadingKey
      ? state.creation.logoBatchLoadingKey
      : selectedQueueJob?.id || currentSet?.setId || "";
  syncCreationResultGrid(items, {
    showActions: showCreationResultActions,
    keyScope: loadingKeyScope,
    logGroupId: currentSet?.setId || "",
  });
  renderCreationListingDrafts({ refs: getCreationInlineListingRefs(), state, set: currentSet });
}

function getCreationPlanPreviewImageCount(selectedRoles = getCreationSelectedRoles()) { return isCreationZeroImageCountMode() ? 0 : selectedRoles.length || getCreationSelectedImageCount(); }

function buildCreationPlanPreviewFormData() {
  const formData = new FormData();
  const effectivePlan = getFrozenCreationEffectivePlan();
  const frozenPayload = getFrozenCreationPlatformPayload();
  const targetLanguage = getCreationSelectedLanguage();
  const selectedRoles = getCreationSelectedRoles();

  formData.set("productName", refs.creationProductNameInput.value.trim());
  formData.set("productDescription", refs.creationProductDescriptionInput.value.trim());
  formData.set("sellingPoints", refs.creationSellingPointsInput.value.trim());
  formData.set("dimensionSpecs", refs.creationDimensionSpecsInput.value.trim());
  formData.set("dimensionUnitMode", refs.creationDimensionUnitModeInput.value || "both");
  formData.set("targetLanguage", targetLanguage.value);
  formData.set("imageCount", String(getCreationPlanPreviewImageCount(selectedRoles)));
  formData.set("skuGenerationEnabled", String(refs.creationSkuGenerationEnabledInput?.checked !== false));
  formData.set("infographicRebuildEnabled", String(isCreationInfographicRebuildRequired() || refs.creationInfographicRebuildEnabledInput?.checked === true));
  formData.set("platform", getCreationSelectedPlatform().value);
  formData.set("industryTemplate", resolveCreationReferenceAnalysisContextCategoryValue({ analysisDirty: state.creationReferenceAnalysis.dirty, categoryManuallyEdited: state.creationReferenceAnalysis.categoryManuallyEdited, categorySuggestionStale: state.creationReferenceAnalysis.categorySuggestionStale, currentCategoryValue: refs.creationIndustryTemplateInput.value, previousAutoCategoryValue: state.creationReferenceAnalysis.categoryTemplateSuggestion }));
  formData.set("selectedRoles", JSON.stringify(getCreationSelectedRoles()));
  formData.set("referenceImageRoles", JSON.stringify(buildCreationReferenceRolePayload()));
  formData.set("skuSubjects", JSON.stringify(buildCreationSkuSubjectPayload()));
  formData.set("skuBundleCount", refs.creationSkuBundleCountInput?.value || "1");
  formData.set("skuGenerationRule", getCreationSelectedSkuGenerationRule().value);
  const audienceStrategy = effectivePlan?.audienceStrategy || (
    state.creationReferenceAnalysis.applied && !state.creationReferenceAnalysis.dirty
      ? state.creationReferenceAnalysis.result?.audienceStrategy
      : null
  );
  if (audienceStrategy) formData.set("audienceStrategy", JSON.stringify(audienceStrategy));
  appendFrozenCreationPlatformPayload(formData);

  const roleSubmission = resolveCreationSelectedRolesSubmission({
    effectivePlan,
    platformSetOverrides: frozenPayload.values.platformSetOverrides,
    selectedRoles,
    roleSelectionManuallyEdited: state.creationRoleSelectionManuallyEdited,
  });
  if (roleSubmission.imageCount === null) formData.delete("imageCount");
  else formData.set("imageCount", String(roleSubmission.imageCount));
  if (roleSubmission.selectedRoles === null) formData.delete("selectedRoles");
  else formData.set("selectedRoles", JSON.stringify(roleSubmission.selectedRoles));
  if (!Object.prototype.hasOwnProperty.call(frozenPayload.values.platformSetOverrides, "targetLanguage")) {
    formData.delete("targetLanguage");
  }
  if (frozenPayload.values.platformSetOverrides.ratio) {
    formData.set("ratio", frozenPayload.values.platformSetOverrides.ratio);
  }
  if (frozenPayload.values.platformSetOverrides.resolutionTier) {
    formData.set("resolutionTier", frozenPayload.values.platformSetOverrides.resolutionTier);
  }

  return formData;
}

function getArticleIllustrationPlanSnapshot() {
  return JSON.stringify({
    title: refs.articleIllustrationTitleInput.value.trim(),
    sourceText: refs.articleIllustrationSourceTextInput.value.trim(),
    supplementalPrompt: refs.articleIllustrationSupplementInput.value.trim(),
    contentType: refs.articleIllustrationContentTypeInput.value || "auto",
    stylePreset: refs.articleIllustrationStylePresetInput.value || DEFAULT_ARTICLE_ILLUSTRATION_STYLE_PRESET,
    files: state.articleIllustration.files.map((item) => item.file ? buildReferenceFingerprint(item.file) : ""),
  });
}

function buildCreationFormData() {
  const formData = buildCreationPlanPreviewFormData();
  const effectivePlan = getFrozenCreationEffectivePlan();
  if (effectivePlan) formData.set("effectivePlan", JSON.stringify(effectivePlan));

  formData.set("format", normalizeOutputFormat(refs.creationOutputFormatInput.value || state.config?.defaults?.format || "png"));
  if (!effectivePlan) {
    formData.set("ratio", refs.creationRatioInput.value || DEFAULT_UI_RATIO);
    formData.set("size", refs.creationSizeInput.value || "auto");
  }
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("clientSessionId", state.clientSessionId);
  state.creationReferenceFiles.forEach((item) => {
    const file = getCreationReferenceGenerationFile(item);
    if (file) {
      formData.append("referenceImages", file);
    }
  });
  appendCurrentConfigToFormData(formData);

  return formData;
}

function buildCreationLogoBatchFormData() {
  const formData = new FormData();
  const firstSourceName = state.creationLogoBatchFiles[0]?.file?.name || "";
  const title = firstSourceName ? `上传图加 Logo ${firstSourceName}` : "上传图加 Logo";

  formData.set("title", title);
  formData.set("format", normalizeOutputFormat(refs.creationOutputFormatInput.value || state.config?.defaults?.format || "png"));
  formData.set("ratio", refs.creationRatioInput.value || DEFAULT_UI_RATIO);
  formData.set("size", refs.creationSizeInput.value || "auto");
  formData.set("reasoningEffort", refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("clientSessionId", state.clientSessionId);
  formData.set("logoOptions", JSON.stringify(getCreationLogoPayload()));
  state.creationLogoBatchFiles.forEach((item) => {
    const file = getCreationLogoBatchSourceGenerationFile(item);
    if (file) {
      formData.append("sourceImages", file);
    }
  });
  const logoFile = getCreationLogoGenerationFile();
  if (logoFile) {
    formData.append("logoImage", logoFile);
  }
  appendCurrentConfigToFormData(formData);

  return formData;
}

function applyCreationRepairTargetFormFields(formData, set = {}) { Object.entries({ productName: set.productName || "", productDescription: set.productDescription || "", sellingPoints: Array.isArray(set.sellingPoints) ? set.sellingPoints.join("\n") : String(set.sellingPoints || ""), dimensionSpecs: set.dimensionSpecs || "", dimensionUnitMode: set.dimensionUnitMode || "both", targetLanguage: set.targetLanguage || "en", platform: set.platform || "universal", scenario: set.scenario || "standard", visualLanguage: set.visualLanguage || "classic-commercial", industryTemplate: set.industryTemplate || "general", selectedRoles: JSON.stringify(Array.isArray(set.selectedRoles) ? set.selectedRoles : []), skuGenerationEnabled: String(set.skuGenerationEnabled !== false), infographicRebuildEnabled: String(set.infographicRebuildEnabled === true), skuSubjects: JSON.stringify(Array.isArray(set.skuSubjects) ? set.skuSubjects : []), skuBundleCount: String(set.skuBundleCount || 1), skuGenerationRule: set.skuGenerationRule || DEFAULT_CREATION_SKU_GENERATION_RULE }).forEach(([key, value]) => formData.set(key, value)); }

function shouldUseCreationRepairDraftFiles(set = {}) {
  const setId = String(set.setId || "");
  return Boolean(setId && setId === String(getCreationDraftSet()?.setId || ""));
}

function buildCreationRepairFormData({ itemId = "", scope = "incomplete", set = getCreationRepairTargetSet(), autoRepair = false } = {}) {
  const formData = new FormData();
  const currentSet = set ? normalizeCreationSetForView(set) : getCreationCurrentSet();
  const useDraftFiles = shouldUseCreationRepairDraftFiles(currentSet);
  const snapshotItem = currentSet?.items.find((item) => !itemId || item.itemId === itemId) || currentSet?.items[0] || {};

  formData.set("setId", currentSet?.setId || "");
  applyCreationRepairTargetFormFields(formData, currentSet);
  if (itemId) {
    formData.set("itemId", itemId);
  } else {
    formData.set("scope", scope);
  }
  formData.set("format", normalizeOutputFormat(snapshotItem.format || "png"));
  formData.set("ratio", snapshotItem.ratio || DEFAULT_UI_RATIO);
  formData.set("size", snapshotItem.effectiveSize || snapshotItem.requestedSize || snapshotItem.size || "auto");
  formData.set("reasoningEffort", snapshotItem.reasoningEffort || "xhigh");
  formData.set("clientSessionId", state.clientSessionId);
  formData.set("referenceImageRoles", JSON.stringify(useDraftFiles ? getCreationRepairReferenceRolePayload(currentSet) : currentSet?.referenceImageRoles || []));
  if (useDraftFiles) {
    state.creationReferenceFiles.forEach((item) => {
      const file = getCreationReferenceGenerationFile(item);
      if (file) formData.append("referenceImages", file);
    });
  }
  appendCurrentConfigToFormData(formData);
  if (autoRepair) formData.set("autoRepair", "1");

  return formData;
}

// Chunk assembly lives on the per-stream context so concurrent items in one set
// accumulate independently and nothing leaks into the next set.
function getCreationFinalImageChunks(context = {}) {
  if (!context.finalImageChunks) {
    context.finalImageChunks = new Map();
  }
  return context.finalImageChunks;
}

// Previews assemble in their own store: they share the set::item key with the final
// image but are replaced repeatedly, so mixing the two would let a preview chunk
// land in the final image's slot.
function getCreationPartialImageChunks(context = {}) {
  if (!context.partialImageChunks) {
    context.partialImageChunks = new Map();
  }
  return context.partialImageChunks;
}

/* 批量板块日志：一个批次 id 一条组行，补齐与单项重试沿用原 id，写回同一组而不新开顶层行。 */
function recordBatchLogEvent({ channel, groupId, groupLabel, groupUnit, set = null, itemId, itemTitle, status, detail, imageUrl, at, totalCount } = {}) {
  const normalizedGroupId = String(groupId || set?.setId || "").trim();
  if (!normalizedGroupId) {
    return;
  }

  const items = Array.isArray(set?.items) ? set.items : [];
  const item = items.find((entry) => entry.itemId === itemId) || null;
  recordGroupActivity({
    channel,
    groupId: normalizedGroupId,
    groupLabel,
    groupUnit,
    totalCount: totalCount ?? (getFiniteCreationImageCount(set?.imageCount) ?? items.length),
    groupItemId: itemId || "",
    title: itemTitle || itemId || "生成项",
    detail,
    status,
    ratio: item?.ratio || set?.ratio || "",
    size: item?.size || set?.size || "",
    modeLabel: formatGenerationActivityModeLabel(set?.imageRoute || getSelectedImageRoute()),
    imageUrl,
    relayUrl: resolveGenerationRelayUrl(set || {}),
    at,
  });
}

function recordCreationLogEvent({ setId, itemId, status, detail, title, imageUrl, at, set = null, context = {} } = {}) {
  const currentSet = set || getCreationStreamCurrentSet(context) || getCreationCurrentSet();
  const items = Array.isArray(currentSet?.items) ? currentSet.items : [];
  const item = items.find((entry) => entry.itemId === itemId) || null;
  recordBatchLogEvent({
    channel: "creation",
    groupId: setId || currentSet?.setId,
    groupLabel: `套图 · ${currentSet?.productName || "未命名商品"}`,
    set: currentSet,
    itemId,
    itemTitle: title || getCreationItemDisplayTitle(item || {}, itemId || "套图项"),
    status,
    detail,
    imageUrl,
    at,
  });
}

function recordPortraitLogEvent({ setId, itemId, status, detail, imageUrl, at, set = null } = {}) {
  const currentSet = set || getPortraitCurrentSet();
  recordBatchLogEvent({
    channel: "portrait",
    groupId: setId || currentSet?.setId,
    groupLabel: `写真 · ${getPortraitSetDisplayTitle(currentSet || {}) || "未命名写真"}`,
    set: currentSet,
    itemId,
    itemTitle: itemId || "写真图",
    status,
    detail,
    imageUrl,
    at,
  });
}

async function handleCreationStreamEvent(eventName, payload = {}, context = {}) {
  if (eventName === "repair_started") {
    upsertCreationSetForStream(payload.set, context);
    setCreationFeedback("正在补齐套图项...", "busy");
    renderCreationView();
    return;
  }

  if (eventName === "set_started") {
    upsertCreationSetForStream(payload.set, context);
    setCreationFeedback(`套图任务已创建，正在生成 ${getFiniteCreationImageCount(payload.set?.imageCount) ?? getCreationSelectedImageCount()} 张营销图。`, "busy");
    (Array.isArray(payload.set?.items) ? payload.set.items : []).forEach((item) => {
      recordCreationLogEvent({
        setId: payload.set?.setId,
        itemId: item.itemId,
        status: "pending",
        detail: buildGenerationTaskActivityDetail({ statusStage: "queued", statusText: "等待后台生成" }),
        set: payload.set,
        context,
      });
    });
    renderCreationView();
    return;
  }

  if (eventName === "plan") {
    const currentSet = getCreationStreamCurrentSet(context);
    if (payload.setId && currentSet?.setId !== payload.setId && Array.isArray(payload.items)) {
      upsertCreationSetForStream({
        ...currentSet,
        setId: payload.setId,
        items: payload.items,
      }, context);
    }
    renderCreationView();
    return;
  }

  if (eventName === "item_started") {
    const itemPatch = {
      status: "generating",
      updatedAt: nowIso(),
    };
    if (!shouldApplyCreationStreamItemUpdate(payload.itemId, itemPatch, context)) return;
    updateCreationStreamItem(payload.itemId, itemPatch, context);
    setCreationFeedback(`正在生成 ${payload.role || payload.itemId}。`, "busy");
    recordCreationLogEvent({ setId: payload.setId, itemId: payload.itemId, status: "active", detail: "正在生成图片", context });
    renderCreationView();
    return;
  }

  if (eventName === "item_status") {
    const itemPatch = {
      status: "generating",
      updatedAt: nowIso(),
    };
    if (!shouldApplyCreationStreamItemUpdate(payload.itemId, itemPatch, context)) return;
    updateCreationStreamItem(payload.itemId, itemPatch, context);
    /* 心跳不进反馈条：上游每 15 秒推来的文本完全相同，写进去会把
       「正在生成第 N 张」这类真正有信息的状态顶掉，只剩一句反复刷新的等待提示。 */
    if (payload.message && !hasHeartbeatPrefix(payload.message)) {
      setCreationFeedback(payload.message, "busy");
    }
    recordCreationLogEvent({
      setId: payload.setId,
      itemId: payload.itemId,
      status: "active",
      detail: buildGenerationTaskActivityDetail({ statusStage: payload.stage, statusText: payload.message, fallback: "正在生成图片" }),
      context,
    });
    renderCreationView();
    /* 心跳的回执是图标变形，不是文字。必须放在 renderCreationView 之后：
       卡片可能刚被这次渲染建出来，先变形会落在一个还不存在的壳上。 */
    if (hasHeartbeatPrefix(payload.message)) {
      beatCreationCardHeartbeat(refs.creationResultGrid, payload.itemId);
    }
    return;
  }

  if (eventName === "item_partial_image") {
    const itemPatch = {
      status: "generating",
      imageUrl: payload.dataUrl,
      thumbnailUrl: payload.dataUrl,
      updatedAt: nowIso(),
    };
    if (!shouldApplyCreationStreamItemUpdate(payload.itemId, itemPatch, context)) return;
    updateCreationStreamItem(payload.itemId, itemPatch, context);
    renderCreationView();
    return;
  }

  if (eventName === CREATION_STREAM_EVENTS.ITEM_PARTIAL_IMAGE_CHUNK) {
    const dataUrl = recordPartialImageChunk(getCreationPartialImageChunks(context), payload);
    if (dataUrl) {
      const itemPatch = {
        status: "generating",
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
        updatedAt: nowIso(),
      };
      if (!shouldApplyCreationStreamItemUpdate(payload.itemId, itemPatch, context)) return;
      updateCreationStreamItem(payload.itemId, itemPatch, context);
      renderCreationView();
    }
    return;
  }

  if (eventName === CREATION_STREAM_EVENTS.ITEM_FINAL_IMAGE_CHUNK) {
    const dataUrl = recordFinalImageChunk(getCreationFinalImageChunks(context), payload);
    if (dataUrl) {
      const itemPatch = {
        status: "generating",
        imageUrl: dataUrl,
        thumbnailUrl: dataUrl,
        updatedAt: nowIso(),
      };
      if (!shouldApplyCreationStreamItemUpdate(payload.itemId, itemPatch, context)) return;
      updateCreationStreamItem(payload.itemId, itemPatch, context);
      renderCreationView();
    }
    return;
  }

  if (eventName === CREATION_STREAM_EVENTS.ITEM_FINAL_IMAGE) {
    // Chunks arrive before this event and already carry the image. A legacy server
    // that still inlines dataUrl keeps working; a chunk-only payload just refreshes
    // the item's metadata without clearing an assembled preview.
    const itemPatch = {
      status: "generating",
      ...(payload.dataUrl ? { imageUrl: payload.dataUrl, thumbnailUrl: payload.dataUrl } : {}),
      ...(payload.partialImageFallback ? { partialImageFallback: true } : {}),
      updatedAt: nowIso(),
    };
    if (!shouldApplyCreationStreamItemUpdate(payload.itemId, itemPatch, context)) return;
    updateCreationStreamItem(payload.itemId, itemPatch, context);
    renderCreationView();
    return;
  }

  if (eventName === "item_saved") {
    if (payload.set) {
      upsertCreationSetForStream(payload.set, context);
    } else if (payload.item) {
      const itemPatch = {
        ...payload.item,
        status: "completed",
        updatedAt: nowIso(),
      };
      if (!shouldApplyCreationStreamItemUpdate(payload.item.itemId, itemPatch, context)) return;
      updateCreationStreamItem(payload.item.itemId, itemPatch, context);
    }
    setCreationFeedback("已生成一张套图。", "success");
    recordCreationLogEvent({
      setId: payload.setId || payload.set?.setId,
      itemId: payload.item?.itemId || payload.itemId,
      status: "done",
      detail: "图像已成功生成",
      imageUrl: getImageUrl(payload.item),
      set: payload.set,
      context,
    });
    renderCreationView();
    return;
  }

  if (eventName === "item_requeued") {
    const itemPatch = {
      status: "queued",
      error: "",
      updatedAt: nowIso(),
    };
    const shouldApplyItemUpdate = shouldApplyCreationStreamItemUpdate(payload.itemId, itemPatch, context);
    if (payload.set) {
      upsertCreationSetForStream(payload.set, context);
    } else if (payload.itemId) {
      if (!shouldApplyItemUpdate) return;
      updateCreationStreamItem(payload.itemId, itemPatch, context);
    }
    if (!shouldApplyItemUpdate) {
      renderCreationView();
      return;
    }
    const requeueNotice = payload.notice || getRequeueNotice({
      message: payload.message,
      attempt: payload.attempt,
      maxRetries: payload.maxRetries,
    });
    setCreationFeedback(requeueNotice, "busy");
    recordCreationLogEvent({
      setId: payload.setId || payload.set?.setId,
      itemId: payload.itemId,
      status: "pending",
      detail: buildGenerationTaskActivityDetail({ statusStage: "queued", statusText: requeueNotice }),
      set: payload.set,
      context,
    });
    renderCreationView();
    return;
  }

  if (eventName === "item_failed") {
    const itemPatch = {
      status: "failed",
      error: payload.message || "",
      updatedAt: nowIso(),
    };
    const shouldApplyItemUpdate = shouldApplyCreationStreamItemUpdate(payload.itemId, itemPatch, context);
    if (payload.set) {
      upsertCreationSetForStream(payload.set, context);
    } else if (payload.itemId) {
      if (!shouldApplyItemUpdate) return;
      updateCreationStreamItem(payload.itemId, itemPatch, context);
    }
    if (!shouldApplyItemUpdate) {
      renderCreationView();
      return;
    }
    const autoRepairAttemptCount = context.queueJob?.autoRepairAttemptCount ?? state.creation.autoRepairAttemptCount;
    const currentSet = getCreationStreamCurrentSet(context);
    const failedItemCanAutoRepair = getCreationAutoRepairableItems(currentSet)
      .some((item) => item.itemId === payload.itemId);
    const shouldAnnounceAutoRepair = failedItemCanAutoRepair && shouldAutoRepairCreationSet({
      set: currentSet,
      generationScope: state.creation.generationScope,
      autoRepairAttemptCount,
      canRepair: canRepairCreationSet(currentSet),
    });
    if (shouldAnnounceAutoRepair) {
      setCreationFeedback(payload.message ? `${payload.message}，完成后将自动补图。` : "有套图项失败，完成后将自动补图。", "busy");
    } else {
      setCreationFeedback(payload.message || "套图生成失败。", "error");
    }
    const failureDetail = compactErrorMessage(payload.message, "生成请求失败");
    recordCreationLogEvent({
      setId: payload.setId || payload.set?.setId,
      itemId: payload.itemId,
      status: "error",
      detail: buildGenerationTaskActivityDetail({ status: "error", statusStage: "error", statusText: failureDetail, errorMessage: failureDetail }),
      set: payload.set,
      context,
    });
    renderCreationView();
    return;
  }

  if (eventName === "complete") {
    let completedSet = payload.set || getCreationStreamCurrentSet(context);
    if (payload.set) {
      completedSet = upsertCreationSetForStream(payload.set, context) || payload.set;
      if (!context.queueJob && await runCreationAutoRepairIfNeeded(completedSet)) {
        renderCreationView();
        return;
      }
      if (shouldAutoGenerateCreationListings(completedSet, context.queueJob) && payload.set?.setId) {
        state.creation.recordSetId = payload.set.setId;
        setCreationFeedback("套图生成完成，正在自动生成 Listing...", "busy");
        creationListingController.generate(payload.set.setId)
          .then((nextSet) => { if (nextSet) { setCreationFeedback("套图与 Listing 已生成。", "success"); renderCreationView(); } })
          .catch((error) => {
            setCreationFeedback(compactErrorMessage(error instanceof Error ? error.message : String(error), "Listing 自动生成失败"), "error");
          });
        renderCreationView();
        return;
      }
    }
    const completion = getCreationCompletionFeedback(completedSet); setCreationFeedback(completion.message, completion.tone);
    renderCreationView();
    return;
  }

  if (eventName === "error") {
    const message = compactErrorMessage(payload.message, "套图生成请求失败");
    const currentSet = getCreationStreamCurrentSet(context);
    if (currentSet) {
      upsertCreationSetForStream({
        ...currentSet,
        status: "failed",
        updatedAt: nowIso(),
        items: currentSet.items.map((item) =>
          item.status === "completed"
            ? item
            : {
                ...item,
                status: "failed",
                error: message,
              },
        ),
      }, context);
    }
    setCreationFeedback(message, "error");
    showError(message);
    renderCreationView();
  }
}

async function runCreationStream(response, context = {}) {
  try {
    return await consumeSseUntilTerminal({
      stream: response.body,
      consumeSse,
      onEvent: async (eventName, payload) => {
        await handleCreationStreamEvent(eventName, payload, context);
        await context.onEventHandled?.(eventName, payload);
      },
      missingTerminalMessage: "套图生成连接已中断，未收到完成事件。",
    });
  } finally {
    clearFinalImageChunks(getCreationFinalImageChunks(context));
    clearFinalImageChunks(getCreationPartialImageChunks(context));
  }
}

async function runCreationQueuedRepairRequest(queueJob, { itemId = "", scope = "incomplete", set, autoRepair = false } = {}) {
  const currentSet = set ? normalizeCreationSetForView(set) : normalizeCreationSetForView(queueJob?.set);
  const body = buildCreationQueuedRepairFormData(queueJob, { itemId, scope, set: currentSet, autoRepair });
  const response = await fetch("/api/creation/repair", { method: "POST", body });
  if (response.status === 404) throw new Error("当前部署不支持套图补图。");
  if (!response.ok || !response.body) throw new Error("套图补图请求失败");
  await runCreationStream(response, { queueJob });
  await loadCreationSets();
}

async function runCreationRepairRequest({ itemId = "", scope = "incomplete", set = getCreationRepairTargetSet(), streamContext = null, autoRepair = false } = {}) {
  const currentSet = set ? normalizeCreationSetForView(set) : getCreationRepairTargetSet(), queueJob = getCreationQueueJobForSet(currentSet);
  if (!streamContext && queueJob?.formData && typeof queueJob.formData.entries === "function") { await runCreationQueuedRepairRequest(queueJob, { itemId, scope, set: currentSet, autoRepair }); return; }
  if (shouldUseCreationRepairDraftFiles(currentSet)) await ensureCreationReferenceGenerationFilesReady();
  const response = await fetch("/api/creation/repair", { method: "POST", body: buildCreationRepairFormData({ itemId, scope, set: currentSet, autoRepair }) });
  if (response.status === 404) throw new Error("当前部署不支持套图补图。");
  if (!response.ok || !response.body) throw new Error("套图补图请求失败");
  await runCreationStream(response, streamContext || {});
  await loadCreationSets();
}
async function runCreationAutoRepairIfNeeded(set = getCreationCurrentSet()) {
  const currentSet = set ? normalizeCreationSetForView(set) : getCreationCurrentSet(); if (!shouldAutoRepairCreationSet({ set: currentSet, generationScope: state.creation.generationScope, autoRepairAttemptCount: state.creation.autoRepairAttemptCount, canRepair: canRepairCreationSet(currentSet) })) return false;
  const nextAttempt = state.creation.autoRepairAttemptCount + 1; state.creation.autoRepairAttemptCount = nextAttempt;
  setCreationFeedback(getCreationAutoRepairNotice({ incompleteCount: getCreationIncompleteItems(currentSet).length, attemptCount: nextAttempt }), "busy");
  renderCreationView(); await runCreationRepairRequest({ scope: "incomplete", set: currentSet, autoRepair: true }); return true;
}

async function runCreationQueuedAutoRepairIfNeeded(queueJob) {
  const currentSet = queueJob?.set ? normalizeCreationSetForView(queueJob.set) : null;
  if (!shouldAutoRepairCreationSet({
    set: currentSet,
    generationScope: "full",
    autoRepairAttemptCount: queueJob?.autoRepairAttemptCount || 0,
    canRepair: canRepairCreationSet(currentSet),
  })) {
    return false;
  }

  queueJob.autoRepairAttemptCount = (queueJob.autoRepairAttemptCount || 0) + 1;
  setCreationFeedback(getCreationAutoRepairNotice({
    incompleteCount: getCreationIncompleteItems(currentSet).length,
    attemptCount: queueJob.autoRepairAttemptCount,
  }), "busy");
  renderCreationView();

  const response = await fetch("/api/creation/repair", {
    method: "POST",
    body: buildCreationQueuedRepairFormData(queueJob, { scope: "incomplete", set: currentSet, autoRepair: true }),
  });
  if (response.status === 404) throw new Error("当前部署不支持套图补图。");
  if (!response.ok || !response.body) throw new Error("套图补图请求失败");
  await runCreationStream(response, { queueJob, onEventHandled: () => scheduleCreationGenerationQueue() });
  return true;
}

async function loadCreationSets() {
  state.assetLoading.creation = true;
  state.assetLoadErrors.creation = "";
  renderCreationRecordView();
  let response;
  try {
    response = await fetch("/api/creation/sets", { cache: "no-store" });
  } catch (error) {
    state.assetLoading.creation = false;
    state.assetLoadErrors.creation = error instanceof Error ? error.message : String(error);
    renderCreationRecordView();
    throw error;
  }
  if (response.status === 404) {
    state.assetLoading.creation = false;
    state.creation.sets = [];
    state.creation.recordCheckedSetIds = [];
    state.creation.recordSetId = "";
    renderCreationView();
    renderCreationRecordView();
    return;
  }

  if (!response.ok) {
    state.assetLoading.creation = false;
    state.assetLoadErrors.creation = "读取套图记录失败";
    renderCreationRecordView();
    throw new Error("读取套图记录失败");
  }

  const payload = await response.json();
  const currentSet = state.creation.currentSet;
  const previousSetsById = new Map(
    [...state.creation.sets, currentSet]
      .filter((set) => set?.setId)
      .map((set) => [String(set.setId), set]),
  );
  const nextSets = Array.isArray(payload)
    ? payload
        .map((set) => mergeCreationSetPreviews(set, previousSetsById.get(String(set?.setId || "")) || null))
        .map(normalizeCreationSetForView)
        .filter(Boolean)
    : [];
  const currentSetId = currentSet?.setId || "";
  state.creation.sets = nextSets;
  const nextSetIds = new Set(nextSets.map((set) => set.setId));
  state.creation.recordCheckedSetIds = state.creation.recordCheckedSetIds.filter((setId) => nextSetIds.has(setId));
  state.assetLoading.creation = false;
  state.assetLoadErrors.creation = "";
  if (currentSetId) {
    const matchedCurrentSet = nextSets.find((set) => set.setId === currentSetId);
    if (matchedCurrentSet) {
      state.creation.currentSet = normalizeCreationSetForView(matchedCurrentSet);
    }
  }
  if (state.creation.recordSetId && !nextSets.some((set) => set.setId === state.creation.recordSetId)) {
    state.creation.recordSetId = "";
  }
  renderCreationView();
  renderCreationRecordView();
}

function hasCreationPlanPreviewInput() {
  return Boolean(
    refs.creationProductNameInput.value.trim() ||
    refs.creationProductDescriptionInput.value.trim() ||
    getCreationSellingPoints(refs.creationSellingPointsInput.value).length > 0
  );
}

async function previewCreationPlan() {
  clearError();
  setCreationFeedback("");

  const productName = refs.creationProductNameInput.value.trim();
  const productDescription = refs.creationProductDescriptionInput.value.trim();
  const sellingPoints = getCreationSellingPoints(refs.creationSellingPointsInput.value);
  if (!productName && !productDescription && sellingPoints.length === 0) {
    const message = "请至少填写商品名称、商品描述或核心卖点。";
    setCreationFeedback(message, "error");
    showError(message);
    return;
  }

  const request = creationPlanPreviewRequests.begin();
  state.creation.planning = true;
  setCreationFeedback("正在生成套图计划...", "busy");
  renderCreationView();

  try {
    const response = await fetch("/api/creation/plan", {
      method: "POST",
      body: buildCreationPlanPreviewFormData(),
      signal: request.signal,
    });
    const payload = await response.json().catch(() => ({}));
    if (!creationPlanPreviewRequests.isCurrent(request.revision)) return;
    if (!response.ok) {
      throw new Error(payload.message || "套图计划生成失败");
    }

    const plan = payload.plan || {};
    const effectivePlan = hydrateCreationEffectivePlan(plan);
    const createdAt = nowIso();
    const previousDraft = getCreationDraftSet();
    const items = Array.isArray(plan.items)
      ? plan.items.map((item, index) => ({
          ...item,
          slotIndex: item.slotIndex || index + 1,
          status: "idle",
        }))
      : [];
    const planImageCount = getFiniteCreationImageCount(plan.imageCount);

    const nextDraftSet = normalizeCreationSetForView({
      ...effectivePlan,
      setId: previousDraft?.setId || `creation-draft-${Date.now()}`,
      productName: plan.productName || productName,
      productDescription: plan.productDescription || productDescription,
      sellingPoints: plan.sellingPoints || sellingPoints,
      dimensionSpecs: plan.dimensionSpecs || refs.creationDimensionSpecsInput.value.trim(),
      dimensionUnitMode: plan.dimensionUnitMode || getCreationSelectedDimensionUnitMode(),
      dimensionUnitModeLabel: plan.dimensionUnitModeLabel || formatCreationDimensionUnitModeLabel(getCreationSelectedDimensionUnitMode()),
      targetLanguage: plan.targetLanguage || getCreationSelectedLanguage().value,
      targetLanguageLabel: plan.targetLanguageLabel || getCreationSelectedLanguage().label,
      platform: plan.platform || getCreationSelectedPlatform().value,
      platformLabel: plan.platformLabel || getCreationSelectedPlatform().label,
      imageCount: planImageCount ?? (items.length || getCreationSelectedRoles().length),
      scenario: plan.scenario || getCreationSelectedScenario().value,
      scenarioLabel: plan.scenarioLabel || getCreationSelectedScenario().label,
      visualLanguage: plan.visualLanguage || "classic-commercial",
      visualLanguageLabel: plan.visualLanguageLabel || formatCreationVisualLanguageLabel("classic-commercial"),
      industryTemplate: plan.industryTemplate || getCreationSelectedIndustryTemplate().value,
      industryTemplateLabel: plan.industryTemplateLabel || getCreationSelectedIndustryTemplate().label,
      industryTemplatePath: plan.industryTemplatePath || getCreationSelectedIndustryTemplate().categoryPath,
      selectedRoles: plan.selectedRoles || getCreationSelectedRoles(),
      referenceImageNames: state.creationReferenceFiles.map((item) => item.file?.name || "").filter(Boolean),
      referenceImageRoles: plan.referenceImageRoles || buildCreationReferenceRolePayload(),
      skuSubjects: plan.skuSubjects || buildCreationSkuSubjectPayload(),
      skuBundleCount: plan.skuBundleCount || normalizeCreationSkuBundleCountForPayload(refs.creationSkuBundleCountInput?.value || "1"),
      skuGenerationRule: plan.skuGenerationRule || getCreationSelectedSkuGenerationRule().value,
      skuGenerationRuleLabel: plan.skuGenerationRuleLabel || getCreationSelectedSkuGenerationRule().label,
      logo: plan.logo || getCreationLogoPayload(),
      createdAt: previousDraft?.createdAt || createdAt,
      updatedAt: createdAt,
      status: "planning",
      effectivePlan,
      items,
    });
    state.creation.draftSet = nextDraftSet;
    if (!state.creation.generating) {
      state.creation.currentSet = nextDraftSet;
    }
    setCreationFeedback(`已生成 ${items.length} 张套图计划。`, "success");
  } catch (error) {
    if (error?.name === "AbortError" || !creationPlanPreviewRequests.isCurrent(request.revision)) return;
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "套图计划生成失败");
    setCreationFeedback(message, "error");
    showError(message);
  } finally {
    if (creationPlanPreviewRequests.finish(request.revision)) {
      state.creation.planning = false;
      renderCreationView();
    }
  }
}

async function startCreationLogoBatchGeneration() {
  if (state.creation.generating || state.creation.planning) {
    return;
  }

  clearError();
  setCreationFeedback("");

  if (state.creationLogoBatchFiles.length === 0) {
    const message = "请先上传需要添加 Logo 的图片。";
    setCreationFeedback(message, "error");
    showError(message);
    return;
  }
  if (!getCreationLogoGenerationFile()) {
    const message = "请先上传 Logo。";
    setCreationFeedback(message, "error");
    showError(message);
    return;
  }

  state.creation.generating = true;
  state.creation.generationScope = "logo-batch";
  state.creation.logoBatchLoadingKey = `creation-logo-batch-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  renderCreationView();

  try {
    await ensureCreationLogoBatchGenerationFilesReady();
    const logoBatchFormData = buildCreationLogoBatchFormData();
    const createdAt = nowIso();
    const logoPayload = getCreationLogoPayload();
    const sourceNames = state.creationLogoBatchFiles.map((item) => item.file?.name || "").filter(Boolean);
    const items = buildCreationLogoBatchPreviewItems("queued");
    state.creation.currentSet = normalizeCreationSetForView({
      setId: `creation-local-${Date.now()}`,
      productName: logoBatchFormData.get("title") || "上传图加 Logo",
      productDescription: "将上传图片分别添加同一个 Logo。",
      dimensionUnitMode: "both",
      targetLanguage: "en",
      targetLanguageLabel: "English",
      imageCount: items.length,
      scenario: "logo-batch",
      scenarioLabel: "上传图加 Logo",
      industryTemplate: "general",
      industryTemplateLabel: "通用电商",
      selectedRoles: ["logo-batch"],
      referenceImageNames: sourceNames,
      logo: logoPayload,
      createdAt,
      updatedAt: createdAt,
      status: "generating",
      items,
    });
    renderCreationView();

    const response = await fetch("/api/creation/logo-batch", {
      method: "POST",
      body: logoBatchFormData,
    });
    if (!response.ok || !response.body) {
      throw new Error("上传图加 Logo 请求失败");
    }

    await runCreationStream(response);
    await loadCreationSets();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "上传图加 Logo 请求失败");
    setCreationFeedback(message, "error");
    showError(message);
  } finally {
    releaseCreationLoadingSources({ queueId: state.creation.logoBatchLoadingKey });
    state.creation.logoBatchLoadingKey = "";
    state.creation.generating = false;
    state.creation.generationScope = "";
    renderCreationView();
  }
}

function buildCreationQueuedSet(input = {}) { return { ...buildCreationQueuedSetFromState({ ...input, buildCreationReferenceRolePayload, buildCreationSkuSubjectPayload, creationState: state.creation, formatCreationDimensionUnitModeLabel, formatCreationVisualLanguageLabel: (value) => CREATION_VISUAL_LANGUAGE_LABELS[normalizeCreationVisualLanguage(value)], getCreationCurrentSet, getCreationDraftSet, getFrozenCreationEffectivePlan, getCreationLogoPayload, getCreationPreviewSlots, getCreationSelectedDimensionUnitMode, getCreationSelectedImageCount, getCreationSelectedIndustryTemplate, getCreationSelectedLanguage, getCreationSelectedPlatform, getCreationSelectedRoles, getCreationSelectedScenario, getCreationSelectedSkuGenerationRule, isCreationDraftSet, normalizeCreationSkuBundleCountForPayload, normalizeCreationVisualLanguage, normalizeSet: normalizeCreationSetForView, referenceFiles: state.creationReferenceFiles, refs }), listingAgentEnabled: Boolean(refs.creationListingAgentEnabledInput?.checked) }; }

function enqueueCreationGeneration({ formData, set }) {
  const job = createCreationQueueJob({ creationState: state.creation, formData, set, normalizeSet: normalizeCreationSetForView, nowIso });
  setCreationFeedback(`已加入队列 · 第 ${getPendingCreationQueueCount()} 位`, "busy");
  renderCreationView();
  scheduleCreationGenerationQueue();
  return job;
}

function releaseCreationLoadingSources({ queueId = "", setId = "" } = {}) {
  const prefixes = new Set([
    String(queueId || "").trim(),
    String(setId || "").trim(),
  ]);
  prefixes.forEach((prefix) => {
    if (prefix) {
      releaseGenerationLoadingSourcesByPrefix(`${prefix}::`);
    }
  });
}

function getCreationQueueContext() {
  return {
    creationState: state.creation,
    compactErrorMessage,
    getMaxParallelTasks: getCreationMaxParallelTaskCount,
    loadCreationSets,
    normalizeSet: normalizeCreationSetForView,
    nowIso,
    onFinished: (job) => {
      releaseCreationLoadingSources({ queueId: job?.id, setId: job?.set?.setId });
    },
    render: renderCreationView,
    runAutoRepairIfNeeded: runCreationQueuedAutoRepairIfNeeded,
    runCreationStream,
    setFeedback: setCreationFeedback,
    showError,
  };
}

async function runCreationQueuedJob(job) { await runCreationQueuedJobFromQueue(job, getCreationQueueContext()); }

function scheduleCreationGenerationQueue() { scheduleCreationGenerationQueueFromState(getCreationQueueContext()); }

async function startCreationGeneration(event) {
  event.preventDefault();
  if (isCreationLogoBatchBranch()) {
    await startCreationLogoBatchGeneration();
    return;
  }
  await waitForPendingCreationPlanPreview();
  if (state.creation.planning) {
    return;
  }

  clearError();
  setCreationFeedback("");

  const productName = refs.creationProductNameInput.value.trim();
  const productDescription = refs.creationProductDescriptionInput.value.trim();
  const sellingPoints = getCreationSellingPoints(refs.creationSellingPointsInput.value);
  if (!productName && !productDescription && sellingPoints.length === 0) {
    const message = "请至少填写商品名称、商品描述或核心卖点。";
    setCreationFeedback(message, "error");
    showError(message);
    return;
  }

  if (state.creation.planDirty || !getFrozenCreationEffectivePlan()) {
    await requestCreationPlanPreview();
    const refreshedEffectivePlan = getFrozenCreationEffectivePlan();
    if (state.creation.planDirty || !refreshedEffectivePlan || refreshedEffectivePlan.canGenerate === false) {
      return;
    }
  }

  try {
    await ensureCreationReferenceGenerationFilesReady();
    const generationFormData = buildCreationFormData();
    const createdAt = nowIso();
    const queuedSet = buildCreationQueuedSet({ productName, productDescription, sellingPoints, createdAt });
    enqueueCreationGeneration({ formData: generationFormData, set: queuedSet });
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "套图生成请求失败");
    setCreationFeedback(message, "error");
    showError(message);
    renderCreationView();
  }
}

async function repairCreationItems({ itemId = "", scope = "incomplete" } = {}) {
  if (state.creation.generating) {
    if (itemId && state.creation.generationScope === "single") {
      queueCreationItemRepair(itemId);
    }
    return;
  }

  const currentSet = getCreationRepairTargetSet();
  if (!canRepairCreationSet(currentSet)) {
    const message = "请先选择一个已保存的套图记录。";
    setCreationFeedback(message, "error");
    showError(message);
    return;
  }

  const targetItems = itemId
    ? currentSet.items.filter((item) => item.itemId === itemId)
    : getCreationIncompleteItems(currentSet);
  if (targetItems.length === 0) {
    setCreationFeedback("没有需要补齐的套图项。", "success");
    renderCreationView();
    return;
  }

  clearError();
  if (itemId) {
    removeQueuedCreationItemRepair(state.creation, itemId);
  }
  state.creation.generating = true;
  state.creation.generationScope = itemId ? "single" : "repair";
  state.creation.repairingItemId = String(itemId || "");
  state.creation.currentSet = normalizeCreationSetForView(currentSet);
  syncActiveCreationQueueSet(state.creation.currentSet);
  targetItems.forEach((item) => updateCreationCurrentItem(item.itemId, { status: "generating", error: "", updatedAt: nowIso() }));
  /* 补齐与单图重试沿用原 setId，因此写回原批次组行而不新开顶层行。 */
  targetItems.forEach((item) => recordCreationLogEvent({
    setId: currentSet.setId,
    itemId: item.itemId,
    status: "active",
    detail: itemId ? "正在重生成单张套图" : "正在补齐未完成项",
    set: currentSet,
  }));
  setCreationFeedback(itemId ? "正在重生成单张套图..." : "正在补齐未完成项...", "busy");
  renderCreationView();

  try {
    await runCreationRepairRequest({ itemId, scope, set: currentSet });
  } catch (error) {
    try {
      await loadCreationSets();
    } catch (refreshError) {
      console.warn("无法在补图连接中断后刷新套图记录", refreshError);
    }
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "套图补图请求失败");
    setCreationFeedback(message, "error");
    showError(message);
  } finally {
    releaseCreationLoadingSources({
      queueId: getCreationQueueJobForSet(currentSet)?.id,
      setId: currentSet.setId,
    });
    state.creation.generating = false;
    state.creation.generationScope = "";
    state.creation.repairingItemId = "";
    renderCreationView();
    if (itemId) {
      await runNextQueuedCreationItemRepair();
    }
  }
}

function normalizePortraitItemForView(item = {}, fallbackIndex = 0) {
  const imageUrl = String(item.imageUrl || item.thumbnailUrl || item.previewUrl || "");
  const status = String(item.status || (imageUrl ? "completed" : "idle"));
  const style = String(item.style || "");
  return {
    itemId: String(item.itemId || `portrait-slot-${fallbackIndex + 1}`),
    slotIndex: Number(item.slotIndex) || fallbackIndex + 1,
    title: String(item.title || `写真 ${String(fallbackIndex + 1).padStart(3, "0")}`),
    style,
    styleLabel: String(item.styleLabel || PORTRAIT_STYLE_LABELS[style] || style),
    customStyle: String(item.customStyle || ""),
    shotType: String(item.shotType || ""),
    shotLabel: String(item.shotLabel || ""),
    action: String(item.action || ""),
    actionLabel: String(item.actionLabel || item.action || ""),
    actionInstruction: String(item.actionInstruction || ""),
    lens: String(item.lens || ""),
    aperture: String(item.aperture || ""),
    depthOfField: String(item.depthOfField || ""),
    lighting: String(item.lighting || ""),
    scene: String(item.scene || ""),
    filename: String(item.filename || ""),
    relativePath: String(item.relativePath || ""),
    prompt: String(item.prompt || ""),
    status,
    imageUrl,
    thumbnailUrl: String(item.thumbnailUrl || imageUrl),
    error: String(item.error || ""),
    generationStartedAt: String(item.generationStartedAt || ""),
    generationCompletedAt: String(item.generationCompletedAt || ""),
    generationDurationMs: String(item.generationDurationMs || ""),
  };
}

function normalizePortraitSetForView(set = {}) {
  const items = (Array.isArray(set.items) ? set.items : [])
    .map((item, index) => normalizePortraitItemForView(item, index))
    .sort((left, right) => left.slotIndex - right.slotIndex);
  const status = String(set.status || "");
  const resolvedStatus =
    status || (items.every((item) => item.status === "completed") && items.length > 0
      ? "completed"
      : items.some((item) => item.status === "failed")
        ? "partial_failed"
        : items.some((item) => item.status === "generating" || item.status === "queued")
          ? "generating"
          : "planning");

  return {
    setId: String(set.setId || ""),
    subjectName: String(set.subjectName || ""),
    subjectSummary: String(set.subjectSummary || ""),
    analysis: set.analysis && typeof set.analysis === "object" ? set.analysis : null,
    referenceImageNames: Array.isArray(set.referenceImageNames)
      ? set.referenceImageNames.map((item) => String(item)).filter(Boolean)
      : [],
    selectedStyles: Array.isArray(set.selectedStyles)
      ? set.selectedStyles.map((item) => String(item)).filter(Boolean)
      : [],
    selectedShotTypes: Array.isArray(set.selectedShotTypes)
      ? set.selectedShotTypes.map((item) => String(item)).filter(Boolean)
      : [],
    selectedActions: Array.isArray(set.selectedActions) ? set.selectedActions.map((item) => String(item)).filter(Boolean) : [],
    customStyle: String(set.customStyle || ""),
    ...portraitLocationController.normalizeSetFields(set),
    notes: String(set.notes || ""),
    ratio: String(set.ratio || DEFAULT_PORTRAIT_RATIO),
    size: String(set.size || "auto"),
    format: String(set.format || "png"),
    imageCount: Number(set.imageCount) || items.length || 12,
    createdAt: String(set.createdAt || nowIso()),
    updatedAt: String(set.updatedAt || set.createdAt || nowIso()),
    status: resolvedStatus,
    relativeDir: String(set.relativeDir || ""),
    items,
  };
}

function getPortraitCurrentSet() { return state.portrait.currentSet ? normalizePortraitSetForView(state.portrait.currentSet) : null; }

function getPortraitSetDisplayTitle(set = {}) { const summary = String(set.subjectSummary || "").trim(); return summary ? (summary.length > 36 ? `${summary.slice(0, 36)}...` : summary) : "未填写人物描述"; }

function isPortraitDraftSet(set = getPortraitCurrentSet()) { const setId = String(set?.setId || ""); return setId.startsWith("portrait-local-") || setId.startsWith("portrait-draft-"); }

function canRepairPortraitSet(set = getPortraitCurrentSet()) { return Boolean(set?.setId) && !isPortraitDraftSet(set); }

function getPortraitProgressSummary(set = getPortraitCurrentSet()) {
  const items = Array.isArray(set?.items) ? set.items : [];
  const total = items.length || Number(set?.imageCount) || clampPortraitImageCount(undefined, { write: false });
  const completed = items.filter((item) => item.status === "completed").length;
  const failed = items.filter((item) => item.status === "failed").length;
  return { total, completed, failed };
}

function getPortraitStatusLabel(status) {
  return PORTRAIT_STATUS_LABELS[String(status || "")] || "处理中";
}

function setPortraitFeedback(message = "", kind = "") {
  if (!refs.portraitFeedback) {
    return;
  }
  refs.portraitFeedback.textContent = message || "";
  refs.portraitFeedback.dataset.state = kind || "";
  state.portrait.feedback = message || "";
}

function getPortraitAnalysisFeedbackNow() {
  return typeof performance !== "undefined" && typeof performance.now === "function" ? performance.now() : Date.now();
}

function waitForPortraitAnalysisFeedback(startedAt) {
  const remaining = PORTRAIT_ANALYSIS_FEEDBACK_MIN_MS - (getPortraitAnalysisFeedbackNow() - startedAt);
  if (remaining <= 0) {
    return Promise.resolve();
  }
  return new Promise((resolve) => window.setTimeout(resolve, remaining));
}

function setPortraitRecordFeedback(message = "", kind = "") {
  if (!refs.portraitRecordActionFeedback) {
    return;
  }
  refs.portraitRecordActionFeedback.textContent = message || "";
  refs.portraitRecordActionFeedback.dataset.state = kind || "";
}

function getPortraitSelectedStyles() { return refs.portraitStyleInputs.filter((input) => input.checked).map((input) => input.value); }

function getPortraitSelectedShotTypes() { return refs.portraitShotTypeInputs.filter((input) => input.checked).map((input) => input.value); }

function getPortraitSelectedActions() { return refs.portraitActionInputs.filter((input) => input.checked).map((input) => input.value); }

function clampPortraitImageCount(value = refs.portraitImageCountInput?.value, { write = true } = {}) {
  const parsed = Number.parseInt(String(value || "").trim(), 10);
  const nextValue = Number.isFinite(parsed) ? Math.min(100, Math.max(1, parsed)) : 12;
  if (write && refs.portraitImageCountInput) {
    refs.portraitImageCountInput.value = String(nextValue);
  }
  return nextValue;
}

function updatePortraitCurrentItem(itemId, patch = {}) {
  const currentSet = getPortraitCurrentSet();
  if (!currentSet || !itemId) {
    return null;
  }
  const nextItems = [...currentSet.items];
  const index = nextItems.findIndex((item) => item.itemId === itemId);
  const existing = index >= 0 ? nextItems[index] : { itemId };
  const nextItem = normalizePortraitItemForView({ ...existing, ...patch, itemId }, index >= 0 ? index : nextItems.length);
  if (index >= 0) {
    nextItems[index] = nextItem;
  } else {
    nextItems.push(nextItem);
  }
  const nextSet = normalizePortraitSetForView({
    ...currentSet,
    ...patch.set,
    items: nextItems,
    updatedAt: patch.updatedAt || nowIso(),
    status: patch.setStatus || currentSet.status,
  });
  state.portrait.currentSet = nextSet;
  if (!isPortraitDraftSet(nextSet)) {
    state.portrait.sets = [nextSet, ...state.portrait.sets.filter((entry) => entry.setId !== nextSet.setId)];
  }
  return nextSet;
}

function upsertPortraitSet(set) {
  const normalized = normalizePortraitSetForView(set);
  if (!normalized.setId) {
    return null;
  }
  state.portrait.sets = [normalized, ...state.portrait.sets.filter((entry) => entry.setId !== normalized.setId)];
  const currentSetId = state.portrait.currentSet?.setId || "";
  if (!currentSetId || currentSetId === normalized.setId || currentSetId.startsWith("portrait-local-") || state.portrait.generating) {
    state.portrait.currentSet = normalized;
  }
  renderPortraitRecordView();
  return normalized;
}

function revokePortraitReferenceFiles() {
  [...state.portrait.files, ...state.portrait.actionFiles, ...state.portrait.accessoryFiles].forEach((item) => {
    if (item.previewUrl) {
      URL.revokeObjectURL(item.previewUrl);
    }
  });
}

function getPortraitReferenceBucketConfig(bucket = "person") {
  if (bucket === "action") {
    return {
      filesKey: "actionFiles",
      input: refs.portraitActionReferenceInput,
      count: refs.portraitActionReferenceCount,
      dropzone: refs.portraitActionReferenceDropzone,
      grid: refs.portraitActionReferenceGrid,
      maxCount: getPortraitActionMaxReferenceImageCount(),
      idPrefix: "portrait-action-reference",
      removeDatasetKey: "portraitActionReferenceRemoveId",
      removeAttribute: "data-portrait-action-reference-remove-id",
      title: "动作参考图",
      addLabel: "继续上传动作参考图",
      overflowMessage: "动作参考图最多支持",
    };
  }

  if (bucket === "accessory") {
    return {
      filesKey: "accessoryFiles",
      input: refs.portraitAccessoryReferenceInput,
      count: refs.portraitAccessoryReferenceCount,
      dropzone: refs.portraitAccessoryReferenceDropzone,
      grid: refs.portraitAccessoryReferenceGrid,
      maxCount: getPortraitAccessoryMaxReferenceImageCount(),
      idPrefix: "portrait-accessory-reference",
      removeDatasetKey: "portraitAccessoryReferenceRemoveId",
      removeAttribute: "data-portrait-accessory-reference-remove-id",
      title: "服装道具配饰参考图",
      addLabel: "继续上传服装道具配饰参考图",
      overflowMessage: "服装道具配饰参考图最多支持",
    };
  }

  return {
    filesKey: "files",
    input: refs.portraitReferenceInput,
    count: refs.portraitReferenceCount,
    dropzone: refs.portraitReferenceDropzone,
    grid: refs.portraitReferenceGrid,
    maxCount: getPortraitPersonMaxReferenceImageCount(),
    idPrefix: "portrait-reference",
    removeDatasetKey: "portraitReferenceRemoveId",
    removeAttribute: "data-portrait-reference-remove-id",
    title: "人物参考图",
    addLabel: "继续上传人物参考图",
    overflowMessage: "人物参考图最多支持",
  };
}

function applyPortraitReferenceFiles(fileList, bucket = "person", options = {}) {
  const config = getPortraitReferenceBucketConfig(bucket);
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    return;
  }
  const assetMetadata = options.asset && incomingFiles.length === 1
    ? {
        assetId: options.asset.id || "",
        assetLabel: options.asset.label || "",
        assetPrompt: options.asset.prompt || "",
      }
    : {};
  const next = [...state.portrait[config.filesKey]];
  const fingerprints = new Set(next.map((item) => item.fingerprint));
  let overflowed = false;

  for (const file of incomingFiles) {
    if (next.length >= config.maxCount) {
      overflowed = true;
      break;
    }
    const fingerprint = buildReferenceFingerprint(file);
    if (fingerprints.has(fingerprint)) {
      continue;
    }
    next.push({
      id: `${config.idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      fingerprint,
      file,
      previewUrl: URL.createObjectURL(file),
      ...(assetMetadata.assetId ? { assetId: assetMetadata.assetId } : {}),
      ...(assetMetadata.assetLabel ? { assetLabel: assetMetadata.assetLabel } : {}),
      ...(assetMetadata.assetPrompt ? { assetPrompt: assetMetadata.assetPrompt } : {}),
    });
    fingerprints.add(fingerprint);
  }

  portraitReferenceAnalysis.invalidate({ clearResult: true });
  state.portrait[config.filesKey] = next;
  if (!state.portrait.generating && !state.portrait.planning) {
    state.portrait.currentSet = null;
  }
  if (config.input) {
    config.input.value = "";
  }
  setPortraitFeedback("");
  clearError();
  renderPortraitView();

  if (overflowed) {
    showError(`${config.overflowMessage} ${config.maxCount} 张。`);
  }
}

function applyPortraitAccessoryReferenceFiles(fileList, options = {}) {
  applyPortraitReferenceFiles(fileList, "accessory", options);
}

function applyPortraitActionReferenceFiles(fileList, options = {}) {
  applyPortraitReferenceFiles(fileList, "action", options);
}

function getPortraitAccessoryPromptSummary() {
  const prompts = state.portrait.accessoryFiles
    .map((item, index) => {
      const prompt = String(item.assetPrompt || "").trim();
      if (!prompt) {
        return "";
      }
      const label = String(item.assetLabel || "").trim();
      return `COS cosplay reference ${index + 1}${label ? ` (${label})` : ""}: ${prompt}`;
    })
    .filter(Boolean);
  return prompts.length > 0 ? prompts.join("\n") : "";
}

function setPortraitAccessoryAssetFeedback(message = "", kind = "") {
  if (!refs.portraitAccessoryAssetFeedback) return;
  refs.portraitAccessoryAssetFeedback.textContent = message; refs.portraitAccessoryAssetFeedback.dataset.state = kind;
}

function setPortraitAccessoryAssetPopoverOpen(open) {
  if (!refs.portraitAccessoryAssetPopover) return;
  refs.portraitAccessoryAssetPopover.classList.toggle("hidden", !open);
  refs.portraitAccessoryAssetPopover.setAttribute("aria-hidden", open ? "false" : "true");
  refs.portraitAccessoryAssetButton?.setAttribute("aria-expanded", open ? "true" : "false");
  if (open) { setPromptTemplatePopoverOpen(false); renderPortraitAccessoryAssetLibrary(); } else { setPortraitAccessoryAssetFeedback(""); }
}

function renderPortraitAccessoryAssetLibrary() {
  if (!refs.portraitAccessoryAssetTabs || !refs.portraitAccessoryAssetList) return;
  const selectedCategory = PORTRAIT_ACCESSORY_ASSET_CATEGORIES.some((category) => category.value === state.portrait.accessoryAssetCategory) ? state.portrait.accessoryAssetCategory : PORTRAIT_ACCESSORY_ASSET_CATEGORIES[0].value;
  const maxCount = getPortraitAccessoryMaxReferenceImageCount(), isFull = state.portrait.accessoryFiles.length >= maxCount;
  refs.portraitAccessoryAssetTabs.replaceChildren();
  PORTRAIT_ACCESSORY_ASSET_CATEGORIES.forEach((category) => {
    const button = document.createElement("button");
    Object.assign(button, { type: "button", className: "portrait-accessory-asset-tab", textContent: category.label });
    button.classList.toggle("is-active", category.value === selectedCategory);
    button.dataset.portraitAccessoryAssetCategory = category.value;
    button.setAttribute("role", "tab"); button.setAttribute("aria-selected", String(category.value === selectedCategory));
    refs.portraitAccessoryAssetTabs.appendChild(button);
  });
  refs.portraitAccessoryAssetList.replaceChildren();
  DEFAULT_PORTRAIT_ACCESSORY_ASSETS
    .filter((asset) => asset.category === selectedCategory)
    .forEach((asset) => {
      const selectedVariant = getPortraitAccessoryAssetFileDescriptor(asset, state.portrait.accessoryAssetColors[asset.id]);
      const item = document.createElement("article");
      const button = document.createElement("button");
      item.className = "portrait-accessory-asset-item";
      Object.assign(button, { type: "button", className: "portrait-accessory-asset-add", disabled: isFull, title: isFull ? `服装道具配饰参考图最多支持 ${maxCount} 张` : `添加${selectedVariant.label}到参考图` });
      button.dataset.portraitAccessoryAssetId = asset.id;
      const image = document.createElement("img");
      Object.assign(image, { src: selectedVariant.src, alt: selectedVariant.label, loading: "lazy", decoding: "async" });
      button.appendChild(image);
      const label = document.createElement("span"); label.className = "portrait-accessory-asset-label"; label.textContent = selectedVariant.label; button.appendChild(label);
      item.appendChild(button);
      if (Array.isArray(asset.colors) && asset.colors.length > 0) {
        const colorGrid = document.createElement("div");
        colorGrid.className = "portrait-accessory-color-grid";
        asset.colors.forEach((color) => {
          const colorButton = document.createElement("button");
          Object.assign(colorButton, { type: "button", className: "portrait-accessory-color-option", title: `${asset.label} · ${color.label}` });
          colorButton.classList.toggle("is-active", color.id === selectedVariant.colorId);
          colorButton.dataset.portraitAccessoryAssetId = asset.id; colorButton.dataset.portraitAccessoryColorId = color.id;
          colorButton.setAttribute("aria-label", `选择${asset.label} ${color.label}`); colorButton.setAttribute("aria-pressed", String(color.id === selectedVariant.colorId));
          const colorImage = document.createElement("img");
          Object.assign(colorImage, { src: color.src, alt: "", loading: "lazy", decoding: "async" });
          colorButton.appendChild(colorImage);
          colorGrid.appendChild(colorButton);
        });
        item.appendChild(colorGrid);
      }
      refs.portraitAccessoryAssetList.appendChild(item);
    });
}

async function rasterizePortraitAccessoryAsset(blob) {
  const objectUrl = URL.createObjectURL(blob);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = objectUrl;
    await image.decode();
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const context = canvas.getContext("2d");
    if (!context) {
      return blob;
    }
    context.fillStyle = "#f8fafc";
    context.fillRect(0, 0, canvas.width, canvas.height);
    const scale = Math.min(canvas.width / image.naturalWidth, canvas.height / image.naturalHeight);
    const width = image.naturalWidth * scale;
    const height = image.naturalHeight * scale;
    const x = (canvas.width - width) / 2;
    const y = (canvas.height - height) / 2;
    context.drawImage(image, x, y, width, height);
    return await new Promise((resolve) => {
      canvas.toBlob((pngBlob) => resolve(pngBlob || blob), "image/png", 0.92);
    });
  } catch {
    return blob;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

async function loadPortraitAccessoryAssetBlob(asset) {
  const selectedVariant = getPortraitAccessoryAssetFileDescriptor(asset, state.portrait.accessoryAssetColors[asset.id]);
  const response = await fetch(selectedVariant.src);
  if (!response.ok) {
    throw new Error(`无法读取服饰资产：${selectedVariant.label}`);
  }
  const sourceBlob = await response.blob();
  return rasterizePortraitAccessoryAsset(sourceBlob);
}

async function addPortraitAccessoryAssetReference(assetId) {
  const asset = DEFAULT_PORTRAIT_ACCESSORY_ASSETS.find((entry) => entry.id === assetId);
  if (!asset) {
    return;
  }
  if (state.portrait.accessoryFiles.length >= getPortraitAccessoryMaxReferenceImageCount()) {
    setPortraitAccessoryAssetFeedback("服装道具配饰参考图已达到上限。", "error");
    return;
  }

  const selectedVariant = getPortraitAccessoryAssetFileDescriptor(asset, state.portrait.accessoryAssetColors[asset.id]);
  setPortraitAccessoryAssetFeedback(`正在添加${selectedVariant.label}...`, "busy");
  try {
    const blob = await loadPortraitAccessoryAssetBlob(asset);
    const file = new File([blob], selectedVariant.filename, { type: blob.type || "image/png", lastModified: 1 });
    applyPortraitAccessoryReferenceFiles([file], { asset: selectedVariant });
    setPortraitAccessoryAssetFeedback(`已添加${selectedVariant.label}。`, "success");
    renderPortraitAccessoryAssetLibrary();
  } catch (error) {
    setPortraitAccessoryAssetFeedback(error instanceof Error ? error.message : String(error), "error");
  }
}

function removePortraitReferenceFile(referenceId) {
  removePortraitReferenceFileFromBucket(referenceId, "person");
}

function removePortraitAccessoryReferenceFile(referenceId) {
  removePortraitReferenceFileFromBucket(referenceId, "accessory");
}

function removePortraitActionReferenceFile(referenceId) {
  removePortraitReferenceFileFromBucket(referenceId, "action");
}

function removePortraitReferenceFileFromBucket(referenceId, bucket = "person") {
  const config = getPortraitReferenceBucketConfig(bucket);
  const target = state.portrait[config.filesKey].find((item) => item.id === referenceId);
  if (!target) {
    return;
  }
  portraitReferenceAnalysis.invalidate({ clearResult: true });
  if (target?.previewUrl) {
    URL.revokeObjectURL(target.previewUrl);
  }
  state.portrait[config.filesKey] = state.portrait[config.filesKey].filter((item) => item.id !== referenceId);
  if (!state.portrait.generating && !state.portrait.planning) {
    state.portrait.currentSet = null;
  }
  renderPortraitView();
}

function renderPortraitReferenceGrid() {
  renderPortraitReferenceGridForBucket("person");
  renderPortraitReferenceGridForBucket("action");
  renderPortraitReferenceGridForBucket("accessory");
}

function renderPortraitReferenceGridForBucket(bucket = "person") {
  const config = getPortraitReferenceBucketConfig(bucket);
  if (!config.grid) {
    return;
  }
  const files = state.portrait[config.filesKey];
  config.grid.innerHTML = "";
  if (config.count) {
    config.count.textContent = `${files.length} / ${config.maxCount}`;
  }
  syncReferenceDropzoneCompact(config.dropzone, files.length > 0);
  config.grid.classList.toggle("hidden", files.length === 0);

  files.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "reference-card portrait-reference-card";

    const preview = document.createElement("div");
    preview.className = "reference-preview-button";
    const image = document.createElement("img");
    image.src = item.previewUrl;
    image.alt = `${config.title} ${index + 1}`;
    preview.appendChild(image);
    card.appendChild(preview);

    const remove = document.createElement("button");
    remove.type = "button";
    remove.className = "reference-remove";
    remove.textContent = "x";
    remove.dataset[config.removeDatasetKey] = item.id;
    remove.setAttribute("aria-label", `移除${config.title}`);
    card.appendChild(remove);

    config.grid.appendChild(card);
  });

  if (files.length > 0 && files.length < config.maxCount) {
    config.grid.appendChild(
      createReferenceAddCard({
        input: config.input,
        label: config.addLabel,
        onFiles: (fileList) => applyPortraitReferenceFiles(fileList, bucket),
      }),
    );
  }
}

function buildPortraitFormData({ includeFiles = true, repair = false, includeActionFiles = true, includeAccessoryFiles = true } = {}) {
  const formData = new FormData();
  const currentSet = getPortraitCurrentSet();
  const appliedAnalysis = state.portrait.referenceAnalysis.applied
    ? state.portrait.referenceAnalysis.result || {}
    : currentSet?.analysis || {};
  formData.set("subjectName", "");
  formData.set("subjectSummary", refs.portraitSubjectSummaryInput?.value.trim() || "");
  formData.set("imageCount", String(clampPortraitImageCount(refs.portraitImageCountInput?.value || currentSet?.imageCount || "12")));
  formData.set("selectedStyles", JSON.stringify(getPortraitSelectedStyles()));
  formData.set("selectedShotTypes", JSON.stringify(getPortraitSelectedShotTypes()));
  formData.set("selectedActions", JSON.stringify(getPortraitSelectedActions()));
  formData.set("customStyle", refs.portraitCustomStyleInput?.value.trim() || "");
  portraitLocationController.appendFormData(formData);
  const rawPortraitNotes = refs.portraitNotesInput?.value.trim() || "";
  formData.set("notes", [rawPortraitNotes, getPortraitAccessoryPromptSummary()].filter(Boolean).join("\n\n"));
  formData.set("ratio", refs.portraitRatioInput?.value || DEFAULT_PORTRAIT_RATIO);
  formData.set("size", refs.portraitSizeInput?.value || "auto");
  formData.set("format", normalizeOutputFormat(refs.portraitOutputFormatInput?.value || state.config?.defaults?.format || "png"));
  formData.set("analysis", JSON.stringify(appliedAnalysis));
  formData.set("reasoningEffort", refs.reasoningEffortInput?.value || state.config?.defaults?.reasoningEffort || "xhigh");
  formData.set("clientSessionId", state.clientSessionId);
  if (repair && currentSet?.setId) {
    formData.set("setId", currentSet.setId);
  }
  if (includeFiles) {
    state.portrait.files.forEach((item) => {
      if (item.file) {
        formData.append("portraitReferenceImages", item.file);
      }
    });
    if (includeActionFiles) {
      state.portrait.actionFiles.forEach((item) => {
        if (item.file) {
          formData.append("portraitActionReferenceImages", item.file);
        }
      });
    }
    if (includeAccessoryFiles) {
      state.portrait.accessoryFiles.forEach((item) => {
        if (item.file) {
          formData.append("portraitAccessoryReferenceImages", item.file);
        }
      });
    }
  }
  appendCurrentConfigToFormData(formData);
  return formData;
}

function buildPortraitRepairFormData({ itemId = "", scope = "failed" } = {}) { const currentSet = getPortraitCurrentSet(); const formData = buildPortraitFormData({ includeFiles: true, repair: true }); if (currentSet?.ratio) formData.set("ratio", currentSet.ratio); if (currentSet?.size) formData.set("size", currentSet.size); if (currentSet?.format) formData.set("format", currentSet.format); formData.set(itemId ? "itemId" : "scope", itemId || scope || "failed"); return formData; }

function getPortraitReferenceFileNames() {
  return [...state.portrait.files, ...state.portrait.actionFiles, ...state.portrait.accessoryFiles]
    .map((item) => item.file?.name || "")
    .filter(Boolean);
}

function buildPortraitPreviewItems(count = refs.portraitImageCountInput?.value || 12) {
  const total = clampPortraitImageCount(count, { write: false });
  return Array.from({ length: total }, (_, index) => normalizePortraitItemForView({
    itemId: `portrait-preview-${index + 1}`,
    slotIndex: index + 1,
    title: `写真 ${String(index + 1).padStart(3, "0")}`,
    status: state.portrait.generating ? "queued" : "idle",
  }, index));
}

function renderPortraitDetail(set) {
  if (!refs.portraitDetail) {
    return;
  }
  refs.portraitDetail.innerHTML = "";
  refs.portraitDetail.hidden = true;
}

function formatPortraitStyleSummary(set = {}) {
  const labels = Array.isArray(set.items)
    ? [...new Set(set.items.map((item) => item.styleLabel || PORTRAIT_STYLE_LABELS[item.style]).filter(Boolean))]
    : [];
  if (set.customStyle) {
    labels.push(set.customStyle);
  }
  if (labels.length > 0) {
    return labels.join("、");
  }
  return (Array.isArray(set.selectedStyles) ? set.selectedStyles : [])
    .map((style) => PORTRAIT_STYLE_LABELS[style] || style)
    .filter(Boolean)
    .join("、") || "商务形象";
}

function createPortraitCardLoading(itemId = "", logText = "") {
  return createCreationCardLoadingShell("generating", null, { key: itemId, logText });
}

function createPortraitCard(item = {}, fallbackIndex = 0, options = {}) {
  const showRecordActions = options.showRecordActions === true;
  const isLoadingCard = !showRecordActions && state.portrait.generating && !getImageUrl(item) && !["completed", "failed"].includes(item.status);
  const card = document.createElement("article");
  card.className = "creation-card portrait-card";
  card.classList.toggle("is-record-card", showRecordActions);
  card.classList.toggle("is-generating", isLoadingCard);

  const head = document.createElement("div");
  head.className = "creation-card-head";
  const title = document.createElement("strong");
  title.textContent = item.title || `写真 ${fallbackIndex + 1}`;
  head.appendChild(title);
  const status = document.createElement("span");
  status.className = "creation-card-status";
  status.textContent = isLoadingCard ? "生成中" : getPortraitStatusLabel(item.status);
  head.appendChild(status);
  card.appendChild(head);

  const imageUrl = getImageUrl(item);
  const media = document.createElement(showRecordActions && imageUrl ? "button" : "div");
  media.className = "creation-card-media";
  if (showRecordActions && imageUrl) {
    media.type = "button";
    media.classList.add("creation-record-preview-media");
    media.dataset.portraitRecordPreviewItemId = item.itemId;
    media.setAttribute("aria-label", `${item.title || "写真"}查看大图`);
  }
  if (isLoadingCard) {
    media.classList.add("is-loading");
    media.setAttribute("aria-busy", "true");
    media.appendChild(createPortraitCardLoading(item.itemId, getCreationCardLogText(item, "portrait", options.logGroupId)));
  } else if (imageUrl) {
    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = item.title || `写真 ${fallbackIndex + 1}`;
    image.src = imageUrl;
    media.appendChild(image);
  } else {
    const placeholder = document.createElement("span");
    placeholder.textContent = item.status === "failed" ? item.error || "生成失败" : "等待生成";
    media.appendChild(placeholder);
  }
  card.appendChild(media);

  const meta = document.createElement("p");
  meta.className = "creation-card-copy portrait-card-meta";
  meta.textContent = [
    item.styleLabel,
    item.shotLabel,
    item.actionLabel,
    item.lens && item.aperture ? `${item.lens} ${item.aperture}` : "",
    item.depthOfField,
  ].filter(Boolean).join(" · ");
  card.appendChild(meta);

  if (!showRecordActions && item.status === "failed" && canRepairPortraitSet()) {
    const actions = Object.assign(document.createElement("div"), { className: "creation-card-actions portrait-card-actions" }), retryButton = Object.assign(document.createElement("button"), { className: "mini-action", type: "button", textContent: "重试", disabled: state.portrait.generating || state.portrait.planning });
    retryButton.dataset.portraitRetryItemId = item.itemId; actions.appendChild(retryButton); card.appendChild(actions);
  }

  if (showRecordActions) {
    const actions = document.createElement("div");
    actions.className = "creation-card-actions creation-record-card-actions portrait-record-card-actions";
    const previewButton = document.createElement("button");
    previewButton.className = "mini-action";
    previewButton.type = "button";
    previewButton.dataset.portraitRecordPreviewItemId = item.itemId;
    previewButton.textContent = "查看";
    previewButton.disabled = !imageUrl;
    actions.appendChild(previewButton);

    const copyPromptButton = document.createElement("button");
    copyPromptButton.className = "mini-action";
    copyPromptButton.type = "button";
    copyPromptButton.dataset.portraitRecordCopyPromptItemId = item.itemId;
    copyPromptButton.textContent = "复制提示词";
    copyPromptButton.disabled = !item.prompt;
    actions.appendChild(copyPromptButton);
    card.appendChild(actions);
  }

  return card;
}

function renderPortraitView() {
  syncGenerationSchedulingLock();
  if (!refs.portraitResultGrid) {
    return;
  }
  const currentSet = getPortraitCurrentSet();
  const inputCount = clampPortraitImageCount(undefined, { write: false });
  const progress = currentSet ? getPortraitProgressSummary(currentSet) : { total: inputCount, completed: 0, failed: 0 };
  if (refs.portraitGenerateButton) {
    refs.portraitGenerateButton.textContent = state.portrait.generating ? "生成中..." : "生成写真";
    refs.portraitGenerateButton.disabled = state.portrait.generating || state.portrait.planning;
  }
  if (refs.portraitPlanButton) {
    refs.portraitPlanButton.textContent = state.portrait.planning ? "预览中..." : "预览计划";
    refs.portraitPlanButton.disabled = state.portrait.generating || state.portrait.planning;
  }
  if (refs.portraitRepairFailedButton) { const canRepairFailedItems = canRepairPortraitSet(currentSet) && progress.failed > 0; refs.portraitRepairFailedButton.hidden = !canRepairFailedItems; refs.portraitRepairFailedButton.disabled = state.portrait.generating || state.portrait.planning; }
  if (refs.portraitProgressText) {
    refs.portraitProgressText.textContent = `${progress.completed} / ${progress.total}`;
  }
  if (refs.portraitSetMeta) {
    refs.portraitSetMeta.hidden = !currentSet;
    refs.portraitSetMeta.textContent = currentSet
      ? [getPortraitSetDisplayTitle(currentSet), currentSet.locationName, formatPortraitStyleSummary(currentSet), PORTRAIT_STATUS_LABELS[currentSet.status] || currentSet.status, formatClock(currentSet.createdAt)].filter(Boolean).join(" · ")
      : "等待生成";
  }

  portraitLocationController.render();
  renderPortraitReferenceGrid();
  portraitReferenceAnalysis.render();
  renderPortraitAccessoryAssetLibrary();
  renderPortraitDetail(currentSet);

  const items = currentSet?.items?.length ? currentSet.items : buildPortraitPreviewItems();
  /* 顺序是有讲究的：先建好新卡片，让它们按 itemId 接上已有的进度源，再停掉旧卡片的动画。
     反过来先清空网格，进度源会因为没有节点被回收，每次渲染都把百分比打回 0；
     而只清空不停动画，旧节点会脱离文档却继续跑到 99%，下一轮生成直接继承这个残留值。 */
  const nextCards = items.map((item, index) => createPortraitCard(item, index, {
    logGroupId: currentSet?.setId || "",
  }));
  stopGenerationLoadingShells(refs.portraitResultGrid);
  refs.portraitResultGrid.replaceChildren(...nextCards);
}

async function previewPortraitPlan() {
  if (state.portrait.generating || state.portrait.planning) {
    return;
  }
  clearError();
  setPortraitFeedback("");
  if (!refs.portraitSubjectSummaryInput.value.trim()) {
    const message = "请先填写人物描述。";
    setPortraitFeedback(message, "error");
    showError(message);
    return;
  }
  state.portrait.planning = true;
  const planSnapshot = getPortraitPlanSnapshot();
  setPortraitFeedback("正在生成写真分镜计划...", "busy");
  renderPortraitView();
  try {
    const response = await fetch("/api/portrait/plan", {
      method: "POST",
      body: buildPortraitFormData({ includeFiles: false }),
    });
    const payload = await response.json().catch(() => ({}));
    if (planSnapshot !== getPortraitPlanSnapshot()) {
      setPortraitFeedback("写真参数已变化，请重新预览计划。", "busy");
      return;
    }
    if (!response.ok) {
      throw new Error(payload.message || "写真计划生成失败");
    }
    const plan = payload.plan || {};
    const createdAt = nowIso();
    state.portrait.currentSet = normalizePortraitSetForView({
      setId: `portrait-draft-${Date.now()}`,
      subjectName: "",
      subjectSummary: plan.subjectSummary || refs.portraitSubjectSummaryInput.value.trim(),
      analysis: plan.visibleProfile || null,
      selectedStyles: plan.selectedStyles || getPortraitSelectedStyles(),
      selectedShotTypes: plan.selectedShotTypes || getPortraitSelectedShotTypes(),
      selectedActions: plan.selectedActions || getPortraitSelectedActions(),
      customStyle: plan.customStyle || refs.portraitCustomStyleInput.value.trim(),
      ...portraitLocationController.getSetFields(plan),
      notes: plan.notes || refs.portraitNotesInput.value.trim(),
      ratio: plan.ratio || refs.portraitRatioInput.value || DEFAULT_PORTRAIT_RATIO,
      size: plan.size || refs.portraitSizeInput.value || "auto",
      format: plan.format || refs.portraitOutputFormatInput.value || "png",
      imageCount: plan.imageCount || plan.items?.length || clampPortraitImageCount(undefined, { write: false }),
      referenceImageNames: getPortraitReferenceFileNames(),
      createdAt,
      updatedAt: createdAt,
      status: "planning",
      items: Array.isArray(plan.items)
        ? plan.items.map((item, index) => ({
            ...item,
            slotIndex: item.slotIndex || index + 1,
            status: "idle",
          }))
        : [],
    });
    setPortraitFeedback(`已生成 ${state.portrait.currentSet.items.length} 张写真计划，可以正式生成。`, "success");
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "写真计划生成失败");
    setPortraitFeedback(message, "error");
    showError(message);
  } finally {
    state.portrait.planning = false;
    renderPortraitView();
  }
}

function handlePortraitStreamEvent(eventName, payload = {}) {
  if (eventName === "set_started") {
    upsertPortraitSet(payload.set); setPortraitFeedback(`写真任务已创建，正在生成 ${payload.set?.imageCount || refs.portraitImageCountInput?.value || 12} 张图片。`, "busy");
    (Array.isArray(payload.set?.items) ? payload.set.items : []).forEach((item) => {
      recordPortraitLogEvent({ setId: payload.set?.setId, itemId: item.itemId, status: "pending", detail: buildGenerationTaskActivityDetail({ statusStage: "queued", statusText: "等待后台生成" }), set: payload.set });
    });
    renderPortraitView(); return;
  }
  if (eventName === "repair_started") {
    const count = Array.isArray(payload.itemIds) ? payload.itemIds.length : 0; setPortraitFeedback(count > 0 ? `正在重试 ${count} 张写真...` : "正在重试写真失败项...", "busy"); renderPortraitView(); return;
  }
  if (eventName === "plan") {
    if (payload.setId && state.portrait.currentSet?.setId !== payload.setId && Array.isArray(payload.items)) {
      upsertPortraitSet({ ...state.portrait.currentSet, setId: payload.setId, items: payload.items });
    }
    renderPortraitView(); return;
  }
  if (eventName === "item_started") {
    updatePortraitCurrentItem(payload.itemId, { status: "generating", updatedAt: nowIso() }); setPortraitFeedback(`正在生成 ${payload.itemId || "写真图"}...`, "busy");
    recordPortraitLogEvent({ setId: payload.setId, itemId: payload.itemId, status: "active", detail: "正在生成图片" });
    renderPortraitView(); return;
  }
  if (eventName === "item_status") {
    updatePortraitCurrentItem(payload.itemId, { status: "generating", updatedAt: nowIso() }); if (payload.message) setPortraitFeedback(payload.message, "busy");
    recordPortraitLogEvent({ setId: payload.setId, itemId: payload.itemId, status: "active", detail: buildGenerationTaskActivityDetail({ statusStage: payload.stage, statusText: payload.message, fallback: "正在生成图片" }) });
    renderPortraitView(); return;
  }
  if (eventName === "item_partial_image" || eventName === "item_final_image") {
    updatePortraitCurrentItem(payload.itemId, { status: "generating", imageUrl: payload.dataUrl, thumbnailUrl: payload.dataUrl, updatedAt: nowIso() }); renderPortraitView(); return;
  }
  if (eventName === "item_saved") {
    if (payload.set) {
      upsertPortraitSet(payload.set);
    } else if (payload.item) {
      updatePortraitCurrentItem(payload.item.itemId, { ...payload.item, status: "completed", updatedAt: nowIso() });
    }
    setPortraitFeedback("已生成一张写真图。", "success");
    recordPortraitLogEvent({ setId: payload.setId || payload.set?.setId, itemId: payload.item?.itemId || payload.itemId, status: "done", detail: "图像已成功生成", imageUrl: getImageUrl(payload.item), set: payload.set });
    renderPortraitView(); return;
  }
  if (eventName === "item_requeued") {
    if (payload.set) {
      upsertPortraitSet(payload.set);
    } else if (payload.itemId) {
      updatePortraitCurrentItem(payload.itemId, { status: "queued", error: "", updatedAt: nowIso() });
    }
    const portraitRequeueNotice = payload.notice || getRequeueNotice({ message: payload.message, attempt: payload.attempt, maxRetries: payload.maxRetries });
    setPortraitFeedback(portraitRequeueNotice, "busy");
    recordPortraitLogEvent({ setId: payload.setId || payload.set?.setId, itemId: payload.itemId, status: "pending", detail: buildGenerationTaskActivityDetail({ statusStage: "queued", statusText: portraitRequeueNotice }), set: payload.set });
    renderPortraitView(); return;
  }
  if (eventName === "item_failed") {
    if (payload.set) {
      upsertPortraitSet(payload.set);
    } else if (payload.itemId) {
      updatePortraitCurrentItem(payload.itemId, { status: "failed", error: payload.message || "", updatedAt: nowIso() });
    }
    setPortraitFeedback(payload.message || "写真图生成失败。", "error");
    const portraitFailureDetail = compactErrorMessage(payload.message, "生成请求失败");
    recordPortraitLogEvent({ setId: payload.setId || payload.set?.setId, itemId: payload.itemId, status: "error", detail: buildGenerationTaskActivityDetail({ status: "error", statusStage: "error", statusText: portraitFailureDetail, errorMessage: portraitFailureDetail }), set: payload.set });
    renderPortraitView(); return;
  }
  if (eventName === "complete") {
    if (payload.set) upsertPortraitSet(payload.set);
    const summary = getPortraitProgressSummary(payload.set || getPortraitCurrentSet());
    setPortraitFeedback(summary.failed > 0 ? `写真生成结束：成功 ${summary.completed}/${summary.total}，失败 ${summary.failed}。可重试失败项。` : "写真生成完成。", summary.failed > 0 ? "error" : "success");
    renderPortraitView(); return;
  }
  if (eventName === "error") {
    const message = compactErrorMessage(payload.message, "写真生成请求失败");
    const currentSet = getPortraitCurrentSet();
    if (currentSet) state.portrait.currentSet = normalizePortraitSetForView({ ...currentSet, status: "failed", updatedAt: nowIso(), items: currentSet.items.map((item) => item.status === "completed" ? item : { ...item, status: "failed", error: message }) });
    setPortraitFeedback(message, "error"); showError(message); renderPortraitView();
  }
}

async function runPortraitStream(response) { return consumeSseUntilTerminal({ stream: response.body, consumeSse, onEvent: handlePortraitStreamEvent, missingTerminalMessage: "写真生成连接已中断，未收到完成事件。" }); }

async function startPortraitGeneration(event) {
  event?.preventDefault();
  if (state.portrait.generating || state.portrait.planning) return;
  clearError(); setPortraitFeedback("");
  if (!refs.portraitSubjectSummaryInput.value.trim()) {
    const message = "请先填写人物描述。"; setPortraitFeedback(message, "error"); showError(message); return;
  }
  state.portrait.generating = true; renderPortraitView();
  try {
    const draftSet = isPortraitDraftSet() ? getPortraitCurrentSet() : null;
    const createdAt = nowIso();
    state.portrait.currentSet = normalizePortraitSetForView({
      ...(draftSet || {}),
      setId: `portrait-local-${Date.now()}`,
      subjectName: "",
      subjectSummary: refs.portraitSubjectSummaryInput.value.trim(),
      analysis: draftSet?.analysis || null,
      selectedStyles: getPortraitSelectedStyles(),
      selectedShotTypes: getPortraitSelectedShotTypes(),
      selectedActions: getPortraitSelectedActions(),
      customStyle: refs.portraitCustomStyleInput.value.trim(),
      ...portraitLocationController.getSetFields(),
      notes: refs.portraitNotesInput.value.trim(),
      ratio: refs.portraitRatioInput.value || DEFAULT_PORTRAIT_RATIO,
      size: refs.portraitSizeInput.value || "auto",
      format: refs.portraitOutputFormatInput.value || "png",
      imageCount: draftSet?.items?.length || clampPortraitImageCount(undefined, { write: false }),
      referenceImageNames: getPortraitReferenceFileNames(),
      createdAt: draftSet?.createdAt || createdAt,
      updatedAt: createdAt,
      status: "generating",
      items: (draftSet?.items?.length ? draftSet.items : buildPortraitPreviewItems()).map((item, index) => ({
        ...item,
        slotIndex: index + 1,
        status: "queued",
      })),
    });
    renderPortraitView();
    const response = await requestGenerationStream("/api/portrait/generate", { body: buildPortraitFormData({ includeFiles: true }), clientSessionId: state.clientSessionId });
    await runPortraitStream(response); await loadPortraitSets();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "写真生成请求失败");
    setPortraitFeedback(message, "error"); showError(message);
  } finally {
    state.portrait.generating = false; renderPortraitView();
  }
}

async function repairPortraitItems({ itemId = "", scope = "failed" } = {}) {
  if (state.portrait.generating || state.portrait.planning) return;
  const currentSet = getPortraitCurrentSet();
  if (!canRepairPortraitSet(currentSet)) {
    const message = "当前写真记录还不能重试。"; setPortraitFeedback(message, "error"); showError(message); return;
  }
  clearError();
  state.portrait.generating = true; setPortraitFeedback(itemId ? "正在重试当前写真..." : "正在重试失败写真...", "busy"); renderPortraitView();
  try {
    const response = await requestGenerationStream("/api/portrait/repair", { body: buildPortraitRepairFormData({ itemId, scope }), clientSessionId: state.clientSessionId });
    await runPortraitStream(response); await loadPortraitSets();
  } catch (error) {
    const message = compactErrorMessage(error instanceof Error ? error.message : String(error), "写真重试请求失败");
    setPortraitFeedback(message, "error"); showError(message);
  } finally {
    state.portrait.generating = false; renderPortraitView();
  }
}

async function loadPortraitSets() {
  state.assetLoading.portrait = true;
  state.assetLoadErrors.portrait = "";
  renderPortraitRecordView();
  let response;
  try {
    response = await fetch("/api/portrait/sets", { cache: "no-store" });
  } catch (error) {
    state.assetLoading.portrait = false;
    state.assetLoadErrors.portrait = error instanceof Error ? error.message : String(error);
    renderPortraitRecordView();
    throw error;
  }
  if (response.status === 404) {
    state.assetLoading.portrait = false; state.portrait.sets = []; state.portrait.recordSetId = ""; state.portrait.recordCheckedSetIds = []; renderPortraitView(); renderPortraitRecordView(); return;
  }
  if (!response.ok) { state.assetLoading.portrait = false; state.assetLoadErrors.portrait = "读取写真记录失败"; renderPortraitRecordView(); throw new Error("读取写真记录失败"); }
  const payload = await response.json();
  const nextSets = Array.isArray(payload) ? payload.map(normalizePortraitSetForView).filter(Boolean) : [];
  const currentSetId = state.portrait.currentSet?.setId || "";
  state.portrait.sets = nextSets;
  const availableSetIds = new Set(nextSets.map((set) => set.setId));
  state.portrait.recordCheckedSetIds = state.portrait.recordCheckedSetIds.filter((setId) => availableSetIds.has(setId));
  state.assetLoading.portrait = false;
  state.assetLoadErrors.portrait = "";
  if (currentSetId) {
    const matchedCurrentSet = nextSets.find((set) => set.setId === currentSetId);
    if (matchedCurrentSet) state.portrait.currentSet = normalizePortraitSetForView(matchedCurrentSet);
  }
  if (state.portrait.recordSetId && !nextSets.some((set) => set.setId === state.portrait.recordSetId)) {
    state.portrait.recordSetId = "";
  }
  renderPortraitView();
  renderPortraitRecordView();
}

function refreshPortraitRecordSets() {
  if (state.portrait.generating || state.portrait.planning || portraitRecordRefreshPromise) {
    return;
  }
  portraitRecordRefreshPromise = loadPortraitSets()
    .catch((error) => {
      setPortraitRecordFeedback(error instanceof Error ? error.message : String(error), "error");
    })
    .finally(() => {
      portraitRecordRefreshPromise = null;
    });
}

function getPortraitRecordSelectedSet() {
  const sets = assetRecordTimeFilterController.filter("portrait");
  return sets.find((set) => set.setId === state.portrait.recordSetId) || sets[0] || null;
}

function selectPortraitRecord(setId) {
  const set = assetRecordTimeFilterController.filter("portrait").find((entry) => entry.setId === setId);
  if (!set) {
    return;
  }
  state.portrait.recordSetId = set.setId;
  setPortraitRecordFeedback();
  renderPortraitRecordView();
}

function getPortraitRecordImagePaths(set) {
  return Array.isArray(set?.items) ? set.items.map((item) => item.relativePath).filter(Boolean) : [];
}

function buildPortraitRecordPathText(set) {
  const paths = getPortraitRecordImagePaths(set);
  if (!set || paths.length === 0) {
    return "";
  }
  return [
    `写真: ${getPortraitSetDisplayTitle(set)}`,
    `目录: ${set.relativeDir || "未记录目录"}`,
    "图片:",
    ...paths.map((path, index) => `${index + 1}. ${path}`),
  ].join("\n");
}

function buildPortraitRecordPromptText(set) {
  const items = Array.isArray(set?.items) ? set.items : [];
  if (!set || items.length === 0) {
    return "";
  }
  return [
    `写真: ${getPortraitSetDisplayTitle(set)}`,
    `记录: ${set.setId || "unknown"}`,
    `风格: ${formatPortraitStyleSummary(set)}`,
    "",
    ...items.flatMap((item, index) => [
      `${index + 1}. ${item.title || item.itemId || "写真单张"}`,
      item.prompt ? item.prompt : "",
      "",
    ]),
  ].map((line) => String(line || "").trimEnd()).join("\n").trim();
}

async function openPortraitRecordFolder() {
  const selectedSet = getPortraitRecordSelectedSet();
  if (!selectedSet?.setId) {
    setPortraitRecordFeedback("请先选择一组写真记录。", "error");
    return;
  }
  const response = await fetch("/api/portrait/sets/open-folder", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      setId: selectedSet.setId,
    }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(payload.message || "打开写真文件夹失败。");
  }
  setPortraitRecordFeedback("已打开写真文件夹。", "success");
}

async function copyPortraitRecordPaths() {
  const selectedSet = getPortraitRecordSelectedSet();
  const text = buildPortraitRecordPathText(selectedSet);
  if (!text) {
    setPortraitRecordFeedback("当前写真还没有可复制的图片路径。", "error");
    return;
  }
  await writeTextToClipboard(text, "当前浏览器不支持复制写真路径。");
  setPortraitRecordFeedback("已复制当前写真图片路径。", "success");
}

async function copyPortraitRecordPrompts() {
  const selectedSet = getPortraitRecordSelectedSet();
  const text = buildPortraitRecordPromptText(selectedSet);
  if (!text) {
    setPortraitRecordFeedback("当前写真还没有可复制的提示词。", "error");
    return;
  }
  await writeTextToClipboard(text, "当前浏览器不支持复制写真提示词。");
  setPortraitRecordFeedback("已复制当前写真提示词。", "success");
}

function exportPortraitRecordPrompts() {
  const selectedSet = getPortraitRecordSelectedSet();
  const text = buildPortraitRecordPromptText(selectedSet);
  if (!text) {
    setPortraitRecordFeedback("当前写真还没有可导出的提示词。", "error");
    return;
  }
  triggerBrowserTextDownload(text, `portrait-prompts-${selectedSet.setId || "record"}.txt`);
  setPortraitRecordFeedback("已导出当前写真提示词。", "success");
}

function exportPortraitRecordManifest() {
  const selectedSet = getPortraitRecordSelectedSet();
  if (!selectedSet) {
    setPortraitRecordFeedback("请先选择一组写真记录。", "error");
    return;
  }
  triggerBrowserTextDownload(
    `${JSON.stringify(selectedSet, null, 2)}\n`,
    `portrait-record-${selectedSet.setId || "record"}.json`,
    "application/json;charset=utf-8",
  );
  setPortraitRecordFeedback("已导出当前写真清单。", "success");
}

function reusePortraitRecordSet() {
  const selectedSet = getPortraitRecordSelectedSet();
  if (!selectedSet) {
    return;
  }
  refs.portraitSubjectSummaryInput.value = selectedSet.subjectSummary || "";
  refs.portraitImageCountInput.value = String(clampPortraitImageCount(selectedSet.imageCount || selectedSet.items.length || 12));
  refs.portraitCustomStyleInput.value = selectedSet.customStyle || "";
  refs.portraitNotesInput.value = selectedSet.notes || "";
  refs.portraitRatioInput.value = selectedSet.ratio || DEFAULT_PORTRAIT_RATIO;
  renderPortraitSizeOptions();
  refs.portraitSizeInput.value = selectedSet.size || "auto";
  refs.portraitOutputFormatInput.value = normalizeOutputFormat(selectedSet.format || "png");
  const selectedStyles = new Set(selectedSet.selectedStyles || []);
  refs.portraitStyleInputs.forEach((input) => { input.checked = selectedStyles.size > 0 ? selectedStyles.has(input.value) : input.value === "business-profile"; });
  const selectedShotTypes = new Set(selectedSet.selectedShotTypes || []);
  refs.portraitShotTypeInputs.forEach((input) => { input.checked = selectedShotTypes.size > 0 ? selectedShotTypes.has(input.value) : true; });
  const selectedActions = new Set(selectedSet.selectedActions || []);
  refs.portraitActionInputs.forEach((input) => { input.checked = selectedActions.size > 0 ? selectedActions.has(input.value) : true; });
  portraitLocationController.setFromSelection(selectedSet.locationSelection || {});
  portraitReferenceAnalysis.invalidate();
  revokePortraitReferenceFiles();
  state.portrait.files = []; state.portrait.actionFiles = []; state.portrait.accessoryFiles = [];
  state.portrait.currentSet = normalizePortraitSetForView(selectedSet);
  state.portrait.referenceAnalysis.result = selectedSet.analysis || null;
  state.portrait.referenceAnalysis.applied = Boolean(selectedSet.analysis);
  state.portrait.referenceAnalysis.running = false;
  if (refs.portraitReferenceInput) refs.portraitReferenceInput.value = "";
  if (refs.portraitActionReferenceInput) refs.portraitActionReferenceInput.value = "";
  if (refs.portraitAccessoryReferenceInput) refs.portraitAccessoryReferenceInput.value = "";
  setPortraitFeedback("已复用写真记录的人物描述和提示词；参考图需要重新上传。", "success");
  setActiveView("portrait");
  renderPortraitView();
}

function renderPortraitRecordSetList() {
  if (!refs.portraitRecordSetList) {
    return;
  }
  refs.portraitRecordSetList.innerHTML = "";
  const selectedSet = getPortraitRecordSelectedSet();
  const selectedSetId = selectedSet?.setId || "";
  const sets = assetRecordTimeFilterController.filter("portrait").slice(0, 60);
  const checkedSetIds = new Set(state.portrait.recordCheckedSetIds);
  refs.portraitRecordSetList.setAttribute("aria-busy", String(state.assetLoading.portrait));
  if (state.assetLoading.portrait || state.assetLoadErrors.portrait || sets.length === 0) {
    const empty = document.createElement("div");
    empty.className = "creation-record portrait-record asset-list-state";
    empty.textContent = state.assetLoading.portrait
      ? "正在加载写真记录..."
      : state.assetLoadErrors.portrait
        ? `加载失败：${state.assetLoadErrors.portrait}`
        : assetRecordTimeFilterController.hasActive("portrait") ? "没有匹配的写真记录" : "暂无写真记录";
    refs.portraitRecordSetList.appendChild(empty);
    return;
  }
  sets.forEach((set) => {
    const row = document.createElement("div");
    row.className = "asset-record-select-row";
    row.classList.toggle("is-checked", checkedSetIds.has(set.setId));

    const selectLabel = document.createElement("label");
    selectLabel.className = "asset-record-select";
    selectLabel.title = `选择 ${getPortraitSetDisplayTitle(set)}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checkedSetIds.has(set.setId);
    checkbox.disabled = state.assetRecordDeletion.busy || state.portrait.generating || state.portrait.planning;
    checkbox.dataset.portraitRecordSelectSetId = set.setId;
    checkbox.setAttribute("aria-label", `选择写真 ${getPortraitSetDisplayTitle(set)}`);
    selectLabel.appendChild(checkbox);

    const button = document.createElement("button");
    button.type = "button";
    button.className = "creation-record portrait-record";
    button.dataset.portraitRecordSetId = set.setId;
    button.classList.toggle("active", set.setId === selectedSetId);
    button.setAttribute("role", "option");
    button.setAttribute("aria-selected", String(set.setId === selectedSetId));

    const title = document.createElement("strong");
    title.className = "creation-record-title";
    title.textContent = getPortraitSetDisplayTitle(set);
    button.appendChild(title);

    const meta = document.createElement("span");
    meta.className = "creation-record-meta";
    const progress = getPortraitProgressSummary(set);
    meta.textContent = [formatPortraitStyleSummary(set), set.locationName, `${progress.completed}/${progress.total}`, formatTime(set.updatedAt || set.createdAt)].filter(Boolean).join(" · ");
    button.appendChild(meta);
    const status = document.createElement("span");
    status.className = "asset-record-status";
    status.dataset.state = progress.failed > 0 ? "failed" : progress.completed >= progress.total && progress.total > 0 ? "completed" : "running";
    status.textContent = progress.failed > 0 ? `${progress.failed} 项失败` : progress.completed >= progress.total && progress.total > 0 ? "已完成" : "生成中";
    button.appendChild(status);
    row.append(selectLabel, button);
    refs.portraitRecordSetList.appendChild(row);
  });
}

function renderPortraitRecordArchiveDetail(set) {
  if (!refs.portraitRecordArchiveDetail) {
    return;
  }
  refs.portraitRecordArchiveDetail.innerHTML = "";
  const archive = refs.portraitRecordArchiveDetail.closest(".portrait-record-archive");
  archive?.classList.toggle("is-empty", !set);
  if (!set) {
    const empty = document.createElement("span");
    empty.textContent = "还没有写真记录。";
    refs.portraitRecordArchiveDetail.appendChild(empty);
    return;
  }
  const progress = getPortraitProgressSummary(set);
  const detailItems = [
    ["人物描述", getPortraitSetDisplayTitle(set)],
    ["风格", formatPortraitStyleSummary(set)],
    ["进度", `${progress.completed}/${progress.total}`],
    ["比例", set.ratio || DEFAULT_PORTRAIT_RATIO],
    ["目录", set.relativeDir || ""],
    ["创建时间", formatClock(set.createdAt)],
    ["参考图", set.referenceImageNames.length > 0 ? set.referenceImageNames.join("、") : "未记录"],
  ];
  detailItems.filter(([, value]) => value).forEach(([label, value]) => {
    const item = document.createElement("span");
    const strong = document.createElement("strong");
    strong.textContent = `${label}: `;
    item.appendChild(strong);
    item.append(document.createTextNode(value));
    refs.portraitRecordArchiveDetail.appendChild(item);
  });
}

function renderPortraitRecordView() {
  assetRecordTimeFilterController.render("portrait");
  const selectedSet = getPortraitRecordSelectedSet();
  const deleteBlocked = state.portrait.generating || state.portrait.planning || state.assetLoading.portrait || Boolean(portraitRecordRefreshPromise) || state.assetRecordDeletion.busy;
  const visibleSetIds = new Set(assetRecordTimeFilterController.filter("portrait").map((set) => set.setId));
  const checkedCount = state.portrait.recordCheckedSetIds.filter((setId) => visibleSetIds.has(setId)).length;
  if (refs.portraitRecordReuseButton) refs.portraitRecordReuseButton.disabled = state.assetRecordDeletion.busy || !selectedSet;
  if (refs.portraitRecordRefreshButton) refs.portraitRecordRefreshButton.disabled = state.assetRecordDeletion.busy || Boolean(portraitRecordRefreshPromise);
  if (refs.portraitRecordDeleteCurrentButton) refs.portraitRecordDeleteCurrentButton.disabled = deleteBlocked || !selectedSet;
  if (refs.portraitRecordDeleteSelectedButton) {
    refs.portraitRecordDeleteSelectedButton.disabled = deleteBlocked || checkedCount === 0;
    refs.portraitRecordDeleteSelectedButton.textContent = checkedCount > 0 ? `删除选中 (${checkedCount})` : "删除选中";
  }
  if (refs.portraitRecordOpenFolderButton) refs.portraitRecordOpenFolderButton.disabled = state.assetRecordDeletion.busy || !selectedSet?.relativeDir;
  if (refs.portraitRecordCopyPathsButton) refs.portraitRecordCopyPathsButton.disabled = state.assetRecordDeletion.busy || getPortraitRecordImagePaths(selectedSet).length === 0;
  if (refs.portraitRecordCopyPromptsButton) refs.portraitRecordCopyPromptsButton.disabled = state.assetRecordDeletion.busy || !buildPortraitRecordPromptText(selectedSet);
  if (refs.portraitRecordExportPromptsButton) refs.portraitRecordExportPromptsButton.disabled = state.assetRecordDeletion.busy || !buildPortraitRecordPromptText(selectedSet);
  if (refs.portraitRecordExportManifestButton) refs.portraitRecordExportManifestButton.disabled = state.assetRecordDeletion.busy || !selectedSet;
  if (refs.portraitRecordSelection) refs.portraitRecordSelection.textContent = selectedSet ? getPortraitSetDisplayTitle(selectedSet) : "尚未选择";

  renderPortraitRecordSetList();
  state.portrait.recordSetId = selectedSet?.setId || "";
  renderPortraitRecordArchiveDetail(selectedSet);

  if (!refs.portraitRecordResultGrid) {
    return;
  }
  refs.portraitRecordResultGrid.innerHTML = "";
  refs.portraitRecordResultGrid.classList.toggle("hidden", !selectedSet);
  if (!selectedSet) {
    return;
  }
  selectedSet.items.forEach((item, index) => {
    refs.portraitRecordResultGrid.appendChild(createPortraitCard(item, index, { showActions: false, showRecordActions: true }));
  });
}

function getPortraitRecordItemById(itemId, setId = "") {
  const selectedSet = setId
    ? state.portrait.sets.find((set) => set.setId === setId) || null
    : getPortraitRecordSelectedSet();
  if (!selectedSet || !itemId) {
    return null;
  }
  const item = selectedSet.items.find((entry) => entry.itemId === itemId) || null;
  return item ? { item, set: selectedSet } : null;
}

function buildPortraitRecordLightboxItem(item, set) {
  const relativeFilename = String(item.relativePath || "").split(/[\\/]/).filter(Boolean).pop() || "";
  return {
    ...item,
    id: `portrait-record:${set.setId}:${item.itemId || item.filename || relativeFilename}`,
    portraitItemId: item.itemId || "",
    portraitSetId: set.setId || "",
    filename: item.filename || relativeFilename || "portrait-item.png",
    createdAt: item.generationCompletedAt || set.updatedAt || set.createdAt || nowIso(),
    prompt: item.prompt || "",
    imageModel: item.imageModel || "gpt-image-2",
    isPortraitRecordItem: true,
  };
}

function openPortraitRecordItemPreview(itemId) {
  const record = getPortraitRecordItemById(itemId);
  if (!record?.item || !getImageUrl(record.item)) {
    setPortraitRecordFeedback("当前单张还没有可查看的大图。", "error");
    return;
  }
  openLightbox(buildPortraitRecordLightboxItem(record.item, record.set), {
    items: record.set.items,
    buildItem: (item) => buildPortraitRecordLightboxItem(item, record.set),
  });
}

async function loadPptDecks() {
  state.assetLoading.ppt = true;
  state.assetLoadErrors.ppt = "";
  renderPptRecordView();
  let response;
  try {
    response = await fetch("/api/ppt/decks");
  } catch (error) {
    state.assetLoading.ppt = false;
    state.assetLoadErrors.ppt = error instanceof Error ? error.message : String(error);
    renderPptRecordView();
    throw error;
  }
  if (!response.ok) {
    state.assetLoading.ppt = false;
    state.assetLoadErrors.ppt = "读取 PPT 历史失败";
    renderPptRecordView();
    throw new Error("读取 PPT 历史失败");
  }
  const payload = await response.json();
  state.ppt.decks = Array.isArray(payload) ? payload : [];
  const availableRecordKeys = new Set(state.ppt.decks.map(getPptDeckRecordKey));
  state.ppt.recordCheckedKeys = state.ppt.recordCheckedKeys.filter((recordKey) => availableRecordKeys.has(recordKey));
  if (!availableRecordKeys.has(state.ppt.recordDetail.deckKey)) {
    state.ppt.recordDetail.deckKey = "";
    state.ppt.recordDetail.slideNumber = 0;
  }
  state.assetLoading.ppt = false;
  state.assetLoadErrors.ppt = "";
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
  } else if (state.ppt.generating && !slide.errorMessage) {
    const loading = createGenerationLoadingShell(document, { key: `ppt-${slide.slideNumber}`, active: true, showLog: true, logText: slide.statusText || "" });
    thumb.classList.add("is-loading");
    thumb.setAttribute("aria-busy", "true");
    thumb.appendChild(loading.shell);
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
  const cards = getPptRenderableSlides().map((slide) => createPptSlideCard(slide));
  stopGenerationLoadingShells(refs.pptSlideList);
  refs.pptSlideList.replaceChildren(...cards);
}

function getPptDeckPageCount(deck) {
  return Number(deck?.pageCount) || Number(deck?.slides?.length) || 0;
}

function getPptDeckRecordKey(deck) {
  return String(deck?.deckId || deck?.pptxRelativePath || deck?.pptxUrl || deck?.pptxFilename || "");
}

function getPptRecordByKey(recordKey) {
  return state.ppt.decks.find((deck) => getPptDeckRecordKey(deck) === recordKey) || null;
}

function getPptSlideImageUrl(slide) {
  return slide?.imageUrl || slide?.thumbnailUrl || slide?.previewUrl || "";
}

function getPptDeckPreviewSlides(deck) {
  return Array.isArray(deck?.slides) ? deck.slides.filter((slide) => getPptSlideImageUrl(slide)) : [];
}

function selectPptRecord(recordKey) {
  const deck = assetRecordTimeFilterController.filter("ppt").find((entry) => getPptDeckRecordKey(entry) === recordKey);
  if (!deck) {
    return;
  }

  const slides = getPptDeckPreviewSlides(deck);
  state.ppt.recordDetail.deckKey = recordKey;
  state.ppt.recordDetail.slideNumber = Number(slides[0]?.slideNumber) || 0;
  renderPptRecordView();
  refs.pptRecordDetail.focus({ preventScroll: true });
}

function selectPptRecordSlide(slideNumber) {
  state.ppt.recordDetail.slideNumber = Number(slideNumber) || 0;
  renderPptRecordView();
}

function clearPptRecordSelection() {
  state.ppt.recordDetail.deckKey = "";
  state.ppt.recordDetail.slideNumber = 0;
  renderPptRecordView();
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

function createPptDeckRecordItem(deck) {
  const item = document.createElement("article");
  item.className = "ppt-record-card";
  const recordKey = getPptDeckRecordKey(deck);
  item.dataset.pptRecordKey = getPptDeckRecordKey(deck);
  item.tabIndex = 0;
  item.setAttribute("role", "option");
  item.setAttribute("aria-label", `查看 ${deck.title || "PPT 记录"} 预览`);
  item.classList.toggle("is-selected", state.ppt.recordDetail.deckKey === recordKey);
  item.setAttribute("aria-selected", String(state.ppt.recordDetail.deckKey === recordKey));

  const title = document.createElement("strong");
  title.textContent = deck.title || "未命名演示";
  item.appendChild(title);

  const meta = document.createElement("span");
  meta.textContent = formatPptDeckMeta(deck);
  item.appendChild(meta);

  const path = document.createElement("p");
  path.textContent = deck.pptxFilename || deck.pptxRelativePath || "PPTX 文件";
  item.appendChild(path);

  const source = document.createElement("span");
  source.className = "ppt-record-source";
  source.textContent = getPptDeckSourceLabel(deck);
  item.appendChild(source);

  const status = document.createElement("span");
  const pageCount = getPptDeckPageCount(deck);
  const completedPages = Array.isArray(deck.slides) ? deck.slides.filter((slide) => getPptSlideImageUrl(slide)).length : pageCount;
  status.className = "asset-record-status";
  status.dataset.state = completedPages >= pageCount && pageCount > 0 ? "completed" : "running";
  status.textContent = completedPages >= pageCount && pageCount > 0 ? "已完成" : `${completedPages}/${pageCount} 页`;
  item.appendChild(status);

  const actions = document.createElement("div");
  actions.className = "ppt-record-card-actions";
  const previewButton = document.createElement("button");
  previewButton.type = "button";
  previewButton.className = "toolbar-button";
  previewButton.textContent = "预览";
  actions.appendChild(previewButton);

  appendPptDeckDownloadLinks(actions, deck);
  item.appendChild(actions);

  return item;
}

function renderPptRecordDetail(deck) {
  refs.pptRecordDetail.innerHTML = "";

  if (!deck) {
    refs.pptRecordDetail.classList.add("is-empty");
    const empty = document.createElement("div");
    empty.className = "ppt-record-detail-empty";

    const title = document.createElement("strong");
    title.textContent = "选择一条 PPT 记录";
    empty.appendChild(title);

    const copy = document.createElement("p");
    copy.textContent = "点击左侧记录后，这里会显示该 PPT 的页面图片和下载信息。";
    empty.appendChild(copy);

    refs.pptRecordDetail.appendChild(empty);
    return;
  }

  refs.pptRecordDetail.classList.remove("is-empty");

  const slides = getPptDeckPreviewSlides(deck);
  const selectedSlide =
    slides.find((slide) => Number(slide.slideNumber) === Number(state.ppt.recordDetail.slideNumber)) || slides[0] || null;
  if (selectedSlide) {
    state.ppt.recordDetail.slideNumber = Number(selectedSlide.slideNumber) || 0;
  }

  const header = document.createElement("div");
  header.className = "ppt-record-detail-head";

  const summary = document.createElement("div");
  summary.className = "ppt-record-detail-summary";

  const title = document.createElement("strong");
  title.textContent = deck.title || "未命名演示";
  summary.appendChild(title);

  const meta = document.createElement("span");
  meta.textContent = formatPptDeckMeta(deck);
  summary.appendChild(meta);
  header.appendChild(summary);

  const actions = document.createElement("div");
  actions.className = "ppt-record-detail-actions";

  const backButton = document.createElement("button");
  backButton.type = "button";
  backButton.className = "toolbar-button";
  backButton.dataset.pptRecordBack = "true";
  backButton.textContent = "返回记录";
  actions.appendChild(backButton);

  appendPptDeckDownloadLinks(actions, deck);
  header.appendChild(actions);
  refs.pptRecordDetail.appendChild(header);

  const previewStage = document.createElement("div");
  previewStage.className = "ppt-record-preview-stage";

  if (selectedSlide) {
    const previewImage = document.createElement("img");
    previewImage.src = getPptSlideImageUrl(selectedSlide);
    previewImage.alt = selectedSlide.title || `${deck.title || "PPT"} 第 ${selectedSlide.slideNumber} 页`;
    previewStage.appendChild(previewImage);
  } else {
    const empty = document.createElement("div");
    empty.className = "ppt-record-detail-empty";
    const emptyTitle = document.createElement("strong");
    emptyTitle.textContent = "没有可预览的页面图片";
    empty.appendChild(emptyTitle);
    const emptyCopy = document.createElement("p");
    emptyCopy.textContent = "这条历史记录只包含 PPTX 文件，仍可直接下载查看。";
    empty.appendChild(emptyCopy);
    previewStage.appendChild(empty);
  }

  refs.pptRecordDetail.appendChild(previewStage);

  const strip = document.createElement("div");
  strip.className = "ppt-record-slide-strip";
  slides.forEach((slide) => {
    const slideButton = document.createElement("button");
    slideButton.type = "button";
    slideButton.className = "ppt-record-slide-button";
    slideButton.dataset.pptRecordSlide = String(slide.slideNumber);
    slideButton.classList.toggle("is-selected", Number(slide.slideNumber) === Number(state.ppt.recordDetail.slideNumber));
    slideButton.setAttribute("aria-label", `预览第 ${slide.slideNumber} 页`);

    const thumb = document.createElement("img");
    thumb.src = getPptSlideImageUrl(slide);
    thumb.alt = slide.title || `第 ${slide.slideNumber} 页`;
    slideButton.appendChild(thumb);

    const label = document.createElement("span");
    label.textContent = `${slide.slideNumber}. ${slide.title || "页面"}`;
    slideButton.appendChild(label);

    strip.appendChild(slideButton);
  });
  refs.pptRecordDetail.appendChild(strip);
}

function renderPptRecordView() {
  const { records: filteredDecks, hasActiveFilters } = assetRecordTimeFilterController.render("ppt");
  refs.pptRecordEmpty.classList.toggle("hidden", filteredDecks.length > 0 && !state.assetLoading.ppt && !state.assetLoadErrors.ppt);
  refs.pptRecordEmpty.replaceChildren();
  const emptyTitle = document.createElement("strong");
  const emptyCopy = document.createElement("p");
  const emptyAction = document.createElement("a");
  emptyAction.className = "toolbar-button asset-primary-action";
  if (state.assetLoading.ppt) {
    emptyTitle.textContent = "正在加载 PPT";
    emptyCopy.textContent = "正在读取本地记录，请稍候。";
    emptyAction.classList.add("hidden");
  } else if (state.assetLoadErrors.ppt) {
    emptyTitle.textContent = "PPT 记录加载失败";
    emptyCopy.textContent = state.assetLoadErrors.ppt;
    emptyAction.href = "#ppt-record";
    emptyAction.textContent = "重新加载";
    emptyAction.addEventListener("click", (event) => {
      event.preventDefault();
      loadPptDecks().catch((error) => showError(error.message));
    });
  } else if (hasActiveFilters) {
    emptyTitle.textContent = "没有匹配的 PPT";
    emptyCopy.textContent = "当前时间条件没有匹配记录。";
    emptyAction.href = "#ppt-record";
    emptyAction.textContent = "清空筛选";
    emptyAction.addEventListener("click", (event) => {
      event.preventDefault();
      assetRecordTimeFilterController.reset("ppt");
    });
  } else {
    emptyTitle.textContent = "暂无 PPT";
    emptyCopy.textContent = "还没有找到本地 PPT 文件。";
    emptyAction.href = "#ppt";
    emptyAction.textContent = "前往 PPT 生成";
  }
  refs.pptRecordEmpty.append(emptyTitle, emptyCopy, emptyAction);
  refs.pptRecordList.setAttribute("aria-busy", String(state.assetLoading.ppt));
  refs.pptRecordList.innerHTML = "";

  const visibleRecordKeys = new Set(filteredDecks.map(getPptDeckRecordKey));
  const checkedRecordKeys = new Set(state.ppt.recordCheckedKeys.filter((recordKey) => visibleRecordKeys.has(recordKey)));
  const checkedCount = checkedRecordKeys.size;
  const deleteBlocked = state.ppt.generating || state.assetLoading.ppt || state.assetRecordDeletion.busy;
  refs.pptRecordRefreshButton.disabled = state.assetRecordDeletion.busy;
  let selectedDeck = filteredDecks.find((deck) => getPptDeckRecordKey(deck) === state.ppt.recordDetail.deckKey) || filteredDecks[0] || null;
  if (selectedDeck && getPptDeckRecordKey(selectedDeck) !== state.ppt.recordDetail.deckKey) {
    state.ppt.recordDetail.deckKey = getPptDeckRecordKey(selectedDeck);
    state.ppt.recordDetail.slideNumber = Number(getPptDeckPreviewSlides(selectedDeck)[0]?.slideNumber) || 0;
  } else if (!selectedDeck) {
    state.ppt.recordDetail.deckKey = "";
    state.ppt.recordDetail.slideNumber = 0;
  }
  refs.pptRecordDeleteCurrentButton.disabled = deleteBlocked || !selectedDeck;
  refs.pptRecordDeleteSelectedButton.disabled = deleteBlocked || checkedCount === 0;
  refs.pptRecordDeleteSelectedButton.textContent = checkedCount > 0 ? `删除选中 (${checkedCount})` : "删除选中";

  if (refs.pptRecordSelection) refs.pptRecordSelection.textContent = selectedDeck?.title || selectedDeck?.pptxFilename || "尚未选择";

  filteredDecks.forEach((deck) => {
    const recordKey = getPptDeckRecordKey(deck);
    const row = document.createElement("div");
    row.className = "asset-record-select-row";
    row.classList.toggle("is-checked", checkedRecordKeys.has(recordKey));

    const selectLabel = document.createElement("label");
    selectLabel.className = "asset-record-select";
    selectLabel.title = `选择 ${deck.title || deck.pptxFilename || "PPT 记录"}`;
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = checkedRecordKeys.has(recordKey);
    checkbox.disabled = deleteBlocked;
    checkbox.dataset.pptRecordSelectKey = recordKey;
    checkbox.setAttribute("aria-label", `选择 PPT ${deck.title || deck.pptxFilename || "记录"}`);
    selectLabel.appendChild(checkbox);

    row.append(selectLabel, createPptDeckRecordItem(deck));
    refs.pptRecordList.appendChild(row);
  });

  renderPptRecordDetail(selectedDeck);
}

function renderPptView() {
  syncGenerationSchedulingLock();
  setPptSourceMode(state.ppt.sourceMode);
  renderPptFiles();
  pptAnalysis.render();

  const stats = getPptCompletionStats();
  const missing = getPptMissingSlideNumbers();
  refs.pptStatusText.textContent = state.ppt.statusText;
  refs.pptCompletionRatio.textContent = `${stats.completed} / ${stats.total} 页成功`;
  refs.pptProgressBar.style.width = stats.total > 0 ? `${Math.round((stats.completed / stats.total) * 100)}%` : "0%";
  refs.pptCompleteMissingButton.classList.toggle("hidden", missing.length === 0 || !state.ppt.outline);
  refs.pptCompleteMissingButton.disabled = state.ppt.generating || missing.length === 0;
  refs.pptCompleteMissingButton.textContent = missing.length > 0 ? `补齐缺页 (${missing.length})` : "补齐缺页";
  refs.pptGenerateButton.disabled = state.ppt.generating;
  renderInlineBusyButton(refs.pptGenerateButton, {
    busy: state.ppt.generating,
    busyText: "正在生成",
    idleText: "生成 PPT 演示文稿",
  });

  refs.pptDownloadLink.href = state.ppt.pptxUrl || "#";
  refs.pptDownloadLink.classList.toggle("disabled", !state.ppt.pptxUrl);
  refs.pptDownloadLink.setAttribute("aria-disabled", String(!state.ppt.pptxUrl));
  refs.pptEditableDownloadLink.href = state.ppt.editablePptxUrl || "#";
  refs.pptEditableDownloadLink.classList.toggle("disabled", !state.ppt.editablePptxUrl);
  refs.pptEditableDownloadLink.setAttribute("aria-disabled", String(!state.ppt.editablePptxUrl));

  if (state.ppt.outline) {
    refs.pptOutlineBox.textContent = `${state.ppt.outline.title} · ${state.ppt.outline.slides.length} 页`;
  } else {
    refs.pptOutlineBox.textContent = "";
  }

  renderPptSlides();
  renderPptRecordView();
}

function getStyleTransferReferenceFiles() {
  const stylePresetFile = getStyleTransferPresetReferenceFile();
  const styleReferenceFile = stylePresetFile || getStyleTransferGenerationFile("style");
  return [getStyleTransferGenerationFile("source"), styleReferenceFile].filter(Boolean);
}

function buildStyleTransferPrompt() {
  const userNote = String(refs.styleTransferInstructionInput?.value || "").trim();
  const preset = getStyleTransferPreset();
  const presetNote = hasSelectedStyleTransferPreset()
    ? `Use the second reference image, the built-in "${preset.label}" preset image, only as the style reference. ${preset.prompt}`
    : "Use the second reference image only as the style reference.";
  const parts = [
    "Use the first reference image as the source image.",
    "preserve every visible subject, object, pose, layout, composition, spatial relationship, and identity signal from the source image.",
    presetNote,
    "The second reference image is the style authority; if the source image's visual style conflicts with it, follow the second reference image.",
    "The final image should visibly match the style reference image's surface treatment, palette, line behavior, texture, and rendering medium.",
    "Transfer the style reference's realism level, camera/lens look, color grade, lighting, shading, texture, edge treatment, material finish, rendering style, and mood.",
    "If the style reference is a real photograph, the final image must be photorealistic with natural skin texture, realistic anatomy, optical lens behavior, real lighting, and natural material response.",
    "Do not keep anime, cartoon, comic, cel-shaded, line-art, CGI doll, or illustration residue from the source image unless those traits also exist in the style reference.",
    "Do not copy subjects, objects, logos, text, or layout from the style reference image unless they also exist in the source image.",
    "Return one polished final image with the source image's content faithfully migrated into the style reference's visual style.",
  ];

  if (userNote) {
    parts.push(`Additional user note: ${userNote}`);
  }

  return parts.join(" ");
}

function createJob() {
  const ratioOption = getRatioOption(refs.ratioInput.value || DEFAULT_UI_RATIO);
  const referenceFiles = state.referenceFiles.map(getGenerationReferenceFile);
  const referenceImageNames = state.referenceFiles.map((item) => item.file.name);
  const sizeSetting = getSelectedGenerationSize();
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    prompt: buildPromptModePrompt(),
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png"),
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || DEFAULT_RESPONSES_MODEL,
    imageModel: DEFAULT_DIRECT_IMAGE_MODEL,
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    requestRetryCount: 0,
    referenceFiles,
    hasReferenceImage: referenceFiles.length > 0,
    referenceImageName: referenceImageNames[0] || "",
    referenceImageNames,
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: buildGenerationTaskStatusText({ statusStage: "queued", statusText: "等待并发槽位" }),
    previewUrl: "",
  };
}

function createStyleTransferJob() {
  const ratioOption = getRatioOption(refs.ratioInput.value || DEFAULT_UI_RATIO);
  const referenceFiles = getStyleTransferReferenceFiles();
  const sourceItem = state.styleTransfer.source;
  const styleItem = state.styleTransfer.style;
  const stylePreset = getStyleTransferPreset();
  const stylePresetFile = getStyleTransferPresetReferenceFile();
  const sizeSetting = getSelectedGenerationSize();
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    mode: "style-transfer",
    prompt: buildStyleTransferPrompt(),
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png"),
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || DEFAULT_RESPONSES_MODEL,
    imageModel: DEFAULT_DIRECT_IMAGE_MODEL,
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    requestRetryCount: 0,
    referenceFiles: getStyleTransferReferenceFiles(),
    hasReferenceImage: referenceFiles.length > 0,
    referenceImageName: sourceItem?.file?.name || "",
    referenceImageNames: [sourceItem?.file?.name || "", stylePresetFile?.name || styleItem?.file?.name || ""].filter(Boolean),
    styleTransferSourceImageName: sourceItem?.file?.name || "",
    styleTransferReferenceImageName: stylePresetFile?.name || styleItem?.file?.name || "",
    styleTransferPreset: stylePreset?.value || STYLE_TRANSFER_CUSTOM_PRESET,
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: buildGenerationTaskStatusText({ statusStage: "queued", statusText: "等待并发槽位" }),
    previewUrl: "",
  };
}

function getSelectedReferenceAnalysisGenerationSize() {
  return normalizeSizeForSelectedRoute(refs.referenceAnalysisRatioInput.value || DEFAULT_UI_RATIO, refs.referenceAnalysisSizeInput.value || "auto");
}

function getReferenceAnalysisSelectedLanguage() {
  return normalizeReferenceAnalysisLanguage(
    refs.referenceAnalysisLanguageInput?.value || state.referenceAnalysis.outputLanguage || "zh-CN",
    refs.referenceAnalysisLanguageInput?.selectedOptions?.[0]?.textContent || "",
  );
}

function createReferenceAnalysisJob() {
  const ratioOption = getRatioOption(refs.referenceAnalysisRatioInput.value || DEFAULT_UI_RATIO);
  const referenceFiles = state.referenceAnalysis.files.map(getReferenceAnalysisGenerationFile).filter(Boolean);
  const referenceImageNames = state.referenceAnalysis.files.map((item) => item.file.name).filter(Boolean);
  const sizeSetting = getSelectedReferenceAnalysisGenerationSize();
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;
  const targetLanguage = getReferenceAnalysisSelectedLanguage();

  return {
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    mode: "reference-analysis",
    prompt: String(state.referenceAnalysis.selectedPrompt || "").trim(),
    targetLanguage: targetLanguage.value,
    targetLanguageLabel: targetLanguage.label,
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(state.config?.defaults?.format || "png"),
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || DEFAULT_RESPONSES_MODEL,
    imageModel: DEFAULT_DIRECT_IMAGE_MODEL,
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    requestRetryCount: 0,
    referenceFiles,
    hasReferenceImage: referenceFiles.length > 0,
    referenceImageName: referenceImageNames[0] || "",
    referenceImageNames,
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: buildGenerationTaskStatusText({ statusStage: "queued", statusText: "等待并发槽位" }),
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
  state.locallyTerminatedGenerationTaskIds.add(jobId);
  releaseGenerationLoadingSource(makeJobPreviewKey(jobId));
  state.jobs = state.jobs.filter((job) => job.id !== jobId);
}

function recordPromptDeckImage(job, previewUrl, kind) {
  if (!isPromptDeckJob(job) || !previewUrl) {
    return;
  }
  recordPromptAttemptImage(state.promptAttemptDecks, {
    deckKey: makeJobPreviewKey(job.id),
    previewUrl,
    kind,
    updatedAt: nowIso(),
  });
}

// Decks render in the prompt filmstrip slot. These four modes drive their own
// dedicated preview surfaces, so they keep the existing single-preview behavior.
const DECK_EXCLUDED_JOB_MODES = new Set(["reference-analysis", "image-decomposition", "image-edit", "quick-blend"]);

function isPromptDeckJob(job) {
  return Boolean(job) && !DECK_EXCLUDED_JOB_MODES.has(String(job.mode || ""));
}

function sealPromptDeckOnFailure(job, message) {
  if (!isPromptDeckJob(job)) {
    return;
  }
  failPromptAttemptDeck(state.promptAttemptDecks, {
    deckKey: makeJobPreviewKey(job.id),
    errorMessage: compactErrorMessage(message, "生成请求失败"),
    updatedAt: nowIso(),
  });
}

function getPromptDeckLastPreviewUrl(job) {
  if (!isPromptDeckJob(job)) {
    return "";
  }
  const cards = getPromptAttemptCards(state.promptAttemptDecks, makeJobPreviewKey(job.id));
  return cards.length > 0 ? cards[cards.length - 1].previewUrl : "";
}

function getPromptDeckCardsForKey(previewKey) {
  return getPromptAttemptCards(state.promptAttemptDecks, previewKey);
}

function togglePromptDeckExpanded(previewKey) {
  state.expandedPromptDeckKey = state.expandedPromptDeckKey === previewKey ? "" : previewKey;
  renderFilmstrip();
}

function getPromptDeckAttemptPreviewUrl(previewKey, attemptIndex) {
  return (
    getPromptDeckCardsForKey(previewKey).find((card) => card.attemptIndex === Number(attemptIndex))?.previewUrl || ""
  );
}

async function savePromptAttemptPreview(deckKey, attemptIndex) {
  const card = getPromptDeckCardsForKey(deckKey).find((entry) => entry.attemptIndex === Number(attemptIndex));
  if (!card || card.savedFilename) {
    return;
  }

  const match = /^data:([^;]+);base64,(.*)$/i.exec(card.previewUrl || "");
  if (!match) {
    showError("这张未完成预览没有可保存的图片数据。");
    return;
  }

  const job = state.jobs.find((entry) => makeJobPreviewKey(entry.id) === deckKey) || null;
  try {
    const response = await fetch("/api/prompt-preview/save", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageBase64: match[2],
        format: normalizeOutputFormat(job?.format || match[1].split("/")[1] || "png"),
        prompt: job?.prompt || "",
        ratio: job?.ratio || "",
        size: job?.size || "",
        quality: job?.quality || "",
        baseUrl: job?.baseUrl || "",
        responsesModel: job?.responsesModel || "",
        imageRoute: job?.imageRoute || "",
        imageModel: job?.imageModel || "",
        reasoningEffort: job?.reasoningEffort || "",
      }),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok) {
      throw new Error(compactErrorMessage(payload.message, "另存未完成预览失败。"));
    }

    markPromptAttemptSaved(state.promptAttemptDecks, { deckKey, attemptIndex, filename: payload.filename });
    if (payload.item) {
      upsertGalleryItem(payload.item);
      recordPromptFilmstripSessionFilename(payload.item.filename);
    }
    renderAll();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
  }
}

function cancelQueuedJob(jobId) {
  const { jobs, canceledJob } = cancelQueuedGenerationJob(state.jobs, jobId);
  if (!canceledJob) {
    return false;
  }

  state.jobs = jobs;
  releaseGenerationLoadingSource(makeJobPreviewKey(canceledJob.id));
  if (state.selectedPreviewKey === makeJobPreviewKey(canceledJob.id)) {
    state.selectedPreviewKey = "";
  }
  if (canceledJob.mode === "reference-analysis") {
    removeReferenceAnalysisGenerationKey(makeJobPreviewKey(canceledJob.id));
  }
  if (canceledJob.mode === "image-decomposition") {
    removeImageDecompositionGenerationKey(makeJobPreviewKey(canceledJob.id));
  }
  if (canceledJob.mode === "image-edit") {
    removeImageEditGenerationKey(makeJobPreviewKey(canceledJob.id));
  }
  if (canceledJob.mode === "quick-blend") {
    removeQuickBlendGenerationKey(makeJobPreviewKey(canceledJob.id));
  }
  handleActivityCanceled(canceledJob);
  scheduleGenerationQueue();
  renderAll();
  return true;
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
  state.galleryLoading = true;
  state.galleryLoadError = "";
  renderActiveView();

  try {
    const response = await fetch("/api/gallery");
    if (!response.ok) {
      throw new Error("读取本地画廊失败");
    }

    const payload = await response.json();
    const browserCachedItems = await readBrowserCachedGalleryItems({ restoreImageData: false });
    const sortedItems = sortGalleryItemsByCreatedAtDesc(
      mergeServerAndBrowserGalleryItems(Array.isArray(payload) ? payload : [], browserCachedItems),
    );
    const hydratedGallery = hydrateGalleryItems(sortedItems);
    state.gallery = sortGalleryItemsByCreatedAtDesc(hydratedGallery.items);
    capturePromptFilmstripBaseline();
    const availableFilenames = new Set(state.gallery.map((item) => item.filename));
    state.galleryCheckedFilenames = state.galleryCheckedFilenames.filter((filename) => availableFilenames.has(filename));
    if (!availableFilenames.has(state.galleryCurrentFilename)) state.galleryCurrentFilename = "";
    state.galleryLoading = false;
    state.galleryLoadError = "";
    renderAll();
    void repairGalleryMetadataQueue(hydratedGallery.repairQueue);
  } catch (error) {
    state.galleryLoading = false;
    state.galleryLoadError = error instanceof Error ? error.message : String(error);
    renderAll();
    throw error;
  }
}

function normalizeGenerationTaskSnapshot(task) {
  const id = String(task?.id || "").trim();
  if (!id) {
    return null;
  }

  const status = normalizeGenerationTaskStatus(task.status);
  const statusStage = String(task.statusStage || status);
  const mode = String(task.mode || task.generationMode || "").trim();
  return {
    ...task,
    id,
    mode,
    generationMode: String(task.generationMode || mode || ""),
    status,
    createdAt: String(task.createdAt || nowIso()),
    updatedAt: String(task.updatedAt || task.createdAt || nowIso()),
    generationStartedAt: String(task.generationStartedAt || task.item?.generationStartedAt || ""),
    generationCompletedAt: String(task.generationCompletedAt || task.item?.generationCompletedAt || ""),
    prompt: String(task.prompt || ""),
    errorMessage: String(task.errorMessage || ""),
    statusText: buildGenerationTaskStatusText({ status, statusStage: task.statusStage || status, statusText: task.statusText, errorMessage: task.errorMessage }),
    referenceFiles: [],
    started: status === "running",
    isRunning: status === "running",
    statusStage,
  };
}

function applyGenerationTaskSnapshots(tasks, { render = true } = {}) {
  const existingJobs = new Map(state.jobs.map((job) => [job.id, job]));
  const snapshots = filterLocallyTerminatedGenerationTaskSnapshots(tasks, state.locallyTerminatedGenerationTaskIds)
    .map(normalizeGenerationTaskSnapshot)
    .filter(Boolean)
    .map((snapshot) => {
      const existing = existingJobs.get(snapshot.id);
      return {
        ...snapshot,
        mode: snapshot.mode || existing?.mode || "",
        generationMode: snapshot.generationMode || snapshot.mode || existing?.generationMode || existing?.mode || "",
      };
    });
  const snapshotIds = new Set(snapshots.map((task) => task.id));

  snapshots.forEach((task) => {
    const taskPreviewKey = makeJobPreviewKey(task.id);
    const wasSelectedPreview = state.selectedPreviewKey === taskPreviewKey;
    const wasTrackedQuickBlendJob = task.mode === "quick-blend" && existingJobs.has(task.id);
    const wasTrackedImageEditJob = task.mode === "image-edit" && existingJobs.has(task.id);

    if (task.status === "completed" || task.status === "error") {
      releaseGenerationLoadingSource(taskPreviewKey);
    }

    if (task.status === "completed" && task.item) {
      if (task.mode === "reference-analysis") {
        task.item.mode = "reference-analysis";
        storeReferenceAnalysisGenerationItem(task.item);
        replaceReferenceAnalysisGenerationKey(taskPreviewKey, makeGalleryPreviewKey(task.item.filename));
        if (state.referenceAnalysis.previewKey === taskPreviewKey) {
          state.referenceAnalysis.previewKey = makeGalleryPreviewKey(task.item.filename);
        }
      }
      if (task.mode === "image-decomposition") {
        task.item.mode = "image-decomposition";
        storeImageDecompositionGenerationItem(task.item);
        replaceImageDecompositionGenerationKey(taskPreviewKey, makeGalleryPreviewKey(task.item.filename));
        if (state.imageDecomposition.previewKey === taskPreviewKey) {
          state.imageDecomposition.previewKey = makeGalleryPreviewKey(task.item.filename);
        }
      }
      if (task.mode === "image-edit") {
        task.item.mode = "image-edit";
        storeImageEditGenerationItem(task.item);
        replaceImageEditGenerationKey(taskPreviewKey, makeGalleryPreviewKey(task.item.filename));
        if (state.imageEdit.previewKey === taskPreviewKey) {
          state.imageEdit.previewKey = makeGalleryPreviewKey(task.item.filename);
        }
      }
      if (task.mode === "quick-blend") {
        task.item.mode = "quick-blend";
        storeQuickBlendGenerationItem(task.item);
        replaceQuickBlendGenerationKey(taskPreviewKey, makeGalleryPreviewKey(task.item.filename));
        if (state.quickBlend.previewKey === taskPreviewKey) {
          state.quickBlend.previewKey = makeGalleryPreviewKey(task.item.filename);
        }
      }
      upsertGalleryItem(task.item);
      recordPromptFilmstripSessionResult(task, task.item);
      if (state.selectedPreviewKey === taskPreviewKey && task.item.filename) {
        state.selectedPreviewKey = makeGalleryPreviewKey(task.item.filename);
      }
    }

    if (task.status === "error" && wasSelectedPreview) {
      state.selectedPreviewKey = "";
    }

    if (task.status === "error" && task.mode === "reference-analysis") {
      removeReferenceAnalysisGenerationKey(taskPreviewKey);
    }
    if (task.status === "error" && task.mode === "image-decomposition") {
      removeImageDecompositionGenerationKey(taskPreviewKey);
    }
    if (task.status === "error" && task.mode === "image-edit") {
      removeImageEditGenerationKey(taskPreviewKey);
      if (wasTrackedImageEditJob || wasSelectedPreview) {
        setImageEditFeedback(task.errorMessage || "图片编辑任务失败。", "error");
      }
    }
    if (task.status === "error" && task.mode === "quick-blend") {
      removeQuickBlendGenerationKey(taskPreviewKey);
      if (wasTrackedQuickBlendJob || wasSelectedPreview) {
        setQuickBlendFeedback(task.errorMessage || "快速溶图任务失败。", "error");
      }
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
  const hasLocalQueuedJobs = localTransientJobs.some((job) => isQueuedGenerationJob(job));

  state.generationTasks = snapshots;
  state.jobs = sortGalleryItemsByCreatedAtDesc([...remoteRunningJobs, ...localTransientJobs]);

  if (!state.selectedPreviewKey && state.jobs.length > 0) {
    state.selectedPreviewKey = makeJobPreviewKey(state.jobs[0].id);
  }

  if (render) {
    renderAll();
  }

  if (hasLocalQueuedJobs) {
    scheduleGenerationQueue();
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

function syncPromptAgentHistoryToTemplates(history) {
  const nextTemplates = mergePromptAgentHistoryTemplates({
    history,
    templates: state.promptTemplates,
    getTemplateId: getPromptAgentTemplateId,
    getPrompt: getPromptAgentReusableText,
    getName: getPromptAgentDisplayName,
    skipItem: (historyItem) => state.promptTemplateDismissedHistoryIds.has(getPromptAgentTemplateId(historyItem)),
  });
  if (nextTemplates.length === state.promptTemplates.length) {
    return false;
  }

  state.promptTemplates = nextTemplates;
  writePromptTemplates();
  renderPromptTemplates();
  return true;
}

async function loadPromptAgentHistory({ force = false } = {}) {
  if (state.promptAgent.historyLoaded && !force) {
    syncPromptAgentHistoryToTemplates(state.promptAgent.history);
    return state.promptAgent.history;
  }

  const response = await fetch("/api/prompt-agent/history");
  if (!response.ok) {
    throw new Error("读取图片提示词历史失败");
  }

  const payload = await response.json();
  state.promptAgent.history = Array.isArray(payload) ? payload : [];
  state.promptAgent.historyLoaded = true;
  syncPromptAgentHistoryToTemplates(state.promptAgent.history);
  renderPromptAgent();
  return state.promptAgent.history;
}

async function saveConfig(event) {
  event.preventDefault();
  clearError();

  syncEndpointFieldsFromFullUrlModes();
  const payload = getCurrentPrivateConfigRequestPayload();
  // Submitting with Enter can skip the field's change event, so clamp here too
  // and reflect the stored value back into the control.
  if (refs.generationStartDelayInput) {
    refs.generationStartDelayInput.value = String(payload[GENERATION_START_DELAY_FIELD]);
  }
  if (refs.generationConcurrencyInput) {
    refs.generationConcurrencyInput.value = String(payload[GENERATION_CONCURRENCY_FIELD]);
  }

  const browserConfig = saveBrowserPrivateConfig(payload);
  state.config = toPublicBrowserConfig(browserConfig, state.config || {});
  refs.apiKeyInput.value = "";
  refs.directApiKeyInput.value = "";
  if (refs.directTextApiKeyInput) refs.directTextApiKeyInput.value = "";
  refs.protocolApiKeyInput.value = "";
  configModelPicker.setFeedback("配置已保存到当前浏览器。", "success");
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

const productImageImportController = createProductImageImportController({ applyFiles: applyCreationReferenceFiles, canHandlePaste: () => state.activeView === "creation" && !isCreationLogoBatchBranch(), getMaximumCount: getCreationMaxProductReferenceImageCount, getRemainingCapacity: () => getCreationMaxProductReferenceImageCount() - state.creationReferenceFiles.length, onError: showError, setFeedback: setCreationFeedback });

const assetRecordDeleteController = createAssetRecordDeleteController({
  refs,
  state,
  actions: {
    closeLightbox,
    deleteBrowserCachedGalleryItem,
    filterArticleRecords: () => assetRecordTimeFilterController.filter("article"),
    filterPortraitRecords: () => assetRecordTimeFilterController.filter("portrait"),
    filterPptRecords: () => assetRecordTimeFilterController.filter("ppt"),
    forgetGalleryMetadata,
    formatArticleTitle: formatArticleDisplayText,
    getArticleCurrentRecord: getArticleRecordSelectedSet,
    getGalleryVisibleItems: getVisibleGalleryItems,
    getPortraitCurrentRecord: getPortraitRecordSelectedSet,
    getPortraitTitle: getPortraitSetDisplayTitle,
    getPptRecordKey: getPptDeckRecordKey,
    isPortraitRefreshing: () => Boolean(portraitRecordRefreshPromise),
    preserveGalleryItem: (item) => Promise.all([
      preserveReferenceAnalysisGenerationItemForDelete(item),
      preserveImageDecompositionGenerationItemForDelete(item),
      preserveImageEditGenerationItemForDelete(item),
      preserveQuickBlendGenerationItemForDelete(item),
    ]),
    renderArticleRecords: renderArticleRecordView,
    renderArticleWorkspace: renderArticleIllustrationView,
    renderGalleryWorkspace: renderAll,
    renderPortraitRecords: renderPortraitRecordView,
    renderPortraitWorkspace: renderPortraitView,
    renderPptWorkspace: renderPptView,
    setArticleFeedback: setArticleRecordFeedback,
    setPortraitFeedback: setPortraitRecordFeedback,
  },
});
const requestAssetRecordDelete = assetRecordDeleteController.requestDelete;
const updateCheckedRecordIds = assetRecordDeleteController.updateCheckedRecordIds;
async function deleteGalleryItem(item) {
  if (!item?.filename) {
    return;
  }

  const confirmed = window.confirm(`确认删除 ${item.filename} 吗？`);
  if (!confirmed) {
    return;
  }

  await Promise.all([
    preserveReferenceAnalysisGenerationItemForDelete(item),
    preserveImageDecompositionGenerationItemForDelete(item),
    preserveImageEditGenerationItemForDelete(item),
    preserveQuickBlendGenerationItemForDelete(item),
  ]);
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

  await Promise.all(
    state.gallery.flatMap((item) => [
      preserveReferenceAnalysisGenerationItemForDelete(item),
      preserveImageDecompositionGenerationItemForDelete(item),
      preserveImageEditGenerationItemForDelete(item),
      preserveQuickBlendGenerationItemForDelete(item),
    ]),
  );
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
  formData.set("background", "1");
  formData.set("prompt", job.prompt);
  formData.set("ratio", job.ratio);
  formData.set("size", job.size);
  formData.set("format", job.format);
  formData.set("reasoningEffort", job.reasoningEffort);
  formData.set("clientSessionId", state.clientSessionId);
  if (job.mode) {
    formData.set("mode", job.mode);
  }
  if (job.targetLanguage) {
    formData.set("targetLanguage", job.targetLanguage);
    formData.set("targetLanguageLabel", job.targetLanguageLabel || job.targetLanguage);
  }
  appendJobConfigToFormData(formData, job);

  if (job.mode === "quick-blend") {
    appendQuickBlendReferencesToFormData(formData, job);
  } else if (job.mode === "image-edit") {
    appendImageEditReferencesToFormData(formData, job);
  } else if (job.mode === "style-transfer") {
    appendStyleTransferReferencesToFormData(formData, job);
  } else if (job.mode === "image-decomposition") {
    appendImageDecompositionReferencesToFormData(formData, job);
  } else {
    job.referenceFiles.forEach((file) => {
      formData.append("referenceImages", file);
    });
  }

  return formData;
}

function appendQuickBlendReferencesToFormData(formData, job) {
  formData.set("mode", "quick-blend");
  formData.set("quickBlendPairIndex", job.quickBlendPairIndex);
  formData.set("quickBlendAImageName", job.quickBlendAImageName);
  formData.set("quickBlendBImageName", job.quickBlendBImageName);
  formData.set("quickBlendCImageName", job.quickBlendCImageName || "");
  formData.set("quickBlendDImageName", job.quickBlendDImageName || "");
  formData.set("quickBlendLayoutOrder", job.quickBlendLayoutOrder || "vertical");
  formData.set("quickBlendPlacementShape", job.quickBlendPlacementShape || "square");
  job.referenceFiles.forEach((file) => formData.append("referenceImages", file));
}

function appendImageDecompositionReferencesToFormData(formData, job) {
  formData.set("mode", "image-decomposition");
  formData.set("targetLanguage", job.targetLanguage || "zh-CN");
  formData.set("customTargetLanguage", job.customTargetLanguage || "");
  formData.set("featureCardsEnabled", job.featureCardsEnabled ? "1" : "0");
  job.referenceFiles.forEach((file) => {
    formData.append("referenceImages", file);
  });
}

function appendImageEditReferencesToFormData(formData, job) {
  formData.set("mode", "image-edit");
  formData.set("sourceImageName", job.sourceImageName || job.referenceImageName || "");
  formData.set("editInstruction", job.editInstruction || job.prompt || "");
  job.referenceFiles.slice(0, 1).forEach((file) => {
    formData.append("referenceImages", file);
  });
  if (job.editMode === "local-mask") {
    formData.set("editMode", "local-mask");
    formData.set("executionStrategy", job.executionStrategy || "merge");
    formData.set("regionInstructions", JSON.stringify(job.regionInstructions || []));
    if (job.localMask?.mask) {
      formData.set("mask", job.localMask.mask);
    }
    for (const mask of job.localMask?.masks || []) {
      formData.append("masks[]", mask);
    }
  }
}

function getCreationReferenceAnalysisSnapshot() {
  return JSON.stringify({
    platform: getCreationSelectedPlatform().value,
    files: state.creationReferenceFiles.map((item) => ({
    name: item?.file?.name || item?.name || "",
    size: item?.file?.size || item?.size || 0,
    type: item?.file?.type || item?.type || "",
    lastModified: item?.file?.lastModified || item?.lastModified || 0,
    })),
  });
}

async function handleCreationPlatformChange({ programmatic = false } = {}) {
  const nextPlatform = getCreationSelectedPlatform().value;
  const previousPlatform = creationPreviousPlatformValue || nextPlatform;
  if (programmatic || previousPlatform === nextPlatform) {
    creationPreviousPlatformValue = nextPlatform;
    return;
  }
  creationPreviousPlatformValue = nextPlatform;
  invalidateCreationReferenceAnalysisRequest();
  state.creation.platformSetOverrides = {};
  state.creation.platformItemOverrides = [];
  setFrozenCreationPlatformPayload({ platformSetOverrides: {}, platformItemOverrides: [] });
  state.creationRoleSelectionManuallyEdited = false;
  const nextProfile = getCreationPlatformImageCountProfile(nextPlatform);
  syncCreationPlatformImageCountOptions({ preferredValue: nextProfile.recommendedImageCount });
  syncCreationAutomaticPlatformControls(nextPlatform);
  resetCreationDraftPreview();
  await requestCreationPlanPreview();
}

function getPortraitPlanSnapshot() {
  return JSON.stringify({
    subjectSummary: refs.portraitSubjectSummaryInput?.value.trim() || "",
    imageCount: clampPortraitImageCount(refs.portraitImageCountInput?.value, { write: false }),
    selectedStyles: getPortraitSelectedStyles(),
    selectedShotTypes: getPortraitSelectedShotTypes(),
    selectedActions: getPortraitSelectedActions(),
    customStyle: refs.portraitCustomStyleInput?.value.trim() || "",
    location: portraitLocationController.getPayload().selection,
    notes: refs.portraitNotesInput?.value.trim() || "",
    ratio: refs.portraitRatioInput?.value || DEFAULT_PORTRAIT_RATIO,
    size: refs.portraitSizeInput?.value || "auto",
    format: refs.portraitOutputFormatInput?.value || "png",
    analysis: state.portrait.referenceAnalysis.applied ? state.portrait.referenceAnalysis.result : null,
    references: getPortraitReferenceFileNames(),
  });
}

function invalidateCreationReferenceAnalysisRequest() { creationReferenceAnalysisAbortController?.abort(); creationReferenceAnalysisAbortController = null; creationReferenceAnalysisRequestToken += 1; state.creationReferenceAnalysis.running = false; }

function appendStyleTransferReferencesToFormData(formData, job) {
  formData.set("mode", "style-transfer");
  formData.set("styleTransferSourceImageName", job.styleTransferSourceImageName);
  formData.set("styleTransferReferenceImageName", job.styleTransferReferenceImageName);
  job.referenceFiles.forEach((file) => {
    formData.append("referenceImages", file);
  });
}

function applyPromptAgentFile(fileList) {
  const file = [...(fileList || [])].find((item) => item.type.startsWith("image/"));
  if (!file) {
    setPromptAgentFeedback("请选择一张图片。", "error");
    return;
  }

  invalidatePromptAgentAnalysisRequest();
  revokePromptAgentPreview();
  state.promptAgent.file = file;
  state.promptAgent.previewUrl = URL.createObjectURL(file);
  state.promptAgent.result = null;
  refs.promptAgentImageInput.value = "";
  setPromptAgentFeedback("", "");
  renderPromptAgent();
}

function getPromptAgentAnalysisSnapshot() {
  const file = state.promptAgent.file;
  return file ? buildReferenceFingerprint(file) : "";
}

function invalidatePromptAgentAnalysisRequest() {
  promptAgentAnalysisAbortController?.abort();
  promptAgentAnalysisAbortController = null;
  promptAgentAnalysisRequestToken += 1;
  state.promptAgent.running = false;
}

async function buildPromptAgentFormData() {
  const formData = new FormData();
  formData.set("image", await preparePromptAnalysisImageFile(state.promptAgent.file));
  formData.set("reasoningEffort", PROMPT_AGENT_ANALYSIS_REASONING_EFFORT);
  appendCurrentConfigToFormData(formData);
  return formData;
}

async function buildReferenceAnalysisFormData() {
  const formData = new FormData();
  const targetLanguage = getReferenceAnalysisSelectedLanguage();
  formData.set("mode", "reference-orchestration");
  formData.set("targetLanguage", targetLanguage.value);
  formData.set("targetLanguageLabel", targetLanguage.label);
  formData.set(
    "reasoningEffort",
    REFERENCE_ORCHESTRATION_REASONING_EFFORT,
  );
  const analysisFiles = await Promise.all(
    state.referenceAnalysis.files.map((item) => preparePromptAnalysisImageFile(item.file)),
  );
  analysisFiles.forEach((file) => {
    formData.append("image", file);
  });
  appendCurrentConfigToFormData(formData);
  return formData;
}

function getReferenceAnalysisRequestSnapshot() {
  return JSON.stringify({
    language: getReferenceAnalysisSelectedLanguage().value,
    files: state.referenceAnalysis.files.map((item) => item.fingerprint || buildReferenceFingerprint(item.file)),
  });
}

function invalidateReferenceAnalysisRequest() {
  referenceAnalysisAbortController?.abort();
  referenceAnalysisAbortController = null;
  referenceAnalysisRequestToken += 1;
  state.referenceAnalysis.running = false;
}

async function analyzePromptAgentImage() {
  clearError();
  if (!state.promptAgent.file) {
    setPromptAgentFeedback("请先上传一张图片。", "error");
    return;
  }

  const requestToken = promptAgentAnalysisRequestToken + 1;
  promptAgentAnalysisRequestToken = requestToken;
  promptAgentAnalysisAbortController?.abort();
  const requestController = new AbortController();
  promptAgentAnalysisAbortController = requestController;
  const analysisSnapshot = getPromptAgentAnalysisSnapshot();
  state.promptAgent.running = true;
  setPromptAgentFeedback("正在分析图片...", "busy");
  renderPromptAgent();

  try {
    const formData = await buildPromptAgentFormData();
    if (requestToken !== promptAgentAnalysisRequestToken || analysisSnapshot !== getPromptAgentAnalysisSnapshot()) {
      return;
    }
    const response = await fetch("/api/prompt-agent/analyze", {
      method: "POST",
      signal: requestController.signal,
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (requestToken !== promptAgentAnalysisRequestToken || analysisSnapshot !== getPromptAgentAnalysisSnapshot()) {
      return;
    }
    if (!response.ok) {
      throw new Error(payload.message || "图片分析失败。");
    }

    state.promptAgent.result = payload.item;
    state.promptAgent.history = [
      payload.item,
      ...state.promptAgent.history.filter((item) => item.id !== payload.item.id),
    ];
    savePromptAgentResultAsTemplate(payload.item);
    setPromptAgentFeedback("已生成结构化反推 JSON。", "success");
  } catch (error) {
    if (requestToken !== promptAgentAnalysisRequestToken || analysisSnapshot !== getPromptAgentAnalysisSnapshot()) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    setPromptAgentFeedback(message, "error");
    showError(message);
  } finally {
    if (requestToken === promptAgentAnalysisRequestToken) {
      promptAgentAnalysisAbortController = null;
      state.promptAgent.running = false;
      renderPromptAgent();
    }
  }
}

async function analyzeReferenceImages() {
  clearError();
  if (state.referenceAnalysis.files.length === 0) {
    setReferenceAnalysisFeedback("图形分析需要上传参考图。", "error");
    return;
  }

  const requestToken = referenceAnalysisRequestToken + 1;
  referenceAnalysisRequestToken = requestToken;
  referenceAnalysisAbortController?.abort();
  const requestController = new AbortController();
  referenceAnalysisAbortController = requestController;
  const analysisSnapshot = getReferenceAnalysisRequestSnapshot();
  state.referenceAnalysis.running = true;
  setReferenceAnalysisFeedback("正在分析参考图关系...", "busy");
  renderReferenceAnalysis();

  try {
    const formData = await buildReferenceAnalysisFormData();
    if (requestToken !== referenceAnalysisRequestToken || analysisSnapshot !== getReferenceAnalysisRequestSnapshot()) {
      return;
    }
    const response = await fetch("/api/prompt-agent/analyze", {
      method: "POST",
      signal: requestController.signal,
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));
    if (requestToken !== referenceAnalysisRequestToken || analysisSnapshot !== getReferenceAnalysisRequestSnapshot()) {
      return;
    }
    if (!response.ok) {
      throw new Error(payload.message || "参考图分析失败。");
    }

    state.referenceAnalysis.result = payload.item;
    state.referenceAnalysis.collapsed = false;
    state.referenceAnalysis.dirty = false;
    state.referenceAnalysis.previewKey = "";
    state.referenceAnalysis.selectedPrompt = "";
    state.promptAgent.history = [
      payload.item,
      ...state.promptAgent.history.filter((item) => item.id !== payload.item.id),
    ];
    const promptCount = getReferenceAnalysisPrompts(payload.item).length;
    setReferenceAnalysisFeedback(`已生成 ${promptCount || 1} 条编排提示词。`, "success");
  } catch (error) {
    if (requestToken !== referenceAnalysisRequestToken || analysisSnapshot !== getReferenceAnalysisRequestSnapshot()) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    setReferenceAnalysisFeedback(message, "error");
    showError(message);
  } finally {
    if (requestToken === referenceAnalysisRequestToken) {
      referenceAnalysisAbortController = null;
      state.referenceAnalysis.running = false;
      renderReferenceAnalysis();
    }
  }
}

function applyReferenceAnalysisPrompt(index) {
  const option = getReferenceAnalysisPrompts()[Number(index)];
  const promptText = String(option?.prompt || "").trim();
  if (!promptText) {
    setReferenceAnalysisFeedback("这条结果没有可应用的提示词。", "error");
    return;
  }

  state.referenceAnalysis.selectedPrompt = promptText;
  if (state.referenceAnalysis.autoCollapseOnApply) {
    state.referenceAnalysis.collapsed = true;
  }
  renderReferenceAnalysis();
  setReferenceAnalysisFeedback("已在融图分析中选用这条提示词。", "success");
  refs.referenceAnalysisSelectedPromptPanel.scrollIntoView({ block: "nearest" });
  refs.referenceAnalysisSelectedPrompt.focus();
}

async function startReferenceAnalysisGeneration() {
  clearError();
  const promptText = String(state.referenceAnalysis.selectedPrompt || "").trim();
  if (!promptText) {
    setReferenceAnalysisFeedback("请先选用一条融图分析提示词。", "error");
    return;
  }

  if (state.referenceAnalysis.files.length === 0) {
    setReferenceAnalysisFeedback("融图分析生成需要上传参考图。", "error");
    return;
  }

  await ensureReferenceAnalysisGenerationFilesReady();
  const job = createReferenceAnalysisJob();
  registerReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id));
  state.jobs.unshift(job);
  state.referenceAnalysis.previewKey = makeJobPreviewKey(job.id);
  state.selectedPreviewKey = makeJobPreviewKey(job.id);
  recordJobQueued(job);
  setReferenceAnalysisFeedback("已提交融图分析生成任务。", "success");
  renderAll();
  scheduleGenerationQueue();
}

async function copyReferenceAnalysisSelectedPrompt() {
  const promptText = String(state.referenceAnalysis.selectedPrompt || "").trim();
  if (!promptText) {
    setReferenceAnalysisFeedback("没有可复制的已选提示词。", "error");
    return;
  }

  await writeTextToClipboard(promptText, "当前浏览器不支持复制提示词。");
  setReferenceAnalysisFeedback("已复制融图分析提示词。", "success");
}

function mapPromptAgentPrompt(itemId) {
  const item = getPromptAgentItem(itemId);
  const promptText = getPromptAgentReusableText(item);
  if (!promptText) {
    setPromptAgentFeedback("这条记录没有可映射的反推结果。", "error");
    return;
  }

  refs.promptInput.value = promptText;
  updatePromptCounter();
  setPromptAgentFeedback("已映射到 Studio 提示词。", "success");
  setPromptAgentOpen(false, { restoreFocus: false });
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
  const nextJobs = selectNextQueuedGenerationJobsByMode(state.jobs, getMaxParallelJobCountForJob, getGenerationJobSchedulingKey);
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
  let finalImageDataUrl = "";
  let terminalEventReceived = false;
  let queuedForPolling = false;
  try {
    const response = await requestGenerationStream({
      job,
      clientSessionId: state.clientSessionId,
      buildGenerationFormData,
      updateJob: (patch) => updateJob(job.id, patch),
    });
    if (!response) {
      removeJob(job.id);
      renderAll();
      return;
    }

    await consumeSse(response.body, async (eventName, payload) => {
      if (eventName === GENERATION_STREAM_EVENTS.STATUS) {
        const statusText = buildGenerationTaskStatusText({ status: "running", statusStage: payload.stage, statusText: payload.message });
        // The upstream auto-retry re-POSTs a whole new generation. Seal the
        // attempt on screen so its image becomes its own card instead of being
        // silently overwritten by the new attempt's partials.
        if (payload.stage === "retrying_upstream" && isPromptDeckJob(job)) {
          startPromptAttemptRetry(state.promptAttemptDecks, {
            deckKey: makeJobPreviewKey(job.id),
            errorMessage: "上游未确认结果，已自动重试",
            updatedAt: nowIso(),
          });
        }
        updateJob(job.id, {
          statusStage: payload.stage,
          statusText,
        });
        handleActivityStatus(job.id, payload.stage, statusText);
        /* 一次切换等于一次心跳唤起：只有真的收到上游 heartbeat 才推进图标。
           这里按「事件到达」判断，因为 15 秒推来的文本每次完全一样，比文本变化可靠。 */
        if (hasHeartbeatPrefix(statusText)) {
          beatGenerationLoadingHeartbeat(previewLoadingShellNodes?.loading);
        }
        /* 心跳同样不进这三个反馈条：变形图标已经是回执，
           把每 15 秒重复的同一句话写进反馈条只会顶掉真正的阶段文本。 */
        const feedbackText = hasHeartbeatPrefix(statusText) ? "" : statusText;
        if (job.mode === "image-decomposition") {
          setImageDecompositionFeedback(feedbackText || "图片拆解生成中...", "busy");
        }
        if (job.mode === "image-edit") {
          setImageEditFeedback(feedbackText || "图片编辑生成中...", "busy");
        }
        if (job.mode === "quick-blend") {
          setQuickBlendFeedback(feedbackText || "快速溶图生成中...", "busy");
        }
        renderAll();
        return;
      }

      if (eventName === GENERATION_STREAM_EVENTS.PARTIAL_IMAGE) {
        recordPromptDeckImage(job, payload.dataUrl, PROMPT_ATTEMPT_KIND.PARTIAL);
        updateJob(job.id, {
          previewUrl: payload.dataUrl,
          statusText: "已收到中途预览",
        });
        handleActivityPartial(job.id);
        renderAll();
        return;
      }

      if (eventName === GENERATION_STREAM_EVENTS.FINAL_IMAGE) {
        finalImageDataUrl = isCacheableBrowserImageUrl(payload.dataUrl) ? payload.dataUrl : "";
        recordPromptDeckImage(job, payload.dataUrl, PROMPT_ATTEMPT_KIND.FINAL);
        updateJob(job.id, {
          previewUrl: payload.dataUrl,
          statusText: "已拿到最终图像，正在写入本地",
        });
        handleActivityFinal(job.id);
        renderAll();
        return;
      }

      if (eventName === GENERATION_STREAM_EVENTS.FINAL_IMAGE_CHUNK) {
        const dataUrl = recordFinalImageChunk(finalImageChunks, payload);
        if (dataUrl) {
          finalImageDataUrl = dataUrl;
          recordPromptDeckImage(job, dataUrl, PROMPT_ATTEMPT_KIND.FINAL);
        }
        updateJob(job.id, {
          previewUrl: dataUrl || job.previewUrl,
          statusText: dataUrl ? "最终图已接收，正在写入浏览器缓存" : "正在接收最终图数据",
        });
        if (dataUrl) {
          handleActivityFinal(job.id);
          await cacheBrowserGalleryItem({
            filename: payload.filename,
            imageUrl: dataUrl,
            thumbnailUrl: dataUrl,
          });
        }
        renderAll();
        return;
      }

      if (eventName === GENERATION_STREAM_EVENTS.SAVED) {
        terminalEventReceived = true;
        payload.item = attachChunkedImageToSavedItem(payload.item, finalImageChunks, finalImageDataUrl || job.previewUrl);
        if (payload.item) {
          if (job.mode === "reference-analysis") {
            payload.item.mode = "reference-analysis";
            storeReferenceAnalysisGenerationItem(payload.item);
            replaceReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id), makeGalleryPreviewKey(payload.item.filename));
            state.referenceAnalysis.previewKey = makeGalleryPreviewKey(payload.item.filename);
            setReferenceAnalysisFeedback("融图分析图片已生成。", "success");
          }
          if (job.mode === "image-decomposition") {
            payload.item.mode = "image-decomposition";
            storeImageDecompositionGenerationItem(payload.item);
            replaceImageDecompositionGenerationKey(makeJobPreviewKey(job.id), makeGalleryPreviewKey(payload.item.filename));
            state.imageDecomposition.previewKey = makeGalleryPreviewKey(payload.item.filename);
            setImageDecompositionFeedback("图片拆解信息图已生成。", "success");
          }
          if (job.mode === "image-edit") {
            payload.item.mode = "image-edit";
            storeImageEditGenerationItem(payload.item);
            replaceImageEditGenerationKey(makeJobPreviewKey(job.id), makeGalleryPreviewKey(payload.item.filename));
            state.imageEdit.previewKey = makeGalleryPreviewKey(payload.item.filename);
            setImageEditFeedback("图片编辑结果已生成。", "success");
          }
          if (job.mode === "quick-blend") {
            payload.item.mode = "quick-blend";
            storeQuickBlendGenerationItem(payload.item);
            replaceQuickBlendGenerationKey(makeJobPreviewKey(job.id), makeGalleryPreviewKey(payload.item.filename));
            state.quickBlend.previewKey = makeGalleryPreviewKey(payload.item.filename);
            setQuickBlendFeedback("快速溶图已生成。", "success");
          }
          upsertGalleryItem(payload.item);
          recordPromptFilmstripSessionResult(job, payload.item);
          // Re-key job: -> file: so the gallery thumbnail keeps earlier failed
          // attempts reachable once the job leaves state.jobs.
          if (isPromptDeckJob(job)) {
            const deckKey = makeJobPreviewKey(job.id);
            completePromptAttemptDeck(state.promptAttemptDecks, {
              deckKey,
              previewUrl: finalImageDataUrl || job.previewUrl || getImageUrl(payload.item),
              updatedAt: nowIso(),
            });
            const galleryKey = makeGalleryPreviewKey(payload.item.filename);
            rekeyPromptAttemptDeck(state.promptAttemptDecks, { fromKey: deckKey, toKey: galleryKey, updatedAt: nowIso() });
            if (state.expandedPromptDeckKey === deckKey) {
              state.expandedPromptDeckKey = galleryKey;
            }
            // A single completed card carries no history worth expanding.
            if (getPromptAttemptCards(state.promptAttemptDecks, galleryKey).length < 2) {
              removePromptAttemptDeck(state.promptAttemptDecks, galleryKey);
              if (state.expandedPromptDeckKey === galleryKey) {
                state.expandedPromptDeckKey = "";
              }
            }
          }
          state.selectedPreviewKey = makeGalleryPreviewKey(payload.item.filename);
        }
        handleActivitySuccess(job.id, payload.item);
        removeJob(job.id);
        renderAll();
        return;
      }

      if (eventName === GENERATION_STREAM_EVENTS.SERVER_IMAGE) {
        applyServerImageToGalleryItem(payload.item);
        renderAll();
        return;
      }

      if (eventName === GENERATION_STREAM_EVENTS.QUEUED) {
        queuedForPolling = true;
        const task = payload.task || {};
        const statusText = buildGenerationTaskStatusText({ status: "running", statusStage: task.statusStage || "queued", statusText: task.statusText || "已提交到服务器队列，等待后台生成" });
        updateJob(job.id, {
          status: "running",
          statusStage: task.statusStage || "queued",
          statusText,
        });
        handleActivityStatus(job.id, "queued", statusText);
        if (job.mode === "quick-blend") {
          setQuickBlendFeedback(statusText || "快速溶图已提交到后台队列。", "busy");
        }
        if (job.mode === "image-edit") {
          setImageEditFeedback(statusText || "图片编辑已提交到后台队列。", "busy");
        }
        scheduleGenerationTaskPolling();
        renderAll();
        return;
      }

      if (eventName === GENERATION_STREAM_EVENTS.ERROR) {
        terminalEventReceived = true;
        const message = compactErrorMessage(payload.message, "生成请求失败");
        sealPromptDeckOnFailure(job, message);
        handleActivityFailure(job, message, getPromptDeckLastPreviewUrl(job));
        showError(message);
        if (job.mode === "reference-analysis") {
          removeReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id));
        }
        if (job.mode === "image-decomposition") {
          removeImageDecompositionGenerationKey(makeJobPreviewKey(job.id));
          setImageDecompositionFeedback(message, "error");
        }
        if (job.mode === "image-edit") {
          removeImageEditGenerationKey(makeJobPreviewKey(job.id));
          setImageEditFeedback(message, "error");
        }
        if (job.mode === "quick-blend") {
          removeQuickBlendGenerationKey(makeJobPreviewKey(job.id));
          setQuickBlendFeedback(message, "error");
        }
        removeJob(job.id);
        renderAll();
      }
    });
    if (!terminalEventReceived && !queuedForPolling) {
      const message = "生成连接已中断，未收到完成事件。请稍后重试，或降低分辨率。";
      sealPromptDeckOnFailure(job, message);
      handleActivityFailure(job, message, getPromptDeckLastPreviewUrl(job));
      showError(message);
      if (job.mode === "reference-analysis") {
        removeReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id));
      }
      if (job.mode === "image-decomposition") {
        removeImageDecompositionGenerationKey(makeJobPreviewKey(job.id));
        setImageDecompositionFeedback(message, "error");
      }
      if (job.mode === "image-edit") {
        removeImageEditGenerationKey(makeJobPreviewKey(job.id));
        setImageEditFeedback(message, "error");
      }
      if (job.mode === "quick-blend") {
        removeQuickBlendGenerationKey(makeJobPreviewKey(job.id));
        setQuickBlendFeedback(message, "error");
      }
      removeJob(job.id);
      renderAll();
    }
  } catch (error) {
    if (terminalEventReceived) {
      return;
    }
    const message = error instanceof Error ? error.message : String(error);
    sealPromptDeckOnFailure(job, message);
    handleActivityFailure(job, message, getPromptDeckLastPreviewUrl(job));
    showError(message);
    if (job.mode === "reference-analysis") {
      removeReferenceAnalysisGenerationKey(makeJobPreviewKey(job.id));
    }
    if (job.mode === "image-decomposition") {
      removeImageDecompositionGenerationKey(makeJobPreviewKey(job.id));
      setImageDecompositionFeedback(message, "error");
    }
    if (job.mode === "image-edit") {
      removeImageEditGenerationKey(makeJobPreviewKey(job.id));
      setImageEditFeedback(message, "error");
    }
    if (job.mode === "quick-blend") {
      removeQuickBlendGenerationKey(makeJobPreviewKey(job.id));
      setQuickBlendFeedback(message, "error");
    }
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

async function startGeneration(event) {
  event.preventDefault();
  clearError();

  if (state.studioMode === "style-transfer") {
    const hasPresetStyle = hasSelectedStyleTransferPreset();
    if (!state.styleTransfer.source?.file || (!hasPresetStyle && !state.styleTransfer.style?.file)) {
      showError(hasPresetStyle ? "请先上传原图。" : "请先上传原图和风格参考图。");
      return;
    }

    try {
      await ensureStyleTransferGenerationFilesReady();
      await ensureStyleTransferPresetReferenceFileReady();
    } catch (error) {
      showError(compactErrorMessage(error instanceof Error ? error.message : String(error), "预设风格图准备失败"));
      return;
    }
    const job = createStyleTransferJob();
    state.jobs.unshift(job);
    state.selectedPreviewKey = makeJobPreviewKey(job.id);
    recordJobQueued(job);
    renderAll();
    setActiveView("style-transfer");

    scheduleGenerationQueue();
    return;
  }

  const prompt = refs.promptInput.value.trim();
  if (!prompt) {
    showError("提示词不能为空。");
    refs.promptInput.focus();
    return;
  }

  if (hasReachedGenerationQueueLimit("prompt", getCurrentGenerationQueueRoute())) {
    showError(`提示词模式最多保留 ${MAX_PROMPT_QUEUE_SIZE} 个任务（含生成中和排队中），请等待已有任务完成后再提交。`);
    return;
  }

  await ensureReferenceGenerationFilesReady();

  const job = createJob();
  registerPromptFilmstripSessionJob(job); state.jobs.unshift(job);
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

function isTopbarRevealLayout() {
  return true;
}

function isTopbarRevealSuppressed() {
  return document.documentElement.classList.contains(TOPBAR_SUPPRESSED_CLASS);
}

function hasOpenGlobalNavItem() {
  return refs.globalNavItems.some((item) => item.classList.contains("is-nav-open"));
}

function setTopbarReveal(open) {
  const shouldOpen = Boolean(open) && isTopbarRevealLayout() && !isTopbarRevealSuppressed();
  document.documentElement.classList.toggle(TOPBAR_REVEAL_CLASS, shouldOpen);
  refs.topbarRevealButton?.setAttribute("aria-expanded", String(shouldOpen));
  if (refs.topbarRevealButton) {
    const label = shouldOpen ? "收起顶部导航" : "展开顶部导航";
    refs.topbarRevealButton.setAttribute("aria-label", label);
    refs.topbarRevealButton.title = label;
  }
}

function syncTopbarRevealFromPointer(event) {
  if (!refs.topbar || !isTopbarRevealLayout()) {
    setTopbarReveal(false);
    return;
  }

  const target = event.target instanceof Element ? event.target : null;
  if (target?.closest(".topbar-reveal-button")) return;
  const isInTopbar = Boolean(target?.closest(".topbar"));
  setTopbarReveal(isInTopbar || event.clientY <= TOPBAR_REVEAL_EDGE_PX || hasOpenGlobalNavItem());
}

function bindTopbarRevealEvents() {
  refs.topbarRevealButton?.addEventListener("pointerdown", (event) => event.stopPropagation());
  refs.topbarRevealButton?.addEventListener("click", (event) => {
    event.stopPropagation();
    setTopbarReveal(!document.documentElement.classList.contains(TOPBAR_REVEAL_CLASS));
  });
  document.addEventListener("pointermove", syncTopbarRevealFromPointer, { passive: true });
  document.addEventListener("pointerdown", syncTopbarRevealFromPointer, { passive: true });
  document.addEventListener("focusin", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest(".topbar")) {
      setTopbarReveal(true);
    }
  });
  document.addEventListener("focusout", () => {
    window.setTimeout(() => {
      const focusInRevealButton = refs.topbarRevealButton?.contains(document.activeElement);
      if (!refs.topbar?.contains(document.activeElement) && !focusInRevealButton && !hasOpenGlobalNavItem()) {
        setTopbarReveal(false);
      }
    }, 0);
  });
}

function closeGlobalNavIfOutsideTopbar() {
  window.setTimeout(() => {
    if (refs.topbar?.matches(":hover") || refs.topbar?.contains(document.activeElement)) {
      return;
    }

    setActiveGlobalNavItem(null);
  }, 0);
}

function setActiveGlobalNavItem(item) {
  refs.globalNavItems.forEach((navItem) => {
    const isOpen = navItem === item;
    navItem.classList.toggle("is-nav-open", isOpen);

    const button = navItem.querySelector("[data-nav-menu]");
    if (button) {
      button.setAttribute("aria-expanded", String(isOpen));
    }

    const flyout = navItem.querySelector(".nav-flyout");
    if (flyout) {
      flyout.setAttribute("aria-hidden", String(!isOpen));
    }
  });

  setTopbarReveal(Boolean(item));
}

function bindGlobalNavEvents() {
  refs.globalNavItems.forEach((item) => {
    const button = item.querySelector("[data-nav-menu]");
    if (!button) {
      return;
    }

    button.addEventListener("pointerenter", () => setActiveGlobalNavItem(item));
    button.addEventListener("mouseenter", () => setActiveGlobalNavItem(item));
    button.addEventListener("focus", () => setActiveGlobalNavItem(item));
    button.addEventListener("click", (event) => {
      event.preventDefault();
      event.stopPropagation();
      setActiveGlobalNavItem(item);
    });
  });

  refs.globalNav?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (target && target.closest("a[href^='#']")) {
      setActiveGlobalNavItem(null);
      return;
    }
    event.stopPropagation();
  });

  document.addEventListener("click", (event) => {
    if (event.target instanceof Element && event.target.closest(".global-nav")) {
      return;
    }

    setActiveGlobalNavItem(null);
  });
  refs.topbar?.addEventListener("pointerleave", closeGlobalNavIfOutsideTopbar);
  refs.topbar?.addEventListener("focusout", closeGlobalNavIfOutsideTopbar);

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

  if (action === "activity-log") {
    openConfigGenerationLog();
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

function bindStyleTransferDropzone(dropzone, slot) {
  dropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    dropzone.classList.add("dragover");
  });
  dropzone.addEventListener("dragleave", () => {
    dropzone.classList.remove("dragover");
  });
  dropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    dropzone.classList.remove("dragover");
    applyStyleTransferReferenceFile(slot, event.dataTransfer?.files);
  });
}

function getClipboardImageFiles(clipboardData) {
  const itemFiles = [...(clipboardData?.items || [])]
    .filter((item) => item.kind === "file" && item.type.startsWith("image/"))
    .map((item) => item.getAsFile())
    .filter(Boolean);
  if (itemFiles.length > 0) {
    return itemFiles;
  }

  return [...(clipboardData?.files || [])].filter((file) => file.type.startsWith("image/"));
} function isPromptAgentModalOpen() { return !refs.promptAgentModal.classList.contains("hidden"); } function handlePromptAgentImagePaste(event) { if (!isPromptAgentModalOpen() || event.defaultPrevented) { return; } const imageFiles = getClipboardImageFiles(event.clipboardData); if (imageFiles.length === 0) { return; } event.preventDefault(); applyPromptAgentFile(imageFiles); }
function handleStudioImagePaste(event) {
  const imageFiles = getClipboardImageFiles(event.clipboardData);
  if (imageFiles.length === 0) {
    return;
  }

  event.preventDefault();
  if (state.studioMode === "style-transfer") {
    applyStyleTransferReferenceFile("source", imageFiles);
    return;
  }

  applyReferenceFiles(imageFiles);
}

function handleCreationReferenceImagePaste(event) { if (event.defaultPrevented || state.activeView !== "creation" || isCreationLogoBatchBranch()) return; const imageFiles = getClipboardImageFiles(event.clipboardData); if (imageFiles.length === 0) return; event.preventDefault(); applyCreationReferenceFiles(imageFiles); }

function setCreationPlatformItemOverride(slotKey, field, value) {
  const overrides = updateCreationPlatformItemOverride(
    getFrozenCreationPlatformPayload().values.platformItemOverrides,
    slotKey,
    field,
    value,
  );
  setFrozenCreationPlatformPayload({ ...getFrozenCreationEffectivePlan(), platformItemOverrides: overrides });
}

function bindEvents() {
  creationLogoLibrary.bind();
  productImageImportController.bind();
  bindGlobalNavEvents();
  bindTopbarRevealEvents();
  bindAdaptiveWorkbenchSections();
  bindAppTooltips();
  assetWorkspaceController.bindEvents();
  assetRecordDeleteController.bindEvents();
  assetRecordTimeFilterController.bind();
  creationCardIdleRippleController.bind();
  disabledShakeController.bind();
  document.addEventListener("paste", handlePromptAgentImagePaste); document.addEventListener("paste", handleCreationReferenceImagePaste);

  refs.viewTabs.forEach((button) => {
    button.addEventListener("click", () => {
      setActiveView(button.dataset.viewTab);
    });
  });

  document.querySelectorAll("[data-nav-action]").forEach((button) => {
    button.addEventListener("click", () => {
      handleGlobalNavAction(button.dataset.navAction);
      setActiveGlobalNavItem(null);
    });
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
  refs.uiLanguageOptions.forEach((button) => {
    button.addEventListener("click", () => setUiLanguage(button.dataset.uiLanguageOption));
  });
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
  // Clamp in place on commit so an out-of-range delay never fails native form
  // validation and blocks saving the rest of the configuration.
  refs.generationStartDelayInput?.addEventListener("change", () => {
    refs.generationStartDelayInput.value = String(
      normalizeGenerationStartDelayMs(refs.generationStartDelayInput.value, DEFAULT_GENERATION_START_DELAY_MS),
    );
  });
  refs.generationConcurrencyInput?.addEventListener("change", () => {
    refs.generationConcurrencyInput.value = String(
      normalizeGenerationConcurrency(refs.generationConcurrencyInput.value, DEFAULT_GENERATION_CONCURRENCY),
    );
  });
  refs.imageRouteInputs.forEach((input) => input.addEventListener("change", () => {
    updateGenerationModeStatus();
    syncEndpointFieldsFromFullUrlModes();
    syncProtocolEndpointPreview();
    renderSizeOptions();
    renderReferenceAnalysisSizeOptions();
    renderImageDecompositionSizeOptions();
    renderCreationSizeOptions();
    renderPortraitSizeOptions();
  }));
  refs.protocolBaseUrlInput?.addEventListener("input", syncProtocolEndpointPreview);
  refs.protocolImageModelInput?.addEventListener("input", syncProtocolEndpointPreview);
  refs.baseUrlFullToggle?.addEventListener("click", () => toggleEndpointFullUrlMode("a"));
  refs.directBaseUrlFullToggle?.addEventListener("click", () => toggleEndpointFullUrlMode("b"));
  refs.directTextBaseUrlFullToggle?.addEventListener("click", () => toggleEndpointFullUrlMode("b-text"));
  refs.endpointPathSelect?.addEventListener("change", () => {
    const endpoint = readEndpointFields("a");
    syncEndpointInputDisplay("a", endpoint.baseUrl, refs.endpointPathSelect.value || endpoint.endpointPath);
  });
  refs.directEndpointPathSelect?.addEventListener("change", () => {
    const endpoint = readEndpointFields("b");
    syncEndpointInputDisplay("b", endpoint.baseUrl, refs.directEndpointPathSelect.value || endpoint.endpointPath);
  });
  refs.directTextEndpointPathSelect?.addEventListener("change", () => {
    const endpoint = readEndpointFields("b-text");
    syncEndpointInputDisplay("b-text", endpoint.baseUrl, refs.directTextEndpointPathSelect.value || endpoint.endpointPath);
  });
  configModelPicker.bindEvents();
  refs.generateForm.addEventListener("submit", startGeneration);
  refs.articleIllustrationPlanButton.addEventListener("click", () => {
    previewArticleIllustrationPlan().catch((error) => setArticleIllustrationFeedback(error.message, "error"));
  });
  refs.articleIllustrationReferenceButton.addEventListener("click", () => {
    generateArticleIllustrations({ referenceOnly: true }).catch((error) =>
      setArticleIllustrationFeedback(error.message, "error"),
    );
  });
  refs.articleIllustrationGenerateButton.addEventListener("click", () => {
    generateArticleIllustrations().catch((error) => setArticleIllustrationFeedback(error.message, "error"));
  });
  refs.articleIllustrationSourceFilesInput.addEventListener("change", (event) => {
    applyArticleIllustrationFiles(event.target.files);
  });
  refs.articleIllustrationDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.articleIllustrationDropzone.classList.add("dragover");
  });
  refs.articleIllustrationDropzone.addEventListener("dragleave", () => {
    refs.articleIllustrationDropzone.classList.remove("dragover");
  });
  refs.articleIllustrationDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.articleIllustrationDropzone.classList.remove("dragover");
    applyArticleIllustrationFiles(event.dataTransfer?.files);
  });
  function handleArticleIllustrationCardClick(event) {
    const previewButton = event.target.closest("[data-article-preview-item-id]");
    if (previewButton) {
      openArticleIllustrationItemPreview(previewButton.dataset.articlePreviewItemId);
      return;
    }

    const retryButton = event.target.closest("[data-article-retry-item-id]");
    if (retryButton) {
      generateArticleIllustrations({
        itemIds: [retryButton.dataset.articleRetryItemId],
        regenerate: true,
      }).catch((error) => setArticleIllustrationFeedback(error.message, "error"));
      return;
    }

    const copyPromptButton = event.target.closest("[data-article-copy-prompt-item-id]");
    if (copyPromptButton) {
      const currentSet = syncArticlePlanEditsFromDom();
      const item = currentSet?.items?.find((entry) => entry.itemId === copyPromptButton.dataset.articleCopyPromptItemId);
      writeTextToClipboard(item?.prompt || "", "当前浏览器不支持复制文章插图提示词。").catch((error) =>
        setArticleIllustrationFeedback(error.message, "error"),
      );
      return;
    }

    const copyCaptionButton = event.target.closest("[data-article-copy-caption-item-id]");
    if (copyCaptionButton) {
      const currentSet = syncArticlePlanEditsFromDom();
      const item = currentSet?.items?.find((entry) => entry.itemId === copyCaptionButton.dataset.articleCopyCaptionItemId);
      writeTextToClipboard(item?.captionText || item?.originalText || "", "当前浏览器不支持复制文章题注。").catch((error) =>
        setArticleIllustrationFeedback(error.message, "error"),
      );
    }
  }
  refs.articleIllustrationReferenceList.addEventListener("click", handleArticleIllustrationCardClick);
  refs.articleIllustrationStoryboardList.addEventListener("click", handleArticleIllustrationCardClick);
  refs.articleRecordRefreshButton.addEventListener("click", () => {
    loadArticleIllustrationSets().catch((error) => setArticleRecordFeedback(error.message, "error"));
  });
  refs.articleRecordDeleteCurrentButton.addEventListener("click", () => requestAssetRecordDelete("article", "current"));
  refs.articleRecordDeleteSelectedButton.addEventListener("click", () => requestAssetRecordDelete("article", "selected"));
  refs.articleRecordColumnButtons.forEach((button) => {
    button.addEventListener("click", () => {
      const columnPreset = normalizeArticleRecordColumnPreset(button.dataset.articleRecordColumnPreset);
      if (columnPreset === state.articleIllustration.recordColumnPreset) {
        return;
      }
      state.articleIllustration.recordColumnPreset = columnPreset;
      renderArticleRecordView();
    });
  });
  refs.articleIllustrationSourceTextInput.addEventListener("input", updateArticleSourceLength);
  refs.articleRecordList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-article-record-set-id]");
    if (!target) {
      return;
    }
    state.articleIllustration.recordSetId = target.dataset.articleRecordSetId;
    renderArticleRecordView();
  });
  refs.articleRecordList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-article-record-select-set-id]");
    if (!checkbox) return;
    state.articleIllustration.recordCheckedSetIds = updateCheckedRecordIds(
      state.articleIllustration.recordCheckedSetIds,
      checkbox.dataset.articleRecordSelectSetId,
      checkbox.checked,
    );
    renderArticleRecordView();
  });
  refs.articleRecordDetail.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-article-record-preview-item-id]");
    if (previewButton) {
      openArticleRecordItemPreview(
        previewButton.dataset.articleRecordPreviewItemId,
        previewButton.dataset.articleRecordPreviewSetId,
      );
      return;
    }

    const retryButton = event.target.closest("[data-article-retry-item-id]");
    if (retryButton) {
      const selectedSet = getArticleRecordSelectedSet();
      if (selectedSet) {
        state.articleIllustration.currentSet = normalizeArticleSetForView(selectedSet);
        setActiveView("article-illustration");
        generateArticleIllustrations({
          itemIds: [retryButton.dataset.articleRetryItemId],
          regenerate: true,
        }).catch((error) => setArticleIllustrationFeedback(error.message, "error"));
      }
      return;
    }

    const copyPromptButton = event.target.closest("[data-article-copy-prompt-item-id]");
    if (copyPromptButton) {
      const selectedSet = getArticleRecordSelectedSet();
      const item = selectedSet?.items?.find((entry) => entry.itemId === copyPromptButton.dataset.articleCopyPromptItemId);
      writeTextToClipboard(item?.prompt || "", "当前浏览器不支持复制文章插图提示词。").catch((error) =>
        setArticleRecordFeedback(error.message, "error"),
      );
      return;
    }

    const copyCaptionButton = event.target.closest("[data-article-copy-caption-item-id]");
    if (copyCaptionButton) {
      const selectedSet = getArticleRecordSelectedSet();
      const item = selectedSet?.items?.find((entry) => entry.itemId === copyCaptionButton.dataset.articleCopyCaptionItemId);
      writeTextToClipboard(item?.captionText || item?.originalText || "", "当前浏览器不支持复制文章题注。").catch((error) =>
        setArticleRecordFeedback(error.message, "error"),
      );
    }
  });
  refs.articleRecordCopyPromptsButton.addEventListener("click", () => {
    writeTextToClipboard(buildArticlePromptText(), "当前浏览器不支持复制文章插图提示词。").catch((error) =>
      setArticleRecordFeedback(error.message, "error"),
    );
  });
  refs.articleRecordCopyCaptionsButton.addEventListener("click", () => {
    writeTextToClipboard(buildArticleCaptionText(), "当前浏览器不支持复制文章题注。").catch((error) =>
      setArticleRecordFeedback(error.message, "error"),
    );
  });
  refs.articleRecordContinueButton.addEventListener("click", () => {
    const selectedSet = getArticleRecordSelectedSet();
    const failedIds = selectedSet?.items?.filter((item) => item.status === "failed").map((item) => item.itemId) || [];
    if (selectedSet && failedIds.length > 0) {
      state.articleIllustration.currentSet = normalizeArticleSetForView(selectedSet);
      setActiveView("article-illustration");
      generateArticleIllustrations({ itemIds: failedIds }).catch((error) =>
        setArticleIllustrationFeedback(error.message, "error"),
      );
    }
  });
  refs.creationForm.addEventListener("submit", startCreationGeneration);
  refs.creationPlanButton.addEventListener("click", () => {
    requestCreationPlanPreview().catch((error) => setCreationFeedback(error.message, "error"));
  });
  refs.creationPlanRestoreButton?.addEventListener("click", () => {
    restoreCurrentCreationPlatformRecommendations().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setCreationFeedback(message, "error");
      showError(message);
    });
  });
  refs.creationQueueStrip.addEventListener("click", (event) => {
    const button = event.target.closest("[data-creation-queue-id]");
    if (button) {
      selectCreationQueueJob(button.dataset.creationQueueId);
    }
  });
  refs.creationRepairFailedButton.addEventListener("click", () => {
    repairCreationItems({ scope: "incomplete" }).catch((error) => setCreationFeedback(error.message, "error"));
  });
  refs.creationRecordRefreshButton.addEventListener("click", refreshCreationRecordSets);
  refs.creationRecordRefreshMenuButton?.addEventListener("click", refreshCreationRecordSets);
  refs.creationRecordDeleteCurrentButton.addEventListener("click", () => requestCreationRecordDelete("current"));
  refs.creationRecordDeleteCurrentMenuButton?.addEventListener("click", () => requestCreationRecordDelete("current"));
  refs.creationRecordDeleteSelectedButton.addEventListener("click", () => requestCreationRecordDelete("selected"));
  refs.creationRecordDeleteSelectedMenuButton?.addEventListener("click", () => requestCreationRecordDelete("selected"));
  refs.creationRecordDeleteFilteredButton.addEventListener("click", () => requestCreationRecordDelete("filtered"));
  refs.creationRecordDeleteFilteredMenuButton?.addEventListener("click", () => requestCreationRecordDelete("filtered"));
  refs.creationRecordDeleteForm.addEventListener("submit", (event) => {
    event.preventDefault();
    confirmCreationRecordDelete().catch((error) => setCreationRecordFeedback(error.message, "error"));
  });
  refs.creationRecordDeleteCancelButton.addEventListener("click", () => closeCreationRecordDeleteDialog());
  refs.creationRecordDeleteDialog.addEventListener("cancel", (event) => {
    if (state.creation.recordDeleteBusy) event.preventDefault();
  });
  refs.creationRecordDeleteDialog.addEventListener("click", (event) => {
    if (event.target === refs.creationRecordDeleteDialog) closeCreationRecordDeleteDialog();
  });
  refs.creationRecordDeleteDialog.addEventListener("close", () => {
    state.creation.recordDeleteRequest = null;
    refs.creationRecordDeleteConfirmButton.disabled = false;
    refs.creationRecordDeleteCancelButton.disabled = false;
    refs.creationRecordDeleteConfirmButton.textContent = "确认删除";
    const restoreTarget = creationRecordDeleteRestoreFocus;
    creationRecordDeleteRestoreFocus = null;
    window.setTimeout(() => {
      if (restoreTarget?.isConnected && !restoreTarget.disabled) restoreTarget.focus();
      else refs.creationRecordSearchInput?.focus();
    }, 0);
  });
  refs.creationRecordReuseButton.addEventListener("click", reuseCreationRecordSet);
  refs.creationRecordOpenFolderButton.addEventListener("click", () => {
    openCreationRecordFolder().catch((error) => setCreationRecordFeedback(error.message, "error"));
  });
  refs.creationRecordCopyFullPathsButton.addEventListener("click", () => {
    copyCreationRecordFullPaths().catch((error) => setCreationRecordFeedback(error.message, "error"));
  });
  refs.creationRecordRepairIncompleteButton.addEventListener("click", () => { repairCreationRecordIncompleteImages().catch((error) => setCreationRecordFeedback(error.message, "error")); });
  refs.creationRecordRepairIncompleteMenuButton?.addEventListener("click", () => { repairCreationRecordIncompleteImages().catch((error) => setCreationRecordFeedback(error.message, "error")); });
  refs.creationRecordCopyPromptsButton.addEventListener("click", () => {
    copyCreationRecordPrompts().catch((error) => setCreationRecordFeedback(error.message, "error"));
  });
  refs.creationRecordExportPromptsButton.addEventListener("click", exportCreationRecordPrompts);
  refs.creationRecordExportManifestButton.addEventListener("click", exportCreationRecordManifest);
  creationListingController.bindEvents();
  refs.creationRecordArchiveDetail.addEventListener("click", (event) => { const detailToggle = event.target.closest("[data-creation-record-detail-toggle]"); if (detailToggle) toggleCreationRecordArchiveDetail(); });
  refs.creationRecordSearchInput.addEventListener("input", (event) => {
    state.creation.recordQuery = event.target.value;
    state.creation.recordDetailExpanded = false;
    state.creation.recordListScrollTop = 0;
    refs.creationRecordSetList.scrollTop = 0;
    renderCreationRecordView();
  });
  refs.creationRecordDateInput.addEventListener("input", (event) => {
    state.creation.recordDateFilter = normalizeCreationRecordDateFilter(event.target.value);
    if (state.creation.recordDateFilter) state.creation.recordTimeFilter = "all";
    state.creation.recordDetailExpanded = false;
    state.creation.recordListScrollTop = 0;
    refs.creationRecordSetList.scrollTop = 0;
    renderCreationRecordView();
  });
  refs.creationRecordResetFiltersButton.addEventListener("click", () => {
    state.creation.recordQuery = "";
    state.creation.recordTimeFilter = "all";
    state.creation.recordDateFilter = "";
    state.creation.recordDetailExpanded = false;
    state.creation.recordListScrollTop = 0;
    refs.creationRecordSetList.scrollTop = 0;
    setCreationRecordFeedback("");
    renderCreationRecordView();
    refs.creationRecordSearchInput.focus();
  });
  refs.creationRecordSetList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-creation-record-set-id]");
    if (!target) {
      return;
    }

    selectCreationRecord(target.dataset.creationRecordSetId);
    assetWorkspaceController.closeRecordPickers();
  });
  refs.creationRecordSetList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-creation-record-select-set-id]");
    if (!checkbox) return;
    const selectedIds = new Set(state.creation.recordCheckedSetIds);
    if (checkbox.checked) selectedIds.add(checkbox.dataset.creationRecordSelectSetId);
    else selectedIds.delete(checkbox.dataset.creationRecordSelectSetId);
    state.creation.recordCheckedSetIds = [...selectedIds];
    const scrollTop = refs.creationRecordSetList.scrollTop;
    const scrollLeft = refs.creationRecordSetList.scrollLeft;
    renderCreationRecordView();
    refs.creationRecordSetList.scrollTop = scrollTop;
    refs.creationRecordSetList.scrollLeft = scrollLeft;
  });
  refs.creationRecordLoadMoreButton?.addEventListener("click", () => {
    const filterSignature = getCreationRecordListFilterSignature();
    state.creation.recordListState = loadMoreCreationRecordListState(state.creation.recordListState, filterSignature);
    renderCreationRecordView();
  });
  refs.creationRecordResultGrid.addEventListener("click", (event) => {
    const previewTarget = event.target.closest("[data-creation-record-preview-item-id]");
    if (previewTarget) {
      openCreationRecordItemPreview(
        previewTarget.dataset.creationRecordPreviewItemId,
        previewTarget.dataset.creationRecordPreviewSetId,
      );
      return;
    }
  });
  refs.portraitForm.addEventListener("submit", startPortraitGeneration);
  refs.portraitPlanButton.addEventListener("click", () => {
    previewPortraitPlan().catch((error) => setPortraitFeedback(error.message, "error"));
  });
  refs.portraitReferenceAnalyzeButton.addEventListener("click", () => {
    portraitReferenceAnalysis.analyze().catch((error) => portraitReferenceAnalysis.setFeedback(error.message, "error"));
  });
  refs.portraitReferenceApplyAnalysisButton.addEventListener("click", portraitReferenceAnalysis.apply);
  refs.portraitRepairFailedButton.addEventListener("click", () => {
    repairPortraitItems({ scope: "failed" }).catch((error) => setPortraitFeedback(error.message, "error"));
  });
  refs.portraitResultGrid.addEventListener("click", (event) => {
    const retryButton = event.target.closest("[data-portrait-retry-item-id]");
    if (!retryButton) return;
    repairPortraitItems({ itemId: retryButton.dataset.portraitRetryItemId }).catch((error) => setPortraitFeedback(error.message, "error"));
  });
  refs.portraitReferenceInput.addEventListener("change", (event) => {
    applyPortraitReferenceFiles(event.target.files);
  });
  refs.portraitActionReferenceInput.addEventListener("change", (event) => {
    applyPortraitActionReferenceFiles(event.target.files);
  });
  refs.portraitAccessoryReferenceInput.addEventListener("change", (event) => {
    applyPortraitAccessoryReferenceFiles(event.target.files);
  });
  refs.portraitReferenceDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.portraitReferenceDropzone.classList.add("dragover");
  });
  refs.portraitReferenceDropzone.addEventListener("dragleave", () => {
    refs.portraitReferenceDropzone.classList.remove("dragover");
  });
  refs.portraitReferenceDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.portraitReferenceDropzone.classList.remove("dragover");
    applyPortraitReferenceFiles(event.dataTransfer?.files);
  });
  refs.portraitActionReferenceDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.portraitActionReferenceDropzone.classList.add("dragover");
  });
  refs.portraitActionReferenceDropzone.addEventListener("dragleave", () => {
    refs.portraitActionReferenceDropzone.classList.remove("dragover");
  });
  refs.portraitActionReferenceDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.portraitActionReferenceDropzone.classList.remove("dragover");
    applyPortraitActionReferenceFiles(event.dataTransfer?.files);
  });
  refs.portraitAccessoryReferenceDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.portraitAccessoryReferenceDropzone.classList.add("dragover");
  });
  refs.portraitAccessoryReferenceDropzone.addEventListener("dragleave", () => {
    refs.portraitAccessoryReferenceDropzone.classList.remove("dragover");
  });
  refs.portraitAccessoryReferenceDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.portraitAccessoryReferenceDropzone.classList.remove("dragover");
    applyPortraitAccessoryReferenceFiles(event.dataTransfer?.files);
  });
  refs.portraitReferenceGrid.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-portrait-reference-remove-id]");
    if (removeButton) {
      removePortraitReferenceFile(removeButton.dataset.portraitReferenceRemoveId);
    }
  });
  refs.portraitActionReferenceGrid.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-portrait-action-reference-remove-id]");
    if (removeButton) {
      removePortraitActionReferenceFile(removeButton.dataset.portraitActionReferenceRemoveId);
    }
  });
  refs.portraitAccessoryReferenceGrid.addEventListener("click", (event) => {
    const removeButton = event.target.closest("[data-portrait-accessory-reference-remove-id]");
    if (removeButton) {
      removePortraitAccessoryReferenceFile(removeButton.dataset.portraitAccessoryReferenceRemoveId);
    }
  });
  refs.portraitAccessoryAssetButton?.addEventListener("click", () => {
    const isOpen =
      refs.portraitAccessoryAssetPopover &&
      !refs.portraitAccessoryAssetPopover.classList.contains("hidden");
    setPortraitAccessoryAssetPopoverOpen(!isOpen);
  });
  refs.portraitAccessoryAssetCloseButton?.addEventListener("click", () => {
    setPortraitAccessoryAssetPopoverOpen(false);
  });
  refs.portraitAccessoryAssetTabs?.addEventListener("click", (event) => {
    const target = event.target instanceof Element ? event.target.closest("[data-portrait-accessory-asset-category]") : null;
    if (!target) return;
    state.portrait.accessoryAssetCategory = target.dataset.portraitAccessoryAssetCategory;
    renderPortraitAccessoryAssetLibrary();
  });
  refs.portraitAccessoryAssetList?.addEventListener("click", (event) => {
    const colorTarget = event.target instanceof Element ? event.target.closest("[data-portrait-accessory-color-id]") : null;
    if (colorTarget) {
      const assetId = colorTarget.dataset.portraitAccessoryAssetId || "";
      state.portrait.accessoryAssetColors[assetId] = colorTarget.dataset.portraitAccessoryColorId || "";
      renderPortraitAccessoryAssetLibrary();
      return;
    }
    const target = event.target instanceof Element ? event.target.closest("[data-portrait-accessory-asset-id]") : null;
    if (!target) return;
    addPortraitAccessoryAssetReference(target.dataset.portraitAccessoryAssetId);
  });
  refs.portraitImageCountInput.addEventListener("input", () => {
    clampPortraitImageCount();
    renderPortraitView();
  });
  refs.portraitImageCountInput.addEventListener("change", () => {
    clampPortraitImageCount();
    renderPortraitView();
  });
  refs.portraitStyleInputs.forEach((input) => {
    input.addEventListener("change", renderPortraitView);
  });
  refs.portraitShotTypeInputs.forEach((input) => {
    input.addEventListener("change", renderPortraitView);
  });
  refs.portraitActionInputs.forEach((input) => {
    input.addEventListener("change", renderPortraitView);
  });
  portraitLocationController.bind();
  refs.portraitRatioInput.addEventListener("change", (event) => {
    syncPortraitRatio(event.target.value);
  });
  refs.portraitSizeInput.addEventListener("change", (event) => {
    syncPortraitSize(event.target.value);
  });
  refs.portraitRecordRefreshButton.addEventListener("click", refreshPortraitRecordSets);
  refs.portraitRecordDeleteCurrentButton.addEventListener("click", () => requestAssetRecordDelete("portrait", "current"));
  refs.portraitRecordDeleteSelectedButton.addEventListener("click", () => requestAssetRecordDelete("portrait", "selected"));
  refs.portraitRecordReuseButton.addEventListener("click", reusePortraitRecordSet);
  refs.portraitRecordOpenFolderButton.addEventListener("click", () => {
    openPortraitRecordFolder().catch((error) => setPortraitRecordFeedback(error.message, "error"));
  });
  refs.portraitRecordCopyPathsButton.addEventListener("click", () => {
    copyPortraitRecordPaths().catch((error) => setPortraitRecordFeedback(error.message, "error"));
  });
  refs.portraitRecordCopyPromptsButton.addEventListener("click", () => {
    copyPortraitRecordPrompts().catch((error) => setPortraitRecordFeedback(error.message, "error"));
  });
  refs.portraitRecordExportPromptsButton.addEventListener("click", exportPortraitRecordPrompts);
  refs.portraitRecordExportManifestButton.addEventListener("click", exportPortraitRecordManifest);
  refs.portraitRecordSetList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-portrait-record-set-id]");
    if (!target) {
      return;
    }
    selectPortraitRecord(target.dataset.portraitRecordSetId);
  });
  refs.portraitRecordSetList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-portrait-record-select-set-id]");
    if (!checkbox) return;
    state.portrait.recordCheckedSetIds = updateCheckedRecordIds(
      state.portrait.recordCheckedSetIds,
      checkbox.dataset.portraitRecordSelectSetId,
      checkbox.checked,
    );
    renderPortraitRecordView();
  });
  refs.portraitRecordResultGrid.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-portrait-record-preview-item-id]");
    if (previewButton) {
      openPortraitRecordItemPreview(previewButton.dataset.portraitRecordPreviewItemId);
      return;
    }

    const copyPromptButton = event.target.closest("[data-portrait-record-copy-prompt-item-id]");
    if (copyPromptButton) {
      const selectedSet = getPortraitRecordSelectedSet();
      const item = selectedSet?.items?.find((entry) => entry.itemId === copyPromptButton.dataset.portraitRecordCopyPromptItemId);
      writeTextToClipboard(item?.prompt || "", "当前浏览器不支持复制写真提示词。").catch((error) =>
        setPortraitRecordFeedback(error.message, "error"),
      );
    }
  });
  refs.creationResultGrid.addEventListener("click", (event) => {
    const previewButton = event.target.closest("[data-creation-preview-item-id]");
    if (previewButton) {
      openCreationCurrentItemPreview(previewButton.dataset.creationPreviewItemId);
      return;
    }

    const button = event.target.closest("[data-creation-retry-item-id]");
    if (!button) {
      return;
    }

    repairCreationItems({ itemId: button.dataset.creationRetryItemId }).catch((error) =>
      setCreationFeedback(error.message, "error"),
    );
  });
  [refs.creationProductNameInput, refs.creationProductDescriptionInput, refs.creationSellingPointsInput, refs.creationDimensionSpecsInput].forEach((input) => input.addEventListener("input", resetCreationDraftPreview));
  refs.creationDimensionUnitModeInput?.addEventListener("change", resetCreationDraftPreview);
  refs.creationTargetLanguageInput?.addEventListener("change", () => {
    refreshCreationPlanAfterExplicitSetParameterChange({ targetLanguage: getCreationSelectedLanguage().value });
  });
  // Legacy static contract: [refs.creationDimensionUnitModeInput, refs.creationTargetLanguageInput, refs.creationPlatformInput].forEach((input) => input?.addEventListener("change", resetCreationDraftPreview));
  refs.creationPlatformInput?.addEventListener("pointerdown", () => {
    creationPreviousPlatformValue = getCreationSelectedPlatform().value;
  });
  refs.creationPlatformInput?.addEventListener("focus", () => {
    creationPreviousPlatformValue = getCreationSelectedPlatform().value;
  });
  refs.creationPlatformInput?.addEventListener("change", () => {
    handleCreationPlatformChange().catch((error) => setCreationFeedback(error.message, "error"));
  });
  refs.creationIndustryTemplateInput?.addEventListener("change", () => {
    markCreationIndustryTemplateManuallyEdited();
    invalidateCreationReferenceAnalysisRequest();
    resetCreationDraftPreview();
  });
  refs.creationImageCountInput.addEventListener("change", () => {
    syncCreationSelectedRolesToCount();
    if (!hasCreationPlanPreviewInput()) return;
    requestCreationPlanPreview().catch((error) => setCreationFeedback(error.message, "error"));
  });
  refs.creationImageCountInput.addEventListener("click", syncCreationSelectedRolesToCurrentCount);
  refs.creationSkuGenerationEnabledInput?.addEventListener("change", refreshCreationPlanAfterSkuGenerationToggle);
  refs.creationInfographicRebuildEnabledInput?.addEventListener("change", resetCreationDraftPreview);
  refs.creationSkuBundleCountInput?.addEventListener("input", resetCreationDraftPreview);
  refs.creationSkuGenerationRuleInput?.addEventListener("change", resetCreationDraftPreview);
  refs.creationIndustryTemplateTrigger.addEventListener("click", async () => {
    const shouldOpenCreationIndustryTemplateBrowser = refs.creationIndustryTemplatePopover?.hidden !== false;
    if (shouldOpenCreationIndustryTemplateBrowser) {
      await ensureCreationCategoryTemplatesReady();
      focusCreationIndustryTemplateBrowserOnSelectedTemplate();
    }
    renderCreationIndustryTemplateBrowser();
    setCreationIndustryTemplateBrowserOpen(shouldOpenCreationIndustryTemplateBrowser);
  });
  refs.creationIndustryTemplateBackButton.addEventListener("click", goBackCreationIndustryTemplateLevel);
  refs.creationIndustryTemplateBrowser.addEventListener("click", (event) => {
    const target = event.target.closest("[data-creation-industry-template-value], [data-creation-industry-level]");
    if (!target) {
      return;
    }

    const templateValue = target.dataset.creationIndustryTemplateValue;
    if (templateValue) {
      const previousValue = refs.creationIndustryTemplateInput.value || "general";
      setCreationIndustryTemplateValue(templateValue, { searchText: "" });
      markCreationIndustryTemplateManuallyEdited();
      setCreationIndustryTemplateBrowserOpen(false);
      if (previousValue !== refs.creationIndustryTemplateInput.value) {
        invalidateCreationReferenceAnalysisRequest();
        syncCreationSelectedRolesToIndustry();
      }
      return;
    }

    updateCreationIndustryTemplateBrowserLevel(
      Number.parseInt(target.dataset.creationIndustryLevel || "0", 10),
      target.dataset.creationIndustryName,
    );
  });
  refs.creationIndustryTemplateSearchInput.addEventListener("input", () => {
    setCreationIndustryTemplateBrowserOpen(true);
    ensureCreationCategoryTemplatesReady({ render: true });
    renderCreationIndustryTemplateBrowser();
  });
  refs.creationRatioInput.addEventListener("pointerdown", () => setCreationRatioOptionLabels({ expanded: true }));
  refs.creationRatioInput.addEventListener("keydown", (event) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(event.key)) {
      setCreationRatioOptionLabels({ expanded: true });
    }
  });
  refs.creationRatioInput.addEventListener("blur", () => setCreationRatioOptionLabels({ expanded: false }));
  refs.creationRatioInput.addEventListener("change", () => {
    renderCreationSizeOptions();
    setCreationRatioOptionLabels({ expanded: false });
    const parameters = { ratio: refs.creationRatioInput.value || DEFAULT_UI_RATIO };
    if (refs.creationSizeInput.value && refs.creationSizeInput.value !== "auto") {
      parameters.resolutionTier = refs.creationSizeInput.value;
    }
    refreshCreationPlanAfterExplicitSetParameterChange(parameters);
  });
  refs.creationSizeInput.addEventListener("change", () => {
    refreshCreationPlanAfterExplicitSetParameterChange({ resolutionTier: refs.creationSizeInput.value || "auto" });
  });
  refs.creationRoleGrid.addEventListener("change", (event) => {
    const target = event.target.closest("[data-creation-role], [data-creation-plan-slot-key]");
    if (!target) {
      return;
    }

    if (target.dataset.creationPlanSlotKey) {
      setCreationPlatformItemOverride(target.dataset.creationPlanSlotKey, "enabled", target.checked);
      requestCreationPlanPreview().catch((error) => setCreationFeedback(error.message, "error"));
      return;
    }

    toggleCreationSelectedRole(target.dataset.creationRole);
  });
  refs.creationBranchInputs.forEach((input) => {
    input.addEventListener("change", (event) => {
      if (event.target.checked) {
        setCreationBranch(event.target.value);
      }
    });
  });
  refs.creationReferenceInput.addEventListener("change", (event) => applyCreationReferenceFiles(event.target.files));
  refs.creationReferenceResetButton.addEventListener("click", clearCreationReferenceFiles);
  refs.creationLogoBatchSourceInput.addEventListener("change", (event) => applyCreationLogoBatchSourceFiles(event.target.files));
  refs.creationLogoInput.addEventListener("change", (event) => applyCreationLogoFile(event.target.files));
  refs.creationLogoPlacementInput.addEventListener("change", () => { state.creationLogo.placement = normalizeCreationLogoPlacement(refs.creationLogoPlacementInput.value); renderCreationView(); });
  refs.creationLogoBackgroundInput.addEventListener("change", () => { state.creationLogo.background = normalizeCreationLogoBackground(refs.creationLogoBackgroundInput.value); renderCreationView(); });
  refs.creationLogoRemoveButton.addEventListener("click", removeCreationLogoFile);
  refs.creationReferenceAnalyzeButton.addEventListener("click", () => {
    analyzeCreationReferenceImages().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setCreationReferenceAnalysisFeedback(message, "error");
      showError(message);
    });
  });
  refs.creationReferenceAnalysisToggleButton.addEventListener("click", toggleCreationReferenceAnalysisPanel);
  refs.creationReferenceGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-creation-reference-preview-id]");
    if (!target) {
      return;
    }

    openCreationReferencePreview(target.dataset.creationReferencePreviewId);
  });
  refs.creationReferenceGrid.addEventListener("dblclick", beginCreationReferenceNoteEditing);
  refs.creationReferenceGrid.addEventListener("focusout", (event) => {
    commitCreationReferenceNoteEditing(event.target);
  });
  refs.creationReferenceGrid.addEventListener("change", (event) => {
    const bindTarget = event.target.closest("[data-creation-reference-restore-bind-id]");
    if (bindTarget) {
      bindCreationReferenceToRestoreEntry(bindTarget.dataset.creationReferenceRestoreBindId, bindTarget.value);
      return;
    }

    const target = event.target.closest("[data-creation-reference-role-id]");
    if (!target) {
      return;
    }

    updateCreationReferenceRole(target.dataset.creationReferenceRoleId, target.value);
  });
  bindCreationReferenceDrag({ grid: refs.creationReferenceGrid, getReferenceFiles: () => state.creationReferenceFiles, reorderReferenceFile: reorderCreationReferenceFile });
  refs.creationReferenceDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.creationReferenceDropzone.classList.add("dragover");
  });
  refs.creationReferenceDropzone.addEventListener("dragleave", () => {
    refs.creationReferenceDropzone.classList.remove("dragover");
  });
  refs.creationReferenceDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.creationReferenceDropzone.classList.remove("dragover");
    applyCreationReferenceFiles(event.dataTransfer?.files);
  });
  refs.creationLogoBatchSourceDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.creationLogoBatchSourceDropzone.classList.add("dragover");
  });
  refs.creationLogoBatchSourceDropzone.addEventListener("dragleave", () => {
    refs.creationLogoBatchSourceDropzone.classList.remove("dragover");
  });
  refs.creationLogoBatchSourceDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.creationLogoBatchSourceDropzone.classList.remove("dragover");
    applyCreationLogoBatchSourceFiles(event.dataTransfer?.files);
  });
  refs.creationLogoDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.creationLogoDropzone.classList.add("dragover");
  });
  refs.creationLogoDropzone.addEventListener("dragleave", () => {
    refs.creationLogoDropzone.classList.remove("dragover");
  });
  refs.creationLogoDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.creationLogoDropzone.classList.remove("dragover");
    applyCreationLogoFile(event.dataTransfer?.files);
  });
  refs.pptForm.addEventListener("submit", startPptGeneration);
  pptAnalysis.bind();
  refs.pptCompleteMissingButton.addEventListener("click", completeMissingPptSlides);
  refs.pptRecordRefreshButton.addEventListener("click", () => {
    loadPptDecks().catch((error) => showError(error.message));
  });
  refs.pptRecordDeleteCurrentButton.addEventListener("click", () => requestAssetRecordDelete("ppt", "current"));
  refs.pptRecordDeleteSelectedButton.addEventListener("click", () => requestAssetRecordDelete("ppt", "selected"));
  refs.pptRecordList.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      return;
    }

    const target = event.target.closest("[data-ppt-record-key]");
    if (!target) {
      return;
    }

    selectPptRecord(target.dataset.pptRecordKey);
  });
  refs.pptRecordList.addEventListener("keydown", (event) => {
    if (event.key !== "Enter" && event.key !== " ") {
      return;
    }

    if (event.target.closest("a,button")) {
      return;
    }

    const target = event.target.closest("[data-ppt-record-key]");
    if (!target) {
      return;
    }

    event.preventDefault();
    selectPptRecord(target.dataset.pptRecordKey);
  });
  refs.pptRecordList.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-ppt-record-select-key]");
    if (!checkbox) return;
    state.ppt.recordCheckedKeys = updateCheckedRecordIds(
      state.ppt.recordCheckedKeys,
      checkbox.dataset.pptRecordSelectKey,
      checkbox.checked,
    );
    renderPptRecordView();
  });
  refs.pptRecordDetail.addEventListener("click", (event) => {
    const target = event.target.closest("[data-ppt-record-slide]");
    if (target) {
      selectPptRecordSlide(target.dataset.pptRecordSlide);
      return;
    }

    if (event.target.closest("[data-ppt-record-back]")) {
      clearPptRecordSelection();
    }
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
  /* 折叠按钮与板块切换都是重渲染出来的新节点，所以用委托监听。 */
  refs.timelineList.addEventListener("click", handleGenerationLogGroupToggle);
  refs.timelineChannelTabs?.addEventListener("click", handleGenerationLogChannelPick);
  refs.surprisePromptButton.addEventListener("click", selectRandomPrompt);
  refs.closePromptTemplateButton.addEventListener("click", () => setPromptTemplatePopoverOpen(false));
  refs.promptTemplateForm.addEventListener("submit", savePromptTemplate);
  refs.newPromptTemplateButton.addEventListener("click", resetPromptTemplateForm);
  refs.applyPromptTemplateButton.addEventListener("click", applyPromptTemplate);
  refs.deletePromptTemplateButton.addEventListener("click", deletePromptTemplate);
  refs.promptInput.addEventListener("input", updatePromptCounter);
  refs.promptInput.addEventListener("keydown", handlePromptGenerationShortcut);
  refs.promptInput.addEventListener("paste", handleStudioImagePaste); refs.promptEnhanceToggle.addEventListener("click", togglePromptEnhanceMode); refs.promptEnhanceInput.addEventListener("keydown", handlePromptGenerationShortcut);
  refs.clearPromptButton.addEventListener("click", clearPromptInput);
  refs.styleTransferInstructionInput.addEventListener("keydown", handlePromptGenerationShortcut);
  refs.styleTransferInstructionInput.addEventListener("paste", handleStudioImagePaste);
  refs.styleTransferPresetComparison.addEventListener("click", handleStyleTransferPresetComparisonClick);
  refs.styleTransferPresetInput.addEventListener("change", handleStyleTransferPresetChange);
  refs.sizeInput.addEventListener("change", (event) => {
    syncGenerationSize(event.target.value);
  });
  refs.referenceAnalysisSizeInput.addEventListener("change", (event) => {
    syncReferenceAnalysisGenerationSize(event.target.value);
  });
  refs.referenceAnalysisLanguageInput.addEventListener("change", (event) => {
    invalidateReferenceAnalysisRequest();
    state.referenceAnalysis.outputLanguage = event.target.value;
  });
  refs.imageDecompositionSizeInput.addEventListener("change", (event) => {
    syncImageDecompositionSize(event.target.value);
  });
  refs.styleTransferSourceInput.addEventListener("change", (event) => {
    applyStyleTransferReferenceFile("source", event.target.files);
  });
  refs.styleTransferStyleInput.addEventListener("change", (event) => {
    applyStyleTransferReferenceFile("style", event.target.files);
  });
  bindStyleTransferDropzone(refs.styleTransferSourceDropzone, "source");
  bindStyleTransferDropzone(refs.styleTransferStyleDropzone, "style");
  refs.referenceInput.addEventListener("change", (event) => {
    applyReferenceFiles(event.target.files);
  });
  refs.clearReferenceButton.addEventListener("click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetReferenceFiles();
  });
  refs.referenceGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-reference-preview-id]");
    if (!target) {
      return;
    }

    openReferencePreview(target.dataset.referencePreviewId);
  });
  refs.referenceDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.referenceDropzone.classList.add("dragover");
  });
  refs.referenceDropzone.addEventListener("dragleave", () => {
    refs.referenceDropzone.classList.remove("dragover");
  });
  refs.referenceDropzone.addEventListener("drop", (event) => {
    handleReferenceDrop(event);
  });
  refs.referenceGrid.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.referenceGrid.classList.add("dragover");
  });
  refs.referenceGrid.addEventListener("dragleave", () => {
    refs.referenceGrid.classList.remove("dragover");
  });
  refs.referenceGrid.addEventListener("drop", (event) => {
    handleReferenceDrop(event);
  });
  refs.referencePreviewBackdrop.addEventListener("click", closeReferencePreview);
  refs.referencePreviewClose.addEventListener("click", closeReferencePreview);
  refs.referenceAnalysisInput.addEventListener("change", (event) => {
    applyReferenceAnalysisFiles(event.target.files);
  });
  refs.referenceAnalysisGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-reference-analysis-preview-id]");
    if (!target) {
      return;
    }

    openReferenceAnalysisPreview(target.dataset.referenceAnalysisPreviewId);
  });
  refs.referenceAnalysisDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.referenceAnalysisDropzone.classList.add("dragover");
  });
  refs.referenceAnalysisDropzone.addEventListener("dragleave", () => {
    refs.referenceAnalysisDropzone.classList.remove("dragover");
  });
  refs.referenceAnalysisDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.referenceAnalysisDropzone.classList.remove("dragover");
    applyReferenceAnalysisFiles(event.dataTransfer?.files);
  });
  refs.imageDecompositionInput.addEventListener("change", (event) => {
    applyImageDecompositionFile(event.target.files);
  });
  refs.imageDecompositionDropzone.addEventListener("dragover", (event) => {
    event.preventDefault();
    refs.imageDecompositionDropzone.classList.add("dragover");
  });
  refs.imageDecompositionDropzone.addEventListener("dragleave", () => {
    refs.imageDecompositionDropzone.classList.remove("dragover");
  });
  refs.imageDecompositionDropzone.addEventListener("drop", (event) => {
    event.preventDefault();
    refs.imageDecompositionDropzone.classList.remove("dragover");
    applyImageDecompositionFile(event.dataTransfer?.files);
  });
  refs.imageDecompositionGrid.addEventListener("click", (event) => {
    const target = event.target.closest("[data-image-decomposition-preview-id]");
    if (!target) {
      return;
    }

    openImageDecompositionPreview(target.dataset.imageDecompositionPreviewId);
  });
  refs.imageDecompositionLanguageInput.addEventListener("change", (event) => {
    state.imageDecomposition.language = event.target.value;
    syncImageDecompositionLanguageUI();
    renderImageDecompositionView();
  });
  refs.imageDecompositionCustomLanguageInput.addEventListener("input", (event) => {
    state.imageDecomposition.customLanguage = event.target.value;
    renderImageDecompositionView();
  });
  refs.imageDecompositionFeatureCardsInput.addEventListener("change", (event) => {
    state.imageDecomposition.featureCardsEnabled = event.target.value === "on";
  });
  refs.imageDecompositionGenerateButton.addEventListener("click", () => {
    startImageDecompositionGeneration().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setImageDecompositionFeedback(message, "error");
      showError(message);
    });
  });
  refs.imageDecompositionGenerationLightboxButton.addEventListener("click", openImageDecompositionGeneratedPreview);
  refs.referenceAnalyzeButton.addEventListener("click", () => {
    analyzeReferenceImages().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setReferenceAnalysisFeedback(message, "error");
      showError(message);
    });
  });
  refs.referenceAnalysisToggleButton.addEventListener("click", toggleReferenceAnalysisPanel);
  refs.referenceAnalysisAutoCollapseButton.addEventListener("click", toggleReferenceAnalysisAutoCollapse);
  refs.referenceAnalysisCopyPromptButton.addEventListener("click", () => {
    copyReferenceAnalysisSelectedPrompt().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setReferenceAnalysisFeedback(message, "error");
    });
  });
  refs.referenceAnalysisGenerateButton.addEventListener("click", () => {
    startReferenceAnalysisGeneration().catch((error) => {
      const message = error instanceof Error ? error.message : String(error);
      setReferenceAnalysisFeedback(message, "error");
      showError(message);
    });
  });
  refs.referenceAnalysisList.addEventListener("click", (event) => {
    const target = event.target.closest("[data-reference-analysis-prompt-index]");
    if (target) {
      applyReferenceAnalysisPrompt(target.dataset.referenceAnalysisPromptIndex);
    }
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
  refs.gallerySelectionModeButton.addEventListener("click", () => { if (state.galleryLoading || state.assetRecordDeletion.busy) return; state.gallerySelectionMode = !state.gallerySelectionMode; renderGalleryView(); });
  refs.galleryDeleteCurrentButton.addEventListener("click", () => requestAssetRecordDelete("gallery", "current"));
  refs.galleryDeleteSelectedButton.addEventListener("click", () => requestAssetRecordDelete("gallery", "selected"));
  refs.gallerySections.addEventListener("change", (event) => {
    const checkbox = event.target.closest("[data-gallery-select-filename]");
    if (!checkbox) return;
    state.galleryCheckedFilenames = updateCheckedRecordIds(
      state.galleryCheckedFilenames,
      checkbox.dataset.gallerySelectFilename,
      checkbox.checked,
    );
    renderGalleryView();
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
  refs.previewAddReferenceButton.addEventListener("click", () => {
    if (refs.previewAddReferenceButton.getAttribute("aria-disabled") === "true") {
      return;
    }
    void addCurrentPreviewToReferences();
  });
  refs.previewLightboxButton.addEventListener("click", () => {
    const item = getCurrentPreviewItem();
    if (item && getImageUrl(item)) {
      openLightbox(item, { items: getCurrentPreviewNavigationItems() });
    }
  });
  refs.previewDownloadButton.addEventListener("click", (event) => {
    event.preventDefault();
    const item = getCurrentPreviewItem();
    downloadGalleryItem(item, refs.previewImage).catch((error) => {
      showError(error.message);
    });
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
      openLightbox(item, { items: getCurrentPreviewNavigationItems() });
    }
  });
  refs.previewImage.addEventListener("dragstart", (event) => {
    const item = getCurrentPreviewItem();
    if (!isPromptReferenceWorkflow() || !item || !getImageUrl(item) || !state.selectedPreviewKey) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData(PREVIEW_REFERENCE_DRAG_MIME, state.selectedPreviewKey);
    event.dataTransfer?.setData("text/plain", "添加到参考图");
    if (event.dataTransfer) {
      event.dataTransfer.effectAllowed = "copy";
    }
    refs.previewImage.classList.add("is-dragging");
  });
  refs.previewImage.addEventListener("dragend", () => {
    refs.previewImage.classList.remove("is-dragging");
  });
  refs.referenceAnalysisGenerationCanvas.addEventListener("click", openReferenceAnalysisGeneratedPreview);
  refs.referenceAnalysisGenerationCanvas.addEventListener("keydown", (event) => {
    const shouldOpenPreview = event.key === "Enter" || event.key === " ";
    if (!shouldOpenPreview) {
      return;
    }

    const item = getReferenceAnalysisGenerationPreviewItem();
    if (!item || !getImageUrl(item)) {
      return;
    }

    event.preventDefault();
    openReferenceAnalysisGeneratedPreview();
  });
  refs.referenceAnalysisGenerationStrip.addEventListener("click", (event) => {
    const target = event.target.closest("[data-reference-analysis-generation-key]");
    if (!target) {
      return;
    }

    setReferenceAnalysisGenerationPreviewKey(target.dataset.referenceAnalysisGenerationKey);
  });
  refs.imageDecompositionGenerationCanvas.addEventListener("click", openImageDecompositionGeneratedPreview);
  refs.imageDecompositionGenerationCanvas.addEventListener("keydown", (event) => {
    const shouldOpenPreview = event.key === "Enter" || event.key === " ";
    if (!shouldOpenPreview) {
      return;
    }

    const item = getImageDecompositionGenerationPreviewItem();
    if (!item || !getImageUrl(item)) {
      return;
    }

    event.preventDefault();
    openImageDecompositionGeneratedPreview();
  });
  refs.imageDecompositionGenerationStrip.addEventListener("click", (event) => {
    const target = event.target.closest("[data-image-decomposition-generation-key]");
    if (!target) {
      return;
    }

    setImageDecompositionGenerationPreviewKey(target.dataset.imageDecompositionGenerationKey);
  });
  refs.zoomOutButton.addEventListener("click", () => stepZoom(-0.1));
  refs.zoomInButton.addEventListener("click", () => stepZoom(0.1));
  refs.zoomResetButton.addEventListener("click", resetZoom);
  lightboxViewerController.bindEvents();
  refs.lightboxBackdrop.addEventListener("click", closeLightbox);
  refs.lightboxClose.addEventListener("click", closeLightbox);
  refs.lightboxDownload.addEventListener("click", (event) => {
    event.preventDefault();
    downloadGalleryItem(state.lightboxItem, refs.lightboxImage).catch((error) => {
      showError(error.message);
    });
  });
  refs.copyPromptButton.addEventListener("click", () => {
    copyLightboxPrompt().catch((error) => {
      showError(error.message);
    });
  });
  document.addEventListener("keydown", handlePreviewArrowNavigation);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      const openAssetMenu = document.querySelector("details[data-asset-menu][open]");
      if (openAssetMenu) {
        openAssetMenu.open = false;
        openAssetMenu.querySelector("summary")?.focus();
        return;
      }
      const openAssetPicker = document.querySelector("[data-asset-record-picker].is-open");
      if (openAssetPicker) {
        assetWorkspaceController.closeRecordPickers();
        openAssetPicker.querySelector(".asset-record-picker-trigger")?.focus();
        return;
      }
      if (
        refs.portraitAccessoryAssetPopover &&
        !refs.portraitAccessoryAssetPopover.classList.contains("hidden")
      ) {
        setPortraitAccessoryAssetPopoverOpen(false);
        return;
      }

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

      if (refs.referencePreviewViewer.classList.contains("open")) {
        closeReferencePreview();
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
    const editingReferenceNote = refs.creationReferenceGrid?.querySelector('.creation-reference-note[contenteditable="true"]');
    if (editingReferenceNote && !editingReferenceNote.contains(event.target)) {
      editingReferenceNote.blur();
    }

    if (refs.creationIndustryTemplatePopover && !refs.creationIndustryTemplatePopover.hidden) {
      if (!refs.creationIndustryTemplateBrowser.contains(event.target)) {
        setCreationIndustryTemplateBrowserOpen(false);
      }
    }

    if (
      refs.portraitAccessoryAssetPopover &&
      !refs.portraitAccessoryAssetPopover.classList.contains("hidden")
    ) {
      if (
        refs.portraitAccessoryAssetPopover.contains(event.target) ||
        refs.portraitAccessoryAssetButton?.contains(event.target)
      ) {
        return;
      }

      setPortraitAccessoryAssetPopoverOpen(false);
    }

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

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && refs.creationIndustryTemplatePopover && !refs.creationIndustryTemplatePopover.hidden) {
      setCreationIndustryTemplateBrowserOpen(false);
    }
  });
}

function getStartupRecordLoaders() { return [loadGallery, loadGenerationTasks]; } function loadStartupRecordsInBackground() { void Promise.allSettled(getStartupRecordLoaders().map((load) => load())).then((results) => { const rejected = results.find((result) => result.status === "rejected"); if (!rejected) return; const message = rejected.reason instanceof Error ? rejected.reason.message : String(rejected.reason); console.warn("startup record load failed", rejected.reason); showError(message); setConnectionState("error", "部分历史记录加载失败"); }); }
async function bootstrap() {
  state.clientSessionId = getOrCreateClientSessionId();
  state.uiLanguage = readUiLanguage();
  syncUiLanguage();
  state.uiTheme = readUiTheme();
  setUiTheme(state.uiTheme);
  state.generationLog = readGenerationLogStore();
  state.galleryMetadataCache = readGalleryMetadataCache();
  state.promptTemplates = readPromptTemplates();
  state.promptTemplateDismissedHistoryIds = readDismissedPromptAgentTemplateIds();
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
  syncRatioOrientationSummary();
  renderReasoningOptions();
  renderSizeOptions();
  renderReferenceAnalysisRatioGrid();
  renderReferenceAnalysisSizeOptions();
  renderCreationIndustryTemplateBrowser();
  await ensureCreationPlatformModulesReady({ render: true });
  void creationLogoLibrary.load();
  updateGenerateButton();
  updateGenerationModeStatus();
  renderReferenceGrid();
  renderQuickBlendView();
  renderStyleTransferReferences();
  renderPromptTemplates();
  renderTimeline();
  setActiveView(getViewFromHash());
  scheduleGalleryPanelHeightSync();
  scheduleGalleryScrollSync();

  try {
    await loadConfig();
    renderAll();
    loadStartupRecordsInBackground();
  } catch (error) {
    showError(error instanceof Error ? error.message : String(error));
    setConnectionState("error", "初始化失败");
  }
}

bootstrap();
