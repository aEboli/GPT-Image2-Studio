import assert from "node:assert/strict";
import test from "node:test";

import { validateCreationListingDraft } from "../lib/creation-listing-draft.mjs";
import {
  CREATION_LISTING_JSON_SCHEMA,
  generateCreationListingDrafts,
  makeMockCreationListingDraft,
  requestCreationListingDraft,
} from "../lib/creation-listing-agent.mjs";

function makeValidDraft(overrides = {}) {
  return {
    title: "2 Pack Blue Fishing Lures Bass Trout Freshwater Swimbait",
    sellingPoints: ["Bright blue profile with a stated two-pack quantity."],
    painPoints: ["Review the stated color variant and pack quantity before purchase."],
    fiveBullets: [
      "PRODUCT TYPE: Blue fishing lure.",
      "PACK DETAILS: Two supplied product units.",
      "VISIBLE DETAILS: Blue profile and stated variant name.",
      "SPECIFICATIONS: Review the stated size and pack information.",
      "PACKAGE CONTENTS: Two fishing lure product units.",
    ],
    description: "Blue fishing lure option for US marketplace shoppers.",
    backendSearchTerms: "blue fishing lure bass bait compact lure",
    keywordBuckets: {
      exact: ["blue fishing lure"],
      longTail: ["bass fishing lure", "freshwater swimbait"],
      traffic: ["freshwater bait"],
      descriptive: ["compact blue lure"],
    },
    missingInfo: [],
    warnings: [],
    ...overrides,
  };
}

function visibleDraftText(draft) {
  return [
    draft.title,
    ...(draft.sellingPoints || []),
    ...(draft.painPoints || []),
    ...(draft.fiveBullets || []),
    draft.description,
    draft.backendSearchTerms,
    ...Object.values(draft.keywordBuckets || {}).flat(),
  ].join("\n");
}

function visibleChineseDisplayText(draft) {
  return [
    draft.zhDisplay?.title,
    ...(draft.zhDisplay?.sellingPoints || []),
    ...(draft.zhDisplay?.painPoints || []),
    ...(draft.zhDisplay?.fiveBullets || []),
    draft.zhDisplay?.description,
    draft.zhDisplay?.backendSearchTerms,
    ...Object.values(draft.zhDisplay?.keywordBuckets || {}).flat(),
  ].join("\n");
}

function validateListingAgentDraft(draft, expectedQuantity) {
  return validateCreationListingDraft(draft, {
    expectedQuantity,
    forbidTitleSpecs: true,
  });
}

const standardSource = {
  setId: "set-1",
  productName: "Fishing Lure",
  skuTitle: "Blue Lure",
  skuBundleCount: 2,
  dimensionSpecs: "3.5 in",
  evidenceMode: "input-only",
};

function collectSchemaKeys(value, keys = []) {
  if (!value || typeof value !== "object") {
    return keys;
  }
  for (const [key, nested] of Object.entries(value)) {
    keys.push(key);
    collectSchemaKeys(nested, keys);
  }
  return keys;
}

test("strict listing schema leaves character limits to prompt and validation", () => {
  assert.equal(collectSchemaKeys(CREATION_LISTING_JSON_SCHEMA).includes("maxLength"), false);
});

test("strict listing schema marks every top-level property as required", () => {
  assert.deepEqual(
    [...CREATION_LISTING_JSON_SCHEMA.required].sort(),
    Object.keys(CREATION_LISTING_JSON_SCHEMA.properties).sort(),
  );
});

