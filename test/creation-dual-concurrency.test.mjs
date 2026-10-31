import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";
import { createServer } from "node:http";
import { runInNewContext } from "node:vm";
import {
  CREATION_MARKETING_BATCH_CONCURRENCY,
  canContinueCreationMarketingBatch,
  cancelPendingCreationMarketingBatch,
  createCreationMarketingBatchState,
  normalizeCreationMarketingBatchCopies,
  normalizeCreationMarketingBatchSchemeCount,
  pausePendingCreationMarketingBatch,
  runCreationMarketingBatch,
} from "../lib/creation-marketing-batch.mjs";
import { buildCreationQueuedSet, scheduleCreationGenerationQueue } from "../lib/creation-suite-queue.mjs";
import { deepFreezeCreationPlanValue } from "../lib/creation-browser-plan-state.mjs";
import { consumeSse } from "../lib/generation-client.mjs";
import { consumeSseUntilTerminal } from "../lib/sse-terminal-client.mjs";
import { summarizeCreationMarketingProgress, updateCreationMarketingProgress } from "../lib/creation-marketing-progress.mjs";

const tick = () => new Promise((resolve) => setImmediate(resolve));
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
function planFor(index) {
  return { productName: "原商品", productDescription: "原资料", imageCount: 1, carouselImageCount: 1,
    promptPlanningMode: "ai-batch", targetLanguage: "en",
    marketingPlan: { variationSeed: "scheme-" + index },
    items: [{ itemId: "hero-" + index, title: "方案 " + index, prompt: "prompt-" + index, role: "hero" }] };
}

test("two planning slots refill independently and never launch a third simultaneous scheme", async () => {
  const state = createCreationMarketingBatchState({ count: 5, copiesPerScheme: 2 });
  const gates = Array.from({ length: 5 }, deferred);
  const started = [], queued = [], snapshots = [];
  const run = runCreationMarketingBatch({
    state, onUpdate: (snapshot) => snapshots.push(snapshot),
    generatePlan: ({ scheme }) => { started.push(scheme.index); return gates[scheme.index - 1].promise; },
    enqueuePlan: async ({ scheme, planResult, copyNumber }) => {
      assert.equal(planResult.index, scheme.index);
      queued.push([scheme.index, copyNumber]);
      return { id: scheme.index + "-" + copyNumber };
    },
  });
  assert.deepEqual(started, [1, 2]);
  assert.deepEqual(state.activeIndexes, [0, 1]);
  await runCreationMarketingBatch({ state, generatePlan: () => assert.fail("duplicate run"),
    enqueuePlan: () => assert.fail("duplicate queue") });
  for (const index of [2, 3, 4, 5]) {
    gates[index - 1].resolve({ index });
    await tick();
    assert.ok(state.activeIndexes.length <= CREATION_MARKETING_BATCH_CONCURRENCY);
  }
  assert.deepEqual(started, [1, 2, 3, 4, 5]);
  assert.equal(state.schemes[0].status, "planning");
  gates[0].resolve({ index: 1 });
  await run;
  assert.equal(state.status, "completed");
  assert.equal(state.completedCount, 5);
  assert.equal(state.enqueuedCount, 10);
  assert.equal(new Set(queued.map(([scheme, copy]) => scheme + "-" + copy)).size, 10);
  assert.ok(snapshots.some((snapshot) => snapshot.activeIndexes.length === 2));
  assert.ok(snapshots.every((snapshot) => snapshot.activeIndexes.length <= 2));
});

