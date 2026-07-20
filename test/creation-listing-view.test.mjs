import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreationListingBucketCopyLines,
  buildCreationListingExportPayload,
  buildCreationRecordListingText,
  buildCreationListingFieldCopyText,
  buildCreationListingFieldRows,
  createCreationListingController,
  getCreationListingDraftAccessState,
  normalizeCreationListingDraftForView,
  renderCreationListingDrafts,
} from "../lib/creation-listing-view.mjs";
import { CREATION_LISTING_POLICY_VERSION } from "../lib/creation-listing-policies.mjs";

function makeFakeElement(tagName) {
  const element = {
    tagName,
    children: [],
    dataset: {},
    attributes: {},
    className: "",
    textContent: "",
    type: "",
    title: "",
    parentNode: null,
    classList: {
      add(...names) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        names.forEach((name) => current.add(name));
        element.className = [...current].join(" ");
      },
      toggle(name, force) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        const shouldAdd = force ?? !current.has(name);
        if (shouldAdd) {
          current.add(name);
        } else {
          current.delete(name);
        }
        element.className = [...current].join(" ");
      },
    },
    appendChild(child) {
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    append(...children) {
      children.forEach((child) => element.appendChild(child));
    },
    replaceChildren(...children) {
      element.children = [];
      element.append(...children);
    },
    setAttribute(name, value) {
      element.attributes[name] = String(value);
    },
    closest() {
      return null;
    },
    querySelectorAll(selector) {
      const matches = [];
      const visit = (node) => {
        if (selector === "[data-creation-listing-copy-text]" && node.dataset?.creationListingCopyText !== undefined) {
          matches.push(node);
        }
        node.children?.forEach(visit);
      };
      visit(element);
      return matches;
    },
  };
  return element;
}

function collectFakeElements(root, predicate) {
  const matches = [];
  const visit = (node) => {
    if (predicate(node)) {
      matches.push(node);
    }
    node.children?.forEach(visit);
  };
  visit(root);
  return matches;
}

function getFakeTextContent(node) {
  return [
    node.textContent || "",
    ...(node.children || []).map((child) => getFakeTextContent(child)),
  ].join("");
}

test("listing field copy text returns only the selected section content", () => {
  assert.equal(buildCreationListingFieldCopyText("  Product title  "), "Product title");
  assert.equal(buildCreationListingFieldCopyText(["First point", "Second point"], { list: true }), "First point\nSecond point");
  assert.equal(buildCreationListingFieldCopyText("", { list: true }), "无");
});

test("listing field rows keep Chinese display text separate from copy text", () => {
  assert.deepEqual(
    buildCreationListingFieldRows(["English point"], ["中文对照"], { list: true }),
    [{ text: "English point", localizedText: "中文对照" }],
  );
  assert.equal(buildCreationListingFieldCopyText(["English point"], { list: true }), "English point");
});

test("keyword bucket copy lines use English labels and skip empty buckets", () => {
  const lines = buildCreationListingBucketCopyLines({
    exact: ["路亚硬饵"],
    longTail: ["fishing lure"],
    traffic: ["product listing"],
    descriptive: ["sku specific"],
  });

  assert.deepEqual(lines, [
    "Long-tail keywords: fishing lure",
    "Traffic keywords: product listing",
    "Descriptive keywords: sku specific",
  ]);
  assert.doesNotMatch(lines.join("\n"), /[\u3400-\u9fff]|精准|长尾|流量|描述|无/u);
});

test("listing draft view preserves UI-only Chinese display fields", () => {
  const draft = normalizeCreationListingDraftForView({
    title: "1 Pack Fishing Lure",
    zhDisplay: {
      title: "1 件路亚鱼饵",
      sellingPoints: ["中文卖点"],
      fiveBullets: ["中文五点"],
    },
  });

  assert.equal(draft.zhDisplay.title, "1 件路亚鱼饵");
  assert.deepEqual(draft.zhDisplay.sellingPoints, ["中文卖点"]);
  assert.deepEqual(draft.zhDisplay.fiveBullets, ["中文五点"]);
});

test("listing draft view preserves Chinese warning and missing info display fields", () => {
  const draft = normalizeCreationListingDraftForView({
    language: "en-US",
    title: "1 Pack First Aid Kit",
    warnings: ["Do not add waterproofing claims without source data."],
    missingInfo: ["Actual bag dimensions were not provided."],
    zhDisplay: {
      title: "1 件装急救包",
      warnings: ["没有来源数据前不要加入防水声明。"],
      missingInfo: ["未提供实际包袋尺寸。"],
    },
  });

  assert.deepEqual(draft.zhDisplay.warnings, ["没有来源数据前不要加入防水声明。"]);
  assert.deepEqual(draft.zhDisplay.missingInfo, ["未提供实际包袋尺寸。"]);
});

