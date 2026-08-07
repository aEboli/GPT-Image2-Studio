import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as creationBrowserPlanState from "../lib/creation-browser-plan-state.mjs";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import { CREATION_PLATFORM_PROFILES } from "../lib/creation-platform-policies.mjs";

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

test("editable plan context ignores queue snapshots and exposes a pending draft", () => {
  const frozenPlan = {
    strategyVersion: "form-v1",
    platformItemOverrides: [{ slotKey: "form-1", ratio: "1:1" }],
    items: [{ slotKey: "form-1", itemKind: "carousel" }],
  };
  const frozenBefore = structuredClone(frozenPlan);
  assert.deepEqual(
    creationBrowserPlanState.resolveCreationDisplayedPlanContext({
      displayedQueueSet: { effectivePlan: { strategyVersion: "queue-v1", carouselImageCount: 18 } },
      frozenPlan,
    }),
    { plan: frozenPlan, readonly: false, pending: false, source: "form-effective-plan" },
  );
  assert.deepEqual(
    creationBrowserPlanState.resolveCreationDisplayedPlanContext({
      displayedQueueSet: { effectivePlan: { strategyVersion: "queue-v1", carouselImageCount: 18 } },
      frozenPlan: null,
    }),
    { plan: null, readonly: false, pending: true, source: "form-pending" },
  );
  assert.deepEqual(frozenPlan, frozenBefore);
});

