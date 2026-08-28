import assert from "node:assert/strict";
import test from "node:test";

import {
  IN_RUN_MAX_RETRIES,
  buildRetryTaskId,
  createInRunRetryLedger,
  getRequeueNotice,
} from "../lib/generation-item-retry.mjs";
import { runWithConcurrency } from "../lib/limited-concurrency.mjs";

test("in-run retry ledger allows one retry per item by default", () => {
  const ledger = createInRunRetryLedger();

  assert.equal(ledger.maxRetries, IN_RUN_MAX_RETRIES);
  assert.equal(ledger.canRequeue("item-1"), true);
  assert.equal(ledger.claimRetry("item-1"), 1);
  assert.equal(ledger.canRequeue("item-1"), false);
  assert.equal(ledger.claimRetry("item-1"), 0);
});

test("in-run retry ledger tracks allowance per item", () => {
  const ledger = createInRunRetryLedger();

  assert.equal(ledger.claimRetry("item-1"), 1);
  assert.equal(ledger.canRequeue("item-2"), true);
  assert.equal(ledger.claimRetry("item-2"), 1);
  assert.equal(ledger.getRetryCount("item-1"), 1);
  assert.equal(ledger.getRetryCount("item-3"), 0);
});

test("retry task ids stay distinct per attempt so slot release cannot cross wires", () => {
  const ledger = createInRunRetryLedger({ maxRetries: 2 });

  assert.equal(ledger.getTaskId("set-1-item-1", "item-1"), "set-1-item-1");
  ledger.claimRetry("item-1");
  assert.equal(ledger.getTaskId("set-1-item-1", "item-1"), "set-1-item-1-r1");
  ledger.claimRetry("item-1");
  assert.equal(ledger.getTaskId("set-1-item-1", "item-1"), "set-1-item-1-r2");
});

test("zero allowance disables in-run requeue entirely", () => {
  const ledger = createInRunRetryLedger({ maxRetries: 0 });

  assert.equal(ledger.canRequeue("item-1"), false);
  assert.equal(ledger.claimRetry("item-1"), 0);
});

test("retry task id ignores non-positive attempts", () => {
  assert.equal(buildRetryTaskId("task", 0), "task");
  assert.equal(buildRetryTaskId("task", -1), "task");
  assert.equal(buildRetryTaskId("task", "nope"), "task");
});

test("a failed item retries while its siblings are still in flight, at the queue tail", async () => {
  // Composes the real fan-out with the real ledger and mirrors the server's failure
  // branch, so this covers the behaviour the five handlers rely on: the retry must
  // not wait for the rest of the pass to finish.
  const ledger = createInRunRetryLedger();
  const started = [];
  const inFlight = new Set();
  const release = new Map();
  let retryStartedWhileSiblingsInFlight = null;

  await runWithConcurrency([1, 2, 3, 4, 5], 5, async (item, index, controls) => {
    started.push(item);

    if (item === 2 && ledger.canRequeue("item-2")) {
      // The server marks the item queued and pushes it back on failure.
      assert.equal(ledger.claimRetry("item-2"), 1);
      assert.equal(controls.enqueue("2-retry"), true);
      return "requeued";
    }

    if (item === "2-retry") {
      retryStartedWhileSiblingsInFlight = [...inFlight].sort();
      // Let the siblings finish now that the retry has been observed running
      // alongside them; releasing after the fan-out returns would deadlock it.
      for (const releaseSibling of release.values()) {
        releaseSibling();
      }
      return "retried";
    }

    inFlight.add(item);
    await new Promise((resolve) => {
      release.set(item, () => {
        inFlight.delete(item);
        resolve();
      });
    });
    return item;
  }, { startDelayMs: 0 });

  // The retry ran as the sixth task, after everything already queued.
  assert.deepEqual(started, [1, 2, 3, 4, 5, "2-retry"]);
  // And it ran while every sibling was still generating, not after the pass drained.
  assert.deepEqual(retryStartedWhileSiblingsInFlight, [1, 3, 4, 5]);
  assert.equal(inFlight.size, 0);
});

test("requeue notice keeps the failure reason and the attempt count", () => {
  assert.equal(
    getRequeueNotice({ message: "上游返回 429", attempt: 1, maxRetries: 1 }),
    "上游返回 429，正在重排队重试 1/1。",
  );
  assert.equal(getRequeueNotice({ attempt: 1, maxRetries: 1 }), "生成失败，正在重排队重试 1/1。");
});
