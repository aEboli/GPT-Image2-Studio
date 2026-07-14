import {
  CREATION_PLATFORM_IMAGE_TYPE_REGISTRY,
  CREATION_PLATFORM_PROFILE_REGISTRY,
  getCreationPlatformProfile,
} from "./creation-platform-policies.mjs";

const SET_OVERRIDE_FIELDS = [
  "targetLanguage",
  "ratio",
  "resolutionTier",
  "visualLanguage",
  "composition",
  "textPolicy",
  "scenePolicy",
  "logoPolicy",
];
const ITEM_OVERRIDE_FIELDS = [
  "imageType",
  "role",
  "ratio",
  "resolutionTier",
  "targetLanguage",
  "composition",
  "textPolicy",
  "scenePolicy",
  "logoPolicy",
  "prompt",
];
const SAFE_FALLBACK_IMAGE_TYPES = ["clean-product-proof", "detail-macro", "material-proof", "craft-proof"];
const EXTENDED_SLOT_IMAGE_TYPES = [
  "clean-product-proof",
  "usage-demo",
  "material-proof",
  "craft-proof",
  "spec-table",
  "brand-trust",
  "comparison-proof",
  "scale-proof",
  "gift-packaging",
  "label-detail",
  "info-benefit",
  "value-bundle",
  "creator-demo",
  "content-cover",
  "long-detail",
  "condition-proof",
  "defect-disclosure",
  "variant-comparison",
];
const IMAGE_TYPE_EVIDENCE_KEYS = {
  "value-bundle": "packageContents",
  "dimension-fit": "dimensions",
  "scale-proof": "dimensions",
  "spec-table": "specifications",
  "in-box": "packageContents",
  "variant-comparison": "skuVariants",
  "material-proof": "materials",
  "craft-proof": "craft",
  "comparison-proof": "performance",
  "condition-proof": "condition",
  "defect-disclosure": "defects",
  "gift-packaging": "packageContents",
};

const CATEGORY_OVERLAYS = {
  "apparel-fit": {
    imageType: "scale-proof",
    replaceImageTypes: ["multi-angle", "lifestyle-first", "benefit-proof"],
  },
  "electronics-specifications": {
    imageType: "spec-table",
    replaceImageTypes: ["lifestyle-first", "multi-angle", "benefit-proof"],
  },
  "food-ingredients": {
    imageType: "material-proof",
    replaceImageTypes: ["multi-angle", "lifestyle-first", "benefit-proof"],
  },
  "package-contents": {
    imageType: "in-box",
    replaceImageTypes: ["lifestyle-first", "multi-angle", "benefit-proof"],
  },
  condition: {
    imageType: "condition-proof",
    replaceImageTypes: ["lifestyle-first", "multi-angle", "benefit-proof"],
  },
  "multiple-skus": {
    imageType: "variant-comparison",
    replaceImageTypes: ["in-box", "multi-angle", "lifestyle-first"],
  },
};

const REFERENCE_COVERAGE_OVERLAYS = {
  usage: {
    imageType: "usage-demo",
    replaceImageTypes: ["benefit-proof", "lifestyle-first", "multi-angle"],
  },
  scene: {
    imageType: "lifestyle-first",
    replaceImageTypes: ["benefit-proof", "multi-angle", "clean-product-proof"],
  },
  material: {
    imageType: "material-proof",
    replaceImageTypes: ["multi-angle", "benefit-proof", "lifestyle-first"],
  },
  dimensions: {
    imageType: "dimension-fit",
    replaceImageTypes: ["multi-angle", "benefit-proof", "lifestyle-first"],
  },
  package: {
    imageType: "in-box",
    replaceImageTypes: ["lifestyle-first", "multi-angle", "benefit-proof"],
  },
  condition: {
    imageType: "condition-proof",
    replaceImageTypes: ["lifestyle-first", "multi-angle", "benefit-proof"],
  },
  defect: {
    imageType: "defect-disclosure",
    replaceImageTypes: ["lifestyle-first", "multi-angle", "benefit-proof"],
  },
};

function cleanString(value) {
  return String(value ?? "").trim();
}

function cloneValue(value) {
  return value == null ? value : JSON.parse(JSON.stringify(value));
}

function uniqueStrings(values = []) {
  return [...new Set(values.map(cleanString).filter(Boolean))];
}

function normalizeAudienceList(value, maxItems = 5) {
  const values = Array.isArray(value) ? value : cleanString(value) ? [value] : [];
  return uniqueStrings(values).slice(0, maxItems);
}

