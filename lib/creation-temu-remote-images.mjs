import { lookup as nodeLookup } from "node:dns/promises";

export const CREATION_TEMU_REMOTE_IMAGE_LIMITS = Object.freeze({
  maxRedirects: 3,
  timeoutMs: 12_000,
  maxBytes: 15 * 1024 * 1024,
  maxConcurrency: 10,
});

const REDIRECT_STATUSES = new Set([301, 302, 303, 307, 308]);
const JPEG_START_OF_FRAME_MARKERS = new Set([
  0xc0, 0xc1, 0xc2, 0xc3,
  0xc5, 0xc6, 0xc7,
  0xc9, 0xca, 0xcb,
  0xcd, 0xce, 0xcf,
]);

export class CreationTemuRemoteImageError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = "CreationTemuRemoteImageError";
    this.code = code;
    if (options.cause !== undefined) this.cause = options.cause;
  }
}

function remoteImageError(code, message, cause) {
  return new CreationTemuRemoteImageError(code, message, { cause });
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function boundedInteger(value, fallback, minimum, maximum) {
  const parsed = Math.floor(Number(value));
  if (!Number.isFinite(parsed) || parsed < minimum) return fallback;
  return Math.min(parsed, maximum);
}

function normalizeHostname(value) {
  return cleanString(value).replace(/^\[|\]$/gu, "").replace(/\.$/u, "").toLowerCase();
}

function parseIpv4Bytes(value) {
  const parts = cleanString(value).split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part))) return null;
  const bytes = parts.map(Number);
  return bytes.some((part) => part < 0 || part > 255) ? null : bytes;
}

function ipv4Number(bytes) {
  return (
    ((bytes[0] << 24) >>> 0) +
    (bytes[1] << 16) +
    (bytes[2] << 8) +
    bytes[3]
  ) >>> 0;
}

function ipv4InCidr(value, base, prefixLength) {
  const mask = prefixLength === 0 ? 0 : (0xffffffff << (32 - prefixLength)) >>> 0;
  return (value & mask) === (base & mask);
}

function isNonPublicIpv4Bytes(bytes) {
  const value = ipv4Number(bytes);
  return [
    [0x00000000, 8],
    [0x0a000000, 8],
    [0x64400000, 10],
    [0x7f000000, 8],
    [0xa9fe0000, 16],
    [0xac100000, 12],
    [0xc0000000, 24],
    [0xc0000200, 24],
    [0xc0a80000, 16],
    [0xc0586300, 24],
    [0xc6120000, 15],
    [0xc6336400, 24],
    [0xcb007100, 24],
    [0xe0000000, 4],
    [0xf0000000, 4],
  ].some(([base, prefixLength]) => ipv4InCidr(value, base, prefixLength));
}

function parseIpv6Bytes(value) {
  let normalized = normalizeHostname(value);
  if (!normalized || normalized.includes("%")) return null;

  if (normalized.includes(".")) {
    const separator = normalized.lastIndexOf(":");
    if (separator < 0) return null;
    const ipv4 = parseIpv4Bytes(normalized.slice(separator + 1));
    if (!ipv4) return null;
    const high = ((ipv4[0] << 8) | ipv4[1]).toString(16);
    const low = ((ipv4[2] << 8) | ipv4[3]).toString(16);
    normalized = `${normalized.slice(0, separator)}:${high}:${low}`;
  }

  const halves = normalized.split("::");
  if (halves.length > 2) return null;
  const parseHalf = (half) => {
    if (!half) return [];
    const groups = half.split(":");
    if (groups.some((group) => !/^[0-9a-f]{1,4}$/u.test(group))) return null;
    return groups.map((group) => Number.parseInt(group, 16));
  };
  const left = parseHalf(halves[0]);
  const right = parseHalf(halves[1] || "");
  if (!left || !right) return null;
  const omitted = 8 - left.length - right.length;
  if ((halves.length === 1 && omitted !== 0) || (halves.length === 2 && omitted < 1)) return null;
  const groups = halves.length === 2
    ? [...left, ...Array.from({ length: omitted }, () => 0), ...right]
    : left;
  if (groups.length !== 8) return null;

  const bytes = new Uint8Array(16);
  groups.forEach((group, index) => {
    bytes[index * 2] = group >> 8;
    bytes[index * 2 + 1] = group & 0xff;
  });
  return bytes;
}

