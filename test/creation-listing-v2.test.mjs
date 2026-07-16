import assert from "node:assert/strict";
import test from "node:test";

import * as listingAgent from "../lib/creation-listing-agent.mjs";
import * as listingDraft from "../lib/creation-listing-draft.mjs";
import {
  getCreationListingPolicy,
  resolveCreationListingPolicy,
} from "../lib/creation-listing-policies.mjs";

const V2_SCHEMA_FIELDS = [
  "schemaVersion",
  "platformId",
  "platformLabel",
  "marketplace",
  "listingPolicyVersion",
  "language",
  "title",
  "sellingPoints",
  "buyerObjections",
  "highlights",
  "description",
  "searchTerms",
  "keywordBuckets",
  "evidence",
  "missingInfo",
  "warnings",
  "status",
];

const SOURCE_FACTS = {
  productName: "Blue Storage Box",
  productDescription: "Blue storage box with a 2 L capacity and stackable shape.",
  sellingPoints: ["2 L capacity", "Stackable shape"],
  dimensions: "20 x 12 x 10 cm",
};

function requireFunction(module, name) {
  assert.equal(typeof module[name], "function", `${name} must be exported`);
  return module[name];
}

function makeV2Draft(policy, overrides = {}) {
  const locale = policy.locale || policy.defaultLocale;
  return {
    schemaVersion: "2",
    platformId: policy.platformId || policy.id,
    platformLabel: policy.platformLabel || policy.label,
    marketplace: policy.marketplaceId,
    listingPolicyVersion: policy.listingPolicyVersion || policy.policyVersion,
    language: locale,
    title: "Blue Storage Box 2 L Stackable Home Organizer",
    sellingPoints: ["The supplied 2 L capacity keeps the size clear."],
    buyerObjections: ["Check the supplied dimensions before purchase."],
    highlights: [
      "2 L capacity is stated in the supplied product details.",
      "Blue finish makes this option easy to identify.",
      "Stackable shape supports tidy everyday storage.",
    ],
    description: "Blue storage box with the supplied 2 L capacity, stackable shape, and 20 x 12 x 10 cm dimensions.",
    searchTerms: ["blue storage box", "2 L organizer", "stackable storage"],
    keywordBuckets: {
      exact: ["blue storage box"],
      longTail: ["2 L stackable storage box"],
      traffic: ["home organizer"],
      descriptive: ["blue stackable box"],
    },
    evidence: ["product-input"],
    missingInfo: [],
    warnings: [],
    status: "completed",
    ...overrides,
  };
}

function issueText(validation, field = "all") {
  const values = field === "errors"
    ? validation?.errors
    : field === "warnings"
      ? validation?.warnings
      : [...(validation?.errors || []), ...(validation?.warnings || [])];
  return (values || [])
    .map((value) => typeof value === "string" ? value : JSON.stringify(value))
    .join("\n");
}

function validateFor(platformId, overrides = {}, options = {}) {
  const policy = resolveCreationListingPolicy({ platform: platformId });
  return listingDraft.validateCreationListingDraft(
    makeV2Draft(policy, overrides),
    { policy, sourceFacts: SOURCE_FACTS, ...options },
  );
}

test("V2 strict schema is a stable superset with policy-driven item constraints", () => {
  const buildCreationListingJsonSchema = requireFunction(listingAgent, "buildCreationListingJsonSchema");
  const amazon = resolveCreationListingPolicy({ platform: "amazon" });
  const etsy = resolveCreationListingPolicy({ platform: "etsy" });
  const amazonSchema = buildCreationListingJsonSchema(amazon);
  const etsySchema = buildCreationListingJsonSchema(etsy);

  assert.equal(amazonSchema.type, "object");
  assert.equal(amazonSchema.additionalProperties, false);
  assert.deepEqual([...amazonSchema.required].sort(), Object.keys(amazonSchema.properties).sort());
  for (const field of V2_SCHEMA_FIELDS) {
    assert.ok(amazonSchema.properties[field], `V2 schema is missing ${field}`);
  }
  assert.equal(amazonSchema.properties.fiveBullets, undefined);
  assert.equal(amazonSchema.properties.backendSearchTerms, undefined);
  assert.equal(amazonSchema.properties.painPoints, undefined);
  assert.equal(amazonSchema.properties.highlights.type, "array");
  assert.equal(amazonSchema.properties.highlights.minItems, 3);
  assert.equal(amazonSchema.properties.searchTerms.type, "array");
  assert.notEqual(etsySchema.properties.highlights.minItems, 3, "Amazon bullet minimum must not leak into Etsy");
});

