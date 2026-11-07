import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext } from "../lib/creation-marketing-plan.mjs";
import { auditCreationMarketingQuality, finalizeCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { selectCreationRepairItems } from "../lib/creation-repair.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

function dimensions(count = 6) {
  const { input, payload } = marketingPlanFixture(count);
  for (let index = 2; index < count; index += 1) {
    payload.items[index].image_type = index % 2 ? "spec-table" : "dimension-fit";
    Object.assign(payload.items[index].creative_brief, {
      action: ["核对两款尺寸", "检查款式尺码", "对照长度与宽度", "根据尺寸选码"][index - 2],
      framing: "正视两款商品并排，下方尺寸标线与表格",
      evidence_focus: ["两款大小", "尺码选择", "长宽标注", "款式尺寸"][index - 2],
      visual_form: "information-layout", text_density: "structured",
    });
  }
  return { input, payload };
}
const apply = ({ input, payload }) => applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: payload.items.length, referenceCount: 1, primaryIndex: 1 });
const duplicates = (plan, options) => auditCreationMarketingQuality(plan, options).issues.filter((issue) => issue.code === "duplicate-task" && issue.confidence === "high");

test("dimension and specification cards share a maximum of two similar alternatives", () => {
  const plan = apply(dimensions());
  assert.deepEqual(duplicates(plan).map((issue) => issue.itemId), ["ai-5", "ai-6"]);
  const final = finalizeCreationMarketingQuality(plan, auditCreationMarketingQuality(plan));
  assert.equal(final.imageCount, 4);
  assert.equal(final.pendingAdjustmentCount, 2);
  assert.equal(final.items.length, 6);
  assert.ok(final.items.slice(2, 4).every((item) => item.enabled));
  assert.ok(final.items.slice(4).every((item) => item.evidenceBlocked));
});

test("two static alternatives remain available without a hard duplicate block", () => {
  assert.deepEqual(duplicates(apply(dimensions(4))), []);
});

test("different evidence does not share a repeat budget just because facts and framing match", () => {
  const fixture = marketingPlanFixture(6);
  for (const [index, evidence] of [[2, "掌心防滑纹理"], [3, "腕口接缝做工"], [4, "指尖开口结构"], [5, "手背按钮外形"]]) {
    fixture.payload.items[index].image_type = "detail-macro";
    Object.assign(fixture.payload.items[index].creative_brief, { action: "观察" + evidence, evidence_focus: evidence, framing: "单个部件正面微距", visual_form: "macro-evidence" });
  }
  assert.deepEqual(duplicates(apply(fixture)), []);
});

test("repeated static poses cannot escape the budget by changing titles or copy", () => {
  const fixture = dimensions();
  for (const item of fixture.payload.items.slice(2)) Object.assign(item.creative_brief, {
    visual_form: "product-photograph", action: "完整一双手套并排平放",
    framing: "正面完整商品居中留白", evidence_focus: "同一双商品的整体外观",
  });
  const plan = apply(fixture);
  assert.deepEqual(duplicates(plan).map((issue) => issue.itemId), ["ai-5", "ai-6"]);
  for (const itemId of ["ai-5", "ai-6"]) assert.equal(auditCreationMarketingQuality(plan).issues.filter((issue) => issue.code === "duplicate-task" && issue.itemId === itemId).length, 1);
});

test("manual role selection cannot bypass the repeat budget", () => {
  const plan = apply(dimensions());
  assert.deepEqual(duplicates(plan, { selectedRoles: plan.items.map((item) => item.role) }).map((issue) => issue.itemId), ["ai-5", "ai-6"]);
});

test("explicitly different camera viewpoints remain distinct despite matching boilerplate", () => {
  const fixture = marketingPlanFixture(4);
  for (const [index, angle] of [[2, "俯拍"], [3, "侧面"]]) {
    fixture.payload.items[index].image_type = "scene-application";
    Object.assign(fixture.payload.items[index].creative_brief, { visual_form: "use-scene", action: "戴手套握住摩托车车把",
      framing: angle + "手部近景，商品完整清晰，背景虚化保留实际使用环境与真实光影，主体位于画面中央，前景保留车把" });
  }
  assert.deepEqual(duplicates(apply(fixture)), []);
});

