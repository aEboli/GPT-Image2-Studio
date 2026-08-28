import {
  DEFAULT_GENERATION_START_DELAY_MS,
  MAX_GENERATION_START_DELAY_MS,
  MIN_GENERATION_START_DELAY_MS,
} from "./studio-constants.mjs";

export const GENERATION_START_DELAY_FIELD = "generationStartDelayMs";

// An empty, absent, or unparsable value falls back to the default; a parsable
// out-of-range value is clamped to the nearest bound. Never throws, because a
// bad tuning value must not fail a generation request.
export function normalizeGenerationStartDelayMs(value, fallback = DEFAULT_GENERATION_START_DELAY_MS) {
  const normalizedFallback = Number.isFinite(Number(fallback))
    ? Math.min(Math.max(Math.round(Number(fallback)), MIN_GENERATION_START_DELAY_MS), MAX_GENERATION_START_DELAY_MS)
    : DEFAULT_GENERATION_START_DELAY_MS;

  if (value === null || value === undefined || String(value).trim() === "") {
    return normalizedFallback;
  }

  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return normalizedFallback;
  }

  return Math.min(Math.max(Math.round(parsed), MIN_GENERATION_START_DELAY_MS), MAX_GENERATION_START_DELAY_MS);
}

function readField(source, key) {
  if (!source) {
    return "";
  }

  if (typeof source.get === "function") {
    return source.get(key);
  }

  return source[key];
}

// The request value wins so a browser can tune the interval without a saved
// server config; the saved default is the fallback.
export function resolveGenerationStartDelayMs(source, config = {}) {
  const configured = normalizeGenerationStartDelayMs(
    config?.defaults?.[GENERATION_START_DELAY_FIELD] ?? config?.[GENERATION_START_DELAY_FIELD],
  );
  return normalizeGenerationStartDelayMs(readField(source, GENERATION_START_DELAY_FIELD), configured);
}
