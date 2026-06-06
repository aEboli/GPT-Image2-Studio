import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanceledGenerationActivityDetail,
  buildGenerationTaskActivityDetail,
  buildGenerationTaskStatusText,
  formatGenerationActivityModeLabel,
  getGenerationActivityDisplayText,
  sanitizeGenerationActivityDetail,
  upsertGenerationActivityEntry,
} from "../lib/generation-activity-feed.mjs";

test("generation activity updates text without changing the original order", () => {
  const initialFeed = [
    {
      key: "job-new:task",
      title: "Running",
      detail: "New job is running",
      status: "active",
      at: "2026-05-04T10:01:00.000Z",
      orderAt: "2026-05-04T10:01:00.000Z",
    },
    {
      key: "job-old:task",
      title: "Running",
      detail: "Old job is running",
      status: "active",
      at: "2026-05-04T10:00:00.000Z",
      orderAt: "2026-05-04T10:00:00.000Z",
    },
  ];

  const updatedFeed = upsertGenerationActivityEntry(initialFeed, {
    key: "job-old:task",
    title: "Completed",
    detail: "Old job is complete",
    status: "done",
    at: "2026-05-04T10:05:00.000Z",
  });

  assert.deepEqual(
    updatedFeed.map((entry) => entry.key),
    ["job-new:task", "job-old:task"],
  );
  assert.equal(updatedFeed[1].detail, "Old job is complete");
  assert.equal(updatedFeed[1].at, "2026-05-04T10:05:00.000Z");
  assert.equal(updatedFeed[1].orderAt, "2026-05-04T10:00:00.000Z");
});

test("generation activity task details omit prompt text while preserving status details", () => {
  assert.equal(
    buildGenerationTaskActivityDetail({
      statusText: "正在生成图片",
      prompt: '{"title":"城堡露台日晖","prompt":"A castle balcony at sunrise"}',
    }),
    "正在生成图片",
  );
  assert.equal(
    buildGenerationTaskActivityDetail({
      statusText: "生成请求失败 · HTTP 403，错误码 insufficient_quota",
      prompt: "Quick Blend pair 4. Reference image prompt",
    }),
    "生成请求失败 · HTTP 403，错误码 insufficient_quota",
  );
  assert.equal(
    buildGenerationTaskActivityDetail({
      prompt: "A hidden prompt fragment",
    }),
    "未命名任务",
  );
});

test("generation task status copy distinguishes queue heartbeat retry recovery and final failure", () => {
  assert.equal(
    buildGenerationTaskStatusText({
      status: "running",
      statusStage: "queued",
      statusText: "已提交到服务器队列，等待后台生成",
    }),
    "排队中：已提交到服务器队列，等待后台生成",
  );
  assert.equal(
    buildGenerationTaskStatusText({
      status: "running",
      statusStage: "waiting_final",
      statusText: "heartbeat（59 秒）：仍在等待最终图，请保持页面打开",
    }),
    "heartbeat（59 秒）：仍在等待最终图，请保持页面打开",
  );
  assert.equal(
    buildGenerationTaskStatusText({
      status: "running",
      statusStage: "retrying_upstream",
      statusText: "上游服务短暂异常（HTTP 524），正在重试 1/2",
    }),
    "上游重试：上游服务短暂异常（HTTP 524），正在重试 1/2",
  );
  assert.equal(
    buildGenerationTaskStatusText({
      status: "running",
      statusStage: "missing_final_recovery",
      statusText: "流式响应未返回最终图，正在兜底获取结果",
    }),
    "缺最终图补救：流式响应未返回最终图，正在兜底获取结果",
  );
  assert.equal(
    buildGenerationTaskStatusText({
      status: "error",
      statusStage: "error",
      statusText: "生成失败",
      errorMessage: "上游响应结束，但没有拿到最终图片。",
    }),
    "最终失败：上游响应结束，但没有拿到最终图片。",
  );
});

test("generation activity canceled details omit prompt text", () => {
  assert.equal(
    buildCanceledGenerationActivityDetail({
      prompt: "A queued prompt that should not appear in the log",
    }),
    "已取消排队任务",
  );
});

test("generation activity display text splits event details from status summary", () => {
  assert.deepEqual(
    getGenerationActivityDisplayText(
      "最终失败：上游响应结束，但没有拿到最终图片。已收到事件：unknown, response.created, response.completed。请降低分辨率或并发后重试。",
    ),
    {
      summary: "生成失败",
      detail: "上游响应结束，但没有拿到最终图片。已收到事件：unknown, response.created, response.completed。请降低分辨率或并发后重试。",
    },
  );
  assert.deepEqual(getGenerationActivityDisplayText("最终失败：fetch failed"), {
    summary: "生成失败",
    detail: "fetch failed",
  });
  assert.deepEqual(getGenerationActivityDisplayText("图像已成功生成"), {
    summary: "图片已生成",
    detail: "",
  });
  assert.deepEqual(getGenerationActivityDisplayText("正在生成图片"), {
    summary: "图片生成中",
    detail: "",
  });
  assert.deepEqual(getGenerationActivityDisplayText("已收到中途预览"), {
    summary: "图片生成中",
    detail: "",
  });
  assert.deepEqual(getGenerationActivityDisplayText("排队中：等待资源分配"), {
    summary: "图片生成中",
    detail: "等待资源分配",
  });
});

test("generation activity mode label distinguishes route and direct calls", () => {
  assert.equal(formatGenerationActivityModeLabel("a"), "路由模式");
  assert.equal(formatGenerationActivityModeLabel("b"), "直接调用模式");
  assert.equal(formatGenerationActivityModeLabel(""), "");
});

test("generation activity sanitizes prompt suffixes from persisted details", () => {
  assert.equal(
    sanitizeGenerationActivityDetail("图像已成功生成 · Quick Blend pair 1. Reference image prompt"),
    "图像已成功生成",
  );
  assert.equal(
    sanitizeGenerationActivityDetail("生成请求失败 · HTTP 403，错误码 insufficient_quota · Quick Blend pair 4. Reference image prompt"),
    "生成请求失败 · HTTP 403，错误码 insufficient_quota",
  );
  assert.equal(
    sanitizeGenerationActivityDetail("生成请求失败 · HTTP 403，错误码 insufficient_quota"),
    "生成请求失败 · HTTP 403，错误码 insufficient_quota",
  );
});
