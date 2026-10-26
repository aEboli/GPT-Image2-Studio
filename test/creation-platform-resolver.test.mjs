import test from "node:test";
import assert from "node:assert/strict";

import { CREATION_PLATFORM_IMAGE_TYPE_REGISTRY } from "../lib/creation-platform-policies.mjs";

const RESOLVER_MODULE_URL = new URL("../lib/creation-platform-resolver.mjs", import.meta.url);

const LIVE_IMAGE_TYPES = new Set(Object.keys(CREATION_PLATFORM_IMAGE_TYPE_REGISTRY));

// Role order of the universal catalog after the 20-type trim (one role per canonical slot).
const CANONICAL_UNIVERSAL_ROLES = [
  "hero", "benefit", "scene", "multi-angle", "atmosphere", "product-detail",
  "brand-story", "size-capacity-fit", "effect-comparison", "scene-fit-1", "scene-fit-2",
  "accessory-gift", "series-showcase", "scene-fit-3", "after-sales", "usage-suggestion",
  "human-handheld", "spec-table",
];

// Slot order of the only surviving profile.
const CANONICAL_UNIVERSAL_IMAGE_TYPES = [
  "generic-hero", "target-shopper-resonance", "scene-application", "multi-angle",
  "ownership-atmosphere", "detail-macro", "use-style-story", "dimension-fit",
  "comparison-proof", "scene-fit-1", "scene-fit-2", "in-box", "variant-comparison",
  "scene-fit-3", "pain-solution", "selling-point-stack", "creator-demo", "spec-table",
];

function assertLiveImageTypes(plan, message) {
  assert.ok(
    plan.items.every((item) => item && LIVE_IMAGE_TYPES.has(item.imageType)),
    message || `plan materialized a retired image type: ${plan.items.map((item) => item?.imageType).join(", ")}`,
  );
}

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

const CANONICAL_PLATFORM_IDS = ["universal"];

function fullProductEvidence() {
  return {
    dimensions: true,
    materials: true,
    packageContents: true,
    performance: true,
    specifications: true,
    craft: true,
    condition: true,
    defects: true,
    skuVariants: true,
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
    platform: "universal",
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
      slotKey: "universal:detail-macro",
      conversionIntent: { conversionGoal: "用细节降低做工顾虑" },
    }],
  });

  assert.equal(plan.effectiveAudienceStrategy.targetAudience, "重视居家整洁的租房使用者");
  assert.deepEqual(plan.effectiveAudienceStrategy.purchaseMotivations.slice(0, 2), ["节省空间", "保持整洁"]);
  assert.equal(new Set(plan.effectiveAudienceStrategy.purchaseMotivations).size, plan.effectiveAudienceStrategy.purchaseMotivations.length);
  assert.equal(plan.effectiveAudienceStrategy.provenance.targetAudience, "user");
  assert.ok(plan.items.every((item) => item.conversionIntent?.conversionGoal));
  assert.equal(
    plan.items.find((item) => item.slotKey === "universal:detail-macro").conversionIntent.conversionGoal,
    "用细节降低做工顾虑",
  );
  assert.notEqual(plan.items[0].conversionIntent.conversionGoal, plan.items[1].conversionIntent.conversionGoal);
});

resolverTest("resolver merges reference-analysis guidance below explicit set input with field provenance", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "universal",
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
    platform: "universal",
    category: "electronics",
    referenceCoverage: [{ role: "material", filename: "material-card.png", note: "Aluminum shell" }],
    evidence: fullProductEvidence(),
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
        slotKey: "universal:generic-hero",
        targetLanguage: "ko",
        ratio: "1:1",
        resolutionTier: "2K",
        composition: "product-dominant",
        textPolicy: "concise",
        scenePolicy: "optional-context",
        logoPolicy: "allow-supplied",
      },
    ],
  });

  assert.equal(plan.platform, "universal");
  assert.deepEqual(plan.items.map((item) => item.imageType), CANONICAL_UNIVERSAL_IMAGE_TYPES);
  assertLiveImageTypes(plan);

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
      composition: "product-dominant",
      textPolicy: "concise",
      scenePolicy: "optional-context",
      logoPolicy: "allow-supplied",
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

