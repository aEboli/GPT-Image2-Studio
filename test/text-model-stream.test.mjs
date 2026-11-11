import test from "node:test";
import assert from "node:assert/strict";
import { requestStreamingText } from "../lib/text-model-stream.mjs";
import { requestPromptAgentAnalysis } from "../lib/prompt-agent.mjs";

test("text stream forwards Chinese answer before EOF and excludes reasoning", async () => {
  let controller;
  const events = [];
  const encoder = new TextEncoder();
  const stream = new ReadableStream({ start(value) { controller = value; } });
  let body;
  const pending = requestStreamingText(async (_url, init) => {
    body = JSON.parse(init.body);
    return new Response(stream, { headers: { "content-type": "text/event-stream" } });
  }, "https://example.test/v1/chat/completions", { method: "POST", body: JSON.stringify({ model: "test", messages: [] }) }, { onProgress: (event) => events.push(event) });
  controller.enqueue(encoder.encode('data: {"choices":[{"delta":{"reasoning_content":"PRIVATE"}}]}\n\n'));
  const bytes = encoder.encode('data: {"choices":[{"delta":{"content":"中文"}}]}\n\n');
  for (const value of bytes) controller.enqueue(Uint8Array.of(value));
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(body.stream, true);
  assert.equal(events.at(-1).text, "中文");
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE/);
  controller.enqueue(encoder.encode('data: [DONE]\n\n'));
  controller.close();
  assert.equal((await (await pending).json()).output_text, "中文");
});

test("Gemini answer deltas exclude thought parts", async () => {
  const events = [];
  const data = [{ candidates: [{ content: { parts: [{ text: "PRIVATE", thought: true }, { text: "你好" }] } }] }, { candidates: [{ content: { parts: [{ text: "世界" }] }, finishReason: "STOP" }] }];
  const response = await requestStreamingText(async () => new Response(data.map((value) => `data: ${JSON.stringify(value)}\n\n`).join(""), { headers: { "content-type": "text/event-stream" } }), "https://example.test/images/generations", { body: '{"contents":[]}' }, { onProgress: (event) => events.push(event) });
  assert.equal((await response.json()).output_text, "你好世界");
  assert.doesNotMatch(JSON.stringify(events), /PRIVATE/);
});

test("structured fallback and JSON repair share a two POST budget", async () => {
  let calls = 0;
  await assert.rejects(requestPromptAgentAnalysis({ baseUrl: "https://example.test/v1", apiKey: "test", responsesModel: "test", mode: "creation-marketing-plan", contextPrompt: '{"task_count":2}', fetchImpl: async () => {
    calls += 1;
    return calls === 1 ? new Response('{"error":{"message":"response_format json_schema unsupported"}}', { status: 400 }) : Response.json({ output_text: "{broken" });
  } }));
  assert.equal(calls, 2);
});

test("aborting a text stream cancels the reader promptly", async () => {
  const abort = new AbortController();
  let cancelled = false;
  const pending = requestStreamingText(async () => new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "content-type": "text/event-stream" } }), "https://example.test/responses", { body: "{}", signal: abort.signal });
  await new Promise((resolve) => setImmediate(resolve));
  abort.abort();
  await assert.rejects(pending, /abort/i);
  assert.equal(cancelled, true);
});

test("buffered Chat answers retain the original payload and usage", async () => {
  const payload = {
    id: "chat-test",
    choices: [{ message: { role: "assistant", content: "完整回答" }, finish_reason: "stop" }],
    usage: { prompt_tokens: 12, completion_tokens: 34, total_tokens: 46, completion_tokens_details: { reasoning_tokens: 20 } },
  };
  const response = await requestStreamingText(async () => Response.json(payload), "https://example.test/v1/chat/completions", { body: '{"input":[]}' });
  assert.deepEqual(await response.json(), { ...payload, output_text: "完整回答" });
  assert.notEqual(response.textModelStreamed, true);
});

test("buffered Responses payloads preserve structured content and error details", async () => {
  for (const payload of [
    { output: [{ type: "message", content: [{ type: "output_json", json: { title: "结构化结果" } }] }], usage: { input_tokens: 1, output_tokens: 2 } },
    { error: { code: "permission_denied", type: "invalid_request_error", message: "Access rejected" }, usage: { input_tokens: 1 } },
  ]) {
    const response = await requestStreamingText(async () => Response.json(payload), "https://example.test/v1/responses", { body: '{"input":[]}' });
    assert.deepEqual(await response.json(), payload);
  }
});

test("buffered Chat error payloads are preserved", async () => {
  const payload = { error: { code: "invalid_api_key", message: "Access rejected" } };
  for (const status of [200, 401, 403]) {
    const response = await requestStreamingText(async () => Response.json(payload, { status }), "https://example.test/v1/chat/completions", { body: '{"input":[]}' });
    assert.equal(response.status, status);
    assert.deepEqual(await response.json(), payload);
  }
});
