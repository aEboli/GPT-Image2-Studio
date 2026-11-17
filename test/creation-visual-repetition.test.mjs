import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { applyCreationMarketingPlan, CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { auditCreationMarketingQuality, finalizeCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { buildCreationMarketingArtDirection, createCreationMarketingAgentSelector } from "../lib/creation-marketing-personas.mjs";
import { getCreationSceneActionGroup } from "../lib/creation-product-insights.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }];
const config = { baseUrl: "https://example.test/v1", responsesModel: "visual-repetition-test", apiKey: "test" };
const apply = ({ input, payload }, creativeAgent) => applyCreationMarketingPlan(buildCreationPlan(input), payload,
  { count: payload.items.length, referenceCount: 1, primaryIndex: 1, creativeAgent });
const duplicates = (plan) => auditCreationMarketingQuality(plan).issues.filter((issue) => issue.code === "duplicate-task" && issue.confidence === "high");

function nearPrompts() {
  const fixture = marketingPlanFixture(4);
  for (const [offset, row] of fixture.payload.items.slice(2).entries()) {
    row.image_type = "scene-application";
    Object.assign(row.creative_brief, { visual_form: "use-scene", action: offset ? "整理围巾" : "转动门锁钥匙", action_group: offset ? "scarf-adjust" : "key-turn" });
    row.prompt = `Photograph the reference gloves ${offset ? "firmly " : ""}gripping bicycle handlebars, overhead close-up, with natural morning light and the actual fabric and controls preserved. Overlay text: "${offset ? "Weekend" : "Commute"}".`;
  }
  return fixture;
}

test("near-identical actual prompts cannot hide behind distinct scene briefs", () => {
  const issues = duplicates(apply(nearPrompts()));
  assert.deepEqual(issues.map((issue) => issue.itemId), ["ai-4"]);
  assert.equal(issues[0].basis, "prompt");
});

test("common product descriptions do not hide a real change of interaction", () => {
  const fixture = nearPrompts();
  fixture.payload.items[3].prompt = fixture.payload.items[2].prompt.replace("gripping bicycle handlebars", "adjusting a scarf");
  assert.deepEqual(duplicates(apply(fixture)), []);
});

test("shared product feature prose cannot turn different actual interactions into duplicates", () => {
  const fixture = nearPrompts();
  const common = "Reference gloves have smartphone-compatible finger fabric and a controller on the back, matching the original markings, seams and material. ";
  fixture.payload.items[2].prompt = common + fixture.payload.items[2].prompt;
  fixture.payload.items[3].prompt = common + fixture.payload.items[2].prompt.slice(common.length).replace("gripping bicycle handlebars", "adjusting a scarf");
  assert.deepEqual(duplicates(apply(fixture)), []);
});

test("near-prompt checks preserve meaningful numeric and close-up subject differences", () => {
  for (const replacement of ["gripping 2 bicycle handlebars", "operating a camera shutter"]) {
    const fixture = nearPrompts();
    fixture.payload.items[3].prompt = fixture.payload.items[2].prompt.replace("gripping bicycle handlebars", replacement);
    assert.deepEqual(duplicates(apply(fixture)), []);
  }
});

test("visible product controls and negated props do not replace the real scene operation", () => {
  assert.equal(getCreationSceneActionGroup({ action: "戴手套双手在胸前合拢，控制器55可见，不操作手机", action_group: "hands-warmup" }), "hands-warmup");
  assert.equal(getCreationSceneActionGroup({ action: "戴手套抓住扶手，手背控制器55清晰", action_group: "rail-grip" }), "rail-grip");
  assert.equal(getCreationSceneActionGroup({ action: "转动门锁钥匙，不出现车把或手机", action_group: "key-turn" }), "key-turn");
  assert.equal(getCreationSceneActionGroup({ action: "按下手背控制器切换档位" }), "control-operation");
  assert.equal(getCreationSceneActionGroup({ action: "戴手套握住车把，不操作手机", action_group: "new-name" }), "handlebar-grip");
  assert.equal(getCreationSceneActionGroup({ action: "戴手套握住登山杖握把，控制器55可见，不出现车把或手机", action_group: "trekking-pole-grip" }), "trekking-pole-grip");
});

function floatingRenders() {
  const fixture = marketingPlanFixture(5);
  fixture.payload.items.slice(2).forEach((row, index) => {
    row.image_type = index === 2 ? "ownership-atmosphere" : "comparison-proof";
    row.fact_ids.push("heat");
    Object.assign(row.creative_brief, {
      visual_form: index === 2 ? "commercial-cg" : "functional-render", text_density: index === 2 ? "none" : "minimal",
      action: ["一双手套斜向悬浮，暖流从指尖升起", "手套漂浮，五指与手背覆盖热流", "悬空陈列完整商品，暖光形成空间层次"][index],
      framing: ["中近景，商品一前一后", "主体居中偏左，中近景", "斜向近景，主体占80%"][index],
      effect_visual: "完整手套周围的半透明暖色热流，保留真实布料与结构，不作为热成像实测",
    });
    row.prompt = `${row.creative_brief.action}。${row.creative_brief.framing}。${row.creative_brief.effect_visual}。`;
  });
  return fixture;
}

test("the same floating heat render shares its repeat budget across hero, function and CG types", () => {
  const plan = apply(floatingRenders());
  assert.deepEqual(duplicates(plan).map((issue) => issue.itemId), ["ai-5"]);
  const final = finalizeCreationMarketingQuality(plan, auditCreationMarketingQuality(plan));
  assert.equal(final.items[4].evidenceBlocked, true);
  assert.equal(final.pendingAdjustmentCount, 1);
  assert.deepEqual(buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(final) }).items.map((item) => item.prompt), final.items.map((item) => item.prompt));
});

