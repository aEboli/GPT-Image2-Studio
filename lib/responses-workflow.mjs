import { DEFAULT_REASONING_EFFORT } from "./studio-constants.mjs";
import { formatHttpErrorMessage } from "./error-formatting.mjs";
import { normalizeApiBaseUrl } from "./api-base-url.mjs";
import {
  getDefaultModelProtocolImageSize,
  normalizeModelProtocolImageSize,
} from "./generation-size-options.mjs";
import {
  API_ENDPOINT_CHAT_COMPLETIONS,
  API_ENDPOINT_IMAGE_EDITS,
  API_ENDPOINT_IMAGE_GENERATIONS,
  API_ENDPOINT_RESPONSES,
  normalizeApiEndpointPath,
} from "./image-route-config.mjs";

const textEncoder = new TextEncoder();
export const DEFAULT_RESPONSE_RECOVERY_MAX_POLLS = 4;
export const DEFAULT_RESPONSE_RECOVERY_POLL_DELAY_MS = 1000;
export const SINGLE_IMAGE_FIELD_NAME = "image";
export const MULTI_IMAGE_FIELD_NAME = "image[]";
const GEMINI_IMAGE_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

function hasReferenceImageInputs(referenceImages) {
  return filterUsableImageInputs(referenceImages).length > 0;
}

function isGeminiImageGenerationModel(model) {
  const normalized = String(model || "").trim().toLowerCase();
  return normalized.includes("gemini") && (
    normalized.includes("image") ||
    normalized.includes("banana") ||
    normalized.includes("图像") ||
    normalized.includes("生图")
  );
}

function getEffectiveDirectEndpointPath(endpointPath, referenceImages) {
  const normalizedEndpointPath = normalizeApiEndpointPath(endpointPath, API_ENDPOINT_IMAGE_GENERATIONS);
  const hasUsableReferences = hasReferenceImageInputs(referenceImages);
  if (normalizedEndpointPath === API_ENDPOINT_IMAGE_GENERATIONS && hasUsableReferences) {
    return API_ENDPOINT_IMAGE_EDITS;
  }
  // `images/edits` cannot be satisfied without a source image, so a configured edit
  // endpoint with nothing usable to send falls back to text-to-image instead of
  // posting an empty upload the upstream service would reject.
  if (normalizedEndpointPath === API_ENDPOINT_IMAGE_EDITS && !hasUsableReferences) {
    return API_ENDPOINT_IMAGE_GENERATIONS;
  }
  return normalizedEndpointPath;
}

// Many OpenAI-compatible relays only read the singular `image` multipart field and
// report a missing image when they receive the official `image[]` array form. Detect
// that specific rejection so a multi-reference edit can be retried in the shape the
// relay understands instead of failing the whole item.
//
// `hasErrorPayload` lets a 2xx response qualify: relays commonly answer this refusal with
// HTTP 200 and an `error` object, so gating on 4xx alone would skip every recovery path.
// The error text must still name a missing image, so a moderation refusal or a quota
// error never walks the fallback ladder.
export function isMissingMultipartImageFieldError({ status, body, hasErrorPayload = false } = {}) {
  const httpStatus = Number(status);
  const isRejectionStatus = httpStatus === 400 || httpStatus === 422;
  const isSuccessStatusWithError = hasErrorPayload && httpStatus >= 200 && httpStatus < 300;
  if (!isRejectionStatus && !isSuccessStatusWithError) {
    return false;
  }

  const normalizedBody = String(body || "").toLowerCase();
  if (!normalizedBody) {
    return false;
  }

  return (
    /image[\s_]*(file|url)?[^.\n]{0,40}\b(is\s+)?required/.test(normalizedBody) ||
    /(missing|no)\b[^.\n]{0,40}\bimage\b/.test(normalizedBody) ||
    /image[\s_]*(file|url)\b[^.\n]{0,40}\b(not\s+found|empty)/.test(normalizedBody)
  );
}

function isRetryableStreamReadError(error) {
  return error instanceof Error && /terminated|socket|aborted|network|connection|reset/i.test(error.message);
}

function getAbortMessage(reason, fallbackMessage = "上游图片生成请求已取消。") {
  if (reason instanceof Error && reason.message.trim()) {
    return reason.message;
  }

  if (typeof reason === "string" && reason.trim()) {
    return reason.trim();
  }

  return fallbackMessage;
}

function createAbortError(reason, fallbackMessage) {
  if (reason?.name === "AbortError") {
    return reason;
  }

  const error = new Error(getAbortMessage(reason, fallbackMessage), reason instanceof Error ? { cause: reason } : undefined);
  error.name = "AbortError";
  return error;
}

function throwIfAborted(signal) {
  if (signal?.aborted) {
    throw createAbortError(signal.reason);
  }
}

function awaitWithAbort(promise, signal) {
  if (!signal || typeof signal.addEventListener !== "function") {
    return promise;
  }

  if (signal.aborted) {
    void Promise.resolve(promise).catch(() => {});
    return Promise.reject(createAbortError(signal.reason));
  }

  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      signal.removeEventListener?.("abort", onAbort);
    };
    const finish = (callback, value) => {
      if (settled) {
        return;
      }
      settled = true;
      cleanup();
      callback(value);
    };
    const onAbort = () => {
      finish(reject, createAbortError(signal.reason));
    };

    signal.addEventListener("abort", onAbort, { once: true });
    Promise.resolve(promise).then(
      (value) => finish(resolve, value),
      (error) => finish(reject, error),
    );

    if (signal.aborted) {
      onAbort();
    }
  });
}

async function fetchWithAbort(fetchImpl, url, init, signal) {
  throwIfAborted(signal);
  const requestInit = signal ? { ...init, signal } : init;
  return awaitWithAbort(Promise.resolve().then(() => fetchImpl(url, requestInit)), signal);
}

async function readResponseText(response, signal) {
  throwIfAborted(signal);
  return awaitWithAbort(Promise.resolve().then(() => response.text()), signal);
}

async function readResponseArrayBuffer(response, signal) {
  throwIfAborted(signal);
  return awaitWithAbort(Promise.resolve().then(() => response.arrayBuffer()), signal);
}

function normalizeRequestTimeoutMs(value) {
  const timeoutMs = Number(value);
  return Number.isFinite(timeoutMs) && timeoutMs > 0 ? Math.max(1, Math.floor(timeoutMs)) : 0;
}

function createRequestAbortScope({ signal, timeoutMs } = {}) {
  const normalizedTimeoutMs = normalizeRequestTimeoutMs(timeoutMs);
  if (!normalizedTimeoutMs || typeof AbortController !== "function") {
    return {
      signal,
      dispose() {},
    };
  }

  const controller = new AbortController();
  const abort = (reason) => {
    if (!controller.signal.aborted) {
      controller.abort(reason);
    }
  };
  const onExternalAbort = () => abort(signal?.reason);
  if (signal?.aborted) {
    onExternalAbort();
  } else if (typeof signal?.addEventListener === "function") {
    signal.addEventListener("abort", onExternalAbort, { once: true });
  }

  const timeout = setTimeout(() => {
    abort(new Error(`上游图片生成请求超时（${normalizedTimeoutMs}ms）。`));
  }, normalizedTimeoutMs);

  return {
    signal: controller.signal,
    dispose() {
      clearTimeout(timeout);
      signal?.removeEventListener?.("abort", onExternalAbort);
    },
  };
}

function cancelReaderWhenAborted(reader, signal) {
  if (!signal || typeof signal.addEventListener !== "function" || typeof reader?.cancel !== "function") {
    return () => {};
  }

  const onAbort = () => {
    void Promise.resolve()
      .then(() => reader.cancel(createAbortError(signal.reason)))
      .catch(() => {});
  };
  signal.addEventListener("abort", onAbort, { once: true });
  if (signal.aborted) {
    onAbort();
  }

  return () => {
    signal.removeEventListener?.("abort", onAbort);
  };
}

export function normalizeBaseUrl(baseUrl) {
  return normalizeApiBaseUrl(baseUrl);
}

export function normalizeBase64(value) {
  return value.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, "").trim();
}

