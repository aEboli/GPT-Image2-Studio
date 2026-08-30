import assert from "node:assert/strict";
import test from "node:test";
import { createDefaultDraft, generateSkuMatrix } from "../lib/temu/domain.mjs";
import { TEMU_STUDIO_IMAGE_PATH } from "../lib/temu/template-headers.mjs";
import { createValidDraft } from "./temu-fixtures.mjs";
import {
  PRODUCT_WORKBENCH_VERSION,
  appendProductItems,
  applyShippingFieldsToAllProducts,
  applySharedCloudinarySettings,
  applyProductSelection,
  createWorkbenchBackup,
  createProductItem,
  deleteSelectedProducts,
  deleteFreightTemplate,
  filterProductItems,
  markProductsExported,
  normalizeFreightTemplates,
  normalizeProductWorkbench,
  productIsExported,
  renameFreightTemplate,
  resetActiveProduct,
  restoreWorkbenchBackup,
  saveFreightTemplate,
  selectedProductItems,
} from "../lib/temu/product-workbench.mjs";

const now = "2026-08-01T08:00:00.000Z";

test("旧单草稿迁移为唯一当前商品并补齐 SKU", () => {
  const legacyDraft = createDefaultDraft();
  legacyDraft.product.title = "旧草稿商品";
  const state = normalizeProductWorkbench(null, { legacyDraft, now });

  assert.equal(state.items.length, 1);
  assert.equal(state.activeId, state.items[0].id);
  assert.equal(state.items[0].draft.product.title, "旧草稿商品");
  assert.equal(state.items[0].draft.skus.length, 1);
  assert.equal(state.items[0].selected, true);
});

test("商品集合恢复顺序、当前商品和独立草稿", () => {
  const first = createDefaultDraft();
  const second = createDefaultDraft();
  first.product.title = "商品 A";
  second.product.title = "商品 B";
  const state = normalizeProductWorkbench({
    version: 1,
    activeId: "product-b",
    items: [
      { id: "product-a", draft: first, selected: true, createdAt: now, updatedAt: now },
      { id: "product-b", draft: second, selected: false, createdAt: now, updatedAt: now },
    ],
  }, { now });

  assert.deepEqual(state.items.map((item) => item.draft.product.title), ["商品 A", "商品 B"]);
  assert.equal(state.activeId, "product-b");
  state.items[1].draft.product.title = "商品 B 已编辑";
  assert.equal(state.items[0].draft.product.title, "商品 A");
});

test("追加一条商品保留当前商品、选择状态和本地预览", () => {
  const currentDraft = createDefaultDraft();
  currentDraft.product.title = "正在编辑的商品";
  currentDraft.assets.carousel = [{
    id: "current-local-image",
    name: "current.jpg",
    localPreview: "blob:current-preview",
    status: "local",
  }];
  const state = normalizeProductWorkbench({
    version: PRODUCT_WORKBENCH_VERSION,
    activeId: "current-product",
    items: [{ id: "current-product", draft: currentDraft, selected: false, createdAt: now, updatedAt: now }],
  }, { now });
  const currentItem = state.items[0];
  const currentSnapshot = structuredClone(currentItem.draft);
  const importedDraft = createDefaultDraft();
  importedDraft.product.title = "Studio 新商品";

  const appended = appendProductItems(state, [importedDraft], { selected: true, now });

  assert.equal(state.items.length, 1);
  assert.equal(appended.activeId, "current-product");
  assert.equal(appended.items.length, 2);
  assert.strictEqual(appended.items[0], currentItem);
  assert.deepEqual(appended.items[0].draft, currentSnapshot);
  assert.equal(appended.items[0].selected, false);
  assert.equal(appended.items[0].draft.assets.carousel[0].localPreview, "blob:current-preview");
  assert.equal(appended.items[1].draft.product.title, "Studio 新商品");
  assert.equal(appended.items[1].selected, true);
});