test("distinct functional evidence does not share a budget merely because the product floats", () => {
  const fixture = floatingRenders();
  fixture.payload.items[4].fact_ids = ["appearance", "control", "fingers"];
  fixture.payload.items[4].creative_brief.effect_visual = "仅用侧光展示布料纹理，不表现加热或功能光效";
  assert.deepEqual(duplicates(apply(fixture)), []);
});

test("a supported resting pose is not grouped as floating because the action forbids floating", () => {
  const fixture = floatingRenders();
  fixture.payload.items[4].creative_brief.action = "手套平放在白色桌面，不悬浮、不漂浮、不悬空";
  assert.deepEqual(duplicates(apply(fixture)), []);
});

test("the frame camera takes precedence over the campaign composition vocabulary", () => {
  const agent = createCreationMarketingAgentSelector({ random: () => 0 })();
  const framing = "全景，人物与环境同框，商品在真实操作中清晰可辨";
  const instruction = buildCreationMarketingArtDirection(agent, { marketingAssignment: { creativeBrief: { framing, visual_form: "use-scene" } } });
  assert.ok(instruction.includes(framing));
  assert.match(instruction, /frame.*takes priority|takes priority.*frame/iu);
  const white = buildCreationMarketingArtDirection(agent, { imageType: "clean-catalog-main", marketingAssignment: { creativeBrief: { framing } } });
  assert.ok(!white.includes(framing));
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /手部近景.*虚化背景/u);
});

function closeupScenes() {
  const fixture = marketingPlanFixture(7);
  const actions = ["转动门锁钥匙", "拉开背包拉链", "扣紧背包搭扣", "整理围巾衣领", "放好随身行李"];
  fixture.payload.items.slice(2).forEach((row, index) => {
    row.image_type = index % 2 ? "scene-application" : "creator-demo";
    Object.assign(row.creative_brief, { visual_form: index % 2 ? "use-scene" : "product-photograph", action: actions[index], action_group: `real-task-${index}`,
      framing: ["侧面手部近景，背景虚化", "俯拍近景，双手为焦点", "手部操作特写", "手部近距离镜头", "中近景，手与行李为焦点"][index] });
    row.prompt = `以真实参考手套${actions[index]}，${row.creative_brief.framing}，保留真实布料结构。`;
  });
  return fixture;
}

