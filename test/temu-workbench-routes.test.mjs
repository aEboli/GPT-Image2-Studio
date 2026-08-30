import test from "node:test";
import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { Agent, createServer, request as httpRequest } from "node:http";
import { once } from "node:events";
import { tmpdir } from "node:os";
import { dirname, extname, isAbsolute, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import ExcelJS from "exceljs";

import { TEMU_EXPORT_LIMITS } from "../lib/creation-temu-export.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "../lib/temu/template-headers.mjs";
import { generateSkuMatrix } from "../lib/temu/domain.mjs";
import {
  TEMU_WORKBENCH_LIMITS,
  TEMU_WORKBENCH_PATH_PREFIX,
  TEMU_WORKBENCH_ROUTES,
  createTemuWorkbenchRoutes,
  matchesTemuWorkbenchPath,
} from "../lib/temu-server/routes.mjs";
import { createValidDraft } from "./temu-fixtures.mjs";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

// 真实 manifest 的形状摘抄：531/531 条 imageUrl 都带 ?v=<ISO> cache-buster，
// 且路径段是百分号编码的中文。图片路由必须在这种数据上返回真实字节。
const VERSIONED_IMAGE_PATH =
  "/output/2026-08/08-29/2026-08-29-creation/1714-%E7%94%B5%E7%83%AD-8304/1-1714-%E9%A6%96%E5%9B%BE-9a31.png";
const VERSIONED_IMAGE_URL = `${VERSIONED_IMAGE_PATH}?v=2026-08-29T09%3A14%3A31.726Z`;
const PNG_BYTES = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
  0x00, 0x00, 0x00, 0x0d, 0x49, 0x48, 0x44, 0x52,
  0x00, 0x00, 0x04, 0xe6, 0x00, 0x00, 0x04, 0xe6,
]);

const MIME_BY_EXTENSION = { ".png": "image/png", ".jpg": "image/jpeg", ".webp": "image/webp" };

function studioManifest() {
  return {
    setId: "creation-set-1c2d696b-e169-472b-8304-6d6daa22d9a3",
    productName: "电热保暖手套",
    status: "completed",
    platformLabel: "通用电商",
    targetLanguageLabel: "English",
    updatedAt: "2026-08-29T09:20:55.298Z",
    skuSubjects: [{ id: "SKU-卡其 (1).png", title: "SKU-卡其 (1).png", filenames: ["SKU-卡其 (1).png"] }],
    listingDrafts: [{
      status: "completed",
      title: "1 Pack Heated Winter Gloves",
      description: "These heated winter gloves are designed for cold-weather riding.",
      packageDimensions: "Estimated: 30 cm x 20 cm x 8 cm",
      packageWeight: "Estimated: 410 g",
      zhDisplay: { title: "1 Pack 电热保暖手套", description: "这款电热保暖手套适合冬季骑行。" },
    }],
    items: [
      {
        itemId: "universal:generic-hero",
        itemKind: "carousel",
        status: "completed",
        slotIndex: 1,
        filename: "1-1714-首图-9a31.png",
        imageUrl: VERSIONED_IMAGE_URL,
        actualSize: "1254x1254",
        format: "png",
        referenceImageNames: ["1.jpg"],
      },
      {
        // imageUrl 离开 /output/：适配器会整项剔除，因此该 itemId 必须 404。
        itemId: "19-sku-SKU-卡其 (1).png",
        itemKind: "sku",
        status: "completed",
        slotIndex: 19,
        filename: "19-1714-sku-1-khaki-a319.png",
        imageUrl: "/gallery/19-1714-sku-1-khaki-a319.png?v=2026-08-29T09%3A14%3A31.726Z",
        actualSize: "1254x1254",
        format: "png",
        referenceImageNames: ["SKU-卡其 (1)-reference.jpg"],
      },
    ],
  };
}

// server.mjs 的 resolveSafeFile 与 serveFile 逐条同形复制（含畸形转义的 try/catch），
// 使注入的假件与集成后真正跑的那两个函数行为一致。
function resolveSafeFile(baseDir, requestPath) {
  let decoded;
  try {
    decoded = decodeURIComponent(requestPath);
  } catch {
    return null;
  }
  const target = resolve(baseDir, `.${decoded}`);
  const normalizedBase = resolve(baseDir);
  const backToBase = relative(normalizedBase, target);
  if (backToBase.startsWith("..") || isAbsolute(backToBase)) return null;
  return target;
}

