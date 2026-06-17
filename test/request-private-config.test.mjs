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
    endpointPath: "responses",
    imageRoute: "a",
    directBaseUrl: "https://api.openai.com/v1",
    directEndpointPath: "images/generations",
    directApiKey: "",
    directImageModel: "gpt-image-2",
    directResponsesModel: "gpt-5.5",
  };
  const fields = {
    imageRoute: "b",
    baseUrl: "https://route-a.example.test",
    apiKey: "browser-a-key",
    responsesModel: "gpt-5.5",
    endpointPath: "chat/completions",
    directBaseUrl: "https://route-b.example.test",
    directEndpointPath: "chat/completions",
    directApiKey: "browser-b-key",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  };

  const config = mergeRequestPrivateConfig(fields, fallback);

  assert.equal(config.imageRoute, "b");
  assert.equal(config.baseUrl, "https://route-a.example.test/v1");
  assert.equal(config.apiKey, "browser-a-key");
  assert.equal(config.responsesModel, "gpt-5.5");
  assert.equal(config.endpointPath, "chat/completions");
  assert.equal(config.directBaseUrl, "https://route-b.example.test/v1");
  assert.equal(config.directEndpointPath, "chat/completions");
  assert.equal(config.directApiKey, "browser-b-key");
  assert.equal(config.directImageModel, "vendor-image-pro");
  assert.equal(config.directResponsesModel, "vendor-vision-text");
});

test("request private config preserves complete root endpoint URLs", () => {
  const fallback = {
    baseUrl: "https://api.openai.com/v1",
    apiKey: "server-a-key",
    responsesModel: "gpt-5.4",
    endpointPath: "responses",
    imageRoute: "a",
    directBaseUrl: "https://api.openai.com/v1",
    directEndpointPath: "images/generations",
    directApiKey: "",
    directImageModel: "gpt-image-2",
    directResponsesModel: "gpt-5.5",
    protocolBaseUrl: "https://api.openai.com/v1",
    protocolApiKey: "",
    protocolImageModel: "server-protocol-image",
  };

  const config = mergeRequestPrivateConfig(
    {
      imageRoute: "c",
      baseUrl: "https://browser-route.example.test/responses?debug=true#trace",
      endpointPath: "chat/completions",
      apiKey: "browser-a-key",
      directBaseUrl: "https://browser-direct.example.test/images/generations?debug=true#trace",
      directEndpointPath: "responses",
      directApiKey: "browser-direct-key",
      protocolBaseUrl: "https://browser-protocol.example.test/images/edits?debug=true#trace",
      protocolImageModel: "browser-protocol-image",
    },
    fallback,
  );

  assert.equal(config.baseUrl, "https://browser-route.example.test");
  assert.equal(config.endpointPath, "responses");
  assert.equal(config.directBaseUrl, "https://browser-direct.example.test");
  assert.equal(config.directEndpointPath, "images/generations");
  assert.equal(config.protocolBaseUrl, "https://browser-protocol.example.test");
});

test("request private config applies selected image route while reusing saved route keys", () => {
  const fallback = {
    baseUrl: "https://route-a-server.example.test/v1",
    apiKey: "server-a-key",
    responsesModel: "gpt-5.4",
    endpointPath: "responses",
    imageRoute: "a",
    directBaseUrl: "https://route-b-server.example.test/v1",
    directEndpointPath: "images/generations",
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
  assert.equal(config.endpointPath, "responses");
  assert.equal(config.directBaseUrl, "https://route-b-server.example.test/v1");
  assert.equal(config.directEndpointPath, "images/generations");
  assert.equal(config.directApiKey, "server-a-key");
  assert.equal(config.directImageModel, "server-image-model");
  assert.equal(config.directResponsesModel, "server-vision-model");
});

test("request private config keeps model protocol settings separate from route A and route B", () => {
  const fallback = {
    baseUrl: "https://route-a-server.example.test/v1",
    apiKey: "server-a-key",
    responsesModel: "gpt-5.4",
    endpointPath: "responses",
    imageRoute: "a",
    directBaseUrl: "https://route-b-server.example.test/v1",
    directEndpointPath: "images/generations",
    directApiKey: "server-b-key",
    directImageModel: "gpt-image-2",
    directResponsesModel: "server-vision-model",
    protocolBaseUrl: "https://protocol-server.example.test/v1",
    protocolApiKey: "server-protocol-key",
    protocolImageModel: "server-gemini-image",
  };

  const config = mergeRequestPrivateConfig(
    {
      imageRoute: "c",
      protocolBaseUrl: "https://protocol-browser.example.test/v1",
      protocolApiKey: "browser-protocol-key",
      protocolImageModel: "gemini-3.1-flash-image-preview",
    },
    fallback,
  );

  assert.equal(config.imageRoute, "c");
  assert.equal(config.protocolBaseUrl, "https://protocol-browser.example.test/v1");
  assert.equal(config.protocolApiKey, "browser-protocol-key");
  assert.equal(config.protocolImageModel, "gemini-3.1-flash-image-preview");
  assert.equal(config.baseUrl, "https://route-a-server.example.test/v1");
  assert.equal(config.directBaseUrl, "https://route-b-server.example.test/v1");
});

test("request private config lets model protocol requests reuse an existing route key", () => {
  const fallback = {
    baseUrl: "https://route-a-server.example.test/v1",
    apiKey: "",
    responsesModel: "gpt-5.4",
    endpointPath: "responses",
    imageRoute: "a",
    directBaseUrl: "https://route-b-server.example.test/v1",
    directEndpointPath: "images/generations",
    directApiKey: "",
    directImageModel: "gpt-image-2",
    directResponsesModel: "server-vision-model",
    protocolBaseUrl: "https://protocol-server.example.test/v1",
    protocolApiKey: "",
    protocolImageModel: "server-gemini-image",
  };

  const config = mergeRequestPrivateConfig(
    {
      imageRoute: "c",
      baseUrl: "https://browser-route-a.example.test/v1",
      apiKey: "browser-route-key",
      protocolBaseUrl: "https://browser-protocol.example.test/v1",
      protocolImageModel: "gemini-3.1-flash-image-preview",
    },
    fallback,
  );

  assert.equal(config.imageRoute, "c");
  assert.equal(config.protocolBaseUrl, "https://browser-protocol.example.test/v1");
  assert.equal(config.protocolApiKey, "browser-route-key");
  assert.equal(config.protocolImageModel, "gemini-3.1-flash-image-preview");
});
