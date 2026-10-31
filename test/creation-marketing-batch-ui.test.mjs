import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { normalizeCreationMarketingBatchSchemeCount, normalizeCreationMarketingBatchCopies, canContinueCreationMarketingBatch, createCreationMarketingBatchState, getCreationMarketingBatchElapsedMs } from "../lib/creation-marketing-batch.mjs";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");

test("batch marketing controls are placed after the creation module toggles and are hidden until AI marketing is enabled", () => {
  const toggleIndex = html.indexOf("id=\"creationAiMarketingEnabledInput\"");
  const batchIndex = html.indexOf("id=\"creationMarketingBatchPanel\"");
  const infographicIndex = html.indexOf("id=\"creationInfographicRebuildEnabledInput\"");
  assert.ok(toggleIndex >= 0 && batchIndex > toggleIndex);
  assert.ok(batchIndex > infographicIndex);
  assert.match(html, /id="creationMarketingBatchPanel"[^>]*hidden/);
  assert.match(html, /id="creationMarketingBatchCountInput"[^>]*min="1"[^>]*max="20"/);
  assert.match(html, /方案数量/);
  assert.match(html, /id="creationMarketingBatchCopiesInput"[^>]*min="1"[^>]*max="20"/);
  assert.match(html, /每个方案生成套数/);
  assert.match(html, /id="creationMarketingBatchEstimate"/);
  assert.doesNotMatch(html, /附加要求|追加内容|creationMarketingBatchCommonSupplementInput|creationMarketingBatchSchemeFields/);
});

