import { normalizeApiBaseUrl } from "./api-base-url.mjs";
import { normalizeImageRouteConfig } from "./image-route-config.mjs";

function readRequestField(source, key) {
  if (!source) {
    return "";
  }

  if (typeof source.get === "function") {
    return String(source.get(key) || "").trim();
  }

  return String(source[key] || "").trim();
}

export function mergeRequestPrivateConfig(source, fallbackConfig) {
  const requestApiKey = readRequestField(source, "apiKey");
  const requestDirectApiKey = readRequestField(source, "directApiKey");
  const requestBaseUrl = readRequestField(source, "baseUrl");
  const requestModel = readRequestField(source, "responsesModel");
  const requestImageRoute = readRequestField(source, "imageRoute");
  const requestDirectBaseUrl = readRequestField(source, "directBaseUrl");
  const requestDirectImageModel = readRequestField(source, "directImageModel");
  const requestDirectResponsesModel = readRequestField(source, "directResponsesModel");

  if (!requestApiKey && !requestDirectApiKey && !requestImageRoute) {
    return fallbackConfig;
  }

  const routeConfig = normalizeImageRouteConfig(
    {
      ...fallbackConfig,
      imageRoute: requestImageRoute || fallbackConfig.imageRoute,
      baseUrl: requestApiKey ? requestBaseUrl || fallbackConfig.baseUrl : fallbackConfig.baseUrl,
      apiKey: requestApiKey || fallbackConfig.apiKey,
      responsesModel: requestApiKey ? requestModel || fallbackConfig.responsesModel : fallbackConfig.responsesModel,
      directBaseUrl: requestDirectApiKey
        ? requestDirectBaseUrl || fallbackConfig.directBaseUrl
        : fallbackConfig.directBaseUrl,
      directApiKey: requestDirectApiKey || fallbackConfig.directApiKey,
      directImageModel: requestDirectApiKey
        ? requestDirectImageModel || fallbackConfig.directImageModel
        : fallbackConfig.directImageModel,
      directResponsesModel: requestDirectApiKey
        ? requestDirectResponsesModel || fallbackConfig.directResponsesModel
        : fallbackConfig.directResponsesModel,
    },
    {
      defaultBaseUrl: fallbackConfig.baseUrl,
      defaultResponsesModel: fallbackConfig.responsesModel,
    },
  );

  return {
    ...fallbackConfig,
    ...routeConfig,
    baseUrl: normalizeApiBaseUrl(routeConfig.baseUrl, {
      defaultBaseUrl: fallbackConfig.baseUrl,
    }),
    directBaseUrl: normalizeApiBaseUrl(routeConfig.directBaseUrl, {
      defaultBaseUrl: fallbackConfig.baseUrl,
    }),
  };
}