test("English listing view preserves historical V1 Unicode public copy verbatim", () => {
  const draft = normalizeCreationListingDraftForView({
    language: "en-US",
    title: "1 Pack 13cm 路亚硬饵 Product Listing Draft",
    sellingPoints: [
      "路亚硬饵 listing draft for US marketplace review.",
      "Provided product attributes are converted into searchable copy.",
    ],
    painPoints: [
      "Helps shoppers compare product variants.",
      "Sellers often struggle; this draft maps specs into shopper-ready language.",
    ],
    fiveBullets: [
      "1 Pack 13cm format keeps quantity visible.",
      "Includes 3 selectable SKU variants: 银蓝鳞纹橙红尾电动仿生鱼饵, 黄绿黑斑电动仿生鱼饵.",
      "Copy stays conservative.",
      "Keyword structure supports US marketplace review.",
      "Each bullet stays concise.",
    ],
    description: "路亚硬饵 listing draft for US marketplace review.",
    backendSearchTerms: "路亚硬饵 product listing",
    keywordBuckets: {
      exact: ["路亚硬饵"],
      longTail: ["路亚硬饵 product listing"],
      traffic: ["product listing"],
      descriptive: ["sku specific"],
    },
    zhDisplay: {
      title: "路亚硬饵",
    },
  });

  const publicText = [
    draft.title,
    ...draft.sellingPoints,
    ...draft.painPoints,
    ...draft.fiveBullets,
    draft.description,
    draft.backendSearchTerms,
    ...Object.values(draft.keywordBuckets).flat(),
  ].join("\n");

  assert.match(publicText, /路亚硬饵/u);
  assert.equal(draft.title, "1 Pack 13cm 路亚硬饵 Product Listing Draft");
  assert.equal(draft.sellingPoints[0], "路亚硬饵 listing draft for US marketplace review.");
  assert.equal(draft.fiveBullets[1], "Includes 3 selectable SKU variants: 银蓝鳞纹橙红尾电动仿生鱼饵, 黄绿黑斑电动仿生鱼饵.");
  assert.equal(buildCreationListingFieldCopyText(draft.title), "1 Pack 13cm 路亚硬饵 Product Listing Draft");
  assert.equal(draft.zhDisplay.title, "路亚硬饵");
  assert.match(buildCreationRecordListingText({ listingDrafts: [draft] }), /路亚|银蓝|黄绿|硬饵/u);
});

test("rendered listing header title is a direct copy target", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-title-copy",
        listingDrafts: [{
          language: "en-US",
          title: "1 Pack Travel Bottle",
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const titleCopyTargets = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-title-copy")
  ));

  assert.equal(titleCopyTargets.length, 1);
  assert.equal(titleCopyTargets[0].tagName, "button");
  assert.equal(titleCopyTargets[0].type, "button");
  assert.equal(titleCopyTargets[0].textContent, "1 Pack Travel Bottle");
  assert.equal(
    titleCopyTargets[0].dataset.creationListingCopyText,
    "English:\n1 Pack Travel Bottle\n简体中文:\n无",
  );
});

test("rendered listing panel recognizes concurrent generating set ids", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  const status = makeFakeElement("span");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: {
        creationRecordListingDrafts: root,
        creationRecordListingStatus: status,
      },
      state: {
        creation: {
          listingGeneratingSetId: "set-a",
          listingGeneratingSetIds: ["set-a", "set-b"],
        },
      },
      set: {
        setId: "set-b",
        listingDrafts: [],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  assert.equal(status.textContent, "生成中");
  assert.equal(root.children[0].textContent, "正在生成 Listing 草稿...");
});

test("rendered public listing fields show UI-only Chinese reference text", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-counts",
        listingDrafts: [{
          language: "en-US",
          title: "Mini Rod",
          sellingPoints: ["Casts far"],
          painPoints: ["Hard to compare rods"],
          fiveBullets: ["Mini Rod keeps size clear"],
          description: "Mini rod option for compact fishing kits.",
          backendSearchTerms: "mini rod compact fishing",
          keywordBuckets: {
            exact: ["mini rod"],
            longTail: ["mini fishing rod"],
            traffic: ["compact fishing kit"],
            descriptive: ["portable rod"],
          },
          zhDisplay: {
            title: "迷你鱼竿",
            sellingPoints: ["抛投更远"],
            painPoints: ["鱼竿不易比较"],
            fiveBullets: ["尺寸信息清楚"],
            description: "适合紧凑钓具套装。",
            backendSearchTerms: "迷你 鱼竿 便携",
            keywordBuckets: {
              exact: ["迷你鱼竿"],
              longTail: ["迷你钓鱼竿"],
              traffic: ["紧凑钓具套装"],
              descriptive: ["便携鱼竿"],
            },
          },
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const countNodes = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-character-counts")
  ));
  const fields = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-field")
  ));
  const fieldByLabel = (label) => fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === label);
  const titleField = fieldByLabel("标题");
  const sellingField = fieldByLabel("卖点");
  const painField = fieldByLabel("痛点");
  const bulletField = fieldByLabel("五点描述");
  const descriptionField = fieldByLabel("商品描述");
  const backendField = fieldByLabel("后台搜索词");
  const bucketField = fieldByLabel("关键词分组");
  const titleText = getFakeTextContent(titleField);
  const sellingText = getFakeTextContent(sellingField);
  const copyData = root.querySelectorAll("[data-creation-listing-copy-text]")
    .map((button) => button.dataset.creationListingCopyText)
    .join("\n");

  assert.match(titleText, /英文字符 8/u);
  assert.match(titleText, /中文字符 4/u);
  assert.match(titleText, /迷你鱼竿/u);
  assert.match(sellingText, /英文字符 9/u);
  assert.match(sellingText, /抛投更远/u);
  assert.match(getFakeTextContent(painField), /鱼竿不易比较/u);
  assert.match(getFakeTextContent(bulletField), /尺寸信息清楚/u);
  assert.match(getFakeTextContent(descriptionField), /适合紧凑钓具套装。/u);
  assert.match(getFakeTextContent(backendField), /迷你 鱼竿 便携/u);
  assert.match(getFakeTextContent(bucketField), /精准关键词: 迷你鱼竿/u);
  assert.match(getFakeTextContent(bucketField), /长尾关键词: 迷你钓鱼竿/u);
  assert.match(copyData, /迷你鱼竿|抛投更远|紧凑钓具/u);
  assert.ok(countNodes.some((node) => node.children?.[0]?.className === "creation-listing-character-count english"));
  const [bucketCounts] = collectFakeElements(bucketField, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-character-counts")
  ));

  assert.match(getFakeTextContent(bucketCounts), /英文字符 55/u);
  assert.match(getFakeTextContent(bucketCounts), /中文字符 19/u);
});