test("batch marketing wiring uses the existing plan and suite queue paths", () => {
  assert.match(app, /runCreationMarketingBatch\(/);
  assert.match(app, /requestCreationMarketingBatchPlan\(formData, scheme, batch, requestController\.signal\)/);
  assert.match(html, /同时规划 2 个方案/);
  assert.match(app, /batch\.activeIndexes/);
  assert.match(app, /effectivePlanOverride: planResult\.plan, sourceFormData/);
  assert.match(app, /enqueueCreationGeneration\(\{ formData: generationFormData, set: queuedSet \}\)/);
  assert.match(app, /normalizeCreationMarketingBatchCopies/);
  assert.match(app, /copyNumber/);
  assert.match(app, /creationMarketingBatchCopiesInput\?\.addEventListener\("input"/);
  assert.match(app, /creationMarketingBatchContinueButton/);
  assert.match(app, /creationMarketingBatchCancelButton/);
  assert.match(html, /id="creationMarketingBatchContinueButton"[^>]*>继续<\/button>/);
  assert.match(html, /id="creationMarketingBatchPauseButton"[^>]*>暂停后续<\/button>/);
  assert.match(html, /id="creationMarketingBatchCancelButton"[^>]*>停止后续<\/button>/);
  assert.match(app, /creationMarketingBatchPauseButton\?\.addEventListener\("click", pauseCreationMarketingBatch\)/);
});

test("batch controls have responsive layout coverage", () => {
  assert.match(styles, /\.creation-marketing-batch-panel\s*\{/);
  assert.match(styles, /\.creation-marketing-batch-panel\s*\{[\s\S]*grid-column:\s*1\s*\/\s*-1/);
  assert.match(styles, /#creationMarketingBatchToggle\s*\{[\s\S]*white-space:\s*nowrap/);
  assert.match(styles, /\.creation-marketing-batch-fields\s*\{[\s\S]*grid-template-columns:\s*repeat\(2,\s*minmax\(0,\s*1fr\)\)/);
  assert.match(styles, /html\[data-ui-layout="mobile"\] \.creation-marketing-batch-fields\s*\{[\s\S]*grid-template-columns:\s*1fr/);
});

function createBatchConfigHarness({ enabled = false, imageCount = 20, count = 10, copies = 2 } = {}) {
  const attributes = {};
  const timers = new Map();
  let nextTimer = 0;
  const scope = {
    state: { creation: { marketingBatchEnabled: enabled, planning: false } },
    refs: {
      creationMarketingBatchPanel: {}, creationMarketingBatchConfig: {},
      creationMarketingBatchToggle: { setAttribute: (key, value) => { attributes[key] = value; } },
      creationMarketingBatchCountInput: { value: String(count) },
      creationMarketingBatchCopiesInput: { value: String(copies) },
      creationMarketingBatchEstimate: {}, creationMarketingBatchStartButton: {},
      creationMarketingBatchContinueButton: {}, creationMarketingBatchPauseButton: {}, creationMarketingBatchCancelButton: {},
      creationMarketingBatchStatus: {},
      creationMarketingBatchElapsed: {}, creationMarketingBatchTiming: {},
    },
    aiMarketing: true, imageCount, creationMarketingBatchStarting: false,
    isCreationAiMarketingEnabled: () => scope.aiMarketing,
    isCreationMarketingBatchRunning: () => ["queued", "running", "pausing"].includes(scope.state.creation.marketingBatch?.status),
    getCreationSelectedImageCount: () => scope.imageCount,
    normalizeCreationMarketingBatchSchemeCount, normalizeCreationMarketingBatchCopies,
    canContinueCreationMarketingBatch, getCreationMarketingBatchElapsedMs,
    setInterval: (callback, milliseconds) => { const id = ++nextTimer; timers.set(id, { callback, milliseconds }); return id; },
    clearInterval: (id) => timers.delete(id),
    creationMarketingBatchStatusLabel: (status) => status,
    CREATION_MARKETING_BATCH_CONCURRENCY: 2,
  };
  const render = app.match(/function renderCreationMarketingBatchConfig\([^]*?\r?\n\}/)?.[0];
  assert.ok(render);
  vm.createContext(scope);
  vm.runInContext("let creationMarketingBatchClock = null;", scope);
  for (const name of ["formatCreationMarketingBatchElapsed", "renderCreationMarketingBatchTiming"]) {
    const source = app.match(new RegExp(`function ${name}\\([^]*?\\r?\\n\\}`))?.[0];
    assert.ok(source);
    vm.runInContext(source, scope);
  }
  vm.runInContext(render, scope);
  return { scope, attributes, timers, render: () => scope.renderCreationMarketingBatchConfig() };
}

test("batch marketing has an explicit enable button and defaults to off", () => {
  assert.match(app, /marketingBatchEnabled:\s*false/);
  assert.match(html, /id="creationMarketingBatchToggle"[^>]*aria-pressed="false"[^>]*>开启<\/button>/);
  const view = createBatchConfigHarness();
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchConfig.hidden, true);
  assert.equal(view.scope.refs.creationMarketingBatchToggle.textContent, "开启");
  assert.equal(view.attributes["aria-pressed"], "false");
  assert.equal(view.scope.refs.creationMarketingBatchStartButton.disabled, true);
  assert.equal(view.scope.refs.creationMarketingBatchContinueButton.disabled, true);
  view.scope.state.creation.marketingBatchEnabled = true;
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchConfig.hidden, false);
  assert.equal(view.scope.refs.creationMarketingBatchToggle.textContent, "关闭");
  assert.equal(view.attributes["aria-pressed"], "true");
  assert.equal(view.attributes["aria-expanded"], "true");
  assert.equal(view.scope.refs.creationMarketingBatchStartButton.disabled, false);
  view.scope.aiMarketing = false;
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchPanel.hidden, true);
  assert.equal(view.scope.state.creation.marketingBatchEnabled, false);
  assert.equal(view.attributes["aria-pressed"], "false");
  view.scope.aiMarketing = true;
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchConfig.hidden, true);
});

test("batch estimate multiplies images per set, scheme count and copies and updates every factor", () => {
  const view = createBatchConfigHarness({ enabled: true });
  for (const [images, count, copies, total, suites] of [[20, 10, 2, 400, 20], [5, 10, 2, 100, 20], [5, 3, 2, 30, 6], [5, 3, 4, 60, 12], [0, 3, 4, 0, 12], [20, 20, 20, 8000, 400]]) {
    view.scope.imageCount = images;
    view.scope.refs.creationMarketingBatchCountInput.value = String(count);
    view.scope.refs.creationMarketingBatchCopiesInput.value = String(copies);
    view.render();
    const estimate = view.scope.refs.creationMarketingBatchEstimate.textContent;
    assert.match(estimate, new RegExp(`${total} 张营销图片`));
    assert.match(estimate, new RegExp(`${images} × ${count} × ${copies}`));
    assert.match(estimate, new RegExp(`预计加入队列：${suites} 套`));
  }
});

test("batch switch is protected during startup and execution", () => {
  const view = createBatchConfigHarness({ enabled: true });
  view.scope.creationMarketingBatchStarting = true;
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchToggle.disabled, true);
  view.scope.creationMarketingBatchStarting = false;
  view.scope.state.creation.marketingBatch = { status: "running", schemes: [] };
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchToggle.disabled, true);
  assert.equal(view.scope.refs.creationMarketingBatchCancelButton.hidden, false);
});

test("an active batch can be shown again after toggling AI marketing off and on", () => {
  const view = createBatchConfigHarness({ enabled: true });
  view.scope.state.creation.marketingBatch = { status: "running", schemes: [] };
  view.scope.aiMarketing = false;
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchPanel.hidden, true);
  view.scope.aiMarketing = true;
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchToggle.disabled, false);
  assert.equal(view.scope.refs.creationMarketingBatchStartButton.disabled, true);
  view.scope.state.creation.marketingBatchEnabled = true;
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchCancelButton.hidden, false);
  assert.equal(view.scope.refs.creationMarketingBatchToggle.disabled, true);
});

