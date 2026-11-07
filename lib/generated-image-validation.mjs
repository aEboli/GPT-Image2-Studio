import { inspectSvg } from "./svg-assets.mjs";

const PNG_SIGNATURE = Buffer.from("89504e470d0a1a0a", "hex");
const JPEG_SIGNATURE = Buffer.from([0xff, 0xd8]);

const DEFAULT_MINIMUM_DIMENSION = 2;

function asBuffer(value) {
  if (Buffer.isBuffer(value)) {
    return value;
  }

  if (value instanceof Uint8Array) {
    return Buffer.from(value);
  }

  return null;
}

function imageResult({ valid, format = "", width = 0, height = 0, reason = "" }) {
  return {
    valid,
    format,
    width,
    height,
    actualSize: width > 0 && height > 0 ? `${width}x${height}` : "",
    reason,
  };
}

function parseSize(value) {
  const match = String(value || "").trim().toLowerCase().match(/^(\d+)x(\d+)$/);
  if (!match) {
    return null;
  }

  return {
    width: Number(match[1]),
    height: Number(match[2]),
  };
}

function parsePng(buffer) {
  if (buffer.length < 24 || !buffer.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE)) {
    return null;
  }

  const ihdrLength = buffer.readUInt32BE(8);
  if (ihdrLength !== 13 || buffer.toString("ascii", 12, 16) !== "IHDR") {
    return imageResult({ valid: false, format: "png", reason: "malformed-image" });
  }

  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  if (width === 0 || height === 0) {
    return imageResult({ valid: false, format: "png", reason: "invalid-dimensions" });
  }

  let offset = 8;
  let hasEnd = false;
  while (offset + 12 <= buffer.length) {
    const chunkLength = buffer.readUInt32BE(offset);
    const chunkEnd = offset + 12 + chunkLength;
    if (chunkEnd > buffer.length) {
      return imageResult({ valid: false, format: "png", width, height, reason: "malformed-image" });
    }

    if (buffer.toString("ascii", offset + 4, offset + 8) === "IEND") {
      hasEnd = chunkLength === 0;
      break;
    }
    offset = chunkEnd;
  }

  return imageResult({
    valid: hasEnd,
    format: "png",
    width,
    height,
    reason: hasEnd ? "" : "malformed-image",
  });
}

function isJpegStartOfFrame(marker) {
  return (
    (marker >= 0xc0 && marker <= 0xc3) ||
    (marker >= 0xc5 && marker <= 0xc7) ||
    (marker >= 0xc9 && marker <= 0xcb) ||
    (marker >= 0xcd && marker <= 0xcf)
  );
}

// Entropy-coded scan data after SOS is not a marker stream: 0xff00 is a stuffed
// literal 0xff and 0xffd0-0xffd7 are restart markers, both of which belong to the
// scan. Return the offset of the next real marker so the caller resumes segment
// parsing there.
function skipJpegEntropyData(buffer, startOffset) {
  let offset = startOffset;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    let markerOffset = offset;
    while (markerOffset < buffer.length && buffer[markerOffset] === 0xff) {
      markerOffset += 1;
    }
    if (markerOffset >= buffer.length) {
      return buffer.length;
    }

    const next = buffer[markerOffset];
    if (next === 0x00 || (next >= 0xd0 && next <= 0xd7)) {
      offset = markerOffset + 1;
      continue;
    }

    return offset;
  }

  return buffer.length;
}

function parseJpeg(buffer) {
  if (buffer.length < 4 || !buffer.subarray(0, JPEG_SIGNATURE.length).equals(JPEG_SIGNATURE)) {
    return null;
  }

  let offset = 2;
  let width = 0;
  let height = 0;
  let hasEnd = false;

  while (offset < buffer.length) {
    if (buffer[offset] !== 0xff) {
      return imageResult({ valid: false, format: "jpeg", width, height, reason: "malformed-image" });
    }

    while (offset < buffer.length && buffer[offset] === 0xff) {
      offset += 1;
    }
    if (offset >= buffer.length) {
      break;
    }

    const marker = buffer[offset];
    offset += 1;
    if (marker === 0xd9) {
      hasEnd = true;
      break;
    }
    if (marker === 0x00 || marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) {
      continue;
    }
    if (marker === 0xd8) {
      continue;
    }

    if (offset + 2 > buffer.length) {
      return imageResult({ valid: false, format: "jpeg", width, height, reason: "malformed-image" });
    }

    const segmentLength = buffer.readUInt16BE(offset);
    if (segmentLength < 2 || offset + segmentLength > buffer.length) {
      return imageResult({ valid: false, format: "jpeg", width, height, reason: "malformed-image" });
    }

    if (isJpegStartOfFrame(marker)) {
      if (segmentLength < 7) {
        return imageResult({ valid: false, format: "jpeg", reason: "malformed-image" });
      }
      height = buffer.readUInt16BE(offset + 3);
      width = buffer.readUInt16BE(offset + 5);
    }

    offset += segmentLength;

    // SOS (0xda) is followed by entropy-coded scan data rather than another
    // segment header, so hand the scan to the stuffing-aware skipper.
    if (marker === 0xda) {
      offset = skipJpegEntropyData(buffer, offset);
    }
  }

  if (!width || !height) {
    return imageResult({ valid: false, format: "jpeg", reason: "malformed-image" });
  }

  return imageResult({
    valid: hasEnd,
    format: "jpeg",
    width,
    height,
    reason: hasEnd ? "" : "malformed-image",
  });
}

