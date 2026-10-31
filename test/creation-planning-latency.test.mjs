import test from "node:test";
import assert from "node:assert/strict";
import { requestStreamingText, runWithTextModelContext } from "../lib/text-model-stream.mjs";
import { createPromptAgentRequestBody, requestPromptAgentAnalysis } from "../lib/prompt-agent.mjs";
import { requestCreationMarketingPlan } from "../lib/creation-marketing-agent.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { formatTextModelTiming } from "../lib/text-model-client.mjs";
import { updateCreationMarketingProgress } from "../lib/creation-marketing-progress.mjs";

const next = () => new Promise((done) => setImmediate(done));

test("stream timing separates headers, heartbeat, first answer and receive time without exposing reasoning", async (t) => {
  t.mock.timers.enable({ apis: ["Date"], now: 1000 });
  let connect;
  let source;
  const events = [];
  const stream = new ReadableStream({ start(controller) { source = controller; } });
  const encoder = new TextEncoder();
  const emit = (payload) => source.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
  const pending = runWithTextModelContext({ requestId: "logical-test" }, () => requestStreamingText(() => new Promise((done) => { connect = done; }), "https://example.test/v1/responses", { body: '{"reasoning":{"effort":"high"}}' }, { onProgress: (event) => events.push(event) }));
  t.mock.timers.tick(100);
  connect(new Response(stream, { headers: { "content-type": "text/event-stream" } }));
  await next();
  t.mock.timers.tick(50);
  source.enqueue(encoder.encode(": heartbeat\n\n"));
  emit({ type: "response.reasoning_text.delta", delta: "PRIVATE_REASONING" });
  await next();
  assert.equal(events.filter((event) => event.stage === "receiving").length, 0);
  assert.equal(events.at(-1).timing.firstByteMs, 150);
  assert.equal(events.at(-1).timing.firstTextMs, undefined);
  t.mock.timers.tick(200);
  emit({ type: "response.output_text.delta", delta: "中文" });
  await next();
  t.mock.timers.tick(120);
  emit({ type: "response.output_text.delta", delta: "回答" });
  await next();
  t.mock.timers.tick(50);
  emit({ type: "response.completed", response: { usage: { input_tokens: 20, output_tokens: 8, output_tokens_details: { reasoning_tokens: 2 } } } });
  source.close();
  assert.equal((await (await pending).json()).output_text, "中文回答");
  const final = events.at(-1);
  assert.deepEqual(final.timing, { headersMs: 100, firstByteMs: 150, firstTextMs: 350, lastTextMs: 470, receiveMs: 120, totalMs: 520 });
  assert.deepEqual(final.usage, { inputTokens: 20, outputTokens: 8 });
  assert.ok(final.callId);
  assert.ok(events.every((event) => event.requestId === "logical-test" && event.callId === final.callId));
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE_REASONING|reasoning_tokens/);
});

test("buffered JSON with an SSE header keeps first-byte evidence without inventing an answer delta", async () => {
  const events = [];
  const response = await requestStreamingText(async () => new Response(JSON.stringify({ output_text: '{"summary":"整包结果"}', usage: { prompt_tokens: 31, completion_tokens: 12 } }), { headers: { "content-type": "text/event-stream" } }), "https://example.test/v1/responses", { body: "{}" }, { onProgress: (event) => events.push(event) });
  assert.equal((await response.json()).output_text, '{"summary":"整包结果"}');
  assert.equal(events.some((event) => event.stage === "receiving"), false);
  const final = events.at(-1);
  assert.equal(final.transport, "buffered");
  assert.ok(Number.isFinite(final.timing.firstByteMs));
  assert.ok(Number.isFinite(final.timing.totalMs));
  assert.equal(final.timing.firstTextMs, undefined);
  assert.deepEqual(final.usage, { inputTokens: 31, outputTokens: 12 });
});

