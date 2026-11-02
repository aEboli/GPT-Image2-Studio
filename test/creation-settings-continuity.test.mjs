import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { buildCreationSkuSubjectsForPayload } from "../lib/creation-sku-subjects.mjs";
import { createCreationMarketingBatchState, normalizeCreationMarketingBatchSchemeCount, normalizeCreationMarketingBatchCopies } from "../lib/creation-marketing-batch.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function source(name) {
  const value = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`))?.[0];
  assert.ok(value, name);
  return value;
}

function harness({ applied = true, dirty = false, running = false } = {}) {
  const calls = { refresh: 0, invalidated: 0, errors: [], requests: [], jobs: [] };
  const analysis = {
    productName: "加热手套",
    recommendations: [{ filename: "gloves.png", role: "product" }],
    productInsights: { confirmedFacts: [{ id: "gloves", text: "黑色手套", source: "reference", referenceIndexes: [1] }] },
    audienceStrategy: { primaryAudience: "日常通勤人群" },
    skuSubjects: [{ id: "black", title: "黑色款", filenames: ["gloves.png"], referenceIndexes: [1], colorNames: ["black"] }],
  };
  const scope = {
    FormData, AbortController, structuredClone,
    state: {
      clientSessionId: "continuity-test",
      creationReferenceFiles: [{ id: "gloves", file: new File(["gloves"], "gloves.png", { type: "image/png" }), role: "product" }],
      creationReferenceAnalysis: { result: analysis, applied, dirty, running },
      creation: { planning: false, generating: false, planDirty: false, marketingBatchEnabled: true, effectivePlan: { old: true }, draftSet: { setId: "creation-draft-old" } },
    },
    refs: {
      creationProductNameInput: { value: "加热手套" }, creationProductDescriptionInput: { value: "用户补充说明" },
      creationIndustryTemplateInput: { value: "general" }, creationReasoningEffortInput: { value: "high" },
      creationSkuGenerationEnabledInput: { checked: true }, creationOutputFormatInput: { value: "png" }, creationQualityInput: { value: "high" },
      creationMarketingBatchCountInput: { value: "1" }, creationMarketingBatchCopiesInput: { value: "1" },
    },
    CREATION_REFERENCE_ROLE_OPTIONS: ["product", "reference-product", "feature"].map((value) => ({ value })),
    creationReferenceAnalysisRequestToken: 1,
    creationReferenceAnalysisAbortController: new AbortController(),
    creationPlanPreviewRequests: { invalidate() { calls.invalidated += 1; } },
    creationMarketingBatchStarting: false, creationMarketingBatchSourceFormData: null, creationMarketingBatchRequestController: null,
    syncCreationReferenceGenerationCompressionProfiles() {},
    refreshCreationAppliedReferencePlanningSignals() { calls.refresh += 1; },
    setCreationReferenceAnalysisFeedback(message) { calls.feedback = message; },
    renderCreationReferenceGrid() {}, renderCreationView() {},
    isCreationDraftSet: (set) => /^(creation-local-|creation-draft-)/.test(set?.setId || ""),
    syncCreationSkuGenerationControl() {},
    getFrozenCreationEffectivePlan: () => scope.state.creation.effectivePlan,
    getFrozenCreationPlatformPayload: () => ({ values: { platformSetOverrides: {} } }),
    getCreationSelectedLanguage: () => ({ value: "en" }), getCreationSelectedRoles: () => ["hero"],
    getCreationSelectedDimensionUnitMode: () => "both", getCreationPlanPreviewImageCount: () => 18,
    isCreationInfographicRebuildRequired: () => false,
    getSelectedReasoningEffort: (input) => input.value,
    getCreationSelectedPlatform: () => ({ value: "universal" }),
    resolveCreationReferenceAnalysisContextCategoryValue: () => "general",
    buildCreationReferenceRolePayload: () => scope.state.creationReferenceFiles.map((item, index) => ({ index: index + 1, filename: item.file.name, role: item.role, roleManuallyEdited: item.roleManuallyEdited })),
    buildCreationSkuSubjectPayload: () => buildCreationSkuSubjectsForPayload({ analysis: scope.state.creationReferenceAnalysis.result, applied: scope.state.creationReferenceAnalysis.applied, dirty: scope.state.creationReferenceAnalysis.dirty, referenceRoles: scope.buildCreationReferenceRolePayload() }),
    getCreationSelectedSkuGenerationRule: () => ({ value: "color" }), appendFrozenCreationPlatformPayload() {},
    resolveCreationSelectedRolesSubmission: () => ({ imageCount: 18, selectedRoles: ["hero"] }),
    isCreationAiMarketingEnabled: () => true,
    ensureCreationReferenceGenerationFilesReady: async () => {}, getCreationReferenceGenerationFile: (item) => item.file,
    appendCurrentConfigToFormData() {}, normalizeOutputFormat: (value) => value, getSelectedImageQuality: (input) => input.value,
    normalizeCreationMarketingBatchSchemeCount, normalizeCreationMarketingBatchCopies, createCreationMarketingBatchState,
    waitForPendingCreationPlanPreview: async () => {},
    async runCreationMarketingBatch({ state, generatePlan, enqueuePlan }) {
      const scheme = state.schemes[0];
      const planResult = await generatePlan({ scheme });
      await enqueuePlan({ planResult, scheme, copyIndex: 0, copyNumber: 1, state });
      state.status = "completed";
    },
    async requestCreationMarketingBatchPlan(formData) {
      calls.requests.push(formData);
      return { plan: { imageCount: 18, items: [{ itemId: "hero" }] }, marketingProgress: { stage: "complete" } };
    },
    buildCreationQueuedSet: ({ effectivePlanOverride }) => ({ ...effectivePlanOverride }), nowIso: () => "2026-11-02T00:00:00Z",
    enqueueCreationGeneration(job) { calls.jobs.push(job); return job; }, setCreationFeedback() {},
    compactErrorMessage: (message) => message, showError(message) { calls.errors.push(message); },
  };
  vm.createContext(scope);
  for (const name of ["invalidateCreationReferenceAnalysisRequest", "markCreationReferenceAnalysisDirty", "resetCreationDraftPreview", "updateCreationReferenceRole", "buildCreationPlanPreviewFormData", "buildCreationMarketingBatchRequestFormData", "cloneCreationMarketingBatchFormData", "runCreationMarketingBatchGeneration"]) {
    vm.runInContext(source(name), scope);
  }
  return { scope, calls, analysis };
}

test("识别后更正参考主体，批量规划直接使用原事实、SKU 和最新用途", async () => {
  const { scope, calls, analysis } = harness();
  scope.updateCreationReferenceRole("gloves", "reference-product");
  assert.equal(scope.state.creationReferenceAnalysis.result, analysis);
  assert.equal(scope.state.creationReferenceAnalysis.applied, true);
  assert.equal(scope.state.creationReferenceAnalysis.dirty, false);
  assert.equal(scope.state.creation.planDirty, true);
  assert.equal(calls.refresh, 1);
  Object.assign(scope.refs, {
    creationMarketingBatchPanel: {}, creationMarketingBatchConfig: {}, creationMarketingBatchStartButton: {},
  });
  Object.assign(scope, {
    isCreationMarketingBatchRunning: () => false,
    renderCreationMarketingBatchTiming() {},
  });
  vm.runInContext(source("renderCreationMarketingBatchConfig"), scope);
  scope.renderCreationMarketingBatchConfig();
  assert.equal(scope.refs.creationMarketingBatchStartButton.disabled, false);
  scope.refs.creationReasoningEffortInput.value = "low";
  await scope.runCreationMarketingBatchGeneration();
  assert.deepEqual(calls.errors, []);
  assert.equal(calls.jobs.length, 1);
  const body = calls.requests[0];
  assert.equal(body.get("analysisValidated"), "true");
  assert.equal(body.get("reasoningEffort"), "low");
  assert.deepEqual(JSON.parse(body.get("productInsights")), analysis.productInsights);
  assert.deepEqual(JSON.parse(body.get("audienceStrategy")), analysis.audienceStrategy);
  assert.equal(JSON.parse(body.get("referenceImageRoles"))[0].role, "reference-product");
  assert.equal(JSON.parse(body.get("skuSubjects"))[0].id, "black");
  assert.equal(body.getAll("referenceImages").length, 1);
});

test("更改用途不取消同一批图片的识别，迟到建议仍尊重手动用途", () => {
  const { scope } = harness({ applied: false, running: true });
  const signal = scope.creationReferenceAnalysisAbortController.signal;
  const token = scope.creationReferenceAnalysisRequestToken;
  scope.updateCreationReferenceRole("gloves", "reference-product");
  assert.equal(signal.aborted, false);
  assert.equal(scope.creationReferenceAnalysisRequestToken, token);
  assert.equal(scope.state.creationReferenceAnalysis.running, true);
  assert.equal(scope.state.creationReferenceFiles[0].roleManuallyEdited, true);
  scope.state.creationReferenceAnalysis.dirty = false;
  scope.state.creationReferenceAnalysis.result.recommendations[0].role = "feature";
  Object.assign(scope, {
    applyCreationReferenceAnalysisProductNameSuggestion() {},
    syncCreationSelectedRolesToReferenceCoverage() {},
    buildCreationReferenceAnalysisAppliedFeedbackMessage: () => "识别完成",
    renderCreationReferenceAnalysis() {},
  });
  vm.runInContext(source("applyCreationReferenceAnalysisRecommendations"), scope);
  scope.applyCreationReferenceAnalysisRecommendations();
  assert.equal(scope.state.creationReferenceFiles[0].role, "reference-product");
  assert.equal(scope.state.creationReferenceAnalysis.applied, true);
});

test("图片已变化时，更改用途不能把过期识别重新标成有效", () => {
  const { scope, calls } = harness({ applied: false, dirty: true });
  scope.updateCreationReferenceRole("gloves", "reference-product");
  assert.equal(scope.state.creationReferenceAnalysis.applied, false);
  assert.equal(scope.state.creationReferenceAnalysis.dirty, true);
  assert.equal(calls.refresh, 0);
});

test("设置调整使草稿失效，但保留已生成套图和队列快照", () => {
  for (const generating of [false, true]) {
    const { scope } = harness();
    const result = { setId: "creation-saved", items: [{ status: "completed", imageUrl: "/saved.png" }] };
    const queue = [{ queueId: "old", set: result, formData: new FormData() }];
    Object.assign(scope.state.creation, { currentSet: result, queue, generating, planning: true });
    scope.resetCreationDraftPreview();
    assert.equal(scope.state.creation.currentSet, result);
    assert.equal(scope.state.creation.queue, queue);
    assert.equal(scope.state.creation.draftSet, null);
    assert.equal(scope.state.creation.effectivePlan, null);
    assert.equal(scope.state.creation.planDirty, true);
    assert.equal(scope.state.creation.planning, false);
  }
});

test("设置调整仍清除旧的未生成草稿，防止提交过期计划", () => {
  const { scope } = harness();
  scope.state.creation.currentSet = scope.state.creation.draftSet;
  scope.resetCreationDraftPreview();
  assert.equal(scope.state.creation.currentSet, null);
});

test("AI 营销模式调整语言比例或 SKU 时等待用户生成，不发起阻塞批量入口的自动规划", () => {
  for (const aiMarketing of [true, false]) {
    const { scope } = harness();
    let requests = 0;
    Object.assign(scope, {
      isCreationAiMarketingEnabled: () => aiMarketing,
      syncCreationExplicitSetParameters: () => scope.resetCreationDraftPreview(),
      hasCreationPlanPreviewInput: () => true,
      requestCreationPlanPreview() { requests += 1; scope.state.creation.planning = true; return Promise.resolve(); },
    });
    vm.runInContext(source("refreshCreationPlanAfterExplicitSetParameterChange"), scope);
    vm.runInContext(source("refreshCreationPlanAfterSkuGenerationToggle"), scope);
    scope.refreshCreationPlanAfterExplicitSetParameterChange({ targetLanguage: "de" });
    scope.refreshCreationPlanAfterSkuGenerationToggle();
    assert.equal(requests, aiMarketing ? 0 : 2);
    assert.equal(scope.state.creation.planning, !aiMarketing);
    assert.equal(scope.state.creationReferenceAnalysis.applied, true);
  }
});
