import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import test from "node:test";
import { buildFinalImageChunkKey } from "../lib/generation-stream-protocol.mjs";

test("saving a suite item releases its assembled image chunks without touching concurrent items", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const start = app.indexOf('  if (eventName === "item_saved") {', app.indexOf("async function handleCreationStreamEvent"));
  const end = app.indexOf('  if (eventName === "item_requeued") {', start);
  const key = "set-1::item-1";
  const otherKey = "set-1::item-2";
  for (const payload of [
    { setId: "set-1", item: { itemId: "item-1", imageUrl: "/output/saved.png" } },
    { setId: "set-1", item: { itemId: "item-1", imageUrl: "/output/saved.png" }, stale: true },
    { set: { setId: "set-1" }, itemId: "item-1" },
  ]) {
    const context = {
      finalImageChunks: new Map([[key, { dataUrl: "large-final-image" }], [otherKey, { dataUrl: "other-final-image" }]]),
      partialImageChunks: new Map([[key, { dataUrl: "large-preview" }], [otherKey, { dataUrl: "other-preview" }]]),
    };
    await runInNewContext(`(async () => { ${app.slice(start, end)} })()`, {
      eventName: "item_saved", payload, context, buildFinalImageChunkKey,
      upsertCreationSetForStream() {}, shouldApplyCreationStreamItemUpdate: () => !payload.stale,
      updateCreationStreamItem() {}, setCreationFeedback() {}, recordCreationLogEvent() {}, renderCreationView() {},
      scheduleCreationProgressRender() {},
      nowIso: () => "2026-11-01T00:00:00Z", getImageUrl: (item) => item?.imageUrl || "",
    });
    assert.equal(context.finalImageChunks.has(key), false);
    assert.equal(context.partialImageChunks.has(key), false);
    assert.equal(context.finalImageChunks.has(otherKey), true);
    assert.equal(context.partialImageChunks.has(otherKey), true);
  }
});