test("a failed scheme releases its slot while sibling and remaining schemes continue", async () => {
  const state = createCreationMarketingBatchState({ count: 4 });
  const gates = Array.from({ length: 4 }, deferred);
  const calls = [], queued = [];
  const run = runCreationMarketingBatch({ state,
    generatePlan: ({ scheme }) => { calls.push(scheme.index); return gates[scheme.index - 1].promise; },
    enqueuePlan: async ({ scheme }) => { queued.push(scheme.index); return { id: "job-" + scheme.index }; },
  });
  gates[0].reject(new Error("HTTP 401 unauthorized"));
  await tick();
  assert.equal(state.status, "running");
  assert.deepEqual(calls, [1, 2, 3]);
  gates[2].resolve({ frozen: "third" });
  await tick();
  assert.deepEqual(calls, [1, 2, 3, 4]);
  gates[3].resolve({ frozen: "fourth" });
  gates[1].resolve({ frozen: "second" });
  await run;
  assert.deepEqual(state.schemes.map((scheme) => scheme.status), ["failed", "enqueued", "enqueued", "enqueued"]);
  await runCreationMarketingBatch({ state,
    generatePlan: async ({ scheme }) => { calls.push(scheme.index); return { frozen: scheme.index }; },
    enqueuePlan: async ({ scheme, planResult }) => {
      if (scheme.index === 2) assert.equal(planResult.frozen, "second");
      queued.push(scheme.index);
      return { id: "job-" + scheme.index };
    },
  });
  assert.equal(calls.filter((index) => index === 2).length, 1);
  assert.equal(new Set(queued).size, 3);
  assert.equal(state.completedCount, 3);
  assert.equal(state.status, "completed");
});

test("cancellation cannot be overwritten by late rejected concurrent requests", async () => {
  const state = createCreationMarketingBatchState({ count: 4 });
  const gates = [deferred(), deferred()];
  let calls = 0;
  const run = runCreationMarketingBatch({ state,
    generatePlan: () => gates[calls++].promise,
    enqueuePlan: () => assert.fail("queue after cancel"),
  });
  cancelPendingCreationMarketingBatch(state);
  gates[0].reject(new Error("timeout"));
  gates[1].reject(new Error("unauthorized"));
  await run;
  assert.equal(calls, 2);
  assert.equal(state.status, "canceled");
  assert.ok(state.schemes.every((scheme) => scheme.status === "canceled"));
  assert.deepEqual(state.activeIndexes, []);
});

test("a sibling failure does not interrupt another worker's retry or remaining schemes", async () => {
  const state = createCreationMarketingBatchState({ count: 3 });
  const waitGate = deferred(), failure = deferred();
  const calls = [];
  const run = runCreationMarketingBatch({ state, wait: () => waitGate.promise,
    generatePlan: ({ scheme }) => {
      calls.push(scheme.index);
      return scheme.index === 1 ? Promise.reject(new Error("timeout")) : failure.promise;
    }, enqueuePlan: () => assert.fail("unexpected enqueue"),
  });
  await tick();
  assert.equal(state.schemes[0].status, "retrying");
  failure.reject(new Error("HTTP 402 insufficient_quota"));
  await tick();
  waitGate.resolve();
  await run;
  assert.deepEqual(calls, [1, 2, 3, 1, 1]);
  assert.equal(state.status, "completed");
  assert.ok(state.schemes.every((scheme) => scheme.status === "failed"));
});

test("two injected transient faults recover independently and enqueue each copy once", async () => {
  const state = createCreationMarketingBatchState({ count: 3, copiesPerScheme: 2 });
  const attempts = new Map(), waits = [], queued = [];
  await runCreationMarketingBatch({
    state, wait: async (delay) => { waits.push(delay); },
    generatePlan: async ({ scheme }) => {
      const attempt = (attempts.get(scheme.index) || 0) + 1;
      attempts.set(scheme.index, attempt);
      if (scheme.index <= 2 && attempt === 1) throw new Error("HTTP 503 service unavailable");
      return { index: scheme.index };
    },
    enqueuePlan: async ({ scheme, copyNumber }) => {
      const id = scheme.index + "-" + copyNumber; queued.push(id); return { id };
    },
  });
  assert.equal(state.status, "completed");
  assert.deepEqual(waits, [5000, 5000]);
  assert.equal(state.retryCount, 2);
  assert.equal(state.enqueuedCount, 6);
  assert.equal(new Set(queued).size, 6);
  assert.deepEqual([...attempts], [[1, 2], [2, 2], [3, 1]]);
});

