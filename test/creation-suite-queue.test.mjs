import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreationQueuedRepairFormData,
  buildCreationQueuedSet,
  createCreationQueueJob,
  getCreationRepairTargetSet,
  getPendingCreationQueueCount,
  renderCreationQueueStrip,
  runCreationQueuedJob,
  scheduleCreationGenerationQueue,
  selectCreationQueueJob,
  syncActiveCreationQueueSet,
} from "../lib/creation-suite-queue.mjs";
import * as creationSuiteQueue from "../lib/creation-suite-queue.mjs";

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
    getFrozenCreationEffectivePlan: () => ({
      productName: "Queued product",
      productDescription: "Description",
      sellingPoints: ["Point A"],
      platform: "amazon",
      platformLabel: "Amazon",
      targetLanguage: "en",
      targetLanguageLabel: "English",
      effectiveAudienceStrategy: { targetAudience: "comparison-focused buyers" },
      items: [{
        itemId: "hero",
        role: "hero",
        itemKind: "carousel",
        prompt: "Frozen prompt",
        ratio: "4:3",
        resolutionTier: "2048x1536",
        targetLanguage: "en",
        conversionIntent: { conversionGoal: "recognition" },
      }],
    }),
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
    getCreationSelectedPlatform: () => ({ value: "amazon", label: "Amazon" }),
    getCreationSelectedRoles: () => [{ itemId: "hero", role: "main" }],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    getCreationSelectedSkuGenerationRule: () => ({ value: "package-list", label: "显示清单" }),
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
      creationVisualLanguageInput: { value: "premium-studio" },
    },
    sellingPoints: ["point"],
  });

  assert.match(set.setId, /^creation-local-/);
  assert.equal(set.productName, "Queued product");
  assert.equal(set.dimensionUnitModeLabel, "Unit both");
  assert.equal(set.platform, "amazon");
  assert.equal(set.platformLabel, "Amazon");
  assert.equal(set.visualLanguage, "premium-studio");
  assert.equal(set.visualLanguageLabel, "Visual premium-studio");
  assert.deepEqual(set.referenceImageNames, ["reference-a.png"]);
  assert.deepEqual(set.referenceImageRoles, [{ id: "ref-1", role: "product" }]);
  assert.deepEqual(set.skuSubjects, [{ id: "sku-a", title: "SKU A", filenames: ["sku-a.jpg"] }]);
  assert.equal(set.skuGenerationRule, "package-list");
  assert.equal(set.skuGenerationRuleLabel, "显示清单");
  assert.deepEqual(set.logo, { placement: "top-left" });
  assert.equal(set.skuBundleCount, 2);
  assert.equal(set.items[0].status, "queued");
  assert.equal(set.items[0].prompt, "Frozen prompt");
  assert.equal(set.items[0].ratio, "4:3");
  assert.equal(set.items[0].resolutionTier, "2048x1536");
  assert.equal(set.items[0].targetLanguage, "en");
  assert.equal(set.items[0].conversionIntent.conversionGoal, "recognition");
  assert.equal(set.effectivePlan.effectiveAudienceStrategy.targetAudience, "comparison-focused buyers");
});

test("creation suite queue reads the editable draft while another set is generating", () => {
  const draftSet = {
    setId: "creation-draft-next",
    infographicRebuildEnabled: false,
    items: [{ itemId: "draft-hero", role: "hero", prompt: "Next draft prompt" }],
  };
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [],
    buildCreationSkuSubjectPayload: () => [],
    createdAt: "2026-07-17T08:00:00.000Z",
    creationState: { generating: true },
    formatCreationDimensionUnitModeLabel: (value) => value,
    getCreationCurrentSet: () => ({ setId: "active-18", items: Array.from({ length: 18 }) }),
    getCreationDraftSet: () => draftSet,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [{ itemId: "fallback", role: "hero" }],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 1,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedPlatform: () => ({ value: "universal", label: "通用电商" }),
    getCreationSelectedRoles: () => ["hero"],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    isCreationDraftSet: (set) => set?.setId?.startsWith("creation-draft-"),
    normalizeCreationSkuBundleCountForPayload: Number,
    normalizeCreationVisualLanguage: (value) => value || "classic-commercial",
    normalizeSet,
    productDescription: "Next description",
    productName: "Next product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationInfographicRebuildEnabledInput: { checked: false },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.items.length, 1);
  assert.equal(set.items[0].prompt, "Next draft prompt");
  assert.notEqual(set.setId, "active-18");
});

