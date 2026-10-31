import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { createCreationPlanPreviewRequestCoordinator } from "../lib/creation-browser-plan-state.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const renderStart = app.indexOf("function renderCreationView(");
const buttonStart = app.indexOf("  if (refs.creationPlanButton) {", renderStart);
const buttonEnd = app.indexOf("  refs.creationProgressText", buttonStart);
const requestStart = app.indexOf("function requestCreationPlanPreview(");
const requestEnd = app.indexOf("async function waitForPendingCreationPlanPreview(", requestStart);
const clickHandler = app.match(/refs\.creationPlanButton\.addEventListener\("click", \(\) => \{[\s\S]*?\n  \}\);/)?.[0];

function fixture() {
  const button = {
    textContent: "", disabled: false, title: "",
    addEventListener(event, handler) { this[event] = handler; },
  };
  const creation = { planning: false, effectivePlan: null, planDirty: true };
  const coordinator = createCreationPlanPreviewRequestCoordinator();
  let previewCalls = 0;
  let finishPreview;
  const context = {
    refs: { creationPlanButton: button }, state: { creation },
    creationPlanPreviewRequests: coordinator,
    isCreationMarketingBatchRunning: () => false,
    buildCreationPlanPreviewFormData: () => new FormData(),
    appendCurrentConfigToFormData() {},
    getCreationReferenceAnalysisSnapshot: () => "current-input",
    setCreationFeedback(message) { throw new Error(message); },
    previewCreationPlan() {
      previewCalls += 1;
      creation.planning = true;
      context.render();
      return new Promise((resolve) => {
        finishPreview = () => {
          creation.effectivePlan = { items: [{ itemId: `plan-${previewCalls}` }] };
          creation.planDirty = false;
          creation.planning = false;
          context.render();
          resolve();
        };
      });
    },
  };
  assert.ok(buttonStart > renderStart && buttonEnd > buttonStart);
  assert.ok(clickHandler);
  runInNewContext(`
    this.render = function () { ${app.slice(buttonStart, buttonEnd)} };
    let creationPreviewInFlight = null;
    ${app.slice(requestStart, requestEnd)}
    ${clickHandler}
  `, context);
  return { button, creation, coordinator, render: context.render,
    get previewCalls() { return previewCalls; },
    finishPreview: () => finishPreview(),
  };
}

test("plan button shows a clickable completed state after a current plan is ready", () => {
  const { button, creation, render } = fixture();
  render();
  assert.equal(button.textContent, "生成套图方案");
  assert.equal(button.disabled, false);
  creation.effectivePlan = { items: [{ itemId: "hero" }] };
  creation.planDirty = false;
  render();
  assert.equal(button.textContent, "方案已完成");
  assert.equal(button.disabled, false);
  assert.match(button.title, /重新生成/);
});

test("planning takes precedence over an existing completed plan", () => {
  const { button, creation, render } = fixture();
  Object.assign(creation, { planning: true, effectivePlan: { items: [] }, planDirty: false });
  render();
  assert.equal(button.textContent, "方案生成中...");
  assert.equal(button.disabled, true);
});

test("a dirty or cleared plan no longer shows completion", () => {
  const { button, creation, render } = fixture();
  for (const effectivePlan of [{ items: [] }, null]) {
    Object.assign(creation, { effectivePlan, planDirty: true });
    render();
    assert.equal(button.textContent, "生成套图方案");
    assert.equal(button.disabled, false);
    assert.doesNotMatch(button.title, /已完成/);
  }
});

test("clicking the completed button starts a fresh preview request", async () => {
  const view = fixture();
  for (let attempt = 1; attempt <= 2; attempt += 1) {
    view.button.click();
    assert.equal(view.previewCalls, attempt);
    assert.equal(view.button.textContent, "方案生成中...");
    assert.equal(view.button.disabled, true);
    view.finishPreview();
    await view.coordinator.waitForPending();
    assert.equal(view.button.textContent, "方案已完成");
    assert.equal(view.button.disabled, false);
    assert.equal(view.creation.effectivePlan.items[0].itemId, `plan-${attempt}`);
  }
});
