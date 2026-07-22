import { appendApiEndpointPath } from "./image-route-config.mjs";
import {
  CREATION_LISTING_BILINGUAL_CONTENT_FIELDS,
  CREATION_LISTING_FIELD_MAX_CHARS,
  buildCreationListingSources,
  containsCreationListingFunctionalWording,
  extractCreationListingForbiddenTerms,
  formatCreationListingPackQuantity,
  getCreationListingHighRiskClaimErrors,
  normalizeCreationListingDraft,
  sanitizeCreationListingNoBrandContent,
  validateCreationListingDraft,
} from "./creation-listing-draft.mjs";
import {
  getCreationListingPolicy,
  resolveCreationListingPolicy,
} from "./creation-listing-policies.mjs";

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
  "2. No-brand title formula: keep pack quantity first, then the high-search core product keyword, supplied quantity, color, material, shape, model, variant, and other objective attributes. Do not include size, dimensions, weight, hook size, model specs, or measurement values in the title.",
  "3. Attribute-only rule: describe only objective product identity, quantity, color, material, shape, dimensions, model, variant, and package contents that are present in the source.",
  "4. Neutral review rule: painPoints must contain only objective pre-purchase checks such as quantity, selected option, dimensions, or package contents. Do not describe a problem the product solves or any buyer outcome.",
  "5. Five bullets rule: write exactly five bullets. Each bullet must start with a short uppercase lead label (1-4 words) followed by a colon, then 1-2 plain English sentences.",
  "6. Five bullets script: use PRODUCT TYPE, PACK DETAILS, VISIBLE DETAILS, SPECIFICATIONS, and PACKAGE CONTENTS. State facts only; do not state functions, effects, solutions, advantages, use outcomes, or performance.",
];
const LISTING_FUNCTIONAL_WORDING_GUARDRAILS = [
  "Hard compliance rule for every platform: no public field or zhDisplay field may contain functional, efficacy, performance, problem-solution, use-outcome, or benefit wording, even when the source contains it.",
  "Do not say or imply that the product helps, supports, improves, enhances, boosts, reduces, relieves, prevents, protects, promotes, solves, optimizes, enables, or delivers an outcome.",
  "Do not use effect-oriented adjectives such as easy, quick, convenient, effective, efficient, powerful, durable, waterproof, leakproof, non-slip, or antibacterial.",
  "Chinese fields must likewise omit 功能、功效、效果、性能、作用、帮助、有助于、改善、提升、增强、促进、缓解、预防、保护、解决、便于、方便、快速、耐用、防水、防漏、防滑、抗菌、适合、适用于 and equivalent wording.",
  "When source text contains functional wording, extract only its objective attributes and omit the function or effect. Never copy the prohibited wording into search terms or keyword buckets.",
];
const PLATFORM_V1_LISTING_GUIDELINES = [
  "1. Platform search fit: lead with the exact product keyword, then use long-tail, traffic, and descriptive terms naturally without keyword stuffing, following the resolved platform title and search rules.",
  "2. No-brand title foundation: use the high-search core product keyword and supplied objective attributes such as quantity, color, material, shape, model, and variant in the order preferred by the resolved platform policy, then apply the mandatory title value rule below when supported evidence exists.",
  "3. Non-title attribute-only rule: sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, keywordBuckets, and their Chinese counterparts may describe only objective product identity, quantity, color, material, shape, dimensions, model, variant, and package contents present in the source.",
  ...LISTING_SEO_AGENT_GUIDELINES.slice(3),
];
const PLATFORM_V1_NON_TITLE_FUNCTIONAL_WORDING_GUARDRAILS = [
  "Hard compliance rule: no non-title fields may contain functional, efficacy, performance, problem-solution, use-outcome, or benefit wording, even when the source contains it.",
  "Outside title and zhDisplay.title, do not say or imply that the product helps, supports, improves, enhances, boosts, reduces, relieves, prevents, protects, promotes, solves, optimizes, enables, or delivers an outcome.",
  "Outside title and zhDisplay.title, do not use effect-oriented adjectives such as easy, quick, convenient, effective, efficient, powerful, durable, waterproof, leakproof, non-slip, or antibacterial.",
  "Chinese non-title fields must likewise omit 功能、功效、效果、性能、作用、帮助、有助于、改善、提升、增强、促进、缓解、预防、保护、解决、便于、方便、快速、耐用、防水、防漏、防滑、抗菌、适合、适用于 and equivalent wording.",
  "When source text contains functional wording, reserve a directly supported value relationship for title and zhDisplay.title only. In non-title fields, extract only objective attributes and never copy the prohibited wording into search terms or keyword buckets.",
];
const PLATFORM_V1_NON_TITLE_COMPLETENESS_GUIDELINES = [
  "Non-title completeness rule: when Source JSON supports enough distinct objective facts and platform hard limits allow, write 4-5 sellingPoints and 3-4 painPoints. These recommendations are not quotas: return fewer items whenever the evidence cannot support distinct content.",
  "Each sellingPoints item must be a complete, specific statement that combines one primary objective differentiator with a closely related supplied detail such as visible construction, component, shape, color, variant, quantity, specification, or package fact. Do not output isolated attribute labels or generic adjectives.",
  "PainPoints declarative format: painPoints must use declarative statements only. Each item must be one concise, complete factual statement about a real pre-purchase check such as selected color or variant, stated dimensions or model, quantity, or exact package contents; never describe a product function, buyer outcome, or invented fear.",
  "Every painPoints item must state the product fact directly. Never use a question mark (? or ？), a rhetorical question, a question followed by an answer, or an interrogative fragment. Do not use unknown, missing, or not specified as filler; omit that item when the source cannot provide a factual statement.",
  "Cross-field separation: assign each supported fact to its strongest decision role and use a different decision point in every item. Do not repeat the title or another field merely to make content longer, and do not paraphrase the same fact to reach an item count.",
  "Five-bullet responsibility map: PRODUCT TYPE covers product identity and category; PACK DETAILS covers quantity and confirmed option or variant structure; VISIBLE DETAILS covers visible construction, components, shape, and color; SPECIFICATIONS covers only traceable dimensions, material, model, construction, or care facts; PACKAGE CONTENTS covers exact included items and excludes unverified extras.",
  "After each fixed fiveBullets label, write 1-2 complete factual sentences within the platform per-item limit. Keep the five labels in the required order and do not recycle a sentence or decision point under another label.",
  "Description completeness: when evidence and platform limits permit, use 2-4 short paragraphs in this order: product identity and category; visible construction and components; traceable specifications and confirmed variants; quantity and package contents. Aim for 350-500 English characters total when evidence supports that range. Never exceed 500 characters or a stricter platform limit. Use natural connected prose rather than disconnected fragments.",
  "Search surface rule: backendSearchTerms must add directly relevant synonyms, alternate category names, and objective long-tail phrases not already used verbatim in visible fields. Follow the resolved platform search surface and item limits; output publishable phrases for visible tags and compact lowercase terms for hidden search fields unless the locale requires otherwise.",
  "Keyword bucket roles: exact contains core product and category phrases; longTail contains product plus supplied attribute, variant, quantity, or package phrases; traffic contains broader but still directly relevant category phrases; descriptive contains evidence-backed color, shape, material, construction, style, or visible-detail phrases.",
  "Deduplicate case-insensitively across backendSearchTerms and all four keyword buckets. Treat punctuation-only variants, mechanical singular/plural variants, reordered equivalents, and semantic synonyms as duplicates; retain the clearest phrase on its best search surface.",
  "Bilingual parity: zhDisplay must preserve the same array lengths, order, facts, quantities, and units as the English fields. Translate each corresponding meaning naturally without adding, removing, merging, or splitting claims, including every keyword bucket.",
  "Evidence-shortage and limit rule: platform hard limits and factual support override all recommended counts and lengths. Omit unsupported content, shorten lower-priority detail, or return fewer entries instead of duplicating, inferring, or inventing facts.",
];
const PLATFORM_V1_BUYER_FACING_LANGUAGE_GUIDELINES = [
  "Buyer-facing language rule: write every non-title field for a shopper reading a finished product page, not for an analyst, auditor, catalog operator, or content-generation system. Use natural, fluent sentences that name the product or component directly.",
  "Never expose internal record, evidence, or generation workflow in buyer-visible copy. Prohibited meta phrases include parent listing, parent product, saved creation set, supplied configuration, reference labels, the reference states, selected quantity, confirmed selection, this listing covers, Source JSON, evidence mode, and Chinese equivalents such as 父级商品、父体条目、已保存套图、已保存创作套组、已提供配置、参考标注、所选数量、已确认选择、此条目涵盖. Do not paraphrase these internal ideas.",
  "Pain point style: state the buyer-relevant product fact directly as a complete declarative sentence. Examples: The 1 Pack contains one thermal imaging scope. The listed thermal field of view is 25°, and the night vision field of view is 13°. Chinese examples: 1件装内含1个热成像红外夜视瞄准镜。标示的热成像视场为25°，夜视视场为13°。",
  "Do not begin English painPoints with How, What, Which, Who, Where, When, Why, Is, Are, Does, Do, Did, Can, Could, Would, Will, Has, Have, Should, Need, Looking for, Not sure, or Wondering. Chinese painPoints must not begin with 是否、什么、多少、哪个、哪些、如何、为何、为什么、有没有、能否、可否、是不是、需不需要、想知道、不确定 or equivalent interrogative wording.",
  "Selling point style: state the objective attribute in one smooth sentence. Lead with the product part, visible construction, quantity, specification, variant, or included item itself; never lead with the source, reference, record, listing, selection state, or evidence process.",
  "Fixed bullet bodies must state product facts directly after the required label. Write PRODUCT TYPE as the actual product identity, PACK DETAILS as the actual quantity or confirmed options, VISIBLE DETAILS as visible parts or appearance, SPECIFICATIONS as the actual supported values, and PACKAGE CONTENTS as the exact included items.",
  "Description style: open with the product identity and its objective configuration, then connect visible construction, supported specifications, confirmed variants, quantity, and package contents as natural product prose. Never describe the Listing record, saved record, reference source, or generation process.",
  "Image-only identifier rule: when a model, core, SKU, or variant identifier appears only as visible text or a reference annotation, use a qualified phrase such as Visible model markings include TRUE 256 CORE and TRUE 320 CORE. Treat it as not a confirmed SKU, selected variant, or available option unless structured product or SKU facts explicitly confirm that status.",
  "Search-language rule: backendSearchTerms and keywordBuckets remain keyword phrases, not explanatory sentences. Exclude internal evidence, record, selection-state, and generation terminology from every search phrase.",
  "Chinese counterparts must use the same natural buyer-facing voice, direct product wording, and factual qualifications as the matching English fields. Preserve the same structure, item order, facts, quantities, and units without translating internal workflow language into public copy.",
];
const PLATFORM_V1_TITLE_VALUE_GUIDELINES = [
  "Title value exception and requirement (title and zhDisplay.title only): after the platform-required quantity/order and core product keyword, include the strongest differentiating selling point explicitly supplied in Source JSON and the concise buyer pain point or purchase concern that it directly resolves.",
  "Title formula: platform-required quantity/order + core product keyword + supplied differentiating selling point + directly supported pain-point resolution + 2-4 distinct supported search or purchase-decision attributes when platform hard limits allow.",
  "Title completeness rule: after the required product identity and value phrase, append 2-4 of the strongest traceable attributes when enough supported facts and hard-limit space exist. Each appended attribute must answer a different search or purchase decision point.",
  "Choose appended attributes only from supplied visible construction, visible components, shape, color, variant, quantity, or package facts. Rank them by search relevance and buyer decision value; do not include dimensions or specifications in the title.",
  "Length priority: platform hard character and byte limits are absolute. The recommended title range is a soft readability target, not a hard cap. If no platform hard maximum exists, the title may exceed the recommended maximum to include useful supported attributes while remaining concise and within the universal field limit.",
  "Do not shorten or remove the supplied selling point or its supported pain-point resolution merely to stay under a soft recommended maximum. When a hard limit leaves room for fewer than two appended attributes, include as many high-priority attributes as fit and omit lower-priority attributes first.",
  "Do not repeat concepts, stack synonyms, or add generic filler to make the title longer. Use every product keyword, value phrase, and appended attribute once.",
  "Never invent a pain point, outcome, function, effect, or performance claim for the title. If no functional outcome is supplied, resolve only a pre-purchase concern supported by supplied quantity, option, variant, or package facts.",
  "Every other English and Chinese content field remains subject to the non-title attribute-only and functional-wording bans.",
  "Keep title and zhDisplay.title aligned in product identity, selling point, resolved concern, quantity, and other facts. Preserve the same appended facts in the same order in both titles.",
];

