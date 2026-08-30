import {
  DEFAULT_FREIGHT_TEMPLATE_ID,
  DEFAULT_FREIGHT_TEMPLATES,
  createDefaultDraft,
  generateSkuMatrix,
  normalizeAsset,
  normalizeDraft,
  validateDraft,
} from "./domain.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "./template-headers.mjs";

export const PRODUCT_WORKBENCH_VERSION = 5;
export const WORKBENCH_BACKUP_FORMAT = "temu-local-listing-workbench";
export const WORKBENCH_BACKUP_VERSION = 1;
export const SHIPPING_PRODUCT_FIELDS = Object.freeze([
  "suggestedPrice",
  "freightTemplateId",
  "leadTime",
]);

function serializableWorkbenchValue(value) {
  return JSON.parse(JSON.stringify(value, (key, nestedValue) => (key === "localPreview" ? undefined : nestedValue)));
}

function timestamp(value, fallback) {
  const parsed = Date.parse(String(value || ""));
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback;
}

function createProductId() {
  return globalThis.crypto?.randomUUID?.() || `product-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function text(value) {
  return String(value ?? "").trim();
}

function normalizeCloudinarySettings(input) {
  return {
    cloudName: text(input?.cloudName),
    uploadPreset: text(input?.uploadPreset),
  };
}

function hasAnyCloudinarySetting(settings) {
  return Boolean(settings.cloudName || settings.uploadPreset);
}

function hasCompleteCloudinarySettings(settings) {
  return Boolean(settings.cloudName && settings.uploadPreset);
}

function legacyCloudinarySettings(items, activeId) {
  const activeItem = items.find((item) => item.id === activeId);
  const candidates = [activeItem, ...items.filter((item) => item !== activeItem)].filter(Boolean);
  const settings = candidates.map((item) => normalizeCloudinarySettings(item.draft?.settings));
  return settings.find(hasCompleteCloudinarySettings)
    || settings.find(hasAnyCloudinarySetting)
    || normalizeCloudinarySettings();
}

export function applySharedCloudinarySettings(workbench, input) {
  const settings = normalizeCloudinarySettings(input);
  return {
    ...workbench,
    items: (workbench?.items || []).map((item) => {
      const current = normalizeCloudinarySettings(item.draft?.settings);
      if (current.cloudName === settings.cloudName && current.uploadPreset === settings.uploadPreset) return item;
      return {
        ...item,
        draft: {
          ...item.draft,
          settings: { ...item.draft.settings, ...settings },
        },
      };
    }),
  };
}

function shippingProductValues(input) {
  if (!input || typeof input !== "object" || Array.isArray(input)) return null;
  return Object.fromEntries(SHIPPING_PRODUCT_FIELDS.map((field) => [field, String(input[field] ?? "")]));
}

export function applyShippingFieldsToAllProducts(workbench, sourceProduct, options = {}) {
  const source = shippingProductValues(sourceProduct);
  const items = Array.isArray(workbench?.items) ? workbench.items : [];
  if (!source || !items.length) return workbench;

  const updatedAt = timestamp(options.now, new Date().toISOString());
  let changed = false;
  const nextItems = items.map((item) => {
    const product = item?.draft?.product;
    const matchesSource = SHIPPING_PRODUCT_FIELDS.every((field) => String(product?.[field] ?? "") === source[field]);
    if (matchesSource) return item;
    changed = true;
    return {
      ...item,
      draft: {
        ...item.draft,
        product: { ...product, ...source },
      },
      updatedAt,
    };
  });
  return changed ? { ...workbench, items: nextItems } : workbench;
}

export function normalizeFreightTemplates(input) {
  const seenIds = new Set();
  const seenNames = new Set();
  const records = [...DEFAULT_FREIGHT_TEMPLATES, ...(Array.isArray(input) ? input : [])]
    .reduce((result, candidate) => {
      const id = text(candidate?.id);
      const name = text(candidate?.name);
      const nameKey = name.toLocaleLowerCase();
      if (!id || !name || seenIds.has(id) || seenNames.has(nameKey)) return result;
      seenIds.add(id);
      seenNames.add(nameKey);
      result.push({ id, name });
      return result;
    }, []);
  return records;
}

function normalizeFreightTemplateSelections(items, freightTemplates) {
  const ids = new Set(freightTemplates.map(({ id }) => id));
  return items.map((item) => {
    if (ids.has(item.draft.product.freightTemplateId)) return item;
    return {
      ...item,
      draft: {
        ...item.draft,
        product: { ...item.draft.product, freightTemplateId: DEFAULT_FREIGHT_TEMPLATE_ID },
      },
    };
  });
}

function normalizedDraft(input) {
  const draft = normalizeDraft(input || createDefaultDraft());
  if (!draft.skus.length) draft.skus = generateSkuMatrix(draft);
  return draft;
}

function hasImageSource(asset) {
  return Boolean(
    String(asset?.url || "").trim()
    || String(asset?.localPreview || "").startsWith("blob:")
    || String(asset?.studioPreviewUrl || "").startsWith(`${TEMU_STUDIO_IMAGE_PATH}?`),
  );
}

function restoreLegacySkuDefaults(draftInput) {
  const draft = normalizeDraft(draftInput || createDefaultDraft());
  if (!draft.skus.length && !draft.variants.values1.length) draft.variants.values1 = ["默认"];
  if (!draft.skus.length) draft.skus = generateSkuMatrix(draft);
  const firstCarousel = draft.assets.carousel[0];
  if (hasImageSource(firstCarousel)) {
    draft.skus.forEach((sku) => {
      if (!hasImageSource(sku.image)) sku.image = normalizeAsset(firstCarousel);
    });
  }
  return draft;
}

function legacyStudioEstimate(value) {
  if (!value || typeof value !== "object") return null;
  const metrics = {};
  for (const key of ["lengthCm", "widthCm", "heightCm", "weightG"]) {
    const number = Number(value[key]);
    if (!Number.isFinite(number) || number <= 0) return null;
    metrics[key] = String(number);
  }
  return metrics;
}

export function discardLegacyDerivedStudioEstimate(draftInput) {
  const draft = normalizedDraft(draftInput);
  const estimate = legacyStudioEstimate(draft.studioImport?.logisticsEstimate);
  if (!estimate) return draft;
  const fields = [
    ["length", "lengthCm"],
    ["width", "widthCm"],
    ["height", "heightCm"],
    ["weight", "weightG"],
  ];
  for (const [draftField, estimateField] of fields) {
    if (String(draft.product[draftField] || "").trim() === estimate[estimateField]) draft.product[draftField] = "";
    for (const sku of draft.skus) {
      if (String(sku[draftField] || "").trim() === estimate[estimateField]) sku[draftField] = "";
    }
  }
  draft.studioImport = { ...draft.studioImport };
  delete draft.studioImport.logisticsEstimate;
  return draft;
}

export function createProductItem(draftInput, options = {}) {
  const now = timestamp(options.now, new Date().toISOString());
  const createdAt = timestamp(options.createdAt, now);
  return {
    id: String(options.id || createProductId()),
    draft: normalizedDraft(draftInput),
    selected: options.selected !== false,
    createdAt,
    updatedAt: timestamp(options.updatedAt, createdAt),
    exportedAt: timestamp(options.exportedAt, ""),
  };
}

export function appendProductItems(workbench, draftInputs, options = {}) {
  const items = workbench?.items || [];
  const drafts = Array.isArray(draftInputs) ? draftInputs : [];
  if (!drafts.length) return workbench;

  const now = timestamp(options.now, new Date().toISOString());
  return {
    ...workbench,
    items: [
      ...items,
      ...drafts.map((draft) => createProductItem(draft, { selected: options.selected, now })),
    ],
  };
}

export function normalizeProductWorkbench(input, options = {}) {
  const source = input && typeof input === "object" ? input : {};
  const now = timestamp(options.now, new Date().toISOString());
  const sourceVersion = Number(source.version || 1);
  const shouldDiscardLegacyEstimate = sourceVersion < 2;
  const shouldRestoreSkuDefaults = sourceVersion < 3;
  const ids = new Set();
  const items = (Array.isArray(source.items) ? source.items : [])
    .filter((item) => item && typeof item === "object")
    .map((item) => {
      const requestedId = String(item.id || "");
      const id = requestedId && !ids.has(requestedId) ? requestedId : createProductId();
      ids.add(id);
      let itemDraft = shouldDiscardLegacyEstimate
        ? discardLegacyDerivedStudioEstimate(item.draft)
        : item.draft;
      if (shouldRestoreSkuDefaults) itemDraft = restoreLegacySkuDefaults(itemDraft);
      return createProductItem(itemDraft, { ...item, id, now });
    });

  if (!items.length) {
    let legacyDraft = shouldDiscardLegacyEstimate
      ? discardLegacyDerivedStudioEstimate(options.legacyDraft || createDefaultDraft())
      : options.legacyDraft || createDefaultDraft();
    if (shouldRestoreSkuDefaults) legacyDraft = restoreLegacySkuDefaults(legacyDraft);
    items.push(createProductItem(legacyDraft, { now }));
  }

  const freightTemplates = normalizeFreightTemplates(source.freightTemplates);
  const normalizedItems = normalizeFreightTemplateSelections(items, freightTemplates);
  const activeId = normalizedItems.some((item) => item.id === source.activeId)
    ? source.activeId
    : normalizedItems[0].id;
  const normalized = { version: PRODUCT_WORKBENCH_VERSION, activeId, freightTemplates, items: normalizedItems };
  return sourceVersion < PRODUCT_WORKBENCH_VERSION
    ? applySharedCloudinarySettings(normalized, legacyCloudinarySettings(normalizedItems, activeId))
    : normalized;
}

export function saveFreightTemplate(workbench, name, { forceCreate = false } = {}) {
  const normalizedName = text(name);
  if (!normalizedName) throw new TypeError("请填写运费模板名称");
  const normalized = normalizeProductWorkbench(workbench);
  const existing = normalized.freightTemplates.find((item) => item.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase());
  const activeItem = normalized.items.find((item) => item.id === normalized.activeId);
  const activeTemplate = normalized.freightTemplates.find((item) => item.id === activeItem?.draft.product.freightTemplateId);
  const template = existing || (!forceCreate && activeTemplate && activeTemplate.id !== DEFAULT_FREIGHT_TEMPLATE_ID
    ? { ...activeTemplate, name: normalizedName }
    : {
      id: globalThis.crypto?.randomUUID?.() || `freight-${Date.now()}-${Math.random().toString(16).slice(2)}`,
      name: normalizedName,
    });
  const freightTemplates = existing
    ? normalized.freightTemplates
    : !forceCreate && activeTemplate && activeTemplate.id !== DEFAULT_FREIGHT_TEMPLATE_ID
      ? normalized.freightTemplates.map((item) => (item.id === activeTemplate.id ? template : item))
      : [...normalized.freightTemplates, template];
  return {
    ...normalized,
    freightTemplates,
    items: normalized.items.map((item) => (item.id === normalized.activeId ? {
      ...item,
      draft: { ...item.draft, product: { ...item.draft.product, freightTemplateId: template.id } },
      updatedAt: new Date().toISOString(),
    } : item)),
  };
}

export function renameFreightTemplate(workbench, templateId, name) {
  const normalizedName = text(name);
  if (!normalizedName) throw new TypeError("请填写运费模板名称");
  if (templateId === DEFAULT_FREIGHT_TEMPLATE_ID) throw new RangeError("默认运费模板不可改名");
  const normalized = normalizeProductWorkbench(workbench);
  const current = normalized.freightTemplates.find((item) => item.id === templateId);
  if (!current) throw new RangeError("运费模板不存在");
  const duplicate = normalized.freightTemplates.find((item) => (
    item.id !== templateId && item.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase()
  ));
  if (duplicate) throw new TypeError("运费模板名称已存在");
  return {
    ...normalized,
    freightTemplates: normalized.freightTemplates.map((item) => (
      item.id === templateId ? { ...item, name: normalizedName } : item
    )),
  };
}

export function deleteFreightTemplate(workbench, templateId) {
  if (templateId === DEFAULT_FREIGHT_TEMPLATE_ID) {
    throw new RangeError("默认运费模板不可删除");
  }
  const normalized = normalizeProductWorkbench(workbench);
  if (!normalized.freightTemplates.some((item) => item.id === templateId)) return normalized;
  const freightTemplates = normalized.freightTemplates.filter((item) => item.id !== templateId);
  return {
    ...normalized,
    freightTemplates,
    items: normalized.items.map((item) => (item.draft.product.freightTemplateId === templateId ? {
      ...item,
      draft: {
        ...item.draft,
        product: { ...item.draft.product, freightTemplateId: DEFAULT_FREIGHT_TEMPLATE_ID },
      },
      updatedAt: new Date().toISOString(),
    } : item)),
  };
}

export function createWorkbenchBackup(input, options = {}) {
  const createdAt = timestamp(options.createdAt, new Date().toISOString());
  return {
    format: WORKBENCH_BACKUP_FORMAT,
    version: WORKBENCH_BACKUP_VERSION,
    createdAt,
    workbench: serializableWorkbenchValue(normalizeProductWorkbench(input, { now: createdAt })),
  };
}

export function restoreWorkbenchBackup(input, options = {}) {
  if (!input || typeof input !== "object" || Array.isArray(input)) {
    throw new TypeError("备份文件不是有效 JSON 对象");
  }
  if (input.format !== WORKBENCH_BACKUP_FORMAT || Number(input.version) !== WORKBENCH_BACKUP_VERSION) {
    throw new TypeError("备份文件不兼容当前工作台");
  }
  if (!input.workbench || typeof input.workbench !== "object" || Array.isArray(input.workbench)
    || !Array.isArray(input.workbench.items) || !input.workbench.items.length) {
    throw new TypeError("备份文件缺少商品工作台数据");
  }
  return normalizeProductWorkbench(serializableWorkbenchValue(input.workbench), options);
}

export function productIsExported(item) {
  const exportedAt = Date.parse(String(item?.exportedAt || ""));
  const updatedAt = Date.parse(String(item?.updatedAt || ""));
  return Number.isFinite(exportedAt) && Number.isFinite(updatedAt) && exportedAt >= updatedAt;
}

export function selectedProductItems(workbench) {
  return (workbench?.items || []).filter((item) => item.selected);
}

export function filterProductItems(workbench, { query = "", status = "" } = {}) {
  const normalizedQuery = String(query || "").trim().toLowerCase();
  const normalizedStatus = String(status || "");
  return (workbench?.items || []).filter((item) => {
    if (normalizedQuery) {
      const draft = item?.draft || {};
      const searchText = [
        draft.product?.title,
        draft.product?.englishTitle,
        draft.product?.productCode,
        ...(draft.skus || []).map((sku) => sku?.skuCode),
      ].map((value) => String(value || "").toLowerCase()).join("\n");
      if (!searchText.includes(normalizedQuery)) return false;
    }
    if (normalizedStatus === "exported") return productIsExported(item);
    if (normalizedStatus === "unexported") return !productIsExported(item);
    if (normalizedStatus === "incomplete") return !validateDraft(item.draft, { freightTemplates: workbench.freightTemplates }).valid;
    if (normalizedStatus === "complete") return validateDraft(item.draft, { freightTemplates: workbench.freightTemplates }).valid;
    return true;
  });
}

export function applyProductSelection(workbench, preset) {
  const normalizedPreset = String(preset || "");
  const items = (workbench?.items || []).map((item) => {
    if (normalizedPreset === "all") return { ...item, selected: true };
    if (normalizedPreset === "none") return { ...item, selected: false };
    if (normalizedPreset === "exported") return { ...item, selected: productIsExported(item) };
    if (normalizedPreset === "unexported") return { ...item, selected: !productIsExported(item) };
    return item;
  });
  return { ...workbench, items };
}

export function resetActiveProduct(workbench, options = {}) {
  const items = workbench?.items || [];
  const activeIndex = items.findIndex((item) => item.id === workbench?.activeId);
  if (activeIndex < 0) return workbench;

  const activeItem = items[activeIndex];
  const resetDraft = normalizedDraft(createDefaultDraft());
  resetDraft.settings = { ...resetDraft.settings, ...activeItem.draft?.settings };
  const updatedAt = timestamp(options.now, new Date().toISOString());
  return {
    ...workbench,
    items: items.map((item, index) => (index === activeIndex ? {
      ...item,
      draft: resetDraft,
      updatedAt,
      exportedAt: "",
    } : item)),
  };
}

export function deleteSelectedProducts(workbench, options = {}) {
  const items = workbench?.items || [];
  const selectedIds = new Set(items.filter((item) => item.selected).map((item) => item.id));
  if (!selectedIds.size) return workbench;

  const activeIndex = items.findIndex((item) => item.id === workbench?.activeId);
  const remainingItems = items.filter((item) => !selectedIds.has(item.id));
  if (!remainingItems.length) {
    const settingsSource = items[activeIndex]?.draft?.settings || items[0]?.draft?.settings;
    const replacementDraft = normalizedDraft(createDefaultDraft());
    replacementDraft.settings = { ...replacementDraft.settings, ...settingsSource };
    const replacement = createProductItem(replacementDraft, { selected: false, now: options.now });
    return { ...workbench, activeId: replacement.id, items: [replacement] };
  }

  const activeItem = items[activeIndex];
  const nextActive = activeItem && !selectedIds.has(activeItem.id)
    ? activeItem
    : items.slice(activeIndex + 1).find((item) => !selectedIds.has(item.id))
      || items.slice(0, Math.max(activeIndex, 0)).findLast((item) => !selectedIds.has(item.id))
      || remainingItems[0];
  return {
    ...workbench,
    activeId: nextActive.id,
    items: remainingItems,
  };
}

export function markProductsExported(workbench, productIds, exportedAt = new Date().toISOString()) {
  const ids = new Set(productIds || []);
  const normalizedExportedAt = timestamp(exportedAt, new Date().toISOString());
  return {
    ...workbench,
    items: (workbench?.items || []).map((item) => (
      ids.has(item.id) ? { ...item, exportedAt: normalizedExportedAt } : item
    )),
  };
}