resolverTest("category overlays substitute live slots deterministically and never duplicate a role", () => {
  const canonical = resolver.resolveCreationPlatformPlan({ platform: "universal" });
  const cases = [
    {
      categorySignals: ["condition"],
      expectedImageTypes: ["structure-cutaway"],
      absentImageTypes: ["scene-fit-3"],
    },
    {
      categorySignals: ["package-contents", "multiple-skus"],
      expectedImageTypes: ["in-box", "variant-comparison"],
      unchanged: true,
    },
  ];

  for (const input of cases) {
    const plan = resolver.resolveCreationPlatformPlan({ platform: "universal", ...input });
    const repeated = resolver.resolveCreationPlatformPlan({ platform: "universal", ...input });
    const imageTypes = plan.items.map((item) => item.imageType);
    const roles = plan.items.map((item) => item.role);
    assert.equal(plan.carouselImageCount, 18);
    assert.deepEqual(imageTypes, repeated.items.map((item) => item.imageType));
    assert.deepEqual(plan.categorySignals, input.categorySignals);
    for (const imageType of input.expectedImageTypes) assert.ok(imageTypes.includes(imageType), imageType);
    for (const imageType of input.absentImageTypes || []) assert.equal(imageTypes.includes(imageType), false, imageType);
    if (input.unchanged) assert.deepEqual(imageTypes, canonical.items.map((item) => item.imageType));
    assert.equal(new Set(imageTypes).size, plan.items.length);
    assert.equal(new Set(roles).size, plan.items.length);
    assertLiveImageTypes(plan);
  }
});

resolverTest("every canonical platform keeps one size-related slot without dimension evidence", () => {
  for (const platform of CANONICAL_PLATFORM_IDS) {
    const plan = resolver.resolveCreationPlatformPlan({ platform });
    const sizeItems = plan.items.filter((item) => (
      item.role === "size-capacity-fit" && item.imageType === "dimension-fit"
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
  // The electronics overlay and the feature/comparison-proof reference are already part of the
  // universal catalog, so a condition reference is the surviving substitution: it turns the
  // scene-fit-3 slot into structure-cutaway instead of duplicating the craft-process role.
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    category: "electronics",
    evidence: fullProductEvidence(),
    referenceCoverage: [{ role: "condition", filename: "condition.png" }],
  });

  assert.deepEqual(
    plan.items.map((item) => item.imageType),
    CANONICAL_UNIVERSAL_IMAGE_TYPES.map((imageType) => (imageType === "scene-fit-3" ? "structure-cutaway" : imageType)),
  );
  assert.equal(plan.items[13].imageType, "structure-cutaway");
  assert.equal(plan.items[13].role, "craft-process");
  assert.equal(new Set(plan.items.map((item) => item.imageType)).size, plan.items.length);
  assertLiveImageTypes(plan);
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
  assertLiveImageTypes(plan);
});

resolverTest("missing product evidence never drops or replaces a universal slot", () => {
  // The universal profile is the only surviving platform and the resolver skips the evidence
  // fallback pass for it, so the canonical catalog must stay complete whatever evidence is given.
  const withoutEvidence = resolver.resolveCreationPlatformPlan({ platform: "universal" });
  assert.deepEqual(withoutEvidence.items.map((item) => item.imageType), CANONICAL_UNIVERSAL_IMAGE_TYPES);
  assert.equal(withoutEvidence.carouselImageCount, 18);
  assert.equal(
    new Set(withoutEvidence.items.map((item) => item.imageType)).size,
    withoutEvidence.items.length,
  );
  assertLiveImageTypes(withoutEvidence);
  assert.equal(
    withoutEvidence.warnings.some((warning) => warning.code.startsWith("missing-evidence-slot-")),
    false,
  );

  const withEvidence = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    evidence: { packageContents: true },
    skuSubjects: [{ id: "only-sku" }, { id: "second-sku" }],
  });
  assert.deepEqual(withEvidence.items.map((item) => item.imageType), CANONICAL_UNIVERSAL_IMAGE_TYPES);
  assert.equal(withEvidence.carouselImageCount, 18);
  assert.equal(withEvidence.skuImageCount, 2);
  assert.equal(withEvidence.warnings.some((warning) => warning.code.startsWith("missing-evidence-slot-")), false);
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
      { slotKey: "universal:target-shopper-resonance", order: 0, textPolicy: "factual-short" },
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
    platform: "universal",
    evidence: fullProductEvidence(),
    itemOverrides: [
      { slotKey: "custom-before-main", imageType: "custom", enabled: true, order: 0, prompt: "自定义首图" },
      { slotKey: "universal:generic-hero", order: 1 },
      { slotKey: "custom-after-main", imageType: "custom", enabled: true, order: 2, prompt: "自定义第二张" },
      { slotKey: "universal:target-shopper-resonance", order: 3 },
      { slotKey: "universal:scene-application", order: 4 },
      { slotKey: "universal:multi-angle", order: 5 },
    ],
  });

  assert.deepEqual(plan.slots.slice(0, 4).map((slot) => slot.slotKey), [
    "custom-before-main",
    "universal:generic-hero",
    "custom-after-main",
    "universal:target-shopper-resonance",
  ]);
  assert.equal(plan.slots[0].imageType, "custom");
  assert.equal(plan.slots[0].prompt, "自定义首图");
  assert.equal(plan.slots[2].imageType, "custom");
  assert.equal(plan.slots[2].prompt, "自定义第二张");
  assert.equal(plan.carouselImageCount, 20);
});

