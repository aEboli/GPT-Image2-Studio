export const CREATION_LISTING_POLICY_VERSION = "listing-policy-2026-07-15.v2";

const VERIFIED_AT = "2026-07-15";

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function clonePolicyData(value) {
  if (value === undefined) return undefined;
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value));
}

function cleanString(value) {
  return String(value ?? "").trim();
}

function source(id, label, url, scope, metadata = {}) {
  return { id, label, url, scope, authority: "official", verifiedAt: VERIFIED_AT, ...metadata };
}

export const CREATION_LISTING_SOURCE_REGISTER = deepFreeze({
  "advertising-law-truthfulness": source(
    "advertising-law-truthfulness",
    "中华人民共和国广告法",
    "https://www.samr.gov.cn/zw/zfxxgk/fdzdgknr/fgs/art/2023/art_5474cf75173c45d6a0379730fb4e8d97.html",
    "Cross-platform truthfulness and non-misleading advertising baseline.",
  ),
  "amazon-title-rules": source(
    "amazon-title-rules",
    "Amazon product title requirements",
    "https://sellercentral.amazon.com/help/hub/reference/external/GYTR6SYGFA5E3EQC",
    "Amazon title structure and verified character limit.",
  ),
  "amazon-title-75-effective-2026-07-27": source(
    "amazon-title-75-effective-2026-07-27",
    "Amazon 75-character title limit announcement",
    "https://sellercentral.amazon.com/seller-forums/discussions/t/145b6d0f-999c-4555-896c-c694bda2e470",
    "Amazon announcement that the 75-character title limit takes effect on 2026-07-27.",
    { effectiveFrom: "2026-07-27" },
  ),
  "amazon-highlight-rules": source(
    "amazon-highlight-rules",
    "Amazon bullet point requirements",
    "https://sellercentral.amazon.com/help/hub/reference/external/GX5L8BF8GLMML6CX",
    "Amazon bullet count and per-bullet character limits.",
  ),
  "tiktok-shop-title-rules": source(
    "tiktok-shop-title-rules",
    "TikTok Shop product title requirements",
    "https://seller-us.tiktok.com/university/essay?knowledge_id=7073362639816491",
    "TikTok Shop product title length and identification guidance.",
  ),
  "tiktok-shop-product-info": source(
    "tiktok-shop-product-info",
    "TikTok Shop product information policy",
    "https://seller-us.tiktok.com/university/essay?knowledge_id=3196690250417921",
    "TikTok Shop accurate product information requirements.",
  ),
  "etsy-title-tags": source(
    "etsy-title-tags",
    "Etsy keywords in titles and tags",
    "https://www.etsy.com/seller-handbook/article/382774281517",
    "Etsy title and tag search guidance.",
  ),
  "etsy-tag-guidance": source(
    "etsy-tag-guidance",
    "Etsy tag guidance",
    "https://www.etsy.com/seller-handbook/article/1399426136697",
    "Etsy tag selection guidance.",
  ),
  "etsy-description-guidance": source(
    "etsy-description-guidance",
    "Etsy description search guidance",
    "https://www.etsy.com/seller-handbook/article/1347574487014",
    "Etsy natural keyword placement in descriptions.",
  ),
  "ebay-listing-best-practices": source(
    "ebay-listing-best-practices",
    "eBay listing best practices",
    "https://www.ebay.com/sellercenter/listings/create-listings/best-practices",
    "eBay title limit, identifying attributes, and Item Specifics guidance.",
  ),
  "walmart-product-detail": source(
    "walmart-product-detail",
    "Walmart Product Detail Page overview",
    "https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20content,%20imagery,%20and%20media/Product-Detail-Page:-overview",
    "Walmart Item Name, Description, and Key Features field purposes.",
  ),
  "walmart-keyword-optimization": source(
    "walmart-keyword-optimization",
    "Walmart keyword optimization",
    "https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20content,%20imagery,%20and%20media/Keyword-optimization",
    "Walmart marketplace keyword guidance.",
  ),
  "shopify-product-descriptions": source(
    "shopify-product-descriptions",
    "Shopify product description guidance",
    "https://help.shopify.com/en/manual/products/details/product-descriptions/write",
    "Shopify benefit summaries and detailed product specifications.",
  ),
  "shopify-seo-keywords": source(
    "shopify-seo-keywords",
    "Shopify SEO keyword guidance",
    "https://help.shopify.com/en/manual/promoting-marketing/seo/adding-keywords",
    "Shopify unique SEO title, meta description, and natural keywords.",
  ),
  "taobao-product-api": source(
    "taobao-product-api",
    "淘宝商品发布官方文档",
    "https://open.taobao.com/doc.htm?docId=119447&docType=1",
    "Taobao product publication fields and category-dependent attributes.",
  ),
  "jd-product-create-api": source(
    "jd-product-create-api",
    "京东商品创建 API",
    "https://jos.jd.com/apilist?apiGroupId=48&apiId=13420&apiName=jingdong.ware.write.add",
    "JD product publication fields and SKU consistency.",
  ),
  "pdd-product-create-api": source(
    "pdd-product-create-api",
    "拼多多商品创建 API",
    "https://open.pinduoduo.com/application/document/api?id=pdd.goods.add",
    "Pinduoduo product publication fields and category attributes.",
  ),
  "douyin-product-create-api": source(
    "douyin-product-create-api",
    "抖音电商商品创建 API",
    "https://op.jinritemai.com/docs/api-docs/14/249",
    "Douyin ecommerce product publication fields.",
  ),
  "douyin-product-quality-api": source(
    "douyin-product-quality-api",
    "抖音电商商品发布前质检 API",
    "https://op.jinritemai.com/docs/api-docs/14/1373",
    "Douyin pre-publication product information checks.",
  ),
  "xiaohongshu-product-api": source(
    "xiaohongshu-product-api",
    "小红书商品发布 API",
    "https://open.xiaohongshu.com/document/api?apiNavigationId=65&id=12&gatewayId=103&gatewayVersionId=1661&apiId=6487&apiParentNavigationId=14",
    "Xiaohongshu product fields and category attributes.",
  ),
  "shopee-description-my": source(
    "shopee-description-my",
    "Shopee product description guidance",
    "https://seller.shopee.com.my/edu/article/2222",
    "Shopee seller education for product descriptions.",
  ),
  "shopee-description-sg": source(
    "shopee-description-sg",
    "Shopee product description best practices",
    "https://seller.shopee.sg/edu/article/87/product-descriptions-best-practices",
    "Shopee seller education for clear product descriptions.",
  ),
  "lazada-product-api": source(
    "lazada-product-api",
    "Lazada product API documentation",
    "https://open.lazada.com/apps/doc/doc?nodeId=30715&docId=120946",
    "Lazada product fields and category attributes.",
  ),
  "rakuten-product-manual": source(
    "rakuten-product-manual",
    "Rakuten RMS product manual",
    "https://navi-manual.faq.rakuten.net/",
    "Rakuten product registration and marketplace content guidance.",
  ),
  "coupang-product-creation": source(
    "coupang-product-creation",
    "Coupang Product Creation",
    "https://developers.coupangcorp.com/hc/en-us/articles/360033877853-Product-Creation",
    "Coupang product name and search tag limits.",
  ),
});

