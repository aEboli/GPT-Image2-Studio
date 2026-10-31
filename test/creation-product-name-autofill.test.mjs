import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import {
  applyCreationReferenceAnalysisProductNameValue,
  buildCreationReferenceAnalysisAppliedFeedbackMessage,
} from "../lib/creation-reference-analysis-view.mjs";

test("creation analysis fills an empty product name from the identified subject", () => {
  for (const currentProductName of ["", "   "]) {
    assert.deepEqual(applyCreationReferenceAnalysisProductNameValue({
      analysis: { productName: "加热手套" }, currentProductName,
    }), { applied: true, autoProductName: "加热手套", productName: "加热手套" });
  }
  assert.equal(applyCreationReferenceAnalysisProductNameValue({
    analysis: { sku_subjects: [{ title: "保温午餐包", filenames: ["front.png"] }] },
  }).productName, "保温午餐包");
});

test("new creation analysis overwrites existing product names", () => {
  for (const currentProductName of ["用户自定义名称", "  用户原文  ", "上轮识别的名称"]) {
    const result = applyCreationReferenceAnalysisProductNameValue({
      analysis: { productName: "加热手套" }, currentProductName,
    });
    assert.equal(result.applied, true);
    assert.equal(result.productName, "加热手套");
  }
});

test("creation analysis does not auto-fill product codes as names", () => {
  for (const productName of ["F2J14", "f2j14", "F2-J14", "F2_J14", "123456", "SKU-001", "货号：F2J14", "型号 F2J14", "SKU: F2J14", "Model: F2J14"]) {
    for (const analysis of [{ productName }, { sku_subjects: [{ title: productName }] }]) {
      const result = applyCreationReferenceAnalysisProductNameValue({ analysis });
      assert.equal(result.applied, false, productName);
      assert.equal(result.productName, "", productName);
    }
  }
});

test("creation analysis keeps descriptive names with model numbers and skips coded SKU titles", () => {
  for (const productName of ["F2J14 加热手套", "3M 防护手套", "iPhone 16 手机壳", "USB-C Charging Cable", "2-in-1 Travel Bag"]) {
    const result = applyCreationReferenceAnalysisProductNameValue({ analysis: { productName } });
    assert.equal(result.applied, true, productName);
    assert.equal(result.productName, productName);
  }
  const result = applyCreationReferenceAnalysisProductNameValue({ analysis: {
    productName: "F2J14", sku_subjects: [{ title: "F2J14" }, { title: "加热手套" }],
  } });
  assert.equal(result.productName, "加热手套");
  assert.equal(applyCreationReferenceAnalysisProductNameValue({
    analysis: { productName: "加热手套" }, currentProductName: "F2J14",
  }).productName, "加热手套", "a new identified subject replaces a manually entered code");
});

test("creation analysis never fills names from categories, filenames or generic subjects", () => {
  for (const analysis of [
    {}, { productName: "product" }, { productName: "商品" },
    { productName: "front.png" },
    { categoryTemplateLabel: "服饰配件", categoryPath: "服饰 > 配件", categoryHint: "手套" },
    { skuSubjects: [{ title: "front.png", filenames: ["front.png"] }] },
  ]) {
    const result = applyCreationReferenceAnalysisProductNameValue({ analysis });
    assert.equal(result.applied, false);
    assert.equal(result.productName, "");
    const existing = applyCreationReferenceAnalysisProductNameValue({ analysis, currentProductName: "已有商品名称" });
    assert.equal(existing.applied, false);
    assert.equal(existing.productName, "已有商品名称");
  }
});

test("creation analysis feedback distinguishes filled names from suggestions", () => {
  const filled = buildCreationReferenceAnalysisAppliedFeedbackMessage({
    recommendationCount: 5, productNameSuggestion: "加热手套", productNameApplied: true,
  });
  assert.match(filled, /已自动填写商品名称：加热手套/);
  assert.doesNotMatch(filled, /自行填写/);
  const suggestion = buildCreationReferenceAnalysisAppliedFeedbackMessage({
    recommendationCount: 5, productNameSuggestion: "加热手套", productNameApplied: false,
  });
  assert.match(suggestion, /识别名称建议：加热手套/);
  assert.doesNotMatch(suggestion, /已自动填写/);
});

