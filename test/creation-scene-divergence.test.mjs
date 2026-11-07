import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext, CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { auditCreationMarketingQuality, finalizeCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { createPromptAgentRequestBody, CREATION_REFERENCE_ANALYSIS_MODE } from "../lib/prompt-agent.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { allocateCreationProductScenes } from "../lib/creation-product-insights.mjs";

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }];
function scenes() {
  const fixture = marketingPlanFixture(6);
  const framings = ["俯拍手部与车把的近景", "侧面全景，用户与车辆在道路上", "正面中景，用户与车把的关系", "过肩视角近景，手部与车把"];
  for (let index = 2; index < 6; index += 1) {
    const row = fixture.payload.items[index];
    row.image_type = "scene-application";
    row.audience_ids = []; row.selling_point_ids = []; row.pain_point_ids = []; row.recommendation_ids = [];
    row.fact_ids = ["appearance", "heat"];
    row.prompt = "以真实手套创作不同的户外骑行画面，" + framings[index - 2] + "，保留商品身份。";
    Object.assign(row.creative_brief, { visual_form: "use-scene", scene: "冬季城市骑行", action: "戴手套握住车把",
      framing: framings[index - 2], evidence_focus: "骑行时的真实手部关系", new_information: "相同商品价值的不同使用体验" });
  }
  return fixture;
}
const apply = ({ input, payload }) => applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 6, referenceCount: 1, primaryIndex: 1 });

test("more than two creative scenes in one action group are allowed when camera relationships differ", () => {
  const plan = apply(scenes());
  const quality = auditCreationMarketingQuality(plan);
  assert.deepEqual(quality.issues, []);
  const final = finalizeCreationMarketingQuality(plan, quality);
  assert.equal(final.imageCount, 6);
  assert.equal(final.pendingAdjustmentCount, 0);
});

test("different creative actions may share evidence and a common photographic layout", () => {
  const fixture = scenes();
  const actions = ["握住车把骑行", "握住牵引绳遛狗", "按下相机快门", "整理营地装备"];
  for (const [index, row] of fixture.payload.items.slice(2).entries()) {
    Object.assign(row.creative_brief, { action: actions[index], framing: "手部操作近景", scene: "各自合理的户外活动情境" });
  }
  assert.deepEqual(auditCreationMarketingQuality(apply(fixture)).issues, []);
});

test("genuinely repeated scenes still receive duplicate-task issues", () => {
  const fixture = scenes();
  fixture.payload.items[3].creative_brief.framing = fixture.payload.items[2].creative_brief.framing;
  assert.ok(auditCreationMarketingQuality(apply(fixture)).issues.some((issue) => issue.code === "duplicate-task" && issue.confidence === "high"));
});

test("local scene allocation does not treat an action group as a single-use resource", () => {
  const fixture = scenes();
  const usageScenarios = fixture.payload.items.slice(2).map((row, index) => ({ id: "creative-" + index,
    environment: row.creative_brief.scene, action: row.creative_brief.action, framing: row.creative_brief.framing,
    actionGroup: "handlebar-grip", factIds: ["appearance"], people: "hands", painPointIds: [] }));
  const allocated = allocateCreationProductScenes(Array.from({ length: 4 }, () => ({ role: "scene" })), { usageScenarios, confirmedFacts: [] });
  assert.equal(allocated.filter(Boolean).length, 4);
});

test("scene allocation recognizes identical camera descriptions despite whitespace", () => {
  const usageScenarios = ["side view close-up", " side  view close-up "].map((framing, index) => ({
    id: "same-camera-" + index, action: "戴手套握住车把", actionGroup: "handlebar-grip", framing,
  }));
  const allocated = allocateCreationProductScenes([{ role: "scene" }, { role: "scene" }], { usageScenarios });
  assert.equal(allocated.filter(Boolean).length, 1);
});

test("source facts ground the product while scene suggestions are not a whitelist", () => {
  const fixture = scenes();
  const context = buildCreationMarketingContext(fixture.input, buildCreationPlan(fixture.input), referenceImages);
  assert.equal(context.quality_requirements.sceneDivergence, "creative-context");
  assert.ok(CREATION_MARKETING_PLAN_INSTRUCTION.includes("场景不必在源图中出现"));
  assert.ok(CREATION_MARKETING_PLAN_INSTRUCTION.includes("不是白名单"));
  const body = createPromptAgentRequestBody({ images: referenceImages, mode: CREATION_REFERENCE_ANALYSIS_MODE, responsesModel: "test" });
  assert.ok(body.input[0].content[0].text.includes("场景不必在源图中出现"));
  assert.ok(apply(fixture).items[2].prompt.includes("need not appear in the source images"));
});

test("novel scenes outside analysis suggestions are accepted in one planning call", async () => {
  const fixture = scenes();
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages,
    config: { baseUrl: "https://example.test/v1", responsesModel: "scene-divergence-test", apiKey: "test" },
    fetchImpl: async () => { calls += 1; return Response.json({ output_text: JSON.stringify(fixture.payload) }); },
  });
  assert.equal(calls, 1);
  assert.equal(plan.imageCount, 6);
  assert.equal(plan.marketingPlan.quality.repairRounds, 0);
});
