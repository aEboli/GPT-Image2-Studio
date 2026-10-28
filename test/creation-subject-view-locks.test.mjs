import test from "node:test";
import assert from "node:assert/strict";
import { buildPromptAgentInput, CREATION_REFERENCE_ANALYSIS_MODE } from "../lib/prompt-agent.mjs";
import { applyCreationPlanOverrides, buildCreationPlan, buildCreationSubmittedPlan, normalizeCreationReferenceAnalysis } from "../lib/creation-planner.mjs";
import { normalizeCreationProductInsights } from "../lib/creation-product-insights.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { buildCreationItemReferenceImages, buildCreationGenerationReferenceImageLabels } from "../lib/creation-reference-labels.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { gloveAnalysisInput } from "./fixtures/creation-glove-insights.mjs";
import { buildCreationPromptSections } from "../lib/creation-prompt-budget.mjs";

const palm = "画面左侧展示掌面，蜂窝纹理仅在掌心，拇指和食指翻盖打开";
const back = "画面右侧展示手背，HOT字样和显示55的控制器仅在手背，按键在显示窗下方";
const relation = "一双按1个可售单位计；画面左右不等于左右手，掌面与手背细节不得合并或互相复制";
const locks = [palm, back, relation].map((text) => ({ text, reference_indexes: [1] }));
const image = { filename: "gloves.png", mimeType: "image/png", base64: "Z2xvdmVz", buffer: Buffer.from("gloves") };
const blackInput = (overrides = {}) => {
  const input = gloveAnalysisInput({ imageCount: 12, targetLanguage: "zh-CN", dimensionSpecs: "" });
  input.productName = "黑色手套";
  input.productDescription = "黑色手套，画面一正一反展示";
  input.referenceImageRoles[0].note = `${palm}；${back}；${relation}。`;
  input.productInsights.appearance_locks = locks;
  return { ...input, ...overrides };
};

test("recognition requests surface ownership, separate view counts and uncertain handedness", () => {
  const request = buildPromptAgentInput({ images: [image], mode: CREATION_REFERENCE_ANALYSIS_MODE });
  const instruction = request[0].content.filter((part) => part.type === "input_text").map((part) => part.text).join("\n");
  assert.match(instruction, /画面左右.*左右手/);
  assert.match(instruction, /掌面.*手背/);
  assert.match(instruction, /视角.*可售|可售.*视角/);
  assert.match(instruction, /55.*温度|数字.*温度/);
  assert.match(instruction, /未知视角|未见表面/);
});

test("normalization deduplicates locks without cutting off their surface restriction", () => {
  const longLock = `${"保留可见缝线与轮廓。".repeat(80)}控制器只在手背，掌面不得出现控制器`;
  const normalized = normalizeCreationProductInsights({ appearance_locks: [...locks, ...locks, { text: longLock, reference_indexes: [1] }, { text: "辅助款红色", reference_indexes: [2] }] }, { referenceCount: 2, primaryIndex: 1 });
  assert.equal(normalized.appearanceLocks.filter((entry) => entry.text === palm).length, 1);
  assert.ok(normalized.appearanceLocks.some((entry) => entry.text.endsWith("掌面不得出现控制器")));
  assert.equal(normalized.appearanceLocks.some((entry) => entry.text.includes("辅助款")), false);
});

test("recognition and every template frame preserve the two surface descriptions", () => {
  const analysis = normalizeCreationReferenceAnalysis({ reference_roles: [{ index: 1, filename: image.filename, role: "product", note: `${palm}；${back}；${relation}` }], sku_subjects: [{ id: "black", title: "一双黑色手套", filenames: [image.filename], reference_indexes: [1], subject_unit_count: 1, note: "同一SKU一正一反展示" }], product_insights: { appearance_locks: locks } }, [image.filename]);
  assert.match(analysis.recommendations[0].note, /掌面/);
  assert.match(analysis.recommendations[0].note, /手背/);
  const plan = buildCreationPlan(blackInput());
  for (const item of plan.items.filter((entry) => !entry.evidenceBlocked)) {
    assert.ok(item.prompt.includes(palm), item.role);
    assert.ok(item.prompt.includes(back), item.role);
    assert.ok(item.prompt.includes(relation), item.role);
  }
  const angles = plan.items.find((item) => item.role === "multi-angle");
  assert.doesNotMatch(angles.prompt, /rear three-quarter|side profile|four-cell|four-view/i);
  assert.match(angles.prompt, /supported views|已见视角/i);
});

