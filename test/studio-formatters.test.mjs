import test from "node:test";
import assert from "node:assert/strict";

import {
  buildParameterText,
  formatImageModelLabel,
  formatRecentOutputMeta,
} from "../lib/studio-formatters.mjs";

test("formatImageModelLabel normalizes gpt-image-2 into a UI label", () => {
  assert.equal(formatImageModelLabel("gpt-image-2"), "GPT Image 2.0");
  assert.equal(formatImageModelLabel("custom-model"), "custom-model");
  assert.equal(formatImageModelLabel(""), "GPT Image 2.0");
});

test("buildParameterText includes reasoning effort and multiple reference image names", () => {
  const result = buildParameterText(
    {
      ratioLabel: "标准 4:5",
      size: "1024x1280",
      actualSize: "2048x2560",
      format: "jpeg",
      quality: "high",
      imageModel: "gpt-image-2",
      responsesModel: "gpt-5.4",
      reasoningEffort: "xhigh",
      hasReferenceImage: true,
      referenceImageNames: ["girl-a.jpeg", "girl-b.jpeg"],
      baseUrl: "https://api.openai.com/v1",
      absolutePath: "C:/output/demo.jpeg",
      generationDurationMs: 1234,
    },
    {},
  );

  assert.match(result, /比例：标准 4:5/);
  assert.match(result, /请求分辨率：1024x1280/);
  assert.match(result, /实际生成分辨率：2048x2560/);
  assert.match(result, /图像模型：GPT Image 2.0/);
  assert.match(result, /思考等级：XHigh/);
  assert.match(result, /图片生成耗时：1\.2 秒/);
  assert.match(result, /参考图：有（2 张：girl-a\.jpeg, girl-b\.jpeg）/);
  assert.match(result, /中转：https:\/\/api\.openai\.com\/v1/);
  assert.match(result, /本地文件：C:\/output\/demo\.jpeg/);
});

test("buildParameterText explicitly shows when no reference image was used", () => {
  const result = buildParameterText({
    ratio: "16:9",
    size: "1536x864",
    imageModel: "gpt-image-2",
    hasReferenceImage: false,
  });

  assert.match(result, /参考图：无/);
});

test("buildParameterText shows call mode and omits Responses-only fields for direct image calls", () => {
  const result = buildParameterText(
    {
      imageRoute: "b",
      size: "1024x1024",
      imageModel: "gpt-image-2",
      baseUrl: "https://direct-item.example/v1",
      responsesModel: "gpt-5.4-mini",
      reasoningEffort: "xhigh",
    },
    {
      baseUrl: "https://route-a.example/v1",
      directBaseUrl: "https://direct-config.example/v1",
      responsesModel: "gpt-5.5",
    },
  );

  assert.match(result, /调用模式：直接调用模式/);
  assert.doesNotMatch(result, /思考等级：/);
  assert.doesNotMatch(result, /外层模型：/);
  assert.match(result, /中转：https:\/\/direct-item\.example\/v1/);

  const fallbackResult = buildParameterText(
    { generationRoute: "direct", size: "1024x1024", imageModel: "gpt-image-2" },
    { baseUrl: "https://route-a.example/v1", directBaseUrl: "https://direct-config.example/v1" },
  );

  assert.match(fallbackResult, /调用模式：直接调用模式/);
  assert.doesNotMatch(fallbackResult, /外层模型：/);
  assert.doesNotMatch(fallbackResult, /中转：https:\/\/route-a\.example\/v1/);
  assert.match(fallbackResult, /中转：https:\/\/direct-config\.example\/v1/);
});

test("formatRecentOutputMeta composes canvas and model summary", () => {
  const result = formatRecentOutputMeta({
    size: "1024 x 1280",
    imageModel: "gpt-image-2",
  });

  assert.equal(result, "1024 x 1280 | GPT Image 2.0");
});
