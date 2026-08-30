import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  CREATION_CARD_IDLE_RIPPLE_DELAY_MS,
  CREATION_CARD_IDLE_RIPPLE_DURATION_MS,
  CREATION_CARD_IDLE_RIPPLE_SELECTOR,
  createCreationCardIdleRippleController,
} from "../lib/creation-card-idle-ripple.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);

function createClassList() {
  const values = new Set();
  return {
    add: (...names) => names.forEach((name) => values.add(name)),
    contains: (name) => values.has(name),
    remove: (...names) => names.forEach((name) => values.delete(name)),
  };
}

function createTimerHarness() {
  let nextId = 1;
  const timers = new Map();

  return {
    clearTimeoutFn(id) {
      timers.delete(id);
    },
    count(delay) {
      return [...timers.values()].filter((timer) => timer.delay === delay).length;
    },
    runNext(delay) {
      const match = [...timers.entries()].find(([, timer]) => timer.delay === delay);
      assert.ok(match, `expected a pending ${delay}ms timer`);
      const [id, timer] = match;
      timers.delete(id);
      timer.callback();
    },
    setTimeoutFn(callback, delay) {
      const id = nextId;
      nextId += 1;
      timers.set(id, { callback, delay });
      return id;
    },
    size() {
      return timers.size;
    },
  };
}

function createDocumentRoot() {
  const listeners = new Map();
  const queries = [];
  let hoveredCard = null;

  return {
    addEventListener(type, listener, options) {
      listeners.set(type, { listener, options });
    },
    dispatchPointerMove() {
      listeners.get("pointermove")?.listener({ type: "pointermove" });
    },
    getListener(type) {
      return listeners.get(type) || null;
    },
    queries,
    querySelector(selector) {
      queries.push(selector);
      return hoveredCard;
    },
    removeEventListener(type, listener) {
      if (listeners.get(type)?.listener === listener) {
        listeners.delete(type);
      }
    },
    setHoveredCard(card) {
      hoveredCard = card;
    },
  };
}

test("creation card idle ripple starts at 30 seconds and repeats while the pointer stays still", () => {
  const timers = createTimerHarness();
  const documentRoot = createDocumentRoot();
  const card = { classList: createClassList() };
  documentRoot.setHoveredCard(card);
  const controller = createCreationCardIdleRippleController({
    documentRoot,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  controller.bind();

  assert.equal(CREATION_CARD_IDLE_RIPPLE_DELAY_MS, 30_000);
  assert.equal(CREATION_CARD_IDLE_RIPPLE_DURATION_MS, 1_200);
  assert.equal(timers.count(CREATION_CARD_IDLE_RIPPLE_DELAY_MS), 1);
  assert.equal(documentRoot.getListener("pointermove")?.options?.passive, true);

  timers.runNext(CREATION_CARD_IDLE_RIPPLE_DELAY_MS);

  assert.equal(card.classList.contains("is-idle-rippling"), true);
  assert.deepEqual(documentRoot.queries, [CREATION_CARD_IDLE_RIPPLE_SELECTOR]);
  assert.equal(timers.count(CREATION_CARD_IDLE_RIPPLE_DURATION_MS), 1);
  assert.equal(timers.count(CREATION_CARD_IDLE_RIPPLE_DELAY_MS), 1);

  timers.runNext(CREATION_CARD_IDLE_RIPPLE_DURATION_MS);
  assert.equal(card.classList.contains("is-idle-rippling"), false);

  timers.runNext(CREATION_CARD_IDLE_RIPPLE_DELAY_MS);
  assert.equal(card.classList.contains("is-idle-rippling"), true);

  controller.destroy();
  assert.equal(card.classList.contains("is-idle-rippling"), false);
  assert.equal(documentRoot.getListener("pointermove"), null);
  assert.equal(timers.size(), 0);
});

test("pointer movement cancels an active ripple and restarts the full idle interval", () => {
  const timers = createTimerHarness();
  const documentRoot = createDocumentRoot();
  const card = { classList: createClassList() };
  documentRoot.setHoveredCard(card);
  const controller = createCreationCardIdleRippleController({
    documentRoot,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  controller.bind();
  timers.runNext(CREATION_CARD_IDLE_RIPPLE_DELAY_MS);
  assert.equal(card.classList.contains("is-idle-rippling"), true);

  documentRoot.dispatchPointerMove();

  assert.equal(card.classList.contains("is-idle-rippling"), false);
  assert.equal(timers.size(), 1);
  assert.equal(timers.count(CREATION_CARD_IDLE_RIPPLE_DELAY_MS), 1);

  controller.destroy();
});

test("idle expiry without a hovered Creation card keeps waiting without adding a ripple", () => {
  const timers = createTimerHarness();
  const documentRoot = createDocumentRoot();
  const controller = createCreationCardIdleRippleController({
    documentRoot,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  controller.bind();
  timers.runNext(CREATION_CARD_IDLE_RIPPLE_DELAY_MS);

  assert.deepEqual(documentRoot.queries, [CREATION_CARD_IDLE_RIPPLE_SELECTOR]);
  assert.equal(timers.size(), 1);
  assert.equal(timers.count(CREATION_CARD_IDLE_RIPPLE_DELAY_MS), 1);

  controller.destroy();
});

test("browser shell wires the controller and exposes a layout-neutral reduced-motion ripple", async () => {
  const [app, index, styles] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(indexPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(app, /import \{ createCreationCardIdleRippleController \} from "\/lib\/creation-card-idle-ripple\.mjs\?v=20260725-creation-card-idle-ripple-1";/);
  assert.match(app, /const creationCardIdleRippleController = createCreationCardIdleRippleController\(\);/);
  assert.match(app, /creationCardIdleRippleController\.bind\(\);/);
  assert.match(styles, /\.creation-card\.is-idle-rippling::after\s*\{[\s\S]*position:\s*absolute;[\s\S]*pointer-events:\s*none;[\s\S]*animation:\s*creation-card-idle-ripple\s+1200ms\s+ease-out\s+both;/);
  assert.match(styles, /@keyframes\s+creation-card-idle-ripple\s*\{[\s\S]*inset:\s*-2px;[\s\S]*inset:\s*-12px;/);
  assert.match(styles, /@media\s*\(prefers-reduced-motion:\s*reduce\)[\s\S]*\.creation-card\.is-idle-rippling::after\s*\{[\s\S]*content:\s*none;/);
  assert.doesNotMatch(styles.match(/\.creation-card\.is-idle-rippling::after\s*\{[\s\S]*?\}/)?.[0] || "", /\b(?:width|height|margin|padding):/);
  assert.match(index, /styles\.css\?v=20260830-temu-workbench-1/);
  assert.match(index, /app\.js\?v=20260830-temu-workbench-1/);
});
