import { appendRatioHintToPrompt, resolveAspectRatioOption } from "./aspect-ratios.mjs";
import {
  getDefaultGenerationSize,
  getDefaultModelProtocolImageSize,
  getGenerationSizeOptions,
  normalizeModelProtocolImageSize,
} from "./generation-size-options.mjs";

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
  "SUBJECT CONTENT LOCK: Preserve supplied product or packaging artwork, symbols, logos, surface text, shape, colors, placement, orientation, and proportions. Printed, engraved, embossed, or embroidered text keeps its original characters and language. Use product input and reference notes as source facts.";

const CREATION_SUBJECT_IDENTITY_LOCK_PROMPT =
  "SUBJECT IDENTITY LOCK: with a product reference, preserve that physical product and variant as the subject anchor: silhouette, proportions, geometry, colorway, materials, logos, markings, hardware, and visible structure. Apply the requested camera, scene, layout, lighting, background, and supported copy; supporting references provide assigned evidence.";

const CREATION_SUBJECT_IDENTITY_LOCK_PATTERN = /\bSUBJECT\s+IDENTITY\s+LOCK\s*:/i;
const CREATION_SUBJECT_CONTENT_LOCK_PATTERN = /\bSUBJECT\s+CONTENT\s+LOCK\s*:/i;

function clean(value) {
  return String(value ?? "").trim();
}

const CREATION_INFOGRAPHIC_REBUILD_BASE_PROMPT = [
  "INFOGRAPHIC REBUILD: Create a clearly new, professionally designed infographic from the single attached source image.",
  "SOURCE AUTHORITY: Use that image for product identity, facts, quantities, labels, steps, package contents, specifications, names, numbers, units, and relationships. The selected language, format, resolution, and ratio are output controls.",
  "PRESERVE: Keep product or packaging shape, variant, colors, parts, quantities, and surface text in the original form. Translate surrounding layout wording with the source meaning intact.",
  "REDESIGN: Build a new information architecture and grid, changing at least three of composition, background, typography, color, spacing, grouping, cards, icons, arrows, or callouts while retaining every source fact.",
  "CANVAS: Reflow the complete design for the selected ratio and resolution with legible information and true product proportions.",
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
      ? `TARGET LANGUAGE: ${targetLanguageText}; surrounding layout text uses this language, while subject text, brand/model names, numbers, and units stay as sourced.`
      : "",
    clean(format) ? `FORMAT: ${clean(format).toUpperCase()}.` : "",
    resolutionText ? `CANVAS: ${resolutionText}.` : "",
    clean(ratio) ? `RATIO: ${clean(ratio)}.` : "",
  ].filter(Boolean);
  return [
    CREATION_INFOGRAPHIC_REBUILD_BASE_PROMPT,
    outputControls.length > 0 ? `OUTPUT CONTROLS: ${outputControls.join(" ")}` : "",
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
    fallbackSize = "",
    fallbackTargetLanguage = "",
    fallbackFormat = "",
  } = {},
) {
  const ratioOption = resolveAspectRatioOption(clean(item.ratio) || clean(fallbackRatio) || "1:1");
  const rawRequestedSize = clean(item.effectiveSize) || clean(item.resolutionTier) || clean(fallbackSize);
  const isAutomaticSize = !rawRequestedSize || rawRequestedSize.toLowerCase() === "auto";
  const requestedSize = isAutomaticSize
    ? imageRoute === "c"
      ? getDefaultModelProtocolImageSize()
      : getDefaultGenerationSize(ratioOption.value)
    : rawRequestedSize;
  const targetLanguage = clean(item.targetLanguage) || clean(fallbackTargetLanguage);
  const format = clean(item.format) || clean(fallbackFormat);
  const resolved = imageRoute === "c"
    ? resolveModelProtocolSize(normalizeModelProtocolImageSize(requestedSize))
    : resolveDimensionRouteSize(ratioOption.value, requestedSize);

  return {
    ratioOption,
    requestedSize,
    finalSize: resolved.finalSize,
    targetLanguage,
    format,
    resolutionTier: clean(item.resolutionTier).toLowerCase() === "auto"
      ? resolved.finalSize
      : clean(item.resolutionTier) || requestedSize,
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
  const hasTargetLanguageGuidance = /(?:new(?:ly)?\s+authored\s+(?:canvas|layout)\s+text|new\s+canvas\s+(?:text|wording)|added\s+canvas\s+text)/i.test(ratioPrompt);
  const controlledPrompt = targetLanguage && allowsAddedText && !hasTargetLanguageGuidance
    ? `${ratioPrompt}\n\nNEW LAYOUT TEXT: Use ${targetLanguage} for newly authored headings, labels, callouts, captions, steps, package lists, and specifications outside the physical product or packaging subject. Keep subject-surface text, brand/model names, numbers, and units in their original form.`
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
