import test from "node:test";
import assert from "node:assert/strict";
import { generatePptDeckOutline } from "../lib/ppt-deck-workflow.mjs";
import { analyzePptDocument } from "../lib/ppt-document-analysis.mjs";
import { buildArticleBundle, generateArticleIllustrationPlan } from "../lib/article-illustration-planner.mjs";
import { runWithTextModelContext } from "../lib/text-model-stream.mjs";

const common = {
  baseUrl: "https://example.test/v1",
  apiKey: "test-key",
  responsesModel: "test-model",
  reasoningEffort: "low",
};
const workflows = [
  {
    name: "PPT outline",
    generate: generatePptDeckOutline,
    options: { topic: "测试主题", pageCount: 1 },
    payload: { title: "测试大纲", summary: "摘要", slides: [{ slideNumber: 1, title: "第一页", keyMessage: "核心观点", visualBrief: "图示", speakerNotes: "备注" }] },
    verify(result) { assert.equal(result.slides[0].keyMessage, "核心观点"); },
  },
  {
    name: "PPT analysis",
    generate: analyzePptDocument,
    options: { topic: "测试主题", currentPageCount: 1 },
    payload: { summary: "测试分析", recommendedPageCount: 1, recommendedStylePreset: "business", rationale: "适合商务演示", sections: [{ title: "章节", keyMessage: "核心观点", suggestedSlides: 1 }] },
    verify(result) { assert.equal(result.sections[0].keyMessage, "核心观点"); },
  },
  {
    name: "article plan",
    generate: generateArticleIllustrationPlan,
    options: { bundle: buildArticleBundle({ sourceText: "桌上的蓝色杯子。" }) },
    payload: { title: "测试配图", contentType: "article", sourceSummary: "蓝色杯子", stylePreset: "realist-magazine", styleBible: "写实", storyboards: [{ itemId: "cup", title: "杯子", prompt: "桌上的蓝色杯子" }] },
    verify(result) { assert.equal(result.items[0].prompt, "桌上的蓝色杯子"); },
  },
];

function modelResponse(payload, endpointPath, transport = "buffered") {
  const text = JSON.stringify(payload);
  const chat = endpointPath === "/chat/completions";
  const body = chat
    ? { choices: [{ index: 0, message: { role: "assistant", content: text }, finish_reason: "stop" }], usage: { prompt_tokens: 10, completion_tokens: 20 } }
    : { output: [{ type: "message", content: [{ type: "output_text", text }] }], usage: { input_tokens: 10, output_tokens: 20 } };
  if (transport === "stream") {
    const chunks = chat
      ? [{ choices: [{ delta: { content: text } }] }, { choices: [], usage: body.usage }]
      : [{ type: "response.output_text.delta", delta: text }, { type: "response.completed", response: body }];
    return new Response(chunks.map((chunk) => `data: ${JSON.stringify(chunk)}\n\n`).join("") + "data: [DONE]\n\n", { headers: { "content-type": "text/event-stream" } });
  }
  return Response.json(body, { headers: { "content-type": transport === "buffered-sse-header" ? "text/event-stream" : "application/json" } });
}

