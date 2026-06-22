import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdtemp, mkdir, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  createTimestampedFilename,
  deleteGeneratedAsset,
  listGalleryItems,
  repairGeneratedAssetMetadata,
  renameGalleryAssets,
  saveGeneratedAsset,
} from "../lib/gallery-store.mjs";

test("gallery store creates readable filenames from time keyword and id tail", () => {
  const filename = createTimestampedFilename({
    format: "jpeg",
    prompt: "生成一张护肤礼盒直播带货主视觉，商业摄影风格",
    createdAt: "2026-04-26T15:42:33",
    idSource: "task-demo-a1b2c3d4",
  });

  assert.equal(filename, "1542-护肤礼盒-c3d4.jpeg");
});

test("gallery store falls back to a compact generic keyword when prompt is not filename-friendly", () => {
  const filename = createTimestampedFilename({
    format: "png",
    prompt: "   !!!   ",
    createdAt: "2026-04-26T09:08:07",
    idSource: "job-xyz9",
  });

  assert.equal(filename, "0908-未命名-xyz9.png");
});

test("gallery store can create hour-minute prefixed filenames from explicit keywords", () => {
  const filename = createTimestampedFilename({
    format: "png",
    prompt: "Quick Blend pair 2",
    createdAt: "2026-04-26T15:42:33",
    idSource: "task-demo-a1b2c3d4",
    filenameKeyword: "a-dress-b-shoe",
    omitDatePrefix: true,
  });

  assert.equal(filename, "1542-a-dress-b-shoe-c3d4.png");
});

test("gallery store prefixes the prompt image folder with the image date", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-date-prefix-"));
  const outputDir = join(rootDir, "output");

  const saved = await saveGeneratedAsset({
    outputDir,
    filename: "demo.png",
    imageBuffer: Buffer.from("demo-image"),
    metadata: {
      prompt: "demo prompt",
      createdAt: "2026-04-22T12:00:00.000Z",
      format: "png",
    },
  });

  assert.equal(saved.relativePath, "2026-04/04-22/2026-04-22-prompt/demo.png");
  await access(join(outputDir, "2026-04", "04-22", "2026-04-22-prompt", "demo.png"));
  await access(join(outputDir, "json", "2026-04", "04-22", "2026-04-22-prompt", "demo.json"));
});

test("gallery store separates default image folders by generation mode", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-mode-folders-"));
  const outputDir = join(rootDir, "output");
  const modes = [
    ["prompt.png", {}, "2026-04/04-22/2026-04-22-prompt/prompt.png"],
    ["style.png", { generationMode: "style-transfer" }, "2026-04/04-22/2026-04-22-style-transfer/style.png"],
    [
      "reference.png",
      { generationMode: "reference-analysis" },
      "2026-04/04-22/2026-04-22-reference-analysis/reference.png",
    ],
    [
      "decomposition.png",
      { generationMode: "image-decomposition", assetKind: "image-decomposition" },
      "2026-04/04-22/2026-04-22-image-decomposition/decomposition.png",
    ],
  ];

  for (const [filename, metadata, expectedRelativePath] of modes) {
    const saved = await saveGeneratedAsset({
      outputDir,
      filename,
      imageBuffer: Buffer.from(filename),
      metadata: {
        prompt: filename,
        createdAt: "2026-04-22T12:00:00.000Z",
        format: "png",
        ...metadata,
      },
    });

    assert.equal(saved.relativePath, expectedRelativePath);
  }
});

test("gallery store preserves every index entry during concurrent saves", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-concurrent-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");
  const filenames = Array.from({ length: 8 }, (_value, index) => `concurrent-${index + 1}.png`);

  await Promise.all(
    filenames.map((filename, index) =>
      saveGeneratedAsset({
        outputDir,
        indexPath,
        filename,
        imageBuffer: Buffer.from(filename),
        metadata: {
          prompt: filename,
          createdAt: `2026-04-22T12:00:0${index}.000Z`,
          format: "png",
        },
      }),
    ),
  );

  const indexPayload = JSON.parse(await readFile(indexPath, "utf8"));
  assert.deepEqual(Object.keys(indexPayload).sort(), filenames.sort());
});

