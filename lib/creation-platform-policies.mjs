export const CREATION_PLATFORM_POLICY_VERSION = "2026-07-14.1";
export const CREATION_PLATFORM_POLICY_VERIFIED_AT = "2026-07-11";
export const CREATION_PLATFORM_EVIDENCE_LEVELS = Object.freeze(["baseline", "A", "B", "C"]);
export const CREATION_PLATFORM_RESOLUTION_TIERS = Object.freeze(["1.5K", "2K", "max"]);

function cleanString(value) {
  return String(value ?? "").trim();
}

function deepFreeze(value) {
  if (!value || typeof value !== "object" || Object.isFrozen(value)) return value;
  Object.freeze(value);
  for (const nested of Object.values(value)) deepFreeze(nested);
  return value;
}

function clonePolicyData(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function source({ id, title, url = null, urls, official = false, kind = "guidance", note = "" }) {
  const normalizedUrls = uniqueStrings(urls || (url ? [url] : []));
  return {
    id,
    title,
    url: url || normalizedUrls[0] || null,
    urls: normalizedUrls,
    official,
    kind,
    note,
    verifiedAt: CREATION_PLATFORM_POLICY_VERIFIED_AT,
  };
}

export const CREATION_PLATFORM_SOURCE_REGISTRY = deepFreeze({
  "internal-universal-baseline": source({
    id: "internal-universal-baseline",
    title: "通用电商保守基线",
    kind: "internal-baseline",
    note: "不代表任何命名平台的官方要求。",
  }),
  "amazon-g1881": source({
    id: "amazon-g1881",
    title: "Amazon Seller Central G1881",
    url: "https://sellercentral.amazon.com/gp/help/external/G1881",
    official: true,
    kind: "official-rule",
  }),
  "taobao-uploadspecs": source({
    id: "taobao-uploadspecs",
    title: "淘宝图片空间上传规范",
    url: "https://www.taobao.com/markets/imgrule/uploadspecs",
    official: true,
    kind: "official-rule",
  }),
  "jd-main-image-rules": source({
    id: "jd-main-image-rules",
    title: "京东主图规则与平台页面",
    urls: [
      "https://mtt.m.jd.com/article/articleView/38caf73d-746f-4607-b15f-5495c32d1b41",
      "https://pro.jd.com/mall/active/SLULn5voab5iB92t9ZLCDUCTBks/index.html",
    ],
    official: true,
    kind: "partial-official-guidance",
    note: "资料覆盖不完整，因此 profile 证据等级保持为 B。",
  }),
  "pdd-conservative-guidance": source({
    id: "pdd-conservative-guidance",
    title: "拼多多保守平台建议",
    kind: "conservative-guidance",
    note: "公开官方图片细则不足，仅作为可覆盖建议。",
  }),
  "douyin-conservative-guidance": source({
    id: "douyin-conservative-guidance",
    title: "抖音电商保守平台建议",
    kind: "conservative-guidance",
    note: "公开官方图片细则不足，仅作为可覆盖建议。",
  }),
  "xiaohongshu-explore-observation": source({
    id: "xiaohongshu-explore-observation",
    title: "小红书真实内容流观察",
    url: "https://www.xiaohongshu.com/explore",
    kind: "observed-platform-page",
    note: "真实页面观察，不升级为官方硬规则。",
  }),
  "temu-marketplace-observation": source({
    id: "temu-marketplace-observation",
    title: "Temu 登录态卖家后台只读观察",
    kind: "authenticated-observation",
    note: "用户登录态卖家后台的只读观察，没有稳定公开规则 URL，不升级为官方硬规则。",
  }),
  "tiktok-shop-481891871868714": source({
    id: "tiktok-shop-481891871868714",
    title: "TikTok Shop Academy 481891871868714",
    url: "https://seller-us.tiktok.com/university/essay?knowledge_id=481891871868714",
    official: true,
    kind: "official-rule",
  }),
  "shopee-seller-education-2989": source({
    id: "shopee-seller-education-2989",
    title: "Shopee Seller Education 2989",
    url: "https://seller.shopee.ph/edu/article/2989",
    official: true,
    kind: "official-guidance",
  }),
  "lazada-conservative-guidance": source({
    id: "lazada-conservative-guidance",
    title: "Lazada 保守平台建议",
    kind: "conservative-guidance",
    note: "公开官方图片细则不足，仅作为可覆盖建议。",
  }),
  "etsy-image-requirements": source({
    id: "etsy-image-requirements",
    title: "Etsy 图片要求与最佳实践",
    url: "https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop",
    official: true,
    kind: "official-guidance",
  }),
  "ebay-photo-tips": source({
    id: "ebay-photo-tips",
    title: "eBay Seller Center Photo Tips",
    url: "https://www.ebay.com/sellercenter/listings/photo-tips",
    official: true,
    kind: "official-guidance",
  }),
  "walmart-image-guide": source({
    id: "walmart-image-guide",
    title: "Walmart Marketplace Learn 图片指南",
    url: "https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20content,%20imagery,%20and%20media/Product-detail-page:-Image-guidelines-&-requirements",
    official: true,
    kind: "official-rule",
  }),
  "shopify-product-media": source({
    id: "shopify-product-media",
    title: "Shopify Product Media",
    url: "https://help.shopify.com/en/manual/products/product-media/product-media-types",
    official: true,
    kind: "official-guidance",
  }),
  "aliexpress-conservative-guidance": source({
    id: "aliexpress-conservative-guidance",
    title: "AliExpress 保守平台建议",
    kind: "conservative-guidance",
    note: "公开官方图片细则不足，仅作为可覆盖建议。",
  }),
  "rakuten-conservative-guidance": source({
    id: "rakuten-conservative-guidance",
    title: "Rakuten 保守平台建议",
    kind: "conservative-guidance",
    note: "公开官方图片细则不足，仅作为可覆盖建议。",
  }),
  "coupang-conservative-guidance": source({
    id: "coupang-conservative-guidance",
    title: "Coupang 保守平台建议",
    kind: "conservative-guidance",
    note: "公开官方图片细则不足，仅作为可覆盖建议。",
  }),
  "mercado-libre-conservative-guidance": source({
    id: "mercado-libre-conservative-guidance",
    title: "Mercado Libre 保守平台建议",
    kind: "conservative-guidance",
    note: "公开官方图片细则不足，仅作为可覆盖建议。",
  }),
});

function blockingConstraint(id, field, operator, value, sourceId, message) {
  return {
    id,
    level: "blocking",
    field,
    operator,
    value,
    sourceIds: [sourceId],
    message,
  };
}

function imageType(
  imageTypeValue,
  imageTypeLabel,
  role,
  composition,
  textPolicy,
  scenePolicy,
  logoPolicy,
  { requiredByDefault = false, sourceIds = [], constraints = [] } = {},
) {
  return {
    imageType: imageTypeValue,
    imageTypeLabel,
    role,
    composition,
    textPolicy,
    scenePolicy,
    logoPolicy,
    requiredByDefault,
    sourceIds: uniqueStrings(sourceIds),
    constraints,
  };
}

const IMAGE_TYPE_DEFINITIONS = [
  imageType("generic-hero", "通用首图", "hero", "product-dominant", "concise", "optional-context", "allow-supplied"),
  imageType(
    "amazon-main",
    "Amazon 白底主图",
    "hero",
    "centered-white-85-percent",
    "none",
    "studio-white",
    "forbid-overlay",
    {
      requiredByDefault: true,
      sourceIds: ["amazon-g1881"],
      constraints: [
        blockingConstraint("amazon-main-no-marketing-text", "textPolicy", "equals", "none", "amazon-g1881", "Amazon 主图不得包含营销文字。"),
        blockingConstraint("amazon-main-no-collage", "composition", "equals", "centered-white-85-percent", "amazon-g1881", "Amazon 主图必须为单一居中商品白底构图，不得拼贴。"),
        blockingConstraint("amazon-main-no-watermark", "prompt", "forbids", "watermark", "amazon-g1881", "Amazon 主图不得包含水印。"),
        blockingConstraint("amazon-main-no-external-logo", "logoPolicy", "equals", "forbid-overlay", "amazon-g1881", "Amazon 主图不得附加外部 Logo 图层。"),
        blockingConstraint("amazon-main-no-badges", "prompt", "forbids", "badge", "amazon-g1881", "Amazon 主图不得包含促销徽章。"),
        blockingConstraint("amazon-main-no-misleading-accessories", "prompt", "forbids", "misleading-accessories", "amazon-g1881", "Amazon 主图不得展示未随商品提供的误导性配件。"),
      ],
    },
  ),
  imageType(
    "taobao-white-main",
    "淘宝白底主图",
    "hero",
    "centered-white-product",
    "none",
    "studio-white",
    "forbid-overlay",
    {
      requiredByDefault: true,
      sourceIds: ["taobao-uploadspecs"],
      constraints: [
        blockingConstraint("taobao-white-main-background", "composition", "equals", "centered-white-product", "taobao-uploadspecs", "淘宝白底图必须保持居中白底商品构图。"),
        blockingConstraint("taobao-white-main-no-text", "textPolicy", "equals", "none", "taobao-uploadspecs", "淘宝白底图不得附加营销文字。"),
        blockingConstraint("taobao-white-main-no-logo-overlay", "logoPolicy", "equals", "forbid-overlay", "taobao-uploadspecs", "淘宝白底图不得附加外部 Logo 图层。"),
      ],
    },
  ),
  imageType(
    "transparent-cutout",
    "透明背景商品图",
    "product-detail",
    "isolated-transparent-product",
    "none",
    "transparent",
    "forbid-overlay",
    {
      requiredByDefault: true,
      sourceIds: ["taobao-uploadspecs"],
      constraints: [
        blockingConstraint("taobao-transparent-background", "scenePolicy", "equals", "transparent", "taobao-uploadspecs", "透明图必须保持透明背景。"),
        blockingConstraint("taobao-transparent-no-text", "textPolicy", "equals", "none", "taobao-uploadspecs", "透明图不得附加营销文字。"),
        blockingConstraint("taobao-transparent-no-logo-overlay", "logoPolicy", "equals", "forbid-overlay", "taobao-uploadspecs", "透明图不得附加外部 Logo 图层。"),
      ],
    },
  ),
  imageType(
    "tiktok-shop-main",
    "TikTok Shop 主图",
    "hero",
    "centered-clean-product",
    "none",
    "studio-clean",
    "forbid-overlay",
    {
      requiredByDefault: true,
      sourceIds: ["tiktok-shop-481891871868714"],
      constraints: [
        blockingConstraint("tiktok-shop-main-composition", "composition", "equals", "centered-clean-product", "tiktok-shop-481891871868714", "TikTok Shop 主图必须保持干净且商品居中。"),
        blockingConstraint("tiktok-shop-main-no-text", "textPolicy", "equals", "none", "tiktok-shop-481891871868714", "TikTok Shop 主图不得附加营销文字。"),
        blockingConstraint("tiktok-shop-main-no-logo-overlay", "logoPolicy", "equals", "forbid-overlay", "tiktok-shop-481891871868714", "TikTok Shop 主图不得附加外部 Logo 图层。"),
      ],
    },
  ),
  imageType(
    "walmart-main",
    "Walmart 白底主图",
    "hero",
    "centered-white-product",
    "none",
    "studio-white",
    "forbid-overlay",
    {
      requiredByDefault: true,
      sourceIds: ["walmart-image-guide"],
      constraints: [
        blockingConstraint("walmart-main-background", "composition", "equals", "centered-white-product", "walmart-image-guide", "Walmart 主图必须保持居中白底商品构图。"),
        blockingConstraint("walmart-main-no-text", "textPolicy", "equals", "none", "walmart-image-guide", "Walmart 主图不得附加营销文字。"),
        blockingConstraint("walmart-main-no-logo-overlay", "logoPolicy", "equals", "forbid-overlay", "walmart-image-guide", "Walmart 主图不得附加外部 Logo 图层。"),
      ],
    },
  ),
  imageType("clean-catalog-main", "清爽目录主图", "hero", "centered-clean-product", "none", "studio-clean", "preserve-existing-only"),
  imageType("brand-hero", "品牌主视觉", "hero", "brand-key-visual", "concise", "brand-context", "allow-supplied"),
  imageType("content-cover", "内容封面", "hero", "dynamic-vertical-cover", "concise", "demo-context", "allow-supplied"),
  imageType("xhs-feed-cover", "小红书信息流封面", "hero", "editorial-3x4-cover", "concise", "authentic-lifestyle", "allow-supplied"),
  imageType("lifestyle-first", "生活方式首图", "atmosphere", "environmental-first", "none-or-short", "authentic-lifestyle", "allow-supplied"),
  imageType("benefit-proof", "卖点证据图", "benefit", "product-with-evidence", "concise", "optional-context", "allow-supplied"),
  imageType("info-benefit", "信息卖点图", "benefit", "modular-information-hierarchy", "moderate", "neutral", "allow-supplied"),
  imageType("value-bundle", "套装价值图", "accessory-gift", "bundle-quantity-groups", "factual-short", "studio-clean", "allow-supplied"),
  imageType("multi-angle", "多角度图", "multi-angle", "three-to-four-angles", "none", "studio-clean", "preserve-existing-only"),
  imageType("clean-product-proof", "干净商品证明图", "multi-angle", "single-product-or-alt-angle", "none", "studio-clean", "preserve-existing-only"),
  imageType("detail-macro", "细节微距图", "product-detail", "macro-detail-panels", "factual-short", "studio-clean", "allow-supplied"),
  imageType("label-detail", "标签细节图", "product-detail", "label-marking-closeup", "factual-only", "studio-clean", "preserve-existing-only"),
  imageType("dimension-fit", "尺寸适配图", "size-capacity-fit", "dimension-lines-and-fit-reference", "factual-only", "neutral", "allow-supplied"),
  imageType("scale-proof", "尺度证明图", "size-capacity-fit", "real-world-scale-reference", "factual-short", "authentic-lifestyle", "allow-supplied"),
  imageType("spec-table", "参数表", "spec-table", "specification-table", "factual-only", "neutral", "allow-supplied"),
  imageType("usage-demo", "使用演示图", "usage-suggestion", "usage-or-step-demo", "concise", "authentic-use", "allow-supplied"),
  imageType("creator-demo", "创作者演示图", "human-handheld", "person-handheld-or-demo", "concise", "authentic-use", "allow-supplied"),
  imageType("in-box", "包装清单图", "accessory-gift", "flat-lay-in-box", "factual-only", "studio-clean", "allow-supplied"),
  imageType("variant-comparison", "变体对比图", "series-showcase", "supplied-variant-comparison", "factual-only", "studio-clean", "allow-supplied"),
  imageType("material-proof", "材质证明图", "ingredient-material", "material-ingredient-or-color-swatches", "factual-short", "neutral", "allow-supplied"),
  imageType("craft-proof", "工艺证明图", "craft-process", "craft-or-quality-evidence", "factual-short", "process", "allow-supplied"),
  imageType("comparison-proof", "功能对比图", "effect-comparison", "side-by-side-functional-evidence", "factual-only", "controlled-context", "allow-supplied"),
  imageType("condition-proof", "成色证明图", "product-detail", "condition-inspection", "factual-only", "studio-clean", "preserve-existing-only"),
  imageType("defect-disclosure", "瑕疵披露图", "product-detail", "defect-macro", "factual-only", "studio-clean", "preserve-existing-only"),
  imageType("gift-packaging", "礼赠包装图", "accessory-gift", "gift-or-unboxing", "concise", "gift-context", "allow-supplied"),
  imageType("long-detail", "纵向详情图", "brand-story", "vertical-stacked-detail-modules", "moderate", "multi-context", "allow-supplied"),
  imageType("brand-trust", "品牌信任图", "brand-story", "brand-and-real-product-evidence", "concise", "brand-context", "allow-supplied"),
];

export const CREATION_PLATFORM_IMAGE_TYPE_REGISTRY = deepFreeze(
  Object.fromEntries(IMAGE_TYPE_DEFINITIONS.map((definition) => [definition.imageType, definition])),
);

const MARKETING_CONTEXTS = {
  universal: {
    shopperIntent: "balanced product discovery and verification",
    proofStyle: "clear product evidence before persuasion",
    copyStyle: "concise factual ecommerce copy",
    defaultMotivations: ["understand the product quickly", "buy with confidence"],
    defaultObjections: ["unclear product fit", "insufficient product evidence"],
  },
  search: {
    shopperIntent: "search-led comparison and verification",
    proofStyle: "specific product, fit, condition, specification, and included-item evidence",
    copyStyle: "factual comparison-ready copy",
    defaultMotivations: ["confirm product fit", "reduce purchase risk"],
    defaultObjections: ["uncertain specifications", "uncertain authenticity or completeness"],
  },
  value: {
    shopperIntent: "value-led comparison and quick choice",
    proofStyle: "visible bundle, variant, utility, and included-item evidence",
    copyStyle: "short benefit-led copy with concrete proof",
    defaultMotivations: ["see practical value quickly", "compare available choices"],
    defaultObjections: ["unclear bundle value", "unclear variant or size choice"],
  },
  content: {
    shopperIntent: "content-led discovery and use imagination",
    proofStyle: "authentic use context followed by concrete product evidence",
    copyStyle: "native concise copy without fabricated social proof",
    defaultMotivations: ["imagine the product in real use", "discover a relevant benefit"],
    defaultObjections: ["content feels staged", "product value is not specific"],
  },
  brand: {
    shopperIntent: "lifestyle, craft, and brand-trust discovery",
    proofStyle: "product detail, making quality, ownership context, and accurate presentation",
    copyStyle: "restrained brand-led copy grounded in supplied facts",
    defaultMotivations: ["connect with the product story", "feel confident in quality"],
    defaultObjections: ["unclear making quality", "unclear real-world scale or use"],
  },
};

function getMarketingContext(id) {
  const kind = ["douyin", "xiaohongshu", "tiktok-shop"].includes(id)
    ? "content"
    : ["etsy", "shopify"].includes(id)
      ? "brand"
      : ["tmall-taobao", "pdd", "temu", "shopee", "lazada", "aliexpress"].includes(id)
        ? "value"
        : id === "universal"
          ? "universal"
          : "search";
  return { ...clonePolicyData(MARKETING_CONTEXTS[kind]), advisory: true };
}

function profile(id, label, evidenceLevel, targetLanguage, resolutionTier, sourceIds, promptInstruction, slots) {
  return { id, label, evidenceLevel, targetLanguage, resolutionTier, sourceIds, promptInstruction, slots };
}

const PROFILE_DEFINITIONS = [
  profile(
    "universal",
    "通用电商",
    "baseline",
    "en",
    "1.5K",
    ["internal-universal-baseline"],
    "Use a platform-neutral ecommerce gallery strategy with product-first clarity, accurate source facts, readable thumbnails, and conservative claim control.",
    ["generic-hero@1:1", "benefit-proof@1:1", "lifestyle-first@1:1", "multi-angle@1:1", "detail-macro@1:1", "dimension-fit@1:1", "in-box@1:1", "variant-comparison@1:1"],
  ),
  profile(
    "amazon",
    "Amazon",
    "A",
    "en",
    "2K",
    ["amazon-g1881"],
    "Use Amazon-style marketplace priorities: a sourced main-image-safe treatment followed by factual benefit, lifestyle, detail, dimension, and included-item proof.",
    ["amazon-main@1:1", "benefit-proof@1:1", "lifestyle-first@1:1", "multi-angle@1:1", "detail-macro@1:1", "dimension-fit@1:1", "in-box@1:1"],
  ),
  profile(
    "tmall-taobao",
    "淘宝/天猫",
    "A",
    "zh-CN",
    "2K",
    ["taobao-uploadspecs"],
    "使用淘宝/天猫平台原生资产结构：白底与透明商品图优先，随后补充场景、卖点、细节、尺寸、变体和纵向详情。",
    ["taobao-white-main@1:1", "transparent-cutout@1:1", "lifestyle-first@1:1", "info-benefit@1:1", "detail-macro@1:1", "dimension-fit@1:1", "variant-comparison@1:1", "long-detail@2:3"],
  ),
  profile(
    "jd",
    "京东",
    "B",
    "zh-CN",
    "2K",
    ["jd-main-image-rules"],
    "使用京东导向的可信商品证明、参数清晰度、品质信息和规格可读性；未被明确来源覆盖的建议不作为硬约束。",
    ["clean-catalog-main@1:1", "spec-table@1:1", "comparison-proof@1:1", "detail-macro@1:1", "lifestyle-first@1:1", "dimension-fit@1:1", "in-box@1:1", "craft-proof@1:1"],
  ),
  profile(
    "pdd",
    "拼多多",
    "C",
    "zh-CN",
    "1.5K",
    ["pdd-conservative-guidance"],
    "使用可覆盖的拼多多保守建议：快速理解商品、套装数量和核心卖点；不得把该建议表述为官方硬规则。",
    ["clean-catalog-main@1:1", "value-bundle@1:1", "benefit-proof@1:1", "variant-comparison@1:1", "lifestyle-first@1:1", "dimension-fit@1:1", "detail-macro@1:1", "in-box@1:1"],
  ),
  profile(
    "douyin",
    "抖音电商",
    "C",
    "zh-CN",
    "1.5K",
    ["douyin-conservative-guidance"],
    "使用可覆盖的抖音电商保守建议：商城商品图与竖版内容封面并行，突出真实演示与使用情境；不得伪造平台界面。",
    ["clean-catalog-main@1:1", "content-cover@3:4", "creator-demo@3:4", "lifestyle-first@3:4", "detail-macro@1:1", "variant-comparison@1:1"],
  ),
  profile(
    "xiaohongshu",
    "小红书电商",
    "B",
    "zh-CN",
    "1.5K",
    ["xiaohongshu-explore-observation"],
    "使用小红书内容流导向的 3:4 封面、生活体验、步骤和尺度证明；不得伪造评价、互动、背书或冒充用户证言。",
    ["xhs-feed-cover@3:4", "lifestyle-first@3:4", "usage-demo@3:4", "detail-macro@3:4", "scale-proof@3:4", "clean-product-proof@1:1"],
  ),
  profile(
    "temu",
    "Temu",
    "B",
    "en",
    "1.5K",
    ["temu-marketplace-observation"],
    "Use conservative Temu marketplace guidance for quick value recognition, variant and bundle clarity, clean product separation, and factual global-shopping readability.",
    ["clean-catalog-main@1:1", "value-bundle@1:1", "variant-comparison@1:1", "benefit-proof@1:1", "dimension-fit@1:1", "usage-demo@1:1", "detail-macro@1:1", "in-box@1:1"],
  ),
  profile(
    "tiktok-shop",
    "TikTok Shop",
    "A",
    "en",
    "1.5K",
    ["tiktok-shop-481891871868714"],
    "Use TikTok Shop priorities: a sourced clean main image followed by creator-commerce demonstration, lifestyle context, factual benefits, detail, and supplied variants.",
    ["tiktok-shop-main@1:1", "creator-demo@1:1", "lifestyle-first@1:1", "benefit-proof@1:1", "detail-macro@1:1", "variant-comparison@1:1"],
  ),
  profile(
    "shopee",
    "Shopee",
    "A",
    "en",
    "1.5K",
    ["shopee-seller-education-2989"],
    "Use Shopee mobile-first guidance with a clear cover, benefits, angles, detail, dimensions, usage, variants, included items, and material proof.",
    ["clean-catalog-main@1:1", "benefit-proof@1:1", "multi-angle@1:1", "detail-macro@1:1", "dimension-fit@1:1", "usage-demo@1:1", "variant-comparison@1:1", "in-box@1:1", "material-proof@1:1"],
  ),
  profile(
    "lazada",
    "Lazada",
    "C",
    "en",
    "1.5K",
    ["lazada-conservative-guidance"],
    "Use conservative Lazada guidance for clean regional cataloging and comparison-friendly product information; treat it as an editable recommendation, not an official hard rule.",
    ["clean-catalog-main@1:1", "benefit-proof@1:1", "lifestyle-first@1:1", "detail-macro@1:1", "dimension-fit@1:1", "variant-comparison@1:1", "in-box@1:1", "comparison-proof@1:1"],
  ),
  profile(
    "etsy",
    "Etsy",
    "A",
    "en",
    "2K",
    ["etsy-image-requirements"],
    "Use Etsy image guidance with a warm lifestyle first image, accurate product, craft, material, macro, scale, variant, gifting, and usage views.",
    ["lifestyle-first@4:3", "clean-product-proof@4:3", "craft-proof@4:3", "detail-macro@4:3", "scale-proof@4:3", "variant-comparison@4:3", "gift-packaging@4:3", "usage-demo@4:3"],
  ),
  profile(
    "ebay",
    "eBay",
    "A",
    "en",
    "2K",
    ["ebay-photo-tips"],
    "Use eBay buyer-confidence priorities: clear search recognition, angles, labels, supplied condition, scale, included items, usage, and honest defect disclosure.",
    ["clean-catalog-main@1:1", "multi-angle@1:1", "label-detail@1:1", "condition-proof@1:1", "scale-proof@1:1", "in-box@1:1", "usage-demo@1:1", "defect-disclosure@1:1"],
  ),
  profile(
    "walmart",
    "Walmart",
    "A",
    "en",
    "max",
    ["walmart-image-guide"],
    "Use Walmart marketplace guidance: a sourced white-background main image followed by alternative angles, factual benefits, lifestyle context, dimensions, and included items.",
    ["walmart-main@1:1", "multi-angle@1:1", "benefit-proof@1:1", "lifestyle-first@1:1", "dimension-fit@1:1", "in-box@1:1"],
  ),
  profile(
    "shopify",
    "Shopify/DTC",
    "A",
    "en",
    "2K",
    ["shopify-product-media"],
    "Use direct-to-consumer storefront priorities for a coherent brand hero, catalog view, lifestyle, benefit, detail, usage, variant, and trust-building sequence.",
    ["brand-hero@1:1", "clean-product-proof@1:1", "lifestyle-first@1:1", "benefit-proof@1:1", "detail-macro@1:1", "usage-demo@1:1", "variant-comparison@1:1", "brand-trust@1:1"],
  ),
  profile(
    "aliexpress",
    "AliExpress",
    "C",
    "en",
    "1.5K",
    ["aliexpress-conservative-guidance"],
    "Use conservative AliExpress guidance for international shopper clarity, supplied variants and bundles, factual benefits, dimensions, usage, detail, and included items.",
    ["clean-catalog-main@1:1", "variant-comparison@1:1", "value-bundle@1:1", "benefit-proof@1:1", "dimension-fit@1:1", "usage-demo@1:1", "detail-macro@1:1", "in-box@1:1"],
  ),
  profile(
    "rakuten",
    "Rakuten",
    "C",
    "ja",
    "2K",
    ["rakuten-conservative-guidance"],
    "Use conservative Rakuten guidance for an informative Japanese-language catalog, factual benefits, details, specifications, usage, gifting, variants, and included items.",
    ["clean-catalog-main@1:1", "info-benefit@1:1", "detail-macro@1:1", "spec-table@1:1", "usage-demo@1:1", "gift-packaging@1:1", "variant-comparison@1:1", "in-box@1:1"],
  ),
  profile(
    "coupang",
    "Coupang",
    "C",
    "ko",
    "2K",
    ["coupang-conservative-guidance"],
    "Use conservative Coupang guidance for Korean mobile-shopping clarity, benefits, detail, dimensions, usage, included items, comparison, and a portrait detail asset.",
    ["clean-catalog-main@1:1", "benefit-proof@1:1", "detail-macro@1:1", "dimension-fit@1:1", "usage-demo@1:1", "in-box@1:1", "comparison-proof@1:1", "long-detail@3:4"],
  ),
  profile(
    "mercado-libre",
    "Mercado Libre",
    "C",
    "es",
    "1.5K",
    ["mercado-libre-conservative-guidance"],
    "Use conservative Mercado Libre guidance for Spanish-language product identification, angles, label detail, dimensions, usage, variants, included items, and supplied condition evidence.",
    ["clean-catalog-main@1:1", "multi-angle@1:1", "label-detail@1:1", "dimension-fit@1:1", "usage-demo@1:1", "variant-comparison@1:1", "in-box@1:1", "condition-proof@1:1"],
  ),
];

function expandProfile(definition) {
  const slots = definition.slots.map((encodedSlot) => {
    const [imageTypeValue, ratio] = encodedSlot.split("@");
    const imageTypeDefinition = CREATION_PLATFORM_IMAGE_TYPE_REGISTRY[imageTypeValue];
    if (!imageTypeDefinition) throw new Error(`Unknown Creation platform image type: ${imageTypeValue}`);
    const hasBlockingConstraint = imageTypeDefinition.constraints.some((constraint) => constraint.level === "blocking");
    return {
      slotKey: `${definition.id}:${imageTypeValue}`,
      imageType: imageTypeValue,
      imageTypeLabel: imageTypeDefinition.imageTypeLabel,
      role: imageTypeDefinition.role,
      ratio,
      resolutionTier: definition.resolutionTier,
      targetLanguage: definition.targetLanguage,
      composition: imageTypeDefinition.composition,
      textPolicy: imageTypeDefinition.textPolicy,
      scenePolicy: imageTypeDefinition.scenePolicy,
      logoPolicy: imageTypeDefinition.logoPolicy,
      required: imageTypeDefinition.requiredByDefault,
      advisory: !hasBlockingConstraint,
      constraints: clonePolicyData(imageTypeDefinition.constraints),
      evidenceLevel: definition.evidenceLevel,
      sourceIds: uniqueStrings([...definition.sourceIds, ...imageTypeDefinition.sourceIds]),
    };
  });

  return {
    id: definition.id,
    value: definition.id,
    label: definition.label,
    strategyVersion: CREATION_PLATFORM_POLICY_VERSION,
    verifiedAt: CREATION_PLATFORM_POLICY_VERIFIED_AT,
    evidenceLevel: definition.evidenceLevel,
    targetLanguage: definition.targetLanguage,
    resolutionTier: definition.resolutionTier,
    defaultRatio: slots[0]?.ratio || "1:1",
    recommendedImageCount: slots.length,
    sourceIds: uniqueStrings(definition.sourceIds),
    promptInstruction: definition.promptInstruction,
    marketingContext: getMarketingContext(definition.id),
    advisory: definition.evidenceLevel === "C",
    slots,
  };
}

export const CREATION_PLATFORM_PROFILES = deepFreeze(PROFILE_DEFINITIONS.map(expandProfile));
export const CREATION_PLATFORM_PROFILE_REGISTRY = deepFreeze(
  Object.fromEntries(CREATION_PLATFORM_PROFILES.map((entry) => [entry.id, entry])),
);
export const CREATION_PLATFORM_OPTIONS = deepFreeze(
  CREATION_PLATFORM_PROFILES.map((entry) => ({
    value: entry.id,
    label: entry.label,
    promptInstruction: entry.promptInstruction,
    strategyVersion: entry.strategyVersion,
    evidenceLevel: entry.evidenceLevel,
    recommendedImageCount: entry.recommendedImageCount,
    targetLanguage: entry.targetLanguage,
    resolutionTier: entry.resolutionTier,
  })),
);

export function normalizeCreationPlatformId(value) {
  const normalized = cleanString(value).toLowerCase();
  return CREATION_PLATFORM_PROFILE_REGISTRY[normalized] ? normalized : "universal";
}

export function getCreationPlatformProfile(value = "universal") {
  return clonePolicyData(CREATION_PLATFORM_PROFILE_REGISTRY[normalizeCreationPlatformId(value)]);
}

export function listCreationPlatformProfiles() {
  return clonePolicyData(CREATION_PLATFORM_PROFILES);
}

export function getCreationPlatformImageType(value) {
  return clonePolicyData(CREATION_PLATFORM_IMAGE_TYPE_REGISTRY[cleanString(value)] || null);
}

export function listCreationPlatformImageTypes() {
  return clonePolicyData(Object.values(CREATION_PLATFORM_IMAGE_TYPE_REGISTRY));
}