const COMMON_CONVERSION_STEPS = [
  "product-identity",
  "factual-benefits",
  "real-use-context",
  "buyer-objections",
  "size-fit-variants-package",
  "missing-evidence-disclosure",
];

export const CREATION_LISTING_ARCHETYPES = deepFreeze({
  universal: {
    id: "universal",
    conversionOrder: COMMON_CONVERSION_STEPS,
    titlePattern: ["product-identity", "key-factual-attribute"],
    tone: "clear-factual",
  },
  search: {
    id: "search",
    conversionOrder: ["search-intent", "product-identity", "factual-differentiators", "use-context", "specifications", "package-clarity"],
    titlePattern: ["brand-if-supplied", "product-type", "model-or-variant", "key-factual-attribute"],
    tone: "specific-searchable",
  },
  value: {
    id: "value",
    conversionOrder: ["product-identity", "bundle-or-variant-clarity", "factual-benefits", "size-fit", "use-context", "package-clarity"],
    titlePattern: ["product-type", "variant-or-quantity-if-supplied", "key-factual-benefit"],
    tone: "direct-value-focused",
  },
  content: {
    id: "content",
    conversionOrder: ["non-sensational-hook", "product-identity", "real-use-context", "factual-proof", "buyer-objections", "variant-clarity"],
    titlePattern: ["product-identity", "real-use-outcome", "key-factual-attribute"],
    tone: "native-concise-authentic",
  },
  brand: {
    id: "brand",
    conversionOrder: ["product-identity", "craft-or-brand-context", "factual-benefits", "details", "real-use-context", "gift-or-trust-context"],
    titlePattern: ["distinct-product-identity", "craft-or-style-if-supported", "key-factual-attribute"],
    tone: "distinctive-human-factual",
  },
});

