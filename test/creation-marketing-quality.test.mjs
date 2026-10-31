import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import { applyCreationMarketingPlan } from "../lib/creation-marketing-plan.mjs";
import { buildCreationMarketingQualityRequirements, auditCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";

function draft(count = 4) {
  const { input, payload } = marketingPlanFixture(count);
  payload.suite_strategy = {
    core_buying_reason: "用有依据的加热功能回应冬季手部温暖需求",
    primary_fact_ids: ["heat"],
    functional_proofs: [{ fact_ids: ["heat", "battery", "runtime"], buyer_benefit: "主动加热带来温暖", visual_evidence: "完整手套表面叠加半透明暖色热流示意，保留真实布料，示意不是热成像测量" }],
  };
  payload.items.forEach((item, index) => {
    item.marketing_goal = ["记住主购买理由", "看见加热作用", "核对掌心细节", "理解指尖操作"][index];
    item.creative_brief = {
      purpose: item.marketing_goal, scene: "当前商品适用环境", action: ["完整商品陈列", "手套处于加热状态", "近距离观察掌心补片", "指尖操作手机"][index],
      framing: ["完整产品留白", "一个完整手套主体上的功能效果", "局部微距", "操作中的手部近景"][index],
      evidence_focus: ["商品整体外观", "加热芯片的已确认功能", "掌心灰色纹理", "露出指尖结构"][index],
      visual_form: ["product-photograph", "functional-render", "macro-evidence", "use-scene"][index],
      text_density: ["minimal", "minimal", "none", "minimal"][index],
      new_information: ["整体身份与主购买理由", "加热作用如何转为温暖收益", "补片的可见质感", "使用设备时的指尖关系"][index],
      effect_visual: index === 1 ? "完整手套表面半透明暖色热流示意，表示加热带来的温暖，不是热成像实测" : "",
    };
  });
  payload.items[1].image_type = "comparison-proof";
  payload.items[1].fact_ids = ["heat", "battery", "runtime"];
  payload.items[1].selling_point_ids = ["heat-benefit"];
  payload.items[1].pain_point_ids = [];
  payload.items[1].recommendation_ids = [];
  payload.items[1].audience_ids = [];
  payload.items[1].prompt = "以一个完整手套主体展示加热功能：完整手套表面半透明暖色热流示意，表示加热带来的温暖，不是热成像实测。保留真实布料、控制器与原有数字，不展示未知内部线路，不补造温度、续航或发热区域。";
  return { input, payload, plan: applyCreationMarketingPlan(buildCreationPlan(input), payload, { count, referenceCount: 1, primaryIndex: 1 }) };
}

test("heated gloves require the actual heating fact, not just finger operation", () => {
  const { plan } = draft();
  const requirements = buildCreationMarketingQualityRequirements(plan);
  assert.ok(requirements.primaryFunctionFactIds.includes("heat"));
  assert.equal(auditCreationMarketingQuality(plan).issues.length, 0);
  plan.items[1].marketingAssignment.factIds = ["fingers"];
  assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "functional-proof-missing"));
});

test("a functional image type or cited fact alone does not prove visible heating", () => {
  const { plan } = draft();
  plan.items[1].prompt = "商品居中，温暖的米黄色背景，周围是参数文字和四个圆形卖点框。";
  plan.items[1].marketingAssignment.creativeBrief.effect_visual = "";
  assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "functional-proof-missing"));
});

test("an effect claimed only in metadata cannot substitute for an executable visual prompt", () => {
  const { plan } = draft();
  plan.items[1].prompt = "商品白底陈列，侧边写加热功能文字。";
  assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "functional-proof-missing"));
});

test("Chinese analysis and an English executable effect can cover the same supported function", () => {
  const { input, payload } = draft();
  input.targetLanguage = "en";
  payload.items[1].creative_brief.effect_visual = "Show a subtle translucent heat-flow illustration around the complete glove while preserving its real fabric, color and structure.";
  payload.items[1].prompt = `Create one complete heated glove as the dominant subject. ${payload.items[1].creative_brief.effect_visual} Treat the overlay as a conceptual illustration, with numerical claims limited to supplied evidence.`;
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
  assert.equal(auditCreationMarketingQuality(plan).functionalCoverage.covered, true);
  assert.match(plan.marketingPlan.suiteStrategy.functionalProofs[0].visualEvidence, /热流/);
});

