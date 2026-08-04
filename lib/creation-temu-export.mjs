import { normalizeCreationListingDraftForView } from "./creation-listing-view.mjs";

export const TEMU_EXPORT_LIMITS = Object.freeze({
  maxRequestBytes: 256 * 1024,
  maxSetIds: 100,
  maxSetIdLength: 200,
  maxRows: 2000,
  maxUniqueImages: 5000,
  maxImageBytes: 20 * 1024 * 1024,
  maxCellCharacters: 32767,
});

export const TEMU_TEMPLATE_HEADERS = Object.freeze([
  "*产品标题",
  "*英文标题",
  "产品描述",
  "产品货号",
  "*变种属性名称一",
  "*变种属性值一",
  "变种属性名称二",
  "变种属性值二",
  "预览图",
  "*申报价格\n(店铺币种)",
  "SKU货号",
  "*长（cm）",
  "*宽（cm）",
  "*高（cm）",
  "*重量（g）",
  "识别码类型",
  "识别码",
  "站外产品链接",
  "*轮播图",
  "*产品素材图",
  "外包装形状",
  "外包装类型",
  "外包装图片",
  "建议售价（USD）",
  "库存",
  "发货时效（天）",
  "是否定制品",
  "产品视频url",
  "描述视频url",
  "产品说明书",
  "说明书语种",
  "SKU分类类型",
  "SKU分类数量",
  "SKU分类单位",
  "是否独立包装",
  "单品净含量",
  "单品净含量单位",
  "内计共含件数",
  "是否同品",
  "总净含量",
  "总净含量单位",
  "包装清单",
  "包装清单数量",
  "是否敏感属性",
  "敏感属性值",
  "储电容量",
  "刀具长度",
  "刀刃角度",
  "液体容量",
  "来源URL",
  "产地",
]);

export const TEMU_REQUIRED_FIELDS = Object.freeze([
  "*产品标题",
  "*英文标题",
  "*变种属性名称一",
  "*变种属性值一",
  "*申报价格\n(店铺币种)",
  "*长（cm）",
  "*宽（cm）",
  "*高（cm）",
  "*重量（g）",
  "*轮播图",
  "*产品素材图",
]);

const REQUEST_KEYS = new Set(["setIds", "defaults", "cloudinary"]);
const DEFAULT_KEYS = new Set([
  "variantAttributeName",
  "defaultPrice",
  "defaultPackageLengthCm",
  "defaultPackageWidthCm",
  "defaultPackageHeightCm",
  "defaultPackageWeightG",
  "defaultStock",
  "defaultOriginCountry",
]);
const CLOUDINARY_KEYS = new Set(["cloudName", "uploadPreset"]);
const ESTIMATED_VALUE_PATTERN = /(?:\bestimated\b|预估|估算|约(?:为|有)?)/iu;

function cleanString(value) {
  return String(value ?? "").trim();
}

function assertPlainObject(value, label) {
  if (value === undefined || value === null) return {};
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error(`${label}必须是对象。`);
  }
  return value;
}

function assertKnownKeys(value, allowedKeys, label) {
  const unknownKeys = Object.keys(value).filter((key) => !allowedKeys.has(key));
  if (unknownKeys.length > 0) {
    throw new Error(`${label}包含不支持或敏感字段：${unknownKeys.join("、")}。`);
  }
}

function normalizeOptionalNumber(value, { label, minExclusive = null, minInclusive = null, max, integer = false }) {
  if (value === undefined || value === null || cleanString(value) === "") return null;
  const number = Number(value);
  if (!Number.isFinite(number)) throw new Error(`${label}必须是有限数字。`);
  if (integer && !Number.isInteger(number)) throw new Error(`${label}必须是整数。`);
  if (minExclusive !== null && number <= minExclusive) throw new Error(`${label}必须大于 ${minExclusive}。`);
  if (minInclusive !== null && number < minInclusive) throw new Error(`${label}不得小于 ${minInclusive}。`);
  if (number > max) throw new Error(`${label}不得大于 ${max}。`);
  return number;
}

