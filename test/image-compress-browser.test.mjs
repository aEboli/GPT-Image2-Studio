import test from "node:test";
import assert from "node:assert/strict";

import {
  buildCompressedFilename,
  calculateCompressionRatio,
  formatImageCompressSize,
  getImageCompressOutputDescriptor,
  normalizeImageCompressOptions,
} from "../lib/image-compress-browser.mjs";

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
  assert.equal(calculateCompressionRatio(0, 750), "N/A");
});
