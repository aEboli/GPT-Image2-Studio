import assert from "node:assert/strict";
import test from "node:test";
import { applyCreationMarketingPlan } from "../lib/creation-marketing-plan.mjs";
import { buildCreationPlan, buildCreationSubmittedPlan, applyCreationPlanEvidenceRequirements } from "../lib/creation-planner.mjs";
import { buildCreationItemReferenceImages, buildCreationGenerationReferenceImageLabels } from "../lib/creation-reference-labels.mjs";
import { auditCreationMarketingQuality, finalizeCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan, selectCreationRepairItems } from "../lib/creation-repair.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { gloveAnalysisInput } from "./fixtures/creation-glove-insights.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";

function fixture(imageType = "clean-catalog-main") {
  const { input, payload } = marketingPlanFixture(4);
  input.referenceImageRoles.push(
    { index: 2, filename: "control.png", role: "material", note: "显示窗和按键细节" },
    { index: 3, filename: "operation.png", role: "feature", note: "露指操作资料" },
  );
  input.productInsights.confirmed_facts.find((fact) => fact.id === "control").reference_indexes = [2];
  input.productInsights.confirmed_facts.find((fact) => fact.id === "fingers").reference_indexes = [3];
  Object.assign(payload.items[0], {
    image_type: imageType, reference_indexes: [1, 2, 3],
    prompt: "完整一双手套，纯白背景，无新增文字，保留真实外观。",
  });
  const base = buildCreationPlan(input);
  const images = ["gloves.png", "control.png", "operation.png"].map((filename, index) => ({
    filename, referenceIndex: index + 1, buffer: Buffer.from(filename), base64: Buffer.from(filename).toString("base64"), mimeType: "image/png", byteLength: 100_000,
  }));
  const apply = () => applyCreationMarketingPlan(base, payload, { count: 4, referenceCount: 3, primaryIndex: 1, referenceImages: images });
  return { base, payload, images, apply };
}

test("white product tasks retain provenance without attaching every linked fact source", () => {
  const { base, images, apply } = fixture();
  const plan = apply();
  const item = plan.items[0];
  assert.deepEqual(item.marketingAssignment.referenceIndexes, [1]);
  assert.deepEqual(base.productInsights.confirmedFacts.find((fact) => fact.id === "control").referenceIndexes, [2]);
  assert.ok(item.marketingAssignment.factIds.includes("control"));
  assert.deepEqual(buildCreationItemReferenceImages(item, images, plan.referenceImageRoles).map((image) => image.referenceIndex), [1]);
});

test("verified text parameters do not force information cards into generation", () => {
  const { base, payload, apply } = fixture("spec-table");
  Object.assign(payload.items[0], { audience_ids: [], selling_point_ids: [], pain_point_ids: [], recommendation_ids: [], fact_ids: ["runtime", "battery"] });
  base.productInsights.confirmedFacts.find((fact) => fact.id === "runtime").referenceIndexes = [2, 3];
  const item = apply().items[0];
  assert.deepEqual(item.marketingAssignment.referenceIndexes, [1]);
  assert.ok(item.marketingAssignment.factIds.includes("runtime"));
});

test("a macro takes one sufficient visual source and stops after coverage", () => {
  const { base, payload, apply } = fixture("detail-macro");
  Object.assign(payload.items[0], { audience_ids: [], selling_point_ids: [], pain_point_ids: [], recommendation_ids: [], fact_ids: ["control"] });
  base.productInsights.confirmedFacts.find((fact) => fact.id === "control").referenceIndexes = [2, 3];
  assert.deepEqual(apply().items[0].marketingAssignment.referenceIndexes, [1, 2]);
  base.productInsights.confirmedFacts.find((fact) => fact.id === "control").referenceIndexes = [1, 2, 3];
  assert.deepEqual(apply().items[0].marketingAssignment.referenceIndexes, [1]);
});

test("explicit visual needs keep unique details and reject unknown provenance", () => {
  const { base, payload, apply } = fixture("scene-application");
  payload.items[0].reference_needs = [{ reference_index: 2, purpose: "detail", fact_ids: ["control"], reason: "主体图无法辨认的按键结构" }];
  assert.deepEqual(apply().items[0].marketingAssignment.referenceIndexes, [1, 2]);
  base.productInsights.confirmedFacts.find((fact) => fact.id === "control").referenceIndexes = [2, 3];
  payload.items[0].reference_needs.push({ reference_index: 3, purpose: "detail", fact_ids: ["control"], reason: "主体图无法辨认的按键结构" });
  assert.deepEqual(apply().items[0].marketingAssignment.referenceIndexes, [1, 2]);
  payload.items[0].reference_needs.pop();
  payload.items[0].reference_needs[0].fact_ids = ["heat"];
  assert.throws(() => applyCreationMarketingPlan(fixture().base, payload, { count: 4, referenceCount: 3, primaryIndex: 1, allowPartial: false }), /视觉|来源|reference_needs/u);
});