function normalizeLimitedText(value, { label, fallback = "", maxLength }) {
  const normalized = cleanString(value) || fallback;
  if (normalized.length > maxLength) throw new Error(`${label}不得超过 ${maxLength} 个字符。`);
  return normalized;
}

export function normalizeTemuExportRequest(payload = {}) {
  const request = assertPlainObject(payload, "Temu 导出请求");
  assertKnownKeys(request, REQUEST_KEYS, "Temu 导出请求");
  if (!Array.isArray(request.setIds)) throw new Error("setIds 必须是数组。");

  const setIds = [];
  const seenSetIds = new Set();
  for (const value of request.setIds) {
    if (typeof value !== "string") throw new Error("每个套图记录 ID 必须是字符串。");
    const setId = value.trim();
    if (!setId) throw new Error("套图记录 ID 不能为空。");
    if (setId.length > TEMU_EXPORT_LIMITS.maxSetIdLength) {
      throw new Error(`套图记录 ID 不得超过 ${TEMU_EXPORT_LIMITS.maxSetIdLength} 个字符。`);
    }
    if (!seenSetIds.has(setId)) {
      seenSetIds.add(setId);
      setIds.push(setId);
    }
  }
  if (setIds.length === 0) throw new Error("至少选择一套记录后才能导出 Temu Excel。");
  if (setIds.length > TEMU_EXPORT_LIMITS.maxSetIds) {
    throw new Error(`一次最多导出 ${TEMU_EXPORT_LIMITS.maxSetIds} 套记录。`);
  }

  const rawDefaults = assertPlainObject(request.defaults, "批次默认值");
  assertKnownKeys(rawDefaults, DEFAULT_KEYS, "批次默认值");
  const defaults = {
    variantAttributeName: normalizeLimitedText(rawDefaults.variantAttributeName, {
      label: "第一变种属性名",
      fallback: "颜色",
      maxLength: 50,
    }),
    defaultPrice: normalizeOptionalNumber(rawDefaults.defaultPrice, {
      label: "默认申报价格",
      minExclusive: 0,
      max: 1_000_000_000,
    }),
    defaultPackageLengthCm: normalizeOptionalNumber(rawDefaults.defaultPackageLengthCm, {
      label: "默认包装长度",
      minExclusive: 0,
      max: 100_000,
    }),
    defaultPackageWidthCm: normalizeOptionalNumber(rawDefaults.defaultPackageWidthCm, {
      label: "默认包装宽度",
      minExclusive: 0,
      max: 100_000,
    }),
    defaultPackageHeightCm: normalizeOptionalNumber(rawDefaults.defaultPackageHeightCm, {
      label: "默认包装高度",
      minExclusive: 0,
      max: 100_000,
    }),
    defaultPackageWeightG: normalizeOptionalNumber(rawDefaults.defaultPackageWeightG, {
      label: "默认包装重量",
      minExclusive: 0,
      max: 1_000_000_000,
    }),
    defaultStock: normalizeOptionalNumber(rawDefaults.defaultStock, {
      label: "默认库存",
      minInclusive: 0,
      max: 1_000_000_000,
      integer: true,
    }),
    defaultOriginCountry: normalizeLimitedText(rawDefaults.defaultOriginCountry, {
      label: "默认产地",
      maxLength: 100,
    }),
  };

  const rawCloudinary = assertPlainObject(request.cloudinary, "Cloudinary 配置");
  assertKnownKeys(rawCloudinary, CLOUDINARY_KEYS, "Cloudinary 配置");
  const cloudName = cleanString(rawCloudinary.cloudName);
  const uploadPreset = cleanString(rawCloudinary.uploadPreset);
  if (Boolean(cloudName) !== Boolean(uploadPreset)) {
    throw new Error("Cloudinary cloudName 与 unsigned uploadPreset 必须同时提供或同时留空。");
  }
  if (cloudName && !/^[a-z0-9_-]{1,128}$/iu.test(cloudName)) {
    throw new Error("Cloudinary cloudName 格式无效。");
  }
  if (uploadPreset && !/^[a-z0-9_.-]{1,128}$/iu.test(uploadPreset)) {
    throw new Error("Cloudinary unsigned uploadPreset 格式无效。");
  }

  return {
    setIds,
    defaults,
    cloudinary: cloudName ? { cloudName, uploadPreset } : null,
  };
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/u.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((octet) => octet < 0 || octet > 255)) return false;
  const [a, b] = octets;
  return a === 0 || a === 10 || a === 127 || a >= 224 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19));
}

