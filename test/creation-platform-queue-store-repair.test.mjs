import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createCreationQueueJob,
} from "../lib/creation-suite-queue.mjs";
import { createCreationSetStore, normalizeCreationSetManifest } from "../lib/creation-store.mjs";
import {
  buildCreationRepairPlan,
  refreshCreationRepairItemsFromPlan,
} from "../lib/creation-repair.mjs";

test("creation queue snapshots the effective plan at submission", () => {
  const creationState = { queue: [] };
  const sourceSet = {
    setId: "queued-set",
    platform: "amazon",
    strategyVersion: "2026-07-11.1",
    platformSetOverrides: { imageCount: 7, ratio: "1:1" },
    items: [{ itemId: "slot-1", imageType: "amazon-main", prompt: "frozen", ratio: "1:1", effectiveSize: "2K", targetLanguage: "en" }],
  };

  const job = createCreationQueueJob({
    creationState,
    formData: new FormData(),
    set: sourceSet,
    normalizeSet: (value) => value,
    nowIso: () => "2026-07-12T00:00:00.000Z",
    idFactory: () => "queue-1",
  });

  sourceSet.platform = "etsy";
  sourceSet.platformSetOverrides.imageCount = 2;
  sourceSet.items[0].prompt = "edited after submit";
  sourceSet.items[0].ratio = "4:3";

  assert.equal(job.set.platform, "amazon");
  assert.equal(job.set.platformSetOverrides.imageCount, 7);
  assert.equal(job.set.items[0].prompt, "frozen");
  assert.equal(job.set.items[0].ratio, "1:1");
});

test("creation manifest preserves strategy metadata, effective counts, and provenance", () => {
  const manifest = normalizeCreationSetManifest({
    setId: "set-explicit",
    platform: "amazon",
    strategyVersion: "2026-07-11.1",
    platformPolicyId: "amazon",
    platformEvidenceLevel: "A",
    platformProvenance: "explicit",
    platformSetOverrides: { imageCount: 7 },
    carouselImageCount: 2,
    skuImageCount: 1,
    infographicRebuildCount: 1,
    totalPlannedItemCount: 4,
    items: [
      { itemId: "a", slotIndex: 1, role: "hero", imageType: "amazon-main", prompt: "p", ratio: "1:1", effectiveSize: "2K", targetLanguage: "en" },
      { itemId: "b", slotIndex: 2, role: "sku", imageType: "sku-item", prompt: "s", ratio: "1:1", effectiveSize: "1.5K", targetLanguage: "en" },
    ],
  });

  assert.equal(manifest.strategyVersion, "2026-07-11.1");
  assert.equal(manifest.platformPolicyId, "amazon");
  assert.equal(manifest.platformProvenance, "explicit");
  assert.deepEqual(manifest.platformSetOverrides, { imageCount: 7 });
  assert.equal(manifest.carouselImageCount, 2);
  assert.equal(manifest.skuImageCount, 1);
  assert.equal(manifest.totalPlannedItemCount, 4);
  assert.equal(manifest.items[0].imageType, "amazon-main");
  assert.equal(manifest.items[0].effectiveSize, "2K");
});

test("legacy manifest records missing provenance without applying current strategy", () => {
  const manifest = normalizeCreationSetManifest({
    setId: "legacy",
    role: "ignored",
    items: [{ itemId: "old", slotIndex: 1, role: "hero", prompt: "old prompt", filename: "old.png" }],
  });

  assert.equal(manifest.platform, "universal");
  assert.equal(manifest.platformProvenance, "legacy-missing");
  assert.equal(manifest.strategyVersion, "");
  assert.equal(manifest.items[0].prompt, "old prompt");
});

