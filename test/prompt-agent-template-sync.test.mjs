import test from "node:test";
import assert from "node:assert/strict";

import { extractPromptAgentJson } from "../lib/prompt-agent.mjs";
import { mergePromptAgentHistoryTemplates } from "../lib/prompt-agent-template-sync.mjs";

function getPrompt(item) {
  return (
    item.prompt ||
    item.json?.prompt ||
    item.json?.prompts?.[0]?.prompt ||
    (item.json ? JSON.stringify(item.json) : "")
  );
}

function merge(history, templates) {
  return mergePromptAgentHistoryTemplates({
    history,
    templates,
    getTemplateId: (item) => `prompt-agent-${item.id}`,
    getPrompt,
    getName: (item) => item.name,
  });
}

function mergeWithDismissed(history, templates, dismissedIds) {
  return mergePromptAgentHistoryTemplates({
    history,
    templates,
    getTemplateId: (item) => `prompt-agent-${item.id}`,
    getPrompt,
    getName: (item) => item.name,
    skipItem: (item) => dismissedIds.has(`prompt-agent-${item.id}`),
  });
}

test("prompt agent history fills missing prompt templates without duplicates", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [
    { id: "record-2", mode: "image-to-prompt", name: "夜景", prompt: "夜景提示词" },
    { id: "record-1", mode: "image-to-prompt", name: "人像", prompt: "人像提示词" },
    { id: "record-2", mode: "image-to-prompt", name: "重复夜景", prompt: "重复内容" },
  ];

  assert.deepEqual(merge(history, templates), [
    { id: "prompt-agent-record-2", name: "夜景", prompt: "夜景提示词" },
    { id: "prompt-agent-record-1", name: "人像", prompt: "人像提示词" },
    ...templates,
  ]);
});

test("prompt agent history keeps ordinary image-to-prompt entries reusable", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const legacyJson = extractPromptAgentJson(JSON.stringify({
    title: "旧版反推",
    prompt: "旧版反推提示词",
    subject: "街道行人",
    scene: "雨夜城市",
    composition: "低机位广角",
    lighting: "霓虹反射光",
  }));
  const structuredJson = {
    subject: { type: "产品", pose: "静置", appearance: [], clothing: "", interaction: "" },
    framing: { aspect_ratio: "1:1", shot_size: "近景" },
    scene: "白色摄影棚",
    visual: "柔和棚拍光",
    avoid: ["改变产品结构"],
  };
  const history = [
    { id: "record-current", mode: "image-to-prompt", name: "当前反推", prompt: "当前反推 JSON" },
    { id: "record-legacy", name: "旧版反推", json: legacyJson },
    { id: "record-structured", name: "五组反推", json: structuredJson },
  ];

  assert.equal(legacyJson.prompts.length, 1);
  assert.deepEqual(legacyJson.image_roles, []);
  assert.deepEqual(legacyJson.reference_roles, []);
  assert.equal(legacyJson.relationship, "");

  assert.deepEqual(merge(history, templates), [
    { id: "prompt-agent-record-current", name: "当前反推", prompt: "当前反推 JSON" },
    { id: "prompt-agent-record-legacy", name: "旧版反推", prompt: "旧版反推提示词" },
    { id: "prompt-agent-record-structured", name: "五组反推", prompt: JSON.stringify(structuredJson) },
    ...templates,
  ]);
});

test("prompt agent history does not import non-image-to-prompt analysis modes", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [
    { id: "orchestration", mode: "reference-orchestration", name: "穿搭编排", prompt: "编排提示词" },
    { id: "creation", mode: "creation-reference-analysis", name: "套图分析", prompt: "套图分析 JSON" },
    { id: "portrait", mode: "portrait-reference-analysis", name: "写真分析", prompt: "写真分析 JSON" },
  ];

  assert.deepEqual(merge(history, templates), templates);
});

test("prompt agent history does not treat an explicit blank mode as legacy history", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const structuredJson = {
    subject: { type: "产品", pose: "静置" },
    framing: { aspect_ratio: "1:1", shot_size: "近景" },
    scene: "白色摄影棚",
    visual: "柔和棚拍光",
    avoid: [],
  };

  assert.deepEqual(
    merge([{ id: "blank-mode", mode: "   ", json: structuredJson }], templates),
    templates,
  );
});

