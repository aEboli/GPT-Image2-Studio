import assert from "node:assert/strict";
import test from "node:test";

import { CREATION_PLATFORM_OPTIONS } from "../lib/creation-platform-policies.mjs";
import {
  CREATION_LISTING_ARCHETYPES,
  CREATION_LISTING_PLATFORM_POLICIES,
  CREATION_LISTING_POLICY_VERSION,
  CREATION_LISTING_SOURCE_REGISTER,
  getCreationListingPolicy,
  listCreationListingPolicies,
  resolveCreationListingLocale,
  resolveCreationListingPolicy,
} from "../lib/creation-listing-policies.mjs";
import { normalizeCreationListingDraftForView } from "../lib/creation-listing-view.mjs";

const CANONICAL_IDS = CREATION_PLATFORM_OPTIONS.map(({ value }) => value);
const COMPLETE_POLICY_FIELDS = [
  "id",
  "label",
  "marketplaceId",
  "defaultLocale",
  "policyVersion",
  "verifiedAt",
  "evidenceLevel",
  "sourceIds",
  "archetypeId",
  "titleRules",
  "highlightRules",
  "descriptionRules",
  "searchRules",
  "conversionOrder",
  "variantStrategy",
  "claimRiskGroups",
  "publishFields",
  "internalFields",
  "fallback",
];

test("listing policy registry has five archetypes and exact canonical platform coverage", () => {
  assert.equal(CREATION_LISTING_POLICY_VERSION, "listing-policy-2026-07-18.v3");
  assert.deepEqual(Object.keys(CREATION_LISTING_ARCHETYPES).sort(), [
    "content",
    "editorial",
    "search",
    "universal",
    "value",
  ]);
  assert.equal(CANONICAL_IDS.length, 19);
  assert.deepEqual(CREATION_LISTING_PLATFORM_POLICIES.map(({ id }) => id), CANONICAL_IDS);
  assert.deepEqual(listCreationListingPolicies().map(({ id }) => id), CANONICAL_IDS);

  for (const policy of CREATION_LISTING_PLATFORM_POLICIES) {
    COMPLETE_POLICY_FIELDS.forEach((field) => assert.ok(field in policy, `${policy.id}.${field}`));
    assert.equal(policy.policyVersion, CREATION_LISTING_POLICY_VERSION);
    assert.equal(policy.verifiedAt, "2026-07-18");
    assert.ok(CREATION_LISTING_ARCHETYPES[policy.archetypeId]);
    assert.ok(["A", "B", "C"].includes(policy.evidenceLevel));
    assert.ok(policy.publishFields.includes("title"));
    assert.ok(policy.publishFields.includes("description"));
    assert.ok(policy.internalFields.includes("buyerObjections"));
    assert.ok(Array.isArray(policy.titleRules.hardConstraintSourceIds));
    assert.ok(Array.isArray(policy.highlightRules.hardConstraintSourceIds));
    assert.ok(Array.isArray(policy.searchRules.hardConstraintSourceIds));
  }
});

