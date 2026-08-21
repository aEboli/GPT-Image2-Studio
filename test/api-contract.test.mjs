import test from "node:test";
import assert from "node:assert/strict";

import {
  API_RUNTIME_CAPABILITIES,
  getApiRouteCapability,
  isApiRouteSupported,
} from "../lib/api-contract.mjs";

test("API capability matrix documents the maintained local runtime", () => {
  assert.equal(isApiRouteSupported("local", "POST", "/api/output/open"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/generate"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/ppt/analyze"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/product-image-collector/image"), true);
  assert.equal(isApiRouteSupported("local", "GET", "/api/product-image-collector/package"), true);
  assert.equal(isApiRouteSupported("local", "GET", "/api/images/example.png"), false);
  assert.equal(isApiRouteSupported("local", "POST", "/api/creation/dxm-export"), false);
  assert.equal(isApiRouteSupported("remote", "POST", "/api/generate"), false);
  assert.equal(getApiRouteCapability("remote", "POST", "/api/generate"), null);
  assert.equal(API_RUNTIME_CAPABILITIES.some((route) => route.path === "/api/generate"), true);
});

test("local capability entries keep method and path matching bounded", () => {
  assert.deepEqual(getApiRouteCapability("local", "post", "/api/output/open"), {
    method: "POST",
    path: "/api/output/open",
    local: "supported",
  });
  assert.equal(getApiRouteCapability("local", "POST", "/api/unknown"), null);
  assert.equal(isApiRouteSupported("remote", "GET", "/api/gallery"), false);
});
