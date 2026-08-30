import test from "node:test";
import assert from "node:assert/strict";
import {
  createContentAddressedUploadCache,
  uploadMissingPublicImages,
} from "../lib/temu/image-upload.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "../lib/temu/template-headers.mjs";

const firstHash = "a".repeat(64);

test("相同图片内容只上传一次并复用公网 URL", async () => {
  const first = { url: "", status: "local" };
  const second = { url: "", status: "local" };
  let uploads = 0;
  const result = await uploadMissingPublicImages([
    { path: "assets.carousel.0", label: "轮播图 1", asset: first },
    { path: "skus.0.image", label: "SKU 1 图片", asset: second },
  ], {
    readBlob: async () => new Blob(["same-image"], { type: "image/jpeg" }),
    hashBlob: async () => firstHash,
    upload: async () => {
      uploads += 1;
      return { url: "https://res.cloudinary.com/demo/image/upload/shared.jpg", width: 1200, height: 1200 };
    },
  });

  assert.equal(uploads, 1);
  assert.deepEqual(result, { assetCount: 2, uploadCount: 1 });
  assert.equal(first.url, second.url);
  assert.equal(first.status, "uploaded");
  assert.equal(second.status, "uploaded");
});

test("上传失败会标记资产并阻止后续导出", async () => {
  const asset = { url: "", status: "local" };
  await assert.rejects(() => uploadMissingPublicImages([
    { path: "assets.carousel.0", label: "轮播图 1", asset },
  ], {
    readBlob: async () => new Blob(["image"], { type: "image/jpeg" }),
    hashBlob: async () => firstHash,
    upload: async () => { throw new Error("Upload preset not found"); },
  }), /Upload preset not found/);
  assert.equal(asset.status, "error");
  assert.equal(asset.url, "");
});

test("共享缓存跨调用复用地址并按 Cloud name 隔离", async () => {
  let uploads = 0;
  const cache = createContentAddressedUploadCache({ hashBlob: async () => firstHash });
  const blob = new Blob(["same-image"], { type: "image/jpeg" });
  const upload = async () => {
    uploads += 1;
    return { url: `https://res.cloudinary.com/demo/image/upload/${uploads}.jpg`, width: 1200, height: 1200 };
  };

  const first = await cache.upload(blob, { cloudName: "demo", upload });
  const second = await cache.upload(blob, { cloudName: "DEMO", upload });
  const otherCloud = await cache.upload(blob, { cloudName: "other", upload });

  assert.equal(uploads, 2);
  assert.equal(first.uploaded, true);
  assert.equal(second.uploaded, false);
  assert.equal(second.asset.url, first.asset.url);
  assert.notEqual(otherCloud.asset.url, first.asset.url);
  assert.equal(first.asset.contentHash, firstHash);
  assert.equal(first.asset.uploadCloudName, "demo");
});

test("恢复数据时替换同一内容哈希的旧缓存地址", async () => {
  const cache = createContentAddressedUploadCache();
  cache.seed([{
    uploadCloudName: "demo",
    contentHash: firstHash,
    url: "https://res.cloudinary.com/demo/image/upload/current.jpg",
  }]);
  cache.replaceSeed([{
    uploadCloudName: "demo",
    contentHash: firstHash,
    url: "https://res.cloudinary.com/demo/image/upload/restored.jpg",
  }]);

  assert.equal((await cache.find("demo", firstHash)).url, "https://res.cloudinary.com/demo/image/upload/restored.jpg");
});

test("恢复数据后旧的进行中上传不会重新污染缓存", async () => {
  let releaseUpload;
  const gate = new Promise((resolve) => { releaseUpload = resolve; });
  const cache = createContentAddressedUploadCache({ hashBlob: async () => firstHash });
  const pending = cache.upload(new Blob(["old-image"], { type: "image/jpeg" }), {
    cloudName: "demo",
    upload: async () => {
      await gate;
      return { url: "https://res.cloudinary.com/demo/image/upload/old-pending.jpg" };
    },
  });
  await Promise.resolve();
  cache.replaceSeed([{
    uploadCloudName: "demo",
    contentHash: firstHash,
    url: "https://res.cloudinary.com/demo/image/upload/restored.jpg",
  }]);
  releaseUpload();
  await pending;

  assert.equal((await cache.find("demo", firstHash)).url, "https://res.cloudinary.com/demo/image/upload/restored.jpg");
});

