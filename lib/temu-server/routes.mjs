// Temu 上品工作台的 /api/temu/* 路由模块。
//
// 这是被吸收项目 src/server.mjs 里 6 个分支的移植体，改成一个工厂：协作者全部注入，
// 因此本模块不 import server.mjs、也不自带 http 服务器，可以在裸 http.createServer 上测试。
//
// 与被吸收侧的差异（逐条都有据）：
// - /vendor/lucide.js 分支删除：图标已由 scripts/build-temu-lucide-icons.mjs 烘焙成
//   lib/temu/lucide-icon-nodes.mjs，运行期不再有 node_modules/lucide 可服务。
// - securityHeaders() 不移植：其 x-frame-options: DENY 与 frame-ancestors 'none' 会禁掉
//   本设计所需的同源 iframe，script-src 'self' 还会破坏 Studio 现有的内联脚本。
//   只保留其中与框架无关、纯保护性的 x-content-type-options: nosniff。
// - 模板状态每请求重算：被吸收侧在 createLocalServer 里算一次就再不刷新，模板文件被替换后
//   它会一直汇报旧结论。
// - version 改读本仓库 package.json（被吸收侧那份随目录一起删除）。
// - 数据源改为进程内 listManifests()，整个回环 HTTP 传输层已在 studio-set-adapter.mjs 中删除。
// - 单飞锁只属于本模块实例，绝不覆盖 Studio 自己的 /api/creation/sets/export-temu-excel 批量路径。
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import { buildUnsupportedRuntimeCapabilityPayload } from "../api-contract.mjs";
import { TEMU_EXPORT_LIMITS } from "../creation-temu-export.mjs";
import { sanitizeCreationTemuPreflightText } from "../creation-temu-preflight.mjs";
import { buildTemuWorkbookBuffer, verifyTemuTemplate } from "../creation-temu-workbook.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "../temu/template-headers.mjs";
import { buildTemuDraftPlan } from "./draft-plan.mjs";
import { verifyDraftPublicImages, verifyDraftsPublicImages, verifyRemoteImageByUrl } from "./public-image-verifier.mjs";
import { TEMU_STUDIO_SET_LIMIT, buildStudioSetIndex, findStudioImageTarget } from "./studio-set-adapter.mjs";

// 所有非 GET 路由必须落在 /api/ 之下：本地服务的 CSRF 检查（sec-fetch-site 与 Origin）
// 只覆盖 /api/ 前缀，`/temu/export` 这类路径会整段跳过该检查。
export const TEMU_WORKBENCH_PATH_PREFIX = "/api/temu/";

export const TEMU_WORKBENCH_ROUTES = Object.freeze({
  health: `${TEMU_WORKBENCH_PATH_PREFIX}health`,
  studioSets: `${TEMU_WORKBENCH_PATH_PREFIX}studio/sets`,
  // 预览 URL 契约的单一声明，子文档与适配器用的是同一个常量。
  studioImage: TEMU_STUDIO_IMAGE_PATH,
  assetsVerify: `${TEMU_WORKBENCH_PATH_PREFIX}assets/verify`,
  export: `${TEMU_WORKBENCH_PATH_PREFIX}export`,
});

export const TEMU_WORKBENCH_LIMITS = Object.freeze({
  // 被吸收侧的两个请求上限逐字保留。
  exportRequestBytes: 8 * 1024 * 1024,
  verifyRequestBytes: 64 * 1024,
  // 被吸收侧 MAX_XLSX_BYTES。只有工作台路径传这个上限，批量路径不传（保持无上限）。
  maxOutputBytes: 3_000_000,
  // 子文档有两处独立调用 /api/temu/studio/sets（轮播图追加与导入对话框），彼此没有共享缓存；
  // 图片路由也要靠同一份索引寻址。listManifests() 每次要读全部 manifest 文件，
  // 因此加一个短 TTL 进程内缓存，让一次开图的连续请求只付一次磁盘代价。
  studioSetsCacheMs: 3_000,
  maxRows: TEMU_EXPORT_LIMITS.maxRows,
});

