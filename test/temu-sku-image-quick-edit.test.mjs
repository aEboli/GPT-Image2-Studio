import assert from "node:assert/strict";
import test from "node:test";

import {
  createSkuImageFromCarousel,
  releaseUnusedAssetResources,
  updateSkuImageUrl,
  viewableSkuImageUrl,
} from "../lib/temu/sku-image-quick-edit.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "../lib/temu/template-headers.mjs";

function workbenchWithAssets({ carousel = [], skus = [] } = {}) {
  return {
    items: [{
      draft: {
        assets: { carousel, packaging: [] },
        skus: skus.map((image) => ({ image })),
      },
    }],
  };
}

test("轮播资产复制为独立 SKU 图片并保留来源字段", () => {
  const source = {
    id: "carousel-1",
    name: "main.jpg",
    url: "https://example.com/main.jpg",
    localPreview: "blob:main",
    studioPreviewUrl: `${TEMU_STUDIO_IMAGE_PATH}?setId=one&itemId=main`,
    width: 1200,
    height: 1200,
    status: "uploaded",
  };
  const result = createSkuImageFromCarousel(source, { id: "sku-copy" });

  assert.notEqual(result, source);
  assert.equal(result.id, "sku-copy");
  assert.equal(result.url, source.url);
  assert.equal(result.localPreview, source.localPreview);
  assert.equal(result.studioPreviewUrl, source.studioPreviewUrl);
  result.status = "pending";
  assert.equal(source.status, "uploaded", "SKU 状态变化不得污染轮播资产");
});

test("不合格轮播尺寸复制后立即进入现有 SKU 阻塞状态", () => {
  const result = createSkuImageFromCarousel({ width: 1200, height: 900, status: "verified" }, { id: "sku-copy" });
  assert.equal(result.status, "error");
  assert.equal(result.error, "SKU 图必须为大于 800×800 的正方形");
});

test("查看链接只返回规范化的公网 HTTP(S) 地址", () => {
  assert.equal(
    viewableSkuImageUrl({ url: "https://example.com/image.jpg#preview" }),
    "https://example.com/image.jpg#preview",
  );
  assert.equal(viewableSkuImageUrl({ url: "http://example.com/image.jpg" }), "http://example.com/image.jpg");
  assert.equal(viewableSkuImageUrl({ url: "blob:local-preview" }), "");
  assert.equal(viewableSkuImageUrl({ url: "http://127.0.0.1/image.jpg" }), "");
  assert.equal(viewableSkuImageUrl({ url: "" }), "");
});

test("手工修改 SKU 图片 URL 会清空旧上传来源信息", () => {
  const asset = {
    url: "https://res.cloudinary.com/demo/image/upload/old.jpg",
    contentHash: "a".repeat(64),
    uploadCloudName: "demo",
    width: 1200,
    height: 1200,
    bytes: 1234,
    format: "jpg",
    status: "uploaded",
  };

  updateSkuImageUrl(asset, " https://example.com/manual.jpg ");

  assert.deepEqual(asset, {
    url: "https://example.com/manual.jpg",
    contentHash: "",
    uploadCloudName: "",
    width: null,
    height: null,
    bytes: null,
    format: "",
    status: "pending",
    error: "",
  });
});

test("手工 URL 未变化时保留有效上传来源信息", () => {
  const asset = {
    url: "https://res.cloudinary.com/demo/image/upload/current.jpg",
    contentHash: "a".repeat(64),
    uploadCloudName: "demo",
    status: "uploaded",
  };

  updateSkuImageUrl(asset, ` ${asset.url} `);

  assert.equal(asset.contentHash, "a".repeat(64));
  assert.equal(asset.uploadCloudName, "demo");
  assert.equal(asset.status, "uploaded");
});

test("共享 blob 仍被轮播图引用时只清理旧 SKU 文件映射", () => {
  const carousel = { id: "carousel-1", localPreview: "blob:shared" };
  const removed = { id: "old-sku", localPreview: "blob:shared" };
  const localFiles = new Map([["carousel-1", {}], ["old-sku", {}]]);
  const revoked = [];

  releaseUnusedAssetResources(removed, workbenchWithAssets({ carousel: [carousel] }), localFiles, (url) => revoked.push(url));

  assert.equal(localFiles.has("old-sku"), false);
  assert.equal(localFiles.has("carousel-1"), true);
  assert.deepEqual(revoked, []);
});

test("最后一个 blob 引用移除后释放文件映射和预览 URL", () => {
  const removed = { id: "old-sku", localPreview: "blob:unused" };
  const localFiles = new Map([["old-sku", {}]]);
  const revoked = [];

  releaseUnusedAssetResources(removed, workbenchWithAssets(), localFiles, (url) => revoked.push(url));

  assert.equal(localFiles.has("old-sku"), false);
  assert.deepEqual(revoked, ["blob:unused"]);
});

test("清空 SKU 图时保留仍被其他 SKU 使用的本地预览", () => {
  const shared = { id: "shared-sku", localPreview: "blob:shared-sku" };
  const removed = { id: "old-sku", localPreview: "blob:shared-sku" };
  const localFiles = new Map([["shared-sku", {}], ["old-sku", {}]]);
  const revoked = [];

  releaseUnusedAssetResources(removed, workbenchWithAssets({ skus: [shared] }), localFiles, (url) => revoked.push(url));

  assert.equal(localFiles.has("old-sku"), false);
  assert.equal(localFiles.has("shared-sku"), true);
  assert.deepEqual(revoked, []);
});
