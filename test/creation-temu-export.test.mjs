import test from "node:test";
import assert from "node:assert/strict";

import {
  TEMU_EXPORT_LIMITS,
  TEMU_TEMPLATE_HEADERS,
  buildCloudinarySquareMaterialUrl,
  createTemuExportPlan,
  finalizeTemuExportPlan,
  isPublicHttpsImageUrl,
  normalizeTemuExportRequest,
  parseDimensionTripletCm,
  parseWeightG,
  sanitizeTemuCellText,
} from "../lib/creation-temu-export.mjs";

function makeListing(overrides = {}) {
  return {
    title: "Embroidered Horse Charm",
    description: "A decorative felt charm.",
    packageDimensions: "20 x 15 x 8 cm",
    packageWeight: "350 g",
    zhDisplay: {
      title: "羊毛毡刺绣小马挂件",
      description: "羊毛毡刺绣挂件。",
    },
    ...overrides,
  };
}

function makeSet(overrides = {}) {
  return {
    setId: "creation-set-a",
    productName: "羊毛毡刺绣小马挂件",
    listingDrafts: [makeListing()],
    skuSubjects: [
      { id: "horse-white", title: "原版白色挂绳款", bundleCount: 1 },
      { id: "horse-brown", title: "棕色皮绳款", bundleCount: 1 },
    ],
    items: [
      {
        itemId: "hero-a",
        slotIndex: 1,
        role: "hero",
        status: "completed",
        filename: "hero.png",
        relativePath: "sets/a/hero.png",
      },
      {
        itemId: "scene-a",
        slotIndex: 2,
        role: "scene",
        status: "completed",
        filename: "scene.png",
        relativePath: "sets/a/scene.png",
      },
      {
        itemId: "sku-white",
        slotIndex: 3,
        role: "sku",
        status: "completed",
        filename: "white.png",
        relativePath: "sets/a/white.png",
        skuSubject: { id: "horse-white", title: "原版白色挂绳款" },
      },
      {
        itemId: "sku-brown",
        slotIndex: 4,
        role: "sku",
        status: "completed",
        filename: "brown.png",
        relativePath: "sets/a/brown.png",
        skuSubject: { id: "horse-brown", title: "棕色皮绳款" },
      },
    ],
    ...overrides,
  };
}

test("Temu export request normalizes IDs, defaults and unsigned Cloudinary settings", () => {
  const request = normalizeTemuExportRequest({
    setIds: [" creation-set-a ", "creation-set-a", "creation-set-b"],
    defaults: {
      variantAttributeName: "颜色",
      defaultPrice: "19.99",
      defaultPackageLengthCm: "20",
      defaultPackageWidthCm: 15,
      defaultPackageHeightCm: "8",
      defaultPackageWeightG: "350",
      defaultStock: "100",
      defaultOriginCountry: "中国-广东省",
    },
    cloudinary: {
      cloudName: "demo-cloud",
      uploadPreset: "temu_unsigned",
    },
  });

  assert.deepEqual(request.setIds, ["creation-set-a", "creation-set-b"]);
  assert.deepEqual(request.defaults, {
    variantAttributeName: "颜色",
    defaultPrice: 19.99,
    defaultPackageLengthCm: 20,
    defaultPackageWidthCm: 15,
    defaultPackageHeightCm: 8,
    defaultPackageWeightG: 350,
    defaultStock: 100,
    defaultOriginCountry: "中国-广东省",
  });
  assert.deepEqual(request.cloudinary, {
    cloudName: "demo-cloud",
    uploadPreset: "temu_unsigned",
  });
});

