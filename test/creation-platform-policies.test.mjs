import test from "node:test";
import assert from "node:assert/strict";

const POLICY_MODULE_URL = new URL("../lib/creation-platform-policies.mjs", import.meta.url);

const EXPECTED_PROFILE_IDS = [
  "universal",
  "amazon",
  "tmall-taobao",
  "jd",
  "pdd",
  "douyin",
  "xiaohongshu",
  "temu",
  "tiktok-shop",
  "shopee",
  "lazada",
  "etsy",
  "ebay",
  "walmart",
  "shopify",
  "aliexpress",
  "rakuten",
  "coupang",
  "mercado-libre",
];

const MARKETING_CONTEXT_FIELDS = [
  "shopperIntent",
  "proofStyle",
  "copyStyle",
  "defaultMotivations",
  "defaultObjections",
];

const PROFILE_CONTRACT = {
  universal: {
    label: "通用电商",
    evidenceLevel: "baseline",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["internal-universal-baseline"],
    slots: [
      "generic-hero@1:1",
      "target-shopper-resonance@1:1",
      "scene-application@1:1",
      "multi-angle@1:1",
      "ownership-atmosphere@1:1",
      "detail-macro@1:1",
      "use-style-story@1:1",
      "dimension-fit@1:1",
      "comparison-proof@1:1",
      "spec-table@1:1",
      "craft-proof@1:1",
      "in-box@1:1",
      "variant-comparison@1:1",
      "material-proof@1:1",
      "pain-solution@1:1",
      "selling-point-stack@1:1",
      "creator-demo@1:1",
      "wearable-demo@1:1",
    ],
  },
  amazon: {
    label: "Amazon",
    evidenceLevel: "A",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["amazon-g1881"],
    slots: [
      "amazon-main@1:1",
      "benefit-proof@1:1",
      "lifestyle-first@1:1",
      "multi-angle@1:1",
      "detail-macro@1:1",
      "dimension-fit@1:1",
      "in-box@1:1",
    ],
  },
  "tmall-taobao": {
    label: "淘宝/天猫",
    evidenceLevel: "A",
    targetLanguage: "zh-CN",
    resolutionTier: "1K",
    sourceIds: ["taobao-uploadspecs"],
    slots: [
      "taobao-white-main@1:1",
      "transparent-cutout@1:1",
      "lifestyle-first@1:1",
      "info-benefit@1:1",
      "detail-macro@1:1",
      "dimension-fit@1:1",
      "variant-comparison@1:1",
      "long-detail@2:3",
    ],
  },
  jd: {
    label: "京东",
    evidenceLevel: "B",
    targetLanguage: "zh-CN",
    resolutionTier: "1K",
    sourceIds: ["jd-main-image-rules"],
    slots: [
      "clean-catalog-main@1:1",
      "spec-table@1:1",
      "comparison-proof@1:1",
      "detail-macro@1:1",
      "lifestyle-first@1:1",
      "dimension-fit@1:1",
      "in-box@1:1",
      "craft-proof@1:1",
    ],
  },
  pdd: {
    label: "拼多多",
    evidenceLevel: "C",
    targetLanguage: "zh-CN",
    resolutionTier: "1K",
    sourceIds: ["pdd-conservative-guidance"],
    slots: [
      "clean-catalog-main@1:1",
      "value-bundle@1:1",
      "benefit-proof@1:1",
      "variant-comparison@1:1",
      "lifestyle-first@1:1",
      "dimension-fit@1:1",
      "detail-macro@1:1",
      "in-box@1:1",
    ],
  },
  douyin: {
    label: "抖音电商",
    evidenceLevel: "C",
    targetLanguage: "zh-CN",
    resolutionTier: "1K",
    sourceIds: ["douyin-conservative-guidance"],
    slots: [
      "clean-catalog-main@1:1",
      "content-cover@3:4",
      "creator-demo@3:4",
      "lifestyle-first@3:4",
      "detail-macro@1:1",
      "dimension-fit@1:1",
    ],
  },
  xiaohongshu: {
    label: "小红书电商",
    evidenceLevel: "B",
    targetLanguage: "zh-CN",
    resolutionTier: "1K",
    sourceIds: ["xiaohongshu-explore-observation"],
    slots: [
      "xhs-feed-cover@3:4",
      "lifestyle-first@3:4",
      "usage-demo@3:4",
      "detail-macro@3:4",
      "scale-proof@3:4",
      "clean-product-proof@1:1",
    ],
  },
  temu: {
    label: "Temu",
    evidenceLevel: "B",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["temu-marketplace-observation"],
    slots: [
      "clean-catalog-main@1:1",
      "value-bundle@1:1",
      "variant-comparison@1:1",
      "benefit-proof@1:1",
      "dimension-fit@1:1",
      "usage-demo@1:1",
      "detail-macro@1:1",
      "in-box@1:1",
    ],
  },
  "tiktok-shop": {
    label: "TikTok Shop",
    evidenceLevel: "A",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["tiktok-shop-481891871868714"],
    slots: [
      "tiktok-shop-main@1:1",
      "creator-demo@1:1",
      "lifestyle-first@1:1",
      "benefit-proof@1:1",
      "detail-macro@1:1",
      "dimension-fit@1:1",
    ],
  },
  shopee: {
    label: "Shopee",
    evidenceLevel: "A",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["shopee-seller-education-2989"],
    slots: [
      "clean-catalog-main@1:1",
      "benefit-proof@1:1",
      "multi-angle@1:1",
      "detail-macro@1:1",
      "dimension-fit@1:1",
      "usage-demo@1:1",
      "variant-comparison@1:1",
      "in-box@1:1",
      "material-proof@1:1",
    ],
  },
  lazada: {
    label: "Lazada",
    evidenceLevel: "C",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["lazada-conservative-guidance"],
    slots: [
      "clean-catalog-main@1:1",
      "benefit-proof@1:1",
      "lifestyle-first@1:1",
      "detail-macro@1:1",
      "dimension-fit@1:1",
      "variant-comparison@1:1",
      "in-box@1:1",
      "comparison-proof@1:1",
    ],
  },
  etsy: {
    label: "Etsy",
    evidenceLevel: "A",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["etsy-image-requirements"],
    slots: [
      "lifestyle-first@4:3",
      "clean-product-proof@4:3",
      "craft-proof@4:3",
      "detail-macro@4:3",
      "scale-proof@4:3",
      "variant-comparison@4:3",
      "gift-packaging@4:3",
      "usage-demo@4:3",
    ],
  },
  ebay: {
    label: "eBay",
    evidenceLevel: "A",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["ebay-photo-tips"],
    slots: [
      "clean-catalog-main@1:1",
      "multi-angle@1:1",
      "label-detail@1:1",
      "condition-proof@1:1",
      "scale-proof@1:1",
      "in-box@1:1",
      "usage-demo@1:1",
      "defect-disclosure@1:1",
    ],
  },
  walmart: {
    label: "Walmart",
    evidenceLevel: "A",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["walmart-image-guide"],
    slots: [
      "walmart-main@1:1",
      "multi-angle@1:1",
      "benefit-proof@1:1",
      "lifestyle-first@1:1",
      "dimension-fit@1:1",
      "in-box@1:1",
    ],
  },
  shopify: {
    label: "Shopify/DTC",
    evidenceLevel: "A",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["shopify-product-media"],
    slots: [
      "brand-hero@1:1",
      "clean-product-proof@1:1",
      "lifestyle-first@1:1",
      "benefit-proof@1:1",
      "detail-macro@1:1",
      "usage-demo@1:1",
      "dimension-fit@1:1",
      "brand-trust@1:1",
    ],
  },
  aliexpress: {
    label: "AliExpress",
    evidenceLevel: "C",
    targetLanguage: "en",
    resolutionTier: "1K",
    sourceIds: ["aliexpress-conservative-guidance"],
    slots: [
      "clean-catalog-main@1:1",
      "variant-comparison@1:1",
      "value-bundle@1:1",
      "benefit-proof@1:1",
      "dimension-fit@1:1",
      "usage-demo@1:1",
      "detail-macro@1:1",
      "in-box@1:1",
    ],
  },
  rakuten: {
    label: "Rakuten",
    evidenceLevel: "C",
    targetLanguage: "ja",
    resolutionTier: "1K",
    sourceIds: ["rakuten-conservative-guidance"],
    slots: [
      "clean-catalog-main@1:1",
      "info-benefit@1:1",
      "detail-macro@1:1",
      "spec-table@1:1",
      "usage-demo@1:1",
      "gift-packaging@1:1",
      "dimension-fit@1:1",
      "in-box@1:1",
    ],
  },
  coupang: {
    label: "Coupang",
    evidenceLevel: "C",
    targetLanguage: "ko",
    resolutionTier: "1K",
    sourceIds: ["coupang-conservative-guidance"],
    slots: [
      "clean-catalog-main@1:1",
      "benefit-proof@1:1",
      "detail-macro@1:1",
      "dimension-fit@1:1",
      "usage-demo@1:1",
      "in-box@1:1",
      "comparison-proof@1:1",
      "long-detail@3:4",
    ],
  },
  "mercado-libre": {
    label: "Mercado Libre",
    evidenceLevel: "C",
    targetLanguage: "es",
    resolutionTier: "1K",
    sourceIds: ["mercado-libre-conservative-guidance"],
    slots: [
      "clean-catalog-main@1:1",
      "multi-angle@1:1",
      "label-detail@1:1",
      "dimension-fit@1:1",
      "usage-demo@1:1",
      "variant-comparison@1:1",
      "in-box@1:1",
      "condition-proof@1:1",
    ],
  },
};

