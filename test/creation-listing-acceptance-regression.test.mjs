import assert from "node:assert/strict";
import test from "node:test";

import { requestCreationListingDraft } from "../lib/creation-listing-agent.mjs";
import {
  buildCreationListingSources,
  normalizeCreationListingDraft,
  validateCreationListingDraft,
} from "../lib/creation-listing-draft.mjs";
import {
  getCreationListingPolicy,
  resolveCreationListingPolicy,
} from "../lib/creation-listing-policies.mjs";
import {
  buildCreationListingDraftText,
  buildCreationListingFieldCopyText,
  buildCreationRecordListingText,
  formatCreationListingDraftHeader,
  normalizeCreationListingDraftForView,
} from "../lib/creation-listing-view.mjs";

const EMPTY_KEYWORD_BUCKETS = {
  exact: [],
  longTail: [],
  traffic: [],
  descriptive: [],
};

function buildTraceableChineseRows(values, label) {
  return values.map((item) => `${label}：${item}`);
}

function makeV2Draft(policy, overrides = {}) {
  const draft = {
    schemaVersion: "2",
    platformId: policy.platformId || policy.id,
    platformLabel: policy.platformLabel || policy.label,
    marketplace: policy.marketplaceId,
    listingPolicyVersion: policy.listingPolicyVersion || policy.policyVersion,
    language: policy.locale || policy.language || policy.defaultLocale,
    title: "Blue Stackable Storage Box",
    sellingPoints: ["Blue finish and stackable shape are supplied product facts."],
    buyerObjections: ["Check the supplied dimensions before purchase."],
    highlights: [
      "Blue finish is a supplied product attribute.",
      "Stackable shape is stated in the product data.",
      "Supplied dimensions are listed in the product data.",
    ],
    description: "Blue storage box with a stackable shape and supplied dimensions.",
    searchTerms: ["blue storage box", "stackable organizer"],
    keywordBuckets: {
      exact: ["blue storage box"],
      longTail: ["stackable blue storage box"],
      traffic: ["home organizer"],
      descriptive: ["blue stackable box"],
    },
    evidence: ["product-input"],
    missingInfo: [],
    warnings: [],
    status: "completed",
    ...overrides,
  };
  if (!Object.prototype.hasOwnProperty.call(overrides, "zhDisplay")) {
    draft.zhDisplay = {
      title: `中文标题：${draft.title}`,
      sellingPoints: buildTraceableChineseRows(draft.sellingPoints, "中文卖点"),
      buyerObjections: buildTraceableChineseRows(draft.buyerObjections, "中文购买疑虑"),
      highlights: buildTraceableChineseRows(draft.highlights, "中文亮点"),
      description: `中文描述：${draft.description}`,
      searchTerms: buildTraceableChineseRows(draft.searchTerms, "中文搜索词"),
      keywordBuckets: Object.fromEntries(Object.entries(draft.keywordBuckets).map(([key, values]) => [
        key,
        buildTraceableChineseRows(values, "中文关键词"),
      ])),
      warnings: buildTraceableChineseRows(draft.warnings, "中文警告"),
      missingInfo: buildTraceableChineseRows(draft.missingInfo, "中文缺失信息"),
    };
  }
  return draft;
}

function allIssues(validation) {
  return [...(validation.errors || []), ...(validation.warnings || [])]
    .map((value) => typeof value === "string" ? value : JSON.stringify(value))
    .join("\n");
}

function hasDeepKey(value, targetKey) {
  if (!value || typeof value !== "object") return false;
  if (Object.prototype.hasOwnProperty.call(value, targetKey)) return true;
  return Object.values(value).some((nested) => hasDeepKey(nested, targetKey));
}

function collectStringLeaves(value, leaves = []) {
  if (typeof value === "string") {
    leaves.push(value);
  } else if (Array.isArray(value)) {
    value.forEach((item) => collectStringLeaves(item, leaves));
  } else if (value && typeof value === "object") {
    Object.values(value).forEach((item) => collectStringLeaves(item, leaves));
  }
  return leaves;
}