test("追加多条商品按输入顺序排列且全部进入导出选择", () => {
  const currentDraft = createDefaultDraft();
  currentDraft.product.title = "现有商品";
  const state = normalizeProductWorkbench({
    version: PRODUCT_WORKBENCH_VERSION,
    activeId: "current-product",
    items: [{ id: "current-product", draft: currentDraft, selected: false, createdAt: now, updatedAt: now }],
  }, { now });
  const firstImported = createDefaultDraft();
  firstImported.product.title = "Studio 商品 A";
  const secondImported = createDefaultDraft();
  secondImported.product.title = "Studio 商品 B";

  const appended = appendProductItems(state, [firstImported, secondImported], { selected: true, now });

  assert.deepEqual(appended.items.map((item) => item.draft.product.title), ["现有商品", "Studio 商品 A", "Studio 商品 B"]);
  assert.deepEqual(selectedProductItems(appended).map((item) => item.draft.product.title), ["Studio 商品 A", "Studio 商品 B"]);
  assert.equal(appended.activeId, "current-product");
  assert.equal(appended.items[0].selected, false);
});

test("价格与运输字段可从当前商品不可变地同步到全部商品", () => {
  const first = createValidDraft();
  const second = createValidDraft();
  const third = createValidDraft();
  first.product.suggestedPrice = "";
  first.product.freightTemplateId = "freight-us";
  first.product.leadTime = "9";
  second.product.suggestedPrice = "19.99";
  second.product.freightTemplateId = "HFT-18421307196784823200";
  second.product.leadTime = "2";
  third.product.suggestedPrice = "";
  third.product.freightTemplateId = "freight-us";
  third.product.leadTime = "9";
  const state = normalizeProductWorkbench({
    version: PRODUCT_WORKBENCH_VERSION,
    activeId: "product-a",
    freightTemplates: [{ id: "freight-us", name: "美国仓" }],
    items: [
      { id: "product-a", draft: first, selected: false, createdAt: now, updatedAt: "2026-08-01T08:00:00.000Z", exportedAt: "2026-08-01T08:30:00.000Z" },
      { id: "product-b", draft: second, selected: true, createdAt: now, updatedAt: "2026-08-01T08:00:00.000Z", exportedAt: "2026-08-01T08:30:00.000Z" },
      { id: "product-c", draft: third, selected: false, createdAt: now, updatedAt: "2026-08-01T08:00:00.000Z", exportedAt: "2026-08-01T08:30:00.000Z" },
    ],
  }, { now });
  const snapshot = structuredClone(state);
  const syncedAt = "2026-08-01T09:00:00.000Z";

  const updated = applyShippingFieldsToAllProducts(state, state.items[0].draft.product, { now: syncedAt });

  assert.notStrictEqual(updated, state);
  assert.deepEqual(
    updated.items.map((item) => [
      item.draft.product.suggestedPrice,
      item.draft.product.freightTemplateId,
      item.draft.product.leadTime,
    ]),
    [
      ["", "freight-us", "9"],
      ["", "freight-us", "9"],
      ["", "freight-us", "9"],
    ],
  );
  assert.strictEqual(updated.items[0], state.items[0], "源商品字段相同时不应创建新项");
  assert.strictEqual(updated.items[2], state.items[2], "字段已一致的商品不应创建新项");
  assert.equal(updated.items[1].updatedAt, syncedAt);
  assert.equal(updated.items[1].exportedAt, snapshot.items[1].exportedAt);
  assert.equal(productIsExported(updated.items[1]), false, "同步后的已导出商品应显示为已修改");
  assert.equal(updated.items[1].selected, true);
  assert.deepEqual(updated.items[1].draft.skus, snapshot.items[1].draft.skus);
  assert.deepEqual(updated.items[1].draft.assets, snapshot.items[1].draft.assets);
  assert.deepEqual(state, snapshot, "helper 不得改写输入工作台");
  assert.strictEqual(
    applyShippingFieldsToAllProducts(updated, updated.items[0].draft.product, { now: "2026-08-01T10:00:00.000Z" }),
    updated,
  );
});

