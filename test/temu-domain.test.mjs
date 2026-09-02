import test from "node:test";
import assert from "node:assert/strict";
import {
  DEFAULT_FREIGHT_TEMPLATE_ID,
  OPTIONS,
  PRODUCT_DESCRIPTION_MAX_LENGTH,
  TEMPLATE_HEADERS,
  VARIANT_ATTRIBUTE_OPTIONS,
  addSkuVariant,
  availableVariantAttributeOptions,
  applySkuBulkFields,
  createDefaultDraft,
  generateSkuMatrix,
  hasEmbeddableImageSource,
  inspectPublicUrl,
  normalizeAsset,
  normalizeDraft,
  reorderCarouselAsset,
  skuKey,
  truncateProductDescription,
  updateSkuVariantAttributeName,
  updateSkuVariantValue,
  validateDraft,
} from "../lib/temu/domain.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "../lib/temu/template-headers.mjs";
import { createValidDraft } from "./temu-fixtures.mjs";

test("模板字段固定为 51 列", () => {
  assert.equal(TEMPLATE_HEADERS.length, 51);
  assert.equal(TEMPLATE_HEADERS[0], "*产品标题");
  assert.equal(TEMPLATE_HEADERS[50], "产地");
});

test("新草稿默认空申报价、库存 100、广东产地、运费模板和单品分类", () => {
  const draft = createDefaultDraft();
  draft.skus = generateSkuMatrix(draft);

  assert.equal(draft.version, 4);
  assert.equal(draft.product.declaredPrice, "");
  assert.equal(draft.product.inventory, "100");
  assert.equal(draft.product.origin, "中国大陆-广东省");
  assert.equal(draft.product.freightTemplateId, DEFAULT_FREIGHT_TEMPLATE_ID);
  assert.deepEqual([draft.variants.name1, draft.variants.name2], ["颜色", ""]);
  assert.deepEqual(
    [draft.product.skuCategoryType, draft.product.skuCategoryQuantity, draft.product.skuCategoryUnit],
    ["单品", "1", "件"],
  );
  assert.deepEqual(OPTIONS.freightTemplates, [
    { id: DEFAULT_FREIGHT_TEMPLATE_ID, name: "出口易交大略3号仓" },
  ]);
  assert.ok(draft.skus.every((sku) => sku.declaredPrice === "" && sku.inventory === "100"));
});

test("图片内容哈希与上传 Cloud name 规范化后可随草稿保留", () => {
  const draft = createDefaultDraft();
  draft.assets.carousel = [{
    id: "persisted-image",
    url: "https://res.cloudinary.com/demo/image/upload/persisted.jpg",
    contentHash: "A".repeat(64),
    uploadCloudName: "Demo-Cloud",
  }];

  const normalized = normalizeDraft(draft);
  assert.equal(normalized.assets.carousel[0].contentHash, "a".repeat(64));
  assert.equal(normalized.assets.carousel[0].uploadCloudName, "demo-cloud");

  draft.assets.carousel[0].contentHash = "not-a-sha256";
  assert.equal(normalizeDraft(draft).assets.carousel[0].contentHash, "");
});

test("图片未知尺寸和字节数保持 null，有限数值正常归一化", () => {
  assert.deepEqual(
    [
      normalizeAsset({ width: null, height: "", bytes: "not-a-number" }),
      normalizeAsset({ width: "  ", height: false, bytes: Number.POSITIVE_INFINITY }),
    ].map(({ width, height, bytes }) => ({ width, height, bytes })),
    [
      { width: null, height: null, bytes: null },
      { width: null, height: null, bytes: null },
    ],
  );

  const normalized = normalizeAsset({ width: "1200", height: 800, bytes: "0" });
  assert.deepEqual(
    { width: normalized.width, height: normalized.height, bytes: normalized.bytes },
    { width: 1200, height: 800, bytes: 0 },
  );
});