function bytesAreZero(bytes, start, end) {
  for (let index = start; index < end; index += 1) {
    if (bytes[index] !== 0) return false;
  }
  return true;
}

function isNonPublicIpv6Bytes(bytes) {
  if (bytesAreZero(bytes, 0, 15) && (bytes[15] === 0 || bytes[15] === 1)) return true;

  const ipv4Mapped = bytesAreZero(bytes, 0, 10) && bytes[10] === 0xff && bytes[11] === 0xff;
  const ipv4Compatible = bytesAreZero(bytes, 0, 12);
  if (ipv4Mapped || ipv4Compatible) {
    return isNonPublicIpv4Bytes([...bytes.slice(12, 16)]);
  }

  if ((bytes[0] & 0xfe) === 0xfc) return true;
  if (bytes[0] === 0xfe && (bytes[1] & 0xc0) >= 0x80) return true;
  if (bytes[0] === 0xff) return true;
  if (bytes[0] === 0x20 && bytes[1] === 0x01 && bytes[2] === 0x0d && bytes[3] === 0xb8) return true;
  if (bytes[0] === 0x20 && bytes[1] === 0x02) {
    return isNonPublicIpv4Bytes([...bytes.slice(2, 6)]);
  }
  return false;
}

function isNonPublicAddress(value) {
  const ipv4 = parseIpv4Bytes(value);
  if (ipv4) return isNonPublicIpv4Bytes(ipv4);
  const ipv6 = parseIpv6Bytes(value);
  if (ipv6) return isNonPublicIpv6Bytes(ipv6);
  return true;
}

function normalizeRemoteImageUrl(value) {
  const text = cleanString(value);
  if (!text || text.length > 8192) {
    throw remoteImageError("REMOTE_IMAGE_URL_INVALID", "远程图片地址无效。");
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    throw remoteImageError("REMOTE_IMAGE_URL_INVALID", "远程图片地址无效。");
  }
  if (url.protocol !== "https:" || url.username || url.password || !url.hostname) {
    throw remoteImageError("REMOTE_IMAGE_URL_INVALID", "远程图片必须使用无凭据的公网 HTTPS 地址。");
  }
  const hostname = normalizeHostname(url.hostname);
  if (!hostname || hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) {
    throw remoteImageError("REMOTE_IMAGE_PRIVATE_ADDRESS", "远程图片地址指向本机或非公网主机。");
  }
  url.hash = "";
  return url;
}

function literalAddress(hostname) {
  if (parseIpv4Bytes(hostname)) return hostname;
  return parseIpv6Bytes(hostname) ? hostname : "";
}

async function assertPublicDnsTarget(url, lookup) {
  const hostname = normalizeHostname(url.hostname);
  const literal = literalAddress(hostname);
  if (literal) {
    if (isNonPublicAddress(literal)) {
      throw remoteImageError("REMOTE_IMAGE_PRIVATE_ADDRESS", "远程图片地址解析到私有、回环或保留网络。");
    }
    return;
  }

  let resolved;
  try {
    resolved = await lookup(hostname, { all: true, verbatim: true });
  } catch (cause) {
    throw remoteImageError("REMOTE_IMAGE_DNS_FAILED", "远程图片主机无法完成 DNS 解析。", cause);
  }
  const records = Array.isArray(resolved) ? resolved : [resolved];
  const addresses = records
    .map((record) => cleanString(typeof record === "string" ? record : record?.address))
    .filter(Boolean);
  if (!addresses.length) {
    throw remoteImageError("REMOTE_IMAGE_DNS_FAILED", "远程图片主机没有可验证的 DNS 地址。");
  }
  if (addresses.some(isNonPublicAddress)) {
    throw remoteImageError("REMOTE_IMAGE_PRIVATE_ADDRESS", "远程图片地址解析到私有、回环或保留网络。");
  }
}