test("rendered historical failed listing drafts remain directly usable without review controls", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-failed",
        listingDrafts: [{
          language: "en-US",
          status: "failed",
          title: "1 Pack First Aid Kit",
          sellingPoints: ["Compact first aid kit for home and travel storage."],
          painPoints: ["Loose supplies can be hard to find."],
          fiveBullets: [
            "1 Pack First Aid Kit keeps the offer clear.",
            "Compact kit format supports home and travel storage.",
            "Clear option names help shoppers compare choices.",
            "Product wording focuses on visible attributes.",
            "Conservative wording avoids unsupported claims.",
          ],
          description: "First Aid Kit option for home and travel.",
          backendSearchTerms: "first aid kit home travel compact",
          warnings: ["Generation did not produce a publishable draft."],
          missingInfo: ["Verified product facts are required before rewriting."],
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  assert.doesNotMatch(getFakeTextContent(root), /重写|审核|复核|警告|缺失信息/u);
  assert.equal(String(root.children[0]?.className || ""), "creation-listing-card");
  assert.equal(collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-title-copy")
  )).length, 1);
  const copyLabels = root.querySelectorAll("[data-creation-listing-copy-text]")
    .map((button) => button.dataset.creationListingCopyLabel);
  for (const label of ["标题", "卖点", "痛点", "五点描述", "商品描述", "后台搜索词", "关键词分组"]) {
    assert.equal(copyLabels.includes(label), true, `${label} must remain directly copyable`);
  }
  assert.match(getFakeTextContent(root), /Compact first aid kit|Loose supplies|first aid kit home travel compact/u);
});

test("old review-only warning and missing-info fields are not rendered", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-warning-zh",
        listingDrafts: [{
          language: "en-US",
          title: "1 Pack First Aid Kit",
          warnings: ["Do not add waterproofing claims without source data."],
          missingInfo: ["Actual bag dimensions were not provided."],
          zhDisplay: {
            warnings: ["没有来源数据前不要加入防水声明。"],
            missingInfo: ["未提供实际包袋尺寸。"],
          },
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const fields = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-field")
  ));
  const warningField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "警告");
  const missingInfoField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "缺失信息");

  assert.equal(warningField, undefined);
  assert.equal(missingInfoField, undefined);
  assert.doesNotMatch(
    root.querySelectorAll("[data-creation-listing-copy-text]").map((button) => button.dataset.creationListingCopyText).join("\n"),
    /没有来源数据|未提供实际包袋/u,
  );
});

test("older drafts do not synthesize Chinese review fallback fields", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-warning-fallback",
        listingDrafts: [{
          language: "en-US",
          title: "1 Pack First Aid Kit",
          warnings: ["Do not add waterproofing claims without source data."],
          missingInfo: ["Actual bag dimensions were not provided."],
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const fields = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-field")
  ));
  const warningField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "警告");
  const missingInfoField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "缺失信息");

  assert.equal(warningField, undefined);
  assert.equal(missingInfoField, undefined);
});

test("review warnings never add extra sections to the old seven-field layout", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-fishing-warning-fallback",
        listingDrafts: [{
          language: "en-US",
          title: "1 Pack Electric Fishing Lure",
          warnings: [
            "Do not claim species-specific performance beyond general fishing use.",
            "Do not claim battery life, waterproof rating, or charging speed; source does not provide them.",
            "Glow effect is image-backed, but brightness duration and underwater range are not provided.",
            "Use as one parent listing with 3 color variants, not separate listings.",
          ],
          missingInfo: [
            "Main body material is not provided.",
            "Battery capacity and runtime are not provided.",
            "Waterproof rating is not provided.",
            "Target fish species are not specified by the source.",
          ],
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const fields = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-field")
  ));
  const warningField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "警告");
  const missingInfoField = fields.find((field) => field.children?.[0]?.children?.[0]?.textContent === "缺失信息");
  assert.equal(warningField, undefined);
  assert.equal(missingInfoField, undefined);
  assert.doesNotMatch(getFakeTextContent(root), /复核|警告|缺失信息/u);
});

