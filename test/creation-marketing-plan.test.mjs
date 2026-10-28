import test from "node:test";
import assert from "node:assert/strict";
import { applyCreationPlanEvidenceRequirements, buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { normalizeCreationProductInsights } from "../lib/creation-product-insights.mjs";
import { requestCreationMarketingPlan, creationMarketingInputFingerprint } from "../lib/creation-marketing-agent.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext, CREATION_MARKETING_PLAN_MODE } from "../lib/creation-marketing-plan.mjs";
import { createPromptAgentRequestBody, extractPromptAgentJson, requestPromptAgentAnalysis, consumePromptAgentSse } from "../lib/prompt-agent.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { buildCreationItemReferenceImages, buildCreationGenerationReferenceImageLabels } from "../lib/creation-reference-labels.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "Z2xvdmVz", buffer: Buffer.from("gloves") }];
const config = { baseUrl: "http://localhost:9/v1", endpointPath: "/responses", imageRoute: "a", apiKey: "secret-local-test-only", responsesModel: "test-vision-model" };

test("marketing schema supports a complete batch and text-only product input", () => {
  const body = createPromptAgentRequestBody({ images: [], mode: CREATION_MARKETING_PLAN_MODE, responsesModel: "test-model" });
  assert.equal(body.text.format.name, "creation_marketing_plan_json");
  assert.equal(body.text.format.schema.properties.items.maxItems, 20);
  assert.ok(body.text.format.schema.required.includes("product_insights"));
  assert.ok(body.text.format.schema.required.includes("items"));
  assert.match(body.input[0].content[0].text, /电商视觉营销专家/);
  assert.match(body.input[0].content[0].text, /一次回答.*完整的 task_count/);
  assert.match(body.input[0].content[0].text, /image_type 必须逐字使用 allowed_image_types 中的 image_type 值/);
  assert.match(body.input[0].content[0].text, /每条 marketing_goal 必须非空且互不相同/);
});

test("audience segments retain concrete contexts and reject invalid evidence", () => {
  const { input } = marketingPlanFixture();
  const normalized = normalizeCreationProductInsights(input.productInsights, { referenceCount: 1 });
  assert.equal(normalized.audienceSegments.length, 3);
  assert.equal(normalized.audienceSegments[0].priority, "primary");
  assert.match(normalized.audienceSegments[0].context, /骑车通勤/);
  assert.equal(normalized.painPoints.length, 1);
  const invalid = structuredClone(input.productInsights);
  invalid.audience_segments[0].fact_ids = ["missing"];
  assert.equal(normalizeCreationProductInsights(invalid, { referenceCount: 1 }).audienceSegments.length, 2);
});

async function planned(count = 20, modify = (value) => value) {
  const { input, payload } = marketingPlanFixture(count);
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    const request = JSON.parse(init.body);
    assert.equal(request.text.format.name, "creation_marketing_plan_json");
    assert.ok(!JSON.stringify(request.input).includes(config.apiKey));
    return new Response(JSON.stringify({ output_text: JSON.stringify(modify(payload)) }), { headers: { "content-type": "application/json" } });
  } });
  return { input, plan, calls };
}

test("one model call returns 20 final prompts without the template slot limit", async () => {
  const { plan, calls } = await planned();
  assert.equal(calls, 1);
  assert.equal(plan.promptPlanningMode, "ai-batch");
  assert.equal(plan.items.length, 20);
  assert.equal(plan.carouselImageCount, 20);
  assert.equal(plan.platformSetOverrides.imageCount, 20);
  assert.equal(new Set(plan.items.map((item) => item.prompt)).size, 20);
  assert.equal(plan.items.some((item) => item.evidenceBlocked), false);
  assert.equal(plan.productInsights.audienceSegments.length, 3);
  assert.equal(plan.items[0].imageTypeLabel, "首图成交主视觉");
  assert.equal(plan.items[2].imageTypeLabel, "产品细节特写图");
});

