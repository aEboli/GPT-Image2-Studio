import test from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_REASONING_EFFORT, REASONING_EFFORT_OPTIONS } from "../lib/studio-constants.mjs";
import { requestStreamingText } from "../lib/text-model-stream.mjs";
import { requestPromptAgentAnalysis } from "../lib/prompt-agent.mjs";
import { requestDirectImageGeneration, requestImageGeneration } from "../lib/responses-workflow.mjs";
import { mapReasoningRequest, nearestReasoningEffort, requestWithReasoningFallback } from "../lib/reasoning-effort.mjs";

const options = ["none", "minimal", "low", "medium", "high", "xhigh", "max"];
const init = (effort = "max") => ({ method: "POST", body: JSON.stringify({ model: "custom-model", input: "你好", reasoning: { effort, summary: "auto" } }) });

test("reasoning defaults to high and offers none through max", () => {
  assert.equal(DEFAULT_REASONING_EFFORT, "high");
  assert.deepEqual(REASONING_EFFORT_OPTIONS, options);
});

test("Responses to Chat conversion retains selected effort including none", async () => {
  for (const effort of options) {
    let body;
    await requestStreamingText(async (_url, request) => {
      body = JSON.parse(request.body);
      return Response.json({ output_text: "你好" });
    }, "https://reasoning.test/v1/chat/completions", init(effort));
    assert.equal(body.reasoning_effort, effort);
    assert.equal(body.reasoning, undefined);
    assert.equal(body.messages[0].content, "你好");
  }
});

test("unsupported reasoning selects nearest advertised effort and reports the adjustment", async () => {
  for (const [requested, supported, actual] of [
    ["max", ["low", "medium", "high"], "high"],
    ["none", ["minimal", "low", "high"], "minimal"],
    ["medium", ["low", "high"], "low"],
  ]) {
    const calls = [];
    const events = [];
    const response = await requestStreamingText(async (_url, request) => {
      calls.push(JSON.parse(request.body));
      return calls.length === 1
        ? Response.json({ error: { param: "reasoning.effort", code: "unsupported_value", message: `Unsupported value '${requested}'. Supported values are: ${supported.map((value) => `'${value}'`).join(", ")}.` } }, { status: 400 })
        : Response.json({ output_text: "你好" });
    }, "https://reasoning.test/v1/responses", init(requested), { onProgress: (event) => events.push(event) });
    assert.equal(response.ok, true);
    assert.equal(calls.length, 2);
    assert.equal(calls[1].reasoning.effort, actual);
    assert.equal(calls[1].reasoning.summary, "auto");
    assert.equal(events.find((event) => event.stage === "retrying")?.actualReasoningEffort, actual);
  }
});

test("an unsupported Chat reasoning parameter is omitted without dropping other fields", async () => {
  const calls = [];
  const response = await requestStreamingText(async (_url, request) => {
    calls.push(JSON.parse(request.body));
    return calls.length === 1
      ? Response.json({ error: { param: "reasoning_effort", code: "unsupported_parameter", message: "Unknown parameter: reasoning_effort" } }, { status: 400 })
      : Response.json({ output_text: "你好" });
  }, "https://reasoning.test/v1/chat/completions", init("high"));
  assert.equal(response.ok, true);
  assert.equal(calls[1].reasoning_effort, undefined);
  assert.equal(calls[1].messages[0].content, "你好");
});

test("unrelated failures and exhausted compatibility do not trigger extra POSTs", async () => {
  for (const [status, message, count] of [[401, "Unsupported reasoning_effort", 1], [429, "reasoning effort rate limit", 1], [400, "unsupported image quality", 1], [500, "unsupported reasoning_effort", 1], [400, "Unsupported value for reasoning.effort. Supported values: 'high'", 2]]) {
    let calls = 0;
    const response = await requestStreamingText(async () => {
      calls += 1;
      return Response.json({ error: { message } }, { status });
    }, "https://reasoning.test/v1/responses", init());
    assert.equal(response.status, status);
    assert.equal(calls, count);
    assert.equal((await response.json()).error.message, message);
  }
});

test("nearest effort handles a one-sided upgrade, downgrade and empty support list", () => {
  assert.equal(nearestReasoningEffort("none", ["low", "medium", "high"]), "low");
  assert.equal(nearestReasoningEffort("xhigh", ["none", "high", "max"]), "high");
  assert.equal(nearestReasoningEffort("max", []), undefined);
  assert.deepEqual(mapReasoningRequest({ model: "m", reasoning_effort: "none" }, "https://reasoning.test/responses?version=1"), { model: "m", reasoning: { effort: "none" } });
});

test("compatibility preserves the original response and does not re-POST an existing task", async () => {
  for (const payload of [
    { error: { param: "tools[0].quality", code: "unsupported_value", message: "Unsupported quality with reasoning.effort high" } },
    { id: "resp_existing", error: { param: "reasoning.effort", code: "unsupported_value", message: "Unsupported reasoning effort. Supported values: high" } },
  ]) {
    let count = 0;
    const response = await requestWithReasoningFallback(async () => { count += 1; return Response.json(payload, { status: 400 }); }, "https://reasoning.test/responses", init());
    assert.equal(count, 1);
    assert.deepEqual(await response.json(), payload);
  }
});

test("cancelling before compatibility retry sends only one request", async () => {
  const controller = new AbortController();
  let count = 0;
  await assert.rejects(requestWithReasoningFallback(async () => {
    count += 1;
    return Response.json({ error: { param: "reasoning.effort", code: "unsupported_value", message: "Unsupported value. Supported values: high" } }, { status: 400 });
  }, "https://reasoning.test/responses", { ...init(), signal: controller.signal }, { onAdjustment: () => controller.abort() }), /abort/i);
  assert.equal(count, 1);
});

