// 把 Studio 套图 manifest 适配成 Temu 上品工作台消费的扁平摘要形状。
//
// 本模块是被吸收项目 src/studio-bridge.mjs 的「纯适配」那一半。整个传输层已删除：
// 进程内直接拿 creationSetStore.listManifests() 的数组，不再回环 HTTP 请求本机自身，
// 因此 normalizeStudioBaseUrl / fetchStudio / readLimitedBytes / loadSets / getImage、
// 128 MiB 图片快照 LRU、96 MiB 记录上限、全部 STUDIO_* 错误码与 IMAGE_STUDIO_URL
// 环境变量都不再存在。快照缓存在同进程下本就多余——渲染进程可直接读 /output/。
//
// 模块保持纯同步且无 I/O：输入是 manifest 数组，输出是摘要与图片目标索引。
// 读取套图记录与读取图片字节都由调用方（lib/temu-server/routes.mjs）负责。
import { TEMU_STUDIO_IMAGE_PATH } from "../temu/template-headers.mjs";

// 与被吸收侧 DEFAULT_RECORD_LIMIT 一致：按 updatedAt 倒序去重后只保留最近 50 条。
export const TEMU_STUDIO_SET_LIMIT = 50;

const OUTPUT_PATH_PREFIX = "/output/";
// 仅用于把 manifest 里的相对地址解析成 URL 以便逐段校验，不参与输出。
const PATH_RESOLUTION_BASE = "http://studio-set.invalid";
const IMAGE_SUFFIX_PATTERN = /(?:\.(?:avif|bmp|gif|jpe?g|png|webp))+$/iu;

const ID_MAX_LENGTH = 200;
// 原白名单 /^[A-Za-z0-9:_.-]{1,200}$/ 会静默丢弃含中文或空格的 itemId，
// 对应 SKU 的预览图随之无声消失。Studio 的 SKU itemId 形如
// `${slotIndex}-sku-${skuSubject.id}`，而 skuSubject.id 就是引用图文件名，
// 中文与空格是常态（实测 62 份真实 manifest 里有 14 个已完成项被原模式拒绝）。
//
// 因此改为黑名单：itemId 只做 URL 查询参数与 Map 键，从不参与文件路径拼接
// （文件路径走独立的 upstreamPath，且被 OUTPUT_PATH_PREFIX 校验），
// 所以真正需要挡的是路径分隔符、控制符与不可见的方向控制字符，以及超长输入。
// 字符类里挡掉两个路径分隔符（正斜杠与反斜杠，均写成转义形式），
// 再用 Cc/Cf 覆盖控制符与 BOM、双向覆盖等不可见格式字符，
// Zl/Zp 覆盖行与段分隔符。
const ID_FORBIDDEN_PATTERN = /[\p{Cc}\p{Cf}\p{Zl}\p{Zp}\/\\]/u;

const VISIBLE_ITEM_KINDS = ["carousel", "infographic-rebuild", "sku"];
const CAROUSEL_ITEM_KINDS = ["carousel", "infographic-rebuild"];

function cleanString(value, maxLength = 500) {
  return String(value ?? "").trim().slice(0, maxLength);
}

function cleanStringArray(value, maxItems = 100, maxLength = 180) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, maxItems).map((item) => cleanString(item, maxLength)).filter(Boolean);
}

export function cleanStudioId(value) {
  const id = value == null ? "" : String(value);
  if (!id || id.length > ID_MAX_LENGTH) return "";
  // 要求首尾无空白：既保留原模式「带空白的 ID 不受理」的意图，
  // 又不再牵连中间的合法空格（如 "SKU-卡其 (1).png"）。
  if (id !== id.trim()) return "";
  return ID_FORBIDDEN_PATTERN.test(id) ? "" : id;
}

export function stripStudioImageSuffix(value, maxLength = 500) {
  return cleanString(value, maxLength).replace(IMAGE_SUFFIX_PATTERN, "").trim();
}

