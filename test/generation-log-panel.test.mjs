import assert from "node:assert/strict";
import test from "node:test";

import {
  GENERATION_LOG_GROUP_TOGGLE_ATTRIBUTE,
  GENERATION_LOG_PANEL_EMPTY_TEXT,
  readGenerationLogChannelTabValue,
  readGenerationLogGroupToggleId,
  renderGenerationLogChannelTabs,
  renderGenerationLogRows,
  toggleGenerationLogGroup,
} from "../lib/generation-log-panel.mjs";
import {
  createGenerationLogStore,
  getGenerationLogAllEntries,
  getGenerationLogChannelEntries,
  getGenerationLogChannelLabel,
  upsertGenerationLogEntry,
  upsertGenerationLogGroupEntry,
} from "../lib/generation-log-store.mjs";

function createTestElement(tagName = "div", ownerDocument = null) {
  const element = {
    tagName: String(tagName).toUpperCase(),
    ownerDocument,
    children: [],
    className: "",
    dataset: {},
    attributes: new Map(),
    textContent: "",
    href: "",
    type: "",
    dateTime: "",
    parentElement: null,
    get childNodes() {
      return element.children;
    },
    classList: {
      add(...names) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        names.forEach((name) => current.add(String(name)));
        element.className = [...current].join(" ");
      },
      contains(name) {
        return String(element.className || "").split(/\s+/).includes(String(name));
      },
    },
    append(...nodes) {
      nodes.forEach((node) => element.appendChild(node));
    },
    appendChild(node) {
      node.parentElement = element;
      element.children.push(node);
      return node;
    },
    replaceChildren(...nodes) {
      element.children.forEach((child) => {
        child.parentElement = null;
      });
      element.children = [];
      nodes.forEach((node) => element.appendChild(node));
    },
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return element.attributes.has(name) ? element.attributes.get(name) : null;
    },
    closest(selector) {
      const attribute = selector.match(/^\[([^\]=]+)\]$/)?.[1] || "";
      let current = element;
      while (current) {
        if (attribute && current.attributes?.has(attribute)) {
          return current;
        }
        current = current.parentElement;
      }
      return null;
    },
    querySelector(selector) {
      return element.querySelectorAll(selector)[0] || null;
    },
    querySelectorAll(selector) {
      const className = selector.startsWith(".") ? selector.slice(1) : "";
      const matches = [];
      const stack = [...element.children];
      while (stack.length > 0) {
        const node = stack.shift();
        if (className && String(node.className || "").split(/\s+/).includes(className)) {
          matches.push(node);
        }
        stack.unshift(...node.children);
      }
      return matches;
    },
  };
  return element;
}

function createTestDocument() {
  const documentRef = createTestElement("#document");
  documentRef.createElement = (tagName) => createTestElement(tagName, documentRef);
  documentRef.ownerDocument = documentRef;
  return documentRef;
}

function getText(root, className) {
  return root.querySelectorAll(`.${className}`).map((node) => node.textContent);
}

function buildStore() {
  const withPrompt = upsertGenerationLogEntry(createGenerationLogStore(), {
    channel: "prompt",
    key: "job-1:task",
    title: "已完成",
    detail: "图像已成功生成",
    status: "done",
    relayUrl: "https://api.agicto.cn/v1",
    ratio: "1:1",
    size: "1024x1024",
    modeLabel: "路由模式",
    at: "2026-08-28T10:00:00.000Z",
  });

  return ["a", "b"].reduce((store, itemId, index) => {
    return upsertGenerationLogGroupEntry(store, {
      channel: "creation",
      groupId: "set-1",
      groupLabel: "套图批次 001",
      groupItemId: itemId,
      totalCount: 8,
      relayUrl: "https://api.agicto.cn/v1",
      title: `第 ${index + 1} 张`,
      detail: index === 0 ? "图像已成功生成" : "最终失败：fetch failed",
      status: index === 0 ? "done" : "error",
      at: `2026-08-28T10:1${index}:00.000Z`,
    });
  }, withPrompt);
}

