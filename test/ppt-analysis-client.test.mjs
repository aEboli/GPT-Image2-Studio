import test from "node:test";
import assert from "node:assert/strict";

import { createPptAnalysisController } from "../lib/ppt-analysis-client.mjs";
import { readHttpResponseErrorMessage } from "../lib/http-response-error.mjs";

test("PPT requests preserve JSON error messages", async () => {
  const message = await readHttpResponseErrorMessage(new Response(JSON.stringify({
    message: "PPT 大纲页数与请求不一致。",
  }), { status: 400 }), "PPT 请求失败");
  assert.equal(message, "PPT 大纲页数与请求不一致。");
});

function createElementStub({ value = "", options = [] } = {}) {
  return {
    value,
    options,
    textContent: "",
    innerHTML: "",
    disabled: false,
    dataset: {},
    offsetWidth: 96,
    style: {},
    classList: {
      toggles: [],
      toggle(name, active) {
        this.toggles.push({ name, active });
      },
    },
    addEventListener() {},
    appendChild() {},
    replaceChildren(...children) {
      this.children = children;
      this.textContent = children.filter((child) => typeof child === "string").join("");
    },
    setAttribute(name, value) {
      this[name] = value;
    },
  };
}

test("PPT analysis client explains missing analyze route when the local server is stale", async () => {
  const elements = new Map([
    ["#pptAnalyzeButton", createElementStub()],
    ["#pptAnalysisFeedback", createElementStub()],
    ["#pptAnalysisMeta", createElementStub()],
    ["#pptAnalysisPanel", createElementStub()],
    ["#pptAnalysisSections", createElementStub()],
    ["#pptSourceTextInput", createElementStub()],
    ["#pptTopicInput", createElementStub()],
    ["#pptPageCountInput", createElementStub({ value: "8" })],
    ["#pptStylePresetInput", createElementStub({ value: "business" })],
    ["#pptAnalysisSummary", createElementStub()],
  ]);
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  globalThis.document = {
    querySelector(selector) {
      return elements.get(selector) || null;
    },
    querySelectorAll() {
      return [];
    },
    createElement() {
      return createElementStub();
    },
  };
  let requested = false;
  globalThis.fetch = async () => {
    requested = true;
    return new Response("<h1>Not Found</h1>", { status: 404 });
  };

  try {
    const controller = createPptAnalysisController({
      state: { ppt: { files: [new Blob(["pdf"])], generating: false } },
      buildFormData: () => new FormData(),
      compactErrorMessage: (message) => message,
      renderPptView() {},
    });

    await controller.analyze();

    assert.equal(requested, true);
    assert.match(elements.get("#pptAnalysisFeedback").textContent, /重启本地服务/);
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  }
});

test("PPT analysis ignores a response after the source changes", async () => {
  const listeners = new Map();
  const elements = new Map([
    ["#pptAnalyzeButton", createElementStub()],
    ["#pptAnalysisFeedback", createElementStub()],
    ["#pptAnalysisMeta", createElementStub()],
    ["#pptAnalysisPanel", createElementStub()],
    ["#pptAnalysisSections", createElementStub()],
    ["#pptSourceTextInput", createElementStub({ value: "旧内容" })],
    ["#pptTopicInput", createElementStub()],
    ["#pptPageCountInput", createElementStub({ value: "8" })],
    ["#pptStylePresetInput", createElementStub({ value: "business", options: [{ value: "business" }, { value: "editorial" }] })],
    ["#pptAnalysisSummary", createElementStub()],
  ]);
  for (const [selector, element] of elements) {
    element.addEventListener = (type, listener) => listeners.set(`${selector}:${type}`, listener);
  }
  const originalDocument = globalThis.document;
  const originalFetch = globalThis.fetch;
  globalThis.document = {
    querySelector: (selector) => elements.get(selector) || null,
    querySelectorAll: () => [],
    createElement: () => createElementStub(),
  };
  let resolveResponse;
  globalThis.fetch = () => new Promise((resolve) => { resolveResponse = resolve; });

  try {
    const controller = createPptAnalysisController({
      state: { ppt: { files: [], generating: false } },
      buildFormData: () => new FormData(),
      compactErrorMessage: (message) => message,
      renderPptView() {},
    });
    controller.bind();
    const pending = controller.analyze();
    elements.get("#pptSourceTextInput").value = "新内容";
    listeners.get("#pptSourceTextInput:input")?.({ target: elements.get("#pptSourceTextInput") });
    resolveResponse(new Response(JSON.stringify({ analysis: { recommendedPageCount: 3, recommendedStylePreset: "editorial", summary: "旧分析" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await pending;

    assert.equal(elements.get("#pptPageCountInput").value, "8");
    assert.equal(elements.get("#pptStylePresetInput").value, "business");
    assert.equal(elements.get("#pptAnalysisSummary").textContent, "");
  } finally {
    globalThis.document = originalDocument;
    globalThis.fetch = originalFetch;
  }
});