for (const imageType of ["variant-comparison", "dimension-fit", "in-box", "spec-table"]) {
  test(`AI marketing ${imageType} is not blocked by local evidence requirements`, async () => {
    const { input, payload } = marketingPlanFixture(1);
    input.dimensionSpecs = "";
    payload.product_insights.confirmed_facts = payload.product_insights.confirmed_facts.filter((fact) => !["spec", "package"].includes(fact.kind));
    payload.items[0].image_type = imageType;
    const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => (
      new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { headers: { "content-type": "application/json" } })
    ) });
    const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
    const stored = normalizeCreationSetManifest({ ...plan, setId: "ai-marketing-evidence-test", effectivePlan: frozen });
    const repair = applyCreationPlanEvidenceRequirements(buildCreationRepairPlan(stored));
    const previouslyBlocked = structuredClone(frozen);
    for (const item of [...previouslyBlocked.items, ...previouslyBlocked.slots]) {
      item.enabled = false;
      item.evidenceBlocked = true;
      item.evidenceRequirement = { code: "specifications", message: "旧依据限制" };
    }
    const restored = applyCreationPlanEvidenceRequirements(previouslyBlocked);
    assert.notEqual(stored.items[0].evidenceBlocked, true);
    assert.equal(stored.items[0].prompt, plan.items[0].prompt);
    assert.deepEqual(stored.items[0].marketingAssignment, plan.items[0].marketingAssignment);
    for (const candidate of [plan, frozen, repair, restored]) {
      assert.equal(candidate.items[0].imageType, imageType);
      assert.equal(candidate.items[0].enabled, true);
      assert.equal(candidate.items[0].evidenceBlocked, false);
      assert.equal(candidate.items[0].evidenceRequirement, null);
      assert.equal(candidate.items[0].prompt, plan.items[0].prompt);
      assert.deepEqual(candidate.items[0].marketingAssignment, plan.items[0].marketingAssignment);
      assert.ok(!candidate.warnings?.some((warning) => warning.code === "item-missing-evidence"));
      if (candidate.slots) assert.equal(candidate.slots[0].evidenceBlocked, false);
    }
  });
}

test("marketing assignments repair omitted facts from their grounded analysis entries", async () => {
  const { input, payload } = marketingPlanFixture(3);
  payload.items.forEach((item) => {
    item.fact_ids = ["appearance"];
    item.audience_ids = ["commute"];
  });
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => (
    new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { headers: { "content-type": "application/json" } })
  ) });
  assert.ok(plan.items.every((item) => item.marketingAssignment.factIds.includes("fingers")));
});

test("grounded marketing tasks keep a rich evidence chain instead of failing on fact count", async () => {
  const { input, payload } = marketingPlanFixture(3);
  payload.items[0].fact_ids = ["appearance", "control", "fingers"];
  payload.items[0].selling_point_ids = ["detail-benefit"];
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => (
    new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { headers: { "content-type": "application/json" } })
  ) });
  assert.deepEqual(plan.items[0].marketingAssignment.factIds, ["appearance", "control", "fingers"]);
});

test("text-only planning grounds marketing in the supplied product description", async () => {
  const { input, payload } = marketingPlanFixture(3);
  input.productDescription = "棉质手套，腕口有调节带";
  delete input.productInsights;
  input.referenceImageRoles = [];
  payload.reference_roles = [];
  payload.product_insights = { confirmed_facts: [{ id: "description", text: input.productDescription, kind: "appearance", source: "user", reference_indexes: [] }], selling_points: [], pain_points: [], marketing_recommendations: [], audience_segments: [] };
  payload.items.forEach((item) => { item.fact_ids = ["description"]; item.reference_indexes = []; item.audience_ids = []; item.selling_point_ids = []; item.pain_point_ids = []; item.recommendation_ids = []; });
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages: [], config, fetchImpl: async () => {
    calls += 1;
    return new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { headers: { "content-type": "application/json" } });
  } });
  assert.equal(calls, 1);
  assert.equal(plan.items.length, 3);
  assert.equal(plan.productInsights.confirmedFacts[0].source, "user");
});

