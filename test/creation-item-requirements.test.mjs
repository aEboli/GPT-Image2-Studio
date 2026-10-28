import test from "node:test";
import assert from "node:assert/strict";
import { applyCreationPlanEvidenceRequirements, buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { getCreationIncompleteItems, shouldAutoRepairCreationSet } from "../lib/creation-auto-repair.mjs";
import { selectCreationRepairItems } from "../lib/creation-repair.mjs";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { getCreationItemEvidenceRequirement } from "../lib/creation-item-requirements.mjs";

const BASE = Object.freeze({
  platform: "universal",
  imageCount: 18,
  industryTemplate: "general",
  productName: "heated gloves",
});

function carousel(plan) {
  return (plan.items || []).filter((item) => item.itemKind === "carousel");
}

function blockedTitles(plan) {
  return carousel(plan).filter((item) => item.evidenceBlocked).map((item) => item.title);
}

test("a spec table is blocked when no specification value is supplied", () => {
  const requirement = getCreationItemEvidenceRequirement({ role: "spec-table", dimensionLines: [] });
  assert.equal(requirement?.code, "specifications");
  assert.equal(getCreationItemEvidenceRequirement({ role: "spec-table", dimensionLines: ["Length 10 cm"] }), null);
});

test("variant showcase requires at least two confirmed choices", () => {
  assert.equal(getCreationItemEvidenceRequirement({ role: "series-showcase" })?.code, "variants");
  assert.equal(getCreationItemEvidenceRequirement({
    role: "series-showcase",
    skuSubjects: [{ id: "beige" }],
  })?.code, "variants");
  assert.equal(getCreationItemEvidenceRequirement({
    role: "series-showcase",
    productDescription: "available in beige and black",
  }), null);
  assert.equal(getCreationItemEvidenceRequirement({
    role: "series-showcase",
    sellingPoints: ["颜色：米色 / 黑色"],
  }), null);
});

test("appended SKU images require at least two sourced sellable variants", () => {
  assert.equal(getCreationItemEvidenceRequirement({
    role: "sku",
    skuSubjects: [{ id: "khaki", filenames: ["khaki.png"], colorNames: ["khaki"] }],
  })?.code, "variants");
  assert.equal(getCreationItemEvidenceRequirement({
    role: "sku",
    skuSubjects: [
      { id: "khaki", filenames: ["khaki.png"], colorNames: ["khaki"] },
      { id: "black", filenames: ["black.png"], colorNames: ["black"] },
    ],
  }), null);
});

test("package image requires an actual included-item list", () => {
  assert.equal(getCreationItemEvidenceRequirement({
    role: "accessory-gift",
    productDescription: "Heated gloves with a Type-C charging port",
  })?.code, "package");
  assert.equal(getCreationItemEvidenceRequirement({
    role: "accessory-gift",
    sellingPoints: ["Includes one USB charging cable and one storage pouch"],
  }), null);
  assert.equal(getCreationItemEvidenceRequirement({
    role: "accessory-gift",
    productInsights: { confirmedFacts: [{ id: "package", kind: "package", text: "包装内是一双手套" }] },
  }), null);
});

test("a bare product name blocks both size roles and the variant role", () => {
  const plan = buildCreationPlan({ ...BASE, productDescription: "", sellingPoints: [] });
  const titles = blockedTitles(plan);
  assert.deepEqual(titles.sort(), ["到手清单/配件图", "多款式/SKU选择图", "参数规格图", "尺寸容量适配图"].sort());
  for (const item of carousel(plan)) {
    if (!item.evidenceBlocked) continue;
    assert.equal(typeof item.evidenceRequirement?.message, "string");
    assert.equal(item.evidenceRequirement.message.length > 0, true);
  }
  assert.equal(plan.warnings.some((warning) => warning.code === "item-missing-evidence"), true);
});

test("supplying specification and variant data clears every block", () => {
  const plan = buildCreationPlan({
    ...BASE,
    productDescription: "米色和黑色两种颜色可选",
    sellingPoints: ["颜色：米色 / 黑色"],
    dimensionSpecs: "Length 10cm; Width 8cm",
  });
  assert.deepEqual(blockedTitles(plan), ["到手清单/配件图"]);
  assert.equal(plan.warnings.some((warning) => warning.code === "item-missing-evidence"), true);
});

test("two sourced SKU subjects unlock variants even when individual SKU generation is off", () => {
  const plan = buildCreationPlan({
    ...BASE,
    productDescription: "",
    sellingPoints: [],
    dimensionSpecs: "Length 10cm",
    skuSubjects: [
      { id: "beige", title: "Beige", filenames: ["beige.png"], colorNames: ["beige"] },
      { id: "black", title: "Black", filenames: ["black.png"], colorNames: ["black"] },
    ],
    skuGenerationEnabled: false,
  });
  assert.deepEqual(blockedTitles(plan), ["到手清单/配件图"]);
});

test("one sourced SKU takes precedence over generic mentions of other colors", () => {
  for (const skuSubjects of [
    [{ id: "khaki", filenames: ["gloves.png"], colorNames: ["khaki gray"], note: "一双手套，左右各一只" }],
    [
      { id: "front", filenames: ["front.png"], colorNames: ["khaki gray"] },
      { id: "back", filenames: ["back.png"], colorNames: ["gray khaki"] },
    ],
    [
      { id: "first", filenames: ["same.png"], colorNames: ["khaki"] },
      { id: "second", filenames: ["same.png"], colorNames: ["black"] },
    ],
  ]) {
    const plan = buildCreationPlan({ ...BASE, productDescription: "颜色：卡其色 / 黑色", skuSubjects: JSON.stringify(skuSubjects) });
    assert.equal(carousel(plan).find((item) => item.role === "series-showcase").evidenceBlocked, true);
  }
});

test("one color, compound product colors, universal size, and batteries are not variant or size evidence", () => {
  for (const productDescription of ["卡其色", "black and gray palm panel", "仅一种颜色：卡其色", "3000mAh 65°C 3档 均码", "颜色：米色"]) {
    const plan = buildCreationPlan({ ...BASE, productDescription });
    assert.equal(carousel(plan).find((item) => item.role === "series-showcase").evidenceBlocked, true, productDescription);
    assert.equal(carousel(plan).find((item) => item.role === "size-capacity-fit").evidenceBlocked, true, productDescription);
  }
});

test("a dimension reference role alone never unlocks size images but readable values do", () => {
  for (const [note, blocked] of [["均码，展示尺寸", true], ["Length 20cm; Width 10cm", false]]) {
    const plan = buildCreationPlan({ ...BASE, referenceImageRoles: [{ filename: "size.png", role: "dimensions", note }] });
    assert.equal(carousel(plan).find((item) => item.role === "size-capacity-fit").evidenceBlocked, blocked);
    assert.equal(carousel(plan).find((item) => item.role === "spec-table").evidenceBlocked, blocked);
  }
});

test("removing evidence flags from a frozen plan cannot bypass generation gates", () => {
  const plan = buildCreationPlan({ ...BASE, dimensionSpecs: "", skuSubjects: [] });
  for (const item of plan.items) {
    item.evidenceBlocked = false;
    item.evidenceRequirement = null;
  }
  const submitted = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  assert.deepEqual(blockedTitles(submitted).sort(), ["到手清单/配件图", "多款式/SKU选择图", "参数规格图", "尺寸容量适配图"].sort());
});

test("evidence requirements are recalculated for saved repair plans", () => {
  const plan = applyCreationPlanEvidenceRequirements({
    dimensionSpecs: "", skuSubjects: [], items: [{ itemId: "size", role: "size-capacity-fit", prompt: "invent 20cm", evidenceBlocked: false }],
  });
  assert.equal(plan.items[0].evidenceBlocked, true);
  assert.deepEqual(getCreationIncompleteItems(plan), []);
  assert.deepEqual(selectCreationRepairItems(plan, { scope: "incomplete" }), []);
  assert.equal(shouldAutoRepairCreationSet({ set: plan, generationScope: "full", canRepair: true }), false);
});

test("browser normalization keeps evidence flags and excluded work stays out of progress", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const source = app.slice(app.indexOf("function normalizeCreationItemForView("), app.indexOf("function normalizeCreationSetForView("));
  const progress = app.slice(app.indexOf("function getCreationProgressSummary("), app.indexOf("function canRepairCreationSet("));
  const context = vm.createContext({
    CREATION_PREVIEW_SLOTS: [], cloneCreationPlanValue: (value, fallback) => value ?? fallback,
    normalizeCreationGenerationSnapshotForView: () => ({}), normalizeCreationCoverageFields: () => ({}),
    getFiniteCreationImageCount: () => 4, getCreationSelectedImageCount: () => 4,
  });
  vm.runInContext(source + "\n" + progress, context);
  const blocked = context.normalizeCreationItemForView({ itemId: "size", role: "size-capacity-fit", evidenceBlocked: true, evidenceRequirement: { code: "specifications" }, status: "skipped" });
  assert.equal(blocked.evidenceBlocked, true);
  assert.equal(blocked.evidenceRequirement.code, "specifications");
  const summary = context.getCreationProgressSummary({ items: [blocked, { status: "completed" }] });
  assert.equal(summary.total, 1);
  assert.equal(summary.completed, 1);
  assert.equal(summary.skipped, 1);
});

