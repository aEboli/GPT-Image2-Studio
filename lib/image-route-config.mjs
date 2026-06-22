import { normalizeApiBaseUrl } from "./api-base-url.mjs";

export const IMAGE_ROUTE_A = "a";
export const IMAGE_ROUTE_B = "b";
export const IMAGE_ROUTE_C = "c";
export const DEFAULT_DIRECT_IMAGE_MODEL = "gpt-image-2";
export const DEFAULT_DIRECT_RESPONSES_MODEL = "gpt-5.5";
export const DEFAULT_PROTOCOL_IMAGE_MODEL = "gemini-3.1-flash-image-preview";
export const MODEL_PROTOCOL_CHAT_COMPLETIONS = "model-chat-completions";
export const MODEL_PROTOCOL_GENERATE_CONTENT = MODEL_PROTOCOL_CHAT_COMPLETIONS;
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

function stripKnownEndpointFromBaseUrl(value, fallbackBaseUrl = "https://api.openai.com/v1") {
  return splitApiEndpointUrl(value, {
    fallbackBaseUrl,
    fallbackEndpointPath: API_ENDPOINT_RESPONSES,
  }).baseUrl;
}

function isDefaultApiBaseUrl(value, defaultBaseUrl = "https://api.openai.com/v1") {
  return (
    normalizeApiBaseUrl(value, { defaultBaseUrl }) ===
    normalizeApiBaseUrl(defaultBaseUrl, { defaultBaseUrl })
  );
}

function pickProtocolFallbackBaseUrl(source, routeA = {}, routeB = {}, defaultBaseUrl = "https://api.openai.com/v1") {
  const routeABaseUrl = firstString([routeA.baseUrl, source.baseUrl]);
  const routeBBaseUrl = firstString([routeB.baseUrl, source.directBaseUrl]);
  const hasRouteBKey = Boolean(firstString([routeB.apiKey, source.directApiKey]));
  const hasRouteAKey = Boolean(firstString([routeA.apiKey, source.apiKey]));

  if (hasRouteBKey) {
    return stripKnownEndpointFromBaseUrl(routeBBaseUrl || defaultBaseUrl, defaultBaseUrl);
  }
  if (hasRouteAKey) {
    return stripKnownEndpointFromBaseUrl(routeABaseUrl || defaultBaseUrl, defaultBaseUrl);
  }

  return stripKnownEndpointFromBaseUrl(firstString([routeBBaseUrl, routeABaseUrl], defaultBaseUrl), defaultBaseUrl);
}