test("Temu export request rejects partial or sensitive Cloudinary settings and invalid ranges", () => {
  assert.throws(
    () => normalizeTemuExportRequest({ setIds: ["a"], extra: true }),
    /不支持/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({ setIds: [1] }),
    /字符串/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({ setIds: ["x".repeat(TEMU_EXPORT_LIMITS.maxSetIdLength + 1)] }),
    /200/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({ setIds: ["a"], cloudinary: { cloudName: "demo" } }),
    /同时提供/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({
      setIds: ["a"],
      cloudinary: { cloudName: "demo", uploadPreset: "preset", apiSecret: "never" },
    }),
    /不支持|敏感/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({ setIds: ["a"], defaults: { defaultStock: "1.5" } }),
    /库存/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({ setIds: [], defaults: {} }),
    /至少/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({
      setIds: Array.from({ length: TEMU_EXPORT_LIMITS.maxSetIds + 1 }, (_, index) => `set-${index}`),
    }),
    /100/u,
  );
});

test("Temu export request enforces numeric boundaries and rejects nested unknown fields", () => {
  const requestAtMaximum = normalizeTemuExportRequest({
    setIds: ["creation-set-a"],
    defaults: {
      defaultPrice: 1_000_000_000,
      defaultPackageLengthCm: 100_000,
      defaultPackageWidthCm: 100_000,
      defaultPackageHeightCm: 100_000,
      defaultPackageWeightG: 1_000_000_000,
      defaultStock: 1_000_000_000,
    },
  });

  assert.deepEqual(requestAtMaximum.defaults, {
    variantAttributeName: "颜色",
    defaultPrice: 1_000_000_000,
    defaultPackageLengthCm: 100_000,
    defaultPackageWidthCm: 100_000,
    defaultPackageHeightCm: 100_000,
    defaultPackageWeightG: 1_000_000_000,
    defaultStock: 1_000_000_000,
    defaultOriginCountry: "",
  });
  assert.equal(
    normalizeTemuExportRequest({
      setIds: ["creation-set-a"],
      defaults: { defaultStock: 0 },
    }).defaults.defaultStock,
    0,
  );

  for (const { field, max } of [
    { field: "defaultPrice", max: 1_000_000_000 },
    { field: "defaultPackageLengthCm", max: 100_000 },
    { field: "defaultPackageWidthCm", max: 100_000 },
    { field: "defaultPackageHeightCm", max: 100_000 },
    { field: "defaultPackageWeightG", max: 1_000_000_000 },
  ]) {
    assert.throws(
      () => normalizeTemuExportRequest({ setIds: ["creation-set-a"], defaults: { [field]: 0 } }),
      /必须大于/u,
      field,
    );
    assert.throws(
      () => normalizeTemuExportRequest({ setIds: ["creation-set-a"], defaults: { [field]: max + 1 } }),
      /不得大于/u,
      field,
    );
  }
  assert.throws(
    () => normalizeTemuExportRequest({ setIds: ["creation-set-a"], defaults: { defaultStock: -1 } }),
    /不得小于/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({ setIds: ["creation-set-a"], defaults: { defaultStock: 1.5 } }),
    /必须是整数/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({
      setIds: ["creation-set-a"],
      defaults: { defaultPrice: 10, unexpectedDefault: true },
    }),
    /不支持|敏感/u,
  );
  assert.throws(
    () => normalizeTemuExportRequest({
      setIds: ["creation-set-a"],
      cloudinary: { cloudName: "demo-cloud", uploadPreset: "temu_unsigned", folder: "temu" },
    }),
    /不支持|敏感/u,
  );
});

test("public image URL classification rejects local and credential-bearing targets", () => {
  assert.equal(isPublicHttpsImageUrl("https://res.cloudinary.com/demo/image/upload/a.png"), true);
  assert.equal(isPublicHttpsImageUrl("https://img.kwcdn.com/product/a.jpeg"), true);
  for (const value of [
    "/output/a.png",
    "http://example.com/a.png",
    "data:image/png;base64,AA==",
    "blob:https://example.com/id",
    "file:///C:/a.png",
    "https://user:pass@example.com/a.png",
    "https://localhost/a.png",
    "https://127.0.0.1/a.png",
    "https://10.0.0.1/a.png",
    "https://192.168.1.2/a.png",
    "https://[::1]/a.png",
    "https://[fd00::1]/a.png",
  ]) {
    assert.equal(isPublicHttpsImageUrl(value), false, value);
  }
});