async function serveFile(request, response, filePath) {
  const fileStat = await stat(filePath);
  response.writeHead(200, {
    "Content-Type": MIME_BY_EXTENSION[extname(filePath).toLowerCase()] || "application/octet-stream",
    "Content-Length": fileStat.size,
  });
  await new Promise((resolvePromise, rejectPromise) => {
    const stream = createReadStream(filePath);
    stream.on("error", rejectPromise);
    stream.on("end", resolvePromise);
    stream.pipe(response);
  });
}

// server.mjs 的 readJsonBody 同形复制，外加字节计数，用来证明超限是「读到上限即拒」
// 而不是先把整个请求体缓冲下来再判断。
function createRecordingJsonBodyReader() {
  const calls = [];
  async function readJsonBody(request, { maxBytes = Number.POSITIVE_INFINITY } = {}) {
    const call = { maxBytes, observedBytes: 0 };
    calls.push(call);
    const chunks = [];
    let totalBytes = 0;
    for await (const chunk of request) {
      const bytes = Buffer.from(chunk);
      totalBytes += bytes.byteLength;
      call.observedBytes = totalBytes;
      if (totalBytes > maxBytes) {
        const error = new Error("JSON 请求体超过允许大小。");
        error.code = "PAYLOAD_TOO_LARGE";
        throw error;
      }
      chunks.push(bytes);
    }
    if (chunks.length === 0) return {};
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  }
  return { readJsonBody, calls };
}

function squareImage(url) {
  return { url, width: 1200, height: 1200, bytes: 12_345, format: "png", contentType: "image/png" };
}

async function startHarness(overrides = {}, { manifests = [studioManifest()] } = {}) {
  const routes = createTemuWorkbenchRoutes({
    listManifests: async () => manifests,
    outputDir: overrides.outputDir || join(tmpdir(), "temu-routes-unused"),
    resolveSafeFile,
    serveFile,
    readJsonBody: createRecordingJsonBodyReader().readJsonBody,
    verifyImage: async (url) => squareImage(url),
    ...overrides,
  });

  const server = createServer((request, response) => {
    const url = new URL(request.url || "/", "http://127.0.0.1");
    if (!matchesTemuWorkbenchPath(url.pathname)) {
      response.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
      response.end("Not found");
      return;
    }
    Promise.resolve(routes.handleRequest(request, response, url)).catch((error) => {
      if (!response.headersSent) {
        response.writeHead(500, { "Content-Type": "application/json; charset=utf-8" });
        response.end(JSON.stringify({ ok: false, error: String(error?.message || error) }));
      } else {
        response.destroy(error);
      }
    });
  });
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const baseUrl = `http://127.0.0.1:${server.address().port}`;
  return {
    routes,
    baseUrl,
    async close() {
      await new Promise((resolveClose) => server.close(resolveClose));
    },
  };
}

// 用 node:http 而不是 fetch 发超限请求，并且必须走 keep-alive 连接：
// 服务端在请求体写完之前就回了 413，若连接是 Connection: close，Node 的 resOnFinish 会在响应
// 结束时立刻 destroySoon()，尚未写完的客户端只会读到 ECONNRESET 而看不到这条 413。
// keep-alive 下 res._last 为假，socket 留着让剩余请求体排掉，响应才能可靠送达。
function rawPost(baseUrl, path, chunks, agent, declaredLength = null) {
  return new Promise((resolvePromise, rejectPromise) => {
    const target = new URL(path, baseUrl);
    const headers = { "content-type": "application/json" };
    if (declaredLength !== null) headers["content-length"] = declaredLength;
    const client = httpRequest(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname + target.search,
        method: "POST",
        agent,
        headers,
      },
      (response) => {
        const body = [];
        response.on("data", (chunk) => body.push(chunk));
        response.on("end", () => resolvePromise({
          status: response.statusCode,
          text: Buffer.concat(body).toString("utf8"),
        }));
      },
    );
    let settled = false;
    client.on("error", (error) => {
      if (!settled) rejectPromise(error);
    });
    client.on("response", () => {
      settled = true;
    });
    (async () => {
      for (const chunk of chunks) {
        if (settled) break;
        if (!client.write(chunk)) await once(client, "drain").catch(() => {});
      }
      client.end();
    })().catch(() => {});
  });
}

// 直接调 handleRequest 的最小 request/response 替身，用于不该依赖真实 socket 时序的断言。
async function captureRoute(routes, method, path, { headers = {} } = {}) {
  const captured = { statusCode: 0, headers: {}, body: "" };
  const response = {
    headersSent: false,
    writeHead(statusCode, responseHeaders = {}) {
      captured.statusCode = statusCode;
      captured.headers = responseHeaders;
      this.headersSent = true;
    },
    end(body = "") {
      captured.body = Buffer.isBuffer(body) ? body.toString("utf8") : String(body);
    },
  };
  const request = { method, url: path, headers };
  await routes.handleRequest(request, response, new URL(path, "http://127.0.0.1"));
  return { ...captured, json: () => JSON.parse(captured.body) };
}

