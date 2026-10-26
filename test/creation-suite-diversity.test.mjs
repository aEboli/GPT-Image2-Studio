import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import { CREATION_CATEGORY_TEMPLATE_OPTIONS } from "../lib/creation-category-templates.mjs";

const CAROUSEL_SLOTS = 18;
const OVERLAY_SIGNALS = [
  "apparel-fit",
  "electronics-specifications",
  "food-ingredients",
  "package-contents",
  "condition",
  "multiple-skus",
];

function carouselItems(plan) {
  return (plan.items || []).filter((item) => item.itemKind === "carousel");
}

function duplicateRoles(items) {
  const counts = new Map();
  for (const item of items) {
    counts.set(item.role, (counts.get(item.role) || 0) + 1);
  }
  return [...counts.entries()].filter(([, count]) => count > 1).map(([role]) => role);
}

function identicalPromptPairs(items) {
  const pairs = [];
  for (let left = 0; left < items.length; left += 1) {
    for (let right = left + 1; right < items.length; right += 1) {
      if (items[left].prompt === items[right].prompt) {
        pairs.push([items[left].slotIndex, items[right].slotIndex]);
      }
    }
  }
  return pairs;
}

function buildUniversalPlan(input) {
  return buildCreationPlan({
    platform: "universal",
    imageCount: CAROUSEL_SLOTS,
    productName: "测试商品",
    productDescription: "标准描述 常规参数",
    sellingPoints: ["常规卖点"],
    ...input,
  });
}

test("every category template plans distinct carousel slots", () => {
  const offenders = [];
  for (const template of CREATION_CATEGORY_TEMPLATE_OPTIONS) {
    const items = carouselItems(
      buildUniversalPlan({
        productName: template.label,
        industryTemplate: template.value,
      }),
    );
    const roles = duplicateRoles(items);
    const identical = identicalPromptPairs(items);
    if (items.length !== CAROUSEL_SLOTS || roles.length > 0 || identical.length > 0) {
      offenders.push({ value: template.value, label: template.label, slots: items.length, roles, identical });
    }
  }
  assert.deepEqual(
    offenders.slice(0, 3),
    [],
    `${offenders.length} category templates produce duplicate roles or identical prompts`,
  );
});

test("apparel templates keep the multi-angle slot instead of a second fit image", () => {
  const items = carouselItems(
    buildUniversalPlan({
      productName: "连衣裙",
      productDescription: "雪纺 收腰",
      sellingPoints: ["显瘦"],
      industryTemplate: "category:C01-001-004-001",
    }),
  );
  const roles = items.map((item) => item.role);
  assert.equal(items.length, CAROUSEL_SLOTS);
  assert.equal(new Set(roles).size, CAROUSEL_SLOTS);
  assert.equal(roles.filter((role) => role === "size-capacity-fit").length, 1);
  assert.equal(roles.includes("multi-angle"), true);
  assert.equal(items.filter((item) => item.imageType === "dimension-fit").length, 1);
});

test("category overlays never duplicate a role already present in the set", () => {
  for (const signal of OVERLAY_SIGNALS) {
    const items = carouselItems(buildUniversalPlan({ categorySignals: [signal] }));
    assert.deepEqual(duplicateRoles(items), [], signal);
    assert.deepEqual(identicalPromptPairs(items), [], signal);
  }
});

const PERSON_LED_ROLES = ["benefit", "atmosphere", "human-handheld", "after-sales"];

const GUARANTEED_ROLE_GROUPS = [
  ["hero"],
  ["size-capacity-fit"],
  ["spec-table", "usage-suggestion"],
  ["product-detail"],
  ["scene"],
  ["multi-angle"],
];

test("every full universal set keeps all six guaranteed image jobs", () => {
  for (const industryTemplate of ["general", "apparel", "electronics", "food", "category:C17-001-001-001"]) {
    const items = carouselItems(buildUniversalPlan({ productName: "测试商品", industryTemplate }));
    assert.equal(items.length, CAROUSEL_SLOTS, industryTemplate);
    const roles = items.map((item) => item.role);
    for (const group of GUARANTEED_ROLE_GROUPS) {
      assert.equal(group.some((role) => roles.includes(role)), true, `${industryTemplate} lost ${group.join("|")}`);
    }
  }
});

test("person-led roles shrink by at most one replacement per category budget", () => {
  const rolesFor = (industryTemplate) => carouselItems(
    buildUniversalPlan({ productName: "测试商品", industryTemplate }),
  ).map((item) => item.role);

  const countPersonRoles = (industryTemplate) => rolesFor(industryTemplate)
    .filter((role) => PERSON_LED_ROLES.includes(role)).length;

  // A full universal set carries four person-led jobs (benefit, atmosphere, human-handheld,
  // after-sales). Categories whose budget is already five keep all four.
  assert.equal(countPersonRoles("general"), 4);
  assert.equal(countPersonRoles("apparel"), 4);
  assert.equal(countPersonRoles("category:C02-002-003-001"), 4);

  // structure-cutaway is the only replacement image type for a person role, so every lower
  // budget can swap out exactly one person job: the floor is three, even where the budget is two.
  assert.equal(countPersonRoles("electronics"), 3);
  assert.equal(countPersonRoles("category:C07-001-001-001"), 3);
  assert.equal(countPersonRoles("category:C17-001-001-001"), 3);
  assert.equal(countPersonRoles("category:C17-001-001-001") >= 3, true);

  // The removed person job is replaced by the structure-cutaway role, not dropped silently.
  assert.equal(rolesFor("general").includes("craft-process"), false);
  assert.equal(rolesFor("electronics").includes("craft-process"), true);
  assert.equal(rolesFor("electronics").includes("atmosphere"), false);
});
test("two different products do not share the same visual format lineup", () => {
  const formats = (productName) => carouselItems(buildUniversalPlan({
    productName,
    productDescription: "标准描述",
    industryTemplate: "general",
  })).map((item) => (item.prompt.match(/Visual format: [^.]+\./) || [""])[0]).filter(Boolean);

  const first = formats("男士速干短袖T恤");
  const second = formats("不锈钢保温杯");

  assert.equal(first.length > 10, true);
  assert.equal(new Set(first).size, first.length);
  assert.equal(new Set(second).size, second.length);
  assert.notDeepEqual(first, second);
});

test("the same product keeps a stable variant lineup across rebuilds", () => {
  const formats = () => carouselItems(buildUniversalPlan({
    productName: "不锈钢保温杯",
    productDescription: "500ml 双层真空",
    industryTemplate: "general",
  })).map((item) => (item.prompt.match(/Visual format: [^.]+\./) || [""])[0]).filter(Boolean);

  assert.deepEqual(formats(), formats());
});
