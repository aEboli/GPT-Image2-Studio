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
  assert.ok(amazon.items.every((item) => !/Buyer goal:/i.test(item.prompt)));
  assert.match(amazon.items[0].prompt, /CANVAS TEXT POLICY: Use existing product or packaging markings only/i);
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
    resolutionTier: "1K",
    targetLanguage: "en",
  },
  {
    platform: "tmall-taobao",
    imageTypes: ["taobao-white-main", "transparent-cutout", "lifestyle-first", "info-benefit", "detail-macro", "dimension-fit", "variant-comparison", "long-detail"],
    roles: ["hero", "product-detail", "atmosphere", "benefit", "product-detail", "size-capacity-fit", "series-showcase", "brand-story"],
    ratios: ["1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "2:3"],
    resolutionTier: "1K",
    targetLanguage: "zh-CN",
  },
  {
    platform: "xiaohongshu",
    imageTypes: ["xhs-feed-cover", "lifestyle-first", "usage-demo", "detail-macro", "scale-proof", "clean-product-proof"],
    roles: ["hero", "atmosphere", "usage-suggestion", "product-detail", "size-capacity-fit", "multi-angle"],
    ratios: ["3:4", "3:4", "3:4", "3:4", "3:4", "1:1"],
    resolutionTier: "1K",
    targetLanguage: "zh-CN",
  },
  {
    platform: "etsy",
    imageTypes: ["lifestyle-first", "clean-product-proof", "craft-proof", "detail-macro", "scale-proof", "variant-comparison", "gift-packaging", "usage-demo"],
    roles: ["atmosphere", "multi-angle", "craft-process", "product-detail", "size-capacity-fit", "series-showcase", "accessory-gift", "usage-suggestion"],
    ratios: ["4:3", "4:3", "4:3", "4:3", "4:3", "4:3", "4:3", "4:3"],
    resolutionTier: "1K",
    targetLanguage: "en",
  },
  {
    platform: "ebay",
    imageTypes: ["clean-catalog-main", "multi-angle", "label-detail", "condition-proof", "scale-proof", "in-box", "usage-demo", "defect-disclosure"],
    roles: ["hero", "multi-angle", "product-detail", "product-detail", "size-capacity-fit", "accessory-gift", "usage-suggestion", "product-detail"],
    ratios: ["1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1"],
    resolutionTier: "1K",
    targetLanguage: "en",
  },
  {
    platform: "walmart",
    imageTypes: ["walmart-main", "multi-angle", "benefit-proof", "lifestyle-first", "dimension-fit", "in-box"],
    roles: ["hero", "multi-angle", "benefit", "atmosphere", "size-capacity-fit", "accessory-gift"],
    ratios: ["1:1", "1:1", "1:1", "1:1", "1:1", "1:1"],
    resolutionTier: "1K",
    targetLanguage: "en",
  },
  {
    platform: "pdd",
    imageTypes: ["clean-catalog-main", "value-bundle", "benefit-proof", "variant-comparison", "lifestyle-first", "dimension-fit", "detail-macro", "in-box"],
    roles: ["hero", "accessory-gift", "benefit", "series-showcase", "atmosphere", "size-capacity-fit", "product-detail", "accessory-gift"],
    ratios: ["1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1", "1:1"],
    resolutionTier: "1K",
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
  assert.ok(carouselItems.every((item) => /Treat supplied details and references as source facts/i.test(item.prompt)));
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

  assert.equal(main.imageType, "amazon-main");
  assert.equal(main.logoPolicy, "forbid-overlay");
  assert.equal(main.textPolicy, "none");
  assert.equal(main.composition, "centered-white-85-percent");
  assert.match(main.prompt, /Composition: centered-white-85-percent; scene: studio-white\./i);
  assert.match(main.prompt, /Keep the supplied product in one clean product-led composition/i);
  assert.match(main.prompt, /Use identifiers printed on the supplied product as factual markings/i);
  assert.doesNotMatch(main.prompt, /uploaded external Logo/i);
  assert.doesNotMatch(main.prompt, /Add 3-5 small circular scene frames/i);
  assert.doesNotMatch(main.prompt, /Hero coverage:/i);
  assert.doesNotMatch(main.prompt, /Visual style:/i);
  assert.equal(creationReferenceLabels.appendCreationItemLogoReference, undefined);
});

