import test from "node:test";
import assert from "node:assert/strict";

const RESOLVER_MODULE_URL = new URL("../lib/creation-platform-resolver.mjs", import.meta.url);

let resolver;
let resolverImportError;
try {
  resolver = await import(RESOLVER_MODULE_URL.href);
} catch (error) {
  resolverImportError = error;
}

test("canonical Creation platform resolver module is available", () => {
  assert.ifError(resolverImportError);
});

const resolverTest = (name, fn) => test(name, { skip: !resolver }, fn);

const CANONICAL_PLATFORM_IDS = [
  "universal", "amazon", "tmall-taobao", "jd", "pdd", "douyin", "xiaohongshu", "temu",
  "tiktok-shop", "shopee", "lazada", "etsy", "ebay", "walmart", "shopify", "aliexpress",
  "rakuten", "coupang", "mercado-libre",
];

function fullAmazonEvidence() {
  return {
    dimensions: true,
    materials: true,
    packageContents: true,
    performance: true,
    specifications: true,
    craft: true,
    condition: true,
    defects: true,
  };
}

resolverTest("resolver exposes normalization, resolution, validation, and restore helpers", () => {
  for (const exportName of [
    "getCreationPlatformCategorySignals",
    "normalizeCreationPlatformItemOverrides",
    "normalizeCreationPlatformSetOverrides",
    "normalizeCreationAudienceStrategy",
    "normalizeCreationConversionIntent",
    "resolveCreationPlatformPlan",
    "restoreCreationPlatformRecommendations",
    "validateCreationPlatformPlan",
  ]) {
    assert.equal(typeof resolver[exportName], "function", `missing resolver export ${exportName}`);
  }
});

resolverTest("resolver merges supplied audience context with deterministic item intents", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "xiaohongshu",
    category: "home",
    audienceStrategy: {
      targetAudience: "重视居家整洁的租房使用者",
      purchaseMotivations: ["节省空间", "保持整洁", "节省空间"],
      purchaseObjections: ["担心尺寸不合适"],
      desiredOutcome: "让小空间更易整理",
      evidenceBasis: ["商品描述提供折叠尺寸"],
      confidence: "high",
      source: "user",
    },
    itemOverrides: [{
      slotKey: "xiaohongshu:detail-macro",
      conversionIntent: { conversionGoal: "用细节降低做工顾虑" },
    }],
  });

  assert.equal(plan.effectiveAudienceStrategy.targetAudience, "重视居家整洁的租房使用者");
  assert.deepEqual(plan.effectiveAudienceStrategy.purchaseMotivations.slice(0, 2), ["节省空间", "保持整洁"]);
  assert.equal(new Set(plan.effectiveAudienceStrategy.purchaseMotivations).size, plan.effectiveAudienceStrategy.purchaseMotivations.length);
  assert.equal(plan.effectiveAudienceStrategy.provenance.targetAudience, "user");
  assert.ok(plan.items.every((item) => item.conversionIntent?.conversionGoal));
  assert.equal(
    plan.items.find((item) => item.slotKey === "xiaohongshu:detail-macro").conversionIntent.conversionGoal,
    "用细节降低做工顾虑",
  );
  assert.notEqual(plan.items[0].conversionIntent.conversionGoal, plan.items[1].conversionIntent.conversionGoal);
});

resolverTest("resolver merges reference-analysis guidance below explicit set input with field provenance", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    referenceAnalysis: { audienceStrategy: { targetAudience: "gift buyers comparing practical options", purchaseMotivations: ["choose a useful gift"], evidenceBasis: ["reference image shows gift-ready packaging"], confidence: "medium", source: "analysis-suggestion" } },
    audienceStrategy: { purchaseObjections: ["uncertain package completeness"], desiredOutcome: "choose the complete supplied set", evidenceBasis: ["user description lists included items"], confidence: "high", source: "user" },
  });
  assert.equal(plan.effectiveAudienceStrategy.targetAudience, "gift buyers comparing practical options");
  assert.equal(plan.effectiveAudienceStrategy.provenance.targetAudience, "analysis-suggestion");
  assert.equal(plan.effectiveAudienceStrategy.provenance.purchaseObjections, "user");
  assert.deepEqual(plan.effectiveAudienceStrategy.evidenceBasis, ["user description lists included items", "reference image shows gift-ready packaging"]);
});

