import assert from "node:assert/strict";
import test from "node:test";
import { DEFAULT_FREIGHT_TEMPLATE_ID, createDefaultDraft, generateSkuMatrix } from "../lib/temu/domain.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "../lib/temu/template-headers.mjs";
import {
  defaultStudioCarouselItemIds,
  defaultStudioSkuSubjectKeys,
  createStudioAsset,
  groupStudioAssetsForUpload,
  mergeStudioSetIntoDraft,
  remainingStudioCarouselImages,
  normalizeStudioLogisticsEstimate,
  stripStudioImageSuffix,
  studioSkuSubjectEntries,
  toggleStudioCarouselSelection,
  toggleStudioSkuSubjectSelection,
} from "../lib/temu/studio-import.mjs";

function studioSet() {
  return {
    setId: "creation-set-demo",
    productName: "羊毛毡刺绣小马挂件",
    status: "completed",
    updatedAt: "2026-07-31T10:00:00.000Z",
    listing: {
      status: "completed",
      chineseTitle: "1件装羊毛毡刺绣小马挂件",
      englishTitle: "Wool Felt Embroidered Horse Charm",
      chineseDescription: "中文描述。",
      englishDescription: "English listing description.",
    },
    logisticsEstimate: {
      source: "package",
      lengthCm: 20,
      widthCm: 15,
      heightCm: 8,
      weightG: 350,
    },
    skuSubjects: [
      {
        id: "horse-white-cord",
        title: "白色挂绳款",
        image: {
          itemId: "sku-white",
          name: "white.png",
          width: 1254,
          height: 1254,
          previewUrl: `${TEMU_STUDIO_IMAGE_PATH}?setId=creation-set-demo&itemId=sku-white`,
        },
      },
      { id: "horse-gold-ring", title: "金色钥匙扣款", image: null },
    ],
    carouselImages: Array.from({ length: 11 }, (_, index) => ({
      itemId: `carousel-${index + 1}`,
      name: `carousel-${index + 1}.png`,
      width: 1254,
      height: 1254,
      previewUrl: `${TEMU_STUDIO_IMAGE_PATH}?setId=creation-set-demo&itemId=carousel-${index + 1}`,
    })),
  };
}

function currentDraft() {
  const draft = createDefaultDraft();
  Object.assign(draft.product, {
    title: "旧标题",
    englishTitle: "Old title",
    description: "旧描述",
    productCode: "KEEP-P100",
    declaredPrice: "8.88",
    suggestedPrice: "19.99",
    length: "12",
    width: "8",
    height: "3",
    weight: "190",
    inventory: "48",
    leadTime: "1",
    origin: "中国-浙江省",
    sensitive: "否",
  });
  draft.settings = { cloudName: "demo", uploadPreset: "unsigned" };
  draft.skus = generateSkuMatrix(draft);
  draft.assets.carousel = [{ id: "old", name: "old.png", url: "https://example.com/old.png", status: "verified" }];
  draft.assets.packaging = [{ id: "pack", name: "pack.png", url: "https://example.com/pack.png", status: "verified" }];
  return draft;
}

test("Studio 导入映射内容并保留运营、物流、合规和托管字段", () => {
  const input = currentDraft();
  const before = structuredClone(input);
  const result = mergeStudioSetIntoDraft(input, studioSet(), { importedAt: "2026-08-01T00:00:00.000Z" });

  assert.deepEqual(input, before, "导入映射不能原地修改当前草稿");
  assert.equal(result.product.title, "1件装羊毛毡刺绣小马挂件");
  assert.equal(result.product.englishTitle, "Wool Felt Embroidered Horse Charm");
  assert.equal(result.product.description, "English listing description.");
  for (const field of ["productCode", "declaredPrice", "suggestedPrice", "length", "width", "height", "weight", "inventory", "leadTime", "sensitive"]) {
    assert.equal(result.product[field], before.product[field], field);
  }
  assert.equal(result.product.origin, "中国大陆-浙江省");
  assert.equal(result.product.freightTemplateId, DEFAULT_FREIGHT_TEMPLATE_ID);
  assert.deepEqual(result.settings, before.settings);
  assert.deepEqual(result.variants, { name1: "颜色", values1: ["白色挂绳款", "金色钥匙扣款"], name2: "", values2: [] });
  assert.deepEqual(result.skus.map((sku) => sku.skuCode), ["horse-white-cord", "horse-gold-ring"]);
  assert.ok(result.skus.every((sku) => sku.declaredPrice === "8.88" && sku.weight === "190" && sku.inventory === "48"));
  assert.equal(result.assets.carousel.length, 10);
  assert.deepEqual(result.assets.carousel.map((asset) => asset.studioItemId), defaultStudioCarouselItemIds(studioSet()));
  assert.equal(result.assets.packaging.length, 0);
  assert.equal(result.assets.carousel[0].url, "");
  assert.equal(result.assets.carousel[0].status, "local");
  assert.match(result.skus[0].image.studioPreviewUrl, /itemId=sku-white/);
  assert.equal("preview" in result.skus[0], false);
  assert.equal("material" in result.skus[0], false);
  assert.match(result.skus[1].image.studioPreviewUrl, /itemId=carousel-1/);
  assert.deepEqual(result.studioImport, {
    setId: "creation-set-demo",
    productName: "羊毛毡刺绣小马挂件",
    importedAt: "2026-08-01T00:00:00.000Z",
  });
});

