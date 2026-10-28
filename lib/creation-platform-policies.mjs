export const CREATION_PLATFORM_POLICY_VERSION = "2026-07-18.2";
export const CREATION_PLATFORM_POLICY_VERIFIED_AT = "2026-07-11";
export const CREATION_PLATFORM_EVIDENCE_LEVELS = Object.freeze(["baseline", "A", "B", "C"]);
export const CREATION_PLATFORM_RESOLUTION_TIERS = Object.freeze(["1K", "1.5K", "2K", "max"]);

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
  imageType("generic-hero", "首图成交主视觉", "hero", "product-dominant", "concise", "optional-context", "allow-supplied"),
  imageType(
    "clean-catalog-main",
    "白底首图",
    "hero",
    "centered-clean-product",
    "none",
    "studio-clean",
    "preserve-existing-only",
  ),
  imageType("target-shopper-resonance", "目标人群共鸣图", "benefit", "target-shopper-decision-moment", "concise", "authentic-use", "allow-supplied"),
  imageType("scene-application", "适用多场景图", "scene", "multi-scenario-application", "concise", "authentic-use", "allow-supplied"),
  imageType("scene-fit-1", "场景适配图一", "scene-fit-1", "single-scene-adaptation", "none-or-short", "authentic-use", "allow-supplied"),
  imageType("scene-fit-2", "场景适配图二", "scene-fit-2", "single-scene-adaptation", "none-or-short", "authentic-use", "allow-supplied"),
  imageType("scene-fit-3", "场景适配图三", "scene-fit-3", "single-scene-adaptation", "none-or-short", "authentic-use", "allow-supplied"),
  imageType("multi-angle", "多角度产品展示图", "multi-angle", "reference-view-inspection-sheet", "none", "studio-clean", "preserve-existing-only"),
  imageType("ownership-atmosphere", "冲动下单氛围图", "atmosphere", "ownership-atmosphere", "concise", "authentic-lifestyle", "allow-supplied"),
  imageType("detail-macro", "产品细节特写图", "product-detail", "macro-detail-panels", "factual-short", "studio-clean", "allow-supplied"),
  imageType("use-style-story", "品牌质感/礼品价值图", "brand-story", "multi-scene-use-style-story", "moderate", "multi-context", "allow-supplied"),
  imageType("dimension-fit", "尺寸容量适配图", "size-capacity-fit", "dimension-lines-and-fit-reference", "factual-only", "neutral", "allow-supplied"),
  imageType("comparison-proof", "功能效果渲染图", "effect-comparison", "single-product-functional-rendering", "factual-only", "controlled-context", "allow-supplied"),
  imageType("in-box", "到手清单/配件图", "accessory-gift", "unpacked-included-items-flat-lay", "factual-only", "studio-clean", "allow-supplied"),
  imageType("variant-comparison", "多款式/SKU选择图", "series-showcase", "supplied-variant-comparison", "factual-only", "studio-clean", "allow-supplied"),
  imageType("pain-solution", "痛点图", "after-sales", "pain-solution-payoff", "concise", "authentic-use", "allow-supplied"),
  imageType("selling-point-stack", "卖点图", "usage-suggestion", "selling-points-with-evidence", "concise", "optional-context", "allow-supplied"),
  imageType("creator-demo", "真人手持展示图", "human-handheld", "person-handheld-or-demo", "concise", "authentic-use", "allow-supplied"),
  imageType("spec-table", "参数规格图", "spec-table", "product-led-key-spec-callouts", "factual-only", "neutral", "allow-supplied"),
  imageType("structure-cutaway", "品质工艺证明图", "craft-process", "cutaway-structure-explain", "factual-short", "neutral", "allow-supplied"),
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

function getMarketingContext() {
  return { ...clonePolicyData(MARKETING_CONTEXTS.universal), advisory: true };
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
    "1K",
    ["internal-universal-baseline"],
    "Use a platform-neutral ecommerce gallery strategy with product-first clarity, accurate source facts, readable thumbnails, and conservative claim control.",
    [
      "generic-hero@1:1",
      "target-shopper-resonance@1:1",
      "scene-application@1:1",
      "multi-angle@1:1",
      "ownership-atmosphere@1:1",
      "detail-macro@1:1",
      "use-style-story@1:1",
      "dimension-fit@1:1",
      "comparison-proof@1:1",
      "scene-fit-1@1:1",
      "scene-fit-2@1:1",
      "in-box@1:1",
      "variant-comparison@1:1",
      "scene-fit-3@1:1",
      "pain-solution@1:1",
      "selling-point-stack@1:1",
      "creator-demo@1:1",
      "spec-table@1:1",
    ],
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
    defaultRatio: entry.defaultRatio,
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
