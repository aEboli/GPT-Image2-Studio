import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { applyCreationReferenceAnalysisProductNameValue } from "../lib/creation-reference-analysis-view.mjs";
import { buildPromptAgentInput, CREATION_REFERENCE_ANALYSIS_MODE } from "../lib/prompt-agent.mjs";
import { normalizeCreationProductInsights } from "../lib/creation-product-insights.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

function functionSource(name) {
  let start = app.indexOf("function " + name + "(");
  assert.ok(start >= 0, name + " must exist");
  if (app.slice(start - 6, start) === "async ") start -= 6;
  const end = app.indexOf(String.fromCharCode(10) + "}", start) + 2;
  return app.slice(start, end);
}

function createHarness({ manualName = false } = {}) {
  const oldName = "三段式仿生金龙鱼沉水硬饵";
  const file = new File(["current-image"], "lure.png", { type: "image/png", lastModified: 1 });
  const scope = {
    FormData,
    creationReferenceAnalysisRequestToken: 1,
    creationReferenceAnalysisAbortController: new AbortController(),
    state: {
      creation: { planDirty: false },
      creationReferenceFiles: [{ id: "current-reference", file, role: "product" }],
      creationReferenceAnalysis: {
        applied: true, dirty: false, running: true,
        autoFilledProductName: manualName ? "" : oldName,
        productNameSuggestion: oldName, result: { productName: oldName },
      },
    },
    refs: {
      creationProductNameInput: { value: oldName },
      creationProductDescriptionInput: { value: "用户填写的功能说明" },
      creationReferenceInput: { value: "" },
    },
    applyCreationReferenceAnalysisProductNameValue,
    resetCreationDraftPreview() {
      scope.state.creation.planDirty = true;
      scope.state.creation.currentSet = null;
    },
    setCreationReferenceAnalysisFeedback() {},
    clearCreationReferenceAnalysisManagedCategory() {},
    revokeReferencePreview() {}, markCreationReferenceRestoreEntryMissing() {},
    renderCreationReferenceGrid() {}, closeReferencePreview() {},
    getSelectedReasoningEffort: () => "high",
    preparePromptAnalysisImageFile: async (value) => value,
    getCreationSelectedPlatform: () => ({ value: "universal", label: "通用电商" }),
    getCreationSelectedIndustryTemplate: () => ({ value: "general" }),
    resolveCreationReferenceAnalysisContextCategoryValue: () => "general",
    normalizeCreationIndustryTemplate: () => ({ value: "general", label: "通用电商" }),
    buildCreationReferenceRolePayload: () => [], appendCurrentConfigToFormData() {},
  };
  vm.createContext(scope);
  for (const name of [
    "invalidateCreationReferenceAnalysisRequest",
    "clearCreationReferenceAnalysisManagedProductName",
    "markCreationReferenceAnalysisDirty",
    "markCreationProductAnalysisDirty",
    "clearCreationReferenceFiles",
    "applyCreationReferenceAnalysisProductNameSuggestion",
    "getCreationReferenceAnalysisSnapshot",
    "buildCreationReferenceAnalysisFormData",
  ]) {
    vm.runInContext(functionSource(name), scope);
  }
  return { scope, oldName };
}

test("replacing references keeps the current name but excludes automatic copy from the next visual request", async () => {
  const { scope, oldName } = createHarness();
  scope.markCreationReferenceAnalysisDirty();
  const body = await scope.buildCreationReferenceAnalysisFormData();
  assert.equal(scope.refs.creationProductNameInput.value, oldName);
  assert.equal(body.get("productName"), "");
  assert.equal(body.get("productDescription"), "用户填写的功能说明");
  assert.equal(body.getAll("referenceImages").length, 1);
  assert.equal(scope.state.creationReferenceAnalysis.autoFilledProductName, oldName);
  assert.equal(scope.state.creationReferenceAnalysis.applied, false);
  assert.equal(scope.state.creationReferenceAnalysis.dirty, true);
  scope.applyCreationReferenceAnalysisProductNameSuggestion({ productName: "太阳鱼造型关节拟饵" });
  assert.equal(scope.refs.creationProductNameInput.value, "太阳鱼造型关节拟饵");
});

test("replacing references preserves manually written product copy", async () => {
  for (const manualName of [false, true]) {
    const { scope } = createHarness({ manualName });
    scope.refs.creationProductNameInput.value = "用户自定义拟饵名称";
    scope.markCreationReferenceAnalysisDirty();
    const body = await scope.buildCreationReferenceAnalysisFormData();
    assert.equal(body.get("productName"), "用户自定义拟饵名称");
    assert.equal(scope.refs.creationProductNameInput.value, "用户自定义拟饵名称");
  }
});