test("compact Listing Source JSON and upstream request omit internal marketingCopy", async () => {
  const internalCopy = "INTERNAL_MARKETING_COPY_DO_NOT_SEND";
  const [source] = buildCreationListingSources({
    setId: "set-compact-source",
    platform: "universal",
    productName: "Blue Storage Box",
    productDescription: "Blue storage box with a stackable shape.",
    sellingPoints: ["Blue finish", "Stackable shape"],
    items: [{
      itemId: "planned-1",
      role: "benefit",
      title: "Benefit image",
      marketingCopy: internalCopy,
      status: "planned",
    }],
    generatedItems: [{
      itemId: "generated-1",
      role: "hero",
      title: "Hero image",
      marketingCopy: internalCopy,
      status: "completed",
      filename: "hero.png",
    }],
  });
  const policy = source.listingPolicy;
  const requests = [];
  const fetchImpl = async (_url, init) => {
    requests.push(JSON.parse(init.body));
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeV2Draft(policy, { warnings: source.warnings || [] })),
    }), { status: 200 });
  };

  await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "test-model",
    source,
    fetchImpl,
  });

  assert.equal(hasDeepKey(source, "marketingCopy"), false);
  assert.equal(requests.length, 1);
  assert.doesNotMatch(JSON.stringify(requests[0]), /marketingCopy|INTERNAL_MARKETING_COPY_DO_NOT_SEND/i);
});

test("unsupported high-risk claims are rejected in Chinese, English, Japanese, Korean, and Spanish", () => {
  const categories = [
    {
      id: "absolute-ranking",
      issuePattern: /absolute|ranking/i,
      claims: {
        "zh-CN": "全网第一。",
        "en-US": "Number one.",
        "ja-JP": "業界No.1。",
        "ko-KR": "업계 1위.",
        "es-419": "Número 1.",
      },
    },
    {
      id: "certification",
      issuePattern: /certif/i,
      claims: {
        "zh-CN": "权威认证。",
        "en-US": "Officially certified.",
        "ja-JP": "権威ある認証済み。",
        "ko-KR": "권위 인증.",
        "es-419": "Certificación oficial.",
      },
    },
    {
      id: "medical-safety",
      issuePattern: /medical|safety/i,
      claims: {
        "zh-CN": "医疗级。",
        "en-US": "Medical grade.",
        "ja-JP": "医療グレード。",
        "ko-KR": "의료용 등급.",
        "es-419": "Grado médico.",
      },
    },
    {
      id: "lifetime-warranty",
      issuePattern: /lifetime warranty/i,
      claims: {
        "zh-CN": "终身质保。",
        "en-US": "Lifetime warranty.",
        "ja-JP": "永久保証。",
        "ko-KR": "평생 보증.",
        "es-419": "Garantía de por vida.",
      },
    },
  ];

  let validatedCaseCount = 0;
  for (const category of categories) {
    for (const [locale, claim] of Object.entries(category.claims)) {
      const policy = getCreationListingPolicy("universal");
      policy.defaultLocale = locale;
      policy.locale = locale;
      const validation = validateCreationListingDraft(makeV2Draft(policy, {
        language: locale,
        description: claim,
      }), {
        policy,
        sourceFacts: { productName: "Storage Box" },
      });
      const issues = allIssues(validation);
      assert.equal(validation.ok, false, `${locale} ${category.id} claim must be rejected`);
      assert.match(issues, /description/i, `${locale} ${category.id}`);
      assert.match(issues, category.issuePattern, `${locale} ${category.id}`);
      validatedCaseCount += 1;
    }
  }
  assert.equal(validatedCaseCount, 20);
});

test("functional and performance wording stays blocked even with exact evidence", () => {
  const policy = resolveCreationListingPolicy({ platform: "universal" });
  const cases = [
    ["304 Stainless Steel body", "Stainless steel body", "304 Stainless Steel body", true],
    ["FDA Certified product", "CE Certified product", "FDA Certified product", true],
    ["Compatible with iPhone 15 Pro", "Compatible with iPhone 15", "Compatible with iPhone 15 Pro", false],
    ["12-hour battery runtime", "Long battery runtime", "12-hour battery runtime", false],
  ];

  for (const [claim, similarEvidence, exactEvidence, allowedWithEvidence] of cases) {
    const unsupported = validateCreationListingDraft(makeV2Draft(policy, {
      description: claim,
    }), {
      policy,
      sourceFacts: {
        productName: "Test Product",
        productDescription: similarEvidence,
      },
    });
    assert.equal(unsupported.ok, false, `${claim} must not use same-category keyword matching`);
    assert.match(allIssues(unsupported), /description|claim|evidence/i, claim);

    const supportedDraft = makeV2Draft(policy, {
      description: claim,
    });
    supportedDraft.zhDisplay.description = `中文描述：${claim}`;
    const supported = validateCreationListingDraft(supportedDraft, {
      policy,
      sourceFacts: {
        productName: "Test Product",
        productDescription: exactEvidence,
      },
    });
    assert.equal(supported.ok, allowedWithEvidence, `${claim} exact-evidence result`);
    if (!allowedWithEvidence) {
      assert.match(allIssues(supported), /functional|performance|unsupported/i, claim);
    }
  }
});

