import { getCreationListingPolicy } from "./creation-listing-policies.mjs";

const CREATION_LISTING_BUCKET_LABELS = {
  exact: "精准关键词",
  longTail: "长尾关键词",
  traffic: "流量关键词",
  descriptive: "描述词",
};

const CREATION_LISTING_REVIEW_REFERENCE_TEXT = {
  warnings: "发布前请按该警告复核来源证据，避免加入未验证声明。",
  missingInfo: "源数据未提供该信息，发布前需要补充确认。",
};
const CREATION_LISTING_REVIEW_REFERENCE_RULES = {
  warnings: [
    {
      pattern: /\bspecies-specific performance\b/i,
      text: "不要宣称超过一般钓鱼用途的特定鱼种效果。",
    },
    {
      pattern: /\bbattery life\b.*\bwaterproof rating\b.*\bcharging speed\b/i,
      text: "不要宣称电池续航、防水等级或充电速度；来源未提供这些信息。",
    },
    {
      pattern: /\bmaterial type\b.*\bcertification\b.*\bwarranty\b/i,
      text: "不要宣称材料类型、认证或保修；来源未提供这些信息。",
    },
    {
      pattern: /\bglow effect\b.*\bimage-backed\b.*\bbrightness duration\b.*\bunderwater range\b/i,
      text: "发光效果有图片依据，但未提供亮度持续时间和水下范围。",
    },
    {
      pattern: /\bone parent listing with\s+(\d+)\s+color variants\b/i,
      text: (match) => `作为一个包含 ${match[1]} 个颜色变体的父 Listing 使用，不要拆成多个 Listing。`,
    },
    {
      pattern: /\bwaterproofing\b.*\bmedical grade\b.*\bcertifications?\b.*\bsterility\b.*\btrauma performance\b/i,
      text: "未经验证来源数据，不要添加防水、医用级材料、认证、无菌或创伤处理性能声明。",
    },
    {
      pattern: /\bcarton size\b.*\bincomplete\/inconsistent\b.*\bnot used in the title\b/i,
      text: "来源尺寸包含外箱尺寸，作为产品尺寸不完整或不一致，因此未用于标题。",
    },
    {
      pattern: /\bkit contents\b.*\bpacking list\b.*\bconfirm final packout\b/i,
      text: "套装内容来自装箱清单和图片参考；发布前请确认最终配包。",
    },
  ],
  missingInfo: [
    {
      pattern: /\bmain body material\b/i,
      text: "未提供主体材料。",
    },
    {
      pattern: /\bbattery capacity\b.*\bruntime\b/i,
      text: "未提供电池容量和续航时间。",
    },
    {
      pattern: /\bwaterproof rating\b/i,
      text: "未提供防水等级。",
    },
    {
      pattern: /\btarget fish species\b/i,
      text: "来源未指定目标鱼种。",
    },
    {
      pattern: /\bpackage box material details\b/i,
      text: "未提供包装盒材料详情。",
    },
    {
      pattern: /\bactual bag dimensions\b/i,
      text: "未提供实际包袋尺寸；来源数据似乎只有运输或外箱尺寸。",
    },
    {
      pattern: /\bmaterial of the bag\b.*\binternal components\b/i,
      text: "文本未确认包袋和内部组件的材料。",
    },
    {
      pattern: /\bsterility\b.*\bcertification\b.*\bcompliance\b/i,
      text: "未提供无菌、认证和合规详情。",
    },
    {
      pattern: /\bvariant options beyond\b/i,
      text: "未提供已展示款式之外的变体选项。",
    },
    {
      pattern: /\bgenerated image evidence\b.*\bunavailable\b/i,
      text: "生成图片证据不可用。",
    },
  ],
};

const CJK_TEXT_GLOBAL_PATTERN = /[\u3400-\u9fff]+/gu;
const NON_ASCII_TEXT_PATTERN = /[^\x20-\x7E]+/g;
const LEGACY_INTERNAL_LISTING_PUBLIC_FIELD_PATTERN = /\b(?:provided product attributes|provided inputs?|sku metadata|searchable copy|shopper-ready language|sellers often struggle|this draft|listing copy|keyword structure|five-bullet layout|configured (?:character )?limit)\b/i;
const listingFieldCopyTimers = new WeakMap();

export function cleanCreationListingText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function getCreationListingGeneratingSetIds(state = {}) {
  const creation = state?.creation || {};
  const ids = new Set();
  if (Array.isArray(creation.listingGeneratingSetIds)) {
    creation.listingGeneratingSetIds
      .map(cleanCreationListingText)
      .filter(Boolean)
      .forEach((id) => ids.add(id));
  }
  const legacyId = cleanCreationListingText(creation.listingGeneratingSetId);
  if (legacyId) {
    ids.add(legacyId);
  }
  return ids;
}

function writeCreationListingGeneratingSetIds(context = {}, ids = new Set()) {
  if (!context.state) {
    context.state = {};
  }
  if (!context.state.creation) {
    context.state.creation = {};
  }
  const nextIds = [...ids].map(cleanCreationListingText).filter(Boolean);
  context.state.creation.listingGeneratingSetIds = nextIds;
  context.state.creation.listingGeneratingSetId = nextIds[0] || "";
}

function setCreationListingGenerating(context = {}, setId, isGenerating) {
  const id = cleanCreationListingText(setId);
  if (!id) {
    return;
  }
  const ids = getCreationListingGeneratingSetIds(context.state);
  if (isGenerating) {
    ids.add(id);
  } else {
    ids.delete(id);
  }
  writeCreationListingGeneratingSetIds(context, ids);
}

function isCreationListingGenerating(state = {}, setId) {
  const id = cleanCreationListingText(setId);
  return Boolean(id && getCreationListingGeneratingSetIds(state).has(id));
}

function createInlineBusyMotion() {
  const motion = document.createElement("span");
  motion.className = "inline-busy-motion";
  motion.setAttribute?.("aria-hidden", "true");
  for (let index = 0; index < 3; index += 1) {
    motion.appendChild(document.createElement("span"));
  }
  return motion;
}

function renderCreationListingGenerateButton(button, {
  disabled = false,
  isGenerating = false,
  idleLabel = "生成 Listing",
} = {}) {
  button.disabled = disabled;
  button.classList?.toggle("is-loading", isGenerating);
  if (!isGenerating || typeof document === "undefined" || typeof button.replaceChildren !== "function") {
    button.textContent = isGenerating ? "生成中..." : idleLabel;
    return;
  }
  const label = document.createElement("span");
  label.className = "creation-listing-generate-label";
  label.textContent = "生成中...";
  button.replaceChildren(createInlineBusyMotion(), label);
}