export function buildResponsesInput({ prompt, referenceImages = [], referenceImageLabels = [] }) {
  const images = Array.isArray(referenceImages)
    ? referenceImages.filter(Boolean)
    : referenceImages
      ? [referenceImages]
      : [];
  const labels = Array.isArray(referenceImageLabels) ? referenceImageLabels : [];

  const content = [
    {
      type: "input_text",
      text: prompt,
    },
  ];

  images.forEach((referenceImage, index) => {
    const label = String(labels[index] || "").trim();
    if (label) {
      content.push({
        type: "input_text",
        text: label,
      });
    }

    content.push({
      type: "input_image",
      image_url: `data:${referenceImage.mimeType};base64,${referenceImage.base64}`,
    });
  });

  return [
    {
      role: "user",
      content,
    },
  ];
}

export function createResponsesRequestBody({
  prompt,
  referenceImages,
  referenceImageLabels,
  size,
  quality,
  format = "png",
  responsesModel,
  imageModel = "",
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  stream = true,
}) {
  return {
    model: responsesModel,
    input: buildResponsesInput({ prompt, referenceImages, referenceImageLabels }),
    reasoning: {
      effort: reasoningEffort,
    },
    stream,
    tool_choice: {
      type: "image_generation",
    },
    tools: [
      {
        type: "image_generation",
        ...(String(imageModel || "").trim() ? { model: String(imageModel).trim() } : {}),
        size,
        quality,
        output_format: format,
        background: "opaque",
      },
    ],
  };
}

export function createDirectImageRequestBody({
  prompt,
  size,
  quality,
  format = "png",
  imageModel = "gpt-image-2",
}) {
  return {
    model: imageModel || "gpt-image-2",
    prompt,
    size,
    quality,
    response_format: "b64_json",
    output_format: format,
    n: 1,
  };
}

function getImageSizeDimensions(size = "auto") {
  const match = String(size || "").trim().toLowerCase().match(/^(\d+)x(\d+)$/);
  if (!match) {
    return null;
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  return Number.isFinite(width) && width > 0 && Number.isFinite(height) && height > 0
    ? { width, height }
    : null;
}

function getGeminiImageAspectRatio(size = "auto", aspectRatio = "") {
  const normalizedAspectRatio = String(aspectRatio || "").trim();
  if (GEMINI_IMAGE_ASPECT_RATIOS.includes(normalizedAspectRatio)) {
    return normalizedAspectRatio;
  }

  const dimensions = getImageSizeDimensions(size);
  if (!dimensions) {
    return "1:1";
  }

  const requestRatio = dimensions.width / dimensions.height;
  return GEMINI_IMAGE_ASPECT_RATIOS.reduce((best, candidate) => {
    const [candidateWidth, candidateHeight] = candidate.split(":").map(Number);
    const candidateRatio = candidateWidth / candidateHeight;
    const candidateDistance = Math.abs(Math.log(requestRatio / candidateRatio));
    const bestRatio = best.split(":").map(Number);
    const bestDistance = Math.abs(Math.log(requestRatio / (bestRatio[0] / bestRatio[1])));
    return candidateDistance < bestDistance ? candidate : best;
  }, "1:1");
}

function getGeminiImageSize(size = "auto") {
  const protocolSize = normalizeModelProtocolImageSize(size);
  if (protocolSize !== "auto") {
    return protocolSize;
  }

  const dimensions = getImageSizeDimensions(size);
  if (!dimensions) {
    return getDefaultModelProtocolImageSize();
  }

  const longestSide = Math.max(dimensions.width, dimensions.height);
  if (longestSide <= 1280) {
    return "1K";
  }
  if (longestSide <= 2048) {
    return "2K";
  }
  return "4K";
}

export function createGeminiImageGenerationRequestBody({
  prompt,
  referenceImages = [],
  referenceImageLabels = [],
  size,
  aspectRatio,
  imageModel = "gemini-3.1-flash-image-preview",
}) {
  const images = Array.isArray(referenceImages)
    ? referenceImages.filter(Boolean)
    : referenceImages
      ? [referenceImages]
      : [];
  const labels = Array.isArray(referenceImageLabels) ? referenceImageLabels : [];
  const parts = [{ text: prompt }];

  images.forEach((referenceImage, index) => {
    const label = String(labels[index] || "").trim();
    if (label) {
      parts.push({ text: label });
    }
    parts.push({
      inline_data: {
        mime_type: referenceImage.mimeType || "image/png",
        data: normalizeBase64(referenceImage.base64 || ""),
      },
    });
  });

  return {
    model: imageModel || "gemini-3.1-flash-image-preview",
    contents: [
      {
        role: "user",
        parts,
      },
    ],
    generationConfig: {
      responseModalities: ["TEXT", "IMAGE"],
      imageConfig: {
        aspectRatio: getGeminiImageAspectRatio(size, aspectRatio),
        imageSize: getGeminiImageSize(size),
      },
    },
  };
}

function buildChatCompletionsImageMessages({ prompt, referenceImages = [], referenceImageLabels = [] }) {
  const images = Array.isArray(referenceImages)
    ? referenceImages.filter(Boolean)
    : referenceImages
      ? [referenceImages]
      : [];
  if (!images.length) {
    return [{ role: "user", content: prompt }];
  }

  const labels = Array.isArray(referenceImageLabels) ? referenceImageLabels : [];
  const content = [{ type: "text", text: prompt }];
  images.forEach((referenceImage, index) => {
    const label = String(labels[index] || "").trim();
    if (label) {
      content.push({ type: "text", text: label });
    }
    content.push({
      type: "image_url",
      image_url: {
        url: `data:${referenceImage.mimeType};base64,${referenceImage.base64}`,
      },
    });
  });

  return [{ role: "user", content }];
}

export function createChatCompletionsImageRequestBody({
  prompt,
  referenceImages,
  referenceImageLabels,
  size,
  quality,
  format = "png",
  imageModel = "gpt-image-2",
}) {
  return {
    model: imageModel || "gpt-image-2",
    messages: buildChatCompletionsImageMessages({ prompt, referenceImages, referenceImageLabels }),
    size,
    quality,
    output_format: format,
    n: 1,
  };
}

function getImageInputFilename(input, fallback) {
  return String(input?.filename || input?.name || fallback).trim() || fallback;
}

function getImageInputMimeType(input, fallback) {
  return String(input?.mimeType || input?.type || fallback).trim() || fallback;
}

function isSupportedByteValue(value) {
  return value instanceof ArrayBuffer || ArrayBuffer.isView(value) || Array.isArray(value);
}

function base64ToUint8Array(base64) {
  const normalized = normalizeBase64(base64 || "");
  if (!normalized) {
    return new Uint8Array();
  }

  if (typeof atob === "function") {
    const binary = atob(normalized);
    const bytes = new Uint8Array(binary.length);
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index);
    }
    return bytes;
  }

  if (typeof Buffer !== "undefined") {
    return new Uint8Array(Buffer.from(normalized, "base64"));
  }

  throw new Error("Base64 decoding is not available in this runtime.");
}

function getNormalizedImageInputBytes(input) {
  if (isSupportedByteValue(input?.buffer)) {
    return input.buffer;
  }
  if (isSupportedByteValue(input?.bytes)) {
    return input.bytes;
  }
  return base64ToUint8Array(input?.base64);
}

function getByteValueLength(value) {
  if (value instanceof ArrayBuffer) {
    return value.byteLength;
  }
  if (ArrayBuffer.isView(value)) {
    return value.byteLength;
  }
  return Array.isArray(value) ? value.length : 0;
}

// An upload that carries no bytes still looks truthy, and appending it produces a
// zero-byte multipart part that upstream services reject as a missing image. Treat
// those inputs as absent so callers can pick a request shape that actually works.
export function hasUsableImageInputBytes(input) {
  if (!input) {
    return false;
  }

  if (typeof input.arrayBuffer === "function") {
    return typeof input.size === "number" ? input.size > 0 : true;
  }

  if (isSupportedByteValue(input.buffer) || isSupportedByteValue(input.bytes)) {
    return getByteValueLength(isSupportedByteValue(input.buffer) ? input.buffer : input.bytes) > 0;
  }

  return normalizeBase64(input.base64 || "").length > 0;
}

