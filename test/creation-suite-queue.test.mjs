import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreationQueuedRepairFormData,
  buildCreationQueuedSet,
  createCreationQueueJob,
  getCreationRepairTargetSet,
  getPendingCreationQueueCount,
  renderCreationQueueStrip,
  scheduleCreationGenerationQueue,
  selectCreationQueueJob,
  syncActiveCreationQueueSet,
} from "../lib/creation-suite-queue.mjs";

function normalizeSet(set = {}) {
  return {
    ...set,
    items: Array.isArray(set.items) ? set.items : [],
  };
}

function createFakeClassList() {
  const names = new Set();
  return {
    contains(name) {
      return names.has(name);
    },
    toggle(name, force) {
      const shouldHaveName = force === undefined ? !names.has(name) : Boolean(force);
      if (shouldHaveName) {
        names.add(name);
      } else {
        names.delete(name);
      }
      return shouldHaveName;
    },
  };
}

function createFakeElement(tagName) {
  return {
    tagName,
    attributes: {},
    children: [],
    classList: createFakeClassList(),
    className: "",
    dataset: {},
    textContent: "",
    type: "",
    append(...nodes) {
      this.children.push(...nodes);
    },
    appendChild(node) {
      this.children.push(node);
      return node;
    },
    replaceChildren(...nodes) {
      this.children = [...nodes];
    },
    setAttribute(name, value) {
      this.attributes[name] = String(value);
    },
  };
}

async function waitFor(condition, label) {
  const startedAt = Date.now();
  while (!condition()) {
    if (Date.now() - startedAt > 500) {
      throw new Error(`Timed out waiting for ${label}`);
    }
    await new Promise((resolve) => setTimeout(resolve, 0));
  }
}

test("creation suite queue builds a complete queued set from current form state", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [{ id: "ref-1", role: "product" }],
    buildCreationSkuSubjectPayload: () => [{ id: "sku-a", title: "SKU A", filenames: ["sku-a.jpg"] }],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: false },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => null,
    getCreationLogoPayload: () => ({ placement: "top-left" }),
    getCreationPreviewSlots: () => [{ itemId: "hero", role: "main" }],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 4,
    getCreationSelectedIndustryTemplate: () => ({
      value: "general",
      label: "General",
      categoryPath: "General > Test",
    }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => [{ itemId: "hero", role: "main" }],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    getCreationSelectedSkuGenerationRule: () => ({ value: "package-list", label: "添加包装清单" }),
    isCreationDraftSet: () => false,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    referenceFiles: [{ file: { name: "reference-a.png" } }],
    refs: {
      creationDimensionSpecsInput: { value: "13 cm" },
      creationSkuBundleCountInput: { value: "2" },
      creationVisualLanguageInput: { value: "reference-style" },
    },
    sellingPoints: ["point"],
  });

  assert.match(set.setId, /^creation-local-/);
  assert.equal(set.productName, "Queued product");
  assert.equal(set.dimensionUnitModeLabel, "Unit both");
  assert.equal(set.visualLanguage, "reference-style");
  assert.equal(set.visualLanguageLabel, "Visual reference-style");
  assert.deepEqual(set.referenceImageNames, ["reference-a.png"]);
  assert.deepEqual(set.referenceImageRoles, [{ id: "ref-1", role: "product" }]);
  assert.deepEqual(set.skuSubjects, [{ id: "sku-a", title: "SKU A", filenames: ["sku-a.jpg"] }]);
  assert.equal(set.skuGenerationRule, "package-list");
  assert.equal(set.skuGenerationRuleLabel, "添加包装清单");
  assert.deepEqual(set.logo, { placement: "top-left" });
  assert.equal(set.skuBundleCount, 2);
  assert.equal(set.items[0].status, "queued");
});

test("creation suite queue appends SKU preview cards to queued sets", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [{ filename: "red.jpg", role: "product" }],
    buildCreationSkuSubjectPayload: () => [
      { id: "red", title: "红色", filenames: ["red.jpg"] },
      { id: "blue", title: "蓝色", filenames: ["blue.jpg"] },
    ],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: true },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => null,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [
      { itemId: "hero", role: "hero", title: "主图" },
      { itemId: "scene", role: "scene", title: "场景图" },
    ],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 2,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => ["hero", "scene"],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    isCreationDraftSet: () => false,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.deepEqual(set.items.map((item) => item.role), ["hero", "scene", "sku", "sku"]);
  assert.equal(set.items[2].title, "SKU image 1 - 红色");
  assert.equal(set.items[3].itemId, "queued-sku-2");
  assert.equal(set.items[3].status, "queued");
});

