import test from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_DIRECT_RESPONSES_MODEL,
  getSelectedImageGenerationConfig,
  getSelectedTextVisionConfig,
  normalizeImageRouteConfig,
} from "../lib/image-route-config.mjs";

test("image route config defaults direct text and vision model independently from direct image model", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "direct",
    directBaseUrl: "https://direct.example.test",
    directApiKey: "direct-key",
  });

  assert.equal(config.imageRoute, "b");
  assert.equal(config.directImageModel, "gpt-image-2");
  assert.equal(config.directResponsesModel, DEFAULT_DIRECT_RESPONSES_MODEL);
  assert.equal(config.directResponsesModel, "gpt-5.5");
});

test("image route config accepts routeB responsesModel as direct text and vision model", () => {
  const config = normalizeImageRouteConfig({
    imageRoute: "b",
    routeB: {
      baseUrl: "https://direct.example.test",
      apiKey: "direct-key",
      imageModel: "vendor-image-pro",
      responsesModel: "vendor-vision-text",
    },
  });

  assert.equal(config.directImageModel, "vendor-image-pro");
  assert.equal(config.directResponsesModel, "vendor-vision-text");
});

test("selected text and vision config uses direct API settings in direct mode", () => {
  const config = {
    imageRoute: "b",
    baseUrl: "https://route-a.example.test/v1",
    apiKey: "route-a-key",
    responsesModel: "gpt-5.4",
    directBaseUrl: "https://direct.example.test/v1",
    directApiKey: "direct-key",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  };

  assert.deepEqual(getSelectedTextVisionConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    apiKey: "direct-key",
    responsesModel: "vendor-vision-text",
  });
  assert.deepEqual(getSelectedImageGenerationConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    apiKey: "direct-key",
    responsesModel: "gpt-5.4",
    imageModel: "vendor-image-pro",
  });
});

test("selected text and vision config preserves route A behavior", () => {
  assert.deepEqual(
    getSelectedTextVisionConfig({
      imageRoute: "a",
      baseUrl: "https://route-a.example.test/v1",
      apiKey: "route-a-key",
      responsesModel: "gpt-5.4",
      directBaseUrl: "https://direct.example.test/v1",
      directApiKey: "direct-key",
      directResponsesModel: "vendor-vision-text",
    }),
    {
      imageRoute: "a",
      baseUrl: "https://route-a.example.test/v1",
      apiKey: "route-a-key",
      responsesModel: "gpt-5.4",
    },
  );
});