function isEnglishCreationListingLanguage(language) {
  return /^en(?:-|$)/i.test(cleanCreationListingText(language));
}

function isEnglishCreationListingDraft(draft = {}) {
  return isEnglishCreationListingLanguage(draft.language);
}

function cleanEnglishVisibleListingText(value, fallback = "") {
  const cleaned = cleanCreationListingText(value);
  if (!cleaned) {
    return fallback;
  }
  if (LEGACY_INTERNAL_LISTING_PUBLIC_FIELD_PATTERN.test(cleaned)) {
    return fallback;
  }
  const ascii = cleanCreationListingText(cleaned
    .replace(CJK_TEXT_GLOBAL_PATTERN, " ")
    .replace(NON_ASCII_TEXT_PATTERN, " ")
    .replace(/\blisting\s+draft\b/gi, " ")
    .replace(/\b(?:provided product attributes|searchable copy|shopper-ready language|keyword structure|five-bullet layout)\b/gi, " ")
    .replace(/\bconfigured (?:character )?limit\b/gi, " ")
    .replace(/:\s*(?:[,;]\s*)+\./g, ".")
    .replace(/:\s*(?:[,;]\s*)+(?=\s|$)/g, "")
    .replace(/,\s*(?=[,.;])/g, "")
    .replace(/\s+([,.;:])/g, "$1"));
  return /[A-Za-z0-9]/.test(ascii) ? ascii : fallback;
}

function formatCreationListingVisibleText(draft = {}, value, fallback = "") {
  if (cleanCreationListingText(draft.schemaVersion || draft.schema_version) !== "2") {
    return cleanCreationListingText(value) || fallback;
  }
  return isEnglishCreationListingDraft(draft)
    ? cleanEnglishVisibleListingText(value, fallback)
    : cleanCreationListingText(value) || fallback;
}

function formatCreationListingPublicText(value, language, fallback = "") {
  return isEnglishCreationListingLanguage(language)
    ? cleanEnglishVisibleListingText(value, fallback)
    : cleanCreationListingText(value) || fallback;
}

function cleanCreationListingArray(value, { split = false } = {}) {
  const source = Array.isArray(value)
    ? value
    : split
      ? String(value || "").split(/[,\n;]+/)
      : value
        ? [value]
        : [];
  return source.map(cleanCreationListingText).filter(Boolean);
}

function cleanCreationListingPublicArray(value, { split = false, language = "" } = {}) {
  const source = Array.isArray(value)
    ? value
    : split
      ? String(value || "").split(/[,\n;]+/)
      : value
        ? [value]
        : [];
  return source.map((item) => formatCreationListingPublicText(item, language)).filter(Boolean);
}

function translateCreationListingReviewReferenceItem(value, type) {
  const text = cleanCreationListingText(value);
  for (const rule of CREATION_LISTING_REVIEW_REFERENCE_RULES[type] || []) {
    const match = text.match(rule.pattern);
    if (match) {
      return typeof rule.text === "function" ? rule.text(match) : rule.text;
    }
  }
  return CREATION_LISTING_REVIEW_REFERENCE_TEXT[type] || "";
}

function buildCreationListingReviewReferenceRows(value, type) {
  return cleanCreationListingArray(value)
    .map((item) => translateCreationListingReviewReferenceItem(item, type))
    .filter(Boolean);
}

function resolveCreationListingReviewReferenceRows(value, localizedValue, type) {
  const localizedRows = cleanCreationListingArray(localizedValue);
  return localizedRows.length > 0 ? localizedRows : buildCreationListingReviewReferenceRows(value, type);
}

function normalizeCreationListingKeywordBuckets(value = {}) {
  const source = value && typeof value === "object" ? value : {};
  return {
    exact: cleanCreationListingArray(source.exact || source.precise, { split: true }),
    longTail: cleanCreationListingArray(source.longTail || source.long_tail || source.longtail, { split: true }),
    traffic: cleanCreationListingArray(source.traffic, { split: true }),
    descriptive: cleanCreationListingArray(source.descriptive || source.description || source.descriptors, { split: true }),
  };
}

function normalizeCreationListingPublicKeywordBuckets(value = {}, language = "") {
  const source = value && typeof value === "object" ? value : {};
  return {
    exact: cleanCreationListingPublicArray(source.exact || source.precise, { split: true, language }),
    longTail: cleanCreationListingPublicArray(source.longTail || source.long_tail || source.longtail, { split: true, language }),
    traffic: cleanCreationListingPublicArray(source.traffic, { split: true, language }),
    descriptive: cleanCreationListingPublicArray(source.descriptive || source.description || source.descriptors, { split: true, language }),
  };
}

function normalizeCreationListingDisplayForView(value = {}) {
  if (!value || typeof value !== "object") {
    return null;
  }
  return {
    title: cleanCreationListingText(value.title),
    sellingPoints: cleanCreationListingArray(value.sellingPoints || value.selling_points),
    buyerObjections: cleanCreationListingArray(value.buyerObjections || value.buyer_objections || value.painPoints || value.pain_points),
    highlights: cleanCreationListingArray(value.highlights || value.fiveBullets || value.five_bullets),
    searchTerms: cleanCreationListingArray(value.searchTerms || value.search_terms || value.backendSearchTerms || value.backend_search_terms, { split: true }),
    painPoints: cleanCreationListingArray(value.painPoints || value.pain_points || value.buyerObjections || value.buyer_objections),
    fiveBullets: cleanCreationListingArray(value.fiveBullets || value.five_bullets || value.highlights),
    description: cleanCreationListingText(value.description),
    backendSearchTerms: cleanCreationListingText(
      value.backendSearchTerms || value.backend_search_terms || cleanCreationListingArray(value.searchTerms || value.search_terms).join(" "),
    ),
    keywordBuckets: normalizeCreationListingKeywordBuckets(value.keywordBuckets || value.keyword_buckets),
    packageDimensions: cleanCreationListingText(value.packageDimensions || value.package_dimensions),
    productDimensions: cleanCreationListingText(value.productDimensions || value.product_dimensions),
    packageWeight: cleanCreationListingText(value.packageWeight || value.package_weight),
    productWeight: cleanCreationListingText(value.productWeight || value.product_weight),
    missingInfo: cleanCreationListingArray(value.missingInfo || value.missing_info),
    warnings: cleanCreationListingArray(value.warnings),
  };
}

export function getCreationListingDraftAccessState(draft = {}, source = {}) {
  return {
    canUse: true,
    reason: "direct-output",
    message: "",
  };
}

