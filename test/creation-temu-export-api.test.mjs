import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cp, mkdir, mkdtemp, readFile, rm, symlink, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import ExcelJS from "exceljs";

import { TEMU_EXPORT_LIMITS } from "../lib/creation-temu-export.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CLOUDINARY_STUB_URL = pathToFileURL(
  join(rootDir, "test", "fixtures", "temu-cloudinary-fetch-stub.mjs"),
).href;
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
]);
const CONCURRENT_EXPORT_MUTATION = Object.freeze({
  productName: "并发修改后的商品",
  listingTitle: "Concurrent business edit",
  listingZhTitle: "并发修改后的商品标题",
  updatedAt: "2026-08-03T03:05:00.000Z",
});

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
  const deadline = Date.now() + 10_000;
  while (Date.now() < deadline) {
    if (server.exitCode !== null) throw new Error(`server exited early (${server.exitCode})`);
    try {
      const response = await fetch(`${baseUrl}/api/creation/sets`);
      if (response.status < 500) return;
    } catch {}
    await delay(100);
  }
  throw new Error("server did not start");
}

async function writeManifest(outputDir, manifest, filename = `${manifest.setId}.json`) {
  const manifestDir = join(outputDir, "json", "creation-sets");
  await mkdir(manifestDir, { recursive: true });
  await writeFile(join(manifestDir, filename), `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function productManifest() {
  const cloudinary = (name) => `https://res.cloudinary.com/demo-cloud/image/upload/v1/${name}.png`;
  return {
    setId: "set-export-a",
    productName: "羊毛毡刺绣小马挂件",
    createdAt: "2026-08-03T00:00:00.000Z",
    status: "completed",
    listingDrafts: [{
      title: "Embroidered Horse Charm",
      description: "A decorative felt charm.",
      packageDimensions: "20 x 15 x 8 cm",
      packageWeight: "350 g",
      zhDisplay: { title: "羊毛毡刺绣小马挂件" },
    }],
    skuSubjects: [
      { id: "horse-white", title: "白色挂绳款" },
      { id: "horse-brown", title: "棕色皮绳款" },
    ],
    items: [
      { itemId: "hero", slotIndex: 1, role: "hero", status: "completed", imageUrl: cloudinary("hero") },
      { itemId: "sku-white", slotIndex: 2, role: "sku", status: "completed", imageUrl: cloudinary("white"), skuSubject: { id: "horse-white" } },
      { itemId: "sku-brown", slotIndex: 3, role: "sku", status: "completed", imageUrl: cloudinary("brown"), skuSubject: { id: "horse-brown" } },
    ],
  };
}

function strictReadyManifest(setId = "set-strict-ready") {
  const manifest = productManifest();
  const publicImage = (name) => `https://1.1.1.1/${name}.png`;
  return {
    ...manifest,
    setId,
    updatedAt: "2026-08-03T01:00:00.000Z",
    items: [
      { itemId: "hero", slotIndex: 1, role: "hero", status: "completed", imageUrl: publicImage("hero") },
      {
        itemId: "sku-white",
        slotIndex: 2,
        role: "sku",
        status: "completed",
        imageUrl: publicImage("white"),
        skuSubject: { id: "horse-white" },
      },
      {
        itemId: "sku-brown",
        slotIndex: 3,
        role: "sku",
        status: "completed",
        imageUrl: publicImage("brown"),
        skuSubject: { id: "horse-brown" },
      },
    ],
  };
}

function localUploadManifest() {
  return {
    setId: "set-local-upload",
    productName: "本地图片测试商品",
    createdAt: "2026-08-03T00:00:00.000Z",
    status: "completed",
    listingDrafts: [{
      title: "Local Image Test Product",
      description: "A controlled local image export fixture.",
      packageDimensions: "20 x 15 x 8 cm",
      packageWeight: "350 g",
      zhDisplay: { title: "本地图片测试商品" },
    }],
    skuSubjects: [{ id: "local-sku", title: "本地 SKU" }],
    items: [
      {
        itemId: "hero-success",
        slotIndex: 1,
        role: "hero",
        status: "completed",
        relativePath: "sets/local-upload/hero-success.png",
      },
      {
        itemId: "sku-fail",
        slotIndex: 2,
        role: "sku",
        status: "completed",
        relativePath: "sets/local-upload/sku-fail.png",
        skuSubject: { id: "local-sku" },
      },
    ],
  };
}

async function parseWorkbookResponse(response) {
  const bytes = Buffer.from(await response.arrayBuffer());
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  return { bytes, workbook };
}

async function startStudioServer({ cwd = rootDir, outputDir, localDataRootDir, env = {} }) {
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      PORT: String(port),
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
      ...env,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  try {
    await waitForServer(baseUrl, server);
  } catch (error) {
    await stopServer(server);
    throw error;
  }
  return { baseUrl, server };
}

async function prepareIsolatedServerRoot(tempRoot, {
  corruptTemplate = false,
  injectConcurrentExportMutation = false,
  injectStoreFailures = false,
} = {}) {
  const isolatedRoot = join(tempRoot, "server-root");
  await mkdir(isolatedRoot, { recursive: true });
  await cp(join(rootDir, "server.mjs"), join(isolatedRoot, "server.mjs"));
  await cp(join(rootDir, "lib"), join(isolatedRoot, "lib"), { recursive: true });
  await symlink(
    join(rootDir, "node_modules"),
    join(isolatedRoot, "node_modules"),
    process.platform === "win32" ? "junction" : "dir",
  );

  if (corruptTemplate) {
    await writeFile(
      join(isolatedRoot, "lib", "templates", "temu-import-template-v1.xlsx"),
      "invalid test template",
      "utf8",
    );
  }

  if (injectConcurrentExportMutation || injectStoreFailures) {
    const storePath = join(isolatedRoot, "lib", "creation-store.mjs");
    const source = await readFile(storePath, "utf8");
    const returnMethodsPattern = /    mergeTemuExcelImageCache,\r?\n    mergeTemuExcelExportState,/u;
    assert.match(source, returnMethodsPattern);
    const instrumented = source.replace(returnMethodsPattern, `    mergeTemuExcelImageCache: async (setId, entries) => {
      if (setId === process.env.IMAGE_STUDIO_TEST_CACHE_WRITE_FAILURE_SET_ID) {
        throw new Error("Injected Temu image cache write failure.");
      }
      if (setId === process.env.IMAGE_STUDIO_TEST_CONCURRENT_EXPORT_SET_ID) {
        const latest = await readManifest(setId);
        const listing = Array.isArray(latest.listingDrafts) ? latest.listingDrafts[0] || {} : {};
        await saveManifest({
          ...latest,
          productName: ${JSON.stringify(CONCURRENT_EXPORT_MUTATION.productName)},
          updatedAt: ${JSON.stringify(CONCURRENT_EXPORT_MUTATION.updatedAt)},
          listingDrafts: [{
            ...listing,
            title: ${JSON.stringify(CONCURRENT_EXPORT_MUTATION.listingTitle)},
            zhDisplay: {
              ...(listing.zhDisplay || {}),
              title: ${JSON.stringify(CONCURRENT_EXPORT_MUTATION.listingZhTitle)},
            },
          }],
          temuExport: { ...(latest.temuExport || {}), stock: 777 },
        });
      }
      return mergeTemuExcelImageCache(setId, entries);
    },
    mergeTemuExcelExportState: async (setId, exportState) => {
      if (setId === process.env.IMAGE_STUDIO_TEST_EXPORT_STATE_WRITE_FAILURE_SET_ID) {
        throw new Error("Injected Temu export state write failure.");
      }
      return mergeTemuExcelExportState(setId, exportState);
    },`);
    await writeFile(storePath, instrumented, "utf8");
  }

  return isolatedRoot;
}

test("Temu Excel handler verifies the template before resolving images and uses UTC filenames", async () => {
  const source = await readFile(join(rootDir, "server.mjs"), "utf8");
  const handlerStart = source.indexOf("async function handleCreationSetsTemuExcelExport");
  const handlerEnd = source.indexOf("async function handleCreationSetFolderOpen", handlerStart);
  const handler = source.slice(handlerStart, handlerEnd);

  assert.ok(handlerStart >= 0);
  assert.ok(handlerEnd > handlerStart);
  assert.ok(handler.indexOf("await verifyTemuTemplate()") < handler.indexOf("await resolveTemuImageRequirements("));
  assert.match(
    handler,
    /for \(const \[setId, entries\][\s\S]*?try \{[\s\S]*?mergeTemuExcelImageCache\(setId, entries\)[\s\S]*?\} catch \{[\s\S]*?appendTemuImageCacheWriteIssues\(plan, setId\)/u,
  );
  assert.match(handler, /now\.getUTCFullYear\(\)/u);
  assert.match(handler, /now\.getUTCHours\(\)/u);
});

test("local Temu Excel export returns a template workbook with one row per SKU", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-temu-export-api-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const cloudinaryLogPath = join(tempRoot, "cloudinary-calls.log");
  await writeManifest(outputDir, productManifest());
  await writeManifest(outputDir, localUploadManifest());
  await writeManifest(outputDir, strictReadyManifest());
  await writeManifest(outputDir, {
    ...strictReadyManifest("set-strict-blocked"),
    listingDrafts: [],
  });
  await mkdir(join(outputDir, "sets", "local-upload"), { recursive: true });
  await writeFile(
    join(outputDir, "sets", "local-upload", "hero-success.png"),
    Buffer.concat([PNG_BYTES, Buffer.from([0x01])]),
  );
  await writeFile(
    join(outputDir, "sets", "local-upload", "sku-fail.png"),
    Buffer.concat([PNG_BYTES, Buffer.from([0x02])]),
  );
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
      IMAGE_STUDIO_TEMU_CLOUDINARY_STUB_LOG: cloudinaryLogPath,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${CLOUDINARY_STUB_URL}`].filter(Boolean).join(" "),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });
  await waitForServer(baseUrl, server);

  const localDefaults = {
    variantAttributeName: "颜色",
    defaultPrice: 19.99,
    defaultStock: 25,
    defaultOriginCountry: "中国-广东省",
  };
  const response = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setIds: ["set-export-a", "set-export-a"],
      defaults: localDefaults,
    }),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, bytes.toString("utf8"));
  assert.match(response.headers.get("content-type") || "", /spreadsheetml/u);
  assert.match(response.headers.get("content-disposition") || "", /attachment/u);
  assert.equal(response.headers.get("x-temu-export-set-count"), "1");
  assert.equal(response.headers.get("x-temu-export-row-count"), "2");
  assert.equal(response.headers.get("x-temu-export-mode"), "draft");
  assert.equal(response.headers.get("x-temu-export-state-write-failure-count"), "0");
  assert.equal(response.headers.get("x-temu-export-issue-sheet"), encodeURIComponent("导出问题"));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet("导入模板");
  assert.equal(sheet.getCell("F2").value, "白色挂绳款");
  assert.equal(sheet.getCell("F3").value, "棕色皮绳款");
  assert.equal(sheet.getCell("J2").value, 19.99);
  assert.equal(sheet.getCell("S2").value, "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero.png");
  assert.ok(workbook.getWorksheet("导出问题"));

  const draftStoredManifest = JSON.parse(await readFile(
    join(outputDir, "json", "creation-sets", "set-export-a.json"),
    "utf8",
  ));
  assert.deepEqual(draftStoredManifest.temuExcelExportState, {
    version: 1,
    mode: "draft",
    exportedAt: draftStoredManifest.temuExcelExportState.exportedAt,
    sourceUpdatedAt: "2026-08-03T00:00:00.000Z",
    rowCount: 2,
    issueCount: Number(response.headers.get("x-temu-export-issue-count")),
  });
  assert.ok(Number.isFinite(Date.parse(draftStoredManifest.temuExcelExportState.exportedAt)));

  const preflightResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel/preflight`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setIds: ["set-strict-ready"], defaults: localDefaults }),
  });
  const preflight = await preflightResponse.json();
  assert.equal(preflightResponse.status, 200, JSON.stringify(preflight));
  assert.equal(preflightResponse.headers.get("cache-control"), "no-store");
  assert.equal(preflight.ok, true);
  assert.equal(preflight.version, 1);
  assert.equal(preflight.strictReady, true);
  assert.equal(preflight.stats.templateCount, 1);
  assert.equal(preflight.stats.setCount, 1);
  assert.equal(preflight.stats.skuCount, 2);
  assert.equal(preflight.stats.imageCount, 3);
  assert.equal(preflight.stats.pendingUploadCount, 0);
  assert.equal(preflight.stats.blockerCount, 0);
  assert.deepEqual(preflight.blockers, []);
  assert.equal(preflight.records[0].setId, "set-strict-ready");
  assert.equal(preflight.records[0].strictReady, true);

  const strictResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "strict", setIds: ["set-strict-ready"], defaults: localDefaults }),
  });
  assert.equal(strictResponse.status, 200);
  assert.equal(strictResponse.headers.get("x-temu-export-mode"), "strict");
  assert.equal(strictResponse.headers.get("x-temu-export-set-count"), "1");
  assert.equal(strictResponse.headers.get("x-temu-export-row-count"), "2");
  assert.equal(strictResponse.headers.get("x-temu-export-state-write-failure-count"), "0");
  const strictIssueCount = Number(strictResponse.headers.get("x-temu-export-issue-count"));
  await parseWorkbookResponse(strictResponse);
  const strictStoredManifest = JSON.parse(await readFile(
    join(outputDir, "json", "creation-sets", "set-strict-ready.json"),
    "utf8",
  ));
  assert.deepEqual(strictStoredManifest.temuExcelExportState, {
    version: 1,
    mode: "strict",
    exportedAt: strictStoredManifest.temuExcelExportState.exportedAt,
    sourceUpdatedAt: "2026-08-03T01:00:00.000Z",
    rowCount: 2,
    issueCount: strictIssueCount,
  });
  assert.ok(Number.isFinite(Date.parse(strictStoredManifest.temuExcelExportState.exportedAt)));

  const strictBlockedResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "strict", setIds: ["set-strict-blocked"], defaults: localDefaults }),
  });
  const strictBlocked = await strictBlockedResponse.json();
  assert.equal(strictBlockedResponse.status, 422, JSON.stringify(strictBlocked));
  assert.equal(strictBlocked.ok, false);
  assert.equal(strictBlocked.code, "TEMU_STRICT_EXPORT_BLOCKED");
  assert.equal(strictBlocked.strictReady, false);
  assert.ok(strictBlocked.blockers.length > 0);
  assert.ok(strictBlocked.blockers.some((problem) => problem.code === "MISSING_REQUIRED_FIELD"));
  const strictBlockedStored = JSON.parse(await readFile(
    join(outputDir, "json", "creation-sets", "set-strict-blocked.json"),
    "utf8",
  ));
  assert.equal("temuExcelExportState" in strictBlockedStored, false);

  const missingImageResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setIds: ["set-local-upload"], defaults: localDefaults }),
  });
  assert.equal(missingImageResponse.status, 200);
  const missingImageWorkbook = (await parseWorkbookResponse(missingImageResponse)).workbook;
  assert.equal(missingImageWorkbook.getWorksheet("导入模板").getCell("I2").value, null);
  assert.ok(
    missingImageWorkbook.getWorksheet("导出问题").getColumn(2).values.includes("MISSING_PUBLIC_IMAGE_URL"),
  );
  assert.equal(await readFile(cloudinaryLogPath, "utf8").catch(() => ""), "");

  const cloudinaryRequest = {
    setIds: ["set-local-upload"],
    defaults: localDefaults,
    cloudinary: { cloudName: "demo-cloud", uploadPreset: "temu_unsigned" },
  };
  const partialUploadResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cloudinaryRequest),
  });
  assert.equal(partialUploadResponse.status, 200);
  const partialUploadWorkbook = (await parseWorkbookResponse(partialUploadResponse)).workbook;
  const partialTemplate = partialUploadWorkbook.getWorksheet("导入模板");
  assert.equal(partialTemplate.getCell("I2").value, null);
  assert.equal(
    partialTemplate.getCell("S2").value,
    "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero-success.png",
  );
  assert.equal(
    partialTemplate.getCell("T2").value,
    "https://res.cloudinary.com/demo-cloud/image/upload/c_pad,b_white,h_1200,w_1200/v1/hero-success.png",
  );
  assert.ok(
    partialUploadWorkbook.getWorksheet("导出问题").getColumn(2).values.includes("IMAGE_UPLOAD_FAILED"),
  );

  const storedManifestPath = join(outputDir, "json", "creation-sets", "set-local-upload.json");
  const storedManifestText = await readFile(storedManifestPath, "utf8");
  const storedManifest = JSON.parse(storedManifestText);
  assert.equal(
    storedManifest.temuExcelImageCache.entries["hero-success"].secureUrl,
    "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero-success.png",
  );
  assert.equal(storedManifest.temuExcelImageCache.entries["sku-fail"], undefined);
  assert.doesNotMatch(storedManifestText, /uploadPreset|apiSecret/iu);
  let uploadCalls = (await readFile(cloudinaryLogPath, "utf8")).trim().split(/\r?\n/u);
  assert.equal(uploadCalls.filter((name) => name === "hero-success.png").length, 1);
  assert.equal(uploadCalls.filter((name) => name === "sku-fail.png").length, 2);

  const cacheReuseResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(cloudinaryRequest),
  });
  assert.equal(cacheReuseResponse.status, 200);
  await cacheReuseResponse.arrayBuffer();
  uploadCalls = (await readFile(cloudinaryLogPath, "utf8")).trim().split(/\r?\n/u);
  assert.equal(uploadCalls.filter((name) => name === "hero-success.png").length, 1);
  assert.equal(uploadCalls.filter((name) => name === "sku-fail.png").length, 4);

  await writeManifest(outputDir, {
    ...productManifest(),
    setId: "set-too-many-rows",
    skuSubjects: Array.from(
      { length: TEMU_EXPORT_LIMITS.maxRows + 1 },
      (_, index) => ({ id: `sku-${index}`, title: `SKU ${index}` }),
    ),
    items: [],
  });
  const tooManyRowsResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setIds: ["set-too-many-rows"] }),
  });
  assert.equal(tooManyRowsResponse.status, 413);

  const oversizedResponse = await fetch(baseUrl + "/api/creation/sets/export-temu-excel", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setIds: ["set-export-a"],
      padding: "x".repeat(TEMU_EXPORT_LIMITS.maxRequestBytes),
    }),
  });
  assert.equal(oversizedResponse.status, 413);

  await writeManifest(outputDir, { ...productManifest(), setId: "different-id" }, "requestedid.json");
  const collisionResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ setIds: ["requested/id"] }),
  });
  assert.equal(collisionResponse.status, 409);
});