export function normalizeImageRoute(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === IMAGE_ROUTE_B || normalized === "route-b" || normalized === "direct") {
    return IMAGE_ROUTE_B;
  }
  if (
    normalized === IMAGE_ROUTE_C ||
    normalized === "route-c" ||
    normalized === "protocol" ||
    normalized === "model-protocol" ||
    normalized === "gemini"
  ) {
    return IMAGE_ROUTE_C;
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

function formatKnownEndpointBaseUrl(url, baseSegments, fallbackBaseUrl) {
  url.pathname = baseSegments.length ? `/${baseSegments.join("/")}` : "/";
  url.search = "";
  url.hash = "";
  if (baseSegments.length === 0) {
    return url.toString().replace(/\/+$/, "");
  }
  return normalizeApiBaseUrl(url.toString(), { defaultBaseUrl: fallbackBaseUrl });
}

function normalizeRootBaseUrl(value) {
  const raw = String(value || "").trim();
  if (!raw) {
    return "";
  }
  try {
    const url = new URL(raw);
    const pathname = url.pathname.replace(/\/+$/, "");
    if (pathname || url.search || url.hash) {
      return "";
    }
    return url.toString().replace(/\/+$/, "");
  } catch (_error) {
    return "";
  }
}

function shouldPreserveRootBaseUrl(preserveRootBaseUrls, key) {
  return preserveRootBaseUrls === true || Boolean(preserveRootBaseUrls?.[key]);
}

function preserveRootBaseUrl(value, normalizedBaseUrl, preserveRootBaseUrls, key) {
  if (!shouldPreserveRootBaseUrl(preserveRootBaseUrls, key)) {
    return normalizedBaseUrl;
  }
  return normalizeRootBaseUrl(value) || normalizedBaseUrl;
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
      return {
        baseUrl: formatKnownEndpointBaseUrl(url, baseSegments, fallbackBaseUrl),
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

export function splitModelProtocolUrl(value, { fallbackBaseUrl = "https://api.openai.com/v1" } = {}) {
  const raw = String(value || fallbackBaseUrl || "").trim();
  if (!raw) {
    return {
      baseUrl: normalizeApiBaseUrl(fallbackBaseUrl),
      imageModel: "",
    };
  }

  try {
    const url = new URL(raw.replace(/\/+$/, ""));
    const segments = splitUrlPathSegments(url.pathname);
    const endpointPath = matchEndpointPath(segments);
    if (endpointPath) {
      const endpointLength = endpointPath.split("/").length;
      const baseSegments = segments.slice(0, -endpointLength);
      return {
        baseUrl: formatKnownEndpointBaseUrl(url, baseSegments, fallbackBaseUrl),
        imageModel: "",
      };
    }
    const modelsIndex = segments.findIndex((segment) => segment.toLowerCase() === "models");
    const modelSegment = modelsIndex >= 0 ? segments[modelsIndex + 1] || "" : "";
    if (modelSegment) {
      const imageModel = decodeURIComponent(modelSegment).replace(/:generatecontent$/i, "");
      url.pathname = `/${segments.slice(0, modelsIndex).join("/")}`;
      url.search = "";
      url.hash = "";
      return {
        baseUrl: normalizeApiBaseUrl(url.toString(), { defaultBaseUrl: fallbackBaseUrl }),
        imageModel,
      };
    }
  } catch (_error) {
    const withoutQuery = raw.split(/[?#]/)[0]?.replace(/\/+$/, "") || "";
    const segments = splitUrlPathSegments(withoutQuery);
    const endpointPath = matchEndpointPath(segments);
    if (endpointPath === API_ENDPOINT_CHAT_COMPLETIONS) {
      const endpointLength = endpointPath.split("/").length;
      return {
        baseUrl: normalizeApiBaseUrl(segments.slice(0, -endpointLength).join("/") || fallbackBaseUrl, {
          defaultBaseUrl: fallbackBaseUrl,
        }),
        imageModel: "",
      };
    }
    const modelsIndex = segments.findIndex((segment) => segment.toLowerCase() === "models");
    const modelSegment = modelsIndex >= 0 ? segments[modelsIndex + 1] || "" : "";
    if (modelSegment) {
      return {
        baseUrl: normalizeApiBaseUrl(segments.slice(0, modelsIndex).join("/") || fallbackBaseUrl, {
          defaultBaseUrl: fallbackBaseUrl,
        }),
        imageModel: decodeURIComponent(modelSegment).replace(/:generatecontent$/i, ""),
      };
    }
  }

  return {
    baseUrl: normalizeApiBaseUrl(raw, { defaultBaseUrl: fallbackBaseUrl }),
    imageModel: "",
  };
}

export function appendApiEndpointPath(baseUrl, endpointPath = API_ENDPOINT_RESPONSES) {
  const normalizedBaseUrl = normalizeApiBaseUrl(baseUrl);
  const normalizedEndpointPath = normalizeApiEndpointPath(endpointPath);
  return normalizedBaseUrl ? `${normalizedBaseUrl}/${normalizedEndpointPath}` : normalizedEndpointPath;
}

export function normalizeImageRouteConfig(
  source = {},
  {
    defaultBaseUrl = "https://api.openai.com/v1",
    defaultResponsesModel = "gpt-5.4",
    preserveRootBaseUrls = false,
  } = {},
) {
  const routeA = source.routeA && typeof source.routeA === "object" ? source.routeA : {};
  const routeB = source.routeB && typeof source.routeB === "object" ? source.routeB : {};
  const routeC = source.routeC && typeof source.routeC === "object" ? source.routeC : {};
  const routeABaseInput = firstString([routeA.baseUrl, source.baseUrl], defaultBaseUrl);
  const routeAEndpointFallback = normalizeApiEndpointPath(
    firstString([routeA.endpointPath, source.endpointPath], API_ENDPOINT_RESPONSES),
    API_ENDPOINT_RESPONSES,
  );
  const routeBEndpointFallback = normalizeApiEndpointPath(
    firstString([routeB.endpointPath, source.directEndpointPath], API_ENDPOINT_IMAGE_GENERATIONS),
    API_ENDPOINT_IMAGE_GENERATIONS,
  );
  const routeAEndpoint = splitApiEndpointUrl(routeABaseInput, {
    fallbackBaseUrl: defaultBaseUrl,
    fallbackEndpointPath: routeAEndpointFallback,
  });
  const routeBBaseUrl = firstString([routeB.baseUrl, source.directBaseUrl]);
  const routeBHasKey = Boolean(firstString([routeB.apiKey, source.directApiKey]));
  const routeBBaseSeed =
    routeBBaseUrl && (routeBHasKey || !isDefaultApiBaseUrl(routeBBaseUrl, defaultBaseUrl))
      ? routeBBaseUrl
      : stripKnownEndpointFromBaseUrl(firstString([routeA.baseUrl, source.baseUrl], defaultBaseUrl), defaultBaseUrl);
  const routeBEndpoint = splitApiEndpointUrl(routeBBaseSeed, {
    fallbackBaseUrl: defaultBaseUrl,
    fallbackEndpointPath: routeBEndpointFallback,
  });
  const protocolFallbackBaseUrl = pickProtocolFallbackBaseUrl(source, routeA, routeB, defaultBaseUrl);
  const protocolEndpoint = splitModelProtocolUrl(
    firstString([routeC.baseUrl, source.protocolBaseUrl], protocolFallbackBaseUrl),
    {
      fallbackBaseUrl: protocolFallbackBaseUrl,
    },
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
  const protocolImageModel = firstString(
    [routeC.imageModel, source.protocolImageModel, protocolEndpoint.imageModel],
    DEFAULT_PROTOCOL_IMAGE_MODEL,
  );

  return {
    imageRoute: normalizeImageRoute(source.imageRoute || source.generationRoute),
    baseUrl: preserveRootBaseUrl(routeABaseInput, routeAEndpoint.baseUrl, preserveRootBaseUrls, "baseUrl") || defaultBaseUrl,
    endpointPath: routeAEndpoint.endpointPath,
    apiKey: firstString([routeA.apiKey, source.apiKey]),
    responsesModel: responsesModel || defaultResponsesModel,
    directBaseUrl:
      preserveRootBaseUrl(routeBBaseUrl, routeBEndpoint.baseUrl, preserveRootBaseUrls, "directBaseUrl") ||
      defaultBaseUrl,
    directEndpointPath: routeBEndpoint.endpointPath,
    directApiKey: firstString([routeB.apiKey, source.directApiKey, routeA.apiKey, source.apiKey]),
    directImageModel: directImageModel || DEFAULT_DIRECT_IMAGE_MODEL,
    directResponsesModel: directResponsesModel || DEFAULT_DIRECT_RESPONSES_MODEL,
    protocolBaseUrl:
      preserveRootBaseUrl(
        firstString([routeC.baseUrl, source.protocolBaseUrl]),
        protocolEndpoint.baseUrl,
        preserveRootBaseUrls,
        "protocolBaseUrl",
      ) || defaultBaseUrl,
    protocolApiKey: firstString([routeC.apiKey, source.protocolApiKey, routeB.apiKey, source.directApiKey, routeA.apiKey, source.apiKey]),
    protocolImageModel: protocolImageModel || DEFAULT_PROTOCOL_IMAGE_MODEL,
  };
}

export function getSelectedImageGenerationConfig(config = {}) {
  const normalized = normalizeImageRouteConfig(config, {
    defaultBaseUrl: config.baseUrl || config.directBaseUrl || "https://api.openai.com/v1",
    defaultResponsesModel: config.responsesModel || "gpt-5.4",
  });

  if (normalized.imageRoute === IMAGE_ROUTE_C) {
    return {
      imageRoute: IMAGE_ROUTE_C,
      baseUrl: normalized.protocolBaseUrl,
      apiKey: normalized.protocolApiKey,
      imageModel: normalized.protocolImageModel,
      protocol: MODEL_PROTOCOL_CHAT_COMPLETIONS,
    };
  }

  if (normalized.imageRoute === IMAGE_ROUTE_B) {
    const selectedResponsesModel =
      normalized.directEndpointPath === API_ENDPOINT_RESPONSES
        ? normalized.directResponsesModel
        : normalized.responsesModel;

    return {
      imageRoute: IMAGE_ROUTE_B,
      baseUrl: normalized.directBaseUrl,
      endpointPath: normalized.directEndpointPath,
      apiKey: normalized.directApiKey,
      responsesModel: selectedResponsesModel,
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

export function getSelectedPromptAgentAnalysisConfig(config = {}) {
  const normalized = normalizeImageRouteConfig(config, {
    defaultBaseUrl: config.baseUrl || config.directBaseUrl || "https://api.openai.com/v1",
    defaultResponsesModel: config.responsesModel || "gpt-5.4",
  });

  if (normalized.imageRoute === IMAGE_ROUTE_C) {
    return {
      imageRoute: IMAGE_ROUTE_C,
      baseUrl: normalized.protocolBaseUrl,
      endpointPath: API_ENDPOINT_IMAGE_GENERATIONS,
      apiKey: normalized.protocolApiKey,
      responsesModel: normalized.protocolImageModel,
      imageModel: normalized.protocolImageModel,
    };
  }

  return getSelectedTextVisionConfig(normalized);
}
