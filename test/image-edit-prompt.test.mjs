import test from "node:test";
import assert from "node:assert/strict";
import { buildImageEditPrompt } from "../lib/image-edit-prompt.mjs";

test("image edit English instruction rewrites the target clause in place", () => {
  const prompt = buildImageEditPrompt("重构这张图，输出为英文，将单位转换为公制单位/英制单位");

  assert.equal(
    prompt,
    "重构这张图，非商品/包装文字（含左上角和角落图形）全部重构为英文；商品/包装表面文字保留，模糊文字删除，将单位转换为公制单位/英制单位",
  );
  assert.doesNotMatch(prompt, /ENGLISH TEXT RULE|\blogos?\b/i);
});

test("image edit English rewrite keeps other user requirements", () => {
  const prompt = buildImageEditPrompt("重构这张图，输出为英文，左上角不是logo，也要翻译");

  assert.match(prompt, /非商品\/包装文字（含左上角和角落图形）全部重构为英文/);
  assert.match(prompt, /左上角是画面文字/);
  assert.match(prompt, /也要翻译/);
  assert.doesNotMatch(prompt, /\blogos?\b/i);
});

test("image edit English rewrite replaces a mixed-language target in place", () => {
  const prompt = buildImageEditPrompt("重构这张图，输出为 English，将单位转换为公制单位");

  assert.equal(
    prompt,
    "重构这张图，非商品/包装文字（含左上角和角落图形）全部重构为英文；商品/包装表面文字保留，模糊文字删除，将单位转换为公制单位",
  );
});

test("image edit English rewrite handles an English instruction without duplicating it", () => {
  const prompt = buildImageEditPrompt("Redesign the image, output in English, convert units");

  assert.equal(
    prompt,
    "Redesign the image, rewrite all non-product/packaging text, including upper-left and corner graphics, in English; keep product/packaging surface text; remove blurry text, convert units",
  );
  assert.equal((prompt.match(/English/giu) || []).length, 1);
});

test("image edit English rewrite is idempotent", () => {
  const prompt = buildImageEditPrompt("重构这张图，输出为英文，将单位转换为公制单位/英制单位");

  assert.equal(buildImageEditPrompt(prompt), prompt);
});

test("image edit prompts without an English target stay unchanged", () => {
  const prompt = "把背景改成白色，保留主体";

  assert.equal(buildImageEditPrompt(prompt), prompt);
});
