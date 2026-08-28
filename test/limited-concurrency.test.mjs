import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import test from "node:test";

import { runWithConcurrency } from "../lib/limited-concurrency.mjs";
import { MAX_GENERATION_CONCURRENCY } from "../lib/studio-constants.mjs";

const START_SPACING_TOLERANCE_MS = 700;

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function waitForStartCount(started, count, timeoutMs = 3_000) {
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

test("limited concurrency runs items enqueued during the run", async () => {
  const started = [];

  const results = await runWithConcurrency(["a", "b"], 2, async (item, index, controls) => {
    started.push(item);
    if (item === "a") {
      assert.equal(controls.enqueue("a-retry"), true);
    }
    return item.toUpperCase();
  }, { startDelayMs: 0 });

  assert.deepEqual(started, ["a", "b", "a-retry"]);
  assert.deepEqual(results, ["A", "B", "A-RETRY"]);
});

test("an item enqueued at the tail runs after every already queued item", async () => {
  const started = [];

  await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item, index, controls) => {
    started.push(item);
    if (item === 2) {
      controls.enqueue(6);
    }
    return item;
  }, { startDelayMs: 0 });

  assert.deepEqual(started, [1, 2, 3, 4, 5, 6]);
});

test("the last running worker still picks up its own enqueued retry", async () => {
  const started = [];

  await runWithConcurrency(["only"], 4, async (item, index, controls) => {
    started.push(item);
    if (started.length === 1) {
      assert.equal(controls.enqueue("only-retry"), true);
    }
    return item;
  }, { startDelayMs: 0 });

  assert.deepEqual(started, ["only", "only-retry"]);
});

test("enqueue is refused once the run has drained", async () => {
  let escapedControls = null;

  await runWithConcurrency(["a"], 1, async (item, index, controls) => {
    escapedControls = controls;
    return item;
  }, { startDelayMs: 0 });

  assert.equal(escapedControls.enqueue("late"), false);
});

test("enqueue is refused after a worker throws and the run unwinds", async () => {
  let escapedControls = null;

  await assert.rejects(
    runWithConcurrency(["a"], 1, async (item, index, controls) => {
      escapedControls = controls;
      throw new Error("boom");
    }, { startDelayMs: 0 }),
    /boom/,
  );

  assert.equal(escapedControls.enqueue("late"), false);
});

test("limited concurrency does not mutate the caller's item list", async () => {
  const items = ["a"];

  await runWithConcurrency(items, 1, async (item, index, controls) => {
    if (item === "a") {
      controls.enqueue("a-retry");
    }
    return item;
  }, { startDelayMs: 0 });

  assert.deepEqual(items, ["a"]);
});

// The backstop tracks the configurable concurrency maximum, so this asserts
// against the constant instead of a literal: raising the knob's ceiling must
// raise this too, or a legitimately configured fan-out would be clamped.
test("limited concurrency caps worker starts at the shared concurrency maximum", async () => {
  const cap = MAX_GENERATION_CONCURRENCY;
  const items = Array.from({ length: cap + 2 }, (_, index) => index + 1);
  const started = [];
  const releaseCallbacks = [];
  let activeCount = 0;
  let maxActiveCount = 0;

  const runPromise = runWithConcurrency(items, cap + 79, async (item) => {
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
  }, { startDelayMs: 0 });

  await waitForStartCount(started, cap, 25_000);
  assert.deepEqual(started, items.slice(0, cap));

  await wait(300);
  assert.equal(started.length, cap, "a limit above the maximum must not start more");

  releaseCallbacks.shift()();
  await waitForStartCount(started, cap + 1);
  assert.equal(maxActiveCount, cap);

  releaseStartedTasks(releaseCallbacks);
  await waitForStartCount(started, cap + 2);
  releaseStartedTasks(releaseCallbacks);
  assert.deepEqual(await runPromise, items);
});
