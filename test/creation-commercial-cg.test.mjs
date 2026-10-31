import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { CREATION_PLATFORM_IMAGE_TYPE_REGISTRY } from "../lib/creation-platform-policies.mjs";
import { CREATION_MARKETING_PLAN_INSTRUCTION, CREATION_MARKETING_ITEMS_SCHEMA, applyCreationMarketingPlan, buildCreationMarketingContext } from "../lib/creation-marketing-plan.mjs";
import { auditCreationMarketingQuality } from "../lib/creation-marketing-quality.mjs";
import { allocateCreationProductScenes, normalizeCreationProductInsights } from "../lib/creation-product-insights.mjs";
import { gloveAnalysisInput } from "./fixtures/creation-glove-insights.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { buildCreationItemReferenceImages } from "../lib/creation-reference-labels.mjs";

test("commercial CG replaces the atmosphere label while functional rendering keeps its identity", () => {
  const cg = CREATION_PLATFORM_IMAGE_TYPE_REGISTRY["ownership-atmosphere"];
  assert.equal(cg.role, "atmosphere");
  assert.equal(cg.imageTypeLabel, "商业 CG 渲染图");
  assert.equal(cg.composition, "commercial-cg-product-rendering");
  assert.equal(cg.scenePolicy, "studio-render");
  assert.equal(CREATION_PLATFORM_IMAGE_TYPE_REGISTRY["comparison-proof"].imageTypeLabel, "功能效果渲染图");
});

test("commercial CG and functional rendering retain independent tasks with product analysis", () => {
  const plan = buildCreationPlan(gloveAnalysisInput({ selectedRoles: ["atmosphere", "effect-comparison", "scene", "product-detail"] }));
  const cg = plan.items.find((item) => item.role === "atmosphere");
  const functional = plan.items.find((item) => item.role === "effect-comparison");
  assert.ok(cg && functional);
  assert.equal(cg.evidenceBlocked, false);
  assert.equal(cg.contentAssignment.kind, "commercial-cg");
  assert.equal(functional.contentAssignment.kind, "functional-render");
  assert.match(cg.prompt, /commercial (?:3D\/)?CG(?:I)? product render/i);
  assert.match(cg.prompt, /contact shadows/i);
  assert.match(cg.prompt, /material-specific/i);
  assert.match(functional.prompt, /occlusion/i);
  assert.doesNotMatch(cg.prompt, /One believable ownership instant|Dynamic use requirement|uninterrupted photograph of the assigned product use|hands-only action/i);
});

test("commercial CG does not consume a use scene or require function facts", () => {
  const raw = gloveAnalysisInput().productInsights;
  const insights = normalizeCreationProductInsights(raw, { referenceCount: 1, primaryIndex: 1 });
  const assigned = allocateCreationProductScenes([{ role: "atmosphere" }, { role: "scene" }], insights, {}, 0);
  assert.equal(assigned[0], null);
  assert.ok(assigned[1]);
  const plan = buildCreationPlan({ productName: "陶瓷杯", productDescription: "白色陶瓷杯，光滑釉面", selectedRoles: ["atmosphere"] });
  assert.equal(plan.items[0].role, "atmosphere");
  assert.match(plan.items[0].prompt, /commercial (?:3D\/)?CG(?:I)? product render/i);
  assert.doesNotMatch(plan.items[0].prompt, /decisive-moment impulse|real person|Lifestyle cue:|Dynamic use requirement/i);
});

test("AI marketing offers commercial CG as an optional text-free creative form", () => {
  assert.ok(CREATION_MARKETING_ITEMS_SCHEMA.items.properties.creative_brief.properties.visual_form.enum.includes("commercial-cg"));
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /商业 CG/);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /自主.*(?:选择|安排)/);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /不.*(?:配额|强制每套)/);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /(?:文案|营销词).*(?:自主|自由)/);
  const input = gloveAnalysisInput();
  const context = buildCreationMarketingContext(input, buildCreationPlan(input));
  const cg = context.allowed_image_types.find((item) => item.image_type === "ownership-atmosphere");
  assert.equal(cg.title, "商业 CG 渲染图");
});

test("browser preview and marketing summary use the commercial CG label", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const summary = await readFile(new URL("../lib/creation-marketing-progress-view.mjs", import.meta.url), "utf8");
  assert.match(app, /5-atmosphere\|atmosphere\|商业 CG 渲染图/);
  assert.match(summary, /"commercial-cg": "商业 CG 渲染"/);
});