test("JSON repair keeps one logical ID while actual POSTs get separate call IDs and attempts", async () => {
  const { payload } = marketingPlanFixture(2);
  const events = [];
  const headers = [];
  await requestPromptAgentAnalysis({ baseUrl: "https://example.test/v1", apiKey: "test", responsesModel: "fixed-fixture", mode: "creation-marketing-plan", contextPrompt: '{"task_count":2}', onProgress: (event) => events.push(event), fetchImpl: async (_url, init) => {
    headers.push(init.headers);
    return Response.json({ output_text: headers.length === 1 ? "{broken" : JSON.stringify(payload) });
  } });
  assert.equal(headers.length, 2);
  assert.equal(new Set(events.map((event) => event.requestId).filter(Boolean)).size, 1);
  const waiting = events.filter((event) => event.stage === "waiting");
  assert.deepEqual(waiting.map((event) => event.attempt), [1, 2]);
  assert.equal(new Set(waiting.map((event) => event.callId)).size, 2);
  assert.deepEqual(headers.map((header) => header["X-Client-Request-Attempt"]), ["1", "2"]);
});

test("structured marketing sends schema once and restores inline schema for compatibility fallback", async () => {
  const options = { mode: "creation-marketing-plan", contextPrompt: '{"task_count":20,"reuse_analysis":true}', responsesModel: "fixed-fixture", reasoningEffort: "high" };
  const strict = createPromptAgentRequestBody(options);
  const inline = strict.input[0].content.filter((part) => part.type === "input_text").map((part) => part.text).join("\n");
  assert.doesNotMatch(inline, /"additionalProperties"/);
  assert.equal(strict.text.format.schema.properties.items.minItems, 20);
  assert.equal(strict.reasoning.effort, "high");
  const fallback = createPromptAgentRequestBody({ ...options, structuredOutput: false });
  assert.equal(fallback.text, undefined);
  assert.match(fallback.input[0].content.map((part) => part.text).join("\n"), /"additionalProperties"/);
  const { payload } = marketingPlanFixture(20);
  let calls = 0;
  await requestPromptAgentAnalysis({ ...options, baseUrl: "https://example.test/v1", apiKey: "test", fetchImpl: async (_url, init) => {
    const body = JSON.parse(init.body);
    calls += 1;
    if (calls === 1) return Response.json({ error: { message: "json_schema unsupported" } }, { status: 400 });
    assert.match(body.input[0].content.map((part) => part.text).join("\n"), /"additionalProperties"/);
    return Response.json({ output_text: JSON.stringify(payload) });
  } });
  assert.equal(calls, 2);
});

test("twenty-image strategy repair omits accepted prompt duplicates and preserves the final prompts", async () => {
  const { input, payload } = marketingPlanFixture(20);
  input.analysisValidated = true;
  let calls = 0;
  const contexts = [];
  const plan = await requestCreationMarketingPlan({ input, referenceImages: [{ filename: "gloves.png", mimeType: "image/png", base64: "eA==" }], config: { baseUrl: "https://example.test/v1", apiKey: "test", responsesModel: "fixed-fixture", reasoningEffort: "high" }, fetchImpl: async (_url, init) => {
    calls += 1;
    const body = JSON.parse(init.body);
    assert.equal(init.headers["X-Client-Request-Attempt"], String(calls));
    assert.equal(body.reasoning.effort, "high");
    const context = JSON.parse(body.input[0].content[1].text);
    contexts.push(context);
    assert.deepEqual(body.text.format.schema.required, ["suite_strategy", "items"]);
    if (calls > 1) {
      assert.equal(context.repair_request.accepted_items.length, 20);
      assert.ok(context.repair_request.accepted_items.every((item) => !Object.hasOwn(item, "prompt")));
      assert.deepEqual(context.product_insights.confirmedFacts, contexts[0].product_insights.confirmedFacts);
    }
    return Response.json({ output_text: JSON.stringify({ suite_strategy: calls === 1 ? { ...payload.suite_strategy, primary_fact_ids: ["invalid-strategy"] } : payload.suite_strategy, items: calls === 1 ? payload.items : [] }), usage: { input_tokens: 50, output_tokens: 30 } });
  } });
  assert.equal(calls, 2);
  assert.equal(plan.imageCount, 20);
  assert.ok(plan.items.every((item, index) => item.prompt.includes(payload.items[index].prompt)));
  assert.equal(plan.marketingPlan.requestTrace.calls.length, 2);
  assert.deepEqual(plan.marketingPlan.requestTrace.calls.map((call) => call.repairRound), [0, 1]);
  assert.deepEqual(plan.marketingPlan.requestTrace.calls.map((call) => call.attempt), [1, 2]);
  assert.ok(Number.isFinite(plan.marketingPlan.requestTrace.validationMs));
  assert.ok(Number.isFinite(plan.marketingPlan.requestTrace.totalMs));
  assert.ok(plan.marketingPlan.requestTrace.calls.every((call) => call.usage.outputTokens === 30));
});

