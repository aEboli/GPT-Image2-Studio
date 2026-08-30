import { TEMU_STUDIO_IMAGE_PATH, TEMU_TEMPLATE_HEADERS } from "./template-headers.mjs";

export const DEFAULT_FREIGHT_TEMPLATE_ID = "HFT-18421307196784823200";
export const DEFAULT_FREIGHT_TEMPLATE_NAME = "出口易交大略3号仓";
export const PRODUCT_DESCRIPTION_MAX_LENGTH = 500;
export const DEFAULT_FREIGHT_TEMPLATES = Object.freeze([
  Object.freeze({ id: DEFAULT_FREIGHT_TEMPLATE_ID, name: DEFAULT_FREIGHT_TEMPLATE_NAME }),
]);

export const VARIANT_ATTRIBUTE_OPTIONS = Object.freeze([
  "颜色", "风格", "材质", "口味", "适用人群", "容量", "成分", "重量", "品类", "数量", "型号",
  "头发长度", "被套尺码", "RAM+ROM", "存储容量", "厚被尺码", "手机型号", "薄被尺码",
]);
export const DEFAULT_VARIANT_ATTRIBUTE = VARIANT_ATTRIBUTE_OPTIONS[0];

// 51 列表头全仓单一声明在 ./template-headers.mjs，这里只再导出，导出名与值均不变。
export const TEMPLATE_HEADERS = TEMU_TEMPLATE_HEADERS;

export const OPTIONS = Object.freeze({
  identifierTypes: ["", "UPC", "EAN", "ISBN"],
  packagingShapes: ["", "不规则", "长方体", "圆柱体"],
  packagingTypes: ["", "硬包装", "软包装+硬物", "软包装+软物"],
  leadTimes: ["", "1", "2", "7", "9"],
  freightTemplates: DEFAULT_FREIGHT_TEMPLATES,
  originCountries: ["中国大陆"],
  originProvinces: [
    "", "北京市", "天津市", "河北省", "山西省", "内蒙古自治区", "辽宁省", "吉林省", "黑龙江省",
    "上海市", "江苏省", "浙江省", "安徽省", "福建省", "江西省", "山东省", "河南省", "湖北省",
    "湖南省", "广东省", "广西壮族自治区", "海南省", "重庆市", "四川省", "贵州省", "云南省",
    "西藏自治区", "陕西省", "甘肃省", "青海省", "宁夏回族自治区", "新疆维吾尔自治区",
  ],
  yesNo: ["", "是", "否"],
  skuCategoryTypes: ["", "单品", "同款多件", "混合套装"],
  skuCategoryUnits: ["", "件", "双", "包"],
  sameProductTypes: ["", "同品不同规", "不同品"],
  sensitiveValues: ["纯电", "内电", "磁性", "液体", "粉末", "膏体", "刀具"],
  contentUnits: [
    "",
    "液体盎司(fl.oz)", "毫升(ml)", "加仑(gal)", "升(L)", "克(g)", "千克(kg)",
    "常衡盎司(oz.av)", "磅(lb)", "平方英尺(sq.ft)", "平方米(sq.m)", "米(m)",
    "厘米(cm)", "英尺(ft)", "英寸(in)", "立方米(m³)", "毫米(mm)",
    "平方毫米(sq.mm)", "平方厘米(sq.cm)", "平方英寸(sq.in)",
  ],
});

const emptyAsset = () => ({
  id: "",
  name: "",
  url: "",
  contentHash: "",
  uploadCloudName: "",
  width: null,
  height: null,
  bytes: null,
  format: "",
  status: "empty",
  error: "",
});

export function truncateProductDescription(value, maxLength = PRODUCT_DESCRIPTION_MAX_LENGTH) {
  const description = value == null ? "" : String(value);
  if (description.length <= maxLength) return description;

  const prefix = description.slice(0, maxLength);
  const sentenceEnd = Math.max(prefix.lastIndexOf("."), prefix.lastIndexOf("。"));
  return sentenceEnd === -1 ? prefix : prefix.slice(0, sentenceEnd + 1);
}

