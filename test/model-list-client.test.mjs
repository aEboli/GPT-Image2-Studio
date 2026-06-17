import test from "node:test";
import assert from "node:assert/strict";

import {
  buildModelsEndpoint,
  fetchAvailableModels,
} from "../lib/model-list-client.mjs";

test("model list client appends models to a configured v1 base URL", () => {
  assert.equal(buildModelsEndpoint("https://example.test/v1"), "https://example.test/v1/models");
  assert.equal(buildModelsEndpoint("https://example.test/v1/"), "https://example.test/v1/models");
});

test("model list client appends v1 when the configured base URL omits it", () => {
  assert.equal(buildModelsEndpoint("https://example.test"), "https://example.test/v1/models");
  assert.equal(buildModelsEndpoint("https://example.test/openai"), "https://example.test/openai/v1/models");
});

test("model list client fetches model ids with bearer auth", async () => {
  const seenRequests = [];
  const models = await fetchAvailableModels({
    baseUrl: "https://example.test/v1",
    apiKey: "test-browser-key",
    fetchImpl: async (url, init) => {
      seenRequests.push({ url, auth: init.headers.Authorization });
      return new Response(JSON.stringify({
        data: [
          { id: "gpt-5.5" },
          { id: "gpt-image-2" },
          { id: "" },
        ],
      }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    },
  });

  assert.deepEqual(models, ["gpt-5.5", "gpt-image-2"]);
  assert.deepEqual(seenRequests, [
    {
      url: "https://example.test/v1/models",
      auth: "Bearer test-browser-key",
    },
  ]);
});
