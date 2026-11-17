import assert from "node:assert/strict";
import test from "node:test";
import vm from "node:vm";
import { readFile } from "node:fs/promises";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const generation = app.slice(app.indexOf("async function startCreationGeneration(event) {"), app.indexOf("\nasync function repairCreationItems("));

function harness() {
  let currentPlan = { promptPlanningMode: "ai-batch", marketingPlan: { inputFingerprint: "first-plan", variationSeed: "first-seed" } };
  const errors = [], previews = [];
  const scope = {
    state: { creation: { planning: false, planDirty: false, queue: [] } },
    refs: { creationProductNameInput: { value: "手套" }, creationProductDescriptionInput: { value: "实际商品" } },
    isCreationLogoBatchBranch: () => false, waitForPendingCreationPlanPreview: async () => {},
    clearError: () => {}, setCreationFeedback: () => {}, renderCreationView: () => {},
    isCreationAiMarketingEnabled: () => true, getFrozenCreationEffectivePlan: () => currentPlan,
    ensureCreationReferenceGenerationFilesReady: async () => {},
    previewCreationPlan: async (options) => {
      previews.push(options);
      currentPlan = { promptPlanningMode: "ai-batch", marketingPlan: { inputFingerprint: `new-plan-${previews.length}`, variationSeed: `new-seed-${previews.length}` } };
    },
    buildCreationFormData: () => ({ seed: currentPlan.marketingPlan.variationSeed }),
    buildCreationQueuedSet: () => structuredClone(currentPlan),
    enqueueCreationGeneration: (job) => { scope.state.creation.queue.push(job); return job; },
    nowIso: () => new Date().toISOString(), compactErrorMessage: (message) => message,
    showError: (message) => errors.push(message),
  };
  vm.runInNewContext(`${generation}\nglobalThis.generate = startCreationGeneration;`, scope);
  return { scope, previews, errors };
}

test("repeated manual generation creates a new campaign after consuming the confirmed preview", async () => {
  const { scope, previews, errors } = harness();
  for (let index = 0; index < 3; index += 1) await scope.generate({ preventDefault() {} });
  assert.equal(previews.length, 2);
  assert.ok(previews.every((options) => options.throwOnError));
  assert.equal(scope.state.creation.queue.length, 3);
  assert.equal(new Set(scope.state.creation.queue.map((job) => job.formData.seed)).size, 3);
  assert.equal(scope.state.creation.queue[0].set.marketingPlan.inputFingerprint, "first-plan", "queued plans are not rewritten by subsequent creation");
  assert.deepEqual(errors, []);
});

test("failed fresh planning never enqueues the previously consumed campaign", async () => {
  const { scope, errors } = harness();
  await scope.generate({ preventDefault() {} });
  scope.previewCreationPlan = async () => { throw new Error("新方案规划失败"); };
  await scope.generate({ preventDefault() {} });
  assert.equal(scope.state.creation.queue.length, 1);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /新方案规划失败/);
});

test("manual previews use fresh seeds and frozen submissions retain their own seeds", () => {
  const preview = app.slice(app.indexOf("async function previewCreationPlan("), app.indexOf("async function startCreationLogoBatchGeneration("));
  assert.match(preview, /previewFormData\.set\("variationSeed", globalThis\.crypto\?\.randomUUID/);
  const form = app.slice(app.indexOf("function buildCreationFormData("), app.indexOf("function buildCreationRepairFormData("));
  assert.match(form, /formData\.set\("variationSeed", effectivePlan\.marketingPlan\.variationSeed\)/);
  const batch = app.slice(app.indexOf("async function runCreationMarketingBatchGeneration("), app.indexOf("function pauseCreationMarketingBatch("));
  assert.equal((batch.match(/\.set\("variationSeed", variationSeed\)/g) || []).length, 2);
  assert.match(html, /id="creationMarketingBatchDirectionInput"/);
  assert.doesNotMatch(html, /每个方案只规划一次/);
});
