import test from "node:test";
import assert from "node:assert/strict";

import {
  getThumbnailUrl,
  isServerImageProxyUrl,
  mergeServerAndBrowserGalleryItems,
  normalizeBrowserCachedGalleryItem,
} from "../lib/browser-image-cache.mjs";

test("browser image cache preserves image generation route metadata", () => {
  const normalized = normalizeBrowserCachedGalleryItem({
    filename: "direct-mode.png",
    generationRoute: "b",
    prompt: "直接调用模式记录",
  });

  assert.equal(normalized.imageRoute, "b");
});

test("browser image cache recognizes local output and thumbnail URLs as server media", () => {
  assert.equal(isServerImageProxyUrl("/output/2026-09/09-01/demo.png"), true);
  assert.equal(isServerImageProxyUrl("/api/gallery/thumbnail?path=2026-09%2F09-01%2Fdemo.png"), true);
  assert.equal(isServerImageProxyUrl("https://example.com/image.png"), false);
});

test("thumbnail-focused views retain the server thumbnail over a cached full image", () => {
  const [item] = mergeServerAndBrowserGalleryItems(
    [{
      filename: "demo.png",
      imageUrl: "/output/2026-09/09-01/demo.png",
      thumbnailUrl: "/api/gallery/thumbnail?path=2026-09%2F09-01%2Fdemo.png",
    }],
    [{
      filename: "demo.png",
      imageUrl: "data:image/png;base64,ZmFrZQ==",
      thumbnailUrl: "data:image/png;base64,ZmFrZQ==",
    }],
  );

  assert.equal(item.imageUrl, "data:image/png;base64,ZmFrZQ==");
  assert.equal(item.thumbnailUrl, "/api/gallery/thumbnail?path=2026-09%2F09-01%2Fdemo.png");
  assert.equal(getThumbnailUrl({ ...item, serverThumbnailUrl: item.thumbnailUrl }), item.thumbnailUrl);
});