test("轮播资产重排保持输入不变并保留资产对象引用", () => {
  const first = { id: "first", localPreview: "blob:first" };
  const second = { id: "second", localPreview: "blob:second" };
  const third = { id: "third", localPreview: "blob:third" };
  const draft = createDefaultDraft();
  draft.assets.carousel = [first, second, third];

  const movedFirst = reorderCarouselAsset(draft, 2, 0);
  assert.deepEqual(movedFirst.assets.carousel.map((asset) => asset.id), ["third", "first", "second"]);
  assert.equal(movedFirst.assets.carousel[0], third);
  assert.equal(movedFirst.assets.carousel[1], first);
  assert.notEqual(movedFirst, draft);
  assert.notEqual(movedFirst.assets, draft.assets);
  assert.notEqual(movedFirst.assets.carousel, draft.assets.carousel);
  assert.deepEqual(draft.assets.carousel, [first, second, third]);

  const movedLast = reorderCarouselAsset(draft, 0, 2);
  assert.deepEqual(movedLast.assets.carousel.map((asset) => asset.id), ["second", "third", "first"]);
  assert.equal(movedLast.assets.carousel[2], first);

  for (const [fromIndex, toIndex] of [[0, 0], [-1, 1], [1.5, 0], [0, 3]]) {
    assert.equal(reorderCarouselAsset(draft, fromIndex, toIndex), draft);
  }
  assert.equal(reorderCarouselAsset({ assets: { carousel: [] } }, 0, 0).assets.carousel.length, 0);
  assert.equal(reorderCarouselAsset(null, 0, 1), null);
});

test("超长产品描述以最后一个完整英文或中文句末截断", () => {
  const englishSentence = `${"a".repeat(470)}.`;
  const englishResult = truncateProductDescription(`${englishSentence}${"b".repeat(80)}.`);
  assert.equal(englishResult, englishSentence);
  assert.ok(englishResult.length <= PRODUCT_DESCRIPTION_MAX_LENGTH);

  const chineseSentence = `${"中".repeat(498)}。`;
  const chineseResult = truncateProductDescription(`${chineseSentence}${"文".repeat(80)}。`);
  assert.equal(chineseResult, chineseSentence);
  assert.ok(chineseResult.length <= PRODUCT_DESCRIPTION_MAX_LENGTH);
});

test("旧版已知默认签名迁移且不覆盖已编辑值", () => {
  const legacy = normalizeDraft({
    version: 1,
    product: { declaredPrice: "200", inventory: "0", origin: "中国大陆-" },
    variants: { values1: ["红色", "蓝色"] },
    skus: [
      { variant1Value: "红色", declaredPrice: "200", inventory: "0" },
      { variant1Value: "蓝色", declaredPrice: "200", inventory: "0" },
    ],
  });
  assert.equal(legacy.version, 4);
  assert.equal(legacy.product.declaredPrice, "");
  assert.equal(legacy.product.inventory, "100");
  assert.equal(legacy.product.origin, "中国大陆-广东省");
  assert.ok(legacy.skus.every((sku) => sku.declaredPrice === "" && sku.inventory === "100"));

  const edited = normalizeDraft({
    version: 1,
    product: { declaredPrice: "199", inventory: "0", origin: "中国-浙江省" },
    variants: { values1: ["红色"] },
    skus: [{ variant1Value: "红色", declaredPrice: "199", inventory: "0" }],
  });
  assert.equal(edited.product.declaredPrice, "199");
  assert.equal(edited.product.inventory, "0");
  assert.equal(edited.product.origin, "中国大陆-浙江省");
  assert.equal(edited.skus[0].declaredPrice, "199");
  assert.equal(edited.skus[0].inventory, "0");
});

test("v3 SKU 分类空值一次性迁移且保留已有值和 v4 主动清空", () => {
  const migrated = normalizeDraft({
    version: 3,
    product: { skuCategoryType: "", skuCategoryQuantity: "", skuCategoryUnit: "" },
  });
  assert.deepEqual(
    [migrated.product.skuCategoryType, migrated.product.skuCategoryQuantity, migrated.product.skuCategoryUnit],
    ["单品", "1", "件"],
  );

  const edited = normalizeDraft({
    version: 3,
    product: { skuCategoryType: "同款多件", skuCategoryQuantity: "2", skuCategoryUnit: "包" },
  });
  assert.deepEqual(
    [edited.product.skuCategoryType, edited.product.skuCategoryQuantity, edited.product.skuCategoryUnit],
    ["同款多件", "2", "包"],
  );

  const cleared = normalizeDraft({
    version: 4,
    product: { skuCategoryType: "", skuCategoryQuantity: "", skuCategoryUnit: "" },
  });
  assert.deepEqual(
    [cleared.product.skuCategoryType, cleared.product.skuCategoryQuantity, cleared.product.skuCategoryUnit],
    ["", "", ""],
  );
});