test("a specification card cannot masquerade as the functional image via metadata", () => {
  const { input, payload } = draft();
  payload.items[1].image_type = "spec-table";
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
  assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "functional-proof-missing"));
});

test("a forbidden effect in the negative prompt is not visible functional evidence", () => {
  const { plan } = draft();
  plan.items[1].prompt = `商品白底陈列。不要${plan.items[1].marketingAssignment.creativeBrief.effect_visual}。`;
  assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "functional-proof-missing"));
});

test("same action and evidence in the same layout remains duplicate after changing purpose", () => {
  const { plan } = draft();
  const left = plan.items[2].marketingAssignment;
  const right = plan.items[3].marketingAssignment;
  right.creativeBrief = { ...left.creativeBrief, purpose: "从另一个买家角度说明", scene: "换到户外营地", new_information: "再次介绍商品细节" };
  right.factIds = [...left.factIds];
  const report = auditCreationMarketingQuality(plan);
  assert.ok(report.issues.some((issue) => issue.code === "duplicate-task" && issue.itemId === plan.items[3].itemId));
});

test("one fact may support a close detail and a distinct use action", () => {
  const { plan } = draft();
  plan.items[3].marketingAssignment.factIds = [...plan.items[2].marketingAssignment.factIds];
  assert.equal(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "duplicate-task"), false);
});

for (const [name, functionText, appearance] of [
  ["防水背包", "面料可防水", "背包正面外观"],
  ["照明灯", "灯具提供照明", "灯体外壳"],
  ["清洁刷", "刷头可以清洁表面污渍", "刷毛与手柄外观"],
  ["收纳盒", "隔层可以分类收纳物品", "盒体外观"],
]) {
  test(`${name} derives a functional requirement from its own facts`, () => {
    const plan = buildCreationPlan({ productName: name, productDescription: `${appearance}，${functionText}`, skuGenerationEnabled: false, imageCount: 4,
      productInsights: { confirmed_facts: [
        { id: "look", text: appearance, kind: "appearance", source: "user", reference_indexes: [] },
        { id: "own-function", text: functionText, kind: "function", source: "user", reference_indexes: [] },
      ], selling_points: [{ id: "main-benefit", text: functionText, fact_ids: ["own-function"] }] } });
    assert.deepEqual(buildCreationMarketingQualityRequirements(plan).primaryFunctionFactIds, ["own-function"]);
    assert.ok(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "functional-proof-missing"));
  });
}

test("appearance-only products acquire no invented functional requirement", () => {
  const plan = buildCreationPlan({ productName: "装饰摆件", productDescription: "圆形木质摆件", skuGenerationEnabled: false, imageCount: 1,
    productInsights: { confirmed_facts: [{ id: "look", text: "圆形木质外观", kind: "appearance", source: "user", reference_indexes: [] }] } });
  assert.deepEqual(buildCreationMarketingQualityRequirements(plan).primaryFunctionFactIds, []);
  assert.equal(auditCreationMarketingQuality(plan).issues.some((issue) => issue.code === "functional-proof-missing"), false);
});

test("quality metadata cannot cite unconfirmed facts", () => {
  const { input, payload } = draft();
  payload.suite_strategy.primary_fact_ids = ["invented-temperature"];
  assert.throws(() => applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 }), /策略.*事实/);
});

const referenceImages = [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==", buffer: Buffer.from("x") }];
const config = { baseUrl: "https://example.test/v1", responsesModel: "quality-test", apiKey: "test" };
const modelResponse = (payload) => Response.json({ output_text: JSON.stringify(payload) });
const requestContext = (init) => JSON.parse(JSON.parse(init.body).input[0].content[1].text);

test("a valid draft needs one call and freezes quality with the exact prompts", async () => {
  const { input, payload } = draft();
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => { calls += 1; return modelResponse(payload); } });
  assert.equal(calls, 1);
  assert.equal(plan.marketingPlan.quality.repairRounds, 0);
  assert.equal(plan.marketingPlan.quality.functionalCoverage.covered, true);
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const stored = normalizeCreationSetManifest({ ...plan, setId: "quality-loop-test", effectivePlan: frozen });
  for (const candidate of [frozen, stored, buildCreationRepairPlan(stored)]) {
    assert.deepEqual(candidate.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
    assert.deepEqual(candidate.marketingPlan.quality, plan.marketingPlan.quality);
    assert.deepEqual(candidate.marketingPlan.suiteStrategy, plan.marketingPlan.suiteStrategy);
  }
});