function filterUsableImageInputs(images) {
  return Array.isArray(images) ? images.filter((image) => hasUsableImageInputBytes(image)) : [];
}

// Keeps each usable reference next to the label written for it. Filtering the images
// without filtering the labels shifts label i onto a different part whenever an earlier
// input is dropped, and leaves no way to send one label for a reduced retry.
function pairUsableReferenceImagesWithLabels(images, labels) {
  const labelList = Array.isArray(labels) ? labels : [];
  return (Array.isArray(images) ? images : [])
    .map((image, index) => ({ image, label: String(labelList[index] || "").trim() }))
    .filter((reference) => hasUsableImageInputBytes(reference.image));
}

async function createImageFormDataPart(input, { fallbackFilename, fallbackMimeType }) {
  const filename = getImageInputFilename(input, fallbackFilename);
  const mimeType = getImageInputMimeType(input, fallbackMimeType);

  if (input && typeof input.arrayBuffer === "function") {
    if (input instanceof Blob && input.type) {
      return { blob: input, filename };
    }
    const bytes = await input.arrayBuffer();
    return { blob: new Blob([bytes], { type: mimeType }), filename };
  }

  return {
    blob: new Blob([getNormalizedImageInputBytes(input)], { type: mimeType }),
    filename,
  };
}

async function createImageEditFormData({
  prompt,
  sourceImage,
  sourceImages,
  mask,
  size,
  quality,
  format = "png",
  imageModel = "gpt-image-2",
  imageFieldName,
}) {
  const formData = new FormData();
  const sources = filterUsableImageInputs(
    Array.isArray(sourceImages) && sourceImages.length > 0 ? sourceImages : [sourceImage],
  );
  if (sources.length === 0) {
    throw new Error("图片编辑请求缺少可用的源图片数据，请重新上传参考图。");
  }
  const fieldName = imageFieldName || (sources.length > 1 ? MULTI_IMAGE_FIELD_NAME : SINGLE_IMAGE_FIELD_NAME);

  formData.set("model", imageModel || "gpt-image-2");
  formData.set("prompt", prompt);
  formData.set("size", size);
  formData.set("quality", quality);
  formData.set("output_format", format);

  for (const [index, source] of sources.entries()) {
    const sourcePart = await createImageFormDataPart(source, {
      fallbackFilename: index === 0 ? "source-image.png" : `source-image-${index + 1}.png`,
      fallbackMimeType: "image/png",
    });
    formData.append(fieldName, sourcePart.blob, sourcePart.filename);
  }

  if (mask) {
    const maskPart = await createImageFormDataPart(mask, {
      fallbackFilename: "mask.png",
      fallbackMimeType: "image/png",
    });
    formData.set("mask", maskPart.blob, maskPart.filename);
  }

  return formData;
}

function buildImageEditPromptWithReferenceLabels(prompt, referenceImageLabels = [], extraPromptNote = "") {
  const labels = Array.isArray(referenceImageLabels)
    ? referenceImageLabels.map((label) => String(label || "").trim()).filter(Boolean)
    : [];
  const note = String(extraPromptNote || "").trim();
  if (!labels.length && !note) {
    return prompt;
  }
  return [prompt, labels.join("\n"), note].filter(Boolean).join("\n\n");
}

export function parseSseChunk(chunk) {
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

export function extractImageBase64(eventName, payload) {
  const eventLooksLikeImage =
    /image_generation|image_edit/i.test(eventName || "") ||
    /image_generation|image_edit/i.test(String(payload?.type || ""));

  if (
    eventName === "response.output_item.done" &&
    payload?.item?.type === "image_generation_call" &&
    typeof payload.item.result === "string" &&
    payload.item.result.length > 0
  ) {
    return payload.item.result;
  }

  if (eventLooksLikeImage) {
    const directCandidates = [
      payload?.result,
      payload?.b64_json,
      payload?.image?.b64_json,
      payload?.data?.[0]?.b64_json,
    ];
    const directImage = directCandidates.find((value) => typeof value === "string" && value.length > 0);
    if (directImage) {
      return directImage;
    }
  }

  if (
    payload?.type === "image_generation_call" &&
    typeof payload.result === "string" &&
    payload.result.length > 0
  ) {
    return payload.result;
  }

  if (eventName === "response.completed" && Array.isArray(payload?.response?.output)) {
    const imageItem = payload.response.output.find(
      (item) => item?.type === "image_generation_call" && typeof item.result === "string",
    );

    if (imageItem?.result) {
      return imageItem.result;
    }
  }

  if (Array.isArray(payload?.output)) {
    const imageItem = payload.output.find(
      (item) => item?.type === "image_generation_call" && typeof item.result === "string",
    );

    if (imageItem?.result) {
      return imageItem.result;
    }
  }

  return null;
}

function extractResponseId(eventName, payload) {
  if (!/^response\./i.test(String(eventName || ""))) {
    return "";
  }

  const directResponseId = payload?.response?.id;
  if (typeof directResponseId === "string" && directResponseId.trim()) {
    return directResponseId.trim();
  }

  if (/^response\.(created|in_progress|completed|incomplete|failed)$/i.test(String(eventName || ""))) {
    const eventResponseId = payload?.id;
    if (typeof eventResponseId === "string" && eventResponseId.trim()) {
      return eventResponseId.trim();
    }
  }

  return "";
}

function formatUpstreamError(error) {
  if (!error) {
    return "";
  }

  if (typeof error === "string") {
    return error.trim();
  }

  const code = String(error.code || error.type || "").trim();
  const message = String(error.message || error.detail || error.reason || "").trim();
  return [code, message].filter(Boolean).join(" ");
}

function getUpstreamTerminalErrorMessage(eventName, payload) {
  if (/response\.failed$/i.test(eventName)) {
    const detail =
      formatUpstreamError(payload?.response?.error) ||
      formatUpstreamError(payload?.error) ||
      "response.failed";
    return `上游生成失败：${detail}`;
  }

  if (eventName === "error" || payload?.type === "error") {
    const detail = formatUpstreamError(payload?.error) || formatUpstreamError(payload) || "error";
    return `上游生成失败：${detail}`;
  }

  if (/response\.incomplete$/i.test(eventName) || payload?.response?.status === "incomplete") {
    const detail =
      formatUpstreamError(payload?.response?.incomplete_details) ||
      formatUpstreamError(payload?.incomplete_details) ||
      "response.incomplete";
    return `上游生成未完成：${detail}`;
  }

  return "";
}

function getUpstreamTerminalError(eventName, payload) {
  const message = getUpstreamTerminalErrorMessage(eventName, payload);
  if (!message) {
    return null;
  }

  const error = new Error(message);
  error.upstreamTerminalError = true;
  error.upstreamEventName = eventName;
  error.upstreamErrorCode = String(
    payload?.response?.error?.code ||
      payload?.error?.code ||
      payload?.response?.incomplete_details?.reason ||
      payload?.incomplete_details?.reason ||
      "",
  ).trim();
  return error;
}

function makeDataUrl(base64, mimeType) {
  return `data:${mimeType};base64,${normalizeBase64(base64)}`;
}

async function emitEvent(onEvent, event) {
  if (typeof onEvent === "function") {
    await onEvent(event);
  }
}

export function formatStatusHeartbeatMessage(stage, intervalMs = 0) {
  const normalizedStage = String(stage || "").trim();
  const normalizedMs = Number(intervalMs || 0);
  const intervalLabel = Number.isFinite(normalizedMs) && normalizedMs >= 1000
    ? `（${Math.max(1, Math.round(normalizedMs / 1000))} 秒）`
    : "";
  const detail = normalizedStage === "waiting_final"
    ? "仍在等待最终图，请保持页面打开"
    : "上游服务仍在处理，请保持页面打开";

  return `heartbeat${intervalLabel}：${detail}`;
}

async function waitWithStatusHeartbeat(promise, { onEvent, intervalMs, message, stage = "waiting_upstream", signal } = {}) {
  const normalizedInterval = Number(intervalMs || 0);
  if (!Number.isFinite(normalizedInterval) || normalizedInterval <= 0) {
    return awaitWithAbort(promise, signal);
  }

  const timer = setInterval(() => {
    void emitEvent(onEvent, {
      type: "status",
      stage,
      message: message || formatStatusHeartbeatMessage(stage, normalizedInterval),
    }).catch(() => {});
  }, normalizedInterval);

  try {
    return await awaitWithAbort(promise, signal);
  } finally {
    clearInterval(timer);
  }
}

function wait(ms, { signal } = {}) {
  const normalizedMs = Math.max(0, Number(ms) || 0);
  if (normalizedMs === 0) {
    throwIfAborted(signal);
    return Promise.resolve();
  }

  if (!signal || typeof signal.addEventListener !== "function") {
    return new Promise((resolve) => {
      setTimeout(resolve, normalizedMs);
    });
  }

  if (signal.aborted) {
    return Promise.reject(createAbortError(signal.reason));
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      resolve();
    }, normalizedMs);
    const onAbort = () => {
      cleanup();
      reject(createAbortError(signal.reason));
    };
    const cleanup = () => {
      clearTimeout(timeout);
      signal.removeEventListener?.("abort", onAbort);
    };

    signal.addEventListener("abort", onAbort, { once: true });
    if (signal.aborted) {
      onAbort();
    }
  });
}