test("v2 草稿补齐运费模板且非法模板 ID 阻止导出", () => {
  const migrated = normalizeDraft({ version: 2, product: { title: "旧草稿" } });
  assert.equal(migrated.version, 4);
  assert.equal(migrated.product.freightTemplateId, DEFAULT_FREIGHT_TEMPLATE_ID);

  const draft = createValidDraft();
  draft.product.freightTemplateId = "HFT-UNKNOWN";
  const result = validateDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) =>
    error.path === "product.freightTemplateId" && error.code === "invalid_enum"));
});

test("本地自定义运费模板可通过工作台校验，默认服务端枚举仍会拒绝未知 ID", () => {
  const draft = createValidDraft();
  draft.product.freightTemplateId = "local-freight-template";
  assert.equal(validateDraft(draft).valid, false);

  const result = validateDraft(draft, {
    freightTemplates: [
      ...OPTIONS.freightTemplates,
      { id: "local-freight-template", name: "本地测试模板" },
    ],
  });
  assert.equal(result.valid, true, JSON.stringify(result.errors));
});

test("双变种生成四个 SKU 并保留同键编辑", () => {
  const draft = createDefaultDraft();
  draft.product.productCode = "P100";
  draft.variants = { name1: "颜色", values1: ["红", "蓝"], name2: "被套尺码", values2: ["S", "M"] };
  draft.skus = generateSkuMatrix(draft);
  assert.equal(draft.skus.length, 4);
  draft.skus[0].skuCode = "CUSTOM-RED-S";
  draft.variants.values2.push("L");
  const expanded = generateSkuMatrix(draft);
  assert.equal(expanded.length, 6);
  assert.equal(expanded.find((sku) => sku.variant1Value === "红" && sku.variant2Value === "S").skuCode, "CUSTOM-RED-S");
});

test("新增变种只追加 SKU 行并继承商品默认值", () => {
  const draft = createDefaultDraft();
  Object.assign(draft.product, {
    declaredPrice: "12.5",
    length: "20",
    width: "15",
    height: "8",
    weight: "380",
    inventory: "50",
  });
  draft.variants = { name1: "颜色", values1: ["红色"], name2: "", values2: [] };
  draft.skus = [{
    key: skuKey("红色"),
    variant1Value: "红色",
    variant2Value: "",
    skuCode: "sku-1",
    declaredPrice: "9.9",
    length: "18",
    width: "12",
    height: "5",
    weight: "145",
    inventory: "100",
    image: { id: "kept-image", url: "https://example.com/red.jpg", status: "verified", width: 1200, height: 1200 },
    source: "kept",
  }, {
    key: skuKey("黑色"),
    variant1Value: "黑色",
    variant2Value: "",
    skuCode: "SKU-2",
    image: { id: "kept-image-2", url: "https://example.com/black.jpg", status: "verified" },
  }];
  const original = structuredClone(draft);

  const result = addSkuVariant(draft, " 蓝色 ", "ignored in single variant");

  assert.deepEqual({ added: result.added, reason: result.reason }, { added: true, reason: "" });
  assert.equal(result.draft.skus.length, 3);
  assert.equal(result.draft.skus[0], draft.skus[0]);
  assert.equal(result.draft.skus[0].image, draft.skus[0].image);
  assert.deepEqual(result.draft.skus.slice(0, 2), original.skus);
  assert.deepEqual(result.draft.variants, original.variants);
  assert.deepEqual(draft, original);
  assert.deepEqual(result.draft.skus[2], {
    key: skuKey("蓝色"),
    variant1Value: "蓝色",
    variant2Value: "",
    skuCode: "SKU-3",
    declaredPrice: "12.5",
    length: "20",
    width: "15",
    height: "8",
    weight: "380",
    inventory: "50",
    image: normalizeAsset(),
  });
  assert.match(result.draft.skus[2].skuCode, /^[\x00-\x7F]+$/);
});

