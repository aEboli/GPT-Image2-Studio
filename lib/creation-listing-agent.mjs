import { normalizeBaseUrl } from "./responses-workflow.mjs";
import {
  CREATION_LISTING_FIELD_MAX_CHARS,
  buildCreationListingSources,
  normalizeCreationListingDraft,
  validateCreationListingDraft,
} from "./creation-listing-draft.mjs";

const COMPETITOR_BRAND_PATTERN = /\b(?:amazon|walmart|temu|ebay|etsy|target)\b/gi;
const CJK_TEXT_PATTERN = /[\u3400-\u9fff]/u;
const CJK_TEXT_GLOBAL_PATTERN = /[\u3400-\u9fff]+/gu;
const NON_ASCII_TEXT_PATTERN = /[^\x20-\x7E]+/g;
const UNSUPPORTED_CLAIM_PATTERNS = [
  /\bfda\s+certified\b/gi,
  /\bmedical\s+grade\b/gi,
  /\bguaranteed?\b/gi,
  /\bbest\b/gi,
  /\bwarranty\b/gi,
];
const DEFAULT_RESPONSES_MODEL = "gpt-5.4";
const DEFAULT_CREATION_LISTING_REQUEST_TIMEOUT_MS = 600000;
const SIZE_UNIT_PATTERN = "(?:fl\\.?\\s*oz|fluid\\s*ounces?|in|inch|inches|cm|mm|ft|oz|lb|lbs|g|kg|ml|l)";
const SIZE_VALUE_UNIT_PATTERN = `\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}`;
const LISTING_TITLE_MAX_CHARS = 200;
const LISTING_SEO_AGENT_GUIDELINES = [
  "1. high-search Amazon SEO: lead with the exact product keyword, then use long-tail, traffic, and descriptive terms naturally without keyword stuffing.",
  "2. No-brand title formula: keep pack quantity first, then the high-search core product keyword, precise modifier or pain-point solution, core technology/material selling point, use case/audience/compatibility, and extra search terms. Do not include size, dimensions, weight, hook size, model specs, or measurement values in the title.",
  "3. Selling point rule: write result-first benefits, then support them with concrete visible features, materials, specs, or technology from the source. Pair one feature + buyer outcome or effect.",
  "4. Pain point rule: use fear + scene resonance. Every painPoints item must recreate a real usage-scene frustration the product category solves, then connect it to the product feature or result. It must be a use problem, not shopping uncertainty, SKU comparison, color-picking, size-checking, or listing metadata.",
  "5. Five bullets rule: write exactly five bullets. Each bullet must start with a short uppercase lead label (1-4 words) followed by a colon, then 1-2 plain English sentences.",
  "6. Five bullets script: BP1 solves the biggest pain with the core advantage; BP2 builds quality trust with material, craft, or durability facts; BP3 creates real-life scene resonance; BP4 answers size, capacity, fit, or easy-use doubts; BP5 uses package contents, setup readiness, compatibility, or buying clarity instead of gift or after-sales promises.",
];
const CHINESE_PRODUCT_KEYWORD_RULES = [
  {
    pattern: /(?:急救包|急救箱|医疗包|应急包|救援包)/u,
    term: "First Aid Kit",
  },
  {
    pattern: /(?=.*(?:电动|充电|电子))(?=.*(?:路亚|鱼饵|仿生|拟饵|硬饵))/u,
    term: "Electric Fishing Lure",
  },
  {
    pattern: /(?:路亚|鱼饵|仿生鱼饵|拟饵|硬饵)/u,
    term: "Fishing Lure",
  },
];
const COUNT_WORDS = new Map([
  [1, "one"],
  [2, "two"],
  [3, "three"],
  [4, "four"],
  [5, "five"],
  [6, "six"],
  [7, "seven"],
  [8, "eight"],
  [9, "nine"],
  [10, "ten"],
]);

