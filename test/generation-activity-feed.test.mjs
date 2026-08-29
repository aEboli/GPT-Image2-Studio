import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCanceledGenerationActivityDetail,
  buildGenerationTaskActivityDetail,
  buildGenerationTaskStatusText,
  formatGenerationActivityModeLabel,
  getGenerationActivityDisplayText,
  sanitizeGenerationActivityDetail,
} from "../lib/generation-activity-feed.mjs";

// Entry ordering and timestamp retention now live in lib/generation-log-store.mjs,
// covered by test/generation-log-store.test.mjs.

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
      statusStage: "retrying_upstream",
      statusText: "重试中",
    }),
    "上游重试：重试中",
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

/* 心跳每 15 秒推来同一句话，日志行原地更新。摘要保留（任务仍看得出在跑），
   明细清空，改由变形图标做回执，否则同一件事在同一行里反复写。 */
test("heartbeat rows keep the summary but drop the repeated detail line", () => {
  assert.deepEqual(getGenerationActivityDisplayText("heartbeat（15 秒）：仍在等待最终图，请保持页面打开"), {
    summary: "图片生成中",
    detail: "",
  });
  assert.deepEqual(getGenerationActivityDisplayText("heartbeat（59 秒）：上游服务仍在处理，请保持页面打开"), {
    summary: "图片生成中",
    detail: "",
  });
  assert.deepEqual(getGenerationActivityDisplayText("heartbeat：上游服务仍在处理"), {
    summary: "图片生成中",
    detail: "",
  });
  // 非心跳的阶段文本是用户唯一的进度来源，明细必须照旧显示
  assert.deepEqual(getGenerationActivityDisplayText("上游重试：第 2 次"), {
    summary: "图片生成中",
    detail: "第 2 次",
  });
  assert.deepEqual(getGenerationActivityDisplayText("缺最终图补救：未收到最终图，正在兜底获取结果"), {
    summary: "图片生成中",
    detail: "未收到最终图，正在兜底获取结果",
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
