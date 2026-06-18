import test from "node:test";
import assert from "node:assert/strict";

import { buildCreationSkuSubjectsForPayload } from "../lib/creation-sku-subjects.mjs";

test("creation SKU payload excludes applied analysis subjects backed only by dimension references", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "lure-size-card",
          title: "尺寸参数参考图",
          filenames: ["lure-size-card.png"],
          note: "长度 130mm、重量 35g。",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      {
        filename: "lure-size-card.png",
        role: "dimensions",
        note: "尺寸规格信息。",
      },
    ],
  });

  assert.deepEqual(subjects, []);
});

test("creation SKU payload keeps product subjects that include size facts", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "hero-product",
          title: "红色路亚主体",
          filenames: ["hero-product.png"],
          note: "红色外观，长度 130mm、重量 35g。",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      {
        filename: "hero-product.png",
        role: "product",
        note: "商品正面主体，保留红色外观和结构，同时参考长度 130mm、重量 35g。",
      },
    ],
  });

  assert.deepEqual(subjects.map((subject) => subject.id), ["hero-product"]);
});

test("creation SKU payload treats reference subjects as product subjects", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    referenceRoles: [
      {
        filename: "subject-anchor.png",
        role: "reference-product",
        note: "参考主体，作为主体进入生成。",
      },
      {
        filename: "material.png",
        role: "material",
        note: "结构细节。",
      },
    ],
  });

  assert.deepEqual(subjects.map((subject) => [subject.id, subject.filenames]), [
    ["subject-anchor.png", ["subject-anchor.png"]],
  ]);
});

test("creation SKU payload does not append covered product references when analysis already matches by index", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: Array.from({ length: 5 }, (_, index) => ({
        id: `sku-${index + 1}`,
        title: `Recognized subject ${index + 1}`,
        referenceIndexes: [index + 1],
        filenames: [`recognized-${index + 1}.png`],
      })),
    },
    applied: true,
    dirty: false,
    referenceRoles: Array.from({ length: 5 }, (_, index) => ({
      filename: `product-${index + 1}.png`,
      role: "product",
      note: `Product subject ${index + 1}.`,
    })),
  });

  assert.equal(subjects.length, 5);
  assert.deepEqual(
    subjects.map((subject) => subject.id),
    ["sku-1", "sku-2", "sku-3", "sku-4", "sku-5"],
  );
});

test("creation SKU payload falls back to product roles when collapsed analysis covers multiple references by index", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "collapsed-lures",
          title: "Collapsed lure group",
          referenceIndexes: [1, 2, 3],
          filenames: ["recognized-collapsed-group.png"],
          note: "Distinct products were summarized together.",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: Array.from({ length: 3 }, (_, index) => ({
      filename: `product-${index + 1}.png`,
      role: "product",
      note: `Product subject ${index + 1}.`,
    })),
  });

  assert.deepEqual(
    subjects.map((subject) => subject.filenames[0]),
    ["product-1.png", "product-2.png", "product-3.png"],
  );
});

test("creation SKU payload keeps the selected reference subject alongside other product subjects", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "gray",
          title: "Gray lure",
          filenames: ["gray-main-lure.png"],
          note: "Regular product reference, not the selected main subject.",
        },
        {
          id: "green",
          title: "Green lure",
          filenames: ["green-alt-lure.png"],
          note: "Another product reference, not the selected main subject.",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      { filename: "gray-main-lure.png", role: "product", note: "Regular product reference." },
      { filename: "green-alt-lure.png", role: "product", note: "Alternate product reference." },
      { filename: "selected-main-subject.png", role: "reference-product", note: "Selected subject used by the main image." },
      { filename: "package-list.png", role: "package", note: "Package content only." },
    ],
  });

  assert.deepEqual(
    subjects.map((subject) => [subject.id, subject.filenames, subject.referenceIndexes]),
    [
      ["gray", ["gray-main-lure.png"], [1]],
      ["green", ["green-alt-lure.png"], [2]],
      ["selected-main-subject.png", ["selected-main-subject.png"], [3]],
    ],
  );
});

