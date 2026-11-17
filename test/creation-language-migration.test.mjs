import assert from "node:assert/strict";
import test from "node:test";
import { mkdir, mkdtemp, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { migrateCreationLanguageNames } from "../scripts/migrate-creation-language-names.mjs";

async function fixture(t, status = "completed") {
  const root = await mkdtemp(join(tmpdir(), "creation-language-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = join(root, "output");
  const from = "2026-11/11-17/2026-11-17-creation/1241-手套-original";
  const to = `${from}-葡萄牙语`;
  const write = async (path, value) => { await mkdir(dirname(path), { recursive: true }); await writeFile(path, value); };
  const manifestPath = join(outputDir, "json/creation-sets/set.json");
  const manifest = { setId: "set", productName: "手套", targetLanguage: "pt", targetLanguageLabel: "Portuguese", createdAt: "2026-11-17T04:41:00Z", status, relativeDir: from,
    items: [{ status: "completed", relativePath: `${from}/image.png`, imageUrl: `/output/${encodeURI(from)}/image.png?v=123`, thumbnailUrl: `/api/gallery/thumbnail?path=${encodeURIComponent(`${from}/image.png`)}&v=123` }],
    listingDrafts: [{ image: `/output/${from}/image.png`, other: `${from}-other/image.png` }],
  };
  const raw = JSON.stringify(manifest, null, 2);
  await write(manifestPath, raw);
  await write(join(outputDir, from, "image.png"), "original-image-bytes");
  await write(join(outputDir, "json", from, "image.json"), JSON.stringify({ relativePath: `${from}/image.png`, imageUrl: `/output/${encodeURI(from)}/image.png` }));
  await write(join(outputDir, "json/thumbnails", from, "image.png.webp"), "thumbnail-bytes");
  const older = JSON.stringify({ setId: "older", createdAt: "2026-11-16T04:41:00Z", relativeDir: "2026-11/11-16/old", targetLanguage: "de" });
  await write(join(outputDir, "json/creation-sets/older.json"), older);
  const indexPath = join(root, ".local/gallery-index.json");
  await write(indexPath, JSON.stringify({ "image.png": { relativePath: `${from}/image.png` }, other: { relativePath: "keep/image.png" } }));
  return { root, outputDir, from, to, manifestPath, manifest, raw, older, indexPath, backupDir: join(root, "backup"), date: "2026-11-17" };
}

test("迁移默认只预览，不改动文件", async (t) => {
  const input = await fixture(t);
  const result = await migrateCreationLanguageNames(input);
  assert.equal(result.count, 1);
  assert.equal(await readFile(input.manifestPath, "utf8"), input.raw);
  assert.equal(await readFile(join(input.outputDir, input.from, "image.png"), "utf8"), "original-image-bytes");
});

test("迁移同步目录、原始及编码 URL、缩略图、索引，保留备份并可重复执行", async (t) => {
  const input = await fixture(t);
  const result = await migrateCreationLanguageNames({ ...input, apply: true });
  assert.equal(result.count, 1);
  assert.equal(result.verifiedFiles, 2);
  const updated = JSON.parse(await readFile(input.manifestPath, "utf8"));
  assert.equal(updated.relativeDir, input.to);
  assert.equal(updated.items[0].relativePath, `${input.to}/image.png`);
  assert.equal(updated.items[0].imageUrl, `/output/${encodeURI(input.to)}/image.png?v=123`);
  assert.equal(updated.items[0].thumbnailUrl, `/api/gallery/thumbnail?path=${encodeURIComponent(`${input.to}/image.png`)}&v=123`);
  assert.equal(updated.listingDrafts[0].other, `${input.from}-other/image.png`);
  assert.equal(await readFile(join(input.outputDir, input.to, "image.png"), "utf8"), "original-image-bytes");
  assert.equal(await readFile(join(input.outputDir, "json/thumbnails", input.to, "image.png.webp"), "utf8"), "thumbnail-bytes");
  assert.equal(JSON.parse(await readFile(join(input.outputDir, "json", input.to, "image.json"), "utf8")).relativePath, `${input.to}/image.png`);
  assert.equal(JSON.parse(await readFile(input.indexPath, "utf8"))["image.png"].relativePath, `${input.to}/image.png`);
  assert.equal(await readFile(join(input.outputDir, "json/creation-sets/older.json"), "utf8"), input.older);
  assert.equal(await readFile(join(input.backupDir, "0.json"), "utf8"), input.raw);
  await assert.rejects(readdir(join(input.outputDir, input.from)), { code: "ENOENT" });
  assert.equal((await migrateCreationLanguageNames({ ...input, apply: true })).count, 0);
});

test("执行中套图、冲突目录和越界路径均在写入前拒绝", async (t) => {
  const input = await fixture(t, "generating");
  assert.deepEqual((await migrateCreationLanguageNames(input)).busy, ["set"]);
  await assert.rejects(migrateCreationLanguageNames({ ...input, apply: true }), /等待执行中/);
  input.manifest.status = "completed";
  await writeFile(input.manifestPath, JSON.stringify(input.manifest));
  await mkdir(join(input.outputDir, input.to));
  await assert.rejects(migrateCreationLanguageNames({ ...input, apply: true }), /目标目录已存在/);
  input.manifest.relativeDir = `${input.from}/../../outside`;
  await writeFile(input.manifestPath, JSON.stringify(input.manifest));
  await assert.rejects(migrateCreationLanguageNames({ ...input, apply: true }), /目录超出指定日期/);
});
