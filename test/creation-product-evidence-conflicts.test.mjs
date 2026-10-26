import test from "node:test";
import assert from "node:assert/strict";
import { normalizeCreationProductInsights } from "../lib/creation-product-insights.mjs";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import { buildPromptAgentInput, CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA } from "../lib/prompt-agent.mjs";

const facts = [
  { id: "battery", text: "电池容量3000mAh", kind: "function", source: "reference", reference_indexes: [1, 2] },
  { id: "runtime", text: "45°C续航6小时", kind: "function", source: "reference", reference_indexes: [3] },
];
const screenshotWarning = "电池容量与续航相关信息出现在不同信息图中，但图3给出续航及温度数值，图1和图2标示3000mAh；这些信息的对应关系和准确性无法仅凭图片核实，生成时不应拼接成未经核实的性能承诺。";
const comparison = (attribute, value, condition = "同一款式") => ({ subject: "加热手套", attribute, condition, value });
const insights = (conflict) => ({
  confirmed_facts: facts,
  selling_points: [
    { id: "battery-selling", text: "内置电池", fact_ids: ["battery"] },
    { id: "runtime-selling", text: "资料注明的温度与续航", fact_ids: ["runtime"] },
  ],
  conflicts: [{ text: screenshotWarning, fact_ids: ["battery", "runtime"], claims: facts.map((fact) => fact.text), reference_indexes: [1, 2, 3], ...conflict }],
});

test("different attributes from separate images supplement each other", () => {
  const normalized = normalizeCreationProductInsights(insights({
    comparisons: [comparison("电池容量", "3000mAh"), comparison("续航", "6小时", "45°C")],
  }), { referenceCount: 3 });
  assert.deepEqual(normalized.conflicts, []);
  assert.deepEqual(normalized.confirmedFacts.map((fact) => fact.id), ["battery", "runtime"]);
  assert.equal(normalized.sellingPoints.length, 2);
});

test("legacy inability to verify a relationship does not discard readable facts", () => {
  const normalized = normalizeCreationProductInsights(insights(), { referenceCount: 3 });
  assert.deepEqual(normalized.conflicts, []);
  assert.deepEqual(normalized.confirmedFacts.map((fact) => fact.text), facts.map((fact) => fact.text));
  assert.ok(normalized.unknowns.includes(screenshotWarning));
});

test("different operating conditions and repeated values are not contradictions", () => {
  for (const comparisons of [
    [comparison("续航", "6小时", "45°C"), comparison("续航", "3小时", "55°C")],
    [comparison("电池容量", "3000mAh"), comparison("电池容量", "3000mAh")],
    [comparison("电池容量", "3000 mAh"), comparison("电池容量", "3000mAh")],
    [{ ...comparison("电池容量", "3000mAh"), subject: "款式A" }, { ...comparison("电池容量", "5000mAh"), subject: "款式B" }],
  ]) {
    const normalized = normalizeCreationProductInsights(insights({ comparisons }), { referenceCount: 3 });
    assert.deepEqual(normalized.conflicts, []);
    assert.equal(normalized.confirmedFacts.length, facts.length);
  }
});

test("an explicit contradiction excludes only facts for the same subject attribute and condition", () => {
  const raw = insights({
    text: "同一款式电池容量分别标为3000mAh和5000mAh，数值不一致",
    fact_ids: ["battery", "other-battery"],
    claims: ["电池容量3000mAh", "电池容量5000mAh"],
    comparisons: [comparison("电池容量", "3000mAh"), comparison("电池容量", "5000mAh")],
  });
  raw.confirmed_facts = [...facts, { ...facts[0], id: "other-battery", text: "电池容量5000mAh", reference_indexes: [2] }];
  const normalized = normalizeCreationProductInsights(raw, { referenceCount: 3 });
  assert.equal(normalized.conflicts.length, 1);
  assert.deepEqual(normalized.confirmedFacts.map((fact) => fact.id), ["runtime"]);
  assert.deepEqual(normalizeCreationProductInsights(normalized, { referenceCount: 3 }), normalized);
});

test("a legacy explicit contradiction remains excluded when its resolution is unknown", () => {
  const normalized = normalizeCreationProductInsights(insights({
    text: "同一款式电池容量3000mAh与5000mAh不一致，无法核实正确值",
    fact_ids: ["battery"],
    claims: ["电池容量3000mAh", "电池容量5000mAh"],
  }), { referenceCount: 3 });
  assert.equal(normalized.conflicts.length, 1);
  assert.deepEqual(normalized.confirmedFacts.map((fact) => fact.id), ["runtime"]);
});

test("complementary evidence reaches the plan without a conflict warning or removed notes", () => {
  const plan = buildCreationPlan({
    productName: "加热手套", productDescription: "电池容量3000mAh；45°C续航6小时。",
    selectedRoles: ["hero", "usage-suggestion"],
    referenceImageRoles: [
      { index: 1, filename: "front.png", role: "reference-product", note: "电池容量3000mAh" },
      { index: 2, filename: "battery.png", role: "feature", note: "电池容量3000mAh" },
      { index: 3, filename: "runtime.png", role: "feature", note: "45°C续航6小时" },
    ],
    productInsights: insights(),
  });
  assert.equal(plan.warnings.some((warning) => warning.code === "product-evidence-conflict"), false);
  assert.deepEqual(plan.productInsights.confirmedFacts.map((fact) => fact.id), ["battery", "runtime"]);
  assert.match(plan.productDescription, /3000mAh/);
  assert.match(plan.productDescription, /45°C续航6小时/);
  assert.ok(plan.referenceImageRoles.every((reference) => reference.note));
  assert.match(plan.items.map((item) => item.prompt).join("\n"), /3000mAh/);
  assert.match(plan.items.map((item) => item.prompt).join("\n"), /45°C续航6小时/);
});

test("reference analysis asks for comparable contradictions and keeps cross-image supplements", () => {
  const input = buildPromptAgentInput({
    images: [{ filename: "front.png", mimeType: "image/png", base64: "dGVzdA==" }],
    mode: "creation-reference-analysis",
  });
  const instruction = input[0].content[0].text;
  assert.match(instruction, /同一商品.*同一属性.*相同条件/);
  assert.match(instruction, /3000mAh.*45°C.*6小时/);
  assert.match(instruction, /互补信息/);
  assert.match(instruction, /comparisons/);
  assert.ok(CREATION_REFERENCE_ANALYSIS_JSON_SCHEMA.properties.product_insights.properties.conflicts.items.required.includes("comparisons"));
});
