import assert from "node:assert/strict";
import test from "node:test";

import {
  buildCreationListingBucketCopyLines,
  buildCreationRecordListingText,
  buildCreationListingFieldCopyText,
  buildCreationListingFieldRows,
  normalizeCreationListingDraftForView,
  renderCreationListingDrafts,
} from "../lib/creation-listing-view.mjs";

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
  assert.equal(titleCopyTargets[0].dataset.creationListingCopyText, "1 Pack Travel Bottle");
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
  const descriptionField = fieldByLabel("描述");
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
  assert.doesNotMatch(copyData, /迷你鱼竿|抛投更远|紧凑钓具/u);
  assert.ok(countNodes.some((node) => node.children?.[0]?.className === "creation-listing-character-count english"));
  const [bucketCounts] = collectFakeElements(bucketField, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-character-counts")
  ));

  assert.match(getFakeTextContent(bucketCounts), /英文字符 55/u);
  assert.match(getFakeTextContent(bucketCounts), /中文字符 19/u);
});

test("rendered failed listing drafts show a clear rewrite notice", () => {
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

  assert.match(getFakeTextContent(root), /Listing 生成失败：当前没有可发布草稿，请修正信息后重写或重新生成。/u);
  assert.ok(String(root.children[0]?.className || "").includes("is-failed"));
  assert.equal(collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-title-copy")
  )).length, 0);
  const copyLabels = root.querySelectorAll("[data-creation-listing-copy-text]")
    .map((button) => button.dataset.creationListingCopyLabel);
  for (const label of ["标题", "卖点", "痛点", "五点描述", "描述", "后台搜索词", "关键词分组"]) {
    assert.equal(copyLabels.includes(label), false, `${label} must not be copyable for a failed draft`);
  }
  assert.doesNotMatch(getFakeTextContent(root), /Compact first aid kit|Loose supplies|first aid kit home travel compact/u);
  assert.match(getFakeTextContent(root), /Generation did not produce a publishable draft/u);
  assert.match(getFakeTextContent(root), /Verified product facts are required before rewriting/u);
});

test("rendered listing warning and missing info fields show Chinese references", () => {
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

  assert.match(getFakeTextContent(warningField), /没有来源数据前不要加入防水声明。/u);
  assert.match(getFakeTextContent(missingInfoField), /未提供实际包袋尺寸。/u);
  assert.doesNotMatch(
    root.querySelectorAll("[data-creation-listing-copy-text]").map((button) => button.dataset.creationListingCopyText).join("\n"),
    /没有来源数据|未提供实际包袋/u,
  );
});

test("rendered listing warning and missing info fields use Chinese review fallback for older drafts", () => {
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

  assert.match(getFakeTextContent(warningField), /发布前请按该警告复核来源证据/u);
  assert.match(getFakeTextContent(missingInfoField), /未提供实际包袋尺寸/u);
  assert.match(getFakeTextContent(warningField), /中文字符\s*[1-9]\d*/u);
  assert.match(getFakeTextContent(missingInfoField), /中文字符\s*[1-9]\d*/u);
});

test("rendered listing warning and missing info fallbacks summarize each English issue", () => {
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
  const warningText = getFakeTextContent(warningField);
  const missingInfoText = getFakeTextContent(missingInfoField);

  assert.match(warningText, /不要宣称超过一般钓鱼用途的特定鱼种效果/u);
  assert.match(warningText, /不要宣称电池续航、防水等级或充电速度/u);
  assert.match(warningText, /发光效果有图片依据，但未提供亮度持续时间和水下范围/u);
  assert.match(warningText, /作为一个包含 3 个颜色变体的父 Listing 使用，不要拆成多个 Listing/u);
  assert.match(missingInfoText, /未提供主体材料/u);
  assert.match(missingInfoText, /未提供电池容量和续航时间/u);
  assert.match(missingInfoText, /未提供防水等级/u);
  assert.match(missingInfoText, /来源未指定目标鱼种/u);

  const repeatedGenericCount = (warningText.match(/发布前请按该警告复核来源证据/g) || []).length;
  assert.equal(repeatedGenericCount, 0);
});

