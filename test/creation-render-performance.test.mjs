import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { createDeferredUpdate } from "../lib/deferred-update.mjs";
import { buildFinalImageChunkKey, CREATION_STREAM_EVENTS } from "../lib/generation-stream-protocol.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const between = (start, end) => {
  const from = app.indexOf(start);
  const to = app.indexOf(end, from + start.length);
  assert.ok(from >= 0 && to > from);
  return app.slice(from, to);
};

function fixture() {
  const jobs = Array.from({ length: 30 }, (_, index) => ({
    id: `queue-${index}`, set: { setId: `set-${index}`, items: Array.from({ length: 20 }, (_, item) => ({ itemId: `item-${item}`, status: "queued" })) },
  }));
  const creation = { generating: true, generationScope: "full", selectedQueueId: "queue-0", currentSet: jobs[0].set };
  const calls = { cards: [], heartbeats: [], full: 0, queues: 0, logs: 0 };
  const analystMeta = { textContent: "" };
  const selected = () => jobs.find((job) => job.id === creation.selectedQueueId);
  const context = {
    createDeferredUpdate, CREATION_STREAM_EVENTS, buildFinalImageChunkKey,
    document: { hidden: false }, state: { activeView: "creation", creation },
    refs: { creationResultGrid: {}, creationProgressText: {}, creationRepairFailedButton: {},
      creationRecordDetail: { querySelector: () => analystMeta } },
    syncGenerationSchedulingLock() {}, isCreationLogoBatchBranch: () => false,
    getSelectedCreationQueueJob: selected, getCreationDisplayedSet: () => selected()?.set,
    getCreationMarketingDisplayItems: (set) => set.items,
    getCreationProgressSummary: (set) => ({ total: set.items.length, completed: set.items.filter((item) => item.status === "completed").length }),
    getCreationIncompleteItems: (set) => set.items.filter((item) => item.status !== "completed"),
    canRepairCreationSet: () => true,
    renderCreationQueueStrip: () => { calls.queues += 1; },
    syncCreationResultGrid(items, options) { calls.cards.push({ status: items[0].status, imageUrl: items[0].imageUrl, scope: options.keyScope }); },
    beatCreationCardHeartbeat(grid, id) { assert.ok(calls.cards.length > 0); calls.heartbeats.push(id); },
    renderCreationView() { calls.full += 1; context.cancelProgress(); },
    updateCreationStreamItem(id, patch, { queueJob }) {
      Object.assign(queueJob.set.items.find((item) => item.itemId === id), patch);
    },
    shouldApplyCreationStreamItemUpdate: () => true,
    getCreationStreamCurrentSet: ({ queueJob }) => queueJob.set,
    upsertCreationSetForStream(set, { queueJob }) { queueJob.set = set; return set; },
    getCreationAutoRepairableItems: () => [], shouldAutoRepairCreationSet: () => false,
    setCreationFeedback() {}, recordCreationLogEvent() { calls.logs += 1; },
    hasHeartbeatPrefix: (text) => String(text || "").startsWith("心跳"),
    buildGenerationTaskActivityDetail: (value) => value.statusText || "",
    compactErrorMessage: (text) => text, nowIso: () => "2026-11-02T00:00:00Z",
    getImageUrl: (item) => item?.imageUrl || "", getCreationCompletionFeedback: () => ({ message: "已完成", tone: "success" }),
    shouldAutoGenerateCreationListings: () => false, runCreationAutoRepairIfNeeded: async () => false,
  };
  runInNewContext(between("const creationCardHeartbeats =", "function isCreationAiMarketingEnabled(") +
    between("async function handleCreationStreamEvent(", "async function runCreationStream(") +
    "this.cancelProgress = () => creationProgressUpdates.cancel();", context);
  return { context, creation, jobs, calls, send: (event, payload = {}, index = 0) => context.handleCreationStreamEvent(event, payload, { queueJob: jobs[index] }) };
}

test("600 interleaved image events coalesce and render the latest selected suite without a full refresh", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  for (let index = 0; index < 600; index += 1) {
    await f.send("item_status", { itemId: `item-${index % 20}`, message: `步骤 ${index}` }, Math.floor(index / 20));
  }
  await f.send("item_partial_image", { itemId: "item-0", dataUrl: "data:image/png;base64,newest" });
  assert.equal(f.jobs[29].set.items[19].status, "generating");
  assert.equal(f.calls.logs, 600);
  assert.equal(f.calls.full, 0);
  assert.equal(f.calls.cards.length, 0);
  t.mock.timers.tick(120);
  assert.equal(f.calls.cards.length, 1);
  assert.equal(f.calls.queues, 1);
  assert.equal(f.calls.cards[0].imageUrl, "data:image/png;base64,newest");
  assert.equal(f.calls.cards[0].scope, "queue-0");
  const progressRenderer = between("function renderCreationProgressView(", "function isCreationAiMarketingEnabled(");
  assert.doesNotMatch(progressRenderer, /renderCreationReferenceGrid|renderCreationRecordDetail|renderCreationListingDrafts|renderCreationPlatformPlan/);
});

