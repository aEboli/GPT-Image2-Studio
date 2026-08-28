import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { formatLoadingThumbnailStatusLabel } from "../lib/preview-placeholder-state.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const imageEditViewPath = new URL("../lib/views/image-edit-view.mjs", import.meta.url);
const quickBlendViewPath = new URL("../lib/views/quick-blend-view.mjs", import.meta.url);

test("loading thumbnail status labels use short stage copy", () => {
  assert.equal(formatLoadingThumbnailStatusLabel({ statusStage: "queued", isRunning: true }), "排队中");
  assert.equal(formatLoadingThumbnailStatusLabel({ statusStage: "uploading", isRunning: true }), "发送请求中");
  assert.equal(formatLoadingThumbnailStatusLabel({ statusStage: "connecting", isRunning: true }), "连接中");
  assert.equal(formatLoadingThumbnailStatusLabel({ statusStage: "generating", isRunning: true }), "生成中");
  assert.equal(formatLoadingThumbnailStatusLabel({ statusStage: "waiting_final", isRunning: true }), "获取中");
  assert.equal(formatLoadingThumbnailStatusLabel({ statusStage: "retrying_upstream", isRunning: true }), "重试中");
  assert.equal(formatLoadingThumbnailStatusLabel({ statusStage: "saving", isRunning: true }), "保存中");
});

test("loading thumbnail status labels derive short copy from detailed status text", () => {
  assert.equal(
    formatLoadingThumbnailStatusLabel({ started: true, statusText: "正在准备生成请求" }),
    "发送请求中",
  );
  assert.equal(
    formatLoadingThumbnailStatusLabel({ started: true, statusText: "排队中：已提交到服务器队列，等待后台生成" }),
    "排队中",
  );
  assert.equal(
    formatLoadingThumbnailStatusLabel({ started: true, statusText: "最终图已接收，正在写入浏览器缓存" }),
    "保存中",
  );
  assert.equal(
    formatLoadingThumbnailStatusLabel({ started: true, statusText: "正在接收最终图数据" }),
    "获取中",
  );
  assert.equal(formatLoadingThumbnailStatusLabel({ started: false }, { idleLabel: "等待" }), "等待");
});

test("generation thumbnail renderers use the shared loading shell", async () => {
  const [app, imageEditView, quickBlendView] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(imageEditViewPath, "utf8"),
    readFile(quickBlendViewPath, "utf8"),
  ]);

  // 每个缩略图入口都要把真实阶段透传给共享加载壳，颜色才能对应当前请求阶段。
  assert.match(app, /createGenerationLoadingShell\(document, \{ key, active: true, stage: getGenerationLoadingItemStage\(item\) \}\)/);
  assert.match(app, /createGenerationLoadingShell\(document, \{ key, active: true, mode, stage: getGenerationLoadingItemStage\(item\) \}\)\.shell/);
  assert.match(app, /isWaitingPreviewItem\(item\) \? GENERATION_LOADING_WAITING_MODE : GENERATION_LOADING_GENERATING_MODE/);
  assert.match(imageEditView, /createGenerationLoadingShell\(document, \{ key, active: true, stage: getGenerationLoadingItemStage\(item\) \}\)/);
  assert.match(quickBlendView, /createGenerationLoadingShell\(document, \{ key, active: true, stage: getGenerationLoadingItemStage\(item\) \}\)/);
});