export function createDefaultDraft() {
  return {
    version: 4,
    product: {
      title: "",
      englishTitle: "",
      description: "",
      productCode: "",
      isApparel: false,
      declaredPrice: "",
      length: "",
      width: "",
      height: "",
      weight: "",
      suggestedPrice: "",
      inventory: "100",
      leadTime: "2",
      freightTemplateId: DEFAULT_FREIGHT_TEMPLATE_ID,
      origin: "中国大陆-广东省",
      identifierType: "",
      identifier: "",
      externalProductUrl: "",
      packagingShape: "",
      packagingType: "",
      customProduct: "否",
      productVideoUrl: "",
      descriptionVideoUrl: "",
      manualUrl: "",
      manualLanguages: [],
      skuCategoryType: "单品",
      skuCategoryQuantity: "1",
      skuCategoryUnit: "件",
      independentPackaging: "",
      netContent: "",
      netContentUnit: "",
      piecesInside: "",
      sameProduct: "",
      totalNetContent: "",
      totalNetContentUnit: "",
      packageList: [],
      packageQuantities: [],
      sensitive: "否",
      sensitiveValues: [],
      batteryCapacity: "",
      knifeLength: "",
      bladeAngle: "",
      liquidCapacity: "",
      sourceUrls: [],
    },
    variants: {
      name1: "颜色",
      values1: ["默认"],
      name2: "",
      values2: [],
    },
    skus: [],
    assets: {
      carousel: [],
      packaging: [],
    },
    settings: {
      cloudName: "",
      uploadPreset: "",
    },
  };
}

function asText(value) {
  return value == null ? "" : String(value).trim();
}

function normalizeVariantAttribute(value, fallback = "") {
  const attribute = asText(value);
  return VARIANT_ATTRIBUTE_OPTIONS.includes(attribute) ? attribute : fallback;
}

function normalizeVariantAttributeNames(input) {
  const variants = input && typeof input === "object" ? input : {};
  const name1 = normalizeVariantAttribute(variants.name1, DEFAULT_VARIANT_ATTRIBUTE);
  const name2 = normalizeVariantAttribute(variants.name2);
  return { name1, name2: name2 === name1 ? "" : name2 };
}

export function availableVariantAttributeOptions(excludedAttribute = "") {
  const excluded = asText(excludedAttribute);
  return VARIANT_ATTRIBUTE_OPTIONS.filter((attribute) => attribute !== excluded);
}

export function splitLines(value) {
  if (Array.isArray(value)) {
    return [...new Set(value.map(asText).filter(Boolean))];
  }
  return [...new Set(asText(value).split(/\r?\n|[,，]/).map(asText).filter(Boolean))];
}

function normalizeOptionalNumber(value) {
  if (typeof value !== "number" && typeof value !== "string") return null;
  if (typeof value === "string" && !value.trim()) return null;
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : null;
}

export function normalizeAsset(value) {
  if (!value || typeof value !== "object") return emptyAsset();
  return {
    ...emptyAsset(),
    ...value,
    id: asText(value.id),
    name: asText(value.name),
    url: asText(value.url),
    contentHash: /^[a-f0-9]{64}$/i.test(asText(value.contentHash)) ? asText(value.contentHash).toLowerCase() : "",
    uploadCloudName: asText(value.uploadCloudName).toLowerCase(),
    width: normalizeOptionalNumber(value.width),
    height: normalizeOptionalNumber(value.height),
    bytes: normalizeOptionalNumber(value.bytes),
  };
}

function assetHasValue(value) {
  if (!value || typeof value !== "object") return false;
  return Boolean(
    asText(value.id)
    || asText(value.name)
    || asText(value.url)
    || asText(value.localPreview)
    || asText(value.studioPreviewUrl)
    || (value.status && value.status !== "empty"),
  );
}

function skuImageFrom(value) {
  for (const candidate of [value?.image, value?.material, value?.preview]) {
    if (assetHasValue(candidate)) return candidate;
  }
  return value?.image || value?.material || value?.preview;
}

