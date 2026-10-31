import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext, CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";

function measurementFixture(mode) {
  const { input, payload } = marketingPlanFixture(3);
  Object.assign(input, { targetLanguage: "en", dimensionSpecs: "Length 14.5 cm\nWeight 35.8 g" });
  if (mode) input.dimensionUnitMode = mode;
  const base = buildCreationPlan(input);
  base.productInsights.confirmedFacts.push(
    { id: "lure-measurements", kind: "spec", text: "Length 14.5 cm; Weight 35.8 g", referenceIndexes: [1] },
    { id: "other-variant", kind: "spec", text: "Other variant: Length 20 cm", referenceIndexes: [1] },
  );
  payload.items.forEach((item, index) => {
    item.image_type = ["spec-table", "scene-application", "dimension-fit"][index];
    item.fact_ids.push("lure-measurements");
    item.prompt = `Create image ${index + 1}: keep the original product markings. Add labels Length 14.5 cm and Weight 35.8 g.`;
    item.creative_brief.text_density = "structured";
  });
  return { input, base, payload };
}

const apply = (base, payload, options = {}) => applyCreationMarketingPlan(base, payload, { count: 3, referenceCount: 1, primaryIndex: 1, ...options });

test("AI marketing receives the default dual-unit mode and converted source measurements", () => {
  const { input, base } = measurementFixture();
  const context = buildCreationMarketingContext(input, base);
  assert.equal(context.dimensionUnitMode, "both");
  assert.match(context.dimensionSpecs, /14\.5 cm \(5\.71 in\)/u);
  assert.match(context.dimensionSpecs, /35\.8 g \(1\.26 oz\)/u);
  assert.match(context.prompt_contract.dimension_units, /metric and imperial pair together/iu);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /dimensionUnitMode/u);
});

test("AI marketing retains selected units when context falls back to the effective plan", () => {
  const { base } = measurementFixture("imperial");
  const context = buildCreationMarketingContext({ imageCount: 3 }, base);
  assert.equal(context.dimensionUnitMode, "imperial");
  assert.match(context.dimensionSpecs, /5\.71 in/u);
  assert.match(context.dimensionSpecs, /1\.26 oz/u);
  assert.doesNotMatch(context.dimensionSpecs, /14\.5 cm|35\.8 g/u);
});

test("specification, scene and fit prompts enforce both units using only assigned facts", () => {
  const { base, payload } = measurementFixture();
  const plan = apply(base, payload);
  assert.equal(plan.items.length, 3);
  for (const item of plan.items) {
    assert.match(item.prompt, /MEASUREMENT DISPLAY \(both\):/u);
    assert.match(item.prompt, /metric and imperial pair together/iu);
    assert.match(item.prompt, /14\.5 cm \(5\.71 in\)/u);
    assert.match(item.prompt, /35\.8 g \(1\.26 oz\)/u);
    assert.doesNotMatch(item.prompt, /Other variant|20 cm|7\.87 in/u);
    assert.match(item.prompt, /physical product.*markings/iu);
  }
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  assert.deepEqual(frozen.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
  const checked = structuredClone(payload);
  checked.items.forEach((item, index) => { item.prompt = plan.items[index].prompt; });
  assert.deepEqual(apply(plan, checked).items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
  assert.deepEqual(apply(plan, checked, { allowPartial: false }).items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
});

test("the marketing request and accepted plan both retain measurement conversions", async () => {
  const { input, payload } = marketingPlanFixture(3);
  Object.assign(input, { targetLanguage: "en", dimensionSpecs: "Length 14.5 cm\nWeight 35.8 g" });
  input.productInsights.confirmed_facts.push({ id: "lure-measurements", kind: "spec", text: "Length 14.5 cm; Weight 35.8 g", source: "reference", reference_indexes: [1] });
  payload.items.forEach((item) => {
    item.fact_ids.push("lure-measurements");
    item.creative_brief.text_density = "structured";
    item.prompt += " Add measurement labels Length 14.5 cm and Weight 35.8 g.";
  });
  let calls = 0;
  const plan = await requestCreationMarketingPlan({
    input,
    referenceImages: [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==" }],
    config: { baseUrl: "https://example.test/v1", responsesModel: "measurement-test", apiKey: "test" },
    fetchImpl: async (_url, init) => {
      calls += 1;
      const request = JSON.parse(init.body);
      const context = JSON.parse(request.input[0].content.find((entry) => entry.type === "input_text" && entry.text.startsWith("{\"task_count\"")).text);
      assert.equal(context.dimensionUnitMode, "both");
      assert.match(context.dimensionSpecs, /14\.5 cm \(5\.71 in\)/u);
      assert.match(context.dimensionSpecs, /35\.8 g \(1\.26 oz\)/u);
      return Response.json({ output_text: JSON.stringify(payload) });
    },
  });
  assert.equal(calls, 1);
  assert.equal(plan.items.length, 3);
  for (const item of plan.items) {
    assert.match(item.prompt, /14\.5 cm \(5\.71 in\)/u);
    assert.match(item.prompt, /35\.8 g \(1\.26 oz\)/u);
  }
});

for (const mode of ["metric", "imperial"]) {
  test(`AI marketing respects explicit ${mode} units`, () => {
    const { input, base, payload } = measurementFixture(mode);
    const context = buildCreationMarketingContext(input, base);
    const plan = apply(base, payload);
    assert.equal(context.dimensionUnitMode, mode);
    assert.match(context.prompt_contract.dimension_units, new RegExp(`${mode} units only`, "iu"));
    for (const item of plan.items) {
      assert.ok(item.prompt.includes(`MEASUREMENT DISPLAY (${mode}):`));
      assert.match(item.prompt, new RegExp(`${mode} units only`, "iu"));
      assert.doesNotMatch(item.prompt, /metric and imperial pair together/iu);
    }
  });
}

test("unit enforcement preserves text-free images and user-locked prompts", () => {
  const { base, payload } = measurementFixture();
  payload.items[0].creative_brief.text_density = "none";
  payload.items[0].prompt = "Photograph the intact product with its existing markings; add no text.";
  payload.items[1].image_type = "ownership-atmosphere";
  payload.items[1].creative_brief.visual_form = "commercial-cg";
  payload.items[1].creative_brief.text_density = "none";
  payload.items[1].prompt = "Render the intact product with depth and material texture; add no text.";
  const locked = { item_id: payload.items[2].item_id, image_type: payload.items[2].image_type, prompt: payload.items[2].prompt };
  const plan = apply(base, payload, { lockedItems: [locked] });
  assert.equal(plan.items.length, 3);
  assert.doesNotMatch(plan.items[0].prompt, /MEASUREMENT DISPLAY|5\.71 in|1\.26 oz/u);
  assert.doesNotMatch(plan.items[1].prompt, /MEASUREMENT DISPLAY|5\.71 in|1\.26 oz/u);
  assert.equal(plan.items[2].prompt, locked.prompt);
});