const IMAGE_TYPE_CONTRACT = {
  "generic-hero": ["hero", "product-dominant", "concise", "optional-context", "allow-supplied"],
  "amazon-main": ["hero", "centered-white-85-percent", "none", "studio-white", "forbid-overlay"],
  "taobao-white-main": ["hero", "centered-white-product", "none", "studio-white", "forbid-overlay"],
  "transparent-cutout": ["product-detail", "isolated-transparent-product", "none", "transparent", "forbid-overlay"],
  "tiktok-shop-main": ["hero", "centered-clean-product", "none", "studio-clean", "forbid-overlay"],
  "walmart-main": ["hero", "centered-white-product", "none", "studio-white", "forbid-overlay"],
  "clean-catalog-main": ["hero", "centered-clean-product", "none", "studio-clean", "preserve-existing-only"],
  "brand-hero": ["hero", "brand-key-visual", "concise", "brand-context", "allow-supplied"],
  "content-cover": ["hero", "dynamic-vertical-cover", "concise", "demo-context", "allow-supplied"],
  "xhs-feed-cover": ["hero", "editorial-3x4-cover", "concise", "authentic-lifestyle", "allow-supplied"],
  "lifestyle-first": ["atmosphere", "environmental-first", "none-or-short", "authentic-lifestyle", "allow-supplied"],
  "scene-application": ["scene", "multi-scenario-application", "concise", "authentic-use", "allow-supplied"],
  "ownership-atmosphere": ["atmosphere", "ownership-atmosphere", "concise", "authentic-lifestyle", "allow-supplied"],
  "use-style-story": ["brand-story", "multi-scene-use-style-story", "moderate", "multi-context", "allow-supplied"],
  "target-shopper-resonance": ["benefit", "target-shopper-decision-moment", "concise", "authentic-use", "allow-supplied"],
  "benefit-proof": ["benefit", "product-with-evidence", "concise", "optional-context", "allow-supplied"],
  "info-benefit": ["benefit", "modular-information-hierarchy", "moderate", "neutral", "allow-supplied"],
  "value-bundle": ["accessory-gift", "bundle-quantity-groups", "factual-short", "studio-clean", "allow-supplied"],
  "multi-angle": ["multi-angle", "three-to-four-angles", "none", "studio-clean", "preserve-existing-only"],
  "clean-product-proof": ["multi-angle", "single-product-or-alt-angle", "none", "studio-clean", "preserve-existing-only"],
  "detail-macro": ["product-detail", "macro-detail-panels", "factual-short", "studio-clean", "allow-supplied"],
  "label-detail": ["product-detail", "label-marking-closeup", "factual-only", "studio-clean", "preserve-existing-only"],
  "dimension-fit": ["size-capacity-fit", "dimension-lines-and-fit-reference", "factual-only", "neutral", "allow-supplied"],
  "scale-proof": ["size-capacity-fit", "real-world-scale-reference", "factual-short", "authentic-lifestyle", "allow-supplied"],
  "spec-table": ["spec-table", "product-led-key-spec-callouts", "factual-only", "neutral", "allow-supplied"],
  "usage-demo": ["usage-suggestion", "usage-or-step-demo", "concise", "authentic-use", "allow-supplied"],
  "creator-demo": ["human-handheld", "person-handheld-or-demo", "concise", "authentic-use", "allow-supplied"],
  "wearable-demo": ["human-wearable", "person-wearing-or-carrying", "concise", "authentic-use", "allow-supplied"],
  "in-box": ["accessory-gift", "unpacked-included-items-flat-lay", "factual-only", "studio-clean", "allow-supplied"],
  "variant-comparison": ["series-showcase", "supplied-variant-comparison", "factual-only", "studio-clean", "allow-supplied"],
  "material-proof": ["ingredient-material", "material-ingredient-or-color-swatches", "factual-short", "neutral", "allow-supplied"],
  "craft-proof": ["craft-process", "craft-or-quality-evidence", "factual-short", "process", "allow-supplied"],
  "comparison-proof": ["effect-comparison", "single-product-functional-rendering", "factual-only", "controlled-context", "allow-supplied"],
  "pain-solution": ["after-sales", "pain-solution-payoff", "concise", "authentic-use", "allow-supplied"],
  "selling-point-stack": ["usage-suggestion", "selling-points-with-evidence", "concise", "optional-context", "allow-supplied"],
  "condition-proof": ["product-detail", "condition-inspection", "factual-only", "studio-clean", "preserve-existing-only"],
  "defect-disclosure": ["product-detail", "defect-macro", "factual-only", "studio-clean", "preserve-existing-only"],
  "gift-packaging": ["accessory-gift", "gift-or-unboxing", "concise", "gift-context", "allow-supplied"],
  "long-detail": ["brand-story", "vertical-stacked-detail-modules", "moderate", "multi-context", "allow-supplied"],
  "brand-trust": ["brand-story", "brand-and-real-product-evidence", "concise", "brand-context", "allow-supplied"],
};

