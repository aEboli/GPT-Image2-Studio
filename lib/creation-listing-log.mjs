import { upsertGenerationLogGroupEntry } from "./generation-log-store.mjs";
import { sanitizeCreationListingError } from "./creation-listing-error.mjs";

const phaseLabels = { queued: "排队中", started: "开始生成", waiting: "等待回答", connected: "等待回答", receiving: "正在接收", received: "已接收", buffered: "已接收", validating: "正在校验", cooldown: "限流冷却", completed: "已完成", error: "失败", interrupted: "已中断" };
const numericFields = (source, keys) => Object.fromEntries(keys.filter((key) => Number.isFinite(source?.[key]) && source[key] >= 0).map((key) => [key, source[key]]));
const identifier = (value) => String(value || "").replace(/[^\w:-]/g, "").slice(0, 100);

export function normalizeCreationListingLogEvents(events = []) {
  return events.slice(-12).map((event) => ({
    batchId: identifier(event.batchId), setId: identifier(event.setId), requestId: identifier(event.requestId),
    stage: identifier(event.stage), at: String(event.at || "").slice(0, 30),
    ...numericFields(event, ["attempt", "elapsedMs", "httpStatus", "retryAfterMs"]),
    ...(event.errorKind ? { errorKind: identifier(event.errorKind) } : {}),
    ...(event.message ? { message: sanitizeCreationListingError(event.message) } : {}),
    timing: numericFields(event.timing, ["queueMs", "headersMs", "firstByteMs", "firstTextMs", "receiveMs", "validationMs", "totalMs"]),
    usage: numericFields(event.usage, ["inputTokens", "outputTokens", "reasoningTokens"]),
  }));
}

export function recordCreationListingLog(store, event, { productName = "未命名商品", totalCount = event.totalCount || 1, at = new Date().toISOString() } = {}) {
  const groupId = `listing:${identifier(event.batchId || event.setId)}`;
  if (event.stage === "batch-completed" && event.batchId) {
    return upsertGenerationLogGroupEntry(store, {
      channel: "creation", groupId, groupLabel: "Listing 批量生成", groupUnit: "套", totalCount, at,
      listingBatchResult: numericFields(event, ["generatedCount", "failedCount", "unstartedCount", "skippedCount", "elapsedMs"]),
    });
  }
  if (!event.setId || !phaseLabels[event.stage]) return store;
  const key = `${groupId}:${identifier(event.setId)}`;
  const previous = store.channels?.creation?.find((row) => row.groupId === groupId)?.children?.find((child) => child.key === key);
  const entry = normalizeCreationListingLogEvents([{ ...event, at }])[0];
  const history = [...(previous?.listingEvents || [])];
  const last = history.at(-1);
  if (last?.stage === entry.stage && last?.attempt === entry.attempt && last?.requestId === entry.requestId) history[history.length - 1] = entry;
  else history.push(entry);
  const terminal = ["completed", "error", "interrupted"].includes(event.stage);
  const detail = [phaseLabels[event.stage], entry.requestId && `请求 ${entry.requestId.slice(0, 8)}`, entry.attempt && `第 ${entry.attempt} 次`, Number.isFinite(entry.elapsedMs) && `${(entry.elapsedMs / 1000).toFixed(1)} 秒`, entry.message].filter(Boolean).join(" · ");
  return upsertGenerationLogGroupEntry(store, {
    channel: "creation", groupId, groupLabel: "Listing 批量生成", groupUnit: "套", groupItemId: identifier(event.setId), key,
    totalCount, title: `Listing · ${sanitizeCreationListingError(productName)}`, detail, at,
    status: event.stage === "completed" ? "done" : terminal ? "error" : "active",
    listingEvents: normalizeCreationListingLogEvents(history),
  });
}