test("necessary views are not subject to a fixed eight-image cap", () => {
  const { base, payload } = fixture("multi-angle");
  payload.items = [payload.items[0]];
  Object.assign(payload.items[0], { audience_ids: [], selling_point_ids: [], pain_point_ids: [], recommendation_ids: [], fact_ids: [], reference_indexes: [] });
  payload.items[0].reference_needs = [];
  for (let index = 1; index <= 9; index += 1) {
    const id = "view-" + index;
    base.productInsights.confirmedFacts.push({ id, text: "来源确认的独立视面" + index, kind: "appearance", source: "reference", referenceIndexes: [index] });
    payload.items[0].fact_ids.push(id);
    payload.items[0].reference_needs.push({ reference_index: index, purpose: "view", fact_ids: [id], reason: "独立可见视面" + index });
  }
  const item = applyCreationMarketingPlan(base, payload, { count: 1, referenceCount: 9, primaryIndex: 1 }).items[0];
  assert.deepEqual(item.marketingAssignment.referenceIndexes, [1, 2, 3, 4, 5, 6, 7, 8, 9]);
});

test("one compound fact may need distinct visual details or opening states", () => {
  const { base, payload, apply } = fixture("detail-macro");
  base.productInsights.confirmedFacts.find((fact) => fact.id === "control").referenceIndexes = [2, 3];
  payload.items[0].reference_needs = [
    { reference_index: 2, purpose: "detail", fact_ids: ["control"], reason: "显示窗数字与表面归属" },
    { reference_index: 3, purpose: "detail", fact_ids: ["control"], reason: "另一张图才看清的按键边缘结构" },
  ];
  assert.deepEqual(apply().items[0].marketingAssignment.referenceIndexes, [1, 2, 3]);
  payload.items[0].reference_needs[0].purpose = payload.items[0].reference_needs[1].purpose = "state";
  payload.items[0].reference_needs[0].reason = "来源支持的开启状态";
  payload.items[0].reference_needs[1].reason = "来源支持的闭合状态";
  assert.deepEqual(apply().items[0].marketingAssignment.referenceIndexes, [1, 2, 3]);
});

test("identical bytes share a reference while same names with different bytes remain distinct", () => {
  const { base, payload, images, apply } = fixture("detail-macro");
  Object.assign(payload.items[0], { audience_ids: [], selling_point_ids: [], pain_point_ids: [], recommendation_ids: [], fact_ids: ["appearance", "control"] });
  payload.items[0].reference_needs = [{ reference_index: 2, purpose: "detail", fact_ids: ["control"], reason: "控制器近景" }];
  images[1].buffer = images[0].buffer;
  assert.deepEqual(apply().items[0].marketingAssignment.referenceIndexes, [1]);
  images[1].buffer = Buffer.from("unique-control-detail");
  images[1].filename = images[0].filename;
  assert.deepEqual(apply().items[0].marketingAssignment.referenceIndexes, [1, 2]);
  assert.deepEqual(base.productInsights.confirmedFacts.find((fact) => fact.id === "control").referenceIndexes, [2]);
});

test("unique visual evidence beyond the byte budget is rejected instead of dropped", () => {
  const { payload, images, base } = fixture("detail-macro");
  payload.items[0].reference_needs = [{ reference_index: 2, purpose: "detail", fact_ids: ["control"], reason: "必要按钮细节" }];
  images[1].byteLength = 7 * 1024 * 1024;
  assert.throws(() => applyCreationMarketingPlan(base, payload, {
    count: 4, referenceCount: 3, primaryIndex: 1, referenceImages: images, allowPartial: false,
  }), /预算/u);
});

test("new references and final prompts remain frozen through storage and repair", () => {
  const { apply, images } = fixture();
  const plan = apply();
  plan.marketingPlan.primaryReferenceIndex = 1;
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const stored = normalizeCreationSetManifest({ ...plan, setId: "minimal-reference-test", effectivePlan: frozen });
  for (const candidate of [frozen, stored, buildCreationRepairPlan(stored)]) {
    assert.deepEqual(candidate.items[0].referenceSelection, plan.items[0].referenceSelection);
    assert.equal(candidate.items[0].prompt, plan.items[0].prompt);
    assert.deepEqual(buildCreationItemReferenceImages(candidate.items[0], images, plan.referenceImageRoles).map((image) => image.referenceIndex), [1]);
  }
});