const STRICT_IMAGE_TYPE_SOURCES = {
  "amazon-main": "amazon-g1881",
  "taobao-white-main": "taobao-uploadspecs",
  "transparent-cutout": "taobao-uploadspecs",
  "tiktok-shop-main": "tiktok-shop-481891871868714",
  "walmart-main": "walmart-image-guide",
};

const VALID_LEGACY_ROLES = new Set([
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
  "usage-suggestion",
  "human-handheld",
  "human-wearable",
]);

let policies;
let policyImportError;
try {
  policies = await import(POLICY_MODULE_URL.href);
} catch (error) {
  policyImportError = error;
}

test("canonical Creation platform policy module is available", () => {
  assert.ifError(policyImportError);
});

const policyTest = (name, fn) => test(name, { skip: !policies }, fn);

policyTest("policy registry exposes the versioned browser-safe contract", () => {
  assert.equal(policies.CREATION_PLATFORM_POLICY_VERSION, "2026-07-18.2");
  assert.equal(policies.CREATION_PLATFORM_POLICY_VERIFIED_AT, "2026-07-11");
  assert.deepEqual(policies.CREATION_PLATFORM_EVIDENCE_LEVELS, ["baseline", "A", "B", "C"]);
  assert.deepEqual(policies.CREATION_PLATFORM_RESOLUTION_TIERS, ["1K", "1.5K", "2K", "max"]);

  for (const exportName of [
    "CREATION_PLATFORM_SOURCE_REGISTRY",
    "CREATION_PLATFORM_IMAGE_TYPE_REGISTRY",
    "CREATION_PLATFORM_PROFILES",
    "CREATION_PLATFORM_PROFILE_REGISTRY",
    "CREATION_PLATFORM_OPTIONS",
    "getCreationPlatformImageType",
    "getCreationPlatformProfile",
    "listCreationPlatformImageTypes",
    "listCreationPlatformProfiles",
    "normalizeCreationPlatformId",
  ]) {
    assert.ok(exportName in policies, `missing export ${exportName}`);
  }
});