test("V1 aliases remain readable without mutating or discarding historical content", () => {
  const legacy = {
    id: "listing-legacy",
    marketplace: "amazon-us",
    language: "en-US",
    title: "Original legacy title",
    sellingPoints: ["Original selling point"],
    painPoints: ["Original buyer concern"],
    fiveBullets: ["Original bullet one", "Original bullet two"],
    description: "Original legacy description",
    backendSearchTerms: "original exact backend phrase",
    keywordBuckets: { exact: ["legacy phrase"], longTail: [], traffic: [], descriptive: [] },
    missingInfo: ["Original missing fact"],
    warnings: ["Original warning"],
    zhDisplay: {
      title: "原始旧标题",
      painPoints: ["原始购买疑虑"],
      fiveBullets: ["原始要点一", "原始要点二"],
      backendSearchTerms: "原始后台词",
    },
  };
  const original = structuredClone(legacy);
  const normalized = listingDraft.normalizeCreationListingDraft(legacy);

  assert.deepEqual(legacy, original, "reading a historical draft must not mutate it");
  assert.equal(normalized.marketplace, "amazon-us");
  assert.equal(normalized.platformId, "amazon");
  assert.deepEqual(normalized.highlights, legacy.fiveBullets);
  assert.deepEqual(normalized.buyerObjections, legacy.painPoints);
  assert.deepEqual(normalized.searchTerms, [legacy.backendSearchTerms]);
  assert.deepEqual(normalized.fiveBullets, legacy.fiveBullets);
  assert.deepEqual(normalized.painPoints, legacy.painPoints);
  assert.equal(normalized.backendSearchTerms, legacy.backendSearchTerms);
  assert.deepEqual(normalized.zhDisplay.fiveBullets, legacy.zhDisplay.fiveBullets);
  assert.deepEqual(normalized.zhDisplay.highlights, legacy.zhDisplay.fiveBullets);
  assert.equal(normalized.zhDisplay.backendSearchTerms, legacy.zhDisplay.backendSearchTerms);
  assert.deepEqual(normalized.zhDisplay.searchTerms, [legacy.zhDisplay.backendSearchTerms]);
  assert.notEqual(normalized.schemaVersion, "2", "read compatibility must not silently migrate V1 to V2");
});

test("official Amazon, TikTok Shop, eBay, and Coupang field limits block invalid drafts", () => {
  const amazon = validateFor("amazon", {
    title: "A".repeat(76),
    highlights: ["too short", "also short"],
  }, { validationDate: "2026-07-27" });
  assert.equal(amazon.ok, false);
  assert.match(issueText(amazon, "errors"), /title/i);
  assert.match(issueText(amazon, "errors"), /highlight|bullet/i);

  const amazonLongHighlight = validateFor("amazon", {
    highlights: ["H".repeat(256), "Valid factual highlight", "Another factual highlight"],
  });
  assert.equal(amazonLongHighlight.ok, false);
  assert.match(issueText(amazonLongHighlight, "errors"), /highlight|bullet/i);

  for (const title of ["T".repeat(24), "T".repeat(201)]) {
    const tiktok = validateFor("tiktok-shop", { title });
    assert.equal(tiktok.ok, false);
    assert.match(issueText(tiktok, "errors"), /title/i);
  }

  const ebay = validateFor("ebay", { title: "E".repeat(81) });
  assert.equal(ebay.ok, false);
  assert.match(issueText(ebay, "errors"), /title/i);

  const coupang = validateFor("coupang", {
    title: "가".repeat(101),
    language: "ko-KR",
    searchTerms: [...Array.from({ length: 20 }, (_, index) => `검색${index}`), "가".repeat(21)],
  });
  assert.equal(coupang.ok, false);
  assert.match(issueText(coupang, "errors"), /title|상품명/i);
  assert.match(issueText(coupang, "errors"), /search|tag|검색/i);
});