test("a generic recognition note is enriched by the same sourced appearance locks", () => {
  const analysis = normalizeCreationReferenceAnalysis({ reference_roles: [{ index: 1, filename: image.filename, role: "product", note: "黑色手套主体" }], product_insights: { appearance_locks: locks } }, [image.filename]);
  assert.ok(analysis.recommendations[0].note.includes(palm));
  assert.ok(analysis.recommendations[0].note.includes(back));
});

test("SKU locks are scoped to the selected SKU rather than recoloring every variant", () => {
  const input = blackInput({ selectedRoles: ["hero"], skuGenerationEnabled: true, skuSubjects: [
    { id: "black", filenames: ["gloves.png"], referenceIndexes: [1], colorNames: ["black"], note: `${palm}；${back}；${relation}` },
    { id: "red", filenames: ["red.png"], referenceIndexes: [2], colorNames: ["red"], note: "红色手套，手背是圆形按键" },
  ] });
  input.referenceImageRoles.push({ index: 2, filename: "red.png", role: "product", note: "红色手套，手背是圆形按键" });
  const plan = buildCreationPlan(input);
  const black = plan.items.find((item) => item.skuSubject?.id === "black");
  const red = plan.items.find((item) => item.skuSubject?.id === "red");
  assert.ok(black.prompt.includes(palm));
  assert.ok(black.prompt.includes(back));
  assert.doesNotMatch(red.prompt, /HOT|显示55|蜂窝纹理/);
  const selected = buildCreationItemReferenceImages(black, [image, { ...image, filename: "red.png" }], plan.referenceImageRoles);
  assert.equal(selected.length, 1);
  assert.doesNotMatch(buildCreationGenerationReferenceImageLabels(selected, plan.referenceImageRoles, black).join("\n"), /红色/);
});

test("long analysis keeps bounded per-frame facts and matching reference labels", () => {
  const input = blackInput();
  for (let index = 0; index < 20; index += 1) input.productInsights.confirmed_facts.push({ id: `extra-${index}`, text: `额外功能资料${index}，仅用于对应独立任务`, kind: "function", source: "reference", reference_indexes: [1] });
  const plan = buildCreationPlan(input);
  for (const item of plan.items.filter((entry) => entry.contentAssignment && !entry.evidenceBlocked)) {
    const max = item.role === "hero" ? 5 : 3;
    assert.ok(item.contentAssignment.factIds.length <= max, `${item.role}: ${item.contentAssignment.factIds.length}`);
    const selected = buildCreationItemReferenceImages(item, [image], plan.referenceImageRoles);
    const labels = buildCreationGenerationReferenceImageLabels(selected, plan.referenceImageRoles, item).join("\n");
    assert.doesNotMatch(labels, /额外功能资料19/);
    assert.equal(plan.warnings.some((warning) => warning.code === "creation-prompt-budget" && warning.itemId === item.itemId), false, item.role);
    for (const lock of [palm, back, relation]) assert.ok(item.prompt.includes(lock), item.role);
  }
});

test("mandatory long locks survive without a length warning", () => {
  const input = blackInput({ selectedRoles: ["hero"] });
  const longLock = `${"保留每个接缝的真实位置；".repeat(140)}掌面不得出现控制器`;
  input.productInsights.appearance_locks.push({ text: longLock, reference_indexes: [1] });
  const plan = buildCreationPlan(input);
  assert.ok(plan.items[0].prompt.includes(longLock));
  assert.equal(plan.warnings.some((warning) => warning.code === "creation-prompt-budget"), false);
});

test("long sourced specifications keep trailing units and operating conditions", () => {
  const input = blackInput({ selectedRoles: ["spec-table"] });
  const fact = `${"测试资料中的限定条件；".repeat(80)}仅在45°C档位使用6小时`;
  input.productInsights.confirmed_facts = [{ id: "long-spec", text: fact, kind: "function", source: "reference", reference_indexes: [1] }];
  const plan = buildCreationPlan(input);
  assert.equal(plan.productInsights.confirmedFacts[0].text, fact);
  assert.ok(plan.items[0].prompt.includes(fact));
  assert.equal(plan.warnings.some((warning) => warning.code === "creation-prompt-budget"), false);
});

