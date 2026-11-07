import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { createCreationListingScheduler } from "../lib/creation-listing-scheduler.mjs";
import { createCreationListingUpstreamError } from "../lib/creation-listing-error.mjs";

test("all Listing callers share three slots until their full execution settles", async () => {
  const scheduler = createCreationListingScheduler();
  let active = 0;
  let peak = 0;
  const starts = [];
  await Promise.all(Array.from({ length: 8 }, (_, index) => scheduler.run(`set-${index}`, async () => {
    active += 1;
    peak = Math.max(peak, active);
    starts.push(index);
    await delay(12);
    active -= 1;
    if (index === 2) throw new Error("ordinary failure");
    return index;
  }).catch((error) => error.message)));
  assert.equal(peak, 3);
  assert.equal(active, 0);
  assert.deepEqual(starts, [0, 1, 2, 3, 4, 5, 6, 7]);
});

test("identical in-flight Listing requests execute once and a single disconnect preserves other consumers", async () => {
  const scheduler = createCreationListingScheduler();
  const abort = new AbortController();
  let calls = 0;
  let sharedSignal;
  let finish;
  const execute = async ({ signal, onProgress }) => {
    calls += 1;
    sharedSignal = signal;
    onProgress({ stage: "waiting", purpose: "Listing" });
    return new Promise((resolve) => { finish = resolve; });
  };
  const first = scheduler.run("same-config", execute, { signal: abort.signal });
  const rejected = assert.rejects(first, /abort/i);
  const events = [];
  const second = scheduler.run("same-config", execute, { onProgress: (event) => events.push(event) });
  await delay(0);
  abort.abort();
  await rejected;
  assert.equal(sharedSignal.aborted, false);
  finish("saved-once");
  assert.equal(await second, "saved-once");
  assert.equal(calls, 1);
  assert.ok(events.some((event) => event.stage === "waiting"));
  assert.equal(await scheduler.run("same-config", async () => "regenerated"), "regenerated");
});

test("abandoned queued Listing never executes and active abort releases its slot", async () => {
  const scheduler = createCreationListingScheduler({ concurrency: 1 });
  const activeAbort = new AbortController();
  const queuedAbort = new AbortController();
  let queuedCalls = 0;
  const running = scheduler.run("active", ({ signal }) => delay(10000, null, { signal }), { signal: activeAbort.signal });
  const runningRejected = assert.rejects(running, /abort/i);
  await delay(0);
  const queued = scheduler.run("queued", async () => { queuedCalls += 1; }, { signal: queuedAbort.signal });
  const queuedRejected = assert.rejects(queued, /abort/i);
  queuedAbort.abort();
  activeAbort.abort();
  await Promise.all([queuedRejected, runningRejected]);
  assert.equal(await scheduler.run("next", async () => 42), 42);
  assert.equal(queuedCalls, 0);
});

test("shared cooldown gates pending tasks and explicit retries", async () => {
  let time = 1000;
  const waits = [];
  const scheduler = createCreationListingScheduler({ now: () => time, sleep: async (ms) => { waits.push(ms); time += ms; } });
  scheduler.cooldown({ retryAfterMs: 5000 });
  const events = [];
  assert.equal(await scheduler.run("after-limit", async () => time, { onProgress: (event) => events.push(event) }), 6000);
  assert.deepEqual(waits, [5000]);
  assert.ok(events.some((event) => event.stage === "cooldown"));
  scheduler.cooldown({ retryAfterMs: 61000 });
  await assert.rejects(scheduler.run("too-long", async () => assert.fail("must not submit")), (error) => error.stopBatch && error.errorKind === "rate_limit");
});

test("upstream errors distinguish concurrency limits, exhausted quota and authentication", () => {
  const transient = createCreationListingUpstreamError(new Response("", { status: 429, headers: { "Retry-After": "2" } }), { error: { code: "rate_limited", message: "Too many concurrent requests" } });
  assert.equal(transient.errorKind, "rate_limit");
  assert.equal(transient.retryAfterMs, 2000);
  assert.equal(transient.httpStatus, 429);
  const quota = createCreationListingUpstreamError(new Response("", { status: 429 }), { error: { message: "账号图片额度已用完", code: "rate_limited" } });
  assert.equal(quota.errorKind, "quota");
  assert.equal(quota.stopBatch, true);
  const auth = createCreationListingUpstreamError(new Response("", { status: 401 }), { error: { message: "invalid API key sk-secret-do-not-log", code: "invalid_api_key" } });
  assert.equal(auth.errorKind, "authentication");
  assert.doesNotMatch(auth.message, /sk-secret/);
  const content = createCreationListingUpstreamError(new Response("", { status: 400 }), { error: { message: "invalid product source" } });
  assert.equal(content.errorKind, "request");
  assert.equal(content.stopBatch, false);
});