export async function consumeResponsesSse(
  stream,
  {
    onEvent,
    statusHeartbeatMs = 0,
    statusHeartbeatStage = "waiting_final",
    statusHeartbeatMessage,
    signal,
  } = {},
) {
  throwIfAborted(signal);
  const reader = stream.getReader();
  const stopReaderCancellation = cancelReaderWhenAborted(reader, signal);
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let streamDrained = false;
  let responseCompleted = false;
  let finalImageBase64 = "";
  let responseId = "";
  const partialImages = [];
  const events = [];
  const heartbeatInterval = Number(statusHeartbeatMs || 0);
  const heartbeatTimer =
    Number.isFinite(heartbeatInterval) && heartbeatInterval > 0
      ? setInterval(() => {
          void emitEvent(onEvent, {
            type: "status",
            stage: statusHeartbeatStage,
            message: statusHeartbeatMessage || formatStatusHeartbeatMessage(statusHeartbeatStage, heartbeatInterval),
          }).catch(() => {});
        }, heartbeatInterval)
      : 0;

  async function processChunk(chunk) {
    const { eventName, data } = parseSseChunk(chunk);
    if (!data) {
      return false;
    }

    if (data === "[DONE]") {
      return true;
    }

    const payload = JSON.parse(data);
    const resolvedEventName = eventName || payload?.type || "unknown";
    events.push(resolvedEventName);
    responseId ||= extractResponseId(resolvedEventName, payload);

    const terminalError = getUpstreamTerminalError(resolvedEventName, payload);
    if (terminalError) {
      // Some proxy endpoints append a late response.failed after the final image.
      // Once we have the image, keep the success path and ignore the tail failure.
      if (finalImageBase64) {
        return false;
      }
      throw terminalError;
    }

    const partialImageBase64 =
      typeof payload.partial_image_b64 === "string"
        ? payload.partial_image_b64
        : /partial/i.test(resolvedEventName) && typeof payload.b64_json === "string"
          ? payload.b64_json
          : "";

    if (partialImageBase64) {
      partialImages.push(partialImageBase64);
      await emitEvent(onEvent, {
        type: "partial_image",
        base64: partialImageBase64,
        dataUrl: makeDataUrl(partialImageBase64, "image/png"),
      });
    }

    const maybeFinal = extractImageBase64(resolvedEventName, payload);
    if (maybeFinal && maybeFinal !== finalImageBase64) {
      finalImageBase64 = maybeFinal;
      await emitEvent(onEvent, {
        type: "final_image",
        base64: maybeFinal,
      });
    }

    if (
      /^(response\.)?image_generation.*completed$/i.test(resolvedEventName) ||
      /^image_edit.*completed$/i.test(resolvedEventName) ||
      resolvedEventName === "response.completed"
    ) {
      responseCompleted = true;
      await emitEvent(onEvent, {
        type: "complete",
      });
    }

    return false;
  }

  try {
    while (true) {
      let readResult;
      try {
        readResult = await awaitWithAbort(Promise.resolve().then(() => reader.read()), signal);
      } catch (error) {
        if (signal?.aborted) {
          throw createAbortError(signal.reason, error instanceof Error ? error.message : undefined);
        }

        const retryableReadError = isRetryableStreamReadError(error);
        const canUseBufferedResult = finalImageBase64 && retryableReadError;

        if (canUseBufferedResult) {
          return {
            finalImageBase64,
            partialImages,
            responseCompleted,
            events,
            responseId,
          };
        }

        if (retryableReadError) {
          return {
            finalImageBase64,
            partialImages,
            responseCompleted,
            events,
            responseId,
            streamInterrupted: true,
            streamErrorMessage: error.message,
          };
        }

        throw error;
      }

      const { done, value } = readResult;
      if (done) {
        streamDrained = true;
        if (buffer.trim()) {
          const shouldStop = await processChunk(buffer);
          if (shouldStop) {
            return {
              finalImageBase64,
              partialImages,
              responseCompleted,
              events,
              responseId,
            };
          }
        }
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      const chunks = buffer.split(/\r?\n\r?\n/);
      buffer = chunks.pop() ?? "";

      for (const chunk of chunks) {
        const shouldStop = await processChunk(chunk);
        if (shouldStop) {
          return {
            finalImageBase64,
              partialImages,
              responseCompleted,
              events,
              responseId,
            };
        }
      }
    }
  } finally {
    stopReaderCancellation();
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
    // Abandoning the stream early -- a terminal upstream error, an onEvent
    // rejection such as image validation, a [DONE] sentinel, or a buffered-image
    // recovery -- leaves the upstream socket open until the provider closes it.
    // Release it here; the abort path already cancels and cancelling twice is safe.
    if (!streamDrained) {
      void Promise.resolve()
        .then(() => reader.cancel())
        .catch(() => {});
    }
  }

  return {
    finalImageBase64,
    partialImages,
    responseCompleted,
    events,
    responseId,
  };
}

async function readJsonResponse(response, { signal } = {}) {
  const text = await readResponseText(response, signal);
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text);
}

async function readFinalImageFromJsonResponse(response, { signal } = {}) {
  const payload = await readJsonResponse(response, { signal });
  return (
    extractImageBase64("response.completed", { response: payload?.response || payload }) ||
    extractImageBase64(String(payload?.type || ""), payload)
  );
}

function getRetrievedResponsePayload(payload) {
  return payload?.response && typeof payload.response === "object" ? payload.response : payload;
}

function getRetrievedResponseStatus(payload) {
  const responsePayload = getRetrievedResponsePayload(payload);
  return String(responsePayload?.status || payload?.status || "").trim().toLowerCase();
}

function getRetrievedResponseImage(payload) {
  const responsePayload = getRetrievedResponsePayload(payload);
  return (
    extractImageBase64("response.completed", { response: responsePayload }) ||
    extractImageBase64(String(responsePayload?.type || payload?.type || "response.completed"), responsePayload)
  );
}

// A retry re-POSTs a billable generation, so it is only allowed when the original
// task's fate is genuinely unknown. Anything the provider told us about the task
// -- still running, already failed, bad credentials, unparseable reply -- is
// evidence, and a second request would either duplicate live work or fail again.
function canRetryUnknownResult(recoveryResult = {}) {
  if (recoveryResult.kind === "in_progress" || recoveryResult.reason === "poll_timeout") {
    return false;
  }

  return recoveryResult.kind !== "failed"
    && recoveryResult.kind !== "auth_error"
    && recoveryResult.kind !== "invalid_response";
}