test("continue, pause and stop stay visible with state-appropriate availability", () => {
  const view = createBatchConfigHarness({ enabled: true });
  const batch = createCreationMarketingBatchState({ count: 10, copiesPerScheme: 2 });
  view.scope.state.creation.marketingBatch = batch;
  for (const [status, canContinue, canPause] of [["running", false, true], ["pausing", false, false], ["paused", true, false]]) {
    batch.status = status;
    view.render();
    for (const name of ["Continue", "Pause", "Cancel"]) assert.equal(view.scope.refs[`creationMarketingBatch${name}Button`].hidden, false);
    assert.equal(view.scope.refs.creationMarketingBatchContinueButton.disabled, !canContinue);
    assert.equal(view.scope.refs.creationMarketingBatchPauseButton.disabled, !canPause);
    assert.equal(view.scope.refs.creationMarketingBatchCancelButton.disabled, false);
    assert.equal(view.scope.refs.creationMarketingBatchStartButton.hidden, true);
  }
  for (const status of ["completed", "canceled"]) {
    batch.status = status;
    view.render();
    assert.equal(view.scope.refs.creationMarketingBatchStartButton.hidden, false);
    for (const name of ["Continue", "Pause", "Cancel"]) assert.equal(view.scope.refs[`creationMarketingBatch${name}Button`].hidden, true);
  }
});

test("paused batches keep frozen quantities and cannot continue before draining", () => {
  const view = createBatchConfigHarness({ enabled: true });
  const batch = createCreationMarketingBatchState({ count: 10, copiesPerScheme: 2 });
  Object.assign(batch, { status: "paused", pauseReason: "user", requestedImageCount: 20 });
  view.scope.state.creation.marketingBatch = batch;
  view.scope.imageCount = 5;
  view.scope.refs.creationMarketingBatchCountInput.value = "3";
  view.scope.refs.creationMarketingBatchCopiesInput.value = "4";
  view.render();
  assert.match(view.scope.refs.creationMarketingBatchEstimate.textContent, /400 张营销图片（20 × 10 × 2）/);
  assert.equal(view.scope.refs.creationMarketingBatchCountInput.value, "10");
  assert.equal(view.scope.refs.creationMarketingBatchCopiesInput.value, "2");
  assert.equal(view.scope.refs.creationMarketingBatchCountInput.disabled, true);
  assert.equal(view.scope.refs.creationMarketingBatchCopiesInput.disabled, true);
  assert.match(view.scope.refs.creationMarketingBatchStatus.textContent, /已暂停后续/);
  view.scope.creationMarketingBatchStarting = true;
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchContinueButton.disabled, true);
  assert.equal(view.scope.refs.creationMarketingBatchCancelButton.disabled, false);
});

