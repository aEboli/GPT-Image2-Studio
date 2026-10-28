import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { buildPromptAgentInput, CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA } from "../lib/prompt-agent.mjs";
import { buildCreationProductInsightPrompt, normalizeCreationProductInsights } from "../lib/creation-product-insights.mjs";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { buildCreationQueuedSet } from "../lib/creation-suite-queue.mjs";
import { gloveAnalysisInput } from "./fixtures/creation-glove-insights.mjs";

function analystInput(overrides = {}) {
  const input = gloveAnalysisInput(overrides);
  input.productInsights.marketing_recommendations = [
    { id: "marketing-control", text: "突出可见控制器，用按键局部近景呈现操作位置", fact_ids: ["control"] },
    { id: "marketing-detail", text: "突出掌心纹理与腕口缝线，用细节特写表现外观做工", fact_ids: ["appearance"] },
    { id: "marketing-use", text: "围绕指尖操作的购买动机，用真实手部动作建立使用代入感", fact_ids: ["fingers"] },
  ];
  return input;
}

test("reference analysis requests concrete Chinese marketing recommendations with fact references", () => {
  const schema = CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA.properties.product_insights;
  assert.ok(schema.required.includes("marketing_recommendations"));
  const recommendations = schema.properties.marketing_recommendations;
  assert.equal(recommendations.maxItems, 6);
  assert.deepEqual(recommendations.items.required, ["id", "text", "fact_ids"]);
  const input = buildPromptAgentInput({ images: [{ filename: "gloves.png", mimeType: "image/png", base64: "Z2xvdmVz" }], mode: "creation-reference-analysis" });
  assert.match(input[0].content[0].text, /marketing_recommendations/);
  assert.match(input[0].content[0].text, /营销重点.*画面表达/);
  assert.match(input[0].content[0].text, /建议.*简体中文/);
});

test("recommendations keep sourced content and reject missing or partially invalid evidence", () => {
  const raw = analystInput().productInsights;
  raw.conflicts = [{ text: "同一按键数量冲突", fact_ids: ["control"], claims: [], reference_indexes: [1] }];
  raw.marketing_recommendations.push(
    { id: "unsourced", text: "没有来源的宣传", fact_ids: [] },
    { id: "missing", text: "无效来源的宣传", fact_ids: ["not-a-fact"] },
    { id: "partial", text: "部分依据失效的宣传", fact_ids: ["appearance", "control"] },
  );
  const normalized = normalizeCreationProductInsights(raw, { referenceCount: 1 });
  assert.deepEqual(normalized.marketingRecommendations.map((entry) => entry.id), ["marketing-detail", "marketing-use"]);
  assert.deepEqual(normalizeCreationProductInsights(normalized, { referenceCount: 1 }).marketingRecommendations, normalized.marketingRecommendations);
  assert.deepEqual(normalizeCreationProductInsights({ confirmed_facts: [] }).marketingRecommendations, []);
  assert.equal(normalizeCreationProductInsights(null), null);
});

test("frame recommendations require all their evidence and respect manual or strict tasks", () => {
  const insights = normalizeCreationProductInsights(analystInput().productInsights, { referenceCount: 1 });
  const contentAssignment = { kind: "detail", factIds: ["appearance"], sellingPointIds: [] };
  const prompt = buildCreationProductInsightPrompt(insights, { role: "product-detail", contentAssignment });
  assert.ok(prompt.includes(insights.marketingRecommendations[1].text));
  assert.match(prompt, /ANALYST MARKETING RECOMMENDATIONS FOR THIS FRAME:/);
  assert.match(prompt, /\[appearance; (?:reference|ref) 1\]/);
  assert.ok(!prompt.includes(insights.marketingRecommendations[0].text));
  assert.ok(!prompt.includes(insights.marketingRecommendations[2].text));
  for (const options of [
    { contentAssignment: { ...contentAssignment, kind: "manual" } },
    { contentAssignment: { ...contentAssignment, kind: "gap" } },
    { contentAssignment, includeMarketingRecommendations: false },
  ]) {
    assert.doesNotMatch(buildCreationProductInsightPrompt(insights, options), /ANALYST MARKETING RECOMMENDATIONS/);
  }
});