function classifyResponseRecoveryHttpStatus(status) {
  const numericStatus = Number(status);
  if (numericStatus === 401 || numericStatus === 403) {
    return "auth_error";
  }
  if (numericStatus === 408 || numericStatus === 429 || (numericStatus >= 500 && numericStatus <= 599)) {
    return "transient_error";
  }
  if (numericStatus === 404 || numericStatus === 405 || numericStatus === 410 || numericStatus === 501) {
    return "unavailable";
  }
  return "unavailable";
}

async function retrieveOriginalResponseOnce({ endpoint, apiKey, responseId, fetchImpl, signal }) {
  const retrievalEndpoint = `${endpoint}/${encodeURIComponent(responseId)}`;
  let response;
  try {
    response = await fetchWithAbort(fetchImpl, retrievalEndpoint, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        Accept: "application/json",
      },
    }, signal);
  } catch (error) {
    if (signal?.aborted) {
      throw createAbortError(signal.reason, error instanceof Error ? error.message : undefined);
    }

    return {
      kind: "transient_error",
      message: error instanceof Error ? error.message : String(error),
    };
  }

  let body = {};
  try {
    body = await readJsonResponse(response, { signal });
  } catch (error) {
    if (signal?.aborted) {
      throw createAbortError(signal.reason, error instanceof Error ? error.message : undefined);
    }

    // An unparseable body on an error status is really that status: a 404 HTML
    // page means the task is not retrievable, not that the reply was ambiguous.
    // Reserve invalid_response for a success status we could not read, where the
    // original task may still be running.
    return {
      kind: response.ok ? "invalid_response" : classifyResponseRecoveryHttpStatus(response.status),
      status: response.status,
      message: error instanceof Error ? error.message : String(error),
    };
  }

  if (!response.ok) {
    return {
      kind: classifyResponseRecoveryHttpStatus(response.status),
      status: response.status,
      message: formatHttpErrorMessage({
        label: "原 Responses 任务回查失败",
        status: response.status,
        body: JSON.stringify(body),
      }),
    };
  }

  const finalImageBase64 = getRetrievedResponseImage(body);
  if (finalImageBase64) {
    return {
      kind: "completed",
      status: getRetrievedResponseStatus(body) || "completed",
      finalImageBase64,
    };
  }

  const status = getRetrievedResponseStatus(body);
  if (["queued", "in_progress", "generating", "running", "processing"].includes(status)) {
    return { kind: "in_progress", status };
  }

  if (["failed", "incomplete", "cancelled", "canceled", "error"].includes(status)) {
    return { kind: "failed", status };
  }

  return {
    kind: "unavailable",
    status,
    message: "回查响应缺少可用的最终图片或明确状态",
  };
}

export async function recoverOriginalResponse({
  endpoint,
  apiKey,
  responseId,
  fetchImpl = fetch,
  onEvent,
  maxPolls = DEFAULT_RESPONSE_RECOVERY_MAX_POLLS,
  pollDelayMs = DEFAULT_RESPONSE_RECOVERY_POLL_DELAY_MS,
  statusHeartbeatMs = 0,
  signal,
  timeoutMs,
} = {}) {
  const abortScope = createRequestAbortScope({ signal, timeoutMs });
  const requestSignal = abortScope.signal;
  try {
    throwIfAborted(requestSignal);
    const normalizedResponseId = String(responseId || "").trim();
    if (!normalizedResponseId) {
      return { kind: "unavailable", reason: "missing_response_id" };
    }

    const pollLimit = Math.max(1, Math.floor(Number(maxPolls) || 0));
    const normalizedPollDelayMs = Math.max(0, Number(pollDelayMs) || 0);
    let lastResult = { kind: "unavailable", reason: "not_checked" };

    await emitEvent(onEvent, {
      type: "status",
      stage: "recovering_original",
      message: "流式连接已中断，正在优先回查原任务结果",
    });

    for (let attempt = 0; attempt < pollLimit; attempt += 1) {
      lastResult = await waitWithStatusHeartbeat(
        retrieveOriginalResponseOnce({ endpoint, apiKey, responseId: normalizedResponseId, fetchImpl, signal: requestSignal }),
        {
          onEvent,
          intervalMs: statusHeartbeatMs,
          message: formatStatusHeartbeatMessage("waiting_final", statusHeartbeatMs),
          stage: "recovering_original",
          signal: requestSignal,
        },
      );

      if (lastResult.kind === "completed" || lastResult.kind === "failed" || lastResult.kind === "unavailable" || lastResult.kind === "auth_error" || lastResult.kind === "invalid_response") {
        return lastResult;
      }

      if (attempt + 1 >= pollLimit) {
        break;
      }

      await emitEvent(onEvent, {
        type: "status",
        stage: "waiting_original",
        message: "原任务仍在处理，正在等待原结果",
      });
      await wait(normalizedPollDelayMs, { signal: requestSignal });
    }

    return {
      ...lastResult,
      kind: lastResult.kind === "transient_error" ? "unavailable" : lastResult.kind,
      reason: lastResult.kind === "in_progress" ? "poll_timeout" : lastResult.reason,
    };
  } finally {
    abortScope.dispose();
  }
}

function firstPayloadString(values = []) {
  return values.find((value) => typeof value === "string" && value.trim().length > 0)?.trim() || "";
}

function isHttpUrl(value) {
  return /^https?:\/\//i.test(String(value || "").trim());
}

function getChatCompletionMessage(payload) {
  return Array.isArray(payload?.choices) ? payload.choices[0]?.message || null : null;
}

function getChatCompletionContentText(message) {
  const content = message?.content;
  if (typeof content === "string") {
    return content;
  }
  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }
        return firstPayloadString([part?.text, part?.image_url?.url, part?.url, part?.b64_json, part?.base64]);
      })
      .filter(Boolean)
      .join("\n");
  }
  return "";
}

function extractBase64FromText(value) {
  const text = String(value || "");
  const dataUrlMatch = text.match(/data:image\/[a-zA-Z0-9+.-]+;base64,([a-zA-Z0-9+/=._-]+)/);
  if (dataUrlMatch) {
    return normalizeBase64(dataUrlMatch[1]);
  }
  return "";
}

function extractHttpUrlFromText(value) {
  const text = String(value || "");
  const markdownMatch = text.match(/!\[[^\]]*]\((https?:\/\/[^)\s]+)\)/i);
  if (markdownMatch) {
    return markdownMatch[1];
  }
  const plainMatch = text.match(/https?:\/\/[^\s)"']+/i);
  return plainMatch?.[0] || "";
}

function getGeminiCandidateParts(payload) {
  const candidates = Array.isArray(payload?.candidates)
    ? payload.candidates
    : Array.isArray(payload?.response?.candidates)
      ? payload.response.candidates
      : [];

  return candidates.flatMap((candidate) => {
    if (Array.isArray(candidate?.content?.parts)) {
      return candidate.content.parts;
    }
    if (Array.isArray(candidate?.parts)) {
      return candidate.parts;
    }
    return [];
  });
}

function extractGeminiInlineImageBase64(payload) {
  const parts = getGeminiCandidateParts(payload);
  for (const part of parts) {
    const inlineData = part?.inlineData || part?.inline_data;
    const mimeType = String(inlineData?.mimeType || inlineData?.mime_type || "").toLowerCase();
    const data = firstPayloadString([inlineData?.data, inlineData?.base64]);
    if (data && (!mimeType || mimeType.startsWith("image/"))) {
      return normalizeBase64(data);
    }
  }
  return "";
}

function extractDirectImageBase64(payload) {
  const output = Array.isArray(payload?.output) ? payload.output[0] : null;
  const image = Array.isArray(payload?.images) ? payload.images[0] : payload?.image;
  const data = Array.isArray(payload?.data) ? payload.data[0] : null;
  const chatMessage = getChatCompletionMessage(payload);
  const chatContentText = getChatCompletionContentText(chatMessage);
  const candidate = firstPayloadString([
    payload?.b64_json,
    payload?.base64,
    payload?.result,
    typeof output === "string" ? output : output?.b64_json,
    output?.base64,
    output?.result,
    image?.b64_json,
    image?.base64,
    data?.b64_json,
    data?.base64,
    chatMessage?.b64_json,
    chatMessage?.base64,
    extractBase64FromText(chatContentText),
    extractGeminiInlineImageBase64(payload),
  ]);

  if (!candidate || isHttpUrl(candidate)) {
    return "";
  }

  return normalizeBase64(candidate);
}