test("新增双变种拒绝空值和重复组合", () => {
  const draft = createDefaultDraft();
  draft.variants = { name1: "颜色", values1: ["红色"], name2: "型号", values2: ["S"] };
  draft.skus = [{
    key: skuKey("红色", "S"),
    variant1Value: "红色",
    variant2Value: "S",
    skuCode: "SKU-1",
    image: normalizeAsset(),
  }];
  const original = structuredClone(draft);

  const missingFirst = addSkuVariant(draft, "  ", "M");
  assert.deepEqual({ draft: missingFirst.draft, added: missingFirst.added, reason: missingFirst.reason }, {
    draft,
    added: false,
    reason: "missing_variant1",
  });

  const missingSecond = addSkuVariant(draft, "蓝色", "  ");
  assert.equal(missingSecond.draft, draft);
  assert.deepEqual({ added: missingSecond.added, reason: missingSecond.reason }, { added: false, reason: "missing_variant2" });

  const duplicate = addSkuVariant(draft, " 红色 ", " S ");
  assert.equal(duplicate.draft, draft);
  assert.deepEqual({ added: duplicate.added, reason: duplicate.reason }, { added: false, reason: "duplicate" });
  assert.deepEqual(draft, original);

  const added = addSkuVariant(draft, "蓝色", " M ");
  assert.deepEqual({ added: added.added, reason: added.reason }, { added: true, reason: "" });
  assert.equal(added.draft.skus.length, 2);
  assert.deepEqual(added.draft.skus[1], {
    key: skuKey("蓝色", "M"),
    variant1Value: "蓝色",
    variant2Value: "M",
    skuCode: "SKU-2",
    declaredPrice: "",
    length: "",
    width: "",
    height: "",
    weight: "",
    inventory: "100",
    image: normalizeAsset(),
  });
  assert.deepEqual(added.draft.variants, original.variants);
});

test("新增变种以当前 SKU 值去重并避开陈旧 key", () => {
  const draft = createDefaultDraft();
  draft.skus = [{
    key: skuKey("白色"),
    variant1Value: "红色",
    variant2Value: "陈旧第二变种值",
    skuCode: "SKU-1",
    image: normalizeAsset(),
  }];

  const duplicate = addSkuVariant(draft, "红色");
  assert.equal(duplicate.draft, draft);
  assert.deepEqual({ added: duplicate.added, reason: duplicate.reason }, { added: false, reason: "duplicate" });

  const added = addSkuVariant(draft, "白色");
  assert.equal(added.added, true);
  assert.equal(added.draft.skus.length, 2);
  assert.equal(added.draft.skus[1].key, `${skuKey("白色")}#2`);
  assert.notEqual(added.draft.skus[1].key, draft.skus[0].key);
});

test("新增变种不设置每商品 20 SKU 上限", () => {
  const draft = createDefaultDraft();
  draft.skus = Array.from({ length: 20 }, (_, index) => ({
    key: skuKey(`颜色${index + 1}`),
    variant1Value: `颜色${index + 1}`,
    variant2Value: "",
    skuCode: `SKU-${index + 1}`,
    image: normalizeAsset(),
  }));

  const result = addSkuVariant(draft, "颜色21");

  assert.deepEqual({ added: result.added, reason: result.reason }, { added: true, reason: "" });
  assert.equal(result.draft.skus.length, 21);
  assert.equal(result.draft.skus[20].skuCode, "SKU-21");
});

test("行内变种值更新只修改目标 SKU 的值文本", () => {
  const draft = createDefaultDraft();
  draft.variants = { name1: "颜色", values1: ["白色", "蓝色"], name2: "型号", values2: ["A", "B"] };
  draft.skus = generateSkuMatrix(draft);
  draft.skus[0].skuCode = "F4J06T620";
  draft.skus[0].declaredPrice = "12.5";
  draft.skus[0].length = "18";
  draft.skus[0].width = "12";
  draft.skus[0].height = "5";
  draft.skus[0].weight = "145";
  draft.skus[0].inventory = "100";
  draft.skus[0].image = { ...draft.skus[0].image, url: "https://example.com/sku-one.jpg", status: "verified", width: 1200, height: 1200 };
  const original = structuredClone(draft);

  const updated = updateSkuVariantValue(draft, 0, "variant1Value", "1-F4J06T620");

  assert.equal(updated.skus[0].variant1Value, "1-F4J06T620");
  assert.deepEqual({ ...updated.skus[0], variant1Value: original.skus[0].variant1Value }, original.skus[0]);
  assert.deepEqual(updated.skus.slice(1), original.skus.slice(1));
  assert.deepEqual(updated.variants, original.variants);
  assert.deepEqual(draft, original);

  const updatedSecond = updateSkuVariantValue(draft, 1, "variant2Value", "B-更新");
  assert.equal(updatedSecond.skus[1].variant2Value, "B-更新");
  assert.deepEqual({ ...updatedSecond.skus[1], variant2Value: original.skus[1].variant2Value }, original.skus[1]);
  assert.deepEqual(updatedSecond.skus.filter((_, index) => index !== 1), original.skus.filter((_, index) => index !== 1));
  assert.deepEqual(updatedSecond.variants, original.variants);
});

