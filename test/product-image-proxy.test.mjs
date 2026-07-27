import test from "node:test";
import assert from "node:assert/strict";

import {
  MAX_PRODUCT_IMAGE_BYTES,
  fetchTrustedProductImage,
} from "../lib/product-image-proxy.mjs";

const sourcePageUrl = "https://detail.1688.com/offer/123456789.html";

test("trusted product image proxy returns bounded raster image bytes", async () => {
  const calls = [];
  const result = await fetchTrustedProductImage({
    sourcePageUrl,
    imageUrl: "https://cbu01.alicdn.com/start.jpg",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return new Response(Uint8Array.from([1, 2, 3, 4]), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": "4" },
      });
    },
  });

  assert.deepEqual([...result.bytes], [1, 2, 3, 4]);
  assert.equal(result.mimeType, "image/jpeg");
  assert.equal(result.finalUrl, "https://cbu01.alicdn.com/start.jpg");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].options.redirect, "manual");
  assert.equal("cookie" in Object.fromEntries(new Headers(calls[0].options.headers)), false);
  assert.equal("authorization" in Object.fromEntries(new Headers(calls[0].options.headers)), false);
});

test("trusted product image proxy revalidates every redirect", async () => {
  await assert.rejects(
    () => fetchTrustedProductImage({
      sourcePageUrl,
      imageUrl: "https://cbu01.alicdn.com/start.jpg",
      fetchImpl: async () => new Response(null, {
        status: 302,
        headers: { location: "http://127.0.0.1/private.jpg" },
      }),
    }),
    /重定向图片地址不受支持/,
  );
});

test("trusted product image proxy rejects non-images and oversized responses", async () => {
  await assert.rejects(
    () => fetchTrustedProductImage({
      sourcePageUrl,
      imageUrl: "https://cbu01.alicdn.com/not-image.jpg",
      fetchImpl: async () => new Response("not an image", {
        status: 200,
        headers: { "content-type": "text/html" },
      }),
    }),
    /不是受支持的图片/,
  );

  await assert.rejects(
    () => fetchTrustedProductImage({
      sourcePageUrl,
      imageUrl: "https://cbu01.alicdn.com/too-large.jpg",
      fetchImpl: async () => new Response(Uint8Array.from([1]), {
        status: 200,
        headers: { "content-type": "image/jpeg", "content-length": String(MAX_PRODUCT_IMAGE_BYTES + 1) },
      }),
    }),
    /超过 20 MiB/,
  );
});

test("trusted product image proxy rejects unsupported source pages before fetching", async () => {
  let called = false;
  await assert.rejects(
    () => fetchTrustedProductImage({
      sourcePageUrl: "https://evil.example/product/1",
      imageUrl: "https://cbu01.alicdn.com/a.jpg",
      fetchImpl: async () => {
        called = true;
        return new Response(Uint8Array.from([1]), { headers: { "content-type": "image/jpeg" } });
      },
    }),
    /1688 商品页/,
  );
  assert.equal(called, false);
});