export function normalizeOrigin(value) {
  const origin = asText(value);
  if (!origin) return "中国大陆-";
  if (origin === "中国" || origin === "中国大陆") return "中国大陆-";
  if (origin.startsWith("中国-")) return `中国大陆-${origin.slice(3)}`;
  return origin;
}

export function splitOrigin(value) {
  const origin = normalizeOrigin(value);
  if (origin.startsWith("中国大陆-")) {
    return { country: "中国大陆", province: origin.slice("中国大陆-".length) };
  }
  const separator = origin.indexOf("-");
  return separator === -1
    ? { country: origin, province: "" }
    : { country: origin.slice(0, separator), province: origin.slice(separator + 1) };
}

export function normalizeDraft(input = {}) {
  const defaults = createDefaultDraft();
  const sourceVersion = Number.isFinite(Number(input.version)) ? Number(input.version) : 1;
  const sourceProduct = input.product && typeof input.product === "object" ? input.product : {};
  const sourceSkus = Array.isArray(input.skus) ? input.skus : [];
  const allSourceSkusMatch = (field, value) => sourceSkus.every((sku) => asText(sku?.[field]) === value);
  const legacyPriceAndInventoryDefaults = sourceVersion < 2
    && asText(sourceProduct.declaredPrice) === "200"
    && asText(sourceProduct.inventory) === "0"
    && allSourceSkusMatch("declaredPrice", "200")
    && allSourceSkusMatch("inventory", "0");
  const legacyInventoryDefault = sourceVersion < 2
    && asText(sourceProduct.declaredPrice) === ""
    && asText(sourceProduct.inventory) === "0"
    && allSourceSkusMatch("declaredPrice", "")
    && allSourceSkusMatch("inventory", "0");
  const product = { ...defaults.product, ...(input.product || {}) };
  if (sourceVersion < 4) {
    for (const field of ["skuCategoryType", "skuCategoryQuantity", "skuCategoryUnit"]) {
      if (!asText(sourceProduct[field])) product[field] = defaults.product[field];
    }
  }
  product.origin = normalizeOrigin(product.origin);
  if (sourceVersion < 2 && product.origin === "中国大陆-") product.origin = defaults.product.origin;
  if (legacyPriceAndInventoryDefaults) product.declaredPrice = "";
  if (legacyPriceAndInventoryDefaults || legacyInventoryDefault) product.inventory = defaults.product.inventory;
  for (const key of ["manualLanguages", "packageList", "packageQuantities", "sensitiveValues", "sourceUrls"]) {
    product[key] = splitLines(product[key]);
  }
  const variants = { ...defaults.variants, ...(input.variants || {}) };
  Object.assign(variants, normalizeVariantAttributeNames(variants));
  variants.values1 = splitLines(variants.values1);
  variants.values2 = splitLines(variants.values2);
  const assets = {
    carousel: Array.isArray(input.assets?.carousel) ? input.assets.carousel.map(normalizeAsset) : [],
    packaging: Array.isArray(input.assets?.packaging) ? input.assets.packaging.map(normalizeAsset) : [],
  };
  return {
    ...defaults,
    ...input,
    version: defaults.version,
    product,
    variants,
    assets,
    settings: { ...defaults.settings, ...(input.settings || {}) },
    skus: Array.isArray(input.skus)
      ? input.skus.map((sku) => {
          const { image, material, preview, ...rest } = sku;
          return {
            ...rest,
            key: asText(sku.key),
            variant1Value: asText(sku.variant1Value),
            variant2Value: asText(sku.variant2Value),
            skuCode: asText(sku.skuCode),
            declaredPrice: legacyPriceAndInventoryDefaults ? "" : sku.declaredPrice,
            inventory: legacyPriceAndInventoryDefaults || legacyInventoryDefault ? defaults.product.inventory : sku.inventory,
            image: normalizeAsset(skuImageFrom({ image, material, preview })),
          };
        })
      : [],
  };
}