resolverTest("audience normalizers remove sensitive personas and unsupported claims with conservative fallback", () => {
  const strategy = resolver.normalizeCreationAudienceStrategy({ targetAudience: "Black buyers age 25-34", purchaseMotivations: ["FDA certified health effects", "$19.99 lowest price", "3x faster", "4.9/5 stars", "over 1 million sold", "销量第一"], purchaseObjections: ["patients with diabetes", "Chinese consumers"], desiredOutcome: "clinically proven treatment", evidenceBasis: [], confidence: "high", source: "analysis-suggestion" });
  const intent = resolver.normalizeCreationConversionIntent({ audienceFocus: "25岁黑人用户", motivationFocus: "售价￥99，性能提升3倍", objectionFocus: "美国消费者", conversionGoal: "explain supplied product details", evidenceFocus: "10 year guarantee, 4.9 stars, and 已售10万件" });
  assert.equal(strategy.targetAudience, "buyers evaluating this product category");
  assert.deepEqual(strategy.purchaseMotivations, []);
  assert.equal(strategy.desiredOutcome, "make a confident product choice");
  assert.equal(strategy.confidence, "low");
  assert.deepEqual(intent, { audienceFocus: "", motivationFocus: "", objectionFocus: "", conversionGoal: "explain supplied product details", evidenceFocus: "" });
});

resolverTest("resolver applies platform, category, reference, set, then item precedence", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    category: "electronics",
    referenceCoverage: [{ role: "material", filename: "material-card.png", note: "Aluminum shell" }],
    evidence: fullAmazonEvidence(),
    skuSubjects: [{ id: "black" }, { id: "silver" }],
    setOverrides: {
      targetLanguage: "ja",
      ratio: "4:3",
      resolutionTier: "1.5K",
      composition: "set-information-layout",
      textPolicy: "moderate",
      scenePolicy: "neutral",
      logoPolicy: "preserve-existing-only",
    },
    itemOverrides: [
      {
        slotKey: "amazon:amazon-main",
        targetLanguage: "ko",
        ratio: "1:1",
        resolutionTier: "2K",
        composition: "centered-white-85-percent",
        textPolicy: "none",
        scenePolicy: "studio-white",
        logoPolicy: "forbid-overlay",
      },
    ],
  });

  assert.equal(plan.platform, "amazon");
  assert.deepEqual(
    plan.items.map((item) => item.imageType),
    ["amazon-main", "benefit-proof", "spec-table", "material-proof", "detail-macro", "dimension-fit", "in-box"],
  );

  const main = plan.items[0];
  assert.deepEqual(
    {
      targetLanguage: main.targetLanguage,
      ratio: main.ratio,
      resolutionTier: main.resolutionTier,
      composition: main.composition,
      textPolicy: main.textPolicy,
      scenePolicy: main.scenePolicy,
      logoPolicy: main.logoPolicy,
    },
    {
      targetLanguage: "ko",
      ratio: "1:1",
      resolutionTier: "2K",
      composition: "centered-white-85-percent",
      textPolicy: "none",
      scenePolicy: "studio-white",
      logoPolicy: "forbid-overlay",
    },
  );

  const secondary = plan.items[1];
  assert.deepEqual(
    {
      targetLanguage: secondary.targetLanguage,
      ratio: secondary.ratio,
      resolutionTier: secondary.resolutionTier,
      composition: secondary.composition,
      textPolicy: secondary.textPolicy,
      scenePolicy: secondary.scenePolicy,
      logoPolicy: secondary.logoPolicy,
    },
    {
      targetLanguage: "ja",
      ratio: "4:3",
      resolutionTier: "1.5K",
      composition: "set-information-layout",
      textPolicy: "moderate",
      scenePolicy: "neutral",
      logoPolicy: "preserve-existing-only",
    },
  );
  assert.deepEqual(plan.categorySignals, ["electronics-specifications"]);
  assert.ok(plan.referenceCoverage.some((entry) => entry.role === "material"));
  assert.equal(plan.validation.isValid, true);
});