function deferred() {
  let resolveFn;
  const promise = new Promise((resolvePromise) => {
    resolveFn = resolvePromise;
  });
  return { promise, resolve: resolveFn };
}

test("路由路径全部落在 /api/temu/ 之下，非 GET 因此受 CSRF 检查覆盖", () => {
  assert.equal(TEMU_WORKBENCH_PATH_PREFIX, "/api/temu/");
  const paths = Object.values(TEMU_WORKBENCH_ROUTES);
  assert.equal(paths.length, 5);
  for (const path of paths) {
    assert.ok(matchesTemuWorkbenchPath(path), `${path} 必须落在 ${TEMU_WORKBENCH_PATH_PREFIX} 之下`);
  }
  // 预览 URL 契约是单一声明，不允许路由再写一份字面量。
  assert.equal(TEMU_WORKBENCH_ROUTES.studioImage, TEMU_STUDIO_IMAGE_PATH);
  assert.equal(TEMU_WORKBENCH_LIMITS.maxRows, TEMU_EXPORT_LIMITS.maxRows);
  assert.equal(TEMU_WORKBENCH_LIMITS.exportRequestBytes, 8 * 1024 * 1024);
  assert.equal(TEMU_WORKBENCH_LIMITS.verifyRequestBytes, 64 * 1024);
});

test("health 返回模板兼容性与本仓库版本号，且每请求重算", async () => {
  const harness = await startHarness();
  try {
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.health}`, { cache: "no-store" });
    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.template.compatible, true);
    assert.equal(payload.template.columnCount, 51);
    assert.equal(payload.template.sheetName, "导入模板");
    assert.equal(payload.template.exampleSheetName, "导入示例");
    assert.match(payload.template.sha256, /^[0-9A-F]{64}$/u);
    // 子文档的 checkHealth 只接受严格 semver，否则展示 v--。
    const packageVersion = JSON.parse(await readFile(join(repoRoot, "package.json"), "utf8")).version;
    assert.equal(payload.version, packageVersion);
    assert.match(payload.version, /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/u);
  } finally {
    await harness.close();
  }

  let templateChecks = 0;
  const counted = await startHarness({
    verifyTemplate: async () => {
      templateChecks += 1;
      return { sha256: "A".repeat(64), sheetName: "导入模板", exampleSheetName: "导入示例", columnCount: 51 };
    },
  });
  try {
    await fetch(`${counted.baseUrl}${TEMU_WORKBENCH_ROUTES.health}`, { cache: "no-store" });
    await fetch(`${counted.baseUrl}${TEMU_WORKBENCH_ROUTES.health}`, { cache: "no-store" });
    // 被吸收侧在 boot 期算一次就再不刷新，模板换掉后它会一直汇报旧结论。
    assert.equal(templateChecks, 2, "模板状态必须每请求重算，不能用 boot 期快照");
  } finally {
    await counted.close();
  }
});

test("health 在模板不可用时返回 503 且不泄漏本地路径", async () => {
  const harness = await startHarness({
    verifyTemplate: async () => {
      const error = new Error("Temu 标准模板不存在或无法读取：C:\\Users\\Administrator\\lib\\templates\\temu.xlsx");
      error.code = "TEMU_WORKBOOK_INVALID";
      throw error;
    },
  });
  try {
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.health}`, { cache: "no-store" });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.template.compatible, false);
    assert.equal(payload.template.code, "TEMU_WORKBOOK_INVALID");
    assert.ok(payload.template.message.includes("[已隐藏本地路径]"));
    assert.doesNotMatch(payload.template.message, /[A-Za-z]:\\/u);
  } finally {
    await harness.close();
  }
});