test("saving and failing individual images render immediately without a later stale refresh", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.send("item_started", { itemId: "item-0" });
  await f.send("item_saved", { setId: "set-0", item: { itemId: "item-0", imageUrl: "/output/final.png" } });
  assert.equal(f.calls.cards.length, 1);
  assert.equal(f.calls.cards[0].status, "completed");
  assert.match(f.context.refs.creationRecordDetail.querySelector().textContent, /已完成 1\/20/);
  await f.send("item_failed", { itemId: "item-1", message: "生成失败" });
  assert.equal(f.calls.cards.length, 2);
  assert.equal(f.jobs[0].set.items[1].status, "failed");
  t.mock.timers.tick(1000);
  assert.equal(f.calls.cards.length, 2);
});

test("heartbeat is delivered after cards update and cannot cross suites with the same item id", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.send("item_status", { itemId: "item-0", message: "心跳：等待" }, 0);
  await f.send("item_status", { itemId: "item-0", message: "心跳：等待" }, 1);
  f.creation.selectedQueueId = "queue-1";
  t.mock.timers.tick(120);
  assert.equal(f.calls.cards[0].scope, "queue-1");
  assert.deepEqual(f.calls.heartbeats, ["item-0"]);
  await f.send("item_status", { itemId: "item-1", message: "心跳：等待" }, 0);
  t.mock.timers.tick(120);
  assert.deepEqual(f.calls.heartbeats, ["item-0"]);
});

test("suite completion cancels pending progress and hidden pages keep receiving data without rendering", async (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  const f = fixture();
  await f.send("item_started", { itemId: "item-0" });
  await f.send("complete", { set: f.jobs[0].set });
  assert.equal(f.calls.full, 1);
  t.mock.timers.tick(120);
  assert.equal(f.calls.cards.length, 0);
  f.context.document.hidden = true;
  await f.send("item_partial_image", { itemId: "item-0", dataUrl: "latest-hidden-preview" });
  t.mock.timers.tick(120);
  assert.equal(f.jobs[0].set.items[0].imageUrl, "latest-hidden-preview");
  assert.equal(f.calls.cards.length, 0);
  f.context.document.hidden = false;
  f.context.renderCreationProgressView();
  assert.equal(f.calls.cards[0].imageUrl, "latest-hidden-preview");
});

test("static card versions ignore prompt payloads but track image, failure and retry permissions", () => {
  let options;
  let repairEnabled = true;
  let repairChecks = 0;
  const context = {
    refs: { creationResultGrid: {} },
    syncCreationResultGridShell(value) { options = value; },
    getImageUrl: (item) => item.imageUrl || "",
    getCardThumbnailUrl: (item) => item.imageUrl || "",
    getCreationItemStatusLabel: (item) => item.status,
    shouldShowCreationCardLoading: (item) => item.status === "generating",
    isCacheableBrowserImageUrl: (url) => url.startsWith("data:"),
    shouldHideCreationCardDetails: () => false,
    canRepairCreationItem() { repairChecks += 1; return repairEnabled; },
    getCreationRepairButtonText: () => "重新生成",
  };
  runInNewContext(between("function syncCreationResultGrid(", "function getCreationRecordSearchText("), context);
  const item = { itemId: "static", status: "completed", imageUrl: "/final.png", title: "首图" };
  Object.defineProperty(item, "prompt", { enumerable: true, get() { throw Error("large prompt must not be serialized"); } });
  context.syncCreationResultGrid([item], { showActions: false });
  const before = options.getCardVersion(item, 0, {});
  assert.equal(repairChecks, 0);
  item.imageUrl = "/changed.png";
  assert.notEqual(options.getCardVersion(item, 0, {}), before);
  item.status = "failed";
  const failed = options.getCardVersion(item, 0, {});
  item.error = "失败原因变更";
  assert.notEqual(options.getCardVersion(item, 0, {}), failed);
  context.syncCreationResultGrid([item], { showActions: true });
  const enabled = options.getCardVersion(item, 0, {});
  repairEnabled = false;
  assert.notEqual(options.getCardVersion(item, 0, {}), enabled);
  item.imageUrl = "data:image/png;base64,preview";
  assert.equal(options.getCardVersion(item, 0, {}), "");
});

test("stream manifests update hidden records in memory and refresh records when that view is visible", () => {
  let renders = 0;
  const queueJob = { id: "queue", set: { setId: "set", items: [] } };
  const context = {
    state: { activeView: "creation", creation: { sets: [], currentSet: null } },
    getCreationPreviousSetForStream: () => queueJob.set,
    mergeCreationSetPreviews: (incoming) => incoming,
    normalizeCreationSetForView: (incoming) => incoming,
    shouldSyncCreationQueueJobCurrentSet: () => true,
    renderCreationRecordView() { renders += 1; },
  };
  runInNewContext(between("function upsertCreationSetForStream(", "function getCreationStreamCurrentSet("), context);
  const set = { setId: "set", items: [{ itemId: "one", status: "completed" }] };
  context.upsertCreationSetForStream(set, { queueJob });
  assert.equal(context.state.creation.sets[0], set);
  assert.equal(context.state.creation.currentSet, set);
  assert.equal(renders, 0);
  context.state.activeView = "creationRecord";
  context.upsertCreationSetForStream({ ...set, status: "completed" }, { queueJob });
  assert.equal(renders, 1);
});
