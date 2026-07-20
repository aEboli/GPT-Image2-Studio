import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const appPath = new URL("../public/app.js", import.meta.url);

test("Creation shows an automatic platform plan summary with actionable feedback", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationPlanSummary"[^>]*data-plan-state="automatic"/);
  assert.match(html, /id="creationPlanCarouselCount"/);
  assert.match(html, /id="creationPlanSkuCount"/);
  assert.match(html, /id="creationPlanRebuildCount"/);
  assert.match(html, /id="creationPlanTotalCount"/);
  assert.match(html, /<ul[^>]*id="creationPlanWarnings"[^>]*aria-live="polite"/);
  assert.match(html, /id="creationPlanValidation"[^>]*aria-live="polite"/);
  assert.match(app, /refs\.creationPlanValidation\.classList\.toggle\("hidden", !plan\)/);
  assert.match(html, /id="creationPlanRestoreButton"[^>]*type="button"/);
  assert.match(app, /stateLabel\.textContent = isPlanPending \? "待刷新" : hasOverrides \? "已覆盖" : "自动"/);
  assert.match(app, /value === null \? "待刷新" : String\(value\)/);
  assert.match(app, /getVisibleCreationPlanWarnings\(plan\?\.warnings\)/);
  assert.match(app, /formatCreationPlanWarning\(warning/);
});

test("Creation removes advanced per-item editing and every prompt customization entry", async () => {
  const html = await readFile(indexPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /id="creationRolePicker"/);
  assert.match(html, /id="creationRoleGrid"/);
  assert.doesNotMatch(html, /逐图高级编辑|creationPlanAdvancedToggle|creationPlanSlotTemplate|creationPlanSlots/);
  assert.doesNotMatch(html, /creationPromptEditorLayer|data-creation-plan-field="prompt"/);
  assert.doesNotMatch(app, /getCreationPlanOverrides|creationPromptEditorLayer|data\.creationEditItemId/);
  assert.doesNotMatch(app, /formData\.set\("planOverrides"|formData\.set\("promptOverride"/);
});

test("Creation refreshes count changes immediately and generation waits for the latest plan", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function requestCreationPlanPreview\(\)/);
  assert.match(app, /creationPlanPreviewRequests\.track\(previewCreationPlan\(\)\)/);
  assert.match(
    app,
    /creationImageCountInput\.addEventListener\("change",\s*\(\) => \{[\s\S]*syncCreationSelectedRolesToCount\(\)[\s\S]*requestCreationPlanPreview\(\)/,
  );
  assert.match(app, /async function startCreationGeneration[\s\S]*await waitForPendingCreationPlanPreview\(\)/);
  assert.match(app, /state\.creation\.planDirty[\s\S]*await requestCreationPlanPreview\(\)/);
});

test("Creation plan styling stays compact without orphaned advanced editors", async () => {
  const styles = await readFile(stylesPath, "utf8");

  assert.match(styles, /\.creation-plan-summary\s*\{[\s\S]*?min-width:\s*0;/);
  assert.match(styles, /\.creation-plan-counts\s*\{[\s\S]*?grid-template-columns:\s*repeat\(4,\s*minmax\(0,\s*1fr\)\);/);
  assert.doesNotMatch(styles, /\.creation-plan-advanced|\.creation-plan-slot|\.creation-card-editor|\.creation-prompt-editor-layer/);
});