test("creation SKU payload keeps multi-unit product references as one SKU subject after role edits", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "silver-lure",
          title: "Silver lure",
          referenceIndexes: [1],
          filenames: ["three-lures.png"],
          note: "Top silver sellable lure subject.",
        },
        {
          id: "gold-lure",
          title: "Gold lure",
          referenceIndexes: [1],
          filenames: ["three-lures.png"],
          note: "Middle gold sellable lure subject.",
        },
        {
          id: "green-lure",
          title: "Green lure",
          referenceIndexes: [1],
          filenames: ["three-lures.png"],
          note: "Bottom green sellable lure subject.",
        },
      ],
    },
    applied: true,
    dirty: true,
    referenceRoles: [
      {
        filename: "three-lures.png",
        role: "product",
        note: "One white-background product reference containing three complete sellable lure colorways.",
      },
    ],
  });

  assert.deepEqual(
    subjects.map((subject) => [subject.id, subject.title, subject.filenames, subject.referenceIndexes, subject.note]),
    [
      [
        "three-lures.png",
        "Silver lure / Gold lure / Green lure",
        ["three-lures.png"],
        [1],
        "Top silver sellable lure subject. | Middle gold sellable lure subject. | Bottom green sellable lure subject.",
      ],
    ],
  );
});

test("creation SKU payload preserves applied grouped two-subject SKU subjects", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "silver-blue-pair",
          title: "Silver and blue lure pair",
          referenceIndexes: [1, 2],
          filenames: ["silver-top.png", "blue-bottom.png"],
          subjectUnitCount: 2,
          note: "This grouped SKU subject contains two complete visible lure bodies that must stay together in one SKU image.",
        },
        {
          id: "gold-green-pair",
          title: "Gold and green lure pair",
          referenceIndexes: [3, 4],
          filenames: ["gold-top.png", "green-bottom.png"],
          subjectUnitCount: 2,
          note: "This grouped SKU subject contains two complete visible lure bodies that must stay together in one SKU image.",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      { filename: "silver-top.png", role: "product", note: "Silver lure product subject." },
      { filename: "blue-bottom.png", role: "product", note: "Blue lure product subject." },
      { filename: "gold-top.png", role: "product", note: "Gold lure product subject." },
      { filename: "green-bottom.png", role: "product", note: "Green lure product subject." },
      { filename: "selected-main-subject.png", role: "reference-product", note: "Selected set-wide subject anchor." },
    ],
  });

  assert.equal(subjects.length, 2);
  assert.deepEqual(
    subjects.map((subject) => [subject.id, subject.filenames, subject.referenceIndexes, subject.subjectUnitCount]),
    [
      ["silver-blue-pair", ["silver-top.png", "blue-bottom.png"], [1, 2], 2],
      ["gold-green-pair", ["gold-top.png", "green-bottom.png"], [3, 4], 2],
    ],
  );
});

test("creation SKU payload does not split grouped pairs into all selected product subjects", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "silver-blue-pair",
          title: "Silver and blue lure pair",
          referenceIndexes: [1, 2],
          filenames: ["silver-top.png", "blue-bottom.png"],
          subjectUnitCount: 2,
          note: "This grouped SKU subject contains two complete visible lure bodies that must stay together as a paired sellable subject.",
        },
        {
          id: "gold-green-pair",
          title: "Gold and green lure pair",
          referenceIndexes: [3, 4],
          filenames: ["gold-top.png", "green-bottom.png"],
          subjectUnitCount: 2,
          note: "This grouped SKU subject contains two complete visible lure bodies that must stay together as a paired sellable subject.",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      { filename: "silver-top.png", role: "product", note: "Silver lure product subject." },
      { filename: "blue-bottom.png", role: "product", note: "Blue lure product subject." },
      { filename: "gold-top.png", role: "product", note: "Gold lure product subject." },
      { filename: "green-bottom.png", role: "product", note: "Green lure product subject." },
      { filename: "selected-main-subject.png", role: "reference-product", note: "Selected set-wide subject anchor." },
    ],
  });

  assert.deepEqual(
    subjects.map((subject) => subject.filenames),
    [
      ["silver-top.png", "blue-bottom.png"],
      ["gold-top.png", "green-bottom.png"],
    ],
  );
  assert.deepEqual(subjects.map((subject) => subject.subjectUnitCount), [2, 2]);
});