const CLAIM_RISK_GROUPS = [
  "materials-and-certifications",
  "medical-health-and-safety",
  "compatibility-durability-and-performance",
  "rankings-sales-and-reviews",
  "prices-discounts-warranties-and-refunds",
  "absolute-or-comparative-claims",
];

const BASE_TITLE_RULES = {
  label: "Title",
  purpose: "Identify the product and supported search intent.",
  hardMinChars: null,
  hardMaxChars: null,
  hardMinUtf8Bytes: null,
  hardMaxUtf8Bytes: null,
  recommendedMinChars: 35,
  recommendedMaxChars: 75,
  hardConstraintSourceIds: [],
  recommendationSourceIds: [],
};

const BASE_HIGHLIGHT_RULES = {
  label: "Highlights",
  purpose: "Present supported benefits, use, fit, variants, and package facts.",
  format: "plain-list",
  hardMinItems: null,
  hardMaxItems: null,
  hardMinCharsPerItem: null,
  hardMaxCharsPerItem: null,
  hardMinUtf8BytesPerItem: null,
  hardMaxUtf8BytesPerItem: null,
  recommendedMinItems: 3,
  recommendedMaxItems: 6,
  recommendedMaxCharsPerItem: 180,
  hardConstraintSourceIds: [],
  recommendationSourceIds: [],
};

const BASE_DESCRIPTION_RULES = {
  label: "Description",
  purpose: "Explain factual benefits, real use, specifications, variants, and package contents.",
  format: "short-paragraphs",
  hardMinChars: null,
  hardMaxChars: null,
  hardMinUtf8Bytes: null,
  hardMaxUtf8Bytes: null,
  recommendedMinChars: 120,
  recommendedMaxChars: 1200,
  hardConstraintSourceIds: [],
  recommendationSourceIds: [],
};

const BASE_SEARCH_RULES = {
  label: "Keyword suggestions",
  purpose: "Provide relevant search phrases for review.",
  surface: "advisory-keywords",
  publishable: false,
  hardMinItems: null,
  hardMaxItems: null,
  hardMinCharsPerItem: null,
  hardMaxCharsPerItem: null,
  hardMinUtf8BytesPerItem: null,
  hardMaxUtf8BytesPerItem: null,
  recommendedMinItems: 5,
  recommendedMaxItems: 12,
  hardConstraintSourceIds: [],
  recommendationSourceIds: [],
};

function mergeRules(base, override = {}) {
  return { ...base, ...override };
}

