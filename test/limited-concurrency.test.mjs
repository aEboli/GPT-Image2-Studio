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

test("aborting the fan-out stops further upstream work but still visits each item", async () => {
  const upstreamCalls = [];
  const visited = [];

  // Every remaining item still runs its worker once, so each can report its own
  // failure through the caller's existing path; none of them calls upstream.
  await runWithConcurrency([1, 2, 3, 4, 5], 2, async (item, index, controls) => {
    visited.push(item);
    if (controls.getAbortReason()) {
      return `skipped-${item}`;
    }

    upstreamCalls.push(item);
    if (item === 2) {
      controls.abortRemaining("生成请求失败：HTTP 402，错误码 insufficient_quota");
    }
    return item;
  }, { startDelayMs: 0 });

  assert.deepEqual(visited, [1, 2, 3, 4, 5]);
  // 1 and 2 were already in flight; nothing after the abort reached upstream.
  assert.deepEqual(upstreamCalls, [1, 2]);
});

test("the first abort reason wins and repeat aborts are idempotent", async () => {
  const reasons = [];

  await runWithConcurrency([1, 2, 3], 3, async (item, index, controls) => {
    if (item === 1) {
      controls.abortRemaining("first reason");
      controls.abortRemaining("second reason");
      // A blank reason must not clear an established one.
      controls.abortRemaining("");
    }
    reasons.push(controls.getAbortReason());
    return item;
  }, { startDelayMs: 0 });

  assert.deepEqual(reasons, ["first reason", "first reason", "first reason"]);
});

test("an aborted fan-out refuses requeues", async () => {
  const started = [];

  await runWithConcurrency(["a"], 2, async (item, index, controls) => {
    started.push(item);
    controls.abortRemaining("fatal");
    // Requeueing into a queue that will never send anything upstream is pointless.
    assert.equal(controls.enqueue("a-retry"), false);
    return item;
  }, { startDelayMs: 0 });

  assert.deepEqual(started, ["a"]);
});

test("an aborted fan-out stops waiting out the submit interval", async () => {
  const started = [];
  const startDelayMs = 800;
  const itemCount = 6;
  const startedAt = performance.now();

  await runWithConcurrency(Array.from({ length: itemCount }, (_, index) => index + 1), 1, async (item, index, controls) => {
    started.push(item);
    if (item === 1) {
      controls.abortRemaining("fatal");
    }
    return item;
  }, { startDelayMs });

  const elapsed = performance.now() - startedAt;
  assert.equal(started.length, itemCount);
  // Without the skip these five remaining items would each wait out 800ms.
  assert.ok(
    elapsed < startDelayMs * 2,
    `aborted items must not each wait a submit interval, took ${Math.round(elapsed)}ms`,
  );
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
