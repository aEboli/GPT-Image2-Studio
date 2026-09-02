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
const CUSTOM_ROLE_LIFESTYLE_ROLES = new Set([
  "scene",
  "atmosphere",
  "usage-suggestion",
  "human-handheld",
  "human-wearable",
]);
const CUSTOM_ROLE_STORY_ROLES = new Set([
  "hero",
  "benefit",
  "brand-story",
  "after-sales",
]);
const GENERIC_AUDIENCE_TARGET = "buyers evaluating this product category";
const GENERIC_AUDIENCE_OUTCOME = "make a confident product choice";
const SENSITIVE_AUDIENCE_PATTERNS = [
  /\b(?:age(?:d)?|teen(?:ager)?s?|children?|kids?|bab(?:y|ies)|elderly|seniors?|young adults?|middle[- ]aged)\b/iu,
  /\b(?:age[sd]?\s*)?\d{1,2}(?:\s*[-–]\s*\d{1,2})?\s*(?:years? old|year[- ]olds?)\b/iu,
  /\b(?:male|female|men|women|gender|transgender|nonbinary|pregnan(?:t|cy)|maternity)\b/iu,
  /\b(?:race|racial|ethnic(?:ity)?|nationality|asian|african|caucasian|latino|hispanic)\b/iu,
  /\b(?:black|white|african american)\s+(?:buyers?|consumers?|people|persons?|men|women|families|users?)\b/iu,
  /\b(?:american|chinese|japanese|korean|indian|british|french|german|mexican|canadian)s?\s+(?:buyers?|consumers?|people|persons?|men|women|families|users?)\b/iu,
  /\b(?:religion|religious|christian|muslim|islamic|jewish|hindu|buddhist)\b/iu,
  /\b(?:disabled|disability|patient|diabetic|cancer|disease|medical condition|mental health|depression|anxiety)\b/iu,
  /\b(?:sexual orientation|gay|lesbian|bisexual)\b/iu,
  /\b(?:income|salary|wealthy|low[- ]income|high[- ]income|poor|rich)\b/iu,
  /(?:美国|中国|日本|韩国|印度|英国|法国|德国|墨西哥|加拿大)(?:买家|消费者|用户|人群|家庭|男性|女性|男士|女士)/u,
  /(?:年龄|\d{1,2}\s*岁|老年人?|中年人?|青少年|儿童|婴儿|宝宝|年轻人|男性|女性|男士|女士|性别|跨性别|孕妇|怀孕|种族|民族|国籍|黑人|白人|美国人|中国人|日本人|韩国人|印度人|宗教|基督徒|穆斯林|犹太|印度教|佛教|残疾|残障|患者|病人|糖尿病|癌症|抑郁|焦虑|性取向|同性恋|双性恋|收入|薪资|高收入|低收入|富人|穷人)/u,
];
const UNSUPPORTED_AUDIENCE_CLAIM_PATTERNS = [
  /\b(?:fda|ce|ul|iso)\s*(?:certified|approved|compliant|certification)?\b/iu,
  /\b(?:certif(?:ied|ication)|officially approved|clinically proven|doctor recommended)\b/iu,
  /\b(?:best[- ]seller|number one|#\s*1|sales? (?:leader|champion))\b/iu,
  /\b(?:over|more than)?\s*\d+(?:[.,]\d+)*(?:\s*(?:k|m|million|thousand))?\s+(?:units?\s+)?sold\b/iu,
  /\b(?:guarantee(?:d)?|warrant(?:y|ied)|money[- ]back)\b/iu,
  /\b(?:five[- ]star|5[- ]star|ratings?|reviews?|testimonials?)\b/iu,
  /\b[0-5](?:\.\d+)?\s*(?:\/\s*5|stars?)\b/iu,
  /(?:[$¥€£]\s*\d|\b\d+(?:\.\d+)?\s*(?:usd|cny|rmb|eur|gbp)\b|\b(?:lowest|best|special|exclusive)\s+price\b|\b\d+(?:\.\d+)?%\s*off\b)/iu,
  /\b\d+(?:\.\d+)?\s*(?:x|times)\s+(?:faster|stronger|better|longer|more|performance)\b/iu,
  /\b100%\s+(?:leakproof|effective|guaranteed|safe|waterproof)\b/iu,
  /\b(?:cure[sd]?|treats?|prevents?|heals?|therapeutic|health (?:benefit|outcome|effect|improvement))\b/iu,
  /(?:认证|官方批准|权威背书|临床验证|医生推荐|销量(?:第一|冠军)|全网第一|爆款|已售\s*\d+(?:\.\d+)?\s*(?:万|千|件|单)?|最低价|全网最低|特价|到手价|优惠价|售价\s*[¥￥]?\s*\d+|\d+(?:\.\d+)?\s*折|\d+(?:\.\d+)?\s*倍(?:更快|更强|提升|性能|效果)|\d(?:\.\d+)?\s*(?:分|星)|百分百(?:有效|防水|安全|保证)|保证|担保|保修|质保|退款|好评|五星|治愈|治疗|预防|疗效|健康功效|保健功效)/u,
];

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
  feature: {
    imageType: "comparison-proof",
    replaceImageTypes: ["variant-comparison", "multi-angle", "benefit-proof", "lifestyle-first"],
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

function hasCreationAudienceTextRisk(value) {
  const text = cleanString(value);
  return Boolean(text) && (
    SENSITIVE_AUDIENCE_PATTERNS.some((pattern) => pattern.test(text)) ||
    UNSUPPORTED_AUDIENCE_CLAIM_PATTERNS.some((pattern) => pattern.test(text))
  );
}

function sanitizeCreationAudienceText(value) {
  const text = cleanString(value);
  return text && !hasCreationAudienceTextRisk(text) ? text : "";
}

function normalizeAudienceList(value, maxItems = 5) {
  const values = Array.isArray(value) ? value : cleanString(value) ? [value] : [];
  return uniqueStrings(values).map(sanitizeCreationAudienceText).filter(Boolean).slice(0, maxItems);
}

function hasAudienceStrategyContent(value = {}) {
  return Boolean(cleanString(value.targetAudience || value.target_audience) || normalizeAudienceList(value.purchaseMotivations || value.purchase_motivations).length || normalizeAudienceList(value.purchaseObjections || value.purchase_objections).length || cleanString(value.desiredOutcome || value.desired_outcome) || normalizeAudienceList(value.evidenceBasis || value.evidence_basis).length);
}

export function normalizeCreationAudienceStrategy(value = {}, options = {}) {
  const source = parseJson(value, {});
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  const rawMotivations = Array.isArray(source.purchaseMotivations || source.purchase_motivations) ? source.purchaseMotivations || source.purchase_motivations : cleanString(source.purchaseMotivations || source.purchase_motivations) ? [source.purchaseMotivations || source.purchase_motivations] : [];
  const rawObjections = Array.isArray(source.purchaseObjections || source.purchase_objections) ? source.purchaseObjections || source.purchase_objections : cleanString(source.purchaseObjections || source.purchase_objections) ? [source.purchaseObjections || source.purchase_objections] : [];
  const rawEvidence = Array.isArray(source.evidenceBasis || source.evidence_basis) ? source.evidenceBasis || source.evidence_basis : cleanString(source.evidenceBasis || source.evidence_basis) ? [source.evidenceBasis || source.evidence_basis] : [];
  const rawTargetAudience = cleanString(source.targetAudience || source.target_audience);
  const rawDesiredOutcome = cleanString(source.desiredOutcome || source.desired_outcome);
  if (!rawTargetAudience && rawMotivations.length === 0 && rawObjections.length === 0 && !rawDesiredOutcome && rawEvidence.length === 0) return {};
  const confidenceValue = cleanString(source.confidence).toLowerCase();
  let confidence = ["low", "medium", "high"].includes(confidenceValue) ? confidenceValue : "low";
  const sourceValue = cleanString(source.source || source.audienceSource || source.audience_source).toLowerCase();
  const normalizedSource = ["user", "analysis-suggestion", "platform-default", "category-default"].includes(sourceValue)
    ? sourceValue
    : cleanString(options.defaultSource) || "analysis-suggestion";
  let targetAudience = sanitizeCreationAudienceText(rawTargetAudience);
  let purchaseMotivations = normalizeAudienceList(rawMotivations);
  let purchaseObjections = normalizeAudienceList(rawObjections);
  let desiredOutcome = sanitizeCreationAudienceText(rawDesiredOutcome);
  const evidenceBasis = normalizeAudienceList(rawEvidence);
  const removedUnsafeContent = (rawTargetAudience && !targetAudience) || (rawDesiredOutcome && !desiredOutcome) || purchaseMotivations.length < uniqueStrings(rawMotivations).length || purchaseObjections.length < uniqueStrings(rawObjections).length || evidenceBasis.length < uniqueStrings(rawEvidence).length;
  if (normalizedSource === "analysis-suggestion" && evidenceBasis.length === 0) {
    targetAudience = GENERIC_AUDIENCE_TARGET;
    purchaseMotivations = [];
    purchaseObjections = [];
    desiredOutcome = GENERIC_AUDIENCE_OUTCOME;
    confidence = "low";
  } else if (normalizedSource === "analysis-suggestion" && removedUnsafeContent) confidence = "low";
  const normalized = {
    targetAudience, purchaseMotivations, purchaseObjections, desiredOutcome, evidenceBasis,
    confidence,
    source: normalizedSource,
  };
  return normalized.targetAudience || normalized.purchaseMotivations.length || normalized.purchaseObjections.length ||
    normalized.desiredOutcome || normalized.evidenceBasis.length ? normalized : {};
}

export function normalizeCreationConversionIntent(value = {}) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const normalized = {
    audienceFocus: sanitizeCreationAudienceText(value.audienceFocus || value.audience_focus),
    motivationFocus: sanitizeCreationAudienceText(value.motivationFocus || value.motivation_focus),
    objectionFocus: sanitizeCreationAudienceText(value.objectionFocus || value.objection_focus),
    conversionGoal: sanitizeCreationAudienceText(value.conversionGoal || value.conversion_goal),
    evidenceFocus: sanitizeCreationAudienceText(value.evidenceFocus || value.evidence_focus),
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

function normalizeSelectedRoles(value = []) {
  const entries = parseJson(value, []);
  if (!Array.isArray(entries)) return [];
  return entries
    .map((entry) => cleanString(typeof entry === "string" ? entry : entry?.role))
    .filter(Boolean);
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
  const conversionIntent = normalizeCreationConversionIntent(entry.conversionIntent || entry.conversion_intent);
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
    } else if (entry.role === "feature") {
      evidence.performance = true;
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

export function buildCreationReferencePlanningSignals(referenceRoles = [], baseEvidence = {}) {
  const referenceCoverage = normalizeReferenceCoverage({ referenceCoverage: referenceRoles });
  return {
    referenceCoverage,
    evidence: normalizeEvidence(baseEvidence, referenceCoverage),
  };
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

function getRoleLedCustomDefaults(roleValue) {
  const role = cleanString(roleValue) || "product-detail";
  if (CUSTOM_ROLE_LIFESTYLE_ROLES.has(role)) {
    return {
      composition: "role-led-lifestyle",
      textPolicy: "concise",
      scenePolicy: "authentic-use",
      logoPolicy: "allow-supplied",
    };
  }
  if (CUSTOM_ROLE_STORY_ROLES.has(role)) {
    return {
      composition: "role-led-story",
      textPolicy: "concise",
      scenePolicy: "optional-context",
      logoPolicy: "allow-supplied",
    };
  }
  return {
    composition: "role-led-evidence",
    textPolicy: "factual-only",
    scenePolicy: "neutral",
    logoPolicy: "allow-supplied",
  };
}

function createRoleLedCustomSlot(slot = {}, {
  role = slot.role,
  imageTypeLabel = "自定义图片",
  recommendationSource = "item-override",
} = {}) {
  const normalizedRole = cleanString(role) || "product-detail";
  return {
    ...slot,
    ...getRoleLedCustomDefaults(normalizedRole),
    imageType: "custom",
    imageTypeLabel,
    role: normalizedRole,
    prompt: "",
    required: false,
    advisory: true,
    constraints: [],
    sourceIds: [],
    recommendationSource,
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
  return referenceCoverage.reduce((current, entry) => {
    const recommendation = REFERENCE_COVERAGE_OVERLAYS[entry.role];
    if (!recommendation) return current;

    const recommendationRole = CREATION_PLATFORM_IMAGE_TYPE_REGISTRY[recommendation.imageType]?.role;
    if (
      recommendationRole &&
      current.some((slot) => slot.role === recommendationRole) &&
      !current.some((slot) => slot.imageType === recommendation.imageType)
    ) {
      return current;
    }

    return replaceWithRecommendation(current, recommendation, `reference:${entry.role}`);
  }, slots);
}

function hasEvidenceForImageType(imageTypeValue, evidence) {
  const evidenceKey = IMAGE_TYPE_EVIDENCE_KEYS[imageTypeValue];
  return !evidenceKey || Boolean(evidence[evidenceKey]);
}

function applyEvidenceFallbacks(slots, evidence, warnings) {
  const usedImageTypes = new Set(slots.map((slot) => slot.imageType));
  const resolved = [];

  for (const slot of slots) {
    if (
      slot.role === "size-capacity-fit" &&
      ["dimension-fit", "scale-proof"].includes(slot.imageType)
    ) {
      resolved.push(slot);
      continue;
    }
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

function applySetOverrides(slots, setOverrides, { profile, warnings }) {
  let resized = [...slots];
  if (Number.isFinite(setOverrides.imageCount)) {
    const requestedCount = Math.max(0, setOverrides.imageCount);
    const effectiveCount = Math.min(requestedCount, profile.slots.length, resized.length);
    if (effectiveCount < requestedCount) {
      warnings.push({
        code: "image-count-extension-limited",
        level: "warning",
        requestedCount,
        effectiveCount,
        message: `The current platform provides ${effectiveCount} usable carousel image types; the requested count was reduced.`,
      });
    }
    setOverrides.imageCount = effectiveCount;
    resized = resized.map((slot, index) => ({
      ...slot,
      enabled: index < effectiveCount && slot.enabled !== false,
    }));
  }
  return resized.map((slot) => {
    const next = { ...slot };
    for (const field of SET_OVERRIDE_FIELDS) {
      if (setOverrides[field] !== undefined) next[field] = setOverrides[field];
    }
    return next;
  });
}

function applyKnownImageTypeOverride(slot, imageTypeValue, role = slot.role) {
  if (imageTypeValue === "custom") {
    return createRoleLedCustomSlot(slot, { role });
  }
  return createImageTypeSlot(imageTypeValue, slot, "item-override") || slot;
}

function applyItemOverrides(slots, itemOverrides, warnings) {
  const overridden = slots.map((slot, index) => {
    const override = itemOverrides.find((entry) => entry.slotKey === slot.slotKey || entry.slotKey === slot.itemId);
    const base = { ...slot, enabled: slot.enabled !== false, _baseOrder: index };
    if (!override) return base;

    const hasBlockingConstraint = (base.constraints || []).some((constraint) => constraint.level === "blocking");
    const blockedImageTypeOverride = hasBlockingConstraint && override.imageType && override.imageType !== base.imageType;
    let next = override.imageType && !blockedImageTypeOverride
      ? applyKnownImageTypeOverride(base, override.imageType, override.role || base.role)
      : base;
    if (blockedImageTypeOverride) warnings.push({ code: "strict-slot-image-type-preserved", level: "warning", slotKey: slot.slotKey, message: "The platform image type was preserved because this slot has sourced blocking constraints." });
    else if (override.imageType === "custom") {
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
      role: override.role || "product-detail",
      enabled: true,
      required: false,
      advisory: true,
      sourceIds: [],
      constraints: [],
      _baseOrder: slots.length + index,
    }, "custom", override.role || "product-detail");
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

function getReferenceAnalysisAudienceStrategy(value = {}) {
  const source = parseJson(value, {});
  if (!source || typeof source !== "object" || Array.isArray(source)) return {};
  return normalizeCreationAudienceStrategy(source.audienceStrategy || source.audience_strategy, { defaultSource: "analysis-suggestion" });
}

function getAudienceFieldSource(primary, secondary, field, fallback) {
  if (["purchaseMotivations", "purchaseObjections", "evidenceBasis"].includes(field)) {
    if (primary[field]?.length) return primary.source;
    if (secondary[field]?.length) return secondary.source;
    return fallback;
  }
  if (cleanString(primary[field])) return primary.source;
  if (cleanString(secondary[field])) return secondary.source;
  return fallback;
}

function buildEffectiveAudienceStrategy(profile, categorySignals, referenceStrategy, inputStrategy) {
  const analyzed = normalizeCreationAudienceStrategy(referenceStrategy, { defaultSource: "analysis-suggestion" });
  const supplied = normalizeCreationAudienceStrategy(inputStrategy, { defaultSource: "user" });
  const marketingContext = cloneValue(profile.marketingContext || {});
  const categoryContext = getCategoryAudienceContext(categorySignals);
  const source = hasAudienceStrategyContent(supplied) ? supplied.source : hasAudienceStrategyContent(analyzed) ? analyzed.source : "platform-default";
  const targetAudience = supplied.targetAudience || analyzed.targetAudience || GENERIC_AUDIENCE_TARGET;
  const purchaseMotivations = uniqueStrings([
    ...(supplied.purchaseMotivations || []),
    ...(analyzed.purchaseMotivations || []),
    categoryContext.motivation,
    ...(marketingContext.defaultMotivations || []),
  ]).slice(0, 5);
  const purchaseObjections = uniqueStrings([
    ...(supplied.purchaseObjections || []),
    ...(analyzed.purchaseObjections || []),
    categoryContext.objection,
    ...(marketingContext.defaultObjections || []),
  ]).slice(0, 5);
  return {
    targetAudience,
    purchaseMotivations,
    purchaseObjections,
    desiredOutcome: supplied.desiredOutcome || analyzed.desiredOutcome || GENERIC_AUDIENCE_OUTCOME,
    evidenceBasis: uniqueStrings([...(supplied.evidenceBasis || []), ...(analyzed.evidenceBasis || [])]).slice(0, 5),
    confidence: hasAudienceStrategyContent(supplied) ? supplied.confidence || "low" : analyzed.confidence || "low",
    source,
    marketingContext,
    provenance: {
      targetAudience: getAudienceFieldSource(supplied, analyzed, "targetAudience", "platform-default"),
      purchaseMotivations: getAudienceFieldSource(supplied, analyzed, "purchaseMotivations", "platform-category"),
      purchaseObjections: getAudienceFieldSource(supplied, analyzed, "purchaseObjections", "platform-category"),
      desiredOutcome: getAudienceFieldSource(supplied, analyzed, "desiredOutcome", "platform-default"),
      evidenceBasis: getAudienceFieldSource(supplied, analyzed, "evidenceBasis", "none"),
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
  if (constraint.field === "scenePolicy" && constraint.value === "studio-white") return ["lifestyle scene", "lifestyle background", "scene prop", "decorative prop", "environmental context"];
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
  if (platform !== "universal") slots = applyEvidenceFallbacks(slots, evidence, warnings);

  const setOverrides = normalizeCreationPlatformSetOverrides(input.setOverrides || input.platformSetOverrides);
  let itemOverrides = normalizeCreationPlatformItemOverrides(input.itemOverrides || input.platformItemOverrides);
  if (platform === "universal") {
    itemOverrides = itemOverrides.map((override) =>
      override.slotKey === "universal:benefit-proof"
        ? { ...override, slotKey: "universal:target-shopper-resonance" }
        : override,
    );
  }
  const selectedRoles = normalizeSelectedRoles(input.selectedRoles);
  slots = applySetOverrides(slots, setOverrides, { profile, warnings });
  slots = slots.map((slot, index) => selectedRoles[index] ? { ...slot, role: selectedRoles[index] } : slot);
  slots = applyItemOverrides(slots, itemOverrides, warnings);
  const referenceAudienceStrategy = getReferenceAnalysisAudienceStrategy(input.referenceAnalysis);
  const audienceStrategy = normalizeCreationAudienceStrategy(input.audienceStrategy || input.audience_strategy, { defaultSource: "user" });
  const effectiveAudienceStrategy = buildEffectiveAudienceStrategy(profile, uniqueStrings(categorySignals), referenceAudienceStrategy, audienceStrategy);
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
