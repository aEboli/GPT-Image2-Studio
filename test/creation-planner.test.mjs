import test from "node:test";
import assert from "node:assert/strict";

import {
  applyCreationPlanOverrides,
  buildCreationPlan,
  buildCreationSubmittedPlan,
  CREATION_IMAGE_COUNT_OPTIONS,
  CREATION_ITEM_ROLES,
  CREATION_PLATFORM_OPTIONS,
  CREATION_SKU_GENERATION_RULE_OPTIONS,
  CREATION_VISUAL_LANGUAGE_OPTIONS,
  getCreationIndustryRolePreset,
  getCreationScenarioRoleInstruction,
  getCreationScenarioRolePreset,
  formatCreationDimensionSpecsForMode,
  normalizeCreationSkuGenerationRule,
  normalizeCreationVisualLanguage,
  normalizeCreationLogoOptions,
  normalizeCreationDimensionUnitMode,
  normalizeCreationReferenceAnalysis,
  normalizeCreationImageCount,
  normalizeCreationIndustryTemplate,
  normalizeCreationPlatform,
  normalizeCreationReferenceRoles,
  normalizeCreationScenario,
  normalizeCreationSelectedRoles,
  normalizeCreationSkuSubjects,
  normalizeCreationTargetLanguage,
} from "../lib/creation-planner.mjs";
import { buildCreationInfographicRebuildPrompt } from "../lib/creation-generation-parameters.mjs";

test("creation submitted plans accept a legitimate 33-item snapshot above the legacy byte threshold", () => {
  const prompt = "平台套图事实提示词。".repeat(3500);
  const items = Array.from({ length: 33 }, (_, index) => ({
    itemId: `slot-${index + 1}`,
    slotKey: index < 18 ? `universal:${index + 1}` : `append-${index + 1}`,
    itemKind: index < 18 ? "carousel" : index < 20 ? "sku" : "infographic-rebuild",
    role: index < 18 ? "hero" : index < 20 ? "sku" : "infographic-rebuild",
    prompt,
    ratio: "1:1",
    resolutionTier: "auto",
    targetLanguage: "en",
  }));

  const submitted = buildCreationSubmittedPlan({
    effectivePlan: JSON.stringify({ platform: "universal", items }),
  });

  assert.equal(submitted.items.length, 33);
  assert.equal(submitted.items[0].prompt, prompt);
  assert.equal(submitted.totalPlannedItemCount, 33);
});

test("creation submitted plans still reject snapshots beyond the absolute byte limit", () => {
  const oversized = {
    platform: "universal",
    items: [{
      itemId: "slot-1",
      slotKey: "universal:1",
      role: "hero",
      prompt: "x".repeat(4 * 1024 * 1024 + 1),
      ratio: "1:1",
      resolutionTier: "auto",
      targetLanguage: "en",
    }],
  };

  assert.throws(
    () => buildCreationSubmittedPlan({ effectivePlan: JSON.stringify(oversized) }),
    /冻结计划过大/,
  );
});

test("creation planner applies preview plan prompt overrides without changing set shape", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit", "scene"],
  });

  const updated = applyCreationPlanOverrides(plan, [
    { itemId: "1-hero", prompt: "Custom hero prompt for the preview plan." },
    { role: "benefit", prompt: "Custom benefit prompt from role override.", marketingCopy: "Clear taste, fast cleanup" },
    { slotIndex: 99, prompt: "Ignored because the slot does not exist." },
  ]);

  assert.notEqual(updated, plan);
  assert.equal(updated.items.length, 3);
  assert.deepEqual(
    updated.items.map((item) => item.itemId),
    ["1-hero", "2-benefit", "3-scene"],
  );
  assert.equal(updated.items[0].prompt, "Custom hero prompt for the preview plan.");
  assert.equal(updated.items[1].prompt, "Custom benefit prompt from role override.");
  assert.equal(updated.items[1].marketingCopy, "Clear taste, fast cleanup");
  assert.equal(updated.items[2].prompt, plan.items[2].prompt);
  assert.equal(plan.items[0].prompt.includes("Custom hero prompt"), false);
});

test("creation planner appends non-subject references after SKU items when infographic rebuild is enabled", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented bait with treble hooks and lifelike swimming action",
    sellingPoints: "realistic finish, durable body",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit"],
    infographicRebuildEnabled: true,
    referenceImageRoles: [
      { index: 1, filename: "blue-lure.png", role: "product", note: "Blue lure subject" },
      { index: 2, filename: "silver-lure.png", role: "reference-product", note: "Primary silver lure subject" },
      { index: 3, filename: "package-list.png", role: "package", note: "Includes USB cable and spare propeller" },
      { index: 4, filename: "size-card.png", role: "dimensions", note: "Length 13 cm, weight 42 g" },
      { index: 5, filename: "detail-card.png", role: "material", note: "Hook and body texture callouts" },
    ],
    skuSubjects: [
      { id: "blue-lure", title: "Blue lure", filenames: ["blue-lure.png"], note: "Blue lure subject" },
    ],
  });

  assert.equal(plan.infographicRebuildEnabled, true);
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["hero", "benefit", "sku", "infographic-rebuild", "infographic-rebuild", "infographic-rebuild"],
  );

  const rebuildItems = plan.items.filter((item) => item.role === "infographic-rebuild");
  assert.deepEqual(
    rebuildItems.map((item) => item.sourceInfographic.filename),
    ["package-list.png", "size-card.png", "detail-card.png"],
  );
  assert.deepEqual(
    rebuildItems.map((item) => item.slotIndex),
    [4, 5, 6],
  );
  assert.deepEqual(
    rebuildItems.map((item) => item.sourceInfographic.index),
    [3, 4, 5],
  );
  assert.ok(rebuildItems.every((item) => item.prompt === buildCreationInfographicRebuildPrompt()));
  assert.ok(rebuildItems.every((item) => !/blue-lure|silver-lure|package-list|size-card|detail-card/i.test(item.prompt)));
});

test("creation infographic rebuild prompt is canonical across all suite context", () => {
  const firstPlan = buildCreationPlan({
    productName: "OTHER_PRODUCT_NAME_SENTINEL_A",
    productDescription: "OTHER_DESCRIPTION_SENTINEL_A",
    sellingPoints: "OTHER_SELLING_POINT_SENTINEL_A",
    platform: "universal",
    industryTemplate: "outdoor",
    imageCount: "0",
    skuGenerationEnabled: "false",
    infographicRebuildEnabled: "true",
    targetLanguage: "zh-CN",
    ratio: "1:1",
    resolutionTier: "2K",
    visualLanguage: "warm-handcrafted",
    audienceStrategy: {
      targetAudience: "OTHER_AUDIENCE_SENTINEL_A",
      purchaseMotivations: ["OTHER_MOTIVATION_SENTINEL_A"],
      purchaseObjections: ["OTHER_OBJECTION_SENTINEL_A"],
      evidenceBasis: ["OTHER_EVIDENCE_SENTINEL_A"],
      source: "user",
      confidence: "high",
    },
    logoOptions: { enabled: true, filename: "OTHER_LOGO_SENTINEL_A.png", placement: "top-left" },
    referenceImageRoles: [
      { index: 2, filename: "OTHER_PRODUCT_REFERENCE_SENTINEL_A.png", role: "product", note: "OTHER_PRODUCT_NOTE_SENTINEL_A" },
      { index: 7, filename: "target-source-a.png", role: "dimensions", note: "OTHER_SOURCE_NOTE_SENTINEL_A" },
    ],
  });
  const secondPlan = buildCreationPlan({
    productName: "OTHER_PRODUCT_NAME_SENTINEL_B",
    productDescription: "OTHER_DESCRIPTION_SENTINEL_B",
    sellingPoints: "OTHER_SELLING_POINT_SENTINEL_B",
    platform: "amazon",
    industryTemplate: "beauty",
    imageCount: "0",
    skuGenerationEnabled: "false",
    infographicRebuildEnabled: "true",
    targetLanguage: "en",
    ratio: "4:5",
    resolutionTier: "1.5K",
    visualLanguage: "bold-campaign",
    audienceStrategy: {
      targetAudience: "OTHER_AUDIENCE_SENTINEL_B",
      purchaseMotivations: ["OTHER_MOTIVATION_SENTINEL_B"],
      purchaseObjections: ["OTHER_OBJECTION_SENTINEL_B"],
      evidenceBasis: ["OTHER_EVIDENCE_SENTINEL_B"],
      source: "user",
      confidence: "high",
    },
    logoOptions: { enabled: true, filename: "OTHER_LOGO_SENTINEL_B.png", placement: "bottom-right" },
    referenceImageRoles: [
      { index: 3, filename: "OTHER_PRODUCT_REFERENCE_SENTINEL_B.png", role: "reference-product", note: "OTHER_PRODUCT_NOTE_SENTINEL_B" },
      { index: 11, filename: "target-source-b.png", role: "usage", note: "OTHER_SOURCE_NOTE_SENTINEL_B" },
    ],
  });
  const firstItem = firstPlan.items.find((item) => item.sourceInfographic?.filename === "target-source-a.png");
  const secondItem = secondPlan.items.find((item) => item.sourceInfographic?.filename === "target-source-b.png");
  const canonicalPrompt = buildCreationInfographicRebuildPrompt();

  assert.ok(firstItem);
  assert.ok(secondItem);
  assert.equal(firstItem.sourceInfographic.index, 7);
  assert.equal(secondItem.sourceInfographic.index, 11);
  assert.equal(firstItem.prompt, canonicalPrompt);
  assert.equal(secondItem.prompt, canonicalPrompt);
  assert.doesNotMatch(canonicalPrompt, /OTHER_|target-source|\.png|1:1|4:5|zh-CN/i);
  assert.match(canonicalPrompt, /selected target language, output format, resolution, and aspect ratio are output controls/i);
});

test("creation planner defaults SKU generation on and infographic rebuild off", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented bait with treble hooks and lifelike swimming action",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { index: 1, filename: "blue-lure.png", role: "product", note: "Blue lure subject" },
      { index: 2, filename: "size-card.png", role: "dimensions", note: "Length 13 cm" },
    ],
    skuSubjects: [{ id: "blue-lure", title: "Blue lure", filenames: ["blue-lure.png"] }],
  });

  assert.equal(plan.skuGenerationEnabled, true);
  assert.equal(plan.infographicRebuildEnabled, false);
  assert.equal(plan.skuImageCount, 1);
  assert.equal(plan.infographicRebuildCount, 0);
  assert.deepEqual(plan.items.map((item) => item.role), ["hero", "sku"]);
});

test("creation planner omits appended SKU items when SKU generation is disabled", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented bait with treble hooks and lifelike swimming action",
    selectedRoles: ["hero"],
    skuGenerationEnabled: "false",
    skuSubjects: [{ id: "blue-lure", title: "Blue lure", filenames: ["blue-lure.png"] }],
  });

  assert.equal(plan.skuGenerationEnabled, false);
  assert.equal(plan.skuImageCount, 0);
  assert.equal(plan.totalPlannedItemCount, 1);
  assert.equal(plan.skuSubjects.length, 1);
  assert.deepEqual(plan.items.map((item) => item.role), ["hero"]);
});

test("creation planner disables infographic rebuild when requested", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented bait with treble hooks and lifelike swimming action",
    sellingPoints: "realistic finish, durable body",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit"],
    infographicRebuildEnabled: "false",
    referenceImageRoles: [
      { index: 1, filename: "blue-lure.png", role: "product", note: "Blue lure subject" },
      { index: 2, filename: "size-card.png", role: "dimensions", note: "Length 13 cm, weight 42 g" },
      { index: 3, filename: "package-list.png", role: "package", note: "Includes USB cable" },
    ],
  });

  assert.equal(plan.infographicRebuildEnabled, false);
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["hero", "benefit"],
  );
});

test("creation planner exposes the refactored eighteen suite image types", () => {
  assert.equal(CREATION_ITEM_ROLES.length, 18);
  assert.deepEqual(
    CREATION_ITEM_ROLES.map((role) => role.title),
    [
      "首图成交主视觉",
      "目标人群共鸣图",
      "适用多场景图",
      "多角度产品展示图",
      "冲动下单氛围图",
      "产品细节特写图",
      "品牌质感/礼品价值图",
      "尺寸容量适配图",
      "功能效果渲染图",
      "参数规格图",
      "品质工艺证明图",
      "到手清单/配件图",
      "多款式/SKU选择图",
      "材质成分解析图",
      "痛点图",
      "卖点图",
      "真人手持展示图",
      "真人穿戴场景图",
    ],
  );
  assert.equal(normalizeCreationImageCount(18), 18);

  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
  });

  assert.equal(plan.imageCount, 18);
  assert.deepEqual(
    plan.items.map((item) => item.title),
    CREATION_ITEM_ROLES.map((role) => role.title),
  );
});

test("creation planner builds the fixed four-image ecommerce set", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "透明便携咖啡冲煮器，适合办公室和旅行",
    sellingPoints: "轻便, 易清洁, 口感稳定",
    targetLanguage: "en",
    imageCount: "4",
  });

  assert.equal(plan.targetLanguage, "en");
  assert.equal(plan.targetLanguageLabel, "English");
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["hero", "benefit", "scene", "multi-angle"],
  );
  assert.deepEqual(
    plan.items.map((item) => item.title),
    ["首图成交主视觉", "目标人群共鸣图", "适用多场景图", "多角度产品展示图"],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Use concise English marketing copy")));
  assert.ok(plan.items.every((item) => item.prompt.includes("AeroPress Clear")));
  assert.match(plan.items[0].prompt, /conversion-first hero image/i);
  assert.match(plan.items[1].prompt, /target-shopper resonance image/i);
  assert.match(plan.items[2].prompt, /multi-scenario application image/i);
  assert.match(plan.items[3].prompt, /3-4 clean views/i);
});

test("creation planner defaults to platform-aware ecommerce analysis without changing image type defaults", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
  });

  assert.ok(CREATION_PLATFORM_OPTIONS.length >= 12);
  assert.equal(normalizeCreationPlatform("unknown").value, "universal");
  assert.equal(plan.platform, "universal");
  assert.equal(plan.platformLabel, "通用电商");
  assert.equal(plan.imageCount, 18);
  assert.deepEqual(
    plan.items.map((item) => item.title),
    CREATION_ITEM_ROLES.map((role) => role.title),
  );
  assert.equal(plan.skuGenerationRule, "color-name-under-subject");
  assert.ok(plan.items.every((item) => item.prompt.includes("Platform:")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Platform: 通用电商")));
});

test("creation planner keeps the optimized eighteen image types when universal is explicit", () => {
  const plan = buildCreationPlan({
    productName: "Travel backpack",
    productDescription: "Outdoor backpack with breathable straps and multiple colorways",
    sellingPoints: "large capacity, breathable back panel, durable fabric",
    platform: "universal",
    imageCount: 18,
    skuGenerationEnabled: false,
  });

  assert.deepEqual(plan.items.map((item) => item.title), CREATION_ITEM_ROLES.map((role) => role.title));
  assert.deepEqual(plan.slots.map((item) => item.title), CREATION_ITEM_ROLES.map((role) => role.title));
  assert.deepEqual(plan.items.map((item) => item.imageTypeLabel), CREATION_ITEM_ROLES.map((role) => role.title));
  assert.deepEqual(plan.slots.map((item) => item.imageTypeLabel), CREATION_ITEM_ROLES.map((role) => role.title));
  assert.match(plan.items[0].prompt, /conversion-first hero image/i);
  assert.match(plan.items[0].prompt, /Lead with unmistakable product identity and one main buying promise/i);
  assert.match(plan.items[15].prompt, /Create a selling-point image/i);
  assert.doesNotMatch(plan.items[0].prompt, /Create 通用电商 通用首图 as a platform-native gallery asset/);
});

test("creation planner adapts prompts to selected platform and product category", () => {
  const plan = buildCreationPlan({
    productName: "Portable solar power bank",
    productDescription: "10000mAh outdoor charger for camping and emergency backup",
    sellingPoints: "USB-C fast charging, waterproof shell, flashlight",
    targetLanguage: "en",
    platform: "amazon",
    industryTemplate: "electronics",
    selectedRoles: ["hero", "spec-table", "usage-suggestion"],
  });

  assert.equal(plan.platform, "amazon");
  assert.equal(plan.platformLabel, "Amazon");
  assert.ok(plan.items.every((item) => item.prompt.includes("Platform: Amazon")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Product category: 3C 数码")));
  assert.match(plan.items.find((item) => item.role === "hero").prompt, /thumbnail-legible/i);
  assert.match(plan.items.find((item) => item.role === "spec-table").prompt, /decision-relevant specifications/i);
  assert.match(plan.items.find((item) => item.role === "usage-suggestion").prompt, /buyer payoff/i);
});

test("creation planner defaults to classic commercial photography with a shared visual lock", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
  });

  assert.equal(plan.visualLanguage, "classic-commercial");
  assert.equal(plan.visualLanguageLabel, "经典商业摄影");
  assert.equal(CREATION_VISUAL_LANGUAGE_OPTIONS.length, 11);
  assert.equal(normalizeCreationVisualLanguage("unknown").value, "classic-commercial");
  assert.ok(plan.items.every((item) => item.prompt.includes("Visual language:")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Visual language: 经典商业摄影")));
  assert.ok(plan.items.every((item) => item.prompt.includes("classic commercial product photography")));
});

test("creation planner falls back when a removed reference-style value is restored", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    visualLanguage: "reference-style",
    selectedRoles: ["hero", "scene"],
  });

  assert.equal(plan.visualLanguage, "classic-commercial");
  assert.equal(plan.visualLanguageLabel, "经典商业摄影");
  assert.ok(plan.items.every((item) => item.prompt.includes("Visual language: 经典商业摄影")));
  assert.ok(plan.items.every((item) => !item.prompt.includes("style reference")));
});

test("creation planner applies one selected visual language consistently across the whole set", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    visualLanguage: "lifestyle-editorial",
    selectedRoles: ["hero", "benefit", "scene"],
  });

  assert.equal(plan.visualLanguage, "lifestyle-editorial");
  assert.equal(plan.visualLanguageLabel, "生活方式杂志");
  assert.ok(plan.items.every((item) => item.prompt.includes("Visual language: 生活方式杂志")));
  assert.ok(plan.items.every((item) => item.prompt.includes("held as the authority for every image in the set")));
  assert.ok(plan.items.every((item) => item.prompt.includes("lifestyle magazine editorial")));
});

test("creation planner makes non-default visual languages decisive instead of drifting to generic commercial lighting", () => {
  const expectations = [
    ["premium-studio", "deep controlled studio set with visible softbox shaping"],
    ["clean-marketplace", "pure white or near-white marketplace system"],
    ["lifestyle-editorial", "magazine-like lived-in environment"],
    ["social-ugc", "phone-camera creator realism"],
    ["detail-infographic", "modular ecommerce information layout"],
    ["macro-material", "texture-led macro crop"],
    ["outdoor-context", "real outdoor environmental light"],
    ["minimal-luxury", "quiet luxury negative space"],
    ["bold-campaign", "poster-grade campaign composition"],
    ["warm-handcrafted", "warm tactile handcrafted setting"],
  ];

  for (const [visualLanguage, signature] of expectations) {
    const plan = buildCreationPlan({
      productName: "AeroPress Clear",
      productDescription: "Transparent portable coffee brewer",
      sellingPoints: "lightweight, easy to clean, stable taste",
      targetLanguage: "en",
      visualLanguage,
      selectedRoles: ["hero", "benefit"],
    });

    assert.ok(plan.items.every((item) => item.prompt.includes("Visual language:")));
    assert.ok(plan.items.every((item) => item.prompt.includes(signature)), visualLanguage);
    assert.ok(plan.items.every((item) => item.prompt.includes("held as the authority for every image in the set")));
    assert.ok(plan.items.every((item) => !item.prompt.includes("polished commercial lighting.")));
  }
});

