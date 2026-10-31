import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { buildCreationItemReferenceImages, buildCreationGenerationReferenceImageLabels } from "../lib/creation-reference-labels.mjs";
import { applyCreationMarketingPlan, buildCreationMarketingContext } from "../lib/creation-marketing-plan.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const roles = [
  { index: 1, filename: "black.png", role: "product", note: "黑色手套，一双；手背有 HOT 标识。" },
  { index: 2, filename: "khaki.png", role: "reference-product", roleManuallyEdited: true, note: "卡其色手套，一双；控制器位于手背。" },
  { index: 3, filename: "black-size.png", role: "dimensions", note: "黑色款，长22cm，宽11cm。" },
  { index: 4, filename: "khaki-size.png", role: "dimensions", note: "卡其款，长20cm，宽10cm。" },
];
const images = roles.map((entry) => ({ filename: entry.filename, referenceIndex: entry.index }));
const subjects = [
  { id: "black", title: "黑色款", filenames: ["black.png"], referenceIndexes: [1], colorNames: ["black"] },
  { id: "khaki", title: "卡其款", filenames: ["khaki.png"], referenceIndexes: [2], colorNames: ["khaki"] },
];
const input = (extra = {}) => ({ productName: "电加热手套", referenceImageRoles: roles, skuSubjects: subjects, skuGenerationEnabled: true, selectedRoles: ["hero", "series-showcase", "size-capacity-fit"], ...extra });

test("营销规划上下文将默认保真约束限定在普通单款图", () => {
  const fixture = marketingPlanFixture(1);
  const data = { ...fixture.input, referenceImageRoles: roles, skuSubjects: subjects };
  const context = buildCreationMarketingContext(data, buildCreationPlan(data), images);
  assert.equal(context.primary_reference_index, 2);
  assert.match(context.prompt_contract.product_fidelity, /^PRODUCT FIDELITY: khaki\.png/);
  assert.match(context.prompt_contract.note, /用于普通单款图/);
  assert.match(context.prompt_contract.note, /variant-comparison、dimension-fit、spec-table 按各款原图保真/);
  assert.equal(context.prompt_contract.subject_lock, undefined);
});

