import assert from "node:assert/strict";
import test from "node:test";
import { readFile } from "node:fs/promises";

import {
  createGenerationLoadingShell,
  getGenerationLoadingInterval,
  getGenerationLoadingProgress,
  stopGenerationLoadingShell,
  updateGenerationLoadingShell,
} from "../lib/generation-loading.mjs";
import { shouldReusePreviewLoadingShell } from "../lib/preview-loading-shell.mjs";
import { getPreviewPlaceholderState, isWaitingPreviewItem } from "../lib/preview-placeholder-state.mjs";

function createTestElement(tagName = "div", ownerDocument = null) {
  const element = {
    tagName: String(tagName).toUpperCase(),
    ownerDocument,
    children: [],
    className: "",
    dataset: {},
    attributes: new Map(),
    textContent: "",
    parentElement: null,
    style: {
      properties: new Map(),
      setProperty(name, value) {
        element.style.properties.set(name, String(value));
      },
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
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
    },
    getAttribute(name) {
      return element.attributes.get(name) || "";
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

function installScheduler() {
  const originalSetTimeout = globalThis.setTimeout;
  const originalClearTimeout = globalThis.clearTimeout;
  const pending = new Map();
  const delays = [];
  let nextId = 1;
  globalThis.setTimeout = (callback, delay) => {
    const id = nextId++;
    pending.set(id, callback);
    delays.push(Number(delay));
    return id;
  };
  globalThis.clearTimeout = (id) => {
    pending.delete(id);
  };
  return {
    pending,
    delays,
    runNext() {
      const entry = pending.entries().next().value;
      if (!entry) {
        return false;
      }
      pending.delete(entry[0]);
      entry[1]();
      return true;
    },
    restore() {
      globalThis.setTimeout = originalSetTimeout;
      globalThis.clearTimeout = originalClearTimeout;
    },
  };
}

test("preview loading uses one shared drop with an accessible percentage", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-1", active: true });
    assert.equal(nodes.shell.querySelectorAll(".generation-loading-drop").length, 1);
    assert.equal(nodes.shell.querySelectorAll(".generation-loading-percent").length, 1);
    assert.equal(nodes.percent.textContent, "0%");
    assert.equal(nodes.shell.getAttribute("aria-valuemin"), "0");
    assert.equal(nodes.shell.getAttribute("aria-valuemax"), "99");
    assert.equal(nodes.shell.getAttribute("aria-valuenow"), "0");
    assert.equal(scheduler.delays[0], 800);
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("preview loading advances one percent every 800 milliseconds below 20 percent", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-2", active: true });
    for (let step = 1; step <= 20; step += 1) {
      assert.equal(scheduler.runNext(), true);
      assert.equal(getGenerationLoadingProgress(nodes), step);
    }
    assert.equal(nodes.percent.textContent, "20%");
    assert.equal(scheduler.delays.slice(0, 20).every((delay) => delay === 800), true);
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("preview loading slows by 1500ms per additional 10 percent band", () => {
  assert.equal(getGenerationLoadingInterval(0), 800);
  assert.equal(getGenerationLoadingInterval(18), 800);
  assert.equal(getGenerationLoadingInterval(19), 800);
  assert.equal(getGenerationLoadingInterval(20), 2300);
  assert.equal(getGenerationLoadingInterval(29), 2300);
  assert.equal(getGenerationLoadingInterval(30), 3800);
  assert.equal(getGenerationLoadingInterval(39), 3800);
  assert.equal(getGenerationLoadingInterval(40), 5300);
  assert.equal(getGenerationLoadingInterval(89), 11300);
  assert.equal(getGenerationLoadingInterval(90), 12800);
  assert.equal(getGenerationLoadingInterval(98), 12800);
});

test("preview loading exposes the tick duration for a continuous water rise", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-rise", active: true });
    assert.equal(nodes.shell.style.properties.get("--generation-loading-rise-duration"), "800ms");
    nodes.progress = 25;
    updateGenerationLoadingShell(nodes, { key: "job-rise", active: true });
    assert.equal(nodes.shell.style.properties.get("--generation-loading-rise-duration"), "2300ms");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("preview loading renders a wave layer inside the water drop", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-wave", active: true });
    assert.equal(nodes.shell.querySelectorAll(".generation-loading-wave").length, 1);
    assert.equal(nodes.wave.parentElement, nodes.drop);
    assert.equal(nodes.wave.getAttribute("aria-hidden"), "true");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("preview and thumbnail loading shells share progress for the same key", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const preview = createGenerationLoadingShell(documentRef, { key: "job-shared", active: true });
    const thumbnail = createGenerationLoadingShell(documentRef, { key: "job-shared", active: true });
    assert.equal(scheduler.delays.length, 1);
    assert.equal(scheduler.runNext(), true);
    assert.equal(getGenerationLoadingProgress(preview), 1);
    assert.equal(getGenerationLoadingProgress(thumbnail), 1);
    assert.equal(preview.percent.textContent, thumbnail.percent.textContent);
    stopGenerationLoadingShell(preview);
    assert.equal(scheduler.pending.size, 1);
    stopGenerationLoadingShell(thumbnail);
    assert.equal(scheduler.pending.size, 0);
  } finally {
    scheduler.restore();
  }
});

test("preview loading caps at 99 percent and stops scheduling", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-3", active: true });
    nodes.progress = 98;
    updateGenerationLoadingShell(nodes, { key: "job-3", active: true });
    assert.equal(scheduler.runNext(), true);
    assert.equal(getGenerationLoadingProgress(nodes), 99);
    assert.equal(nodes.percent.textContent, "99%");
    assert.equal(nodes.timer, null);
    assert.equal(scheduler.pending.size, 0);
  } finally {
    scheduler.restore();
  }
});

test("preview loading resets when the generation key changes and stops cleanly", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-a", active: true });
    scheduler.runNext();
    updateGenerationLoadingShell(nodes, { key: "job-b", active: true });
    assert.equal(getGenerationLoadingProgress(nodes), 0);
    assert.equal(nodes.shell.dataset.generationLoadingKey, "job-b");
    stopGenerationLoadingShell(nodes);
    assert.equal(nodes.timer, null);
    assert.equal(nodes.active, false);
    assert.equal(scheduler.pending.size, 0);
  } finally {
    scheduler.restore();
  }
});

test("waiting loading shells never schedule a percentage tick", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-wait", active: true, mode: "waiting" });
    assert.equal(nodes.shell.dataset.generationLoadingMode, "waiting");
    assert.equal(nodes.timer, null);
    assert.equal(scheduler.pending.size, 0);
    assert.equal(nodes.percent.textContent, "");
    assert.equal(nodes.status.textContent, "排队等待中");
    assert.equal(nodes.shell.getAttribute("aria-label"), "排队等待中");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("waiting shells start from zero once the task begins generating", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-wait-2", active: true, mode: "waiting" });
    updateGenerationLoadingShell(nodes, { key: "job-wait-2", active: true, mode: "generating" });
    assert.equal(nodes.shell.dataset.generationLoadingMode, "generating");
    assert.equal(getGenerationLoadingProgress(nodes), 0);
    assert.equal(nodes.status.textContent, "生图生成中");
    assert.equal(scheduler.runNext(), true);
    assert.equal(getGenerationLoadingProgress(nodes), 1);
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("a generating shell switched back to waiting stops ticking and clears the percentage", () => {
  const documentRef = createTestDocument();
  const scheduler = installScheduler();
  try {
    const nodes = createGenerationLoadingShell(documentRef, { key: "job-wait-3", active: true });
    assert.equal(scheduler.runNext(), true);
    assert.equal(getGenerationLoadingProgress(nodes), 1);
    updateGenerationLoadingShell(nodes, { key: "job-wait-3", active: true, mode: "waiting" });
    assert.equal(nodes.timer, null);
    assert.equal(scheduler.pending.size, 0);
    assert.equal(getGenerationLoadingProgress(nodes), 0);
    assert.equal(nodes.percent.textContent, "");
    stopGenerationLoadingShell(nodes);
  } finally {
    scheduler.restore();
  }
});

test("queued prompt items are reported as waiting previews", () => {
  assert.equal(isWaitingPreviewItem({ statusStage: "queued" }), true);
  assert.equal(isWaitingPreviewItem({ statusStage: "queued", started: true }), false);
  assert.equal(isWaitingPreviewItem({ statusStage: "queued", isRunning: true }), false);
  assert.equal(isWaitingPreviewItem({ statusStage: "generating" }), false);
  assert.equal(isWaitingPreviewItem({}), false);
  assert.equal(getPreviewPlaceholderState({ item: { id: "job-q", statusStage: "queued" } }).waiting, true);
  assert.equal(getPreviewPlaceholderState({ item: { id: "job-g", statusStage: "generating" } }).waiting, false);
});

test("queue and thumbnail strips separate adjacent same-footprint entries", async () => {
  const styles = await readFile(new URL("../public/styles.css", import.meta.url), "utf8");
  assert.match(styles, /\.creation-queue-item \+ \.creation-queue-item::before\s*\{[\s\S]*background:/);
  assert.match(styles, /\.filmstrip-entry \+ \.filmstrip-entry::before\s*\{[\s\S]*background:/);
  assert.match(styles, /\.generation-loading-shell\[data-generation-loading-mode="waiting"\]/);
  assert.match(styles, /@keyframes generation-loading-waiting-pulse/);
});

test("preview loading shell reuse is limited to the same active generation", () => {
  assert.equal(shouldReusePreviewLoadingShell({ mode: "loading", loadingKey: "same" }, { mode: "loading", loadingKey: "same" }), true);
  assert.equal(shouldReusePreviewLoadingShell({ mode: "loading", loadingKey: "old" }, { mode: "loading", loadingKey: "new" }), false);
  assert.equal(shouldReusePreviewLoadingShell({ mode: "ready" }, { mode: "loading" }), false);
});

test("preview placeholder exposes a stable loading key", () => {
  const state = getPreviewPlaceholderState({ item: { id: "job-42", statusStage: "generating" } });
  assert.equal(state.mode, "loading");
  assert.equal(state.loadingKey, "job-42");
});

test("app and stylesheet no longer contain the removed multi-layer generation animations", async () => {
  const [app, styles] = await Promise.all([
    readFile(new URL("../public/app.js", import.meta.url), "utf8"),
    readFile(new URL("../public/styles.css", import.meta.url), "utf8"),
  ]);
  assert.match(app, /createGenerationLoadingShell\(document/);
  assert.doesNotMatch(app, /createPreviewMotionNode|preview-loading-orb-field|quick-blend-thumb-loader/);
  assert.match(styles, /\.generation-loading-drop\s*\{/);
  assert.match(styles, /@keyframes generation-loading-breathe/);
  assert.match(styles, /\.generation-loading-wave\s*\{[\s\S]*bottom:\s*calc\(var\(--generation-loading-progress\)/);
  assert.match(styles, /@keyframes generation-loading-wave-drift/);
  assert.match(styles, /@keyframes generation-loading-water-bubbles/);
  assert.match(styles, /@property --generation-loading-progress\s*\{[\s\S]*syntax:\s*"<percentage>"/);
  assert.match(
    styles,
    /\.generation-loading-shell\s*\{[\s\S]*transition:\s*--generation-loading-progress var\(--generation-loading-rise-duration,\s*800ms\) linear/,
  );
  assert.doesNotMatch(styles, /preview-loading-orb-field|preview-loading-fluid|creation-card-loading-sketch|quick-blend-thumb-loader|image-edit-spin|image-decomposition-spin/);
});