test("batch status only counts schemes and never expands long errors or progress", () => {
  const view = createBatchConfigHarness({ enabled: true });
  const batch = createCreationMarketingBatchState({ count: 20, copiesPerScheme: 2 });
  const longError = "AI 第 1 条缺少完整提示词，请重新规划。".repeat(20);
  Object.assign(batch, { status: "running", completedCount: 5, enqueuedCount: 10, retryCount: 4, activeIndexes: [7, 8] });
  for (const scheme of batch.schemes.slice(0, 5)) Object.assign(scheme, { status: "enqueued", enqueuedCount: 2 });
  for (const scheme of batch.schemes.slice(5, 7)) Object.assign(scheme, { status: "failed", error: longError });
  Object.assign(batch.schemes[7], { status: "planning", marketingProgress: { message: longError } });
  batch.schemes[8].status = "retrying";
  view.scope.state.creation.marketingBatch = batch;
  view.render();
  const status = view.scope.refs.creationMarketingBatchStatus.textContent;
  assert.match(status, /已处理 7\/20/);
  assert.match(status, /成功 5/);
  assert.match(status, /失败 2/);
  assert.match(status, /进行中 2/);
  assert.match(status, /待处理 11/);
  assert.match(status, /已入队 10\/40/);
  assert.match(status, /重试 4 次/);
  assert.doesNotMatch(status, /缺少完整提示词|方案 \d+：|当前方案/);
  assert.equal(status.split("\n").length, 3);
  assert.ok(status.length < 160);
  Object.assign(batch, { status: "completed", completedCount: 18, enqueuedCount: 36, activeIndexes: [] });
  for (const scheme of batch.schemes.slice(7)) Object.assign(scheme, { status: "enqueued", enqueuedCount: 2 });
  view.render();
  assert.match(view.scope.refs.creationMarketingBatchStatus.textContent, /已结束（有失败）/);
  assert.match(view.scope.refs.creationMarketingBatchStatus.textContent, /已处理 20\/20/);
  assert.match(view.scope.refs.creationMarketingBatchStatus.textContent, /成功 18 · 失败 2/);
});

test("all-failed batches and stopped batches retain compact and honest totals", () => {
  const view = createBatchConfigHarness({ enabled: true });
  const batch = createCreationMarketingBatchState({ count: 20 });
  Object.assign(batch, { status: "completed", retryCount: 40 });
  for (const scheme of batch.schemes) Object.assign(scheme, { status: "failed", error: "缺少完整提示词".repeat(200) });
  view.scope.state.creation.marketingBatch = batch;
  view.render();
  let status = view.scope.refs.creationMarketingBatchStatus.textContent;
  assert.match(status, /已结束（有失败） · 已处理 20\/20/);
  assert.match(status, /成功 0 · 失败 20 · 进行中 0\/2 · 待处理 0/);
  assert.equal(status.split("\n").length, 3);
  Object.assign(batch, { status: "paused", error: "缺少完整提示词".repeat(200) });
  batch.schemes[19].status = "paused";
  view.render();
  status = view.scope.refs.creationMarketingBatchStatus.textContent;
  assert.equal(status.split("\n").length, 4);
  assert.doesNotMatch(status, /缺少完整提示词/);
  batch.status = "canceled";
  batch.schemes[19].status = "canceled";
  view.render();
  status = view.scope.refs.creationMarketingBatchStatus.textContent;
  assert.match(status, /失败 19/);
  assert.match(status, /已停止 1/);
  assert.equal(status.split("\n").length, 4);
});

