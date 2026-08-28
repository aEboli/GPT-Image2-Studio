export const DEFAULT_GENERATION_ACTIVITY_DETAIL_FALLBACK = "未命名任务";
export const CANCELED_GENERATION_ACTIVITY_DETAIL = "已取消排队任务";

const PROMPT_SUFFIX_STRIP_DETAIL_HEADS = new Set([
  "已取消排队任务",
  "正在生成图片",
  "正在保存到本地图片目录",
  "已收到中途预览",
  "正在写入本地 output",
  "图像已成功生成",
  "已提交到服务器队列，等待后台生成",
  "terminated",
]);
const ACTIVITY_DETAIL_PREFIX_PATTERN = /^(排队中|heartbeat(?:（[^）]+）)?|上游重试|缺最终图补救|正在回查原任务|等待原任务结果|已找回原任务|原任务失败|原结果未知|最终失败)：/;

function cleanActivityDetail(value) {
  return String(value || "").trim();
}

function hasDetailPrefix(value, prefix) {
  return cleanActivityDetail(value).startsWith(`${prefix}：`);
}

function hasHeartbeatPrefix(value) {
  return /^heartbeat(?:（[^）]+）)?：/.test(cleanActivityDetail(value));
}

function labelActivityDetail(prefix, detail, fallback = "") {
  const text = cleanActivityDetail(detail) || cleanActivityDetail(fallback);
  if (!text) {
    return cleanActivityDetail(prefix);
  }

  if (hasDetailPrefix(text, prefix)) {
    return text;
  }

  if (prefix === "heartbeat" && hasHeartbeatPrefix(text)) {
    return text;
  }

  return `${prefix}：${text}`;
}

