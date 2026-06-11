import { normalizeApiBaseUrl } from "./api-base-url.mjs";

export const IMAGE_ROUTE_A = "a";
export const IMAGE_ROUTE_B = "b";
export const DEFAULT_DIRECT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_DIRECT_RESPONSES_MODEL = "gpt-5.5";
export const API_ENDPOINT_RESPONSES = "responses";
export const API_ENDPOINT_CHAT_COMPLETIONS = "chat/completions";
export const API_ENDPOINT_IMAGE_GENERATIONS = "images/generations";
export const API_ENDPOINT_IMAGE_EDITS = "images/edits";

const API_ENDPOINT_PATHS = [
  API_ENDPOINT_CHAT_COMPLETIONS,
  API_ENDPOINT_IMAGE_GENERATIONS,
  API_ENDPOINT_IMAGE_EDITS,
  API_ENDPOINT_RESPONSES,
];

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

export function normalizeApiEndpointPath(value, fallback = API_ENDPOINT_RESPONSES) {
  const normalized = String(value || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  if (API_ENDPOINT_PATHS.includes(normalized)) {
    return normalized;
  }
  const fallbackPath = String(fallback || "").trim().replace(/^\/+|\/+$/g, "").toLowerCase();
  return API_ENDPOINT_PATHS.includes(fallbackPath) ? fallbackPath : API_ENDPOINT_RESPONSES;
}

export function normalizeTextVisionEndpointPath(value, fallback = API_ENDPOINT_RESPONSES) {
  const normalized = normalizeApiEndpointPath(value, fallback);
  return normalized === API_ENDPOINT_RESPONSES || normalized === API_ENDPOINT_CHAT_COMPLETIONS
    ? normalized
    : API_ENDPOINT_RESPONSES;
}

function splitUrlPathSegments(value) {
  return String(value || "")
    .replace(/^\/+|\/+$/g, "")
    .split("/")
    .filter(Boolean);
}

function matchEndpointPath(segments) {
  const lowered = segments.map((segment) => segment.toLowerCase());
  return API_ENDPOINT_PATHS.find((endpointPath) => {
    const endpointSegments = endpointPath.split("/");
    if (endpointSegments.length > lowered.length) {
      return false;
    }
    const tail = lowered.slice(-endpointSegments.length);
    return endpointSegments.every((segment, index) => tail[index] === segment);
  });
}

export function splitApiEndpointUrl(
  value,
  { fallbackBaseUrl = "https://api.openai.com/v1", fallbackEndpointPath = API_ENDPOINT_RESPONSES } = {},
) {
  const fallbackPath = normalizeApiEndpointPath(fallbackEndpointPath);
  const raw = String(value || fallbackBaseUrl || "").trim();
  if (!raw) {
    return {
      baseUrl: normalizeApiBaseUrl(fallbackBaseUrl),
      endpointPath: fallbackPath,
    };
  }

  try {
    const url = new URL(raw.replace(/\/+$/, ""));
    const segments = splitUrlPathSegments(url.pathname);
    const endpointPath = matchEndpointPath(segments);
    if (endpointPath) {
      const endpointLength = endpointPath.split("/").length;
      const baseSegments = segments.slice(0, -endpointLength);
      url.pathname = `/${baseSegments.join("/")}`;
      url.search = "";
      url.hash = "";
      return {
        baseUrl: normalizeApiBaseUrl(url.toString(), { defaultBaseUrl: fallbackBaseUrl }),
        endpointPath,
      };
    }
  } catch (_error) {
    const withoutQuery = raw.split(/[?#]/)[0]?.replace(/\/+$/, "") || "";
    const segments = splitUrlPathSegments(withoutQuery);
    const endpointPath = matchEndpointPath(segments);
    if (endpointPath) {
      const endpointLength = endpointPath.split("/").length;
      const baseValue = segments.slice(0, -endpointLength).join("/");
      return {
        baseUrl: normalizeApiBaseUrl(baseValue || fallbackBaseUrl, { defaultBaseUrl: fallbackBaseUrl }),
        endpointPath,
      };
    }
  }

  return {
    baseUrl: normalizeApiBaseUrl(raw, { defaultBaseUrl: fallbackBaseUrl }),
    endpointPath: fallbackPath,
  };
}

export function appendApiEndpointPath(baseUrl, endpointPath = API_ENDPOINT_RESPONSES) {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  const normalizedEndpointPath = normalizeApiEndpointPath(endpointPath);
  return normalizedBaseUrl ? `${normalizedBaseUrl}/${normalizedEndpointPath}` : normalizedEndpointPath;
}

export function normalizeImageRouteConfig(
  source = {},
  { defaultBaseUrl = "https://api.openai.com/v1", defaultResponsesModel = "gpt-5.4" } = {},
) {
  const routeA = source.routeA && typeof source.routeA === "object" ? source.routeA : {};
  const routeB = source.routeB && typeof source.routeB === "object" ? source.routeB : {};
  const routeAEndpointFallback = normalizeApiEndpointPath(
    firstString([routeA.endpointPath, source.endpointPath], API_ENDPOINT_RESPONSES),
    API_ENDPOINT_RESPONSES,
  );
  const routeBEndpointFallback = normalizeApiEndpointPath(
    firstString([routeB.endpointPath, source.directEndpointPath], API_ENDPOINT_IMAGE_GENERATIONS),
    API_ENDPOINT_IMAGE_GENERATIONS,
  );
  const routeAEndpoint = splitApiEndpointUrl(firstString([routeA.baseUrl, source.baseUrl], defaultBaseUrl), {
    fallbackBaseUrl: defaultBaseUrl,
    fallbackEndpointPath: routeAEndpointFallback,
  });
  const routeBEndpoint = splitApiEndpointUrl(firstString([routeB.baseUrl, source.directBaseUrl], defaultBaseUrl), {
    fallbackBaseUrl: defaultBaseUrl,
    fallbackEndpointPath: routeBEndpointFallback,
  });
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
    baseUrl: routeAEndpoint.baseUrl || defaultBaseUrl,
    endpointPath: routeAEndpoint.endpointPath,
    apiKey: firstString([routeA.apiKey, source.apiKey]),
    responsesModel: responsesModel || defaultResponsesModel,
    directBaseUrl: routeBEndpoint.baseUrl || defaultBaseUrl,
    directEndpointPath: routeBEndpoint.endpointPath,
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
      endpointPath: normalized.directEndpointPath,
      apiKey: normalized.directApiKey,
      responsesModel: normalized.responsesModel,
      imageModel: normalized.directImageModel,
    };
  }

  return {
    imageRoute: IMAGE_ROUTE_A,
    baseUrl: normalized.baseUrl,
    endpointPath: normalized.endpointPath,
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
      endpointPath: normalizeTextVisionEndpointPath(normalized.directEndpointPath),
      apiKey: normalized.directApiKey,
      responsesModel: normalized.directResponsesModel,
    };
  }

  return {
    imageRoute: IMAGE_ROUTE_A,
    baseUrl: normalized.baseUrl,
    endpointPath: normalizeTextVisionEndpointPath(normalized.endpointPath),
    apiKey: normalized.apiKey,
    responsesModel: normalized.responsesModel,
  };
}