test("Studio 轮播候选包含信息图重构图并与普通轮播共用十张上限", () => {
  const set = studioSet();
  set.carouselImages.push({
    itemId: "infographic-rebuild-1",
    itemKind: "infographic-rebuild",
    name: "infographic-rebuild-1.png",
    width: 1254,
    height: 1254,
    previewUrl: `${TEMU_STUDIO_IMAGE_PATH}?setId=creation-set-demo&itemId=infographic-rebuild-1`,
  });
  const defaults = defaultStudioCarouselItemIds(set);
  assert.deepEqual(defaults, Array.from({ length: 10 }, (_, index) => `carousel-${index + 1}`));

  const blocked = toggleStudioCarouselSelection(defaults, "infographic-rebuild-1");
  assert.equal(blocked.limitReached, true);
  assert.deepEqual(blocked.itemIds, defaults);

  const removed = toggleStudioCarouselSelection(defaults, "carousel-1");
  assert.equal(removed.limitReached, false);
  const replaced = toggleStudioCarouselSelection(removed.itemIds, "infographic-rebuild-1");
  assert.equal(replaced.limitReached, false);
  assert.deepEqual(replaced.itemIds, [...defaults.slice(1), "infographic-rebuild-1"]);

  const result = mergeStudioSetIntoDraft(currentDraft(), set, { carouselItemIds: replaced.itemIds });
  assert.deepEqual(result.assets.carousel.map((asset) => asset.studioItemId), replaced.itemIds);
  assert.equal(result.skus[0].image.studioItemId, "sku-white");
  assert.equal(result.skus[1].image.studioItemId, "carousel-2");

  const limited = mergeStudioSetIntoDraft(currentDraft(), set, {
    carouselItemIds: set.carouselImages.map((image) => image.itemId),
  });
  assert.equal(limited.assets.carousel.length, 10);
});

test("补图候选只排除当前 Studio 记录中已经加入的轮播图", () => {
  const set = studioSet();
  const remaining = remainingStudioCarouselImages(set, [
    { studioSetId: set.setId, studioItemId: "carousel-2" },
    { studioSetId: "another-set", studioItemId: "carousel-3" },
    { studioSetId: set.setId, studioItemId: "" },
  ]);

  assert.equal(remaining.some((image) => image.itemId === "carousel-2"), false);
  assert.equal(remaining.some((image) => image.itemId === "carousel-3"), true);
  assert.equal(remaining.length, set.carouselImages.length - 1);
  assert.deepEqual(remainingStudioCarouselImages(null, []), []);
});

test("Studio SKU 主体默认全选，取消一个主体后只映射已选 SKU 且去除图片后缀", () => {
  const set = studioSet();
  set.skuSubjects = [
    { id: "red.jpeg.jpeg", title: "红色.jpeg.jpeg", image: null },
    { id: "blue.png", title: "蓝色.png", image: null },
    { id: "green.webp", title: "绿色.webp", image: null },
    { id: "black.jpg", title: "黑色.jpg", image: null },
  ];

  const entries = studioSkuSubjectEntries(set);
  const defaults = defaultStudioSkuSubjectKeys(set);
  assert.equal(entries.length, 4);
  assert.deepEqual(defaults, ["id:red.jpeg.jpeg", "id:blue.png", "id:green.webp", "id:black.jpg"]);
  assert.equal(stripStudioImageSuffix("3-DM1021057.jpeg.jpeg"), "3-DM1021057");

  const selected = toggleStudioSkuSubjectSelection(defaults, set, "id:black.jpg");
  assert.deepEqual(selected, defaults.slice(0, 3));
  const result = mergeStudioSetIntoDraft(currentDraft(), set, { skuSubjectKeys: selected });
  assert.deepEqual(result.variants.values1, ["红色", "蓝色", "绿色"]);
  assert.deepEqual(result.skus.map((sku) => sku.skuCode), ["red", "blue", "green"]);
  assert.equal(result.skus.length, 3);

  const noneSelected = mergeStudioSetIntoDraft(currentDraft(), set, { skuSubjectKeys: [] });
  assert.deepEqual(noneSelected.variants.values1, ["默认"]);
  assert.equal(noneSelected.skus.length, 1);
});

