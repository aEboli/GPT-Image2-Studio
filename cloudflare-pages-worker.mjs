import {
  appendRatioHintToPrompt,
  getAspectRatioOptions,
  resolveAspectRatioOption,
} from "./lib/aspect-ratios.mjs";
import {
  getDefaultGenerationSize,
  normalizeGenerationSize,
} from "./lib/generation-size-options.mjs";
import {
  IMAGE_DECOMPOSITION_ASSET_KIND,
  IMAGE_DECOMPOSITION_MODE,
  buildImageDecompositionPrompt,
  normalizeImageDecompositionFeatureCards,
} from "./lib/image-decomposition-prompt.mjs";
import {
  QUICK_BLEND_ASSET_KIND,
  QUICK_BLEND_MODE,
  buildQuickBlendFilenameToken,
  buildQuickBlendPrompt,
  buildQuickBlendReferenceLabels,
} from "./lib/quick-blend-prompt.mjs";
import { buildGenerationReferenceImageLabels } from "./lib/generation-reference-labels.mjs";
import {
  appendReferenceAnalysisLanguageInstruction,
  normalizeReferenceAnalysisLanguage,
} from "./lib/reference-analysis-language.mjs";
import {
  normalizeOutputFormat,
  toApiOutputFormat,
  toOutputFormatMimeType,
} from "./lib/output-format-options.mjs";
import {
  GENERATION_STREAM_EVENTS,
  buildFinalImageChunkPayloads,
} from "./lib/generation-stream-protocol.mjs";
import {
  applyCreationPlanOverrides,
  buildCreationPlan,
  normalizeCreationLogoOptions,
  normalizeCreationReferenceRoles,
} from "./lib/creation-planner.mjs";
import {
  applyPortraitPlanOverrides,
  buildPortraitPlan,
} from "./lib/portrait-planner.mjs";
import {
  CREATION_LOGO_BATCH_REFERENCE_LABELS,
  buildCreationLogoBatchPlan,
} from "./lib/creation-logo-batch.mjs";
import { generateCreationListingDrafts } from "./lib/creation-listing-agent.mjs";
import { generatePptDeckOutline } from "./lib/ppt-deck-workflow.mjs";
import { analyzePptDocument } from "./lib/ppt-document-analysis.mjs";
import { buildSlideEditPrompt, buildSlideImagePrompts } from "./lib/ppt-slide-prompts.mjs";
import { isEditablePptExportMode, normalizePptExportMode } from "./lib/ppt-export-mode.mjs";
import {
  getMissingPptSlideNumbers,
  mergePptSlides,
  normalizePptCompletionRequest,
} from "./lib/ppt-completion.mjs";
import { normalizePptMotionOptions } from "./lib/ppt-motion-presets.mjs";
import { normalizeBase64, requestDirectImageGeneration, requestImageGeneration } from "./lib/responses-workflow.mjs";
import { IMAGE_ROUTE_B, getSelectedImageGenerationConfig, normalizeImageRouteConfig } from "./lib/image-route-config.mjs";
import { fetchAvailableModels } from "./lib/model-list-client.mjs";
import { normalizeApiBaseUrl } from "./lib/api-base-url.mjs";
import { runWithConcurrency } from "./lib/limited-concurrency.mjs";
import {
  CREATION_REFERENCE_ANALYSIS_MODE,
  PORTRAIT_REFERENCE_ANALYSIS_MODE,
  REFERENCE_ORCHESTRATION_MODE,
  requestPromptAgentAnalysis,
} from "./lib/prompt-agent.mjs";
import { writeWorkerSseEvent } from "./lib/sse-writer.mjs";
import {
  appendCreationStyleReferences,
  buildCreationGenerationReferenceImageLabels,
  buildCreationItemReferenceImages,
} from "./lib/creation-reference-labels.mjs";
import {
  DEFAULT_BASE_URL,
  DEFAULT_REASONING_EFFORT,
  MAX_CREATION_REFERENCE_IMAGES,
  MAX_CREATION_STYLE_REFERENCE_IMAGES,
  MAX_PARALLEL_TASKS_PER_SESSION,
  MAX_PORTRAIT_ACTION_REFERENCE_IMAGES,
  MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES,
  MAX_PORTRAIT_PERSON_REFERENCE_IMAGES,
  MAX_REFERENCE_IMAGES,
  REASONING_EFFORT_OPTIONS,
} from "./lib/studio-constants.mjs";
import { buildUnsupportedRuntimeCapabilityPayload } from "./lib/api-contract.mjs";

const DEFAULT_RESPONSES_MODEL = "gpt-5.5";
const PPT_SLIDE_SIZE = "2048x1152";
const PPT_SLIDE_FORMAT = "png";
const UPSTREAM_STATUS_HEARTBEAT_MS = 59000;
const PPTX_MIME_TYPE = "application/vnd.openxmlformats-officedocument.presentationml.presentation";
const PPT_SOURCE_EXTENSIONS = new Set([".pdf", ".docx", ".pptx", ".txt", ".md", ".csv"]);
const SERVER_IMAGE_ROUTE_PREFIX = "/api/images/";
const SERVER_IMAGE_STORAGE_PREFIX = "images/";
const GENERATION_TASK_STORAGE_PREFIX = "generation-tasks/";
const GENERATION_REQUEST_STORAGE_PREFIX = "generation-requests/";
const SERVER_IMAGE_RETENTION_MS = 24 * 60 * 60 * 1000;
const QUICK_BLEND_REFERENCE_COUNT_MESSAGE =
  "Quick Blend mode requires 2 to 4 reference images: A and B are required; C and D are optional.";

function buildPortraitReferenceImageLabels(personReferenceImages = [], actionReferenceImages = [], accessoryReferenceImages = []) {
  const personCount = personReferenceImages.length;
  const actionCount = actionReferenceImages.length;
  const accessoryCount = accessoryReferenceImages.length;
  return [
    ...personReferenceImages.map(
      (image, index) =>
        `Portrait person reference ${index + 1} of ${personCount}: ${image.filename || "person reference image"}. Preserve visible identity, face, body proportions, hairstyle, and non-sensitive appearance cues from this person reference.`,
    ),
    ...actionReferenceImages.map(
      (image, index) =>
        `Portrait action and pose reference ${index + 1} of ${actionCount}: ${image.filename || "action reference image"}. Use this only for pose, gesture, body movement, limb placement, and action rhythm; do not treat it as another person identity, outfit, or prop source.`,
    ),
    ...accessoryReferenceImages.map(
      (image, index) =>
        `Portrait clothing, prop, and accessory reference ${index + 1} of ${accessoryCount}: ${image.filename || "styling reference image"}. WARDROBE LOCK: This image is the wardrobe authority. The generated subject must wear the supplied outfit, fabric structure, silhouette, colors, material, accessories, shoes, and props from this reference. Do not replace it with a generic blazer, suit, dress, or everyday outfit; do not treat it as another person identity.`,
    ),
  ];
}
const GENERATION_MODES = new Set(["style-transfer", "reference-analysis", IMAGE_DECOMPOSITION_MODE, QUICK_BLEND_MODE, "portrait"]);
const SERVER_IMAGE_BUCKET_MISSING_MESSAGE = "服务器图片存储未配置 IMAGE_BUCKET";
const GENERATION_QUEUE_MISSING_MESSAGE = "服务器异步生成队列未配置 GENERATION_QUEUE";
const DEFAULT_CREATION_LISTING_REASONING_EFFORT = "medium";
const CREATION_REFERENCE_ANALYSIS_REASONING_EFFORT = "low";
const PORTRAIT_REFERENCE_ANALYSIS_REASONING_EFFORT = "low";
const PROMPT_AGENT_ANALYSIS_REASONING_EFFORT = "medium";
const REFERENCE_ORCHESTRATION_REASONING_EFFORT = "low";
const DEFAULT_CONFIG = {
  baseUrl: DEFAULT_BASE_URL,
  responsesModel: DEFAULT_RESPONSES_MODEL,
  imageRoute: "a",
  directBaseUrl: DEFAULT_BASE_URL,
  directImageModel: "gpt-image-2",
  defaults: {
    size: "896x1120",
    quality: "high",
    format: "png",
    reasoningEffort: DEFAULT_REASONING_EFFORT,
  },
};

const JSON_HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
};

const SSE_HEADERS = {
  "Cache-Control": "no-cache, no-transform",
  Connection: "keep-alive",
  "Content-Type": "text/event-stream; charset=utf-8",
};

function jsonResponse(payload, status = 200) {
  return new Response(`${JSON.stringify(payload, null, 2)}\n`, {
    status,
    headers: JSON_HEADERS,
  });
}

function textResponse(message, status = 404) {
  return new Response(message, {
    status,
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  });
}

async function writeSseEvent(writer, type, payload) {
  await writeWorkerSseEvent(writer, type, payload);
}

function requestCloudImageGeneration(options) {
  if (options.imageRoute === IMAGE_ROUTE_B) {
    return requestDirectImageGeneration(options);
  }
  return requestImageGeneration(options);
}

function buildPublicConfig() {
  return {
    baseUrl: DEFAULT_CONFIG.baseUrl,
    apiKeyConfigured: false,
    responsesModel: DEFAULT_CONFIG.responsesModel,
    imageRoute: DEFAULT_CONFIG.imageRoute,
    directBaseUrl: DEFAULT_CONFIG.directBaseUrl,
    directApiKeyConfigured: false,
    directImageModel: DEFAULT_CONFIG.directImageModel,
    defaults: { ...DEFAULT_CONFIG.defaults },
    limits: {
      maxParallelTasksPerSession: MAX_PARALLEL_TASKS_PER_SESSION,
      maxReferenceImages: MAX_REFERENCE_IMAGES,
      maxCreationReferenceImages: MAX_CREATION_REFERENCE_IMAGES,
      maxCreationStyleReferenceImages: MAX_CREATION_STYLE_REFERENCE_IMAGES,
      maxPortraitPersonReferenceImages: MAX_PORTRAIT_PERSON_REFERENCE_IMAGES,
      maxPortraitActionReferenceImages: MAX_PORTRAIT_ACTION_REFERENCE_IMAGES,
      maxPortraitAccessoryReferenceImages: MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES,
    },
    reasoningEfforts: [...REASONING_EFFORT_OPTIONS],
    aspectRatios: getAspectRatioOptions(),
  };
}

function getStyleTransferReferenceImageLabels(generationMode, styleTransferStylePreset, referenceImages = []) {
  return buildGenerationReferenceImageLabels(generationMode, styleTransferStylePreset, referenceImages);
}

function getGenerationReferenceImageLabels(
  generationMode,
  styleTransferStylePreset,
  referenceImages = [],
  quickBlendGroups = [],
) {
  if (generationMode === QUICK_BLEND_MODE) {
    return buildQuickBlendReferenceLabels({ groups: quickBlendGroups });
  }
  return getStyleTransferReferenceImageLabels(generationMode, styleTransferStylePreset, referenceImages);
}

function normalizeGenerationMode(value) {
  const mode = String(value || "").trim();
  return GENERATION_MODES.has(mode) ? mode : "";
}

async function handlePromptAgentAnalyze(request, fetchImpl) {
  const formData = await request.formData();
  const rawImages = [
    ...formData.getAll("image"),
    ...formData.getAll("promptAgentImage"),
    ...formData.getAll("referenceImages"),
    ...formData.getAll("referenceImage"),
  ];
  const images = await toReferenceImages(rawImages);
  const mode = String(formData.get("mode") || "").trim();
  const targetLanguageInput = String(formData.get("targetLanguage") || "").trim();
  const targetLanguageLabelInput = String(formData.get("targetLanguageLabel") || "").trim();
  const maxReferenceImages =
    mode === CREATION_REFERENCE_ANALYSIS_MODE ? MAX_CREATION_REFERENCE_IMAGES : MAX_REFERENCE_IMAGES;

  if (images.length === 0) {
    return jsonResponse({ message: "请先上传一张图片。" }, 400);
  }

  if (images.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    return jsonResponse({ message: "仅支持图片文件。" }, 400);
  }

  if (images.length > maxReferenceImages) {
    return jsonResponse({ message: `参考图最多支持 ${maxReferenceImages} 张。` }, 400);
  }

  const config = normalizePrivateConfig(formData);
  const reasoningFallback =
    mode === REFERENCE_ORCHESTRATION_MODE
      ? REFERENCE_ORCHESTRATION_REASONING_EFFORT
      : PROMPT_AGENT_ANALYSIS_REASONING_EFFORT;
  const reasoningEffort = normalizeReasoningEffort(formData.get("reasoningEffort") || reasoningFallback);
  const json = await requestPromptAgentAnalysis({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    image: images[0],
    images,
    mode,
    targetLanguage: targetLanguageInput,
    targetLanguageLabel: targetLanguageLabelInput,
    responsesModel: config.responsesModel,
    reasoningEffort,
    fetchImpl,
  });

  return jsonResponse({
    ok: true,
    item: {
      id: `prompt-json-${crypto.randomUUID()}`,
      createdAt: new Date().toISOString(),
      filename: images.map((image) => image.filename).filter(Boolean).join(" + "),
      imageMimeType: images.map((image) => image.mimeType).filter(Boolean).join(", "),
      imageSize: 0,
      responsesModel: config.responsesModel,
      reasoningEffort,
      json,
    },
  });
}

function normalizeReasoningEffort(value, fallback = DEFAULT_REASONING_EFFORT) {
  const normalized = String(value || "").trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  if (!REASONING_EFFORT_OPTIONS.includes(normalized)) {
    throw new Error(`不支持的推理强度: ${normalized}`);
  }
  return normalized;
}

function normalizePrivateConfig(formData, { allowDirectImageRoute = false } = {}) {
  const routeConfig = normalizeImageRouteConfig(
    {
      imageRoute: formData.get("imageRoute"),
      baseUrl: formData.get("baseUrl"),
      apiKey: formData.get("apiKey"),
      responsesModel: formData.get("responsesModel"),
      directBaseUrl: formData.get("directBaseUrl"),
      directApiKey: formData.get("directApiKey"),
      directImageModel: formData.get("directImageModel"),
    },
    {
      defaultBaseUrl: DEFAULT_CONFIG.baseUrl,
      defaultResponsesModel: DEFAULT_CONFIG.responsesModel,
    },
  );
  const generationConfig = getSelectedImageGenerationConfig(routeConfig);

  if (!routeConfig.apiKey && (!allowDirectImageRoute || !generationConfig.apiKey)) {
    throw new Error("当前浏览器未保存 API Key，请先在配置中保存。");
  }

  return {
    ...routeConfig,
    defaults: { ...DEFAULT_CONFIG.defaults },
  };
}

async function toReferenceImages(files) {
  const validFiles = files.filter(
    (file) =>
      file &&
      typeof file === "object" &&
      typeof file.arrayBuffer === "function" &&
      Number(file.size || 0) > 0,
  );

  return Promise.all(
    validFiles.map(async (file, index) => {
      const buffer = await file.arrayBuffer();
      return {
        filename: file.name || `reference-image-${index + 1}`,
        mimeType: file.type || "application/octet-stream",
        base64: normalizeBase64(arrayBufferToBase64(buffer)),
      };
    }),
  );
}

async function readCreationLogoImage(formData) {
  const logoImages = await toReferenceImages([
    ...formData.getAll("logoImage"),
    ...formData.getAll("creationLogoImage"),
  ]);
  if (logoImages.length > 1) {
    throw new Error("Logo 最多只能上传 1 张。");
  }
  if (logoImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    throw new Error("Logo 仅支持图片文件。");
  }
  return logoImages[0] || null;
}

