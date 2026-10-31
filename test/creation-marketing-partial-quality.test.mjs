import test from "node:test";
import assert from "node:assert/strict";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { applyCreationMarketingPlan } from "../lib/creation-marketing-plan.mjs";
import { buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }];
const config = { baseUrl: "https://example.test/v1", responsesModel: "partial-quality-test", apiKey: "test" };
const response = (payload) => Response.json({ output_text: JSON.stringify(payload) });

function assertFrozen(plan) {
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const stored = normalizeCreationSetManifest({ ...plan, setId: "partial-quality", effectivePlan: frozen });
  for (const candidate of [frozen, stored, buildCreationRepairPlan(stored)]) {
    assert.deepEqual(candidate.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
    assert.deepEqual(candidate.marketingPlan.quality, plan.marketingPlan.quality);
  }
  const payload = { suite_strategy: plan.marketingPlan.suiteStrategy, items: plan.items.filter((item) => item.itemKind === "carousel").map((item) => ({
    item_id: item.itemId, image_type: item.imageType, title: item.title, prompt: item.prompt, marketing_goal: item.marketingAssignment.goal,
    fact_ids: item.marketingAssignment.factIds, reference_indexes: item.marketingAssignment.referenceIndexes,
    creative_brief: item.marketingAssignment.creativeBrief,
  })) };
  const checked = applyCreationMarketingPlan(plan, payload, { count: plan.imageCount, constraintCount: plan.marketingPlan.validation.requestedCount,
    allowPartial: false, sourceIndexes: payload.items.map((_, index) => plan.items[index].marketingAssignment.sourceIndex),
    referenceCount: 1, primaryIndex: 1, selectedRoles: plan.marketingPlan.selectedRoles, lockedItems: plan.marketingPlan.lockedItems });
  assert.deepEqual(checked.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
}

test("unresolved visual quality suggestions remain usable after the bounded repair budget", async () => {
  const { input, payload } = marketingPlanFixture(4);
  payload.items[1].creative_brief.effect_visual = "";
  payload.items[1].prompt = "完整商品白底摄影，旁边列出已有参数。";
  const events = [];
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, onProgress: (event) => events.push(event), fetchImpl: async () => {
    calls += 1;
    return response(calls === 1 ? payload : { suite_strategy: payload.suite_strategy, items: [payload.items[1]] });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 4);
  assert.notEqual(plan.canGenerate, false);
  assert.equal(plan.marketingPlan.quality.status, "warning");
  assert.ok(plan.warnings.some((warning) => warning.code === "marketing-quality-functional-proof-missing"));
  assert.equal(events.at(-1).stage, "complete");
  assert.match(events.at(-1).message, /建议|提示/);
  assertFrozen(plan);
});

test("invalid suite metadata cannot block or contaminate valid image prompts", async () => {
  const { input, payload } = marketingPlanFixture(4);
  payload.suite_strategy.primary_fact_ids = ["invented-temperature"];
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => {
    calls += 1;
    return response(calls === 1 ? payload : { suite_strategy: payload.suite_strategy, items: [] });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 4);
  assert.equal(plan.marketingPlan.suiteStrategy, null);
  assert.ok(plan.warnings.some((warning) => /invented-temperature/.test(warning.message)));
  assertFrozen(plan);
});

function unsupportedFixture(count = 4) {
  const { input, payload } = marketingPlanFixture(count);
  const facts = input.productInsights.confirmed_facts.map((fact) => ({ ...fact, kind: "appearance" }));
  input.productInsights.confirmed_facts = facts;
  payload.product_insights.confirmed_facts = facts;
  payload.suite_strategy = { core_buying_reason: "核对已确认外观", primary_fact_ids: ["appearance"], functional_proofs: [] };
  const badIndex = count === 1 ? 0 : 1;
  payload.items[badIndex].creative_brief.visual_form = "functional-render";
  return { input, payload, badIndex };
}

test("one unsupported functional image is excluded while the remaining images stay generatable", async () => {
  const { input, payload, badIndex } = unsupportedFixture();
  const events = [];
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, onProgress: (event) => events.push(event), fetchImpl: async () => {
    calls += 1;
    return response(calls === 1 ? payload : { suite_strategy: payload.suite_strategy, items: [payload.items[badIndex]] });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 3);
  assert.equal(plan.totalPlannedItemCount, 3);
  assert.ok(!plan.items.some((item) => item.itemId === payload.items[badIndex].item_id));
  assert.deepEqual(plan.items.map((item) => item.marketingAssignment.sourceIndex), [1, 3, 4]);
  assert.equal(plan.marketingPlan.validation.acceptedCount, 3);
  assert.equal(plan.marketingPlan.validation.removedItems[0].sourceIndex, 2);
  assert.match(plan.marketingPlan.validation.removedItems[0].reason, /功能依据/);
  assert.equal(events.at(-1).stage, "partial");
  assertFrozen(plan);
});

test("quality repair network failure keeps an already valid draft usable", async () => {
  const { input, payload } = marketingPlanFixture(4);
  payload.items[1].creative_brief.effect_visual = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => {
    calls += 1;
    if (calls > 1) throw new Error("repair unavailable");
    return response(payload);
  } });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 4);
  assert.equal(plan.marketingPlan.quality.status, "warning");
  assert.ok(plan.marketingPlan.quality.repairs.every((repair) => repair.rejection));
});

test("no usable carousel images still produces a specific failure", async () => {
  const { input, payload } = unsupportedFixture(1);
  await assert.rejects(requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => response(payload) }), /没有可用|无可用/);
});