test("净化后同名的不同 Studio SKU 主体保持独立选择、变种、货号和图片映射", () => {
  const set = studioSet();
  set.skuSubjects = [
    {
      id: "red.jpg",
      title: "红色.jpg",
      image: { itemId: "sku-red-jpg", name: "red.jpg", previewUrl: `${TEMU_STUDIO_IMAGE_PATH}?setId=creation-set-demo&itemId=sku-red-jpg` },
    },
    {
      id: "red.png",
      title: "红色.png",
      image: { itemId: "sku-red-png", name: "red.png", previewUrl: `${TEMU_STUDIO_IMAGE_PATH}?setId=creation-set-demo&itemId=sku-red-png` },
    },
  ];

  const entries = studioSkuSubjectEntries(set);
  assert.deepEqual(entries.map(({ title, selectionKey }) => ({ title, selectionKey })), [
    { title: "红色", selectionKey: "id:red.jpg" },
    { title: "红色 (2)", selectionKey: "id:red.png" },
  ]);
  assert.deepEqual(defaultStudioSkuSubjectKeys(set), ["id:red.jpg", "id:red.png"]);

  const result = mergeStudioSetIntoDraft(currentDraft(), set);
  assert.deepEqual(result.variants.values1, ["红色", "红色 (2)"]);
  assert.deepEqual(result.skus.map((sku) => sku.skuCode), ["red", "red-2"]);
  assert.deepEqual(result.skus.map((sku) => sku.image.studioItemId), ["sku-red-jpg", "sku-red-png"]);
  assert.deepEqual(result.skus.map((sku) => sku.image.name), ["red.jpg", "red.png"]);
});

test("Studio 导入移除 SKU 货号中文并为纯中文主体生成稳定 ASCII 兜底", () => {
  const set = studioSet();
  set.skuSubjects = [
    { id: "蓝色-blue-01.png", title: "蓝色款.png", image: null },
    { id: "蓝色-blue-01.jpg", title: "蓝色款二.jpg", image: null },
    { id: "纯中文.png", title: "纯中文款.png", image: null },
    { id: "红色.jpg", title: "红色款.jpg", image: null },
  ];

  const result = mergeStudioSetIntoDraft(currentDraft(), set);

  assert.deepEqual(result.variants.values1, ["蓝色款", "蓝色款二", "纯中文款", "红色款"]);
  assert.deepEqual(result.skus.map((sku) => sku.skuCode), ["blue-01", "blue-01-2", "SKU-3", "SKU-4"]);
  assert.ok(result.skus.every((sku) => !/\p{Script=Han}/u.test(sku.skuCode)));
  assert.deepEqual(set.skuSubjects.map((subject) => subject.id), [
    "蓝色-blue-01.png",
    "蓝色-blue-01.jpg",
    "纯中文.png",
    "红色.jpg",
  ]);
});

test("没有 Studio 主体 ID 的 SKU 仍然有独立的默认选择键", () => {
  const set = studioSet();
  set.skuSubjects = [{ id: "", title: "无编号蓝色.png", image: null }];
  const [entry] = studioSkuSubjectEntries(set);
  assert.equal(entry.selectionKey, "title:无编号蓝色:0");
  assert.deepEqual(defaultStudioSkuSubjectKeys(set), [entry.selectionKey]);
});

test("确认开启时把完整 Studio 预估写入商品和全部新 SKU", () => {
  const result = mergeStudioSetIntoDraft(currentDraft(), studioSet(), { importEstimates: true });
  assert.deepEqual(
    [result.product.length, result.product.width, result.product.height, result.product.weight],
    ["20", "15", "8", "350"],
  );
  assert.ok(result.skus.every((sku) => sku.length === "20" && sku.width === "15" && sku.height === "8" && sku.weight === "350"));
  assert.deepEqual(result.studioImport.logisticsEstimate, {
    source: "package",
    lengthCm: "20",
    widthCm: "15",
    heightCm: "8",
    weightG: "350",
  });
});

