import test from "node:test";
import assert from "node:assert/strict";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import {
  buildCreationItemGenerationPrompt,
  resolveCreationItemGenerationParameters,
} from "../lib/creation-generation-parameters.mjs";
import { gloveAnalysisInput } from "./fixtures/creation-glove-insights.mjs";

function assertEnglishCanvasBoundary(prompt, item = {}) {
  const parameters = resolveCreationItemGenerationParameters({ ...item, targetLanguage: "en" }, { imageRoute: "a" });
  const runtimePrompt = buildCreationItemGenerationPrompt(prompt, parameters, item);
  assert.match(runtimePrompt, /(?:new text in English|English \(en\) for new text)/i);
  assert.match(runtimePrompt, /Translate supplied source facts before using them as canvas text/i);
  assert.match(runtimePrompt, /role titles, task names, filenames, and reference annotations are internal metadata/i);
  assert.match(runtimePrompt, /physical text in its original language|physical product and packaging text stays unchanged|original characters and language/i);
}

test("ordinary English Creation prompts keep Chinese planning metadata out of canvas text", () => {
  const plan = buildCreationPlan({
    productName: "Portable glove",
    productDescription: "中文参考资料 describes the supplied product.",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuGenerationEnabled: false,
    referenceImageRoles: [{ index: 1, filename: "中文标注.png", role: "product", note: "手套的中文参考标注" }],
  });

  assertEnglishCanvasBoundary(plan.items[0].prompt, plan.items[0]);
});

test("analyzed English Creation prompts keep Chinese facts and task titles out of canvas text", () => {
  const plan = buildCreationPlan(gloveAnalysisInput({ targetLanguage: "en", imageCount: 8 }));
  const analyzedItems = plan.items.filter((item) => item.contentAssignment && item.contentAssignment.kind !== "manual");
  assert.ok(analyzedItems.length > 0);
  for (const item of analyzedItems) assertEnglishCanvasBoundary(item.prompt, item);
});

test("runtime adds the same language and metadata boundary to historical prompts", () => {
  const item = { role: "hero", targetLanguage: "en", ratio: "1:1", resolutionTier: "1K" };
  const parameters = resolveCreationItemGenerationParameters(item, { imageRoute: "a" });
  assertEnglishCanvasBoundary(buildCreationItemGenerationPrompt("Reference annotations: 多角度产品展示图", parameters, item));
});