test("legacy creation records recover the actual generation snapshot from image sidecars", async (t) => {
  const outputDir = await mkdtemp(join(tmpdir(), "creation-sidecar-recovery-"));
  const store = createCreationSetStore({ outputDir });
  const relativePath = "2026-07/07-15/2026-07-15-creation/record/item.png";
  const sidecarPath = join(outputDir, "json", "2026-07", "07-15", "2026-07-15-creation", "record", "item.json");
  t.after(() => rm(outputDir, { recursive: true, force: true }));

  await store.saveManifest({
    setId: "legacy-sidecar",
    items: [{ itemId: "item-1", slotIndex: 1, role: "hero", prompt: "planning prompt", relativePath }],
  });
  await mkdir(join(outputDir, "2026-07", "07-15", "2026-07-15-creation", "record"), { recursive: true });
  await writeFile(join(outputDir, ...relativePath.split("/")), "image", "utf8");
  await mkdir(join(outputDir, "json", "2026-07", "07-15", "2026-07-15-creation", "record"), { recursive: true });
  await writeFile(sidecarPath, `${JSON.stringify({
    prompt: "actual upstream prompt",
    baseUrl: "https://gateway.example/v1",
    imageRoute: "a",
    responsesModel: "gpt-5.4-mini",
    imageModel: "gpt-image-2",
    endpointPath: "/responses",
    referenceImageNames: ["front.png", "detail.png"],
    hasReferenceImage: true,
    ratio: "1:1",
    ratioLabel: "1:1 方形",
    size: "2048x2048",
    actualSize: "1254x1254",
    quality: "high",
    format: "png",
    reasoningEffort: "medium",
  }, null, 2)}\n`, "utf8");

  const manifest = await store.readManifest("legacy-sidecar");
  const item = manifest.items[0];
  assert.equal(item.prompt, "planning prompt");
  assert.equal(item.generationPrompt, "actual upstream prompt");
  assert.equal(item.requestedSize, "2048x2048");
  assert.equal(item.effectiveSize, "2048x2048");
  assert.equal(item.actualSize, "1254x1254");
  assert.equal(item.responsesModel, "gpt-5.4-mini");
  assert.deepEqual(item.referenceImageNames, ["front.png", "detail.png"]);
});

test("saving a legacy manifest does not rewrite platform strategy fields", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "creation-legacy-"));
  const store = createCreationSetStore({ outputDir });
  await store.saveManifest({ setId: "legacy-save", productName: "Old", items: [{ itemId: "old", role: "hero", prompt: "old" }] });
  const raw = JSON.parse(await readFile(join(outputDir, "json", "creation-sets", "legacy-save.json"), "utf8"));
  assert.equal(Object.hasOwn(raw, "strategyVersion"), false);
  assert.equal(Object.hasOwn(raw, "platformProvenance"), false);
});

test("repair preserves saved effective item parameters and prompt", () => {
  const creationSet = {
    setId: "repair-set",
    platform: "amazon",
    strategyVersion: "2026-07-11.1",
    effectivePlan: {
      platform: "amazon",
      strategyVersion: "2026-07-11.1",
      items: [{ itemId: "item-1", role: "hero", imageType: "amazon-main", prompt: "saved prompt", ratio: "1:1", effectiveSize: "2K", targetLanguage: "en", constraints: ["white background"] }],
      effectivePlan: { platform: "etsy", items: [{ itemId: "item-1", prompt: "unvalidated nested prompt" }] },
    },
    items: [{ itemId: "item-1", slotIndex: 1, role: "hero", imageType: "amazon-main", prompt: "saved prompt", ratio: "1:1", effectiveSize: "2K", targetLanguage: "en", constraints: ["white background"] }],
  };

  const plan = buildCreationRepairPlan(creationSet, { platform: "etsy", targetLanguage: "zh" });
  const refreshed = refreshCreationRepairItemsFromPlan(creationSet.items, plan);

  assert.equal(plan.platform, "amazon");
  assert.equal(Object.hasOwn(plan, "effectivePlan"), false);
  assert.equal(refreshed[0].prompt, "saved prompt");
  assert.equal(refreshed[0].imageType, "amazon-main");
  assert.equal(refreshed[0].effectiveSize, "2K");
  assert.equal(refreshed[0].targetLanguage, "en");
});
