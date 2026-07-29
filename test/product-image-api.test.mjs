import test, { after } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import JSZip from "jszip";

const tempRoot = await mkdtemp(join(tmpdir(), "product-image-api-"));
process.env.PORT = "0";
process.env.HOST = "127.0.0.1";
process.env.IMAGE_STUDIO_OUTPUT_DIR = join(tempRoot, "output");
process.env.IMAGE_STUDIO_LOCAL_DATA_DIR = join(tempRoot, "local-data");
const runtime = await import(`../server.mjs?product-image-api=${Date.now()}`);

after(async () => {
  await runtime.closeStudioServer();
  await rm(tempRoot, { recursive: true, force: true });
});

test("local collector package endpoint returns a valid attachment ZIP", async () => {
  const response = await fetch(`${runtime.studioServerUrl}/api/product-image-collector/package`);
  const bytes = await response.arrayBuffer();
  const zip = await JSZip.loadAsync(bytes);

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("content-type"), "application/zip");
  assert.match(response.headers.get("content-disposition") || "", /attachment; filename="GPT-Image2-Studio-Product-Image-Collector-v1\.1\.23\.zip"/);
  assert.ok(zip.file("manifest.json"));
  assert.ok(zip.file("lib/product-image-import.mjs"));
});

test("local collector proxy rejects untrusted and oversized requests before fetching", async () => {
  const untrusted = await fetch(`${runtime.studioServerUrl}/api/product-image-collector/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      sourcePageUrl: "https://detail.1688.com/offer/123.html",
      imageUrl: "https://127.0.0.1/private.jpg",
    }),
  });
  assert.equal(untrusted.status, 400);
  assert.match((await untrusted.json()).message, /图片地址不受支持/);

  const oversized = await fetch(`${runtime.studioServerUrl}/api/product-image-collector/image`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ value: "x".repeat(17 * 1024) }),
  });
  assert.equal(oversized.status, 413);

  const untrustedPreview = await fetch(
    `${runtime.studioServerUrl}/api/product-image-collector/image?sourcePageUrl=${encodeURIComponent("https://detail.1688.com/offer/123.html")}&imageUrl=${encodeURIComponent("https://127.0.0.1/private.jpg")}`,
  );
  assert.equal(untrustedPreview.status, 400);
  assert.match((await untrustedPreview.json()).message, /图片地址不受支持/);

});

test("Cloudflare collector endpoints return the structured unsupported contract", async () => {
  const worker = await import("../cloudflare-pages-worker.mjs");
  for (const [method, path] of [
    ["POST", "/api/product-image-collector/image"],
    ["GET", "/api/product-image-collector/image"],
    ["GET", "/api/product-image-collector/package"],
  ]) {
    const response = await worker.handleApiRequest(new Request(`https://studio.example${path}`, { method }));
    const payload = await response.json();
    assert.equal(response.status, 400);
    assert.equal(payload.code, "unsupported_runtime_capability");
    assert.equal(payload.path, path);
  }
});