test("rendered V1 listing field copy preserves historical Unicode with Chinese references", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-listing-copy",
        listingDrafts: [{
          language: "en-US",
          title: "1 Pack 13cm 路亚硬饵 Product Listing Draft",
          sellingPoints: ["路亚硬饵 listing draft for US marketplace review."],
          painPoints: ["Helps shoppers compare product variants."],
          fiveBullets: [
            "1 Pack 13cm format keeps quantity visible.",
            "Includes 3 selectable SKU variants: 银蓝鳞纹橙红尾电动仿生鱼饵, 黄绿黑斑电动仿生鱼饵.",
            "Copy stays conservative.",
            "Keyword structure supports US marketplace review.",
            "Each bullet stays concise.",
          ],
          description: "路亚硬饵 listing draft for US marketplace review.",
          backendSearchTerms: "路亚硬饵 product listing",
          keywordBuckets: {
            exact: ["路亚硬饵"],
            longTail: ["fishing lure"],
            traffic: ["product listing"],
            descriptive: ["sku specific"],
          },
          zhDisplay: {
            title: "路亚硬饵",
            sellingPoints: ["中文卖点对照"],
            keywordBuckets: {
              exact: ["中文精准词"],
            },
          },
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const copyButtons = root.querySelectorAll("[data-creation-listing-copy-text]");
  const copyByLabel = Object.fromEntries(copyButtons.map((button) => [
    button.dataset.creationListingCopyLabel,
    button.dataset.creationListingCopyText,
  ]));

  assert.match(copyByLabel["标题"], /1 Pack 13cm 路亚硬饵 Product Listing Draft[\s\S]*路亚硬饵/u);
  assert.match(copyByLabel["关键词分组"], /Long-tail keywords: fishing lure[\s\S]*中文精准词/u);
  assert.match(Object.values(copyByLabel).join("\n"), /路亚|银蓝|黄绿|硬饵/u);
  assert.match(Object.values(copyByLabel).join("\n"), /中文卖点对照|中文精准词/u);
});

test("V2 listing view keeps policy metadata separate while full copy preserves all bilingual fields", () => {
  const draft = normalizeCreationListingDraftForView({
    id: "listing-v2",
    schemaVersion: "2",
    platformId: "etsy",
    platformLabel: "Etsy",
    marketplace: "etsy",
    listingPolicyVersion: CREATION_LISTING_POLICY_VERSION,
    language: "en-US",
    title: "Handmade Blue Storage Box",
    sellingPoints: ["Supplied 2 L capacity"],
    buyerObjections: ["Confirm the supplied dimensions before purchase"],
    highlights: ["Blue finish", "Stackable shape", "Supplied 2 L capacity"],
    description: "A blue storage box described from the supplied product facts.",
    searchTerms: ["blue storage box", "stackable organizer"],
    keywordBuckets: { exact: ["internal exact plan"], longTail: [], traffic: [], descriptive: [] },
    evidence: ["product-input"],
    missingInfo: [],
    warnings: [],
    zhDisplay: {
      title: "手工蓝色收纳盒",
      sellingPoints: ["已提供 2 升容量"],
      buyerObjections: ["购买前确认已提供的尺寸"],
      highlights: ["蓝色外观", "可堆叠造型", "已提供 2 升容量"],
      description: "根据已提供商品事实描述的蓝色收纳盒。",
      searchTerms: ["蓝色收纳盒", "可堆叠收纳"],
      keywordBuckets: { exact: ["内部精准词规划"], longTail: [], traffic: [], descriptive: [] },
      missingInfo: [],
      warnings: [],
    },
    publishFields: ["title", "highlights", "description", "searchTerms"],
    status: "completed",
  });

  assert.equal(draft.schemaVersion, "");
  assert.equal(draft.platformId, "etsy");
  assert.equal(draft.platformLabel, "Etsy");
  assert.equal(draft.listingPolicyVersion, CREATION_LISTING_POLICY_VERSION);
  assert.deepEqual(draft.highlights, ["Blue finish", "Stackable shape", "Supplied 2 L capacity"]);
  assert.deepEqual(draft.searchTerms, ["blue storage box", "stackable organizer"]);
  assert.deepEqual(draft.buyerObjections, ["Confirm the supplied dimensions before purchase"]);
  assert.equal(draft.fieldLabels.highlights, "Highlights");
  assert.equal(draft.fieldLabels.searchTerms, "Tags");

  const copyText = buildCreationRecordListingText({
    setId: "set-etsy-v2",
    productName: "Blue Storage Box",
    listingDrafts: [draft],
  });
  assert.match(copyText, /Handmade Blue Storage Box/);
  assert.match(copyText, /Blue finish/);
  assert.match(copyText, /blue storage box/);
  assert.match(copyText, /Confirm the supplied dimensions/);
  assert.match(copyText, /internal exact plan/);
  assert.match(copyText, /手工蓝色收纳盒|购买前确认已提供的尺寸|内部精准词规划/u);
  assert.equal(copyText.includes(CREATION_LISTING_POLICY_VERSION), false);
  assert.doesNotMatch(copyText, /Etsy/u);
});

test("completed V2 drafts keep internal search suggestions in bilingual field and full copy", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  const internalSearchToken = "INTERNAL_SEARCH_TOKEN";
  const set = {
    setId: "set-temu-internal-search",
    listingDrafts: [{
      schemaVersion: "2",
      platformId: "temu",
      marketplace: "temu",
      listingPolicyVersion: CREATION_LISTING_POLICY_VERSION,
      language: "en-US",
      title: "Blue Storage Box",
      sellingPoints: [],
      buyerObjections: [],
      highlights: ["Blue finish"],
      description: "A blue storage box described from supplied facts.",
      searchTerms: [internalSearchToken],
      keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
      zhDisplay: {
        title: "蓝色收纳盒",
        sellingPoints: [],
        buyerObjections: [],
        highlights: ["蓝色外观"],
        description: "根据已提供事实描述的蓝色收纳盒。",
        searchTerms: ["内部中文搜索标记 INTERNAL_SEARCH_TOKEN"],
        keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
        warnings: [],
        missingInfo: [],
      },
      warnings: [],
      missingInfo: [],
      publishFields: ["title", "highlights", "description"],
      status: "completed",
    }],
  };
  globalThis.document = { createElement: makeFakeElement };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set,
    });
  } finally {
    globalThis.document = previousDocument;
  }

  assert.match(getFakeTextContent(root), new RegExp(internalSearchToken));
  const copyByLabel = Object.fromEntries(
    root.querySelectorAll("[data-creation-listing-copy-text]").map((button) => [
      button.dataset.creationListingCopyLabel,
      button.dataset.creationListingCopyText,
    ]),
  );
  assert.match(copyByLabel["后台搜索词"], new RegExp(internalSearchToken));
  assert.match(copyByLabel["后台搜索词"], /内部中文搜索标记/u);
  assert.match(buildCreationRecordListingText(set), new RegExp(internalSearchToken));
  assert.match(buildCreationRecordListingText(set), /内部中文搜索标记/u);
});

