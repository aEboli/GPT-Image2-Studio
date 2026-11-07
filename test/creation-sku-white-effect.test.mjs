import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { buildCreationPlan, buildCreationSubmittedPlan, CREATION_SKU_GENERATION_RULE_OPTIONS, CREATION_VISUAL_LANGUAGE_OPTIONS, normalizeCreationSkuGenerationRule } from "../lib/creation-planner.mjs";
import { buildCreationItemGenerationPrompt } from "../lib/creation-generation-parameters.mjs";
import { buildCreationQueuedSet } from "../lib/creation-suite-queue.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { buildCreationItemReferenceImages } from "../lib/creation-reference-labels.mjs";

const rule = "white-effect-render";
const label = "SKU 渲染效果白底图";
const skuInput = (overrides = {}) => ({
  platform: "universal", productName: "旅行水杯", productDescription: "蓝色与红色两个可售款式",
  selectedRoles: ["hero"], skuGenerationRule: rule,
  referenceImageRoles: [
    { index: 1, filename: "blue.png", role: "reference-product", note: "蓝色水杯" },
    { index: 2, filename: "red.png", role: "product", note: "红色水杯" },
  ],
  skuSubjects: [
    { id: "blue", title: "蓝色水杯", filenames: ["blue.png"], referenceIndexes: [1] },
    { id: "red", title: "红色水杯", filenames: ["red.png"], referenceIndexes: [2] },
  ], ...overrides,
});
const skuItems = (plan) => plan.items.filter((item) => item.role === "sku");

test("SKU white effect rule is selectable without changing the default", () => {
  assert.equal(normalizeCreationSkuGenerationRule(rule).value, rule);
  assert.equal(normalizeCreationSkuGenerationRule(rule).label, label);
  assert.equal(normalizeCreationSkuGenerationRule("").value, "color-name-under-subject");
  assert.equal(CREATION_SKU_GENERATION_RULE_OPTIONS.length, 6);
});

test("SKU white effect keeps pure white and no new text across visual languages", () => {
  for (const visualLanguage of CREATION_VISUAL_LANGUAGE_OPTIONS) {
    const plan = buildCreationPlan(skuInput({ visualLanguage: visualLanguage.value }));
    assert.equal(plan.skuGenerationRule, rule);
    assert.equal(plan.skuGenerationRuleLabel, label);
    assert.equal(skuItems(plan).length, 2);
    for (const item of skuItems(plan)) {
      assert.equal(item.textPolicy, "none");
      assert.equal(item.scenePolicy, "white-background");
      assert.ok(item.prompt.includes("pure white background (RGB 255/255/255)"));
      assert.ok(item.prompt.includes("No added text"));
      assert.ok(item.prompt.includes("without function evidence"));
      assert.ok(item.prompt.includes("Preserve"));
      assert.ok(!item.prompt.includes("Replace the uploaded plain photo background"));
      assert.ok(!item.prompt.includes("required product code or color label"));
      assert.ok(!item.prompt.includes("CANVAS TEXT: new text"));
      assert.ok(!item.prompt.includes("Color label line under the subject"));
      assert.ok(!item.prompt.includes(visualLanguage.promptInstruction));
    }
  }
});

test("SKU white effect uses only matching variant function evidence", () => {
  const plan = buildCreationPlan(skuInput({
    productInsights: { confirmed_facts: [
      { id: "blue-heat", kind: "function", text: "蓝色款支持主动加热", source: "reference", reference_indexes: [1] },
      { id: "red-cool", kind: "function", text: "红色款支持主动制冷", source: "reference", reference_indexes: [2] },
    ] },
  }));
  const [blue, red] = skuItems(plan);
  assert.ok(blue.prompt.includes("蓝色款支持主动加热"));
  assert.ok(!blue.prompt.includes("红色款支持主动制冷"));
  assert.ok(red.prompt.includes("红色款支持主动制冷"));
  assert.ok(!red.prompt.includes("蓝色款支持主动加热"));
  const references = plan.referenceImageRoles.map((entry) => ({ name: entry.filename, referenceIndex: entry.index, buffer: Buffer.from(entry.filename) }));
  assert.deepEqual(buildCreationItemReferenceImages(blue, references, plan.referenceImageRoles).map((image) => image.name), ["blue.png"]);
});

test("SKU white effect supports supplied facts without analysis and allows material-only fallback", () => {
  const plan = buildCreationPlan(skuInput({ sellingPoints: "保温设计减少杯内热量散失" }));
  for (const item of skuItems(plan)) {
    assert.ok(item.prompt.includes("保温设计减少杯内热量散失"));
    assert.ok(item.prompt.includes("without function evidence"));
    assert.ok(item.prompt.includes("material and volume only"));
    assert.ok(item.prompt.includes("Do not invent"));
  }
  for (const item of skuItems(buildCreationPlan(skuInput()))) {
    assert.ok(item.prompt.includes("material and volume only"));
    assert.ok(!item.prompt.includes("must show heat"));
  }
});

