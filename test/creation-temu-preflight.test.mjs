import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreationTemuPreflightSummary,
  isCreationTemuStrictBlockingIssue,
} from "../lib/creation-temu-preflight.mjs";

function row({ setId, skuId, productName, cells, dataRow }) {
  return {
    setId,
    skuId,
    skuName: skuId,
    productName,
    rowKey: `${setId}:${skuId}`,
    dataRow,
    cells: {
      "*产品标题": productName,
      "*英文标题": `${productName} EN`,
      "*变种属性名称一": "颜色",
      "*变种属性值一": skuId,
      "*申报价格\n(店铺币种)": 12.5,
      "*长（cm）": 10,
      "*宽（cm）": 8,
      "*高（cm）": 4,
      "*重量（g）": 100,
      "预览图": `https://images.example.test/${skuId}.png`,
      "*轮播图": `https://images.example.test/${setId}-hero.png`,
      "*产品素材图": `https://images.example.test/${setId}-material.png`,
      ...cells,
    },
  };
}

function requirement(setId, itemKey, relativePath = "") {
  return {
    setId,
    itemKey,
    item: {
      itemId: itemKey,
      relativePath,
    },
  };
}

function remoteResult(url, width = 1200, height = 1200) {
  return { url, width, height, format: "png", source: "remote-verified" };
}

test("preflight summary reports stable batch and per-record counts without exposing template internals", () => {
  const rows = [
    row({ setId: "set-a", skuId: "red", productName: "商品 A", dataRow: 2 }),
    row({ setId: "set-a", skuId: "blue", productName: "商品 A", dataRow: 3 }),
    row({ setId: "set-b", skuId: "green", productName: "商品 B", dataRow: 4 }),
  ];
  const imageRequirements = [
    requirement("set-a", "a-hero"),
    requirement("set-a", "a-red", "sets/a/red.png"),
    requirement("set-a", "a-blue", "sets/a/blue.png"),
    requirement("set-b", "b-hero", "sets/b/hero.png"),
    requirement("set-b", "b-green"),
  ];
  const imageResolution = {
    results: new Map([
      ["a-hero", { url: rows[0].cells["*轮播图"], source: "saved-public-url" }],
      ["a-red", { url: rows[0].cells["预览图"], source: "cloudinary-upload" }],
      ["a-blue", { url: rows[1].cells["预览图"], source: "cloudinary-cache" }],
      ["b-hero", { url: rows[2].cells["*轮播图"], source: "cloudinary-upload" }],
      ["b-green", { url: rows[2].cells["预览图"], source: "saved-public-url" }],
    ]),
  };
  const finalUrls = new Set(rows.flatMap((entry) => [
    entry.cells["预览图"],
    ...entry.cells["*轮播图"].split("\n"),
    entry.cells["*产品素材图"],
  ]));
  const remoteVerification = {
    valid: true,
    results: new Map([...finalUrls].map((url) => [url, remoteResult(url)])),
    issues: [],
  };

  const summary = buildCreationTemuPreflightSummary({
    template: {
      name: "Temu 标准模板",
      version: "2026.08",
      sheetName: "商品导入",
      path: "C:\\private\\templates\\temu.xlsx",
    },
    finalizedPlan: {
      rows,
      imageRequirements,
      issues: [{
        severity: "信息",
        code: "USER_DEFAULT_APPLIED",
        setId: "set-a",
        skuId: "red",
        dataRow: 2,
        field: "库存",
        message: "库存使用了批次默认值。",
      }],
    },
    imageResolution,
    remoteVerification,
    sets: [
      { setId: "set-a", productName: "商品 A", updatedAt: "2026-08-05T08:00:00.000Z" },
      { setId: "set-b", productName: "商品 B", updatedAt: "2026-08-05T08:01:00.000Z" },
    ],
  });

  assert.deepEqual(summary.template, {
    name: "Temu 标准模板",
    version: "2026.08",
    sheetName: "商品导入",
  });
  assert.deepEqual(summary.stats, {
    templateCount: 1,
    setCount: 2,
    skuCount: 3,
    imageCount: 5,
    pendingUploadCount: 0,
    uploadedCount: 2,
    cacheReuseCount: 1,
    blockerCount: 0,
    warningCount: 1,
  });
  assert.equal(summary.strictReady, true);
  assert.equal(summary.blockers.length, 0);
  assert.equal(summary.warnings[0].code, "USER_DEFAULT_APPLIED");
  assert.deepEqual(summary.records.map((entry) => ({
    setId: entry.setId,
    skuCount: entry.skuCount,
    imageCount: entry.imageCount,
    uploadedCount: entry.uploadedCount,
    cacheReuseCount: entry.cacheReuseCount,
    blockerCount: entry.blockerCount,
    warningCount: entry.warningCount,
  })), [
    { setId: "set-a", skuCount: 2, imageCount: 3, uploadedCount: 1, cacheReuseCount: 1, blockerCount: 0, warningCount: 1 },
    { setId: "set-b", skuCount: 1, imageCount: 2, uploadedCount: 1, cacheReuseCount: 0, blockerCount: 0, warningCount: 0 },
  ]);
  assert.equal(summary.records[0].sourceUpdatedAt, "2026-08-05T08:00:00.000Z");
  assert.doesNotMatch(JSON.stringify(summary), /private|temu\.xlsx/iu);
});

