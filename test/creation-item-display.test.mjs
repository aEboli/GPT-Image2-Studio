import assert from "node:assert/strict";
import test from "node:test";

import { getCreationItemDisplayTitle, isCreationTargetShopperResonanceItem } from "../lib/creation-item-display.mjs";

test("legacy second benefit slot is displayed as target-shopper resonance", () => {
  const item = {
    itemId: "universal:benefit-proof",
    slotIndex: 2,
    role: "usage-suggestion",
    imageType: "usage-demo",
    title: "卖点图",
  };

  assert.equal(isCreationTargetShopperResonanceItem(item), true);
  assert.equal(getCreationItemDisplayTitle(item), "目标人群共鸣图");
  assert.equal(item.title, "卖点图");
});

test("legacy benefit role labels are migrated without changing stored data", () => {
  const item = { itemId: "2-benefit", slotIndex: 2, role: "benefit", imageType: "benefit-proof", title: "核心信息融合图" };

  assert.equal(getCreationItemDisplayTitle(item), "目标人群共鸣图");
  assert.equal(item.title, "核心信息融合图");
});

test("the later selling-point slot remains a selling-point image", () => {
  const item = { itemId: "universal:selling-point-stack", slotIndex: 16, role: "usage-suggestion", imageType: "selling-point-stack", title: "卖点图" };

  assert.equal(isCreationTargetShopperResonanceItem(item), false);
  assert.equal(getCreationItemDisplayTitle(item), "卖点图");
});

test("new target-shopper slot keeps its user-facing label", () => {
  assert.equal(
    getCreationItemDisplayTitle({ itemId: "universal:target-shopper-resonance", imageType: "target-shopper-resonance", title: "目标人群共鸣图" }),
    "目标人群共鸣图",
  );
});
