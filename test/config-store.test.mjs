import test from "node:test";
import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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

test("config store uses local environment variables as defaults before any save", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({
    rootDir,
    env: {
      OPENAI_API_KEY: "env-route-key-1234567890",
      OPENAI_BASE_URL: "https://env-route.example.com/openai/v1/responses",
      RESPONSES_MODEL: "gpt-env-responses",
      ENDPOINT_PATH: "chat/completions",
      IMAGE_ROUTE: "b",
      DIRECT_API_KEY: "env-direct-key-1234567890",
      DIRECT_BASE_URL: "https://env-direct.example.com/v1/images/generations",
      DIRECT_ENDPOINT_PATH: "responses",
      DIRECT_IMAGE_MODEL: "env-image-model",
      DIRECT_RESPONSES_MODEL: "env-direct-responses",
      PROTOCOL_API_KEY: "env-protocol-key-1234567890",
      PROTOCOL_BASE_URL: "https://env-protocol.example.com/v1/images/generations",
      PROTOCOL_IMAGE_MODEL: "env-protocol-image",
      REASONING_EFFORT: "low",
    },
  });

  const publicConfig = await store.readPublicConfig();
  const privateConfig = await store.readPrivateConfig();

  assert.equal(publicConfig.imageRoute, "b");
  assert.equal(publicConfig.baseUrl, "https://env-route.example.com/openai/v1");
  assert.equal(publicConfig.endpointPath, "responses");
  assert.equal(publicConfig.apiKeyConfigured, true);
  assert.match(publicConfig.apiKeyMask, /^env-.*7890$/);
  assert.equal(publicConfig.responsesModel, "gpt-env-responses");
  assert.equal(publicConfig.directBaseUrl, "https://env-direct.example.com/v1");
  assert.equal(publicConfig.directEndpointPath, "images/generations");
  assert.equal(publicConfig.directApiKeyConfigured, true);
  assert.equal(publicConfig.directImageModel, "env-image-model");
  assert.equal(publicConfig.directResponsesModel, "env-direct-responses");
  assert.equal(publicConfig.protocolBaseUrl, "https://env-protocol.example.com/v1");
  assert.equal(publicConfig.protocolApiKeyConfigured, true);
  assert.equal(publicConfig.protocolImageModel, "env-protocol-image");
  assert.equal(publicConfig.defaults.reasoningEffort, "low");
  assert.equal(privateConfig.apiKey, "env-route-key-1234567890");
  assert.equal(privateConfig.directApiKey, "env-direct-key-1234567890");
  assert.equal(privateConfig.protocolApiKey, "env-protocol-key-1234567890");
});

