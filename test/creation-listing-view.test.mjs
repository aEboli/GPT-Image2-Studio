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

test("keyword bucket copy lines contain only keyword values and skip unsupported language content", () => {
  const lines = buildCreationListingBucketCopyLines({
    exact: ["路亚硬饵"],
    longTail: ["fishing lure"],
    traffic: ["product listing"],
    descriptive: ["sku specific"],
  });

  assert.deepEqual(lines, [
    "fishing lure",
    "product listing",
    "sku specific",
  ]);
  assert.doesNotMatch(
    lines.join("\n"),
    /[\u3400-\u9fff]|精准关键词|长尾关键词|流量关键词|描述词|exact keywords|long-tail keywords|traffic keywords|descriptive keywords|无/iu,
  );
});

test("listing draft view preserves UI-only Chinese display fields", () => {
  const draft = normalizeCreationListingDraftForView({
    title: "1 Pack Fishing Lure",
    zhDisplay: {
      title: "1 件路亚鱼饵",
      sellingPoints: ["中文卖点"],
      fiveBullets: ["中文五点"],
      packageDimensions: "预估：15 x 10 x 5 厘米",
      productDimensions: "长度 9 厘米",
    },
  });

  assert.equal(draft.zhDisplay.title, "1 件路亚鱼饵");
  assert.deepEqual(draft.zhDisplay.sellingPoints, ["中文卖点"]);
  assert.deepEqual(draft.zhDisplay.fiveBullets, ["中文五点"]);
  assert.equal(draft.zhDisplay.packageDimensions, "预估：15 x 10 x 5 厘米");
  assert.equal(draft.zhDisplay.productDimensions, "长度 9 厘米");
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
    "1 Pack Travel Bottle",
  );
});

