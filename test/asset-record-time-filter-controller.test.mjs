import test from "node:test";
import assert from "node:assert/strict";

import {
  createAssetRecordTimeFilterController,
  getArticleRecordSearchText,
  getPortraitRecordSearchText,
} from "../lib/asset-record-time-filter-controller.mjs";

class FakeElement {
  constructor() {
    this.attributes = {};
    this.children = [];
    this.dataset = {};
    this.disabled = false;
    this.listeners = new Map();
    this.textContent = "";
    this.type = "";
    this.value = "";
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  appendChild(child) {
    this.children.push(child);
  }

  dispatch(type) {
    for (const listener of this.listeners.get(type) || []) {
      listener({ target: this, preventDefault() {} });
    }
  }

  replaceChildren(...children) {
    this.children = children;
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }
}

class FakeDocument {
  constructor(elements) {
    this.elements = elements;
  }

  createElement() {
    return new FakeElement();
  }

  querySelector(selector) {
    return this.elements[selector] || null;
  }
}

function localTimestamp(year, month, day, hour = 12) {
  return new Date(year, month - 1, day, hour, 0, 0, 0).toISOString();
}

test("asset record controller combines search and time state across controls", () => {
  const elements = Object.fromEntries(
    ["Count", "DateInput", "ResetFiltersButton", "SearchInput", "TimeFilters"].map((suffix) => [
      `#articleRecord${suffix}`,
      new FakeElement(),
    ]),
  );
  const records = [
    { id: "alpha-today", title: "Alpha", createdAt: localTimestamp(2026, 7, 24) },
    { id: "alpha-older", title: "Alpha archive", createdAt: localTimestamp(2026, 7, 17) },
    { id: "beta-recent", title: "Beta", createdAt: localTimestamp(2026, 7, 20) },
    { id: "invalid", title: "Alpha invalid", createdAt: "invalid" },
  ];
  let renderCount = 0;
  const controller = createAssetRecordTimeFilterController({
    documentRoot: new FakeDocument(elements),
    pages: {
      article: {
        countSuffix: "套",
        getRecords: () => records,
        getReferenceNow: () => new Date(2026, 6, 24, 15, 0, 0, 0),
        getSearchText: (record) => record.title,
        prefix: "articleRecord",
        renderView: () => {
          renderCount += 1;
        },
      },
    },
  });

  controller.bind();
  let view = controller.render("article");
  assert.deepEqual(view.records.map((record) => record.id), records.map((record) => record.id));
  assert.equal(elements["#articleRecordCount"].textContent, "4 套");
  assert.deepEqual(
    elements["#articleRecordTimeFilters"].children.map((button) => button.textContent),
    ["全部 4", "今天 1", "近 7 天 2", "更早 1"],
  );

  elements["#articleRecordSearchInput"].value = " alpha ";
  elements["#articleRecordSearchInput"].dispatch("input");
  view = controller.render("article");
  assert.equal(renderCount, 1);
  assert.deepEqual(view.records.map((record) => record.id), ["alpha-today", "alpha-older", "invalid"]);
  assert.equal(elements["#articleRecordCount"].textContent, "3 / 4 套");

  elements["#articleRecordDateInput"].value = "2026-07-17";
  elements["#articleRecordDateInput"].dispatch("input");
  view = controller.render("article");
  assert.equal(renderCount, 2);
  assert.deepEqual(view.records.map((record) => record.id), ["alpha-older"]);
  assert.deepEqual(controller.snapshot("article"), {
    window: "all",
    date: "2026-07-17",
    query: " alpha ",
  });

  const recentButton = elements["#articleRecordTimeFilters"].children.find(
    (button) => button.dataset.assetRecordTimeFilter === "recent",
  );
  recentButton.dispatch("click");
  assert.deepEqual(controller.snapshot("article"), { window: "recent", date: "", query: " alpha " });
  assert.equal(renderCount, 3);

  elements["#articleRecordResetFiltersButton"].dispatch("click");
  assert.deepEqual(controller.snapshot("article"), { window: "all", date: "", query: "" });
  assert.equal(renderCount, 4);
});

test("asset record controller search text covers Article and Portrait record evidence", () => {
  assert.match(
    getArticleRecordSearchText({
      title: "长文",
      characters: [{ name: "角色甲" }],
      scenes: [{ name: "会议室" }],
    }),
    /长文.*角色甲.*会议室/,
  );
  assert.match(
    getPortraitRecordSearchText(
      {
        subjectName: "模特甲",
        referenceImageNames: ["reference.jpg"],
        items: [{ actionLabel: "转身", relativePath: "portrait/turn.png" }],
      },
      () => "电影写真",
    ),
    /模特甲.*电影写真.*reference\.jpg.*转身.*portrait\/turn\.png/,
  );
});