function asBuffer(value) {
  if (Buffer.isBuffer(value)) return value;
  if (value instanceof Uint8Array) return Buffer.from(value.buffer, value.byteOffset, value.byteLength);
  if (value instanceof ArrayBuffer) return Buffer.from(value);
  return Buffer.alloc(0);
}

function positiveDimensions(width, height, format) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width <= 0 || height <= 0) {
    throw remoteImageError("REMOTE_IMAGE_DIMENSIONS_INVALID", "无法读取远程图片的有效尺寸。");
  }
  return { width, height, format };
}

function parsePngDimensions(bytes) {
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  if (bytes.length < 24 || !bytes.subarray(0, 8).equals(signature) || bytes.toString("ascii", 12, 16) !== "IHDR") {
    return null;
  }
  return positiveDimensions(bytes.readUInt32BE(16), bytes.readUInt32BE(20), "png");
}

function parseJpegDimensions(bytes) {
  if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8) return null;
  let offset = 2;
  while (offset + 1 < bytes.length) {
    while (offset < bytes.length && bytes[offset] !== 0xff) offset += 1;
    while (offset < bytes.length && bytes[offset] === 0xff) offset += 1;
    if (offset >= bytes.length) break;
    const marker = bytes[offset];
    offset += 1;
    if (marker === 0xd9 || marker === 0xda) break;
    if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
    if (offset + 2 > bytes.length) break;
    const segmentLength = bytes.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > bytes.length) break;
    if (JPEG_START_OF_FRAME_MARKERS.has(marker) && segmentLength >= 7) {
      return positiveDimensions(
        bytes.readUInt16BE(offset + 5),
        bytes.readUInt16BE(offset + 3),
        "jpeg",
      );
    }
    offset += segmentLength;
  }
  throw remoteImageError("REMOTE_IMAGE_DIMENSIONS_INVALID", "无法读取 JPEG 图片尺寸。");
}

function readUInt24Le(bytes, offset) {
  return bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
}

function parseWebpDimensions(bytes) {
  if (
    bytes.length < 20 ||
    bytes.toString("ascii", 0, 4) !== "RIFF" ||
    bytes.toString("ascii", 8, 12) !== "WEBP"
  ) return null;

  let offset = 12;
  while (offset + 8 <= bytes.length) {
    const chunkType = bytes.toString("ascii", offset, offset + 4);
    const chunkLength = bytes.readUInt32LE(offset + 4);
    const dataOffset = offset + 8;
    const dataEnd = dataOffset + chunkLength;
    if (dataEnd > bytes.length) break;

    if (chunkType === "VP8X" && chunkLength >= 10) {
      return positiveDimensions(
        readUInt24Le(bytes, dataOffset + 4) + 1,
        readUInt24Le(bytes, dataOffset + 7) + 1,
        "webp",
      );
    }
    if (
      chunkType === "VP8 " &&
      chunkLength >= 10 &&
      bytes[dataOffset + 3] === 0x9d &&
      bytes[dataOffset + 4] === 0x01 &&
      bytes[dataOffset + 5] === 0x2a
    ) {
      return positiveDimensions(
        bytes.readUInt16LE(dataOffset + 6) & 0x3fff,
        bytes.readUInt16LE(dataOffset + 8) & 0x3fff,
        "webp",
      );
    }
    if (chunkType === "VP8L" && chunkLength >= 5 && bytes[dataOffset] === 0x2f) {
      const width = 1 + bytes[dataOffset + 1] + ((bytes[dataOffset + 2] & 0x3f) << 8);
      const height = 1 + ((bytes[dataOffset + 2] & 0xc0) >> 6) +
        (bytes[dataOffset + 3] << 2) + ((bytes[dataOffset + 4] & 0x0f) << 10);
      return positiveDimensions(width, height, "webp");
    }
    offset = dataEnd + (chunkLength % 2);
  }
  throw remoteImageError("REMOTE_IMAGE_DIMENSIONS_INVALID", "无法读取 WebP 图片尺寸。");
}

