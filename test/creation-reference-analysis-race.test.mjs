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
