import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { getRequeueNotice } from "../lib/generation-item-retry.mjs";
import { mergeCreationSetPreviews } from "../lib/creation-preview-retention.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

function getRequeueBranch(source, dispatcherName, eventGuard) {
  const dispatcherStart = source.indexOf(dispatcherName);
  assert.ok(dispatcherStart > 0, `could not find ${dispatcherName}`);
  const branchStart = source.indexOf(eventGuard, dispatcherStart);
  assert.ok(branchStart > 0, `${dispatcherName} must handle item_requeued`);
  return source.slice(branchStart, branchStart + 1_400);
}

test("the creation dispatcher restores a requeued item to a queued, error-free state", () => {
  const branch = getRequeueBranch(app, "async function handleCreationStreamEvent", 'if (eventName === "item_requeued")');

  assert.match(branch, /status: "queued"/);
  assert.match(branch, /error: ""/);
  // A requeue is still in-flight work, so the feedback must not use the error tone.
  assert.match(branch, /setCreationFeedback\(requeueNotice, "busy"\)/);
  assert.doesNotMatch(branch, /"error"\)/);
  // The retry reason has to travel through the log store, because creation view
  // items are a strict allowlist that would drop a per-item status field.
  assert.match(branch, /recordCreationLogEvent\(\{/);
  assert.match(branch, /status: "pending"/);
  assert.match(branch, /statusStage: "queued"/);
});

test("the portrait dispatcher restores a requeued item to a queued, error-free state", () => {
  const branch = getRequeueBranch(app, "function handlePortraitStreamEvent", 'if (eventName === "item_requeued")');

  assert.match(branch, /status: "queued", error: ""/);
  assert.match(branch, /setPortraitFeedback\(portraitRequeueNotice, "busy"\)/);
  assert.match(branch, /recordPortraitLogEvent\(\{/);
  assert.match(branch, /status: "pending"/);
  assert.match(branch, /statusStage: "queued"/);
});

test("both dispatchers fall back to a locally built notice when the server omits one", () => {
  for (const dispatcher of ["async function handleCreationStreamEvent", "function handlePortraitStreamEvent"]) {
    const branch = getRequeueBranch(app, dispatcher, 'if (eventName === "item_requeued")');
    assert.match(branch, /payload\.notice \|\| getRequeueNotice\(\{/);
  }
  assert.match(app, /import \{ getRequeueNotice \} from "\/lib\/generation-item-retry\.mjs";/);
});

test("a requeued item keeps the preview the user already watched appear", () => {
  // The server manifest never carries mid-generation previews, so applying it for a
  // requeued item would otherwise blank the card the user was already watching.
  const previousSet = {
    setId: "set-1",
    items: [{ itemId: "item-1", status: "generating", imageUrl: "blob:preview-1", thumbnailUrl: "blob:preview-1" }],
  };
  const incomingSet = {
    setId: "set-1",
    items: [{ itemId: "item-1", status: "queued", error: "" }],
  };

  const merged = mergeCreationSetPreviews(incomingSet, previousSet);

  assert.equal(merged.items[0].status, "queued");
  assert.equal(merged.items[0].imageUrl, "blob:preview-1");
  assert.equal(merged.items[0].previewRetained, true);
});

test("the requeue notice keeps the upstream failure reason visible to the user", () => {
  const notice = getRequeueNotice({ message: "上游返回 429", attempt: 1, maxRetries: 1 });

  assert.match(notice, /上游返回 429/);
  assert.match(notice, /重试 1\/1/);
});
