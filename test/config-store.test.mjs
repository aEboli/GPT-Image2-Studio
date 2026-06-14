import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { createConfigStore } from "../lib/config-store.mjs";

test("config store returns empty public config before any save", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({ rootDir });

  const config = await store.readPublicConfig();

  assert.equal(config.baseUrl, "https://api.openai.com/v1");
  assert.equal(config.apiKeyConfigured, false);
  assert.equal(config.apiKeyMask, undefined);
  assert.equal(config.responsesModel, "gpt-5.4");
  assert.equal(config.endpointPath, "responses");
  assert.equal(config.imageRoute, "a");
  assert.equal(config.directBaseUrl, "https://api.openai.com/v1");
  assert.equal(config.directEndpointPath, "images/generations");
  assert.equal(config.directApiKeyConfigured, false);
  assert.equal(config.directApiKeyMask, undefined);
  assert.equal(config.directImageModel, "gpt-image-2");
  assert.equal(config.directResponsesModel, "gpt-5.5");
  assert.equal(config.protocolBaseUrl, "https://api.openai.com/v1");
  assert.equal(config.protocolApiKeyConfigured, false);
  assert.equal(config.protocolApiKeyMask, undefined);
  assert.equal(config.protocolImageModel, "gemini-3.1-flash-image-preview");
  assert.deepEqual(config.defaults, {
    size: "1024x1280",
    quality: "high",
    format: "png",
    reasoningEffort: "xhigh",
  });
  assert.deepEqual(config.limits, {
    maxParallelTasksPerSession: 15,
    maxReferenceImages: 15,
    maxCreationReferenceImages: 15,
    maxCreationStyleReferenceImages: 3,
    maxPortraitPersonReferenceImages: 3,
    maxPortraitActionReferenceImages: 3,
    maxPortraitAccessoryReferenceImages: 9,
  });
  assert.equal("maxConcurrentTasksPerSession" in config.limits, false);
  assert.deepEqual(config.reasoningEfforts, ["low", "medium", "high", "xhigh"]);
});

test("config store persists private config and only exposes masked api key publicly", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({ rootDir });

  await store.saveConfig({
    baseUrl: "https://example.com",
    apiKey: "placeholder-test-key-1234567890",
    responsesModel: "gpt-5.4",
    defaults: {
      size: "1536x1024",
      quality: "medium",
      format: "png",
      reasoningEffort: "medium",
    },
  });

  const publicConfig = await store.readPublicConfig();
  const privateConfig = await store.readPrivateConfig();
  const raw = JSON.parse(
    await readFile(join(rootDir, ".local", "config.json"), "utf8"),
  );

  assert.equal(publicConfig.baseUrl, "https://example.com/v1");
  assert.equal(publicConfig.apiKeyConfigured, true);
  assert.match(publicConfig.apiKeyMask, /^plac.*7890$/);
  assert.equal(publicConfig.responsesModel, "gpt-5.4");
  assert.deepEqual(publicConfig.defaults, {
    size: "1536x1024",
    quality: "medium",
    format: "png",
    reasoningEffort: "medium",
  });

  assert.equal(privateConfig.apiKey, "placeholder-test-key-1234567890");
  assert.equal(privateConfig.baseUrl, "https://example.com/v1");
  assert.equal(raw.apiKey, "placeholder-test-key-1234567890");
  assert.equal(raw.baseUrl, "https://example.com/v1");
});