test("运费模板记录去重、改名、删除和商品回退保持一致", () => {
  assert.deepEqual(
    normalizeFreightTemplates([
      { id: "custom-a", name: " 美国仓 " },
      { id: "custom-a", name: "重复 ID" },
      { id: "custom-b", name: "美国仓" },
      { id: "", name: "无效记录" },
    ]),
    [
      { id: "HFT-18421307196784823200", name: "出口易交大略3号仓" },
      { id: "custom-a", name: "美国仓" },
    ],
  );

  const first = createDefaultDraft();
  const second = createDefaultDraft();
  const state = normalizeProductWorkbench({
    version: PRODUCT_WORKBENCH_VERSION,
    activeId: "product-b",
    items: [
      { id: "product-a", draft: first, createdAt: now, updatedAt: now },
      { id: "product-b", draft: second, createdAt: now, updatedAt: now },
    ],
  }, { now });
  const saved = saveFreightTemplate(state, "海外仓模板");
  const custom = saved.freightTemplates.find((item) => item.name === "海外仓模板");
  assert.ok(custom);
  assert.equal(saved.items[1].draft.product.freightTemplateId, custom.id);

  const renamed = saveFreightTemplate(saved, "海外仓模板已更新");
  assert.equal(renamed.freightTemplates.length, 2);
  assert.equal(renamed.freightTemplates.find((item) => item.id === custom.id)?.name, "海外仓模板已更新");

  const withSharedReference = structuredClone(renamed);
  withSharedReference.items[0].draft.product.freightTemplateId = custom.id;
  const deleted = deleteFreightTemplate(withSharedReference, custom.id);
  assert.deepEqual(deleted.freightTemplates, [{ id: "HFT-18421307196784823200", name: "出口易交大略3号仓" }]);
  assert.ok(deleted.items.every((item) => item.draft.product.freightTemplateId === "HFT-18421307196784823200"));
  assert.throws(() => deleteFreightTemplate(deleted, "HFT-18421307196784823200"), /不可删除/);
});

test("显式添加模板不会改名当前模板，行内改名保持稳定 ID", () => {
  const state = normalizeProductWorkbench({
    activeId: "product-a",
    items: [{ id: "product-a", draft: createDefaultDraft(), createdAt: now, updatedAt: now }],
  }, { now });
  const first = saveFreightTemplate(state, "美国仓");
  const firstTemplate = first.freightTemplates.find((item) => item.name === "美国仓");
  const created = saveFreightTemplate(first, "欧洲仓", { forceCreate: true });
  const secondTemplate = created.freightTemplates.find((item) => item.name === "欧洲仓");

  assert.ok(firstTemplate && secondTemplate);
  assert.notEqual(firstTemplate.id, secondTemplate.id);
  assert.equal(created.freightTemplates.find((item) => item.id === firstTemplate.id)?.name, "美国仓");
  assert.equal(created.items[0].draft.product.freightTemplateId, secondTemplate.id);

  const renamed = renameFreightTemplate(created, firstTemplate.id, "美国仓已更新");
  assert.equal(renamed.freightTemplates.find((item) => item.id === firstTemplate.id)?.name, "美国仓已更新");
  assert.equal(renamed.items[0].draft.product.freightTemplateId, secondTemplate.id);
  assert.throws(() => renameFreightTemplate(renamed, firstTemplate.id, "欧洲仓"), /已存在/);
  assert.throws(() => renameFreightTemplate(renamed, "HFT-18421307196784823200", "默认模板"), /不可改名/);
});

test("导出状态只在导出时间不早于修改时间时成立", () => {
  const item = createProductItem(createDefaultDraft(), {
    id: "product-a",
    createdAt: now,
    updatedAt: "2026-08-01T08:10:00.000Z",
    exportedAt: "2026-08-01T08:20:00.000Z",
  });
  assert.equal(productIsExported(item), true);
  item.updatedAt = "2026-08-01T08:30:00.000Z";
  assert.equal(productIsExported(item), false);
});