test("completed V2 drafts render directly without review messaging", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = { createElement: makeFakeElement };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-direct-listing",
        listingDrafts: [{
          schemaVersion: "2",
          platformId: "universal",
          marketplace: "universal",
          ...makeBilingualV2Draft(),
          platformId: "universal",
          platformLabel: "通用电商",
          marketplace: "universal",
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const text = getFakeTextContent(root);
  assert.match(text, /标题|卖点|痛点|五点描述|商品描述|后台搜索词|关键词分组/u);
  assert.doesNotMatch(text, /审核|重写|复核/u);
});

test("historical V2 review status maps to the old direct-output fields", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = { createElement: makeFakeElement };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-etsy-review",
        listingDrafts: [{
          schemaVersion: "2",
          platformId: "etsy",
          platformLabel: "Etsy",
          marketplace: "etsy",
          listingPolicyVersion: CREATION_LISTING_POLICY_VERSION,
          language: "en-US",
          title: "Blue Storage Box",
          highlights: ["Blue finish"],
          description: "Input-only draft for review.",
          searchTerms: ["blue storage box"],
          sellingPoints: [],
          buyerObjections: ["Confirm dimensions"],
          keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
          warnings: ["Source evidence is incomplete"],
          missingInfo: ["Verified dimensions are missing"],
          zhDisplay: {
            title: "蓝色收纳盒",
            sellingPoints: [],
            buyerObjections: ["确认尺寸"],
            highlights: ["蓝色外观"],
            description: "待复核的输入草稿。",
            searchTerms: ["蓝色收纳盒"],
            keywordBuckets: { exact: [], longTail: [], traffic: [], descriptive: [] },
            warnings: ["来源证据不完整"],
            missingInfo: ["缺少已验证尺寸"],
          },
          publishFields: ["title", "highlights", "description", "searchTerms"],
          status: "needs-review",
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  assert.equal(String(root.children[0]?.className || ""), "creation-listing-card");
  assert.doesNotMatch(getFakeTextContent(root), /需按当前规则重写|重写后才能复制或导出|发布字段|内部策划与复核|警告英文字符|缺失信息英文字符/u);
  assert.match(getFakeTextContent(root), /Blue finish|blue storage box|Confirm dimensions/u);
  assert.equal(collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-title-copy")
  )).length, 1);
  const labels = root.querySelectorAll("[data-creation-listing-copy-text]")
    .map((button) => button.dataset.creationListingCopyLabel);
  for (const label of ["标题", "卖点", "痛点", "五点描述", "商品描述", "后台搜索词", "关键词分组"]) {
    assert.equal(labels.includes(label), true);
  }
});