test("frozen plans, stored items and repair retain exact prompts and reference assignments", async () => {
  const { plan } = await planned();
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const stored = normalizeCreationSetManifest({ ...plan, setId: "ai-marketing-test", effectivePlan: frozen });
  const repair = buildCreationRepairPlan(stored);
  for (const candidate of [frozen, stored, repair]) {
    assert.equal(candidate.items.length, 20);
    assert.deepEqual(candidate.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
    assert.deepEqual(candidate.items.map((item) => item.marketingAssignment), plan.items.map((item) => item.marketingAssignment));
    assert.equal(candidate.marketingPlan.inputFingerprint, plan.marketingPlan.inputFingerprint);
  }
  const selected = buildCreationItemReferenceImages(plan.items[0], referenceImages, plan.referenceImageRoles);
  assert.equal(selected.length, 1);
  assert.equal(selected[0].filename, "gloves.png");
  assert.throws(() => buildCreationItemReferenceImages(plan.items[0], [], plan.referenceImageRoles), /参考图缺失/);
});

for (const [name, mutation, error] of [
  ["short batch", (payload) => { payload.items.pop(); }, /20 条.*19 条/],
  ["duplicate id", (payload) => { payload.items[1].item_id = payload.items[0].item_id; }, /独立任务/],
  ["duplicate prompt", (payload) => { payload.items[1].prompt = payload.items[0].prompt; }, /独立任务/],
  ["unknown fact", (payload) => { payload.items[0].fact_ids.push("missing"); }, /商品事实/],
  ["unknown buyer", (payload) => { payload.items[0].audience_ids = ["missing"]; }, /audience_ids/],
  ["unknown reference", (payload) => { payload.items[0].reference_indexes = [2]; }, /参考图分配无效/],
  ["duplicate reference", (payload) => { payload.items[0].reference_indexes = [1, 1]; }, /参考图分配无效/],
  ["empty prompt", (payload) => { payload.items[0].prompt = ""; }, /完整提示词/],
  ["unknown type", (payload) => { payload.items[0].image_type = "not-a-type"; }, /有效图型/],
  ["duplicate goal", (payload) => { payload.items[1].marketing_goal = payload.items[0].marketing_goal; }, /独立任务/],
  ["missing title", (payload) => { payload.items[8].title = ""; }, /第 9 条缺少图片标题/],
  ["role instead of image type", (payload) => { payload.items[8].image_type = "effect-comparison"; }, /第 9 条没有有效图型（effect-comparison）/],
  ["repeated ninth goal", (payload) => { payload.items[8].marketing_goal = payload.items[0].marketing_goal; }, /第 9 条营销目标.*重复/],
]) {
  test(`invalid AI ${name} removes only the unusable task`, async () => {
    const { plan, calls } = await planned(20, (payload) => { mutation(payload); return payload; });
    assert.equal(calls, 1);
    assert.equal(plan.imageCount, 19);
    assert.equal(plan.items.length, 19);
    assert.equal(plan.platformSetOverrides.imageCount, 19);
    const validation = plan.marketingPlan.validation;
    assert.equal(validation.requestedCount, 20);
    assert.equal(validation.acceptedCount, 19);
    if (name === "short batch") assert.equal(validation.missingCount, 1);
    else assert.match(validation.removedItems[0].reason, error);
  });
}

test("planning context preserves user locks and a changed product invalidates the fingerprint", () => {
  const { input, payload } = marketingPlanFixture(6);
  const base = buildCreationPlan(input);
  base.items[0].contentAssignment = { kind: "manual" };
  const context = buildCreationMarketingContext(input, base, referenceImages);
  assert.equal(context.allowed_image_types.find((entry) => entry.image_type === "generic-hero").title, "首图成交主视觉");
  assert.equal(context.locked_items[0].prompt, base.items[0].prompt);
  assert.throws(() => applyCreationMarketingPlan(base, payload, { count: 6, referenceCount: 1, primaryIndex: 1, lockedItems: context.locked_items }), /锁定/);
  const partial = applyCreationMarketingPlan(base, payload, { count: 6, referenceCount: 1, primaryIndex: 1, selectedRoles: ["multi-angle"] });
  assert.equal(partial.items.length, 5);
  assert.match(partial.marketingPlan.validation.removedItems[0].reason, /用户选择的图片类型/);
  assert.notEqual(creationMarketingInputFingerprint(input, referenceImages), creationMarketingInputFingerprint({ ...input, productDescription: "改变商品资料" }, referenceImages));
  assert.notEqual(creationMarketingInputFingerprint(input, referenceImages), creationMarketingInputFingerprint(input, [{ ...referenceImages[0], base64: "Y2hhbmdl" }]));
});

test("known primary and fact sources repair omitted AI reference indexes", async () => {
  const { input, payload } = marketingPlanFixture(3);
  payload.items.forEach((item) => { item.reference_indexes = []; });
  const result = await requestCreationMarketingPlan({
    input,
    referenceImages,
    config,
    fetchImpl: async () => new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { headers: { "content-type": "application/json" } }),
  });
  assert.deepEqual(result.items.map((item) => item.marketingAssignment.referenceIndexes), [[1], [1], [1]]);
});

