import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATION_TEMU_REMOTE_IMAGE_LIMITS,
  CreationTemuRemoteImageError,
  verifyCreationTemuRemoteImage,
  verifyCreationTemuRemoteImages,
} from "../lib/creation-temu-remote-images.mjs";

const PUBLIC_ADDRESS = "93.184.216.34";

function publicLookup(hostname, options) {
  assert.equal(options?.all, true);
  assert.equal(options?.verbatim, true);
  return [{ address: PUBLIC_ADDRESS, family: 4, hostname }];
}

function pngBytes(width = 1200, height = 1200) {
  const bytes = Buffer.alloc(24);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(bytes);
  bytes.writeUInt32BE(13, 8);
  bytes.write("IHDR", 12, "ascii");
  bytes.writeUInt32BE(width, 16);
  bytes.writeUInt32BE(height, 20);
  return bytes;
}

function jpegBytes(width = 1200, height = 1200) {
  const bytes = Buffer.alloc(21);
  bytes.set([0xff, 0xd8, 0xff, 0xc0, 0x00, 0x11, 0x08]);
  bytes.writeUInt16BE(height, 7);
  bytes.writeUInt16BE(width, 9);
  bytes[11] = 3;
  return bytes;
}

function webpContainer(chunkType, payload) {
  const padding = payload.length % 2;
  const bytes = Buffer.alloc(20 + payload.length + padding);
  bytes.write("RIFF", 0, "ascii");
  bytes.writeUInt32LE(bytes.length - 8, 4);
  bytes.write("WEBP", 8, "ascii");
  bytes.write(chunkType, 12, "ascii");
  bytes.writeUInt32LE(payload.length, 16);
  payload.copy(bytes, 20);
  return bytes;
}

function webpVp8xBytes(width = 1200, height = 1200) {
  const payload = Buffer.alloc(10);
  payload.writeUIntLE(width - 1, 4, 3);
  payload.writeUIntLE(height - 1, 7, 3);
  return webpContainer("VP8X", payload);
}

function webpVp8Bytes(width = 1200, height = 1200) {
  const payload = Buffer.alloc(10);
  payload.set([0x00, 0x00, 0x00, 0x9d, 0x01, 0x2a]);
  payload.writeUInt16LE(width, 6);
  payload.writeUInt16LE(height, 8);
  return webpContainer("VP8 ", payload);
}

function webpVp8lBytes(width = 1200, height = 1200) {
  const widthMinusOne = width - 1;
  const heightMinusOne = height - 1;
  const payload = Buffer.alloc(5);
  payload[0] = 0x2f;
  payload[1] = widthMinusOne & 0xff;
  payload[2] = ((widthMinusOne >> 8) & 0x3f) | ((heightMinusOne & 0x03) << 6);
  payload[3] = (heightMinusOne >> 2) & 0xff;
  payload[4] = (heightMinusOne >> 10) & 0x0f;
  return webpContainer("VP8L", payload);
}

function imageResponse(bytes, contentType = "image/png", init = {}) {
  return new Response(bytes, {
    status: init.status || 200,
    headers: { "content-type": contentType, ...(init.headers || {}) },
  });
}

async function rejectsWithCode(action, code) {
  await assert.rejects(action, (error) => {
    assert.equal(error instanceof CreationTemuRemoteImageError, true);
    assert.equal(error.code, code);
    return true;
  });
}

test("strict remote image validation requires credential-free public HTTPS after DNS resolution", async () => {
  const fetchImpl = async () => imageResponse(pngBytes());

  await rejectsWithCode(
    () => verifyCreationTemuRemoteImage({
      url: "http://images.example.test/a.png",
      lookup: publicLookup,
      fetchImpl,
    }),
    "REMOTE_IMAGE_URL_INVALID",
  );
  await rejectsWithCode(
    () => verifyCreationTemuRemoteImage({
      url: "https://user:password@images.example.test/a.png",
      lookup: publicLookup,
      fetchImpl,
    }),
    "REMOTE_IMAGE_URL_INVALID",
  );

  for (const address of ["10.0.0.7", "fd00::7", "::ffff:127.0.0.1", "::ffff:7f00:1"]) {
    await rejectsWithCode(
      () => verifyCreationTemuRemoteImage({
        url: "https://images.example.test/a.png",
        lookup: async () => [{ address }],
        fetchImpl,
      }),
      "REMOTE_IMAGE_PRIVATE_ADDRESS",
    );
  }
});