test("Cloudinary material URL is padded to a 1200 square without changing other hosts", () => {
  assert.equal(
    buildCloudinarySquareMaterialUrl(
      "https://res.cloudinary.com/demo/image/upload/v123/folder/hero.png",
    ),
    "https://res.cloudinary.com/demo/image/upload/c_pad,b_white,h_1200,w_1200/v123/folder/hero.png",
  );
  assert.equal(
    buildCloudinarySquareMaterialUrl("https://img.kwcdn.com/product/hero.jpeg"),
    "",
  );
});

test("dimension and weight parsing uses explicit units and rejects estimated values", () => {
  assert.deepEqual(parseDimensionTripletCm("20 x 15 x 8 cm"), [20, 15, 8]);
  assert.deepEqual(parseDimensionTripletCm("200 × 150 × 80 mm"), [20, 15, 8]);
  assert.deepEqual(parseDimensionTripletCm("7.87 x 5.91 x 3.15 in"), [19.9898, 15.0114, 8.001]);
  assert.equal(parseDimensionTripletCm("Estimated: 20 x 15 x 8 cm"), null);
  assert.equal(parseDimensionTripletCm("长度 20 cm"), null);
  assert.equal(parseWeightG("350 g"), 350);
  assert.equal(parseWeightG("0.35 kg"), 350);
  assert.equal(parseWeightG("Estimated: 350 g"), null);
});

test("cell sanitizer keeps text literal, removes invalid XML controls and truncates safely", () => {
  const formula = sanitizeTemuCellText("  =HYPERLINK(\"https://example.com\")");
  assert.equal(formula.value, "  =HYPERLINK(\"https://example.com\")");
  assert.equal(formula.forceText, true);
  assert.ok(formula.changes.some((change) => change.code === "CELL_FORMULA_LITERAL"));

  const controls = sanitizeTemuCellText("a\u0000b\tc\nd\re");
  assert.equal(controls.value, "ab\tc\nd\re");
  assert.ok(controls.changes.some((change) => change.code === "CELL_XML_CONTROL_REMOVED"));
  assert.equal(
    controls.changes.find((change) => change.code === "CELL_XML_CONTROL_REMOVED").originalLength,
    9,
  );

  const long = sanitizeTemuCellText(`${"x".repeat(32766)}😀z`);
  assert.equal(long.value.endsWith("😀"), false);
  assert.ok(long.value.length <= 32767);
  assert.ok(long.changes.some((change) => change.code === "CELL_VALUE_TRUNCATED"));
  assert.equal(
    long.changes.find((change) => change.code === "CELL_VALUE_TRUNCATED").originalLength,
    32769,
  );

  const invalidUnicode = sanitizeTemuCellText("\uD800");
  assert.equal(invalidUnicode.value, "\uFFFD");
  assert.ok(invalidUnicode.changes.some((change) => change.code === "CELL_INVALID_UNICODE_REPLACED"));
});

test("cell sanitizer treats every formula-like prefix as a literal text value", () => {
  for (const value of [
    "  =HYPERLINK(\"https://example.com\")",
    "\t+SUM(A1:A2)",
    "\n-42",
    "\r@SUM(A1:A2)",
  ]) {
    const sanitized = sanitizeTemuCellText(value);
    assert.equal(sanitized.value, value, value);
    assert.equal(sanitized.forceText, true, value);
    assert.equal(
      sanitized.changes.some((change) => change.code === "CELL_FORMULA_LITERAL"),
      true,
      value,
    );
  }
});

test("cell sanitizer honors exact Excel UTF-16 cell text boundaries", () => {
  const atLimit = "x".repeat(TEMU_EXPORT_LIMITS.maxCellCharacters);
  const sanitizedAtLimit = sanitizeTemuCellText(atLimit);
  assert.equal(sanitizedAtLimit.value, atLimit);
  assert.equal(sanitizedAtLimit.value.length, TEMU_EXPORT_LIMITS.maxCellCharacters);
  assert.equal(
    sanitizedAtLimit.changes.some((change) => change.code === "CELL_VALUE_TRUNCATED"),
    false,
  );

  const aboveLimit = "x".repeat(TEMU_EXPORT_LIMITS.maxCellCharacters + 1);
  const sanitizedAboveLimit = sanitizeTemuCellText(aboveLimit);
  assert.equal(sanitizedAboveLimit.value.length, TEMU_EXPORT_LIMITS.maxCellCharacters);
  assert.equal(
    sanitizedAboveLimit.changes.find((change) => change.code === "CELL_VALUE_TRUNCATED").originalLength,
    TEMU_EXPORT_LIMITS.maxCellCharacters + 1,
  );
});