test("全选、已导出和未导出预设只改变导出勾选集合", () => {
  const draft = createDefaultDraft();
  const state = normalizeProductWorkbench({
    activeId: "product-a",
    items: [
      { id: "product-a", draft, selected: false, createdAt: now, updatedAt: now, exportedAt: "2026-08-01T08:10:00.000Z" },
      { id: "product-b", draft, selected: true, createdAt: now, updatedAt: "2026-08-01T08:20:00.000Z", exportedAt: "2026-08-01T08:10:00.000Z" },
      { id: "product-c", draft, selected: false, createdAt: now, updatedAt: now },
    ],
  }, { now });

  const exported = applyProductSelection(state, "exported");
  assert.deepEqual(selectedProductItems(exported).map((item) => item.id), ["product-a"]);
  const unexported = applyProductSelection(state, "unexported");
  assert.deepEqual(selectedProductItems(unexported).map((item) => item.id), ["product-b", "product-c"]);
  assert.equal(selectedProductItems(applyProductSelection(state, "all")).length, 3);
  assert.equal(selectedProductItems(applyProductSelection(state, "none")).length, 0);
  assert.equal(state.activeId, "product-a");
});

test("成功导出只标记本次商品", () => {
  const state = normalizeProductWorkbench({
    activeId: "product-a",
    items: [
      { id: "product-a", draft: createDefaultDraft(), createdAt: now, updatedAt: now },
      { id: "product-b", draft: createDefaultDraft(), createdAt: now, updatedAt: now },
    ],
  }, { now });
  const exported = markProductsExported(state, ["product-b"], "2026-08-01T09:00:00.000Z");

  assert.equal(exported.items[0].exportedAt, "");
  assert.equal(exported.items[1].exportedAt, "2026-08-01T09:00:00.000Z");
  assert.equal(productIsExported(exported.items[1]), true);
});

test("恢复默认只替换当前商品并保留集合属性和上传设置", () => {
  const other = createValidDraft();
  other.product.title = "保留的商品";
  const active = createValidDraft();
  active.product.title = "需要重置的商品";
  active.product.description = "Studio 导入内容";
  active.settings.cloudName = "demo-cloud";
  active.settings.uploadPreset = "temu-upload";
  active.studioImport = { setId: "studio-set" };
  const state = normalizeProductWorkbench({
    activeId: "product-b",
    items: [
      { id: "product-a", draft: other, selected: false, createdAt: now, updatedAt: now, exportedAt: now },
      { id: "product-b", draft: active, selected: true, createdAt: "2026-08-01T08:05:00.000Z", updatedAt: now, exportedAt: now },
    ],
  }, { now });
  const unchangedItem = structuredClone(state.items[0]);

  const reset = resetActiveProduct(state, { now: "2026-08-01T09:00:00.000Z" });
  const resetItem = reset.items[1];

  assert.equal(reset.activeId, "product-b");
  assert.equal(resetItem.id, "product-b");
  assert.equal(resetItem.createdAt, "2026-08-01T08:05:00.000Z");
  assert.equal(resetItem.selected, true);
  assert.equal(resetItem.updatedAt, "2026-08-01T09:00:00.000Z");
  assert.equal(resetItem.exportedAt, "");
  assert.equal(resetItem.draft.product.title, "");
  assert.equal(resetItem.draft.product.description, "");
  assert.equal(resetItem.draft.assets.carousel.length, 0);
  assert.equal(resetItem.draft.studioImport, undefined);
  assert.equal(resetItem.draft.settings.cloudName, "demo-cloud");
  assert.equal(resetItem.draft.settings.uploadPreset, "temu-upload");
  assert.deepEqual(resetItem.draft.variants.values1, ["默认"]);
  assert.equal(resetItem.draft.skus.length, 1);
  assert.deepEqual(reset.items[0], unchangedItem);
  assert.equal(state.items[1].draft.product.title, "需要重置的商品");
});

test("删除已勾选商品时保留未勾选的当前商品", () => {
  const state = normalizeProductWorkbench({
    activeId: "product-b",
    items: [
      { id: "product-a", draft: createDefaultDraft(), selected: true, createdAt: now, updatedAt: now, exportedAt: now },
      { id: "product-b", draft: createDefaultDraft(), selected: false, createdAt: now, updatedAt: now },
      { id: "product-c", draft: createDefaultDraft(), selected: true, createdAt: now, updatedAt: now, exportedAt: now },
    ],
  }, { now });

  const deleted = deleteSelectedProducts(state);

  assert.deepEqual(deleted.items.map((item) => item.id), ["product-b"]);
  assert.equal(deleted.activeId, "product-b");
  assert.equal(deleted.items[0], state.items[1]);
  assert.equal(state.activeId, "product-b");
  assert.equal(state.items.length, 3);
});

