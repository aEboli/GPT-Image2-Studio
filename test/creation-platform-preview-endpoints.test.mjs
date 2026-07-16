import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

import { handleApiRequest } from "../cloudflare-pages-worker.mjs";
import { resolveCreationSelectedRolesSubmission } from "../lib/creation-browser-plan-state.mjs";
import * as creationPlanner from "../lib/creation-planner.mjs";

const serverPath = fileURLToPath(new URL("../server.mjs", import.meta.url));
const workerPath = fileURLToPath(new URL("../cloudflare-pages-worker.mjs", import.meta.url));
const appPath = fileURLToPath(new URL("../public/app.js", import.meta.url));
const FULL_EVIDENCE = {
  dimensions: true,
  materials: true,
  packageContents: true,
  performance: true,
  specifications: true,
};
const EXPLICIT_EIGHTEEN_ROLES = [
  "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
  "accessory-gift", "series-showcase", "usage-suggestion", "ingredient-material",
  "craft-process", "effect-comparison", "spec-table", "atmosphere", "human-handheld",
  "human-wearable", "brand-story", "after-sales",
];

function buildPlatformPreviewFormData() {
  const formData = new FormData();
  formData.set("productName", "Trail Bottle");
  formData.set("productDescription", "Insulated bottle with supplied carry loop");
  formData.set("sellingPoints", "keeps drinks cool");
  formData.set("platform", "amazon");
  formData.set("industryTemplate", "electronics");
  formData.set("infographicRebuildEnabled", "false");
  formData.set(
    "platformSetOverrides",
    JSON.stringify({ imageCount: 4, ratio: "3:4", resolutionTier: "2K", targetLanguage: "ja" }),
  );
  formData.set(
    "platformItemOverrides",
    JSON.stringify([{ slotKey: "amazon:benefit-proof", composition: "comparison-layout" }]),
  );
  formData.set(
    "platformEvidence",
    JSON.stringify({ dimensions: true, materials: true, packageContents: true, performance: true, specifications: true }),
  );
  formData.set("categorySignals", JSON.stringify(["electronics-specifications"]));
  formData.set(
    "platformReferenceCoverage",
    JSON.stringify([{ role: "usage", filename: "usage-guide.png", note: "supplied usage steps" }]),
  );
  return formData;
}

test("local and Worker preview builders forward the normalized platform planning model", async () => {
  const [server, worker] = await Promise.all([readFile(serverPath, "utf8"), readFile(workerPath, "utf8")]);

  for (const source of [server, worker]) {
    assert.match(source, /platformSetOverrides:\s*formData\.get\("platformSetOverrides"\)/);
    assert.match(source, /platformItemOverrides:\s*formData\.get\("platformItemOverrides"\)/);
    assert.match(source, /platformEvidence:\s*formData\.get\("platformEvidence"\)/);
    assert.match(source, /categorySignals:\s*formData\.get\("categorySignals"\)/);
    assert.match(source, /platformReferenceCoverage:\s*formData\.get\("platformReferenceCoverage"\)/);
  }
});

test("local and Worker generation builders consume the same platform override fields as preview", async () => {
  const [server, worker] = await Promise.all([readFile(serverPath, "utf8"), readFile(workerPath, "utf8")]);
  const serverGenerate = server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const workerGenerate = worker.match(/async function runCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function runCreationLogoBatchGenerate/)?.[0] || "";

  for (const source of [serverGenerate, workerGenerate]) {
    assert.match(source, /platformSetOverrides:\s*formData\.get\("platformSetOverrides"\)/);
    assert.match(source, /platformItemOverrides:\s*formData\.get\("platformItemOverrides"\)/);
    assert.match(source, /platformEvidence:\s*formData\.get\("platformEvidence"\)/);
    assert.match(source, /platformReferenceCoverage:\s*formData\.get\("platformReferenceCoverage"\)/);
    assert.match(source, /assertCreationPlanCanGenerate\(plan\)/);
  }
});

