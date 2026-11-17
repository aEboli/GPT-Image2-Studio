import assert from "node:assert/strict";
import test from "node:test";
import { CREATION_MARKETING_PERSONAS, buildCreationMarketingArtDirection, createCreationMarketingAgentSelector } from "../lib/creation-marketing-personas.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { applyCreationMarketingPlan, CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { createCreationMarketingBatchState, runCreationMarketingBatch } from "../lib/creation-marketing-batch.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }];
const config = { baseUrl: "https://example.test/v1", responsesModel: "agent-test", apiKey: "test" };
const requestContext = (init) => JSON.parse(JSON.parse(init.body).input.flatMap((entry) => entry.content || []).find((entry) => entry.type === "input_text" && entry.text.startsWith("{")).text);

test("64 unique agents define concrete buying, category and visual directions", () => {
  assert.equal(CREATION_MARKETING_PERSONAS.length, 64);
  for (const key of ["id", "name", "composition", "palette", "lighting", "buyerLens"]) {
    assert.equal(new Set(CREATION_MARKETING_PERSONAS.map((profile) => profile[key])).size, 64, key);
  }
  assert.equal(new Set(CREATION_MARKETING_PERSONAS.map((profile) => profile.family)).size, 8);
  for (const profile of CREATION_MARKETING_PERSONAS) {
    for (const key of ["specialty", "scene", "typography"]) assert.ok(profile[key].length > 3, `${profile.id}.${key}`);
    assert.ok(Object.isFrozen(profile));
  }
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /四个维度重新设计/);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /配色不改变商品实物颜色/);
});

for (const deterministic of [true, false]) {
  test(`agent decks do not repeat before exhaustion and avoid adjacent families (${deterministic ? "fixed" : "random"})`, () => {
    const select = createCreationMarketingAgentSelector(deterministic ? { random: () => 0 } : {});
    let previous;
    for (let round = 0; round < 8; round += 1) {
      const ids = [];
      for (let index = 0; index < 64; index += 1) {
        const agent = select();
        ids.push(agent.profile.id);
        assert.notEqual(agent.profile.family, previous?.profile.family);
        assert.ok(agent.recentDirections.length <= 4);
        previous = agent;
      }
      assert.equal(new Set(ids).size, 64);
    }
  });
}

test("retry reservations retain identity, do not consume another agent and return isolated values", () => {
  const select = createCreationMarketingAgentSelector({ random: () => 0 });
  const first = select("suite-1");
  select("suite-2");
  assert.deepEqual(select("suite-1"), first);
  const mutation = select("suite-1");
  mutation.profile.name = "修改副本";
  mutation.recentDirections.push({ family: "修改副本" });
  assert.deepEqual(select("suite-1"), first);
  const ids = new Set([first.profile.id, select("suite-2").profile.id]);
  for (let index = 3; index <= 64; index += 1) ids.add(select(`suite-${index}`).profile.id);
  assert.equal(ids.size, 64);
});

test("fifty concurrent suite reservations receive fifty distinct agents", async () => {
  const select = createCreationMarketingAgentSelector();
  const agents = await Promise.all(Array.from({ length: 50 }, async (_, index) => select(`parallel-${index}`)));
  assert.equal(new Set(agents.map((agent) => agent.profile.id)).size, 50);
});

test("white, render and text-free tasks adapt the persona without overriding their hard rules", () => {
  const agent = createCreationMarketingAgentSelector({ random: () => 0 })();
  const white = buildCreationMarketingArtDirection(agent, { imageType: "clean-catalog-main" });
  assert.match(white, /255\/255\/255/);
  assert.match(white, /No props, effects, graphics, text or cropping/);
  assert.ok(!white.includes(agent.profile.scene));
  assert.ok(!white.includes(agent.profile.palette));
  const render = buildCreationMarketingArtDirection(agent, { role: "atmosphere", marketingAssignment: { creativeBrief: { visual_form: "commercial-cg" } } });
  assert.match(render, /no environmental scenery or colored background/);
  assert.match(render, /No added typography/);
  assert.ok(!render.includes(agent.profile.palette));
  const textFree = buildCreationMarketingArtDirection(agent, { textPolicy: "none" });
  assert.match(textFree, /No added typography/);
  assert.ok(textFree.includes(agent.profile.palette));
});