test("two suite slots include automatic repair and refill while another suite is slow", async () => {
  const creationState = { queue: [1, 2, 3, 4].map((index) => ({
    id: "queue-" + index, status: "queued", formData: index,
    set: { setId: "set-" + index, items: [{ itemId: "hero", status: "queued" }] },
  })), selectedQueueId: "queue-2" };
  const streams = Array.from({ length: 4 }, deferred);
  const repair = deferred();
  const started = [];
  let maxRunning = 0;
  const context = {
    creationState, getMaxParallelTasks: () => 20,
    normalizeSet: structuredClone, nowIso: () => new Date().toISOString(),
    compactErrorMessage: (message) => message, setFeedback() {}, showError: assert.fail,
    loadCreationSets: async () => {},
    render() {
      maxRunning = Math.max(maxRunning, creationState.queue.filter((job) => job.status === "running").length);
    },
    fetchImpl: async (_url, { body }) => { started.push(body); return { ok: true, body }; },
    runCreationStream: async ({ body }, { queueJob, onEventHandled }) => {
      await streams[body - 1].promise;
      queueJob.set.items[0].status = "completed";
      await onEventHandled("complete", { set: queueJob.set });
    },
    runAutoRepairIfNeeded: async (job) => { if (job.id === "queue-1") await repair.promise; },
  };
  scheduleCreationGenerationQueue(context);
  scheduleCreationGenerationQueue(context);
  await tick();
  assert.deepEqual(started, [1, 2]);
  streams[0].resolve();
  await tick();
  assert.deepEqual(started, [1, 2], "repair keeps the first suite slot occupied");
  streams[1].resolve();
  await tick();
  assert.deepEqual(started, [1, 2, 3]);
  assert.equal(creationState.currentSet.setId, "set-2");
  assert.equal(creationState.selectedQueueId, "queue-2");
  repair.resolve();
  await tick();
  assert.deepEqual(started, [1, 2, 3, 4]);
  streams[2].resolve();
  streams[3].resolve();
  await tick();
  assert.equal(maxRunning, 2);
  assert.ok(creationState.queue.every((job) => job.status === "completed"));
  assert.equal(creationState.generating, false);
});

test("suite concurrency uses a frozen global limit of one", async () => {
  const gate = deferred(), started = [];
  const creationState = { schedulingSnapshot: { generationConcurrency: "1" },
    queue: [1, 2].map((index) => ({ id: "queue-" + index, status: "queued", formData: index,
      set: { setId: "set-" + index, items: [{ status: "queued" }] } })) };
  scheduleCreationGenerationQueue({
    creationState, getMaxParallelTasks: () => 20, normalizeSet: structuredClone,
    nowIso: () => new Date().toISOString(), compactErrorMessage: (message) => message,
    render() {}, setFeedback() {}, showError: assert.fail, loadCreationSets: async () => {},
    fetchImpl: async (_url, { body }) => { started.push(body); return { ok: true, body }; },
    runCreationStream: async (_response, { queueJob, onEventHandled }) => {
      await gate.promise;
      queueJob.set.items[0].status = "completed";
      await onEventHandled("complete");
    },
  });
  await tick();
  assert.deepEqual(started, [1]);
  gate.resolve();
  await tick();
  assert.deepEqual(started, [1, 2]);
  assert.ok(creationState.queue.every((job) => job.status === "completed"));
});

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
function browserFixture({ count = 3, copies = 2, productName = "原商品", productDescription = "原资料" } = {}) {
  const requests = [], jobs = [], source = new FormData();
  source.set("productName", productName); source.set("productDescription", productDescription);
  source.set("imageCount", "1"); source.set("quality", "high");
  source.set("listingAgentEnabled", "true");
  source.set("referenceImageRoles", JSON.stringify([{ index: 1, filename: "original.png", role: "product" }]));
  source.append("referenceImages", new Blob(["original"], { type: "image/png" }), "original.png");
  const creation = { planning: false, marketingBatchEnabled: true, draftSet: { setId: "unrelated-draft" }, effectivePlan: { id: "unrelated" } };
  const context = {
    FormData, AbortController, state: { creation },
    refs: { creationMarketingBatchCountInput: { value: String(count) }, creationMarketingBatchCopiesInput: { value: String(copies) } },
    isCreationAiMarketingEnabled: () => true,
    normalizeCreationMarketingBatchSchemeCount, normalizeCreationMarketingBatchCopies,
    createCreationMarketingBatchState, runCreationMarketingBatch, canContinueCreationMarketingBatch,
    pausePendingCreationMarketingBatch, cancelPendingCreationMarketingBatch, structuredClone,
    deepFreezeCreationPlanValue, summarizeCreationMarketingProgress, updateCreationMarketingProgress,
    consumeSse, consumeSseUntilTerminal,
    renderCreationView() {}, resetCreationDraftPreview() {}, waitForPendingCreationPlanPreview: async () => {},
    setCreationFeedback() {}, showError: assert.fail, compactErrorMessage: (message) => message,
    nowIso: () => new Date().toISOString(),
    buildCreationMarketingBatchRequestFormData: async () => source,
    cloneCreationMarketingBatchFormData: (data) => { const clone = new FormData(); for (const [key, value] of data) clone.append(key, value); return clone; },
    buildCreationQueuedSet: (input) => buildCreationQueuedSet({ ...input, normalizeSet: structuredClone }),
    enqueueCreationGeneration: ({ formData, set }) => {
      const job = { id: "job-" + (jobs.length + 1), formData, set }; jobs.push(job); return job;
    },
    fetch: async (url, options) => {
      assert.equal(url, "/api/creation/plan");
      const gate = deferred(); requests.push({ ...options, gate }); return gate.promise;
    },
  };
  const start = app.indexOf("async function requestCreationMarketingBatchPlan(");
  const end = app.indexOf("function releaseCreationLoadingSources(", start);
  assert.ok(start >= 0 && end > start);
  runInNewContext(app.slice(start, end), context);
  return { context, creation, requests, jobs, source };
}
function ssePlanResponse(index) {
  const data = "event: marketing_progress\ndata: " + JSON.stringify({ stage: "receiving", message: "接收方案 " + index }) +
    "\n\nevent: complete\ndata: " + JSON.stringify({ plan: planFor(index) }) + "\n\n";
  return new Response(data, { headers: { "content-type": "text/event-stream" } });
}