test("platform V1 prompt restores prior field rules and adds title value instructions", async () => {
  const calls = [];
  const fetchImpl = async (_url, init) => {
    calls.push({ body: JSON.parse(init.body) });
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Electric Fishing Lure Bass Trout Freshwater Swimbait",
      })),
    }), { status: 200 });
  };

  await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      language: "en-US",
      forceV1: true,
      productDescription: "Blue lure with a reflective finish that stays visible in the supplied use context.",
      dimensionSpecs: "3.5 in / 9 cm",
      sellingPoints: ["Reflective finish", "Compact shape"],
      skuSubjects: [
        {
          id: "blue-compact",
          title: "Blue compact lure",
          bundleCount: 2,
          note: "Two blue lure units with a compact body and reflective visible finish.",
        },
      ],
      titleValueEvidence: [
        {
          sourceRole: "benefit",
          buyerContext: "Anglers who need the lure to remain visible in the supplied use context.",
          supportedValue: "Reflective finish stays visible in the supplied use context.",
          evidenceFocus: "The supplied product reference shows a reflective finish.",
        },
      ],
    },
    fetchImpl,
  });

  const prompt = calls[0].body.input;
  assert.match(prompt, /Listing SEO Agent/);
  assert.match(prompt, /Five-point listing quality constraints/);
  assert.match(prompt, /Platform search fit/);
  assert.match(prompt, /Resolved platform policy/);
  assert.match(prompt, /Title formula/i);
  assert.match(prompt, /core product keyword/i);
  assert.match(prompt, /do not include size/i);
  assert.match(prompt, /search terms/i);
  assert.match(prompt, /Non-title attribute-only rule/i);
  assert.match(prompt, /non-title fields may contain functional/i);
  assert.match(prompt, /Outside title and zhDisplay\.title, do not say or imply that the product helps/i);
  assert.match(prompt, /Non-title completeness rule/i);
  assert.match(prompt, /write 4-5 sellingPoints and 3-4 painPoints/i);
  assert.match(prompt, /recommendations are not quotas/i);
  assert.match(prompt, /complete, specific statement/i);
  assert.match(prompt, /painPoints must use declarative statements only/i);
  assert.match(prompt, /Never use a question mark.*\?.*？/is);
  assert.match(prompt, /Do not begin English painPoints with How.*What.*Which.*Is.*Are.*Does.*Do.*Can/is);
  assert.match(prompt, /Chinese painPoints.*是否.*什么.*多少.*如何/is);
  assert.match(prompt, /unknown, missing, or not specified as filler/i);
  assert.match(prompt, /PRODUCT TYPE.*product identity.*PACK DETAILS.*quantity.*VISIBLE DETAILS.*construction.*SPECIFICATIONS.*dimensions.*PACKAGE CONTENTS.*included items/is);
  assert.match(prompt, /2-4 short paragraphs/i);
  assert.match(prompt, /Aim for 350-500 English characters total/i);
  assert.match(prompt, /Never exceed 500 characters or a stricter platform limit/i);
  assert.match(prompt, /backendSearchTerms.*synonyms.*not already used verbatim/i);
  assert.match(prompt, /Deduplicate case-insensitively across backendSearchTerms and all four keyword buckets/i);
  assert.match(prompt, /mechanical singular\/plural variants/i);
  assert.match(prompt, /same array lengths, order, facts, quantities, and units/i);
  assert.match(prompt, /Do not repeat the title or another field merely to make content longer/i);
  assert.match(prompt, /buyer-facing language rule/i);
  assert.match(prompt, /write every non-title field for a shopper reading a finished product page/i);
  assert.match(prompt, /never expose internal record, evidence, or generation workflow/i);
  assert.match(prompt, /parent listing.*parent product.*saved creation set.*supplied configuration.*reference labels.*selected quantity.*confirmed selection/is);
  assert.match(prompt, /The 1 Pack contains one thermal imaging scope\./i);
  assert.match(prompt, /1件装内含1个热成像红外夜视瞄准镜。/u);
  assert.doesNotMatch(prompt, /ask a practical product question/i);
  assert.doesNotMatch(prompt, /question followed by a factual answer/i);
  assert.match(prompt, /fixed bullet bodies.*state product facts directly/i);
  assert.match(prompt, /description.*open with the product identity.*never describe the Listing record/is);
  assert.match(prompt, /visible model markings include/i);
  assert.match(prompt, /not a confirmed SKU, selected variant, or available option/i);
  assert.match(prompt, /backendSearchTerms and keywordBuckets remain keyword phrases, not explanatory sentences/i);
  assert.match(prompt, /Chinese counterparts.*same natural buyer-facing voice/i);
  assert.match(prompt, /exactly five bullets/i);
  assert.match(prompt, /PRODUCT TYPE.*PACK DETAILS.*PACKAGE CONTENTS/i);
  assert.match(prompt, /Title value exception/i);
  assert.match(prompt, /strongest differentiating selling point/i);
  assert.match(prompt, /pain point or purchase concern/i);
  assert.match(prompt, /Mandatory title value evidence/i);
  assert.match(prompt, /Reflective finish stays visible in the supplied use context/i);
  assert.match(prompt, /attribute-only title is invalid/i);
  assert.match(prompt, /after the required product identity and value phrase, append 2-4/i);
  assert.match(prompt, /different search or purchase decision point/i);
  assert.match(prompt, /visible construction, visible components, shape, color, variant, quantity, or package facts/i);
  assert.match(prompt, /platform hard character and byte limits are absolute/i);
  assert.match(prompt, /recommended title range is a soft readability target/i);
  assert.match(prompt, /do not shorten or remove the supplied selling point or its supported pain-point resolution/i);
  assert.match(prompt, /do not repeat concepts, stack synonyms, or add generic filler/i);
  assert.match(prompt, /same appended facts in the same order/i);
  assert.match(prompt, /Never use objectionFocus as a title claim/i);
  assert.match(prompt, /Every other English and Chinese content field remains subject/i);
  assert.doesNotMatch(prompt, /no public field or zhDisplay field may contain functional/i);
  assert.match(prompt, /Do not write gift/i);
  assert.doesNotMatch(prompt, /senior ecommerce Listing strategist/i);
  assert.doesNotMatch(prompt, /EVIDENCE-BASED BENEFITS|SILENT PLANNING|PLATFORM ADAPTATION/);
});

test("listing agent derives 2 Pack from grouped subject units when bundle count is one", async () => {
  const calls = [];
  const groupedPairSource = {
    ...standardSource,
    skuBundleCount: 1,
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
  };
  const fetchImpl = async (_url, init) => {
    const prompt = JSON.parse(init.body).input;
    calls.push(prompt);
    const usesTwoPack = /Title formula: start with 2 Pack/i.test(prompt);
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: usesTwoPack
          ? "2 Pack Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait"
          : "1 Pack Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait",
        description: usesTwoPack
          ? "This listing covers two complete visible lure bodies from the grouped SKU subject."
          : "This listing covers one lure body.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: groupedPairSource,
    fetchImpl,
  });

  assert.match(calls[0], /Title formula: start with 2 Pack/i);
  assert.match(calls[0], /Description must explicitly mention.*two complete visible lure bodies/is);
  assert.match(draft.title, /^2 Pack Fishing Lure\b/);
  assert.match(draft.description, /two complete visible lure bodies/i);
});

test("listing agent prompt uses readable mixed pack quantity wording", async () => {
  const prompts = [];
  const fetchImpl = async (_url, init) => {
    prompts.push(JSON.parse(init.body).input);
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack / 3 Pack Electronic Fishing Lure Bass Trout Freshwater Swimbait",
        description: "Electronic fishing lure options cover two-pack and three-pack grouped SKU choices.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      productName: "Electronic Fishing Lure",
      skuBundleCount: 2,
      skuQuantityOptions: [2, 3],
      skuSubjects: [
        { id: "two-lures", title: "Two lure colorways", subjectUnitCount: 2 },
        { id: "three-lures", title: "Three lure colorways", subjectUnitCount: 3 },
      ],
    },
    fetchImpl,
  });

  assert.match(prompts[0], /Title formula: start with 2 Pack \/ 3 Pack/i);
  assert.match(draft.title, /^2 Pack \/ 3 Pack Electronic Fishing Lure\b/);
});

test("listing agent retries when grouped subject description omits unit count", async () => {
  const prompts = [];
  let callCount = 0;
  const groupedPairSource = {
    ...standardSource,
    skuBundleCount: 1,
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
  };
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait",
        description: callCount === 1
          ? "This listing covers one lure body for freshwater fishing."
          : "This listing covers two complete visible lure bodies from the grouped SKU subject.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: groupedPairSource,
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[1], /Fix these validation errors: description must mention grouped SKU subject quantity/i);
  assert.match(draft.description, /two complete visible lure bodies/i);
});