test("gallery store preserves every index entry during concurrent saves", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-concurrent-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");
  const filenames = Array.from({ length: 8 }, (_value, index) => `concurrent-${index + 1}.png`);

  await Promise.all(
    filenames.map((filename, index) =>
      saveGeneratedAsset({
        outputDir,
        indexPath,
        filename,
        imageBuffer: Buffer.from(filename),
        metadata: {
          prompt: filename,
          createdAt: `2026-04-22T12:00:0${index}.000Z`,
          format: "png",
        },
      }),
    ),
  );

  const indexPayload = JSON.parse(await readFile(indexPath, "utf8"));
  assert.deepEqual(Object.keys(indexPayload).sort(), filenames.sort());
});

test("gallery store can save PPT slide images inside a named PPT deck folder", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-ppt-folder-"));
  const outputDir = join(rootDir, "output");

  const saved = await saveGeneratedAsset({
    outputDir,
    relativeDir: "2026-04/04-22/2026-04-22-ppt/浜у搧鍙戝竷-a1b2c3d4",
    filename: "slide-1.png",
    imageBuffer: Buffer.from("slide-image"),
    metadata: {
      prompt: "slide prompt",
      createdAt: "2026-04-22T12:00:00.000Z",
      assetKind: "ppt-slide",
      deckId: "ppt-deck-a1b2c3d4",
      slideNumber: "1",
      galleryVisible: false,
      format: "png",
    },
  });

  assert.equal(saved.relativePath, "2026-04/04-22/2026-04-22-ppt/浜у搧鍙戝竷-a1b2c3d4/slide-1.png");
  await access(join(outputDir, "2026-04", "04-22", "2026-04-22-ppt", "浜у搧鍙戝竷-a1b2c3d4", "slide-1.png"));
  await access(join(outputDir, "json", "2026-04", "04-22", "2026-04-22-ppt", "浜у搧鍙戝竷-a1b2c3d4", "slide-1.json"));
});

test("gallery store writes images into dated folders and persists searchable metadata", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");
  const metadataDir = join(outputDir, "json", "2026-04", "04-22", "2026-04-22-prompt");
  await mkdir(outputDir, { recursive: true });

  await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "older.jpeg",
    imageBuffer: Buffer.from("older-image"),
    metadata: {
      prompt: "older prompt",
      createdAt: "2026-04-22T10:00:00.000Z",
      baseUrl: "https://api.openai.com/v1",
      imageRoute: "b",
      responsesModel: "gpt-5.4",
      imageModel: "gpt-image-2",
      size: "1024x1536",
      quality: "high",
      format: "jpeg",
      hasReferenceImage: false,
      ratio: "4:5",
      ratioLabel: "鏍囧噯 4:5",
      reasoningEffort: "high",
    },
  });

  const saved = await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "newer.png",
    imageBuffer: Buffer.from("newer-image"),
    metadata: {
      prompt: "newer prompt",
      createdAt: "2026-04-22T12:00:00.000Z",
      baseUrl: "https://api.openai.com/v1",
      imageRoute: "b",
      responsesModel: "gpt-5.4",
      imageModel: "gpt-image-2",
      size: "1536x1024",
      quality: "medium",
      format: "png",
      hasReferenceImage: true,
      referenceImageNames: ["reference-a.png", "reference-b.png"],
      referenceImageName: "reference-a.png",
      ratio: "16:9",
      ratioLabel: "瀹藉睆 16:9",
      reasoningEffort: "medium",
      generationStartedAt: "2026-04-22T11:59:55.000Z",
      generationCompletedAt: "2026-04-22T12:00:02.345Z",
      generationDurationMs: 7345,
    },
  });

  await utimes(
    join(outputDir, "2026-04", "04-22", "2026-04-22-prompt", "older.jpeg"),
    new Date("2026-04-22T10:00:00.000Z"),
    new Date("2026-04-22T10:00:00.000Z"),
  );
  await utimes(
    join(outputDir, "2026-04", "04-22", "2026-04-22-prompt", "newer.png"),
    new Date("2026-04-22T12:00:00.000Z"),
    new Date("2026-04-22T12:00:00.000Z"),
  );

  const items = await listGalleryItems({
    outputDir,
    indexPath,
    publicBasePath: "/output",
  });
  const indexPayload = JSON.parse(await readFile(indexPath, "utf8"));
  const outputEntries = await readdir(outputDir, { withFileTypes: true });
  const monthEntries = await readdir(join(outputDir, "2026-04"));
  const datedEntries = await readdir(join(outputDir, "2026-04", "04-22"));
  const imageEntries = await readdir(join(outputDir, "2026-04", "04-22", "2026-04-22-prompt"));
  const metadataEntries = await readdir(metadataDir);
  const newerMetadata = JSON.parse(await readFile(join(metadataDir, "newer.json"), "utf8"));

  assert.equal(saved.filename, "newer.png");
  assert.equal(saved.relativePath, "2026-04/04-22/2026-04-22-prompt/newer.png");
  await access(indexPath);
  assert.deepEqual(outputEntries.map((entry) => entry.name).sort(), ["2026-04", "json"]);
  assert.equal(outputEntries[0].isDirectory(), true);
  assert.deepEqual(monthEntries.sort(), ["04-22"]);
  assert.deepEqual(datedEntries.sort(), ["2026-04-22-prompt"]);
  assert.deepEqual(imageEntries.sort(), ["newer.png", "older.jpeg"]);
  assert.deepEqual(metadataEntries.sort(), ["newer.json", "older.json"]);
  assert.deepEqual(Object.keys(indexPayload).sort(), ["newer.png", "older.jpeg"]);
  assert.equal(newerMetadata.prompt, "newer prompt");
  assert.equal(newerMetadata.imageRoute, "b");
  assert.equal(newerMetadata.size, "1536x1024");
  assert.equal(newerMetadata.referenceImageName, "reference-a.png");
  assert.equal(newerMetadata.generationDurationMs, "7345");
  assert.equal(items.length, 2);
  assert.equal(items[0].filename, "newer.png");
  assert.equal(items[0].prompt, "newer prompt");
  assert.match(items[0].thumbnailUrl, /^\/output\/2026-04\/04-22\/2026-04-22-prompt\/newer\.png\?/);
  assert.equal(items[0].hasReferenceImage, true);
  assert.deepEqual(items[0].referenceImageNames, ["reference-a.png", "reference-b.png"]);
  assert.equal(items[0].absolutePath, join(outputDir, "2026-04", "04-22", "2026-04-22-prompt", "newer.png"));
  assert.equal(items[0].imageUrl, items[0].thumbnailUrl);
  assert.equal(items[0].baseUrl, "https://api.openai.com/v1");
  assert.equal(items[0].imageRoute, "b");
  assert.equal(items[0].responsesModel, "gpt-5.4");
  assert.equal(items[0].imageModel, "gpt-image-2");
  assert.equal(items[0].quality, "medium");
  assert.equal(items[0].ratio, "16:9");
  assert.equal(items[0].ratioLabel, "瀹藉睆 16:9");
  assert.equal(items[0].referenceImageName, "reference-a.png");
  assert.equal(items[0].reasoningEffort, "medium");
  assert.equal(items[0].generationDurationMs, "7345");
  assert.equal(items[0].generationStartedAt, "2026-04-22T11:59:55.000Z");
  assert.equal(items[0].generationCompletedAt, "2026-04-22T12:00:02.345Z");
  assert.equal(items[0].size, "1536x1024");
  assert.equal(items[1].filename, "older.jpeg");
});

