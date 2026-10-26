import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { resolveCreationSelectedRolesSubmission } from "../lib/creation-browser-plan-state.mjs";
import * as creationPlanner from "../lib/creation-planner.mjs";

const serverUrl = new URL("../server.mjs", import.meta.url);
const appUrl = new URL("../public/app.js", import.meta.url);

// The universal profile owns exactly 18 carousel slots, so an explicit role submission longer
// than that must be cut back to the profile budget.
const EXPLICIT_TWENTY_ONE_ROLES = [
  "hero", "benefit", "scene", "multi-angle", "atmosphere", "product-detail", "brand-story",
  "size-capacity-fit", "effect-comparison", "scene-fit-1", "scene-fit-2", "accessory-gift",
  "series-showcase", "scene-fit-3", "after-sales", "usage-suggestion", "human-handheld",
  "human-wearable", "spec-table", "craft-process", "ingredient-material",
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
      errors: [{ message: "参数表必须保持白底且不含营销文字。" }],
    }),
    /参数表必须保持白底且不含营销文字/,
  );
});

test("planner caps explicit roles at the current platform image-type limit", () => {
  const plan = creationPlanner.buildCreationPlan({
    productName: "Travel Bottle",
    productDescription: "Product shown in the supplied image",
    platform: "universal",
    imageCount: 18,
    selectedRoles: EXPLICIT_TWENTY_ONE_ROLES,
    // Evidence is supplied for every evidence-gated slot so the platform does not fall back to
    // replacement image types; this test is about the role cap, not the missing-evidence path.
    platformEvidence: { dimensions: true, packageContents: true, skuVariants: true },
    infographicRebuildEnabled: false,
  });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.equal(plan.carouselImageCount, 18);
  assert.equal(plan.platformSetOverrides.imageCount, 18);
  assert.equal(carouselItems.length, 18);
  assert.equal(new Set(carouselItems.map((item) => item.slotKey)).size, 18);
  assert.deepEqual(carouselItems.map((item) => item.role), EXPLICIT_TWENTY_ONE_ROLES.slice(0, 18));
  assert.equal(carouselItems.some((item) => item.imageType === "custom"), false);
  assert.ok(
    plan.warnings.some((warning) => warning.code === "image-count-extension-limited"),
    "a 21-role submission must be reduced to the 18 universal slots",
  );
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
