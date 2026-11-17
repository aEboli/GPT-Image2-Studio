import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext, CREATION_MARKETING_ITEMS_SCHEMA, CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { auditCreationMarketingQuality, finalizeCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { creationMarketingInputFingerprint, requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { createPromptAgentRequestBody, CREATION_REFERENCE_ANALYSIS_MODE } from "../lib/prompt-agent.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { allocateCreationProductScenes, getCreationSceneActionGroup } from "../lib/creation-product-insights.mjs";

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
const apply = ({ input, payload }, creativeAgent) => applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 6, referenceCount: 1, primaryIndex: 1, creativeAgent });

function distinctScenes() {
  const fixture = scenes();
  const actions = ["戴手套握住车把", "戴手套握住牵引绳遛狗", "戴手套按下相机快门", "戴手套整理营地装备"];
  const settings = ["冬季公园骑行道", "公园遛狗步道", "公园观景台", "公园露营区"];
  fixture.payload.items.slice(2).forEach((row, index) => {
    Object.assign(row.creative_brief, { action: actions[index], scene: settings[index] });
    row.prompt = `在${settings[index]}，${actions[index]}，${row.creative_brief.framing}，以实际产品为主体。`;
  });
  return fixture;
}

test("one product use scene appears only once even when all camera relationships differ", () => {
  const plan = apply(scenes());
  const quality = auditCreationMarketingQuality(plan);
  const duplicates = quality.issues.filter((issue) => issue.code === "duplicate-task");
  assert.deepEqual(duplicates.map((issue) => issue.itemId), ["ai-4", "ai-5", "ai-6"]);
  assert.ok(duplicates.every((issue) => issue.confidence === "high"));
  const final = finalizeCreationMarketingQuality(plan, quality);
  assert.equal(final.imageCount, 3);
  assert.equal(final.pendingAdjustmentCount, 3);
  assert.ok(final.items.slice(3).every((item) => item.evidenceBlocked && !item.enabled));
});

test("different creative actions may share evidence and a common photographic layout", () => {
  const fixture = distinctScenes();
  fixture.payload.items.slice(2).forEach((row) => { row.creative_brief.framing = "手部操作近景"; });
  assert.deepEqual(auditCreationMarketingQuality(apply(fixture)).issues, []);
});

for (const mixed of [false, true]) {
  test("AI marketing detects repeated scenes tagged as " + (mixed ? "mixed visual forms" : "product photography"), () => {
    const fixture = scenes();
    fixture.payload.items.slice(2).forEach((row, index) => {
      row.creative_brief.visual_form = mixed && index % 2 ? "use-scene" : "product-photograph";
      row.image_type = index % 2 ? "creator-demo" : "scene-application";
    });
    const plan = apply(fixture);
    const quality = auditCreationMarketingQuality(plan);
    assert.deepEqual(quality.issues.filter((issue) => issue.code === "duplicate-task" && issue.confidence === "high").map((issue) => issue.itemId), ["ai-4", "ai-5", "ai-6"]);
    assert.ok(plan.items.slice(2).every((item) => item.prompt.includes("SCENE DIRECTION:") && item.prompt.includes("physically plausible")));
    assert.equal(finalizeCreationMarketingQuality(plan, quality).pendingAdjustmentCount, 3);
  });
}

test("AI marketing keeps distinct photographic scenes outside the static and layout quotas", () => {
  const fixture = distinctScenes();
  fixture.payload.items.slice(2).forEach((row) => {
    row.creative_brief.visual_form = "product-photograph";
    row.creative_brief.framing = "手部操作近景";
  });
  assert.deepEqual(auditCreationMarketingQuality(apply(fixture)).issues, []);
});

