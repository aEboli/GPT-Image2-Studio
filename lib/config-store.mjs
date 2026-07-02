import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

import {
  DEFAULT_BASE_URL,
  DEFAULT_REASONING_EFFORT,
  MAX_CREATION_REFERENCE_IMAGES,
  MAX_CREATION_STYLE_REFERENCE_IMAGES,
  MAX_PARALLEL_TASKS_PER_SESSION,
  MAX_PORTRAIT_ACTION_REFERENCE_IMAGES,
  MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES,
  MAX_PORTRAIT_PERSON_REFERENCE_IMAGES,
  MAX_REFERENCE_IMAGES,
  REASONING_EFFORT_OPTIONS,
} from "./studio-constants.mjs";
import {
  API_ENDPOINT_IMAGE_GENERATIONS,
  API_ENDPOINT_RESPONSES,
  DEFAULT_DIRECT_IMAGE_MODEL,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  DEFAULT_PROTOCOL_IMAGE_MODEL,
  IMAGE_ROUTE_B,
  IMAGE_ROUTE_C,
  normalizeImageRoute,
  normalizeImageRouteConfig,
} from "./image-route-config.mjs";

export const DEFAULT_CONFIG = {
  baseUrl: DEFAULT_BASE_URL,
  apiKey: "",
  endpointPath: API_ENDPOINT_RESPONSES,
  responsesModel: "gpt-5.4",
  imageRoute: "a",
  directBaseUrl: DEFAULT_BASE_URL,
  directApiKey: "",
  directEndpointPath: API_ENDPOINT_IMAGE_GENERATIONS,
  directImageModel: DEFAULT_DIRECT_IMAGE_MODEL,
  directResponsesModel: DEFAULT_DIRECT_RESPONSES_MODEL,
  protocolBaseUrl: DEFAULT_BASE_URL,
  protocolApiKey: "",
  protocolImageModel: DEFAULT_PROTOCOL_IMAGE_MODEL,
  defaults: {
    size: "1024x1280",
    quality: "high",
    format: "png",
    reasoningEffort: DEFAULT_REASONING_EFFORT,
  },
};

function firstConfigString(values, fallback = "") {
  for (const value of values) {
    const normalized = String(value || "").trim();
    if (normalized) {
      return normalized;
    }
  }
  return fallback;
}

function normalizeDefaultReasoningEffort(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return REASONING_EFFORT_OPTIONS.includes(normalized) ? normalized : "";
}

function setConfigString(target, key, values) {
  const value = firstConfigString(values);
  if (value) {
    target[key] = value;
  }
}

function buildEnvironmentConfig(env = {}) {
  const reasoningEffort = normalizeDefaultReasoningEffort(
    firstConfigString([env.reasoningEffort, env.REASONING_EFFORT, env.IMAGE_STUDIO_REASONING_EFFORT]),
  );
  const config = {};

  setConfigString(config, "imageRoute", [env.imageRoute, env.IMAGE_ROUTE, env.IMAGE_STUDIO_IMAGE_ROUTE]);
  setConfigString(config, "baseUrl", [env.baseUrl, env.OPENAI_BASE_URL, env.IMAGE_STUDIO_BASE_URL]);
  setConfigString(config, "endpointPath", [env.endpointPath, env.ENDPOINT_PATH, env.IMAGE_STUDIO_ENDPOINT_PATH]);
  setConfigString(config, "apiKey", [env.apiKey, env.OPENAI_API_KEY, env.IMAGE_STUDIO_API_KEY]);
  setConfigString(config, "responsesModel", [env.responsesModel, env.RESPONSES_MODEL, env.IMAGE_STUDIO_RESPONSES_MODEL]);
  setConfigString(config, "directBaseUrl", [env.directBaseUrl, env.DIRECT_BASE_URL, env.IMAGE_STUDIO_DIRECT_BASE_URL]);
  setConfigString(
    config,
    "directEndpointPath",
    [
      env.directEndpointPath,
      env.DIRECT_ENDPOINT_PATH,
      env.IMAGE_STUDIO_DIRECT_ENDPOINT_PATH,
    ],
  );
  setConfigString(config, "directApiKey", [env.directApiKey, env.DIRECT_API_KEY, env.IMAGE_STUDIO_DIRECT_API_KEY]);
  setConfigString(
    config,
    "directImageModel",
    [
      env.directImageModel,
      env.DIRECT_IMAGE_MODEL,
      env.IMAGE_STUDIO_DIRECT_IMAGE_MODEL,
    ],
  );
  setConfigString(
    config,
    "directResponsesModel",
    [
      env.directResponsesModel,
      env.DIRECT_RESPONSES_MODEL,
      env.IMAGE_STUDIO_DIRECT_RESPONSES_MODEL,
    ],
  );
  setConfigString(config, "protocolBaseUrl", [
    env.protocolBaseUrl,
    env.PROTOCOL_BASE_URL,
    env.IMAGE_STUDIO_PROTOCOL_BASE_URL,
  ]);
  setConfigString(config, "protocolApiKey", [env.protocolApiKey, env.PROTOCOL_API_KEY, env.IMAGE_STUDIO_PROTOCOL_API_KEY]);
  setConfigString(
    config,
    "protocolImageModel",
    [
      env.protocolImageModel,
      env.PROTOCOL_IMAGE_MODEL,
      env.IMAGE_STUDIO_PROTOCOL_IMAGE_MODEL,
    ],
  );
  if (reasoningEffort) {
    config.defaults = { reasoningEffort };
  }

  return config;
}

