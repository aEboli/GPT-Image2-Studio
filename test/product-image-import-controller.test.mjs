import test from "node:test";
import assert from "node:assert/strict";

import {
  buildProductImagePreviewUrl,
  createProductImageImportController,
  fetchProductImageImportFiles,
  readProductImageImportClipboard,
  readProductImageImportPaste,
  selectProductImageImportIdsForAction,
} from "../lib/product-image-import-controller.mjs";
import { serializeProductImageImportManifest } from "../lib/product-image-import.mjs";

class FakeFile {
  constructor(parts, name, options = {}) {
    this.name = name;
    this.type = options.type || "";
    this.lastModified = options.lastModified ?? Date.now();
    this.size = parts.reduce((total, part) => total + Number(part?.size ?? part?.byteLength ?? 0), 0);
  }
}

class FakeDomElement {
  constructor() {
    this.attributes = {};
    this.children = [];
    this.classList = {
      values: new Set(),
      toggle: (name, force) => {
        const next = force === undefined ? !this.classList.values.has(name) : Boolean(force);
        if (next) this.classList.values.add(name);
        else this.classList.values.delete(name);
        return next;
      },
      contains: (name) => this.classList.values.has(name),
      add: (...names) => names.forEach((name) => this.classList.values.add(name)),
      remove: (...names) => names.forEach((name) => this.classList.values.delete(name)),
    };
    this.className = "";
    this.dataset = {};
    this.listeners = new Map();
    this.style = {};
    this.scrollTop = 0;
    this.scrollLeft = 0;
    this.clientWidth = 0;
    this.clientHeight = 0;
    this.naturalWidth = 0;
    this.naturalHeight = 0;
    this.pointerCaptureId = null;
    this.textContent = "";
    this.hidden = false;
    this.open = false;
  }

  addEventListener(type, listener) {
    const listeners = this.listeners.get(type) || [];
    listeners.push(listener);
    this.listeners.set(type, listeners);
  }

  append(...children) {
    this.children.push(...children);
  }

  appendChild(child) {
    this.children.push(child);
    return child;
  }

  dispatch(type, event = {}) {
    const nextEvent = { target: this, currentTarget: this, preventDefault() {}, stopPropagation() {}, ...event };
    for (const listener of this.listeners.get(type) || []) {
      nextEvent.currentTarget = this;
      listener(nextEvent);
    }
    return nextEvent;
  }

  replaceChildren(...children) {
    this.children = children;
  }

  removeAttribute(name) {
    delete this.attributes[name];
    delete this[name];
  }

  setAttribute(name, value) {
    this.attributes[name] = String(value);
  }

  focus() {}

  blur() {}

  getBoundingClientRect() {
    return { width: this.clientWidth, height: this.clientHeight, top: 0, left: 0, right: this.clientWidth, bottom: this.clientHeight };
  }

  setPointerCapture(pointerId) {
    this.pointerCaptureId = pointerId;
  }

  hasPointerCapture(pointerId) {
    return this.pointerCaptureId === pointerId;
  }

  releasePointerCapture(pointerId) {
    if (this.pointerCaptureId === pointerId) this.pointerCaptureId = null;
  }
}

class FakeImportDocument {
  constructor() {
    this.elements = new Map([
      "#productImageImportAvailableCount",
      "#productImageImportCancelButton",
      "#productImageImportCapacityCount",
      "#productImageImportCloseButton",
      "#productImageImportConfirmButton",
      "#productImageImportDialog",
      "#productImageImportFeedback",
      "#productImageImportGroups",
      "#productImageImportImageViewer",
      "#creationClipboardImportButton",
      "#productImageImportInvertButton",
      "[data-product-image-extension-action]",
      "#productImageImportProductTitle",
      "#productImageImportSelectAllButton",
      "#productImageImportSelectDetailButton",
      "#productImageImportSelectMainButton",
      "#productImageImportSelectNoneButton",
      "#productImageImportSelectSkuButton",
      "#productImageImportSelectedCount",
      "#globalActionToast",
      "#productImageImportViewerCloseButton",
      "#productImageImportViewerFitButton",
      "#productImageImportViewerImage",
      "#productImageImportViewerNextButton",
      "#productImageImportViewerOriginalSizeButton",
      "#productImageImportViewerPreviousButton",
      "#productImageImportViewerRotateLeftButton",
      "#productImageImportViewerRotateRightButton",
      "#productImageImportViewerStage",
      "#productImageImportViewerTitle",
      "#productImageImportViewerZoomInButton",
      "#productImageImportViewerZoomLabel",
      "#productImageImportViewerZoomOutButton",
    ].map((selector) => [selector, new FakeDomElement()]));
    this.documentListeners = new Map();
    this.body = new FakeDomElement();
    this.defaultView = new FakeDomElement();
    this.defaultView.getComputedStyle = () => ({ paddingLeft: "14px", paddingRight: "14px", paddingTop: "14px", paddingBottom: "58px" });
    const dialog = this.elements.get("#productImageImportDialog");
    dialog.showModal = () => { dialog.open = true; };
    dialog.close = () => { dialog.open = false; };
  }