async function createAnalysisHarness({ currentProductName = "", identifiedProductName = "加热手套", duringRequest, duringCategoryMatch, prepareFormData } = {}) {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const functionSource = (name) => {
    const source = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`))?.[0];
    assert.ok(source, `${name} must exist`);
    return source;
  };
  const element = () => ({
    dataset: {}, append() {}, replaceChildren() {}, addEventListener() {},
  });
  const messages = [];
  const previewEvents = [];
  const scope = {
    AbortController,
    Date,
    setInterval, clearInterval,
    fetch() {},
    document: { createElement: element },
    state: {
      creationReferenceFiles: [{ file: { name: "gloves.png", size: 1, type: "image/png", lastModified: 1 } }],
      creationReferenceAnalysis: { running: false },
    },
    refs: {
      creationProductNameInput: { value: currentProductName },
      creationProductDescriptionInput: { value: "" },
      creationRecordDetail: element(), creationAnalystButton: {},
    },
    creationReferenceAnalysisRequestToken: 0,
    creationReferenceAnalysisAbortController: null,
    creationReferenceAnalysisApplyGuard: null,
    creationMarketingProgressView: null,
    applyCreationReferenceAnalysisProductNameValue,
    buildCreationReferenceAnalysisAppliedFeedbackMessage,
    clearError() {}, renderCreationReferenceAnalysis() {}, resetCreationDraftPreview() {},
    showError(message) { throw new Error(message); },
    setCreationReferenceAnalysisFeedback(message, kind) { messages.push({ message, kind }); },
    setCreationAnalystExpanded() {},
    createTextModelPreview: () => ({ update(event) { previewEvents.push(event); }, finish() {} }),
    getCreationSelectedPlatform: () => ({ value: "universal" }),
    buildCreationReferenceAnalysisFormData: async () => prepareFormData ? prepareFormData() : ({}),
    normalizeCreationReferenceAnalysisPayload: (value) => value.analysis || value,
    async applyCreationReferenceAnalysisCategoryMatch() {
      duringCategoryMatch?.(scope);
      return { applied: false, cleared: false, template: null };
    },
    async requestTextModel() {
      duringRequest?.(scope);
      return { ok: true, json: async () => ({ analysis: {
        productName: identifiedProductName, recommendations: [{ filename: "gloves.png", role: "product" }],
      } }) };
    },
    applyCreationReferenceAnalysisRecommendations() {
      const analysis = scope.state.creationReferenceAnalysis.result;
      const productNameApplied = scope.applyCreationReferenceAnalysisProductNameSuggestion(analysis);
      return {
        productNameApplied,
        appliedMessage: buildCreationReferenceAnalysisAppliedFeedbackMessage({
          recommendationCount: analysis.recommendations.length,
          productNameSuggestion: scope.state.creationReferenceAnalysis.productNameSuggestion,
          productNameApplied,
        }),
      };
    },
  };
  vm.createContext(scope);
  vm.runInContext([
    "getCreationReferenceAnalysisSnapshot", "applyCreationReferenceAnalysisProductNameSuggestion",
    "applyCreationReferenceAnalysis", "analyzeCreationReferenceImages",
  ].map(functionSource).join("\n"), scope);
  return { scope, messages, previewEvents };
}

test("analyst shows preparation and advancing time before image preparation resolves", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: 1000 });
  let release;
  const { scope, previewEvents } = await createAnalysisHarness({ prepareFormData: () => new Promise((done) => { release = done; }) });
  const pending = scope.analyzeCreationReferenceImages();
  assert.equal(previewEvents[0]?.stage, "preparing");
  assert.match(previewEvents[0]?.message || "", /准备.*1.*参考图/);
  t.mock.timers.tick(3000);
  assert.equal(previewEvents.at(-1)?.elapsedMs, 3000);
  release({});
  await pending;
  const finalCount = previewEvents.length;
  t.mock.timers.tick(3000);
  assert.equal(previewEvents.length, finalCount, "analysis completion releases its clock");
});

test("analyst cancels before sending prepared images and releases its clock", async (t) => {
  t.mock.timers.enable({ apis: ["Date", "setInterval"], now: 1000 });
  let release;
  let requests = 0;
  const { scope, previewEvents } = await createAnalysisHarness({
    prepareFormData: () => new Promise((done) => { release = done; }),
    duringRequest: () => { requests += 1; },
  });
  const pending = scope.analyzeCreationReferenceImages();
  scope.creationReferenceAnalysisAbortController.abort();
  scope.creationReferenceAnalysisRequestToken += 1;
  release({});
  await pending;
  assert.equal(requests, 0);
  const count = previewEvents.length;
  t.mock.timers.tick(3000);
  assert.equal(previewEvents.length, count);
});

test("creation browser applies the recognized name and completes success feedback", async () => {
  const { scope, messages } = await createAnalysisHarness();
  await scope.analyzeCreationReferenceImages();
  assert.equal(scope.refs.creationProductNameInput.value, "加热手套");
  assert.equal(scope.state.creationReferenceAnalysis.running, false);
  assert.equal(messages.at(-1).kind, "success");
  assert.match(messages.at(-1).message, /已自动填写商品名称：加热手套/);
});

test("creation browser skips a recognized product code without reporting a filled name", async () => {
  const { scope, messages } = await createAnalysisHarness({ identifiedProductName: "F2J14" });
  await scope.analyzeCreationReferenceImages();
  assert.equal(scope.refs.creationProductNameInput.value, "");
  assert.equal(messages.at(-1).kind, "success");
  assert.doesNotMatch(messages.at(-1).message, /已自动填写商品名称|F2J14/);
});

test("creation browser applies new names even when product text changes during recognition", async () => {
  for (const options of [
    { currentProductName: "我的手套" },
    { duringRequest: (scope) => { scope.refs.creationProductNameInput.value = "我的手套"; } },
    { duringCategoryMatch: (scope) => { scope.refs.creationProductNameInput.value = "我的手套"; } },
    { duringRequest: (scope) => { scope.refs.creationProductDescriptionInput.value = "补充商品描述"; } },
    { duringCategoryMatch: (scope) => { scope.refs.creationProductDescriptionInput.value = "补充商品描述"; } },
  ]) {
    const { scope, messages } = await createAnalysisHarness(options);
    await scope.analyzeCreationReferenceImages();
    assert.equal(scope.refs.creationProductNameInput.value, "加热手套");
    assert.equal(scope.state.creationReferenceAnalysis.result.productName, "加热手套");
    assert.equal(messages.at(-1).kind, "success");
  }
});