test("creation suite queue appends SKU preview cards to queued sets", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [{ filename: "red.jpg", role: "product" }],
    buildCreationSkuSubjectPayload: () => [
      { id: "red", title: "红色", filenames: ["red.jpg"] },
      { id: "blue", title: "原始蓝色标题", filenames: ["blue.jpg"], colorNames: ["blue", "gray"] },
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
  assert.equal(set.items[2].title, "SKU image 1 - red");
  assert.equal(set.items[3].title, "SKU image 2 - blue / gray");
  assert.equal(set.items[2].filenameToken, "sku-1-red");
  assert.equal(set.items[3].filenameToken, "sku-2-blue-gray");
  assert.equal(set.items[3].itemId, "queued-sku-2");
  assert.equal(set.items[3].status, "queued");
});

test("creation suite queue compacts Chinese same-subject multi-color SKU titles", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [],
    buildCreationSkuSubjectPayload: () => [
      {
        id: "red-black-blue-lure",
        title: "Three-color fishing lure",
        filenames: ["red-black-blue-lure.png"],
        colorNames: ["red black blue"],
      },
    ],
    createdAt: "2026-05-26T08:00:00.000Z",
    creationState: { generating: true },
    formatCreationDimensionUnitModeLabel: (value) => `Unit ${value}`,
    formatCreationVisualLanguageLabel: (value) => `Visual ${value}`,
    getCreationCurrentSet: () => null,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [{ itemId: "hero", role: "hero", title: "主图" }],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 1,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "zh-CN", label: "简体中文" }),
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

  assert.equal(set.items[1].title, "SKU image 1 - 红黑蓝色");
  assert.deepEqual(set.items[1].skuSubject.colorNames, ["red black blue"]);
});

test("creation suite queue omits raw SKU identifiers from titles and filename tokens", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [{ filename: "260526-SKU-151142-5714.png", role: "product" }],
    buildCreationSkuSubjectPayload: () => [{
      id: "F4J16",
      title: "SKU image 2 F4J16",
      filenames: ["260526-SKU-151142-5714.png"],
      referenceIndexes: [1],
    }],
    createdAt: "2026-08-06T08:00:00.000Z",
    creationState: { generating: true },
    formatCreationDimensionUnitModeLabel: (value) => value,
    formatCreationVisualLanguageLabel: (value) => value,
    getCreationCurrentSet: () => null,
    getCreationLogoPayload: () => null,
    getCreationPreviewSlots: () => [{ itemId: "hero", role: "hero", title: "Hero" }],
    getCreationSelectedDimensionUnitMode: () => "both",
    getCreationSelectedImageCount: () => 1,
    getCreationSelectedIndustryTemplate: () => ({ value: "general", label: "General", categoryPath: "" }),
    getCreationSelectedLanguage: () => ({ value: "en", label: "English" }),
    getCreationSelectedPlatform: () => ({ value: "universal", label: "通用电商" }),
    getCreationSelectedRoles: () => ["hero"],
    getCreationSelectedScenario: () => ({ value: "standard", label: "Standard" }),
    isCreationDraftSet: () => false,
    normalizeCreationSkuBundleCountForPayload: Number,
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

  const skuItem = set.items.find((item) => item.role === "sku");
  assert.equal(skuItem.title, "SKU image 1");
  assert.equal(skuItem.filenameToken, "sku-1");
  assert.equal(skuItem.skuSubject.id, "F4J16");
  assert.deepEqual(skuItem.skuSubject.filenames, ["260526-SKU-151142-5714.png"]);
  assert.deepEqual(skuItem.skuSubject.referenceIndexes, [1]);
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
  assert.equal(set.skuGenerationRuleLabel, "显示颜色");
});