test("missing functional expression is repaired locally without touching accepted items", async () => {
  const { input, payload, plan: acceptedPlan } = draft();
  const initial = structuredClone(payload);
  initial.items[1].creative_brief.effect_visual = "";
  initial.items[1].prompt = "商品陈列并写加热两个字，米黄色温暖背景。";
  let calls = 0; let context;
  const events = [];
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, onProgress: (event) => events.push(event), fetchImpl: async (_url, init) => {
    calls += 1; context = requestContext(init);
    if (calls === 1) return modelResponse(initial);
    assert.equal(context.task_count, 1);
    assert.equal(context.reuse_analysis, true);
    assert.deepEqual(context.repair_request.target_item_ids, ["ai-2"]);
    assert.equal(context.repair_request.accepted_items.length, 3);
    return modelResponse({ suite_strategy: payload.suite_strategy, items: [payload.items[1]] });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.marketingPlan.quality.repairRounds, 1);
  assert.equal(plan.marketingPlan.quality.issues.length, 0);
  assert.ok(events.some((event) => event.stage === "repairing"));
  for (const index of [0, 2, 3]) assert.equal(plan.items[index].prompt, acceptedPlan.items[index].prompt);
  assert.ok(plan.items[1].prompt.includes(payload.items[1].prompt));
});

test("failed quality repair stops after two rounds and preserves a usable draft with advice", async () => {
  const { input, payload } = draft();
  payload.items[1].creative_brief.effect_visual = "";
  payload.items[1].prompt = "暖色商品陈列与参数卡。";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => {
    calls += 1;
    return modelResponse(calls === 1 ? payload : { suite_strategy: payload.suite_strategy, items: [payload.items[1]] });
  } });
  assert.equal(plan.marketingPlan.quality.repairRounds, 2);
  assert.equal(plan.marketingPlan.quality.status, "warning");
  assert.equal(plan.imageCount, 4);
  assert.ok(plan.warnings.some((warning) => warning.code === "marketing-quality-functional-proof-missing"));
  assert.equal(calls, 3);
});

test("repair output cannot replace accepted images or discard a target on invalid evidence", async () => {
  const { input, payload } = draft();
  const initial = structuredClone(payload);
  initial.items[1].creative_brief.effect_visual = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return modelResponse(initial);
    if (calls === 2) {
      const invalid = structuredClone(payload.items[1]); invalid.fact_ids = ["made-up-performance"];
      return modelResponse({ suite_strategy: payload.suite_strategy, items: [invalid] });
    }
    assert.match(requestContext(init).repair_request.previous_rejection, /商品事实/);
    return modelResponse({ suite_strategy: payload.suite_strategy, items: [payload.items[1]] });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.items.length, 4);
  assert.match(plan.marketingPlan.quality.repairs[0].rejection, /商品事实/);
});

test("a repair that returns unrequested IDs is rejected rather than overwriting good work", async () => {
  const { input, payload } = draft();
  payload.items[1].creative_brief.effect_visual = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => {
    calls += 1; return modelResponse(calls === 1 ? payload : { suite_strategy: payload.suite_strategy, items: [payload.items[0]] });
  } });
  assert.ok(plan.marketingPlan.quality.repairs.every((record) => /指定图片 ID/.test(record.rejection)));
  assert.equal(plan.marketingPlan.quality.status, "warning");
  assert.equal(plan.imageCount, 4);
  assert.equal(calls, 3);
});

test("cancellation prevents the next quality repair request", async () => {
  const { input, payload } = draft();
  const controller = new AbortController();
  payload.items[1].creative_brief.effect_visual = "";
  let calls = 0;
  await assert.rejects(requestCreationMarketingPlan({ input, referenceImages, config, signal: controller.signal,
    onProgress: (event) => { if (event.stage === "validating") controller.abort(); },
    fetchImpl: async () => { calls += 1; return modelResponse(payload); },
  }), /abort/i);
  assert.equal(calls, 1);
});

