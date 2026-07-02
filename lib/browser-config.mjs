import {
  DEFAULT_DIRECT_IMAGE_MODEL,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  DEFAULT_PROTOCOL_IMAGE_MODEL,
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

export function normalizeBrowserPrivateConfig(source = {}, { preserveRootBaseUrls = false } = {}) {
  const routeConfig = normalizeImageRouteConfig(source, {
    defaultBaseUrl: DEFAULT_BROWSER_BASE_URL,
    defaultResponsesModel: DEFAULT_BROWSER_RESPONSES_MODEL,
    preserveRootBaseUrls,
  });

  return {
    imageRoute: routeConfig.imageRoute,
    baseUrl: routeConfig.baseUrl || DEFAULT_BROWSER_BASE_URL,
    apiKey: routeConfig.apiKey,
    endpointPath: routeConfig.endpointPath,
    responsesModel: routeConfig.responsesModel || DEFAULT_BROWSER_RESPONSES_MODEL,
    directBaseUrl: routeConfig.directBaseUrl || DEFAULT_BROWSER_BASE_URL,
    directApiKey: routeConfig.directApiKey,
    directEndpointPath: routeConfig.directEndpointPath,
    directImageModel: routeConfig.directImageModel || DEFAULT_DIRECT_IMAGE_MODEL,
    directResponsesModel: routeConfig.directResponsesModel || DEFAULT_DIRECT_RESPONSES_MODEL,
    protocolBaseUrl: routeConfig.protocolBaseUrl || DEFAULT_BROWSER_BASE_URL,
    protocolApiKey: routeConfig.protocolApiKey,
    protocolImageModel: routeConfig.protocolImageModel || DEFAULT_PROTOCOL_IMAGE_MODEL,
  };
}

export function readBrowserPrivateConfig(storage = getLocalStorage()) {
  try {
    const raw = storage?.getItem?.(BROWSER_CONFIG_STORAGE_KEY);
    if (!raw) {
      return null;
    }

    return normalizeBrowserPrivateConfig(JSON.parse(raw), { preserveRootBaseUrls: true });
  } catch (_error) {
    return null;
  }
}

export function toPublicBrowserConfig(privateConfig, baseConfig = {}) {
  const normalized = normalizeBrowserPrivateConfig(privateConfig, { preserveRootBaseUrls: true });
  const apiKeyConfigured = Boolean(normalized.apiKey) || Boolean(baseConfig.apiKeyConfigured);
  const directApiKeyConfigured = Boolean(normalized.directApiKey) || Boolean(baseConfig.directApiKeyConfigured);
  const protocolApiKeyConfigured = Boolean(normalized.protocolApiKey) || Boolean(baseConfig.protocolApiKeyConfigured);
  return {
    ...baseConfig,
    baseUrl: normalized.baseUrl,
    apiKeyConfigured,
    apiKeyMask: normalized.apiKey ? maskBrowserApiKey(normalized.apiKey) : baseConfig.apiKeyMask,
    endpointPath: normalized.endpointPath,
    responsesModel: normalized.responsesModel,
    imageRoute: normalized.imageRoute,
    directBaseUrl: normalized.directBaseUrl,
    directApiKeyConfigured,
    directApiKeyMask: normalized.directApiKey ? maskBrowserApiKey(normalized.directApiKey) : baseConfig.directApiKeyMask,
    directEndpointPath: normalized.directEndpointPath,
    directImageModel: normalized.directImageModel,
    directResponsesModel: normalized.directResponsesModel,
    protocolBaseUrl: normalized.protocolBaseUrl,
    protocolApiKeyConfigured,
    protocolApiKeyMask: normalized.protocolApiKey ? maskBrowserApiKey(normalized.protocolApiKey) : baseConfig.protocolApiKeyMask,
    protocolImageModel: normalized.protocolImageModel,
  };
}

export function saveBrowserPrivateConfig(payload, storage = getLocalStorage()) {
  const current = readBrowserPrivateConfig(storage) || normalizeBrowserPrivateConfig();
  const next = normalizeBrowserPrivateConfig(
    {
      ...current,
      baseUrl: payload.baseUrl,
      apiKey: payload.apiKey ? payload.apiKey : current.apiKey,
      endpointPath: payload.endpointPath || current.endpointPath,
      responsesModel: payload.responsesModel,
      imageRoute: payload.imageRoute || current.imageRoute,
      directBaseUrl: payload.directBaseUrl || current.directBaseUrl,
      directApiKey: payload.directApiKey ? payload.directApiKey : current.directApiKey,
      directEndpointPath: payload.directEndpointPath || current.directEndpointPath,
      directImageModel: payload.directImageModel || current.directImageModel,
      directResponsesModel: payload.directResponsesModel || current.directResponsesModel,
      protocolBaseUrl: payload.protocolBaseUrl || current.protocolBaseUrl,
      protocolApiKey: payload.protocolApiKey ? payload.protocolApiKey : current.protocolApiKey,
      protocolImageModel: payload.protocolImageModel || current.protocolImageModel,
    },
    {
      preserveRootBaseUrls: {
        baseUrl: payload.baseUrl === undefined,
        directBaseUrl: payload.directBaseUrl === undefined,
        protocolBaseUrl: payload.protocolBaseUrl === undefined,
      },
    },
  );

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

  const config = normalizeBrowserPrivateConfig(
    {
      ...(browserConfig || {}),
      ...overrideConfig,
    },
    {
      preserveRootBaseUrls: {
        baseUrl: !("baseUrl" in overrideConfig),
        directBaseUrl: !("directBaseUrl" in overrideConfig),
        protocolBaseUrl: !("protocolBaseUrl" in overrideConfig),
      },
    },
  );

  formData.set("baseUrl", config.baseUrl);
  formData.set("apiKey", config.apiKey);
  formData.set("endpointPath", config.endpointPath);
  formData.set("responsesModel", config.responsesModel);
  formData.set("imageRoute", config.imageRoute);
  formData.set("directBaseUrl", config.directBaseUrl);
  formData.set("directApiKey", config.directApiKey);
  formData.set("directEndpointPath", config.directEndpointPath);
  formData.set("directImageModel", config.directImageModel);
  formData.set("directResponsesModel", config.directResponsesModel);
  formData.set("protocolBaseUrl", config.protocolBaseUrl);
  formData.set("protocolApiKey", config.protocolApiKey);
  formData.set("protocolImageModel", config.protocolImageModel);
  return formData;
}

export function getBrowserPrivateConfigRequestPayload(readConfig = readBrowserPrivateConfig) {
  const browserConfig = typeof readConfig === "function" ? readConfig() : readConfig;
  return browserConfig
    ? {
        baseUrl: browserConfig.baseUrl,
        apiKey: browserConfig.apiKey,
        endpointPath: browserConfig.endpointPath,
        responsesModel: browserConfig.responsesModel,
        imageRoute: browserConfig.imageRoute,
        directBaseUrl: browserConfig.directBaseUrl,
        directApiKey: browserConfig.directApiKey,
        directEndpointPath: browserConfig.directEndpointPath,
        directImageModel: browserConfig.directImageModel,
        directResponsesModel: browserConfig.directResponsesModel,
        protocolBaseUrl: browserConfig.protocolBaseUrl,
        protocolApiKey: browserConfig.protocolApiKey,
        protocolImageModel: browserConfig.protocolImageModel,
      }
    : {};
}
