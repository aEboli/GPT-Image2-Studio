import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreationRecordLightboxItem,
  normalizeCreationGenerationSnapshotForView,
} from "../lib/creation-record-lightbox.mjs";

test("Creation API snapshots survive browser normalization before lightbox rendering", () => {
  const apiItem = {
    itemId: "item-browser",
    prompt: "planning prompt remains editable",
    generationPrompt: "actual upstream prompt after browser state",
    baseUrl: "https://gateway.example/v1",
    imageRoute: "a",
    responsesModel: "gpt-5.4-mini",
    imageModel: "gpt-image-2",
    endpointPath: "/responses",
    ratio: "1:1",
    ratioLabel: "1:1 方形",
    requestedSize: "2048x2048",
    effectiveSize: "2048x2048",
    actualSize: "1254x1254",
    format: "png",
    quality: "high",
    reasoningEffort: "medium",
    hasReferenceImage: false,
    referenceImageNames: [],
    referenceImageName: "",
    relativePath: "creation/item-browser.png",
  };

  const normalizedItem = {
    itemId: apiItem.itemId,
    prompt: apiItem.prompt,
    ratio: apiItem.ratio,
    relativePath: apiItem.relativePath,
    ...normalizeCreationGenerationSnapshotForView(apiItem),
  };
  const lightboxItem = buildCreationRecordLightboxItem(normalizedItem, { setId: "set-browser" });

  assert.equal(normalizedItem.prompt, "planning prompt remains editable");
  assert.equal(normalizedItem.generationPrompt, "actual upstream prompt after browser state");
  assert.equal(normalizedItem.hasReferenceImage, false);
  assert.deepEqual(normalizedItem.referenceImageNames, []);
  assert.equal(lightboxItem.prompt, "actual upstream prompt after browser state");
  assert.match(lightboxItem.paramsText, /请求分辨率：2048x2048/);
  assert.match(lightboxItem.paramsText, /实际生成分辨率：1254x1254/);
  assert.match(lightboxItem.paramsText, /外层模型：gpt-5\.4-mini/);
  assert.match(lightboxItem.paramsText, /端点：\/responses/);
  assert.match(lightboxItem.paramsText, /参考图：无/);
});

test("creation record lightbox uses the actual generation prompt and saved request snapshot", () => {
  const item = buildCreationRecordLightboxItem({
    itemId: "item-1",
    filename: "item.png",
    relativePath: "creation/item.png",
    prompt: "planning prompt",
    generationPrompt: "actual upstream prompt",
    imageRoute: "a",
    imageModel: "gpt-image-2",
    responsesModel: "gpt-5.4-mini",
    endpointPath: "/responses",
    baseUrl: "https://gateway.example/v1",
    ratio: "1:1",
    requestedSize: "2048x2048",
    effectiveSize: "2048x2048",
    actualSize: "1254x1254",
    format: "png",
    quality: "high",
    reasoningEffort: "medium",
    hasReferenceImage: true,
    referenceImageNames: ["front.png", "detail.png"],
  }, { setId: "set-1", createdAt: "2026-07-15T00:00:00.000Z" });

  assert.equal(item.prompt, "actual upstream prompt");
  assert.match(item.paramsText, /调用模式：路由模式/);
  assert.match(item.paramsText, /请求分辨率：2048x2048/);
  assert.match(item.paramsText, /实际生成分辨率：1254x1254/);
  assert.match(item.paramsText, /外层模型：gpt-5\.4-mini/);
  assert.match(item.paramsText, /参考图：有（2 张：front\.png, detail\.png）/);
  assert.match(item.paramsText, /中转：https:\/\/gateway\.example\/v1/);
});

test("legacy creation record lightbox does not invent parameters from current config", () => {
  const item = buildCreationRecordLightboxItem({
    itemId: "legacy",
    prompt: "legacy planning prompt",
    relativePath: "creation/legacy.png",
  }, { setId: "set-legacy" });

  assert.equal(item.prompt, "legacy planning prompt");
  assert.equal(item.imageModel, "未记录");
  assert.match(item.paramsText, /调用模式：未记录/);
  assert.match(item.paramsText, /格式：未记录/);
  assert.match(item.paramsText, /质量：未记录/);
  assert.match(item.paramsText, /外层模型：未记录/);
  assert.match(item.paramsText, /参考图：未记录/);
  assert.doesNotMatch(item.paramsText, /gpt-5\.4|GPT Image 2\.0|PNG|路由模式/);
});
