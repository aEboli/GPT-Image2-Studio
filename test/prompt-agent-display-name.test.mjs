import test from "node:test";
import assert from "node:assert/strict";

import {
  getLegacyPromptAgentTemplatePrompt,
  getPromptAgentDisplayName,
  getPromptAgentTemplateDisplayName,
  getStructuredImagePromptDisplayName,
  isFilenameLikePromptTemplateName,
  stripImageFilenameExtension,
} from "../lib/prompt-agent-display-name.mjs";

function structuredPrompt({ subject = {}, framing = {}, scene = "", visual = "" } = {}) {
  return {
    subject: {
      type: "",
      pose: "",
      expression: "",
      appearance: [],
      clothing: "",
      interaction: "",
      ...subject,
    },
    framing: {
      foreground_frame: "",
      ...framing,
    },
    scene,
    visual,
    avoid: [],
  };
}

test("structured image prompt name combines grounded time, weather, prop, subject, and environment", () => {
  const json = structuredPrompt({
    subject: {
      type: "年轻女性人像",
      appearance: ["年轻女性", "手持透明雨伞，伞面有雨滴"],
      interaction: "左手握住透明雨伞弯柄并支撑在身前",
    },
    scene: "夜晚户外庭院或酒店花园步道，周围有修剪灌木、地灯和远处建筑窗光。",
    visual: "低照度夜景人像，湿地反光明显。",
  });

  assert.equal(getStructuredImagePromptDisplayName(json), "夜晚雨中打伞年轻女性·庭院地灯");
  assert.equal(getPromptAgentDisplayName({ json, filename: "image-analysis.jpg" }), "夜晚雨中打伞年轻女性·庭院地灯");
});

test("structured image prompt name separates a concise subject action from framing landmarks", () => {
  const json = structuredPrompt({
    subject: {
      type: "坐在户外长凳上看手机的年轻女性",
      interaction: "双手握持智能手机并查看屏幕",
    },
    framing: {
      foreground_frame: "深绿色木质窗框与左侧旧砖墙形成框景",
    },
    scene: "老旧建筑外墙旁的休息区域，一张粗木长凳横贯画面下部。",
    visual: "阴天漫射自然光，整体低反差。",
  });

  assert.equal(getStructuredImagePromptDisplayName(json), "阴天看手机年轻女性·窗框长凳");
});

test("display name keeps a legacy title ahead of derived content", () => {
  const json = {
    ...structuredPrompt({ subject: { type: "年轻女性" }, scene: "夜晚街道与路灯" }),
    title: "门框街拍",
  };

  assert.equal(getPromptAgentDisplayName({ json, filename: "source.png" }), "门框街拍");
});

test("filename fallback removes image extensions and trailing dots", () => {
  assert.equal(stripImageFilenameExtension("IMG_1419_1910..jpg"), "IMG_1419_1910");
  assert.equal(getPromptAgentDisplayName({ filename: "image-analysis.PNG" }), "image-analysis");
  assert.equal(getPromptAgentDisplayName({ filename: ".jpg" }), "图片反推 JSON");
  assert.equal(isFilenameLikePromptTemplateName("portrait.webp"), true);
  assert.equal(isFilenameLikePromptTemplateName("雨夜人像"), false);
});

test("display name is capped at forty Unicode characters", () => {
  const name = getPromptAgentDisplayName({
    json: { title: "这是一个用于验证提示词模板名称不会超出输入框宽度并且能够稳定截断的非常非常长的中文标题" },
  });

  assert.equal(Array.from(name).length, 40);
  assert.equal(name.endsWith("…"), true);
});

test("automatic prompt templates migrate filename-like names from their structured JSON", () => {
  const json = structuredPrompt({
    subject: {
      type: "年轻女性人像",
      appearance: ["手持透明雨伞，伞面有雨滴"],
    },
    scene: "夜晚庭院步道旁有地灯。",
  });

  assert.equal(
    getPromptAgentTemplateDisplayName(
      { id: "prompt-agent-record-1", name: "image-analysis.jpg" },
      json,
    ),
    "夜晚雨中打伞年轻女性·庭院地灯",
  );
  assert.equal(
    getPromptAgentTemplateDisplayName(
      { id: "prompt-agent-record-1", name: "雨夜人像" },
      json,
    ),
    "雨夜人像",
  );
  assert.equal(
    getPromptAgentTemplateDisplayName(
      { id: "prompt-agent-record-2", name: "0002-自然竖幅-eyg2.png" },
      null,
    ),
    "0002-自然竖幅-eyg2",
  );
  assert.equal(
    getPromptAgentTemplateDisplayName(
      { id: "template-user-1", name: "poster.jpg" },
      json,
    ),
    "poster.jpg",
  );
});

test("legacy automatic templates require recognizable reverse-analysis fields", () => {
  const template = { id: "prompt-agent-record-1" };
  const legacyJson = {
    title: "霓虹街景",
    prompt: "赛博朋克街道，雨夜霓虹，电影感构图",
    negative_prompt: "低清晰度，畸变",
    style_tags: ["cinematic", "neon"],
    subject: "街道行人",
    scene: "雨夜城市",
  };

  assert.equal(getLegacyPromptAgentTemplatePrompt(template, legacyJson), legacyJson.prompt);
  assert.equal(
    getLegacyPromptAgentTemplatePrompt(template, { prompt: "literal", metadata: "keep" }),
    "",
  );
  assert.equal(
    getLegacyPromptAgentTemplatePrompt(template, { prompt: "literal", subject: "", scene: null, notes: [] }),
    "",
  );
  assert.equal(
    getLegacyPromptAgentTemplatePrompt(template, { prompt: "literal", subject: "x", scene: "y", notes: [] }),
    "",
  );
  assert.equal(getLegacyPromptAgentTemplatePrompt({ id: "template-user-1" }, legacyJson), "");
});
