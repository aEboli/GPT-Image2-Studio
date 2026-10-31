import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext, CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { auditCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { gloveAnalysisInput } from "./fixtures/creation-glove-insights.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

function commercialCgFixture() {
  const { input, payload } = marketingPlanFixture(4);
  Object.assign(payload.items[3], {
    image_type: "ownership-atmosphere", title: "暖意可见", marketing_goal: "通过无字商业渲染感知加热的暖意",
    audience_ids: [], selling_point_ids: [], pain_point_ids: [], recommendation_ids: [], fact_ids: ["appearance", "heat"],
    prompt: "完整手套保留参考的面料、结构与配色，暖橙色体积热流围绕主体形成前后遮挡和局部暖光，商品清晰立体；纯渲染，无文字。",
    creative_brief: { purpose: "感知暖意", scene: "暖色商业渲染空间", action: "加热作用的概念表现", framing: "完整商品与立体热流",
      evidence_focus: "已确认的加热功能", visual_form: "commercial-cg", text_density: "none", new_information: "加热产生的直观暖意与空间质感",
      effect_visual: "暖橙色体积热流围绕主体形成前后遮挡和局部暖光" },
  });
  return { input, payload };
}

test("commercial CG carries heating evidence and a text-free effect direction", () => {
  const plan = buildCreationPlan(gloveAnalysisInput({ selectedRoles: ["atmosphere", "effect-comparison"] }));
  const cg = plan.items.find((item) => item.role === "atmosphere");
  assert.equal(cg.textPolicy, "none");
  assert.equal(cg.contentAssignment.kind, "commercial-cg");
  assert.ok(cg.contentAssignment.factIds.includes("heat"));
  assert.match(cg.prompt, /\[heat;/u);
  assert.match(cg.prompt, /volumetric heat flow/iu);
  assert.match(cg.prompt, /No added text/iu);
  assert.doesNotMatch(cg.prompt, /optional concise buyer-focused copy|Choose any concise canvas copy|new text in|concise source-grounded labels/iu);
  assert.equal(plan.items.find((item) => item.role === "effect-comparison").contentAssignment.kind, "functional-render");
});

test("commercial CG stays text-free without product analysis", () => {
  for (const productName of ["加热手套", "陶瓷杯"]) {
    const cg = buildCreationPlan({ productName, selectedRoles: ["atmosphere"] }).items[0];
    assert.equal(cg.textPolicy, "none");
    assert.match(cg.prompt, /commercial (?:3D\/)?CG(?:I)? product render/iu);
    assert.match(cg.prompt, /No added text/iu);
    assert.doesNotMatch(cg.prompt, /optional concise buyer-focused copy|Choose any concise canvas copy|new text in/iu);
  }
});

test("commercial CG retains heating evidence ahead of abundant appearance details", () => {
  const input = gloveAnalysisInput({ selectedRoles: ["atmosphere"] });
  input.productInsights.confirmed_facts.unshift(...Array.from({ length: 5 }, (_, index) => ({
    id: `surface-${index}`, text: `外观细节${index}：${"参考可见的织物纹理与接缝。".repeat(35)}`,
    kind: "appearance", source: "reference", reference_indexes: [1],
  })));
  const cg = buildCreationPlan(input).items[0];
  assert.ok(cg.contentAssignment.factIds.includes("heat"));
  assert.match(cg.prompt, /\[heat;/u);
  assert.match(cg.prompt, /base palette must not suppress/iu);
});

test("commercial CG does not infer a heating fact from the product name", () => {
  const input = gloveAnalysisInput({ selectedRoles: ["atmosphere"] });
  input.productInsights.confirmed_facts = input.productInsights.confirmed_facts.filter((fact) => fact.kind === "appearance");
  const cg = buildCreationPlan(input).items[0];
  assert.equal(cg.evidenceBlocked, false);
  assert.equal(cg.textPolicy, "none");
  assert.equal(cg.contentAssignment.factIds.includes("heat"), false);
  assert.match(cg.prompt, /no confirmed function/iu);
});

test("AI commercial CG enforces no text and retains its effect instruction", () => {
  const { input, payload } = commercialCgFixture();
  const base = buildCreationPlan(input);
  const context = buildCreationMarketingContext(input, base);
  assert.equal(context.allowed_image_types.find((item) => item.image_type === "ownership-atmosphere").textPolicy, "none");
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /commercial-cg.*text_density.*none/u);
  const cg = applyCreationMarketingPlan(base, payload, { count: 4, referenceCount: 1, primaryIndex: 1 }).items.find((item) => item.role === "atmosphere");
  assert.equal(cg.textPolicy, "none");
  assert.match(cg.prompt, /No added text/iu);
  assert.ok(cg.prompt.includes(payload.items[3].creative_brief.effect_visual));
});

test("AI commercial CG rejects added copy instead of silently accepting a poster", () => {
  const { input, payload } = commercialCgFixture();
  payload.items[3].creative_brief.text_density = "minimal";
  payload.items[3].prompt += "画布标题：温暖随行。";
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
  assert.equal(plan.items.some((item) => item.role === "atmosphere"), false);
  assert.ok(plan.marketingPlan.validation.removedItems.some((item) => /纯渲染.*none/u.test(item.reason)));
  assert.throws(() => applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1, allowPartial: false }), /纯渲染.*none/u);
});

test("AI commercial CG effect needs confirmed function evidence", () => {
  const { input, payload } = commercialCgFixture();
  payload.items[3].fact_ids = ["appearance"];
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
  const cg = plan.items.find((item) => item.role === "atmosphere");
  assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "unsupported-functional-render" && issue.itemId === cg.itemId));
});

test("AI commercial CG sends the planned effect to generation even when authored copy omits it", () => {
  const { input, payload } = commercialCgFixture();
  payload.items[3].prompt = "完整手套保留参考的面料、结构与配色，以商业布光表现立体体积；纯渲染，无文字。";
  const cg = applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 }).items.find((item) => item.role === "atmosphere");
  assert.ok(cg.prompt.includes(payload.items[3].creative_brief.effect_visual));
});

test("manual CG and frozen AI prompts retain their original wording", () => {
  const input = gloveAnalysisInput({ platformItemOverrides: [{ slotKey: "universal:ownership-atmosphere", prompt: "用户锁定的提示词。" }] });
  const base = buildCreationPlan(input);
  const manual = base.items.find((item) => item.role === "atmosphere");
  assert.equal(manual.prompt, "用户锁定的提示词。");
  assert.ok(buildCreationMarketingContext(input, base).locked_items.some((item) => item.item_id === manual.itemId && item.prompt === manual.prompt));
  const fixture = commercialCgFixture();
  const frozen = applyCreationMarketingPlan(buildCreationPlan(fixture.input), fixture.payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
  const original = frozen.items.find((item) => item.role === "atmosphere");
  original.prompt = fixture.payload.items[3].prompt = "历史冻结 CG，含原有标题。";
  original.textPolicy = "concise";
  fixture.payload.items[3].creative_brief.text_density = "minimal";
  const restored = applyCreationMarketingPlan(frozen, fixture.payload, { count: 4, referenceCount: 1, primaryIndex: 1, allowPartial: false });
  const cg = restored.items.find((item) => item.role === "atmosphere");
  assert.equal(cg.prompt, original.prompt);
  assert.equal(cg.textPolicy, "concise");
});