export function normalizeCreationListingDraftForView(draft = {}, fallbackIndex = 0) {
  const schemaVersion = cleanCreationListingText(draft.schemaVersion || draft.schema_version);
  const isV2 = schemaVersion === "2";
  const requestedPolicyId = cleanCreationListingText(draft.platformId || draft.platform_id || draft.marketplace) || "universal";
  const policy = getCreationListingPolicy(requestedPolicyId);
  const language = cleanCreationListingText(draft.language) || policy.defaultLocale || "en-US";
  const normalizePublicText = isV2
    ? (value, fallback = "") => formatCreationListingPublicText(value, language, fallback)
    : (value, fallback = "") => cleanCreationListingText(value) || fallback;
  const normalizePublicArray = isV2
    ? (value, options = {}) => cleanCreationListingPublicArray(value, { ...options, language })
    : (value, options = {}) => cleanCreationListingArray(value, options);
  const keywordBuckets = isV2
    ? normalizeCreationListingPublicKeywordBuckets(draft.keywordBuckets || draft.keyword_buckets, language)
    : normalizeCreationListingKeywordBuckets(draft.keywordBuckets || draft.keyword_buckets);
  const zhDisplay = normalizeCreationListingDisplayForView(draft.zhDisplay || draft.zh_display);
  const highlights = normalizePublicArray(draft.highlights || draft.fiveBullets || draft.five_bullets);
  const buyerObjections = normalizePublicArray(
    draft.buyerObjections || draft.buyer_objections || draft.painPoints || draft.pain_points,
  );
  const searchTerms = normalizePublicArray(
    draft.searchTerms || draft.search_terms || draft.backendSearchTerms || draft.backend_search_terms,
    { split: true },
  );
  const savedFieldLabels = draft.fieldLabels && typeof draft.fieldLabels === "object" ? draft.fieldLabels : {};
  const savedFieldPurposes = draft.fieldPurposes && typeof draft.fieldPurposes === "object" ? draft.fieldPurposes : {};
  const policyFieldLabels = {
    title: policy.titleRules.label || "标题",
    highlights: policy.highlightRules.label || "亮点",
    description: policy.descriptionRules.label || "描述",
    searchTerms: policy.searchRules.label || "搜索词",
    sellingPoints: "卖点策略",
    buyerObjections: "购买疑虑",
    keywordBuckets: "关键词规划",
  };
  const policyFieldPurposes = {
    title: policy.titleRules.purpose || "",
    highlights: policy.highlightRules.purpose || "",
    description: policy.descriptionRules.purpose || "",
    searchTerms: policy.searchRules.purpose || "",
  };
  const accessState = getCreationListingDraftAccessState(draft);
  return {
    ...(draft && typeof draft === "object" ? structuredClone(draft) : {}),
    id: cleanCreationListingText(draft.id) || `listing-${fallbackIndex + 1}`,
    schemaVersion: "",
    platformId: cleanCreationListingText(draft.platformId || draft.platform_id) || (isV2 ? policy.id : requestedPolicyId === "amazon-us" ? "amazon" : policy.id),
    platformLabel: cleanCreationListingText(draft.platformLabel || draft.platform_label) || policy.label,
    listingPolicyVersion: cleanCreationListingText(draft.listingPolicyVersion || draft.listing_policy_version) || (isV2 ? policy.policyVersion : ""),
    marketplace: cleanCreationListingText(draft.marketplace) || (isV2 ? policy.marketplaceId : "amazon-us"),
    language,
    skuSubjectId: cleanCreationListingText(draft.skuSubjectId || draft.sku_subject_id),
    skuTitle: cleanCreationListingText(draft.skuTitle || draft.sku_title),
    evidenceMode: cleanCreationListingText(draft.evidenceMode || draft.evidence_mode) || "input-only",
    status: cleanCreationListingText(draft.status).toLowerCase() === "failed" ? "failed" : "completed",
    title: normalizePublicText(draft.title, `Listing ${fallbackIndex + 1}`),
    sellingPoints: normalizePublicArray(draft.sellingPoints || draft.selling_points),
    buyerObjections,
    highlights,
    searchTerms,
    painPoints: normalizePublicArray(draft.painPoints || draft.pain_points || buyerObjections),
    fiveBullets: normalizePublicArray(draft.fiveBullets || draft.five_bullets || highlights),
    description: normalizePublicText(draft.description),
    backendSearchTerms: normalizePublicText(
      draft.backendSearchTerms || draft.backend_search_terms || searchTerms.join(" "),
    ),
    keywordBuckets,
    packageDimensions: normalizePublicText(draft.packageDimensions || draft.package_dimensions),
    productDimensions: normalizePublicText(draft.productDimensions || draft.product_dimensions),
    packageWeight: normalizePublicText(draft.packageWeight || draft.package_weight),
    productWeight: normalizePublicText(draft.productWeight || draft.product_weight),
    evidence: cleanCreationListingArray(draft.evidence),
    missingInfo: cleanCreationListingArray(draft.missingInfo || draft.missing_info),
    warnings: cleanCreationListingArray(draft.warnings),
    createdAt: cleanCreationListingText(draft.createdAt || draft.created_at),
    updatedAt: cleanCreationListingText(draft.updatedAt || draft.updated_at),
    publishFields: isV2
      ? Array.isArray(draft.publishFields) ? cleanCreationListingArray(draft.publishFields) : [...policy.publishFields]
      : [
      "title", "sellingPoints", "painPoints", "fiveBullets", "description", "backendSearchTerms", "keywordBuckets",
      "packageDimensions", "productDimensions",
    ],
    internalFields: isV2
      ? Array.isArray(draft.internalFields) ? cleanCreationListingArray(draft.internalFields) : [...policy.internalFields]
      : ["evidence", "missingInfo", "warnings"],
    fieldLabels: Object.fromEntries(Object.entries(policyFieldLabels).map(([field, fallback]) => [
      field,
      isV2 ? cleanCreationListingText(savedFieldLabels[field]) || fallback : fallback,
    ])),
    fieldPurposes: Object.fromEntries(Object.entries(policyFieldPurposes).map(([field, fallback]) => [
      field,
      isV2 ? cleanCreationListingText(savedFieldPurposes[field]) || fallback : fallback,
    ])),
    isLegacy: true,
    isCurrentContractReady: accessState.canUse,
    ...(zhDisplay ? { zhDisplay } : {}),
  };
}

export function getCreationListingDrafts(set) {
  return Array.isArray(set?.listingDrafts) ? set.listingDrafts : [];
}

export function getCreationRecordListingMetaLabel(set) {
  return getCreationListingDrafts(set).length > 0 ? "Listing" : "";
}

