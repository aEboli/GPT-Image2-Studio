import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompressedFilename,
  calculateCompressionRatio,
  compressImageFile,
  formatImageCompressSize,
  getImageCompressOutputDescriptor,
  normalizeImageCompressOptions,
} from "../lib/image-compress-browser.mjs";

test("image compression closes decoded bitmap when canvas encoding fails", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  let closed = false;
  globalThis.createImageBitmap = async () => ({
    width: 4,
    height: 4,
    close() { closed = true; },
  });
  globalThis.OffscreenCanvas = class {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() { return { drawImage() {} }; }
    convertToBlob() { throw new Error("encode failed"); }
  };

  try {
    await assert.rejects(
      compressImageFile(new File(["image"], "sample.png", { type: "image/png" }), { outputFormat: "png" }),
      /encode failed/,
    );
    assert.equal(closed, true);
  } finally {
    globalThis.createImageBitmap = originalCreateImageBitmap;
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
  }
});

test("image compression keeps the original file when same-format encoding is larger", async () => {
  const originalCreateImageBitmap = globalThis.createImageBitmap;
  const originalOffscreenCanvas = globalThis.OffscreenCanvas;
  const originalCreateObjectUrl = URL.createObjectURL;
  let outputBlob = null;
  globalThis.createImageBitmap = async () => ({ width: 4, height: 4, close() {} });
  globalThis.OffscreenCanvas = class {
    constructor(width, height) { this.width = width; this.height = height; }
    getContext() { return { drawImage() {} }; }
    async convertToBlob() { return new Blob(["encoded output is larger"] , { type: "image/png" }); }
  };
  URL.createObjectURL = (blob) => {
    outputBlob = blob;
    return "blob:compressed-result";
  };

  try {
    const file = new File(["small"], "sample.png", { type: "image/png" });
    const result = await compressImageFile(file, { outputFormat: "original" });
    assert.equal(outputBlob, file);
    assert.equal(result.blob, file);
    assert.equal(result.outputSize, file.size);
    assert.equal(result.ratio, "0.0%");
  } finally {
    globalThis.createImageBitmap = originalCreateImageBitmap;
    globalThis.OffscreenCanvas = originalOffscreenCanvas;
    URL.createObjectURL = originalCreateObjectUrl;
  }
});

test("image compression helpers normalize quality, target size, output format, and resize settings", () => {
  assert.deepEqual(
    normalizeImageCompressOptions({
      mode: "target",
      targetSizeMb: "0.35",
      quality: "102",
      outputFormat: "webp",
      resizeEnabled: true,
      resizeWidth: "2000",
      resizeHeight: "0",
    }),
    {
      mode: "target",
      targetBytes: 367002,
      targetSizeMb: 0.35,
      quality: 100,
      outputFormat: "webp",
      resizeEnabled: false,
      resizeWidth: 2000,
      resizeHeight: 0,
    },
  );

  assert.deepEqual(normalizeImageCompressOptions({ mode: "quality", quality: "8", outputFormat: "png" }), {
    mode: "quality",
    targetBytes: 0,
    targetSizeMb: 0,
    quality: 8,
    outputFormat: "png",
    resizeEnabled: false,
    resizeWidth: 0,
    resizeHeight: 0,
  });
});

test("image compression helpers expose browser-safe output descriptors and filenames", () => {
  assert.deepEqual(getImageCompressOutputDescriptor("jpeg", "image/png"), {
    format: "jpeg",
    mimeType: "image/jpeg",
    extension: ".jpg",
    qualitySupported: true,
  });

  assert.deepEqual(getImageCompressOutputDescriptor("original", "image/webp"), {
    format: "webp",
    mimeType: "image/webp",
    extension: ".webp",
    qualitySupported: true,
  });

  assert.equal(buildCompressedFilename("hero.final.png", { extension: ".webp" }), "compressed_hero.final.webp");
  assert.equal(buildCompressedFilename("photo", { extension: ".jpg", prefix: "", suffix: "_small" }), "photo_small.jpg");
});

test("image compression helpers format byte sizes and savings ratios", () => {
  assert.equal(formatImageCompressSize(512), "512 B");
  assert.equal(formatImageCompressSize(1536), "1.50 KB");
  assert.equal(formatImageCompressSize(2.5 * 1024 * 1024), "2.50 MB");
  assert.equal(calculateCompressionRatio(2000, 500), "-75.0%");
  assert.equal(calculateCompressionRatio(500, 750), "+50.0%");
  assert.equal(calculateCompressionRatio(500, 500), "0.0%");
  assert.equal(calculateCompressionRatio(0, 750), "N/A");
});
