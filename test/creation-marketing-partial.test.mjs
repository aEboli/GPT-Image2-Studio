import test from "node:test";
import assert from "node:assert/strict";
import { applyCreationMarketingPlan } from "../lib/creation-marketing-plan.mjs";
import { requestCreationMarketingPlan, creationMarketingInputFingerprint } from "../lib/creation-marketing-agent.mjs";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { getCreationMarketingDisplayItems } from "../lib/creation-item-display.mjs";
import { resolveCreationPlanCounts } from "../lib/creation-plan-counts.mjs";
import { buildCreationItemReferenceImages } from "../lib/creation-reference-labels.mjs";

const images = [{ filename: "gloves.png", base64: "Z2xvdmVz", buffer: Buffer.from("gloves"), mimeType: "image/png" }];
const options = { count: 18, referenceCount: 1, primaryIndex: 1 };

test("unresolved invalid facts leave seventeen frozen tasks after bounded repair", async () => {
  const { input, payload } = marketingPlanFixture(18);
  payload.items[12].fact_ids.push("missing");
  const events = [];
  let calls = 0;
  const plan = await requestCreationMarketingPlan({ input, referenceImages: images, config: {}, onProgress: (event) => events.push(event), fetchImpl: async () => {
    calls += 1;
    return Response.json({ output_text: JSON.stringify(payload) });
  } });
  assert.equal(calls, 3);
  assert.equal(plan.items.length, 17);
  assert.equal(plan.imageCount, 17);
  assert.equal(plan.platformSetOverrides.imageCount, 17);
  assert.equal(events.at(-1).stage, "partial");
  const diagnostic = plan.marketingPlan.validation;
  assert.equal(diagnostic.requestedCount, 18);
  assert.equal(diagnostic.acceptedCount, 17);
  assert.equal(diagnostic.removedItems[0].sourceIndex, 13);
  assert.equal(diagnostic.removedItems[0].itemId, "ai-13");
  assert.match(diagnostic.removedItems[0].reason, /失效/);
  assert.equal(plan.items[12].marketingAssignment.sourceIndex, 14);
  const displayItems = getCreationMarketingDisplayItems(plan);
  assert.equal(displayItems.length, 18);
  assert.equal(displayItems[12].status, "missing");
  assert.equal(displayItems[12].enabled, false);
  assert.equal(displayItems[13].itemId, "ai-14");
  assert.equal(resolveCreationPlanCounts({ items: displayItems }).imageCount, 17);
  assert.equal(plan.items.length, 17, "display placeholders never mutate actual tasks");
  assert.equal(plan.marketingPlan.inputFingerprint, creationMarketingInputFingerprint({ ...input, imageCount: 17 }, images));
  const frozen = buildCreationSubmittedPlan({ effectivePlan: plan });
  const stored = normalizeCreationSetManifest({ ...plan, setId: "partial-plan", effectivePlan: frozen });
  const repair = buildCreationRepairPlan(stored);
  for (const candidate of [frozen, stored, repair]) {
    assert.deepEqual(candidate.marketingPlan.validation, diagnostic);
    assert.deepEqual(candidate.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
    assert.equal(candidate.items.some((item) => item.itemId === "ai-13"), false);
  }
});

test("invalid rows cannot reserve duplicate keys before a healthy row", () => {
  const { input, payload } = marketingPlanFixture(18);
  payload.items[0] = { ...payload.items[1], fact_ids: ["missing"] };
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, options);
  assert.equal(plan.items.length, 17);
  assert.equal(plan.items[0].itemId, "ai-2");
});

test("original positions keep selected roles stable when a middle task is removed", () => {
  const { input, payload } = marketingPlanFixture(18);
  const base = buildCreationPlan(input);
  const selectedRoles = payload.items.map((item) => base.items.find((entry) => entry.imageType === item.image_type)?.role || "");
  payload.items[12].fact_ids = ["missing"];
  const plan = applyCreationMarketingPlan(base, payload, { ...options, selectedRoles });
  const rows = payload.items.filter((_, index) => index !== 12);
  rows.forEach((row, index) => { row.prompt = plan.items[index].prompt; });
  const validated = applyCreationMarketingPlan(plan, { items: rows }, { ...options, count: 17, selectedRoles, sourceIndexes: plan.items.map((item) => item.marketingAssignment.sourceIndex), constraintCount: 18, allowPartial: false });
  assert.deepEqual(validated.items.map((item) => item.prompt), plan.items.map((item) => item.prompt));
  assert.deepEqual(validated.marketingPlan.validation, plan.marketingPlan.validation);
});

test("wrong scalar field types and invalid source positions never become accepted tasks", () => {
  const { input, payload } = marketingPlanFixture(18);
  payload.items[2].prompt = { unexpected: "object" };
  const base = buildCreationPlan(input);
  const plan = applyCreationMarketingPlan(base, payload, options);
  assert.equal(plan.imageCount, 17);
  assert.match(plan.marketingPlan.validation.removedItems[0].reason, /字段类型/);
  const healthy = marketingPlanFixture(18).payload;
  assert.throws(() => applyCreationMarketingPlan(base, healthy, { ...options, allowPartial: false, sourceIndexes: Array(18).fill(1) }), /原始序号/);
  assert.throws(() => applyCreationMarketingPlan(base, healthy, { ...options, constraintCount: 999 }), /原始数量/);
});