test("strict remote image validation rechecks every manual redirect and permits at most three", async () => {
  const lookups = [];
  const fetches = [];
  const redirectMap = new Map([
    ["https://start.example.test/a.png", "https://one.example.test/a.png"],
    ["https://one.example.test/a.png", "https://two.example.test/a.png"],
    ["https://two.example.test/a.png", "https://final.example.test/a.png"],
  ]);
  const result = await verifyCreationTemuRemoteImage({
    url: "https://start.example.test/a.png",
    lookup: async (hostname) => {
      lookups.push(hostname);
      return [{ address: PUBLIC_ADDRESS }];
    },
    fetchImpl: async (url, init) => {
      fetches.push({ url, redirect: init.redirect });
      const location = redirectMap.get(url);
      return location
        ? new Response(null, { status: 302, headers: { location } })
        : imageResponse(pngBytes());
    },
  });

  assert.equal(result.redirectCount, 3);
  assert.equal(result.url, "https://final.example.test/a.png");
  assert.deepEqual(lookups, [
    "start.example.test",
    "one.example.test",
    "two.example.test",
    "final.example.test",
  ]);
  assert.ok(fetches.every(({ redirect }) => redirect === "manual"));

  let privateFetches = 0;
  await rejectsWithCode(
    () => verifyCreationTemuRemoteImage({
      url: "https://public.example.test/a.png",
      lookup: async (hostname) => [{ address: hostname === "private.example.test" ? "192.168.1.2" : PUBLIC_ADDRESS }],
      fetchImpl: async () => {
        privateFetches += 1;
        return new Response(null, { status: 302, headers: { location: "https://private.example.test/a.png" } });
      },
    }),
    "REMOTE_IMAGE_PRIVATE_ADDRESS",
  );
  assert.equal(privateFetches, 1);

  await rejectsWithCode(
    () => verifyCreationTemuRemoteImage({
      url: "https://redirect.example.test/0.png",
      lookup: publicLookup,
      fetchImpl: async (url) => {
        const index = Number(new URL(url).pathname.match(/\d+/u)?.[0] || 0);
        return new Response(null, {
          status: 302,
          headers: { location: `https://redirect.example.test/${index + 1}.png` },
        });
      },
    }),
    "REMOTE_IMAGE_TOO_MANY_REDIRECTS",
  );
});

test("strict remote image validation enforces total timeout, streaming byte limit, and image content type", async () => {
  await rejectsWithCode(
    () => verifyCreationTemuRemoteImage({
      url: "https://images.example.test/slow.png",
      lookup: publicLookup,
      fetchImpl: async () => new Promise(() => {}),
      timeoutMs: 10,
    }),
    "REMOTE_IMAGE_TIMEOUT",
  );

  const chunk = new Uint8Array(1024 * 1024);
  const oversizedBody = new ReadableStream({
    start(controller) {
      for (let index = 0; index < 16; index += 1) controller.enqueue(chunk);
      controller.close();
    },
  });
  await rejectsWithCode(
    () => verifyCreationTemuRemoteImage({
      url: "https://images.example.test/large.png",
      lookup: publicLookup,
      fetchImpl: async () => new Response(oversizedBody, { headers: { "content-type": "image/png" } }),
    }),
    "REMOTE_IMAGE_TOO_LARGE",
  );

  await rejectsWithCode(
    () => verifyCreationTemuRemoteImage({
      url: "https://images.example.test/not-image.png",
      lookup: publicLookup,
      fetchImpl: async () => new Response("not an image", { headers: { "content-type": "text/plain" } }),
    }),
    "REMOTE_IMAGE_NOT_IMAGE",
  );
  assert.equal(CREATION_TEMU_REMOTE_IMAGE_LIMITS.timeoutMs, 12_000);
  assert.equal(CREATION_TEMU_REMOTE_IMAGE_LIMITS.maxBytes, 15 * 1024 * 1024);
});