test("a long run of different actions still requests camera variation when closeups dominate", () => {
  const plan = apply(closeupScenes());
  const quality = auditCreationMarketingQuality(plan);
  const issues = quality.issues.filter((issue) => issue.code === "layout-repetition");
  assert.deepEqual(issues.map((issue) => issue.itemId), ["ai-6", "ai-7"]);
  assert.deepEqual(duplicates(plan), [], "real different uses remain valid scene tasks");
  assert.equal(finalizeCreationMarketingQuality(plan, quality).imageCount, 7, "camera rhythm is advisory and does not discard valid uses");
  plan.items[5].marketingAssignment.creativeBrief.framing = "环境全景，人物与门廊同框";
  plan.items[6].marketingAssignment.creativeBrief.framing = "平视中景，人物与行李关系清楚";
  assert.deepEqual(auditCreationMarketingQuality(plan).issues.filter((issue) => issue.code === "layout-repetition"), []);
});

test("camera variation preserves locked and explicitly selected image directions", () => {
  const plan = apply(closeupScenes());
  const options = { lockedItems: [{ item_id: "ai-6" }, { item_id: "ai-7" }] };
  const issues = auditCreationMarketingQuality(plan, options).issues.filter((issue) => issue.code === "layout-repetition");
  assert.deepEqual(issues.map((issue) => issue.itemId), ["ai-4", "ai-5"]);
  assert.deepEqual(auditCreationMarketingQuality(plan, { selectedRoles: plan.items.map((item) => item.role) }).issues.filter((issue) => issue.code === "layout-repetition"), []);
});

for (const repaired of [true, false]) {
  test(`camera rhythm ${repaired ? "repairs only surplus closeups" : "stays advisory after bounded repairs"}`, async () => {
    const fixture = closeupScenes();
    const replacements = structuredClone(fixture.payload.items.slice(5));
    if (repaired) replacements.forEach((row, index) => {
      row.creative_brief.framing = index ? "平视中景，人物与行李关系清楚" : "环境全景，人物与门廊同框";
      row.prompt = `以真实参考手套${row.creative_brief.action}，${row.creative_brief.framing}，保留实物结构。`;
    });
    let calls = 0;
    const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages, config, fetchImpl: async (_url, init) => {
      calls += 1;
      if (calls === 1) return Response.json({ output_text: JSON.stringify(fixture.payload) });
      const context = JSON.parse(JSON.parse(init.body).input[0].content[1].text);
      assert.deepEqual(context.repair_request.target_item_ids, ["ai-6", "ai-7"]);
      return Response.json({ output_text: JSON.stringify({ suite_strategy: fixture.payload.suite_strategy, items: replacements }) });
    } });
    assert.equal(calls, repaired ? 2 : 3);
    assert.equal(plan.imageCount, 7);
    assert.equal(plan.pendingAdjustmentCount, 0);
    assert.equal(plan.marketingPlan.quality.issues.filter((issue) => issue.code === "layout-repetition").length, repaired ? 0 : 2);
    assert.deepEqual(plan.items.slice(0, 5).map((item) => item.prompt), apply(fixture, plan.marketingPlan.creativeAgent).items.slice(0, 5).map((item) => item.prompt));
  });
}

for (const repaired of [true, false]) {
  test(`near visual duplicates ${repaired ? "repair locally" : "remain blocked after two repairs"}`, async () => {
    const fixture = nearPrompts();
    const replacement = structuredClone(fixture.payload.items[3]);
    replacement.prompt = "Photograph the reference gloves adjusting a scarf, side-on medium view including the person and doorway.";
    let calls = 0;
    const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages, config, fetchImpl: async (_url, init) => {
      calls += 1;
      if (calls === 1) return Response.json({ output_text: JSON.stringify(fixture.payload) });
      const context = JSON.parse(JSON.parse(init.body).input[0].content[1].text);
      assert.deepEqual(context.repair_request.target_item_ids, ["ai-4"]);
      assert.equal(context.repair_request.accepted_items.find((item) => item.item_id === "ai-3").prompt, fixture.payload.items[2].prompt);
      return Response.json({ output_text: JSON.stringify({ suite_strategy: fixture.payload.suite_strategy, items: [repaired ? replacement : fixture.payload.items[3]] }) });
    } });
    assert.equal(calls, repaired ? 2 : 3);
    assert.equal(plan.pendingAdjustmentCount, repaired ? 0 : 1);
    assert.deepEqual(plan.items.slice(0, 3).map((item) => item.prompt), apply(fixture, plan.marketingPlan.creativeAgent).items.slice(0, 3).map((item) => item.prompt));
  });
}