function definePolicy({
  id,
  label,
  marketplaceId,
  defaultLocale,
  archetypeId,
  evidenceLevel,
  sourceIds = [],
  titleRules,
  highlightRules,
  descriptionRules,
  searchRules,
  conversionOrder,
  variantStrategy = "mention-only-supplied-variants",
  publishFields,
}) {
  const archetype = CREATION_LISTING_ARCHETYPES[archetypeId];
  const resolvedSearchRules = mergeRules(BASE_SEARCH_RULES, searchRules);
  const resolvedPublishFields = Array.isArray(publishFields)
    ? [...publishFields]
    : [
      "title",
      "highlights",
      "description",
      ...(resolvedSearchRules.publishable === true ? ["searchTerms"] : []),
    ];
  return {
    id,
    label,
    marketplaceId,
    defaultLocale,
    policyVersion: CREATION_LISTING_POLICY_VERSION,
    verifiedAt: VERIFIED_AT,
    evidenceLevel,
    sourceIds: ["advertising-law-truthfulness", ...sourceIds],
    archetypeId,
    titleRules: mergeRules(BASE_TITLE_RULES, titleRules),
    highlightRules: mergeRules(BASE_HIGHLIGHT_RULES, highlightRules),
    descriptionRules: mergeRules(BASE_DESCRIPTION_RULES, descriptionRules),
    searchRules: resolvedSearchRules,
    conversionOrder: conversionOrder || archetype.conversionOrder,
    variantStrategy,
    claimRiskGroups: CLAIM_RISK_GROUPS,
    publishFields: resolvedPublishFields,
    internalFields: [
      "sellingPoints",
      "buyerObjections",
      ...(resolvedSearchRules.publishable === true ? [] : ["searchTerms"]),
      "keywordBuckets",
      "evidence",
      "missingInfo",
      "warnings",
    ],
    fallback: {
      mode: "conservative-recommendation",
      configurable: true,
      reviewRequired: true,
      readyToPublishGuarantee: false,
    },
  };
}

