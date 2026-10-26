import test from "node:test";
import assert from "node:assert/strict";

const POLICY_MODULE_URL = new URL("../lib/creation-platform-policies.mjs", import.meta.url);

const EXPECTED_PROFILE_IDS = ["universal"];

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
      "scene-fit-1@1:1",
      "scene-fit-2@1:1",
      "in-box@1:1",
      "variant-comparison@1:1",
      "scene-fit-3@1:1",
      "pain-solution@1:1",
      "selling-point-stack@1:1",
      "creator-demo@1:1",
      "spec-table@1:1",
    ],
  },
};

const IMAGE_TYPE_CONTRACT = {
  "generic-hero": ["hero", "product-dominant", "concise", "optional-context", "allow-supplied"],
  "clean-catalog-main": ["hero", "centered-clean-product", "none", "studio-clean", "preserve-existing-only"],
  "target-shopper-resonance": ["benefit", "target-shopper-decision-moment", "concise", "authentic-use", "allow-supplied"],
  "scene-application": ["scene", "multi-scenario-application", "concise", "authentic-use", "allow-supplied"],
  "scene-fit-1": ["scene-fit-1", "single-scene-adaptation", "none-or-short", "authentic-use", "allow-supplied"],
  "scene-fit-2": ["scene-fit-2", "single-scene-adaptation", "none-or-short", "authentic-use", "allow-supplied"],
  "scene-fit-3": ["scene-fit-3", "single-scene-adaptation", "none-or-short", "authentic-use", "allow-supplied"],
  "multi-angle": ["multi-angle", "three-to-four-angles", "none", "studio-clean", "preserve-existing-only"],
  "ownership-atmosphere": ["atmosphere", "ownership-atmosphere", "concise", "authentic-lifestyle", "allow-supplied"],
  "detail-macro": ["product-detail", "macro-detail-panels", "factual-short", "studio-clean", "allow-supplied"],
  "use-style-story": ["brand-story", "multi-scene-use-style-story", "moderate", "multi-context", "allow-supplied"],
  "dimension-fit": ["size-capacity-fit", "dimension-lines-and-fit-reference", "factual-only", "neutral", "allow-supplied"],
  "comparison-proof": ["effect-comparison", "single-product-functional-rendering", "factual-only", "controlled-context", "allow-supplied"],
  "in-box": ["accessory-gift", "unpacked-included-items-flat-lay", "factual-only", "studio-clean", "allow-supplied"],
  "variant-comparison": ["series-showcase", "supplied-variant-comparison", "factual-only", "studio-clean", "allow-supplied"],
  "pain-solution": ["after-sales", "pain-solution-payoff", "concise", "authentic-use", "allow-supplied"],
  "selling-point-stack": ["usage-suggestion", "selling-points-with-evidence", "concise", "optional-context", "allow-supplied"],
  "creator-demo": ["human-handheld", "person-handheld-or-demo", "concise", "authentic-use", "allow-supplied"],
  "spec-table": ["spec-table", "product-led-key-spec-callouts", "factual-only", "neutral", "allow-supplied"],
  "structure-cutaway": ["craft-process", "cutaway-structure-explain", "factual-short", "neutral", "allow-supplied"],
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
  "after-sales",
  "usage-suggestion",
  "human-handheld",
  "scene-fit-1",
  "scene-fit-2",
  "scene-fit-3",
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
  // The trimmed catalog must not keep roles that no surviving image type can produce.
  assert.deepEqual(
    [...new Set(Object.values(IMAGE_TYPE_CONTRACT).map(([role]) => role))].sort(),
    [...VALID_LEGACY_ROLES].sort(),
  );
  assert.equal(policies.CREATION_PLATFORM_IMAGE_TYPE_REGISTRY["comparison-proof"].imageTypeLabel, "功能效果渲染图");
  assert.equal(policies.CREATION_PLATFORM_IMAGE_TYPE_REGISTRY["target-shopper-resonance"].imageTypeLabel, "目标人群共鸣图");
  assert.doesNotMatch(
    policies.CREATION_PLATFORM_PROFILE_REGISTRY.universal.promptInstruction,
    /comparison/i,
  );
});

policyTest("the single canonical profile exposes exact metadata, counts, sources, and ordered slot sequence", () => {
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
    assert.equal(
      profile.slots.filter((slot) => slot.imageType === "dimension-fit").length,
      1,
      `${platformId} requires exactly one dimension-fit slot`,
    );

    for (const sourceId of profile.sourceIds) {
      assert.ok(policies.CREATION_PLATFORM_SOURCE_REGISTRY[sourceId], `${platformId} references missing source ${sourceId}`);
    }
  }

  assert.equal(policies.CREATION_PLATFORM_PROFILE_REGISTRY.universal.recommendedImageCount, 18);
});

