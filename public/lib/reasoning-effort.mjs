import { DEFAULT_REASONING_EFFORT, REASONING_EFFORT_OPTIONS } from "./studio-constants.mjs";

export function normalizeSelectedReasoningEffort(value) {
  const effort = String(value || "").trim().toLowerCase();
  return REASONING_EFFORT_OPTIONS.includes(effort) ? effort : DEFAULT_REASONING_EFFORT;
}

export function nearestReasoningEffort(requested, supported) {
  const index = REASONING_EFFORT_OPTIONS.indexOf(normalizeSelectedReasoningEffort(requested));
  return REASONING_EFFORT_OPTIONS.filter((value) => supported.includes(value))
    .sort((a, b) => Math.abs(REASONING_EFFORT_OPTIONS.indexOf(a) - index) - Math.abs(REASONING_EFFORT_OPTIONS.indexOf(b) - index))[0];
}

export function mapReasoningRequest(body, url) {
  if (!body.reasoning?.effort && !body.reasoning_effort) return body;
  const effort = normalizeSelectedReasoningEffort(body.reasoning?.effort || body.reasoning_effort);
  const result = { ...body };
  if (/\/chat\/completions\/?(?:\?|$)/.test(String(url))) {
    result.reasoning_effort = effort;
    delete result.reasoning;
  } else if (/\/responses\/?(?:\?|$)/.test(String(url))) {
    result.reasoning = { ...body.reasoning, effort };
    delete result.reasoning_effort;
  }
  return result;
}

function reasoningAdjustment(body, payload) {
  const error = payload?.error || payload;
  const message = String(error?.message || "");
  const parameter = String(error?.param || error?.parameter || "");
  if (parameter && !/^reasoning(?:[._]effort)?$/.test(parameter)) return;
  if (!/reasoning(?:[._\s]+effort)?|思考等级|推理强度/i.test(`${parameter} ${message}`)) return;
  const code = String(error?.code || "");
  if (!/unsupported|not[_ ]supported|does(?: not|n't) support|invalid[_ ](?:value|enum)|unknown[_ ](?:parameter|field)|unrecognized|not (?:allowed|permitted)|不支持/i.test(`${code} ${message}`)) return;
  const requested = body.reasoning?.effort || body.reasoning_effort;
  if (!requested) return;
  const list = message.match(/(?:supported|allowed|valid|permitted)\s+(?:values?|levels?|efforts?|options?)(?:\s+are)?\s*[:=]?\s*([\s\S]*)|only\s+supports?\s*[:=]?\s*([\s\S]*)|(?:must be|expected)\s+(?:one of|in)\s*[:=]?\s*([\s\S]*)/i);
  const advertised = error?.supported_values || error?.allowed_values || payload?.supported_values;
  const supported = Array.isArray(advertised)
    ? advertised.filter((value) => REASONING_EFFORT_OPTIONS.includes(value))
    : (list?.slice(1).filter(Boolean).join(" ").toLowerCase().match(/\b(?:none|minimal|low|medium|high|xhigh|max)\b/g) || []);
  const unsupportedParameter = /unsupported_parameter|unknown_parameter|unrecognized_parameter/i.test(code)
    || /(?:unknown|unrecognized|unsupported)\s+(?:parameter|field|request argument)|(?:parameter|field)[\s\S]*not supported|does(?: not|n't) support[\s\S]*(?:parameter|reasoning)/i.test(message);
  const actual = supported.length
    ? nearestReasoningEffort(requested, supported.filter((value) => value !== requested))
    : unsupportedParameter ? null : nearestReasoningEffort(requested, REASONING_EFFORT_OPTIONS.filter((value) => value !== requested));
  if (actual === undefined) return;
  const next = { ...body };
  if (actual === null) {
    delete next.reasoning;
    delete next.reasoning_effort;
  } else if (body.reasoning_effort) next.reasoning_effort = actual;
  else next.reasoning = { ...body.reasoning, effort: actual };
  return { body: next, requestedReasoningEffort: requested, actualReasoningEffort: actual, message: `上游不支持思考等级 ${requested}，${actual === null ? "改为省略不支持的思考参数" : `自动调整为 ${actual}`}。` };
}

// 只重试明确的参数拒绝；不读取成功流、不重放状态未知的生图任务。
export async function requestWithReasoningFallback(fetchImpl, url, init, { onAdjustment } = {}) {
  let body;
  try { body = typeof init.body === "string" ? JSON.parse(init.body) : null; } catch { /* 非 JSON 请求保持原样。 */ }
  if (!body || (!body.reasoning?.effort && !body.reasoning_effort)) return fetchImpl(url, init);
  body = mapReasoningRequest(body, url);
  const send = () => {
    init.signal?.throwIfAborted();
    return fetchImpl(url, { ...init, body: JSON.stringify(body) });
  };
  const response = await send();
  if (![400, 422].includes(response.status) || !response.clone) return response;
  let payload;
  try { payload = await response.clone().json(); } catch { return response; }
  if (payload?.id || payload?.response?.id || payload?.error?.response_id) return response;
  const adjustment = reasoningAdjustment(body, payload);
  if (!adjustment || fetchImpl.remainingTextRequests === 0) return response;
  init.signal?.throwIfAborted();
  body = adjustment.body;
  await onAdjustment?.({ stage: "retrying", requestedReasoningEffort: adjustment.requestedReasoningEffort, actualReasoningEffort: adjustment.actualReasoningEffort, message: adjustment.message });
  const headers = init.headers || {};
  if (headers["X-Client-Request-Attempt"]) init = { ...init, headers: { ...headers, "X-Client-Request-Attempt": String(Number(headers["X-Client-Request-Attempt"]) + 1) } };
  return send();
}

export function withTextRequestBudget(fetchImpl, maxRequests = 2) {
  let count = 0;
  const boundedFetch = (url, init) => {
    init.signal?.throwIfAborted();
    if (count >= maxRequests) throw new Error(`文本请求已用完 ${maxRequests} 次上游 POST 预算，请检查模型兼容性或重新发起。`);
    count += 1;
    return fetchImpl(url, init);
  };
  Object.defineProperty(boundedFetch, "remainingTextRequests", { get: () => Math.max(0, maxRequests - count) });
  return boundedFetch;
}