function extractDirectImageUrl(payload) {
  const output = Array.isArray(payload?.output) ? payload.output[0] : null;
  const image = Array.isArray(payload?.images) ? payload.images[0] : payload?.image;
  const data = Array.isArray(payload?.data) ? payload.data[0] : null;
  const chatMessage = getChatCompletionMessage(payload);
  const chatContentText = getChatCompletionContentText(chatMessage);
  const candidate = firstPayloadString([
    payload?.url,
    isHttpUrl(payload?.result) ? payload.result : "",
    typeof output === "string" && isHttpUrl(output) ? output : "",
    output?.url,
    image?.url,
    data?.url,
    chatMessage?.url,
    extractHttpUrlFromText(chatContentText),
  ]);
  return isHttpUrl(candidate) ? candidate : "";
}

function arrayBufferToBase64(arrayBuffer) {
  const bytes = new Uint8Array(arrayBuffer);
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    const chunk = bytes.subarray(index, index + chunkSize);
    binary += String.fromCharCode(...chunk);
  }

  if (typeof btoa === "function") {
    return btoa(binary);
  }

  return Buffer.from(bytes).toString("base64");
}

async function fetchImageUrlAsBase64(url, fetchImpl, signal) {
  const response = await fetchWithAbort(fetchImpl, url, {
    method: "GET",
    headers: {
      Accept: "image/*",
    },
  }, signal);

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "Direct image URL fetch failed",
        status: response.status,
        body: await readResponseText(response, signal),
      }),
    );
  }

  return arrayBufferToBase64(await readResponseArrayBuffer(response, signal));
}

async function readDirectFinalImageFromJsonResponse(response, fetchImpl, signal) {
  const payload = await readJsonResponse(response, { signal });
  if (payload?.error) {
    throw new Error(formatUpstreamError(payload.error) || "Direct image generation failed.");
  }

  return extractDirectFinalImageFromPayload(payload, fetchImpl, signal);
}

async function extractDirectFinalImageFromPayload(payload, fetchImpl, signal) {
  const base64 = extractDirectImageBase64(payload);
  if (base64) {
    return base64;
  }

  const imageUrl = extractDirectImageUrl(payload);
  if (imageUrl) {
    return fetchImageUrlAsBase64(imageUrl, fetchImpl, signal);
  }

  return "";
}

// `response.ok` is not a reliable success signal for OpenAI-compatible relays: several
// answer a refusal with HTTP 200 and an `error` object. Read the body once, keep the
// parsed payload for image extraction, and classify on status *and* payload shape.
async function readDirectImageAttemptOutcome(response, signal) {
  const bodyText = await readResponseText(response, signal);
  let payload = null;
  if (bodyText.trim()) {
    try {
      payload = JSON.parse(bodyText);
    } catch (_error) {
      payload = null;
    }
  }

  const errorPayload = payload && typeof payload === "object" ? payload.error : null;
  const hasErrorPayload = Boolean(errorPayload);

  return {
    ok: response.ok && !hasErrorPayload,
    status: response.status,
    bodyText,
    payload,
    hasErrorPayload,
    errorMessage: hasErrorPayload ? formatUpstreamError(errorPayload) : "",
  };
}

function formatModelProtocolHttpError({ status, body, endpointPath = API_ENDPOINT_CHAT_COMPLETIONS } = {}) {
  const message = formatHttpErrorMessage({
    label: "Gemini模型请求失败",
    status,
    body,
  });
  if (Number(status) !== 404) {
    return message;
  }

  return `${message}。请确认基础 URL 指向 AGICTO/OpenAI 兼容服务，并开放 /${endpointPath}。`;
}

export async function requestDirectImageGeneration({
  baseUrl,
  endpointPath = API_ENDPOINT_IMAGE_GENERATIONS,
  apiKey,
  prompt,
  referenceImages,
  referenceImageLabels,
  size,
  quality,
  format = "png",
  imageModel = "gpt-image-2",
  responsesModel,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  fetchImpl = fetch,
  onEvent,
  signal,
  timeoutMs,
}) {
  const abortScope = createRequestAbortScope({ signal, timeoutMs });
  const requestSignal = abortScope.signal;
  try {
    throwIfAborted(requestSignal);
  await emitEvent(onEvent, {
    type: "status",
    stage: "connecting",
    message: "Connecting direct image model.",
  });

  const normalizedEndpointPath = getEffectiveDirectEndpointPath(endpointPath, referenceImages);
  const endpoint = `${normalizeBaseUrl(baseUrl)}/${normalizedEndpointPath}`;
  // Labels are indexed against the caller's full reference list, so pair each surviving
  // image with its own label before filtering. Otherwise label i can end up describing a
  // different part than the one uploaded at position i.
  const usableReferences = pairUsableReferenceImagesWithLabels(referenceImages, referenceImageLabels);
  const buildImageEditBody = ({ imageFieldName, references = usableReferences, extraPromptNote = "" } = {}) =>
    createImageEditFormData({
      prompt: buildImageEditPromptWithReferenceLabels(
        prompt,
        references.map((reference) => reference.label),
        extraPromptNote,
      ),
      sourceImages: references.map((reference) => reference.image),
      size,
      quality,
      format,
      imageModel,
      imageFieldName,
    });
  let requestBody;
  let isMultipartRequest = false;
  if (normalizedEndpointPath === API_ENDPOINT_IMAGE_EDITS) {
    isMultipartRequest = true;
    requestBody = await buildImageEditBody();
  } else if (normalizedEndpointPath === API_ENDPOINT_RESPONSES) {
    requestBody = createResponsesRequestBody({
      prompt,
      referenceImages,
      referenceImageLabels,
      size,
      quality,
      format,
      responsesModel: responsesModel || imageModel,
      imageModel,
      reasoningEffort,
      stream: false,
    });
  } else if (normalizedEndpointPath === API_ENDPOINT_CHAT_COMPLETIONS) {
    requestBody = createChatCompletionsImageRequestBody({
      prompt,
      referenceImages,
      referenceImageLabels,
      size,
      quality,
      format,
      imageModel,
    });
  } else {
    requestBody = createDirectImageRequestBody({
      prompt,
      size,
      quality,
      format,
      imageModel,
    });
  }
  const requestHeaders = {
    Authorization: `Bearer ${apiKey}`,
    Accept: "application/json",
  };
  if (!isMultipartRequest) {
    requestHeaders["Content-Type"] = "application/json";
  }
  const postRequest = (body) =>
    fetchWithAbort(fetchImpl, endpoint, {
      method: "POST",
      headers: requestHeaders,
      body: isMultipartRequest ? body : JSON.stringify(body),
    }, requestSignal);

  // Relays disagree on how to receive several reference images. Walk a bounded ladder from
  // the official shape down to a single part, and only when the rejection actually names a
  // missing image field so an unrelated failure still costs one request.
  const multipartAttempts =
    isMultipartRequest && usableReferences.length > 1
      ? [
          { imageFieldName: MULTI_IMAGE_FIELD_NAME },
          {
            imageFieldName: SINGLE_IMAGE_FIELD_NAME,
            statusMessage: `上游未识别 ${MULTI_IMAGE_FIELD_NAME} 多图字段，正在改用重复 ${SINGLE_IMAGE_FIELD_NAME} 字段重试。`,
            imageFieldFallbackUsed: true,
          },
          {
            imageFieldName: SINGLE_IMAGE_FIELD_NAME,
            references: usableReferences.slice(0, 1),
            statusMessage: `上游只接受单张参考图，正在改用第 1 张参考图重试，已放弃其余 ${usableReferences.length - 1} 张。`,
            extraPromptNote: `Provider limitation: only reference image 1 of ${usableReferences.length} could be uploaded. ${usableReferences.length - 1} additional reference image(s) were not sent. Rely only on the attached reference and the text above; do not invent the missing references.`,
            imageFieldFallbackUsed: true,
            referenceImageReductionUsed: true,
          },
        ]
      : [{ imageFieldName: undefined }];

  let outcome = null;
  let imageFieldFallbackUsed = false;
  let referenceImageReductionUsed = false;
  let uploadedReferenceImageCount = usableReferences.length;

  for (const [attemptIndex, attempt] of multipartAttempts.entries()) {
    if (attempt.statusMessage) {
      await emitEvent(onEvent, {
        type: "status",
        stage: "connecting",
        message: attempt.statusMessage,
      });
    }

    const attemptBody =
      attemptIndex === 0
        ? requestBody
        : await buildImageEditBody({
            imageFieldName: attempt.imageFieldName,
            references: attempt.references,
            extraPromptNote: attempt.extraPromptNote,
          });
    const attemptResponse = await postRequest(attemptBody);
    outcome = await readDirectImageAttemptOutcome(attemptResponse, requestSignal);

    if (attemptIndex > 0) {
      imageFieldFallbackUsed = Boolean(attempt.imageFieldFallbackUsed);
      referenceImageReductionUsed = Boolean(attempt.referenceImageReductionUsed);
      uploadedReferenceImageCount = (attempt.references || usableReferences).length;
    }

    if (outcome.ok) {
      break;
    }

    const hasNextAttempt = attemptIndex < multipartAttempts.length - 1;
    const canWalkLadder =
      hasNextAttempt &&
      isMissingMultipartImageFieldError({
        status: outcome.status,
        body: outcome.bodyText,
        hasErrorPayload: outcome.hasErrorPayload,
      });

    if (!canWalkLadder) {
      throw new Error(
        outcome.hasErrorPayload && attemptResponse.ok
          ? outcome.errorMessage || "Direct image generation failed."
          : formatHttpErrorMessage({
              label: "Direct image generation failed",
              status: outcome.status,
              body: outcome.bodyText,
            }),
      );
    }
  }

  await emitEvent(onEvent, {
    type: "status",
    stage: "waiting_final",
    message: "Waiting for direct image result.",
  });

  const finalImageBase64 = await extractDirectFinalImageFromPayload(outcome.payload, fetchImpl, requestSignal);
  if (!finalImageBase64) {
    throw new Error("Direct image response ended without a final image.");
  }

  await emitEvent(onEvent, {
    type: "final_image",
    base64: finalImageBase64,
  });

  return {
    finalImageBase64,
    responseCompleted: true,
    fallbackUsed: false,
    streamFallbackUsed: false,
    sizeFallbackUsed: false,
    requestedSize: size,
    effectiveSize: size,
    format,
    imageModel,
    responsesModel,
    imageRoute: "b",
    endpointPath: normalizedEndpointPath,
    imageFieldFallbackUsed,
    referenceImageReductionUsed,
    uploadedReferenceImageCount,
  };
  } finally {
    abortScope.dispose();
  }
}

