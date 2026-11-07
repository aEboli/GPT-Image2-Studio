export function sanitizeCreationListingError(value) {
  return String(value || "Listing 生成失败。")
    .replace(/\b(?:sk-[A-Za-z0-9_-]+|Bearer\s+[^\s,;"}]+)/gi, "[已隐藏认证信息]")
    .replace(/([?&](?:api[_-]?key|token|secret)=)[^&\s]+/gi, "$1[已隐藏]")
    .slice(0, 800);
}

export function createCreationListingUpstreamError(response, payload = {}, { now = Date.now() } = {}) {
  const detail = payload?.error || payload || {};
  const message = String(detail.message || payload?.message || `Listing request failed with HTTP ${response.status}`);
  const code = String(detail.code || detail.type || "");
  const temporaryCapacity = /capacity|overload|(?:模型|通道|服务).*(?:繁忙|暂时不可用)/i.test(message);
  const quotaMessage = /quota.*(?:exhaust|exceed|insufficient)|(?:insufficient|exhausted).*credit|额度.*(?:用完|耗尽|不足)|余额不足|欠费/i.test(message);
  const quota = quotaMessage || !temporaryCapacity && /insufficient_quota|quota_exceeded|billing_hard_limit|billing_not_active/i.test(code);
  const authentication = response.status === 401 || /invalid_api_key|invalid_authentication|account_deactivated/i.test(code);
  const rateLimit = !quota && !authentication && (response.status === 429 || response.status === 503 || temporaryCapacity
    || /rate[_ -]?limit|too many|concurr|overload|限流|并发|繁忙/i.test(`${code} ${message}`));
  const retryAfter = response.headers?.get?.("retry-after");
  let retryAfterMs = 5000;
  if (retryAfter != null && String(retryAfter).trim()) {
    const seconds = Number(retryAfter);
    const milliseconds = Number.isFinite(seconds) && seconds >= 0 ? seconds * 1000 : Date.parse(retryAfter) - now;
    if (Number.isFinite(milliseconds) && milliseconds >= 0) retryAfterMs = milliseconds;
  }
  const error = new Error(sanitizeCreationListingError(message));
  return Object.assign(error, {
    httpStatus: response.status,
    code: /^[\w.-]{1,100}$/.test(code) ? code : "",
    errorKind: authentication ? "authentication" : quota || response.status === 402 && !temporaryCapacity ? "quota" : rateLimit ? "rate_limit" : "request",
    stopBatch: authentication || quota || response.status === 402 && !temporaryCapacity || rateLimit && retryAfterMs > 60000,
    ...(rateLimit ? { retryAfterMs } : {}),
  });
}

export function creationListingErrorMetadata(error) {
  return {
    message: sanitizeCreationListingError(error instanceof Error ? error.message : error),
    ...(Number.isInteger(error?.httpStatus) ? { httpStatus: error.httpStatus } : {}),
    ...(error?.errorKind ? { errorKind: error.errorKind } : {}),
    ...(error?.code && /^[\w.-]{1,100}$/.test(error.code) ? { code: error.code } : {}),
    ...(Number.isFinite(error?.retryAfterMs) ? { retryAfterMs: error.retryAfterMs } : {}),
    ...(error?.stopBatch ? { stopBatch: true } : {}),
  };
}
