import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const appPath = new URL("../public/app.js", import.meta.url);
const portraitAnalysisPath = new URL("../lib/portrait-reference-analysis-client.mjs", import.meta.url);

test("queued generation sends the frozen route and model snapshot", async () => {
  const app = await readFile(appPath, "utf8");
  const body = app.match(/function buildGenerationFormData\(job\) \{[\s\S]*?\n\}/)?.[0] || "";
  assert.match(body, /appendJobConfigToFormData\(formData, job\)/);
  assert.doesNotMatch(body, /appendCurrentConfigToFormData\(formData\)/);
});
test("late polling snapshots cannot revive a locally terminated generation task", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /locallyTerminatedGenerationTaskIds: new Set\(\)/);
  assert.match(app, /state\.locallyTerminatedGenerationTaskIds\.add\(jobId\)/);
  assert.match(app, /filterLocallyTerminatedGenerationTaskSnapshots\(tasks, state\.locallyTerminatedGenerationTaskIds\)/);
});
test("Prompt Agent and reference orchestration abort and reject stale analyses", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /let promptAgentAnalysisRequestToken = 0/);
  assert.match(app, /let promptAgentAnalysisAbortController = null/);
  assert.match(app, /function getPromptAgentAnalysisSnapshot\(\) \{/);
  assert.match(app, /signal:\s*requestController\.signal/);
  assert.match(app, /requestToken !== promptAgentAnalysisRequestToken \|\| analysisSnapshot !== getPromptAgentAnalysisSnapshot\(\)/);

  assert.match(app, /let referenceAnalysisRequestToken = 0/);
  assert.match(app, /let referenceAnalysisAbortController = null/);
  assert.match(app, /function getReferenceAnalysisRequestSnapshot\(\) \{/);
  assert.match(app, /requestToken !== referenceAnalysisRequestToken \|\| analysisSnapshot !== getReferenceAnalysisRequestSnapshot\(\)/);
});

test("portrait plan and reference analysis reject stale form snapshots", async () => {
  const app = await readFile(appPath, "utf8");
  const portraitAnalysis = await readFile(portraitAnalysisPath, "utf8");
  assert.match(app, /function getPortraitPlanSnapshot\(\) \{/);
  assert.match(app, /const planSnapshot = getPortraitPlanSnapshot\(\);/);
  assert.match(app, /planSnapshot !== getPortraitPlanSnapshot\(\)/);
  assert.match(portraitAnalysis, /function getSnapshot\(\) \{/);
  assert.match(portraitAnalysis, /currentToken !== requestToken \|\| snapshot !== getSnapshot\(\)/);
});
