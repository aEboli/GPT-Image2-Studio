import {
  OPTIONS,
  VARIANT_ATTRIBUTE_OPTIONS,
  availableVariantAttributeOptions,
  applySkuBulkFields,
  createDefaultDraft,
  generateSkuMatrix,
  inspectPublicUrl,
  normalizeAsset,
  normalizeDraft,
  reorderCarouselAsset,
  splitOrigin,
  splitLines,
  truncateProductDescription,
  updateSkuVariantAttributeName,
  updateSkuVariantValue,
  validateDraft,
} from "/lib/temu/domain.mjs";
import {
  STUDIO_CAROUSEL_LIMIT,
  createStudioAsset,
  defaultStudioCarouselItemIds,
  defaultStudioSkuSubjectKeys,
  groupStudioAssetsForUpload,
  mergeStudioSetIntoDraft,
  normalizeStudioLogisticsEstimate,
  remainingStudioCarouselImages,
  stripStudioImageSuffix,
  studioSkuSubjectEntries,
  toggleStudioCarouselSelection,
  toggleStudioSkuSubjectSelection,
} from "/lib/temu/studio-import.mjs";
import {
  createContentAddressedUploadCache,
  uploadMissingPublicImages,
} from "/lib/temu/image-upload.mjs";
import {
  createSkuImageFromCarousel,
  releaseUnusedAssetResources,
  updateSkuImageUrl,
  viewableSkuImageUrl,
} from "/lib/temu/sku-image-quick-edit.mjs";
import {
  PRODUCT_WORKBENCH_VERSION,
  applyShippingFieldsToAllProducts,
  applySharedCloudinarySettings,
  appendProductItems,
  applyProductSelection,
  createWorkbenchBackup,
  createProductItem,
  deleteFreightTemplate,
  deleteSelectedProducts,
  filterProductItems,
  markProductsExported,
  normalizeProductWorkbench,
  productIsExported,
  renameFreightTemplate,
  resetActiveProduct,
  restoreWorkbenchBackup,
  saveFreightTemplate,
  selectedProductItems,
} from "/lib/temu/product-workbench.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "/lib/temu/template-headers.mjs";

// 工作台的五个接口全部挂在 /api/temu/ 之下（非 GET 必须位于 /api/ 前缀内才会被 CSRF 检查覆盖）。
// 前缀从 TEMU_STUDIO_IMAGE_PATH 反推而非另写一份字面量：全仓只有 lib/temu/template-headers.mjs
// 一处声明该契约，将来整段前缀迁移时这里会跟着走，不会静默留在旧路径上。
const API_BASE = TEMU_STUDIO_IMAGE_PATH.replace(/\/studio\/image$/, "");
const API_HEALTH = `${API_BASE}/health`;
const API_STUDIO_SETS = `${API_BASE}/studio/sets`;
const API_ASSETS_VERIFY = `${API_BASE}/assets/verify`;
const API_EXPORT = `${API_BASE}/export`;

// 跨文档协议：只有这三种消息，且两端都按 location.origin 校验来源。
const WORKBENCH_MESSAGE_INIT = "temu-workbench:init";
const WORKBENCH_MESSAGE_THEME = "temu-workbench:theme";
const WORKBENCH_MESSAGE_REQUEST_CLOSE = "temu-workbench:request-close";

const LEGACY_STORAGE_KEY = "temu-local-listing:draft:v1";
const WORKBENCH_STORAGE_KEY = "temu-local-listing:products:v1";
const EXPORT_SOURCE_MAX_BYTES = 25 * 1024 * 1024;
const BACKUP_MAX_BYTES = 8 * 1024 * 1024;
const localFiles = new Map();
const publicImageUploads = createContentAddressedUploadCache();
const viewSections = [...document.querySelectorAll("[data-view]")];
const studioCarouselSelections = new Map();
const studioSkuSubjectSelections = new Map();
const studioEstimateSelections = new Map();
const selectedStudioSetIds = new Set();
let saveTimer = null;
let toastTimer = null;
let exportPending = false;
let templateReady = false;
let navigationFrame = null;
let studioSets = [];
let selectedStudioSetId = "";
let studioLoading = false;
let studioImportPending = false;
let studioLoadError = "";
let productSearchQuery = "";
let productStatusFilter = "";
let freightTemplateCreatePending = false;
const studioRecordFilters = { listing: "", estimate: "" };
let draftNeedsMigrationSave = false;
const imageLightboxState = {
  scale: 1,
  x: 0,
  y: 0,
  dragging: false,
  pointerId: null,
  startPointerX: 0,
  startPointerY: 0,
  startImageX: 0,
  startImageY: 0,
};
let skuImageContextTarget = null;
let skuCarouselPickerTarget = null;
let skuImageSourceMenuTarget = null;
let carouselDragState = null;
let skuImageUrlEditorTarget = null;
const assetCollectionPending = new Set();
const carouselAddState = {
  productId: "",
  set: null,
  loading: false,
  adding: false,
  error: "",
  selectedStudioItemIds: new Set(),
};
let carouselAddLoadToken = 0;
let carouselAddOperationToken = 0;

function loadWorkbench() {
  try {
    const storedWorkbench = localStorage.getItem(WORKBENCH_STORAGE_KEY);
    const storedLegacyDraft = localStorage.getItem(LEGACY_STORAGE_KEY);
    const parsedWorkbench = storedWorkbench ? JSON.parse(storedWorkbench) : null;
    const parsedLegacyDraft = storedLegacyDraft ? JSON.parse(storedLegacyDraft) : null;
    draftNeedsMigrationSave = Boolean(
      !parsedWorkbench
      || parsedWorkbench.version !== PRODUCT_WORKBENCH_VERSION
      || parsedWorkbench.items?.some((item) => item?.draft?.version !== createDefaultDraft().version),
    );
    return normalizeProductWorkbench(parsedWorkbench, { legacyDraft: parsedLegacyDraft });
  } catch {
    draftNeedsMigrationSave = true;
    return normalizeProductWorkbench(null);
  }
}

let workbench = loadWorkbench();

function activeProductItem() {
  return workbench.items.find((item) => item.id === workbench.activeId) || workbench.items[0];
}

let draft = activeProductItem().draft;

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function getPath(object, path) {
  return path.split(".").reduce((value, key) => value?.[key], object);
}

function setPath(object, path, value) {
  const keys = path.split(".");
  let target = object;
  for (let index = 0; index < keys.length - 1; index += 1) {
    target[keys[index]] ??= {};
    target = target[keys[index]];
  }
  target[keys.at(-1)] = value;
}

function serializableValue(value) {
  return JSON.parse(JSON.stringify(value, (key, nestedValue) => {
    if (key === "localPreview") return undefined;
    return nestedValue;
  }));
}

function serializableDraft(targetDraft = draft) {
  return serializableValue(targetDraft);
}

function exportableDraft(targetDraft) {
  const outgoingDraft = serializableDraft(targetDraft);
  if (!OPTIONS.freightTemplates.some(({ id }) => id === outgoingDraft.product.freightTemplateId)) {
    outgoingDraft.product.freightTemplateId = OPTIONS.freightTemplates[0].id;
  }
  return outgoingDraft;
}

function serializableWorkbench() {
  activeProductItem().draft = draft;
  return serializableValue(workbench);
}

function currentFreightTemplates() {
  return workbench.freightTemplates;
}

function backupFilename() {
  const timestamp = new Date().toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  return `temu-workbench-backup-${timestamp}.json`;
}

function downloadTextFile(filename, text, type) {
  const anchor = document.createElement("a");
  const url = URL.createObjectURL(new Blob([text], { type }));
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function exportWorkbenchBackup() {
  saveDraftNow();
  const backup = createWorkbenchBackup(serializableWorkbench());
  downloadTextFile(backupFilename(), `${JSON.stringify(backup, null, 2)}\n`, "application/json");
  showToast("草稿备份已导出；普通本地图片需要在恢复后重新选择");
}

async function restoreWorkbenchBackupFile(file) {
  if (!file) return;
  try {
    if (file.size > BACKUP_MAX_BYTES) throw new Error("草稿备份超过 8 MB，已拒绝恢复");
    const parsed = JSON.parse(await file.text());
    const restored = restoreWorkbenchBackup(parsed);
    if (!window.confirm(`将用备份中的 ${restored.items.length} 个商品替换当前本地草稿。未备份的本地图片需要重新选择，是否继续？`)) return;
    workbench.items.forEach((item) => releaseReplacedLocalAssets(item.draft));
    localFiles.clear();
    workbench = restored;
    draft = activeProductItem().draft;
    rememberKnownUploadedImages();
    saveDraftNow();
    syncBoundInputs();
    syncSensitiveInputs();
    renderDynamic();
    showToast(`已恢复 ${workbench.items.length} 个商品草稿`);
  } catch (error) {
    showToast(error.message || "草稿备份恢复失败", "error");
  }
}

function saveDraftNow() {
  clearTimeout(saveTimer);
  saveTimer = null;
  localStorage.setItem(WORKBENCH_STORAGE_KEY, JSON.stringify(serializableWorkbench()));
  localStorage.setItem(LEGACY_STORAGE_KEY, JSON.stringify(serializableDraft()));
  document.querySelector("#saveStatus").textContent = "草稿已保存";
}

function scheduleSave() {
  document.querySelector("#saveStatus").textContent = "正在保存";
  activeProductItem().draft = draft;
  activeProductItem().updatedAt = new Date().toISOString();
  clearTimeout(saveTimer);
  saveTimer = setTimeout(saveDraftNow, 180);
}

function showToast(message, type = "normal") {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.classList.toggle("is-error", type === "error");
  toast.classList.add("is-visible");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toast.classList.remove("is-visible"), 3200);
}

function refreshIcons() {
  window.lucide?.createIcons({ attrs: { "aria-hidden": "true" } });
}

function productDisplayTitle(item, index) {
  return item.draft.product.title || item.draft.product.englishTitle || `未命名商品 ${index + 1}`;
}

function productImageCount(targetDraft) {
  return targetDraft.assets.carousel.length
    + targetDraft.assets.packaging.length
    + targetDraft.skus.filter((sku) => assetSource(sku.image)).length;
}

function renderProductList() {
  const list = document.querySelector("#productList");
  const selectedItems = selectedProductItems(workbench);
  const visibleItems = filterProductItems(workbench, { query: productSearchQuery, status: productStatusFilter });
  const interactionDisabled = exportPending || studioImportPending;
  document.querySelector("#productTotalCount").textContent = `${workbench.items.length} 个商品`;
  document.querySelector("#productVisibleCount").textContent = productSearchQuery || productStatusFilter
    ? `显示 ${visibleItems.length} / ${workbench.items.length}`
    : `显示 ${visibleItems.length}`;
  document.querySelector("#selectedProductCount").textContent = `已选 ${selectedItems.length}`;
  document.querySelector("#exportSelectionCount").textContent = selectedItems.length;

  const selectAll = document.querySelector("#selectAllProducts");
  selectAll.checked = selectedItems.length > 0 && selectedItems.length === workbench.items.length;
  selectAll.indeterminate = selectedItems.length > 0 && selectedItems.length < workbench.items.length;
  selectAll.disabled = interactionDisabled;
  document.querySelector("#productSelectionPreset").disabled = interactionDisabled;
  document.querySelector("#addProductButton").disabled = interactionDisabled;
  const resetButton = document.querySelector("#resetCurrentProductButton");
  resetButton.disabled = interactionDisabled;
  resetButton.title = "恢复当前商品默认页面";
  resetButton.setAttribute("aria-label", resetButton.title);
  const deleteButton = document.querySelector("#deleteSelectedProductsButton");
  const deletionUnavailable = interactionDisabled || selectedItems.length === 0;
  deleteButton.disabled = deletionUnavailable;
  deleteButton.title = selectedItems.length === 0
    ? "请先勾选要删除的商品"
    : interactionDisabled
      ? "导出或 Studio 导入期间无法删除商品"
      : `删除已勾选的 ${selectedItems.length} 个商品`;
  deleteButton.setAttribute("aria-label", deleteButton.title);

  if (!visibleItems.length) {
    list.innerHTML = `<div class="product-list-empty" role="status"><strong>没有匹配的商品</strong></div>`;
    return;
  }

  list.innerHTML = visibleItems.map((item) => {
    const index = workbench.items.indexOf(item);
    const title = productDisplayTitle(item, index);
    const validation = validateDraft(item.draft, { freightTemplates: currentFreightTemplates() });
    const exported = productIsExported(item);
    const exportText = exported ? "已导出" : item.exportedAt ? "已修改" : "未导出";
    const exportClass = exported ? "is-ready" : item.exportedAt ? "is-changed" : "";
    const completenessText = validation.valid ? "资料完整" : `缺 ${validation.errors.length} 项`;
    const thumbnail = assetSource(item.draft.assets.carousel[0]);
    const imageCount = productImageCount(item.draft);
    const isActive = item.id === workbench.activeId;
    return `
      <div class="product-row ${isActive ? "is-active" : ""}" role="listitem" data-product-row="${escapeHtml(item.id)}">
        <label class="product-row-select" title="${item.selected ? "取消勾选商品" : "勾选商品"}">
          <input type="checkbox" data-product-select="${escapeHtml(item.id)}" aria-label="选择商品 ${escapeHtml(title)}" ${item.selected ? "checked" : ""} ${interactionDisabled ? "disabled" : ""}>
        </label>
        <button class="product-row-open" type="button" data-product-open="${escapeHtml(item.id)}" title="编辑 ${escapeHtml(title)}" aria-current="${isActive ? "true" : "false"}" ${interactionDisabled ? "disabled" : ""}>
          <span class="product-row-thumb">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy">` : `<span>${index + 1}</span>`}</span>
          <span class="product-row-copy">
            <strong title="${escapeHtml(title)}">${escapeHtml(title)}</strong>
            <small class="product-row-counts"><span>${item.draft.skus.length} SKU</span><span class="product-image-count">${imageCount} 图</span></small>
            <small class="product-row-code" title="${escapeHtml(item.draft.product.productCode || "暂无货号")}">${escapeHtml(item.draft.product.productCode || "暂无货号")}</small>
            <span class="product-row-statuses">
              <span class="product-completeness ${validation.valid ? "is-complete" : ""}">${completenessText}</span>
              <span class="product-export-status ${exportClass}">${exportText}</span>
            </span>
          </span>
        </button>
      </div>
    `;
  }).join("");
}

function clearBulkSkuInputs() {
  document.querySelectorAll("[data-bulk-sku-field]").forEach((input) => { input.value = ""; });
}

function activateProduct(productId) {
  if (exportPending || studioImportPending || productId === workbench.activeId) return;
  const nextItem = workbench.items.find((item) => item.id === productId);
  if (!nextItem) return;
  saveDraftNow();
  carouselAddLoadToken += 1;
  carouselAddOperationToken += 1;
  carouselAddState.selectedStudioItemIds.clear();
  document.querySelector("#carouselAddDialog")?.close();
  workbench.activeId = nextItem.id;
  draft = nextItem.draft;
  clearBulkSkuInputs();
  saveDraftNow();
  syncBoundInputs();
  syncSensitiveInputs();
  renderDynamic();
  requestAnimationFrame(() => {
    [...document.querySelectorAll("[data-product-row]")]
      .find((row) => row.dataset.productRow === productId)
      ?.scrollIntoView({ block: "nearest" });
  });
}

function addProduct() {
  if (exportPending || studioImportPending) return;
  productSearchQuery = "";
  productStatusFilter = "";
  document.querySelector("#productSearchInput").value = "";
  document.querySelector("#productStatusFilter").value = "";
  saveDraftNow();
  const nextDraft = createDefaultDraft();
  nextDraft.settings = { ...draft.settings };
  nextDraft.skus = generateSkuMatrix(nextDraft);
  const item = createProductItem(nextDraft);
  workbench.items.push(item);
  workbench.activeId = item.id;
  draft = item.draft;
  saveDraftNow();
  syncBoundInputs();
  syncSensitiveInputs();
  renderDynamic();
  document.querySelector('[data-field="product.title"]')?.focus();
  showToast("已添加一个新商品");
}

function resetCurrentProduct() {
  if (exportPending || studioImportPending) return;
  if (!window.confirm("将恢复当前商品的默认页面吗？商品字段、SKU、图片和 Studio 导入内容将被清空，已配置的 Cloudinary 上传设置会保留。")) return;
  const nextWorkbench = resetActiveProduct(workbench);
  if (nextWorkbench === workbench) return;
  releaseReplacedLocalAssets(activeProductItem().draft);
  workbench = nextWorkbench;
  draft = activeProductItem().draft;
  clearBulkSkuInputs();
  saveDraftNow();
  syncBoundInputs();
  syncSensitiveInputs();
  renderDynamic();
  document.querySelector('[data-field="product.title"]')?.focus();
  showToast("当前商品已恢复默认");
}

function deleteSelectedProductItems() {
  const selectedItems = selectedProductItems(workbench);
  if (exportPending || studioImportPending || !selectedItems.length) return;
  const deletesAll = selectedItems.length === workbench.items.length;
  const confirmation = deletesAll
    ? `确定删除已勾选的 ${selectedItems.length} 个商品吗？删除后将保留一个新的空白商品，此操作无法恢复。`
    : `确定删除已勾选的 ${selectedItems.length} 个商品吗？未勾选商品不会改变，且无法恢复。`;
  if (!window.confirm(confirmation)) return;
  const nextWorkbench = deleteSelectedProducts(workbench);
  if (nextWorkbench === workbench) return;
  selectedItems.forEach((item) => releaseReplacedLocalAssets(item.draft));
  workbench = nextWorkbench;
  draft = activeProductItem().draft;
  clearBulkSkuInputs();
  saveDraftNow();
  syncBoundInputs();
  syncSensitiveInputs();
  renderDynamic();
  showToast(deletesAll
    ? `已删除 ${selectedItems.length} 个已勾选商品，已创建空白商品`
    : `已删除 ${selectedItems.length} 个已勾选商品`);
}

function applyImageLightboxTransform() {
  const image = document.querySelector("#imageLightboxImage");
  image.style.transform = `translate3d(${imageLightboxState.x}px, ${imageLightboxState.y}px, 0) scale(${imageLightboxState.scale})`;
  image.classList.toggle("is-dragging", imageLightboxState.dragging);
}

function resetImageLightboxTransform() {
  Object.assign(imageLightboxState, {
    scale: 1,
    x: 0,
    y: 0,
    dragging: false,
    pointerId: null,
  });
  applyImageLightboxTransform();
}

function setImageLightboxScale(value) {
  imageLightboxState.scale = Math.min(6, Math.max(0.5, value));
  applyImageLightboxTransform();
}

function openImageLightbox(source, alt = "图片预览") {
  if (!source) return;
  const dialog = document.querySelector("#imageLightbox");
  const image = document.querySelector("#imageLightboxImage");
  image.src = source;
  image.alt = alt;
  resetImageLightboxTransform();
  if (!dialog.open) dialog.showModal();
}

function closeImageLightbox() {
  const dialog = document.querySelector("#imageLightbox");
  if (dialog.open) dialog.close();
}

function syncBoundInputs() {
  document.querySelectorAll("[data-field]").forEach((element) => {
    const value = getPath(draft, element.dataset.field);
    if (element.dataset.type === "boolean") element.checked = Boolean(value);
    else if (element.type === "radio") element.checked = String(element.value) === String(value ?? "");
    else element.value = value ?? "";
  });
  document.querySelectorAll("[data-array-field]").forEach((element) => {
    const value = getPath(draft, element.dataset.arrayField);
    element.value = Array.isArray(value) ? value.join("\n") : "";
  });
  syncOriginInputs();
}

function initOptions() {
  renderFreightTemplateOptions();
  for (const id of ["netContentUnit", "totalNetContentUnit"]) {
    const select = document.querySelector(`#${id}`);
    select.innerHTML = OPTIONS.contentUnits.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  }
  const sensitive = document.querySelector("#sensitiveOptions");
  sensitive.innerHTML = OPTIONS.sensitiveValues.map((value) => `
    <label><input type="checkbox" data-sensitive-value="${escapeHtml(value)}"><span>${escapeHtml(value)}</span></label>
  `).join("");
  document.querySelector("#originCountry").innerHTML = OPTIONS.originCountries
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`).join("");
  document.querySelector("#originProvince").innerHTML = OPTIONS.originProvinces
    .map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value || "请选择省份")}</option>`).join("");
}