test("listing workspace shows all bilingual fields on one page without view controls", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  const state = { creation: { listingLanguageMode: "zh", listingSectionMode: "search" } };
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state,
      set: {
        setId: "set-listing-workspace-defaults",
        listingDrafts: [{
          title: "English title",
          sellingPoints: ["English selling point"],
          painPoints: ["English purchase fact"],
          fiveBullets: ["PRODUCT TYPE: English bullet"],
          description: "English description",
          backendSearchTerms: "english search terms",
          keywordBuckets: { exact: ["english keyword"] },
          packageDimensions: "Estimated: 6 x 4 x 2 in",
          productDimensions: "3.5 in long",
          packageWeight: "Estimated: 12.35 oz",
          productWeight: "Estimated: 8.82 oz",
          zhDisplay: {
            title: "中文标题",
            sellingPoints: ["中文卖点"],
            painPoints: ["中文购买信息"],
            fiveBullets: ["产品类型: 中文要点"],
            description: "中文描述",
            backendSearchTerms: "中文搜索词",
            keywordBuckets: { exact: ["中文关键词"] },
            packageDimensions: "预估：15 x 10 x 5 厘米",
            productDimensions: "长度 9 厘米",
            packageWeight: "预估：12.35 盎司",
            productWeight: "预估：8.82 盎司",
          },
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const [card] = root.children;
  const viewControls = collectFakeElements(root, (node) => (
    node.dataset?.creationListingViewControl !== undefined
  ));
  const fieldGroups = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-field-group")
  ));
  const fieldLabels = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-field-label")
  ));
  const copyPairs = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-copy-pair")
  ));
  const titleCopies = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-title-copy")
  ));

  assert.equal(card.dataset.creationListingLanguageMode, undefined);
  assert.equal(card.dataset.creationListingSectionMode, undefined);
  assert.deepEqual(viewControls, []);
  assert.deepEqual(fieldGroups, []);
  assert.deepEqual(fieldLabels.map((label) => label.textContent), [
    "标题",
    "卖点",
    "痛点",
    "五点描述",
    "商品描述",
    "后台搜索词",
    "关键词分组",
    "包装尺寸和重量",
    "产品尺寸和重量",
  ]);
  assert.deepEqual(
    titleCopies.map((button) => [
      button.dataset.creationListingCopyLanguage,
      button.dataset.creationListingCopyText,
    ]),
    [["en", "English title"], ["zh", "中文标题"]],
  );
  const specificationCopies = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-field-copy")
  ));
  assert.equal(
    specificationCopies.find((button) => (
      button.dataset.creationListingCopyLabel === "包装尺寸和重量英文"
    ))?.dataset.creationListingCopyText,
    "尺寸: Estimated: 6 x 4 x 2 in\n重量: Estimated: 12.35 oz",
  );
  assert.equal(
    specificationCopies.find((button) => (
      button.dataset.creationListingCopyLabel === "产品尺寸和重量中文"
    ))?.dataset.creationListingCopyText,
    "尺寸：长度 9 厘米\n重量：预估：8.82 盎司",
  );
  copyPairs
    .filter((pair) => pair.children.length === 2)
    .forEach((pair) => {
      assert.deepEqual(
        pair.children.map((child) => child.dataset.creationListingCopyLanguage),
        ["en", "zh"],
      );
    });
  assert.equal(getFakeTextContent(root).split("English title").length - 1, 1);
  assert.equal(getFakeTextContent(root).split("中文标题").length - 1, 1);
  const fullCopy = buildCreationRecordListingText({
    setId: "set-listing-workspace-defaults",
    listingDrafts: [{
      title: "English title",
      keywordBuckets: { exact: ["english keyword"] },
      packageDimensions: "Estimated: 6 x 4 x 2 in",
      productDimensions: "3.5 in long",
      packageWeight: "Estimated: 12.35 oz",
      productWeight: "Estimated: 8.82 oz",
      zhDisplay: {
        title: "中文标题",
        keywordBuckets: { exact: ["中文关键词"] },
        packageDimensions: "预估：15 x 10 x 5 厘米",
        productDimensions: "长度 9 厘米",
        packageWeight: "预估：12.35 盎司",
        productWeight: "预估：8.82 盎司",
      },
    }],
  });
  assert.ok(fullCopy.indexOf("关键词分组:") < fullCopy.indexOf("包装尺寸和重量:"));
  assert.ok(fullCopy.indexOf("包装尺寸和重量:") < fullCopy.indexOf("产品尺寸和重量:"));
  assert.match(
    fullCopy,
    /包装尺寸和重量:\n尺寸: Estimated: 6 x 4 x 2 in\n重量: Estimated: 12\.35 oz\n中文参考:\n尺寸：预估：15 x 10 x 5 厘米\n重量：预估：12\.35 盎司/u,
  );
  assert.match(
    fullCopy,
    /产品尺寸和重量:\n尺寸: 3\.5 in long\n重量: Estimated: 8\.82 oz\n中文参考:\n尺寸：长度 9 厘米\n重量：预估：8\.82 盎司/u,
  );
});