policyTest("image-type catalog preserves the approved legacy roles and visual policies", () => {
  assert.deepEqual(Object.keys(policies.CREATION_PLATFORM_IMAGE_TYPE_REGISTRY), Object.keys(IMAGE_TYPE_CONTRACT));

  for (const [imageType, expected] of Object.entries(IMAGE_TYPE_CONTRACT)) {
    const definition = policies.CREATION_PLATFORM_IMAGE_TYPE_REGISTRY[imageType];
    const [role, composition, textPolicy, scenePolicy, logoPolicy] = expected;

    assert.deepEqual(
      {
        imageType: definition.imageType,
        role: definition.role,
        composition: definition.composition,
        textPolicy: definition.textPolicy,
        scenePolicy: definition.scenePolicy,
        logoPolicy: definition.logoPolicy,
      },
      { imageType, role, composition, textPolicy, scenePolicy, logoPolicy },
    );
    assert.ok(definition.imageTypeLabel.trim(), `${imageType} requires a user-facing label`);
    assert.ok(VALID_LEGACY_ROLES.has(definition.role), `${imageType} has unsupported legacy role ${definition.role}`);
  }
  assert.equal(policies.CREATION_PLATFORM_IMAGE_TYPE_REGISTRY["comparison-proof"].imageTypeLabel, "功能效果渲染图");
  assert.equal(policies.CREATION_PLATFORM_IMAGE_TYPE_REGISTRY["target-shopper-resonance"].imageTypeLabel, "目标人群共鸣图");
  for (const platformId of ["lazada", "coupang"]) {
    assert.doesNotMatch(policies.CREATION_PLATFORM_PROFILE_REGISTRY[platformId].promptInstruction, /comparison/i);
  }
});