function mergeSavedConfigWithEnvironment(savedConfig = {}, environmentConfig = {}) {
  const merged = {
    ...savedConfig,
    defaults: {
      ...(savedConfig.defaults || {}),
    },
  };
  const routeAKeys = [
    "baseUrl",
    "endpointPath",
    "apiKey",
    "responsesModel",
  ];
  const directKeys = [
    "directBaseUrl",
    "directEndpointPath",
    "directApiKey",
    "directImageModel",
    "directResponsesModel",
  ];
  const protocolKeys = [
    "protocolBaseUrl",
    "protocolApiKey",
    "protocolImageModel",
  ];
  const hasRouteAEnvironment = routeAKeys.some((key) => firstConfigString([environmentConfig[key]]));
  const hasDirectEnvironment = directKeys.some((key) => firstConfigString([environmentConfig[key]]));
  const hasProtocolEnvironment = protocolKeys.some((key) => firstConfigString([environmentConfig[key]]));
  const environmentRoute = normalizeImageRoute(environmentConfig.imageRoute);

  if (hasRouteAEnvironment) {
    routeAKeys.forEach((key) => delete merged[key]);
  }
  if (hasDirectEnvironment || (environmentRoute === IMAGE_ROUTE_B && hasRouteAEnvironment)) {
    directKeys.forEach((key) => delete merged[key]);
  }
  if (hasProtocolEnvironment || (environmentRoute === IMAGE_ROUTE_C && (hasDirectEnvironment || hasRouteAEnvironment))) {
    protocolKeys.forEach((key) => delete merged[key]);
  }

  ["imageRoute", ...routeAKeys, ...directKeys, ...protocolKeys].forEach((key) => {
    const value = firstConfigString([environmentConfig[key]]);
    if (value) {
      merged[key] = value;
    }
  });

  if (environmentConfig.defaults && typeof environmentConfig.defaults === "object") {
    merged.defaults = {
      ...merged.defaults,
      ...environmentConfig.defaults,
    };
  }

  if (Object.keys(merged.defaults).length === 0) {
    delete merged.defaults;
  }

  return merged;
}

function mergeConfig(source = {}, { preserveRootBaseUrls = false } = {}) {
  const merged = {
    ...DEFAULT_CONFIG,
    ...source,
    defaults: {
      ...DEFAULT_CONFIG.defaults,
      ...(source.defaults || {}),
    },
  };
  const routeConfig = normalizeImageRouteConfig(merged, {
    defaultBaseUrl: DEFAULT_CONFIG.baseUrl,
    defaultResponsesModel: DEFAULT_CONFIG.responsesModel,
    preserveRootBaseUrls,
  });
  return {
    ...merged,
    ...routeConfig,
    baseUrl: routeConfig.baseUrl || DEFAULT_CONFIG.baseUrl,
    directBaseUrl: routeConfig.directBaseUrl || DEFAULT_CONFIG.baseUrl,
    protocolBaseUrl: routeConfig.protocolBaseUrl || DEFAULT_CONFIG.baseUrl,
  };
}