test("reference repair uses distinct fact sources and keeps the chosen primary first", () => {
  const { input, payload } = marketingPlanFixture(1);
  const base = buildCreationPlan(input);
  base.productInsights.confirmedFacts = base.productInsights.confirmedFacts.map((fact) => ({ ...fact, referenceIndexes: fact.id === "fingers" ? [3] : [2] }));
  payload.items[0].reference_indexes = [3];
  const result = applyCreationMarketingPlan(base, payload, { count: 1, referenceCount: 3, primaryIndex: 2 });
  assert.deepEqual(result.items[0].marketingAssignment.referenceIndexes, [2, 3]);
  assert.deepEqual(result.items[0].contentAssignment.referenceSources.map((source) => source.index), [2, 3]);
});

test("adding a missing primary cannot silently discard selected references at the eight-image limit", () => {
  const { input, payload } = marketingPlanFixture(1);
  const base = buildCreationPlan(input);
  payload.items[0].reference_indexes = [2, 3, 4, 5, 6, 7, 8, 9];
  assert.throws(() => applyCreationMarketingPlan(base, payload, { count: 1, referenceCount: 9, primaryIndex: 1 }), /超过 8 张/);
});

test("frozen-plan validation preserves the previewed final prompt exactly", async () => {
  const { plan } = await planned(3);
  const { payload } = marketingPlanFixture(3);
  payload.items.forEach((item, index) => { item.prompt = plan.items[index].prompt; });
  const validated = applyCreationMarketingPlan(plan, payload, { count: 3, referenceCount: 1, primaryIndex: 1 });
  assert.deepEqual(validated.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
});

test("primary reference outside the uploaded set remains a hard failure", () => {
  const { input, payload } = marketingPlanFixture(1);
  const base = buildCreationPlan(input);
  assert.throws(
    () => applyCreationMarketingPlan(base, payload, { count: 1, referenceCount: 1, primaryIndex: 2 }),
    /不存在的主主体或商品事实来源图/,
  );
});

test("planning keeps the same primary subject before and after model analysis", async () => {
  const { input, payload } = marketingPlanFixture(3);
  input.referenceImageRoles[0].role = "product";
  const images = [...referenceImages, { ...referenceImages[0], filename: "alternate.png" }];
  input.referenceImageRoles.push({ index: 2, filename: "alternate.png", role: "feature" });
  payload.reference_roles = [
    { index: 2, filename: "alternate.png", role: "product", note: "另一角度" },
    { index: 1, filename: "gloves.png", role: "material", note: "主体和材质细节" },
  ];
  let calls = 0;
  const result = await requestCreationMarketingPlan({ input, referenceImages: images, config, fetchImpl: async (_url, init) => {
    calls += 1;
    const context = JSON.parse(JSON.parse(init.body).input[0].content.find((entry) => entry.text?.startsWith('{"task_count"')).text);
    assert.equal(context.primary_reference_index, 1);
    return new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { headers: { "content-type": "application/json" } });
  } });
  assert.equal(calls, 1);
  assert.equal(result.referenceImageRoles.find((entry) => entry.role === "product").index, 1);
  assert.equal(result.marketingPlan.primaryReferenceIndex, 1);
  assert.deepEqual(result.items[0].marketingAssignment.referenceIndexes, [1]);
});

test("a truncated marketing JSON cannot masquerade as its first nested fact object", () => {
  assert.throws(() => extractPromptAgentJson('{"summary":"规划","product_insights":{"confirmed_facts":[{"id":"one","text":"商品"}]}', "", CREATION_MARKETING_PLAN_MODE), /JSON|items|提示词/);
});

