import { TEMU_REQUIRED_FIELDS } from "./creation-temu-export.mjs";

export const CREATION_TEMU_PREFLIGHT_LIMITS = Object.freeze({
  maxProblems: 200,
  maxProblemsPerRecord: 50,
  maxTextLength: 500,
});

const REMOTE_BLOCKING_CODE_PATTERN = /^(?:REMOTE_IMAGE_|SKU_IMAGE_DIMENSIONS_INVALID$|MATERIAL_IMAGE_DIMENSIONS_INVALID$)/u;
const VALID_CODE_PATTERN = /^[A-Z][A-Z0-9_]{1,63}$/u;
const WINDOWS_ABSOLUTE_PATH_PATTERN = /(?:\\\\[^\s,，;；。)\]}]+|\b[A-Za-z]:[\\/][^\s,，;；。)\]}]+)/gu;
const POSIX_ABSOLUTE_PATH_PATTERN = /\/(?:Users|home|tmp|var\/tmp|private|opt|srv|mnt|Volumes)\/[^\s,，;；。)\]}]+/gu;
const SECRET_ASSIGNMENT_PATTERN = /\b(?:api[-_ ]?(?:key|secret)|upload[-_ ]?preset|authorization|cookie|token|signature)\b\s*[:=]\s*(?:Bearer\s+)?[^\s,，;；。]+/giu;
const BEARER_PATTERN = /\bBearer\s+[A-Za-z0-9._~+/=-]+/giu;

function cleanString(value) {
  const text = String(value ?? "");
  return typeof text.toWellFormed === "function" ? text.toWellFormed().trim() : text.trim();
}

function sanitizeUrlText(rawUrl) {
  try {
    const url = new URL(rawUrl);
    url.username = "";
    url.password = "";
    url.search = "";
    url.hash = "";
    return url.href;
  } catch {
    return "[已隐藏敏感地址]";
  }
}

export function sanitizeCreationTemuPreflightText(value, maxLength = CREATION_TEMU_PREFLIGHT_LIMITS.maxTextLength) {
  let text = cleanString(value);
  if (!text) return "";
  text = text
    .replace(/https?:\/\/[^\s,，;；。)\]}]+/giu, sanitizeUrlText)
    .replace(SECRET_ASSIGNMENT_PATTERN, "[已隐藏敏感信息]")
    .replace(BEARER_PATTERN, "[已隐藏敏感信息]")
    .replace(WINDOWS_ABSOLUTE_PATH_PATTERN, "[已隐藏本地路径]")
    .replace(POSIX_ABSOLUTE_PATH_PATTERN, "[已隐藏本地路径]");
  const boundedLength = Number.isInteger(maxLength) && maxLength > 0
    ? Math.min(maxLength, CREATION_TEMU_PREFLIGHT_LIMITS.maxTextLength)
    : CREATION_TEMU_PREFLIGHT_LIMITS.maxTextLength;
  return text.length > boundedLength ? `${text.slice(0, Math.max(0, boundedLength - 1))}…` : text;
}

function safeCode(value, fallback) {
  const code = cleanString(value).toUpperCase();
  return VALID_CODE_PATTERN.test(code) ? code : fallback;
}

function normalizeSeverity(value) {
  const severity = cleanString(value).toLowerCase();
  if (["error", "fatal", "blocking", "错误", "阻塞"].includes(severity)) return "error";
  if (["warning", "warn", "警告"].includes(severity)) return "warning";
  return "info";
}

export function isCreationTemuStrictBlockingIssue(issue = {}) {
  const code = safeCode(issue?.code, "TEMU_PREFLIGHT_ISSUE");
  return normalizeSeverity(issue?.severity) === "error" || REMOTE_BLOCKING_CODE_PATTERN.test(code);
}

function safePositiveInteger(value) {
  const number = Number(value);
  return Number.isSafeInteger(number) && number > 0 ? number : null;
}

function safeSetId(value) {
  return sanitizeCreationTemuPreflightText(value, 200);
}