test("historical V2 full copy maps old-style bilingual fields and excludes review-only metadata", () => {
  for (const platform of ["universal", "temu"]) {
    const policy = resolveCreationListingPolicy({ platform });
    const fixtureId = platform === "universal" ? "A" : "B";
    const draft = normalizeCreationListingDraft(makeV2Draft(policy, {
      title: `EN_TITLE_${fixtureId}`,
      sellingPoints: [`EN_SELLING_${fixtureId}`],
      buyerObjections: [`EN_OBJECTION_${fixtureId}`],
      highlights: [`EN_HIGHLIGHT_${fixtureId}`],
      description: `EN_DESCRIPTION_${fixtureId}`,
      searchTerms: [`EN_SEARCH_${fixtureId}`],
      keywordBuckets: {
        exact: [`EN_EXACT_${fixtureId}`],
        longTail: [`EN_LONG_TAIL_${fixtureId}`],
        traffic: [`EN_TRAFFIC_${fixtureId}`],
        descriptive: [`EN_DESCRIPTIVE_${fixtureId}`],
      },
      warnings: [`EN_WARNING_${fixtureId}`],
      missingInfo: [`EN_MISSING_${fixtureId}`],
      zhDisplay: {
        title: `中文标题_${fixtureId} EN_TITLE_${fixtureId}`,
        sellingPoints: [`中文卖点_${fixtureId} EN_SELLING_${fixtureId}`],
        buyerObjections: [`中文疑虑_${fixtureId} EN_OBJECTION_${fixtureId}`],
        highlights: [`中文亮点_${fixtureId} EN_HIGHLIGHT_${fixtureId}`],
        description: `中文描述_${fixtureId} EN_DESCRIPTION_${fixtureId}`,
        searchTerms: [`中文搜索_${fixtureId} EN_SEARCH_${fixtureId}`],
        keywordBuckets: {
          exact: [`中文精准_${fixtureId} EN_EXACT_${fixtureId}`],
          longTail: [`中文长尾_${fixtureId} EN_LONG_TAIL_${fixtureId}`],
          traffic: [`中文流量_${fixtureId} EN_TRAFFIC_${fixtureId}`],
          descriptive: [`中文描述词_${fixtureId} EN_DESCRIPTIVE_${fixtureId}`],
        },
        warnings: [`中文警告_${fixtureId} EN_WARNING_${fixtureId}`],
        missingInfo: [`中文缺失_${fixtureId} EN_MISSING_${fixtureId}`],
      },
    }), {
      forceV2: true,
      schemaVersion: "2",
      listingPolicy: policy,
    });
    const setId = `SET_METADATA_${platform}`;
    const productName = `FORBIDDEN_BRAND_PRODUCT_NAME_${platform}`;
    const copy = buildCreationRecordListingText({
      setId,
      productName,
      listingDrafts: [draft],
    });
    for (const token of [
      `EN_TITLE_${fixtureId}`, `EN_SELLING_${fixtureId}`, `EN_OBJECTION_${fixtureId}`,
      `EN_HIGHLIGHT_${fixtureId}`, `EN_DESCRIPTION_${fixtureId}`, `EN_SEARCH_${fixtureId}`,
      `EN_EXACT_${fixtureId}`,
      `中文标题_${fixtureId}`, `中文卖点_${fixtureId}`, `中文疑虑_${fixtureId}`,
      `中文亮点_${fixtureId}`, `中文描述_${fixtureId}`, `中文搜索_${fixtureId}`,
      `中文精准_${fixtureId}`,
    ]) {
      assert.match(copy, new RegExp(token));
    }
    assert.doesNotMatch(copy, new RegExp(`EN_WARNING_${fixtureId}|EN_MISSING_${fixtureId}|中文警告_${fixtureId}|中文缺失_${fixtureId}`));
    for (const metadata of [
      setId,
      productName,
      draft.platformId,
      draft.platformLabel,
      draft.marketplace,
      draft.listingPolicyVersion,
    ]) {
      if (metadata) assert.equal(copy.includes(metadata), false, metadata);
    }
  }
});