export function formatCreationListingDraftHeader(draft = {}, index = 0) {
  const title = formatCreationListingVisibleText(draft, draft.title, `Listing ${index + 1}`);
  const skuMeta = formatCreationListingVisibleText(draft, draft.skuTitle || draft.skuSubjectId, "");
  const meta = [
    skuMeta,
    draft.platformLabel || draft.marketplace,
    draft.language,
    draft.listingPolicyVersion,
    draft.evidenceMode,
    draft.status,
  ]
    .map(cleanCreationListingText)
    .filter(Boolean)
    .join(" · ");
  return { title, meta };
}

export function getCreationListingSearchValues(set = {}) {
  return getCreationListingDrafts(set).flatMap((draft) => [
    draft.title,
    draft.description,
    draft.backendSearchTerms,
    draft.evidenceMode,
    draft.status,
    ...(Array.isArray(draft.sellingPoints) ? draft.sellingPoints : []),
    ...(Array.isArray(draft.painPoints) ? draft.painPoints : []),
    ...(Array.isArray(draft.fiveBullets) ? draft.fiveBullets : []),
    ...(Array.isArray(draft.highlights) ? draft.highlights : []),
    ...(Array.isArray(draft.searchTerms) ? draft.searchTerms : []),
    ...(Array.isArray(draft.buyerObjections) ? draft.buyerObjections : []),
    ...Object.values(draft.keywordBuckets || {}).flat(),
  ]);
}

function getCreationListingBucketEntries(keywordBuckets = {}) {
  const normalized = normalizeCreationListingKeywordBuckets(keywordBuckets);
  return Object.entries(CREATION_LISTING_BUCKET_LABELS).map(([key, label]) => ({
    key,
    label,
    values: normalized[key] || [],
  }));
}

function formatCreationListingList(value) {
  const items = cleanCreationListingArray(value);
  return items.length > 0 ? items : ["无"];
}

export function buildCreationListingFieldCopyText(value, { list = false } = {}) {
  return list ? formatCreationListingList(value).join("\n") : cleanCreationListingText(value) || "无";
}

export function buildCreationListingFieldRows(value, localizedValue, { list = false } = {}) {
  const rows = list ? formatCreationListingList(value) : [cleanCreationListingText(value) || "无"];
  const localizedRows = list ? cleanCreationListingArray(localizedValue) : [cleanCreationListingText(localizedValue)].filter(Boolean);
  return rows.map((text, index) => ({
    text,
    localizedText: localizedRows[index] || "",
  }));
}

export function countCreationListingTextCharacters(value, { list = false } = {}) {
  const rows = list ? cleanCreationListingArray(value) : [cleanCreationListingText(value)].filter(Boolean);
  return rows.reduce((total, text) => total + Array.from(text).length, 0);
}

function buildCreationListingFieldCharacterCounts(value, localizedValue, { list = false, countValue, localizedCountValue } = {}) {
  const englishValue = countValue ?? value;
  const chineseValue = localizedCountValue ?? localizedValue;
  const englishList = Array.isArray(englishValue) ? true : list;
  const chineseList = Array.isArray(chineseValue) ? true : list;
  return {
    english: countCreationListingTextCharacters(englishValue, { list: englishList }),
    chinese: countCreationListingTextCharacters(chineseValue, { list: chineseList }),
  };
}

export function buildCreationListingBucketCopyLines(keywordBuckets = {}) {
  return getCreationListingBucketEntries(keywordBuckets).flatMap((entry) => {
    const values = cleanCreationListingArray(entry.values)
      .map((value) => cleanEnglishVisibleListingText(value, ""))
      .filter(Boolean);
    return values.length > 0 ? [values.join(", ")] : [];
  });
}

function buildCreationListingLocalizedBucketCopyLines(keywordBuckets = {}) {
  return getCreationListingBucketEntries(keywordBuckets).flatMap((entry) => {
    const values = cleanCreationListingArray(entry.values);
    return values.length > 0 ? [values.join("、")] : [];
  });
}

function buildCreationListingBucketRows(keywordBuckets = {}, localizedKeywordBuckets = {}) {
  const localized = normalizeCreationListingKeywordBuckets(localizedKeywordBuckets);
  return getCreationListingBucketEntries(keywordBuckets).map((entry) => {
    const englishValues = cleanCreationListingArray(entry.values);
    const englishCopyValues = englishValues
      .map((value) => cleanEnglishVisibleListingText(value, ""))
      .filter(Boolean);
    const localizedValues = cleanCreationListingArray(localized[entry.key]);
    return {
      label: entry.label,
      englishText: englishValues.join(", ") || "无",
      englishCopyText: englishCopyValues.join(", "),
      localizedText: localizedValues.join("、"),
      localizedCopyText: localizedValues.join("、"),
    };
  });
}

function buildCreationListingSpecificationRows(dimensions, weight, localizedDimensions, localizedWeight) {
  return [
    {
      label: "尺寸",
      englishText: cleanCreationListingText(dimensions) || "无",
      englishCopyText: cleanCreationListingText(dimensions) || "无",
      localizedText: cleanCreationListingText(localizedDimensions),
      localizedCopyText: cleanCreationListingText(localizedDimensions),
    },
    {
      label: "重量",
      englishText: cleanCreationListingText(weight) || "无",
      englishCopyText: cleanCreationListingText(weight) || "无",
      localizedText: cleanCreationListingText(localizedWeight),
      localizedCopyText: cleanCreationListingText(localizedWeight),
    },
  ];
}

function buildCreationListingSpecificationCopyLines(dimensions, weight, { localized = false } = {}) {
  const cleanDimensions = cleanCreationListingText(dimensions);
  const cleanWeight = cleanCreationListingText(weight);
  if (localized && !cleanDimensions && !cleanWeight) {
    return [];
  }
  const separator = localized ? "：" : ": ";
  return [
    `尺寸${separator}${cleanDimensions || "无"}`,
    `重量${separator}${cleanWeight || "无"}`,
  ];
}

function applyCreationListingCopyData(target, label, value, { list = false } = {}) {
  target.dataset.creationListingCopyLabel = label;
  target.dataset.creationListingCopyText = buildCreationListingFieldCopyText(value, { list });
}

function createCreationListingValueCopyTarget(displayText, copyText, label, {
  localized = false,
  prominent = false,
} = {}) {
  const target = document.createElement("button");
  target.className = [
    localized ? "creation-listing-localized" : "creation-listing-value-copy",
    prominent ? "creation-listing-title-copy" : "",
  ].filter(Boolean).join(" ");
  target.type = "button";
  target.textContent = displayText;
  target.title = `点击复制${label}`;
  target.setAttribute("aria-label", `复制${label}`);
  target.dataset.creationListingCopyLanguage = localized ? "zh" : "en";
  applyCreationListingCopyData(target, label, copyText);
  return target;
}

