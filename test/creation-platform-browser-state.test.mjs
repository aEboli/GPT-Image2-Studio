import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as creationBrowserPlanState from "../lib/creation-browser-plan-state.mjs";

const appPath = fileURLToPath(new URL("../public/app.js", import.meta.url));

async function readApp() {
  return readFile(appPath, "utf8");
}

test("nested-only effective plans are selected as the frozen record source", () => {
  const effectivePlan = {
    platform: "amazon",
    items: [{ itemId: "hero", role: "hero" }],
    carouselImageCount: 1,
    warnings: [{ code: "source-warning" }],
  };

  assert.equal(creationBrowserPlanState.getCreationSetPlanSource({ setId: "record-1", effectivePlan }), effectivePlan);
  assert.deepEqual(creationBrowserPlanState.getCreationSetPlanSource({ setId: "record-2" }), { setId: "record-2" });
});

test("Creation generation follows the effective plan validation state", () => {
  assert.equal(typeof creationBrowserPlanState.shouldDisableCreationGenerateButton, "function");
  assert.equal(
    creationBrowserPlanState.shouldDisableCreationGenerateButton({
      planning: false,
      preparingReferences: false,
      effectivePlan: { canGenerate: false },
    }),
    true,
  );
  assert.equal(
    creationBrowserPlanState.shouldDisableCreationGenerateButton({
      planning: false,
      preparingReferences: false,
      effectivePlan: { canGenerate: true },
    }),
    false,
  );
});

function getFunctionSource(source, name, nextName = "") {
  const suffix = nextName ? `function ${nextName}` : "function ";
  const pattern = new RegExp(
    `function ${name}\\([^]*?(?=\\r?\\n${suffix})`,
  );
  return source.match(pattern)?.[0] || "";
}

test("Creation browser normalization retains the effective platform plan contract", async () => {
  const app = await readApp();
  const itemNormalizer = getFunctionSource(app, "normalizeCreationItemForView", "normalizeCreationSetForView");
  const setNormalizer = getFunctionSource(app, "normalizeCreationSetForView", "isCreationMissingAssetItem");

  for (const field of [
    "imageType",
    "slotKey",
    "itemKind",
    "enabled",
    "ratio",
    "resolutionTier",
    "effectiveSize",
    "targetLanguage",
    "composition",
    "textPolicy",
    "scenePolicy",
    "logoPolicy",
    "constraints",
    "conversionIntent",
  ]) {
    assert.match(itemNormalizer, new RegExp(`\\b${field}:`), `missing item field ${field}`);
  }

  for (const field of [
    "strategyVersion",
    "platformPolicyId",
    "platformEvidenceLevel",
    "platformSetOverrides",
    "platformItemOverrides",
    "platformEvidence",
    "categorySignals",
    "platformReferenceCoverage",
    "validation",
    "warnings",
    "carouselImageCount",
    "skuImageCount",
    "infographicRebuildCount",
    "totalPlannedItemCount",
    "effectivePlan",
  ]) {
    assert.match(setNormalizer, new RegExp(`\\b${field}:`), `missing set field ${field}`);
  }
});