test("disabled browser batch cannot start or resume planning", async () => {
  const view = browserFixture();
  view.creation.marketingBatchEnabled = false;
  await view.context.runCreationMarketingBatchGeneration();
  await view.context.runCreationMarketingBatchGeneration({ resume: true });
  assert.equal(view.requests.length, 0);
  assert.equal(view.jobs.length, 0);
  assert.equal(view.creation.marketingBatch, undefined);
});

test("browser batch rejects empty product information before starting any scheme", async () => {
  for (const value of ["", " \n\t "]) {
    const view = browserFixture({ count: 20, copies: 2, productName: value, productDescription: value });
    const errors = [], feedback = [];
    view.context.showError = (message) => errors.push(message);
    view.context.setCreationFeedback = (message, kind) => feedback.push({ message, kind });
    const firstRun = view.context.runCreationMarketingBatchGeneration();
    await tick();
    if (view.requests.length) {
      view.context.cancelCreationMarketingBatch();
      for (const request of view.requests) request.gate.resolve(ssePlanResponse(1));
    }
    await firstRun;
    assert.deepEqual(errors, ["请至少填写商品名称或商品描述。"]);
    assert.deepEqual(feedback, [{ message: "请至少填写商品名称或商品描述。", kind: "error" }]);
    assert.equal(view.requests.length, 0, "reference images alone must not launch twenty invalid requests");
    assert.equal(view.jobs.length, 0);
    assert.equal(view.creation.marketingBatch, undefined);

    view.source.set("productName", "已补充商品");
    const run = view.context.runCreationMarketingBatchGeneration();
    await tick();
    assert.equal(view.requests.length, 2, "validation must release the startup lock for a corrected submission");
    view.context.cancelCreationMarketingBatch();
    for (const request of view.requests) request.gate.resolve(ssePlanResponse(1));
    await run;
    assert.equal(view.creation.marketingBatch.status, "canceled");
    assert.equal(errors.length, 1);
  }
});

test("browser batch accepts a product name or description on its own", async () => {
  for (const [productName, productDescription] of [["原商品", ""], ["", "原资料"]]) {
    const view = browserFixture({ count: 1, copies: 2, productName, productDescription });
    const run = view.context.runCreationMarketingBatchGeneration();
    await tick();
    assert.equal(view.requests.length, 1);
    view.requests[0].gate.resolve(ssePlanResponse(1));
    await run;
    assert.equal(view.creation.marketingBatch.completedCount, 1);
    assert.equal(view.jobs.length, 2);
  }
});

