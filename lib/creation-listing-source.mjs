import { extractCreationListingForbiddenTerms } from "./creation-listing-content-gate.mjs";

const MODEL_SOURCE_FIELDS = [
  "setId", "schemaVersion", "forceV1", "forceV2",
  "platformId", "platformLabel", "platform", "platformPolicyId", "marketplace",
  "listingPolicyVersion", "language", "platformLocale", "listingPolicy", "platformProvenance",
  "productName", "productDescription", "description", "product_name",
  "parentProductName", "parent_product_name", "setProductName", "set_product_name",
  "sellingPoints", "titleValueEvidence", "buyerDecisionEvidence", "listingEvidenceAliases",
  "dimensionSpecs", "dimensions", "dimensionSpecGroups", "dimensionUnitMode", "dimensionUnitModeLabel",
  "productDimensionEvidence", "packageDimensionEvidence", "productWeightEvidence", "packageWeightEvidence",
  "productDimensions", "product_dimensions", "itemDimensions", "item_dimensions", "bodyDimensions", "assembledDimensions",
  "packageDimensions", "package_dimensions", "packagingDimensions", "packaging_dimensions", "packedDimensions", "cartonDimensions",
  "productWeight", "productWeightUnit", "product_weight", "product_weight_unit",
  "netWeight", "netWeightUnit", "net_weight", "net_weight_unit",
  "itemWeight", "itemWeightUnit", "item_weight", "item_weight_unit",
  "bodyWeight", "bodyWeightUnit", "body_weight", "body_weight_unit",
  "weight", "weightUnit", "weight_unit",
  "packageWeight", "packageWeightUnit", "package_weight", "package_weight_unit",
  "grossWeight", "grossWeightUnit", "gross_weight", "gross_weight_unit",
  "shippingWeight", "shippingWeightUnit", "shipping_weight", "shipping_weight_unit",
  "packedWeight", "packedWeightUnit", "packed_weight", "packed_weight_unit",
  "industryTemplatePath", "category", "categorySignals", "referenceImageRoles",
  "skuSubjectId", "skuTitle", "skuNote", "skuFilenames", "skuBundleCount",
  "skuPackQuantityText", "skuQuantityOptions", "skuVariantCount", "skuSubjects",
  "sku_pack_quantity_text", "sku_quantity_options", "sku_variant_count",
  "material", "materials", "packageContents", "packageList", "canvasClaims",
  "confirmedFacts", "productFacts", "facts", "evidenceMode", "warnings", "evidence",
];
const PLAN_FACT_FIELDS = [
  ...MODEL_SOURCE_FIELDS,
  "targetLanguage", "targetLanguageLabel", "industryTemplate", "industryTemplateLabel",
];
const PRODUCT_INSIGHT_FIELDS = [
  "version", "confirmedFacts", "sellingPoints", "painPoints", "audienceSegments",
  "marketingRecommendations", "unknowns", "conflicts",
];
const IMAGE_ITEM_FIELDS = [
  "itemId", "slotIndex", "role", "title", "status", "filename", "relativePath",
  "skuSubjectId", "skuSubject",
];

function selectFields(value, fields) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(fields
    .filter((key) => Object.hasOwn(value, key) && value[key] !== undefined)
    .map((key) => [key, value[key]]));
}

function nonEmptyFields(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return Object.fromEntries(Object.entries(value).filter(([, entry]) =>
    entry !== undefined && entry !== null && entry !== ""
    && !(Array.isArray(entry) && entry.length === 0)
    && !(typeof entry === "object" && Object.keys(entry).length === 0)));
}

function mergeImageItems(source) {
  const imageItems = Array.isArray(source.imageItems) ? source.imageItems : [];
  const plannedItems = Array.isArray(source.plannedItems) ? source.plannedItems : [];
  const merged = new Map();
  for (const item of [...imageItems, ...plannedItems]) {
    const candidate = nonEmptyFields(selectFields(item, IMAGE_ITEM_FIELDS));
    if (Object.keys(candidate).length === 0) continue;
    const key = candidate.itemId ? "item:" + candidate.itemId : "metadata:" + JSON.stringify(candidate);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, candidate);
      continue;
    }
    const preferCandidate = previous.status !== "completed" && candidate.status === "completed";
    const primary = preferCandidate ? candidate : previous;
    const secondary = preferCandidate ? previous : candidate;
    const combined = { ...secondary, ...primary };
    if (primary.skuSubject || secondary.skuSubject) {
      combined.skuSubject = {
        ...nonEmptyFields(secondary.skuSubject),
        ...nonEmptyFields(primary.skuSubject),
      };
    }
    merged.set(key, combined);
  }
  return [...merged.values()];
}

export function projectCreationListingModelSource(source = {}) {
  const projected = selectFields(source, MODEL_SOURCE_FIELDS);
  const productInsights = selectFields(source.productInsights, PRODUCT_INSIGHT_FIELDS);
  if (Object.keys(productInsights).length > 0) projected.productInsights = productInsights;
  const planFacts = selectFields(source.effectivePlan, PLAN_FACT_FIELDS);
  const planInsights = selectFields(source.effectivePlan?.productInsights, PRODUCT_INSIGHT_FIELDS);
  if (Object.keys(planInsights).length > 0) planFacts.productInsights = planInsights;
  for (const key of Object.keys(planFacts)) {
    if (JSON.stringify(planFacts[key]) === JSON.stringify(projected[key])) delete planFacts[key];
  }
  if (Object.keys(planFacts).length > 0) projected.planFacts = planFacts;
  const imageItems = mergeImageItems(source);
  if (imageItems.length > 0) projected.imageItems = imageItems;
  projected.forbiddenTerms = extractCreationListingForbiddenTerms(source);
  return projected;
}