test("null rows, absent fields and multiple errors are isolated", () => {
  const { input, payload } = marketingPlanFixture(18);
  payload.items[0] = null;
  payload.items[5] = {};
  payload.items[17].reference_indexes = [99];
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, options);
  assert.equal(plan.items.length, 15);
  assert.deepEqual(plan.marketingPlan.validation.removedItems.map((item) => item.sourceIndex), [1, 6, 18]);
});

test("a reference budget failure removes just that task before committing duplicate keys", () => {
  const { input, payload } = marketingPlanFixture(18);
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, { ...options, validateItem: (item) => {
    if (item.itemId === "ai-13") throw new Error("参考图超出预算");
  } });
  assert.equal(plan.items.length, 17);
  assert.match(plan.marketingPlan.validation.removedItems[0].reason, /超出预算/);
});

test("complete short or excess responses adjust the count without extending the requested scope", () => {
  const { input, payload } = marketingPlanFixture(20);
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, options);
  assert.equal(plan.items.length, 18);
  assert.deepEqual(plan.marketingPlan.validation.removedItems.map((item) => item.sourceIndex), [19, 20]);
  const short = applyCreationMarketingPlan(buildCreationPlan(input), { items: payload.items.slice(0, 16) }, options);
  assert.equal(short.imageCount, 16);
  assert.equal(short.marketingPlan.validation.missingCount, 2);
  assert.deepEqual(getCreationMarketingDisplayItems(short).slice(-2).map((item) => item.status), ["missing", "missing"]);
  assert.equal(getCreationMarketingDisplayItems(plan).length, 18, "out-of-scope extras do not create additional image frames");
});

test("the real reference byte budget is enforced independently for each task", () => {
  const { input, payload } = marketingPlanFixture(18);
  const base = buildCreationPlan(input);
  payload.items[12].reference_indexes.push(2);
  const references = [images[0], { ...images[0], filename: "large.png", buffer: Buffer.alloc(6 * 1024 * 1024) }];
  const plan = applyCreationMarketingPlan(base, payload, { ...options, referenceCount: 2, validateItem: (item) => buildCreationItemReferenceImages(item, references, base.referenceImageRoles) });
  assert.equal(plan.imageCount, 17);
  assert.match(plan.marketingPlan.validation.removedItems[0].reason, /超出预算/);
});

test("all-invalid, invalid shared subject, locked and required tasks still block the whole plan", () => {
  const { input, payload } = marketingPlanFixture(18);
  const base = buildCreationPlan(input);
  assert.throws(() => applyCreationMarketingPlan(base, { items: [null, {}] }, options), /没有可用|全部.*无效/);
  assert.throws(() => applyCreationMarketingPlan(base, payload, { ...options, primaryIndex: 9 }), /主主体/);
  const broken = structuredClone(payload);
  broken.items[12].fact_ids = ["missing"];
  assert.throws(() => applyCreationMarketingPlan(base, broken, { ...options, lockedItems: [payload.items[12]] }), /锁定/);
  base.platformProfile.slots[12] = { imageType: payload.items[12].image_type, constraints: [{ level: "blocking" }] };
  assert.throws(() => applyCreationMarketingPlan(base, broken, options), /必需/);
  assert.throws(() => applyCreationMarketingPlan(base, { items: payload.items.slice(0, 12) }, options), /必需/);
});

test("frozen revalidation cannot silently drop a newly broken accepted task", () => {
  const { input, payload } = marketingPlanFixture(18);
  payload.items[12].fact_ids = ["missing"];
  const plan = applyCreationMarketingPlan(buildCreationPlan(input), payload, options);
  const accepted = payload.items.filter((_, index) => index !== 12);
  accepted[0].fact_ids = ["missing"];
  assert.throws(() => applyCreationMarketingPlan(plan, { items: accepted }, { ...options, count: 17, allowPartial: false }), /商品事实/);
});

test("SKU and rebuild additions retain independent enabled counts", () => {
  const { input, payload } = marketingPlanFixture(18);
  const base = buildCreationPlan(input);
  base.items.push({ itemId: "sku-a", itemKind: "sku" }, { itemId: "sku-b", itemKind: "sku" }, { itemId: "rebuild", itemKind: "infographic-rebuild" }, { itemId: "disabled", itemKind: "sku", enabled: false });
  payload.items[12].fact_ids = ["missing"];
  const plan = applyCreationMarketingPlan(base, payload, options);
  assert.equal(plan.carouselImageCount, 17);
  assert.equal(plan.skuImageCount, 2);
  assert.equal(plan.infographicRebuildCount, 1);
  assert.equal(plan.totalPlannedItemCount, 20);
});
