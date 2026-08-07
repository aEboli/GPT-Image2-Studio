import test from "node:test";
import assert from "node:assert/strict";

import { buildStyleTransferPresetComparisonItem } from "../lib/style-transfer-preset-lightbox.mjs";

test("style transfer preset comparison item always contains the ordered before and after pair", () => {
  const preset = {
    value: "hand-drawn",
    label: "手绘插画",
    beforeImage: "./before.png",
    image: "./after.png",
  };

  const comparisonItem = buildStyleTransferPresetComparisonItem({
    preset,
    nowIso: () => "2026-07-05T00:00:00.000Z",
  });

  assert.deepEqual(comparisonItem, {
    id: "style-transfer-preset:hand-drawn:comparison",
    filename: "hand-drawn-comparison.png",
    imageUrl: "./before.png",
    thumbnailUrl: "./before.png",
    createdAt: "2026-07-05T00:00:00.000Z",
    prompt: "",
    comparisonImages: [
      {
        slot: "before",
        imageUrl: "./before.png",
        alt: "手绘插画 风格前原图",
      },
      {
        slot: "after",
        imageUrl: "./after.png",
        alt: "手绘插画 风格后效果图",
      },
    ],
    isPreviewLightboxItem: true,
    isStyleTransferComparisonItem: true,
  });
  assert.equal("imageModel" in comparisonItem, false);
  assert.equal("paramsText" in comparisonItem, false);
});

test("style transfer preset comparison requires both source and result images", () => {
  assert.equal(buildStyleTransferPresetComparisonItem(), null);
  assert.equal(buildStyleTransferPresetComparisonItem({
    preset: { value: "cinematic-photo", label: "电影写实", beforeImage: "./before.png" },
  }), null);
  assert.equal(buildStyleTransferPresetComparisonItem({
    preset: { value: "cinematic-photo", label: "电影写实", image: "./after.png" },
  }), null);
});