policyTest("all 19 profiles expose exact metadata, counts, sources, and ordered slot sequences", () => {
  assert.deepEqual(
    policies.CREATION_PLATFORM_PROFILES.map((profile) => profile.id),
    EXPECTED_PROFILE_IDS,
  );
  assert.deepEqual(Object.keys(policies.CREATION_PLATFORM_PROFILE_REGISTRY), EXPECTED_PROFILE_IDS);
  assert.deepEqual(
    policies.CREATION_PLATFORM_OPTIONS.map((option) => option.value),
    EXPECTED_PROFILE_IDS,
  );

  for (const platformId of EXPECTED_PROFILE_IDS) {
    const profile = policies.CREATION_PLATFORM_PROFILE_REGISTRY[platformId];
    const expected = PROFILE_CONTRACT[platformId];

    assert.equal(profile.label, expected.label);
    assert.equal(profile.strategyVersion, policies.CREATION_PLATFORM_POLICY_VERSION);
    assert.equal(profile.verifiedAt, policies.CREATION_PLATFORM_POLICY_VERIFIED_AT);
    assert.equal(profile.evidenceLevel, expected.evidenceLevel);
    assert.equal(profile.targetLanguage, expected.targetLanguage);
    assert.equal(profile.resolutionTier, expected.resolutionTier);
    assert.equal(profile.recommendedImageCount, expected.slots.length);
    assert.deepEqual(profile.sourceIds, expected.sourceIds);
    assert.ok(profile.promptInstruction.trim(), `${platformId} requires platform guidance`);
    assert.deepEqual(
      profile.slots.map((slot) => `${slot.imageType}@${slot.ratio}`),
      expected.slots,
    );
    assert.ok(
      profile.slots.some((slot) => ["dimension-fit", "scale-proof"].includes(slot.imageType)),
      `${platformId} requires a dimension or scale slot`,
    );

    for (const sourceId of profile.sourceIds) {
      assert.ok(policies.CREATION_PLATFORM_SOURCE_REGISTRY[sourceId], `${platformId} references missing source ${sourceId}`);
    }
  }

  assert.equal(policies.CREATION_PLATFORM_PROFILE_REGISTRY.amazon.recommendedImageCount, 7);
  assert.equal(policies.CREATION_PLATFORM_PROFILE_REGISTRY.shopee.recommendedImageCount, 9);
  assert.equal(policies.CREATION_PLATFORM_PROFILE_REGISTRY.universal.recommendedImageCount, 18);
});

