import test from "node:test";
import assert from "node:assert/strict";

import {
  appendRatioHintToPrompt,
  getAspectRatioOptions,
  resolveAspectRatioOption,
} from "../lib/aspect-ratios.mjs";

test("getAspectRatioOptions exposes the supported ratio set with new tall and wide ratios", () => {
  const options = getAspectRatioOptions();

  assert.deepEqual(
    options.map((option) => option.value),
    ["1:1", "4:3", "3:4", "3:2", "2:3", "5:4", "4:5", "16:9", "9:16", "21:9", "9:21", "2:1", "1:2", "3:1", "1:3"],
  );
});

test("resolveAspectRatioOption maps ratios to the provided 1K base canvases without display labels", () => {
  const expectedByRatio = {
    "1:1": "1024x1024",
    "4:3": "1360x1024",
    "3:4": "1024x1360",
    "3:2": "1536x1024",
    "2:3": "1024x1536",
    "5:4": "1280x1024",
    "4:5": "1024x1280",
    "16:9": "1824x1024",
    "9:16": "1024x1824",
    "21:9": "2384x1024",
    "9:21": "1024x2384",
    "2:1": "2048x1024",
    "1:2": "1024x2048",
    "3:1": "3072x1024",
    "1:3": "1024x3072",
  };

  for (const [ratio, expected] of Object.entries(expectedByRatio)) {
    const option = resolveAspectRatioOption(ratio);
    assert.equal(option.baseSize, expected);
    assert.equal(Object.hasOwn(option, "label"), false);
  }

  assert.equal(resolveAspectRatioOption("16:9").orientation, "landscape");
  assert.equal(resolveAspectRatioOption("2:3").orientation, "portrait");
  assert.equal(resolveAspectRatioOption("1:1").orientation, "square");
});

test("appendRatioHintToPrompt injects only one concise ratio hint", () => {
  const prompt = appendRatioHintToPrompt("生成一张直播宣传图", resolveAspectRatioOption("4:5"));

  assert.match(prompt, /生成一张直播宣传图/);
  assert.match(prompt, /Aspect ratio: 4:5\./);
  assert.doesNotMatch(prompt, /Instagram|竖屏|构图比例要求/);
  assert.equal(appendRatioHintToPrompt(prompt, resolveAspectRatioOption("4:5")), prompt);
});