test("config store lets temporary direct and OpenAI environment values override stale local config", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  await mkdir(join(rootDir, ".local"), { recursive: true });
  await writeFile(
    join(rootDir, ".local", "config.json"),
    `${JSON.stringify(
      {
        imageRoute: "a",
        baseUrl: "https://stale-route.example.test/v1/responses",
        endpointPath: "responses",
        apiKey: "stale-route-key-1234567890",
        responsesModel: "stale-route-model",
        directBaseUrl: "https://stale-direct.example.test/v1/images/generations",
        directEndpointPath: "images/generations",
        directApiKey: "stale-direct-key-1234567890",
        directImageModel: "stale-direct-image",
        directResponsesModel: "stale-direct-responses",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const store = createConfigStore({
    rootDir,
    env: {
      IMAGE_ROUTE: "b",
      OPENAI_API_KEY: "env-route-key-1234567890",
      OPENAI_BASE_URL: "https://env-route.example.test/openai/v1/chat/completions",
      RESPONSES_MODEL: "env-route-responses",
      DIRECT_API_KEY: "env-direct-key-1234567890",
      DIRECT_BASE_URL: "https://env-direct.example.test/v1/images/generations",
      DIRECT_IMAGE_MODEL: "env-direct-image",
      DIRECT_RESPONSES_MODEL: "env-direct-responses",
    },
  });

  const publicConfig = await store.readPublicConfig();
  const privateConfig = await store.readPrivateConfig();

  assert.equal(publicConfig.imageRoute, "b");
  assert.equal(publicConfig.baseUrl, "https://env-route.example.test/openai/v1");
  assert.equal(publicConfig.endpointPath, "chat/completions");
  assert.equal(publicConfig.responsesModel, "env-route-responses");
  assert.equal(publicConfig.apiKeyMask, "env-***7890");
  assert.equal(publicConfig.directBaseUrl, "https://env-direct.example.test/v1");
  assert.equal(publicConfig.directEndpointPath, "images/generations");
  assert.equal(publicConfig.directImageModel, "env-direct-image");
  assert.equal(publicConfig.directResponsesModel, "env-direct-responses");
  assert.equal(publicConfig.directApiKeyMask, "env-***7890");
  assert.equal(privateConfig.apiKey, "env-route-key-1234567890");
  assert.equal(privateConfig.directApiKey, "env-direct-key-1234567890");
});

test("config store does not let stale direct config leak into a direct route seeded from OpenAI env", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  await mkdir(join(rootDir, ".local"), { recursive: true });
  await writeFile(
    join(rootDir, ".local", "config.json"),
    `${JSON.stringify(
      {
        imageRoute: "b",
        directBaseUrl: "https://stale-direct.example.test/v1/images/generations",
        directEndpointPath: "images/generations",
        directApiKey: "stale-direct-key-1234567890",
        directImageModel: "stale-direct-image",
        directResponsesModel: "stale-direct-responses",
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  const store = createConfigStore({
    rootDir,
    env: {
      IMAGE_ROUTE: "b",
      OPENAI_API_KEY: "env-route-key-1234567890",
      OPENAI_BASE_URL: "https://env-route.example.test/openai/v1/chat/completions",
      RESPONSES_MODEL: "env-route-responses",
    },
  });

  const publicConfig = await store.readPublicConfig();
  const privateConfig = await store.readPrivateConfig();

  assert.equal(publicConfig.directBaseUrl, "https://env-route.example.test/openai/v1");
  assert.equal(publicConfig.directEndpointPath, "images/generations");
  assert.equal(publicConfig.directApiKeyConfigured, true);
  assert.equal(publicConfig.directApiKeyMask, "env-***7890");
  assert.equal(publicConfig.directImageModel, "gpt-image-2");
  assert.equal(publicConfig.directResponsesModel, "gpt-5.5");
  assert.equal(privateConfig.directApiKey, "env-route-key-1234567890");
  assert.equal(privateConfig.directBaseUrl, "https://env-route.example.test/openai/v1");
  assert.equal(privateConfig.directEndpointPath, "images/generations");
});

test("config store saves displayed local environment credentials when key inputs stay blank", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-config-"));
  const store = createConfigStore({
    rootDir,
    env: {
      IMAGE_ROUTE: "b",
      DIRECT_API_KEY: "env-direct-key-1234567890",
      DIRECT_BASE_URL: "https://env-direct.example.test/v1/images/generations",
      DIRECT_IMAGE_MODEL: "env-direct-image",
      DIRECT_RESPONSES_MODEL: "env-direct-responses",
    },
  });

  await store.saveConfig({
    imageRoute: "b",
    directBaseUrl: "https://saved-direct.example.test/v1/responses",
    directEndpointPath: "responses",
    directApiKey: "",
    directImageModel: "saved-direct-image",
    directResponsesModel: "saved-direct-responses",
  });

  const publicConfig = await store.readPublicConfig();
  const privateConfig = await store.readPrivateConfig();
  const raw = JSON.parse(await readFile(join(rootDir, ".local", "config.json"), "utf8"));

  assert.equal(publicConfig.imageRoute, "b");
  assert.equal(publicConfig.directBaseUrl, "https://env-direct.example.test/v1");
  assert.equal(publicConfig.directEndpointPath, "images/generations");
  assert.equal(publicConfig.directApiKeyConfigured, true);
  assert.equal(publicConfig.directApiKeyMask, "env-***7890");
  assert.equal(publicConfig.directImageModel, "env-direct-image");
  assert.equal(publicConfig.directResponsesModel, "env-direct-responses");
  assert.equal(privateConfig.directApiKey, "env-direct-key-1234567890");
  assert.equal(raw.directBaseUrl, "https://saved-direct.example.test/v1");
  assert.equal(raw.directEndpointPath, "responses");
  assert.equal(raw.directApiKey, "env-direct-key-1234567890");
  assert.equal(raw.directImageModel, "saved-direct-image");
  assert.equal(raw.directResponsesModel, "saved-direct-responses");

  const restartedStore = createConfigStore({ rootDir });
  const restartedConfig = await restartedStore.readPrivateConfig();
  assert.equal(restartedConfig.directBaseUrl, "https://saved-direct.example.test/v1");
  assert.equal(restartedConfig.directEndpointPath, "responses");
  assert.equal(restartedConfig.directApiKey, "env-direct-key-1234567890");
  assert.equal(restartedConfig.directImageModel, "saved-direct-image");
  assert.equal(restartedConfig.directResponsesModel, "saved-direct-responses");
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