policyTest("all 19 profiles expose structured advisory marketing context", () => {
  for (const id of EXPECTED_PROFILE_IDS) {
    const profile = policies.CREATION_PLATFORM_PROFILE_REGISTRY[id];
    for (const field of MARKETING_CONTEXT_FIELDS) {
      assert.ok(profile.marketingContext?.[field], `${id} missing marketingContext.${field}`);
    }
    assert.ok(Array.isArray(profile.marketingContext.defaultMotivations));
    assert.ok(Array.isArray(profile.marketingContext.defaultObjections));
    assert.equal(profile.marketingContext.advisory, true);
    assert.equal(profile.marketingContext.constraints, undefined);
  }
});

policyTest("expanded slots carry exact roles and per-item generation policies", () => {
  for (const platformId of EXPECTED_PROFILE_IDS) {
    const profile = policies.CREATION_PLATFORM_PROFILE_REGISTRY[platformId];
    const expectedProfile = PROFILE_CONTRACT[platformId];

    const expectedSlots = expectedProfile.slots.map((entry) => {
      const [imageType, ratio] = entry.split("@");
      const [role, composition, textPolicy, scenePolicy, logoPolicy] = IMAGE_TYPE_CONTRACT[imageType];
      return {
        slotKey: `${platformId}:${imageType}`,
        imageType,
        role,
        ratio,
        resolutionTier: expectedProfile.resolutionTier,
        targetLanguage: expectedProfile.targetLanguage,
        composition,
        textPolicy,
        scenePolicy,
        logoPolicy,
      };
    });

    assert.deepEqual(
      profile.slots.map((slot) => ({
        slotKey: slot.slotKey,
        imageType: slot.imageType,
        role: slot.role,
        ratio: slot.ratio,
        resolutionTier: slot.resolutionTier,
        targetLanguage: slot.targetLanguage,
        composition: slot.composition,
        textPolicy: slot.textPolicy,
        scenePolicy: slot.scenePolicy,
        logoPolicy: slot.logoPolicy,
      })),
      expectedSlots,
      `${platformId} expanded slot snapshot differs`,
    );

    assert.equal(new Set(profile.slots.map((slot) => slot.slotKey)).size, profile.slots.length);
    assert.equal(new Set(profile.slots.map((slot) => slot.imageType)).size, profile.slots.length);
    assert.ok(profile.slots.every((slot) => VALID_LEGACY_ROLES.has(slot.role)));
    assert.ok(profile.slots.every((slot) => ["1:1", "2:3", "3:4", "4:3"].includes(slot.ratio)));
    assert.ok(profile.slots.every((slot) => ["zh-CN", "en", "ja", "ko", "es"].includes(slot.targetLanguage)));
    assert.ok(profile.slots.every((slot) => policies.CREATION_PLATFORM_RESOLUTION_TIERS.includes(slot.resolutionTier)));
    assert.ok(profile.slots.every((slot) => typeof slot.required === "boolean"));
    assert.ok(profile.slots.every((slot) => typeof slot.advisory === "boolean"));
    assert.ok(profile.slots.every((slot) => Array.isArray(slot.constraints)));
    assert.ok(profile.slots.every((slot) => Array.isArray(slot.sourceIds) && slot.sourceIds.length > 0));
  }
});