const OUTPUT_PATH_PREFIX = "/output/";
const PACKAGE_JSON_PATH = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "package.json");
const XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export function matchesTemuWorkbenchPath(pathname) {
  return String(pathname || "").startsWith(TEMU_WORKBENCH_PATH_PREFIX);
}

let cachedAppVersion = null;

// 被吸收侧在模块顶层用 await readFile 读版本号，读不到就整个服务起不来。
// 这里改成惰性读取并容错：版本号只用于页脚展示，不值得让整条路由挂掉。
export async function readStudioAppVersion() {
  if (cachedAppVersion !== null) return cachedAppVersion;
  try {
    const parsed = JSON.parse(await readFile(PACKAGE_JSON_PATH, "utf8"));
    cachedAppVersion = typeof parsed.version === "string" ? parsed.version : "";
  } catch {
    cachedAppVersion = "";
  }
  return cachedAppVersion;
}

function safeText(value) {
  return sanitizeCreationTemuPreflightText(value);
}

// 工作台路径传 includeIssueSheet: false，写入器里 :118 那处 sanitizeTemuCellText 清理随之不执行，
// 因此任何进 JSON 响应的问题清单都必须在这里自己过一遍，否则本地绝对路径会漏给前端。
function safeIssues(issues) {
  if (!Array.isArray(issues)) return [];
  return issues.map((issue) => {
    if (!issue || typeof issue !== "object") return { message: safeText(issue) };
    const sanitized = { ...issue };
    for (const key of ["message", "suggestion", "source", "productName", "skuName", "field", "label"]) {
      if (key in sanitized) sanitized[key] = safeText(sanitized[key]);
    }
    return sanitized;
  });
}

function sendJson(response, statusCode, payload) {
  const body = JSON.stringify(payload);
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
  });
  response.end(body);
}

function exportFilename(now) {
  const timestamp = now.toISOString().replace(/[-:]/gu, "").replace(/\.\d{3}Z$/u, "Z");
  return `temu-import-${timestamp}.xlsx`;
}

function bodyReadFailure(error) {
  if (error?.code === "PAYLOAD_TOO_LARGE") return { statusCode: 413, message: "请求内容过大" };
  if (error instanceof SyntaxError) return { statusCode: 400, message: "请求 JSON 无效" };
  return null;
}

// 先看 Content-Length 再决定要不要读，比读到上限才中断更早也更干净，实测差别是可见的：
// server.mjs 的 readJsonBody 用 `for await (const chunk of request)`，从循环里抛异常会让异步迭代器
// 调 request.destroy()，Node 随即销毁 socket，正在写入的客户端读到的是 ECONNRESET 而不是这条 413。
// 而一个字节都没读过的请求会走 Node 自己的 req._dump()（_http_server 的 resOnFinish 里那条
// `if (!req._consuming …)` 分支），连接干净收尾、413 可靠送达。
// 分块传输（无 Content-Length）没有可预判的长度，仍然只能依赖读取器的上限。
function declaredBodyOverflow(request, maxBytes) {
  const declared = Number(request?.headers?.["content-length"]);
  return Number.isFinite(declared) && declared > maxBytes;
}

function statusCodeOf(error) {
  const statusCode = Number(error?.statusCode);
  return Number.isInteger(statusCode) && statusCode >= 400 && statusCode <= 599 ? statusCode : 500;
}