test("rendered listing values expose separate English and Chinese copy targets", () => {
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
        setId: "set-language-copy-targets",
        listingDrafts: [{
          title: "English title",
          sellingPoints: ["English point one", "English point two"],
          description: "English description without Chinese content",
          zhDisplay: {
            title: "中文标题",
            sellingPoints: ["中文卖点一", "中文卖点二"],
          },
        }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const englishCopies = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-value-copy")
  )).map((button) => button.dataset.creationListingCopyText);
  const chineseCopies = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-localized")
  )).map((button) => button.dataset.creationListingCopyText);
  const sellingFieldCopy = root.querySelectorAll("[data-creation-listing-copy-text]")
    .find((button) => (
      String(button.className || "").includes("creation-listing-field-copy")
      && button.dataset.creationListingCopyLanguage === "en"
      && button.dataset.creationListingCopyLabel === "卖点英文"
    ));
  const copyPairs = collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-copy-pair")
  ));
  const descriptionPair = copyPairs.find((pair) => (
    pair.children[0]?.dataset?.creationListingCopyText === "English description without Chinese content"
  ));

  assert.ok(englishCopies.includes("English title"));
  assert.ok(englishCopies.includes("English point one"));
  assert.ok(englishCopies.includes("English point two"));
  assert.doesNotMatch(englishCopies.join("\n"), /中文标题|中文卖点/u);
  assert.deepEqual(chineseCopies, ["中文标题", "中文卖点一", "中文卖点二"]);
  assert.doesNotMatch(chineseCopies.join("\n"), /English title|English point/u);
  assert.equal(sellingFieldCopy?.dataset.creationListingCopyText, "English point one\nEnglish point two");
  assert.deepEqual(
    descriptionPair?.children.map((child) => child.dataset.creationListingCopyLanguage),
    ["en"],
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

test("rendered public listing compare view shows UI-only Chinese reference text", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: { creation: { listingLanguageMode: "compare" } },
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

  assert.match(titleText, /EN 8/u);
  assert.match(titleText, /中文 4/u);
  assert.match(titleText, /迷你鱼竿/u);
  assert.match(sellingText, /EN 9/u);
  assert.match(sellingText, /抛投更远/u);
  assert.match(getFakeTextContent(painField), /鱼竿不易比较/u);
  assert.match(getFakeTextContent(bulletField), /尺寸信息清楚/u);
  assert.match(getFakeTextContent(descriptionField), /适合紧凑钓具套装。/u);
  assert.match(getFakeTextContent(backendField), /迷你 鱼竿 便携/u);
  assert.match(getFakeTextContent(bucketField), /精准关键词:.*迷你鱼竿/u);
  assert.match(getFakeTextContent(bucketField), /长尾关键词:.*迷你钓鱼竿/u);
  assert.match(copyData, /迷你鱼竿|抛投更远|紧凑钓具/u);
  assert.ok(countNodes.some((node) => node.children?.[0]?.className === "creation-listing-character-count english"));
  const bucketLabels = collectFakeElements(bucketField, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-bucket-label")
  ));
  const bucketValueCopies = collectFakeElements(bucketField, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-bucket-value")
  ));
  const bucketFieldCopies = bucketField.querySelectorAll("[data-creation-listing-copy-text]")
    .filter((button) => String(button.className || "").includes("creation-listing-field-copy"));

  assert.deepEqual(bucketLabels.map((label) => label.textContent), [
    "精准关键词:", "精准关键词:",
    "长尾关键词:", "长尾关键词:",
    "流量关键词:", "流量关键词:",
    "描述词:", "描述词:",
  ]);
  assert.equal(bucketLabels.every((label) => label.dataset.creationListingCopyText === undefined), true);
  assert.deepEqual(
    bucketValueCopies.map((button) => [
      button.dataset.creationListingCopyLanguage,
      button.dataset.creationListingCopyText,
    ]),
    [
      ["en", "mini rod"], ["zh", "迷你鱼竿"],
      ["en", "mini fishing rod"], ["zh", "迷你钓鱼竿"],
      ["en", "compact fishing kit"], ["zh", "紧凑钓具套装"],
      ["en", "portable rod"], ["zh", "便携鱼竿"],
    ],
  );
  assert.deepEqual(
    Object.fromEntries(bucketFieldCopies.map((button) => [
      button.dataset.creationListingCopyLanguage,
      button.dataset.creationListingCopyText,
    ])),
    {
      en: "mini rod\nmini fishing rod\ncompact fishing kit\nportable rod",
      zh: "迷你鱼竿\n迷你钓鱼竿\n紧凑钓具套装\n便携鱼竿",
    },
  );
  assert.doesNotMatch(
    bucketField.querySelectorAll("[data-creation-listing-copy-text]")
      .map((button) => button.dataset.creationListingCopyText)
      .join("\n"),
    /精准关键词|长尾关键词|流量关键词|描述词|exact keywords|long-tail keywords|traffic keywords|descriptive keywords/iu,
  );
  const [bucketCounts] = collectFakeElements(bucketField, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-character-counts")
  ));

  assert.match(getFakeTextContent(bucketCounts), /EN 55/u);
  assert.match(getFakeTextContent(bucketCounts), /中文 19/u);
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

  assert.doesNotMatch(getFakeTextContent(root), /重写|审核/u);
  assert.match(getFakeTextContent(root), /警告|缺失信息/u);
  assert.equal(String(root.children[0]?.className || ""), "creation-listing-card");
  assert.deepEqual(collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-title-copy")
  )).map((button) => button.dataset.creationListingCopyLanguage), ["en"]);
  const copyLabels = root.querySelectorAll("[data-creation-listing-copy-text]")
    .map((button) => button.dataset.creationListingCopyLabel);
  for (const label of ["标题", "卖点", "痛点", "五点描述", "商品描述", "后台搜索词", "关键词分组", "包装尺寸和重量", "产品尺寸和重量"]) {
    assert.equal(copyLabels.includes(`${label}英文`), true, `${label} must remain directly copyable`);
  }
  assert.match(getFakeTextContent(root), /Compact first aid kit|Loose supplies|first aid kit home travel compact/u);
});

