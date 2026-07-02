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
const OPENAI_IMAGE_SIZE_VALUES = new Set(["auto", "1024x1024", "1536x1024", "1024x1536"]);
const STREAMING_FALLBACK_HTTP_STATUSES = new Set([400, 403, 405, 406, 501, 503]);
const TRANSIENT_UPSTREAM_HTTP_STATUSES = new Set([408, 429, 500, 502, 503, 504, 520, 522, 523, 524]);
const DEFAULT_TRANSIENT_HTTP_MAX_RETRIES = 2;
export const DEFAULT_TRANSIENT_HTTP_RETRY_DELAY_MS = 5000;
const GEMINI_IMAGE_ASPECT_RATIOS = ["1:1", "2:3", "3:2", "3:4", "4:3", "4:5", "5:4", "9:16", "16:9", "21:9"];

function getCompatibleImageSizeFallback(size = "auto") {
  const normalized = String(size || "auto").trim().toLowerCase();
  if (OPENAI_IMAGE_SIZE_VALUES.has(normalized)) {
    return normalized;
  }

  const match = normalized.match(/^(\d+)x(\d+)$/);
  if (!match) {
    return "auto";
  }

  const width = Number(match[1]);
  const height = Number(match[2]);
  if (width > height) {
    return "1536x1024";
  }
  if (height > width) {
    return "1024x1536";
  }
  return "1024x1024";
}

function shouldRetryInvalidImageSize({ status, body, size } = {}) {
  const normalizedSize = String(size || "auto").trim().toLowerCase();
  const fallbackSize = getCompatibleImageSizeFallback(normalizedSize);
  if (fallbackSize === normalizedSize || Number(status) !== 400) {
    return "";
  }

  const bodyText = String(body || "").toLowerCase();
  if (!bodyText.includes("invalid_value")) {
    return "";
  }

  if (bodyText.includes(normalizedSize) || bodyText.includes("size")) {
    return fallbackSize;
  }

  return "";
}

function shouldRetryWithoutStreaming({ status, body } = {}) {
  const numericStatus = Number(status);
  if (!STREAMING_FALLBACK_HTTP_STATUSES.has(numericStatus)) {
    return false;
  }

  if (numericStatus === 400) {
    return /stream|sse|event-stream|unsupported/i.test(String(body || ""));
  }

  return true;
}

function hasReferenceImageInputs(referenceImages) {
  return Array.isArray(referenceImages) && referenceImages.some(Boolean);
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
  if (normalizedEndpointPath === API_ENDPOINT_IMAGE_GENERATIONS && hasReferenceImageInputs(referenceImages)) {
    return API_ENDPOINT_IMAGE_EDITS;
  }
  return normalizedEndpointPath;
}

function shouldRetryTransientHttpStatus(status) {
  return TRANSIENT_UPSTREAM_HTTP_STATUSES.has(Number(status));
}