test("strict preflight blocks required data, final images, remote errors, and noncompliant SKU or material squares", () => {
  const failed = row({
    setId: "set-failed",
    skuId: "sku-small",
    productName: "待修复商品",
    dataRow: 2,
    cells: {
      "*申报价格\n(店铺币种)": null,
      "预览图": "",
      "*轮播图": "https://images.example.test/unreachable.png",
      "*产品素材图": "https://images.example.test/material-small.png",
    },
  });
  const skuBad = row({
    setId: "set-failed",
    skuId: "sku-not-square",
    productName: "待修复商品",
    dataRow: 3,
    cells: {
      "预览图": "https://images.example.test/sku-not-square.png",
      "*轮播图": "https://images.example.test/ok.png",
      "*产品素材图": "https://images.example.test/material-small.png",
    },
  });
  const remoteVerification = {
    valid: false,
    results: new Map([
      [skuBad.cells["预览图"], remoteResult(skuBad.cells["预览图"], 1200, 1000)],
      [skuBad.cells["*轮播图"], remoteResult(skuBad.cells["*轮播图"], 1400, 900)],
      [failed.cells["*产品素材图"], remoteResult(failed.cells["*产品素材图"], 800, 800)],
    ]),
    issues: [{
      severity: "error",
      code: "REMOTE_IMAGE_HTTP_ERROR",
      key: failed.cells["*轮播图"],
      role: "carousel",
      message: "远程图片服务器返回 HTTP 403。",
      suggestion: "更换稳定的公网图片地址。",
    }],
  };

  const summary = buildCreationTemuPreflightSummary({
    template: { name: "Temu 标准模板", version: "2026.08" },
    finalizedPlan: {
      rows: [failed, skuBad],
      imageRequirements: [requirement("set-failed", "local-pending", "sets/failed/pending.png")],
      issues: [
        {
          severity: "错误",
          code: "MISSING_REQUIRED_FIELD",
          setId: "set-failed",
          skuId: "sku-small",
          dataRow: 2,
          field: "*申报价格\n(店铺币种)",
          message: "申报价格没有已保存事实或用户默认值。",
        },
        {
          severity: "警告",
          code: "MATERIAL_IMAGE_REQUIREMENTS_UNVERIFIED",
          setId: "set-failed",
          skuId: "sku-small",
          dataRow: 2,
          field: "*产品素材图",
          message: "素材图尺寸比例尚未验证。",
        },
      ],
    },
    imageResolution: {
      results: new Map([["local-pending", {
        code: "IMAGE_UPLOAD_FAILED",
        message: "上传失败。",
      }]]),
    },
    remoteVerification,
    sets: [{ setId: "set-failed", productName: "待修复商品" }],
  });

  assert.equal(summary.strictReady, false);
  assert.equal(summary.stats.pendingUploadCount, 1);
  assert.deepEqual(new Set(summary.blockers.map(({ code }) => code)), new Set([
    "MISSING_REQUIRED_FIELD",
    "MISSING_FINAL_IMAGE",
    "REMOTE_IMAGE_HTTP_ERROR",
    "SKU_IMAGE_DIMENSIONS_INVALID",
    "MATERIAL_IMAGE_DIMENSIONS_INVALID",
  ]));
  assert.equal(summary.blockers.some(({ code }) => code === "MATERIAL_IMAGE_REQUIREMENTS_UNVERIFIED"), false);
  assert.deepEqual(summary.warnings.map(({ code }) => code), ["MATERIAL_IMAGE_REQUIREMENTS_UNVERIFIED"]);
  assert.equal(summary.records[0].blockerCount, 6);
  assert.equal(summary.records[0].warningCount, 1);
  assert.equal(summary.blockers.find(({ code }) => code === "SKU_IMAGE_DIMENSIONS_INVALID").width, 1200);
  assert.equal(summary.blockers.find(({ code }) => code === "SKU_IMAGE_DIMENSIONS_INVALID").height, 1000);
  assert.equal(summary.blockers.find(({ code }) => code === "MATERIAL_IMAGE_DIMENSIONS_INVALID").width, 800);
  assert.equal(isCreationTemuStrictBlockingIssue({ severity: "错误", code: "ANY_ERROR" }), true);
  assert.equal(isCreationTemuStrictBlockingIssue({ severity: "warning", code: "REMOTE_IMAGE_HTTP_ERROR" }), true);
  assert.equal(isCreationTemuStrictBlockingIssue({ severity: "警告", code: "MATERIAL_IMAGE_REQUIREMENTS_UNVERIFIED" }), false);
  assert.equal(isCreationTemuStrictBlockingIssue({ severity: "信息", code: "USER_DEFAULT_APPLIED" }), false);
});