test("当前商品也被勾选时优先激活其后的未删除商品", () => {
  const state = normalizeProductWorkbench({
    activeId: "product-b",
    items: [
      { id: "product-a", draft: createDefaultDraft(), selected: true, createdAt: now, updatedAt: now },
      { id: "product-b", draft: createDefaultDraft(), selected: true, createdAt: now, updatedAt: now },
      { id: "product-c", draft: createDefaultDraft(), selected: false, createdAt: now, updatedAt: now },
      { id: "product-d", draft: createDefaultDraft(), selected: false, createdAt: now, updatedAt: now },
    ],
  }, { now });

  const deleted = deleteSelectedProducts(state);
  assert.deepEqual(deleted.items.map((item) => item.id), ["product-c", "product-d"]);
  assert.equal(deleted.activeId, "product-c");
});

test("被删除的当前商品后面没有未删除项时激活前一个商品", () => {
  const state = normalizeProductWorkbench({
    activeId: "product-c",
    items: [
      { id: "product-a", draft: createDefaultDraft(), selected: false, createdAt: now, updatedAt: now },
      { id: "product-b", draft: createDefaultDraft(), selected: false, createdAt: now, updatedAt: now },
      { id: "product-c", draft: createDefaultDraft(), selected: true, createdAt: now, updatedAt: now },
    ],
  }, { now });

  const deleted = deleteSelectedProducts(state);
  assert.deepEqual(deleted.items.map((item) => item.id), ["product-a", "product-b"]);
  assert.equal(deleted.activeId, "product-b");
});

test("删除全部勾选商品后创建未勾选空白商品并保留共享设置", () => {
  const draft = createDefaultDraft();
  draft.product.title = "待删除商品";
  draft.settings.cloudName = "demo-cloud";
  draft.settings.uploadPreset = "temu-upload";
  const state = normalizeProductWorkbench({
    activeId: "product-a",
    items: [{ id: "product-a", draft, selected: true, createdAt: now, updatedAt: now }],
  }, { now });

  const deleted = deleteSelectedProducts(state, { now: "2026-08-01T09:00:00.000Z" });
  assert.equal(deleted.items.length, 1);
  assert.equal(deleted.activeId, deleted.items[0].id);
  assert.notEqual(deleted.activeId, "product-a");
  assert.equal(deleted.items[0].selected, false);
  assert.equal(deleted.items[0].draft.product.title, "");
  assert.equal(deleted.items[0].draft.settings.cloudName, "demo-cloud");
  assert.equal(deleted.items[0].draft.settings.uploadPreset, "temu-upload");
  assert.equal(state.items[0].draft.product.title, "待删除商品");
});

test("没有勾选商品时不删除集合", () => {
  const state = {
    version: PRODUCT_WORKBENCH_VERSION,
    activeId: "missing",
    items: [
      createProductItem(createDefaultDraft(), { id: "product-a", selected: false, now }),
      createProductItem(createDefaultDraft(), { id: "product-b", selected: false, now }),
    ],
  };

  assert.equal(resetActiveProduct(state, { now }), state);
  assert.equal(deleteSelectedProducts(state), state);
});

test("完整商品集合可导出并恢复为版本化备份", () => {
  const first = createValidDraft();
  first.product.title = "备份商品 A";
  first.assets.carousel[0].localPreview = "blob:temporary-preview";
  const second = createValidDraft();
  second.product.title = "备份商品 B";
  const state = normalizeProductWorkbench({
    activeId: "product-b",
    items: [
      { id: "product-a", draft: first, selected: false, createdAt: now, updatedAt: now },
      { id: "product-b", draft: second, selected: true, createdAt: now, updatedAt: now },
    ],
  }, { now });

  const backup = createWorkbenchBackup(state, { createdAt: now });
  assert.equal(backup.format, "temu-local-listing-workbench");
  assert.equal(backup.version, 1);
  assert.equal(backup.createdAt, now);
  assert.equal(JSON.stringify(backup).includes("blob:temporary-preview"), false);

  const restored = restoreWorkbenchBackup(backup, { now });
  assert.equal(restored.activeId, "product-b");
  assert.deepEqual(restored.items.map((item) => item.draft.product.title), ["备份商品 A", "备份商品 B"]);
  assert.equal(restored.items[0].selected, false);
  assert.equal(restored.items[0].draft.assets.carousel[0].localPreview, undefined);
});