export const CREATION_LISTING_JSON_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: [
    "title",
    "sellingPoints",
    "painPoints",
    "fiveBullets",
    "description",
    "backendSearchTerms",
    "keywordBuckets",
    "missingInfo",
    "warnings",
    "zhDisplay",
  ],
  properties: {
    title: { type: "string" },
    sellingPoints: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    painPoints: {
      type: "array",
      items: { type: "string" },
      maxItems: 8,
    },
    fiveBullets: {
      type: "array",
      items: { type: "string" },
      minItems: 5,
      maxItems: 5,
    },
    description: { type: "string" },
    backendSearchTerms: { type: "string" },
    keywordBuckets: {
      type: "object",
      additionalProperties: false,
      required: ["exact", "longTail", "traffic", "descriptive"],
      properties: {
        exact: {
          type: "array",
          items: { type: "string" },
        },
        longTail: {
          type: "array",
          items: { type: "string" },
        },
        traffic: {
          type: "array",
          items: { type: "string" },
        },
        descriptive: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
    missingInfo: {
      type: "array",
      items: { type: "string" },
    },
    warnings: {
      type: "array",
      items: { type: "string" },
    },
    zhDisplay: {
      type: "object",
      additionalProperties: false,
      required: [
        "title",
        "sellingPoints",
        "painPoints",
        "fiveBullets",
        "description",
        "backendSearchTerms",
        "keywordBuckets",
        "missingInfo",
        "warnings",
      ],
      properties: {
        title: { type: "string" },
        sellingPoints: {
          type: "array",
          items: { type: "string" },
        },
        painPoints: {
          type: "array",
          items: { type: "string" },
        },
        fiveBullets: {
          type: "array",
          items: { type: "string" },
        },
        description: { type: "string" },
        backendSearchTerms: { type: "string" },
        keywordBuckets: {
          type: "object",
          additionalProperties: false,
          required: ["exact", "longTail", "traffic", "descriptive"],
          properties: {
            exact: {
              type: "array",
              items: { type: "string" },
            },
            longTail: {
              type: "array",
              items: { type: "string" },
            },
            traffic: {
              type: "array",
              items: { type: "string" },
            },
            descriptive: {
              type: "array",
              items: { type: "string" },
            },
          },
        },
        missingInfo: {
          type: "array",
          items: { type: "string" },
        },
        warnings: {
          type: "array",
          items: { type: "string" },
        },
      },
    },
  },
};

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function positiveIntegerCount(value) {
  const count = Number.parseInt(cleanString(value), 10);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : 0;
}

function truncateField(value) {
  return cleanString(value).slice(0, CREATION_LISTING_FIELD_MAX_CHARS);
}

function joinTruncated(parts) {
  return truncateField(parts.filter(Boolean).join(" "));
}

function formatListingBullet(label, body) {
  return truncateField(`${cleanString(label).toUpperCase()}: ${cleanString(body)}`);
}

function sanitizeListingTerm(value, fallback = "Product") {
  let text = cleanString(value);
  for (const pattern of UNSUPPORTED_CLAIM_PATTERNS) {
    text = text.replace(pattern, " ");
  }
  text = text.replace(COMPETITOR_BRAND_PATTERN, " ");
  text = cleanString(text.replace(/\s+[-|,]\s+|\s{2,}/g, " "));
  return truncateField(text || fallback);
}

function toAsciiListingText(value) {
  return cleanString(String(value ?? "")
    .replace(CJK_TEXT_GLOBAL_PATTERN, " ")
    .replace(NON_ASCII_TEXT_PATTERN, " "));
}

function titleCaseIfSlugLike(value) {
  const text = cleanString(String(value || "").replace(/[-_]+/g, " "));
  if (!text) {
    return "";
  }
  const words = text.split(/\s+/);
  const slugLike = words.every((word) => /^[a-z0-9/&().]+$/.test(word));
  if (!slugLike) {
    return text;
  }
  return words.map((word) => {
    if (/^\d/.test(word) || word.length <= 2 && word === word.toUpperCase()) {
      return word;
    }
    return word.slice(0, 1).toUpperCase() + word.slice(1);
  }).join(" ");
}

function sanitizeEnglishListingTerm(value, fallback = "Product") {
  const sanitized = sanitizeListingTerm(value, "");
  const ascii = titleCaseIfSlugLike(toAsciiListingText(sanitized));
  return /[A-Za-z]/.test(ascii) ? truncateField(ascii) : fallback;
}

function sourceTextValues(source = {}) {
  return [
    source.productName,
    source.skuTitle,
    source.productDescription,
    source.skuNote,
    ...(Array.isArray(source.sellingPoints) ? source.sellingPoints : []),
    ...(Array.isArray(source.skuSubjects)
      ? source.skuSubjects.flatMap((sku) => [sku.title, sku.note])
      : []),
  ].map(cleanString).filter(Boolean);
}

function inferEnglishProductKeyword(source = {}) {
  const productValues = sourceTextValues(source);
  const combinedProductText = productValues.join(" ");
  if (CJK_TEXT_PATTERN.test(combinedProductText)) {
    for (const { pattern, term } of CHINESE_PRODUCT_KEYWORD_RULES) {
      if (pattern.test(combinedProductText)) {
        return term;
      }
    }
  }

  for (const value of productValues) {
    const term = sanitizeEnglishListingTerm(value, "");
    if (term && !/^(?:product|sample product)$/i.test(term)) {
      return term;
    }
  }

  const categoryTail = cleanString(source.industryTemplatePath).split(/[>|/]+/).at(-1);
  const categoryTerm = sanitizeEnglishListingTerm(categoryTail, "");
  if (categoryTerm) {
    return categoryTerm;
  }

  return "Product";
}

function normalizeListingTitle(value, fallback = "Product") {
  let text = sanitizeEnglishListingTerm(value, "");
  text = cleanString(text
    .replace(/\blisting\s+draft\b/gi, " ")
    .replace(/[^A-Za-z0-9,\-&/().\s]/g, " "));
  const counts = new Map();
  const tokens = [];
  for (const token of text.split(/\s+/)) {
    const key = token.replace(/[^A-Za-z0-9]+/g, "").toLowerCase();
    if (key) {
      const count = counts.get(key) || 0;
      if (count >= 2) {
        continue;
      }
      counts.set(key, count + 1);
    }
    tokens.push(token);
  }
  const normalized = cleanString(tokens.join(" "))
    .slice(0, LISTING_TITLE_MAX_CHARS)
    .replace(/[,\-/\s]+$/g, "");
  return normalized || fallback;
}

function trimTitleSegment(value, maxChars) {
  return cleanString(value)
    .slice(0, Math.max(0, maxChars))
    .replace(/[,\-/\s]+$/g, "");
}

function buildQuantityFirstListingTitle(quantity, product, titleTail, size) {
  const prefix = cleanString(quantity);
  const normalizedProduct = normalizeListingTitle(product, "Product");
  const suffix = normalizeListingTitle([titleTail, size].filter(Boolean).join(" "), "");
  const fixedText = [prefix, suffix].filter(Boolean).join(" ");
  const productBudget = LISTING_TITLE_MAX_CHARS - fixedText.length - (fixedText ? 1 : 0);
  const productPart = trimTitleSegment(normalizedProduct, productBudget) || normalizedProduct;
  return normalizeListingTitle([prefix, productPart, suffix].filter(Boolean).join(" "), normalizedProduct);
}

function stripJsonFence(text) {
  return cleanString(text)
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function parseJsonText(text) {
  const cleaned = stripJsonFence(text);
  if (!cleaned) {
    throw new Error("Listing response did not include JSON text.");
  }

  try {
    return JSON.parse(cleaned);
  } catch {
    const start = cleaned.indexOf("{");
    const end = cleaned.lastIndexOf("}");
    if (start >= 0 && end > start) {
      return JSON.parse(cleaned.slice(start, end + 1));
    }
    throw new Error("Listing response was not valid JSON.");
  }
}

function collectResponseText(value, parts = []) {
  if (!value || typeof value !== "object") {
    return parts;
  }

  if (typeof value.output_text === "string") {
    parts.push(value.output_text);
  }

  if (typeof value.text === "string") {
    parts.push(value.text);
  }

  if (value.json && typeof value.json === "object") {
    parts.push(JSON.stringify(value.json));
  }

  if (Array.isArray(value.output)) {
    value.output.forEach((item) => collectResponseText(item, parts));
  }

  if (Array.isArray(value.content)) {
    value.content.forEach((item) => collectResponseText(item, parts));
  }

  return parts;
}

function extractResponseText(payload = {}) {
  return collectResponseText(payload).join("\n").trim();
}

function skuSubjectUnitCount(sku = {}) {
  return positiveIntegerCount(
    sku.subjectUnitCount ??
      sku.subject_unit_count ??
      sku.visibleUnitCount ??
      sku.visible_unit_count ??
      sku.unitCount ??
      sku.unit_count,
  ) || 1;
}

function skuSubjectBundleCount(sku = {}) {
  return positiveIntegerCount(
    sku.bundleCount ??
      sku.bundle_count ??
      sku.quantity ??
      sku.count,
  ) || 1;
}

function skuSubjectListingQuantity(sku = {}) {
  return skuSubjectUnitCount(sku) * skuSubjectBundleCount(sku);
}

function firstCountOverOne(values = []) {
  return values.find((count) => Number.isFinite(count) && count > 1) || 0;
}

function uniquePositiveIntegerCounts(values = []) {
  const seen = new Set();
  return values
    .map(positiveIntegerCount)
    .filter((count) => count > 0)
    .sort((left, right) => left - right)
    .filter((count) => {
      if (seen.has(count)) {
        return false;
      }
      seen.add(count);
      return true;
    });
}

function expectedQuantity(source = {}) {
  const directCount = positiveIntegerCount(source.skuBundleCount);
  const explicitOptions = uniquePositiveIntegerCounts(
    source.skuQuantityOptions ?? source.sku_quantity_options ?? [],
  );
  if (explicitOptions.length > 1) {
    return `${explicitOptions.join("/")} Pack`;
  }
  const subjectCounts = Array.isArray(source.skuSubjects)
    ? source.skuSubjects.map(skuSubjectListingQuantity).filter((count) => count > 1)
    : [];
  const subjectOptions = uniquePositiveIntegerCounts(subjectCounts);
  if (subjectOptions.length > 1) {
    return `${subjectOptions.join("/")} Pack`;
  }
  const count = firstCountOverOne(subjectOptions) || firstCountOverOne(explicitOptions) || (directCount > 1 ? directCount : 1);
  return `${count} Pack`;
}

function countWord(count) {
  return COUNT_WORDS.get(count) || String(count);
}

function firstGroupedSkuSubject(source = {}) {
  const subjects = Array.isArray(source.skuSubjects) ? source.skuSubjects : [];
  for (const sku of subjects) {
    const subjectUnitCount = skuSubjectUnitCount(sku);
    if (subjectUnitCount > 1) {
      return { sku, subjectUnitCount };
    }
  }
  return null;
}

function groupedSubjectEvidenceText(source = {}) {
  const grouped = firstGroupedSkuSubject(source);
  if (!grouped) {
    return "";
  }

  const count = grouped.subjectUnitCount;
  const fallback = `${countWord(count)} complete visible product units`;
  const note = cleanString(grouped.sku.note || grouped.sku.description)
    .replace(/^one\s+product-subject\s+reference\s+image\s+contains\s+/i, "")
    .replace(/^the\s+grouped\s+sku\s+subject\s+contains\s+/i, "")
    .replace(/[.。]+$/g, "");
  if (!note) {
    return fallback;
  }
  if (CJK_TEXT_PATTERN.test(note)) {
    return fallback;
  }

  const lowered = note.toLowerCase();
  return lowered.includes(String(count)) || lowered.includes(countWord(count))
    ? note
    : `${fallback}: ${note}`;
}

function groupedSubjectDescriptionLine(source = {}) {
  const evidence = groupedSubjectEvidenceText(source);
  return evidence ? `This offer includes ${evidence} from the grouped SKU subject.` : "";
}

function groupedSubjectPromptInstruction(source = {}) {
  const evidence = groupedSubjectEvidenceText(source);
  if (!evidence) {
    return "";
  }

  return [
    `Grouped SKU quantity evidence: ${evidence}.`,
    `Title quantity must be ${expectedQuantity(source)}.`,
    `Description must explicitly mention ${evidence} so shoppers understand the offer contains more than one complete visible product unit.`,
    "Do not describe the grouped SKU subject as a single product body.",
  ].join(" ");
}

function groupedSubjectDescriptionQuantityError(draft = {}, source = {}) {
  const grouped = firstGroupedSkuSubject(source);
  if (!grouped) {
    return "";
  }

  const description = cleanString(draft.description);
  const count = grouped.subjectUnitCount;
  const countPattern = count <= 10 ? `(?:${count}|${countWord(count)})` : String(count);
  const unitPattern = "(?:complete\\s+)?(?:visible\\s+)?(?:(?:product|lure|sku|subject)\\s+)?(?:units?|bodies|body|lures?|colorways?|pieces?|items?|subjects?)";
  const hasCountedUnits = new RegExp(`\\b${countPattern}\\s+${unitPattern}\\b`, "i").test(description);
  return hasCountedUnits ? "" : "description must mention grouped SKU subject quantity";
}

function repairGroupedSubjectDescriptionQuantity(draft = {}, source = {}) {
  if (!groupedSubjectDescriptionQuantityError(draft, source)) {
    return draft;
  }

  const groupedSubjectDetail = groupedSubjectDescriptionLine(source);
  if (!groupedSubjectDetail) {
    return draft;
  }

  return {
    ...draft,
    description: joinTruncated([groupedSubjectDetail, draft.description]),
  };
}

function sizeValueUnitTokens(value = "") {
  return [...cleanString(value).matchAll(new RegExp(`\\b${SIZE_VALUE_UNIT_PATTERN}\\b`, "gi"))]
    .map((match) => cleanString(match[0].replace(/\s+/g, " ")));
}

function hasMetricAndImperialUnits(tokens = []) {
  const compactTokens = tokens.map((token) => cleanString(token).toLowerCase().replace(/\s+/g, ""));
  return compactTokens.some((token) => /(?:cm|mm|g|kg|ml|l)$/.test(token))
    && compactTokens.some((token) => /(?:in|inch|inches|ft|oz|lb|lbs|floz|fluidounce|fluidounces)$/.test(token));
}

function normalizeParentheticalSize(value) {
  return cleanString(value)
    .replace(/\s*\/\s*/g, "/")
    .replace(/\(\s*/g, "(")
    .replace(/\s*\)/g, ")");
}

function expectedSize(source = {}) {
  const text = cleanString(source.dimensionSpecs);
  const slashPartPattern = `${SIZE_VALUE_UNIT_PATTERN}(?:\\s*\\(\\s*${SIZE_VALUE_UNIT_PATTERN}\\s*\\))?`;
  const parentheticalSlashCompound = text.match(new RegExp(`\\b${slashPartPattern}(?:\\s*/\\s*${slashPartPattern})+`, "i"));
  if (parentheticalSlashCompound) {
    const tokens = sizeValueUnitTokens(parentheticalSlashCompound[0]);
    if (hasMetricAndImperialUnits(tokens)) {
      return normalizeParentheticalSize(parentheticalSlashCompound[0]);
    }
  }

  const parentheticalPair = text.match(new RegExp(`\\b${SIZE_VALUE_UNIT_PATTERN}\\s*\\(\\s*${SIZE_VALUE_UNIT_PATTERN}\\s*\\)`, "i"));
  if (parentheticalPair) {
    const tokens = sizeValueUnitTokens(parentheticalPair[0]);
    if (hasMetricAndImperialUnits(tokens)) {
      return normalizeParentheticalSize(parentheticalPair[0]);
    }
  }

  const slashCompound = text.match(new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}\\s*/\\s*\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}\\b`, "i"));
  if (slashCompound) {
    const tokens = sizeValueUnitTokens(slashCompound[0]);
    if (hasMetricAndImperialUnits(tokens)) {
      return tokens.join(" / ");
    }
    return cleanString(slashCompound[0].replace(/\s+/g, ""));
  }
  const unitTokens = sizeValueUnitTokens(text);
  if (unitTokens.length > 1 && hasMetricAndImperialUnits(unitTokens)) {
    return unitTokens.join(" / ");
  }
  const compound = text.match(new RegExp(`\\b\\d+(?:\\.\\d+)?(?:\\s*${SIZE_UNIT_PATTERN}?\\s*(?:x|×|by)\\s*\\d+(?:\\.\\d+)?){1,2}\\s*${SIZE_UNIT_PATTERN}\\b`, "i"));
  if (compound) {
    return cleanString(compound[0]);
  }
  return text.match(new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}\\b`, "i"))?.[0] || "";
}