function sanitizeProblem(rawIssue, defaults = {}, blocking = isCreationTemuStrictBlockingIssue(rawIssue)) {
  const fallbackCode = blocking ? "TEMU_PREFLIGHT_BLOCKED" : "TEMU_PREFLIGHT_WARNING";
  const width = safePositiveInteger(rawIssue?.width ?? rawIssue?.actualWidth);
  const height = safePositiveInteger(rawIssue?.height ?? rawIssue?.actualHeight);
  const problem = {
    severity: blocking ? "error" : normalizeSeverity(rawIssue?.severity),
    code: safeCode(rawIssue?.code, fallbackCode),
    setId: safeSetId(rawIssue?.setId ?? defaults.setId),
    productName: sanitizeCreationTemuPreflightText(rawIssue?.productName ?? defaults.productName, 200),
    skuId: sanitizeCreationTemuPreflightText(rawIssue?.skuId ?? defaults.skuId, 200),
    skuName: sanitizeCreationTemuPreflightText(rawIssue?.skuName ?? defaults.skuName, 200),
    dataRow: safePositiveInteger(rawIssue?.dataRow ?? defaults.dataRow),
    field: sanitizeCreationTemuPreflightText(rawIssue?.field ?? defaults.field, 120),
    role: sanitizeCreationTemuPreflightText(rawIssue?.role ?? defaults.role, 40),
    message: sanitizeCreationTemuPreflightText(rawIssue?.message ?? defaults.message),
    source: sanitizeCreationTemuPreflightText(rawIssue?.source ?? defaults.source, 200),
    suggestion: sanitizeCreationTemuPreflightText(rawIssue?.suggestion ?? defaults.suggestion),
  };
  if (width !== null) problem.width = width;
  if (height !== null) problem.height = height;
  return problem;
}

function problemIdentity(problem) {
  return [
    problem.code,
    problem.setId,
    problem.skuId,
    problem.dataRow || "",
    problem.field,
    problem.role,
    problem.message,
  ].join("\u0000");
}

function pushUnique(target, seen, problem) {
  const identity = problemIdentity(problem);
  if (seen.has(identity)) return false;
  seen.add(identity);
  target.push(problem);
  return true;
}

function mapEntries(value) {
  if (value instanceof Map) return [...value.entries()];
  if (!value || typeof value !== "object" || Array.isArray(value)) return [];
  return Object.entries(value);
}

function mapValue(value, key) {
  if (value instanceof Map) return value.get(key);
  if (!value || typeof value !== "object" || Array.isArray(value)) return undefined;
  return value[key];
}

function isPublicHttpsUrl(value) {
  try {
    const url = new URL(cleanString(value));
    return url.protocol === "https:" && !url.username && !url.password && Boolean(url.hostname);
  } catch {
    return false;
  }
}

function splitImageUrls(value) {
  return cleanString(value).split(/[\r\n]+/u).map(cleanString).filter(Boolean);
}

function rowDefaults(row, field = "", role = "") {
  return {
    setId: row?.setId,
    productName: row?.productName,
    skuId: row?.skuId,
    skuName: row?.skuName,
    dataRow: row?.dataRow,
    field,
    role,
  };
}

function createFinalImageUses(rows) {
  const uses = [];
  for (const row of rows) {
    if (cleanString(row?.skuId)) {
      uses.push({
        row,
        role: "sku",
        field: "预览图",
        url: cleanString(row?.cells?.["预览图"]),
        referenceKeys: [
          `${cleanString(row?.rowKey)}:preview`,
          `${cleanString(row?.rowKey)}:预览图`,
          cleanString(row?.imageRefs?.preview?.__itemKey),
        ].filter(Boolean),
      });
    }
    const carouselUrls = splitImageUrls(row?.cells?.["*轮播图"]);
    if (carouselUrls.length === 0) {
      uses.push({ row, role: "carousel", field: "*轮播图", url: "", referenceKeys: [] });
    } else {
      carouselUrls.forEach((url, index) => uses.push({
        row,
        role: "carousel",
        field: "*轮播图",
        url,
        referenceKeys: [
          `${cleanString(row?.rowKey)}:carousel:${index}`,
          `${cleanString(row?.rowKey)}:*轮播图:${index}`,
          cleanString(row?.imageRefs?.carousel?.[index]?.__itemKey),
        ].filter(Boolean),
      }));
    }
    uses.push({
      row,
      role: "material",
      field: "*产品素材图",
      url: cleanString(row?.cells?.["*产品素材图"]),
      referenceKeys: [
        `${cleanString(row?.rowKey)}:material`,
        `${cleanString(row?.rowKey)}:*产品素材图`,
      ].filter(Boolean),
    });
  }
  return uses;
}

