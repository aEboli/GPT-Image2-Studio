import test from "node:test";
import assert from "node:assert/strict";
import { applyCreationPlanOverrides, buildCreationPlan } from "../lib/creation-planner.mjs";
import * as creationReferenceLabels from "../lib/creation-reference-labels.mjs";


const FULL_EVIDENCE = Object.freeze({
  dimensions: true,
  materials: true,
  packageContents: true,
  performance: true,
  specifications: true,
  craft: true,
  condition: true,
  defects: true,
});

const SKU_SUBJECTS = Object.freeze([
  { id: "blue", title: "Blue", filenames: ["blue.png"] },
  { id: "red", title: "Red", filenames: ["red.png"] },
]);

test("planner adapts conversion intent by platform and non-sensitive audience without polluting strict mains", () => {
  const audienceStrategy = {
    targetAudience: "需要快速比较并放心下单的初次购买者",
    purchaseMotivations: ["快速确认是否适合"],
    purchaseObjections: ["担心尺寸与配件不匹配"],
    desiredOutcome: "减少选择不确定性",
    evidenceBasis: ["商品描述和尺寸字段"],
    confidence: "high",
    source: "user",
  };
  const amazon = buildCreationPlan({
    productName: "便携收纳盒",
    productDescription: "提供折叠尺寸和包装清单",
    sellingPoints: ["折叠收纳"],
    platform: "amazon",
    audienceStrategy,
    platformEvidence: FULL_EVIDENCE,
  });
  const xhs = buildCreationPlan({
    productName: "便携收纳盒",
    productDescription: "提供折叠尺寸和包装清单",
    sellingPoints: ["折叠收纳"],
    platform: "xiaohongshu",
    audienceStrategy,
    platformEvidence: FULL_EVIDENCE,
  });

  assert.deepEqual(amazon.audienceStrategy, audienceStrategy);
  assert.equal(amazon.effectiveAudienceStrategy.targetAudience, audienceStrategy.targetAudience);
  assert.ok(amazon.items.every((item) => item.conversionIntent?.conversionGoal));
  assert.match(amazon.items[1].prompt, /CONVERSION INTENT/);
  assert.doesNotMatch(amazon.items[0].prompt, /CONVERSION INTENT/);
  assert.match(amazon.items[0].prompt, /Do not add visible marketing copy/i);
  assert.notDeepEqual(
    amazon.effectiveAudienceStrategy.marketingContext,
    xhs.effectiveAudienceStrategy.marketingContext,
  );
  assert.notEqual(amazon.items[1].prompt, xhs.items[1].prompt);
});