resolverTest("disabled slots remain addressable and can be enabled again", () => {
  const disabled = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    evidence: fullProductEvidence(),
    itemOverrides: [{ slotKey: "universal:in-box", enabled: false }],
  });
  assert.equal(disabled.slots.length, 18);
  assert.equal(disabled.items.length, 17);
  assert.equal(disabled.slots.find((slot) => slot.slotKey === "universal:in-box")?.enabled, false);

  const enabledAgain = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    evidence: fullProductEvidence(),
    itemOverrides: [{ slotKey: "universal:in-box", enabled: true }],
  });
  assert.equal(enabledAgain.slots.length, 18);
  assert.equal(enabledAgain.items.length, 18);
  assert.equal(enabledAgain.slots.find((slot) => slot.slotKey === "universal:in-box")?.enabled, true);
});

resolverTest("set image-count override is capped at the canonical platform slot count", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    evidence: fullProductEvidence(),
    skuSubjects: [{ id: "one" }, { id: "two" }],
    setOverrides: { imageCount: 25 },
  });

  assert.equal(plan.slots.length, 18);
  assert.equal(plan.carouselImageCount, 18);
  assert.equal(plan.imageCount, 18);
  assert.equal(plan.items[0].imageType, "generic-hero");
  assert.equal(plan.items.some((item) => item.imageType === "custom"), false);
  assert.equal(plan.setOverrides.imageCount, 18);
  assert.ok(plan.warnings.some((warning) => (
    warning.code === "image-count-extension-limited" &&
    warning.requestedCount === 25 &&
    warning.effectiveCount === 18
  )));
});

resolverTest("applied reference roles rebuild coverage and evidence for feature material package and dimensions", () => {
  const signals = resolver.buildCreationReferencePlanningSignals([
    { filename: "feature.jpg", role: "feature", note: "功能卖点" },
    { filename: "material.jpg", role: "material", note: "结构细节" },
    { filename: "package.jpg", role: "package", note: "包装清单" },
    { filename: "dimensions.jpg", role: "dimensions", note: "尺寸规格" },
  ], {
    performance: true,
    materials: false,
    packageContents: false,
    dimensions: false,
  });

  assert.deepEqual(signals.referenceCoverage.map((entry) => entry.role), ["feature", "material", "package", "dimensions"]);
  assert.equal(signals.evidence.performance, true);
  assert.equal(signals.evidence.materials, true);
  assert.equal(signals.evidence.packageContents, true);
  assert.equal(signals.evidence.dimensions, true);
  assert.equal(signals.evidence.specifications, true);

  for (const platform of CANONICAL_PLATFORM_IDS) {
    const plan = resolver.resolveCreationPlatformPlan({
      platform,
      referenceCoverage: signals.referenceCoverage,
      evidence: signals.evidence,
    });
    assert.ok(plan.items.some((item) => item.imageType === "comparison-proof"), platform);
    assert.ok(plan.items.some((item) => item.imageType === "in-box"), platform);
    assert.ok(plan.items.some((item) => item.imageType === "dimension-fit"), platform);
    assertLiveImageTypes(plan, `${platform} materialized a retired image type`);
  }
});

