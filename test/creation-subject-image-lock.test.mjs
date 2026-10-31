import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import { buildCreationPlan, buildCreationProductFidelityInstruction } from "../lib/creation-planner.mjs";
import { buildCreationItemReferenceImages, buildCreationGenerationReferenceImageLabels } from "../lib/creation-reference-labels.mjs";
import { isCreationSubjectReferenceRole } from "../lib/creation-reference-roles.mjs";
import { reorderCreationReferenceFiles } from "../lib/creation-reference-drag.mjs";
import { buildCreationMarketingContext } from "../lib/creation-marketing-plan.mjs";

const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const extract = (name) => {
  const source = app.match(new RegExp(`function ${name}\\([^]*?\\n\\}`))?.[0];
  assert.ok(source, `${name} must exist`);
  return source;
};
const initialFiles = () => [
  { id: "blue", file: { name: "blue.png" }, role: "product", note: "" },
  { id: "red", file: { name: "red.png" }, role: "product", note: "" },
  { id: "detail", file: { name: "detail.png" }, role: "material", note: "" },
];

function client() {
  const calls = [];
  const context = {
    state: { creationReferenceFiles: initialFiles() },
    CREATION_REFERENCE_ROLE_OPTIONS: ["product", "reference-product", "material"].map((value) => ({ value })),
    syncCreationReferenceGenerationCompressionProfiles: () => calls.push("compression"),
    markCreationReferenceAnalysisDirty: () => calls.push("analysis"),
    resetCreationDraftPreview: () => calls.push("draft"),
    renderCreationReferenceGrid: () => calls.push("render"),
  };
  vm.runInNewContext(extract("updateCreationReferenceRole"), context);
  return { context, calls };
}

test("多 SKU 通过参考用途指定唯一参考主体，切换保留来源且不新增描述", () => {
  const { context, calls } = client();
  context.updateCreationReferenceRole("blue", "reference-product");
  context.updateCreationReferenceRole("red", "reference-product");
  assert.deepEqual(Array.from(context.state.creationReferenceFiles, (entry) => [entry.id, entry.role]), [
    ["blue", "product"], ["red", "reference-product"], ["detail", "material"],
  ]);
  assert.ok(context.state.creationReferenceFiles.every((entry) => entry.note === ""));
  for (const name of ["compression", "analysis", "draft", "render"]) assert.equal(calls.filter((entry) => entry === name).length, 2);
});

test("将参考主体改回商品主体后恢复商品图顺序，不增加额外锁定状态", () => {
  const { context } = client();
  context.updateCreationReferenceRole("red", "reference-product");
  context.updateCreationReferenceRole("red", "product");
  assert.equal(context.state.creationReferenceFiles.filter((entry) => entry.role === "reference-product").length, 0);
  assert.equal(context.state.creationReferenceFiles[1].role, "product");
  const roles = context.state.creationReferenceFiles.map((entry) => ({ role: entry.role, filename: entry.file.name }));
  assert.match(buildCreationProductFidelityInstruction(roles), /^PRODUCT FIDELITY: blue\.png/);
  assert.equal(app.includes("function toggleCreationReferenceSubjectLock"), false);
});

test("图片卡片仅保留用途下拉入口及顺序提示，没有主体锁遮挡图片", () => {
  const element = () => ({
    dataset: {}, children: [], attributes: {}, classList: { toggle() {} },
    appendChild(child) { this.children.push(child); },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, handler) { this[name] = handler; },
  });
  const grid = element();
  const files = initialFiles();
  files[1].role = "reference-product";
  const context = {
    state: { creationReferenceFiles: files, creationReferenceRestoreQueue: [] },
    refs: { creationReferenceGrid: grid, creationReferenceCount: element() },
    document: { createElement: element }, isCreationSubjectReferenceRole,
    CREATION_REFERENCE_ROLE_OPTIONS: [{ value: "product", label: "商品主体" }, { value: "reference-product", label: "参考主体" }, { value: "material", label: "材质结构细节" }],
    getCreationReferenceAnalysisDisplayRoleLabel: (entry) => entry.roleLabel,
    getCreationMaxProductReferenceImageCount: () => 3,
    syncCreationSkuGenerationControl() {}, syncReferenceDropzoneCompact() {},
    renderCreationReferenceRestoreList() {}, renderCreationReferenceAnalysis() {}, syncCreationReferenceResetButton() {},
    removeCreationReferenceFile() {},
  };
  vm.runInNewContext(extract("renderCreationReferenceGrid"), context);
  context.renderCreationReferenceGrid();
  const selects = grid.children.map((card) => card.children.find((child) => child.className === "creation-reference-role"));
  assert.equal(selects.length, 3);
  assert.ok(selects.every((select) => select.attributes["aria-label"] === "选择套图参考图用途"));
  assert.deepEqual(selects.map((select) => select.children.find((option) => option.selected).value), ["product", "reference-product", "material"]);
  assert.ok(selects.every((select) => /参考主体.*最靠前.*商品主体/.test(select.title)));
  assert.ok(grid.children.every((card) => card.children.every((child) => !child.className?.includes("subject-lock"))));
  assert.ok(files.every((entry) => entry.note === ""));
});