test("恢复数据发生在哈希阶段时旧上传不会污染新缓存", async () => {
  let releaseHash;
  const hashGate = new Promise((resolve) => { releaseHash = resolve; });
  const cache = createContentAddressedUploadCache({
    hashBlob: async () => {
      await hashGate;
      return firstHash;
    },
  });
  const pending = cache.upload(new Blob(["old-image"], { type: "image/jpeg" }), {
    cloudName: "demo",
    upload: async () => ({ url: "https://res.cloudinary.com/demo/image/upload/old-hash.jpg" }),
  });
  await Promise.resolve();
  cache.replaceSeed([]);
  releaseHash();
  await pending;

  assert.equal(await cache.find("demo", firstHash), null);
});

test("共享缓存合并并发的相同图片上传", async () => {
  let uploads = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const cache = createContentAddressedUploadCache({ hashBlob: async () => firstHash });
  const blob = new Blob(["same-image"], { type: "image/jpeg" });
  const upload = async () => {
    uploads += 1;
    await gate;
    return { url: "https://res.cloudinary.com/demo/image/upload/shared.jpg" };
  };

  const first = cache.upload(blob, { cloudName: "demo", upload });
  const second = cache.upload(blob, { cloudName: "demo", upload });
  await Promise.resolve();
  release();
  const [firstResult, secondResult] = await Promise.all([first, second]);

  assert.equal(uploads, 1);
  assert.equal(firstResult.asset.url, secondResult.asset.url);
  assert.deepEqual([firstResult.uploaded, secondResult.uploaded].sort(), [false, true]);
});

test("共享并发上传失败只发送一次且允许后续重试", async () => {
  let uploads = 0;
  let release;
  const gate = new Promise((resolve) => { release = resolve; });
  const cache = createContentAddressedUploadCache({ hashBlob: async () => firstHash });
  const blob = new Blob(["same-image"], { type: "image/jpeg" });
  const failingUpload = async () => {
    uploads += 1;
    await gate;
    throw new Error("network failed");
  };

  const first = cache.upload(blob, { cloudName: "demo", upload: failingUpload });
  const second = cache.upload(blob, { cloudName: "demo", upload: failingUpload });
  await Promise.resolve();
  release();
  const results = await Promise.allSettled([first, second]);

  assert.equal(uploads, 1);
  assert.ok(results.every((result) => result.status === "rejected" && /network failed/.test(result.reason.message)));

  const retried = await cache.upload(blob, {
    cloudName: "demo",
    upload: async () => {
      uploads += 1;
      return { url: "https://res.cloudinary.com/demo/image/upload/retry.jpg" };
    },
  });
  assert.equal(uploads, 2);
  assert.equal(retried.uploaded, true);
});

test("已持久化的内容哈希可在不读取图片的情况下复用地址", async () => {
  const cache = createContentAddressedUploadCache();
  cache.seed([{
    uploadCloudName: "demo",
    contentHash: firstHash,
    url: "https://res.cloudinary.com/demo/image/upload/persisted.jpg",
    width: 1200,
    height: 1200,
  }]);
  const asset = { url: "", contentHash: firstHash, status: "local" };
  let reads = 0;
  let uploads = 0;

  const result = await uploadMissingPublicImages([
    { path: "assets.carousel.0", label: "轮播图 1", asset },
  ], {
    readBlob: async () => {
      reads += 1;
      return new Blob(["same-image"], { type: "image/jpeg" });
    },
    uploadOnce: async () => {
      uploads += 1;
      throw new Error("不应上传");
    },
    findUploaded: (contentHash) => cache.find("demo", contentHash),
  });

  assert.deepEqual(result, { assetCount: 1, uploadCount: 0 });
  assert.equal(reads, 0);
  assert.equal(uploads, 0);
  assert.equal(asset.url, "https://res.cloudinary.com/demo/image/upload/persisted.jpg");
});

test("可变来源即使保留旧哈希也会读取当前内容后决定复用", async () => {
  const secondHash = "b".repeat(64);
  const asset = { url: "", contentHash: firstHash, status: "local" };
  let reads = 0;
  let lookedUpHash = "";
  let uploadedHash = "";

  const result = await uploadMissingPublicImages([
    { path: "assets.carousel.0", label: "轮播图 1", asset },
  ], {
    readBlob: async () => {
      reads += 1;
      return new Blob(["changed-image"], { type: "image/jpeg" });
    },
    hashBlob: async () => secondHash,
    sourceKey: () => `${TEMU_STUDIO_IMAGE_PATH}?setId=one&itemId=same`,
    findUploaded: async (contentHash) => {
      lookedUpHash = contentHash;
      return null;
    },
    uploadOnce: async (_blob, _entry, contentHash) => {
      uploadedHash = contentHash;
      return { asset: { url: "https://res.cloudinary.com/demo/image/upload/changed.jpg" }, uploaded: true };
    },
  });

  assert.equal(reads, 1);
  assert.equal(lookedUpHash, secondHash);
  assert.equal(uploadedHash, secondHash);
  assert.equal(asset.contentHash, secondHash);
  assert.deepEqual(result, { assetCount: 1, uploadCount: 1 });
});