test("listing agent repairs grouped subject description quantity after retry budget", async () => {
  const prompts = [];
  let callCount = 0;
  const groupedPairSource = {
    ...standardSource,
    skuBundleCount: 1,
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
  };
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait",
        description: "This fishing lure option includes the stated freshwater bait details.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: groupedPairSource,
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[1], /Fix these validation errors: description must mention grouped SKU subject quantity/i);
  assert.match(draft.description, /^This offer includes two complete visible lure bodies/i);
  assert.equal(validateListingAgentDraft(draft, "2 Pack").ok, true);
});

test("listing agent repairs grouped subject quantity from Chinese source notes in English", async () => {
  let callCount = 0;
  const groupedChineseSource = {
    ...standardSource,
    productName: "仿真鱼饵",
    skuTitle: "四节电动仿真鱼饵-银灰/银蓝双款",
    skuBundleCount: 2,
    skuSubjects: [
      {
        id: "sku1",
        title: "四节电动仿真鱼饵-银灰/银蓝双款",
        filenames: ["sku1.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "该源图包含2个完整可售产品单位：上方银灰鱼纹款1个、下方银蓝鱼纹款1个；图中共 2 个完整产品单位。",
      },
    ],
  };
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Electric Fishing Lure Jointed Swimbait Bass Trout Freshwater Bait",
        description: "This electric fishing lure option includes the stated freshwater bait details.",
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: groupedChineseSource,
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(draft.description, /^This offer includes two complete visible product units/i);
  assert.doesNotMatch(draft.description, /[\u3400-\u9fff]/u);
  assert.equal(validateListingAgentDraft(draft, "2 Pack").ok, true);
});

test("listing agent sends a strict JSON schema request with prompt guardrails", async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, headers: init.headers, body: JSON.parse(init.body) });
    return new Response(JSON.stringify({ output_text: JSON.stringify(makeValidDraft()) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1/",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(draft.title, "2 Pack Blue Fishing Lures Bass Trout Freshwater Swimbait");
  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.test/v1/responses");
  assert.equal(calls[0].headers.Authorization, "Bearer test-key");
  assert.equal(calls[0].body.model, "gpt-5.4");
  assert.deepEqual(calls[0].body.reasoning, { effort: "medium" });
  assert.equal(calls[0].body.stream, false);
  assert.equal(calls[0].body.text.format.type, "json_schema");
  assert.equal(calls[0].body.text.format.name, "creation_listing_draft_json");
  assert.equal(calls[0].body.text.format.strict, true);
  assert.deepEqual(calls[0].body.text.format.schema.required, CREATION_LISTING_JSON_SCHEMA.required);
  assert.ok(calls[0].body.text.format.schema.required.includes("zhDisplay"));
  assert.ok(calls[0].body.text.format.schema.properties.zhDisplay.required.includes("warnings"));
  assert.ok(calls[0].body.text.format.schema.properties.zhDisplay.required.includes("missingInfo"));
  assert.match(calls[0].body.input, /Amazon US English listing writer/);
  assert.match(calls[0].body.input, /Every field and every bullet must be 500 characters or fewer/);
  assert.match(calls[0].body.input, /Title formula: start with 2 Pack/i);
  assert.match(calls[0].body.input, /core product keyword/i);
  assert.match(calls[0].body.input, /do not include size/i);
  assert.match(calls[0].body.input, /search terms/i);
  assert.doesNotMatch(calls[0].body.input, /place it immediately after quantity/);
  assert.match(calls[0].body.input, /Public listing fields must be English only/);
  assert.match(calls[0].body.input, /sellingPoints and painPoints must each be 500 English characters or fewer in total/);
  assert.match(calls[0].body.input, /zhDisplay/);
  assert.match(calls[0].body.input, /warnings and missingInfo/);
  assert.ok(calls[0].body.text.format.schema.properties.zhDisplay);
  assert.match(calls[0].body.input, /Do not use the phrase "Listing Draft"/);
  assert.match(calls[0].body.input, /search-friendly structure/);
  assert.match(calls[0].body.input, /Do not invent material, warranty, certification, compatibility, medical, safety, or performance claims/);
});

test("listing agent times out stalled upstream requests", async () => {
  const fetchImpl = async (_url, init) => new Promise((_resolve, reject) => {
    init.signal.addEventListener("abort", () => {
      const error = new Error("aborted");
      error.name = "AbortError";
      reject(error);
    });
  });

  await assert.rejects(
    requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: standardSource,
      fetchImpl,
      requestTimeoutMs: 5,
    }),
    /Listing request timed out after 5ms/,
  );
});

test("listing agent uses a ten-minute default upstream timeout", async () => {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const timeoutDelays = [];
  const clearedTimeouts = [];

  globalThis.setTimeout = (_callback, delay) => {
    timeoutDelays.push(delay);
    return { delay };
  };
  globalThis.clearTimeout = (timeout) => {
    clearedTimeouts.push(timeout);
  };

  try {
    const fetchImpl = async () => new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft()),
    }));

    await requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: standardSource,
      fetchImpl,
    });

    assert.deepEqual(timeoutDelays, [600000]);
    assert.equal(clearedTimeouts.length, 1);
  } finally {
    globalThis.setTimeout = originalSetTimeout;
    globalThis.clearTimeout = originalClearTimeout;
  }
});

test("listing agent accepts UI-only Chinese display text alongside English public copy", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output_text: JSON.stringify(makeValidDraft({
      zhDisplay: {
        title: "2 件 3.5 英寸蓝色路亚鱼饵",
        sellingPoints: ["亮蓝色外观与已注明的颜色变体。"],
        painPoints: ["购买前核对颜色变体和包装数量。"],
        fiveBullets: [
          "商品类型：蓝色路亚鱼饵。",
          "包装信息：2 件商品。",
          "外观信息：蓝色外观和已注明的 SKU。",
          "商品细节基于已提供信息和 SKU 元数据。",
          "关键词导向文案保持简洁。",
        ],
        description: "蓝色路亚鱼饵的美国站 Listing 中文对照。",
        backendSearchTerms: "蓝色 路亚 鱼饵 鲈鱼",
        keywordBuckets: {
          exact: ["蓝色路亚鱼饵"],
          longTail: ["3.5 英寸鲈鱼鱼饵"],
          traffic: ["淡水鱼饵"],
          descriptive: ["紧凑蓝色鱼饵"],
        },
      },
    })),
  }), { status: 200 });

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: standardSource,
    fetchImpl,
  });

  assert.doesNotMatch(visibleDraftText(draft), /[\u3400-\u9fff]/u);
  assert.match(visibleChineseDisplayText(draft), /蓝色路亚鱼饵/u);
  assert.equal(validateListingAgentDraft(draft, "2 Pack").ok, true);
});

