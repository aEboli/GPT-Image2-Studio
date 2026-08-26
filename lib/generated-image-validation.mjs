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

function parseImage(buffer) {
  return parsePng(buffer) || parseJpeg(buffer) || imageResult({ valid: false, reason: "unsupported-format" });
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