resolverTest("category substitutions are deterministic and do not duplicate image types", () => {
  const cases = [
    {
      category: "apparel",
      evidence: { dimensions: true, packageContents: true },
      expectedImageType: "scale-proof",
      replacedImageType: "multi-angle",
    },
    {
      category: "electronics",
      evidence: { dimensions: true, specifications: true, packageContents: true },
      expectedImageType: "spec-table",
    },
    {
      category: "food",
      evidence: { dimensions: true, materials: true, packageContents: true },
      expectedImageType: "material-proof",
    },
    {
      categorySignals: ["condition"],
      evidence: { dimensions: true, condition: true, packageContents: true },
      expectedImageType: "condition-proof",
      replacedImageType: "multi-angle",
    },
  ];

  for (const input of cases) {
    const plan = resolver.resolveCreationPlatformPlan({ platform: "universal", ...input });
    const repeated = resolver.resolveCreationPlatformPlan({ platform: "universal", ...input });
    const imageTypes = plan.items.map((item) => item.imageType);
    assert.equal(plan.carouselImageCount, 18);
    assert.deepEqual(imageTypes, repeated.items.map((item) => item.imageType));
    assert.ok(imageTypes.includes(input.expectedImageType));
    if (input.replacedImageType) assert.equal(imageTypes.includes(input.replacedImageType), false);
    assert.equal(new Set(imageTypes).size, plan.items.length);
  }
});

resolverTest("every canonical platform keeps one size-related slot without dimension evidence", () => {
  for (const platform of CANONICAL_PLATFORM_IDS) {
    const plan = resolver.resolveCreationPlatformPlan({ platform });
    const sizeItems = plan.items.filter((item) => (
      item.role === "size-capacity-fit" && ["dimension-fit", "scale-proof"].includes(item.imageType)
    ));

    assert.equal(sizeItems.length, 1, platform);
    assert.ok(
      !plan.warnings.some((warning) => (
        warning.slotKey === sizeItems[0].slotKey &&
        ["missing-evidence-slot-omitted", "missing-evidence-slot-replaced"].includes(warning.code)
      )),
      `${platform} must not evidence-fallback its size slot`,
    );
  }
});

resolverTest("reference coverage replaces a lower-priority slot after category overlay", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    category: "electronics",
    evidence: { dimensions: true, specifications: true, materials: true, packageContents: true },
    referenceCoverage: [
      { role: "material", filename: "material.png" },
      { role: "usage", filename: "usage.png" },
    ],
  });

  assert.deepEqual(
    plan.items.map((item) => item.imageType),
    ["amazon-main", "usage-demo", "spec-table", "material-proof", "detail-macro", "dimension-fit", "in-box"],
  );
  assert.equal(new Set(plan.items.map((item) => item.imageType)).size, plan.items.length);
});

resolverTest("reference coverage reuses an existing marketing role instead of creating a duplicate selling-point slot", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    evidence: { dimensions: true, materials: true, packageContents: true },
    referenceCoverage: [
      { role: "usage", filename: "usage.png", note: "Supplied operation and outcome evidence" },
    ],
  });

  assert.equal(plan.items.filter((item) => item.role === "usage-suggestion").length, 1);
  assert.equal(plan.items.find((item) => item.imageType === "target-shopper-resonance")?.role, "benefit");
  assert.equal(plan.items.find((item) => item.imageType === "selling-point-stack")?.role, "usage-suggestion");
  assert.equal(plan.items.some((item) => item.imageType === "usage-demo"), false);
});