export function parseCreationTemuRemoteImageDimensions(value) {
  const bytes = asBuffer(value);
  const parsed = parsePngDimensions(bytes) || parseJpegDimensions(bytes) || parseWebpDimensions(bytes);
  if (parsed) return parsed;
  throw remoteImageError(
    "REMOTE_IMAGE_FORMAT_UNSUPPORTED",
    "远程图片不是受支持的 PNG、JPEG 或 WebP 格式。",
  );
}

async function cancelResponseBody(response) {
  try {
    await response?.body?.cancel?.();
  } catch {
    // The response is already closed or cannot be cancelled.
  }
}

async function readResponseBytes(response, maxBytes) {
  const declaredLength = Number(response?.headers?.get?.("content-length"));
  if (Number.isFinite(declaredLength) && declaredLength > maxBytes) {
    throw remoteImageError("REMOTE_IMAGE_TOO_LARGE", "远程图片超过 15 MiB 验证上限。");
  }

  const reader = response?.body?.getReader?.();
  if (!reader) {
    let bytes;
    try {
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch (cause) {
      throw remoteImageError("REMOTE_IMAGE_BODY_UNREADABLE", "远程图片响应无法读取。", cause);
    }
    if (bytes.byteLength > maxBytes) {
      throw remoteImageError("REMOTE_IMAGE_TOO_LARGE", "远程图片超过 15 MiB 验证上限。");
    }
    return asBuffer(bytes);
  }

  const chunks = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = value instanceof Uint8Array ? value : new Uint8Array(value || 0);
      total += chunk.byteLength;
      if (total > maxBytes) {
        await reader.cancel().catch(() => {});
        throw remoteImageError("REMOTE_IMAGE_TOO_LARGE", "远程图片超过 15 MiB 验证上限。");
      }
      chunks.push(Buffer.from(chunk));
    }
  } catch (cause) {
    if (cause instanceof CreationTemuRemoteImageError) throw cause;
    throw remoteImageError("REMOTE_IMAGE_BODY_UNREADABLE", "远程图片响应无法读取。", cause);
  }
  return Buffer.concat(chunks, total);
}

function assertSquareDimensions(result, role, label) {
  const normalizedRole = cleanString(role).toLowerCase();
  if (!["sku", "material"].includes(normalizedRole)) return;
  if (result.width <= 800 || result.height <= 800 || result.width !== result.height) {
    const isMaterial = normalizedRole === "material";
    throw remoteImageError(
      isMaterial ? "MATERIAL_IMAGE_DIMENSIONS_INVALID" : "SKU_IMAGE_DIMENSIONS_INVALID",
      `${cleanString(label) || (isMaterial ? "产品素材图" : "SKU 图片")}必须为宽高均大于 800 像素的正方形。`,
    );
  }
}