test("多 SKU 普通套图使用非首位锁定图作为唯一主体和首个实际附件", () => {
  const { context } = client();
  context.updateCreationReferenceRole("red", "reference-product");
  const roles = Array.from(context.state.creationReferenceFiles, (entry, index) => ({
    index: index + 1, filename: entry.file.name, role: entry.role, roleManuallyEdited: entry.roleManuallyEdited,
  }));
  const plan = buildCreationPlan({
    productName: "背包", targetLanguage: "zh-CN", selectedRoles: ["hero", "scene", "multi-angle"],
    skuGenerationEnabled: true,
    skuSubjects: [
      { id: "blue", title: "蓝色款", filenames: ["blue.png"], referenceIndexes: [1], colorNames: ["blue"] },
      { id: "red", title: "红色款", filenames: ["red.png"], referenceIndexes: [2], colorNames: ["red"] },
    ],
    referenceImageRoles: roles,
  });
  const images = roles.map((entry) => ({ filename: entry.filename, referenceIndex: entry.index }));
  const carousel = plan.items.filter((entry) => entry.itemKind === "carousel");
  assert.equal(plan.referenceImageRoles.filter((entry) => entry.role === "reference-product").length, 1);
  assert.equal(plan.skuSubjects.length, 2);
  assert.ok(carousel.length > 0);
  for (const item of carousel) {
    assert.match(item.prompt, /PRODUCT FIDELITY: red\.png/);
    assert.doesNotMatch(item.prompt, /APPEARANCE LOCK/);
    assert.equal(buildCreationItemReferenceImages(item, images, plan.referenceImageRoles)[0].referenceIndex, 2);
  }
  const skuItem = plan.items.find((item) => item.role === "sku" && item.skuSubject.id === "red");
  assert.match(skuItem.prompt, /red\.png is this SKU's primary product reference/);
  const skuReferences = buildCreationItemReferenceImages(skuItem, images, plan.referenceImageRoles);
  assert.equal(skuReferences[0].referenceIndex, 2);
  assert.equal(skuReferences.some((entry) => entry.referenceIndex === 1), false);
});

test("没有参考主体时以最前商品主体为锚点，拖动排序后各入口同步变化", () => {
  const files = [initialFiles()[2], ...initialFiles().slice(0, 2)];
  const reordered = reorderCreationReferenceFiles(files, "red", "blue");
  for (const [references, filename] of [[files, "blue.png"], [reordered, "red.png"]]) {
    const roles = references.map((entry, index) => ({ index: index + 1, filename: entry.file.name, role: entry.role }));
    const images = roles.map((entry) => ({ filename: entry.filename, referenceIndex: entry.index }));
    const plan = buildCreationPlan({ productName: "背包", selectedRoles: ["hero"], referenceImageRoles: roles });
    const item = plan.items[0];
    const index = roles.find((role) => role.filename === filename).index;
    assert.ok(item.prompt.includes(`PRODUCT FIDELITY: ${filename}`));
    assert.equal(buildCreationItemReferenceImages(item, images, plan.referenceImageRoles)[0].filename, filename);
    assert.equal(buildCreationMarketingContext({ imageCount: 1 }, plan, images).primary_reference_index, index);
    const selected = buildCreationItemReferenceImages(item, images, plan.referenceImageRoles);
    const labels = buildCreationGenerationReferenceImageLabels(selected, plan.referenceImageRoles, { ...item, promptContext: { version: 1 } });
    assert.match(labels[0], /Product identity;/);
    const context = { state: { creationReferenceFiles: references }, isCreationSubjectReferenceRole };
    vm.runInNewContext(extract("isCreationPrimarySubjectReference"), context);
    assert.equal(context.isCreationPrimarySubjectReference(references.find((entry) => entry.file.name === filename)), true);
    assert.equal(context.isCreationPrimarySubjectReference(references[0]), false);
  }
});

test("紧凑参考标签不能把另一 SKU 图片提升为第二主体", () => {
  const images = [{ filename: "red-compressed.jpg", referenceIndex: 2 }, { filename: "blue-compressed.jpg", referenceIndex: 1 }];
  const roles = [{ index: 1, filename: "blue.png", role: "product" }, { index: 2, filename: "red.png", role: "reference-product" }];
  const labels = buildCreationGenerationReferenceImageLabels(images, roles, { role: "scene", promptContext: { version: 1 } });
  assert.match(labels[0], /Product identity; retain observed surfaces and opening states/);
  assert.match(labels[1], /Supporting product evidence only/);
  assert.equal(labels.filter((label) => label.includes("Product identity;")).length, 1);
  assert.deepEqual(buildCreationGenerationReferenceImageLabels(images, roles, { role: "infographic-rebuild" }), []);
});