function hasCreationListingFieldValue(value, { list = false } = {}) {
  return list ? cleanCreationListingArray(value).length > 0 : Boolean(cleanCreationListingText(value));
}

function createCreationListingCharacterCountsNode(counts) {
  const stats = document.createElement("span");
  stats.className = "creation-listing-character-counts";
  const labels = [`英文字符 ${counts.english}`];
  const english = document.createElement("span");
  english.className = "creation-listing-character-count english";
  english.dataset.creationListingCopyLanguage = "en";
  english.textContent = `EN ${counts.english}`;
  stats.appendChild(english);
  if (counts.chinese > 0) {
    labels.push(`中文字符 ${counts.chinese}`);
    const chinese = document.createElement("span");
    chinese.className = "creation-listing-character-count chinese";
    chinese.dataset.creationListingCopyLanguage = "zh";
    chinese.textContent = `中文 ${counts.chinese}`;
    stats.appendChild(chinese);
  }
  stats.setAttribute("aria-label", labels.join("，"));
  return stats;
}

function createCreationListingFieldCopyButton(label, value, { localized = false, list = false } = {}) {
  const languageLabel = localized ? "中文" : "英文";
  const button = document.createElement("button");
  button.className = "creation-listing-field-copy";
  button.type = "button";
  button.textContent = `复制${languageLabel}`;
  button.title = `复制${label}${languageLabel}`;
  button.setAttribute("aria-label", `复制${label}${languageLabel}`);
  button.dataset.creationListingCopyLanguage = localized ? "zh" : "en";
  applyCreationListingCopyData(button, `${label}${languageLabel}`, value, { list });
  return button;
}

function createCreationListingField(label, value, {
  list = false,
  localizedValue,
  copyValue,
  localizedCopyValue,
  countValue,
  localizedCountValue,
  purpose,
  copyable = true,
  prominent = false,
  labeledRows,
} = {}) {
  const field = document.createElement("div");
  field.className = "creation-listing-field";
  const copySource = copyValue ?? value;
  const localizedCopySource = localizedCopyValue ?? localizedValue;
  const copyList = Array.isArray(copySource) ? true : list;
  const localizedCopyList = Array.isArray(localizedCopySource) ? true : list;
  const fieldHead = document.createElement("div");
  fieldHead.className = "creation-listing-field-head";

  const labelNode = document.createElement("strong");
  labelNode.className = "creation-listing-field-label";
  labelNode.textContent = label;
  const fieldTools = document.createElement("div");
  fieldTools.className = "creation-listing-field-tools";
  fieldTools.appendChild(createCreationListingCharacterCountsNode(
    buildCreationListingFieldCharacterCounts(value, localizedValue, { list, countValue, localizedCountValue }),
  ));
  if (copyable) {
    fieldTools.appendChild(createCreationListingFieldCopyButton(label, copySource, { list: copyList }));
    if (hasCreationListingFieldValue(localizedCopySource, { list: localizedCopyList })) {
      fieldTools.appendChild(createCreationListingFieldCopyButton(label, localizedCopySource, {
        localized: true,
        list: localizedCopyList,
      }));
    }
  }

  fieldHead.append(labelNode, fieldTools);
  field.appendChild(fieldHead);
  const purposeText = cleanCreationListingText(purpose);
  if (purposeText) {
    const purposeNode = document.createElement("small");
    purposeNode.className = "creation-listing-field-purpose";
    purposeNode.textContent = purposeText;
    field.appendChild(purposeNode);
  }

  if (Array.isArray(labeledRows)) {
    const listNode = document.createElement("ul");
    labeledRows.forEach((rowValue, index) => {
      const row = document.createElement("li");
      const pair = document.createElement("span");
      pair.className = "creation-listing-copy-pair";
      const appendLabeledValue = (displayText, copyText, { localized = false } = {}) => {
        const visibleText = cleanCreationListingText(displayText);
        if (!visibleText) {
          return;
        }
        const line = document.createElement("span");
        line.className = [
          "creation-listing-bucket-line",
          localized ? "is-localized" : "",
        ].filter(Boolean).join(" ");
        line.dataset.creationListingCopyLanguage = localized ? "zh" : "en";
        const fixedLabel = document.createElement("span");
        fixedLabel.className = "creation-listing-bucket-label";
        fixedLabel.textContent = `${rowValue.label}:`;
        line.appendChild(fixedLabel);
        const actualCopyText = cleanCreationListingText(copyText);
        if (actualCopyText) {
          const copyTarget = createCreationListingValueCopyTarget(
            visibleText,
            actualCopyText,
            `${label}${rowValue.label}第 ${index + 1} 行${localized ? "中文" : "英文"}`,
            { localized },
          );
          copyTarget.classList.add("creation-listing-bucket-value");
          line.appendChild(copyTarget);
        } else {
          const staticValue = document.createElement("span");
          staticValue.className = "creation-listing-bucket-static-value";
          staticValue.textContent = visibleText;
          line.appendChild(staticValue);
        }
        pair.appendChild(line);
      };
      appendLabeledValue(rowValue.englishText, rowValue.englishCopyText);
      appendLabeledValue(rowValue.localizedText, rowValue.localizedCopyText, { localized: true });
      row.appendChild(pair);
      listNode.appendChild(row);
    });
    field.appendChild(listNode);
    return field;
  }

  const englishRows = list ? formatCreationListingList(value) : [cleanCreationListingText(value) || "无"];
  const localizedRows = list
    ? cleanCreationListingArray(localizedValue)
    : [cleanCreationListingText(localizedValue)].filter(Boolean);
  const rowCount = Math.max(englishRows.length, localizedRows.length);
  const copyRows = copyList ? formatCreationListingList(copySource) : [buildCreationListingFieldCopyText(copySource)];
  const localizedCopyRows = localizedCopyList
    ? cleanCreationListingArray(localizedCopySource)
    : [cleanCreationListingText(localizedCopySource)].filter(Boolean);
  const appendRowCopyTargets = (parent, index) => {
    const itemLabel = list ? `${label}第 ${index + 1} 条` : label;
    const englishText = englishRows[index] || "";
    const localizedText = localizedRows[index] || "";
    const rowCopyText = copyRows.length === englishRows.length ? copyRows[index] : englishText;
    const pair = document.createElement("span");
    pair.className = "creation-listing-copy-pair";
    if (englishText) {
      pair.appendChild(createCreationListingValueCopyTarget(
        englishText,
        rowCopyText || englishText,
        `${itemLabel}英文`,
        { prominent },
      ));
    }
    if (localizedText) {
      pair.appendChild(createCreationListingValueCopyTarget(
        localizedText,
        localizedCopyRows[index] || localizedText,
        `${itemLabel}中文`,
        { localized: true, prominent },
      ));
    }
    parent.appendChild(pair);
  };

  if (list) {
    const listNode = document.createElement("ul");
    for (let index = 0; index < rowCount; index += 1) {
      const row = document.createElement("li");
      appendRowCopyTargets(row, index);
      listNode.appendChild(row);
    }
    field.appendChild(listNode);
    return field;
  }

  const copy = document.createElement("p");
  appendRowCopyTargets(copy, 0);
  field.appendChild(copy);
  return field;
}