test("generation log panel renders flat entries with the relay url on one line", () => {
  const documentRef = createTestDocument();
  const list = createTestElement("ol", documentRef);
  renderGenerationLogRows(list, {
    entries: getGenerationLogChannelEntries(buildStore(), "prompt"),
    channel: "prompt",
    formatTime: () => "10:00:00",
    documentRef,
  });

  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].className.includes("timeline-item-group"), false);
  assert.deepEqual(getText(list, "timeline-summary"), ["图片已生成"]);
  assert.deepEqual(getText(list, "timeline-relay"), ["URL：https://api.agicto.cn/v1"]);
  assert.equal(list.children[0].classList.contains("has-relay"), true);
  assert.deepEqual(getText(list, "timeline-ratio-size"), ["1:1 (1024x1024)"]);
  assert.deepEqual(getText(list, "timeline-mode"), ["路由模式"]);
  assert.equal(list.querySelectorAll("timeline-group-toggle").length, 0);
});

test("generation log panel omits the relay line when no url is known", () => {
  const documentRef = createTestDocument();
  const list = createTestElement("ol", documentRef);
  renderGenerationLogRows(list, {
    entries: [{ key: "job-1:task", title: "生成中", detail: "正在生成图片", status: "active", at: "2026-08-28T10:00:00.000Z" }],
    channel: "prompt",
    documentRef,
  });

  assert.deepEqual(getText(list, "timeline-relay"), []);
  assert.equal(list.children[0].classList.contains("has-relay"), false);
});

test("generation log panel shows a failed entry with the same url format as a successful one", () => {
  const documentRef = createTestDocument();
  const list = createTestElement("ol", documentRef);
  renderGenerationLogRows(list, {
    entries: [
      { key: "job-1:task", title: "已完成", detail: "图像已成功生成", status: "done", relayUrl: "https://api.agicto.cn/v1", at: "2026-08-28T10:00:00.000Z" },
      { key: "job-2:task", title: "失败", detail: "最终失败：fetch failed", status: "error", relayUrl: "https://api.agicto.cn/v1", at: "2026-08-28T10:01:00.000Z" },
    ],
    channel: "prompt",
    documentRef,
  });

  assert.deepEqual(getText(list, "timeline-summary"), ["图片已生成", "生成失败"]);
  assert.deepEqual(getText(list, "timeline-relay"), ["URL：https://api.agicto.cn/v1", "URL：https://api.agicto.cn/v1"]);
  assert.deepEqual(getText(list, "timeline-detail"), ["fetch failed"]);
});

test("generation log panel collapses batch groups by default and expands on demand", () => {
  const documentRef = createTestDocument();
  const store = buildStore();
  const list = createTestElement("ol", documentRef);
  renderGenerationLogRows(list, { entries: getGenerationLogChannelEntries(store, "creation"), channel: "creation", documentRef });

  assert.equal(list.children.length, 1);
  const groupRow = list.children[0];
  assert.equal(groupRow.classList.contains("timeline-item-group"), true);
  assert.equal(groupRow.dataset.generationLogGroupExpanded, "false");
  assert.deepEqual(getText(list, "timeline-summary"), ["套图批次 001"]);
  assert.deepEqual(getText(list, "timeline-group-summary"), ["8 张 · 完成 1 · 失败 1 · 进行中 6"]);
  assert.deepEqual(getText(list, "timeline-relay"), ["URL：https://api.agicto.cn/v1"]);
  assert.equal(groupRow.className.includes("active"), true);
  assert.equal(list.querySelector(".timeline-group-toggle").getAttribute("aria-expanded"), "false");

  renderGenerationLogRows(list, {
    entries: getGenerationLogChannelEntries(store, "creation"),
    channel: "creation",
    expandedGroupIds: new Set(["set-1"]),
    documentRef,
  });

  assert.equal(list.children.length, 3);
  assert.equal(list.children[0].dataset.generationLogGroupExpanded, "true");
  assert.equal(list.children[1].classList.contains("timeline-item-child"), true);
  assert.equal(list.children[2].classList.contains("timeline-item-child"), true);
  assert.deepEqual(getText(list, "timeline-summary"), ["套图批次 001", "图片已生成", "生成失败"]);
  assert.equal(list.querySelector(".timeline-group-toggle").getAttribute("aria-expanded"), "true");
});

test("generation log group row turns failed once children settle with failures", () => {
  const documentRef = createTestDocument();
  const settledStore = ["a", "b"].reduce((store, itemId, index) => {
    return upsertGenerationLogGroupEntry(store, {
      channel: "creation",
      groupId: "set-2",
      groupLabel: "套图批次 002",
      groupItemId: itemId,
      totalCount: 2,
      status: index === 0 ? "done" : "error",
      detail: index === 0 ? "图像已成功生成" : "最终失败：fetch failed",
      at: "2026-08-28T10:20:00.000Z",
    });
  }, createGenerationLogStore());

  const list = createTestElement("ol", documentRef);
  renderGenerationLogRows(list, { entries: getGenerationLogChannelEntries(settledStore, "creation"), channel: "creation", documentRef });
  assert.equal(list.children[0].className.includes("error"), true);
  assert.deepEqual(getText(list, "timeline-group-summary"), ["2 张 · 完成 1 · 失败 1 · 进行中 0"]);
});