const PLATFORM_CASES = Object.freeze([
  {
    platform: "amazon",
    imageTypes: ["amazon-main", "benefit-proof", "lifestyle-first", "multi-angle", "detail-macro", "dimension-fit", "in-box"],
    roles: ["hero", "benefit", "atmosphere", "multi-angle", "product-detail", "size-capacity-fit", "accessory-gift"],
    ratios: ["1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1"],
    resolutionTier: "2K",
    targetLanguage: "en",
  },
  {
    platform: "tmall-taobao",
    imageTypes: ["taobao-white-main", "transparent-cutout", "lifestyle-first", "info-benefit", "detail-macro", "dimension-fit", "variant-comparison", "long-detail"],
    roles: ["hero", "product-detail", "atmosphere", "benefit", "product-detail", "size-capacity-fit", "series-showcase", "brand-story"],
    ratios: ["1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "2:3"],
    resolutionTier: "2K",
    targetLanguage: "zh-CN",
  },
  {
    platform: "xiaohongshu",
    imageTypes: ["xhs-feed-cover", "lifestyle-first", "usage-demo", "detail-macro", "scale-proof", "clean-product-proof"],
    roles: ["hero", "atmosphere", "usage-suggestion", "product-detail", "size-capacity-fit", "multi-angle"],
    ratios: ["3:4", "3:4", "3:4", "3:4", "3:4", "1:1"],
    resolutionTier: "1.5K",
    targetLanguage: "zh-CN",
  },
  {
    platform: "etsy",
    imageTypes: ["lifestyle-first", "clean-product-proof", "craft-proof", "detail-macro", "scale-proof", "variant-comparison", "gift-packaging", "usage-demo"],
    roles: ["atmosphere", "multi-angle", "craft-process", "product-detail", "size-capacity-fit", "series-showcase", "accessory-gift", "usage-suggestion"],
    ratios: ["4:3", "4:3", "4:3", "4:3", "4:3", "4:3", "4:3", "4:3"],
    resolutionTier: "2K",
    targetLanguage: "en",
  },
  {
    platform: "ebay",
    imageTypes: ["clean-catalog-main", "multi-angle", "label-detail", "condition-proof", "scale-proof", "in-box", "usage-demo", "defect-disclosure"],
    roles: ["hero", "multi-angle", "product-detail", "product-detail", "size-capacity-fit", "accessory-gift", "usage-suggestion", "product-detail"],
    ratios: ["1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1"],
    resolutionTier: "2K",
    targetLanguage: "en",
  },
  {
    platform: "walmart",
    imageTypes: ["walmart-main", "multi-angle", "benefit-proof", "lifestyle-first", "dimension-fit", "in-box"],
    roles: ["hero", "multi-angle", "benefit", "atmosphere", "size-capacity-fit", "accessory-gift"],
    ratios: ["1:1", "1:1", "1:1", "1:1", "1:1", "1:1"],
    resolutionTier: "max",
    targetLanguage: "en",
  },
  {
    platform: "pdd",
    imageTypes: ["clean-catalog-main", "value-bundle", "benefit-proof", "variant-comparison", "lifestyle-first", "dimension-fit", "detail-macro", "in-box"],
    roles: ["hero", "accessory-gift", "benefit", "series-showcase", "atmosphere", "size-capacity-fit", "product-detail", "accessory-gift"],
    ratios: ["1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1"],
    resolutionTier: "1.5K",
    targetLanguage: "zh-CN",
    warningCode: "advisory-platform-profile",
  },
]);

function buildPlatformPlan(platform, extra = {}) {
  return buildCreationPlan({
    productName: "Trail Bottle",
    productDescription: "Stainless steel insulated bottle with supplied lid and carry loop",
    sellingPoints: "keeps drinks cool, easy to carry",
    platform,
    evidence: FULL_EVIDENCE,
    skuSubjects: SKU_SUBJECTS,
    infographicRebuildEnabled: false,
    ...extra,
  });
}

test("Creation planner emits approved platform-native carousel plans and effective parameters", () => {
  for (const expected of PLATFORM_CASES) {
    const plan = buildPlatformPlan(expected.platform);
    const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

    assert.equal(plan.platform, expected.platform, expected.platform);
    assert.equal(plan.platformPolicyId, expected.platform, expected.platform);
    assert.match(plan.strategyVersion, /^\d{4}-\d{2}-\d{2}\.\d+$/u, expected.platform);
    assert.equal(plan.carouselImageCount, expected.imageTypes.length, expected.platform);
    assert.equal(plan.imageCount, expected.imageTypes.length, expected.platform);
    assert.equal(plan.skuImageCount, 2, expected.platform);
    assert.equal(plan.infographicRebuildCount, 0, expected.platform);
    assert.equal(plan.totalPlannedItemCount, expected.imageTypes.length + 2, expected.platform);
    assert.deepEqual(carouselItems.map((item) => item.imageType), expected.imageTypes, expected.platform);
    assert.deepEqual(carouselItems.map((item) => item.role), expected.roles, expected.platform);
    assert.deepEqual(carouselItems.map((item) => item.ratio), expected.ratios, expected.platform);
    assert.ok(carouselItems.every((item) => item.resolutionTier === expected.resolutionTier), expected.platform);
    assert.ok(carouselItems.every((item) => item.targetLanguage === expected.targetLanguage), expected.platform);
    assert.ok(carouselItems.every((item) => item.composition && item.textPolicy && item.scenePolicy && item.logoPolicy), expected.platform);
    assert.ok(carouselItems.every((item) => Array.isArray(item.constraints)), expected.platform);
    assert.ok(plan.items.slice(expected.imageTypes.length).every((item) => item.itemKind === "sku"), expected.platform);
    if (expected.warningCode) {
      assert.ok(plan.warnings.some((warning) => warning.code === expected.warningCode), expected.platform);
    }
  }
});

test("planner caps explicit roles at the current platform image-type limit", () => {
  const selectedRoles = [
    "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
    "accessory-gift", "series-showcase", "usage-suggestion", "ingredient-material",
    "craft-process", "effect-comparison", "spec-table", "atmosphere", "human-handheld",
    "human-wearable", "brand-story", "after-sales",
  ];
  const plan = buildCreationPlan({
    productName: "Travel Bottle",
    productDescription: "Product shown in the supplied image",
    platform: "amazon",
    imageCount: 18,
    selectedRoles,
    platformEvidence: { dimensions: true, packageContents: true },
    infographicRebuildEnabled: false,
  });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.equal(plan.carouselImageCount, 7);
  assert.equal(plan.imageCount, 7);
  assert.equal(plan.platformSetOverrides.imageCount, 7);
  assert.equal(carouselItems.length, 7);
  assert.equal(new Set(carouselItems.map((item) => item.slotKey)).size, 7);
  assert.deepEqual(carouselItems.map((item) => item.role), selectedRoles.slice(0, 7));
  assert.equal(carouselItems.some((item) => item.imageType === "custom"), false);
  assert.ok(plan.warnings.some((warning) => warning.code === "image-count-extension-limited"));
  assert.ok(carouselItems.every((item) => /Do not invent dimensions, materials, package contents, condition, defects, prices, certifications, sales, rankings, guarantees, reviews, or performance claims/i.test(item.prompt)));
});

test("Temu is capped at eight while universal keeps its native 18 slots", () => {
  const selectedRoles = [
    "hero", "benefit", "scene", "multi-angle", "product-detail", "size-capacity-fit",
    "accessory-gift", "series-showcase", "usage-suggestion", "ingredient-material",
    "craft-process", "effect-comparison", "spec-table", "atmosphere", "human-handheld",
    "human-wearable", "brand-story", "after-sales",
  ];

  for (const [platform, imageCount, expectedCount] of [["temu", 16, 8], ["universal", 18, 18]]) {
    const plan = buildCreationPlan({
      productName: "Fishing Lure",
      productDescription: "Product shown in the supplied image",
      platform,
      imageCount,
      selectedRoles: selectedRoles.slice(0, imageCount),
      platformEvidence: {
        craft: true,
        defects: true,
        dimensions: true,
        materials: true,
        packageContents: true,
        performance: true,
        skuVariants: true,
      },
      infographicRebuildEnabled: false,
    });
    const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

    assert.equal(plan.carouselImageCount, expectedCount, platform);
    assert.equal(plan.platformSetOverrides.imageCount, expectedCount, platform);
    assert.equal(carouselItems.length, expectedCount, platform);
    assert.equal(carouselItems.some((item) => item.imageType === "custom"), false, platform);
    assert.deepEqual(carouselItems.map((item) => item.role), selectedRoles.slice(0, expectedCount), platform);
    assert.equal(plan.warnings.some((warning) => warning.code === "image-count-extension-limited"), platform === "temu", platform);
  }
});

test("strict marketplace main images remove generic hero conflicts and external Logo attachment", () => {
  const plan = buildPlatformPlan("amazon", {
    logoOptions: { enabled: true, filename: "brand-mark.png", placement: "top-left", background: "transparent" },
  });
  const main = plan.items[0];
  const secondary = plan.items[1];

  assert.equal(main.imageType, "amazon-main");
  assert.equal(main.logoPolicy, "forbid-overlay");
  assert.equal(main.textPolicy, "none");
  assert.equal(main.composition, "centered-white-85-percent");
  assert.match(main.prompt, /Do not add visible marketing copy, badges, watermarks, collage panels, or scene insets/i);
  assert.match(main.prompt, /Preserve branding or identifiers already printed on the supplied product/i);
  assert.match(main.prompt, /Do not attach the user's uploaded external Logo/i);
  assert.doesNotMatch(main.prompt, /Add 3-5 small circular scene frames/i);
  assert.equal(typeof creationReferenceLabels.appendCreationItemLogoReference, "function");
  assert.deepEqual(
    creationReferenceLabels.appendCreationItemLogoReference(main, [{ filename: "product.png" }], { filename: "brand-mark.png" }),
    [{ filename: "product.png" }],
  );
  assert.deepEqual(
    creationReferenceLabels.appendCreationItemLogoReference(secondary, [{ filename: "product.png" }], { filename: "brand-mark.png" }),
    [{ filename: "product.png" }, { filename: "brand-mark.png" }],
  );
});

test("Xiaohongshu prompts forbid fabricated reviews and disguised UGC", () => {
  const plan = buildPlatformPlan("xiaohongshu");
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.equal(carouselItems.length, 6);
  assert.ok(carouselItems.every((item) => /Do not fabricate reviews, engagement metrics, endorsements, or user testimony/i.test(item.prompt)));
  assert.ok(carouselItems.every((item) => /Do not disguise brand-created content as UGC/i.test(item.prompt)));
  assert.ok(carouselItems.every((item) => !/believable user recommendation/i.test(item.prompt)));
});

test("evidence-dependent platform prompts replace unsupported slots and never invent facts or platform approval", () => {
  const plan = buildCreationPlan({
    productName: "Second-hand camera bag",
    productDescription: "Camera bag shown in the supplied product photo",
    platform: "ebay",
    skuSubjects: SKU_SUBJECTS,
    infographicRebuildEnabled: false,
  });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.ok(carouselItems.length > 0);
  assert.ok(!carouselItems.some((item) => ["condition-proof", "defect-disclosure"].includes(item.imageType)));
  assert.ok(plan.warnings.some((warning) => warning.code.startsWith("missing-evidence-slot-")));
  assert.ok(
    carouselItems.every((item) =>
      /Do not invent dimensions, materials, package contents, condition, defects, prices, certifications, sales, rankings, guarantees, reviews, or performance claims/i.test(item.prompt),
    ),
  );
  assert.ok(carouselItems.every((item) => /Do not claim official platform approval or compliance/i.test(item.prompt)));
});

test("platform item prompt overrides and legacy preview overrides remain compatible", () => {
  const planned = buildPlatformPlan("amazon", {
    platformItemOverrides: [{ slotKey: "amazon:benefit-proof", prompt: "User-edited benefit prompt." }],
  });
  const benefit = planned.items.find((item) => item.imageType === "benefit-proof");
  assert.equal(benefit.prompt, "User-edited benefit prompt.");

  const legacyOverridden = applyCreationPlanOverrides(planned, [{ itemId: benefit.itemId, prompt: "Legacy preview override." }]);
  assert.equal(legacyOverridden.items.find((item) => item.itemId === benefit.itemId).prompt, "Legacy preview override.");
  assert.equal(legacyOverridden.carouselImageCount, planned.carouselImageCount);
});

test("planner keeps disabled carousel slots available for browser re-enablement", () => {
  const plan = buildPlatformPlan("amazon", {
    platformItemOverrides: [{ slotKey: "amazon:benefit-proof", enabled: false }],
  });
  const disabledSlot = plan.slots.find((slot) => slot.slotKey === "amazon:benefit-proof");

  assert.equal(plan.slots.length, 7);
  assert.equal(plan.carouselImageCount, 6);
  assert.equal(disabledSlot?.enabled, false);
  assert.equal(plan.items.some((item) => item.slotKey === disabledSlot.slotKey), false);
});

test("planner keeps all 18 universal image types visible when five are requested", () => {
  const plan = buildPlatformPlan("universal", { imageCount: 5 });
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.equal(plan.slots.length, 18);
  assert.equal(plan.slots.filter((slot) => slot.enabled !== false).length, 5);
  assert.ok(plan.slots.slice(5).every((slot) => slot.enabled === false));
  assert.equal(carouselItems.length, 5);
  assert.equal(plan.carouselImageCount, 5);
  assert.equal(plan.imageCount, 5);
});

test("planner preserves an unknown requested platform and exposes the universal fallback warning", () => {
  const plan = buildPlatformPlan("future-market");

  assert.equal(plan.requestedPlatform, "future-market");
  assert.equal(plan.platform, "universal");
  assert.ok(plan.warnings.some((warning) => warning.code === "unknown-platform"));
});

test("strict main-image prompt overrides are revalidated after platform and legacy edits", () => {
  const platformOverridden = buildPlatformPlan("amazon", {
    platformItemOverrides: [
      {
        slotKey: "amazon:amazon-main",
        prompt: "Create a SALE badge, watermark, collage, and external Logo overlay.",
      },
    ],
  });

  assert.equal(platformOverridden.canGenerate, false, "platform item prompt overrides must be validated");
  assert.ok(
    platformOverridden.errors.some((error) => error.constraintId === "amazon-main-no-watermark"),
    "platform item prompt override must trigger the watermark constraint",
  );
  assert.ok(
    platformOverridden.errors.some((error) => error.constraintId === "amazon-main-no-badges"),
    "platform item prompt override must trigger the badge constraint",
  );
  assert.ok(
    platformOverridden.errors.some((error) => error.constraintId === "amazon-main-no-marketing-text"),
    "platform item prompt override must trigger the marketing-text constraint",
  );
  assert.ok(
    platformOverridden.errors.some((error) => error.constraintId === "amazon-main-no-collage"),
    "platform item prompt override must trigger the collage constraint",
  );
  assert.ok(
    platformOverridden.errors.some((error) => error.constraintId === "amazon-main-no-external-logo"),
    "platform item prompt override must trigger the external-Logo constraint",
  );

  const safe = buildPlatformPlan("amazon");
  const main = safe.items[0];
  const legacyOverridden = applyCreationPlanOverrides(safe, [
    {
      itemId: main.itemId,
      prompt: "Add a SALE badge, watermark, collage, and external Logo overlay to the main image.",
    },
  ]);

  assert.equal(legacyOverridden.canGenerate, false, "legacy prompt overrides must be revalidated");
  assert.equal(legacyOverridden.validation.isValid, false, "legacy override validation must be refreshed");
  assert.ok(
    legacyOverridden.errors.some((error) => error.constraintId === "amazon-main-no-watermark"),
    "legacy prompt override must trigger the watermark constraint",
  );
  assert.ok(
    legacyOverridden.errors.some((error) => error.constraintId === "amazon-main-no-badges"),
    "legacy prompt override must trigger the badge constraint",
  );
  assert.ok(
    legacyOverridden.errors.some((error) => error.constraintId === "amazon-main-no-marketing-text"),
    "legacy prompt override must trigger the marketing-text constraint",
  );
  assert.ok(
    legacyOverridden.errors.some((error) => error.constraintId === "amazon-main-no-collage"),
    "legacy prompt override must trigger the collage constraint",
  );
  assert.ok(
    legacyOverridden.errors.some((error) => error.constraintId === "amazon-main-no-external-logo"),
    "legacy prompt override must trigger the external-Logo constraint",
  );
});