test("studio/sets 返回 { ok, sets } 信封，并用短 TTL 缓存服务两处独立调用", async () => {
  let listCalls = 0;
  const harness = await startHarness({
    listManifests: async () => {
      listCalls += 1;
      return [studioManifest()];
    },
  });
  try {
    const first = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.studioSets}`, { cache: "no-store" });
    assert.equal(first.status, 200);
    const payload = await first.json();
    assert.equal(payload.ok, true);
    assert.equal(payload.sets.length, 1);
    assert.equal(payload.sets[0].setId, "creation-set-1c2d696b-e169-472b-8304-6d6daa22d9a3");
    assert.equal(payload.sets[0].productName, "电热保暖手套");
    assert.equal(payload.sets[0].carouselImages.length, 1);
    assert.ok(payload.sets[0].carouselImages[0].previewUrl.startsWith(`${TEMU_STUDIO_IMAGE_PATH}?setId=`));
    // /output/ 之外的 SKU 图被适配器剔除，摘要里该主体没有图。
    assert.equal(payload.sets[0].skuSubjects[0].image, null);
    assert.deepEqual(payload.sets[0].logisticsEstimate, {
      source: "package",
      lengthCm: 30,
      widthCm: 20,
      heightCm: 8,
      weightG: 410,
    });

    // 子文档从轮播图追加与导入对话框两处各调一次，彼此无共享缓存。
    await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.studioSets}`, { cache: "no-store" });
    await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.studioSets}`, { cache: "no-store" });
    assert.equal(listCalls, 1, "TTL 内的重复调用必须复用缓存，不重读全部 manifest");
  } finally {
    await harness.close();
  }
});

test("studio/sets 在记录读取失败时返回 502 信封", async () => {
  const harness = await startHarness({
    listManifests: async () => {
      throw new Error("EACCES: permission denied, scandir 'C:\\Users\\Administrator\\Pictures\\json'");
    },
  });
  try {
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.studioSets}`, { cache: "no-store" });
    assert.equal(response.status, 502);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.code, "TEMU_STUDIO_SETS_ERROR");
    assert.doesNotMatch(payload.error, /[A-Za-z]:\\/u);
  } finally {
    await harness.close();
  }
});

test("studio/image 对带 ?v= 的真实 imageUrl 返回真实字节，越出 /output/ 的项 404", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "temu-routes-output-"));
  const relativeImagePath = decodeURIComponent(VERSIONED_IMAGE_PATH.slice("/output/".length));
  const absoluteImagePath = join(outputDir, relativeImagePath);
  await mkdir(dirname(absoluteImagePath), { recursive: true });
  await writeFile(absoluteImagePath, PNG_BYTES);

  const harness = await startHarness({ outputDir });
  try {
    const setId = "creation-set-1c2d696b-e169-472b-8304-6d6daa22d9a3";
    const imageUrl = `${harness.baseUrl}${TEMU_STUDIO_IMAGE_PATH}`
      + `?setId=${encodeURIComponent(setId)}&itemId=${encodeURIComponent("universal:generic-hero")}`;
    const response = await fetch(imageUrl, { cache: "no-store" });
    assert.equal(response.status, 200);
    // 子文档的 studioImageFile 要求 content-type 以 image/ 开头。
    assert.match(response.headers.get("content-type"), /^image\/png$/u);
    const bytes = Buffer.from(await response.arrayBuffer());
    assert.deepEqual(bytes, PNG_BYTES, "?v= cache-buster 必须被剥掉，否则真实数据上必然 ENOENT");

    // 该项的 imageUrl 指向 /gallery/，适配器不收，因此索引里没有它。
    const strayUrl = `${harness.baseUrl}${TEMU_STUDIO_IMAGE_PATH}`
      + `?setId=${encodeURIComponent(setId)}&itemId=${encodeURIComponent("19-sku-SKU-卡其 (1).png")}`;
    const stray = await fetch(strayUrl, { cache: "no-store" });
    assert.equal(stray.status, 404);
    const strayPayload = await stray.json();
    assert.equal(strayPayload.ok, false);
    assert.equal(strayPayload.code, "TEMU_STUDIO_IMAGE_NOT_FOUND");

    // 索引外的任意 setId/itemId 组合同样只能 404，不得成为读文件的入口。
    const forged = await fetch(
      `${harness.baseUrl}${TEMU_STUDIO_IMAGE_PATH}?setId=${encodeURIComponent(setId)}&itemId=..%2F..%2Fserver.mjs`,
      { cache: "no-store" },
    );
    assert.equal(forged.status, 404);
  } finally {
    await harness.close();
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("studio/image 在文件已被删除时返回 404 而不是截断的 200", async () => {
  const outputDir = await mkdtemp(join(tmpdir(), "temu-routes-missing-"));
  const harness = await startHarness({ outputDir });
  try {
    const setId = "creation-set-1c2d696b-e169-472b-8304-6d6daa22d9a3";
    const response = await fetch(
      `${harness.baseUrl}${TEMU_STUDIO_IMAGE_PATH}?setId=${encodeURIComponent(setId)}`
      + `&itemId=${encodeURIComponent("universal:generic-hero")}`,
      { cache: "no-store" },
    );
    assert.equal(response.status, 404);
    assert.equal((await response.json()).code, "TEMU_STUDIO_IMAGE_NOT_FOUND");
  } finally {
    await harness.close();
    await rm(outputDir, { recursive: true, force: true });
  }
});

test("assets/verify 成功返回 { ok, asset }，失败返回 422", async () => {
  const harness = await startHarness({
    verifyImage: async (url) => {
      if (String(url).includes("broken")) throw new Error("远程图片服务器返回 HTTP 404。");
      return squareImage(String(url));
    },
  });
  try {
    const ok = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.assetsVerify}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://res.cloudinary.com/demo/image/upload/sample.jpg" }),
    });
    assert.equal(ok.status, 200);
    const okPayload = await ok.json();
    assert.equal(okPayload.ok, true);
    assert.deepEqual(okPayload.asset, squareImage("https://res.cloudinary.com/demo/image/upload/sample.jpg"));

    const bad = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.assetsVerify}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ url: "https://res.cloudinary.com/demo/image/upload/broken.jpg" }),
    });
    assert.equal(bad.status, 422);
    const badPayload = await bad.json();
    assert.equal(badPayload.ok, false);
    assert.equal(badPayload.error, "远程图片服务器返回 HTTP 404。");
  } finally {
    await harness.close();
  }
});