export function reorderCarouselAsset(input, fromIndex, toIndex) {
  const carousel = input?.assets?.carousel;
  if (!input || !Array.isArray(carousel)
    || !Number.isInteger(fromIndex) || !Number.isInteger(toIndex)
    || fromIndex < 0 || toIndex < 0
    || fromIndex >= carousel.length || toIndex >= carousel.length
    || fromIndex === toIndex) {
    return input;
  }

  const nextCarousel = carousel.slice();
  const [asset] = nextCarousel.splice(fromIndex, 1);
  nextCarousel.splice(toIndex, 0, asset);
  return {
    ...input,
    assets: { ...input.assets, carousel: nextCarousel },
  };
}

export function updateSkuVariantAttributeName(input, field, value) {
  if (!input || !["name1", "name2"].includes(field)) return input;
  const variants = input.variants && typeof input.variants === "object" ? input.variants : {};
  const names = normalizeVariantAttributeNames({ ...variants, [field]: value });
  return {
    ...input,
    variants: { ...variants, ...names },
  };
}

function skuPart(value) {
  return asText(value)
    .replace(/\s+/g, "-")
    .replace(/[^A-Za-z0-9\u3400-\u9fff_-]/g, "")
    .replace(/-+/g, "-")
    .slice(0, 24) || "SKU";
}

const HAN_CHARACTER_PATTERN = /\p{Script=Han}/u;

export function skuKey(value1, value2 = "") {
  return JSON.stringify([asText(value1), asText(value2)]);
}

export function generateSkuMatrix(input) {
  const draft = normalizeDraft(input);
  const old = new Map(draft.skus.map((sku) => [sku.key || skuKey(sku.variant1Value, sku.variant2Value), sku]));
  const values1 = draft.variants.values1;
  const values2 = draft.variants.name2 ? draft.variants.values2 : [""];
  const base = skuPart(draft.product.productCode || "SKU");
  const result = [];

  for (const value1 of values1) {
    for (const value2 of values2) {
      const key = skuKey(value1, value2);
      const existing = old.get(key) || {};
      const generatedCode = [base, skuPart(value1), value2 ? skuPart(value2) : ""].filter(Boolean).join("-");
      result.push({
        key,
        variant1Value: value1,
        variant2Value: value2,
        skuCode: existing.skuCode || generatedCode,
        declaredPrice: existing.declaredPrice ?? draft.product.declaredPrice,
        length: existing.length ?? draft.product.length,
        width: existing.width ?? draft.product.width,
        height: existing.height ?? draft.product.height,
        weight: existing.weight ?? draft.product.weight,
        inventory: existing.inventory ?? draft.product.inventory,
        image: normalizeAsset(existing.image),
      });
    }
  }
  return result;
}

export function updateSkuVariantValue(input, skuIndex, field, value) {
  const index = Number(skuIndex);
  if (!input || !Array.isArray(input.skus) || !Number.isInteger(index) || !["variant1Value", "variant2Value"].includes(field) || !input.skus[index]) {
    return input;
  }
  return {
    ...input,
    skus: input.skus.map((sku, currentIndex) => currentIndex === index ? { ...sku, [field]: asText(value) } : sku),
  };
}

export const SKU_BULK_FIELDS = Object.freeze([
  "declaredPrice",
  "length",
  "width",
  "height",
  "weight",
  "inventory",
]);

export function applySkuBulkFields(input, values = {}) {
  const draft = normalizeDraft(input);
  for (const field of SKU_BULK_FIELDS) {
    if (!Object.hasOwn(values, field)) continue;
    const value = asText(values[field]);
    if (!value) continue;
    draft.product[field] = value;
    draft.skus.forEach((sku) => {
      sku[field] = value;
    });
  }
  return draft;
}

function isPrivateIpv4(hostname) {
  const parts = hostname.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224;
}

