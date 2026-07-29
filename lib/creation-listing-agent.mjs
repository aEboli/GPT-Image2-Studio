import { appendApiEndpointPath } from "./image-route-config.mjs";
import { DEFAULT_RESPONSES_MODEL } from "./model-defaults.mjs";
import {
  CREATION_LISTING_BILINGUAL_CONTENT_FIELDS,
  CREATION_LISTING_FIELD_MAX_CHARS,
  buildCreationListingSources,
  containsCreationListingFunctionalWording,
  extractCreationListingForbiddenTerms,
  formatCreationListingPackQuantity,
  getCreationListingDimensionEvidence,
  getCreationListingDimensionFieldErrors,
  getCreationListingWeightEvidence,
  getCreationListingHighRiskClaimErrors,
  normalizeCreationListingDraft,
  sanitizeCreationListingBlockingClaims,
  sanitizeCreationListingBlockingClaimText,
  sanitizeCreationListingNoBrandContent,
  sanitizeCreationListingUnsupportedEvidenceTerms,
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
const DEFAULT_CREATION_LISTING_REQUEST_TIMEOUT_MS = 600000;
const SIZE_UNIT_PATTERN = "(?:fl\\.?\\s*oz|fluid\\s*ounces?|in|inch|inches|cm|mm|ft|oz|lb|lbs|g|kg|ml|l)";
const SIZE_VALUE_UNIT_PATTERN = `\\d+(?:\\.\\d+)?\\s*${SIZE_UNIT_PATTERN}`;
const LENGTH_UNIT_PATTERN = "(?:mm|cm|inches|inch|in|ft|m|毫米|厘米|英寸|英尺|米)";
const COMPONENT_DIMENSION_LABEL_PATTERN = /\b(main body|keeper|body|base|lid|handle|frame|stand|product|item|unit)\b|(插销主体|主体|扣件|底座|盖体|手柄|框架|支架|整机|机身|产品|商品)/giu;
const COMPONENT_DIMENSION_SIGNAL_PATTERN = /measure|dimension|size|long|wide|length|width|height|depth|diameter|[:：]|尺寸|长|宽|高|深|直径/iu;
const COMPONENT_DIMENSION_LABELS = new Map([
  ["main body", { english: "Main body", chinese: "主体" }],
  ["body", { english: "Body", chinese: "主体" }],
  ["插销主体", { english: "Main body", chinese: "主体" }],
  ["主体", { english: "Main body", chinese: "主体" }],
  ["keeper", { english: "Keeper", chinese: "扣件" }],
  ["扣件", { english: "Keeper", chinese: "扣件" }],
  ["base", { english: "Base", chinese: "底座" }],
  ["底座", { english: "Base", chinese: "底座" }],
  ["lid", { english: "Lid", chinese: "盖体" }],
  ["盖体", { english: "Lid", chinese: "盖体" }],
  ["handle", { english: "Handle", chinese: "手柄" }],
  ["手柄", { english: "Handle", chinese: "手柄" }],
  ["frame", { english: "Frame", chinese: "框架" }],
  ["框架", { english: "Frame", chinese: "框架" }],
  ["stand", { english: "Stand", chinese: "支架" }],
  ["支架", { english: "Stand", chinese: "支架" }],
  ["product", { english: "Product", chinese: "产品" }],
  ["item", { english: "Item", chinese: "产品" }],
  ["unit", { english: "Unit", chinese: "产品" }],
  ["产品", { english: "Product", chinese: "产品" }],
  ["商品", { english: "Product", chinese: "产品" }],
  ["整机", { english: "Product", chinese: "整机" }],
  ["机身", { english: "Body", chinese: "机身" }],
]);
const LISTING_TITLE_MAX_CHARS = 200;
const GENERIC_LISTING_IDENTITY_TOKENS = new Set([
  "SKU", "PRODUCT", "ITEM", "GOODS", "VARIANT", "SAMPLE", "UNNAMED", "UNKNOWN",
]);
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
  "3. Evidence-backed non-title rule: sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, keywordBuckets, and their Chinese counterparts may connect supplied product facts to direct, conservative buyer relevance under the evidence rules below.",
  "4. Declarative pain-point rule: painPoints must state a specific category friction and the supplied product response as a natural statement. Never use question-and-answer copy.",
  "5. Five bullets rule: write exactly five bullets. Each English bullet must start with a unique product-relevant 1-3 word uppercase lead label followed by a colon, then 1-2 natural sentences within the resolved platform per-item limit.",
];
const LISTING_DIMENSION_FIELD_GUIDELINES = [
  "Physical fields are required at the end of the structured Listing in this order: packageDimensions, productDimensions, packageWeight, productWeight, with the same four string fields under zhDisplay.",
  "For productDimensions, reproduce explicit product, item, body, assembled, length, width, height, depth, or diameter measurements from Source JSON exactly in meaning. Do not turn weight, capacity, hook size, model text, or image pixel resolution into a physical product dimension.",
  "For packageDimensions, use only dimensions explicitly identified as package, packaging, packed, shipping, carton, color-box, or outer-box measurements. You must not reuse product dimensions as package dimensions.",
  "When the corresponding source evidence is absent, provide a conservative numeric physical-size estimate. Start the English value exactly with Estimated: and the Simplified Chinese value exactly with 预估：. Never present an estimate as a measured or sourced fact.",
  "Every dimension value must contain at least one numeric physical length with an appropriate unit. Prefer length x width x height when the product form supports three axes; preserve component-specific sourced measurements when that is more truthful.",
  "Follow the selected dimension unit mode for sourced values and estimates. Keep each dimension field within 500 characters and preserve the same measurements and estimate status in both languages.",
  "For productWeight, reproduce only explicit product, item, body, assembled, net, or generic weight evidence. For packageWeight, reproduce only explicit package, packed, shipping, carton, outer-box, or gross weight evidence. Never copy one weight type into the other.",
  "When the corresponding weight evidence is absent, provide a conservative numeric estimate. Start the English weight value exactly with Estimated: and the Simplified Chinese value exactly with 预估：. Follow the selected metric, imperial, or both unit mode.",
];
const PLATFORM_V1_EVIDENCE_BACKED_VALUE_GUARDRAILS = [
  "Evidence-backed buyer value rule: use only facts explicitly present in Source JSON. A direct, conservative benefit is allowed only when its product feature is supplied and the feature-to-benefit relationship does not require an unstated technical result.",
  "Use this reasoning chain for buyer-facing value: supplied feature -> practical buyer relevance -> supplied proof. Keep the proof inside the sentence as a concrete feature, component, specification, quantity, visible detail, or included item rather than mentioning evidence or Source JSON.",
  "Generated images may prove only visible appearance, color, shape, quantity, included visible items, and visible use context. They do not prove material, compatibility, certification, medical or safety effects, durability, technical performance, rankings, reviews, sales, warranties, discounts, or sustainability.",
  "Pain-point chain: specific category friction -> supplied product response -> supplied proof. You may conservatively infer an ordinary, non-sensitive shopping or use friction from the exact product category as framing, but the product response and benefit must still be supported by Source JSON.",
  "Comparative boundary: you must not claim that other products cannot solve the problem, competitors fail, this product is better than competitors, or any comparative superiority unless Source JSON supplies exact comparative test evidence. Frame the issue as a buyer or use friction instead of a competitor fact.",
  "Never invent a function, effect, outcome, performance number, medical effect, compatibility, certification, review, ranking, sales result, warranty, discount, sustainability claim, package item, or technical mechanism. High-risk claims remain prohibited unless the existing exact-evidence rule explicitly permits them.",
  "If evidence supports only an attribute, state the attribute clearly without inventing a benefit. Omit unsupported value instead of padding the field with disclaimers, generic praise, or provenance commentary.",
  "Chinese fields must preserve the same supplied feature, buyer relevance, proof, qualifications, and comparative boundary as their English counterparts without adding or removing a claim.",
];
const PLATFORM_V1_VALUE_COMPLETENESS_GUIDELINES = [
  "Non-title value completeness rule: when Source JSON supports enough distinct buyer decisions and platform hard limits allow, write 4-5 sellingPoints and 3-4 painPoints. These recommendations are not quotas: return fewer items whenever the evidence cannot support distinct content.",
  "Each sellingPoints item must be a complete, specific statement using supplied feature -> practical buyer relevance -> supplied proof. It must answer why the product is useful and where that value matters; do not output a product introduction, isolated attribute label, generic adjective, or unsupported praise.",
  "PainPoints must use declarative statements only. Each item must be one concise, natural specific category friction -> supplied product response -> supplied proof statement. Use a real product-specific shopping or use friction, not a generic reminder to review the option, quantity, or package unless that is genuinely the strongest supported decision issue.",
  "Every painPoints item must state the friction and response directly. Never use a question mark (? or ？), a rhetorical question, a question followed by an answer, or an interrogative fragment. Do not use unknown, missing, or not specified as filler; omit the item when the source cannot support a response.",
  "Cross-field separation: assign each supported fact to its strongest decision role and use a different decision point in every item. Do not repeat the title or another field merely to make content longer, and do not paraphrase the same fact to reach an item count.",
  "Five-bullet Amazon-style decision map: bullet 1 states the primary value; bullet 2 explains a differentiating feature and supported benefit; bullet 3 covers use context or fit, with compatibility mentioned only when supplied; bullet 4 covers a supplied specification, material, construction, or care detail; bullet 5 clarifies variant, quantity, or package contents.",
  "Give every English bullet a different, unique product-relevant 1-3 word uppercase lead label followed by a colon. Choose the label from the actual feature or buyer decision, not a fixed template. Front-load the decision point, then connect the supplied feature to buyer relevance and concrete proof where applicable.",
  "Description completeness: when evidence and platform limits permit, use 2-4 short paragraphs in this order: product identity, intended context, and strongest supported value; evidence-backed features and relevant specifications; fit or variant guidance; quantity and package contents. Aim for 350-500 English characters total when evidence supports that range. Never exceed 500 characters or a stricter platform limit. Use natural connected prose rather than disconnected fragments.",
  "Search surface rule: backendSearchTerms must add directly relevant synonyms, alternate category names, supported use-intent phrases, and long-tail phrases not already used verbatim in visible fields. Follow the resolved platform search surface and item limits; output publishable phrases for visible tags and compact lowercase terms for hidden search fields unless the locale requires otherwise.",
  "Keyword bucket roles: exact contains core product and category phrases; longTail contains product plus supplied attribute, benefit, use intent, variant, quantity, or package phrases; traffic contains broader but still directly relevant category phrases; descriptive contains evidence-backed color, shape, material, construction, style, or use-context phrases.",
  "Deduplicate case-insensitively across backendSearchTerms and all four keyword buckets. Treat punctuation-only variants, mechanical singular/plural variants, reordered equivalents, and semantic synonyms as duplicates; retain the clearest phrase on its best search surface.",
  "Bilingual parity: zhDisplay must preserve the same array lengths, order, facts, quantities, and units as the English fields. Translate each corresponding meaning naturally without adding, removing, merging, or splitting claims, including every keyword bucket.",
  "Evidence-shortage and limit rule: platform hard limits and factual support override all recommended counts and lengths. Omit unsupported content, shorten lower-priority detail, or return fewer entries instead of duplicating, inferring, or inventing facts.",
];
const PLATFORM_V1_BUYER_FACING_LANGUAGE_GUIDELINES = [
  "Buyer-facing language rule: write every non-title field for a shopper reading a finished product page, not for an analyst, auditor, catalog operator, or content-generation system. Use natural, fluent sentences that name the product or component directly.",
  "Never expose internal record, evidence, or generation workflow in buyer-visible copy. Prohibited meta phrases include parent listing, parent product, saved creation set, supplied configuration, reference labels, the reference states, selected quantity, confirmed selection, this listing covers, Source JSON, evidence mode, and Chinese equivalents such as 父级商品、父体条目、已保存套图、已保存创作套组、已提供配置、参考标注、所选数量、已确认选择、此条目涵盖. Do not paraphrase these internal ideas.",
  "Pain point style: state the category friction and evidence-backed response directly as a complete declarative sentence. Example: Changing light conditions can make a single viewing mode limiting; the listed thermal and night-vision modes provide two supplied viewing options. Chinese example: 光线条件变化时，单一观察模式容易受到限制；资料中列出的热成像与夜视模式提供两种观察选择。",
  "Do not begin English painPoints with How, What, Which, Who, Where, When, Why, Is, Are, Does, Do, Did, Can, Could, Would, Will, Has, Have, Should, Need, Looking for, Not sure, or Wondering. Chinese painPoints must not begin with 是否、什么、多少、哪个、哪些、如何、为何、为什么、有没有、能否、可否、是不是、需不需要、想知道、不确定 or equivalent interrogative wording.",
  "Selling point style: lead with the supplied feature or product part, explain its practical buyer relevance, and close with the concrete detail that supports it. Never lead with the source, reference, record, listing, selection state, or evidence process.",
  "Bullet bodies must front-load one buyer decision point after a product-relevant label, then state the supported feature, buyer relevance, and concrete product detail in natural storefront language. Keep all five responsibilities distinct.",
  "Description style: open with the product identity, intended context, and strongest supported value, then connect supplied features, specifications, variants, quantity, and package contents as natural product prose. Never describe the Listing record, saved record, reference source, or generation process.",
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
  "Exact evidence-rich title minimum: when the resolved platform has no hard character or UTF-8 byte title limit below 120 and Source JSON supplies at least six distinct listingEvidenceAliases, the trimmed English title must contain at least 120 English characters. This is an acceptance requirement, not an approximate target.",
  "Keep the existing quantity, product identity, strongest selling point, and pain-point resolution at the front. Extend only with distinct supplied product details and one supplied use-context phrase that gives the shopper a concrete scene; never replace the earlier title core to reach 120 characters.",
  "Do not shorten or remove the supplied selling point or its supported pain-point resolution merely to stay under a soft recommended maximum. When a hard limit leaves room for fewer than two appended attributes, include as many high-priority attributes as fit and omit lower-priority attributes first.",
  "Do not repeat concepts, stack synonyms, or add generic filler to make the title longer. Use every product keyword, value phrase, and appended attribute once.",
  "Never invent a pain point, outcome, function, effect, or performance claim for the title. If no functional outcome is supplied, resolve only a pre-purchase concern supported by supplied quantity, option, variant, or package facts.",
  "All non-title fields follow the separate evidence-backed buyer-value rules in English and Chinese and remain subject to factual, brand, comparative, and high-risk claim safeguards.",
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

function platformV1BuyerDecisionEvidenceInstruction(source = {}) {
  const evidence = Array.isArray(source.buyerDecisionEvidence) ? source.buyerDecisionEvidence : [];
  if (evidence.length === 0) {
    return "Buyer decision evidence: no dedicated suite evidence was supplied. Use explicit product inputs and reference facts first; infer only ordinary category friction as neutral framing and omit any unsupported product response.";
  }
  return [
    `Buyer decision evidence for sellingPoints, painPoints, fiveBullets, and description:\n${JSON.stringify(evidence, null, 2)}`,
    "Treat buyerFriction as a planning clue, not as proof that competitors fail or that the friction is universal. Publish it only as neutral category framing when it fits the exact product.",
    "Use supportedValue only when evidenceFocus, explicit product inputs, or reference notes support the same feature-to-value relationship. Never expose the evidence wording itself in public copy.",
  ].join("\n");
}
const CHINESE_PRODUCT_KEYWORD_RULES = [
  {
    pattern: /(?=.*热成像)(?=.*(?:红外)?夜视)(?=.*(?:瞄准镜|瞄具|瞄镜))/u,
    term: "Thermal Imaging Infrared Night Vision Scope",
  },
  {
    pattern: /(?=.*(?:摩托车|机车|骑行))(?=.*(?:护目镜|风镜))/u,
    term: "Vintage Motorcycle Riding Goggles",
  },
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
    packageDimensions: { type: "string" },
    productDimensions: { type: "string" },
    packageWeight: { type: "string" },
    productWeight: { type: "string" },
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
    packageDimensions: { type: "string" },
    productDimensions: { type: "string" },
    packageWeight: { type: "string" },
    productWeight: { type: "string" },
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
    packageDimensions: { type: "string" },
    productDimensions: { type: "string" },
    packageWeight: { type: "string" },
    productWeight: { type: "string" },
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

function isGenericListingIdentity(value) {
  const tokens = cleanString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .trim()
    .split(/\s+/u)
    .filter(Boolean);
  return tokens.length > 0 && tokens.every((token) => /^\d+$/u.test(token) || GENERIC_LISTING_IDENTITY_TOKENS.has(token));
}

function sourceTextValues(source = {}) {
  return [
    source.parentProductName,
    source.parent_product_name,
    source.setProductName,
    source.set_product_name,
    source.productName,
    source.skuTitle,
    source.productDescription,
    source.skuNote,
    ...(Array.isArray(source.listingEvidenceAliases) ? source.listingEvidenceAliases : []),
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
    if (term && !/^(?:product|sample product)$/i.test(term) && !isGenericListingIdentity(term)) {
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
  let suffix = normalizeListingTitle([titleTail, size].filter(Boolean).join(" "), "");
  const productLastWord = normalizedProduct.match(/([A-Za-z0-9]+)$/u)?.[1]?.toLowerCase();
  const suffixFirstWord = suffix.match(/^([A-Za-z0-9]+)/u)?.[1]?.toLowerCase();
  if (productLastWord && productLastWord === suffixFirstWord) {
    suffix = cleanString(suffix.replace(/^[A-Za-z0-9]+\s*/u, ""));
  }
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
    ...LISTING_DIMENSION_FIELD_GUIDELINES,
    `Every field and every bullet must be ${CREATION_LISTING_FIELD_MAX_CHARS} characters or fewer.`,
    `sellingPoints and painPoints must each be ${CREATION_LISTING_FIELD_MAX_CHARS} English characters or fewer in total, counting all list items combined.`,
    `Title formula: start with ${expectedQuantity(source)}, keeping quantity first. Immediately after quantity, write the core product keyword, then use differentiating modifier, core technology/material, use case, compatibility, and search terms.`,
    groupedSubjectPromptInstruction(source),
    "Do not include size, unit, dimension, weight, hook size, model specs, or measurement values anywhere in the title.",
    "After quantity, use core search terms, long-tail terms, traffic terms, and descriptive terms in a readable no-brand title sequence without keyword stuffing.",
    "Public listing fields must be English only: title, sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, keywordBuckets, packageDimensions, productDimensions, packageWeight, and productWeight.",
    "Return zhDisplay as a Chinese UI-only reference translation, including warnings and missingInfo plus packageDimensions, productDimensions, packageWeight, and productWeight; zhDisplay must not replace the English public listing fields.",
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
    packageDimensions: { type: "string" },
    productDimensions: { type: "string" },
    packageWeight: { type: "string" },
    productWeight: { type: "string" },
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
    "Use the unified old-style field structure for every platform: title, sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, keywordBuckets, packageDimensions, productDimensions, packageWeight, productWeight, and the same-shaped zhDisplay fields.",
    "Product no-brand rule: no content field may contain a brand, trademark, store, shop, seller, manufacturer, marketplace, or platform name.",
    `Forbidden terms and aliases extracted from the source: ${JSON.stringify(forbiddenTerms)}. Remove or neutrally rewrite every occurrence in both languages.`,
    "Five-point listing quality constraints:",
    ...PLATFORM_V1_LISTING_GUIDELINES,
    ...PLATFORM_V1_EVIDENCE_BACKED_VALUE_GUARDRAILS,
    ...PLATFORM_V1_VALUE_COMPLETENESS_GUIDELINES,
    ...PLATFORM_V1_BUYER_FACING_LANGUAGE_GUIDELINES,
    ...LISTING_DIMENSION_FIELD_GUIDELINES,
    `Every field and every bullet must be ${CREATION_LISTING_FIELD_MAX_CHARS} characters or fewer.`,
    `sellingPoints and painPoints must each be ${CREATION_LISTING_FIELD_MAX_CHARS} English characters or fewer in total, counting all list items combined.`,
    `Include the supplied quantity ${expectedQuantity(source)} where it is useful, but follow the resolved platform title order and limits.`,
    groupedSubjectPromptInstruction(source),
    "Do not include size, unit, dimension, weight, hook size, model specs, or measurement values anywhere in the title.",
    "Use core search terms, long-tail terms, traffic terms, and descriptive terms in a readable no-brand title sequence without keyword stuffing.",
    ...PLATFORM_V1_TITLE_VALUE_GUIDELINES,
    platformV1TitleValueEvidenceInstruction(source),
    platformV1BuyerDecisionEvidenceInstruction(source),
    "Public listing fields must be English only: title, sellingPoints, painPoints, fiveBullets, description, backendSearchTerms, keywordBuckets, packageDimensions, productDimensions, packageWeight, and productWeight.",
    "Return zhDisplay as a Chinese UI-only reference translation with exactly the same eleven content fields; zhDisplay must not replace the English public listing fields.",
    'Do not use the phrase "Listing Draft" in public listing fields.',
    "Use a search-friendly structure around product identity, evidence-backed buyer value, supplied attributes, use intent, package facts, and searchable terms.",
    "Five bullet structure: use five unique product-relevant uppercase English lead labels of 1-3 words followed by colons. Preserve the same five decision points and order in natural Chinese labels under zhDisplay.",
    "Do not write gift, warranty, refund, risk-free, money-back, free replacement, contact-us, unsupported compatibility, competitor-superiority, or after-sales wording in fiveBullets.",
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
    ...LISTING_DIMENSION_FIELD_GUIDELINES,
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
    "Return only the V2 JSON object required by the supplied strict schema. Provide title, sellingPoints, buyerObjections, highlights, description, searchTerms, keywordBuckets, packageDimensions, productDimensions, packageWeight, productWeight, warnings, and missingInfo in English at the top level, plus the same fields in Simplified Chinese under zhDisplay. Corresponding arrays and keyword buckets must have the same item counts and preserve semantic order. Keep highlights, sellingPoints, and buyerObjections attribute-only; searchTerms and keywordBuckets must also omit functional or effect wording.",
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
  const draft = applyCreationListingWeightFields(
    normalizeCreationListingDraft(frozenParsed, source),
    source,
  );
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

function listingValidationFailureMessage(validationErrors, attemptCount = 2) {
  const details = (Array.isArray(validationErrors) ? validationErrors : [])
    .map(truncateField)
    .filter(Boolean)
    .join("; ");
  const attempts = Math.max(1, Number(attemptCount) || 1);
  const attemptLabel = `${attempts} attempt${attempts === 1 ? "" : "s"}`;
  return details
    ? `Listing generation failed validation after ${attemptLabel}: ${details}`
    : `Listing generation failed validation after ${attemptLabel}.`;
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
    packageDimensions: value.packageDimensions,
    productDimensions: value.productDimensions,
    packageWeight: value.packageWeight,
    productWeight: value.productWeight,
    missingInfo: value.missingInfo,
    warnings: value.warnings,
    zhDisplay: value.zhDisplay,
  }, forbiddenTerms);
  const normalized = applyCreationListingWeightFields(normalizeCreationListingDraft({
    ...value,
    ...sanitized,
    schemaVersion: "",
    status: "completed",
  }, {
    ...source,
    schemaVersion: "",
    forceV1: true,
    forceV2: false,
    language: cleanString(source.language) || "en-US",
  }), source);
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

function isCompletedLegacyDraftStructurallyUsable(draft = {}, source = {}) {
  const zhDisplay = draft.zhDisplay && typeof draft.zhDisplay === "object" && !Array.isArray(draft.zhDisplay)
    ? draft.zhDisplay
    : null;
  if (!zhDisplay) {
    return false;
  }
  if (![draft.title, zhDisplay.title, draft.description, zhDisplay.description].every((value) => cleanString(value))) {
    return false;
  }
  if (typeof draft.backendSearchTerms !== "string" || typeof zhDisplay.backendSearchTerms !== "string") {
    return false;
  }
  if (getCreationListingDimensionFieldErrors(draft, source).length > 0) {
    return false;
  }
  const listPairs = [
    [draft.sellingPoints, zhDisplay.sellingPoints],
    [draft.painPoints, zhDisplay.painPoints],
    [draft.fiveBullets, zhDisplay.fiveBullets],
  ];
  if (!listPairs.every(([english, chinese]) => Array.isArray(english) && Array.isArray(chinese))) {
    return false;
  }
  const bucketKeys = ["exact", "longTail", "traffic", "descriptive"];
  const englishBuckets = draft.keywordBuckets && typeof draft.keywordBuckets === "object"
    ? draft.keywordBuckets
    : {};
  const chineseBuckets = zhDisplay.keywordBuckets && typeof zhDisplay.keywordBuckets === "object"
    ? zhDisplay.keywordBuckets
    : {};
  return bucketKeys.every((key) => (
    Array.isArray(englishBuckets[key])
    && Array.isArray(chineseBuckets[key])
  ));
}

function hasReadableListingText(value) {
  return /[\p{L}\p{N}]/u.test(cleanString(value));
}

function matchesRequiredListingLanguage(value, language) {
  const text = cleanString(value);
  if (!hasReadableListingText(text)) return false;
  return language === "zh" ? CJK_TEXT_PATTERN.test(text) : /[A-Za-z]/u.test(text) && !CJK_TEXT_PATTERN.test(text);
}

function collectLegacyListingRepairCandidates(value = {}, excludedField = "") {
  const buckets = value.keywordBuckets && typeof value.keywordBuckets === "object"
    ? value.keywordBuckets
    : {};
  return [
    ...(excludedField === "title" ? [] : [value.title]),
    ...(excludedField === "description" ? [] : [value.description]),
    ...(Array.isArray(value.sellingPoints) ? value.sellingPoints : []),
    ...(Array.isArray(value.painPoints) ? value.painPoints : []),
    ...(Array.isArray(value.fiveBullets) ? value.fiveBullets : []),
    value.backendSearchTerms,
    ...["exact", "longTail", "traffic", "descriptive"].flatMap((key) => (
      Array.isArray(buckets[key]) ? buckets[key] : []
    )),
  ].map(cleanString).filter(Boolean);
}

function findSanitizedSourceIdentity(source = {}, language = "en") {
  const forbiddenTerms = extractCreationListingForbiddenTerms(source);
  const candidates = [
    source.productName,
    source.skuTitle,
    ...(Array.isArray(source.skuSubjects) ? source.skuSubjects.map((sku) => sku?.title || sku?.id) : []),
  ];
  for (const candidate of candidates) {
    const sanitized = sanitizeCreationListingBlockingClaimText(
      sanitizeCreationListingNoBrandContent(candidate, forbiddenTerms),
      source,
    );
    if (matchesRequiredListingLanguage(sanitized, language)) return sanitized;
  }
  return "";
}

function repairCompletedLegacyDraftRequiredText(draft = {}, source = {}, originalDraft = {}) {
  const repairLanguageFields = (value, originalValue, language) => {
    const repaired = { ...value };
    for (const field of ["title", "description"]) {
      if (hasReadableListingText(repaired[field])) continue;
      if (!hasReadableListingText(originalValue?.[field])) continue;
      repaired[field] = collectLegacyListingRepairCandidates(repaired, field)
        .find((candidate) => matchesRequiredListingLanguage(candidate, language))
        || findSanitizedSourceIdentity(source, language)
        || (language === "zh" ? "商品" : "Product");
    }
    return repaired;
  };

  const repaired = repairLanguageFields(draft, originalDraft, "en");
  if (draft.zhDisplay && typeof draft.zhDisplay === "object" && !Array.isArray(draft.zhDisplay)) {
    repaired.zhDisplay = repairLanguageFields(draft.zhDisplay, originalDraft.zhDisplay, "zh");
  }
  return repaired;
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

function englishCreationListingDimensionEvidence(value) {
  return truncateListingText(toAsciiListingText(cleanString(value)
    .replace(/毫米/gu, " mm ")
    .replace(/厘米/gu, " cm ")
    .replace(/英寸/gu, " in ")
    .replace(/英尺/gu, " ft ")
    .replace(/米/gu, " m ")), CREATION_LISTING_FIELD_MAX_CHARS);
}

function normalizeCreationListingLengthUnit(value) {
  const unit = cleanString(value).toLowerCase();
  if (["inch", "inches", "英寸"].includes(unit)) return "in";
  if (["英尺"].includes(unit)) return "ft";
  if (["毫米"].includes(unit)) return "mm";
  if (["厘米"].includes(unit)) return "cm";
  if (["米"].includes(unit)) return "m";
  return unit;
}

function creationListingLengthTokens(value) {
  const pattern = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*(${LENGTH_UNIT_PATTERN})(?![a-z])`, "giu");
  const text = cleanString(value);
  const explicitTokens = [...text.matchAll(pattern)].map((match) => {
    const unit = normalizeCreationListingLengthUnit(match[2]);
    const number = Number(match[1]);
    return {
      index: match.index ?? 0,
      number: String(number),
      unit,
      key: `${String(number)}:${unit}`,
      system: ["mm", "cm", "m"].includes(unit) ? "metric" : "imperial",
    };
  }).filter((token) => Number.isFinite(Number(token.number)));
  const sharedPattern = new RegExp(
    "(\\d+(?:\\.\\d+)?)\\s*(?:x|×|by)\\s*(\\d+(?:\\.\\d+)?)(?:\\s*(?:x|×|by)\\s*(\\d+(?:\\.\\d+)?))?\\s*("
      + LENGTH_UNIT_PATTERN + ")(?![a-z])",
    "giu",
  );
  const sharedTokens = [];
  for (const match of text.matchAll(sharedPattern)) {
    const unit = normalizeCreationListingLengthUnit(match[4]);
    const system = ["mm", "cm", "m"].includes(unit) ? "metric" : "imperial";
    const axisCount = match[3] === undefined ? 2 : 3;
    const axisMatches = [...match[0].matchAll(/\d+(?:\.\d+)?/gu)].slice(0, axisCount);
    for (const axis of axisMatches) {
      const number = Number(axis[0]);
      if (!Number.isFinite(number)) continue;
      sharedTokens.push({
        index: (match.index ?? 0) + (axis.index ?? 0),
        number: String(number),
        unit,
        key: String(number) + ":" + unit,
        system,
      });
    }
  }
  const seen = new Set();
  return [...explicitTokens, ...sharedTokens]
    .sort((left, right) => left.index - right.index)
    .filter((token) => {
      const identity = token.index + ":" + token.key;
      if (seen.has(identity)) return false;
      seen.add(identity);
      return true;
    });
}

function creationListingDimensionSystemsForMode(source = {}) {
  const mode = cleanString(source.dimensionUnitMode).toLowerCase();
  if (mode === "metric") return new Set(["metric"]);
  if (mode === "imperial") return new Set(["imperial"]);
  return new Set(["metric", "imperial"]);
}

function formatCreationListingComponentAxis(tokens = [], separator) {
  if (tokens.length === 0) return "";
  const units = new Set(tokens.map((token) => token.unit));
  if (units.size === 1) {
    return `${tokens.map((token) => token.number).join(separator)} ${tokens[0].unit}`;
  }
  return tokens.map((token) => `${token.number} ${token.unit}`).join(separator);
}

function formatCreationListingComponentGroups(groups = [], language = "english") {
  const chinese = language === "chinese";
  const axisSeparator = chinese ? " × " : " x ";
  const groupSeparator = chinese ? "；" : "; ";
  return groups.map((group) => {
    const metric = formatCreationListingComponentAxis(
      group.tokens.filter((token) => token.system === "metric"),
      axisSeparator,
    );
    const imperial = formatCreationListingComponentAxis(
      group.tokens.filter((token) => token.system === "imperial"),
      axisSeparator,
    );
    const dimensions = metric && imperial
      ? chinese ? `${metric}（${imperial}）` : `${metric} (${imperial})`
      : metric || imperial;
    return `${group.labels[chinese ? "chinese" : "english"]}${chinese ? "：" : ": "}${dimensions}`;
  }).join(groupSeparator);
}

function creationListingDraftDimensionTextCandidates(draft = {}) {
  const zhDisplay = draft.zhDisplay && typeof draft.zhDisplay === "object" && !Array.isArray(draft.zhDisplay)
    ? draft.zhDisplay
    : {};
  const values = [
    ...(Array.isArray(draft.fiveBullets) ? draft.fiveBullets : []),
    draft.description,
    ...(Array.isArray(draft.sellingPoints) ? draft.sellingPoints : []),
    ...(Array.isArray(draft.painPoints) ? draft.painPoints : []),
    ...(Array.isArray(zhDisplay.fiveBullets) ? zhDisplay.fiveBullets : []),
    zhDisplay.description,
    ...(Array.isArray(zhDisplay.sellingPoints) ? zhDisplay.sellingPoints : []),
    ...(Array.isArray(zhDisplay.painPoints) ? zhDisplay.painPoints : []),
  ];
  return values.map(cleanString).filter(Boolean);
}

function extractCreationListingComponentDimensionGroups(value, evidenceKeys, allowedSystems) {
  const text = cleanString(value);
  const matches = [...text.matchAll(new RegExp(
    COMPONENT_DIMENSION_LABEL_PATTERN.source,
    COMPONENT_DIMENSION_LABEL_PATTERN.flags,
  ))];
  const groups = [];
  const usedLabels = new Set();
  for (let index = 0; index < matches.length; index += 1) {
    const match = matches[index];
    const labelKey = cleanString(match[1] || match[2]).toLowerCase();
    const labels = COMPONENT_DIMENSION_LABELS.get(labelKey);
    if (!labels || usedLabels.has(labels.english)) continue;
    const segmentEnd = Math.min(
      text.length,
      matches[index + 1]?.index ?? text.length,
      (match.index ?? 0) + 240,
    );
    const segment = text.slice((match.index ?? 0) + match[0].length, segmentEnd);
    const tokens = creationListingLengthTokens(segment);
    if (tokens.length === 0) continue;
    const prefix = cleanString(segment.slice(0, tokens[0].index));
    if (prefix.length > 48 || !COMPONENT_DIMENSION_SIGNAL_PATTERN.test(prefix)) continue;
    const visibleTokens = tokens
      .filter((token) => allowedSystems.has(token.system))
      .slice(0, 6);
    if (visibleTokens.length === 0 || !visibleTokens.every((token) => evidenceKeys.has(token.key))) continue;
    usedLabels.add(labels.english);
    groups.push({ labels, tokens: visibleTokens });
  }
  return groups;
}

function buildCompactHistoricalProductDimensionFields(draft = {}, source = {}) {
  const evidence = getCreationListingDimensionEvidence(source, "product");
  const evidenceKeys = new Set(creationListingLengthTokens(evidence).map((token) => token.key));
  if (evidenceKeys.size === 0) return null;
  const allowedSystems = creationListingDimensionSystemsForMode(source);
  let bestGroups = [];
  let bestScore = 0;
  for (const candidate of creationListingDraftDimensionTextCandidates(draft)) {
    const groups = extractCreationListingComponentDimensionGroups(candidate, evidenceKeys, allowedSystems);
    const score = groups.length * 100 + groups.reduce((total, group) => total + group.tokens.length, 0);
    if (score > bestScore) {
      bestGroups = groups;
      bestScore = score;
    }
  }
  if (bestGroups.length === 0) return null;
  return {
    english: truncateListingText(formatCreationListingComponentGroups(bestGroups, "english")),
    chinese: truncateListingText(formatCreationListingComponentGroups(bestGroups, "chinese")),
  };
}

function estimatedCreationListingDimensionValues(source = {}, kind = "product") {
  const mode = cleanString(source.dimensionUnitMode).toLowerCase() || "both";
  const packageKind = kind === "package";
  const metric = packageKind ? "20 x 15 x 8 cm" : "18 x 12 x 6 cm";
  const imperial = packageKind ? "7.9 x 5.9 x 3.1 in" : "7.1 x 4.7 x 2.4 in";
  if (mode === "metric") {
    return { english: metric, chinese: metric.replace(/cm\b/gu, "厘米") };
  }
  if (mode === "imperial") {
    return { english: imperial, chinese: imperial.replace(/in\b/gu, "英寸") };
  }
  return {
    english: `${metric} (${imperial})`,
    chinese: `${metric.replace(/cm\b/gu, "厘米")}（${imperial.replace(/in\b/gu, "英寸")}）`,
  };
}

function buildFallbackCreationListingDimensionFields(source = {}) {
  const build = (kind) => {
    const evidence = getCreationListingDimensionEvidence(source, kind);
    if (evidence) {
      const englishEvidence = englishCreationListingDimensionEvidence(evidence);
      return {
        english: englishEvidence || truncateListingText(evidence),
        chinese: truncateListingText(`${kind === "package" ? "包装尺寸" : "产品尺寸"}：${evidence}`),
      };
    }
    const estimated = estimatedCreationListingDimensionValues(source, kind);
    return {
      english: `Estimated: ${estimated.english}`,
      chinese: `预估：${estimated.chinese}`,
    };
  };
  const packageValue = build("package");
  const productValue = build("product");
  return {
    packageDimensions: packageValue.english,
    productDimensions: productValue.english,
    zhPackageDimensions: packageValue.chinese,
    zhProductDimensions: productValue.chinese,
  };
}

function englishCreationListingWeightEvidence(value) {
  return truncateListingText(toAsciiListingText(cleanString(value)
    .replace(/公斤|千克/gu, " kg ")
    .replace(/克/gu, " g ")
    .replace(/磅/gu, " lb ")
    .replace(/盎司/gu, " oz ")));
}

function chineseCreationListingWeightEvidence(value) {
  return truncateListingText(cleanString(value)
    .replace(/\bkg\b/giu, "千克")
    .replace(/\bg\b/giu, "克")
    .replace(/\blbs?\b/giu, "磅")
    .replace(/\boz\b/giu, "盎司")
    .replace(/\(/gu, "（")
    .replace(/\)/gu, "）")
    .replace(/\s+（/gu, "（")
    .replace(/）\s+/gu, "）"));
}

function estimatedCreationListingWeightValues(source = {}, kind = "product") {
  const mode = cleanString(source.dimensionUnitMode).toLowerCase() || "both";
  const packageKind = kind === "package";
  const metric = packageKind ? "350 g" : "250 g";
  const imperial = packageKind ? "12.35 oz" : "8.82 oz";
  if (mode === "metric") {
    return { english: metric, chinese: metric.replace(/g\b/gu, "克") };
  }
  if (mode === "imperial") {
    return { english: imperial, chinese: imperial.replace(/oz\b/gu, "盎司") };
  }
  return {
    english: `${metric} (${imperial})`,
    chinese: `${metric.replace(/g\b/gu, "克")}（${imperial.replace(/oz\b/gu, "盎司")}）`,
  };
}

function buildFallbackCreationListingWeightFields(source = {}) {
  const build = (kind) => {
    const evidence = getCreationListingWeightEvidence(source, kind);
    if (evidence) {
      const englishEvidence = englishCreationListingWeightEvidence(evidence);
      return {
        english: `Weight: ${englishEvidence || truncateListingText(evidence)}`,
        chinese: `重量：${chineseCreationListingWeightEvidence(evidence)}`,
      };
    }
    const estimated = estimatedCreationListingWeightValues(source, kind);
    return {
      english: `Estimated: ${estimated.english}`,
      chinese: `预估：${estimated.chinese}`,
    };
  };
  const packageValue = build("package");
  const productValue = build("product");
  return {
    packageWeight: packageValue.english,
    productWeight: productValue.english,
    zhPackageWeight: packageValue.chinese,
    zhProductWeight: productValue.chinese,
  };
}

function applyCreationListingWeightFields(draft = {}, source = {}) {
  const fallback = buildFallbackCreationListingWeightFields(source);
  const zhDisplay = draft.zhDisplay && typeof draft.zhDisplay === "object" && !Array.isArray(draft.zhDisplay)
    ? draft.zhDisplay
    : {};
  return {
    ...draft,
    packageWeight: fallback.packageWeight,
    productWeight: fallback.productWeight,
    zhDisplay: {
      ...zhDisplay,
      packageWeight: fallback.zhPackageWeight,
      productWeight: fallback.zhProductWeight,
    },
  };
}

export function hydrateCreationListingDimensionsForRead(set = {}) {
  if (!set || typeof set !== "object" || !Array.isArray(set.listingDrafts) || set.listingDrafts.length === 0) {
    return set;
  }

  const fallback = buildFallbackCreationListingDimensionFields(set);
  const weightFallback = buildFallbackCreationListingWeightFields(set);
  let changed = false;
  const listingDrafts = set.listingDrafts.map((draft) => {
    if (!draft || typeof draft !== "object" || cleanString(draft.status).toLowerCase() === "failed") {
      return draft;
    }
    const zhDisplay = draft.zhDisplay && typeof draft.zhDisplay === "object" && !Array.isArray(draft.zhDisplay)
      ? draft.zhDisplay
      : {};
    const conciseProduct = buildCompactHistoricalProductDimensionFields(draft, set);
    const packageDimensions = cleanString(draft.packageDimensions ?? draft.package_dimensions)
      || fallback.packageDimensions;
    const productDimensions = cleanString(draft.productDimensions ?? draft.product_dimensions)
      || conciseProduct?.english
      || fallback.productDimensions;
    const zhPackageDimensions = cleanString(zhDisplay.packageDimensions ?? zhDisplay.package_dimensions)
      || fallback.zhPackageDimensions;
    const zhProductDimensions = cleanString(zhDisplay.productDimensions ?? zhDisplay.product_dimensions)
      || conciseProduct?.chinese
      || fallback.zhProductDimensions;
    const packageWeight = cleanString(draft.packageWeight ?? draft.package_weight)
      || weightFallback.packageWeight;
    const productWeight = cleanString(draft.productWeight ?? draft.product_weight)
      || weightFallback.productWeight;
    const zhPackageWeight = cleanString(zhDisplay.packageWeight ?? zhDisplay.package_weight)
      || weightFallback.zhPackageWeight;
    const zhProductWeight = cleanString(zhDisplay.productWeight ?? zhDisplay.product_weight)
      || weightFallback.zhProductWeight;
    if (
      packageDimensions === draft.packageDimensions
      && productDimensions === draft.productDimensions
      && zhPackageDimensions === zhDisplay.packageDimensions
      && zhProductDimensions === zhDisplay.productDimensions
      && packageWeight === draft.packageWeight
      && productWeight === draft.productWeight
      && zhPackageWeight === zhDisplay.packageWeight
      && zhProductWeight === zhDisplay.productWeight
    ) {
      return draft;
    }
    changed = true;
    return {
      ...draft,
      packageDimensions,
      productDimensions,
      packageWeight,
      productWeight,
      zhDisplay: {
        ...zhDisplay,
        packageDimensions: zhPackageDimensions,
        productDimensions: zhProductDimensions,
        packageWeight: zhPackageWeight,
        productWeight: zhProductWeight,
      },
    };
  });

  return changed ? { ...set, listingDrafts } : set;
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
  const dimensionFields = buildFallbackCreationListingDimensionFields(source);
  const weightFields = buildFallbackCreationListingWeightFields(source);
  const normalized = applyCreationListingWeightFields(normalizeCreationListingDraft({
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
    packageDimensions: dimensionFields.packageDimensions,
    productDimensions: dimensionFields.productDimensions,
    packageWeight: weightFields.packageWeight,
    productWeight: weightFields.productWeight,
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
      packageDimensions: dimensionFields.zhPackageDimensions,
      productDimensions: dimensionFields.zhProductDimensions,
      packageWeight: weightFields.zhPackageWeight,
      productWeight: weightFields.zhProductWeight,
      warnings: zhWarnings,
      missingInfo: [],
    },
    evidenceMode: "input-only",
    status: "completed",
  }, { ...source, forceV2: true, listingPolicy: policy }), source);
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

function buildFallbackProductBulletLabel(product = "Product") {
  return cleanString(product)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(/\s+/u)
    .filter(Boolean)
    .slice(0, 3)
    .join(" ") || "PRODUCT OVERVIEW";
}

function ensureFallbackSentence(value) {
  const text = cleanString(value);
  if (!text) return "";
  return /[.!?]$/u.test(text) ? text : `${text}.`;
}

function lowercaseFallbackSentence(value) {
  const text = cleanString(value).replace(/[.!?]+$/u, "");
  return text ? text.slice(0, 1).toLocaleLowerCase() + text.slice(1) : "";
}

function normalizeFallbackProof(value) {
  return ensureFallbackSentence(cleanString(value)
    .replace(/^the\s+(?:supplied\s+)?product\s+information\s+(?:lists?|shows?|states?)\s+/i, "Product details list ")
    .replace(/^the\s+(?:supplied\s+)?scene\s+reference\s+shows?\s+/i, "The visible scene shows ")
    .replace(/^the\s+(?:supplied\s+)?reference\s+shows?\s+/i, "Visible details show "));
}

function buildFallbackDecisionLabel(value, fallback, usedLabels) {
  const stopWords = new Set([
    "A", "AN", "AND", "ARE", "AS", "AT", "BE", "BUYERS", "CAN", "FOR", "FROM", "IN", "IS",
    "LISTS", "OF", "ON", "OR", "PROVIDE", "PROVIDES", "SUPPLIED", "THE", "TO", "WITH",
  ]);
  const words = cleanString(value)
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, " ")
    .split(/\s+/u)
    .filter((word) => word && !stopWords.has(word));
  const base = words.slice(0, 3).join(" ") || fallback;
  let label = base;
  let suffix = 2;
  while (usedLabels.has(label)) {
    label = `${fallback} ${suffix}`;
    suffix += 1;
  }
  usedLabels.add(label);
  return label;
}

function buildFallbackBuyerDecisionProfile(source = {}) {
  const forbiddenTerms = extractCreationListingForbiddenTerms(source);
  const decisions = (Array.isArray(source.buyerDecisionEvidence) ? source.buyerDecisionEvidence : [])
    .map((entry) => ({
      buyerContext: cleanString(sanitizeCreationListingNoBrandContent(entry?.buyerContext, forbiddenTerms)),
      buyerFriction: cleanString(sanitizeCreationListingNoBrandContent(entry?.buyerFriction, forbiddenTerms)),
      supportedValue: cleanString(sanitizeCreationListingNoBrandContent(entry?.supportedValue, forbiddenTerms)),
      evidenceFocus: cleanString(sanitizeCreationListingNoBrandContent(entry?.evidenceFocus, forbiddenTerms)),
    }))
    .filter((entry) => entry.buyerFriction
      && entry.supportedValue
      && entry.evidenceFocus
      && !CJK_TEXT_PATTERN.test(Object.values(entry).join(" ")))
    .slice(0, 4);

  const sellingPoints = decisions.map((entry) => joinTruncated([
    ensureFallbackSentence(entry.supportedValue),
    normalizeFallbackProof(entry.evidenceFocus),
  ]));
  const painPoints = decisions.map((entry) => truncateField(
    `${cleanString(entry.buyerFriction).replace(/[.!?]+$/u, "")}; ${lowercaseFallbackSentence(entry.supportedValue)}.`,
  ));
  return { decisions, sellingPoints, painPoints };
}

function fallbackPackQuantity(value) {
  const text = cleanString(value);
  return text.match(/^\d+\s*Pack(?:\s*\/\s*\d+\s*Pack)*\b/iu)?.[0] || text || "1 Pack";
}

function inferExplicitFallbackProductIdentity(value, source = {}) {
  const text = cleanString(value);
  if (!text || isGenericListingIdentity(text)) return "";
  if (CJK_TEXT_PATTERN.test(text)) {
    const inferred = inferEnglishProductKeyword({ ...source, productName: text, skuTitle: text });
    return inferred && !isGenericListingIdentity(inferred) && !/^Product$/i.test(inferred) ? inferred : "";
  }
  const sanitized = sanitizeEnglishListingTerm(text, "");
  return sanitized && !isGenericListingIdentity(sanitized) && !/^Product$/i.test(sanitized)
    ? sanitized
    : "";
}

function resolveFallbackProductIdentity(skuName = "Product", source = {}) {
  const explicitCandidates = [
    source.parentProductName,
    source.parent_product_name,
    source.setProductName,
    source.set_product_name,
    source.productName,
    source.product_name,
  ];
  for (const candidate of explicitCandidates) {
    const identity = inferExplicitFallbackProductIdentity(candidate, source);
    if (identity) return normalizeListingTitle(identity, "Product");
  }

  const aliases = Array.isArray(source.listingEvidenceAliases) ? source.listingEvidenceAliases : [];
  const knownIdentityTerms = new Set(CHINESE_PRODUCT_KEYWORD_RULES.map(({ term }) => term));
  for (const alias of aliases) {
    const text = cleanString(alias);
    if (!knownIdentityTerms.has(text)) continue;
    const identity = inferExplicitFallbackProductIdentity(text, source);
    if (identity) return normalizeListingTitle(identity, "Product");
  }

  const inferred = inferEnglishProductKeyword(source);
  if (inferred && !isGenericListingIdentity(inferred) && !/^Product$/i.test(inferred)) {
    return normalizeListingTitle(inferred, "Product");
  }
  const fallback = sanitizeEnglishListingTerm(skuName, "Product");
  return normalizeListingTitle(fallback, "Product");
}

function buildLocalizedThermalScopeFallbackCopyProfile(product, quantitySize, source = {}) {
  const aliases = new Set((Array.isArray(source.listingEvidenceAliases) ? source.listingEvidenceAliases : [])
    .map((value) => cleanString(value).toLocaleLowerCase("und"))
    .filter(Boolean));
  const has = (value) => aliases.has(cleanString(value).toLocaleLowerCase("und"));
  const hasBlackAndWhiteNightVision = has("black-and-white night vision");
  const hasHdMode = has("HD mode");
  const hasReticleControls = has("reticle controls");
  const hasRequiredEvidence = /thermal imaging infrared night vision scope/i.test(product)
    && has("thermal imaging")
    && has("infrared night vision")
    && has("25° thermal field of view")
    && has("13° night-vision field of view")
    && has("11 thermal palettes")
    && has("60Hz refresh rate")
    && has("objective focus adjustment")
    && has("diopter adjustment")
    && has("thermal sensor")
    && has("infrared illuminator")
    && has("display")
    && has("silicone eyecup");
  if (!hasRequiredEvidence) return null;

  const packQuantity = fallbackPackQuantity(quantitySize);
  const chinesePack = packQuantity
    .replace(/(\d+)\s*Pack/giu, "$1件装")
    .replace(/\s*\/\s*/g, " / ") || "1件装";
  const buyerDecisionText = (Array.isArray(source.buyerDecisionEvidence) ? source.buyerDecisionEvidence : [])
    .flatMap((entry) => Object.values(entry && typeof entry === "object" ? entry : {}))
    .map(cleanString)
    .join(" ");
  const hasSearchDetailUse = /(?:search|搜索)/iu.test(buyerDecisionText)
    && /(?:detail|细节)/iu.test(buyerDecisionText);
  const nightVisionMode = hasBlackAndWhiteNightVision
    ? "black-and-white night vision"
    : "infrared night vision";
  const chineseNightVisionMode = hasBlackAndWhiteNightVision ? "黑白夜视" : "红外夜视";
  const viewingModeCount = hasHdMode ? 3 : 2;
  const viewingModeNames = hasHdMode
    ? `thermal imaging, ${nightVisionMode}, and HD`
    : `thermal imaging and ${nightVisionMode}`;
  const capitalizedViewingModeNames = viewingModeNames.replace(/^./u, (character) => character.toUpperCase());
  const chineseViewingModeNames = hasHdMode
    ? `热成像、${chineseNightVisionMode}和HD`
    : `热成像与${chineseNightVisionMode}`;
  const viewingModeCountText = countWord(viewingModeCount);
  const chineseViewingModeCountText = viewingModeCount === 3 ? "三种" : "两种";
  const primaryValue = hasSearchDetailUse
    ? "The 25° thermal view covers broad search, while the 13° night-vision view is listed for detail confirmation."
    : "The 25° thermal and 13° night-vision fields of view provide two distinct viewing angles on one scope.";
  const chinesePrimaryValue = hasSearchDetailUse
    ? "25°热成像视场覆盖广域搜索，13°夜视视场用于细节确认。"
    : "25°热成像视场与13°夜视视场在同一瞄准镜上提供两种不同的观察角度。";
  const fieldOfViewPainPoint = hasSearchDetailUse
    ? "Finding a target and confirming detail call for different views; the 25° thermal and 13° night-vision fields separate those tasks."
    : "Thermal and night-vision coverage is difficult to compare without separate field data; the scope lists 25° thermal and 13° night-vision fields of view.";
  const chineseFieldOfViewPainPoint = hasSearchDetailUse
    ? "目标搜索与细节确认需要不同视野；25°热成像视场和13°夜视视场分别对应这两项任务。"
    : "缺少独立视场数据时难以比较热成像与夜视范围；该瞄准镜分别标示25°热成像视场和13°夜视视场。";
  const bodyComponents = `objective focus controls, thermal sensor, infrared illuminator, display, silicone eyecup${hasReticleControls ? ", and reticle controls" : ""}`;
  const chineseBodyComponents = `物镜调焦控制、热成像传感器、红外照明器、显示屏、硅胶眼罩${hasReticleControls ? "和十字线调节" : ""}`;
  const descriptionComponents = `objective focus controls, thermal sensor, infrared illuminator, display, silicone eyecup${hasReticleControls ? ", and reticle controls" : ""}`;
  const chineseDescriptionComponents = `物镜调焦控制、热成像传感器、红外照明器、显示屏、硅胶眼罩${hasReticleControls ? "和十字线调节" : ""}`;
  const titleValue = hasSearchDetailUse
    ? "Wide Thermal Search and Night Detail Confirmation"
    : "Two Viewing Modes";
  const titleTail = `${titleValue} with Objective Focus, Diopter Adjustment, Infrared Illuminator and Silicone Eyecup`;
  const chineseTitleValue = hasSearchDetailUse ? "热成像广域搜索与夜视细节确认" : "两种观察模式";
  const chineseTitleTail = `${chineseTitleValue} 物镜调焦、视度调节、红外照明器和硅胶眼罩`;
  const sellingPoints = [
    primaryValue,
    `${capitalizedViewingModeNames} modes place ${viewingModeCountText} viewing choices on one scope.`,
    "Objective focus and diopter controls adjust the image and eyepiece separately.",
    "Eleven thermal palettes and a listed 60Hz refresh rate expand the available display settings.",
    `The body includes ${bodyComponents}.`,
  ];
  const painPoints = [
    fieldOfViewPainPoint,
    `Changing light can make one viewing mode limiting; ${viewingModeNames} modes provide ${viewingModeCountText} choices.`,
    "A clear image may require objective and eyepiece adjustment; focus and diopter controls address both settings.",
    "Display settings are hard to compare when values are unclear; the scope lists 11 palettes and a 60Hz refresh rate.",
  ];
  const fiveBullets = [
    `DUAL VIEW: ${primaryValue}`,
    `VIEWING MODES: ${capitalizedViewingModeNames} modes provide ${viewingModeCountText} viewing choices on one scope.`,
    "LIGHT CONDITIONS: Thermal imaging and infrared night vision provide two listed viewing options as light conditions change.",
    "IMAGE SETTINGS: Objective focus and diopter adjustment cover image and eyepiece tuning; 11 thermal palettes and a listed 60Hz refresh rate define the display options.",
    `PACK QUANTITY: The package quantity is ${packQuantity}.`,
  ];
  const descriptionOpening = hasSearchDetailUse
    ? "This thermal imaging infrared night vision scope combines a 25° thermal view for broad search with a 13° night-vision view for detail confirmation."
    : "This thermal imaging infrared night vision scope combines thermal imaging and infrared night vision, with listed fields of view of 25° and 13°.";
  const description = `${descriptionOpening} Listed modes are ${viewingModeNames}. Objective focus and diopter adjustment cover image and eyepiece tuning; 11 palettes and 60Hz describe display settings. The body includes ${descriptionComponents}. Package quantity: ${packQuantity}.`;
  return {
    titleTail,
    sellingPoints,
    painPoints,
    fiveBullets,
    description,
    backendSearchTerms: "thermal scope infrared night vision scope electronic optic dual view scope",
    keywordBuckets: {
      exact: ["thermal imaging infrared night vision scope"],
      longTail: ["thermal scope with night vision", "25 degree thermal 13 degree night vision scope"],
      traffic: ["electronic optic scope"],
      descriptive: ["objective focus diopter scope"],
    },
    zhDisplay: {
      title: `${chinesePack} 热成像红外夜视瞄准镜 ${chineseTitleTail}`,
      sellingPoints: [
        chinesePrimaryValue,
        `${chineseViewingModeNames}模式在同一瞄准镜上提供${chineseViewingModeCountText}观察选择。`,
        "物镜调焦与视度调节可分别调整图像和目镜。",
        "11种热成像色板与标示的60Hz刷新率扩展了显示设置选择。",
        `镜身包括${chineseBodyComponents}。`,
      ],
      painPoints: [
        chineseFieldOfViewPainPoint,
        `光线变化会限制单一观察模式；${chineseViewingModeNames}模式提供${chineseViewingModeCountText}选择。`,
        "清晰图像可能需要分别调整物镜和目镜；调焦与视度控制对应这两项设置。",
        "关键数值不清时难以比较显示设置；该瞄准镜标示11种色板和60Hz刷新率。",
      ],
      fiveBullets: [
        `双视场：${chinesePrimaryValue}`,
        `观察模式：${chineseViewingModeNames}模式在同一瞄准镜上提供${chineseViewingModeCountText}观察选择。`,
        "光线场景：热成像与红外夜视在光线变化时提供两种标示的观察选择。",
        "图像设置：物镜调焦与视度调节分别对应图像和目镜设置，11种热成像色板与标示的60Hz刷新率说明显示选项。",
        `包装数量：包装数量为${chinesePack}。`,
      ],
      description: `${hasSearchDetailUse
        ? "这款热成像红外夜视瞄准镜将25°热成像广域搜索与13°夜视细节确认结合在一起。"
        : "这款热成像红外夜视瞄准镜将热成像与红外夜视集中在同一镜身上，标示的视场分别为25°和13°。"} 标示的观察模式包括${chineseViewingModeNames}。\n\n物镜调焦与视度调节对应图像和目镜设置，11种色板与60Hz说明显示设置。镜身包括${chineseDescriptionComponents}。包装数量为${chinesePack}。`,
      backendSearchTerms: "热成像瞄准镜 红外夜视瞄准镜 电子光学 双视野瞄准镜",
      keywordBuckets: {
        exact: ["热成像红外夜视瞄准镜"],
        longTail: ["带夜视功能的热成像瞄准镜", "25度热成像13度夜视瞄准镜"],
        traffic: ["电子光学瞄准镜"],
        descriptive: ["物镜调焦视度调节瞄准镜"],
      },
    },
  };
}

function buildLocalizedMotorcycleGoggleFallbackCopyProfile(product, quantitySize, source = {}, variants = []) {
  const aliases = new Set((Array.isArray(source.listingEvidenceAliases) ? source.listingEvidenceAliases : [])
    .map((value) => cleanString(value).toLocaleLowerCase("und"))
    .filter(Boolean));
  const has = (value) => aliases.has(cleanString(value).toLocaleLowerCase("und"));
  const hasIdentity = /vintage motorcycle riding goggles/i.test(product) && has("vintage motorcycle riding goggles");
  const hasWideView = has("180° wide viewing window");
  const hasPcLens = has("PC lens construction");
  const hasVents = has("indirect vents");
  const hasAntiFog = has("anti-fog coating");
  const hasAdjustableHeadband = has("adjustable headband");
  const hasSoftFrame = has("soft frame");
  const hasNosePad = has("nose pad");
  const hasOutdoorOffRoadRiding = has("outdoor and off-road riding context");
  const supportedFeatureCount = [
    hasWideView,
    hasPcLens,
    hasVents,
    hasAntiFog,
    hasAdjustableHeadband,
    hasSoftFrame,
    hasNosePad,
  ].filter(Boolean).length;
  if (!hasIdentity || supportedFeatureCount < 2) return null;

  const packQuantity = fallbackPackQuantity(quantitySize);
  const chinesePack = packQuantity
    .replace(/(\d+)\s*Pack/giu, "$1件装")
    .replace(/\s*\/\s*/g, " / ") || "1件装";
  const usableVariants = variants.filter((value) => value && !isGenericListingIdentity(value));
  const variantCount = positiveIntegerCount(source.skuVariantCount || source.sku_variant_count)
    || usableVariants.length
    || (Array.isArray(source.skuSubjects) ? source.skuSubjects.length : 0);
  const variantText = variantCount > 0
    ? `${variantCount} selectable options organize the available frame-and-lens combinations for direct comparison.`
    : "";
  const chineseVariantText = variantCount > 0
    ? `商品提供${variantCount}个可选款式，镜框与镜片组合清楚分开，比较不同搭配时更直观。`
    : "";
  const lensDetails = hasPcLens
    ? "PC lens construction gives shoppers a specific lens-material detail to compare before choosing riding goggles."
    : "";
  const chineseLensDetails = hasPcLens
    ? "镜片明确标示为PC镜片，选购时可直接了解镜片材质。"
    : "";
  const ventilationDetails = hasVents || hasAntiFog
    ? `The lens construction includes${hasVents ? " indirect vents" : ""}${hasVents && hasAntiFog ? " and" : ""}${hasAntiFog ? " an anti-fog coating" : ""}.`
    : "";
  const chineseVentilationDetails = hasVents || hasAntiFog
    ? `镜片结构包括${hasVents ? "间接通风口" : ""}${hasVents && hasAntiFog ? "和" : ""}${hasAntiFog ? "防雾涂层" : ""}。`
    : "";
  const ventilationValueDetails = hasVents && hasAntiFog
    ? "Indirect vents address airflow around the lens, while the anti-fog coating addresses fog buildup."
    : hasVents
      ? "Indirect vents identify the stated airflow design around the lens."
      : hasAntiFog
        ? "The anti-fog coating addresses fog buildup on the lens."
        : "";
  const chineseVentilationValueDetails = hasVents && hasAntiFog
    ? "间接通风口配合防雾涂层，分别对应镜片周围通风与起雾这两项骑行关注点。"
    : hasVents
      ? "间接通风口明确了镜片周围的通风设计。"
      : hasAntiFog
        ? "防雾涂层对应镜片起雾这一骑行关注点。"
        : "";
  const fitDetails = hasAdjustableHeadband || hasSoftFrame || hasNosePad
    ? `The fit construction includes${hasAdjustableHeadband ? " an adjustable headband" : ""}${hasAdjustableHeadband && (hasSoftFrame || hasNosePad) ? "," : ""}${hasSoftFrame ? " a soft frame" : ""}${hasSoftFrame && hasNosePad ? "," : ""}${hasNosePad ? " and a nose pad" : ""}.`
    : "";
  const chineseFitFeatureNames = [
    hasAdjustableHeadband ? "可调节头带" : "",
    hasSoftFrame ? "柔软面框" : "",
    hasNosePad ? "鼻垫" : "",
  ].filter(Boolean);
  const chineseFitFeatureText = chineseFitFeatureNames.length > 1
    ? `${chineseFitFeatureNames.slice(0, -1).join("、")}和${chineseFitFeatureNames.at(-1)}`
    : chineseFitFeatureNames[0] || "镜框细节";
  const chineseFitDetails = chineseFitFeatureNames.length > 0
    ? `佩戴结构包括${chineseFitFeatureText}。`
    : "";
  const hasQuantityOptions = /\//u.test(packQuantity);
  const quantityDetails = hasQuantityOptions
    ? `Quantity choices are listed as ${packQuantity}.`
    : `${packQuantity} states the order quantity up front.`;
  const chineseQuantityDetails = hasQuantityOptions
    ? `数量选项明确列为${chinesePack}。`
    : `${chinesePack}直接说明下单数量。`;
  const fitFeatureNames = [
    hasAdjustableHeadband ? "an adjustable headband" : "",
    hasSoftFrame ? "a soft frame" : "",
    hasNosePad ? "a nose pad" : "",
  ].filter(Boolean);
  const fitFeatureText = fitFeatureNames.length > 1
    ? `${fitFeatureNames.slice(0, -1).join(", ")}, and ${fitFeatureNames.at(-1)}`
    : fitFeatureNames[0] || "the stated frame details";
  const fitFeatureTextCapitalized = fitFeatureText.replace(/^./u, (character) => character.toUpperCase());
  const fitFeatureVerb = fitFeatureNames.length > 1 ? "make" : "makes";
  const fitValueDetails = fitDetails
    ? `${fitFeatureTextCapitalized} ${fitFeatureVerb} the adjustment and face-contact details clear before purchase.`
    : "";
  const chineseFitValueDetails = chineseFitDetails
    ? `${chineseFitFeatureText}共同构成佩戴结构，调节与贴脸细节在选购时一目了然。`
    : "";

  const sellingPoints = [
    hasWideView
      ? "The 180° viewing window opens a broad front field across the riding scene."
      : "Vintage motorcycle riding goggles establish a clear riding-specific eyewear choice.",
    lensDetails,
    ventilationValueDetails,
    fitValueDetails,
    variantText || quantityDetails,
  ].filter(Boolean).slice(0, 5);

  const painPoints = [
    hasWideView
      ? "A narrow viewing window can restrict the front field; the 180° viewing window opens the view across the riding scene."
      : "Riding eyewear needs a clear motorcycle context; the product identity names motorcycle riding goggles.",
    ventilationDetails
      ? `Airflow around the lens and fog buildup are common riding concerns; ${ventilationDetails.replace(/^The/iu, "the")}`
      : "",
    fitDetails
      ? `Fit construction can be difficult to judge from appearance alone; ${fitFeatureText} ${fitFeatureVerb === "makes" ? "identifies" : "identify"} the relevant details.`
      : "",
    variantCount > 0
      ? `Multiple frame-and-lens combinations can be difficult to distinguish; ${variantCount} selectable options organize the available choices.`
      : `Multiple quantity choices can cause order confusion; the offer states ${packQuantity}.`,
  ].filter(Boolean).slice(0, 4);

  const identityEnglish = "Vintage motorcycle riding goggles establish a clear motorcycle-riding product context.";
  const identityChinese = "复古摩托车骑行护目镜明确了骑行场景定位。";
  const wideEnglish = "The 180° viewing window opens a broad front field across the riding scene.";
  const wideChinese = "180°大视窗打开骑行前方的宽阔观察范围。";
  const airflowEnglish = ventilationValueDetails;
  const airflowChinese = chineseVentilationValueDetails;
  const fitEnglish = fitValueDetails;
  const fitChinese = chineseFitValueDetails;
  const optionsEnglish = variantCount > 0
    ? `Choose among ${variantCount} frame-and-lens options; quantity choices are listed as ${packQuantity}.`
    : "";
  const optionsChinese = variantCount > 0
    ? `可从${variantCount}个镜框与镜片组合中选择，数量选项明确列为${chinesePack}。`
    : "";
  const bulletPlans = [];
  const usedBulletKeys = new Set();
  const addBulletPlan = (label, body, zhLabel, zhBody, key) => {
    if (!body || usedBulletKeys.has(key)) return false;
    usedBulletKeys.add(key);
    bulletPlans.push({ label, body, zhLabel, zhBody });
    return true;
  };

  // Assign the five buyer decisions in order, then fill only from other supplied facts.
  addBulletPlan(
    hasWideView ? "WIDE VIEW" : "RIDING CONTEXT",
    hasWideView ? wideEnglish : identityEnglish,
    hasWideView ? "宽视野" : "骑行场景",
    hasWideView ? wideChinese : identityChinese,
    hasWideView ? "wide" : "identity",
  );
  if (lensDetails) {
    addBulletPlan("PC LENS", lensDetails, "PC镜片", chineseLensDetails, "lens");
  } else if (airflowEnglish) {
    addBulletPlan("AIRFLOW & FOG", airflowEnglish, "通风防雾", airflowChinese, "airflow");
  } else if (fitEnglish) {
    addBulletPlan("ADJUSTABLE FIT", fitEnglish, "佩戴结构", fitChinese, "fit");
  } else if (optionsEnglish) {
    addBulletPlan("OPTIONS", optionsEnglish, "款式选项", optionsChinese, "options");
  }
  if (fitEnglish) {
    addBulletPlan("ADJUSTABLE FIT", fitEnglish, "佩戴结构", fitChinese, "fit");
  } else {
    addBulletPlan("RIDING CONTEXT", identityEnglish, "骑行场景", identityChinese, "identity");
  }
  if (airflowEnglish) {
    addBulletPlan("AIRFLOW & FOG", airflowEnglish, "通风防雾", airflowChinese, "airflow");
  } else if (lensDetails) {
    addBulletPlan("LENS DETAILS", "The lens construction is identified as PC.", "镜片细节", "镜片结构为PC镜片。", "lens-details");
  } else if (hasWideView) {
    addBulletPlan("VIEWING ANGLE", "The product specifies a 180° viewing window.", "视野规格", "商品标示180°大视窗。", "wide-details");
  } else {
    addBulletPlan("FRAME DETAILS", identityEnglish, "镜框细节", identityChinese, "identity-details");
  }
  if (optionsEnglish) {
    addBulletPlan("OPTIONS", optionsEnglish, "款式数量", optionsChinese, "options");
  } else {
    addBulletPlan("PACK OPTIONS", quantityDetails, "包装选项", chineseQuantityDetails, "quantity");
  }
  [
    ["QUANTITY", quantityDetails, "数量信息", chineseQuantityDetails, "quantity"],
    ["OPTIONS", optionsEnglish, "款式数量", optionsChinese, "options"],
    ["PRODUCT TYPE", identityEnglish, "商品类型", identityChinese, "identity-fallback"],
    ["VIEWING ANGLE", "The product specifies a 180° viewing window.", "视野规格", "商品标示180°大视窗。", "wide-details-fallback"],
    ["FRAME DETAILS", fitEnglish || identityEnglish, "镜框细节", fitChinese || identityChinese, "frame-fallback"],
  ].forEach(([label, body, zhLabel, zhBody, key]) => {
    if (bulletPlans.length < 5) addBulletPlan(label, body, zhLabel, zhBody, key);
  });
  const normalizedBullets = bulletPlans.slice(0, 5).map(({ label, body }) => `${label}: ${cleanString(body)}`);
  const normalizedChineseBullets = bulletPlans.slice(0, 5).map(({ zhLabel, zhBody }) => `${zhLabel}：${cleanString(zhBody)}`);

  const titleConstructionDetails = [
    hasVents ? "Indirect Vents" : "",
    hasAdjustableHeadband ? "Adjustable Headband" : "",
    hasSoftFrame ? "Soft Frame" : "",
    hasNosePad ? "Nose Pad" : "",
  ].filter(Boolean);
  const titleConstructionText = titleConstructionDetails.length > 1
    ? `${titleConstructionDetails.slice(0, -1).join(", ")} and ${titleConstructionDetails.at(-1)}`
    : titleConstructionDetails[0] || "";
  const titleAttributes = [
    hasWideView ? "180 Wide View" : "",
    hasAntiFog ? "Anti-Fog" : "",
    hasPcLens ? "PC Lens" : "",
    titleConstructionText ? `${hasVents ? "with " : ""}${titleConstructionText}` : "",
    hasOutdoorOffRoadRiding ? "for Outdoor and Off-Road Riding" : "",
  ].filter(Boolean);
  const titleTail = titleAttributes.join(" ") || "Riding Goggles";
  const description = [
    `Vintage motorcycle riding goggles with${hasWideView ? " a 180° viewing window that opens a broad front field" : " a motorcycle-riding design"}.`,
    lensDetails,
    ventilationDetails,
    fitDetails,
    variantText,
    quantityDetails,
  ].filter(Boolean).join(" ");

  return {
    titleTail,
    sellingPoints,
    painPoints,
    fiveBullets: normalizedBullets,
    description,
    backendSearchTerms: [
      "vintage motorcycle riding goggles",
      hasWideView ? "wide view motorcycle goggles" : "",
      hasAdjustableHeadband ? "adjustable headband riding goggles" : "",
      hasPcLens ? "pc lens motorcycle goggles" : "",
      hasAntiFog ? "anti fog riding goggles" : "",
      "motorcycle eyewear",
    ].filter(Boolean).join(" "),
    keywordBuckets: {
      exact: ["vintage motorcycle riding goggles"],
      longTail: [
        hasWideView ? "wide view motorcycle riding goggles" : "",
        hasAdjustableHeadband ? "adjustable headband riding goggles" : "",
      ].filter(Boolean),
      traffic: ["motorcycle goggles", "riding goggles"],
      descriptive: [
        hasPcLens ? "pc lens goggles" : "",
        hasAntiFog ? "anti fog riding goggles" : "",
      ].filter(Boolean),
    },
    zhDisplay: {
      title: `${chinesePack} 复古摩托车骑行护目镜 ${[
        hasWideView ? "180°大视窗" : "",
        hasAntiFog ? "防雾" : "",
        hasPcLens ? "PC镜片" : "",
        hasVents ? "间接通风口" : "",
        hasAdjustableHeadband ? "可调节头带" : "",
        hasSoftFrame ? "柔软面框" : "",
        hasNosePad ? "鼻垫" : "",
        hasOutdoorOffRoadRiding ? "户外与越野骑行场景" : "",
      ].filter(Boolean).join(" ") || "骑行款式"}`,
      sellingPoints: [
        hasWideView ? "180°大视窗打开骑行前方的宽阔观察范围。" : "复古摩托车骑行护目镜明确了骑行场景下的眼部装备类型。",
        chineseLensDetails,
        chineseVentilationValueDetails,
        chineseFitValueDetails,
        chineseVariantText || chineseQuantityDetails,
      ].filter(Boolean).slice(0, 5),
      painPoints: [
        hasWideView ? "较窄视窗会限制前方观察范围；180°大视窗打开骑行场景中的宽阔视野。" : "骑行护目镜需要清晰的摩托车场景定位；商品身份直接说明骑行护目镜类型。",
        chineseVentilationDetails ? `镜片周围通风与起雾是常见的骑行关注点；${chineseVentilationDetails}` : "",
        chineseFitDetails ? `仅看外观时，佩戴结构不容易判断；${chineseFitFeatureText}把相关细节明确列出。` : "",
        variantCount > 0 ? `多个镜框与镜片组合容易混淆；${variantCount}个可选款式把不同搭配清楚分开。` : `多种数量容易造成下单混淆；商品明确标示${chinesePack}。`,
      ].filter(Boolean).slice(0, 4),
      fiveBullets: normalizedChineseBullets,
      description: [
        `这款复古摩托车骑行护目镜采用${hasWideView ? "180°大视窗" : "骑行护目镜结构"}。`,
        chineseLensDetails,
        chineseVentilationValueDetails,
        chineseFitValueDetails,
        chineseVariantText,
        chineseQuantityDetails,
      ].filter(Boolean).join(""),
      backendSearchTerms: [
        "复古摩托车骑行护目镜",
        hasWideView ? "宽视野摩托车护目镜" : "",
        hasAdjustableHeadband ? "可调节头带骑行护目镜" : "",
        hasPcLens ? "PC镜片护目镜" : "",
        hasAntiFog ? "防雾骑行护目镜" : "",
        "摩托车骑行眼镜",
      ].filter(Boolean).join(" "),
      keywordBuckets: {
        exact: ["复古摩托车骑行护目镜"],
        longTail: [
          hasWideView ? "宽视野摩托车骑行护目镜" : "",
          hasAdjustableHeadband ? "可调节头带骑行护目镜" : "",
        ].filter(Boolean),
        traffic: ["摩托车护目镜", "骑行护目镜"],
        descriptive: [
          hasPcLens ? "PC镜片护目镜" : "",
          hasAntiFog ? "防雾骑行护目镜" : "",
        ].filter(Boolean),
      },
    },
  };
}

function buildChineseFallbackDecisionCopy(decision = {}) {
  const text = `${decision.buyerContext} ${decision.buyerFriction} ${decision.supportedValue} ${decision.evidenceFocus}`;
  if (/thermal\s+imaging/i.test(text) && /night[-\s]?vision/i.test(text)) {
    return {
      sellingPoint: "热成像与夜视模式提供两种观察选择，商品信息同时列出这两种模式。",
      painPoint: "光线条件变化时，单一观察模式会限制选择；热成像与夜视模式提供两种观察方式。",
    };
  }
  if (/fold/i.test(text) && /(?:storage\s+space|car\s+trunk)/i.test(text)) {
    return {
      sellingPoint: "可折叠结构便于放入汽车后备箱，折叠场景直接体现收纳价值。",
      painPoint: "大件物品会占用较多收纳空间；可折叠结构可放入汽车后备箱。",
    };
  }
  if (/flip[-\s]?lid/i.test(text) && /opening\s+covered/i.test(text)) {
    return {
      sellingPoint: "翻盖可在饮用间隔保持瓶口覆盖，翻盖结构直接对应这一使用需求。",
      painPoint: "饮用间隔中瓶口容易暴露；翻盖可保持饮用口覆盖。",
    };
  }
  return {
    sellingPoint: `${decision.supportedValue} ${decision.evidenceFocus}`,
    painPoint: `${decision.buyerFriction}；${decision.supportedValue}`,
  };
}

function buildEvidenceBoundLegacyFallbackCopyProfile(skuName = "Product", {
  quantitySize = "",
  variants = [],
  groupedSubjectDetail = "",
  source = {},
} = {}) {
  const product = resolveFallbackProductIdentity(skuName, source);
  const variantText = formatVariantText(variants);
  const packText = fallbackPackQuantity(quantitySize);
  const dimensionText = toAsciiListingText(source.dimensionSpecs || source.dimensions);
  const packageText = groupedSubjectDetail || `${packText} ${product}.`;
  const localizedThermalProfile = buildLocalizedThermalScopeFallbackCopyProfile(product, quantitySize, source);
  if (localizedThermalProfile) return localizedThermalProfile;
  const localizedMotorcycleGoggleProfile = buildLocalizedMotorcycleGoggleFallbackCopyProfile(
    product,
    quantitySize,
    source,
    variants,
  );
  if (localizedMotorcycleGoggleProfile) return localizedMotorcycleGoggleProfile;
  const productBulletLabel = buildFallbackProductBulletLabel(product);
  const buyerProfile = buildFallbackBuyerDecisionProfile(source);
  const usedLabels = new Set();
  const [primaryDecision, secondDecision, thirdDecision] = buyerProfile.decisions;
  const detailText = dimensionText
    || groupedSubjectDetail
    || ensureFallbackSentence(product);
  const sparseSellingPoints = [
    `${product} is listed with a package quantity of ${packText}.`,
    variantText,
    dimensionText ? `${product} has the stated specification: ${dimensionText}.` : "",
    groupedSubjectDetail,
  ].filter(Boolean).slice(0, 5);
  const sparsePainPoints = [
    `The package quantity is stated as ${packText}.`,
    variantText,
    dimensionText ? `The stated specification is ${dimensionText}.` : "",
  ].filter(Boolean).slice(0, 4);
  const fiveBullets = primaryDecision
    ? [
      formatListingBullet(
        buildFallbackDecisionLabel(primaryDecision.supportedValue, "PRIMARY VALUE", usedLabels),
        ensureFallbackSentence(primaryDecision.supportedValue),
      ),
      formatListingBullet(
        buildFallbackDecisionLabel(
          secondDecision?.supportedValue || primaryDecision.evidenceFocus,
          "FEATURE DETAILS",
          usedLabels,
        ),
        secondDecision
          ? ensureFallbackSentence(secondDecision.supportedValue)
          : normalizeFallbackProof(primaryDecision.evidenceFocus),
      ),
      formatListingBullet(
        buildFallbackDecisionLabel(
          thirdDecision?.buyerContext || primaryDecision.buyerContext,
          "USE CONTEXT",
          usedLabels,
        ),
        ensureFallbackSentence(thirdDecision?.buyerContext || primaryDecision.buyerContext),
      ),
      formatListingBullet(
        buildFallbackDecisionLabel(detailText, productBulletLabel, usedLabels),
        detailText,
      ),
      formatListingBullet(
        buildFallbackDecisionLabel("In the box", "IN THE BOX", usedLabels),
        packageText,
      ),
    ]
    : [
      formatListingBullet(buildFallbackDecisionLabel(product, productBulletLabel, usedLabels), product),
      formatListingBullet(buildFallbackDecisionLabel(packText, "PACK QUANTITY", usedLabels), `The package quantity is ${packText}.`),
      formatListingBullet(buildFallbackDecisionLabel(variantText || product, "PRODUCT FORMAT", usedLabels), variantText || product),
      formatListingBullet(buildFallbackDecisionLabel(detailText, "PRODUCT DETAILS", usedLabels), detailText),
      formatListingBullet(buildFallbackDecisionLabel("Package contents", "PACKAGE CONTENTS", usedLabels), packageText),
    ];
  const chineseDecisions = buyerProfile.decisions.map(buildChineseFallbackDecisionCopy);
  const chinesePackText = packText
    .replace(/(\d+)\s*Pack/giu, "$1件装")
    .replace(/\s*\/\s*/g, " / ");
  const chineseVariantText = variants.length > 0
    ? `${variants.length}个可选变体：${variants.slice(0, 4).join("、")}。`
    : "";
  const chinesePackageText = groupedSubjectDetail || `${chinesePackText} ${product}。`;
  const sparseChineseSellingPoints = [
    `${product} 的包装数量标示为${chinesePackText}。`,
    chineseVariantText,
    dimensionText ? `${product} 的标示尺寸为${dimensionText}。` : "",
    groupedSubjectDetail,
  ].filter(Boolean).slice(0, sparseSellingPoints.length);
  const sparseChinesePainPoints = [
    `包装数量标示为${chinesePackText}。`,
    chineseVariantText,
    dimensionText ? `标示尺寸为${dimensionText}。` : "",
  ].filter(Boolean).slice(0, sparsePainPoints.length);
  return {
    titleTail: variants.length > 1 ? `${variants.length} Variant Options` : "Product Details",
    sellingPoints: buyerProfile.sellingPoints.length > 0 ? buyerProfile.sellingPoints : sparseSellingPoints,
    painPoints: buyerProfile.painPoints.length > 0 ? buyerProfile.painPoints : sparsePainPoints,
    fiveBullets,
    description: joinTruncated([
      product,
      ...buyerProfile.sellingPoints.slice(0, 2),
      packText,
      variantText,
      dimensionText,
      groupedSubjectDetail,
    ]),
    backendSearchTerms: joinTruncated([product, ...variants.slice(0, 4)]),
    keywordBuckets: {
      exact: [product],
      longTail: variants.slice(0, 2).map((variant) => `${product} ${variant}`),
      traffic: [],
      descriptive: [product],
    },
    zhDisplay: {
      title: `${chinesePackText} ${product} 商品信息`,
      sellingPoints: chineseDecisions.length > 0
        ? chineseDecisions.map((entry) => entry.sellingPoint)
        : sparseChineseSellingPoints,
      painPoints: chineseDecisions.length > 0
        ? chineseDecisions.map((entry) => entry.painPoint)
        : sparseChinesePainPoints,
      fiveBullets: chineseDecisions.length > 0
        ? [
          `核心价值：${chineseDecisions[0].sellingPoint}`,
          `产品特征：${chineseDecisions[1]?.sellingPoint || chineseDecisions[0].sellingPoint}`,
          `使用场景：${chineseDecisions[2]?.painPoint || chineseDecisions[0].painPoint}`,
          `规格信息：${detailText}。`,
          `包装内容：${packageText}`,
        ]
        : [
          `商品名称：${product}。`,
          `包装数量：包装数量为${chinesePackText}。`,
          `商品类型：${chineseVariantText || `${product}。`}`,
          `商品详情：${detailText}`,
          `包装内容：${chinesePackageText}`,
        ],
      description: [
        product,
        ...chineseDecisions.slice(0, 2).map((entry) => entry.sellingPoint),
        `包装数量：${chinesePackText}`,
        chineseVariantText,
        dimensionText ? `标示尺寸：${dimensionText}` : "",
        groupedSubjectDetail,
      ].filter(Boolean).join("；") + "。",
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
  const productIdentity = resolveFallbackProductIdentity(skuName, source);
  const variants = Array.isArray(source.skuSubjects)
    ? source.skuSubjects
      .map((sku) => sanitizeEnglishListingTerm(sku.title, "") || sanitizeEnglishListingTerm(sku.id, ""))
      .filter((value) => value && !isGenericListingIdentity(value))
    : [];
  const quantitySize = [quantity, size].filter(Boolean).join(" ");
  const groupedSubjectDetail = groupedSubjectDescriptionLine(source);
  const profile = buildEvidenceBoundLegacyFallbackCopyProfile(skuName, {
    quantitySize,
    variants,
    groupedSubjectDetail,
    source,
  });
  const dimensionFields = buildFallbackCreationListingDimensionFields(source);
  const title = buildQuantityFirstListingTitle(quantity, productIdentity, profile.titleTail, "");
  const missingInfo = source.evidenceMode === "input-only" ? ["Generated image evidence was unavailable."] : [];
  const sourceWarnings = (Array.isArray(source.warnings) ? source.warnings : []).map(cleanString).filter(Boolean);
  return normalizeCompletedLegacyDraft({
    id: `listing-${sanitizeListingTerm(source.setId || "main", "main").toLowerCase().replace(/[^a-z0-9]+/g, "-")}`,
    skuSubjectId: source.skuSubjectId,
    skuTitle: productIdentity,
    evidenceMode: source.evidenceMode,
    status: "completed",
    title,
    sellingPoints: profile.sellingPoints.map(truncateField),
    painPoints: profile.painPoints.map(truncateField),
    fiveBullets: profile.fiveBullets.map(truncateField).slice(0, 5),
    description: truncateField(profile.description),
    backendSearchTerms: truncateField(profile.backendSearchTerms),
    keywordBuckets: profile.keywordBuckets,
    packageDimensions: dimensionFields.packageDimensions,
    productDimensions: dimensionFields.productDimensions,
    missingInfo,
    warnings: sourceWarnings,
    zhDisplay: {
      ...profile.zhDisplay,
      packageDimensions: dimensionFields.zhPackageDimensions,
      productDimensions: dimensionFields.zhProductDimensions,
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
    const payload = await readResponsePayload(response);
    if (!response.ok) {
      throw new Error(upstreamErrorMessage(payload, response.status));
    }

    const normalizedDraft = normalizeCompletedLegacyDraft(
      parseJsonText(extractResponseText(payload)),
      requestSource,
    );
    let draft = normalizedDraft;
    draft = sanitizeCreationListingUnsupportedEvidenceTerms(draft, requestSource);
    draft = sanitizeCreationListingBlockingClaims(draft, requestSource);
    draft = repairCompletedLegacyDraftRequiredText(draft, requestSource, normalizedDraft);
    draft = sanitizeCreationListingUnsupportedEvidenceTerms(draft, requestSource);
    draft = sanitizeCreationListingBlockingClaims(draft, requestSource);
    const dimensionFieldErrors = getCreationListingDimensionFieldErrors(draft, requestSource);
    const validationErrors = [
      ...(isCompletedLegacyDraftStructurallyUsable(draft, requestSource)
        ? []
        : ["response did not satisfy the required Platform V1 bilingual field structure"]),
      ...dimensionFieldErrors,
      ...getCreationListingHighRiskClaimErrors(draft, requestSource),
    ];
    if (validationErrors.length > 0) {
      throw new Error(listingValidationFailureMessage(validationErrors, 1));
    }
    return draft;
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
      throw new Error(upstreamErrorMessage(payload, response.status));
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