test("analysis application preserves the user selected main image and its appearance note", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const source = app.slice(app.indexOf("function applyCreationReferenceAnalysisRecommendations()"), app.indexOf("function renderCreationReferenceAnalysis()"));
  const state = {
    creationReferenceFiles: [
      { id: "feature", file: { name: "feature.png" }, role: "feature" },
      { id: "main", file: { name: "main.png" }, role: "reference-product", roleManuallyEdited: true, note: "主图：手指覆盖状态和控制器位置必须保留" },
    ],
    creationReferenceAnalysis: {
      dirty: false,
      result: { recommendations: [
        { filename: "feature.png", role: "reference-product", note: "another appearance" },
        { filename: "main.png", role: "feature", note: "change finger openings" },
      ] },
    },
  };
  const context = vm.createContext({
    state, syncCreationReferenceGenerationCompressionProfiles() {}, applyCreationReferenceAnalysisProductNameSuggestion() {},
    refreshCreationAppliedReferencePlanningSignals() {}, syncCreationSelectedRolesToReferenceCoverage() {},
    buildCreationReferenceAnalysisAppliedFeedbackMessage() {}, setCreationReferenceAnalysisFeedback() {},
    renderCreationReferenceGrid() {}, renderCreationReferenceAnalysis() {},
  });
  vm.runInContext(source, context);
  context.applyCreationReferenceAnalysisRecommendations();
  assert.equal(state.creationReferenceFiles[1].role, "reference-product");
  assert.equal(state.creationReferenceFiles[1].note, "主图：手指覆盖状态和控制器位置必须保留");
  assert.equal(state.creationReferenceFiles.filter((item) => item.role === "reference-product").length, 1);
  assert.equal(state.creationReferenceAnalysis.applied, true);
});