test("invalid sourced hard-rule plans are rejected before generation starts", async () => {
  assert.equal(typeof creationPlanner.assertCreationPlanCanGenerate, "function");
  assert.throws(
    () =>
      creationPlanner.assertCreationPlanCanGenerate({
        canGenerate: false,
        errors: [{ message: "Amazon 主图必须保持居中白底商品构图。" }],
      }),
    /Amazon 主图必须保持居中白底商品构图/,
  );

  const formData = new FormData();
  formData.set("productName", "Trail Bottle");
  formData.set("platform", "amazon");
  formData.set("platformSetOverrides", JSON.stringify({ imageCount: 1 }));
  formData.set(
    "platformItemOverrides",
    JSON.stringify([{ slotKey: "amazon:amazon-main", composition: "collage-grid" }]),
  );

  const response = await handleApiRequest(
    new Request("https://studio.example/api/creation/generate", { method: "POST", body: formData }),
  );
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.match(text, /event:\s*error/);
  assert.match(text, /Amazon 主图必须为单一居中商品白底构图，不得拼贴/);
  assert.doesNotMatch(text, /API Key/);
});

test("Cloudflare preview returns strategy metadata, normalized overrides, validation, and per-item parameters", async () => {
  const response = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", {
      method: "POST",
      body: buildPlatformPreviewFormData(),
    }),
  );
  const payload = await response.json();

  assert.equal(response.status, 200);
  assert.equal(payload.ok, true);
  assert.equal(payload.plan.platformPolicyId, "amazon");
  assert.match(payload.plan.strategyVersion, /^\d{4}-\d{2}-\d{2}\.\d+$/u);
  assert.equal(payload.plan.platformEvidenceLevel, "A");
  assert.deepEqual(payload.plan.platformSetOverrides, {
    targetLanguage: "ja",
    ratio: "3:4",
    resolutionTier: "2K",
    imageCount: 4,
  });
  assert.deepEqual(payload.plan.platformItemOverrides, [
    { slotKey: "amazon:benefit-proof", composition: "comparison-layout" },
  ]);
  assert.equal(payload.plan.validation.isValid, true);
  assert.deepEqual(payload.plan.errors, []);
  assert.equal(payload.plan.carouselImageCount, 4);
  assert.equal(payload.plan.totalPlannedItemCount, 4);
  assert.ok(payload.plan.items.every((item) => item.itemKind === "carousel"));
  assert.ok(payload.plan.items.every((item) => item.ratio === "3:4"));
  assert.ok(payload.plan.items.every((item) => item.resolutionTier === "2K"));
  assert.ok(payload.plan.items.every((item) => item.targetLanguage === "ja"));
  assert.ok(payload.plan.items.every((item) => item.imageType && item.logoPolicy && Array.isArray(item.constraints)));
  assert.ok(payload.plan.categorySignals.includes("electronics-specifications"));
  assert.ok(payload.plan.platformReferenceCoverage.some((entry) => entry.role === "usage"));
  assert.equal(
    payload.plan.items.find((item) => item.slotKey === "amazon:benefit-proof").composition,
    "comparison-layout",
  );
});

