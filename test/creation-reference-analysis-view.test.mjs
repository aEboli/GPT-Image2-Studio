import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCreationReferenceAnalysisProductNameValue,
  buildCreationReferenceAnalysisCategoryMatchText,
  buildCreationReferenceAnalysisAppliedFeedbackMessage,
  getCreationReferenceAnalysisProductNameSuggestion,
  getCreationReferenceAnalysisDisplayRoleLabel,
  getCreationReferenceAnalysisRoleCorrectionReason,
  normalizeCreationReferenceAnalysisUnitCountNote,
  shouldDowngradeReferenceProductAnalysisRole,
  summarizeCreationReferenceAnalysisRoleCorrections,
} from "../lib/creation-reference-analysis-view.mjs";

test("creation reference category matching ignores stale form product copy", () => {
  const text = buildCreationReferenceAnalysisCategoryMatchText(
    {
      categoryHint: "apparel",
      categoryPath: "Fashion > Women's Clothing > Sets",
      summary: "Light blue pleated upper and lower garment set.",
      recommendations: [
        {
          filename: "pleated-set.png",
          roleLabel: "product subject group",
          note: "Two complete clothing product units: sleeveless top and matching skirt.",
        },
      ],
    },
    {
      productName: "jointed fishing lure",
      productDescription: "bass bait with treble hooks",
      sellingPoints: ["lifelike swimming action"],
    },
  );

  assert.match(text, /apparel/);
  assert.match(text, /pleated upper and lower garment set/);
  assert.match(text, /matching skirt/);
  assert.doesNotMatch(text, /fishing lure|bass bait|swimming action/);
});

test("creation reference product name suggestion replaces only analysis-managed names", () => {
  assert.deepEqual(
    applyCreationReferenceAnalysisProductNameValue({
      analysis: { categoryTemplateLabel: "Women's Clothing Sets" },
      currentProductName: "Fishing Lure",
      previousAutoProductName: "Fishing Lure",
    }),
    {
      applied: true,
      autoProductName: "Women's Clothing Sets",
      productName: "Women's Clothing Sets",
    },
  );

  assert.deepEqual(
    applyCreationReferenceAnalysisProductNameValue({
      analysis: {},
      currentProductName: "Fishing Lure",
      previousAutoProductName: "Fishing Lure",
    }),
    {
      applied: false,
      autoProductName: "",
      productName: "",
    },
  );

  assert.deepEqual(
    applyCreationReferenceAnalysisProductNameValue({
      analysis: { categoryTemplateLabel: "Women's Clothing Sets" },
      currentProductName: "Manual Catalog Name",
      previousAutoProductName: "Fishing Lure",
    }),
    {
      applied: false,
      autoProductName: "Fishing Lure",
      productName: "Manual Catalog Name",
    },
  );
});

test("creation reference product name suggestion falls back to SKU subject title", () => {
  assert.equal(
    getCreationReferenceAnalysisProductNameSuggestion({
      productName: "",
      product_name: "",
      categoryHint: "",
      categoryPath: "",
      skuSubjects: [
        {
          title: "insulated lunch bag",
          filenames: ["front.png"],
          note: "One complete sellable product subject.",
        },
      ],
    }),
    "insulated lunch bag",
  );

  assert.equal(
    getCreationReferenceAnalysisProductNameSuggestion({
      sku_subjects: [
        {
          name: "stainless steel water bottle",
          reference_indexes: [1],
        },
      ],
    }),
    "stainless steel water bottle",
  );
});

test("creation reference product name suggestion uses analyzed product subject", () => {
  assert.equal(
    getCreationReferenceAnalysisProductNameSuggestion({
      productName: "",
      productSubject: "foldable camping table",
      categoryHint: "camping furniture",
    }),
    "foldable camping table",
  );

  assert.equal(
    getCreationReferenceAnalysisProductNameSuggestion({
      product_name: "",
      main_subject: "ceramic coffee dripper",
    }),
    "ceramic coffee dripper",
  );
});

test("creation reference analysis explains subject-unit downgrade from reference-product to product", () => {
  const reason = getCreationReferenceAnalysisRoleCorrectionReason(
    {
      filename: "orange-silver-pair.png",
      role: "reference-product",
      note: "One source image contains two complete visible lure bodies.",
    },
    2,
  );

  assert.match(reason, /reference-product/);
  assert.match(reason, /product/);
  assert.match(reason, /2 个完整产品单位/);
  assert.match(reason, /单一全套主主体锚点/);
});