export function normalizeCreationAudienceStrategy(value = {}) {
  const source = parseJson(value, {});
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const confidenceValue = cleanString(source.confidence).toLowerCase();
  const confidence = ["low", "medium", "high"].includes(confidenceValue) ? confidenceValue : "low";
  const sourceValue = cleanString(source.source || source.audienceSource || source.audience_source).toLowerCase();
  const normalizedSource = ["user", "analysis-suggestion", "platform-default", "category-default"].includes(sourceValue)
    ? sourceValue
    : "analysis-suggestion";
  const normalized = {
    targetAudience: cleanString(source.targetAudience || source.target_audience),
    purchaseMotivations: normalizeAudienceList(source.purchaseMotivations || source.purchase_motivations),
    purchaseObjections: normalizeAudienceList(source.purchaseObjections || source.purchase_objections),
    desiredOutcome: cleanString(source.desiredOutcome || source.desired_outcome),
    evidenceBasis: normalizeAudienceList(source.evidenceBasis || source.evidence_basis),
    confidence,
    source: normalizedSource,
  };
  return normalized.targetAudience || normalized.purchaseMotivations.length || normalized.purchaseObjections.length ||
    normalized.desiredOutcome || normalized.evidenceBasis.length ? normalized : {};
}

function normalizeConversionIntent(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalized = {
    audienceFocus: cleanString(value.audienceFocus || value.audience_focus),
    motivationFocus: cleanString(value.motivationFocus || value.motivation_focus),
    objectionFocus: cleanString(value.objectionFocus || value.objection_focus),
    conversionGoal: cleanString(value.conversionGoal || value.conversion_goal),
    evidenceFocus: cleanString(value.evidenceFocus || value.evidence_focus),
  };
  return Object.values(normalized).some(Boolean) ? normalized : null;
}

function parseJson(value, fallback) {
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch (_error) {
    return fallback;
  }
}

function normalizeBoolean(value) {
  if (typeof value === "boolean") return value;
  const normalized = cleanString(value).toLowerCase();
  if (["true", "1", "yes", "on"].includes(normalized)) return true;
  if (["false", "0", "no", "off"].includes(normalized)) return false;
  return null;
}