test("repeat recognition never promotes an automatic name into user-provided evidence", async () => {
  const { scope, oldName } = createHarness();
  const automaticBody = await scope.buildCreationReferenceAnalysisFormData();
  assert.equal(automaticBody.get("productName"), "");
  scope.state.creationReferenceAnalysis.autoFilledProductName = "";
  const manualBody = await scope.buildCreationReferenceAnalysisFormData();
  assert.equal(manualBody.get("productName"), oldName);
});

test("repeat recognition replaces automatic and manual names with the new subject", () => {
  for (const manualName of [false, true]) {
    const { scope } = createHarness({ manualName });
    scope.applyCreationReferenceAnalysisProductNameSuggestion({ productName: "太阳鱼造型关节拟饵" });
    assert.equal(scope.refs.creationProductNameInput.value, "太阳鱼造型关节拟饵");
  }
});

test("role-only changes retain the current automatic product name", () => {
  const { scope, oldName } = createHarness();
  scope.markCreationReferenceAnalysisDirty({ invalidateCategorySuggestion: false });
  assert.equal(scope.refs.creationProductNameInput.value, oldName);
});

test("a user input event takes ownership even when the name matches the automatic value", () => {
  const { scope, oldName } = createHarness();
  let onNameInput;
  scope.refs.creationProductNameInput.addEventListener = (event, handler) => { onNameInput = handler; };
  scope.refs.creationProductDescriptionInput.addEventListener = () => {};
  const start = app.indexOf('  [refs.creationProductNameInput, refs.creationProductDescriptionInput].forEach((input) => input.addEventListener("input", () => {');
  assert.ok(start >= 0);
  const end = app.indexOf("  }));", start) + 7;
  vm.runInContext(app.slice(start, end), scope);
  onNameInput();
  scope.markCreationReferenceAnalysisDirty();
  assert.equal(scope.refs.creationProductNameInput.value, oldName);
  assert.equal(scope.state.creationReferenceAnalysis.autoFilledProductName, "");
});

test("editing product text invalidates the plan while retaining recognition and its pending request", () => {
  for (const field of ["creationProductNameInput", "creationProductDescriptionInput"]) {
    const { scope } = createHarness();
    const analysis = scope.state.creationReferenceAnalysis.result;
    const snapshot = scope.getCreationReferenceAnalysisSnapshot();
    const signal = scope.creationReferenceAnalysisAbortController.signal;
    const handlers = {};
    for (const name of ["creationProductNameInput", "creationProductDescriptionInput"]) {
      scope.refs[name].addEventListener = (_event, handler) => { handlers[name] = handler; };
    }
    const start = app.indexOf('  [refs.creationProductNameInput, refs.creationProductDescriptionInput].forEach((input) => input.addEventListener("input", () => {');
    assert.ok(start >= 0);
    const end = app.indexOf("  }));", start) + 7;
    vm.runInContext(app.slice(start, end), scope);
    scope.refs[field].value = "用户补充的商品信息";
    handlers[field]();
    assert.equal(scope.state.creation.planDirty, true);
    assert.equal(scope.state.creationReferenceAnalysis.result, analysis);
    assert.equal(scope.state.creationReferenceAnalysis.applied, true);
    assert.equal(scope.state.creationReferenceAnalysis.dirty, false);
    assert.equal(signal.aborted, false);
    assert.equal(scope.getCreationReferenceAnalysisSnapshot(), snapshot);
  }
});

test("edited product information keeps reference facts in the planning payload and revalidates user facts", () => {
  const { scope } = createHarness();
  const productInsights = {
    confirmedFacts: [
      { id: "reference-fact", text: "黑色手套", source: "reference", referenceIndexes: [1] },
      { id: "old-user-fact", text: "已删除的旧描述", source: "user", referenceIndexes: [] },
    ],
  };
  scope.state.creationReferenceAnalysis.result.productInsights = productInsights;
  scope.refs.creationProductNameInput.value = "新商品名称";
  scope.refs.creationProductDescriptionInput.value = "新商品描述";
  scope.refs.creationIndustryTemplateInput = { value: "general" };
  Object.assign(scope, {
    syncCreationSkuGenerationControl() {},
    getFrozenCreationEffectivePlan: () => null,
    getFrozenCreationPlatformPayload: () => ({ values: { platformSetOverrides: {} } }),
    getCreationSelectedLanguage: () => ({ value: "en" }),
    getCreationSelectedRoles: () => [],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationPlanPreviewImageCount: () => 1,
    isCreationInfographicRebuildRequired: () => false,
    buildCreationSkuSubjectPayload: () => [],
    getCreationSelectedSkuGenerationRule: () => ({ value: "color" }),
    appendFrozenCreationPlatformPayload() {},
    resolveCreationSelectedRolesSubmission: () => ({ imageCount: 1, selectedRoles: [] }),
    isCreationAiMarketingEnabled: () => true,
  });
  vm.runInContext(functionSource("buildCreationPlanPreviewFormData"), scope);
  const body = scope.buildCreationPlanPreviewFormData();
  assert.equal(body.get("productName"), "新商品名称");
  assert.equal(body.get("productDescription"), "新商品描述");
  assert.equal(body.get("analysisValidated"), "true");
  const submittedInsights = JSON.parse(body.get("productInsights"));
  const revalidated = normalizeCreationProductInsights(submittedInsights, {
    referenceCount: 1,
    userFacts: [body.get("productName"), body.get("productDescription")].join("\n"),
  });
  assert.deepEqual(revalidated.confirmedFacts.map((fact) => fact.id), ["reference-fact"]);
});