test("卡其参考主体只约束普通主商品，不替换黑色 SKU 的提示词和实际原图", () => {
  const plan = buildCreationPlan(input());
  const hero = plan.items.find((item) => item.role === "hero");
  const black = plan.items.find((item) => item.skuSubject?.id === "black");
  assert.match(hero.prompt, /PRODUCT FIDELITY: khaki\.png/);
  assert.match(black.prompt, /PRODUCT FIDELITY: black\.png is this SKU's primary product reference/);
  assert.doesNotMatch(black.prompt, /one set-wide product identity|khaki\.png is/);
  const selected = buildCreationItemReferenceImages(black, images, plan.referenceImageRoles);
  assert.deepEqual(selected.map((image) => image.filename), ["black.png"]);
  const labels = buildCreationGenerationReferenceImageLabels(selected, plan.referenceImageRoles, black);
  assert.match(labels[0], /Product identity;/);
});

test("有智能分析时多款图仍发送每个商品来源，不因空事实分配丢掉另一款", () => {
  const plan = buildCreationPlan(input({ selectedRoles: [], imageCount: 18, productInsights: {
    confirmed_facts: [
      { id: "black", text: "黑色手套掌面防滑", kind: "appearance", source: "reference", reference_indexes: [1] },
      { id: "khaki", text: "卡其手套手背控制器", kind: "appearance", source: "reference", reference_indexes: [2] },
    ], selling_points: [], pain_points: [], usage_scenarios: [],
  } }));
  const item = plan.items.find((entry) => entry.role === "series-showcase");
  assert.equal(item.contentAssignment.kind, "variants");
  const selected = buildCreationItemReferenceImages(item, images, plan.referenceImageRoles);
  assert.deepEqual(selected.map((image) => image.filename), ["khaki.png", "black.png"]);
});

test("已知两张SKU图即使缺少可靠颜色标签也不会被提示词误报没有多款资料", () => {
  const filenames = ["SKU-A.png", "SKU-B.png"];
  const skuSubjects = subjects.map((subject, index) => ({ id: filenames[index], title: filenames[index], filenames: [filenames[index]], referenceIndexes: subject.referenceIndexes, note: "一双手套；原图保留。" }));
  const referenceImageRoles = roles.map((role, index) => ({ ...role, filename: filenames[index] || role.filename, note: "一双手套；原图保留。" }));
  const plan = buildCreationPlan(input({ skuSubjects, referenceImageRoles }));
  const item = plan.items.find((entry) => entry.role === "series-showcase");
  assert.doesNotMatch(item.prompt, /no verified multi-variant list/);
  assert.match(item.prompt, /supplied SKU reference images/);
});

for (const [role, type] of [["series-showcase", "variant-comparison"], ["size-capacity-fit", "dimension-fit"], ["spec-table", "spec-table"]]) {
  test(`AI ${role} 的前缀与参考标签允许逐款来源，不被普通主体锁覆盖`, () => {
    const fixture = marketingPlanFixture(1);
    const base = buildCreationPlan({ ...fixture.input, referenceImageRoles: roles, skuSubjects: subjects });
    fixture.payload.items[0].image_type = type;
    fixture.payload.items[0].reference_indexes = [2, 1];
    const plan = applyCreationMarketingPlan(base, fixture.payload, { count: 1, referenceCount: 4, primaryIndex: 2 });
    const item = plan.items[0];
    assert.match(item.prompt, /^PRODUCT FIDELITY: khaki\.png is the default product reference/);
    assert.doesNotMatch(item.prompt, /defines identity and part count across every panel/);
    const selected = buildCreationItemReferenceImages(item, images, plan.referenceImageRoles);
    const labels = buildCreationGenerationReferenceImageLabels(selected, plan.referenceImageRoles, item);
    assert.equal(labels.filter((label) => /Supplied variant identity reference/.test(label)).length, 2);
  });
}

test("冻结、保存和补图延续普通主参考与独立SKU来源的各自边界", () => {
  const plan = buildCreationPlan(input());
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const saved = normalizeCreationSetManifest({ ...plan, setId: "subject-boundary-regression", effectivePlan: frozen });
  const repair = buildCreationRepairPlan(saved);
  for (const candidate of [frozen, saved, repair]) {
    const hero = candidate.items.find((item) => item.role === "hero");
    const black = candidate.items.find((item) => item.skuSubject?.id === "black");
    assert.match(hero.prompt, /PRODUCT FIDELITY: khaki\.png/);
    assert.match(black.prompt, /PRODUCT FIDELITY: black\.png/);
    assert.deepEqual(buildCreationItemReferenceImages(black, images, candidate.referenceImageRoles).map((image) => image.filename), ["black.png"]);
  }
});

test("多款式图保留已提供的黑色和卡其两种商品，不被全套数量和配色锁压成单款", () => {
  const plan = buildCreationPlan(input());
  const item = plan.items.find((entry) => entry.role === "series-showcase");
  assert.ok(item);
  assert.match(item.prompt, /each (?:supplied |verified )?variant.*(?:own|matching).*reference/i);
  assert.doesNotMatch(item.prompt, /defines identity and part count across every panel/);
  const selected = buildCreationItemReferenceImages(item, images, plan.referenceImageRoles);
  assert.ok(selected.some((image) => image.filename === "black.png"));
  assert.ok(selected.some((image) => image.filename === "khaki.png"));
  const labels = buildCreationGenerationReferenceImageLabels(selected, plan.referenceImageRoles, { ...item, promptContext: { version: 1 } });
  assert.ok(labels.some((label) => /black\.png.*(?:variant|Variant)/.test(label)));
});