test("不兼容备份不会被恢复", () => {
  assert.throws(() => restoreWorkbenchBackup({ format: "other", version: 1, workbench: {} }), /不兼容/);
  assert.throws(() => restoreWorkbenchBackup({ format: "temu-local-listing-workbench", version: 1 }), /缺少商品工作台数据/);
});

test("商品列表按中英文标题、商品货号、SKU 货号和状态过滤且不修改集合", () => {
  const first = createValidDraft();
  first.product.title = "羊毛毡小马挂件";
  first.product.englishTitle = "Embroidered Horse Charm";
  first.product.productCode = "HORSE-100";
  first.skus[0].skuCode = "HORSE-RED-01";

  const second = createDefaultDraft();
  second.product.title = "猫耳发箍";
  second.product.englishTitle = "Fuzzy Cat Ear Headband";
  second.product.productCode = "CAT-200";
  second.skus = [];

  const state = normalizeProductWorkbench({
    activeId: "product-b",
    items: [
      { id: "product-a", draft: first, selected: false, createdAt: now, updatedAt: now, exportedAt: "2026-08-01T09:00:00.000Z" },
      { id: "product-b", draft: second, selected: true, createdAt: now, updatedAt: now },
    ],
  }, { now });
  const snapshot = structuredClone(state);

  for (const query of ["小马", "horse charm", "HORSE-100", "red-01"]) {
    assert.deepEqual(filterProductItems(state, { query }).map((item) => item.id), ["product-a"], query);
  }
  assert.deepEqual(filterProductItems(state, { status: "exported" }).map((item) => item.id), ["product-a"]);
  assert.deepEqual(filterProductItems(state, { status: "incomplete" }).map((item) => item.id), ["product-b"]);
  assert.deepEqual(filterProductItems(state, { status: "unexported" }).map((item) => item.id), ["product-b"]);
  assert.deepEqual(state, snapshot);
});

test("v1 商品集合一次性移除旧 Listing 派生预估且保留已改字段", () => {
  const legacy = createValidDraft();
  legacy.studioImport = {
    setId: "creation-set-legacy",
    logisticsEstimate: { source: "package", lengthCm: "20", widthCm: "15", heightCm: "8", weightG: "380" },
  };
  legacy.skus[0].weight = "410";
  const state = normalizeProductWorkbench({
    version: 1,
    activeId: "product-a",
    items: [{ id: "product-a", draft: legacy, createdAt: now, updatedAt: now }],
  }, { now });
  const migrated = state.items[0].draft;

  assert.equal(state.version, PRODUCT_WORKBENCH_VERSION);
  assert.equal(migrated.studioImport.logisticsEstimate, undefined);
  assert.deepEqual([migrated.product.length, migrated.product.width, migrated.product.height, migrated.product.weight], ["", "", "", ""]);
  assert.equal(migrated.skus[0].weight, "410", "手工改过的字段必须保留");
  assert.ok(migrated.skus.slice(1).every((sku) => sku.length === "" && sku.width === "" && sku.height === "" && sku.weight === ""));
});