test("export 产出 2 sheet 工作簿并带两种 attachment 文件名形式", async () => {
  const harness = await startHarness({ now: () => new Date("2026-08-30T10:11:12.345Z") });
  try {
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [createValidDraft()] }),
    });
    assert.equal(response.status, 200);
    assert.equal(
      response.headers.get("content-type"),
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    );
    const disposition = response.headers.get("content-disposition");
    assert.equal(
      disposition,
      'attachment; filename="temu-import-20260830T101112Z.xlsx"; '
      + "filename*=UTF-8''temu-import-20260830T101112Z.xlsx",
    );
    // 子文档用 /filename="([^"]+)"/ 读文件名，两种形式都必须在。
    assert.equal(disposition.match(/filename="([^"]+)"/u)[1], "temu-import-20260830T101112Z.xlsx");
    assert.match(disposition, /filename\*=UTF-8''temu-import-20260830T101112Z\.xlsx/u);
    assert.equal(response.headers.get("cache-control"), "no-store");
    // 2 sheet 形态里没有问题工作表，写入器仍回的 issue 只能靠计数头露出来。
    assert.equal(response.headers.get("x-temu-export-row-count"), "4");
    assert.equal(response.headers.get("x-temu-export-issue-count"), "0");

    const buffer = Buffer.from(await response.arrayBuffer());
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer);
    // 工作台路径传 includeIssueSheet: false，产出商家实际上传成功过的 2 sheet 形态。
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["导入模板", "导入示例"]);
    const sheet = workbook.getWorksheet("导入模板");
    assert.equal(sheet.getCell("A2").value, "便携收纳盒");
    assert.equal(sheet.actualRowCount >= 5, true);
  } finally {
    await harness.close();
  }
});

test("export 单飞锁让并发的第二次请求得到 409，且不串行化批量路径", async () => {
  const gate = deferred();
  let verifyStarted = null;
  const started = new Promise((resolvePromise) => {
    verifyStarted = resolvePromise;
  });
  const harness = await startHarness({
    verifyImage: async (url) => {
      verifyStarted();
      await gate.promise;
      return squareImage(String(url));
    },
  });
  try {
    const body = JSON.stringify({ drafts: [createValidDraft()] });
    const first = fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    await started;
    // 带超时：锁若不存在，第二次请求会同样停在闸门上，必须快速失败并报出原因，
    // 而不是把整个测试文件挂住。
    const second = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      signal: AbortSignal.timeout(5000),
    }).catch((error) => {
      assert.fail(`并发的第二次导出没有立刻返回 409：${error?.name || error}`);
    });
    assert.equal(second.status, 409);
    const payload = await second.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "已有导出任务正在运行");

    gate.resolve();
    assert.equal((await first).status, 200);

    // 锁在 finally 里释放：第一次导出结束后同一实例还能再导出。
    const third = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
    });
    assert.equal(third.status, 200);
  } finally {
    gate.resolve();
    await harness.close();
  }
});

test("export 的 EMBEDDED_IMAGES_UNSUPPORTED 在任何校验之前返回 422", async () => {
  let verifyCalls = 0;
  const harness = await startHarness({
    verifyImage: async (url) => {
      verifyCalls += 1;
      return squareImage(String(url));
    },
  });
  try {
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [createValidDraft()], embeddedImages: [{ id: "local-1" }] }),
    });
    assert.equal(response.status, 422);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.code, "EMBEDDED_IMAGES_UNSUPPORTED");
    assert.equal(payload.error, "当前导出只接受公网图片 URL，请刷新页面后重试");
    assert.equal(verifyCalls, 0);
  } finally {
    await harness.close();
  }
});

