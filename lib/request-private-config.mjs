import { IMAGE_ROUTE_C, IMAGE_ROUTE_D, normalizeImageRoute, normalizeImageRouteConfig } from "./image-route-config.mjs";

function readRequestField(source, key) {
  if (!source) {
    return "";
  }

  if (typeof source.get === "function") {
    return String(source.get(key) || "").trim();
  }

  return String(source[key] || "").trim();
}

function readRequestBoolean(source, key) {
  if (!source) return undefined;
  const value = typeof source.get === "function" ? source.get(key) : source[key];
  if (value === true || value === "true" || value === 1 || value === "1") return true;
  if (value === false || value === "false" || value === 0 || value === "0") return false;
  return undefined;
}

export function mergeRequestPrivateConfig(source, fallbackConfig) {
  const requestApiKey = readRequestField(source, "apiKey");
  const requestBaseUrl = readRequestField(source, "baseUrl");
  const requestEndpointPath = readRequestField(source, "endpointPath");
  const requestModel = readRequestField(source, "responsesModel");
  const requestImageToolModel = readRequestField(source, "imageToolModel");
  const requestIncludeImageToolModel = readRequestBoolean(source, "includeImageToolModel");
  const requestImageRoute = readRequestField(source, "imageRoute");
  const requestDirectImageBaseUrl = readRequestField(source, "directImageBaseUrl");
  const requestDirectImageApiKey = readRequestField(source, "directImageApiKey");
  const requestDirectImageEndpointPath = readRequestField(source, "directImageEndpointPath");
  const requestDirectImageModel = readRequestField(source, "directImageModel");
  const requestDirectImageStream = readRequestBoolean(source, "directImageStream");
  const requestDirectTextBaseUrl = readRequestField(source, "directTextBaseUrl");
  const requestDirectTextApiKey = readRequestField(source, "directTextApiKey");
  const requestDirectTextEndpointPath = readRequestField(source, "directTextEndpointPath");
  const requestDirectTextModel = readRequestField(source, "directTextModel");
  const requestDirectApiKey = readRequestField(source, "directApiKey");
  const requestDirectBaseUrl = readRequestField(source, "directBaseUrl");
  const requestDirectEndpointPath = readRequestField(source, "directEndpointPath");
  const requestDirectResponsesModel = readRequestField(source, "directResponsesModel");
  const requestProtocolApiKey = readRequestField(source, "protocolApiKey");
  const requestProtocolBaseUrl = readRequestField(source, "protocolBaseUrl");
  const requestProtocolImageModel = readRequestField(source, "protocolImageModel");
  const requestGrokBaseUrl = readRequestField(source, "grokBaseUrl");
  const requestGrokApiKey = readRequestField(source, "grokApiKey");
  const requestGrokEndpointPath = readRequestField(source, "grokEndpointPath");
  const requestGrokImageModel = readRequestField(source, "grokImageModel");
  const requestRoute = normalizeImageRoute(requestImageRoute || fallbackConfig.imageRoute);
  const wantsProtocolRequest =
    requestRoute === IMAGE_ROUTE_C ||
    Boolean(requestProtocolApiKey || requestProtocolBaseUrl || requestProtocolImageModel);
  const wantsGrokRequest =
    requestRoute === IMAGE_ROUTE_D ||
    Boolean(requestGrokApiKey || requestGrokBaseUrl || requestGrokEndpointPath || requestGrokImageModel);
  const hasLegacyDirectRequest = Boolean(
    requestDirectApiKey || requestDirectBaseUrl || requestDirectEndpointPath || requestDirectImageModel || requestDirectResponsesModel,
  );
  const hasDirectImageRequest = Boolean(
    requestDirectImageApiKey || requestDirectImageBaseUrl || requestDirectImageEndpointPath || requestDirectImageModel || requestDirectImageStream !== undefined,
  );
  const hasDirectTextRequest = Boolean(
    requestDirectTextApiKey || requestDirectTextBaseUrl || requestDirectTextEndpointPath || requestDirectTextModel,
  );

  if (
    !requestApiKey &&
    !requestDirectApiKey &&
    !requestProtocolApiKey &&
    !requestGrokApiKey &&
    !requestImageRoute &&
    !hasDirectImageRequest &&
    !hasDirectTextRequest &&
    !requestBaseUrl &&
    !requestDirectBaseUrl
    && !requestGrokBaseUrl
    && !requestGrokEndpointPath
    && !requestGrokImageModel
    && requestDirectImageStream === undefined
  ) {
    return fallbackConfig;
  }

  const directImageBaseUrl = requestDirectImageBaseUrl || (hasLegacyDirectRequest ? requestDirectBaseUrl : "");
  const directImageApiKey = requestDirectImageApiKey || (hasLegacyDirectRequest ? requestDirectApiKey : "");
  const directImageEndpointPath = requestDirectImageEndpointPath || (hasLegacyDirectRequest ? requestDirectEndpointPath : "");
  const directImageModel = requestDirectImageModel || (hasLegacyDirectRequest ? requestDirectImageModel : "");
  const directTextBaseUrl = requestDirectTextBaseUrl || (hasLegacyDirectRequest ? requestDirectBaseUrl : "");
  const directTextApiKey = requestDirectTextApiKey || (hasLegacyDirectRequest ? requestDirectApiKey : "");
  const directTextEndpointPath = requestDirectTextEndpointPath || (hasLegacyDirectRequest ? requestDirectEndpointPath : "");
  const directTextModel = requestDirectTextModel || (hasLegacyDirectRequest ? requestDirectResponsesModel : "");

  const routeConfig = normalizeImageRouteConfig(
    {
      ...fallbackConfig,
      imageRoute: requestImageRoute || fallbackConfig.imageRoute,
      baseUrl: requestApiKey ? requestBaseUrl || fallbackConfig.baseUrl : fallbackConfig.baseUrl,
      endpointPath: requestApiKey ? requestEndpointPath || fallbackConfig.endpointPath : fallbackConfig.endpointPath,
      apiKey: requestApiKey || fallbackConfig.apiKey,
      responsesModel: requestApiKey ? requestModel || fallbackConfig.responsesModel : fallbackConfig.responsesModel,
      // 与 responsesModel 同一档：只有请求自带 Key（浏览器私有配置模式）时才用请求值，
      // 本地模式仍以服务端保存的配置为准。白名单校验在 normalizeImageRouteConfig 内完成。
      imageToolModel: requestApiKey
        ? requestImageToolModel || fallbackConfig.imageToolModel
        : fallbackConfig.imageToolModel,
      includeImageToolModel: requestApiKey
        ? requestIncludeImageToolModel ?? fallbackConfig.includeImageToolModel
        : fallbackConfig.includeImageToolModel,
      directImageBaseUrl: hasDirectImageRequest || hasLegacyDirectRequest
        ? directImageBaseUrl || fallbackConfig.directImageBaseUrl
        : fallbackConfig.directImageBaseUrl,
      directImageEndpointPath: hasDirectImageRequest || hasLegacyDirectRequest
        ? directImageEndpointPath || fallbackConfig.directImageEndpointPath
        : fallbackConfig.directImageEndpointPath,
      directImageApiKey: directImageApiKey || fallbackConfig.directImageApiKey || fallbackConfig.directApiKey,
      directImageModel: hasDirectImageRequest || hasLegacyDirectRequest
        ? directImageModel || fallbackConfig.directImageModel
        : fallbackConfig.directImageModel,
      directImageStream: requestDirectImageStream ?? fallbackConfig.directImageStream ?? false,
      directTextBaseUrl: hasDirectTextRequest || hasLegacyDirectRequest
        ? directTextBaseUrl || fallbackConfig.directTextBaseUrl
        : fallbackConfig.directTextBaseUrl,
      directTextEndpointPath: hasDirectTextRequest || hasLegacyDirectRequest
        ? directTextEndpointPath || fallbackConfig.directTextEndpointPath
        : fallbackConfig.directTextEndpointPath,
      directTextApiKey: directTextApiKey || fallbackConfig.directTextApiKey || fallbackConfig.directApiKey,
      directTextModel: hasDirectTextRequest || hasLegacyDirectRequest
        ? directTextModel || fallbackConfig.directTextModel || fallbackConfig.directResponsesModel
        : fallbackConfig.directTextModel || fallbackConfig.directResponsesModel,
      // Keep the legacy fields in the request-shaped object for older
      // downstream consumers and for old clients that still submit them.
      directBaseUrl: requestDirectBaseUrl || fallbackConfig.directBaseUrl,
      directEndpointPath: requestDirectEndpointPath || fallbackConfig.directEndpointPath,
      directApiKey: requestDirectApiKey || fallbackConfig.directApiKey,
      directResponsesModel: requestDirectResponsesModel || fallbackConfig.directResponsesModel,
      protocolBaseUrl: wantsProtocolRequest
        ? requestProtocolBaseUrl || fallbackConfig.protocolBaseUrl
        : fallbackConfig.protocolBaseUrl,
      protocolApiKey:
        requestProtocolApiKey ||
        (wantsProtocolRequest ? requestDirectApiKey || requestApiKey || fallbackConfig.protocolApiKey : fallbackConfig.protocolApiKey),
      protocolImageModel: wantsProtocolRequest
        ? requestProtocolImageModel || fallbackConfig.protocolImageModel
        : fallbackConfig.protocolImageModel,
      grokBaseUrl: wantsGrokRequest
        ? requestGrokBaseUrl || fallbackConfig.grokBaseUrl
        : fallbackConfig.grokBaseUrl,
      grokApiKey: requestGrokApiKey || fallbackConfig.grokApiKey,
      grokEndpointPath: wantsGrokRequest
        ? requestGrokEndpointPath || fallbackConfig.grokEndpointPath
        : fallbackConfig.grokEndpointPath,
      grokImageModel: wantsGrokRequest
        ? requestGrokImageModel || fallbackConfig.grokImageModel
        : fallbackConfig.grokImageModel,
    },
    {
      defaultBaseUrl: fallbackConfig.baseUrl,
      defaultResponsesModel: fallbackConfig.responsesModel,
      preserveRootBaseUrls: {
        baseUrl: !requestBaseUrl,
        directBaseUrl: !requestDirectBaseUrl,
        directImageBaseUrl: !directImageBaseUrl,
        directTextBaseUrl: !directTextBaseUrl,
        protocolBaseUrl: !requestProtocolBaseUrl,
        grokBaseUrl: !requestGrokBaseUrl,
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
