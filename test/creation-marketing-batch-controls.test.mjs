import assert from "node:assert/strict";
import test from "node:test";
import * as batch from "../lib/creation-marketing-batch.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}

test("manual pause drains both planning slots and resumes cached plans without duplicates", async () => {
  assert.equal(typeof batch.pausePendingCreationMarketingBatch, "function");
  const state = batch.createCreationMarketingBatchState({ count: 4, copiesPerScheme: 2 });
  const gates = [deferred(), deferred()];
  const calls = [], queued = [];
  const enqueuePlan = async ({ scheme, copyNumber }) => {
    const id = `${scheme.index}-${copyNumber}`; queued.push(id); return { id };
  };
  const run = batch.runCreationMarketingBatch({ state,
    generatePlan: ({ scheme }) => { calls.push(scheme.index); return gates[scheme.index - 1].promise; },
    enqueuePlan,
  });
  batch.pausePendingCreationMarketingBatch(state);
  assert.equal(state.status, "pausing");
  assert.equal(batch.canContinueCreationMarketingBatch(state), false);
  gates[1].resolve({ frozen: 2 });
  await tick();
  assert.equal(state.status, "pausing");
  assert.equal(batch.canContinueCreationMarketingBatch(state), false);
  gates[0].resolve({ frozen: 1 });
  await run;
  assert.equal(state.status, "paused");
  assert.equal(state.pauseReason, "user");
  assert.equal(state.error, "");
  assert.deepEqual(calls, [1, 2]);
  assert.deepEqual(queued, []);
  assert.equal(batch.canContinueCreationMarketingBatch(state), true);
  assert.deepEqual(state.schemes.slice(0, 2).map((scheme) => scheme.pendingPlan.frozen), [1, 2]);
  await batch.runCreationMarketingBatch({ state,
    generatePlan: async ({ scheme }) => { calls.push(scheme.index); return { frozen: scheme.index }; },
    enqueuePlan,
  });
  assert.equal(state.status, "completed");
  assert.deepEqual(calls, [1, 2, 3, 4]);
  assert.equal(new Set(queued).size, 8);
  assert.equal(state.enqueuedCount, 8);
});

test("pause after the first copy preserves the plan and queues only remaining copies on continue", async () => {
  assert.equal(typeof batch.pausePendingCreationMarketingBatch, "function");
  const state = batch.createCreationMarketingBatchState({ count: 1, copiesPerScheme: 3 });
  let plans = 0;
  const queued = [];
  const generatePlan = async () => { plans += 1; return { frozen: true }; };
  await batch.runCreationMarketingBatch({ state, generatePlan,
    enqueuePlan: async ({ copyNumber }) => {
      queued.push(copyNumber);
      batch.pausePendingCreationMarketingBatch(state);
      return { id: `copy-${copyNumber}` };
    },
  });
  assert.equal(state.status, "paused");
  assert.equal(state.enqueuedCount, 1);
  assert.equal(state.schemes[0].pendingPlan.frozen, true);
  await batch.runCreationMarketingBatch({ state, generatePlan,
    enqueuePlan: async ({ copyNumber }) => { queued.push(copyNumber); return { id: `copy-${copyNumber}` }; },
  });
  assert.equal(plans, 1);
  assert.deepEqual(queued, [1, 2, 3]);
  assert.equal(state.status, "completed");
});

test("stopping after a scheme fails preserves its failure and prevents continuation", async () => {
  const state = batch.createCreationMarketingBatchState({ count: 3 });
  const gates = [deferred(), deferred()];
  const run = batch.runCreationMarketingBatch({ state,
    generatePlan: ({ scheme }) => gates[scheme.index - 1].promise,
    enqueuePlan: () => assert.fail("unexpected queue"),
    onUpdate: (snapshot) => {
      if (snapshot.schemes[0].status === "failed" && snapshot.status === "running") batch.cancelPendingCreationMarketingBatch(state);
    },
  });
  gates[0].reject(new Error("HTTP 401 unauthorized"));
  gates[1].resolve({ frozen: true });
  await run;
  assert.equal(state.status, "canceled");
  assert.equal(batch.canContinueCreationMarketingBatch(state), false);
  assert.deepEqual(state.schemes.map((scheme) => scheme.status), ["failed", "canceled", "canceled"]);
  await batch.runCreationMarketingBatch({ state,
    generatePlan: () => assert.fail("stopped batch restarted"),
    enqueuePlan: () => assert.fail("stopped batch queued"),
  });
});

test("manual pause during retry prevents another request until continue", async () => {
  assert.equal(typeof batch.pausePendingCreationMarketingBatch, "function");
  const state = batch.createCreationMarketingBatchState({ count: 1 });
  const delay = deferred();
  let calls = 0;
  const run = batch.runCreationMarketingBatch({ state, wait: () => delay.promise,
    generatePlan: async () => { calls += 1; throw new Error("HTTP 503 service unavailable"); },
    enqueuePlan: () => assert.fail("unexpected queue"),
  });
  await tick();
  assert.equal(state.schemes[0].status, "retrying");
  batch.pausePendingCreationMarketingBatch(state);
  await run;
  assert.equal(calls, 1);
  assert.equal(state.status, "paused");
  assert.equal(state.pauseReason, "user");
  delay.resolve();
});