function sameReference(issue, use) {
  const references = [issue?.key, issue?.url, issue?.requestedUrl, issue?.path].map(cleanString).filter(Boolean);
  return references.some((reference) => reference === use.url || use.referenceKeys.includes(reference));
}

function findRemoteResult(remoteResults, use) {
  for (const key of [use.url, ...use.referenceKeys]) {
    const direct = mapValue(remoteResults, key);
    if (direct) return direct;
  }
  for (const [key, result] of mapEntries(remoteResults)) {
    if (cleanString(key) === use.url || use.referenceKeys.includes(cleanString(key))) return result;
    for (const candidate of [result?.requestedUrl, result?.originalUrl, result?.url]) {
      if (cleanString(candidate) === use.url) return result;
    }
  }
  return null;
}

function hasBlockingProblemAt(problems, row, field) {
  const rowSetId = cleanString(row?.setId);
  const rowSkuId = cleanString(row?.skuId);
  const rowNumber = safePositiveInteger(row?.dataRow);
  return problems.some((problem) => {
    if (problem.field !== field) return false;
    if (rowNumber && problem.dataRow) return rowNumber === problem.dataRow;
    return problem.setId === rowSetId && (!rowSkuId || !problem.skuId || problem.skuId === rowSkuId);
  });
}

function dimensionProblem(use, result) {
  const width = safePositiveInteger(result?.width);
  const height = safePositiveInteger(result?.height);
  if (width !== null && height !== null && width > 800 && height > 800 && width === height) return null;
  const label = use.role === "sku" ? "SKU 预览图" : "产品素材图";
  return sanitizeProblem({
    severity: "error",
    code: use.role === "sku" ? "SKU_IMAGE_DIMENSIONS_INVALID" : "MATERIAL_IMAGE_DIMENSIONS_INVALID",
    width,
    height,
    message: width !== null && height !== null
      ? `${label}实际尺寸为 ${width}×${height}，必须为宽高均大于 800 像素的正方形。`
      : `${label}没有可验证的实际像素尺寸。`,
    suggestion: `更换为宽高均大于 800 像素的正方形${label}。`,
  }, rowDefaults(use.row, use.field, use.role), true);
}

function normalizeTemplate(template) {
  if (typeof template === "string") {
    return { name: sanitizeCreationTemuPreflightText(template, 160), version: "", sheetName: "" };
  }
  const source = template && typeof template === "object" && !Array.isArray(template) ? template : {};
  return {
    name: sanitizeCreationTemuPreflightText(
      source.name ?? source.templateName ?? source.displayName ?? source.fileName,
      160,
    ),
    version: sanitizeCreationTemuPreflightText(source.version ?? source.templateVersion, 80),
    sheetName: sanitizeCreationTemuPreflightText(source.sheetName ?? source.worksheetName, 120),
  };
}

function safeUpdatedAt(value) {
  const text = cleanString(value);
  if (!text) return "";
  const timestamp = Date.parse(text);
  return Number.isFinite(timestamp) ? new Date(timestamp).toISOString() : "";
}

function setIdentity(value, fallbackIndex) {
  return cleanString(value?.setId || value?.id) || `unknown-set-${fallbackIndex + 1}`;
}

function uniqueRequirements(requirements) {
  const unique = new Map();
  (Array.isArray(requirements) ? requirements : []).forEach((requirement, index) => {
    const key = cleanString(requirement?.itemKey) || `image-${index + 1}`;
    if (!unique.has(key)) unique.set(key, { ...requirement, itemKey: key });
  });
  return [...unique.values()];
}

function requirementHasPublicUrl(requirement) {
  return [
    requirement?.item?.temuPublicUrl,
    requirement?.item?.publicUrl,
    requirement?.item?.secureUrl,
    requirement?.item?.imageUrl,
  ].some(isPublicHttpsUrl);
}