resolverTest("evidence-dependent fallback is stable, safe, and non-duplicating", () => {
  const withoutMaterial = resolver.resolveCreationPlatformPlan({
    platform: "etsy",
    evidence: { dimensions: true, craft: true, packageContents: true },
    skuSubjects: [{ id: "only-sku" }],
  });
  assert.deepEqual(
    withoutMaterial.items.map((item) => item.imageType),
    ["lifestyle-first", "clean-product-proof", "craft-proof", "detail-macro", "scale-proof", "gift-packaging", "usage-demo"],
  );
  assert.equal(withoutMaterial.carouselImageCount, 7);
  assert.ok(withoutMaterial.warnings.some((warning) => warning.code === "missing-evidence-slot-omitted"));

  const withMaterial = resolver.resolveCreationPlatformPlan({
    platform: "etsy",
    evidence: { dimensions: true, materials: true, craft: true, packageContents: true },
    skuSubjects: [{ id: "only-sku" }],
  });
  assert.deepEqual(
    withMaterial.items.map((item) => item.imageType),
    ["lifestyle-first", "clean-product-proof", "craft-proof", "detail-macro", "scale-proof", "material-proof", "gift-packaging", "usage-demo"],
  );
  assert.equal(new Set(withMaterial.items.map((item) => item.imageType)).size, withMaterial.items.length);
  assert.ok(withMaterial.warnings.some((warning) => warning.code === "missing-evidence-slot-replaced"));
});

resolverTest("variant carousel slot stays distinct from deduplicated appended SKU counts", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    evidence: { dimensions: true, packageContents: true },
    skuSubjects: [{ id: "red" }, { id: "red" }, { id: "blue" }],
    infographicRebuildCount: 1,
  });

  assert.ok(plan.items.some((item) => item.imageType === "variant-comparison" && item.itemKind === "carousel"));
  assert.deepEqual(plan.skuSubjectIds, ["red", "blue"]);
  assert.equal(plan.carouselImageCount, 18);
  assert.equal(plan.imageCount, 18);
  assert.equal(plan.skuImageCount, 2);
  assert.equal(plan.infographicRebuildCount, 1);
  assert.equal(plan.totalPlannedItemCount, 21);
});

resolverTest("image-count overrides preserve the full compatible catalog while limiting generated items", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    skuSubjects: [{ id: "one" }, { id: "two" }],
    infographicRebuildCount: 1,
    setOverrides: { imageCount: 5 },
  });

  assert.equal(plan.slots.length, 18);
  assert.equal(plan.slots.filter((slot) => slot.enabled !== false).length, 5);
  assert.ok(plan.slots.slice(5).every((slot) => slot.enabled === false));
  assert.equal(plan.items.length, 5);
  assert.equal(plan.carouselImageCount, 5);
  assert.equal(plan.totalPlannedItemCount, 8);

  const swapped = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    setOverrides: { imageCount: 5 },
    itemOverrides: [
      { slotKey: plan.slots[0].slotKey, enabled: false },
      { slotKey: plan.slots[17].slotKey, enabled: true },
    ],
  });
  assert.equal(swapped.slots.length, 18);
  assert.equal(swapped.carouselImageCount, 5);
  assert.equal(swapped.items.some((slot) => slot.slotKey === plan.slots[0].slotKey), false);
  assert.equal(swapped.items.some((slot) => slot.slotKey === plan.slots[17].slotKey), true);

  const zero = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    setOverrides: { imageCount: 0 },
  });
  assert.equal(zero.slots.length, 18);
  assert.equal(zero.items.length, 0);
  assert.equal(zero.carouselImageCount, 0);
});

resolverTest("set and item enablement or ordering overrides derive final carousel counts", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    evidence: { dimensions: true, packageContents: true },
    skuSubjects: [{ id: "one" }, { id: "two" }],
    infographicRebuildCount: 2,
    setOverrides: { imageCount: 4 },
    itemOverrides: [
      { slotKey: "universal:benefit-proof", order: 0, textPolicy: "factual-short" },
      { slotKey: "universal:generic-hero", order: 1 },
      { slotKey: "universal:scene-application", enabled: false },
    ],
  });

  assert.deepEqual(plan.slots.slice(0, 4).map((item) => item.imageType), ["target-shopper-resonance", "generic-hero", "scene-application", "multi-angle"]);
  assert.equal(plan.slots.length, 18);
  assert.ok(plan.slots.slice(4).every((item) => item.enabled === false));
  assert.equal(plan.slots.find((item) => item.imageType === "scene-application").enabled, false);
  assert.equal(plan.items.length, 3);
  assert.equal(plan.items[0].textPolicy, "factual-short");
  assert.equal(plan.carouselImageCount, 3);
  assert.equal(plan.skuImageCount, 2);
  assert.equal(plan.infographicRebuildCount, 2);
  assert.equal(plan.totalPlannedItemCount, 7);
});

