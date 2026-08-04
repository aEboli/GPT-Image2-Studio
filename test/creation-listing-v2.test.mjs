import assert from "node:assert/strict";
import test from "node:test";

import * as listingAgent from "../lib/creation-listing-agent.mjs";
import * as listingDraft from "../lib/creation-listing-draft.mjs";
import {
  getCreationListingPolicy,
  listCreationListingPolicies,
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
  "packageDimensions",
  "productDimensions",
  "packageWeight",
  "productWeight",
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

const BILINGUAL_CONTENT_FIELDS = [
  "title",
  "sellingPoints",
  "buyerObjections",
  "highlights",
  "description",
  "searchTerms",
  "keywordBuckets",
  "packageDimensions",
  "productDimensions",
  "packageWeight",
  "productWeight",
  "warnings",
  "missingInfo",
];

function requireFunction(module, name) {
  assert.equal(typeof module[name], "function", `${name} must be exported`);
  return module[name];
}

function makeV2Draft(policy, overrides = {}) {
  const locale = policy.locale || policy.defaultLocale;
  const draft = {
    schemaVersion: "2",
    platformId: policy.platformId || policy.id,
    platformLabel: policy.platformLabel || policy.label,
    marketplace: policy.marketplaceId,
    listingPolicyVersion: policy.listingPolicyVersion || policy.policyVersion,
    language: locale,
    title: "Blue Storage Box 2 L Stackable Home Organizer",
    sellingPoints: ["The supplied product details state a 2 L capacity."],
    buyerObjections: ["Check the supplied dimensions before purchase."],
    highlights: [
      "2 L capacity is stated in the supplied product details.",
      "Blue finish is stated in the supplied product details.",
      "Stackable shape is stated in the supplied product details.",
    ],
    description: "Blue storage box with the supplied 2 L capacity, stackable shape, and 20 x 12 x 10 cm dimensions.",
    searchTerms: ["blue storage box", "2 L organizer", "stackable storage"],
    keywordBuckets: {
      exact: ["blue storage box"],
      longTail: ["2 L stackable storage box"],
      traffic: ["home organizer"],
      descriptive: ["blue stackable box"],
    },
    packageDimensions: "Estimated: 22 x 14 x 12 cm (8.66 x 5.51 x 4.72 in)",
    productDimensions: "20 x 12 x 10 cm (7.87 x 4.72 x 3.94 in)",
    packageWeight: "Estimated: 350 g (12.35 oz)",
    productWeight: "Estimated: 250 g (8.82 oz)",
    evidence: ["product-input"],
    missingInfo: [],
    warnings: [],
    status: "completed",
    zhDisplay: {
      title: "蓝色 2 升可叠放家用收纳盒",
      sellingPoints: ["已提供的商品资料注明 2 升容量。"],
      buyerObjections: ["购买前请核对已提供的尺寸。"],
      highlights: [
        "商品资料已注明 2 升容量。",
        "商品资料注明蓝色外观。",
        "商品资料注明可叠放造型。",
      ],
      description: "蓝色收纳盒，已提供 2 升容量、可叠放造型和 20 x 12 x 10 厘米尺寸。",
      searchTerms: ["蓝色收纳盒", "2 升整理盒", "可叠放收纳"],
      keywordBuckets: {
        exact: ["蓝色收纳盒"],
        longTail: ["2 升可叠放收纳盒"],
        traffic: ["家用整理盒"],
        descriptive: ["蓝色可叠放盒"],
      },
      packageDimensions: "预估：22 x 14 x 12 厘米（8.66 x 5.51 x 4.72 英寸）",
      productDimensions: "20 x 12 x 10 厘米（7.87 x 4.72 x 3.94 英寸）",
      packageWeight: "预估：350 克（12.35 盎司）",
      productWeight: "预估：250 克（8.82 盎司）",
      warnings: [],
      missingInfo: [],
    },
  };
  const merged = { ...draft, ...overrides };
  if (!Object.prototype.hasOwnProperty.call(overrides, "zhDisplay")) {
    merged.zhDisplay = {
      title: `中文事实对照：${merged.title}`,
      sellingPoints: merged.sellingPoints.map((item) => `中文事实对照：${item}`),
      buyerObjections: merged.buyerObjections.map((item) => `中文事实对照：${item}`),
      highlights: merged.highlights.map((item) => `中文事实对照：${item}`),
      description: `中文事实对照：${merged.description}`,
      searchTerms: merged.searchTerms.map((item) => `中文事实对照：${item}`),
      keywordBuckets: Object.fromEntries(Object.entries(merged.keywordBuckets).map(([key, values]) => [
        key,
        values.map((item) => `中文事实对照：${item}`),
      ])),
      packageDimensions: /^Estimated\s*:/iu.test(merged.packageDimensions)
        ? `预估：${merged.packageDimensions.replace(/^Estimated\s*:\s*/iu, "")}`
        : `包装尺寸：${merged.packageDimensions}`,
      productDimensions: /^Estimated\s*:/iu.test(merged.productDimensions)
        ? `预估：${merged.productDimensions.replace(/^Estimated\s*:\s*/iu, "")}`
        : `产品尺寸：${merged.productDimensions}`,
      packageWeight: /^Estimated\s*:/iu.test(merged.packageWeight)
        ? `预估：${merged.packageWeight.replace(/^Estimated\s*:\s*/iu, "")}`
        : `包装重量：${merged.packageWeight}`,
      productWeight: /^Estimated\s*:/iu.test(merged.productWeight)
        ? `预估：${merged.productWeight.replace(/^Estimated\s*:\s*/iu, "")}`
        : `产品重量：${merged.productWeight}`,
      warnings: merged.warnings.map((item) => `中文事实对照：${item}`),
      missingInfo: merged.missingInfo.map((item) => `中文事实对照：${item}`),
    };
  }
  return merged;
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

function assertCompleteBilingualNoBrandDraft(draft, forbiddenPattern) {
  for (const field of BILINGUAL_CONTENT_FIELDS) {
    assert.ok(Object.prototype.hasOwnProperty.call(draft, field), field);
    assert.ok(Object.prototype.hasOwnProperty.call(draft.zhDisplay || {}, field), `zhDisplay.${field}`);
    if (Array.isArray(draft[field])) {
      assert.equal(draft.zhDisplay[field].length, draft[field].length, field);
    }
  }
  for (const bucket of ["exact", "longTail", "traffic", "descriptive"]) {
    assert.equal(draft.zhDisplay.keywordBuckets[bucket].length, draft.keywordBuckets[bucket].length, bucket);
  }
  const content = {
    ...Object.fromEntries(BILINGUAL_CONTENT_FIELDS.map((field) => [field, draft[field]])),
    zhDisplay: Object.fromEntries(BILINGUAL_CONTENT_FIELDS.map((field) => [field, draft.zhDisplay[field]])),
  };
  assert.doesNotMatch(JSON.stringify(content), forbiddenPattern);
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
  assert.equal(amazonSchema.properties.zhDisplay.type, "object");
  assert.deepEqual(amazonSchema.properties.zhDisplay.required, BILINGUAL_CONTENT_FIELDS);
  assert.deepEqual(Object.keys(amazonSchema.properties.zhDisplay.properties), BILINGUAL_CONTENT_FIELDS);
  for (const field of BILINGUAL_CONTENT_FIELDS) {
    assert.equal(
      amazonSchema.properties.zhDisplay.properties[field].type,
      amazonSchema.properties[field].type,
      `zhDisplay.${field} must use the same JSON type as ${field}`,
    );
  }
  assert.notEqual(etsySchema.properties.highlights.minItems, 3, "Amazon bullet minimum must not leak into Etsy");
});

test("V2 validator requires complete structurally aligned English and Chinese content", () => {
  const policy = resolveCreationListingPolicy({ platform: "etsy" });
  const missingChinese = listingDraft.validateCreationListingDraft(
    makeV2Draft(policy, { zhDisplay: { title: "蓝色收纳盒" } }),
    { policy, sourceFacts: SOURCE_FACTS, source: SOURCE_FACTS },
  );
  assert.equal(missingChinese.ok, false);
  assert.match(issueText(missingChinese, "errors"), /zhDisplay\.sellingPoints|bilingual/i);

  const misaligned = listingDraft.validateCreationListingDraft(
    makeV2Draft(policy, {
      zhDisplay: {
        ...makeV2Draft(policy).zhDisplay,
        highlights: ["只有一项"],
        keywordBuckets: {
          ...makeV2Draft(policy).zhDisplay.keywordBuckets,
          exact: [],
        },
      },
    }),
    { policy, sourceFacts: SOURCE_FACTS, source: SOURCE_FACTS },
  );
  assert.equal(misaligned.ok, false);
  assert.match(issueText(misaligned, "errors"), /zhDisplay\.highlights.*same number|zhDisplay\.keywordBuckets\.exact.*same number/i);
});

test("V2 normalizer mirrors source-only warnings and deduplicates punctuation variants", () => {
  const policy = resolveCreationListingPolicy({ platform: "universal" });
  const warning = "Generated images were unavailable; copy is based on supplied product inputs";
  const normalized = listingDraft.normalizeCreationListingDraft(
    makeV2Draft(policy, {
      warnings: [warning],
      zhDisplay: {
        ...makeV2Draft(policy).zhDisplay,
        warnings: ["\u751f\u6210\u56fe\u50cf\u8bc1\u636e\u4e0d\u53ef\u7528\uff0c\u6587\u6848\u57fa\u4e8e\u5df2\u63d0\u4f9b\u7684\u5546\u54c1\u8d44\u6599\u3002"],
      },
    }),
    {
      forceV2: true,
      listingPolicy: policy,
      platformId: "universal",
      warnings: [`${warning}.`, "Platform provenance is legacy-missing; universal is a compatibility fallback."],
    },
  );

  assert.equal(normalized.warnings.filter((value) => value.startsWith(warning)).length, 1);
  assert.equal(normalized.zhDisplay.warnings.length, normalized.warnings.length);
  assert.doesNotMatch(JSON.stringify(normalized.warnings), /\buniversal\b/i);
  const validation = listingDraft.validateCreationListingDraft(normalized, {
    policy,
    source: SOURCE_FACTS,
    sourceFacts: SOURCE_FACTS,
  });
  assert.doesNotMatch(issueText(validation, "errors"), /zhDisplay\.warnings.*same number/i);
});

test("no-brand helpers extract structured brand and platform aliases and sanitize recursively", () => {
  const extractForbiddenTerms = requireFunction(listingDraft, "extractCreationListingForbiddenTerms");
  const sanitizeNoBrand = requireFunction(listingDraft, "sanitizeCreationListingNoBrandContent");
  const source = {
    brand: "Acme",
    brandName: "Acme Labs",
    trademark: "RocketMark",
    storeName: "Northwind Store",
    sellerName: "Blue Seller",
    manufacturer: "Contoso Works",
    platformId: "tmall-taobao",
    platformLabel: "淘宝/天猫",
    marketplace: "amazon-us",
    skuSubjects: [{ brandNames: ["Nested Brand"] }],
  };
  const terms = extractForbiddenTerms(source);
  for (const term of ["Acme", "Acme Labs", "RocketMark", "Northwind Store", "Blue Seller", "Contoso Works", "Nested Brand", "Amazon", "amazon-us", "淘宝", "天猫"]) {
    assert.ok(terms.some((value) => value.toLowerCase() === term.toLowerCase()), term);
  }

  const sanitized = sanitizeNoBrand({
    title: "Acme box for Amazon",
    nested: ["来自淘宝 Northwind Store", { text: "RocketMark by Contoso Works" }, "Acme户外登山双肩包"],
  }, terms);
  assert.doesNotMatch(JSON.stringify(sanitized), /Acme|Amazon|淘宝|Northwind|RocketMark|Contoso/i);
  assert.equal(sanitized.nested[2], "户外登山双肩包");
});

test("no-brand extraction records text-declaration provenance and keeps descriptive product prefixes", () => {
  const extractCandidates = requireFunction(listingDraft, "extractCreationListingForbiddenTermCandidates");
  const extractForbiddenTerms = requireFunction(listingDraft, "extractCreationListingForbiddenTerms");
  const source = {
    productName: "Acme Blue Storage Box",
    productDescription: "Sold by Northwind Store. Trademark: RocketMark.",
    sellingPoints: ["品牌：Acme", "店铺：Northwind Store"],
    skuSubjects: [{ id: "blue", note: "卖家：Northwind Store" }],
    referenceImageRoles: [{ role: "hero", note: "商标：RocketMark" }],
  };

  const candidates = extractCandidates(source);
  for (const [term, provenancePattern] of [
    ["Acme", /productName.*prefix|sellingPoints.*brand/i],
    ["Northwind Store", /productDescription.*sold-by|sellingPoints.*store|skuSubjects.*seller/i],
    ["RocketMark", /productDescription.*trademark|referenceImageRoles.*trademark/i],
  ]) {
    const candidate = candidates.find((entry) => entry.term === term);
    assert.ok(candidate, term);
    assert.match(candidate.provenance.join("\n"), provenancePattern, term);
  }
  const forbiddenTerms = extractForbiddenTerms(source);
  for (const term of ["Acme", "Northwind Store", "RocketMark"]) {
    assert.ok(forbiddenTerms.includes(term), term);
  }

  for (const descriptor of ["Red", "Electronic", "Blue", "Travel", "Long", "Product"]) {
    const terms = extractForbiddenTerms({ productName: `${descriptor} Storage Box` });
    assert.equal(terms.some((term) => term.toLowerCase() === descriptor.toLowerCase()), false, descriptor);
  }

  const persistedCandidates = extractCandidates({
    productName: "Travel Bottle",
    sku_title: "Northwind Travel Bottle",
    title: "Acme Travel Bottle for Daily Hydration",
    zhDisplay: { title: "Acme 日常补水便携水瓶" },
  });
  assert.match(
    persistedCandidates.find((entry) => entry.term === "Acme")?.provenance.join("\n") || "",
    /source\.title:prefix|source\.zhDisplay\.title:prefix/u,
  );
  assert.match(
    persistedCandidates.find((entry) => entry.term === "Northwind")?.provenance.join("\n") || "",
    /source\.sku_title:prefix/u,
  );

  for (const [field, title] of [
    ["title", "Handmade Blue Storage Box"],
    ["title", "2 Pack Travel Bottle"],
    ["title", "Serum Product Information"],
    ["skuTitle", "Two Pack Travel Bottle"],
  ]) {
    const terms = extractForbiddenTerms({ [field]: title });
    assert.equal(terms.some((term) => /^(?:handmade|2|serum|two)$/iu.test(term)), false, title);
  }
});

test("RED is not a global platform alias and red product facts survive no-brand sanitization", () => {
  const extractForbiddenTerms = requireFunction(listingDraft, "extractCreationListingForbiddenTerms");
  const sanitizeNoBrand = requireFunction(listingDraft, "sanitizeCreationListingNoBrandContent");
  const terms = extractForbiddenTerms({ productName: "Red Storage Box", title: "Red Storage Box" });
  assert.equal(terms.some((term) => term.toLowerCase() === "red"), false);
  assert.equal(sanitizeNoBrand("Red Storage Box", terms), "Red Storage Box");
});

test("V2 validator recursively rejects forbidden terms in English and Chinese content leaves", () => {
  const policy = resolveCreationListingPolicy({ platform: "amazon" });
  const source = {
    ...SOURCE_FACTS,
    brandName: "Acme Labs",
    storeName: "北风商店",
    platformId: "amazon",
    platformLabel: "Amazon",
  };
  const draft = makeV2Draft(policy, {
    title: "Acme Labs Blue Storage Box",
    zhDisplay: {
      ...makeV2Draft(policy).zhDisplay,
      description: "蓝色收纳盒，由北风商店提供。",
    },
  });
  const validation = listingDraft.validateCreationListingDraft(draft, { policy, sourceFacts: source, source });
  assert.equal(validation.ok, false);
  assert.match(issueText(validation, "errors"), /title.*Acme Labs/i);
  assert.match(issueText(validation, "errors"), /zhDisplay\.description.*北风商店/i);
});

test("V2 model accepts its first parsed response without bilingual completeness", async () => {
  const policy = resolveCreationListingPolicy({ platform: "etsy" });
  const attempts = [];
  const first = makeV2Draft(policy);
  delete first.zhDisplay;
  const fetchImpl = async (_url, init) => {
    attempts.push(JSON.parse(init.body));
    return new Response(JSON.stringify({ output_text: JSON.stringify(first) }), { status: 200 });
  };
  const draft = await listingAgent.requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "test-model",
    source: {
      ...SOURCE_FACTS,
      forceV2: true,
      platformId: "etsy",
      marketplace: "etsy",
      listingPolicyVersion: policy.listingPolicyVersion,
      language: "en-US",
      listingPolicy: policy,
      brandName: "Acme Labs",
      storeName: "Northwind Store",
      shopName: "北风商店",
    },
    fetchImpl,
  });

  assert.equal(attempts.length, 1);
  assert.match(attempts[0].input, /own hard rule, not an official marketplace rule/i);
  assert.match(attempts[0].input, /Acme Labs/);
  assert.ok(attempts[0].text.format.schema.required.includes("zhDisplay"));
  assert.equal(draft.status, "completed");
  assert.equal(draft.title, first.title);
  assert.equal(draft.zhDisplay?.title, "");
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

test("V2 keeps English top-level copy and Simplified Chinese counterparts for every platform locale", () => {
  for (const [platform, language] of [
    ["tmall-taobao", "zh-CN"],
    ["rakuten", "ja-JP"],
    ["coupang", "ko-KR"],
    ["mercado-libre", "es-419"],
  ]) {
    const policy = resolveCreationListingPolicy({ platform });
    const valid = listingDraft.validateCreationListingDraft(makeV2Draft(policy, { language }), {
      policy,
      sourceFacts: SOURCE_FACTS,
      source: SOURCE_FACTS,
    });
    assert.doesNotMatch(issueText(valid, "errors"), /English|Simplified Chinese|language mismatch/i, platform);

    const invalid = listingDraft.validateCreationListingDraft(makeV2Draft(policy, {
      language,
      title: "蓝色收纳盒",
    }), { policy, sourceFacts: SOURCE_FACTS, source: SOURCE_FACTS });
    assert.equal(invalid.ok, false, platform);
    assert.match(issueText(invalid, "errors"), /top-level V2 content fields must be English/i, platform);
  }
});

test("V2 completed drafts require every frozen publish field to be non-empty", () => {
  const policy = resolveCreationListingPolicy({ platform: "etsy" });
  for (const [field, value] of [
    ["title", ""],
    ["highlights", []],
    ["searchTerms", []],
    ["keywordBuckets", { exact: [], longTail: [], traffic: [], descriptive: [] }],
  ]) {
    const draft = makeV2Draft(policy, {
      publishFields: ["title", "highlights", "description", "searchTerms", "keywordBuckets"],
      [field]: value,
      zhDisplay: {
        ...makeV2Draft(policy).zhDisplay,
        [field]: field === "keywordBuckets"
          ? { exact: [], longTail: [], traffic: [], descriptive: [] }
          : value,
      },
    });
    const validation = listingDraft.validateCreationListingDraft(draft, {
      policy,
      source: SOURCE_FACTS,
      sourceFacts: SOURCE_FACTS,
    });
    assert.equal(validation.ok, false, field);
    assert.match(issueText(validation, "errors"), new RegExp(`publishFields.*${field}|${field}.*publish`, "i"), field);
  }
});

test("V2 rejects obvious non-English top-level copy and untraceable Chinese placeholders", () => {
  const policy = resolveCreationListingPolicy({ platform: "etsy" });
  const spanish = listingDraft.validateCreationListingDraft(makeV2Draft(policy, {
    title: "Caja azul apilable para organizar el hogar",
    zhDisplay: {
      ...makeV2Draft(policy).zhDisplay,
      title: "蓝色可叠放家用收纳盒",
    },
  }), { policy, source: SOURCE_FACTS, sourceFacts: SOURCE_FACTS });
  assert.equal(spanish.ok, false);
  assert.match(issueText(spanish, "errors"), /top-level.*English|non-English/i);

  for (const zhDisplay of [
    {
      ...makeV2Draft(policy).zhDisplay,
      title: "商品信息",
      description: "商品说明",
      highlights: ["第 1 项商品信息", "第 2 项商品信息", "第 3 项商品信息"],
      searchTerms: ["商品关键词 1", "商品关键词 2", "商品关键词 3"],
    },
    {
      ...makeV2Draft(policy).zhDisplay,
      title: "厨房刀具套装",
    },
  ]) {
    const validation = listingDraft.validateCreationListingDraft(makeV2Draft(policy, { zhDisplay }), {
      policy,
      source: SOURCE_FACTS,
      sourceFacts: SOURCE_FACTS,
    });
    assert.equal(validation.ok, false);
    assert.match(issueText(validation, "errors"), /generic placeholder|semantic correspondence|traceable.*anchor/i);
  }
});

test("V2 semantic anchors accept a valid translated product phrase without shared Latin words", () => {
  const policy = resolveCreationListingPolicy({ platform: "universal" });
  const draft = makeV2Draft(policy, {
    title: "Travel Bottle for Daily Hydration",
    zhDisplay: {
      ...makeV2Draft(policy).zhDisplay,
      title: "日常补水便携水瓶",
    },
  });
  const validation = listingDraft.validateCreationListingDraft(draft, {
    policy,
    source: SOURCE_FACTS,
    sourceFacts: SOURCE_FACTS,
  });
  assert.doesNotMatch(issueText(validation, "errors"), /semantic correspondence|traceable fact anchor/i);
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

test("parsed V2 output that fails local validation is accepted after one request", async () => {
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
  const source = {
    setId: "set-v2-fallback",
    platformId: "etsy",
    marketplace: "etsy",
    listingPolicyVersion: policy.listingPolicyVersion,
    language: "en-US",
    listingPolicy: policy,
    evidenceMode: "input-only",
    ...SOURCE_FACTS,
    productName: "Acme Blue Storage Box",
    brandName: "Acme",
    storeName: "Northwind Store",
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "test-model",
    source,
    fetchImpl,
  });

  const validation = listingDraft.validateCreationListingDraft(draft, {
    policy,
    sourceFacts: source,
    source,
  });
  assert.equal(draft.status, "completed");
  assert.match(draft.title, /Miracle Cure Box/i);
  assert.equal(calls.length, 1);
  assert.equal(validation.ok, false);
});

test("every platform rejects English and Chinese functional wording", () => {
  for (const basePolicy of listCreationListingPolicies()) {
    const policy = resolveCreationListingPolicy({ platform: basePolicy.id });
    const baseline = makeV2Draft(policy);
    const draft = makeV2Draft(policy, {
      description: "Designed to improve organization and make storage easier.",
      zhDisplay: {
        ...baseline.zhDisplay,
        description: "帮助改善收纳效果，使用更方便。",
      },
    });
    const validation = listingDraft.validateCreationListingDraft(draft, {
      policy,
      sourceFacts: SOURCE_FACTS,
    });
    assert.equal(validation.ok, false, basePolicy.id);
    assert.match(issueText(validation, "errors"), /functional or effect wording/i, basePolicy.id);
  }
});

test("parsed V2 output with local identity and language issues is accepted on first response", async () => {
  const policy = resolveCreationListingPolicy({ platform: "etsy" });
  const invalidOutput = makeV2Draft(policy, {
    title: "Acme Caja sin validar para Northwind Store RocketMark",
  });
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(invalidOutput),
    }), { status: 200 });
  };
  const [source] = listingDraft.buildCreationListingSources({
    setId: "implicit-identities",
    platform: "etsy",
    productName: "Acme Blue Storage Box",
    productDescription: "Sold by Northwind Store. Trademark: RocketMark.",
    sellingPoints: ["品牌：Acme", "2 L capacity"],
    skuSubjects: [{ id: "blue", title: "Blue Storage Box", note: "卖家：Northwind Store" }],
    referenceImageRoles: [{ role: "hero", note: "商标：RocketMark" }],
  });

  for (const term of ["Acme", "Northwind Store", "RocketMark"]) {
    assert.ok(source.forbiddenTerms.includes(term), term);
  }
  const identifiedDraft = await listingAgent.requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "test-model",
    source,
    fetchImpl,
  });

  assert.equal(identifiedDraft.status, "completed");
  assert.match(identifiedDraft.title, /Caja sin validar/i);
  assert.doesNotMatch(JSON.stringify(identifiedDraft), /Acme|Northwind Store|RocketMark/i);
  assert.equal(requestCount, 1);

  const sparseIdentityDraft = await listingAgent.requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "test-model",
    source: {
      ...source,
      productName: "Acme",
      skuTitle: "Acme",
      skuSubjects: [],
      productDescription: "",
      sellingPoints: [],
      referenceImageRoles: [],
      forbiddenTerms: [],
    },
    fetchImpl,
  });

  assert.equal(sparseIdentityDraft.status, "completed");
  assert.match(sparseIdentityDraft.title, /Caja sin validar/i);
  assert.equal(requestCount, 2);
});

