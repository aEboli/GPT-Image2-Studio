import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as creationBrowserPlanState from "../lib/creation-browser-plan-state.mjs";
import { buildCreationPlan } from "../lib/creation-planner.mjs";

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

test("displayed plan context keeps queue provenance and legacy fallback read-only", () => {
  const frozenPlan = {
    strategyVersion: "form-v1",
    platformItemOverrides: [{ slotKey: "form-1", ratio: "1:1" }],
    items: [{ slotKey: "form-1", itemKind: "carousel" }],
  };
  const frozenBefore = structuredClone(frozenPlan);
  const normalizedLegacySet = {
    effectivePlan: {
      items: [{ slotKey: "legacy-1", imageType: "generic-hero", itemKind: "carousel" }],
    },
  };

  assert.deepEqual(
    creationBrowserPlanState.resolveCreationDisplayedPlanContext({ frozenPlan }),
    { plan: frozenPlan, readonly: false, source: "global-fallback" },
  );
  assert.deepEqual(
    creationBrowserPlanState.resolveCreationDisplayedPlanContext({
      displayedSet: { effectivePlan: {} },
      displayedQueueSet: { effectivePlan: {} },
      frozenPlan,
    }),
    { plan: frozenPlan, readonly: true, source: "global-fallback" },
  );
  assert.deepEqual(
    creationBrowserPlanState.resolveCreationDisplayedPlanContext({
      displayedSet: normalizedLegacySet,
      displayedQueueSet: {
        items: [{ slotKey: "legacy-1", imageType: "generic-hero", itemKind: "carousel" }],
      },
      frozenPlan,
    }),
    { plan: frozenPlan, readonly: true, source: "global-fallback" },
  );

  const rawQueuePlan = {
    strategyVersion: "queue-v1",
    items: [{ slotKey: "queue-1", imageType: "amazon-main", itemKind: "carousel" }],
  };
  const normalizedQueuePlan = { ...rawQueuePlan, platformLabel: "Amazon" };
  assert.deepEqual(
    creationBrowserPlanState.resolveCreationDisplayedPlanContext({
      displayedSet: { effectivePlan: normalizedQueuePlan },
      displayedQueueSet: { effectivePlan: rawQueuePlan },
      frozenPlan,
    }),
    { plan: normalizedQueuePlan, readonly: true, source: "queue-effective-plan" },
  );
  assert.deepEqual(
    creationBrowserPlanState.resolveCreationDisplayedPlanContext({
      displayedSet: { effectivePlan: normalizedQueuePlan },
      frozenPlan,
    }),
    { plan: normalizedQueuePlan, readonly: false, source: "displayed-set" },
  );
  assert.deepEqual(frozenPlan, frozenBefore);
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

test("compatible image types follow the enabled carousel slots in the frozen effective plan", async () => {
  const app = await readApp();
  const rolePicker = getFunctionSource(app, "renderCreationRolePicker", "buildCreationLogoBatchPreviewItems");
  const carouselSlots = Array.from({ length: 7 }, (_, index) => ({
    slotKey: `amazon-${index + 1}`,
    itemKind: "carousel",
    enabled: true,
  }));
  const appendedItems = [
    { slotKey: "sku-red", itemKind: "sku", enabled: true },
    { slotKey: "rebuild-1", itemKind: "infographic-rebuild", enabled: true },
  ];

  assert.deepEqual(
    creationBrowserPlanState.getCreationCompatibleImageTypeState({ items: [...carouselSlots, ...appendedItems] }),
    { slots: carouselSlots, enabledCount: 7, totalCount: 7 },
  );

  const slotsWithDisabledItem = carouselSlots.map((slot, index) => index === 3 ? { ...slot, enabled: false } : slot);
  const disabledState = creationBrowserPlanState.getCreationCompatibleImageTypeState({
    slots: slotsWithDisabledItem,
    items: [...carouselSlots.filter((_, index) => index !== 3), ...appendedItems],
  });
  assert.equal(disabledState.enabledCount, 6);
  assert.equal(disabledState.totalCount, 7);
  assert.equal(disabledState.slots[3].slotKey, "amazon-4");
  assert.equal(disabledState.slots[3].enabled, false);
  assert.equal(creationBrowserPlanState.getCreationCompatibleImageTypeState(null), null);

  assert.deepEqual(
    creationBrowserPlanState.updateCreationPlatformItemOverride(
      [{ slotKey: "amazon-2", ratio: "1:1" }],
      "amazon-4",
      "enabled",
      false,
    ),
    [
      { slotKey: "amazon-2", ratio: "1:1" },
      { slotKey: "amazon-4", enabled: false },
    ],
  );

  assert.match(rolePicker, /getCreationCompatibleImageTypeState\(displayedPlanContext\.plan\)/);
  assert.match(rolePicker, /compatibleImageTypes\.enabledCount} \/ \${compatibleImageTypes\.totalCount}/);
  assert.match(rolePicker, /input\.checked = slot\.enabled !== false/);
  assert.match(rolePicker, /input\.dataset\.creationPlanSlotKey = slot\.slotKey/);
  assert.match(rolePicker, /if \(compatibleImageTypes\) \{[\s\S]*return;[\s\S]*const selectedRoles = getCreationSelectedRoles\(\)/);
  assert.match(
    app,
    /refs\.creationRoleGrid\.addEventListener\("change"[\s\S]*target\.dataset\.creationPlanSlotKey[\s\S]*setCreationPlatformItemOverride\(target\.dataset\.creationPlanSlotKey, "enabled", target\.checked\)[\s\S]*previewCreationPlan\(\)/,
  );
});

test("Creation left-side planning follows the displayed queue snapshot with a legacy fallback", async () => {
  const app = await readApp();
  const displayedPlanGetter = getFunctionSource(app, "getCreationDisplayedPlanContext", "getCreationPlatformPlanDisplayCounts");
  const displayCountSource = getFunctionSource(app, "getCreationPlatformPlanDisplayCounts", "getCreationQueueJobs");
  const rolePicker = getFunctionSource(app, "renderCreationRolePicker", "buildCreationLogoBatchPreviewItems");
  const platformPlan = getFunctionSource(app, "renderCreationPlatformPlan", "renderCreationView");
  const getDisplayCounts = Function(`return (${displayCountSource})`)();
  const queuePlan = {
    carouselImageCount: 7,
    skuImageCount: 3,
    infographicRebuildCount: 5,
    totalPlannedItemCount: 15,
    items: Array.from({ length: 7 }, (_, index) => ({
      slotKey: `queue-carousel-${index + 1}`,
      itemKind: "carousel",
      enabled: true,
    })),
  };

  assert.match(displayedPlanGetter, /resolveCreationDisplayedPlanContext\(\{/);
  assert.match(displayedPlanGetter, /displayedSet: getCreationDisplayedSet\(\)/);
  assert.match(displayedPlanGetter, /displayedQueueSet: displayedQueueJob\?\.set \|\| null/);
  assert.match(displayedPlanGetter, /frozenPlan: getFrozenCreationEffectivePlan\(\)/);
  assert.deepEqual(getDisplayCounts(queuePlan), {
    carouselImageCount: 7,
    skuImageCount: 3,
    infographicRebuildCount: 5,
    totalPlannedItemCount: 15,
  });
  assert.deepEqual(
    creationBrowserPlanState.getCreationCompatibleImageTypeState(queuePlan),
    { slots: queuePlan.items, enabledCount: 7, totalCount: 7 },
  );
  assert.match(rolePicker, /getCreationCompatibleImageTypeState\(displayedPlanContext\.plan\)/);
  assert.match(rolePicker, /input\.disabled = isDisplayedQueueSnapshot/);
  assert.match(platformPlan, /const displayedPlanContext = getCreationDisplayedPlanContext\(\)/);
  assert.match(platformPlan, /const effectivePlan = displayedPlanContext\.plan/);
  assert.match(platformPlan, /createFrozenCreationPlatformPayload\(effectivePlan\)/);
  assert.match(platformPlan, /const counts = getCreationPlatformPlanDisplayCounts\(plan\)/);
  assert.match(platformPlan, /isDisplayedQueueSnapshot/);
  assert.match(platformPlan, /querySelectorAll\("button, input, select, textarea"\)/);
  assert.doesNotMatch(rolePicker, /getCreationCompatibleImageTypeState\(getFrozenCreationEffectivePlan\(\)\)/);
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

test("applying reference recommendations refreshes frozen coverage and evidence from applied roles", async () => {
  const app = await readApp();
  const refresh = getFunctionSource(app, "refreshCreationAppliedReferencePlanningSignals", "toggleCreationReferenceAnalysisPanel");
  const apply = getFunctionSource(app, "applyCreationReferenceAnalysisRecommendations", "renderCreationReferenceAnalysis");

  assert.match(refresh, /buildCreationReferencePlanningSignals/);
  assert.match(refresh, /buildCreationReferenceRolePayload\(\)/);
  assert.match(refresh, /platformSetOverrides:\s*frozenPayload\.values\.platformSetOverrides/);
  assert.match(refresh, /platformItemOverrides:\s*frozenPayload\.values\.platformItemOverrides/);
  assert.match(refresh, /categorySignals:\s*frozenPayload\.values\.categorySignals/);
  assert.match(refresh, /platformReferenceCoverage:\s*signals\.referenceCoverage/);
  assert.match(refresh, /platformEvidence:\s*signals\.evidence/);
  assert.match(apply, /state\.creationReferenceFiles = state\.creationReferenceFiles\.map[\s\S]*refreshCreationAppliedReferencePlanningSignals\(\)[\s\S]*syncCreationSelectedRolesToReferenceCoverage\(analysis\)/);
  assert.doesNotMatch(refresh, /state\.creationReferenceAnalysis\.result|analysis\.recommendations/);
});

test("a frozen plan does not promote derived legacy planning fields to overrides", async () => {
  const app = await readApp();
  const previewBuilder = getFunctionSource(app, "buildCreationPlanPreviewFormData", "buildCreationFormData");
  const generationBuilder = getFunctionSource(app, "buildCreationFormData", "buildCreationLogoBatchFormData");

  assert.match(previewBuilder, /const effectivePlan = getFrozenCreationEffectivePlan\(\)/);
  assert.match(previewBuilder, /resolveCreationSelectedRolesSubmission\(/);
  assert.deepEqual(creationBrowserPlanState.resolveCreationSelectedRolesSubmission({
    effectivePlan: { carouselImageCount: 7 },
    platformSetOverrides: {},
    selectedRoles: ["hero", "benefit"],
    roleSelectionManuallyEdited: false,
  }), { imageCount: null, selectedRoles: null });
  assert.doesNotMatch(previewBuilder, /effectivePlan\?\.carouselImageCount/);
  assert.doesNotMatch(previewBuilder, /effectivePlan\?\.items/);
  assert.match(generationBuilder, /const effectivePlan = getFrozenCreationEffectivePlan\(\)/);
  assert.match(generationBuilder, /if \(!effectivePlan\) \{/);
  assert.match(generationBuilder, /formData\.set\("ratio", refs\.creationRatioInput\.value/);
  assert.match(generationBuilder, /formData\.set\("size", refs\.creationSizeInput\.value/);
});

test("automatic count stays derived while an explicit count survives frozen-plan previews", async () => {
  const app = await readApp();
  const countSync = getFunctionSource(app, "syncCreationSelectedRolesToCount", "syncCreationSelectedRolesToCurrentCount");
  const previewBuilder = getFunctionSource(app, "buildCreationPlanPreviewFormData", "buildCreationFormData");
  const hydrate = getFunctionSource(app, "hydrateCreationEffectivePlan", "restoreCreationEffectivePlanFromSet");

  assert.match(countSync, /platformSetOverrides:[\s\S]*imageCount/);
  assert.match(countSync, /selectedRoles/);
  assert.match(hydrate, /setCreationImageCountValue\(normalized\.carouselImageCount/);
  assert.match(previewBuilder, /roleSubmission\.imageCount === null/);
  assert.match(previewBuilder, /roleSubmission\.selectedRoles === null/);
  assert.deepEqual(creationBrowserPlanState.resolveCreationSelectedRolesSubmission({
    effectivePlan: null,
    platformSetOverrides: {},
    selectedRoles: ["hero", "benefit"],
    roleSelectionManuallyEdited: false,
  }), { imageCount: null, selectedRoles: [] });
});

test("explicit 18-image submission keeps aligned roles before the first effective plan exists", () => {
  const selectedRoles = [
    "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
    "accessory-gift", "series-showcase", "craft-process", "effect-comparison",
    "spec-table", "atmosphere", "brand-story", "ingredient-material", "after-sales",
    "usage-suggestion", "human-handheld", "human-wearable",
  ];
  const submission = creationBrowserPlanState.resolveCreationSelectedRolesSubmission({
    effectivePlan: null,
    platformSetOverrides: { imageCount: 18 },
    selectedRoles,
    roleSelectionManuallyEdited: false,
  });

  assert.deepEqual(submission, {
    imageCount: 18,
    selectedRoles,
  });

  const plan = buildCreationPlan({
    productName: "Fishing Lure",
    productDescription: "Product shown in supplied references",
    platform: "universal",
    imageCount: submission.imageCount,
    selectedRoles: submission.selectedRoles,
    platformSetOverrides: { imageCount: submission.imageCount },
    infographicRebuildEnabled: false,
  });
  assert.deepEqual(
    plan.items.filter((item) => item.itemKind === "carousel" && item.imageType === "custom").map((item) => item.role),
    ["ingredient-material", "after-sales", "usage-suggestion", "human-handheld", "human-wearable"],
  );
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
    /creationProductNameInput\.value\s*=|creationProductDescriptionInput\.value\s*=|creationReferenceFiles\s*=|creationLogo\s*=|creationSkuBundleCountInput\.value\s*=|state\.config\s*=/,
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
