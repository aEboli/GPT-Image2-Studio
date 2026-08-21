import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resolveCreationSelectedRolesSubmission } from "../lib/creation-browser-plan-state.mjs";
import * as creationPlanner from "../lib/creation-planner.mjs";

const serverUrl = new URL("../server.mjs", import.meta.url);
const appUrl = new URL("../public/app.js", import.meta.url);

const EXPLICIT_EIGHTEEN_ROLES = [
  "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
  "accessory-gift", "series-showcase", "usage-suggestion", "ingredient-material",
  "craft-process", "effect-comparison", "spec-table", "atmosphere", "human-handheld",
  "human-wearable", "brand-story", "after-sales",
];

test("local preview builder forwards the normalized platform planning model", async () => {
  const server = await readFile(serverUrl, "utf8");

  assert.match(server, /platformSetOverrides:\s*formData\.get\("platformSetOverrides"\)/);
  assert.match(server, /platformItemOverrides:\s*formData\.get\("platformItemOverrides"\)/);
  assert.match(server, /platformEvidence:\s*formData\.get\("platformEvidence"\)/);
  assert.match(server, /categorySignals:\s*formData\.get\("categorySignals"\)/);
  assert.match(server, /platformReferenceCoverage:\s*formData\.get\("platformReferenceCoverage"\)/);
});

test("local generation builder consumes the same platform override fields as preview", async () => {
  const server = await readFile(serverUrl, "utf8");
  const serverGenerate = server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";

  assert.match(serverGenerate, /platformSetOverrides:\s*formData\.get\("platformSetOverrides"\)/);
  assert.match(serverGenerate, /platformItemOverrides:\s*formData\.get\("platformItemOverrides"\)/);
  assert.match(serverGenerate, /platformEvidence:\s*formData\.get\("platformEvidence"\)/);
  assert.match(serverGenerate, /platformReferenceCoverage:\s*formData\.get\("platformReferenceCoverage"\)/);
  assert.match(serverGenerate, /assertCreationPlanCanGenerate\(plan\)/);
});

test("invalid sourced hard-rule plans are rejected before generation starts", () => {
  assert.equal(typeof creationPlanner.assertCreationPlanCanGenerate, "function");
  assert.throws(
    () => creationPlanner.assertCreationPlanCanGenerate({
      canGenerate: false,
      errors: [{ message: "Amazon 主图必须保持居中白底商品构图。" }],
    }),
    /Amazon 主图必须保持居中白底商品构图/,
  );
});

test("planner caps explicit roles at the current platform image-type limit", () => {
  const plan = creationPlanner.buildCreationPlan({
    productName: "Travel Bottle",
    productDescription: "Product shown in the supplied image",
    platform: "amazon",
    imageCount: 18,
    selectedRoles: EXPLICIT_EIGHTEEN_ROLES,
    platformEvidence: { dimensions: true, packageContents: true },
    infographicRebuildEnabled: false,
  });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.equal(plan.carouselImageCount, 7);
  assert.equal(plan.platformSetOverrides.imageCount, 7);
  assert.equal(carouselItems.length, 7);
  assert.equal(new Set(carouselItems.map((item) => item.slotKey)).size, 7);
  assert.deepEqual(carouselItems.map((item) => item.role), EXPLICIT_EIGHTEEN_ROLES.slice(0, 7));
  assert.equal(carouselItems.some((item) => item.imageType === "custom"), false);
});

test("browser re-preview preserves only explicitly frozen target-language overrides", async () => {
  const app = await readFile(appUrl, "utf8");
  const previewBuilder = app.match(
    /function buildCreationPlanPreviewFormData\(\)[\s\S]*?(?=\r?\nfunction buildCreationFormData)/,
  )?.[0] || "";

  assert.match(previewBuilder, /frozenPayload\.values\.platformSetOverrides/);
  assert.match(
    previewBuilder,
    /if \(!Object\.prototype\.hasOwnProperty\.call\(frozenPayload\.values\.platformSetOverrides, "targetLanguage"\)\)/,
  );
  const roleSubmission = resolveCreationSelectedRolesSubmission({
    effectivePlan: { items: [], carouselImageCount: 0 },
    platformSetOverrides: {},
    selectedRoles: [],
    roleSelectionManuallyEdited: false,
  });
  assert.equal(roleSubmission.imageCount, null);
  assert.equal(roleSubmission.selectedRoles, null);
});