test("planned image prompts use matching recommendations without changing independent or manual images", () => {
  const plan = buildCreationPlan(analystInput({
    infographicRebuildEnabled: true,
    referenceImageRoles: [
      { index: 1, filename: "gloves.png", role: "reference-product", note: "卡其色主主体" },
      { index: 2, filename: "source-infographic.png", role: "feature", note: "功能说明图" },
    ],
    platformItemOverrides: [{ slotKey: "universal:ownership-atmosphere", prompt: "用户写好的逐图提示词" }],
  }));
  const recommendations = plan.productInsights.marketingRecommendations;
  assert.equal(recommendations.length, 3);
  for (const recommendation of recommendations) {
    const matched = plan.items.filter((item) => item.prompt.includes(recommendation.text));
    assert.ok(matched.length, recommendation.text);
    for (const item of matched) {
      assert.equal(item.itemKind, "carousel");
      assert.ok(recommendation.factIds.every((id) => item.contentAssignment.factIds.includes(id)), item.itemId);
    }
  }
  assert.equal(plan.items.find((item) => item.slotKey === "universal:ownership-atmosphere").prompt, "用户写好的逐图提示词");
  assert.doesNotMatch(plan.items.find((item) => item.role === "multi-angle").prompt, /ANALYST MARKETING RECOMMENDATIONS/);
  const dimension = plan.items.find((item) => item.contentAssignment?.taskKey === "dimensions");
  assert.doesNotMatch(dimension.prompt, /ANALYST MARKETING RECOMMENDATIONS/);
  const rebuild = plan.items.find((item) => item.itemKind === "infographic-rebuild");
  assert.ok(rebuild);
  assert.doesNotMatch(rebuild.prompt, /ANALYST MARKETING RECOMMENDATIONS/);
  const skuPlan = buildCreationPlan(analystInput({
    skuGenerationEnabled: true,
    skuSubjects: [
      { id: "khaki", title: "Khaki", filenames: ["gloves.png"] },
      { id: "black", title: "Black", filenames: ["black.png"] },
    ],
    referenceImageRoles: [
      { index: 1, filename: "gloves.png", role: "reference-product" },
      { index: 2, filename: "black.png", role: "product" },
    ],
  }));
  assert.ok(skuPlan.items.some((item) => item.itemKind === "sku"));
  for (const item of skuPlan.items.filter((item) => item.itemKind === "sku")) {
    assert.doesNotMatch(item.prompt, /ANALYST MARKETING RECOMMENDATIONS/);
  }
});

test("recommendations and their prompts survive frozen plans, queued sets, storage and repair", () => {
  const plan = buildCreationPlan(analystInput());
  assert.equal(plan.productInsights.marketingRecommendations.length, 3);
  const submitted = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const queued = buildCreationQueuedSet({
    getFrozenCreationEffectivePlan: () => submitted,
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedLanguage: () => ({ value: "en" }),
    getCreationSelectedScenario: () => ({ value: "standard" }),
    getCreationSelectedIndustryTemplate: () => ({ value: "general" }),
    normalizeCreationSkuBundleCountForPayload: Number,
    refs: {}, normalizeSet: (value) => value,
  });
  const stored = normalizeCreationSetManifest({ ...queued, setId: "analyst-recommendations" });
  const repair = buildCreationRepairPlan(stored);
  for (const candidate of [submitted, queued, stored, repair]) {
    assert.deepEqual(candidate.productInsights.marketingRecommendations, plan.productInsights.marketingRecommendations);
    assert.deepEqual(candidate.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
  }
});

function element(tagName = "div") {
  return {
    tagName, className: "", textContent: "", children: [],
    classList: { add() {} },
    append(...children) { this.children.push(...children); },
    appendChild(child) { this.children.push(child); },
  };
}

async function renderAnalyst(set) {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const source = app.slice(app.indexOf("function renderCreationRecordDetail("), app.indexOf("\nfunction upsertCreationSet("));
  const detail = element();
  const context = vm.createContext({
    refs: { creationRecordDetail: detail }, state: {},
    document: { createElement: element },
    canRepairCreationSet: () => false, getCreationIncompleteItems: () => [],
    getCreationProgressSummary: () => ({ completed: 0, total: 1 }),
  });
  vm.runInContext(source, context);
  context.renderCreationRecordDetail(set);
  return detail;
}

const allText = (node) => [node.textContent, ...node.children.map(allText)].filter(Boolean).join("\n");

test("analyst detail renders its saved recommendations as a full-width row", async () => {
  const plan = buildCreationPlan(analystInput());
  for (const set of [{ productInsights: plan.productInsights }, { effectivePlan: plan }]) {
    const detail = await renderAnalyst(set);
    const section = detail.children.find((node) => allText(node).includes("分析师提供建议内容："));
    assert.ok(section);
    assert.ok(section.className.includes("is-wide"));
    for (const recommendation of plan.productInsights.marketingRecommendations) {
      assert.ok(allText(section).includes(recommendation.text));
    }
    assert.doesNotMatch(allText(section), /暂无|undefined|\[object Object\]/);
  }
});

test("legacy record keeps a visible recommendation row without inventing analysis", async () => {
  const detail = await renderAnalyst({ effectivePlan: { effectiveAudienceStrategy: { targetAudience: "buyers evaluating this product category" } } });
  const section = detail.children.find((node) => allText(node).includes("分析师提供建议内容："));
  assert.ok(section);
  assert.match(allText(section), /暂无营销建议.*重新.*智能识别/);
  assert.doesNotMatch(allText(section), /buyers evaluating/);
  assert.match(allText(detail), /痛点:[\s\S]*尚未提炼具体痛点/);
  assert.match(allText(detail), /卖点:[\s\S]*尚未提炼商品卖点/);
});