test("gallery store deletes the image file and removes the indexed metadata entry", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");
  const metadataPath = join(outputDir, "json", "2026-04", "04-22", "2026-04-22-prompt", "deletable.json");

  await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "deletable.jpeg",
    imageBuffer: Buffer.from("image"),
    metadata: {
      prompt: "delete me",
      createdAt: "2026-04-22T12:30:00.000Z",
      format: "jpeg",
    },
  });

  const deleted = await deleteGeneratedAsset({
    outputDir,
    indexPath,
    filename: "deletable.jpeg",
  });

  const items = await listGalleryItems({
    outputDir,
    indexPath,
  });

  assert.equal(deleted.filename, "deletable.jpeg");
  await assert.rejects(access(join(outputDir, "2026-04", "04-22", "2026-04-22-prompt", "deletable.jpeg")));
  await assert.rejects(access(metadataPath));
  await assert.rejects(access(indexPath));
  assert.equal(items.length, 0);
});

test("gallery store restores metadata from json sidecars when the index file is missing", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");

  await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "rehydrated.jpeg",
    imageBuffer: Buffer.from("image"),
    metadata: {
      prompt: "persist me",
      createdAt: "2026-04-24T09:30:00.000Z",
      baseUrl: "https://api.openai.com/v1",
      imageRoute: "b",
      responsesModel: "gpt-5.4",
      imageModel: "gpt-image-2",
      size: "1024x1536",
      quality: "high",
      format: "jpeg",
      referenceImageNames: ["reference-a.png"],
      referenceImageName: "reference-a.png",
      ratio: "4:5",
      ratioLabel: "鏍囧噯 4:5",
      reasoningEffort: "medium",
    },
  });

  await rm(indexPath, { force: true });

  const items = await listGalleryItems({
    outputDir,
    indexPath,
    publicBasePath: "/output",
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].filename, "rehydrated.jpeg");
  assert.equal(items[0].prompt, "persist me");
  assert.equal(items[0].size, "1024x1536");
  assert.equal(items[0].referenceImageName, "reference-a.png");
  assert.equal(items[0].imageRoute, "b");
  assert.equal(items[0].responsesModel, "gpt-5.4");
});

