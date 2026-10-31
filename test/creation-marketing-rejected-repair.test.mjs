import test from "node:test";
import assert from "node:assert/strict";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }];
const config = { baseUrl: "https://example.test/v1", responsesModel: "rejected-repair-test", apiKey: "test" };
const response = (payload) => Response.json({ output_text: JSON.stringify(payload) });
const requestContext = (init) => {
  const body = JSON.parse(init.body);
  return JSON.parse(body.input.flatMap((entry) => entry.content || []).find((entry) => entry.type === "input_text" && entry.text.startsWith("{")).text);
};

test("the planning contract rejects unsupported directions rather than relabeling their facts", () => {
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /先核对本图需要的事实、视角、规格、配件和来源是否已确认/);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /没有支持的方向不要推荐/);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /不得只删除无效引用或替换事实 ID/);
});

test("rejected fact directions are replaced within the same bounded repair loop", async () => {
  const { input, payload } = marketingPlanFixture(6);
  const broken = structuredClone(payload);
  for (const index of [0, 2, 4]) broken.items[index].fact_ids = ["unavailable-fact"];
  const contexts = [];
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    contexts.push(requestContext(init));
    if (contexts.length === 1) return response(broken);
    const context = contexts.at(-1);
    assert.deepEqual(context.repair_request.targets.map((row) => row.source_index), [1, 3, 5]);
    assert.equal(context.reuse_analysis, true);
    assert.ok(context.repair_request.issues.every((issue) => issue.code === "item-invalid"));
    return response({ suite_strategy: payload.suite_strategy, items: context.repair_request.targets.map((row) => ({ ...payload.items[row.source_index - 1], item_id: row.item_id })) });
  } });
  assert.equal(contexts.length, 2);
  assert.equal(plan.imageCount, 6);
  assert.equal(plan.marketingPlan.validation.removedItems.length, 0);
  assert.deepEqual(plan.items.map((item) => item.marketingAssignment.sourceIndex), [1, 2, 3, 4, 5, 6]);
  for (const index of [1, 3, 5]) assert.ok(plan.items[index].prompt.includes(payload.items[index].prompt));
  assert.deepEqual(buildCreationSubmittedPlan({ effectivePlan: plan }).items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
});

test("short drafts repair absent positions without regenerating accepted images", async () => {
  const { input, payload } = marketingPlanFixture(4);
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return response({ ...payload, items: payload.items.slice(0, 2) });
    const context = requestContext(init);
    assert.deepEqual(context.repair_request.targets.map((row) => row.source_index), [3, 4]);
    return response({ suite_strategy: payload.suite_strategy, items: context.repair_request.targets.map((row) => ({ ...payload.items[row.source_index - 1], item_id: row.item_id })) });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.imageCount, 4);
  assert.equal(plan.marketingPlan.validation.missingCount, 0);
});

test("an all-rejected draft can recover and an exhausted one keeps its diagnostic", async () => {
  const { input, payload } = marketingPlanFixture(2);
  const broken = structuredClone(payload);
  broken.items.forEach((row) => { row.fact_ids = ["unavailable-fact"]; });
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => response(++calls === 1 ? broken : payload) });
  assert.equal(calls, 2);
  assert.equal(plan.imageCount, 2);
  calls = 0;
  await assert.rejects(requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => { calls += 1; return response(broken); } }), (error) => {
    assert.match(error.message, /没有可用/);
    assert.equal(error.marketingValidation.removedItems.length, 2);
    return true;
  });
  assert.equal(calls, 3);
});

test("each round keeps recovered positions and repairs only the remaining invalid ones", async () => {
  const { input, payload } = marketingPlanFixture(4);
  const broken = structuredClone(payload);
  broken.items[0] = null;
  broken.items[2].fact_ids = ["unavailable-fact"];
  let calls = 0;
  const events = [];
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, onProgress: (event) => events.push(event), fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return response(broken);
    const context = requestContext(init);
    assert.deepEqual(context.repair_request.targets.map((row) => row.source_index), calls === 2 ? [1, 3] : [3]);
    return response({ suite_strategy: payload.suite_strategy, items: context.repair_request.targets.map((row) => ({
      ...(calls === 2 && row.source_index === 3 ? broken.items[2] : payload.items[row.source_index - 1]), item_id: row.item_id,
    })) });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 4);
  assert.equal(plan.items[0].itemId, "marketing-repair-1");
  assert.equal(plan.marketingPlan.validation.removedItems.length, 0);
  assert.equal(events.at(-1).stage, "complete");
});

test("a rejected early slot cannot displace an accepted task by reusing its prompt", async () => {
  const { input, payload } = marketingPlanFixture(4);
  const broken = structuredClone(payload);
  broken.items[0].fact_ids = ["unavailable-fact"];
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return response(broken);
    const item = { ...payload.items[0], ...(calls === 2 ? { prompt: payload.items[3].prompt } : {}) };
    return response({ suite_strategy: payload.suite_strategy, items: [item] });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 4);
  assert.ok(plan.marketingPlan.quality.repairs[0].rejection);
  assert.ok(plan.items[3].prompt.includes(payload.items[3].prompt));
});

test("cancellation before a rejected-direction repair sends no additional model request", async () => {
  const { input, payload } = marketingPlanFixture(4);
  payload.items[0].fact_ids = ["unavailable-fact"];
  const controller = new AbortController();
  let calls = 0;
  await assert.rejects(requestCreationMarketingPlan({ input, referenceImages, config, signal: controller.signal,
    onProgress: (event) => { if (event.stage === "reviewing") controller.abort(); },
    fetchImpl: async () => { calls += 1; return response(payload); },
  }), (error) => error.name === "AbortError");
  assert.equal(calls, 1);
});