resolverTest("universal keeps 18 canonical slots without custom extensions", () => {
  const selectedRoles = CANONICAL_UNIVERSAL_ROLES;

  const universal = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    selectedRoles,
    setOverrides: { imageCount: 18 },
  });
  assert.equal(universal.carouselImageCount, 18);
  assert.deepEqual(universal.items.map((item) => item.imageType), CANONICAL_UNIVERSAL_IMAGE_TYPES);
  assert.deepEqual(universal.items.map((item) => item.role), selectedRoles);
  assert.equal(new Set(universal.items.map((item) => item.slotKey)).size, 18);
  assert.equal(universal.items.some((item) => item.imageType === "custom"), false);
  assert.equal(universal.warnings.some((warning) => warning.code === "image-count-extension-limited"), false);
});

resolverTest("manual custom conversion clears inherited platform policy before applying role defaults", () => {
  const plan = resolver.resolveCreationPlatformPlan({
    platform: "universal",
    itemOverrides: [{
      slotKey: "universal:target-shopper-resonance",
      imageType: "custom",
      role: "human-handheld",
    }],
  });
  const custom = plan.slots.find((item) => item.slotKey === "universal:target-shopper-resonance");

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

resolverTest("unknown platforms fall back visibly to the universal profile", () => {
  const unknown = resolver.resolveCreationPlatformPlan({
    platform: "future-market",
    evidence: { dimensions: true, packageContents: true },
    skuSubjects: [{ id: "one" }, { id: "two" }],
  });
  assert.equal(unknown.requestedPlatform, "future-market");
  assert.equal(unknown.platform, "universal");
  assert.equal(unknown.evidenceLevel, "baseline");
  assert.ok(unknown.warnings.some((warning) => warning.code === "unknown-platform"));

  const retired = resolver.resolveCreationPlatformPlan({ platform: "amazon" });
  assert.equal(retired.requestedPlatform, "amazon");
  assert.equal(retired.platform, "universal");
  assert.ok(retired.warnings.some((warning) => warning.code === "unknown-platform"));
});

resolverTest("restore current platform recommendation clears overrides but preserves planning evidence", () => {
  const input = {
    platform: "universal",
    category: "electronics",
    evidence: { dimensions: true, specifications: true, packageContents: true, skuVariants: true },
    referenceCoverage: [{ role: "usage", filename: "usage.png" }],
    skuSubjects: [{ id: "one" }, { id: "two" }],
    setOverrides: { ratio: "4:3", targetLanguage: "ja", imageCount: 4 },
    itemOverrides: [{ slotKey: "universal:scene-application", imageType: "custom", ratio: "3:4" }],
  };

  const modified = resolver.resolveCreationPlatformPlan(input);
  assert.equal(modified.items.find((item) => item.slotKey === "universal:scene-application").imageType, "custom");
  assert.equal(modified.carouselImageCount, 4);

  const restored = resolver.restoreCreationPlatformRecommendations(input);
  assert.equal(restored.platform, "universal");
  assert.equal(restored.items[0].imageType, "generic-hero");
  assert.equal(restored.items[0].ratio, "1:1");
  assert.equal(restored.items[0].targetLanguage, "en");
  assert.equal(restored.carouselImageCount, 18);
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
        { slotKey: "universal:detail-macro", textPolicy: "none" },
        { slotKey: "", textPolicy: "moderate" },
        { slotKey: "universal:in-box", unknown: "ignored" },
      ]),
    ),
    [{ slotKey: "universal:detail-macro", textPolicy: "none" }],
  );
});
