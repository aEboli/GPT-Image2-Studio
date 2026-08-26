import assert from "node:assert/strict";
import test from "node:test";

import {
  createCreationCardLoading,
  getCreationCardDomKey,
  renderCreationCardLoading,
  stopCreationCardLoading,
  syncCreationLoadingCard,
  syncCreationResultGrid,
  updateCreationCardLoading,
} from "../lib/creation-card-loading.mjs";

function toDatasetKey(name) {
  return String(name || "").replace(/-([a-z])/g, (_, letter) => letter.toUpperCase());
}

function matchesSelector(element, selector) {
  const compoundMatch = selector.match(/^\.([a-z0-9-]+)\[data-([a-z0-9-]+)\]$/i);
  if (compoundMatch) {
    return matchesSelector(element, `.${compoundMatch[1]}`) && matchesSelector(element, `[data-${compoundMatch[2]}]`);
  }
  if (selector.startsWith(".")) {
    return String(element.className || "")
      .split(/\s+/)
      .includes(selector.slice(1));
  }
  const dataMatch = selector.match(/^\[data-([a-z0-9-]+)\]$/i);
  if (dataMatch) {
    return Object.hasOwn(element.dataset, toDatasetKey(dataMatch[1]));
  }
  return false;
}

function createTestElement(tagName = "div", ownerDocument = null) {
  const element = {
    tagName: String(tagName).toUpperCase(),
    ownerDocument,
    children: [],
    dataset: {},
    attributes: new Map(),
    style: {
      properties: new Map(),
      setProperty(name, value) {
        element.style.properties.set(name, String(value));
      },
    },
    className: "",
    textContent: "",
    parentElement: null,
    classList: {
      add(...names) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        names.forEach((name) => current.add(String(name)));
        element.className = [...current].join(" ");
      },
      remove(...names) {
        const removeSet = new Set(names.map(String));
        element.className = String(element.className || "")
          .split(/\s+/)
          .filter((name) => name && !removeSet.has(name))
          .join(" ");
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
      if (name.startsWith("data-")) {
        element.dataset[toDatasetKey(name.slice(5))] = String(value);
      }
    },
    getAttribute(name) {
      return element.attributes.get(name) || "";
    },
    querySelector(selector) {
      const stack = [...element.children];
      while (stack.length > 0) {
        const node = stack.shift();
        if (matchesSelector(node, selector)) {
          return node;
        }
        stack.unshift(...node.children);
      }
      return null;
    },
    querySelectorAll(selector) {
      const matches = [];
      const stack = [...element.children];
      while (stack.length > 0) {
        const node = stack.shift();
        if (matchesSelector(node, selector)) {
          matches.push(node);
        }
        stack.unshift(...node.children);
      }
      return matches;
    },
    insertBefore(node, referenceNode = null) {
      if (node.parentElement) {
        node.remove();
      }
      node.parentElement = element;
      const referenceIndex = referenceNode ? element.children.indexOf(referenceNode) : -1;
      if (referenceIndex >= 0) {
        element.children.splice(referenceIndex, 0, node);
      } else {
        element.children.push(node);
      }
      return node;
    },
    remove() {
      if (!element.parentElement) {
        return;
      }
      element.parentElement.children = element.parentElement.children.filter((child) => child !== element);
      element.parentElement = null;
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

function collectTextContent(element) {
  if (!element) {
    return "";
  }
  return [element.textContent || "", ...element.children.map((child) => collectTextContent(child))].join("");
}

test("creation card loading shell uses one shared drop and updates status", () => {
  const documentRef = createTestDocument();
  const shell = createCreationCardLoading("queued", documentRef);
  const drop = shell.querySelector(".generation-loading-drop");
  const percent = shell.querySelector(".generation-loading-percent");

  updateCreationCardLoading(shell, "generating");

  assert.equal(shell.dataset.creationCardLoadingStatus, "generating");
  assert.equal(shell.querySelector(".generation-loading-drop"), drop);
  assert.equal(shell.querySelector(".generation-loading-percent"), percent);
  assert.equal(percent.textContent, "0%");
  assert.equal(shell.querySelector(".creation-card-loading-sketch-ring"), null);
  assert.equal(shell.querySelector(".creation-card-loading-steps"), null);
  stopCreationCardLoading(shell);
});

test("creation card loading renderer reuses the host child across rerenders", () => {
  const documentRef = createTestDocument();
  const host = documentRef.createElement("div");

  const first = renderCreationCardLoading(host, "queued", documentRef);
  const firstDrop = first.querySelector(".generation-loading-drop");
  const second = renderCreationCardLoading(host, "generating", documentRef);

  assert.equal(second, first);
  assert.equal(host.children.length, 1);
  assert.equal(second.querySelector(".generation-loading-drop"), firstDrop);
  assert.equal(second.dataset.creationCardLoadingStatus, "generating");
  stopCreationCardLoading(second);
});

test("creation card loading shell exposes a bounded percentage", () => {
  const documentRef = createTestDocument();
  const shell = createCreationCardLoading("generating", documentRef, { key: "item-3" });
  const percent = shell.querySelector(".generation-loading-percent");

  assert.equal(shell.querySelectorAll(".generation-loading-drop").length, 1);
  assert.equal(percent.textContent, "0%");
  assert.equal(shell.getAttribute("aria-valuemin"), "0");
  assert.equal(shell.getAttribute("aria-valuemax"), "99");
  assert.equal(shell.getAttribute("aria-valuenow"), "0");
  assert.equal(shell.querySelector(".creation-card-loading-sketch-line"), null);
  stopCreationCardLoading(shell);
});

test("queued and generating creation card loading share the same drop", () => {
  const documentRef = createTestDocument();
  const shell = createCreationCardLoading("queued", documentRef, { key: "item-4" });
  const drop = shell.querySelector(".generation-loading-drop");

  assert.equal(shell.dataset.creationCardLoadingStatus, "queued");
  updateCreationCardLoading(shell, "generating", { key: "item-4" });
  assert.equal(shell.querySelector(".generation-loading-drop"), drop);
  assert.equal(shell.querySelector(".creation-card-loading-waiting-mark"), null);
  stopCreationCardLoading(shell);
});

test("creation card loading shell can be stopped without leaving a timer", () => {
  const documentRef = createTestDocument();
  const shell = createCreationCardLoading("generating", documentRef, { key: "item-5" });
  const nodes = shell.__generationLoadingNodes;
  assert.ok(nodes.timer !== null);
  stopCreationCardLoading(shell);
  assert.equal(nodes.timer, null);
  assert.equal(nodes.active, false);
});

test("queued creation card loading waits without advancing a percentage", () => {
  const documentRef = createTestDocument();
  const shell = createCreationCardLoading("queued", documentRef, { key: "item-6" });
  const nodes = shell.__generationLoadingNodes;

  assert.equal(shell.dataset.generationLoadingMode, "waiting");
  assert.equal(nodes.timer, null);
  assert.equal(shell.querySelector(".generation-loading-percent").textContent, "");
  assert.equal(shell.querySelector(".generation-loading-label").textContent, "排队等待中");

  updateCreationCardLoading(shell, "generating", { key: "item-6" });
  assert.equal(shell.dataset.generationLoadingMode, "generating");
  assert.ok(nodes.timer !== null);
  assert.equal(shell.querySelector(".generation-loading-percent").textContent, "0%");
  assert.equal(shell.querySelector(".generation-loading-label").textContent, "生图生成中");
  stopCreationCardLoading(shell);
});

test("creation card fallback DOM keys stay unique when titles repeat", () => {
  assert.equal(getCreationCardDomKey({ itemId: "item-1", title: "Repeated" }, 3), "item-1");
  assert.notEqual(
    getCreationCardDomKey({ title: "Repeated" }, 0),
    getCreationCardDomKey({ title: "Repeated" }, 1),
  );
});

test("loading card refresh applies the legacy second-slot display title without mutating the item", () => {
  const documentRef = createTestDocument();
  const card = documentRef.createElement("article");
  card.className = "creation-card";
  card.classList = { toggle() {} };
  const title = documentRef.createElement("strong");
  title.dataset.creationCardTitle = "true";
  const status = documentRef.createElement("span");
  status.dataset.creationCardStatus = "true";
  const media = documentRef.createElement("div");
  media.classList = { add() {}, toggle() {} };
  media.dataset.creationCardMedia = "true";
  media.appendChild(createCreationCardLoading("queued", documentRef));
  card.append(title, status, media);
  const item = { itemId: "universal:benefit-proof", slotIndex: 2, role: "usage-suggestion", title: "卖点图", status: "queued" };

  const result = syncCreationLoadingCard(card, item, 1, {
    getFallbackTitle: () => "卖点图",
    getStatusLabel: () => "排队中",
    shouldShowLoading: () => true,
  });

  assert.equal(result, card);
  assert.equal(title.textContent, "目标人群共鸣图");
  assert.equal(item.title, "卖点图");
});

test("creation result grid removes an old keyed card when replacing it", () => {
  const documentRef = createTestDocument();
  const grid = documentRef.createElement("div");
  const oldCard = documentRef.createElement("article");
  oldCard.className = "creation-card";
  oldCard.dataset.creationCardKey = "item-1";
  grid.appendChild(oldCard);

  const replacementCard = documentRef.createElement("article");
  replacementCard.className = "creation-card";
  replacementCard.dataset.creationCardKey = "item-1";

  syncCreationResultGrid({
    grid,
    items: [{ itemId: "item-1", status: "completed" }],
    createCard: () => replacementCard,
    syncCard: () => null,
  });

  assert.deepEqual(grid.children, [replacementCard]);
  assert.equal(oldCard.parentElement, null);
});