function maskApiKey(apiKey) {
  if (!apiKey) {
    return undefined;
  }

  if (apiKey.length <= 8) {
    return `${apiKey.slice(0, 2)}***`;
  }

  return `${apiKey.slice(0, 4)}***${apiKey.slice(-4)}`;
}

export function createConfigStore({ rootDir, env = {} }) {
  const localDir = join(rootDir, ".local");
  const configPath = join(localDir, "config.json");
  const environmentConfig = buildEnvironmentConfig(env);

  async function ensureDir() {
    await mkdir(localDir, { recursive: true });
  }

  async function readSavedConfig() {
    try {
      const raw = await readFile(configPath, "utf8");
      return JSON.parse(raw);
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return {};
      }

      throw error;
    }
  }

  async function readPrivateConfig() {
    const savedConfig = await readSavedConfig();
    return mergeConfig(mergeSavedConfigWithEnvironment(savedConfig, environmentConfig), {
      preserveRootBaseUrls: true,
    });
  }

  async function saveConfig(nextConfig) {
    await ensureDir();
    const currentConfig = await readPrivateConfig();
    const merged = mergeConfig(
      {
        ...currentConfig,
        ...nextConfig,
        apiKey:
          nextConfig.apiKey === undefined || nextConfig.apiKey === ""
            ? currentConfig.apiKey
            : nextConfig.apiKey,
        directApiKey:
          nextConfig.directApiKey === undefined || nextConfig.directApiKey === ""
            ? currentConfig.directApiKey
            : nextConfig.directApiKey,
        protocolApiKey:
          nextConfig.protocolApiKey === undefined || nextConfig.protocolApiKey === ""
            ? currentConfig.protocolApiKey
            : nextConfig.protocolApiKey,
        defaults: {
          ...currentConfig.defaults,
          ...(nextConfig.defaults || {}),
        },
      },
      {
        preserveRootBaseUrls: {
          baseUrl: nextConfig.baseUrl === undefined,
          directBaseUrl: nextConfig.directBaseUrl === undefined,
          protocolBaseUrl: nextConfig.protocolBaseUrl === undefined,
        },
      },
    );

    await writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    return merged;
  }

  async function readPublicConfig() {
    const config = await readPrivateConfig();
    return {
      baseUrl: config.baseUrl,
      apiKeyConfigured: Boolean(config.apiKey),
      apiKeyMask: maskApiKey(config.apiKey),
      endpointPath: config.endpointPath,
      responsesModel: config.responsesModel,
      imageRoute: config.imageRoute,
      directBaseUrl: config.directBaseUrl,
      directApiKeyConfigured: Boolean(config.directApiKey),
      directApiKeyMask: maskApiKey(config.directApiKey),
      directEndpointPath: config.directEndpointPath,
      directImageModel: config.directImageModel,
      directResponsesModel: config.directResponsesModel,
      protocolBaseUrl: config.protocolBaseUrl,
      protocolApiKeyConfigured: Boolean(config.protocolApiKey),
      protocolApiKeyMask: maskApiKey(config.protocolApiKey),
      protocolImageModel: config.protocolImageModel,
      defaults: {
        ...config.defaults,
      },
      limits: {
        maxParallelTasksPerSession: MAX_PARALLEL_TASKS_PER_SESSION,
        maxReferenceImages: MAX_REFERENCE_IMAGES,
        maxCreationReferenceImages: MAX_CREATION_REFERENCE_IMAGES,
        maxCreationStyleReferenceImages: MAX_CREATION_STYLE_REFERENCE_IMAGES,
        maxPortraitPersonReferenceImages: MAX_PORTRAIT_PERSON_REFERENCE_IMAGES,
        maxPortraitActionReferenceImages: MAX_PORTRAIT_ACTION_REFERENCE_IMAGES,
        maxPortraitAccessoryReferenceImages: MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES,
      },
      reasoningEfforts: [...REASONING_EFFORT_OPTIONS],
    };
  }

  return {
    configPath,
    readPrivateConfig,
    readPublicConfig,
    saveConfig,
  };
}