policyTest("official source register retains the verified marketplace references", () => {
  const expectedUrls = {
    "amazon-g1881": "https://sellercentral.amazon.com/gp/help/external/G1881",
    "tiktok-shop-481891871868714": "https://seller-us.tiktok.com/university/essay?knowledge_id=481891871868714",
    "walmart-image-guide": "https://marketplacelearn.walmart.com/guides/Item%20setup/Item%20content,%20imagery,%20and%20media/Product-detail-page:-Image-guidelines-&-requirements",
    "etsy-image-requirements": "https://help.etsy.com/hc/en-us/articles/115015663347-Requirements-and-Best-Practices-for-Images-in-Your-Etsy-Shop",
    "ebay-photo-tips": "https://www.ebay.com/sellercenter/listings/photo-tips",
    "shopify-product-media": "https://help.shopify.com/en/manual/products/product-media/product-media-types",
    "shopee-seller-education-2989": "https://seller.shopee.ph/edu/article/2989",
    "taobao-uploadspecs": "https://www.taobao.com/markets/imgrule/uploadspecs",
  };

  for (const [sourceId, url] of Object.entries(expectedUrls)) {
    const source = policies.CREATION_PLATFORM_SOURCE_REGISTRY[sourceId];
    assert.ok(source, `missing verified source ${sourceId}`);
    assert.equal(source.url, url);
    assert.equal(source.official, true);
    assert.equal(source.verifiedAt, "2026-07-11");
  }
});

policyTest("Temu evidence remains an authenticated observation without a public rule URL", () => {
  const source = policies.CREATION_PLATFORM_SOURCE_REGISTRY["temu-marketplace-observation"];

  assert.ok(source);
  assert.equal(source.kind, "authenticated-observation");
  assert.equal(source.official, false);
  assert.equal(source.url, null);
  assert.deepEqual(source.urls, []);
  assert.equal(source.verifiedAt, "2026-07-11");
});