test("Temu export rejects more than the bounded SKU row count", () => {
  const set = makeSet({
    skuSubjects: Array.from(
      { length: TEMU_EXPORT_LIMITS.maxRows + 1 },
      (_, index) => ({ id: "sku-" + index, title: "SKU " + index }),
    ),
    items: [],
  });
  assert.throws(
    () => createTemuExportPlan({ sets: [set], defaults: {} }),
    /2000/u,
  );
});

test("Temu export ignores invalid saved numeric facts and falls back to valid defaults", () => {
  const set = makeSet({
    temuExport: {
      declaredPrice: "not-a-number",
      stock: "1.5",
    },
  });
  const plan = createTemuExportPlan({
    sets: [set],
    defaults: normalizeTemuExportRequest({
      setIds: [set.setId],
      defaults: { defaultPrice: 19.99, defaultStock: 20 },
    }).defaults,
  });

  assert.equal(plan.rows[0].cells["*申报价格\n(店铺币种)"], 19.99);
  assert.equal(plan.rows[0].cells["库存"], 20);
  assert.equal(
    plan.issues.filter((issue) => issue.code === "INVALID_SAVED_VALUE_IGNORED").length,
    4,
  );
  assert.ok(plan.issues.some((issue) =>
    issue.code === "INVALID_SAVED_VALUE_IGNORED" &&
    issue.field === "*申报价格\n(店铺币种)" &&
    issue.source === "Set.temuExport.declaredPrice"));
  assert.ok(plan.issues.some((issue) =>
    issue.code === "INVALID_SAVED_VALUE_IGNORED" &&
    issue.field === "库存" &&
    issue.source === "Set.temuExport.stock"));
  assert.ok(plan.issues.some((issue) =>
    issue.code === "USER_DEFAULT_APPLIED" &&
    issue.field === "*申报价格\n(店铺币种)"));
  assert.ok(plan.issues.some((issue) =>
    issue.code === "USER_DEFAULT_APPLIED" &&
    issue.field === "库存"));
});

test("Temu export plan expands each saved SKU in stable order without inventing values", () => {
  const plan = createTemuExportPlan({
    sets: [makeSet()],
    defaults: normalizeTemuExportRequest({
      setIds: ["creation-set-a"],
      defaults: { defaultPrice: "100", defaultStock: "25", defaultOriginCountry: "中国-广东省" },
    }).defaults,
  });

  assert.equal(plan.rows.length, 2);
  assert.deepEqual(plan.rows.map((row) => row.skuId), ["horse-white", "horse-brown"]);
  assert.deepEqual(plan.rows.map((row) => row.cells["*变种属性值一"]), ["原版白色挂绳款", "棕色皮绳款"]);
  assert.equal(plan.rows[0].cells["*产品标题"], "羊毛毡刺绣小马挂件");
  assert.equal(plan.rows[0].cells["*英文标题"], "Embroidered Horse Charm");
  assert.equal(plan.rows[0].cells["*申报价格\n(店铺币种)"], 100);
  assert.equal(plan.rows[0].cells["*长（cm）"], 20);
  assert.equal(plan.rows[0].cells["*宽（cm）"], 15);
  assert.equal(plan.rows[0].cells["*高（cm）"], 8);
  assert.equal(plan.rows[0].cells["*重量（g）"], 350);
  assert.equal(plan.rows[0].cells["库存"], 25);
  assert.equal(plan.rows[0].cells["产地"], "中国-广东省");
  assert.equal(plan.rows[0].cells["SKU货号"], "horse-white");
  assert.equal(plan.rows[0].imageRefs.preview.itemId, "sku-white");
  assert.deepEqual(plan.rows[0].imageRefs.carousel.map((item) => item.itemId), ["hero-a", "scene-a"]);
  assert.equal(plan.rows[0].imageRefs.material.itemId, "hero-a");
  assert.equal(plan.imageRequirements.length, 4);
  assert.ok(plan.issues.some((issue) => issue.code === "USER_DEFAULT_APPLIED" && issue.field === "*申报价格\n(店铺币种)"));
  assert.deepEqual(TEMU_TEMPLATE_HEADERS.slice(0, 6), [
    "*产品标题", "*英文标题", "产品描述", "产品货号", "*变种属性名称一", "*变种属性值一",
  ]);
});