  addEventListener(type, listener) {
    this.documentListeners.set(type, listener);
  }

  createElement() {
    return new FakeDomElement();
  }

  createElementNS() {
    return new FakeDomElement();
  }

  querySelector(selector) {
    return this.elements.get(selector) || null;
  }
}

function makeManifest() {
  return {
    version: 1,
    source: { platform: "1688", pageUrl: "https://detail.1688.com/offer/123.html" },
    product: { id: "123", title: "测试商品" },
    capturedAt: "2026-07-27T08:00:00.000Z",
    items: [
      { id: "main-1", category: "main", order: 1, url: "https://cbu01.alicdn.com/main.jpg", filename: "main.jpg", width: 800, height: 800, confidence: "high" },
      { id: "detail-1", category: "detail", order: 1, url: "https://cbu01.alicdn.com/detail.jpg", filename: "detail.jpg", width: 790, height: 1200, confidence: "high" },
      { id: "sku-1", category: "sku", order: 1, url: "https://cbu01.alicdn.com/sku.webp", filename: "sku.webp", width: 200, height: 200, confidence: "high", variantLabels: ["60cm", "68cm"], variantCount: 2 },
    ],
  };
}

test("clipboard import prefers the versioned manifest without reading native image items", async () => {
  let nativeReadCount = 0;
  const result = await readProductImageImportClipboard({
    clipboard: {
      async readText() { return serializeProductImageImportManifest(makeManifest()); },
      async read() { nativeReadCount += 1; return []; },
    },
    FileCtor: FakeFile,
  });

  assert.equal(result.kind, "manifest");
  assert.equal(result.manifest.items.length, 3);
  assert.deepEqual(result.manifest.items[2].variantLabels, ["60cm", "68cm"]);
  assert.equal(nativeReadCount, 0);
});

test("Creation paste recognizes a collector manifest without a second clipboard read", () => {
  const text = serializeProductImageImportManifest(makeManifest());
  const clipboardData = {
    getData(type) { return type === "text/plain" ? text : ""; },
  };

  const manifest = readProductImageImportPaste(clipboardData);
  assert.equal(manifest.items.length, 3);
  assert.equal(manifest.product.title, "测试商品");
  assert.equal(readProductImageImportPaste({ getData() { return "普通文本"; } }), null);
});

test("candidate thumbnails use the same-origin bounded product image endpoint", () => {
  const manifest = makeManifest();
  const previewUrl = new URL(buildProductImagePreviewUrl(manifest, manifest.items[0]), "http://127.0.0.1:4173");

  assert.equal(previewUrl.origin, "http://127.0.0.1:4173");
  assert.equal(previewUrl.pathname, "/api/product-image-collector/image");
  assert.equal(previewUrl.searchParams.get("sourcePageUrl"), manifest.source.pageUrl);
  assert.equal(previewUrl.searchParams.get("imageUrl"), manifest.items[0].url);
});

test("batch selection commands replace the selection without exceeding remaining capacity", () => {
  const items = [
    { id: "detail-2", category: "detail", order: 2 },
    { id: "main-2", category: "main", order: 2 },
    { id: "sku-1", category: "sku", order: 1 },
    { id: "detail-1", category: "detail", order: 1 },
    { id: "main-1", category: "main", order: 1 },
  ];

  assert.deepEqual(selectProductImageImportIdsForAction(items, [], "all", 3), [
    "main-1",
    "main-2",
    "sku-1",
  ]);
  assert.deepEqual(selectProductImageImportIdsForAction(items, [], "detail", 1), ["detail-1"]);
  assert.deepEqual(selectProductImageImportIdsForAction(items, ["main-1", "main-2"], "invert", 2), [
    "sku-1",
    "detail-1",
  ]);
  assert.deepEqual(selectProductImageImportIdsForAction(items, ["main-1", "detail-1"], "none", 3), []);
  assert.deepEqual(selectProductImageImportIdsForAction(items, [], "sku", 0), []);
});

