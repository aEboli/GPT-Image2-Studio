import test from "node:test";
import assert from "node:assert/strict";

import {
  fetchProductImageImportFiles,
  readProductImageImportClipboard,
} from "../lib/product-image-import-controller.mjs";
import { serializeProductImageImportManifest } from "../lib/product-image-import.mjs";

class FakeFile {
  constructor(parts, name, options = {}) {
    this.name = name;
    this.type = options.type || "";
    this.lastModified = options.lastModified ?? Date.now();
    this.size = parts.reduce((total, part) => total + Number(part?.size ?? part?.byteLength ?? 0), 0);
  }
}

function makeManifest() {
  return {
    version: 1,
    source: { platform: "1688", pageUrl: "https://detail.1688.com/offer/123.html" },
    product: { id: "123", title: "测试商品" },
    capturedAt: "2026-07-27T08:00:00.000Z",
    items: [
      { id: "main-1", category: "main", order: 1, url: "https://cbu01.alicdn.com/main.jpg", filename: "main.jpg", width: 800, height: 800, confidence: "high" },
      { id: "detail-1", category: "detail", order: 1, url: "https://cbu01.alicdn.com/detail.jpg", filename: "detail.jpg", width: 790, height: 1200, confidence: "high" },
      { id: "sku-1", category: "sku", order: 1, url: "https://cbu01.alicdn.com/sku.webp", filename: "sku.webp", width: 200, height: 200, confidence: "high", variantLabels: ["60cm", "68cm"], variantCount: 2 },
    ],
  };
}

test("clipboard import prefers the versioned manifest without reading native image items", async () => {
  let nativeReadCount = 0;
  const result = await readProductImageImportClipboard({
    clipboard: {
      async readText() { return serializeProductImageImportManifest(makeManifest()); },
      async read() { nativeReadCount += 1; return []; },
    },
    FileCtor: FakeFile,
  });

  assert.equal(result.kind, "manifest");
  assert.equal(result.manifest.items.length, 3);
  assert.deepEqual(result.manifest.items[2].variantLabels, ["60cm", "68cm"]);
  assert.equal(nativeReadCount, 0);
});

test("clipboard import falls back to every readable native image item", async () => {
  const result = await readProductImageImportClipboard({
    clipboard: {
      async readText() { return "ordinary clipboard text"; },
      async read() {
        return [{
          types: ["image/png", "text/plain", "image/webp"],
          async getType(type) { return new Blob([type], { type }); },
        }];
      },
    },
    FileCtor: FakeFile,
  });

  assert.equal(result.kind, "files");
  assert.deepEqual(result.files.map((file) => [file.name, file.type]), [
    ["clipboard-image-01.png", "image/png"],
    ["clipboard-image-02.webp", "image/webp"],
  ]);
});

test("confirmed manifest images fetch sequentially and isolate item failures", async () => {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const result = await fetchProductImageImportFiles({
    manifest: makeManifest(),
    selectedIds: ["main-1", "detail-1", "sku-1"],
    FileCtor: FakeFile,
    async fetchImpl(_url, init) {
      const payload = JSON.parse(init.body);
      calls.push(payload.imageUrl);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      if (payload.imageUrl.includes("detail")) {
        return new Response(JSON.stringify({ message: "详情图不可用" }), { status: 502, headers: { "content-type": "application/json" } });
      }
      return new Response(Uint8Array.from([1, 2, 3]), { status: 200, headers: { "content-type": payload.imageUrl.endsWith("webp") ? "image/webp" : "image/jpeg" } });
    },
  });

  assert.equal(maxActive, 1);
  assert.deepEqual(calls, [
    "https://cbu01.alicdn.com/main.jpg",
    "https://cbu01.alicdn.com/detail.jpg",
    "https://cbu01.alicdn.com/sku.webp",
  ]);
  assert.deepEqual(result.files.map((file) => file.name), ["main.jpg", "sku.webp"]);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].message, /详情图不可用/);
});
