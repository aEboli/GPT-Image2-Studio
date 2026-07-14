import { appendRatioHintToPrompt, resolveAspectRatioOption } from "./aspect-ratios.mjs";
import { getGenerationSizeOptions } from "./generation-size-options.mjs";

const MODEL_PROTOCOL_SIZES = ["512", "1K", "2K", "4K"];

function clean(value) {
  return String(value ?? "").trim();
}

function parseDimensions(value) {
  const match = clean(value).toLowerCase().match(/^(\d+)x(\d+)$/);
  return match ? { width: Number(match[1]), height: Number(match[2]) } : null;
}

function tierPixels(value) {
  const normalized = clean(value).toLowerCase();
  if (normalized === "max" || normalized === "maximum") return Number.POSITIVE_INFINITY;
  if (normalized === "512") return 512;
  const match = normalized.match(/^(\d+(?:\.\d+)?)k$/);
  return match ? Number(match[1]) * 1024 : null;
}

function distanceFromTarget(option, target) {
  const dimensions = parseDimensions(option.value);
  if (!dimensions) return Number.POSITIVE_INFINITY;
  if (target.dimensions) {
    return Math.hypot(dimensions.width - target.dimensions.width, dimensions.height - target.dimensions.height);
  }
  return Math.abs(Math.min(dimensions.width, dimensions.height) - target.pixels);
}

function resolveDimensionRouteSize(ratio, requestedSize) {
  const options = getGenerationSizeOptions(ratio).filter((option) => option.value !== "auto");
  const exact = options.find((option) => option.value.toLowerCase() === requestedSize.toLowerCase());
  if (exact) return { finalSize: exact.value, usedFallback: false };

  const dimensions = parseDimensions(requestedSize);
  const pixels = tierPixels(requestedSize);
  if (!dimensions && pixels === null) {
    return { finalSize: options[0].value, usedFallback: true };
  }
  if (pixels === Number.POSITIVE_INFINITY) {
    return { finalSize: options.at(-1).value, usedFallback: false };
  }

  const target = { dimensions, pixels };
  const nearest = options.reduce((best, option) =>
    distanceFromTarget(option, target) < distanceFromTarget(best, target) ? option : best,
  );
  return { finalSize: nearest.value, usedFallback: Boolean(dimensions) };
}

function resolveModelProtocolSize(requestedSize) {
  const normalized = requestedSize.toLowerCase();
  const exact = MODEL_PROTOCOL_SIZES.find((size) => size.toLowerCase() === normalized);
  if (exact) return { finalSize: exact, usedFallback: false };
  if (normalized === "max" || normalized === "maximum") {
    return { finalSize: MODEL_PROTOCOL_SIZES.at(-1), usedFallback: true };
  }

  const pixels = tierPixels(requestedSize) ?? (() => {
    const dimensions = parseDimensions(requestedSize);
    return dimensions ? Math.min(dimensions.width, dimensions.height) : 1024;
  })();
  const nearest = MODEL_PROTOCOL_SIZES.reduce((best, size) =>
    Math.abs((tierPixels(size) || 1024) - pixels) < Math.abs((tierPixels(best) || 1024) - pixels) ? size : best,
  );
  return { finalSize: nearest, usedFallback: true };
}

export function resolveCreationItemGenerationParameters(
  item = {},
  { imageRoute = "", fallbackRatio = "1:1", fallbackSize = "auto", fallbackTargetLanguage = "" } = {},
) {
  const ratioOption = resolveAspectRatioOption(clean(item.ratio) || clean(fallbackRatio) || "1:1");
  const requestedSize = clean(item.effectiveSize) || clean(item.resolutionTier) || clean(fallbackSize) || "auto";
  const targetLanguage = clean(item.targetLanguage) || clean(fallbackTargetLanguage);
  const resolved = imageRoute === "c"
    ? resolveModelProtocolSize(requestedSize === "auto" ? "1K" : requestedSize)
    : resolveDimensionRouteSize(ratioOption.value, requestedSize === "auto" ? "1K" : requestedSize);

  return {
    ratioOption,
    requestedSize,
    finalSize: resolved.finalSize,
    targetLanguage,
    resolutionTier: clean(item.resolutionTier) || requestedSize,
    usedFallback: resolved.usedFallback,
  };
}

export function buildCreationItemGenerationPrompt(prompt = "", parameters = {}) {
  const ratioPrompt = appendRatioHintToPrompt(clean(prompt), parameters.ratioOption || resolveAspectRatioOption("1:1"));
  const targetLanguage = clean(parameters.targetLanguage);
  if (!targetLanguage) return ratioPrompt;
  return `${ratioPrompt}\n\nVisible marketing copy target language: ${targetLanguage}. Preserve supplied brand names, model names, numbers, and units exactly.`;
}