function platformV1TitleValueEvidenceInstruction(source = {}) {
  const evidence = Array.isArray(source.titleValueEvidence) ? source.titleValueEvidence : [];
  if (evidence.length === 0) {
    return "Mandatory title value evidence: no dedicated suite evidence was supplied. Use only explicit product inputs and reference facts; if they do not support a functional outcome, resolve only a supplied purchase concern without inventing a benefit.";
  }
  return [
    `Mandatory title value evidence (title and zhDisplay.title only):\n${JSON.stringify(evidence, null, 2)}`,
    "Because this evidence block is non-empty, an attribute-only title is invalid. Do not return a title that merely lists quantity, wheel count, construction, color, model, or variant options.",
    "Choose one supportedValue whose buyer outcome is directly backed by its evidenceFocus, explicit product inputs, or reference-image notes. Express the supplied feature and the buyer problem it resolves as one concise, natural title phrase.",
    "Never use objectionFocus as a title claim. Objections identify missing, disputed, or unverified information and are not product benefits.",
    "This block is planning evidence, not permission to copy generated-image marketing text or invent a performance claim.",
  ].join("\n");
}
const CHINESE_PRODUCT_KEYWORD_RULES = [
  {
    pattern: /(?:四轮)?折叠(?:手拉车|手推车|拖车|露营车)/u,
    term: "Folding Wagon Cart",
  },
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

function stringArraySchema({ minItems, maxItems } = {}) {
  return {
    type: "array",
    items: { type: "string" },
    ...(Number.isInteger(minItems) ? { minItems } : {}),
    ...(Number.isInteger(maxItems) ? { maxItems } : {}),
  };
}

function keywordBucketsJsonSchema() {
  return {
    type: "object",
    additionalProperties: false,
    required: ["exact", "longTail", "traffic", "descriptive"],
    properties: {
      exact: stringArraySchema(),
      longTail: stringArraySchema(),
      traffic: stringArraySchema(),
      descriptive: stringArraySchema(),
    },
  };
}

export function buildCreationListingJsonSchema(policy = getCreationListingPolicy("universal")) {
  const bilingualProperties = {
    title: { type: "string" },
    sellingPoints: stringArraySchema({ maxItems: 8 }),
    buyerObjections: stringArraySchema({ maxItems: 8 }),
    highlights: stringArraySchema({
      minItems: policy?.highlightRules?.hardMinItems,
      maxItems: policy?.highlightRules?.hardMaxItems,
    }),
    description: { type: "string" },
    searchTerms: stringArraySchema({
      minItems: policy?.searchRules?.hardMinItems,
      maxItems: policy?.searchRules?.hardMaxItems,
    }),
    keywordBuckets: keywordBucketsJsonSchema(),
    warnings: stringArraySchema(),
    missingInfo: stringArraySchema(),
  };
  const properties = {
    schemaVersion: { type: "string", enum: ["2"] },
    platformId: { type: "string" },
    platformLabel: { type: "string" },
    marketplace: { type: "string" },
    listingPolicyVersion: { type: "string" },
    language: { type: "string" },
    ...bilingualProperties,
    evidence: stringArraySchema(),
    status: { type: "string", enum: ["completed", "needs-review", "failed"] },
    zhDisplay: {
      type: "object",
      additionalProperties: false,
      required: CREATION_LISTING_BILINGUAL_CONTENT_FIELDS,
      properties: bilingualProperties,
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

function buildLegacyCreationListingJsonSchema() {
  const displayProperties = {
    title: { type: "string" },
    sellingPoints: stringArraySchema(),
    painPoints: stringArraySchema(),
    fiveBullets: stringArraySchema(),
    description: { type: "string" },
    backendSearchTerms: { type: "string" },
    keywordBuckets: keywordBucketsJsonSchema(),
    missingInfo: stringArraySchema(),
    warnings: stringArraySchema(),
  };
  const properties = {
    title: { type: "string" },
    sellingPoints: stringArraySchema({ maxItems: 8 }),
    painPoints: stringArraySchema({ maxItems: 8 }),
    fiveBullets: stringArraySchema({ minItems: 5, maxItems: 5 }),
    description: { type: "string" },
    backendSearchTerms: { type: "string" },
    keywordBuckets: keywordBucketsJsonSchema(),
    missingInfo: stringArraySchema(),
    warnings: stringArraySchema(),
    zhDisplay: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(displayProperties),
      properties: displayProperties,
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

// Retained for integrations that still send the historical V1 contract directly.
export const CREATION_LISTING_JSON_SCHEMA = buildLegacyCreationListingJsonSchema();

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
  const explicitQuantityText = cleanString(source.skuPackQuantityText ?? source.sku_pack_quantity_text);
  if (explicitQuantityText) {
    return explicitQuantityText;
  }
  const explicitOptions = uniquePositiveIntegerCounts(
    source.skuQuantityOptions ?? source.sku_quantity_options ?? [],
  );
  if (explicitOptions.length > 1) {
    return formatCreationListingPackQuantity(explicitOptions);
  }
  const subjectCounts = Array.isArray(source.skuSubjects)
    ? source.skuSubjects.map(skuSubjectListingQuantity).filter((count) => count > 1)
    : [];
  const subjectOptions = uniquePositiveIntegerCounts(subjectCounts);
  if (subjectOptions.length > 1) {
    return formatCreationListingPackQuantity(subjectOptions);
  }
  const count = (directCount > 1 ? directCount : 0) || firstCountOverOne(subjectOptions) || firstCountOverOne(explicitOptions) || 1;
  return formatCreationListingPackQuantity([count]);
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

function buildLegacyListingPrompt(source = {}, validationErrors = []) {
  return [
    "You are Listing SEO Agent, a dedicated Amazon US English listing writer and optimization agent for ecommerce products.",
    "Create exactly one parent listing draft for the whole saved creation set.",
    Array.isArray(source.skuSubjects) && source.skuSubjects.length > 0
      ? "Treat SKU subjects as variants/options within this single listing. Do not create separate listings per SKU."
      : "",
    selectedUnitModeInstruction(source),
    "Five-point listing quality constraints:",
    ...LISTING_SEO_AGENT_GUIDELINES,
    ...LISTING_FUNCTIONAL_WORDING_GUARDRAILS,
    `Every field and every bullet must be ${CREATION_LISTING_FIELD_MAX_CHARS} characters or fewer.`,
    `sellingPoints and painPoints must each be ${CREATION_LISTING_FIELD_MAX_CHARS} English characters or fewer in total, counting all list items combined.`,
    `Title formula: start with ${expectedQuantity(source)}, keeping quantity first. Immediately after quantity, write the core product keyword, then use differentiating modifier, core technology/material, use case, compatibility, and search terms.`,
    groupedSubjectPromptInstruction(source),
    "Do not include size, unit, dimension, weight, hook size, model specs, or measurement values anywhere in the title.",
    "After quantity, use core search terms, long-tail terms, traffic terms, and descriptive terms in a readable no-brand title sequence without keyword stuffing.",
    "Public listing fields must be English only: title, sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, and keywordBuckets.",
    "Return zhDisplay as a Chinese UI-only reference translation, including warnings and missingInfo; zhDisplay must not replace the English public listing fields.",
    'Do not use the phrase "Listing Draft" in public listing fields.',
    "Use a search-friendly structure around product type, objective attributes, package facts, and searchable terms.",
    "Five bullet structure: start every fiveBullets item with PRODUCT TYPE:, PACK DETAILS:, VISIBLE DETAILS:, SPECIFICATIONS:, or PACKAGE CONTENTS:.",
    "Do not write gift, warranty, refund, risk-free, money-back, free replacement, contact-us, compatibility, function, effect, benefit, or after-sales wording in fiveBullets.",
    "Use generated images only as visual evidence. Do not invent material, warranty, certification, compatibility, medical, safety, or performance claims.",
    source.evidenceMode === "input-only"
      ? "Generated images are unavailable. Use only product inputs and saved SKU metadata. Mark missing visual facts in missingInfo."
      : "Generated images or saved image metadata are available. Use them for visible selling points and pain points.",
    validationErrors.length ? `Fix these validation errors: ${validationErrors.join("; ")}` : "",
    `Source JSON:\n${JSON.stringify(source, null, 2)}`,
  ].filter(Boolean).join("\n\n");
}

function buildDirectOldStyleListingJsonSchema() {
  const contentProperties = {
    title: { type: "string" },
    sellingPoints: stringArraySchema({ maxItems: 8 }),
    painPoints: stringArraySchema({ maxItems: 8 }),
    fiveBullets: stringArraySchema({ minItems: 5, maxItems: 5 }),
    description: { type: "string" },
    backendSearchTerms: { type: "string" },
    keywordBuckets: keywordBucketsJsonSchema(),
  };
  const properties = {
    ...contentProperties,
    zhDisplay: {
      type: "object",
      additionalProperties: false,
      required: Object.keys(contentProperties),
      properties: contentProperties,
    },
  };
  return {
    type: "object",
    additionalProperties: false,
    required: Object.keys(properties),
    properties,
  };
}

function buildPlatformV1ListingPrompt(source = {}, policy = {}) {
  const forbiddenTerms = extractCreationListingForbiddenTerms(source);
  const platformLocale = cleanString(source.platformLocale || policy.locale || policy.language || policy.defaultLocale);
  return [
    "You are Listing SEO Agent. Create an English marketplace listing with a matching Simplified Chinese reference.",
    "Create exactly one complete Listing for the product set described in Source JSON.",
    Array.isArray(source.skuSubjects) && source.skuSubjects.length > 0
      ? "Treat SKU subjects as variants/options within this single listing. Do not create separate listings per SKU."
      : "",
    selectedUnitModeInstruction(source),
    `Resolved platform policy:\n${formatPolicyRulesForPrompt(policy)}`,
    `Use the resolved platform rules and ${platformLocale || "the platform default locale"} audience conventions, while keeping the top-level draft in English and zhDisplay in Simplified Chinese.`,
    "Use the unified old-style field structure for every platform: title, sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, keywordBuckets, and the same-shaped zhDisplay fields.",
    "Product no-brand rule: no content field may contain a brand, trademark, store, shop, seller, manufacturer, marketplace, or platform name.",
    `Forbidden terms and aliases extracted from the source: ${JSON.stringify(forbiddenTerms)}. Remove or neutrally rewrite every occurrence in both languages.`,
    "Five-point listing quality constraints:",
    ...PLATFORM_V1_LISTING_GUIDELINES,
    ...PLATFORM_V1_NON_TITLE_FUNCTIONAL_WORDING_GUARDRAILS,
    ...PLATFORM_V1_NON_TITLE_COMPLETENESS_GUIDELINES,
    ...PLATFORM_V1_BUYER_FACING_LANGUAGE_GUIDELINES,
    `Every field and every bullet must be ${CREATION_LISTING_FIELD_MAX_CHARS} characters or fewer.`,
    `sellingPoints and painPoints must each be ${CREATION_LISTING_FIELD_MAX_CHARS} English characters or fewer in total, counting all list items combined.`,
    `Include the supplied quantity ${expectedQuantity(source)} where it is useful, but follow the resolved platform title order and limits.`,
    groupedSubjectPromptInstruction(source),
    "Do not include size, unit, dimension, weight, hook size, model specs, or measurement values anywhere in the title.",
    "Use core search terms, long-tail terms, traffic terms, and descriptive terms in a readable no-brand title sequence without keyword stuffing.",
    ...PLATFORM_V1_TITLE_VALUE_GUIDELINES,
    platformV1TitleValueEvidenceInstruction(source),
    "Public listing fields must be English only: title, sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, and keywordBuckets.",
    "Return zhDisplay as a Chinese UI-only reference translation with exactly the same seven content fields; zhDisplay must not replace the English public listing fields.",
    'Do not use the phrase "Listing Draft" in public listing fields.',
    "Use a search-friendly structure around product type, objective attributes, package facts, and searchable terms.",
    "Five bullet structure: start every fiveBullets item with PRODUCT TYPE:, PACK DETAILS:, VISIBLE DETAILS:, SPECIFICATIONS:, or PACKAGE CONTENTS:.",
    "Do not write gift, warranty, refund, risk-free, money-back, free replacement, contact-us, compatibility, function, effect, benefit, or after-sales wording in fiveBullets.",
    "Use generated images only as visual evidence. Do not invent material, warranty, certification, compatibility, medical, safety, or performance claims.",
    source.evidenceMode === "input-only"
      ? "Generated images are unavailable. Use only product inputs and saved SKU metadata, and omit unsupported facts."
      : "Generated images or saved image metadata are available. Use them for visible selling points and pain points.",
    `Source JSON:\n${JSON.stringify(source, null, 2)}`,
  ].filter(Boolean).join("\n\n");
}

function hasExplicitListingTarget(source = {}) {
  return Boolean(cleanString(
    source.platformId
      || source.platformPolicyId
      || source.platform
      || source.marketplace
      || source.listingPolicy?.id
      || source.effectivePlan?.platformPolicyId
      || source.effectivePlan?.platform,
  ));
}

function resolveListingRequestSource(source = {}) {
  const legacyContract = source.forceV1 === true || (!hasExplicitListingTarget(source)
    && !cleanString(source.schemaVersion)
    && source.forceV2 !== true);
  const policy = source.listingPolicy && typeof source.listingPolicy === "object"
    ? source.listingPolicy
    : resolveCreationListingPolicy({
      ...source,
      platformPolicyId: source.platformPolicyId || source.platformId || (legacyContract ? "amazon" : ""),
      platform: source.platform || source.marketplace,
    });
  return {
    source: {
      ...source,
      ...(legacyContract
        ? {
          schemaVersion: "",
          forceV2: false,
          ...(source.forceV1 === true ? { forceV1: true } : {}),
        }
        : { schemaVersion: "2", forceV2: true }),
      platformId: policy.platformId || policy.id,
      platformLabel: policy.platformLabel || policy.label,
      marketplace: policy.marketplaceId,
      listingPolicyVersion: policy.listingPolicyVersion || policy.policyVersion,
      language: cleanString(source.language || policy.language || policy.locale || policy.defaultLocale),
      listingPolicy: policy,
      warnings: [...(Array.isArray(source.warnings) ? source.warnings : []), ...(Array.isArray(policy.warnings) ? policy.warnings : [])],
    },
    policy,
    legacyContract,
  };
}

function formatPolicyRulesForPrompt(policy = {}) {
  return JSON.stringify({
    platformId: policy.platformId || policy.id,
    platformLabel: policy.platformLabel || policy.label,
    marketplace: policy.marketplaceId,
    listingPolicyVersion: policy.listingPolicyVersion || policy.policyVersion,
    evidenceLevel: policy.evidenceLevel,
    locale: policy.locale || policy.language || policy.defaultLocale,
    titleRules: policy.titleRules,
    highlightRules: policy.highlightRules,
    descriptionRules: policy.descriptionRules,
    searchRules: policy.searchRules,
    conversionOrder: policy.conversionOrder,
    variantStrategy: policy.variantStrategy,
    publishFields: policy.publishFields,
    internalFields: policy.internalFields,
  }, null, 2);
}

function buildPlatformListingPrompt(source = {}, policy = {}, validationErrors = []) {
  const locale = cleanString(source.language || policy.locale || policy.defaultLocale) || "en-US";
  const platformId = cleanString(policy.platformId || policy.id) || "universal";
  const forbiddenTerms = extractCreationListingForbiddenTerms(source);
  const amazonGuidance = platformId === "amazon"
    ? [
      "Amazon-specific rules: keep the title within the sourced policy limit and write at least the sourced minimum number of factual bullet points.",
      "Use quantity, model, variant, or other non-brand identifying attributes only when supplied by Source JSON; do not force quantity to the first position.",
    ]
    : [];
  return [
    "You are Listing SEO Agent. Produce one reviewable marketplace draft for the whole saved Creation set.",
    "Cross-platform facts and safety baseline:",
    "Use only user product data, SKU/package/dimension inputs, reference-role notes, the saved effective plan, and traceable manifest metadata as factual claim evidence.",
    "Generated images may support directly observable appearance, quantity, and scene only. They cannot independently prove materials, certifications, medical or health effects, safety, compatibility, durability, performance, rankings, sales, reviews, prices, discounts, warranties, or refunds.",
    "Remove unsupported claims or record the missing evidence. Do not fabricate testimonials, engagement, endorsements, rankings, discounts, guarantees, or comparative superiority.",
    ...LISTING_FUNCTIONAL_WORDING_GUARDRAILS,
    "A completed status means only that the draft passed the current machine checks. It does not guarantee marketplace approval, legal compliance, ranking, sales, or conversion.",
    "Product no-brand rule (this product's own hard rule, not an official marketplace rule): no content field may contain any brand, trademark, store, shop, seller, manufacturer, marketplace, or platform name.",
    `Forbidden terms and aliases extracted from the source: ${JSON.stringify(forbiddenTerms)}. Remove or neutrally rewrite every occurrence in both languages.`,
    `Resolved platform policy:\n${formatPolicyRulesForPrompt(policy)}`,
    ...amazonGuidance,
    `Locale and units: use ${locale} for platform guidance and selected units. The top-level content fields must still be English, and zhDisplay must contain the matching Simplified Chinese field at the same array index. ${selectedUnitModeInstruction(source)}`,
    `Cross-category playbook order: ${(policy.conversionOrder || []).join(" > ")}; ignore any benefit or use-outcome step that conflicts with the attribute-only rule.`,
    "Cover product identity, objective attributes, size, variants, package contents, search intent, and missing-evidence disclosure where relevant. Do not describe functions, effects, solved problems, buyer outcomes, or category assumptions.",
    Array.isArray(source.skuSubjects) && source.skuSubjects.length > 0
      ? "Treat supplied SKU subjects as variants/options within this single parent listing; do not create separate listings."
      : "",
    groupedSubjectPromptInstruction(source),
    "Return only the V2 JSON object required by the supplied strict schema. Provide title, sellingPoints, buyerObjections, highlights, description, searchTerms, keywordBuckets, warnings, and missingInfo in English at the top level, plus the same fields in Simplified Chinese under zhDisplay. Corresponding arrays and keyword buckets must have the same item counts and preserve semantic order. Keep highlights, sellingPoints, and buyerObjections attribute-only; searchTerms and keywordBuckets must also omit functional or effect wording.",
    `Every individual string must stay within the universal ${CREATION_LISTING_FIELD_MAX_CHARS}-character safety ceiling; also follow the resolved policy's character, UTF-8 byte, count, and field-purpose rules.`,
    source.evidenceMode === "input-only"
      ? "Generated image evidence is unavailable. Use input facts only and put unverified details in missingInfo."
      : "Generated image metadata is available only for directly observable visual facts; keep all higher-risk claims gated by input evidence.",
    `Source JSON:\n${JSON.stringify(source, null, 2)}`,
    validationErrors.length ? `Retry validation errors to fix:\n${validationErrors.join("\n")}` : "",
  ].filter(Boolean).join("\n\n");
}

function buildValidationOptions(source = {}, policy, legacyContract = false) {
  return {
    expectedQuantity: expectedQuantity(source),
    forbidTitleSpecs: true,
    dimensionUnitMode: source.dimensionUnitMode,
    ...(legacyContract ? {} : { policy, sourceFacts: source, source }),
  };
}

function makeRequestBody({ responsesModel, reasoningEffort, source, policy, legacyContract, validationErrors }) {
  return {
    model: responsesModel || DEFAULT_RESPONSES_MODEL,
    reasoning: { effort: reasoningEffort || "medium" },
    input: legacyContract
      ? source.forceV1 === true
        ? buildPlatformV1ListingPrompt(source, policy)
        : buildLegacyListingPrompt(source, validationErrors)
      : buildPlatformListingPrompt(source, policy, validationErrors),
    text: {
      format: {
        type: "json_schema",
        name: "creation_listing_draft_json",
        strict: true,
        schema: legacyContract
          ? source.forceV1 === true
            ? buildDirectOldStyleListingJsonSchema()
            : CREATION_LISTING_JSON_SCHEMA
          : buildCreationListingJsonSchema(policy),
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

function normalizeAndValidateDraft(parsed, source, policy, legacyContract) {
  const frozenParsed = legacyContract
    ? parsed
    : {
      ...parsed,
      schemaVersion: "2",
      platformId: source.platformId,
      platformLabel: source.platformLabel,
      marketplace: source.marketplace,
      listingPolicyVersion: source.listingPolicyVersion,
      language: source.language,
    };
  const draft = normalizeCreationListingDraft(frozenParsed, source);
  const validation = validateCreationListingDraft(
    draft,
    buildValidationOptions(source, policy, legacyContract),
  );
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

function truncateListingText(value, maxChars = CREATION_LISTING_FIELD_MAX_CHARS) {
  return Array.from(cleanString(value)).slice(0, Math.max(1, Number(maxChars) || CREATION_LISTING_FIELD_MAX_CHARS)).join("").trim();
}

function normalizeCompletedLegacyDraft(value = {}, source = {}) {
  const forbiddenTerms = extractCreationListingForbiddenTerms(source);
  const sanitized = sanitizeCreationListingNoBrandContent({
    title: value.title,
    sellingPoints: value.sellingPoints,
    painPoints: value.painPoints,
    fiveBullets: value.fiveBullets,
    description: value.description,
    backendSearchTerms: value.backendSearchTerms,
    keywordBuckets: value.keywordBuckets,
    missingInfo: value.missingInfo,
    warnings: value.warnings,
    zhDisplay: value.zhDisplay,
  }, forbiddenTerms);
  const normalized = normalizeCreationListingDraft({
    ...value,
    ...sanitized,
    schemaVersion: "",
    status: "completed",
  }, {
    ...source,
    schemaVersion: "",
    forceV1: true,
    forceV2: false,
    language: "en-US",
  });
  const {
    schemaVersion,
    buyerObjections,
    highlights,
    searchTerms,
    evidence,
    missingInfo,
    warnings,
    publishFields,
    internalFields,
    fieldLabels,
    fieldPurposes,
    listingPolicyVersion,
    ...oldStyleDraft
  } = normalized;
  const normalizedZhDisplay = oldStyleDraft.zhDisplay || {};
  const {
    buyerObjections: zhBuyerObjections,
    highlights: zhHighlights,
    searchTerms: zhSearchTerms,
    evidence: zhEvidence,
    missingInfo: zhMissingInfo,
    warnings: zhWarnings,
    ...oldStyleZhDisplay
  } = normalizedZhDisplay;
  return {
    ...oldStyleDraft,
    zhDisplay: oldStyleZhDisplay,
  };
}

function isCompletedLegacyDraftStructurallyUsable(draft = {}) {
  const zhDisplay = draft.zhDisplay && typeof draft.zhDisplay === "object" ? draft.zhDisplay : {};
  const scalarPairs = [
    [draft.title, zhDisplay.title],
    [draft.description, zhDisplay.description],
    [draft.backendSearchTerms, zhDisplay.backendSearchTerms],
  ];
  if (!scalarPairs.every(([english, chinese]) => cleanString(english) && cleanString(chinese))) {
    return false;
  }
  const listPairs = [
    [draft.sellingPoints, zhDisplay.sellingPoints],
    [draft.painPoints, zhDisplay.painPoints],
    [draft.fiveBullets, zhDisplay.fiveBullets],
  ];
  if (!listPairs.every(([english, chinese]) => (
    Array.isArray(english)
    && english.length > 0
    && Array.isArray(chinese)
    && chinese.length === english.length
    && english.every((item) => cleanString(item))
    && chinese.every((item) => cleanString(item))
  ))) {
    return false;
  }
  const questionStartPattern = /^(?:how|what|which|who|where|when|why|is|are|does|do|did|can|could|would|will|has|have|should|need|looking\s+for|not\s+sure|wondering)\b/iu;
  const chineseQuestionStartPattern = /^(?:是否|什么|多少|哪个|哪些|如何|为何|为什么|有没有|能否|可否|是不是|需不需要|想知道|不确定)/u;
  const painPointsAreDeclarative = [draft.painPoints, zhDisplay.painPoints]
    .flat()
    .every((item) => {
      const text = cleanString(item);
      return text
        && !/[?？]/u.test(text)
        && !questionStartPattern.test(text)
        && !chineseQuestionStartPattern.test(text);
    });
  if (!painPointsAreDeclarative) {
    return false;
  }
  const bucketKeys = ["exact", "longTail", "traffic", "descriptive"];
  const englishBuckets = draft.keywordBuckets || {};
  const chineseBuckets = zhDisplay.keywordBuckets || {};
  return bucketKeys.every((key) => (
    Array.isArray(englishBuckets[key])
    && Array.isArray(chineseBuckets[key])
    && chineseBuckets[key].length === englishBuckets[key].length
  )) && bucketKeys.some((key) => englishBuckets[key].some((item) => cleanString(item)));
}

function legacyDraftContentOutsideTitles(draft = {}) {
  const { title: _title, zhDisplay, ...englishContent } = draft;
  const { title: _zhTitle, ...chineseContent } = zhDisplay && typeof zhDisplay === "object"
    ? zhDisplay
    : {};
  return {
    ...englishContent,
    zhDisplay: chineseContent,
  };
}

function truncateListingUtf8Bytes(value, maxBytes) {
  const limit = Number(maxBytes);
  if (!Number.isFinite(limit) || limit <= 0) return cleanString(value);
  let result = "";
  let bytes = 0;
  for (const character of cleanString(value)) {
    const characterBytes = new TextEncoder().encode(character).length;
    if (bytes + characterBytes > limit) break;
    result += character;
    bytes += characterBytes;
  }
  return result.trim();
}

function truncateListingByRules(value, rules = {}, suffix = "") {
  const maxChars = Number.isFinite(rules[`hardMaxChars${suffix}`])
    ? rules[`hardMaxChars${suffix}`]
    : CREATION_LISTING_FIELD_MAX_CHARS;
  return truncateListingUtf8Bytes(
    truncateListingText(value, maxChars),
    rules[`hardMaxUtf8Bytes${suffix}`],
  );
}

function deterministicListingLocaleCopy(locale, productName) {
  const language = cleanString(locale).toLowerCase();
  if (language.startsWith("zh")) {
    return {
      titleSuffix: "商品信息",
      productFact: `${productName} 的商品信息基于已提供资料生成。`,
      optionFact: "购买前请核对已选择的商品规格与选项。",
    };
  }
  if (language.startsWith("ja")) {
    return {
      titleSuffix: "商品情報",
      productFact: `${productName}の商品情報は提供された資料に基づいています。`,
      optionFact: "購入前に選択した仕様とオプションを確認してください。",
    };
  }
  if (language.startsWith("ko")) {
    return {
      titleSuffix: "상품 정보",
      productFact: `${productName} 상품 정보는 제공된 자료를 기반으로 작성되었습니다.`,
      optionFact: "구매 전에 선택한 규격과 옵션을 확인하세요.",
    };
  }
  if (language.startsWith("es")) {
    return {
      titleSuffix: "Informacion del producto",
      productFact: `La informacion de ${productName} se basa en los datos proporcionados.`,
      optionFact: "Comprueba la especificacion y la opcion seleccionadas antes de comprar.",
    };
  }
  return {
    titleSuffix: "Product Information",
    productFact: `${productName} information is based on the supplied product details.`,
    optionFact: "Check the selected product specification and option before purchase.",
  };
}

function makeDeterministicCompletedDraft(source = {}, policy = {}, validationErrors = []) {
  const forbiddenTerms = extractCreationListingForbiddenTerms(source);
  const rawProductName = sanitizeCreationListingNoBrandContent(
    source.productName || source.skuTitle || source.skuSubjects?.[0]?.title || "Product",
    forbiddenTerms,
  );
  const originalProductName = cleanString(source.productName || source.skuTitle || source.skuSubjects?.[0]?.title);
  const originalWords = originalProductName.split(/\s+/u).filter(Boolean);
  if (!cleanString(rawProductName) || (
    originalWords.length === 1
    && !CJK_TEXT_PATTERN.test(originalProductName)
    && !/^(?:product|item|goods)$/i.test(originalProductName)
  )) {
    throw new Error("Deterministic Listing generation could not determine a safe no-brand product identity.");
  }
  const inferredProductName = CJK_TEXT_PATTERN.test(rawProductName)
    ? inferEnglishProductKeyword({ ...source, productName: rawProductName, skuTitle: rawProductName })
    : rawProductName;
  const productName = truncateListingText(
    sanitizeEnglishListingTerm(
      sanitizeCreationListingNoBrandContent(inferredProductName, forbiddenTerms),
      "Product",
    ),
    120,
  );
  const usesGenericCjkIdentity = /^Product$/i.test(productName) && CJK_TEXT_PATTERN.test(rawProductName);
  if (!/[A-Za-z]{3}/.test(productName) || (
    /^Product$/i.test(productName)
    && !/^Product$/i.test(rawProductName)
    && !usesGenericCjkIdentity
  )) {
    throw new Error("Deterministic Listing generation could not determine a safe no-brand product identity.");
  }
  const locale = source.language || policy.language || policy.locale || policy.defaultLocale || "en-US";
  const localeCopy = deterministicListingLocaleCopy("en-US", productName);
  const titleRules = policy.titleRules || {};
  const titleMin = Number.isFinite(titleRules.hardMinChars) ? titleRules.hardMinChars : 0;
  let title = truncateListingByRules(`${productName} - ${localeCopy.titleSuffix}`, titleRules);
  if (Array.from(title).length < titleMin) {
    title = truncateListingByRules(`${title} ${localeCopy.productFact}`, titleRules);
  }

  const sourceFacts = [
    ...(Array.isArray(source.sellingPoints) ? source.sellingPoints : []),
    source.productDescription,
    source.dimensionSpecs || source.dimensions,
    ...((Array.isArray(source.skuSubjects) ? source.skuSubjects : []).flatMap((sku) => [sku?.title, sku?.note])),
  ].map((value) => sanitizeEnglishListingTerm(
    sanitizeCreationListingNoBrandContent(value, forbiddenTerms),
    "",
  )).map((value) => truncateListingText(value, 240))
    .filter((value) => value && !containsCreationListingFunctionalWording(value));
  const highlightRules = policy.highlightRules || {};
  const minimumHighlights = Math.max(1, Number(highlightRules.hardMinItems) || 0);
  const maximumHighlights = Math.max(minimumHighlights, Number(highlightRules.hardMaxItems) || 6);
  const highlightMin = Number.isFinite(highlightRules.hardMinCharsPerItem)
    ? highlightRules.hardMinCharsPerItem
    : 0;
  const highlightCandidates = [...sourceFacts, localeCopy.productFact, localeCopy.optionFact];
  const highlights = [];
  for (const candidate of highlightCandidates) {
    const item = truncateListingByRules(candidate, highlightRules, "PerItem");
    if (!item || Array.from(item).length < highlightMin || highlights.includes(item)) continue;
    highlights.push(item);
    if (highlights.length >= maximumHighlights) break;
  }
  while (highlights.length < minimumHighlights) {
    highlights.push(truncateListingByRules(localeCopy.optionFact, highlightRules, "PerItem"));
  }

  const descriptionRules = policy.descriptionRules || {};
  const description = truncateListingByRules(
    [localeCopy.productFact, ...sourceFacts.slice(0, 2)].join(" "),
    descriptionRules,
  );
  const searchRules = policy.searchRules || {};
  const searchTermLimit = Math.max(1, Number(searchRules.hardMaxItems) || 6);
  const searchTerms = [productName, ...sourceFacts]
    .map((value) => truncateListingByRules(value, searchRules, "PerItem"))
    .filter((value, index, values) => value && values.indexOf(value) === index)
    .slice(0, searchTermLimit);
  const details = (Array.isArray(validationErrors) ? validationErrors : [])
    .map((value) => truncateField(sanitizeCreationListingNoBrandContent(value, forbiddenTerms)))
    .filter(Boolean);
  const sourceWarnings = (Array.isArray(source.warnings) ? source.warnings : [])
    .map((value) => truncateField(sanitizeCreationListingNoBrandContent(value, forbiddenTerms)))
    .filter(Boolean);
  const warnings = [
    ...sourceWarnings,
    "Upstream output did not pass validation; this completed draft was generated deterministically from supplied product inputs.",
    ...details,
  ];
  const zhHighlights = highlights.map((item) => `无品牌事实对照：${item}`);
  const zhSearchTerms = searchTerms.map((item) => `无品牌关键词对照：${item}`);
  const zhWarnings = warnings.map((item) => `提示对照：${item}`);
  const normalized = normalizeCreationListingDraft({
    schemaVersion: "2",
    platformId: source.platformId || policy.platformId || policy.id || "universal",
    platformLabel: source.platformLabel || policy.platformLabel || policy.label || "通用电商",
    marketplace: source.marketplace || policy.marketplaceId || "universal",
    listingPolicyVersion: source.listingPolicyVersion || policy.listingPolicyVersion || policy.policyVersion || "",
    language: locale,
    title,
    sellingPoints: highlights,
    buyerObjections: [],
    highlights,
    description,
    searchTerms,
    keywordBuckets: { exact: searchTerms.slice(0, 1), longTail: [], traffic: [], descriptive: [] },
    evidence: ["product-input"],
    missingInfo: [],
    warnings,
    zhDisplay: {
      title: `无品牌标题对照：${title}`,
      sellingPoints: zhHighlights,
      buyerObjections: [],
      highlights: zhHighlights,
      description: `无品牌说明对照：${description}`,
      searchTerms: zhSearchTerms,
      keywordBuckets: {
        exact: zhSearchTerms.slice(0, 1),
        longTail: [],
        traffic: [],
        descriptive: [],
      },
      warnings: zhWarnings,
      missingInfo: [],
    },
    evidenceMode: "input-only",
    status: "completed",
  }, { ...source, forceV2: true, listingPolicy: policy });
  const validation = validateCreationListingDraft(normalized, buildValidationOptions(source, policy, false));
  if (!validation.ok) {
    throw new Error(`Deterministic Listing generation failed validation: ${validation.errors.join("; ")}`);
  }
  return validation.draft;
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

function buildAttributeOnlyLegacyFallbackCopyProfile(skuName = "Product", {
  quantitySize = "",
  variants = [],
  groupedSubjectDetail = "",
} = {}) {
  const product = normalizeListingTitle(skuName, "Product");
  const variantText = formatVariantText(variants);
  const packText = cleanString(quantitySize) || "Supplied pack quantity";
  const packageText = groupedSubjectDetail || variantText || "Package contents follow the supplied product information.";
  return {
    titleTail: variants.length > 1 ? `${variants.length} Variant Options` : "Product Details",
    sellingPoints: [
      `${product} with stated pack, size, and option details.`,
      "Color, shape, dimensions, variant, and package information follow the supplied product data.",
    ],
    painPoints: [
      "Review the stated pack quantity and selected option before purchase.",
      "Compare the stated dimensions, color, variant, and package contents with purchase requirements.",
    ],
    fiveBullets: [
      formatListingBullet("PRODUCT TYPE", product),
      formatListingBullet("PACK DETAILS", packText),
      formatListingBullet("VISIBLE DETAILS", "Color, shape, and variant names follow the supplied product information."),
      formatListingBullet("SPECIFICATIONS", "Review the stated dimensions and selected option."),
      formatListingBullet("PACKAGE CONTENTS", packageText),
    ],
    description: joinTruncated([product, packText, variantText, groupedSubjectDetail]),
    backendSearchTerms: joinTruncated([product, ...variants.slice(0, 4)]),
    keywordBuckets: {
      exact: [product],
      longTail: variants.slice(0, 2).map((variant) => `${product} ${variant}`),
      traffic: [],
      descriptive: [product],
    },
    zhDisplay: {
      title: `${quantitySize} ${product} 商品信息`,
      sellingPoints: [
        `${product} 的包装、尺寸和选项信息。`,
        "颜色、形状、尺寸、变体和包装信息来自已提供的商品资料。",
      ],
      painPoints: [
        "购买前核对包装数量和所选选项。",
        "将已注明的尺寸、颜色、变体和包装内容与购买要求进行比对。",
      ],
      fiveBullets: [
        `商品类型：${product}。`,
        `包装信息：${packText}。`,
        "外观信息：颜色、形状和变体名称来自已提供的商品资料。",
        "规格信息：购买前核对已注明的尺寸和所选选项。",
        `包装内容：${packageText}`,
      ],
      description: `${product}；${packText}；${variantText || "商品选项以已提供资料为准"}。`,
      backendSearchTerms: [product, ...variants.slice(0, 4)].join(" "),
      keywordBuckets: {
        exact: [product],
        longTail: variants.slice(0, 2).map((variant) => `${product} ${variant}`),
        traffic: [],
        descriptive: [product],
      },
    },
  };
}

export function makeMockCreationListingDraft(source = {}) {
  const policy = source.listingPolicy && typeof source.listingPolicy === "object"
    ? source.listingPolicy
    : resolveCreationListingPolicy({
      ...source,
      platformPolicyId: source.platformPolicyId || source.platformId,
      platform: source.platform || source.marketplace,
    });
  const platformId = cleanString(policy.platformId || policy.id) || "universal";
  if (source.forceV2 === true) {
    return makeDeterministicCompletedDraft({ ...source, platformId }, policy);
  }
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
  const profile = buildAttributeOnlyLegacyFallbackCopyProfile(skuName, { quantitySize, variants, groupedSubjectDetail });
  const title = buildQuantityFirstListingTitle(quantity, skuName, profile.titleTail, "");
  const missingInfo = source.evidenceMode === "input-only" ? ["Generated image evidence was unavailable."] : [];
  const sourceWarnings = (Array.isArray(source.warnings) ? source.warnings : []).map(cleanString).filter(Boolean);
  return normalizeCompletedLegacyDraft({
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
  endpointPath,
  apiKey,
  responsesModel,
  reasoningEffort = "medium",
  source,
  fetchImpl = fetch,
  mock = false,
  requestTimeoutMs = DEFAULT_CREATION_LISTING_REQUEST_TIMEOUT_MS,
}) {
  const requestContext = resolveListingRequestSource(source || {});
  const requestSource = requestContext.source;
  if (mock) {
    return makeMockCreationListingDraft(requestSource);
  }

  if (requestContext.legacyContract && requestSource.forceV1 === true) {
    const response = await fetchListingResponse(appendApiEndpointPath(baseUrl, endpointPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(makeRequestBody({
        responsesModel,
        reasoningEffort,
        source: requestSource,
        policy: requestContext.policy,
        legacyContract: true,
        validationErrors: [],
      })),
    }, {
      fetchImpl,
      timeoutMs: normalizeRequestTimeoutMs(requestTimeoutMs),
    });
    if (!response.ok) {
      return makeMockCreationListingDraft(requestSource);
    }
    try {
      const payload = await readResponsePayload(response);
      const draft = normalizeCompletedLegacyDraft(
        parseJsonText(extractResponseText(payload)),
        requestSource,
      );
      const highRiskClaimErrors = getCreationListingHighRiskClaimErrors(draft, requestSource);
      return isCompletedLegacyDraftStructurallyUsable(draft)
        && highRiskClaimErrors.length === 0
        && !containsCreationListingFunctionalWording(JSON.stringify(legacyDraftContentOutsideTitles(draft)))
        ? draft
        : makeMockCreationListingDraft(requestSource);
    } catch {
      return makeMockCreationListingDraft(requestSource);
    }
  }

  const timeoutMs = normalizeRequestTimeoutMs(requestTimeoutMs);
  let validationErrors = [];
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const response = await fetchListingResponse(appendApiEndpointPath(baseUrl, endpointPath), {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(makeRequestBody({
        responsesModel,
        reasoningEffort,
        source: requestSource,
        policy: requestContext.policy,
        legacyContract: requestContext.legacyContract,
        validationErrors,
      })),
    }, {
      fetchImpl,
      timeoutMs,
    });
    const payload = await readResponsePayload(response);
    if (!response.ok) {
      const upstreamMessage = upstreamErrorMessage(payload, response.status);
      // Keep Listing usable during transient gateway outages by falling back to
      // the same deterministic, input-only path used after invalid model output.
      if (response.status >= 500 || response.status === 429) {
        validationErrors = [upstreamMessage];
        break;
      }
      throw new Error(upstreamMessage);
    }

    try {
      const parsed = parseJsonText(extractResponseText(payload));
      let validation = normalizeAndValidateDraft(
        parsed,
        requestSource,
        requestContext.policy,
        requestContext.legacyContract,
      );
      if (!validation.ok && attempt === 1) {
        const repairedDraft = repairGroupedSubjectDescriptionQuantity(validation.draft, requestSource);
        if (repairedDraft !== validation.draft) {
          validation = normalizeAndValidateDraft(
            repairedDraft,
            requestSource,
            requestContext.policy,
            requestContext.legacyContract,
          );
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

  if (!requestContext.legacyContract) {
    return makeDeterministicCompletedDraft(requestSource, requestContext.policy, validationErrors);
  }
  throw new Error(listingValidationFailureMessage(validationErrors));
}

export async function generateCreationListingDrafts({ set, config = {}, fetchImpl = fetch, mock = false }) {
  const sources = buildCreationListingSources(set);
  const drafts = [];
  for (const source of sources) {
    drafts.push(await requestCreationListingDraft({
      baseUrl: config.baseUrl,
      endpointPath: config.endpointPath,
      apiKey: config.apiKey,
      responsesModel: config.responsesModel,
      reasoningEffort: config.reasoningEffort,
      requestTimeoutMs: config.requestTimeoutMs,
      source: {
        ...source,
        platformLocale: source.language,
        schemaVersion: "",
        forceV1: true,
        forceV2: false,
      },
      fetchImpl,
      mock,
    }));
  }
  return drafts;
}