test("different agents reach the model context and actual prompts, then survive freezing, storage and repair", async () => {
  const select = createCreationMarketingAgentSelector({ random: () => 0 });
  const { input, payload } = marketingPlanFixture(2);
  const contexts = [], plans = [];
  for (const variationSeed of ["first-suite", "second-suite"]) {
    plans.push(await requestCreationMarketingPlan({ input: { ...input, variationSeed }, referenceImages, config, agentSelector: select,
      fetchImpl: async (_url, init) => {
        contexts.push(requestContext(init));
        return Response.json({ output_text: JSON.stringify(payload) });
      },
    }));
  }
  assert.equal(contexts.length, 2);
  assert.notEqual(plans[0].marketingPlan.creativeAgent.profile.id, plans[1].marketingPlan.creativeAgent.profile.id);
  assert.notEqual(plans[0].items[0].prompt, plans[1].items[0].prompt, "even identical mock drafts execute different art directions");
  for (const [index, plan] of plans.entries()) {
    assert.deepEqual(plan.marketingPlan.creativeAgent, contexts[index].creative_agent);
    const profile = plan.marketingPlan.creativeAgent.profile;
    assert.ok(plan.items[0].prompt.includes(profile.composition));
    assert.ok(plan.items[0].prompt.includes(profile.palette));
    assert.ok(plan.items[0].prompt.includes(profile.lighting));
    assert.ok(plan.items[0].prompt.includes(profile.typography));
    assert.ok(!plan.items[0].prompt.includes(profile.name));
    const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
    const stored = normalizeCreationSetManifest({ ...plan, setId: "agent-set", effectivePlan: plan });
    for (const copy of [frozen, stored, buildCreationRepairPlan(stored)]) {
      assert.deepEqual(copy.marketingPlan.creativeAgent, plan.marketingPlan.creativeAgent);
      assert.deepEqual(copy.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
    }
  }
});

test("bounded local repairs retain the same agent while preserving accepted prompts", async () => {
  const { input, payload } = marketingPlanFixture(4);
  const broken = structuredClone(payload);
  broken.items[2].fact_ids = ["missing-fact"];
  const contexts = [];
  let selections = 0;
  const select = createCreationMarketingAgentSelector();
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config,
    agentSelector: (key) => { selections += 1; return select(key); },
    fetchImpl: async (_url, init) => {
      const context = requestContext(init);
      contexts.push(context);
      return Response.json({ output_text: JSON.stringify(context.repair_request ? { suite_strategy: payload.suite_strategy, items: context.repair_request.targets.map((target) => payload.items.find((item) => item.item_id === target.item_id)) } : broken) });
    },
  });
  assert.equal(selections, 1);
  assert.equal(contexts.length, 2);
  assert.deepEqual(contexts[0].creative_agent, contexts[1].creative_agent);
  assert.equal(plan.imageCount, 4);
  assert.ok(plan.items.every((item) => item.prompt.includes("VISUAL ART DIRECTION")));
});

test("user-locked marketing prompts remain exact while other images receive the agent", () => {
  const { input, payload } = marketingPlanFixture(2);
  const base = buildCreationPlan(input);
  const agent = createCreationMarketingAgentSelector()();
  const lockedItems = [{ item_id: payload.items[0].item_id, image_type: payload.items[0].image_type, prompt: "用户锁定的原始提示词，不改写。" }];
  payload.items[0].prompt = lockedItems[0].prompt;
  const plan = applyCreationMarketingPlan(base, payload, { count: 2, referenceCount: 1, primaryIndex: 1, lockedItems, creativeAgent: agent });
  assert.equal(plan.items[0].prompt, lockedItems[0].prompt);
  assert.ok(plan.items[1].prompt.includes("VISUAL ART DIRECTION"));
});

test("three schemes times two suites produce six separately directed frozen plans", async () => {
  const select = createCreationMarketingAgentSelector();
  const { input, payload } = marketingPlanFixture(2);
  const state = createCreationMarketingBatchState({ count: 3, copiesPerScheme: 2 });
  const plans = [];
  await runCreationMarketingBatch({ state,
    generatePlan: async ({ variationSeed }) => ({ plan: await requestCreationMarketingPlan({ input: { ...input, variationSeed }, referenceImages, config, agentSelector: select,
      fetchImpl: async () => Response.json({ output_text: JSON.stringify(payload) }),
    }) }),
    enqueuePlan: async ({ planResult, variationSeed }) => {
      assert.equal(planResult.plan.marketingPlan.variationSeed, variationSeed);
      plans.push(planResult.plan);
      return { id: variationSeed };
    },
  });
  assert.equal(plans.length, 6);
  assert.equal(new Set(plans.map((plan) => plan.marketingPlan.creativeAgent.profile.id)).size, 6);
  assert.equal(new Set(plans.map((plan) => plan.items[0].prompt)).size, 6);
  assert.equal(state.enqueuedCount, 6);
});