resolverTest("custom item overrides materialize stable slots at the requested positions", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    itemOverrides: [
      { slotKey: "custom-before-main", imageType: "custom", enabled: true, order: 0, prompt: "自定义首图" },
      { slotKey: "amazon:amazon-main", order: 1 },
      { slotKey: "custom-after-main", imageType: "custom", enabled: true, order: 2, prompt: "自定义第二张" },
      { slotKey: "amazon:benefit-proof", order: 3 },
      { slotKey: "amazon:lifestyle-first", order: 4 },
      { slotKey: "amazon:multi-angle", order: 5 },
      { slotKey: "amazon:detail-macro", order: 6 },
      { slotKey: "amazon:dimension-fit", order: 7 },
      { slotKey: "amazon:in-box", order: 8 },
    ],
  });

  assert.deepEqual(plan.slots.slice(0, 4).map((slot) => slot.slotKey), [
    "custom-before-main",
    "amazon:amazon-main",
    "custom-after-main",
    "amazon:benefit-proof",
  ]);
  assert.equal(plan.slots[0].imageType, "custom");
  assert.equal(plan.slots[0].prompt, "自定义首图");
  assert.equal(plan.slots[2].imageType, "custom");
  assert.equal(plan.slots[2].prompt, "自定义第二张");
  assert.equal(plan.carouselImageCount, 9);
});

resolverTest("disabled slots remain addressable and can be enabled again", () => {
  const disabled = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    itemOverrides: [{ slotKey: "amazon:benefit-proof", enabled: false }],
  });
  assert.equal(disabled.slots.length, 7);
  assert.equal(disabled.items.length, 6);
  assert.equal(disabled.slots.find((slot) => slot.slotKey === "amazon:benefit-proof")?.enabled, false);

  const enabledAgain = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    itemOverrides: [{ slotKey: "amazon:benefit-proof", enabled: true }],
  });
  assert.equal(enabledAgain.slots.length, 7);
  assert.equal(enabledAgain.items.length, 7);
  assert.equal(enabledAgain.slots.find((slot) => slot.slotKey === "amazon:benefit-proof")?.enabled, true);
});

resolverTest("set image-count override is capped at the canonical platform slot count", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    skuSubjects: [{ id: "one" }, { id: "two" }],
    setOverrides: { imageCount: 18 },
  });

  assert.equal(plan.slots.length, 7);
  assert.equal(plan.carouselImageCount, 7);
  assert.equal(plan.imageCount, 7);
  assert.equal(plan.items[0].imageType, "amazon-main");
  assert.equal(plan.items.some((item) => item.imageType === "custom"), false);
  assert.equal(plan.setOverrides.imageCount, 7);
  assert.ok(plan.warnings.some((warning) => (
    warning.code === "image-count-extension-limited" &&
    warning.requestedCount === 18 &&
    warning.effectiveCount === 7
  )));
});

resolverTest("explicit Amazon image-count 18 is capped without custom slots", () => {
  const selectedRoles = [
    "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
    "accessory-gift", "series-showcase", "usage-suggestion", "ingredient-material",
    "craft-process", "effect-comparison", "spec-table", "atmosphere", "human-handheld",
    "human-wearable", "brand-story", "after-sales",
  ];
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    selectedRoles,
    setOverrides: { imageCount: 18 },
  });

  assert.equal(plan.carouselImageCount, 7);
  assert.equal(plan.imageCount, 7);
  assert.equal(plan.items.length, 7);
  assert.equal(new Set(plan.items.map((item) => item.slotKey)).size, 7);
  assert.deepEqual(plan.items.map((item) => item.role), selectedRoles.slice(0, 7));
  assert.equal(plan.items.some((item) => item.imageType === "custom"), false);
  assert.ok(plan.warnings.some((warning) => warning.code === "image-count-extension-limited"));
});

