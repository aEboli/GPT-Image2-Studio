import test from "node:test";
import assert from "node:assert/strict";
import { findCreationMarketingDuplicateRisks } from "../lib/creation-marketing-plan.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { textModelDraftText } from "../lib/text-model-client.mjs";

test("near-synonym winter cards are diagnosed without removing distinct functional images", () => {
  const item = (index, imageType, goal) => ({ itemId: `i${index}`, imageType, marketingAssignment: { sourceIndex: index, goal } });
  const items = [item(1, "scene-fit-1", "展示冬日温暖"), item(2, "scene-fit-2", "呈现雪日暖意"), item(3, "clean-catalog-main", "核对商品完整外观")];
  const risks = findCreationMarketingDuplicateRisks(items);
  assert.equal(risks.length, 1); assert.equal(risks[0].sourceIndex, 2); assert.equal(items.length, 3);
});

test("existing verified facts use strategy-and-items schema and are not overwritten by marketing", async () => {
  const { input, payload } = marketingPlanFixture(2);
  input.analysisValidated = true;
  let calls = 0;
  let schema;
  const plan = await requestCreationMarketingPlan({ input, referenceImages: [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }], config: { baseUrl: "https://example.test/v1", responsesModel: "test", apiKey: "test" }, fetchImpl: async (_url, init) => {
    calls += 1; schema = JSON.parse(init.body).text.format.schema;
    return Response.json({ output_text: JSON.stringify({ suite_strategy: payload.suite_strategy, items: payload.items }) });
  } });
  assert.deepEqual(schema.required, ["suite_strategy", "items"]); assert.equal(calls, 1); assert.equal(plan.imageCount, 2);
  assert.ok(plan.productInsights.confirmedFacts.some((fact) => fact.id === "fingers"));
});

test("partial string draft decodes escapes without requiring a complete JSON field", () => {
  assert.equal(textModelDraftText('{"title":"骑行\\n场景\\u4e2d'), "任务：骑行\n场景中");
  assert.equal(textModelDraftText('{"title":"<script>bad</script>'), "任务：<script>bad</script>");
});

test("analyst draft exposes product identity, reference observations and audience details before closure", () => {
  assert.equal(textModelDraftText('{"product_name":"三段仿生鱼饵'), "商品：三段仿生鱼饵");
  const draft = textModelDraftText('{"reference_roles":[{"filename":"detail.png","note":"前后挂钩清晰可见"}],"audience_strategy":{"target_audience":"淡水垂钓者"},"product_insights":{"audience_segments":[{"name":"岸钓爱好者","context":"岸边抛投","purchase_trigger":"补充常用拟饵","objection":"担心尺寸不合适"');
  for (const label of ["参考图：detail.png", "观察：前后挂钩清晰可见", "目标买家：淡水垂钓者", "使用情境：岸边抛投", "购买动机：补充常用拟饵", "购买顾虑：担心尺寸不合适"]) assert.ok(draft.includes(label), label);
});