test("paraphrased riding closeups still identify the same camera relationship", () => {
  const fixture = marketingPlanFixture(4);
  for (const [index, framing] of [[2, "骑行者双手握把特写"], [3, "手部与车把的近距离镜头"]]) {
    fixture.payload.items[index].image_type = "scene-application";
    Object.assign(fixture.payload.items[index].creative_brief, { visual_form: "use-scene", action: index === 2 ? "戴手套握电动车车把" : "戴手套抓住摩托车握把", framing });
  }
  const plan = apply(fixture);
  assert.deepEqual(duplicates(plan).map((issue) => issue.itemId), ["ai-4"]);
  plan.items[3].marketingAssignment.goal = plan.items[0].marketingAssignment.goal;
  assert.deepEqual(duplicates(plan).map((issue) => issue.itemId), ["ai-4"], "an earlier advisory match must not hide a later confirmed duplicate");
  plan.items[3].marketingAssignment.creativeBrief.framing = "侧面全景，骑行者与整辆车及道路";
  assert.deepEqual(duplicates(plan), []);
});

test("locked alternatives take priority without silently rewriting or exceeding the budget", () => {
  const plan = apply(dimensions());
  const options = { lockedItems: [{ item_id: "ai-5" }, { item_id: "ai-6" }] };
  const quality = auditCreationMarketingQuality(plan, options);
  assert.deepEqual(duplicates(plan, options).map((issue) => issue.itemId), ["ai-3", "ai-4"]);
  const final = finalizeCreationMarketingQuality(plan, quality, options);
  assert.equal(final.items[4].prompt, plan.items[4].prompt);
  assert.ok(final.items.slice(4).every((item) => item.enabled));
});

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }];
const config = { baseUrl: "https://example.test/v1", responsesModel: "repeat-budget-test", apiKey: "test" };

test("planning communicates the limit and avoids copying the source scene", () => {
  const fixture = marketingPlanFixture(4);
  const context = buildCreationMarketingContext(fixture.input, buildCreationPlan(fixture.input), referenceImages);
  assert.equal(context.quality_requirements.maxSimilarImages, 2);
  assert.ok(apply(fixture).items[3].prompt.includes("SCENE DIRECTION:"));
});

for (const repaired of [true, false]) {
  test("repeat overflow " + (repaired ? "repairs only surplus images" : "stays blocked through freezing and explicit repair"), async () => {
    const fixture = dimensions();
    let calls = 0;
    const plan = await requestCreationMarketingPlan({ input: fixture.input, referenceImages, config, fetchImpl: async (_url, init) => {
      calls += 1;
      if (calls === 1) return Response.json({ output_text: JSON.stringify(fixture.payload) });
      const context = JSON.parse(JSON.parse(init.body).input[0].content[1].text);
      assert.deepEqual(context.repair_request.target_item_ids, ["ai-5", "ai-6"]);
      assert.equal(context.repair_request.accepted_items.length, 4);
      const items = structuredClone(fixture.payload.items.slice(4));
      if (repaired) for (const [index, item] of items.entries()) {
        item.image_type = "detail-macro";
        item.prompt = "特写观察" + (index ? "指尖开口" : "腕口缝线") + "的真实结构，不添加功能或参数。";
        Object.assign(item.creative_brief, { action: index ? "查看露指开口" : "查看外部接缝", framing: index ? "指尖开口局部微距" : "腕口缝线局部微距", evidence_focus: index ? "露指结构" : "接缝做工", visual_form: "macro-evidence" });
      }
      return Response.json({ output_text: JSON.stringify({ suite_strategy: fixture.payload.suite_strategy, items }) });
    } });
    assert.equal(calls, repaired ? 2 : 3);
    assert.equal(plan.imageCount, repaired ? 6 : 4);
    assert.equal(plan.pendingAdjustmentCount, repaired ? 0 : 2);
    const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
    assert.deepEqual(frozen.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
    if (!repaired) for (const item of frozen.items.slice(4)) {
      assert.ok(item.evidenceBlocked);
      assert.deepEqual(selectCreationRepairItems({ items: [item] }, { itemId: item.itemId }), []);
    }
  });
}