test("explicit 18-image selection survives shared local planning and repeated Worker previews", async () => {
  const buildFormData = () => {
    const formData = new FormData();
    formData.set("productName", "Travel Bottle");
    formData.set("productDescription", "Product shown in the supplied image");
    formData.set("platform", "amazon");
    formData.set("imageCount", "18");
    formData.set("selectedRoles", JSON.stringify(EXPLICIT_EIGHTEEN_ROLES));
    formData.set("infographicRebuildEnabled", "false");
    formData.set("platformSetOverrides", JSON.stringify({ imageCount: 18 }));
    formData.set("platformItemOverrides", "[]");
    formData.set("platformEvidence", "{}");
    formData.set("categorySignals", "[]");
    formData.set("platformReferenceCoverage", "[]");
    return formData;
  };
  const localPlan = creationPlanner.buildCreationPlan(Object.fromEntries(buildFormData().entries()));
  const initialResponse = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", { method: "POST", body: buildFormData() }),
  );
  const initialPlan = (await initialResponse.json()).plan;
  const repeatedFormData = buildFormData();
  repeatedFormData.set("platformSetOverrides", JSON.stringify(initialPlan.platformSetOverrides));
  repeatedFormData.set("platformItemOverrides", JSON.stringify(initialPlan.platformItemOverrides));
  const repeatedResponse = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", { method: "POST", body: repeatedFormData }),
  );
  const repeatedPlan = (await repeatedResponse.json()).plan;

  for (const plan of [localPlan, initialPlan, repeatedPlan]) {
    const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");
    assert.equal(plan.carouselImageCount, 18);
    assert.equal(carouselItems.length, 18);
    assert.equal(new Set(carouselItems.map((item) => item.slotKey)).size, 18);
    assert.deepEqual(carouselItems.map((item) => item.role), EXPLICIT_EIGHTEEN_ROLES);
  }
  assert.equal(initialResponse.status, 200);
  assert.equal(repeatedResponse.status, 200);
});

test("re-previewing one frozen browser plan preserves platform semantics without promoting automatic language", async () => {
  const app = await readFile(appPath, "utf8");
  const previewBuilder = app.match(
    /function buildCreationPlanPreviewFormData\(\)[\s\S]*?(?=\r?\nfunction buildCreationFormData)/,
  )?.[0] || "";
  const preservesOnlyExplicitFrozenTargetLanguage = /if \(!Object\.prototype\.hasOwnProperty\.call\(frozenPayload\.values\.platformSetOverrides, "targetLanguage"\)\) \{\r?\n\s*formData\.delete\("targetLanguage"\)/.test(previewBuilder);
  const buildInitialFormData = () => {
    const formData = new FormData();
    formData.set("productName", "普通商品");
    formData.set("productDescription", "普通商品描述");
    formData.set("platform", "tmall-taobao");
    formData.set("industryTemplate", "general");
    formData.set("selectedRoles", "[]");
    formData.set("infographicRebuildEnabled", "false");
    formData.set("platformSetOverrides", "{}");
    formData.set("platformItemOverrides", "[]");
    formData.set("platformEvidence", "{}");
    formData.set("categorySignals", "[]");
    formData.set("platformReferenceCoverage", "[]");
    return formData;
  };
  const initialResponse = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", { method: "POST", body: buildInitialFormData() }),
  );
  const initialPayload = await initialResponse.json();
  const frozenPlan = initialPayload.plan;
  const repeatedFormData = buildInitialFormData();
  const roleSubmission = resolveCreationSelectedRolesSubmission({
    effectivePlan: frozenPlan,
    platformSetOverrides: frozenPlan.platformSetOverrides,
    selectedRoles: frozenPlan.items
      .filter((item) => item.enabled !== false && item.itemKind === "carousel")
      .map((item) => item.role),
    roleSelectionManuallyEdited: false,
  });
  if (roleSubmission.imageCount !== null) repeatedFormData.set("imageCount", String(roleSubmission.imageCount));
  else repeatedFormData.delete("imageCount");
  if (roleSubmission.selectedRoles !== null) repeatedFormData.set("selectedRoles", JSON.stringify(roleSubmission.selectedRoles));
  else repeatedFormData.delete("selectedRoles");
  if (!preservesOnlyExplicitFrozenTargetLanguage) {
    repeatedFormData.set("targetLanguage", frozenPlan.targetLanguage);
  }
  repeatedFormData.set("platformSetOverrides", JSON.stringify(frozenPlan.platformSetOverrides));
  repeatedFormData.set("platformItemOverrides", JSON.stringify(frozenPlan.platformItemOverrides));
  repeatedFormData.set("platformEvidence", JSON.stringify(frozenPlan.platformEvidence));
  repeatedFormData.set("categorySignals", JSON.stringify(frozenPlan.categorySignals));
  repeatedFormData.set("platformReferenceCoverage", JSON.stringify(frozenPlan.platformReferenceCoverage));

  const repeatedResponse = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", { method: "POST", body: repeatedFormData }),
  );
  const repeatedPayload = await repeatedResponse.json();
  const selectSlotSemantics = (plan) => plan.items
    .filter((item) => item.enabled !== false && item.itemKind === "carousel")
    .map(({ slotKey, imageType, role, ratio }) => ({ slotKey, imageType, role, ratio }));

  assert.equal(initialResponse.status, 200);
  assert.equal(repeatedResponse.status, 200);
  assert.deepEqual(selectSlotSemantics(repeatedPayload.plan), selectSlotSemantics(frozenPlan));
  assert.equal(Object.hasOwn(repeatedPayload.plan.platformSetOverrides, "imageCount"), false);
  assert.equal(Object.hasOwn(repeatedPayload.plan.platformSetOverrides, "targetLanguage"), false);
  assert.deepEqual(repeatedPayload.plan.platformItemOverrides, frozenPlan.platformItemOverrides);
  assert.equal(repeatedPayload.plan.items.find((item) => item.slotKey === "tmall-taobao:long-detail")?.ratio, "2:3");
});

