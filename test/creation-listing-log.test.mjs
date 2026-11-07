import assert from "node:assert/strict";
import test from "node:test";
import { recordCreationListingLog } from "../lib/creation-listing-log.mjs";
import { createGenerationLogStore, parseGenerationLogStore, serializeGenerationLogStore, summarizeGenerationLogGroup } from "../lib/generation-log-store.mjs";

test("Listing log keeps bounded phase metadata and excludes full responses and credentials", () => {
  let store = createGenerationLogStore();
  const base = { batchId: "batch-1", setId: "set-1", requestId: "request-1", attempt: 1, totalCount: 2 };
  for (const stage of ["queued", "waiting", "connected", "receiving", "received", "completed"]) {
    store = recordCreationListingLog(store, { ...base, stage, message: "Bearer hidden-secret sk-private", text: "PRIVATE FULL ANSWER", timing: { totalMs: 2500 }, usage: { inputTokens: 100, outputTokens: 30 }, apiKey: "PRIVATE KEY" }, { productName: "测试商品" });
  }
  const raw = JSON.stringify(serializeGenerationLogStore(store));
  assert.doesNotMatch(raw, /hidden-secret|sk-private|PRIVATE/);
  const group = parseGenerationLogStore(raw).channels.creation[0];
  assert.equal(group.groupUnit, "套");
  assert.equal(group.children[0].status, "done");
  assert.equal(group.children[0].listingEvents.length, 6);
  assert.equal(group.children[0].listingEvents.at(-1).requestId, "request-1");
  assert.equal(group.children[0].listingEvents.at(-1).usage.outputTokens, 30);
});

test("Listing token updates do not append an event for every delta or overwrite image groups", () => {
  let store = createGenerationLogStore();
  const event = { setId: "set-one", stage: "receiving", requestId: "one", attempt: 1 };
  for (let i = 0; i < 100; i += 1) store = recordCreationListingLog(store, { ...event, text: `delta-${i}`, elapsedMs: i });
  const child = store.channels.creation[0].children[0];
  assert.equal(child.listingEvents.length, 1);
  assert.equal(child.listingEvents[0].elapsedMs, 99);
  assert.equal(store.channels.creation[0].groupId, "listing:set-one");
});

test("stopped Listing batches do not leave unstarted items permanently running", () => {
  let store = recordCreationListingLog(createGenerationLogStore(), { batchId: "stopped", setId: "one", stage: "error", totalCount: 8 });
  store = recordCreationListingLog(store, { batchId: "stopped", stage: "batch-completed", totalCount: 8, failedCount: 1, generatedCount: 0, unstartedCount: 7 });
  const group = parseGenerationLogStore(JSON.stringify(serializeGenerationLogStore(store))).channels.creation[0];
  const summary = summarizeGenerationLogGroup(group);
  assert.equal(summary.runningCount, 0);
  assert.equal(summary.failedCount, 1);
  assert.equal(summary.unstartedCount, 7);
  assert.equal(summary.status, "error");
});

test("large Listing batches retain final counts after old child details are evicted", () => {
  let store = createGenerationLogStore();
  for (let index = 0; index < 40; index += 1) store = recordCreationListingLog(store, { batchId: "large", setId: `set-${index}`, stage: "completed", totalCount: 40 });
  store = recordCreationListingLog(store, { batchId: "large", stage: "batch-completed", totalCount: 40, generatedCount: 40, failedCount: 0, unstartedCount: 0 });
  assert.equal(store.channels.creation[0].children.length, 24);
  const summary = summarizeGenerationLogGroup(store.channels.creation[0]);
  assert.equal(summary.completedCount, 40);
  assert.equal(summary.runningCount, 0);
  assert.equal(summary.status, "done");
});

test("records filled before their worker starts are counted as skipped rather than still running", () => {
  let store = recordCreationListingLog(createGenerationLogStore(), { batchId: "skip", setId: "one", stage: "completed", totalCount: 3 });
  store = recordCreationListingLog(store, { batchId: "skip", stage: "batch-completed", totalCount: 3, generatedCount: 1, failedCount: 0, unstartedCount: 0, skippedCount: 2 });
  const summary = summarizeGenerationLogGroup(store.channels.creation[0]);
  assert.equal(summary.runningCount, 0);
  assert.equal(summary.skippedCount, 2);
  assert.equal(summary.status, "done");
});