test("non-AI marketing keeps one core scene and gives other slots distinct product uses", () => {
  const fixture = scenes();
  fixture.input.productInsights.usage_scenarios = fixture.payload.items.slice(2).map((row, index) => ({
    id: `use-${index}`, title: `使用场景${index}`, environment: row.creative_brief.scene,
    action: index === 3 ? "戴手套按下相机快门" : row.creative_brief.action,
    action_group: index === 3 ? "camera-operation" : `riding-${index}`,
    framing: row.creative_brief.framing, people: "hands", fact_ids: ["appearance"], pain_point_ids: [],
  }));
  const plan = buildCreationPlan({ ...fixture.input, aiMarketingEnabled: false,
    selectedRoles: ["scene", "scene-fit-1", "scene-fit-2", "scene-fit-3"] });
  const items = plan.items.filter((item) => item.sceneAssignment && !item.evidenceBlocked);
  assert.equal(items.length, 2);
  assert.equal(new Set(items.map((item) => getCreationSceneActionGroup(item.sceneAssignment))).size, 2);
  assert.ok(items.every((item) => item.prompt.includes("physically plausible")));
});

test("non-AI scene prompts keep realistic product use even without reference analysis", () => {
  const plan = buildCreationPlan({ productName: "保暖手套", productDescription: "全指手套",
    aiMarketingEnabled: false, skuGenerationEnabled: false, imageCount: 2, selectedRoles: ["scene", "scene-fit-1"] });
  const items = plan.items.filter((item) => item.itemKind === "carousel");
  assert.equal(items.length, 2);
  assert.ok(items.every((item) => item.prompt.includes("physically plausible") && item.prompt.includes("product's real use")));
});

test("a locked scene keeps its prompt while repeated automatic scenes are blocked", () => {
  const plan = apply(scenes());
  const locked = plan.items[5];
  const options = { lockedItems: [{ item_id: locked.itemId }] };
  const quality = auditCreationMarketingQuality(plan, options);
  const final = finalizeCreationMarketingQuality(plan, quality, options);
  assert.equal(final.items[5].prompt, locked.prompt);
  assert.equal(final.items[5].enabled, true);
  assert.deepEqual(final.items.slice(2, 5).map((item) => item.evidenceBlocked), [true, true, true]);
  assert.equal(final.imageCount, 3);
});

test("genuinely repeated scenes still receive duplicate-task issues", () => {
  const fixture = scenes();
  fixture.payload.items[3].creative_brief.framing = fixture.payload.items[2].creative_brief.framing;
  assert.ok(auditCreationMarketingQuality(apply(fixture)).issues.some((issue) => issue.code === "duplicate-task" && issue.confidence === "high"));
});

test("local scene allocation uses each core action only once", () => {
  const fixture = scenes();
  const usageScenarios = fixture.payload.items.slice(2).map((row, index) => ({ id: "creative-" + index,
    environment: row.creative_brief.scene, action: row.creative_brief.action, framing: row.creative_brief.framing,
    actionGroup: "handlebar-grip", factIds: ["appearance"], people: "hands", painPointIds: [] }));
  const allocated = allocateCreationProductScenes(Array.from({ length: 4 }, () => ({ role: "scene" })), { usageScenarios, confirmedFacts: [] });
  assert.equal(allocated.filter(Boolean).length, 1);
});

