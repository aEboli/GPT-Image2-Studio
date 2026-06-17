import test from "node:test";
import assert from "node:assert/strict";

import { createPptAnalysisController } from "../lib/ppt-analysis-client.mjs";

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
