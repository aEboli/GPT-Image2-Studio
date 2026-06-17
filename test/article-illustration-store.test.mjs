import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildArticleRelativeDir,
  createArticleIllustrationSetStore,
  normalizeArticleIllustrationSetManifest,
} from "../lib/article-illustration-store.mjs";

test("article illustration store builds dated article directories beside creation and ppt folders", () => {
  assert.equal(
    buildArticleRelativeDir({
      createdAt: "2026-05-09T09:08:07.000Z",
      title: "Rain Alley",
      setId: "article-set-abc12345",
    }),
    "2026-05/05-09/2026-05-09-article/RainAlley-abc12345",
  );
});

test("article illustration manifest preserves plan, reference cards, captions, and item order", () => {
  const manifest = normalizeArticleIllustrationSetManifest(
    {
      setId: "article-set-demo",
      title: "Rain Alley",
      sourceSummary: "short story",
      contentType: "narrative",
      stylePreset: "editorial-watercolor",
      styleBible: "Muted watercolor.",
      createdAt: "2026-05-09T09:00:00.000Z",
      status: "in_progress",
      relativeDir: "2026-05/05-09/2026-05-09-article/RainAlley-demo",
      characters: [{ id: "mira", name: "Mira" }],
      scenes: [{ id: "theater", name: "Old theater" }],
      referenceCards: [{ cardId: "mira-card", targetType: "character", title: "Mira reference" }],
      items: [
        {
          itemId: "scene-2",
          slotIndex: 2,
          itemKind: "storyboard",
          paragraphIndex: 4,
          timelineIndex: 2,
          title: "Mira looks up",
          prompt: "Medium shot.",
          captionText: "Mira stopped under the old theater sign.",
          relativePath: "2026-05/05-09/2026-05-09-article/RainAlley-demo/02-scene.png",
        },
        {
          itemId: "reference-mira-card",
          slotIndex: 1,
          itemKind: "reference-card",
          title: "Mira reference",
          prompt: "Character sheet.",
          captionText: "Mira character reference",
          relativePath: "2026-05/05-09/2026-05-09-article/RainAlley-demo/01-reference.png",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.deepEqual(
    manifest.items.map((item) => item.itemId),
    ["reference-mira-card", "scene-2"],
  );
  assert.equal(manifest.referenceCards[0].cardId, "mira-card");
  assert.equal(manifest.status, "in_progress");
  assert.equal(manifest.items[1].paragraphIndex, 4);
  assert.equal(manifest.items[1].timelineIndex, 2);
  assert.equal(manifest.items[1].captionText, "Mira stopped under the old theater sign.");
  assert.equal(
    manifest.items[0].imageUrl,
    "/output/2026-05/05-09/2026-05-09-article/RainAlley-demo/01-reference.png",
  );
});

test("article illustration manifest groups references before storyboard images", () => {
  const manifest = normalizeArticleIllustrationSetManifest(
    {
      setId: "article-set-order",
      title: "Rain Alley",
      items: [
        {
          itemId: "scene-1",
          slotIndex: 1,
          itemKind: "storyboard",
          paragraphIndex: 2,
          timelineIndex: 2,
          title: "Opening",
        },
        {
          itemId: "reference-mira-card",
          slotIndex: 2,
          itemKind: "reference-card",
          title: "Mira reference",
        },
        {
          itemId: "scene-2",
          slotIndex: 3,
          itemKind: "storyboard",
          paragraphIndex: 1,
          timelineIndex: 1,
          title: "Turn",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.deepEqual(
    manifest.items.map((item) => `${item.slotIndex}:${item.itemId}`),
    ["1:reference-mira-card", "2:scene-2", "3:scene-1"],
  );
  assert.deepEqual(
    manifest.items.filter((item) => item.itemKind !== "reference-card").map((item) => `${item.paragraphIndex}:${item.timelineIndex}`),
    ["1:1", "2:2"],
  );
});

test("article illustration manifest defaults missing style to realist magazine", () => {
  const manifest = normalizeArticleIllustrationSetManifest({
    setId: "article-set-style-default",
    title: "Style Default",
    items: [],
  });

  assert.equal(manifest.stylePreset, "realist-magazine");
});

test("article illustration set store writes and lists manifests newest first", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "article-illustration-store-"));
  const store = createArticleIllustrationSetStore({ outputDir, publicBasePath: "/output" });

  await store.saveManifest({
    setId: "article-set-old",
    title: "Old Story",
    createdAt: "2026-05-08T10:00:00.000Z",
    status: "planned",
    items: [],
  });
  await store.saveManifest({
    setId: "article-set-new",
    title: "New Story",
    createdAt: "2026-05-09T10:00:00.000Z",
    status: "partial_failed",
    items: [
      {
        itemId: "scene-1",
        slotIndex: 1,
        title: "Opening",
        relativePath: "2026-05/05-09/2026-05-09-article/NewStory-new/01-opening.png",
      },
    ],
  });

  const manifests = await store.listManifests();
  const raw = await readFile(store.manifestPath("article-set-new"), "utf8");

  assert.deepEqual(
    manifests.map((manifest) => manifest.setId),
    ["article-set-new", "article-set-old"],
  );
  assert.equal(manifests[0].status, "partial_failed");
  assert.match(raw, /"setId": "article-set-new"/);
});
