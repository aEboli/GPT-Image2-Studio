import assert from "node:assert/strict";
import test from "node:test";

import { createGenerationTaskStore } from "../lib/generation-task-store.mjs";

test("generation task store scopes and sorts recent tasks by session", () => {
  const store = createGenerationTaskStore({ maxTasksPerSession: 2 });

  store.upsertTask("session-a", {
    id: "first",
    prompt: "第一张图",
    status: "running",
    createdAt: "2026-04-28T01:00:00.000Z",
    updatedAt: "2026-04-28T01:00:00.000Z",
  });
  store.upsertTask("session-a", {
    id: "second",
    prompt: "第二张图",
    status: "completed",
    createdAt: "2026-04-28T01:01:00.000Z",
    updatedAt: "2026-04-28T01:03:00.000Z",
  });
  store.upsertTask("session-a", {
    id: "third",
    prompt: "第三张图",
    status: "error",
    createdAt: "2026-04-28T01:02:00.000Z",
    updatedAt: "2026-04-28T01:02:00.000Z",
  });
  store.upsertTask("session-b", {
    id: "other",
    prompt: "其他会话",
    status: "running",
    createdAt: "2026-04-28T01:04:00.000Z",
    updatedAt: "2026-04-28T01:04:00.000Z",
  });

  assert.deepEqual(
    store.listTasks("session-a").map((task) => task.id),
    ["second", "third"],
  );
  assert.deepEqual(
    store.listTasks("session-b").map((task) => task.id),
    ["other"],
  );
});

test("generation task store records completion and returns immutable snapshots", () => {
  const store = createGenerationTaskStore();
  const savedItem = {
    filename: "generated.png",
    imageUrl: "/output/generated.png",
  };

  store.upsertTask("session-a", {
    id: "job-1",
    prompt: "测试图片",
    status: "running",
    statusText: "正在生成图片",
    createdAt: "2026-04-28T01:00:00.000Z",
  });
  store.completeTask("session-a", "job-1", {
    statusText: "图像已成功生成",
    item: savedItem,
    updatedAt: "2026-04-28T01:05:00.000Z",
  });

  const [snapshot] = store.listTasks("session-a");
  assert.equal(snapshot.status, "completed");
  assert.equal(snapshot.statusText, "图像已成功生成");
  assert.deepEqual(snapshot.item, savedItem);

  snapshot.item.filename = "mutated.png";
  assert.equal(store.listTasks("session-a")[0].item.filename, "generated.png");
});

test("generation task store records errors with a compact public status", () => {
  const store = createGenerationTaskStore();

  store.upsertTask("session-a", {
    id: "job-1",
    prompt: "失败图片",
    status: "running",
    createdAt: "2026-04-28T01:00:00.000Z",
  });
  store.failTask("session-a", "job-1", {
    errorMessage: "上游请求失败",
    updatedAt: "2026-04-28T01:01:00.000Z",
  });

  const [snapshot] = store.listTasks("session-a");
  assert.equal(snapshot.status, "error");
  assert.equal(snapshot.statusText, "上游请求失败");
  assert.equal(snapshot.errorMessage, "上游请求失败");
});

test("generation task store keeps at most 20 recent tasks by default", () => {
  const store = createGenerationTaskStore();

  for (let index = 1; index <= 21; index += 1) {
    store.upsertTask("session-a", {
      id: `job-${index}`,
      prompt: `第 ${index} 张图`,
      status: "running",
      createdAt: `2026-04-28T01:${String(index).padStart(2, "0")}:00.000Z`,
      updatedAt: `2026-04-28T01:${String(index).padStart(2, "0")}:00.000Z`,
    });
  }

  const taskIds = store.listTasks("session-a").map((task) => task.id);
  assert.equal(taskIds.length, 20);
  assert.equal(taskIds.includes("job-1"), false);
  assert.equal(taskIds[0], "job-21");
});
