import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { parse } from "parse5";

import { buildCreationPlan, CREATION_TARGET_LANGUAGE_OPTIONS, normalizeCreationTargetLanguage } from "../lib/creation-planner.mjs";
import { buildCreationCanvasLanguageInstruction, buildCreationInfographicRebuildPrompt, resolveCreationItemGenerationParameters } from "../lib/creation-generation-parameters.mjs";
import { translateCreationPlanPrompts } from "../lib/creation-prompt-translation.mjs";
import { buildImageDecompositionPrompt, normalizeImageDecompositionLanguage } from "../lib/image-decomposition-prompt.mjs";
import { buildReferenceAnalysisLanguagePromptGuidance, normalizeReferenceAnalysisLanguage } from "../lib/reference-analysis-language.mjs";
import { createCreationSetStore } from "../lib/creation-store.mjs";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const languages = [
  ["zh-CN", "简体中文"], ["en", "英语"], ["ja", "日语"], ["ko", "韩语"],
  ["fr", "法语"], ["de", "德语"], ["es", "西班牙语"],
  ["it", "意大利语"], ["pt", "葡萄牙语"], ["nl", "荷兰语"], ["pl", "波兰语"],
];
const europeanLanguages = [
  ["it", "意大利语", "Italian"], ["pt", "葡萄牙语", "Portuguese"],
  ["nl", "荷兰语", "Dutch"], ["pl", "波兰语", "Polish"],
];

function findById(node, id) {
  if (node.attrs?.some((attr) => attr.name === "id" && attr.value === id)) return node;
  for (const child of node.childNodes || []) {
    const found = findById(child, id);
    if (found) return found;
  }
  return null;
}

test("all output language selectors show Chinese names and retain defaults and the custom entry", async () => {
  const document = parse(await readFile(new URL("../public/index.html", import.meta.url), "utf8"));
  for (const [id, defaultValue] of [
    ["referenceAnalysisLanguageInput", "zh-CN"], ["imageDecompositionLanguageInput", "zh-CN"],
    ["creationTargetLanguageInput", "en"], ["quickSuiteLanguageSelect", "en"],
  ]) {
    const select = findById(document, id);
    assert.ok(select, id);
    const options = select.childNodes.filter((node) => node.tagName === "option");
    const actual = options.map((node) => [node.attrs.find((attr) => attr.name === "value").value,
      node.childNodes.map((child) => child.value || "").join("")]);
    assert.deepEqual(actual, id === "imageDecompositionLanguageInput" ? [...languages, ["custom", "自定义语言"]] : languages, id);
    const selected = options.find((node) => node.attrs.some((attr) => attr.name === "selected")) || options[0];
    assert.equal(selected.attrs.find((attr) => attr.name === "value").value, defaultValue, id);
  }
  assert.deepEqual(CREATION_TARGET_LANGUAGE_OPTIONS.map(({ value, label }) => [value, label]), languages);
});

for (const [code, label, name] of europeanLanguages) {
  test(`${code} remains the selected language throughout planning, generation, save and reload`, async () => {
    assert.equal(normalizeCreationTargetLanguage(code).label, label);
    const plan = buildCreationPlan({ productName: "蓝色杯子", targetLanguage: code,
      selectedRoles: ["hero"], skuGenerationEnabled: false });
    assert.equal(plan.targetLanguage, code);
    assert.equal(plan.targetLanguageLabel, label);
    const item = plan.items[0];
    assert.equal(item.targetLanguage, code);
    assert.match(item.prompt, new RegExp(name));
    const parameters = resolveCreationItemGenerationParameters(item, { imageRoute: "a" });
    assert.equal(parameters.targetLanguage, code);
    assert.match(buildCreationCanvasLanguageInstruction(code), new RegExp(`${name} \\(${code}\\)`));
    assert.match(buildCreationInfographicRebuildPrompt({ targetLanguage: code }), new RegExp(`${name} \\(${code}\\)`));
    const outputDir = await mkdtemp(join(tmpdir(), "output-language-"));
    try {
      const store = createCreationSetStore({ outputDir });
      await store.saveManifest({ ...plan, setId: `language-${code}` });
      const saved = await store.readManifest(`language-${code}`);
      assert.equal(saved.targetLanguage, code);
      assert.equal(saved.targetLanguageLabel, label);
    } finally {
      await rm(outputDir, { recursive: true, force: true });
    }
  });

  test(`${code} is recognized by reference analysis and image decomposition`, () => {
    assert.deepEqual(normalizeReferenceAnalysisLanguage(code), { value: code, label });
    assert.match(buildReferenceAnalysisLanguagePromptGuidance(code), new RegExp(`must use ${name}\\.`));
    assert.equal(normalizeImageDecompositionLanguage(code).code, code);
    assert.equal(buildImageDecompositionPrompt({ targetLanguage: code }).languageCode, code);
  });

  test(`${code} source translation uses the complete target language name`, async () => {
    let calls = 0;
    const result = await translateCreationPlanPrompts({ targetLanguage: code,
      items: [{ itemId: "hero", role: "hero", prompt: "Product: 蓝色杯子." }] }, {
      config: { baseUrl: "https://example.test/v1", apiKey: "test-key" },
      fetchImpl: async (_url, init) => {
        calls += 1;
        const body = JSON.parse(init.body);
        assert.match(body.input, new RegExp(`into ${name}\\.`));
        const segments = JSON.parse(body.input.split("\n").at(-1));
        return new Response(JSON.stringify({ output_text: JSON.stringify({ translations: segments.map((source) => ({ source, target: "translated cup" })) }) }), { status: 200 });
      },
    });
    assert.equal(calls, 1);
    assert.equal(result.warning, "");
    assert.equal(result.translatedCount, 1);
  });
}