test("creation suite queue defaults SKU rule to color-name labels when no getter is provided", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [{ filename: "red.jpg", role: "product" }],
    buildCreationSkuSubjectPayload: () => [{ id: "red", title: "红色", filenames: ["red.jpg"] }],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: false },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => null,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [{ itemId: "hero", role: "hero", title: "主图" }],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 1,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => ["hero"],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    isCreationDraftSet: () => false,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.skuGenerationRule, "color-name-under-subject");
  assert.equal(set.skuGenerationRuleLabel, "主体下方显示颜色名");
});

test("creation suite queue defaults infographic rebuild on and appends queued rebuild cards", () => {
  const referenceRoles = [
    { filename: "subject-a.jpg", role: "product", roleLabel: "Subject" },
    { filename: "subject-b.jpg", role: "reference-product", roleLabel: "Subject reference" },
    { filename: "size-chart.jpg", role: "dimensions", roleLabel: "Dimensions", note: "Keep measurements" },
    { filename: "steps.jpg", role: "usage", roleLabel: "Usage" },
  ];

  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => referenceRoles,
    buildCreationSkuSubjectPayload: () => [{ id: "sku-a", title: "SKU A", filenames: ["sku-a.jpg"] }],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: true },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => null,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [
      { itemId: "hero", role: "hero", title: "Hero" },
      { itemId: "scene", role: "scene", title: "Scene" },
    ],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 2,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => ["hero", "scene"],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    getCreationSelectedSkuGenerationRule: () => ({ value: "none", label: "None" }),
    isCreationDraftSet: () => false,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.infographicRebuildEnabled, true);
  assert.equal(set.imageCount, 2);
  assert.deepEqual(set.items.map((item) => item.role), ["hero", "scene", "sku", "infographic-rebuild", "infographic-rebuild"]);
  assert.equal(set.items[3].itemId, "queued-infographic-rebuild-1");
  assert.equal(set.items[3].slotIndex, 4);
  assert.deepEqual(set.items[3].sourceInfographic, {
    filename: "size-chart.jpg",
    role: "dimensions",
    roleLabel: "Dimensions",
    note: "Keep measurements",
    index: 2,
  });
  assert.deepEqual(set.items[3].referenceImageNames, ["subject-a.jpg", "subject-b.jpg", "size-chart.jpg"]);
  assert.deepEqual(set.items[4].referenceImageNames, ["subject-a.jpg", "subject-b.jpg", "steps.jpg"]);
});

test("creation suite queue omits queued infographic rebuild cards when disabled", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [
      { filename: "subject.jpg", role: "product" },
      { filename: "size-chart.jpg", role: "dimensions" },
    ],
    buildCreationSkuSubjectPayload: () => [],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: true },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => null,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [{ itemId: "hero", role: "hero", title: "Hero" }],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 1,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => ["hero"],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    getCreationSelectedSkuGenerationRule: () => ({ value: "none", label: "None" }),
    isCreationDraftSet: () => false,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationInfographicRebuildEnabledInput: { checked: false },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.infographicRebuildEnabled, false);
  assert.deepEqual(set.items.map((item) => item.role), ["hero"]);
});

test("creation suite queue forces infographic rebuild when carousel count is zero", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [
      { filename: "subject.jpg", role: "product" },
      { filename: "feature-card.jpg", role: "material", roleLabel: "Feature card" },
      { filename: "package-card.jpg", role: "package", roleLabel: "Package card" },
    ],
    buildCreationSkuSubjectPayload: () => [],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: true },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => null,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 0,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => [],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    getCreationSelectedSkuGenerationRule: () => ({ value: "none", label: "None" }),
    isCreationDraftSet: () => false,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationInfographicRebuildEnabledInput: { checked: false },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.imageCount, 0);
  assert.equal(set.infographicRebuildEnabled, true);
  assert.deepEqual(set.items.map((item) => item.role), ["infographic-rebuild", "infographic-rebuild"]);
  assert.deepEqual(
    set.items.map((item) => item.referenceImageNames),
    [
      ["subject.jpg", "feature-card.jpg"],
      ["subject.jpg", "package-card.jpg"],
    ],
  );
});