resolverTest("applied reference roles rebuild coverage and evidence for material package and dimensions", () => {
  const signals = resolver.buildCreationReferencePlanningSignals([
    { filename: "material.jpg", role: "material", note: "结构细节" },
    { filename: "package.jpg", role: "package", note: "包装清单" },
    { filename: "dimensions.jpg", role: "dimensions", note: "尺寸规格" },
  ], {
    performance: true,
    materials: false,
    packageContents: false,
    dimensions: false,
  });

  assert.deepEqual(signals.referenceCoverage.map((entry) => entry.role), ["material", "package", "dimensions"]);
  assert.equal(signals.evidence.performance, true);
  assert.equal(signals.evidence.materials, true);
  assert.equal(signals.evidence.packageContents, true);
  assert.equal(signals.evidence.dimensions, true);
  assert.equal(signals.evidence.specifications, true);

  for (const platform of ["temu", "universal"]) {
    const plan = resolver.resolveCreationPlatformPlan({
      platform,
      referenceCoverage: signals.referenceCoverage,
      evidence: signals.evidence,
    });
    assert.ok(plan.items.some((item) => item.imageType === "material-proof"), platform);
    assert.ok(plan.items.some((item) => item.imageType === "in-box"), platform);
    assert.ok(plan.items.some((item) => item.imageType === "dimension-fit"), platform);
  }
});

resolverTest("Temu is capped while universal keeps 18 canonical slots without custom extensions", () => {
  const selectedRoles = [
    "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
    "accessory-gift", "series-showcase", "usage-suggestion", "ingredient-material",
    "craft-process", "effect-comparison", "spec-table", "atmosphere", "human-handheld",
    "human-wearable", "brand-story", "after-sales",
  ];

  const temu = resolver.resolveCreationPlatformPlan({
    platform: "temu",
    selectedRoles: selectedRoles.slice(0, 16),
    setOverrides: { imageCount: 16 },
  });
  assert.ok(temu.carouselImageCount <= 8);
  assert.equal(temu.items.some((item) => item.imageType === "custom"), false);
  assert.ok(temu.warnings.some((warning) => warning.code === "image-count-extension-limited"));

  const universal = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    selectedRoles,
    setOverrides: { imageCount: 18 },
  });
  assert.equal(universal.carouselImageCount, 18);
  assert.deepEqual(universal.items.map((item) => item.role), selectedRoles);
  assert.equal(universal.items.some((item) => item.imageType === "custom"), false);
  assert.equal(universal.warnings.some((warning) => warning.code === "image-count-extension-limited"), false);
});

resolverTest("manual custom conversion clears inherited platform policy before applying role defaults", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    itemOverrides: [{
      slotKey: "amazon:benefit-proof",
      imageType: "custom",
      role: "human-handheld",
    }],
  });
  const custom = plan.slots.find((item) => item.slotKey === "amazon:benefit-proof");

  assert.equal(custom.imageType, "custom");
  assert.equal(custom.role, "human-handheld");
  assert.equal(custom.composition, "role-led-lifestyle");
  assert.equal(custom.textPolicy, "concise");
  assert.equal(custom.scenePolicy, "authentic-use");
  assert.equal(custom.logoPolicy, "allow-supplied");
  assert.equal(custom.prompt, "");
  assert.deepEqual(custom.constraints, []);
  assert.deepEqual(custom.sourceIds, []);
  assert.equal(custom.advisory, true);
});

resolverTest("sourced hard-rule conflicts block generation after overrides", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    itemOverrides: [
      {
        slotKey: "amazon:amazon-main",
        composition: "collage-grid",
        textPolicy: "moderate",
        logoPolicy: "allow-supplied",
      },
    ],
  });

  assert.equal(plan.validation.isValid, false);
  assert.equal(plan.canGenerate, false);
  assert.deepEqual(
    plan.errors.map((error) => error.constraintId).sort(),
    ["amazon-main-no-collage", "amazon-main-no-external-logo", "amazon-main-no-marketing-text"],
  );
  assert.ok(plan.errors.every((error) => error.level === "blocking"));
  assert.ok(plan.errors.every((error) => error.sourceIds.includes("amazon-g1881")));
});

