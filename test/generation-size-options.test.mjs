import test from "node:test";
import assert from "node:assert/strict";

import {
  getDefaultGenerationSize,
  getDefaultModelProtocolImageSize,
  getGenerationSizeOptions,
  getModelProtocolImageSizeOptions,
  isGenerationSizeCompatible,
  isModelProtocolImageSizeCompatible,
  normalizeGenerationSize,
  normalizeModelProtocolImageSize,
} from "../lib/generation-size-options.mjs";

const EXPECTED_SIZE_OPTIONS = {
  "1:1": ["1024x1024", "1536x1536", "2048x2048", "2560x2560", "2880x2880"],
  "4:3": ["1360x1024", "2048x1536", "2720x2048", "3312x2480"],
  "3:4": ["1024x1360", "1536x2048", "2048x2720", "2480x3312"],
  "3:2": ["1536x1024", "2304x1536", "3072x2048", "3520x2352"],
  "2:3": ["1024x1536", "1536x2304", "2048x3072", "2352x3520"],
  "5:4": ["1280x1024", "1920x1536", "2560x2048", "3200x2560"],
  "4:5": ["1024x1280", "1536x1920", "2048x2560", "2560x3200"],
  "16:9": ["1824x1024", "2736x1536", "3648x2048", "3840x2160"],
  "9:16": ["1024x1824", "1536x2736", "2048x3648", "2160x3840"],
  "21:9": ["2384x1024", "1680x720", "3584x1536", "3840x1648"],
  "9:21": ["1024x2384", "720x1680", "1536x3584", "1648x3840"],
  "2:1": ["2048x1024", "3072x1536", "3840x1920"],
  "1:2": ["1024x2048", "1536x3072", "1920x3840"],
  "3:1": ["3072x1024", "3840x1280"],
  "1:3": ["1024x3072", "1280x3840"],
};

const RATIO_PARTS = {
  "1:1": [1, 1],
  "4:3": [4, 3],
  "3:4": [3, 4],
  "3:2": [3, 2],
  "2:3": [2, 3],
  "5:4": [5, 4],
  "4:5": [4, 5],
  "16:9": [16, 9],
  "9:16": [9, 16],
  "21:9": [7, 3],
  "9:21": [3, 7],
  "2:1": [2, 1],
  "1:2": [1, 2],
  "3:1": [3, 1],
  "1:3": [1, 3],
};

const MIN_IMAGE_PIXELS = 655_360;
const MAX_IMAGE_PIXELS = 8_294_400;
const MAX_EDGE_PIXELS = 3840;
const MAX_LONG_TO_SHORT_RATIO = 3;
const MAX_RATIO_ROUNDING_DELTA = 64;

test("size options match the provided gpt-image-2 ratio table", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    assert.deepEqual(getGenerationSizeOptions(ratio).map((option) => option.value), ["auto", ...sizes]);
  }
});

test("size options satisfy official gpt-image-2 size constraints", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    const [ratioWidth, ratioHeight] = RATIO_PARTS[ratio];

    for (const size of sizes) {
      const [width, height] = size.split("x").map(Number);
      const area = width * height;
      const longEdge = Math.max(width, height);
      const shortEdge = Math.min(width, height);
      const ratioDelta = Math.abs(width * ratioHeight - height * ratioWidth);

      assert.equal(width % 16, 0, `${ratio} ${size} width should be divisible by 16`);
      assert.equal(height % 16, 0, `${ratio} ${size} height should be divisible by 16`);
      assert.ok(ratioDelta <= MAX_RATIO_ROUNDING_DELTA, `${ratio} ${size} should stay close to its named ratio`);
      assert.ok(area >= MIN_IMAGE_PIXELS, `${ratio} ${size} should be at least ${MIN_IMAGE_PIXELS} pixels`);
      assert.ok(area <= MAX_IMAGE_PIXELS, `${ratio} ${size} should not exceed ${MAX_IMAGE_PIXELS} pixels`);
      assert.ok(longEdge <= MAX_EDGE_PIXELS, `${ratio} ${size} longest edge should not exceed ${MAX_EDGE_PIXELS}`);
      assert.ok(longEdge / shortEdge <= MAX_LONG_TO_SHORT_RATIO, `${ratio} ${size} ratio should stay within 3:1`);
    }
  }
});

