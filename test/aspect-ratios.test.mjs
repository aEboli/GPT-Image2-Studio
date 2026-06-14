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

test("resolveAspectRatioOption maps ratios to the provided 1K base canvases and use-case labels", () => {
  const expectedByRatio = {
    "1:1": { baseSize: "1024x1024", label: "电商主图、头像、社交媒体 · 方形 1:1" },
    "4:3": { baseSize: "1360x1024", label: "PPT、网页配图 · 横屏 4:3" },
    "3:4": { baseSize: "1024x1360", label: "海报、人像 · 竖屏 3:4" },
    "3:2": { baseSize: "1536x1024", label: "摄影风格 · 横屏 3:2" },
    "2:3": { baseSize: "1024x1536", label: "竖版摄影 · 竖屏 2:3" },
    "5:4": { baseSize: "1280x1024", label: "商品展示 · 横屏 5:4" },
    "4:5": { baseSize: "1024x1280", label: "Instagram帖子 · 竖屏 4:5" },
    "16:9": { baseSize: "1824x1024", label: "横版封面、YouTube · 横屏 16:9" },
    "9:16": { baseSize: "1024x1824", label: "短视频封面、手机壁纸 · 竖屏 9:16" },
    "21:9": { baseSize: "2384x1024", label: "超宽横幅 · 横屏 21:9" },
    "9:21": { baseSize: "1024x2384", label: "超长竖图 · 竖屏 9:21" },
    "2:1": { baseSize: "2048x1024", label: "Banner横幅 · 横屏 2:1" },
    "1:2": { baseSize: "1024x2048", label: "长海报 · 竖屏 1:2" },
    "3:1": { baseSize: "3072x1024", label: "超宽广告图 · 横屏 3:1" },
    "1:3": { baseSize: "1024x3072", label: "超长竖版广告 · 竖屏 1:3" },
  };

  for (const [ratio, expected] of Object.entries(expectedByRatio)) {
    const option = resolveAspectRatioOption(ratio);
    assert.equal(option.baseSize, expected.baseSize);
    assert.equal(option.label, expected.label);
  }

  assert.equal(resolveAspectRatioOption("16:9").orientation, "landscape");
  assert.equal(resolveAspectRatioOption("2:3").orientation, "portrait");
  assert.equal(resolveAspectRatioOption("1:1").orientation, "square");
});

test("appendRatioHintToPrompt injects a ratio composition hint without losing the original prompt", () => {
  const prompt = appendRatioHintToPrompt("生成一张直播宣传图", resolveAspectRatioOption("4:5"));

  assert.match(prompt, /生成一张直播宣传图/);
  assert.match(prompt, /构图比例要求：Instagram帖子 · 竖屏 4:5/);
});
