import test from "node:test";
import assert from "node:assert/strict";
import { consumePromptAgentSse, requestPromptAgentAnalysis } from "../lib/prompt-agent.mjs";
import { marketingPlanFixture } from "./fixtures/creation-marketing-plan.mjs";
import { readCreationMarketingPartialJson, summarizeCreationMarketingProgress, updateCreationMarketingProgress, getCreationMarketingProgressForView } from "../lib/creation-marketing-progress.mjs";
import { createCreationPlanPreviewRequestCoordinator } from "../lib/creation-browser-plan-state.mjs";
import { consumeSse } from "../lib/generation-client.mjs";
import { consumeSseUntilTerminal } from "../lib/sse-terminal-client.mjs";

test("marketing SSE reports output before completion and never forwards reasoning", async () => {
  const { payload } = marketingPlanFixture(2);
  const text = JSON.stringify(payload);
  const split = text.indexOf(',{"item_id":"ai-2"');
  assert.ok(split > 0);
  let source;
  const stream = new ReadableStream({ start(controller) { source = controller; } });
  const encoder = new TextEncoder();
  const emit = (type, data) => source.enqueue(encoder.encode(`event: ${type}\ndata: ${JSON.stringify({ type, ...data })}\n\n`));
  const progress = [];
  let resolved = false;
  const result = consumePromptAgentSse(stream, "creation-marketing-plan", (event) => progress.push(event)).then((value) => { resolved = true; return value; });
  emit("response.reasoning_text.delta", { delta: "PRIVATE_REASONING" });
  emit("response.output_text.delta", { delta: text.slice(0, split) });
  await new Promise((done) => setImmediate(done));
  assert.equal(resolved, false);
  assert.equal(progress.at(-1)?.text, text.slice(0, split));
  assert.doesNotMatch(JSON.stringify(progress), /PRIVATE_REASONING/);
  emit("response.output_text.delta", { delta: text.slice(split) });
  source.enqueue(encoder.encode("data: [DONE]\n\n"));
  source.close();
  assert.deepEqual(await result, payload);
});

test("actual whole-set retries report a new attempt without adding requests", async () => {
  const { payload } = marketingPlanFixture(2);
  const events = [];
  let calls = 0;
  const result = await requestPromptAgentAnalysis({
    baseUrl: "https://example.test/v1", apiKey: "test", responsesModel: "test",
    mode: "creation-marketing-plan", contextPrompt: '{"task_count":2}',
    onProgress: (event) => events.push(event),
    fetchImpl: async () => {
      calls += 1;
      const value = calls === 1 ? { summary: "incomplete" } : payload;
      return Response.json({ output_text: JSON.stringify(value) });
    },
  });
  assert.deepEqual(result, payload);
  assert.equal(calls, 2);
  assert.deepEqual(events.filter((event) => event.stage === "waiting").map((event) => event.attempt), [1, 2]);
  assert.ok(events.some((event) => event.stage === "retrying"));
});

test("partial JSON extracts only complete top-level fields and complete items across every split", () => {
  const { payload } = marketingPlanFixture(2);
  payload.items[0].title = '引号 "、转义 \\、括号 } ] 与中文';
  const source = JSON.stringify(payload);
  const firstItemEnd = source.indexOf(',{"item_id":"ai-2"');
  for (let split = 0; split < source.length; split += 1) {
    const partial = readCreationMarketingPartialJson(source.slice(0, split));
    assert.equal(partial.items?.length || 0, split >= source.length - 2 ? 2 : split >= firstItemEnd ? 1 : 0, `split ${split}`);
    if (partial.items?.length) assert.deepEqual(partial.items[0], payload.items[0]);
  }
  assert.deepEqual(readCreationMarketingPartialJson(source), {
    audience_strategy: payload.audience_strategy, product_insights: payload.product_insights, items: payload.items,
  });
  assert.deepEqual(readCreationMarketingPartialJson('prose {"items":[{"item_id":"nested"}]}'), {});
  assert.deepEqual(readCreationMarketingPartialJson('{"outer":{"items":[{"item_id":"nested"}]}}'), {});
  const summary = summarizeCreationMarketingProgress(readCreationMarketingPartialJson(source.slice(0, firstItemEnd)));
  assert.equal(summary.receivedCount, 1);
  assert.equal(summary.items[0].itemId, "ai-1");
  assert.equal(summary.items[0].sourceIndex, 1);
  assert.equal(summary.summary.audiences.length, 3);
  assert.ok(summary.summary.sellingPoints.length);
  assert.equal(summary.items[0].goal, payload.items[0].marketing_goal);
  assert.equal(Object.hasOwn(summary.items[0], "prompt"), false);
  const sparse = summarizeCreationMarketingProgress({ items: [
    { ...payload.items[0], prompt: "" },
    { ...payload.items[1], marketingAssignment: { sourceIndex: 9, goal: payload.items[1].marketing_goal, referenceIndexes: [1] } },
  ] });
  assert.equal(sparse.items[0].itemId, "ai-2");
  assert.equal(sparse.items[0].sourceIndex, 9, "filtered tasks retain the validated original slot");
});

