import assert from "node:assert/strict";
import test from "node:test";

test("creation plan counts are derived from actual enabled item kinds", async () => {
  const { resolveCreationPlanCounts } = await import("../lib/creation-plan-counts.mjs");
  const counts = resolveCreationPlanCounts({
    imageCount: 10,
    carouselImageCount: 10,
    skuImageCount: 9,
    infographicRebuildCount: 8,
    totalPlannedItemCount: 27,
    items: [
      { itemId: "rebuild", itemKind: "infographic-rebuild", role: "infographic-rebuild" },
      { itemId: "sku", itemKind: "sku", role: "sku" },
      { itemId: "disabled", itemKind: "carousel", role: "hero", enabled: false },
    ],
  });

  assert.deepEqual(counts, {
    imageCount: 0,
    carouselImageCount: 0,
    skuImageCount: 1,
    infographicRebuildCount: 1,
    totalPlannedItemCount: 2,
  });
});

test("creation plan counts preserve explicit zero values when item data is unavailable", async () => {
  const { resolveCreationPlanCounts } = await import("../lib/creation-plan-counts.mjs");
  assert.deepEqual(resolveCreationPlanCounts({
    imageCount: 0,
    carouselImageCount: 0,
    skuImageCount: 0,
    infographicRebuildCount: 2,
    totalPlannedItemCount: 2,
  }), {
    imageCount: 0,
    carouselImageCount: 0,
    skuImageCount: 0,
    infographicRebuildCount: 2,
    totalPlannedItemCount: 2,
  });
});

test("creation module booleans preserve explicit falsy representations", async () => {
  const { normalizeCreationModuleEnabled } = await import("../lib/creation-plan-counts.mjs");

  for (const value of [false, 0, "0", "false", "off", "no"]) {
    assert.equal(normalizeCreationModuleEnabled(value, true), false, String(value));
  }
  assert.equal(normalizeCreationModuleEnabled(undefined, true), true);
  assert.equal(normalizeCreationModuleEnabled(undefined, false), false);
  assert.equal(normalizeCreationModuleEnabled(true, false), true);
});
