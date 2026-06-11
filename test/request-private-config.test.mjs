import test from "node:test";
import assert from "node:assert/strict";

import { mergeRequestPrivateConfig } from "../lib/request-private-config.mjs";

test("request private config uses browser-provided API settings when a key is present", () => {
  const fallback = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "",
    responsesModel: "gpt-5.4",
    defaults: {
      reasoningEffort: "xhigh",
    },
  };
  const fields = {
    baseUrl: "https://example.test/v1",
    apiKey: "browser-key",
    responsesModel: "gpt-5.5",
  };

  const config = mergeRequestPrivateConfig(fields, fallback);

  assert.equal(config.baseUrl, "https://example.test/v1");
  assert.equal(config.apiKey, "browser-key");
  assert.equal(config.responsesModel, "gpt-5.5");
  assert.deepEqual(config.defaults, fallback.defaults);
});

test("request private config falls back to server config when no request key is present", () => {
  const fallback = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "server-key",
    responsesModel: "gpt-5.4",
  };

  assert.equal(mergeRequestPrivateConfig({}, fallback), fallback);
});

test("request private config keeps route B direct image settings separate from route A", () => {
  const fallback = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "server-a-key",
    responsesModel: "gpt-5.4",
    imageRoute: "a",
    directBaseUrl: "https://api.openai.com/v1",
    directApiKey: "",
    directImageModel: "gpt-image-2",
    directResponsesModel: "gpt-5.5",
  };
  const fields = {
    imageRoute: "b",
    baseUrl: "https://route-a.example.test",
    apiKey: "browser-a-key",
    responsesModel: "gpt-5.5",
    directBaseUrl: "https://route-b.example.test",
    directApiKey: "browser-b-key",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  };

  const config = mergeRequestPrivateConfig(fields, fallback);

  assert.equal(config.imageRoute, "b");
  assert.equal(config.baseUrl, "https://route-a.example.test/v1");
  assert.equal(config.apiKey, "browser-a-key");
  assert.equal(config.responsesModel, "gpt-5.5");
  assert.equal(config.directBaseUrl, "https://route-b.example.test/v1");
  assert.equal(config.directApiKey, "browser-b-key");
  assert.equal(config.directImageModel, "vendor-image-pro");
  assert.equal(config.directResponsesModel, "vendor-vision-text");
});

test("request private config applies selected image route even when request keeps saved keys", () => {
  const fallback = {
    baseUrl: "https://route-a-server.example.test/v1",
    apiKey: "server-a-key",
    responsesModel: "gpt-5.4",
    imageRoute: "a",
    directBaseUrl: "https://route-b-server.example.test/v1",
    directApiKey: "",
    directImageModel: "server-image-model",
    directResponsesModel: "server-vision-model",
  };

  const config = mergeRequestPrivateConfig(
    {
      imageRoute: "b",
      baseUrl: "https://browser-route-a.example.test",
      directBaseUrl: "https://browser-route-b.example.test",
      directImageModel: "browser-image-model",
      directResponsesModel: "browser-vision-model",
    },
    fallback,
  );

  assert.notEqual(config, fallback);
  assert.equal(config.imageRoute, "b");
  assert.equal(config.baseUrl, "https://route-a-server.example.test/v1");
  assert.equal(config.apiKey, "server-a-key");
  assert.equal(config.directBaseUrl, "https://route-b-server.example.test/v1");
  assert.equal(config.directApiKey, "");
  assert.equal(config.directImageModel, "server-image-model");
  assert.equal(config.directResponsesModel, "server-vision-model");
});