test("strict remote image validation parses PNG, JPEG, and common WebP dimensions without sharp", async () => {
  const cases = [
    { name: "png", type: "image/png", bytes: pngBytes(1201, 1202), width: 1201, height: 1202, format: "png" },
    { name: "jpeg", type: "image/jpeg", bytes: jpegBytes(1203, 1204), width: 1203, height: 1204, format: "jpeg" },
    { name: "webp-vp8x", type: "image/webp", bytes: webpVp8xBytes(1205, 1206), width: 1205, height: 1206, format: "webp" },
    { name: "webp-vp8", type: "image/webp", bytes: webpVp8Bytes(1207, 1208), width: 1207, height: 1208, format: "webp" },
    { name: "webp-vp8l", type: "image/webp", bytes: webpVp8lBytes(1209, 1210), width: 1209, height: 1210, format: "webp" },
  ];

  for (const image of cases) {
    const result = await verifyCreationTemuRemoteImage({
      url: `https://images.example.test/${image.name}`,
      lookup: publicLookup,
      fetchImpl: async () => imageResponse(image.bytes, image.type),
    });
    assert.equal(result.width, image.width);
    assert.equal(result.height, image.height);
    assert.equal(result.format, image.format);
  }
});

test("batch validation deduplicates URLs and hard-caps injected concurrency at four", async () => {
  let fetchCount = 0;
  let active = 0;
  let maxActive = 0;
  const entries = Array.from({ length: 7 }, (_, index) => ({
    key: `image-${index}`,
    path: `sets.0.images.${index}`,
    url: `https://images.example.test/${index < 2 ? "shared" : index}.png`,
  }));
  const report = await verifyCreationTemuRemoteImages({
    entries,
    lookup: publicLookup,
    maxConcurrency: 99,
    fetchImpl: async () => {
      fetchCount += 1;
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return imageResponse(pngBytes());
    },
  });

  assert.equal(report.valid, true);
  assert.equal(report.imageCount, 7);
  assert.equal(report.uniqueUrlCount, 6);
  assert.equal(report.verifiedUrlCount, 6);
  assert.equal(fetchCount, 6);
  assert.equal(maxActive, 4);
  assert.equal(report.results.size, 7);
  assert.equal(report.results.get("image-0").url, report.results.get("image-1").url);
});

test("batch validation returns path-addressable structured issues for invalid SKU dimensions", async () => {
  const report = await verifyCreationTemuRemoteImages({
    entries: [
      {
        key: "sku-red",
        path: "sets.0.skus.0.image",
        label: "红色 SKU 图",
        role: "sku",
        url: "https://images.example.test/sku-red.png",
      },
      {
        key: "hero",
        path: "sets.0.assets.hero",
        role: "product",
        url: "https://images.example.test/hero.png",
      },
    ],
    lookup: publicLookup,
    fetchImpl: async (url) => imageResponse(url.includes("sku-red") ? pngBytes(800, 800) : pngBytes(1400, 1000)),
  });

  assert.equal(report.valid, false);
  assert.equal(report.results.has("hero"), true);
  assert.equal(report.results.has("sku-red"), false);
  assert.deepEqual(report.issues, [{
    severity: "error",
    code: "SKU_IMAGE_DIMENSIONS_INVALID",
    key: "sku-red",
    path: "sets.0.skus.0.image",
    role: "sku",
    message: "红色 SKU 图必须为宽高均大于 800 像素的正方形。",
    suggestion: "更换为宽高均大于 800 像素的正方形 SKU 图片。",
  }]);
});

test("batch validation applies the square over-800 rule to product material images", async () => {
  const report = await verifyCreationTemuRemoteImages({
    entries: [
      {
        key: "material",
        path: "sets.0.assets.material",
        label: "产品素材图",
        role: "material",
        url: "https://images.example.test/material.png",
      },
      {
        key: "carousel",
        path: "sets.0.assets.carousel.0",
        label: "轮播图 1",
        role: "carousel",
        url: "https://images.example.test/carousel.png",
      },
    ],
    lookup: publicLookup,
    fetchImpl: async () => imageResponse(pngBytes(1400, 1000)),
  });

  assert.equal(report.valid, false);
  assert.equal(report.results.has("carousel"), true);
  assert.equal(report.results.has("material"), false);
  assert.equal(report.issues.length, 1);
  assert.equal(report.issues[0].code, "MATERIAL_IMAGE_DIMENSIONS_INVALID");
  assert.equal(report.issues[0].path, "sets.0.assets.material");
});
