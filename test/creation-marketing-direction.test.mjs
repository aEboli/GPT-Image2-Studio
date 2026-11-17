import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";
import { createCreationMarketingBatchState, normalizeCreationMarketingBatchSchemeCount, normalizeCreationMarketingBatchCopies, canContinueCreationMarketingBatch, pausePendingCreationMarketingBatch, runCreationMarketingBatch } from "../lib/creation-marketing-batch.mjs";
import { buildCreationMarketingContext, CREATION_MARKETING_PLAN_INSTRUCTION } from "../lib/creation-marketing-plan.mjs";
import { creationMarketingInputFingerprint } from "../lib/creation-marketing-agent.mjs";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const source = (name) => {
  const match = app.match(new RegExp(`(?:async )?function ${name}\\([^]*?\\r?\\n\\}`));
  assert.ok(match, name);
  return match[0];
};

function harness(direction = "", { pauseAfterFirst = false } = {}) {
  const { input } = marketingPlanFixture(1);
  const requests = [], jobs = [], errors = [];
  const scope = {
    FormData, AbortController, structuredClone,
    state: { creation: { marketingBatchEnabled: true, planning: false }, creationReferenceFiles: [], clientSessionId: "direction-test" },
    refs: {
      creationMarketingBatchPanel: {}, creationMarketingBatchConfig: {},
      creationMarketingBatchDirectionInput: { value: direction },
      creationMarketingBatchCountInput: { value: "2" }, creationMarketingBatchCopiesInput: { value: "2" },
      creationOutputFormatInput: { value: "png" }, creationQualityInput: { value: "high" },
    },
    isCreationAiMarketingEnabled: () => true,
    isCreationMarketingBatchRunning: () => ["queued", "running", "pausing"].includes(scope.state.creation.marketingBatch?.status),
    ensureCreationReferenceGenerationFilesReady: async () => {},
    buildCreationPlanPreviewFormData: () => {
      const form = new FormData();
      form.set("productName", input.productName);
      form.set("productDescription", input.productDescription);
      form.set("imageCount", "1");
      return form;
    },
    appendCurrentConfigToFormData() {}, normalizeOutputFormat: (value) => value,
    getSelectedImageQuality: (control) => control.value,
    normalizeCreationMarketingBatchSchemeCount, normalizeCreationMarketingBatchCopies,
    canContinueCreationMarketingBatch, createCreationMarketingBatchState, runCreationMarketingBatch,
    getCreationSelectedImageCount: () => 1,
    resetCreationDraftPreview() {}, waitForPendingCreationPlanPreview: async () => {},
    renderCreationView() {}, renderCreationMarketingBatchItems() {}, renderCreationMarketingBatchTiming() {},
    creationMarketingBatchStatusLabel: (value) => value,
    requestCreationMarketingBatchPlan: async (formData) => {
      requests.push(formData);
      return { plan: { imageCount: 1, items: [{ itemId: "hero" }] }, marketingProgress: {} };
    },
    buildCreationQueuedSet: ({ effectivePlanOverride }) => structuredClone(effectivePlanOverride),
    enqueueCreationGeneration(job) {
      jobs.push(job);
      if (pauseAfterFirst && jobs.length === 1) pausePendingCreationMarketingBatch(scope.state.creation.marketingBatch);
      return { ...job, id: `direction-suite-${jobs.length}` };
    },
    nowIso: () => new Date().toISOString(), setCreationFeedback() {},
    compactErrorMessage: (value) => value, showError: (value) => errors.push(value),
  };
  vm.createContext(scope);
  vm.runInContext("let creationMarketingBatchSourceFormData = null; let creationMarketingBatchStarting = false; let creationMarketingBatchRequestController = null;", scope);
  for (const name of ["cloneCreationMarketingBatchFormData", "buildCreationMarketingBatchRequestFormData", "runCreationMarketingBatchGeneration", "renderCreationMarketingBatchConfig"]) vm.runInContext(source(name), scope);
  return { scope, input, requests, jobs, errors };
}

test("批量顶部以可选设计方向输入替换说明", () => {
  const panel = html.match(/<section class="creation-marketing-batch-panel"[^]*?<\/section>/)?.[0];
  assert.ok(panel);
  assert.match(panel, /<span>设计方向<\/span>/);
  const input = panel.match(/<input[^>]*id="creationMarketingBatchDirectionInput"[^>]*>/)?.[0];
  assert.ok(input);
  assert.match(input, /type="text"/);
  assert.match(input, /placeholder="[^"]*滑雪[^"]*可留空[^"]*"/);
  assert.doesNotMatch(input, /\brequired\b/);
  assert.doesNotMatch(panel, /同时规划 2 个方案|每套独立随机 Agent 创作/);
  assert.match(app, /creationMarketingBatchDirectionInput: document\.querySelector\("#creationMarketingBatchDirectionInput"\)/);
  assert.doesNotMatch(source("buildCreationPlanPreviewFormData"), /creationMarketingBatchDirectionInput/);
});