test("Etsy and low-evidence platforms keep recommendations advisory while bounded safety remains enforceable", () => {
  const etsyPolicy = resolveCreationListingPolicy({ platform: "etsy" });
  etsyPolicy.descriptionRules.recommendedMaxChars = 80;
  const etsy = listingDraft.validateCreationListingDraft(makeV2Draft(etsyPolicy, {
    description: "D".repeat(81),
    searchTerms: Array.from({ length: 13 }, (_, index) => `tag ${index}`),
  }), { policy: etsyPolicy, sourceFacts: SOURCE_FACTS });
  assert.doesNotMatch(issueText(etsy, "errors"), /description|searchTerms|tags/i);
  assert.match(issueText(etsy, "warnings"), /description|search|tag/i);

  const temuPolicy = resolveCreationListingPolicy({ platform: "temu" });
  temuPolicy.descriptionRules.recommendedMaxChars = 80;
  const temu = listingDraft.validateCreationListingDraft(makeV2Draft(temuPolicy, {
    title: "T".repeat(76),
    highlights: Array.from({ length: 7 }, (_, index) => `Supported point ${index + 1}`),
    description: "D".repeat(81),
    searchTerms: Array.from({ length: 13 }, (_, index) => `term ${index}`),
  }), { policy: temuPolicy, sourceFacts: SOURCE_FACTS });
  assert.doesNotMatch(issueText(temu, "errors"), /title|highlight|description|search/i);
  assert.match(issueText(temu, "warnings"), /title/i);
  assert.match(issueText(temu, "warnings"), /highlight/i);
  assert.match(issueText(temu, "warnings"), /description/i);
  assert.match(issueText(temu, "warnings"), /search/i);
  assert.doesNotMatch(issueText(temu, "warnings"), /official violation|violates official/i);

  const safetyCeiling = listingDraft.CREATION_LISTING_FIELD_MAX_CHARS;
  assert.ok(Number.isInteger(safetyCeiling) && safetyCeiling > 0);
  const unsafeTemu = listingDraft.validateCreationListingDraft(makeV2Draft(temuPolicy, {
    title: "T".repeat(safetyCeiling + 1),
  }), { policy: temuPolicy, sourceFacts: SOURCE_FACTS });
  assert.match(issueText(unsafeTemu, "errors"), /title/i);

  const bytePolicy = structuredClone(getCreationListingPolicy("coupang"));
  bytePolicy.titleRules.hardMaxChars = null;
  bytePolicy.titleRules.hardMaxUtf8Bytes = 6;
  bytePolicy.searchRules.hardMaxUtf8BytesPerItem = 6;
  const byteValidation = listingDraft.validateCreationListingDraft(
    makeV2Draft(bytePolicy, { title: "가나다", language: "ko-KR" }),
    { policy: bytePolicy, sourceFacts: SOURCE_FACTS },
  );
  assert.equal(byteValidation.ok, false);
  assert.match(issueText(byteValidation, "errors"), /title.*(?:utf-?8|byte)/i);

  const searchByteValidation = listingDraft.validateCreationListingDraft(
    makeV2Draft(bytePolicy, { title: "가나", language: "ko-KR", searchTerms: ["가나다"] }),
    { policy: bytePolicy, sourceFacts: SOURCE_FACTS },
  );
  assert.equal(searchByteValidation.ok, false);
  assert.match(issueText(searchByteValidation, "errors"), /search.*(?:utf-?8|byte)/i);
});

test("V2 locale validation does not reapply global Amazon English rules", () => {
  const cases = [
    ["tmall-taobao", "zh-CN", "蓝色收纳盒 2升 可叠放家用整理盒", "蓝色外观便于识别。", "适合日常家居整理。", "蓝色 收纳盒"],
    ["rakuten", "ja-JP", "青い収納ボックス 2リットル 積み重ね対応", "青色で種類を確認しやすい商品です。", "日常の収納に使えるボックスです。", "青 収納 ボックス"],
    ["coupang", "ko-KR", "파란색 수납 상자 2리터 적층형 정리함", "파란색 옵션을 쉽게 구분할 수 있습니다.", "일상 정리에 사용하는 수납 상자입니다.", "파란색 수납 상자"],
    ["mercado-libre", "es-419", "Caja azul apilable de 2 litros para organizar", "El color azul permite identificar la opción.", "Caja apilable para organizar objetos de uso diario.", "caja azul apilable"],
  ];

  for (const [platform, language, title, highlight, description, searchTerm] of cases) {
    const validation = validateFor(platform, {
      language,
      title,
      highlights: [highlight],
      description,
      searchTerms: [searchTerm],
    });
    assert.doesNotMatch(issueText(validation, "errors"), /English only|Amazon US|language mismatch/i, platform);
  }
});