function makeBilingualV2Draft() {
  return {
    id: "bilingual-v2",
    schemaVersion: "2",
    platformId: "etsy",
    platformLabel: "Etsy",
    marketplace: "etsy",
    listingPolicyVersion: CREATION_LISTING_POLICY_VERSION,
    language: "en-US",
    title: "EN_TITLE_TOKEN",
    sellingPoints: ["EN_SELLING_TOKEN"],
    buyerObjections: ["EN_OBJECTION_TOKEN"],
    highlights: ["EN_HIGHLIGHT_TOKEN"],
    description: "EN_DESCRIPTION_TOKEN",
    searchTerms: ["EN_SEARCH_TOKEN"],
    keywordBuckets: {
      exact: ["EN_EXACT_TOKEN"],
      longTail: ["EN_LONG_TAIL_TOKEN"],
      traffic: ["EN_TRAFFIC_TOKEN"],
      descriptive: ["EN_DESCRIPTIVE_TOKEN"],
    },
    warnings: ["EN_WARNING_TOKEN"],
    missingInfo: ["EN_MISSING_TOKEN"],
    zhDisplay: {
      title: "中文标题标记 EN_TITLE_TOKEN",
      sellingPoints: ["中文卖点标记 EN_SELLING_TOKEN"],
      buyerObjections: ["中文疑虑标记 EN_OBJECTION_TOKEN"],
      highlights: ["中文亮点标记 EN_HIGHLIGHT_TOKEN"],
      description: "中文描述标记 EN_DESCRIPTION_TOKEN",
      searchTerms: ["中文搜索标记 EN_SEARCH_TOKEN"],
      keywordBuckets: {
        exact: ["中文精准标记 EN_EXACT_TOKEN"],
        longTail: ["中文长尾标记 EN_LONG_TAIL_TOKEN"],
        traffic: ["中文流量标记 EN_TRAFFIC_TOKEN"],
        descriptive: ["中文描述词标记 EN_DESCRIPTIVE_TOKEN"],
      },
      warnings: ["中文警告标记 EN_WARNING_TOKEN"],
      missingInfo: ["中文缺失标记 EN_MISSING_TOKEN"],
    },
    publishFields: ["title", "highlights", "description", "searchTerms"],
    status: "completed",
  };
}

test("completed V2 fields display and copy English with the same-name Chinese counterpart", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = { createElement: makeFakeElement };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: { setId: "set-bilingual-v2", listingDrafts: [makeBilingualV2Draft()] },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const visibleText = getFakeTextContent(root);
  for (const token of [
    "EN_TITLE_TOKEN", "EN_SELLING_TOKEN", "EN_OBJECTION_TOKEN", "EN_HIGHLIGHT_TOKEN",
    "EN_DESCRIPTION_TOKEN", "EN_SEARCH_TOKEN", "EN_EXACT_TOKEN",
    "中文标题标记", "中文卖点标记", "中文疑虑标记", "中文亮点标记", "中文描述标记",
    "中文搜索标记", "中文精准标记",
  ]) {
    assert.match(visibleText, new RegExp(token));
  }

  const fieldCopies = root.querySelectorAll("[data-creation-listing-copy-text]")
    .filter((button) => String(button.className || "").includes("creation-listing-field-copy"))
    .map((button) => button.dataset.creationListingCopyText);
  for (const [english, chinese] of [
    ["EN_TITLE_TOKEN", "中文标题标记"],
    ["EN_SELLING_TOKEN", "中文卖点标记"],
    ["EN_OBJECTION_TOKEN", "中文疑虑标记"],
    ["EN_HIGHLIGHT_TOKEN", "中文亮点标记"],
    ["EN_DESCRIPTION_TOKEN", "中文描述标记"],
    ["EN_SEARCH_TOKEN", "中文搜索标记"],
    ["EN_EXACT_TOKEN", "中文精准标记"],
  ]) {
    assert.ok(fieldCopies.some((copy) => copy.includes(english) && copy.includes(chinese)), `${english} must copy with ${chinese}`);
  }
});

test("V2 full copy keeps both languages and excludes set, platform, and policy metadata", () => {
  const copyText = buildCreationRecordListingText({
    setId: "SET_METADATA_TOKEN",
    productName: "FORBIDDEN_BRAND_PRODUCT_NAME",
    listingDrafts: [makeBilingualV2Draft()],
  });

  for (const token of [
    "EN_TITLE_TOKEN", "EN_SELLING_TOKEN", "EN_OBJECTION_TOKEN", "EN_HIGHLIGHT_TOKEN",
    "EN_DESCRIPTION_TOKEN", "EN_SEARCH_TOKEN", "EN_EXACT_TOKEN",
    "中文标题标记", "中文卖点标记", "中文疑虑标记", "中文亮点标记", "中文描述标记",
    "中文搜索标记", "中文精准标记",
  ]) {
    assert.match(copyText, new RegExp(token));
  }
  assert.doesNotMatch(copyText, /FORBIDDEN_BRAND_PRODUCT_NAME|SET_METADATA_TOKEN|Etsy/u);
  assert.doesNotMatch(copyText, /EN_WARNING_TOKEN|EN_MISSING_TOKEN|中文警告标记|中文缺失标记/u);
  assert.equal(copyText.includes(CREATION_LISTING_POLICY_VERSION), false);
});