test("stop during pause ignores late results and failures and discards pending plans", async () => {
  assert.equal(typeof batch.pausePendingCreationMarketingBatch, "function");
  const state = batch.createCreationMarketingBatchState({ count: 3 });
  const gates = [deferred(), deferred()];
  const run = batch.runCreationMarketingBatch({ state,
    generatePlan: ({ scheme }) => gates[scheme.index - 1].promise,
    enqueuePlan: () => assert.fail("stopped batch queued"),
  });
  batch.pausePendingCreationMarketingBatch(state);
  gates[0].resolve({ frozen: true });
  await tick();
  assert.ok(state.schemes[0].pendingPlan);
  batch.cancelPendingCreationMarketingBatch(state);
  gates[1].reject(new Error("network timeout"));
  await run;
  assert.equal(state.status, "canceled");
  assert.equal(state.enqueuedCount, 0);
  assert.ok(state.schemes.every((scheme) => scheme.pendingPlan === null));
  assert.equal(batch.canContinueCreationMarketingBatch(state), false);
});

test("a pause requested on the final copy completes instead of leaving an unresumable pause", async () => {
  const state = batch.createCreationMarketingBatchState({ count: 1 });
  await batch.runCreationMarketingBatch({ state,
    generatePlan: async () => ({ frozen: true }),
    enqueuePlan: async () => {
      batch.pausePendingCreationMarketingBatch(state);
      return { id: "last-copy" };
    },
  });
  assert.equal(state.status, "completed");
  assert.equal(state.completedCount, 1);
  assert.equal(state.enqueuedCount, 1);
  assert.equal(batch.canContinueCreationMarketingBatch(state), false);
});

test("stop preserves a copy whose queue submission was already in flight", async () => {
  const state = batch.createCreationMarketingBatchState({ count: 1, copiesPerScheme: 3 });
  const submission = deferred();
  let calls = 0;
  const run = batch.runCreationMarketingBatch({ state,
    generatePlan: async () => ({ frozen: true }),
    enqueuePlan: () => { calls += 1; return submission.promise; },
  });
  await tick();
  batch.cancelPendingCreationMarketingBatch(state);
  submission.resolve({ id: "already-submitted" });
  await run;
  assert.equal(state.status, "canceled");
  assert.equal(calls, 1);
  assert.equal(state.enqueuedCount, 1);
  assert.deepEqual(state.schemes[0].queueJobIds, ["already-submitted"]);
  assert.equal(state.schemes[0].pendingPlan, null);
});

test("manual pause after an isolated failure resumes only the unfinished schemes", async () => {
  const state = batch.createCreationMarketingBatchState({ count: 4 });
  const sibling = deferred();
  const started = [], queued = [];
  const enqueuePlan = async ({ scheme }) => { queued.push(scheme.index); return { id: `job-${scheme.index}` }; };
  const run = batch.runCreationMarketingBatch({ state, enqueuePlan,
    generatePlan: async ({ scheme }) => {
      started.push(scheme.index);
      if (scheme.index === 1) throw new Error("invalid plan");
      return sibling.promise;
    },
    onUpdate: (snapshot) => {
      if (snapshot.status === "running" && snapshot.schemes[0].status === "failed") batch.pausePendingCreationMarketingBatch(state);
    },
  });
  await tick();
  assert.equal(state.status, "pausing");
  sibling.resolve({ frozen: true });
  await run;
  assert.equal(state.status, "paused");
  assert.deepEqual(state.schemes.map((scheme) => scheme.status), ["failed", "paused", "queued", "queued"]);
  await batch.runCreationMarketingBatch({ state, enqueuePlan,
    generatePlan: async ({ scheme }) => { started.push(scheme.index); return { frozen: true }; },
  });
  assert.equal(state.status, "completed");
  assert.deepEqual(started, [1, 2, 3, 4]);
  assert.deepEqual(queued, [2, 3, 4]);
  assert.equal(state.completedCount, 3);
});

test("a request that fails while draining a user pause remains resumable", async () => {
  const state = batch.createCreationMarketingBatchState({ count: 1 });
  const request = deferred();
  const run = batch.runCreationMarketingBatch({ state,
    generatePlan: () => request.promise,
    enqueuePlan: () => assert.fail("unexpected queue"),
  });
  batch.pausePendingCreationMarketingBatch(state);
  request.reject(new Error("timeout"));
  await run;
  assert.equal(state.status, "paused");
  assert.equal(state.pauseReason, "user");
  assert.equal(state.schemes[0].status, "paused");
  assert.equal(batch.canContinueCreationMarketingBatch(state), true);
  await batch.runCreationMarketingBatch({ state,
    generatePlan: async () => ({ frozen: true }),
    enqueuePlan: async () => ({ id: "recovered" }),
  });
  assert.equal(state.status, "completed");
  assert.equal(state.enqueuedCount, 1);
});

test("pause on the final successful copy completes a batch with earlier failures", async () => {
  const state = batch.createCreationMarketingBatchState({ count: 2 });
  await batch.runCreationMarketingBatch({ state,
    generatePlan: async ({ scheme }) => {
      if (scheme.index === 1) throw new Error("invalid plan");
      return { frozen: true };
    },
    enqueuePlan: async () => {
      batch.pausePendingCreationMarketingBatch(state);
      return { id: "last-copy" };
    },
  });
  assert.equal(state.status, "completed");
  assert.equal(state.completedCount, 1);
  assert.deepEqual(state.schemes.map((scheme) => scheme.status), ["failed", "enqueued"]);
  assert.equal(batch.canContinueCreationMarketingBatch(state), false);
});
