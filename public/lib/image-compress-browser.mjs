const OUTPUT_FORMATS = {
  jpeg: { format: "jpeg", mimeType: "image/jpeg", extension: ".jpg", qualitySupported: true },
  png: { format: "png", mimeType: "image/png", extension: ".png", qualitySupported: false },
  webp: { format: "webp", mimeType: "image/webp", extension: ".webp", qualitySupported: true },
};

const SOURCE_TYPE_TO_FORMAT = {
  "image/jpeg": "jpeg",
  "image/jpg": "jpeg",
  "image/png": "png",
  "image/webp": "webp",
};

export function formatImageCompressSize(sizeInBytes) {
  let size = Number(sizeInBytes);
  if (!Number.isFinite(size) || size < 0) {
    size = 0;
  }

  for (const unit of ["B", "KB", "MB", "GB", "TB"]) {
    if (size < 1024 || unit === "TB") {
      return unit === "B" ? `${Math.round(size)} ${unit}` : `${size.toFixed(2)} ${unit}`;
    }
    size /= 1024;
  }

  return `${size.toFixed(2)} TB`;
}

export function calculateCompressionRatio(originalBytes, compressedBytes) {
  const original = Number(originalBytes);
  const compressed = Number(compressedBytes);
  if (!Number.isFinite(original) || original <= 0 || !Number.isFinite(compressed)) {
    return "N/A";
  }

  const ratio = (1 - compressed / original) * 100;
  return ratio < 0 ? `+${Math.abs(ratio).toFixed(1)}%` : `-${ratio.toFixed(1)}%`;
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);
  if (!Number.isFinite(number)) {
    return fallback;
  }
  return Math.min(max, Math.max(min, number));
}

export function normalizeImageCompressOptions(options = {}) {
  const mode = options.mode === "target" ? "target" : "quality";
  const targetSizeMb = mode === "target" ? clampNumber(options.targetSizeMb, 0, 200, 0) : 0;
  const resizeWidth = Math.round(clampNumber(options.resizeWidth, 0, 12000, 0));
  const resizeHeight = Math.round(clampNumber(options.resizeHeight, 0, 12000, 0));

  return {
    mode,
    targetBytes: targetSizeMb > 0 ? Math.round(targetSizeMb * 1024 * 1024) : 0,
    targetSizeMb,
    quality: Math.round(clampNumber(options.quality, 1, 100, 85)),
    outputFormat: OUTPUT_FORMATS[options.outputFormat] ? options.outputFormat : "original",
    resizeEnabled: Boolean(options.resizeEnabled) && resizeWidth > 0 && resizeHeight > 0,
    resizeWidth,
    resizeHeight,
  };
}

export function getImageCompressOutputDescriptor(outputFormat = "original", sourceType = "") {
  const normalizedFormat = OUTPUT_FORMATS[outputFormat] ? outputFormat : "original";
  const sourceFormat = SOURCE_TYPE_TO_FORMAT[String(sourceType || "").toLowerCase()] || "jpeg";
  return { ...OUTPUT_FORMATS[normalizedFormat === "original" ? sourceFormat : normalizedFormat] };
}

export function buildCompressedFilename(originalName, descriptor, rules = {}) {
  const sourceName = String(originalName || "image");
  const dotIndex = sourceName.lastIndexOf(".");
  const baseName = dotIndex > 0 ? sourceName.slice(0, dotIndex) : sourceName;
  const prefix = rules.prefix ?? descriptor?.prefix ?? "compressed_";
  const suffix = rules.suffix ?? descriptor?.suffix ?? "";
  const extension = descriptor?.extension || ".jpg";
  return `${prefix}${baseName}${suffix}${extension}`;
}

function createCanvasElement(width, height) {
  if (typeof OffscreenCanvas === "function") {
    return new OffscreenCanvas(width, height);
  }
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function getCanvasContext(canvas) {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    throw new Error("浏览器无法创建图片压缩画布。");
  }
  return context;
}