test("config store saves route A complete URLs without rewriting vendor paths", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({ rootDir });

  await store.saveConfig({
    baseUrl: "https://route-a.example.com/openai/v1/chat/completions?debug=true#trace",
    apiKey: "route-a-key-1234567890",
    endpointPath: "responses",
  });

  let privateConfig = await store.readPrivateConfig();
  assert.equal(privateConfig.baseUrl, "https://route-a.example.com/openai/v1");
  assert.equal(privateConfig.endpointPath, "chat/completions");

  await store.saveConfig({
    baseUrl: "https://route-a.example.com/responses?debug=true#trace",
    endpointPath: "chat/completions",
  });

  privateConfig = await store.readPrivateConfig();
  assert.equal(privateConfig.baseUrl, "https://route-a.example.com");
  assert.equal(privateConfig.endpointPath, "responses");

  await store.saveConfig({
    baseUrl: "https://route-a.example.com/openai/deployments/prod/custom/images?api-version=2026-06-01#trace",
    endpointPath: "responses",
  });

  privateConfig = await store.readPrivateConfig();
  assert.equal(privateConfig.baseUrl, "https://route-a.example.com/openai/deployments/prod/custom/images");
  assert.equal(privateConfig.endpointPath, "responses");
});

test("config store keeps route A and route B image API settings independent", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({ rootDir });

  await store.saveConfig({
    baseUrl: "https://route-a.example.com",
    apiKey: "route-a-key-1234567890",
    responsesModel: "gpt-5.4",
    endpointPath: "responses",
    imageRoute: "b",
    directBaseUrl: "https://route-b.example.com",
    directEndpointPath: "images/generations",
    directApiKey: "route-b-key-1234567890",
    directImageModel: "vendor-image-pro",
    directResponsesModel: "vendor-vision-text",
  });

  await store.saveConfig({
    directBaseUrl: "https://route-b-2.example.com/openai/deployments/prod/chat/completions?debug=true",
    directEndpointPath: "chat/completions",
    directImageModel: "vendor-image-ultra",
    directResponsesModel: "vendor-vision-ultra",
  });

  const publicConfig = await store.readPublicConfig();
  const privateConfig = await store.readPrivateConfig();

  assert.equal(publicConfig.imageRoute, "b");
  assert.equal(publicConfig.baseUrl, "https://route-a.example.com/v1");
  assert.equal(publicConfig.apiKeyConfigured, true);
  assert.match(publicConfig.apiKeyMask, /^rout.*7890$/);
  assert.equal(publicConfig.responsesModel, "gpt-5.4");
  assert.equal(publicConfig.endpointPath, "responses");
  assert.equal(publicConfig.directBaseUrl, "https://route-b-2.example.com/openai/deployments/prod");
  assert.equal(publicConfig.directEndpointPath, "chat/completions");
  assert.equal(publicConfig.directApiKeyConfigured, true);
  assert.match(publicConfig.directApiKeyMask, /^rout.*7890$/);
  assert.equal(publicConfig.directImageModel, "vendor-image-ultra");
  assert.equal(publicConfig.directResponsesModel, "vendor-vision-ultra");

  assert.equal(privateConfig.apiKey, "route-a-key-1234567890");
  assert.equal(privateConfig.directApiKey, "route-b-key-1234567890");
  assert.equal(privateConfig.directBaseUrl, "https://route-b-2.example.com/openai/deployments/prod");
  assert.equal(privateConfig.directEndpointPath, "chat/completions");
  assert.equal(privateConfig.directImageModel, "vendor-image-ultra");
  assert.equal(privateConfig.directResponsesModel, "vendor-vision-ultra");
});

test("config store keeps model protocol settings independent and masked", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({ rootDir });

  await store.saveConfig({
    imageRoute: "c",
    protocolBaseUrl: "https://protocol.example.com/v1/chat/completions",
    protocolApiKey: "protocol-key-1234567890",
    protocolImageModel: "gemini-3.1-flash-image-preview",
  });

  const publicConfig = await store.readPublicConfig();
  const privateConfig = await store.readPrivateConfig();

  assert.equal(publicConfig.imageRoute, "c");
  assert.equal(publicConfig.protocolBaseUrl, "https://protocol.example.com/v1");
  assert.equal(publicConfig.protocolApiKeyConfigured, true);
  assert.match(publicConfig.protocolApiKeyMask, /^prot.*7890$/);
  assert.equal(publicConfig.protocolImageModel, "gemini-3.1-flash-image-preview");
  assert.equal(privateConfig.protocolApiKey, "protocol-key-1234567890");
});
