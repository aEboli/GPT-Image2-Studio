import assert from "node:assert/strict";
import test from "node:test";
import { createCreationMarketingBatchState, pausePendingCreationMarketingBatch, runCreationMarketingBatch } from "../lib/creation-marketing-batch.mjs";

test("one scheme with twenty suites plans independently with twenty different seeds", async () => {
  const state = createCreationMarketingBatchState({ count: 1, copiesPerScheme: 20 });
  const seeds = [], queued = [];
  await runCreationMarketingBatch({ state,
    generatePlan: async ({ variationSeed, copyNumber }) => {
      seeds.push(variationSeed);
      return { plan: { variationSeed, copyNumber } };
    },
    enqueuePlan: async ({ planResult, variationSeed, copyNumber }) => {
      assert.equal(planResult.plan.variationSeed, variationSeed);
      assert.equal(planResult.plan.copyNumber, copyNumber);
      queued.push(planResult.plan);
      return { id: `suite-${copyNumber}` };
    },
  });
  assert.equal(seeds.length, 20);
  assert.equal(new Set(seeds).size, 20);
  assert.ok(seeds.every(Boolean));
  assert.equal(queued.length, 20);
  assert.equal(state.status, "completed");
});

test("transient retries retain the current suite seed and the next suite changes it", async () => {
  const state = createCreationMarketingBatchState({ count: 1, copiesPerScheme: 2 });
  const seeds = [];
  await runCreationMarketingBatch({ state, wait: async () => {},
    generatePlan: async ({ variationSeed }) => {
      seeds.push(variationSeed);
      if (seeds.length === 1) throw new Error("HTTP 503 service unavailable");
      return { seed: variationSeed };
    },
    enqueuePlan: async ({ copyNumber }) => ({ id: `suite-${copyNumber}` }),
  });
  assert.equal(seeds.length, 3);
  assert.equal(seeds[0], seeds[1]);
  assert.notEqual(seeds[1], seeds[2]);
  assert.equal(state.retryCount, 1);
});

test("pause after a submitted suite releases its plan and resumes with a new one", async () => {
  const state = createCreationMarketingBatchState({ count: 1, copiesPerScheme: 3 });
  const seeds = [], queued = [];
  const generatePlan = async ({ variationSeed }) => { seeds.push(variationSeed); return { seed: variationSeed }; };
  const enqueuePlan = async ({ planResult, copyNumber }) => {
    queued.push(planResult.seed);
    if (copyNumber === 1) pausePendingCreationMarketingBatch(state);
    return { id: `suite-${copyNumber}` };
  };
  await runCreationMarketingBatch({ state, generatePlan, enqueuePlan });
  assert.equal(state.status, "paused");
  assert.equal(state.schemes[0].pendingPlan, null);
  await runCreationMarketingBatch({ state, generatePlan, enqueuePlan });
  assert.equal(seeds.length, 3);
  assert.equal(new Set(queued).size, 3);
  assert.equal(state.enqueuedCount, 3);
});