function renderFreightTemplateOptions() {
  const select = document.querySelector("#freightTemplateId");
  const selectedId = draft.product.freightTemplateId;
  select.innerHTML = currentFreightTemplates().map(({ id, name }) =>
    `<option value="${escapeHtml(id)}"${id === selectedId ? " selected" : ""}>${escapeHtml(name)}</option>`).join("");
  select.value = selectedId;
}

function renderFreightTemplateRecords() {
  const activeId = draft.product.freightTemplateId;
  const addButton = document.querySelector("#addFreightTemplateButton");
  if (addButton) addButton.disabled = exportPending || studioImportPending;
  const records = currentFreightTemplates().map(({ id, name }) => {
    const isDefault = id === "HFT-18421307196784823200";
    return `
      <div class="freight-template-record${id === activeId ? " is-active" : ""}${isDefault ? " is-default" : ""}">
        ${isDefault
          ? `<span title="${escapeHtml(name)}">${escapeHtml(name)}</span>`
          : `<input class="freight-template-name-input" type="text" value="${escapeHtml(name)}" data-edit-freight-template="${escapeHtml(id)}" autocomplete="off" aria-label="编辑运费模板 ${escapeHtml(name)}">`}
        ${isDefault ? "" : `<button class="icon-button freight-template-delete" type="button" data-delete-freight-template="${escapeHtml(id)}" title="删除运费模板" aria-label="删除运费模板 ${escapeHtml(name)}"><i data-lucide="trash-2"></i></button>`}
      </div>
    `;
  });
  if (freightTemplateCreatePending) {
    records.push(`
      <div class="freight-template-record is-editing">
        <input class="freight-template-name-input" id="newFreightTemplateName" type="text" data-new-freight-template autocomplete="off" placeholder="输入模板名称后按 Enter 保存" aria-label="新运费模板名称">
      </div>
    `);
  }
  document.querySelector("#freightTemplateRecords").innerHTML = records.join("");
}

function renderApplyShippingToAllButton() {
  const button = document.querySelector("#applyShippingToAllButton");
  if (!button) return;
  const interactionDisabled = exportPending || studioImportPending;
  button.disabled = interactionDisabled;
  button.title = interactionDisabled
    ? "导出或 Studio 导入期间无法应用"
    : `将当前价格与运输信息应用到全部 ${workbench.items.length} 个商品`;
  button.setAttribute("aria-label", button.title);
}

function applyShippingToAllProducts() {
  if (exportPending || studioImportPending) return;
  const productCount = workbench.items.length;
  const confirmed = window.confirm(
    `将当前商品的建议售价、运费模板和发货时效覆盖到全部 ${productCount} 个商品。空的建议售价也会覆盖已有值，是否继续？`,
  );
  if (!confirmed) return;

  const nextWorkbench = applyShippingFieldsToAllProducts(workbench, draft.product);
  if (nextWorkbench === workbench) {
    showToast(`全部 ${productCount} 个商品的价格与运输信息已一致`);
    return;
  }
  workbench = nextWorkbench;
  draft = activeProductItem().draft;
  saveDraftNow();
  syncBoundInputs();
  renderDynamic();
  showToast(`已将价格与运输信息应用到全部 ${productCount} 个商品`);
}

function openFreightTemplateCreator() {
  if (exportPending || studioImportPending || freightTemplateCreatePending) return;
  freightTemplateCreatePending = true;
  renderFreightTemplateRecords();
  refreshIcons();
  requestAnimationFrame(() => document.querySelector("#newFreightTemplateName")?.focus());
}

function saveFreightTemplateFromInput(input) {
  const templateId = input.dataset.editFreightTemplate;
  try {
    workbench = templateId
      ? renameFreightTemplate(workbench, templateId, input.value)
      : saveFreightTemplate(workbench, input.value, { forceCreate: true });
    freightTemplateCreatePending = false;
    draft = activeProductItem().draft;
    saveDraftNow();
    renderFreightTemplateOptions();
    syncBoundInputs();
    renderDynamic();
    showToast(templateId ? "运费模板已更新" : "运费模板已保存");
  } catch (error) {
    showToast(error.message || "运费模板保存失败", "error");
  }
}

function deleteFreightTemplateRecord(templateId) {
  try {
    workbench = deleteFreightTemplate(workbench, templateId);
    draft = activeProductItem().draft;
    saveDraftNow();
    renderFreightTemplateOptions();
    syncBoundInputs();
    renderDynamic();
    showToast("运费模板已删除，引用商品已切回默认模板");
  } catch (error) {
    showToast(error.message || "运费模板删除失败", "error");
  }
}

function syncOriginInputs() {
  const { country, province } = splitOrigin(draft.product.origin);
  document.querySelector("#originCountry").value = country;
  document.querySelector("#originProvince").value = province;
}

function updateOriginFromInputs() {
  const country = document.querySelector("#originCountry").value;
  const province = document.querySelector("#originProvince").value;
  draft.product.origin = `${country}-${province}`;
  scheduleSave();
  renderValidation();
}

function syncSensitiveInputs() {
  document.querySelectorAll("[data-sensitive-value]").forEach((input) => {
    input.checked = draft.product.sensitiveValues.includes(input.dataset.sensitiveValue);
  });
}

function comboLabel(sku) {
  const first = `${draft.variants.name1 || "变种一"}：${sku.variant1Value || "-"}`;
  const second = draft.variants.name2 ? `${draft.variants.name2}：${sku.variant2Value || "-"}` : "";
  return [first, second].filter(Boolean).join(" / ");
}

function skuVariantValueMarkup(sku, index, field, name) {
  const value = sku[field] || "";
  return `<input class="sku-variant-value" data-sku-variant-value="${field}" data-sku-index="${index}" value="${escapeHtml(value)}" readonly aria-label="${escapeHtml(name)}变种值" title="双击编辑变种值">`;
}

function skuVariantAttributeOptionsMarkup(attributes, placeholder = "") {
  const placeholderMarkup = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : "";
  return `${placeholderMarkup}${attributes.map((attribute) => `<option value="${escapeHtml(attribute)}">${escapeHtml(attribute)}</option>`).join("")}`;
}

function renderSkuVariantAttributeHeaders() {
  const first = document.querySelector("#skuVariantName1");
  const second = document.querySelector("#skuVariantName2");
  const firstName = draft.variants.name1 || VARIANT_ATTRIBUTE_OPTIONS[0];
  const secondName = draft.variants.name2 || "";
  first.innerHTML = skuVariantAttributeOptionsMarkup(VARIANT_ATTRIBUTE_OPTIONS);
  first.value = firstName;
  second.innerHTML = skuVariantAttributeOptionsMarkup(availableVariantAttributeOptions(firstName), "变种");
  second.value = secondName;
}

function skuImageTarget(index) {
  const sku = draft.skus[index];
  if (!sku) return null;
  return { productId: activeProductItem().id, skuKey: sku.key, skuIndex: index };
}

function resolveSkuImageTarget(target) {
  if (!target || target.productId !== activeProductItem().id) return null;
  const index = target.skuKey
    ? draft.skus.findIndex((sku) => sku.key === target.skuKey)
    : Number(target.skuIndex);
  if (index < 0) return null;
  const sku = draft.skus[index];
  return sku ? { index, sku } : null;
}

function closeSkuImageContextMenu() {
  const menu = document.querySelector("#skuImageContextMenu");
  if (!menu || menu.hidden) return;
  menu.hidden = true;
  skuImageContextTarget = null;
}

function closeSkuImageSourceMenu() {
  const menu = document.querySelector("#skuImageSourceMenu");
  if (menu) menu.hidden = true;
  skuImageSourceMenuTarget = null;
}

function openSkuImageSourceMenu(index, trigger) {
  const target = skuImageTarget(index);
  if (!target) return;
  closeSkuImageContextMenu();
  const menu = document.querySelector("#skuImageSourceMenu");
  skuImageSourceMenuTarget = target;
  document.querySelector("#skuImageSourceLabel").textContent = comboLabel(draft.skus[index]);
  menu.hidden = false;
  const triggerRect = trigger.getBoundingClientRect();
  const menuRect = menu.getBoundingClientRect();
  const margin = 8;
  menu.style.left = `${Math.min(Math.max(margin, triggerRect.left), window.innerWidth - menuRect.width - margin)}px`;
  menu.style.top = `${Math.min(Math.max(margin, triggerRect.bottom + 6), window.innerHeight - menuRect.height - margin)}px`;
  requestAnimationFrame(() => {
    if (!menu.hidden) menu.querySelector("[role='menuitem']")?.focus();
  });
}

function openSkuImageContextMenu(index, clientX, clientY, trigger) {
  const target = skuImageTarget(index);
  if (!target) return;
  closeSkuImageSourceMenu();
  const menu = document.querySelector("#skuImageContextMenu");
  skuImageContextTarget = target;
  document.querySelector("#skuImageContextLabel").textContent = comboLabel(draft.skus[index]);
  const viewCommand = menu.querySelector("[data-sku-image-command='view-url']");
  const viewableUrl = viewableSkuImageUrl(draft.skus[index].image);
  viewCommand?.setAttribute("aria-disabled", String(!viewableUrl));
  if (viewCommand) viewCommand.title = viewableUrl ? "在新标签页查看公网链接" : "当前 SKU 没有可查看的公网链接";
  menu.hidden = false;
  const triggerRect = trigger.getBoundingClientRect();
  const anchorX = clientX || triggerRect.left + triggerRect.width / 2;
  const anchorY = clientY || triggerRect.top + triggerRect.height / 2;
  const menuRect = menu.getBoundingClientRect();
  const margin = 8;
  menu.style.left = `${Math.min(Math.max(margin, anchorX), window.innerWidth - menuRect.width - margin)}px`;
  menu.style.top = `${Math.min(Math.max(margin, anchorY), window.innerHeight - menuRect.height - margin)}px`;
  requestAnimationFrame(() => {
    if (!menu.hidden) menu.querySelector("[role='menuitem']")?.focus();
  });
}

function openSkuFilePicker(target) {
  if (!resolveSkuImageTarget(target)) return;
  const input = document.querySelector("#skuFileInput");
  input.dataset.productId = target.productId;
  input.dataset.skuKey = target.skuKey;
  input.dataset.skuIndex = target.skuIndex;
  input.value = "";
  input.click();
}

function openSkuImageUrl(target) {
  const resolved = resolveSkuImageTarget(target);
  const url = viewableSkuImageUrl(resolved?.sku?.image);
  if (!url) {
    showToast("当前 SKU 没有可查看的公网链接", "error");
    return;
  }
  const opened = window.open(url, "_blank", "noopener,noreferrer");
  if (opened) return;
  const fallback = document.createElement("a");
  fallback.href = url;
  fallback.target = "_blank";
  fallback.rel = "noopener noreferrer";
  fallback.click();
}

function openSkuImageUrlEditor(target) {
  const resolved = resolveSkuImageTarget(target);
  const dialog = document.querySelector("#skuImageUrlDialog");
  const input = document.querySelector("#skuImageUrlInput");
  if (!resolved || !dialog || !input) return;
  skuImageUrlEditorTarget = target;
  input.value = resolved.sku.image.url || "";
  document.querySelector("#skuImageUrlEditorLabel").textContent = comboLabel(resolved.sku);
  if (!dialog.open) dialog.showModal();
  requestAnimationFrame(() => {
    if (!dialog.open) return;
    input.focus();
    input.select();
  });
}

function saveSkuImageUrlFromEditor() {
  const dialog = document.querySelector("#skuImageUrlDialog");
  const input = document.querySelector("#skuImageUrlInput");
  const resolved = resolveSkuImageTarget(skuImageUrlEditorTarget);
  if (!dialog || !input) return;
  if (!resolved) {
    dialog.close();
    return;
  }
  const asset = resolved.sku.image;
  updateSkuImageUrl(asset, input.value);
  scheduleSave();
  dialog.close();
  renderDynamic();
  showToast(asset.url ? "SKU 图片链接已更新" : "SKU 图片链接已清空");
}

function replaceSkuImage(target, nextAsset) {
  const resolved = resolveSkuImageTarget(target);
  if (!resolved) return false;
  const previousAsset = resolved.sku.image;
  resolved.sku.image = nextAsset;
  releaseUnusedAssetResources(previousAsset, workbench, localFiles);
  scheduleSave();
  renderDynamic();
  return true;
}

function clearSkuImage(target) {
  const resolved = resolveSkuImageTarget(target);
  if (!resolved || !assetSource(resolved.sku.image)) return false;
  const previousAsset = resolved.sku.image;
  resolved.sku.image = normalizeAsset({});
  releaseUnusedAssetResources(previousAsset, workbench, localFiles);
  scheduleSave();
  renderDynamic();
  return true;
}

function sameImageSource(left, right) {
  return ["url", "localPreview", "studioPreviewUrl"].some((key) => left?.[key] && left[key] === right?.[key]);
}

