import {
  formatCreationDimensionSpecsForMode,
  normalizeCreationDimensionUnitMode,
} from "./creation-planner.mjs";
import { isCreationSubjectReferenceRole } from "./creation-reference-roles.mjs";

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
const UNSUPPORTED_CLAIM_PATTERNS = [
  { label: "FDA Certified", pattern: /\bfda\s+certified\b/i },
  { label: "medical grade", pattern: /\bmedical\s+grade\b/i },
  { label: "guaranteed", pattern: /\bguaranteed?\b/i },
  { label: "best", pattern: /\bbest\b/i },
  { label: "warranty", pattern: /\bwarranty\b/i },
];
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
const SHOPPING_UNCERTAINTY_PAIN_PATTERNS = [
  /\b(?:not sure|unsure|uncertain|guesswork)\b.*\b(?:choose|select|pick|buying|purchase|color|variant|option|size|pack)\b/i,
  /\b(?:need|missing|unclear|hidden)\s+(?:size|pack|quantity|color|variant|option|details?)\b.*\b(?:buying|purchase|selection|choose|compare|browsing)\b/i,
  /\b(?:parent listing|listing (?:clearly )?(?:states|groups|shows|leads|starts)|offer (?:leads|starts)|variant details?|option names?)\b/i,
  /\b(?:shoppers?|buyers?)\b.*\b(?:compare|selection|choose|select|identify|understand the offer|available variants?)\b/i,
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

function makeDraftId(source = {}) {
  const suffix = cleanString(source.skuSubjectId || source.skuTitle || source.setId || "main")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40);
  return `listing-${suffix || "main"}`;
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
  return {
    title: cleanString(value.title),
    sellingPoints: cleanArray(aliasValue(value, "sellingPoints", "selling_points")),
    painPoints: cleanArray(aliasValue(value, "painPoints", "pain_points")),
    fiveBullets: cleanArray(aliasValue(value, "fiveBullets", "five_bullets")),
    description: cleanString(value.description),
    backendSearchTerms: cleanString(aliasValue(value, "backendSearchTerms", "backend_search_terms")),
    keywordBuckets: normalizeDisplayKeywordBuckets(value.keywordBuckets ?? value.keyword_buckets ?? {}),
    missingInfo: cleanArray(aliasValue(value, "missingInfo", "missing_info")),
    warnings: cleanArray(value.warnings),
  };
}

export function normalizeCreationListingDraft(value = {}, source = {}) {
  const keywordBuckets = normalizeKeywordBuckets(value.keywordBuckets ?? value.keyword_buckets ?? {});
  const createdAt = cleanString(value.createdAt ?? value.created_at) || new Date().toISOString();
  const zhDisplay = normalizeCreationListingDisplay(value.zhDisplay ?? value.zh_display);
  return {
    id: cleanString(value.id) || makeDraftId(source),
    marketplace: cleanString(value.marketplace) || CREATION_LISTING_MARKETPLACE,
    language: cleanString(value.language) || CREATION_LISTING_LANGUAGE,
    skuSubjectId: cleanString(aliasValue(value, "skuSubjectId", "sku_subject_id") ?? source.skuSubjectId),
    skuTitle: cleanString(aliasValue(value, "skuTitle", "sku_title") ?? source.skuTitle),
    evidenceMode: cleanString(aliasValue(value, "evidenceMode", "evidence_mode") ?? source.evidenceMode) || "input-only",
    status: cleanString(value.status) || "completed",
    title: cleanString(value.title),
    sellingPoints: cleanArray(aliasValue(value, "sellingPoints", "selling_points")),
    painPoints: cleanArray(aliasValue(value, "painPoints", "pain_points")),
    fiveBullets: cleanArray(aliasValue(value, "fiveBullets", "five_bullets")),
    description: cleanString(value.description),
    backendSearchTerms: normalizeBackendSearchTerms(aliasValue(value, "backendSearchTerms", "backend_search_terms")),
    keywordBuckets,
    evidence: cleanArray(value.evidence ?? source.evidence),
    missingInfo: cleanArray(aliasValue(value, "missingInfo", "missing_info")),
    warnings: cleanArray(value.warnings ?? source.warnings),
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

function checkUnsupportedClaims(errors, label, value) {
  const text = cleanString(value);
  for (const { label: claimLabel, pattern } of UNSUPPORTED_CLAIM_PATTERNS) {
    if (pattern.test(text)) {
      errors.push(`${label} contains unsupported claim "${claimLabel}"`);
    }
  }
}

function checkUsageScenePainPoint(errors, label, value) {
  const text = cleanString(value);
  if (SHOPPING_UNCERTAINTY_PAIN_PATTERNS.some((pattern) => pattern.test(text))) {
    errors.push(`${label} must describe a usage-scene problem, not shopping uncertainty or listing metadata`);
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

export function validateCreationListingDraft(draft = {}, options = {}) {
  const normalized = normalizeCreationListingDraft(draft);
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
  normalized.painPoints.forEach((item, index) => checkUsageScenePainPoint(errors, `painPoints[${index}]`, item));
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
    marketingCopy: cleanString(item.marketingCopy ?? item.marketing_copy),
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
  const skuSubjects = uniqueSkuSubjects(Array.isArray(set.skuSubjects) ? set.skuSubjects : []);
  const allCompletedImages = completedImageItems(set);
  const dimensionMetadata = buildListingDimensionMetadata(set);
  const referenceImageRoles = formatListingReferenceImageRolesForMode(
    Array.isArray(set.referenceImageRoles) ? set.referenceImageRoles : [],
    dimensionMetadata.dimensionUnitMode,
  );
  const compactSkuSubjects = skuSubjects.length > 0
    ? skuSubjects
      .map(compactSkuSubject)
      .map((sku) => enrichCompactSkuSubjectFromReferences(sku, referenceImageRoles))
    : buildFallbackListingSkuSubjects(referenceImageRoles);
  const evidenceMode = allCompletedImages.length > 0 ? "image-backed" : "input-only";
  const warnings = evidenceMode === "input-only"
    ? ["Generated images were unavailable; copy is based on product inputs and saved SKU metadata."]
    : [];
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
