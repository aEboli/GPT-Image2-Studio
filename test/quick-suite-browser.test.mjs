import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { getGenerationSizeOptions } from "../lib/generation-size-options.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const extract = (name) => {
  const source = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\n\\}`))?.[0];
  assert.ok(source, `${name} must exist`);
  return source;
};

function harness() {
  const ui = {
    generate: { disabled: false }, productName: { value: "保温杯" }, details: { value: "500ml" },
    analysisNote: {}, planList: {}, images: { value: "" }, imageSummary: {},
  };
  const refs = Object.fromEntries([
    "creationProductNameInput", "creationProductDescriptionInput", "creationInfographicRebuildEnabledInput",
    "creationListingAgentEnabledInput", "creationSkuGenerationEnabledInput", "creationRatioInput",
    "creationSizeInput", "creationTargetLanguageInput", "creationReferenceAnalysisFeedback", "creationFeedback",
  ].map((key) => [key, { value: "old", checked: true, textContent: "" }]));
  const context = {
    ui, refs, FormData, getGenerationSizeOptions,
    quickSuiteState: { files: [{ name: "new.png", type: "image/png" }], ratio: "4:3", width: 2048, language: "zh-CN" },
    state: { creation: { planDirty: true }, creationReferenceFiles: [{ name: "old.png" }] },
    quickSuitePlanRequestId: 0,
    getQuickSuiteRefs: () => ui,
    getQuickSuiteSelectedCount: () => 4,
    readQuickSuiteRatio: () => context.quickSuiteState.ratio,
    getCreationMaxProductReferenceImageCount: () => 15,
    isModelProtocolImageRoute: () => false,
    setQuickSuiteStatus: (message) => { context.status = message; },
    showError: (message) => { context.error = message; },
    setActiveView: async () => {}, waitForPendingCreationPlanPreview: async () => {},
    invalidateCreationReferenceAnalysisRequest() {}, setCreationBranch() {}, setCreationIndustryTemplateValue() {},
    setFrozenCreationPlatformPayload: (value) => { context.payload = value; },
    resetCreationReferenceFilesForRecordReuse: () => { context.state.creationReferenceFiles = []; },
    resetCreationDraftPreview: () => { context.state.creation.planDirty = true; },
    applyCreationReferenceFiles: (files) => { context.state.creationReferenceFiles.push(...files); },
    ensureCreationReferenceGenerationFilesReady: async () => {}, analyzeCreationReferenceImages: async () => {},
    setCreationImageCountValue: (count) => { context.count = count; }, renderCreationSizeOptions() {},
    syncCreationSelectedRolesToCount() {},
    syncCreationExplicitSetParameters: (parameters) => { context.parameters = parameters; },
    requestCreationPlanPreview: async () => { context.state.creation.planDirty = false; },
    getFrozenCreationEffectivePlan: () => ({ canGenerate: true, items: [{ itemKind: "carousel" }] }),
    renderQuickSuitePlan: (items) => { context.items = items; },
    startCreationGeneration: async () => { context.submissions = (context.submissions || 0) + 1; return { id: "queued" }; },
  };
  vm.runInNewContext([
    "getQuickSuiteGenerationSize", "startQuickSuiteGeneration", "refreshQuickSuitePlanPreview", "applyQuickSuiteFiles",
  ].map(extract).join("\n"), context);
  return context;
}

test("快捷套图替换旧参考图、关闭额外模块并提交可核对的批次参数", async () => {
  const context = harness();
  const job = await context.startQuickSuiteGeneration();
  assert.equal(job.id, "queued");
  assert.deepEqual(Array.from(context.state.creationReferenceFiles, (file) => file.name), ["new.png"]);
  assert.equal(context.refs.creationSkuGenerationEnabledInput.checked, false);
  assert.equal(context.refs.creationInfographicRebuildEnabledInput.checked, false);
  assert.equal(context.refs.creationListingAgentEnabledInput.checked, false);
  assert.deepEqual({ ...context.parameters }, { imageCount: 4, ratio: "4:3", resolutionTier: "2720x2048", targetLanguage: "zh-CN" });
  assert.equal(context.submissions, 1);
  assert.match(context.status, /已加入队列/);
  assert.equal(context.ui.generate.disabled, false);
});

test("快捷套图启动即加锁，准备阶段连点只提交一次", async () => {
  const context = harness();
  let release;
  context.setActiveView = () => new Promise((resolve) => { release = resolve; });
  const first = context.startQuickSuiteGeneration();
  assert.equal(context.ui.generate.disabled, true);
  await context.startQuickSuiteGeneration();
  release();
  await first;
  assert.equal(context.submissions, 1);
});

for (const failure of ["plan", "queue", "navigation"]) {
  test(`快捷套图 ${failure} 失败不误报成功，按钮恢复可重试`, async () => {
    const context = harness();
    if (failure === "plan") context.requestCreationPlanPreview = async () => {};
    if (failure === "queue") context.startCreationGeneration = async () => null;
    if (failure === "navigation") context.setActiveView = async () => { throw new Error("视图加载失败"); };
    await context.startQuickSuiteGeneration();
    assert.doesNotMatch(context.status, /已加入队列/);
    assert.ok(context.error);
    assert.equal(context.ui.generate.disabled, false);
    if (failure !== "queue") assert.equal(context.submissions, undefined);
  });
}

test("快捷分辨率按短边选择实际尺寸，Gemini 使用自己的分辨率值", () => {
  const context = harness();
  assert.equal(context.getQuickSuiteGenerationSize("3:4", 2048), "2048x2720");
  assert.equal(context.getQuickSuiteGenerationSize("4:3", 2048), "2720x2048");
  assert.equal(context.getQuickSuiteGenerationSize("1:1", 2880), "2880x2880");
  context.isModelProtocolImageRoute = () => true;
  assert.equal(context.getQuickSuiteGenerationSize("4:3", 1024), "1K");
  assert.equal(context.getQuickSuiteGenerationSize("4:3", 2048), "2K");
  assert.equal(context.getQuickSuiteGenerationSize("4:3", 2880), "4K");
});

test("清空商品名使在途预览过期，旧计划不会重新显示", async () => {
  const context = harness();
  let release;
  context.fetch = () => new Promise((resolve) => { release = resolve; });
  const pending = context.refreshQuickSuitePlanPreview();
  context.ui.productName.value = "";
  await context.refreshQuickSuitePlanPreview();
  release({ ok: true, json: async () => ({ plan: { items: [{ title: "旧计划" }] } }) });
  await pending;
  assert.equal(context.items.length, 0);
});

test("快捷预览提交所选尺寸并展示接口错误", async () => {
  const context = harness();
  let submitted;
  context.fetch = async (_url, { body }) => {
    submitted = body;
    return { ok: false, json: async () => ({ message: "预览测试错误" }) };
  };
  await context.refreshQuickSuitePlanPreview();
  assert.equal(submitted.get("resolutionTier"), "2720x2048");
  assert.equal(submitted.get("imageCount"), "4");
  assert.equal(submitted.get("infographicRebuildEnabled"), "false");
  assert.equal(context.status, "预览测试错误");
});

test("上传和拖入共用图片验证，不静默截断超量文件", () => {
  const context = harness();
  context.applyQuickSuiteFiles([{ name: "cup.png", type: "image/png" }]);
  assert.equal(context.quickSuiteState.files[0].name, "cup.png");
  assert.match(context.ui.imageSummary.textContent, /已选择 1 张/);
  context.applyQuickSuiteFiles(Array.from({ length: 16 }, () => ({ type: "image/png" })));
  assert.match(context.status, /最多支持 15 张/);
  assert.equal(context.quickSuiteState.files[0].name, "cup.png");
});