for (const workflow of workflows) {
  for (const endpointPath of ["/responses", "/chat/completions"]) {
    for (const transport of ["buffered", "buffered-sse-header", "stream"]) {
      test(`${workflow.name} accepts ${endpointPath} ${transport} without retry`, async () => {
        const requests = [];
        const events = [];
        const result = await runWithTextModelContext({ onProgress: (event) => events.push(event) }, () => workflow.generate({
          ...common, ...workflow.options, endpointPath,
          fetchImpl: async (url, init) => {
            requests.push({ url, body: JSON.parse(init.body) });
            return modelResponse(workflow.payload, endpointPath, transport);
          },
        }));
        workflow.verify(result);
        assert.equal(requests.length, 1);
        assert.equal(requests[0].url, `${common.baseUrl}${endpointPath}`);
        assert.equal(requests[0].body.stream, true);
        assert.deepEqual(events.at(-1).usage, { inputTokens: 10, outputTokens: 20 });
        if (transport !== "stream") {
          assert.equal(events.at(-1).transport, "buffered");
          assert.equal(events.some((event) => event.stage === "receiving"), false);
        }
      });
    }

    for (const status of [401, 403]) {
      test(`${workflow.name} stops on ${endpointPath} HTTP ${status} and preserves the error`, async () => {
        let calls = 0;
        let failure;
        try {
          await workflow.generate({
            ...common, ...workflow.options, endpointPath,
            fetchImpl: async () => {
              calls += 1;
              return Response.json({ error: { code: status === 401 ? "invalid_api_key" : "permission_denied", message: "Access rejected" } }, { status });
            },
          });
        } catch (error) { failure = error; }
        assert.equal(calls, 1);
        assert.equal(failure?.status, status);
        assert.match(failure.message, new RegExp(`HTTP ${status}`));
        assert.match(failure.message, /Access rejected/);
      });
    }

    test(`${workflow.name} does not retry an AbortError from ${endpointPath}`, async () => {
      let calls = 0;
      const failure = new DOMException("测试取消", "AbortError");
      await assert.rejects(workflow.generate({
        ...common, ...workflow.options, endpointPath,
        fetchImpl: async () => { calls += 1; throw failure; },
      }), (error) => {
        assert.equal(calls, 1);
        assert.equal(error, failure);
        return true;
      });
    });

    test(`${workflow.name} forwards a cancelled signal without a second ${endpointPath} call`, async () => {
      const controller = new AbortController();
      const reason = new Error("用户取消");
      let calls = 0;
      let receivedSignal;
      await assert.rejects(workflow.generate({
        ...common, ...workflow.options, endpointPath, signal: controller.signal,
        fetchImpl: async (_url, init) => {
          calls += 1;
          receivedSignal = init.signal;
          controller.abort(reason);
          throw reason;
        },
      }), (error) => {
        assert.equal(calls, 1);
        assert.equal(receivedSignal, controller.signal);
        assert.equal(error, reason);
        return true;
      });
    });

    test(`${workflow.name} does not send ${endpointPath} with a pre-cancelled signal`, async () => {
      const controller = new AbortController();
      controller.abort();
      let calls = 0;
      await assert.rejects(workflow.generate({
        ...common, ...workflow.options, endpointPath, signal: controller.signal,
        fetchImpl: async () => { calls += 1; return modelResponse(workflow.payload, endpointPath); },
      }), { name: "AbortError" });
      assert.equal(calls, 0);
    });

    test(`${workflow.name} repairs invalid JSON within two ${endpointPath} calls`, async () => {
      let calls = 0;
      const result = await workflow.generate({
        ...common, ...workflow.options, endpointPath,
        fetchImpl: async () => {
          calls += 1;
          return calls === 1 ? Response.json({ output_text: "{broken" }) : modelResponse(workflow.payload, endpointPath);
        },
      });
      workflow.verify(result);
      assert.equal(calls, 2);
    });

    test(`${workflow.name} shares the ${endpointPath} reasoning fallback and JSON repair budget`, async () => {
      const requests = [];
      await assert.rejects(workflow.generate({
        ...common, ...workflow.options, endpointPath,
        fetchImpl: async (_url, init) => {
          requests.push(JSON.parse(init.body));
          return requests.length === 1
            ? Response.json({ error: { code: "unsupported_parameter", param: "reasoning", message: "reasoning parameter is not supported" } }, { status: 400 })
            : Response.json({ output_text: "{broken" });
        },
      }));
      assert.equal(requests.length, 2);
      assert.equal(requests[1].reasoning, undefined);
      assert.equal(requests[1].reasoning_effort, undefined);
    });

    test(`${workflow.name} keeps a second ${endpointPath} failure intact`, async () => {
      let calls = 0;
      const failure = Object.assign(new Error("Permission changed"), { status: 403, code: "permission_denied" });
      await assert.rejects(workflow.generate({
        ...common, ...workflow.options, endpointPath,
        fetchImpl: async () => {
          calls += 1;
          if (calls === 1) return Response.json({ output_text: "{broken" });
          throw failure;
        },
      }), (error) => {
        assert.equal(error, failure);
        return true;
      });
      assert.equal(calls, 2);
    });
  }

  test(`${workflow.name} cancels a context stream and keeps its cancellation reason`, async () => {
    const controller = new AbortController();
    const reason = new Error("用户取消流");
    let calls = 0;
    let cancelled = false;
    let start;
    const started = new Promise((resolve) => { start = resolve; });
    const pending = runWithTextModelContext({ signal: controller.signal }, () => workflow.generate({
      ...common, ...workflow.options, endpointPath: "/responses",
      fetchImpl: async () => {
        calls += 1;
        start();
        return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { "content-type": "text/event-stream" } });
      },
    }));
    await started;
    controller.abort(reason);
    await assert.rejects(pending, (error) => {
      assert.equal(error, reason);
      return true;
    });
    assert.equal(calls, 1);
    assert.equal(cancelled, true);
  });
}

for (const workflow of workflows.slice(0, 2)) {
  for (const endpointPath of ["/responses", "/chat/completions"]) {
    test(`${workflow.name} sends a PDF in the ${endpointPath} content format`, async () => {
      let body;
      const base64 = Buffer.from("%PDF-1.4\nfixture").toString("base64");
      const file = { filename: "测试资料.pdf", file_data: `data:application/pdf;base64,${base64}` };
      const result = await workflow.generate({
        ...common, ...workflow.options, endpointPath,
        sourceDocuments: [{ filename: file.filename, mimeType: "application/pdf", base64 }],
        fetchImpl: async (_url, init) => {
          body = JSON.parse(init.body);
          // Isolate request conversion from the independently covered response conversion.
          return Response.json({ output_text: JSON.stringify(workflow.payload) });
        },
      });
      workflow.verify(result);
      if (endpointPath === "/chat/completions") {
        assert.deepEqual(body.messages[0].content[0], { type: "file", file });
        assert.equal(body.messages[0].content[1].type, "text");
        assert.equal(body.input, undefined);
        assert.equal(body.response_format.type, "json_schema");
      } else {
        assert.deepEqual(body.input[0].content[0], { type: "input_file", ...file });
        assert.equal(body.input[0].content[1].type, "input_text");
        assert.equal(body.messages, undefined);
        assert.equal(body.text.format.type, "json_schema");
      }
    });
  }
}
