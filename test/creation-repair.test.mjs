import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCreationRepairOverrides,
  buildCreationRepairPlan,
  hasCreationRepairPlanningOverride,
  hydrateCreationRepairSkuSubjects,
  needsCreationRepairPlanRefresh,
  refreshCreationRepairItemsFromPlan,
  selectCreationRepairItems,
} from "../lib/creation-repair.mjs";

const demoSet = {
  setId: "creation-set-demo",
  items: [
    {
      itemId: "1-hero",
      status: "completed",
      filename: "01-hero.png",
      relativePath: "2026-05/05-06/2026-05-06-creation/demo/01-hero.png",
    },
    {
      itemId: "2-benefit",
      status: "failed",
      filename: "",
      relativePath: "",
    },
    {
      itemId: "3-scene",
      status: "queued",
      filename: "",
      relativePath: "",
    },
    {
      itemId: "4-multi-angle",
      status: "completed",
      filename: "04-multi-angle.png",
      relativePath: "2026-05/05-06/2026-05-06-creation/demo/04-multi-angle.png",
    },
  ],
};

test("creation repair selects one requested item even if it already completed", () => {
  const items = selectCreationRepairItems(demoSet, { itemId: "1-hero" });

  assert.deepEqual(
    items.map((item) => item.itemId),
    ["1-hero"],
  );
});

test("creation repair selects failed items by default", () => {
  const items = selectCreationRepairItems(demoSet, {});

  assert.deepEqual(
    items.map((item) => item.itemId),
    ["2-benefit"],
  );
});

test("creation repair can select all incomplete or missing items", () => {
  const items = selectCreationRepairItems(demoSet, { scope: "incomplete" });

  assert.deepEqual(
    items.map((item) => item.itemId),
    ["2-benefit", "3-scene"],
  );
});

test("creation repair treats Cloudflare-completed image URLs as complete for incomplete scope", () => {
  const items = selectCreationRepairItems(
    {
      items: [
        {
          itemId: "cloudflare-done",
          status: "completed",
          filename: "cloudflare-done.png",
          relativePath: "",
          imageUrl: "https://images.example/cloudflare-done.png",
          storageKey: "creation/cloudflare-done.png",
        },
        {
          itemId: "failed",
          status: "failed",
          filename: "",
          relativePath: "",
        },
      ],
    },
    { scope: "incomplete" },
  );

  assert.deepEqual(items.map((item) => item.itemId), ["failed"]);
});

test("creation repair treats completed items without filenames as incomplete", () => {
  const items = selectCreationRepairItems(
    {
      items: [
        {
          itemId: "1-hero",
          status: "completed",
          filename: "",
          relativePath: "2026-05/05-06/2026-05-06-creation/demo/01-hero.png",
        },
      ],
    },
    { scope: "incomplete" },
  );

  assert.deepEqual(
    items.map((item) => item.itemId),
    ["1-hero"],
  );
});

test("creation repair treats reconciled missing assets as incomplete", () => {
  const items = selectCreationRepairItems(
    {
      items: [
        {
          itemId: "missing-file",
          status: "completed",
          filename: "missing-file.png",
          relativePath: "2026-05/05-06/2026-05-06-creation/demo/missing-file.png",
          missingAsset: true,
        },
      ],
    },
    { scope: "incomplete" },
  );

  assert.deepEqual(
    items.map((item) => item.itemId),
    ["missing-file"],
  );
});

test("creation repair applies non-empty prompt and copy overrides", () => {
  const item = applyCreationRepairOverrides(
    {
      itemId: "1-hero",
      prompt: "Original prompt",
      marketingCopy: "Original copy",
    },
    {
      promptOverride: "  Make the product larger and add clear usage steps.  ",
      marketingCopyOverride: "  三步冲煮  ",
    },
  );

  assert.equal(item.prompt, "Make the product larger and add clear usage steps.");
  assert.equal(item.marketingCopy, "三步冲煮");
});

test("creation repair keeps existing prompt when overrides are blank", () => {
  const item = applyCreationRepairOverrides(
    {
      itemId: "1-hero",
      prompt: "Original prompt",
      marketingCopy: "Original copy",
    },
    {
      promptOverride: "   ",
      marketingCopyOverride: "",
    },
  );

  assert.equal(item.prompt, "Original prompt");
  assert.equal(item.marketingCopy, "Original copy");
});