test("clearing all references aborts the old request and invalidates its analysis", () => {
  const { scope } = createHarness();
  const generatedSet = { setId: "saved-set" };
  scope.state.creation.currentSet = generatedSet;
  const signal = scope.creationReferenceAnalysisAbortController.signal;
  scope.clearCreationReferenceFiles();
  assert.equal(signal.aborted, true);
  assert.equal(scope.state.creationReferenceFiles.length, 0);
  assert.equal(scope.state.creationReferenceAnalysis.applied, false);
  assert.equal(scope.state.creationReferenceAnalysis.dirty, true);
  assert.equal(scope.state.creation.planDirty, true);
  assert.equal(scope.refs.creationProductNameInput.value, "");
  assert.equal(scope.state.creation.currentSet, generatedSet);
});

test("automatic names record the filled value rather than a suggestion", () => {
  const { scope } = createHarness({ manualName: true });
  scope.applyCreationReferenceAnalysisProductNameSuggestion({ productName: "太阳鱼造型关节拟饵" });
  assert.equal(scope.state.creationReferenceAnalysis.autoFilledProductName, "太阳鱼造型关节拟饵");
  scope.refs.creationProductNameInput.value = "";
  scope.applyCreationReferenceAnalysisProductNameSuggestion({ productName: "太阳鱼造型关节拟饵" });
  assert.equal(scope.state.creationReferenceAnalysis.autoFilledProductName, "太阳鱼造型关节拟饵");
});

test("snapshots distinguish new uploads with identical file metadata", () => {
  const { scope } = createHarness();
  const snapshot = scope.getCreationReferenceAnalysisSnapshot();
  scope.state.creationReferenceFiles[0].id = "replacement-reference";
  assert.notEqual(scope.getCreationReferenceAnalysisSnapshot(), snapshot);
});

test("late analysis cannot apply after same-metadata references change before or during category loading", async () => {
  for (const changeAt of ["response", "category"]) {
    const { scope } = createHarness();
    const oldResult = scope.state.creationReferenceAnalysis.result;
    const element = () => ({ dataset: {}, append() {}, replaceChildren() {}, addEventListener() {} });
    const messages = [];
    Object.assign(scope, {
      AbortController, Date, setInterval, clearInterval,
      document: { createElement: element }, fetch() {},
      creationReferenceAnalysisApplyGuard: null, creationMarketingProgressView: null,
      clearError() {}, renderCreationReferenceAnalysis() {}, setCreationAnalystExpanded() {},
      showError(message) { assert.fail(message); },
      setCreationReferenceAnalysisFeedback(message, kind) { messages.push(kind); },
      createTextModelPreview: () => ({ update() {}, finish() {} }),
      normalizeCreationReferenceAnalysisPayload: (value) => value.analysis || value,
      async applyCreationReferenceAnalysisCategoryMatch() {
        if (changeAt === "category") scope.state.creationReferenceFiles[0].id = "new-reference";
        return { applied: false, cleared: false, template: null };
      },
      async requestTextModel() {
        if (changeAt === "response") scope.state.creationReferenceFiles[0].id = "new-reference";
        return { ok: true, json: async () => ({ analysis: {
          productName: "旧批次识别结果", recommendations: [{ filename: "lure.png", role: "product" }],
        } }) };
      },
      applyCreationReferenceAnalysisRecommendations() { assert.fail("stale recommendations applied"); },
    });
    scope.refs.creationRecordDetail = element();
    scope.refs.creationAnalystButton = {};
    vm.runInContext(functionSource("applyCreationReferenceAnalysis"), scope);
    vm.runInContext(functionSource("analyzeCreationReferenceImages"), scope);
    await scope.analyzeCreationReferenceImages();
    assert.equal(scope.state.creationReferenceAnalysis.result, oldResult);
    assert.equal(messages.includes("success"), false);
  }
});

test("recognition isolates conflicting prior copy and has no fishing-lure example bias", () => {
  const input = buildPromptAgentInput({
    mode: CREATION_REFERENCE_ANALYSIS_MODE,
    images: [{ filename: "current.png", mimeType: "image/png", base64: "aW1hZ2U=" }],
  });
  const instruction = input[0].content[0].text;
  assert.match(instruction, /独立识别/);
  assert.match(instruction, /上一批/);
  assert.doesNotMatch(instruction, /such as 'jointed fishing lure'/);
});
