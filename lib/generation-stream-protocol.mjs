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

// Creation Mode carries its own item-scoped event names alongside the prompt-mode
// set above. Both server and client import this so the wire name has one source.
export const CREATION_STREAM_EVENTS = Object.freeze({
  ITEM_FINAL_IMAGE: "item_final_image",
  ITEM_FINAL_IMAGE_CHUNK: "item_final_image_chunk",
});

function normalizeBase64Data(value) {
  return String(value || "")
    .replace(/^data:[^;]+;base64,/i, "")
    .replace(/\s+/g, "");
}

// Prompt mode assembles by filename because one request yields one saved file.
// Creation Mode streams many items concurrently and has no filename until the item
// is saved, so it assembles by set + item instead. Both collapse to one opaque key.
export function buildFinalImageChunkKey({ filename, setId, itemId } = {}) {
  const normalizedSetId = String(setId || "").trim();
  const normalizedItemId = String(itemId || "").trim();
  if (normalizedSetId && normalizedItemId) {
    return `${normalizedSetId}::${normalizedItemId}`;
  }
  return String(filename || "").trim();
}

export function buildFinalImageChunkPayloads({
  filename,
  setId,
  itemId,
  base64,
  format = "png",
  mimeType = toOutputFormatMimeType(format),
  chunkSize = FINAL_IMAGE_CHUNK_SIZE,
} = {}) {
  const normalizedFilename = String(filename || "").trim();
  const normalizedSetId = String(setId || "").trim();
  const normalizedItemId = String(itemId || "").trim();
  const normalizedBase64 = normalizeBase64Data(base64);
  const normalizedChunkSize = Number.isFinite(Number(chunkSize)) && Number(chunkSize) > 0
    ? Math.floor(Number(chunkSize))
    : FINAL_IMAGE_CHUNK_SIZE;

  const hasIdentity = Boolean(normalizedFilename || (normalizedSetId && normalizedItemId));
  if (!hasIdentity || !normalizedBase64) {
    return [];
  }

  const total = Math.max(1, Math.ceil(normalizedBase64.length / normalizedChunkSize));
  return Array.from({ length: total }, (_, index) => ({
    ...(normalizedFilename ? { filename: normalizedFilename } : {}),
    ...(normalizedSetId ? { setId: normalizedSetId } : {}),
    ...(normalizedItemId ? { itemId: normalizedItemId } : {}),
    index,
    total,
    mimeType,
    chunk: normalizedBase64.slice(index * normalizedChunkSize, (index + 1) * normalizedChunkSize),
  }));
}

export function recordFinalImageChunk(finalImageChunks, payload = {}) {
  const key = buildFinalImageChunkKey(payload);
  const index = Number(payload.index);
  const total = Number(payload.total);
  const chunk = String(payload.chunk || "");
  const mimeType = String(payload.mimeType || "image/png");

  if (!key || !Number.isInteger(index) || !Number.isInteger(total) || total <= 0 || index < 0 || index >= total || !chunk) {
    return "";
  }

  const existing = finalImageChunks.get(key) || {
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

  finalImageChunks.set(key, existing);
  return existing.dataUrl;
}

export function clearFinalImageChunks(finalImageChunks, { setId = "" } = {}) {
  if (!finalImageChunks || typeof finalImageChunks.keys !== "function") {
    return;
  }

  const normalizedSetId = String(setId || "").trim();
  if (!normalizedSetId) {
    finalImageChunks.clear();
    return;
  }

  const prefix = `${normalizedSetId}::`;
  for (const key of [...finalImageChunks.keys()]) {
    if (String(key).startsWith(prefix)) {
      finalImageChunks.delete(key);
    }
  }
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