test("creation suite queue ignores stale carousel slots after zero count recognition suggestions", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [
      { filename: "subject.jpg", role: "product" },
      { filename: "feature-card.jpg", role: "material", roleLabel: "Feature card" },
      { filename: "package-card.jpg", role: "package", roleLabel: "Package card" },
    ],
    buildCreationSkuSubjectPayload: () => [],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: false },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => ({
      setId: "creation-draft-stale-carousel",
      items: [
        { itemId: "hero", role: "hero", title: "Hero", status: "idle" },
        { itemId: "scene", role: "scene", title: "Scene", status: "idle" },
      ],
    }),
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [
      { itemId: "hero", role: "hero", title: "Hero" },
      { itemId: "scene", role: "scene", title: "Scene" },
    ],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 0,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => [],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    getCreationSelectedSkuGenerationRule: () => ({ value: "none", label: "None" }),
    isCreationDraftSet: () => true,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationInfographicRebuildEnabledInput: { checked: true },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.imageCount, 0);
  assert.equal(set.infographicRebuildEnabled, true);
  assert.deepEqual(set.selectedRoles, []);
  assert.deepEqual(set.items.map((item) => item.role), ["infographic-rebuild", "infographic-rebuild"]);
});

test("creation suite queue keeps draft infographic rebuild items without changing base image count", () => {
  const draftSet = {
    setId: "creation-draft-with-rebuild",
    items: [
      { itemId: "hero", role: "hero", title: "Hero", status: "idle" },
      { itemId: "scene", role: "scene", title: "Scene", status: "idle" },
      { itemId: "queued-sku-1", role: "sku", title: "SKU image 1", status: "idle" },
      {
        itemId: "queued-infographic-rebuild-1",
        role: "infographic-rebuild",
        title: "Infographic rebuild 1",
        status: "idle",
        sourceInfographic: { filename: "size-chart.jpg", role: "dimensions", index: 1 },
      },
    ],
  };

  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [
      { filename: "subject.jpg", role: "product" },
      { filename: "size-chart.jpg", role: "dimensions" },
    ],
    buildCreationSkuSubjectPayload: () => [{ id: "sku-a", title: "SKU A", filenames: ["sku-a.jpg"] }],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: false },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => draftSet,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [
      { itemId: "hero", role: "hero", title: "Hero" },
      { itemId: "scene", role: "scene", title: "Scene" },
    ],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 2,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => ["hero", "scene"],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    getCreationSelectedSkuGenerationRule: () => ({ value: "none", label: "None" }),
    isCreationDraftSet: () => true,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.imageCount, 2);
  assert.deepEqual(set.items.map((item) => item.role), ["hero", "scene", "sku", "infographic-rebuild"]);
  assert.equal(set.items[3].sourceInfographic.filename, "size-chart.jpg");
});

test("creation suite queue rebuilds items when draft roles differ from current selected roles", () => {
  const staleRoles = [
    "hero",
    "benefit",
    "scene",
    "multi-angle",
    "atmosphere",
    "product-detail",
    "brand-story",
    "size-capacity-fit",
    "effect-comparison",
    "spec-table",
    "craft-process",
    "accessory-gift",
    "series-showcase",
    "ingredient-material",
    "after-sales",
  ];
  const selectedRoles = [...staleRoles, "usage-suggestion"];
  const staleDraft = {
    setId: "creation-draft-stale",
    items: staleRoles.map((role, index) => ({
      itemId: `${index + 1}-${role}`,
      role,
      title: role,
      status: "idle",
    })),
  };

  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [],
    buildCreationSkuSubjectPayload: () => [],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: false },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => staleDraft,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () =>
      selectedRoles.map((role, index) => ({
        itemId: `${index + 1}-${role}`,
        role,
        title: role,
      })),
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 16,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => selectedRoles,
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    getCreationSelectedSkuGenerationRule: () => ({ value: "none", label: "None" }),
    isCreationDraftSet: () => true,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.imageCount, 16);
  assert.deepEqual(set.items.map((item) => item.role), selectedRoles);
  assert.equal(set.items.at(-1).title, "usage-suggestion");
});