test("Temu export plan keeps multiple sets, product fields, and SKU facts independently ordered", () => {
  const secondSet = makeSet({
    setId: "creation-set-b",
    productName: "乙套图商品",
    listingDrafts: [makeListing({
      title: "Set B English Title",
      description: "Set B Description",
      zhDisplay: { title: "乙套图中文标题", description: "乙套图中文描述" },
    })],
    skuSubjects: [
      {
        id: "b-second",
        title: "乙套图第二 SKU",
        temuExport: { declaredPrice: 22, stock: 202, origin: "中国-浙江省" },
      },
      {
        id: "b-first",
        title: "乙套图第一 SKU",
        temuExport: { declaredPrice: 21, stock: 201, origin: "中国-江苏省" },
      },
    ],
    items: [],
  });
  const firstSet = makeSet({
    setId: "creation-set-a",
    productName: "甲套图商品",
    listingDrafts: [makeListing({
      title: "Set A English Title",
      description: "Set A Description",
      zhDisplay: { title: "甲套图中文标题", description: "甲套图中文描述" },
    })],
    skuSubjects: [
      {
        id: "a-second",
        title: "甲套图第二 SKU",
        temuExport: { declaredPrice: 32, stock: 302, origin: "中国-广东省" },
      },
      {
        id: "a-first",
        title: "甲套图第一 SKU",
        temuExport: { declaredPrice: 31, stock: 301, origin: "中国-福建省" },
      },
    ],
    items: [],
  });
  const plan = createTemuExportPlan({
    sets: [secondSet, firstSet],
    defaults: normalizeTemuExportRequest({
      setIds: [secondSet.setId, firstSet.setId],
      defaults: { defaultPrice: 999, defaultStock: 999, defaultOriginCountry: "默认产地" },
    }).defaults,
  });

  assert.deepEqual(plan.rows.map((row) => row.rowKey), [
    "creation-set-b:b-second",
    "creation-set-b:b-first",
    "creation-set-a:a-second",
    "creation-set-a:a-first",
  ]);
  assert.deepEqual(plan.rows.map((row) => row.dataRow), [2, 3, 4, 5]);
  assert.deepEqual(plan.rows.map((row) => row.cells["*产品标题"]), [
    "乙套图中文标题",
    "乙套图中文标题",
    "甲套图中文标题",
    "甲套图中文标题",
  ]);
  assert.deepEqual(plan.rows.map((row) => row.cells["*英文标题"]), [
    "Set B English Title",
    "Set B English Title",
    "Set A English Title",
    "Set A English Title",
  ]);
  assert.deepEqual(plan.rows.map((row) => row.cells["产品描述"]), [
    "<p>Set B Description</p>",
    "<p>Set B Description</p>",
    "<p>Set A Description</p>",
    "<p>Set A Description</p>",
  ]);
  assert.deepEqual(plan.rows.map((row) => ({
    skuId: row.skuId,
    price: row.cells["*申报价格\n(店铺币种)"],
    stock: row.cells["库存"],
    origin: row.cells["产地"],
  })), [
    { skuId: "b-second", price: 22, stock: 202, origin: "中国-浙江省" },
    { skuId: "b-first", price: 21, stock: 201, origin: "中国-江苏省" },
    { skuId: "a-second", price: 32, stock: 302, origin: "中国-广东省" },
    { skuId: "a-first", price: 31, stock: 301, origin: "中国-福建省" },
  ]);
});