function isPrivateIpv6(hostname) {
  const normalized = hostname.replace(/^\[|\]$/gu, "").toLowerCase();
  if (!normalized.includes(":")) return false;
  return normalized === "::" || normalized === "::1" || normalized.startsWith("fc") ||
    normalized.startsWith("fd") || normalized.startsWith("fe8") || normalized.startsWith("fe9") ||
    normalized.startsWith("fea") || normalized.startsWith("feb");
}

export function isPublicHttpsImageUrl(value) {
  try {
    const url = new URL(cleanString(value));
    if (url.protocol !== "https:" || url.username || url.password || !url.hostname) return false;
    const hostname = url.hostname.toLowerCase().replace(/\.$/u, "");
    if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local")) return false;
    if (isPrivateIpv4(hostname) || isPrivateIpv6(hostname)) return false;
    return true;
  } catch {
    return false;
  }
}

export function buildCloudinarySquareMaterialUrl(value) {
  if (!isPublicHttpsImageUrl(value)) return "";
  const url = new URL(value);
  if (url.hostname.toLowerCase() !== "res.cloudinary.com") return "";
  const marker = "/image/upload/";
  if (!url.pathname.includes(marker)) return "";
  url.pathname = url.pathname.replace(marker, `${marker}c_pad,b_white,h_1200,w_1200/`);
  return url.toString();
}

function roundConvertedNumber(value) {
  return Number(Number(value).toFixed(6));
}

