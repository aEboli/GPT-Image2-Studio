import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { createContext, runInContext } from "node:vm";

import {
  buildCreationRecordListModel,
  createCreationRecordListState,
  loadMoreCreationRecordListState,
} from "../lib/creation-record-list-model.mjs";
import { createCreationRecordListRow } from "../lib/creation-record-list-view.mjs";
import {
  filterCreationRecordSetsByTime,
  normalizeCreationRecordDateFilter,
  normalizeCreationRecordTimeFilter,
} from "../lib/creation-record-filter.mjs";

function toDatasetKey(value) {
  return value.replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

class FakeElement {
  constructor(tagName = "div") {
    this.tagName = String(tagName).toUpperCase();
    this.attributes = new Map();
    this.children = [];
    this.className = "";
    this.dataset = {};
    this.disabled = false;
    this.focused = false;
    this.hidden = false;
    this.scrollLeft = 0;
    this.scrollTop = 0;
    this._textContent = "";
    this.classList = {
      contains: (token) => this.className.split(/\s+/u).filter(Boolean).includes(token),
      toggle: (token, force) => {
        const tokens = new Set(this.className.split(/\s+/u).filter(Boolean));
        const enabled = force === undefined ? !tokens.has(token) : Boolean(force);
        if (enabled) tokens.add(token);
        else tokens.delete(token);
        this.className = [...tokens].join(" ");
        return enabled;
      },
    };
  }

  get textContent() {
    return [
      this._textContent,
      ...this.children.map((child) => typeof child === "string" ? child : child.textContent),
    ].join("");
  }

  set textContent(value) {
    this._textContent = String(value ?? "");
    this.children = [];
  }

  append(...children) {
    this.children.push(...children);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  replaceChildren(...children) {
    this._textContent = "";
    this.children = [...children];
  }

  setAttribute(name, value) {
    this.attributes.set(String(name), String(value));
  }

  getAttribute(name) {
    return this.attributes.has(String(name)) ? this.attributes.get(String(name)) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(String(name));
  }

  focus() {
    this.focused = true;
  }

  querySelectorAll(selector) {
    const matches = [];
    const dataMatch = /^\[data-([a-z0-9-]+)\]$/u.exec(selector);
    const roleMatch = /^\[role="([^"]+)"\]$/u.exec(selector);
    const visit = (node) => {
      if (!(node instanceof FakeElement)) return;
      if (dataMatch && node.dataset[toDatasetKey(dataMatch[1])] !== undefined) matches.push(node);
      else if (roleMatch && node.getAttribute("role") === roleMatch[1]) matches.push(node);
      else if (!dataMatch && !roleMatch && node.tagName.toLowerCase() === selector.toLowerCase()) matches.push(node);
      node.children.forEach(visit);
    };
    this.children.forEach(visit);
    return matches;
  }
}

function createFakeDocument() {
  return {
    createElement: (tagName) => new FakeElement(tagName),
  };
}

function getSourceSection(source, startMarker, endMarker) {
  const startIndex = source.indexOf(startMarker);
  assert.notEqual(startIndex, -1, `Missing source marker: ${startMarker}`);
  const endIndex = source.indexOf(endMarker, startIndex + startMarker.length);
  assert.notEqual(endIndex, -1, `Missing source marker: ${endMarker}`);
  return source.slice(startIndex, endIndex);
}

function createNavigationRuntime(appSource, state, refs, documentRef, referenceNow) {
  const feedback = [];
  const context = createContext({
    buildCreationRecordListModel,
    createCreationRecordListRow,
    document: documentRef,
    filterCreationRecordSetsByTime: (sets, filters) => (
      filterCreationRecordSetsByTime(sets, filters, referenceNow)
    ),
    formatCreationPlatformLabel: (platform) => String(platform || "").toUpperCase(),
    formatTime: (value) => String(value || "").slice(0, 10),
    getCreationProgressSummary: (set) => set.progress,
    getCreationRecordListingMetaLabel: () => "",
    getCreationRecordSearchText: (set) => [set.productName, set.searchTerms]
      .filter(Boolean)
      .join(" ")
      .toLowerCase(),
    hasCreationRecordActiveFilters: () => true,
    normalizeCreationRecordDateFilter,
    normalizeCreationRecordTimeFilter,
    refs,
    setCreationRecordFeedback: (...args) => feedback.push(args),
    state,
  });
  const runtimeSource = [
    getSourceSection(
      appSource,
      "function getCreationRecordKeywordMatchedSets() {",
      "\nfunction getCreationRecordTimeFilterSnapshot",
    ),
    getSourceSection(
      appSource,
      "function getCreationRecordTimeFilterSnapshot() {",
      "\nfunction filterCreationRecordSets",
    ),
    getSourceSection(
      appSource,
      "function filterCreationRecordSets() {",
      "\nfunction hasCreationRecordActiveFilters",
    ),
    getSourceSection(
      appSource,
      "function getCreationRecordSelectedSet() {",
      "\nfunction getCreationRecordDeleteTargetsForMode",
    ),
    getSourceSection(
      appSource,
      "function getCreationRecordListFilterSignature() {",
      "\nfunction renderCreationRecordSetList",
    ),
    getSourceSection(
      appSource,
      "function renderCreationRecordSetList(filteredSets = filterCreationRecordSets()) {",
      "\nfunction selectCreationRecord",
    ),
    getSourceSection(
      appSource,
      "function selectCreationRecord(setId) {",
      "\nasync function openCreationRecordFolder",
    ),
  ].join("\n");

  runInContext(`${runtimeSource}
    let renderCount = 0;
    function renderCreationRecordView() {
      renderCount += 1;
      renderCreationRecordSetList(filterCreationRecordSets());
    }
    globalThis.creationRecordNavigation = {
      filterCreationRecordSets,
      getCreationRecordListFilterSignature,
      getCreationRecordSelectedSet,
      getRenderCount: () => renderCount,
      renderCreationRecordSetList,
      selectCreationRecord,
    };
  `, context);

  return { ...context.creationRecordNavigation, feedback };
}

function makeRecord(index, overrides = {}) {
  return {
    setId: `set-${String(index).padStart(3, "0")}`,
    productName: `Shoe record ${String(index).padStart(3, "0")}`,
    platform: "temu",
    createdAt: "2026-08-04T08:00:00.000Z",
    progress: { completed: 3, total: 3, failed: 0 },
    items: [],
    ...overrides,
  };
}

function getVisibleRecordButtons(list) {
  return list.querySelectorAll("[data-creation-record-set-id]");
}

test("ordinary creation records render as listitems with independent checkbox and detail button semantics", () => {
  const documentRef = createFakeDocument();
  const formattedTimestamps = [];
  const record = makeRecord(1, {
    productName: "普通商品记录",
    platform: "amazon",
    platformLabel: "Amazon US",
    createdAt: "2026-08-01T03:00:00.000Z",
    updatedAt: "2026-08-05T09:00:00.000Z",
  });
  const row = createCreationRecordListRow({
    set: record,
    selectedSetId: record.setId,
    checked: false,
    getProgressSummary: (set) => set.progress,
    getListingLabel: () => "Listing 1 条",
    formatPlatformLabel: () => "fallback platform",
    formatTime: (value) => {
      formattedTimestamps.push(value);
      return "2026-08-01";
    },
    documentRef,
  });

  assert.equal(row.tagName, "DIV");
  assert.equal(row.getAttribute("role"), "listitem");
  assert.equal(row.querySelectorAll('[role="option"]').length, 0);
  assert.equal(row.hasAttribute("aria-selected"), false);
  assert.equal(row.children.length, 2);

  const [selectLabel, detailButton] = row.children;
  assert.equal(selectLabel.tagName, "LABEL");
  assert.equal(detailButton.tagName, "BUTTON");
  assert.equal(selectLabel.children.length, 1);
  const [checkbox] = selectLabel.children;
  assert.equal(checkbox.tagName, "INPUT");
  assert.equal(checkbox.type, "checkbox");
  assert.equal(checkbox.checked, false);
  assert.equal(checkbox.dataset.creationRecordSelectSetId, record.setId);
  assert.match(checkbox.getAttribute("aria-label"), /普通商品记录/u);
  assert.equal(detailButton.type, "button");
  assert.equal(detailButton.dataset.creationRecordSetId, record.setId);
  assert.equal(detailButton.getAttribute("aria-current"), "true");
  assert.equal(detailButton.hasAttribute("aria-selected"), false);
  assert.equal(detailButton.hasAttribute("role"), false);
  assert.equal(detailButton.getAttribute("aria-label"), "查看 普通商品记录 的套图内容");
  assert.match(detailButton.textContent, /普通商品记录/u);
  assert.match(detailButton.textContent, /Amazon US/u);
  assert.match(detailButton.textContent, /3\/3/u);
  assert.match(detailButton.textContent, /2026-08-01/u);
  assert.match(detailButton.textContent, /已完成/u);
  assert.match(detailButton.textContent, /Listing 1 条/u);
  assert.match(detailButton.textContent, /未导出/u);
  assert.deepEqual(formattedTimestamps, [record.createdAt]);
});

test("selecting a record preserves the visible list, filters, checks, loaded rows, and scroll", async () => {
  const appSource = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
  const documentRef = createFakeDocument();
  const matchingRecords = Array.from({ length: 130 }, (_, index) => makeRecord(index + 1));
  const excludedRecords = [
    makeRecord(201, { productName: "Hat record 201" }),
    makeRecord(202, { productName: "Hat record 202" }),
    makeRecord(203, { createdAt: "2026-07-20T08:00:00.000Z" }),
  ];
  const filterSignature = JSON.stringify(["shoe", "recent", ""]);
  const loadedListState = loadMoreCreationRecordListState(
    createCreationRecordListState(filterSignature),
    filterSignature,
  );
  const state = {
    assetLoadErrors: { creation: "" },
    assetLoading: { creation: false },
    creation: {
      recordCheckedSetIds: ["set-003", "set-125"],
      recordDateFilter: "",
      recordDeleteBusy: false,
      recordDetailExpanded: false,
      recordListScrollTop: 734,
      recordListState: loadedListState,
      recordQuery: " Shoe ",
      recordSetId: "set-001",
      recordTimeFilter: "recent",
      sets: [...matchingRecords, ...excludedRecords],
    },
  };
  const list = new FakeElement("div");
  list.setAttribute("role", "list");
  list.scrollTop = 734;
  const refs = {
    creationRecordArchiveDetail: null,
    creationRecordListSummary: new FakeElement("span"),
    creationRecordLoadMoreButton: new FakeElement("button"),
    creationRecordSetList: list,
  };
  const runtime = createNavigationRuntime(
    appSource,
    state,
    refs,
    documentRef,
    new Date("2026-08-05T12:00:00.000Z"),
  );

  runtime.renderCreationRecordSetList(runtime.filterCreationRecordSets());
  const initialButtons = getVisibleRecordButtons(list);
  const initialSnapshot = {
    checkedSetIds: [...state.creation.recordCheckedSetIds],
    dateFilter: state.creation.recordDateFilter,
    filterSignature: runtime.getCreationRecordListFilterSignature(),
    listState: { ...state.creation.recordListState },
    query: state.creation.recordQuery,
    scrollTop: list.scrollTop,
    stateScrollTop: state.creation.recordListScrollTop,
    summary: refs.creationRecordListSummary.textContent,
    timeFilter: state.creation.recordTimeFilter,
    visibleSetIds: initialButtons.map((button) => button.dataset.creationRecordSetId),
  };

  assert.equal(list.getAttribute("role"), "list");
  assert.equal(initialSnapshot.summary, "已显示 120 / 匹配 130");
  assert.equal(refs.creationRecordLoadMoreButton.hidden, false);
  assert.equal(refs.creationRecordLoadMoreButton.textContent, "加载更多（剩余 10）");
  assert.equal(initialSnapshot.visibleSetIds.length, 120);
  assert.deepEqual(initialSnapshot.visibleSetIds, matchingRecords.slice(0, 120).map((set) => set.setId));
  assert.deepEqual(initialSnapshot.listState, {
    filterSignature,
    visibleLimit: 120,
  });

  runtime.selectCreationRecord("set-085");
  assert.equal(state.creation.recordSetId, "set-085");
  assert.equal(runtime.getCreationRecordSelectedSet().setId, "set-085");

  const selectedButtons = getVisibleRecordButtons(list);
  const selectedSnapshot = {
    checkedSetIds: [...state.creation.recordCheckedSetIds],
    dateFilter: state.creation.recordDateFilter,
    filterSignature: runtime.getCreationRecordListFilterSignature(),
    listState: { ...state.creation.recordListState },
    query: state.creation.recordQuery,
    scrollTop: list.scrollTop,
    stateScrollTop: state.creation.recordListScrollTop,
    summary: refs.creationRecordListSummary.textContent,
    timeFilter: state.creation.recordTimeFilter,
    visibleSetIds: selectedButtons.map((button) => button.dataset.creationRecordSetId),
  };

  assert.equal(state.creation.recordDetailExpanded, false);
  assert.deepEqual(selectedSnapshot, initialSnapshot);
  assert.equal(refs.creationRecordLoadMoreButton.hidden, false);
  assert.equal(refs.creationRecordLoadMoreButton.textContent, "加载更多（剩余 10）");
  assert.equal(runtime.getRenderCount(), 1);
});
