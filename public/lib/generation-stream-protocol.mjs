import { toOutputFormatMimeType } from "./output-format-options.mjs";

export const GENERATION_STREAM_EVENTS = Object.freeze({
  STATUS: "status",
  PARTIAL_IMAGE: "partial_image",
  FINAL_IMAGE: "final_image",
  FINAL_IMAGE_CHUNK: "final_image_chunk",
  SAVED: "saved",
  SERVER_IMAGE: "server_image",
  QUEUED: "queued",
  COMPLETE: "complete",
  ERROR: "error",
});

export const FINAL_IMAGE_CHUNK_SIZE = 48 * 1024;

function normalizeBase64Data(value) {
  return String(value || "")
    .replace(/^data:[^;]+;base64,/i, "")
    .replace(/\s+/g, "");
}

export function buildFinalImageChunkPayloads({
  filename,
  base64,
  format = "png",
  mimeType = toOutputFormatMimeType(format),
  chunkSize = FINAL_IMAGE_CHUNK_SIZE,
} = {}) {
  const normalizedFilename = String(filename || "").trim();
  const normalizedBase64 = normalizeBase64Data(base64);
  const normalizedChunkSize = Number.isFinite(Number(chunkSize)) && Number(chunkSize) > 0
    ? Math.floor(Number(chunkSize))
    : FINAL_IMAGE_CHUNK_SIZE;

  if (!normalizedFilename || !normalizedBase64) {
    return [];
  }

  const total = Math.max(1, Math.ceil(normalizedBase64.length / normalizedChunkSize));
  return Array.from({ length: total }, (_, index) => ({
    filename: normalizedFilename,
    index,
    total,
    mimeType,
    chunk: normalizedBase64.slice(index * normalizedChunkSize, (index + 1) * normalizedChunkSize),
  }));
}

export function recordFinalImageChunk(finalImageChunks, payload = {}) {
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

export function assertGenerationStreamDeliveryOrder(events) {
  const eventNames = events.map((event) => (typeof event === "string" ? event : event?.eventName)).filter(Boolean);
  const savedIndex = eventNames.indexOf(GENERATION_STREAM_EVENTS.SAVED);
  const serverImageIndex = eventNames.indexOf(GENERATION_STREAM_EVENTS.SERVER_IMAGE);
  const completeIndex = eventNames.indexOf(GENERATION_STREAM_EVENTS.COMPLETE);
  const finalDeliveryIndexes = [
    eventNames.indexOf(GENERATION_STREAM_EVENTS.FINAL_IMAGE),
    eventNames.indexOf(GENERATION_STREAM_EVENTS.FINAL_IMAGE_CHUNK),
  ].filter((index) => index >= 0);
  const firstFinalDeliveryIndex = finalDeliveryIndexes.length > 0 ? Math.min(...finalDeliveryIndexes) : -1;

  if (savedIndex >= 0 && serverImageIndex >= 0 && serverImageIndex < savedIndex) {
    throw new Error("server_image must not be emitted before saved");
  }

  if (savedIndex >= 0 && completeIndex >= 0 && completeIndex < savedIndex) {
    throw new Error("complete must not be emitted before saved");
  }

  if (savedIndex >= 0 && (firstFinalDeliveryIndex < 0 || firstFinalDeliveryIndex > savedIndex)) {
    throw new Error("saved must not be emitted before a final image delivery event");
  }

  return true;
}