async function copyCreationListingFieldButton(copyButton, context = {}) {
  const label = cleanCreationListingText(copyButton?.dataset?.creationListingCopyLabel) || "字段";
  const text = String(copyButton?.dataset?.creationListingCopyText || "").trim();
  if (!text) {
    context.setFeedback?.(`${label}没有可复制内容。`, "error");
    return;
  }

  await context.writeTextToClipboard?.(text, `当前浏览器不支持复制${label}。`);
  context.setFeedback?.(`已复制${label}。`, "success");
  copyButton.dataset.copied = "true";
  copyButton.setAttribute("aria-label", `已复制${label}`);

  const existingTimer = listingFieldCopyTimers.get(copyButton);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(() => {
    copyButton.dataset.copied = "false";
    copyButton.setAttribute("aria-label", `复制${label}`);
    listingFieldCopyTimers.delete(copyButton);
  }, 1200);
  listingFieldCopyTimers.set(copyButton, timer);
}

export function buildCreationListingDraftText(draft, index = 0, source = {}) {
  const normalizedDraft = normalizeCreationListingDraftForView(draft, index);

  const {
    title,
    sellingPoints,
    painPoints,
    fiveBullets,
    description,
    backendSearchTerms,
    keywordBuckets,
    packageDimensions,
    productDimensions,
    packageWeight,
    productWeight,
  } = normalizedDraft || {};
  const zhDisplay = normalizedDraft?.zhDisplay || {};
  const bilingualScalar = (label, value, localizedValue) => [
    `${label}: ${value || "无"}`,
    `中文参考: ${localizedValue || "无"}`,
  ];
  const bilingualList = (label, values, localizedValues) => {
    const rows = buildCreationListingFieldRows(values, localizedValues, { list: true });
    return [
      `${label}:`,
      ...(rows.length > 0
        ? rows.flatMap((row, rowIndex) => [
          `${rowIndex + 1}. ${row.text || "无"}`,
          `中文参考: ${row.localizedText || "无"}`,
        ])
        : ["无", "中文参考: 无"]),
    ];
  };
  const bilingualSpecifications = (label, dimensions, weight, localizedDimensions, localizedWeight) => [
    `${label}:`,
    `尺寸: ${dimensions || "无"}`,
    `重量: ${weight || "无"}`,
    "中文参考:",
    `尺寸：${localizedDimensions || "无"}`,
    `重量：${localizedWeight || "无"}`,
  ];
  const localizedBuckets = zhDisplay.keywordBuckets || {};
  const bucketLines = getCreationListingBucketEntries(keywordBuckets).flatMap((entry) => {
    const localizedValues = formatCreationListingList(localizedBuckets[entry.key]);
    return [
      `${entry.label}: ${formatCreationListingList(entry.values).join("；") || "无"}`,
      `中文参考: ${localizedValues.join("；") || "无"}`,
    ];
  });

  return [
    `Listing ${index + 1}`,
    ...bilingualScalar("标题", title, zhDisplay.title),
    ...bilingualList("卖点", sellingPoints, zhDisplay.sellingPoints),
    ...bilingualList("痛点", painPoints, zhDisplay.painPoints),
    ...bilingualList("五点描述", fiveBullets, zhDisplay.fiveBullets),
    ...bilingualScalar("商品描述", description, zhDisplay.description),
    ...bilingualScalar("后台搜索词", backendSearchTerms, zhDisplay.backendSearchTerms),
    "关键词分组:",
    ...bucketLines,
    ...bilingualSpecifications(
      "包装尺寸和重量",
      packageDimensions,
      packageWeight,
      zhDisplay.packageDimensions,
      zhDisplay.packageWeight,
    ),
    ...bilingualSpecifications(
      "产品尺寸和重量",
      productDimensions,
      productWeight,
      zhDisplay.productDimensions,
      zhDisplay.productWeight,
    ),
  ].join("\n");
}

export function buildCreationRecordListingText(set) {
  const drafts = getCreationListingDrafts(set).map((draft, index) => normalizeCreationListingDraftForView(draft, index));
  if (!set || drafts.length === 0) {
    return "";
  }
  return drafts
    .flatMap((draft, index) => [buildCreationListingDraftText(draft, index, set), ""])
    .map((line) => String(line || "").trimEnd())
    .join("\n")
    .trim();
}

function buildCreationListingV1ExportDraft(sourceDraft = {}, index = 0) {
  const draft = normalizeCreationListingDraftForView(sourceDraft, index);
  const zhDisplay = draft.zhDisplay || {};
  return {
    id: draft.id,
    platformId: draft.platformId,
    platformLabel: draft.platformLabel,
    marketplace: draft.marketplace,
    language: "en-US",
    evidenceMode: draft.evidenceMode,
    status: "completed",
    title: cleanCreationListingText(draft.title),
    sellingPoints: cleanCreationListingArray(draft.sellingPoints),
    painPoints: cleanCreationListingArray(draft.painPoints),
    fiveBullets: cleanCreationListingArray(draft.fiveBullets),
    description: cleanCreationListingText(draft.description),
    backendSearchTerms: cleanCreationListingText(draft.backendSearchTerms),
    keywordBuckets: normalizeCreationListingKeywordBuckets(draft.keywordBuckets),
    packageDimensions: cleanCreationListingText(draft.packageDimensions),
    packageWeight: cleanCreationListingText(draft.packageWeight),
    productDimensions: cleanCreationListingText(draft.productDimensions),
    productWeight: cleanCreationListingText(draft.productWeight),
    warnings: cleanCreationListingArray(draft.warnings),
    missingInfo: cleanCreationListingArray(draft.missingInfo),
    zhDisplay: {
      title: cleanCreationListingText(zhDisplay.title),
      sellingPoints: cleanCreationListingArray(zhDisplay.sellingPoints),
      painPoints: cleanCreationListingArray(zhDisplay.painPoints),
      fiveBullets: cleanCreationListingArray(zhDisplay.fiveBullets),
      description: cleanCreationListingText(zhDisplay.description),
      backendSearchTerms: cleanCreationListingText(zhDisplay.backendSearchTerms),
      keywordBuckets: normalizeCreationListingKeywordBuckets(zhDisplay.keywordBuckets),
      packageDimensions: cleanCreationListingText(zhDisplay.packageDimensions),
      packageWeight: cleanCreationListingText(zhDisplay.packageWeight),
      productDimensions: cleanCreationListingText(zhDisplay.productDimensions),
      productWeight: cleanCreationListingText(zhDisplay.productWeight),
      warnings: cleanCreationListingArray(zhDisplay.warnings),
      missingInfo: cleanCreationListingArray(zhDisplay.missingInfo),
    },
  };
}