test("关闭预估开关保留人工值，无可信预估时清空当前商品和新 SKU 物流值", () => {
  const input = currentDraft();
  const preserved = mergeStudioSetIntoDraft(input, studioSet(), { importEstimates: false });
  assert.deepEqual(
    [preserved.product.length, preserved.product.width, preserved.product.height, preserved.product.weight],
    ["12", "8", "3", "190"],
  );
  const missing = structuredClone(studioSet());
  delete missing.logisticsEstimate;
  const cleared = mergeStudioSetIntoDraft(input, missing, { importEstimates: true });
  assert.deepEqual(
    [cleared.product.length, cleared.product.width, cleared.product.height, cleared.product.weight],
    ["", "", "", ""],
  );
  assert.ok(cleared.skus.every((sku) => sku.length === "" && sku.width === "" && sku.height === "" && sku.weight === ""));
  assert.equal(cleared.studioImport.logisticsEstimate, undefined);

  const incomplete = structuredClone(studioSet());
  incomplete.logisticsEstimate = { source: "package", lengthCm: 20, widthCm: 15, heightCm: null, weightG: 350 };
  assert.equal(normalizeStudioLogisticsEstimate(incomplete.logisticsEstimate), null);
});

test("缺少 Listing、变种和主图时生成默认 SKU 但图片保持为空", () => {
  const result = mergeStudioSetIntoDraft(currentDraft(), {
    setId: "creation-set-incomplete",
    productName: "只有产品名",
    listing: {},
    skuSubjects: [],
    carouselImages: [],
  });
  assert.equal(result.product.title, "只有产品名");
  assert.equal(result.product.englishTitle, "");
  assert.equal(result.product.description, "");
  assert.deepEqual(result.variants, { name1: "颜色", values1: ["默认"], name2: "", values2: [] });
  assert.equal(result.skus.length, 1);
  assert.equal(result.skus[0].variant1Value, "默认");
  assert.ok(result.skus[0].skuCode);
  assert.equal(result.skus[0].image.status, "empty");
});

test("无变种主体时生成默认 SKU 并按当前选择顺序复用第一张主图", () => {
  const set = studioSet();
  set.skuSubjects = [];
  const result = mergeStudioSetIntoDraft(currentDraft(), set, {
    carouselItemIds: ["carousel-11", "carousel-2"],
  });

  assert.deepEqual(result.variants, { name1: "颜色", values1: ["默认"], name2: "", values2: [] });
  assert.equal(result.skus.length, 1);
  assert.equal(result.skus[0].variant1Value, "默认");
  assert.ok(result.skus[0].skuCode);
  assert.equal(result.assets.carousel[0].studioItemId, "carousel-11");
  assert.equal(result.skus[0].image.studioItemId, "carousel-11");
});

test("Studio 素材只接受工作台受限图片代理地址", () => {
  const asset = createStudioAsset("creation-set-demo", {
    itemId: "external",
    name: "external.png",
    previewUrl: "https://example.com/image.png",
  });
  assert.equal(asset.studioPreviewUrl, "");
  assert.equal(asset.url, "");
  assert.equal(asset.status, "error");
});

test("同一 SKU 图片只形成一个上传任务和一个资产对象", () => {
  const result = mergeStudioSetIntoDraft(currentDraft(), studioSet());
  const groups = groupStudioAssetsForUpload(result);
  assert.equal(groups.length, 11, "10 张轮播图和 1 张现有 SKU 图应形成 11 个上传任务");
  const skuGroup = groups.find((group) => group.previewUrl.includes("itemId=sku-white"));
  assert.equal(skuGroup.assets.length, 1);
  const fallbackGroup = groups.find((group) => group.previewUrl.includes("itemId=carousel-1"));
  assert.equal(fallbackGroup.assets.length, 2, "首图和缺图 SKU 应合并为同一个上传任务");
  assert.equal(skuGroup.assets[0], result.skus[0].image);
});

test("Studio 导入超长描述以最后一个完整句末结束", () => {
  const set = studioSet();
  const completeSentence = `${"x".repeat(470)}.`;
  set.listing.englishDescription = `${completeSentence}${"y".repeat(80)}.`;
  const result = mergeStudioSetIntoDraft(currentDraft(), set);
  assert.equal(result.product.description, completeSentence);
});