test("new V2 model, retry, mock, and fallback drafts remove identities from visible metadata and ids", async () => {
  const [source] = buildCreationListingSources({
    setId: "set-visible-metadata",
    platform: "universal",
    productName: "Acme Blue Storage Box",
    productDescription: "Blue storage box with a stackable shape. Sold by Northwind Store. Trademark: RocketMark.",
    sellingPoints: ["Blue finish", "Stackable shape"],
  });
  const policy = source.listingPolicy;
  const validOutput = JSON.stringify(makeV2Draft(policy, { warnings: source.warnings }));
  const response = (outputText) => new Response(JSON.stringify({ output_text: outputText }), { status: 200 });
  const scenarios = [
    {
      name: "model",
      mock: false,
      fetchImpl: async () => response(validOutput),
      expectedRequests: 1,
    },
    {
      name: "retry",
      mock: false,
      fetchImpl: async (_url, _init, state = {}) => response(state.unused),
      expectedRequests: 2,
    },
    {
      name: "fallback",
      mock: false,
      fetchImpl: async () => response("{}"),
      expectedRequests: 2,
    },
    {
      name: "mock",
      mock: true,
      fetchImpl: async () => {
        throw new Error("mock mode must not call upstream");
      },
      expectedRequests: 0,
    },
  ];

  for (const scenario of scenarios) {
    let requestCount = 0;
    const fetchImpl = scenario.name === "retry"
      ? async () => {
        requestCount += 1;
        return response(requestCount === 1 ? "{}" : validOutput);
      }
      : async (...args) => {
        requestCount += 1;
        return scenario.fetchImpl(...args);
      };
    const draft = await requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "test-model",
      source,
      fetchImpl,
      mock: scenario.mock,
    });

    assert.equal(requestCount, scenario.expectedRequests, scenario.name);
    assert.equal(draft.status, "completed", scenario.name);
    assert.equal(draft.skuTitle, "Blue Storage Box", scenario.name);
    assert.equal(draft.id, "listing-blue-storage-box", scenario.name);
    const serializedLeaves = collectStringLeaves(draft).join("\n");
    for (const forbidden of ["Acme", "Northwind Store", "RocketMark"]) {
      assert.doesNotMatch(serializedLeaves, new RegExp(forbidden, "iu"), `${scenario.name}: ${forbidden}`);
    }
  }

  const normalizedExplicitId = normalizeCreationListingDraft({
    ...makeV2Draft(policy, { warnings: source.warnings }),
    id: "listing-acme-blue-storage-box",
  }, source);
  assert.equal(normalizedExplicitId.id, "listing-blue-storage-box");

  const [redSource] = buildCreationListingSources({
    setId: "set-red-storage-box",
    platform: "universal",
    productName: "Red Storage Box",
    productDescription: "Red storage box with a stackable shape.",
    sellingPoints: ["Red finish", "Stackable shape"],
  });
  const redDraft = await requestCreationListingDraft({
    source: redSource,
    mock: true,
  });
  assert.equal(redDraft.skuTitle, "Red Storage Box");
  assert.equal(redDraft.id, "listing-red-storage-box");
  assert.match(redDraft.title, /^Red Storage Box\b/u);
});

test("V1 display, field copy, and full copy preserve historical Unicode verbatim", () => {
  const historicalTitle = "Café Storage Box – édition limitée";
  const historicalSkuTitle = "Café SKU – édition limitée";
  const legacy = {
    marketplace: "amazon-us",
    language: "en-US",
    status: "completed",
    skuTitle: historicalSkuTitle,
    title: historicalTitle,
    sellingPoints: ["Café collection"],
    painPoints: [],
    fiveBullets: ["ÉDITION: Série limitée"],
    description: "Boîte de rangement – série spéciale.",
    backendSearchTerms: "café édition limitée",
    keywordBuckets: EMPTY_KEYWORD_BUCKETS,
    warnings: [],
    missingInfo: [],
  };
  const viewDraft = normalizeCreationListingDraftForView(legacy);
  const header = formatCreationListingDraftHeader(viewDraft);

  assert.equal(viewDraft.title, historicalTitle, "display must preserve Unicode");
  assert.equal(header.title, historicalTitle, "record header must preserve Unicode");
  assert.equal(header.meta.split(" · ")[0], historicalSkuTitle, "record SKU metadata must preserve Unicode");
  assert.equal(buildCreationListingFieldCopyText(viewDraft.title), historicalTitle, "field copy must preserve Unicode");
  assert.match(buildCreationListingDraftText(viewDraft), new RegExp(historicalTitle));
  assert.match(buildCreationRecordListingText({
    setId: "set-v1-unicode",
    productName: "Café Storage Box",
    listingDrafts: [legacy],
  }), new RegExp(historicalTitle));
});

