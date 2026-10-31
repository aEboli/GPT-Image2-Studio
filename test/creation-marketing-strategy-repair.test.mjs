import test from "node:test";
import assert from "node:assert/strict";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { applyCreationMarketingPlan } from "../lib/creation-marketing-plan.mjs";
import { applyCreationPlanEvidenceRequirements, buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }];
const config = { baseUrl: "https://example.test/v1", responsesModel: "strategy-test", apiKey: "test" };
const response = (payload) => Response.json({ output_text: JSON.stringify(payload) });
const contextOf = (init) => JSON.parse(JSON.parse(init.body).input[0].content[1].text);

for (const [name, corrupt] of [
  ["unknown primary facts", (strategy) => { strategy.primary_fact_ids = ["invented-temperature"]; }],
  ["missing buying reason", (strategy) => { strategy.core_buying_reason = ""; }],
  ["appearance facts used as a function", (strategy) => { strategy.functional_proofs[0].fact_ids = ["appearance"]; }],
  ["missing strategy", (_strategy, payload) => { delete payload.suite_strategy; }],
  ["missing primary function in strategy", (strategy) => { strategy.primary_fact_ids = ["appearance"]; }],
  ["missing function notes with a valid functional image", (strategy) => { strategy.functional_proofs = []; }],
]) {
  test(`${name} repairs the strategy and preserves every accepted image`, async () => {
    const { input, payload } = marketingPlanFixture(4);
    const expected = applyCreationPlanEvidenceRequirements(applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 }));
    const initial = structuredClone(payload);
    corrupt(initial.suite_strategy, initial);
    const events = [];
    let calls = 0;
    const plan = await requestCreationMarketingPlan({ input, referenceImages, config, onProgress: (event) => events.push(event), fetchImpl: async (_url, init) => {
      calls += 1;
      if (calls === 1) return response(initial);
      const context = contextOf(init);
      assert.equal(context.task_count, 0);
      assert.equal(context.repair_request.strategy_only, true);
      assert.deepEqual(context.repair_request.target_item_ids, []);
      assert.equal(context.repair_request.accepted_items.length, 4);
      const schema = JSON.parse(init.body).text.format.schema;
      assert.equal(schema.properties.items.minItems, 0);
      assert.equal(schema.properties.items.maxItems, 0);
      return response({ suite_strategy: payload.suite_strategy, items: [] });
    } });
    assert.equal(calls, 2);
    assert.equal(plan.marketingPlan.quality.repairRounds, 1);
    assert.deepEqual(plan.marketingPlan.quality.issues, []);
    assert.deepEqual(plan.items, expected.items);
    assert.deepEqual(plan.marketingPlan.suiteStrategy, expected.marketingPlan.suiteStrategy);
    assert.ok(events.some((event) => event.stage === "repairing" && /策略/.test(event.message)));
    assert.equal(events.at(-1).stage, "complete");
    assert.deepEqual(buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) }).items, plan.items);
  });
}

test("strategy-only repair cannot rewrite accepted images and shares the two-round budget", async () => {
  const { input, payload } = marketingPlanFixture(4);
  const initial = structuredClone(payload);
  initial.suite_strategy.primary_fact_ids = ["invented-temperature"];
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return response(initial);
    if (calls === 2) return response({ suite_strategy: payload.suite_strategy, items: [payload.items[0]] });
    assert.match(contextOf(init).repair_request.previous_rejection, /指定图片 ID/);
    return response({ suite_strategy: payload.suite_strategy, items: [] });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.marketingPlan.quality.repairRounds, 2);
  assert.match(plan.marketingPlan.quality.repairs[0].rejection, /指定图片 ID/);
});

test("unresolved strategy references become visible advice while valid images remain usable", async () => {
  const { input, payload } = marketingPlanFixture(4);
  payload.suite_strategy.primary_fact_ids = ["invented-temperature"];
  const events = [];
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, onProgress: (event) => events.push(event), fetchImpl: async () => {
    calls += 1;
    return response(calls === 1 ? payload : { suite_strategy: payload.suite_strategy, items: [] });
  } });
  assert.equal(plan.marketingPlan.quality.repairRounds, 2);
  assert.equal(plan.marketingPlan.quality.status, "warning");
  assert.equal(plan.marketingPlan.suiteStrategy, null);
  assert.ok(plan.warnings.some((warning) => /invented-temperature/.test(warning.message)));
  assert.equal(calls, 3);
  assert.equal(events.at(-1).stage, "complete");
});

test("an empty initial suite still fails instead of being accepted as strategy repair", async () => {
  const { input, payload } = marketingPlanFixture(4);
  let calls = 0;
  await assert.rejects(requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => {
    calls += 1;
    return response({ suite_strategy: payload.suite_strategy, items: [] });
  } }), /缺少非空 items/);
  assert.equal(calls, 2);
});