test("变种属性受限互斥且迁移旧版双图片字段", () => {
  const normalized = normalizeDraft({
    variants: { name1: "风格", values1: ["白色挂绳款"], name2: "风格", values2: [] },
    skus: [{
      key: '["白色挂绳款",""]',
      variant1Value: "白色挂绳款",
      preview: { url: "https://example.com/preview.jpg", status: "verified" },
      material: { url: "https://example.com/material.jpg", width: 1200, height: 1200, status: "verified" },
    }],
  });

  assert.deepEqual(normalized.variants, { name1: "风格", values1: ["白色挂绳款"], name2: "", values2: [] });
  assert.equal(normalized.skus[0].image.url, "https://example.com/material.jpg");
  assert.equal("preview" in normalized.skus[0], false);
  assert.equal("material" in normalized.skus[0], false);

  const fallback = normalizeDraft({ variants: { name1: "款式", name2: "尺寸" } });
  assert.deepEqual([fallback.variants.name1, fallback.variants.name2], ["颜色", ""]);
});

test("变种属性名更新只改属性并保持 SKU 行数据稳定", () => {
  const draft = createDefaultDraft();
  draft.variants = { name1: "颜色", values1: ["白色", "蓝色"], name2: "材质", values2: ["棉", "涤纶"] };
  draft.skus = generateSkuMatrix(draft);
  draft.skus[0].skuCode = "F4J06T620";
  draft.skus[0].image = { ...draft.skus[0].image, url: "https://example.com/sku-one.jpg", status: "verified", width: 1200, height: 1200 };
  const original = structuredClone(draft);

  const updated = updateSkuVariantAttributeName(draft, "name1", "材质");

  assert.deepEqual(VARIANT_ATTRIBUTE_OPTIONS, [
    "颜色", "风格", "材质", "口味", "适用人群", "容量", "成分", "重量", "品类", "数量", "型号",
    "头发长度", "被套尺码", "RAM+ROM", "存储容量", "厚被尺码", "手机型号", "薄被尺码",
  ]);
  assert.deepEqual(availableVariantAttributeOptions("颜色"), VARIANT_ATTRIBUTE_OPTIONS.slice(1));
  assert.deepEqual(updated.variants, { ...original.variants, name1: "材质", name2: "" });
  assert.deepEqual(updated.skus, original.skus);
  assert.deepEqual(draft, original);

  const duplicateSecond = updateSkuVariantAttributeName(original, "name2", "颜色");
  assert.deepEqual([duplicateSecond.variants.name1, duplicateSecond.variants.name2], ["颜色", ""]);
  assert.deepEqual(duplicateSecond.skus, original.skus);
});

test("变种值校验读取 SKU 行而非旧变种值数组", () => {
  const draft = createValidDraft();
  draft.variants.values1 = [];
  draft.variants.values2 = [];
  assert.equal(validateDraft(draft).valid, true, JSON.stringify(validateDraft(draft).errors));

  draft.skus[0].variant1Value = "";
  assert.ok(validateDraft(draft).errors.some((error) => error.path === "skus.0.variant1Value"));

  draft.skus[0].variant1Value = "白色";
  draft.skus[0].variant2Value = "";
  assert.ok(validateDraft(draft).errors.some((error) => error.path === "skus.0.variant2Value"));
});

test("变种组合重复时阻止校验通过", () => {
  const draft = createValidDraft();
  const duplicateIndex = draft.skus.length;
  draft.skus.push({
    ...structuredClone(draft.skus[0]),
    key: skuKey("白色"),
    variant1Value: "白色",
    skuCode: "SKU-2",
  });

  const result = validateDraft(draft);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => (
    error.path === `skus.${duplicateIndex}.variant1Value`
    && error.code === "duplicate_variant"
    && error.message.includes("第 1 行")
  )));
});

test("批量 SKU 字段同时更新全部行和后续继承默认值", () => {
  const draft = createDefaultDraft();
  draft.variants.values1 = ["红色", "蓝色"];
  draft.skus = generateSkuMatrix(draft);
  const next = applySkuBulkFields(draft, {
    declaredPrice: "12.5",
    length: "20",
    width: "15",
    height: "8",
    weight: "380",
    inventory: "50",
  });

  assert.ok(next.skus.every((sku) => sku.declaredPrice === "12.5" && sku.weight === "380" && sku.inventory === "50"));
  assert.deepEqual(
    [next.product.length, next.product.width, next.product.height],
    ["20", "15", "8"],
  );
  next.variants.values1.push("绿色");
  const expanded = generateSkuMatrix(next);
  assert.equal(expanded.find((sku) => sku.variant1Value === "绿色").declaredPrice, "12.5");
  assert.equal(expanded.find((sku) => sku.variant1Value === "绿色").weight, "380");
});

