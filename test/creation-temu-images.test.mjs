import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, symlink, truncate, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  inspectLocalTemuImage,
  mergeTemuImageCache,
  resolveTemuImageRequirements,
  uploadTemuImageToCloudinary,
} from "../lib/creation-temu-images.mjs";
import { TEMU_EXPORT_LIMITS } from "../lib/creation-temu-export.mjs";

const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);

async function makeImageRoot() {
  const root = await mkdtemp(join(tmpdir(), "temu-images-"));
  await mkdir(join(root, "sets", "a"), { recursive: true });
  await writeFile(join(root, "sets", "a", "hero.png"), PNG_BYTES);
  return root;
}

function makeRequirement({ itemId = "hero", relativePath = "sets/a/hero.png", setId = "set-a" } = {}) {
  return {
    itemKey: `${setId}:${itemId}`,
    setId,
    productName: "商品",
    item: {
      itemId,
      filename: `${itemId}.png`,
      relativePath,
      status: "completed",
    },
  };
}

test("local Temu image inspection enforces containment, type and fingerprint", async () => {
  const outputDir = await makeImageRoot();
  const image = await inspectLocalTemuImage({ outputDir, relativePath: "sets/a/hero.png" });

  assert.equal(image.relativePath, "sets/a/hero.png");
  assert.equal(image.mimeType, "image/png");
  assert.equal(image.size, PNG_BYTES.length);
  assert.match(image.sourceSha256, /^sha256:[a-f0-9]{64}$/u);
  assert.deepEqual(await readFile(image.absolutePath), PNG_BYTES);

  await assert.rejects(
    inspectLocalTemuImage({ outputDir, relativePath: "../outside.png" }),
    (error) => error.code === "UNSAFE_IMAGE_PATH",
  );
  await assert.rejects(
    inspectLocalTemuImage({ outputDir, relativePath: join(outputDir, "sets", "a", "hero.png") }),
    (error) => error.code === "UNSAFE_IMAGE_PATH",
  );
  await writeFile(join(outputDir, "sets", "a", "not-image.png"), Buffer.from("not a png"));
  await assert.rejects(
    inspectLocalTemuImage({ outputDir, relativePath: "sets/a/not-image.png" }),
    (error) => error.code === "UNSUPPORTED_IMAGE_TYPE",
  );
});

test("local Temu image inspection rejects a symlink when the platform allows creating it", async (t) => {
  const outputDir = await makeImageRoot();
  const outsideDir = await mkdtemp(join(tmpdir(), "temu-image-outside-"));
  const outsidePath = join(outsideDir, "outside.png");
  await writeFile(outsidePath, PNG_BYTES);
  const linkPath = join(outputDir, "sets", "a", "link.png");
  try {
    await symlink(outsidePath, linkPath, "file");
  } catch (error) {
    if (error?.code === "EPERM") return t.skip("当前 Windows 配置不允许创建测试符号链接");
    throw error;
  }
  await assert.rejects(
    inspectLocalTemuImage({ outputDir, relativePath: "sets/a/link.png" }),
    (error) => error.code === "UNSAFE_IMAGE_PATH",
  );
});