export function parseDimensionTripletCm(value) {
  const text = cleanString(value);
  if (!text || ESTIMATED_VALUE_PATTERN.test(text)) return null;
  const matches = [...text.matchAll(
    /(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*[x×*]\s*(\d+(?:\.\d+)?)\s*(mm|cm|in(?:ch(?:es)?)?|毫米|厘米|英寸)/giu,
  )];
  if (matches.length === 0) return null;
  const match = matches.find((entry) => /^(?:mm|cm|毫米|厘米)$/iu.test(entry[4])) || matches[0];
  const unit = match[4].toLowerCase();
  const multiplier = /^(?:mm|毫米)$/iu.test(unit) ? 0.1 : /^(?:cm|厘米)$/iu.test(unit) ? 1 : 2.54;
  const dimensions = match.slice(1, 4).map((entry) => roundConvertedNumber(Number(entry) * multiplier));
  return dimensions.every((entry) => Number.isFinite(entry) && entry > 0) ? dimensions : null;
}

export function parseWeightG(value) {
  const text = cleanString(value);
  if (!text || ESTIMATED_VALUE_PATTERN.test(text)) return null;
  const matches = [...text.matchAll(
    /(\d+(?:\.\d+)?)\s*(kg|g|lb(?:s)?|pounds?|oz(?:\.av)?|千克|公斤|克|磅|盎司)/giu,
  )];
  if (matches.length === 0) return null;
  const match = matches.find((entry) => /^(?:kg|g|千克|公斤|克)$/iu.test(entry[2])) || matches[0];
  const number = Number(match[1]);
  const unit = match[2].toLowerCase();
  const multiplier = /^(?:kg|千克|公斤)$/iu.test(unit)
    ? 1000
    : /^(?:lb|lbs|pound|pounds|磅)$/iu.test(unit)
      ? 453.59237
      : /^(?:oz|oz\.av|盎司)$/iu.test(unit)
        ? 28.349523125
        : 1;
  const grams = roundConvertedNumber(number * multiplier);
  return Number.isFinite(grams) && grams > 0 ? grams : null;
}

function toWellFormedText(value) {
  const text = String(value ?? "");
  if (typeof text.toWellFormed === "function") return text.toWellFormed();
  return text.replace(/[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/gu, "\uFFFD");
}

function truncateUtf16Safe(value, maxLength) {
  if (value.length <= maxLength) return value;
  let output = "";
  let used = 0;
  for (const character of value) {
    const width = character.length;
    if (used + width > maxLength) break;
    output += character;
    used += width;
  }
  return output;
}

export function sanitizeTemuCellText(value) {
  const original = String(value ?? "");
  const changes = [];
  let normalized = toWellFormedText(original);
  if (normalized !== original) {
    changes.push({ code: "CELL_INVALID_UNICODE_REPLACED", originalLength: original.length });
  }
  const withoutControls = normalized.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/gu, "");
  if (withoutControls !== normalized) {
    changes.push({ code: "CELL_XML_CONTROL_REMOVED", originalLength: normalized.length });
    normalized = withoutControls;
  }
  const formulaLike = /^[\s]*[=+\-@]/u.test(normalized);
  if (formulaLike) {
    changes.push({ code: "CELL_FORMULA_LITERAL", originalLength: normalized.length });
  }
  if (normalized.length > TEMU_EXPORT_LIMITS.maxCellCharacters) {
    const originalLength = normalized.length;
    normalized = truncateUtf16Safe(normalized, TEMU_EXPORT_LIMITS.maxCellCharacters);
    changes.push({ code: "CELL_VALUE_TRUNCATED", originalLength });
  }
  return { value: normalized, forceText: true, changes };
}

function columnLetterForHeader(header) {
  let index = TEMU_TEMPLATE_HEADERS.indexOf(header) + 1;
  if (index <= 0) return "";
  let output = "";
  while (index > 0) {
    index -= 1;
    output = String.fromCharCode(65 + (index % 26)) + output;
    index = Math.floor(index / 26);
  }
  return output;
}

function createIssue(row, {
  severity = "错误",
  code,
  field = "",
  message,
  source = "",
  suggestion = "请核对后补全。",
} = {}) {
  return {
    severity,
    code,
    setId: row?.setId || "",
    productName: row?.productName || "",
    skuId: row?.skuId || "",
    skuName: row?.skuName || "",
    dataRow: row?.dataRow || null,
    field,
    column: columnLetterForHeader(field),
    message: cleanString(message),
    source: cleanString(source),
    suggestion: cleanString(suggestion),
  };
}

function itemKey(setId, item, fallbackIndex = 0) {
  const identity = cleanString(item?.itemId || item?.id) ||
    `slot-${Number(item?.slotIndex) || fallbackIndex + 1}-${cleanString(item?.filename) || "image"}`;
  return `${setId}:${identity}`;
}

function normalizedListingDrafts(set) {
  return (Array.isArray(set?.listingDrafts) ? set.listingDrafts : []).map((draft, index) =>
    normalizeCreationListingDraftForView(draft, index),
  );
}

function pickListingForSku(drafts, skuId) {
  return drafts.find((draft) => cleanString(draft.skuSubjectId) === skuId) ||
    drafts.find((draft) => !cleanString(draft.skuSubjectId)) ||
    drafts[0] || null;
}

function sortCreationItems(items) {
  return items
    .map((item, index) => ({ item, index }))
    .sort((left, right) => {
      const leftSlot = Number(left.item?.slotIndex);
      const rightSlot = Number(right.item?.slotIndex);
      if (Number.isFinite(leftSlot) && Number.isFinite(rightSlot) && leftSlot !== rightSlot) return leftSlot - rightSlot;
      return left.index - right.index;
    });
}

function isUsableCreationImageItem(item) {
  return cleanString(item?.status) === "completed" && Boolean(
    cleanString(item?.relativePath) ||
    [item?.temuPublicUrl, item?.publicUrl, item?.secureUrl, item?.imageUrl].some(isPublicHttpsImageUrl),
  );
}

function getSkuSubjectId(item) {
  return cleanString(item?.skuSubject?.id || item?.sku_subject?.id || item?.skuSubjectId || item?.sku_subject_id);
}

function getExplicitTemuEntry(set, sku, listing, key) {
  const sources = [
    [sku?.temuExport, "SKU.temuExport"],
    [listing?.temuExport, "Listing.temuExport"],
    [set?.temuExport, "Set.temuExport"],
  ];
  for (const [source, sourceLabel] of sources) {
    if (source && Object.prototype.hasOwnProperty.call(source, key) && cleanString(source[key]) !== "") {
      return { value: source[key], source: sourceLabel + "." + key };
    }
  }
  return null;
}

function getExplicitTemuValue(set, sku, listing, key) {
  return getExplicitTemuEntry(set, sku, listing, key)?.value ?? null;
}

function getExplicitTemuNumber({
  set,
  sku,
  listing,
  key,
  field,
  row,
  issues,
  minExclusive = null,
  minInclusive = null,
  max,
  integer = false,
}) {
  const entry = getExplicitTemuEntry(set, sku, listing, key);
  if (!entry) return null;
  try {
    return normalizeOptionalNumber(entry.value, {
      label: field,
      minExclusive,
      minInclusive,
      max,
      integer,
    });
  } catch {
    issues.push(createIssue(row, {
      severity: "警告",
      code: "INVALID_SAVED_VALUE_IGNORED",
      field,
      source: entry.source,
      message: field + " 的已保存值不符合有限数值、范围或整数规则，已忽略。",
      suggestion: "核对已保存事实，或为本次导出填写有效批次默认值。",
    }));
    return null;
  }
}

function addDefaultAppliedIssue(issues, row, field) {
  issues.push(createIssue(row, {
    severity: "信息",
    code: "USER_DEFAULT_APPLIED",
    field,
    source: "用户批次默认值",
    message: `${field} 使用了本次导出的批次默认值。`,
    suggestion: "导入前确认该默认值适用于当前 SKU。",
  }));
}

function applyExplicitOrDefault({ explicitValue, defaultValue, field, row, issues }) {
  if (explicitValue !== null && explicitValue !== undefined && cleanString(explicitValue) !== "") return explicitValue;
  if (defaultValue !== null && defaultValue !== undefined && cleanString(defaultValue) !== "") {
    addDefaultAppliedIssue(issues, row, field);
    return defaultValue;
  }
  return null;
}

function createBlankCells() {
  return Object.fromEntries(TEMU_TEMPLATE_HEADERS.map((header) => [header, ""]));
}

function wrapDescriptionHtml(value) {
  const text = cleanString(value);
  if (!text) return "";
  if (/<[a-z][\s\S]*>/iu.test(text)) return text;
  return `<p>${text.replace(/&/gu, "&amp;").replace(/</gu, "&lt;").replace(/>/gu, "&gt;")}</p>`;
}

function addMissingRequiredIssues(plan) {
  for (const row of plan.rows) {
    for (const field of TEMU_REQUIRED_FIELDS.filter((entry) => !["*轮播图", "*产品素材图"].includes(entry))) {
      const value = row.cells[field];
      if (value === null || value === undefined || cleanString(value) === "") {
        plan.issues.push(createIssue(row, {
          code: "MISSING_REQUIRED_FIELD",
          field,
          message: `${field} 没有已保存事实或用户默认值。`,
          suggestion: "在导入模板中补入真实值后再上传。",
        }));
      }
    }
  }
}

export function createTemuExportPlan({ sets = [], defaults = {} } = {}) {
  const normalizedDefaults = {
    variantAttributeName: cleanString(defaults.variantAttributeName) || "颜色",
    defaultPrice: defaults.defaultPrice ?? null,
    defaultPackageLengthCm: defaults.defaultPackageLengthCm ?? null,
    defaultPackageWidthCm: defaults.defaultPackageWidthCm ?? null,
    defaultPackageHeightCm: defaults.defaultPackageHeightCm ?? null,
    defaultPackageWeightG: defaults.defaultPackageWeightG ?? null,
    defaultStock: defaults.defaultStock ?? null,
    defaultOriginCountry: cleanString(defaults.defaultOriginCountry),
  };
  const rows = [];
  const issues = [];
  const imageRequirementMap = new Map();

  for (const set of sets) {
    const setId = cleanString(set?.setId || set?.id);
    const productName = cleanString(set?.productName || set?.productTitle);
    const drafts = normalizedListingDrafts(set);
    const savedSkus = Array.isArray(set?.skuSubjects) ? set.skuSubjects : [];
    const skus = savedSkus.length > 0 ? savedSkus : [{ id: "", title: "", __placeholder: true }];
    const sortedItems = sortCreationItems(Array.isArray(set?.items) ? set.items : []);
    const sharedItems = sortedItems
      .filter(({ item }) => isUsableCreationImageItem(item) && cleanString(item?.role) !== "sku")
      .map(({ item, index }) => ({ ...item, __itemKey: itemKey(setId, item, index) }))
      .slice(0, 10);
    const materialItem = sharedItems.find((item) => cleanString(item.role) === "hero") || sharedItems[0] || null;

    for (const sku of skus) {
      if (rows.length >= TEMU_EXPORT_LIMITS.maxRows) {
        throw new Error(`Temu 导出数据行不得超过 ${TEMU_EXPORT_LIMITS.maxRows} 行。`);
      }
      const skuId = cleanString(sku?.id || sku?.subjectId || sku?.subject_id);
      const skuName = cleanString(sku?.title || sku?.name);
      const listing = pickListingForSku(drafts, skuId);
      const row = {
        setId,
        productName,
        skuId,
        skuName,
        rowKey: `${setId}:${skuId || "missing-sku"}`,
        dataRow: rows.length + 2,
        cells: createBlankCells(),
        imageRefs: { preview: null, carousel: sharedItems, material: materialItem },
      };

      if (!listing) {
        issues.push(createIssue(row, {
          code: "MISSING_LISTING",
          message: "这套记录没有可用 Listing 草稿。",
          suggestion: "先生成并核对 Listing，或在导入模板中手工补全标题和描述。",
        }));
      }
      if (sku.__placeholder) {
        issues.push(createIssue(row, {
          code: "MISSING_SKU",
          field: "*变种属性值一",
          message: "这套记录没有可识别的 SKU。",
          suggestion: "补充真实 SKU 后再导入，或在模板中手工填写一个真实变种。",
        }));
      }

      const zhTitle = cleanString(listing?.zhDisplay?.title) || productName;
      const enTitle = cleanString(listing?.title);
      row.cells["*产品标题"] = zhTitle;
      row.cells["*英文标题"] = enTitle;
      row.cells["产品描述"] = wrapDescriptionHtml(listing?.description);
      row.cells["*变种属性名称一"] = sku.__placeholder ? "" : normalizedDefaults.variantAttributeName;
      row.cells["*变种属性值一"] = sku.__placeholder ? "" : skuName || skuId;
      row.cells["SKU货号"] = skuId;

      const explicitPrice = getExplicitTemuNumber({
        set,
        sku,
        listing,
        key: "declaredPrice",
        field: "*申报价格\n(店铺币种)",
        row,
        issues,
        minExclusive: 0,
        max: 1_000_000_000,
      });
      row.cells["*申报价格\n(店铺币种)"] = applyExplicitOrDefault({
        explicitValue: explicitPrice,
        defaultValue: normalizedDefaults.defaultPrice,
        field: "*申报价格\n(店铺币种)",
        row,
        issues,
      });

      const explicitDimensions = parseDimensionTripletCm(listing?.packageDimensions);
      const dimensionFields = ["*长（cm）", "*宽（cm）", "*高（cm）"];
      const dimensionDefaults = [
        normalizedDefaults.defaultPackageLengthCm,
        normalizedDefaults.defaultPackageWidthCm,
        normalizedDefaults.defaultPackageHeightCm,
      ];
      dimensionFields.forEach((field, index) => {
        row.cells[field] = applyExplicitOrDefault({
          explicitValue: explicitDimensions?.[index] ?? null,
          defaultValue: dimensionDefaults[index],
          field,
          row,
          issues,
        });
      });
      if (cleanString(listing?.packageDimensions) && !explicitDimensions) {
        issues.push(createIssue(row, {
          severity: "警告",
          code: ESTIMATED_VALUE_PATTERN.test(cleanString(listing.packageDimensions))
            ? "ESTIMATED_VALUE_IGNORED"
            : "UNPARSEABLE_SAVED_VALUE",
          field: "*长（cm）",
          source: "Listing.packageDimensions",
          message: "已保存包装尺寸不是可直接使用的明确厘米三维值，因此未作为物流事实写入。",
          suggestion: "核对真实包装长宽高后填写。",
        }));
      }

      const explicitWeight = parseWeightG(listing?.packageWeight);
      row.cells["*重量（g）"] = applyExplicitOrDefault({
        explicitValue: explicitWeight,
        defaultValue: normalizedDefaults.defaultPackageWeightG,
        field: "*重量（g）",
        row,
        issues,
      });
      if (cleanString(listing?.packageWeight) && !explicitWeight) {
        issues.push(createIssue(row, {
          severity: "警告",
          code: ESTIMATED_VALUE_PATTERN.test(cleanString(listing.packageWeight))
            ? "ESTIMATED_VALUE_IGNORED"
            : "UNPARSEABLE_SAVED_VALUE",
          field: "*重量（g）",
          source: "Listing.packageWeight",
          message: "已保存包装重量不是可直接使用的明确克值，因此未作为物流事实写入。",
          suggestion: "核对真实包装重量后填写。",
        }));
      }

      row.cells["库存"] = applyExplicitOrDefault({
        explicitValue: getExplicitTemuNumber({
          set,
          sku,
          listing,
          key: "stock",
          field: "库存",
          row,
          issues,
          minInclusive: 0,
          max: 1_000_000_000,
          integer: true,
        }),
        defaultValue: normalizedDefaults.defaultStock,
        field: "库存",
        row,
        issues,
      });
      row.cells["产地"] = applyExplicitOrDefault({
        explicitValue: getExplicitTemuValue(set, sku, listing, "origin"),
        defaultValue: normalizedDefaults.defaultOriginCountry,
        field: "产地",
        row,
        issues,
      }) || "";

      if (!sku.__placeholder) {
        const bundleCount = Number.parseInt(cleanString(sku?.bundleCount), 10) || 1;
        row.cells["SKU分类类型"] = bundleCount > 1 ? "同款多件" : "单品";
        row.cells["SKU分类数量"] = bundleCount;
        row.cells["SKU分类单位"] = "件";
        const previewEntry = sortedItems.find(({ item }) =>
          isUsableCreationImageItem(item) && cleanString(item?.role) === "sku" && getSkuSubjectId(item) === skuId,
        );
        if (previewEntry) {
          row.imageRefs.preview = {
            ...previewEntry.item,
            __itemKey: itemKey(setId, previewEntry.item, previewEntry.index),
          };
        }
      }

      rows.push(row);
      for (const item of [row.imageRefs.preview, ...row.imageRefs.carousel, row.imageRefs.material].filter(Boolean)) {
        imageRequirementMap.set(item.__itemKey, {
          itemKey: item.__itemKey,
          setId,
          productName,
          item,
        });
      }
    }
  }

  if (imageRequirementMap.size > TEMU_EXPORT_LIMITS.maxUniqueImages) {
    throw new Error(`Temu 导出唯一图片不得超过 ${TEMU_EXPORT_LIMITS.maxUniqueImages} 张。`);
  }
  const plan = { rows, issues, imageRequirements: [...imageRequirementMap.values()] };
  addMissingRequiredIssues(plan);
  return plan;
}

function readImageResult(imageResults, key) {
  if (!key) return null;
  if (imageResults instanceof Map) return imageResults.get(key) || null;
  return imageResults && typeof imageResults === "object" ? imageResults[key] || null : null;
}

function appendImageIssue(issues, row, field, result, item, fallbackCode = "MISSING_PUBLIC_IMAGE_URL") {
  issues.push(createIssue(row, {
    code: cleanString(result?.code) || fallbackCode,
    field,
    source: cleanString(result?.source),
    message: cleanString(result?.message) || `${field} 没有可用的公网 HTTPS 图片 URL${item?.filename ? `（${cleanString(item.filename)}）` : ""}。`,
    suggestion: cleanString(result?.suggestion) || "配置 Cloudinary unsigned upload 或手工补入可公开访问的 HTTPS 图片 URL。",
  }));
}

export function finalizeTemuExportPlan(plan, imageResults = new Map()) {
  const rows = plan.rows.map((row) => ({ ...row, cells: { ...row.cells } }));
  const issues = plan.issues.map((issue) => ({ ...issue }));

  for (const row of rows) {
    const previewRef = row.imageRefs.preview;
    const previewResult = readImageResult(imageResults, previewRef?.__itemKey);
    if (isPublicHttpsImageUrl(previewResult?.url)) {
      row.cells["预览图"] = previewResult.url;
    } else if (row.skuId) {
      appendImageIssue(
        issues,
        row,
        "预览图",
        previewResult,
        previewRef,
        previewRef ? "MISSING_PUBLIC_IMAGE_URL" : "MISSING_SKU_IMAGE",
      );
    }

    const carouselUrls = [];
    for (const carouselRef of row.imageRefs.carousel) {
      const result = readImageResult(imageResults, carouselRef.__itemKey);
      if (isPublicHttpsImageUrl(result?.url)) carouselUrls.push(result.url);
      else appendImageIssue(issues, row, "*轮播图", result, carouselRef);
    }
    row.cells["*轮播图"] = [...new Set(carouselUrls)].slice(0, 10).join("\n");
    if (!row.cells["*轮播图"] && row.imageRefs.carousel.length === 0) {
      appendImageIssue(issues, row, "*轮播图", null, null);
    }

    const materialRef = row.imageRefs.material;
    const materialResult = readImageResult(imageResults, materialRef?.__itemKey);
    if (isPublicHttpsImageUrl(materialResult?.url)) {
      const squareUrl = buildCloudinarySquareMaterialUrl(materialResult.url);
      row.cells["*产品素材图"] = squareUrl || materialResult.url;
      if (!squareUrl) {
        issues.push(createIssue(row, {
          severity: "警告",
          code: "MATERIAL_IMAGE_REQUIREMENTS_UNVERIFIED",
          field: "*产品素材图",
          source: cleanString(materialResult.source),
          message: "产品素材图不是可派生 1200×1200 方图的 Cloudinary URL，尺寸比例尚未验证。",
          suggestion: "确认图片为 1:1 且大于 800×800，或改用 Cloudinary 方图 URL。",
        }));
      }
    } else {
      appendImageIssue(issues, row, "*产品素材图", materialResult, materialRef);
    }

    for (const field of ["*轮播图", "*产品素材图"]) {
      if (!cleanString(row.cells[field])) {
        issues.push(createIssue(row, {
          code: "MISSING_REQUIRED_FIELD",
          field,
          message: `${field} 没有可用的公网 HTTPS 图片 URL。`,
          suggestion: "补入符合模板要求的公网图片 URL 后再上传。",
        }));
      }
    }
  }

  return { ...plan, rows, issues };
}
