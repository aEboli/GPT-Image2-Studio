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
  assert.equal(isApiRouteSupported("local", "POST", "/api/creation/sets/delete"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/creation/sets/delete"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/article-illustration/sets/delete"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/article-illustration/sets/delete"), false);
  assert.equal(isApiRouteSupported("local", "POST", "/api/portrait/sets/delete"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/sets/delete"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/ppt/decks/delete"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/ppt/decks/delete"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/creation/dxm-export"), false);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/creation/dxm-export"), false);
  assert.equal(isApiRouteSupported("local", "POST", "/api/portrait/generate"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/generate"), true);
  assert.equal(isApiRouteSupported("local", "GET", "/api/portrait/sets"), true);
  assert.equal(isApiRouteSupported("cloudflare", "GET", "/api/portrait/sets"), true);
  assert.equal(isApiRouteSupported("local", "POST", "/api/portrait/repair"), true);
  assert.equal(isApiRouteSupported("cloudflare", "POST", "/api/portrait/repair"), false);
});

test("Cloudflare creation record deletion is an idempotent bounded batch", async () => {
  const worker = await import("../cloudflare-pages-worker.mjs");
  const response = await worker.handleApiRequest(
    new Request("https://studio.example/api/creation/sets/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setIds: ["set-a", "set-a", "set-b"] }),
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.deletedCount, 2);
  assert.deepEqual(payload.deletedSetIds, ["set-a", "set-b"]);
  assert.deepEqual(payload.notFoundSetIds, []);

  const invalidResponse = await worker.handleApiRequest(
    new Request("https://studio.example/api/creation/sets/delete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setIds: [] }),
    }),
  );
  assert.equal(invalidResponse.status, 400);
});

test("Cloudflare asset deletion batches follow each runtime persistence contract", async () => {
  const worker = await import("../cloudflare-pages-worker.mjs");
  const cases = [
    ["/api/output/delete", { filenames: ["one.png", "one.png", "two.png"] }, "deletedFilenames"],
    ["/api/portrait/sets/delete", { setIds: ["portrait-a", "portrait-a"] }, "deletedSetIds"],
    ["/api/ppt/decks/delete", { recordKeys: ["deck-a", "deck-a"] }, "deletedRecordKeys"],
  ];
  for (const [path, body, resultKey] of cases) {
    const response = await worker.handleApiRequest(new Request(`https://studio.example${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }));
    const payload = await response.json();
    assert.equal(response.status, 200, `${path}: ${JSON.stringify(payload)}`);
    assert.equal(payload.ok, true);
    assert.equal(payload.deletedCount, resultKey === "deletedFilenames" ? 2 : 1);
    assert.equal(payload[resultKey].length, resultKey === "deletedFilenames" ? 2 : 1);
  }

  const articleResponse = await worker.handleApiRequest(new Request(
    "https://studio.example/api/article-illustration/sets/delete",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ setIds: ["article-a"] }),
    },
  ));
  const articlePayload = await articleResponse.json();
  assert.equal(articleResponse.status, 400);
  assert.equal(articlePayload.code, "unsupported_runtime_capability");
  assert.equal(articlePayload.path, "/api/article-illustration/sets/delete");
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
  assert.equal(payload.message, "Cloudflare 部署版不支持打开本机输出目录，请使用预览区的下载按钮保存图片。");
});

test("article illustration routes expose an explicit Cloudflare capability contract", async () => {
  const worker = await import("../cloudflare-pages-worker.mjs");
  const routes = [
    ["GET", "/api/article-illustration/sets"],
    ["POST", "/api/article-illustration/plan"],
    ["POST", "/api/article-illustration/generate-references"],
    ["POST", "/api/article-illustration/generate"],
  ];

  for (const [method, path] of routes) {
    assert.equal(isApiRouteSupported("local", method, path), true);
    assert.equal(isApiRouteSupported("cloudflare", method, path), false);
    const response = await worker.handleApiRequest(
      new Request(`https://studio.example${path}`, { method }),
    );
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.code, "unsupported_runtime_capability");
    assert.equal(payload.path, path);
  }
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