async function loadImageBitmap(file) {
  if (typeof createImageBitmap === "function") {
    return createImageBitmap(file);
  }

  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.decoding = "async";
    image.src = url;
    await image.decode();
    return image;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function getImageDimensions(image) {
  return {
    width: image.width || image.naturalWidth || 0,
    height: image.height || image.naturalHeight || 0,
  };
}

function getDominantCanvasColor(canvas) {
  const context = getCanvasContext(canvas);
  const width = Math.max(1, Math.min(64, canvas.width || 1));
  const height = Math.max(1, Math.min(64, canvas.height || 1));
  const sampleCanvas = createCanvasElement(width, height);
  const sampleContext = getCanvasContext(sampleCanvas);
  sampleContext.drawImage(canvas, 0, 0, width, height);
  const data = sampleContext.getImageData(0, 0, width, height).data;
  const buckets = new Map();

  for (let index = 0; index < data.length; index += 4) {
    if (data[index + 3] < 16) {
      continue;
    }
    const red = Math.floor(data[index] / 16) * 16 + 8;
    const green = Math.floor(data[index + 1] / 16) * 16 + 8;
    const blue = Math.floor(data[index + 2] / 16) * 16 + 8;
    const key = `${red},${green},${blue}`;
    buckets.set(key, (buckets.get(key) || 0) + 1);
  }

  let bestKey = "248,248,248";
  let bestCount = 0;
  for (const [key, count] of buckets) {
    if (count > bestCount) {
      bestKey = key;
      bestCount = count;
    }
  }

  return `rgb(${bestKey})`;
}

function drawSourceCanvas(image, descriptor) {
  const dimensions = getImageDimensions(image);
  if (dimensions.width <= 0 || dimensions.height <= 0) {
    throw new Error("无法读取图片尺寸。");
  }

  const canvas = createCanvasElement(dimensions.width, dimensions.height);
  const context = getCanvasContext(canvas);
  if (descriptor.mimeType === "image/jpeg") {
    context.fillStyle = "#ffffff";
    context.fillRect(0, 0, canvas.width, canvas.height);
  }
  context.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas;
}

function resizeCanvasWithPadding(sourceCanvas, options, descriptor) {
  if (!options.resizeEnabled) {
    return sourceCanvas;
  }

  const targetWidth = options.resizeWidth;
  const targetHeight = options.resizeHeight;
  const resizedCanvas = createCanvasElement(targetWidth, targetHeight);
  const context = getCanvasContext(resizedCanvas);
  const ratio = Math.min(targetWidth / sourceCanvas.width, targetHeight / sourceCanvas.height);
  const width = Math.max(1, Math.round(sourceCanvas.width * ratio));
  const height = Math.max(1, Math.round(sourceCanvas.height * ratio));
  const x = Math.round((targetWidth - width) / 2);
  const y = Math.round((targetHeight - height) / 2);

  context.fillStyle = descriptor.mimeType === "image/jpeg" ? getDominantCanvasColor(sourceCanvas) : "rgba(0, 0, 0, 0)";
  context.fillRect(0, 0, targetWidth, targetHeight);
  context.drawImage(sourceCanvas, x, y, width, height);
  return resizedCanvas;
}

function canvasToBlob(canvas, mimeType, quality) {
  if (typeof canvas.convertToBlob === "function") {
    return canvas.convertToBlob({ type: mimeType, quality });
  }

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }
        reject(new Error("图片压缩失败，浏览器没有返回输出文件。"));
      },
      mimeType,
      quality,
    );
  });
}

async function encodeCanvas(canvas, descriptor, qualityPercent) {
  const quality = descriptor.qualitySupported ? clampNumber(qualityPercent, 1, 100, 85) / 100 : undefined;
  return canvasToBlob(canvas, descriptor.mimeType, quality);
}

async function encodeToTargetSize(canvas, descriptor, targetBytes) {
  if (!descriptor.qualitySupported || !targetBytes) {
    return { blob: await encodeCanvas(canvas, descriptor, 100), quality: 100 };
  }

  let low = 5;
  let high = 95;
  let bestBlob = null;
  let bestQuality = 85;
  let smallestBlob = null;
  let smallestQuality = 5;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    const blob = await encodeCanvas(canvas, descriptor, mid);
    if (!smallestBlob || blob.size < smallestBlob.size) {
      smallestBlob = blob;
      smallestQuality = mid;
    }
    if (blob.size <= targetBytes) {
      bestBlob = blob;
      bestQuality = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return {
    blob: bestBlob || smallestBlob || (await encodeCanvas(canvas, descriptor, 85)),
    quality: bestBlob ? bestQuality : smallestQuality,
  };
}

export async function compressImageFile(file, options = {}) {
  if (!(file instanceof File) || !String(file.type || "").startsWith("image/")) {
    throw new Error("请选择有效的图片文件。");
  }

  const normalizedOptions = normalizeImageCompressOptions(options);
  const descriptor = getImageCompressOutputDescriptor(normalizedOptions.outputFormat, file.type);
  const image = await loadImageBitmap(file);
  const sourceCanvas = drawSourceCanvas(image, descriptor);
  const outputCanvas = resizeCanvasWithPadding(sourceCanvas, normalizedOptions, descriptor);
  const encoded =
    normalizedOptions.mode === "target"
      ? await encodeToTargetSize(outputCanvas, descriptor, normalizedOptions.targetBytes)
      : { blob: await encodeCanvas(outputCanvas, descriptor, normalizedOptions.quality), quality: normalizedOptions.quality };

  if (typeof image.close === "function") {
    image.close();
  }

  const resultUrl = URL.createObjectURL(encoded.blob);
  const fileName = buildCompressedFilename(file.name, descriptor);
  return {
    fileName,
    originalName: file.name,
    originalSize: file.size,
    outputSize: encoded.blob.size,
    ratio: calculateCompressionRatio(file.size, encoded.blob.size),
    blob: encoded.blob,
    url: resultUrl,
    mimeType: descriptor.mimeType,
    format: descriptor.format,
    quality: encoded.quality,
    width: outputCanvas.width,
    height: outputCanvas.height,
  };
}
