import { appendRatioHintToPrompt, resolveAspectRatioOption } from "./aspect-ratios.mjs";
import { getGenerationSizeOptions } from "./generation-size-options.mjs";

const MODEL_PROTOCOL_SIZES = ["512", "1K", "2K", "4K"];
const CREATION_TARGET_LANGUAGE_NAMES = {
  "zh-CN": "Simplified Chinese",
  en: "English",
  ja: "Japanese",
  ko: "Korean",
  fr: "French",
  de: "German",
  es: "Spanish",
};

const CREATION_SUBJECT_CONTENT_PROTECTION_PROMPT = [
  "SUBJECT CONTENT LOCK: Treat every supplied physical product or packaging subject as immutable product identity.",
  "Preserve all existing subject-surface patterns, artwork, illustrations, symbols, icons, logos, brand marks, and printed, engraved, embossed, or embroidered text exactly as shown.",
  "Keep the exact characters, spelling, writing system, and original language, together with their placement, orientation, proportions, and colors.",
  "Do not translate, transliterate, rewrite, correct, localize, redraw, replace, remove, cover, or restyle any of this existing subject content.",
  "OUTPUT LANGUAGE BOUNDARY: Never use the selected output language to modify subject content. If the current item permits newly authored wording outside the physical product or packaging subject, only that separate wording follows the selected language.",
  "Existing subject text in a different original language is a required exception and must remain visible in that original language.",
  "Do not copy reference-card overlays outside the physical subject, including corner emblems, prices, promotional stickers, title bars, or watermarks, unless explicitly requested; they are not protected subject content.",
].join(" ");

function clean(value) {
  return String(value ?? "").trim();
}

const CREATION_INFOGRAPHIC_REBUILD_BASE_PROMPT = [
  "INFOGRAPHIC REBUILD: SOURCE-ONLY VISUAL REDESIGN.",
  "GOAL: Rebuild the single attached source infographic as a clearly new, professionally designed infographic. The result must look substantially redesigned at first glance, not copied, traced, cleaned up, or lightly restyled.",
  "SOURCE AUTHORITY: Treat that one image as the only visual and information authority. The selected target language, output format, resolution, and aspect ratio are output controls only. Ignore and do not infer product, platform, audience, branding, marketing, or visual-style context from anything else.",
  "MUST PRESERVE: Keep the exact visible product identity, variant, product colors, parts, and quantities. Render every translatable visible text string completely in the selected target language when supplied; otherwise retain its source language. Preserve brand names, model names, numbers, units, parameters, claims, steps, and lists exactly. Keep the logical relationships expressed by groupings, icons, arrows, and callouts. Translate faithfully without rewriting meaning. Do not summarize, omit, add, invent, replace, or contradict any source information.",
  "REQUIRED REDESIGN: Create a new overall layout and information architecture. Materially change at least three additional visual dimensions: composition and product placement; background treatment; typography system; presentation color treatment while keeping product colors exact; spacing and grouping; and the design of cards, icons, arrows, callouts, and other information components. Reorganize the content and reading flow for clarity. You may resize, reposition, or recrop the product within the canvas, but do not alter the product itself.",
  "FAILURE CONDITIONS: It is not a valid rebuild if it keeps substantially the same grid or relative arrangement, only upscales, cleans, or sharpens the source, makes only minor spacing, color, or typography changes, or places an unchanged source composition on new margins. Do not trace or imitate the original layout.",
  "CANVAS: If the configured output canvas differs from the source, reflow all complete source content into the new canvas. Do not stretch the product, crop off any information, or add filler content.",
  "FINAL CHECK: Every source fact must remain complete and accurate, while the visual design must be unmistakably new.",
].join("\n");

function formatCreationTargetLanguage(value) {
  const targetLanguage = clean(value);
  const languageName = CREATION_TARGET_LANGUAGE_NAMES[targetLanguage] || targetLanguage;
  return targetLanguage && languageName ? `${languageName} (${targetLanguage})` : "";
}

export function buildCreationSubjectContentProtectionPrompt() {
  return CREATION_SUBJECT_CONTENT_PROTECTION_PROMPT;
}