test("local Temu image inspection rejects unsafe paths, non-files, unsupported types and oversized files", async (t) => {
  const outputDir = await makeImageRoot();
  t.after(() => rm(outputDir, { recursive: true, force: true }));

  const nestedFile = join(outputDir, "sets", "a", "not-a-directory");
  const unsupportedPath = join(outputDir, "sets", "a", "unsupported.bmp");
  const mismatchedPath = join(outputDir, "sets", "a", "mismatched.jpg");
  const tooLargePath = join(outputDir, "sets", "a", "too-large.png");
  await writeFile(nestedFile, "not a directory");
  await writeFile(unsupportedPath, PNG_BYTES);
  await writeFile(mismatchedPath, PNG_BYTES);
  await writeFile(tooLargePath, "");
  await truncate(tooLargePath, TEMU_EXPORT_LIMITS.maxImageBytes + 1);

  for (const relativePath of ["", ".", "/", "sets/a", "sets/a/not-a-directory/hero.png"]) {
    await assert.rejects(
      inspectLocalTemuImage({ outputDir, relativePath }),
      (error) => error?.code === "UNSAFE_IMAGE_PATH",
    );
  }
  await assert.rejects(
    inspectLocalTemuImage({ outputDir, relativePath: "sets/a/unsupported.bmp" }),
    (error) => error?.code === "UNSUPPORTED_IMAGE_TYPE",
  );
  await assert.rejects(
    inspectLocalTemuImage({ outputDir, relativePath: "sets/a/mismatched.jpg" }),
    (error) => error?.code === "UNSUPPORTED_IMAGE_TYPE",
  );
  await assert.rejects(
    inspectLocalTemuImage({ outputDir, relativePath: "sets/a/too-large.png" }),
    (error) => error?.code === "IMAGE_FILE_TOO_LARGE",
  );
});

