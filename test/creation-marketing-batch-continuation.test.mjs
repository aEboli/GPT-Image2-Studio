import assert from "node:assert/strict";
import test from "node:test";
import {
  CREATION_MARKETING_BATCH_MAX_RETRIES,
  canContinueCreationMarketingBatch,
  createCreationMarketingBatchState,
  runCreationMarketingBatch,
} from "../lib/creation-marketing-batch.mjs";

test("all twenty schemes are processed despite long invalid-plan errors", async () => {
  const state = createCreationMarketingBatchState({ count: 20, copiesPerScheme: 2 });
  const started = [], queued = [], statuses = [];
  const error = Array.from({ length: 20 }, (_, index) => `AI 第 ${index + 1} 条缺少完整提示词，请重新规划。`).join("；");
  await runCreationMarketingBatch({ state, wait: async () => {},
    generatePlan: async ({ scheme }) => {
      started.push(scheme.index);
      if ([6, 7].includes(scheme.index)) throw new Error(error);
      return { index: scheme.index };
    },
    enqueuePlan: async ({ scheme, copyNumber }) => {
      const id = `${scheme.index}-${copyNumber}`;
      queued.push(id);
      return { id };
    },
    onUpdate: (snapshot) => statuses.push(snapshot.status),
  });
  assert.deepEqual(started, Array.from({ length: 20 }, (_, index) => index + 1));
  assert.equal(state.status, "completed");
  assert.equal(state.pauseReason, "");
  assert.equal(state.completedCount, 18);
  assert.equal(state.enqueuedCount, 36);
  assert.equal(new Set(queued).size, 36);
  assert.equal(state.schemes.filter((scheme) => scheme.status === "failed").length, 2);
  assert.equal(state.schemes[5].error, error);
  assert.ok(state.schemes.every((scheme) => ["enqueued", "failed"].includes(scheme.status)));
  assert.ok(statuses.every((status) => ["running", "completed"].includes(status)));
  assert.equal(canContinueCreationMarketingBatch(state), false);
});

test("exhausted transient retries process every scheme and finish with failures", async () => {
  const state = createCreationMarketingBatchState({ count: 5 });
  const attempts = new Map();
  await runCreationMarketingBatch({ state, wait: async () => {},
    generatePlan: async ({ scheme }) => {
      attempts.set(scheme.index, (attempts.get(scheme.index) || 0) + 1);
      throw new Error("HTTP 503 service unavailable");
    },
    enqueuePlan: () => assert.fail("invalid plans must not be queued"),
  });
  assert.equal(attempts.size, 5);
  assert.ok([...attempts.values()].every((count) => count === CREATION_MARKETING_BATCH_MAX_RETRIES + 1));
  assert.equal(state.retryCount, 5 * CREATION_MARKETING_BATCH_MAX_RETRIES);
  assert.equal(state.status, "completed");
  assert.equal(state.completedCount, 0);
  assert.equal(state.enqueuedCount, 0);
  assert.ok(state.schemes.every((scheme) => scheme.status === "failed"));
});
