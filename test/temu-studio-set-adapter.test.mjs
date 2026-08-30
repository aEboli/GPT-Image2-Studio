import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { createStudioAsset } from "../lib/temu/studio-import.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "../lib/temu/template-headers.mjs";
import {
  TEMU_STUDIO_SET_LIMIT,
  buildStudioSetIndex,
  cleanStudioId,
  extractStudioLogisticsEstimate,
  findStudioImageTarget,
  normalizeStudioOutputPath,
  parseStudioDimensions,
  parseStudioImageSize,
  parseStudioWeight,
  stripStudioImageSuffix,
  summarizeStudioSet,
} from "../lib/temu-server/studio-set-adapter.mjs";

const ADAPTER_PATH = fileURLToPath(new URL("../lib/temu-server/studio-set-adapter.mjs", import.meta.url));

// 以下两份 fixture 是真实 manifest 的逐字节摘抄（只裁掉适配器不读的字段），
// 来源 C:/Users/Administrator/Pictures/json/creation-sets 下的
// creation-set-1c2d696b… 与 creation-set-02193b07…。抄进仓库而不是读仓库外
// 绝对路径，测试才能长期稳定。两份的 itemId 都被原 ID 白名单
// /^[A-Za-z0-9:_.-]{1,200}$/ 拒绝，且都是 status:"completed"——这是回归用例
// 唯一有效的取材条件（见「非 completed 项不能当作 fixture」一例）。
//
// 两份还各自覆盖了不同的匹配层：
// - REAL_SET_KHAKI 的 referenceImageNames 带 "-reference.jpg" 后缀，与主体
//   filenames 无交集，因此靠第二层 itemId 后缀匹配命中；
// - REAL_SET_HEATED 的 referenceImageNames 与主体 filenames 逐字相等，
//   因此靠第一层交集匹配命中。
const REAL_SET_KHAKI = {
  setId: "creation-set-1c2d696b-e169-472b-8304-6d6daa22d9a3",
  productName: "电热保暖手套",
  status: "completed",
  platformLabel: "通用电商",
  targetLanguageLabel: "English",
  updatedAt: "2026-08-29T09:20:55.298Z",
  skuSubjects: [
    { id: "SKU-卡其 (1).png", title: "SKU-卡其 (1).png", filenames: ["SKU-卡其 (1).png"] },
    { id: "SKU-卡其 (2).png", title: "SKU-卡其 (2).png", filenames: ["SKU-卡其 (2).png"] },
    { id: "SKU-卡其 (3).png", title: "SKU-卡其 (3).png", filenames: ["SKU-卡其 (3).png"] },
  ],
  listingDrafts: [{
    status: "completed",
    title: "1 Pack Heated Winter Gloves, Five Heat Settings Touch Fingertips for Cold-Weather Riding",
    description: "These heated winter gloves are designed for cold-weather riding, photography, phone operation.",
    packageDimensions: "Estimated: 30 cm x 20 cm x 8 cm (11.81 in x 7.87 in x 3.15 in)",
    packageWeight: "Estimated: 410 g (14.46 oz)",
    zhDisplay: {
      title: "1 Pack 电热保暖手套，五档加热与露指触屏设计，黑色/卡其色可选",
      description: "这款电热保暖手套适合冬季骑行、摄影、通勤、手机操作和其他户外场景。",
    },
  }],
  items: [
    {
      itemId: "universal:generic-hero",
      itemKind: "carousel",
      status: "completed",
      slotIndex: 1,
      filename: "1-1714-首图成交主视觉-9a31.png",
      imageUrl: "/output/2026-08/08-29/2026-08-29-creation/1714-%E7%94%B5%E7%83%AD%E4%BF%9D%E6%9A%96%E6%89%8B%E5%A5%97-8304-6d6/1-1714-%E9%A6%96%E5%9B%BE%E6%88%90%E4%BA%A4%E4%B8%BB%E8%A7%86%E8%A7%89-9a31.png?v=2026-08-29T09%3A14%3A31.726Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["1.jpg"],
    },
    {
      itemId: "universal:target-shopper-resonance",
      itemKind: "carousel",
      status: "completed",
      slotIndex: 2,
      filename: "2-1714-适用多场景图-9a32.png",
      imageUrl: "/output/2026-08/08-29/2026-08-29-creation/1714-%E7%94%B5%E7%83%AD%E4%BF%9D%E6%9A%96%E6%89%8B%E5%A5%97-8304-6d6/2-1714-%E9%80%82%E7%94%A8%E5%A4%9A%E5%9C%BA%E6%99%AF%E5%9B%BE-9a32.png?v=2026-08-29T09%3A14%3A31.726Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["1.jpg", "10.jpg"],
    },
    {
      itemId: "19-sku-SKU-卡其 (1).png",
      itemKind: "sku",
      status: "completed",
      slotIndex: 19,
      filename: "19-1714-sku-1-khaki-a319.png",
      imageUrl: "/output/2026-08/08-29/2026-08-29-creation/1714-%E7%94%B5%E7%83%AD%E4%BF%9D%E6%9A%96%E6%89%8B%E5%A5%97-8304-6d6/19-1714-sku-1-khaki-a319.png?v=2026-08-29T09%3A14%3A31.726Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["SKU-卡其 (1)-reference.jpg"],
    },
    {
      itemId: "20-sku-SKU-卡其 (2).png",
      itemKind: "sku",
      status: "completed",
      slotIndex: 20,
      filename: "20-1714-sku-2-black-a320.png",
      imageUrl: "/output/2026-08/08-29/2026-08-29-creation/1714-%E7%94%B5%E7%83%AD%E4%BF%9D%E6%9A%96%E6%89%8B%E5%A5%97-8304-6d6/20-1714-sku-2-black-a320.png?v=2026-08-29T09%3A14%3A31.726Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["SKU-卡其 (2)-reference.jpg"],
    },
    {
      itemId: "21-sku-SKU-卡其 (3).png",
      itemKind: "sku",
      status: "completed",
      slotIndex: 21,
      filename: "21-1714-sku-3-black-a321.png",
      imageUrl: "/output/2026-08/08-29/2026-08-29-creation/1714-%E7%94%B5%E7%83%AD%E4%BF%9D%E6%9A%96%E6%89%8B%E5%A5%97-8304-6d6/21-1714-sku-3-black-a321.png?v=2026-08-29T09%3A14%3A31.726Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["SKU-卡其 (3)-reference.jpg"],
    },
    {
      itemId: "22-infographic-rebuild-1",
      itemKind: "infographic-rebuild",
      status: "completed",
      slotIndex: 22,
      filename: "22-1714-信息图重构-结构细节-a322.png",
      imageUrl: "/output/2026-08/08-29/2026-08-29-creation/1714-%E7%94%B5%E7%83%AD%E4%BF%9D%E6%9A%96%E6%89%8B%E5%A5%97-8304-6d6/22-1714-%E4%BF%A1%E6%81%AF%E5%9B%BE%E9%87%8D%E6%9E%84-%E7%BB%93%E6%9E%84%E7%BB%86%E8%8A%82-a322.png?v=2026-08-29T09%3A14%3A31.726Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["1.jpg"],
    },
  ],
};

