import test from "node:test";
import assert from "node:assert/strict";

import { buildStyleTransferPresetLightboxItem } from "../lib/style-transfer-preset-lightbox.mjs";

test("style transfer preset lightbox item opens the clicked preset image directly", () => {
  const preset = {
    value: "hand-drawn",
    label: "手绘插画",
    beforeImage: "./before.png",
    image: "./after.png",
  };

  const beforeItem = buildStyleTransferPresetLightboxItem({
    preset,
    slot: "before",
    nowIso: () => "2026-07-05T00:00:00.000Z",
  });
  const afterItem = buildStyleTransferPresetLightboxItem({
    preset,
    slot: "after",
    nowIso: () => "2026-07-05T00:00:00.000Z",
  });

  assert.equal(beforeItem.id, "style-transfer-preset:hand-drawn:before");
  assert.equal(beforeItem.filename, "hand-drawn-before.png");
  assert.equal(beforeItem.imageModel, "风格预设");
  assert.equal(beforeItem.imageUrl, "./before.png");
  assert.equal(beforeItem.thumbnailUrl, "./before.png");
  assert.equal(beforeItem.prompt, "风格：手绘插画");
  assert.equal(beforeItem.paramsText, "预设风格：手绘插画\n预览内容：风格前原图");
  assert.equal(beforeItem.isPreviewLightboxItem, true);

  assert.equal(afterItem.id, "style-transfer-preset:hand-drawn:after");
  assert.equal(afterItem.filename, "hand-drawn-after.png");
  assert.equal(afterItem.imageUrl, "./after.png");
  assert.equal(afterItem.thumbnailUrl, "./after.png");
  assert.equal(afterItem.paramsText, "预设风格：手绘插画\n预览内容：风格后原图");
  assert.equal(afterItem.isPreviewLightboxItem, true);

  assert.equal(buildStyleTransferPresetLightboxItem({ preset, slot: "unknown" }), null);
});