policyTest("blocking constraints and required slots always cite official sources", () => {
  let blockingConstraintCount = 0;

  for (const definition of Object.values(policies.CREATION_PLATFORM_IMAGE_TYPE_REGISTRY)) {
    const expectedStrictSource = STRICT_IMAGE_TYPE_SOURCES[definition.imageType];
    if (expectedStrictSource) {
      assert.equal(definition.requiredByDefault, true);
      assert.ok(definition.constraints.length > 0);
      assert.ok(definition.sourceIds.includes(expectedStrictSource));
    } else {
      assert.equal(definition.requiredByDefault, false);
    }

    for (const constraint of definition.constraints) {
      if (constraint.level !== "blocking") continue;
      blockingConstraintCount += 1;
      assert.ok(constraint.sourceIds.length > 0, `${constraint.id} lacks a source`);
      for (const sourceId of constraint.sourceIds) {
        const source = policies.CREATION_PLATFORM_SOURCE_REGISTRY[sourceId];
        assert.ok(source, `${constraint.id} references missing source ${sourceId}`);
        assert.equal(source.official, true, `${constraint.id} uses non-official source ${sourceId}`);
        assert.match(source.url, /^https:\/\//);
      }
    }
  }

  for (const profile of policies.CREATION_PLATFORM_PROFILES) {
    for (const slot of profile.slots.filter((entry) => entry.required)) {
      assert.ok(slot.constraints.some((constraint) => constraint.level === "blocking"));
      assert.ok(slot.sourceIds.some((sourceId) => policies.CREATION_PLATFORM_SOURCE_REGISTRY[sourceId]?.official));
    }
  }

  assert.ok(blockingConstraintCount >= 10, "strict main-image rules must be represented as concrete constraints");
});

policyTest("C-level platform guidance remains advisory instead of becoming a hard rule", () => {
  const cLevelProfiles = policies.CREATION_PLATFORM_PROFILES.filter((profile) => profile.evidenceLevel === "C");
  assert.deepEqual(
    cLevelProfiles.map((profile) => profile.id),
    ["pdd", "douyin", "lazada", "aliexpress", "rakuten", "coupang", "mercado-libre"],
  );

  for (const profile of cLevelProfiles) {
    assert.ok(profile.slots.every((slot) => slot.advisory));
    assert.ok(profile.slots.every((slot) => !slot.required));
    assert.ok(profile.slots.every((slot) => slot.constraints.every((constraint) => constraint.level !== "blocking")));
    assert.ok(profile.sourceIds.every((sourceId) => !policies.CREATION_PLATFORM_SOURCE_REGISTRY[sourceId]?.official));
  }
});

policyTest("lookup helpers normalize unknown IDs and return clone-safe policy data", () => {
  assert.equal(policies.normalizeCreationPlatformId(" AMAZON "), "amazon");
  assert.equal(policies.normalizeCreationPlatformId("not-a-platform"), "universal");
  assert.equal(policies.normalizeCreationPlatformId(""), "universal");

  const first = policies.getCreationPlatformProfile("amazon");
  const second = policies.getCreationPlatformProfile("amazon");
  assert.notEqual(first, second);
  assert.notEqual(first.slots, second.slots);
  first.label = "mutated";
  first.slots[0].ratio = "9:16";
  assert.equal(policies.getCreationPlatformProfile("amazon").label, "Amazon");
  assert.equal(policies.getCreationPlatformProfile("amazon").slots[0].ratio, "1:1");

  assert.ok(Object.isFrozen(policies.CREATION_PLATFORM_PROFILES));
  assert.ok(Object.isFrozen(policies.CREATION_PLATFORM_PROFILES[0]));
  assert.ok(Object.isFrozen(policies.CREATION_PLATFORM_PROFILES[0].slots));
  assert.ok(Object.isFrozen(policies.CREATION_PLATFORM_PROFILES[0].slots[0]));
});

policyTest("runtime policy lookup performs no marketplace network access", async () => {
  const originalFetch = globalThis.fetch;
  let fetchCalls = 0;
  globalThis.fetch = async (...args) => {
    fetchCalls += 1;
    throw new Error(`unexpected runtime fetch: ${String(args[0])}`);
  };

  try {
    const freshPolicies = await import(`${POLICY_MODULE_URL.href}?no-network=${Date.now()}`);
    freshPolicies.normalizeCreationPlatformId("amazon");
    freshPolicies.getCreationPlatformProfile("amazon");
    freshPolicies.getCreationPlatformImageType("amazon-main");
    freshPolicies.listCreationPlatformProfiles();
    freshPolicies.listCreationPlatformImageTypes();
    assert.equal(fetchCalls, 0);
  } finally {
    if (originalFetch === undefined) {
      delete globalThis.fetch;
    } else {
      globalThis.fetch = originalFetch;
    }
  }
});

policyTest("Creation planner re-exports the canonical platform options instead of a duplicate registry", async () => {
  const planner = await import("../lib/creation-planner.mjs");
  assert.equal(planner.CREATION_PLATFORM_OPTIONS, policies.CREATION_PLATFORM_OPTIONS);
});