function selectedUnitModeInstruction(source = {}) {
  const mode = cleanString(source.dimensionUnitMode);
  if (mode === "imperial") {
    return "Selected dimension unit mode: imperial. Use imperial units only for all size, weight, capacity, and measurement values in public listing fields and zhDisplay. Do not include metric equivalents such as mm, cm, g, kg, ml, or L.";
  }
  if (mode === "metric") {
    return "Selected dimension unit mode: metric. Use metric units only for all size, weight, capacity, and measurement values in public listing fields and zhDisplay. Do not include imperial equivalents such as in, inch, ft, oz, lb, or fl oz.";
  }
  return "Selected dimension unit mode: both. When dimensions are known, keep the metric and imperial units supplied in Source JSON without inventing extra conversions.";
}

function buildListingPrompt(source = {}, validationErrors = []) {
  return [
    "You are Listing SEO Agent, a dedicated Amazon US English listing writer and optimization agent for ecommerce products.",
    "Create exactly one parent listing draft for the whole saved creation set.",
    Array.isArray(source.skuSubjects) && source.skuSubjects.length > 0
      ? "Treat SKU subjects as variants/options within this single listing. Do not create separate listings per SKU."
      : "",
    selectedUnitModeInstruction(source),
    "Five-point listing quality constraints:",
    ...LISTING_SEO_AGENT_GUIDELINES,
    `Every field and every bullet must be ${CREATION_LISTING_FIELD_MAX_CHARS} characters or fewer.`,
    `sellingPoints and painPoints must each be ${CREATION_LISTING_FIELD_MAX_CHARS} English characters or fewer in total, counting all list items combined.`,
    `Title formula: start with ${expectedQuantity(source)}, keeping quantity first. Immediately after quantity, write the core product keyword, then use differentiating modifier, core technology/material, use case, compatibility, and search terms.`,
    groupedSubjectPromptInstruction(source),
    "Do not include size, unit, dimension, weight, hook size, model specs, or measurement values anywhere in the title.",
    "After quantity, use core search terms, long-tail terms, traffic terms, and descriptive terms in a readable no-brand title sequence without keyword stuffing.",
    "Public listing fields must be English only: title, sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, and keywordBuckets.",
    "Return zhDisplay as a Chinese UI-only reference translation, including warnings and missingInfo; zhDisplay must not replace the English public listing fields.",
    'Do not use the phrase "Listing Draft" in public listing fields.',
    "Use a Rufus-friendly structure around product type, concrete attributes, use cases, buyer pain points, and searchable terms.",
    "Five bullet structure: start every fiveBullets item with an uppercase lead label and colon, such as CORE VALUE:, BUILT TO LAST:, REAL-LIFE USE:, SIZE & FIT:, or PACKAGE SNAPSHOT:.",
    "Do not write gift, warranty, refund, risk-free, money-back, free replacement, contact-us, or after-sales promises in fiveBullets. Use package details, setup readiness, compatibility, or buying clarity for BP5 instead.",
    'Bad pain point examples to avoid: "Not sure which color to choose?", "Need size details before buying?", "The listing clearly groups the options."',
    'Good pain point style: "Dead-looking bait can get ignored during a slow retrieve; lifelike action helps create a more natural presentation."',
    "Use generated images only as visual evidence. Do not invent material, warranty, certification, compatibility, medical, safety, or performance claims.",
    source.evidenceMode === "input-only"
      ? "Generated images are unavailable. Use only product inputs and saved SKU metadata. Mark missing visual facts in missingInfo."
      : "Generated images or saved image metadata are available. Use them for visible selling points and pain points.",
    validationErrors.length ? `Fix these validation errors: ${validationErrors.join("; ")}` : "",
    `Source JSON:\n${JSON.stringify(source, null, 2)}`,
  ].filter(Boolean).join("\n\n");
}

