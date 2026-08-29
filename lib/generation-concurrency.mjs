import {
  DEFAULT_GENERATION_CONCURRENCY,
  MAX_GENERATION_CONCURRENCY,
  MIN_GENERATION_CONCURRENCY,
} from "./studio-constants.mjs";

export const GENERATION_CONCURRENCY_FIELD = "generationConcurrency";

// An empty, absent, or unparsable value falls back to the default; a parsable
// out-of-range value is clamped to the nearest bound. Zero and negatives clamp
// up to the minimum rather than disabling the fan-out. Never throws, because a
// bad tuning value must not fail a generation request.
export function normalizeGenerationConcurrency(value, fallback = DEFAULT_GENERATION_CONCURRENCY) {
  const normalizedFallback = Number.isFinite(Number(fallback))
    ? Math.min(Math.max(Math.round(Number(fallback)), MIN_GENERATION_CONCURRENCY), MAX_GENERATION_CONCURRENCY)
    : DEFAULT_GENERATION_CONCURRENCY;

  if (value === null || value === undefined || String(value).trim() === "") {
    return normalizedFallback;
  }

  const parsed = Number(String(value).trim());
  if (!Number.isFinite(parsed)) {
    return normalizedFallback;
  }

  return Math.min(Math.max(Math.round(parsed), MIN_GENERATION_CONCURRENCY), MAX_GENERATION_CONCURRENCY);
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

// The request value wins so a browser can tune the concurrency without a saved
// server config; the saved default is the fallback.
export function resolveGenerationConcurrency(source, config = {}) {
  const configured = normalizeGenerationConcurrency(
    config?.defaults?.[GENERATION_CONCURRENCY_FIELD] ?? config?.[GENERATION_CONCURRENCY_FIELD],
  );
  return normalizeGenerationConcurrency(readField(source, GENERATION_CONCURRENCY_FIELD), configured);
}

// One uniform knob for every bounded-concurrency fan-out: the configured value
// is authoritative in both directions. Per-path ceilings are deliberately gone,
// because a value the UI shows as 30 must not silently stay 15 on one panel.
//
// Callers MUST pass the result to the session task slot limiter as its
// per-request `maxParallelTasks` override. Without that, the scope's startup
// slot limit decides instead: a higher value leaves the extra workers spinning
// in the slot-wait loop, and a lower one is ignored entirely once two fan-outs
// in the same scope overlap on the shared bucket.
export function resolveGenerationConcurrencyForLimit(source, config = {}) {
  return resolveGenerationConcurrency(source, config);
}