test("listing agent extracts Responses output content text", async () => {
  const fetchImpl = async () => new Response(JSON.stringify({
    output: [
      {
        content: [
          { type: "output_text", text: JSON.stringify(makeValidDraft()) },
        ],
      },
    ],
  }), { status: 200 });

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(draft.title, "2 Pack Blue Fishing Lures Bass Trout Freshwater Swimbait");
});

test("listing agent retries once after validation failure", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1 ? makeValidDraft({ title: "Bad title without quantity" }) : makeValidDraft();
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[1], /Fix these validation errors: title must start with quantity/);
  assert.match(draft.title, /^2 Pack Blue Fishing Lures\b/);
  assert.doesNotMatch(draft.title, /\b3\.5\s*in\b/i);
});

test("listing agent retries when public listing fields contain Chinese", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        title: "2 Pack 3.5 in 路亚硬饵 Product Listing Draft",
        fiveBullets: [
          "2 Pack 3.5 in format keeps quantity and size visible.",
          "路亚硬饵 draft uses saved product and SKU information.",
          "Copy stays conservative when generated images are unavailable.",
          "Keyword structure supports US marketplace review.",
          "Each bullet is kept under the configured character limit.",
        ],
        backendSearchTerms: "路亚硬饵 product listing",
      })
      : makeValidDraft({
        title: "2 Pack Electric Fishing Lure Bass Trout Freshwater Swimbait",
        backendSearchTerms: "electric fishing lure bass bait",
      });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[1], /public listing fields must be English/i);
  assert.equal(draft.title, "2 Pack Electric Fishing Lure Bass Trout Freshwater Swimbait");
  assert.doesNotMatch(visibleDraftText(draft), /[\u3400-\u9fff]/u);
});

test("listing agent retries when any field contains functional wording", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        painPoints: [
          "The bright profile helps the bait stay noticeable.",
        ],
      })
      : makeValidDraft({
        painPoints: [
          "Review the stated color variant and pack quantity before purchase.",
        ],
      });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "medium",
    source: standardSource,
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[1], /functional or effect wording/i);
  assert.doesNotMatch(draft.painPoints.join("\n"), /helps|supports|improves/i);
});

test("listing agent rejects after two invalid listing responses", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "Bad title without quantity",
        sellingPoints: ["FDA Certified product quality"],
      })),
    }), { status: 200 });
  };

  await assert.rejects(
    requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      reasoningEffort: "medium",
      source: standardSource,
      fetchImpl,
    }),
    (error) => {
      assert.match(error.message, /Listing generation failed validation after 2 attempts/);
      assert.match(error.message, /title must start with quantity/);
      assert.match(error.message, /sellingPoints\[0\] contains unsupported claim "certification claim"/);
      return true;
    },
  );

  assert.equal(callCount, 2);
});

test("listing agent keeps compound dimensions out of search-focused titles", async () => {
  let callCount = 0;
  const fetchImpl = async () => {
    callCount += 1;
    return new Response(JSON.stringify({
      output_text: JSON.stringify(makeValidDraft({
        title: "2 Pack Desk Organizer Tray Office Storage Desktop Organizer",
        fiveBullets: [
          "PRODUCT TYPE: Desk organizer tray.",
          "PACK DETAILS: Two supplied product units.",
          "VISIBLE DETAILS: Compact tray profile and stated color.",
          "SPECIFICATIONS: Stated dimensions are 3.5 x 2 in.",
          "PACKAGE CONTENTS: Two desk organizer trays.",
        ],
      })),
    }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      productName: "Desk Organizer Tray",
      skuTitle: "Desk Organizer Tray",
      dimensionSpecs: "3.5 x 2 in",
    },
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.match(draft.title, /^2 Pack Desk Organizer Tray\b/);
  assert.doesNotMatch(draft.title, /3\.5 x 2 in/i);
});

test("listing agent accepts titles without dimensions when source dimensions exist", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = makeValidDraft({
      title: "2 Pack Blue Fishing Lures Bass Trout Freshwater Swimbait",
    });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      dimensionSpecs: "3.5 in (9 cm)",
    },
    fetchImpl,
  });

  assert.equal(callCount, 1);
  assert.match(prompts[0], /do not include size/i);
  assert.match(draft.title, /^2 Pack Blue Fishing Lures\b/);
  assert.doesNotMatch(draft.title, /3\.5\s*in|9\s*cm/i);
});

test("listing agent retries when imperial mode output includes metric equivalents", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        title: "1 Pack Fishing Lure Electric Swimbait 5.12 in / 130 mm 1.23 oz / 35 g",
      })
      : makeValidDraft({
        title: "1 Pack Fishing Lure Electric Swimbait Slow Sinking Bass Bait",
      });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      skuBundleCount: 1,
      dimensionSpecs: "5.12 in 1.23 oz",
      dimensionUnitMode: "imperial",
    },
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[0], /imperial units only/i);
  assert.match(prompts[1], /imperial units only/i);
  assert.equal(draft.title, "1 Pack Fishing Lure Electric Swimbait Slow Sinking Bass Bait");
});