function renderSkuCarouselPicker() {
  const resolved = resolveSkuImageTarget(skuCarouselPickerTarget);
  const grid = document.querySelector("#skuCarouselPickerGrid");
  if (!resolved) {
    grid.innerHTML = `<div class="sku-carousel-picker-empty"><i data-lucide="image-off"></i><span>目标 SKU 已不存在</span></div>`;
    refreshIcons();
    return;
  }
  document.querySelector("#skuCarouselPickerLabel").textContent = comboLabel(resolved.sku);
  const candidates = draft.assets.carousel
    .map((asset, index) => ({ asset, index, source: assetSource(asset) }))
    .filter(({ source }) => source);
  grid.innerHTML = candidates.length
    ? candidates.map(({ asset, index, source }) => {
      const name = stripStudioImageSuffix(asset.name) || `轮播图 ${index + 1}`;
      const current = sameImageSource(resolved.sku.image, asset);
      const dimensions = asset.width && asset.height ? `${asset.width}×${asset.height}` : assetStateText(asset);
      return `
        <button class="sku-carousel-option ${current ? "is-current" : ""}" type="button" data-sku-carousel-index="${index}" aria-pressed="${current}" title="选择 ${escapeHtml(name)}">
          <span class="sku-carousel-option-image"><img src="${escapeHtml(source)}" alt="${escapeHtml(name)}" draggable="false">${current ? `<i data-lucide="check"></i>` : ""}</span>
          <span class="sku-carousel-option-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(dimensions)}</small></span>
        </button>
      `;
    }).join("")
    : `<div class="sku-carousel-picker-empty"><i data-lucide="image-off"></i><span>当前商品暂无轮播图</span></div>`;
  refreshIcons();
}

function openSkuCarouselPicker(target) {
  if (!resolveSkuImageTarget(target)) return;
  skuCarouselPickerTarget = target;
  renderSkuCarouselPicker();
  document.querySelector("#skuCarouselPickerDialog").showModal();
}

function assignSkuImageFromCarousel(carouselIndex) {
  const sourceAsset = draft.assets.carousel[carouselIndex];
  const target = skuCarouselPickerTarget;
  if (!sourceAsset || !resolveSkuImageTarget(target)) return;
  const nextAsset = createSkuImageFromCarousel(sourceAsset);
  const sourceFile = sourceAsset.id ? localFiles.get(sourceAsset.id) : null;
  if (sourceFile) localFiles.set(nextAsset.id, sourceFile);
  document.querySelector("#skuCarouselPickerDialog").close();
  skuCarouselPickerTarget = null;
  if (replaceSkuImage(target, nextAsset)) showToast(`SKU 图片已替换为轮播图 ${carouselIndex + 1}`);
}

function skuPreviewMarkup(sku, index) {
  const source = assetSource(sku.image);
  const label = escapeHtml(comboLabel(sku));
  if (!source) return `
    <div class="sku-image-slot is-empty" data-sku-image-context data-index="${index}">
      <button class="sku-image-add" type="button" data-open-sku-image-source data-index="${index}" title="选择轮播图或上传本地图片" aria-label="为 ${label} 选择 SKU 图，可选择轮播图或上传本地图片"><i data-lucide="plus"></i></button>
    </div>
  `;
  return `
    <div class="sku-image-slot" data-sku-image-context data-index="${index}">
      <button class="sku-table-thumb" type="button" data-lightbox-src="${escapeHtml(source)}" data-lightbox-alt="${label}" title="左键放大，右键快速修改" aria-label="放大查看 ${label} SKU 图"><img src="${escapeHtml(source)}" alt="${label} SKU 图" draggable="false"></button>
      <button class="sku-image-remove" type="button" data-remove-sku-image data-index="${index}" title="删除 SKU 图" aria-label="删除 ${label} SKU 图"><i data-lucide="trash-2"></i></button>
    </div>
  `;
}

function renderSkuTable() {
  renderSkuVariantAttributeHeaders();
  const body = document.querySelector("#skuTableBody");
  const firstName = draft.variants.name1 || VARIANT_ATTRIBUTE_OPTIONS[0];
  const secondName = draft.variants.name2 || "";
  body.innerHTML = draft.skus.length ? draft.skus.map((sku, index) => `
    <tr>
      <td data-label="SKU 图">${skuPreviewMarkup(sku, index)}</td>
      <td data-label="${escapeHtml(firstName)}">${skuVariantValueMarkup(sku, index, "variant1Value", firstName)}</td>
      <td data-label="${escapeHtml(secondName || "变种")}">${secondName
        ? skuVariantValueMarkup(sku, index, "variant2Value", secondName)
        : `<span class="sku-variant-empty">—</span>`}</td>
      <td data-label="SKU 货号"><input aria-label="${escapeHtml(comboLabel(sku))} SKU 货号" data-sku-index="${index}" data-sku-field="skuCode" value="${escapeHtml(sku.skuCode)}"></td>
      <td data-label="申报价"><input aria-label="${escapeHtml(comboLabel(sku))} 申报价" type="number" min="0" step="0.01" data-sku-index="${index}" data-sku-field="declaredPrice" value="${escapeHtml(sku.declaredPrice)}"></td>
      <td data-label="尺寸（cm）"><div class="dimension-inputs">
        <input aria-label="${escapeHtml(comboLabel(sku))} 长 cm" title="长 cm" placeholder="长" type="number" min="0" step="0.01" data-sku-index="${index}" data-sku-field="length" value="${escapeHtml(sku.length)}">
        <input aria-label="${escapeHtml(comboLabel(sku))} 宽 cm" title="宽 cm" placeholder="宽" type="number" min="0" step="0.01" data-sku-index="${index}" data-sku-field="width" value="${escapeHtml(sku.width)}">
        <input aria-label="${escapeHtml(comboLabel(sku))} 高 cm" title="高 cm" placeholder="高" type="number" min="0" step="0.01" data-sku-index="${index}" data-sku-field="height" value="${escapeHtml(sku.height)}">
      </div></td>
      <td data-label="重量（g）"><input aria-label="${escapeHtml(comboLabel(sku))} 重量 g" type="number" min="0" step="0.01" data-sku-index="${index}" data-sku-field="weight" value="${escapeHtml(sku.weight)}"></td>
      <td data-label="库存"><input aria-label="${escapeHtml(comboLabel(sku))} 库存" type="number" min="0" step="1" data-sku-index="${index}" data-sku-field="inventory" value="${escapeHtml(sku.inventory)}"></td>
    </tr>
  `).join("") : `<tr><td colspan="8">尚未生成 SKU</td></tr>`;
}

function assetSource(asset) {
  if (inspectPublicUrl(asset?.url).valid) return asset.url;
  if (asset?.localPreview) return asset.localPreview;
  if (String(asset?.studioPreviewUrl || "").startsWith(`${TEMU_STUDIO_IMAGE_PATH}?`)) return asset.studioPreviewUrl;
  return "";
}

function exportImageSource(asset) {
  if (String(asset?.localPreview || "").startsWith("blob:")) return asset.localPreview;
  if (String(asset?.studioPreviewUrl || "").startsWith(`${TEMU_STUDIO_IMAGE_PATH}?`)) return asset.studioPreviewUrl;
  return "";
}

function exportImageEntries(targetDraft = draft) {
  return allImageEntries(targetDraft).filter(({ asset }) => exportImageSource(asset));
}

function allImageEntries(targetDraft = draft) {
  return [
    ...targetDraft.assets.carousel.map((asset, index) => ({ path: `assets.carousel.${index}`, asset, label: `轮播图 ${index + 1}` })),
    ...targetDraft.assets.packaging.map((asset, index) => ({ path: `assets.packaging.${index}`, asset, label: `外包装图 ${index + 1}` })),
    ...targetDraft.skus.map((sku, index) => ({ path: `skus.${index}.image`, asset: sku.image, label: `SKU ${index + 1} 图片` })),
  ];
}

function rememberKnownUploadedImages() {
  const assets = [];
  workbench.items.forEach((item) => {
    allImageEntries(item.draft).forEach(({ asset }) => {
      assets.push(asset);
    });
  });
  publicImageUploads.replaceSeed(assets);
}

function assetStateText(asset) {
  if (asset?.status === "uploading") return "上传中";
  if (asset?.status === "verified" || asset?.status === "uploaded") return `${asset.width || "?"}×${asset.height || "?"}`;
  if (asset?.status === "error") return asset.error || "检查失败";
  if (asset?.status === "local") return asset.studioPreviewUrl ? "Studio 本地" : "仅本地";
  if (asset?.url) return "待检查";
  return "未设置";
}

function assetCard(asset, collection, index) {
  const source = assetSource(asset);
  const name = stripStudioImageSuffix(asset.name) || `图片 ${index + 1}`;
  const stateClass = asset.status === "error" ? "is-error" : ["local", "uploading", "pending"].includes(asset.status) ? "is-pending" : "";
  const carouselAttributes = collection === "carousel"
    ? ` draggable="true" data-carousel-index="${index}" role="listitem" title="拖动调整顺序" aria-label="第 ${index + 1} 张轮播图，可拖动调整顺序"`
    : "";
  return `
    <article class="asset-card ${stateClass}"${carouselAttributes}>
      ${source ? `<button class="asset-preview-button" type="button" data-lightbox-src="${escapeHtml(source)}" data-lightbox-alt="${escapeHtml(name)}" title="放大查看" aria-label="放大查看 ${escapeHtml(name)}"><img src="${escapeHtml(source)}" alt="${escapeHtml(name)}" draggable="false"></button>` : `<div class="asset-placeholder"><i data-lucide="image"></i></div>`}
      <button class="asset-remove" type="button" data-remove-asset="${collection}" data-index="${index}" title="移除图片" aria-label="移除图片"><i data-lucide="x"></i></button>
      <div class="asset-meta"><strong>${escapeHtml(name)}</strong><span>${escapeHtml(assetStateText(asset))}</span></div>
    </article>
  `;
}

function carouselAddCard() {
  return `
    <div class="carousel-add-card" data-carousel-add-dropzone role="listitem">
      <button class="carousel-add-button" type="button" data-open-carousel-add aria-label="添加轮播图，可从原轮播图选择、本地上传或拖入本地图片">
        <i data-lucide="plus"></i>
        <strong>添加轮播图</strong>
        <small>选择原图或拖入本地图片</small>
      </button>
    </div>
  `;
}

function renderAssetGrid(collection, elementId) {
  const assets = draft.assets[collection];
  const target = document.querySelector(`#${elementId}`);
  const cards = assets.map((asset, index) => assetCard(asset, collection, index));
  if (collection === "carousel" && assets.length < STUDIO_CAROUSEL_LIMIT) cards.push(carouselAddCard());
  target.innerHTML = cards.length
    ? cards.join("")
    : `<div class="empty-assets"><i data-lucide="image-off"></i><span>暂无图片</span></div>`;
}

function activeCarouselAddTarget() {
  if (!carouselAddState.productId || carouselAddState.productId !== activeProductItem().id) return null;
  return activeProductItem();
}

function carouselAddSessionIsCurrent(targetItem, targetDraft, operationToken) {
  return operationToken === carouselAddOperationToken
    && activeCarouselAddTarget() === targetItem
    && targetItem.draft === targetDraft
    && draft === targetDraft;
}

function invalidateCarouselAddSource(message) {
  carouselAddState.selectedStudioItemIds.clear();
  carouselAddState.set = null;
  carouselAddState.error = message;
}

function carouselAddCandidateId(image) {
  return String(image?.itemId ?? "").trim();
}

function pruneCarouselAddSelection(candidates, remaining) {
  const availableIds = new Set(candidates.map(carouselAddCandidateId).filter(Boolean));
  for (const itemId of carouselAddState.selectedStudioItemIds) {
    if (!availableIds.has(itemId)) carouselAddState.selectedStudioItemIds.delete(itemId);
  }
  while (carouselAddState.selectedStudioItemIds.size > remaining) {
    const selectedIds = [...carouselAddState.selectedStudioItemIds];
    carouselAddState.selectedStudioItemIds.delete(selectedIds[selectedIds.length - 1]);
  }
}

function renderCarouselAddDialog() {
  const dialog = document.querySelector("#carouselAddDialog");
  const grid = document.querySelector("#carouselAddGrid");
  if (!dialog?.open || !grid) return;
  const targetItem = activeCarouselAddTarget();
  const remaining = Math.max(0, STUDIO_CAROUSEL_LIMIT - (targetItem?.draft.assets.carousel.length || 0));
  const localUploadPending = Boolean(targetItem && assetCollectionPending.has(`${targetItem.id}:carousel`));
  const uploadButton = document.querySelector("#carouselAddUploadButton");
  const retryButton = document.querySelector("#carouselAddRetryButton");
  const confirmButton = document.querySelector("#carouselAddConfirmButton");
  const selectionCountElement = document.querySelector("#carouselAddSelectionCount");
  const candidates = targetItem && !carouselAddState.loading && !carouselAddState.error
    ? remainingStudioCarouselImages(carouselAddState.set, targetItem.draft.assets.carousel)
    : [];
  if (targetItem && !carouselAddState.loading && !carouselAddState.error) {
    pruneCarouselAddSelection(candidates, remaining);
  }
  const selectionCount = carouselAddState.selectedStudioItemIds.size;
  document.querySelector("#carouselAddRemaining").textContent = `还可添加 ${remaining} 张`;
  uploadButton.disabled = !targetItem || !remaining || carouselAddState.adding || localUploadPending;
  retryButton.hidden = !carouselAddState.error;
  retryButton.disabled = carouselAddState.loading || carouselAddState.adding;
  confirmButton.disabled = !targetItem || !remaining || !selectionCount || carouselAddState.loading || carouselAddState.adding || Boolean(carouselAddState.error) || localUploadPending;
  confirmButton.setAttribute("aria-label", selectionCount ? `确认添加 ${selectionCount} 张轮播图` : "确认添加轮播图");
  if (selectionCountElement) selectionCountElement.textContent = String(selectionCount);

  if (!targetItem) {
    carouselAddState.selectedStudioItemIds.clear();
    if (selectionCountElement) selectionCountElement.textContent = "0";
    confirmButton.disabled = true;
    confirmButton.setAttribute("aria-label", "确认添加轮播图");
    grid.innerHTML = `<div class="carousel-add-empty is-error"><i data-lucide="triangle-alert"></i><span>当前商品已切换，请关闭后重新打开</span></div>`;
    document.querySelector("#carouselAddSourceCount").textContent = "";
  } else if (carouselAddState.loading) {
    grid.innerHTML = `<div class="carousel-add-empty"><i data-lucide="loader-circle"></i><span>正在读取原轮播图</span></div>`;
    document.querySelector("#carouselAddSourceCount").textContent = "正在读取";
  } else if (carouselAddState.error) {
    grid.innerHTML = `<div class="carousel-add-empty is-error"><i data-lucide="wifi-off"></i><strong>原轮播图暂不可用</strong><span>${escapeHtml(carouselAddState.error)}</span></div>`;
    document.querySelector("#carouselAddSourceCount").textContent = "读取失败";
  } else {
    if (selectionCountElement) selectionCountElement.textContent = String(selectionCount);
    confirmButton.disabled = !targetItem || !remaining || !selectionCount || carouselAddState.loading || carouselAddState.adding || Boolean(carouselAddState.error) || localUploadPending;
    confirmButton.setAttribute("aria-label", selectionCount ? `确认添加 ${selectionCount} 张轮播图` : "确认添加轮播图");
    document.querySelector("#carouselAddSourceCount").textContent = carouselAddState.set
      ? `${candidates.length} 张可选，已选 ${selectionCount} 张`
      : "无 Studio 来源";
    grid.innerHTML = candidates.length
      ? candidates.map((image, index) => {
        const name = image.displayName || stripStudioImageSuffix(image.name) || `原轮播图 ${index + 1}`;
        const dimensions = image.width && image.height ? `${image.width}×${image.height}` : "Studio 原图";
        const itemId = carouselAddCandidateId(image);
        const selected = carouselAddState.selectedStudioItemIds.has(itemId);
        const disabled = !remaining || carouselAddState.adding || localUploadPending;
        const actionText = selected ? `取消选择 ${name}` : `选择 ${name}`;
        return `
          <button class="carousel-add-option ${selected ? "is-selected" : ""}" type="button" data-carousel-add-studio-item="${escapeHtml(itemId)}" title="${escapeHtml(actionText)}" aria-label="${escapeHtml(actionText)}" aria-pressed="${selected ? "true" : "false"}" ${disabled ? "disabled" : ""}>
            <span class="carousel-add-option-image"><img src="${escapeHtml(image.previewUrl)}" alt="${escapeHtml(name)}" loading="lazy" draggable="false"><i data-lucide="${selected ? "check" : "plus"}"></i></span>
            <span class="carousel-add-option-copy"><strong>${escapeHtml(name)}</strong><small>${escapeHtml(dimensions)}</small></span>
          </button>
        `;
      }).join("")
      : `<div class="carousel-add-empty"><i data-lucide="images"></i><strong>没有可补选的原轮播图</strong><span>仍可选择或拖入本地图片</span></div>`;
  }
  const sourceSection = document.querySelector(".carousel-add-source");
  if (sourceSection) sourceSection.setAttribute("aria-busy", String(carouselAddState.loading || carouselAddState.adding || localUploadPending));
  refreshIcons();
}