test("valid saved SKU, Listing, and set facts take precedence over batch defaults", () => {
  const set = makeSet({
    setId: "creation-set-precedence",
    temuExport: { declaredPrice: 303, stock: 33, origin: "Set 产地" },
    skuSubjects: [
      {
        id: "sku-facts",
        title: "SKU facts",
        temuExport: { declaredPrice: 101, stock: 11, origin: "SKU 产地" },
      },
      { id: "listing-facts", title: "Listing facts" },
      { id: "set-facts", title: "Set facts" },
    ],
    listingDrafts: [
      makeListing({
        skuSubjectId: "sku-facts",
        packageDimensions: "11 x 12 x 13 cm",
        packageWeight: "114 g",
        temuExport: { declaredPrice: 201, stock: 21, origin: "Listing 产地 A" },
      }),
      makeListing({
        skuSubjectId: "listing-facts",
        packageDimensions: "21 x 22 x 23 cm",
        packageWeight: "224 g",
        temuExport: { declaredPrice: 202, stock: 22, origin: "Listing 产地 B" },
      }),
      makeListing({
        skuSubjectId: "set-facts",
        packageDimensions: "31 x 32 x 33 cm",
        packageWeight: "334 g",
      }),
    ],
    items: [],
  });
  const plan = createTemuExportPlan({
    sets: [set],
    defaults: normalizeTemuExportRequest({
      setIds: [set.setId],
      defaults: {
        defaultPrice: 999,
        defaultPackageLengthCm: 999,
        defaultPackageWidthCm: 999,
        defaultPackageHeightCm: 999,
        defaultPackageWeightG: 999,
        defaultStock: 999,
        defaultOriginCountry: "默认产地",
      },
    }).defaults,
  });

  assert.deepEqual(plan.rows.map((row) => ({
    price: row.cells["*申报价格\n(店铺币种)"],
    dimensions: [row.cells["*长（cm）"], row.cells["*宽（cm）"], row.cells["*高（cm）"]],
    weight: row.cells["*重量（g）"],
    stock: row.cells["库存"],
    origin: row.cells["产地"],
  })), [
    { price: 101, dimensions: [11, 12, 13], weight: 114, stock: 11, origin: "SKU 产地" },
    { price: 202, dimensions: [21, 22, 23], weight: 224, stock: 22, origin: "Listing 产地 B" },
    { price: 303, dimensions: [31, 32, 33], weight: 334, stock: 33, origin: "Set 产地" },
  ]);
  assert.equal(plan.issues.filter((issue) => issue.code === "USER_DEFAULT_APPLIED").length, 0);
});

test("Temu export reads historical Listing values without translation, rewriting, or migration", () => {
  const historicalTitle = "Café Storage Box – édition limitée";
  const historicalChineseTitle = "咖啡收纳盒 - 历史限定版";
  const historicalDescription = "Boîte de rangement – série spéciale.";
  const historicalListing = {
    marketplace: "amazon-us",
    language: "en-US",
    status: "completed",
    sku_subject_id: "legacy-cafe-sku",
    sku_title: "Café SKU – édition limitée",
    title: historicalTitle,
    sellingPoints: ["Café collection"],
    painPoints: [],
    fiveBullets: ["ÉDITION: Série limitée"],
    description: historicalDescription,
    backend_search_terms: "café édition limitée",
    package_dimensions: "22 x 13 x 7 cm",
    package_weight: "410 g",
    zh_display: {
      title: historicalChineseTitle,
      description: "历史中文描述原文。",
    },
  };
  const sourceBeforeExport = structuredClone(historicalListing);
  const set = makeSet({
    setId: "creation-set-legacy-listing",
    productName: "不应覆盖历史标题的商品名",
    listingDrafts: [historicalListing],
    skuSubjects: [{ id: "legacy-cafe-sku", title: "Café SKU – édition limitée" }],
    items: [],
  });
  const plan = createTemuExportPlan({
    sets: [set],
    defaults: normalizeTemuExportRequest({
      setIds: [set.setId],
      defaults: { defaultPrice: 20, defaultStock: 1 },
    }).defaults,
  });
  const row = plan.rows[0];

  assert.equal(row.cells["*产品标题"], historicalChineseTitle);
  assert.equal(row.cells["*英文标题"], historicalTitle);
  assert.equal(row.cells["产品描述"], `<p>${historicalDescription}</p>`);
  assert.deepEqual(
    [row.cells["*长（cm）"], row.cells["*宽（cm）"], row.cells["*高（cm）"], row.cells["*重量（g）"]],
    [22, 13, 7, 410],
  );
  assert.deepEqual(historicalListing, sourceBeforeExport);
});