test("export 的 VALIDATION_ERROR 返回 422 并携带清理过的 errors/warnings", async () => {
  const harness = await startHarness();
  try {
    const draft = createValidDraft();
    draft.product.title = "";
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [draft] }),
    });
    assert.equal(response.status, 422);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "导出数据未通过校验");
    assert.ok(Array.isArray(payload.errors));
    assert.ok(payload.errors.some((issue) => issue.path === "drafts.0.product.title" && issue.message.includes("商品 1：")));
    assert.ok(Array.isArray(payload.warnings));
  } finally {
    await harness.close();
  }

  // includeIssueSheet: false 会跳过写入器 :118 那处清理，所以问题文本必须由路由自己过一遍。
  const leaky = await startHarness({
    buildDraftPlan: () => {
      const error = new Error("导出数据未通过校验");
      error.code = "VALIDATION_ERROR";
      error.validation = {
        valid: false,
        errors: [{ path: "skus.0.image", code: "local_source", message: "SKU 图片仍指向 C:\\Users\\Administrator\\Pictures\\sku.png" }],
        warnings: [{ path: "assets.carousel.0", code: "asset_pending", message: "轮播图来自 D:\\temp\\draft\\c1.png" }],
      };
      throw error;
    },
  });
  try {
    const response = await fetch(`${leaky.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [createValidDraft()] }),
    });
    assert.equal(response.status, 422);
    const payload = await response.json();
    assert.equal(payload.errors[0].message, "SKU 图片仍指向 [已隐藏本地路径]");
    assert.equal(payload.warnings[0].message, "轮播图来自 [已隐藏本地路径]");
    assert.equal(payload.errors[0].path, "skus.0.image");
    assert.doesNotMatch(JSON.stringify(payload), /[A-Za-z]:\\\\/u);
  } finally {
    await leaky.close();
  }
});

test("export 的 PUBLIC_IMAGE_URL_ERROR 返回 422 与逐项 issues", async () => {
  const harness = await startHarness();
  try {
    const draft = createValidDraft();
    draft.skus[0].image.url = "http://res.cloudinary.com/demo/image/upload/sample.jpg";
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [draft] }),
    });
    assert.equal(response.status, 422);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.code, "PUBLIC_IMAGE_URL_ERROR");
    assert.ok(payload.errors.some((issue) => issue.code === "https_required" && issue.path.startsWith("drafts.0.skus.")));
  } finally {
    await harness.close();
  }

  const unreachable = await startHarness({
    verifyImage: async () => {
      throw new Error("远程图片请求失败。");
    },
  });
  try {
    const response = await fetch(`${unreachable.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [createValidDraft()] }),
    });
    assert.equal(response.status, 422);
    const payload = await response.json();
    assert.equal(payload.code, "PUBLIC_IMAGE_URL_ERROR");
    assert.ok(payload.errors.some((issue) => issue.code === "public_image_unreachable"));
  } finally {
    await unreachable.close();
  }
});

test("export 的 OUTPUT_SIZE_ERROR 由体积上限触发并返回 422", async () => {
  const harness = await startHarness({ maxOutputBytes: 100 });
  try {
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [createValidDraft()] }),
    });
    assert.equal(response.status, 422);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    // 写入器抛 TEMU_WORKBOOK_TOO_LARGE，对外仍是被吸收侧的 OUTPUT_SIZE_ERROR 契约。
    assert.equal(payload.code, "OUTPUT_SIZE_ERROR");
    assert.match(payload.error, /超过 100 字节上限/u);
  } finally {
    await harness.close();
  }
  assert.equal(TEMU_WORKBENCH_LIMITS.maxOutputBytes, 3_000_000);
});

test("export 行数超限返回 422 而不是模板类的 503", async () => {
  const harness = await startHarness({ maxRows: 2 });
  try {
    const draft = createValidDraft();
    assert.equal(draft.skus.length, 4);
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [draft] }),
    });
    assert.equal(response.status, 422);
    const payload = await response.json();
    assert.equal(payload.code, "TEMU_ROW_LIMIT_EXCEEDED");
    assert.match(payload.error, /超过 2 行上限/u);
  } finally {
    await harness.close();
  }
});