test("creation suite queue falls back to normalized visual language labels", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [],
    buildCreationSkuSubjectPayload: () => [],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: false },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    getCreationCurrentSet: () => null,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [{ itemId: "hero", role: "main" }],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 4,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedRoles: () => [{ itemId: "hero", role: "main" }],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    isCreationDraftSet: () => false,
    normalizeCreationSkuBundleCountForPayload: (value) => Number(value),
    normalizeCreationVisualLanguage: (value) => ({ value, label: "Reference style" }),
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "reference-style" },
    },
    sellingPoints: [],
  });

  assert.equal(set.visualLanguage, "reference-style");
  assert.equal(set.visualLanguageLabel, "Reference style");
});

test("creation suite queue renders selectable active and queued suites", () => {
  const originalDocument = globalThis.document;
  globalThis.document = { createElement: createFakeElement };
  try {
    const strip = createFakeElement("div");
    renderCreationQueueStrip({
      strip,
      queueJobs: [
        { id: "active", status: "running", createdAt: "2026-05-26T08:00:00.000Z", set: { productName: "Active", status: "generating", items: [] } },
        { id: "queued", status: "queued", createdAt: "2026-05-26T08:01:00.000Z", set: { productName: "Queued", status: "queued", items: [] } },
        { id: "completed", status: "completed", createdAt: "2026-05-26T08:02:00.000Z", set: { productName: "Completed", status: "completed", items: [] } },
      ],
      selectedQueueId: "queued",
      normalizeSet,
      getProgressSummary: () => ({ completed: 0, total: 4 }),
      getStatusLabel: (status) => status,
      formatClock: () => "16:00",
    });

    assert.equal(strip.classList.contains("hidden"), false);
    assert.equal(strip.children.length, 3);
    assert.equal(strip.children[0].dataset.creationQueueId, "active");
    assert.equal(strip.children[0].children[0].textContent, "队列一");
    assert.equal(strip.children[0].classList.contains("is-active"), true);
    assert.equal(strip.children[0].classList.contains("is-selected"), false);
    assert.equal(strip.children[1].dataset.creationQueueId, "queued");
    assert.equal(strip.children[1].children[0].textContent, "队列二");
    assert.equal(strip.children[1].classList.contains("is-selected"), true);
    assert.equal(strip.children[1].attributes["aria-pressed"], "true");
    assert.equal(strip.children[1].children[2].textContent, "0/4");
    assert.equal(strip.children[2].children[0].textContent, "队列三");
    assert.equal(strip.children[2].children[1].textContent, "已完成");
  } finally {
    globalThis.document = originalDocument;
  }
});

test("creation suite queue syncs repaired sets back into matching completed queue jobs", () => {
  const creationState = {
    activeQueueId: "",
    queue: [
      {
        id: "creation-queue-1",
        status: "completed",
        set: {
          setId: "set-a",
          productName: "A",
          items: [{ itemId: "material", status: "failed", error: "HTTP 504" }],
        },
      },
    ],
    selectedQueueId: "creation-queue-1",
  };

  syncActiveCreationQueueSet(
    creationState,
    {
      setId: "set-a",
      productName: "A",
      items: [{ itemId: "material", status: "generating", error: "" }],
    },
    normalizeSet,
  );

  assert.equal(creationState.queue[0].set.items[0].status, "generating");
  assert.equal(creationState.queue[0].set.items[0].error, "");
});

