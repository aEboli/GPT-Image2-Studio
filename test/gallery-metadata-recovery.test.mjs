import test from "node:test";
import assert from "node:assert/strict";

import {
  buildGalleryMetadataCacheEntry,
  collectGalleryMetadataRepairPatch,
  mergeGalleryItemWithCachedMetadata,
  pruneGalleryMetadataCache,
} from "../lib/gallery-metadata-recovery.mjs";

test("gallery metadata recovery stores only meaningful metadata fields in cache entries", () => {
  const entry = buildGalleryMetadataCacheEntry({
    filename: "sample.jpeg",
    prompt: "直播带货主视觉",
    imageRoute: "b",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    size: "1024x1536",
    quality: "high",
    format: "jpeg",
    reasoningEffort: "xhigh",
    referenceImageNames: [],
    referenceImageName: "",
    hasReferenceImage: false,
    baseUrl: "",
  });

  assert.deepEqual(entry, {
    prompt: "直播带货主视觉",
    imageRoute: "b",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    size: "1024x1536",
    quality: "high",
    format: "jpeg",
    reasoningEffort: "xhigh",
  });
});

test("gallery metadata recovery fills missing server fields from local cache without overriding non-empty values", () => {
  const serverItem = {
    filename: "sample.jpeg",
    prompt: "",
    responsesModel: "",
    imageModel: "",
    ratio: "",
    ratioLabel: "",
    size: "1024x1536",
    quality: "",
    format: "jpeg",
    reasoningEffort: "",
    referenceImageNames: [],
    referenceImageName: "",
    hasReferenceImage: false,
    baseUrl: "",
  };
  const cachedEntry = {
    prompt: "直播带货主视觉",
    imageRoute: "b",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    size: "1536x1024",
    quality: "high",
    reasoningEffort: "xhigh",
    referenceImageNames: ["reference-a.png"],
    referenceImageName: "reference-a.png",
    hasReferenceImage: true,
    baseUrl: "https://api.openai.com/v1",
  };

  const merged = mergeGalleryItemWithCachedMetadata(serverItem, cachedEntry);

  assert.equal(merged.prompt, "直播带货主视觉");
  assert.equal(merged.imageRoute, "b");
  assert.equal(merged.responsesModel, "gpt-5.4");
  assert.equal(merged.imageModel, "gpt-image-2");
  assert.equal(merged.ratio, "4:5");
  assert.equal(merged.ratioLabel, "标准 4:5");
  assert.equal(merged.size, "1024x1536");
  assert.equal(merged.quality, "high");
  assert.equal(merged.reasoningEffort, "xhigh");
  assert.equal(merged.referenceImageName, "reference-a.png");
  assert.deepEqual(merged.referenceImageNames, ["reference-a.png"]);
  assert.equal(merged.hasReferenceImage, true);
  assert.equal(merged.baseUrl, "https://api.openai.com/v1");
});

test("gallery metadata recovery only requests repair fields that are missing on the server item", () => {
  const serverItem = {
    filename: "sample.jpeg",
    prompt: "",
    responsesModel: "",
    imageModel: "",
    ratio: "",
    ratioLabel: "",
    size: "1024x1536",
    quality: "",
    format: "jpeg",
    reasoningEffort: "",
    referenceImageNames: [],
    referenceImageName: "",
    hasReferenceImage: false,
    baseUrl: "",
  };
  const mergedItem = {
    ...serverItem,
    prompt: "直播带货主视觉",
    imageRoute: "b",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    quality: "high",
    reasoningEffort: "xhigh",
    referenceImageNames: ["reference-a.png"],
    referenceImageName: "reference-a.png",
    hasReferenceImage: true,
    baseUrl: "https://api.openai.com/v1",
  };

  const patch = collectGalleryMetadataRepairPatch(serverItem, mergedItem);

  assert.deepEqual(patch, {
    prompt: "直播带货主视觉",
    imageRoute: "b",
    baseUrl: "https://api.openai.com/v1",
    responsesModel: "gpt-5.4",
    imageModel: "gpt-image-2",
    hasReferenceImage: true,
    referenceImageNames: ["reference-a.png"],
    referenceImageName: "reference-a.png",
    ratio: "4:5",
    ratioLabel: "标准 4:5",
    quality: "high",
    reasoningEffort: "xhigh",
  });
});

test("gallery metadata recovery prunes cache entries that no longer exist in the gallery", () => {
  const pruned = pruneGalleryMetadataCache(
    {
      "keep-a.jpeg": { prompt: "A" },
      "drop-b.jpeg": { prompt: "B" },
      "keep-c.jpeg": { prompt: "C" },
    },
    [{ filename: "keep-a.jpeg" }, { filename: "keep-c.jpeg" }],
  );

  assert.deepEqual(pruned, {
    "keep-a.jpeg": { prompt: "A" },
    "keep-c.jpeg": { prompt: "C" },
  });
});

test("gallery metadata recovery preserves portrait metadata", () => {
  const entry = buildGalleryMetadataCacheEntry({
    filename: "001-close-up.png",
    prompt: "portrait prompt",
    generationMode: "portrait",
    assetKind: "portrait-image",
    portraitSetId: "portrait-set-1",
    portraitItemId: "001-close-up",
    portraitStyle: "business-profile",
    portraitShotType: "close-up",
    subjectName: "Studio Model",
    subjectSummary: "Visible subject summary",
    selectedStyles: ["business-profile", "retro-film", "business-profile"],
  });

  assert.equal(entry.generationMode, "portrait");
  assert.equal(entry.assetKind, "portrait-image");
  assert.equal(entry.portraitSetId, "portrait-set-1");
  assert.equal(entry.portraitItemId, "001-close-up");
  assert.equal(entry.portraitStyle, "business-profile");
  assert.equal(entry.portraitShotType, "close-up");
  assert.equal(entry.subjectName, "Studio Model");
  assert.equal(entry.subjectSummary, "Visible subject summary");
  assert.deepEqual(entry.selectedStyles, ["business-profile", "retro-film"]);

  const patch = collectGalleryMetadataRepairPatch(
    {
      filename: "001-close-up.png",
      selectedStyles: [],
    },
    entry,
  );
  assert.deepEqual(patch.selectedStyles, ["business-profile", "retro-film"]);
});