test("AI commercial CG accepts appearance-only evidence without text or replacing functional proof", () => {
  const { input, payload } = marketingPlanFixture(4);
  const row = payload.items[3];
  Object.assign(row, {
    image_type: "ownership-atmosphere", title: "光影中的织物质感", marketing_goal: "看清面料纹理与商品体积",
    audience_ids: [], selling_point_ids: [], pain_point_ids: [], recommendation_ids: [], fact_ids: ["appearance"],
    prompt: "商业 CG：完整手套保持参考配色和织物纹理，主光与轮廓光塑造曲面和厚度，接触阴影与反射形成空间。纯渲染，无新增文字。",
    creative_brief: { purpose: "感知面料与体积", scene: "商业渲染台", action: "完整主体静态展示", framing: "完整商品与克制留白", evidence_focus: "参考可见织物外观",
      visual_form: "commercial-cg", text_density: "none", new_information: "面料在商业布光下的立体质感", effect_visual: "" },
  });
  const base = buildCreationPlan(input);
  const plan = applyCreationMarketingPlan(base, payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
  const cg = plan.items.find((item) => item.role === "atmosphere");
  assert.ok(cg);
  assert.equal(cg.marketingAssignment.creativeBrief.visual_form, "commercial-cg");
  assert.match(cg.prompt, /No added text/iu);
  assert.equal(cg.textPolicy, "none");
  const quality = auditCreationMarketingQuality(plan);
  assert.equal(quality.issues.some((issue) => issue.code === "unsupported-functional-render" && issue.itemId === cg.itemId), false);
  assert.equal(quality.functionalCoverage.covered, true);
  payload.items[1].creative_brief.visual_form = "commercial-cg";
  payload.items[1].creative_brief.text_density = "none";
  payload.items[1].creative_brief.effect_visual = "";
  const missingFunction = applyCreationMarketingPlan(base, payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
  assert.equal(auditCreationMarketingQuality(missingFunction).functionalCoverage.covered, false);
});

test("AI plans can omit commercial CG and manual prompts keep their stable slot", () => {
  const { input, payload } = marketingPlanFixture(4);
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, { count: 4, referenceCount: 1, primaryIndex: 1 });
  assert.equal(plan.items.some((item) => item.role === "atmosphere"), false);
  assert.equal(auditCreationMarketingQuality(plan).issues.length, 0);
  const manual = buildCreationPlan(gloveAnalysisInput({
    platformItemOverrides: [{ slotKey: "universal:ownership-atmosphere", prompt: "用户保留的自由营销提示词" }] }));
  assert.equal(manual.items.find((item) => item.slotKey === "universal:ownership-atmosphere").prompt, "用户保留的自由营销提示词");
});

test("historical frozen atmosphere prompts are not rewritten to commercial CG on submission or repair", () => {
  const historical = buildCreationPlan({ productName: "陶瓷杯", selectedRoles: ["atmosphere"] });
  const old = historical.items[0];
  old.title = "历史氛围画面";
  old.prompt = "历史冻结提示词：使用者在窗边拿着陶瓷杯。";
  old.filenameToken = "mood";
  const submitted = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(historical) });
  const stored = normalizeCreationSetManifest({ setId: "historical-atmosphere", effectivePlan: submitted, items: submitted.items });
  const repaired = buildCreationRepairPlan(stored);
  for (const plan of [submitted, stored, repaired]) {
    assert.equal(plan.items[0].itemId, old.itemId);
    assert.equal(plan.items[0].title, old.title);
    assert.equal(plan.items[0].prompt, old.prompt);
    assert.equal(plan.items[0].filenameToken, old.filenameToken);
  }
});

test("commercial CG reference selection uses material evidence instead of a lifestyle scene", () => {
  const referenceImageRoles = [
    { index: 1, filename: "bottle.png", role: "reference-product", note: "主商品" },
    { index: 2, filename: "picnic.png", role: "scene", note: "野餐使用场景" },
    { index: 3, filename: "finish.png", role: "material", note: "主商品可见金属纹理" },
  ];
  const plan = buildCreationPlan({ productName: "金属水杯", selectedRoles: ["atmosphere"], referenceImageRoles });
  const references = referenceImageRoles.map((entry) => ({ name: entry.filename, referenceIndex: entry.index, buffer: Buffer.from(entry.filename) }));
  const chosen = buildCreationItemReferenceImages(plan.items[0], references, plan.referenceImageRoles);
  assert.ok(chosen.some((image) => image.name === "bottle.png"));
  assert.ok(chosen.some((image) => image.name === "finish.png"));
  assert.equal(chosen.some((image) => image.name === "picnic.png"), false);
});
