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
import { normalizeApiBaseUrl } from "./api-base-url.mjs";
import {
  DEFAULT_DIRECT_IMAGE_MODEL,
  DEFAULT_DIRECT_RESPONSES_MODEL,
  normalizeImageRouteConfig,
} from "./image-route-config.mjs";

export const DEFAULT_CONFIG = {
  baseUrl: DEFAULT_BASE_URL,
  apiKey: "",
  responsesModel: "gpt-5.4",
  imageRoute: "a",
  directBaseUrl: DEFAULT_BASE_URL,
  directApiKey: "",
  directImageModel: DEFAULT_DIRECT_IMAGE_MODEL,
  directResponsesModel: DEFAULT_DIRECT_RESPONSES_MODEL,
  defaults: {
    size: "896x1120",
    quality: "high",
    format: "png",
    reasoningEffort: DEFAULT_REASONING_EFFORT,
  },
};

function mergeConfig(source = {}) {
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
  });
  return {
    ...merged,
    ...routeConfig,
    baseUrl: normalizeApiBaseUrl(routeConfig.baseUrl, { defaultBaseUrl: DEFAULT_CONFIG.baseUrl }),
    directBaseUrl: normalizeApiBaseUrl(routeConfig.directBaseUrl, { defaultBaseUrl: DEFAULT_CONFIG.baseUrl }),
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

export function createConfigStore({ rootDir }) {
  const localDir = join(rootDir, ".local");
  const configPath = join(localDir, "config.json");

  async function ensureDir() {
    await mkdir(localDir, { recursive: true });
  }

  async function readPrivateConfig() {
    try {
      const raw = await readFile(configPath, "utf8");
      return mergeConfig(JSON.parse(raw));
    } catch (error) {
      if (error && typeof error === "object" && error.code === "ENOENT") {
        return mergeConfig();
      }

      throw error;
    }
  }

  async function saveConfig(nextConfig) {
    await ensureDir();
    const currentConfig = await readPrivateConfig();
    const merged = mergeConfig({
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
      defaults: {
        ...currentConfig.defaults,
        ...(nextConfig.defaults || {}),
      },
    });

    await writeFile(configPath, `${JSON.stringify(merged, null, 2)}\n`, "utf8");
    return merged;
  }

  async function readPublicConfig() {
    const config = await readPrivateConfig();
    return {
      baseUrl: config.baseUrl,
      apiKeyConfigured: Boolean(config.apiKey),
      apiKeyMask: maskApiKey(config.apiKey),
      responsesModel: config.responsesModel,
      imageRoute: config.imageRoute,
      directBaseUrl: config.directBaseUrl,
      directApiKeyConfigured: Boolean(config.directApiKey),
      directApiKeyMask: maskApiKey(config.directApiKey),
      directImageModel: config.directImageModel,
      directResponsesModel: config.directResponsesModel,
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
