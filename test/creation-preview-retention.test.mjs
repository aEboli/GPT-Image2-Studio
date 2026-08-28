import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

import { mergeCreationItemPreview, mergeCreationSetPreviews } from "../lib/creation-preview-retention.mjs";

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
  assert.equal(app.includes("function upsertCreationSetForStream"), true, "stream merge boundary missing");
});