test("Xiaohongshu prompts use evidence-backed lifestyle context", () => {
  const plan = buildPlatformPlan("xiaohongshu");
  const carouselItems = plan.items.filter((item) => item.itemKind === "carousel");

  assert.equal(carouselItems.length, 6);
  assert.ok(carouselItems.every((item) => /Use authentic lifestyle context with concise editorial copy/i.test(item.prompt)));
  assert.ok(carouselItems.every((item) => /Treat supplied details and references as source facts/i.test(item.prompt)));
  assert.ok(carouselItems.every((item) => !/reviews|engagement metrics|endorsements|user testimony|believable user recommendation/i.test(item.prompt)));
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
      /Treat supplied details and references as source facts/i.test(item.prompt),
    ),
  );
  assert.ok(
    carouselItems
      .filter((item) => item.textPolicy !== "none")
      .every((item) => /Platform fit: ebay\./i.test(item.prompt)),
  );
  assert.ok(
    carouselItems
      .filter((item) => item.textPolicy === "none")
      .every((item) => /Composition:/i.test(item.prompt)),
  );
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

test("universal 18-image set replaces overlapping information images with scene-fit images", () => {
  const universal = buildPlatformPlan("universal", { imageCount: 18 });
  const universalRoles = universal.items.filter((item) => item.itemKind === "carousel").map((item) => item.role);

  assert.equal(universalRoles.length, 18);
  for (const role of ["scene-fit-1", "scene-fit-2", "scene-fit-3"]) assert.ok(universalRoles.includes(role), role);
  for (const role of ["spec-table", "craft-process", "ingredient-material"]) assert.ok(!universalRoles.includes(role), role);

  const legacy = buildCreationPlan({ productName: "Portable first aid kit", imageCount: 18 });
  assert.deepEqual(legacy.items.map((item) => item.role), universalRoles);

  const jdRoles = buildPlatformPlan("jd").items.map((item) => item.imageType);
  assert.ok(jdRoles.includes("spec-table"));
  assert.ok(jdRoles.includes("craft-proof"));
});

test("scene-fit items are each assigned a different supplied scene", () => {
  const plan = buildCreationPlan({
    productName: "便携急救包",
    productDescription: "防水材质，适用户外露营、车内、办公室",
    imageCount: 18,
  });
  const prompts = ["scene-fit-1", "scene-fit-2", "scene-fit-3"].map(
    (role) => plan.items.find((item) => item.role === role).prompt,
  );

  assert.match(prompts[0], /Scene assignment: 适用户外露营/);
  assert.match(prompts[1], /Scene assignment: 车内/);
  assert.match(prompts[2], /Scene assignment: 办公室/);

  const fallback = buildCreationPlan({ productName: "Ceramic mug", imageCount: 18 });
  const fallbackPrompts = ["scene-fit-1", "scene-fit-2", "scene-fit-3"].map(
    (role) => fallback.items.find((item) => item.role === role).prompt.match(/Scene assignment: [^.]+/)[0],
  );
  assert.equal(new Set(fallbackPrompts).size, 3);
});

test("only the scene role copies a scene reference as a blueprint and scene-fit items vary the shot", () => {
  const plan = buildCreationPlan({
    productName: "Jointed swimbait lure",
    imageCount: 18,
    referenceImageRoles: [
      { index: 1, filename: "lure.png", role: "product", note: "Lure product subject" },
      { index: 2, filename: "boat.jpg", role: "scene", note: "Angler on a boat holding a fish" },
    ],
  });
  const byRole = Object.fromEntries(plan.items.map((item) => [item.role, item.prompt]));

  assert.match(byRole.scene, /Scene source boat\.jpg is a visual blueprint/);
  assert.match(byRole.atmosphere, /Scene source boat\.jpg is setting context: keep its kind of environment and activity, and create a new person/);
  for (const role of ["human-handheld", "human-wearable"]) {
    assert.doesNotMatch(byRole[role], /boat\.jpg/, role);
  }
  const shots = ["scene-fit-1", "scene-fit-2", "scene-fit-3"].map((role) => byRole[role].match(/Shot: [^.;]+/)[0]);
  assert.equal(new Set(shots).size, 3);
  assert.ok(plan.items.every((item) => !item.prompt.includes("围绕商品核心价值提炼短卖点")));
});

test("pain-point image is a photographic before-and-after comparison", () => {
  const plan = buildCreationPlan({ productName: "Jointed swimbait lure", selectedRoles: ["after-sales"] });

  assert.match(plan.items[0].prompt, /photographic before-and-after comparison: two side-by-side panels of the same buyer situation/);
});

