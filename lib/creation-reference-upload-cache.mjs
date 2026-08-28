// A creation suite sends the SAME reference bytes on every per-item upstream request:
// 20 items x up to 15 references means one image is re-transmitted dozens of times, and
// repair sends them again. This module gives one request a single place to register those
// bytes and, where the route supports it, to trade them for an upstream file identifier
// that later items can reference instead of re-uploading.
//
// The registry is created per request and never shared. Reference bytes belong to the
// caller who uploaded them, so a process-wide cache keyed on content would let one
// session's suite reference another session's image.
//
// A file identifier is only meaningful to the upstream that issued it, and repair items
// each carry their own saved baseUrl and route, so identifiers are stored per upstream
// target rather than once per image.

import { createHash } from "node:crypto";

import { normalizeApiBaseUrl } from "./api-base-url.mjs";

export const REFERENCE_UPLOAD_PURPOSE = "vision";
export const REFERENCE_UPLOAD_ENDPOINT_PATH = "files";
// Uploading is a latency win, not a requirement. A slow or hanging /v1/files must not
// delay the first item longer than the inline path would have taken anyway.
export const REFERENCE_UPLOAD_TIMEOUT_MS = 30_000;
// Below this size the inline payload is not what makes a suite slow, and an upload
// round-trip per image would cost more than it saves.
export const REFERENCE_UPLOAD_MIN_BYTES = 32 * 1024;

function normalizeMimeType(value) {
  return String(value || "").trim() || "application/octet-stream";
}

function normalizeFilename(value, fallback) {
  return String(value || "").trim() || fallback;
}

function toBuffer(image) {
  if (Buffer.isBuffer(image?.buffer)) {
    return image.buffer;
  }
  if (typeof image?.base64 === "string" && image.base64) {
    return Buffer.from(image.base64.replace(/^data:[^;]*;base64,/i, ""), "base64");
  }
  return null;
}

export function fingerprintReferenceImage(image) {
  const buffer = toBuffer(image);
  if (!buffer || buffer.byteLength === 0) {
    return "";
  }
  return createHash("sha256").update(buffer).digest("hex");
}

// Two references with identical bytes but different declared mime types must not collapse:
// the upstream is told the type, so a PNG entry cannot stand in for a JPEG one.
function buildRegistryKey(image) {
  const fingerprint = fingerprintReferenceImage(image);
  return fingerprint ? `${fingerprint}:${normalizeMimeType(image?.mimeType)}` : "";
}

// The key must separate two different upstreams AND two different keys on the same
// upstream, because a file uploaded under one credential is not readable under another.
// The credential is hashed so it never reaches a log or an error message.
export function buildReferenceUploadTargetKey({ baseUrl, apiKey } = {}) {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  const credential = String(apiKey || "");
  if (!normalizedBaseUrl || !credential) {
    return "";
  }
  return `${normalizedBaseUrl}\n${createHash("sha256").update(credential).digest("hex")}`;
}

export function createCreationReferenceRegistry() {
  const entriesByKey = new Map();

  function register(image) {
    const key = buildRegistryKey(image);
    if (!key) {
      return null;
    }

    const existing = entriesByKey.get(key);
    if (existing) {
      return existing;
    }

    const buffer = toBuffer(image);
    const entry = {
      key,
      fingerprint: key.split(":", 1)[0],
      filename: normalizeFilename(image?.filename, `reference-${entriesByKey.size + 1}`),
      mimeType: normalizeMimeType(image?.mimeType),
      buffer,
      base64: typeof image?.base64 === "string" && image.base64 ? image.base64 : buffer.toString("base64"),
      byteLength: buffer.byteLength,
      // targetKey -> { fileId, attempted }
      uploadsByTarget: new Map(),
    };
    entriesByKey.set(key, entry);
    return entry;
  }

  function resolve(image) {
    const key = buildRegistryKey(image);
    return key ? entriesByKey.get(key) || null : null;
  }

  return {
    register,
    resolve,
    registerAll(images = []) {
      return (Array.isArray(images) ? images : []).map((image) => register(image)).filter(Boolean);
    },
    entries() {
      return [...entriesByKey.values()];
    },
    get size() {
      return entriesByKey.size;
    },
  };
}

export function getReferenceEntryFileId(entry, targetKey) {
  if (!entry || !targetKey) {
    return "";
  }
  return entry.uploadsByTarget?.get(targetKey)?.fileId || "";
}

// An upstream that does not implement /v1/files answers with 404, HTML, or a JSON error.
// None of those should fail an item, so every failure resolves to an empty id and the
// caller keeps sending inline bytes. The recorded attempt makes that decision once per
// target instead of re-probing a dead endpoint for all 20 items.
export function hasAttemptedReferenceEntryUpload(entry, targetKey) {
  if (!entry || !targetKey) {
    return false;
  }
  return entry.uploadsByTarget?.get(targetKey)?.attempted === true;
}