export function parseStudioImageSize(value) {
  const match = cleanString(value, 64).match(/(\d{2,5})\s*[x×]\s*(\d{2,5})/iu);
  if (!match) return { width: null, height: null };
  return { width: Number(match[1]), height: Number(match[2]) };
}

export function parseStudioDimensions(value) {
  const text = cleanString(value, 240);
  const formats = [
    { pattern: /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm|厘米)(?![a-z])/giu, factor: 1 },
    { pattern: /(\d+(?:\.\d+)?)\s*(?:cm|厘米)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm|厘米)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:cm|厘米)(?![a-z])/giu, factor: 1 },
    { pattern: /(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)(?![a-z])/giu, factor: 0.1 },
    { pattern: /(\d+(?:\.\d+)?)\s*(?:mm|毫米)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(?:mm|毫米)(?![a-z])/giu, factor: 0.1 },
  ];
  const matches = formats.flatMap(({ pattern, factor }) => [...text.matchAll(pattern)].map((match) => ({ match, factor })));
  if (matches.length !== 1) return null;
  const { match, factor } = matches[0];
  const dimensions = match.slice(1, 4).map((item) => Number(item) * factor);
  if (dimensions.some((item) => !Number.isFinite(item) || item <= 0)) return null;
  return { lengthCm: dimensions[0], widthCm: dimensions[1], heightCm: dimensions[2] };
}

export function parseStudioWeight(value) {
  const matches = [...cleanString(value, 160).matchAll(/(\d+(?:\.\d+)?)\s*(?:g|克)(?![a-z])/giu)];
  if (matches.length !== 1) return null;
  const weight = Number(matches[0][1]);
  return Number.isFinite(weight) && weight > 0 ? weight : null;
}

function normalizeStudioLogisticsEstimate(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const source = cleanString(value.source, 20).toLowerCase();
  if (!["package", "product"].includes(source)) return null;
  const metrics = {};
  for (const key of ["lengthCm", "widthCm", "heightCm", "weightG"]) {
    const number = Number(value[key]);
    if (!Number.isFinite(number) || number <= 0) return null;
    metrics[key] = number;
  }
  return { source, ...metrics };
}

function chooseListingDraft(set) {
  const drafts = Array.isArray(set?.listingDrafts) ? set.listingDrafts.filter((draft) => draft && typeof draft === "object") : [];
  return drafts.find((draft) => draft.status === "completed") || drafts[0] || {};
}

function extractListingPackageEstimate(rawSet) {
  const listing = chooseListingDraft(rawSet);
  const dimensions = parseStudioDimensions(listing.packageDimensions);
  const weightG = parseStudioWeight(listing.packageWeight);
  if (!dimensions || !weightG) return null;
  return { source: "package", ...dimensions, weightG };
}

export function extractStudioLogisticsEstimate(rawSet) {
  const value = rawSet?.logisticsEstimate;
  if (value !== null && value !== undefined) return normalizeStudioLogisticsEstimate(value);
  return extractListingPackageEstimate(rawSet);
}

// 原实现返回 `${target.pathname}${target.search}`，在真实数据上是必然失败：
// 实测 62 份 manifest 的 531 条 imageUrl 全部带 `?v=<ISO 时间戳>` cache-buster（531/531），
// 而 Studio 的 resolveSafeFile 只做 decodeURIComponent + resolve，不识别查询串，
// 于是 `?v=…` 会被当成文件名的一部分，图片读取百分之百 ENOENT。
// 这里剥掉 query（连带 hash），只留 pathname，并保留 /output/ 前缀校验。
//
// pathname 保持百分号编码原样返回：Studio 的 /output/ 分支同样是把编码后的
// url.pathname 切掉前缀再交给 resolveSafeFile 解码，两边必须同形。
export function normalizeStudioOutputPath(value) {
  try {
    const target = new URL(cleanString(value, 4_096), PATH_RESOLUTION_BASE);
    // 只受理解析到本地基址的地址：manifest 里的相对路径落在这里，
    // 而 https://example.com/... 这类外链会换 origin，直接剔除。
    if (target.origin !== PATH_RESOLUTION_BASE) return "";
    // new URL 已归一化掉 ../ 段，因此前缀校验足以挡住越出 /output/ 的路径。
    if (!target.pathname.startsWith(OUTPUT_PATH_PREFIX)) return "";
    return target.pathname;
  } catch {
    return "";
  }
}