test("local Temu Excel export preserves concurrent business changes when merging export state", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-temu-concurrent-export-api-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const cloudinaryLogPath = join(tempRoot, "cloudinary-calls.log");
  const isolatedRoot = await prepareIsolatedServerRoot(tempRoot, { injectConcurrentExportMutation: true });
  const setId = "set-concurrent-export";
  const sourceUpdatedAt = "2026-08-03T03:00:00.000Z";
  const source = localUploadManifest();
  await writeManifest(outputDir, {
    ...source,
    setId,
    updatedAt: sourceUpdatedAt,
    items: [
      {
        itemId: "hero-success",
        slotIndex: 1,
        role: "hero",
        status: "completed",
        relativePath: "sets/concurrent-export/hero-success.png",
      },
      {
        itemId: "sku-success",
        slotIndex: 2,
        role: "sku",
        status: "completed",
        relativePath: "sets/concurrent-export/sku-success.png",
        skuSubject: { id: "local-sku" },
      },
    ],
  });
  await mkdir(join(outputDir, "sets", "concurrent-export"), { recursive: true });
  await writeFile(
    join(outputDir, "sets", "concurrent-export", "hero-success.png"),
    Buffer.concat([PNG_BYTES, Buffer.from([0x01])]),
  );
  await writeFile(
    join(outputDir, "sets", "concurrent-export", "sku-success.png"),
    Buffer.concat([PNG_BYTES, Buffer.from([0x02])]),
  );
  const { baseUrl, server } = await startStudioServer({
    cwd: isolatedRoot,
    outputDir,
    localDataRootDir,
    env: {
      IMAGE_STUDIO_TEST_CONCURRENT_EXPORT_SET_ID: setId,
      IMAGE_STUDIO_TEMU_CLOUDINARY_STUB_LOG: cloudinaryLogPath,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${CLOUDINARY_STUB_URL}`].filter(Boolean).join(" "),
    },
  });
  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  const response = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "draft",
      setIds: [setId],
      defaults: {
        variantAttributeName: "颜色",
        defaultPrice: 19.99,
        defaultStock: 25,
        defaultOriginCountry: "中国-广东省",
      },
      cloudinary: { cloudName: "demo-cloud", uploadPreset: "temu_unsigned" },
    }),
  });

  assert.equal(response.status, 200);
  assert.equal(response.headers.get("x-temu-export-state-write-failure-count"), "0");
  const issueCount = Number(response.headers.get("x-temu-export-issue-count"));
  const workbook = (await parseWorkbookResponse(response)).workbook;
  assert.equal(workbook.getWorksheet("导入模板").getCell("A2").value, "本地图片测试商品");
  assert.equal(workbook.getWorksheet("导入模板").getCell("B2").value, "Local Image Test Product");

  const stored = JSON.parse(await readFile(
    join(outputDir, "json", "creation-sets", `${setId}.json`),
    "utf8",
  ));
  assert.equal(stored.productName, CONCURRENT_EXPORT_MUTATION.productName);
  assert.equal(stored.listingDrafts[0].title, CONCURRENT_EXPORT_MUTATION.listingTitle);
  assert.equal(stored.listingDrafts[0].zhDisplay.title, CONCURRENT_EXPORT_MUTATION.listingZhTitle);
  assert.equal(stored.temuExport.stock, 777);
  assert.equal(stored.updatedAt, CONCURRENT_EXPORT_MUTATION.updatedAt);
  assert.equal(
    stored.temuExcelImageCache.entries["hero-success"].secureUrl,
    "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero-success.png",
  );
  assert.equal(
    stored.temuExcelImageCache.entries["sku-success"].secureUrl,
    "https://res.cloudinary.com/demo-cloud/image/upload/v1/sku-success.png",
  );
  assert.deepEqual(stored.temuExcelExportState, {
    version: 1,
    mode: "draft",
    exportedAt: stored.temuExcelExportState.exportedAt,
    sourceUpdatedAt,
    rowCount: 1,
    issueCount,
  });
  assert.notEqual(stored.temuExcelExportState.sourceUpdatedAt, stored.updatedAt);
});

test("local Temu Excel export fails before image upload when the template is invalid", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-temu-template-failure-api-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const cloudinaryLogPath = join(tempRoot, "cloudinary-calls.log");
  const isolatedRoot = await prepareIsolatedServerRoot(tempRoot, { corruptTemplate: true });
  await writeManifest(outputDir, localUploadManifest());
  await mkdir(join(outputDir, "sets", "local-upload"), { recursive: true });
  await writeFile(
    join(outputDir, "sets", "local-upload", "hero-success.png"),
    Buffer.concat([PNG_BYTES, Buffer.from([0x01])]),
  );
  await writeFile(
    join(outputDir, "sets", "local-upload", "sku-fail.png"),
    Buffer.concat([PNG_BYTES, Buffer.from([0x02])]),
  );
  const { baseUrl, server } = await startStudioServer({
    cwd: isolatedRoot,
    outputDir,
    localDataRootDir,
    env: {
      IMAGE_STUDIO_TEMU_CLOUDINARY_STUB_LOG: cloudinaryLogPath,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${CLOUDINARY_STUB_URL}`].filter(Boolean).join(" "),
    },
  });
  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  const response = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setIds: ["set-local-upload"],
      defaults: {
        defaultPrice: 19.99,
        defaultStock: 25,
        defaultOriginCountry: "中国-广东省",
      },
      cloudinary: { cloudName: "demo-cloud", uploadPreset: "temu_unsigned" },
    }),
  });
  const payload = await response.json();

  assert.equal(response.status, 500, JSON.stringify(payload));
  assert.match(payload.message, /模板/u);
  assert.equal(await readFile(cloudinaryLogPath, "utf8").catch(() => ""), "");
  const stored = JSON.parse(await readFile(
    join(outputDir, "json", "creation-sets", "set-local-upload.json"),
    "utf8",
  ));
  assert.equal("temuExcelImageCache" in stored, false);
  assert.equal("temuExcelExportState" in stored, false);
});