test("v2 商品集合一次性补默认 SKU 和首图且保留已有专属图", () => {
  const missing = createDefaultDraft();
  missing.variants.values1 = [];
  missing.skus = [];
  missing.assets.carousel = [{
    id: "main-image",
    name: "main.png",
    width: 1200,
    height: 1200,
    status: "local",
    studioPreviewUrl: `${TEMU_STUDIO_IMAGE_PATH}?setId=legacy&itemId=main`,
  }];

  const existing = createDefaultDraft();
  existing.variants.values1 = ["红色"];
  existing.assets.carousel = [{
    id: "other-main",
    name: "other-main.png",
    width: 1200,
    height: 1200,
    status: "verified",
    url: "https://example.com/other-main.png",
  }];
  existing.skus = generateSkuMatrix(existing);
  existing.skus[0].image = {
    id: "own-sku",
    name: "own-sku.png",
    width: 1200,
    height: 1200,
    status: "verified",
    url: "https://example.com/own-sku.png",
  };

  const state = normalizeProductWorkbench({
    version: 2,
    activeId: "missing",
    items: [
      { id: "missing", draft: missing, createdAt: now, updatedAt: now },
      { id: "existing", draft: existing, createdAt: now, updatedAt: now },
    ],
  }, { now });

  assert.equal(state.version, PRODUCT_WORKBENCH_VERSION);
  assert.deepEqual(state.items[0].draft.variants.values1, ["默认"]);
  assert.equal(state.items[0].draft.skus.length, 1);
  assert.ok(state.items[0].draft.skus[0].skuCode);
  assert.equal(state.items[0].draft.skus[0].image.studioPreviewUrl, `${TEMU_STUDIO_IMAGE_PATH}?setId=legacy&itemId=main`);
  assert.equal(state.items[1].draft.skus[0].image.url, "https://example.com/own-sku.png");

  const current = structuredClone(state);
  current.items[0].draft.skus[0].image = {};
  const normalizedAgain = normalizeProductWorkbench(current, { now });
  assert.equal(normalizedAgain.items[0].draft.skus[0].image.status, "empty", "v3 中主动清空后不得重复迁移");
});

test("v3 SKU 修复不重复执行旧版预估清理", () => {
  const draft = createValidDraft();
  draft.studioImport = {
    setId: "creation-set-structured",
    logisticsEstimate: { source: "package", lengthCm: "20", widthCm: "15", heightCm: "8", weightG: "380" },
  };
  const state = normalizeProductWorkbench({
    version: 2,
    activeId: "product-a",
    items: [{ id: "product-a", draft, createdAt: now, updatedAt: now }],
  }, { now });

  assert.deepEqual(state.items[0].draft.studioImport.logisticsEstimate, draft.studioImport.logisticsEstimate);
  assert.deepEqual(
    [state.items[0].draft.product.length, state.items[0].draft.product.width, state.items[0].draft.product.height, state.items[0].draft.product.weight],
    ["20", "15", "8", "380"],
  );
});

test("保存 Cloudinary 配置会同步全部商品且保留商品状态与本地图片", () => {
  const first = createValidDraft();
  first.product.title = "商品 A";
  first.settings = { cloudName: "legacy-cloud-a", uploadPreset: "legacy-preset-a" };
  first.assets.carousel[0] = {
    ...first.assets.carousel[0],
    url: "",
    localPreview: "blob:product-a-carousel",
    status: "local",
  };
  first.skus[0].image = {
    ...first.skus[0].image,
    url: "",
    localPreview: "blob:product-a-sku",
    status: "local",
  };

  const second = createValidDraft();
  second.product.title = "商品 B";
  second.settings = { cloudName: "legacy-cloud-b", uploadPreset: "legacy-preset-b" };
  second.assets.carousel[0] = {
    ...second.assets.carousel[0],
    url: "",
    localPreview: "blob:product-b-carousel",
    status: "local",
  };
  second.skus[0].image = {
    ...second.skus[0].image,
    url: "",
    localPreview: "blob:product-b-sku",
    status: "local",
  };

  const state = normalizeProductWorkbench({
    version: PRODUCT_WORKBENCH_VERSION,
    activeId: "product-b",
    items: [
      {
        id: "product-a",
        draft: first,
        selected: false,
        createdAt: "2026-08-01T07:00:00.000Z",
        updatedAt: "2026-08-01T07:10:00.000Z",
        exportedAt: "2026-08-01T07:20:00.000Z",
      },
      {
        id: "product-b",
        draft: second,
        selected: true,
        createdAt: "2026-08-01T08:00:00.000Z",
        updatedAt: "2026-08-01T08:10:00.000Z",
        exportedAt: "2026-08-01T08:20:00.000Z",
      },
    ],
  }, { now });
  const snapshots = structuredClone(state.items);

  const updated = applySharedCloudinarySettings(state, {
    cloudName: " qbasvuby ",
    uploadPreset: " temu_listing_unsigned ",
  });

  assert.equal(updated.activeId, "product-b");
  assert.deepEqual(
    updated.items.map((item) => item.draft.settings),
    [
      { cloudName: "qbasvuby", uploadPreset: "temu_listing_unsigned" },
      { cloudName: "qbasvuby", uploadPreset: "temu_listing_unsigned" },
    ],
  );
  updated.items.forEach((item, index) => {
    const expected = structuredClone(snapshots[index]);
    expected.draft.settings = {
      ...expected.draft.settings,
      cloudName: "qbasvuby",
      uploadPreset: "temu_listing_unsigned",
    };
    assert.deepEqual(item, expected);
    assert.equal(item.selected, snapshots[index].selected);
    assert.equal(item.createdAt, snapshots[index].createdAt);
    assert.equal(item.updatedAt, snapshots[index].updatedAt);
    assert.equal(item.exportedAt, snapshots[index].exportedAt);
    assert.equal(item.draft.assets.carousel[0].localPreview, snapshots[index].draft.assets.carousel[0].localPreview);
    assert.equal(item.draft.skus[0].image.localPreview, snapshots[index].draft.skus[0].image.localPreview);
  });
  assert.deepEqual(state.items, snapshots);
});