test("SKU white effect also applies to disabled single-SKU preview prompts", () => {
  const input = skuInput();
  input.skuSubjects = input.skuSubjects.slice(0, 1);
  const plan = buildCreationPlan(input);
  assert.equal(plan.skuGenerationEnabled, false);
  const item = skuItems(plan)[0];
  assert.equal(item.evidenceBlocked, true);
  assert.equal(item.textPolicy, "none");
  assert.ok(item.prompt.includes("pure white background (RGB 255/255/255)"));
});

test("SKU white effect survives frozen submission queue storage repair and generation", () => {
  const plan = buildCreationPlan(skuInput());
  const submitted = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const queued = buildCreationQueuedSet({ effectivePlanOverride: submitted, normalizeSet: (set) => set, createdAt: "2026-11-06T00:00:00Z" });
  const stored = normalizeCreationSetManifest(queued);
  const repaired = buildCreationRepairPlan(stored);
  for (const value of [submitted, queued, stored, repaired]) {
    assert.equal(value.skuGenerationRule, rule);
    assert.equal(value.skuGenerationRuleLabel, label);
    assert.equal(skuItems(value)[0].prompt, skuItems(plan)[0].prompt);
    assert.equal(skuItems(value)[0].textPolicy, "none");
  }
  const item = skuItems(repaired)[0];
  const prompt = buildCreationItemGenerationPrompt(item.prompt, { targetLanguage: "en" }, item);
  assert.ok(prompt.includes("pure white background (RGB 255/255/255)"));
  assert.ok(!prompt.includes("Use concise English for new text"));
  const legacy = buildCreationRepairPlan(normalizeCreationSetManifest({ ...queued, effectivePlan: null }));
  assert.equal(skuItems(legacy)[0].textPolicy, "none");
  assert.equal(skuItems(legacy)[0].prompt, item.prompt);
});

test("SKU white effect respects conflicting and missing confirmed function evidence", () => {
  const input = skuInput({ productName: "加热旅行杯", productInsights: {
    confirmed_facts: [
      { id: "surface", kind: "appearance", text: "蓝色杯身", source: "reference", reference_indexes: [1] },
      { id: "heat", kind: "function", text: " disputed heating claim ", source: "reference", reference_indexes: [1] },
    ], conflicts: [{ text: "heating function conflicts with source", fact_ids: ["heat"], claims: ["disputed heating claim"] }],
  } });
  const item = skuItems(buildCreationPlan(input))[0];
  assert.ok(item.prompt.includes("without function evidence, render material and volume only"));
  assert.ok(!item.prompt.includes("disputed heating claim"));
});

test("SKU white effect leaves carousel prompts and previous SKU rules unchanged", () => {
  const original = buildCreationPlan(skuInput({ skuGenerationRule: "color-name-under-subject", visualLanguage: "lifestyle-editorial" }));
  const changed = buildCreationPlan(skuInput({ visualLanguage: "lifestyle-editorial" }));
  assert.equal(changed.items.find((item) => item.role === "hero").prompt, original.items.find((item) => item.role === "hero").prompt);
  for (const item of skuItems(original)) {
    assert.ok(item.prompt.includes("one short centered color-name label"));
    assert.ok(item.prompt.includes("new ecommerce setting following the selected visual language"));
    assert.equal(item.textPolicy, "factual-only");
  }
});

test("browser SKU selector and repair submission preserve the white effect rule", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
  assert.ok(html.includes('<option value="white-effect-render">' + label + '</option>'));
  const lines = app.split("\n");
  const scope = vm.createContext({ refs: { creationSkuGenerationRuleInput: { value: rule } }, FormData });
  for (const prefix of ["const DEFAULT_CREATION_SKU_GENERATION_RULE =", "const CREATION_SKU_GENERATION_RULE_LABELS =", "function getCreationSelectedSkuGenerationRule()", "function applyCreationRepairTargetFormFields("]) {
    vm.runInContext(lines.find((line) => line.startsWith(prefix)), scope);
  }
  const selected = vm.runInContext("getCreationSelectedSkuGenerationRule()", scope);
  assert.equal(selected.value, rule);
  assert.equal(selected.label, label);
  scope.set = { skuGenerationRule: rule };
  const fields = vm.runInContext("const fields = new FormData(); applyCreationRepairTargetFormFields(fields, set); fields", scope);
  assert.equal(fields.get("skuGenerationRule"), rule);
});