async function fetchAndInspectRemoteImage({
  initialUrl,
  role,
  label,
  fetchImpl,
  lookup,
  maxRedirects,
  maxBytes,
  signal,
}) {
  let currentUrl = initialUrl;
  let redirectCount = 0;

  while (true) {
    await assertPublicDnsTarget(currentUrl, lookup);
    let response;
    try {
      response = await fetchImpl(currentUrl.href, {
        method: "GET",
        redirect: "manual",
        headers: { accept: "image/*" },
        signal,
      });
    } catch (cause) {
      if (signal.aborted) {
        throw remoteImageError("REMOTE_IMAGE_TIMEOUT", "远程图片验证超过 12 秒。", cause);
      }
      throw remoteImageError("REMOTE_IMAGE_FETCH_FAILED", "远程图片请求失败。", cause);
    }
    if (!response || typeof response.status !== "number") {
      throw remoteImageError("REMOTE_IMAGE_FETCH_FAILED", "远程图片响应无效。");
    }

    if (REDIRECT_STATUSES.has(response.status)) {
      const location = cleanString(response.headers?.get?.("location"));
      await cancelResponseBody(response);
      if (!location) {
        throw remoteImageError("REMOTE_IMAGE_REDIRECT_INVALID", "远程图片重定向缺少目标地址。");
      }
      if (redirectCount >= maxRedirects) {
        throw remoteImageError("REMOTE_IMAGE_TOO_MANY_REDIRECTS", "远程图片重定向超过 3 次。" );
      }
      try {
        currentUrl = normalizeRemoteImageUrl(new URL(location, currentUrl).href);
      } catch (cause) {
        if (cause instanceof CreationTemuRemoteImageError && cause.code === "REMOTE_IMAGE_PRIVATE_ADDRESS") {
          throw cause;
        }
        throw remoteImageError("REMOTE_IMAGE_REDIRECT_INVALID", "远程图片重定向目标无效。", cause);
      }
      redirectCount += 1;
      continue;
    }

    if (!response.ok) {
      await cancelResponseBody(response);
      throw remoteImageError("REMOTE_IMAGE_HTTP_ERROR", `远程图片服务器返回 HTTP ${response.status}。`);
    }
    const contentType = cleanString(response.headers?.get?.("content-type")).split(";", 1)[0].toLowerCase();
    if (!contentType.startsWith("image/")) {
      await cancelResponseBody(response);
      throw remoteImageError("REMOTE_IMAGE_NOT_IMAGE", "远程地址返回的内容不是图片。");
    }

    const bytes = await readResponseBytes(response, maxBytes);
    const dimensions = parseCreationTemuRemoteImageDimensions(bytes);
    const result = {
      url: currentUrl.href,
      width: dimensions.width,
      height: dimensions.height,
      bytes: bytes.byteLength,
      format: dimensions.format,
      contentType,
      redirectCount,
    };
    assertSquareDimensions(result, role, label);
    return result;
  }
}

export async function verifyCreationTemuRemoteImage({
  url,
  role = "product",
  label = "",
  fetchImpl = globalThis.fetch,
  lookup = nodeLookup,
  maxRedirects = CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxRedirects,
  timeoutMs = CREATION_TEMU_REMOTE_IMAGE_LIMITS.timeoutMs,
  maxBytes = CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxBytes,
} = {}) {
  if (typeof fetchImpl !== "function" || typeof lookup !== "function") {
    throw remoteImageError("REMOTE_IMAGE_DEPENDENCY_INVALID", "远程图片验证依赖不可用。");
  }
  const initialUrl = normalizeRemoteImageUrl(url);
  const redirectLimit = boundedInteger(
    maxRedirects,
    CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxRedirects,
    0,
    CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxRedirects,
  );
  const timeoutLimit = boundedInteger(
    timeoutMs,
    CREATION_TEMU_REMOTE_IMAGE_LIMITS.timeoutMs,
    1,
    CREATION_TEMU_REMOTE_IMAGE_LIMITS.timeoutMs,
  );
  const byteLimit = boundedInteger(
    maxBytes,
    CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxBytes,
    1,
    CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxBytes,
  );
  const controller = new AbortController();
  let timeout;
  const timeoutPromise = new Promise((_, reject) => {
    timeout = setTimeout(() => {
      controller.abort();
      reject(remoteImageError("REMOTE_IMAGE_TIMEOUT", "远程图片验证超过 12 秒。"));
    }, timeoutLimit);
  });

  try {
    return await Promise.race([
      fetchAndInspectRemoteImage({
        initialUrl,
        role,
        label,
        fetchImpl,
        lookup,
        maxRedirects: redirectLimit,
        maxBytes: byteLimit,
        signal: controller.signal,
      }),
      timeoutPromise,
    ]);
  } finally {
    clearTimeout(timeout);
  }
}