export function buildCreationListingExportPayload(set) {
  const sourceDrafts = getCreationListingDrafts(set);
  if (!set || sourceDrafts.length === 0) {
    return null;
  }
  if (sourceDrafts.every((draft) => cleanCreationListingText(draft?.schemaVersion) !== "2")) {
    return {
      setId: set.setId,
      productName: set.productName,
      listingDrafts: structuredClone(sourceDrafts),
    };
  }
  return {
    setId: set.setId,
    listingDrafts: sourceDrafts.map(buildCreationListingV1ExportDraft),
  };
}

export function renderCreationListingDrafts({ refs, state, set } = {}) {
  if (!refs?.creationRecordListingDrafts) {
    return;
  }

  const panel = refs.creationRecordListingDrafts.closest(".creation-listing-panel");
  const drafts = getCreationListingDrafts(set).map((draft, index) => normalizeCreationListingDraftForView(draft, index));
  const isGenerating = isCreationListingGenerating(state, set?.setId);
  panel?.classList.toggle("hidden", !set);
  refs.creationRecordListingDrafts.replaceChildren();

  if (refs.creationRecordListingStatus) {
    refs.creationRecordListingStatus.textContent = isGenerating
      ? "生成中"
      : drafts.length > 0
        ? `${drafts.length} 条草稿`
        : "未生成";
  }

  if (!set) {
    return;
  }

  if (drafts.length === 0) {
    const empty = document.createElement("p");
    empty.className = "creation-listing-empty";
    empty.textContent = isGenerating ? "正在生成 Listing 草稿..." : "当前套图还没有 Listing 草稿。";
    refs.creationRecordListingDrafts.appendChild(empty);
    return;
  }

  drafts.forEach((draft, index) => {
    const card = document.createElement("article");
    card.className = "creation-listing-card";
    card.setAttribute("aria-label", drafts.length > 1 ? `Listing ${index + 1}` : "Listing 内容");

    const header = document.createElement("div");
    header.className = "creation-listing-card-head";
    const headerContent = formatCreationListingDraftHeader(draft, index);
    const title = document.createElement("h4");
    title.textContent = drafts.length > 1 ? `Listing ${index + 1}` : "Listing 内容";
    const meta = document.createElement("p");
    meta.textContent = headerContent.meta;
    header.append(title, meta);
    card.appendChild(header);

    const contentFrame = document.createElement("div");
    contentFrame.className = "creation-listing-content-frame";
    contentFrame.appendChild(createCreationListingField("标题", draft.title, {
      localizedValue: draft.zhDisplay?.title,
      prominent: true,
    }));
    contentFrame.appendChild(createCreationListingField("卖点", draft.sellingPoints, {
      list: true,
      localizedValue: draft.zhDisplay?.sellingPoints,
    }));
    contentFrame.appendChild(createCreationListingField("痛点", draft.painPoints, {
      list: true,
      localizedValue: draft.zhDisplay?.painPoints,
    }));
    contentFrame.appendChild(createCreationListingField("五点描述", draft.fiveBullets, {
      list: true,
      localizedValue: draft.zhDisplay?.fiveBullets,
    }));
    contentFrame.appendChild(createCreationListingField("商品描述", draft.description, {
      localizedValue: draft.zhDisplay?.description,
    }));
    contentFrame.appendChild(createCreationListingField("后台搜索词", draft.backendSearchTerms, {
      localizedValue: draft.zhDisplay?.backendSearchTerms,
    }));

    const bucketRows = buildCreationListingBucketRows(
      draft.keywordBuckets,
      draft.zhDisplay?.keywordBuckets,
    );
    const bucketLines = bucketRows.map((row) => row.englishText);
    const localizedBucketLines = bucketRows.map((row) => row.localizedText).filter(Boolean);
    const localizedBucketValues = Object.values(draft.zhDisplay?.keywordBuckets || {}).flat();
    const buckets = createCreationListingField("关键词分组", bucketLines, {
      list: true,
      localizedValue: localizedBucketLines,
      copyValue: buildCreationListingBucketCopyLines(draft.keywordBuckets),
      localizedCopyValue: buildCreationListingLocalizedBucketCopyLines(draft.zhDisplay?.keywordBuckets),
      countValue: Object.values(draft.keywordBuckets || {}).flat(),
      localizedCountValue: localizedBucketValues,
      labeledRows: bucketRows,
    });
    buckets.classList.add("creation-listing-buckets");
    contentFrame.appendChild(buckets);
    contentFrame.appendChild(createCreationListingField(
      "包装尺寸和重量",
      [draft.packageDimensions, draft.packageWeight],
      {
        list: true,
        localizedValue: [draft.zhDisplay?.packageDimensions, draft.zhDisplay?.packageWeight],
        copyValue: buildCreationListingSpecificationCopyLines(draft.packageDimensions, draft.packageWeight),
        localizedCopyValue: buildCreationListingSpecificationCopyLines(
          draft.zhDisplay?.packageDimensions,
          draft.zhDisplay?.packageWeight,
          { localized: true },
        ),
        labeledRows: buildCreationListingSpecificationRows(
          draft.packageDimensions,
          draft.packageWeight,
          draft.zhDisplay?.packageDimensions,
          draft.zhDisplay?.packageWeight,
        ),
      },
    ));
    contentFrame.appendChild(createCreationListingField(
      "产品尺寸和重量",
      [draft.productDimensions, draft.productWeight],
      {
        list: true,
        localizedValue: [draft.zhDisplay?.productDimensions, draft.zhDisplay?.productWeight],
        copyValue: buildCreationListingSpecificationCopyLines(draft.productDimensions, draft.productWeight),
        localizedCopyValue: buildCreationListingSpecificationCopyLines(
          draft.zhDisplay?.productDimensions,
          draft.zhDisplay?.productWeight,
          { localized: true },
        ),
        labeledRows: buildCreationListingSpecificationRows(
          draft.productDimensions,
          draft.productWeight,
          draft.zhDisplay?.productDimensions,
          draft.zhDisplay?.productWeight,
        ),
      },
    ));
    if (draft.warnings.length > 0) {
      contentFrame.appendChild(createCreationListingField("警告", draft.warnings, {
        list: true,
        localizedValue: resolveCreationListingReviewReferenceRows(
          draft.warnings,
          draft.zhDisplay?.warnings,
          "warnings",
        ),
      }));
    }
    if (draft.missingInfo.length > 0) {
      contentFrame.appendChild(createCreationListingField("缺失信息", draft.missingInfo, {
        list: true,
        localizedValue: resolveCreationListingReviewReferenceRows(
          draft.missingInfo,
          draft.zhDisplay?.missingInfo,
          "missingInfo",
        ),
      }));
    }
    card.appendChild(contentFrame);

    refs.creationRecordListingDrafts.appendChild(card);
  });
}