test("listing agent retries when title includes size and specification values", async () => {
  const prompts = [];
  let callCount = 0;
  const fetchImpl = async (_url, init) => {
    callCount += 1;
    prompts.push(JSON.parse(init.body).input);
    const draft = callCount === 1
      ? makeValidDraft({
        title: "3 Pack Electronic Fishing Lure Propeller Swimbait Hook Size 4# 130 mm 35 g",
      })
      : makeValidDraft({
        title: "3 Pack Electronic Fishing Lure Propeller Swimbait Slow Sinking Bass Trout Freshwater Bait",
      });
    return new Response(JSON.stringify({ output_text: JSON.stringify(draft) }), { status: 200 });
  };

  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      productName: "Electronic Fishing Lure",
      skuBundleCount: 3,
      dimensionSpecs: "Hook Size 4#, 130 mm, 35 g",
    },
    fetchImpl,
  });

  assert.equal(callCount, 2);
  assert.match(prompts[1], /title must not include size or specification values/);
  assert.equal(draft.title, "3 Pack Electronic Fishing Lure Propeller Swimbait Slow Sinking Bass Trout Freshwater Bait");
  assert.doesNotMatch(draft.title, /130\s*mm|35\s*g|hook size|4#/i);
});

test("generateCreationListingDrafts creates one completed V1 parent draft for all SKU variants", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-1",
      productName: "Fishing Lure",
      dimensionSpecs: "3.5 in",
      skuSubjects: [
        { id: "blue", title: "Blue Lure", bundleCount: 2 },
        { id: "green", title: "Green Lure", bundleCount: 2 },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].platformId, "universal");
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^2 Pack Fishing Lure\b/);
  assert.doesNotMatch(drafts[0].title, /8\.89 cm|3\.5 in/i);
  assert.equal(drafts[0].skuSubjectId, "");
  assert.ok(drafts[0].fiveBullets.length > 0);
  assert.ok(drafts[0].description);
});

test("application Listing generation uses one platform-aware V1 request and removes brand terms", async () => {
  const calls = [];
  const draftPayload = {
    title: "Acme Travel Bottle",
    sellingPoints: ["Acme portable design"],
    painPoints: ["Acme bottles can be awkward to carry."],
    fiveBullets: ["PORTABLE: Acme bottle fits daily travel."],
    description: "Acme travel bottle for daily hydration.",
    backendSearchTerms: "Acme travel bottle",
    keywordBuckets: {
      exact: ["Acme travel bottle"],
      longTail: [],
      traffic: [],
      descriptive: [],
    },
    zhDisplay: {
      title: "Acme 旅行水瓶",
      sellingPoints: ["Acme 便携设计"],
      painPoints: ["Acme 水瓶不便携带。"],
      fiveBullets: ["便携：Acme 水瓶适合日常旅行。"],
      description: "Acme 日常补水旅行水瓶。",
      backendSearchTerms: "Acme 旅行水瓶",
      keywordBuckets: {
        exact: ["Acme 旅行水瓶"],
        longTail: [],
        traffic: [],
        descriptive: [],
      },
    },
  };

  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-platform-v1",
      platformPolicyId: "etsy",
      productName: "Acme Travel Bottle",
      brand: "Acme",
      productDescription: "Compact travel bottle for daily hydration.",
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body));
      return new Response(JSON.stringify({ output_text: JSON.stringify(draftPayload) }), { status: 200 });
    },
  });

  assert.equal(calls.length, 1);
  assert.match(calls[0].input, /"platformId": "etsy"/);
  assert.deepEqual(calls[0].text.format.schema.required.sort(), Object.keys(draftPayload).sort());
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.doesNotMatch(visibleDraftText(drafts[0]), /Acme/i);
  assert.doesNotMatch(visibleChineseDisplayText(drafts[0]), /Acme/i);
  assert.match(drafts[0].fiveBullets[0], /^PRODUCT TYPE:/);
  assert.doesNotMatch(visibleDraftText(drafts[0]), /portable|fits|hydration/i);
});

test("platform V1 allows supported title value wording only in titles", async () => {
  const titleValuePayload = {
    title: "1 Pack Travel Bottle Flip Lid Helps Keep Opening Covered Between Sips",
    sellingPoints: ["Flip lid and compact bottle shape."],
    painPoints: ["Review the stated bottle option before purchase."],
    fiveBullets: [
      "PRODUCT TYPE: Travel bottle.",
      "PACK DETAILS: One supplied bottle unit.",
      "VISIBLE DETAILS: Flip lid and compact bottle shape.",
      "SPECIFICATIONS: Review the stated bottle option.",
      "PACKAGE CONTENTS: One travel bottle.",
    ],
    description: "Travel bottle with a supplied flip lid and compact bottle shape.",
    backendSearchTerms: "travel bottle flip lid compact bottle",
    keywordBuckets: {
      exact: ["travel bottle"],
      longTail: ["compact flip lid bottle"],
      traffic: ["drink bottle"],
      descriptive: ["compact bottle"],
    },
    zhDisplay: {
      title: "1 件装旅行水瓶 翻盖有助于在饮水间隔保持瓶口覆盖",
      sellingPoints: ["翻盖与紧凑瓶身形态。"],
      painPoints: ["购买前核对已注明的水瓶选项。"],
      fiveBullets: [
        "商品类型：旅行水瓶。",
        "包装信息：一只水瓶。",
        "外观信息：翻盖与紧凑瓶身形态。",
        "规格信息：核对已注明的水瓶选项。",
        "包装内容：一只旅行水瓶。",
      ],
      description: "旅行水瓶，带有已提供资料中的翻盖与紧凑瓶身形态。",
      backendSearchTerms: "旅行水瓶 翻盖 紧凑 水瓶",
      keywordBuckets: {
        exact: ["旅行水瓶"],
        longTail: ["紧凑型翻盖水瓶"],
        traffic: ["饮水瓶"],
        descriptive: ["紧凑水瓶"],
      },
    },
  };
  const calls = [];
  const draft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      forceV1: true,
      productName: "Travel Bottle",
      productDescription: "Travel bottle with a flip lid that helps keep the opening covered between sips.",
      sellingPoints: ["Flip lid helps keep the opening covered between sips."],
    },
    fetchImpl: async (_url, init) => {
      calls.push(JSON.parse(init.body).input);
      return new Response(JSON.stringify({
        output_text: JSON.stringify(titleValuePayload),
      }), { status: 200 });
    },
  });

  assert.equal(calls.length, 1);
  assert.match(draft.title, /helps keep opening covered/i);
  assert.match(draft.zhDisplay.title, /有助于.*保持瓶口覆盖/u);
  assert.doesNotMatch(draft.sellingPoints.join("\n"), /helps|supports|improves/i);
  assert.doesNotMatch(draft.title, /Product Details/i);

  const nonTitleFunctionalPayload = {
    ...titleValuePayload,
    sellingPoints: ["Flip lid helps keep the opening covered between sips."],
  };
  const nonTitleFallbackDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      forceV1: true,
      productName: "Travel Bottle",
      productDescription: "Travel bottle with a flip lid that helps keep the opening covered between sips.",
      sellingPoints: ["Flip lid helps keep the opening covered between sips."],
    },
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify(nonTitleFunctionalPayload),
    }), { status: 200 }),
  });

  assert.doesNotMatch(nonTitleFallbackDraft.sellingPoints.join("\n"), /helps keep/i);
  assert.match(nonTitleFallbackDraft.title, /Product Details/i);

  const riskyTitleDraft = await requestCreationListingDraft({
    baseUrl: "https://example.test/v1",
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    source: {
      ...standardSource,
      platformPolicyId: "etsy",
      forceV1: true,
      productName: "Travel Bottle",
      productDescription: "Travel bottle with a flip lid that helps keep the opening covered between sips.",
      sellingPoints: ["Flip lid helps keep the opening covered between sips."],
    },
    fetchImpl: async () => new Response(JSON.stringify({
      output_text: JSON.stringify({
        ...titleValuePayload,
        title: "1 Pack Best Seller Travel Bottle With Guaranteed Performance",
      }),
    }), { status: 200 }),
  });

  assert.doesNotMatch(riskyTitleDraft.title, /Best Seller|Guaranteed/i);
  assert.match(riskyTitleDraft.title, /Product Details/i);
});

