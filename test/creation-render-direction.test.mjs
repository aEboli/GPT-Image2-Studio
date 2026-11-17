import test from "node:test";
import assert from "node:assert/strict";
import { applyCreationMarketingPlan } from "../lib/creation-marketing-plan.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { auditCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { gloveAnalysisInput } from "./fixtures/creation-glove-insights.mjs";

const apply = (input, payload) => applyCreationMarketingPlan(buildCreationPlan(input), payload, {
  count: payload.items.length, referenceCount: 1, primaryIndex: 1,
});

test("localized functional-render labels retain executable functional coverage", () => {
  for (const label of ["功能效果表现", "功能效果渲染图"]) {
    const { input, payload } = marketingPlanFixture(4);
    payload.items[1].creative_brief.visual_form = label;
    const plan = apply(input, payload);
    assert.equal(plan.items[1].marketingAssignment.creativeBrief.visual_form, "functional-render");
    assert.equal(auditCreationMarketingQuality(plan).functionalCoverage.covered, true);
    assert.ok(plan.items[1].prompt.includes(payload.items[1].creative_brief.effect_visual));
  }
});

test("localized commercial-CG labels preserve their separate text-free task", () => {
  const { input, payload } = marketingPlanFixture(4);
  Object.assign(payload.items[3], { image_type: "ownership-atmosphere" });
  Object.assign(payload.items[3].creative_brief, { visual_form: "商业 CG 渲染图", text_density: "none", effect_visual: "" });
  const plan = apply(input, payload);
  const cg = plan.items[3];
  assert.equal(cg.marketingAssignment.creativeBrief.visual_form, "commercial-cg");
  assert.equal(cg.textPolicy, "none");
  assert.equal(auditCreationMarketingQuality(plan).functionalCoverage.covered, true);
  assert.equal(plan.items[1].role, "effect-comparison");
});

test("localized functional rendering survives the full planning audit without unnecessary repairs", async () => {
  const { input, payload } = marketingPlanFixture(4);
  payload.items[1].creative_brief.visual_form = "功能效果渲染图";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({
    input,
    referenceImages: [{ filename: "gloves.png", mimeType: "image/png", base64: "Z2xvdmVz", buffer: Buffer.from("gloves") }],
    config: { baseUrl: "http://localhost:9/v1", apiKey: "test-only", responsesModel: "test-model" },
    fetchImpl: async () => {
      calls += 1;
      return new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { headers: { "content-type": "application/json" } });
    },
  });
  assert.equal(calls, 1);
  assert.equal(plan.items.length, 4);
  assert.equal(plan.marketingPlan.quality.functionalCoverage.covered, true);
  assert.equal(plan.marketingPlan.quality.repairRounds, 0);
  assert.equal(plan.marketingPlan.quality.status, "passed");
});

test("normalizing a localized form does not supply missing functional evidence", () => {
  const { input, payload } = marketingPlanFixture(4);
  const row = payload.items[1];
  row.creative_brief.visual_form = "功能效果渲染图";
  row.fact_ids = ["appearance"];
  row.audience_ids = row.selling_point_ids = row.pain_point_ids = row.recommendation_ids = [];
  const plan = apply(input, payload);
  assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) =>
    issue.code === "unsupported-functional-render" && issue.itemId === row.item_id));
});

test("a functional slot cannot turn an explicitly photographic task into functional proof", () => {
  const { input, payload } = marketingPlanFixture(4);
  payload.items[1].creative_brief.visual_form = "product-photograph";
  const plan = apply(input, payload);
  assert.equal(plan.items[1].marketingAssignment.creativeBrief.visual_form, "product-photograph");
  assert.equal(auditCreationMarketingQuality(plan).functionalCoverage.covered, false);
});

test("AI functional renders explicitly build product volume instead of merely adding an overlay", () => {
  const { input, payload } = marketingPlanFixture(4);
  const item = apply(input, payload).items[1];
  assert.match(item.prompt, /sculpted 3D\/CG asset/iu);
  assert.match(item.prompt, /not a photographic cutout with decorative light trails/iu);
  assert.match(item.prompt, /material-specific roughness/iu);
  assert.match(item.prompt, /RGB 255\/255\/255/u);
});

test("template functional renders adapt photographic styles to supported dimensional effects", () => {
  for (const withAnalysis of [false, true]) {
    const input = withAnalysis ? gloveAnalysisInput({ selectedRoles: ["effect-comparison"] })
      : { productName: "电加热手套", sellingPoints: "已确认的加热功能", selectedRoles: ["effect-comparison"] };
    const item = buildCreationPlan(input).items[0];
    assert.match(item.prompt, /sculpted 3D\/CG asset/iu);
    assert.match(item.prompt, /base palette must not suppress/iu);
    assert.match(item.prompt, /functional CG composition/iu);
  }
});

test("frozen AI plans preserve their original localized brief and prompt", () => {
  const { input, payload } = marketingPlanFixture(4);
  const plan = apply(input, payload);
  const original = plan.items[1];
  original.marketingAssignment.creativeBrief.visual_form = "功能效果渲染图";
  const frozenPayload = { ...payload, items: plan.items.map((item) => ({
    ...payload.items[item.marketingAssignment.sourceIndex - 1], prompt: item.prompt,
    creative_brief: structuredClone(item.marketingAssignment.creativeBrief),
  })) };
  const restored = applyCreationMarketingPlan(plan, frozenPayload, { count: 4, referenceCount: 1, primaryIndex: 1, allowPartial: false });
  assert.equal(restored.items[1].prompt, original.prompt);
  assert.equal(restored.items[1].marketingAssignment.creativeBrief.visual_form, "功能效果渲染图");
});