test("gallery store lists dated output images even when both index and sidecar metadata are missing", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");

  await mkdir(join(outputDir, "2026-04", "04-27", "image"), { recursive: true });
  await writeFile(join(outputDir, "2026-04", "04-27", "image", "recovered.png"), Buffer.from("recovered-image"));

  const items = await listGalleryItems({
    outputDir,
    indexPath,
    publicBasePath: "/output",
  });

  assert.equal(items.length, 1);
  assert.equal(items[0].filename, "recovered.png");
  assert.equal(items[0].relativePath, "2026-04/04-27/image/recovered.png");
  assert.match(items[0].imageUrl, /^\/output\/2026-04\/04-27\/image\/recovered\.png\?/);
});

test("gallery store deletes orphaned dated output images without relying on index metadata", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");
  const targetPath = join(outputDir, "2026-04", "04-27", "image", "orphan.png");

  await mkdir(join(outputDir, "2026-04", "04-27", "image"), { recursive: true });
  await writeFile(targetPath, Buffer.from("orphan-image"));

  const deleted = await deleteGeneratedAsset({
    outputDir,
    indexPath,
    filename: "orphan.png",
  });

  assert.equal(deleted.filename, "orphan.png");
  await assert.rejects(access(targetPath));
});

test("gallery store batch renames historical images and sidecars together", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");

  await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "asset_12345678-90ab-cdef-1234-567890abcdef.png",
    imageBuffer: Buffer.from("image"),
    metadata: {
      prompt: "生成一张护肤礼盒直播带货主视觉",
      createdAt: "2026-04-26T15:42:33",
      format: "png",
      size: "1024x1536",
    },
  });

  const result = await renameGalleryAssets({
    outputDir,
    indexPath,
  });

  const items = await listGalleryItems({
    outputDir,
    indexPath,
    publicBasePath: "/output",
  });
  const renamedFilename = "1542-护肤礼盒-cdef.png";
  const dateDir = join(outputDir, "2026-04", "04-26", "2026-04-26-prompt");
  const jsonDir = join(outputDir, "json", "2026-04", "04-26", "2026-04-26-prompt");
  const indexPayload = JSON.parse(await readFile(indexPath, "utf8"));

  assert.equal(result.renamedCount, 1);
  await access(join(dateDir, renamedFilename));
  await access(join(jsonDir, "1542-护肤礼盒-cdef.json"));
  await assert.rejects(access(join(dateDir, "asset_12345678-90ab-cdef-1234-567890abcdef.png")));
  assert.deepEqual(Object.keys(indexPayload), [renamedFilename]);
  assert.equal(items[0].filename, renamedFilename);
});

test("gallery store batch rename preserves unified hour-minute prefixed filenames", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-quick-blend-name-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");
  const filename = "1542-a-dress-b-shoe-c3d4.png";

  await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename,
    imageBuffer: Buffer.from("image"),
    metadata: {
      prompt: "Quick Blend pair 2",
      createdAt: "2026-04-26T15:42:33",
      format: "png",
      generationMode: "quick-blend",
      assetKind: "quick-blend",
    },
  });

  const result = await renameGalleryAssets({
    outputDir,
    indexPath,
  });
  const items = await listGalleryItems({
    outputDir,
    indexPath,
    publicBasePath: "/output",
  });

  assert.equal(result.renamedCount, 0);
  assert.equal(items[0].filename, filename);
});

test("gallery store backfills size metadata from image headers when index metadata is missing", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
    "base64",
  );

  await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "size-from-header.png",
    imageBuffer: tinyPng,
    metadata: {
      createdAt: "2026-04-23T10:30:00.000Z",
      format: "png",
    },
  });

  const items = await listGalleryItems({
    outputDir,
    indexPath,
    publicBasePath: "/output",
  });
  const indexPayload = JSON.parse(await readFile(indexPath, "utf8"));

  assert.equal(items.length, 1);
  assert.equal(items[0].size, "1x1");
  assert.equal(indexPayload["size-from-header.png"].size, "1x1");
});