test("Cloudinary unsigned upload uses only the fixed endpoint and allowed multipart fields", async () => {
  const outputDir = await makeImageRoot();
  const localImage = await inspectLocalTemuImage({ outputDir, relativePath: "sets/a/hero.png" });
  const calls = [];
  const result = await uploadTemuImageToCloudinary({
    localImage,
    cloudinary: { cloudName: "demo-cloud", uploadPreset: "temu_unsigned" },
    fetchImpl: async (url, init) => {
      calls.push({ url, init });
      return new Response(JSON.stringify({
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero.png",
        public_id: "hero",
        asset_id: "asset-1",
        width: 1200,
        height: 1200,
        format: "png",
      }), { status: 200, headers: { "Content-Type": "application/json" } });
    },
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://api.cloudinary.com/v1_1/demo-cloud/image/upload");
  assert.equal(calls[0].init.method, "POST");
  assert.equal(calls[0].init.body.get("upload_preset"), "temu_unsigned");
  assert.equal(calls[0].init.body.get("file") instanceof Blob, true);
  assert.deepEqual([...calls[0].init.body.keys()].sort(), ["file", "upload_preset"]);
  assert.equal(calls[0].init.headers?.Authorization, undefined);
  assert.equal(result.url, "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero.png");
  assert.equal(result.assetId, "asset-1");
});

test("Cloudinary upload rejects foreign or incomplete secure URLs without leaking response content", async () => {
  const outputDir = await makeImageRoot();
  const localImage = await inspectLocalTemuImage({ outputDir, relativePath: "sets/a/hero.png" });
  await assert.rejects(
    uploadTemuImageToCloudinary({
      localImage,
      cloudinary: { cloudName: "demo-cloud", uploadPreset: "preset" },
      fetchImpl: async () => new Response(JSON.stringify({ secure_url: "https://example.com/a.png" }), { status: 200 }),
    }),
    (error) => error.code === "IMAGE_UPLOAD_FAILED" && !/example\.com/u.test(error.message),
  );
  await assert.rejects(
    uploadTemuImageToCloudinary({
      localImage,
      cloudinary: { cloudName: "demo-cloud", uploadPreset: "preset" },
      fetchImpl: async () => new Response("secret upstream error body", { status: 500 }),
      maxAttempts: 1,
    }),
    (error) => error.code === "IMAGE_UPLOAD_FAILED" && !/secret upstream/u.test(error.message),
  );
});

test("Cloudinary upload bounds retries, timeouts, invalid JSON and response size", async () => {
  const outputDir = await makeImageRoot();
  const localImage = await inspectLocalTemuImage({ outputDir, relativePath: "sets/a/hero.png" });
  const cloudinary = { cloudName: "demo-cloud", uploadPreset: "preset" };

  await assert.rejects(
    uploadTemuImageToCloudinary({
      localImage,
      cloudinary,
      fetchImpl: async () => new Promise(() => {}),
      maxAttempts: 1,
      timeoutMs: 5,
    }),
    (error) => error.code === "IMAGE_UPLOAD_FAILED",
  );

  let attempts = 0;
  const retried = await uploadTemuImageToCloudinary({
    localImage,
    cloudinary,
    maxAttempts: 2,
    fetchImpl: async () => {
      attempts += 1;
      if (attempts === 1) return new Response("", { status: 503 });
      return new Response(JSON.stringify({
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/retried.png",
      }), { status: 200 });
    },
  });
  assert.equal(attempts, 2);
  assert.equal(retried.secureUrl, "https://res.cloudinary.com/demo-cloud/image/upload/v1/retried.png");

  await assert.rejects(
    uploadTemuImageToCloudinary({
      localImage,
      cloudinary,
      fetchImpl: async () => new Response("not-json", { status: 200 }),
    }),
    (error) => error.code === "IMAGE_UPLOAD_FAILED",
  );
  await assert.rejects(
    uploadTemuImageToCloudinary({
      localImage,
      cloudinary,
      fetchImpl: async () => new Response("x".repeat(64), { status: 200 }),
      maxResponseBytes: 16,
    }),
    (error) => error.code === "IMAGE_UPLOAD_FAILED",
  );
});

test("image resolution rejects more than the bounded unique image count", async () => {
  const requirements = Array.from(
    { length: TEMU_EXPORT_LIMITS.maxUniqueImages + 1 },
    (_, index) => ({
      itemKey: "set-a:item-" + index,
      setId: "set-a",
      item: {
        itemId: "item-" + index,
        publicUrl: "https://img.kwcdn.com/product/" + index + ".png",
      },
    }),
  );
  await assert.rejects(
    resolveTemuImageRequirements({ requirements, sets: [{ setId: "set-a" }] }),
    (error) => error.code === "IMAGE_LIMIT_EXCEEDED",
  );
});

test("image requirements reuse public URLs and content-deduplicate Cloudinary uploads", async () => {
  const outputDir = await makeImageRoot();
  await writeFile(join(outputDir, "sets", "a", "same.png"), PNG_BYTES);
  let fetchCount = 0;
  const requirements = [
    makeRequirement({ itemId: "hero" }),
    makeRequirement({ itemId: "same", relativePath: "sets/a/same.png" }),
    {
      ...makeRequirement({ itemId: "public" }),
      item: {
        itemId: "public",
        filename: "public.png",
        publicUrl: "https://img.kwcdn.com/product/public.jpeg",
      },
    },
  ];
  const resolved = await resolveTemuImageRequirements({
    requirements,
    sets: [{ setId: "set-a" }],
    outputDir,
    cloudinary: { cloudName: "demo-cloud", uploadPreset: "preset" },
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/shared.png",
        public_id: "shared",
        asset_id: "asset-shared",
      }), { status: 200 });
    },
  });

  assert.equal(fetchCount, 1);
  assert.equal(resolved.results.get("set-a:hero").url, "https://res.cloudinary.com/demo-cloud/image/upload/v1/shared.png");
  assert.equal(resolved.results.get("set-a:same").url, "https://res.cloudinary.com/demo-cloud/image/upload/v1/shared.png");
  assert.equal(resolved.results.get("set-a:public").url, "https://img.kwcdn.com/product/public.jpeg");
  assert.equal(resolved.cacheEntriesBySet.get("set-a").size, 2);
});

test("matching fingerprint cache is reused without Cloudinary config or another upload", async () => {
  const outputDir = await makeImageRoot();
  const inspected = await inspectLocalTemuImage({ outputDir, relativePath: "sets/a/hero.png" });
  const set = mergeTemuImageCache({ setId: "set-a" }, new Map([
    ["hero", {
      sourceRelativePath: "sets/a/hero.png",
      sourceSha256: inspected.sourceSha256,
      cloudName: "demo-cloud",
      secureUrl: "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero.png",
      assetId: "asset-1",
      publicId: "hero",
      uploadedAt: "2026-08-01T00:00:00.000Z",
    }],
  ]));
  let fetchCount = 0;
  const resolved = await resolveTemuImageRequirements({
    requirements: [makeRequirement()],
    sets: [set],
    outputDir,
    cloudinary: null,
    fetchImpl: async () => {
      fetchCount += 1;
      throw new Error("不应上传");
    },
  });

  assert.equal(fetchCount, 0);
  assert.equal(resolved.results.get("set-a:hero").source, "cloudinary-cache");
  assert.equal(resolved.results.get("set-a:hero").url, "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero.png");
});