test("universal set gives every carousel item a distinct visual format and person-led items distinct casts", () => {
  const plan = buildCreationPlan({ productName: "Ceramic pour-over coffee dripper", imageCount: 18 });
  const carousel = plan.items.filter((item) => item.itemKind === "carousel");
  const formats = carousel.map((item) => (item.prompt.match(/Visual format: [^.]+\./) || [""])[0]);

  assert.ok(formats.every(Boolean), "every item declares a visual format");
  assert.equal(new Set(formats).size, carousel.length);

  const ages = ["benefit", "atmosphere", "human-handheld", "human-wearable", "after-sales"].map((role) => {
    const prompt = carousel.find((item) => item.role === role).prompt;
    return prompt.match(/Cast: [^.]*?(\d0s(?:-\d0s)?|late teens or 20s)/)[1];
  });
  assert.equal(new Set(ages).size, ages.length);

  const wearable = carousel.find((item) => item.role === "human-wearable").prompt;
  assert.match(wearable, /When the product is not worn, show a person carrying, packing, or storing it/);
});

test("each supporting reference feeds at most two universal carousel items", () => {
  const referenceImageRoles = [
    { index: 1, filename: "product.png", role: "product", note: "Product subject" },
    { index: 2, filename: "feature.png", role: "feature", note: "Feature callouts" },
    { index: 3, filename: "material.png", role: "material", note: "Material detail" },
    { index: 4, filename: "scene.png", role: "scene", note: "Person using it outdoors" },
    { index: 5, filename: "usage.png", role: "usage", note: "Setup steps" },
    { index: 6, filename: "size.png", role: "dimensions", note: "Length 14cm" },
    { index: 7, filename: "box.png", role: "package", note: "Included items" },
  ];
  const plan = buildCreationPlan({ productName: "Travel kettle", imageCount: 18, referenceImageRoles });
  const images = referenceImageRoles.map((entry) => ({ originalname: entry.filename, name: entry.filename, size: 1000, buffer: Buffer.alloc(4) }));
  const counts = new Map();
  for (const item of plan.items.filter((entry) => entry.itemKind === "carousel")) {
    for (const image of creationReferenceLabels.buildCreationItemReferenceImages(item, images, referenceImageRoles)) {
      counts.set(image.originalname, (counts.get(image.originalname) || 0) + 1);
    }
  }
  counts.delete("product.png");
  for (const [name, count] of counts) assert.ok(count <= 2, `${name} used ${count} times`);
});

test("five SKUs all reach the SKU choice image and each SKU image keeps its own subject", () => {
  const colors = ["gold", "green", "red", "purple", "blue"];
  const referenceImageRoles = colors.map((color, index) => ({ index: index + 1, filename: `${color}.png`, role: "product", note: `${color} lure` }));
  const skuSubjects = colors.map((color, index) => ({ id: color, title: color, filenames: [`${color}.png`], referenceIndexes: [index + 1] }));
  const plan = buildCreationPlan({ productName: "Swimbait lure", imageCount: 18, referenceImageRoles, skuSubjects });
  const images = referenceImageRoles.map((entry) => ({ originalname: entry.filename, name: entry.filename, size: 1000, buffer: Buffer.alloc(4) }));
  const namesFor = (item) => creationReferenceLabels.buildCreationItemReferenceImages(item, images, referenceImageRoles).map((image) => image.originalname);

  assert.deepEqual(namesFor(plan.items.find((item) => item.role === "series-showcase")).sort(), colors.map((color) => `${color}.png`).sort());
  const skuItems = plan.items.filter((item) => item.role === "sku");
  assert.equal(skuItems.length, 5);
  skuItems.forEach((item, index) => assert.equal(namesFor(item)[0], `${colors[index]}.png`));
});

test("ordinary items diverge from the product itself while added elements stay grounded", () => {
  const plan = buildCreationPlan({ productName: "Ceramic pour-over coffee dripper", imageCount: 18 });
  for (const item of plan.items.filter((entry) => entry.itemKind === "carousel")) {
    assert.match(item.prompt, /Creative range: extend ideas from this product's own category, function, visible features, and likely buyer/, item.role);
    assert.match(item.prompt, /every added prop, person, setting, or line of text serves that product's real use/, item.role);
  }
  const fallback = plan.items.find((item) => item.role === "scene-fit-2").prompt;
  assert.match(fallback, /Scene assignment: a second real setting implied by this product's function or buyer/);

  const amazon = buildCreationPlan({ productName: "Ceramic pour-over coffee dripper", platform: "amazon" });
  assert.doesNotMatch(amazon.items[0].prompt, /Creative range:/);
});
