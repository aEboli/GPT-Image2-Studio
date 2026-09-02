import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import {
  mergeCreationItemPreview,
  mergeCreationItemStreamUpdate,
  mergeCreationSetPreviews,
} from "../lib/creation-preview-retention.mjs";

test("a failed item keeps the preview the user already saw", () => {
  const merged = mergeCreationItemPreview(
    { itemId: "1-hero", status: "failed", error: "上游中断" },
    { itemId: "1-hero", status: "generating", imageUrl: "data:image/png;base64,UFJFVg==", thumbnailUrl: "data:image/png;base64,UFJFVg==" },
  );

  assert.equal(merged.imageUrl, "data:image/png;base64,UFJFVg==");
  assert.equal(merged.thumbnailUrl, "data:image/png;base64,UFJFVg==");
  assert.equal(merged.status, "failed");
  assert.equal(merged.error, "上游中断");
  assert.equal(merged.previewRetained, true);
});

test("a stored asset replaces the retained preview", () => {
  const merged = mergeCreationItemPreview(
    { itemId: "1-hero", status: "completed", relativePath: "creation/set/1-hero.png", filename: "1-hero.png" },
    { itemId: "1-hero", status: "generating", imageUrl: "data:image/png;base64,UFJFVg==" },
  );

  assert.equal(merged.imageUrl, undefined);
  assert.equal(merged.previewRetained, undefined);
});

test("an incoming item with its own image is left alone", () => {
  const merged = mergeCreationItemPreview(
    { itemId: "1-hero", status: "generating", imageUrl: "data:image/png;base64,TkVX" },
    { itemId: "1-hero", status: "generating", imageUrl: "data:image/png;base64,T0xE" },
  );

  assert.equal(merged.imageUrl, "data:image/png;base64,TkVX");
});

test("an item with no previous preview is unchanged", () => {
  const merged = mergeCreationItemPreview(
    { itemId: "1-hero", status: "failed" },
    { itemId: "1-hero", status: "queued" },
  );

  assert.deepEqual(merged, { itemId: "1-hero", status: "failed" });
});

test("a stale manifest cannot replace a completed stored item", () => {
  const previous = {
    itemId: "1-hero",
    status: "completed",
    filename: "1-hero.png",
    relativePath: "creation/set-1/1-hero.png",
    imageUrl: "/output/creation/set-1/1-hero.png",
  };
  const merged = mergeCreationItemPreview(
    { itemId: "1-hero", status: "failed", error: "旧流已结束" },
    previous,
  );

  assert.deepEqual(merged, previous);
});

test("a stale manifest keeps a completed stored item at the set merge boundary", () => {
  const previousItem = {
    itemId: "1-hero",
    status: "completed",
    filename: "1-hero.png",
    relativePath: "creation/set-1/1-hero.png",
    imageUrl: "/output/creation/set-1/1-hero.png",
  };
  const merged = mergeCreationSetPreviews(
    { setId: "set-1", items: [{ itemId: "1-hero", status: "generating" }] },
    { setId: "set-1", items: [previousItem] },
  );

  assert.deepEqual(merged.items[0], previousItem);
});

test("late in-flight stream updates cannot downgrade a completed stored item", () => {
  const saved = {
    itemId: "1-hero",
    status: "completed",
    filename: "1-hero.png",
    relativePath: "creation/set-1/1-hero.png",
    imageUrl: "/output/creation/set-1/1-hero.png",
  };
  const lateUpdates = [
    { status: "generating" },
    { status: "generating", imageUrl: "data:image/png;base64,UEFSVElBTA==" },
    { status: "generating", imageUrl: "data:image/png;base64,RklOQUw=" },
    { status: "queued", error: "" },
    { status: "failed", error: "旧请求失败" },
  ];

  for (const update of lateUpdates) {
    const merged = mergeCreationItemStreamUpdate(saved, update);
    assert.deepEqual(merged, saved);
  }
});

test("a manually restarted item accepts new stream updates", () => {
  const manuallyRestarted = {
    itemId: "1-hero",
    status: "generating",
    filename: "1-hero.png",
    relativePath: "creation/set-1/1-hero.png",
  };
  const merged = mergeCreationItemStreamUpdate(manuallyRestarted, {
    status: "generating",
    imageUrl: "data:image/png;base64,TkVX",
    thumbnailUrl: "data:image/png;base64,TkVX",
  });

  assert.equal(merged.status, "generating");
  assert.equal(merged.imageUrl, "data:image/png;base64,TkVX");
  assert.equal(merged.thumbnailUrl, "data:image/png;base64,TkVX");
});

test("merging a manifest retains previews per item", () => {
  const previousSet = {
    setId: "set-1",
    items: [
      { itemId: "1-hero", status: "generating", imageUrl: "data:image/png;base64,SEVSTw==" },
      { itemId: "2-detail", status: "generating", imageUrl: "data:image/png;base64,REVUQUlM" },
      { itemId: "3-scene", status: "queued" },
    ],
  };
  const incomingSet = {
    setId: "set-1",
    status: "partial_failed",
    items: [
      { itemId: "1-hero", status: "completed", relativePath: "creation/set-1/1-hero.png", filename: "1-hero.png" },
      { itemId: "2-detail", status: "failed", error: "结果未知" },
      { itemId: "3-scene", status: "failed", error: "结果未知" },
    ],
  };

  const merged = mergeCreationSetPreviews(incomingSet, previousSet);

  assert.equal(merged.status, "partial_failed");
  assert.equal(merged.items[0].imageUrl, undefined, "saved asset wins");
  assert.equal(merged.items[1].imageUrl, "data:image/png;base64,REVUQUlM", "failed item keeps its preview");
  assert.equal(merged.items[1].error, "结果未知");
  assert.equal(merged.items[2].imageUrl, undefined, "never-previewed item stays empty");
});

test("a manifest for a different set never borrows previews", () => {
  const merged = mergeCreationSetPreviews(
    { setId: "set-2", items: [{ itemId: "1-hero", status: "failed" }] },
    { setId: "set-1", items: [{ itemId: "1-hero", status: "generating", imageUrl: "data:image/png;base64,T1RIRVI=" }] },
  );

  assert.equal(merged.items[0].imageUrl, undefined);
});

test("the creation stream merge boundary uses the retention helper", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  // Boolean checks: a failed assert.match on an 800 KB bundle prints the whole file.
  assert.equal(app.includes("mergeCreationSetPreviews"), true, "app.js must merge previews at the stream boundary");
  assert.equal(app.includes("mergeCreationItemStreamUpdate"), true, "app.js must protect item-level stream updates");
  assert.equal(app.includes("function upsertCreationSetForStream"), true, "stream merge boundary missing");
});

test("a failed manual repair refreshes the persisted set before it clears the local loading state", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const repairStart = app.indexOf("async function repairCreationItems");
  const repairEnd = app.indexOf("\nfunction normalizePortraitItemForView", repairStart);

  assert.ok(repairStart >= 0 && repairEnd > repairStart, "manual repair handler missing");
  assert.equal(app.slice(repairStart, repairEnd).includes("await loadCreationSets();"), true);
});
