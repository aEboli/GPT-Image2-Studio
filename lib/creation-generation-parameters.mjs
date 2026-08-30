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

const CREATION_SUBJECT_CONTENT_PROTECTION_PROMPT =
  "SUBJECT CONTENT LOCK: Subject content: keep each supplied product or packaging subject as shown, with its patterns, artwork, illustrations, symbols, logos, and printed text. Preserve its artwork, symbols, logos, and printed text in the same exact characters, spelling, writing system, and original language, placement, orientation, proportions, and colors; keep the same characters, original language, placement, and colors. OUTPUT LANGUAGE BOUNDARY: newly authored wording outside the physical product or packaging subject, only that separate wording follows the selected language; existing subject content stays in its original language. A different original language is a required exception. Added wording sits outside that subject; reference-card badges, prices, captions, and watermarks stay out.";

const CREATION_SUBJECT_IDENTITY_LOCK_PROMPT =
  "SUBJECT IDENTITY LOCK: when reference images are attached, the first attached image is the sole primary subject authority for this item. Reproduce that same physical product and variant with its silhouette, proportions, geometry, colorway, materials, logos, markings, hardware, and visible structure unchanged. Change only the requested scene, camera, layout, lighting, background, and supported copy. Supporting references provide only their assigned evidence and never redefine the primary subject; when references differ, the first attached subject reference wins.";

const CREATION_SUBJECT_IDENTITY_LOCK_PATTERN = /\bSUBJECT\s+IDENTITY\s+LOCK\s*:/i;
const CREATION_SUBJECT_CONTENT_LOCK_PATTERN = /\bSUBJECT\s+CONTENT\s+LOCK\s*:/i;

function clean(value) {
  return String(value ?? "").trim();
}

const CREATION_INFOGRAPHIC_REBUILD_BASE_PROMPT = [
  "INFOGRAPHIC REBUILD: SOURCE-ONLY VISUAL REDESIGN.",
  "GOAL: Rebuild the single attached source infographic as a clearly new, professionally designed infographic that is substantially redesigned at first glance.",
  "SOURCE AUTHORITY: That one image is the only visual and information authority. The selected target language, output format, resolution, and aspect ratio are output controls.",
  "PRESERVE: Keep the exact visible product identity, variant, product colors, parts, and quantities exactly. Carry over every source fact in full: brand names, model names, numbers, units, parameters, claims, steps, and lists exactly; do not summarize, omit, add, invent, replace, or contradict any source fact; retain the logical relationships expressed by groupings, icons, arrows, and callouts. Render every translatable visible text string completely in the selected target language when supplied, otherwise in its source language, translating faithfully with the meaning intact.",
  "REDESIGN: Build a new overall layout and information architecture, and materially change at least three additional visual dimensions among composition and product placement, background treatment, typography system, presentation color treatment with product colors kept exact, spacing and grouping, and the design of cards, icons, arrows, and callouts. Reorganize the reading flow for clarity. The product may be resized, repositioned, or recropped within the canvas while the product itself stays unchanged. A valid rebuild uses a different grid and arrangement than the source, including cards, icons, arrows, callouts. It is not a valid rebuild if it keeps substantially the same grid, only upscales, cleans, or sharpens the source, or makes only minor spacing, color, or typography changes.",
  "CANVAS: When the configured output canvas differs from the source, reflow the complete content into the new canvas with the product at true proportions and every information element retained.",
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
    clean(format) ? `OUTPUT FORMAT: ${clean(format).toUpperCase()}. Use this file format, keeping the label itself out of the artwork.` : "",
    resolutionText ? `RESOLUTION: ${resolutionText}.` : "",
    clean(ratio) ? `ASPECT RATIO: ${clean(ratio)}. Recompose the complete information for this canvas.` : "",
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
    ? `${ratioPrompt}\n\nNewly added marketing copy target language: ${targetLanguage}. It applies to new canvas-level text outside the physical product or packaging subject, and existing subject content stays as shown. Keep supplied brand names, model names, numbers, and units exactly when using them in new copy.`
    : ratioPrompt;
  const additions = [];
  if (!CREATION_SUBJECT_IDENTITY_LOCK_PATTERN.test(controlledPrompt)) {
    additions.push(CREATION_SUBJECT_IDENTITY_LOCK_PROMPT);
  }
  if (!CREATION_SUBJECT_CONTENT_LOCK_PATTERN.test(controlledPrompt)) {
    additions.push(CREATION_SUBJECT_CONTENT_PROTECTION_PROMPT);
  }
  return additions.length > 0 ? `${controlledPrompt}\n\n${additions.join("\n")}` : controlledPrompt;
}