const REAL_SET_HEATED = {
  setId: "creation-set-02193b07-1ed8-42b1-a0e1-2640b205bd1b",
  productName: "rechargeable heated gloves",
  status: "completed",
  platformLabel: "通用电商",
  targetLanguageLabel: "English",
  updatedAt: "2026-08-28T09:45:10.916Z",
  skuSubjects: [
    { id: "s5黑色sku.jpg", title: "s5黑色sku.jpg", filenames: ["s5黑色sku.jpg"] },
    { id: "s5黑色加大码sku.jpg", title: "s5黑色加大码sku.jpg", filenames: ["s5黑色加大码sku.jpg"] },
    { id: "s5卡其色sku.jpg", title: "s5卡其色sku.jpg", filenames: ["s5卡其色sku.jpg"] },
  ],
  listingDrafts: [{
    status: "completed",
    title: "2 Pack Rechargeable Heated Gloves, Five Heat Settings, Built-In Battery for Winter Cycling",
    description: "These rechargeable heated gloves are designed for winter cycling and other cold-weather outdoor use.",
    packageDimensions: "Estimated: 30 x 25 x 10 cm (11.81 x 9.84 x 3.94 in)",
    packageWeight: "Estimated: 680 g (1.5 lb)",
    zhDisplay: {
      title: "2 Pack 可充电发热手套，五档温度选择，内置电池适合冬季骑行",
      description: "这款可充电发热手套适合冬季骑行及其他寒冷户外场景。",
    },
  }],
  items: [
    {
      itemId: "universal:generic-hero",
      itemKind: "carousel",
      status: "completed",
      slotIndex: 1,
      filename: "1-1734-首图成交主视觉-d1b1.png",
      imageUrl: "/output/2026-08/08-28/2026-08-28-creation/1734-rechargeableheatedgloves-a0e1-264/1-1734-%E9%A6%96%E5%9B%BE%E6%88%90%E4%BA%A4%E4%B8%BB%E8%A7%86%E8%A7%89-d1b1.png?v=2026-08-28T09%3A34%3A55.880Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["s5黑色sku.jpg"],
    },
    {
      itemId: "19-sku-s5黑色sku.jpg",
      itemKind: "sku",
      status: "completed",
      slotIndex: 19,
      filename: "19-1734-sku-1-black-1b19.png",
      imageUrl: "/output/2026-08/08-28/2026-08-28-creation/1734-rechargeableheatedgloves-a0e1-264/19-1734-sku-1-black-1b19.png?v=2026-08-28T09%3A34%3A55.880Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["s5黑色sku.jpg"],
    },
    {
      itemId: "20-sku-s5黑色加大码sku.jpg",
      itemKind: "sku",
      status: "completed",
      slotIndex: 20,
      filename: "20-1734-sku-2-1b20.png",
      imageUrl: "/output/2026-08/08-28/2026-08-28-creation/1734-rechargeableheatedgloves-a0e1-264/20-1734-sku-2-1b20.png?v=2026-08-28T09%3A34%3A55.880Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["s5黑色加大码sku.jpg"],
    },
    {
      itemId: "21-sku-s5卡其色sku.jpg",
      itemKind: "sku",
      status: "completed",
      slotIndex: 21,
      filename: "21-1734-sku-3-khaki-beige-1b21.png",
      imageUrl: "/output/2026-08/08-28/2026-08-28-creation/1734-rechargeableheatedgloves-a0e1-264/21-1734-sku-3-khaki-beige-1b21.png?v=2026-08-28T09%3A34%3A55.880Z",
      actualSize: "1254x1254",
      format: "png",
      referenceImageNames: ["s5卡其色sku.jpg"],
    },
  ],
};

// 真实的 status:"failed" 且被原 ID 白名单拒绝的 item，抄自
// creation-set-04f430cc…。全库 28 个这样的 item 全部 imageUrl 与 filename 为空。
const REAL_FAILED_REJECTED_ITEM = {
  itemId: "19-sku-SKU-卡其 (2).png",
  itemKind: "sku",
  status: "failed",
  slotIndex: 19,
  filename: "",
  imageUrl: "",
};

function clone(value) {
  return structuredClone(value);
}

// 用码位构造含控制符或不可见字符的样本，避免把这些字符原样写进源文件
// （原样写入既不可读，也会被仓库的控制符扫描判为异常内容）。
function surround(codePoint) {
  return `a${String.fromCodePoint(codePoint)}b`;
}

