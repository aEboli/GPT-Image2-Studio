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

  return "a";
}

function formatParameterCallMode(route) {
  if (route === "c") {
    return "Gemini模型";
  }
  return route === "b" ? "直接调用模式" : "路由模式";
}

export function formatImageModelLabel(imageModel) {
  if (!imageModel || imageModel === "gpt-image-2") {
    return "GPT Image 2.0";
  }

  return imageModel;
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

export function buildParameterText(item = {}, fallbackConfig = {}) {
  const referenceImageNames = Array.isArray(item.referenceImageNames)
    ? item.referenceImageNames.map((value) => String(value).trim()).filter(Boolean)
    : [];
  const referenceNames = referenceImageNames.length > 0 ? referenceImageNames.join(", ") : item.referenceImageName;
  const hasReferenceImage = Boolean(item.hasReferenceImage || referenceImageNames.length > 0 || item.referenceImageName);
  const referenceText = hasReferenceImage
    ? `有（${referenceImageNames.length || 1} 张${referenceNames ? `：${referenceNames}` : ""}）`
    : "无";
  const generationDuration = formatGenerationDuration(item.generationDurationMs);
  const route = normalizeParameterImageRoute(item.imageRoute || item.generationRoute || fallbackConfig.imageRoute);
  const isDirectImageRoute = route === "b";
  const relayBaseUrl = item.baseUrl || (isDirectImageRoute ? fallbackConfig.directBaseUrl : fallbackConfig.baseUrl);

  const lines = [
    `调用模式：${formatParameterCallMode(route)}`,
    `比例：${item.ratioLabel || item.ratio || "未记录"}`,
    `请求分辨率：${item.size || "未记录"}`,
    `实际生成分辨率：${item.actualSize || "未记录"}`,
    `格式：${String(item.format || "png").toUpperCase()}`,
    `质量：${item.quality || "high"}`,
  ];

  if (!isDirectImageRoute) {
    lines.push(`思考等级：${REASONING_LABELS[item.reasoningEffort] || item.reasoningEffort || "未记录"}`);
  }

  lines.push(`图像模型：${formatImageModelLabel(item.imageModel)}`);

  if (!isDirectImageRoute) {
    lines.push(`外层模型：${item.responsesModel || fallbackConfig.responsesModel || "gpt-5.4"}`);
  }

  lines.push(`参考图：${referenceText}`);

  if (generationDuration) {
    lines.push(`图片生成耗时：${generationDuration}`);
  }

  if (relayBaseUrl) {
    lines.push(`中转：${relayBaseUrl}`);
  }

  if (item.absolutePath) {
    lines.push(`本地文件：${item.absolutePath}`);
  }

  if (item.relativePath) {
    lines.push(`相对路径：${item.relativePath}`);
  }

  return lines.join("\n");
}

export function formatRecentOutputMeta(item = {}) {
  const size = item.size || "未记录";
  return `${size} | ${formatImageModelLabel(item.imageModel)}`;
}