export async function requestModelProtocolImageGeneration({
  baseUrl,
  apiKey,
  prompt,
  referenceImages,
  referenceImageLabels,
  size,
  quality,
  format = "png",
  aspectRatio,
  imageModel = "gemini-3.1-flash-image-preview",
  fetchImpl = fetch,
  onEvent,
  signal,
  timeoutMs,
}) {
  const abortScope = createRequestAbortScope({ signal, timeoutMs });
  const requestSignal = abortScope.signal;
  try {
    throwIfAborted(requestSignal);
  await emitEvent(onEvent, {
    type: "status",
    stage: "connecting",
    message: "Connecting model protocol image model.",
  });

  const normalizedBaseUrl = normalizeBaseUrl(baseUrl);
  const normalizedModel = String(imageModel || "gemini-3.1-flash-image-preview").trim();
  const usesGeminiImageGeneration = isGeminiImageGenerationModel(normalizedModel);
  const endpointPath = usesGeminiImageGeneration ? API_ENDPOINT_IMAGE_GENERATIONS : API_ENDPOINT_CHAT_COMPLETIONS;
  const endpoint = `${normalizedBaseUrl}/${endpointPath}`;
  const requestBody = usesGeminiImageGeneration
    ? createGeminiImageGenerationRequestBody({
        prompt,
        referenceImages,
        referenceImageLabels,
        size,
        aspectRatio,
        imageModel: normalizedModel,
      })
    : {
        model: normalizedModel,
        messages: buildChatCompletionsImageMessages({ prompt, referenceImages, referenceImageLabels }),
      };
  const response = await fetchWithAbort(fetchImpl, endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  }, requestSignal);

  if (!response.ok) {
    throw new Error(formatModelProtocolHttpError({ status: response.status, body: await readResponseText(response, requestSignal), endpointPath }));
  }

  await emitEvent(onEvent, {
    type: "status",
    stage: "waiting_final",
    message: "Waiting for model protocol image result.",
  });

  const finalImageBase64 = await readDirectFinalImageFromJsonResponse(response, fetchImpl, requestSignal);
  if (!finalImageBase64) {
    throw new Error("Model protocol image response ended without a final image.");
  }

  await emitEvent(onEvent, {
    type: "final_image",
    base64: finalImageBase64,
  });

  return {
    finalImageBase64,
    responseCompleted: true,
    fallbackUsed: false,
    streamFallbackUsed: false,
    sizeFallbackUsed: false,
    requestedSize: size,
    effectiveSize: normalizeModelProtocolImageSize(size) === "auto" ? getDefaultModelProtocolImageSize() : normalizeModelProtocolImageSize(size),
    format,
    imageModel: normalizedModel,
    imageRoute: "c",
    protocol: usesGeminiImageGeneration ? "model-image-generations" : "model-chat-completions",
  };
  } finally {
    abortScope.dispose();
  }
}

export async function requestImageEdit({
  baseUrl,
  apiKey,
  prompt,
  sourceImage,
  mask,
  size,
  quality,
  format = "png",
  imageModel = "gpt-image-2",
  fetchImpl = fetch,
  onEvent,
  signal,
  timeoutMs,
}) {
  const abortScope = createRequestAbortScope({ signal, timeoutMs });
  const requestSignal = abortScope.signal;
  try {
    throwIfAborted(requestSignal);
  await emitEvent(onEvent, {
    type: "status",
    stage: "connecting",
    message: "Connecting image edit model.",
  });

  const endpoint = `${normalizeBaseUrl(baseUrl)}/images/edits`;
  const response = await fetchWithAbort(fetchImpl, endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body: await createImageEditFormData({
      prompt,
      sourceImage,
      mask,
      size,
      quality,
      format,
      imageModel,
    }),
  }, requestSignal);

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "Image edit request failed",
        status: response.status,
        body: await readResponseText(response, requestSignal),
      }),
    );
  }

  await emitEvent(onEvent, {
    type: "status",
    stage: "waiting_final",
    message: "Waiting for image edit result.",
  });

  const finalImageBase64 = await readDirectFinalImageFromJsonResponse(response, fetchImpl, requestSignal);
  if (!finalImageBase64) {
    throw new Error("Image edit response ended without a final image.");
  }

  await emitEvent(onEvent, {
    type: "final_image",
    base64: finalImageBase64,
  });

  return {
    finalImageBase64,
    responseCompleted: true,
    fallbackUsed: false,
    streamFallbackUsed: false,
    sizeFallbackUsed: false,
    requestedSize: size,
    effectiveSize: size,
    format,
    imageModel,
    imageRoute: "edit",
  };
  } finally {
    abortScope.dispose();
  }
}