test("creation suite queue appends queued rebuild cards when enabled", () => {
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
      creationInfographicRebuildEnabledInput: { checked: true },
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
    index: 3,
  });
  assert.deepEqual(set.items[3].referenceImageNames, ["size-chart.jpg"]);
  assert.deepEqual(set.items[4].referenceImageNames, ["steps.jpg"]);
});

test("creation suite queue defaults infographic rebuild off", () => {
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
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.infographicRebuildEnabled, false);
  assert.deepEqual(set.items.map((item) => item.role), ["hero"]);
});

test("creation suite queue omits appended SKU cards when disabled", () => {
  const set = buildCreationQueuedSet({
    buildCreationReferenceRolePayload: () => [{ filename: "sku-a.jpg", role: "product" }],
    buildCreationSkuSubjectPayload: () => [{ id: "sku-a", title: "SKU A", filenames: ["sku-a.jpg"] }],
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
      creationSkuGenerationEnabledInput: { checked: false },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "classic-commercial" },
    },
    sellingPoints: [],
  });

  assert.equal(set.skuGenerationEnabled, false);
  assert.equal(set.skuSubjects.length, 1);
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
      ["feature-card.jpg"],
      ["package-card.jpg"],
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
      creationInfographicRebuildEnabledInput: { checked: true },
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
    normalizeCreationVisualLanguage: (value) => ({ value, label: "Premium studio" }),
    normalizeSet,
    productDescription: "Description",
    productName: "Queued product",
    refs: {
      creationDimensionSpecsInput: { value: "" },
      creationSkuBundleCountInput: { value: "1" },
      creationVisualLanguageInput: { value: "premium-studio" },
    },
    sellingPoints: [],
  });

  assert.equal(set.visualLanguage, "premium-studio");
  assert.equal(set.visualLanguageLabel, "Premium studio");
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