export function createCreationListingController(context = {}) {
  const renderViews = () => {
    context.renderRecordView?.();
    context.renderCurrentView?.();
  };
  const getSelectedSet = (setId = "") => {
    const requestedSetId = cleanCreationListingText(setId);
    if (!requestedSetId) {
      return context.getSelectedSet?.() || null;
    }
    return context.state?.creation?.sets?.find((set) => set.setId === requestedSetId)
      || context.normalizeSet?.({ setId: requestedSetId })
      || { setId: requestedSetId };
  };

  async function generate(setId = "") {
    const selectedSet = getSelectedSet(setId);
    if (!selectedSet?.setId) {
      context.setFeedback?.("请先选择一套记录。", "error");
      return null;
    }

    if (isCreationListingGenerating(context.state, selectedSet.setId)) {
      context.setFeedback?.("当前套图 Listing 正在生成。", "busy");
      return selectedSet;
    }

    setCreationListingGenerating(context, selectedSet.setId, true);
    context.setFeedback?.("正在生成 Listing...", "busy");
    renderViews();

    try {
      const response = await context.fetchImpl("/api/creation/listings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...(context.getRequestConfig?.() || {}),
          setId: selectedSet.setId,
          set: selectedSet,
        }),
      });
      let payload;
      try {
        payload = await response.json();
      } catch {
        throw new Error(response.ok ? "Listing 生成服务返回了无效的 JSON。" : "Listing 生成失败。");
      }
      if (!response.ok) {
        throw new Error(payload.message || "Listing 生成失败。");
      }
      if (payload?.ok === false) {
        throw new Error(payload.message || "Listing 生成失败。");
      }

      const nextSetPayload = payload.set || {
        ...selectedSet,
        listingDrafts: Array.isArray(payload.listingDrafts) ? payload.listingDrafts : [],
        updatedAt: context.nowIso?.(),
      };
      const nextSet = context.upsertSet?.(nextSetPayload) || nextSetPayload;
      context.state.creation.recordSetId = nextSet?.setId || selectedSet.setId;
      context.setFeedback?.("Listing 已生成。", "success");
      return nextSet;
    } catch (error) {
      const message = context.compactErrorMessage?.(
        error instanceof Error ? error.message : String(error),
        "Listing 生成失败",
      ) || "Listing 生成失败";
      context.setFeedback?.(message, "error");
      throw new Error(message);
    } finally {
      setCreationListingGenerating(context, selectedSet.setId, false);
      renderViews();
    }
  }

  async function copy() {
    const selectedSet = context.getSelectedSet?.();
    const text = buildCreationRecordListingText(selectedSet);
    if (!text) {
      context.setFeedback?.("当前套图还没有可复制的 Listing。", "error");
      return;
    }

    await context.writeTextToClipboard?.(text, "当前浏览器不支持复制 Listing。");
    context.setFeedback?.("已复制当前套图 Listing。", "success");
  }

  function exportListings() {
    const selectedSet = context.getSelectedSet?.();
    const drafts = getCreationListingDrafts(selectedSet);
    if (!selectedSet || drafts.length === 0) {
      context.setFeedback?.("当前套图还没有可导出的 Listing。", "error");
      return;
    }

    const payload = buildCreationListingExportPayload(selectedSet);
    context.downloadTextFile?.(
      `${JSON.stringify(payload, null, 2)}\n`,
      `creation-listings-${selectedSet.setId || "record"}.json`,
      "application/json;charset=utf-8",
    );
    context.setFeedback?.("已导出当前套图 Listing。", "success");
  }

  function syncRecordControls(selectedSet) {
    const drafts = getCreationListingDrafts(selectedSet);
    const isGenerating = isCreationListingGenerating(context.state, selectedSet?.setId);
    const generateControls = [
      [context.refs.creationRecordGenerateListingsButton, "生成 Listing"],
      [context.refs.creationRecordRegenerateListingsButton, drafts.length > 0 ? "重新生成" : "生成 Listing"],
    ];
    generateControls.forEach(([button, idleLabel]) => {
      if (!button) {
        return;
      }
      renderCreationListingGenerateButton(button, {
        disabled: !selectedSet || isGenerating,
        isGenerating,
        idleLabel,
      });
      button.title = "";
    });
    if (context.refs.creationRecordCopyListingsButton) {
      context.refs.creationRecordCopyListingsButton.disabled = drafts.length === 0 || isGenerating;
    }
    if (context.refs.creationRecordExportListingsButton) {
      context.refs.creationRecordExportListingsButton.disabled = drafts.length === 0 || isGenerating;
    }
    renderCreationListingDrafts({ refs: context.refs, state: context.state, set: selectedSet });
  }

  function bindEvents() {
    const listingDraftContainers = new Set([
      context.refs.creationRecordListingDrafts,
      context.refs.creationInlineListingDrafts,
    ].filter(Boolean));

    context.refs.creationRecordGenerateListingsButton?.addEventListener("click", () => {
      generate().catch((error) => context.setFeedback?.(error.message, "error"));
    });
    context.refs.creationRecordRegenerateListingsButton?.addEventListener("click", () => {
      generate().catch((error) => context.setFeedback?.(error.message, "error"));
    });
    context.refs.creationRecordCopyListingsButton?.addEventListener("click", () => {
      copy().catch((error) => context.setFeedback?.(error.message, "error"));
    });
    context.refs.creationRecordExportListingsButton?.addEventListener("click", exportListings);
    listingDraftContainers.forEach((container) => {
      container.addEventListener("click", (event) => {
        const copyButton = event.target?.closest?.("[data-creation-listing-copy-text]");
        if (!copyButton || !container.contains(copyButton)) {
          return;
        }
        copyCreationListingFieldButton(copyButton, context).catch((error) => {
          context.setFeedback?.(error.message, "error");
        });
      });
    });
  }

  return {
    bindEvents,
    copy,
    exportListings,
    generate,
    syncRecordControls,
  };
}