async function readCarouselAddStudioSet() {
  const targetItem = activeCarouselAddTarget();
  const loadToken = ++carouselAddLoadToken;
  const setId = targetItem?.draft.studioImport?.setId || "";
  carouselAddState.set = setId ? studioSets.find((set) => set.setId === setId) || null : null;
  carouselAddState.error = "";
  if (!setId || carouselAddState.set) {
    renderCarouselAddDialog();
    return;
  }

  carouselAddState.loading = true;
  renderCarouselAddDialog();
  try {
    const response = await fetch(API_STUDIO_SETS, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok || !Array.isArray(payload.sets)) {
      throw new Error(payload.error || `Studio 读取失败（HTTP ${response.status}）`);
    }
    if (loadToken !== carouselAddLoadToken || activeCarouselAddTarget() !== targetItem) return;
    studioSets = payload.sets;
    carouselAddState.set = studioSets.find((set) => set.setId === setId) || null;
    if (!carouselAddState.set) throw new Error("对应的 Studio 创作记录已不存在");
  } catch (error) {
    if (loadToken !== carouselAddLoadToken || activeCarouselAddTarget() !== targetItem) return;
    carouselAddState.error = error.message || "Studio 原图读取失败";
  } finally {
    if (loadToken !== carouselAddLoadToken || activeCarouselAddTarget() !== targetItem) return;
    carouselAddState.loading = false;
    renderCarouselAddDialog();
  }
}

function openCarouselAddDialog() {
  if (draft.assets.carousel.length >= STUDIO_CAROUSEL_LIMIT || exportPending || studioImportPending) return;
  carouselAddLoadToken += 1;
  carouselAddState.productId = activeProductItem().id;
  carouselAddState.set = null;
  carouselAddState.loading = false;
  carouselAddState.adding = false;
  carouselAddState.error = "";
  carouselAddState.selectedStudioItemIds.clear();
  carouselAddOperationToken += 1;
  const dialog = document.querySelector("#carouselAddDialog");
  if (!dialog.open) dialog.showModal();
  renderCarouselAddDialog();
  readCarouselAddStudioSet();
}

function openCarouselAddFilePicker() {
  const targetItem = activeCarouselAddTarget();
  if (!targetItem || carouselAddState.adding || assetCollectionPending.has(`${targetItem.id}:carousel`)) return;
  const input = document.querySelector("#carouselAddFiles");
  input.value = "";
  input.click();
}

function addStudioCarouselCandidate(itemId) {
  const targetItem = activeCarouselAddTarget();
  const normalizedId = String(itemId ?? "").trim();
  const image = carouselAddState.set?.carouselImages?.find((candidate) => carouselAddCandidateId(candidate) === normalizedId);
  if (!targetItem || !image || carouselAddState.loading || carouselAddState.adding || assetCollectionPending.has(`${targetItem.id}:carousel`)) return;

  const remaining = Math.max(0, STUDIO_CAROUSEL_LIMIT - targetItem.draft.assets.carousel.length);
  const candidates = remainingStudioCarouselImages(carouselAddState.set, targetItem.draft.assets.carousel);
  if (!candidates.some((candidate) => carouselAddCandidateId(candidate) === normalizedId)) {
    carouselAddState.selectedStudioItemIds.delete(normalizedId);
    showToast("这张原轮播图已经加入或已失效", "error");
    renderCarouselAddDialog();
    return;
  }
  if (carouselAddState.selectedStudioItemIds.has(normalizedId)) {
    carouselAddState.selectedStudioItemIds.delete(normalizedId);
    renderCarouselAddDialog();
    return;
  }
  if (carouselAddState.selectedStudioItemIds.size >= remaining) {
    showToast(`最多还能选择 ${remaining} 张轮播图`, "error");
    return;
  }
  carouselAddState.selectedStudioItemIds.add(normalizedId);
  renderCarouselAddDialog();
}

async function createStudioCarouselAsset(targetDraft, image, setId) {
  const asset = createStudioAsset(setId, image);
  let failed = false;
  try {
    const file = await studioImageFile(asset.studioPreviewUrl, asset.name);
    const localPreview = URL.createObjectURL(file);
    asset.localPreview = localPreview;
    localFiles.set(asset.id, file);
    asset.status = "local";
    asset.error = "";
    if (targetDraft.settings.cloudName && targetDraft.settings.uploadPreset) {
      asset.status = "uploading";
      try {
        const outcome = await uploadImageOnce(file, targetDraft.settings);
        const uploaded = outcome.asset;
        localFiles.delete(asset.id);
        Object.assign(asset, uploaded, { localPreview: "", error: "" });
        URL.revokeObjectURL(localPreview);
      } catch (error) {
        failed = true;
        asset.status = "error";
        asset.error = error.message || "图片上传失败";
      }
    }
  } catch (error) {
    failed = true;
    asset.status = "error";
    asset.error = error.message || "Studio 图片读取失败";
  }
  return { asset, failed };
}

async function confirmStudioCarouselCandidates() {
  const targetItem = activeCarouselAddTarget();
  const selectedIds = [...carouselAddState.selectedStudioItemIds];
  if (!targetItem || !selectedIds.length || carouselAddState.loading || carouselAddState.adding) return;
  if (assetCollectionPending.has(`${targetItem.id}:carousel`)) {
    showToast("本地图片正在添加，请稍候", "error");
    return;
  }

  const targetDraft = targetItem.draft;
  const setId = String(carouselAddState.set?.setId || "").trim();
  if (!setId || setId !== String(targetDraft.studioImport?.setId || "").trim()) {
    invalidateCarouselAddSource("Studio 原图来源已变化，请重新读取");
    renderCarouselAddDialog();
    showToast("Studio 原图来源已变化，请重新读取", "error");
    return;
  }
  const operationToken = ++carouselAddOperationToken;
  carouselAddState.adding = true;
  renderCarouselAddDialog();
  let added = 0;
  let failed = 0;
  let skipped = 0;
  const failureMessages = [];

  try {
    for (const [index, itemId] of selectedIds.entries()) {
      const stillTarget = carouselAddSessionIsCurrent(targetItem, targetDraft, operationToken);
      if (!stillTarget || targetDraft.assets.carousel.length >= STUDIO_CAROUSEL_LIMIT
        || String(carouselAddState.set?.setId || "").trim() !== setId) {
        if (targetItem.draft !== targetDraft || draft !== targetDraft) {
          invalidateCarouselAddSource("当前商品草稿已变化，请重新读取原轮播图");
        }
        skipped += selectedIds.length - index;
        break;
      }
      const image = carouselAddState.set?.carouselImages?.find((candidate) => carouselAddCandidateId(candidate) === itemId);
      const availableCandidates = remainingStudioCarouselImages(carouselAddState.set, targetDraft.assets.carousel);
      if (!image || !availableCandidates.some((candidate) => carouselAddCandidateId(candidate) === itemId)) {
        carouselAddState.selectedStudioItemIds.delete(itemId);
        skipped += 1;
        continue;
      }

      const { asset, failed: assetFailed } = await createStudioCarouselAsset(targetDraft, image, setId);
      const canCommit = carouselAddSessionIsCurrent(targetItem, targetDraft, operationToken)
        && String(carouselAddState.set?.setId || "").trim() === setId
        && targetDraft.assets.carousel.length < STUDIO_CAROUSEL_LIMIT
        && remainingStudioCarouselImages(carouselAddState.set, targetDraft.assets.carousel)
          .some((candidate) => carouselAddCandidateId(candidate) === itemId);
      if (!canCommit) {
        releaseUnusedAssetResources(asset, workbench, localFiles);
        if (targetItem.draft !== targetDraft || draft !== targetDraft) {
          invalidateCarouselAddSource("当前商品草稿已变化，请重新读取原轮播图");
        }
        skipped += selectedIds.length - index;
        break;
      }
      if (assetFailed) {
        releaseUnusedAssetResources(asset, workbench, localFiles);
        failed += 1;
        const name = image.displayName || stripStudioImageSuffix(image.name) || "原轮播图";
        failureMessages.push(`${name}：${asset.error || "图片读取失败"}`);
        continue;
      }

      targetDraft.assets.carousel.push(asset);
      carouselAddState.selectedStudioItemIds.delete(itemId);
      draft = targetDraft;
      added += 1;
      scheduleSave();
      renderDynamic();
    }
  } finally {
    if (operationToken !== carouselAddOperationToken) return;
    carouselAddState.adding = false;
    const pendingSelection = carouselAddState.selectedStudioItemIds.size;
    if (added && !failed && !skipped && !pendingSelection) {
      carouselAddState.selectedStudioItemIds.clear();
      document.querySelector("#carouselAddDialog")?.close();
      showToast(`已从原轮播图添加 ${added} 张`);
      return;
    }
    renderCarouselAddDialog();
    if (failed || skipped) {
      const details = [
        added ? `成功 ${added} 张` : "",
        failed ? `失败 ${failed} 张` : "",
        skipped ? `跳过 ${skipped} 张` : "",
      ].filter(Boolean).join("，");
      const failureDetail = failureMessages.length ? `（${failureMessages.join("；")}）` : "";
      showToast(`批量添加完成：${details}${failureDetail}，请检查候选状态`, "error");
    }
  }
}

function carouselCardFromTarget(target) {
  return target?.closest?.("#carouselGrid [data-carousel-index]") || null;
}

function clearCarouselDragState() {
  document.querySelectorAll("#carouselGrid [data-carousel-index]").forEach((card) => {
    card.classList.remove("is-dragging", "is-drag-over");
    card.removeAttribute("aria-grabbed");
  });
  carouselDragState = null;
}

function carouselAddDropzoneFromTarget(target) {
  return target?.closest?.("[data-carousel-add-dropzone]") || null;
}

function clearCarouselAddDragState() {
  document.querySelector("[data-carousel-add-dropzone]")?.classList.remove("is-drag-over");
}

function hasFileTransfer(event) {
  const transfer = event.dataTransfer;
  return Boolean(transfer?.files?.length || [...(transfer?.types || [])].includes("Files"));
}

function handleCarouselAddDragOver(event) {
  const dropzone = carouselAddDropzoneFromTarget(event.target);
  if (!dropzone || exportPending || studioImportPending || draft.assets.carousel.length >= STUDIO_CAROUSEL_LIMIT) return;
  if (carouselDragState) {
    event.preventDefault();
    if (event.dataTransfer) event.dataTransfer.dropEffect = "none";
    return;
  }
  event.preventDefault();
  dropzone.classList.toggle("is-drag-over", hasFileTransfer(event));
  if (event.dataTransfer) event.dataTransfer.dropEffect = hasFileTransfer(event) ? "copy" : "none";
}

function handleCarouselAddDragLeave(event) {
  const dropzone = carouselAddDropzoneFromTarget(event.target);
  if (!dropzone || (event.relatedTarget && dropzone.contains(event.relatedTarget))) return;
  clearCarouselAddDragState();
}

function handleCarouselAddDragEnd() {
  clearCarouselAddDragState();
}

function handleCarouselAddDrop(event) {
  const dropzone = carouselAddDropzoneFromTarget(event.target);
  if (!dropzone) return;
  if (carouselDragState) {
    event.preventDefault();
    clearCarouselDragState();
    clearCarouselAddDragState();
    return;
  }
  event.preventDefault();
  clearCarouselAddDragState();
  if (!hasFileTransfer(event) || !event.dataTransfer?.files?.length) {
    showToast("请拖入本地图片文件", "error");
    return;
  }
  const files = [...event.dataTransfer.files];
  if (exportPending || studioImportPending) {
    showToast("当前操作完成后再添加图片", "error");
    return;
  }
  if (draft.assets.carousel.length >= STUDIO_CAROUSEL_LIMIT) {
    showToast("轮播图已达到 10 张上限", "error");
    return;
  }
  const imageFiles = files.filter(isImageFile);
  if (!imageFiles.length) {
    showToast("请拖入图片文件", "error");
    return;
  }
  if (imageFiles.length < files.length) showToast("已忽略非图片文件", "error");
  addFilesToCollection("carousel", imageFiles);
}

function handleCarouselDragStart(event) {
  const card = carouselCardFromTarget(event.target);
  if (!card || event.target.closest("button") || exportPending || studioImportPending) {
    event.preventDefault();
    return;
  }
  const sourceIndex = Number(card.dataset.carouselIndex);
  const sourceAsset = draft.assets.carousel[sourceIndex];
  if (!sourceAsset) {
    event.preventDefault();
    return;
  }
  carouselDragState = { asset: sourceAsset, card };
  card.classList.add("is-dragging");
  card.setAttribute("aria-grabbed", "true");
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = "move";
    event.dataTransfer.setData("text/plain", String(sourceIndex));
  }
}

function handleCarouselDragOver(event) {
  if (carouselAddDropzoneFromTarget(event.target)) {
    handleCarouselAddDragOver(event);
    return;
  }
  const card = carouselCardFromTarget(event.target);
  if (!carouselDragState || !card || exportPending || studioImportPending) return;
  event.preventDefault();
  if (event.dataTransfer) event.dataTransfer.dropEffect = "move";
  document.querySelectorAll("#carouselGrid [data-carousel-index].is-drag-over").forEach((candidate) => {
    if (candidate !== card) candidate.classList.remove("is-drag-over");
  });
  card.classList.add("is-drag-over");
}

function handleCarouselDragLeave(event) {
  if (carouselAddDropzoneFromTarget(event.target)) {
    handleCarouselAddDragLeave(event);
    return;
  }
  const card = carouselCardFromTarget(event.target);
  if (!card || (event.relatedTarget && card.contains(event.relatedTarget))) return;
  card.classList.remove("is-drag-over");
}

function handleCarouselDrop(event) {
  if (carouselAddDropzoneFromTarget(event.target)) {
    handleCarouselAddDrop(event);
    return;
  }
  const card = carouselCardFromTarget(event.target);
  if (!carouselDragState || !card || exportPending || studioImportPending) return;
  event.preventDefault();
  const fromIndex = draft.assets.carousel.indexOf(carouselDragState.asset);
  const toIndex = Number(card.dataset.carouselIndex);
  const nextDraft = reorderCarouselAsset(draft, fromIndex, toIndex);
  clearCarouselDragState();
  if (nextDraft === draft) return;
  draft = nextDraft;
  scheduleSave();
  renderDynamic();
}

function handleCarouselDragEnd() {
  clearCarouselDragState();
  clearCarouselAddDragState();
}

function renderImages() {
  renderAssetGrid("carousel", "carouselGrid");
  renderAssetGrid("packaging", "packagingGrid");
  renderProductMaterial();
  const carouselReady = draft.assets.carousel.length;
  const packagingReady = draft.assets.packaging.length;
  document.querySelector("#carouselCount").textContent = `${carouselReady} / 10`;
  document.querySelector("#packagingCount").textContent = `${packagingReady} / 6`;
  const configured = Boolean(draft.settings.cloudName && draft.settings.uploadPreset);
  const pendingUploads = exportImageEntries().filter(({ asset }) => !asset.url).length;
  const hasStudioLocal = pendingUploads > 0;
  const chip = document.querySelector("#uploadModeChip");
  chip.textContent = configured && pendingUploads
    ? `待上传 ${pendingUploads} 张`
    : configured ? "公网图片已就绪" : hasStudioLocal ? "需要配置 Cloudinary" : "手工 URL";
  chip.classList.toggle("is-ready", configured && pendingUploads === 0);
  chip.classList.toggle("is-local", !configured && hasStudioLocal);
}

function firstCarouselPreviewMarkup(emptyText) {
  const asset = draft.assets.carousel[0];
  const source = assetSource(asset);
  const name = stripStudioImageSuffix(asset?.name) || "第一张轮播图";
  return source
    ? `<button class="derived-image-button" type="button" data-lightbox-src="${escapeHtml(source)}" data-lightbox-alt="${escapeHtml(name)}" title="放大查看" aria-label="放大查看第一张轮播图"><img src="${escapeHtml(source)}" alt="${escapeHtml(name)}" draggable="false"></button>`
    : `<div class="description-image-empty"><i data-lucide="image-off"></i><span>${escapeHtml(emptyText)}</span></div>`;
}

function renderProductMaterial() {
  document.querySelector("#productMaterialImage").innerHTML = firstCarouselPreviewMarkup("添加轮播图后自动显示");
}