test("retries reset partial output and late events cannot overwrite a terminal or newer attempt", () => {
  let progress = updateCreationMarketingProgress(null, { stage: "waiting", attempt: 1, total: 20 }, 1000);
  progress = updateCreationMarketingProgress(progress, { stage: "receiving", receivedCount: 8, receivedCharacters: 400, summary: { audiences: ["旧分析"] }, items: [{ title: "旧任务" }] }, 3000);
  progress = updateCreationMarketingProgress(progress, { stage: "waiting", attempt: 2 }, 4000);
  assert.equal(progress.receivedCount, 0);
  assert.equal(progress.receivedCharacters, 0);
  assert.deepEqual(progress.items, []);
  assert.deepEqual(progress.summary, {});
  assert.equal(updateCreationMarketingProgress(progress, { stage: "receiving", attempt: 1, receivedCount: 20 }, 5000), progress);
  progress = updateCreationMarketingProgress(progress, { stage: "error", message: "无效参考" }, 7000);
  assert.equal(progress.elapsedMs, 6000);
  assert.equal(updateCreationMarketingProgress(progress, { stage: "receiving", attempt: 2, receivedCount: 20 }, 8000), progress);
});

test("progress follows the selected queue job and current preview revision", () => {
  const preview = { stage: "complete", setId: "draft-a" };
  const jobA = { marketingProgress: { stage: "receiving", receivedCount: 3 } };
  const jobB = { marketingProgress: { stage: "receiving", receivedCount: 7 } };
  assert.equal(getCreationMarketingProgressForView({ preview, selectedJob: jobA }), jobA.marketingProgress);
  assert.equal(getCreationMarketingProgressForView({ preview, selectedJob: jobB }), jobB.marketingProgress);
  assert.equal(getCreationMarketingProgressForView({ preview, selectedJob: {} }), null);
  assert.equal(getCreationMarketingProgressForView({ preview, setId: "other" }), null);
  assert.equal(getCreationMarketingProgressForView({ preview, planning: true, selectedJob: jobB }), preview);
  assert.equal(getCreationMarketingProgressForView({ preview, previewSelected: true, selectedJob: jobB }), preview);
  const coordinator = createCreationPlanPreviewRequestCoordinator();
  const old = coordinator.begin();
  coordinator.invalidate();
  const current = coordinator.begin();
  let displayed = null;
  const receive = (request, event) => { if (coordinator.isCurrent(request.revision)) displayed = event; };
  receive(current, "new-product");
  receive(old, "old-product");
  assert.equal(displayed, "new-product");
  assert.equal(old.signal.aborted, true);
});

test("a planning stream with partial output but no terminal is interrupted", async () => {
  const data = `event: marketing_progress\ndata: ${JSON.stringify({ stage: "receiving", receivedCount: 8 })}\n\n`;
  await assert.rejects(consumeSseUntilTerminal({ stream: new Response(data).body, consumeSse, onEvent: () => {}, missingTerminalMessage: "规划中断" }), /规划中断/);
});