function looksLikePromptSuffix(value) {
  const text = cleanActivityDetail(value);
  return /^(\{|\[)/.test(text) || /("prompt"|prompt|Quick Blend pair|Reference image|参考图|提示词)/i.test(text);
}

function formatGenerationActivitySummaryLabel(summary) {
  const text = cleanActivityDetail(summary).replace(/[。.!！？?]+$/, "");
  if (!text) {
    return "";
  }

  if (/^heartbeat(?:（[^）]+）)?$/.test(text) || ["排队中", "上游重试", "缺最终图补救", "正在回查原任务", "等待原任务结果", "已找回原任务", "原任务失败", "原结果未知", "正在生成图片", "正在保存到本地图片目录", "已收到中途预览", "正在写入本地 output"].includes(text)) {
    return "图片生成中";
  }

  if (["图像已成功生成", "图片已成功生成", "生成完成"].includes(text)) {
    return "图片已生成";
  }

  if (["最终失败", "生成请求失败", "错误"].includes(text)) {
    return "生成失败";
  }

  return summary;
}

export function buildGenerationTaskStatusText({
  status,
  statusStage,
  statusText,
  errorMessage,
  fallback = DEFAULT_GENERATION_ACTIVITY_DETAIL_FALLBACK,
} = {}) {
  const normalizedStatus = cleanActivityDetail(status);
  const normalizedStage = cleanActivityDetail(statusStage);
  const detail = cleanActivityDetail(statusText);
  const errorDetail = cleanActivityDetail(errorMessage);
  const fallbackDetail = cleanActivityDetail(fallback) || DEFAULT_GENERATION_ACTIVITY_DETAIL_FALLBACK;

  if (normalizedStatus === "error") {
    return labelActivityDetail("最终失败", errorDetail || detail, "生成请求失败");
  }

  if (normalizedStage === "queued") {
    return labelActivityDetail("排队中", detail, "等待后台生成");
  }

  if (normalizedStage === "waiting_upstream") {
    return labelActivityDetail("heartbeat", detail, "上游服务仍在处理，请保持页面打开");
  }

  if (normalizedStage === "waiting_final") {
    return labelActivityDetail("heartbeat", detail, "仍在等待最终图，请保持页面打开");
  }

  if (normalizedStage === "retrying_upstream") {
    return labelActivityDetail("上游重试", detail, "正在重试上游请求");
  }

  if (normalizedStage === "missing_final_recovery" || normalizedStage === "fallback_final_image") {
    return labelActivityDetail("缺最终图补救", detail, "未收到最终图，正在兜底获取结果");
  }

  if (normalizedStage === "recovering_original") {
    return labelActivityDetail("正在回查原任务", detail, "正在查询原任务结果，不会重新生成");
  }

  if (normalizedStage === "waiting_original") {
    return labelActivityDetail("等待原任务结果", detail, "原任务仍在处理，不会重新生成");
  }

  if (normalizedStage === "recovered_original") {
    return labelActivityDetail("已找回原任务", detail, "已找回原任务的最终图片");
  }

  if (normalizedStage === "original_failed") {
    return labelActivityDetail("原任务失败", detail, "上游已确认原任务失败");
  }

  if (normalizedStage === "recovery_unavailable") {
    return labelActivityDetail("原结果未知", detail, "无法确认原任务最终结果，系统未自动重新生成");
  }

  if (/未返回最终图|没有拿到最终|non-streaming|without streaming/i.test(detail)) {
    return labelActivityDetail("缺最终图补救", detail, "未收到最终图，正在兜底获取结果");
  }

  return detail || fallbackDetail;
}

export function buildGenerationTaskActivityDetail({
  status,
  statusStage,
  statusText,
  errorMessage,
  fallback = DEFAULT_GENERATION_ACTIVITY_DETAIL_FALLBACK,
} = {}) {
  return buildGenerationTaskStatusText({
    status,
    statusStage,
    statusText,
    errorMessage,
    fallback,
  });
}

export function buildCanceledGenerationActivityDetail() {
  return CANCELED_GENERATION_ACTIVITY_DETAIL;
}

export function formatGenerationActivityModeLabel(imageRoute) {
  const route = cleanActivityDetail(imageRoute).toLowerCase();
  if (route === "c") {
    return "Gemini模型";
  }
  return route === "b" ? "直接调用模式" : route ? "路由模式" : "";
}

export function getGenerationActivityDisplayText(detail) {
  const text = cleanActivityDetail(detail);
  if (!text) {
    return { summary: "", detail: "" };
  }

  const prefixedDetailMatch = text.match(/^(排队中|heartbeat(?:（[^）]+）)?|上游重试|缺最终图补救|正在回查原任务|等待原任务结果|已找回原任务|原任务失败|原结果未知|最终失败|生成请求失败)[：:]\s*(.+)$/);
  if (prefixedDetailMatch) {
    return { summary: formatGenerationActivitySummaryLabel(prefixedDetailMatch[1]), detail: cleanActivityDetail(prefixedDetailMatch[2]) };
  }

  const eventDetailMatch = text.match(/^(.*?)([。.]?\s*)(?:已收到事件|received events)\s*[：:]\s*(.+)$/i);
  if (!eventDetailMatch) {
    return { summary: formatGenerationActivitySummaryLabel(text), detail: "" };
  }

  let summary = cleanActivityDetail(eventDetailMatch[1]);
  const separator = cleanActivityDetail(eventDetailMatch[2]);
  const eventDetail = cleanActivityDetail(eventDetailMatch[3]);
  if (!summary || !eventDetail) {
    return { summary: text, detail: "" };
  }

  if (separator && !/[。.!！？?]$/.test(summary)) {
    summary = `${summary}${separator}`;
  } else if (!/[。.!！？?]$/.test(summary)) {
    summary = `${summary}。`;
  }

  return { summary: formatGenerationActivitySummaryLabel(summary), detail: eventDetail };
}

export function sanitizeGenerationActivityDetail(detail) {
  const text = cleanActivityDetail(detail);
  const parts = text.split(" · ");
  if (parts.length < 2) {
    return text;
  }

  const head = cleanActivityDetail(parts[0]);
  const tail = cleanActivityDetail(parts.at(-1));
  const hasPromptSuffix =
    PROMPT_SUFFIX_STRIP_DETAIL_HEADS.has(head) ||
    ACTIVITY_DETAIL_PREFIX_PATTERN.test(head) ||
    (head === "生成请求失败" && (parts.length >= 3 || looksLikePromptSuffix(tail)));

  return hasPromptSuffix ? parts.slice(0, -1).join(" · ").trim() || head : text;
}