test("方向去除首尾空白并随每套规划和入队快照传递", async () => {
  const view = harness("  滑雪  ");
  await view.scope.runCreationMarketingBatchGeneration();
  assert.deepEqual(view.errors, []);
  assert.equal(view.requests.length, 4);
  assert.equal(view.jobs.length, 4);
  for (const form of [...view.requests, ...view.jobs.map((job) => job.formData)]) {
    assert.equal(form.get("marketingSupplement"), "滑雪");
    assert.equal(form.get("productDescription"), view.input.productDescription);
  }
  assert.equal(view.scope.state.creation.marketingBatch.status, "completed");
});

test("留空或仅有空白不附加方向且仍完成 AI 批量规划", async () => {
  for (const direction of ["", " \n\t "]) {
    const view = harness(direction);
    await view.scope.runCreationMarketingBatchGeneration();
    assert.deepEqual(view.errors, []);
    assert.equal(view.requests.length, 4);
    assert.equal(view.jobs.length, 4);
    assert.ok([...view.requests, ...view.jobs.map((job) => job.formData)].every((form) => !form.has("marketingSupplement")));
    assert.equal(view.scope.state.creation.marketingBatch.status, "completed");
  }
});

test("参考图准备期间也保留启动时的设计方向", async () => {
  const { scope } = harness("滑雪");
  let ready;
  scope.ensureCreationReferenceGenerationFilesReady = () => new Promise((resolve) => { ready = resolve; });
  const pending = scope.buildCreationMarketingBatchRequestFormData();
  scope.refs.creationMarketingBatchDirectionInput.value = "露营";
  ready();
  assert.equal((await pending).get("marketingSupplement"), "滑雪");
});

test("同套瞬时失败重试不丢失设计方向", async () => {
  const view = harness("滑雪");
  const request = view.scope.requestCreationMarketingBatchPlan;
  let failed = false;
  view.scope.runCreationMarketingBatch = (options) => runCreationMarketingBatch({ ...options, wait: async () => {} });
  view.scope.requestCreationMarketingBatchPlan = async (formData) => {
    assert.equal(formData.get("marketingSupplement"), "滑雪");
    if (!failed) { failed = true; throw new Error("HTTP 503 service unavailable"); }
    return request(formData);
  };
  await view.scope.runCreationMarketingBatchGeneration();
  assert.equal(view.scope.state.creation.marketingBatch.retryCount, 1);
  assert.equal(view.jobs.length, 4);
  assert.deepEqual(view.errors, []);
});

test("暂停继续保留原方向，新一轮才读取新输入", async () => {
  const view = harness("滑雪", { pauseAfterFirst: true });
  await view.scope.runCreationMarketingBatchGeneration();
  assert.equal(view.scope.state.creation.marketingBatch.status, "paused");
  view.scope.refs.creationMarketingBatchDirectionInput.value = "露营";
  await view.scope.runCreationMarketingBatchGeneration({ resume: true });
  assert.equal(view.requests.length, 4);
  assert.ok(view.requests.every((form) => form.get("marketingSupplement") === "滑雪"));
  assert.ok(view.jobs.every((job) => job.formData.get("marketingSupplement") === "滑雪"));
  await view.scope.runCreationMarketingBatchGeneration();
  assert.equal(view.requests.length, 8);
  assert.ok(view.requests.slice(4).every((form) => form.get("marketingSupplement") === "露营"));
  assert.equal(view.jobs[0].formData.get("marketingSupplement"), "滑雪");
  assert.deepEqual(view.errors, []);
});

test("方向随启动、运行和暂停锁定，完成或停止后恢复编辑", () => {
  const { scope } = harness("滑雪");
  for (const [status, expected] of [[null, false], ["queued", true], ["running", true], ["pausing", true], ["paused", true], ["completed", false], ["canceled", false]]) {
    scope.state.creation.marketingBatch = status ? createCreationMarketingBatchState({ count: 1 }) : null;
    if (status) scope.state.creation.marketingBatch.status = status;
    scope.renderCreationMarketingBatchConfig();
    assert.equal(scope.refs.creationMarketingBatchDirectionInput.disabled, expected, String(status));
  }
  vm.runInContext("creationMarketingBatchStarting = true;", scope);
  scope.renderCreationMarketingBatchConfig();
  assert.equal(scope.refs.creationMarketingBatchDirectionInput.disabled, true);
});

test("关键词进入规划上下文和指纹，作为可联想方向且遵守商品事实", () => {
  const { input } = marketingPlanFixture(1);
  const base = buildCreationPlan(input);
  assert.equal(buildCreationMarketingContext({ ...input, marketingSupplement: "  滑雪  " }, base).user_supplement, "滑雪");
  assert.equal(buildCreationMarketingContext({ ...input, marketingSupplement: "  " }, base).user_supplement, "");
  assert.notEqual(creationMarketingInputFingerprint(input), creationMarketingInputFingerprint({ ...input, marketingSupplement: "滑雪" }));
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /设计方向/);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /关联.*场景|场景.*关联/);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /留空.*原有|为空.*自主/);
  assert.match(CREATION_MARKETING_PLAN_INSTRUCTION, /不能据此虚构商品功能、规格、配件或效果/);
});