test("creation suite queue selection previews queued sets without replacing the active draft", () => {
  const draftSet = {
    setId: "creation-draft-active",
    productName: "Draft product",
    items: [{ itemId: "draft-hero", status: "idle" }],
  };
  const queuedSet = {
    setId: "creation-local-queued",
    productName: "Queued product",
    items: [{ itemId: "queued-hero", status: "queued" }],
  };
  const creationState = {
    activeQueueId: "",
    currentSet: draftSet,
    generating: false,
    queue: [],
    selectedQueueId: "",
  };

  const job = createCreationQueueJob({
    creationState,
    formData: "queued-body",
    idFactory: () => "creation-queue-preview",
    normalizeSet,
    nowIso: () => "2026-05-26T08:00:00.000Z",
    set: queuedSet,
  });

  assert.equal(job.id, "creation-queue-preview");
  assert.equal(creationState.selectedQueueId, "creation-queue-preview");
  assert.equal(creationState.queue[0].set.setId, "creation-local-queued");
  assert.equal(creationState.currentSet.setId, "creation-draft-active");
  assert.equal(creationState.currentSet.items[0].itemId, "draft-hero");
});

test("creation suite queue resolves repair target from selected queue instead of current active set", () => {
  const currentActiveSet = {
    setId: "set-c",
    productName: "Queue C",
    items: [{ itemId: "c-material", status: "failed" }],
  };
  const creationState = {
    activeQueueId: "queue-c",
    selectedQueueId: "queue-b",
    queue: [
      {
        id: "queue-b",
        status: "completed",
        set: {
          setId: "set-b",
          productName: "Queue B",
          items: [{ itemId: "b-material", status: "failed" }],
        },
      },
      {
        id: "queue-c",
        status: "failed",
        set: currentActiveSet,
      },
    ],
  };

  const target = getCreationRepairTargetSet(creationState, currentActiveSet, normalizeSet);

  assert.equal(target.setId, "set-b");
  assert.equal(target.items[0].itemId, "b-material");
});

test("creation suite queue schedules queued sets serially", async () => {
  const creationState = {
    activeQueueId: "",
    autoRepairAttemptCount: 2,
    currentSet: null,
    editingItemId: "hero",
    generating: false,
    generationScope: "",
    queue: [],
    selectedQueueId: "",
  };
  let idIndex = 0;
  let nowIndex = 0;
  let releaseFirstStream;
  let releaseSecondStream;
  const firstStreamDone = new Promise((resolve) => {
    releaseFirstStream = resolve;
  });
  const secondStreamDone = new Promise((resolve) => {
    releaseSecondStream = resolve;
  });
  const streamBodies = [];
  let renderCount = 0;
  let loadCount = 0;

  createCreationQueueJob({
    creationState,
    formData: "first-body",
    idFactory: (prefix) => `${prefix}-${++idIndex}`,
    normalizeSet,
    nowIso: () => "2026-05-26T08:00:00.000Z",
    set: { setId: "set-a", productName: "A", items: [{ itemId: "main", status: "queued" }] },
  });
  const secondJob = createCreationQueueJob({
    creationState,
    formData: "second-body",
    idFactory: (prefix) => `${prefix}-${++idIndex}`,
    normalizeSet,
    nowIso: () => "2026-05-26T08:01:00.000Z",
    set: { setId: "set-b", productName: "B", items: [{ itemId: "main", status: "queued" }] },
  });

  const context = {
    creationState,
    compactErrorMessage: (message) => message,
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/creation/generate");
      return { ok: true, body: options.body };
    },
    loadCreationSets: async () => {
      loadCount += 1;
    },
    normalizeSet,
    nowIso: () => `2026-05-26T08:0${++nowIndex}:00.000Z`,
    render: () => {
      renderCount += 1;
    },
    runCreationStream: async (response) => {
      streamBodies.push(response.body);
      if (response.body === "first-body") {
        await firstStreamDone;
      } else if (response.body === "second-body") {
        await secondStreamDone;
      }
    },
    setFeedback: () => {},
    showError: () => {},
  };

  assert.equal(getPendingCreationQueueCount(creationState), 2);
  assert.equal(selectCreationQueueJob(creationState, secondJob.id), true);
  assert.equal(creationState.selectedQueueId, secondJob.id);

  scheduleCreationGenerationQueue(context);
  await waitFor(() => creationState.activeQueueId === "creation-queue-1", "first queue job to run");
  assert.equal(creationState.generating, true);
  assert.deepEqual(streamBodies, ["first-body"]);
  assert.equal(getPendingCreationQueueCount(creationState), 1);

  releaseFirstStream();
  await waitFor(
    () =>
      streamBodies.length === 2 &&
      creationState.queue.length === 2 &&
      creationState.queue[0].status === "completed" &&
      creationState.queue[1].status === "running",
    "first queue job to stay while second starts",
  );
  assert.deepEqual(creationState.queue.map((entry) => entry.id), ["creation-queue-1", "creation-queue-2"]);
  assert.equal(selectCreationQueueJob(creationState, "creation-queue-1"), true);
  assert.equal(creationState.selectedQueueId, "creation-queue-1");

  releaseSecondStream();
  await waitFor(
    () =>
      streamBodies.length === 2 &&
      creationState.queue.length === 2 &&
      creationState.queue.every((entry) => entry.status === "completed") &&
      creationState.generating === false,
    "queued jobs to finish",
  );

  assert.deepEqual(streamBodies, ["first-body", "second-body"]);
  assert.deepEqual(creationState.queue.map((entry) => entry.id), ["creation-queue-1", "creation-queue-2"]);
  assert.equal(loadCount, 2);
  assert.equal(renderCount >= 4, true);
  assert.equal(creationState.activeQueueId, "");
  assert.equal(creationState.generationScope, "");
  assert.equal(creationState.selectedQueueId, "creation-queue-1");
});