export function markReferenceEntryUploaded(entry, targetKey, fileId) {
  if (!entry || !targetKey) {
    return "";
  }
  const normalized = String(fileId || "").trim();
  entry.uploadsByTarget.set(targetKey, { fileId: normalized, attempted: true });
  return normalized;
}

export function markReferenceEntryUploadFailed(entry, targetKey) {
  if (!entry || !targetKey) {
    return;
  }
  entry.uploadsByTarget.set(targetKey, { fileId: "", attempted: true });
}

// Maps the per-item reference list onto registry entries so an item that reuses the same
// bytes as a previous item resolves to the same entry, and so a reference the registry
// never saw still renders as inline bytes rather than disappearing from the request.
export function buildReferenceUploadDescriptors(registry, referenceImages = [], targetKey = "") {
  const images = Array.isArray(referenceImages) ? referenceImages.filter(Boolean) : [];
  return images.map((image) => {
    const entry = registry?.resolve?.(image) || null;
    return { image, entry, fileId: getReferenceEntryFileId(entry, targetKey) };
  });
}

// Rewrites a per-item reference list so uploaded entries carry `fileId` and everything
// else keeps its inline bytes. The returned objects are copies: the registry entry stays
// the single source of truth for the bytes, and the label order the caller built stays
// aligned because the list length never changes.
export function applyReferenceFileIds(registry, referenceImages = [], targetKey = "") {
  return buildReferenceUploadDescriptors(registry, referenceImages, targetKey).map(({ image, fileId }) =>
    fileId ? { ...image, fileId } : image,
  );
}

function extractUploadedFileId(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  return String(payload.id || payload.file_id || payload.data?.id || "").trim();
}

async function uploadReferenceEntry(entry, { baseUrl, apiKey, fetchImpl, signal, timeoutMs }) {
  const endpoint = `${normalizeApiBaseUrl(baseUrl)}/${REFERENCE_UPLOAD_ENDPOINT_PATH}`;
  const body = new FormData();
  body.append("purpose", REFERENCE_UPLOAD_PURPOSE);
  body.append("file", new Blob([entry.buffer], { type: entry.mimeType }), entry.filename);

  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  const uploadSignal = signal ? AbortSignal.any([signal, timeoutSignal]) : timeoutSignal;
  const response = await fetchImpl(endpoint, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      Accept: "application/json",
    },
    body,
    signal: uploadSignal,
  });

  if (!response.ok) {
    return "";
  }

  // A proxy that does not implement /v1/files often answers 200 with an HTML page, so a
  // non-JSON body is a failed upload rather than a thrown request.
  const payload = await response.json().catch(() => null);
  return extractUploadedFileId(payload);
}

// Uploads every registered reference once per upstream target. Returns how many entries
// ended up usable so the caller can log the outcome. Never throws: a failed upload only
// means the suite keeps its existing inline behaviour.
export async function prepareReferenceUploads(
  registry,
  {
    baseUrl,
    apiKey,
    fetchImpl = fetch,
    signal,
    timeoutMs = REFERENCE_UPLOAD_TIMEOUT_MS,
    minBytes = REFERENCE_UPLOAD_MIN_BYTES,
    onEvent,
  } = {},
) {
  const targetKey = buildReferenceUploadTargetKey({ baseUrl, apiKey });
  const allEntries = registry?.entries?.() || [];
  const entries = targetKey
    ? allEntries.filter(
        (entry) => !hasAttemptedReferenceEntryUpload(entry, targetKey) && entry.byteLength >= minBytes,
      )
    : [];
  if (entries.length === 0) {
    return { targetKey, attempted: 0, uploaded: 0 };
  }

  let uploaded = 0;
  // Sequential on purpose: the first entry tells us whether this upstream supports the
  // endpoint at all, and a proxy that does not should cost one failed request rather than
  // fifteen simultaneous ones.
  for (const entry of entries) {
    try {
      const fileId = await uploadReferenceEntry(entry, { baseUrl, apiKey, fetchImpl, signal, timeoutMs });
      if (fileId) {
        markReferenceEntryUploaded(entry, targetKey, fileId);
        uploaded += 1;
      } else {
        markReferenceEntryUploadFailed(entry, targetKey);
        break;
      }
    } catch {
      markReferenceEntryUploadFailed(entry, targetKey);
      break;
    }
  }

  // Entries after an aborted pass never got a chance; mark them so no later item retries.
  allEntries.forEach((entry) => {
    if (!hasAttemptedReferenceEntryUpload(entry, targetKey)) {
      markReferenceEntryUploadFailed(entry, targetKey);
    }
  });

  await onEvent?.({ targetKey, attempted: entries.length, uploaded });
  return { targetKey, attempted: entries.length, uploaded };
}