test("platform V1 rejects interrogative pain points in either display language", async () => {
  const basePayload = {
    title: "2 Pack Fishing Lure Blue Compact Body",
    sellingPoints: ["The two blue lures have compact bodies."],
    painPoints: ["The 2 Pack contains two fishing lures."],
    fiveBullets: [
      "PRODUCT TYPE: These are blue fishing lures.",
      "PACK DETAILS: The pack contains two fishing lures.",
      "VISIBLE DETAILS: Both lures have blue compact bodies.",
      "SPECIFICATIONS: The stated length is 3.5 inches.",
      "PACKAGE CONTENTS: Two fishing lures are included.",
    ],
    description: "This 2 Pack contains two blue fishing lures with compact bodies and a stated length of 3.5 inches.",
    backendSearchTerms: "blue fishing lure compact bait",
    keywordBuckets: {
      exact: ["fishing lure"],
      longTail: ["2 pack blue fishing lure"],
      traffic: ["freshwater bait"],
      descriptive: ["compact blue lure"],
    },
    zhDisplay: {
      title: "2件装 蓝色紧凑型路亚鱼饵",
      sellingPoints: ["两个蓝色路亚鱼饵均为紧凑型饵身。"],
      painPoints: ["2件装内含2个路亚鱼饵。"],
      fiveBullets: [
        "PRODUCT TYPE: 这是蓝色路亚鱼饵。",
        "PACK DETAILS: 包装内含2个路亚鱼饵。",
        "VISIBLE DETAILS: 两个鱼饵均为蓝色紧凑型饵身。",
        "SPECIFICATIONS: 标示长度为3.5英寸。",
        "PACKAGE CONTENTS: 包装内含2个路亚鱼饵。",
      ],
      description: "这款2件装产品内含2个蓝色紧凑型路亚鱼饵，标示长度为3.5英寸。",
      backendSearchTerms: "蓝色 路亚鱼饵 紧凑 鱼饵",
      keywordBuckets: {
        exact: ["路亚鱼饵"],
        longTail: ["2件装蓝色路亚鱼饵"],
        traffic: ["淡水鱼饵"],
        descriptive: ["蓝色紧凑鱼饵"],
      },
    },
  };
  const cases = [
    {
      painPoints: ["How many lures are included? The 2 Pack contains two fishing lures."],
      zhPainPoints: basePayload.zhDisplay.painPoints,
    },
    {
      painPoints: basePayload.painPoints,
      zhPainPoints: ["内含多少个路亚鱼饵？2件装内含2个路亚鱼饵。"],
    },
  ];

  for (const entry of cases) {
    const draft = await requestCreationListingDraft({
      baseUrl: "https://example.test/v1",
      apiKey: "test-key",
      responsesModel: "gpt-5.4",
      source: {
        ...standardSource,
        platformPolicyId: "etsy",
        forceV1: true,
      },
      fetchImpl: async () => new Response(JSON.stringify({
        output_text: JSON.stringify({
          ...basePayload,
          painPoints: entry.painPoints,
          zhDisplay: {
            ...basePayload.zhDisplay,
            painPoints: entry.zhPainPoints,
          },
        }),
      }), { status: 200 }),
    });

    assert.match(draft.title, /Product Details/i);
    assert.doesNotMatch(draft.painPoints.join("\n"), /[?？]/u);
    assert.doesNotMatch(draft.zhDisplay.painPoints.join("\n"), /[?？]/u);
  }
});

test("application Listing generation falls back after one incomplete response without review", async () => {
  let requestCount = 0;
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-incomplete-direct",
      platformPolicyId: "etsy",
      productName: "Travel Bottle",
      productDescription: "Compact bottle for daily travel.",
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key" },
    fetchImpl: async () => {
      requestCount += 1;
      return new Response(JSON.stringify({
        output_text: JSON.stringify({
          title: "Travel Bottle",
          sellingPoints: [],
          painPoints: [],
          fiveBullets: [],
          description: "",
          backendSearchTerms: "",
          keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
          zhDisplay: {
            title: "旅行水瓶",
            sellingPoints: [],
            painPoints: [],
            fiveBullets: [],
            description: "",
            backendSearchTerms: "",
            keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
          },
        }),
      }), { status: 200 });
    },
  });

  assert.equal(requestCount, 1);
  assert.equal(drafts[0].status, "completed");
  assert.ok(drafts[0].fiveBullets.length > 0);
  assert.ok(drafts[0].zhDisplay?.fiveBullets.length > 0);
  assert.ok(drafts[0].backendSearchTerms);
});

