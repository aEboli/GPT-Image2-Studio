import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { runWithConcurrency } from "../lib/limited-concurrency.mjs";

const START_SPACING_TOLERANCE_MS = 220;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForStartCount(started, count, timeoutMs = 1_000) {
  const deadline = performance.now() + timeoutMs;
  while (started.length < count && performance.now() < deadline) {
    await wait(5);
  }
  assert.equal(started.length, count);
}

function releaseStartedTasks(releaseCallbacks) {
  while (releaseCallbacks.length > 0) {
    releaseCallbacks.shift()();
  }
}

test("limited concurrency staggers task starts before filling the configured limit", async () => {
  const started = [];
  const startTimes = [];
  const releaseByItem = new Map();

  const runPromise = runWithConcurrency(["a", "b", "c"], 2, async (item) => {
    started.push(item);
    startTimes.push(performance.now());
    await new Promise((resolve) => {
      releaseByItem.set(item, resolve);
    });
    return item.toUpperCase();
  });

  await waitForStartCount(started, 1);
  assert.deepEqual(started, ["a"]);

  await waitForStartCount(started, 2);
  assert.ok(startTimes[1] - startTimes[0] >= START_SPACING_TOLERANCE_MS);

  releaseByItem.get("a")();
  await waitForStartCount(started, 3);
  assert.deepEqual(started, ["a", "b", "c"]);
  assert.ok(startTimes[2] - startTimes[1] >= START_SPACING_TOLERANCE_MS);

  releaseByItem.get("b")();
  releaseByItem.get("c")();
  assert.deepEqual(await runPromise, ["A", "B", "C"]);
});

test("limited concurrency caps worker starts at fifteen active tasks", async () => {
  const items = Array.from({ length: 17 }, (_, index) => index + 1);
  const started = [];
  const releaseCallbacks = [];
  let activeCount = 0;
  let maxActiveCount = 0;

  const runPromise = runWithConcurrency(items, 99, async (item) => {
    activeCount += 1;
    maxActiveCount = Math.max(maxActiveCount, activeCount);
    started.push(item);
    await new Promise((resolve) => {
      releaseCallbacks.push(() => {
        activeCount -= 1;
        resolve();
      });
    });
    return item;
  });

  await waitForStartCount(started, 15, 5_000);
  assert.deepEqual(started, items.slice(0, 15));

  await wait(300);
  assert.equal(started.length, 15);

  releaseCallbacks.shift()();
  await waitForStartCount(started, 16);
  assert.equal(maxActiveCount, 15);

  releaseStartedTasks(releaseCallbacks);
  await waitForStartCount(started, 17);
  releaseStartedTasks(releaseCallbacks);
  assert.deepEqual(await runPromise, items);
});
