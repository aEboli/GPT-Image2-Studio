import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  buildPortraitRelativeDir,
  createPortraitSetStore,
  normalizePortraitSetManifest,
} from "../lib/portrait-store.mjs";
import {
  applyPortraitRepairOverrides,
  selectPortraitRepairItems,
} from "../lib/portrait-repair.mjs";

test("portrait store builds dated portrait directories with three digit image filenames", () => {
  assert.equal(
    buildPortraitRelativeDir({
      createdAt: new Date(2026, 4, 5, 9, 8, 7),
      subjectName: "Studio Model",
      setId: "portrait-set-abc12345",
    }),
    "2026-05/05-05/2026-05-05-portrait/0908-StudioModel-abc12345",
  );

  const manifest = normalizePortraitSetManifest(
    {
      setId: "portrait-set-demo",
      subjectName: "Studio Model",
      createdAt: "2026-05-05T09:00:00.000Z",
      status: "completed",
      items: [
        {
          itemId: "100-close-up",
          slotIndex: 100,
          title: "close-up",
          relativePath: "2026-05/05-05/2026-05-05-portrait/demo/100-close-up.png",
        },
        {
          itemId: "001-long-shot",
          slotIndex: 1,
          title: "long shot",
          relativePath: "2026-05/05-05/2026-05-05-portrait/demo/001-long-shot.png",
        },
      ],
    },
    { publicBasePath: "/output" },
  );

  assert.deepEqual(
    manifest.items.map((item) => item.filename),
    ["001-long-shot.png", "100-close-up.png"],
  );
  assert.equal(
    manifest.items[0].imageUrl,
    "/output/2026-05/05-05/2026-05-05-portrait/demo/001-long-shot.png",
  );
});

test("portrait store preserves analysis, style and reference metadata for record reuse", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "portrait-store-"));
  const store = createPortraitSetStore({ outputDir, publicBasePath: "/output" });
  const manifest = await store.saveManifest({
    setId: "portrait-set-demo",
    subjectName: "Studio Model",
    subjectSummary: "adult subject, short dark hair, navy blazer",
    analysis: {
      visiblePresentation: "feminine-presenting",
      heightImpression: "average",
      bodyBuild: "slim",
      risks: ["adult status not confirmed"],
    },
    referenceImageNames: ["person.png"],
    selectedStyles: ["business-profile", "retro-film"],
    selectedShotTypes: ["full-body", "close-up"],
    selectedActions: ["standing-relaxed", "walking-step"],
    customStyle: "warm gallery portrait",
    notes: "calm expression",
    ratio: "4:5",
    size: "1024x1280",
    format: "jpg",
    imageCount: 2,
    createdAt: "2026-05-05T09:00:00.000Z",
    status: "generating",
    items: [
      {
        itemId: "001-long-shot",
        slotIndex: 1,
        style: "business-profile",
        action: "standing-relaxed",
        actionLabel: "站立",
        actionInstruction: "relaxed standing pose",
        prompt: "first prompt",
        status: "completed",
        filename: "001-long-shot.jpg",
        relativePath: "2026-05/05-05/2026-05-05-portrait/demo/001-long-shot.jpg",
      },
    ],
  });
  const raw = await readFile(store.manifestPath("portrait-set-demo"), "utf8");

  assert.equal(store.manifestsDir.endsWith(join("json", "portrait-sets")), true);
  assert.equal(manifest.subjectSummary, "adult subject, short dark hair, navy blazer");
  assert.equal(manifest.analysis.visiblePresentation, "feminine-presenting");
  assert.deepEqual(manifest.referenceImageNames, ["person.png"]);
  assert.deepEqual(manifest.selectedShotTypes, ["full-body", "close-up"]);
  assert.deepEqual(manifest.selectedActions, ["standing-relaxed", "walking-step"]);
  assert.equal(manifest.items[0].action, "standing-relaxed");
  assert.equal(manifest.items[0].actionLabel, "站立");
  assert.deepEqual(JSON.parse(raw).selectedStyles, ["business-profile", "retro-film"]);
  assert.deepEqual(JSON.parse(raw).selectedShotTypes, ["full-body", "close-up"]);
  assert.deepEqual(JSON.parse(raw).selectedActions, ["standing-relaxed", "walking-step"]);
});

test("portrait set store lists newest manifests first", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "portrait-store-list-"));
  const store = createPortraitSetStore({ outputDir, publicBasePath: "/output" });

  await store.saveManifest({
    setId: "portrait-old",
    subjectName: "Old",
    subjectSummary: "old subject",
    createdAt: "2026-05-04T10:00:00.000Z",
  });
  await store.saveManifest({
    setId: "portrait-new",
    subjectName: "New",
    subjectSummary: "new subject",
    createdAt: "2026-05-05T10:00:00.000Z",
  });

  assert.deepEqual(
    (await store.listManifests()).map((set) => set.setId),
    ["portrait-new", "portrait-old"],
  );
});

test("portrait repair selects failed or incomplete items and applies prompt overrides", () => {
  const portraitSet = {
    items: [
      { itemId: "001", status: "completed", filename: "001.png", relativePath: "set/001.png", prompt: "old" },
      { itemId: "002", status: "failed", prompt: "failed" },
      { itemId: "003", status: "completed", filename: "", relativePath: "", prompt: "missing file" },
    ],
  };

  assert.deepEqual(
    selectPortraitRepairItems(portraitSet).map((item) => item.itemId),
    ["002"],
  );
  assert.deepEqual(
    selectPortraitRepairItems(portraitSet, { scope: "incomplete" }).map((item) => item.itemId),
    ["002", "003"],
  );
  assert.deepEqual(
    selectPortraitRepairItems(portraitSet, { itemId: "001" }).map((item) => item.itemId),
    ["001"],
  );
  assert.equal(
    applyPortraitRepairOverrides(portraitSet.items[1], { promptOverride: "new prompt" }).prompt,
    "new prompt",
  );
});