function imageSummary(setId, target) {
  return {
    itemId: target.itemId,
    name: target.name,
    displayName: stripStudioImageSuffix(target.name, 180),
    width: target.width,
    height: target.height,
    format: target.format,
    previewUrl: `${TEMU_STUDIO_IMAGE_PATH}?setId=${encodeURIComponent(setId)}&itemId=${encodeURIComponent(target.itemId)}`,
  };
}

function prepareImageTarget(item) {
  if (!item || item.status !== "completed") return null;
  const itemId = cleanStudioId(item.itemId || item.id);
  const upstreamPath = normalizeStudioOutputPath(item.imageUrl || item.thumbnailUrl);
  if (!itemId || !upstreamPath) return null;
  const { width, height } = parseStudioImageSize(item.actualSize || item.effectiveSize || item.size);
  return {
    itemId,
    itemKind: cleanString(item.itemKind, 40).toLowerCase(),
    name: cleanString(item.filename || item.title || `${itemId}.png`, 180),
    width,
    height,
    format: cleanString(item.format, 24).toLowerCase(),
    slotIndex: Number.isFinite(Number(item.slotIndex)) ? Number(item.slotIndex) : Number.MAX_SAFE_INTEGER,
    referenceImageNames: cleanStringArray(item.referenceImageNames, 40, 260),
    upstreamPath,
  };
}

function prepareStudioSet(rawSet) {
  if (!rawSet || typeof rawSet !== "object") return null;
  const setId = cleanStudioId(rawSet.setId || rawSet.id);
  if (!setId) return null;

  const targets = (Array.isArray(rawSet.items) ? rawSet.items : [])
    .map((item) => prepareImageTarget(item))
    .filter(Boolean)
    .sort((left, right) => left.slotIndex - right.slotIndex);
  const visibleTargets = targets.filter((item) => VISIBLE_ITEM_KINDS.includes(item.itemKind));
  // 可见图片的 itemId 是预览接口的唯一寻址键。一旦重复，代理哪一张就取决于
  // 插入顺序，因此整条记录判为不可信并整体剔除，而不是任选其一。
  const visibleTargetIds = new Set();
  if (visibleTargets.some((target) => {
    if (visibleTargetIds.has(target.itemId)) return true;
    visibleTargetIds.add(target.itemId);
    return false;
  })) return null;
  const carouselTargets = visibleTargets.filter((item) => CAROUSEL_ITEM_KINDS.includes(item.itemKind));
  const skuTargets = visibleTargets.filter((item) => item.itemKind === "sku");

  const subjects = (Array.isArray(rawSet.skuSubjects) ? rawSet.skuSubjects : [])
    .slice(0, 100)
    .map((subject) => ({
      id: cleanStudioId(subject?.id),
      title: stripStudioImageSuffix(subject?.title || subject?.id, 120),
      filenames: cleanStringArray(subject?.filenames, 40, 260),
    }))
    .filter((subject) => subject.title);

  // SKU 主体到图片的三级匹配，每个目标最多被认领一次：
  // 1) referenceImageNames 与主体 filenames 有交集；
  // 2) itemId 等于主体 id，或以 `-${id}` 结尾（Studio 的 `${slot}-sku-${id}` 形态）；
  // 3) 按位置兜底。
  const matchedTargetIds = new Set();
  const imageTargets = new Map(carouselTargets.map((target) => [target.itemId, target]));
  const skuSubjects = subjects.map((subject, index) => {
    const subjectFiles = new Set(subject.filenames);
    let target = skuTargets.find((item) =>
      !matchedTargetIds.has(item.itemId) && item.referenceImageNames.some((name) => subjectFiles.has(name))
    );
    if (!target && subject.id) {
      target = skuTargets.find((item) =>
        !matchedTargetIds.has(item.itemId) && (item.itemId === subject.id || item.itemId.endsWith(`-${subject.id}`))
      );
    }
    if (!target && skuTargets[index] && !matchedTargetIds.has(skuTargets[index].itemId)) target = skuTargets[index];
    if (target) {
      matchedTargetIds.add(target.itemId);
      imageTargets.set(target.itemId, target);
    }
    return {
      id: subject.id,
      title: subject.title,
      image: target ? imageSummary(setId, target) : null,
    };
  });

  const listing = chooseListingDraft(rawSet);
  const zhDisplay = listing.zhDisplay && typeof listing.zhDisplay === "object" && !Array.isArray(listing.zhDisplay)
    ? listing.zhDisplay
    : {};
  const summary = {
    setId,
    productName: cleanString(rawSet.productName, 200),
    status: cleanString(rawSet.status, 40),
    platformLabel: cleanString(rawSet.platformLabel || rawSet.platform, 80),
    targetLanguageLabel: cleanString(rawSet.targetLanguageLabel || rawSet.targetLanguage, 80),
    updatedAt: cleanString(rawSet.updatedAt || rawSet.createdAt, 80),
    listing: {
      status: cleanString(listing.status, 40),
      englishTitle: cleanString(listing.title, 500),
      chineseTitle: cleanString(zhDisplay.title, 500),
      englishDescription: cleanString(listing.description, 4_000),
      chineseDescription: cleanString(zhDisplay.description || rawSet.productDescription, 4_000),
    },
    logisticsEstimate: extractStudioLogisticsEstimate(rawSet),
    skuSubjects,
    carouselImages: carouselTargets.map((target) => imageSummary(setId, target)),
    availableImageCount: carouselTargets.length + skuSubjects.filter((subject) => subject.image).length,
  };

  return { summary, imageTargets };
}

