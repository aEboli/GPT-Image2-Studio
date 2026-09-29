import { DEFAULT_GROK_IMAGE_MODEL, DEFAULT_RESPONSES_MODEL } from "./model-defaults.mjs";
import { normalizeStoredImageQuality } from "./image-quality-options.mjs";

const REASONING_LABELS = {
  low: "Low",
  medium: "Medium",
  high: "High",
  xhigh: "XHigh",
};

function normalizeParameterImageRoute(value) {
  const route = String(value || "").trim().toLowerCase();
  if (route === "b" || route === "route-b" || route === "direct") {
    return "b";
  }
  if (route === "c" || route === "route-c" || route === "protocol" || route === "model-protocol") {
    return "c";
  }
  if (route === "d" || route === "route-d" || route === "grok") {
    return "d";
  }

  return "a";
}

function formatParameterCallMode(route) {
  if (route === "c") {
    return "Gemini模型";
  }
  if (route === "d") {
    return "Grok";
  }
  return route === "b" ? "直接调用模式" : "路由模式";
}

const IMAGE_MODEL_LABELS = {
  "gpt-image-2": "GPT Image 2.0",
  "gpt-image-2.5-sunburst": "GPT Image 2.5 Sunburst",
  "gpt-image-2.5-flare": "GPT Image 2.5 Flare",
};

export function formatImageModelLabel(imageModel) {
  if (!imageModel) {
    return IMAGE_MODEL_LABELS["gpt-image-2"];
  }

  return IMAGE_MODEL_LABELS[imageModel] || imageModel;
}

export function formatGenerationDuration(value) {
  const durationMs = Number(value);
  if (!Number.isFinite(durationMs) || durationMs < 0) {
    return "";
  }

  const roundedMs = Math.round(durationMs);
  if (roundedMs < 1000) {
    return `${roundedMs} 毫秒`;
  }

  if (roundedMs < 60000) {
    return `${(roundedMs / 1000).toFixed(roundedMs < 10000 ? 1 : 0).replace(/\.0$/, "")} 秒`;
  }

  const minutes = Math.floor(roundedMs / 60000);
  const seconds = Math.round((roundedMs % 60000) / 1000);
  return seconds > 0 ? `${minutes} 分 ${seconds} 秒` : `${minutes} 分`;
}

function parseStoredBoolean(value) {
  if (typeof value === "boolean") {
    return value;
  }

  const normalized = String(value ?? "").trim().toLowerCase();
  if (["1", "true", "on", "yes", "enabled"].includes(normalized)) {
    return true;
  }
  if (["0", "false", "off", "no", "disabled"].includes(normalized)) {
    return false;
  }
  return null;
}

function formatOptionalBoolean(value, fallbackValue, { strictSnapshot = false } = {}) {
  const hasValue = value !== undefined && value !== null && String(value).trim() !== "";
  const resolvedValue = hasValue ? value : strictSnapshot ? undefined : fallbackValue;
  const parsed = parseStoredBoolean(resolvedValue);
  if (parsed === null) {
    return "未记录";
  }
  return parsed ? "是" : "否";
}

function formatOptionalBackground(value, { strictSnapshot = false } = {}) {
  const normalized = String(value ?? "").trim().toLowerCase();
  if (normalized === "transparent") {
    return "是";
  }
  if (normalized === "opaque") {
    return "否";
  }
  return strictSnapshot ? "未记录" : "未记录";
}

function buildParameterContext(item = {}, fallbackConfig = {}, options = {}) {
  const strictSnapshot = options.strictSnapshot === true;
  const referenceImageNames = Array.isArray(item.referenceImageNames)
    ? item.referenceImageNames.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const referenceNames = referenceImageNames.length > 0 ? referenceImageNames.join(", ") : item.referenceImageName;
  const hasReferenceSnapshot = Object.prototype.hasOwnProperty.call(item, "hasReferenceImage")
    || referenceImageNames.length > 0
    || Boolean(item.referenceImageName);
  const hasReferenceImage = Boolean(item.hasReferenceImage || referenceImageNames.length > 0 || item.referenceImageName);
  const referenceText = strictSnapshot && !hasReferenceSnapshot
    ? "未记录"
    : hasReferenceImage
      ? `有（${referenceImageNames.length || 1} 张${referenceNames ? `：${referenceNames}` : ""}）`
      : "无";
  const generationDuration = formatGenerationDuration(item.generationDurationMs);
  const routeValue = item.imageRoute || item.generationRoute || (strictSnapshot ? "" : fallbackConfig.imageRoute);
  const route = routeValue ? normalizeParameterImageRoute(routeValue) : "";
  const isDirectImageRoute = route === "b";
  const isGrokImageRoute = route === "d";
  const relayBaseUrl = item.baseUrl || (strictSnapshot
    ? ""
    : isDirectImageRoute
      ? fallbackConfig.directBaseUrl
      : isGrokImageRoute
        ? fallbackConfig.grokBaseUrl
        : route === "c"
          ? fallbackConfig.protocolBaseUrl
          : fallbackConfig.baseUrl);
  const imageModel = item.imageModel || (isGrokImageRoute && !strictSnapshot
    ? fallbackConfig.grokImageModel || DEFAULT_GROK_IMAGE_MODEL
    : "");
  const quality = normalizeStoredImageQuality(item.quality, { imageRoute: route, imageModel });
  const requestedSize = item.requestedSize || item.size;
  const effectiveSize = item.actualSize || item.effectiveSize || item.size;

  return {
    strictSnapshot,
    item,
    fallbackConfig,
    route,
    isDirectImageRoute,
    isGrokImageRoute,
    relayBaseUrl,
    imageModel,
    quality,
    requestedSize,
    effectiveSize,
    referenceText,
    generationDuration,
  };
}