test("export 在模板不可用时返回 503，且 drafts 非数组返回 400", async () => {
  const broken = await startHarness({
    verifyTemplate: async () => {
      const error = new Error("Temu 模板身份校验失败（SHA-256 不匹配）。");
      error.code = "TEMU_WORKBOOK_INVALID";
      throw error;
    },
  });
  try {
    const response = await fetch(`${broken.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [createValidDraft()] }),
    });
    assert.equal(response.status, 503);
    const payload = await response.json();
    assert.equal(payload.ok, false);
    assert.equal(payload.error, "Temu 模板身份校验失败（SHA-256 不匹配）。");
  } finally {
    await broken.close();
  }

  const harness = await startHarness();
  try {
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: "第一个商品" }),
    });
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error, "drafts 必须是商品草稿数组");
  } finally {
    await harness.close();
  }
});

test("声明长度超过上限的请求体一个字节都不读就返回 413", async () => {
  const recorder = createRecordingJsonBodyReader();
  const keepAliveAgent = new Agent({ keepAlive: true, maxSockets: 1 });
  let verifyCalls = 0;
  const harness = await startHarness({
    readJsonBody: recorder.readJsonBody,
    verifyImage: async (url) => {
      verifyCalls += 1;
      return squareImage(String(url));
    },
  });
  try {
    const chunks = [Buffer.from('{"url":"'), Buffer.alloc(1024 * 1024, 0x61), Buffer.from('"}')];
    const declaredBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
    const verify = await rawPost(harness.baseUrl, TEMU_WORKBENCH_ROUTES.assetsVerify, chunks, keepAliveAgent, declaredBytes);
    assert.equal(verify.status, 413);
    assert.equal(JSON.parse(verify.text).error, "请求内容过大");
    assert.equal(verifyCalls, 0);
    // 「拒绝」而不是「缓冲后拒绝」的最强形式：读取器根本没被调用过。
    assert.equal(recorder.calls.length, 0, "超限请求体不得进入读取器");

    // 同一条 keep-alive 连接随后仍能正常服务：413 之后 socket 没被销毁，
    // 未读的请求体由 Node 自己 _dump() 掉。
    const ok = await rawPost(
      harness.baseUrl,
      TEMU_WORKBENCH_ROUTES.assetsVerify,
      [Buffer.from(JSON.stringify({ url: "https://res.cloudinary.com/demo/image/upload/sample.jpg" }))],
      keepAliveAgent,
    );
    assert.equal(ok.status, 200);
    assert.equal(recorder.calls.at(-1).maxBytes, 64 * 1024);

    // 导出路径的上限是 8 MiB，同一个读取器把上限逐字传下去。
    const exportResponse = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [createValidDraft()] }),
    });
    assert.equal(exportResponse.status, 200);
    assert.equal(recorder.calls.at(-1).maxBytes, 8 * 1024 * 1024);
  } finally {
    keepAliveAgent.destroy();
    await harness.close();
  }
});

test("分块请求体读到上限即拒：413，且工作不被启动", async () => {
  // 分块传输没有可预判的 Content-Length，只能依赖读取器的上限。此处直接调 handleRequest，
  // 不经真实 socket：server.mjs 的 readJsonBody 从 for-await 里抛异常会销毁请求流连带 socket，
  // 那条链路上的客户端可见性由运行时决定，而路由自己的行为必须是确定的。
  let workbookCalls = 0;
  let verifyCalls = 0;
  const recorded = [];
  const routes = createTemuWorkbenchRoutes({
    listManifests: async () => [studioManifest()],
    outputDir: tmpdir(),
    resolveSafeFile,
    serveFile,
    readJsonBody: async (_request, { maxBytes } = {}) => {
      recorded.push(maxBytes);
      const error = new Error("JSON 请求体超过允许大小。");
      error.code = "PAYLOAD_TOO_LARGE";
      throw error;
    },
    verifyTemplate: async () => ({ sha256: "A".repeat(64), sheetName: "导入模板", exampleSheetName: "导入示例", columnCount: 51 }),
    buildWorkbook: async () => {
      workbookCalls += 1;
      return { buffer: Buffer.alloc(10), issueSheetName: null, rowCount: 1, issueCount: 0, issues: [] };
    },
    verifyImage: async (url) => {
      verifyCalls += 1;
      return squareImage(String(url));
    },
  });

  const exportResult = await captureRoute(routes, "POST", TEMU_WORKBENCH_ROUTES.export);
  assert.equal(exportResult.statusCode, 413);
  assert.deepEqual(exportResult.json(), { ok: false, error: "请求内容过大" });
  assert.equal(workbookCalls, 0);

  const verifyResult = await captureRoute(routes, "POST", TEMU_WORKBENCH_ROUTES.assetsVerify);
  assert.equal(verifyResult.statusCode, 413);
  assert.equal(verifyCalls, 0);

  assert.deepEqual(recorded, [8 * 1024 * 1024, 64 * 1024]);

  // 畸形 JSON 走同一条读取失败通道，但必须是 400 而不是 413。
  const malformed = createTemuWorkbenchRoutes({
    listManifests: async () => [],
    outputDir: tmpdir(),
    resolveSafeFile,
    serveFile,
    readJsonBody: async () => JSON.parse("{"),
    verifyTemplate: async () => ({ sha256: "A".repeat(64), sheetName: "导入模板", exampleSheetName: "导入示例", columnCount: 51 }),
  });
  const malformedResult = await captureRoute(malformed, "POST", TEMU_WORKBENCH_ROUTES.export);
  assert.equal(malformedResult.statusCode, 400);
  assert.equal(malformedResult.json().error, "请求 JSON 无效");
});

test("serverless 运行时下所有分支在处理器之前早退", async () => {
  let listCalls = 0;
  let templateChecks = 0;
  let serverless = true;
  const harness = await startHarness({
    isServerlessRuntime: () => serverless,
    listManifests: async () => {
      listCalls += 1;
      return [studioManifest()];
    },
    verifyTemplate: async () => {
      templateChecks += 1;
      return { sha256: "A".repeat(64), sheetName: "导入模板", exampleSheetName: "导入示例", columnCount: 51 };
    },
  });
  try {
    const health = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.health}`, { cache: "no-store" });
    assert.equal(health.status, 501);
    assert.deepEqual(await health.json(), {
      ok: false,
      code: "unsupported_runtime_capability",
      runtime: "serverless",
      method: "GET",
      path: TEMU_WORKBENCH_ROUTES.health,
      message: "Temu 上品工作台需要本地服务运行时。",
      reason: "",
    });

    const exportResponse = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [createValidDraft()] }),
    });
    assert.equal(exportResponse.status, 501);
    const exportPayload = await exportResponse.json();
    assert.equal(exportPayload.code, "unsupported_runtime_capability");
    assert.equal(exportPayload.method, "POST");
    assert.equal(exportPayload.path, TEMU_WORKBENCH_ROUTES.export);

    const sets = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.studioSets}`, { cache: "no-store" });
    assert.equal(sets.status, 501);
    assert.equal(listCalls, 0, "守卫必须在任何处理器之前返回");
    assert.equal(templateChecks, 0);

    // 同一个实例在本地运行时下照常工作：守卫读的是注入的取值函数，
    // 因为 server.mjs 的 isServerlessRuntime 是 listen 之后才赋值的 let。
    serverless = false;
    const local = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.studioSets}`, { cache: "no-store" });
    assert.equal(local.status, 200);
    assert.equal(listCalls, 1);
  } finally {
    await harness.close();
  }
});