test("发货时效只允许 1、2、7、9 天", () => {
  assert.deepEqual(OPTIONS.leadTimes, ["", "1", "2", "7", "9"]);
  const draft = createValidDraft();
  draft.product.leadTime = "9";
  assert.equal(validateDraft(draft).valid, true);
  draft.product.leadTime = "3";
  assert.ok(validateDraft(draft).errors.some((error) => error.path === "product.leadTime" && error.code === "invalid_enum"));
});

test("旧产地规范化为中国大陆加省份", () => {
  const draft = normalizeDraft({ product: { origin: "中国-浙江省" } });
  assert.equal(draft.product.origin, "中国大陆-浙江省");
});

test("拒绝本地路径与私有网络地址", () => {
  assert.equal(inspectPublicUrl("C:\\images\\main.jpg").valid, false);
  assert.equal(inspectPublicUrl("file:///C:/images/main.jpg").valid, false);
  assert.equal(inspectPublicUrl("http://127.0.0.1/main.jpg").valid, false);
  assert.equal(inspectPublicUrl("https://192.168.1.10/main.jpg").valid, false);
  assert.equal(inspectPublicUrl("https://res.cloudinary.com/demo/image/upload/sample.jpg").valid, true);
});

test("有效草稿通过服务端同构校验", () => {
  const result = validateDraft(createValidDraft());
  assert.equal(result.valid, true, JSON.stringify(result.errors));
  assert.equal(result.errors.length, 0);
});

test("SKU 货号包含中文时阻止导出并定位具体行", () => {
  const draft = createValidDraft();
  draft.skus[0].skuCode = "SKU-蓝色-01";

  const result = validateDraft(draft);

  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) =>
    error.path === "skus.0.skuCode"
    && error.code === "chinese_characters"
    && error.message === "SKU 1 货号不能包含中文"));
});

test("任意 embeddedImage 字段不能冒充公网图片 URL", () => {
  const draft = createValidDraft();
  draft.assets.carousel[0] = {
    name: "local.jpg",
    status: "local",
    width: 1200,
    height: 1200,
    embeddedImage: { bytes: "not-a-template-url" },
  };
  const result = validateDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "public_image_url_required"));
});

test("本地和 Studio 图片仅在已配置 Cloudinary 时进入待上传状态", () => {
  const draft = createValidDraft();
  draft.assets.carousel[0] = {
    ...draft.assets.carousel[0],
    url: "",
    localPreview: "blob:carousel-local",
    status: "local",
  };
  draft.skus.forEach((sku, index) => {
    sku.image = {
      ...sku.image,
      url: "",
      localPreview: index === 0 ? "" : `blob:sku-${index}`,
      studioPreviewUrl: index === 0 ? `${TEMU_STUDIO_IMAGE_PATH}?setId=set-1&itemId=sku-1` : "",
      status: "local",
    };
  });

  assert.equal(hasEmbeddableImageSource(draft.assets.carousel[0]), true);
  assert.equal(hasEmbeddableImageSource(draft.skus[0].image), true);
  const unconfiguredResult = validateDraft(draft);
  assert.equal(unconfiguredResult.valid, false);
  assert.ok(unconfiguredResult.errors.every((error) => error.code === "public_image_url_required"));

  draft.settings = { cloudName: "demo-cloud", uploadPreset: "temu_unsigned" };
  const browserResult = validateDraft(draft);
  assert.equal(browserResult.valid, true, JSON.stringify(browserResult.errors));
  assert.equal(browserResult.warnings.filter((warning) => warning.code === "image_upload_pending").length, 1);
  assert.match(browserResult.warnings[0].message, /导出前上传 Cloudinary/);

  const strictResult = validateDraft(draft, { allowLocalSources: false, requirePublicImageUrls: true });
  assert.equal(strictResult.valid, false);
  assert.ok(strictResult.errors.some((error) => error.code === "public_image_url_required"));
});

test("SKU 图必须经过尺寸检查且大于 800 的正方形", () => {
  const draft = createValidDraft();
  draft.skus[0].image.width = 800;
  draft.skus[0].image.height = 800;
  const result = validateDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.code === "sku_image_dimensions"));
});

test("产品描述不能超过 500 个字符", () => {
  const draft = createValidDraft();
  draft.product.description = "a".repeat(501);
  const result = validateDraft(draft);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => error.path === "product.description" && error.code === "max_length"));
});