test("listing source register is independent, versioned, official where claimed, and internally referenced", () => {
  assert.notEqual(CREATION_LISTING_SOURCE_REGISTER, undefined);
  assert.ok(CREATION_LISTING_SOURCE_REGISTER["advertising-law-truthfulness"]);
  assert.equal(CREATION_LISTING_SOURCE_REGISTER["advertising-law-truthfulness"].verifiedAt, "2026-07-18");
  assert.match(CREATION_LISTING_SOURCE_REGISTER["advertising-law-truthfulness"].url, /^https:\/\/www\.samr\.gov\.cn\//);
  const amazonTitleAnnouncement = CREATION_LISTING_SOURCE_REGISTER["amazon-title-75-effective-2026-07-27"];
  const amazonPolicy = getCreationListingPolicy("amazon");
  assert.equal(amazonTitleAnnouncement.effectiveFrom, "2026-07-27");
  assert.equal(amazonTitleAnnouncement.effectiveFrom, amazonPolicy.titleRules.effectiveFrom);

  for (const policy of CREATION_LISTING_PLATFORM_POLICIES) {
    for (const sourceId of policy.sourceIds) {
      assert.ok(CREATION_LISTING_SOURCE_REGISTER[sourceId], `${policy.id} source ${sourceId}`);
    }
    for (const sourceId of [
      ...policy.titleRules.hardConstraintSourceIds,
      ...policy.highlightRules.hardConstraintSourceIds,
      ...policy.searchRules.hardConstraintSourceIds,
    ]) {
      const source = CREATION_LISTING_SOURCE_REGISTER[sourceId];
      assert.ok(source, `${policy.id} hard source ${sourceId}`);
      assert.equal(source.authority, "official", `${policy.id} hard source authority`);
      assert.equal(source.verifiedAt, "2026-07-18");
    }
  }
});

test("listing archetypes and platform overrides contain no brand semantics", () => {
  const archetypeText = JSON.stringify(CREATION_LISTING_ARCHETYPES);
  assert.doesNotMatch(archetypeText, /brand/i);
  assert.equal(getCreationListingPolicy("etsy").archetypeId, "editorial");
  assert.equal(getCreationListingPolicy("shopify").archetypeId, "editorial");
  assert.doesNotMatch(JSON.stringify(CREATION_LISTING_PLATFORM_POLICIES), /brand-if-supplied|craft-or-brand-context/i);
});

test("sourced Etsy, Amazon, and Coupang limits preserve their exact units and effective dates", () => {
  const etsy = getCreationListingPolicy("etsy");
  assert.equal(etsy.titleRules.hardMaxChars, 140);
  assert.deepEqual(etsy.titleRules.hardConstraintSourceIds, ["etsy-title-tags"]);
  assert.equal(etsy.searchRules.hardMaxItems, 13);
  assert.equal(etsy.searchRules.hardMaxCharsPerItem, 20);
  assert.deepEqual(etsy.searchRules.hardConstraintSourceIds, ["etsy-title-tags", "etsy-tag-guidance"]);

  const amazon = getCreationListingPolicy("amazon");
  assert.equal(amazon.titleRules.hardMaxChars, 75);
  assert.equal(amazon.titleRules.effectiveFrom, "2026-07-27");
  assert.deepEqual(amazon.titleRules.hardConstraintSourceIds, ["amazon-title-75-effective-2026-07-27"]);
  assert.equal(amazon.searchRules.hardMaxUtf8BytesPerItem, null);
  assert.deepEqual(amazon.searchRules.hardConstraintSourceIds, []);

  const coupang = getCreationListingPolicy("coupang");
  assert.equal(coupang.searchRules.hardMaxItems, 20);
  assert.equal(coupang.searchRules.hardMaxCharsPerItem, null);
  assert.equal(coupang.searchRules.hardMaxUtf8BytesPerItem, 20);
  assert.deepEqual(coupang.searchRules.hardConstraintSourceIds, ["coupang-product-creation"]);
});

test("saved drafts keep their frozen listing policy version when read by the view", () => {
  const draft = normalizeCreationListingDraftForView({
    schemaVersion: "2",
    platformId: "etsy",
    marketplace: "etsy",
    listingPolicyVersion: "listing-policy-2026-07-15.v1",
    language: "en-US",
    title: "Historical Etsy title",
    highlights: ["Historical highlight"],
    description: "Historical description.",
    searchTerms: ["historical tag"],
  });

  assert.equal(draft.listingPolicyVersion, "listing-policy-2026-07-15.v1");
});

test("low-evidence Listing platforms expose conservative recommendations without official hard limits", () => {
  for (const id of ["temu", "aliexpress", "mercado-libre"]) {
    const policy = getCreationListingPolicy(id);
    assert.equal(policy.evidenceLevel, "C");
    assert.equal(policy.titleRules.hardMaxChars, null);
    assert.equal(policy.highlightRules.hardMaxItems, null);
    assert.equal(policy.searchRules.hardMaxItems, null);
    assert.equal(policy.searchRules.hardMaxUtf8BytesPerItem, null);
    assert.deepEqual(policy.titleRules.hardConstraintSourceIds, []);
    assert.deepEqual(policy.highlightRules.hardConstraintSourceIds, []);
    assert.deepEqual(policy.searchRules.hardConstraintSourceIds, []);
    assert.equal(policy.fallback.mode, "conservative-recommendation");
  }
});

test("listing policy resolution freezes platform precedence, aliases, locale, and fallbacks", () => {
  const frozen = resolveCreationListingPolicy({
    effectivePlan: { platformPolicyId: "etsy", targetLanguage: "日本語" },
    platformPolicyId: "ebay",
    platform: "amazon",
    targetLanguage: "English",
  });
  assert.equal(frozen.platformId, "etsy");
  assert.equal(frozen.platformSource, "effectivePlan.platformPolicyId");
  assert.equal(frozen.locale, "ja-JP");
  assert.equal(frozen.localeSource, "effectivePlan.targetLanguage");

  const precedenceCases = [
    [{ effectivePlan: { platform: "walmart" }, platformPolicyId: "ebay", platform: "amazon" }, "walmart", "effectivePlan.platform"],
    [{ platformPolicyId: "ebay", platform: "amazon" }, "ebay", "manifest.platformPolicyId"],
    [{ platform: "amazon" }, "amazon", "manifest.platform"],
    [{}, "universal", "policy.default"],
  ];
  for (const [input, platformId, platformSource] of precedenceCases) {
    const resolved = resolveCreationListingPolicy(input);
    assert.equal(resolved.platformId, platformId);
    assert.equal(resolved.platformSource, platformSource);
  }

  const manifestWrapper = resolveCreationListingPolicy({
    manifest: { platformPolicyId: "rakuten", targetLanguage: "한국어" },
  });
  assert.equal(manifestWrapper.platformId, "rakuten");
  assert.equal(manifestWrapper.locale, "ko-KR");
  assert.equal(manifestWrapper.localeSource, "manifest.targetLanguage");

  const legacyAlias = resolveCreationListingPolicy({ platform: "amazon-us" });
  assert.equal(legacyAlias.platformId, "amazon");
  assert.equal(legacyAlias.marketplaceId, "amazon-us");

  const unknown = resolveCreationListingPolicy({ platform: "not-a-marketplace" });
  assert.equal(unknown.platformId, "universal");
  assert.match(unknown.warnings.join("\n"), /unknown platform/i);

  const legacyMissing = resolveCreationListingPolicy({
    platform: "universal",
    platformProvenance: "legacy-missing",
  });
  assert.equal(legacyMissing.platformId, "universal");
  assert.match(legacyMissing.warnings.join("\n"), /legacy-missing/i);

  assert.equal(resolveCreationListingLocale("简体中文", getCreationListingPolicy("jd")).locale, "zh-CN");
  assert.equal(resolveCreationListingLocale("日本語", getCreationListingPolicy("rakuten")).locale, "ja-JP");
  assert.equal(resolveCreationListingLocale("한국어", getCreationListingPolicy("coupang")).locale, "ko-KR");
  assert.equal(resolveCreationListingLocale("Español", getCreationListingPolicy("mercado-libre")).locale, "es-419");

  const unsupportedLocale = resolveCreationListingPolicy({ platform: "rakuten", targetLanguage: "unsupported" });
  assert.equal(unsupportedLocale.locale, "ja-JP");
  assert.match(unsupportedLocale.warnings.join("\n"), /unsupported listing locale/i);
});

test("listing policy resolution never fetches source URLs at runtime", () => {
  const originalFetch = globalThis.fetch;
  let callCount = 0;
  globalThis.fetch = () => {
    callCount += 1;
    throw new Error("policy resolution must stay offline");
  };
  try {
    for (const id of CANONICAL_IDS) {
      resolveCreationListingPolicy({ platform: id });
    }
    assert.equal(callCount, 0);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
