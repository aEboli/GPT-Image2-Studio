function parseJsonBody(body) {
  if (typeof body !== "string" || !body.trim()) {
    return null;
  }

  try {
    return JSON.parse(body);
  } catch {
    return null;
  }
}

function firstErrorCode(...values) {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }

    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function firstErrorText(...values) {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }

  return "";
}

function compactErrorDetail(value) {
  const detail = String(value || "").replace(/\s+/g, " ").trim();
  if (detail.length <= 220) {
    return detail;
  }

  return `${detail.slice(0, 217)}...`;
}

function extractHttpErrorDetail({ status, body } = {}) {
  if (Number(status) >= 500) {
    return "";
  }

  const payload = parseJsonBody(body);
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const message = compactErrorDetail(
    firstErrorText(payload.error?.message, payload.message, payload.detail),
  );
  const param = compactErrorDetail(firstErrorText(payload.error?.param, payload.param));

  if (!message) {
    return param ? `参数 ${param}` : "";
  }

  return param ? `${message}（参数 ${param}）` : message;
}

function extractTextErrorCode(body) {
  if (typeof body !== "string") {
    return "";
  }

  return (
    body.match(/"error_code"\s*:\s*"?([A-Za-z0-9_.-]+)"?/i)?.[1] ||
    body.match(/"code"\s*:\s*"([^"]+)"/i)?.[1] ||
    body.match(/"status"\s*:\s*(\d{3})/i)?.[1] ||
    ""
  );
}

export function extractHttpErrorCode({ status, body } = {}) {
  const payload = parseJsonBody(body);
  if (!payload || typeof payload !== "object") {
    return extractTextErrorCode(body) || (status ? String(status) : "");
  }

  return firstErrorCode(
    payload.error_code,
    payload.code,
    payload.status,
    payload.error?.error_code,
    payload.error?.code,
    payload.error?.status,
    status,
  );
}

export function formatHttpErrorMessage({ label = "请求失败", status, body } = {}) {
  const httpStatus = status ? `HTTP ${status}` : "";
  const errorCode = extractHttpErrorCode({ status, body });
  const detail = extractHttpErrorDetail({ status, body });
  const parts = [httpStatus, errorCode ? `错误码 ${errorCode}` : "", detail].filter(Boolean);

  return `${label}：${parts.join("，") || "未知错误"}`;
}
