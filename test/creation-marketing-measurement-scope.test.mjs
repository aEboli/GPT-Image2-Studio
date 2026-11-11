import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext, CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { creationMarketingInputFingerprint, requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

function fixture(count = 3) {
  const { input, payload } = marketingPlanFixture(count);
  input.dimensionSpecs = "Length 22 cm; Height 17.5 cm; Depth 6 cm; Weight 426 g";
  input.productInsights.confirmed_facts.push({ id: "measurements", kind: "spec", text: input.dimensionSpecs, source: "reference", reference_indexes: [1] });
  for (const item of payload.items) item.fact_ids.push("measurements");
  return { input, payload };
}
const apply = ({ input, payload }, options = {}) => applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: payload.items.length, referenceCount: 1, primaryIndex: 1, ...options });

test("ordinary marketing roles do not inherit dimension labels from shared evidence", () => {
  const types = ["generic-hero", "scene-application", "creator-demo", "detail-macro", "in-box", "selling-point-stack", "variant-comparison", "multi-angle"];
  const data = fixture(types.length);
  data.payload.items.forEach((item, index) => { item.image_type = types[index]; item.creative_brief.text_density = index === 7 ? "none" : "minimal"; });
  const plan = apply(data);
  assert.equal(plan.items.length, types.length);
  for (const item of plan.items) {
    assert.doesNotMatch(item.prompt, /MEASUREMENT DISPLAY|Assigned measurement equivalents|22 cm|17[.]5 cm|426 g/u);
    assert.ok(item.prompt.includes("MEASUREMENT BOUNDARY:"));
    assert.ok(item.prompt.includes("Do not add dimension lines, measurement arrows, rulers, size charts or size/weight badges"));
    assert.ok(item.prompt.includes("Preserve existing physical product and packaging markings"));
    assert.ok(item.marketingAssignment.factIds.includes("measurements"));
  }
  assert.ok(plan.productInsights.confirmedFacts.some((fact) => fact.id === "measurements"));
});

test("dedicated dimension and specification roles retain assigned dual-unit labels", () => {
  const data = fixture(2);
  data.payload.items.forEach((item, index) => { item.image_type = index ? "spec-table" : "dimension-fit"; item.creative_brief.text_density = "structured"; item.prompt += " Add dimension lines and measurement labels."; });
  const plan = apply(data);
  assert.equal(plan.items.length, 2);
  for (const item of plan.items) {
    for (const value of ["MEASUREMENT DISPLAY (both):", "22 cm (8.66 in)", "426 g (15.03 oz)"]) assert.ok(item.prompt.includes(value), value);
    assert.ok(!item.prompt.includes("MEASUREMENT BOUNDARY:"));
  }
});

for (const overlay of [" Add dimension lines labelled 22 cm and 17.5 cm and a weight badge showing 426 g.", " Surround the product with measurement arrows and size callouts.", " 添加长宽高尺寸标注，右下角显示重量标签426g。", " Add labels Length 22 cm and Weight 426 g.", " Keep original product markings and add dimension lines."]) {
  test("non-measurement tasks reject explicit measurement overlays: " + overlay, () => {
    const data = fixture();
    data.payload.items[2].image_type = "scene-application";
    data.payload.items[2].prompt += overlay;
    const plan = apply(data);
    assert.equal(plan.items.length, 2);
    assert.equal(plan.marketingPlan.validation.removedItems[0].sourceIndex, 3);
    assert.match(plan.marketingPlan.validation.removedItems[0].reason, /尺寸|重量/u);
  });
}

test("negative instructions, piece counts and original product markings are preserved", () => {
  const data = fixture();
  data.payload.items[2].prompt = "Show one intact 260 PCS kit in a desk drawer. Preserve the printed 426 g marking on the physical product. Do not add dimension lines, measurement arrows or weight badges.";
  const plan = apply(data);
  assert.equal(plan.items.length, 3);
  assert.ok(plan.items[2].prompt.includes(data.payload.items[2].prompt));
  assert.deepEqual(buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) }).items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
  const locked = { item_id: data.payload.items[2].item_id, image_type: data.payload.items[2].image_type, prompt: "Show the user-selected size chart with dimension lines." };
  data.payload.items[2].prompt = locked.prompt;
  assert.equal(apply(data, { lockedItems: [locked] }).items[2].prompt, locked.prompt);
});

for (const instruction of ["Avoid dimension lines and weight badges.", "Never add measurement arrows.", "不添加尺寸标注和重量标签。", "保留实物原有印刷的尺寸图。", "Preserve the printed size chart and weight label on the physical packaging.", "Add labels LIGHTWEIGHT and 260 PCS.", "Add a lightweight badge.", "This is not a size chart.", "Preserve the printed size chart and do not add measurement arrows."]) {
  test("measurement scope preserves negative instructions and physical print: " + instruction, () => {
    const data = fixture();
    data.payload.items[2].prompt += " " + instruction;
    assert.equal(apply(data).items.length, 3);
  });
}

test("planning scopes unit conversion to measurement tasks and invalidates the old cached contract", () => {
  const data = fixture();
  const context = buildCreationMarketingContext(data.input, buildCreationPlan(data.input));
  assert.ok(context.dimensionSpecs.includes("22 cm (8.66 in)"));
  assert.ok(context.prompt_contract.dimension_units.includes("Only dedicated dimension-fit and spec-table tasks"));
  assert.ok(CREATION_MARKETING_PLAN_INSTRUCTION.includes("单位换算规则不是新增尺寸标注的要求"));
  assert.notEqual(creationMarketingInputFingerprint(data.input), creationMarketingInputFingerprint(data.input, [], { planningContractVersion: 10 }));
});

test("a scene with copied dimensions repairs only that image", async () => {
  const data = fixture(4);
  const row = data.payload.items[3];
  row.prompt += " Add dimension lines and a weight badge.";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input: data.input,
    referenceImages: [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==" }],
    config: { baseUrl: "https://example.test/v1", responsesModel: "measurement-scope-test", apiKey: "test" },
    fetchImpl: async (_url, init) => {
      calls += 1;
      if (calls === 1) return Response.json({ output_text: JSON.stringify(data.payload) });
      const context = JSON.parse(JSON.parse(init.body).input[0].content[1].text);
      assert.deepEqual(context.repair_request.target_item_ids, [row.item_id]);
      assert.equal(context.repair_request.accepted_items.length, 3);
      return Response.json({ output_text: JSON.stringify({ suite_strategy: data.payload.suite_strategy, items: [{ ...row, prompt: row.prompt.replace(" Add dimension lines and a weight badge.", "") }] }) });
    },
  });
  assert.equal(calls, 2);
  assert.equal(plan.imageCount, 4);
  assert.equal(plan.marketingPlan.validation.removedItems.length, 0);
  assert.ok(plan.items.every((item) => item.prompt.includes("MEASUREMENT BOUNDARY:")));
});

test("unrepaired measurement overlays never reach the effective generation plan", async () => {
  const data = fixture(4);
  const row = data.payload.items[3];
  row.prompt += " Add dimension lines and a weight badge.";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input: data.input,
    referenceImages: [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==" }],
    config: { baseUrl: "https://example.test/v1", responsesModel: "measurement-scope-test", apiKey: "test" },
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ output_text: JSON.stringify(calls === 1 ? data.payload : { suite_strategy: data.payload.suite_strategy, items: [row] }) });
    },
  });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 3);
  assert.deepEqual(plan.marketingPlan.validation.removedItems.map((item) => item.itemId), [row.item_id]);
  assert.ok(!buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) }).items.some((item) => item.itemId === row.item_id));
});
