import assert from "node:assert/strict";
import test from "node:test";

import {
  createCreationCardLoading,
  getCreationCardDomKey,
  renderCreationCardLoading,
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
    className: "",
    textContent: "",
    parentElement: null,
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

test("creation card loading shell updates status without rendering loading copy", () => {
  const documentRef = createTestDocument();
  const shell = createCreationCardLoading("queued", documentRef);
  const motion = shell.querySelector(".creation-card-loading-motion");
  const sketch = shell.querySelector(".creation-card-loading-sketch-ring");

  updateCreationCardLoading(shell, "generating");

  assert.equal(shell.dataset.creationCardLoadingStatus, "generating");
  assert.equal(shell.querySelector(".creation-card-loading-motion"), motion);
  assert.equal(shell.querySelector(".creation-card-loading-sketch-ring"), sketch);
  assert.equal(shell.querySelector("[data-creation-card-loading-label]"), null);
  assert.equal(shell.querySelector("[data-creation-card-loading-detail]"), null);
  assert.doesNotMatch(collectTextContent(shell), /生成中|正在生成|第\s*1\s*张/);
});

test("creation card loading renderer reuses the host child across rerenders", () => {
  const documentRef = createTestDocument();
  const host = documentRef.createElement("div");

  const first = renderCreationCardLoading(host, "queued", documentRef);
  const firstMotion = first.querySelector(".creation-card-loading-motion");
  const second = renderCreationCardLoading(host, "generating", documentRef);

  assert.equal(second, first);
  assert.equal(host.children.length, 1);
  assert.equal(second.querySelector(".creation-card-loading-motion"), firstMotion);
  assert.equal(second.dataset.creationCardLoadingStatus, "generating");
});

test("creation card loading shell exposes a centered order inside hand-drawn ring loading", () => {
  const documentRef = createTestDocument();
  const shell = createCreationCardLoading("generating", documentRef, { sequenceIndex: 2 });
  const order = shell.querySelector("[data-creation-card-loading-order-label]");

  assert.equal(shell.dataset.creationCardLoadingOrder, "3");
  assert.equal(order.textContent, "03");
  assert.equal(order.parentElement, shell.querySelector(".creation-card-loading-sketch-ring"));
  assert.equal(shell.querySelectorAll(".creation-card-loading-sequence-dot").length, 0);
  assert.equal(shell.querySelectorAll(".creation-card-loading-sketch-line").length, 4);
  assert.equal(shell.querySelector(".creation-card-loading-track"), null);
  assert.equal(shell.querySelector(".creation-card-loading-progress"), null);
  assert.equal(shell.querySelector(".creation-card-loading-signal"), null);
  assert.equal(shell.querySelector("[data-creation-card-loading-detail]"), null);
  assert.doesNotMatch(collectTextContent(shell), /生成中|正在生成|第\s*3\s*张/);
});

test("queued creation card loading uses a separate floating waiting mark", () => {
  const documentRef = createTestDocument();
  const shell = createCreationCardLoading("queued", documentRef, { sequenceIndex: 15 });
  const waitingMark = shell.querySelector(".creation-card-loading-waiting-mark");

  assert.equal(shell.dataset.creationCardLoadingStatus, "queued");
  assert.ok(waitingMark);
  assert.equal(waitingMark.getAttribute("aria-hidden"), "true");
  assert.equal(shell.querySelectorAll(".creation-card-loading-waiting-line").length, 3);
  assert.equal(shell.querySelector("[data-creation-card-loading-label]"), null);
  assert.equal(shell.querySelector("[data-creation-card-loading-detail]"), null);
  assert.doesNotMatch(collectTextContent(shell), /排队中|等待并发槽位|第\s*16\s*张/);
});

test("creation card loading shell advances order without replacing hand-drawn ring nodes", () => {
  const documentRef = createTestDocument();
  const shell = createCreationCardLoading("queued", documentRef, { sequenceIndex: 0 });
  const motion = shell.querySelector(".creation-card-loading-motion");
  const sketch = shell.querySelector(".creation-card-loading-sketch-ring");
  const line = shell.querySelector(".creation-card-loading-sketch-line");

  updateCreationCardLoading(shell, "generating", { sequenceIndex: 3 });

  assert.equal(shell.querySelector(".creation-card-loading-motion"), motion);
  assert.equal(shell.querySelector(".creation-card-loading-sketch-ring"), sketch);
  assert.equal(shell.querySelector(".creation-card-loading-sketch-line"), line);
  assert.equal(shell.dataset.creationCardLoadingOrder, "4");
});

test("creation card fallback DOM keys stay unique when titles repeat", () => {
  assert.equal(getCreationCardDomKey({ itemId: "item-1", title: "Repeated" }, 3), "item-1");
  assert.notEqual(
    getCreationCardDomKey({ title: "Repeated" }, 0),
    getCreationCardDomKey({ title: "Repeated" }, 1),
  );
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