function normalizeNonNegativeInteger(value) {
  if (value === undefined || value === null || cleanString(value) === "") return null;
  const parsed = Number.parseInt(cleanString(value), 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

export function normalizeCreationPlatformSetOverrides(value = {}) {
  const source = parseJson(value, {});
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};

  const normalized = {};
  for (const field of SET_OVERRIDE_FIELDS) {
    const fieldValue = cleanString(source[field]);
    if (fieldValue) normalized[field] = fieldValue;
  }
  const imageCount = normalizeNonNegativeInteger(source.imageCount ?? source.carouselImageCount);
  if (imageCount !== null) normalized.imageCount = imageCount;
  return normalized;
}

function normalizeItemOverride(entry = {}) {
  if (!entry || typeof entry !== "object" || Array.isArray(entry)) return null;
  const slotKey = cleanString(entry.slotKey || entry.itemId || entry.id);
  if (!slotKey) return null;

  const normalized = { slotKey };
  for (const field of ITEM_OVERRIDE_FIELDS) {
    const fieldValue = cleanString(entry[field]);
    if (fieldValue) normalized[field] = fieldValue;
  }
  const enabled = normalizeBoolean(entry.enabled);
  if (enabled !== null) normalized.enabled = enabled;
  const order = normalizeNonNegativeInteger(entry.order);
  if (order !== null) normalized.order = order;
  const conversionIntent = normalizeConversionIntent(entry.conversionIntent || entry.conversion_intent);
  if (conversionIntent) normalized.conversionIntent = conversionIntent;

  return Object.keys(normalized).length > 1 ? normalized : null;
}

export function normalizeCreationPlatformItemOverrides(value = []) {
  const entries = parseJson(value, []);
  if (!Array.isArray(entries)) return [];
  return entries.map(normalizeItemOverride).filter(Boolean);
}

function normalizeCategoryText(category) {
  if (category && typeof category === "object" && !Array.isArray(category)) {
    return [
      category.value,
      category.code,
      category.categoryPath,
      category.level1Name,
      category.level2Name,
      category.level3Name,
      category.level4Name,
      category.label,
    ]
      .map(cleanString)
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
  }
  return cleanString(category).toLowerCase();
}

function normalizeCategorySignal(value) {
  const normalized = cleanString(value).toLowerCase();
  const aliases = {
    apparel: "apparel-fit",
    "apparel-fit": "apparel-fit",
    electronics: "electronics-specifications",
    "electronics-specifications": "electronics-specifications",
    food: "food-ingredients",
    "food-ingredients": "food-ingredients",
    package: "package-contents",
    "package-contents": "package-contents",
    condition: "condition",
    "multiple-skus": "multiple-skus",
    variants: "multiple-skus",
  };
  return aliases[normalized] || "";
}

export function getCreationPlatformCategorySignals(category, explicitSignals = []) {
  const text = normalizeCategoryText(category);
  const signals = [];

  if (text === "apparel" || /(?:^|\s|:)c01(?:-|\s|$)/.test(text)) signals.push("apparel-fit");
  if (text === "electronics" || /(?:^|\s|:)c0[67](?:-|\s|$)/.test(text)) signals.push("electronics-specifications");
  if (text === "food" || /(?:^|\s|:)c08(?:-|\s|$)/.test(text)) signals.push("food-ingredients");

  const rawSignals = Array.isArray(explicitSignals) ? explicitSignals : [explicitSignals];
  for (const value of rawSignals) {
    const normalized = normalizeCategorySignal(value);
    if (normalized) signals.push(normalized);
  }
  return uniqueStrings(signals);
}

function normalizeReferenceCoverage(input = {}) {
  const direct = Array.isArray(input.referenceCoverage)
    ? input.referenceCoverage
    : Array.isArray(input.referenceCoverage?.recommendations)
      ? input.referenceCoverage.recommendations
      : Array.isArray(input.referenceAnalysis?.recommendations)
        ? input.referenceAnalysis.recommendations
        : [];

  return direct
    .map((entry) => {
      if (typeof entry === "string") return { role: cleanString(entry), filename: "", note: "" };
      return {
        role: cleanString(entry?.role),
        filename: cleanString(entry?.filename || entry?.name),
        note: cleanString(entry?.note),
      };
    })
    .filter((entry) => entry.role);
}

function normalizeEvidence(value = {}, referenceCoverage = []) {
  const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const evidence = {
    dimensions: Boolean(source.dimensions),
    materials: Boolean(source.materials || source.ingredients),
    packageContents: Boolean(source.packageContents || source.package || source.inBox),
    performance: Boolean(source.performance || source.comparison),
    specifications: Boolean(source.specifications || source.specs),
    craft: Boolean(source.craft || source.process),
    condition: Boolean(source.condition),
    defects: Boolean(source.defects || source.defect),
    skuVariants: Boolean(source.skuVariants || source.variants),
  };

  for (const entry of referenceCoverage) {
    if (entry.role === "dimensions") {
      evidence.dimensions = true;
      evidence.specifications = true;
    } else if (entry.role === "material") {
      evidence.materials = true;
    } else if (entry.role === "package") {
      evidence.packageContents = true;
    } else if (entry.role === "condition") {
      evidence.condition = true;
    } else if (entry.role === "defect") {
      evidence.defects = true;
    }
  }
  return evidence;
}

function getStableSkuSubjectId(subject, index) {
  if (typeof subject === "string") return cleanString(subject);
  if (!subject || typeof subject !== "object") return "";
  const filenames = Array.isArray(subject.filenames) ? subject.filenames.map(cleanString).filter(Boolean) : [];
  return cleanString(subject.id || subject.subjectId || subject.stableId || filenames.join("|") || subject.title || subject.name || `sku-${index + 1}`);
}

function normalizeSkuSubjectIds(value = []) {
  const subjects = Array.isArray(value) ? value : [];
  return uniqueStrings(subjects.map(getStableSkuSubjectId));
}

function createImageTypeSlot(imageTypeValue, template, source = "platform") {
  const definition = CREATION_PLATFORM_IMAGE_TYPE_REGISTRY[imageTypeValue];
  if (!definition) return null;
  const hasBlockingConstraint = definition.constraints.some((constraint) => constraint.level === "blocking");
  return {
    ...template,
    imageType: definition.imageType,
    imageTypeLabel: definition.imageTypeLabel,
    role: definition.role,
    composition: definition.composition,
    textPolicy: definition.textPolicy,
    scenePolicy: definition.scenePolicy,
    logoPolicy: definition.logoPolicy,
    required: definition.requiredByDefault,
    advisory: !hasBlockingConstraint,
    constraints: cloneValue(definition.constraints),
    sourceIds: uniqueStrings([...(template.sourceIds || []), ...definition.sourceIds]),
    recommendationSource: source,
  };
}

function replaceWithRecommendation(slots, recommendation, source) {
  if (!recommendation || slots.some((slot) => slot.imageType === recommendation.imageType)) return slots;
  const replacementIndex = recommendation.replaceImageTypes
    .map((imageTypeValue) => slots.findIndex((slot) => slot.imageType === imageTypeValue && !slot.required))
    .find((index) => index >= 0);
  if (!Number.isFinite(replacementIndex) || replacementIndex < 0) return slots;
  const replacement = createImageTypeSlot(recommendation.imageType, slots[replacementIndex], source);
  if (!replacement) return slots;
  return slots.map((slot, index) => (index === replacementIndex ? replacement : slot));
}

function applyCategoryOverlays(slots, categorySignals) {
  return categorySignals.reduce(
    (current, signal) => replaceWithRecommendation(current, CATEGORY_OVERLAYS[signal], `category:${signal}`),
    slots,
  );
}

function applyReferenceCoverageOverlays(slots, referenceCoverage) {
  return referenceCoverage.reduce(
    (current, entry) => replaceWithRecommendation(current, REFERENCE_COVERAGE_OVERLAYS[entry.role], `reference:${entry.role}`),
    slots,
  );
}

function hasEvidenceForImageType(imageTypeValue, evidence) {
  const evidenceKey = IMAGE_TYPE_EVIDENCE_KEYS[imageTypeValue];
  return !evidenceKey || Boolean(evidence[evidenceKey]);
}

function applyEvidenceFallbacks(slots, evidence, warnings) {
  const usedImageTypes = new Set(slots.map((slot) => slot.imageType));
  const resolved = [];

  for (const slot of slots) {
    if (hasEvidenceForImageType(slot.imageType, evidence)) {
      resolved.push(slot);
      continue;
    }

    usedImageTypes.delete(slot.imageType);
    const fallbackImageType = SAFE_FALLBACK_IMAGE_TYPES.find(
      (candidate) => !usedImageTypes.has(candidate) && hasEvidenceForImageType(candidate, evidence),
    );
    if (!fallbackImageType) {
      warnings.push({
        code: "missing-evidence-slot-omitted",
        level: "warning",
        slotKey: slot.slotKey,
        imageType: slot.imageType,
        message: `Omitted ${slot.imageType} because its required product evidence is unavailable.`,
      });
      continue;
    }

    const replacement = createImageTypeSlot(fallbackImageType, slot, "evidence-fallback");
    usedImageTypes.add(fallbackImageType);
    resolved.push(replacement);
    warnings.push({
      code: "missing-evidence-slot-replaced",
      level: "warning",
      slotKey: slot.slotKey,
      imageType: slot.imageType,
      replacementImageType: fallbackImageType,
      message: `Replaced ${slot.imageType} with ${fallbackImageType} because its required product evidence is unavailable.`,
    });
  }
  return resolved;
}

function applySetOverrides(slots, setOverrides, { profile, evidence, warnings }) {
  let resized = [...slots];
  if (Number.isFinite(setOverrides.imageCount)) {
    const requestedCount = Math.max(0, setOverrides.imageCount);
    resized = resized.slice(0, requestedCount);
    const usedImageTypes = new Set(resized.map((slot) => slot.imageType));
    while (resized.length < requestedCount) {
      const nextImageType = EXTENDED_SLOT_IMAGE_TYPES.find(
        (candidate) => !usedImageTypes.has(candidate) && hasEvidenceForImageType(candidate, evidence),
      );
      if (!nextImageType) {
        warnings.push({
          code: "image-count-extension-limited",
          level: "warning",
          requestedCount,
          effectiveCount: resized.length,
          message: "The requested image count exceeds the distinct evidence-supported image types available for this plan.",
        });
        break;
      }

      const slotKey = `${profile.id}:extra:${nextImageType}`;
      const template = {
        ...cloneValue(profile.slots[0]),
        slotKey,
        itemId: slotKey,
        itemKind: "carousel",
        enabled: true,
        ratio: profile.defaultRatio,
        resolutionTier: profile.resolutionTier,
        targetLanguage: profile.targetLanguage,
        recommendationSource: "set-count-extension",
      };
      const nextSlot = createImageTypeSlot(nextImageType, template, "set-count-extension");
      resized.push(nextSlot);
      usedImageTypes.add(nextImageType);
    }
  }
  return resized.map((slot) => {
    const next = { ...slot };
    for (const field of SET_OVERRIDE_FIELDS) {
      if (setOverrides[field] !== undefined) next[field] = setOverrides[field];
    }
    return next;
  });
}

function applyKnownImageTypeOverride(slot, imageTypeValue) {
  if (imageTypeValue === "custom") {
    return {
      ...slot,
      imageType: "custom",
      imageTypeLabel: "自定义图片",
      required: false,
      advisory: true,
      constraints: [],
      recommendationSource: "item-override",
    };
  }
  return createImageTypeSlot(imageTypeValue, slot, "item-override") || slot;
}

function applyItemOverrides(slots, itemOverrides, warnings) {
  const overridden = slots.map((slot, index) => {
    const override = itemOverrides.find((entry) => entry.slotKey === slot.slotKey || entry.slotKey === slot.itemId);
    const base = { ...slot, enabled: slot.enabled !== false, _baseOrder: index };
    if (!override) return base;

    let next = override.imageType ? applyKnownImageTypeOverride(base, override.imageType) : base;
    if (override.imageType === "custom") {
      warnings.push({
        code: "custom-image-type",
        level: "warning",
        slotKey: slot.slotKey,
        message: "Custom image types are not guaranteed to comply with the selected platform.",
      });
    }
    for (const field of ITEM_OVERRIDE_FIELDS) {
      if (field === "imageType") continue;
      if (override[field] !== undefined) next[field] = override[field];
    }
    if (override.conversionIntent) next.conversionIntent = cloneValue(override.conversionIntent);
    if (override.enabled !== undefined) next.enabled = override.enabled;
    if (override.order !== undefined) next._baseOrder = override.order;
    return next;
  });

  const knownSlotKeys = new Set(slots.flatMap((slot) => [slot.slotKey, slot.itemId]).filter(Boolean));
  const template = slots[0] || {};
  for (const [index, override] of itemOverrides.entries()) {
    if (knownSlotKeys.has(override.slotKey) || override.imageType !== "custom") continue;
    let customSlot = applyKnownImageTypeOverride({
      ...template,
      slotKey: override.slotKey,
      itemId: override.slotKey,
      itemKind: "carousel",
      role: "product-detail",
      enabled: true,
      required: false,
      advisory: true,
      sourceIds: [],
      constraints: [],
      _baseOrder: slots.length + index,
    }, "custom");
    for (const field of ITEM_OVERRIDE_FIELDS) {
      if (field === "imageType") continue;
      if (override[field] !== undefined) customSlot[field] = override[field];
    }
    if (override.conversionIntent) customSlot.conversionIntent = cloneValue(override.conversionIntent);
    if (override.enabled !== undefined) customSlot.enabled = override.enabled;
    if (override.order !== undefined) customSlot._baseOrder = override.order;
    overridden.push(customSlot);
    warnings.push({
      code: "custom-image-type",
      level: "warning",
      slotKey: override.slotKey,
      message: "Custom image types are not guaranteed to comply with the selected platform.",
    });
  }

  return overridden
    .sort((left, right) => left._baseOrder - right._baseOrder)
    .map((slot, index) => {
      const { _baseOrder, ...cleanSlot } = slot;
      return { ...cleanSlot, slotIndex: index + 1 };
    });
}

function getCategoryAudienceContext(categorySignals = []) {
  const signals = new Set(categorySignals);
  if (signals.has("apparel-fit")) {
    return { motivation: "confirm fit and wearing confidence", objection: "uncertain fit or scale" };
  }
  if (signals.has("electronics-specifications")) {
    return { motivation: "confirm compatibility and useful capability", objection: "uncertain specifications or compatibility" };
  }
  if (signals.has("food-ingredients")) {
    return { motivation: "understand ingredients and serving relevance", objection: "unclear ingredients or package information" };
  }
  if (signals.has("package-contents")) {
    return { motivation: "confirm what is included", objection: "uncertain package completeness" };
  }
  return { motivation: "understand whether the product fits the intended use", objection: "unclear product fit" };
}

function buildEffectiveAudienceStrategy(profile, categorySignals, inputStrategy) {
  const supplied = normalizeCreationAudienceStrategy(inputStrategy);
  const marketingContext = cloneValue(profile.marketingContext || {});
  const categoryContext = getCategoryAudienceContext(categorySignals);
  const source = supplied.source || "platform-default";
  const targetAudience = supplied.targetAudience || "buyers evaluating this product category";
  const purchaseMotivations = uniqueStrings([
    ...(supplied.purchaseMotivations || []),
    categoryContext.motivation,
    ...(marketingContext.defaultMotivations || []),
  ]).slice(0, 5);
  const purchaseObjections = uniqueStrings([
    ...(supplied.purchaseObjections || []),
    categoryContext.objection,
    ...(marketingContext.defaultObjections || []),
  ]).slice(0, 5);
  return {
    targetAudience,
    purchaseMotivations,
    purchaseObjections,
    desiredOutcome: supplied.desiredOutcome || "make a confident product choice",
    evidenceBasis: supplied.evidenceBasis || [],
    confidence: supplied.confidence || "low",
    source,
    marketingContext,
    provenance: {
      targetAudience: supplied.targetAudience ? source : "platform-default",
      purchaseMotivations: supplied.purchaseMotivations?.length ? source : "platform-category",
      purchaseObjections: supplied.purchaseObjections?.length ? source : "platform-category",
      desiredOutcome: supplied.desiredOutcome ? source : "platform-default",
    },
  };
}

function getConversionGoal(slot = {}) {
  const role = cleanString(slot.role);
  if (role === "hero") return "create instant product recognition and connect it to the primary purchase motivation";
  if (["benefit", "usage-suggestion", "effect-comparison"].includes(role)) return "turn supplied product evidence into a clear buyer outcome";
  if (["scene", "atmosphere", "human-handheld", "human-wearable"].includes(role)) return "help the buyer imagine a believable ownership or use moment";
  if (["size-capacity-fit", "spec-table", "multi-angle", "product-detail", "ingredient-material", "craft-process"].includes(role)) return "reduce product, fit, specification, or quality uncertainty with factual evidence";
  if (["sku", "series-showcase", "accessory-gift"].includes(role)) return "reduce choice and package-completeness uncertainty";
  if (role === "after-sales") return "provide only supplied reassurance that helps the buyer decide confidently";
  if (role === "infographic-rebuild") return "preserve source facts while making the decision evidence easier to understand";
  return "answer a distinct buyer decision question with supplied evidence";
}

function assignConversionIntents(slots, strategy) {
  return slots.map((slot, index) => {
    const motivation = strategy.purchaseMotivations[index % Math.max(strategy.purchaseMotivations.length, 1)] || "understand product value";
    const objection = strategy.purchaseObjections[index % Math.max(strategy.purchaseObjections.length, 1)] || "unclear product fit";
    return {
      ...slot,
      conversionIntent: {
        audienceFocus: strategy.targetAudience,
        motivationFocus: motivation,
        objectionFocus: objection,
        conversionGoal: getConversionGoal(slot),
        evidenceFocus: strategy.evidenceBasis[index % Math.max(strategy.evidenceBasis.length, 1)] || "use only supplied product and reference evidence",
        ...(slot.conversionIntent || {}),
      },
    };
  });
}

const PROMPT_ACTION_VERB_SOURCE =
  "(?:add(?:ing|ed|s)?|creat(?:e[sd]?|ing)|includ(?:e[sd]?|ing)|show(?:s|ed|ing)?|render(?:s|ed|ing)?|plac(?:e[sd]?|ing)|appl(?:y|ies|ied|ying)|overlay(?:s|ed|ing)?|overlaid|display(?:s|ed|ing)?|insert(?:s|ed|ing)?|put(?:s|ting)?|mak(?:e[sd]?|ing)|made|generat(?:e[sd]?|ing)|design(?:s|ed|ing)?|us(?:e[sd]?|ing)|featur(?:e[sd]?|ing)|produc(?:e[sd]?|ing)|draw(?:s|n|ing)?|drew)";
const PROMPT_NEGATION_PATTERN = new RegExp(
  `(?:\\b(?:do\\s+not|don't|never|avoid|without|exclude|forbid|forbids|prohibit|prohibits|no|not\\s+to|free\\s+of)\\b|不要|不得|禁止|避免|不可|切勿|不应)[^.!?;:\\n。！？；]*$`,
  "iu",
);
const PROMPT_AFFIRMATIVE_PATTERN = new RegExp(
  `(?:\\b${PROMPT_ACTION_VERB_SOURCE}\\b|添加|加入|展示|显示|渲染|放置|叠加|插入|制作)[^.!?;:\\n。！？；]*$`,
  "iu",
);
const PROMPT_CONTRAST_PATTERN = /\b(?:but|however|yet|instead|then)\b/giu;
const PROMPT_NEW_IMPERATIVE_PATTERN = new RegExp(
  `(?:,\\s*|\\b(?:and|or)\\s+)(?=(?:please\\s+)?${PROMPT_ACTION_VERB_SOURCE}\\b)|(?:，\\s*|并且?|或)(?=(?:请)?(?:添加|加入|展示|显示|渲染|放置|叠加|插入|制作))`,
  "giu",
);

function getPromptClausePrefix(value, termIndex) {
  const beforeTerm = value.slice(0, termIndex);
  let clauseStart = Math.max(
    beforeTerm.lastIndexOf("."),
    beforeTerm.lastIndexOf("!"),
    beforeTerm.lastIndexOf("?"),
    beforeTerm.lastIndexOf(";"),
    beforeTerm.lastIndexOf("\n"),
    beforeTerm.lastIndexOf("。"),
    beforeTerm.lastIndexOf("！"),
    beforeTerm.lastIndexOf("？"),
    beforeTerm.lastIndexOf("；"),
  );

  for (const match of beforeTerm.matchAll(PROMPT_CONTRAST_PATTERN)) {
    clauseStart = Math.max(clauseStart, Number(match.index) + match[0].length - 1);
  }
  for (const match of beforeTerm.matchAll(PROMPT_NEW_IMPERATIVE_PATTERN)) {
    clauseStart = Math.max(clauseStart, Number(match.index) + match[0].length - 1);
  }
  return beforeTerm.slice(clauseStart + 1);
}

function promptUsesForbiddenValueAsProductIdentity(prompt, termIndex, forbiddenLength) {
  const clausePrefix = getPromptClausePrefix(prompt, termIndex);
  const suffix = prompt.slice(termIndex + forbiddenLength);
  return (
    /\b(?:image|photo|picture|rendering|shot)\s+(?:of|for)\s+(?:the\s+)?$/iu.test(clausePrefix) ||
    /^\s+(?:holder|remover|maker|kit|device|product|model|tool|cleaner|frame|stand|case|reel|pen)\b/iu.test(
      suffix,
    )
  );
}

function promptRequestsForbiddenValue(value, forbiddenValue) {
  const prompt = cleanString(value).toLowerCase();
  const forbidden = cleanString(forbiddenValue).toLowerCase();
  if (!prompt || !forbidden) return false;

  let searchFrom = 0;
  while (searchFrom < prompt.length) {
    const termIndex = prompt.indexOf(forbidden, searchFrom);
    if (termIndex === -1) return false;
    const suffix = prompt.slice(termIndex + forbidden.length);
    if (/^\s*-\s*free\b|^\s+free\b/iu.test(suffix)) {
      searchFrom = termIndex + forbidden.length;
      continue;
    }
    if (promptUsesForbiddenValueAsProductIdentity(prompt, termIndex, forbidden.length)) {
      searchFrom = termIndex + forbidden.length;
      continue;
    }
    const clausePrefix = getPromptClausePrefix(prompt, termIndex);
    if (
      !PROMPT_NEGATION_PATTERN.test(clausePrefix) &&
      PROMPT_AFFIRMATIVE_PATTERN.test(clausePrefix)
    ) {
      return true;
    }
    searchFrom = termIndex + forbidden.length;
  }
  return false;
}

function getConstraintPromptForbiddenValues(constraint = {}) {
  if (constraint.operator !== "equals") return [];
  if (constraint.field === "textPolicy" && constraint.value === "none") {
    return [
      "marketing copy",
      "marketing text",
      "visible text",
      "text overlay",
      "sale badge",
      "sale text",
      "price badge",
      "discount badge",
    ];
  }
  if (constraint.field === "composition") {
    return ["collage", "montage", "multi-panel", "scene inset"];
  }
  if (constraint.field === "logoPolicy" && constraint.value === "forbid-overlay") {
    return ["external logo", "uploaded logo", "logo overlay"];
  }
  return [];
}

function getConstraintConflict(slot, constraint) {
  const actual = slot[constraint.field];
  if (constraint.operator === "equals" && actual !== constraint.value) {
    return { field: constraint.field, actual };
  }

  const promptForbiddenValues =
    constraint.operator === "forbids" ? [constraint.value] : getConstraintPromptForbiddenValues(constraint);
  if (promptForbiddenValues.some((value) => promptRequestsForbiddenValue(slot.prompt, value))) {
    return { field: "prompt", actual: slot.prompt };
  }
  return null;
}

export function validateCreationPlatformPlan(plan = {}) {
  const slots = Array.isArray(plan.slots) ? plan.slots : Array.isArray(plan.items) ? plan.items : [];
  const errors = [];

  for (const slot of slots.filter((entry) => entry.enabled !== false)) {
    for (const constraint of Array.isArray(slot.constraints) ? slot.constraints : []) {
      if (constraint.level !== "blocking") continue;
      const conflict = getConstraintConflict(slot, constraint);
      if (!conflict) continue;
      errors.push({
        code: "hard-rule-conflict",
        level: "blocking",
        slotKey: slot.slotKey,
        itemId: slot.itemId,
        imageType: slot.imageType,
        constraintId: constraint.id,
        field: conflict.field,
        expected: constraint.value,
        actual: conflict.actual,
        sourceIds: cloneValue(constraint.sourceIds || []),
        message: constraint.message,
      });
    }
  }

  return { isValid: errors.length === 0, errors };
}

export function resolveCreationPlatformPlan(input = {}) {
  const requestedPlatform = cleanString(
    input.platform || input.creationPlatform || input.ecommercePlatform || input.platform_id || "universal",
  ).toLowerCase();
  const platformKnown = Boolean(CREATION_PLATFORM_PROFILE_REGISTRY[requestedPlatform]);
  const platform = platformKnown ? requestedPlatform : "universal";
  const profile = getCreationPlatformProfile(platform);
  const warnings = [];

  if (!platformKnown) {
    warnings.push({
      code: "unknown-platform",
      level: "warning",
      requestedPlatform,
      message: `Unknown platform ${requestedPlatform}; using the universal ecommerce profile.`,
    });
  }
  if (profile.evidenceLevel === "C") {
    warnings.push({
      code: "advisory-platform-profile",
      level: "warning",
      platform,
      message: `${profile.label} uses conservative guidance rather than verified official hard rules.`,
    });
  }

  const referenceCoverage = normalizeReferenceCoverage(input);
  const skuSubjectIds = normalizeSkuSubjectIds(input.skuSubjects ?? input.sku_subjects);
  const evidence = normalizeEvidence(input.evidence, referenceCoverage);
  evidence.skuVariants = evidence.skuVariants || skuSubjectIds.length >= 2;
  const categorySignals = getCreationPlatformCategorySignals(
    input.category || input.industryTemplate || input.categoryTemplate,
    input.categorySignals,
  );
  if (skuSubjectIds.length >= 2 && input.categorySignals?.includes?.("multiple-skus")) {
    categorySignals.push("multiple-skus");
  }

  let slots = cloneValue(profile.slots).map((slot, index) => ({
    ...slot,
    itemId: slot.slotKey,
    itemKind: "carousel",
    enabled: true,
    slotIndex: index + 1,
    recommendationSource: "platform",
  }));
  slots = applyCategoryOverlays(slots, uniqueStrings(categorySignals));
  slots = applyReferenceCoverageOverlays(slots, referenceCoverage);
  slots = applyEvidenceFallbacks(slots, evidence, warnings);

  const setOverrides = normalizeCreationPlatformSetOverrides(input.setOverrides || input.platformSetOverrides);
  const itemOverrides = normalizeCreationPlatformItemOverrides(input.itemOverrides || input.platformItemOverrides);
  slots = applySetOverrides(slots, setOverrides, { profile, evidence, warnings });
  slots = applyItemOverrides(slots, itemOverrides, warnings);
  const audienceStrategy = normalizeCreationAudienceStrategy(input.audienceStrategy || input.audience_strategy);
  const effectiveAudienceStrategy = buildEffectiveAudienceStrategy(profile, uniqueStrings(categorySignals), audienceStrategy);
  slots = assignConversionIntents(slots, effectiveAudienceStrategy);

  const enabledItems = slots.filter((slot) => slot.enabled !== false);
  const infographicRebuildCount = normalizeNonNegativeInteger(
    input.infographicRebuildCount ?? input.infographic_rebuild_count,
  ) ?? 0;
  const validation = validateCreationPlatformPlan({ slots });
  const carouselImageCount = enabledItems.length;

  return {
    requestedPlatform,
    platform,
    platformLabel: profile.label,
    strategyVersion: profile.strategyVersion,
    evidenceLevel: profile.evidenceLevel,
    verifiedAt: profile.verifiedAt,
    sourceIds: cloneValue(profile.sourceIds),
    profile,
    categorySignals: uniqueStrings(categorySignals),
    referenceCoverage,
    evidence,
    setOverrides,
    itemOverrides,
    audienceStrategy,
    effectiveAudienceStrategy,
    slots,
    items: enabledItems,
    carouselImageCount,
    imageCount: carouselImageCount,
    skuSubjectIds,
    skuImageCount: skuSubjectIds.length,
    infographicRebuildCount,
    totalPlannedItemCount: carouselImageCount + skuSubjectIds.length + infographicRebuildCount,
    warnings,
    errors: validation.errors,
    validation: { ...validation, warnings },
    canGenerate: validation.isValid,
  };
}

export function restoreCreationPlatformRecommendations(input = {}) {
  return resolveCreationPlatformPlan({
    ...input,
    setOverrides: {},
    platformSetOverrides: {},
    itemOverrides: [],
    platformItemOverrides: [],
  });
}
