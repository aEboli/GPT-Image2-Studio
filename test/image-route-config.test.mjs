import test from "node:test";
import assert from "node:assert/strict";

import {
  API_ENDPOINT_CHAT_COMPLETIONS,
  API_ENDPOINT_IMAGE_GENERATIONS,
  API_ENDPOINT_RESPONSES,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  appendApiEndpointPath,
  getSelectedImageGenerationConfig,
  getSelectedTextVisionConfig,
  splitApiEndpointUrl,
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
  assert.equal(config.endpointPath, API_ENDPOINT_RESPONSES);
  assert.equal(config.directEndpointPath, API_ENDPOINT_IMAGE_GENERATIONS);
});

test("image route config splits full endpoint URLs into base URLs and endpoint paths", () => {
  const config = normalizeImageRouteConfig({
    baseUrl: "https://route-a.example.test/v1/responses",
    directBaseUrl: "https://direct.example.test/v1/chat/completions",
    directEndpointPath: "images/generations",
  });

  assert.equal(config.baseUrl, "https://route-a.example.test/v1");
  assert.equal(config.endpointPath, API_ENDPOINT_RESPONSES);
  assert.equal(config.directBaseUrl, "https://direct.example.test/v1");
  assert.equal(config.directEndpointPath, API_ENDPOINT_CHAT_COMPLETIONS);
});

test("endpoint URL helpers compose and split complete request URLs", () => {
  assert.equal(
    appendApiEndpointPath("https://api.example.test/v1", API_ENDPOINT_CHAT_COMPLETIONS),
    "https://api.example.test/v1/chat/completions",
  );

  assert.deepEqual(
    splitApiEndpointUrl("https://api.example.test/v1/chat/completions?ignored=true", {
      fallbackBaseUrl: "https://fallback.example.test/v1",
      fallbackEndpointPath: API_ENDPOINT_RESPONSES,
    }),
    {
      baseUrl: "https://api.example.test/v1",
      endpointPath: API_ENDPOINT_CHAT_COMPLETIONS,
    },
  );
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
    directEndpointPath: "chat/completions",
    directApiKey: "direct-key",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  };

  assert.deepEqual(getSelectedTextVisionConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    endpointPath: "chat/completions",
    apiKey: "direct-key",
    responsesModel: "vendor-vision-text",
  });
  assert.deepEqual(getSelectedImageGenerationConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    apiKey: "direct-key",
    responsesModel: "gpt-5.4",
    imageModel: "vendor-image-pro",
    endpointPath: "chat/completions",
  });
});

test("selected direct image generation config uses direct responses model for responses protocol", () => {
  const config = {
    imageRoute: "b",
    responsesModel: "route-a-model",
    directBaseUrl: "https://direct.example.test/v1",
    directEndpointPath: "responses",
    directApiKey: "direct-key",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  };

  assert.deepEqual(getSelectedImageGenerationConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    apiKey: "direct-key",
    responsesModel: "vendor-vision-text",
    imageModel: "vendor-image-pro",
    endpointPath: "responses",
  });
});

test("selected direct image generation config keeps route A responses model for image protocol", () => {
  const config = {
    imageRoute: "b",
    responsesModel: "route-a-model",
    directBaseUrl: "https://direct.example.test/v1",
    directEndpointPath: "images/generations",
    directApiKey: "direct-key",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  };

  assert.deepEqual(getSelectedImageGenerationConfig(config), {
    imageRoute: "b",
    baseUrl: "https://direct.example.test/v1",
    apiKey: "direct-key",
    responsesModel: "route-a-model",
    imageModel: "vendor-image-pro",
    endpointPath: "images/generations",
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
      endpointPath: "responses",
      apiKey: "route-a-key",
      responsesModel: "gpt-5.4",
    },
  );
});

test("selected text and vision config preserves chat completions endpoint paths", () => {
  assert.deepEqual(
    getSelectedTextVisionConfig({
      imageRoute: "a",
      baseUrl: "https://route-a.example.test/v1",
      endpointPath: "chat/completions",
      apiKey: "route-a-key",
      responsesModel: "gpt-5.4",
    }),
    {
      imageRoute: "a",
      baseUrl: "https://route-a.example.test/v1",
      endpointPath: "chat/completions",
      apiKey: "route-a-key",
      responsesModel: "gpt-5.4",
    },
  );

  assert.deepEqual(
    getSelectedTextVisionConfig({
      imageRoute: "b",
      directBaseUrl: "https://direct.example.test/v1/chat/completions",
      directApiKey: "direct-key",
      directResponsesModel: "vendor-vision-text",
    }),
    {
      imageRoute: "b",
      baseUrl: "https://direct.example.test/v1",
      endpointPath: "chat/completions",
      apiKey: "direct-key",
      responsesModel: "vendor-vision-text",
    },
  );
});