test("warning and missing-info fields render their saved Chinese references", () => {
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

  assert.ok(warningField);
  assert.ok(missingInfoField);
  assert.match(
    root.querySelectorAll("[data-creation-listing-copy-text]").map((button) => button.dataset.creationListingCopyText).join("\n"),
    /没有来源数据|未提供实际包袋/u,
  );
});

test("older drafts synthesize readable Chinese review fallback fields", () => {
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

  assert.ok(warningField);
  assert.ok(missingInfoField);
  assert.match(getFakeTextContent(root), /警告|缺失信息|发布前|源数据/u);
});

test("review warnings add explicit review sections to historical layouts", () => {
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
  assert.ok(warningField);
  assert.ok(missingInfoField);
  assert.match(getFakeTextContent(root), /复核|警告|缺失信息/u);
});

test("empty review arrays do not render empty warning sections", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = { createElement: makeFakeElement };
  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: {},
      set: {
        setId: "set-empty-review-fields",
        listingDrafts: [{ title: "1 Pack First Aid Kit", warnings: [], missingInfo: [] }],
      },
    });
  } finally {
    globalThis.document = previousDocument;
  }
  assert.doesNotMatch(getFakeTextContent(root), /警告|缺失信息/u);
});

test("rendered V1 listing copy keeps historical Unicode while separating Chinese references", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = {
    createElement: makeFakeElement,
  };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: { creation: { listingLanguageMode: "compare" } },
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
  const fieldCopyByLabel = Object.fromEntries(copyButtons
    .filter((button) => (
      String(button.className || "").includes("creation-listing-field-copy")
      && button.dataset.creationListingCopyLanguage === "en"
    ))
    .map((button) => [
      button.dataset.creationListingCopyLabel,
      button.dataset.creationListingCopyText,
    ]));
  const localizedCopies = copyButtons
    .filter((button) => String(button.className || "").includes("creation-listing-localized"))
    .map((button) => button.dataset.creationListingCopyText);

  assert.equal(fieldCopyByLabel["标题英文"], "1 Pack 13cm 路亚硬饵 Product Listing Draft");
  assert.equal(fieldCopyByLabel["关键词分组英文"], "fishing lure\nproduct listing\nsku specific");
  assert.match(Object.values(fieldCopyByLabel).join("\n"), /路亚|银蓝|黄绿|硬饵/u);
  assert.doesNotMatch(Object.values(fieldCopyByLabel).join("\n"), /中文卖点对照|中文精准词/u);
  assert.match(localizedCopies.join("\n"), /中文卖点对照|中文精准词/u);
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
      state: { creation: { listingLanguageMode: "compare" } },
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
  assert.match(copyByLabel["后台搜索词英文"], new RegExp(internalSearchToken));
  assert.doesNotMatch(copyByLabel["后台搜索词英文"], /内部中文搜索标记/u);
  assert.ok(root.querySelectorAll("[data-creation-listing-copy-text]").some((button) => (
    String(button.className || "").includes("creation-listing-localized")
    && button.dataset.creationListingCopyText.includes("内部中文搜索标记")
  )));
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
  assert.deepEqual(collectFakeElements(root, (node) => (
    String(node.className || "").split(/\s+/).includes("creation-listing-title-copy")
  )).map((button) => button.dataset.creationListingCopyLanguage), ["en", "zh"]);
  const labels = root.querySelectorAll("[data-creation-listing-copy-text]")
    .map((button) => button.dataset.creationListingCopyLabel);
  for (const label of ["标题", "卖点", "痛点", "五点描述", "商品描述", "后台搜索词", "关键词分组"]) {
    assert.equal(labels.includes(`${label}英文`), true);
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
    packageDimensions: "Estimated: EN_PACKAGE_DIMENSIONS_TOKEN 20 x 15 x 8 cm",
    productDimensions: "Estimated: EN_PRODUCT_DIMENSIONS_TOKEN 18 x 12 x 6 cm",
    packageWeight: "Estimated: EN_PACKAGE_WEIGHT_TOKEN 350 g",
    productWeight: "Estimated: EN_PRODUCT_WEIGHT_TOKEN 250 g",
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
      packageDimensions: "预估：中文包装尺寸标记 EN_PACKAGE_DIMENSIONS_TOKEN 20 x 15 x 8 厘米",
      productDimensions: "预估：中文产品尺寸标记 EN_PRODUCT_DIMENSIONS_TOKEN 18 x 12 x 6 厘米",
      packageWeight: "预估：中文包装重量标记 EN_PACKAGE_WEIGHT_TOKEN 350 克",
      productWeight: "预估：中文产品重量标记 EN_PRODUCT_WEIGHT_TOKEN 250 克",
      warnings: ["中文警告标记 EN_WARNING_TOKEN"],
      missingInfo: ["中文缺失标记 EN_MISSING_TOKEN"],
    },
    publishFields: ["title", "highlights", "description", "searchTerms"],
    status: "completed",
  };
}