function isRetryableStreamReadError(error) {
  return error instanceof Error && /terminated|socket|aborted|network|connection|reset/i.test(error.message);
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
  const sources = Array.isArray(sourceImages) && sourceImages.length > 0
    ? sourceImages.filter(Boolean)
    : [sourceImage];
  const fieldName = imageFieldName || (sources.length > 1 ? "image[]" : "image");

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

function buildImageEditPromptWithReferenceLabels(prompt, referenceImageLabels = []) {
  const labels = Array.isArray(referenceImageLabels)
    ? referenceImageLabels.map((label) => String(label || "").trim()).filter(Boolean)
    : [];
  if (!labels.length) {
    return prompt;
  }
  return [prompt, labels.join("\n")].filter(Boolean).join("\n\n");
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

function isRetryableUpstreamTerminalError(error) {
  return Boolean(error && typeof error === "object" && error.upstreamTerminalError);
}

function createRetryableGenerationError(message, cause) {
  const error = new Error(message);
  error.retryableGenerationAttempt = true;
  if (cause) {
    error.cause = cause;
  }
  return error;
}

function isRetryableGenerationAttemptError(error) {
  return Boolean(
    error &&
      typeof error === "object" &&
      (error.retryableGenerationAttempt || isRetryableUpstreamTerminalError(error)),
  );
}

function getGenerationRetryMessage(error, attempt, maxAttempts) {
  const detail = String(error?.message || "upstream generation failed").trim();
  return `${detail}，正在重试 ${attempt}/${maxAttempts}`;
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

async function waitWithStatusHeartbeat(promise, { onEvent, intervalMs, message, stage = "waiting_upstream" }) {
  const normalizedInterval = Number(intervalMs || 0);
  if (!Number.isFinite(normalizedInterval) || normalizedInterval <= 0) {
    return promise;
  }

  const timer = setInterval(() => {
    void emitEvent(onEvent, {
      type: "status",
      stage,
      message: message || formatStatusHeartbeatMessage(stage, normalizedInterval),
    }).catch(() => {});
  }, normalizedInterval);

  try {
    return await promise;
  } finally {
    clearInterval(timer);
  }
}

function wait(ms) {
  const normalizedMs = Math.max(0, Number(ms) || 0);
  if (normalizedMs === 0) {
    return Promise.resolve();
  }

  return new Promise((resolve) => {
    setTimeout(resolve, normalizedMs);
  });
}

function getTransientRetryDelayMs(baseDelayMs) {
  const normalizedBaseDelay = Math.max(0, Number(baseDelayMs) || 0);
  return normalizedBaseDelay;
}

export async function consumeResponsesSse(stream, { onEvent, statusHeartbeatMs = 0 } = {}) {
  const reader = stream.getReader();
  const decoder = new TextDecoder("utf-8");
  let buffer = "";
  let responseCompleted = false;
  let finalImageBase64 = "";
  const partialImages = [];
  const events = [];
  const heartbeatInterval = Number(statusHeartbeatMs || 0);
  const heartbeatTimer =
    Number.isFinite(heartbeatInterval) && heartbeatInterval > 0
      ? setInterval(() => {
          void emitEvent(onEvent, {
            type: "status",
            stage: "waiting_final",
            message: formatStatusHeartbeatMessage("waiting_final", heartbeatInterval),
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
        readResult = await reader.read();
      } catch (error) {
        const retryableReadError = isRetryableStreamReadError(error);
        const canUseBufferedResult = (finalImageBase64 || responseCompleted) && retryableReadError;

        if (canUseBufferedResult) {
          return {
            finalImageBase64,
            partialImages,
            responseCompleted,
            events,
          };
        }

        if (retryableReadError) {
          return {
            finalImageBase64,
            partialImages,
            responseCompleted,
            events,
            streamInterrupted: true,
            streamErrorMessage: error.message,
          };
        }

        throw error;
      }

      const { done, value } = readResult;
      if (done) {
        if (buffer.trim()) {
          const shouldStop = await processChunk(buffer);
          if (shouldStop) {
            return {
              finalImageBase64,
              partialImages,
              responseCompleted,
              events,
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
          };
        }
      }
    }
  } finally {
    if (heartbeatTimer) {
      clearInterval(heartbeatTimer);
    }
  }

  return {
    finalImageBase64,
    partialImages,
    responseCompleted,
    events,
  };
}

function summarizeEvents(events = []) {
  const uniqueEvents = [...new Set(events.filter(Boolean))];
  return uniqueEvents.length > 0 ? uniqueEvents.join(", ") : "无";
}

function buildNoFinalImageMessage(result) {
  return `上游响应结束，但没有拿到最终图片。已收到事件：${summarizeEvents(result?.events)}。请降低分辨率或并发后重试；如果仍失败，请检查兼容端点是否返回 image_generation_call.result。`;
}

async function readJsonResponse(response) {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  return JSON.parse(text);
}

async function readFinalImageFromJsonResponse(response) {
  const payload = await readJsonResponse(response);
  return (
    extractImageBase64("response.completed", { response: payload?.response || payload }) ||
    extractImageBase64(String(payload?.type || ""), payload)
  );
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

async function fetchImageUrlAsBase64(url, fetchImpl) {
  const response = await fetchImpl(url, {
    method: "GET",
    headers: {
      Accept: "image/*",
    },
  });

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "Direct image URL fetch failed",
        status: response.status,
        body: await response.text(),
      }),
    );
  }

  return arrayBufferToBase64(await response.arrayBuffer());
}

async function readDirectFinalImageFromJsonResponse(response, fetchImpl) {
  const payload = await readJsonResponse(response);
  if (payload?.error) {
    throw new Error(formatUpstreamError(payload.error) || "Direct image generation failed.");
  }

  const base64 = extractDirectImageBase64(payload);
  if (base64) {
    return base64;
  }

  const imageUrl = extractDirectImageUrl(payload);
  if (imageUrl) {
    return fetchImageUrlAsBase64(imageUrl, fetchImpl);
  }

  return "";
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
}) {
  await emitEvent(onEvent, {
    type: "status",
    stage: "connecting",
    message: "Connecting direct image model.",
  });

  const normalizedEndpointPath = getEffectiveDirectEndpointPath(endpointPath, referenceImages);
  const endpoint = `${normalizeBaseUrl(baseUrl)}/${normalizedEndpointPath}`;
  let requestBody;
  let isMultipartRequest = false;
  if (normalizedEndpointPath === API_ENDPOINT_IMAGE_EDITS) {
    isMultipartRequest = true;
    requestBody = await createImageEditFormData({
      prompt: buildImageEditPromptWithReferenceLabels(prompt, referenceImageLabels),
      sourceImages: Array.isArray(referenceImages) ? referenceImages.filter(Boolean) : [],
      size,
      quality,
      format,
      imageModel,
    });
  } else if (normalizedEndpointPath === API_ENDPOINT_RESPONSES) {
    requestBody = createResponsesRequestBody({
      prompt,
      referenceImages,
      referenceImageLabels,
      size,
      quality,
      format,
      responsesModel: responsesModel || imageModel,
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
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: requestHeaders,
    body: isMultipartRequest ? requestBody : JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "Direct image generation failed",
        status: response.status,
        body: await response.text(),
      }),
    );
  }

  await emitEvent(onEvent, {
    type: "status",
    stage: "waiting_final",
    message: "Waiting for direct image result.",
  });

  const finalImageBase64 = await readDirectFinalImageFromJsonResponse(response, fetchImpl);
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
  };
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
}) {
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
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify(requestBody),
  });

  if (!response.ok) {
    throw new Error(formatModelProtocolHttpError({ status: response.status, body: await response.text(), endpointPath }));
  }

  await emitEvent(onEvent, {
    type: "status",
    stage: "waiting_final",
    message: "Waiting for model protocol image result.",
  });

  const finalImageBase64 = await readDirectFinalImageFromJsonResponse(response, fetchImpl);
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
}) {
  await emitEvent(onEvent, {
    type: "status",
    stage: "connecting",
    message: "Connecting image edit model.",
  });

  const endpoint = `${normalizeBaseUrl(baseUrl)}/images/edits`;
  const response = await fetchImpl(endpoint, {
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
  });

  if (!response.ok) {
    throw new Error(
      formatHttpErrorMessage({
        label: "Image edit request failed",
        status: response.status,
        body: await response.text(),
      }),
    );
  }

  await emitEvent(onEvent, {
    type: "status",
    stage: "waiting_final",
    message: "Waiting for image edit result.",
  });

  const finalImageBase64 = await readDirectFinalImageFromJsonResponse(response, fetchImpl);
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
  transientHttpMaxRetries = DEFAULT_TRANSIENT_HTTP_MAX_RETRIES,
  transientHttpRetryDelayMs = DEFAULT_TRANSIENT_HTTP_RETRY_DELAY_MS,
  generationMaxRetries = transientHttpMaxRetries,
  onEvent,
}) {
  await emitEvent(onEvent, {
    type: "status",
    stage: "connecting",
    message: "正在连接上游服务",
  });

  const normalizedEndpointPath = normalizeApiEndpointPath(endpointPath, API_ENDPOINT_RESPONSES);
  const endpoint = `${normalizeBaseUrl(baseUrl)}/${normalizedEndpointPath}`;
  if (normalizedEndpointPath === API_ENDPOINT_CHAT_COMPLETIONS) {
    const response = await fetchImpl(endpoint, {
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
    });

    if (!response.ok) {
      throw new Error(
        formatHttpErrorMessage({
          label: "Responses image generation failed",
          status: response.status,
          body: await response.text(),
        }),
      );
    }

    await emitEvent(onEvent, {
      type: "status",
      stage: "waiting_final",
      message: "正在等待最终图片",
    });

    const finalImageBase64 = await readDirectFinalImageFromJsonResponse(response, fetchImpl);
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

  let effectiveSize = size;
  let sizeFallbackUsed = false;
  const buildRequestInit = (stream, requestSize = effectiveSize) => ({
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      Accept: stream ? "text/event-stream" : "application/json",
    },
    body: JSON.stringify(
      createResponsesRequestBody({
        prompt,
        referenceImages,
        referenceImageLabels,
        size: requestSize,
        quality,
        format,
        responsesModel,
        reasoningEffort,
        stream,
      }),
    ),
  });

  const fetchWithHeartbeat = (
    stream,
    requestSize = effectiveSize,
    message = formatStatusHeartbeatMessage("waiting_upstream", statusHeartbeatMs),
    stage = "waiting_upstream",
  ) =>
    waitWithStatusHeartbeat(fetchImpl(endpoint, buildRequestInit(stream, requestSize)), {
      onEvent,
      intervalMs: statusHeartbeatMs,
      message,
      stage,
    });

  const maxTransientHttpRetries = Math.max(0, Math.floor(Number(transientHttpMaxRetries) || 0));
  const fetchStreamingResponseWithTransientRetries = async (requestSize = effectiveSize) => {
    let retryCount = 0;

    while (true) {
      const currentResponse = await fetchWithHeartbeat(true, requestSize);
      if (currentResponse.ok || !shouldRetryTransientHttpStatus(currentResponse.status)) {
        return {
          response: currentResponse,
          body: "",
        };
      }

      const body = await currentResponse.text();
      if (retryCount >= maxTransientHttpRetries) {
        return {
          response: currentResponse,
          body,
        };
      }

      retryCount += 1;
      await emitEvent(onEvent, {
        type: "status",
        stage: "retrying_upstream",
        message: `上游服务短暂异常（HTTP ${currentResponse.status}），正在重试 ${retryCount}/${maxTransientHttpRetries}`,
      });
      await wait(getTransientRetryDelayMs(transientHttpRetryDelayMs, retryCount));
    }
  };

  const requestNonStreamingFinalImage = async ({ streamFallbackUsed = false } = {}) => {
    const fallbackResponse = await fetchWithHeartbeat(
      false,
      effectiveSize,
      formatStatusHeartbeatMessage("waiting_final", statusHeartbeatMs),
      "waiting_final",
    );
    if (!fallbackResponse.ok) {
      const message = formatHttpErrorMessage({
        label: "生成请求失败",
        status: fallbackResponse.status,
        body: await fallbackResponse.text(),
      });
      if (shouldRetryTransientHttpStatus(fallbackResponse.status)) {
        throw createRetryableGenerationError(message);
      }
      throw new Error(message);
    }

    const fallbackBase64 = await readFinalImageFromJsonResponse(fallbackResponse);
    if (!fallbackBase64) {
      return "";
    }

    await emitEvent(onEvent, {
      type: "final_image",
      base64: fallbackBase64,
    });

    return {
      finalImageBase64: fallbackBase64,
      responseCompleted: true,
      fallbackUsed: true,
      streamFallbackUsed,
      sizeFallbackUsed,
      requestedSize: size,
      effectiveSize,
      format,
      endpointPath: normalizedEndpointPath,
    };
  };

  const maxGenerationRetries = Math.max(0, Math.floor(Number(generationMaxRetries) || 0));
  let generationRetryCount = 0;

  while (true) {
    try {
      let response;
      let responseBody = "";
      try {
        const streamResult = await fetchStreamingResponseWithTransientRetries();
        response = streamResult.response;
        responseBody = streamResult.body;
      } catch (error) {
        await emitEvent(onEvent, {
          type: "status",
          stage: "connecting",
          message: "Streaming connection failed. Retrying without streaming.",
        });
        const fallbackResult = await requestNonStreamingFinalImage({ streamFallbackUsed: true });
        if (fallbackResult) {
          return fallbackResult;
        }
        throw createRetryableGenerationError(
          "Streaming connection failed and non-streaming fallback returned no final image.",
          error,
        );
      }

      if (!response.ok) {
        let body = responseBody || (await response.text());
        const fallbackSize = shouldRetryInvalidImageSize({
          status: response.status,
          body,
          size: effectiveSize,
        });

        if (fallbackSize) {
          effectiveSize = fallbackSize;
          sizeFallbackUsed = true;
          await emitEvent(onEvent, {
            type: "status",
            stage: "connecting",
            message: `上游拒绝该分辨率，正在使用兼容尺寸 ${fallbackSize} 重试`,
          });
          const streamResult = await fetchStreamingResponseWithTransientRetries(effectiveSize);
          response = streamResult.response;
          body = response.ok ? "" : streamResult.body || (await response.text());
        }

        if (response.ok) {
          // Continue with the successful retry response below.
        } else if (shouldRetryWithoutStreaming({ status: response.status, body })) {
          await emitEvent(onEvent, {
            type: "status",
            stage: "connecting",
            message: "Streaming was rejected upstream. Retrying without streaming.",
          });
          const fallbackResult = await requestNonStreamingFinalImage({ streamFallbackUsed: true });
          if (fallbackResult) {
            return fallbackResult;
          }
          throw createRetryableGenerationError("Non-streaming fallback returned no final image.");
        } else {
          throw new Error(
            formatHttpErrorMessage({
              label: "生成请求失败",
              status: response.status,
              body,
            }),
          );
        }
      }

      if (!response.body) {
        throw new Error("接口没有返回可读取的流。");
      }

      await emitEvent(onEvent, {
        type: "status",
        stage: "generating",
        message: "正在生成图片",
      });

      const result = await consumeResponsesSse(response.body, {
        onEvent,
        statusHeartbeatMs,
      });

      if (!result.finalImageBase64) {
        const fallbackStatusMessage = result.streamInterrupted
          ? "预览后流式响应中断，正在改用非流式补救获取最终图"
          : "流式响应未返回最终图，正在兜底获取结果";
        await emitEvent(onEvent, {
          type: "status",
          stage: "missing_final_recovery",
          message: fallbackStatusMessage,
        });

        const fallbackResult = await requestNonStreamingFinalImage({
          streamFallbackUsed: Boolean(result.streamInterrupted),
        });
        if (!fallbackResult) {
          throw createRetryableGenerationError(buildNoFinalImageMessage(result));
        }

        return {
          ...result,
          ...fallbackResult,
          endpointPath: normalizedEndpointPath,
        };
      }

      return {
        ...result,
        sizeFallbackUsed,
        requestedSize: size,
        effectiveSize,
        format,
        endpointPath: normalizedEndpointPath,
      };
    } catch (error) {
      if (!isRetryableGenerationAttemptError(error) || generationRetryCount >= maxGenerationRetries) {
        throw error;
      }

      generationRetryCount += 1;
      await emitEvent(onEvent, {
        type: "status",
        stage: "retrying_upstream",
        message: getGenerationRetryMessage(error, generationRetryCount, maxGenerationRetries),
      });
      await wait(getTransientRetryDelayMs(transientHttpRetryDelayMs, generationRetryCount));
    }
  }
}

export function encodeChunk(value) {
  return textEncoder.encode(value);
}