test("creation suite queue starts the next suite when a running suite frees item capacity", async () => {
  const creationState = {
    activeQueueId: "queue-a",
    autoRepairAttemptCount: 0,
    currentSet: null,
    editingItemId: "",
    generating: true,
    generationScope: "full",
    queue: [
      {
        id: "queue-a",
        status: "running",
        formData: "first-body",
        set: {
          setId: "set-a",
          productName: "A",
          items: [
            { itemId: "a-1", status: "completed" },
            ...Array.from({ length: 17 }, (_, index) => ({ itemId: `a-${index + 2}`, status: "generating" })),
          ],
        },
      },
      {
        id: "queue-b",
        status: "queued",
        formData: "second-body",
        set: {
          setId: "set-b",
          productName: "B",
          items: Array.from({ length: 18 }, (_, index) => ({ itemId: `b-${index + 1}`, status: "queued" })),
        },
      },
    ],
    selectedQueueId: "queue-a",
  };
  const streamOptions = [];

  scheduleCreationGenerationQueue({
    creationState,
    compactErrorMessage: (message) => message,
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/creation/generate");
      assert.equal(options.body, "second-body");
      return { ok: true, body: options.body };
    },
    getMaxParallelTasks: () => 18,
    loadCreationSets: async () => {},
    normalizeSet,
    nowIso: () => "2026-05-26T08:00:00.000Z",
    render: () => {},
    runCreationStream: async (_response, options) => {
      streamOptions.push(options);
    },
    setFeedback: () => {},
    showError: () => {},
  });

  await waitFor(() => creationState.queue[1].status === "completed", "second suite to run after capacity opens");
  assert.equal(creationState.queue[0].status, "running");
  assert.equal(creationState.queue[1].status, "completed");
  assert.equal(streamOptions.length, 1);
  assert.equal(streamOptions[0].queueJob.id, "queue-b");
  assert.equal(typeof streamOptions[0].onEventHandled, "function");
});

test("creation suite queued repair form data keeps the queued suite reference files", () => {
  const source = new FormData();
  source.set("productName", "Queued product");
  source.set("referenceImageRoles", JSON.stringify([{ filename: "queue-a.png", role: "product" }]));
  source.append("referenceImages", new Blob(["queue-a"], { type: "image/png" }), "queue-a.png");
  source.append("styleReferenceImages", new Blob(["style-a"], { type: "image/png" }), "style-a.png");

  const repairData = buildCreationQueuedRepairFormData(
    {
      formData: source,
      set: { setId: "set-a" },
    },
    {
      scope: "incomplete",
      set: { setId: "set-a" },
    },
  );

  assert.equal(repairData.get("setId"), "set-a");
  assert.equal(repairData.get("scope"), "incomplete");
  assert.equal(repairData.get("productName"), "Queued product");
  assert.deepEqual(repairData.getAll("referenceImages").map((file) => file.name), ["queue-a.png"]);
  assert.deepEqual(repairData.getAll("styleReferenceImages").map((file) => file.name), ["style-a.png"]);
});
