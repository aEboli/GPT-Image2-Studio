import assert from "node:assert/strict";
import test from "node:test";

import {
  CREATION_MARKETING_BATCH_MAX_RETRIES,
  createCreationMarketingBatchState,
  getCreationMarketingBatchRetryPlan,
  cancelPendingCreationMarketingBatch,
  normalizeCreationMarketingBatchCopies,
  runCreationMarketingBatch,
} from "../lib/creation-marketing-batch.mjs";

test("batch state stores scheme counts and one variation seed per scheme", () => {
  const state = createCreationMarketingBatchState({ count: 3, copiesPerScheme: 2 });

  assert.equal(state.total, 3);
  assert.equal(state.copiesPerScheme, 2);
  assert.deepEqual(state.schemes.map((scheme) => scheme.targetCount), [2, 2, 2]);
  assert.equal(state.schemes[2].variationSeed, `${state.batchId}-3`);
  assert.equal("supplement" in state.schemes[0], false);
  assert.equal("commonSupplement" in state, false);
});

test("batch normalizes the per-scheme generation count and computes the queue target", () => {
  assert.equal(normalizeCreationMarketingBatchCopies(0), 1);
  assert.equal(normalizeCreationMarketingBatchCopies(3), 3);
  assert.equal(normalizeCreationMarketingBatchCopies(99), 20);
  const state = createCreationMarketingBatchState({ count: 3, copiesPerScheme: 2 });
  assert.equal(state.targetQueueCount, 6);
  assert.deepEqual(state.schemes.map((scheme) => scheme.targetCount), [2, 2, 2]);
});

test("batch retry plan only retries transient failures within the bounded budget", () => {
  const retry = getCreationMarketingBatchRetryPlan({ error: "HTTP 503 service unavailable", retryCount: 0 });
  assert.equal(retry.retryable, true);
  assert.equal(retry.shouldRetry, true);
  assert.equal(retry.nextRetryCount, 1);
  assert.equal(retry.delayMs, 5000);

  const exhausted = getCreationMarketingBatchRetryPlan({ error: "timeout", retryCount: CREATION_MARKETING_BATCH_MAX_RETRIES });
  assert.equal(exhausted.shouldRetry, false);

  const quota = getCreationMarketingBatchRetryPlan({ error: "HTTP 402 insufficient_quota", retryCount: 0 });
  assert.equal(quota.retryable, false);
});

test("batch plans two schemes together and keeps copy order within each scheme", async () => {
  const state = createCreationMarketingBatchState({ count: 3, copiesPerScheme: 2, batchId: "batch-test" });
  const events = [];
  const queued = [];

  await runCreationMarketingBatch({
    state,
    wait: async () => {},
    generatePlan: async ({ scheme }) => {
      events.push(`plan-${scheme.index}`);
      return { plan: { index: scheme.index } };
    },
    enqueuePlan: async ({ scheme, copyNumber }) => {
      events.push(`queue-${scheme.index}-${copyNumber}`);
      queued.push([scheme.index, copyNumber]);
      return { id: `job-${scheme.index}-${copyNumber}`, set: { setId: `set-${scheme.index}-${copyNumber}` } };
    },
  });

  assert.deepEqual(events.slice(0, 2), ["plan-1", "plan-2"]);
  for (const index of [1, 2, 3]) {
    assert.equal(events.filter((event) => event === `plan-${index}`).length, 1);
    assert.deepEqual(queued.filter(([scheme]) => scheme === index), [[index, 1], [index, 2]]);
  }
  assert.equal(state.status, "completed");
  assert.equal(state.enqueuedCount, 6);
  assert.equal(state.completedCount, 3);
});

test("batch fails exhausted schemes and continues through the whole batch", async () => {
  const state = createCreationMarketingBatchState({ count: 3, batchId: "batch-pause" });
  let calls = 0;

  await runCreationMarketingBatch({
    state,
    wait: async () => {},
    generatePlan: async () => {
      calls += 1;
      throw new Error("timeout");
    },
    enqueuePlan: async () => ({ id: "never" }),
  });

  assert.equal(calls, (CREATION_MARKETING_BATCH_MAX_RETRIES + 1) * 3);
  assert.equal(state.status, "completed");
  assert.ok(state.schemes.every((scheme) => scheme.status === "failed"));
  assert.equal(state.completedCount, 0);
});

