import assert from "node:assert/strict";
import test from "node:test";

import { createPortraitReferenceAnalysisController } from "../lib/portrait-reference-analysis-client.mjs";

function createElementStub({ value = "" } = {}) {
  return {
    value,
    textContent: "",
    disabled: false,
    dataset: {},
    classList: { toggle() {} },
    appendChild() {},
    replaceChildren() {},
  };
}

function installDocument(elements) {
  const originalDocument = globalThis.document;
  globalThis.document = {
    querySelector: (selector) => elements.get(selector) || null,
    createElement: () => createElementStub(),
    createTextNode: (value) => String(value),
  };
  return () => { globalThis.document = originalDocument; };
}

function createController({ state, fetchImpl }) {
  return createPortraitReferenceAnalysisController({
    state,
    appendCurrentConfigToFormData() {},
    buildReferenceFingerprint: (file) => file?.name || "missing",
    compactErrorMessage: (message) => message,
    renderPortraitView() {},
    showError() {},
    fetchImpl,
  });
}

test("portrait reference analysis ignores a response after reference files change", async () => {
  const elements = new Map([
    ["#portraitReferenceAnalyzeButton", createElementStub()],
    ["#portraitReferenceApplyAnalysisButton", createElementStub()],
    ["#portraitReferenceAnalysisFeedback", createElementStub()],
    ["#portraitReferenceAnalysisPanel", createElementStub()],
    ["#portraitSubjectSummaryInput", createElementStub()],
  ]);
  const restoreDocument = installDocument(elements);
  const oldFile = new File(["old"], "old.png", { type: "image/png" });
  const newFile = new File(["new"], "new.png", { type: "image/png" });
  const state = {
    portrait: {
      files: [{ file: oldFile, fingerprint: "old" }],
      actionFiles: [], accessoryFiles: [], currentSet: null,
      referenceAnalysis: { applied: false, result: null, running: false },
    },
  };
  let resolveResponse;
  const controller = createController({
    state,
    fetchImpl: () => new Promise((resolve) => { resolveResponse = resolve; }),
  });

  try {
    const pending = controller.analyze();
    state.portrait.files = [{ file: newFile, fingerprint: "new" }];
    resolveResponse(new Response(JSON.stringify({ analysis: { summary: "旧分析" } }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }));
    await pending;
    assert.equal(state.portrait.referenceAnalysis.result, null);
  } finally {
    restoreDocument();
  }
});

test("portrait reference analysis only updates the subject after explicit apply", async () => {
  const subjectInput = createElementStub({ value: "手写描述" });
  const elements = new Map([
    ["#portraitReferenceAnalyzeButton", createElementStub()],
    ["#portraitReferenceApplyAnalysisButton", createElementStub()],
    ["#portraitReferenceAnalysisFeedback", createElementStub()],
    ["#portraitReferenceAnalysisPanel", createElementStub()],
    ["#portraitSubjectSummaryInput", subjectInput],
  ]);
  const restoreDocument = installDocument(elements);
  const file = new File(["person"], "person.png", { type: "image/png" });
  const state = {
    portrait: {
      files: [{ file, fingerprint: "person" }],
      actionFiles: [], accessoryFiles: [], currentSet: { setId: "old" },
      referenceAnalysis: { applied: false, result: null, running: false },
    },
  };
  const controller = createController({
    state,
    fetchImpl: async () => new Response(JSON.stringify({
      analysis: { summary: "成年人物", clothing: "深色外套" },
    }), { status: 200, headers: { "content-type": "application/json" } }),
  });

  try {
    await controller.analyze();
    assert.equal(subjectInput.value, "手写描述");
    assert.equal(state.portrait.referenceAnalysis.applied, false);
    controller.apply();
    assert.match(subjectInput.value, /成年人物/);
    assert.match(subjectInput.value, /深色外套/);
    assert.equal(state.portrait.referenceAnalysis.applied, true);
    assert.equal(state.portrait.currentSet, null);
  } finally {
    restoreDocument();
  }
});