test("long prompt sections keep optional content and deduplicate complete sections", () => {
  const required = "完整主体与数值条件。".repeat(200);
  const optional = "保留购买理由及同系列商品的一致性。";
  assert.equal(buildCreationPromptSections([required, "", required], [optional, "  ", optional, required]), `${required}\n${optional}`);
});

test("long template and SKU prompts survive frozen, stored and repaired plans without warnings", () => {
  const input = blackInput({ selectedRoles: ["hero", "detail"], skuGenerationEnabled: true, skuSubjects: [
    { id: "black", filenames: ["gloves.png"], referenceIndexes: [1], colorNames: ["black"], note: `${palm}；${back}；${relation}` },
  ] });
  const longLock = `${"保留每个接缝的真实位置；".repeat(140)}掌面不得出现控制器`;
  input.productInsights.appearance_locks.push({ text: longLock, reference_indexes: [1] });
  const plan = buildCreationPlan(input);
  assert.ok(plan.items.some((item) => item.role === "sku"));
  for (const item of plan.items) {
    assert.ok(item.prompt.length > 1200, item.role);
    assert.ok(item.prompt.includes(longLock), item.role);
  }
  assert.equal(plan.warnings.some((warning) => warning.code === "creation-prompt-budget"), false);
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const saved = normalizeCreationSetManifest({ ...plan, setId: "long-template-test", effectivePlan: frozen });
  const repaired = buildCreationRepairPlan(saved);
  for (const candidate of [frozen, saved, repaired]) assert.deepEqual(candidate.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
});

async function aiPlan(mutate = () => {}) {
  const { input, payload } = marketingPlanFixture(3);
  payload.product_insights.appearance_locks = locks;
  payload.reference_roles[0].note = `${palm}；${back}；${relation}`;
  mutate(payload);
  return requestCreationMarketingPlan({ input, referenceImages: [image], config: { baseUrl: "http://localhost:9/v1", endpointPath: "/responses", imageRoute: "a", apiKey: "local-test-only", responsesModel: "test-model" }, fetchImpl: async () => new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { headers: { "content-type": "application/json" } }) });
}

test("AI batch receives authoritative surface locks and survives frozen/store/repair", async () => {
  const plan = await aiPlan();
  for (const item of plan.items) {
    assert.ok(item.prompt.includes(palm));
    assert.ok(item.prompt.includes(back));
    assert.ok(item.prompt.includes(relation));
  }
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const saved = normalizeCreationSetManifest({ ...plan, setId: "subject-lock-test", effectivePlan: frozen });
  const repaired = buildCreationRepairPlan(saved);
  for (const candidate of [frozen, saved, repaired]) assert.deepEqual(candidate.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
});

test("AI output may exceed the old prompt budget while preserving subject locks", async () => {
  const plan = await aiPlan((payload) => { payload.items[1].prompt = `${palm}\n${back}\n${relation}\n${"完整商品证据与构图条件。".repeat(600)}`; });
  assert.ok(plan.items[1].prompt.includes(palm));
  assert.ok(plan.items[1].prompt.length > 1200);
  assert.equal(plan.warnings.some((warning) => warning.code === "creation-prompt-budget"), false);
});

test("manual edits retain their complete prompt and do not expand the old analysis in labels", () => {
  const plan = buildCreationPlan(blackInput({ selectedRoles: ["hero"] }));
  const prompt = "手动指定的完整构图与细节。".repeat(200);
  const updated = applyCreationPlanOverrides(plan, [{ itemId: plan.items[0].itemId, prompt }]);
  const item = updated.items[0];
  assert.equal(item.prompt, prompt);
  const labels = buildCreationGenerationReferenceImageLabels([image], plan.referenceImageRoles, item).join("\n");
  assert.ok(labels.includes(palm));
  assert.ok(labels.includes(back));
  assert.doesNotMatch(labels, /3000mAh|6小时/);
});

test("AI parameter tables may retain long sourced conditions", async () => {
  const plan = await aiPlan((payload) => { payload.items[1].image_type = "spec-table"; payload.items[1].prompt = `${palm}\n${back}\n${"规格条件。".repeat(600)}`; });
  assert.ok(plan.items[1].prompt.length > 1000);
});