const POLICY_DEFINITIONS = [
  definePolicy({ id: "universal", label: "通用电商", marketplaceId: "universal", defaultLocale: "en-US", archetypeId: "universal", evidenceLevel: "A" }),
  definePolicy({
    id: "amazon", label: "Amazon", marketplaceId: "amazon-us", defaultLocale: "en-US", archetypeId: "search", evidenceLevel: "A",
    sourceIds: ["amazon-title-rules", "amazon-title-75-effective-2026-07-27", "amazon-highlight-rules"],
    titleRules: { hardMaxChars: 75, effectiveFrom: "2026-07-27", recommendedMinChars: 50, recommendedMaxChars: 75, hardConstraintSourceIds: ["amazon-title-75-effective-2026-07-27"] },
    highlightRules: { label: "Bullet points", hardMinItems: 3, hardMinCharsPerItem: 10, hardMaxCharsPerItem: 255, recommendedMinItems: 3, recommendedMaxItems: 5, hardConstraintSourceIds: ["amazon-highlight-rules"] },
    searchRules: { label: "Backend search terms", surface: "backend-keywords", publishable: true },
  }),
  definePolicy({ id: "tmall-taobao", label: "淘宝/天猫", marketplaceId: "tmall-taobao", defaultLocale: "zh-CN", archetypeId: "value", evidenceLevel: "B", sourceIds: ["taobao-product-api"], titleRules: { label: "商品标题", recommendationSourceIds: ["taobao-product-api"] }, highlightRules: { label: "核心卖点" }, descriptionRules: { label: "商品描述" }, searchRules: { label: "搜索词建议" } }),
  definePolicy({ id: "jd", label: "京东", marketplaceId: "jd", defaultLocale: "zh-CN", archetypeId: "search", evidenceLevel: "B", sourceIds: ["jd-product-create-api"], titleRules: { label: "商品名称", recommendationSourceIds: ["jd-product-create-api"] }, highlightRules: { label: "卖点" }, descriptionRules: { label: "商品介绍" }, searchRules: { label: "搜索词建议" } }),
  definePolicy({ id: "pdd", label: "拼多多", marketplaceId: "pdd", defaultLocale: "zh-CN", archetypeId: "value", evidenceLevel: "B", sourceIds: ["pdd-product-create-api"], titleRules: { label: "商品标题", recommendationSourceIds: ["pdd-product-create-api"] }, highlightRules: { label: "商品卖点" }, descriptionRules: { label: "商品描述" }, searchRules: { label: "搜索词建议" } }),
  definePolicy({ id: "douyin", label: "抖音电商", marketplaceId: "douyin", defaultLocale: "zh-CN", archetypeId: "content", evidenceLevel: "B", sourceIds: ["douyin-product-create-api", "douyin-product-quality-api"], titleRules: { label: "商品标题", recommendationSourceIds: ["douyin-product-create-api"] }, highlightRules: { label: "内容亮点" }, descriptionRules: { label: "商品描述" }, searchRules: { label: "搜索词建议" } }),
  definePolicy({ id: "xiaohongshu", label: "小红书电商", marketplaceId: "xiaohongshu", defaultLocale: "zh-CN", archetypeId: "content", evidenceLevel: "B", sourceIds: ["xiaohongshu-product-api"], titleRules: { label: "商品标题", recommendationSourceIds: ["xiaohongshu-product-api"] }, highlightRules: { label: "种草亮点" }, descriptionRules: { label: "商品描述" }, searchRules: { label: "搜索词建议" } }),
  definePolicy({ id: "temu", label: "Temu", marketplaceId: "temu", defaultLocale: "en-US", archetypeId: "value", evidenceLevel: "C" }),
  definePolicy({
    id: "tiktok-shop", label: "TikTok Shop", marketplaceId: "tiktok-shop-us", defaultLocale: "en-US", archetypeId: "content", evidenceLevel: "A",
    sourceIds: ["tiktok-shop-title-rules", "tiktok-shop-product-info"],
    titleRules: { hardMinChars: 25, hardMaxChars: 200, recommendedMinChars: 35, recommendedMaxChars: 100, hardConstraintSourceIds: ["tiktok-shop-title-rules"] },
    highlightRules: { label: "Key product information", recommendationSourceIds: ["tiktok-shop-product-info"] },
  }),
  definePolicy({ id: "shopee", label: "Shopee", marketplaceId: "shopee", defaultLocale: "en-US", archetypeId: "value", evidenceLevel: "A", sourceIds: ["shopee-description-my", "shopee-description-sg"], descriptionRules: { recommendationSourceIds: ["shopee-description-my", "shopee-description-sg"] } }),
  definePolicy({ id: "lazada", label: "Lazada", marketplaceId: "lazada", defaultLocale: "en-US", archetypeId: "value", evidenceLevel: "B", sourceIds: ["lazada-product-api"], titleRules: { recommendationSourceIds: ["lazada-product-api"] } }),
  definePolicy({
    id: "etsy", label: "Etsy", marketplaceId: "etsy", defaultLocale: "en-US", archetypeId: "brand", evidenceLevel: "A",
    sourceIds: ["etsy-title-tags", "etsy-tag-guidance", "etsy-description-guidance"],
    titleRules: { recommendationSourceIds: ["etsy-title-tags"] },
    descriptionRules: { recommendationSourceIds: ["etsy-description-guidance"] },
    searchRules: { label: "Tags", purpose: "Provide relevant Etsy tag candidates for review.", surface: "tags", publishable: true, recommendationSourceIds: ["etsy-title-tags", "etsy-tag-guidance"] },
  }),
  definePolicy({
    id: "ebay", label: "eBay", marketplaceId: "ebay", defaultLocale: "en-US", archetypeId: "search", evidenceLevel: "A", sourceIds: ["ebay-listing-best-practices"],
    titleRules: { hardMaxChars: 80, recommendedMinChars: 55, recommendedMaxChars: 80, hardConstraintSourceIds: ["ebay-listing-best-practices"] },
    highlightRules: { label: "Item specifics highlights", recommendationSourceIds: ["ebay-listing-best-practices"] },
    searchRules: { label: "Item Specifics and search phrases", surface: "item-specifics-and-visible-search", recommendationSourceIds: ["ebay-listing-best-practices"] },
  }),
  definePolicy({
    id: "walmart", label: "Walmart", marketplaceId: "walmart", defaultLocale: "en-US", archetypeId: "search", evidenceLevel: "A", sourceIds: ["walmart-product-detail", "walmart-keyword-optimization"],
    titleRules: { label: "Item Name", recommendationSourceIds: ["walmart-product-detail"] },
    highlightRules: { label: "Key Features", recommendationSourceIds: ["walmart-product-detail"] },
    searchRules: { label: "Marketplace keywords", surface: "keyword-optimization", recommendationSourceIds: ["walmart-keyword-optimization"] },
  }),
  definePolicy({
    id: "shopify", label: "Shopify/DTC", marketplaceId: "shopify", defaultLocale: "en-US", archetypeId: "brand", evidenceLevel: "A", sourceIds: ["shopify-product-descriptions", "shopify-seo-keywords"],
    titleRules: { label: "Product and SEO title", recommendationSourceIds: ["shopify-seo-keywords"] },
    descriptionRules: { recommendationSourceIds: ["shopify-product-descriptions"] },
    searchRules: { label: "SEO keywords", surface: "seo-keywords", recommendationSourceIds: ["shopify-seo-keywords"] },
  }),
  definePolicy({ id: "aliexpress", label: "AliExpress", marketplaceId: "aliexpress", defaultLocale: "en-US", archetypeId: "value", evidenceLevel: "C" }),
  definePolicy({ id: "rakuten", label: "Rakuten", marketplaceId: "rakuten", defaultLocale: "ja-JP", archetypeId: "search", evidenceLevel: "B", sourceIds: ["rakuten-product-manual"], titleRules: { label: "商品名", recommendationSourceIds: ["rakuten-product-manual"] }, highlightRules: { label: "商品特徴" }, descriptionRules: { label: "商品説明" }, searchRules: { label: "検索キーワード候補" } }),
  definePolicy({
    id: "coupang", label: "Coupang", marketplaceId: "coupang", defaultLocale: "ko-KR", archetypeId: "search", evidenceLevel: "A", sourceIds: ["coupang-product-creation"],
    titleRules: { label: "상품명", hardMaxChars: 100, recommendedMinChars: 35, recommendedMaxChars: 80, hardConstraintSourceIds: ["coupang-product-creation"] },
    highlightRules: { label: "핵심 특징" },
    descriptionRules: { label: "상품 설명" },
    searchRules: { label: "검색 태그", surface: "search-tags", publishable: true, hardMaxItems: 20, hardMaxCharsPerItem: 20, hardConstraintSourceIds: ["coupang-product-creation"] },
  }),
  definePolicy({ id: "mercado-libre", label: "Mercado Libre", marketplaceId: "mercado-libre", defaultLocale: "es-419", archetypeId: "search", evidenceLevel: "C", titleRules: { label: "Título" }, highlightRules: { label: "Características destacadas" }, descriptionRules: { label: "Descripción" }, searchRules: { label: "Sugerencias de búsqueda" } }),
];

