import { IMAGE_ROUTE_C, normalizeImageRoute, normalizeImageRouteConfig } from "./image-route-config.mjs";

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
  const requestEndpointPath = readRequestField(source, "endpointPath");
  const requestModel = readRequestField(source, "responsesModel");
  const requestImageRoute = readRequestField(source, "imageRoute");
  const requestDirectBaseUrl = readRequestField(source, "directBaseUrl");
  const requestDirectEndpointPath = readRequestField(source, "directEndpointPath");
  const requestDirectImageModel = readRequestField(source, "directImageModel");
  const requestDirectResponsesModel = readRequestField(source, "directResponsesModel");
  const requestProtocolApiKey = readRequestField(source, "protocolApiKey");
  const requestProtocolBaseUrl = readRequestField(source, "protocolBaseUrl");
  const requestProtocolImageModel = readRequestField(source, "protocolImageModel");
  const requestRoute = normalizeImageRoute(requestImageRoute || fallbackConfig.imageRoute);
  const wantsProtocolRequest =
    requestRoute === IMAGE_ROUTE_C ||
    Boolean(requestProtocolApiKey || requestProtocolBaseUrl || requestProtocolImageModel);

  if (!requestApiKey && !requestDirectApiKey && !requestProtocolApiKey && !requestImageRoute) {
    return fallbackConfig;
  }

  const routeConfig = normalizeImageRouteConfig(
    {
      ...fallbackConfig,
      imageRoute: requestImageRoute || fallbackConfig.imageRoute,
      baseUrl: requestApiKey ? requestBaseUrl || fallbackConfig.baseUrl : fallbackConfig.baseUrl,
      endpointPath: requestApiKey ? requestEndpointPath || fallbackConfig.endpointPath : fallbackConfig.endpointPath,
      apiKey: requestApiKey || fallbackConfig.apiKey,
      responsesModel: requestApiKey ? requestModel || fallbackConfig.responsesModel : fallbackConfig.responsesModel,
      directBaseUrl: requestDirectApiKey
        ? requestDirectBaseUrl || fallbackConfig.directBaseUrl
        : fallbackConfig.directBaseUrl,
      directEndpointPath: requestDirectApiKey
        ? requestDirectEndpointPath || fallbackConfig.directEndpointPath
        : fallbackConfig.directEndpointPath,
      directApiKey: requestDirectApiKey || fallbackConfig.directApiKey,
      directImageModel: requestDirectApiKey
        ? requestDirectImageModel || fallbackConfig.directImageModel
        : fallbackConfig.directImageModel,
      directResponsesModel: requestDirectApiKey
        ? requestDirectResponsesModel || fallbackConfig.directResponsesModel
        : fallbackConfig.directResponsesModel,
      protocolBaseUrl: wantsProtocolRequest
        ? requestProtocolBaseUrl || fallbackConfig.protocolBaseUrl
        : fallbackConfig.protocolBaseUrl,
      protocolApiKey:
        requestProtocolApiKey ||
        (wantsProtocolRequest ? requestDirectApiKey || requestApiKey || fallbackConfig.protocolApiKey : fallbackConfig.protocolApiKey),
      protocolImageModel: wantsProtocolRequest
        ? requestProtocolImageModel || fallbackConfig.protocolImageModel
        : fallbackConfig.protocolImageModel,
    },
    {
      defaultBaseUrl: fallbackConfig.baseUrl,
      defaultResponsesModel: fallbackConfig.responsesModel,
      preserveRootBaseUrls: {
        baseUrl: !requestBaseUrl,
        directBaseUrl: !requestDirectBaseUrl,
        protocolBaseUrl: !requestProtocolBaseUrl,
      },
    },
  );

  return {
    ...fallbackConfig,
    ...routeConfig,
    baseUrl: routeConfig.baseUrl || fallbackConfig.baseUrl,
    directBaseUrl: routeConfig.directBaseUrl || fallbackConfig.baseUrl,
    protocolBaseUrl: routeConfig.protocolBaseUrl || fallbackConfig.baseUrl,
  };
}
