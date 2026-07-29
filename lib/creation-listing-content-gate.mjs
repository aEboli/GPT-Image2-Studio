import { listCreationListingPolicies } from "./creation-listing-policies.mjs";

export const CREATION_LISTING_BILINGUAL_CONTENT_FIELDS = Object.freeze([
  "title",
  "sellingPoints",
  "buyerObjections",
  "highlights",
  "description",
  "searchTerms",
  "keywordBuckets",
  "packageDimensions",
  "productDimensions",
  "packageWeight",
  "productWeight",
  "warnings",
  "missingInfo",
]);

const CREATION_LISTING_BRAND_SOURCE_KEYS = new Set([
  "brand",
  "brandname",
  "brandnames",
  "trademark",
  "trademarks",
  "storename",
  "storenames",
  "shopname",
  "shopnames",
  "sellername",
  "sellernames",
  "manufacturer",
  "manufacturers",
  "manufacturername",
]);
const CREATION_LISTING_PLATFORM_ALIASES = Object.freeze([
  "Amazon", "amazon-us",
  "Taobao", "Tmall", "淘宝", "天猫", "淘宝/天猫",
  "JD", "京东", "Pinduoduo", "拼多多",
  "Douyin", "Douyin Shop", "抖音", "抖音电商",
  "Xiaohongshu", "小红书", "小红书电商",
  "Temu", "TikTok", "TikTok Shop", "tiktok-shop-us",
  "Shopee", "Lazada", "Etsy", "eBay", "Walmart",
  "Shopify", "Shopify/DTC", "AliExpress", "Rakuten",
  "Coupang", "Mercado Libre",
]);
const SAFE_PRODUCT_NAME_PREFIXES = new Set([
  "adjustable", "automatic", "black", "blue", "compact", "digital", "electric", "electronic", "fishing",
  "foldable", "gray", "green", "handheld", "handmade", "home", "indoor", "large", "long", "mini", "outdoor", "portable",
  "product", "purple", "red", "reusable", "serum", "small", "smart", "stackable", "stainless", "storage", "swimbait", "test",
  "travel", "waterproof", "white", "wireless", "yellow",
]);
const QUANTITY_PREFIX_WORDS = new Set([
  "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten",
]);
const TEXT_IDENTITY_DECLARATION_PATTERNS = Object.freeze([
  {
    signal: "sold-by",
    pattern: /\bsold\s+by\s+([\p{L}\p{N}][\p{L}\p{N}&'. -]{1,79}?)(?=[.;,|\n]|$)/giu,
  },
  {
    signal: "identity-label",
    pattern: /\b(brand(?:\s+name)?|trademark|store(?:\s+name)?|shop(?:\s+name)?|seller(?:\s+name)?)\s*[:：=-]\s*([\p{L}\p{N}][\p{L}\p{N}&'. -]{1,79}?)(?=[.;,|\n]|$)/giu,
  },
  {
    signal: "identity-label-zh",
    pattern: /(品牌|商标|店铺|商店|卖家|销售方)\s*[:：=-]\s*([^，。；|\n]{2,80}?)(?=[，。；|\n]|$)/gu,
  },
  {
    signal: "identity-suffix",
    pattern: /\b([A-Z][\p{L}\p{N}&'.-]*(?:\s+[A-Z][\p{L}\p{N}&'.-]*){0,3})\s+(brand|trademark)\b/gu,
  },
]);
const GENERIC_ZH_DISPLAY_PATTERNS = Object.freeze([
  /^(?:商品|产品)(?:信息|说明|详情|关键词)(?:\s*\d+)?[。.]?$/u,
  /^(?:第\s*)?\d+\s*(?:项)?商品信息(?:基于已提供资料)?[。.]?$/u,
  /^(?:卖点|亮点|购买疑虑|搜索词|关键词|警告|缺失信息)\s*\d+[。.]?$/u,
]);
const NON_ENGLISH_LATIN_SIGNALS = Object.freeze([
  { label: "Spanish", pattern: /\b(?:caja|azul|para|organizar|hogar|producto|productos|compra|comprar|antes|una|uno|los|las|del|con)\b/giu },
  { label: "French", pattern: /\b(?:bo[iî]te|rangement|avec|pour|produit|achat|avant|une|des|les|dans)\b/giu },
  { label: "German", pattern: /\b(?:produkt|produkte|aufbewahrung|mit|f[uü]r|vor|kauf|der|die|das)\b/giu },
  { label: "Italian", pattern: /\b(?:prodotto|prodotti|scatola|organizzare|casa|acquisto|prima|con|per|una)\b/giu },
  { label: "Portuguese", pattern: /\b(?:produto|produtos|caixa|organizar|casa|compra|antes|com|para|uma)\b/giu },
]);
const BILINGUAL_FACT_CONCEPTS = Object.freeze([
  ["blue", /\bblue\b|蓝色/iu],
  ["red", /\bred\b|红色/iu],
  ["storage", /\bstorage\b|收纳|储物/iu],
  ["box", /\bbox(?:es)?\b|盒|箱/u],
  ["stackable", /\bstackable\b|可叠放|堆叠/iu],
  ["home", /\bhome\b|家用|家居/iu],
  ["capacity", /\bcapacity\b|容量/iu],
  ["dimension", /\bdimensions?\b|尺寸/iu],
  ["check", /\bcheck\b|核对|检查/iu],
  ["purchase", /\bpurchase\b|购买/iu],
  ["product", /\bproduct\b|商品|产品/iu],
  ["information", /\binformation\b|信息|资料/iu],
  ["provided", /\b(?:provided|supplied)\b|已提供/iu],
  ["option", /\boptions?\b|选项/iu],
  ["specification", /\bspecifications?\b|规格/iu],
  ["image", /\bimages?\b|图像|图片/iu],
  ["generated", /\bgenerated\b|生成/iu],
  ["evidence", /\bevidence\b|证据/iu],
  ["unavailable", /\bunavailable\b|不可用/iu],
  ["warning", /\bwarnings?\b|警告|提示/iu],
  ["validation", /\bvalidation\b|校验|验证/iu],
  ["upstream", /\bupstream\b|上游/iu],
  ["draft", /\bdraft\b|草稿/iu],
  ["platform", /\bplatform\b|平台/iu],
  ["recommendation", /\brecommendations?\b|建议/iu],
  ["field", /\bfields?\b|字段/iu],
  ["keyword", /\bkeywords?\b|关键词/iu],
  ["travel", /\btravel\b|旅行|便携/iu],
  ["bottle", /\bbottles?\b|水瓶|瓶/u],
  ["hydration", /\bhydration\b|补水|饮水/iu],
  ["portable", /\bportable\b|便携/iu],
  ["compact", /\bcompact\b|紧凑|小巧/iu],
  ["serum", /\bserum\b|精华/u],
  ["fishing", /\bfishing\b|钓鱼/iu],
  ["lure", /\blures?\b|拟饵|鱼饵/iu],
]);

function cleanString(value) {
  return String(value ?? "").replace(/\s+/g, " ").trim();
}

function aliasValue(value, camelKey, snakeKey) {
  if (Object.prototype.hasOwnProperty.call(value, camelKey)) return value[camelKey];
  if (Object.prototype.hasOwnProperty.call(value, snakeKey)) return value[snakeKey];
  return undefined;
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

function isExpectedV2ContentType(value, field) {
  if (["title", "description", "packageDimensions", "productDimensions", "packageWeight", "productWeight"].includes(field)) return typeof value === "string";
  if (field === "keywordBuckets") return Boolean(value && typeof value === "object" && !Array.isArray(value));
  return Array.isArray(value);
}

function hasObviousNonEnglishLatinText(value) {
  const text = cleanString(value).normalize("NFKC");
  if (!text) return "";
  for (const signal of NON_ENGLISH_LATIN_SIGNALS) {
    const matches = [...text.matchAll(signal.pattern)];
    if (matches.length >= 2 || (matches.length >= 1 && /[áéíóúñü¿¡àâçèêëîïôùûüÿœäößãõ]/iu.test(text))) {
      return signal.label;
    }
  }
  return "";
}

function bilingualFactAnchors(value) {
  const text = cleanString(value).normalize("NFKC");
  const anchors = new Set();
  for (const match of text.matchAll(/\b\d+(?:\.\d+)?\b/gu)) anchors.add(`number:${match[0]}`);
  for (const match of text.matchAll(/\b(?:mm|cm|g|kg|ml|l|in|ft|oz|lb)\b|毫米|厘米|克|千克|公斤|毫升|升|英寸|英尺|盎司|磅/giu)) {
    const unit = match[0].toLocaleLowerCase("und");
    const normalizedUnit = new Map([
      ["毫米", "mm"], ["厘米", "cm"], ["克", "g"], ["千克", "kg"], ["公斤", "kg"], ["毫升", "ml"],
      ["升", "l"], ["英寸", "in"], ["英尺", "ft"], ["盎司", "oz"], ["磅", "lb"],
    ]).get(unit) || unit;
    anchors.add(`unit:${normalizedUnit}`);
  }
  for (const match of text.matchAll(/\b[A-Za-z][A-Za-z0-9+._/-]{2,}\b/gu)) {
    const token = match[0].toLocaleLowerCase("und");
    if (/\d/u.test(token) || /^[A-Z]{2,}[A-Z0-9+._/-]*$/u.test(match[0])) {
      anchors.add(`latin:${token}`);
    }
  }
  for (const [concept, pattern] of BILINGUAL_FACT_CONCEPTS) {
    if (pattern.test(text)) anchors.add(`concept:${concept}`);
  }
  return anchors;
}

function checkBilingualSemanticPair(errors, label, english, chinese) {
  const englishText = cleanString(english);
  const chineseText = cleanString(chinese);
  if (!englishText || !chineseText) return;
  if (GENERIC_ZH_DISPLAY_PATTERNS.some((pattern) => pattern.test(chineseText))) {
    errors.push(`zhDisplay.${label} uses a generic placeholder instead of a traceable counterpart`);
    return;
  }
  const englishAnchors = bilingualFactAnchors(englishText);
  const chineseAnchors = bilingualFactAnchors(chineseText);
  if (englishAnchors.size === 0) return;
  if (![...englishAnchors].some((anchor) => chineseAnchors.has(anchor))) {
    errors.push(`zhDisplay.${label} lacks a traceable fact anchor for semantic correspondence`);
  }
}

function checkV2BilingualSemanticPairs(errors, draft = {}, zhDisplay = draft.zhDisplay) {
  if (!zhDisplay || typeof zhDisplay !== "object" || Array.isArray(zhDisplay)) return;
  for (const field of ["title", "description", "packageDimensions", "productDimensions", "packageWeight", "productWeight"]) {
    checkBilingualSemanticPair(errors, field, draft[field], zhDisplay[field]);
  }
  for (const field of ["sellingPoints", "buyerObjections", "highlights", "searchTerms", "warnings", "missingInfo"]) {
    if (!Array.isArray(draft[field]) || !Array.isArray(zhDisplay[field])) continue;
    const count = Math.min(draft[field].length, zhDisplay[field].length);
    for (let index = 0; index < count; index += 1) {
      checkBilingualSemanticPair(errors, `${field}[${index}]`, draft[field][index], zhDisplay[field][index]);
    }
  }
  const englishBuckets = draft.keywordBuckets && typeof draft.keywordBuckets === "object" ? draft.keywordBuckets : {};
  const chineseBuckets = zhDisplay.keywordBuckets && typeof zhDisplay.keywordBuckets === "object" ? zhDisplay.keywordBuckets : {};
  for (const bucket of ["exact", "longTail", "traffic", "descriptive"]) {
    if (!Array.isArray(englishBuckets[bucket]) || !Array.isArray(chineseBuckets[bucket])) continue;
    const count = Math.min(englishBuckets[bucket].length, chineseBuckets[bucket].length);
    for (let index = 0; index < count; index += 1) {
      checkBilingualSemanticPair(
        errors,
        `keywordBuckets.${bucket}[${index}]`,
        englishBuckets[bucket][index],
        chineseBuckets[bucket][index],
      );
    }
  }
}

function hasNonEmptyPublishValue(value) {
  if (typeof value === "string") return Boolean(cleanString(value));
  if (Array.isArray(value)) return value.length > 0 && value.every((item) => Boolean(cleanString(item)));
  if (value && typeof value === "object") {
    const values = Object.values(value);
    return values.length > 0 && values.some((item) => Array.isArray(item)
      ? item.some((entry) => Boolean(cleanString(entry)))
      : Boolean(cleanString(item)));
  }
  return false;
}

export function getCreationListingPublishFieldErrors(draft = {}) {
  if (cleanString(draft.status).toLowerCase() !== "completed") return [];
  const errors = [];
  const publishFields = Array.isArray(draft.publishFields)
    ? draft.publishFields.map(cleanString).filter(Boolean)
    : [];
  if (publishFields.length === 0) {
    errors.push("completed draft must freeze at least one publishFields entry");
    return errors;
  }
  const zhDisplay = draft.zhDisplay || draft.zh_display || {};
  for (const field of publishFields) {
    if (!CREATION_LISTING_BILINGUAL_CONTENT_FIELDS.includes(field)
      || !hasNonEmptyPublishValue(draft[field])
      || !hasNonEmptyPublishValue(zhDisplay[field])) {
      errors.push(`completed draft publishFields entry ${field} must not be empty in either language`);
    }
  }
  return errors;
}

function normalizedForbiddenTermKey(value) {
  return cleanString(value).normalize("NFKC").toLocaleLowerCase("und");
}

function addForbiddenTerm(terms, seen, value) {
  const text = cleanString(value).normalize("NFKC");
  const key = normalizedForbiddenTermKey(text);
  if (text.length < 2 || !key || seen.has(key)) return;
  seen.add(key);
  terms.push(text);
}

function addForbiddenTermCandidate(candidates, indexes, value, provenance, confidence = "declared") {
  const term = cleanString(value).normalize("NFKC");
  const key = normalizedForbiddenTermKey(term);
  if (term.length < 2 || !key) return;
  let candidate = indexes.get(key);
  if (!candidate) {
    candidate = { term, confidence, provenance: [] };
    indexes.set(key, candidate);
    candidates.push(candidate);
  }
  const source = cleanString(provenance);
  if (source && !candidate.provenance.includes(source)) candidate.provenance.push(source);
}

function collectStructuredForbiddenTermCandidates(value, candidates, indexes, path = "source") {
  if (!value || typeof value !== "object") return;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStructuredForbiddenTermCandidates(item, candidates, indexes, `${path}[${index}]`));
    return;
  }
  for (const [key, item] of Object.entries(value)) {
    const nextPath = `${path}.${key}`;
    const normalizedKey = key.replace(/[^a-z]/gi, "").toLowerCase();
    if (CREATION_LISTING_BRAND_SOURCE_KEYS.has(normalizedKey)) {
      const values = Array.isArray(item) ? item : [item];
      values.forEach((entry, index) => {
        if (entry && typeof entry === "object") {
          collectStructuredForbiddenTermCandidates(entry, candidates, indexes, `${nextPath}[${index}]`);
        } else {
          addForbiddenTermCandidate(candidates, indexes, entry, `${nextPath}:structured`);
        }
      });
    }
    collectStructuredForbiddenTermCandidates(item, candidates, indexes, nextPath);
  }
}

function collectTextIdentityCandidates(value, candidates, indexes, path = "source") {
  if (typeof value === "string") {
    const text = cleanString(value).normalize("NFKC");
    for (const declaration of TEXT_IDENTITY_DECLARATION_PATTERNS) {
      for (const match of text.matchAll(declaration.pattern)) {
        const label = cleanString(match[1]).toLowerCase();
        const captured = declaration.signal === "sold-by"
          ? match[1]
          : declaration.signal === "identity-suffix"
            ? match[1]
            : match[2];
        const translatedLabel = new Map([
          ["品牌", "brand"], ["商标", "trademark"], ["店铺", "store"], ["商店", "store"],
          ["卖家", "seller"], ["销售方", "seller"],
        ]).get(label) || label;
        const signal = declaration.signal.startsWith("identity-label") && translatedLabel
          ? translatedLabel.replace(/\s+/g, "-")
          : declaration.signal;
        addForbiddenTermCandidate(candidates, indexes, captured, `${path}:${signal}`);
      }
    }
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectTextIdentityCandidates(item, candidates, indexes, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === "object") {
    Object.entries(value).forEach(([key, item]) => collectTextIdentityCandidates(item, candidates, indexes, `${path}.${key}`));
  }
}

function productNamePrefixCandidate(value) {
  const text = cleanString(value).normalize("NFKC");
  const [first = "", second = ""] = text.split(/\s+/u);
  const normalized = first.replace(/[^\p{L}\p{N}&'.-]/gu, "").toLocaleLowerCase("und");
  if (
    !second
    || normalized.length < 3
    || SAFE_PRODUCT_NAME_PREFIXES.has(normalized)
    || QUANTITY_PREFIX_WORDS.has(normalized)
    || /^\d/u.test(normalized)
    || !/^\p{Lu}[\p{L}\p{N}&'.-]*$/u.test(first)
  ) {
    return "";
  }
  return first;
}

export function extractCreationListingForbiddenTermCandidates(source = {}) {
  const candidates = [];
  const indexes = new Map();
  collectStructuredForbiddenTermCandidates(source, candidates, indexes);
  collectTextIdentityCandidates(source, candidates, indexes);
  const skuTitlePath = Object.prototype.hasOwnProperty.call(source, "skuTitle")
    ? "source.skuTitle"
    : "source.sku_title";
  const zhDisplay = source.zhDisplay || source.zh_display;
  for (const { value, path } of [
    { value: source.productName, path: "source.productName" },
    { value: aliasValue(source, "skuTitle", "sku_title"), path: skuTitlePath },
    { value: source.title, path: "source.title" },
    { value: zhDisplay?.title, path: "source.zhDisplay.title" },
  ]) {
    const prefix = productNamePrefixCandidate(value);
    if (prefix) addForbiddenTermCandidate(candidates, indexes, prefix, `${path}:prefix`, "conservative-prefix");
  }
  const supplied = Array.isArray(source?.forbiddenTerms) ? source.forbiddenTerms : [];
  supplied.forEach((value, index) => addForbiddenTermCandidate(
    candidates,
    indexes,
    value,
    `source.forbiddenTerms[${index}]:supplied`,
  ));
  return candidates;
}

export function extractCreationListingForbiddenTerms(source = {}) {
  const terms = [];
  const seen = new Set();
  extractCreationListingForbiddenTermCandidates(source)
    .forEach((candidate) => addForbiddenTerm(terms, seen, candidate.term));
  for (const policy of listCreationListingPolicies()) {
    for (const value of [policy.id, policy.platformId, policy.label, policy.platformLabel, policy.marketplaceId]) {
      addForbiddenTerm(terms, seen, value);
      cleanString(value).split(/[\/|]/u).forEach((part) => addForbiddenTerm(terms, seen, part));
    }
  }
  CREATION_LISTING_PLATFORM_ALIASES.forEach((value) => addForbiddenTerm(terms, seen, value));
  const supplied = Array.isArray(source?.forbiddenTerms) ? source.forbiddenTerms : [];
  supplied.forEach((value) => addForbiddenTerm(terms, seen, value));
  return terms.sort((left, right) => Array.from(right).length - Array.from(left).length);
}

function escapeForbiddenTerm(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function forbiddenTermPattern(value, global = false) {
  const escaped = escapeForbiddenTerm(cleanString(value).normalize("NFKC"));
  const hasCjk = /[\u3400-\u9fff]/u.test(escaped);
  const source = hasCjk
    ? escaped
    : `(?<![\\p{Script=Latin}\\p{N}])${escaped}(?![\\p{Script=Latin}\\p{N}])`;
  return new RegExp(source, global ? "giu" : "iu");
}

function restoreCjkPunctuation(value) {
  if (!/[\u3400-\u9fff]/u.test(value)) return value;
  const punctuation = new Map([[",", "，"], [";", "；"], [":", "："]]);
  return value.replace(
    /(?<=[\u3400-\u9fff])[,;:]|[,;:](?=[\u3400-\u9fff])/gu,
    (character) => punctuation.get(character) || character,
  );
}

function sanitizeNoBrandString(value, forbiddenTerms) {
  let text = cleanString(value).normalize("NFKC");
  for (const term of forbiddenTerms) {
    text = text.replace(forbiddenTermPattern(term, true), " ");
  }
  const sanitized = text
    .replace(/\s+([,.;:!?，。；：！？])/gu, "$1")
    .replace(/(?:^|\s)[\-|]+(?=\s|$)/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[,.;:!?，。；：！？\-|/\s]+|[,.;:!?，。；：！？\-|/\s]+$/gu, "")
    .trim();
  return restoreCjkPunctuation(sanitized);
}

export function sanitizeCreationListingNoBrandContent(value, forbiddenTerms = []) {
  const terms = Array.isArray(forbiddenTerms) ? forbiddenTerms.filter((term) => cleanString(term)) : [];
  if (typeof value === "string") return sanitizeNoBrandString(value, terms);
  if (Array.isArray(value)) return value.map((item) => sanitizeCreationListingNoBrandContent(item, terms));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [
      key,
      sanitizeCreationListingNoBrandContent(item, terms),
    ]));
  }
  return value;
}

export function projectCreationListingContent(draft = {}) {
  return Object.fromEntries(CREATION_LISTING_BILINGUAL_CONTENT_FIELDS
    .filter((field) => Object.prototype.hasOwnProperty.call(draft, field))
    .map((field) => [field, draft[field]]));
}

export function sanitizeCreationListingDraftContent(draft = {}, source = {}) {
  const forbiddenTerms = extractCreationListingForbiddenTerms({ ...draft, ...source });
  const sanitized = sanitizeCreationListingNoBrandContent(projectCreationListingContent(draft), forbiddenTerms);
  const rawSkuTitle = aliasValue(draft, "skuTitle", "sku_title") ?? source.skuTitle;
  const rawSkuSubjectId = aliasValue(draft, "skuSubjectId", "sku_subject_id") ?? source.skuSubjectId;
  const zhDisplay = draft.zhDisplay && typeof draft.zhDisplay === "object"
    ? sanitizeCreationListingNoBrandContent(projectCreationListingContent(draft.zhDisplay), forbiddenTerms)
    : draft.zhDisplay;
  return {
    ...draft,
    ...sanitized,
    ...(rawSkuTitle === undefined
      ? {}
      : { skuTitle: sanitizeCreationListingNoBrandContent(rawSkuTitle, forbiddenTerms) }),
    ...(rawSkuSubjectId === undefined
      ? {}
      : { skuSubjectId: sanitizeCreationListingNoBrandContent(rawSkuSubjectId, forbiddenTerms) }),
    ...(zhDisplay === undefined ? {} : { zhDisplay: { ...draft.zhDisplay, ...zhDisplay } }),
  };
}

export function findCreationListingForbiddenTermMatches(value, forbiddenTerms = [], path = "") {
  const matches = [];
  if (typeof value === "string") {
    for (const term of forbiddenTerms) {
      if (forbiddenTermPattern(term).test(value.normalize("NFKC"))) {
        matches.push({ path, term });
      }
    }
  } else if (Array.isArray(value)) {
    value.forEach((item, index) => matches.push(...findCreationListingForbiddenTermMatches(
      item,
      forbiddenTerms,
      `${path}[${index}]`,
    )));
  } else if (value && typeof value === "object") {
    for (const [key, item] of Object.entries(value)) {
      matches.push(...findCreationListingForbiddenTermMatches(
        item,
        forbiddenTerms,
        path ? `${path}.${key}` : key,
      ));
    }
  }
  return matches;
}

export function validateCreationListingPersistedV2Content(draft = {}, source = {}, options = {}) {
  const errors = [];
  const zhDisplay = draft.zhDisplay || draft.zh_display;
  for (const field of CREATION_LISTING_BILINGUAL_CONTENT_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(draft, field) || !isExpectedV2ContentType(draft[field], field)) {
      errors.push(`${field} is required with the V2 content type`);
    }
  }
  if (!zhDisplay || typeof zhDisplay !== "object" || Array.isArray(zhDisplay)) {
    errors.push("zhDisplay is required for the V2 bilingual draft");
  } else {
    if (!cleanString(draft.title)) errors.push("title must not be empty in a completed V2 draft");
    if (!cleanString(draft.description)) errors.push("description must not be empty in a completed V2 draft");
    const englishContent = collectTextValues(projectCreationListingContent(draft)).join(" ");
    if (/[\u3040-\u30ff\u3400-\u9fff\uac00-\ud7af]/u.test(englishContent)) {
      errors.push("top-level V2 content fields must be English");
    }
    const nonEnglishLanguage = hasObviousNonEnglishLatinText(englishContent);
    if (nonEnglishLanguage) {
      errors.push(`top-level V2 content fields must be English; detected obvious ${nonEnglishLanguage} copy`);
    }
    for (const field of CREATION_LISTING_BILINGUAL_CONTENT_FIELDS) {
      if (!Object.prototype.hasOwnProperty.call(zhDisplay, field) || !isExpectedV2ContentType(zhDisplay[field], field)) {
        errors.push(`zhDisplay.${field} is required with the same V2 content type as ${field}`);
        continue;
      }
      if (Array.isArray(draft[field]) && zhDisplay[field].length !== draft[field].length) {
        errors.push(`zhDisplay.${field} must contain the same number of ordered items as ${field}`);
      }
    }
    const englishBuckets = draft.keywordBuckets && typeof draft.keywordBuckets === "object" ? draft.keywordBuckets : {};
    const chineseBuckets = zhDisplay.keywordBuckets && typeof zhDisplay.keywordBuckets === "object"
      ? zhDisplay.keywordBuckets
      : {};
    for (const bucket of ["exact", "longTail", "traffic", "descriptive"]) {
      if (!Array.isArray(englishBuckets[bucket])) errors.push(`keywordBuckets.${bucket} must be an array`);
      if (!Array.isArray(chineseBuckets[bucket])) {
        errors.push(`zhDisplay.keywordBuckets.${bucket} must be an array`);
      } else if (Array.isArray(englishBuckets[bucket]) && chineseBuckets[bucket].length !== englishBuckets[bucket].length) {
        errors.push(`zhDisplay.keywordBuckets.${bucket} must contain the same number of ordered items as keywordBuckets.${bucket}`);
      }
    }
    if (!cleanString(zhDisplay.title)) errors.push("zhDisplay.title must not be empty");
    if (!cleanString(zhDisplay.description)) errors.push("zhDisplay.description must not be empty");
    const chineseContent = collectTextValues(projectCreationListingContent(zhDisplay)).join(" ");
    if (chineseContent && !/[\u3400-\u9fff]/u.test(chineseContent)) {
      errors.push("zhDisplay content fields must provide Simplified Chinese counterparts");
    }
    checkV2BilingualSemanticPairs(errors, draft, zhDisplay);
  }

  if (options.requirePublishFields !== false) {
    errors.push(...getCreationListingPublishFieldErrors(draft));
  }

  const forbiddenTerms = extractCreationListingForbiddenTerms({ ...draft, ...source });
  const content = {
    id: draft.id,
    skuSubjectId: draft.skuSubjectId,
    skuTitle: draft.skuTitle,
    ...projectCreationListingContent(draft),
    ...(zhDisplay && typeof zhDisplay === "object" && !Array.isArray(zhDisplay)
      ? { zhDisplay: projectCreationListingContent(zhDisplay) }
      : {}),
  };
  errors.push(...findCreationListingForbiddenTermMatches(content, forbiddenTerms)
    .map(({ path, term }) => `${path} contains forbidden brand, store, seller, trademark, or platform term "${term}"`));

  return { ok: errors.length === 0, errors };
}
