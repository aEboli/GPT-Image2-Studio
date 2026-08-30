import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

import {
  draftImageEntries,
  verifyDraftPublicImages,
  verifyDraftsPublicImages,
  verifyRemoteImageByUrl,
} from "../lib/temu-server/public-image-verifier.mjs";
import { createValidDraft } from "./temu-fixtures.mjs";

// 被吸收侧的 6 条用例全部注入 verifyImage，从未真跑过 sharp——移植后行为逐条不变，
// 下面这 6 条即原样保留（仅改 import 路径与 fixture 来源）。

test("服务端对重复公网 URL 只验证一次", async () => {
  const draft = createValidDraft();
  // fixture 本身已是 verified，若直接断言 verified 则删掉回写也照样绿；先置成 pending 让这条断言真正承重。
  draft.assets.carousel[0].status = "pending";
  draft.skus = draft.skus.map((sku) => ({ ...sku, image: { ...sku.image, status: "pending", error: "上一轮失败" } }));
  let calls = 0;
  const result = await verifyDraftPublicImages(draft, {
    verifyImage: async (url) => {
      calls += 1;
      return { url, width: 1200, height: 1200, bytes: 1000, format: "jpg" };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.uniqueUrlCount, 1);
  assert.equal(result.imageCount, 1 + draft.skus.length);
  assert.ok(result.draft.skus.every((sku) => sku.image.status === "verified"));
  assert.ok(result.draft.skus.every((sku) => sku.image.error === ""));
  assert.equal(result.draft.assets.carousel[0].status, "verified");
  assert.ok(result.draft.skus.every((sku) => sku.image.bytes === 1000 && sku.image.format === "jpg"));
});

test("多商品共享同一公网 URL 时只验证一次", async () => {
  const first = createValidDraft();
  const second = createValidDraft();
  let calls = 0;
  const result = await verifyDraftsPublicImages([first, second], {
    verifyImage: async (url) => {
      calls += 1;
      return { url, width: 1200, height: 1200, bytes: 1000, format: "jpg" };
    },
  });
  assert.equal(calls, 1);
  assert.equal(result.uniqueUrlCount, 1);
  assert.equal(result.drafts.length, 2);
});

test("服务端拒绝缺失或失效的公网图片 URL", async () => {
  const missing = createValidDraft();
  missing.assets.carousel[0].url = "";
  await assert.rejects(() => verifyDraftPublicImages(missing, { verifyImage: async () => ({}) }), (error) => {
    assert.equal(error.code, "PUBLIC_IMAGE_URL_ERROR");
    assert.ok(error.issues.some((issue) => issue.path === "assets.carousel.0"));
    return true;
  });

  const unreachable = createValidDraft();
  await assert.rejects(() => verifyDraftPublicImages(unreachable, {
    verifyImage: async () => { throw new Error("HTTP 404"); },
  }), /无法公开访问/u);
});

test("服务端用实测尺寸拒绝不合格 SKU 图", async () => {
  const draft = createValidDraft();
  await assert.rejects(() => verifyDraftPublicImages(draft, {
    verifyImage: async (url) => ({ url, width: 800, height: 800, bytes: 1000, format: "jpg" }),
  }), (error) => {
    assert.ok(error.issues.some((issue) => issue.code === "sku_image_dimensions"));
    return true;
  });
});

test("多商品公网图片失败定位到对应商品", async () => {
  const first = createValidDraft();
  const second = createValidDraft();
  second.assets.carousel[0].url = "";
  await assert.rejects(() => verifyDraftsPublicImages([first, second], {
    verifyImage: async (url) => ({ url, width: 1200, height: 1200, bytes: 1000, format: "jpg" }),
  }), (error) => {
    assert.equal(error.code, "PUBLIC_IMAGE_URL_ERROR");
    assert.ok(error.issues.some((issue) => issue.path === "drafts.1.assets.carousel.0"));
    assert.ok(error.issues.some((issue) => issue.message.startsWith("商品 2：")));
    return true;
  });
});

test("多商品共享的失败公网 URL 也只验证一次并分别定位", async () => {
  const first = createValidDraft();
  const second = createValidDraft();
  let calls = 0;

  await assert.rejects(() => verifyDraftsPublicImages([first, second], {
    verifyImage: async () => {
      calls += 1;
      throw new Error("HTTP 404");
    },
  }), (error) => {
    assert.equal(calls, 1);
    assert.ok(error.issues.some((issue) => issue.path.startsWith("drafts.0.")));
    assert.ok(error.issues.some((issue) => issue.path.startsWith("drafts.1.")));
    return true;
  });
});

// 以下三条是移植时新增的：签名适配是这次替换里最容易接错的一处，必须被钉住。

function pngBytes(width, height) {
  const header = Buffer.alloc(8);
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]).copy(header);
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6;
  const ihdrLength = Buffer.alloc(4);
  ihdrLength.writeUInt32BE(13, 0);
  const crc = Buffer.alloc(4);
  const idatBody = deflateSync(Buffer.alloc(width * 4 + 1));
  const idatLength = Buffer.alloc(4);
  idatLength.writeUInt32BE(idatBody.length, 0);
  return Buffer.concat([
    header,
    ihdrLength, Buffer.from("IHDR", "ascii"), ihdrData, crc,
    idatLength, Buffer.from("IDAT", "ascii"), idatBody, crc,
    Buffer.alloc(4), Buffer.from("IEND", "ascii"), crc,
  ]);
}