function buildValidationOptions(source = {}) {
  return {
    expectedQuantity: expectedQuantity(source),
    forbidTitleSpecs: true,
    dimensionUnitMode: source.dimensionUnitMode,
  };
}

function makeRequestBody({ responsesModel, reasoningEffort, source, validationErrors }) {
  return {
    model: responsesModel || DEFAULT_RESPONSES_MODEL,
    reasoning: { effort: reasoningEffort || "medium" },
    input: buildListingPrompt(source, validationErrors),
    text: {
      format: {
        type: "json_schema",
        name: "creation_listing_draft_json",
        strict: true,
        schema: CREATION_LISTING_JSON_SCHEMA,
      },
    },
    stream: false,
  };
}

async function readResponsePayload(response) {
  const text = await response.text();
  if (!text.trim()) {
    return {};
  }

  try {
    return JSON.parse(text);
  } catch {
    return { output_text: text };
  }
}

function upstreamErrorMessage(payload = {}, status) {
  return payload.error?.message || payload.message || `Listing request failed with HTTP ${status}`;
}

function normalizeRequestTimeoutMs(value) {
  const timeoutMs = Number(value);
  return Number.isFinite(timeoutMs) && timeoutMs > 0
    ? timeoutMs
    : DEFAULT_CREATION_LISTING_REQUEST_TIMEOUT_MS;
}

