// 上品工作台导出前的公网图片校验：逐张确认草稿里的轮播图、外包装图与 SKU 图确实可被
// 平台公开访问，并把实测尺寸回写进草稿。
//
// 签名适配（务必留意）：本模块以裸字符串调用 verifyImage(url) 并期望回
// { url, width, height, bytes, format }。lib/creation-temu-remote-images.mjs 有两个导出：
//   - verifyCreationTemuRemoteImages（复数）收 { entries: [...] } 并回 keyed map 加 issues 数组，形状不兼容；
//   - verifyCreationTemuRemoteImage（单数）回的正是上面那个形状，但收的是选项对象。
// 因此注入的是单数版适配器。由此带来两条必须知情的后果：
//   1. 去重与并发仍归本模块（下面自己去重成 uniqueUrls，并跑上限 4 的池），
//      复数版宣传的「去重 + 10 并发」在这条路径上不会生效；
//   2. 适配器不传 role，而 assertSquareDimensions 只对 sku/material 角色触发，
//      所以正方校验来自本模块末尾那处自己的检查。
import { inspectPublicUrl, normalizeDraft } from "../temu/domain.mjs";
import { verifyCreationTemuRemoteImage } from "../creation-temu-remote-images.mjs";

export function verifyRemoteImageByUrl(url) {
  return verifyCreationTemuRemoteImage({ url });
}

export function draftImageEntries(draft) {
  return [
    ...draft.assets.carousel.map((asset, index) => ({ path: `assets.carousel.${index}`, label: `轮播图 ${index + 1}`, asset, role: "carousel" })),
    ...draft.assets.packaging.map((asset, index) => ({ path: `assets.packaging.${index}`, label: `外包装图 ${index + 1}`, asset, role: "packaging" })),
    ...draft.skus.map((sku, index) => ({ path: `skus.${index}.image`, label: `SKU ${index + 1} 图片`, asset: sku.image, role: "sku" })),
  ];
}

function publicImageError(issues) {
  const error = new Error(issues[0]?.message || "公网图片 URL 校验失败");
  error.code = "PUBLIC_IMAGE_URL_ERROR";
  error.statusCode = 422;
  error.issues = issues;
  return error;
}

export async function verifyDraftPublicImages(input, options = {}) {
  const verifyImage = options.verifyImage || verifyRemoteImageByUrl;
  const concurrency = Math.max(1, Math.min(4, Number(options.concurrency) || 4));
  const draft = normalizeDraft(input);
  const entries = draftImageEntries(draft);
  const issues = [];
  const uniqueUrls = new Map();

  for (const entry of entries) {
    const inspection = inspectPublicUrl(entry.asset?.url);
    if (!inspection.valid) {
      issues.push({ path: entry.path, code: "public_image_url_required", message: `${entry.label}缺少有效公网 URL：${inspection.error}` });
      continue;
    }
    if (new URL(inspection.url).protocol !== "https:") {
      issues.push({ path: entry.path, code: "https_required", message: `${entry.label}必须使用 HTTPS 图片 URL` });
      continue;
    }
    entry.requestUrl = inspection.url;
    if (!uniqueUrls.has(inspection.url)) uniqueUrls.set(inspection.url, null);
  }
  if (issues.length) throw publicImageError(issues);

  const urls = [...uniqueUrls.keys()];
  let nextIndex = 0;
  async function worker() {
    while (nextIndex < urls.length) {
      const url = urls[nextIndex++];
      try {
        const verified = await verifyImage(url);
        if (!verified?.url || new URL(verified.url).protocol !== "https:") {
          throw new Error("最终图片地址不是 HTTPS");
        }
        uniqueUrls.set(url, verified);
      } catch (error) {
        uniqueUrls.set(url, { error: error.message || "图片无法访问" });
      }
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, urls.length) }, worker));

  for (const entry of entries) {
    const verified = uniqueUrls.get(entry.requestUrl);
    if (verified?.error) {
      issues.push({ path: entry.path, code: "public_image_unreachable", message: `${entry.label}无法公开访问：${verified.error}` });
      continue;
    }
    Object.assign(entry.asset, {
      url: verified.url,
      width: verified.width,
      height: verified.height,
      bytes: verified.bytes,
      format: verified.format,
      status: "verified",
      error: "",
    });
    if (entry.role === "sku" && (verified.width <= 800 || verified.height <= 800 || verified.width !== verified.height)) {
      issues.push({ path: entry.path, code: "sku_image_dimensions", message: `${entry.label}必须为大于 800×800 的正方形` });
    }
  }
  if (issues.length) throw publicImageError(issues);
  return { draft, uniqueUrlCount: uniqueUrls.size, imageCount: entries.length };
}

export async function verifyDraftsPublicImages(inputs, options = {}) {
  const sourceDrafts = Array.isArray(inputs) ? inputs : [inputs];
  if (!sourceDrafts.length) {
    throw publicImageError([{ path: "drafts", code: "draft_required", message: "至少需要一个商品草稿" }]);
  }

  const verifyImage = options.verifyImage || verifyRemoteImageByUrl;
  const sharedVerifications = new Map();
  const batchOptions = {
    ...options,
    verifyImage(url) {
      if (!sharedVerifications.has(url)) {
        sharedVerifications.set(url, Promise.resolve().then(() => verifyImage(url)));
      }
      return sharedVerifications.get(url);
    },
  };
  const results = [];
  const issues = [];
  for (let index = 0; index < sourceDrafts.length; index += 1) {
    try {
      results.push(await verifyDraftPublicImages(sourceDrafts[index], batchOptions));
    } catch (error) {
      if (error.code !== "PUBLIC_IMAGE_URL_ERROR") throw error;
      issues.push(...error.issues.map((issue) => ({
        ...issue,
        path: `drafts.${index}.${issue.path}`,
        message: `商品 ${index + 1}：${issue.message}`,
      })));
    }
  }
  if (issues.length) throw publicImageError(issues);
  return {
    drafts: results.map((result) => result.draft),
    uniqueUrlCount: sharedVerifications.size,
    imageCount: results.reduce((sum, result) => sum + result.imageCount, 0),
  };
}
