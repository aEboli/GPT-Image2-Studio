import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==" }];
const config = { baseUrl: "https://example.test/v1", responsesModel: "locked-repair-test", apiKey: "test" };
const response = (payload) => Response.json({ output_text: JSON.stringify(payload) });
const contextOf = (init) => JSON.parse(JSON.parse(init.body).input[0].content[1].text);

function lockItems(input, payload, indexes) {
  const base = buildCreationPlan(input);
  input.platformItemOverrides = indexes.map((index) => ({
    slotKey: base.items[index].slotKey, imageType: payload.items[index].image_type, prompt: payload.items[index].prompt,
  }));
  const plan = buildCreationPlan(input);
  return indexes.map((index) => {
    const item = plan.items[index];
    Object.assign(payload.items[index], { item_id: item.itemId, image_type: item.imageType, prompt: item.prompt });
    return item;
  });
}

function duplicateLockedFixture() {
  const { input, payload } = marketingPlanFixture(4);
  const locked = lockItems(input, payload, [0, 2]);
  for (const index of [0, 2]) {
    payload.items[index].marketing_goal = `核对商品整体外观${index}`;
    Object.assign(payload.items[index].creative_brief, {
      action: "检查同一处掌心纹理", evidence_focus: "掌心灰色纹理", framing: "同一视角与构图",
    });
  }
  return { input, payload, locked };
}

function assertLockedPrompts(plan, locked) {
  for (const item of locked) {
    assert.equal(plan.items.find((entry) => entry.itemId === item.itemId)?.prompt, item.prompt);
    assert.ok(plan.marketingPlan.lockedItems.some((entry) => entry.item_id === item.itemId && entry.prompt === item.prompt));
  }
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  assert.deepEqual(frozen.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
}

test("unsupported functional metadata cannot silently remove a user-locked image", async () => {
  const { input, payload } = marketingPlanFixture(4);
  for (const fact of input.productInsights.confirmed_facts) fact.kind = "appearance";
  payload.product_insights = input.productInsights;
  payload.suite_strategy = { core_buying_reason: "核对真实外观", primary_fact_ids: ["appearance"], functional_proofs: [] };
  payload.items[1].prompt = "用户锁定的商品外观图，展示完整商品与掌面纹理，不添加功能效果。";
  const [locked] = lockItems(input, payload, [1]);
  const events = [];
  let calls = 0;
  await assert.rejects(requestCreationMarketingPlan({ input, referenceImages, config, onProgress: (event) => events.push(event), fetchImpl: async () => {
    calls += 1;
    return response(payload);
  } }), (error) => {
    assert.match(error.message, /用户锁定.*没有已确认的功能依据/u);
    assert.ok(error.marketingQuality.issues.some((issue) => issue.code === "unsupported-functional-render" && issue.itemId === locked.itemId));
    return true;
  });
  assert.equal(calls, 1);
  assert.equal(events.at(-1).stage, "error");
  assert.equal(payload.items.length, 4);
  assert.equal(payload.items[1].prompt, locked.prompt);
});

test("locked duplicate advice does not block repair of another editable image", async () => {
  const { input, payload, locked } = duplicateLockedFixture();
  const initial = structuredClone(payload);
  initial.items[1].creative_brief.effect_visual = "";
  initial.items[1].prompt = "完整商品居中摄影，附加热功能文字。";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return response(initial);
    const context = contextOf(init);
    assert.deepEqual(context.repair_request.target_item_ids, [payload.items[1].item_id]);
    assert.deepEqual(context.repair_request.issues.map((issue) => issue.code), ["functional-proof-missing"]);
    assert.equal(context.repair_request.accepted_items.length, 3);
    for (const item of locked) assert.ok(context.repair_request.accepted_items.some((entry) => entry.item_id === item.itemId && entry.prompt === item.prompt));
    return response({ suite_strategy: payload.suite_strategy, items: [payload.items[1]] });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.marketingPlan.quality.repairRounds, 1);
  assert.equal(plan.marketingPlan.quality.functionalCoverage.covered, true);
  assert.deepEqual(plan.marketingPlan.quality.issues.map((issue) => issue.code), ["duplicate-task"]);
  assertLockedPrompts(plan, locked);
});

test("locked duplicate advice still allows a strategy-only repair", async () => {
  const { input, payload, locked } = duplicateLockedFixture();
  const initial = structuredClone(payload);
  initial.suite_strategy.core_buying_reason = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return response(initial);
    const context = contextOf(init);
    assert.equal(context.repair_request.strategy_only, true);
    assert.equal(context.task_count, 0);
    assert.deepEqual(context.repair_request.target_item_ids, []);
    assert.deepEqual(context.repair_request.issues.map((issue) => issue.code), ["strategy-invalid"]);
    assert.equal(context.repair_request.accepted_items.length, 4);
    return response({ suite_strategy: payload.suite_strategy, items: [] });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.marketingPlan.quality.repairRounds, 1);
  assert.equal(plan.marketingPlan.suiteStrategy.coreBuyingReason, payload.suite_strategy.core_buying_reason);
  assert.deepEqual(plan.marketingPlan.quality.issues.map((issue) => issue.code), ["duplicate-task"]);
  assertLockedPrompts(plan, locked);
});

test("only locked quality advice does not trigger an unusable repair request", async () => {
  const { input, payload, locked } = duplicateLockedFixture();
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => {
    calls += 1;
    return response(payload);
  } });
  assert.equal(calls, 1);
  assert.equal(plan.marketingPlan.quality.repairRounds, 0);
  assert.equal(plan.marketingPlan.quality.status, "warning");
  assertLockedPrompts(plan, locked);
});

test("mixed locked and editable issues retain the two-round repair limit", async () => {
  const { input, payload, locked } = duplicateLockedFixture();
  payload.items[1].creative_brief.effect_visual = "";
  payload.items[1].prompt = "完整商品居中摄影，附加热功能文字。";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return response(payload);
    assert.deepEqual(contextOf(init).repair_request.target_item_ids, [payload.items[1].item_id]);
    return response({ suite_strategy: payload.suite_strategy, items: [payload.items[1]] });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.marketingPlan.quality.repairRounds, 2);
  assert.equal(plan.imageCount, 4);
  assert.equal(plan.marketingPlan.quality.status, "warning");
  assertLockedPrompts(plan, locked);
});