test("Escape returns from an enlarged candidate without dismissing the import dialog", () => {
  const listeners = new Map();
  const dialog = {
    open: true,
    closeCalls: 0,
    addEventListener(type, listener) { listeners.set(type, listener); },
    close() { this.closeCalls += 1; this.open = false; },
  };
  const imageViewer = {
    hidden: false,
    setAttribute(name, value) { this[name] = value; },
  };
  const viewerImage = {
    alt: "放大预览",
    src: "/preview.png",
    removeAttribute(name) { delete this[name]; },
  };
  const nodes = new Map([
    ["#productImageImportDialog", dialog],
    ["#productImageImportImageViewer", imageViewer],
    ["#productImageImportViewerImage", viewerImage],
  ]);
  const controller = createProductImageImportController({
    documentRef: {
      addEventListener() {},
      querySelector(selector) { return nodes.get(selector) || null; },
    },
  });
  controller.bind();

  const previewEscape = {
    key: "Escape",
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  };
  listeners.get("keydown")(previewEscape);
  assert.equal(previewEscape.prevented, true);
  assert.equal(previewEscape.stopped, true);
  assert.equal(imageViewer.hidden, true);
  assert.equal(dialog.open, true);
  assert.equal(dialog.closeCalls, 0);

  const dialogEscape = {
    key: "Escape",
    prevented: false,
    stopped: false,
    preventDefault() { this.prevented = true; },
    stopPropagation() { this.stopped = true; },
  };
  listeners.get("keydown")(dialogEscape);
  assert.equal(dialogEscape.prevented, true);
  assert.equal(dialogEscape.stopped, true);
  assert.equal(dialog.open, true);
  assert.equal(dialog.closeCalls, 0);

  const nativeCancel = { prevented: false, preventDefault() { this.prevented = true; } };
  listeners.get("cancel")(nativeCancel);
  assert.equal(nativeCancel.prevented, true);
});

test("batch selection commands update existing cards without moving the candidate scroll position", () => {
  const documentRef = new FakeImportDocument();
  const controller = createProductImageImportController({
    documentRef,
    clipboard: {},
    getMaximumCount: () => 15,
    getRemainingCapacity: () => 15,
    applyFiles: () => ({}),
  });
  controller.bind();
  controller.openManifest(makeManifest());

  const groups = documentRef.querySelector("#productImageImportGroups");
  const firstCard = groups.children[0].children[1].children[0];
  const media = firstCard.children[0];
  const preview = media.children[1];
  const actionsRow = firstCard.children[1];
  assert.equal(preview.children[0].className, "product-image-import-thumbnail");
  assert.equal(preview.children[1].className, "product-image-import-preview-error");
  assert.equal(preview.children[1].hidden, true);
  assert.equal(actionsRow.children[0].className, "product-image-import-card-info");
  assert.equal(actionsRow.children[0].children[0].textContent, "主图 1");
  assert.equal(actionsRow.children[0].children[1].textContent, "800×800");
  assert.equal(actionsRow.children[1].className, "product-image-import-zoom-button");
  preview.children[0].dispatch("error");
  assert.equal(preview.classList.contains("is-error"), true);
  assert.equal(preview.children[1].hidden, false);
  const actions = [
    "#productImageImportSelectAllButton",
    "#productImageImportSelectNoneButton",
    "#productImageImportInvertButton",
    "#productImageImportSelectMainButton",
    "#productImageImportSelectDetailButton",
    "#productImageImportSelectSkuButton",
  ];
  for (const selector of actions) {
    const childrenBefore = groups.children.slice();
    groups.scrollTop = 640;
    documentRef.querySelector(selector).dispatch("click");
    assert.equal(groups.scrollTop, 640, `${selector} changed the candidate scroll position`);
    assert.deepEqual(groups.children, childrenBefore, `${selector} rebuilt the candidate list`);
  }
  documentRef.querySelector("#productImageImportSelectAllButton").dispatch("click");
  documentRef.querySelector("#productImageImportSelectNoneButton").dispatch("click");
  assert.equal(firstCard.classList.contains("is-selected"), false);
  assert.equal(media.children[0].checked, false);
});

