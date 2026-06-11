import test from "node:test";
import assert from "node:assert/strict";

import {
  CREATION_AUTO_REPAIR_MAX_ATTEMPTS,
  getCreationCompletionFeedback,
  getCreationIncompleteItems,
  shouldAutoRepairCreationSet,
} from "../lib/creation-auto-repair.mjs";

test("creation auto repair selects failed and pathless items only once after full generation", () => {
  const set = {
    setId: "creation-set-repair",
    items: [
      { itemId: "done", status: "completed", filename: "done.png", relativePath: "creation/done.png" },
      {
        itemId: "cloudflare-done",
        status: "completed",
        filename: "cloudflare-done.png",
        relativePath: "",
        imageUrl: "https://images.example/cloudflare-done.png",
        storageKey: "creation/cloudflare-done.png",
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