test("preflight output removes absolute paths, credentials, tokens, presets, and upstream payloads", () => {
  const unsafeRow = row({
    setId: "set-secret",
    skuId: "secret-sku",
    productName: "商品 C:\\Users\\owner\\private.txt",
    dataRow: 2,
  });
  const summary = buildCreationTemuPreflightSummary({
    template: {
      name: "Temu 模板",
      version: "1",
      uploadPreset: "private-preset",
      apiSecret: "top-secret",
      rawResponse: { authorization: "Bearer upstream-token" },
    },
    finalizedPlan: {
      rows: [unsafeRow],
      imageRequirements: [],
      issues: [{
        severity: "错误",
        code: "IMAGE_UPLOAD_FAILED",
        setId: "set-secret",
        skuId: "secret-sku",
        dataRow: 2,
        field: "*轮播图",
        source: "C:\\Users\\owner\\output\\hero.png",
        message: "apiSecret=top-secret uploadPreset=private-preset /home/owner/private/hero.png",
        suggestion: "访问 https://user:password@example.test/image.png?token=upstream-token 后重试",
      }],
    },
    imageResolution: { results: new Map() },
    remoteVerification: {
      valid: false,
      results: new Map(),
      issues: [{
        severity: "error",
        code: "REMOTE_IMAGE_FETCH_FAILED",
        key: "https://user:password@example.test/image.png?token=upstream-token",
        path: "C:\\Users\\owner\\output\\hero.png",
        message: "Authorization: Bearer upstream-token; Cookie=session-secret",
      }],
    },
    sets: [{
      setId: "set-secret",
      productName: "商品 C:\\Users\\owner\\private.txt",
      updatedAt: "not-a-date C:\\private\\stamp",
    }],
  });
  const serialized = JSON.stringify(summary);

  assert.doesNotMatch(serialized, /top-secret|private-preset|upstream-token|session-secret|password|Bearer/iu);
  assert.doesNotMatch(serialized, /[A-Z]:\\\\|\/home\/owner|rawResponse|apiSecret|uploadPreset/iu);
  assert.match(serialized, /\[已隐藏/u);
  assert.ok(summary.blockers.every(({ code }) => /^[A-Z][A-Z0-9_]{1,63}$/u.test(code)));
});