export function buildParameterEntries(item = {}, fallbackConfig = {}, options = {}) {
  const context = buildParameterContext(item, fallbackConfig, options);
  const {
    strictSnapshot,
    route,
    isDirectImageRoute,
    isGrokImageRoute,
    relayBaseUrl,
    imageModel,
    quality,
    requestedSize,
    effectiveSize,
    referenceText,
    generationDuration,
  } = context;
  const imageBackground = item.imageBackground;

  const entries = [
    { label: "调用模式", value: route ? formatParameterCallMode(route) : "未记录" },
    { label: "比例", value: item.ratio || "未记录" },
    { label: "请求分辨率", value: requestedSize || "未记录" },
    { label: "实际生成分辨率", value: effectiveSize || "未记录" },
    { label: "格式", value: item.format ? String(item.format).toUpperCase() : strictSnapshot ? "未记录" : "PNG" },
    { label: "质量", value: quality || (strictSnapshot ? "未记录" : isGrokImageRoute ? "medium" : "high") },
    {
      label: "透明背景",
      value: formatOptionalBackground(imageBackground, { strictSnapshot }),
    },
  ];

  if (!isDirectImageRoute && !isGrokImageRoute) {
    entries.push({ label: "思考等级", value: REASONING_LABELS[item.reasoningEffort] || item.reasoningEffort || "未记录" });
  }

  if (route === "a") {
    entries.push({
      label: "工具传输（路由）",
      value: formatOptionalBoolean(item.includeImageToolModel, fallbackConfig.includeImageToolModel, { strictSnapshot }),
    });
  } else if (route === "b") {
    entries.push({
      label: "流传输（直连）",
      value: formatOptionalBoolean(item.directImageStream, fallbackConfig.directImageStream, { strictSnapshot }),
    });
  }

  entries.push({ label: "图像模型", value: imageModel || !strictSnapshot ? formatImageModelLabel(imageModel) : "未记录" });

  if (!isDirectImageRoute && !isGrokImageRoute) {
    entries.push({
      label: "外层模型",
      value: item.responsesModel || (strictSnapshot ? "未记录" : fallbackConfig.responsesModel || DEFAULT_RESPONSES_MODEL),
    });
  }

  if (item.endpointPath) {
    entries.push({ label: "端点", value: item.endpointPath });
  }

  entries.push({ label: "参考图", value: referenceText });

  if (generationDuration) {
    entries.push({ label: "图片生成耗时", value: generationDuration });
  }

  if (relayBaseUrl) {
    entries.push({ label: "中转", value: relayBaseUrl });
  }

  if (item.absolutePath) {
    entries.push({ label: "本地文件", value: item.absolutePath });
  }

  return entries;
}

export function buildParameterText(item = {}, fallbackConfig = {}, options = {}) {
  return buildParameterEntries(item, fallbackConfig, options)
    .map(({ label, value }) => `${label}：${value}`)
    .join("\n");
}

/* 界面上的「分辨率」一律指成品图的真实像素尺寸，也就是从落盘文件里量出来的 actualSize。
   size 是请求档位（套图模式下还会被平台档案改写），两者经常不同：请求 2048² 实际出 1254² 时
   显示 2048² 是错的。老条目没有 actualSize，退回 size 以免显示空白。
   参数复盘面板另当别论——那里要同时列出请求值与实际值，不走这里。 */
export function resolveDisplayImageSize(item = {}) {
  return String(item.actualSize || item.size || "").trim();
}

export function formatRecentOutputMeta(item = {}) {
  const size = resolveDisplayImageSize(item) || "未记录";
  return `${size} | ${formatImageModelLabel(item.imageModel)}`;
}