test("prompt agent history recognizes legacy orchestration entries without a mode", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const orchestrationJson = extractPromptAgentJson(JSON.stringify({
    title: "旧版穿搭编排",
    summary: "人物主体与裤装参考图的穿搭关系",
    image_roles: ["图 1：人物主体", "图 2：裤装"],
    relationship: "人物穿搭",
    prompts: [{ title: "街拍穿搭", intent: "组合参考图", prompt: "让参考人物穿上参考裤装" }],
    risks: [],
  }));
  const history = [
    {
      id: "legacy-orchestration",
      name: "旧版穿搭编排",
      json: orchestrationJson,
    },
  ];

  assert.equal(orchestrationJson.prompt, "让参考人物穿上参考裤装");
  assert.equal(orchestrationJson.prompts.length, 1);

  assert.deepEqual(merge(history, templates), templates);
});

test("prompt agent history rejects mode-less five-group objects with orchestration fields", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const hybridJson = {
    subject: { type: "人物", pose: "站立" },
    framing: { aspect_ratio: "1:1", shot_size: "全身" },
    scene: "城市街道",
    visual: "自然日光",
    avoid: [],
    prompts: [{ prompt: "把两张参考图编排成街拍画面" }],
  };

  assert.deepEqual(merge([{ id: "hybrid", json: hybridJson }], templates), templates);
});

test("prompt agent history rejects mode-less legacy fields when prompts are present", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const ambiguousJson = {
    title: "旧版编排结果",
    prompt: "组合参考图的提示词",
    subject: "人物与服装",
    scene: "城市街道",
    lighting: "自然日光",
    prompts: [{ title: "组合", prompt: "组合参考图的提示词" }],
  };

  assert.deepEqual(merge([{ id: "ambiguous-prompts", json: ambiguousJson }], templates), templates);
});

test("prompt agent history rejects mode-less legacy-looking non-ordinary analyses", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [
    {
      id: "orchestration-with-legacy-fields",
      json: {
        title: "参考图编排",
        prompt: "让参考人物穿上参考服装",
        subject: "参考人物",
        scene: "城市街道",
        image_roles: ["图 1：人物主体", "图 2：服装"],
        relationship: "人物穿搭",
      },
    },
    {
      id: "portrait-with-legacy-fields",
      json: {
        title: "写真分析",
        prompt: "写真提示词",
        subject: "人物",
        scene: "影棚",
        referenceRoles: ["人物身份参考"],
        faceVisibility: "清晰可见",
      },
    },
  ];

  assert.deepEqual(merge(history, templates), templates);
});

test("prompt agent history does not create a template from empty ordinary JSON", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [{ id: "empty", mode: "image-to-prompt", name: "空结果", json: {} }];

  assert.deepEqual(merge(history, templates), templates);
});

test("prompt agent history rejects ambiguous legacy entries without a mode", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [
    { id: "missing-json", name: "无 JSON", prompt: "未知提示词" },
    { id: "flat-json", name: "扁平 JSON", json: { prompt: "缺少反推字段" } },
  ];

  assert.deepEqual(merge(history, templates), templates);
});

test("prompt agent history does not overwrite edited automatic templates", () => {
  const templates = [{ id: "prompt-agent-record-1", name: "我改过的名称", prompt: "我改过的内容" }];
  const history = [{ id: "record-1", mode: "image-to-prompt", name: "服务端名称", prompt: "服务端内容" }];

  assert.deepEqual(merge(history, templates), templates);
});

test("prompt agent history skips entries without reusable prompt text", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [{ id: "record-empty", mode: "image-to-prompt", name: "空记录", prompt: "   " }];

  assert.deepEqual(merge(history, templates), templates);
});

test("prompt agent history does not restore a template the user dismissed", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [{ id: "record-1", mode: "image-to-prompt", name: "已删除历史", prompt: "已删除内容" }];

  assert.deepEqual(mergeWithDismissed(history, templates, new Set(["prompt-agent-record-1"])), templates);
});
