import assert from "node:assert/strict";
import test from "node:test";
import * as batch from "../lib/creation-marketing-batch.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve;
  const promise = new Promise((yes) => { resolve = yes; });
  return { promise, resolve };
}
function fakeClock(t) {
  let now = Date.parse("2026-10-31T02:00:00Z");
  t.mock.method(Date, "now", () => now);
  return (milliseconds) => { now += milliseconds; };
}

test("batch and scheme clocks grow while running and freeze on completion", async (t) => {
  assert.equal(typeof batch.getCreationMarketingBatchElapsedMs, "function");
  const advance = fakeClock(t);
  const state = batch.createCreationMarketingBatchState({ count: 2 });
  const gates = [deferred(), deferred()];
  const run = batch.runCreationMarketingBatch({ state,
    generatePlan: ({ scheme }) => gates[scheme.index - 1].promise,
    enqueuePlan: async ({ scheme }) => ({ id: `job-${scheme.index}` }),
  });
  assert.ok(state.startedAt);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state), 0);
  advance(3000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state), 3000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[0]), 3000);
  gates[0].resolve({ plan: 1 });
  await tick();
  assert.equal(state.schemes[0].status, "enqueued");
  assert.ok(state.schemes[0].finishedAt);
  advance(2000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[0]), 3000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[1]), 5000);
  gates[1].resolve({ plan: 2 });
  await run;
  assert.equal(state.status, "completed");
  assert.ok(state.finishedAt);
  advance(60000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state), 5000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[1]), 5000);
});

test("pause drains requests then freezes clocks and resume excludes idle pause time", async (t) => {
  assert.equal(typeof batch.getCreationMarketingBatchElapsedMs, "function");
  const advance = fakeClock(t);
  const state = batch.createCreationMarketingBatchState({ count: 1 });
  const gate = deferred();
  const run = batch.runCreationMarketingBatch({ state,
    generatePlan: () => gate.promise,
    enqueuePlan: () => assert.fail("must not queue while paused"),
  });
  const startedAt = state.startedAt;
  advance(2000);
  batch.pausePendingCreationMarketingBatch(state);
  advance(1000);
  gate.resolve({ frozen: true });
  await run;
  assert.equal(state.status, "paused");
  advance(30000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state), 3000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[0]), 3000);
  await batch.runCreationMarketingBatch({ state,
    generatePlan: () => assert.fail("must reuse frozen plan"),
    enqueuePlan: async () => { advance(2000); return { id: "resumed" }; },
  });
  assert.equal(state.startedAt, startedAt);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state), 5000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[0]), 5000);
});

test("retry delays count toward elapsed time and failed schemes retain fixed totals", async (t) => {
  assert.equal(typeof batch.getCreationMarketingBatchElapsedMs, "function");
  const advance = fakeClock(t);
  const state = batch.createCreationMarketingBatchState({ count: 1 });
  await batch.runCreationMarketingBatch({ state,
    generatePlan: async () => { advance(1000); throw new Error("timeout"); },
    wait: async (milliseconds) => { advance(milliseconds); },
    enqueuePlan: () => assert.fail("unexpected enqueue"),
  });
  assert.equal(state.schemes[0].status, "failed");
  assert.ok(state.schemes[0].finishedAt);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state), 23000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[0]), 23000);
  advance(60000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[0]), 23000);
});

test("stopping freezes started tasks and never starts a clock for pending schemes", async (t) => {
  assert.equal(typeof batch.getCreationMarketingBatchElapsedMs, "function");
  const advance = fakeClock(t);
  const state = batch.createCreationMarketingBatchState({ count: 3 });
  const gate = deferred();
  const run = batch.runCreationMarketingBatch({ state,
    generatePlan: () => gate.promise,
    enqueuePlan: () => assert.fail("unexpected enqueue"),
  });
  advance(4000);
  batch.cancelPendingCreationMarketingBatch(state);
  const finishedAt = state.finishedAt;
  advance(10000);
  gate.resolve({ late: true });
  await run;
  assert.equal(state.finishedAt, finishedAt);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state), 4000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[0]), 4000);
  assert.equal(batch.getCreationMarketingBatchElapsedMs(state.schemes[2]), 0);
  assert.equal(state.schemes[2].startedAt, "");
});

test("missing, invalid and future clock values never display invalid or negative time", () => {
  assert.equal(typeof batch.getCreationMarketingBatchElapsedMs, "function");
  const now = Date.parse("2026-10-31T02:00:00Z");
  assert.equal(batch.getCreationMarketingBatchElapsedMs(null, now), 0);
  assert.equal(batch.getCreationMarketingBatchElapsedMs({ elapsedMs: -1000, timingStartedAt: "invalid" }, now), 0);
  assert.equal(batch.getCreationMarketingBatchElapsedMs({ elapsedMs: 3000, timingStartedAt: new Date(now + 1000).toISOString() }, now), 3000);
});