function renderDescription() {
  const target = document.querySelector("#descriptionMainImage");
  target.innerHTML = firstCarouselPreviewMarkup("添加轮播图后自动显示");
  document.querySelector("#descriptionCount").textContent = `${String(draft.product.description || "").length} / 500`;
}

function renderValidation() {
  renderApplyShippingToAllButton();
  const validationOptions = { freightTemplates: currentFreightTemplates() };
  const result = validateDraft(draft, validationOptions);
  const selectedItems = selectedProductItems(workbench);
  const invalidSelectedItems = selectedItems.filter((item) => !validateDraft(item.draft, validationOptions).valid);
  const skuImageReady = draft.skus.filter((sku) => assetSource(sku.image) && sku.image.width > 800 && sku.image.width === sku.image.height).length;
  const carouselReady = draft.assets.carousel.filter((asset) => assetSource(asset)).length;
  const imageCount = draft.assets.carousel.length + draft.assets.packaging.length
    + draft.skus.reduce((sum, sku) => sum + Number(Boolean(assetSource(sku.image))), 0);

  document.querySelector("#navSkuCount").textContent = draft.skus.length;
  document.querySelector("#navImageCount").textContent = imageCount;
  document.querySelector("#skuMetric").textContent = draft.skus.length;
  document.querySelector("#carouselMetric").textContent = carouselReady;
  document.querySelector("#skuImageMetric").textContent = `${skuImageReady} / ${draft.skus.length}`;
  document.querySelector("#errorCount").textContent = result.errors.length;
  document.querySelector("#warningCount").textContent = result.warnings.length;
  document.querySelector("#errorList").innerHTML = result.errors.length
    ? result.errors.slice(0, 12).map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")
    : `<li class="empty">没有阻塞项</li>`;
  document.querySelector("#warningList").innerHTML = result.warnings.length
    ? result.warnings.slice(0, 8).map((issue) => `<li>${escapeHtml(issue.message)}</li>`).join("")
    : `<li class="empty">没有提醒</li>`;

  const badge = document.querySelector("#validationBadge");
  badge.textContent = result.valid && templateReady ? "可以导出" : `${result.errors.length} 项未完成`;
  badge.classList.toggle("is-ready", result.valid && templateReady);
  const exportButton = document.querySelector("#exportButton");
  const batchReady = selectedItems.length > 0 && invalidSelectedItems.length === 0;
  exportButton.disabled = !batchReady || !templateReady || exportPending;
  exportButton.title = !selectedItems.length
    ? "请先勾选要导出的商品"
    : invalidSelectedItems.length
      ? `已勾选 ${selectedItems.length} 个商品，其中 ${invalidSelectedItems.length} 个尚未完成`
      : `导出已勾选的 ${selectedItems.length} 个商品`;
  exportButton.setAttribute("aria-label", exportButton.title);
  renderProductList();
  return result;
}

function renderDynamic() {
  closeSkuImageContextMenu();
  closeSkuImageSourceMenu();
  renderFreightTemplateOptions();
  renderFreightTemplateRecords();
  renderApplyShippingToAllButton();
  renderSkuTable();
  renderImages();
  renderDescription();
  renderValidation();
  renderImportedEstimateNotice();
  syncSensitiveInputs();
  refreshIcons();
}

function setActiveNavigation(view) {
  document.querySelectorAll("[data-view-button]").forEach((link) => {
    const isActive = link.dataset.viewButton === view;
    link.classList.toggle("is-active", isActive);
    if (isActive) link.setAttribute("aria-current", "location");
    else link.removeAttribute("aria-current");
  });
}

function navigationOffset() {
  return Number.parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--workbench-anchor-offset")) || 88;
}

function syncActiveNavigation() {
  navigationFrame = null;
  const offset = navigationOffset();
  let activeSection = viewSections[0];
  for (const section of viewSections) {
    if (section.getBoundingClientRect().top <= offset + 1) activeSection = section;
  }
  if (activeSection) setActiveNavigation(activeSection.dataset.view);
}

function queueNavigationSync() {
  if (navigationFrame !== null) return;
  navigationFrame = requestAnimationFrame(syncActiveNavigation);
}

function scrollToView(view) {
  const section = viewSections.find((item) => item.dataset.view === view);
  if (!section) return;
  setActiveNavigation(view);
  section.scrollIntoView({ behavior: "smooth", block: "start" });
  history.replaceState(null, "", `#${section.id}`);
}

function setupViewNavigation() {
  window.addEventListener("scroll", queueNavigationSync, { passive: true });
  window.addEventListener("resize", queueNavigationSync);
  const hashSection = viewSections.find((section) => `#${section.id}` === location.hash);
  setActiveNavigation((hashSection ?? viewSections[0])?.dataset.view);
  queueNavigationSync();
}

async function fileMetadata(file) {
  const bitmap = await createImageBitmap(file);
  const metadata = { width: bitmap.width, height: bitmap.height, bytes: file.size, format: file.type.replace("image/", "") };
  bitmap.close();
  return metadata;
}