test("真实 manifest 里含中文与空格的 itemId 不再被静默丢弃", () => {
  // 回归用例本体。原白名单 /^[A-Za-z0-9:_.-]{1,200}$/ 会让这些 itemId 的
  // cleanId 返回 ""，prepareImageTarget 随之返回 null，于是 skuTargets 为空、
  // 三级匹配全部落空、image 变成 null——SKU 预览图无声消失且不报任何错。
  const khaki = summarizeStudioSet(clone(REAL_SET_KHAKI));
  assert.deepEqual(khaki.skuSubjects.map((subject) => [subject.id, subject.image?.itemId]), [
    ["SKU-卡其 (1).png", "19-sku-SKU-卡其 (1).png"],
    ["SKU-卡其 (2).png", "20-sku-SKU-卡其 (2).png"],
    ["SKU-卡其 (3).png", "21-sku-SKU-卡其 (3).png"],
  ]);
  for (const subject of khaki.skuSubjects) {
    assert.ok(subject.image, `${subject.id} 应当带上预览图`);
  }

  const heated = summarizeStudioSet(clone(REAL_SET_HEATED));
  assert.deepEqual(heated.skuSubjects.map((subject) => [subject.id, subject.image?.itemId]), [
    ["s5黑色sku.jpg", "19-sku-s5黑色sku.jpg"],
    ["s5黑色加大码sku.jpg", "20-sku-s5黑色加大码sku.jpg"],
    ["s5卡其色sku.jpg", "21-sku-s5卡其色sku.jpg"],
  ]);

  // 预览地址必须把中文与空格转义后带上，否则子文档取不到图。
  assert.equal(
    khaki.skuSubjects[0].image.previewUrl,
    `${TEMU_STUDIO_IMAGE_PATH}?setId=creation-set-1c2d696b-e169-472b-8304-6d6daa22d9a3&itemId=${encodeURIComponent("19-sku-SKU-卡其 (1).png")}`,
  );
  // 中文转义成 %E5%8D%A1%E5%85%B6，空格转义成 %20；括号不在
  // encodeURIComponent 的转义集内，原样保留即正确。
  assert.match(khaki.skuSubjects[0].image.previewUrl, /itemId=19-sku-SKU-%E5%8D%A1%E5%85%B6%20\(1\)\.png$/u);
  assert.doesNotMatch(khaki.skuSubjects[0].image.previewUrl, /卡其/u);

  // 三张 SKU 图必须真的进图片索引，否则 /api/temu/studio/image 仍取不到。
  const { imageTargets } = buildStudioSetIndex([clone(REAL_SET_KHAKI)]);
  const targets = imageTargets.get(REAL_SET_KHAKI.setId);
  for (const itemId of ["19-sku-SKU-卡其 (1).png", "20-sku-SKU-卡其 (2).png", "21-sku-SKU-卡其 (3).png"]) {
    assert.ok(targets.has(itemId), `${itemId} 应当在图片索引里`);
  }
});

test("非 completed 项不能当作 ID 白名单的回归 fixture", () => {
  // 这一条钉住判定顺序：prepareImageTarget 先看 status，再 cleanId。
  // 全库 28 个「被原白名单拒绝且 status:'failed'」的 item 因此在放宽前后
  // 都被剔除，用它们写的测试改前改后同样是绿的，只会看起来像覆盖。
  // 实测这 28 个的 imageUrl 与 filename 还全部为空，等于被剔除两次。
  const withFailedItem = clone(REAL_SET_KHAKI);
  withFailedItem.skuSubjects = [{ id: "SKU-卡其 (2).png", title: "SKU-卡其 (2).png", filenames: ["SKU-卡其 (2).png"] }];
  withFailedItem.items = [clone(REAL_FAILED_REJECTED_ITEM)];
  const summary = summarizeStudioSet(withFailedItem);
  assert.deepEqual(summary.carouselImages, []);
  assert.deepEqual(summary.skuSubjects.map((subject) => subject.image), [null]);
  assert.equal(summary.availableImageCount, 0);
  assert.equal(buildStudioSetIndex([withFailedItem]).imageTargets.get(withFailedItem.setId).size, 0);

  // 同一个 itemId 一旦补上 completed 与有效路径就会被收下——证明剔除的原因
  // 是 status 与空路径，而不是这个 ID 本身不受理。
  const repaired = clone(withFailedItem);
  repaired.items[0].status = "completed";
  repaired.items[0].imageUrl = "/output/demo/repaired.png?v=2026-08-29T09%3A14%3A31.726Z";
  repaired.items[0].filename = "repaired.png";
  assert.equal(summarizeStudioSet(repaired).skuSubjects[0].image.itemId, "19-sku-SKU-卡其 (2).png");
  const repairedIndex = buildStudioSetIndex([repaired]);
  assert.ok(repairedIndex.imageTargets.get(repaired.setId).has("19-sku-SKU-卡其 (2).png"));
  assert.equal(
    repairedIndex.imageTargets.get(repaired.setId).get("19-sku-SKU-卡其 (2).png").upstreamPath,
    "/output/demo/repaired.png",
  );
});