test("creation repair preserves frozen per-item conversion intent", () => {
  const [item] = refreshCreationRepairItemsFromPlan(
    [{ itemId: "benefit", role: "benefit", prompt: "Frozen prompt" }],
    {
      __frozenEffectivePlan: true,
      items: [{
        itemId: "benefit",
        role: "benefit",
        conversionIntent: { conversionGoal: "用证据降低顾虑", objectionFocus: "担心尺寸" },
      }],
    },
  );
  assert.deepEqual(item.conversionIntent, { conversionGoal: "用证据降低顾虑", objectionFocus: "担心尺寸" });
});

test("legacy creation repair ignores current form planning values and preserves saved items", () => {
  const set = {
    productName: "Saved product",
    productDescription: "Saved description",
    sellingPoints: ["saved selling point"],
    imageCount: 1,
    carouselImageCount: 1,
    platform: "universal",
    targetLanguage: "en",
    visualLanguage: "classic-commercial",
    items: [{
      itemId: "saved-hero",
      slotIndex: 1,
      itemKind: "carousel",
      role: "hero",
      prompt: "Saved frozen prompt.",
      ratio: "1:1",
      effectiveSize: "1536x1536",
      targetLanguage: "en",
      status: "failed",
    }],
  };

  const plan = buildCreationRepairPlan(set, {
    productName: "Current draft product",
    platform: "amazon",
    targetLanguage: "zh-CN",
    visualLanguage: "warm-handcrafted",
  });
  const [item] = refreshCreationRepairItemsFromPlan(set.items, plan);

  assert.equal(plan.__frozenEffectivePlan, true);
  assert.equal(plan.productName, "Saved product");
  assert.equal(plan.platform, "universal");
  assert.equal(plan.targetLanguage, "en");
  assert.equal(plan.visualLanguage, "classic-commercial");
  assert.equal(item.prompt, "Saved frozen prompt.");
  assert.equal(item.ratio, "1:1");
  assert.equal(item.effectiveSize, "1536x1536");
});

test("creation repair freeze marker is not serialized with the effective plan", () => {
  const plan = buildCreationRepairPlan({
    productName: "Saved product",
    imageCount: 1,
    items: [{ itemId: "saved-hero", slotIndex: 1, role: "hero", prompt: "Saved prompt" }],
  });

  assert.equal(plan.__frozenEffectivePlan, true);
  assert.equal(Object.keys(plan).includes("__frozenEffectivePlan"), false);
  assert.equal(JSON.stringify(plan).includes("__frozenEffectivePlan"), false);
});

test("creation repair generation keeps the saved route and model snapshot", async () => {
  const { resolveCreationRepairGenerationConfig } = await import("../lib/creation-repair.mjs");
  const resolved = resolveCreationRepairGenerationConfig({
    baseUrl: "https://saved.example/v1",
    imageRoute: "route-b",
    responsesModel: "saved-responses",
    imageModel: "saved-image",
    endpointPath: "images/generations",
  }, {
    apiKey: "current-secret",
    baseUrl: "https://current.example/v1",
    imageRoute: "route-c",
    responsesModel: "current-responses",
    imageModel: "current-image",
    endpointPath: "chat/completions",
  });

  assert.deepEqual(resolved, {
    apiKey: "current-secret",
    baseUrl: "https://saved.example/v1",
    imageRoute: "route-b",
    responsesModel: "saved-responses",
    imageModel: "saved-image",
    endpointPath: "images/generations",
  });
});

test("creation repair ignores the current visual language and keeps the saved prompt", () => {
  const set = {
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure for bass fishing",
    sellingPoints: ["realistic swim action"],
    targetLanguage: "en",
    imageCount: 2,
    scenario: "standard",
    visualLanguage: "classic-commercial",
    industryTemplate: "general",
    selectedRoles: ["hero", "scene"],
    items: [
      {
        itemId: "2-scene",
        slotIndex: 2,
        role: "scene",
        title: "Scene image",
        prompt: "Old scene prompt with polished commercial lighting.",
        status: "failed",
      },
    ],
  };

  assert.equal(hasCreationRepairPlanningOverride(set, { visualLanguage: "warm-handcrafted" }), true);
  assert.equal(hasCreationRepairPlanningOverride(set, { visualLanguage: "classic-commercial" }), false);

  const plan = buildCreationRepairPlan(set, { visualLanguage: "warm-handcrafted" });
  const [item] = refreshCreationRepairItemsFromPlan(set.items, plan);

  assert.equal(plan.visualLanguage, "classic-commercial");
  assert.equal(item.prompt, "Old scene prompt with polished commercial lighting.");
});