test("creation planner applies the visual language lock to SKU prompts without forcing premium studio lighting", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Three sellable lure colors photographed on white background",
    sellingPoints: "lifelike swim action, sharp treble hooks, durable finish",
    targetLanguage: "en",
    imageCount: "4",
    visualLanguage: "social-ugc",
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
    ],
  });
  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.ok(skuItem);
  assert.match(skuItem.prompt, /Visual language:/);
  assert.match(skuItem.prompt, /phone-camera creator realism/);
  assert.doesNotMatch(skuItem.prompt, /clean premium ecommerce background with polished commercial lighting/);
});

test("creation planner rewrites Chinese visible copy when target language is English", () => {
  const plan = buildCreationPlan({
    productName: "Handheld vacuum",
    productDescription: "\u753b\u9762\u6587\u5b57\uff1a\u8d85\u5f3a\u5438\u529b\uff0c\u8f66\u5bb6\u4e24\u7528",
    sellingPoints: "\u5f3a\u52b2\u5438\u529b\n\u4f4e\u566a\u97f3",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit"],
  });

  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes("Added canvas text uses English"),
    ),
  );
  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes("Added canvas text uses English"),
    ),
  );
});

test("creation planner limits output language to copy outside the supplied product subject", () => {
  const plan = buildCreationPlan({
    productName: "Kobayashi cooling patch",
    productDescription: "Retail cooling patch package with original Japanese surface artwork and writing.",
    sellingPoints: "cooling sensation\nhot-weather use",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuGenerationEnabled: true,
    referenceImageRoles: [
      {
        filename: "kobayashi-package.png",
        role: "product",
        note: "The physical retail package is the sellable subject.",
      },
    ],
    skuSubjects: [
      {
        id: "original-package",
        title: "Original package",
        filenames: ["kobayashi-package.png"],
        note: "One complete package subject.",
      },
    ],
  });
  const ordinaryItems = plan.items.filter((item) => item.role !== "infographic-rebuild");

  assert.equal(ordinaryItems.length, 2);
  for (const item of ordinaryItems) {
    assert.match(item.prompt, /Subject content:/);
    assert.match(item.prompt, /artwork, symbols, logos, and printed text/i);
    assert.match(item.prompt, /artwork, symbols, logos, and printed text/i);
    assert.match(item.prompt, /same characters, original language, placement, and colors/i);
    assert.match(item.prompt, /keep each supplied product or packaging subject as shown/i);
    assert.match(item.prompt, /Added wording sits outside that subject/);
    assert.match(item.prompt, /newly authored wording outside the physical product or packaging subject, only that separate wording follows the selected language/i);
    assert.match(item.prompt, /different original language.*required exception/i);
    assert.doesNotMatch(item.prompt, /Translate or rewrite any source-language wording into the target language/i);
  }
});

test("creation planner treats detailed descriptions as selective set-wide source material", () => {
  const plan = buildCreationPlan({
    productName: "Handheld vacuum",
    productDescription: "\u753b\u9762\u6587\u5b57\uff1a\u8d85\u5f3a\u5438\u529b\uff0c\u8f66\u5bb6\u4e24\u7528\uff1b\u5c55\u793a\u6ee4\u82af\u7ed3\u6784\u3001\u5438\u5634\u914d\u4ef6\u548c\u8f66\u5185\u4f7f\u7528\u573a\u666f",
    sellingPoints: "\u5f3a\u52b2\u5438\u529b\n\u4f4e\u566a\u97f3\n\u591a\u573a\u666f\u9002\u7528",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit", "product-detail"],
  });

  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes(
        "written from this role's product facts",
      ),
    ),
  );
  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes("wording unique to this image"),
    ),
  );
});