test("parsed V2 output for an unknown Chinese category is accepted without fallback", async () => {
  const policy = resolveCreationListingPolicy({ platform: "universal" });
  const invalidOutput = makeV2Draft(policy, {
    title: "Mochila sin validar para el hogar",
  });
  let requestCount = 0;
  const fetchImpl = async () => {
    requestCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(invalidOutput),
    }), { status: 200 });
  };
  const [source] = listingDraft.buildCreationListingSources({
    setId: "unknown-chinese-category",
    platform: "universal",
    productName: "VANAHEIMR户外登山双肩包",
    brandName: "VANAHEIMR",
    productDescription: "适合户外、徒步、登山和旅行使用。",
    sellingPoints: ["多分层结构便于分类收纳"],
  });

  const draft = await listingAgent.requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "test-model",
    source,
    fetchImpl,
  });

  assert.equal(draft.status, "completed");
  assert.match(draft.title, /sin validar para el hogar/i);
  assert.equal(requestCount, 1);
});

test("transient listing gateway failures surface without a deterministic fallback", async () => {
  const [source] = listingDraft.buildCreationListingSources({
    setId: "gateway-outage-fallback",
    platform: "universal",
    productName: "Travel Bottle",
    productDescription: "Compact bottle for daily hydration.",
    sellingPoints: ["Portable and easy to carry"],
  });

  await assert.rejects(
    listingAgent.requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "test-model",
      source,
      fetchImpl: async () => new Response(JSON.stringify({
        error: { message: "upstream unavailable" },
      }), { status: 503 }),
    }),
    /upstream unavailable/i,
  );
});