test("real browser batch wiring keeps out-of-order SSE results, snapshots and copies isolated", async () => {
  const view = browserFixture();
  const run = view.context.runCreationMarketingBatchGeneration();
  await tick();
  assert.equal(view.requests.length, 2);
  await view.context.runCreationMarketingBatchGeneration();
  assert.equal(view.requests.length, 2, "duplicate clicks do not launch additional plans");
  view.context.refs.creationProductNameInput = { value: "后来修改的商品" };
  view.requests[1].gate.resolve(ssePlanResponse(2));
  await tick();
  assert.equal(view.requests.length, 3, "a free slot starts scheme 3 before slow scheme 1 finishes");
  view.requests[2].gate.resolve(ssePlanResponse(3));
  view.requests[0].gate.resolve(ssePlanResponse(1));
  await run;
  assert.equal(view.creation.marketingBatch.status, "completed");
  assert.equal(view.jobs.length, 6);
  assert.equal(new Set(view.jobs.map((job) => job.set.setId)).size, 6);
  for (const job of view.jobs) {
    const index = job.set.marketingBatch.schemeIndex;
    assert.equal(job.set.items[0].prompt, "prompt-" + index);
    assert.equal(JSON.parse(job.formData.get("effectivePlan")).items[0].prompt, "prompt-" + index);
    assert.equal(job.formData.get("variationSeed"), view.creation.marketingBatch.schemes[index - 1].variationSeed);
    assert.equal(job.set.productName, "原商品");
    assert.equal(job.formData.get("quality"), "high");
    assert.equal(job.set.listingAgentEnabled, true);
    assert.deepEqual(job.set.referenceImageNames, ["original.png"]);
    assert.equal(job.marketingProgress.stage, "complete");
    assert.equal(job.marketingProgress.message, "接收方案 " + index);
  }
  assert.equal(view.creation.draftSet.setId, "unrelated-draft");
  assert.deepEqual(view.creation.effectivePlan, { id: "unrelated" });
});

test("browser batch continues all remaining SSE plans after a scheme fails", async () => {
  const view = browserFixture();
  const run = view.context.runCreationMarketingBatchGeneration();
  await tick();
  view.requests[0].gate.resolve(new Response("event: error\ndata: {\"message\":\"HTTP 401 unauthorized\"}\n\n",
    { headers: { "content-type": "text/event-stream" } }));
  await tick();
  assert.equal(view.requests.length, 3);
  view.requests[2].gate.resolve(ssePlanResponse(3));
  view.requests[1].gate.resolve(ssePlanResponse(2));
  await run;
  assert.equal(view.creation.marketingBatch.status, "completed");
  assert.equal(view.requests.length, 3);
  assert.equal(view.jobs.length, 4);
  assert.equal(view.creation.marketingBatch.schemes[0].status, "failed");
  assert.equal(view.creation.marketingBatch.completedCount, 2);
  assert.equal(view.creation.marketingBatch.schemes[1].pendingPlan, null);
  await view.context.runCreationMarketingBatchGeneration({ resume: true });
  assert.equal(view.requests.length, 3);
  assert.equal(view.jobs.length, 4);
});

test("browser pause and continue preserve snapshots and never replan cached schemes", async () => {
  const view = browserFixture();
  const run = view.context.runCreationMarketingBatchGeneration();
  await tick();
  view.context.pauseCreationMarketingBatch();
  assert.equal(view.creation.marketingBatch.status, "pausing");
  assert.ok(view.requests.every((request) => !request.signal.aborted), "pause preserves the current requests for continuation");
  await view.context.runCreationMarketingBatchGeneration({ resume: true });
  assert.equal(view.requests.length, 2);
  view.requests[0].gate.resolve(ssePlanResponse(1));
  view.requests[1].gate.resolve(ssePlanResponse(2));
  await run;
  assert.equal(view.creation.marketingBatch.status, "paused");
  assert.equal(view.jobs.length, 0);
  const batchId = view.creation.marketingBatch.batchId;
  await view.context.runCreationMarketingBatchGeneration();
  assert.equal(view.creation.marketingBatch.batchId, batchId, "start cannot replace a paused batch");
  view.context.refs.creationMarketingBatchCountInput.value = "20";
  view.context.refs.creationMarketingBatchCopiesInput.value = "20";
  const resumed = view.context.runCreationMarketingBatchGeneration({ resume: true });
  await tick();
  assert.equal(view.requests.length, 3);
  view.requests[2].gate.resolve(ssePlanResponse(3));
  await resumed;
  assert.equal(view.jobs.length, 6);
  assert.equal(view.creation.marketingBatch.batchId, batchId);
  assert.equal(view.creation.marketingBatch.requestedImageCount, 1);
  assert.equal(view.creation.marketingBatch.status, "completed");
  assert.ok(view.jobs.every((job) => job.formData.get("imageCount") === "1"));
});