test("legacy frozen assignments retain the original reference list", () => {
  const { base, images } = fixture();
  const item = { itemId: "legacy", prompt: "历史冻结提示词", marketingAssignment: { referenceIndexes: [1, 2, 3] } };
  assert.deepEqual(buildCreationItemReferenceImages(item, images, base.referenceImageRoles), images);
});

function repeatedGripPlan() {
  const { base, payload, apply } = fixture();
  for (const [index, goal, evidence] of [[0, "确认骑行佩戴稳固", "袖口贴合"], [2, "确认按钮操作方便", "手背控制按钮"]]) {
    payload.items[index].image_type = "scene-application";
    payload.items[index].marketing_goal = goal;
    Object.assign(payload.items[index].creative_brief, {
      scene: "冬季城市摩托车通勤", action: "戴手套握住摩托车车把",
      framing: "手部与车把的近景", evidence_focus: evidence, new_information: goal, visual_form: "use-scene",
    });
  }
  return { base, plan: apply() };
}

test("different selling points cannot hide the same grip and framing", () => {
  const { plan } = repeatedGripPlan();
  const issues = auditCreationMarketingQuality(plan).issues;
  assert.ok(issues.some((issue) => issue.code === "duplicate-task" && issue.confidence === "high"));
  plan.items[2].marketingAssignment.creativeBrief.visual_form = "macro-evidence";
  plan.items[2].marketingAssignment.creativeBrief.framing = "单独按钮微距";
  assert.equal(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "duplicate-task"), false);
});

test("unresolved confirmed duplicates remain visible but cannot generate or repair", () => {
  const { plan } = repeatedGripPlan();
  const final = finalizeCreationMarketingQuality(plan, auditCreationMarketingQuality(plan));
  const pending = final.items.find((item) => item.evidenceRequirement?.code === "duplicate-task");
  assert.ok(pending);
  assert.equal(pending.enabled, false);
  assert.equal(final.items.length, 4);
  assert.equal(final.imageCount, 3);
  assert.equal(final.pendingAdjustmentCount, 1);
  assert.deepEqual(selectCreationRepairItems({ items: [pending] }), []);
  assert.deepEqual(selectCreationRepairItems({ items: [pending] }, { itemId: pending.itemId }), []);
  const guarded = applyCreationPlanEvidenceRequirements(final);
  assert.equal(guarded.items.find((item) => item.itemId === pending.itemId).evidenceBlocked, true);
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(guarded) });
  assert.equal(frozen.imageCount, 3);
  assert.equal(frozen.items.find((item) => item.itemId === pending.itemId).evidenceBlocked, true);
  delete frozen.items.find((item) => item.itemId === pending.itemId).evidenceBlocked;
  delete frozen.items.find((item) => item.itemId === pending.itemId).evidenceRequirement;
  assert.equal(applyCreationPlanEvidenceRequirements(frozen).items.find((item) => item.itemId === pending.itemId).evidenceBlocked, true);
});

test("selected labels keep original upload identities and explain each visual purpose", () => {
  const { payload, images, apply } = fixture("scene-application");
  payload.items[0].reference_needs = [{ reference_index: 3, purpose: "state", fact_ids: ["fingers"], reason: "本图必要的露指状态" }];
  const plan = apply();
  const selected = buildCreationItemReferenceImages(plan.items[0], images, plan.referenceImageRoles);
  const labels = buildCreationGenerationReferenceImageLabels(selected, plan.referenceImageRoles, plan.items[0]);
  assert.equal(labels.length, 2);
  assert.match(labels[1], /^Reference 3:/u);
  assert.match(labels[1], /Visual purpose: 本图必要的露指状态/u);
  assert.doesNotMatch(labels.join(" "), /Reference 2:/u);
});

test("changing the phone application does not create a distinct use photograph", () => {
  const { plan } = repeatedGripPlan();
  for (const [index, action] of [[0, "戴手套点按手机查看地图"], [2, "戴手套点击手机查看消息"]]) {
    Object.assign(plan.items[index].marketingAssignment.creativeBrief, { action, framing: "手部与手机近景" });
  }
  assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "duplicate-task" && issue.confidence === "high"));
});

test("CG and functional tasks cannot reuse the same pose and effect with a different title", () => {
  const { plan } = repeatedGripPlan();
  for (const index of [0, 2]) {
    plan.items[index].marketingAssignment.factIds.push("heat");
    Object.assign(plan.items[index].marketingAssignment.creativeBrief, { visual_form: index ? "functional-render" : "commercial-cg",
      action: "完整一双手套并排伸指", framing: "正视完整一双", effect_visual: "橙色体积热流围绕手套形成局部暖光",
    });
  }
  assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "duplicate-task" && issue.confidence === "high"));
  plan.items[2].marketingAssignment.creativeBrief.action = "以来源支持的弯指状态近距离展示功能作用";
  plan.items[2].marketingAssignment.creativeBrief.framing = "侧向取景并突出局部空间作用";
  assert.equal(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "duplicate-task"), false);
});

