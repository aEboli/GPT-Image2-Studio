import test from "node:test";
import assert from "node:assert/strict";

import {
  API_RUNTIME_CAPABILITIES,
  getApiRouteCapability,
  isApiRouteSupported,
} from "../lib/api-contract.mjs";

test("API capability matrix documents local and Cloudflare runtime differences", () => {
  assert.equal(isApiRouteSupported("local", "POST", "/api/output/open"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/output/open"), false);

  assert.deepEqual(getApiRouteCapability("cloudflare", "POST", "/api/output/open"), {
    method: "POST",
    path: "/api/output/open",
    local: "supported",
    cloudflare: "unsupported",
    reason: "Cloudflare cannot open a local filesystem directory.",
  });

  assert.equal(API_RUNTIME_CAPABILITIES.some((route) => route.path === "/api/generate"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/ppt/analyze"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/ppt/analyze"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/generate"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/models"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/models"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/creation/logo-batch"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/creation/logo-batch"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/creation/reference/analyze"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/creation/reference/analyze"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/creation/plan"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/creation/plan"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/creation/dxm-export"), false);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/creation/dxm-export"), false);
  assert.equal(isApiRouteSupported("local", "POST", "/api/portrait/generate"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/generate"), true);
  assert.equal(isApiRouteSupported("local", "GET", "/api/portrait/sets"), true);
  assert.equal(isApiRouteSupported("cloudflare", "GET", "/api/portrait/sets"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/portrait/repair"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/repair"), false);
});

test("Cloudflare unsupported API routes use the shared capability contract", async () => {
  const worker = await import("../cloudflare-pages-worker.mjs");
  const response = await worker.handleApiRequest(
    new Request("https://studio.example/api/output/open", { method: "POST" }),
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "unsupported_runtime_capability");
  assert.equal(payload.runtime, "cloudflare");
  assert.equal(payload.path, "/api/output/open");
});

test("portrait APIs document Cloudflare local-filesystem gaps", async () => {
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/reference/analyze"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/plan"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/generate"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/sets/open-folder"), false);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/sets/paths"), false);

  const worker = await import("../cloudflare-pages-worker.mjs");
  const response = await worker.handleApiRequest(
    new Request("https://studio.example/api/portrait/repair", { method: "POST" }),
  );
  const payload = await response.json();

  assert.equal(response.status, 400);
  assert.equal(payload.ok, false);
  assert.equal(payload.code, "unsupported_runtime_capability");
  assert.equal(payload.runtime, "cloudflare");
  assert.equal(payload.path, "/api/portrait/repair");
});
