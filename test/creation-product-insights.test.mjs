import test from "node:test";
import assert from "node:assert/strict";
import {
  allocateCreationProductScenes,
  buildCreationProductInsightPrompt,
  normalizeCreationProductInsights,
} from "../lib/creation-product-insights.mjs";
import { buildCreationPlan } from "../lib/creation-planner.mjs";

const rawInsights = {
  appearance_locks: [
    { text: "卡其色全指手套，掌心有灰色蜂窝补片，手背控制器位于拇指侧", reference_indexes: [1] },
  ],
  confirmed_facts: [
    { id: "appearance-1", text: "主图显示左右两只组成一双", kind: "appearance", source: "reference", reference_indexes: [1] },
    { id: "control-1", text: "手背可见控制器和按键", kind: "function", source: "reference", reference_indexes: [1, 2] },
    { id: "bad-number", text: "五档加热", kind: "function", source: "reference", reference_indexes: [2] },
  ],
  selling_points: [
    { id: "sell-1", text: "可在户外操作时保持手部可用", fact_ids: ["control-1"] },
  ],
  pain_points: [
    { id: "pain-1", text: "寒冷环境下操作小按键不方便", fact_ids: ["control-1"] },
  ],
  usage_scenarios: [
    { id: "scene-1", title: "通勤握把", environment: "冬季通勤的自行车握把", action: "一只手握住握把，另一只手调整手背控制器", framing: "hands-only action close-up", people: "hands", fact_ids: ["control-1"], pain_point_ids: ["pain-1"] },
    { id: "scene-2", title: "户外相机", environment: "寒冷户外的相机操作位置", action: "手指按下可见按键并保持相机操作姿势", framing: "over-the-shoulder crop", people: "hands", fact_ids: ["control-1"], pain_point_ids: [] },
  ],
  unknowns: ["未确认温度、档位和续航数字"],
  conflicts: [{ text: "功能数字互相冲突", fact_ids: ["bad-number"], claims: ["五档加热"], reference_indexes: [2] }],
};

test("product insights keep sourced facts, drop conflicted facts, and deduplicate scenes", () => {
  const normalized = normalizeCreationProductInsights(rawInsights, { referenceCount: 2, primaryIndex: 1 });
  assert.equal(Object.hasOwn(normalized, "appearanceLocks"), false);
  assert.equal(Object.hasOwn(normalized, "appearance_locks"), false);
  assert.equal(normalized.confirmedFacts.some((entry) => entry.id === "bad-number"), false);
  assert.equal(normalized.confirmedFacts.some((entry) => entry.id === "control-1"), true);
  assert.equal(normalized.sellingPoints[0].factIds[0], "control-1");
  assert.equal(normalized.usageScenarios.length, 2);
  assert.equal(normalized.conflicts[0].claims[0], "五档加热");
});

test("legacy appearance locks are ignored while sourced appearance facts remain available", () => {
  const normalized = normalizeCreationProductInsights({
    appearance_locks: [{ text: "APPEARANCE LOCK: incorrectly identified red open product", reference_indexes: [1] }],
    confirmed_facts: rawInsights.confirmed_facts,
  }, { referenceCount: 2, primaryIndex: 1 });
  assert.equal(Object.hasOwn(normalized, "appearanceLocks"), false);
  assert.ok(normalized.confirmedFacts.some((fact) => fact.id === "appearance-1"));
  assert.doesNotMatch(buildCreationProductInsightPrompt(normalized), /APPEARANCE LOCK|incorrectly identified red/);
});

test("analysis scenes give separate product-led jobs to suite items", () => {
  const normalized = normalizeCreationProductInsights(rawInsights, { referenceCount: 2, primaryIndex: 1 });
  const roles = ["scene", "scene-fit-1", "scene-fit-2", "benefit"].map((role) => ({ role, platformSlot: { scenePolicy: "role-default" } }));
  const assignments = allocateCreationProductScenes(roles, normalized, { places: ["entryway", "camera bag", "park bench", "worktable"] }, 0).filter(Boolean);
  assert.equal(assignments.length, 2, "two sourced actions must not become four scenes by changing backgrounds");
  assert.equal(new Set(assignments.map((entry) => entry.environment)).size, 2);
  assert.match(assignments[0].action, /控制器|握住/);

  const plan = buildCreationPlan({
    productName: "保暖手套",
    productDescription: "卡其色全指手套，手背有控制器。",
    selectedRoles: ["hero", "scene", "scene-fit-1", "benefit"],
    referenceImageRoles: [{ index: 1, filename: "gloves.png", role: "reference-product", note: "主商品" }],
    productInsights: rawInsights,
  });
  assert.match(plan.items.find((item) => item.role === "hero").prompt, /PRODUCT FIDELITY: gloves\.png/);
  assert.doesNotMatch(plan.items.find((item) => item.role === "hero").prompt, /APPEARANCE LOCK/);
  assert.match(plan.items.find((item) => item.role === "scene").prompt, /SCENE TASK/);
  assert.doesNotMatch(plan.items.find((item) => item.role === "scene").prompt, /五档加热/);
  assert.ok(plan.productInsights);
});