test("a smaller equivalent detail source can satisfy the same need within budget", () => {
  const { base, payload, images, apply } = fixture("detail-macro");
  Object.assign(payload.items[0], { audience_ids: [], selling_point_ids: [], pain_point_ids: [], recommendation_ids: [], fact_ids: ["control"] });
  base.productInsights.confirmedFacts.find((fact) => fact.id === "control").referenceIndexes = [2, 3];
  images[1].byteLength = 7 * 1024 * 1024;
  assert.deepEqual(apply().items[0].marketingAssignment.referenceIndexes, [1, 3]);
});

test("prompts cannot cite an image that was removed from their visual assignment", () => {
  const { base, payload } = fixture();
  payload.items[0].prompt += "参考图 3 的布局必须照搬。";
  assert.throws(() => applyCreationMarketingPlan(base, payload, { count: 4, referenceCount: 3, primaryIndex: 1, allowPartial: false }), /未选择的视觉参考/u);
});

test("bounded AI repair leaves confirmed repeated tasks pending and freezes the result", async () => {
  const { payload, images } = fixture();
  const { input } = marketingPlanFixture(4);
  input.referenceImageRoles = images.map((image, index) => ({ index: index + 1, filename: image.filename, role: index ? "material" : "reference-product" }));
  for (const index of [0, 2]) {
    payload.items[index].image_type = "scene-application";
    Object.assign(payload.items[index].creative_brief, { scene: "冬季城市骑行", action: "戴手套握车把", framing: "手部与车把近景", visual_form: "use-scene" });
  }
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages: images, config: { baseUrl: "https://example.test/v1", apiKey: "test", responsesModel: "test" },
    fetchImpl: async () => { calls += 1; return Response.json({ output_text: JSON.stringify(calls === 1 ? payload : { suite_strategy: payload.suite_strategy, items: [payload.items[2]] }) }); },
  });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 3);
  assert.equal(plan.marketingPlan.validation.pendingCount, 1);
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const rows = frozen.items.map((item) => ({ item_id: item.itemId, image_type: item.imageType, title: item.title, marketing_goal: item.marketingAssignment.goal,
    prompt: item.prompt, creative_brief: item.marketingAssignment.creativeBrief, fact_ids: item.marketingAssignment.factIds, reference_indexes: item.marketingAssignment.referenceIndexes,
    audience_ids: item.marketingAssignment.audienceIds, selling_point_ids: item.marketingAssignment.sellingPointIds, pain_point_ids: item.marketingAssignment.painPointIds, recommendation_ids: item.marketingAssignment.recommendationIds,
  }));
  const checked = applyCreationPlanEvidenceRequirements(applyCreationMarketingPlan(frozen, { items: rows }, { count: 4, referenceCount: 3, primaryIndex: 1, referenceImages: images, allowPartial: false }));
  assert.equal(checked.imageCount, 3);
  assert.equal(checked.items.filter((item) => item.evidenceBlocked).length, 1);
  assert.deepEqual(checked.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
});

test("CG and functional rendering explicitly combine white backgrounds, recomposition and effects", () => {
  for (const input of [gloveAnalysisInput({ selectedRoles: ["atmosphere", "effect-comparison"] }), { productName: "手套", selectedRoles: ["atmosphere", "effect-comparison"] }]) {
    for (const item of buildCreationPlan(input).items) {
      assert.match(item.prompt, /pure white|RGB 255/iu);
      assert.match(item.prompt, /recompose|recomposition/iu);
      assert.match(item.prompt, /pose|gesture/iu);
      assert.match(item.prompt, /light|volumetric|flow/iu);
      assert.match(item.prompt, /not.*(?:overlay|filter)|not.*source canvas/iu);
    }
  }
});

test("AI functional renders get the same white reconstruction boundary while strict catalog stays effect-free", () => {
  const { payload, apply } = fixture();
  payload.items[1].creative_brief.visual_form = "functional-render";
  const plan = apply();
  assert.match(plan.items[1].prompt, /pure white|RGB 255/iu);
  assert.match(plan.items[1].prompt, /recompose|recomposition/iu);
  assert.ok(plan.items[1].prompt.includes(payload.items[1].creative_brief.effect_visual));
  assert.match(plan.items[0].prompt, /STRICT WHITE PRODUCT/iu);
  assert.match(plan.items[0].prompt, /No.*(?:heat|glow|effect)/iu);
});