test("generateCreationListingDrafts keeps metric and imperial specs out of mock titles", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-dual-units",
      productName: "Electric Fishing Lure",
      productDescription: "Jointed lure with LED light and rechargeable battery",
      dimensionSpecs: "13cm/42g",
      dimensionUnitMode: "both",
      skuBundleCount: 1,
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^1 Pack Electric Fishing Lure\b/);
  assert.doesNotMatch(drafts[0].title, /13cm|5\.12 in|42g|1\.48 oz/i);
});

test("generateCreationListingDrafts uses grouped SKU subject unit count and search terms in titles", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-three-lures",
      productName: "Electronic Fishing Lure",
      productDescription: "One sellable SKU image contains three complete lure bodies with LED light and propeller action.",
      sellingPoints: ["auto-activated light", "propeller action", "multi-section swimbait"],
      dimensionSpecs: "Hook Size 4#, 130 mm, 35 g",
      skuBundleCount: 1,
      skuSubjects: [
        {
          id: "three-lures.png",
          title: "Silver lure / Gold lure / Green lure",
          filenames: ["three-lures.png"],
          referenceIndexes: [1],
          subjectUnitCount: 3,
          note: "One product-subject reference image contains three complete visible lure bodies: silver, gold, and green.",
        },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^3 Pack Electronic Fishing Lure\b/);
  assert.doesNotMatch(drafts[0].title, /130\s*mm|35\s*g|hook size|4#/i);
  assert.match(drafts[0].backendSearchTerms, /\belectronic fishing lure\b/i);
  assert.deepEqual(drafts[0].keywordBuckets.exact, ["Electronic Fishing Lure"]);
});

test("generateCreationListingDrafts honors set-level same-SKU pack counts for grouped subjects", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-two-three-lure-groups",
      productName: "Electronic Fishing Lure",
      productDescription: "One grouped SKU subject contains three complete lure bodies and is sold as two identical grouped sets.",
      skuBundleCount: 2,
      skuSubjects: [
        {
          id: "three-lures.png",
          title: "Three lure colorways",
          filenames: ["three-lures.png"],
          subjectUnitCount: 3,
          note: "One product-subject reference image contains three complete visible lure bodies: silver, gold, and green.",
        },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^6 Pack Electronic Fishing Lure\b/);
});

test("generateCreationListingDrafts uses visible subject unit count for swimbait titles", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-four-swimbaits",
      productName: "Swimbait Lure",
      productDescription: "One product subject reference contains four complete lure colorways.",
      dimensionSpecs: "160 mm, 50.4 g, Hook Size #2",
      skuBundleCount: 1,
      skuSubjects: [
        {
          id: "four-swimbaits.png",
          title: "Four swimbait lure colorways",
          filenames: ["four-swimbaits.png"],
          referenceIndexes: [1],
          subjectUnitCount: 4,
          note: "4 complete visible product units in one grouped SKU subject.",
        },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^4 Pack Swimbait Lure\b/);
  assert.doesNotMatch(drafts[0].title, /160\s*mm|50\.4\s*g|hook size|#2|6\.3 in|1\.78 oz/i);
});

test("generateCreationListingDrafts writes mixed grouped SKU quantities as slash pack titles", async () => {
  const drafts = await generateCreationListingDrafts({
    set: {
      setId: "set-mixed-lure-packs",
      productName: "Electronic Fishing Lure",
      productDescription: "Two grouped SKU subjects represent two-pack and three-pack choices.",
      sellingPoints: ["propeller action", "multi-color grouped choices"],
      skuBundleCount: 1,
      skuSubjects: [
        {
          id: "two-lures.png",
          title: "Two lure colorways",
          filenames: ["two-lures.png"],
          subjectUnitCount: 2,
          note: "2 complete visible product units in one grouped SKU subject.",
        },
        {
          id: "three-lures.png",
          title: "Three lure colorways",
          filenames: ["three-lures.png"],
          subjectUnitCount: 3,
          note: "3 complete visible product units in one grouped SKU subject.",
        },
      ],
    },
    config: { baseUrl: "https://example.test/v1", apiKey: "test-key", responsesModel: "gpt-5.4" },
    fetchImpl() {
      throw new Error("mock mode should not request the network");
    },
    mock: true,
  });

  assert.equal(drafts.length, 1);
  assert.equal(drafts[0].schemaVersion, undefined);
  assert.equal(drafts[0].status, "completed");
  assert.match(drafts[0].title, /^2 Pack \/ 3 Pack Electronic Fishing Lure\b/);
});

test("mock listing drafts describe grouped two-unit subjects", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-two-lure-pair",
    productName: "Fishing Lure",
    productDescription: "One product-subject reference image contains two complete visible lure bodies.",
    skuBundleCount: 1,
    dimensionSpecs: "3.5 in",
    evidenceMode: "input-only",
    skuSubjects: [
      {
        id: "orange-pair",
        title: "Orange lure pair",
        filenames: ["orange-pair.png"],
        bundleCount: 1,
        subjectUnitCount: 2,
        note: "One product-subject reference image contains two complete visible lure bodies: orange top and silver bottom.",
      },
    ],
  });

  assert.match(draft.title, /^2 Pack Fishing Lure\b/);
  assert.match(draft.description, /two complete visible lure bodies/i);
  assert.equal(validateListingAgentDraft(draft, "2 Pack").ok, true);
});

test("mock listing drafts avoid unsupported claims and competitor brand terms", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-unsafe",
    productName: "Amazon FDA Certified Best Fishing Lure",
    skuTitle: "Walmart Medical Grade Warranty Lure",
    skuBundleCount: 2,
    dimensionSpecs: "3.5 in",
    evidenceMode: "input-only",
    warnings: [],
  });

  const validation = validateListingAgentDraft(draft, "2 Pack");
  assert.equal(validation.ok, true);
  assert.doesNotMatch(visibleDraftText(draft), /\b(?:amazon|walmart|temu|ebay|etsy|target)\b/i);
  assert.doesNotMatch(visibleDraftText(draft), /\b(?:FDA Certified|medical grade|guaranteed|best|warranty)\b/i);
});