test("candidate viewer mirrors the plugin controls while keeping the proxied source", () => {
  const documentRef = new FakeImportDocument();
  const viewer = documentRef.querySelector("#productImageImportImageViewer");
  const viewerStage = documentRef.querySelector("#productImageImportViewerStage");
  const viewerImage = documentRef.querySelector("#productImageImportViewerImage");
  viewerStage.clientWidth = 900;
  viewerStage.clientHeight = 600;
  viewerImage.naturalWidth = 1200;
  viewerImage.naturalHeight = 800;
  const controller = createProductImageImportController({
    documentRef,
    clipboard: {},
    getMaximumCount: () => 15,
    getRemainingCapacity: () => 15,
    applyFiles: () => ({}),
  });
  controller.bind();
  controller.openManifest(makeManifest());

  const firstCard = documentRef.querySelector("#productImageImportGroups").children[0].children[1].children[0];
  firstCard.children[1].children[1].dispatch("click");
  assert.equal(viewer.hidden, false);
  assert.match(viewerImage.src, /^\/api\/product-image-collector\/image\?/);
  viewerImage.dispatch("load");
  assert.match(viewerImage.style.transform, /rotate\(0deg\) scale\(0\.66/);

  documentRef.querySelector("#productImageImportViewerZoomInButton").dispatch("click", { detail: 1 });
  assert.match(viewerImage.style.transform, /scale\(0\.759/);
  documentRef.querySelector("#productImageImportViewerRotateRightButton").dispatch("click", { detail: 1 });
  assert.match(viewerImage.style.transform, /rotate\(90deg\) scale\(0\.44/);
  documentRef.querySelector("#productImageImportViewerOriginalSizeButton").dispatch("click", { detail: 1 });
  assert.match(viewerImage.style.transform, /translate3d\(0px, 0px, 0\) rotate\(0deg\) scale\(0\.66/);

  let wheelPrevented = false;
  viewerStage.dispatch("wheel", {
    deltaY: -100,
    preventDefault() { wheelPrevented = true; },
  });
  assert.equal(wheelPrevented, true);
  assert.match(viewerImage.style.transform, /scale\(0\.759/);

  viewerImage.dispatch("pointerdown", { button: 0, pointerId: 7, clientX: 0, clientY: 0 });
  documentRef.defaultView.dispatch("pointermove", { pointerId: 7, clientX: 500, clientY: 0 });
  documentRef.defaultView.dispatch("pointerup", { pointerId: 7 });
  assert.match(viewerImage.style.transform, /translate3d\(19px, 0px/);

  documentRef.querySelector("#productImageImportViewerNextButton").dispatch("click");
  assert.match(viewerImage.src, /imageUrl=https%3A%2F%2Fcbu01\.alicdn\.com%2Fdetail\.jpg/);
  assert.match(viewerImage.style.transform, /rotate\(0deg\) scale\(1\)/);

  const dialog = documentRef.querySelector("#productImageImportDialog");
  dialog.dispatch("keydown", { key: "Escape", preventDefault() {}, stopPropagation() {} });
  assert.equal(viewer.hidden, true);
  assert.equal(dialog.open, true);
});

test("clipboard import falls back to every readable native image item", async () => {
  const result = await readProductImageImportClipboard({
    clipboard: {
      async readText() { return "ordinary clipboard text"; },
      async read() {
        return [{
          types: ["image/png", "text/plain", "image/webp"],
          async getType(type) { return new Blob([type], { type }); },
        }];
      },
    },
    FileCtor: FakeFile,
  });

  assert.equal(result.kind, "files");
  assert.deepEqual(result.files.map((file) => [file.name, file.type]), [
    ["clipboard-image-01.png", "image/png"],
    ["clipboard-image-02.webp", "image/webp"],
  ]);
});

test("confirmed manifest images fetch sequentially and isolate item failures", async () => {
  const calls = [];
  let active = 0;
  let maxActive = 0;
  const result = await fetchProductImageImportFiles({
    manifest: makeManifest(),
    selectedIds: ["main-1", "detail-1", "sku-1"],
    FileCtor: FakeFile,
    async fetchImpl(_url, init) {
      const payload = JSON.parse(init.body);
      calls.push(payload.imageUrl);
      active += 1;
      maxActive = Math.max(maxActive, active);
      await Promise.resolve();
      active -= 1;
      if (payload.imageUrl.includes("detail")) {
        return new Response(JSON.stringify({ message: "详情图不可用" }), { status: 502, headers: { "content-type": "application/json" } });
      }
      return new Response(Uint8Array.from([1, 2, 3]), { status: 200, headers: { "content-type": payload.imageUrl.endsWith("webp") ? "image/webp" : "image/jpeg" } });
    },
  });

  assert.equal(maxActive, 1);
  assert.deepEqual(calls, [
    "https://cbu01.alicdn.com/main.jpg",
    "https://cbu01.alicdn.com/detail.jpg",
    "https://cbu01.alicdn.com/sku.webp",
  ]);
  assert.deepEqual(result.files.map((file) => file.name), ["main.jpg", "sku.webp"]);
  assert.equal(result.failures.length, 1);
  assert.match(result.failures[0].message, /详情图不可用/);
});