test("native Chat prompt analysis transmits the chosen effort", async () => {
  for (const effort of ["none", "minimal", "max"]) {
    const calls = [];
    const result = await requestPromptAgentAnalysis({ baseUrl: "https://reasoning.test/v1", endpointPath: "chat/completions", apiKey: "test", responsesModel: "custom-model", reasoningEffort: effort, image: { mimeType: "image/png", base64: "aW1hZ2U=" }, fetchImpl: async (_url, request) => {
      calls.push(JSON.parse(request.body));
      return Response.json({ choices: [{ message: { content: JSON.stringify({ prompt: "桌面上的水杯近景" }) } }] });
    } });
    assert.equal(result.prompt, "桌面上的水杯近景");
    assert.equal(calls.length, 1);
    assert.equal(calls[0].reasoning_effort, effort);
  }
});

test("reasoning compatibility and JSON repair share the prompt analysis POST budget", async () => {
  let count = 0;
  await assert.rejects(requestPromptAgentAnalysis({ baseUrl: "https://reasoning.test/v1", apiKey: "test", responsesModel: "custom-model", reasoningEffort: "max", mode: "creation-marketing-plan", contextPrompt: '{"task_count":2}', fetchImpl: async () => {
    count += 1;
    return count === 1
      ? Response.json({ error: { param: "reasoning.effort", code: "unsupported_value", message: "Unsupported value. Supported values: 'high'" } }, { status: 400 })
      : Response.json({ output_text: "{broken" });
  } }));
  assert.equal(count, 2);
});

test("a reasoning rejection after a format fallback does not advertise or send a third attempt", async () => {
  let count = 0;
  const events = [];
  await assert.rejects(requestPromptAgentAnalysis({ baseUrl: "https://reasoning.test/v1", apiKey: "test", responsesModel: "custom-model", reasoningEffort: "max", mode: "creation-marketing-plan", contextPrompt: '{"task_count":2}', onProgress: (event) => events.push(event), fetchImpl: async () => {
    count += 1;
    return count === 1
      ? Response.json({ error: { message: "response_format json_schema unsupported" } }, { status: 400 })
      : Response.json({ error: { param: "reasoning.effort", code: "unsupported_value", message: "Unsupported value. Supported values: 'high'" } }, { status: 400 });
  } }));
  assert.equal(count, 2);
  assert.equal(events.filter((event) => event.stage === "retrying").length, 1);
});

test("a model that does not support reasoning removes the parameter", async () => {
  const bodies = [];
  await requestStreamingText(async (_url, request) => {
    bodies.push(JSON.parse(request.body));
    return bodies.length === 1
      ? Response.json({ error: { message: "This model does not support reasoning_effort." } }, { status: 400 })
      : Response.json({ output_text: "你好" });
  }, "https://reasoning.test/v1/chat/completions", init("high"));
  assert.equal(bodies.length, 2);
  assert.equal(bodies[1].reasoning_effort, undefined);
});

test("text compatibility updates request attempt headers and progress", async () => {
  const attempts = [];
  const events = [];
  await requestStreamingText(async (_url, request) => {
    attempts.push(request.headers["X-Client-Request-Attempt"]);
    return attempts.length === 1
      ? Response.json({ error: { param: "reasoning.effort", code: "unsupported_value", message: "Unsupported value. Supported values: 'high'" } }, { status: 422 })
      : Response.json({ output_text: "你好" });
  }, "https://reasoning.test/v1/responses", init(), { onProgress: (event) => events.push(event) });
  assert.deepEqual(attempts, ["1", "2"]);
  assert.equal(events.at(-1).attempt, 2);
  assert.equal(events.at(-1).actualReasoningEffort, "high");
});

test("both image Responses paths negotiate reasoning without changing image quality or prompt", async () => {
  for (const request of [requestDirectImageGeneration, requestImageGeneration]) {
    const bodies = [];
    const events = [];
    const result = await request({ baseUrl: "https://reasoning.test/v1", endpointPath: "responses", apiKey: "test", responsesModel: "text-model", imageModel: "gpt-image-2", reasoningEffort: "max", prompt: "原始提示词", size: "1024x1024", quality: "high", format: "png", onEvent: (event) => events.push(event), fetchImpl: async (_url, init) => {
      bodies.push(JSON.parse(init.body));
      return bodies.length === 1
        ? Response.json({ error: { param: "reasoning.effort", code: "unsupported_value", message: "Unsupported value. Supported values: 'low', 'medium', 'high'" } }, { status: 400 })
        : request === requestDirectImageGeneration
          ? Response.json({ output: [{ type: "image_generation_call", result: "aW1hZ2U=" }] })
          : new Response('event: response.completed\ndata: {"type":"response.completed","response":{"id":"resp_final","status":"completed","output":[{"type":"image_generation_call","result":"aW1hZ2U="}]}}\n\n', { headers: { "content-type": "text/event-stream" } });
    } });
    assert.equal(bodies.length, 2);
    assert.equal(bodies[1].reasoning.effort, "high");
    assert.equal(bodies[1].tools[0].quality, "high");
    assert.deepEqual(bodies[0].input, bodies[1].input);
    assert.equal(result.finalImageBase64, "aW1hZ2U=");
    assert.equal(events.find((event) => event.stage === "retrying")?.actualReasoningEffort, "high");
  }
});