test("V2 structured export maps historical fields to the old bilingual contract without productName", () => {
  let exported = "";
  const set = {
    setId: "set-bilingual-export",
    productName: "FORBIDDEN_BRAND_PRODUCT_NAME",
    listingDrafts: [makeBilingualV2Draft()],
  };
  const controller = createCreationListingController({
    getSelectedSet: () => set,
    downloadTextFile: (value) => { exported = value; },
  });

  controller.exportListings();
  const payload = JSON.parse(exported);
  assert.equal(Object.prototype.hasOwnProperty.call(payload, "productName"), false);
  assert.equal(payload.setId, "set-bilingual-export");
  assert.equal(payload.listingDrafts[0].title, "EN_TITLE_TOKEN");
  assert.deepEqual(payload.listingDrafts[0].painPoints, ["EN_OBJECTION_TOKEN"]);
  assert.deepEqual(payload.listingDrafts[0].fiveBullets, ["EN_HIGHLIGHT_TOKEN"]);
  assert.equal(payload.listingDrafts[0].backendSearchTerms, "EN_SEARCH_TOKEN");
  assert.equal(payload.listingDrafts[0].zhDisplay.title, "中文标题标记 EN_TITLE_TOKEN");
  assert.deepEqual(payload.listingDrafts[0].keywordBuckets.exact, ["EN_EXACT_TOKEN"]);
  assert.deepEqual(payload.listingDrafts[0].zhDisplay.keywordBuckets.exact, ["中文精准标记 EN_EXACT_TOKEN"]);
  assert.doesNotMatch(exported, /FORBIDDEN_BRAND_PRODUCT_NAME/u);
});

test("V1 structured export preserves the historical payload and draft verbatim", () => {
  let exported = "";
  const legacyDraft = {
    title: "Legacy Brand 标题",
    fiveBullets: ["Legacy Brand 历史卖点"],
    zhDisplay: { title: "历史中文标题" },
  };
  const set = {
    setId: "legacy-set",
    productName: "Legacy Brand Product",
    listingDrafts: [legacyDraft],
  };
  const controller = createCreationListingController({
    getSelectedSet: () => set,
    downloadTextFile: (value) => { exported = value; },
  });

  controller.exportListings();
  assert.deepEqual(JSON.parse(exported), {
    setId: "legacy-set",
    productName: "Legacy Brand Product",
    listingDrafts: [legacyDraft],
  });
});

test("old branded V2 drafts remain directly copyable and exportable without review gates", async () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  const oldDraft = {
    ...makeBilingualV2Draft(),
    listingPolicyVersion: "listing-policy-2026-07-15.v2",
    title: "LegacyBrand Storage Box",
    zhDisplay: {
      ...makeBilingualV2Draft().zhDisplay,
      title: "LegacyBrand 收纳盒",
    },
  };
  const set = { setId: "old-v2-branded", listingDrafts: [oldDraft] };
  const copyButton = makeFakeElement("button");
  const exportButton = makeFakeElement("button");
  let copied = "";
  let exported = "";
  const feedback = [];
  globalThis.document = { createElement: makeFakeElement };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set,
    });
    const controller = createCreationListingController({
      refs: {
        creationRecordCopyListingsButton: copyButton,
        creationRecordExportListingsButton: exportButton,
      },
      state: { creation: {} },
      getSelectedSet: () => set,
      writeTextToClipboard: async (value) => { copied = value; },
      downloadTextFile: (value) => { exported = value; },
      setFeedback: (message, type) => feedback.push({ message, type }),
    });
    controller.syncRecordControls(set);
    await controller.copy();
    controller.exportListings();
  } finally {
    globalThis.document = previousDocument;
  }

  assert.deepEqual(getCreationListingDraftAccessState(oldDraft), {
    canUse: true,
    reason: "direct-output",
    message: "",
  });
  assert.match(buildCreationRecordListingText(set), /LegacyBrand Storage Box/u);
  assert.ok(buildCreationListingExportPayload(set));
  assert.equal(copyButton.disabled, false);
  assert.equal(exportButton.disabled, false);
  assert.match(copied, /LegacyBrand Storage Box/u);
  assert.match(exported, /LegacyBrand Storage Box/u);
  assert.doesNotMatch(getFakeTextContent(root), /审核|重写|复核/u);
  assert.ok(root.querySelectorAll("[data-creation-listing-copy-text]").length > 0);
  assert.ok(feedback.every(({ type }) => type === "success"));
});