test("creation reference analysis does not downgrade an explicitly selected subject anchor", () => {
  const reason = getCreationReferenceAnalysisRoleCorrectionReason(
    {
      filename: "selected-anchor.png",
      role: "reference-product",
      note: "User-selected set-wide primary subject anchor with two product views.",
    },
    2,
  );

  assert.equal(reason, "");
});

test("creation reference analysis does not downgrade a single full-set main subject anchor", () => {
  const entry = {
    filename: "hero-anchor.png",
    role: "reference-product",
    title: "Single full-set main subject anchor",
    note: "Use this as the single full-set main subject anchor; keep SKU colorway fidelity, but it is not an ordinary SKU card.",
  };

  assert.equal(shouldDowngradeReferenceProductAnalysisRole(entry, 1), false);
  assert.equal(getCreationReferenceAnalysisRoleCorrectionReason(entry, 1), "");
});

test("creation reference analysis labels multi-unit product references as product groups", () => {
  assert.equal(
    getCreationReferenceAnalysisDisplayRoleLabel({
      role: "product",
      roleLabel: "商品主体",
      subjectUnitCount: 2,
    }),
    "商品主体组",
  );
  assert.equal(
    getCreationReferenceAnalysisDisplayRoleLabel({
      role: "product",
      roleLabel: "商品主体",
      subjectUnitCount: 1,
    }),
    "商品主体",
  );
});

test("creation reference analysis correction summary reuses card reasons for apply copy", () => {
  const summary = summarizeCreationReferenceAnalysisRoleCorrections([
    {
      filename: "orange-silver-pair.png",
      role: "product",
      roleCorrectionReason:
        "已从 reference-product 调整为 product：识别到 2 个完整产品单位。只有用户明确指定的单一全套主主体锚点才保留 reference-product。",
    },
  ]);

  assert.match(summary, /角色纠正/);
  assert.match(summary, /reference-product 调整为 product/);
  assert.match(summary, /2 个完整产品单位/);
});

test("creation reference analysis apply feedback includes role correction summary", () => {
  const message = buildCreationReferenceAnalysisAppliedFeedbackMessage({
    recommendationCount: 2,
    productNameApplied: true,
    recommendations: [
      {
        filename: "orange-silver-pair.png",
        role: "product",
        roleCorrectionReason:
          "已从 reference-product 调整为 product：识别到 2 个完整产品单位。只有用户明确指定的单一全套主主体锚点才保留 reference-product。",
      },
    ],
  });

  assert.equal(
    message,
    "已应用 2 张参考图用途建议，商品名称已填入四级类目。角色纠正：已从 reference-product 调整为 product：识别到 2 个完整产品单位。只有用户明确指定的单一全套主主体锚点才保留 reference-product。",
  );
});

test("creation reference analysis removes single-unit wording when grouped SKU count is plural", () => {
  const note = normalizeCreationReferenceAnalysisUnitCountNote(
    "单个鱼形分节路亚白底主体图，需保留橙红变鳞片配色、金属鱼钩和仿真眼细节。",
    2,
  );

  assert.doesNotMatch(note, /单个|单一|1\s*个|一个/);
  assert.match(note, /图中共 2 个完整产品单位/);
});

test("creation reference analysis removes single-piece wording when grouped SKU count is plural", () => {
  const note = normalizeCreationReferenceAnalysisUnitCountNote(
    "单件鱼形分节路亚白底主体图，画面仅展示一件完整产品主体，需保留上下两件配色差异。",
    2,
  );

  assert.doesNotMatch(note, /单件|一件|1\s*件/);
  assert.match(note, /上下两件配色差异/);
  assert.match(note, /图中共 2 个完整产品单位/);
});

test("creation reference analysis removes model-generated singular product-body count copy", () => {
  const note = normalizeCreationReferenceAnalysisUnitCountNote(
    "这张图应主要影响银鲤色仿生鱼形路亚的外观配色、分节鱼身、三本钩和尾鳍细节，画面为1个完整产品单体。",
    1,
  );

  assert.equal(note, "这张图应主要影响银鲤色仿生鱼形路亚的外观配色、分节鱼身、三本钩和尾鳍细节");
});