test("image resolution invalidates a cached upload after the local source changes", async (t) => {
  const outputDir = await makeImageRoot();
  t.after(() => rm(outputDir, { recursive: true, force: true }));

  const original = await inspectLocalTemuImage({ outputDir, relativePath: "sets/a/hero.png" });
  const set = mergeTemuImageCache({ setId: "set-a" }, new Map([
    ["hero", {
      sourceRelativePath: "sets/a/hero.png",
      sourceSha256: original.sourceSha256,
      cloudName: "demo-cloud",
      secureUrl: "https://res.cloudinary.com/demo-cloud/image/upload/v1/old-hero.png",
      assetId: "asset-old",
      publicId: "old-hero",
      uploadedAt: "2026-08-01T00:00:00.000Z",
    }],
  ]));
  await writeFile(join(outputDir, "sets", "a", "hero.png"), Buffer.concat([PNG_BYTES, Buffer.from([0x01])]));

  let fetchCount = 0;
  const resolved = await resolveTemuImageRequirements({
    requirements: [makeRequirement()],
    sets: [set],
    outputDir,
    cloudinary: { cloudName: "demo-cloud", uploadPreset: "preset" },
    fetchImpl: async () => {
      fetchCount += 1;
      return new Response(JSON.stringify({
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/new-hero.png",
        public_id: "new-hero",
        asset_id: "asset-new",
      }), { status: 200 });
    },
  });

  const changed = await inspectLocalTemuImage({ outputDir, relativePath: "sets/a/hero.png" });
  const cacheEntry = resolved.cacheEntriesBySet.get("set-a").get("hero");
  assert.equal(fetchCount, 1);
  assert.equal(resolved.results.get("set-a:hero").source, "cloudinary-upload");
  assert.notEqual(changed.sourceSha256, original.sourceSha256);
  assert.equal(cacheEntry.sourceSha256, changed.sourceSha256);
});