async function fetchListingResponse(url, init, { fetchImpl, timeoutMs }) {
  if (typeof AbortController !== "function") {
    return fetchImpl(url, init);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetchImpl(url, { ...init, signal: controller.signal });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`Listing request timed out after ${timeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

function normalizeAndValidateDraft(parsed, source) {
  const draft = normalizeCreationListingDraft(parsed, source);
  const validation = validateCreationListingDraft(draft, buildValidationOptions(source));
  const groupedSubjectError = groupedSubjectDescriptionQuantityError(validation.draft, source);
  if (!groupedSubjectError) {
    return validation;
  }

  return {
    ...validation,
    ok: false,
    errors: [...validation.errors, groupedSubjectError],
  };
}

function listingValidationFailureMessage(validationErrors) {
  const details = (Array.isArray(validationErrors) ? validationErrors : [])
    .map(truncateField)
    .filter(Boolean)
    .join("; ");
  return details
    ? `Listing generation failed validation after 2 attempts: ${details}`
    : "Listing generation failed validation after 2 attempts.";
}

function pluralizeVariant(count) {
  return count === 1 ? "variant option" : "variant options";
}

function formatVariantText(variants = []) {
  if (variants.length === 0) {
    return "";
  }
  return `${variants.length} selectable ${pluralizeVariant(variants.length)}: ${variants.slice(0, 4).join(", ")}.`;
}

function formatVariantBullet(variants = []) {
  const variantText = formatVariantText(variants);
  return variantText
    ? `${variantText} Clear option names help shoppers compare similar choices.`
    : "";
}

function buildFallbackCopyProfile(skuName = "Product", { quantitySize = "", variants = [], groupedSubjectDetail = "" } = {}) {
  const product = normalizeListingTitle(skuName, "Product");
  const normalized = product.toLowerCase();
  const variantBullet = formatVariantBullet(variants);

  if (/\bfirst aid kit\b/.test(normalized)) {
    return {
      titleTail: "for Home Travel Office and Car",
      sellingPoints: [
        `${product} format keeps small emergency supplies grouped for home, travel, office, and car storage.`,
        "Compact portable kit presentation helps shoppers understand the offer quickly.",
      ],
      painPoints: [
        "Minor accidents away from home can turn stressful when supplies are scattered; a single kit format keeps essentials grouped.",
        "Jammed drawers and packed bags make small emergency items hard to find; compact kit presentation supports grab-and-go storage.",
      ],
      fiveBullets: [
        formatListingBullet("CORE VALUE", `${quantitySize} ${product} keeps pack count and size clear while solving the scattered-supplies problem.`),
        formatListingBullet("BUILT TO LAST", "Compact portable kit format keeps small emergency supplies grouped for regular home, travel, office, and car storage."),
        formatListingBullet("REAL-LIFE USE", "Fits everyday readiness moments in drawers, backpacks, glove boxes, and work areas without overstating medical performance."),
        formatListingBullet("SIZE & FIT", "Straightforward product details focus on kit type, quantity, size, and visible variant so the setup is easy to check."),
        formatListingBullet("PACKAGE SNAPSHOT", variantBullet || "Clear pack and size details help shoppers verify the right kit before purchase."),
      ],
      description: joinTruncated([`${product} option for shoppers comparing compact home, travel, office, and car emergency supply kits.`, groupedSubjectDetail]),
      backendSearchTerms: `${product} home travel emergency kit compact portable first aid supplies`,
      keywordBuckets: {
        exact: [product],
        longTail: [`${product} for home and travel`, `compact portable ${product}`],
        traffic: ["home emergency supplies", "travel first aid kit"],
        descriptive: ["compact portable kit", "quick access organizer"],
      },
      zhDisplay: {
        title: `${quantitySize} ${product} 中文复核`,
        sellingPoints: [
          "突出家庭、旅行、办公室和车载场景，避免夸大医疗效果。",
          "强调便携和收纳，不加入未验证认证或防水声明。",
        ],
        painPoints: [
          "外出遇到轻微意外时用品分散会增加慌乱，套装形式便于集中收纳。",
          "抽屉和背包杂乱时小件应急用品容易找不到，便携套装更适合随手带走。",
        ],
        fiveBullets: [
          `${quantitySize} 规格先解决用品分散、不好确认的问题。`,
          "便携套装结构用于家庭、旅行、办公室和车载收纳。",
          "适合抽屉、背包、车内和工位等日常应急场景。",
          "文案聚焦类型、数量、尺寸和可见变体，便于核对。",
          variants.length > 0 ? `包含 ${variants.length} 个可选变体，便于购买前核对。` : "包装信息聚焦购买前可核对内容。",
        ],
        description: `${product} 的中文复核说明。`,
        backendSearchTerms: `${product} 家庭 旅行 应急 收纳`,
        keywordBuckets: {
          exact: [product],
          longTail: [`${product} 家庭旅行`],
          traffic: ["应急用品"],
          descriptive: ["便携套装"],
        },
      },
    };
  }

  if (/\bbandages?\b/.test(normalized)) {
    return {
      titleTail: "for Home Travel First Aid Supplies",
      sellingPoints: [
        `${product} format keeps everyday first aid restocking simple for home and travel kits.`,
        "Clear pack and size details help shoppers compare bandage options quickly.",
      ],
      painPoints: [
        "Small cuts can interrupt travel, office, or home routines; everyday bandage refills help keep basic supplies within reach.",
        "Loose adhesive strips disappear in drawers and bags; compact refill positioning supports a tidier first aid setup.",
      ],
      fiveBullets: [
        formatListingBullet("CORE VALUE", `${quantitySize} ${product} keeps quantity and size visible for quick first aid restocking.`),
        formatListingBullet("BUILT TO LAST", "Compact refill positioning keeps everyday bandage supplies easier to store in home, travel, office, and bag setups."),
        formatListingBullet("REAL-LIFE USE", "Useful for small cuts that interrupt commutes, office days, school bags, or travel routines."),
        formatListingBullet("SIZE & FIT", "Clear product sizing and quantity details help match the refill to an existing first aid setup."),
        formatListingBullet("PACKAGE SNAPSHOT", variantBullet || "Direct product wording helps shoppers verify the bandage item before purchase."),
      ],
      description: joinTruncated([`${product} option for shoppers restocking compact first aid supplies at home, work, or while traveling.`, groupedSubjectDetail]),
      backendSearchTerms: `${product} home travel first aid refill compact supplies`,
      keywordBuckets: {
        exact: [product],
        longTail: [`${product} for home first aid`, `travel first aid ${product}`],
        traffic: ["first aid refill", "home first aid supplies"],
        descriptive: ["compact bandage item", "travel supply"],
      },
      zhDisplay: {
        title: `${quantitySize} ${product} 中文复核`,
        sellingPoints: ["强调家庭和旅行急救补充场景。", "展示数量和尺寸，便于比较。"],
        painPoints: ["小割伤会打断出行、办公或居家节奏，日常创口贴补充更便于随手备用。", "散放的贴片容易在抽屉和包里找不到，补充装定位更适合整理急救用品。"],
        fiveBullets: [
          `${quantitySize} 规格让补充数量和尺寸更醒目。`,
          "紧凑补充装定位便于家庭、旅行、办公室和随身包收纳。",
          "适合小割伤打断出行、办公或居家节奏时备用。",
          "尺寸和数量信息便于匹配已有急救收纳。",
          variants.length > 0 ? `包含 ${variants.length} 个可选变体，便于购买前核对。` : "包装信息聚焦购买前可核对内容。",
        ],
        description: `${product} 的中文复核说明。`,
        backendSearchTerms: `${product} 家庭 旅行 急救 补充`,
        keywordBuckets: {
          exact: [product],
          longTail: [`${product} 家庭急救`],
          traffic: ["急救补充用品"],
          descriptive: ["便携用品"],
        },
      },
    };
  }

  if (/\b(?:fishing lure|swimbait|lure|bait)\b/.test(normalized)) {
    return {
      titleTail: "Jointed Fish Shape Lifelike Propeller Swimbait Slow Sinking Bass Trout Freshwater Saltwater Hard Bait",
      sellingPoints: [
        `${product} details keep size, pack count, and visible option names easy to compare.`,
        "Compact tackle-focused wording helps shoppers identify the lure type quickly.",
      ],
      painPoints: [
        "Dead-looking bait can get ignored during slow retrieves; a clear lure profile helps create a more purposeful presentation.",
        "Low-visibility water can make ordinary bait hard to notice; visible color, flash, and body details help the lure stand out.",
      ],
      fiveBullets: [
        formatListingBullet("CORE ACTION", `${quantitySize} ${product} keeps quantity and size visible while addressing dead-looking bait presentations.`),
        formatListingBullet("BUILT TO LAST", "Compact tackle-focused profile keeps the lure easy to pack, handle, and organize for repeated freshwater outings."),
        formatListingBullet("REAL-LIFE USE", "Useful for pond, lake, and weekend bass fishing presentations where visible motion and flash matter."),
        formatListingBullet("SIZE & FIT", "Clear length, weight, and option details make the lure easier to match with a tackle box setup."),
        formatListingBullet("PACKAGE SNAPSHOT", variantBullet || "Visible option details help shoppers verify color or style before purchase."),
      ],
      description: joinTruncated([`${product} option for shoppers comparing compact freshwater tackle by pack count, size, and visible variants.`, groupedSubjectDetail]),
      backendSearchTerms: `${product} propeller swimbait slow sinking bass trout freshwater saltwater hard bait jointed lifelike lure`,
      keywordBuckets: {
        exact: [product],
        longTail: [
          `${product} propeller swimbait`,
          "slow sinking bass trout lure",
          "freshwater saltwater hard bait",
        ],
        traffic: [
          "bass fishing lure",
          "trout fishing bait",
          "freshwater swimbait",
          "saltwater hard bait",
        ],
        descriptive: [
          "jointed fish shape lure",
          "lifelike propeller bait",
          "hard swimbait",
        ],
      },
      zhDisplay: {
        title: `${quantitySize} ${product} 中文复核`,
        sellingPoints: ["突出尺寸、数量和可见变体，便于比较。", "按路亚渔具场景组织信息。"],
        painPoints: ["鱼饵动作死板时容易被忽略，清晰外形有助于呈现更像目标的泳姿。", "水色浑浊时普通鱼饵不够显眼，颜色、闪光和鱼身细节有助于提高可见度。"],
        fiveBullets: [
          `${quantitySize} 规格先解决鱼饵动作死板、存在感弱的核心问题。`,
          "紧凑渔具定位便于装入、取用和整理。",
          "适合池塘、湖泊和周末淡水路亚场景。",
          "长度、重量和选项信息便于匹配渔具盒配置。",
          variants.length > 0 ? `包含 ${variants.length} 个可选变体，便于购买前核对。` : "包装信息聚焦颜色、款式和规格核对。",
        ],
        description: `${product} 的中文复核说明。`,
        backendSearchTerms: `${product} 淡水 渔具 变体`,
        keywordBuckets: {
          exact: [product],
          longTail: [`${product} 淡水渔具`],
          traffic: ["渔具"],
          descriptive: ["紧凑鱼饵"],
        },
      },
    };
  }

  return {
    titleTail: variants.length > 1 ? `${variants.length} Variant Options` : "for Everyday Use",
    sellingPoints: [
      `${product} details keep pack count first while size and visible option names stay easy to compare.`,
      "Clear option naming helps shoppers compare available variants without extra guesswork.",
    ],
    painPoints: [
      "A poorly matched everyday item can interrupt the task; clear product positioning helps users keep the right option ready.",
      "Loose or hard-to-identify items create small delays during use; concise product details help set practical expectations.",
    ],
    fiveBullets: [
      formatListingBullet("CORE VALUE", `${quantitySize} ${product} keeps quantity and size visible while clarifying the product's main use.`),
      formatListingBullet("BUILT TO LAST", "Product wording stays grounded in supplied type, visible features, and available specs instead of unsupported claims."),
      formatListingBullet("REAL-LIFE USE", "Clear use-focused copy helps shoppers picture where the product fits into everyday routines."),
      formatListingBullet("SIZE & FIT", "Compact details make size, quantity, and variant comparison easier across similar product options."),
      formatListingBullet("PACKAGE SNAPSHOT", variantBullet || "Clear quantity, size, and option details help shoppers verify the right choice before purchase."),
    ],
    description: joinTruncated([`${product} option for shoppers comparing pack count, size, and available variants before purchase.`, groupedSubjectDetail]),
    backendSearchTerms: `${product} compact option size variant comparison`,
    keywordBuckets: {
      exact: [product],
      longTail: [`${product} compact option`, `${product} size variant`],
      traffic: ["product option", "variant choice"],
      descriptive: ["compact details", "clear size"],
    },
    zhDisplay: {
      title: `${quantitySize} ${product} 中文复核`,
      sellingPoints: ["先展示数量和尺寸，便于买家识别。", "清晰选项名便于比较变体。"],
      painPoints: ["日常用品不匹配实际任务时会打断使用节奏，清晰定位便于提前准备。", "物品散乱或难以识别会造成使用时的小延误，简洁信息有助于建立实际预期。"],
      fiveBullets: [
        `${quantitySize} 规格让数量、尺寸和核心用途更醒目。`,
        "文案只基于已提供类型、可见特征和规格，不加入无依据承诺。",
        "按日常使用场景组织信息，帮助理解适用位置。",
        "紧凑信息便于比较尺寸、数量和变体。",
        variants.length > 0 ? `包含 ${variants.length} 个可选变体，便于购买前核对。` : "包装信息聚焦购买前可核对内容。",
      ],
      description: `${product} 的中文复核说明。`,
      backendSearchTerms: `${product} 尺寸 变体 比较`,
      keywordBuckets: {
        exact: [product],
        longTail: [`${product} 变体`],
        traffic: ["商品选项"],
        descriptive: ["清晰尺寸"],
      },
    },
  };
}