test("图片路径剥掉 cache-buster 查询串并保留 /output/ 前缀校验", () => {
  // 实测 62 份真实 manifest 的 531 条 imageUrl 是 531/531 全部带 ?v=<ISO 时间戳>。
  // resolveSafeFile 只做 decodeURIComponent + resolve，不识别查询串，
  // 因此不剥 query 就是百分之百 ENOENT，而不是偶发失败。
  assert.equal(normalizeStudioOutputPath("/output/demo/hero.png?v=2026-08-29T09%3A14%3A31.726Z"), "/output/demo/hero.png");
  assert.equal(normalizeStudioOutputPath("/output/demo/hero.png?v=1#frag"), "/output/demo/hero.png");
  assert.equal(normalizeStudioOutputPath("/output/demo/hero.png"), "/output/demo/hero.png");
  // 百分号编码原样保留：Studio 的 /output/ 分支同样是把编码后的 pathname
  // 切掉前缀再交给 resolveSafeFile 解码，两边必须同形。
  assert.equal(
    normalizeStudioOutputPath("/output/2026-08/1714-%E7%94%B5%E7%83%AD.png?v=1"),
    "/output/2026-08/1714-%E7%94%B5%E7%83%AD.png",
  );

  // 离开 /output/ 前缀的一律剔除。
  assert.equal(normalizeStudioOutputPath("/output/../server.mjs"), "");
  assert.equal(normalizeStudioOutputPath("/output/../../etc/passwd"), "");
  assert.equal(normalizeStudioOutputPath("/lib/local-server-auth.mjs"), "");
  assert.equal(normalizeStudioOutputPath("/outputs/demo.png"), "");
  assert.equal(normalizeStudioOutputPath("https://example.com/output/demo.png"), "");
  assert.equal(normalizeStudioOutputPath(""), "");
  assert.equal(normalizeStudioOutputPath(null), "");

  // 真实 fixture 走完整路径后同样不得留下查询串。
  const { imageTargets } = buildStudioSetIndex([clone(REAL_SET_KHAKI), clone(REAL_SET_HEATED)]);
  const paths = [...imageTargets.values()].flatMap((targets) => [...targets.values()].map((target) => target.upstreamPath));
  // KHAKI 6 张（2 轮播 + 1 信息图重构 + 3 张已认领的 SKU）加 HEATED 4 张。
  assert.equal(paths.length, 10);
  for (const path of paths) {
    assert.ok(path.startsWith("/output/"), `${path} 应当位于 /output/ 之下`);
    assert.doesNotMatch(path, /[?#]/u, `${path} 不应残留查询串或片段`);
  }
});

test("imageUrl 离开 /output/ 前缀的项被剔除，thumbnailUrl 可兜底", () => {
  const fixture = clone(REAL_SET_KHAKI);
  fixture.skuSubjects = [];
  fixture.items = [
    { itemId: "external", itemKind: "carousel", status: "completed", filename: "a.png", imageUrl: "https://example.com/a.png", slotIndex: 1 },
    { itemId: "escaped", itemKind: "carousel", status: "completed", filename: "b.png", imageUrl: "/output/../server.mjs", slotIndex: 2 },
    { itemId: "sibling", itemKind: "carousel", status: "completed", filename: "c.png", imageUrl: "/lib/local-server-auth.mjs", slotIndex: 3 },
    { itemId: "kept", itemKind: "carousel", status: "completed", filename: "d.png", imageUrl: "/output/demo/d.png?v=1", slotIndex: 4 },
    // imageUrl 缺失时回落到 thumbnailUrl，与被吸收侧一致。
    { itemId: "thumb-only", itemKind: "carousel", status: "completed", filename: "e.png", thumbnailUrl: "/output/demo/e.png?v=1", slotIndex: 5 },
  ];
  const summary = summarizeStudioSet(fixture);
  assert.deepEqual(summary.carouselImages.map((image) => image.itemId), ["kept", "thumb-only"]);
  assert.doesNotMatch(JSON.stringify(summary), /example\.com|server\.mjs|local-server-auth/u);
});

test("非 completed 项与不可见 itemKind 都不进摘要", () => {
  const fixture = clone(REAL_SET_KHAKI);
  fixture.skuSubjects = [];
  fixture.items = [
    { itemId: "done", itemKind: "carousel", status: "completed", filename: "a.png", imageUrl: "/output/demo/a.png?v=1", slotIndex: 1 },
    { itemId: "queued", itemKind: "carousel", status: "queued", filename: "b.png", imageUrl: "/output/demo/b.png?v=1", slotIndex: 2 },
    { itemId: "generating", itemKind: "carousel", status: "generating", filename: "c.png", imageUrl: "/output/demo/c.png?v=1", slotIndex: 3 },
    { itemId: "failed", itemKind: "carousel", status: "failed", filename: "d.png", imageUrl: "/output/demo/d.png?v=1", slotIndex: 4 },
    { itemId: "rebuild", itemKind: "infographic-rebuild", status: "completed", filename: "e.png", imageUrl: "/output/demo/e.png?v=1", slotIndex: 5 },
    // 可见集合只有 carousel / infographic-rebuild / sku 三种。
    { itemId: "detail", itemKind: "detail", status: "completed", filename: "f.png", imageUrl: "/output/demo/f.png?v=1", slotIndex: 6 },
  ];
  const summary = summarizeStudioSet(fixture);
  assert.deepEqual(summary.carouselImages.map((image) => image.itemId), ["done", "rebuild"]);
  assert.equal(summary.availableImageCount, 2);
  // 被剔除的项也不得进图片索引，否则图片路由仍能代理它们。
  const targets = buildStudioSetIndex([fixture]).imageTargets.get(fixture.setId);
  assert.deepEqual([...targets.keys()], ["done", "rebuild"]);
});

test("按 setId 去重并保留 updatedAt 最新的那份", () => {
  const older = clone(REAL_SET_KHAKI);
  older.productName = "旧版电热保暖手套";
  older.updatedAt = "2026-07-30T10:00:00.000Z";
  const newer = clone(REAL_SET_KHAKI);
  newer.productName = "新版电热保暖手套";
  newer.updatedAt = "2026-08-01T10:00:00.000Z";

  for (const manifests of [[older, newer], [newer, older]]) {
    const { sets } = buildStudioSetIndex(manifests);
    assert.equal(sets.length, 1);
    assert.equal(sets[0].productName, "新版电热保暖手套");
    assert.equal(sets[0].updatedAt, "2026-08-01T10:00:00.000Z");
  }

  // 不同 setId 按 updatedAt 倒序排列。HEATED 的 2026-08-28 比这里两份
  // KHAKI（2026-07-30 / 2026-08-01）都新，因此排在前面。
  const { sets } = buildStudioSetIndex([newer, clone(REAL_SET_HEATED), older]);
  assert.deepEqual(sets.map((set) => set.setId), [REAL_SET_HEATED.setId, REAL_SET_KHAKI.setId]);

  // 缺 updatedAt 的记录沉到最后，不会因为 Date.parse(0) 解析成 2000 年而抢先。
  const undated = clone(REAL_SET_HEATED);
  undated.setId = "creation-set-undated";
  undated.updatedAt = "";
  undated.createdAt = "";
  const ordered = buildStudioSetIndex([undated, clone(REAL_SET_HEATED)]).sets;
  assert.deepEqual(ordered.map((set) => set.setId), [REAL_SET_HEATED.setId, "creation-set-undated"]);
});

test("套图记录数受 50 条上限约束，先去重再截断", () => {
  assert.equal(TEMU_STUDIO_SET_LIMIT, 50);

  // 序号越大越新，因此 60 份里保留的应当是最新的 50 份（059..010）。
  const manifests = Array.from({ length: 60 }, (_, index) => {
    const set = clone(REAL_SET_HEATED);
    set.setId = `creation-set-${String(index).padStart(3, "0")}`;
    set.updatedAt = new Date(Date.UTC(2026, 7, 1, 0, index)).toISOString();
    return set;
  });

  const { sets, imageTargets } = buildStudioSetIndex(manifests);
  assert.equal(sets.length, TEMU_STUDIO_SET_LIMIT);
  assert.equal(imageTargets.size, TEMU_STUDIO_SET_LIMIT);
  assert.equal(sets[0].setId, "creation-set-059");
  assert.equal(sets.at(-1).setId, "creation-set-010");

  // 去重必须先于截断。输入 60 份：49 份互不相同（000..048）加 11 份同一个
  // 更新时间最新的重复记录。去重在先则输出恰好 50 条（49 + 1，正好触到上限）；
  // 若先截断到 50 条再去重，11 份重复会占掉 11 个名额，只剩 40 条。
  const newestDuplicate = clone(REAL_SET_HEATED);
  newestDuplicate.updatedAt = new Date(Date.UTC(2026, 7, 1, 0, 59)).toISOString();
  const withDuplicates = [
    ...manifests.slice(0, 49),
    ...Array.from({ length: 11 }, () => clone(newestDuplicate)),
  ];
  const deduped = buildStudioSetIndex(withDuplicates).sets;
  assert.equal(deduped.length, TEMU_STUDIO_SET_LIMIT);
  assert.equal(new Set(deduped.map((set) => set.setId)).size, TEMU_STUDIO_SET_LIMIT);
  assert.equal(deduped[0].setId, REAL_SET_HEATED.setId);

  // limit 可覆盖，用于路由层按需收窄。
  assert.equal(buildStudioSetIndex(manifests, { limit: 3 }).sets.length, 3);
  assert.equal(buildStudioSetIndex(manifests, { limit: 0 }).sets.length, 0);
  assert.equal(buildStudioSetIndex(manifests, { limit: "not-a-number" }).sets.length, TEMU_STUDIO_SET_LIMIT);
  assert.deepEqual(buildStudioSetIndex(null).sets, []);
  assert.deepEqual(buildStudioSetIndex([null, 42, "x", {}]).sets, []);
});

test("SKU 主体到图片的三级匹配，每个目标最多被认领一次", () => {
  // fixture 刻意让三层各自给出**不同**的答案。否则位置兜底会与前两层撞出
  // 同一个目标，删掉任意一层测试都还是绿的（真实 manifest 恰好就是这种
  // 主体与 SKU 目标同序的形态，单靠它证明不了第二层在起作用）。
  const fixture = clone(REAL_SET_KHAKI);
  fixture.skuSubjects = [
    // 甲：第一层（filenames 与 referenceImageNames 有交集）→ 3-sku-anchor。
    // 位置兜底会给 1-sku-subject-b，因此这一格独证第一层。
    { id: "subject-a", title: "甲款", filenames: ["ref-a.jpg"] },
    // 乙：第一层无交集，第二层（itemId 以 `-subject-b` 结尾）→ 1-sku-subject-b。
    // 位置兜底会给 2-sku-other，因此这一格独证第二层。
    { id: "subject-b", title: "乙款", filenames: ["无人认领.jpg"] },
    // 丙：与甲同 id，但甲已认领 3-sku-anchor；第二层无匹配，位置兜底
    // （index 2 → 3-sku-anchor）也已被认领，因此拿不到图而不是复用同一张。
    { id: "subject-a", title: "丙款", filenames: ["ref-a.jpg"] },
    // 丁：前两层都不匹配，位置兜底（index 3 → 4-sku-spare）尚未被认领 → 命中。
    // 这一格独证第三层。
    { id: "subject-unmatched", title: "丁款", filenames: [] },
  ];
  fixture.items = [
    { itemId: "1-sku-subject-b", itemKind: "sku", status: "completed", filename: "s1.png", imageUrl: "/output/demo/s1.png?v=1", slotIndex: 1, referenceImageNames: [] },
    { itemId: "2-sku-other", itemKind: "sku", status: "completed", filename: "s2.png", imageUrl: "/output/demo/s2.png?v=1", slotIndex: 2, referenceImageNames: ["ref-z.jpg"] },
    { itemId: "3-sku-anchor", itemKind: "sku", status: "completed", filename: "s3.png", imageUrl: "/output/demo/s3.png?v=1", slotIndex: 3, referenceImageNames: ["ref-a.jpg"] },
    { itemId: "4-sku-spare", itemKind: "sku", status: "completed", filename: "s4.png", imageUrl: "/output/demo/s4.png?v=1", slotIndex: 4, referenceImageNames: [] },
  ];

  const summary = summarizeStudioSet(fixture);
  assert.deepEqual(summary.skuSubjects.map((subject) => [subject.title, subject.image?.itemId]), [
    ["甲款", "3-sku-anchor"],
    ["乙款", "1-sku-subject-b"],
    ["丙款", undefined],
    ["丁款", "4-sku-spare"],
  ]);
  assert.equal(summary.skuSubjects[2].image, null);
  // 位置兜底是严格按下标取，不是「取下一个空闲目标」：2-sku-other 从头到尾
  // 无人认领，丙款也不会顺势拿到它。
  assert.ok(!summary.skuSubjects.some((subject) => subject.image?.itemId === "2-sku-other"));

  // 每个目标只被一个主体认领：图片 itemId 不得重复。
  const claimed = summary.skuSubjects.map((subject) => subject.image?.itemId).filter(Boolean);
  assert.equal(new Set(claimed).size, claimed.length);
  // availableImageCount 只数真的拿到图的主体（甲、乙、丁三格，无轮播图）。
  assert.equal(summary.availableImageCount, 3);
  // 只有被认领的 SKU 目标进图片索引，未被认领的 2-sku-other 不进。
  const targets = buildStudioSetIndex([fixture]).imageTargets.get(fixture.setId);
  assert.deepEqual([...targets.keys()].sort(), ["1-sku-subject-b", "3-sku-anchor", "4-sku-spare"]);
  // 未被任何主体认领的 SKU 目标不进图片索引。
  const orphan = clone(fixture);
  orphan.skuSubjects = [];
  assert.equal(buildStudioSetIndex([orphan]).imageTargets.get(orphan.setId).size, 0);
});

test("没有 SKU 主体时不按孤立图片虚构默认 SKU", () => {
  const fixture = clone(REAL_SET_HEATED);
  fixture.skuSubjects = [];
  const summary = summarizeStudioSet(fixture);
  assert.deepEqual(summary.skuSubjects, []);
  assert.deepEqual(summary.carouselImages.map((image) => image.itemId), ["universal:generic-hero"]);
  assert.equal(summary.availableImageCount, 1);
});

test("可见图片的 itemId 重复时整条记录被剔除", () => {
  // itemId 是预览接口的唯一寻址键，重复即无法确定代理哪一张。
  const fixture = clone(REAL_SET_KHAKI);
  fixture.skuSubjects = [];
  fixture.items = [
    { itemId: "same-id.jpeg", itemKind: "carousel", status: "completed", filename: "visible.png", imageUrl: "/output/demo/visible.png?v=1", slotIndex: 1 },
    { itemId: "same-id.jpeg", itemKind: "sku", status: "completed", filename: "duplicate.png", imageUrl: "/output/demo/duplicate.png?v=1", slotIndex: 2 },
  ];
  assert.equal(summarizeStudioSet(fixture), null);
  assert.deepEqual(buildStudioSetIndex([fixture]).sets, []);

  // 不可见 itemKind 与可见项同 ID 时不算冲突，也不得覆盖可见项。
  const hidden = clone(fixture);
  hidden.items[1].itemKind = "detail";
  const summary = summarizeStudioSet(hidden);
  assert.equal(summary.carouselImages.length, 1);
  assert.equal(summary.carouselImages[0].name, "visible.png");
  assert.equal(
    buildStudioSetIndex([hidden]).imageTargets.get(hidden.setId).get("same-id.jpeg").upstreamPath,
    "/output/demo/visible.png",
  );
});

test("setId 无效的记录被整体剔除", () => {
  for (const setId of ["", "  ", null, "a/b", "a".repeat(201)]) {
    const fixture = clone(REAL_SET_HEATED);
    fixture.setId = setId;
    delete fixture.id;
    assert.equal(summarizeStudioSet(fixture), null, `setId=${JSON.stringify(setId)} 应被剔除`);
  }
  // setId 缺失时回落到 id。
  const withId = clone(REAL_SET_HEATED);
  delete withId.setId;
  withId.id = "creation-set-from-id";
  assert.equal(summarizeStudioSet(withId).setId, "creation-set-from-id");
});

test("放宽后的 ID 仍拒绝路径分隔符、控制符与超长输入", () => {
  // 放宽的是「哪些字符算合法名字」，不是「不再校验」。itemId 只作查询参数
  // 与 Map 键，从不参与文件路径拼接，因此真正要挡的是分隔符与不可见字符。
  for (const accepted of [
    "19-sku-s5黑色sku.jpg",
    "SKU-卡其 (1).png",
    "19-sku-SKU-卡其 (1).png",
    "universal:generic-hero",
    "creation-set-1c2d696b-e169-472b-8304-6d6daa22d9a3",
    "a".repeat(200),
  ]) {
    assert.equal(cleanStudioId(accepted), accepted, `${accepted} 应当受理`);
  }

  for (const rejected of [
    "a/b",
    "a\\b",
    "../../etc/passwd",
    "..\\..\\server.mjs",
    surround(0x0000), // NUL
    surround(0x001F), // 单元分隔符
    surround(0x000A), // 换行
    surround(0x2028), // 行分隔符
    surround(0x202E), // 从右向左覆盖
    surround(0xFEFF), // 零宽不换行空格 / BOM
    " leading",
    "trailing ",
    "a".repeat(201),
    "",
    null,
    undefined,
  ]) {
    assert.equal(cleanStudioId(rejected), "", `${JSON.stringify(rejected)} 应当被拒`);
  }

  // 被拒的 ID 会让对应项整体消失，而不是带着半截 ID 进摘要。
  const fixture = clone(REAL_SET_HEATED);
  fixture.skuSubjects = [];
  fixture.items = [
    { itemId: "ok", itemKind: "carousel", status: "completed", filename: "a.png", imageUrl: "/output/demo/a.png?v=1", slotIndex: 1 },
    { itemId: "../escape", itemKind: "carousel", status: "completed", filename: "b.png", imageUrl: "/output/demo/b.png?v=1", slotIndex: 2 },
  ];
  assert.deepEqual(summarizeStudioSet(fixture).carouselImages.map((image) => image.itemId), ["ok"]);
});

test("图片寻址只认索引内的目标，并复核传入的 ID", () => {
  const index = buildStudioSetIndex([clone(REAL_SET_KHAKI), clone(REAL_SET_HEATED)]);

  const target = findStudioImageTarget(index, REAL_SET_KHAKI.setId, "19-sku-SKU-卡其 (1).png");
  assert.equal(target.upstreamPath, "/output/2026-08/08-29/2026-08-29-creation/1714-%E7%94%B5%E7%83%AD%E4%BF%9D%E6%9A%96%E6%89%8B%E5%A5%97-8304-6d6/19-1714-sku-1-khaki-a319.png");
  assert.equal(target.name, "19-1714-sku-1-khaki-a319.png");
  assert.equal(target.width, 1254);
  assert.equal(target.height, 1254);
  assert.equal(target.format, "png");

  // 索引外的组合、跨记录的 itemId、不受理的 ID 一律拿不到目标。
  assert.equal(findStudioImageTarget(index, REAL_SET_KHAKI.setId, "does-not-exist"), null);
  assert.equal(findStudioImageTarget(index, "creation-set-unknown", "19-sku-SKU-卡其 (1).png"), null);
  assert.equal(findStudioImageTarget(index, REAL_SET_HEATED.setId, "19-sku-SKU-卡其 (1).png"), null);
  assert.equal(findStudioImageTarget(index, REAL_SET_KHAKI.setId, "../../server.mjs"), null);
  assert.equal(findStudioImageTarget(index, REAL_SET_KHAKI.setId, ""), null);
  assert.equal(findStudioImageTarget(index, "", "19-sku-SKU-卡其 (1).png"), null);
  assert.equal(findStudioImageTarget(index, null, null), null);
  assert.equal(findStudioImageTarget(null, REAL_SET_KHAKI.setId, "19-sku-SKU-卡其 (1).png"), null);
  assert.equal(findStudioImageTarget({}, REAL_SET_KHAKI.setId, "19-sku-SKU-卡其 (1).png"), null);
});

test("预览地址与浏览器侧 studio-import 的受理契约对齐", () => {
  // 浏览器侧 createStudioAsset 会把 previewUrl 解析一遍，且只受理
  // pathname 恰好等于 TEMU_STUDIO_IMAGE_PATH 的地址；不匹配就把资产标成
  // error。这条断言把两侧的路径常量钉在一起，避免一边改了另一边静默变红叉。
  const summary = summarizeStudioSet(clone(REAL_SET_KHAKI));
  for (const image of [...summary.carouselImages, ...summary.skuSubjects.map((subject) => subject.image)]) {
    assert.ok(image.previewUrl.startsWith(`${TEMU_STUDIO_IMAGE_PATH}?`));
    const asset = createStudioAsset(summary.setId, image);
    assert.equal(asset.status, "local", `${image.itemId} 应当被浏览器侧受理`);
    assert.equal(asset.error, "");
    assert.equal(asset.studioItemId, image.itemId);
    assert.equal(asset.studioSetId, summary.setId);
    assert.equal(asset.studioPreviewUrl, image.previewUrl);
  }

  // 接口路径必须位于 /api/ 之下，否则非 GET 路由会漏出 CSRF 检查范围。
  assert.ok(TEMU_STUDIO_IMAGE_PATH.startsWith("/api/"));
});

test("摘要不泄漏提示词、本地绝对路径与外链", () => {
  const fixture = clone(REAL_SET_KHAKI);
  fixture.prompt = "不得返回给浏览器的完整提示词";
  fixture.absolutePath = "C:\\private\\image.png";
  fixture.items[0].prompt = "逐项提示词也不得外泄";
  fixture.items[0].relativePath = "2026-08/08-29/本地相对路径.png";
  fixture.items.push({
    itemId: "external-image",
    itemKind: "carousel",
    status: "completed",
    filename: "external.png",
    imageUrl: "https://example.com/external.png",
    slotIndex: 99,
  });

  const serialized = JSON.stringify(summarizeStudioSet(fixture));
  assert.doesNotMatch(serialized, /完整提示词|逐项提示词|C:\\\\private|本地相对路径|example\.com/u);
  // 摘要只由白名单字段构成：新增 manifest 字段不会顺带外泄。
  const summary = summarizeStudioSet(fixture);
  assert.deepEqual(Object.keys(summary).sort(), [
    "availableImageCount",
    "carouselImages",
    "listing",
    "logisticsEstimate",
    "platformLabel",
    "productName",
    "setId",
    "skuSubjects",
    "status",
    "targetLanguageLabel",
    "updatedAt",
  ]);
  assert.deepEqual(Object.keys(summary.carouselImages[0]).sort(), [
    "displayName", "format", "height", "itemId", "name", "previewUrl", "width",
  ]);
});

test("传输层已整体删除，模块内无 HTTP、无环境变量、无快照缓存", async () => {
  const module = await import("../lib/temu-server/studio-set-adapter.mjs");
  for (const removed of [
    "normalizeStudioBaseUrl",
    "createStudioBridge",
    "fetchStudio",
    "readLimitedBytes",
    "loadSets",
    "listSets",
    "getImage",
  ]) {
    assert.equal(module[removed], undefined, `${removed} 应当已删除`);
  }

  const source = await readFile(ADAPTER_PATH, "utf8");
  // 注释里会提到这些名字（说明它们为何被删），因此只扫描去掉注释后的代码。
  const code = source
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("//"))
    .join("\n");
  for (const forbidden of [
    "fetch",
    "IMAGE_STUDIO_URL",
    "process.env",
    "STUDIO_UNAVAILABLE",
    "STUDIO_URL_INVALID",
    "STUDIO_IMAGE_NOT_FOUND",
    "AbortSignal",
    "imageSnapshots",
    "node:fs",
    "node:http",
  ]) {
    assert.ok(!code.includes(forbidden), `模块代码不应出现 ${forbidden}`);
  }
  // 127.0.0.1:3600 与 4173 这类回环地址字面量也不得残留。
  assert.doesNotMatch(code, /127\.0\.0\.1|localhost|:3600|4173/u);
});

test("图片尺寸兼容 x 与乘号，展示名去掉连续扩展名但保留原始图片名", () => {
  assert.deepEqual(parseStudioImageSize("1254x1254"), { width: 1254, height: 1254 });
  assert.deepEqual(parseStudioImageSize("1024 × 1536"), { width: 1024, height: 1536 });
  assert.deepEqual(parseStudioImageSize("auto"), { width: null, height: null });
  assert.deepEqual(parseStudioImageSize(undefined), { width: null, height: null });

  assert.equal(stripStudioImageSuffix("3-DM1021057.jpeg.jpeg"), "3-DM1021057");
  assert.equal(stripStudioImageSuffix("SKU-卡其 (1).png"), "SKU-卡其 (1)");
  assert.equal(stripStudioImageSuffix(""), "");

  const fixture = clone(REAL_SET_KHAKI);
  fixture.items[0].filename = "hero.png.jpg";
  const summary = summarizeStudioSet(fixture);
  assert.equal(summary.carouselImages[0].name, "hero.png.jpg");
  assert.equal(summary.carouselImages[0].displayName, "hero");
  // 主体标题同样去掉扩展名，但 id 保持原样以便匹配。
  assert.equal(summary.skuSubjects[0].title, "SKU-卡其 (1)");
  assert.equal(summary.skuSubjects[0].id, "SKU-卡其 (1).png");

  // actualSize 缺失时依次回落 effectiveSize、size。
  const sizes = clone(REAL_SET_KHAKI);
  sizes.skuSubjects = [];
  delete sizes.items[0].actualSize;
  sizes.items[0].effectiveSize = "1024x1024";
  assert.equal(summarizeStudioSet(sizes).carouselImages[0].width, 1024);
  delete sizes.items[0].effectiveSize;
  sizes.items[0].size = "512x512";
  assert.equal(summarizeStudioSet(sizes).carouselImages[0].width, 512);
});

test("物流预估只解析明确的公制尺寸与克单位", () => {
  assert.deepEqual(parseStudioDimensions("Estimated: 20 x 15 x 8 cm (7.9 x 5.9 x 3.1 in)"), { lengthCm: 20, widthCm: 15, heightCm: 8 });
  assert.deepEqual(parseStudioDimensions("预估：20 × 15 × 8 厘米"), { lengthCm: 20, widthCm: 15, heightCm: 8 });
  assert.deepEqual(parseStudioDimensions("Estimated: 20cm x 15cm x 8cm"), { lengthCm: 20, widthCm: 15, heightCm: 8 });
  assert.deepEqual(parseStudioDimensions("Estimated: 200mm x 140mm x 40mm (7.87 in x 5.51 in x 1.57 in)"), { lengthCm: 20, widthCm: 14, heightCm: 4 });
  assert.equal(parseStudioWeight("Estimated: 350 g (12.35 oz)"), 350);
  assert.equal(parseStudioWeight("预估：350 克（12.35 盎司）"), 350);
  // 英寸、混合单位、盎司都不受理；出现两处匹配即视为歧义。
  assert.equal(parseStudioDimensions("7.9 x 5.9 x 3.1 in"), null);
  assert.equal(parseStudioDimensions("20cm x 140mm x 40mm"), null);
  assert.equal(parseStudioDimensions("Estimated: 200mm x 140mm x 40mm; 20cm x 14cm x 4cm"), null);
  assert.equal(parseStudioWeight("12.35 oz"), null);
});

test("物流预估优先根字段，缺失时回落到已选 Listing 的包装字段", () => {
  // 真实 fixture 没有根字段，靠 listingDrafts 的 packageDimensions/packageWeight。
  assert.deepEqual(extractStudioLogisticsEstimate(clone(REAL_SET_KHAKI)), {
    source: "package", lengthCm: 30, widthCm: 20, heightCm: 8, weightG: 410,
  });
  assert.deepEqual(summarizeStudioSet(clone(REAL_SET_HEATED)).logisticsEstimate, {
    source: "package", lengthCm: 30, widthCm: 25, heightCm: 10, weightG: 680,
  });

  // 有效根字段优先。
  const withRoot = clone(REAL_SET_KHAKI);
  withRoot.logisticsEstimate = { source: "package", lengthCm: 28, widthCm: 19, heightCm: 7, weightG: 420 };
  assert.deepEqual(extractStudioLogisticsEstimate(withRoot), withRoot.logisticsEstimate);

  // 根字段存在但无效时直接判空，不再回落——与被吸收侧一致。
  const invalidRoot = clone(REAL_SET_KHAKI);
  invalidRoot.logisticsEstimate = { source: "package", lengthCm: 20, widthCm: 14, heightCm: 4, weightG: 0 };
  assert.equal(extractStudioLogisticsEstimate(invalidRoot), null);
  const unknownSource = clone(REAL_SET_KHAKI);
  unknownSource.logisticsEstimate = { source: "guess", lengthCm: 20, widthCm: 14, heightCm: 4, weightG: 400 };
  assert.equal(extractStudioLogisticsEstimate(unknownSource), null);

  // 只读当前已选 Listing（status:"completed" 优先），不扫其他草稿。
  const twoDrafts = clone(REAL_SET_KHAKI);
  twoDrafts.listingDrafts.unshift({
    status: "pending",
    packageDimensions: "Estimated: 990mm x 880mm x 770mm",
    packageWeight: "Estimated: 999 g",
  });
  assert.deepEqual(extractStudioLogisticsEstimate(twoDrafts), {
    source: "package", lengthCm: 30, widthCm: 20, heightCm: 8, weightG: 410,
  });
  // 包装尺寸与重量缺一即判空，不拿产品尺寸凑。
  const productOnly = clone(REAL_SET_KHAKI);
  delete productOnly.listingDrafts[0].packageWeight;
  productOnly.listingDrafts[0].productWeight = "Estimated: 350 g";
  assert.equal(extractStudioLogisticsEstimate(productOnly), null);
});

test("Listing 字段按已选草稿映射，中文描述可回落到记录自身", () => {
  const summary = summarizeStudioSet(clone(REAL_SET_KHAKI));
  assert.equal(summary.productName, "电热保暖手套");
  assert.equal(summary.platformLabel, "通用电商");
  assert.equal(summary.targetLanguageLabel, "English");
  assert.equal(summary.listing.status, "completed");
  assert.match(summary.listing.englishTitle, /^1 Pack Heated Winter Gloves/u);
  assert.match(summary.listing.chineseTitle, /^1 Pack 电热保暖手套/u);
  assert.match(summary.listing.englishDescription, /^These heated winter gloves/u);
  assert.match(summary.listing.chineseDescription, /^这款电热保暖手套/u);

  // zhDisplay.description 缺失时回落到记录的 productDescription。
  const fallback = clone(REAL_SET_KHAKI);
  delete fallback.listingDrafts[0].zhDisplay.description;
  fallback.productDescription = "记录级中文描述";
  assert.equal(summarizeStudioSet(fallback).listing.chineseDescription, "记录级中文描述");

  // 没有任何草稿时 listing 各字段为空串而不是抛错。
  const noDraft = clone(REAL_SET_KHAKI);
  noDraft.listingDrafts = [];
  assert.deepEqual(summarizeStudioSet(noDraft).listing, {
    status: "", englishTitle: "", chineseTitle: "", englishDescription: "", chineseDescription: "",
  });

  // platformLabel / targetLanguageLabel 缺失时回落到 platform / targetLanguage。
  const rawLabels = clone(REAL_SET_KHAKI);
  delete rawLabels.platformLabel;
  delete rawLabels.targetLanguageLabel;
  rawLabels.platform = "universal";
  rawLabels.targetLanguage = "en";
  const labels = summarizeStudioSet(rawLabels);
  assert.equal(labels.platformLabel, "universal");
  assert.equal(labels.targetLanguageLabel, "en");
});
