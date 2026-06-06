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
  assert.equal(config.imageRoute, "a");
  assert.equal(config.directBaseUrl, "https://api.openai.com/v1");
  assert.equal(config.directApiKeyConfigured, false);
  assert.equal(config.directApiKeyMask, undefined);
  assert.equal(config.directImageModel, "gpt-image-2");
  assert.deepEqual(config.defaults, {
    size: "896x1120",
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

test("config store keeps route A and route B image API settings independent", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({ rootDir });

  await store.saveConfig({
    baseUrl: "https://route-a.example.com",
    apiKey: "route-a-key-1234567890",
    responsesModel: "gpt-5.4",
    imageRoute: "b",
    directBaseUrl: "https://route-b.example.com",
    directApiKey: "route-b-key-1234567890",
    directImageModel: "vendor-image-pro",
  });

  await store.saveConfig({
    directBaseUrl: "https://route-b-2.example.com/v1",
    directImageModel: "vendor-image-ultra",
  });

  const publicConfig = await store.readPublicConfig();
  const privateConfig = await store.readPrivateConfig();

  assert.equal(publicConfig.imageRoute, "b");
  assert.equal(publicConfig.baseUrl, "https://route-a.example.com/v1");
  assert.equal(publicConfig.apiKeyConfigured, true);
  assert.match(publicConfig.apiKeyMask, /^rout.*7890$/);
  assert.equal(publicConfig.responsesModel, "gpt-5.4");
  assert.equal(publicConfig.directBaseUrl, "https://route-b-2.example.com/v1");
  assert.equal(publicConfig.directApiKeyConfigured, true);
  assert.match(publicConfig.directApiKeyMask, /^rout.*7890$/);
  assert.equal(publicConfig.directImageModel, "vendor-image-ultra");

  assert.equal(privateConfig.apiKey, "route-a-key-1234567890");
  assert.equal(privateConfig.directApiKey, "route-b-key-1234567890");
  assert.equal(privateConfig.directBaseUrl, "https://route-b-2.example.com/v1");
  assert.equal(privateConfig.directImageModel, "vendor-image-ultra");
});
