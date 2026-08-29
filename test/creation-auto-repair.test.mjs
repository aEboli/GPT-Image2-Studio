import test from "node:test";
import assert from "node:assert/strict";

import {
  CREATION_AUTO_REPAIR_MAX_ATTEMPTS,
  getCreationCompletionFeedback,
  getCreationFatalUpstreamError,
  getCreationIncompleteItems,
  shouldAutoRepairCreationSet,
} from "../lib/creation-auto-repair.mjs";

test("creation auto repair selects failed and pathless items only once after full generation", () => {
  const set = {
    setId: "creation-set-repair",
    items: [
      { itemId: "done", status: "completed", filename: "done.png", relativePath: "creation/done.png" },
      {
        itemId: "remote-done",
        status: "completed",
        filename: "remote-done.png",
        relativePath: "",
        imageUrl: "https://images.example/remote-done.png",
        storageKey: "creation/remote-done.png",
      },
      { itemId: "failed", status: "failed", filename: "", relativePath: "" },
      { itemId: "pathless", status: "completed", filename: "pathless.png", relativePath: "" },
    ],
  };

  assert.equal(CREATION_AUTO_REPAIR_MAX_ATTEMPTS, 1);
  assert.deepEqual(getCreationIncompleteItems(set).map((item) => item.itemId), ["failed", "pathless"]);
  assert.equal(
    shouldAutoRepairCreationSet({
      set,
      generationScope: "full",
      autoRepairAttemptCount: 0,
      canRepair: true,
    }),
    true,
  );
  assert.equal(
    shouldAutoRepairCreationSet({
      set,
      generationScope: "full",
      autoRepairAttemptCount: 1,
      canRepair: true,
    }),
    false,
  );
  assert.deepEqual(getCreationCompletionFeedback(set), {
    message: "套图生成结束，仍有 2 个项目未完成，可手动补齐。",
    tone: "error",
  });
});

test("creation auto repair short-circuits on an account-level upstream error", () => {
  const quotaError = "生成请求失败：HTTP 402，错误码 insufficient_quota，Model capacity is temporarily unavailable.";
  const set = {
    items: [
      { itemId: "done", status: "completed", filename: "done.png", relativePath: "creation/done.png" },
      { itemId: "quota", status: "failed", filename: "", relativePath: "", error: quotaError },
    ],
  };

  // Another repair pass would hit the same account wall on every item.
  assert.equal(getCreationFatalUpstreamError(set), quotaError);
  assert.equal(
    shouldAutoRepairCreationSet({ set, generationScope: "full", autoRepairAttemptCount: 0, canRepair: true }),
    false,
  );

  // An aborted sibling carries the reason too, so it short-circuits the same way.
  const abortedSet = {
    items: [
      { itemId: "skipped", status: "failed", filename: "", relativePath: "", error: `已中止本批剩余任务：${quotaError}` },
    ],
  };
  assert.ok(getCreationFatalUpstreamError(abortedSet));
  assert.equal(
    shouldAutoRepairCreationSet({ set: abortedSet, generationScope: "full", autoRepairAttemptCount: 0, canRepair: true }),
    false,
  );
});

test("creation auto repair still runs for transient and per-item failures", () => {
  const set = {
    items: [
      { itemId: "done", status: "completed", filename: "done.png", relativePath: "creation/done.png" },
      {
        itemId: "rate-limited",
        status: "failed",
        filename: "",
        relativePath: "",
        error: "生成请求失败：HTTP 429，错误码 rate_limit_exceeded，Rate limit reached.",
      },
      { itemId: "no-final", status: "failed", filename: "", relativePath: "", error: "上游响应结束，但没有拿到最终图。" },
    ],
  };

  assert.equal(getCreationFatalUpstreamError(set), "");
  assert.equal(
    shouldAutoRepairCreationSet({ set, generationScope: "full", autoRepairAttemptCount: 0, canRepair: true }),
    true,
  );
});

test("creation auto repair treats reconciled missing assets as incomplete", () => {
  const set = {
    items: [
      {
        itemId: "missing-file",
        status: "completed",
        filename: "missing-file.png",
        relativePath: "creation/missing-file.png",
        missingAsset: true,
      },
    ],
  };

  assert.deepEqual(getCreationIncompleteItems(set).map((item) => item.itemId), ["missing-file"]);
  assert.equal(
    shouldAutoRepairCreationSet({
      set,
      generationScope: "full",
      autoRepairAttemptCount: 0,
      canRepair: true,
    }),
    false,
  );
});
