import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { deepFreezeCreationPlanValue, resolveCreationSelectedRolesSubmission } from "../lib/creation-browser-plan-state.mjs";
import { buildCreationQueuedSet } from "../lib/creation-suite-queue.mjs";

async function createCountHarness({ selectedCount = 20, aiMarketing = true } = {}) {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const source = (name) => {
    const match = app.match(new RegExp(`function ${name}\\([^]*?\\r?\\n\\}`));
    assert.ok(match, `${name} must exist`);
    return match[0];
  };
  let frozenPayload = { values: { platformSetOverrides: { imageCount: selectedCount } } };
  const scope = {
    FormData, JSON, structuredClone,
    state: { creation: {}, creationReferenceAnalysis: {}, creationReferenceFiles: [], clientSessionId: "count-test" },
    refs: Object.fromEntries(Object.entries({
      creationImageCountInput: String(selectedCount), creationProductNameInput: "手套",
      creationProductDescriptionInput: "", creationIndustryTemplateInput: "general",
      creationOutputFormatInput: "png", creationRatioInput: "1:1", creationSizeInput: "1024x1024",
    }).map(([key, value]) => [key, { value }])),
    normalizeCreationEffectivePlanForBrowser: (plan) => structuredClone(plan),
    deepFreezeCreationPlanValue, resolveCreationSelectedRolesSubmission,
    setFrozenCreationPlatformPayload(plan) { frozenPayload = { values: { platformSetOverrides: plan.platformSetOverrides || {} } }; },
    getFrozenCreationPlatformPayload: () => frozenPayload,
    setCreationImageCountValue(count) { scope.refs.creationImageCountInput.value = String(count); },
    syncCreationControlsFromEffectivePlan() {}, syncCreationSkuGenerationControl() {},
    getFrozenCreationEffectivePlan: () => scope.state.creation.effectivePlan,
    getCreationSelectedLanguage: () => ({ value: "zh-CN" }),
    getCreationSelectedRoles: () => [],
    getCreationPlanPreviewImageCount: () => Number(scope.refs.creationImageCountInput.value),
    getCreationSelectedDimensionUnitMode: () => "original",
    isCreationInfographicRebuildRequired: () => false,
    getSelectedReasoningEffort: () => "high",
    getCreationSelectedPlatform: () => ({ value: "universal" }),
    resolveCreationReferenceAnalysisContextCategoryValue: () => "general",
    buildCreationReferenceRolePayload: () => [], buildCreationSkuSubjectPayload: () => [],
    getCreationSelectedSkuGenerationRule: () => ({ value: "single" }),
    appendFrozenCreationPlatformPayload(data) { data.set("platformSetOverrides", JSON.stringify(frozenPayload.values.platformSetOverrides)); },
    isCreationAiMarketingEnabled: () => aiMarketing,
    normalizeOutputFormat: (value) => value,
    getSelectedImageQuality: () => "auto",
    appendCurrentConfigToFormData() {},
  };
  vm.createContext(scope);
  vm.runInContext(["hydrateCreationEffectivePlan", "buildCreationPlanPreviewFormData", "buildCreationFormData"].map(source).join("\n"), scope);
  return { scope, app };
}

test("partial Creation previews preserve the requested count and generate only frozen valid tasks", async () => {
  const { scope, app } = await createCountHarness();
  const plan = {
    promptPlanningMode: "ai-batch", imageCount: 15, carouselImageCount: 15,
    platformSetOverrides: { imageCount: 15 },
    marketingPlan: { validation: { requestedCount: 20, acceptedCount: 15, missingCount: 5 } },
    items: Array.from({ length: 15 }, (_, index) => ({ itemId: `ai-${index + 1}`, itemKind: "carousel" })),
  };
  const previewSource = app.match(/async function previewCreationPlan\([^]*?\r?\n\}/)?.[0];
  const hydrationCall = previewSource?.match(/hydrateCreationEffectivePlan\(plan[^;]*\)/)?.[0];
  assert.ok(hydrationCall);
  scope.plan = plan;
  vm.runInContext(hydrationCall, scope);
  assert.equal(scope.refs.creationImageCountInput.value, "20");
  assert.equal(scope.state.creation.effectivePlan.items.length, 15);
  assert.equal(scope.state.creation.planDirty, false);
  assert.equal(scope.buildCreationPlanPreviewFormData().get("imageCount"), "20", "replanning still requests the user's selected count");
  const data = scope.buildCreationFormData();
  assert.equal(data.get("imageCount"), "15", "generation uses the existing effective-count fingerprint");
  assert.equal(JSON.parse(data.get("effectivePlan")).items.length, 15);
  const queued = buildCreationQueuedSet({
    getFrozenCreationEffectivePlan: scope.getFrozenCreationEffectivePlan,
    getCreationSelectedDimensionUnitMode: scope.getCreationSelectedDimensionUnitMode,
    getCreationSelectedLanguage: scope.getCreationSelectedLanguage,
    getCreationSelectedPlatform: scope.getCreationSelectedPlatform,
    getCreationSelectedScenario: () => ({ value: "standard" }),
    getCreationSelectedIndustryTemplate: () => ({ value: "general" }),
    getCreationSelectedRoles: scope.getCreationSelectedRoles,
    getCreationSelectedSkuGenerationRule: scope.getCreationSelectedSkuGenerationRule,
    buildCreationReferenceRolePayload: scope.buildCreationReferenceRolePayload,
    buildCreationSkuSubjectPayload: scope.buildCreationSkuSubjectPayload,
    normalizeCreationSkuBundleCountForPayload: Number,
    formatCreationDimensionUnitModeLabel: (value) => value,
    normalizeSet: (value) => value,
    refs: scope.refs,
  });
  assert.equal(queued.imageCount, 15);
  assert.equal(queued.items.length, 15);
  assert.equal(queued.effectivePlan.items.length, 15);
  assert.equal(scope.refs.creationImageCountInput.value, "20", "queue submission preserves the selection");
});

test("explicit record hydration still restores saved counts including zero", async () => {
  for (const count of [0, 15, 20]) {
    const { scope } = await createCountHarness();
    scope.hydrateCreationEffectivePlan({ imageCount: count, carouselImageCount: count, items: [] });
    assert.equal(scope.refs.creationImageCountInput.value, String(count));
  }
});
