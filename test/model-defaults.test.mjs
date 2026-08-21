import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { normalizeBrowserPrivateConfig } from "../lib/browser-config.mjs";
import { createConfigStore } from "../lib/config-store.mjs";
import { generateCreationListingDrafts } from "../lib/creation-listing-agent.mjs";
import {
  DEFAULT_DIRECT_IMAGE_MODEL,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  DEFAULT_PROTOCOL_IMAGE_MODEL,
  DEFAULT_RESPONSES_MODEL,
} from "../lib/model-defaults.mjs";

test("shared model defaults keep text defaults aligned without changing image protocols", () => {
  assert.equal(DEFAULT_RESPONSES_MODEL, "gpt-5.4-mini");
  assert.equal(DEFAULT_DIRECT_RESPONSES_MODEL, "gpt-5.4-mini");
  assert.equal(DEFAULT_DIRECT_IMAGE_MODEL, "gpt-image-2");
  assert.equal(DEFAULT_PROTOCOL_IMAGE_MODEL, "gemini-3.1-flash-image-preview");
});

test("local and browser configuration use shared defaults and preserve explicit models", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "image-studio-model-defaults-"));
  const localDefault = await createConfigStore({ rootDir }).readPrivateConfig();
  const localOverride = await createConfigStore({
    rootDir,
    env: {
      RESPONSES_MODEL: "vendor-route-model",
      DIRECT_RESPONSES_MODEL: "vendor-direct-model",
    },
  }).readPrivateConfig();
  const browserDefault = normalizeBrowserPrivateConfig();
  const browserOverride = normalizeBrowserPrivateConfig({
    responsesModel: "browser-route-model",
    directResponsesModel: "browser-direct-model",
  });

  assert.equal(localDefault.responsesModel, DEFAULT_RESPONSES_MODEL);
  assert.equal(localDefault.directResponsesModel, DEFAULT_DIRECT_RESPONSES_MODEL);
  assert.equal(browserDefault.responsesModel, DEFAULT_RESPONSES_MODEL);
  assert.equal(browserDefault.directResponsesModel, DEFAULT_DIRECT_RESPONSES_MODEL);
  assert.equal(localOverride.responsesModel, "vendor-route-model");
  assert.equal(localOverride.directResponsesModel, "vendor-direct-model");
  assert.equal(browserOverride.responsesModel, "browser-route-model");
  assert.equal(browserOverride.directResponsesModel, "browser-direct-model");
});

test("Listing requests use the shared default only when no model is supplied", async () => {
  async function captureModels(config) {
    const models = [];
    const drafts = await generateCreationListingDrafts({
      set: {
        setId: "default-model-listing",
        productName: "Blue Travel Bottle",
        productDescription: "One blue travel bottle.",
      },
      config: {
        baseUrl: "https://example.test/v1",
        apiKey: "test-key",
        ...config,
      },
      async fetchImpl(_url, init) {
        models.push(JSON.parse(init.body).model);
        return new Response(JSON.stringify({ output_text: JSON.stringify({ title: "Blue Travel Bottle" }) }), { status: 200 });
      },
    });
    assert.equal(drafts.length, 1);
    assert.equal(drafts[0].status, "completed");
    return models;
  }

  const defaultModels = await captureModels({});
  const overrideModels = await captureModels({ responsesModel: "listing-override-model" });

  assert.ok(defaultModels.length > 0);
  assert.ok(defaultModels.every((model) => model === DEFAULT_RESPONSES_MODEL));
  assert.ok(overrideModels.every((model) => model === "listing-override-model"));
});