test("a queue failure preserves queued copies and continues other schemes without duplicates", async () => {
  const state = createCreationMarketingBatchState({ count: 3, copiesPerScheme: 2, batchId: "batch-queue-failure" });
  let planningCalls = 0;
  const queued = [];

  await runCreationMarketingBatch({
    state,
    wait: async () => {},
    generatePlan: async () => {
      planningCalls += 1;
      return { frozen: true };
    },
    enqueuePlan: async ({ scheme, copyNumber }) => {
      if (scheme.index === 1 && copyNumber === 2) throw new Error("queue unavailable");
      const id = `job-${scheme.index}-${copyNumber}`;
      queued.push(id);
      return { id, set: { setId: `set-${scheme.index}-${copyNumber}` } };
    },
  });

  assert.equal(state.status, "completed");
  assert.equal(state.completedCount, 2);
  assert.equal(state.enqueuedCount, 5);
  assert.equal(state.schemes[0].status, "failed");
  assert.equal(state.schemes[0].error, "queue unavailable");
  assert.equal(new Set(queued).size, 5);
  await runCreationMarketingBatch({
    state,
    wait: async () => {},
    generatePlan: async () => {
      planningCalls += 1;
      return { shouldNotRun: true };
    },
    enqueuePlan: async ({ copyNumber }) => ({ id: `job-recovered-${copyNumber}`, set: { setId: `set-recovered-${copyNumber}` } }),
  });

  assert.equal(planningCalls, 3);
  assert.equal(state.status, "completed");
  assert.equal(state.enqueuedCount, 5);
  assert.deepEqual(state.schemes[0].queueJobIds, ["job-1-1"]);
});

test("canceling remaining schemes does not enqueue a plan that finishes after cancellation", async () => {
  const state = createCreationMarketingBatchState({ count: 2, batchId: "batch-cancel" });
  let releasePlan;
  const pendingPlan = new Promise((resolve) => { releasePlan = resolve; });
  const run = runCreationMarketingBatch({
    state,
    wait: async () => {},
    generatePlan: async () => pendingPlan,
    enqueuePlan: async () => { throw new Error("must not enqueue after cancellation"); },
  });

  await new Promise((resolve) => setImmediate(resolve));
  cancelPendingCreationMarketingBatch(state);
  releasePlan({ frozen: true });
  await run;

  assert.equal(state.status, "canceled");
  assert.equal(state.enqueuedCount, 0);
  assert.equal(state.schemes[0].status, "canceled");
  assert.equal(state.schemes[1].status, "canceled");
});

test("canceling during a scheme only preserves copies already added to the queue", async () => {
  const state = createCreationMarketingBatchState({ count: 2, copiesPerScheme: 2, batchId: "batch-cancel-copy" });
  const queued = [];

  await runCreationMarketingBatch({
    state,
    wait: async () => {},
    generatePlan: async ({ scheme }) => ({ plan: { index: scheme.index } }),
    enqueuePlan: async ({ scheme, copyNumber }) => {
      queued.push([scheme.index, copyNumber]);
      return { id: `job-${scheme.index}-${copyNumber}` };
    },
    onUpdate: (snapshot) => {
      const firstScheme = snapshot.schemes[0];
      if (snapshot.status === "running" && firstScheme.status === "enqueuing" && firstScheme.enqueuedCount === 1) {
        cancelPendingCreationMarketingBatch(state);
      }
    },
  });

  assert.deepEqual(queued, [[1, 1], [2, 1]]);
  assert.equal(state.enqueuedCount, 2);
  assert.equal(state.status, "canceled");
  assert.equal(state.schemes[0].status, "canceled");
  assert.equal(state.schemes[1].status, "canceled");
});