export const CREATION_LISTING_PLATFORM_POLICIES = deepFreeze(POLICY_DEFINITIONS);
export const CREATION_LISTING_PLATFORM_POLICY_REGISTRY = deepFreeze(
  Object.fromEntries(CREATION_LISTING_PLATFORM_POLICIES.map((policy) => [policy.id, policy])),
);

const PLATFORM_ALIASES = deepFreeze({ "amazon-us": "amazon" });

const LOCALE_ALIASES = new Map([
  ["en", "en-US"], ["en-us", "en-US"], ["english", "en-US"],
  ["zh", "zh-CN"], ["zh-cn", "zh-CN"], ["简体中文", "zh-CN"], ["中文", "zh-CN"],
  ["ja", "ja-JP"], ["ja-jp", "ja-JP"], ["jp", "ja-JP"], ["日本語", "ja-JP"], ["日语", "ja-JP"],
  ["ko", "ko-KR"], ["ko-kr", "ko-KR"], ["kr", "ko-KR"], ["한국어", "ko-KR"], ["韩语", "ko-KR"],
  ["es", "es-419"], ["es-419", "es-419"], ["español", "es-419"], ["spanish", "es-419"],
  ["fr", "fr-FR"], ["fr-fr", "fr-FR"], ["français", "fr-FR"], ["french", "fr-FR"],
  ["de", "de-DE"], ["de-de", "de-DE"], ["deutsch", "de-DE"], ["german", "de-DE"],
]);