test("re-previewing preserves an explicit frozen target-language override", async () => {
  const app = await readFile(appPath, "utf8");
  const previewBuilder = app.match(
    /function buildCreationPlanPreviewFormData\(\)[\s\S]*?(?=\r?\nfunction buildCreationFormData)/,
  )?.[0] || "";
  const frozenPlanBranch = previewBuilder.match(/if \(effectivePlan\) \{([\s\S]*?)\r?\n\s*\} else \{/)?.[1] || "";
  const preservesOnlyExplicitFrozenTargetLanguage = /if \(!Object\.prototype\.hasOwnProperty\.call\(frozenPayload\.values\.platformSetOverrides, "targetLanguage"\)\) \{\r?\n\s*formData\.delete\("targetLanguage"\)/.test(
    frozenPlanBranch,
  );
  const buildFormData = () => {
    const formData = new FormData();
    formData.set("productName", "Explicit Japanese listing");
    formData.set("platform", "amazon");
    formData.set("industryTemplate", "general");
    formData.set("selectedRoles", "[]");
    formData.set("infographicRebuildEnabled", "false");
    formData.set("platformSetOverrides", JSON.stringify({ targetLanguage: "ja" }));
    formData.set("platformItemOverrides", "[]");
    formData.set("platformEvidence", "{}");
    formData.set("categorySignals", "[]");
    formData.set("platformReferenceCoverage", "[]");
    return formData;
  };
  const initialResponse = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", { method: "POST", body: buildFormData() }),
  );
  const initialPlan = (await initialResponse.json()).plan;
  const repeatedFormData = buildFormData();
  repeatedFormData.set("platformSetOverrides", JSON.stringify(initialPlan.platformSetOverrides));
  if (preservesOnlyExplicitFrozenTargetLanguage) {
    repeatedFormData.set("targetLanguage", initialPlan.targetLanguage);
  }

  const repeatedResponse = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", { method: "POST", body: repeatedFormData }),
  );
  const repeatedPlan = (await repeatedResponse.json()).plan;

  assert.equal(initialResponse.status, 200);
  assert.equal(repeatedResponse.status, 200);
  assert.equal(initialPlan.platformSetOverrides.targetLanguage, "ja");
  assert.equal(repeatedPlan.platformSetOverrides.targetLanguage, "ja");
  assert.equal(repeatedPlan.targetLanguage, "ja");
  assert.ok(repeatedPlan.items.every((item) => item.targetLanguage === "ja"));
});