test("current V3 view access never blocks existing drafts", async () => {
  const validDraft = {
    ...makeBilingualV2Draft(),
    platformId: "universal",
    platformLabel: "通用电商",
    marketplace: "universal",
    title: "Travel Bottle for Daily Hydration",
    highlights: ["Portable bottle for daily hydration"],
    description: "Portable travel bottle for daily hydration.",
    searchTerms: ["travel bottle"],
    zhDisplay: {
      ...makeBilingualV2Draft().zhDisplay,
      title: "日常补水便携水瓶",
      highlights: ["适合日常补水的便携水瓶"],
      description: "适合日常补水的便携水瓶。",
      searchTerms: ["旅行水瓶"],
    },
    publishFields: ["title", "highlights", "description"],
  };
  const set = {
    setId: "current-v3-access",
    productName: "Acme Travel Bottle",
    listingDrafts: [validDraft],
  };

  assert.equal(getCreationListingDraftAccessState(validDraft, {
    ...set,
    productName: "Travel Bottle",
  }).canUse, true);
  const validSet = {
    ...set,
    productName: "Travel Bottle",
    listingDrafts: [validDraft],
  };
  assert.match(buildCreationRecordListingText(validSet), /Travel Bottle for Daily Hydration/u);
  assert.ok(buildCreationListingExportPayload(validSet));

  const spanishDraft = structuredClone(validDraft);
  spanishDraft.title = "Caja azul para organizar el hogar";
  spanishDraft.description = "Una caja azul para organizar productos del hogar.";
  const spanishSet = { ...validSet, listingDrafts: [spanishDraft] };
  assert.equal(getCreationListingDraftAccessState(spanishDraft, spanishSet).canUse, true);
  assert.match(buildCreationRecordListingText(spanishSet), /Caja azul/u);
  assert.ok(buildCreationListingExportPayload(spanishSet));

  const unrelatedChineseDraft = structuredClone(validDraft);
  unrelatedChineseDraft.zhDisplay.title = "厨房刀具套装";
  unrelatedChineseDraft.zhDisplay.description = "适合厨房备餐使用的刀具套装。";
  const unrelatedChineseSet = { ...validSet, listingDrafts: [unrelatedChineseDraft] };
  assert.equal(getCreationListingDraftAccessState(unrelatedChineseDraft, unrelatedChineseSet).canUse, true);
  assert.match(buildCreationRecordListingText(unrelatedChineseSet), /厨房刀具套装/u);
  assert.ok(buildCreationListingExportPayload(unrelatedChineseSet));

  const brandedDraft = structuredClone(validDraft);
  brandedDraft.title = "Acme Travel Bottle for Daily Hydration";
  brandedDraft.zhDisplay.title = "Acme 日常补水便携水瓶";
  const brandedSet = { ...set, listingDrafts: [brandedDraft] };
  assert.equal(getCreationListingDraftAccessState(brandedDraft, brandedSet).canUse, true);
  assert.match(buildCreationRecordListingText(brandedSet), /Acme Travel Bottle/u);
  assert.ok(buildCreationListingExportPayload(brandedSet));

  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  const copyButton = makeFakeElement("button");
  const exportButton = makeFakeElement("button");
  let copied = "";
  let exported = "";
  globalThis.document = { createElement: makeFakeElement };
  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: brandedSet,
    });
    const controller = createCreationListingController({
      refs: {
        creationRecordCopyListingsButton: copyButton,
        creationRecordExportListingsButton: exportButton,
      },
      state: { creation: {} },
      getSelectedSet: () => brandedSet,
      writeTextToClipboard: async (value) => { copied = value; },
      downloadTextFile: (value) => { exported = value; },
    });
    controller.syncRecordControls(brandedSet);
    await controller.copy();
    controller.exportListings();
  } finally {
    globalThis.document = previousDocument;
  }
  assert.equal(copyButton.disabled, false);
  assert.equal(exportButton.disabled, false);
  assert.ok(root.querySelectorAll("[data-creation-listing-copy-text]").length > 0);
  assert.match(copied, /Acme Travel Bottle/u);
  assert.match(exported, /Acme Travel Bottle/u);

  const unbrandedSet = {
    ...set,
    productName: "Travel Bottle",
    listingDrafts: [brandedDraft],
  };
  assert.equal(Object.prototype.hasOwnProperty.call(brandedDraft, "forbiddenTerms"), false);
  assert.equal(getCreationListingDraftAccessState(brandedDraft, unbrandedSet).canUse, true);
  assert.match(buildCreationRecordListingText(unbrandedSet), /Acme Travel Bottle/u);
  assert.ok(buildCreationListingExportPayload(unbrandedSet));

  const emptyPublishDraft = structuredClone(validDraft);
  emptyPublishDraft.highlights = [];
  emptyPublishDraft.zhDisplay.highlights = [];
  const emptyPublishSet = {
    ...set,
    productName: "Travel Bottle",
    listingDrafts: [emptyPublishDraft],
  };
  assert.equal(getCreationListingDraftAccessState(emptyPublishDraft, emptyPublishSet).canUse, true);
  assert.match(buildCreationRecordListingText(emptyPublishSet), /Travel Bottle/u);
  assert.ok(buildCreationListingExportPayload(emptyPublishSet));

  assert.equal(getCreationListingDraftAccessState({
    title: "Acme Historical Listing",
    fiveBullets: ["Acme historical content"],
  }, set).canUse, true);
});
