import assert from "node:assert/strict";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { makeMockCreationListingDraft, requestCreationListingDraft } from "../lib/creation-listing-agent.mjs";
import { createCreationListingScheduler } from "../lib/creation-listing-scheduler.mjs";
import { runWithTextModelContext } from "../lib/text-model-stream.mjs";

const source = { setId: "retry-fixture", productName: "Blue Fishing Lure", forceV1: true, platformId: "generic-ecommerce" };
const success = () => Response.json({ output_text: JSON.stringify(makeMockCreationListingDraft(source)) });
const limited = (retryAfter = "0", message = "Too many concurrent requests") => Response.json({ error: { code: "rate_limited", message } }, { status: 429, headers: { "Retry-After": retryAfter } });
const options = { baseUrl: "https://example.test/v1", apiKey: "test", source };

test("Listing retries an explicit temporary rejection within its two POST budget", async () => {
  let calls = 0;
  let time = 0;
  const waits = [];
  const scheduler = createCreationListingScheduler({ now: () => time, sleep: async (ms) => { waits.push(ms); time += ms; } });
  const draft = await requestCreationListingDraft({ ...options, requestScheduler: scheduler, fetchImpl: async () => ++calls === 1 ? limited("2") : success() });
  assert.ok(draft.title);
  assert.equal(calls, 2);
  assert.deepEqual(waits, [2000]);
});

test("reasoning compatibility and rate limit recovery never exceed two POSTs combined", async () => {
  let calls = 0;
  const scheduler = createCreationListingScheduler();
  await assert.rejects(requestCreationListingDraft({ ...options, reasoningEffort: "high", requestScheduler: scheduler, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) return Response.json({ error: { message: "reasoning effort high unsupported; supported values: low", param: "reasoning.effort", code: "invalid_value" } }, { status: 400 });
    return limited();
  } }), (error) => error.errorKind === "rate_limit");
  assert.equal(calls, 2);
});

test("quota and long Retry-After stop without automatic replay", async () => {
  for (const response of [limited("0", "账号额度已用完"), limited("120")]) {
    let calls = 0;
    await assert.rejects(requestCreationListingDraft({ ...options, requestScheduler: createCreationListingScheduler(), fetchImpl: async () => { calls += 1; return response; } }), (error) => error.stopBatch === true);
    assert.equal(calls, 1);
  }
});

test("an interrupted Listing with unknown upstream outcome is not replayed", async () => {
  let calls = 0;
  await assert.rejects(requestCreationListingDraft({ ...options, requestScheduler: createCreationListingScheduler(), fetchImpl: async () => { calls += 1; throw new Error("fetch failed"); } }), /fetch failed/);
  assert.equal(calls, 1);
});

test("an HTTP 200 stream quota failure preserves stop metadata without replay", async () => {
  let calls = 0;
  await assert.rejects(requestCreationListingDraft({ ...options, requestScheduler: createCreationListingScheduler(), fetchImpl: async () => {
    calls += 1;
    return new Response('event: error\ndata: {"error":{"code":"insufficient_quota","message":"account quota exhausted"}}\n\n', { headers: { "content-type": "text/event-stream" } });
  } }), (error) => error.errorKind === "quota" && error.stopBatch === true);
  assert.equal(calls, 1);
});

test("an upstream response identifier prevents replay even on a retryable status", async () => {
  let calls = 0;
  await assert.rejects(requestCreationListingDraft({ ...options, requestScheduler: createCreationListingScheduler(), fetchImpl: async () => {
    calls += 1;
    return Response.json({ id: "already-accepted", error: { code: "rate_limited", message: "Too many requests" } }, { status: 429, headers: { "Retry-After": "0" } });
  } }), (error) => error.errorKind === "rate_limit");
  assert.equal(calls, 1);
});

test("cooldown is outside the individual upstream timeout and can be cancelled", async () => {
  const abort = new AbortController();
  const scheduler = createCreationListingScheduler();
  scheduler.cooldown({ retryAfterMs: 5000 });
  let calls = 0;
  const pending = runWithTextModelContext({ signal: abort.signal }, () => requestCreationListingDraft({ ...options, requestScheduler: scheduler, requestTimeoutMs: 10, fetchImpl: async () => { calls += 1; return success(); } }));
  const rejected = assert.rejects(pending, /abort/i);
  abort.abort();
  await rejected;
  assert.equal(calls, 0);
});

test("reasoning fallback suspends its previous deadline while waiting for shared cooldown", async () => {
  let calls = 0;
  const scheduler = createCreationListingScheduler({ sleep: (ms, signal) => delay(ms, undefined, { signal }) });
  const draft = await requestCreationListingDraft({ ...options, requestTimeoutMs: 10, requestScheduler: scheduler, fetchImpl: async () => {
    calls += 1;
    if (calls === 1) {
      scheduler.cooldown({ retryAfterMs: 35 });
      return Response.json({ error: { message: "reasoning high unsupported; supported values: low", param: "reasoning.effort", code: "invalid_value" } }, { status: 400 });
    }
    return success();
  } });
  assert.ok(draft.title);
  assert.equal(calls, 2);
});