policyTest("the canonical profile exposes structured advisory marketing context", () => {
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

policyTest("source register only retains the internal universal baseline", () => {
  // The four official marketplace sources (amazon-g1881, taobao-uploadspecs,
  // tiktok-shop-481891871868714, walmart-image-guide) were retired together with the strict
  // main-image types, and the Temu marketplace observation was retired with the Temu profile, so
  // no source in the registry may claim an official rule anymore.
  assert.deepEqual(Object.keys(policies.CREATION_PLATFORM_SOURCE_REGISTRY), [
    "internal-universal-baseline",
  ]);

  for (const [sourceId, source] of Object.entries(policies.CREATION_PLATFORM_SOURCE_REGISTRY)) {
    assert.equal(source.id, sourceId);
    assert.equal(source.official, false, `${sourceId} must not claim an official rule`);
    assert.equal(source.url, null, `${sourceId} has no stable public rule URL`);
    assert.deepEqual(source.urls, []);
    assert.ok(source.title.trim());
    assert.equal(source.verifiedAt, "2026-07-11");
  }

  assert.equal(policies.CREATION_PLATFORM_SOURCE_REGISTRY["internal-universal-baseline"].kind, "internal-baseline");
});

policyTest("no surviving image type claims a blocking hard rule without an official source", () => {
  // Every official marketplace source is gone, so the catalog cannot ship blocking constraints or
  // required-by-default slots. The loop below still enforces the invariant that would apply if a
  // sourced hard rule ever came back: it must cite an official https rule URL.
  let blockingConstraintCount = 0;

  for (const definition of Object.values(policies.CREATION_PLATFORM_IMAGE_TYPE_REGISTRY)) {
    assert.equal(
      definition.requiredByDefault,
      false,
      `${definition.imageType} cannot require a slot without an official rule`,
    );

    for (const sourceId of definition.sourceIds) {
      assert.ok(
        policies.CREATION_PLATFORM_SOURCE_REGISTRY[sourceId],
        `${definition.imageType} references missing source ${sourceId}`,
      );
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

  assert.equal(blockingConstraintCount, 0, "no official source remains, so no blocking rule may ship");
});

policyTest("conservative platform guidance remains advisory instead of becoming a hard rule", () => {
  // The 19 -> 2 -> 1 reduction retired every evidence-level-C profile and finally the Temu profile.
  // The only surviving profile rests entirely on a non-official source, so the same advisory
  // contract still has to hold for it.
  assert.equal(policies.CREATION_PLATFORM_PROFILES.some((profile) => profile.evidenceLevel === "C"), false);
  const conservativeProfiles = policies.CREATION_PLATFORM_PROFILES.filter((profile) => (
    profile.sourceIds.every((sourceId) => !policies.CREATION_PLATFORM_SOURCE_REGISTRY[sourceId]?.official)
  ));
  assert.deepEqual(conservativeProfiles.map((profile) => profile.id), ["universal"]);

  for (const profile of conservativeProfiles) {
    assert.ok(profile.slots.every((slot) => slot.advisory));
    assert.ok(profile.slots.every((slot) => !slot.required));
    assert.ok(profile.slots.every((slot) => slot.constraints.every((constraint) => constraint.level !== "blocking")));
    assert.ok(profile.sourceIds.every((sourceId) => !policies.CREATION_PLATFORM_SOURCE_REGISTRY[sourceId]?.official));
  }
});

policyTest("lookup helpers normalize unknown IDs and return clone-safe policy data", () => {
  assert.equal(policies.normalizeCreationPlatformId(" UNIVERSAL "), "universal");
  assert.equal(policies.normalizeCreationPlatformId("temu"), "universal");
  assert.equal(policies.normalizeCreationPlatformId("amazon"), "universal");
  assert.equal(policies.normalizeCreationPlatformId("not-a-platform"), "universal");
  assert.equal(policies.normalizeCreationPlatformId(""), "universal");

  const first = policies.getCreationPlatformProfile("universal");
  const second = policies.getCreationPlatformProfile("universal");
  assert.notEqual(first, second);
  assert.notEqual(first.slots, second.slots);
  first.label = "mutated";
  first.slots[0].ratio = "9:16";
  assert.equal(policies.getCreationPlatformProfile("universal").label, "通用电商");
  assert.equal(policies.getCreationPlatformProfile("universal").slots[0].ratio, "1:1");

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
    freshPolicies.normalizeCreationPlatformId("universal");
    freshPolicies.getCreationPlatformProfile("universal");
    freshPolicies.getCreationPlatformImageType("clean-catalog-main");
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