test("same evidence and layout with a renamed purpose is actually repaired", async () => {
  const { input, payload } = draft();
  const initial = structuredClone(payload);
  initial.items[3].creative_brief = { ...initial.items[2].creative_brief, purpose: "面向另一种买家", scene: "换个地点" };
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return modelResponse(initial);
    const context = requestContext(init);
    assert.deepEqual(context.repair_request.target_item_ids, ["ai-4"]);
    assert.ok(context.repair_request.issues.some((issue) => issue.code === "duplicate-task"));
    return modelResponse({ suite_strategy: payload.suite_strategy, items: [payload.items[3]] });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.marketingPlan.quality.issues.length, 0);
});

test("manual image types without a functional image remain usable without being overwritten", async () => {
  const { input, payload } = draft();
  input.selectedRoles = ["product-detail", "product-detail", "product-detail", "product-detail"];
  payload.items.forEach((item) => { item.image_type = "detail-macro"; item.creative_brief.visual_form = "macro-evidence"; item.creative_brief.effect_visual = ""; });
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => { calls += 1; return modelResponse(payload); } });
  assert.equal(plan.marketingPlan.quality.status, "warning");
  assert.equal(plan.imageCount, 4);
  assert.ok(plan.items.every((item) => item.imageType === "detail-macro"));
  assert.equal(calls, 1);
});

test("an unchanged locked user prompt survives repair of a different frame", async () => {
  const { input, payload } = draft();
  const base = buildCreationPlan(input);
  input.platformItemOverrides = [{ slotKey: base.items[0].slotKey, prompt: "用户锁定的完整主体摄影，不添加文字。" }];
  const locked = buildCreationPlan(input).items[0];
  payload.items[0].item_id = locked.itemId;
  payload.items[0].image_type = locked.imageType;
  payload.items[0].prompt = locked.prompt;
  const initial = structuredClone(payload);
  initial.items[1].creative_brief.effect_visual = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return modelResponse(initial);
    assert.ok(requestContext(init).locked_items.some((item) => item.prompt === locked.prompt));
    return modelResponse({ suite_strategy: payload.suite_strategy, items: [payload.items[1]] });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.items[0].prompt, locked.prompt);
});

for (const [name, fact, visual] of [
  ["防水背包", "面料可防水", "在完整背包外表展示水珠沿表面滑落，保留真实面料，水珠关系作为防水功能示意"],
  ["照明灯", "灯具提供照明", "完整灯具发出可见光束并照亮旁边工作表面，用光照范围的创意示意表达照明收益"],
  ["清洁刷", "刷头可以清洁表面污渍", "完整刷子与待清洁表面接触，刷毛接触位置表现局部污渍移除过程，保持一个连续动作画面"],
  ["收纳盒", "隔层可以分类收纳物品", "在完整收纳盒中把物品分别放入参考支持的隔层，清楚展示容纳与分类关系和实际放入动作"],
]) {
  test(`${name} repairs its own functional expression without heating-specific logic`, async () => {
    const input = { productName: name, productDescription: `已知外观；${fact}`, imageCount: 2, skuGenerationEnabled: false, analysisValidated: true,
      productInsights: { confirmed_facts: [
        { id: "look", text: "已知外观", kind: "appearance", source: "user", reference_indexes: [] },
        { id: "function", text: fact, kind: "function", source: "user", reference_indexes: [] },
      ], selling_points: [{ id: "benefit", text: fact, fact_ids: ["function"] }] } };
    const suite_strategy = { core_buying_reason: fact, primary_fact_ids: ["function"], functional_proofs: [{ fact_ids: ["function"], buyer_benefit: fact, visual_evidence: visual }] };
    const items = [
      { item_id: "identity", image_type: "generic-hero", title: "商品整体外观", marketing_goal: "核对完整商品身份", fact_ids: ["look"], prompt: "以真实外观展示完整商品主体，保持简单留白。",
        creative_brief: { purpose: "认识商品", scene: "简洁陈列环境", action: "完整商品静态展示", framing: "整体留白摄影", evidence_focus: "外观比例", visual_form: "product-photograph", text_density: "minimal", new_information: "建立商品身份", effect_visual: "" } },
      { item_id: "function", image_type: "comparison-proof", title: "核心功能表现", marketing_goal: "看见实际功能作用和收益", fact_ids: ["function"], prompt: visual,
        creative_brief: { purpose: "理解功能作用", scene: "功能适用环境", action: "展示当前商品功能", framing: "完整主体与可见作用关系", evidence_focus: fact, visual_form: "functional-render", text_density: "minimal", new_information: "功能如何实际发生", effect_visual: visual } },
    ].map((item) => ({ audience_ids: [], selling_point_ids: [], pain_point_ids: [], recommendation_ids: [], reference_indexes: [], ...item }));
    const bad = structuredClone(items); bad[1].prompt = "商品居中加功能文字说明。"; bad[1].creative_brief.effect_visual = "";
    let calls = 0;
    const plan = await requestCreationMarketingPlan({ input, referenceImages: [], config, fetchImpl: async (_url, init) => {
      calls += 1;
      if (calls === 1) return modelResponse({ suite_strategy, items: bad });
      assert.deepEqual(requestContext(init).quality_requirements.primaryFunctionFactIds, ["function"]);
      return modelResponse({ suite_strategy, items: [items[1]] });
    } });
    assert.equal(calls, 2);
    assert.equal(plan.marketingPlan.quality.functionalCoverage.covered, true);
    assert.ok(plan.items[1].prompt.startsWith(visual));
    assert.doesNotMatch(plan.items[1].prompt, /加热|热流|温暖/);
  });
}

