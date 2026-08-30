import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  DISABLED_SHAKE_CLASS,
  DISABLED_SHAKE_DURATION_MS,
  DISABLED_SHAKE_HIT_TEST_SELECTOR,
  DISABLED_SHAKE_TARGET_SELECTOR,
  createDisabledShakeController,
  resolveDisabledShakeTarget,
} from "../lib/disabled-shake.mjs";

const appPath = new URL("../public/app.js", import.meta.url);
const indexPath = new URL("../public/index.html", import.meta.url);
const stylesPath = new URL("../public/styles.css", import.meta.url);
const syncScriptPath = new URL("../scripts/sync-public-lib.mjs", import.meta.url);
const libModulePath = new URL("../lib/disabled-shake.mjs", import.meta.url);
const publicModulePath = new URL("../public/lib/disabled-shake.mjs", import.meta.url);

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

function selectorParts(selector) {
  return selector.split(",").map((part) => part.trim()).filter(Boolean);
}

/* 只支持「整条选择器字面量相等」的最小 DOM 替身：足够验证 closest 上溯与矩形命中测试的
   取舍逻辑，真实选择器是否写对由 Electron 探针与浏览器验证。 */
function createNode({ id = "node", matches = [], rect = null, children = [] } = {}) {
  const node = {
    id,
    classList: createClassList(),
    matchedSelectors: matches,
    parentNode: null,
    childNodes: children,
    offsetWidth: 1,
    getBoundingClientRect() {
      return rect || { left: 0, top: 0, right: 0, bottom: 0, width: 0, height: 0 };
    },
    closest(selector) {
      const parts = selectorParts(selector);
      let cursor = node;
      while (cursor) {
        if (cursor.matchedSelectors.some((own) => parts.includes(own))) {
          return cursor;
        }
        cursor = cursor.parentNode;
      }
      return null;
    },
    querySelectorAll(selector) {
      const parts = selectorParts(selector);
      const found = [];
      const walk = (current) => {
        for (const child of current.childNodes) {
          if (child.matchedSelectors.some((own) => parts.includes(own))) {
            found.push(child);
          }
          walk(child);
        }
      };
      walk(node);
      return found;
    },
  };
  children.forEach((child) => {
    child.parentNode = node;
  });
  return node;
}

function createDocumentRoot() {
  const listeners = [];
  const removed = [];

  return {
    addEventListener(type, listener, options) {
      listeners.push({ type, listener, options });
    },
    removeEventListener(type, listener, options) {
      removed.push({ type, listener, options });
    },
    dispatch(type, event) {
      listeners
        .filter((entry) => entry.type === type)
        .forEach((entry) => entry.listener(event));
    },
    getListeners() {
      return listeners;
    },
    getRemoved() {
      return removed;
    },
  };
}

function rectAround(left, top, width, height) {
  return { left, top, right: left + width, bottom: top + height, width, height };
}

test("resolves the disabled control when the pointer lands on its inner icon", () => {
  const icon = createNode({ id: "icon" });
  const button = createNode({ id: "button", matches: ["button:disabled"], children: [icon] });

  assert.equal(resolveDisabledShakeTarget({ target: icon }), button);
});

test("finds a pointer-events:none control by rect when the event retargets to its wrapper", () => {
  const button = createNode({
    id: "toolbar",
    matches: [".toolbar-button:disabled"],
    rect: rectAround(100, 200, 120, 40),
  });
  const wrapper = createNode({ id: "wrapper", children: [button] });

  assert.equal(resolveDisabledShakeTarget({ target: wrapper, clientX: 150, clientY: 220 }), button);
  assert.equal(resolveDisabledShakeTarget({ target: wrapper, clientX: 400, clientY: 220 }), null);
});

test("prefers the innermost disabled control when nested rects both contain the pointer", () => {
  const inner = createNode({
    id: "inner",
    matches: [".toolbar-button:disabled"],
    rect: rectAround(100, 200, 40, 20),
  });
  const outer = createNode({
    id: "outer",
    matches: [".toolbar-button.disabled"],
    rect: rectAround(90, 190, 200, 60),
    children: [inner],
  });
  const wrapper = createNode({ id: "wrapper", children: [outer] });

  assert.equal(resolveDisabledShakeTarget({ target: wrapper, clientX: 110, clientY: 205 }), inner);
});

test("ignores enabled controls and zero-sized candidates", () => {
  const enabled = createNode({ id: "enabled", matches: ["button"] });
  assert.equal(resolveDisabledShakeTarget({ target: enabled, clientX: 0, clientY: 0 }), null);

  const collapsed = createNode({ id: "collapsed", matches: [".toolbar-button:disabled"] });
  const wrapper = createNode({ id: "wrapper", children: [collapsed] });
  assert.equal(resolveDisabledShakeTarget({ target: wrapper, clientX: 0, clientY: 0 }), null);
});