test("set-scoped mock drafts use completed validated V2 output for Amazon, universal, and legacy-missing records", () => {
  const makeMockCreationListingDraft = requireFunction(listingAgent, "makeMockCreationListingDraft");
  for (const set of [
    { setId: "amazon-set", platform: "amazon", platformProvenance: "explicit", productName: "Acme Blue Box", brandName: "Acme" },
    { setId: "coupang-set", platform: "coupang", platformProvenance: "explicit", productName: "Acme Extra Long Stackable Storage Organizer", brandName: "Acme" },
    { setId: "universal-set", platform: "universal", platformProvenance: "explicit", productName: "Acme Blue Box", brandName: "Acme" },
    { setId: "legacy-set", platformProvenance: "legacy-missing", productName: "Acme Blue Box", brandName: "Acme" },
  ]) {
    const [source] = listingDraft.buildCreationListingSources(set);
    const draft = makeMockCreationListingDraft(source);
    assert.equal(draft.schemaVersion, "2", set.setId);
    assert.equal(draft.platformId, source.platformId, set.setId);
    assert.equal(draft.listingPolicyVersion, source.listingPolicyVersion, set.setId);
    assert.equal(draft.evidenceMode, "input-only", set.setId);
    assert.equal(draft.status, "completed", set.setId);
    assert.ok(draft.title, set.setId);
    assert.ok(draft.highlights.length >= 1, set.setId);
    assert.ok(draft.description, set.setId);
    assertCompleteBilingualNoBrandDraft(draft, /Acme|Amazon|Walmart|Etsy|Temu/i);
    const searchByteLimit = source.listingPolicy.searchRules?.hardMaxUtf8BytesPerItem;
    if (Number.isFinite(searchByteLimit)) {
      for (const term of draft.searchTerms) {
        assert.ok(new TextEncoder().encode(term).length <= searchByteLimit, `${set.setId}: ${term}`);
      }
    }
    const validation = listingDraft.validateCreationListingDraft(draft, {
      policy: source.listingPolicy,
      sourceFacts: source,
      source,
    });
    assert.equal(validation.ok, true, `${set.setId}: ${validation.errors.join("; ")}`);
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