function stubFetch(bytes) {
  return async () => ({
    status: 200,
    ok: true,
    headers: { get: (name) => (name.toLowerCase() === "content-type" ? "image/png" : null) },
    async arrayBuffer() { return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength); },
  });
}

test("注入的适配器是单数版且以裸字符串收 URL、回 {url,width,height,bytes,format}", async () => {
  // 字面 IPv4 主机绕过 DNS 解析，整条用例不触网。
  const url = "https://93.184.216.34/probe.png";
  const bytes = pngBytes(1200, 1200);
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubFetch(bytes);
  try {
    const verified = await verifyRemoteImageByUrl(url);
    assert.equal(verified.url, url);
    assert.equal(verified.width, 1200);
    assert.equal(verified.height, 1200);
    assert.equal(verified.bytes, bytes.byteLength);
    assert.equal(verified.format, "png");
    // 调用方只读这 5 个键；复数版返回的是 { results, dimensions, issues, … } keyed map，形状不兼容。
    for (const key of ["url", "width", "height", "bytes", "format"]) {
      assert.ok(Object.hasOwn(verified, key), `适配器返回值缺少 ${key}`);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }

  const source = await readFile(new URL("../lib/temu-server/public-image-verifier.mjs", import.meta.url), "utf8");
  // 注释里刻意写明了复数版为何不能用，所以形状断言只看代码行。
  const code = source.split(/\r?\n/u).filter((line) => !line.trimStart().startsWith("//")).join("\n");
  assert.match(code, /import \{ verifyCreationTemuRemoteImage \} from "\.\.\/creation-temu-remote-images\.mjs"/u);
  assert.doesNotMatch(code, /verifyCreationTemuRemoteImages/u, "复数版形状不兼容，不得被引入这条路径");
  assert.doesNotMatch(code, /url-verifier|verifyRemoteImage\b/u, "已删除的 sharp 校验器不得被引用");
  assert.match(source, /verifyCreationTemuRemoteImage\(\{ url \}\)/u, "适配器必须把裸字符串包成选项对象");
});

test("适配器不传 role，正方校验只来自调用方自己那处检查", async () => {
  // assertSquareDimensions 只对 sku/material 角色触发；适配器用默认 role "product"，
  // 所以 900×800 这种非正方图不会在适配器里抛错——它必须由调用方的 sku 分支拦下。
  const url = "https://93.184.216.34/oblong.png";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = stubFetch(pngBytes(900, 800));
  try {
    const verified = await verifyRemoteImageByUrl(url);
    assert.equal(verified.width, 900);
    assert.equal(verified.height, 800);
  } finally {
    globalThis.fetch = originalFetch;
  }

  const draft = createValidDraft();
  const entries = draftImageEntries(draft);
  assert.deepEqual(
    [...new Set(entries.map((entry) => entry.role))].sort(),
    ["carousel", "sku"],
  );
  // 同一张非正方图：carousel 角色放行，sku 角色由调用方判定为不合格。
  const carouselOnly = createValidDraft();
  carouselOnly.skus = carouselOnly.skus.map((sku) => ({
    ...sku,
    image: { ...sku.image, url: "https://res.cloudinary.com/demo/image/upload/square.jpg" },
  }));
  const result = await verifyDraftPublicImages(carouselOnly, {
    verifyImage: async (url) => (url.endsWith("square.jpg")
      ? { url, width: 1200, height: 1200, bytes: 10, format: "png" }
      : { url, width: 900, height: 800, bytes: 10, format: "png" }),
  });
  assert.equal(result.draft.assets.carousel[0].width, 900);
  assert.equal(result.draft.assets.carousel[0].status, "verified");

  await assert.rejects(() => verifyDraftPublicImages(createValidDraft(), {
    verifyImage: async (url) => ({ url, width: 900, height: 800, bytes: 10, format: "png" }),
  }), (error) => {
    assert.ok(error.issues.every((issue) => issue.code === "sku_image_dimensions"));
    assert.ok(error.issues.every((issue) => issue.path.startsWith("skus.")));
    return true;
  });
});

test("图片字段仅接受 HTTPS，且最终地址也必须仍是 HTTPS", async () => {
  // 明确接受的能力损失：被删掉的 url-verifier 曾容忍 http 并只加警告，这条路径一律拒绝。
  const httpDraft = createValidDraft();
  httpDraft.assets.carousel[0].url = "http://res.cloudinary.com/demo/image/upload/sample.jpg";
  await assert.rejects(() => verifyDraftPublicImages(httpDraft, {
    verifyImage: async (url) => ({ url, width: 1200, height: 1200, bytes: 10, format: "png" }),
  }), (error) => {
    const issue = error.issues.find((entry) => entry.path === "assets.carousel.0");
    assert.equal(issue.code, "https_required");
    assert.equal(error.issues.some((entry) => entry.code === "public_image_unreachable"), false,
      "http 图片必须在发起校验之前就被拒，而不是等到验证阶段");
    return true;
  });

  // 重定向落到 http 的情形：入口 URL 合格，但校验器回报的最终地址不是 HTTPS。
  await assert.rejects(() => verifyDraftPublicImages(createValidDraft(), {
    verifyImage: async () => ({ url: "http://cdn.example.com/final.jpg", width: 1200, height: 1200, bytes: 10, format: "png" }),
  }), (error) => {
    assert.ok(error.issues.every((entry) => entry.code === "public_image_unreachable"));
    assert.ok(error.issues.every((entry) => /最终图片地址不是 HTTPS/u.test(entry.message)));
    return true;
  });
});

test("本地来源与待上传图片一律不被受理", async () => {
  // 两个校验开关必须同时成立：只翻其中一个，下面这份草稿仍会被拒，所以要一起钉。
  const source = await readFile(new URL("../lib/temu-server/public-image-verifier.mjs", import.meta.url), "utf8");
  assert.doesNotMatch(source, /allowLocalSources/u, "公网图片校验器不看本地来源，只认已存在的公网 URL");

  const draft = createValidDraft();
  draft.settings = { cloudName: "demo-cloud", uploadPreset: "temu_unsigned" };
  draft.assets.carousel[0] = {
    ...draft.assets.carousel[0],
    url: "",
    localPreview: "blob:http://127.0.0.1:8787/abc",
    status: "local",
  };
  await assert.rejects(() => verifyDraftPublicImages(draft, {
    verifyImage: async (url) => ({ url, width: 1200, height: 1200, bytes: 10, format: "png" }),
  }), (error) => {
    assert.equal(error.code, "PUBLIC_IMAGE_URL_ERROR");
    const issue = error.issues.find((entry) => entry.path === "assets.carousel.0");
    assert.equal(issue.code, "public_image_url_required");
    return true;
  });
});

test("全仓不得解析出 sharp 或 @oai/artifact-tool", async () => {
  for (const specifier of ["sharp", "@oai/artifact-tool"]) {
    await assert.rejects(
      () => import(specifier),
      (error) => error?.code === "ERR_MODULE_NOT_FOUND",
      `${specifier} 必须无法解析`,
    );
  }
});
