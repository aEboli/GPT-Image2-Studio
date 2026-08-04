import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
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

  const response = await fetch(`${baseUrl}/api/creation/sets/export-temu-excel`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      setIds: ["set-export-a", "set-export-a"],
      defaults: {
        variantAttributeName: "颜色",
        defaultPrice: 19.99,
        defaultStock: 25,
        defaultOriginCountry: "中国-广东省",
      },
    }),
  });
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(response.status, 200, bytes.toString("utf8"));
  assert.match(response.headers.get("content-type") || "", /spreadsheetml/u);
  assert.match(response.headers.get("content-disposition") || "", /attachment/u);
  assert.equal(response.headers.get("x-temu-export-set-count"), "1");
  assert.equal(response.headers.get("x-temu-export-row-count"), "2");
  assert.equal(response.headers.get("x-temu-export-issue-sheet"), encodeURIComponent("导出问题"));

  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(bytes);
  const sheet = workbook.getWorksheet("导入模板");
  assert.equal(sheet.getCell("F2").value, "白色挂绳款");
  assert.equal(sheet.getCell("F3").value, "棕色皮绳款");
  assert.equal(sheet.getCell("J2").value, 19.99);
  assert.equal(sheet.getCell("S2").value, "https://res.cloudinary.com/demo-cloud/image/upload/v1/hero.png");
  assert.ok(workbook.getWorksheet("导出问题"));

  const localDefaults = {
    variantAttributeName: "颜色",
    defaultPrice: 19.99,
    defaultStock: 25,
    defaultOriginCountry: "中国-广东省",
  };
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
