const list = (value) => Array.isArray(value) ? value : [];
const text = (value, limit = 800) => typeof value === "string" ? value.trim().slice(0, limit) : "";

// 只解析完整的顶层字段或 items 元素；字符串中的括号、引号与转义不参与层级计算。
export function readCreationMarketingPartialJson(source = "") {
  const input = String(source).replace(/^\s*```(?:json)?\s*/i, "").trimStart();
  if (!input.startsWith("{")) return {};
  const stack = [];
  const result = {};
  const items = [];
  let quoted = false;
  let escaped = false;
  let stringStart = 0;
  let key = "";
  let fieldStart = -1;
  let itemStart = -1;
  let expectKey = true;
  const accept = (end) => {
    if (fieldStart < 0 || !["product_insights", "audience_strategy", "items"].includes(key)) return;
    try { result[key] = JSON.parse(input.slice(fieldStart, end)); } catch {}
  };
  for (let index = 0; index < input.length; index += 1) {
    const char = input[index];
    if (quoted) {
      if (escaped) escaped = false;
      else if (char === "\\") escaped = true;
      else if (char === '"') {
        quoted = false;
        if (stack.length === 1 && expectKey) {
          try { key = JSON.parse(input.slice(stringStart, index + 1)); } catch { return result; }
          expectKey = false;
        }
      }
      continue;
    }
    if (char === '"') { quoted = true; stringStart = index; continue; }
    if (char === ":" && stack.length === 1) {
      fieldStart = index + 1;
      continue;
    }
    if (char === "{" || char === "[") {
      if (key === "items" && stack.length === 2 && stack[1] === "[" && char === "{") itemStart = index;
      stack.push(char);
      continue;
    }
    if (char === "}" || char === "]") {
      if (stack.at(-1) !== (char === "}" ? "{" : "[")) break;
      stack.pop();
      if (key === "items" && stack.length === 2 && itemStart >= 0) {
        try { items.push(JSON.parse(input.slice(itemStart, index + 1))); } catch {}
        itemStart = -1;
      }
      if (stack.length === 1) accept(index + 1);
      if (!stack.length) { accept(index); break; }
      continue;
    }
    if (char === "," && stack.length === 1) {
      accept(index);
      fieldStart = -1;
      key = "";
      expectKey = true;
    }
  }
  if (!Array.isArray(result.items) && items.length) result.items = items;
  return result;
}

export function summarizeCreationMarketingProgress(payload = {}) {
  const insights = payload.product_insights || payload.productInsights || {};
  const audiences = list(insights.audience_segments || insights.audienceSegments).slice(0, 6)
    .map((entry) => [text(entry?.name, 120), text(entry?.need, 300)].filter(Boolean).join("：")).filter(Boolean);
  if (!audiences.length && text(payload.audience_strategy?.target_audience)) audiences.push(text(payload.audience_strategy.target_audience));
  const items = list(payload.items).slice(0, 20).flatMap((item, index) => {
    if (!item || !text(item.item_id || item.itemId) || !text(item.title) || !text(item.marketing_goal || item.marketingGoal || item.marketingAssignment?.goal) || !text(item.prompt)) return [];
    return [{
      itemId: text(item.item_id || item.itemId, 160), sourceIndex: Number(item.marketingAssignment?.sourceIndex) || index + 1,
      title: text(item.title, 160), imageType: text(item.image_type || item.imageType, 80), goal: text(item.marketing_goal || item.marketingGoal || item.marketingAssignment?.goal),
      creativeBrief: item.creative_brief || item.marketingAssignment?.creativeBrief || {},
      referenceIndexes: list(item.reference_indexes || item.marketingAssignment?.referenceIndexes).filter((value) => Number.isInteger(value) && value > 0).slice(0, 8),
    }];
  });
  return {
    receivedCount: items.length,
    duplicateRisks: list(payload.marketingPlan?.duplicateRisks),
    ...(payload.marketingPlan?.validation ? { validation: payload.marketingPlan.validation } : {}),
    summary: {
      audiences,
      sellingPoints: list(insights.selling_points || insights.sellingPoints).slice(0, 8).map((entry) => text(entry?.text)).filter(Boolean),
      painPoints: list(insights.pain_points || insights.painPoints).slice(0, 6).map((entry) => text(entry?.text)).filter(Boolean),
    },
    items,
  };
}

export const CREATION_MARKETING_PROGRESS_LABELS = {
  preparing: "准备资料", waiting: "等待模型", receiving: "接收规划", retrying: "正在重试", buffered: "网关缓冲返回",
  validating: "校验计划", complete: "规划完成", partial: "部分可用", error: "规划失败", interrupted: "连接中断", reused: "复用已确认计划",
};
export const isCreationMarketingProgressActive = (progress) => Boolean(progress) && !["complete", "partial", "error", "interrupted", "reused"].includes(progress.stage);

export function updateCreationMarketingProgress(previous, event, now = Date.now()) {
  if (!event || !Object.hasOwn(CREATION_MARKETING_PROGRESS_LABELS, event.stage)) return previous;
  const attempt = Number(event.attempt) || previous?.attempt || 0;
  if (previous && attempt < previous.attempt) return previous;
  if (previous && !isCreationMarketingProgressActive(previous) && attempt === previous.attempt && ["preparing", "waiting", "receiving", "validating"].includes(event.stage)) return previous;
  const reset = event.stage === "waiting" && attempt > (previous?.attempt || 0);
  const next = { ...(reset ? {} : previous), ...event, attempt,
    startedAt: previous?.startedAt || now, updatedAt: now,
    elapsedMs: Math.max((Number(previous?.elapsedMs) || 0) + (isCreationMarketingProgressActive(previous) ? Math.max(0, now - previous.updatedAt) : 0), Number(event.elapsedMs) || 0),
    receivedCount: Number(event.receivedCount ?? (reset ? 0 : previous?.receivedCount)) || 0,
    total: Number(event.total ?? previous?.total) || 0,
    productName: event.productName ?? previous?.productName ?? "",
    receivedCharacters: Number(event.receivedCharacters ?? (reset ? 0 : previous?.receivedCharacters)) || 0,
    text: event.text ?? (reset ? "" : previous?.text) ?? "",
    firstTextMs: event.firstTextMs ?? (reset ? undefined : previous?.firstTextMs),
    duplicateRisks: event.duplicateRisks || (reset ? [] : previous?.duplicateRisks) || [],
    summary: event.summary || (reset ? {} : previous?.summary) || {},
    items: event.items || (reset ? [] : previous?.items) || [],
    validation: event.validation || (reset ? null : previous?.validation) || null,
  };
  const history = previous?.history || [];
  const changed = !previous || previous.stage !== next.stage || previous.attempt !== next.attempt;
  next.history = changed ? [...history, { stage: next.stage, attempt, elapsedMs: next.elapsedMs, message: text(event.message) }].slice(-24) : history;
  return next;
}

export function getCreationMarketingProgressForView({ preview = null, planning = false, previewSelected = false, selectedJob = null, setId = "" } = {}) {
  if (planning || previewSelected) return preview;
  if (selectedJob) return selectedJob.marketingProgress || null;
  return preview && (!preview.setId || preview.setId === setId) ? preview : null;
}