test("creation suite queue syncs a stable set id without overwriting another active job", () => {
  const creationState = {
    activeQueueId: "job-1",
    queue: [
      { id: "job-1", status: "running", set: { setId: "set-18", items: Array.from({ length: 18 }, (_, index) => ({ itemId: `item-18-${index}` })) } },
      { id: "job-2", status: "running", set: { setId: "set-4", items: Array.from({ length: 4 }, (_, index) => ({ itemId: `item-4-${index}` })) } },
    ],
  };

  syncActiveCreationQueueSet(
    creationState,
    { setId: "set-4", items: Array.from({ length: 4 }, (_, index) => ({ itemId: `updated-4-${index}` })) },
    normalizeSet,
  );

  assert.equal(creationState.queue[0].set.setId, "set-18");
  assert.equal(creationState.queue[0].set.items.length, 18);
  assert.equal(creationState.queue[1].set.setId, "set-4");
  assert.equal(creationState.queue[1].set.items.length, 4);
  assert.equal(creationState.queue[1].set.items[0].itemId, "updated-4-0");
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

test("creation suite queue only synchronizes the explicitly selected job", () => {
  assert.equal(typeof creationSuiteQueue.shouldSyncCreationQueueJobCurrentSet, "function");
  const creationState = {
    activeQueueId: "queue-a",
    currentSet: { setId: "set-a" },
    queue: [
      { id: "queue-a", status: "running", set: { setId: "set-a" } },
      { id: "queue-b", status: "running", set: { setId: "set-b" } },
    ],
    selectedQueueId: "queue-b",
  };

  assert.equal(creationSuiteQueue.shouldSyncCreationQueueJobCurrentSet(creationState, creationState.queue[0]), false);
  assert.equal(creationSuiteQueue.shouldSyncCreationQueueJobCurrentSet(creationState, creationState.queue[1]), true);
});

test("creation suite queue synchronizes the active job when no job is selected", () => {
  const creationState = {
    activeQueueId: "queue-a",
    currentSet: null,
    queue: [
      { id: "queue-a", status: "running", set: { setId: "set-a" } },
      { id: "queue-b", status: "running", set: { setId: "set-b" } },
    ],
    selectedQueueId: "",
  };

  assert.equal(creationSuiteQueue.shouldSyncCreationQueueJobCurrentSet(creationState, creationState.queue[0]), true);
  assert.equal(creationSuiteQueue.shouldSyncCreationQueueJobCurrentSet(creationState, creationState.queue[1]), false);
});

test("creation suite queue selection switches a queue-backed current set", () => {
  const creationState = {
    activeQueueId: "queue-a",
    currentSet: { setId: "set-a", productName: "A" },
    queue: [
      { id: "queue-a", status: "running", set: { setId: "set-a", productName: "A" } },
      { id: "queue-b", status: "running", set: { setId: "set-b", productName: "B" } },
    ],
    selectedQueueId: "queue-a",
  };

  assert.equal(selectCreationQueueJob(creationState, "queue-b"), true);
  assert.equal(creationState.selectedQueueId, "queue-b");
  assert.equal(creationState.currentSet.setId, "set-b");
  assert.equal(creationState.currentSet.productName, "B");
});

test("creation suite queue keeps the selected panel during another job lifecycle", async () => {
  async function runCase({ fetchImpl, runCreationStream } = {}) {
    const selectedSet = { setId: "set-b", productName: "B", items: [] };
    const activeJob = {
      id: "queue-a",
      status: "queued",
      formData: "active-body",
      set: { setId: "set-a", productName: "A", items: [{ itemId: "a-item", status: "queued" }] },
    };
    const creationState = {
      activeQueueId: "queue-a",
      currentSet: selectedSet,
      generating: true,
      generationScope: "full",
      queue: [activeJob, { id: "queue-b", status: "running", set: selectedSet }],
      selectedQueueId: "queue-b",
    };

    const streamRunner = runCreationStream || (async (_response, context) => {
      activeJob.set = normalizeSet({
        ...activeJob.set,
        status: "completed",
        items: activeJob.set.items.map((item) => ({ ...item, status: "completed" })),
      });
      await context.onEventHandled("complete", { set: activeJob.set });
    });
    await runCreationQueuedJob(activeJob, {
      creationState,
      compactErrorMessage: (message) => message,
      fetchImpl,
      loadCreationSets: async () => {},
      normalizeSet,
      nowIso: () => "2026-07-12T08:00:00.000Z",
      render: () => {},
      runCreationStream: streamRunner,
      setFeedback: () => {},
      showError: () => {},
    });
    return { activeJob, creationState };
  }

  const started = await runCase({
    fetchImpl: async () => ({ ok: true, body: {} }),
  });
  assert.equal(started.creationState.currentSet.setId, "set-b");

  const completed = await runCase({
    fetchImpl: async () => ({ ok: true, body: {} }),
  });
  assert.equal(completed.activeJob.status, "completed");
  assert.equal(completed.creationState.currentSet.setId, "set-b");

  const failed = await runCase({
    fetchImpl: async () => {
      throw new Error("active failed");
    },
  });
  assert.equal(failed.activeJob.status, "failed");
  assert.equal(failed.creationState.currentSet.setId, "set-b");
});

test("creation suite queue does not convert an SSE error into completion", async () => {
  const job = {
    id: "queue-error",
    status: "queued",
    formData: "body",
    set: { setId: "set-error", items: [{ itemId: "hero", status: "queued" }] },
  };
  const creationState = {
    activeQueueId: "",
    currentSet: job.set,
    generating: false,
    generationScope: "",
    queue: [job],
    selectedQueueId: job.id,
  };

  await runCreationQueuedJob(job, {
    creationState,
    compactErrorMessage: (message) => message,
    fetchImpl: async () => ({ ok: true, body: {} }),
    loadCreationSets: async () => {},
    normalizeSet,
    nowIso: () => "2026-07-18T08:00:00.000Z",
    render: () => {},
    runAutoRepairIfNeeded: async () => false,
    runCreationStream: async (_response, context) => {
      job.set = normalizeSet({
        ...job.set,
        status: "failed",
        items: job.set.items.map((item) => ({ ...item, status: "failed", error: "upstream failed" })),
      });
      await context.onEventHandled("error", { message: "upstream failed" });
    },
    setFeedback: () => {},
    showError: () => {},
  });

  assert.equal(job.status, "failed");
  assert.equal(job.set.status, "failed");
  assert.equal(job.set.items[0].status, "failed");
});

test("creation suite queue treats an SSE stream without a terminal event as interrupted", async () => {
  const job = {
    id: "queue-interrupted",
    status: "queued",
    formData: "body",
    set: { setId: "set-interrupted", items: [{ itemId: "hero", status: "queued" }] },
  };
  const creationState = {
    activeQueueId: "",
    currentSet: job.set,
    generating: false,
    generationScope: "",
    queue: [job],
    selectedQueueId: job.id,
  };

  await runCreationQueuedJob(job, {
    creationState,
    compactErrorMessage: (message) => message,
    fetchImpl: async () => ({ ok: true, body: {} }),
    loadCreationSets: async () => {},
    normalizeSet,
    nowIso: () => "2026-07-18T08:00:00.000Z",
    render: () => {},
    runCreationStream: async () => {},
    setFeedback: () => {},
    showError: () => {},
  });

  assert.equal(job.status, "failed");
  assert.equal(job.set.status, "failed");
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
    runCreationStream: async (response, options) => {
      streamBodies.push(response.body);
      if (response.body === "first-body") {
        await firstStreamDone;
      } else if (response.body === "second-body") {
        await secondStreamDone;
      }
      const job = options.queueJob;
      job.set = normalizeSet({
        ...job.set,
        status: "completed",
        items: job.set.items.map((item) => ({ ...item, status: "completed" })),
      });
      await options.onEventHandled("complete", { set: job.set });
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

test("creation suite queue keeps one scheduling snapshot for an active batch", () => {
  const creationState = {
    activeQueueId: "",
    currentSet: null,
    generating: false,
    generationScope: "",
    queue: [],
    selectedQueueId: "",
  };
  const firstFormData = new FormData();
  firstFormData.set("generationConcurrency", "03");
  firstFormData.set("generationStartDelayMs", "0750");

  createCreationQueueJob({
    creationState,
    formData: firstFormData,
    idFactory: (prefix) => `${prefix}-1`,
    normalizeSet,
    nowIso: () => "2026-05-26T08:00:00.000Z",
    set: { setId: "set-a", items: [{ itemId: "a", status: "queued" }] },
  });

  assert.deepEqual(creationState.schedulingSnapshot, {
    generationConcurrency: "03",
    generationStartDelayMs: "0750",
  });

  const secondFormData = new FormData();
  secondFormData.set("generationConcurrency", "9");
  secondFormData.set("generationStartDelayMs", "100");
  createCreationQueueJob({
    creationState,
    formData: secondFormData,
    idFactory: (prefix) => `${prefix}-2`,
    normalizeSet,
    nowIso: () => "2026-05-26T08:01:00.000Z",
    set: { setId: "set-b", items: [{ itemId: "b", status: "queued" }] },
  });

  assert.equal(secondFormData.get("generationConcurrency"), "03");
  assert.equal(secondFormData.get("generationStartDelayMs"), "0750");

  creationState.queue.forEach((job) => {
    job.status = "completed";
  });
  scheduleCreationGenerationQueue({ creationState, render: () => {} });
  assert.equal(creationState.schedulingSnapshot, undefined);
});

test("creation suite queue waits for automatic repair before starting the next suite", async () => {
  const creationState = {
    activeQueueId: "",
    autoRepairAttemptCount: 0,
    currentSet: null,
    generating: false,
    generationScope: "",
    queue: [
      {
        id: "queue-a",
        status: "queued",
        formData: "first-body",
        set: {
          setId: "set-a",
          productName: "A",
          items: Array.from({ length: 18 }, (_, index) => ({ itemId: `a-${index + 1}`, status: "queued" })),
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
  let releaseFirstRepair;
  let markFirstRepairStarted;
  const firstRepairDone = new Promise((resolve) => {
    releaseFirstRepair = resolve;
  });
  const firstRepairStarted = new Promise((resolve) => {
    markFirstRepairStarted = resolve;
  });
  const streamBodies = [];

  scheduleCreationGenerationQueue({
    creationState,
    compactErrorMessage: (message) => message,
    fetchImpl: async (url, options) => {
      assert.equal(url, "/api/creation/generate");
      assert.ok(["first-body", "second-body"].includes(options.body));
      return { ok: true, body: options.body };
    },
    loadCreationSets: async () => {},
    normalizeSet,
    nowIso: () => "2026-05-26T08:00:00.000Z",
    render: () => {},
    runAutoRepairIfNeeded: async (job) => {
      if (job.id !== "queue-a") {
        return false;
      }
      markFirstRepairStarted();
      await firstRepairDone;
      job.set = normalizeSet({
        ...job.set,
        status: "completed",
        items: job.set.items.map((item) => ({ ...item, status: "completed" })),
      });
      return true;
    },
    runCreationStream: async (response, options) => {
      streamBodies.push(response.body);
      options.queueJob.set = normalizeSet({
        ...options.queueJob.set,
        status: "completed",
        items: options.queueJob.set.items.map((item, index) => ({
          ...item,
          status: response.body === "first-body" && index === 0 ? "failed" : "completed",
        })),
      });
      await options.onEventHandled("complete", { set: options.queueJob.set });
    },
    setFeedback: () => {},
    showError: () => {},
  });

  await firstRepairStarted;
  assert.equal(creationState.queue[0].status, "running");
  assert.equal(creationState.queue[1].status, "queued");
  assert.deepEqual(streamBodies, ["first-body"]);
  assert.ok(creationState.queue[0].set.items.every((item) => item.status === "completed" || item.status === "failed"));

  releaseFirstRepair();
  await waitFor(() => creationState.queue[1].status === "completed", "second suite to run after automatic repair finishes");
  assert.deepEqual(streamBodies, ["first-body", "second-body"]);
});

// A genuine balance failure. A relay's "capacity temporarily unavailable" 402 is
// vetoed by the classifier and must not take the queue down, which the sibling
// transient test below covers.
const QUOTA_ERROR = "生成请求失败：HTTP 402，错误码 insufficient_quota，You exceeded your current quota, please check your plan and billing details.";

function createQuotaQueueFixture() {
  const runningJob = {
    id: "queue-running",
    status: "queued",
    formData: "running-body",
    set: { setId: "set-running", items: [{ itemId: "hero", status: "queued" }] },
  };
  const pendingJobs = [1, 2, 3].map((index) => ({
    id: `queue-pending-${index}`,
    status: "queued",
    formData: `pending-body-${index}`,
    set: {
      setId: `set-pending-${index}`,
      items: [
        { itemId: `p${index}-a`, status: "queued" },
        { itemId: `p${index}-b`, status: "completed" },
      ],
    },
  }));

  return {
    runningJob,
    pendingJobs,
    creationState: {
      activeQueueId: "",
      currentSet: runningJob.set,
      generating: false,
      generationScope: "",
      queue: [runningJob, ...pendingJobs],
      selectedQueueId: runningJob.id,
    },
  };
}

function createQuotaJobContext(creationState, { itemError, terminalEvent, feedback, errors, startedStreams }) {
  return {
    creationState,
    compactErrorMessage: (message) => message,
    fetchImpl: async () => ({ ok: true, body: {} }),
    // A lowered concurrency is irrelevant here; the point is that no further
    // suite is started at all once the account wall is hit.
    getMaxParallelTasks: () => 18,
    loadCreationSets: async () => {},
    normalizeSet,
    nowIso: () => "2026-08-29T08:00:00.000Z",
    render: () => {},
    runAutoRepairIfNeeded: async () => false,
    runCreationStream: async (_response, context) => {
      startedStreams.push(context.queueJob.id);
      context.queueJob.set = normalizeSet({
        ...context.queueJob.set,
        status: "failed",
        items: context.queueJob.set.items.map((item) => ({ ...item, status: "failed", error: itemError })),
      });
      await context.onEventHandled(terminalEvent, { set: context.queueJob.set });
    },
    setFeedback: (message) => feedback.push(message),
    showError: (message) => errors.push(message),
  };
}

test("an account-level upstream error fails the suites still queued", async () => {
  const { runningJob, pendingJobs, creationState } = createQuotaQueueFixture();
  const feedback = [];
  const errors = [];
  const startedStreams = [];

  await runCreationQueuedJob(
    runningJob,
    createQuotaJobContext(creationState, {
      itemError: QUOTA_ERROR,
      terminalEvent: "complete",
      feedback,
      errors,
      startedStreams,
    }),
  );

  assert.equal(runningJob.status, "failed");
  // The upstream reason surfaces instead of the generic "still incomplete" notice.
  assert.equal(errors.at(-1), QUOTA_ERROR);

  for (const job of pendingJobs) {
    assert.equal(job.status, "failed", `${job.id} must not stay queued`);
    assert.equal(job.set.items[0].status, "failed");
    assert.equal(job.set.items[0].error, QUOTA_ERROR);
    // An already completed item keeps its result.
    assert.equal(job.set.items[1].status, "completed");
    assert.equal(job.set.items[1].error, undefined);
  }

  // Only the running suite ever reached the network; the scheduler found no
  // queued job left to start.
  assert.deepEqual(startedStreams, ["queue-running"]);
  assert.equal(getPendingCreationQueueCount(creationState), 0);
  assert.equal(creationState.generating, false);
});

test("a non-account-level failure leaves the queued suites running", async () => {
  const { runningJob, pendingJobs, creationState } = createQuotaQueueFixture();
  const feedback = [];
  const errors = [];
  const startedStreams = [];

  await runCreationQueuedJob(
    runningJob,
    createQuotaJobContext(creationState, {
      itemError: "生成请求失败：HTTP 429，错误码 rate_limit_exceeded，Rate limit reached.",
      terminalEvent: "complete",
      feedback,
      errors,
      startedStreams,
    }),
  );

  assert.equal(runningJob.status, "failed");
  // Transient failures must not take the rest of the queue down with them.
  await waitFor(
    () => pendingJobs.every((job) => job.status !== "queued"),
    "queued suites to keep being started after a transient failure",
  );
  assert.ok(startedStreams.length > 1, "the scheduler must keep starting queued suites");
});

test("creation suite queued repair form data keeps the queued suite reference files", () => {
  const source = new FormData();
  source.set("productName", "Queued product");
  source.set("referenceImageRoles", JSON.stringify([{ filename: "queue-a.png", role: "product" }]));
  source.append("referenceImages", new Blob(["queue-a"], { type: "image/png" }), "queue-a.png");

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
  assert.equal(repairData.get("autoRepair"), null);
});

test("creation suite queued automatic repair marks its request separately from manual repair", () => {
  const source = new FormData();
  source.set("generationConcurrency", "3");
  source.set("generationStartDelayMs", "750");

  const repairData = buildCreationQueuedRepairFormData(
    { formData: source, set: { setId: "set-a" } },
    { autoRepair: true, scope: "incomplete", set: { setId: "set-a" } },
  );

  assert.equal(repairData.get("autoRepair"), "1");
  assert.equal(repairData.get("generationConcurrency"), "3");
  assert.equal(repairData.get("generationStartDelayMs"), "750");
});
