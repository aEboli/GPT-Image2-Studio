import { normalizeApiBaseUrl } from "./api-base-url.mjs";
import {
  DEFAULT_DIRECT_IMAGE_MODEL,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  DEFAULT_PROTOCOL_IMAGE_MODEL,
  DEFAULT_RESPONSES_MODEL,
} from "./model-defaults.mjs";

export {
  DEFAULT_DIRECT_IMAGE_MODEL,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  DEFAULT_PROTOCOL_IMAGE_MODEL,
  DEFAULT_RESPONSES_MODEL,
};

export const IMAGE_ROUTE_A = "a";
export const IMAGE_ROUTE_B = "b";
export const IMAGE_ROUTE_C = "c";
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
  const routeBBaseUrl = firstString([
    routeB.baseUrl,
    routeB.imageBaseUrl,
    routeB.textBaseUrl,
    source.directImageBaseUrl,
    source.directTextBaseUrl,
    source.directBaseUrl,
  ]);
  const hasRouteBKey = Boolean(
    firstString([
      routeB.apiKey,
      routeB.imageApiKey,
      routeB.textApiKey,
      source.directImageApiKey,
      source.directTextApiKey,
      source.directApiKey,
    ]),
  );
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
    defaultResponsesModel = DEFAULT_RESPONSES_MODEL,
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
  const legacyRouteBBaseInput = firstString([routeB.baseUrl, source.directBaseUrl]);
  const legacyRouteBApiKey = firstString([routeB.apiKey, source.directApiKey]);
  const legacyRouteBEndpointPath = firstString([routeB.endpointPath, source.directEndpointPath]);
  const routeBImageBaseInput = firstString([
    routeB.imageBaseUrl,
    source.directImageBaseUrl,
    legacyRouteBBaseInput,
  ]);
  const routeBTextBaseInput = firstString([
    routeB.textBaseUrl,
    source.directTextBaseUrl,
    legacyRouteBBaseInput,
  ]);
  const routeBImageEndpointFallback = normalizeApiEndpointPath(
    firstString([
      routeB.imageEndpointPath,
      source.directImageEndpointPath,
      legacyRouteBEndpointPath,
    ], API_ENDPOINT_IMAGE_GENERATIONS),
    API_ENDPOINT_IMAGE_GENERATIONS,
  );
  const routeBTextEndpointFallback = normalizeTextVisionEndpointPath(
    firstString([
      routeB.textEndpointPath,
      source.directTextEndpointPath,
      source.directResponsesEndpointPath,
      legacyRouteBEndpointPath,
    ], API_ENDPOINT_RESPONSES),
    API_ENDPOINT_RESPONSES,
  );
  const routeAEndpoint = splitApiEndpointUrl(routeABaseInput, {
    fallbackBaseUrl: defaultBaseUrl,
    fallbackEndpointPath: routeAEndpointFallback,
  });
  const routeBImageHasKey = Boolean(
    firstString([routeB.imageApiKey, source.directImageApiKey, legacyRouteBApiKey]),
  );
  const routeBTextHasKey = Boolean(
    firstString([routeB.textApiKey, source.directTextApiKey, legacyRouteBApiKey]),
  );
  const routeBImageBaseSeed =
    routeBImageBaseInput && (routeBImageHasKey || !isDefaultApiBaseUrl(routeBImageBaseInput, defaultBaseUrl))
      ? routeBImageBaseInput
      : stripKnownEndpointFromBaseUrl(firstString([routeA.baseUrl, source.baseUrl], defaultBaseUrl), defaultBaseUrl);
  const routeBTextBaseSeed =
    routeBTextBaseInput && (routeBTextHasKey || !isDefaultApiBaseUrl(routeBTextBaseInput, defaultBaseUrl))
      ? routeBTextBaseInput
      : stripKnownEndpointFromBaseUrl(firstString([routeA.baseUrl, source.baseUrl], defaultBaseUrl), defaultBaseUrl);
  const routeBImageEndpoint = splitApiEndpointUrl(routeBImageBaseSeed, {
    fallbackBaseUrl: defaultBaseUrl,
    fallbackEndpointPath: routeBImageEndpointFallback,
  });
  const routeBTextEndpoint = splitApiEndpointUrl(routeBTextBaseSeed, {
    fallbackBaseUrl: defaultBaseUrl,
    fallbackEndpointPath: routeBTextEndpointFallback,
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
  const directTextModel = firstString(
    [routeB.textModel, routeB.responsesModel, source.directTextModel, source.directResponsesModel],
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
    directImageBaseUrl:
      preserveRootBaseUrl(
        routeBImageBaseInput,
        routeBImageEndpoint.baseUrl,
        preserveRootBaseUrls,
        "directImageBaseUrl",
      ) || defaultBaseUrl,
    directImageEndpointPath: routeBImageEndpoint.endpointPath,
    directImageApiKey: firstString([
      routeB.imageApiKey,
      source.directImageApiKey,
      legacyRouteBApiKey,
      routeA.apiKey,
      source.apiKey,
    ]),
    directImageModel: directImageModel || DEFAULT_DIRECT_IMAGE_MODEL,
    directTextBaseUrl:
      preserveRootBaseUrl(
        routeBTextBaseInput,
        routeBTextEndpoint.baseUrl,
        preserveRootBaseUrls,
        "directTextBaseUrl",
      ) || defaultBaseUrl,
    directTextEndpointPath: normalizeTextVisionEndpointPath(routeBTextEndpoint.endpointPath),
    directTextApiKey: firstString([
      routeB.textApiKey,
      source.directTextApiKey,
      legacyRouteBApiKey,
      routeA.apiKey,
      source.apiKey,
    ]),
    directTextModel: directTextModel || DEFAULT_DIRECT_RESPONSES_MODEL,
    // Legacy Route B fields remain image-oriented aliases so old callers and
    // persisted configs continue to work while new callers use role-specific fields.
    directBaseUrl:
      preserveRootBaseUrl(
        legacyRouteBBaseInput || routeBImageBaseInput,
        routeBImageEndpoint.baseUrl,
        preserveRootBaseUrls,
        "directBaseUrl",
      ) || defaultBaseUrl,
    directEndpointPath: routeBImageEndpoint.endpointPath,
    directApiKey: firstString([
      routeB.apiKey,
      source.directApiKey,
      source.directImageApiKey,
      routeA.apiKey,
      source.apiKey,
    ]),
    directResponsesModel: directTextModel || DEFAULT_DIRECT_RESPONSES_MODEL,
    protocolBaseUrl:
      preserveRootBaseUrl(
        firstString([routeC.baseUrl, source.protocolBaseUrl]),
        protocolEndpoint.baseUrl,
        preserveRootBaseUrls,
        "protocolBaseUrl",
      ) || defaultBaseUrl,
    protocolApiKey: firstString([
      routeC.apiKey,
      source.protocolApiKey,
      routeB.apiKey,
      routeB.imageApiKey,
      routeB.textApiKey,
      source.directImageApiKey,
      source.directTextApiKey,
      source.directApiKey,
      routeA.apiKey,
      source.apiKey,
    ]),
    protocolImageModel: protocolImageModel || DEFAULT_PROTOCOL_IMAGE_MODEL,
  };
}

export function getSelectedImageGenerationConfig(config = {}) {
  const normalized = normalizeImageRouteConfig(config, {
    defaultBaseUrl:
      config.baseUrl || config.directImageBaseUrl || config.directTextBaseUrl || config.directBaseUrl || "https://api.openai.com/v1",
    defaultResponsesModel: config.responsesModel || DEFAULT_RESPONSES_MODEL,
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
    return {
      imageRoute: IMAGE_ROUTE_B,
      baseUrl: normalized.directImageBaseUrl,
      endpointPath: normalized.directImageEndpointPath,
      apiKey: normalized.directImageApiKey,
      responsesModel: normalized.directImageModel,
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
    defaultBaseUrl:
      config.baseUrl || config.directTextBaseUrl || config.directImageBaseUrl || config.directBaseUrl || "https://api.openai.com/v1",
    defaultResponsesModel: config.responsesModel || DEFAULT_RESPONSES_MODEL,
  });

  if (normalized.imageRoute === IMAGE_ROUTE_B) {
    return {
      imageRoute: IMAGE_ROUTE_B,
      baseUrl: normalized.directTextBaseUrl,
      endpointPath: normalized.directTextEndpointPath,
      apiKey: normalized.directTextApiKey,
      responsesModel: normalized.directTextModel,
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
    defaultBaseUrl:
      config.baseUrl || config.directTextBaseUrl || config.directImageBaseUrl || config.directBaseUrl || "https://api.openai.com/v1",
    defaultResponsesModel: config.responsesModel || DEFAULT_RESPONSES_MODEL,
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