test("scheme and batch clocks update without progress events and completed durations stay fixed", (t) => {
  let now = Date.parse("2026-10-31T02:00:00Z");
  t.mock.method(Date, "now", () => now);
  const view = createBatchConfigHarness({ enabled: true });
  const batch = createCreationMarketingBatchState({ count: 3 });
  Object.assign(batch, { status: "running", startedAt: new Date(now).toISOString(), timingStartedAt: new Date(now).toISOString() });
  Object.assign(batch.schemes[0], { status: "enqueued", startedAt: batch.startedAt, finishedAt: batch.startedAt, elapsedMs: 3000 });
  Object.assign(batch.schemes[1], { status: "planning", startedAt: batch.startedAt, timingStartedAt: batch.startedAt });
  view.scope.state.creation.marketingBatch = batch;
  view.render();
  const summary = view.scope.refs.creationMarketingBatchStatus.textContent;
  assert.equal(view.timers.size, 1);
  const timer = [...view.timers.values()][0];
  assert.equal(timer.milliseconds, 1000);
  assert.match(view.scope.refs.creationMarketingBatchTiming.textContent, /^方案 2 · 进行中 · 已用时 00:00/);
  assert.doesNotMatch(view.scope.refs.creationMarketingBatchTiming.textContent, /方案 3/);
  now += 65000;
  timer.callback();
  assert.equal(view.scope.refs.creationMarketingBatchElapsed.textContent, "整批规划已用时 01:05");
  assert.match(view.scope.refs.creationMarketingBatchTiming.textContent, /方案 1 · 入队完成 · 总耗时 00:03/);
  assert.match(view.scope.refs.creationMarketingBatchTiming.textContent, /方案 2 · 进行中 · 已用时 01:05/);
  assert.equal(view.scope.refs.creationMarketingBatchStatus.textContent, summary, "clock ticks only update timing text");
  Object.assign(batch, { status: "completed", timingStartedAt: "", elapsedMs: 65000, finishedAt: new Date(now).toISOString() });
  Object.assign(batch.schemes[1], { status: "enqueued", timingStartedAt: "", elapsedMs: 65000, finishedAt: batch.finishedAt });
  view.render();
  assert.equal(view.timers.size, 0);
  const completedTiming = view.scope.refs.creationMarketingBatchTiming.textContent;
  now += 3600000;
  view.render();
  assert.equal(view.scope.refs.creationMarketingBatchElapsed.textContent, "整批规划总耗时 01:05");
  assert.equal(view.scope.refs.creationMarketingBatchTiming.textContent, completedTiming);
  assert.equal(view.scope.formatCreationMarketingBatchElapsed({ elapsedMs: 3661000 }), "1:01:01");
});

test("clock lifecycle keeps a single interval and cleans it on pause, stop and hidden controls", () => {
  const view = createBatchConfigHarness({ enabled: true });
  const batch = createCreationMarketingBatchState();
  Object.assign(batch, { status: "running", startedAt: new Date().toISOString(), timingStartedAt: new Date().toISOString() });
  view.scope.state.creation.marketingBatch = batch;
  view.render();
  view.render();
  assert.equal(view.timers.size, 1);
  batch.status = "pausing";
  view.render();
  assert.equal(view.timers.size, 1, "in-flight requests still count while draining");
  batch.status = "paused";
  view.render();
  assert.equal(view.timers.size, 0);
  batch.status = "running";
  view.render();
  assert.equal(view.timers.size, 1);
  view.scope.state.creation.marketingBatchEnabled = false;
  view.render();
  assert.equal(view.timers.size, 0);
  assert.equal(view.scope.refs.creationMarketingBatchTiming.hidden, true);
  view.scope.state.creation.marketingBatchEnabled = true;
  view.render();
  assert.equal(view.timers.size, 1);
  view.scope.aiMarketing = false;
  view.render();
  assert.equal(view.timers.size, 0);
  view.scope.aiMarketing = true;
  view.scope.state.creation.marketingBatchEnabled = true;
  view.render();
  assert.equal(view.timers.size, 1);
  batch.status = "canceled";
  view.render();
  assert.equal(view.timers.size, 0);
});

test("timing rows remain bounded and avoid per-second live announcements", () => {
  assert.match(html, /id="creationMarketingBatchElapsed"[^>]*aria-live="off"/);
  assert.match(html, /id="creationMarketingBatchTiming"[^>]*aria-live="off"/);
  assert.match(styles, /\.creation-marketing-batch-timing\s*\{[^}]*max-height:\s*132px[^}]*overflow-y:\s*auto/);
});