test("final Amazon main-image field overrides are revalidated by preview and generation", async () => {
  const buildInitialFormData = () => {
    const formData = new FormData();
    formData.set("productName", "Trail Bottle");
    formData.set("platform", "amazon");
    formData.set("infographicRebuildEnabled", "false");
    formData.set("platformSetOverrides", JSON.stringify({ imageCount: 5 }));
    formData.set("platformItemOverrides", "[]");
    formData.set("platformEvidence", JSON.stringify(FULL_EVIDENCE));
    formData.set("categorySignals", "[]");
    formData.set("platformReferenceCoverage", "[]");
    return formData;
  };
  const initialResponse = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", {
      method: "POST",
      body: buildInitialFormData(),
    }),
  );
  const initialPayload = await initialResponse.json();
  const frozenPlan = initialPayload.plan;
  const buildConflictingFormData = () => {
    const formData = new FormData();
    formData.set("productName", frozenPlan.productName);
    formData.set("productDescription", frozenPlan.productDescription);
    formData.set("sellingPoints", frozenPlan.sellingPoints.join("\n"));
    formData.set("dimensionSpecs", frozenPlan.dimensionSpecs);
    formData.set("dimensionUnitMode", frozenPlan.dimensionUnitMode);
    formData.set("targetLanguage", frozenPlan.targetLanguage);
    formData.set("imageCount", String(frozenPlan.carouselImageCount));
    formData.set("platform", frozenPlan.requestedPlatform || frozenPlan.platform);
    formData.set("industryTemplate", frozenPlan.industryTemplate);
    formData.set("selectedRoles", JSON.stringify(frozenPlan.items.filter((item) => item.itemKind === "carousel").map((item) => item.role)));
    formData.set("referenceImageRoles", JSON.stringify(frozenPlan.referenceImageRoles));
    formData.set("skuSubjects", JSON.stringify(frozenPlan.skuSubjects));
    formData.set("infographicRebuildEnabled", String(frozenPlan.infographicRebuildEnabled));
    formData.set("platformSetOverrides", JSON.stringify(frozenPlan.platformSetOverrides));
    formData.set(
      "platformItemOverrides",
      JSON.stringify([
        {
          slotKey: "amazon:amazon-main",
          textPolicy: "concise",
          logoPolicy: "allow-supplied",
        },
      ]),
    );
    formData.set("platformEvidence", JSON.stringify(frozenPlan.platformEvidence));
    formData.set("categorySignals", JSON.stringify(frozenPlan.categorySignals));
    formData.set("platformReferenceCoverage", JSON.stringify(frozenPlan.platformReferenceCoverage));
    formData.set("planOverrides", "[]");
    return formData;
  };

  const previewResponse = await handleApiRequest(
    new Request("https://studio.example/api/creation/plan", {
      method: "POST",
      body: buildConflictingFormData(),
    }),
  );
  const previewPayload = await previewResponse.json();
  const constraintIds = previewPayload.plan.errors.map((error) => error.constraintId);

  assert.equal(previewResponse.status, 200);
  assert.equal(previewPayload.plan.canGenerate, false);
  assert.equal(previewPayload.plan.validation.isValid, false);
  assert.ok(constraintIds.includes("amazon-main-no-marketing-text"));
  assert.ok(constraintIds.includes("amazon-main-no-external-logo"));

  const generationResponse = await handleApiRequest(
    new Request("https://studio.example/api/creation/generate", {
      method: "POST",
      body: buildConflictingFormData(),
    }),
  );
  const generationText = await generationResponse.text();

  assert.equal(generationResponse.status, 200);
  assert.match(generationText, /event:\s*error/);
  assert.match(generationText, /Amazon 主图不得包含营销文字/);
  assert.doesNotMatch(generationText, /API Key/);
});
