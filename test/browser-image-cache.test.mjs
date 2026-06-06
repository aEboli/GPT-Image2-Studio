import test from "node:test";
import assert from "node:assert/strict";

import { normalizeBrowserCachedGalleryItem } from "../lib/browser-image-cache.mjs";

test("browser image cache preserves image generation route metadata", () => {
  const normalized = normalizeBrowserCachedGalleryItem({
    filename: "direct-mode.png",
    generationRoute: "b",
    prompt: "直接调用模式记录",
  });

  assert.equal(normalized.imageRoute, "b");
});