function parseWebp(buffer) {
  if (buffer.toString("ascii", 0, 4) !== "RIFF" || buffer.toString("ascii", 8, 12) !== "WEBP") return null;
  const invalid = () => imageResult({ valid: false, format: "webp", reason: "malformed-image" });
  if (buffer.length < 30 || buffer.readUInt32LE(4) + 8 !== buffer.length) return invalid();
  let width = 0, height = 0, hasPixels = false;
  for (let offset = 12; offset < buffer.length;) {
    if (offset + 8 > buffer.length) return invalid();
    const kind = buffer.toString("ascii", offset, offset + 4);
    const length = buffer.readUInt32LE(offset + 4);
    const start = offset + 8;
    if (start + length > buffer.length) return invalid();
    if (kind === "VP8X" && length >= 10) { width = 1 + buffer.readUIntLE(start + 4, 3); height = 1 + buffer.readUIntLE(start + 7, 3); }
    if (kind === "VP8 " && length >= 10 && buffer.toString("hex", start + 3, start + 6) === "9d012a") { width ||= buffer.readUInt16LE(start + 6) & 0x3fff; height ||= buffer.readUInt16LE(start + 8) & 0x3fff; hasPixels = true; }
    if (kind === "VP8L" && length >= 5 && buffer[start] === 0x2f) { const bits = buffer.readUInt32LE(start + 1); width ||= (bits & 0x3fff) + 1; height ||= ((bits >>> 14) & 0x3fff) + 1; hasPixels = true; }
    if (kind === "ANMF" && length > 16) hasPixels = true;
    offset = start + length + (length % 2);
    if (offset > buffer.length) return invalid();
  }
  return width && height && hasPixels ? imageResult({ valid: true, format: "webp", width, height }) : invalid();
}

function parseGif(buffer) {
  if (!["GIF87a", "GIF89a"].includes(buffer.toString("ascii", 0, 6))) return null;
  const invalid = () => imageResult({ valid: false, format: "gif", reason: "malformed-image" });
  if (buffer.length < 14) return invalid();
  const width = buffer.readUInt16LE(6), height = buffer.readUInt16LE(8);
  let offset = 13 + ((buffer[10] & 0x80) ? 3 * (1 << ((buffer[10] & 7) + 1)) : 0);
  let frames = 0;
  const blocks = () => { while (offset < buffer.length) { const length = buffer[offset++]; if (!length) return true; offset += length; if (offset > buffer.length) return false; } return false; };
  while (offset < buffer.length) {
    const kind = buffer[offset++];
    if (kind === 0x3b) return frames && width && height && offset === buffer.length ? { ...imageResult({ valid: true, format: "gif", width, height }), frameCount: frames } : invalid();
    if (kind === 0x21) { offset++; if (!blocks()) return invalid(); }
    else if (kind === 0x2c) {
      if (offset + 9 > buffer.length) return invalid();
      const flags = buffer[offset + 8];
      offset += 9 + ((flags & 0x80) ? 3 * (1 << ((flags & 7) + 1)) : 0);
      if (offset >= buffer.length || buffer[offset] < 2 || buffer[offset] > 8) return invalid();
      offset++;
      if (!blocks()) return invalid();
      frames++;
    } else return invalid();
  }
  return invalid();
}

function parseImage(buffer) {
  return parsePng(buffer) || parseJpeg(buffer) || parseWebp(buffer) || parseGif(buffer) || inspectSvg(buffer) || imageResult({ valid: false, reason: "unsupported-format" });
}

export function inspectGeneratedImage(imageBuffer, { minimumDimension = DEFAULT_MINIMUM_DIMENSION } = {}) {
  const buffer = asBuffer(imageBuffer);
  if (!buffer || buffer.length === 0) {
    return imageResult({ valid: false, reason: "empty" });
  }

  const parsed = parseImage(buffer);
  if (!parsed.valid) {
    return parsed;
  }

  const minDimension = Number.isFinite(Number(minimumDimension))
    ? Math.max(1, Math.floor(Number(minimumDimension)))
    : DEFAULT_MINIMUM_DIMENSION;
  if (parsed.width < minDimension || parsed.height < minDimension) {
    return { ...parsed, valid: false, reason: "too-small" };
  }

  return parsed;
}

export function validateGeneratedImage(imageBuffer, options = {}) {
  const inspection = inspectGeneratedImage(imageBuffer, options);
  if (inspection.valid) {
    return inspection;
  }

  const error = new Error(`Generated image is invalid (${inspection.reason || "unknown"}).`);
  error.code = "INVALID_GENERATED_IMAGE";
  error.reason = inspection.reason || "unknown";
  error.details = inspection;
  throw error;
}

export function isInvalidGeneratedImageMetadata(metadata = {}) {
  const actual = parseSize(metadata.actualSize);
  const requested = parseSize(metadata.size);
  if (!actual || !requested) {
    return false;
  }

  return (
    (actual.width < DEFAULT_MINIMUM_DIMENSION || actual.height < DEFAULT_MINIMUM_DIMENSION) &&
    requested.width >= DEFAULT_MINIMUM_DIMENSION &&
    requested.height >= DEFAULT_MINIMUM_DIMENSION
  );
}

export { DEFAULT_MINIMUM_DIMENSION };