export function createTemuWorkbenchRoutes({
  // 必需协作者：全部由 server.mjs 注入，因此本模块不认识 server.mjs。
  listManifests,
  outputDir,
  resolveSafeFile,
  serveFile,
  readJsonBody,
  // 布尔或取值函数。server.mjs 的 isServerlessRuntime 是在 listen 之后才赋值的 let，
  // 所以集成时必须传函数形式（() => isServerlessRuntime），否则守卫永远读到 false。
  isServerlessRuntime = false,
  // 以下为可覆盖项：默认即生产实现，测试与调参从这里进入。
  appVersion = null,
  verifyTemplate = verifyTemuTemplate,
  buildDraftPlan = buildTemuDraftPlan,
  buildWorkbook = buildTemuWorkbookBuffer,
  verifyImage = verifyRemoteImageByUrl,
  setLimit = TEMU_STUDIO_SET_LIMIT,
  setsCacheMs = TEMU_WORKBENCH_LIMITS.studioSetsCacheMs,
  maxOutputBytes = TEMU_WORKBENCH_LIMITS.maxOutputBytes,
  maxRows = TEMU_WORKBENCH_LIMITS.maxRows,
  exportRequestBytes = TEMU_WORKBENCH_LIMITS.exportRequestBytes,
  verifyRequestBytes = TEMU_WORKBENCH_LIMITS.verifyRequestBytes,
  now = () => new Date(),
} = {}) {
  for (const [name, value] of Object.entries({ listManifests, resolveSafeFile, serveFile, readJsonBody })) {
    if (typeof value !== "function") {
      throw new TypeError(`createTemuWorkbenchRoutes 需要注入 ${name} 函数。`);
    }
  }
  if (typeof outputDir !== "string" || !outputDir) {
    throw new TypeError("createTemuWorkbenchRoutes 需要注入 outputDir 路径。");
  }

  const serverless = typeof isServerlessRuntime === "function" ? isServerlessRuntime : () => Boolean(isServerlessRuntime);
  // 单飞锁是实例内的，只保护本模块的 /api/temu/export。
  // Studio 自己的批量导出路由没有锁，也绝不能被这把锁串行化。
  let exportBusy = false;
  let cachedIndex = null;
  let cachedIndexExpiresAt = 0;
  let indexInFlight = null;

  async function loadStudioIndex() {
    if (cachedIndex && Date.now() < cachedIndexExpiresAt) return cachedIndex;
    if (indexInFlight) return indexInFlight;
    const pending = (async () => {
      const index = buildStudioSetIndex(await listManifests(), { limit: setLimit });
      cachedIndex = index;
      cachedIndexExpiresAt = Date.now() + Math.max(0, Number(setsCacheMs) || 0);
      return index;
    })();
    indexInFlight = pending;
    try {
      return await pending;
    } finally {
      if (indexInFlight === pending) indexInFlight = null;
    }
  }

  async function handleHealth(response) {
    const version = appVersion ?? await readStudioAppVersion();
    let template;
    try {
      // 每请求重算：模板文件在服务运行期间被替换过，boot 期快照就是错的。
      const verified = await verifyTemplate();
      template = { compatible: true, message: "模板表头兼容", ...verified };
    } catch (error) {
      template = { compatible: false, code: error?.code || "", message: safeText(error?.message || "模板不可用") };
    }
    return sendJson(response, template.compatible ? 200 : 503, { ok: template.compatible, template, version });
  }

  async function handleStudioSets(response) {
    try {
      const index = await loadStudioIndex();
      return sendJson(response, 200, { ok: true, sets: index.sets });
    } catch (error) {
      return sendJson(response, statusCodeOf(error) === 500 ? 502 : statusCodeOf(error), {
        ok: false,
        code: error?.code || "TEMU_STUDIO_SETS_ERROR",
        error: safeText(error?.message || "套图记录读取失败"),
      });
    }
  }

  async function handleStudioImage(request, response, url) {
    const setId = url.searchParams.get("setId");
    const itemId = url.searchParams.get("itemId");
    // 未命中不重建索引：预览 URL 本来就是 /api/temu/studio/sets 那次响应生成的，
    // 该次响应已经建好索引；TTL 过期也由 loadStudioIndex 自己重建。
    // 真正未命中的只有索引外的 ID，此时重建全部 manifest 只是让任意 ID 探测能放大磁盘读取。
    const target = findStudioImageTarget(await loadStudioIndex(), setId, itemId);
    if (!target) {
      return sendJson(response, 404, {
        ok: false,
        code: "TEMU_STUDIO_IMAGE_NOT_FOUND",
        error: "未找到可导入的套图图片",
      });
    }
    // 适配器已经做过 /output/ 前缀校验并剥掉了 ?v= cache-buster，这里再确认一次：
    // 索引与本分支之间没有别的写入者，但读文件这一步值得自带前缀判据。
    if (!target.upstreamPath.startsWith(OUTPUT_PATH_PREFIX)) {
      return sendJson(response, 404, {
        ok: false,
        code: "TEMU_STUDIO_IMAGE_NOT_FOUND",
        error: "未找到可导入的套图图片",
      });
    }
    const filePath = resolveSafeFile(outputDir, target.upstreamPath.slice(OUTPUT_PATH_PREFIX.length - 1));
    if (!filePath) {
      return sendJson(response, 403, { ok: false, code: "TEMU_STUDIO_IMAGE_FORBIDDEN", error: "套图图片路径不被受理" });
    }
    try {
      return await serveFile(request, response, filePath);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return sendJson(response, 404, {
          ok: false,
          code: "TEMU_STUDIO_IMAGE_NOT_FOUND",
          error: "套图图片文件已不存在",
        });
      }
      throw error;
    }
  }

  async function handleAssetsVerify(request, response) {
    if (declaredBodyOverflow(request, verifyRequestBytes)) {
      return sendJson(response, 413, { ok: false, error: "请求内容过大" });
    }
    let body;
    try {
      body = await readJsonBody(request, { maxBytes: verifyRequestBytes });
    } catch (error) {
      const failure = bodyReadFailure(error);
      if (!failure) throw error;
      return sendJson(response, failure.statusCode, { ok: false, error: failure.message });
    }
    try {
      const asset = await verifyImage(body?.url);
      return sendJson(response, 200, { ok: true, asset });
    } catch (error) {
      return sendJson(response, 422, { ok: false, error: safeText(error?.message || "图片检查失败") });
    }
  }

  function sendWorkbook(response, result) {
    const filename = exportFilename(now());
    response.writeHead(200, {
      "Content-Type": XLSX_CONTENT_TYPE,
      "Content-Length": result.buffer.byteLength,
      // 两种文件名形式与 Studio 自己的批量导出分支同形：老浏览器读 filename，
      // 支持 RFC 5987 的读 filename*。
      "Content-Disposition": `attachment; filename="${filename}"; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff",
      // 二进制响应装不下问题清单，而 includeIssueSheet: false 时写入器仍会把
      // 单元格改写类 issue 回给调用方（公式字面量标记、32767 截断）。这两个计数头
      // 与批量导出分支同名，至少让「有 N 条 issue 被丢掉」是可观测的，而不是无声消失。
      "X-Temu-Export-Row-Count": result.rowCount,
      "X-Temu-Export-Issue-Count": result.issueCount,
    });
    response.end(result.buffer);
  }

  async function handleExport(request, response) {
    // 体积预判在模板校验与单飞锁之前：超限请求不该先占住锁再被拒。
    if (declaredBodyOverflow(request, exportRequestBytes)) {
      return sendJson(response, 413, { ok: false, error: "请求内容过大" });
    }
    let templateMessage = "";
    try {
      await verifyTemplate();
    } catch (error) {
      templateMessage = safeText(error?.message || "Temu 标准模板不可用");
    }
    if (templateMessage) return sendJson(response, 503, { ok: false, error: templateMessage });
    if (exportBusy) return sendJson(response, 409, { ok: false, error: "已有导出任务正在运行" });
    exportBusy = true;
    try {
      let body;
      try {
        body = await readJsonBody(request, { maxBytes: exportRequestBytes });
      } catch (error) {
        const failure = bodyReadFailure(error);
        if (!failure) throw error;
        return sendJson(response, failure.statusCode, { ok: false, error: failure.message });
      }
      if (Array.isArray(body?.embeddedImages) && body.embeddedImages.length) {
        return sendJson(response, 422, {
          ok: false,
          code: "EMBEDDED_IMAGES_UNSUPPORTED",
          error: "当前导出只接受公网图片 URL，请刷新页面后重试",
        });
      }

      const batchRequest = Boolean(body) && Object.hasOwn(body, "drafts");
      let drafts;
      if (batchRequest) {
        if (!Array.isArray(body.drafts)) {
          return sendJson(response, 400, { ok: false, error: "drafts 必须是商品草稿数组" });
        }
        drafts = (await verifyDraftsPublicImages(body.drafts, { verifyImage })).drafts;
      } else {
        drafts = (await verifyDraftPublicImages(body?.draft, { verifyImage })).draft;
      }

      const plan = buildDraftPlan({ drafts });
      if (plan.rows.length > maxRows) {
        // 被吸收侧完全没有行数上限，工作台路径是第一条会撞上写入器 maxRows 的路径。
        // 写入器自己抛的是 TEMU_WORKBOOK_INVALID（与模板损坏同码），那会被归成 503；
        // 行数超限是调用方可修的输入问题，因此在这里提前判成 422 并给独立代码。
        return sendJson(response, 422, {
          ok: false,
          code: "TEMU_ROW_LIMIT_EXCEEDED",
          error: `导出数据行 ${plan.rows.length} 行，超过 ${maxRows} 行上限，请拆分后重试`,
        });
      }

      const result = await buildWorkbook({
        plan,
        // 工作台路径产出商家实际上传成功过的 2 sheet 形态（导入模板、导入示例）。
        includeIssueSheet: false,
        maxOutputBytes,
      });
      return sendWorkbook(response, result);
    } catch (error) {
      if (error?.code === "VALIDATION_ERROR") {
        return sendJson(response, 422, {
          ok: false,
          error: safeText(error.message),
          errors: safeIssues(error.validation?.errors),
          warnings: safeIssues(error.validation?.warnings),
        });
      }
      if (error?.code === "PUBLIC_IMAGE_URL_ERROR") {
        return sendJson(response, 422, {
          ok: false,
          code: error.code,
          error: safeText(error.message),
          errors: safeIssues(error.issues),
        });
      }
      if (error?.code === "TEMU_WORKBOOK_TOO_LARGE") {
        // 对外仍是被吸收侧的 OUTPUT_SIZE_ERROR：子文档按这个代码分辨体积失败。
        return sendJson(response, 422, { ok: false, code: "OUTPUT_SIZE_ERROR", error: safeText(error.message) });
      }
      if (error?.code === "TEMU_WORKBOOK_INVALID") {
        return sendJson(response, 503, { ok: false, code: error.code, error: safeText(error.message) });
      }
      throw error;
    } finally {
      exportBusy = false;
    }
  }

  async function handleRequest(request, response, urlInput) {
    const url = urlInput || new URL(request.url || "/", "http://localhost");
    const method = String(request.method || "GET").toUpperCase();

    // serverless 早退守卫必须在任何处理器之前：isServerlessRuntime 会让 server.mjs 整段跳过
    // 授权，而工作台依赖本地文件系统与本地模板，在该运行时下不成立。
    // 登记进 lib/api-contract.mjs 只服务客户端契约，运行期不构成任何守卫
    // （该模块没有被 server.mjs 在运行期引用）。
    if (serverless()) {
      return sendJson(
        response,
        501,
        buildUnsupportedRuntimeCapabilityPayload("serverless", method, url.pathname, "Temu 上品工作台需要本地服务运行时。"),
      );
    }

    if (method === "GET" && url.pathname === TEMU_WORKBENCH_ROUTES.health) {
      return handleHealth(response);
    }
    if (method === "GET" && url.pathname === TEMU_WORKBENCH_ROUTES.studioSets) {
      return handleStudioSets(response);
    }
    if (method === "GET" && url.pathname === TEMU_WORKBENCH_ROUTES.studioImage) {
      return handleStudioImage(request, response, url);
    }
    if (method === "POST" && url.pathname === TEMU_WORKBENCH_ROUTES.assetsVerify) {
      return handleAssetsVerify(request, response);
    }
    if (method === "POST" && url.pathname === TEMU_WORKBENCH_ROUTES.export) {
      return handleExport(request, response);
    }

    return sendJson(response, 404, { ok: false, error: "未找到请求资源" });
  }

  return {
    handleRequest,
    matchesTemuWorkbenchPath,
    // 集成后若有别处改动了套图记录，可主动作废缓存；正常路径靠 TTL 到期即可。
    invalidateStudioSets() {
      cachedIndex = null;
      cachedIndexExpiresAt = 0;
    },
  };
}
