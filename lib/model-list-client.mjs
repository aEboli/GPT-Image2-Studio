import { normalizeApiBaseUrl } from "./api-base-url.mjs";

function normalizeModelsBaseUrl(baseUrl) {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    return "";
  }

  try {
    const url = new URL(normalizedBaseUrl);
    const pathname = url.pathname.replace(/\/+$/, "");
    const segments = pathname.split("/").filter(Boolean);
    const lastSegment = segments[segments.length - 1] || "";
    if (lastSegment.toLowerCase() !== "v1") {
      url.pathname = `${pathname || ""}/v1`;
    }
    url.search = "";
    url.hash = "";
    return url.toString().replace(/\/+$/, "");
  } catch (_error) {
    return /\/v1$/i.test(normalizedBaseUrl) ? normalizedBaseUrl : `${normalizedBaseUrl}/v1`;
  }
}

export function buildModelsEndpoint(baseUrl) {
  const normalizedBaseUrl = normalizeModelsBaseUrl(baseUrl);
  if (!normalizedBaseUrl) {
    throw new Error("缺少中转 URL。");
  }

  return new URL("models", normalizedBaseUrl.endsWith("/") ? normalizedBaseUrl : `${normalizedBaseUrl}/`).toString();
}

export function normalizeModelListPayload(payload) {
  const sourceItems = Array.isArray(payload?.data)
    ? payload.data
    : Array.isArray(payload?.models)
      ? payload.models
      : Array.isArray(payload)
        ? payload
        : [];
  const seen = new Set();
  const models = [];

  for (const item of sourceItems) {
    const id = String(
      typeof item === "string"
        ? item
        : item?.id || item?.name || item?.model || "",
    ).trim();
    if (!id || seen.has(id)) {
      continue;
    }
    seen.add(id);
    models.push(id);
  }

  return models;
}

export async function fetchAvailableModels({ baseUrl, apiKey, fetchImpl = fetch } = {}) {
  const normalizedApiKey = String(apiKey || "").trim();
  if (!normalizedApiKey) {
    throw new Error("当前未保存 API Key，请先在配置中保存。");
  }

  const endpoint = buildModelsEndpoint(baseUrl);
  const response = await fetchImpl(endpoint, {
    method: "GET",
    headers: {
      Accept: "application/json",
      Authorization: `Bearer ${normalizedApiKey}`,
    },
  });
  const rawText = await response.text();
  let payload = null;
  try {
    payload = rawText ? JSON.parse(rawText) : null;
  } catch (_error) {
    payload = null;
  }

  if (!response.ok) {
    const message = payload?.error?.message || payload?.message || rawText || response.statusText;
    throw new Error(`模型列表请求失败 (${response.status})：${message}`);
  }

  const models = normalizeModelListPayload(payload);
  if (models.length === 0) {
    throw new Error("未从模型列表响应中找到可调用模型。");
  }

  return models;
}
