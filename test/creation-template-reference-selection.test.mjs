import assert from "node:assert/strict";
import test from "node:test";
import { buildCreationPlan, buildCreationSubmittedPlan } from "../lib/creation-planner.mjs";
import { buildCreationItemReferenceImages } from "../lib/creation-reference-labels.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import { buildCreationRepairPlan } from "../lib/creation-repair.mjs";

function templateFixture({ includeImages = true } = {}) {
  const references = [
    ["charging", "feature", "腕部充电接口的连接细节"],
    ["temperature", "feature", "控制模块的三档显示状态"],
    ["operation", "usage", "手套指尖的开启操作"],
    ["scene", "scene", "佩戴手套握住车把"],
    ["material", "material", "掌心纹理和腕口缝线近景"],
    ["heating", "feature", "来源标注的加热区域"],
    ["touch", "feature", "拇指和食指的开口结构"],
    ["product", "product", "白底完整一双黑色手套"],
    ["standard", "dimensions", "标准码长度22 cm，宽度11 cm"],
    ["large", "dimensions", "加大码长度24 cm，宽度12 cm"],
  ];
  const images = references.map(([name], index) => ({
    filename: `${name}-reference.jpg`, referenceIndex: index + 1,
    buffer: Buffer.from(name), byteLength: 100_000,
  }));
  const input = {
    platform: "universal", productName: "黑色加热手套", imageCount: 18,
    skuGenerationEnabled: false, infographicRebuildEnabled: false,
    selectedRoles: ["hero", "product-detail", "effect-comparison", "size-capacity-fit", "spec-table", "usage-suggestion", "scene-fit-1"],
    referenceImageRoles: references.map(([name, role, note], index) => ({
      index: index + 1, filename: `${name}.png`, role, note,
    })),
    productInsights: { confirmedFacts: [] },
    ...(includeImages ? { referenceImages: images } : {}),
  };
  return { input, images, plan: buildCreationPlan(input) };
}

test("template plans without structured facts freeze the existing per-role reference selection", () => {
  const { plan, images } = templateFixture();
  for (const item of plan.items) {
    const expected = buildCreationItemReferenceImages({ ...item, referenceSelection: undefined }, images, plan.referenceImageRoles);
    assert.deepEqual(item.referenceSelection?.referenceIndexes, expected.map((image) => image.referenceIndex), item.role);
  }
});

test("template details, functional images and specification groups retain their supporting references", () => {
  const { plan } = templateFixture();
  const selection = (role) => plan.items.find((item) => item.role === role).referenceSelection.referenceIndexes;
  assert.deepEqual(selection("hero"), [8]);
  assert.deepEqual(selection("product-detail"), [8, 5]);
  assert.deepEqual(selection("effect-comparison"), [8, 1, 2, 6, 7]);
  assert.deepEqual(selection("size-capacity-fit"), [8, 9, 10]);
  assert.deepEqual(selection("spec-table"), [8, 9, 10]);
  assert.deepEqual(selection("usage-suggestion"), [8, 1, 2, 3, 6, 7]);
  assert.deepEqual(selection("scene-fit-1"), [8]);
});

test("template previews can freeze stable original indexes before upload compression", () => {
  const { plan, images } = templateFixture({ includeImages: false });
  const item = plan.items.find((entry) => entry.role === "size-capacity-fit");
  assert.deepEqual(item.referenceSelection.referenceIndexes, [8, 9, 10]);
  assert.deepEqual(buildCreationItemReferenceImages(item, images, plan.referenceImageRoles).map((image) => image.filename), [
    "product-reference.jpg", "standard-reference.jpg", "large-reference.jpg",
  ]);
});

test("template references stay frozen through submission, storage and repair", () => {
  const { plan, images } = templateFixture();
  const frozen = buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(plan) });
  const stored = normalizeCreationSetManifest({ ...plan, setId: "template-reference-regression", effectivePlan: frozen });
  const original = plan.items.find((item) => item.role === "size-capacity-fit");
  for (const candidate of [frozen, stored, buildCreationRepairPlan(stored)]) {
    const item = candidate.items.find((entry) => entry.itemId === original.itemId);
    assert.deepEqual(item.referenceSelection.referenceIndexes, [8, 9, 10]);
    assert.equal(item.prompt, original.prompt);
    assert.deepEqual(buildCreationItemReferenceImages(item, images, plan.referenceImageRoles).map((image) => image.referenceIndex), [8, 9, 10]);
  }
});
