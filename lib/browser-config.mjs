import { normalizeApiBaseUrl } from "./api-base-url.mjs";
import {
  DEFAULT_DIRECT_IMAGE_MODEL,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  normalizeImageRouteConfig,
} from "./image-route-config.mjs";

export const BROWSER_CONFIG_STORAGE_KEY = "image-studio-browser-config-v1";
export const CLIENT_SESSION_STORAGE_KEY = "image-studio-client-session-id";
export const DEFAULT_BROWSER_BASE_URL = "https://api.openai.com/v1";
export const DEFAULT_BROWSER_RESPONSES_MODEL = "gpt-5.5";

function getLocalStorage() {
  return globalThis.window?.localStorage || null;
}

export function getOrCreateClientSessionId(storage = getLocalStorage()) {
  const existing = storage?.getItem?.(CLIENT_SESSION_STORAGE_KEY);
  if (existing) {
    return existing;
  }

  const next = `studio-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  storage?.setItem?.(CLIENT_SESSION_STORAGE_KEY, next);
  return next;
}

export function maskBrowserApiKey(apiKey) {
  if (!apiKey) {
    return "";
  }

  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`;
  }

  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`;
}

export function normalizeBrowserPrivateConfig(source = {}) {
  const routeConfig = normalizeImageRouteConfig(source, {
    defaultBaseUrl: DEFAULT_BROWSER_BASE_URL,
    defaultResponsesModel: DEFAULT_BROWSER_RESPONSES_MODEL,
  });

  return {
    imageRoute: routeConfig.imageRoute,
    baseUrl: normalizeApiBaseUrl(routeConfig.baseUrl, { defaultBaseUrl: DEFAULT_BROWSER_BASE_URL }) || DEFAULT_BROWSER_BASE_URL,
    apiKey: routeConfig.apiKey,
    responsesModel: routeConfig.responsesModel || DEFAULT_BROWSER_RESPONSES_MODEL,
    directBaseUrl: normalizeApiBaseUrl(routeConfig.directBaseUrl, { defaultBaseUrl: DEFAULT_BROWSER_BASE_URL }) || DEFAULT_BROWSER_BASE_URL,
    directApiKey: routeConfig.directApiKey,
    directImageModel: routeConfig.directImageModel || DEFAULT_DIRECT_IMAGE_MODEL,
    directResponsesModel: routeConfig.directResponsesModel || DEFAULT_DIRECT_RESPONSES_MODEL,
  };
}

export function readBrowserPrivateConfig(storage = getLocalStorage()) {
  try {
    const raw = storage?.getItem?.(BROWSER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeBrowserPrivateConfig(JSON.parse(raw));
  } catch (_error) {
    return null;
  }
}

export function toPublicBrowserConfig(privateConfig, baseConfig = {}) {
  const normalized = normalizeBrowserPrivateConfig(privateConfig);
  return {
    ...baseConfig,
    baseUrl: normalized.baseUrl,
    apiKeyConfigured: Boolean(normalized.apiKey),
    apiKeyMask: maskBrowserApiKey(normalized.apiKey),
    responsesModel: normalized.responsesModel,
    imageRoute: normalized.imageRoute,
    directBaseUrl: normalized.directBaseUrl,
    directApiKeyConfigured: Boolean(normalized.directApiKey),
    directApiKeyMask: maskBrowserApiKey(normalized.directApiKey),
    directImageModel: normalized.directImageModel,
    directResponsesModel: normalized.directResponsesModel,
  };
}

export function saveBrowserPrivateConfig(payload, storage = getLocalStorage()) {
  const current = readBrowserPrivateConfig(storage) || normalizeBrowserPrivateConfig();
  const next = normalizeBrowserPrivateConfig({
    ...current,
    baseUrl: payload.baseUrl,
    apiKey: payload.apiKey ? payload.apiKey : current.apiKey,
    responsesModel: payload.responsesModel,
    imageRoute: payload.imageRoute || current.imageRoute,
    directBaseUrl: payload.directBaseUrl || current.directBaseUrl,
    directApiKey: payload.directApiKey ? payload.directApiKey : current.directApiKey,
    directImageModel: payload.directImageModel || current.directImageModel,
    directResponsesModel: payload.directResponsesModel || current.directResponsesModel,
  });

  storage?.setItem?.(BROWSER_CONFIG_STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function appendBrowserConfigToFormData(formData, readConfig = readBrowserPrivateConfig, overrides = {}) {
  const browserConfig = typeof readConfig === "function" ? readConfig() : readConfig;
  const overrideConfig = overrides && typeof overrides === "object" ? overrides : {};
  const hasOverrides = Object.keys(overrideConfig).length > 0;
  if (!browserConfig && !hasOverrides) {
    return formData;
  }

  const config = normalizeBrowserPrivateConfig({
    ...(browserConfig || {}),
    ...overrideConfig,
  });

  formData.set("baseUrl", config.baseUrl);
  formData.set("apiKey", config.apiKey);
  formData.set("responsesModel", config.responsesModel);
  formData.set("imageRoute", config.imageRoute);
  formData.set("directBaseUrl", config.directBaseUrl);
  formData.set("directApiKey", config.directApiKey);
  formData.set("directImageModel", config.directImageModel);
  formData.set("directResponsesModel", config.directResponsesModel);
  return formData;
}

export function getBrowserPrivateConfigRequestPayload(readConfig = readBrowserPrivateConfig) {
  const browserConfig = typeof readConfig === "function" ? readConfig() : readConfig;
  return browserConfig
    ? {
        baseUrl: browserConfig.baseUrl,
        apiKey: browserConfig.apiKey,
        responsesModel: browserConfig.responsesModel,
        imageRoute: browserConfig.imageRoute,
        directBaseUrl: browserConfig.directBaseUrl,
        directApiKey: browserConfig.directApiKey,
        directImageModel: browserConfig.directImageModel,
        directResponsesModel: browserConfig.directResponsesModel,
      }
    : {};
}
