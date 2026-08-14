import test from "node:test";
import assert from "node:assert/strict";

import { mergePromptAgentHistoryTemplates } from "../lib/prompt-agent-template-sync.mjs";

function merge(history, templates) {
  return mergePromptAgentHistoryTemplates({
    history,
    templates,
    getTemplateId: (item) => `prompt-agent-${item.id}`,
    getPrompt: (item) => item.prompt,
    getName: (item) => item.name,
  });
}

function mergeWithDismissed(history, templates, dismissedIds) {
  return mergePromptAgentHistoryTemplates({
    history,
    templates,
    getTemplateId: (item) => `prompt-agent-${item.id}`,
    getPrompt: (item) => item.prompt,
    getName: (item) => item.name,
    skipItem: (item) => dismissedIds.has(`prompt-agent-${item.id}`),
  });
}

test("prompt agent history fills missing prompt templates without duplicates", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [
    { id: "record-2", name: "夜景", prompt: "夜景提示词" },
    { id: "record-1", name: "人像", prompt: "人像提示词" },
    { id: "record-2", name: "重复夜景", prompt: "重复内容" },
  ];

  assert.deepEqual(merge(history, templates), [
    { id: "prompt-agent-record-2", name: "夜景", prompt: "夜景提示词" },
    { id: "prompt-agent-record-1", name: "人像", prompt: "人像提示词" },
    ...templates,
  ]);
});

test("prompt agent history does not overwrite edited automatic templates", () => {
  const templates = [{ id: "prompt-agent-record-1", name: "我改过的名称", prompt: "我改过的内容" }];
  const history = [{ id: "record-1", name: "服务端名称", prompt: "服务端内容" }];

  assert.deepEqual(merge(history, templates), templates);
});

test("prompt agent history skips entries without reusable prompt text", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [{ id: "record-empty", name: "空记录", prompt: "   " }];

  assert.deepEqual(merge(history, templates), templates);
});

test("prompt agent history does not restore a template the user dismissed", () => {
  const templates = [{ id: "template-user-1", name: "我的模板", prompt: "保留内容" }];
  const history = [{ id: "record-1", name: "已删除历史", prompt: "已删除内容" }];

  assert.deepEqual(mergeWithDismissed(history, templates, new Set(["prompt-agent-record-1"])), templates);
});