test("v4 商品集合迁移优先使用当前商品的完整 Cloudinary 配置", () => {
  const first = createValidDraft();
  first.settings = { cloudName: "first-cloud", uploadPreset: "first-preset" };
  const active = createValidDraft();
  active.settings = { cloudName: "active-cloud", uploadPreset: "active-preset" };
  const other = createValidDraft();
  other.settings = { cloudName: "other-cloud", uploadPreset: "other-preset" };

  const migrated = normalizeProductWorkbench({
    version: 4,
    activeId: "product-b",
    items: [
      { id: "product-a", draft: first, createdAt: now, updatedAt: now },
      { id: "product-b", draft: active, createdAt: now, updatedAt: now },
      { id: "product-c", draft: other, createdAt: now, updatedAt: now },
    ],
  }, { now });

  assert.equal(migrated.version, PRODUCT_WORKBENCH_VERSION);
  assert.deepEqual(
    migrated.items.map((item) => item.draft.settings),
    [
      { cloudName: "active-cloud", uploadPreset: "active-preset" },
      { cloudName: "active-cloud", uploadPreset: "active-preset" },
      { cloudName: "active-cloud", uploadPreset: "active-preset" },
    ],
  );
});

test("旧商品集合在当前商品配置不完整时使用列表第一份完整 Cloudinary 配置", () => {
  const firstComplete = createValidDraft();
  firstComplete.settings = { cloudName: "first-cloud", uploadPreset: "first-preset" };
  const activePartial = createValidDraft();
  activePartial.settings = { cloudName: "partial-cloud", uploadPreset: "" };
  const laterComplete = createValidDraft();
  laterComplete.settings = { cloudName: "later-cloud", uploadPreset: "later-preset" };

  const migrated = normalizeProductWorkbench({
    version: 3,
    activeId: "product-b",
    items: [
      { id: "product-a", draft: firstComplete, createdAt: now, updatedAt: now },
      { id: "product-b", draft: activePartial, createdAt: now, updatedAt: now },
      { id: "product-c", draft: laterComplete, createdAt: now, updatedAt: now },
    ],
  }, { now });

  assert.equal(migrated.version, PRODUCT_WORKBENCH_VERSION);
  assert.deepEqual(
    migrated.items.map((item) => item.draft.settings),
    [
      { cloudName: "first-cloud", uploadPreset: "first-preset" },
      { cloudName: "first-cloud", uploadPreset: "first-preset" },
      { cloudName: "first-cloud", uploadPreset: "first-preset" },
    ],
  );
});