test("Creation record normalization preserves zero carousel mode and reconciles counts", async () => {
  const app = await readApp();
  const normalizer = getFunctionSource(app, "normalizeCreationSetForView", "isCreationMissingAssetItem");

  assert.match(normalizer, /resolveCreationPlanCounts\(/);
  assert.match(normalizer, /normalizeCreationModuleEnabled\(skuGenerationEnabledValue, true\)/);
  assert.match(normalizer, /normalizeCreationModuleEnabled\(infographicRebuildEnabledValue, hasInfographicRebuildItems\)/);
  assert.match(normalizer, /index:\s*Number\(item\?\.index\) > 0 \? Number\(item\.index\) : index \+ 1/);
  assert.doesNotMatch(normalizer, /imageCount:\s*\(setImageCount \?\? items\.length\) \|\| 10/);
});

test("Creation record repair stays isolated from the editable draft and its files", async () => {
  const app = await readApp();
  const recordRepair = getFunctionSource(app, "repairCreationRecordIncompleteImages", "renderCreationRecordView");
  const formBuilder = app.match(
    /function buildCreationRepairFormData\([^]*?(?=\r?\nasync function handleCreationStreamEvent)/,
  )?.[0] || "";

  assert.doesNotMatch(recordRepair, /applyCreationSetToForm\(selectedSet\)/);
  assert.match(formBuilder, /applyCreationRepairTargetFormFields\(formData, currentSet\)/);
  assert.doesNotMatch(formBuilder, /buildCreationPlanPreviewFormData\(\)\.entries\(\)/);
  assert.match(formBuilder, /shouldUseCreationRepairDraftFiles/);
});

test("editable form count stays one-to-one with carousel count while additions remain separate", () => {
  assert.deepEqual(
    creationBrowserPlanState.getCreationEditablePlanDisplayCounts(null, 4),
    {
      carouselImageCount: 4,
      skuImageCount: null,
      infographicRebuildCount: null,
      totalPlannedItemCount: null,
    },
  );
  assert.deepEqual(
    creationBrowserPlanState.getCreationEditablePlanDisplayCounts({
      imageCount: 4,
      carouselImageCount: 4,
      skuImageCount: 6,
      infographicRebuildCount: 2,
      totalPlannedItemCount: 12,
    }, 18),
    {
      carouselImageCount: 4,
      skuImageCount: 6,
      infographicRebuildCount: 2,
      totalPlannedItemCount: 12,
    },
  );
});

test("Creation generation follows validation without blocking a pending plan refresh", () => {
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
  assert.equal(
    creationBrowserPlanState.shouldDisableCreationGenerateButton({
      effectivePlan: null,
      planPending: true,
    }),
    false,
  );
});

test("routine plan adjustments stay hidden while actionable warnings are deduplicated", () => {
  const warnings = creationBrowserPlanState.getVisibleCreationPlanWarnings([
    { code: "missing-evidence-slot-omitted", slotKey: "zero" },
    { code: "missing-evidence-slot-replaced", slotKey: "one" },
    { code: "image-count-extension-custom", slotKey: "two" },
    { code: "unknown-platform" },
    { code: "unknown-platform" },
    { code: "image-count-extension-limited", message: "Only four safe slots are available." },
  ]);

  assert.deepEqual(warnings, [
    { code: "unknown-platform" },
    { code: "image-count-extension-limited", message: "Only four safe slots are available." },
  ]);
});

test("direct generation refreshes a dirty plan before freezing the queued request", async () => {
  const app = await readApp();
  const startGeneration = getFunctionSource(app, "startCreationGeneration", "normalizePortraitItemForView");

  assert.match(startGeneration, /await waitForPendingCreationPlanPreview\(\)/);
  assert.match(startGeneration, /state\.creation\.planDirty[\s\S]*await requestCreationPlanPreview\(\)/);
  assert.match(startGeneration, /getFrozenCreationEffectivePlan\(\)[\s\S]*canGenerate === false[\s\S]*return/);
  assert.match(startGeneration, /await ensureCreationReferenceGenerationFilesReady\(\)/);
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

  const universalCatalogSlots = Array.from({ length: 18 }, (_, index) => ({
    slotKey: `universal-${index + 1}`,
    itemKind: "carousel",
    enabled: index < 5,
  }));
  assert.deepEqual(
    creationBrowserPlanState.getCreationCompatibleImageTypeState({ slots: universalCatalogSlots }),
    { slots: universalCatalogSlots, enabledCount: 5, totalCount: 18 },
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
    /refs\.creationRoleGrid\.addEventListener\("change"[\s\S]*target\.dataset\.creationPlanSlotKey[\s\S]*setCreationPlatformItemOverride\(target\.dataset\.creationPlanSlotKey, "enabled", target\.checked\)[\s\S]*requestCreationPlanPreview\(\)/,
  );
});

test("Creation left-side planning follows only the editable form plan", async () => {
  const app = await readApp();
  const displayedPlanGetter = getFunctionSource(app, "getCreationDisplayedPlanContext", "getCreationPlatformPlanDisplayCounts");
  const displayCountSource = getFunctionSource(app, "getCreationPlatformPlanDisplayCounts", "getCreationQueueJobs");
  const rolePicker = getFunctionSource(app, "renderCreationRolePicker", "buildCreationLogoBatchPreviewItems");
  const platformPlan = getFunctionSource(app, "renderCreationPlatformPlan", "renderCreationView");
  const getDisplayCounts = Function("getCreationEditablePlanDisplayCounts", `return (${displayCountSource})`)(
    creationBrowserPlanState.getCreationEditablePlanDisplayCounts,
  );
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
  assert.doesNotMatch(displayedPlanGetter, /getCreationDisplayedSet|getSelectedCreationQueueJob|displayedQueueSet/);
  assert.match(displayedPlanGetter, /frozenPlan: getFrozenCreationEffectivePlan\(\)/);
  assert.match(displayedPlanGetter, /selectedCarouselCount: getCreationSelectedImageCount\(\)/);
  assert.deepEqual(getDisplayCounts(queuePlan, 4), {
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
  assert.doesNotMatch(rolePicker, /isDisplayedQueueSnapshot/);
  assert.match(platformPlan, /const displayedPlanContext = getCreationDisplayedPlanContext\(\)/);
  assert.match(platformPlan, /const effectivePlan = displayedPlanContext\.plan/);
  assert.match(platformPlan, /createFrozenCreationPlatformPayload\(effectivePlan\)/);
  assert.match(platformPlan, /const counts = getCreationPlatformPlanDisplayCounts\(plan\)/);
  assert.match(platformPlan, /const isPlanPending = displayedPlanContext\.pending/);
  assert.match(platformPlan, /"待刷新"/);
  assert.doesNotMatch(platformPlan, /creationPlanAdvancedToggle|creationPlanSlots|querySelectorAll\("button, input, select, textarea"\)/);
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
  const effectivePlanNormalizer = getFunctionSource(app, "normalizeCreationEffectivePlanForBrowser", "hydrateCreationEffectivePlan");

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
    "sourceInfographic",
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
    "temuExcelExportState",
    "effectivePlan",
  ]) {
    assert.match(setNormalizer, new RegExp(`\\b${field}:`), `missing set field ${field}`);
  }
  assert.match(effectivePlanNormalizer, /resolveCreationPlanCounts\(\{ \.\.\.source, items \}\)/);
  assert.match(effectivePlanNormalizer, /carouselImageCount:\s*planCounts\.carouselImageCount/);
});

test("preview and record reuse hydrate one recursively frozen effective plan", async () => {
  const app = await readApp();
  const frozen = creationBrowserPlanState.deepFreezeCreationPlanValue({ nested: { value: 1 } });

  assert.match(app, /effectivePlan:\s*null/);
  assert.match(app, /draftSet:\s*null/);
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
  assert.match(app, /state\.creation\.draftSet = nextDraftSet/);
  assert.match(app, /if \(!state\.creation\.generating\) \{\s*state\.creation\.currentSet = nextDraftSet;/);
  assert.doesNotMatch(
    getFunctionSource(app, "previewCreationPlan", "startCreationLogoBatchGeneration"),
    /if \(state\.creation\.generating\) \{\s*return;/,
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
  assert.doesNotMatch(previewBuilder, /planOverrides|getCreationPlanOverrides/);
});

test("pending platform planning never renders the universal legacy role fallback", async () => {
  const app = await readApp();
  const rolePicker = getFunctionSource(app, "renderCreationRolePicker", "buildCreationLogoBatchPreviewItems");

  assert.match(
    rolePicker,
    /if \(displayedPlanContext\.pending\) \{[\s\S]*creationRoleCount[\s\S]*待刷新[\s\S]*creationRoleGrid[\s\S]*return;/,
  );
  assert.match(rolePicker, /if \(compatibleImageTypes\)[\s\S]*return;[\s\S]*if \(displayedPlanContext\.pending\)/);
});

test("SKU generation toggle refreshes the current platform plan without clearing it", async () => {
  const app = await readApp();
  const handler = getFunctionSource(
    app,
    "refreshCreationPlanAfterSkuGenerationToggle",
    "renderCreationPlatformPlan",
  );

  assert.match(handler, /state\.creation\.planDirty = true/);
  assert.match(handler, /requestCreationPlanPreview\(\)/);
  assert.doesNotMatch(handler, /resetCreationDraftPreview\(\)/);
  assert.match(
    app,
    /creationSkuGenerationEnabledInput\?\.addEventListener\("change", refreshCreationPlanAfterSkuGenerationToggle\)/,
  );
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

test("explicit Creation parameters override Xiaohongshu defaults before preview and generation", async () => {
  const app = await readApp();
  const overrides = creationBrowserPlanState.mergeCreationPlatformSetParameters({}, {
    targetLanguage: "en",
    ratio: "4:3",
    resolutionTier: "2048x1536",
  });

  assert.deepEqual(overrides, {
    targetLanguage: "en",
    ratio: "4:3",
    resolutionTier: "2048x1536",
  });

  const plan = buildCreationPlan({
    productName: "Travel Mug",
    productDescription: "Product shown in supplied references",
    platform: "xiaohongshu",
    platformSetOverrides: overrides,
    infographicRebuildEnabled: false,
  });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");
  assert.equal(carouselItems.length, 6);
  assert.ok(carouselItems.every((item) => item.targetLanguage === "en"));
  assert.ok(carouselItems.every((item) => item.ratio === "4:3"));
  assert.ok(carouselItems.every((item) => item.resolutionTier === "2048x1536"));
  assert.deepEqual(plan.platformSetOverrides, overrides);

  assert.match(app, /function syncCreationExplicitSetParameters\(/);
  assert.match(app, /creationTargetLanguageInput[\s\S]*syncCreationExplicitSetParameters/);
  assert.match(app, /creationRatioInput[\s\S]*syncCreationExplicitSetParameters/);
  assert.match(app, /creationSizeInput[\s\S]*syncCreationExplicitSetParameters/);
});

test("all platform image-count options stop at the canonical profile slot count", () => {
  const baseOptions = [0, 4, 6, 7, 8, 9, 10, 12, 14, 16, 18];
  assert.equal(CREATION_PLATFORM_PROFILES.length, 19);

  for (const profile of CREATION_PLATFORM_PROFILES) {
    const state = creationBrowserPlanState.resolveCreationPlatformImageCountState({
      baseOptions,
      currentValue: 18,
      profile,
    });
    assert.equal(state.maxImageCount, profile.slots.length, profile.id);
    assert.equal(Math.max(...state.options), profile.slots.length, profile.id);
    assert.equal(state.value, profile.recommendedImageCount, profile.id);
    assert.equal(state.clamped, profile.id !== "universal", profile.id);
  }
});

test("platform switching adopts the next profile recommendation instead of retaining an old valid count", async () => {
  const app = await readApp();
  const switchAction = getFunctionSource(app, "handleCreationPlatformChange", "invalidateCreationReferenceAnalysisRequest");

  assert.match(app, /value: "universal"[\s\S]*recommendedImageCount: 18/);
  assert.match(switchAction, /const nextProfile = getCreationPlatformImageCountProfile\(nextPlatform\);/);
  assert.match(switchAction, /syncCreationPlatformImageCountOptions\(\{ preferredValue: nextProfile\.recommendedImageCount \}\);/);
});

test("the universal profile keeps its native 18-image plan without custom extension slots", () => {
  const selectedRoles = [
    "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
    "accessory-gift", "series-showcase", "craft-process", "effect-comparison",
    "spec-table", "atmosphere", "brand-story", "ingredient-material", "after-sales",
    "usage-suggestion", "human-handheld", "human-wearable",
  ];
  const plan = buildCreationPlan({
    productName: "Fishing Lure",
    productDescription: "Product shown in supplied references",
    platform: "universal",
    imageCount: 18,
    selectedRoles,
    platformSetOverrides: { imageCount: 18 },
    infographicRebuildEnabled: false,
  });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");
  assert.equal(plan.imageCount, 18);
  assert.equal(carouselItems.length, 18);
  assert.equal(plan.platformSetOverrides.imageCount, 18);
  assert.deepEqual(carouselItems.map((item) => item.role), selectedRoles);
  assert.equal(carouselItems.some((item) => item.imageType === "custom"), false);
});

test("restore-current-platform clears only overrides and recomputes through the canonical resolver", async () => {
  const app = await readApp();
  const restoreAction = getFunctionSource(app, "restoreCurrentCreationPlatformRecommendations", "renderCreationPlatformPlan");

  assert.match(app, /creationPlanRestoreButton:\s*document\.querySelector\("#creationPlanRestoreButton"\)/);
  assert.match(restoreAction, /restoreCreationPlatformRecommendations/);
  assert.match(restoreAction, /platformSetOverrides:\s*\{\}/);
  assert.match(restoreAction, /platformItemOverrides:\s*\[\]/);
  assert.match(restoreAction, /hydrateCreationEffectivePlan\(restoredPlan\)/);
  assert.match(restoreAction, /await requestCreationPlanPreview\(\)/);
  assert.doesNotMatch(
    restoreAction,
    /creationProductNameInput\.value\s*=|creationProductDescriptionInput\.value\s*=|creationReferenceFiles\s*=|creationLogo\s*=|creationSkuBundleCountInput\.value\s*=|state\.config\s*=/,
  );
  assert.match(app, /refs\.creationPlanRestoreButton\?\.addEventListener\("click"/);
});

test("restore-current-platform keeps disabled appended SKU counts at zero", async () => {
  const app = await readApp();
  const restoreAction = getFunctionSource(app, "restoreCurrentCreationPlatformRecommendations", "requestCreationPlanPreview");

  assert.match(
    restoreAction,
    /skuSubjects:\s*currentPlan\.skuGenerationEnabled === false\s*\? \[\]\s*:\s*currentPlan\.skuSubjects \|\| buildCreationSkuSubjectPayload\(\)/,
  );
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
  const invalidatedRevision = coordinator.invalidate();
  assert.equal(aborts.length, 2);
  assert.equal(aborts[1], second.signal);
  assert.equal(invalidatedRevision > second.revision, true);
  assert.equal(coordinator.isCurrent(second.revision), false);
  assert.equal(coordinator.finish(second.revision), false);

  let finishLatestPreview;
  const latestPreview = new Promise((resolve) => { finishLatestPreview = resolve; });
  coordinator.track(Promise.resolve("stale"));
  coordinator.track(latestPreview);
  let waitFinished = false;
  const wait = coordinator.waitForPending().then(() => { waitFinished = true; });
  await Promise.resolve();
  assert.equal(waitFinished, false);
  finishLatestPreview("latest");
  await wait;
  assert.equal(waitFinished, true);

  const resetSource = getFunctionSource(app, "resetCreationDraftPreview", "getCreationStatusLabel");
  assert.match(resetSource, /creationPlanPreviewRequests\.invalidate\(\)/);
  assert.match(resetSource, /state\.creation\.planning = false/);

  const previewSource = app.match(
    /async function previewCreationPlan\(\)[\s\S]*?(?=\r?\nasync function startCreationLogoBatchGeneration)/,
  )?.[0] || "";
  assert.match(previewSource, /creationPlanPreviewRequests\.begin\(\)/);
  assert.match(previewSource, /signal:\s*request\.signal/);
  assert.match(previewSource, /creationPlanPreviewRequests\.isCurrent\(request\.revision\)/);
  assert.doesNotMatch(previewSource, /state\.creation\.generating \|\| state\.creation\.planning/);
  assert.doesNotMatch(previewSource, /if \(state\.creation\.generating\)/);
});