function buildCreationLogoOptionsFromFormData(formData, logoImage = null) {
  const submittedLogo = normalizeCreationLogoOptions(formData.get("logoOptions"));
  return normalizeCreationLogoOptions({
    ...submittedLogo,
    filename: logoImage?.filename || submittedLogo.filename,
    enabled: Boolean(logoImage) || submittedLogo.enabled,
    placement: formData.get("logoPlacement") || submittedLogo.placement,
    background: formData.get("logoBackground") || submittedLogo.background,
  });
}

function appendCreationLogoReference(referenceImages = [], logoImage = null) {
  return logoImage ? [...referenceImages, logoImage] : referenceImages;
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

function buildCloudFilename({ taskId, createdAt, format, filenameToken = "" }) {
  const safeDate = createdAt.replace(/[:.]/g, "-");
  const suffix = String(taskId || "image").replace(/[^a-zA-Z0-9-]/g, "").slice(-12) || "image";
  const safeToken = String(filenameToken || "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 100);
  const prefix = safeToken ? `${safeToken}-` : "";
  return `${prefix}cloudflare-${safeDate}-${suffix}.${format}`;
}

function base64ToUint8Array(base64) {
  const binary = atob(normalizeBase64(base64));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function buildImageStorageKey({ filename, createdAt }) {
  const date = String(createdAt || new Date().toISOString()).slice(0, 10);
  const extension = filename.match(/\.[a-z0-9]+$/i)?.[0] || ".png";
  const stem = filename
    .replace(/\.[^.]+$/, "")
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 80) || "image";
  return `${SERVER_IMAGE_STORAGE_PREFIX}${date}/${stem}-${crypto.randomUUID()}${extension}`;
}

function buildServerImageUrl(storageKey) {
  return `${SERVER_IMAGE_ROUTE_PREFIX}${encodeURIComponent(storageKey)}`;
}

function sanitizeStorageSegment(value, fallback = "item") {
  return String(value || fallback)
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, "-")
    .slice(0, 80) || fallback;
}

function sanitizeCreationFilenameToken(value, fallback = "creation") {
  const token = String(value || fallback)
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "")
    .trim();
  return token || fallback;
}

function getClientSessionIdFromRequest(request, formData = null) {
  return sanitizeStorageSegment(
    formData?.get?.("clientSessionId") || request.headers.get("x-client-session-id") || "default",
    "default",
  );
}

function buildGenerationTaskStorageKey(sessionId, taskId) {
  return `${GENERATION_TASK_STORAGE_PREFIX}${sanitizeStorageSegment(sessionId)}/${sanitizeStorageSegment(taskId)}.json`;
}

function buildGenerationRequestStorageKey({ sessionId, taskId, createdAt }) {
  const date = String(createdAt || new Date().toISOString()).slice(0, 10);
  return `${GENERATION_REQUEST_STORAGE_PREFIX}${date}/${sanitizeStorageSegment(sessionId)}/${sanitizeStorageSegment(taskId)}.json`;
}

function toPublicGenerationTask(task = {}) {
  return {
    id: String(task.id || ""),
    status: task.status === "completed" || task.status === "error" ? task.status : "running",
    statusStage: String(task.statusStage || task.status || "running"),
    statusText: String(task.statusText || ""),
    errorMessage: String(task.errorMessage || ""),
    createdAt: String(task.createdAt || new Date().toISOString()),
    updatedAt: String(task.updatedAt || task.createdAt || new Date().toISOString()),
    prompt: String(task.prompt || ""),
    ratio: String(task.ratio || ""),
    ratioLabel: String(task.ratioLabel || ""),
    size: String(task.size || ""),
    quality: String(task.quality || ""),
    format: String(task.format || ""),
    reasoningEffort: String(task.reasoningEffort || ""),
    imageModel: String(task.imageModel || "gpt-image-2"),
    hasReferenceImage: Boolean(task.hasReferenceImage),
    referenceImageNames: Array.isArray(task.referenceImageNames) ? task.referenceImageNames.map(String).filter(Boolean) : [],
    referenceImageName: String(task.referenceImageName || ""),
    generationMode: String(task.generationMode || task.mode || ""),
    assetKind: String(task.assetKind || ""),
    quickBlendPairIndex: String(task.quickBlendPairIndex || ""),
    quickBlendAImageName: String(task.quickBlendAImageName || ""),
    quickBlendBImageName: String(task.quickBlendBImageName || ""),
    quickBlendCImageName: String(task.quickBlendCImageName || ""),
    quickBlendDImageName: String(task.quickBlendDImageName || ""),
    quickBlendLayoutOrder: String(task.quickBlendLayoutOrder || ""),
    quickBlendPlacementShape: String(task.quickBlendPlacementShape || ""),
    targetLanguage: String(task.targetLanguage || ""),
    sourceImageName: String(task.sourceImageName || ""),
    featureCardsEnabled: normalizeImageDecompositionFeatureCards(task.featureCardsEnabled),
    item: task.item || null,
  };
}

async function writeJsonObject(imageBucket, key, payload) {
  await imageBucket.put(key, JSON.stringify(payload), {
    httpMetadata: {
      contentType: "application/json; charset=utf-8",
    },
  });
}

async function readJsonObject(imageBucket, key) {
  const object = await imageBucket.get(key);
  if (!object) {
    return null;
  }
  return JSON.parse(await object.text());
}

async function writeGenerationTask(imageBucket, sessionId, task) {
  const updatedTask = {
    ...task,
    updatedAt: new Date().toISOString(),
  };
  await writeJsonObject(imageBucket, buildGenerationTaskStorageKey(sessionId, updatedTask.id), updatedTask);
  return updatedTask;
}

async function patchGenerationTask(imageBucket, sessionId, taskId, patch) {
  const existing = (await readJsonObject(imageBucket, buildGenerationTaskStorageKey(sessionId, taskId))) || {
    id: taskId,
    createdAt: new Date().toISOString(),
  };
  return writeGenerationTask(imageBucket, sessionId, {
    ...existing,
    ...patch,
  });
}

async function listGenerationTasks(imageBucket, sessionId) {
  if (!imageBucket) {
    return [];
  }

  const listed = await imageBucket.list({
    prefix: `${GENERATION_TASK_STORAGE_PREFIX}${sanitizeStorageSegment(sessionId)}/`,
    limit: 30,
  });
  const tasks = [];
  for (const object of listed.objects || []) {
    try {
      const task = await readJsonObject(imageBucket, object.key);
      if (task) {
        tasks.push(toPublicGenerationTask(task));
      }
    } catch (_error) {
      // Ignore corrupt task snapshots; the queue will write a fresh state on the next update.
    }
  }

  return tasks
    .sort((left, right) => Date.parse(right.updatedAt || right.createdAt) - Date.parse(left.updatedAt || left.createdAt))
    .slice(0, 20);
}

function parseServerImageStorageKey(pathname) {
  if (!pathname.startsWith(SERVER_IMAGE_ROUTE_PREFIX)) {
    return "";
  }

  const encodedKey = pathname.slice(SERVER_IMAGE_ROUTE_PREFIX.length);
  let key = "";
  try {
    key = decodeURIComponent(encodedKey);
  } catch (_error) {
    return "";
  }

  if (
    !key.startsWith(SERVER_IMAGE_STORAGE_PREFIX) ||
    key.includes("..") ||
    key.includes("\\") ||
    !/^images\/\d{4}-\d{2}-\d{2}\/[a-zA-Z0-9._-]+\.(png|jpe?g)$/i.test(key)
  ) {
    return "";
  }

  return key;
}

function isExpiredIso(value) {
  const expiresAt = Date.parse(String(value || ""));
  return Number.isFinite(expiresAt) && expiresAt <= Date.now();
}

function buildStoredImageMetadata({ filename, createdAt, expiresAt, item = {} }) {
  const metadata = {
    filename: String(filename || ""),
    createdAt: String(createdAt || ""),
    expiresAt: String(expiresAt || ""),
  };
  const optionalFields = [
    "generationMode",
    "assetKind",
    "quickBlendPairIndex",
    "quickBlendAImageName",
    "quickBlendBImageName",
    "quickBlendCImageName",
    "quickBlendDImageName",
    "quickBlendLayoutOrder",
    "quickBlendPlacementShape",
    "referenceImageName",
    "ratio",
    "ratioLabel",
    "size",
    "quality",
    "format",
    "imageRoute",
    "responsesModel",
    "imageModel",
  ];

  for (const field of optionalFields) {
    const value = item[field];
    if (value !== undefined && value !== null && String(value) !== "") {
      metadata[field] = String(value);
    }
  }

  if (Array.isArray(item.referenceImageNames) && item.referenceImageNames.length > 0) {
    metadata.referenceImageNames = JSON.stringify(item.referenceImageNames.map((value) => String(value)));
  }

  return metadata;
}

async function storeFinalImage({ imageBucket, filename, createdAt, format, base64, item = {} }) {
  if (!imageBucket) {
    throw new Error(SERVER_IMAGE_BUCKET_MISSING_MESSAGE);
  }

  const storageKey = buildImageStorageKey({ filename, createdAt });
  const contentType = toOutputFormatMimeType(format);
  const expiresAt = new Date(Date.parse(createdAt) + SERVER_IMAGE_RETENTION_MS).toISOString();
  await imageBucket.put(storageKey, base64ToUint8Array(base64), {
    httpMetadata: {
      contentType,
    },
    customMetadata: buildStoredImageMetadata({ filename, createdAt, expiresAt, item }),
  });

  return {
    storageKey,
    imageUrl: buildServerImageUrl(storageKey),
    expiresAt,
  };
}

async function writeFinalImageChunks(writer, { filename, base64, format }) {
  const payloads = buildFinalImageChunkPayloads({
    filename,
    base64: normalizeBase64(base64),
    format,
  });
  for (const payload of payloads) {
    await writeSseEvent(writer, GENERATION_STREAM_EVENTS.FINAL_IMAGE_CHUNK, payload);
  }
}

function buildGalleryItem({
  taskId,
  createdAt,
  prompt,
  dataUrl,
  config,
  generationConfig = getSelectedImageGenerationConfig(config),
  ratioOption,
  size,
  quality,
  format,
  referenceImages,
  reasoningEffort,
  generationMode = "",
  assetKind = "",
  quickBlendPairIndex = "",
  quickBlendAImageName = "",
  quickBlendBImageName = "",
  quickBlendCImageName = "",
  quickBlendDImageName = "",
  quickBlendLayoutOrder = "",
  quickBlendPlacementShape = "",
  targetLanguage = "",
  sourceImageName = "",
  featureCardsEnabled = false,
  generationStartedAt,
  generationCompletedAt,
  generationDurationMs,
  filenameToken = "",
}) {
  const filename = buildCloudFilename({ taskId, createdAt, format, filenameToken });
  return {
    id: `${filename.replace(/\.[^.]+$/, "")}-${createdAt}`,
    filename,
    imageUrl: dataUrl,
    thumbnailUrl: "",
    createdAt,
    prompt,
    baseUrl: generationConfig.baseUrl,
    responsesModel: config.responsesModel,
    imageRoute: generationConfig.imageRoute,
    imageModel: generationConfig.imageModel,
    hasReferenceImage: referenceImages.length > 0,
    referenceImageNames: referenceImages.map((image) => image.filename),
    referenceImageName: referenceImages[0]?.filename || "",
    generationMode,
    assetKind,
    quickBlendPairIndex,
    quickBlendAImageName,
    quickBlendBImageName,
    quickBlendCImageName,
    quickBlendDImageName,
    quickBlendLayoutOrder,
    quickBlendPlacementShape,
    targetLanguage,
    sourceImageName,
    featureCardsEnabled,
    ratio: ratioOption.value,
    ratioLabel: ratioOption.label,
    size,
    quality,
    format,
    reasoningEffort,
    generationStartedAt,
    generationCompletedAt,
    generationDurationMs,
  };
}