test("preview and record reuse hydrate one recursively frozen effective plan", async () => {
  const app = await readApp();
  const frozen = creationBrowserPlanState.deepFreezeCreationPlanValue({ nested: { value: 1 } });

  assert.match(app, /effectivePlan:\s*null/);
  assert.equal(Object.isFrozen(frozen), true);
  assert.equal(Object.isFrozen(frozen.nested), true);
  assert.match(app, /state\.creation\.effectivePlan = deepFreezeCreationPlanValue\(normalized\)/);
  assert.match(
    app,
    /function hydrateCreationEffectivePlan\(plan[\s\S]*state\.creation\.effectivePlan = deepFreezeCreationPlanValue/,
  );
  assert.match(
    app,
    /async function previewCreationPlan\([\s\S]*hydrateCreationEffectivePlan\(plan\)/,
  );
  assert.match(
    app,
    /function applyCreationSetToForm\(set\)[\s\S]*restoreCreationEffectivePlanFromSet\(normalized\)/,
  );
});

test("preview and generation serialize the same frozen normalized platform payload", async () => {
  const app = await readApp();
  const previewBuilder = getFunctionSource(app, "buildCreationPlanPreviewFormData", "buildCreationFormData");
  const generationBuilder = getFunctionSource(app, "buildCreationFormData", "buildCreationLogoBatchFormData");

  assert.match(app, /const CREATION_PLATFORM_FORM_DATA_FIELDS = \[[\s\S]*"platformSetOverrides"[\s\S]*"platformItemOverrides"[\s\S]*"platformEvidence"[\s\S]*"categorySignals"[\s\S]*"platformReferenceCoverage"[\s\S]*\]/);
  assert.match(app, /function createFrozenCreationPlatformPayload\(source = \{\}\)/);
  assert.match(app, /normalizeCreationPlatformSetOverrides/);
  assert.match(app, /normalizeCreationPlatformItemOverrides/);
  assert.match(
    app,
    /function appendFrozenCreationPlatformPayload\(formData, snapshot = getFrozenCreationPlatformPayload\(\)\)[\s\S]*formData\.set\(field, snapshot\.serialized\[field\]\)/,
  );
  assert.match(previewBuilder, /appendFrozenCreationPlatformPayload\(formData\)/);
  assert.match(generationBuilder, /const formData = buildCreationPlanPreviewFormData\(\)/);
  assert.match(generationBuilder, /formData\.set\("effectivePlan", JSON\.stringify\(effectivePlan\)\)/);
  assert.match(previewBuilder, /formData\.set\("planOverrides", JSON\.stringify\(getCreationPlanOverrides\(\)\)\)/);
});

test("applied reference analysis forwards product facts and audience strategy without adding a new panel", async () => {
  const app = await readApp();
  const previewBuilder = getFunctionSource(app, "buildCreationPlanPreviewFormData", "buildCreationFormData");

  assert.match(app, /async function buildCreationReferenceAnalysisFormData\(\)[\s\S]*formData\.set\("productName"/);
  assert.match(app, /async function buildCreationReferenceAnalysisFormData\(\)[\s\S]*formData\.set\("productDescription"/);
  assert.match(app, /async function buildCreationReferenceAnalysisFormData\(\)[\s\S]*formData\.set\("sellingPoints"/);
  assert.match(previewBuilder, /state\.creationReferenceAnalysis\.applied && !state\.creationReferenceAnalysis\.dirty/);
  assert.match(previewBuilder, /formData\.set\("audienceStrategy", JSON\.stringify\(audienceStrategy\)\)/);
});

test("a frozen plan does not promote derived legacy planning fields to overrides", async () => {
  const app = await readApp();
  const previewBuilder = getFunctionSource(app, "buildCreationPlanPreviewFormData", "buildCreationFormData");
  const generationBuilder = getFunctionSource(app, "buildCreationFormData", "buildCreationLogoBatchFormData");

  assert.match(previewBuilder, /const effectivePlan = getFrozenCreationEffectivePlan\(\)/);
  assert.match(previewBuilder, /if \(effectivePlan\) \{[\s\S]*formData\.delete\("imageCount"\)[\s\S]*formData\.delete\("selectedRoles"\)/);
  assert.doesNotMatch(previewBuilder, /effectivePlan\?\.carouselImageCount/);
  assert.doesNotMatch(previewBuilder, /effectivePlan\?\.items/);
  assert.match(generationBuilder, /const effectivePlan = getFrozenCreationEffectivePlan\(\)/);
  assert.match(generationBuilder, /if \(!effectivePlan\) \{/);
  assert.match(generationBuilder, /formData\.set\("ratio", refs\.creationRatioInput\.value/);
  assert.match(generationBuilder, /formData\.set\("size", refs\.creationSizeInput\.value/);
});

test("restore-current-platform clears only overrides and recomputes through the canonical resolver", async () => {
  const app = await readApp();
  const restoreAction = getFunctionSource(app, "restoreCurrentCreationPlatformRecommendations", "renderCreationPlatformPlan");

  assert.match(app, /creationPlanRestoreButton:\s*document\.querySelector\("#creationPlanRestoreButton"\)/);
  assert.match(restoreAction, /restoreCreationPlatformRecommendations/);
  assert.match(restoreAction, /platformSetOverrides:\s*\{\}/);
  assert.match(restoreAction, /platformItemOverrides:\s*\[\]/);
  assert.match(restoreAction, /hydrateCreationEffectivePlan\(restoredPlan\)/);
  assert.match(restoreAction, /await previewCreationPlan\(\)/);
  assert.doesNotMatch(
    restoreAction,
    /creationProductNameInput\.value\s*=|creationProductDescriptionInput\.value\s*=|creationReferenceFiles\s*=|creationStyleReferenceFiles\s*=|creationLogo\s*=|creationSkuBundleCountInput\.value\s*=|state\.config\s*=/,
  );
  assert.match(app, /refs\.creationPlanRestoreButton\?\.addEventListener\("click"/);
});

test("Creation plan preview coordination aborts stale work and accepts only the latest revision", async () => {
  const app = await readApp();

  const aborts = [];
  class FakeAbortController {
    constructor() {
      this.signal = {};
    }
    abort() {
      aborts.push(this.signal);
    }
  }
  const coordinator = creationBrowserPlanState.createCreationPlanPreviewRequestCoordinator(FakeAbortController);
  const first = coordinator.begin();
  const second = coordinator.begin();

  assert.equal(aborts.length, 1);
  assert.equal(aborts[0], first.signal);
  assert.equal(coordinator.isCurrent(first.revision), false);
  assert.equal(coordinator.finish(first.revision), false);
  assert.equal(coordinator.isCurrent(second.revision), true);
  assert.equal(coordinator.finish(second.revision), true);

  const previewSource = app.match(
    /async function previewCreationPlan\(\)[\s\S]*?(?=\r?\nasync function startCreationLogoBatchGeneration)/,
  )?.[0] || "";
  assert.match(previewSource, /creationPlanPreviewRequests\.begin\(\)/);
  assert.match(previewSource, /signal:\s*request\.signal/);
  assert.match(previewSource, /creationPlanPreviewRequests\.isCurrent\(request\.revision\)/);
  assert.doesNotMatch(previewSource, /state\.creation\.generating \|\| state\.creation\.planning/);
});