export function inspectPublicUrl(value) {
  const text = asText(value);
  if (!text) return { valid: false, error: "地址为空" };
  if (/^[A-Za-z]:[\\/]/.test(text) || /^\\\\/.test(text)) {
    return { valid: false, error: "本地文件路径无法被平台访问" };
  }
  let url;
  try {
    url = new URL(text);
  } catch {
    return { valid: false, error: "不是有效 URL" };
  }
  if (!['http:', 'https:'].includes(url.protocol)) {
    return { valid: false, error: "仅接受 HTTP 或 HTTPS 公网地址" };
  }
  const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!host || host === "localhost" || host.endsWith(".localhost") || host.endsWith(".local") || !host.includes(".")) {
    return { valid: false, error: "本机或局域网地址无法被平台访问" };
  }
  if (isPrivateIpv4(host) || host === "::1" || host === "::" || /^(fc|fd|fe8|fe9|fea|feb)/i.test(host)) {
    return { valid: false, error: "私有、回环或链路本地地址无法被平台访问" };
  }
  return {
    valid: true,
    url: url.href,
    warning: url.protocol === "http:" ? "建议改用 HTTPS 地址" : "",
  };
}

export function hasEmbeddableImageSource(asset) {
  const localPreview = asText(asset?.localPreview);
  const studioPreviewUrl = asText(asset?.studioPreviewUrl);
  return localPreview.startsWith("blob:") || studioPreviewUrl.startsWith(`${TEMU_STUDIO_IMAGE_PATH}?`);
}

function numeric(value) {
  if (value === "" || value == null) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : NaN;
}

function validateEnum(errors, path, value, values, label) {
  if (value && !values.includes(String(value))) {
    errors.push({ path, code: "invalid_enum", message: `${label}不在模板允许值中` });
  }
}

function validateUrlField(errors, warnings, path, value, label) {
  if (!value) return;
  const result = inspectPublicUrl(value);
  if (!result.valid) errors.push({ path, code: "invalid_url", message: `${label}：${result.error}` });
  if (result.warning) warnings.push({ path, code: "http_url", message: `${label}：${result.warning}` });
}

function validatePositive(errors, path, value, label, required = true) {
  const number = numeric(value);
  if (number == null && !required) return;
  if (number == null) errors.push({ path, code: "required", message: `请填写${label}` });
  else if (!Number.isFinite(number) || number <= 0) errors.push({ path, code: "positive", message: `${label}必须大于 0` });
}

