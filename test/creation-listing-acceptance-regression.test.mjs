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

function makeV2Draft(policy, overrides = {}) {
  return {
    schemaVersion: "2",
    platformId: policy.platformId || policy.id,
    platformLabel: policy.platformLabel || policy.label,
    marketplace: policy.marketplaceId,
    listingPolicyVersion: policy.listingPolicyVersion || policy.policyVersion,
    language: policy.locale || policy.language || policy.defaultLocale,
    title: "Blue Storage Box for Everyday Home Organization",
    sellingPoints: ["Blue finish and stackable shape are supplied product facts."],
    buyerObjections: ["Check the supplied dimensions before purchase."],
    highlights: [
      "Blue finish makes this option easy to identify.",
      "Stackable shape supports orderly everyday storage.",
      "Supplied dimensions help shoppers check available space.",
    ],
    description: "Blue storage box with a stackable shape for everyday home organization.",
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
      output_text: JSON.stringify(makeV2Draft(policy)),
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

test("material, certification, compatibility, and performance claims require exact whitelisted input evidence", () => {
  const policy = resolveCreationListingPolicy({ platform: "universal" });
  const cases = [
    ["304 Stainless Steel body", "Stainless steel body", "304 Stainless Steel body"],
    ["FDA Certified product", "CE Certified product", "FDA Certified product"],
    ["Compatible with iPhone 15 Pro", "Compatible with iPhone 15", "Compatible with iPhone 15 Pro"],
    ["12-hour battery runtime", "Long battery runtime", "12-hour battery runtime"],
  ];

  for (const [claim, similarEvidence, exactEvidence] of cases) {
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

    const supported = validateCreationListingDraft(makeV2Draft(policy, {
      description: claim,
    }), {
      policy,
      sourceFacts: {
        productName: "Test Product",
        productDescription: exactEvidence,
      },
    });
    assert.equal(supported.ok, true, `${claim} should pass with exact user evidence`);
  }
});

test("non-publishable search terms stay out of Temu and universal full-copy output", () => {
  for (const platform of ["universal", "temu"]) {
    const policy = resolveCreationListingPolicy({ platform });
    assert.equal(policy.searchRules.publishable, false);
    assert.equal(policy.publishFields.includes("searchTerms"), false);
    const draft = normalizeCreationListingDraft(makeV2Draft(policy, {
      searchTerms: [`INTERNAL_${platform.toUpperCase()}_SEARCH_TOKEN`],
    }), {
      forceV2: true,
      schemaVersion: "2",
      listingPolicy: policy,
    });
    const copy = buildCreationRecordListingText({
      setId: `set-${platform}`,
      productName: "Blue Storage Box",
      listingDrafts: [draft],
    });
    assert.doesNotMatch(copy, new RegExp(`INTERNAL_${platform.toUpperCase()}_SEARCH_TOKEN`));
  }
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
  assert.doesNotMatch(buildCreationListingDraftText(viewDraft), /INTERNAL_FROZEN_SEARCH_TOKEN/);
});