export function makeMockCreationListingDraft(source = {}) {
  const quantity = expectedQuantity(source);
  const size = expectedSize(source);
  const skuName = inferEnglishProductKeyword(source);
  const variants = Array.isArray(source.skuSubjects)
    ? source.skuSubjects
      .map((sku) => sanitizeEnglishListingTerm(sku.title, "") || sanitizeEnglishListingTerm(sku.id, ""))
      .filter(Boolean)
    : [];
  const quantitySize = [quantity, size].filter(Boolean).join(" ");
  const groupedSubjectDetail = groupedSubjectDescriptionLine(source);
  const profile = buildFallbackCopyProfile(skuName, { quantitySize, variants, groupedSubjectDetail });
  const title = buildQuantityFirstListingTitle(quantity, skuName, profile.titleTail, "");
  const missingInfo = source.evidenceMode === "input-only" ? ["Generated image evidence was unavailable."] : [];
  const sourceWarnings = (Array.isArray(source.warnings) ? source.warnings : []).map(cleanString).filter(Boolean);
  return normalizeCreationListingDraft({
    id: `listing-${sanitizeListingTerm(source.setId || "main", "main").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    skuSubjectId: source.skuSubjectId,
    skuTitle: skuName,
    evidenceMode: source.evidenceMode,
    status: "completed",
    title,
    sellingPoints: profile.sellingPoints.map(truncateField),
    painPoints: profile.painPoints.map(truncateField),
    fiveBullets: profile.fiveBullets.map(truncateField).slice(0, 5),
    description: truncateField(profile.description),
    backendSearchTerms: truncateField(profile.backendSearchTerms),
    keywordBuckets: profile.keywordBuckets,
    missingInfo,
    warnings: sourceWarnings,
    zhDisplay: {
      ...profile.zhDisplay,
      missingInfo: missingInfo.map(() => "生成图片证据不可用。"),
      warnings: sourceWarnings.map(() => "发布前请复核该警告对应的来源证据。"),
    },
  }, source);
}

export async function requestCreationListingDraft({
  baseUrl,
  apiKey,
  responsesModel,
  reasoningEffort = "medium",
  source,
  fetchImpl = fetch,
  mock = false,
  requestTimeoutMs = DEFAULT_CREATION_LISTING_REQUEST_TIMEOUT_MS,
}) {
  if (mock) {
    return makeMockCreationListingDraft(source);
  }

  const timeoutMs = normalizeRequestTimeoutMs(requestTimeoutMs);
  let validationErrors = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchListingResponse(`${normalizeBaseUrl(baseUrl)}/responses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(makeRequestBody({
        responsesModel,
        reasoningEffort,
        source,
        validationErrors,
      })),
    }, {
      fetchImpl,
      timeoutMs,
    });
    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(upstreamErrorMessage(payload, response.status));
    }

    try {
      const parsed = parseJsonText(extractResponseText(payload));
      let validation = normalizeAndValidateDraft(parsed, source);
      if (!validation.ok && attempt === 1) {
        const repairedDraft = repairGroupedSubjectDescriptionQuantity(validation.draft, source);
        if (repairedDraft !== validation.draft) {
          validation = normalizeAndValidateDraft(repairedDraft, source);
        }
      }
      if (validation.ok) {
        return validation.draft;
      }
      validationErrors = validation.errors;
    } catch (error) {
      validationErrors = [error instanceof Error ? error.message : String(error)];
    }
  }

  throw new Error(listingValidationFailureMessage(validationErrors));
}

export async function generateCreationListingDrafts({ set, config = {}, fetchImpl = fetch, mock = false }) {
  const sources = buildCreationListingSources(set);
  const drafts = [];
  for (const source of sources) {
    drafts.push(await requestCreationListingDraft({
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      responsesModel: config.responsesModel,
      reasoningEffort: config.reasoningEffort,
      requestTimeoutMs: config.requestTimeoutMs,
      source,
      fetchImpl,
      mock,
    }));
  }
  return drafts;
}