test("creation planner allocates source details by role without requiring agent analysis", () => {
  const plan = buildCreationPlan({
    productName: "Handheld vacuum",
    productDescription:
      "\u753b\u9762\u6587\u5b57\uff1a\u8d85\u5f3a\u5438\u529b\uff1b\u6ee4\u82af\u7ed3\u6784\uff1b\u5438\u5634\u914d\u4ef6\uff1b\u8f66\u5185\u4f7f\u7528\u573a\u666f\uff1b\u5305\u88c5\u6536\u7eb3\u888b",
    sellingPoints: "\u5f3a\u52b2\u5438\u529b\n\u4f4e\u566a\u97f3\n\u591a\u573a\u666f\u9002\u7528",
    targetLanguage: "en",
    selectedRoles: ["hero", "product-detail", "scene", "accessory-gift"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.equal(plan.contentAllocation.strategy, "deterministic-rules");
  assert.equal(plan.contentAllocation.agentRequired, false);
  assert.match(promptByRole["product-detail"], /\u6ee4\u82af\u7ed3\u6784/);
  assert.match(promptByRole["product-detail"], /\u5438\u5634\u914d\u4ef6/);
  assert.doesNotMatch(promptByRole["product-detail"], /\u8f66\u5185\u4f7f\u7528\u573a\u666f/);
  assert.match(promptByRole.scene, /\u8f66\u5185\u4f7f\u7528\u573a\u666f/);
  assert.doesNotMatch(promptByRole.scene, /\u6ee4\u82af\u7ed3\u6784/);
  assert.doesNotMatch(promptByRole.scene, /\u753b\u9762\u6587\u5b57/);
  assert.match(promptByRole["accessory-gift"], /\u5305\u88c5\u6536\u7eb3\u888b/);
});

test("creation planner does not repeat the full detailed description across unrelated roles", () => {
  const plan = buildCreationPlan({
    productName: "Electric fishing lure",
    productDescription: "Electric lure, built-in LED light, internal steel rattle beads, ABS body, USB recharge cable",
    sellingPoints: "",
    targetLanguage: "en",
    selectedRoles: ["hero", "accessory-gift", "after-sales", "product-detail", "usage-suggestion", "size-capacity-fit", "after-sales"],
  });
  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));
  const fullDescription =
    "Description: Electric lure, built-in LED light, internal steel rattle beads, ABS body, USB recharge cable.";

  assert.match(promptByRole.hero, /Electric lure/);
  assert.match(promptByRole["after-sales"], /built-in LED light/);
  assert.match(promptByRole["product-detail"], /internal steel rattle beads/);
  assert.match(promptByRole["product-detail"], /ABS body/);
  assert.doesNotMatch(promptByRole["accessory-gift"], /built-in LED light|internal steel rattle beads|ABS body/);
  assert.doesNotMatch(promptByRole["accessory-gift"], new RegExp(fullDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(promptByRole["usage-suggestion"], new RegExp(fullDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(promptByRole["size-capacity-fit"], new RegExp(fullDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.doesNotMatch(promptByRole["after-sales"], new RegExp(fullDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

test("creation planner limits hard size and weight facts to two dedicated information roles", () => {
  const plan = buildCreationPlan({
    productName: "Electric fishing lure",
    productDescription:
      "Rechargeable segmented fishing lure. Length 13cm. Weight 42g. ABS body. Internal steel rattle beads. USB recharge cable.",
    sellingPoints: "",
    targetLanguage: "en",
    selectedRoles: [
      "hero",
      "benefit",
      "scene",
      "product-detail",
      "size-capacity-fit",
      "effect-comparison",
      "spec-table",
      "series-showcase",
    ],
  });

  const rolesWithSpecs = plan.items
    .filter((item) => /13cm|42g/.test(item.prompt))
    .map((item) => item.role);

  assert.deepEqual(rolesWithSpecs, ["size-capacity-fit", "spec-table"]);
  assert.ok(rolesWithSpecs.length <= 2);
});

test("creation planner limits repeated material detail facts to two detail roles", () => {
  const plan = buildCreationPlan({
    productName: "Electric fishing lure",
    productDescription:
      "Rechargeable segmented fishing lure. ABS body. Internal steel rattle beads. Polished propeller. Reinforced hooks. USB recharge cable.",
    sellingPoints: "",
    targetLanguage: "en",
    selectedRoles: [
      "hero",
      "benefit",
      "scene",
      "multi-angle",
      "product-detail",
      "brand-story",
      "craft-process",
      "ingredient-material",
      "atmosphere",
    ],
  });

  const rolesWithMaterialDetails = plan.items
    .filter((item) => /ABS body|Internal steel rattle beads/i.test(item.prompt))
    .map((item) => item.role);

  assert.deepEqual(rolesWithMaterialDetails, ["hero", "product-detail", "ingredient-material"]);
  assert.ok(rolesWithMaterialDetails.filter((role) => role !== "hero").length <= 2);
});

test("creation planner turns rechargeable features into concrete scene and usage creative direction", () => {
  const plan = buildCreationPlan({
    productName: "Cordless desk lamp",
    productDescription:
      "Portable rechargeable desk lamp with USB-C charging cable, rechargeable battery, magnetic base, night reading, bedside charging, and power bank charging.",
    sellingPoints: "cordless reading light\nfast USB-C recharge\nbedside and desktop use",
    targetLanguage: "en",
    selectedRoles: ["scene", "atmosphere", "usage-suggestion", "benefit"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.match(promptByRole.scene, /conversion image of the set/i);
  assert.match(promptByRole.scene, /concrete charging or cable-connection moment/i);
  assert.match(promptByRole.scene, /USB-C|bedside charging|power bank charging/i);
  assert.match(promptByRole["usage-suggestion"], /charging and connection ease as evidence/i);
  assert.doesNotMatch(promptByRole["usage-suggestion"], /charging step sequence|numbered steps/i);
  assert.match(promptByRole["usage-suggestion"], /USB-C|bedside charging|power bank charging/i);
  assert.match(promptByRole.atmosphere, /desire turns into action/i);
});

test("creation planner makes dual-unit dimension labels mandatory without raw metric-only conflicts", () => {
  const plan = buildCreationPlan({
    productName: "Hard bait fishing lure",
    productDescription: "Rechargeable hard bait lure for shallow water.",
    sellingPoints: "realistic swim action",
    targetLanguage: "en",
    selectedRoles: ["size-capacity-fit"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "size-card.png",
        role: "dimensions",
        note: "Size specification card: length 10 cm, weight 15 g.",
      },
    ],
  });

  const dimensionsPrompt = plan.items[0].prompt;

  assert.match(dimensionsPrompt, /Length 10 cm \(3\.94 in\)/);
  assert.match(dimensionsPrompt, /Weight 15 g \(0\.53 oz\)/);
  assert.match(dimensionsPrompt, /metric and imperial pair together/i);
  assert.match(dimensionsPrompt, /metric and imperial pair together/i);
  assert.doesNotMatch(dimensionsPrompt, /Description:.*(?:10 cm|15 g)/);
  assert.doesNotMatch(dimensionsPrompt, /Selling points:.*(?:10 cm|15 g)/);
});

test("creation planner uses charging instructions from usage reference notes", () => {
  const plan = buildCreationPlan({
    productName: "Rechargeable hard bait lure",
    productDescription: "Hard bait lure for shallow water.",
    sellingPoints: "realistic action",
    targetLanguage: "en",
    selectedRoles: ["scene", "usage-suggestion"],
    referenceImageRoles: [
      {
        filename: "charging-guide.png",
        role: "usage",
        note: "USB charging cable connects to red and black clips; show charging for 5 hours before use.",
      },
    ],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.match(promptByRole.scene, /include one concrete charging or cable-connection moment/i);
  assert.match(promptByRole.scene, /USB charging cable connects to red and black clips/);
  assert.match(promptByRole["usage-suggestion"], /charging and connection ease as evidence/i);
  assert.doesNotMatch(promptByRole["usage-suggestion"], /MUST include at least one dedicated charging\/connection panel|numbered steps/i);
  assert.match(promptByRole["usage-suggestion"], /charging for 5 hours before use/i);
});

test("creation planner maps reference analysis coverage onto the matching carousel roles", () => {
  const plan = buildCreationPlan({
    productName: "Trail backpack",
    productDescription: "Waterproof hiking backpack with breathable mesh, 28L capacity, rain cover, and quick setup steps.",
    sellingPoints: "lightweight\nbreathable mesh\n28L capacity\nrain cover included\nquick setup",
    targetLanguage: "en",
    selectedRoles: [
      "hero",
      "scene",
      "atmosphere",
      "product-detail",
      "size-capacity-fit",
      "spec-table",
      "accessory-gift",
      "ingredient-material",
      "usage-suggestion",
    ],
    referenceImageRoles: [
      { filename: "main-product.png", role: "product", note: "orange backpack main subject" },
      { filename: "trail-scene.png", role: "scene", note: "use on rocky outdoor trail" },
      { filename: "mesh-detail.png", role: "material", note: "breathable mesh shoulder strap texture" },
      { filename: "size-card.png", role: "dimensions", note: "28L capacity and 48 cm height" },
      { filename: "box-contents.png", role: "package", note: "rain cover and storage pouch included" },
      { filename: "setup-guide.png", role: "usage", note: "three setup steps for first use" },
    ],
  });
  const byRole = Object.fromEntries(plan.items.map((item) => [item.role, item]));
  const filenamesFor = (role) => byRole[role].coverageSources.map((source) => source.filename);

  assert.deepEqual(filenamesFor("scene"), ["trail-scene.png"]);
  assert.deepEqual(filenamesFor("atmosphere"), ["trail-scene.png"]);
  assert.deepEqual(filenamesFor("product-detail"), ["mesh-detail.png"]);
  assert.deepEqual(filenamesFor("ingredient-material"), ["mesh-detail.png"]);
  assert.deepEqual(filenamesFor("size-capacity-fit"), ["size-card.png"]);
  assert.deepEqual(filenamesFor("spec-table"), ["size-card.png"]);
  assert.deepEqual(filenamesFor("accessory-gift"), ["box-contents.png"]);
  assert.deepEqual(filenamesFor("usage-suggestion"), ["setup-guide.png"]);

  assert.match(byRole["usage-suggestion"].coverageSummary, /setup-guide\.png/);
  assert.match(byRole["usage-suggestion"].coverageSummary, /usage instructions/);
  assert.deepEqual(byRole["usage-suggestion"].coverageWarnings, []);
  assert.match(byRole["usage-suggestion"].prompt, /Reference coverage:/);
  assert.match(byRole["usage-suggestion"].prompt, /selling-point evidence/i);
  assert.match(byRole["usage-suggestion"].prompt, /setup-guide\.png/);
  assert.match(byRole["usage-suggestion"].prompt, /three setup steps for first use/);
  assert.doesNotMatch(byRole["usage-suggestion"].prompt, /faithfully reconstruct the original instruction card|preserve the original sequence/i);
});

test("creation planner treats scene coverage as visual blueprints and usage coverage as selling-point evidence", () => {
  const plan = buildCreationPlan({
    productName: "Countertop purifier",
    productDescription: "Compact purifier with tap connector and filter cartridge.",
    sellingPoints: "quick install\nclear water\nsmall kitchen footprint",
    targetLanguage: "en",
    selectedRoles: ["scene", "usage-suggestion"],
    referenceImageRoles: [
      { filename: "kitchen-sink-scene.png", role: "scene", note: "original photo shows purifier beside sink while a parent fills a glass" },
      { filename: "install-card.png", role: "usage", note: "three-panel original card shows attach connector, flush filter, then fill cup" },
    ],
  });
  const byRole = Object.fromEntries(plan.items.map((item) => [item.role, item]));

  assert.match(byRole.scene.prompt, /visual blueprint/i);
  assert.match(byRole.scene.prompt, /reconstruct its environment, user action, product placement/i);
  assert.match(byRole.scene.prompt, /then recompose/i);
  assert.match(byRole.scene.prompt, /note only identifies the source to follow/i);
  assert.match(byRole["usage-suggestion"].prompt, /selling-point evidence/i);
  assert.match(byRole["usage-suggestion"].prompt, /buyer payoff/i);
  assert.match(byRole["usage-suggestion"].prompt, /three-panel original card shows attach connector, flush filter, then fill cup/);
  assert.doesNotMatch(byRole["usage-suggestion"].prompt, /Usage source [^.]+ is a visual blueprint/i);
  assert.doesNotMatch(byRole["usage-suggestion"].prompt, /preserve the original sequence|do not invent different steps/i);
  assert.doesNotMatch(byRole.scene.prompt, /role, and note must be visibly carried/i);
  assert.doesNotMatch(byRole["usage-suggestion"].prompt, /role, and note must be visibly carried/i);
});

test("creation planner keeps the requested role count while replacing weak roles for required reference coverage", () => {
  const plan = buildCreationPlan({
    productName: "Cordless desk lamp",
    productDescription: "Portable rechargeable desk lamp with magnetic base.",
    sellingPoints: "USB-C recharge\nbedside reading\nmagnetic base",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit", "scene", "multi-angle"],
    infographicRebuildEnabled: false,
    referenceImageRoles: [
      { filename: "lamp-main.png", role: "product", note: "white lamp main subject" },
      { filename: "charging-guide.png", role: "usage", note: "USB-C charging steps and cable direction" },
    ],
  });

  assert.equal(plan.imageCount, 4);
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["hero", "benefit", "scene", "usage-suggestion"],
  );
  assert.equal(plan.items[0].role, "hero");
  assert.match(plan.items[3].coverageSummary, /charging-guide\.png/);
  assert.match(plan.items[3].prompt, /USB-C charging steps and cable direction/);
});

test("creation planner prevents conversion roles from becoming redundant white-background novelty cards", () => {
  const plan = buildCreationPlan({
    productName: "Rechargeable hard bait lure",
    productDescription: "Rechargeable hard bait lure with USB charging cable, lifelike swim action, and shallow-water fishing use.",
    sellingPoints: "realistic strike action\nready before every trip\nconfidence for night fishing",
    targetLanguage: "en",
    selectedRoles: ["brand-story", "after-sales", "atmosphere", "effect-comparison", "size-capacity-fit", "spec-table"],
  });
  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  ["brand-story", "after-sales", "atmosphere"].forEach((role) => {
    assert.match(promptByRole[role], /conversion image of the set/i);
    assert.match(promptByRole[role], /believable buyer-facing moment/i);
  });
  assert.match(promptByRole["effect-comparison"], /one dominant, fully visible product/i);
  assert.match(promptByRole["effect-comparison"], /single anchor/i);
  assert.match(promptByRole["effect-comparison"], /seamless continuous scene/i);
  assert.doesNotMatch(promptByRole["effect-comparison"], /stage a believable buyer-facing situation, objection, comparison/i);
  assert.doesNotMatch(promptByRole["size-capacity-fit"], /conversion image of the set/i);
  assert.doesNotMatch(promptByRole["spec-table"], /conversion image of the set/i);
});

test("creation planner turns brand-story role into a many-scene use-and-style collage", () => {
  const plan = buildCreationPlan({
    productName: "Cooling towel",
    productDescription: "Soft breathable cooling towel for workout, beach, hiking, running, swimming, and outdoor heat relief.",
    sellingPoints: "cooling comfort\nmultiple wearing styles\nquick-dry fabric\nsport and travel ready",
    targetLanguage: "en",
    selectedRoles: ["brand-story"],
  });
  const prompt = plan.items.find((item) => item.role === "brand-story").prompt;

  assert.match(prompt, /many-scene use-and-style collage/i);
  assert.match(prompt, /9-12 rounded photo tiles/i);
  assert.match(prompt, /varied real-use situations/i);
  assert.match(prompt, /bottom row of use-method mini icons or line-art panels/i);
  assert.match(prompt, /Multiple Uses & Style/i);
  assert.match(prompt, /repeat the exact same product subject/i);
});

test("creation planner adds buyer-decision strategy to formerly templated conversion roles", () => {
  const plan = buildCreationPlan({
    productName: "Rechargeable hard bait lure",
    productDescription:
      "Rechargeable lure with USB charging cable, lifelike swimming action, internal rattle beads, ABS body, treble hooks, and multiple colorways.",
    sellingPoints: "fish ignore stiff lures\nready before every trip\nclear value in the full kit\nconfidence for night fishing",
    targetLanguage: "en",
    selectedRoles: [
      "benefit",
      "multi-angle",
      "atmosphere",
      "brand-story",
      "effect-comparison",
      "craft-process",
      "accessory-gift",
      "series-showcase",
      "ingredient-material",
      "after-sales",
      "usage-suggestion",
      "human-handheld",
      "human-wearable",
    ],
  });
  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  Object.values(promptByRole).forEach((prompt) => {
    assert.match(prompt, /Shopper question:/i);
    assert.match(prompt, /Shopper question:/i);
  });
  assert.match(promptByRole.benefit, /recognizable target person or buyer viewpoint/i);
  assert.match(promptByRole["multi-angle"], /understand the product from every important side/i);
  assert.match(promptByRole.atmosphere, /what decisive moment would make me want to buy this now/i);
  assert.match(promptByRole["brand-story"], /all the ways and places I could use this product/i);
  assert.match(promptByRole["effect-comparison"], /understand every supported feature/i);
  assert.match(promptByRole["craft-process"], /why should I trust the making quality/i);
  assert.match(promptByRole["accessory-gift"], /what exactly arrives and does it feel complete/i);
  assert.match(promptByRole["series-showcase"], /which variant should I choose/i);
  assert.match(promptByRole["ingredient-material"], /what is it made of and why does that matter/i);
  assert.match(promptByRole["after-sales"], /这个产品具体帮我解决什么问题？/);
  assert.match(promptByRole["usage-suggestion"], /我买它能获得哪些更明确的好处？/);
  assert.match(promptByRole["human-handheld"], /real handheld scale and use feel/i);
  assert.match(promptByRole["human-wearable"], /fits, hangs, carries, or looks on a real person/i);
});

test("creation planner gives every ecommerce carousel role a shopper question", () => {
  const plan = buildCreationPlan({
    productName: "Rechargeable hard bait lure",
    productDescription:
      "Rechargeable lure with USB charging cable, lifelike swimming action, internal rattle beads, ABS body, treble hooks, and multiple colorways.",
    sellingPoints: "fish ignore stiff lures\nready before every trip\nclear value in the full kit\nconfidence for night fishing",
    targetLanguage: "en",
  });
  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  CREATION_ITEM_ROLES.forEach((role) => {
    assert.match(promptByRole[role.role], /SHOPPER QUESTION:/i, role.role);
  });
  assert.match(promptByRole.hero, /what is this product and why should I care at first glance/i);
  assert.match(promptByRole.benefit, /which target shopper will feel understood by this product right now/i);
  assert.match(promptByRole.scene, /which real scenarios make this product feel useful and worth buying/i);
  assert.match(promptByRole["product-detail"], /are the visible details trustworthy enough to buy/i);
  assert.match(promptByRole["accessory-gift"], /what exactly comes with this product/i);
  assert.match(promptByRole["after-sales"], /这个产品具体帮我解决什么问题？/);
  assert.match(promptByRole["usage-suggestion"], /我买它能获得哪些更明确的好处？/);
  assert.match(promptByRole["human-handheld"], /real person's hands or in actual use/i);
  assert.match(promptByRole["human-wearable"], /real body or when carried in a real scene/i);
});

test("creation planner gives hero images circular scenario insets and scenario cues", () => {
  const plan = buildCreationPlan({
    productName: "Adjustable wrench",
    productDescription: "Adjustable wrench for indoor repairs, outdoor maintenance, and travel tool kits.",
    sellingPoints: "indoor use\noutdoor maintenance\ntravel tool kit",
    targetLanguage: "en",
    selectedRoles: ["hero"],
  });
  const heroPrompt = plan.items[0].prompt;

  assert.match(heroPrompt, /3-5 small circular scene frames/i);
  assert.match(heroPrompt, /3-5 small circular scene frames/i);
  assert.match(heroPrompt, /believable use contexts/i);
  assert.match(heroPrompt, /believable use contexts/i);
  assert.match(heroPrompt, /indoor|outdoor/i);
});

test("creation planner merges all reliable non-dimension facts into the hero sales hierarchy", () => {
  const plan = buildCreationPlan({
    productName: "Rechargeable jointed fishing lure",
    productDescription: [
      "ABS segmented lure body",
      "Internal rattle beads and lifelike swimming action",
      "USB charging cable included",
      "River lake and shore casting scenes",
      "Length 172 mm and height 100 mm",
    ].join("\n"),
    sellingPoints: [
      "rechargeable before every trip",
      "durable treble hooks",
      "night fishing visibility",
      "ready for multiple fishing environments",
    ],
    dimensionSpecs: "Length 172 mm; Height 100 mm",
    targetLanguage: "en",
    selectedRoles: ["hero"],
  });
  const heroPrompt = plan.items[0].prompt;

  assert.equal(plan.items[0].title, "首图成交主视觉");
  assert.match(heroPrompt, /reliable non-dimension facts/i);
  assert.match(heroPrompt, /Hero coverage:/i);
  assert.match(heroPrompt, /ABS segmented lure body/i);
  assert.match(heroPrompt, /Internal rattle beads and lifelike swimming action/i);
  assert.match(heroPrompt, /USB charging cable included/i);
  assert.match(heroPrompt, /River lake and shore casting scenes/i);
  assert.match(heroPrompt, /rechargeable before every trip/i);
  assert.match(heroPrompt, /durable treble hooks/i);
  assert.match(heroPrompt, /night fishing visibility/i);
  assert.match(heroPrompt, /ready for multiple fishing environments/i);
  assert.doesNotMatch(heroPrompt, /Description:[^.]*(?:172|100)\s*mm/i);
  assert.match(heroPrompt, /belong to the dimension image/i);
  assert.match(heroPrompt, /3-5 small circular scene frames/i);
  assert.match(heroPrompt, /Added canvas text uses English/i);
});

test("creation planner carries the target-shopper resonance and hero information locks into universal platform slots", () => {
  const plan = buildCreationPlan({
    platform: "universal",
    productName: "Rechargeable fishing lure kit",
    productDescription: "ABS segmented lure body with internal rattle beads, lifelike swimming action, USB charging cable, and river or shore casting use.",
    sellingPoints: "ready before every trip\nnight fishing confidence",
    dimensionSpecs: "Length 172 mm; Weight 42 g",
    referenceImageRoles: [
      { filename: "kit.png", role: "package", note: "Clear storage case includes the lure, USB cable, propeller blades, and EVA float." },
    ],
    targetLanguage: "en",
    imageCount: 2,
    skuGenerationEnabled: false,
  });
  const [hero, resonance] = plan.items;

  assert.equal(hero.imageType, "generic-hero");
  assert.equal(resonance.imageType, "target-shopper-resonance");
  assert.equal(resonance.imageTypeLabel, "目标人群共鸣图");
  assert.match(resonance.prompt, /one recognizable target person or buyer viewpoint/i);
  assert.match(resonance.prompt, /one recognizable target person or buyer viewpoint/i);
  assert.match(hero.prompt, /Hero coverage:/i);
  assert.match(hero.prompt, /Clear storage case includes the lure, USB cable, propeller blades, and EVA float/i);
  assert.match(hero.prompt, /3-5 small circular scene frames/i);
  assert.doesNotMatch(hero.prompt, /HERO INFORMATION COVERAGE LOCK:[^.]*(?:172s*mm|42s*g)/i);
});

test("creation planner replaces the early selling-point card with target-shopper resonance", () => {
  const plan = buildCreationPlan({
    productName: "Portable emergency lamp",
    productDescription: "Compact rechargeable lamp for sudden outages and late-night car repairs",
    sellingPoints: "bright work light\nmagnetic base\nUSB-C charging",
    targetLanguage: "en",
    selectedRoles: ["benefit", "usage-suggestion"],
  });
  const resonance = plan.items.find((item) => item.role === "benefit");
  const sellingPoint = plan.items.find((item) => item.role === "usage-suggestion");

  assert.equal(resonance.title, "目标人群共鸣图");
  assert.equal(sellingPoint.title, "卖点图");
  assert.match(resonance.prompt, /one recognizable target person or buyer viewpoint/i);
  assert.match(resonance.prompt, /pre-purchase need, frustration, or hesitation/i);
  assert.match(resonance.prompt, /Explicit selling-point stacks belong to 卖点图/i);
  assert.doesNotMatch(resonance.prompt, /Create a selling-point image/i);
  assert.match(sellingPoint.prompt, /Create a selling-point image/i);
});

test("creation planner makes scene and effect roles feel like advertising instead of rigid templates", () => {
  const plan = buildCreationPlan({
    productName: "Rechargeable hard bait lure",
    productDescription:
      "Rechargeable lure with USB charging cable, lifelike swimming action, internal rattle beads, ABS body, treble hooks, and multiple colorways.",
    sellingPoints: "night fishing confidence\nlifelike movement\nready before every trip\nworks in river lake and shore casting",
    targetLanguage: "en",
    selectedRoles: ["scene", "effect-comparison", "atmosphere"],
  });
  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.match(promptByRole.scene, /multi-scenario application image/i);
  assert.match(promptByRole.scene, /show 2-4 believable use scenarios/i);
  assert.match(promptByRole.scene, /advertising campaign energy/i);
  assert.match(promptByRole["effect-comparison"], /single-product functional effect rendering/i);
  assert.match(promptByRole["effect-comparison"], /one dominant, fully visible product/i);
  assert.match(promptByRole["effect-comparison"], /single anchor/i);
  assert.match(promptByRole["effect-comparison"], /premium ecommerce 3D\/CGI or cinematic visualization/i);
  assert.match(promptByRole["effect-comparison"], /every supported function, mechanism, effect path, and outcome/i);
  assert.match(promptByRole["effect-comparison"], /Function coverage:/i);
  assert.match(promptByRole["effect-comparison"], /USB charging cable/i);
  assert.match(promptByRole["effect-comparison"], /lifelike swimming action/i);
  assert.match(promptByRole["effect-comparison"], /internal rattle beads/i);
  assert.match(promptByRole["effect-comparison"], /seamless continuous scene stitch around the same unchanged product/i);
  assert.match(promptByRole["effect-comparison"], /seamless continuous scene/i);
  assert.match(promptByRole["effect-comparison"], /seamless continuous scene/i);
  assert.doesNotMatch(promptByRole["effect-comparison"], /before-after panels|before-after payoff|advantage comparison|fast scan comparison/i);
  assert.match(promptByRole.atmosphere, /visible action, target-user cue, specific environment, and emotional trigger/i);
  assert.match(promptByRole.atmosphere, /not a flat static display, empty decorative mood, unrelated lifestyle scene, or rigid template board/i);
});

test("creation planner keeps platform-native functional renderings product-led instead of comparative", () => {
  const plan = buildCreationPlan({
    platform: "coupang",
    productName: "Portable fan",
    productDescription: "Rechargeable fan with adjustable airflow and foldable stand.",
    sellingPoints: "adjustable airflow\nrechargeable power\nfoldable stand",
    targetLanguage: "en",
    imageCount: 8,
    platformEvidence: { performance: true, dimensions: true, packageContents: true },
  });
  const lazadaPlan = buildCreationPlan({
    platform: "lazada",
    productName: "Portable fan",
    productDescription: "Rechargeable fan with adjustable airflow and foldable stand.",
    sellingPoints: "adjustable airflow\nrechargeable power\nfoldable stand",
    targetLanguage: "en",
    imageCount: 8,
    platformEvidence: { performance: true, dimensions: true, packageContents: true },
  });
  const effectItem = plan.items.find((item) => item.imageType === "comparison-proof");
  const lazadaEffectItem = lazadaPlan.items.find((item) => item.imageType === "comparison-proof");

  assert.ok(effectItem);
  assert.ok(lazadaEffectItem);
  assert.equal(effectItem.role, "effect-comparison");
  assert.equal(effectItem.imageTypeLabel, "功能效果渲染图");
  assert.equal(effectItem.composition, "single-product-functional-rendering");
  assert.match(effectItem.prompt, /one dominant, fully visible product/i);
  assert.match(effectItem.prompt, /single anchor/i);
  assert.match(effectItem.prompt, /seamless continuous scene/i);
  assert.doesNotMatch(effectItem.prompt, /side-by-side-functional-evidence|before-after panels|before-after payoff/i);
  assert.doesNotMatch(
    `${effectItem.prompt}\n${lazadaEffectItem.prompt}`,
    /comparison-friendly product information|included items, comparison, and a portrait detail asset/i,
  );
});

test("creation planner keeps hard information roles factual instead of emotional conversion prompts", () => {
  const plan = buildCreationPlan({
    productName: "Rechargeable hard bait lure",
    productDescription: "Rechargeable hard bait lure for shallow water. Length 13cm. Weight 42g. ABS body.",
    sellingPoints: "realistic action\nstable swimming",
    targetLanguage: "en",
    dimensionSpecs: "Length 13cm, weight 42g",
  });
  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.doesNotMatch(promptByRole["size-capacity-fit"], /Shopper question:/i);
  assert.doesNotMatch(promptByRole["spec-table"], /Shopper question:/i);
  assert.match(promptByRole["size-capacity-fit"], /Show the product with accurate callout measurement lines/i);
  assert.match(promptByRole["spec-table"], /Role intent: create a product-led key-spec explanation/i);
  assert.doesNotMatch(
    promptByRole["size-capacity-fit"],
    /shopper emotion|emotional payoff|owning this in my life|scenario imagination|purchase momentum|cover hero, benefits, lifestyle|this role's conversion job/i,
  );
  assert.doesNotMatch(
    promptByRole["spec-table"],
    /shopper emotion|emotional payoff|owning this in my life|scenario imagination|purchase momentum|cover hero, benefits, lifestyle|this role's conversion job/i,
  );
});

test("creation planner turns specification tables into product-led key-spec explanations", () => {
  const plan = buildCreationPlan({
    productName: "Inflatable river tube",
    productDescription: "Two-seat inflatable river tube with backrests and center cooler.",
    sellingPoints: "two seats\nback support\ncenter cooler",
    targetLanguage: "en",
    dimensionUnitMode: "metric",
    dimensionSpecs: [
      "Length 238cm",
      "Length 99cm",
      "Height 58cm",
      "Width 71cm",
      "Width 48cm",
      "Depth 43cm",
      "Weight 1.2kg",
    ].join("\n"),
    selectedRoles: ["spec-table"],
  });

  const prompt = plan.items[0].prompt;
  assert.match(plan.dimensionSpecs, /Length 99cm/);
  assert.match(plan.dimensionSpecs, /Width 48cm/);
  assert.match(plan.dimensionSpecs, /Depth 43cm/);
  assert.match(prompt, /Visible key specifications, the complete set for this image/i);
  assert.match(prompt, /Visible key specifications, the complete set for this image: Length 238cm \/ Height 58cm \/ Width 71cm \/ Weight 1\.2kg/i);
  assert.doesNotMatch(prompt, /Length 99cm|Width 48cm|Depth 43cm/i);
  assert.match(prompt, /product visually dominant/i);
  assert.match(prompt, /measurement line or local callout on the product/i);
  assert.match(prompt, /lives as a measurement line or local callout on the product/i);
  assert.doesNotMatch(prompt, /Mandatory visible specification labels: render every listed/i);
});

test("creation planner keeps overlong product descriptions bounded and role-useful", () => {
  const longDescription = Array.from({ length: 180 }, (_, index) =>
    `feature${index + 1} realistic fishing lure ABS body treble hooks reflective scales long cast stable swim action pain point low visibility stiff lure replacement`,
  ).join(" ");
  const plan = buildCreationPlan({
    productName: "",
    productDescription: longDescription,
    sellingPoints: "",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit", "product-detail"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.ok(plan.items.every((item) => item.prompt.length < 8000));
  assert.doesNotMatch(promptByRole.hero, new RegExp(`Product: ${longDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.doesNotMatch(promptByRole["product-detail"], new RegExp(longDescription.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.notEqual(plan.items.find((item) => item.role === "benefit").sourceFocus.selling, "围绕商品核心价值提炼短卖点");
  assert.match(promptByRole.benefit, /pain point|low visibility|stable swim action/);
  assert.match(promptByRole["product-detail"], /ABS body|treble hooks|reflective scales/);
});

test("creation planner keeps numbered kit descriptions from becoming orphan number fragments", () => {
  const productDescription = [
    "配置清单：",
    "1.创口贴*20片",
    "2.5*450cmPBT绷带*3卷",
    "3.7.5*450cmPBT绷带*3卷",
    "7.40*60cm烧伤敷料*1包",
    "16.TPE止血带*1个",
    "21.急救包*1个",
  ].join("\n\n");
  const plan = buildCreationPlan({
    productName: "急救包",
    productDescription,
    sellingPoints: "",
    targetLanguage: "zh-CN",
    selectedRoles: ["hero", "benefit", "accessory-gift"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.doesNotMatch(promptByRole.hero, /Description: 1 \/ 创口贴\*20片 \/ 2/u);
  assert.doesNotMatch(promptByRole["accessory-gift"], /Description: 配置清单：\./u);
  assert.match(promptByRole.benefit, /创口贴\*20片|PBT绷带|烧伤敷料|止血带/u);
  assert.match(promptByRole["accessory-gift"], /创口贴\*20片|5\*450cmPBT绷带|7\.5\*450cmPBT绷带/u);
});

test("creation planner keeps complete first aid inventory facts for package images", () => {
  const productDescription = [
    "Package checklist:",
    "1.Small Bandage*80",
    "2.H Style Bandages*10",
    "3.Emergency Blanket*1",
    "4.Bandages Teiangularire*1",
    "5.Cotton Swab*100",
    "6.Round Bandages*10",
    "7.Butterfly Bandages*10",
    "8.Safety Pin*20",
    "9.PBT Bandage*1 (Large)",
    "10.PBT Bandage*2 (Small)",
    "11.PBT Bandage*2 (Medium)",
    "12.Non-woven tape*1",
    "13.TPE Toumiquet*1",
    "14.Whistle*1",
    "15.Adhesive dressing*1",
    "16.Soap Wipe*16",
    "17.Tweezers*1",
    "18.Scissor*1",
    "19.First aid Kit*1",
  ].join("\n");
  const plan = buildCreationPlan({
    productName: "First Aid Kit",
    productDescription,
    sellingPoints: "",
    targetLanguage: "en",
    selectedRoles: ["hero", "accessory-gift"],
    referenceImageRoles: [
      {
        filename: "kit-checklist.png",
        role: "package",
        note: "Full product checklist with 19 numbered included items and quantities.",
      },
    ],
  });

  const packagePrompt = plan.items.find((item) => item.role === "accessory-gift").prompt;

  assert.match(packagePrompt, /Small Bandage\*80/);
  assert.match(packagePrompt, /PBT Bandage\*2 \(Medium\)/);
  assert.match(packagePrompt, /Tweezers\*1/);
  assert.match(packagePrompt, /Scissor\*1/);
  assert.match(packagePrompt, /First aid Kit\*1/);
  assert.match(packagePrompt, /Lay the main product and every confirmed accessory/i);
  assert.match(packagePrompt, /each item and quantity fully visible/i);
});

test("creation planner lays out included items unpacked instead of putting them in a cardboard box", () => {
  const plan = buildCreationPlan({
    productName: "Inflatable river tube set",
    productDescription: "Package contents: inflatable river tube*1, hand pump*1, repair patch*2.",
    sellingPoints: "complete supplied set",
    targetLanguage: "en",
    selectedRoles: ["accessory-gift"],
  });

  const prompt = plan.items[0].prompt;
  assert.match(prompt, /on a clean open surface/i);
  assert.match(prompt, /fully visible outside any container/i);
  assert.match(prompt, /fully visible outside any container/i);
  assert.match(prompt, /any confirmed packaging as one separate item beside the unpacked contents/i);
  assert.match(prompt, /separate item beside the unpacked contents/i);
  assert.match(prompt, /inflatable river tube\*1/i);
  assert.match(prompt, /hand pump\*1/i);
  assert.match(prompt, /repair patch\*2/i);
});

test("creation planner carries the information-image locks into named platform slots", () => {
  const plan = buildCreationPlan({
    platform: "jd",
    productName: "Inflatable river tube set",
    productDescription: "Package contents: inflatable river tube*1, hand pump*1, repair patch*2.",
    sellingPoints: "complete supplied set",
    targetLanguage: "en",
    referenceImageRoles: [
      { filename: "size.png", role: "dimensions", note: "Length 238cm, Height 58cm, Width 71cm, Weight 1.2kg" },
      { filename: "package.png", role: "package", note: "Package contents: inflatable river tube*1, hand pump*1, repair patch*2" },
    ],
  });

  const specItem = plan.items.find((item) => item.imageType === "spec-table");
  const packageItem = plan.items.find((item) => item.imageType === "in-box");
  assert.ok(specItem);
  assert.ok(packageItem);
  assert.equal(specItem.composition, "product-led-key-spec-callouts");
  assert.equal(packageItem.composition, "unpacked-included-items-flat-lay");
  assert.match(specItem.prompt, /Keep the product visually dominant and anchor at most four/i);
  assert.match(packageItem.prompt, /on a clean open surface/i);
  assert.match(packageItem.prompt, /outside any container/i);
});

test("creation planner avoids duplicated punctuation in composed prompt fields", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear.",
    productDescription: "Transparent portable coffee brewer.",
    sellingPoints: ["Brew anywhere.", "Leakproof!"],
    targetLanguage: "en",
  });

  const prompt = plan.items[0].prompt;
  assert.match(prompt, /Product: AeroPress Clear\./);
  assert.match(prompt, /Hero coverage:[\s\S]*Transparent portable coffee brewer \/ Brew anywhere \/ Leakproof\./);
  assert.doesNotMatch(prompt, /\.\./);
  assert.doesNotMatch(prompt, /!\./);
});

test("creation planner gives concrete ecommerce role intent to scene, seeding, material, usage, and benefit images", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure with scale texture, steel treble hooks, and flexible tail action",
    sellingPoints: "fish ignore basic lures\nsharp hooks\ndurable material",
    targetLanguage: "en",
    selectedRoles: ["benefit", "scene", "atmosphere", "usage-suggestion", "product-detail"],
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.match(promptByRole.benefit, /target-shopper resonance image/);
  assert.match(promptByRole.benefit, /one recognizable target person or buyer viewpoint/);
  assert.match(promptByRole.benefit, /Use at most one short supporting proof cue/);
  assert.match(promptByRole.scene, /multi-scenario application image/);
  assert.match(promptByRole.scene, /pursued or struck by a fish/);
  assert.match(promptByRole.atmosphere, /decisive-moment impulse-buy atmosphere image/);
  assert.match(promptByRole.atmosphere, /believable ownership instant/);
  assert.match(promptByRole.atmosphere, /product recognizable and close/);
  assert.match(promptByRole.atmosphere, /product recognizable and close/);
  assert.match(promptByRole["usage-suggestion"], /selling-point image/i);
  assert.match(promptByRole["usage-suggestion"], /3-5 core selling points/i);
  assert.match(promptByRole["usage-suggestion"], /Treat easy setup, operation, care, wearing, charging, or connection cues as selling-point evidence/i);
  assert.match(promptByRole["usage-suggestion"], /Preserve the supplied reference product as the unchanged subject/);
  assert.match(promptByRole["usage-suggestion"], /do not redesign the lure body, paint pattern, segments, tail, hooks, lip, blade, or hardware/);
  assert.match(promptByRole["usage-suggestion"], /keep belly and tail treble hooks hanging from their original underside and tail hangers/);
  assert.match(promptByRole["usage-suggestion"], /never relocate hooks or hangers onto the top, back, side, fish mouth, or hand/);
  assert.match(promptByRole["usage-suggestion"], /attach the fishing line through the exact visible line-tie, tow eye, or split ring already present on the reference lure/);
  assert.match(promptByRole["usage-suggestion"], /if the reference lure uses a front\/nose tow eye ahead of the diving lip, use that front\/nose tow eye/);
  assert.match(promptByRole["usage-suggestion"], /do not assume or add a top\/back ring unless it is already visible in the reference/);
  assert.match(promptByRole["usage-suggestion"], /do not tie the line to the body, eye, hook hanger, belly, tail, mouth, propeller, diving lip, blade, or an invented ring/);
  assert.match(promptByRole["usage-suggestion"], /do not add a hook, loose connector, or extra ring at the lure mouth or back/);
  assert.match(promptByRole["product-detail"], /product detail proof image/);
  assert.match(promptByRole["product-detail"], /local close-up panes, macro crops, and callout labels/);
  assert.match(promptByRole["product-detail"], /surfaces, edges, structure, controls, or finish quality/);
});

test("creation planner injects Simplified Chinese target-language guidance", () => {
  const plan = buildCreationPlan({
    productName: "云感防晒衣",
    productDescription: "夏季户外轻薄防晒外套",
    sellingPoints: ["UPF50+", "冰感面料"],
    targetLanguage: "zh-CN",
  });

  assert.equal(plan.targetLanguage, "zh-CN");
  assert.equal(plan.targetLanguageLabel, "简体中文");
  assert.ok(plan.items.every((item) => item.prompt.includes("使用简体中文短营销文案")));
  assert.ok(plan.items.every((item) => item.marketingCopyLanguage === "zh-CN"));
});

test("creation planner normalizes supported target languages", () => {
  assert.equal(normalizeCreationTargetLanguage("en").value, "en");
  assert.equal(normalizeCreationTargetLanguage("ja").value, "ja");
  assert.equal(normalizeCreationTargetLanguage("fr").value, "fr");
  assert.equal(normalizeCreationTargetLanguage("de").value, "de");
  assert.equal(normalizeCreationTargetLanguage("es").value, "es");
  assert.equal(normalizeCreationTargetLanguage("unknown").value, "en");
});

test("creation planner injects common international target-language guidance", () => {
  const cases = [
    ["fr", "Français", /Use concise French marketing copy/],
    ["de", "Deutsch", /Use concise German marketing copy/],
    ["es", "Español", /Use concise Spanish marketing copy/],
  ];

  for (const [targetLanguage, targetLanguageLabel, promptPattern] of cases) {
    const plan = buildCreationPlan({
      productName: "Portable espresso maker",
      productDescription: "Compact manual coffee machine",
      sellingPoints: ["travel-friendly", "fast extraction"],
      targetLanguage,
    });

    assert.equal(plan.targetLanguage, targetLanguage);
    assert.equal(plan.targetLanguageLabel, targetLanguageLabel);
    assert.ok(plan.items.every((item) => promptPattern.test(item.prompt)));
    assert.ok(plan.items.every((item) => item.marketingCopyLanguage === targetLanguage));
  }
});

test("creation planner defaults to English copy and metric-plus-imperial specs", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    selectedRoles: ["size-capacity-fit"],
    dimensionSpecs: "13cm/35g",
  });

  assert.equal(normalizeCreationTargetLanguage("").value, "en");
  assert.equal(normalizeCreationDimensionUnitMode("").value, "both");
  assert.equal(plan.targetLanguage, "en");
  assert.equal(plan.targetLanguageLabel, "English");
  assert.equal(plan.dimensionUnitMode, "both");
  assert.match(plan.items[0].prompt, /Length 13cm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
  assert.match(plan.items[0].prompt, /Use concise English marketing copy/);
});

test("creation planner normalizes optional logo placement and background handling", () => {
  const logo = normalizeCreationLogoOptions({
    enabled: true,
    filename: "brand-mark.png",
    placement: "top-right",
    background: "remove-background",
  });

  assert.equal(logo.enabled, true);
  assert.equal(logo.filename, "brand-mark.png");
  assert.equal(logo.placement, "top-right");
  assert.equal(logo.background, "remove-background");
  assert.equal(logo.placementLabel, "右上");
  assert.equal(logo.backgroundLabel, "非透明底，先抠图");

  const defaultLogo = normalizeCreationLogoOptions({
    enabled: true,
    filename: "brand-mark.png",
  });
  assert.equal(defaultLogo.placement, "top-left");
  assert.equal(defaultLogo.placementLabel, "左上");
});

test("creation planner injects optional logo guidance into every generated item", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    logoOptions: {
      enabled: true,
      filename: "brand-mark.png",
      placement: "bottom-left",
      background: "transparent",
    },
  });

  assert.equal(plan.logo?.filename, "brand-mark.png");
  assert.equal(plan.logo?.placement, "bottom-left");
  assert.equal(plan.logo?.background, "transparent");
  assert.ok(plan.items.every((item) => item.prompt.includes("brand-mark.png")));
  assert.ok(plan.items.every((item) => item.prompt.includes("bottom-left")));
  assert.ok(plan.items.every((item) => item.prompt.includes("transparent logo")));
});

test("creation planner expands ecommerce scenario sets to eight images", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "detail-page",
    imageCount: "8",
  });

  assert.equal(plan.imageCount, 8);
  assert.equal(plan.scenario, "detail-page");
  assert.equal(plan.scenarioLabel, "详情页转化");
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["hero", "benefit", "scene", "multi-angle", "atmosphere", "product-detail", "brand-story", "size-capacity-fit"],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Scenario: 详情页转化")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Use concise English marketing copy")));
});

test("creation planner expands ecommerce scenario sets to twelve images", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "livestream",
    imageCount: "12",
  });

  assert.equal(plan.imageCount, 12);
  assert.equal(plan.scenario, "livestream");
  assert.equal(plan.scenarioLabel, "直播电商");
  assert.deepEqual(
    plan.items.map((item) => item.role),
    [
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
    ],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Scenario: 直播电商")));
  assert.ok(plan.items.some((item) => item.prompt.includes("macro crops, local close-up panes")));
  assert.ok(plan.items.some((item) => item.prompt.includes("staged process sequence")));
  assert.ok(plan.items.some((item) => item.prompt.includes("dimension, capacity")));
});

test("creation planner appends distinct SKU images after twelve carousel roles", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Three sellable lure colors photographed on white background",
    sellingPoints: "lifelike swim action, sharp treble hooks, durable finish",
    targetLanguage: "en",
    imageCount: "12",
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
      { filename: "green-white-bg.png", role: "product", note: "Green lure SKU subject" },
      { filename: "red-white-bg.png", role: "product", note: "Red lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
      { id: "green", title: "Green lure", filenames: ["green-white-bg.png"], note: "Green lure SKU subject" },
      { id: "red", title: "Red lure", filenames: ["red-white-bg.png"], note: "Red lure SKU subject" },
    ],
    logoOptions: {
      enabled: true,
      filename: "brand-logo.png",
      placement: "bottom-right",
      background: "transparent",
    },
  });

  const carouselRoles = plan.items.slice(0, 12).map((item) => item.role);
  const skuItems = plan.items.slice(12);

  assert.equal(plan.imageCount, 12);
  assert.equal(plan.skuImageCount, 3);
  assert.deepEqual(carouselRoles, [
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
  ]);
  assert.deepEqual(skuItems.map((item) => item.role), ["sku", "sku", "sku"]);
  assert.deepEqual(skuItems.map((item) => item.slotIndex), [13, 14, 15]);
  assert.ok(skuItems.every((item) => item.prompt.includes("SKU product image")));
  assert.ok(skuItems.every((item) => item.prompt.includes("Replace the uploaded plain photo background")));
  assert.ok(skuItems.every((item) => item.prompt.includes("kept exactly as supplied in shape, proportions, colors, materials, markings, logos, identifiers, and hardware")));
  assert.ok(skuItems.every((item) => item.prompt.includes("brand-logo.png")));
  assert.match(skuItems[0].prompt, /blue-white-bg\.png/);
  assert.match(skuItems[1].prompt, /green-white-bg\.png/);
  assert.match(skuItems[2].prompt, /red-white-bg\.png/);
});

test("creation planner defaults suite generation to eighteen carousel images", () => {
  const plan = buildCreationPlan({
    productName: "Travel bottle",
    productDescription: "Leakproof travel bottle with carry loop and silicone seal.",
    sellingPoints: "portable, leakproof, dishwasher safe",
    targetLanguage: "en",
  });

  assert.equal(normalizeCreationImageCount("99"), 18);
  assert.equal(plan.imageCount, 18);
  assert.deepEqual(plan.items.map((item) => item.role), CREATION_ITEM_ROLES.map((role) => role.role));
});

test("creation planner allows zero carousel images and forces infographic rebuild", () => {
  const plan = buildCreationPlan({
    productName: "Cooling towel 4-pack",
    productDescription: "Cooling towels packed in portable cases.",
    sellingPoints: "fast drying, clip-on case, mixed colors",
    targetLanguage: "en",
    imageCount: "0",
    infographicRebuildEnabled: "false",
    skuSubjects: [
      { id: "towel-pack", title: "Cooling towel pack", filenames: ["towel-subjects.png"] },
    ],
    referenceImageRoles: [
      { index: 1, filename: "towel-subjects.png", role: "product", note: "Four towel cases as the sellable subject group." },
      { index: 2, filename: "feature-card.png", role: "material", note: "Cooling fabric callouts and airflow diagram." },
      { index: 3, filename: "package-card.png", role: "package", note: "4 towels and 4 carrying cases." },
    ],
  });

  assert.equal(plan.imageCount, 0);
  assert.equal(plan.skuGenerationEnabled, true);
  assert.equal(plan.skuImageCount, 1);
  assert.equal(plan.infographicRebuildEnabled, true);
  assert.deepEqual(plan.selectedRoles, []);
  assert.deepEqual(plan.items.map((item) => item.role), ["sku", "infographic-rebuild", "infographic-rebuild"]);
});

test("creation planner leads every named-platform item with its native gallery strategy", () => {
  for (const platform of ["amazon", "xiaohongshu", "douyin", "shopify", "rakuten"]) {
    const plan = buildCreationPlan({
      productName: "Portable bottle",
      productDescription: "Reusable bottle shown in supplied product references",
      platform,
      skuGenerationEnabled: false,
    });

    assert.ok(plan.items.every((item) => item.prompt.startsWith(
      `Create ${plan.platformLabel} ${item.imageTypeLabel} as a platform-native gallery asset.`,
    )), platform);
    assert.ok(plan.items.every((item) => item.prompt.includes(
      `Platform gallery strategy: ${plan.platformProfile.promptInstruction}`,
    )), platform);
    const sizeItem = plan.items.find((item) => item.role === "size-capacity-fit");
    assert.ok(sizeItem, `${platform} requires a size-related item`);
    assert.match(sizeItem.prompt, /non-numeric scale or fit image/i);
    assert.match(sizeItem.prompt, /render only measurements visible in the supplied references or explicitly provided/i);
  }

  const xiaohongshu = buildCreationPlan({
    productName: "Portable bottle",
    productDescription: "Reusable bottle shown in supplied product references",
    platform: "xiaohongshu",
    skuGenerationEnabled: false,
  });
  assert.doesNotMatch(xiaohongshu.items[0].prompt, /3-5 small circular scene frames/i);
});

test("creation planner SKU toggle changes only appended SKU counts", () => {
  const input = {
    productName: "Portable bottle",
    productDescription: "Reusable bottle shown in supplied product references",
    platform: "tiktok-shop",
    skuSubjects: [
      { id: "red", filenames: ["red.png"] },
      { id: "blue", filenames: ["blue.png"] },
    ],
  };
  const enabled = buildCreationPlan({ ...input, skuGenerationEnabled: true });
  const disabled = buildCreationPlan({ ...input, skuGenerationEnabled: false });
  const carouselSnapshot = (plan) => plan.items
    .filter((item) => item.itemKind === "carousel")
    .map((item) => [item.slotKey, item.imageType]);

  assert.deepEqual(carouselSnapshot(disabled), carouselSnapshot(enabled));
  assert.equal(disabled.carouselImageCount, enabled.carouselImageCount);
  assert.equal(enabled.skuImageCount, 2);
  assert.equal(disabled.skuImageCount, 0);
  assert.equal(enabled.totalPlannedItemCount - disabled.totalPlannedItemCount, 2);
});

test("creation planner treats sixteen-image suites as a selectable ten-image upload candidate pool", () => {
  const plan = buildCreationPlan({
    productName: "Golf cocktail graphic tee",
    productDescription:
      "Oversized heavyweight cotton T-shirt with vintage screen print, course-to-club lifestyle, wash texture, size chart, care guide, colorways, packaging stickers, and return guarantee.",
    sellingPoints:
      "100% natural cotton\nheavyweight washed denim blue\nvintage screen print\nrelaxed summer golf outfit\ncustom stickers and dust bag",
    targetLanguage: "en",
    imageCount: "16",
  });
  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.equal(plan.imageCount, 16);
  assert.match(promptByRole.hero, /Shopper question:/i);
  assert.match(promptByRole.hero, /Shopper question:/i);
  assert.match(promptByRole.hero, /Shopper question:/i);
  assert.match(promptByRole["spec-table"], /Shopper question:/i);
  assert.match(promptByRole["craft-process"], /Shopper question:/i);
  assert.match(promptByRole["usage-suggestion"], /Shopper question:/i);
  assert.match(promptByRole.hero, /Shopper question:/i);
});

test("creation planner supports the refactored ecommerce image types with dedicated rules", () => {
  const roleValues = CREATION_ITEM_ROLES.map((role) => role.role);
  assert.ok(roleValues.includes("multi-angle"));
  assert.ok(roleValues.includes("craft-process"));
  assert.ok(roleValues.includes("series-showcase"));
  assert.ok(roleValues.includes("ingredient-material"));
  assert.ok(roleValues.includes("brand-story"));
  assert.ok(roleValues.includes("human-handheld"));
  assert.ok(roleValues.includes("human-wearable"));
  assert.ok(!roleValues.includes("image-decomposition"));
  assert.ok(!roleValues.includes("feature-callout"));
  assert.equal(CREATION_ITEM_ROLES.find((role) => role.role === "ingredient-material")?.title, "材质成分解析图");
  assert.equal(CREATION_ITEM_ROLES.find((role) => role.role === "human-handheld")?.title, "真人手持展示图");
  assert.equal(CREATION_ITEM_ROLES.find((role) => role.role === "human-wearable")?.title, "真人穿戴场景图");

  const plan = buildCreationPlan({
    productName: "Modular desk lamp",
    productDescription: "LED desk lamp with adjustable arm, USB-C power, replaceable diffuser, desk clamp compatibility, factory test card, and maker craft notes.",
    sellingPoints: "stable clamp, three brightness levels, replaceable diffuser, easy cleaning, tested wiring, workshop-built hinge",
    targetLanguage: "en",
    selectedRoles: [
      "craft-process",
      "series-showcase",
      "spec-table",
      "usage-suggestion",
      "brand-story",
      "ingredient-material",
      "human-handheld",
      "human-wearable",
    ],
  });

  assert.deepEqual(plan.selectedRoles, [
    "craft-process",
    "series-showcase",
    "spec-table",
    "usage-suggestion",
    "brand-story",
    "ingredient-material",
    "human-handheld",
    "human-wearable",
  ]);
  assert.match(plan.items.find((item) => item.role === "craft-process").prompt, /quality and craft proof image/i);
  assert.match(plan.items.find((item) => item.role === "series-showcase").prompt, /variant and SKU choice image/i);
  assert.match(plan.items.find((item) => item.role === "spec-table").prompt, /product-led key-specification explainer/i);
  assert.match(plan.items.find((item) => item.role === "usage-suggestion").prompt, /selling-point image/i);
  assert.match(plan.items.find((item) => item.role === "brand-story").prompt, /many-scene use-and-style collage/i);
  assert.match(plan.items.find((item) => item.role === "ingredient-material").prompt, /material or ingredient analysis image/i);
  assert.match(plan.items.find((item) => item.role === "human-handheld").prompt, /real-person handheld demonstration image/i);
  assert.match(plan.items.find((item) => item.role === "human-wearable").prompt, /real-person worn or carried demonstration image/i);
  assert.doesNotMatch(plan.items.find((item) => item.role === "ingredient-material").prompt, /certification and trust proof/i);
  assert.match(plan.items.find((item) => item.role === "ingredient-material").prompt, /Visualize the supplied ingredients, materials, components, or composition facts/i);
  assert.match(plan.items.find((item) => item.role === "human-handheld").prompt, /Keep a live person in frame/i);
  assert.match(plan.items.find((item) => item.role === "human-wearable").prompt, /live model visibly wearing, carrying, shouldering, or using the exact product/i);
});

test("creation planner applies SKU generation rules for package-list content and dimensions", () => {
  assert.deepEqual(
    CREATION_SKU_GENERATION_RULE_OPTIONS.map((option) => option.value),
    ["color-name-under-subject", "none", "package-list", "dimensions", "package-list-dimensions"],
  );
  assert.equal(normalizeCreationSkuGenerationRule("").value, "color-name-under-subject");
  assert.equal(normalizeCreationSkuGenerationRule("package-list-dimensions").value, "package-list-dimensions");
  assert.equal(normalizeCreationSkuGenerationRule("bad-value").value, "color-name-under-subject");

  const plan = buildCreationPlan({
    productName: "Travel bottle bundle",
    productDescription: [
      "Package checklist:",
      "Bottle body*1",
      "Cleaning brush*1",
      "Spare silicone seal*2",
      "Canvas pouch*1",
    ].join("\n"),
    sellingPoints: "8 cm diameter, 24 cm height, 750 ml capacity, leakproof travel kit",
    dimensionSpecs: "Height 24 cm, diameter 8 cm, capacity 750 ml",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuGenerationRule: "package-list-dimensions",
    referenceImageRoles: [
      { filename: "bottle-blue.png", role: "product", note: "Blue bottle SKU subject." },
      { filename: "packing-list.png", role: "package", note: "Use as package checklist content only: bottle body, brush, spare seals, canvas pouch." },
      { filename: "size-card.png", role: "dimensions", note: "Dimension values: Height 24 cm, diameter 8 cm, capacity 750 ml." },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue bottle", filenames: ["bottle-blue.png"], note: "Blue SKU." },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(plan.skuGenerationRule, "package-list-dimensions");
  assert.equal(plan.skuGenerationRuleLabel, "显示清单和尺寸");
  assert.deepEqual(skuItem.skuSupportingReferenceRoles, ["dimensions"]);
  assert.match(skuItem.prompt, /SKU generation rule: add package-list content and dimensions/i);
  assert.match(skuItem.prompt, /Bottle body\*1/);
  assert.match(skuItem.prompt, /Spare silicone seal\*2/);
  assert.match(skuItem.prompt, /Height 24 cm, diameter 8 cm, capacity 750 ml/);
  assert.match(skuItem.prompt, /Package-list content as facts only/i);
});

test("creation planner defaults SKU generation to show English color names under subjects", () => {
  const plan = buildCreationPlan({
    productName: "Silicone pet collar",
    productDescription: "Soft waterproof pet collar with multiple colorways",
    sellingPoints: "soft touch, waterproof, adjustable",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      { id: "red-collar", title: "red collar", filenames: ["red-collar.png"], note: "recognized color is red" },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(plan.skuGenerationRule, "color-name-under-subject");
  assert.equal(skuItem.title, "SKU image 1 - red");
  assert.match(skuItem.prompt, /SKU generation rule: one short centered color-name label/i);
  assert.match(skuItem.prompt, /Color label line under the subject follows\.\nred\n/);
});

test("creation planner labels every visible unit color under grouped SKU subjects", () => {
  const plan = buildCreationPlan({
    productName: "Cooling towel 4-pack",
    productDescription: "Clip-on cooling towel set with four visible color variants.",
    sellingPoints: "portable, fast drying, mixed colors",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      {
        id: "cooling-towel-4-pack",
        title: "Cooling towel 4-pack",
        filenames: ["cooling-towel-4-pack.png"],
        colorName: "blue, gray, black, silver",
        subjectUnitCount: 4,
        note: "Four complete visible product units: blue, gray, black, and silver cases.",
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.match(skuItem.prompt, /each complete visible product unit carries its own centered color-name label/i);
  assert.match(
    skuItem.prompt,
    /Color label lines in product-unit order follow\.\nblue\ngray\nblack\nsilver\n/,
  );
  assert.equal(skuItem.title, "SKU image 1 - blue / gray / black / silver");
  assert.match(skuItem.prompt, /each complete visible product unit carries its own centered color-name label/i);
});

test("creation planner keeps visually distinct backpack SKU colors exact", () => {
  const plan = buildCreationPlan({
    productName: "Travel backpack",
    productDescription: "Four backpack colorways with shared charcoal trim",
    sellingPoints: "breathable back panel, large capacity",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      { id: "navy", title: "Backpack SKU 1", filenames: ["sku-1.png"], colorName: "navy blue" },
      { id: "cyan", title: "Backpack SKU 2", filenames: ["sku-2.png"], colorName: "cyan" },
      { id: "orange", title: "Backpack SKU 3", filenames: ["sku-3.png"], colorName: "orange" },
      { id: "red", title: "Backpack SKU 4", filenames: ["sku-4.png"], colorName: "red" },
    ],
  });
  const skuPrompts = plan.items.filter((item) => item.role === "sku").map((item) => item.prompt);

  assert.match(skuPrompts[0], /Color label line under the subject follows\.\nnavy blue\n/);
  assert.match(skuPrompts[1], /Color label line under the subject follows\.\ncyan blue\n/);
  assert.match(skuPrompts[2], /Color label line under the subject follows\.\norange\n/);
  assert.match(skuPrompts[3], /Color label line under the subject follows\.\nred\n/);
  assert.ok(skuPrompts.every((prompt) => !/Color label line under the subject follows\.\nwhite\n/.test(prompt)));
});

test("creation reference analysis carries structured SKU colors into generation prompts", () => {
  const analysis = normalizeCreationReferenceAnalysis({
    summary: "Four backpack colorways.",
    reference_roles: [
      { index: 1, filename: "sku-1.png", role: "product", note: "深蓝色背包主体。" },
      { index: 2, filename: "sku-2.png", role: "product", note: "亮蓝色背包主体。" },
      { index: 3, filename: "sku-3.png", role: "product", note: "橙色背包主体。" },
      { index: 4, filename: "sku-4.png", role: "product", note: "红色背包主体。" },
    ],
    sku_subjects: [
      { id: "navy", title: "Backpack 1", reference_indexes: [1], filenames: ["sku-1.png"], subject_unit_count: 1, color_names: ["navy blue"], note: "深蓝色背包。" },
      { id: "cyan", title: "Backpack 2", reference_indexes: [2], filenames: ["sku-2.png"], subject_unit_count: 1, color_names: ["cyan"], note: "亮蓝色背包。" },
      { id: "orange", title: "Backpack 3", reference_indexes: [3], filenames: ["sku-3.png"], subject_unit_count: 1, color_names: ["orange"], note: "橙色背包。" },
      { id: "red", title: "Backpack 4", reference_indexes: [4], filenames: ["sku-4.png"], subject_unit_count: 1, color_names: ["red"], note: "红色背包。" },
    ],
  }, ["sku-1.png", "sku-2.png", "sku-3.png", "sku-4.png"]);
  const plan = buildCreationPlan({
    productName: "Travel backpack",
    productDescription: "Four backpack colorways",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: analysis.recommendations,
    skuSubjects: analysis.skuSubjects,
  });

  assert.deepEqual(analysis.skuSubjects.map((subject) => subject.colorName), ["navy blue", "cyan", "orange", "red"]);
  assert.deepEqual(
    plan.items.filter((item) => item.role === "sku").map((item) => item.skuSubject.colorName),
    ["navy blue", "cyan", "orange", "red"],
  );
});

test("creation planner never guesses a missing SKU color label", () => {
  const plan = buildCreationPlan({
    productName: "Travel backpack",
    productDescription: "Backpack product reference",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      { id: "sku-unknown", title: "Backpack SKU", filenames: ["sku-unknown.png"] },
    ],
  });
  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(skuItem.title, "SKU image 1");
  assert.equal(skuItem.filenameToken, "sku-1");
  assert.equal(skuItem.skuSubject.id, "sku-unknown");
  assert.deepEqual(skuItem.skuSubject.filenames, ["sku-unknown.png"]);
  assert.match(skuItem.prompt, /stays free of any color-name label/i);
  assert.doesNotMatch(skuItem.prompt, /Visible SKU color label line under the subject follows/i);
});

test("creation planner keeps single multi-color SKU subjects as one color label", () => {
  const plan = buildCreationPlan({
    productName: "Blue silver fishing lure",
    productDescription: "A single lure body with a blue and silver finish.",
    sellingPoints: "reflective finish, sharp hooks",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      {
        id: "blue-silver-lure",
        title: "Blue silver fishing lure",
        filenames: ["blue-silver-lure.png"],
        note: "One complete visible product unit with blue and silver finish.",
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.match(skuItem.prompt, /Color label line under the subject follows\.\nblue silver\n/);
  assert.doesNotMatch(skuItem.prompt, /"blue silver"|blue, silver/);
  assert.match(skuItem.prompt, /holds color words only, space-separated/i);
  assert.doesNotMatch(skuItem.prompt, /Visible SKU color label lines for the grouped subject/i);
  assert.doesNotMatch(skuItem.prompt, /each complete visible product unit needs its own label/i);
});

test("creation planner preserves a recognized compound-color hyphen", () => {
  const plan = buildCreationPlan({
    productName: "Travel pouch",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      {
        id: "light-variant",
        title: "Light variant",
        filenames: ["light-variant.png"],
        colorNames: ["off-white"],
        note: "One complete visible product unit.",
      },
    ],
  });
  const skuItem = plan.items.find((item) => item.role === "sku");
  const labelLine = skuItem.prompt.match(/Color label line under the subject follows\.\n([^\n]+)/)?.[1];

  assert.equal(labelLine, "off-white");
  assert.match(labelLine, /^[\p{L}\p{N}]+(?:[ -][\p{L}\p{N}]+)*$/u);
  assert.match(skuItem.prompt, /hyphen inside a compound name such as off-white/i);
});

test("creation reference analysis strips component words from a goggles color label", () => {
  const analysis = normalizeCreationReferenceAnalysis({
    summary: "One riding-goggles SKU.",
    reference_roles: [
      { index: 1, filename: "brown-goggles.png", role: "product", note: "One complete visible riding-goggles product unit." },
    ],
    sku_subjects: [
      {
        id: "brown-goggles",
        title: "Brown riding goggles",
        reference_indexes: [1],
        filenames: ["brown-goggles.png"],
        subject_unit_count: 1,
        color_names: ["brown, black, silver lenses"],
        note: "One complete visible unit with a brown exterior, black strap, and silver lenses.",
      },
    ],
  }, ["brown-goggles.png"]);
  const plan = buildCreationPlan({
    productName: "Riding goggles",
    productDescription: "Protective riding goggles shown in the supplied product reference.",
    targetLanguage: "zh-CN",
    selectedRoles: ["hero"],
    referenceImageRoles: analysis.recommendations,
    skuSubjects: analysis.skuSubjects,
  });
  const skuItem = plan.items.find((item) => item.role === "sku");
  const labelLine = skuItem.prompt.match(/Color label line under the subject follows\.\n([^\n]+)/)?.[1];

  assert.deepEqual(analysis.skuSubjects[0].colorNames, ["brown black silver"]);
  assert.equal(skuItem.title, "SKU image 1 - 棕黑银色");
  assert.equal(labelLine, "棕色 黑色 银色");
  assert.doesNotMatch(labelLine, /brown|black|silver/i);
  assert.match(skuItem.prompt, /in the selected target language/i);
  assert.match(skuItem.prompt, /holds color words only/i);
});

test("creation planner compacts Chinese multi-color SKU item names without changing the prompt label", () => {
  const plan = buildCreationPlan({
    productName: "Three-color fishing lure",
    productDescription: "A single lure body with red, black, and blue finish.",
    targetLanguage: "zh-CN",
    selectedRoles: ["hero"],
    skuSubjects: [
      {
        id: "triple-color-lure",
        title: "red black blue fishing lure",
        filenames: ["triple-color-lure.png"],
        note: "One complete visible product unit.",
      },
    ],
  });
  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(skuItem.title, "SKU image 1 - 红黑蓝色");
  assert.match(skuItem.prompt, /Color label line under the subject follows\.\n红色 黑色 蓝色\n/);
});

test("creation planner preserves grouped multi-color label boundaries", () => {
  const plan = buildCreationPlan({
    productName: "Riding goggles pair",
    productDescription: "Two visible riding-goggles variants.",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      {
        id: "goggles-pair",
        title: "Riding goggles pair",
        filenames: ["goggles-pair.png"],
        subjectUnitCount: 2,
        colorNames: ["brown, black strap, silver lenses", "red, black strap, gray lenses"],
        note: "Two complete visible product units.",
      },
    ],
  });
  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.match(
    skuItem.prompt,
    /Color label lines in product-unit order follow\.\nbrown black silver\nred black gray\n/,
  );
  assert.doesNotMatch(skuItem.prompt, /"brown black silver"|brown, black, silver|"red black gray"|red, black, gray/);
  assert.doesNotMatch(skuItem.prompt, /black strap|silver lenses|gray lenses/i);
});

test("creation planner does not infer a color after analysis explicitly marks it unsafe", () => {
  const analysis = normalizeCreationReferenceAnalysis({
    summary: "One product reference with unclear reflected colors.",
    reference_roles: [
      { index: 1, filename: "brown-reflection.png", role: "product", note: "One complete product unit with unclear reflections." },
    ],
    sku_subjects: [
      {
        id: "uncertain-color",
        title: "Brown reflection goggles",
        reference_indexes: [1],
        filenames: ["brown-reflection.png"],
        subject_unit_count: 1,
        color_names: [],
        note: "One complete product unit; physical colors are not safely distinguishable from reflections.",
      },
    ],
  }, ["brown-reflection.png"]);
  const plan = buildCreationPlan({
    productName: "Riding goggles",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: analysis.recommendations,
    skuSubjects: analysis.skuSubjects,
  });
  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.deepEqual(analysis.skuSubjects[0].colorNames, []);
  assert.match(skuItem.prompt, /The exact SKU color name is unavailable/);
  assert.doesNotMatch(skuItem.prompt, /Visible SKU color label line under the subject follows/);
});

test("creation planner keeps repeated labels for matching grouped units", () => {
  const plan = buildCreationPlan({
    productName: "Matching riding goggles pair",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      {
        id: "matching-goggles-pair",
        title: "Matching riding goggles pair",
        filenames: ["matching-goggles-pair.png"],
        subjectUnitCount: 2,
        colorNames: ["black, silver lenses", "black, silver lenses"],
        note: "Two complete visible product units with matching colors.",
      },
    ],
  });
  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.match(
    skuItem.prompt,
    /Color label lines in product-unit order follow\.\nblack silver\nblack silver\n/,
  );
  assert.doesNotMatch(skuItem.prompt, /"black silver"|black, silver/);
});

test("creation planner removes non-color words from historical SKU labels", () => {
  const plan = buildCreationPlan({
    productName: "Travel pouch",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      {
        id: "legacy-pouch",
        title: "Travel pouch Model X",
        filenames: ["legacy-pouch.png"],
        colorNames: ["matte olive green nylon pouch, rose gold buckle, Model X"],
        note: "One complete visible product unit.",
      },
    ],
  });
  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.match(skuItem.prompt, /Color label line under the subject follows\.\nolive green rose gold\n/);
  assert.doesNotMatch(skuItem.prompt, /"olive green rose gold"|olive green, rose gold/);
  assert.doesNotMatch(skuItem.prompt, /(?:matte|nylon|pouch|buckle|Model X).*\nRender that exact color-only line/i);
});

test("creation planner preserves explicit grouped SKU colors outside the color dictionary", () => {
  const plan = buildCreationPlan({
    productName: "Travel pouch two-pack",
    productDescription: "Two visible pouch color variants packed as one SKU.",
    sellingPoints: "water-resistant, compact",
    targetLanguage: "es",
    selectedRoles: ["hero"],
    skuSubjects: [
      {
        id: "travel-pouch-2-pack",
        title: "Travel pouch two-pack",
        filenames: ["travel-pouch-2-pack.png"],
        colorName: "azul marino, beige",
        subjectUnitCount: 2,
        note: "Two complete visible product units.",
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.match(
    skuItem.prompt,
    /Color label lines in product-unit order follow\.\nazul marino\nbeige\n/,
  );
  assert.doesNotMatch(skuItem.prompt, /"azul marino"|"beige"|azul marino, beige/);
  assert.match(skuItem.prompt, /Place each line's color words below its matching unit/i);
});

test("creation planner SKU prompts treat source card text as non-subject noise", () => {
  const plan = buildCreationPlan({
    productName: "Paisley neck gaiter",
    productDescription: "Neck gaiter product photographed on a white SKU card with a corner promo badge.",
    sellingPoints: "soft fabric, paisley print, multiple colors",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      {
        filename: "WB-M-C-28-red-original.jpg",
        role: "product",
        note: "Red paisley neck gaiter subject. The source card also has 2025 NEW and bottom SKU/color text.",
      },
    ],
    skuSubjects: [
      {
        id: "light-gray",
        title: "WB-M-C-25 Light Gray",
        filenames: ["WB-M-C-28-red-original.jpg"],
        note: "Generate the light gray colorway from the neck gaiter subject.",
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.match(skuItem.prompt, /Visible text is limited to this SKU template's required product code or color label/);
  assert.match(skuItem.prompt, /source-card badges, stickers, price tags, captions, and watermarks stay out/);
  assert.match(skuItem.prompt, /Visible text is limited to this SKU template's required product code or color label/);
  assert.doesNotMatch(skuItem.prompt, /Preserve the SKU subject exactly:.*printed text/);
});

test("creation planner names SKU items and filename tokens by reliable color without source identifiers", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Two sellable lure colors photographed on white background",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    skuSubjects: [
      { id: "blue", title: "blue-white-bg.png", filenames: ["blue-white-bg.png"], colorNames: ["blue"], note: "Blue lure SKU subject" },
      { id: "green", title: "green-white-bg.png", filenames: ["green-white-bg.png"], colorNames: ["green"], note: "Green lure SKU subject" },
    ],
  });

  const skuItems = plan.items.filter((item) => item.role === "sku");

  assert.deepEqual(
    skuItems.map((item) => item.title),
    ["SKU image 1 - blue", "SKU image 2 - green"],
  );
  assert.deepEqual(
    skuItems.map((item) => item.filenameToken),
    ["sku-1-blue", "sku-2-green"],
  );
  assert.deepEqual(
    skuItems.map((item) => [item.skuSubject.id, item.skuSubject.filenames]),
    [["blue", ["blue-white-bg.png"]], ["green", ["green-white-bg.png"]]],
  );
});

test("creation planner derives color-only SKU names from Chinese product notes", () => {
  const plan = buildCreationPlan({
    productName: "电子分节鱼形路亚饵",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "1-F4J06T620.png", role: "product", note: "保留的银灰、蓝色和多色鱼身。" },
      { filename: "1-F4J06414.jpeg", role: "product", note: "保留的棕色、金色鱼鳞纹理。" },
      { filename: "1-F4J06450.jpeg", role: "product", note: "保留的灰银色、蓝色、黄色及红色尾部配色。" },
    ],
    skuSubjects: [
      { id: "1-F4J06T620.png", title: "1-F4J06T620.png", filenames: ["1-F4J06T620.png"], note: "保留的银灰、蓝色和多色鱼身。" },
      { id: "1-F4J06414.jpeg", title: "1-F4J06414.jpeg", filenames: ["1-F4J06414.jpeg"], note: "保留的棕色、金色鱼鳞纹理。" },
      { id: "1-F4J06450.jpeg", title: "1-F4J06450.jpeg", filenames: ["1-F4J06450.jpeg"], note: "保留的灰银色、蓝色、黄色及红色尾部配色。" },
    ],
  });

  assert.deepEqual(
    plan.items.filter((item) => item.role === "sku").map((item) => item.title),
    ["SKU image 1 - silver gray blue", "SKU image 2 - brown gold", "SKU image 3 - silver gray blue yellow red"],
  );
  assert.deepEqual(
    plan.items.filter((item) => item.role === "sku").map((item) => item.filenameToken),
    ["sku-1-silver-gray-blue", "sku-2-brown-gold", "sku-3-silver-gray-blue-yellow-red"],
  );
});

test("creation planner SKU names and filename tokens omit source part numbers", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Two sellable lure colors photographed on white background",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "260526-SKU-151142-5714.png", role: "product", referenceIndex: 1 },
    ],
    skuSubjects: [
      {
        title: "SKU image 2",
        filenames: ["260526-SKU-151142-5714.png"],
        referenceIndexes: [1],
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(skuItem.title, "SKU image 1");
  assert.equal(skuItem.filenameToken, "sku-1");
  assert.doesNotMatch(`${skuItem.title} ${skuItem.filenameToken}`, /260526|151142|5714|SKU image 2/i);
  assert.equal(skuItem.skuSubject.title, "SKU image 2");
  assert.deepEqual(skuItem.skuSubject.filenames, ["260526-SKU-151142-5714.png"]);
  assert.deepEqual(skuItem.skuSubject.referenceIndexes, [1]);
  assert.match(skuItem.prompt, /260526-SKU-151142-5714\.png/);
});

test("creation planner preserves multiple units inside one SKU subject reference image", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "One product-subject reference image shows three complete lure colorways",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "three-lures.png", role: "product", note: "Product subject image contains three complete visible lure bodies: silver, gold, and green." },
    ],
    skuSubjects: [
      {
        id: "three-lures.png",
        title: "Three lure colorways",
        filenames: ["three-lures.png"],
        referenceIndexes: [1],
        note: "One product-subject reference image contains three complete visible lure bodies: silver, gold, and green.",
      },
    ],
  });

  const skuItems = plan.items.filter((item) => item.role === "sku");

  assert.equal(plan.skuImageCount, 1);
  assert.equal(skuItems.length, 1);
  assert.match(skuItems[0].prompt, /SKU subject unit count:/);
  assert.match(skuItems[0].prompt, /Keep the same number of complete visible product units/i);
  assert.match(skuItems[0].prompt, /Keep all of those units together in this single image/i);
  assert.match(skuItems[0].prompt, /Keep all of those units together in this single image/i);
  assert.match(skuItems[0].prompt, /three complete visible lure bodies/i);
});

test("creation planner enriches SKU prompts from matching reference-product notes", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "A white-background reference subject shows the sellable SKU pair",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      {
        filename: "orange-pair.png",
        role: "reference-product",
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(plan.skuImageCount, 1);
  assert.equal(skuItem.skuSubject.note, "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.");
  assert.equal(skuItem.skuSubject.subjectUnitCount, 2);
  assert.match(skuItem.prompt, /SKU subject unit count:/);
  assert.match(skuItem.prompt, /two complete visible lure bodies/i);
  assert.match(skuItem.prompt, /orange top and silver bottom/i);
});

test("creation planner infers SKU subject unit count from Chinese product notes", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "A white-background product subject reference shows four complete lure colorways",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      {
        filename: "four-lures.png",
        role: "product",
        note: "主体图包含4条完整可见路亚鱼饵，银色、绿色、红色、灰色四个色款。",
      },
    ],
    skuSubjects: [
      {
        id: "four-lures.png",
        title: "Lure assortment",
        filenames: ["four-lures.png"],
        referenceIndexes: [1],
        note: "主体图包含4条完整可见路亚鱼饵，银色、绿色、红色、灰色四个色款。",
      },
    ],
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(skuItem.skuSubject.subjectUnitCount, 4);
  assert.match(skuItem.prompt, /holds 4 complete visible product units/);
  assert.match(skuItem.prompt, /Keep the same number of complete visible product units/);
});

test("creation planner renders same-SKU combination packs without changing the subject", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Blue sellable lure photographed on white background",
    sellingPoints: "lifelike swim action, sharp treble hooks",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
    ],
    skuBundleCount: "5",
  });

  const skuItem = plan.items[1];

  assert.equal(plan.skuBundleCount, 5);
  assert.equal(plan.skuImageCount, 1);
  assert.equal(skuItem.skuSubject.bundleCount, 5);
  assert.match(skuItem.prompt, /into 5 identical units/);
  assert.match(skuItem.prompt, /exactly 5 complete visible product units/);
  assert.match(skuItem.prompt, /into 5 identical units/);
  assert.match(skuItem.prompt, /copy and arrange the supplied SKU subject/);
  assert.match(skuItem.prompt, /Every copy keeps the same shape, proportions, colors, materials, intrinsic markings, product-surface logos or model identifiers, hooks, hardware, and visible structure/);
  assert.match(skuItem.prompt, /do not introduce a second distinct SKU/);
});

test("creation planner multiplies grouped SKU subject units by same-SKU pack count", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "One grouped SKU subject contains three complete lure colorways",
    sellingPoints: "lifelike swim action, sharp hooks",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      {
        filename: "three-lures.png",
        role: "product",
        note: "One product-subject reference image contains three complete visible lure bodies: silver, gold, and green.",
      },
    ],
    skuSubjects: [
      {
        id: "three-lures",
        title: "Three lure colorways",
        filenames: ["three-lures.png"],
        subjectUnitCount: 3,
        note: "One product-subject reference image contains three complete visible lure bodies: silver, gold, and green.",
      },
    ],
    skuBundleCount: 2,
  });

  const skuItem = plan.items.find((item) => item.role === "sku");

  assert.equal(skuItem.skuSubject.subjectUnitCount, 3);
  assert.equal(skuItem.skuSubject.bundleCount, 2);
  assert.match(skuItem.prompt, /SKU subject unit count: this grouped subject holds 3 complete visible product units/);
  assert.doesNotMatch(skuItem.prompt, /Preserve the same number of complete visible product units from the supplied SKU subject reference/);
  assert.match(skuItem.prompt, /Keep 3 complete visible product units inside each duplicated grouped set/);
  assert.match(skuItem.prompt, /into 2 identical grouped sets/);
  assert.match(skuItem.prompt, /exactly 6 complete visible product units/);
  assert.match(skuItem.prompt, /into 2 identical grouped sets/);
});

test("creation planner accepts Chinese numerals for same-SKU combination packs", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Blue sellable lure photographed on white background",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
    ],
    skuBundleCount: "二",
  });

  assert.equal(plan.skuBundleCount, 2);
  assert.equal(plan.items[1].skuSubject.bundleCount, 2);
  assert.match(plan.items[1].prompt, /into 2 identical units/);
  assert.match(plan.items[1].prompt, /exactly 2 complete visible product units/);
});

test("creation planner keeps single SKU packs on the previous single-subject prompt", () => {
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "Blue sellable lure photographed on white background",
    sellingPoints: "lifelike swim action",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "blue-white-bg.png", role: "product", note: "Blue lure SKU subject" },
    ],
    skuSubjects: [
      { id: "blue", title: "Blue lure", filenames: ["blue-white-bg.png"], note: "Blue lure SKU subject" },
    ],
    skuBundleCount: "1",
  });

  assert.equal(plan.skuBundleCount, 1);
  assert.equal(plan.items[1].skuSubject.bundleCount, 1);
  assert.match(plan.items[1].prompt, /Create one SKU product image/);
  assert.doesNotMatch(plan.items[1].prompt, /identical copies of this same SKU subject/);
});

test("creation planner does not create SKU images for accessory or package references", () => {
  const skuSubjects = normalizeCreationSkuSubjects(
    [
      { id: "lure-a", title: "Main lure", filenames: ["lure-a.png"], note: "Primary sellable lure" },
      { id: "hooks", title: "Accessory hooks", filenames: ["hooks.png"], kind: "accessory", note: "Replacement hook pack" },
    ],
    [
      { filename: "lure-a.png", role: "product", note: "Primary sellable lure" },
      { filename: "hooks.png", role: "package", note: "Accessory pack" },
    ],
  );
  const plan = buildCreationPlan({
    productName: "Fishing lure assortment",
    productDescription: "One sellable lure and one accessory pack",
    sellingPoints: "durable finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "benefit"],
    infographicRebuildEnabled: false,
    referenceImageRoles: [
      { filename: "lure-a.png", role: "product", note: "Primary sellable lure" },
      { filename: "hooks.png", role: "package", note: "Accessory pack" },
    ],
    skuSubjects,
  });

  assert.deepEqual(skuSubjects.map((subject) => subject.id), ["lure-a"]);
  assert.equal(plan.imageCount, 2);
  assert.equal(plan.skuImageCount, 1);
  assert.deepEqual(plan.items.map((item) => item.role), ["hero", "benefit", "sku"]);
  assert.match(plan.items[2].prompt, /lure-a\.png/);
  assert.doesNotMatch(plan.items[2].prompt, /hooks\.png/);
});

test("creation planner keeps product SKU subjects when notes describe usage context", () => {
  const referenceImageRoles = [
    {
      filename: "图片1.jpg",
      role: "product",
      note: "用于详情页或内容场景展示双人充气漂流圈在泳池中的实际漂浮与休闲使用方式，并体现双座、靠背、中部冰饮储物区及旁侧单人浮圈的使用环境。",
    },
    {
      filename: "图片7.jpg",
      role: "product",
      note: "用于详情页或移动端内容场景展示单人款在泳池中的休闲漂浮方式，并体现靠背、单座位、双扶手、双杯孔和外围安全绳。",
    },
  ];
  const skuSubjects = referenceImageRoles.map((entry, index) => ({
    id: entry.filename,
    title: entry.filename,
    referenceIndexes: [index + 1],
    filenames: [entry.filename],
    note: entry.note,
  }));

  const normalizedSubjects = normalizeCreationSkuSubjects(skuSubjects, referenceImageRoles);
  assert.deepEqual(normalizedSubjects.map((subject) => subject.id), ["图片1.jpg", "图片7.jpg"]);

  const plan = buildCreationPlan({
    productName: "带靠背充气漂流圈",
    productDescription: "双人款和单人款充气漂流圈",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    infographicRebuildEnabled: false,
    referenceImageRoles,
    skuSubjects,
  });

  assert.equal(plan.skuImageCount, 2);
  assert.deepEqual(
    plan.items.filter((item) => item.role === "sku").map((item) => item.skuSubject.id),
    ["图片1.jpg", "图片7.jpg"],
  );
});

test("creation planner uses selected ecommerce role set when provided", () => {
  const selectedRoles = normalizeCreationSelectedRoles(["usage-suggestion", "hero", "unknown", "size-capacity-fit", "hero"]);
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "marketplace-search",
    imageCount: "12",
    selectedRoles,
  });

  assert.deepEqual(
    selectedRoles.map((role) => role.role),
    ["usage-suggestion", "hero", "size-capacity-fit"],
  );
  assert.equal(plan.imageCount, 3);
  assert.deepEqual(plan.selectedRoles, ["usage-suggestion", "hero", "size-capacity-fit"]);
  assert.deepEqual(
    plan.items.map((item) => item.role),
    ["usage-suggestion", "hero", "size-capacity-fit"],
  );
  assert.deepEqual(
    plan.items.map((item) => item.slotIndex),
    [1, 2, 3],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Scenario: 平台搜索")));
});

test("creation planner only injects selected size specifications into the dimensions role", () => {
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    selectedRoles: ["hero", "effect-comparison", "size-capacity-fit"],
    dimensionSpecs: "Height 145mm\nDiameter 110mm\nCapacity 350ml",
    dimensionUnitMode: "metric",
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const comparisonPrompt = plan.items.find((item) => item.role === "effect-comparison").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "size-capacity-fit").prompt;

  assert.equal(plan.dimensionSpecs, "Height 145mm");
  assert.match(dimensionsPrompt, /Dimension specifications for this size chart: Height 145mm\./);
  assert.doesNotMatch(dimensionsPrompt, /Diameter 110mm|Capacity 350ml/);
  assert.match(dimensionsPrompt, /Render every listed value as its own legible label here/);
  assert.match(dimensionsPrompt, /Render all recognized dimension values in metric units only\./);
  assert.doesNotMatch(heroPrompt, /145mm|110mm|350ml|Dimension specifications for this size chart only|Set-level dimension/);
  assert.doesNotMatch(comparisonPrompt, /145mm|110mm|350ml|Dimension specifications for this size chart only|Set-level dimension/);
});

test("creation planner converts dimension specs to the selected unit mode", () => {
  const metricPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    selectedRoles: ["size-capacity-fit"],
    dimensionSpecs: "Height 5.7 in\nDiameter 4.3 in\nCapacity 12 fl oz",
    dimensionUnitMode: "metric",
  });
  const bothPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    selectedRoles: ["size-capacity-fit"],
    dimensionSpecs: "Height 14.5 cm\nCapacity 350 ml",
    dimensionUnitMode: "both",
  });

  assert.equal(metricPlan.dimensionUnitMode, "metric");
  assert.match(metricPlan.items[0].prompt, /Height 14\.48 cm/);
  assert.doesNotMatch(metricPlan.items[0].prompt, /Diameter 10\.92 cm|Capacity 354\.88 ml/);
  assert.doesNotMatch(metricPlan.items[0].prompt, /5\.7 in|4\.3 in|12 fl oz/);
  assert.equal(bothPlan.dimensionUnitMode, "both");
  assert.match(bothPlan.items[0].prompt, /Height 14\.5 cm \(5\.71 in\)/);
  assert.doesNotMatch(bothPlan.items[0].prompt, /Capacity 350 ml|11\.83 fl oz/);
});

test("creation planner converts compact metric weight specs in selected unit mode", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["size-capacity-fit"],
    dimensionSpecs: "13cm/35g",
    dimensionUnitMode: "both",
  });

  assert.match(plan.items[0].prompt, /Length 13cm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
});

test("creation planner applies selected unit mode to dimensions recognized from reference notes", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "size-capacity-fit"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "lure-size-card.png",
        role: "dimensions",
        note: "Size card shows length 130mm, weight 35g, #4 hook, slow sinking.",
      },
    ],
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "size-capacity-fit").prompt;

  assert.equal(plan.dimensionUnitMode, "both");
  assert.match(dimensionsPrompt, /Dimension specifications recognized from reference notes/);
  assert.match(dimensionsPrompt, /Length 130mm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
  assert.doesNotMatch(dimensionsPrompt, /Hook Size|Sinking Rate|slow sinking/);
  assert.match(dimensionsPrompt, /Render each recognized dimension value with metric first and imperial in parentheses/);
  assert.equal(plan.dimensionSpecs, "Length 130mm (5.12 in)\nWeight 35g (1.23 oz)");
  assert.doesNotMatch(
    heroPrompt,
    /130mm|35g|5\.12 in|1\.23 oz|Set-level dimension|Dimension specifications recognized/,
  );
});

test("creation planner converts Chinese package dimensions without truncating decimal values", () => {
  assert.equal(
    formatCreationDimensionSpecsForMode("包装盒可见尺寸12.2厘米×6.5厘米", "both"),
    "包装盒可见尺寸12.2厘米 (4.8 in)×6.5厘米 (2.56 in)",
  );
});

test("creation planner locks decimal backpack weight and Chinese height width depth specs", () => {
  const plan = buildCreationPlan({
    productName: "Outdoor Backpack",
    productDescription: "Outdoor dual-shoulder backpack",
    sellingPoints: "large capacity, waterproof nylon, handheld shoulder backpack",
    targetLanguage: "en",
    selectedRoles: ["hero", "size-capacity-fit"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "backpack-spec-card.png",
        role: "dimensions",
        note: "尺寸规格影响产品规格信息：品牌、名称户外双肩包、材质防泼水尼龙、功能手挎/单肩/双背、颜色多色可选、适合户外/徒步/登山、尺寸高47cm宽31cm厚21cm，重量0.53kg。",
      },
    ],
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "size-capacity-fit").prompt;

  assert.equal(
    plan.dimensionSpecs,
    "Height 47cm (18.5 in)\nWidth 31cm (12.2 in)\nDepth 21cm (8.27 in)\nWeight 0.53kg (1.17 lb)",
  );
  assert.match(
    dimensionsPrompt,
    /Height 47cm \(18\.5 in\) \/ Width 31cm \(12\.2 in\) \/ Depth 21cm \(8\.27 in\) \/ Weight 0\.53kg \(1\.17 lb\)/,
  );
  assert.match(dimensionsPrompt, /Copy every digit[\s\S]*0\.53kg[\s\S]*1\.17 lb/);
  assert.match(dimensionsPrompt, /That includes 0\.53kg[\s\S]*character for character/);
  assert.doesNotMatch(heroPrompt, /0\.53kg|1\.17 lb|47cm|31cm|21cm|53 kg/);
});

test("creation planner dedupes noisy reference-derived dimensions and stores selected units", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented electric lure with LED light and two treble hooks",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["accessory-gift", "after-sales", "size-capacity-fit", "after-sales"],
    dimensionUnitMode: "both",
    infographicRebuildEnabled: false,
    referenceImageRoles: [
      {
        filename: "package-list.png",
        role: "package",
        note: "Package checklist area says Length 13cm, Weight 42g, Hook 2#.",
      },
      {
        filename: "hero-callouts.png",
        role: "product",
        note: "Main product card also shows 13cm, 42g, 2# Hooks.",
      },
      {
        filename: "size-spec-card.png",
        role: "dimensions",
        note: "Size & Specs card: Model F4J16, Length 13cm, Weight 42g, Hook Size 2#.",
      },
    ],
  });

  const dimensionsPrompt = plan.items.find((item) => item.role === "size-capacity-fit").prompt;
  const nonDimensionPrompts = plan.items
    .filter((item) => item.role !== "size-capacity-fit")
    .map((item) => item.prompt);

  assert.equal(
    plan.dimensionSpecs,
    "Length 13cm (5.12 in)\nWeight 42g (1.48 oz)",
  );
  assert.match(
    dimensionsPrompt,
    /Dimension specifications recognized from reference notes: Length 13cm \(5\.12 in\) \/ Weight 42g \(1\.48 oz\)\./,
  );
  assert.doesNotMatch(dimensionsPrompt, /Model F4J16|Hook Size 2#/);
  assert.doesNotMatch(dimensionsPrompt, /Package checklist area|Main product card also shows|Size & Specs card/);
  assert.equal((dimensionsPrompt.match(/13cm/g) || []).length, 1);
  assert.equal((dimensionsPrompt.match(/42g/g) || []).length, 1);
  assert.ok(
    nonDimensionPrompts.every((prompt) =>
      !/13cm|42g|5\.12 in|1\.48 oz|2#|Package checklist area|Main product card also shows|Size & Specs card/.test(prompt),
    ),
  );
});

test("creation planner prefers dimensions reference values over incidental image callout sizes", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented electric lure",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "size-capacity-fit"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "package-list.png",
        role: "package",
        note: "Package icon row includes old Length 12cm.",
      },
      {
        filename: "hero-callouts.png",
        role: "product",
        note: "Hero image has a small callout saying Length 14cm.",
      },
      {
        filename: "size-spec-card.png",
        role: "dimensions",
        note: "Size & Specs card: Model F4J16, Length 13cm, Weight 42g, Hook Size 2#.",
      },
    ],
  });

  const dimensionsPrompt = plan.items.find((item) => item.role === "size-capacity-fit").prompt;

  assert.equal(
    plan.dimensionSpecs,
    "Length 13cm (5.12 in)\nWeight 42g (1.48 oz)",
  );
  assert.match(dimensionsPrompt, /Length 13cm \(5\.12 in\)/);
  assert.doesNotMatch(dimensionsPrompt, /Model F4J16|Hook Size 2#/);
  assert.doesNotMatch(dimensionsPrompt, /12cm|14cm|Package icon row|Hero image has/);
});

test("creation planner reserves product analyst-note specifications for the dimensions role", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented swim bait",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "effect-comparison", "scene", "size-capacity-fit"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "lure-product.png",
        role: "product",
        note: "Main product photo also says length 130mm, weight 35g, #4 hook, slow sinking.",
      },
    ],
  });

  const nonDimensionPrompts = plan.items
    .filter((item) => item.role !== "size-capacity-fit")
    .map((item) => item.prompt);
  const dimensionsPrompt = plan.items.find((item) => item.role === "size-capacity-fit").prompt;

  assert.match(dimensionsPrompt, /Dimension specifications recognized from reference notes/);
  assert.match(dimensionsPrompt, /Length 130mm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
  assert.doesNotMatch(dimensionsPrompt, /Hook Size|Sinking Rate|slow sinking/);
  assert.ok(
    nonDimensionPrompts.every(
      (prompt) =>
        !/130mm|35g|5\.12 in|1\.23 oz|#4 hook|slow sinking|Analyst note: Main product photo also says/.test(prompt),
    ),
  );
  assert.ok(
    nonDimensionPrompts.every((prompt) =>
      prompt.includes("Exact size and weight values belong to the dimension image"),
    ),
  );
});

test("creation planner carries exact lure specification table values into dimensions prompt only", () => {
  const plan = buildCreationPlan({
    productName: "F4J16 jointed fishing lure",
    productDescription: "Multi-section bionic swim bait with two treble hooks",
    sellingPoints: "realistic fish profile",
    targetLanguage: "zh-CN",
    selectedRoles: ["hero", "size-capacity-fit"],
    dimensionUnitMode: "metric",
    referenceImageRoles: [
      {
        filename: "lure-size-and-weight.png",
        role: "dimensions",
        note: "尺寸和重量表显示型号 F4J16、长度 13cm、重量 42g、钩号 2#。",
      },
    ],
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "size-capacity-fit").prompt;

  assert.match(dimensionsPrompt, /长度 13cm/);
  assert.match(dimensionsPrompt, /重量 42g/);
  assert.doesNotMatch(dimensionsPrompt, /型号 F4J16|钩号 2#/);
  assert.match(dimensionsPrompt, /Dimension specifications recognized from reference notes/);
  assert.doesNotMatch(heroPrompt, /型号 F4J16、长度 13cm、重量 42g、钩号 2#/);
});

test("creation planner limits recognized lure specs to length height width depth and weight", () => {
  const plan = buildCreationPlan({
    productName: "Electric jointed fishing lure",
    productDescription: "Segmented bionic swim bait with hooks",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["hero", "size-capacity-fit"],
    dimensionUnitMode: "both",
    referenceImageRoles: [
      {
        filename: "lure-size-card.png",
        role: "dimensions",
        note: "\u5c3a\u5bf8\u89c4\u683c\uff1a\u957f\u5ea6 130mm\uff0c\u91cd\u91cf 35g\uff0c\u94a9\u5b504#\uff0c\u5c5e\u6027\u7f13\u6c89\u3002",
      },
    ],
  });

  const heroPrompt = plan.items.find((item) => item.role === "hero").prompt;
  const dimensionsPrompt = plan.items.find((item) => item.role === "size-capacity-fit").prompt;

  assert.equal(
    plan.dimensionSpecs,
    "Length 130mm (5.12 in)\nWeight 35g (1.23 oz)",
  );
  assert.match(dimensionsPrompt, /Length 130mm \(5\.12 in\) \/ Weight 35g \(1\.23 oz\)/);
  assert.doesNotMatch(dimensionsPrompt, /Hook Size 4#|Sinking Rate slow sinking/);
  assert.match(dimensionsPrompt, /Render every listed value as its own legible label here/);
  assert.match(dimensionsPrompt, /Render every listed value as its own legible label here/);
  assert.doesNotMatch(heroPrompt, /130mm|35g|Hook Size 4#|slow sinking/);
});

test("creation planner removes model hook capacity and other non-size facts from manual dimensions", () => {
  const plan = buildCreationPlan({
    productName: "F4J16 jointed fishing lure",
    productDescription: "Multi-section bionic swim bait",
    sellingPoints: "realistic finish",
    targetLanguage: "en",
    selectedRoles: ["size-capacity-fit"],
    dimensionUnitMode: "both",
    dimensionSpecs:
      "Model F4J16, Length 13cm, Width 2cm, Height 3cm, Weight 42g, Hook Size 2#, Capacity 350 ml, Sinking Rate 0.5m/s",
  });

  const dimensionsPrompt = plan.items.find((item) => item.role === "size-capacity-fit").prompt;

  assert.equal(
    plan.dimensionSpecs,
    "Length 13cm (5.12 in)\nHeight 3cm (1.18 in)\nWidth 2cm (0.79 in)\nWeight 42g (1.48 oz)",
  );
  assert.match(
    dimensionsPrompt,
    /Length 13cm \(5\.12 in\) \/ Height 3cm \(1\.18 in\) \/ Width 2cm \(0\.79 in\) \/ Weight 42g \(1\.48 oz\)/,
  );
  assert.doesNotMatch(dimensionsPrompt, /Model F4J16|Hook Size 2#|Capacity 350 ml|Sinking Rate|0\.5m/);
});

test("creation planner exposes scenario-specific role presets", () => {
  assert.deepEqual(
    getCreationScenarioRolePreset("livestream").map((role) => role.role),
    [
      "hero",
      "benefit",
      "scene",
      "usage-suggestion",
      "product-detail",
      "effect-comparison",
      "accessory-gift",
      "after-sales",
      "spec-table",
      "size-capacity-fit",
    ],
  );
  assert.deepEqual(
    getCreationScenarioRolePreset("marketplace-search").map((role) => role.role),
    ["hero", "benefit", "effect-comparison", "size-capacity-fit", "product-detail", "spec-table"],
  );
  assert.deepEqual(
    getCreationScenarioRolePreset("unknown").map((role) => role.role),
    ["hero", "benefit", "scene", "multi-angle"],
  );
});

test("creation planner applies industry templates to default role sets and prompt strategy", () => {
  const plan = buildCreationPlan({
    productName: "Glow Serum",
    productDescription: "Lightweight facial serum for daily skincare routines",
    sellingPoints: "hydrating, travel friendly, smooth texture",
    targetLanguage: "en",
    scenario: "detail-page",
    imageCount: "8",
    industryTemplate: "beauty",
  });

  assert.equal(plan.industryTemplate, "beauty");
  assert.equal(plan.industryTemplateLabel, "美妆个护");
  assert.deepEqual(
    plan.selectedRoles,
    ["hero", "benefit", "product-detail", "usage-suggestion", "ingredient-material", "atmosphere", "accessory-gift", "after-sales"],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Beauty and personal care industry template")));
  assert.ok(plan.items.every((item) => item.prompt.includes("texture, swatches, skincare use, packaging, and benefit hierarchy")));
});

test("creation planner applies fourth-level category templates to role presets and prompts", () => {
  const plan = buildCreationPlan({
    productName: "Pocket X1",
    productDescription: "Compact phone with bright screen and long battery life",
    sellingPoints: "OLED display, slim body, reliable camera",
    targetLanguage: "zh-CN",
    imageCount: 6,
    industryTemplate: "category:C06-001-001-001",
  });

  assert.equal(plan.industryTemplate, "category:C06-001-001-001");
  assert.equal(plan.industryTemplateLabel, "智能手机");
  assert.equal(plan.industryTemplatePath, "数码电子 > 手机通讯 > 手机 > 智能手机");
  assert.deepEqual(plan.selectedRoles.slice(0, 4), ["hero", "benefit", "size-capacity-fit", "usage-suggestion"]);
  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes("Ecommerce category path: 数码电子 > 手机通讯 > 手机 > 智能手机"),
    ),
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("Category template: 智能手机")));
});

test("creation planner applies category role prompt instructions to matching set images", () => {
  const selectedRoles = ["hero", "scene", "product-detail", "size-capacity-fit", "usage-suggestion"];
  const plan = buildCreationPlan({
    productName: "Pocket X1",
    productDescription: "智能手机，OLED 屏幕，长续航",
    sellingPoints: "轻薄机身, 摄像头清晰, 快充",
    targetLanguage: "zh-CN",
    imageCount: 5,
    industryTemplate: "category:C06-001-001-001",
    selectedRoles,
  });

  const promptByRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));
  const categoryStrategy = [
    "Category template: 智能手机",
    "Ecommerce category path: 数码电子 > 手机通讯 > 手机 > 智能手机",
    "Consumer electronics focus: show ports, screen or device details, dimensions, specifications, functional proof",
  ];

  assert.deepEqual(plan.selectedRoles, selectedRoles);
  assert.ok(selectedRoles.every((role) => promptByRole[role]));
  assert.ok(
    selectedRoles.every((role) => categoryStrategy.every((strategy) => promptByRole[role].includes(strategy))),
  );
  assert.match(promptByRole.scene, /通勤手持|桌面办公/);
  assert.match(promptByRole["product-detail"], /摄像头模组/);
  assert.match(promptByRole["product-detail"], /屏幕边框/);
  assert.match(promptByRole["size-capacity-fit"], /机身厚度/);
  assert.match(promptByRole["size-capacity-fit"], /握持尺度/);
  assert.match(promptByRole["usage-suggestion"], /拍摄/);
  assert.match(promptByRole["usage-suggestion"], /游戏/);
  assert.match(promptByRole["usage-suggestion"], /充电/);
  assert.match(promptByRole["usage-suggestion"], /连接/);
  assert.deepEqual(
    plan.items.filter((item) => /通勤手持|桌面办公/.test(item.prompt)).map((item) => item.role),
    ["scene"],
  );
});

test("creation planner normalizes supported industry templates", () => {
  assert.equal(normalizeCreationIndustryTemplate("apparel").value, "apparel");
  assert.equal(normalizeCreationIndustryTemplate("beauty").value, "beauty");
  assert.equal(normalizeCreationIndustryTemplate("food").value, "food");
  assert.equal(normalizeCreationIndustryTemplate("electronics").value, "electronics");
  assert.equal(normalizeCreationIndustryTemplate("home").value, "home");
  assert.equal(normalizeCreationIndustryTemplate("unknown").value, "general");
  assert.deepEqual(
    getCreationIndustryRolePreset("electronics").map((role) => role.role),
    ["hero", "benefit", "spec-table", "usage-suggestion", "product-detail", "effect-comparison", "accessory-gift", "after-sales"],
  );
  assert.deepEqual(getCreationIndustryRolePreset("general"), []);
});

test("creation planner fills larger industry template sets with remaining ecommerce roles", () => {
  const plan = buildCreationPlan({
    productName: "Pocket Camera",
    productDescription: "Compact 3C device with screen and accessory kit",
    sellingPoints: "portable, clear display, easy setup",
    targetLanguage: "en",
    imageCount: "12",
    industryTemplate: "electronics",
  });

  assert.equal(plan.imageCount, 12);
  assert.equal(plan.industryTemplate, "electronics");
  assert.deepEqual(
    plan.selectedRoles.slice(0, 8),
    ["hero", "benefit", "spec-table", "usage-suggestion", "product-detail", "effect-comparison", "accessory-gift", "after-sales"],
  );
  assert.equal(new Set(plan.selectedRoles).size, 12);
});

test("creation planner adds role-specific guidance inside each marketing scenario", () => {
  const livestreamPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "livestream",
    selectedRoles: ["usage-suggestion", "after-sales"],
  });
  const marketplacePlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "marketplace-search",
    selectedRoles: ["hero", "effect-comparison"],
  });
  const promotionPlan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean, stable taste",
    targetLanguage: "en",
    scenario: "promotion",
    selectedRoles: ["effect-comparison"],
  });
  const socialSeedingPlan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "Segmented lifelike lure with scale texture and steel treble hooks",
    sellingPoints: "lifelike finish, sharp hooks, durable material",
    targetLanguage: "en",
    scenario: "social-seeding",
    selectedRoles: ["atmosphere"],
  });

  assert.match(
    livestreamPlan.items.find((item) => item.role === "usage-suggestion").prompt,
    /host-ready stack of 3-5 supported benefits/,
  );
  assert.match(
    livestreamPlan.items.find((item) => item.role === "after-sales").prompt,
    /which real-use problem the product solves/,
  );
  assert.match(
    marketplacePlan.items.find((item) => item.role === "hero").prompt,
    /thumbnail-first listing image/,
  );
  assert.match(
    marketplacePlan.items.find((item) => item.role === "effect-comparison").prompt,
    /crowded search result pages/,
  );
  const marketplaceEffectPrompt = marketplacePlan.items.find((item) => item.role === "effect-comparison").prompt;
  const promotionEffectPrompt = promotionPlan.items.find((item) => item.role === "effect-comparison").prompt;
  assert.match(marketplaceEffectPrompt, /one dominant product and its supported functional effect/i);
  assert.match(promotionEffectPrompt, /one dominant product in a unified functional rendering/i);
  assert.match(promotionEffectPrompt, /without before-after or comparison layouts/i);
  assert.doesNotMatch(`${marketplaceEffectPrompt}\n${promotionEffectPrompt}`, /advantage comparison|fast scan comparison|before-after payoff/i);
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "atmosphere").prompt,
    /mood, visible action, target-user cue, and lifestyle aspiration/,
  );
  assert.match(
    socialSeedingPlan.items.find((item) => item.role === "atmosphere").prompt,
    /without hiding it/,
  );
  assert.doesNotMatch(
    socialSeedingPlan.items.find((item) => item.role === "atmosphere").prompt,
    /believable user recommendation/,
  );
  assert.doesNotMatch(socialSeedingPlan.items.find((item) => item.role === "atmosphere").prompt, /real hooked fish/);
  assert.match(getCreationScenarioRoleInstruction("unknown", "hero"), /selected ecommerce scenario/);
});

test("creation planner normalizes supported scenario and image count options", () => {
  assert.deepEqual(CREATION_IMAGE_COUNT_OPTIONS, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18]);
  assert.equal(normalizeCreationImageCount("6"), 6);
  assert.equal(normalizeCreationImageCount("7"), 7);
  assert.equal(normalizeCreationImageCount("8"), 8);
  assert.equal(normalizeCreationImageCount("9"), 9);
  assert.equal(normalizeCreationImageCount("10"), 10);
  assert.equal(normalizeCreationImageCount("12"), 12);
  assert.equal(normalizeCreationImageCount("14"), 14);
  assert.equal(normalizeCreationImageCount("16"), 16);
  assert.equal(normalizeCreationImageCount("18"), 18);
  assert.equal(normalizeCreationImageCount("99"), 18);
  assert.equal(normalizeCreationScenario("social-seeding").value, "social-seeding");
  assert.equal(normalizeCreationScenario("livestream").value, "livestream");
  assert.equal(normalizeCreationScenario("gift-guide").value, "gift-guide");
  assert.equal(normalizeCreationScenario("unknown").value, "standard");
});

test("creation planner supports full eighteen-image suites", () => {
  const plan = buildCreationPlan({
    productName: "Modular desk lamp",
    productDescription: "LED desk lamp with adjustable arm, USB-C power, replaceable diffuser, compatibility notes, care card, brand story, and visible component breakdown notes.",
    sellingPoints: "stable clamp, three brightness levels, replaceable diffuser, easy cleaning, tested wiring, workshop-built hinge",
    targetLanguage: "en",
    imageCount: "18",
  });

  assert.equal(plan.imageCount, 18);
  assert.equal(plan.items.length, 18);
  assert.deepEqual(plan.items.map((item) => item.role), CREATION_ITEM_ROLES.map((role) => role.role));
});

test("creation planner injects reference image role guidance", () => {
  const roles = normalizeCreationReferenceRoles([
    { filename: "front.png", role: "product" },
    { filename: "box.png", role: "package" },
    { filename: "texture.png", role: "material" },
    { filename: "legacy-style.png", role: "style", note: "removed style reference" },
    { filename: "unknown.png", role: "not-supported" },
  ]);
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    referenceImageRoles: roles,
  });

  assert.deepEqual(
    roles.map((entry) => [entry.filename, entry.role]),
    [
      ["front.png", "product"],
      ["box.png", "package"],
      ["texture.png", "material"],
      ["unknown.png", "product"],
    ],
  );
  assert.equal(plan.referenceImageRoles.length, 4);
  assert.ok(plan.items.every((item) => item.prompt.includes("Reference image roles:")));
  assert.ok(plan.items.every((item) => item.prompt.includes("front.png = product subject")));
  assert.ok(plan.items.every((item) => item.prompt.includes("box.png = package-list content and included items")));
  assert.ok(plan.items.every((item) => item.prompt.includes("texture.png = detail and structure reference")));
  assert.ok(plan.items.every((item) => !item.prompt.includes("legacy-style.png")));
});

test("creation planner normalizes reference subject as a subject role", () => {
  const roles = normalizeCreationReferenceRoles([
    { filename: "subject-anchor.png", role: "reference-product", note: "参考主体。" },
    { filename: "old-anchor.png", role: "product", note: "商品主体。" },
  ]);
  const plan = buildCreationPlan({
    productName: "Reference Subject Probe",
    productDescription: "Subject identity probe",
    sellingPoints: "stable product identity",
    targetLanguage: "en",
    referenceImageRoles: roles,
  });

  assert.deepEqual(
    roles.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [
      ["subject-anchor.png", "reference-product", "参考主体"],
      ["old-anchor.png", "product", "商品主体"],
    ],
  );
  assert.ok(plan.items.every((item) => item.prompt.includes("subject-anchor.png = reference subject")));
});

test("creation planner locks the selected reference subject as the set-wide primary subject", () => {
  const plan = buildCreationPlan({
    productName: "Travel backpack",
    productDescription: "Outdoor backpack image set with multiple color references",
    sellingPoints: "breathable back panel, waterproof fabric, large capacity",
    targetLanguage: "en",
    selectedRoles: ["hero", "craft-process", "brand-story", "ingredient-material"],
    referenceImageRoles: [
      { filename: "blue-backpack.png", role: "product", note: "Blue variant product subject." },
      { filename: "black-backpack.png", role: "product", note: "Black variant product subject." },
      { filename: "orange-reference-subject.png", role: "reference-product", note: "Reference subject selected by the user." },
      { filename: "mesh-detail.png", role: "material", note: "Breathable mesh structure." },
    ],
  });

  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes(
        "Primary subject: orange-reference-subject.png is the main visual product for every non-SKU image in this set",
      ),
    ),
  );
  assert.ok(
    plan.items.every((item) =>
      item.prompt.includes(
        "Other product-subject references serve as secondary comparison or variant context around that primary subject.",
      ),
    ),
  );
});

test("creation planner creates SKU images for the selected reference subject and other product subjects", () => {
  const plan = buildCreationPlan({
    productName: "Jointed fishing lure",
    productDescription: "A lure set where the user selected one main subject for the hero image.",
    sellingPoints: "segmented body, realistic finish, treble hooks",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    referenceImageRoles: [
      { filename: "gray-product.png", role: "product", note: "Regular product reference." },
      { filename: "green-product.png", role: "product", note: "Alternate product reference." },
      { filename: "selected-main-subject.png", role: "reference-product", note: "Selected subject used by the main image." },
      { filename: "package-list.png", role: "package", note: "Package content only." },
    ],
    skuSubjects: [
      { id: "gray", title: "Gray product", filenames: ["gray-product.png"], note: "Old payload subject." },
      { id: "green", title: "Green product", filenames: ["green-product.png"], note: "Old payload subject." },
      { id: "selected", title: "Selected main subject", filenames: ["selected-main-subject.png"], note: "Selected payload subject." },
    ],
  });

  const skuItems = plan.items.filter((item) => item.role === "sku");

  assert.equal(plan.skuImageCount, 3);
  assert.deepEqual(plan.skuSubjects.map((subject) => subject.filenames), [
    ["gray-product.png"],
    ["green-product.png"],
    ["selected-main-subject.png"],
  ]);
  assert.equal(skuItems.length, 3);
  assert.match(skuItems[0].prompt, /SKU subject: gray-product\.png is the one sellable product here/i);
  assert.match(skuItems[1].prompt, /SKU subject: green-product\.png is the one sellable product here/i);
  assert.match(skuItems[2].prompt, /SKU subject: selected-main-subject\.png is the one sellable product here/i);
});

test("creation reference analysis normalizes role suggestions and prompt notes", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到产品正面、纹理细节和厨房使用场景。",
      product_name: "Transparent coffee brewer",
      reference_roles: [
        { index: 1, filename: "front.png", role: "product", note: "正面主体，保留透明结构" },
        { index: 2, filename: "texture.png", role: "material", note: "磨砂纹理和边缘细节" },
        { index: 3, filename: "kitchen.png", role: "scene", note: "厨房台面使用环境" },
      ],
      risks: ["包装信息不足"],
    },
    ["front.png", "texture.png", "kitchen.png"],
  );
  const roles = normalizeCreationReferenceRoles(analysis.recommendations);
  const plan = buildCreationPlan({
    productName: "AeroPress Clear",
    productDescription: "Transparent portable coffee brewer",
    sellingPoints: "lightweight, easy to clean",
    targetLanguage: "en",
    referenceImageRoles: roles,
  });

  assert.equal(analysis.summary, "识别到产品正面、纹理细节和厨房使用场景。");
  assert.equal(analysis.productName, "Transparent coffee brewer");
  assert.equal(analysis.categoryHint, "");
  assert.equal(analysis.categoryPath, "");
  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel, entry.note]),
    [
      ["front.png", "product", "商品主体", "正面主体，保留透明结构"],
      ["texture.png", "material", "结构细节", "磨砂纹理和边缘细节"],
      ["kitchen.png", "scene", "使用场景", "厨房台面使用环境"],
    ],
  );
  assert.deepEqual(analysis.risks, ["包装信息不足"]);
  assert.ok(plan.items.every((item) => item.prompt.includes("texture.png = detail and structure reference")));
  assert.ok(plan.items.every((item) => item.prompt.includes("Note: 磨砂纹理和边缘细节")));
});

test("creation reference analysis keeps fifteen reference role suggestions", () => {
  const referenceRoles = Array.from({ length: 15 }, (_, index) => ({
    index: index + 1,
    filename: `reference-${index + 1}.png`,
    role: index % 2 === 0 ? "product" : "scene",
    note: `Reference note ${index + 1}`,
  }));
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "Fifteen ecommerce references.",
      reference_roles: referenceRoles,
      risks: [],
    },
    referenceRoles.map((entry) => entry.filename),
  );

  assert.equal(analysis.recommendations.length, 15);
  assert.equal(analysis.recommendations[14].index, 15);
  assert.equal(analysis.recommendations[14].filename, "reference-15.png");
});

test("creation reference analysis classifies size-spec references as dimensions instead of product", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张商品规格参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-size-card.png",
          role: "product",
          note: "用于锁定银灰条纹色款的实物握持尺度以及长度 130mm、重量 35g、4#钩、缓沉等规格信息。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-size-card",
          title: "尺寸参数参考图",
          filenames: ["lure-size-card.png"],
          note: "长度 130mm、重量 35g。",
        },
      ],
      risks: [],
    },
    ["lure-size-card.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-size-card.png", "dimensions", "尺寸规格"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis treats product-labeled specification-feel cards as dimensions", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "One reference is a lure size and weight card.",
      reference_roles: [
        {
          index: 1,
          filename: "lure-size-weight-card.png",
          role: "product",
          note: "\u5e94\u9501\u5b9a\u9c7c\u9975\u7ec6\u957f\u4f53\u578b\u6bd4\u4f8b\u3001\u591a\u8282\u5206\u6bb5\u7ed3\u6784\u3001\u53cc\u94a9\u5e03\u5c40\u4ee5\u53ca13cm\u89c4\u683c\u611f\u3002",
        },
      ],
      sku_subjects: [
        {
          id: "lure-size-weight-card",
          title: "Size card",
          filenames: ["lure-size-weight-card.png"],
          note: "13cm specification feel.",
        },
      ],
      risks: [],
    },
    ["lure-size-weight-card.png"],
  );

  assert.deepEqual(analysis.recommendations.map((entry) => [entry.filename, entry.role]), [
    ["lure-size-weight-card.png", "dimensions"],
  ]);
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis classifies product-labeled usage guides as usage instructions", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张电子路亚充电指南图。",
      reference_roles: [
        {
          index: 1,
          filename: "charging-guide.png",
          role: "product",
          note: "充电指南，图中用红黑夹子标注正极、负极连接方式，并提示请按照正确的充电方式。",
        },
      ],
      sku_subjects: [
        {
          id: "charging-guide",
          title: "充电指南",
          filenames: ["charging-guide.png"],
          note: "说明正负极充电连接步骤。",
        },
      ],
      risks: [],
    },
    ["charging-guide.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["charging-guide.png", "usage", "使用说明"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis treats product-labeled exterior structure callouts as detail references", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张路亚外观结构说明图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-structure-callout.png",
          role: "product",
          note: "用于锁定四节电动仿真鱼饵的外观结构、金属质感、三本钩配置和鱼眼细节。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-structure-callout",
          title: "外观结构说明图",
          filenames: ["lure-structure-callout.png"],
          note: "外观结构、金属质感和鱼眼细节。",
        },
      ],
      risks: [],
    },
    ["lure-structure-callout.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-structure-callout.png", "material", "结构细节"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis treats product-labeled feature selling-point callouts as detail references", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张路亚功能卖点结构说明图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-structure-callout.png",
          role: "product",
          note: "用于锁定该鱼形分节路亚的功能卖点外观，包括自带钢珠、带充电电池、旋转螺旋桨和内置LED灯的结构表现。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-structure-callout",
          title: "结构细节参考图",
          filenames: ["lure-structure-callout.png"],
          note: "功能卖点、钢珠、电池、螺旋桨和LED结构。",
        },
      ],
      risks: [],
    },
    ["lure-structure-callout.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-structure-callout.png", "material", "结构细节"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis does not let a product role label override detail-note evidence", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张结构标注说明图。",
      reference_roles: [
        {
          index: 1,
          filename: "annotated-lure-detail.png",
          role: "product",
          roleLabel: "商品主体",
          note: "用于锁定外观结构和功能卖点，包含部件标注、鱼眼细节和内置LED灯结构表现。",
        },
      ],
      sku_subjects: [
        {
          id: "annotated-lure-detail",
          title: "结构标注说明图",
          filenames: ["annotated-lure-detail.png"],
          note: "结构标注和LED灯结构表现。",
        },
      ],
      risks: [],
    },
    ["annotated-lure-detail.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["annotated-lure-detail.png", "material", "结构细节"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis classifies other size-spec references as dimensions", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张商品规格参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-size-card.png",
          role: "other",
          note: "这张图主要影响主商品的手持比例，130mm 长度，35g 重量，4#钩和缓沉属性呈现。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-size-card",
          title: "尺寸参数参考图",
          filenames: ["lure-size-card.png"],
          note: "长度 130mm、重量 35g。",
        },
      ],
      risks: [],
    },
    ["lure-size-card.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-size-card.png", "dimensions", "尺寸规格"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis keeps package-content spec cards as package references", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张包装内容参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "lure-package-contents.png",
          role: "dimensions",
          roleLabel: "尺寸规格",
          note: "型号和规格信息包括：100mm、172mm。底部包装清单包含：USB充电线 x1、螺旋桨叶片 x2、EVA漂浮 x1。",
        },
      ],
      sku_subjects: [
        {
          id: "lure-package-contents",
          title: "包装内容图",
          filenames: ["lure-package-contents.png"],
          note: "USB充电线、螺旋桨叶片和EVA漂浮。",
        },
      ],
      risks: [],
    },
    ["lure-package-contents.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["lure-package-contents.png", "package", "包装清单"]],
  );
  assert.deepEqual(analysis.skuSubjects, []);
});

test("creation reference analysis keeps real product references with size facts as product", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张商品主体图。",
      reference_roles: [
        {
          index: 1,
          filename: "hero-product.png",
          role: "product",
          note: "商品正面主体，保留红色外观和结构，同时参考长度 130mm、重量 35g。",
        },
      ],
      sku_subjects: [
        {
          id: "hero-product",
          title: "红色路亚主体",
          filenames: ["hero-product.png"],
          note: "红色外观，长度 130mm、重量 35g。",
        },
      ],
      risks: [],
    },
    ["hero-product.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["hero-product.png", "product", "商品主体"]],
  );
  assert.deepEqual(analysis.skuSubjects.map((subject) => subject.id), ["hero-product"]);
});

test("creation reference analysis treats grouped white-background SKU references as product", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张普通白底 SKU 参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "orange-silver-pair.png",
          role: "reference-product",
          note: "作为橙黄色三节金龙鱼拟饵主体参考，需保留橙黄渐变配色和双钩配置；图中共 1 个完整产品单位。",
        },
      ],
      sku_subjects: [
        {
          id: "orange-silver-pair",
          title: "橙银双路亚 SKU",
          reference_indexes: [1],
          filenames: ["orange-silver-pair.png"],
          subject_unit_count: 2,
          note: "图中共 2 个完整产品单位，上方橙黄色路亚和下方银色路亚都要保留。",
        },
      ],
      risks: [],
    },
    ["orange-silver-pair.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["orange-silver-pair.png", "product", "商品主体组"]],
  );
  assert.doesNotMatch(analysis.recommendations[0].note, /图中共\s*1\s*个完整产品单位/);
  assert.match(analysis.recommendations[0].note, /图中共 2 个完整产品单位/);
  assert.match(analysis.recommendations[0].roleCorrectionReason, /reference-product 调整为 product/);
  assert.match(analysis.recommendations[0].roleCorrectionReason, /2 个完整产品单位/);
  assert.equal(analysis.recommendations[0].subjectUnitCount, 2);
  assert.equal(analysis.skuSubjects[0].subjectUnitCount, 2);
});

test("creation reference analysis removes singular note copy for grouped SKU references", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张普通白底 SKU 参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "red-silver-pair.png",
          role: "product",
          note: "单个鱼形分节路亚白底主体图，需保留橙红变鳞片配色、金属鱼钩和仿真眼细节。",
        },
      ],
      sku_subjects: [
        {
          id: "red-silver-pair",
          title: "红银双路亚 SKU",
          reference_indexes: [1],
          filenames: ["red-silver-pair.png"],
          subject_unit_count: 2,
          note: "图中共 2 个完整产品单位，上方橙红路亚和下方银色路亚都要保留。",
        },
      ],
      risks: [],
    },
    ["red-silver-pair.png"],
  );

  assert.doesNotMatch(analysis.recommendations[0].note, /单个|单一|1\s*个|一个/);
  assert.match(analysis.recommendations[0].note, /图中共 2 个完整产品单位/);
  assert.equal(analysis.recommendations[0].roleLabel, "商品主体组");
  assert.equal(analysis.recommendations[0].subjectUnitCount, 2);
});

test("creation reference analysis removes singular product-body count copy from role notes", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张普通白底 SKU 参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "silver-lure.png",
          role: "product",
          note: "这张图应主要影响银鲤色仿生鱼形路亚的外观配色、分节鱼身、三本钩和尾鳍细节，画面为1个完整产品单体。",
        },
      ],
      sku_subjects: [
        {
          id: "silver-lure",
          title: "银鲤色路亚 SKU",
          reference_indexes: [1],
          filenames: ["silver-lure.png"],
          subject_unit_count: 1,
          note: "银鲤色路亚主体。",
        },
      ],
      risks: [],
    },
    ["silver-lure.png"],
  );

  assert.equal(
    analysis.recommendations[0].note,
    "这张图应主要影响银鲤色仿生鱼形路亚的外观配色、分节鱼身、三本钩和尾鳍细节",
  );
});

test("creation reference analysis preserves a single full-set main subject anchor", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到一张整套主主体锚点参考图。",
      reference_roles: [
        {
          index: 1,
          filename: "hero-anchor.png",
          role: "reference-product",
          title: "Single full-set main subject anchor",
          note: "Use this as the single full-set main subject anchor; keep SKU colorway fidelity, but it is not an ordinary SKU card.",
        },
      ],
      sku_subjects: [
        {
          id: "hero-anchor",
          title: "整套主体锚点",
          reference_indexes: [1],
          filenames: ["hero-anchor.png"],
          subject_unit_count: 1,
          note: "单一完整主体锚点。",
        },
      ],
      risks: [],
    },
    ["hero-anchor.png"],
  );

  assert.deepEqual(
    analysis.recommendations.map((entry) => [entry.filename, entry.role, entry.roleLabel]),
    [["hero-anchor.png", "reference-product", "参考主体"]],
  );
  assert.equal(analysis.recommendations[0].roleCorrectionReason, undefined);
});

test("creation planner applies one SKU series consistency lock across all SKU prompts", () => {
  const plan = buildCreationPlan({
    productName: "Jointed swimbait",
    productDescription: "Three sellable lure colorways photographed on white background",
    sellingPoints: "lifelike finish, sharp treble hooks, durable body",
    targetLanguage: "en",
    selectedRoles: ["hero"],
    visualLanguage: "clean-marketplace",
    referenceImageRoles: [
      { filename: "blue-silver.png", role: "product", note: "Blue silver lure subject" },
      { filename: "yellow-green.png", role: "product", note: "Yellow green lure subject" },
      { filename: "green-red.png", role: "product", note: "Green red lure subject" },
    ],
    skuSubjects: [
      { id: "blue-silver", title: "Blue silver lure", filenames: ["blue-silver.png"], note: "Blue silver lure subject" },
      { id: "yellow-green", title: "Yellow green lure", filenames: ["yellow-green.png"], note: "Yellow green lure subject" },
      { id: "green-red", title: "Green red lure", filenames: ["green-red.png"], note: "Green red lure subject" },
    ],
  });
  const skuPrompts = plan.items.filter((item) => item.role === "sku").map((item) => item.prompt);

  assert.equal(skuPrompts.length, 3);
  assert.ok(skuPrompts.every((prompt) => prompt.includes("SKU series consistency:")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("retries included, shares one locked blueprint")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("Series subjects: Blue silver lure; Yellow green lure; Green red lure")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("shares one locked blueprint")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("same camera height, product scale, margins, background plane, lighting, and typography")));
  assert.ok(skuPrompts.every((prompt) => prompt.includes("so only the subject and its colorway differ")));
});

test("creation reference analysis keeps category hints for template auto switching", () => {
  const analysis = normalizeCreationReferenceAnalysis(
    {
      summary: "识别到手机正面和屏幕细节。",
      category_hint: "智能手机",
      category_path: "数码电子 > 手机通讯 > 手机 > 智能手机",
      visual_language: "reference-style",
      visual_language_reason: "其中一张图只用于光线和背景风格。",
      reference_roles: [{ index: 1, filename: "phone.png", role: "product", note: "手机主体和屏幕比例。" }],
      risks: [],
    },
    ["phone.png"],
  );

  assert.equal(analysis.categoryHint, "智能手机");
  assert.equal(analysis.categoryPath, "数码电子 > 手机通讯 > 手机 > 智能手机");
  assert.equal(analysis.visualLanguage, "classic-commercial");
  assert.equal(analysis.visualLanguageLabel, "经典商业摄影");
  assert.equal(analysis.visualLanguageReason, "其中一张图只用于光线和背景风格。");
});

test("creation planner rejects missing product information", () => {
  assert.throws(
    () =>
      buildCreationPlan({
        productName: "",
        productDescription: "",
        sellingPoints: "",
        targetLanguage: "en",
      }),
    /商品信息不能为空/,
  );
});
