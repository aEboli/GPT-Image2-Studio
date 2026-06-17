import test from "node:test";
import assert from "node:assert/strict";

import {
  IMAGE_DECOMPOSITION_MODE,
  IMAGE_DECOMPOSITION_REFERENCE_LABEL,
  buildImageDecompositionPrompt,
  normalizeImageDecompositionLanguage,
} from "../lib/image-decomposition-prompt.mjs";

test("image decomposition prompt defaults to Simplified Chinese and forbids invented details", () => {
  const result = buildImageDecompositionPrompt({});

  assert.equal(IMAGE_DECOMPOSITION_MODE, "image-decomposition");
  assert.equal(result.targetLanguage, "简体中文");
  assert.equal(result.languageCode, "zh-CN");
  assert.match(result.prompt, /简体中文/);
  assert.match(result.prompt, /只标注上传图片中真实可见/);
  assert.match(result.prompt, /不要编造品牌/);
  assert.match(result.prompt, /文字清晰可读/);
  assert.match(result.prompt, /拆解信息图/);
  assert.match(result.prompt, /Do not render side feature cards/i);
  assert.match(result.prompt, /detailed callout boxes/i);
  assert.match(result.prompt, /1-2 short explanatory lines/i);
  assert.match(result.prompt, /Keep these constraints internal/);
  assert.doesNotMatch(result.prompt, /external visual breakdown/i);
  assert.doesNotMatch(result.prompt, /visible parts/i);
  assert.doesNotMatch(result.prompt, /from the source image/i);
  assert.doesNotMatch(result.prompt, /source image only/i);
  assert.doesNotMatch(result.prompt, /only factual reference/i);
  assert.doesNotMatch(result.prompt, /only visible parts/i);
  assert.match(IMAGE_DECOMPOSITION_REFERENCE_LABEL, /SOURCE image/);
  assert.match(IMAGE_DECOMPOSITION_REFERENCE_LABEL, /Do not render this label/);
});

test("image decomposition prompt can disable optional side feature cards and keep descriptor punctuation plain", () => {
  const result = buildImageDecompositionPrompt({ featureCardsEnabled: false });

  assert.match(result.prompt, /Do not render side feature cards/i);
  assert.match(result.prompt, /detailed callout boxes/i);
  assert.match(result.prompt, /without parentheses, colons, dashes/i);
  assert.match(result.prompt, /不用括号、冒号或破折号/);
  assert.doesNotMatch(result.prompt, /small icon-like sketches/i);
});

test("image decomposition prompt can enable side feature cards on demand", () => {
  const result = buildImageDecompositionPrompt({ targetLanguage: "en", featureCardsEnabled: true });

  assert.match(result.prompt, /English/);
  assert.match(result.prompt, /must include left and right side feature cards/i);
  assert.match(result.prompt, /4-8 side feature cards/i);
  assert.match(result.prompt, /small icon-like sketches/i);
  assert.match(result.prompt, /Do not leave the side margins empty/i);
});

test("image decomposition language normalization supports presets and custom language", () => {
  assert.deepEqual(normalizeImageDecompositionLanguage("en"), {
    code: "en",
    label: "English",
  });
  assert.deepEqual(normalizeImageDecompositionLanguage("日本語"), {
    code: "ja",
    label: "日本語",
  });
  assert.deepEqual(normalizeImageDecompositionLanguage("custom", "Italiano"), {
    code: "custom",
    label: "Italiano",
  });
  assert.deepEqual(normalizeImageDecompositionLanguage("custom", "  "), {
    code: "zh-CN",
    label: "简体中文",
  });
});