test("AI scene identities are open product-led groups rather than a fixed list of uses", () => {
  const schema = CREATION_MARKETING_ITEMS_SCHEMA.items.properties.creative_brief;
  assert.ok(schema.required.includes("action_group"));
  assert.equal(schema.properties.action_group.type, "string");
  assert.equal(Object.hasOwn(schema.properties.action_group, "enum"), false);
  const fixture = distinctScenes();
  const actions = ["转动门锁里的钥匙", "拉开背包拉链", "扣紧背包搭扣", "整理围巾与衣领"];
  const groups = ["key-turn", "zipper-open", "buckle-fasten", "scarf-adjust"];
  fixture.payload.items.slice(2).forEach((row, index) => {
    Object.assign(row.creative_brief, { action: actions[index], action_group: groups[index] });
    row.prompt = `保留参考手套，在实际使用中${actions[index]}，${row.creative_brief.framing}。`;
  });
  const plan = apply(fixture);
  assert.deepEqual(plan.items.slice(2).map((item) => item.marketingAssignment.creativeBrief.action_group), groups);
  assert.deepEqual(auditCreationMarketingQuality(plan).issues, []);
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const stored = normalizeCreationSetManifest({ setId: "open-scene-groups", effectivePlan: frozen, items: frozen.items });
  const repair = buildCreationRepairPlan(stored);
  for (const result of [frozen, stored, repair]) {
    assert.deepEqual(result.items.slice(2).map((item) => item.marketingAssignment.creativeBrief.action_group), groups);
    assert.deepEqual(result.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
  }
});

test("open scene groups detect paraphrased interactions beyond the built-in recognizers", () => {
  const fixture = distinctScenes();
  const [left, right] = fixture.payload.items.slice(2);
  Object.assign(left.creative_brief, { action: "将钥匙插入门锁并旋转", action_group: "key-turn" });
  Object.assign(right.creative_brief, { action: "手握钥匙转开大门锁芯", action_group: "key-turn" });
  const plan = apply(fixture);
  const quality = auditCreationMarketingQuality(plan);
  assert.ok(quality.issues.some((issue) => issue.itemId === right.item_id && issue.code === "duplicate-task" && issue.confidence === "high"));
  assert.equal(finalizeCreationMarketingQuality(plan, quality).items[3].evidenceBlocked, true);
});

test("renaming an AI scene group cannot repeat an identical unfamiliar action", () => {
  const fixture = distinctScenes();
  fixture.payload.items.slice(2, 4).forEach((row, index) => {
    Object.assign(row.creative_brief, { action: "戴手套拉开背包拉链", action_group: `zipper-${index}` });
  });
  assert.ok(auditCreationMarketingQuality(apply(fixture)).issues.some((issue) => issue.itemId === "ai-4" && issue.code === "duplicate-task" && issue.confidence === "high"));
});

test("ordinary hero scene cues never reuse an action already assigned to a scene image", () => {
  const fixture = scenes();
  const actions = ["戴手套转动门锁钥匙", "戴手套拉开背包拉链", "戴手套整理围巾", "戴手套扣上背包搭扣"];
  fixture.input.productInsights.usage_scenarios = actions.map((action, index) => ({
    id: `open-${index}`, title: `实际用途${index}`, action, action_group: `product-task-${index}`,
    environment: "出门准备区", framing: "手部操作近景", people: "hands", fact_ids: ["appearance"], pain_point_ids: [],
  }));
  for (const sceneCount of [2, 4]) {
    const plan = buildCreationPlan({ ...fixture.input, aiMarketingEnabled: false,
      selectedRoles: ["hero", ...["scene", "scene-fit-1", "scene-fit-2", "scene-fit-3"].slice(0, sceneCount)] });
    const used = new Set(plan.items.filter((item) => item.sceneAssignment).map((item) => getCreationSceneActionGroup(item.sceneAssignment)));
    const hero = plan.items.find((item) => item.role === "hero");
    const heroScenes = hero.contentAssignment.sceneAssignments;
    assert.equal(heroScenes.length, sceneCount === 4 ? 0 : 1);
    assert.ok(heroScenes.every((scene) => !used.has(getCreationSceneActionGroup(scene))));
    if (sceneCount === 4) {
      assert.ok(!hero.prompt.includes("Scene cues:"));
      assert.ok(hero.prompt.includes("studio product-only composition"));
    }
  }
});

test("renamed action groups cannot repeat a recognized product interaction", () => {
  const usageScenarios = ["commute-close", "weekend-wide"].map((actionGroup, index) => ({
    id: "renamed-" + index, action: "戴手套握住车把", actionGroup, framing: index ? "侧面全景" : "俯拍近景",
  }));
  const allocated = allocateCreationProductScenes([{ role: "scene" }, { role: "scene" }], { usageScenarios });
  assert.equal(allocated.filter(Boolean).length, 1);
});

test("renaming a custom action group cannot duplicate an identical generic action", () => {
  const usageScenarios = ["camp-packing", "garden-packing"].map((actionGroup, index) => ({
    id: "custom-" + index, action: "戴手套整理营地装备", actionGroup, framing: index ? "侧面全景" : "俯拍近景",
  }));
  const allocated = allocateCreationProductScenes([{ role: "scene" }, { role: "scene" }], { usageScenarios });
  assert.equal(allocated.filter(Boolean).length, 1);
});

test("a generic repeated core action cannot be rescued by changing scene and framing", () => {
  const fixture = distinctScenes();
  const [left, right] = fixture.payload.items.slice(2);
  left.creative_brief.action = "戴手套整理营地装备";
  right.creative_brief.action = "戴手套整理营地装备";
  right.creative_brief.scene = "自家院子";
  const duplicates = auditCreationMarketingQuality(apply(fixture)).issues.filter((issue) => issue.code === "duplicate-task");
  assert.ok(duplicates.some((issue) => issue.itemId === right.item_id && issue.confidence === "high"));
});

test("phone scenes remain one task across backgrounds, applications and camera angles", () => {
  const fixture = distinctScenes();
  const rows = fixture.payload.items.slice(2);
  ["停在路边查看手机地图", "公园长椅上点按手机相机", "家中查看手机消息", "营地操作手机"].forEach((action, index) => {
    rows[index].creative_brief.action = action;
  });
  const duplicates = auditCreationMarketingQuality(apply(fixture)).issues.filter((issue) => issue.code === "duplicate-task");
  assert.equal(duplicates.length, 3);
  assert.ok(duplicates.every((issue) => issue.confidence === "high"));
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
  assert.equal(context.quality_requirements.maxImagesPerScene, 1);
  assert.ok(CREATION_MARKETING_PLAN_INSTRUCTION.includes("场景不必在源图中出现"));
  assert.ok(CREATION_MARKETING_PLAN_INSTRUCTION.includes("不是白名单"));
  const body = createPromptAgentRequestBody({ images: referenceImages, mode: CREATION_REFERENCE_ANALYSIS_MODE, responsesModel: "test" });
  assert.ok(body.input[0].content[0].text.includes("场景不必在源图中出现"));
  assert.ok(CREATION_MARKETING_PLAN_INSTRUCTION.includes("同一核心操作场景只能出现一次"));
  assert.ok(body.input[0].content[0].text.includes("同一核心操作场景只能出现一次"));
  assert.ok(CREATION_MARKETING_PLAN_INSTRUCTION.includes("符合现实"));
  assert.ok(apply(fixture).items[2].prompt.includes("need not appear in the source images"));
  assert.ok(apply(fixture).items[2].prompt.includes("physically plausible"));
  assert.notEqual(creationMarketingInputFingerprint(fixture.input), creationMarketingInputFingerprint(fixture.input, [], { planningContractVersion: 11 }));
  assert.notEqual(creationMarketingInputFingerprint(fixture.input), creationMarketingInputFingerprint(fixture.input, [], { planningContractVersion: 12 }));
  assert.notEqual(creationMarketingInputFingerprint(fixture.input), creationMarketingInputFingerprint(fixture.input, [], { planningContractVersion: 13 }));
});

test("novel scenes outside analysis suggestions are accepted in one planning call", async () => {
  const fixture = distinctScenes();
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages,
    config: { baseUrl: "https://example.test/v1", responsesModel: "scene-divergence-test", apiKey: "test" },
    fetchImpl: async () => { calls += 1; return Response.json({ output_text: JSON.stringify(fixture.payload) }); },
  });
  assert.equal(calls, 1);
  assert.equal(plan.imageCount, 6);
  assert.equal(plan.marketingPlan.quality.repairRounds, 0);
});