function normalizePlatformCandidate(value) {
  const normalized = cleanString(value).toLowerCase();
  return PLATFORM_ALIASES[normalized] || normalized;
}

export function getCreationListingPolicy(value = "universal") {
  const normalized = normalizePlatformCandidate(value);
  return clonePolicyData(CREATION_LISTING_PLATFORM_POLICY_REGISTRY[normalized] || CREATION_LISTING_PLATFORM_POLICY_REGISTRY.universal);
}

export function listCreationListingPolicies() {
  return clonePolicyData(CREATION_LISTING_PLATFORM_POLICIES);
}

export function resolveCreationListingLocale(value, policy = CREATION_LISTING_PLATFORM_POLICY_REGISTRY.universal) {
  const raw = cleanString(value);
  const normalized = LOCALE_ALIASES.get(raw.toLowerCase()) || LOCALE_ALIASES.get(raw);
  if (normalized) return { locale: normalized, supported: true, warnings: [] };
  const fallback = cleanString(policy?.defaultLocale) || "en-US";
  if (!raw) return { locale: fallback, supported: true, warnings: [] };
  return {
    locale: fallback,
    supported: false,
    warnings: [`Unsupported Listing locale "${raw}"; using ${fallback}.`],
  };
}

export function resolveCreationListingPolicy(input = {}) {
  const manifest = input?.manifest && typeof input.manifest === "object" ? input.manifest : input;
  const effectivePlan = manifest?.effectivePlan && typeof manifest.effectivePlan === "object"
    ? manifest.effectivePlan
    : input?.effectivePlan && typeof input.effectivePlan === "object"
      ? input.effectivePlan
      : {};
  const platformCandidates = [
    [effectivePlan.platformPolicyId, "effectivePlan.platformPolicyId"],
    [effectivePlan.platform, "effectivePlan.platform"],
    [manifest?.platformPolicyId, "manifest.platformPolicyId"],
    [manifest?.platform, "manifest.platform"],
  ];
  const selectedPlatform = platformCandidates.find(([value]) => cleanString(value));
  const rawPlatform = cleanString(selectedPlatform?.[0]);
  const normalizedPlatform = normalizePlatformCandidate(rawPlatform);
  const knownPlatform = CREATION_LISTING_PLATFORM_POLICY_REGISTRY[normalizedPlatform];
  const policy = knownPlatform || CREATION_LISTING_PLATFORM_POLICY_REGISTRY.universal;
  const warnings = [];
  if (rawPlatform && !knownPlatform) {
    warnings.push(`Unknown platform "${rawPlatform}"; using the universal Listing policy.`);
  }

  const platformProvenance = cleanString(effectivePlan.platformProvenance || manifest?.platformProvenance);
  if (platformProvenance === "legacy-missing") {
    warnings.push("Platform provenance is legacy-missing; universal is a compatibility fallback, not an explicit historical selection.");
  }

  const localeCandidates = [
    [effectivePlan.targetLanguage, "effectivePlan.targetLanguage"],
    [manifest?.targetLanguage, "manifest.targetLanguage"],
  ];
  const selectedLocale = localeCandidates.find(([value]) => cleanString(value));
  const localeResult = resolveCreationListingLocale(selectedLocale?.[0], policy);
  warnings.push(...localeResult.warnings);

  return {
    ...clonePolicyData(policy),
    platformId: policy.id,
    platformLabel: policy.label,
    listingPolicyVersion: policy.policyVersion,
    platformSource: selectedPlatform?.[1] || "policy.default",
    platformProvenance: platformProvenance || (rawPlatform ? "explicit" : "missing"),
    locale: localeResult.locale,
    language: localeResult.locale,
    localeSource: selectedLocale?.[1] || "policy.defaultLocale",
    warnings,
  };
}
