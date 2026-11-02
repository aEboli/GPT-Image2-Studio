import assert from "node:assert/strict";
import test from "node:test";
import { createDeferredUpdate } from "../lib/deferred-update.mjs";

test("bursts coalesce without extending the first scheduled deadline", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let state = 0;
  const rendered = [];
  const update = createDeferredUpdate(() => rendered.push(state));
  for (let index = 1; index <= 600; index += 1) {
    state = index;
    update.schedule();
  }
  t.mock.timers.tick(100);
  state = 601;
  update.schedule();
  assert.deepEqual(rendered, []);
  t.mock.timers.tick(20);
  assert.deepEqual(rendered, [601]);
  t.mock.timers.tick(1000);
  assert.deepEqual(rendered, [601]);
});

test("flush renders terminal state immediately and cancels the stale timeout", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let writes = 0;
  const update = createDeferredUpdate(() => { writes += 1; }, { delayMs: 250 });
  update.schedule();
  assert.equal(update.flush(), true);
  assert.equal(writes, 1);
  assert.equal(update.flush(), false);
  t.mock.timers.tick(1000);
  assert.equal(writes, 1);
  update.schedule();
  update.cancel();
  t.mock.timers.tick(1000);
  assert.equal(writes, 1);
});

test("callbacks may schedule the next update without losing it", (t) => {
  t.mock.timers.enable({ apis: ["setTimeout"] });
  let calls = 0;
  const update = createDeferredUpdate(() => {
    calls += 1;
    if (calls === 1) update.schedule();
  });
  update.schedule();
  t.mock.timers.tick(120);
  assert.equal(calls, 1);
  t.mock.timers.tick(120);
  assert.equal(calls, 2);
});