test("repeated scenes are repaired into related real uses without rewriting accepted items", async () => {
  const fixture = scenes();
  const repaired = distinctScenes();
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages,
    config: { baseUrl: "https://example.test/v1", responsesModel: "scene-divergence-test", apiKey: "test" },
    fetchImpl: async (_url, init) => {
      calls += 1;
      if (calls === 1) return Response.json({ output_text: JSON.stringify(fixture.payload) });
      const context = JSON.parse(JSON.parse(init.body).input[0].content[1].text);
      assert.deepEqual(context.repair_request.target_item_ids, ["ai-4", "ai-5", "ai-6"]);
      assert.equal(context.quality_requirements.maxImagesPerScene, 1);
      return Response.json({ output_text: JSON.stringify({ suite_strategy: repaired.payload.suite_strategy, items: repaired.payload.items.slice(3) }) });
    },
  });
  assert.equal(calls, 2);
  assert.equal(plan.imageCount, 6);
  assert.equal(plan.marketingPlan.quality.repairRounds, 1);
  assert.deepEqual(plan.marketingPlan.quality.issues, []);
  assert.deepEqual(plan.items.slice(0, 3).map((item) => item.prompt), apply(fixture, plan.marketingPlan.creativeAgent).items.slice(0, 3).map((item) => item.prompt));
});