export function buildCreationInfographicRebuildPrompt({
  targetLanguage = "",
  ratio = "",
  requestedSize = "",
  effectiveSize = "",
  format = "",
} = {}) {
  const targetLanguageText = formatCreationTargetLanguage(targetLanguage);
  const requestedResolution = clean(requestedSize);
  const effectiveResolution = clean(effectiveSize);
  const resolutionText = [
    requestedResolution ? `requested ${requestedResolution}` : "",
    effectiveResolution ? `effective canvas ${effectiveResolution}` : "",
  ].filter(Boolean).join("; ");
  const outputControls = [
    targetLanguageText
      ? `TARGET LANGUAGE: ${targetLanguageText}. Translate every translatable visible source text string completely into this language without changing facts.`
      : "",
    clean(format) ? `OUTPUT FORMAT: ${clean(format).toUpperCase()}. Use this file format; do not print the format label in the artwork.` : "",
    resolutionText ? `RESOLUTION: ${resolutionText}.` : "",
    clean(ratio) ? `ASPECT RATIO: ${clean(ratio)}. Recompose the complete information for this canvas instead of preserving the source canvas.` : "",
  ].filter(Boolean);
  return [
    CREATION_INFOGRAPHIC_REBUILD_BASE_PROMPT,
    outputControls.length > 0 ? `SELECTED OUTPUT CONTROLS:\n${outputControls.join("\n")}` : "",
  ].filter(Boolean).join("\n");
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
  {
    imageRoute = "",
    fallbackRatio = "1:1",
    fallbackSize = "auto",
    fallbackTargetLanguage = "",
    fallbackFormat = "",
  } = {},
) {
  const ratioOption = resolveAspectRatioOption(clean(item.ratio) || clean(fallbackRatio) || "1:1");
  const requestedSize = clean(item.effectiveSize) || clean(item.resolutionTier) || clean(fallbackSize) || "auto";
  const targetLanguage = clean(item.targetLanguage) || clean(fallbackTargetLanguage);
  const format = clean(item.format) || clean(fallbackFormat);
  const resolved = imageRoute === "c"
    ? resolveModelProtocolSize(requestedSize === "auto" ? "1K" : requestedSize)
    : resolveDimensionRouteSize(ratioOption.value, requestedSize === "auto" ? "1K" : requestedSize);

  return {
    ratioOption,
    requestedSize,
    finalSize: resolved.finalSize,
    targetLanguage,
    format,
    resolutionTier: clean(item.resolutionTier) || requestedSize,
    usedFallback: resolved.usedFallback,
  };
}

export function buildCreationItemGenerationPrompt(prompt = "", parameters = {}, item = {}) {
  if (clean(item.role || item.itemKind) === "infographic-rebuild") {
    return buildCreationInfographicRebuildPrompt({
      targetLanguage: parameters.targetLanguage,
      ratio: parameters.ratioOption?.value,
      requestedSize: parameters.resolutionTier || parameters.requestedSize,
      effectiveSize: parameters.finalSize,
      format: parameters.format,
    });
  }
  const ratioPrompt = appendRatioHintToPrompt(clean(prompt), parameters.ratioOption || resolveAspectRatioOption("1:1"));
  const targetLanguage = clean(parameters.targetLanguage);
  const allowsAddedText = clean(item.textPolicy).toLowerCase() !== "none";
  const controlledPrompt = targetLanguage && allowsAddedText
    ? `${ratioPrompt}\n\nNewly added marketing copy target language: ${targetLanguage}. This language applies only to new canvas-level text outside the physical product or packaging subject; it does not authorize changing any existing subject content. Preserve supplied brand names, model names, numbers, and units exactly when using them in new copy.`
    : ratioPrompt;
  if (controlledPrompt.includes(CREATION_SUBJECT_CONTENT_PROTECTION_PROMPT)) {
    return controlledPrompt;
  }
  return `${controlledPrompt}\n\n${CREATION_SUBJECT_CONTENT_PROTECTION_PROMPT}`;
}
