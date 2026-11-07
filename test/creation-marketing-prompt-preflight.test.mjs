import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { applyCreationMarketingPlan, CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { auditCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }];
const config = { baseUrl: "https://example.test/v1", responsesModel: "prompt-preflight-test", apiKey: "test" };
function draft() {
  const fixture = marketingPlanFixture(4);
  for (const [index, action, framing] of [[2, "握住车把骑行", "俯拍手部近景"], [3, "整理营地装备", "侧面全景"]]) {
    const row = fixture.payload.items[index];
    row.image_type = "scene-application";
    Object.assign(row.creative_brief, { visual_form: "use-scene", action, framing });
    row.prompt = 'Image #' + (index + 1) + '. Photograph the reference gloves gripping bicycle handlebars, overhead close-up, with natural morning light and the actual fabric and controls preserved. Overlay text: "' + (index === 2 ? 'City ride' : 'Weekend camp') + '".';
  }
  return fixture;
}
const apply = ({ input, payload }) => applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
const promptIssues = (plan) => auditCreationMarketingQuality(plan).issues.filter((issue) => issue.code === "duplicate-task" && issue.basis === "prompt");

test("different briefs cannot disguise identical visual prompts behind numbering and captions", () => {
  const issues = promptIssues(apply(draft()));
  assert.equal(issues.length, 1);
  assert.equal(issues[0].itemId, "ai-4");
  assert.equal(issues[0].similarItemId, "ai-3");
  assert.equal(issues[0].confidence, "high");
});

test("genuinely different visual directions survive common product and style instructions", () => {
  const fixture = draft();
  fixture.payload.items[3].prompt = "Photograph the reference gloves arranging camping equipment, side-on wide view, with natural morning light and the actual fabric and controls preserved.";
  assert.deepEqual(promptIssues(apply(fixture)), []);
});

test("Chinese image numbers and captions cannot hide the same visual direction", () => {
  const fixture = draft();
  for (const [index, caption] of [[2, "骑行"], [3, "露营"]]) {
    fixture.payload.items[index].prompt = "第" + (index + 1) + "个独立营销画面：俯拍戴参考手套握车把的手部近景，保持真实布料与控制器。画布文案：“" + caption + "”。";
  }
  assert.equal(promptIssues(apply(fixture)).length, 1);
});

test("edited final prompts take precedence over stale authored metadata", () => {
  const plan = apply(draft());
  plan.items[3].prompt = "Photograph the reference gloves arranging camping equipment in a side-on wide view.";
  assert.deepEqual(promptIssues(plan), []);
});

test("copying a final prompt cannot hide behind distinct authored metadata", () => {
  const fixture = draft();
  fixture.payload.items[3].prompt = "Photograph the reference gloves arranging camping equipment in a side-on wide view.";
  const plan = apply(fixture);
  plan.items[3].prompt = plan.items[2].prompt;
  assert.equal(promptIssues(plan).length, 1);
});

test("preflight retains real numerical differences rather than stripping all digits", () => {
  const fixture = draft();
  fixture.payload.items[2].prompt = "Photograph the gloves and 3 travel bags arranged beside them.";
  fixture.payload.items[3].prompt = "Photograph the gloves and 4 travel bags arranged beside them.";
  assert.deepEqual(promptIssues(apply(fixture)), []);
});

test("planning instruction requires visible differences before image generation", () => {
  assert.ok(CREATION_MARKETING_PLAN_INSTRUCTION.includes("提示词阶段完成差异化"));
  assert.ok(CREATION_MARKETING_PLAN_INSTRUCTION.includes("不能把差异留给生图模型临场发挥"));
});

for (const repaired of [true, false]) {
  test("visual prompt duplicates " + (repaired ? "are rewritten before any image call" : "stay out of generation after bounded text repairs"), async () => {
    const fixture = draft();
    const good = marketingPlanFixture(4).payload.items[3];
    let calls = 0;
    const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages, config, fetchImpl: async (_url, init) => {
      calls += 1;
      const body = JSON.parse(init.body);
      assert.equal(body.text.format.name, "creation_marketing_plan_json");
      assert.ok(!(body.tools || []).some((tool) => tool.type === "image_generation"));
      if (calls === 1) return Response.json({ output_text: JSON.stringify(fixture.payload) });
      const context = JSON.parse(body.input[0].content.find((entry) => entry.type === "input_text" && entry.text.startsWith("{")).text);
      assert.deepEqual(context.repair_request.target_item_ids, ["ai-4"]);
      assert.ok(context.repair_request.issues.some((issue) => issue.basis === "prompt"));
      assert.equal(context.repair_request.accepted_items.find((row) => row.item_id === "ai-3").prompt, fixture.payload.items[2].prompt);
      assert.ok(!context.repair_request.accepted_items.find((row) => row.item_id === "ai-1").prompt);
      return Response.json({ output_text: JSON.stringify({ suite_strategy: fixture.payload.suite_strategy, items: [repaired ? good : fixture.payload.items[3]] }) });
    } });
    assert.equal(calls, repaired ? 2 : 3);
    assert.equal(plan.imageCount, repaired ? 4 : 3);
    assert.equal(plan.pendingAdjustmentCount, repaired ? 0 : 1);
    assert.deepEqual(plan.items.slice(0, 3).map((row) => row.prompt), apply(fixture).items.slice(0, 3).map((row) => row.prompt));
    if (!repaired) {
      const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
      assert.equal(frozen.items[3].enabled, false);
      assert.equal(frozen.items[3].evidenceBlocked, true);
    }
  });
}

test("distinct prompts still need one planning call without an extra audit model", async () => {
  const fixture = marketingPlanFixture(4);
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages, config, fetchImpl: async () => {
    calls += 1;
    return Response.json({ output_text: JSON.stringify(fixture.payload) });
  } });
  assert.equal(calls, 1);
  assert.equal(plan.imageCount, 4);
  assert.equal(plan.marketingPlan.quality.repairRounds, 0);
});