resolverTest("prompt hard rules distinguish prohibited requests from negative safety instructions", () => {
  const unsafe = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    itemOverrides: [
      {
        slotKey: "amazon:amazon-main",
        prompt: "Add a SALE badge, watermark, collage, and external Logo overlay.",
      },
    ],
  });
  assert.equal(unsafe.canGenerate, false);
  assert.deepEqual(
    unsafe.errors.map((error) => error.constraintId).sort(),
    [
      "amazon-main-no-badges",
      "amazon-main-no-collage",
      "amazon-main-no-external-logo",
      "amazon-main-no-marketing-text",
      "amazon-main-no-watermark",
    ],
  );

  const safe = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    itemOverrides: [
      {
        slotKey: "amazon:amazon-main",
        prompt:
          "Do not add a watermark, badge, marketing copy, collage, or external Logo. Preserve only identifiers printed on the product.",
      },
    ],
  });
  assert.equal(safe.canGenerate, true);
  assert.equal(safe.validation.isValid, true);
  assert.deepEqual(safe.errors, []);

  const neutralDescription = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    itemOverrides: [
      {
        slotKey: "amazon:amazon-main",
        prompt:
          "Product name: Badge Holder. Product model: Watermark Remover. Preserve only identifiers printed on the supplied product.",
      },
    ],
  });
  assert.equal(neutralDescription.canGenerate, true);
  assert.deepEqual(neutralDescription.errors, []);

  for (const prompt of [
    "Avoid watermark and add a SALE badge.",
    "Do not add a watermark, add a badge.",
  ]) {
    const mixedInstruction = resolver.resolveCreationPlatformPlan({
      platform: "amazon",
      evidence: fullAmazonEvidence(),
      itemOverrides: [{ slotKey: "amazon:amazon-main", prompt }],
    });
    assert.equal(mixedInstruction.canGenerate, false, prompt);
    assert.ok(
      mixedInstruction.errors.some((error) => error.constraintId === "amazon-main-no-badges"),
      prompt,
    );
  }

  for (const prompt of [
    "Adding a SALE badge to the product.",
    "Creating a SALE badge.",
    "Including a badge in the image.",
    "Placing a badge on the product.",
    "Making a badge overlay.",
    "Made a badge overlay.",
  ]) {
    const inflectedPositive = resolver.resolveCreationPlatformPlan({
      platform: "amazon",
      evidence: fullAmazonEvidence(),
      itemOverrides: [{ slotKey: "amazon:amazon-main", prompt }],
    });
    assert.equal(inflectedPositive.canGenerate, false, prompt);
    assert.ok(
      inflectedPositive.errors.some((error) => error.constraintId === "amazon-main-no-badges"),
      prompt,
    );
  }

  for (const prompt of ["Make sure not to add a badge.", "Please create a watermark-free image."]) {
    const negativeVariant = resolver.resolveCreationPlatformPlan({
      platform: "amazon",
      evidence: fullAmazonEvidence(),
      itemOverrides: [{ slotKey: "amazon:amazon-main", prompt }],
    });
    assert.equal(negativeVariant.canGenerate, true, prompt);
    assert.deepEqual(negativeVariant.errors, [], prompt);
  }

  for (const prompt of [
    "Generate a sale badge.",
    "Design a collage.",
    "Use a watermark.",
    "Feature an external logo overlay.",
    "Produce a badge.",
    "Draw a collage.",
  ]) {
    const affirmativeVariant = resolver.resolveCreationPlatformPlan({
      platform: "amazon",
      evidence: fullAmazonEvidence(),
      itemOverrides: [{ slotKey: "amazon:amazon-main", prompt }],
    });
    assert.equal(affirmativeVariant.canGenerate, false, prompt);
    assert.ok(affirmativeVariant.errors.length > 0, prompt);
  }

  for (const prompt of [
    "Create an image of Badge Holder.",
    "Show the Watermark Remover product.",
    "Render the Collage Maker device.",
    "Create the external logo kit as a product.",
  ]) {
    const productIdentity = resolver.resolveCreationPlatformPlan({
      platform: "amazon",
      evidence: fullAmazonEvidence(),
      itemOverrides: [{ slotKey: "amazon:amazon-main", prompt }],
    });
    assert.equal(productIdentity.canGenerate, true, prompt);
    assert.deepEqual(productIdentity.errors, [], prompt);
  }
});

