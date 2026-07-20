import test from "node:test";
import assert from "node:assert/strict";
import { createCreationReferenceAnalysisGuard } from "../lib/creation-reference-analysis-guard.mjs";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

const appPath = fileURLToPath(new URL("../public/app.js", import.meta.url));

test("analysis guard rejects a response after platform or category snapshot changes", () => {
  const guard = createCreationReferenceAnalysisGuard({ platform: "amazon", category: "home" });
  const request = guard.begin();
  guard.invalidate({ platform: "etsy", category: "home" });
  assert.equal(guard.isCurrent(request), false);
});

test("analysis guard accepts only the current request and snapshot", () => {
  const guard = createCreationReferenceAnalysisGuard({ platform: "amazon", category: "home" });
  const request = guard.begin();
  assert.equal(guard.isCurrent(request), true);
  const newer = guard.begin();
  assert.equal(guard.isCurrent(request), false);
  assert.equal(guard.isCurrent(newer), true);
});

test("browser request snapshots platform and category, aborts old work, and gates apply", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /let creationReferenceAnalysisAbortController = null/);
  assert.match(app, /creationReferenceAnalysisAbortController\?\.abort\(\)/);
  assert.match(app, /signal:\s*requestController\.signal/);
  assert.match(app, /platform:\s*getCreationSelectedPlatform\(\)\.value/);
  assert.match(app, /category:\s*getCreationSelectedIndustryTemplate\(\)\.value/);
  assert.match(app, /applyCreationReferenceAnalysis\(payload,\s*\{\s*isCurrent/);
});

test("analysis apply checks freshness after async category loading before mutating state", async () => {
  const app = await readFile(appPath, "utf8");
  assert.match(app, /async function applyCreationReferenceAnalysisCategoryMatch\(analysis, isCurrent = \(\) => true\) \{[\s\S]*await loadCreationCategoryTemplatesModule\(\);[\s\S]*if \(!isCurrent\(\)\) return null;/);
  assert.match(app, /const matchedTemplate = await applyCreationReferenceAnalysisCategoryMatch\(normalized, isCurrent\);[\s\S]*state\.creationReferenceAnalysis\.result = normalized;/);
  assert.match(app, /if \(previousValue !== refs\.creationIndustryTemplateInput\.value\) \{\s*invalidateCreationReferenceAnalysisRequest\(\);/);
});

test("reference mutations invalidate analysis without clearing product form fields", async () => {
  const app = await readFile(appPath, "utf8");
  const dirtyBody = app.match(/function markCreationReferenceAnalysisDirty\(\) \{[\s\S]*?\n\}/)?.[0] || "";

  assert.match(dirtyBody, /invalidateCreationReferenceAnalysisRequest\(\);/);
  assert.doesNotMatch(dirtyBody, /creationProductNameInput|setCreationReferenceProductNameValue|clearCreationReferenceAnalysisProductNameSuggestion/);
});

test("reference analysis applies automatically and keeps the detected role editable", async () => {
  const app = await readFile(appPath, "utf8");

  const applyBody = app.match(/async function applyCreationReferenceAnalysis\(analysis\) \{[\s\S]*?\n\}/)?.[0] || "";
  const recommendationsBody = app.match(/function applyCreationReferenceAnalysisRecommendations\(\) \{[\s\S]*?(?=\r?\nfunction renderCreationReferenceAnalysis)/)?.[0] || "";
  const renderGridBody = app.match(/function renderCreationReferenceGrid\(\) \{[\s\S]*?(?=\r?\nfunction buildCreationReferenceRolePayload)/)?.[0] || "";

  assert.match(applyBody, /const appliedResult = applyCreationReferenceAnalysisRecommendations\(\);/);
  assert.match(recommendationsBody, /state\.creationReferenceAnalysis\.applied = true;/);
  assert.doesNotMatch(recommendationsBody, /roleLocked\s*:/);
  assert.match(renderGridBody, /roleSelect\.dataset\.creationReferenceRoleId = item\.id;/);
  assert.doesNotMatch(renderGridBody, /creation-reference-role-readonly/);
  assert.match(app, /const \{ appliedMessage, matchedTemplate \} = await applyCreationReferenceAnalysis\(payload\);/);
  assert.doesNotMatch(app, /creationReferenceApplyAnalysisButton|应用建议/);

  const appliedIndex = recommendationsBody.indexOf("state.creationReferenceAnalysis.applied = true;");
  const productNameIndex = recommendationsBody.indexOf("applyCreationReferenceAnalysisProductNameSuggestion");
  assert.ok(appliedIndex >= 0 && productNameIndex >= 0 && appliedIndex < productNameIndex);
});

test("reference notes enter edit mode on double click and invalidate the frozen plan on commit", async () => {
  const app = await readFile(appPath, "utf8");

  const updateBody = app.match(/function updateCreationReferenceNote\(referenceId, noteText\) \{[\s\S]*?(?=\r?\nfunction beginCreationReferenceNoteEditing)/)?.[0] || "";
  const beginBody = app.match(/function beginCreationReferenceNoteEditing\(event\) \{[\s\S]*?(?=\r?\nfunction commitCreationReferenceNoteEditing)/)?.[0] || "";
  const commitBody = app.match(/function commitCreationReferenceNoteEditing\(note\) \{[\s\S]*?(?=\r?\nfunction updateCreationReferenceRole)/)?.[0] || "";

  assert.match(beginBody, /setAttribute\("contenteditable", "true"\)/);
  assert.match(commitBody, /updateCreationReferenceNote\(referenceId, nextNote\)/);
  assert.match(updateBody, /resetCreationDraftPreview\(\)/);
  assert.match(app, /refs\.creationReferenceGrid\.addEventListener\("dblclick", beginCreationReferenceNoteEditing\)/);
  assert.match(app, /refs\.creationReferenceGrid\.addEventListener\("focusout"[\s\S]*commitCreationReferenceNoteEditing/);
});