export async function requestImageGeneration({
  baseUrl,
  apiKey,
  prompt,
  referenceImages,
  referenceImageLabels,
  size,
  quality,
  format = "png",
  responsesModel,
  endpointPath = API_ENDPOINT_RESPONSES,
  reasoningEffort = DEFAULT_REASONING_EFFORT,
  fetchImpl = fetch,
  statusHeartbeatMs = 0,
  responseRecoveryMaxPolls = DEFAULT_RESPONSE_RECOVERY_MAX_POLLS,
  responseRecoveryPollDelayMs = DEFAULT_RESPONSE_RECOVERY_POLL_DELAY_MS,
  onEvent,
  signal,
  timeoutMs,
}) {
  const abortScope = createRequestAbortScope({ signal, timeoutMs });
  const requestSignal = abortScope.signal;
  try {
    throwIfAborted(requestSignal);
  await emitEvent(onEvent, {
    type: "status",
    stage: "connecting",
    message: "正在连接上游服务",
  });

  const normalizedEndpointPath = normalizeApiEndpointPath(endpointPath, API_ENDPOINT_RESPONSES);
  const endpoint = `${normalizeBaseUrl(baseUrl)}/${normalizedEndpointPath}`;
  if (normalizedEndpointPath === API_ENDPOINT_CHAT_COMPLETIONS) {
    const response = await fetchWithAbort(fetchImpl, endpoint, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(
        createChatCompletionsImageRequestBody({
          prompt,
          referenceImages,
          referenceImageLabels,
          size,
          quality,
          format,
          imageModel: responsesModel,
        }),
      ),
    }, requestSignal);

    if (!response.ok) {
      throw new Error(
        formatHttpErrorMessage({
          label: "Responses image generation failed",
          status: response.status,
          body: await readResponseText(response, requestSignal),
        }),
      );
    }

    await emitEvent(onEvent, {
      type: "status",
      stage: "waiting_final",
      message: "正在等待最终图片",
    });

    const finalImageBase64 = await readDirectFinalImageFromJsonResponse(response, fetchImpl, requestSignal);
    if (!finalImageBase64) {
      throw new Error("上游响应结束，但没有拿到最终图片。");
    }

    await emitEvent(onEvent, {
      type: "final_image",
      base64: finalImageBase64,
    });

    return {
      finalImageBase64,
      responseCompleted: true,
      fallbackUsed: false,
      streamFallbackUsed: false,
      sizeFallbackUsed: false,
      requestedSize: size,
      effectiveSize: size,
      format,
      responsesModel,
      imageRoute: "a",
      endpointPath: normalizedEndpointPath,
    };
  }

  const effectiveSize = size;
  const requestBody = JSON.stringify(
    createResponsesRequestBody({
      prompt,
      referenceImages,
      referenceImageLabels,
      size: effectiveSize,
      quality,
      format,
      responsesModel,
      reasoningEffort,
      stream: true,
    }),
  );
  const buildRequestInit = () => ({
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "text/event-stream",
    },
    body: requestBody,
    ...(requestSignal ? { signal: requestSignal } : {}),
  });

  const fetchWithHeartbeat = (isAutomaticRetry) => {
    throwIfAborted(requestSignal);
    return waitWithStatusHeartbeat(fetchImpl(endpoint, buildRequestInit()), {
      onEvent,
      intervalMs: statusHeartbeatMs,
      message: isAutomaticRetry
        ? "重试中"
        : formatStatusHeartbeatMessage("waiting_upstream", statusHeartbeatMs),
      stage: isAutomaticRetry ? "retrying_upstream" : "waiting_upstream",
      signal: requestSignal,
    });
  };

  const maxUnknownResultRetries = 1;
  let unknownResultRetryCount = 0;

  while (true) {
    throwIfAborted(requestSignal);
    const isAutomaticRetry = unknownResultRetryCount > 0;
    let response;
    try {
      response = await fetchWithHeartbeat(isAutomaticRetry);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (requestSignal?.aborted) {
        throw createAbortError(requestSignal.reason, detail);
      }

      throw new Error(
        isAutomaticRetry
          ? `自动重试请求连接失败，不再继续重试。${detail ? ` ${detail}` : ""}`
          : `流式连接失败，原任务状态未知；系统未自动重新生成。${detail ? ` ${detail}` : ""}`,
        { cause: error },
      );
    }

    if (!response.ok) {
      throw new Error(
        formatHttpErrorMessage({
          label: isAutomaticRetry ? "自动重试请求失败" : "生成请求失败",
          status: response.status,
          body: await readResponseText(response, requestSignal),
        }),
      );
    }

    if (!response.body) {
      throw new Error(
        isAutomaticRetry
          ? "自动重试接口没有返回可读取的流，不再继续重试。"
          : "接口没有返回可读取的流；原任务状态未知，系统未自动重新生成。",
      );
    }

    await emitEvent(onEvent, {
      type: "status",
      stage: isAutomaticRetry ? "retrying_upstream" : "generating",
      message: isAutomaticRetry ? "重试中" : "正在生成图片",
    });

    const result = await consumeResponsesSse(response.body, {
      onEvent,
      statusHeartbeatMs,
      statusHeartbeatStage: isAutomaticRetry ? "retrying_upstream" : "waiting_final",
      statusHeartbeatMessage: isAutomaticRetry ? "重试中" : undefined,
      signal: requestSignal,
    });

    const { responseId, ...safeResult } = result;
    if (result.finalImageBase64) {
      return {
        ...safeResult,
        fallbackUsed: false,
        streamFallbackUsed: false,
        sizeFallbackUsed: false,
        requestedSize: size,
        effectiveSize,
        format,
        endpointPath: normalizedEndpointPath,
      };
    }

    const recoveryResult = responseId
      ? await recoverOriginalResponse({
          endpoint,
          apiKey,
          responseId,
          fetchImpl,
          onEvent,
          maxPolls: responseRecoveryMaxPolls,
          pollDelayMs: responseRecoveryPollDelayMs,
          statusHeartbeatMs,
          signal: requestSignal,
        })
      : { kind: "unavailable", reason: "missing_response_id" };

    throwIfAborted(requestSignal);

    if (recoveryResult.kind === "completed" && recoveryResult.finalImageBase64) {
      await emitEvent(onEvent, {
        type: "status",
        stage: "recovered_original",
        message: "已找回原任务的最终图片",
      });
      await emitEvent(onEvent, {
        type: "final_image",
        base64: recoveryResult.finalImageBase64,
      });
      return {
        ...safeResult,
        finalImageBase64: recoveryResult.finalImageBase64,
        responseCompleted: true,
        fallbackUsed: false,
        streamFallbackUsed: false,
        sizeFallbackUsed: false,
        recoveredOriginal: true,
        requestedSize: size,
        effectiveSize,
        format,
        endpointPath: normalizedEndpointPath,
      };
    }

    if (canRetryUnknownResult(recoveryResult) && unknownResultRetryCount < maxUnknownResultRetries) {
      unknownResultRetryCount += 1;
      await emitEvent(onEvent, {
        type: "status",
        stage: "retrying_upstream",
        message: "重试中",
      });
      continue;
    }

    const recoveryStage = recoveryResult.kind === "failed" ? "original_failed" : "recovery_unavailable";
    const recoveryMessage = isAutomaticRetry
      ? recoveryResult.kind === "failed"
        ? "自动重试任务已失败，不再继续重试"
        : "自动重试后仍无法确认最终结果，不再继续重试"
      : recoveryResult.kind === "failed"
        ? "上游已确认原任务失败，系统未自动重新生成；请手动重试"
        : "无法确认原任务的最终结果，系统未自动重新生成；请手动重试";
    await emitEvent(onEvent, {
      type: "status",
      stage: recoveryStage,
      message: recoveryMessage,
    });

    const detail = recoveryResult.message ? ` ${recoveryResult.message}` : "";
    const error = new Error(
      isAutomaticRetry
        ? recoveryResult.kind === "failed"
          ? `自动重试的 Responses 任务已失败，不再继续重试。${detail}`
          : `原 Responses 任务结果未知，自动重试后仍未确认，请手动重试。${detail}`
        : recoveryResult.kind === "failed"
          ? `原 Responses 任务已失败，系统未自动重新生成，请手动重试。${detail}`
          : `原 Responses 任务结果未知，系统未自动重新生成，请手动重试。${detail}`,
    );
    error.originalResponseRecovery = recoveryResult.kind;
    error.originalResponseRecoveryReason = recoveryResult.reason || "";
    error.originalResponseStatus = recoveryResult.status || "";
    error.unknownResultRetryCount = unknownResultRetryCount;
    throw error;
  }
  } finally {
    abortScope.dispose();
  }
}

export function encodeChunk(value) {
  return textEncoder.encode(value);
}