test("size compatibility rejects stale and mismatched resolutions", () => {
  assert.equal(isGenerationSizeCompatible("1:1", "2816x2816"), false);
  assert.equal(isGenerationSizeCompatible("4:5", "832x1040"), false);
  assert.equal(isGenerationSizeCompatible("4:5", "896x1120"), false);
  assert.equal(isGenerationSizeCompatible("9:16", "720x1280"), false);
  assert.equal(isGenerationSizeCompatible("16:9", "1280x720"), false);
  assert.equal(isGenerationSizeCompatible("21:9", "3808x1632"), false);
  assert.equal(isGenerationSizeCompatible("3:4", "1536x1920"), false);
  assert.equal(isGenerationSizeCompatible("9:21", "3840x1648"), false);
});

test("size compatibility accepts the provided maximum resolutions including the pixel cap boundary", () => {
  assert.equal(isGenerationSizeCompatible("1:1", "2880x2880"), true);
  assert.equal(isGenerationSizeCompatible("4:5", "2560x3200"), true);
  assert.equal(isGenerationSizeCompatible("5:4", "3200x2560"), true);
  assert.equal(isGenerationSizeCompatible("3:4", "2480x3312"), true);
  assert.equal(isGenerationSizeCompatible("4:3", "3312x2480"), true);
  assert.equal(isGenerationSizeCompatible("2:3", "2352x3520"), true);
  assert.equal(isGenerationSizeCompatible("3:2", "3520x2352"), true);
  assert.equal(isGenerationSizeCompatible("9:16", "2160x3840"), true);
  assert.equal(isGenerationSizeCompatible("16:9", "3840x2160"), true);
  assert.equal(isGenerationSizeCompatible("1:2", "1920x3840"), true);
  assert.equal(isGenerationSizeCompatible("2:1", "3840x1920"), true);
  assert.equal(isGenerationSizeCompatible("21:9", "1680x720"), true);
  assert.equal(isGenerationSizeCompatible("21:9", "3840x1648"), true);
  assert.equal(isGenerationSizeCompatible("9:21", "720x1680"), true);
  assert.equal(isGenerationSizeCompatible("9:21", "1648x3840"), true);
  assert.equal(isGenerationSizeCompatible("3:1", "3840x1280"), true);
  assert.equal(isGenerationSizeCompatible("1:3", "1280x3840"), true);
});

test("auto defaults use the first 1K candidate for each ratio", () => {
  for (const [ratio, sizes] of Object.entries(EXPECTED_SIZE_OPTIONS)) {
    assert.equal(getDefaultGenerationSize(ratio), sizes[0], `${ratio} should default to ${sizes[0]}`);
  }
});

test("normalizeGenerationSize falls back to auto for invalid resolutions", () => {
  assert.equal(normalizeGenerationSize("4:5", "2048x2560"), "2048x2560");
  assert.equal(normalizeGenerationSize("4:5", "2048x2048"), "auto");
  assert.equal(getDefaultGenerationSize("9:21"), "1024x2384");
});

test("model protocol image size options use provider scale values instead of pixel resolutions", () => {
  assert.deepEqual(getModelProtocolImageSizeOptions().map((option) => option.value), ["auto", "512", "1K", "2K", "4K"]);
  assert.equal(getDefaultModelProtocolImageSize(), "1K");
  assert.equal(normalizeModelProtocolImageSize("1k"), "1K");
  assert.equal(normalizeModelProtocolImageSize("2K"), "2K");
  assert.equal(normalizeModelProtocolImageSize("1024x1024"), "auto");
  assert.equal(isModelProtocolImageSizeCompatible("4K"), true);
  assert.equal(isModelProtocolImageSizeCompatible("2048x2048"), false);
});