async function uploadToCloudinary(file, settings = draft.settings) {
  const cloudName = settings.cloudName.trim();
  const uploadPreset = settings.uploadPreset.trim();
  if (!cloudName || !uploadPreset) return null;
  if (!/^[A-Za-z0-9_-]+$/.test(cloudName)) throw new Error("Cloud name 格式无效");
  const form = new FormData();
  form.append("file", file);
  form.append("upload_preset", uploadPreset);
  const response = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(cloudName)}/image/upload`, { method: "POST", body: form });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.secure_url) throw new Error(payload.error?.message || `Cloudinary 返回 HTTP ${response.status}`);
  return {
    url: payload.secure_url,
    width: payload.width,
    height: payload.height,
    bytes: payload.bytes,
    format: payload.format,
    status: "uploaded",
  };
}

async function uploadImageOnce(file, settings = draft.settings, contentHash = "") {
  return publicImageUploads.upload(file, {
    cloudName: settings.cloudName,
    contentHash,
    upload: (blob) => uploadToCloudinary(blob, settings),
  });
}

async function createAssetFromFile(file, role, settings = draft.settings) {
  const metadata = await fileMetadata(file);
  const asset = {
    id: crypto.randomUUID(),
    name: file.name,
    url: "",
    ...metadata,
    status: "local",
    error: "",
    localPreview: URL.createObjectURL(file),
  };
  localFiles.set(asset.id, file);
  if (role === "image" && (asset.width <= 800 || asset.height <= 800 || asset.width !== asset.height)) {
    asset.status = "error";
    asset.error = "SKU 图必须为大于 800×800 的正方形";
    return asset;
  }
  if (!settings.cloudName || !settings.uploadPreset) return asset;
  asset.status = "uploading";
  renderDynamic();
  try {
    const outcome = await uploadImageOnce(file, settings);
    Object.assign(asset, outcome.asset);
  } catch (error) {
    asset.status = "error";
    asset.error = error.message;
  }
  return asset;
}

function isImageFile(file) {
  return Boolean(file?.type?.startsWith("image/"));
}

async function addFilesToCollection(collection, files) {
  const limit = collection === "carousel" ? 10 : 6;
  const targetItem = activeProductItem();
  const targetDraft = draft;
  const pendingKey = `${targetItem.id}:${collection}`;
  if (assetCollectionPending.has(pendingKey) || (collection === "carousel" && carouselAddState.adding)) {
    showToast("图片正在添加，请稍候", "error");
    return;
  }
  const available = limit - targetDraft.assets[collection].length;
  if (available <= 0) return showToast(`${collection === "carousel" ? "轮播图" : "外包装图片"}已达到上限`, "error");
  const selectedFiles = [...files];
  const imageFiles = selectedFiles.filter(isImageFile);
  if (!imageFiles.length) return showToast("请选择图片文件", "error");
  if (imageFiles.length < selectedFiles.length) showToast("已忽略非图片文件", "error");
  assetCollectionPending.add(pendingKey);
  renderCarouselAddDialog();
  try {
    for (const file of imageFiles.slice(0, available)) {
      try {
        const asset = await createAssetFromFile(file, collection, targetDraft.settings);
        const stillActive = activeProductItem() === targetItem && draft === targetDraft;
        if (!stillActive || targetDraft.assets[collection].length >= limit) {
          releaseUnusedAssetResources(asset, workbench, localFiles);
          showToast("商品或图片容量已变化，剩余图片未添加", "error");
          break;
        }
        targetDraft.assets[collection].push(asset);
        renderDynamic();
      } catch (error) {
        showToast(`${file.name}：${error.message}`, "error");
      }
    }
    scheduleSave();
  } finally {
    assetCollectionPending.delete(pendingKey);
    renderCarouselAddDialog();
  }
}

async function verifyAssetUrl(url) {
  const inspection = inspectPublicUrl(url);
  if (!inspection.valid) throw new Error(inspection.error);
  const response = await fetch(API_ASSETS_VERIFY, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ url: inspection.url }),
  });
  const payload = await response.json();
  if (!response.ok || !payload.ok) throw new Error(payload.error || "图片检查失败");
  return { ...payload.asset, status: "verified", error: "" };
}

async function addManualAsset(collection, input) {
  const url = input.value.trim();
  if (!url) return;
  const asset = { ...normalizeAsset({ url, name: `公网图片 ${draft.assets[collection].length + 1}` }), status: "pending" };
  draft.assets[collection].push(asset);
  input.value = "";
  renderDynamic();
  try {
    Object.assign(asset, await verifyAssetUrl(url));
  } catch (error) {
    asset.status = "error";
    asset.error = error.message;
    showToast(error.message, "error");
  }
  scheduleSave();
  renderDynamic();
}

async function assignSkuFile(target, file) {
  try {
    const asset = await createAssetFromFile(file, "image");
    if (!replaceSkuImage(target, asset)) {
      releaseUnusedAssetResources(asset, workbench, localFiles);
      return;
    }
    showToast("SKU 图片已从本地替换");
  } catch (error) {
    showToast(error.message, "error");
  }
}

async function checkHealth() {
  const metric = document.querySelector("#templateMetric");
  const version = document.querySelector("#appVersion");
  try {
    const response = await fetch(API_HEALTH, { cache: "no-store" });
    const payload = await response.json();
    const validVersion = typeof payload.version === "string"
      && /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(payload.version);
    version.textContent = validVersion ? `v${payload.version}` : "v--";
    version.setAttribute("aria-label", validVersion ? `应用版本 ${payload.version}` : "应用版本未知");
    templateReady = Boolean(payload.ok);
    metric.textContent = templateReady ? "兼容" : "不兼容";
    metric.title = payload.template?.message || "";
  } catch {
    version.textContent = "v--";
    version.setAttribute("aria-label", "应用版本未知");
    templateReady = false;
    metric.textContent = "服务离线";
  }
  renderValidation();
}

function formatStudioDate(value) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) return "时间未知";
  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function studioStateLabel(value) {
  if (value === "completed") return "已完成";
  if (value === "failed") return "失败";
  if (value === "generating" || value === "running") return "生成中";
  return value || "未知";
}

function selectedStudioSet() {
  return studioSets.find((set) => set.setId === selectedStudioSetId) || null;
}

function studioCarouselSelection(set) {
  if (!set?.setId) return [];
  const validIds = new Set((set.carouselImages || []).map((image) => image.itemId));
  if (!studioCarouselSelections.has(set.setId)) {
    studioCarouselSelections.set(set.setId, defaultStudioCarouselItemIds(set));
  } else {
    studioCarouselSelections.set(
      set.setId,
      studioCarouselSelections.get(set.setId).filter((itemId) => validIds.has(itemId)).slice(0, STUDIO_CAROUSEL_LIMIT),
    );
  }
  return studioCarouselSelections.get(set.setId);
}

function studioSkuSubjectSelection(set) {
  if (!set?.setId) return [];
  const validKeys = new Set(defaultStudioSkuSubjectKeys(set));
  if (!studioSkuSubjectSelections.has(set.setId)) {
    studioSkuSubjectSelections.set(set.setId, [...validKeys]);
  } else {
    studioSkuSubjectSelections.set(
      set.setId,
      studioSkuSubjectSelections.get(set.setId).filter((key) => validKeys.has(key)),
    );
  }
  return studioSkuSubjectSelections.get(set.setId);
}

function clearCurrentStudioImageSelection({ carouselOnly = false } = {}) {
  const set = selectedStudioSet();
  if (!set?.setId || studioLoading || studioImportPending) return;
  studioCarouselSelections.set(set.setId, []);
  if (!carouselOnly) studioSkuSubjectSelections.set(set.setId, []);
  renderStudioDialog();
}

function studioRecordHasListing(set) {
  const listing = set?.listing || {};
  return [listing.status, listing.englishTitle, listing.chineseTitle, listing.englishDescription, listing.chineseDescription]
    .some((value) => String(value ?? "").trim());
}

function filteredStudioSets() {
  return studioSets.filter((set) => {
    const hasListing = studioRecordHasListing(set);
    const hasEstimate = Boolean(normalizeStudioLogisticsEstimate(set.logisticsEstimate));
    if (studioRecordFilters.listing === "present" && !hasListing) return false;
    if (studioRecordFilters.listing === "missing" && hasListing) return false;
    if (studioRecordFilters.estimate === "present" && !hasEstimate) return false;
    if (studioRecordFilters.estimate === "missing" && hasEstimate) return false;
    return true;
  });
}

function studioEstimateText(estimate) {
  const source = estimate.source === "package" ? "包装预估" : "产品预估";
  return `${source}：${estimate.lengthCm} × ${estimate.widthCm} × ${estimate.heightCm} cm / ${estimate.weightG} g`;
}

function renderImportedEstimateNotice() {
  const notice = document.querySelector("#studioEstimateNotice");
  const text = document.querySelector("#studioEstimateNoticeText");
  if (!notice || !text) return;
  const estimate = normalizeStudioLogisticsEstimate(draft.studioImport?.logisticsEstimate);
  notice.hidden = !estimate;
  text.textContent = estimate
    ? `本草稿曾从 Studio 填入${studioEstimateText(estimate)}，请按实物复核商品与 SKU。`
    : "";
}

function studioEstimateSelection(set) {
  if (!set?.setId) return false;
  if (!studioEstimateSelections.has(set.setId)) studioEstimateSelections.set(set.setId, true);
  return studioEstimateSelections.get(set.setId) !== false;
}

function renderStudioEstimateOption(set) {
  const option = document.querySelector("#studioEstimateOption");
  const value = document.querySelector("#studioEstimateValue");
  const hint = document.querySelector("#studioEstimateHint");
  const toggle = document.querySelector("#studioEstimateToggle");
  if (!option || !value || !hint || !toggle) return;
  const estimate = normalizeStudioLogisticsEstimate(set?.logisticsEstimate);
  option.classList.toggle("is-unavailable", !estimate);
  value.textContent = estimate ? studioEstimateText(estimate) : set ? "无预估" : "选择记录后显示预估值";
  hint.textContent = estimate
    ? "仅填入当前记录的商品和全部新 SKU，导出前请按实物复核"
    : set ? "Studio 没有提供此商品的结构化尺寸重量" : "仅根记录中的完整结构化值可自动填入";
  toggle.disabled = !estimate || studioLoading || studioImportPending;
  toggle.checked = Boolean(estimate && studioEstimateSelection(set));
}

function renderStudioDialog() {
  const status = document.querySelector("#studioConnectionStatus");
  const statusText = document.querySelector("#studioConnectionText");
  const list = document.querySelector("#studioRecordList");
  const selection = document.querySelector("#studioSelection");
  const confirm = document.querySelector("#studioConfirmButton");
  const refresh = document.querySelector("#studioRefreshButton");
  const selectAll = document.querySelector("#studioSelectAllRecords");
  const clearSelection = document.querySelector("#studioClearSelection");
  const selectedCount = document.querySelector("#studioSelectedCount");
  const listingFilter = document.querySelector("#studioListingFilter");
  const estimateFilter = document.querySelector("#studioEstimateFilter");
  const launch = document.querySelector("#studioImportButton");
  const closeButtons = document.querySelectorAll("[data-studio-dialog-close]");
  if (!status || !list || !selection || !confirm || !refresh || !selectAll || !clearSelection || !selectedCount || !listingFilter || !estimateFilter) return;
  const visibleSets = filteredStudioSets();

  if (launch) launch.disabled = studioImportPending;
  closeButtons.forEach((button) => { button.disabled = studioImportPending; });

  status.classList.toggle("is-loading", studioLoading);
  status.classList.toggle("is-error", Boolean(studioLoadError));
  status.classList.toggle("is-ready", !studioLoading && !studioLoadError && studioSets.length > 0);
  statusText.textContent = studioLoading
    ? "正在读取套图记录"
    : studioLoadError
      ? studioLoadError
      : `找到 ${studioSets.length} 条创作记录`;
  refresh.disabled = studioLoading || studioImportPending;
  listingFilter.value = studioRecordFilters.listing;
  estimateFilter.value = studioRecordFilters.estimate;
  listingFilter.disabled = studioLoading || studioImportPending;
  estimateFilter.disabled = studioLoading || studioImportPending;
  selectAll.checked = visibleSets.length > 0 && visibleSets.every((set) => selectedStudioSetIds.has(set.setId));
  selectAll.indeterminate = visibleSets.some((set) => selectedStudioSetIds.has(set.setId)) && !selectAll.checked;
  selectAll.disabled = studioLoading || studioImportPending || visibleSets.length === 0;
  clearSelection.disabled = studioLoading || studioImportPending || selectedStudioSetIds.size === 0;
  selectedCount.textContent = `已选 ${selectedStudioSetIds.size} / ${studioSets.length}`;

  if (studioLoading) {
    list.innerHTML = `<div class="studio-empty"><i data-lucide="loader-circle"></i><span>正在读取创作记录</span></div>`;
  } else if (studioLoadError) {
    list.innerHTML = `<div class="studio-empty is-error"><i data-lucide="wifi-off"></i><strong>套图记录读取失败</strong><span>${escapeHtml(studioLoadError)}</span></div>`;
  } else if (!studioSets.length) {
    list.innerHTML = `<div class="studio-empty"><i data-lucide="inbox"></i><span>暂无可导入记录</span></div>`;
  } else if (!visibleSets.length) {
    list.innerHTML = `<div class="studio-empty"><i data-lucide="search-x"></i><span>没有匹配的创作记录</span></div>`;
  } else {
    list.innerHTML = visibleSets.map((set) => {
      const active = set.setId === selectedStudioSetId;
      const checked = selectedStudioSetIds.has(set.setId);
      const title = set.productName || set.listing?.chineseTitle || "未命名记录";
      const thumbnail = set.carouselImages?.[0]?.previewUrl || set.skuSubjects?.find((subject) => subject.image)?.image?.previewUrl || "";
      const estimate = normalizeStudioLogisticsEstimate(set.logisticsEstimate);
      return `
        <div class="studio-record-row ${active ? "is-active" : ""}" role="listitem">
          <label class="studio-record-check" title="${checked ? "取消导入" : "加入导入"}">
            <input type="checkbox" data-studio-import-select="${escapeHtml(set.setId)}" aria-label="选择导入 ${escapeHtml(title)}" ${checked ? "checked" : ""} ${studioImportPending ? "disabled" : ""}>
          </label>
          <button class="studio-record" type="button" data-studio-set-id="${escapeHtml(set.setId)}" aria-current="${active ? "true" : "false"}" ${studioImportPending ? "disabled" : ""}>
            <span class="studio-record-thumb">${thumbnail ? `<img src="${escapeHtml(thumbnail)}" alt="" loading="lazy">` : `<i data-lucide="image-off"></i>`}</span>
            <span class="studio-record-copy">
              <strong>${escapeHtml(title)}</strong>
              <small class="studio-record-meta"><span>${escapeHtml(formatStudioDate(set.updatedAt))} · ${set.skuSubjects?.length || 0} SKU · ${set.availableImageCount || 0} 图</span><b class="studio-record-estimate ${estimate ? "is-available" : ""}">${estimate ? "有预估" : "无预估"}</b></small>
            </span>
            <i data-lucide="chevron-right"></i>
          </button>
        </div>
      `;
    }).join("");
  }

  const set = selectedStudioSet();
  if (!set) {
    selection.innerHTML = `<div class="studio-selection-empty"><i data-lucide="mouse-pointer-2"></i><span>选择一条创作记录</span></div>`;
  } else {
    const images = set.carouselImages || [];
    const selectedCarouselIds = studioCarouselSelection(set);
    const selectedOrder = new Map(selectedCarouselIds.map((itemId, index) => [itemId, index + 1]));
    const skuSubjects = studioSkuSubjectEntries(set);
    const selectedSkuSubjectKeys = studioSkuSubjectSelection(set);
    const selectedSkuSubjectKeySet = new Set(selectedSkuSubjectKeys);
    const clearImagesDisabled = studioLoading || studioImportPending || (selectedCarouselIds.length === 0 && selectedSkuSubjectKeys.length === 0);
    const clearCarouselDisabled = studioLoading || studioImportPending || selectedCarouselIds.length === 0;
    selection.innerHTML = `
      <div class="studio-selection-heading">
        <div class="studio-selection-title"><span class="eyebrow">${selectedStudioSetIds.has(set.setId) ? "已勾选导入" : "仅预览"}</span><h3>${escapeHtml(set.productName || "未命名记录")}</h3></div>
        <div class="studio-estimate-option" id="studioEstimateOption">
          <i data-lucide="ruler"></i>
          <div><strong id="studioEstimateValue">选择记录后显示预估值</strong><span id="studioEstimateHint">仅完整的厘米和克数值可自动填入</span></div>
          <label class="switch-field" title="填入 Studio 预估尺寸和重量"><input id="studioEstimateToggle" type="checkbox" checked disabled><span>填入预估值</span></label>
        </div>
        <div class="studio-selection-actions">
          <button class="secondary-button studio-selection-action" type="button" data-studio-clear-current-images title="清除当前页全部图片选择" aria-label="清除当前页全部图片选择" ${clearImagesDisabled ? "disabled" : ""}><i data-lucide="image-off"></i><span>清空图片</span></button>
          <button class="secondary-button studio-selection-action" type="button" data-studio-clear-current-carousel title="清除当前页轮播图选择" aria-label="清除当前页轮播图选择" ${clearCarouselDisabled ? "disabled" : ""}><i data-lucide="x"></i><span>清空轮播</span></button>
          <span class="status-chip ${set.status === "completed" ? "is-ready" : ""}">${escapeHtml(studioStateLabel(set.status))}</span>
        </div>
      </div>
      <p class="studio-listing-title">${escapeHtml(set.listing?.englishTitle || "无英文 Listing 标题")}</p>
      <dl class="studio-metrics">
        <div><dt>Listing</dt><dd>${escapeHtml(studioStateLabel(set.listing?.status))}</dd></div>
        <div><dt>颜色 SKU</dt><dd>${skuSubjects.length}</dd></div>
        <div><dt>轮播图</dt><dd>${selectedCarouselIds.length} / ${STUDIO_CAROUSEL_LIMIT}<small>${images.length} 张候选</small></dd></div>
        <div><dt>SKU 图</dt><dd>${selectedSkuSubjectKeys.length} / ${skuSubjects.length}</dd></div>
      </dl>
      <div class="studio-preview-grid">
        ${images.length ? images.map((image, index) => {
          const order = selectedOrder.get(image.itemId);
          const selected = Boolean(order);
          const name = image.displayName || stripStudioImageSuffix(image.name) || "轮播图";
          const label = `图 ${index + 1}`;
          return `
            <figure class="studio-preview-item ${selected ? "is-selected" : ""}">
              <button class="studio-preview-zoom" type="button" data-lightbox-src="${escapeHtml(image.previewUrl)}" data-lightbox-alt="${escapeHtml(name)}" title="放大查看" aria-label="放大查看 ${escapeHtml(name)}"><img src="${escapeHtml(image.previewUrl)}" alt="${escapeHtml(name)}" loading="lazy" draggable="false"></button>
              <button class="studio-preview-select ${selected ? "is-selected" : ""}" type="button" data-studio-carousel-id="${escapeHtml(image.itemId)}" aria-pressed="${selected}" title="${selected ? "取消选择" : "选择轮播图"}" aria-label="${selected ? `取消选择 ${escapeHtml(name)}` : `选择 ${escapeHtml(name)}`}" ${studioImportPending ? "disabled" : ""}>${selected ? `<span>${order}</span><i data-lucide="check"></i>` : `<i data-lucide="plus"></i>`}</button>
              <figcaption title="${escapeHtml(name)}">${escapeHtml(label)}</figcaption>
            </figure>
          `;
        }).join("") : `<span class="studio-preview-empty">没有已完成轮播图</span>`}
      </div>
      <section class="studio-sku-selection" aria-label="选择要导入的 SKU 图">
        <div class="studio-sku-selection-heading"><h4>SKU 图</h4><span>已选 ${selectedSkuSubjectKeys.length} / ${skuSubjects.length}</span></div>
        <div class="studio-sku-grid">
          ${skuSubjects.length ? skuSubjects.map((subject, index) => {
            const selected = selectedSkuSubjectKeySet.has(subject.selectionKey);
            const name = stripStudioImageSuffix(subject.title) || "未命名 SKU";
            const image = subject.image;
            const imageName = image?.displayName || stripStudioImageSuffix(image?.name) || name;
            const label = `SKU ${index + 1}`;
            return `
              <article class="studio-sku-item ${selected ? "is-selected" : ""}">
                ${image?.previewUrl
                  ? `<button class="studio-sku-zoom" type="button" data-lightbox-src="${escapeHtml(image.previewUrl)}" data-lightbox-alt="${escapeHtml(imageName)}" title="放大查看" aria-label="放大查看 ${escapeHtml(imageName)}"><img src="${escapeHtml(image.previewUrl)}" alt="${escapeHtml(imageName)}" loading="lazy" draggable="false"></button>`
                  : `<div class="studio-sku-placeholder"><i data-lucide="image-off"></i></div>`}
                <button class="studio-sku-select ${selected ? "is-selected" : ""}" type="button" data-studio-sku-subject-key="${escapeHtml(subject.selectionKey)}" aria-pressed="${selected}" title="${selected ? "取消映射" : "映射 SKU 图"}" aria-label="${selected ? `取消映射 ${escapeHtml(name)}` : `映射 ${escapeHtml(name)}`}" ${studioImportPending ? "disabled" : ""}><i data-lucide="${selected ? "check" : "plus"}"></i></button>
                <span title="${escapeHtml(name)}">${escapeHtml(label)}</span>
              </article>
            `;
          }).join("") : `<span class="studio-sku-empty">没有可映射的 SKU 图</span>`}
        </div>
      </section>
    `;
  }

  renderStudioEstimateOption(set);
  confirm.disabled = selectedStudioSetIds.size === 0 || studioLoading || studioImportPending;
  confirm.querySelector("span").textContent = studioImportPending ? "正在导入" : `导入 ${selectedStudioSetIds.size} 个商品`;
  refreshIcons();
}

async function loadStudioSets() {
  if (studioImportPending) return;
  studioLoading = true;
  studioLoadError = "";
  renderStudioDialog();
  try {
    const response = await fetch(API_STUDIO_SETS, { cache: "no-store" });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload.ok || !Array.isArray(payload.sets)) {
      throw new Error(payload.error || `Studio 读取失败（HTTP ${response.status}）`);
    }
    studioSets = payload.sets;
    const availableSetIds = new Set(studioSets.map((set) => set.setId));
    for (const setId of studioCarouselSelections.keys()) {
      if (!availableSetIds.has(setId)) studioCarouselSelections.delete(setId);
    }
    for (const setId of studioSkuSubjectSelections.keys()) {
      if (!availableSetIds.has(setId)) studioSkuSubjectSelections.delete(setId);
    }
    for (const setId of studioEstimateSelections.keys()) {
      if (!availableSetIds.has(setId)) studioEstimateSelections.delete(setId);
    }
    for (const setId of selectedStudioSetIds) {
      if (!availableSetIds.has(setId)) selectedStudioSetIds.delete(setId);
    }
    if (!studioSets.some((set) => set.setId === selectedStudioSetId)) {
      selectedStudioSetId = studioSets[0]?.setId || "";
    }
    if (!selectedStudioSetIds.size && selectedStudioSetId) selectedStudioSetIds.add(selectedStudioSetId);
  } catch (error) {
    studioSets = [];
    selectedStudioSetId = "";
    selectedStudioSetIds.clear();
    studioLoadError = error.message || "套图记录读取失败";
  } finally {
    studioLoading = false;
    renderStudioDialog();
  }
}

function setStudioProgress(done, total, message) {
  const progress = document.querySelector("#studioImportProgress");
  const text = document.querySelector("#studioImportProgressText");
  const fill = document.querySelector("#studioImportProgressFill");
  progress.hidden = total === 0;
  text.textContent = message;
  fill.style.width = total ? `${Math.round((done / total) * 100)}%` : "0%";
}

async function studioImageFile(previewUrl, filename) {
  const response = await fetch(previewUrl, { cache: "no-store" });
  if (!response.ok) {
    const payload = await response.json().catch(() => ({}));
    throw new Error(payload.error || `Studio 图片读取失败（HTTP ${response.status}）`);
  }
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error("Studio 图片响应类型无效");
  return new File([await response.blob()], filename || "studio-image.png", { type: contentType });
}

async function readExportImageBlob(entry) {
  const localFile = localFiles.get(entry.asset?.id);
  if (localFile) return localFile;
  const source = exportImageSource(entry.asset);
  if (!source) throw new Error("原图来源已经失效，请重新选择图片");
  const response = await fetch(source, { cache: "no-store" });
  if (!response.ok) throw new Error(`读取失败（HTTP ${response.status}）`);
  const blob = await response.blob();
  if (!blob.type.startsWith("image/")) throw new Error("来源不是有效图片");
  if (blob.size > EXPORT_SOURCE_MAX_BYTES) throw new Error("原图超过 25 MB");
  return blob;
}

async function ensurePublicImageUrls(targetItem, onProgress = () => {}, sourceReads = new Map()) {
  const targetDraft = targetItem.draft;
  const entries = exportImageEntries(targetDraft);
  const pendingEntries = entries.filter(({ asset }) => !asset.url);
  if (!pendingEntries.length) return { assetCount: 0, uploadCount: 0 };
  if (!targetDraft.settings.cloudName || !targetDraft.settings.uploadPreset) {
    throw new Error("请先配置 Cloudinary Cloud name 和 Unsigned upload preset");
  }
  const persistTargetState = () => {
    targetItem.updatedAt = new Date().toISOString();
    saveDraftNow();
    if (targetItem.id === workbench.activeId) renderDynamic();
    else renderProductList();
  };
  try {
    const result = await uploadMissingPublicImages(pendingEntries, {
      readBlob: readExportImageBlob,
      uploadOnce: async (blob, entry, contentHash) => {
        const filename = entry.asset?.name || `${entry.path.replaceAll(".", "-")}.jpg`;
        const file = blob instanceof File ? blob : new File([blob], filename, { type: blob.type || "image/jpeg" });
        return uploadImageOnce(file, targetDraft.settings, contentHash);
      },
      findUploaded: (contentHash) => publicImageUploads.find(targetDraft.settings.cloudName, contentHash),
      sourceKey: ({ asset }) => exportImageSource(asset),
      sourceReads,
      onProgress,
      onStateChange: persistTargetState,
    });
    saveDraftNow();
    return result;
  } catch (error) {
    persistTargetState();
    throw error;
  }
}

async function uploadStudioAssets(candidate, progressPrefix = "") {
  const groups = groupStudioAssetsForUpload(candidate);
  const canUpload = Boolean(candidate.settings?.cloudName?.trim() && candidate.settings?.uploadPreset?.trim());
  let failures = 0;
  for (let index = 0; index < groups.length; index += 1) {
    const { previewUrl, assets } = groups[index];
    setStudioProgress(index, groups.length, `${progressPrefix ? `${progressPrefix} · ` : ""}正在读取图片 ${index + 1} / ${groups.length}`);
    try {
      const file = await studioImageFile(previewUrl, assets[0]?.name);
      const localPreview = URL.createObjectURL(file);
      assets.forEach((asset) => {
        asset.localPreview = localPreview;
        localFiles.set(asset.id, file);
        asset.status = "local";
        asset.error = "";
      });
      if (canUpload) {
        setStudioProgress(index, groups.length, `${progressPrefix ? `${progressPrefix} · ` : ""}正在上传图片 ${index + 1} / ${groups.length}`);
        assets.forEach((asset) => {
          asset.status = "uploading";
        });
        const outcome = await uploadImageOnce(file, candidate.settings);
        const uploaded = outcome.asset;
        assets.forEach((asset) => {
          localFiles.delete(asset.id);
          Object.assign(asset, uploaded, { localPreview: "", error: "" });
        });
        URL.revokeObjectURL(localPreview);
      }
    } catch (error) {
      failures += 1;
      assets.forEach((asset) => Object.assign(asset, { status: "error", error: error.message || "图片读取或上传失败" }));
    }
    setStudioProgress(index + 1, groups.length, `${progressPrefix ? `${progressPrefix} · ` : ""}已处理图片 ${index + 1} / ${groups.length}`);
  }
  return failures;
}

function releaseReplacedLocalAssets(currentDraft) {
  const previews = new Set();
  const release = (asset) => {
    if (asset?.localPreview) previews.add(asset.localPreview);
    if (asset?.id) localFiles.delete(asset.id);
  };
  currentDraft.assets.carousel.forEach(release);
  currentDraft.assets.packaging.forEach(release);
  currentDraft.skus.forEach((sku) => {
    release(sku.image);
  });
  previews.forEach((preview) => URL.revokeObjectURL(preview));
}

async function importSelectedStudioSet() {
  const selectedSets = studioSets.filter((set) => selectedStudioSetIds.has(set.setId));
  if (!selectedSets.length || studioImportPending) return;
  studioImportPending = true;
  renderValidation();
  renderStudioDialog();
  setStudioProgress(0, 0, "");
  try {
    const baseDraft = normalizeDraft(draft);
    const candidates = selectedSets.map((set) => mergeStudioSetIntoDraft(baseDraft, set, {
      importEstimates: studioEstimateSelection(set),
      carouselItemIds: studioCarouselSelection(set),
      skuSubjectKeys: studioSkuSubjectSelection(set),
    }));
    let imageFailures = 0;
    for (let index = 0; index < candidates.length; index += 1) {
      imageFailures += await uploadStudioAssets(candidates[index], `商品 ${index + 1}/${candidates.length}`);
    }
    const importedAt = new Date().toISOString();
    workbench = appendProductItems(workbench, candidates, { selected: true, now: importedAt });
    saveDraftNow();
    syncBoundInputs();
    syncSensitiveInputs();
    renderDynamic();
    document.querySelector("#studioDialog").close();
    const estimateImported = candidates.some((candidate) => candidate.studioImport?.logisticsEstimate);
    showToast(imageFailures
      ? `已导入 ${candidates.length} 个商品，${imageFailures} 张图片未能读取或上传；已读取图片保留本地预览`
      : `已导入 ${candidates.length} 个商品${estimateImported ? "，并填入可用的预估尺寸重量" : ""}`, imageFailures ? "error" : "normal");
  } catch (error) {
    showToast(error.message || "Studio 导入失败", "error");
  } finally {
    studioImportPending = false;
    setStudioProgress(0, 0, "");
    renderValidation();
    renderStudioDialog();
  }
}

async function exportWorkbook() {
  renderValidation();
  const selectedItems = selectedProductItems(workbench);
  if (!selectedItems.length) {
    showToast("请先勾选要导出的商品", "error");
    return;
  }
  const firstInvalid = selectedItems
    .map((item, index) => ({ item, index, validation: validateDraft(item.draft, { freightTemplates: currentFreightTemplates() }) }))
    .find(({ validation }) => !validation.valid);
  if (firstInvalid) {
    const title = productDisplayTitle(firstInvalid.item, workbench.items.indexOf(firstInvalid.item));
    showToast(`商品 ${firstInvalid.index + 1}「${title}」：${firstInvalid.validation.errors[0]?.message || "存在阻塞项"}`, "error");
    return;
  }
  saveDraftNow();
  exportPending = true;
  const button = document.querySelector("#exportButton");
  renderValidation();
  button.querySelector("span").textContent = "正在导出";
  try {
    let uploadedCount = 0;
    const preparedDrafts = [];
    const preparedRevisions = new Map();
    const sourceReads = new Map();
    for (let index = 0; index < selectedItems.length; index += 1) {
      const item = selectedItems[index];
      const title = productDisplayTitle(item, workbench.items.indexOf(item));
      const uploaded = await ensurePublicImageUrls(item, (done, total) => {
        button.querySelector("span").textContent = total
          ? `商品 ${index + 1}/${selectedItems.length} · 图片 ${done}/${total}`
          : `准备商品 ${index + 1}/${selectedItems.length}`;
      }, sourceReads);
      uploadedCount += uploaded.uploadCount;
      const strictValidation = validateDraft(item.draft, {
        allowLocalSources: false,
        requirePublicImageUrls: true,
        freightTemplates: currentFreightTemplates(),
      });
      if (!strictValidation.valid) {
        throw new Error(`商品 ${index + 1}「${title}」：${strictValidation.errors[0]?.message || "图片公网 URL 尚未准备完成"}`);
      }
      preparedDrafts.push(exportableDraft(strictValidation.draft));
      preparedRevisions.set(item.id, item.updatedAt);
    }
    saveDraftNow();
    button.querySelector("span").textContent = "验证公网图片";
    const response = await fetch(API_EXPORT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ drafts: preparedDrafts }),
    });
    if (!response.ok) {
      const payload = await response.json().catch(() => ({}));
      const details = Array.isArray(payload.errors)
        ? payload.errors.slice(0, 2).map((issue) => issue.message).filter(Boolean).join("；")
        : "";
      throw new Error(details || payload.error || `导出失败（HTTP ${response.status}）`);
    }
    const blob = await response.blob();
    const disposition = response.headers.get("content-disposition") || "";
    const match = disposition.match(/filename="([^"]+)"/i);
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = match?.[1] || "temu-import.xlsx";
    anchor.click();
    setTimeout(() => URL.revokeObjectURL(anchor.href), 1000);
    const exportedIds = selectedItems
      .filter((item) => item.updatedAt === preparedRevisions.get(item.id))
      .map((item) => item.id);
    workbench = markProductsExported(workbench, exportedIds);
    draft = activeProductItem().draft;
    saveDraftNow();
    const sizeMb = (blob.size / 1_000_000).toFixed(2);
    const editedDuringExport = selectedItems.length - exportedIds.length;
    showToast(editedDuringExport
      ? `已导出 ${selectedItems.length} 个商品；${editedDuringExport} 个在导出期间有新修改，仍需重新导出`
      : `已导出 ${selectedItems.length} 个商品（${sizeMb} MB，新增上传 ${uploadedCount} 张）`);
  } catch (error) {
    showToast(error.message, "error");
  } finally {
    exportPending = false;
    button.querySelector("span").textContent = "导出 Excel";
    renderValidation();
  }
}

function handleBoundInput(element) {
  if (element.dataset.field) {
    let value = element.dataset.type === "boolean" ? element.checked : element.value;
    if (element.dataset.field === "product.description") {
      value = truncateProductDescription(value);
      if (element.value !== value) element.value = value;
    }
    setPath(draft, element.dataset.field, value);
    if (element.dataset.field === "product.description") renderDescription();
  } else if (element.dataset.arrayField) {
    setPath(draft, element.dataset.arrayField, splitLines(element.value));
  } else if (element.dataset.skuField) {
    draft.skus[Number(element.dataset.skuIndex)][element.dataset.skuField] = element.value;
  } else return false;
  scheduleSave();
  renderValidation();
  return true;
}

function startSkuVariantValueEdit(input) {
  if (!input.readOnly) return;
  input.dataset.originalValue = input.value;
  input.readOnly = false;
  input.focus();
  input.select();
}

function cancelSkuVariantValueEdit(input) {
  input.value = input.dataset.originalValue ?? input.value;
  delete input.dataset.originalValue;
  input.readOnly = true;
}

function commitSkuVariantValueEdit(input) {
  if (input.readOnly) return;
  const index = Number(input.dataset.skuIndex);
  const field = input.dataset.skuVariantValue;
  const current = draft.skus[index];
  input.readOnly = true;
  delete input.dataset.originalValue;
  if (!current || !["variant1Value", "variant2Value"].includes(field)) return;

  const value = input.value.trim();
  if (!value) {
    input.value = current[field] || "";
    showToast("变种值不能为空", "error");
    return;
  }
  if (value === current[field]) {
    input.value = value;
    return;
  }

  draft = updateSkuVariantValue(draft, index, field, value);
  input.value = value;
  scheduleSave();
  renderValidation();
}

function applySkuBulkInputs() {
  const inputs = [...document.querySelectorAll("[data-bulk-sku-field]")];
  const values = Object.fromEntries(inputs
    .map((input) => [input.dataset.bulkSkuField, input.value.trim()])
    .filter(([, value]) => value !== ""));
  if (!Object.keys(values).length) {
    showToast("请至少填写一个批量值", "error");
    return;
  }
  draft = applySkuBulkFields(draft, values);
  inputs.forEach((input) => { input.value = ""; });
  scheduleSave();
  renderDynamic();
  showToast(`已应用到 ${draft.skus.length} 个 SKU`);
}

function updateSkuVariantAttributeFromInput(input) {
  const field = input.dataset.variantAttributeName;
  draft = updateSkuVariantAttributeName(draft, field, input.value);
  scheduleSave();
  renderSkuTable();
  renderValidation();
}

function descriptionValueAfterInsert(element, insertedText) {
  const start = Number.isInteger(element.selectionStart) ? element.selectionStart : element.value.length;
  const end = Number.isInteger(element.selectionEnd) ? element.selectionEnd : start;
  return `${element.value.slice(0, start)}${insertedText}${element.value.slice(end)}`;
}

function commitDescriptionInput(element, value) {
  const normalized = truncateProductDescription(value);
  element.value = normalized;
  element.setSelectionRange?.(normalized.length, normalized.length);
  handleBoundInput(element);
}

document.addEventListener("beforeinput", (event) => {
  const element = event.target?.closest?.('[data-field="product.description"]');
  if (!element || !["insertText", "insertReplacementText"].includes(event.inputType) || typeof event.data !== "string") return;
  const nextValue = descriptionValueAfterInsert(element, event.data);
  if (nextValue.length <= 500) return;
  event.preventDefault();
  commitDescriptionInput(element, nextValue);
});
document.addEventListener("paste", (event) => {
  const element = event.target?.closest?.('[data-field="product.description"]');
  const pastedText = event.clipboardData?.getData("text/plain");
  if (!element || typeof pastedText !== "string") return;
  const nextValue = descriptionValueAfterInsert(element, pastedText);
  if (nextValue.length <= 500) return;
  event.preventDefault();
  commitDescriptionInput(element, nextValue);
});
document.addEventListener("input", (event) => {
  if (event.target.id !== "freightTemplateId") handleBoundInput(event.target);
});
document.addEventListener("dragstart", handleCarouselDragStart);
document.addEventListener("dragover", handleCarouselDragOver);
document.addEventListener("dragleave", handleCarouselDragLeave);
document.addEventListener("drop", handleCarouselDrop);
document.addEventListener("dragend", handleCarouselDragEnd);
document.addEventListener("dragend", handleCarouselAddDragEnd);
document.addEventListener("dblclick", (event) => {
  const input = event.target.closest("[data-sku-variant-value]");
  if (!input) return;
  event.preventDefault();
  startSkuVariantValueEdit(input);
});
document.addEventListener("focusout", (event) => {
  if (event.target.matches("[data-sku-variant-value]")) commitSkuVariantValueEdit(event.target);
});
document.addEventListener("keydown", (event) => {
  const variantInput = event.target.closest("[data-sku-variant-value]");
  if (variantInput) {
    if (event.key === "Escape" && !variantInput.readOnly) {
      event.preventDefault();
      cancelSkuVariantValueEdit(variantInput);
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (variantInput.readOnly) startSkuVariantValueEdit(variantInput);
      else variantInput.blur();
      return;
    }
  }
  if (event.key === "Escape" && !document.querySelector("#skuImageContextMenu").hidden) {
    event.preventDefault();
    closeSkuImageContextMenu();
    return;
  }
  if (event.key === "Escape" && !document.querySelector("#skuImageSourceMenu").hidden) {
    event.preventDefault();
    closeSkuImageSourceMenu();
    return;
  }
  if (!event.target.matches("[data-new-freight-template], [data-edit-freight-template]")) return;
  if (event.key === "Escape" && event.target.hasAttribute("data-new-freight-template")) {
    event.preventDefault();
    freightTemplateCreatePending = false;
    renderFreightTemplateRecords();
    refreshIcons();
    return;
  }
  if (event.key !== "Enter") return;
  event.preventDefault();
  saveFreightTemplateFromInput(event.target);
});
document.addEventListener("change", (event) => {
  if (event.target.matches("[data-variant-attribute-name]")) {
    updateSkuVariantAttributeFromInput(event.target);
    return;
  }
  if (event.target.id === "freightTemplateId") {
    handleBoundInput(event.target);
    renderDynamic();
  }
  if (event.target.matches("[data-field][data-type='boolean']")) handleBoundInput(event.target);
  if (event.target.matches("[data-product-select]")) {
    const item = workbench.items.find((candidate) => candidate.id === event.target.dataset.productSelect);
    if (item) {
      item.selected = event.target.checked;
      saveDraftNow();
      renderValidation();
    }
  }
  if (event.target.matches("[data-studio-import-select]")) {
    if (studioImportPending) {
      renderStudioDialog();
      return;
    }
    const setId = event.target.dataset.studioImportSelect;
    if (event.target.checked) selectedStudioSetIds.add(setId);
    else selectedStudioSetIds.delete(setId);
    selectedStudioSetId = setId;
    renderStudioDialog();
  }
  if (event.target.matches("[data-sensitive-value]")) {
    const value = event.target.dataset.sensitiveValue;
    draft.product.sensitiveValues = event.target.checked
      ? [...new Set([...draft.product.sensitiveValues, value])]
      : draft.product.sensitiveValues.filter((item) => item !== value);
    scheduleSave();
    renderValidation();
  }
});

document.addEventListener("click", (event) => {
  const skuImageSourceCommand = event.target.closest("[data-sku-image-source-command]");
  if (skuImageSourceCommand) {
    const target = skuImageSourceMenuTarget;
    closeSkuImageSourceMenu();
    if (skuImageSourceCommand.dataset.skuImageSourceCommand === "carousel") openSkuCarouselPicker(target);
    if (skuImageSourceCommand.dataset.skuImageSourceCommand === "upload") openSkuFilePicker(target);
    return;
  }
  const skuImageCommand = event.target.closest("[data-sku-image-command]");
  if (skuImageCommand) {
    const target = skuImageContextTarget;
    closeSkuImageContextMenu();
    if (skuImageCommand.dataset.skuImageCommand === "view-url") openSkuImageUrl(target);
    if (skuImageCommand.dataset.skuImageCommand === "edit-url") openSkuImageUrlEditor(target);
    if (skuImageCommand.dataset.skuImageCommand === "carousel") openSkuCarouselPicker(target);
    if (skuImageCommand.dataset.skuImageCommand === "upload") openSkuFilePicker(target);
    return;
  }
  if (!event.target.closest("#skuImageContextMenu")) closeSkuImageContextMenu();
  if (!event.target.closest("#skuImageSourceMenu")) closeSkuImageSourceMenu();

  const freightTemplateDelete = event.target.closest("[data-delete-freight-template]");
  if (freightTemplateDelete) {
    deleteFreightTemplateRecord(freightTemplateDelete.dataset.deleteFreightTemplate);
    return;
  }

  const productOpen = event.target.closest("[data-product-open]");
  if (productOpen) activateProduct(productOpen.dataset.productOpen);

  const openCarouselAdd = event.target.closest("[data-open-carousel-add]");
  if (openCarouselAdd) {
    openCarouselAddDialog();
    return;
  }

  const carouselAddOption = event.target.closest("[data-carousel-add-studio-item]");
  if (carouselAddOption) {
    addStudioCarouselCandidate(carouselAddOption.dataset.carouselAddStudioItem);
    return;
  }

  const lightboxTrigger = event.target.closest("[data-lightbox-src]");
  if (lightboxTrigger) {
    event.preventDefault();
    openImageLightbox(lightboxTrigger.dataset.lightboxSrc, lightboxTrigger.dataset.lightboxAlt || "图片预览");
  }

  const viewButton = event.target.closest("[data-view-button]");
  if (viewButton) {
    event.preventDefault();
    scrollToView(viewButton.dataset.viewButton);
  }

  const remove = event.target.closest("[data-remove-asset]");
  if (remove) {
    const collection = remove.dataset.removeAsset;
    const [asset] = draft.assets[collection].splice(Number(remove.dataset.index), 1);
    releaseUnusedAssetResources(asset, workbench, localFiles);
    scheduleSave();
    renderDynamic();
  }

  const openSkuSource = event.target.closest("[data-open-sku-image-source]");
  if (openSkuSource) {
    openSkuImageSourceMenu(Number(openSkuSource.dataset.index), openSkuSource);
    return;
  }

  const removeSkuImage = event.target.closest("[data-remove-sku-image]");
  if (removeSkuImage) {
    const target = skuImageTarget(Number(removeSkuImage.dataset.index));
    if (clearSkuImage(target)) showToast("SKU 图已删除");
    return;
  }

  const carouselOption = event.target.closest("[data-sku-carousel-index]");
  if (carouselOption) assignSkuImageFromCarousel(Number(carouselOption.dataset.skuCarouselIndex));

  const studioRecord = event.target.closest("[data-studio-set-id]");
  if (studioRecord) {
    if (studioImportPending) return;
    selectedStudioSetId = studioRecord.dataset.studioSetId;
    renderStudioDialog();
  }

  const studioCarouselToggle = event.target.closest("[data-studio-carousel-id]");
  if (studioCarouselToggle) {
    if (studioImportPending) return;
    const set = selectedStudioSet();
    if (!set?.carouselImages?.some((image) => image.itemId === studioCarouselToggle.dataset.studioCarouselId)) return;
    const result = toggleStudioCarouselSelection(
      studioCarouselSelection(set),
      studioCarouselToggle.dataset.studioCarouselId,
    );
    if (result.limitReached) {
      showToast(`轮播图最多选择 ${STUDIO_CAROUSEL_LIMIT} 张，请先取消一张`, "error");
    } else {
      studioCarouselSelections.set(set.setId, result.itemIds);
      renderStudioDialog();
    }
  }

  const studioClearCurrentImages = event.target.closest("[data-studio-clear-current-images]");
  if (studioClearCurrentImages) {
    clearCurrentStudioImageSelection();
    return;
  }

  const studioClearCurrentCarousel = event.target.closest("[data-studio-clear-current-carousel]");
  if (studioClearCurrentCarousel) {
    clearCurrentStudioImageSelection({ carouselOnly: true });
    return;
  }

  const studioSkuSubjectToggle = event.target.closest("[data-studio-sku-subject-key]");
  if (studioSkuSubjectToggle) {
    if (studioImportPending) return;
    const set = selectedStudioSet();
    if (!set) return;
    studioSkuSubjectSelections.set(
      set.setId,
      toggleStudioSkuSubjectSelection(
        studioSkuSubjectSelection(set),
        set,
        studioSkuSubjectToggle.dataset.studioSkuSubjectKey,
      ),
    );
    renderStudioDialog();
  }
});

document.addEventListener("contextmenu", (event) => {
  const trigger = event.target.closest("[data-sku-image-context]");
  if (!trigger) {
    closeSkuImageContextMenu();
    return;
  }
  event.preventDefault();
  openSkuImageContextMenu(Number(trigger.dataset.index), event.clientX, event.clientY, trigger);
});
window.addEventListener("scroll", closeSkuImageContextMenu, { passive: true, capture: true });
window.addEventListener("resize", closeSkuImageContextMenu);
window.addEventListener("scroll", closeSkuImageSourceMenu, { passive: true, capture: true });
window.addEventListener("resize", closeSkuImageSourceMenu);

document.querySelector("#applySkuBulkButton").addEventListener("click", applySkuBulkInputs);
document.querySelector("#applyShippingToAllButton").addEventListener("click", applyShippingToAllProducts);
document.querySelector("#addFreightTemplateButton").addEventListener("click", openFreightTemplateCreator);
document.querySelector("#addProductButton").addEventListener("click", addProduct);
document.querySelector("#resetCurrentProductButton").addEventListener("click", resetCurrentProduct);
document.querySelector("#deleteSelectedProductsButton").addEventListener("click", deleteSelectedProductItems);
document.querySelector("#productSearchInput").addEventListener("input", (event) => {
  productSearchQuery = event.currentTarget.value;
  renderProductList();
});
document.querySelector("#productStatusFilter").addEventListener("change", (event) => {
  productStatusFilter = event.currentTarget.value;
  renderProductList();
});
document.querySelector("#selectAllProducts").addEventListener("change", (event) => {
  workbench = applyProductSelection(workbench, event.currentTarget.checked ? "all" : "none");
  draft = activeProductItem().draft;
  saveDraftNow();
  renderValidation();
});
document.querySelector("#productSelectionPreset").addEventListener("change", (event) => {
  if (!event.currentTarget.value) return;
  workbench = applyProductSelection(workbench, event.currentTarget.value);
  draft = activeProductItem().draft;
  event.currentTarget.value = "";
  saveDraftNow();
  renderValidation();
});
document.querySelector("#originCountry").addEventListener("change", updateOriginFromInputs);
document.querySelector("#originProvince").addEventListener("change", updateOriginFromInputs);
document.querySelector("#pickCarouselButton").addEventListener("click", () => document.querySelector("#carouselFiles").click());
document.querySelector("#pickPackagingButton").addEventListener("click", () => document.querySelector("#packagingFiles").click());
document.querySelector("#carouselFiles").addEventListener("change", (event) => addFilesToCollection("carousel", event.target.files));
document.querySelector("#carouselAddFiles").addEventListener("change", (event) => addFilesToCollection("carousel", event.target.files));
document.querySelector("#carouselAddUploadButton").addEventListener("click", openCarouselAddFilePicker);
document.querySelector("#carouselAddRetryButton").addEventListener("click", readCarouselAddStudioSet);
document.querySelector("#carouselAddConfirmButton").addEventListener("click", confirmStudioCarouselCandidates);
document.querySelector("#carouselAddDialog").addEventListener("close", () => {
  carouselAddLoadToken += 1;
  carouselAddOperationToken += 1;
  carouselAddState.productId = "";
  carouselAddState.set = null;
  carouselAddState.loading = false;
  carouselAddState.adding = false;
  carouselAddState.error = "";
  carouselAddState.selectedStudioItemIds.clear();
});
document.querySelector("#packagingFiles").addEventListener("change", (event) => addFilesToCollection("packaging", event.target.files));
document.querySelector("#skuFileInput").addEventListener("change", (event) => {
  const target = { productId: event.target.dataset.productId, skuKey: event.target.dataset.skuKey, skuIndex: Number(event.target.dataset.skuIndex) };
  if (event.target.files[0]) assignSkuFile(target, event.target.files[0]);
});
document.querySelector("#addCarouselUrl").addEventListener("click", () => addManualAsset("carousel", document.querySelector("#carouselUrl")));
document.querySelector("#addPackagingUrl").addEventListener("click", () => addManualAsset("packaging", document.querySelector("#packagingUrl")));
document.querySelector("#validateButton").addEventListener("click", () => {
  const result = renderValidation();
  showToast(result.valid ? "校验通过" : `发现 ${result.errors.length} 个阻塞项`, result.valid ? "normal" : "error");
});
document.querySelector("#backupButton").addEventListener("click", exportWorkbenchBackup);
document.querySelector("#restoreButton").addEventListener("click", () => {
  saveDraftNow();
  const input = document.querySelector("#restoreBackupFile");
  input.value = "";
  input.click();
});
document.querySelector("#restoreBackupFile").addEventListener("change", (event) => {
  restoreWorkbenchBackupFile(event.currentTarget.files[0]);
});
document.querySelector("#exportButton").addEventListener("click", exportWorkbook);

const studioDialog = document.querySelector("#studioDialog");

// 「从 Studio 导入」的唯一入口：按钮点击不带预选，宿主的 init 消息带上已勾选的 setId。
// 预选在 loadStudioSets() 之前写入 selectedStudioSetIds，因为它只会剔除本次读不到的 setId，
// 剩下的原样保留；空集时它才会退回首条记录。
function openStudioImportDialog(preselectedSetIds = []) {
  if (studioImportPending) return;
  studioEstimateSelections.clear();
  studioSkuSubjectSelections.clear();
  selectedStudioSetIds.clear();
  studioRecordFilters.listing = "";
  studioRecordFilters.estimate = "";
  selectedStudioSetId = "";
  for (const setId of preselectedSetIds) {
    const text = String(setId ?? "").trim();
    if (!text) continue;
    selectedStudioSetIds.add(text);
    if (!selectedStudioSetId) selectedStudioSetId = text;
  }
  if (!studioDialog.open) studioDialog.showModal();
  loadStudioSets();
}

document.querySelector("#studioImportButton").addEventListener("click", () => {
  openStudioImportDialog();
});
studioDialog.addEventListener("cancel", (event) => {
  if (studioImportPending) event.preventDefault();
});
document.querySelector("#studioForm").addEventListener("submit", (event) => {
  if (studioImportPending) event.preventDefault();
});
document.querySelector("#studioRefreshButton").addEventListener("click", () => {
  if (studioImportPending) return;
  loadStudioSets();
});
document.querySelector("#studioConfirmButton").addEventListener("click", importSelectedStudioSet);
document.querySelector("#studioSelectAllRecords").addEventListener("change", (event) => {
  if (studioImportPending) {
    renderStudioDialog();
    return;
  }
  const visibleSets = filteredStudioSets();
  visibleSets.forEach((set) => {
    if (event.currentTarget.checked) selectedStudioSetIds.add(set.setId);
    else selectedStudioSetIds.delete(set.setId);
  });
  renderStudioDialog();
});
document.querySelector("#studioClearSelection").addEventListener("click", () => {
  if (studioImportPending) return;
  selectedStudioSetIds.clear();
  renderStudioDialog();
});
document.addEventListener("change", (event) => {
  const toggle = event.target.closest?.("#studioEstimateToggle");
  if (!toggle) return;
  if (studioImportPending) {
    renderStudioDialog();
    return;
  }
  const set = selectedStudioSet();
  if (!set || !normalizeStudioLogisticsEstimate(set.logisticsEstimate)) return;
  studioEstimateSelections.set(set.setId, toggle.checked);
  renderStudioDialog();
});
document.querySelector("#studioListingFilter").addEventListener("change", (event) => {
  if (studioImportPending) {
    renderStudioDialog();
    return;
  }
  studioRecordFilters.listing = event.currentTarget.value;
  renderStudioDialog();
});
document.querySelector("#studioEstimateFilter").addEventListener("change", (event) => {
  if (studioImportPending) {
    renderStudioDialog();
    return;
  }
  studioRecordFilters.estimate = event.currentTarget.value;
  renderStudioDialog();
});

const imageLightbox = document.querySelector("#imageLightbox");
const imageLightboxStage = document.querySelector("#imageLightboxStage");
const imageLightboxImage = document.querySelector("#imageLightboxImage");
document.querySelector("#imageLightboxClose").addEventListener("click", closeImageLightbox);
document.querySelector("#imageLightboxZoomIn").addEventListener("click", () => setImageLightboxScale(imageLightboxState.scale * 1.25));
document.querySelector("#imageLightboxZoomOut").addEventListener("click", () => setImageLightboxScale(imageLightboxState.scale / 1.25));
document.querySelector("#imageLightboxReset").addEventListener("click", resetImageLightboxTransform);
imageLightbox.addEventListener("click", (event) => {
  if (event.target === imageLightbox || event.target === imageLightboxStage) closeImageLightbox();
});
imageLightboxImage.addEventListener("wheel", (event) => {
  event.preventDefault();
  setImageLightboxScale(imageLightboxState.scale * (event.deltaY < 0 ? 1.12 : 1 / 1.12));
}, { passive: false });
imageLightboxImage.addEventListener("pointerdown", (event) => {
  if (event.button !== 0) return;
  event.preventDefault();
  imageLightboxState.dragging = true;
  imageLightboxState.pointerId = event.pointerId;
  imageLightboxState.startPointerX = event.clientX;
  imageLightboxState.startPointerY = event.clientY;
  imageLightboxState.startImageX = imageLightboxState.x;
  imageLightboxState.startImageY = imageLightboxState.y;
  imageLightboxImage.setPointerCapture(event.pointerId);
  applyImageLightboxTransform();
});
imageLightboxImage.addEventListener("pointermove", (event) => {
  if (!imageLightboxState.dragging || event.pointerId !== imageLightboxState.pointerId) return;
  imageLightboxState.x = imageLightboxState.startImageX + event.clientX - imageLightboxState.startPointerX;
  imageLightboxState.y = imageLightboxState.startImageY + event.clientY - imageLightboxState.startPointerY;
  applyImageLightboxTransform();
});
const stopImageLightboxDrag = (event) => {
  if (event.pointerId !== imageLightboxState.pointerId) return;
  imageLightboxState.dragging = false;
  imageLightboxState.pointerId = null;
  applyImageLightboxTransform();
};
imageLightboxImage.addEventListener("pointerup", stopImageLightboxDrag);
imageLightboxImage.addEventListener("pointercancel", stopImageLightboxDrag);
imageLightboxImage.addEventListener("dragstart", (event) => event.preventDefault());
imageLightbox.addEventListener("close", resetImageLightboxTransform);

const skuCarouselPickerDialog = document.querySelector("#skuCarouselPickerDialog");
skuCarouselPickerDialog.addEventListener("close", () => {
  skuCarouselPickerTarget = null;
});

const skuImageUrlDialog = document.querySelector("#skuImageUrlDialog");
skuImageUrlDialog.addEventListener("close", () => {
  skuImageUrlEditorTarget = null;
});
document.querySelector("#saveSkuImageUrlButton").addEventListener("click", saveSkuImageUrlFromEditor);
document.querySelector("#skuImageUrlInput").addEventListener("keydown", (event) => {
  if (event.key !== "Enter") return;
  event.preventDefault();
  saveSkuImageUrlFromEditor();
});

const settingsDialog = document.querySelector("#settingsDialog");
document.querySelector("#settingsButton").addEventListener("click", () => {
  document.querySelector("#cloudNameInput").value = draft.settings.cloudName;
  document.querySelector("#uploadPresetInput").value = draft.settings.uploadPreset;
  settingsDialog.showModal();
});
document.querySelector("#saveSettingsButton").addEventListener("click", (event) => {
  event.preventDefault();
  const settings = {
    cloudName: document.querySelector("#cloudNameInput").value.trim(),
    uploadPreset: document.querySelector("#uploadPresetInput").value.trim(),
  };
  workbench = applySharedCloudinarySettings(workbench, settings);
  draft = activeProductItem().draft;
  scheduleSave();
  settingsDialog.close();
  renderDynamic();
  const pendingUploads = exportImageEntries().filter(({ asset }) => !asset.url).length;
  showToast(settings.cloudName && settings.uploadPreset
    ? `Cloudinary 配置已保存，已应用到全部 ${workbench.items.length} 个商品${pendingUploads ? `；当前商品有 ${pendingUploads} 张图片将在导出前上传` : ""}`
    : "已切换为手工 URL，已应用到全部商品");
});

// ---- 跨文档协议（同源 iframe 覆盖层） ----
// 工作台自己是子文档，宿主是 Studio 主页面。只认三种消息，且两端都按 location.origin 校验。

function applyWorkbenchTheme(theme) {
  // 深色是 :root 的默认值，因此只有 light 需要落 data-theme；其余值一律回落到深色。
  if (theme === "light") document.documentElement.dataset.theme = "light";
  else delete document.documentElement.dataset.theme;
}

function applyWorkbenchLanguage(language) {
  // 工作台文案目前只有简体中文，所以 lang 保持 zh-CN 不动（改成 en 会让读屏器按英文念中文）。
  // 宿主的选择记在 data-ui-language 上，与 Studio 同名，留给后续真正做翻译时取用。
  document.documentElement.dataset.uiLanguage = language === "en" ? "en" : "zh-CN";
}

function isSameOriginMessage(event) {
  return event.origin === location.origin && event.source === window.parent && window.parent !== window;
}

window.addEventListener("message", (event) => {
  if (!isSameOriginMessage(event)) return;
  const data = event.data;
  if (!data || typeof data !== "object") return;

  if (data.type === WORKBENCH_MESSAGE_INIT) {
    applyWorkbenchTheme(data.theme);
    applyWorkbenchLanguage(data.lang);
    const setIds = Array.isArray(data.setIds) ? data.setIds : [];
    // 没有勾选记录时不弹导入对话框：那会让重新打开覆盖层的用户先关掉一个空列表才能回到草稿。
    if (setIds.length) openStudioImportDialog(setIds);
    return;
  }

  if (data.type === WORKBENCH_MESSAGE_THEME) {
    applyWorkbenchTheme(data.theme);
  }
});

// 焦点落在 frame 内时 Escape 关不掉宿主覆盖层，所以由子文档转发关闭请求。
// 判据是「当前没有任何 dialog 打开」——用 querySelector 而不是数个数，
// 本文档现有 6 个 dialog，写死数量会随改动漂移。
// 前面那个 keydown 监听在处理掉变种输入框、两个上下文菜单和运费模板输入后都会
// preventDefault，所以 defaultPrevented 足以避开它们；本监听注册在其后，同阶段按注册顺序在其之后运行。
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || event.defaultPrevented) return;
  if (window.parent === window) return;
  if (document.querySelector("dialog[open]")) return;
  window.parent.postMessage({ type: WORKBENCH_MESSAGE_REQUEST_CLOSE }, location.origin);
});

initOptions();
rememberKnownUploadedImages();
syncBoundInputs();
syncSensitiveInputs();
renderDynamic();
setupViewNavigation();
checkHealth();
if (draftNeedsMigrationSave) saveDraftNow();