async function buildGenerationRequestContext(request, formData) {
  const taskId = String(formData.get("jobId") || crypto.randomUUID()).trim();
  let prompt = String(formData.get("prompt") || "").trim();
  const ratio = String(formData.get("ratio") || "4:5");
  const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
  const requestedFormatInput = String(formData.get("format") || "").trim().toLowerCase();
  const generationMode = normalizeGenerationMode(formData.get("mode"));
  const isImageDecomposition = generationMode === IMAGE_DECOMPOSITION_MODE;
  const isQuickBlend = generationMode === QUICK_BLEND_MODE;
  const isReferenceAnalysis = generationMode === "reference-analysis";
  const targetLanguageInput = String(formData.get("targetLanguage") || "").trim();
  const targetLanguageLabelInput = String(formData.get("targetLanguageLabel") || "").trim();
  const customTargetLanguageInput = String(formData.get("customTargetLanguage") || "").trim();
  const featureCardsEnabled = normalizeImageDecompositionFeatureCards(formData.get("featureCardsEnabled"));
  const styleTransferStylePreset = String(formData.get("styleTransferStylePreset") || "").trim();
  let quickBlendPairIndex = String(formData.get("quickBlendPairIndex") || "1").trim();
  let quickBlendAImageName = String(formData.get("quickBlendAImageName") || formData.get("quickBlendAName") || "").trim();
  let quickBlendBImageName = String(formData.get("quickBlendBImageName") || formData.get("quickBlendBName") || "").trim();
  let quickBlendCImageName = String(formData.get("quickBlendCImageName") || formData.get("quickBlendCName") || "").trim();
  let quickBlendDImageName = String(formData.get("quickBlendDImageName") || formData.get("quickBlendDName") || "").trim();
  let quickBlendLayoutOrder = String(formData.get("quickBlendLayoutOrder") || "").trim();
  let quickBlendPlacementShape = String(formData.get("quickBlendPlacementShape") || "").trim();
  const config = normalizePrivateConfig(formData, { allowDirectImageRoute: true });
  const generationConfig = getSelectedImageGenerationConfig(config);
  const createdAt = new Date().toISOString();
  const sessionId = getClientSessionIdFromRequest(request, formData);
  let targetLanguage = "";
  let sourceImageName = "";
  let assetKind = "";
  let filenameToken = "";

  if (!prompt && !isImageDecomposition && !isQuickBlend) {
    throw new Error("提示词不能为空。");
  }

  const referenceImages = await toReferenceImages([
    ...formData.getAll("referenceImages"),
    ...formData.getAll("referenceImage"),
  ]);
  if (isQuickBlend && (referenceImages.length < 2 || referenceImages.length > 4)) {
    throw new Error(QUICK_BLEND_REFERENCE_COUNT_MESSAGE);
  }
  if (referenceImages.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`);
  }
  if (isImageDecomposition && referenceImages.length !== 1) {
    throw new Error("图片拆解模式需要且只支持上传一张源图。");
  }
  if (isImageDecomposition) {
    const decompositionPrompt = buildImageDecompositionPrompt({
      targetLanguage: targetLanguageInput,
      customLanguage: customTargetLanguageInput,
      featureCardsEnabled,
    });
    prompt = decompositionPrompt.prompt;
    targetLanguage = decompositionPrompt.targetLanguage;
    sourceImageName = referenceImages[0]?.filename || "";
    assetKind = IMAGE_DECOMPOSITION_ASSET_KIND;
  }
  if (isQuickBlend) {
    const inferredQuickBlendCImageName = quickBlendCImageName || (quickBlendDImageName ? "" : referenceImages[2]?.filename || "");
    const inferredQuickBlendDImageName = quickBlendDImageName || (referenceImages.length > 3 ? referenceImages[3]?.filename || "" : "");
    const quickBlendPrompt = buildQuickBlendPrompt({
      pairIndex: quickBlendPairIndex,
      aImageName: quickBlendAImageName || referenceImages[0]?.filename || "",
      bImageName: quickBlendBImageName || referenceImages[1]?.filename || "",
      cImageName: inferredQuickBlendCImageName,
      dImageName: inferredQuickBlendDImageName,
      layoutOrder: quickBlendLayoutOrder,
      placementShape: quickBlendPlacementShape,
    });
    prompt = quickBlendPrompt.prompt;
    assetKind = QUICK_BLEND_ASSET_KIND;
    quickBlendPairIndex = quickBlendPrompt.pairIndex;
    quickBlendAImageName = quickBlendPrompt.aImageName;
    quickBlendBImageName = quickBlendPrompt.bImageName;
    quickBlendCImageName = quickBlendPrompt.cImageName;
    quickBlendDImageName = quickBlendPrompt.dImageName;
    quickBlendLayoutOrder = quickBlendPrompt.layoutOrder;
    quickBlendPlacementShape = quickBlendPrompt.placementShape;
    filenameToken = buildQuickBlendFilenameToken({
      aImageName: quickBlendAImageName,
      bImageName: quickBlendBImageName,
      cImageName: quickBlendCImageName,
      dImageName: quickBlendDImageName,
    });
  }
  if (isReferenceAnalysis) {
    prompt = appendReferenceAnalysisLanguageInstruction(prompt, targetLanguageInput, targetLanguageLabelInput);
    const language = normalizeReferenceAnalysisLanguage(targetLanguageInput, targetLanguageLabelInput);
    targetLanguage = language.label;
  }
  const hasStyleTransferPreset = Boolean(styleTransferStylePreset);
  if (generationMode === "style-transfer" && referenceImages.length < (hasStyleTransferPreset ? 1 : 2)) {
    throw new Error("风格迁移需要上传原图，并上传风格参考图或选择一个风格。");
  }

  const reasoningEffort = normalizeReasoningEffort(formData.get("reasoningEffort"));
  const ratioOption = resolveAspectRatioOption(ratio);
  const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
  if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
    throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
  }

  const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
  const finalQuality = config.defaults.quality;
  const finalFormat = normalizeOutputFormat(requestedFormatInput || config.defaults.format);
  const finalPrompt = appendRatioHintToPrompt(prompt, ratioOption);

  return {
    sessionId,
    taskId,
    prompt,
    config,
    generationConfig,
    createdAt,
    generationMode,
    styleTransferStylePreset,
    assetKind,
    quickBlendPairIndex,
    quickBlendAImageName,
    quickBlendBImageName,
    quickBlendCImageName,
    quickBlendDImageName,
    quickBlendLayoutOrder,
    quickBlendPlacementShape,
    filenameToken,
    targetLanguage,
    sourceImageName,
    featureCardsEnabled,
    referenceImages,
    reasoningEffort,
    ratioOption,
    finalPrompt,
    finalSize,
    finalQuality,
    finalFormat,
  };
}

function buildQueuedGenerationTask(context) {
  return {
    id: context.taskId,
    status: "running",
    statusStage: "queued",
    statusText: "已提交到服务器队列，生成完成后会自动写入服务器暂存",
    createdAt: context.createdAt,
    updatedAt: context.createdAt,
    prompt: context.prompt,
    mode: context.generationMode,
    generationMode: context.generationMode,
    styleTransferStylePreset: context.styleTransferStylePreset,
    assetKind: context.assetKind,
    quickBlendPairIndex: context.quickBlendPairIndex,
    quickBlendAImageName: context.quickBlendAImageName,
    quickBlendBImageName: context.quickBlendBImageName,
    quickBlendCImageName: context.quickBlendCImageName,
    quickBlendDImageName: context.quickBlendDImageName,
    quickBlendLayoutOrder: context.quickBlendLayoutOrder,
    quickBlendPlacementShape: context.quickBlendPlacementShape,
    filenameToken: context.filenameToken,
    targetLanguage: context.targetLanguage,
    sourceImageName: context.sourceImageName,
    featureCardsEnabled: context.featureCardsEnabled,
    ratio: context.ratioOption.value,
    ratioLabel: context.ratioOption.label,
    size: context.finalSize,
    quality: context.finalQuality,
    format: context.finalFormat,
    reasoningEffort: context.reasoningEffort,
    imageRoute: context.generationConfig.imageRoute,
    imageModel: context.generationConfig.imageModel,
    hasReferenceImage: context.referenceImages.length > 0,
    referenceImageNames: context.referenceImages.map((image) => image.filename),
    referenceImageName: context.referenceImages[0]?.filename || "",
  };
}

function normalizePrivateConfigPayload(payload = {}) {
  return normalizePrivateConfig({
    get(name) {
      return payload?.[name];
    },
  });
}

async function handleModelList(request, fetchImpl) {
  let hasApiKey = false;
  try {
    const formData = await request.formData();
    const config = normalizePrivateConfig(formData, { allowDirectImageRoute: true });
    const generationConfig = getSelectedImageGenerationConfig(config);
    hasApiKey = Boolean(generationConfig.apiKey);
    const models = await fetchAvailableModels({
      baseUrl: generationConfig.baseUrl,
      apiKey: generationConfig.apiKey,
      fetchImpl,
    });
    return jsonResponse({ ok: true, models });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }, hasApiKey ? 502 : 400);
  }
}

function firstConfigString(values, fallback = "") {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return fallback;
}

function buildCloudCreationListingConfig(payload = {}, env = {}) {
  const nestedConfig = payload.config && typeof payload.config === "object" ? payload.config : {};
  return {
    baseUrl: normalizeApiBaseUrl(
      firstConfigString(
        [
          payload.baseUrl,
          nestedConfig.baseUrl,
          env.baseUrl,
          env.OPENAI_BASE_URL,
          env.IMAGE_STUDIO_BASE_URL,
        ],
        DEFAULT_CONFIG.baseUrl,
      ),
      { defaultBaseUrl: DEFAULT_CONFIG.baseUrl },
    ),
    apiKey: firstConfigString([
      payload.apiKey,
      nestedConfig.apiKey,
      env.apiKey,
      env.OPENAI_API_KEY,
      env.IMAGE_STUDIO_API_KEY,
    ]),
    responsesModel: firstConfigString(
      [
        payload.responsesModel,
        nestedConfig.responsesModel,
        env.responsesModel,
        env.RESPONSES_MODEL,
        env.IMAGE_STUDIO_RESPONSES_MODEL,
      ],
      DEFAULT_CONFIG.responsesModel,
    ),
    reasoningEffort: normalizeReasoningEffort(firstConfigString(
      [
        payload.reasoningEffort,
        nestedConfig.reasoningEffort,
        env.reasoningEffort,
        env.REASONING_EFFORT,
        env.IMAGE_STUDIO_REASONING_EFFORT,
      ],
      DEFAULT_CREATION_LISTING_REASONING_EFFORT,
    )),
  };
}

function getFileExtension(filename) {
  const match = String(filename || "").toLowerCase().match(/(\.[^.\\/]+)$/);
  return match ? match[1] : "";
}

async function toPptSourceDocuments(files) {
  const validFiles = files.filter(
    (file) =>
      file &&
      typeof file === "object" &&
      typeof file.arrayBuffer === "function" &&
      Number(file.size || 0) > 0,
  );

  return Promise.all(
    validFiles.map(async (file, index) => {
      const filename = String(file.name || `source-${index + 1}`).trim();
      if (!PPT_SOURCE_EXTENSIONS.has(getFileExtension(filename))) {
        throw new Error("PPT source files support PDF, DOCX, PPTX, TXT, MD, and CSV.");
      }

      return {
        filename,
        mimeType: file.type || "application/octet-stream",
        base64: normalizeBase64(arrayBufferToBase64(await file.arrayBuffer())),
      };
    }),
  );
}

function buildCloudPptSlideFilename(deckId, slideNumber) {
  const safeDeckId = String(deckId || "deck").replace(/[^a-zA-Z0-9-]/g, "").slice(-12) || "deck";
  return `cloudflare-${safeDeckId}-slide-${slideNumber}.${PPT_SLIDE_FORMAT}`;
}

function makeImageDataUrl(base64, format = PPT_SLIDE_FORMAT) {
  return `data:${toOutputFormatMimeType(format)};base64,${normalizeBase64(base64)}`;
}

async function generateCloudflarePptSlide({
  writer,
  slidePrompt,
  outline,
  deckId,
  config,
  reasoningEffort,
  referenceImages = [],
  fetchImpl,
}) {
  await writeSseEvent(writer, "slide_started", {
    slideNumber: slidePrompt.slideNumber,
    title: slidePrompt.title,
  });

  let finalBase64 = "";
  const generationConfig = getSelectedImageGenerationConfig(config);
  await requestCloudImageGeneration({
    baseUrl: generationConfig.baseUrl,
    apiKey: generationConfig.apiKey,
    prompt: slidePrompt.prompt,
    referenceImages,
    size: PPT_SLIDE_SIZE,
    quality: config.defaults?.quality || "high",
    format: toApiOutputFormat(PPT_SLIDE_FORMAT),
    responsesModel: config.responsesModel,
    imageRoute: generationConfig.imageRoute,
    imageModel: generationConfig.imageModel,
    reasoningEffort,
    statusHeartbeatMs: UPSTREAM_STATUS_HEARTBEAT_MS,
    fetchImpl,
    async onEvent(event) {
      if (event.type === "partial_image") {
        await writeSseEvent(writer, "partial_image", {
          slideNumber: slidePrompt.slideNumber,
          dataUrl: event.dataUrl,
        });
        return;
      }

      if (event.type === "final_image") {
        finalBase64 = event.base64;
      }
    },
  });

  if (!finalBase64) {
    const error = new Error("Upstream response ended without a final PPT slide image.");
    error.slideNumber = slidePrompt.slideNumber;
    throw error;
  }

  const filename = buildCloudPptSlideFilename(deckId, slidePrompt.slideNumber);
  const imageUrl = makeImageDataUrl(finalBase64);
  return {
    slideNumber: slidePrompt.slideNumber,
    title: slidePrompt.title,
    filename,
    relativePath: `cloudflare/${deckId}/${filename}`,
    imageUrl,
    thumbnailUrl: imageUrl,
    prompt: slidePrompt.promptSummary || slidePrompt.prompt,
  };
}

function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function dataUrlToBytes(dataUrl) {
  const match = String(dataUrl || "").match(/^data:[^;]+;base64,([A-Za-z0-9+/=\s]+)$/);
  if (!match) {
    throw new Error("PPT slide images must be browser-local data URLs on Cloudflare.");
  }

  const binary = atob(normalizeBase64(match[1]));
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function bytesToBase64(bytes) {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
}

const CRC32_TABLE = Array.from({ length: 256 }, (_value, index) => {
  let crc = index;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

function crc32(bytes) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc = CRC32_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function concatBytes(parts) {
  const total = parts.reduce((sum, part) => sum + part.length, 0);
  const output = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function uint16(value) {
  const bytes = new Uint8Array(2);
  new DataView(bytes.buffer).setUint16(0, value, true);
  return bytes;
}

function uint32(value) {
  const bytes = new Uint8Array(4);
  new DataView(bytes.buffer).setUint32(0, value >>> 0, true);
  return bytes;
}

function createZip(entries) {
  const encoder = new TextEncoder();
  const localParts = [];
  const centralParts = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name);
    const dataBytes = typeof entry.data === "string" ? encoder.encode(entry.data) : entry.data;
    const crc = crc32(dataBytes);
    const localHeader = concatBytes([
      uint32(0x04034b50),
      uint16(20),
      uint16(0),
      uint16(0),
      uint16(0),
      uint16(0),
      uint32(crc),
      uint32(dataBytes.length),
      uint32(dataBytes.length),
      uint16(nameBytes.length),
      uint16(0),
      nameBytes,
    ]);
    localParts.push(localHeader, dataBytes);

    centralParts.push(
      concatBytes([
        uint32(0x02014b50),
        uint16(20),
        uint16(20),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(crc),
        uint32(dataBytes.length),
        uint32(dataBytes.length),
        uint16(nameBytes.length),
        uint16(0),
        uint16(0),
        uint16(0),
        uint16(0),
        uint32(0),
        uint32(offset),
        nameBytes,
      ]),
    );
    offset += localHeader.length + dataBytes.length;
  }

  const centralDirectory = concatBytes(centralParts);
  const localFiles = concatBytes(localParts);
  const endRecord = concatBytes([
    uint32(0x06054b50),
    uint16(0),
    uint16(0),
    uint16(entries.length),
    uint16(entries.length),
    uint32(centralDirectory.length),
    uint32(localFiles.length),
    uint16(0),
  ]);
  return concatBytes([localFiles, centralDirectory, endRecord]);
}

function makePptxSlideXml(slideNumber, title) {
  const safeTitle = xmlEscape(title || `Slide ${slideNumber}`);
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr><p:pic><p:nvPicPr><p:cNvPr id="2" name="${safeTitle}"/><p:cNvPicPr><a:picLocks noChangeAspect="1"/></p:cNvPicPr><p:nvPr/></p:nvPicPr><p:blipFill><a:blip r:embed="rId1"/><a:stretch><a:fillRect/></a:stretch></p:blipFill><p:spPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="12192000" cy="6858000"/></a:xfrm><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></p:spPr></p:pic></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sld>`;
}

function createPptxBase64({ title, slides }) {
  const sortedSlides = [...slides].sort((left, right) => Number(left.slideNumber) - Number(right.slideNumber));
  const slideOverrides = sortedSlides
    .map((slide) => `<Override PartName="/ppt/slides/slide${slide.slideNumber}.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slide+xml"/>`)
    .join("");
  const slideIds = sortedSlides
    .map((slide, index) => `<p:sldId id="${256 + index}" r:id="rId${index + 2}"/>`)
    .join("");
  const presentationRels = [
    '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="slideMasters/slideMaster1.xml"/>',
    ...sortedSlides.map((slide, index) => `<Relationship Id="rId${index + 2}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" Target="slides/slide${slide.slideNumber}.xml"/>`),
  ].join("");
  const entries = [
    {
      name: "[Content_Types].xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Default Extension="png" ContentType="image/png"/><Override PartName="/ppt/presentation.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml"/><Override PartName="/ppt/slideMasters/slideMaster1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml"/><Override PartName="/ppt/slideLayouts/slideLayout1.xml" ContentType="application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml"/><Override PartName="/ppt/theme/theme1.xml" ContentType="application/vnd.openxmlformats-officedocument.theme+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>${slideOverrides}</Types>`,
    },
    {
      name: "_rels/.rels",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="ppt/presentation.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>',
    },
    {
      name: "docProps/core.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>${xmlEscape(title)}</dc:title><dc:creator>Image Studio</dc:creator><cp:lastModifiedBy>Image Studio</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${new Date().toISOString()}</dcterms:modified></cp:coreProperties>`,
    },
    {
      name: "docProps/app.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Image Studio</Application><PresentationFormat>On-screen Show (16:9)</PresentationFormat><Slides>${sortedSlides.length}</Slides></Properties>`,
    },
    {
      name: "ppt/presentation.xml",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:presentation xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:sldMasterIdLst><p:sldMasterId id="2147483648" r:id="rId1"/></p:sldMasterIdLst><p:sldIdLst>${slideIds}</p:sldIdLst><p:sldSz cx="12192000" cy="6858000" type="wide"/><p:notesSz cx="6858000" cy="9144000"/><p:defaultTextStyle><a:defPPr><a:defRPr lang="zh-CN"/></a:defPPr></p:defaultTextStyle></p:presentation>`,
    },
    {
      name: "ppt/_rels/presentation.xml.rels",
      data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${presentationRels}</Relationships>`,
    },
    {
      name: "ppt/slideMasters/slideMaster1.xml",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldMaster xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main"><p:cSld><p:bg><p:bgPr><a:solidFill><a:srgbClr val="0B1020"/></a:solidFill></p:bgPr></p:bg><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMap bg1="lt1" tx1="dk1" bg2="lt2" tx2="dk2" accent1="accent1" accent2="accent2" accent3="accent3" accent4="accent4" accent5="accent5" accent6="accent6" hlink="hlink" folHlink="folHlink"/><p:sldLayoutIdLst><p:sldLayoutId id="2147483649" r:id="rId1"/></p:sldLayoutIdLst><p:txStyles><p:titleStyle/><p:bodyStyle/><p:otherStyle/></p:txStyles></p:sldMaster>',
    },
    {
      name: "ppt/slideMasters/_rels/slideMaster1.xml.rels",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme" Target="../theme/theme1.xml"/></Relationships>',
    },
    {
      name: "ppt/slideLayouts/slideLayout1.xml",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" type="blank" preserve="1"><p:cSld name="Blank"><p:spTree><p:nvGrpSpPr><p:cNvPr id="1" name=""/><p:cNvGrpSpPr/><p:nvPr/></p:nvGrpSpPr><p:grpSpPr><a:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/><a:chOff x="0" y="0"/><a:chExt cx="0" cy="0"/></a:xfrm></p:grpSpPr></p:spTree></p:cSld><p:clrMapOvr><a:masterClrMapping/></p:clrMapOvr></p:sldLayout>',
    },
    {
      name: "ppt/slideLayouts/_rels/slideLayout1.xml.rels",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" Target="../slideMasters/slideMaster1.xml"/></Relationships>',
    },
    {
      name: "ppt/theme/theme1.xml",
      data: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Image Studio"><a:themeElements><a:clrScheme name="Image Studio"><a:dk1><a:srgbClr val="0B1020"/></a:dk1><a:lt1><a:srgbClr val="FFFFFF"/></a:lt1><a:dk2><a:srgbClr val="1F2937"/></a:dk2><a:lt2><a:srgbClr val="F8FAFC"/></a:lt2><a:accent1><a:srgbClr val="2563EB"/></a:accent1><a:accent2><a:srgbClr val="0F766E"/></a:accent2><a:accent3><a:srgbClr val="B45309"/></a:accent3><a:accent4><a:srgbClr val="7C3AED"/></a:accent4><a:accent5><a:srgbClr val="DC2626"/></a:accent5><a:accent6><a:srgbClr val="475569"/></a:accent6><a:hlink><a:srgbClr val="2563EB"/></a:hlink><a:folHlink><a:srgbClr val="7C3AED"/></a:folHlink></a:clrScheme><a:fontScheme name="Image Studio"><a:majorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:majorFont><a:minorFont><a:latin typeface="Arial"/><a:ea typeface="Microsoft YaHei"/><a:cs typeface="Arial"/></a:minorFont></a:fontScheme><a:fmtScheme name="Image Studio"><a:fillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:fillStyleLst><a:lnStyleLst><a:ln w="6350"><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:ln></a:lnStyleLst><a:effectStyleLst><a:effectStyle><a:effectLst/></a:effectStyle></a:effectStyleLst><a:bgFillStyleLst><a:solidFill><a:schemeClr val="phClr"/></a:solidFill></a:bgFillStyleLst></a:fmtScheme></a:themeElements></a:theme>',
    },
  ];

  for (const slide of sortedSlides) {
    entries.push(
      {
        name: `ppt/slides/slide${slide.slideNumber}.xml`,
        data: makePptxSlideXml(slide.slideNumber, slide.title),
      },
      {
        name: `ppt/slides/_rels/slide${slide.slideNumber}.xml.rels`,
        data: `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/image${slide.slideNumber}.png"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout" Target="../slideLayouts/slideLayout1.xml"/></Relationships>`,
      },
      {
        name: `ppt/media/image${slide.slideNumber}.png`,
        data: dataUrlToBytes(slide.imageUrl || slide.thumbnailUrl),
      },
    );
  }

  return bytesToBase64(createZip(entries));
}

function buildCloudPptFilename({ deckId, title }) {
  const safeTitle = String(title || "PPT")
    .replace(/[<>:"/\\|?*\u0000-\u001f]/g, "")
    .replace(/\s+/g, "")
    .trim()
    .slice(0, 32) || "PPT";
  const suffix = String(deckId || "").slice(-8) || "deck";
  return `${safeTitle}-${suffix}.pptx`;
}

function buildCloudPptDeck({
  deckId,
  outline,
  slides,
  createdAt,
  sources = {},
  config,
  reasoningEffort,
  motion = {},
  exportMode = "flat-image",
}) {
  const sortedSlides = [...slides].sort((left, right) => Number(left.slideNumber) - Number(right.slideNumber));
  const pptxFilename = buildCloudPptFilename({ deckId, title: outline.title });
  const pptxBase64 = createPptxBase64({ title: outline.title, slides: sortedSlides });
  return {
    deckId,
    title: outline.title,
    pageCount: outline.slides.length,
    createdAt,
    sources,
    outline,
    slides: sortedSlides,
    pptxFilename,
    pptxMimeType: PPTX_MIME_TYPE,
    pptxUrl: `data:${PPTX_MIME_TYPE};base64,${pptxBase64}`,
    editablePptxUrl: "",
    editablePptxFilename: "",
    editablePptxWarnings: [],
    exportMode: normalizePptExportMode(exportMode),
    baseUrl: config.baseUrl,
    responsesModel: config.responsesModel,
    reasoningEffort,
    motion,
  };
}

async function enqueueGenerate(request, writer, { imageBucket, generationQueue } = {}) {
  await writeSseEvent(writer, "status", {
    stage: "uploading",
    message: "正在读取提交内容",
  });

  if (!imageBucket) {
    await writeSseEvent(writer, "error", { message: SERVER_IMAGE_BUCKET_MISSING_MESSAGE });
    return;
  }
  if (!generationQueue) {
    await writeSseEvent(writer, "error", { message: GENERATION_QUEUE_MISSING_MESSAGE });
    return;
  }

  const formData = await request.formData();
  let context;
  try {
    context = await buildGenerationRequestContext(request, formData);
  } catch (error) {
    await writeSseEvent(writer, "error", {
      message: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  const task = buildQueuedGenerationTask(context);
  const requestKey = buildGenerationRequestStorageKey({
    sessionId: context.sessionId,
    taskId: context.taskId,
    createdAt: context.createdAt,
  });
  await writeGenerationTask(imageBucket, context.sessionId, task);
  await writeJsonObject(imageBucket, requestKey, {
    task,
    sessionId: context.sessionId,
    taskId: context.taskId,
    prompt: context.prompt,
    config: context.config,
    generationConfig: context.generationConfig,
    generationMode: context.generationMode,
    styleTransferStylePreset: context.styleTransferStylePreset,
    assetKind: context.assetKind,
    quickBlendPairIndex: context.quickBlendPairIndex,
    quickBlendAImageName: context.quickBlendAImageName,
    quickBlendBImageName: context.quickBlendBImageName,
    quickBlendCImageName: context.quickBlendCImageName,
    quickBlendDImageName: context.quickBlendDImageName,
    quickBlendLayoutOrder: context.quickBlendLayoutOrder,
    quickBlendPlacementShape: context.quickBlendPlacementShape,
    targetLanguage: context.targetLanguage,
    sourceImageName: context.sourceImageName,
    featureCardsEnabled: context.featureCardsEnabled,
    referenceImages: context.referenceImages,
    reasoningEffort: context.reasoningEffort,
    ratio: context.ratioOption.value,
    finalPrompt: context.finalPrompt,
    finalSize: context.finalSize,
    finalQuality: context.finalQuality,
    finalFormat: context.finalFormat,
    createdAt: context.createdAt,
  });
  await generationQueue.send({
    requestKey,
    sessionId: context.sessionId,
    taskId: context.taskId,
  });

  await writeSseEvent(writer, "status", {
    stage: "queued",
    message: task.statusText,
  });
  await writeSseEvent(writer, "queued", {
    task: toPublicGenerationTask(task),
  });
}

async function runGenerate(request, writer, { fetchImpl, imageBucket } = {}) {
  await writeSseEvent(writer, "status", {
    stage: "uploading",
    message: "正在读取提交内容",
  });

  const formData = await request.formData();
  const taskId = String(formData.get("jobId") || crypto.randomUUID()).trim();
  let prompt = String(formData.get("prompt") || "").trim();
  const ratio = String(formData.get("ratio") || "4:5");
  const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
  const requestedFormatInput = String(formData.get("format") || "").trim().toLowerCase();
  const generationMode = normalizeGenerationMode(formData.get("mode"));
  const isImageDecomposition = generationMode === IMAGE_DECOMPOSITION_MODE;
  const isQuickBlend = generationMode === QUICK_BLEND_MODE;
  const targetLanguageInput = String(formData.get("targetLanguage") || "").trim();
  const customTargetLanguageInput = String(formData.get("customTargetLanguage") || "").trim();
  const featureCardsEnabled = normalizeImageDecompositionFeatureCards(formData.get("featureCardsEnabled"));
  const styleTransferStylePreset = String(formData.get("styleTransferStylePreset") || "").trim();
  let quickBlendPairIndex = String(formData.get("quickBlendPairIndex") || "1").trim();
  let quickBlendAImageName = String(formData.get("quickBlendAImageName") || formData.get("quickBlendAName") || "").trim();
  let quickBlendBImageName = String(formData.get("quickBlendBImageName") || formData.get("quickBlendBName") || "").trim();
  let quickBlendCImageName = String(formData.get("quickBlendCImageName") || formData.get("quickBlendCName") || "").trim();
  let quickBlendDImageName = String(formData.get("quickBlendDImageName") || formData.get("quickBlendDName") || "").trim();
  let quickBlendLayoutOrder = String(formData.get("quickBlendLayoutOrder") || "").trim();
  let quickBlendPlacementShape = String(formData.get("quickBlendPlacementShape") || "").trim();
  const config = normalizePrivateConfig(formData, { allowDirectImageRoute: true });
  const generationConfig = getSelectedImageGenerationConfig(config);
  const createdAt = new Date().toISOString();
  let targetLanguage = "";
  let sourceImageName = "";
  let assetKind = "";
  let filenameToken = "";

  if (!imageBucket) {
    await writeSseEvent(writer, "error", {
      message: SERVER_IMAGE_BUCKET_MISSING_MESSAGE,
    });
    return;
  }

  if (!prompt && !isImageDecomposition && !isQuickBlend) {
    await writeSseEvent(writer, "error", { message: "提示词不能为空。" });
    return;
  }

  const referenceImages = await toReferenceImages([
    ...formData.getAll("referenceImages"),
    ...formData.getAll("referenceImage"),
  ]);
  if (isQuickBlend && (referenceImages.length < 2 || referenceImages.length > 4)) {
    await writeSseEvent(writer, "error", {
      message: QUICK_BLEND_REFERENCE_COUNT_MESSAGE,
    });
    return;
  }
  if (referenceImages.length > MAX_REFERENCE_IMAGES) {
    await writeSseEvent(writer, "error", {
      message: `参考图最多支持 ${MAX_REFERENCE_IMAGES} 张。`,
    });
    return;
  }
  if (isImageDecomposition && referenceImages.length !== 1) {
    await writeSseEvent(writer, "error", {
      message: "图片拆解模式需要且只支持上传一张源图。",
    });
    return;
  }
  if (isImageDecomposition) {
    const decompositionPrompt = buildImageDecompositionPrompt({
      targetLanguage: targetLanguageInput,
      customLanguage: customTargetLanguageInput,
      featureCardsEnabled,
    });
    prompt = decompositionPrompt.prompt;
    targetLanguage = decompositionPrompt.targetLanguage;
    sourceImageName = referenceImages[0]?.filename || "";
    assetKind = IMAGE_DECOMPOSITION_ASSET_KIND;
  }
  if (isQuickBlend) {
    const inferredQuickBlendCImageName = quickBlendCImageName || (quickBlendDImageName ? "" : referenceImages[2]?.filename || "");
    const inferredQuickBlendDImageName = quickBlendDImageName || (referenceImages.length > 3 ? referenceImages[3]?.filename || "" : "");
    const quickBlendPrompt = buildQuickBlendPrompt({
      pairIndex: quickBlendPairIndex,
      aImageName: quickBlendAImageName || referenceImages[0]?.filename || "",
      bImageName: quickBlendBImageName || referenceImages[1]?.filename || "",
      cImageName: inferredQuickBlendCImageName,
      dImageName: inferredQuickBlendDImageName,
      layoutOrder: quickBlendLayoutOrder,
      placementShape: quickBlendPlacementShape,
    });
    prompt = quickBlendPrompt.prompt;
    assetKind = QUICK_BLEND_ASSET_KIND;
    quickBlendPairIndex = quickBlendPrompt.pairIndex;
    quickBlendAImageName = quickBlendPrompt.aImageName;
    quickBlendBImageName = quickBlendPrompt.bImageName;
    quickBlendCImageName = quickBlendPrompt.cImageName;
    quickBlendDImageName = quickBlendPrompt.dImageName;
    quickBlendLayoutOrder = quickBlendPrompt.layoutOrder;
    quickBlendPlacementShape = quickBlendPrompt.placementShape;
    filenameToken = buildQuickBlendFilenameToken({
      aImageName: quickBlendAImageName,
      bImageName: quickBlendBImageName,
      cImageName: quickBlendCImageName,
      dImageName: quickBlendDImageName,
    });
  }
  const hasStyleTransferPreset = Boolean(styleTransferStylePreset);
  if (generationMode === "style-transfer" && referenceImages.length < (hasStyleTransferPreset ? 1 : 2)) {
    await writeSseEvent(writer, "error", {
      message: "风格迁移需要上传原图和风格参考图。",
    });
    return;
  }

  const reasoningEffort = normalizeReasoningEffort(formData.get("reasoningEffort"));
  const ratioOption = resolveAspectRatioOption(ratio);
  const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
  if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
    throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
  }

  const finalPrompt = appendRatioHintToPrompt(prompt, ratioOption);
  const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
  const finalQuality = config.defaults.quality;
  const finalFormat = normalizeOutputFormat(requestedFormatInput || config.defaults.format);
  const finalImageFilename = buildCloudFilename({ taskId, createdAt, format: finalFormat, filenameToken });
  let finalBase64 = "";
  const generationStartedAt = new Date().toISOString();
  const generationStartedAtMs = Date.now();

  const generationResult = await requestCloudImageGeneration({
    baseUrl: generationConfig.baseUrl,
    apiKey: generationConfig.apiKey,
    prompt: finalPrompt,
    referenceImages,
    referenceImageLabels: getGenerationReferenceImageLabels(
      generationMode,
      styleTransferStylePreset,
      referenceImages,
      [quickBlendAImageName, quickBlendBImageName, quickBlendCImageName, quickBlendDImageName]
        .map((value, index) => (value ? ["A", "B", "C", "D"][index] : ""))
        .filter(Boolean),
    ),
    size: finalSize,
    quality: finalQuality,
    format: toApiOutputFormat(finalFormat),
    responsesModel: config.responsesModel,
    imageRoute: generationConfig.imageRoute,
    imageModel: generationConfig.imageModel,
    reasoningEffort,
    statusHeartbeatMs: UPSTREAM_STATUS_HEARTBEAT_MS,
    fetchImpl,
    async onEvent(event) {
      if (event.type === "status") {
        await writeSseEvent(writer, "status", {
          stage: event.stage,
          message: event.message,
        });
        return;
      }

      if (event.type === "partial_image") {
        await writeSseEvent(writer, "partial_image", {
          dataUrl: event.dataUrl,
        });
        return;
      }

      if (event.type === "final_image") {
        finalBase64 = event.base64;
        await writeSseEvent(writer, "status", {
          stage: "saving",
          message: "已拿到最终图，正在传回浏览器缓存",
        });
        await writeFinalImageChunks(writer, {
          filename: finalImageFilename,
          base64: event.base64,
          format: finalFormat,
        });
        await writeSseEvent(writer, "status", {
          stage: "saving",
          message: "最终图已传回浏览器，正在写入服务器暂存",
        });
      }
    },
  });
  const generationCompletedAt = new Date().toISOString();
  const generationDurationMs = Math.max(0, Date.now() - generationStartedAtMs);

  if (!finalBase64) {
    throw new Error("上游响应结束，但没有拿到最终图片。");
  }

  const savedSize = generationResult.effectiveSize || finalSize;
  const item = buildGalleryItem({
    taskId,
    createdAt,
    prompt,
    dataUrl: "",
    config,
    generationConfig,
    ratioOption,
    size: savedSize,
    quality: finalQuality,
    format: finalFormat,
    referenceImages,
    reasoningEffort,
    generationMode,
    assetKind,
    quickBlendPairIndex,
    quickBlendAImageName,
    quickBlendBImageName,
    quickBlendCImageName,
    quickBlendDImageName,
    quickBlendLayoutOrder,
    quickBlendPlacementShape,
    filenameToken,
    targetLanguage,
    sourceImageName,
    featureCardsEnabled,
    generationStartedAt,
    generationCompletedAt,
    generationDurationMs,
  });
  await writeSseEvent(writer, GENERATION_STREAM_EVENTS.SAVED, {
    filename: item.filename,
    ratio: ratioOption.value,
    ratioLabel: ratioOption.label,
    size: savedSize,
    item,
  });

  // R2 is a best-effort server-side convenience; browser delivery has already completed.
  try {
    const storedImage = await storeFinalImage({
      imageBucket,
      filename: item.filename,
      createdAt,
      format: finalFormat,
      base64: finalBase64,
      item,
    });
    item.imageUrl = storedImage.imageUrl;
    item.thumbnailUrl = storedImage.imageUrl;
    item.storageKey = storedImage.storageKey;
    item.expiresAt = storedImage.expiresAt;
    await writeSseEvent(writer, GENERATION_STREAM_EVENTS.SERVER_IMAGE, {
      filename: item.filename,
      item,
    });
  } catch (error) {
    console.warn("store generated image in R2 failed", error instanceof Error ? error.message : String(error));
  }

  await writeSseEvent(writer, GENERATION_STREAM_EVENTS.COMPLETE, {
    filename: item.filename,
  });
}

function getCloudCreationSetStatus(items) {
  if (!items.length) {
    return "failed";
  }

  const completedCount = items.filter((item) => item.status === "completed").length;
  const failedCount = items.filter((item) => item.status === "failed").length;

  if (completedCount === items.length) {
    return "completed";
  }
  if (failedCount === items.length) {
    return "failed";
  }
  if (failedCount > 0) {
    return "partial_failed";
  }
  return "generating";
}

function buildCloudCreationSet({ setId, plan, createdAt, updatedAt, status, items, referenceImageNames = [] }) {
  return {
    setId,
    productName: plan.productName,
    productDescription: plan.productDescription,
    sellingPoints: plan.sellingPoints,
    dimensionSpecs: plan.dimensionSpecs,
    dimensionUnitMode: plan.dimensionUnitMode,
    dimensionUnitModeLabel: plan.dimensionUnitModeLabel,
    targetLanguage: plan.targetLanguage,
    targetLanguageLabel: plan.targetLanguageLabel,
    imageCount: plan.imageCount,
    scenario: plan.scenario,
    scenarioLabel: plan.scenarioLabel,
    visualLanguage: plan.visualLanguage,
    visualLanguageLabel: plan.visualLanguageLabel,
    industryTemplate: plan.industryTemplate,
    industryTemplateLabel: plan.industryTemplateLabel,
    industryTemplatePath: plan.industryTemplatePath,
    selectedRoles: plan.selectedRoles,
    referenceImageNames,
    referenceImageRoles: plan.referenceImageRoles || [],
    skuSubjects: plan.skuSubjects || [],
    skuBundleCount: plan.skuBundleCount || 1,
    skuGenerationRule: plan.skuGenerationRule || "none",
    skuGenerationRuleLabel: plan.skuGenerationRuleLabel || "无",
    logo: plan.logo || null,
    createdAt,
    updatedAt: updatedAt || createdAt,
    status,
    relativeDir: "",
    items,
  };
}

function buildCloudCreationFilename({ setId, item, createdAt, format }) {
  const filenameTokenSource =
    item.role === "sku" ? item.filenameToken || item.title : item.title || item.filenameToken;
  const filenameToken = sanitizeCreationFilenameToken(filenameTokenSource || item.role || item.itemId, "creation");
  const cloudFilename = buildCloudFilename({
    taskId: `${setId}-${item.slotIndex || item.itemId}`,
    createdAt,
    format,
  });
  return `${String(item.slotIndex).padStart(2, "0")}-${filenameToken}-${cloudFilename}`;
}

function parseJsonObject(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return {};
  }
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
  } catch {
    return {};
  }
}

function buildPortraitPlanFromFormData(formData) {
  return buildPortraitPlan({
    subjectName: formData.get("subjectName"),
    subjectSummary: formData.get("subjectSummary"),
    visibleProfile: parseJsonObject(formData.get("analysis") || formData.get("visibleProfile")),
    imageCount: formData.get("imageCount"),
    selectedStyles: formData.get("selectedStyles"),
    selectedShotTypes: formData.get("selectedShotTypes"),
    selectedActions: formData.get("selectedActions"),
    customStyle: formData.get("customStyle"),
    notes: formData.get("notes") || formData.get("photographyNotes"),
    locationSelection: formData.get("portraitLocationSelection") || formData.get("locationSelection"),
    locationPrompt: formData.get("portraitLocationPrompt") || formData.get("locationPrompt"),
    ratio: formData.get("ratio"),
    size: formData.get("size"),
    format: formData.get("format"),
    promptOverrides: formData.get("promptOverrides") || formData.get("planOverrides"),
  });
}

function buildCreationPlanFromFormData(formData) {
  const referenceImageRoles = normalizeCreationReferenceRoles(formData.get("referenceImageRoles"));
  let plan = buildCreationPlan({
    productName: formData.get("productName"),
    productDescription: formData.get("productDescription"),
    sellingPoints: formData.get("sellingPoints"),
    dimensionSpecs: formData.get("dimensionSpecs"),
    dimensionUnitMode: formData.get("dimensionUnitMode"),
    targetLanguage: formData.get("targetLanguage"),
    imageCount: formData.get("imageCount"),
    scenario: formData.get("scenario"),
    visualLanguage: formData.get("visualLanguage"),
    industryTemplate: formData.get("industryTemplate"),
    selectedRoles: formData.get("selectedRoles"),
    referenceImageRoles,
    skuSubjects: formData.get("skuSubjects"),
    skuBundleCount: formData.get("skuBundleCount"),
    skuGenerationRule: formData.get("skuGenerationRule"),
    logoOptions: buildCreationLogoOptionsFromFormData(formData),
  });
  plan = applyCreationPlanOverrides(plan, formData.get("planOverrides"));
  return plan;
}

async function handleCreationReferenceAnalyze(request, fetchImpl) {
  const formData = await request.formData();
  const referenceImages = await toReferenceImages([
    ...formData.getAll("referenceImages"),
    ...formData.getAll("referenceImage"),
  ]);

  if (referenceImages.length === 0) {
    return jsonResponse({ message: "请先上传套图参考图。" }, 400);
  }
  if (referenceImages.length > MAX_CREATION_REFERENCE_IMAGES) {
    return jsonResponse({ message: `参考图最多支持 ${MAX_CREATION_REFERENCE_IMAGES} 张。` }, 400);
  }
  if (referenceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    return jsonResponse({ message: "仅支持图片参考文件。" }, 400);
  }

  const config = normalizePrivateConfig(formData);
  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || CREATION_REFERENCE_ANALYSIS_REASONING_EFFORT,
  );
  const analysis = await requestPromptAgentAnalysis({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    image: referenceImages[0],
    images: referenceImages,
    mode: CREATION_REFERENCE_ANALYSIS_MODE,
    responsesModel: config.responsesModel,
    reasoningEffort,
    fetchImpl,
  });

  return jsonResponse({ ok: true, analysis });
}

async function handleCreationPlan(request) {
  try {
    const formData = await request.formData();
    return jsonResponse({
      ok: true,
      plan: buildCreationPlanFromFormData(formData),
    });
  } catch (error) {
    return jsonResponse({ message: error instanceof Error ? error.message : String(error) }, 400);
  }
}

async function handlePortraitReferenceAnalyze(request, fetchImpl) {
  const formData = await request.formData();
  const personReferenceImages = await toReferenceImages([
    ...formData.getAll("portraitReferenceImages"),
    ...formData.getAll("referenceImages"),
    ...formData.getAll("referenceImage"),
  ]);
  const accessoryReferenceImages = await toReferenceImages([
    ...formData.getAll("portraitAccessoryReferenceImages"),
  ]);
  const actionReferenceImages = await toReferenceImages([
    ...formData.getAll("portraitActionReferenceImages"),
  ]);

  if (personReferenceImages.length === 0) {
    return jsonResponse({ message: "请先上传人物参考图。" }, 400);
  }
  if (personReferenceImages.length > MAX_PORTRAIT_PERSON_REFERENCE_IMAGES) {
    return jsonResponse({ message: `人物参考图最多支持 ${MAX_PORTRAIT_PERSON_REFERENCE_IMAGES} 张。` }, 400);
  }
  if (accessoryReferenceImages.length > MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES) {
    return jsonResponse({ message: `服装道具配饰参考图最多支持 ${MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES} 张。` }, 400);
  }
  if (actionReferenceImages.length > MAX_PORTRAIT_ACTION_REFERENCE_IMAGES) {
    return jsonResponse({ message: `动作参考图最多支持 ${MAX_PORTRAIT_ACTION_REFERENCE_IMAGES} 张。` }, 400);
  }

  const referenceImages = [...personReferenceImages, ...actionReferenceImages, ...accessoryReferenceImages];
  const referenceImageLabels = buildPortraitReferenceImageLabels(
    personReferenceImages,
    actionReferenceImages,
    accessoryReferenceImages,
  );

  if (referenceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    return jsonResponse({ message: "仅支持图片文件。" }, 400);
  }

  const config = normalizePrivateConfig(formData);
  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || PORTRAIT_REFERENCE_ANALYSIS_REASONING_EFFORT,
  );
  const analysis = await requestPromptAgentAnalysis({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    image: personReferenceImages[0],
    images: referenceImages,
    imageLabels: referenceImageLabels,
    mode: PORTRAIT_REFERENCE_ANALYSIS_MODE,
    responsesModel: config.responsesModel,
    reasoningEffort,
    fetchImpl,
  });

  return jsonResponse({ ok: true, analysis });
}

async function handlePortraitPlan(request) {
  try {
    const formData = await request.formData();
    let plan = buildPortraitPlanFromFormData(formData);
    plan = applyPortraitPlanOverrides(plan, formData.get("planOverrides"));
    return jsonResponse({ ok: true, plan });
  } catch (error) {
    return jsonResponse({ message: error instanceof Error ? error.message : String(error) }, 400);
  }
}

function buildCloudPortraitSet({ setId, plan, createdAt, updatedAt, status, items, referenceImageNames = [] }) {
  return {
    setId,
    subjectName: plan.subjectName,
    subjectSummary: plan.subjectSummary,
    analysis: plan.visibleProfile,
    locationSelection: plan.locationSelection,
    locationName: plan.locationName,
    locationPrompt: plan.locationPrompt,
    selectedStyles: plan.selectedStyles,
    selectedShotTypes: plan.selectedShotTypes,
    selectedActions: plan.selectedActions,
    customStyle: plan.customStyle,
    notes: plan.notes,
    ratio: plan.ratio,
    size: plan.size,
    format: plan.format,
    imageCount: plan.imageCount,
    referenceImageNames,
    createdAt,
    updatedAt: updatedAt || createdAt,
    status,
    relativeDir: "",
    items,
  };
}

function buildCloudPortraitFilename({ setId, item, createdAt, format }) {
  const filenameToken = sanitizeCreationFilenameToken(item.shotType || item.style || item.itemId, "portrait");
  const cloudFilename = buildCloudFilename({
    taskId: `${setId}-${item.slotIndex || item.itemId}`,
    createdAt,
    format,
  });
  return `${String(item.slotIndex).padStart(3, "0")}-${filenameToken}-${cloudFilename}`;
}

async function runCreationGenerate(request, writer, { fetchImpl, imageBucket } = {}) {
  if (!imageBucket) {
    await writeSseEvent(writer, "error", { message: SERVER_IMAGE_BUCKET_MISSING_MESSAGE });
    return;
  }

  const formData = await request.formData();
  const setId = `creation-set-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const referenceImages = await toReferenceImages([
    ...formData.getAll("referenceImages"),
    ...formData.getAll("referenceImage"),
  ]);
  const styleReferenceImages = await toReferenceImages([
    ...formData.getAll("styleReferenceImages"),
    ...formData.getAll("styleReferenceImage"),
  ]);
  const logoImage = await readCreationLogoImage(formData);
  if (referenceImages.length > MAX_CREATION_REFERENCE_IMAGES) {
    throw new Error(`参考图最多支持 ${MAX_CREATION_REFERENCE_IMAGES} 张。`);
  }
  if (referenceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    throw new Error("仅支持图片参考文件。");
  }
  if (styleReferenceImages.length > MAX_CREATION_STYLE_REFERENCE_IMAGES) {
    throw new Error(`参考风格图最多支持 ${MAX_CREATION_STYLE_REFERENCE_IMAGES} 张。`);
  }
  if (referenceImages.length + styleReferenceImages.length > MAX_CREATION_REFERENCE_IMAGES) {
    throw new Error(`套图参考图和参考风格图合计最多支持 ${MAX_CREATION_REFERENCE_IMAGES} 张。`);
  }
  if (styleReferenceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    throw new Error("仅支持图片参考风格文件。");
  }
  const referenceImageNames = referenceImages.map((image) => image.filename).filter(Boolean);
  const referenceImageRoles = normalizeCreationReferenceRoles(formData.get("referenceImageRoles"));
  let plan = buildCreationPlan({
    productName: formData.get("productName"),
    productDescription: formData.get("productDescription"),
    sellingPoints: formData.get("sellingPoints"),
    dimensionSpecs: formData.get("dimensionSpecs"),
    dimensionUnitMode: formData.get("dimensionUnitMode"),
    targetLanguage: formData.get("targetLanguage"),
    imageCount: formData.get("imageCount"),
    scenario: formData.get("scenario"),
    visualLanguage: formData.get("visualLanguage"),
    industryTemplate: formData.get("industryTemplate"),
    selectedRoles: formData.get("selectedRoles"),
    referenceImageRoles,
    skuSubjects: formData.get("skuSubjects"),
    skuBundleCount: formData.get("skuBundleCount"),
    skuGenerationRule: formData.get("skuGenerationRule"),
    logoOptions: buildCreationLogoOptionsFromFormData(formData, logoImage),
  });
  plan = applyCreationPlanOverrides(plan, formData.get("planOverrides"));
  const config = normalizePrivateConfig(formData, { allowDirectImageRoute: true });
  const generationConfig = getSelectedImageGenerationConfig(config);
  const ratioOption = resolveAspectRatioOption(String(formData.get("ratio") || "1:1"));
  const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
  const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
  if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
    throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
  }

  const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
  const finalQuality = config.defaults.quality;
  const finalFormat = normalizeOutputFormat(formData.get("format") || config.defaults.format);
  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
  );
  let items = plan.items.map((item) => ({
    ...item,
    status: "queued",
    filename: "",
    relativePath: "",
    imageUrl: "",
    thumbnailUrl: "",
    error: "",
  }));
  let set = buildCloudCreationSet({
    setId,
    plan,
    createdAt,
    status: "generating",
    items,
    referenceImageNames,
  });

  await writeSseEvent(writer, "set_started", { set });
  await writeSseEvent(writer, "plan", { setId, items });

  await runWithConcurrency(plan.items, MAX_PARALLEL_TASKS_PER_SESSION, async (item) => {
    const generationStartedAt = new Date().toISOString();
    const generationStartedAtMs = Date.now();
    let finalBase64 = "";

    try {
      items = items.map((entry) =>
        entry.itemId === item.itemId ? { ...entry, status: "generating", generationStartedAt } : entry,
      );
      await writeSseEvent(writer, "item_started", { setId, itemId: item.itemId, role: item.role });

      const itemReferenceImages = buildCreationItemReferenceImages(item, referenceImages, plan.referenceImageRoles);
      const itemGenerationReferenceImages = appendCreationStyleReferences(itemReferenceImages, styleReferenceImages);
      const itemGenerationReferenceImagesWithLogo = appendCreationLogoReference(itemGenerationReferenceImages, logoImage);
      const generationResult = await requestCloudImageGeneration({
        baseUrl: generationConfig.baseUrl,
        apiKey: generationConfig.apiKey,
        prompt: appendRatioHintToPrompt(item.prompt, ratioOption),
        referenceImages: itemGenerationReferenceImagesWithLogo,
        referenceImageLabels: buildCreationGenerationReferenceImageLabels(
          itemReferenceImages,
          plan.referenceImageRoles,
          styleReferenceImages,
        ),
        size: finalSize,
        quality: finalQuality,
        format: toApiOutputFormat(finalFormat),
        responsesModel: config.responsesModel,
        imageRoute: generationConfig.imageRoute,
        imageModel: generationConfig.imageModel,
        reasoningEffort,
        statusHeartbeatMs: UPSTREAM_STATUS_HEARTBEAT_MS,
        fetchImpl,
        async onEvent(event) {
          if (event.type === "status") {
            await writeSseEvent(writer, "item_status", {
              setId,
              itemId: item.itemId,
              stage: event.stage,
              message: event.message,
            });
            return;
          }

          if (event.type === "partial_image") {
            await writeSseEvent(writer, "item_partial_image", {
              setId,
              itemId: item.itemId,
              dataUrl: event.dataUrl,
            });
            return;
          }

          if (event.type === "final_image") {
            finalBase64 = event.base64;
            await writeSseEvent(writer, "item_final_image", {
              setId,
              itemId: item.itemId,
              dataUrl: makeImageDataUrl(event.base64, finalFormat),
            });
          }
        },
      });

      finalBase64 = finalBase64 || generationResult.finalImageBase64;
      if (!finalBase64) {
        throw new Error("上游响应结束，但没有拿到最终图片。");
      }

      const generationCompletedAt = new Date().toISOString();
      const generationDurationMs = Math.max(0, Date.now() - generationStartedAtMs);
      const savedSize = generationResult.effectiveSize || finalSize;
      const filename = buildCloudCreationFilename({ setId, item, createdAt, format: finalFormat });
      const storedImage = await storeFinalImage({
        imageBucket,
        filename,
        createdAt,
        format: finalFormat,
        base64: finalBase64,
      });

      items = items.map((entry) =>
        entry.itemId === item.itemId
          ? {
              ...entry,
              status: "completed",
              filename,
              imageUrl: storedImage.imageUrl,
              thumbnailUrl: storedImage.imageUrl,
              storageKey: storedImage.storageKey,
              expiresAt: storedImage.expiresAt,
              generationStartedAt,
              generationCompletedAt,
              generationDurationMs,
              size: savedSize,
              format: finalFormat,
            }
          : entry,
      );
      set = buildCloudCreationSet({
        setId,
        plan,
        createdAt,
        updatedAt: generationCompletedAt,
        status: getCloudCreationSetStatus(items),
        items,
        referenceImageNames,
      });
      await writeSseEvent(writer, "item_saved", {
        setId,
        item: set.items.find((entry) => entry.itemId === item.itemId),
        set,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      items = items.map((entry) =>
        entry.itemId === item.itemId ? { ...entry, status: "failed", error: message } : entry,
      );
      set = buildCloudCreationSet({
        setId,
        plan,
        createdAt,
        updatedAt: new Date().toISOString(),
        status: getCloudCreationSetStatus(items),
        items,
        referenceImageNames,
      });
      await writeSseEvent(writer, "item_failed", {
        setId,
        itemId: item.itemId,
        message,
        set,
      });
    }
  });

  await writeSseEvent(writer, "complete", {
    set: buildCloudCreationSet({
      setId,
      plan,
      createdAt,
      updatedAt: new Date().toISOString(),
      status: getCloudCreationSetStatus(items),
      items,
      referenceImageNames,
    }),
  });
}

async function runPortraitGenerate(request, writer, { fetchImpl, imageBucket } = {}) {
  if (!imageBucket) {
    await writeSseEvent(writer, "error", { message: SERVER_IMAGE_BUCKET_MISSING_MESSAGE });
    return;
  }

  const formData = await request.formData();
  const setId = `portrait-set-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const personReferenceImages = await toReferenceImages([
    ...formData.getAll("portraitReferenceImages"),
    ...formData.getAll("referenceImages"),
    ...formData.getAll("referenceImage"),
  ]);
  const accessoryReferenceImages = await toReferenceImages([
    ...formData.getAll("portraitAccessoryReferenceImages"),
  ]);
  const actionReferenceImages = await toReferenceImages([
    ...formData.getAll("portraitActionReferenceImages"),
  ]);
  if (personReferenceImages.length === 0) {
    throw new Error("请先上传人物参考图。");
  }
  if (personReferenceImages.length > MAX_PORTRAIT_PERSON_REFERENCE_IMAGES) {
    throw new Error(`人物参考图最多支持 ${MAX_PORTRAIT_PERSON_REFERENCE_IMAGES} 张。`);
  }
  if (accessoryReferenceImages.length > MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES) {
    throw new Error(`服装道具配饰参考图最多支持 ${MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES} 张。`);
  }
  if (actionReferenceImages.length > MAX_PORTRAIT_ACTION_REFERENCE_IMAGES) {
    throw new Error(`动作参考图最多支持 ${MAX_PORTRAIT_ACTION_REFERENCE_IMAGES} 张。`);
  }
  const referenceImages = [...personReferenceImages, ...actionReferenceImages, ...accessoryReferenceImages];
  const referenceImageLabels = buildPortraitReferenceImageLabels(personReferenceImages, actionReferenceImages, accessoryReferenceImages);
  if (referenceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    throw new Error("仅支持图片参考文件。");
  }
  const referenceImageNames = referenceImages.map((image) => image.filename).filter(Boolean);
  let plan = buildPortraitPlanFromFormData(formData);
  plan = applyPortraitPlanOverrides(plan, formData.get("planOverrides"));
  const config = normalizePrivateConfig(formData, { allowDirectImageRoute: true });
  const generationConfig = getSelectedImageGenerationConfig(config);
  const ratioOption = resolveAspectRatioOption(String(formData.get("ratio") || plan.ratio || "4:5"));
  const requestedSizeInput = String(formData.get("size") || plan.size || "auto").trim().toLowerCase();
  const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
  if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
    throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
  }

  const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
  const finalQuality = config.defaults.quality;
  const finalFormat = normalizeOutputFormat(formData.get("format") || plan.format || config.defaults.format);
  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
  );
  let items = plan.items.map((item) => ({
    ...item,
    status: "queued",
    filename: "",
    relativePath: "",
    imageUrl: "",
    thumbnailUrl: "",
    error: "",
  }));
  let set = buildCloudPortraitSet({
    setId,
    plan,
    createdAt,
    status: "generating",
    items,
    referenceImageNames,
  });

  await writeSseEvent(writer, "set_started", { set });
  await writeSseEvent(writer, "plan", { setId, items });

  await runWithConcurrency(plan.items, MAX_PARALLEL_TASKS_PER_SESSION, async (item) => {
    const generationStartedAt = new Date().toISOString();
    const generationStartedAtMs = Date.now();
    let finalBase64 = "";

    try {
      items = items.map((entry) =>
        entry.itemId === item.itemId ? { ...entry, status: "generating", generationStartedAt } : entry,
      );
      await writeSseEvent(writer, "item_started", { setId, itemId: item.itemId, shotType: item.shotType });

      const generationResult = await requestCloudImageGeneration({
        baseUrl: generationConfig.baseUrl,
        apiKey: generationConfig.apiKey,
        prompt: appendRatioHintToPrompt(item.prompt, ratioOption),
        referenceImages,
        referenceImageLabels,
        size: finalSize,
        quality: finalQuality,
        format: toApiOutputFormat(finalFormat),
        responsesModel: config.responsesModel,
        imageRoute: generationConfig.imageRoute,
        imageModel: generationConfig.imageModel,
        reasoningEffort,
        statusHeartbeatMs: UPSTREAM_STATUS_HEARTBEAT_MS,
        fetchImpl,
        async onEvent(event) {
          if (event.type === "status") {
            await writeSseEvent(writer, "item_status", {
              setId,
              itemId: item.itemId,
              stage: event.stage,
              message: event.message,
            });
            return;
          }

          if (event.type === "partial_image") {
            await writeSseEvent(writer, "item_partial_image", {
              setId,
              itemId: item.itemId,
              dataUrl: event.dataUrl,
            });
            return;
          }

          if (event.type === "final_image") {
            finalBase64 = event.base64;
            await writeSseEvent(writer, "item_final_image", {
              setId,
              itemId: item.itemId,
              dataUrl: makeImageDataUrl(event.base64, finalFormat),
            });
          }
        },
      });

      finalBase64 = finalBase64 || generationResult.finalImageBase64;
      if (!finalBase64) {
        throw new Error("上游响应结束，但没有拿到最终图片。");
      }

      const generationCompletedAt = new Date().toISOString();
      const generationDurationMs = Math.max(0, Date.now() - generationStartedAtMs);
      const savedSize = generationResult.effectiveSize || finalSize;
      const filename = buildCloudPortraitFilename({ setId, item, createdAt, format: finalFormat });
      const storedImage = await storeFinalImage({
        imageBucket,
        filename,
        createdAt,
        format: finalFormat,
        base64: finalBase64,
      });

      items = items.map((entry) =>
        entry.itemId === item.itemId
          ? {
              ...entry,
              status: "completed",
              filename,
              imageUrl: storedImage.imageUrl,
              thumbnailUrl: storedImage.imageUrl,
              storageKey: storedImage.storageKey,
              expiresAt: storedImage.expiresAt,
              generationStartedAt,
              generationCompletedAt,
              generationDurationMs,
              size: savedSize,
              format: finalFormat,
            }
          : entry,
      );
      set = buildCloudPortraitSet({
        setId,
        plan,
        createdAt,
        updatedAt: generationCompletedAt,
        status: getCloudCreationSetStatus(items),
        items,
        referenceImageNames,
      });
      await writeSseEvent(writer, "item_saved", {
        setId,
        item: set.items.find((entry) => entry.itemId === item.itemId),
        set,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      items = items.map((entry) =>
        entry.itemId === item.itemId ? { ...entry, status: "failed", error: message } : entry,
      );
      set = buildCloudPortraitSet({
        setId,
        plan,
        createdAt,
        updatedAt: new Date().toISOString(),
        status: getCloudCreationSetStatus(items),
        items,
        referenceImageNames,
      });
      await writeSseEvent(writer, "item_failed", { setId, itemId: item.itemId, message, set });
    }
  });

  await writeSseEvent(writer, "complete", {
    set: buildCloudPortraitSet({
      setId,
      plan,
      createdAt,
      updatedAt: new Date().toISOString(),
      status: getCloudCreationSetStatus(items),
      items,
      referenceImageNames,
    }),
  });
}

async function runCreationLogoBatchGenerate(request, writer, { fetchImpl, imageBucket } = {}) {
  if (!imageBucket) {
    await writeSseEvent(writer, "error", { message: SERVER_IMAGE_BUCKET_MISSING_MESSAGE });
    return;
  }

  const formData = await request.formData();
  const setId = `creation-set-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const sourceImages = await toReferenceImages([
    ...formData.getAll("sourceImages"),
    ...formData.getAll("logoBatchSourceImages"),
  ]);
  const logoImage = await readCreationLogoImage(formData);
  if (sourceImages.length === 0) {
    throw new Error("请先上传需要添加 Logo 的图片。");
  }
  if (sourceImages.length > MAX_REFERENCE_IMAGES) {
    throw new Error(`上传图加 Logo 最多支持 ${MAX_REFERENCE_IMAGES} 张。`);
  }
  if (sourceImages.some((image) => !String(image.mimeType || "").startsWith("image/"))) {
    throw new Error("上传图加 Logo 仅支持图片文件。");
  }
  if (!logoImage) {
    throw new Error("请先上传 Logo。");
  }

  const plan = buildCreationLogoBatchPlan({
    title: formData.get("title") || formData.get("productName"),
    sourceImages,
    logoOptions: buildCreationLogoOptionsFromFormData(formData, logoImage),
  });
  const referenceImageNames = plan.referenceImageNames || sourceImages.map((image) => image.filename).filter(Boolean);
  const config = normalizePrivateConfig(formData, { allowDirectImageRoute: true });
  const generationConfig = getSelectedImageGenerationConfig(config);
  const ratioOption = resolveAspectRatioOption(String(formData.get("ratio") || "1:1"));
  const requestedSizeInput = String(formData.get("size") || "auto").trim().toLowerCase();
  const requestedSize = normalizeGenerationSize(ratioOption.value, requestedSizeInput);
  if (requestedSize !== requestedSizeInput && requestedSizeInput !== "") {
    throw new Error(`当前比例 ${ratioOption.value} 不支持分辨率 ${requestedSizeInput}`);
  }

  const finalSize = requestedSize === "auto" ? getDefaultGenerationSize(ratioOption.value) : requestedSize;
  const finalQuality = config.defaults.quality;
  const finalFormat = normalizeOutputFormat(formData.get("format") || config.defaults.format);
  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
  );
  let items = plan.items.map((item) => ({
    ...item,
    status: "queued",
    filename: "",
    relativePath: "",
    imageUrl: "",
    thumbnailUrl: "",
    error: "",
  }));
  let set = buildCloudCreationSet({
    setId,
    plan,
    createdAt,
    status: "generating",
    items,
    referenceImageNames,
  });

  await writeSseEvent(writer, "set_started", { set });
  await writeSseEvent(writer, "plan", { setId, items });

  await runWithConcurrency(plan.items, MAX_PARALLEL_TASKS_PER_SESSION, async (item) => {
    const sourceImage = sourceImages[item.sourceImageIndex] || sourceImages[(item.slotIndex || 1) - 1];
    const generationStartedAt = new Date().toISOString();
    const generationStartedAtMs = Date.now();
    let finalBase64 = "";

    try {
      if (!sourceImage) {
        throw new Error("找不到对应的上传源图。");
      }

      items = items.map((entry) =>
        entry.itemId === item.itemId ? { ...entry, status: "generating", generationStartedAt } : entry,
      );
      await writeSseEvent(writer, "item_started", { setId, itemId: item.itemId, role: item.role });

      const generationResult = await requestCloudImageGeneration({
        baseUrl: generationConfig.baseUrl,
        apiKey: generationConfig.apiKey,
        prompt: appendRatioHintToPrompt(item.prompt, ratioOption),
        referenceImages: [sourceImage, logoImage],
        referenceImageLabels: CREATION_LOGO_BATCH_REFERENCE_LABELS,
        size: finalSize,
        quality: finalQuality,
        format: toApiOutputFormat(finalFormat),
        responsesModel: config.responsesModel,
        imageRoute: generationConfig.imageRoute,
        imageModel: generationConfig.imageModel,
        reasoningEffort,
        statusHeartbeatMs: UPSTREAM_STATUS_HEARTBEAT_MS,
        fetchImpl,
        async onEvent(event) {
          if (event.type === "status") {
            await writeSseEvent(writer, "item_status", {
              setId,
              itemId: item.itemId,
              stage: event.stage,
              message: event.message,
            });
            return;
          }

          if (event.type === "partial_image") {
            await writeSseEvent(writer, "item_partial_image", {
              setId,
              itemId: item.itemId,
              dataUrl: event.dataUrl,
            });
            return;
          }

          if (event.type === "final_image") {
            finalBase64 = event.base64;
            await writeSseEvent(writer, "item_final_image", {
              setId,
              itemId: item.itemId,
              dataUrl: makeImageDataUrl(event.base64, finalFormat),
            });
          }
        },
      });

      finalBase64 = finalBase64 || generationResult.finalImageBase64;
      if (!finalBase64) {
        throw new Error("上游响应结束，但没有拿到最终图片。");
      }

      const generationCompletedAt = new Date().toISOString();
      const generationDurationMs = Math.max(0, Date.now() - generationStartedAtMs);
      const savedSize = generationResult.effectiveSize || finalSize;
      const filename = buildCloudCreationFilename({ setId, item, createdAt, format: finalFormat });
      const storedImage = await storeFinalImage({
        imageBucket,
        filename,
        createdAt,
        format: finalFormat,
        base64: finalBase64,
      });

      items = items.map((entry) =>
        entry.itemId === item.itemId
          ? {
              ...entry,
              status: "completed",
              filename,
              imageUrl: storedImage.imageUrl,
              thumbnailUrl: storedImage.imageUrl,
              storageKey: storedImage.storageKey,
              expiresAt: storedImage.expiresAt,
              generationStartedAt,
              generationCompletedAt,
              generationDurationMs,
              size: savedSize,
              format: finalFormat,
            }
          : entry,
      );
      set = buildCloudCreationSet({
        setId,
        plan,
        createdAt,
        updatedAt: generationCompletedAt,
        status: getCloudCreationSetStatus(items),
        items,
        referenceImageNames,
      });
      await writeSseEvent(writer, "item_saved", {
        setId,
        item: set.items.find((entry) => entry.itemId === item.itemId),
        set,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      items = items.map((entry) =>
        entry.itemId === item.itemId ? { ...entry, status: "failed", error: message } : entry,
      );
      set = buildCloudCreationSet({
        setId,
        plan,
        createdAt,
        updatedAt: new Date().toISOString(),
        status: getCloudCreationSetStatus(items),
        items,
        referenceImageNames,
      });
      await writeSseEvent(writer, "item_failed", {
        setId,
        itemId: item.itemId,
        message,
        set,
      });
    }
  });

  await writeSseEvent(writer, "complete", {
    set: buildCloudCreationSet({
      setId,
      plan,
      createdAt,
      updatedAt: new Date().toISOString(),
      status: getCloudCreationSetStatus(items),
      items,
      referenceImageNames,
    }),
  });
}

function streamCreationLogoBatchGenerate(request, options = {}) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const work = async () => {
    try {
      await runCreationLogoBatchGenerate(request, writer, options);
    } catch (error) {
      await writeSseEvent(writer, "error", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await writer.close();
    }
  };

  work();
  return new Response(readable, {
    status: 200,
    headers: SSE_HEADERS,
  });
}

function streamCreationGenerate(request, options = {}) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const work = async () => {
    try {
      await runCreationGenerate(request, writer, options);
    } catch (error) {
      await writeSseEvent(writer, "error", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await writer.close();
    }
  };

  void work();

  return new Response(readable, {
    status: 200,
    headers: SSE_HEADERS,
  });
}

function streamPortraitGenerate(request, options = {}) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const work = async () => {
    try {
      await runPortraitGenerate(request, writer, options);
    } catch (error) {
      await writeSseEvent(writer, "error", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await writer.close();
    }
  };

  void work();

  return new Response(readable, {
    status: 200,
    headers: SSE_HEADERS,
  });
}

function streamGenerate(request, options = {}) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const work = async () => {
    try {
      if (options.generationQueue) {
        await enqueueGenerate(request, writer, options);
      } else {
        await runGenerate(request, writer, options);
      }
    } catch (error) {
      await writeSseEvent(writer, "error", {
        message: error instanceof Error ? error.message : String(error),
      });
    } finally {
      await writer.close();
    }
  };

  void work();

  return new Response(readable, {
    status: 200,
    headers: SSE_HEADERS,
  });
}

async function processQueuedGenerationMessage(messageBody, { imageBucket, fetchImpl = fetch } = {}) {
  const requestKey = String(messageBody?.requestKey || "");
  const sessionId = sanitizeStorageSegment(messageBody?.sessionId || "default", "default");
  const taskId = sanitizeStorageSegment(messageBody?.taskId || "", "task");
  if (!imageBucket || !requestKey || !taskId) {
    throw new Error("Queued generation message is missing required storage data.");
  }

  const storedRequest = await readJsonObject(imageBucket, requestKey);
  if (!storedRequest) {
    await patchGenerationTask(imageBucket, sessionId, taskId, {
      status: "error",
      statusStage: "missing_request",
      statusText: "服务器队列请求已过期，请重新生成",
      errorMessage: "Queued request payload not found.",
    });
    return;
  }

  const baseTask = storedRequest.task || { id: taskId, createdAt: storedRequest.createdAt };
  const generationConfig =
    storedRequest.generationConfig || getSelectedImageGenerationConfig(storedRequest.config || {});
  let finalBase64 = "";
  const generationStartedAt = new Date().toISOString();
  const generationStartedAtMs = Date.now();

  try {
    await patchGenerationTask(imageBucket, sessionId, taskId, {
      ...baseTask,
      status: "running",
      statusStage: "connecting",
      statusText: "后台 Worker 正在连接上游服务",
      generationStartedAt,
    });

    const generationResult = await requestCloudImageGeneration({
      baseUrl: generationConfig.baseUrl,
      apiKey: generationConfig.apiKey,
      prompt: storedRequest.finalPrompt,
      referenceImages: storedRequest.referenceImages || [],
      referenceImageLabels: getGenerationReferenceImageLabels(
        storedRequest.generationMode,
        storedRequest.styleTransferStylePreset,
        storedRequest.referenceImages || [],
        [
          storedRequest.quickBlendAImageName,
          storedRequest.quickBlendBImageName,
          storedRequest.quickBlendCImageName,
          storedRequest.quickBlendDImageName,
        ]
          .map((value, index) => (value ? ["A", "B", "C", "D"][index] : ""))
          .filter(Boolean),
      ),
      size: storedRequest.finalSize,
      quality: storedRequest.finalQuality,
      format: toApiOutputFormat(storedRequest.finalFormat),
      responsesModel: storedRequest.config.responsesModel,
      imageRoute: generationConfig.imageRoute,
      imageModel: generationConfig.imageModel,
      reasoningEffort: storedRequest.reasoningEffort,
      statusHeartbeatMs: UPSTREAM_STATUS_HEARTBEAT_MS,
      fetchImpl,
      async onEvent(event) {
        if (event.type === "status") {
          await patchGenerationTask(imageBucket, sessionId, taskId, {
            status: "running",
            statusStage: event.stage,
            statusText: event.message,
          });
          return;
        }

        if (event.type === "partial_image") {
          await patchGenerationTask(imageBucket, sessionId, taskId, {
            status: "running",
            statusStage: "partial_image",
            statusText: "已收到中途预览，继续等待最终图",
          });
          return;
        }

        if (event.type === "final_image") {
          finalBase64 = event.base64;
          await patchGenerationTask(imageBucket, sessionId, taskId, {
            status: "running",
            statusStage: "saving",
            statusText: "已拿到最终图，正在写入服务器暂存",
          });
        }
      },
    });

    if (!finalBase64) {
      throw new Error("上游响应结束，但没有拿到最终图片。");
    }

    const ratioOption = resolveAspectRatioOption(storedRequest.ratio);
    const generationCompletedAt = new Date().toISOString();
    const generationDurationMs = Math.max(0, Date.now() - generationStartedAtMs);
    const savedSize = generationResult.effectiveSize || storedRequest.finalSize;
    const item = buildGalleryItem({
      taskId,
      createdAt: storedRequest.createdAt,
      prompt: storedRequest.prompt,
      dataUrl: "",
      config: storedRequest.config,
      generationConfig,
      ratioOption,
      size: savedSize,
      quality: storedRequest.finalQuality,
      format: storedRequest.finalFormat,
      referenceImages: storedRequest.referenceImages || [],
      reasoningEffort: storedRequest.reasoningEffort,
      generationMode: storedRequest.generationMode,
      assetKind: storedRequest.assetKind,
      quickBlendPairIndex: storedRequest.quickBlendPairIndex,
      quickBlendAImageName: storedRequest.quickBlendAImageName,
      quickBlendBImageName: storedRequest.quickBlendBImageName,
      quickBlendCImageName: storedRequest.quickBlendCImageName,
      quickBlendDImageName: storedRequest.quickBlendDImageName,
      quickBlendLayoutOrder: storedRequest.quickBlendLayoutOrder,
      quickBlendPlacementShape: storedRequest.quickBlendPlacementShape,
      filenameToken: storedRequest.filenameToken,
      targetLanguage: storedRequest.targetLanguage,
      sourceImageName: storedRequest.sourceImageName,
      featureCardsEnabled: storedRequest.featureCardsEnabled,
      generationStartedAt,
      generationCompletedAt,
      generationDurationMs,
    });
    const storedImage = await storeFinalImage({
      imageBucket,
      filename: item.filename,
      createdAt: storedRequest.createdAt,
      format: storedRequest.finalFormat,
      base64: finalBase64,
      item,
    });
    item.imageUrl = storedImage.imageUrl;
    item.thumbnailUrl = storedImage.imageUrl;
    item.storageKey = storedImage.storageKey;
    item.expiresAt = storedImage.expiresAt;

    await patchGenerationTask(imageBucket, sessionId, taskId, {
      ...baseTask,
      status: "completed",
      statusStage: "completed",
      statusText: "图像已成功生成",
      size: savedSize,
      generationStartedAt,
      generationCompletedAt,
      generationDurationMs,
      item,
    });
  } catch (error) {
    await patchGenerationTask(imageBucket, sessionId, taskId, {
      ...baseTask,
      status: "error",
      statusStage: "error",
      statusText: "生成失败",
      errorMessage: error instanceof Error ? error.message : String(error),
    });
  } finally {
    try {
      await imageBucket.delete?.(requestKey);
    } catch (_error) {
      // The request payload is short-lived and also covered by the R2 lifecycle rule.
    }
  }
}

export async function handleGenerationQueue(batch, env, options = {}) {
  for (const message of batch.messages || []) {
    await processQueuedGenerationMessage(message.body, {
      imageBucket: env.IMAGE_BUCKET,
      fetchImpl: options.fetchImpl || fetch,
    });
    message.ack?.();
  }
}

async function runPptGenerate(request, writer, fetchImpl) {
  await writeSseEvent(writer, "status", { stage: "uploading", message: "Reading PPT input" });

  const formData = await request.formData();
  const config = normalizePrivateConfig(formData);
  const sourceDocuments = await toPptSourceDocuments([
    ...formData.getAll("sourceFiles"),
    ...formData.getAll("sourceFiles[]"),
  ]);
  const sourceText = String(formData.get("sourceText") || "").trim();
  const topic = String(formData.get("topic") || "").trim();
  const pageCount = Number.parseInt(String(formData.get("pageCount") || "0"), 10);
  const stylePreset = String(formData.get("stylePreset") || "").trim();
  const exportMode = normalizePptExportMode(formData.get("exportMode"));
  const motion = normalizePptMotionOptions({
    dynamicPreset: formData.get("dynamicPreset"),
    transitionPreset: formData.get("transitionPreset"),
    transitionSpeed: formData.get("transitionSpeed"),
    autoAdvanceSeconds: formData.get("autoAdvanceSeconds"),
  });
  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
  );
  const deckId = `ppt-deck-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();

  await writeSseEvent(writer, "status", { stage: "outline", message: "Generating PPT outline" });
  const outline = await generatePptDeckOutline({
    baseUrl: config.baseUrl,
    apiKey: config.apiKey,
    responsesModel: config.responsesModel,
    reasoningEffort,
    sourceDocuments,
    sourceText,
    topic,
    pageCount,
    stylePreset,
    fetchImpl,
  });

  await writeSseEvent(writer, "outline", { deckId, outline });

  const slidePrompts = buildSlideImagePrompts({
    outline,
    theme: stylePreset,
    dynamicPreset: motion.dynamicPreset,
  });
  const slides = [];
  for (const slidePrompt of slidePrompts) {
    try {
      const slide = await generateCloudflarePptSlide({
        writer,
        slidePrompt,
        outline,
        deckId,
        config,
        reasoningEffort,
        fetchImpl,
      });
      slides.push(slide);
      await writeSseEvent(writer, "slide_saved", { slide });
    } catch (error) {
      error.slideNumber ||= slidePrompt.slideNumber;
      throw error;
    }
  }

  const deck = buildCloudPptDeck({
    deckId,
    outline,
    slides,
    createdAt,
    sources: {
      filenames: sourceDocuments.map((file) => file.filename),
      hasSourceText: Boolean(sourceText),
      topic,
      stylePreset,
      exportMode,
      ...motion,
    },
    config,
    reasoningEffort,
    motion,
    exportMode,
  });

  if (isEditablePptExportMode(exportMode)) {
    await writeSseEvent(writer, "editable_reconstruction_warning", {
      message: "Editable PPT reconstruction is local-only and is not available in Cloudflare Worker.",
      exportMode,
    });
  }

  await writeSseEvent(writer, "deck_saved", { deck });
  await writeSseEvent(writer, "complete", { deck, missingSlideNumbers: [] });
}

async function handlePptAnalyze(request, fetchImpl) {
  try {
    const formData = await request.formData();
    const config = normalizePrivateConfig(formData);
    const sourceDocuments = await toPptSourceDocuments([
      ...formData.getAll("sourceFiles"),
      ...formData.getAll("sourceFiles[]"),
    ]);
    const sourceText = String(formData.get("sourceText") || "").trim();
    const topic = String(formData.get("topic") || "").trim();
    const currentPageCount = Number.parseInt(String(formData.get("pageCount") || "0"), 10);
    const currentStylePreset = String(formData.get("stylePreset") || "").trim();
    const reasoningEffort = normalizeReasoningEffort(
      formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
    );

    const analysis = await analyzePptDocument({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      responsesModel: config.responsesModel,
      reasoningEffort,
      sourceDocuments,
      sourceText,
      topic,
      currentPageCount,
      currentStylePreset,
      fetchImpl,
    });

    return jsonResponse({ ok: true, analysis });
  } catch (error) {
    return jsonResponse(
      {
        ok: false,
        message: error instanceof Error ? error.message : String(error),
      },
      400,
    );
  }
}

async function runPptComplete(request, writer, fetchImpl) {
  const payload = await request.json();
  const config = normalizePrivateConfigPayload(payload);
  const exportMode = normalizePptExportMode(payload.exportMode || payload.sources?.exportMode);
  const motion = normalizePptMotionOptions({
    dynamicPreset: payload.dynamicPreset,
    transitionPreset: payload.transitionPreset,
    transitionSpeed: payload.transitionSpeed,
    autoAdvanceSeconds: payload.autoAdvanceSeconds,
  });
  const completion = normalizePptCompletionRequest({
    deckId: payload.deckId,
    outline: payload.outline,
    existingSlides: payload.existingSlides,
    slideNumbers: payload.slideNumbers,
    theme: payload.stylePreset || payload.theme,
  });
  const reasoningEffort = normalizeReasoningEffort(
    payload.reasoningEffort || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
  );
  const deckId = completion.deckId || `ppt-deck-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const slidePrompts = buildSlideImagePrompts({
    outline: completion.outline,
    theme: completion.theme,
    dynamicPreset: motion.dynamicPreset,
  }).filter((slidePrompt) => completion.slideNumbers.includes(slidePrompt.slideNumber));
  const generatedSlides = [];

  await writeSseEvent(writer, "outline", { deckId, outline: completion.outline });

  for (const slidePrompt of slidePrompts) {
    try {
      const slide = await generateCloudflarePptSlide({
        writer,
        slidePrompt,
        outline: completion.outline,
        deckId,
        config,
        reasoningEffort,
        fetchImpl,
      });
      generatedSlides.push(slide);
      await writeSseEvent(writer, "slide_saved", { slide });
    } catch (error) {
      await writeSseEvent(writer, "slide_failed", {
        slideNumber: slidePrompt.slideNumber,
        message: error instanceof Error ? error.message : String(error),
      });
    }
  }

  const mergedSlides = mergePptSlides(completion.existingSlides, generatedSlides);
  const missingSlideNumbers = getMissingPptSlideNumbers({
    outline: completion.outline,
    slides: mergedSlides,
  });
  let deck = null;

  if (missingSlideNumbers.length === 0) {
    deck = buildCloudPptDeck({
      deckId,
      outline: completion.outline,
      slides: mergedSlides,
      createdAt,
      sources: payload.sources || {},
      config,
      reasoningEffort,
      motion,
      exportMode,
    });
    if (isEditablePptExportMode(exportMode)) {
      await writeSseEvent(writer, "editable_reconstruction_warning", {
        message: "Editable PPT reconstruction is local-only and is not available in Cloudflare Worker.",
        exportMode,
      });
    }
    await writeSseEvent(writer, "deck_saved", { deck });
  }

  await writeSseEvent(writer, "complete", { deck, missingSlideNumbers });
}

async function runPptSlideEdit(request, writer, fetchImpl) {
  const formData = await request.formData();
  const config = normalizePrivateConfig(formData);
  const sourceSlideImage = formData.get("sourceSlideImage");
  const annotatedSlideImage = formData.get("annotatedSlideImage");
  const referenceImages = await toReferenceImages([sourceSlideImage, annotatedSlideImage]);
  if (referenceImages.length < 2) {
    throw new Error("Please annotate the slide before regenerating it.");
  }

  const outline = JSON.parse(String(formData.get("outline") || "{}"));
  const existingSlides = JSON.parse(String(formData.get("existingSlides") || "[]"));
  const slideNumber = Number.parseInt(String(formData.get("slideNumber") || "0"), 10);
  const stylePreset = String(formData.get("stylePreset") || "").trim();
  const exportMode = normalizePptExportMode(formData.get("exportMode"));
  const motion = normalizePptMotionOptions({
    dynamicPreset: formData.get("dynamicPreset"),
    transitionPreset: formData.get("transitionPreset"),
    transitionSpeed: formData.get("transitionSpeed"),
    autoAdvanceSeconds: formData.get("autoAdvanceSeconds"),
  });
  const editInstruction = String(formData.get("editInstruction") || "").trim();
  const completion = normalizePptCompletionRequest({
    deckId: formData.get("deckId"),
    outline,
    existingSlides,
    slideNumbers: [slideNumber],
    theme: stylePreset,
  });
  const reasoningEffort = normalizeReasoningEffort(
    formData.get("reasoningEffort") || config.defaults?.reasoningEffort || DEFAULT_REASONING_EFFORT,
  );
  const deckId = completion.deckId || `ppt-deck-${crypto.randomUUID()}`;
  const createdAt = new Date().toISOString();
  const sourceSlide = completion.outline.slides.find((slide) => Number(slide.slideNumber) === slideNumber);
  if (!sourceSlide) {
    throw new Error("PPT slide not found.");
  }

  await writeSseEvent(writer, "outline", { deckId, outline: completion.outline });
  const generatedSlide = await generateCloudflarePptSlide({
    writer,
    slidePrompt: {
      slideNumber,
      title: sourceSlide.title,
      prompt: buildSlideEditPrompt({
        outline: completion.outline,
        slideNumber,
        theme: stylePreset,
        editInstruction,
        dynamicPreset: motion.dynamicPreset,
      }),
      promptSummary: `${sourceSlide.title}: ${editInstruction || "regenerated from annotation"}`,
    },
    outline: completion.outline,
    deckId,
    config,
    reasoningEffort,
    referenceImages,
    fetchImpl,
  });
  await writeSseEvent(writer, "slide_saved", { slide: generatedSlide });

  const mergedSlides = mergePptSlides(completion.existingSlides, [generatedSlide]);
  const missingSlideNumbers = getMissingPptSlideNumbers({
    outline: completion.outline,
    slides: mergedSlides,
  });
  let deck = null;

  if (missingSlideNumbers.length === 0) {
    deck = buildCloudPptDeck({
      deckId,
      outline: completion.outline,
      slides: mergedSlides,
      createdAt,
      sources: { editedSlideNumber: slideNumber, stylePreset, exportMode, ...motion },
      config,
      reasoningEffort,
      motion,
      exportMode,
    });
    if (isEditablePptExportMode(exportMode)) {
      await writeSseEvent(writer, "editable_reconstruction_warning", {
        message: "Editable PPT reconstruction is local-only and is not available in Cloudflare Worker.",
        exportMode,
      });
    }
    await writeSseEvent(writer, "deck_saved", { deck });
  }

  await writeSseEvent(writer, "complete", { deck, missingSlideNumbers });
}

function streamPptRequest(request, fetchImpl, runner) {
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();

  const work = async () => {
    try {
      await runner(request, writer, fetchImpl);
    } catch (error) {
      await writeSseEvent(writer, "error", {
        message: error instanceof Error ? error.message : String(error),
        slideNumber: error?.slideNumber,
      });
    } finally {
      await writer.close();
    }
  };

  void work();

  return new Response(readable, {
    status: 200,
    headers: SSE_HEADERS,
  });
}

async function handleCloudCreationListings(request, { env = {}, fetchImpl = fetch } = {}) {
  const payload = await request.json().catch(() => ({}));
  const set = payload.set && typeof payload.set === "object" ? payload.set : null;
  const setId = String(set?.setId || "").trim();
  if (!setId) {
    return jsonResponse({ ok: false, message: "Missing Creation set metadata." }, 400);
  }

  const mock = env.IMAGE_STUDIO_MOCK_LISTING_AGENT === "1" || payload.mock === true;
  let config;
  try {
    config = buildCloudCreationListingConfig(payload, env);
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }, 400);
  }

  if (!mock && !config.apiKey) {
    return jsonResponse({
      ok: false,
      message: "Missing API key. Provide apiKey in the request payload or Worker env.",
    }, 400);
  }

  try {
    const listingDrafts = await generateCreationListingDrafts({
      set,
      config,
      fetchImpl,
      mock,
    });
    return jsonResponse({ ok: true, set: { ...set, listingDrafts }, listingDrafts });
  } catch (error) {
    return jsonResponse({
      ok: false,
      message: error instanceof Error ? error.message : String(error),
    }, 502);
  }
}

function unsupportedFeature(request, message) {
  const url = new URL(request.url);
  return jsonResponse(buildUnsupportedRuntimeCapabilityPayload("cloudflare", request.method, url.pathname, message), 400);
}

async function handleServerImageRequest(request, imageBucket) {
  if (!imageBucket) {
    return jsonResponse({ ok: false, message: SERVER_IMAGE_BUCKET_MISSING_MESSAGE }, 503);
  }

  const url = new URL(request.url);
  const storageKey = parseServerImageStorageKey(url.pathname);
  if (!storageKey) {
    return jsonResponse({ ok: false, message: "Invalid image key" }, 400);
  }

  const object = await imageBucket.get(storageKey);
  if (!object) {
    return jsonResponse({ ok: false, message: "Image not found or expired" }, 404);
  }

  if (isExpiredIso(object.customMetadata?.expiresAt)) {
    try {
      await imageBucket.delete?.(storageKey);
    } catch (_error) {
      // Expired objects can still be hidden even if best-effort cleanup fails.
    }
    return jsonResponse({ ok: false, message: "Image expired" }, 410);
  }

  const headers = new Headers();
  if (typeof object.writeHttpMetadata === "function") {
    object.writeHttpMetadata(headers);
  }
  if (!headers.has("Content-Type")) {
    headers.set("Content-Type", object.httpMetadata?.contentType || "application/octet-stream");
  }
  headers.set("Cache-Control", "private, max-age=3600");

  return new Response(object.body, {
    status: 200,
    headers,
  });
}

export async function handleApiRequest(request, options = {}) {
  const url = new URL(request.url);
  const env = options.env || {};
  const fetchImpl = options.fetchImpl || fetch;
  const imageBucket = options.imageBucket || env.IMAGE_BUCKET;
  const generationQueue = options.generationQueue || env.GENERATION_QUEUE;

  if (request.method === "GET" && url.pathname === "/api/config") {
    return jsonResponse(buildPublicConfig());
  }

  if (request.method === "POST" && url.pathname === "/api/config") {
    return jsonResponse(buildPublicConfig());
  }

  if (request.method === "POST" && url.pathname === "/api/models") {
    return handleModelList(request, fetchImpl);
  }

  if (request.method === "GET" && url.pathname === "/api/generation/tasks") {
    return jsonResponse(await listGenerationTasks(imageBucket, getClientSessionIdFromRequest(request)));
  }

  if (request.method === "GET" && url.pathname === "/api/creation/sets") {
    return jsonResponse([]);
  }

  if (request.method === "GET" && url.pathname === "/api/portrait/sets") {
    return jsonResponse([]);
  }

  if (
    request.method === "GET" &&
    ["/api/gallery", "/api/prompt-agent/history", "/api/ppt/decks"].includes(url.pathname)
  ) {
    return jsonResponse([]);
  }

  if (request.method === "POST" && url.pathname === "/api/generate") {
    return streamGenerate(request, { fetchImpl, imageBucket });
  }

  if (request.method === "POST" && url.pathname === "/api/creation/generate") {
    return streamCreationGenerate(request, { fetchImpl, imageBucket });
  }

  if (request.method === "POST" && url.pathname === "/api/creation/listings") {
    return handleCloudCreationListings(request, { env, fetchImpl });
  }

  if (request.method === "POST" && url.pathname === "/api/portrait/generate") {
    return streamPortraitGenerate(request, { fetchImpl, imageBucket });
  }

  if (request.method === "POST" && url.pathname === "/api/creation/logo-batch") {
    return streamCreationLogoBatchGenerate(request, { fetchImpl, imageBucket });
  }

  if (request.method === "POST" && url.pathname === "/api/creation/reference/analyze") {
    return handleCreationReferenceAnalyze(request, fetchImpl);
  }

  if (request.method === "POST" && url.pathname === "/api/creation/plan") {
    return handleCreationPlan(request);
  }

  if (request.method === "POST" && url.pathname === "/api/portrait/reference/analyze") {
    return handlePortraitReferenceAnalyze(request, fetchImpl);
  }

  if (request.method === "POST" && url.pathname === "/api/portrait/plan") {
    return handlePortraitPlan(request);
  }

  if (
    request.method === "POST" &&
    ["/api/portrait/repair", "/api/portrait/sets/open-folder", "/api/portrait/sets/paths"].includes(url.pathname)
  ) {
    return new Response(
      `${JSON.stringify(buildUnsupportedRuntimeCapabilityPayload("cloudflare", request.method, url.pathname), null, 2)}\n`,
      {
        status: 400,
        headers: JSON_HEADERS,
      },
    );
  }

  if (request.method === "GET" && url.pathname.startsWith(SERVER_IMAGE_ROUTE_PREFIX)) {
    return handleServerImageRequest(request, imageBucket);
  }

  if (request.method === "POST" && url.pathname === "/api/output/delete") {
    return jsonResponse({ ok: true });
  }

  if (request.method === "POST" && url.pathname === "/api/gallery/metadata") {
    return jsonResponse({ ok: true, item: null });
  }

  if (request.method === "POST" && url.pathname === "/api/output/open") {
    return unsupportedFeature(request, "Cloudflare 部署版不支持打开本机输出目录，请使用预览区的下载按钮保存图片。");
  }

  if (request.method === "POST" && url.pathname === "/api/ppt/analyze") {
    return handlePptAnalyze(request, fetchImpl);
  }

  if (request.method === "POST" && url.pathname === "/api/ppt/generate") {
    return streamPptRequest(request, fetchImpl, runPptGenerate);
  }

  if (request.method === "POST" && url.pathname === "/api/ppt/complete") {
    return streamPptRequest(request, fetchImpl, runPptComplete);
  }

  if (request.method === "POST" && url.pathname === "/api/ppt/slide/edit") {
    return streamPptRequest(request, fetchImpl, runPptSlideEdit);
  }

  if (request.method === "POST" && url.pathname === "/api/prompt-agent/analyze") {
    return handlePromptAgentAnalyze(request, fetchImpl);
  }

  if (url.pathname.startsWith("/api/")) {
    return textResponse("Not found", 404);
  }

  if (options.assets) {
    return options.assets.fetch(request);
  }

  return textResponse("Not found", 404);
}

export default {
  fetch(request, env) {
    return handleApiRequest(request, {
      assets: env.ASSETS,
      fetchImpl: fetch,
      imageBucket: env.IMAGE_BUCKET,
      generationQueue: env.GENERATION_QUEUE,
      env,
    });
  },
  queue(batch, env) {
    return handleGenerationQueue(batch, env);
  },
};