test("strategy-only repair accepts streamed output without accepting an empty initial suite", async () => {
  const { input, payload } = marketingPlanFixture(4);
  const initial = structuredClone(payload);
  initial.suite_strategy.core_buying_reason = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return response(initial);
    const text = JSON.stringify({ suite_strategy: payload.suite_strategy, items: [] });
    return new Response(`event: response.output_text.done\ndata: ${JSON.stringify({ type: "response.output_text.done", text })}\n\ndata: [DONE]\n\n`, { headers: { "content-type": "text/event-stream" } });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.items.length, 4);
  assert.equal(plan.marketingPlan.quality.issues.length, 0);
});

test("strategy and image issues are repaired within the same two-round budget", async () => {
  const { input, payload } = marketingPlanFixture(4);
  const initial = structuredClone(payload);
  initial.suite_strategy.primary_fact_ids = ["invented-temperature"];
  initial.items[1].creative_brief.effect_visual = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return response(initial);
    const context = contextOf(init);
    assert.equal(context.repair_request.round, calls - 1);
    assert.deepEqual(context.repair_request.target_item_ids, ["ai-2"]);
    assert.equal(context.repair_request.accepted_items.length, 3);
    return response({ suite_strategy: payload.suite_strategy, items: [calls === 2 ? initial.items[1] : payload.items[1]] });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.marketingPlan.quality.repairRounds, 2);
  assert.equal(plan.marketingPlan.quality.issues.length, 0);
});

test("strategy-only repair works when every adjustable image is locked", async () => {
  const { input, payload } = marketingPlanFixture(4);
  input.selectedRoles = ["hero", "effect-comparison", "product-detail", "scene"];
  const base = buildCreationPlan(input);
  input.platformItemOverrides = base.items.map((item) => ({ slotKey: item.slotKey, imageType: payload.items[item.slotIndex - 1].image_type, prompt: payload.items[item.slotIndex - 1].prompt }));
  const locked = buildCreationPlan(input).items.filter((item) => item.contentAssignment?.kind === "manual");
  for (const item of locked) {
    const row = payload.items[item.slotIndex - 1];
    row.item_id = item.itemId;
    row.image_type = item.imageType;
    row.prompt = item.prompt;
  }
  const initial = structuredClone(payload);
  initial.suite_strategy.core_buying_reason = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return response(initial);
    const context = contextOf(init);
    assert.equal(context.repair_request.strategy_only, true);
    assert.equal(context.locked_items.length, input.platformItemOverrides.length);
    assert.equal(context.repair_request.accepted_items.length, 4);
    return response({ suite_strategy: payload.suite_strategy, items: [] });
  } });
  assert.equal(calls, 2);
  for (const item of locked) assert.equal(plan.items.find((entry) => entry.itemId === item.itemId).prompt, item.prompt);
});

test("appearance-only products repair erroneous functional strategy without inventing a function", async () => {
  const input = { productName: "装饰摆件", productDescription: "圆形木质外观", skuGenerationEnabled: false, imageCount: 1, analysisValidated: true,
    productInsights: { confirmed_facts: [{ id: "look", text: "圆形木质外观", kind: "appearance", source: "user", reference_indexes: [] }] } };
  const { payload } = marketingPlanFixture(1);
  const item = { ...payload.items[0], fact_ids: ["look"], audience_ids: [], selling_point_ids: [], pain_point_ids: [], recommendation_ids: [], reference_indexes: [],
    prompt: "完整圆形木质摆件白底摄影，突出有依据的外形与材质。",
    creative_brief: { ...payload.items[0].creative_brief, visual_form: "product-photograph", effect_visual: "" } };
  const strategy = { core_buying_reason: "圆形木质外观带来的装饰价值", primary_fact_ids: ["look"], functional_proofs: [] };
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return response({ suite_strategy: { ...strategy, functional_proofs: [{ fact_ids: ["look"], buyer_benefit: "装饰", visual_evidence: "外观" }] }, items: [item] });
    const context = contextOf(init);
    assert.equal(context.repair_request.strategy_only, true);
    assert.deepEqual(context.quality_requirements.primaryFunctionFactIds, []);
    return response({ suite_strategy: strategy, items: [] });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.marketingPlan.quality.functionalCoverage.required, false);
  assert.deepEqual(plan.marketingPlan.suiteStrategy.functionalProofs, []);
  assert.ok(plan.items[0].prompt.startsWith(item.prompt));
});

test("cancelling strategy repair prevents further model requests", async () => {
  const { input, payload } = marketingPlanFixture(4);
  payload.suite_strategy.core_buying_reason = "";
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(requestCreationMarketingPlan({ input, referenceImages, config, signal: controller.signal,
    onProgress: (event) => { if (event.stage === "reviewing") controller.abort(); },
    fetchImpl: async () => { calls += 1; return response(payload); },
  }), { name: "AbortError" });
  assert.equal(calls, 1);
});