test("completed V2 fields display bilingual values with language-specific copy payloads", () => {
  const previousDocument = globalThis.document;
  const root = makeFakeElement("div");
  globalThis.document = { createElement: makeFakeElement };

  try {
    renderCreationListingDrafts({
      refs: { creationRecordListingDrafts: root },
      state: { creation: { listingLanguageMode: "compare" } },
      set: { setId: "set-bilingual-v2", listingDrafts: [makeBilingualV2Draft()] },
    });
  } finally {
    globalThis.document = previousDocument;
  }

  const visibleText = getFakeTextContent(root);
  for (const token of [
    "EN_TITLE_TOKEN", "EN_SELLING_TOKEN", "EN_OBJECTION_TOKEN", "EN_HIGHLIGHT_TOKEN",
    "EN_DESCRIPTION_TOKEN", "EN_SEARCH_TOKEN", "EN_EXACT_TOKEN",
    "EN_PACKAGE_DIMENSIONS_TOKEN", "EN_PRODUCT_DIMENSIONS_TOKEN",
    "EN_PACKAGE_WEIGHT_TOKEN", "EN_PRODUCT_WEIGHT_TOKEN",
    "中文标题标记", "中文卖点标记", "中文疑虑标记", "中文亮点标记", "中文描述标记",
    "中文搜索标记", "中文精准标记",
  ]) {
    assert.match(visibleText, new RegExp(token));
  }

  const fieldCopies = root.querySelectorAll("[data-creation-listing-copy-text]")
    .filter((button) => (
      String(button.className || "").includes("creation-listing-field-copy")
      && button.dataset.creationListingCopyLanguage === "en"
    ))
    .map((button) => button.dataset.creationListingCopyText);
  const localizedCopies = root.querySelectorAll("[data-creation-listing-copy-text]")
    .filter((button) => String(button.className || "").includes("creation-listing-localized"))
    .map((button) => button.dataset.creationListingCopyText);
  for (const [english, chinese] of [
    ["EN_TITLE_TOKEN", "中文标题标记"],
    ["EN_SELLING_TOKEN", "中文卖点标记"],
    ["EN_OBJECTION_TOKEN", "中文疑虑标记"],
    ["EN_HIGHLIGHT_TOKEN", "中文亮点标记"],
    ["EN_DESCRIPTION_TOKEN", "中文描述标记"],
    ["EN_SEARCH_TOKEN", "中文搜索标记"],
    ["EN_EXACT_TOKEN", "中文精准标记"],
    ["EN_PACKAGE_DIMENSIONS_TOKEN", "中文包装尺寸标记"],
    ["EN_PRODUCT_DIMENSIONS_TOKEN", "中文产品尺寸标记"],
    ["EN_PACKAGE_WEIGHT_TOKEN", "中文包装重量标记"],
    ["EN_PRODUCT_WEIGHT_TOKEN", "中文产品重量标记"],
  ]) {
    assert.ok(fieldCopies.some((copy) => copy.includes(english)), `${english} must remain field-copyable`);
    assert.ok(fieldCopies.every((copy) => !copy.includes(chinese)), `${chinese} must not leak into English field copy`);
    assert.ok(localizedCopies.some((copy) => copy.includes(chinese)), `${chinese} must be independently copyable`);
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
    "EN_PACKAGE_DIMENSIONS_TOKEN", "EN_PRODUCT_DIMENSIONS_TOKEN",
    "EN_PACKAGE_WEIGHT_TOKEN", "EN_PRODUCT_WEIGHT_TOKEN",
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
  assert.equal(payload.listingDrafts[0].packageDimensions, "Estimated: EN_PACKAGE_DIMENSIONS_TOKEN 20 x 15 x 8 cm");
  assert.equal(payload.listingDrafts[0].productDimensions, "Estimated: EN_PRODUCT_DIMENSIONS_TOKEN 18 x 12 x 6 cm");
  assert.equal(payload.listingDrafts[0].packageWeight, "Estimated: EN_PACKAGE_WEIGHT_TOKEN 350 g");
  assert.equal(payload.listingDrafts[0].productWeight, "Estimated: EN_PRODUCT_WEIGHT_TOKEN 250 g");
  assert.match(payload.listingDrafts[0].zhDisplay.packageWeight, /中文包装重量标记/u);
  assert.match(payload.listingDrafts[0].zhDisplay.productWeight, /中文产品重量标记/u);
  const exportedFields = Object.keys(payload.listingDrafts[0]);
  assert.ok(exportedFields.indexOf("packageDimensions") < exportedFields.indexOf("packageWeight"));
  assert.ok(exportedFields.indexOf("packageWeight") < exportedFields.indexOf("productDimensions"));
  assert.ok(exportedFields.indexOf("productDimensions") < exportedFields.indexOf("productWeight"));
  assert.equal(payload.listingDrafts[0].zhDisplay.title, "中文标题标记 EN_TITLE_TOKEN");
  assert.match(payload.listingDrafts[0].zhDisplay.packageDimensions, /中文包装尺寸标记/u);
  assert.match(payload.listingDrafts[0].zhDisplay.productDimensions, /中文产品尺寸标记/u);
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

test("listing generation accepts a successful service response without dimension fields", async () => {
  const selectedSet = { setId: "set-stale-listing-service", listingDrafts: [] };
  const feedback = [];
  let upsertedSet = null;
  const controller = createCreationListingController({
    state: { creation: { sets: [selectedSet] } },
    getSelectedSet: () => selectedSet,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        set: {
          ...selectedSet,
          listingDrafts: [{
            title: "1 Pack Door Latch",
            zhDisplay: { title: "1 件装门插销" },
          }],
        },
      }),
    }),
    upsertSet: (set) => {
      upsertedSet = set;
      return set;
    },
    compactErrorMessage: (message) => message,
    setFeedback: (message, type) => feedback.push({ message, type }),
  });

  const nextSet = await controller.generate(selectedSet.setId);

  assert.equal(upsertedSet, nextSet);
  assert.equal(nextSet.listingDrafts[0].title, "1 Pack Door Latch");
  assert.equal(feedback.at(-1)?.type, "success");
});

test("listing generation accepts a successful service response without weight fields", async () => {
  const selectedSet = { setId: "set-stale-listing-weight-service", listingDrafts: [] };
  let upsertedSet = null;
  const controller = createCreationListingController({
    state: { creation: { sets: [selectedSet] } },
    getSelectedSet: () => selectedSet,
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        set: {
          ...selectedSet,
          listingDrafts: [{
            title: "1 Pack Door Latch",
            packageDimensions: "Estimated: 8 x 5 x 2 in",
            productDimensions: "7 x 2 x 1 in",
            zhDisplay: {
              title: "1 件装门插销",
              packageDimensions: "预估：20 x 13 x 5 厘米",
              productDimensions: "18 x 5 x 3 厘米",
            },
          }],
        },
      }),
    }),
    upsertSet: (set) => {
      upsertedSet = set;
      return set;
    },
    compactErrorMessage: (message) => message,
    setFeedback: () => {},
  });

  const nextSet = await controller.generate(selectedSet.setId);

  assert.equal(upsertedSet, nextSet);
  assert.equal(nextSet.listingDrafts[0].title, "1 Pack Door Latch");
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
