import assert from "node:assert/strict";
import test from "node:test";

import {
  appendReferenceAnalysisLanguageInstruction,
  normalizeReferenceAnalysisLanguage,
} from "../lib/reference-analysis-language.mjs";

test("reference analysis language normalization supports Chinese and English", () => {
  assert.deepEqual(normalizeReferenceAnalysisLanguage("zh-CN"), {
    value: "zh-CN",
    label: "简体中文",
  });
  assert.deepEqual(normalizeReferenceAnalysisLanguage("en"), {
    value: "en",
    label: "English",
  });
});

test("reference analysis language instruction can force English visible text from a Chinese prompt", () => {
  const prompt = "根据参考图生成一张带中文卖点文案的海报。";
  const result = appendReferenceAnalysisLanguageInstruction(prompt, "en");

  assert.match(result, /^根据参考图生成一张带中文卖点文案的海报。/);
  assert.match(result, /All visible text, headings, labels, callouts, annotations, and short copy must use English\./);
  assert.match(result, /Translate or rewrite source-language wording into English/);
  assert.doesNotMatch(result, /must use 简体中文/);
});