test("image resolution invalidates cache entries for a different Cloudinary cloud or delivery type", async (t) => {
  const outputDir = await makeImageRoot();
  t.after(() => rm(outputDir, { recursive: true, force: true }));

  const inspected = await inspectLocalTemuImage({ outputDir, relativePath: "sets/a/hero.png" });
  const cloudChangedSet = mergeTemuImageCache({ setId: "set-a" }, new Map([
    ["hero", {
      sourceRelativePath: "sets/a/hero.png",
      sourceSha256: inspected.sourceSha256,
      cloudName: "demo-cloud",
      secureUrl: "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero.png",
      assetId: "asset-1",
      publicId: "hero",
      uploadedAt: "2026-08-01T00:00:00.000Z",
    }],
  ]));

  let cloudChangedFetches = 0;
  const cloudChanged = await resolveTemuImageRequirements({
    requirements: [makeRequirement()],
    sets: [cloudChangedSet],
    outputDir,
    cloudinary: { cloudName: "other-cloud", uploadPreset: "preset" },
    fetchImpl: async () => {
      cloudChangedFetches += 1;
      return new Response(JSON.stringify({
        secure_url: "https://res.cloudinary.com/other-cloud/image/upload/v1/hero.png",
        public_id: "hero",
        asset_id: "asset-other",
      }), { status: 200 });
    },
  });

  assert.equal(cloudChangedFetches, 1);
  assert.equal(cloudChanged.results.get("set-a:hero").source, "cloudinary-upload");
  assert.equal(cloudChanged.cacheEntriesBySet.get("set-a").get("hero").cloudName, "other-cloud");

  const invalidDeliverySet = mergeTemuImageCache({ setId: "set-a" }, new Map([
    ["hero", {
      sourceRelativePath: "sets/a/hero.png",
      sourceSha256: inspected.sourceSha256,
      cloudName: "demo-cloud",
      secureUrl: "https://res.cloudinary.com/demo-cloud/raw/upload/v1/hero.png",
      assetId: "asset-invalid",
      publicId: "hero",
      uploadedAt: "2026-08-01T00:00:00.000Z",
    }],
  ]));

  let invalidDeliveryFetches = 0;
  const invalidDelivery = await resolveTemuImageRequirements({
    requirements: [makeRequirement()],
    sets: [invalidDeliverySet],
    outputDir,
    cloudinary: { cloudName: "demo-cloud", uploadPreset: "preset" },
    fetchImpl: async () => {
      invalidDeliveryFetches += 1;
      return new Response(JSON.stringify({
        secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/reuploaded-hero.png",
        public_id: "reuploaded-hero",
        asset_id: "asset-reuploaded",
      }), { status: 200 });
    },
  });

  assert.equal(invalidDeliveryFetches, 1);
  assert.equal(invalidDelivery.results.get("set-a:hero").source, "cloudinary-upload");
  assert.equal(
    invalidDelivery.cacheEntriesBySet.get("set-a").get("hero").secureUrl,
    "https://res.cloudinary.com/demo-cloud/image/upload/v1/reuploaded-hero.png",
  );
});

test("image resolution keeps successful uploads when another local image upload fails", async (t) => {
  const outputDir = await makeImageRoot();
  t.after(() => rm(outputDir, { recursive: true, force: true }));
  await writeFile(join(outputDir, "sets", "a", "variant.png"), Buffer.concat([PNG_BYTES, Buffer.from([0x02])]));

  const uploadedNames = [];
  const resolved = await resolveTemuImageRequirements({
    requirements: [
      makeRequirement({ itemId: "hero" }),
      makeRequirement({ itemId: "variant", relativePath: "sets/a/variant.png" }),
    ],
    sets: [{ setId: "set-a" }],
    outputDir,
    cloudinary: { cloudName: "demo-cloud", uploadPreset: "preset" },
    maxConcurrency: 1,
    maxAttempts: 1,
    fetchImpl: async (_url, init) => {
      const name = init.body.get("file").name;
      uploadedNames.push(name);
      if (name === "hero.png") {
        return new Response(JSON.stringify({
          secure_url: "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero.png",
          public_id: "hero",
          asset_id: "asset-hero",
        }), { status: 200 });
      }
      return new Response("upload failed", { status: 500 });
    },
  });

  const cacheEntries = resolved.cacheEntriesBySet.get("set-a");
  assert.deepEqual(uploadedNames, ["hero.png", "variant.png"]);
  assert.equal(resolved.results.get("set-a:hero").source, "cloudinary-upload");
  assert.equal(resolved.results.get("set-a:hero").url, "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero.png");
  assert.equal(resolved.results.get("set-a:variant").url, "");
  assert.equal(resolved.results.get("set-a:variant").code, "IMAGE_UPLOAD_FAILED");
  assert.equal(cacheEntries.has("hero"), true);
  assert.equal(cacheEntries.has("variant"), false);
});

test("missing Cloudinary configuration leaves local-only images unresolved without absolute paths", async () => {
  const outputDir = await makeImageRoot();
  const resolved = await resolveTemuImageRequirements({
    requirements: [makeRequirement()],
    sets: [{ setId: "set-a" }],
    outputDir,
    cloudinary: null,
  });
  const result = resolved.results.get("set-a:hero");

  assert.equal(result.url, "");
  assert.equal(result.code, "MISSING_PUBLIC_IMAGE_URL");
  assert.doesNotMatch(result.message, /[A-Z]:\\|temu-images-/u);
});