test("Amazon 75-character title rule activates on 2026-07-27 using an explicit validation date", () => {
  const policy = resolveCreationListingPolicy({ platform: "amazon" });
  const title = "A".repeat(76);
  const draft = makeV2Draft(policy, { title });
  const sourceFacts = {
    productName: title,
    productDescription: "Blue storage box.",
  };

  assert.equal(policy.titleRules.effectiveFrom, "2026-07-27");
  const beforeEffectiveDate = validateCreationListingDraft(draft, {
    policy,
    sourceFacts,
    validationDate: "2026-07-26",
  });
  assert.doesNotMatch((beforeEffectiveDate.errors || []).join("\n"), /title.*75|title exceeds/i);
  assert.match((beforeEffectiveDate.warnings || []).join("\n"), /title.*75|75.*recommend/i);

  const onEffectiveDate = validateCreationListingDraft(draft, {
    policy,
    sourceFacts,
    validationDate: "2026-07-27",
  });
  assert.match((onEffectiveDate.errors || []).join("\n"), /title.*75|title exceeds/i);
});

test("new V2 normalization freezes publish metadata from the resolved policy", () => {
  const policy = resolveCreationListingPolicy({ platform: "etsy" });
  policy.publishFields = ["title", "description"];
  policy.internalFields = ["sellingPoints", "buyerObjections", "searchTerms", "keywordBuckets"];
  policy.titleRules.label = "Frozen product title";
  policy.titleRules.purpose = "Frozen title purpose";
  policy.highlightRules.label = "Frozen product highlights";
  policy.highlightRules.purpose = "Frozen highlights purpose";
  policy.descriptionRules.label = "Frozen product description";
  policy.descriptionRules.purpose = "Frozen description purpose";
  policy.searchRules.label = "Frozen search suggestions";
  policy.searchRules.purpose = "Frozen search purpose";

  const normalized = normalizeCreationListingDraft(makeV2Draft(policy), {
    forceV2: true,
    schemaVersion: "2",
    listingPolicy: policy,
  });

  assert.deepEqual(normalized.publishFields, policy.publishFields);
  assert.deepEqual(normalized.internalFields, policy.internalFields);
  assert.equal(normalized.fieldLabels.title, "Frozen product title");
  assert.equal(normalized.fieldLabels.highlights, "Frozen product highlights");
  assert.equal(normalized.fieldLabels.description, "Frozen product description");
  assert.equal(normalized.fieldLabels.searchTerms, "Frozen search suggestions");
  assert.equal(normalized.fieldPurposes.title, "Frozen title purpose");
  assert.equal(normalized.fieldPurposes.highlights, "Frozen highlights purpose");
  assert.equal(normalized.fieldPurposes.description, "Frozen description purpose");
  assert.equal(normalized.fieldPurposes.searchTerms, "Frozen search purpose");
});

test("V2 view prefers frozen publish metadata over the current bundled policy", () => {
  const policy = resolveCreationListingPolicy({ platform: "amazon" });
  const frozen = {
    publishFields: ["title", "description"],
    internalFields: ["highlights", "searchTerms", "sellingPoints", "buyerObjections", "keywordBuckets"],
    fieldLabels: {
      title: "Saved title label",
      highlights: "Saved highlights label",
      description: "Saved description label",
      searchTerms: "Saved search label",
    },
    fieldPurposes: {
      title: "Saved title purpose",
      highlights: "Saved highlights purpose",
      description: "Saved description purpose",
      searchTerms: "Saved search purpose",
    },
  };
  const viewDraft = normalizeCreationListingDraftForView({
    ...makeV2Draft(policy, { searchTerms: ["INTERNAL_FROZEN_SEARCH_TOKEN"] }),
    ...frozen,
  });

  assert.deepEqual(viewDraft.publishFields, frozen.publishFields);
  assert.deepEqual(viewDraft.internalFields, frozen.internalFields);
  for (const [field, label] of Object.entries(frozen.fieldLabels)) {
    assert.equal(viewDraft.fieldLabels[field], label);
  }
  for (const [field, purpose] of Object.entries(frozen.fieldPurposes)) {
    assert.equal(viewDraft.fieldPurposes[field], purpose);
  }
  const copy = buildCreationListingDraftText(viewDraft);
  assert.match(copy, /INTERNAL_FROZEN_SEARCH_TOKEN/);
  assert.match(copy, /中文搜索词：INTERNAL_FROZEN_SEARCH_TOKEN/u);
});
