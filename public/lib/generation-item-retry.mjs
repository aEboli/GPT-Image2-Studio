// Per-run retry accounting for set-based generation (Creation and Portrait).
//
// A failed item is pushed back onto the tail of the live task queue instead of
// waiting for the whole first pass to finish. Counts live only for the duration
// of one request, so they are never persisted into a set manifest.

export const IN_RUN_MAX_RETRIES = 1;

function cleanString(value) {
  return String(value || "").trim();
}

function normalizeMaxRetries(value) {
  const normalized = Number.parseInt(String(value), 10);
  return Number.isFinite(normalized) && normalized >= 0 ? normalized : IN_RUN_MAX_RETRIES;
}

export function buildRetryTaskId(baseTaskId, attempt) {
  const base = cleanString(baseTaskId);
  const normalizedAttempt = Number.parseInt(String(attempt), 10);
  if (!Number.isFinite(normalizedAttempt) || normalizedAttempt <= 0) {
    return base;
  }

  return `${base}-r${normalizedAttempt}`;
}

export function getRequeueNotice({ message = "", attempt = 1, maxRetries = IN_RUN_MAX_RETRIES } = {}) {
  const reason = cleanString(message);
  const suffix = `正在重排队重试 ${attempt}/${normalizeMaxRetries(maxRetries)}。`;
  return reason ? `${reason}，${suffix}` : `生成失败，${suffix}`;
}

export function createInRunRetryLedger({ maxRetries = IN_RUN_MAX_RETRIES } = {}) {
  const normalizedMaxRetries = normalizeMaxRetries(maxRetries);
  const retryCountByItemId = new Map();

  function getRetryCount(itemId) {
    return retryCountByItemId.get(cleanString(itemId)) || 0;
  }

  function canRequeue(itemId) {
    return normalizedMaxRetries > 0 && getRetryCount(itemId) < normalizedMaxRetries;
  }

  // Reserves the next retry slot for an item and returns that attempt number, or
  // 0 when the item has no allowance left.
  function claimRetry(itemId) {
    if (!canRequeue(itemId)) {
      return 0;
    }

    const key = cleanString(itemId);
    const attempt = getRetryCount(key) + 1;
    retryCountByItemId.set(key, attempt);
    return attempt;
  }

  function getTaskId(baseTaskId, itemId) {
    return buildRetryTaskId(baseTaskId, getRetryCount(itemId));
  }

  return {
    maxRetries: normalizedMaxRetries,
    canRequeue,
    claimRetry,
    getRetryCount,
    getTaskId,
  };
}