export function validateDraft(input, options = {}) {
  const draft = normalizeDraft(input);
  const { product, variants, skus, assets } = draft;
  const freightTemplates = Array.isArray(options.freightTemplates) && options.freightTemplates.length
    ? options.freightTemplates
    : OPTIONS.freightTemplates;
  const errors = [];
  const warnings = [];
  const allowLocalSources = options.allowLocalSources !== false;
  const requirePublicImageUrls = options.requirePublicImageUrls === true;
  const cloudinaryConfigured = Boolean(asText(draft.settings.cloudName) && asText(draft.settings.uploadPreset));
  let pendingUploadCount = 0;
  const imageAvailability = (asset) => {
    const inspected = inspectPublicUrl(asset?.url);
    const hasPublicHttpsUrl = inspected.valid && new URL(inspected.url).protocol === "https:";
    const hasLocalSource = allowLocalSources && hasEmbeddableImageSource(asset);
    const canUpload = !requirePublicImageUrls && cloudinaryConfigured && hasLocalSource && !asset?.url;
    if (!hasPublicHttpsUrl && canUpload) pendingUploadCount += 1;
    return { available: hasPublicHttpsUrl || canUpload, canUpload, hasLocalSource, hasPublicHttpsUrl };
  };
  const required = (path, value, label) => {
    if (!asText(value)) errors.push({ path, code: "required", message: `请填写${label}` });
  };

  required("product.title", product.title, "产品标题");
  required("product.englishTitle", product.englishTitle, "英文标题");
  required("product.freightTemplateId", product.freightTemplateId, "运费模板");
  if (String(product.description || "").length > PRODUCT_DESCRIPTION_MAX_LENGTH) {
    errors.push({ path: "product.description", code: "max_length", message: `产品描述不能超过 ${PRODUCT_DESCRIPTION_MAX_LENGTH} 个字符` });
  }
  required("variants.name1", variants.name1, "第一变种名称");
  if (!skus.length) errors.push({ path: "skus", code: "required", message: "请生成至少一个 SKU" });
  const missingFirstVariantIndex = skus.findIndex((sku) => !asText(sku.variant1Value));
  if (missingFirstVariantIndex !== -1) {
    errors.push({ path: `skus.${missingFirstVariantIndex}.variant1Value`, code: "required", message: "请填写第一变种值" });
  }
  if (variants.name2) {
    const missingSecondVariantIndex = skus.findIndex((sku) => !asText(sku.variant2Value));
    if (missingSecondVariantIndex !== -1) {
      errors.push({ path: `skus.${missingSecondVariantIndex}.variant2Value`, code: "required", message: "请填写第二变种值" });
    }
  }

  if (!assets.carousel.length) errors.push({ path: "assets.carousel", code: "required", message: "至少需要 1 张轮播图" });
  if (assets.carousel.length > 10) errors.push({ path: "assets.carousel", code: "max", message: "轮播图最多 10 张" });
  if (assets.packaging.length > 6) errors.push({ path: "assets.packaging", code: "max", message: "外包装图片最多 6 张" });
  assets.carousel.forEach((asset, index) => {
    const path = `assets.carousel.${index}`;
    const state = imageAvailability(asset);
    if (!state.available) {
      const message = state.hasLocalSource && !cloudinaryConfigured
        ? `轮播图 ${index + 1} 需要先配置 Cloudinary 才能取得公网 URL`
        : `轮播图 ${index + 1} 缺少公网 HTTPS 图片 URL`;
      errors.push({ path, code: "public_image_url_required", message });
    }
    validateUrlField(errors, warnings, `assets.carousel.${index}`, asset.url, `轮播图 ${index + 1}`);
    if (asset.url && inspectPublicUrl(asset.url).valid && new URL(inspectPublicUrl(asset.url).url).protocol !== "https:") {
      errors.push({ path, code: "https_required", message: `轮播图 ${index + 1} 必须使用 HTTPS 图片 URL` });
    }
    if (asset.status === "error" && !state.canUpload && !state.hasPublicHttpsUrl) errors.push({ path, code: "asset_error", message: `轮播图 ${index + 1}：${asset.error || "图片检查失败"}` });
    else if (asset.status === "error" && state.canUpload) warnings.push({ path, code: "asset_upload_retry", message: `轮播图 ${index + 1} 将在导出前重试上传` });
    else if (asset.url && asset.status === "pending") warnings.push({ path: `assets.carousel.${index}`, code: "asset_pending", message: `轮播图 ${index + 1} 尚未检查可访问性` });
  });
  assets.packaging.forEach((asset, index) => {
    const path = `assets.packaging.${index}`;
    const state = imageAvailability(asset);
    if (!state.available) {
      const message = state.hasLocalSource && !cloudinaryConfigured
        ? `外包装图 ${index + 1} 需要先配置 Cloudinary 才能取得公网 URL`
        : `外包装图 ${index + 1} 缺少公网 HTTPS 图片 URL`;
      errors.push({ path, code: "public_image_url_required", message });
    }
    validateUrlField(errors, warnings, `assets.packaging.${index}`, asset.url, `外包装图 ${index + 1}`);
    if (asset.url && inspectPublicUrl(asset.url).valid && new URL(inspectPublicUrl(asset.url).url).protocol !== "https:") {
      errors.push({ path, code: "https_required", message: `外包装图 ${index + 1} 必须使用 HTTPS 图片 URL` });
    }
    if (asset.status === "error" && !state.canUpload && !state.hasPublicHttpsUrl) errors.push({ path, code: "asset_error", message: `外包装图 ${index + 1}：${asset.error || "图片检查失败"}` });
    else if (asset.status === "error" && state.canUpload) warnings.push({ path, code: "asset_upload_retry", message: `外包装图 ${index + 1} 将在导出前重试上传` });
  });

  validateEnum(errors, "product.identifierType", product.identifierType, OPTIONS.identifierTypes, "识别码类型");
  validateEnum(errors, "product.packagingShape", product.packagingShape, OPTIONS.packagingShapes, "外包装形状");
  validateEnum(errors, "product.packagingType", product.packagingType, OPTIONS.packagingTypes, "外包装类型");
  validateEnum(errors, "product.leadTime", product.leadTime, OPTIONS.leadTimes, "发货时效");
  validateEnum(
    errors,
    "product.freightTemplateId",
    product.freightTemplateId,
    freightTemplates.map(({ id }) => id),
    "运费模板",
  );
  validateEnum(errors, "product.customProduct", product.customProduct, OPTIONS.yesNo, "是否定制品");
  validateEnum(errors, "product.skuCategoryType", product.skuCategoryType, OPTIONS.skuCategoryTypes, "SKU 分类类型");
  validateEnum(errors, "product.skuCategoryUnit", product.skuCategoryUnit, OPTIONS.skuCategoryUnits, "SKU 分类单位");
  validateEnum(errors, "product.independentPackaging", product.independentPackaging, OPTIONS.yesNo, "是否独立包装");
  validateEnum(errors, "product.sameProduct", product.sameProduct, OPTIONS.sameProductTypes, "是否同品");
  validateEnum(errors, "product.sensitive", product.sensitive, OPTIONS.yesNo, "是否敏感属性");
  validateEnum(errors, "product.netContentUnit", product.netContentUnit, OPTIONS.contentUnits, "单品净含量单位");
  validateEnum(errors, "product.totalNetContentUnit", product.totalNetContentUnit, OPTIONS.contentUnits, "总净含量单位");

  if (product.packageList.length !== product.packageQuantities.length) {
    errors.push({ path: "product.packageQuantities", code: "line_count", message: "包装清单和数量必须一一对应" });
  }
  if (["同款多件", "混合套装"].includes(product.skuCategoryType)) {
    validatePositive(errors, "product.skuCategoryQuantity", product.skuCategoryQuantity, "SKU 分类数量");
  }
  if (product.netContent) validatePositive(errors, "product.netContent", product.netContent, "单品净含量");
  if (product.totalNetContent) validatePositive(errors, "product.totalNetContent", product.totalNetContent, "总净含量");
  if (product.piecesInside) validatePositive(errors, "product.piecesInside", product.piecesInside, "内计共含件数");

  if (product.sensitiveValues.includes("纯电") || product.sensitiveValues.includes("内电")) {
    const capacity = numeric(product.batteryCapacity);
    if (!Number.isFinite(capacity) || capacity < 0.001 || capacity > 10000) {
      errors.push({ path: "product.batteryCapacity", code: "range", message: "储电容量必须在 0.001 至 10000 WH 之间" });
    }
  }
  if (product.sensitiveValues.includes("刀具")) {
    validatePositive(errors, "product.knifeLength", product.knifeLength, "刀具长度");
    const angle = numeric(product.bladeAngle);
    if (!Number.isFinite(angle) || angle < 1 || angle > 360) {
      errors.push({ path: "product.bladeAngle", code: "range", message: "刀刃角度必须在 1 至 360 度之间" });
    }
  }
  if (product.sensitiveValues.includes("液体")) {
    const liquid = numeric(product.liquidCapacity);
    if (!Number.isFinite(liquid) || liquid < 1 || liquid > 500) {
      errors.push({ path: "product.liquidCapacity", code: "range", message: "液体容量必须在 1 至 500 ML 之间" });
    }
  }

  for (const [path, value, label] of [
    ["product.externalProductUrl", product.externalProductUrl, "站外产品链接"],
    ["product.productVideoUrl", product.productVideoUrl, "产品视频"],
    ["product.descriptionVideoUrl", product.descriptionVideoUrl, "描述视频"],
    ["product.manualUrl", product.manualUrl, "产品说明书"],
  ]) validateUrlField(errors, warnings, path, value, label);
  product.sourceUrls.forEach((url, index) => validateUrlField(errors, warnings, `product.sourceUrls.${index}`, url, `来源 URL ${index + 1}`));

  const codes = new Map();
  skus.forEach((sku, index) => {
    const basePath = `skus.${index}`;
    const imagePath = `${basePath}.image`;
    const imageState = imageAvailability(sku.image);
    required(`${basePath}.skuCode`, sku.skuCode, `SKU ${index + 1} 货号`);
    const normalizedCode = asText(sku.skuCode).toLowerCase();
    if (normalizedCode) {
      if (HAN_CHARACTER_PATTERN.test(normalizedCode)) {
        errors.push({ path: `${basePath}.skuCode`, code: "chinese_characters", message: `SKU ${index + 1} 货号不能包含中文` });
      }
      if (codes.has(normalizedCode)) errors.push({ path: `${basePath}.skuCode`, code: "duplicate", message: `SKU 货号与第 ${codes.get(normalizedCode) + 1} 行重复` });
      else codes.set(normalizedCode, index);
    }
    validatePositive(errors, `${basePath}.declaredPrice`, sku.declaredPrice, `SKU ${index + 1} 申报价`);
    validatePositive(errors, `${basePath}.length`, sku.length, `SKU ${index + 1} 长度`);
    validatePositive(errors, `${basePath}.width`, sku.width, `SKU ${index + 1} 宽度`);
    validatePositive(errors, `${basePath}.height`, sku.height, `SKU ${index + 1} 高度`);
    validatePositive(errors, `${basePath}.weight`, sku.weight, `SKU ${index + 1} 重量`);
    const inventory = numeric(sku.inventory);
    if (inventory != null && (!Number.isFinite(inventory) || inventory < 0 || !Number.isInteger(inventory))) {
      errors.push({ path: `${basePath}.inventory`, code: "integer", message: `SKU ${index + 1} 库存必须是非负整数` });
    }
    if (!imageState.available) {
      const message = imageState.hasLocalSource && !cloudinaryConfigured
        ? `SKU ${index + 1} 图片需要先配置 Cloudinary 才能取得公网 URL`
        : `SKU ${index + 1} 缺少公网 HTTPS 图片 URL`;
      errors.push({ path: imagePath, code: "public_image_url_required", message });
    }
    if (sku.image.url && inspectPublicUrl(sku.image.url).valid && new URL(inspectPublicUrl(sku.image.url).url).protocol !== "https:") {
      errors.push({ path: imagePath, code: "https_required", message: `SKU ${index + 1} 图片必须使用 HTTPS URL` });
    }
    if (sku.image.status === "error" && !imageState.canUpload && !imageState.hasPublicHttpsUrl) {
      errors.push({ path: imagePath, code: "asset_error", message: `SKU ${index + 1} 图片：${sku.image.error || "图片检查失败"}` });
    } else if (sku.image.status === "error" && imageState.canUpload) {
      warnings.push({ path: imagePath, code: "asset_upload_retry", message: `SKU ${index + 1} 图片将在导出前重试上传` });
    } else if (sku.image.url && sku.image.status === "pending") {
      warnings.push({ path: imagePath, code: "asset_pending", message: `SKU ${index + 1} 图片尚未检查可访问性` });
    }
    validateUrlField(errors, warnings, imagePath, sku.image.url, `SKU ${index + 1} 图片`);
    if (imageState.available) {
      if (!sku.image.width || !sku.image.height) {
        errors.push({ path: imagePath, code: "unverified_dimensions", message: `请先检查 SKU ${index + 1} 图片尺寸` });
      } else if (sku.image.width <= 800 || sku.image.height <= 800 || sku.image.width !== sku.image.height) {
        errors.push({ path: imagePath, code: "sku_image_dimensions", message: `SKU ${index + 1} 图片必须为大于 800×800 的正方形` });
      }
    }
  });

  if (pendingUploadCount) {
    warnings.unshift({
      path: "assets",
      code: "image_upload_pending",
      message: `${pendingUploadCount} 张图片将在导出前上传 Cloudinary 并验证公网 URL`,
    });
  }

  return { valid: errors.length === 0, errors, warnings, draft };
}