test("gallery store preserves requested size and records actual image dimensions", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");
  const tinyPng = Buffer.from(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
    "base64",
  );

  const saved = await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "requested-vs-actual.png",
    imageBuffer: tinyPng,
    metadata: {
      createdAt: "2026-04-23T10:30:00.000Z",
      size: "1024x1536",
      format: "png",
    },
  });

  const items = await listGalleryItems({
    outputDir,
    indexPath,
    publicBasePath: "/output",
  });
  const indexPayload = JSON.parse(await readFile(indexPath, "utf8"));

  assert.equal(saved.metadata.actualSize, "1x1");
  assert.equal(items[0].size, "1024x1536");
  assert.equal(items[0].actualSize, "1x1");
  assert.equal(indexPayload["requested-vs-actual.png"].size, "1024x1536");
  assert.equal(indexPayload["requested-vs-actual.png"].actualSize, "1x1");
});

test("gallery store persists sparse sidecar metadata without freezing empty placeholder fields", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");

  const saved = await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "sparse-sidecar.jpeg",
    imageBuffer: Buffer.from("image"),
    metadata: {
      createdAt: "2026-04-26T08:20:00.000Z",
      format: "jpeg",
      size: "1024x1536",
    },
  });

  const metadataPath = join(outputDir, "json", "2026-04", "04-26", "2026-04-26-prompt", "sparse-sidecar.json");
  const sidecarPayload = JSON.parse(await readFile(metadataPath, "utf8"));
  const indexPayload = JSON.parse(await readFile(indexPath, "utf8"));

  assert.equal(saved.filename, "sparse-sidecar.jpeg");
  assert.equal(sidecarPayload.createdAt, "2026-04-26T08:20:00.000Z");
  assert.equal(sidecarPayload.size, "1024x1536");
  assert.equal(sidecarPayload.format, "jpeg");
  assert.equal("prompt" in sidecarPayload, false);
  assert.equal("responsesModel" in sidecarPayload, false);
  assert.equal("ratio" in sidecarPayload, false);
  assert.equal("prompt" in indexPayload["sparse-sidecar.jpeg"], false);
});

test("gallery store repairs sparse metadata from a richer client-side payload", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "responses-gallery-"));
  const outputDir = join(rootDir, "output");
  const indexPath = join(rootDir, ".local", "gallery-index.json");

  await saveGeneratedAsset({
    outputDir,
    indexPath,
    filename: "repairable.jpeg",
    imageBuffer: Buffer.from("image"),
    metadata: {
      createdAt: "2026-04-26T09:30:00.000Z",
      format: "jpeg",
      size: "1024x1536",
    },
  });

  await repairGeneratedAssetMetadata({
    outputDir,
    indexPath,
    filename: "repairable.jpeg",
    metadata: {
      prompt: "鐩存挱闂存姢鑲ょぜ鐩掍富瑙嗚",
      baseUrl: "https://api.openai.com/v1",
      responsesModel: "gpt-5.4",
      imageModel: "gpt-image-2",
      ratio: "4:5",
      ratioLabel: "鏍囧噯 4:5",
      quality: "high",
      reasoningEffort: "xhigh",
      referenceImageNames: ["reference-a.png"],
      referenceImageName: "reference-a.png",
      hasReferenceImage: true,
    },
  });

  const items = await listGalleryItems({
    outputDir,
    indexPath,
    publicBasePath: "/output",
  });
  const metadataPath = join(outputDir, "json", "2026-04", "04-26", "2026-04-26-prompt", "repairable.json");
  const sidecarPayload = JSON.parse(await readFile(metadataPath, "utf8"));
  const indexPayload = JSON.parse(await readFile(indexPath, "utf8"));

  assert.equal(items.length, 1);
  assert.equal(items[0].prompt, "鐩存挱闂存姢鑲ょぜ鐩掍富瑙嗚");
  assert.equal(items[0].responsesModel, "gpt-5.4");
  assert.equal(items[0].referenceImageName, "reference-a.png");
  assert.equal(sidecarPayload.prompt, "鐩存挱闂存姢鑲ょぜ鐩掍富瑙嗚");
  assert.equal(sidecarPayload.responsesModel, "gpt-5.4");
  assert.equal(sidecarPayload.referenceImageName, "reference-a.png");
  assert.deepEqual(sidecarPayload.referenceImageNames, ["reference-a.png"]);
  assert.equal(indexPayload["repairable.jpeg"].prompt, "鐩存挱闂存姢鑲ょぜ鐩掍富瑙嗚");
});