export function summarizeStudioSet(rawSet) {
  return prepareStudioSet(rawSet)?.summary || null;
}

function updatedAtOrder(summary) {
  // 原实现写的是 Date.parse(updatedAt || 0)，缺 updatedAt 时会把数字 0 变成字符串
  // "0" 再解析成 2000 年，反而排到有效日期之前。缺值一律沉到最后更符合意图。
  const parsed = Date.parse(summary.updatedAt);
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

// 输入是 creationSetStore.listManifests() 直接产出的数组。
// 返回 { sets, imageTargets }：sets 是给子文档的摘要列表，
// imageTargets 是 Map<setId, Map<itemId, target>>，供图片路由按 ID 寻址。
export function buildStudioSetIndex(manifests, { limit = TEMU_STUDIO_SET_LIMIT } = {}) {
  const maxSets = Number.isFinite(Number(limit)) && Number(limit) >= 0 ? Number(limit) : TEMU_STUDIO_SET_LIMIT;
  const candidates = (Array.isArray(manifests) ? manifests : [])
    .map((manifest) => prepareStudioSet(manifest))
    .filter(Boolean)
    .sort((left, right) => updatedAtOrder(right.summary) - updatedAtOrder(left.summary));

  const sets = [];
  const imageTargets = new Map();
  const seenSetIds = new Set();
  for (const entry of candidates) {
    if (seenSetIds.has(entry.summary.setId)) continue;
    if (sets.length >= maxSets) break;
    seenSetIds.add(entry.summary.setId);
    sets.push(entry.summary);
    imageTargets.set(entry.summary.setId, entry.imageTargets);
  }

  return { sets, imageTargets };
}

// 图片路由的唯一寻址入口：只认索引里已知的目标，因此浏览器无法用任意
// setId/itemId 组合诱使服务端读取索引外的文件。
export function findStudioImageTarget(index, setIdInput, itemIdInput) {
  const setId = cleanStudioId(setIdInput);
  const itemId = cleanStudioId(itemIdInput);
  if (!setId || !itemId) return null;
  return index?.imageTargets?.get(setId)?.get(itemId) || null;
}
