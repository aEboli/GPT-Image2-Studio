import test from "node:test";
import assert from "node:assert/strict";
import { access, mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

import { Jimp } from "jimp";
import decodeWebp from "@jsquash/webp/decode.js";

import {
  buildGalleryThumbnailUrl,
  deleteGalleryThumbnail,
  ensureGalleryThumbnail,
  moveGalleryThumbnail,
  resolveGalleryImageAsset,
} from "../lib/gallery-thumbnail.mjs";
import {
  deleteGeneratedAsset,
  renameGalleryAssets,
  saveGeneratedAsset,
} from "../lib/gallery-store.mjs";

async function createValidPngBuffer({ width = 2, height = 2 } = {}) {
  const image = new Jimp({ width, height, color: 0xff0000ff });
  if (width > 1 && height > 0) image.setPixelColor(0x00ff00ff, 1, 0);
  if (width > 0 && height > 1) image.setPixelColor(0x0000ffff, 0, 1);
  if (width > 1 && height > 1) image.setPixelColor(0xffffffff, 1, 1);
  return image.getBuffer("image/png");
}

async function withTemporaryOutput(callback) {
  const rootDir = await mkdtemp(join(tmpdir(), "gallery-thumbnail-test-"));
  try {
    return await callback(join(rootDir, "output"));
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
}

async function writeValidPng(outputDir, relativeImagePath, dimensions) {
  const sourcePath = join(outputDir, ...relativeImagePath.split("/"));
  await mkdir(dirname(sourcePath), { recursive: true });
  await writeFile(sourcePath, await createValidPngBuffer(dimensions));
  return sourcePath;
}

async function pathExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

test("gallery thumbnail encodes a valid PNG as a WebP RIFF asset", async () => {
  await withTemporaryOutput(async (outputDir) => {
    const relativeImagePath = "2026-09/09-01/2026-09-01-prompt/source.png";
    await writeValidPng(outputDir, relativeImagePath);

    const asset = await ensureGalleryThumbnail({ outputDir, relativeImagePath });

    assert.ok(asset);
    assert.equal(asset.thumbnailRelativePath, `json/thumbnails/${relativeImagePath}.webp`);
    const thumbnail = await readFile(asset.thumbnailPath);
    assert.equal(thumbnail.subarray(0, 4).toString("ascii"), "RIFF");
    assert.equal(thumbnail.subarray(8, 12).toString("ascii"), "WEBP");
  });
});

test("gallery thumbnail bounds the longest edge at 512 pixels", async () => {
  await withTemporaryOutput(async (outputDir) => {
    const relativeImagePath = "2026-09/09-01/2026-09-01-prompt/large-source.png";
    await writeValidPng(outputDir, relativeImagePath, { width: 1024, height: 640 });

    const asset = await ensureGalleryThumbnail({ outputDir, relativeImagePath });
    assert.ok(asset);
    const thumbnail = await readFile(asset.thumbnailPath);
    const decoded = await decodeWebp(
      thumbnail.buffer.slice(thumbnail.byteOffset, thumbnail.byteOffset + thumbnail.byteLength),
    );

    assert.equal(decoded.width, 512);
    assert.equal(decoded.height, 320);
  });
});

test("gallery thumbnail rejects dangerous and non-image relative paths", async () => {
  await withTemporaryOutput(async (outputDir) => {
    const rejectedPaths = [
      "../outside.png",
      "nested/../../outside.png",
      "/absolute.png",
      "C:\\outside.png",
      "carrier:secret.png",
      "nested/image:stream.webp",
      "json/metadata.png",
      "nested/readme.txt",
      "nested/image.gif",
    ];

    for (const relativeImagePath of rejectedPaths) {
      assert.equal(resolveGalleryImageAsset({ outputDir, relativeImagePath }), null, relativeImagePath);
      assert.equal(buildGalleryThumbnailUrl(relativeImagePath, "2026-09-01T00:00:00.000Z"), "", relativeImagePath);
      assert.equal(await ensureGalleryThumbnail({ outputDir, relativeImagePath }), null, relativeImagePath);
      assert.equal(await deleteGalleryThumbnail({ outputDir, relativeImagePath }), false, relativeImagePath);
    }

    assert.equal(
      await moveGalleryThumbnail({
        outputDir,
        fromRelativeImagePath: "nested/source.png",
        toRelativeImagePath: "../outside.png",
      }),
      false,
    );
  });
});

test("gallery thumbnail follows gallery asset rename and deletion lifecycle", async () => {
  await withTemporaryOutput(async (outputDir) => {
    const indexPath = join(outputDir, ".gallery-index.json");
    const originalFilename = "asset_12345678-90ab-cdef-1234-567890abcdef.png";
    const saved = await saveGeneratedAsset({
      outputDir,
      indexPath,
      filename: originalFilename,
      imageBuffer: await createValidPngBuffer(),
      metadata: {
        prompt: "护肤礼盒主视觉",
        createdAt: "2026-04-26T15:42:33.000Z",
        format: "png",
      },
    });

    const originalThumbnail = await ensureGalleryThumbnail({
      outputDir,
      relativeImagePath: saved.relativePath,
    });
    assert.ok(originalThumbnail);
    await access(originalThumbnail.thumbnailPath);

    const renamed = await renameGalleryAssets({ outputDir, indexPath });
    assert.equal(renamed.renamedCount, 1);

    const renamedAsset = resolveGalleryImageAsset({
      outputDir,
      relativeImagePath: renamed.renamed[0].to,
    });
    assert.ok(renamedAsset);
    assert.equal(await pathExists(originalThumbnail.thumbnailPath), false);
    await access(renamedAsset.thumbnailPath);

    const deleted = await deleteGeneratedAsset({
      outputDir,
      indexPath,
      filename: basename(renamed.renamed[0].to),
    });

    assert.equal(deleted.filename, basename(renamed.renamed[0].to));
    assert.equal(await pathExists(renamedAsset.thumbnailPath), false);
  });
});