test("all platforms apply the same fact gate to generated-image-only high-risk claims", () => {
  const unsafe = {
    title: "FDA Certified Medical Grade Storage Box",
    highlights: [
      "Guaranteed safe for every medical use.",
      "Number one bestseller with five-star reviews.",
      "Works with every device and lasts forever.",
    ],
    description: "Only $9.99 after a 50% discount with a lifetime warranty and money-back refund.",
    searchTerms: ["best certified storage box"],
  };
  const sourceFacts = {
    productName: "Plain Storage Box",
    generatedImageObservations: [
      "The image appears to show a medical-grade certified product with universal compatibility.",
    ],
  };

  for (const platform of ["amazon", "etsy"]) {
    const policy = resolveCreationListingPolicy({ platform });
    const validation = listingDraft.validateCreationListingDraft(
      makeV2Draft(policy, unsafe),
      { policy, sourceFacts },
    );
    const issues = issueText(validation);
    assert.equal(validation.ok, false, platform);
    assert.match(issues, /title/i, platform);
    assert.match(issues, /highlight/i, platform);
    assert.match(issues, /description/i, platform);
    assert.match(issues, /claim|unsupported|evidence|certif|warranty|refund/i, platform);
  }
});

test("two invalid upstream attempts return only a reviewable input-only fallback", async () => {
  const requestCreationListingDraft = requireFunction(listingAgent, "requestCreationListingDraft");
  const policy = resolveCreationListingPolicy({ platform: "etsy" });
  const calls = [];
  const invalidOutput = makeV2Draft(policy, {
    title: "FDA Certified Miracle Cure Box",
    highlights: [],
    description: "Guaranteed best seller with a lifetime warranty.",
    status: "completed",
  });
  const fetchImpl = async (_url, init) => {
    calls.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ output_text: JSON.stringify(invalidOutput) }), { status: 200 });
  };

  const fallback = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "test-model",
    source: {
      setId: "set-v2-fallback",
      platformId: "etsy",
      marketplace: "etsy",
      listingPolicyVersion: policy.listingPolicyVersion,
      language: "en-US",
      listingPolicy: policy,
      evidenceMode: "input-only",
      ...SOURCE_FACTS,
    },
    fetchImpl,
  });

  assert.equal(calls.length, 2);
  assert.ok(["needs-review", "failed"].includes(fallback.status));
  assert.equal(fallback.evidenceMode, "input-only");
  assert.equal(fallback.schemaVersion, "2");
  assert.equal(fallback.platformId, "etsy");
  assert.equal(fallback.marketplace, "etsy");
  assert.equal(fallback.listingPolicyVersion, policy.listingPolicyVersion);
  assert.ok((fallback.warnings?.length || 0) + (fallback.missingInfo?.length || 0) > 0);
  const publicText = [
    fallback.title,
    ...(fallback.highlights || []),
    fallback.description,
    ...(fallback.searchTerms || []),
  ].join("\n");
  assert.doesNotMatch(publicText, /FDA Certified|Miracle Cure|Guaranteed best seller|lifetime warranty/i);
  assert.notEqual(fallback.status, "completed");
});

test("set-scoped mock drafts use V2 for Amazon, universal, and legacy-missing records", () => {
  const makeMockCreationListingDraft = requireFunction(listingAgent, "makeMockCreationListingDraft");
  for (const set of [
    { setId: "amazon-set", platform: "amazon", platformProvenance: "explicit", productName: "Blue Box" },
    { setId: "universal-set", platform: "universal", platformProvenance: "explicit", productName: "Blue Box" },
    { setId: "legacy-set", platformProvenance: "legacy-missing", productName: "Blue Box" },
  ]) {
    const [source] = listingDraft.buildCreationListingSources(set);
    const draft = makeMockCreationListingDraft(source);
    assert.equal(draft.schemaVersion, "2", set.setId);
    assert.equal(draft.platformId, source.platformId, set.setId);
    assert.equal(draft.listingPolicyVersion, source.listingPolicyVersion, set.setId);
    assert.equal(draft.evidenceMode, "input-only", set.setId);
    assert.equal(draft.status, "needs-review", set.setId);
  }
});

test("fact gating ignores policy text, generated-image observations, and internal marketing copy", () => {
  const policy = resolveCreationListingPolicy({ platform: "etsy" });
  const validation = listingDraft.validateCreationListingDraft(makeV2Draft(policy, {
    title: "FDA Certified Medical Grade Storage Box",
    highlights: ["Lifetime warranty is included"],
    description: "Guaranteed safe for every medical use.",
  }), {
    policy,
    sourceFacts: {
      productName: "Plain Storage Box",
      listingPolicy: {
        internalRuleText: "FDA Certified medical grade warranty claims require evidence",
      },
      plannedItems: [{ marketingCopy: "FDA Certified with a lifetime warranty" }],
      generatedImageObservations: ["The image appears medical grade"],
    },
  });

  assert.equal(validation.ok, false);
  assert.match(issueText(validation, "errors"), /title.*unsupported claim/i);
  assert.match(issueText(validation, "errors"), /highlights.*warranty/i);
  assert.match(issueText(validation, "errors"), /description.*medical|description.*safe/i);
});