test("unrepaired scenes stop after two repair rounds and remain blocked", async () => {
  const fixture = scenes();
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages,
    config: { baseUrl: "https://example.test/v1", responsesModel: "scene-divergence-test", apiKey: "test" },
    fetchImpl: async () => {
      calls += 1;
      return Response.json({ output_text: JSON.stringify(calls === 1 ? fixture.payload
        : { suite_strategy: fixture.payload.suite_strategy, items: fixture.payload.items.slice(3) }) });
    },
  });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 3);
  assert.equal(plan.pendingAdjustmentCount, 3);
  assert.deepEqual(plan.marketingPlan.quality.blockedItemIds, ["ai-4", "ai-5", "ai-6"]);
});

test("open scene groups reach local repair and preserve already accepted prompts", async () => {
  const fixture = distinctScenes();
  const [left, right] = fixture.payload.items.slice(2);
  Object.assign(left.creative_brief, { action: "将钥匙插入门锁并旋转", action_group: "key-turn" });
  Object.assign(right.creative_brief, { action: "手握钥匙转开大门锁芯", action_group: "key-turn" });
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages,
    config: { baseUrl: "https://example.test/v1", responsesModel: "scene-divergence-test", apiKey: "test" },
    fetchImpl: async (_url, init) => {
      calls += 1;
      if (calls === 1) return Response.json({ output_text: JSON.stringify(fixture.payload) });
      const context = JSON.parse(JSON.parse(init.body).input[0].content[1].text);
      assert.deepEqual(context.repair_request.target_item_ids, [right.item_id]);
      assert.equal(context.repair_request.accepted_items.find((item) => item.item_id === left.item_id).creative_brief.action_group, "key-turn");
      const row = structuredClone(right);
      Object.assign(row.creative_brief, { action: "戴手套拉开背包拉链", action_group: "zipper-open" });
      row.prompt = "以参考手套为主体，戴手套拉开背包拉链，近景展示真实操作与商品比例。";
      return Response.json({ output_text: JSON.stringify({ items: [row], suite_strategy: fixture.payload.suite_strategy }) });
    },
  });
  assert.equal(calls, 2);
  assert.equal(plan.marketingPlan.quality.repairRounds, 1);
  assert.deepEqual(plan.marketingPlan.quality.issues, []);
  assert.deepEqual(plan.items.filter((item) => item.itemId !== right.item_id).map((item) => item.prompt), apply(fixture, plan.marketingPlan.creativeAgent).items.filter((item) => item.itemId !== right.item_id).map((item) => item.prompt));
  assert.equal(plan.items[3].marketingAssignment.creativeBrief.action_group, "zipper-open");
});