test("mock mode uses English Amazon-style titles for Chinese source inputs", async () => {
  const source = {
    setId: "set-cn",
    productName: "路亚硬饵",
    skuTitle: "银蓝鳞纹橙红尾电动仿生鱼饵",
    skuBundleCount: 1,
    dimensionSpecs: "13cm/42g",
    industryTemplatePath: "Sports & Outdoors > Fishing > Lures",
    evidenceMode: "image-backed",
    skuSubjects: [
      { id: "silver-blue", title: "银蓝鳞纹橙红尾电动仿生鱼饵", bundleCount: 1 },
      { id: "black-gold", title: "黑金鳞纹电动仿生鱼饵", bundleCount: 1 },
    ],
  };

  const mockDraft = makeMockCreationListingDraft(source);

  assert.match(mockDraft.title, /^1 Pack Electric Fishing Lure\b/);
  assert.doesNotMatch(mockDraft.title, /13cm|42g/i);
  assert.equal(mockDraft.title.includes("Listing Draft"), false);
  assert.equal(mockDraft.title.length <= 200, true);
  assert.doesNotMatch(visibleDraftText(mockDraft), /[\u3400-\u9fff]/u);
  assert.equal(validateListingAgentDraft(mockDraft, "1 Pack").ok, true);
});

test("mock fallback recognizes Chinese folding wagons before numeric claim fragments", () => {
  const draft = makeMockCreationListingDraft({
    setId: "set-cn-folding-wagon",
    productName: "四轮折叠手拉车",
    skuTitle: "四轮折叠手拉车",
    skuNote: "1个完整产品单位；不保留画面外置300KG文字。",
    skuBundleCount: 1,
    evidenceMode: "image-backed",
    skuSubjects: [
      { id: "wagon-black", title: "黑色折叠手拉车", bundleCount: 1 },
      { id: "wagon-pink", title: "粉色折叠手拉车", bundleCount: 1 },
    ],
  });

  assert.match(draft.title, /^1 Pack Folding Wagon Cart\b/);
  assert.doesNotMatch(visibleDraftText(draft), /300\s*KG/i);
  assert.equal(validateListingAgentDraft(draft, "1 Pack").ok, true);
});

test("mock listing draft does not infer product keywords from numbered first aid kit contents", () => {
  const source = {
    ...standardSource,
    productName: "急救包",
    skuBundleCount: 1,
    productDescription: [
      "配置清单：",
      "1.创口贴*20片",
      "2.5*450cmPBT绷带*3卷",
      "3.7.5*450cmPBT绷带*3卷",
      "16.TPE止血带*1个",
      "21.急救包*1个",
    ].join("\n\n"),
    dimensionSpecs: "重量：0.35kg (12.35 oz)",
    skuSubjects: [{ id: "red-first-aid-kit", title: "红色手提急救包", bundleCount: 1 }],
  };

  const draft = makeMockCreationListingDraft(source);

  assert.match(draft.title, /^1 Pack First Aid Kit\b/);
  assert.doesNotMatch(draft.title, /0\.35kg|12\.35 oz/i);
  assert.doesNotMatch(visibleDraftText(draft), /\bPBT\b|\bTPE\b|450cm|\*20/);
  assert.equal(validateListingAgentDraft(draft, "1 Pack").ok, true);
});

test("mock listing draft uses product-facing copy instead of internal template commentary", () => {
  const source = {
    ...standardSource,
    productName: "急救包",
    skuBundleCount: 1,
    productDescription: [
      "配置清单：",
      "1.创口贴*20片",
      "2.5*450cmPBT绷带*3卷",
      "3.7.5*450cmPBT绷带*3卷",
      "16.TPE止血带*1个",
      "21.急救包*1个",
    ].join("\n\n"),
    dimensionSpecs: "8cm (3.15 in)",
    skuSubjects: [{ id: "red-first-aid-kit", title: "红色手提急救包", bundleCount: 1 }],
  };

  const draft = makeMockCreationListingDraft(source);
  const publicText = visibleDraftText(draft);

  assert.match(draft.title, /^1 Pack First Aid Kit\b/);
  assert.doesNotMatch(draft.title, /8cm|3\.15 in/i);
  assert.match(publicText, /\bFirst Aid Kit\b/);
  assert.match(publicText, /\b(?:pack|size|option|dimensions|variant|package)\b/i);
  assert.doesNotMatch(
    publicText,
    /\b(?:Provided product attributes|searchable copy|shopper-ready language|Sellers often struggle|Product details are based on provided inputs|Keyword structure combines|product listing searchable variant comparison|sku specific)\b/i,
  );
  assert.equal(validateListingAgentDraft(draft, "1 Pack").ok, true);
});

test("mock listing draft does not classify single bandage items as a first aid kit", () => {
  const source = {
    ...standardSource,
    productName: "创口贴",
    skuTitle: "",
    skuBundleCount: 1,
    productDescription: "创口贴*20片，独立包装，适合家庭和旅行备用。",
    dimensionSpecs: "10cm",
    industryTemplatePath: "Health & Household > Bandages",
    skuSubjects: [{ id: "adhesive-bandages", title: "创口贴单品", bundleCount: 1 }],
  };

  const draft = makeMockCreationListingDraft(source);

  assert.match(draft.title, /^1 Pack Bandages\b/);
  assert.doesNotMatch(draft.title, /10cm/i);
  assert.doesNotMatch(draft.title, /\bFirst Aid Kit\b/);
  assert.equal(validateListingAgentDraft(draft, "1 Pack").ok, true);
});

test("mock drafts keep long SKU fields under 500 characters", () => {
  const longSkuName = `Desk Organizer ${"storage ".repeat(90)}`;
  const source = {
    ...standardSource,
    productName: longSkuName,
    skuTitle: longSkuName,
    dimensionSpecs: "3.5 x 2 in",
  };
  const mockDraft = makeMockCreationListingDraft(source);

  const fields = [
    mockDraft.title,
    mockDraft.description,
    mockDraft.backendSearchTerms,
    ...mockDraft.sellingPoints,
    ...mockDraft.painPoints,
    ...mockDraft.fiveBullets,
    ...Object.values(mockDraft.keywordBuckets).flat(),
  ];
  assert.equal(fields.every((value) => value.length <= 500), true);
  assert.equal(
    validateListingAgentDraft(mockDraft, "2 Pack").ok,
    true,
  );
});