test("an SSE completion containing only nested truncated JSON fails instead of returning zero items", async () => {
  const text = '{"summary":"规划","product_insights":{"confirmed_facts":[{"id":"one","text":"商品"}]}';
  const stream = new Response(`event: response.output_text.done\ndata: ${JSON.stringify({ type: "response.output_text.done", text })}\n\ndata: [DONE]\n\n`).body;
  await assert.rejects(() => consumePromptAgentSse(stream, CREATION_MARKETING_PLAN_MODE), /JSON|items/);
});

test("analysis-only response gets one whole-plan repair with an explicit output schema", async () => {
  const { payload } = marketingPlanFixture(20);
  const analysisOnly = structuredClone(payload);
  delete analysisOnly.items;
  const bodies = [];
  const result = await requestPromptAgentAnalysis({ ...config, images: referenceImages, mode: CREATION_MARKETING_PLAN_MODE, contextPrompt: JSON.stringify({ task_count: 20 }), fetchImpl: async (_url, init) => {
    bodies.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ output_text: JSON.stringify(bodies.length === 1 ? analysisOnly : payload) }), { headers: { "content-type": "application/json" } });
  } });
  assert.equal(bodies.length, 2);
  assert.equal(result.items.length, 20);
  assert.equal(bodies[1].text.format.schema.properties.items.minItems, 20);
  assert.equal(bodies[1].text.format.schema.properties.items.maxItems, 20);
  assert.ok(bodies[1].input[0].content.some((part) => part.text?.includes('"reference_indexes"') && part.text?.includes('"items"')));
});

test("empty marketing response retries only once and reports missing tasks clearly", async () => {
  let calls = 0;
  await assert.rejects(() => requestPromptAgentAnalysis({ ...config, images: referenceImages, mode: CREATION_MARKETING_PLAN_MODE, contextPrompt: JSON.stringify({ task_count: 20 }), fetchImpl: async () => {
    calls += 1;
    return new Response(JSON.stringify({ output_text: '{"items":[]}' }), { headers: { "content-type": "application/json" } });
  } }), /AI 未返回整套图片任务/);
  assert.equal(calls, 2);
});

test("a gateway without structured-output support still receives the complete planning schema", async () => {
  const { payload } = marketingPlanFixture(20);
  const bodies = [];
  const result = await requestPromptAgentAnalysis({ ...config, images: referenceImages, mode: CREATION_MARKETING_PLAN_MODE, contextPrompt: JSON.stringify({ task_count: 20 }), fetchImpl: async (_url, init) => {
    const body = JSON.parse(init.body);
    bodies.push(body);
    return bodies.length === 1
      ? new Response(JSON.stringify({ error: { message: "json_schema unsupported" } }), { status: 400 })
      : new Response(JSON.stringify({ output_text: JSON.stringify(payload) }), { headers: { "content-type": "application/json" } });
  } });
  assert.equal(bodies.length, 2);
  assert.equal(bodies[1].text, undefined);
  assert.ok(bodies[1].input[0].content.some((part) => part.text?.includes('"reference_indexes"') && part.text?.includes('"items"')));
  assert.equal(result.items.length, 20);
});

test("explicit reference assignments keep original upload numbers and enforce their byte budget", async () => {
  const { plan } = await planned(3);
  const images = [1, 2, 3].map((referenceIndex) => ({ ...referenceImages[0], referenceIndex, filename: `reference-${referenceIndex}.png` }));
  const roles = images.map((image, index) => ({ index: index + 1, filename: image.filename, role: index ? "feature" : "reference-product" }));
  const item = structuredClone(plan.items[0]);
  item.marketingAssignment.referenceIndexes = [1, 3];
  item.contentAssignment.referenceSources = [{ index: 1, note: "主主体" }, { index: 3, note: "本图证据" }];
  const selected = buildCreationItemReferenceImages(item, images, roles);
  assert.deepEqual(selected.map((image) => image.referenceIndex), [1, 3]);
  const labels = buildCreationGenerationReferenceImageLabels(selected, roles, item);
  assert.match(labels[1], /^Reference 3:/);
  assert.ok(labels[1].includes("本图证据"));
  assert.throws(() => buildCreationItemReferenceImages(item, images, roles, { maxBytes: 1 }), /超出预算/);
});