test("local Temu Excel export reports cache and export-state write failures without losing the workbook", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-temu-store-failure-api-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const cloudinaryLogPath = join(tempRoot, "cloudinary-calls.log");
  const isolatedRoot = await prepareIsolatedServerRoot(tempRoot, { injectStoreFailures: true });
  const cacheFailureSet = {
    ...localUploadManifest(),
    setId: "set-cache-write-fail",
    updatedAt: "2026-08-03T02:00:00.000Z",
    items: [
      {
        itemId: "hero-success",
        slotIndex: 1,
        role: "hero",
        status: "completed",
        relativePath: "sets/cache-write-fail/hero-success.png",
      },
      {
        itemId: "sku-success",
        slotIndex: 2,
        role: "sku",
        status: "completed",
        relativePath: "sets/cache-write-fail/sku-success.png",
        skuSubject: { id: "local-sku" },
      },
    ],
  };
  await writeManifest(outputDir, cacheFailureSet);
  await writeManifest(outputDir, strictReadyManifest("set-state-write-fail"));
  await mkdir(join(outputDir, "sets", "cache-write-fail"), { recursive: true });
  await writeFile(
    join(outputDir, "sets", "cache-write-fail", "hero-success.png"),
    Buffer.concat([PNG_BYTES, Buffer.from([0x01])]),
  );
  await writeFile(
    join(outputDir, "sets", "cache-write-fail", "sku-success.png"),
    Buffer.concat([PNG_BYTES, Buffer.from([0x02])]),
  );
  const { baseUrl, server } = await startStudioServer({
    cwd: isolatedRoot,
    outputDir,
    localDataRootDir,
    env: {
      IMAGE_STUDIO_TEST_CACHE_WRITE_FAILURE_SET_ID: "set-cache-write-fail",
      IMAGE_STUDIO_TEST_EXPORT_STATE_WRITE_FAILURE_SET_ID: "set-state-write-fail",
      IMAGE_STUDIO_TEMU_CLOUDINARY_STUB_LOG: cloudinaryLogPath,
      NODE_OPTIONS: [process.env.NODE_OPTIONS, `--import=${CLOUDINARY_STUB_URL}`].filter(Boolean).join(" "),
    },
  });
  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });
  const defaults = {
    variantAttributeName: "颜色",
    defaultPrice: 19.99,
    defaultStock: 25,
    defaultOriginCountry: "中国-广东省",
  };

  const cacheFailureResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      mode: "draft",
      setIds: ["set-cache-write-fail"],
      defaults,
      cloudinary: { cloudName: "demo-cloud", uploadPreset: "temu_unsigned" },
    }),
  });
  assert.equal(cacheFailureResponse.status, 200);
  assert.equal(cacheFailureResponse.headers.get("x-temu-export-mode"), "draft");
  assert.equal(cacheFailureResponse.headers.get("x-temu-export-state-write-failure-count"), "0");
  const cacheFailureWorkbook = (await parseWorkbookResponse(cacheFailureResponse)).workbook;
  assert.ok(
    cacheFailureWorkbook.getWorksheet("导出问题").getColumn(2).values.includes("IMAGE_CACHE_WRITE_FAILED"),
  );
  const cacheFailureStored = JSON.parse(await readFile(
    join(outputDir, "json", "creation-sets", "set-cache-write-fail.json"),
    "utf8",
  ));
  assert.equal("temuExcelImageCache" in cacheFailureStored, false);
  assert.equal(cacheFailureStored.temuExcelExportState.mode, "draft");
  assert.equal(cacheFailureStored.temuExcelExportState.sourceUpdatedAt, "2026-08-03T02:00:00.000Z");

  const stateFailureResponse = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ mode: "draft", setIds: ["set-state-write-fail"], defaults }),
  });
  assert.equal(stateFailureResponse.status, 200);
  assert.equal(stateFailureResponse.headers.get("x-temu-export-mode"), "draft");
  assert.equal(stateFailureResponse.headers.get("x-temu-export-state-write-failure-count"), "1");
  assert.equal(stateFailureResponse.headers.get("x-temu-export-state-code"), "EXPORT_STATE_WRITE_FAILED");
  const stateFailureIssueCount = Number(stateFailureResponse.headers.get("x-temu-export-issue-count"));
  const stateFailureWorkbook = (await parseWorkbookResponse(stateFailureResponse)).workbook;
  const stateFailureIssues = stateFailureWorkbook.getWorksheet("导出问题");
  assert.ok(stateFailureIssues.getColumn(2).values.includes("EXPORT_STATE_WRITE_FAILED"));
  assert.equal(stateFailureIssues.actualRowCount - 1, stateFailureIssueCount);
  const stateFailureStored = JSON.parse(await readFile(
    join(outputDir, "json", "creation-sets", "set-state-write-fail.json"),
    "utf8",
  ));
  assert.equal("temuExcelExportState" in stateFailureStored, false);
});