resolverTest("changing a strict slot cannot remove platform blocking rules", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "amazon",
    evidence: fullAmazonEvidence(),
    itemOverrides: [
      {
        slotKey: "amazon:amazon-main",
        imageType: "custom",
        composition: "collage-grid",
        textPolicy: "moderate",
        scenePolicy: "lifestyle",
        logoPolicy: "allow-supplied",
      },
    ],
  });

  assert.equal(plan.items[0].imageType, "amazon-main");
  assert.ok(plan.items[0].constraints.some((constraint) => constraint.id === "amazon-main-studio-white"));
  assert.equal(plan.validation.isValid, false);
  assert.ok(plan.errors.some((error) => error.constraintId === "amazon-main-no-collage"));
  assert.ok(plan.errors.some((error) => error.constraintId === "amazon-main-studio-white"));
  assert.ok(plan.warnings.some((warning) => warning.code === "strict-slot-image-type-preserved"));
});

resolverTest("unknown platforms fall back visibly and C-level profiles stay advisory", () => {
  const unknown = resolver.resolveCreationPlatformPlan({
    platform: "future-market",
    evidence: { dimensions: true, packageContents: true },
    skuSubjects: [{ id: "one" }, { id: "two" }],
  });
  assert.equal(unknown.requestedPlatform, "future-market");
  assert.equal(unknown.platform, "universal");
  assert.ok(unknown.warnings.some((warning) => warning.code === "unknown-platform"));

  const cLevel = resolver.resolveCreationPlatformPlan({
    platform: "pdd",
    evidence: fullAmazonEvidence(),
    skuSubjects: [{ id: "one" }, { id: "two" }],
  });
  assert.equal(cLevel.evidenceLevel, "C");
  assert.equal(cLevel.validation.isValid, true);
  assert.ok(cLevel.warnings.some((warning) => warning.code === "advisory-platform-profile"));
  assert.ok(cLevel.items.every((item) => item.constraints.every((constraint) => constraint.level !== "blocking")));
});

resolverTest("restore current platform recommendation clears overrides but preserves planning evidence", () => {
  const input = {
    platform: "amazon",
    category: "electronics",
    evidence: { dimensions: true, specifications: true, packageContents: true },
    referenceCoverage: [{ role: "usage", filename: "usage.png" }],
    skuSubjects: [{ id: "one" }, { id: "two" }],
    setOverrides: { ratio: "4:3", targetLanguage: "ja", imageCount: 4 },
    itemOverrides: [{ slotKey: "amazon:benefit-proof", imageType: "custom", ratio: "3:4" }],
  };

  const modified = resolver.resolveCreationPlatformPlan(input);
  assert.equal(modified.items[1].imageType, "custom");
  assert.equal(modified.carouselImageCount, 4);

  const restored = resolver.restoreCreationPlatformRecommendations(input);
  assert.equal(restored.platform, "amazon");
  assert.equal(restored.items[0].imageType, "amazon-main");
  assert.equal(restored.items[0].ratio, "1:1");
  assert.equal(restored.items[0].targetLanguage, "en");
  assert.equal(restored.carouselImageCount, 7);
  assert.deepEqual(restored.setOverrides, {});
  assert.deepEqual(restored.itemOverrides, []);
  assert.deepEqual(restored.categorySignals, ["electronics-specifications"]);
  assert.ok(restored.referenceCoverage.some((entry) => entry.role === "usage"));
  assert.deepEqual(restored.skuSubjectIds, ["one", "two"]);
});

resolverTest("override normalizers accept JSON and discard entries without supported changes", () => {
  assert.deepEqual(
    resolver.normalizeCreationPlatformSetOverrides(JSON.stringify({ ratio: "3:4", unknown: "ignored" })),
    { ratio: "3:4" },
  );
  assert.deepEqual(
    resolver.normalizeCreationPlatformItemOverrides(
      JSON.stringify([
        { slotKey: "amazon:amazon-main", textPolicy: "none" },
        { slotKey: "", textPolicy: "moderate" },
        { slotKey: "amazon:benefit-proof", unknown: "ignored" },
      ]),
    ),
    [{ slotKey: "amazon:amazon-main", textPolicy: "none" }],
  );
});