test("creation repair ignores the current platform and keeps the saved prompt", () => {
  const set = {
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure for bass fishing",
    sellingPoints: ["realistic swim action"],
    targetLanguage: "en",
    imageCount: 2,
    platform: "universal",
    scenario: "standard",
    visualLanguage: "classic-commercial",
    industryTemplate: "general",
    selectedRoles: ["hero", "scene"],
    items: [
      {
        itemId: "1-hero",
        slotIndex: 1,
        role: "hero",
        title: "Hero image",
        prompt: "Old universal platform prompt.",
        status: "failed",
      },
    ],
  };

  assert.equal(hasCreationRepairPlanningOverride(set, { platform: "amazon" }), true);
  assert.equal(hasCreationRepairPlanningOverride(set, { platform: "universal" }), false);

  const plan = buildCreationRepairPlan(set, { platform: "amazon" });
  const [item] = refreshCreationRepairItemsFromPlan(set.items, plan);

  assert.equal(plan.platform, "universal");
  assert.equal(item.prompt, "Old universal platform prompt.");
});

test("creation repair ignores current selling points and keeps the saved prompt", () => {
  const set = {
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure for bass fishing",
    sellingPoints: ["old swim action"],
    targetLanguage: "en",
    imageCount: 1,
    scenario: "standard",
    visualLanguage: "classic-commercial",
    industryTemplate: "general",
    selectedRoles: ["hero"],
    items: [
      {
        itemId: "1-hero",
        slotIndex: 1,
        role: "hero",
        title: "Hero image",
        prompt: "Old hero prompt with the old swim action.",
        status: "completed",
      },
    ],
  };

  assert.equal(hasCreationRepairPlanningOverride(set, { sellingPoints: "new silent rattle chamber" }), true);

  const plan = buildCreationRepairPlan(set, { sellingPoints: "new silent rattle chamber" });
  const [item] = refreshCreationRepairItemsFromPlan(set.items, plan);

  assert.deepEqual(plan.sellingPoints, ["old swim action"]);
  assert.equal(item.prompt, "Old hero prompt with the old swim action.");
});

test("creation repair rehydrates SKU subject metadata from legacy set manifests", () => {
  const items = hydrateCreationRepairSkuSubjects(
    [
      {
        itemId: "13-sku-silver",
        slotIndex: 13,
        role: "sku",
        title: "SKU image 1",
        prompt: "Create one SKU product image for Silver lure.",
      },
      {
        itemId: "14-sku-gold",
        slotIndex: 14,
        role: "sku",
        title: "SKU image 2",
        prompt: "Create one SKU product image for Gold lure.",
      },
    ],
    {
      imageCount: 12,
      skuSubjects: [
        {
          id: "silver",
          title: "Silver lure",
          filenames: ["silver-lure.png"],
          referenceIndexes: [1],
          note: "silver body",
          bundleCount: 3,
        },
        {
          id: "gold",
          title: "Gold lure",
          filenames: ["gold-lure.png"],
          referenceIndexes: [2],
          note: "gold body",
          bundleCount: 3,
        },
      ],
    },
  );

  assert.deepEqual(
    items.map((item) => item.skuSubject?.filenames),
    [["silver-lure.png"], ["gold-lure.png"]],
  );
  assert.deepEqual(
    items.map((item) => item.skuSubject?.referenceIndexes),
    [[1], [2]],
  );
});

test("creation repair does not rewrite saved SKU prompts to add a newer series lock", () => {
  const set = {
    productName: "Jointed fishing lure",
    productDescription: "Three sellable lure colorways",
    sellingPoints: ["lifelike swim action"],
    targetLanguage: "en",
    imageCount: 1,
    scenario: "standard",
    visualLanguage: "classic-commercial",
    industryTemplate: "general",
    selectedRoles: ["hero"],
    skuSubjects: [
      {
        id: "silver",
        title: "Silver lure",
        filenames: ["silver-lure.png"],
        referenceIndexes: [1],
        note: "silver body",
      },
      {
        id: "gold",
        title: "Gold lure",
        filenames: ["gold-lure.png"],
        referenceIndexes: [2],
        note: "gold body",
      },
    ],
    items: [
      {
        itemId: "2-sku-silver",
        slotIndex: 2,
        role: "sku",
        title: "SKU image 1",
        prompt: "Old silver SKU prompt.",
        status: "failed",
      },
      {
        itemId: "3-sku-gold",
        slotIndex: 3,
        role: "sku",
        title: "SKU image 2",
        prompt: "Old gold SKU prompt.",
        status: "completed",
      },
    ],
  };

  const plan = buildCreationRepairPlan(set, { visualLanguage: "clean-marketplace" });
  const refreshed = refreshCreationRepairItemsFromPlan(set.items, plan);

  assert.deepEqual(refreshed.map((item) => item.prompt), ["Old silver SKU prompt.", "Old gold SKU prompt."]);
});