test("reasoning fallback records separate real POST timings under one logical operation", async () => {
  const events = [];
  const requests = [];
  await requestStreamingText(async (_url, init) => {
    requests.push(init);
    return requests.length === 1
      ? Response.json({ error: { param: "reasoning.effort", code: "unsupported_value", message: "Supported values: medium" } }, { status: 400 })
      : Response.json({ output_text: "回答", usage: { input_tokens: 0, output_tokens: 1 } });
  }, "https://example.test/responses", { body: '{"reasoning":{"effort":"high"}}' }, { onProgress: (event) => events.push(event) });
  assert.equal(requests.length, 2);
  assert.equal(new Set(events.map((event) => event.requestId)).size, 1);
  const waiting = events.filter((event) => event.stage === "waiting");
  assert.deepEqual(waiting.map((event) => event.attempt), [1, 2]);
  assert.notEqual(waiting[0].callId, waiting[1].callId);
  assert.equal(events.find((event) => event.httpStatus === 400).timing.totalMs >= 0, true);
  assert.deepEqual(waiting[1].timing, {});
  assert.equal(events.at(-1).usage.outputTokens, 1);
});

test("timing presentation distinguishes the first network packet from the first answer", () => {
  const waiting = formatTextModelTiming({ timing: { headersMs: 0, firstByteMs: 100, firstTextMs: undefined }, usage: {} });
  assert.match(waiting, /连接响应 0\.0 秒.*上游首包 0\.1 秒/);
  assert.doesNotMatch(waiting, /首段回答|token|undefined|NaN/);
  assert.match(formatTextModelTiming({ timing: { firstTextMs: 250, receiveMs: 2000, validationMs: 5 }, usage: { outputTokens: 0 } }), /首段回答 0\.3 秒.*回答接收 2\.0 秒.*校验 0\.0 秒.*输出 0 token/);
  let progress = updateCreationMarketingProgress(null, { stage: "connected", attempt: 1, timing: { firstByteMs: 100 } });
  assert.equal(progress.receivedCharacters, 0);
  assert.equal(progress.receivedCount, 0);
  progress = updateCreationMarketingProgress(progress, { stage: "complete" });
  assert.equal(updateCreationMarketingProgress(progress, { stage: "connected", attempt: 1 }), progress);
});

test("connection and stream cancellation preserve safe timing evidence without retrying", async () => {
  for (const reading of [false, true]) {
    const abort = new AbortController();
    const events = [];
    let calls = 0;
    const pending = requestStreamingText(async (_url, init) => {
      calls += 1;
      if (reading) return new Response(new ReadableStream(), { headers: { "content-type": "text/event-stream" } });
      return new Promise((_resolve, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason), { once: true }));
    }, "https://example.test/v1/responses", { body: "{}", signal: abort.signal }, { onProgress: (event) => events.push(event) });
    await next();
    abort.abort();
    await assert.rejects(pending, /abort/i);
    assert.equal(calls, 1);
    assert.equal(events.at(-1).stage, "interrupted");
    assert.ok(Number.isFinite(events.at(-1).timing.totalMs));
    assert.equal(events.at(-1).timing.firstTextMs, undefined);
  }
});

test("Chat usage arriving after finish_reason is measured without changing the answer", async () => {
  let source;
  const events = [];
  const encoder = new TextEncoder();
  const stream = new ReadableStream({ start(controller) { source = controller; } });
  const pending = requestStreamingText(async () => new Response(stream, { headers: { "content-type": "text/event-stream" } }), "https://example.test/chat/completions", { body: "{}" }, { onProgress: (event) => events.push(event) });
  source.enqueue(encoder.encode('data: {"choices":[{"delta":{"content":"回答"},"finish_reason":"stop"}]}\n\n'));
  await next();
  source.enqueue(encoder.encode('data: {"choices":[],"usage":{"prompt_tokens":10,"completion_tokens":5}}\n\ndata: [DONE]\n\n'));
  source.close();
  assert.equal((await (await pending).json()).output_text, "回答");
  assert.deepEqual(events.at(-1).usage, { inputTokens: 10, outputTokens: 5 });
});