test("shakes on pointerdown, replays on a repeat click, and clears after the animation window", () => {
  const timers = createTimerHarness();
  const documentRoot = createDocumentRoot();
  const button = createNode({ id: "button", matches: ["button:disabled"] });
  const controller = createDisabledShakeController({
    documentRoot,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });

  controller.bind();
  assert.deepEqual(
    documentRoot.getListeners().map((entry) => [entry.type, entry.options]),
    [["pointerdown", true]],
    "禁用控件只会派发 pointerdown，且必须在捕获阶段拿到",
  );

  documentRoot.dispatch("pointerdown", { target: button, button: 0 });
  assert.ok(button.classList.contains(DISABLED_SHAKE_CLASS));
  assert.equal(timers.count(DISABLED_SHAKE_DURATION_MS), 1);

  documentRoot.dispatch("pointerdown", { target: button, button: 0 });
  assert.ok(button.classList.contains(DISABLED_SHAKE_CLASS));
  assert.equal(timers.count(DISABLED_SHAKE_DURATION_MS), 1, "连点不能堆叠清理定时器");

  timers.runNext(DISABLED_SHAKE_DURATION_MS);
  assert.equal(button.classList.contains(DISABLED_SHAKE_CLASS), false);
  assert.equal(timers.size(), 0);

  controller.destroy();
  assert.deepEqual(
    documentRoot.getRemoved().map((entry) => [entry.type, entry.options]),
    [["pointerdown", true]],
  );
});

test("ignores non-primary pointer buttons and clears an in-flight shake on destroy", () => {
  const timers = createTimerHarness();
  const documentRoot = createDocumentRoot();
  const button = createNode({ id: "button", matches: ["button:disabled"] });
  const controller = createDisabledShakeController({
    documentRoot,
    setTimeoutFn: timers.setTimeoutFn,
    clearTimeoutFn: timers.clearTimeoutFn,
  });
  controller.bind();

  documentRoot.dispatch("pointerdown", { target: button, button: 2 });
  assert.equal(button.classList.contains(DISABLED_SHAKE_CLASS), false);

  documentRoot.dispatch("pointerdown", { target: button, button: 0 });
  assert.ok(button.classList.contains(DISABLED_SHAKE_CLASS));

  controller.destroy();
  assert.equal(button.classList.contains(DISABLED_SHAKE_CLASS), false);
  assert.equal(timers.size(), 0);
});

test("browser shell wires the controller and styles a layout-neutral, reduced-motion-safe shake", async () => {
  const [app, index, styles] = await Promise.all([
    readFile(appPath, "utf8"),
    readFile(indexPath, "utf8"),
    readFile(stylesPath, "utf8"),
  ]);

  assert.match(app, /import \{ createDisabledShakeController \} from "\/lib\/disabled-shake\.mjs";/);
  assert.match(app, /const disabledShakeController = createDisabledShakeController\(\);/);
  assert.match(app, /disabledShakeController\.bind\(\);/);

  const rule = styles.match(new RegExp(`\\.${DISABLED_SHAKE_CLASS} \\{[^}]*\\}`))?.[0] || "";
  assert.ok(rule, "抖动状态类必须有样式规则");
  assert.match(rule, /--control-disabled-shake-distance:\s*8px;/);
  assert.match(rule, new RegExp(`animation:\\s*control-disabled-shake\\s+${DISABLED_SHAKE_DURATION_MS}ms\\s+ease-out;`));
  assert.doesNotMatch(rule, /\b(?:width|height|margin|padding|inset|top|left|right|bottom):/);

  const frames = styles.match(/@keyframes control-disabled-shake \{[\s\S]*?\r?\n\}/)?.[0] || "";
  assert.ok(frames, "抖动关键帧必须存在");
  const transforms = frames.match(/transform:[^;]+;/g) || [];
  assert.equal(transforms.length, 9, "9 个关键帧停顿点");
  transforms.forEach((declaration) => {
    assert.match(declaration, /,\s*0,\s*0\);$/, "抖动只能是横向位移");
  });
  assert.doesNotMatch(frames, /translateY|scale|rotate|opacity|filter/);
  assert.match(frames, /0% \{\r?\n\s*transform: translate3d\(0, 0, 0\);/);
  assert.match(frames, /100% \{\r?\n\s*transform: translate3d\(0, 0, 0\);/);

  assert.match(
    styles,
    new RegExp(`@media \\(prefers-reduced-motion: reduce\\) \\{\\r?\\n\\s*\\.${DISABLED_SHAKE_CLASS} \\{\\r?\\n\\s*animation: none;`),
  );
  assert.match(index, /styles\.css\?v=20260830-temu-workbench-1/);
  assert.match(index, /app\.js\?v=20260830-temu-workbench-1/);
});

test("the hit-test list stays in step with the stylesheet rules that swallow pointer events", async () => {
  const [styles, syncScript, libSource, publicSource] = await Promise.all([
    readFile(stylesPath, "utf8"),
    readFile(syncScriptPath, "utf8"),
    readFile(libModulePath, "utf8"),
    readFile(publicModulePath, "utf8"),
  ]);

  assert.deepEqual(selectorParts(DISABLED_SHAKE_HIT_TEST_SELECTOR), [
    ".toolbar-button:disabled",
    ".toolbar-button.disabled",
    ".product-image-import-zoom-button:disabled",
    ".creation-record-card-actions .mini-action.is-disabled",
  ]);
  assert.match(styles, /\.toolbar-button\.disabled,\s*\.toolbar-button:disabled \{[^}]*pointer-events: none;/);
  assert.match(styles, /\.product-image-import-zoom-button:disabled \{[^}]*pointer-events: none;/);
  assert.match(styles, /\.creation-record-card-actions \.mini-action\.is-disabled \{[^}]*pointer-events: none;/);

  for (const selector of ["button:disabled", 'a[aria-disabled="true"]', 'button[aria-disabled="true"]', "a.disabled"]) {
    assert.ok(selectorParts(DISABLED_SHAKE_TARGET_SELECTOR).includes(selector), `缺少禁用选择器 ${selector}`);
  }

  assert.match(syncScript, /"disabled-shake\.mjs",/);
  assert.equal(publicSource, libSource, "public/lib 是逐字节镜像");
});