test("creation SKU payload keeps multiple photos of one sellable subject grouped", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "blue-lure-front-back",
          title: "Blue lure front and back",
          filenames: ["blue-front.png", "blue-back.png"],
          note: "Two photos of the same sellable blue lure SKU subject.",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      { filename: "blue-front.png", role: "product", note: "Front view of the blue lure SKU." },
      { filename: "blue-back.png", role: "product", note: "Back view of the same blue lure SKU." },
    ],
  });

  assert.deepEqual(
    subjects.map((subject) => [subject.id, subject.filenames]),
    [["blue-lure-front-back", ["blue-front.png", "blue-back.png"]]],
  );
});

test("creation SKU payload infers visible unit count from Chinese product subject notes", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    referenceRoles: [
      {
        filename: "four-lures.png",
        role: "product",
        note: "主体图包含4条完整可见路亚鱼饵，银色、绿色、红色、灰色四个色款。",
      },
    ],
  });

  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].subjectUnitCount, 4);
});

test("creation SKU payload preserves explicit grouped product unit counts from reference roles", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    referenceRoles: [
      {
        filename: "paired-reference.png",
        role: "product",
        note: "成对路亚配色需要同时保留。",
        subjectUnitCount: 2,
      },
    ],
  });

  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].subjectUnitCount, 2);
});

test("creation SKU payload falls back to current product roles when applied analysis collapses multiple subjects", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "jointed-lure",
          title: "分节鱼形发光路亚假饵",
          filenames: ["blue-lure.png", "yellow-lure.png", "green-lure.png", "silver-lure.png", "detail-lure.png"],
          note: "五张商品主体被识别为同一类路亚。",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      { filename: "blue-lure.png", role: "product", note: "蓝银色路亚主体。" },
      { filename: "yellow-lure.png", role: "product", note: "黄绿色路亚主体。" },
      { filename: "green-lure.png", role: "product", note: "绿色路亚主体。" },
      { filename: "package-list.png", role: "package", note: "包装清单。" },
      { filename: "silver-lure.png", role: "product", note: "银灰色路亚主体。" },
      { filename: "usage-guide.png", role: "usage", note: "充电说明。" },
      { filename: "size-card.png", role: "dimensions", note: "尺寸规格。" },
      { filename: "detail-lure.png", role: "product", note: "结构细节主体。" },
    ],
  });

  assert.deepEqual(
    subjects.map((subject) => subject.filenames[0]),
    ["blue-lure.png", "yellow-lure.png", "green-lure.png", "silver-lure.png", "detail-lure.png"],
  );
});

test("creation SKU payload uses product roles when collapsed analysis only names the first subject file", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "jointed-lure",
          title: "分节鱼形发光路亚假饵",
          filenames: ["blue-lure.png"],
          note: "多张商品主体被概括成一个 SKU。",
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      { filename: "blue-lure.png", role: "product", note: "蓝银色路亚主体。" },
      { filename: "yellow-lure.png", role: "product", note: "黄绿色路亚主体。" },
      { filename: "green-lure.png", role: "product", note: "绿色路亚主体。" },
    ],
  });

  assert.deepEqual(
    subjects.map((subject) => subject.filenames[0]),
    ["blue-lure.png", "yellow-lure.png", "green-lure.png"],
  );
});

test("creation SKU payload fallback keeps original reference filenames as subject titles", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    referenceRoles: [
      {
        filename: "blue-silver-lure.png",
        role: "product",
        note: "Blue silver lure SKU subject.",
      },
    ],
  });

  assert.deepEqual(subjects, [
    {
      id: "blue-silver-lure.png",
      title: "blue-silver-lure.png",
      referenceIndexes: [1],
      filenames: ["blue-silver-lure.png"],
      note: "Blue silver lure SKU subject.",
    },
  ]);
});

test("creation SKU payload enriches applied subjects from matching reference-product notes", () => {
  const subjects = buildCreationSkuSubjectsForPayload({
    analysis: {
      skuSubjects: [
        {
          id: "orange-pair",
          title: "Orange lure pair",
          filenames: ["orange-pair.png"],
        },
      ],
    },
    applied: true,
    dirty: false,
    referenceRoles: [
      {
        filename: "orange-pair.png",
        role: "reference-product",
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
  });

  assert.equal(subjects.length, 1);
  assert.equal(subjects[0].note, "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.");
  assert.equal(subjects[0].subjectUnitCount, 2);
  assert.deepEqual(subjects[0].referenceIndexes, [1]);
});