test("image results fill SKU, carousel and square material URL while preserving failures as issues", () => {
  const plan = createTemuExportPlan({ sets: [makeSet()], defaults: normalizeTemuExportRequest({
    setIds: ["creation-set-a"],
    defaults: {
      defaultPrice: 100,
      defaultPackageLengthCm: 20,
      defaultPackageWidthCm: 15,
      defaultPackageHeightCm: 8,
      defaultPackageWeightG: 350,
    },
  }).defaults });
  const itemKey = (itemId) => `creation-set-a:${itemId}`;
  const finalized = finalizeTemuExportPlan(plan, new Map([
    [itemKey("hero-a"), { url: "https://res.cloudinary.com/demo/image/upload/v1/hero.png", source: "cloudinary" }],
    [itemKey("scene-a"), { url: "", code: "IMAGE_UPLOAD_FAILED", message: "上传失败" }],
    [itemKey("sku-white"), { url: "https://res.cloudinary.com/demo/image/upload/v1/white.png", source: "cloudinary" }],
    [itemKey("sku-brown"), { url: "https://res.cloudinary.com/demo/image/upload/v1/brown.png", source: "cloudinary" }],
  ]));

  assert.equal(finalized.rows[0].cells["预览图"], "https://res.cloudinary.com/demo/image/upload/v1/white.png");
  assert.equal(finalized.rows[1].cells["预览图"], "https://res.cloudinary.com/demo/image/upload/v1/brown.png");
  assert.equal(finalized.rows[0].cells["*轮播图"], "https://res.cloudinary.com/demo/image/upload/v1/hero.png");
  assert.equal(
    finalized.rows[0].cells["*产品素材图"],
    "https://res.cloudinary.com/demo/image/upload/c_pad,b_white,h_1200,w_1200/v1/hero.png",
  );
  assert.ok(finalized.issues.some((issue) => issue.code === "IMAGE_UPLOAD_FAILED" && issue.field === "*轮播图"));
  assert.equal(finalized.issues.some((issue) => /绝对路径/u.test(issue.message)), false);
});

test("missing Listing and SKU remain blank and are fully reported", () => {
  const set = makeSet({ listingDrafts: [], skuSubjects: [], items: [] });
  const plan = createTemuExportPlan({ sets: [set], defaults: normalizeTemuExportRequest({ setIds: [set.setId] }).defaults });
  const finalized = finalizeTemuExportPlan(plan, new Map());

  assert.equal(finalized.rows.length, 1);
  assert.equal(finalized.rows[0].cells["*英文标题"], "");
  assert.equal(finalized.rows[0].cells["*变种属性值一"], "");
  assert.equal(finalized.rows[0].cells["*申报价格\n(店铺币种)"], null);
  assert.ok(finalized.issues.some((issue) => issue.code === "MISSING_LISTING"));
  assert.ok(finalized.issues.some((issue) => issue.code === "MISSING_SKU"));
  assert.ok(finalized.issues.some((issue) => issue.code === "MISSING_REQUIRED_FIELD" && issue.field === "*英文标题"));
  assert.ok(finalized.issues.some((issue) => issue.code === "MISSING_PUBLIC_IMAGE_URL" && issue.field === "*轮播图"));
});
