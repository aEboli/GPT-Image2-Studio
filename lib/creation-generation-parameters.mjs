import { resolveAspectRatioOption } from "./aspect-ratios.mjs";
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
  "SUBJECT CONTENT LOCK: Preserve supplied product or packaging artwork, symbols, logos, surface text, shape, colors, placement, orientation, and proportions. Keep printed, engraved, embossed, or embroidered text in its original characters and language. Treat supplied details and references as source facts.";

const CREATION_SUBJECT_IDENTITY_LOCK_PROMPT =
  "SUBJECT IDENTITY LOCK: Preserve the supplied product and variant as the primary subject, including material, hardware, and visible structure. Supporting references provide assigned evidence only.";

const CREATION_SUBJECT_IDENTITY_LOCK_PATTERN = /\bSUBJECT\s+IDENTITY\s+LOCK\s*:/i;
const CREATION_SUBJECT_CONTENT_LOCK_PATTERN = /\bSUBJECT\s+CONTENT\s+LOCK\s*:/i;

function clean(value) {
  return String(value ?? "").trim();
}

const CREATION_INFOGRAPHIC_REBUILD_BASE_PROMPT = [
  "INFOGRAPHIC REBUILD: Redesign the attached source image as a professional infographic with a new grid; change at least three of layout, background, typography, color, spacing, grouping, icons, or callouts.",
  "SOURCE FACTS: Preserve physical product identity, facts, measurements, units, values, quantities, and relationships; treat off-product source wording as layout content, not product data.",
  "LANGUAGE: All visible canvas text, including headings, labels, captions, specifications, badges, and corner graphics, uses only the selected target language. Translate or rebuild off-product wording and replace source characters. Keep source language only for text physically on the product or packaging. Omit unclear wording or use concise copy supported by the image.",
  "PRODUCT: Keep physical product shape, variant, colors, parts, quantities, and surface text exact; reflow the layout legibly for the selected ratio and resolution.",
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
  const targetLanguageInstruction = targetLanguageText
    ? clean(targetLanguage).toLowerCase() === "en"
      ? `TARGET LANGUAGE: ${targetLanguageText}; all off-product text uses Latin letters only. Replace source-script text with English only when clear; otherwise erase it and leave clean space. Never copy source glyphs as decoration; preserve factual values.`
      : `TARGET LANGUAGE: ${targetLanguageText}; rewrite off-product wording in this language, use standard unit symbols, and preserve values.`
    : "";
  const outputControls = [
    clean(format) ? `FORMAT: ${clean(format).toUpperCase()}.` : "",
    resolutionText ? `CANVAS: ${resolutionText}.` : "",
    clean(ratio) ? `RATIO: ${clean(ratio)}.` : "",
    targetLanguageInstruction,
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
  const ratioOption = parameters.ratioOption || resolveAspectRatioOption("1:1");
  const ratioPrompt = `${clean(prompt)}\n\nAspect ratio: ${ratioOption.value}.`;
  const targetLanguage = clean(parameters.targetLanguage);
  const allowsAddedText = clean(item.textPolicy).toLowerCase() !== "none";
  const hasCanvasTextGuidance =
    /\bCANVAS (?:LANGUAGE|TEXT POLICY)\s*:/i.test(ratioPrompt) ||
    /\bCANVAS TEXT OVERRIDE\s*:/i.test(ratioPrompt) ||
    /\bUse concise .{1,80} for (?:all )?(?:new|newly authored) canvas text\b/i.test(ratioPrompt) ||
    /\bCanvas text uses existing subject-surface markings only\b/i.test(ratioPrompt);
  const canvasTextBoundary = targetLanguage && !hasCanvasTextGuidance
      ? allowsAddedText
      ? `CANVAS LANGUAGE: Use concise ${formatCreationTargetLanguage(targetLanguage)} for new text outside the product or packaging; preserve existing subject text, brand/model names, numbers, and units.`
      : "CANVAS TEXT POLICY: Use existing product or packaging markings only."
    : "";
  const controlledPrompt = ratioPrompt;
  const additions = [];
  if (!CREATION_SUBJECT_IDENTITY_LOCK_PATTERN.test(controlledPrompt)) {
    additions.push(CREATION_SUBJECT_IDENTITY_LOCK_PROMPT);
  }
  if (!CREATION_SUBJECT_CONTENT_LOCK_PATTERN.test(controlledPrompt)) {
    additions.push(CREATION_SUBJECT_CONTENT_PROTECTION_PROMPT);
  }
  return [controlledPrompt, additions.join("\n"), canvasTextBoundary].filter(Boolean).join("\n\n");
}