test("creation repair refreshes legacy SKU prompts that predate the series lock", () => {
  assert.equal(
    needsCreationRepairPlanRefresh([
      { role: "sku", prompt: "Old silver SKU prompt." },
      { role: "sku", prompt: "Old gold SKU prompt." },
      { role: "hero", prompt: "Hero prompt." },
    ]),
    true,
  );
  assert.equal(
    needsCreationRepairPlanRefresh([
      { role: "sku", prompt: "SKU SERIES CONSISTENCY LOCK: Use the same visual template across first generation and retries." },
    ]),
    false,
  );
});

test("creation repair does not refresh a single SKU prompt just because it lacks a series lock", () => {
  assert.equal(
    needsCreationRepairPlanRefresh([
      { role: "sku", prompt: "Single SKU ecommerce prompt." },
      { role: "hero", prompt: "Hero prompt." },
    ]),
    false,
  );
});

test("creation repair preserves existing SKU subjects when repair preview sends an empty payload", () => {
  const set = {
    productName: "Jointed fishing lure",
    productDescription: "Segmented electric lure",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    imageCount: 1,
    selectedRoles: [],
    skuSubjects: [
      {
        id: "silver",
        title: "Silver lure",
        filenames: ["silver-reference.png"],
        note: "Silver body with red head",
      },
    ],
    items: [
      {
        itemId: "2-sku-silver",
        slotIndex: 2,
        role: "sku",
        title: "SKU image 1",
        prompt: "Single SKU ecommerce prompt.",
        status: "failed",
      },
    ],
  };

  const plan = buildCreationRepairPlan(set, { skuSubjects: "[]" });
  const [skuItem] = hydrateCreationRepairSkuSubjects(plan.items, plan);

  assert.deepEqual(plan.skuSubjects.map((subject) => subject.id), ["silver"]);
  assert.equal(skuItem.skuSubject.id, "silver");

  for (const emptyPayload of ["", "   "]) {
    const emptyPlan = buildCreationRepairPlan(set, { skuSubjects: emptyPayload });
    const [emptySkuItem] = hydrateCreationRepairSkuSubjects(emptyPlan.items, emptyPlan);

    assert.deepEqual(emptyPlan.skuSubjects.map((subject) => subject.id), ["silver"]);
    assert.equal(emptySkuItem.skuSubject.id, "silver");
  }
});

test("creation repair preserves disabled infographic rebuild setting", () => {
  const set = {
    productName: "Jointed fishing lure",
    productDescription: "Segmented electric lure",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    imageCount: 1,
    selectedRoles: ["hero"],
    infographicRebuildEnabled: false,
    referenceImageRoles: [
      { filename: "subject.jpg", role: "product" },
      { filename: "size-chart.jpg", role: "dimensions" },
    ],
    items: [
      {
        itemId: "1-hero",
        slotIndex: 1,
        role: "hero",
        title: "Hero image",
        prompt: "Old hero prompt.",
        status: "failed",
      },
    ],
  };

  const plan = buildCreationRepairPlan(set, {});

  assert.equal(plan.infographicRebuildEnabled, false);
  assert.deepEqual(plan.items.map((item) => item.role), ["hero"]);
});

test("creation repair preserves disabled SKU generation setting", () => {
  const set = {
    productName: "Jointed fishing lure",
    productDescription: "Segmented electric lure",
    imageCount: 1,
    selectedRoles: ["hero"],
    skuGenerationEnabled: false,
    skuSubjects: [{ id: "blue", title: "Blue lure", filenames: ["blue.jpg"] }],
    items: [{ itemId: "1-hero", slotIndex: 1, role: "hero", title: "Hero image", status: "failed" }],
  };

  const plan = buildCreationRepairPlan(set, {});

  assert.equal(plan.skuGenerationEnabled, false);
  assert.equal(plan.skuImageCount, 0);
  assert.deepEqual(plan.skuSubjects.map((subject) => subject.id), ["blue"]);
  assert.deepEqual(plan.items.map((item) => item.role), ["hero"]);
});