function requirementStats(requirements, imageResults) {
  const statsBySet = new Map();
  let pendingUploadCount = 0;
  let uploadedCount = 0;
  let cacheReuseCount = 0;
  for (const requirement of requirements) {
    const setId = cleanString(requirement?.setId);
    if (!statsBySet.has(setId)) statsBySet.set(setId, { imageCount: 0, pendingUploadCount: 0, uploadedCount: 0, cacheReuseCount: 0 });
    const setStats = statsBySet.get(setId);
    setStats.imageCount += 1;
    const result = mapValue(imageResults, requirement.itemKey);
    const source = cleanString(result?.source);
    if (source === "cloudinary-upload") {
      uploadedCount += 1;
      setStats.uploadedCount += 1;
    } else if (source === "cloudinary-cache") {
      cacheReuseCount += 1;
      setStats.cacheReuseCount += 1;
    }
    const hasLocalSource = Boolean(cleanString(requirement?.item?.relativePath));
    const hasFinalUrl = isPublicHttpsUrl(result?.url) || requirementHasPublicUrl(requirement);
    if (hasLocalSource && !hasFinalUrl) {
      pendingUploadCount += 1;
      setStats.pendingUploadCount += 1;
    }
  }
  return { statsBySet, pendingUploadCount, uploadedCount, cacheReuseCount };
}

function problemBelongsToSet(problem, setId) {
  return problem.setId === setId;
}