test("browser pause while preparing a batch does not start planning afterwards", async () => {
  const view = browserFixture();
  const preparation = deferred();
  view.context.waitForPendingCreationPlanPreview = () => preparation.promise;
  const run = view.context.runCreationMarketingBatchGeneration();
  await tick();
  assert.equal(view.creation.marketingBatch.status, "queued");
  view.context.pauseCreationMarketingBatch();
  preparation.resolve();
  await run;
  assert.equal(view.creation.marketingBatch.status, "paused");
  assert.equal(view.requests.length, 0);
  assert.equal(view.jobs.length, 0);
});

test("stopping aborts stalled planning requests and allows a fresh batch to start", async (t) => {
  for (const phase of ["headers", "stream"]) {
    await t.test(phase, async (t) => {
      const view = browserFixture({ count: 2, copies: 1 });
      const arrivals = [deferred(), deferred()];
      const progress = [deferred(), deferred()];
      const responses = [], signals = [];
      let run, restarted;
      const server = createServer((request, response) => {
        request.resume();
        if (request.url !== "/api/creation/plan") { response.writeHead(404).end(); return; }
        const index = responses.length;
        responses.push(response);
        if (phase === "stream") {
          response.writeHead(200, { "content-type": "text/event-stream" });
          response.write('event: marketing_progress\ndata: {"stage":"waiting"}\n\n');
        }
        arrivals[index]?.resolve();
      });
      await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
      t.after(async () => {
        for (const response of responses) response.destroy();
        server.closeAllConnections();
        await new Promise((resolve) => server.close(resolve));
        await run;
        await restarted;
      });
      view.context.renderCreationView = () => {
        view.creation.marketingBatch?.schemes.forEach((scheme, index) => {
          if (scheme.marketingProgress?.stage === "waiting") progress[index].resolve();
        });
      };
      view.context.fetch = (_url, options) => {
        signals.push(options.signal);
        return fetch(`http://127.0.0.1:${server.address().port}/api/creation/plan`, options);
      };
      run = view.context.runCreationMarketingBatchGeneration();
      await Promise.all(arrivals.map((arrival) => arrival.promise));
      if (phase === "stream") await Promise.all(progress.map((entry) => entry.promise));
      const stopped = view.creation.marketingBatch;
      view.context.cancelCreationMarketingBatch();
      assert.equal(stopped.status, "canceled");
      assert.ok(signals.every((signal) => signal?.aborted), "stop must abort both requests without waiting for upstream output");
      await run;
      assert.equal(view.jobs.length, 0);
      view.context.fetch = async () => ssePlanResponse(2);
      restarted = view.context.runCreationMarketingBatchGeneration();
      await restarted;
      assert.notEqual(view.creation.marketingBatch, stopped);
      assert.equal(view.creation.marketingBatch.status, "completed");
      assert.equal(view.jobs.length, 2);
      assert.equal(stopped.status, "canceled");
    });
  }
});

test("the browser batch plan reader rejects SSE that ends without a terminal event", async () => {
  const view = browserFixture();
  const batch = createCreationMarketingBatchState();
  const request = view.context.requestCreationMarketingBatchPlan(view.source, batch.schemes[0], batch);
  view.requests[0].gate.resolve(new Response("event: marketing_progress\ndata: {\"stage\":\"receiving\"}\n\n",
    { headers: { "content-type": "text/event-stream" } }));
  await assert.rejects(request, /未收到完整计划/);
});