function issueSuggestion(code) {
  if (code === "SKU_IMAGE_DIMENSIONS_INVALID" || code === "MATERIAL_IMAGE_DIMENSIONS_INVALID") {
    return code === "MATERIAL_IMAGE_DIMENSIONS_INVALID"
      ? "更换为宽高均大于 800 像素的正方形产品素材图。"
      : "更换为宽高均大于 800 像素的正方形 SKU 图片。";
  }
  if (code === "REMOTE_IMAGE_TOO_LARGE") return "压缩图片到 15 MiB 以内后重试。";
  if (code === "REMOTE_IMAGE_TIMEOUT") return "检查图片托管服务后重试，或更换稳定的公网图片地址。";
  if (code === "REMOTE_IMAGE_FORMAT_UNSUPPORTED" || code === "REMOTE_IMAGE_DIMENSIONS_INVALID") {
    return "改用可正常解析的 PNG、JPEG 或 WebP 图片。";
  }
  return "补充可公开访问的 HTTPS 图片地址后重新导出。";
}

function structuredIssue(entry, error) {
  const normalizedError = error instanceof CreationTemuRemoteImageError
    ? error
    : remoteImageError("REMOTE_IMAGE_FETCH_FAILED", "远程图片验证失败。", error);
  return {
    severity: "error",
    code: normalizedError.code,
    key: entry.key,
    path: entry.path,
    role: entry.role,
    message: normalizedError.message,
    suggestion: issueSuggestion(normalizedError.code),
  };
}

async function runWorkerPool(items, concurrency, worker) {
  let nextIndex = 0;
  async function runWorker() {
    while (nextIndex < items.length) {
      const index = nextIndex;
      nextIndex += 1;
      await worker(items[index]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => runWorker()));
}

export async function verifyCreationTemuRemoteImages({
  entries = [],
  fetchImpl = globalThis.fetch,
  lookup = nodeLookup,
  maxConcurrency = CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxConcurrency,
  maxRedirects = CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxRedirects,
  timeoutMs = CREATION_TEMU_REMOTE_IMAGE_LIMITS.timeoutMs,
  maxBytes = CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxBytes,
} = {}) {
  const normalizedEntries = (Array.isArray(entries) ? entries : []).map((entry, index) => ({
    key: cleanString(entry?.key || entry?.itemKey) || String(index),
    path: cleanString(entry?.path),
    label: cleanString(entry?.label),
    role: cleanString(entry?.role).toLowerCase() || "product",
    url: cleanString(entry?.url),
  }));
  const groups = new Map();
  for (const entry of normalizedEntries) {
    let groupKey;
    try {
      groupKey = normalizeRemoteImageUrl(entry.url).href;
    } catch {
      groupKey = `invalid:${entry.url}`;
    }
    if (!groups.has(groupKey)) groups.set(groupKey, { url: entry.url, entries: [] });
    groups.get(groupKey).entries.push(entry);
  }

  const results = new Map();
  const dimensions = new Map();
  const issues = [];
  let verifiedUrlCount = 0;
  const concurrency = boundedInteger(
    maxConcurrency,
    CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxConcurrency,
    1,
    CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxConcurrency,
  );
  await runWorkerPool([...groups.values()], concurrency, async (group) => {
    let verified;
    try {
      verified = await verifyCreationTemuRemoteImage({
        url: group.url,
        role: "product",
        fetchImpl,
        lookup,
        maxRedirects,
        timeoutMs,
        maxBytes,
      });
      verifiedUrlCount += 1;
    } catch (error) {
      group.entries.forEach((entry) => issues.push(structuredIssue(entry, error)));
      return;
    }

    for (const entry of group.entries) {
      dimensions.set(entry.key, { width: verified.width, height: verified.height });
      try {
        assertSquareDimensions(verified, entry.role, entry.label);
        results.set(entry.key, { ...verified, source: "remote-verified" });
      } catch (error) {
        issues.push(structuredIssue(entry, error));
      }
    }
  });

  return {
    valid: issues.length === 0,
    results,
    dimensions,
    issues,
    imageCount: normalizedEntries.length,
    uniqueUrlCount: groups.size,
    verifiedUrlCount,
  };
}