test("跨商品补传共享同一来源读取结果但仍按实际内容哈希", async () => {
  const sourceReads = new Map();
  const cache = createContentAddressedUploadCache();
  let reads = 0;
  let uploads = 0;
  const options = {
    readBlob: async () => {
      reads += 1;
      return new Blob(["shared-source"], { type: "image/jpeg" });
    },
    hashBlob: async () => firstHash,
    sourceKey: () => `${TEMU_STUDIO_IMAGE_PATH}?setId=one&itemId=shared`,
    sourceReads,
    findUploaded: (contentHash) => cache.find("demo", contentHash),
    uploadOnce: (blob, _entry, contentHash) => cache.upload(blob, {
      cloudName: "demo",
      contentHash,
      upload: async () => {
        uploads += 1;
        return { url: "https://res.cloudinary.com/demo/image/upload/shared.jpg" };
      },
    }),
  };

  const first = { url: "", status: "local" };
  const second = { url: "", status: "local" };
  await uploadMissingPublicImages([{ path: "assets.carousel.0", label: "商品 1 轮播图", asset: first }], options);
  await uploadMissingPublicImages([{ path: "assets.carousel.0", label: "商品 2 轮播图", asset: second }], options);

  assert.equal(reads, 1);
  assert.equal(uploads, 1);
  assert.equal(first.url, second.url);
  assert.equal(first.contentHash, firstHash);
  assert.equal(second.contentHash, firstHash);
});

test("共享来源读取失败后允许使用同一 Map 重试", async () => {
  const sourceReads = new Map();
  let reads = 0;
  let failed = true;
  const entry = () => ({ path: "assets.carousel.0", label: "轮播图 1", asset: { url: "", status: "local" } });
  const options = {
    readBlob: async () => {
      reads += 1;
      if (failed) {
        failed = false;
        throw new Error("transient source failure");
      }
      return new Blob(["retry-image"], { type: "image/jpeg" });
    },
    hashBlob: async () => firstHash,
    sourceKey: () => `${TEMU_STUDIO_IMAGE_PATH}?setId=one&itemId=retry`,
    sourceReads,
    upload: async () => ({ url: "https://res.cloudinary.com/demo/image/upload/retry-source.jpg" }),
  };

  await assert.rejects(() => uploadMissingPublicImages([entry()], options), /transient source failure/);
  const retried = entry();
  await uploadMissingPublicImages([retried], options);

  assert.equal(reads, 2);
  assert.equal(retried.asset.url, "https://res.cloudinary.com/demo/image/upload/retry-source.jpg");
});

test("同一来源只读取一次再按内容上传一次", async () => {
  const first = { url: "", status: "local" };
  const second = { url: "", status: "local" };
  let reads = 0;
  let uploads = 0;
  const result = await uploadMissingPublicImages([
    { path: "assets.carousel.0", label: "轮播图 1", asset: first },
    { path: "skus.0.image", label: "SKU 1 图片", asset: second },
  ], {
    readBlob: async () => {
      reads += 1;
      return new Blob(["same-image"], { type: "image/jpeg" });
    },
    hashBlob: async () => firstHash,
    sourceKey: () => `${TEMU_STUDIO_IMAGE_PATH}?setId=one&itemId=same`,
    upload: async () => {
      uploads += 1;
      return { url: "https://res.cloudinary.com/demo/image/upload/shared.jpg" };
    },
  });

  assert.equal(reads, 1);
  assert.equal(uploads, 1);
  assert.deepEqual(result, { assetCount: 2, uploadCount: 1 });
  assert.equal(first.url, second.url);
});

test("共享来源读取失败会标记全部引用", async () => {
  const first = { url: "", status: "local" };
  const second = { url: "", status: "local" };
  await assert.rejects(() => uploadMissingPublicImages([
    { path: "assets.carousel.0", label: "轮播图 1", asset: first },
    { path: "skus.0.image", label: "SKU 1 图片", asset: second },
  ], {
    readBlob: async () => { throw new Error("source unavailable"); },
    sourceKey: () => `${TEMU_STUDIO_IMAGE_PATH}?setId=one&itemId=same`,
    upload: async () => ({ url: "https://example.com/unreachable.jpg" }),
  }), /source unavailable/);

  assert.deepEqual([first.status, second.status], ["error", "error"]);
  assert.deepEqual([first.url, second.url], ["", ""]);
});
