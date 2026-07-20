import {
  formatCreationDimensionSpecsForMode,
  normalizeCreationDimensionUnitMode,
} from "./creation-planner.mjs";
import { isCreationSubjectReferenceRole } from "./creation-reference-roles.mjs";
import {
  getCreationListingPolicy,
  resolveCreationListingPolicy,
} from "./creation-listing-policies.mjs";
import {
  extractCreationListingForbiddenTermCandidates,
  extractCreationListingForbiddenTerms,
  getCreationListingPublishFieldErrors,
  sanitizeCreationListingDraftContent,
  sanitizeCreationListingNoBrandContent,
  validateCreationListingPersistedV2Content,
} from "./creation-listing-content-gate.mjs";

export {
  CREATION_LISTING_BILINGUAL_CONTENT_FIELDS,
  extractCreationListingForbiddenTermCandidates,
  extractCreationListingForbiddenTerms,
  findCreationListingForbiddenTermMatches,
  getCreationListingPublishFieldErrors,
  sanitizeCreationListingDraftContent,
  sanitizeCreationListingNoBrandContent,
  validateCreationListingPersistedV2Content,
} from "./creation-listing-content-gate.mjs";

export const CREATION_LISTING_FIELD_MAX_CHARS = 500;
export const CREATION_LISTING_MARKETPLACE = "amazon-us";
export const CREATION_LISTING_LANGUAGE = "en-US";
const CREATION_LISTING_SOURCE_DESCRIPTION_MAX_CHARS = 1600;
const COMPETITOR_BRAND_TERMS = new Set(["amazon", "walmart", "temu", "ebay", "etsy", "target"]);
const CJK_TEXT_PATTERN = /[\u3400-\u9fff]/u;
const NON_US_MARKET_PATTERNS = [
  /\bamazon\s+(?:uk|eu|ca|canada|australia|au|de|fr|jp|mx)\b/i,
  /\b(?:uk|eu|european|canadian|australian)\s+(?:market|marketplace)\b/i,
  /\b(?:gbp|vat)\b/i,
];
const LATIN_SIZE_UNIT_PATTERN = "fl\\.?\\s*oz|fluid\\s*ounces?|in|inch|inches|cm|mm|m|ft|oz|lb|lbs|g|kg|ml|l";
const CHINESE_SIZE_UNIT_PATTERN = "\\u6db2\\u91cf\\u76ce\\u53f8|\\u6beb\\u7c73|\\u5398\\u7c73|\\u82f1\\u5bf8|\\u82f1\\u5c3a|\\u5343\\u514b|\\u516c\\u65a4|\\u6beb\\u5347|\\u76ce\\u53f8|\\u7c73|\\u514b|\\u78c5|\\u5347";
const SIZE_VALUE_UNIT_PATTERN = new RegExp(`\\b\\d+(?:\\.\\d+)?\\s*(?:${LATIN_SIZE_UNIT_PATTERN})\\b`, "gi");
const DISPLAY_SIZE_VALUE_UNIT_PATTERN = new RegExp(
  `\\b\\d+(?:\\.\\d+)?\\s*(${LATIN_SIZE_UNIT_PATTERN})\\b|\\d+(?:\\.\\d+)?\\s*(${CHINESE_SIZE_UNIT_PATTERN})`,
  "giu",
);
const TITLE_SPEC_VALUE_PATTERN = new RegExp(
  `(?:\\b\\d+(?:\\.\\d+)?\\s*(?:${LATIN_SIZE_UNIT_PATTERN})\\b|\\bhook\\s*size\\s*#?\\s*\\d+\\s*#?\\b|\\b\\d+\\s*#\\s*hooks?\\b)`,
  "i",
);
const METRIC_SIZE_UNIT_PATTERN = /^(?:cm|mm|m|g|kg|ml|l|\u6beb\u7c73|\u5398\u7c73|\u7c73|\u514b|\u5343\u514b|\u516c\u65a4|\u6beb\u5347|\u5347)$/iu;
const IMPERIAL_SIZE_UNIT_PATTERN = /^(?:floz|fluidounce|fluidounces|in|inch|inches|ft|oz|lb|lbs|\u6db2\u91cf\u76ce\u53f8|\u82f1\u5bf8|\u82f1\u5c3a|\u76ce\u53f8|\u78c5)$/iu;
const UNIT_COUNT_WORDS = new Map([
  ["one", 1],
  ["two", 2],
  ["three", 3],
  ["four", 4],
  ["five", 5],
  ["six", 6],
  ["seven", 7],
  ["eight", 8],
  ["nine", 9],
  ["ten", 10],
]);
const CHINESE_UNIT_COUNT_WORDS = new Map([
  ["一", 1],
  ["二", 2],
  ["两", 2],
  ["三", 3],
  ["四", 4],
  ["五", 5],
  ["六", 6],
  ["七", 7],
  ["八", 8],
  ["九", 9],
  ["十", 10],
]);
const CLAIM_RISK_RULES = [
  {
    id: "functional-wording",
    label: "functional or effect wording",
    support: "never",
    patterns: {
      en: [
        /\b(?:helps?|supports?|improves?|enhances?|boosts?|reduces?|relieves?|prevents?|protects?|promotes?|solves?|optimizes?|ensures?|enables?|allows?|delivers?)\b/iu,
        /\b(?:easy|easier|quick|quickly|convenient|effective|efficient|powerful|durable|waterproof|leakproof|non[-\s]?slip|antibacterial|odor[-\s]?resistant)\b/iu,
        /\b(?:designed|built|ideal|perfect|suitable)\s+(?:to|for)\b/iu,
        /\b(?:compatible\s+with|works?\s+with|runtime|battery\s+life)\b/iu,
        /\b(?:pain\s+relief|skin\s+brightening|whitening|anti[-\s]?aging|wrinkle\s+reduction|weight\s+loss|sleep\s+aid|hair\s+growth|acne\s+treatment|odor\s+removal)\b/iu,
      ],
      zh: [
        /(?:帮助|有助于|支持|改善|提升|增强|促进|减少|减轻|缓解|预防|防止|保护|解决|优化|确保|实现|带来)/u,
        /(?:功能|功效|效果|性能|作用|有效|高效|强效|便于|方便|快速|耐用|防水|防漏|防滑|抗菌|抑菌|除臭|杀菌|消炎|祛痘|美白|淡斑|抗皱|修复|塑形|减肥|增高|助眠|防脱|生发|兼容|适配|续航|运行时间)/u,
        /(?:适合|适用于|用于)[^，。；]{0,80}(?:使用|场景|人群|肌肤|收纳|护理|治疗)?/u,
      ],
    },
  },
  {
    id: "absolute-ranking",
    label: "absolute or ranking claim",
    support: "never",
    patterns: {
      en: [/\b(?:number\s+one|#\s*1|best(?:\s*seller)?|bestseller|top[-\s]?rated)\b|100\s*%\s*safe/iu],
      zh: [/(?:全网|行业|销量)?第[一1]|全网第一|最好|最佳|100\s*%\s*安全/u],
      ja: [/(?:業界)?(?:no\.?\s*1|ナンバーワン)|最高|100\s*%\s*安全/iu],
      ko: [/(?:업계\s*)?1위|최고|100\s*%\s*안전/iu],
      es: [/\bn[uú]mero\s*1\b|\bel\s+mejor\b|100\s*%\s*segur[oa]/iu],
    },
  },
  {
    id: "social-proof",
    label: "ranking or social proof claim",
    support: "never",
    patterns: {
      en: [/\b(?:five[-\s]?star|\d+(?:\.\d+)?[-\s]?star\s+reviews?)\b/iu],
      zh: [/(?:五星|满分)好评|销量冠军/u],
      ja: [/(?:星5|五つ星)レビュー|売上1位/u],
      ko: [/(?:별점\s*5|5점)\s*리뷰|판매\s*1위/u],
      es: [/(?:reseñas?\s+de\s+5\s+estrellas|m[aá]s\s+vendido)/iu],
    },
  },
  {
    id: "certification",
    label: "certification claim",
    support: "exact-evidence",
    patterns: {
      en: [/\b(?:(?:FDA|CE|UL|FCC|RoHS)\s+certified(?:\s+product)?|officially\s+certified)\b/iu],
      zh: [/(?:FDA|CE|UL|FCC|RoHS|权威|官方)\s*认证(?:产品|商品)?/iu],
      ja: [/(?:FDA|CE|UL|FCC|RoHS|権威ある|公式)\s*認証済み/iu],
      ko: [/(?:FDA|CE|UL|FCC|RoHS|권위|공식)\s*인증/iu],
      es: [/\b(?:certificaci[oó]n\s+oficial|(?:FDA|CE|UL|FCC|RoHS)\s+certificad[oa](?:\s+producto)?)\b/iu],
    },
  },
  {
    id: "medical-safety",
    label: "medical or safety claim",
    support: "exact-evidence",
    patterns: {
      en: [/\b(?:medical\s+grade|miracle\s+cure|cures?|treats?|guaranteed\s+safe|safe\s+for\s+every)\b/iu],
      zh: [/(?:医疗级|医用级|治愈|治疗效果|绝对安全)/u],
      ja: [/(?:医療グレード|治療|治癒|絶対安全)/u],
      ko: [/(?:의료용\s*등급|의료\s*등급|치료|절대\s*안전)/u],
      es: [/\b(?:grado\s+m[eé]dico|cura|trata|seguridad\s+garantizada)\b/iu],
    },
  },
  {
    id: "lifetime-warranty",
    label: "lifetime warranty claim",
    support: "exact-evidence",
    patterns: {
      en: [/\blifetime\s+warranty\b/iu],
      zh: [/(?:终身质保|终身保修)/u],
      ja: [/(?:永久保証|生涯保証)/u],
      ko: [/평생\s*보증/u],
      es: [/\bgarant[ií]a\s+de\s+por\s+vida\b/iu],
    },
  },
  {
    id: "material",
    label: "material claim",
    support: "exact-evidence",
    patterns: {
      en: [/\b(?:\d{3,4}\s+)?stainless\s+steel(?:\s+(?:body|construction|material))?\b/iu],
      zh: [/(?:\d{3,4}\s*)?不锈钢(?:材质|机身|主体)?/u],
      ja: [/(?:\d{3,4}\s*)?ステンレス(?:鋼)?(?:素材|本体)?/u],
      ko: [/(?:\d{3,4}\s*)?스테인리스(?:강)?(?:\s*소재|\s*본체)?/u],
      es: [/\b(?:acero\s+inoxidable|inoxidable)\s*(?:\d{3,4})?(?:\s+(?:cuerpo|material))?\b/iu],
    },
  },
  {
    id: "compatibility",
    label: "compatibility claim",
    support: "exact-evidence",
    patterns: {
      en: [/\bcompatible\s+with\s+[\p{L}\p{N}][\p{L}\p{N} .+/_-]{1,80}(?=[,.;]|$)/iu, /\b(?:works?\s+with\s+every|universal(?:ly)?\s+compatible)\b/iu],
      zh: [/(?:兼容|适配)[\p{L}\p{N} .+/_-]{2,80}(?=[，。；]|$)/u],
      ja: [/[\p{L}\p{N} .+/_-]{2,80}(?:に対応|と互換)(?=[、。；]|$)/u],
      ko: [/[\p{L}\p{N} .+/_-]{2,80}(?:와|과)?\s*호환(?=[,.;]|$)/u],
      es: [/\bcompatible\s+con\s+[\p{L}\p{N}][\p{L}\p{N} .+/_-]{1,80}(?=[,.;]|$)/iu],
    },
  },
  {
    id: "performance",
    label: "performance claim",
    support: "exact-evidence",
    patterns: {
      en: [/\b\d+(?:\.\d+)?[-\s]?(?:hour|hr)s?\s+(?:battery\s+)?runtime\b/iu],
      zh: [/\d+(?:\.\d+)?\s*小时(?:电池)?(?:续航|运行时间)/u],
      ja: [/\d+(?:\.\d+)?\s*時間(?:の)?(?:バッテリー)?(?:駆動|稼働)/u],
      ko: [/\d+(?:\.\d+)?\s*시간(?:\s*배터리)?\s*(?:사용|작동)/u],
      es: [/\b\d+(?:\.\d+)?\s*horas?\s+de\s+(?:duraci[oó]n|autonom[ií]a)\b/iu],
    },
  },
  {
    id: "guarantee-price-refund",
    label: "guarantee, price, discount, or refund claim",
    support: "exact-evidence",
    patterns: {
      en: [/\bguaranteed?\b/iu, /(?:[$¥£€]\s*\d|\b\d+(?:\.\d+)?%\s*(?:off|discount)|\bdiscount(?:ed)?\b)/iu, /\b(?:refund|money[-\s]?back|warranty)\b/iu],
      zh: [/(?:保证|退款|返现|折扣|质保|保修)/u],
      ja: [/(?:保証|返金|割引)/u],
      ko: [/(?:보장|환불|할인|보증)/u],
      es: [/\b(?:garantizado|reembolso|descuento|garant[ií]a)\b/iu],
    },
  },
];
const UNSUPPORTED_CLAIM_PATTERNS = CLAIM_RISK_RULES.flatMap((rule) =>
  Object.values(rule.patterns).flat().map((pattern) => ({ label: rule.label, pattern })),
);
const INTERNAL_LISTING_LANGUAGE_PATTERNS = [
  { label: "provided product attributes", pattern: /\bprovided product attributes\b/i },
  { label: "provided inputs", pattern: /\bprovided inputs?\b/i },
  { label: "searchable copy", pattern: /\bsearchable copy\b/i },
  { label: "shopper-ready language", pattern: /\bshopper-ready language\b/i },
  { label: "this draft", pattern: /\bthis draft\b/i },
  { label: "listing draft", pattern: /\blisting draft\b/i },
  { label: "listing copy", pattern: /\blisting copy\b/i },
  { label: "configured character limit", pattern: /\bconfigured (?:character )?limit\b/i },
  { label: "keyword structure", pattern: /\bkeyword structure\b/i },
  { label: "five-bullet layout", pattern: /\bfive-bullet layout\b/i },
  { label: "source json", pattern: /\bsource json\b/i },
  { label: "ui-only", pattern: /\bui-only\b/i },
  { label: "Chinese reference", pattern: /\bChinese reference\b/i },
];
const FIVE_BULLET_LEAD_PATTERN = /^[A-Z0-9][A-Z0-9/&%+,\-\s]{1,48}\s*[:\-–—]\s+\S/u;
const FIVE_BULLET_AFTERSALES_PATTERNS = [
  /\bperfect gift\b/i,
  /\bgift\b/i,
  /\bwarranty\b/i,
  /\bafter[-\s]?sales\b/i,
  /\bmoney[-\s]?back\b/i,
  /\brefund(?:s)?\b/i,
  /\brisk[-\s]?free\b/i,
  /\bsatisfaction guarantee\b/i,
  /\bfree replacement\b/i,
  /\bcustomer support\b/i,
];

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function normalizeSizeUnitToken(value) {
  return cleanString(value).toLowerCase().replace(/\./g, "").replace(/\s+/g, "");
}

function collectSizeUnitSystems(value = "") {
  const systems = new Set();
  for (const match of String(value ?? "").matchAll(DISPLAY_SIZE_VALUE_UNIT_PATTERN)) {
    const unit = normalizeSizeUnitToken(match[1] || match[2]);
    if (METRIC_SIZE_UNIT_PATTERN.test(unit)) {
      systems.add("metric");
    }
    if (IMPERIAL_SIZE_UNIT_PATTERN.test(unit)) {
      systems.add("imperial");
    }
  }
  return systems;
}

function formatListingDimensionTextForMode(value, mode) {
  const text = cleanString(value);
  if (!text || collectSizeUnitSystems(text).size === 0) {
    return text;
  }
  return cleanString(formatCreationDimensionSpecsForMode(text, mode)) || text;
}

function clampSubjectUnitCount(value) {
  const count = Number(value);
  return Number.isFinite(count) && count > 1 ? Math.min(20, Math.round(count)) : undefined;
}

function parseSubjectUnitCountToken(value) {
  const token = cleanString(value);
  const digitCount = Number.parseInt(token, 10);
  if (Number.isFinite(digitCount)) {
    return clampSubjectUnitCount(digitCount);
  }
  if (CHINESE_UNIT_COUNT_WORDS.has(token)) {
    return clampSubjectUnitCount(CHINESE_UNIT_COUNT_WORDS.get(token));
  }
  if (token.includes("十")) {
    const [left, right] = token.split("十");
    const tens = left ? CHINESE_UNIT_COUNT_WORDS.get(left) || 0 : 1;
    const ones = right ? CHINESE_UNIT_COUNT_WORDS.get(right) || 0 : 0;
    return clampSubjectUnitCount(tens * 10 + ones);
  }
  return undefined;
}

function inferSubjectUnitCount(value = "") {
  const text = cleanString(value).toLowerCase();
  if (!text) {
    return undefined;
  }
  const digitMatch = text.match(/\b(\d+)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (digitMatch) {
    return clampSubjectUnitCount(digitMatch[1]);
  }
  const wordMatch = text.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:complete\s+)?(?:visible\s+)?(?:product\s+)?(?:units?|bodies|colorways|lures?)\b/i);
  if (wordMatch) {
    return clampSubjectUnitCount(UNIT_COUNT_WORDS.get(wordMatch[1].toLowerCase()));
  }
  const chineseMatch = text.match(/([一二两三四五六七八九十]|\d{1,2})\s*(?:个|件|只|条|款|组|套)?\s*(?:完整|可见|完整可见|可售|不同|独立)?\s*(?:商品|产品|主体|单位|单元|色款|配色|款式|路亚|鱼饵|拟饵)/u);
  if (chineseMatch) {
    return parseSubjectUnitCountToken(chineseMatch[1]);
  }
  return undefined;
}

function skuSubjectUnitCount(sku = {}) {
  return clampSubjectUnitCount(
    sku.subjectUnitCount ??
      sku.subject_unit_count ??
      sku.visibleUnitCount ??
      sku.visible_unit_count ??
      sku.unitCount ??
      sku.unit_count,
  ) || inferSubjectUnitCount([sku.title, sku.note, sku.description].map(cleanString).filter(Boolean).join(" "));
}

function compactListingSourceDescription(value) {
  const text = cleanString(value);
  if (text.length <= CREATION_LISTING_SOURCE_DESCRIPTION_MAX_CHARS) {
    return text;
  }

  const suffix = " ... [truncated from a longer product description]";
  const budget = CREATION_LISTING_SOURCE_DESCRIPTION_MAX_CHARS - suffix.length;
  const facts = String(value ?? "")
    .split(/[\r\n]+|[;；。]+/u)
    .map(cleanString)
    .filter(Boolean);
  const selected = [];
  let length = 0;
  for (const fact of facts.length ? facts : [text]) {
    const nextLength = length + (selected.length ? 1 : 0) + fact.length;
    if (nextLength > budget) {
      break;
    }
    selected.push(fact);
    length = nextLength;
  }

  const compacted = selected.length > 0 ? selected.join(" ") : text.slice(0, budget);
  return `${compacted.slice(0, budget).trim()}${suffix}`;
}

function cleanArray(value) {
  if (Array.isArray(value)) {
    return value.map(cleanString).filter(Boolean);
  }
  return cleanString(value) ? [cleanString(value)] : [];
}

function uniqueCleanStrings(...values) {
  const seen = new Set();
  return values.flatMap(cleanArray).filter((item) => {
    const key = item.toLowerCase();
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function hasCompactValue(value) {
  if (Array.isArray(value)) {
    return value.length > 0;
  }
  if (value && typeof value === "object") {
    return Object.keys(value).length > 0;
  }
  return value !== undefined && value !== null && value !== "";
}

function compactRecord(record = {}) {
  return Object.fromEntries(
    Object.entries(record).filter(([, value]) => hasCompactValue(value)),
  );
}

function aliasValue(value, camelKey, snakeKey) {
  return value?.[camelKey] ?? value?.[snakeKey];
}

function listingDraftIdSlug(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
}

function makeDraftId(source = {}) {
  const forbiddenTerms = extractCreationListingForbiddenTerms(source);
  for (const candidate of [source.skuSubjectId, source.skuTitle, source.setId]) {
    const suffix = listingDraftIdSlug(
      sanitizeCreationListingNoBrandContent(candidate, forbiddenTerms),
    );
    if (suffix) return `listing-${suffix}`;
  }
  return "listing-main";
}

function normalizeV2DraftId(value, source = {}) {
  const id = cleanString(value);
  if (!id) return makeDraftId(source);
  const forbiddenTerms = extractCreationListingForbiddenTerms(source);
  const sanitized = sanitizeCreationListingNoBrandContent(id, forbiddenTerms);
  if (sanitized === id) return id;
  return listingDraftIdSlug(sanitized) || makeDraftId(source);
}

export function dedupeCreationListingKeywords(keywords = []) {
  const seen = new Set();
  const result = [];
  for (const keyword of cleanArray(keywords)) {
    const key = keyword.toLowerCase();
    if (COMPETITOR_BRAND_TERMS.has(key) || hasUnsupportedClaim(keyword) || seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(keyword);
  }
  return result;
}

function splitBackendTerms(value) {
  if (Array.isArray(value)) {
    return value;
  }
  return cleanString(value).split(/[,\n;]+/);
}

function cleanBackendSearchTerm(value) {
  const tokens = cleanString(value)
    .split(/\s+/)
    .filter((token) => !COMPETITOR_BRAND_TERMS.has(token.toLowerCase()));
  return tokens.join(" ");
}

function normalizeBackendSearchTerms(value) {
  return dedupeCreationListingKeywords(splitBackendTerms(value).map(cleanBackendSearchTerm)).join(" ");
}

function normalizeSearchTerms(value, legacyValue) {
  const source = value !== undefined && value !== null ? value : legacyValue;
  if (Array.isArray(source)) {
    return dedupeCreationListingKeywords(source);
  }
  const text = cleanString(source);
  return text ? [cleanBackendSearchTerm(text)].filter(Boolean) : [];
}

function normalizeKeywordBuckets(value = {}) {
  return {
    exact: dedupeCreationListingKeywords(value.exact),
    longTail: dedupeCreationListingKeywords(value.longTail ?? value.long_tail),
    traffic: dedupeCreationListingKeywords(value.traffic),
    descriptive: dedupeCreationListingKeywords(value.descriptive),
  };
}

function normalizeDisplayKeywordBuckets(value = {}) {
  return {
    exact: cleanArray(value.exact),
    longTail: cleanArray(value.longTail ?? value.long_tail),
    traffic: cleanArray(value.traffic),
    descriptive: cleanArray(value.descriptive),
  };
}

function normalizeCreationListingDisplay(value = {}) {
  if (!value || typeof value !== "object") {
    return null;
  }
  const buyerObjections = cleanArray(
    aliasValue(value, "buyerObjections", "buyer_objections")
      ?? aliasValue(value, "painPoints", "pain_points"),
  );
  const highlights = cleanArray(
    value.highlights ?? aliasValue(value, "fiveBullets", "five_bullets"),
  );
  const searchTerms = normalizeSearchTerms(
    aliasValue(value, "searchTerms", "search_terms"),
    aliasValue(value, "backendSearchTerms", "backend_search_terms"),
  );
  const painPoints = cleanArray(aliasValue(value, "painPoints", "pain_points") ?? buyerObjections);
  const fiveBullets = cleanArray(aliasValue(value, "fiveBullets", "five_bullets") ?? highlights);
  const backendSearchTerms = cleanString(
    aliasValue(value, "backendSearchTerms", "backend_search_terms"),
  ) || searchTerms.join(" ");
  return {
    title: cleanString(value.title),
    sellingPoints: cleanArray(aliasValue(value, "sellingPoints", "selling_points")),
    buyerObjections,
    highlights,
    searchTerms,
    painPoints,
    fiveBullets,
    description: cleanString(value.description),
    backendSearchTerms,
    keywordBuckets: normalizeDisplayKeywordBuckets(value.keywordBuckets ?? value.keyword_buckets ?? {}),
    missingInfo: cleanArray(aliasValue(value, "missingInfo", "missing_info")),
    warnings: cleanArray(value.warnings),
  };
}

function resolveFrozenFieldList(value, source, policy, key) {
  for (const candidate of [value?.[key], source?.[key], policy?.[key]]) {
    if (Array.isArray(candidate)) return cleanArray(candidate);
  }
  return [];
}

function policyFieldLabels(policy = {}) {
  return {
    title: policy.titleRules?.label || "Title",
    highlights: policy.highlightRules?.label || "Highlights",
    description: policy.descriptionRules?.label || "Description",
    searchTerms: policy.searchRules?.label || "Search terms",
    sellingPoints: "Selling point strategy",
    buyerObjections: "Buyer objections",
    keywordBuckets: "Keyword planning",
  };
}

function policyFieldPurposes(policy = {}) {
  return {
    title: policy.titleRules?.purpose || "",
    highlights: policy.highlightRules?.purpose || "",
    description: policy.descriptionRules?.purpose || "",
    searchTerms: policy.searchRules?.purpose || "",
  };
}

function resolveFrozenFieldMap(value, source, policyFallback, key) {
  const saved = value?.[key] && typeof value[key] === "object" ? value[key] : {};
  const supplied = source?.[key] && typeof source[key] === "object" ? source[key] : {};
  return Object.fromEntries(Object.keys(policyFallback).map((field) => [
    field,
    cleanString(saved[field]) || cleanString(supplied[field]) || cleanString(policyFallback[field]),
  ]));
}

function listingWarningIdentity(value) {
  return cleanString(value)
    .replace(/[.!?;:,\u3002\uff01\uff1f\uff1b\uff1a\uff0c]+$/u, "")
    .toLocaleLowerCase("und");
}

function normalizeV2BilingualWarnings(source = {}, valueWarnings = [], zhDisplay = null) {
  const forbiddenTerms = extractCreationListingForbiddenTerms(source);
  const sourceWarnings = cleanArray(
    sanitizeCreationListingNoBrandContent(source.warnings, forbiddenTerms),
  );
  const generatedWarnings = cleanArray(valueWarnings);
  const generatedChineseWarnings = cleanArray(zhDisplay?.warnings);
  const records = [];
  const recordIndexes = new Map();

  const upsert = (warning, chineseWarning) => {
    const english = cleanString(warning);
    const key = listingWarningIdentity(english);
    if (!english || !key) return;
    const record = {
      english,
      chinese: cleanString(chineseWarning) || `提示对照：${english}`,
    };
    if (recordIndexes.has(key)) {
      records[recordIndexes.get(key)] = record;
      return;
    }
    recordIndexes.set(key, records.length);
    records.push(record);
  };

  sourceWarnings.forEach((warning) => upsert(warning));
  generatedWarnings.forEach((warning, index) => upsert(warning, generatedChineseWarnings[index]));

  return {
    warnings: records.map((record) => record.english),
    zhDisplay: zhDisplay
      ? { ...zhDisplay, warnings: records.map((record) => record.chinese) }
      : zhDisplay,
  };
}

export function normalizeCreationListingDraft(value = {}, source = {}) {
  const schemaVersion = cleanString(value.schemaVersion ?? value.schema_version);
  const forceV2 = source.forceV2 === true || source.schemaVersion === "2";
  const isV2 = schemaVersion === "2" || forceV2;
  if (isV2) {
    value = sanitizeCreationListingDraftContent(value, source);
  }
  const rawMarketplace = cleanString(value.marketplace ?? source.marketplace);
  const explicitPlatformId = cleanString(
    aliasValue(value, "platformId", "platform_id")
      ?? source.platformId
      ?? source.platformPolicyId,
  );
  const policy = source.listingPolicy && typeof source.listingPolicy === "object"
    ? source.listingPolicy
    : resolveCreationListingPolicy({
      platformPolicyId: explicitPlatformId,
      platform: explicitPlatformId || rawMarketplace,
      targetLanguage: value.language ?? source.language,
    });
  const keywordBuckets = normalizeKeywordBuckets(value.keywordBuckets ?? value.keyword_buckets ?? {});
  const createdAt = cleanString(value.createdAt ?? value.created_at) || new Date().toISOString();
  let zhDisplay = normalizeCreationListingDisplay(value.zhDisplay ?? value.zh_display);
  const buyerObjections = cleanArray(
    aliasValue(value, "buyerObjections", "buyer_objections")
      ?? aliasValue(value, "painPoints", "pain_points"),
  );
  const highlights = cleanArray(
    value.highlights ?? aliasValue(value, "fiveBullets", "five_bullets"),
  );
  const searchTerms = normalizeSearchTerms(
    aliasValue(value, "searchTerms", "search_terms"),
    aliasValue(value, "backendSearchTerms", "backend_search_terms"),
  );
  const painPoints = cleanArray(aliasValue(value, "painPoints", "pain_points") ?? buyerObjections);
  const fiveBullets = cleanArray(aliasValue(value, "fiveBullets", "five_bullets") ?? highlights);
  const backendSearchTerms = normalizeBackendSearchTerms(
    aliasValue(value, "backendSearchTerms", "backend_search_terms") ?? searchTerms,
  );
  const marketplace = rawMarketplace || (isV2 ? cleanString(policy.marketplaceId) : CREATION_LISTING_MARKETPLACE);
  const platformId = explicitPlatformId
    || (marketplace === "amazon-us" ? "amazon" : cleanString(policy.platformId || policy.id))
    || "universal";
  const language = cleanString(value.language ?? source.language ?? policy.language ?? policy.locale)
    || (isV2 ? cleanString(policy.defaultLocale) : CREATION_LISTING_LANGUAGE);
  const frozenPolicyMetadata = isV2
    ? {
      publishFields: resolveFrozenFieldList(value, source, policy, "publishFields"),
      internalFields: resolveFrozenFieldList(value, source, policy, "internalFields"),
      fieldLabels: resolveFrozenFieldMap(value, source, policyFieldLabels(policy), "fieldLabels"),
      fieldPurposes: resolveFrozenFieldMap(value, source, policyFieldPurposes(policy), "fieldPurposes"),
    }
    : {};
  const normalizedWarnings = isV2
    ? normalizeV2BilingualWarnings(source, value.warnings, zhDisplay)
    : { warnings: uniqueCleanStrings(source.warnings, value.warnings), zhDisplay };
  zhDisplay = normalizedWarnings.zhDisplay;
  return {
    id: isV2 ? normalizeV2DraftId(value.id, source) : cleanString(value.id) || makeDraftId(source),
    ...(schemaVersion ? { schemaVersion } : forceV2 ? { schemaVersion: "2" } : {}),
    platformId,
    platformLabel: cleanString(aliasValue(value, "platformLabel", "platform_label") ?? source.platformLabel)
      || cleanString(policy.platformLabel || policy.label),
    marketplace,
    ...(isV2
      ? {
        listingPolicyVersion: cleanString(
          aliasValue(value, "listingPolicyVersion", "listing_policy_version")
            ?? source.listingPolicyVersion
            ?? policy.listingPolicyVersion
            ?? policy.policyVersion,
        ),
      }
      : {}),
    language,
    ...frozenPolicyMetadata,
    skuSubjectId: cleanString(aliasValue(value, "skuSubjectId", "sku_subject_id") ?? source.skuSubjectId),
    skuTitle: cleanString(aliasValue(value, "skuTitle", "sku_title") ?? source.skuTitle),
    evidenceMode: cleanString(aliasValue(value, "evidenceMode", "evidence_mode") ?? source.evidenceMode) || "input-only",
    status: cleanString(value.status) || "completed",
    title: cleanString(value.title),
    sellingPoints: cleanArray(aliasValue(value, "sellingPoints", "selling_points")),
    buyerObjections,
    highlights,
    searchTerms,
    painPoints,
    fiveBullets,
    description: cleanString(value.description),
    backendSearchTerms,
    keywordBuckets,
    evidence: cleanArray(value.evidence ?? source.evidence),
    missingInfo: cleanArray(aliasValue(value, "missingInfo", "missing_info")),
    warnings: normalizedWarnings.warnings,
    ...(zhDisplay ? { zhDisplay } : {}),
    createdAt,
    updatedAt: cleanString(value.updatedAt ?? value.updated_at) || createdAt,
  };
}

function checkMaxLength(errors, label, value) {
  if (cleanString(value).length > CREATION_LISTING_FIELD_MAX_CHARS) {
    errors.push(`${label} exceeds ${CREATION_LISTING_FIELD_MAX_CHARS} characters`);
  }
}

function checkCombinedEnglishMaxLength(errors, label, values = []) {
  const text = cleanString(cleanArray(values).join(" "));
  if (text.length > CREATION_LISTING_FIELD_MAX_CHARS) {
    errors.push(`${label} exceeds ${CREATION_LISTING_FIELD_MAX_CHARS} English characters total`);
  }
}

function hasUnsupportedClaim(value) {
  const text = cleanString(value);
  return UNSUPPORTED_CLAIM_PATTERNS.some(({ pattern }) => pattern.test(text));
}

export function containsCreationListingFunctionalWording(value) {
  const text = cleanString(value);
  const rule = CLAIM_RISK_RULES.find((item) => item.id === "functional-wording");
  return Object.values(rule?.patterns || {}).flat().some((pattern) => pattern.test(text));
}

function checkUnsupportedClaims(errors, label, value) {
  const text = cleanString(value);
  for (const { label: claimLabel, pattern } of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      errors.push(`${label} contains unsupported claim "${claimLabel}"`);
    }
  }
}

function checkFiveBulletStructure(errors, label, value) {
  const text = cleanString(value);
  if (!FIVE_BULLET_LEAD_PATTERN.test(text)) {
    errors.push(`${label} must start with a short uppercase lead label and colon`);
  }
  if (FIVE_BULLET_AFTERSALES_PATTERNS.some((pattern) => pattern.test(text))) {
    errors.push(`${label} must not use gift or after-sales promises`);
  }
}

function publicListingText(draft = {}) {
  return [
    draft.title,
    draft.description,
    draft.backendSearchTerms,
    ...(Array.isArray(draft.sellingPoints) ? draft.sellingPoints : []),
    ...(Array.isArray(draft.painPoints) ? draft.painPoints : []),
    ...(Array.isArray(draft.fiveBullets) ? draft.fiveBullets : []),
    ...Object.values(draft.keywordBuckets || {}).flat(),
  ].map(cleanString).filter(Boolean).join(" ");
}

function collectTextValues(value, values = []) {
  if (typeof value === "string" || typeof value === "number") {
    values.push(cleanString(value));
    return values;
  }
  if (Array.isArray(value)) {
    value.forEach((item) => collectTextValues(item, values));
    return values;
  }
  if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectTextValues(item, values));
  }
  return values;
}

function listingDisplayText(draft = {}) {
  return [
    publicListingText(draft),
    ...collectTextValues(draft.zhDisplay),
  ].map(cleanString).filter(Boolean).join(" ");
}

function checkSelectedUnitMode(errors, draft = {}, mode) {
  const dimensionUnitMode = normalizeCreationDimensionUnitMode(mode);
  if (!["metric", "imperial"].includes(dimensionUnitMode.value)) {
    return;
  }

  const systems = collectSizeUnitSystems(listingDisplayText(draft));
  if (dimensionUnitMode.value === "imperial" && systems.has("metric")) {
    errors.push("listing display fields must use imperial units only");
  }
  if (dimensionUnitMode.value === "metric" && systems.has("imperial")) {
    errors.push("listing display fields must use metric units only");
  }
}

function checkTitleSpecificationValues(errors, title, forbidTitleSpecs) {
  if (forbidTitleSpecs && TITLE_SPEC_VALUE_PATTERN.test(cleanString(title))) {
    errors.push("title must not include size or specification values");
  }
}

function isEnglishListingLanguage(language) {
  return /^en(?:-|$)/i.test(cleanString(language));
}

function titleStartsWithQuantity(title, expectedQuantity) {
  return Boolean(quantityPrefixMatch(title, expectedQuantity));
}

function escapeRegExp(value) {
  return cleanString(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function whitespaceFlexiblePattern(value) {
  return escapeRegExp(value).replace(/\s+/g, "\\s+");
}

function parsePackQuantityCounts(value) {
  const text = cleanString(value);
  if (!/\bpack\b/i.test(text)) {
    return [];
  }
  return uniquePositiveCounts([...text.matchAll(/\b(\d{1,3})\b/g)].map((match) => match[1]));
}

function quantityPrefixMatch(title, expectedQuantity) {
  const titleText = cleanString(title);
  const expected = cleanString(expectedQuantity);
  if (expected) {
    const directMatch = titleText.match(new RegExp(`^${whitespaceFlexiblePattern(expected)}(?=\\s|$|[,.])`, "i"));
    if (directMatch) {
      return directMatch;
    }

    const counts = parsePackQuantityCounts(expected);
    if (counts.length > 1) {
      const compactCounts = counts.map(String).join("\\s*/\\s*");
      const repeatedPacks = counts.map((count) => `${count}\\s*packs?`).join("\\s*(?:/|and|or)\\s*");
      return titleText.match(new RegExp(`^(?:${compactCounts}\\s*packs?|${repeatedPacks})(?=\\s|$|[,.])`, "i"));
    }
    return null;
  }

  return titleText.match(/^(?:(?:\d+\s*(?:\/\s*\d+\s*)*)|one|two|three|four|five|six|seven|eight|nine|ten)\s+(?:pack|piece|pcs|count|ct|set)\b/i);
}

function canonicalSizePrefixText(value) {
  return cleanString(value)
    .toLowerCase()
    .replace(/×/g, "x")
    .replace(/\s+/g, "");
}

function expectedSizeTokens(expectedSize) {
  return [...cleanString(expectedSize).matchAll(SIZE_VALUE_UNIT_PATTERN)]
    .map((match) => canonicalSizePrefixText(match[0]));
}

function titleContainsAllExpectedSizeUnits(title, expectedSize) {
  const titleText = canonicalSizePrefixText(title);
  const tokens = expectedSizeTokens(expectedSize);
  return tokens.length === 0 || tokens.every((token) => titleText.includes(token));
}

function titlePlacesSizeImmediatelyAfterQuantity(title, expectedQuantity, expectedSize) {
  const quantity = cleanString(expectedQuantity);
  const size = cleanString(expectedSize);
  const quantityMatch = quantityPrefixMatch(title, quantity);
  if (!quantity || !size || !quantityMatch) {
    return false;
  }
  const afterQuantity = canonicalSizePrefixText(cleanString(title).slice(quantityMatch[0].length));
  const expectedSizeText = canonicalSizePrefixText(size);
  if (expectedSizeText && afterQuantity.startsWith(expectedSizeText)) {
    return true;
  }
  return expectedSizeTokens(size).some((token) => afterQuantity.startsWith(token));
}

function listingCharacterLength(value) {
  return Array.from(cleanString(value)).length;
}

function listingUtf8ByteLength(value) {
  const text = cleanString(value);
  if (typeof TextEncoder === "function") {
    return new TextEncoder().encode(text).length;
  }
  return unescape(encodeURIComponent(text)).length;
}

function validationDateKey(value) {
  const candidate = value === undefined ? new Date() : value;
  const date = candidate instanceof Date ? candidate : new Date(candidate);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function isPolicyRuleEffective(rules = {}, validationDate) {
  const effectiveFrom = cleanString(rules.effectiveFrom);
  if (!effectiveFrom) return true;
  const dateKey = validationDateKey(validationDate);
  if (!dateKey || !/^\d{4}-\d{2}-\d{2}$/.test(effectiveFrom)) return true;
  return dateKey >= effectiveFrom;
}

function checkPolicyTextLimit(errors, warnings, label, value, rules = {}, suffix = "", validationDate) {
  const chars = listingCharacterLength(value);
  const bytes = listingUtf8ByteLength(value);
  const hardMinChars = rules[`hardMinChars${suffix}`];
  const hardMaxChars = rules[`hardMaxChars${suffix}`];
  const hardMinBytes = rules[`hardMinUtf8Bytes${suffix}`];
  const hardMaxBytes = rules[`hardMaxUtf8Bytes${suffix}`];
  const recommendedMinChars = rules[`recommendedMinChars${suffix}`];
  const recommendedMaxChars = rules[`recommendedMaxChars${suffix}`];
  const recommendedMinBytes = rules[`recommendedMinUtf8Bytes${suffix}`];
  const recommendedMaxBytes = rules[`recommendedMaxUtf8Bytes${suffix}`];
  const hardRulesEffective = isPolicyRuleEffective(rules, validationDate);

  if (Number.isFinite(hardMinChars) && chars < hardMinChars) (hardRulesEffective ? errors : warnings).push(`${label} must contain at least ${hardMinChars} characters${hardRulesEffective ? "" : ` after ${rules.effectiveFrom}`}`);
  if (Number.isFinite(hardMaxChars) && chars > hardMaxChars) (hardRulesEffective ? errors : warnings).push(`${label} exceeds ${hardMaxChars} characters${hardRulesEffective ? "" : `; treat ${hardMaxChars} as a recommendation until ${rules.effectiveFrom}`}`);
  if (Number.isFinite(hardMinBytes) && bytes < hardMinBytes) (hardRulesEffective ? errors : warnings).push(`${label} must contain at least ${hardMinBytes} UTF-8 bytes${hardRulesEffective ? "" : ` after ${rules.effectiveFrom}`}`);
  if (Number.isFinite(hardMaxBytes) && bytes > hardMaxBytes) (hardRulesEffective ? errors : warnings).push(`${label} exceeds ${hardMaxBytes} UTF-8 bytes${hardRulesEffective ? "" : `; treat ${hardMaxBytes} as a recommendation until ${rules.effectiveFrom}`}`);
  if (Number.isFinite(recommendedMinChars) && chars < recommendedMinChars) warnings.push(`${label} is below the ${recommendedMinChars}-character recommendation`);
  if (Number.isFinite(recommendedMaxChars) && chars > recommendedMaxChars && (hardRulesEffective || recommendedMaxChars !== hardMaxChars)) warnings.push(`${label} exceeds the ${recommendedMaxChars}-character recommendation`);
  if (Number.isFinite(recommendedMinBytes) && bytes < recommendedMinBytes) warnings.push(`${label} is below the ${recommendedMinBytes}-byte recommendation`);
  if (Number.isFinite(recommendedMaxBytes) && bytes > recommendedMaxBytes) warnings.push(`${label} exceeds the ${recommendedMaxBytes}-byte recommendation`);
}

function checkPolicyItemCount(errors, warnings, label, values, rules = {}) {
  const count = Array.isArray(values) ? values.length : 0;
  if (Number.isFinite(rules.hardMinItems) && count < rules.hardMinItems) errors.push(`${label} must include at least ${rules.hardMinItems} items`);
  if (Number.isFinite(rules.hardMaxItems) && count > rules.hardMaxItems) errors.push(`${label} exceeds ${rules.hardMaxItems} items`);
  if (Number.isFinite(rules.recommendedMinItems) && count < rules.recommendedMinItems) warnings.push(`${label} is below the ${rules.recommendedMinItems}-item recommendation`);
  if (Number.isFinite(rules.recommendedMaxItems) && count > rules.recommendedMaxItems) warnings.push(`${label} exceeds the ${rules.recommendedMaxItems}-item recommendation`);
}

function collectTraceableFactValues(value, values = []) {
  if (typeof value === "string" || typeof value === "number") {
    const text = cleanString(value);
    if (text) values.push(text);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectTraceableFactValues(item, values));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectTraceableFactValues(item, values));
  }
  return values;
}

function traceableListingFactValues(sourceFacts = {}) {
  const source = sourceFacts && typeof sourceFacts === "object" ? sourceFacts : {};
  const skuFacts = (Array.isArray(source.skuSubjects) ? source.skuSubjects : []).map((sku) => ({
    id: sku?.id,
    title: sku?.title,
    note: sku?.note,
    bundleCount: sku?.bundleCount,
    subjectUnitCount: sku?.subjectUnitCount,
  }));
  const referenceFacts = (Array.isArray(source.referenceImageRoles) ? source.referenceImageRoles : []).map((entry) => ({
    role: entry?.role,
    note: entry?.note,
    productGroupLabel: entry?.productGroupLabel ?? entry?.product_group_label,
  }));
  return collectTraceableFactValues({
    productName: source.productName,
    productDescription: source.productDescription,
    sellingPoints: source.sellingPoints,
    dimensionSpecs: source.dimensionSpecs,
    skuTitle: source.skuTitle,
    skuNote: source.skuNote,
    skuPackQuantityText: source.skuPackQuantityText,
    skuQuantityOptions: source.skuQuantityOptions,
    skuSubjects: skuFacts,
    referenceImageRoles: referenceFacts,
  });
}

function normalizeClaimEvidenceText(value) {
  return cleanString(value)
    .normalize("NFKC")
    .toLocaleLowerCase("und")
    .replace(/[\p{P}\p{S}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function claimHasExactEvidence(claim, evidenceValues) {
  const normalizedClaim = normalizeClaimEvidenceText(claim);
  if (!normalizedClaim) return false;
  return evidenceValues.some((value) => {
    const normalizedEvidence = normalizeClaimEvidenceText(value);
    return normalizedEvidence === normalizedClaim || normalizedEvidence.includes(normalizedClaim);
  });
}

function checkPolicyClaims(errors, label, value, sourceFacts = {}) {
  const text = cleanString(value);
  const evidenceValues = traceableListingFactValues(sourceFacts);
  for (const rule of CLAIM_RISK_RULES) {
    for (const pattern of Object.values(rule.patterns).flat()) {
      const match = text.match(pattern);
      if (!match) continue;
      if (rule.support === "exact-evidence" && claimHasExactEvidence(match[0], evidenceValues)) continue;
      errors.push(`${label} contains unsupported claim "${rule.label}" without exact traceable input evidence`);
      break;
    }
  }
}

function checkV2SafetyCeiling(errors, label, value) {
  if (listingCharacterLength(value) > CREATION_LISTING_FIELD_MAX_CHARS) {
    errors.push(`${label} exceeds universal safety ceiling of ${CREATION_LISTING_FIELD_MAX_CHARS} characters`);
  }
}

function validatePolicyCreationListingDraft(normalized, options = {}) {
  const policy = options.policy && typeof options.policy === "object"
    ? options.policy
    : getCreationListingPolicy(normalized.platformId || normalized.marketplace || "universal");
  const errors = getCreationListingPublishFieldErrors(normalized);
  const warnings = [];
  const sourceFacts = options.sourceFacts && typeof options.sourceFacts === "object"
    ? options.sourceFacts
    : options.source || {};
  const expectedLanguage = cleanString(policy.locale || policy.language || policy.defaultLocale);

  if (expectedLanguage && cleanString(normalized.language).toLowerCase() !== expectedLanguage.toLowerCase()) {
    errors.push(`language must match resolved locale ${expectedLanguage}`);
  }

  checkV2SafetyCeiling(errors, "title", normalized.title);
  checkPolicyTextLimit(errors, warnings, "title", normalized.title, policy.titleRules, "", options.validationDate);
  checkPolicyClaims(errors, "title", normalized.title, sourceFacts);

  checkV2SafetyCeiling(errors, "description", normalized.description);
  checkPolicyTextLimit(errors, warnings, "description", normalized.description, policy.descriptionRules, "", options.validationDate);
  checkPolicyClaims(errors, "description", normalized.description, sourceFacts);

  checkPolicyItemCount(errors, warnings, "highlights", normalized.highlights, policy.highlightRules);
  normalized.highlights.forEach((item, index) => {
    checkV2SafetyCeiling(errors, `highlights[${index}]`, item);
    checkPolicyTextLimit(errors, warnings, `highlights[${index}]`, item, policy.highlightRules, "PerItem", options.validationDate);
    checkPolicyClaims(errors, `highlights[${index}]`, item, sourceFacts);
  });

  checkPolicyItemCount(errors, warnings, "searchTerms", normalized.searchTerms, policy.searchRules);
  normalized.searchTerms.forEach((item, index) => {
    checkV2SafetyCeiling(errors, `searchTerms[${index}]`, item);
    checkPolicyTextLimit(errors, warnings, `searchTerms[${index}]`, item, policy.searchRules, "PerItem", options.validationDate);
    checkPolicyClaims(errors, `searchTerms[${index}]`, item, sourceFacts);
  });

  for (const [label, values] of [
    ["sellingPoints", normalized.sellingPoints],
    ["buyerObjections", normalized.buyerObjections],
  ]) {
    values.forEach((item, index) => {
      checkV2SafetyCeiling(errors, `${label}[${index}]`, item);
      checkPolicyClaims(errors, `${label}[${index}]`, item, sourceFacts);
    });
  }
  for (const [bucket, values] of Object.entries(normalized.keywordBuckets)) {
    values.forEach((item, index) => {
      checkV2SafetyCeiling(errors, `keywordBuckets.${bucket}[${index}]`, item);
      checkPolicyClaims(errors, `keywordBuckets.${bucket}[${index}]`, item, sourceFacts);
    });
  }
  const zhDisplay = normalized.zhDisplay && typeof normalized.zhDisplay === "object"
    ? normalized.zhDisplay
    : {};
  for (const [label, value] of Object.entries(zhDisplay)) {
    if (["warnings", "missingInfo"].includes(label)) continue;
    collectTextValues(value).forEach((item, index) => {
      checkPolicyClaims(errors, `zhDisplay.${label}[${index}]`, item, sourceFacts);
    });
  }

  const publicText = [
    normalized.title,
    normalized.description,
    ...normalized.highlights,
    ...normalized.searchTerms,
  ].map(cleanString).filter(Boolean).join(" ");
  for (const { label, pattern } of INTERNAL_LISTING_LANGUAGE_PATTERNS) {
    if (pattern.test(publicText)) errors.push(`public listing fields contain internal template language "${label}"`);
  }
  checkSelectedUnitMode(errors, normalized, options.dimensionUnitMode);

  const combinedWarnings = uniqueCleanStrings(normalized.warnings, warnings);
  const normalizedWarningKeys = new Set(normalized.warnings.map((value) => cleanString(value).toLocaleLowerCase("und")));
  const appendedWarnings = combinedWarnings.filter((value) => !normalizedWarningKeys.has(
    cleanString(value).toLocaleLowerCase("und"),
  ));

  return {
    ok: errors.length === 0,
    errors,
    warnings,
    draft: {
      ...normalized,
      warnings: combinedWarnings,
      ...(normalized.zhDisplay
        ? {
          zhDisplay: {
            ...normalized.zhDisplay,
            warnings: [
              ...normalized.zhDisplay.warnings,
               ...appendedWarnings.map((warning) => `平台字段建议对照：${warning}`),
            ],
          },
        }
        : {}),
    },
    policy,
  };
}

export function validateCreationListingDraft(draft = {}, options = {}) {
  const isV2 = cleanString(draft?.schemaVersion ?? draft?.schema_version) === "2"
    || options.source?.forceV2 === true;
  const v2GateErrors = isV2
    ? validateCreationListingPersistedV2Content(
      draft,
      options.sourceFacts && typeof options.sourceFacts === "object"
        ? options.sourceFacts
        : options.source || {},
      { requirePublishFields: false },
    ).errors
    : [];
  const normalized = normalizeCreationListingDraft(draft, options.source || {});
  if (options.policy || normalized.schemaVersion === "2") {
    const validation = validatePolicyCreationListingDraft(normalized, options);
    if (v2GateErrors.length === 0) return validation;
    return {
      ...validation,
      ok: false,
      errors: [...v2GateErrors, ...validation.errors],
    };
  }
  const errors = [];

  checkMaxLength(errors, "title", normalized.title);
  checkUnsupportedClaims(errors, "title", normalized.title);
  checkMaxLength(errors, "description", normalized.description);
  checkUnsupportedClaims(errors, "description", normalized.description);
  checkMaxLength(errors, "backendSearchTerms", normalized.backendSearchTerms);
  checkUnsupportedClaims(errors, "backendSearchTerms", normalized.backendSearchTerms);
  checkCombinedEnglishMaxLength(errors, "sellingPoints", normalized.sellingPoints);
  normalized.sellingPoints.forEach((item, index) => checkMaxLength(errors, `sellingPoints[${index}]`, item));
  normalized.sellingPoints.forEach((item, index) => checkUnsupportedClaims(errors, `sellingPoints[${index}]`, item));
  checkCombinedEnglishMaxLength(errors, "painPoints", normalized.painPoints);
  normalized.painPoints.forEach((item, index) => checkMaxLength(errors, `painPoints[${index}]`, item));
  normalized.painPoints.forEach((item, index) => checkUnsupportedClaims(errors, `painPoints[${index}]`, item));
  normalized.fiveBullets.forEach((item, index) => checkMaxLength(errors, `fiveBullets[${index}]`, item));
  normalized.fiveBullets.forEach((item, index) => checkUnsupportedClaims(errors, `fiveBullets[${index}]`, item));
  normalized.fiveBullets.forEach((item, index) => checkFiveBulletStructure(errors, `fiveBullets[${index}]`, item));
  if (normalized.fiveBullets.length !== 5) {
    errors.push("fiveBullets must include exactly 5 items");
  }
  for (const [bucket, values] of Object.entries(normalized.keywordBuckets)) {
    values.forEach((item, index) => checkMaxLength(errors, `keywordBuckets.${bucket}[${index}]`, item));
    values.forEach((item, index) => checkUnsupportedClaims(errors, `keywordBuckets.${bucket}[${index}]`, item));
  }
  for (const [label, value] of Object.entries(normalized.zhDisplay || {})) {
    if (["warnings", "missingInfo"].includes(label)) continue;
    collectTextValues(value).forEach((item, index) => {
      checkUnsupportedClaims(errors, `zhDisplay.${label}[${index}]`, item);
    });
  }

  const publicText = publicListingText(normalized);
  checkSelectedUnitMode(errors, normalized, options.dimensionUnitMode);
  if (isEnglishListingLanguage(normalized.language) && CJK_TEXT_PATTERN.test(publicText)) {
    errors.push("public listing fields must be English only");
  }

  for (const pattern of NON_US_MARKET_PATTERNS) {
    if (pattern.test(publicText)) {
      errors.push("public listing fields must target Amazon US");
      break;
    }
  }

  for (const { label, pattern } of INTERNAL_LISTING_LANGUAGE_PATTERNS) {
    if (pattern.test(publicText)) {
      errors.push(`public listing fields contain internal template language "${label}"`);
    }
  }

  if (/\blisting\s+draft\b/i.test(normalized.title)) {
    errors.push('title must not include internal phrase "Listing Draft"');
  }
  checkTitleSpecificationValues(errors, normalized.title, options.forbidTitleSpecs);

  if (!titleStartsWithQuantity(normalized.title, options.expectedQuantity)) {
    errors.push("title must start with quantity");
  }

  const expectedQuantity = cleanString(options.expectedQuantity);
  const expectedSize = cleanString(options.expectedSize);
  if (!options.forbidTitleSpecs && expectedQuantity && expectedSize) {
    if (!titleContainsAllExpectedSizeUnits(normalized.title, expectedSize)) {
      errors.push("title must include all expected size units");
    }
    if (titlePlacesSizeImmediatelyAfterQuantity(normalized.title, expectedQuantity, expectedSize)) {
      errors.push("title must place size after the product keyword, not immediately after quantity");
    }
  }

  return { ok: errors.length === 0, errors, draft: normalized };
}

function basename(path) {
  return cleanString(path).split(/[\\/]/).filter(Boolean).at(-1) || "";
}

function itemMatchesSku(item = {}, sku = {}) {
  const skuId = cleanString(sku.id);
  const itemSkuId = cleanString(item.skuSubject?.id ?? item.sku_subject?.id ?? item.skuSubjectId ?? item.sku_subject_id);
  if (skuId && itemSkuId && skuId === itemSkuId) {
    return true;
  }

  const filenames = new Set(cleanArray(sku.filenames).map((filename) => filename.toLowerCase()));
  if (filenames.size === 0) {
    return false;
  }
  const itemNames = [
    cleanString(item.filename),
    basename(item.relativePath),
    basename(item.path),
  ].filter(Boolean).map((name) => name.toLowerCase());
  return itemNames.some((name) => filenames.has(name));
}

function completedImageItems(set = {}, sku = null) {
  const items = Array.isArray(set.items) ? set.items : [];
  return items.filter((item) => {
    if (item.status !== "completed" || !cleanString(item.relativePath)) {
      return false;
    }
    return sku ? itemMatchesSku(item, sku) : true;
  });
}

function skuSubjectIdentity(sku = {}) {
  const id = cleanString(sku.id).toLowerCase();
  if (id) {
    return `id:${id}`;
  }
  const title = cleanString(sku.title).toLowerCase();
  const filenames = cleanArray(sku.filenames).map((filename) => filename.toLowerCase()).sort().join("|");
  return `fallback:${title}:${filenames}`;
}

function uniqueSkuSubjects(skuSubjects = []) {
  const seen = new Set();
  const result = [];
  for (const sku of skuSubjects) {
    const key = skuSubjectIdentity(sku);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(sku);
  }
  return result;
}

function compactSkuSubject(sku = {}) {
  const bundleCount = Number(sku.bundleCount ?? sku.bundle_count) || undefined;
  const subjectUnitCount = skuSubjectUnitCount(sku);
  return compactRecord({
    id: cleanString(sku.id),
    title: cleanString(sku.title),
    note: cleanString(sku.note),
    filenames: cleanArray(sku.filenames),
    bundleCount,
    subjectUnitCount,
  });
}

function matchingReferenceSubjectRoles(sku = {}, referenceImageRoles = []) {
  const filenames = new Set(cleanArray(sku.filenames).map((filename) => filename.toLowerCase()));
  if (filenames.size === 0) {
    return [];
  }

  return (Array.isArray(referenceImageRoles) ? referenceImageRoles : [])
    .filter((entry) => isCreationSubjectReferenceRole(entry?.role) && filenames.has(cleanString(entry?.filename).toLowerCase()));
}

function mergeListingSubjectNotes(baseNote = "", extraNotes = []) {
  const parts = [];
  const seen = new Set();
  const append = (value) => {
    const text = cleanString(value);
    if (!text) {
      return;
    }
    const key = text.toLowerCase();
    if (seen.has(key)) {
      return;
    }
    seen.add(key);
    parts.push(text);
  };

  append(baseNote);
  extraNotes.forEach(append);
  return parts.join(" | ");
}

function enrichCompactSkuSubjectFromReferences(sku = {}, referenceImageRoles = []) {
  const matchedRoles = matchingReferenceSubjectRoles(sku, referenceImageRoles);
  if (matchedRoles.length === 0) {
    return sku;
  }

  const ownNote = cleanString(sku.note);
  const referenceNote = mergeListingSubjectNotes("", matchedRoles.map((entry) => entry.note));
  const inferenceNote = mergeListingSubjectNotes(ownNote, referenceNote ? [referenceNote] : []);
  const note = !ownNote || (referenceNote && referenceNote.length > ownNote.length)
    ? mergeListingSubjectNotes(ownNote, referenceNote ? [referenceNote] : [])
    : ownNote;
  const subjectUnitCount = skuSubjectUnitCount({ ...sku, note: inferenceNote });
  return compactRecord({
    ...sku,
    note,
    subjectUnitCount,
  });
}

function buildFallbackListingSkuSubjects(referenceImageRoles = []) {
  return (Array.isArray(referenceImageRoles) ? referenceImageRoles : [])
    .filter((entry) => isCreationSubjectReferenceRole(entry?.role) && cleanString(entry?.filename))
    .map((entry, index) =>
      compactSkuSubject({
        id: cleanString(entry.filename || `sku-${index + 1}`),
        title: cleanString(entry.filename || `SKU ${index + 1}`),
        filenames: [cleanString(entry.filename)],
        note: cleanString(entry.note),
      }),
    );
}

function firstCountOverOne(values = []) {
  return values.find((count) => Number.isFinite(count) && count > 1) || 0;
}

function uniquePositiveCounts(values = []) {
  const seen = new Set();
  return values
    .map((value) => positiveCount(value, 0))
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

function positiveCount(value, fallback = 0) {
  const count = Number(value);
  return Number.isFinite(count) && count > 0 ? Math.round(count) : fallback;
}

export function formatCreationListingPackQuantity(values = [], fallback = 1) {
  const counts = uniquePositiveCounts(Array.isArray(values) ? values : [values]);
  const fallbackCount = positiveCount(fallback, 1);
  const effectiveCounts = counts.length > 0 ? counts : [fallbackCount || 1];
  return effectiveCounts.length > 1
    ? effectiveCounts.map((count) => `${count} Pack`).join(" / ")
    : `${effectiveCounts[0]} Pack`;
}

function skuListingQuantity(sku = {}, fallbackBundleCount = 1) {
  const subjectUnitCount = positiveCount(skuSubjectUnitCount(sku), 1);
  const bundleCount = positiveCount(sku.bundleCount ?? sku.bundle_count, positiveCount(fallbackBundleCount, 1));
  return subjectUnitCount * bundleCount;
}

function compactListingItem(item = {}) {
  const slotIndex = Number(item.slotIndex ?? item.slot_index);
  const skuSubject = compactSkuSubject(item.skuSubject ?? item.sku_subject ?? {});
  return compactRecord({
    itemId: cleanString(item.itemId ?? item.item_id),
    slotIndex: Number.isFinite(slotIndex) ? slotIndex : undefined,
    role: cleanString(item.role),
    title: cleanString(item.title),
    status: cleanString(item.status),
    filename: cleanString(item.filename),
    relativePath: cleanString(item.relativePath ?? item.relative_path),
    size: cleanString(item.size),
    format: cleanString(item.format),
    skuSubjectId: cleanString(item.skuSubjectId ?? item.sku_subject_id),
    skuSubject,
  });
}

function compactListingItems(items = []) {
  return items.map(compactListingItem).filter((item) => Object.keys(item).length > 0);
}

function buildListingDimensionMetadata(set = {}) {
  const dimensionSpecs = cleanString(set.dimensionSpecs);
  const dimensionUnitMode = normalizeCreationDimensionUnitMode(set.dimensionUnitMode);
  const convertedSpecs = formatCreationDimensionSpecsForMode(dimensionSpecs, dimensionUnitMode.value);

  return {
    dimensionSpecs: cleanString(convertedSpecs) || dimensionSpecs,
    dimensionUnitMode: dimensionUnitMode.value,
    dimensionUnitModeLabel: cleanString(set.dimensionUnitModeLabel) || dimensionUnitMode.label,
  };
}

function formatListingReferenceImageRolesForMode(referenceImageRoles = [], mode) {
  return referenceImageRoles.map((entry) => {
    if (!entry || typeof entry !== "object") {
      return entry;
    }
    const note = formatListingDimensionTextForMode(entry.note, mode);
    return {
      ...entry,
      ...(note || Object.prototype.hasOwnProperty.call(entry, "note") ? { note } : {}),
    };
  });
}

export function buildCreationListingSources(set = {}) {
  const listingPolicy = resolveCreationListingPolicy({
    ...set,
    platformPolicyId: set.platformPolicyId || set.platformId,
  });
  const skuSubjects = uniqueSkuSubjects(Array.isArray(set.skuSubjects) ? set.skuSubjects : []);
  const allCompletedImages = completedImageItems(set);
  const dimensionMetadata = buildListingDimensionMetadata(set);
  const referenceImageRoles = formatListingReferenceImageRolesForMode(
    Array.isArray(set.referenceImageRoles) ? set.referenceImageRoles : [],
    dimensionMetadata.dimensionUnitMode,
  );
  const forbiddenTerms = extractCreationListingForbiddenTerms(set);
  const compactSkuSubjects = skuSubjects.length > 0
    ? skuSubjects
      .map(compactSkuSubject)
      .map((sku) => enrichCompactSkuSubjectFromReferences(sku, referenceImageRoles))
    : buildFallbackListingSkuSubjects(referenceImageRoles);
  const evidenceMode = allCompletedImages.length > 0 ? "image-backed" : "input-only";
  const warnings = evidenceMode === "input-only"
    ? ["Generated images were unavailable; copy is based on product inputs and saved SKU metadata."]
    : [];
  warnings.push(...cleanArray(listingPolicy.warnings));
  const setBundleCount = positiveCount(set.skuBundleCount, 1);
  const skuListingQuantities = compactSkuSubjects
    .map((sku) => skuListingQuantity(sku, setBundleCount))
    .filter((count) => count > 0);
  const skuQuantityOptions = uniquePositiveCounts(skuListingQuantities);
  const listingBundleCount =
    firstCountOverOne(skuQuantityOptions) ||
    setBundleCount ||
    1;
  const skuPackQuantityText = formatCreationListingPackQuantity(
    skuQuantityOptions.length > 1 ? skuQuantityOptions : [listingBundleCount],
  );

  return [
    {
      setId: cleanString(set.setId),
      schemaVersion: "2",
      forceV2: true,
      platformId: listingPolicy.platformId,
      platformLabel: listingPolicy.platformLabel,
      marketplace: listingPolicy.marketplaceId,
      listingPolicyVersion: listingPolicy.listingPolicyVersion,
      language: listingPolicy.language,
      listingPolicy,
      forbiddenTerms,
      platformProvenance: listingPolicy.platformProvenance,
      effectivePlan: set.effectivePlan && typeof set.effectivePlan === "object" ? set.effectivePlan : undefined,
      productName: cleanString(set.productName),
      productDescription: compactListingSourceDescription(set.productDescription),
      sellingPoints: cleanArray(set.sellingPoints),
      ...dimensionMetadata,
      industryTemplatePath: cleanString(set.industryTemplatePath),
      referenceImageRoles,
      skuSubjectId: "",
      skuTitle: cleanString(set.productName),
      skuNote: skuSubjects.map((sku) => [sku.title, sku.note].filter(Boolean).join(": ")).filter(Boolean).join(" | "),
      skuFilenames: skuSubjects.flatMap((sku) => cleanArray(sku.filenames)),
      skuBundleCount: listingBundleCount,
      skuPackQuantityText,
      ...(skuQuantityOptions.length > 1 ? { skuQuantityOptions } : {}),
      skuVariantCount: compactSkuSubjects.length,
      skuSubjects: compactSkuSubjects,
      imageItems: compactListingItems(allCompletedImages),
      plannedItems: compactListingItems(Array.isArray(set.items) ? set.items : []),
      evidenceMode,
      warnings,
      evidence: allCompletedImages.map((item) => cleanString(item.title || item.role || item.itemId)).filter(Boolean),
    },
  ];
}
