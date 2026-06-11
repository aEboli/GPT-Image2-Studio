import { normalizeApiBaseUrl } from "./api-base-url.mjs";

export const IMAGE_ROUTE_A = "a";
export const IMAGE_ROUTE_B = "b";
export const DEFAULT_DIRECT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_DIRECT_RESPONSES_MODEL = "gpt-5.5";

function firstString(values, fallback = "") {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return fallback;
}

export function normalizeImageRoute(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === IMAGE_ROUTE_B || normalized === "route-b" || normalized === "direct") {
    return IMAGE_ROUTE_B;
  }
  return IMAGE_ROUTE_A;
}

export function normalizeImageRouteConfig(
  source = {},
  { defaultBaseUrl = "https://api.openai.com/v1", defaultResponsesModel = "gpt-5.4" } = {},
) {
  const routeA = source.routeA && typeof source.routeA === "object" ? source.routeA : {};
  const routeB = source.routeB && typeof source.routeB === "object" ? source.routeB : {};
  const baseUrl = normalizeApiBaseUrl(firstString([routeA.baseUrl, source.baseUrl], defaultBaseUrl), {
    defaultBaseUrl,
  });
  const directBaseUrl = normalizeApiBaseUrl(
    firstString([routeB.baseUrl, source.directBaseUrl], defaultBaseUrl),
    { defaultBaseUrl },
  );
  const responsesModel = firstString(
    [routeA.responsesModel, source.responsesModel],
    defaultResponsesModel,
  );
  const directImageModel = firstString(
    [routeB.imageModel, source.directImageModel, source.imageModel],
    DEFAULT_DIRECT_IMAGE_MODEL,
  );
  const directResponsesModel = firstString(
    [routeB.responsesModel, source.directResponsesModel],
    DEFAULT_DIRECT_RESPONSES_MODEL,
  );

  return {
    imageRoute: normalizeImageRoute(source.imageRoute || source.generationRoute),
    baseUrl: baseUrl || defaultBaseUrl,
    apiKey: firstString([routeA.apiKey, source.apiKey]),
    responsesModel: responsesModel || defaultResponsesModel,
    directBaseUrl: directBaseUrl || defaultBaseUrl,
    directApiKey: firstString([routeB.apiKey, source.directApiKey]),
    directImageModel: directImageModel || DEFAULT_DIRECT_IMAGE_MODEL,
    directResponsesModel: directResponsesModel || DEFAULT_DIRECT_RESPONSES_MODEL,
  };
}

export function getSelectedImageGenerationConfig(config = {}) {
  const normalized = normalizeImageRouteConfig(config, {
    defaultBaseUrl: config.baseUrl || config.directBaseUrl || "https://api.openai.com/v1",
    defaultResponsesModel: config.responsesModel || "gpt-5.4",
  });

  if (normalized.imageRoute === IMAGE_ROUTE_B) {
    return {
      imageRoute: IMAGE_ROUTE_B,
      baseUrl: normalized.directBaseUrl,
      apiKey: normalized.directApiKey,
      responsesModel: normalized.responsesModel,
      imageModel: normalized.directImageModel,
    };
  }

  return {
    imageRoute: IMAGE_ROUTE_A,
    baseUrl: normalized.baseUrl,
    apiKey: normalized.apiKey,
    responsesModel: normalized.responsesModel,
    imageModel: DEFAULT_DIRECT_IMAGE_MODEL,
  };
}

export function getSelectedTextVisionConfig(config = {}) {
  const normalized = normalizeImageRouteConfig(config, {
    defaultBaseUrl: config.baseUrl || config.directBaseUrl || "https://api.openai.com/v1",
    defaultResponsesModel: config.responsesModel || "gpt-5.4",
  });

  if (normalized.imageRoute === IMAGE_ROUTE_B) {
    return {
      imageRoute: IMAGE_ROUTE_B,
      baseUrl: normalized.directBaseUrl,
      apiKey: normalized.directApiKey,
      responsesModel: normalized.directResponsesModel,
    };
  }

  return {
    imageRoute: IMAGE_ROUTE_A,
    baseUrl: normalized.baseUrl,
    apiKey: normalized.apiKey,
    responsesModel: normalized.responsesModel,
  };
}