test("generation log panel labels channels only in the cross-panel view", () => {
  const documentRef = createTestDocument();
  const entries = getGenerationLogAllEntries(buildStore());

  const scopedList = createTestElement("ol", documentRef);
  renderGenerationLogRows(scopedList, { entries: getGenerationLogChannelEntries(buildStore(), "prompt"), channel: "prompt", documentRef });
  assert.deepEqual(getText(scopedList, "timeline-channel"), []);

  const allList = createTestElement("ol", documentRef);
  renderGenerationLogRows(allList, { entries, channel: "all", expandedGroupIds: ["set-1"], documentRef });
  assert.deepEqual(getText(allList, "timeline-channel"), ["套图模式", "提示词生图"]);
});

test("generation log panel renders an empty state instead of a blank list", () => {
  const documentRef = createTestDocument();
  const list = createTestElement("ol", documentRef);
  renderGenerationLogRows(list, { entries: [], channel: "portrait", documentRef });

  assert.equal(list.children.length, 1);
  assert.equal(list.children[0].classList.contains("timeline-item-empty"), true);
  assert.deepEqual(getText(list, "timeline-summary"), [GENERATION_LOG_PANEL_EMPTY_TEXT]);

  renderGenerationLogRows(list, { entries: getGenerationLogChannelEntries(buildStore(), "prompt"), channel: "prompt", documentRef });
  assert.equal(list.querySelectorAll(".timeline-item-empty").length, 0);
});

test("generation log channel tabs mark the active board and expose their value", () => {
  const documentRef = createTestDocument();
  const host = createTestElement("div", documentRef);
  renderGenerationLogChannelTabs(host, {
    channels: ["all", "prompt", "creation"],
    activeChannel: "creation",
    getChannelLabel: getGenerationLogChannelLabel,
    allLabel: "全部板块",
    documentRef,
  });

  assert.deepEqual(host.children.map((tab) => tab.textContent), ["全部板块", "提示词生图", "套图模式"]);
  assert.deepEqual(host.children.map((tab) => tab.getAttribute("aria-pressed")), ["false", "false", "true"]);
  assert.equal(host.children[2].classList.contains("is-active"), true);
  assert.equal(host.children[0].type, "button");
  assert.equal(readGenerationLogChannelTabValue(host.children[1]), "prompt");
  assert.equal(readGenerationLogChannelTabValue(host.children[0]), "all");
  assert.equal(readGenerationLogChannelTabValue(host), "");

  // 重渲染换掉整排标签，不残留上一次的选中态。
  renderGenerationLogChannelTabs(host, {
    channels: ["all", "prompt"],
    activeChannel: "prompt",
    getChannelLabel: getGenerationLogChannelLabel,
    documentRef,
  });
  assert.deepEqual(host.children.map((tab) => tab.getAttribute("aria-pressed")), ["false", "true"]);
  assert.equal(host.children.length, 2);
});

test("generation log group toggle reads its id and flips only that group", () => {
  const documentRef = createTestDocument();
  const list = createTestElement("ol", documentRef);
  renderGenerationLogRows(list, { entries: getGenerationLogChannelEntries(buildStore(), "creation"), channel: "creation", documentRef });

  const caret = list.querySelector(".timeline-group-caret");
  assert.equal(readGenerationLogGroupToggleId(caret), "set-1");
  assert.equal(readGenerationLogGroupToggleId(list.querySelector(".timeline-dot")), "");
  assert.equal(list.querySelector(".timeline-group-toggle").getAttribute(GENERATION_LOG_GROUP_TOGGLE_ATTRIBUTE), "set-1");

  const expanded = toggleGenerationLogGroup(new Set(["set-9"]), "set-1");
  assert.deepEqual([...expanded], ["set-9", "set-1"]);
  assert.deepEqual([...toggleGenerationLogGroup(expanded, "set-1")], ["set-9"]);
  assert.deepEqual([...toggleGenerationLogGroup(new Set(), "")], []);
});
