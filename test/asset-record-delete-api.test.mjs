import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, rm, stat, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

import { createArticleIllustrationSetStore } from "../lib/article-illustration-store.mjs";
import { createPortraitSetStore } from "../lib/portrait-store.mjs";
import { createPptDeckStore } from "../lib/ppt-deck-store.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function getFreePort() {
  const server = createTcpServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  await new Promise((resolveClose, reject) => server.close((error) => (error ? reject(error) : resolveClose())));
  return address.port;
}

async function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode) return;
  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    delay(1500).then(() => {
      if (server.exitCode === null && !server.signalCode) server.kill("SIGKILL");
    }),
  ]);
}

async function waitForServer(baseUrl, server) {
  const deadline = Date.now() + 7000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`server exited early (${server.exitCode})`);
    try {
      const response = await fetch(`${baseUrl}/api/config`);
      if (response.status < 500) return;
    } catch {}
    await delay(100);
  }
  throw new Error("server did not start");
}

async function pathExists(path) {
  try {
    await stat(path);
    return true;
  } catch (error) {
    if (error?.code === "ENOENT") return false;
    throw error;
  }
}

async function writeDedicatedAsset(outputDir, relativeDir, filename) {
  const assetDir = join(outputDir, ...relativeDir.split("/"));
  const metadataDir = join(outputDir, "json", ...relativeDir.split("/"));
  await Promise.all([mkdir(assetDir, { recursive: true }), mkdir(metadataDir, { recursive: true })]);
  await Promise.all([
    writeFile(join(assetDir, filename), "asset"),
    writeFile(join(metadataDir, `${filename}.json`), "{}\n"),
  ]);
  return { assetDir, metadataDir };
}

async function postJson(baseUrl, path, body) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  return { response, payload: await response.json() };
}

test("local asset deletion APIs support batches, legacy Gallery input, and storage failures", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "asset-record-delete-api-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  await mkdir(outputDir, { recursive: true });

  const articleStore = createArticleIllustrationSetStore({ outputDir, publicBasePath: "/output" });
  const portraitStore = createPortraitSetStore({ outputDir, publicBasePath: "/output" });
  const pptStore = createPptDeckStore({ outputDir, publicBasePath: "/output" });
  const articleRelativeDir = "2026-07/07-22/2026-07-22-article/api-article";
  const portraitRelativeDir = "2026-07/07-22/2026-07-22-portrait/api-portrait";
  const pptRelativeDir = "2026-07/07-22/2026-07-22-ppt/api-deck";
  const articleAssets = await writeDedicatedAsset(outputDir, articleRelativeDir, "article.png");
  const portraitAssets = await writeDedicatedAsset(outputDir, portraitRelativeDir, "portrait.png");
  const pptAssets = await writeDedicatedAsset(outputDir, pptRelativeDir, "slide.png");
  await Promise.all([
    articleStore.saveManifest({ setId: "article-delete", title: "Article", relativeDir: articleRelativeDir, items: [] }),
    portraitStore.saveManifest({ setId: "portrait-delete", subjectName: "Portrait", relativeDir: portraitRelativeDir, items: [] }),
    pptStore.saveManifest({
      deckId: "ppt-delete",
      title: "Deck",
      pptxRelativePath: `${pptRelativeDir}/deck.pptx`,
      slides: [{ slideNumber: 1, relativePath: `${pptRelativeDir}/slide.png` }],
    }),
    writeFile(join(pptAssets.assetDir, "deck.pptx"), "pptx"),
    writeFile(join(outputDir, "gallery-batch.png"), "image"),
    writeFile(join(outputDir, "gallery-legacy.png"), "image"),
  ]);
  await mkdir(articleStore.manifestsDir, { recursive: true });
  await writeFile(articleStore.manifestPath("article-corrupt"), "{not-json\n");

  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });
  await waitForServer(baseUrl, server);

  const invalid = await postJson(baseUrl, "/api/portrait/sets/delete", { setIds: [] });
  assert.equal(invalid.response.status, 400);

  const gallery = await postJson(baseUrl, "/api/output/delete", {
    filenames: ["gallery-batch.png", "gallery-batch.png", "gallery-missing.png"],
  });
  assert.equal(gallery.response.status, 200, JSON.stringify(gallery.payload));
  assert.deepEqual(gallery.payload.deletedFilenames, ["gallery-batch.png"]);
  assert.deepEqual(gallery.payload.notFoundFilenames, ["gallery-missing.png"]);
  assert.equal(await pathExists(join(outputDir, "gallery-batch.png")), false);

  const legacyGallery = await postJson(baseUrl, "/api/output/delete", { filename: "gallery-legacy.png" });
  assert.equal(legacyGallery.response.status, 200, JSON.stringify(legacyGallery.payload));
  assert.equal(legacyGallery.payload.filename, "gallery-legacy.png");
  assert.deepEqual(legacyGallery.payload.deletedFilenames, ["gallery-legacy.png"]);

  const article = await postJson(baseUrl, "/api/article-illustration/sets/delete", {
    setIds: ["article-delete", "article-delete", "article-missing"],
  });
  assert.equal(article.response.status, 200, JSON.stringify(article.payload));
  assert.deepEqual(article.payload.deletedSetIds, ["article-delete"]);
  assert.deepEqual(article.payload.notFoundSetIds, ["article-missing"]);
  assert.equal(await pathExists(articleAssets.assetDir), false);
  assert.equal(await pathExists(articleAssets.metadataDir), false);

  const portrait = await postJson(baseUrl, "/api/portrait/sets/delete", {
    setIds: ["portrait-delete", "portrait-missing"],
  });
  assert.equal(portrait.response.status, 200, JSON.stringify(portrait.payload));
  assert.deepEqual(portrait.payload.deletedSetIds, ["portrait-delete"]);
  assert.deepEqual(portrait.payload.notFoundSetIds, ["portrait-missing"]);
  assert.equal(await pathExists(portraitAssets.assetDir), false);
  assert.equal(await pathExists(portraitAssets.metadataDir), false);

  const ppt = await postJson(baseUrl, "/api/ppt/decks/delete", {
    recordKeys: ["ppt-delete", "ppt-missing"],
  });
  assert.equal(ppt.response.status, 200, JSON.stringify(ppt.payload));
  assert.deepEqual(ppt.payload.deletedRecordKeys, ["ppt-delete"]);
  assert.deepEqual(ppt.payload.notFoundRecordKeys, ["ppt-missing"]);
  assert.equal(await pathExists(pptAssets.assetDir), false);
  assert.equal(await pathExists(pptAssets.metadataDir), false);

  const corrupt = await postJson(baseUrl, "/api/article-illustration/sets/delete", { setIds: ["article-corrupt"] });
  assert.equal(corrupt.response.status, 500);
});