test("/api/temu/ 下的未知路径与错误方法返回 404 信封", async () => {
  const harness = await startHarness();
  try {
    const unknown = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_PATH_PREFIX}drafts`, { cache: "no-store" });
    assert.equal(unknown.status, 404);
    assert.deepEqual(await unknown.json(), { ok: false, error: "未找到请求资源" });

    const wrongMethod = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.health}`, { method: "POST" });
    assert.equal(wrongMethod.status, 404);

    // /vendor/lucide.js 分支已随图标烘焙一起删除。
    const vendor = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_PATH_PREFIX}vendor/lucide.js`, { cache: "no-store" });
    assert.equal(vendor.status, 404);
  } finally {
    await harness.close();
  }
});

test("工厂缺少注入的协作者时立刻失败关闭", () => {
  assert.throws(() => createTemuWorkbenchRoutes(), TypeError);
  assert.throws(
    () => createTemuWorkbenchRoutes({ listManifests: async () => [], resolveSafeFile, serveFile, readJsonBody: async () => ({}) }),
    /outputDir/u,
  );
  assert.throws(
    () => createTemuWorkbenchRoutes({ outputDir: tmpdir(), resolveSafeFile, serveFile, readJsonBody: async () => ({}) }),
    /listManifests/u,
  );
});

test("SKU 矩阵规模只影响行数，不影响单飞锁与信封形状", async () => {
  const harness = await startHarness();
  try {
    const draft = createValidDraft();
    draft.variants = { name1: "颜色", values1: ["白", "灰", "蓝"], name2: "", values2: [] };
    draft.skus = generateSkuMatrix(draft).map((sku, index) => ({
      ...sku,
      skuCode: `BOX-001-M${index + 1}`,
      image: { id: `m${index}`, name: "m.jpg", url: "https://res.cloudinary.com/demo/image/upload/sample.jpg", width: 1200, height: 1200, status: "verified" },
    }));
    const response = await fetch(`${harness.baseUrl}${TEMU_WORKBENCH_ROUTES.export}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: [draft] }),
    });
    assert.equal(response.status, 200);
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await response.arrayBuffer()));
    assert.deepEqual(workbook.worksheets.map((sheet) => sheet.name), ["导入模板", "导入示例"]);
    assert.equal(workbook.getWorksheet("导入模板").getCell("K4").value, "BOX-001-M3");
  } finally {
    await harness.close();
  }
});