export function buildCreationTemuPreflightSummary({
  template = {},
  finalizedPlan = {},
  imageResolution = {},
  remoteVerification = {},
  sets = [],
} = {}) {
  const rows = Array.isArray(finalizedPlan?.rows) ? finalizedPlan.rows : [];
  const requirements = uniqueRequirements(finalizedPlan?.imageRequirements);
  const imageResults = imageResolution?.results ?? imageResolution;
  const remoteResults = remoteVerification?.results ?? new Map();
  const remoteIssues = Array.isArray(remoteVerification?.issues) ? remoteVerification.issues : [];
  const blockers = [];
  const warnings = [];
  const blockerSeen = new Set();
  const warningSeen = new Set();

  for (const rawIssue of Array.isArray(finalizedPlan?.issues) ? finalizedPlan.issues : []) {
    const blocking = isCreationTemuStrictBlockingIssue(rawIssue);
    const problem = sanitizeProblem(rawIssue, {}, blocking);
    pushUnique(blocking ? blockers : warnings, blocking ? blockerSeen : warningSeen, problem);
  }

  for (const row of rows) {
    for (const field of TEMU_REQUIRED_FIELDS) {
      const value = row?.cells?.[field];
      if (value !== null && value !== undefined && cleanString(value) !== "") continue;
      if (hasBlockingProblemAt(blockers, row, field)) continue;
      pushUnique(blockers, blockerSeen, sanitizeProblem({
        severity: "error",
        code: field === "*轮播图" || field === "*产品素材图"
          ? "MISSING_FINAL_IMAGE"
          : "MISSING_REQUIRED_FIELD",
        message: `${field} 缺少严格导出所需的最终值。`,
        suggestion: `补全 ${field} 后重新预检。`,
      }, rowDefaults(row, field, field.includes("图") ? "image" : "field"), true));
    }
  }

  const consumedRemoteIssues = new Set();
  for (const use of createFinalImageUses(rows)) {
    if (!isPublicHttpsUrl(use.url)) {
      if (!hasBlockingProblemAt(blockers, use.row, use.field)) {
        pushUnique(blockers, blockerSeen, sanitizeProblem({
          severity: "error",
          code: "MISSING_FINAL_IMAGE",
          message: `${use.field} 缺少最终公网 HTTPS 图片。`,
          suggestion: "补传图片并确认最终公网 HTTPS 地址后重新预检。",
        }, rowDefaults(use.row, use.field, use.role), true));
      }
      continue;
    }

    const matchingRemoteIssues = remoteIssues
      .map((issue, index) => ({ issue, index }))
      .filter(({ issue }) => sameReference(issue, use));
    if (matchingRemoteIssues.length > 0) {
      for (const { issue, index } of matchingRemoteIssues) {
        consumedRemoteIssues.add(index);
        pushUnique(blockers, blockerSeen, sanitizeProblem(
          { ...issue, severity: "error" },
          rowDefaults(use.row, use.field, use.role),
          true,
        ));
      }
      continue;
    }

    const remoteResult = findRemoteResult(remoteResults, use);
    if (!remoteResult) {
      pushUnique(blockers, blockerSeen, sanitizeProblem({
        severity: "error",
        code: "REMOTE_IMAGE_NOT_VERIFIED",
        message: `${use.field} 的最终公网图片尚未通过实时远程验证。`,
        suggestion: "重新运行服务端预检并确认图片可公开读取。",
      }, rowDefaults(use.row, use.field, use.role), true));
      continue;
    }

    if (use.role === "sku" || use.role === "material") {
      const problem = dimensionProblem(use, remoteResult);
      if (problem) pushUnique(blockers, blockerSeen, problem);
    }
  }

  remoteIssues.forEach((issue, index) => {
    if (consumedRemoteIssues.has(index)) return;
    pushUnique(blockers, blockerSeen, sanitizeProblem({ ...issue, severity: "error" }, {}, true));
  });

  const normalizedTemplate = normalizeTemplate(template);
  const normalizedSetMap = new Map();
  (Array.isArray(sets) ? sets : []).forEach((set, index) => {
    const setId = setIdentity(set, index);
    if (!normalizedSetMap.has(setId)) normalizedSetMap.set(setId, set);
  });
  rows.forEach((row, index) => {
    const setId = setIdentity(row, normalizedSetMap.size + index);
    if (!normalizedSetMap.has(setId)) normalizedSetMap.set(setId, row);
  });
  requirements.forEach((requirement, index) => {
    const setId = setIdentity(requirement, normalizedSetMap.size + index);
    if (!normalizedSetMap.has(setId)) normalizedSetMap.set(setId, requirement);
  });

  const imageStats = requirementStats(requirements, imageResults);
  const records = [...normalizedSetMap].map(([rawSetId, snapshot]) => {
    const setRows = rows.filter((row) => cleanString(row?.setId) === rawSetId);
    const setStats = imageStats.statsBySet.get(rawSetId) || {
      imageCount: 0,
      pendingUploadCount: 0,
      uploadedCount: 0,
      cacheReuseCount: 0,
    };
    const setId = safeSetId(rawSetId);
    const setBlockers = blockers.filter((problem) => problemBelongsToSet(problem, setId));
    const setWarnings = warnings.filter((problem) => problemBelongsToSet(problem, setId));
    const firstRow = setRows[0];
    return {
      setId,
      productName: sanitizeCreationTemuPreflightText(
        snapshot?.productName ?? snapshot?.productTitle ?? firstRow?.productName,
        200,
      ),
      sourceUpdatedAt: safeUpdatedAt(snapshot?.updatedAt),
      skuCount: setRows.length,
      imageCount: setStats.imageCount,
      pendingUploadCount: setStats.pendingUploadCount,
      uploadedCount: setStats.uploadedCount,
      cacheReuseCount: setStats.cacheReuseCount,
      blockerCount: setBlockers.length,
      warningCount: setWarnings.length,
      strictReady: setBlockers.length === 0,
      blockers: setBlockers.slice(0, CREATION_TEMU_PREFLIGHT_LIMITS.maxProblemsPerRecord),
      warnings: setWarnings.slice(0, CREATION_TEMU_PREFLIGHT_LIMITS.maxProblemsPerRecord),
    };
  });

  const blockerCount = blockers.length;
  const warningCount = warnings.length;
  return {
    version: 1,
    template: normalizedTemplate,
    stats: {
      templateCount: normalizedTemplate.name || normalizedTemplate.version || normalizedTemplate.sheetName ? 1 : 0,
      setCount: records.length,
      skuCount: rows.length,
      imageCount: requirements.length,
      pendingUploadCount: imageStats.pendingUploadCount,
      uploadedCount: imageStats.uploadedCount,
      cacheReuseCount: imageStats.cacheReuseCount,
      blockerCount,
      warningCount,
    },
    strictReady: blockerCount === 0,
    blockers: blockers.slice(0, CREATION_TEMU_PREFLIGHT_LIMITS.maxProblems),
    warnings: warnings.slice(0, CREATION_TEMU_PREFLIGHT_LIMITS.maxProblems),
    records,
    truncated: {
      blockers: blockerCount > CREATION_TEMU_PREFLIGHT_LIMITS.maxProblems,
      warnings: warningCount > CREATION_TEMU_PREFLIGHT_LIMITS.maxProblems,
      records: records.some((record) =>
        record.blockerCount > CREATION_TEMU_PREFLIGHT_LIMITS.maxProblemsPerRecord ||
        record.warningCount > CREATION_TEMU_PREFLIGHT_LIMITS.maxProblemsPerRecord),
    },
  };
}
