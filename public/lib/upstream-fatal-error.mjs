// Account-level upstream failures: quota exhausted, key rejected, billing off.
// Every sibling item in the batch hits exactly the same wall, so retrying one or
// launching the next only multiplies wasted upstream calls and buries the real
// cause under a wall of identical card errors.
//
// The classifier reads the text produced by `formatHttpErrorMessage`, because a
// fan-out worker only ever catches an Error. It is deliberately conservative:
// misjudging a per-item failure as account-level would abort a batch that could
// still succeed, which is worse than the waste this guards against.

// 403 is NOT here: relays use it for content policy, region blocks and auth
// alike, so it cannot be read as an account signal on its own. 429 and 5xx stay
// out too — they are transient and keep their existing in-run retry.
const FATAL_HTTP_STATUSES = new Set([401, 402]);

// Codes are authoritative regardless of status, because OpenAI itself returns
// `insufficient_quota` with HTTP 429.
const FATAL_ERROR_CODES = new Set([
  "insufficient_quota",
  "invalid_api_key",
  "invalid_authentication",
  "account_deactivated",
  "billing_hard_limit_reached",
  "billing_not_active",
  "quota_exceeded",
]);

const ABORT_MESSAGE_PREFIX = "已中止本批剩余任务";

function readMessage(value) {
  if (typeof value === "string") {
    return value;
  }

  if (value instanceof Error) {
    return String(value.message || "");
  }

  return "";
}

// The status is the first part of the formatted message, so the first match is
// the real one even when a relay's detail text mentions another status.
function parseHttpStatus(message) {
  const matched = message.match(/HTTP\s+(\d{3})/);
  return matched ? Number(matched[1]) : 0;
}

function parseErrorCode(message) {
  const matched = message.match(/错误码\s+([^\s，,。]+)/);
  return matched ? matched[1].trim().toLowerCase() : "";
}

// Never throws: a classification miss must not turn into a failed request.
export function isFatalUpstreamError(value) {
  const message = readMessage(value).trim();
  if (!message) {
    return false;
  }

  if (FATAL_ERROR_CODES.has(parseErrorCode(message))) {
    return true;
  }

  return FATAL_HTTP_STATUSES.has(parseHttpStatus(message));
}

// Keeps the original upstream reason inside the text, so an aborted item still
// tells the user why, and so re-classifying an aborted item's own error still
// reports account-level. That self-consistency is load-bearing: the browser
// decides whether to skip auto-repair from item error text alone.
export function getFatalUpstreamAbortMessage(reason) {
  const cleaned = readMessage(reason).trim();
  return cleaned ? `${ABORT_MESSAGE_PREFIX}：${cleaned}` : `${ABORT_MESSAGE_PREFIX}：上游账号级错误。`;
}