test("identical framing and text density across most of a suite triggers layout repair", () => {
  const { input, payload } = marketingPlanFixture(6);
  for (const item of payload.items) {
    item.creative_brief.framing = "商品居中，周围四个圆形信息框，底部卖点条";
    item.creative_brief.visual_form = "information-layout";
    item.creative_brief.text_density = "structured";
  }
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 6, referenceCount: 1, primaryIndex: 1 });
  assert.equal(auditCreationMarketingQuality(plan).issues.filter((issue) => issue.code === "layout-repetition").length, 3);
});

test("English product names prioritize their evidenced main function over secondary operation", () => {
  const plan = { productName: "Heated Gloves", productInsights: { confirmedFacts: [
    { id: "finger", text: "Gloves allow finger operation", kind: "function" },
    { id: "heat", text: "Gloves use a heated element", kind: "function" },
  ], sellingPoints: [] } };
  assert.deepEqual(buildCreationMarketingQualityRequirements(plan).primaryFunctionFactIds, ["heat"]);
});

test("multiple explicitly named core functions are not satisfied by showing just one", () => {
  const { input, payload } = draft();
  input.productName = "防水加热手套";
  input.productInsights.confirmed_facts.push({ id: "waterproof", text: "面料支持防水", kind: "function", source: "reference", reference_indexes: [1] });
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
  const report = auditCreationMarketingQuality(plan);
  assert.ok(report.requirements.primaryFunctionFactIds.includes("heat"));
  assert.ok(report.requirements.primaryFunctionFactIds.includes("waterproof"));
  assert.ok(report.issues.some((issue) => issue.code === "functional-proof-missing" && issue.factIds.includes("waterproof")));
});

test("local patches merge by the original position even when a rejected row reused a valid ID", async () => {
  const { input, payload } = draft();
  const initial = structuredClone(payload);
  initial.items[0].item_id = initial.items[2].item_id;
  initial.items[0].fact_ids = ["unconfirmed"];
  initial.items[2].creative_brief.new_information = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async (_url, init) => {
    calls += 1;
    if (calls === 1) return modelResponse(initial);
    const context = requestContext(init);
    assert.deepEqual(context.repair_request.targets.map((row) => row.source_index), [1, 3]);
    return modelResponse({ suite_strategy: payload.suite_strategy, items: context.repair_request.targets.map((row) => ({ ...payload.items[row.source_index - 1], item_id: row.item_id })) });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.items.find((item) => item.itemId === "ai-3").marketingAssignment.sourceIndex, 3);
  assert.equal(plan.marketingPlan.validation.removedItems.length, 0);
  assert.equal(plan.items[0].marketingAssignment.sourceIndex, 1);
  assert.notEqual(plan.items[0].itemId, "ai-3");
  assert.equal(plan.imageCount, 4);
});

test("a repaired prompt cannot displace an already accepted task via prompt deduplication", async () => {
  const { input, payload } = draft();
  const initial = structuredClone(payload);
  initial.items[0].creative_brief.new_information = "";
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages, config, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return modelResponse(initial);
    const item = structuredClone(payload.items[0]);
    if (calls === 2) item.prompt = payload.items[3].prompt;
    return modelResponse({ suite_strategy: payload.suite_strategy, items: [item] });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.imageCount, 4);
  assert.ok(plan.marketingPlan.quality.repairs[0].rejection);
  assert.ok(plan.items[3].prompt.includes(payload.items[3].prompt));
});