test("rendered V1 listing field copy preserves historical Unicode and excludes zhDisplay-only values", () => {
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

  assert.equal(copyByLabel["标题"], "1 Pack 13cm 路亚硬饵 Product Listing Draft");
  assert.equal(
    copyByLabel["关键词分组"],
    "Long-tail keywords: fishing lure\nTraffic keywords: product listing\nDescriptive keywords: sku specific",
  );
  assert.match(Object.values(copyByLabel).join("\n"), /路亚|银蓝|黄绿|硬饵/u);
  assert.doesNotMatch(Object.values(copyByLabel).join("\n"), /中文卖点对照|中文精准词/u);
});

test("V2 listing view keeps policy metadata and copies only publishable platform fields", () => {
  const draft = normalizeCreationListingDraftForView({
    id: "etsy-v2",
    schemaVersion: "2",
    platformId: "etsy",
    platformLabel: "Etsy",
    marketplace: "etsy",
    listingPolicyVersion: "listing-policy-2026-07-15.v1",
    language: "en-US",
    title: "Handmade Blue Storage Box",
    sellingPoints: ["Supplied 2 L capacity"],
    buyerObjections: ["Confirm the supplied dimensions before purchase"],
    highlights: ["Blue finish", "Stackable shape", "Supplied 2 L capacity"],
    description: "A blue storage box described from the supplied product facts.",
    searchTerms: ["blue storage box", "stackable organizer"],
    keywordBuckets: { exact: ["internal exact plan"] },
    evidence: ["product-input"],
    missingInfo: [],
    warnings: [],
    status: "completed",
  });

  assert.equal(draft.schemaVersion, "2");
  assert.equal(draft.platformId, "etsy");
  assert.equal(draft.platformLabel, "Etsy");
  assert.equal(draft.listingPolicyVersion, "listing-policy-2026-07-15.v1");
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
  assert.doesNotMatch(copyText, /Confirm the supplied dimensions/);
  assert.doesNotMatch(copyText, /internal exact plan/);
});

test("completed V2 drafts show internal search suggestions without adding them to full-copy", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  const internalSearchToken = "INTERNAL_TEMU_SEARCH_TOKEN";
  const set = {
    setId: "set-temu-internal-search",
    listingDrafts: [{
      schemaVersion: "2",
      platformId: "temu",
      marketplace: "temu",
      listingPolicyVersion: "listing-policy-2026-07-15.v2",
      language: "en-US",
      title: "Blue Storage Box",
      highlights: ["Blue finish"],
      description: "A blue storage box described from supplied facts.",
      searchTerms: [internalSearchToken],
      warnings: [],
      missingInfo: [],
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
  assert.match(getFakeTextContent(root), /Provide relevant search phrases for review\./u);
  const copyByLabel = Object.fromEntries(
    root.querySelectorAll("[data-creation-listing-copy-text]").map((button) => [
      button.dataset.creationListingCopyLabel,
      button.dataset.creationListingCopyText,
    ]),
  );
  assert.equal(copyByLabel["Keyword suggestions"], internalSearchToken);
  assert.doesNotMatch(buildCreationRecordListingText(set), new RegExp(internalSearchToken));
});

test("V2 review states and platform field labels are explicit in the rendered draft", () => {
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
          listingPolicyVersion: "listing-policy-2026-07-15.v1",
          language: "en-US",
          title: "Blue Storage Box",
          highlights: ["Blue finish"],
          description: "Input-only draft for review.",
          searchTerms: ["blue storage box"],
          buyerObjections: ["Confirm dimensions"],
          warnings: ["Source evidence is incomplete"],
          missingInfo: ["Verified dimensions are missing"],
          status: "needs-review",
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  assert.ok(String(root.children[0]?.className || "").includes("is-needs-review"));
  assert.match(getFakeTextContent(root), /待人工复核/u);
  assert.match(getFakeTextContent(root), /不可直接发布/u);
  assert.doesNotMatch(getFakeTextContent(root), /发布字段|内部策划与复核|Blue finish|blue storage box|Confirm dimensions/u);
  assert.match(getFakeTextContent(root), /Source evidence is incomplete/u);
  assert.match(getFakeTextContent(root), /Verified dimensions are missing/u);
  assert.equal(collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-title-copy")
  )).length, 0);
  const labels = root.querySelectorAll("[data-creation-listing-copy-text]")
    .map((button) => button.dataset.creationListingCopyLabel);
  assert.equal(labels.includes("Title"), false);
  assert.equal(labels.includes("Highlights"), false);
  assert.equal(labels.includes("Tags"), false);
});
