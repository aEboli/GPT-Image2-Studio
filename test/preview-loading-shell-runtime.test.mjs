import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getPreviewLoadingOrbLimit,
  getPreviewLoadingOrbRenderState,
  getPreviewLoadingShellItems,
  getPreviewLoadingShellTheme,
} from "../lib/preview-loading-shell.mjs";
import { getPreviewPlaceholderState } from "../lib/preview-placeholder-state.mjs";

const appPath = new URL("../public/app.js", import.meta.url);

function extractFunctionBefore(source, functionName, nextFunctionName) {
  const start = source.indexOf(`function ${functionName}`);
  const end = source.indexOf(`function ${nextFunctionName}`, start + 1);
  assert.notEqual(start, -1, `${functionName} should exist`);
  assert.notEqual(end, -1, `${nextFunctionName} should follow ${functionName}`);
  return source.slice(start, end).trimEnd();
}

function createTestElement(tagName = "div") {
  const element = {
    tagName: String(tagName).toUpperCase(),
    children: [],
    className: "",
    dataset: {},
    style: {
      properties: new Map(),
      setProperty(name, value) {
        element.style.properties.set(name, String(value));
      },
    },
    attributes: new Map(),
    classList: {
      add(...names) {
        const current = new Set(String(element.className || "").split(/\s+/).filter(Boolean));
        names.forEach((name) => current.add(String(name)));
        element.className = Array.from(current).join(" ");
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
      toggle(name, force) {
        const shouldAdd = force === undefined ? !element.classList.contains(name) : Boolean(force);
        if (shouldAdd) {
          element.classList.add(name);
        } else {
          element.classList.remove(name);
        }
        return shouldAdd;
      },
    },
    appendChild(child) {
      if (child.parentNode && child.parentNode !== element) {
        child.parentNode.removeChild(child);
      }
      child.parentNode = element;
      element.children.push(child);
      return child;
    },
    append(...nodes) {
      nodes.forEach((node) => element.appendChild(node));
    },
    removeChild(child) {
      element.children = element.children.filter((node) => node !== child);
      child.parentNode = null;
      return child;
    },
    remove() {
      if (element.parentNode) {
        element.parentNode.removeChild(element);
      }
    },
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
    },
  };
  return element;
}

function parsePixelValue(value) {
  return Number.parseFloat(String(value || "0").replace(/px$/, ""));
}

function getPointDistance(left, right) {
  return Math.hypot(parsePixelValue(left.x) - parsePixelValue(right.x), parsePixelValue(left.y) - parsePixelValue(right.y));
}

test("preview loading shell can be created before any preview item exists", async () => {
  const app = await readFile(appPath, "utf8");
  const loadingShellRuntime = extractFunctionBefore(app, "createPreviewMotionNode", "renderPreviewPlaceholder");
  const document = {
    createElement: createTestElement,
  };
  const createNodes = new Function(
    "document",
    `${loadingShellRuntime}\nreturn createPreviewLoadingShellNodes();`,
  );

  assert.doesNotThrow(() => createNodes(document));
});

test("preview loading shell renders only motion nodes without visible copy", async () => {
  const app = await readFile(appPath, "utf8");
  const loadingShellRuntime = extractFunctionBefore(app, "createPreviewMotionNode", "renderPreviewPlaceholder");
  const document = {
    createElement: createTestElement,
  };
  const createNodes = new Function(
    "document",
    `${loadingShellRuntime}\nreturn createPreviewLoadingShellNodes();`,
  );

  const nodes = createNodes(document);

  assert.equal(nodes.eyebrow, undefined);
  assert.equal(nodes.title, undefined);
  assert.equal(nodes.shell.children.length, 1);
  assert.equal(nodes.shell.children[0].className, "preview-loading-orb-field");
  assert.equal(nodes.shell.children[0].children.length, 1);
  assert.match(nodes.shell.children[0].children[0].className, /preview-loading-motion/);
});

test("preview loading shell shows one centered orb per active job up to six", async () => {
  const app = await readFile(appPath, "utf8");
  const loadingShellRuntime = extractFunctionBefore(app, "createPreviewMotionNode", "renderPreviewPlaceholder");
  const document = {
    createElement: createTestElement,
  };
  const createRuntime = new Function(
    "document",
    "getPreviewLoadingOrbLimit",
    "getPreviewLoadingShellItems",
    "getPreviewLoadingOrbRenderState",
    "getPreviewLoadingShellTheme",
    `${loadingShellRuntime}\nreturn { createPreviewLoadingShellNodes, updatePreviewLoadingShell };`,
  );
  const runtime = createRuntime(
    document,
    getPreviewLoadingOrbLimit,
    getPreviewLoadingShellItems,
    getPreviewLoadingOrbRenderState,
    getPreviewLoadingShellTheme,
  );
  const nodes = runtime.createPreviewLoadingShellNodes();

  runtime.updatePreviewLoadingShell(nodes, {
    mode: "loading",
    stage: "generating",
    stageIndex: 2,
    stageCount: 4,
    activeJobCount: 7,
    maxConcurrentTasks: 7,
    statusText: "7 jobs running",
    loadingItems: [
      { id: "job-1", statusStage: "uploading" },
      { id: "job-2", statusStage: "connecting" },
      { id: "job-3", statusStage: "generating" },
      { id: "job-4", statusStage: "saving" },
      { id: "job-5", statusStage: "generating" },
      { id: "job-6", statusStage: "connecting" },
      { id: "job-7", statusStage: "uploading" },
    ],
  });

  assert.equal(nodes.field.children.length, 6);
  assert.deepEqual(
    nodes.field.children.map((child) => child.dataset.previewLoadingOrbId),
    ["job-1", "job-2", "job-3", "job-4", "job-5", "job-6"],
  );
  assert.deepEqual(
    nodes.field.children.map((child) => child.dataset.stage),
    ["uploading", "connecting", "generating", "saving", "generating", "connecting"],
  );
  assert.equal(nodes.field.style.properties.get("--preview-loading-orb-count"), "6");
});

test("preview loading shell preserves existing orb nodes when a new job appears", async () => {
  const app = await readFile(appPath, "utf8");
  const loadingShellRuntime = extractFunctionBefore(app, "createPreviewMotionNode", "renderPreviewPlaceholder");
  const document = {
    createElement: createTestElement,
  };
  const createRuntime = new Function(
    "document",
    "getPreviewLoadingOrbLimit",
    "getPreviewLoadingShellItems",
    "getPreviewLoadingOrbRenderState",
    "getPreviewLoadingShellTheme",
    `${loadingShellRuntime}\nreturn { createPreviewLoadingShellNodes, updatePreviewLoadingShell };`,
  );
  const runtime = createRuntime(
    document,
    getPreviewLoadingOrbLimit,
    getPreviewLoadingShellItems,
    getPreviewLoadingOrbRenderState,
    getPreviewLoadingShellTheme,
  );
  const nodes = runtime.createPreviewLoadingShellNodes();
  const baseState = {
    mode: "loading",
    stage: "generating",
    stageIndex: 2,
    stageCount: 4,
    activeJobCount: 2,
    maxConcurrentTasks: 6,
    loadingItems: [
      { id: "job-a", statusStage: "connecting" },
      { id: "job-b", statusStage: "generating" },
    ],
  };

  runtime.updatePreviewLoadingShell(nodes, baseState);
  const firstOrb = nodes.field.children[0];
  const secondOrb = nodes.field.children[1];

  runtime.updatePreviewLoadingShell(nodes, {
    ...baseState,
    activeJobCount: 3,
    loadingItems: [
      { id: "job-a", statusStage: "generating" },
      { id: "job-b", statusStage: "saving" },
      { id: "job-c", statusStage: "uploading" },
    ],
  });

  assert.equal(nodes.field.children.length, 3);
  assert.equal(nodes.field.children[0], firstOrb);
  assert.equal(nodes.field.children[1], secondOrb);
  assert.equal(nodes.field.children[2].dataset.previewLoadingOrbId, "job-c");
  assert.ok(nodes.field.children[2].classList.contains("is-entering"));
});

test("preview loading shell spaces six visible orbs with collision-safe gaps", () => {
  const placeholderState = {
    mode: "loading",
    stage: "generating",
    stageIndex: 2,
    stageCount: 4,
    activeJobCount: 6,
    maxConcurrentTasks: 6,
    loadingItems: Array.from({ length: 6 }, (_, index) => ({
      id: `job-${index + 1}`,
      statusStage: "generating",
    })),
  };
  const items = getPreviewLoadingShellItems(placeholderState);
  const states = items.map((item, index) => getPreviewLoadingOrbRenderState(item, index, items.length, placeholderState));

  for (let leftIndex = 0; leftIndex < states.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < states.length; rightIndex += 1) {
      assert.ok(
        getPointDistance(states[leftIndex], states[rightIndex]) >= 112,
        `orbs ${leftIndex + 1} and ${rightIndex + 1} should not overlap`,
      );
    }
  }
});

test("preview loading shell holds the first six orbs until a visible job completes", async () => {
  const app = await readFile(appPath, "utf8");
  const loadingShellRuntime = extractFunctionBefore(app, "createPreviewMotionNode", "renderPreviewPlaceholder");
  const document = {
    createElement: createTestElement,
  };
  const createRuntime = new Function(
    "document",
    "getPreviewLoadingOrbLimit",
    "getPreviewLoadingShellItems",
    "getPreviewLoadingOrbRenderState",
    "getPreviewLoadingShellTheme",
    `${loadingShellRuntime}\nreturn { createPreviewLoadingShellNodes, updatePreviewLoadingShell };`,
  );
  const runtime = createRuntime(
    document,
    getPreviewLoadingOrbLimit,
    getPreviewLoadingShellItems,
    getPreviewLoadingOrbRenderState,
    getPreviewLoadingShellTheme,
  );
  const nodes = runtime.createPreviewLoadingShellNodes();
  const baseItems = Array.from({ length: 6 }, (_, index) => ({
    id: `job-${index + 1}`,
    statusStage: "generating",
  }));
  const baseState = {
    mode: "loading",
    stage: "generating",
    stageIndex: 2,
    stageCount: 4,
    activeJobCount: 6,
    maxConcurrentTasks: 7,
    loadingItems: baseItems,
  };

  runtime.updatePreviewLoadingShell(nodes, baseState);
  const visibleNodes = [...nodes.field.children];

  runtime.updatePreviewLoadingShell(nodes, {
    ...baseState,
    activeJobCount: 7,
    loadingItems: [...baseItems, { id: "job-7", statusStage: "uploading" }],
  });

  assert.deepEqual([...nodes.field.children], visibleNodes);
  assert.deepEqual(
    nodes.field.children.map((child) => child.dataset.previewLoadingOrbId),
    ["job-1", "job-2", "job-3", "job-4", "job-5", "job-6"],
  );

  runtime.updatePreviewLoadingShell(nodes, {
    ...baseState,
    activeJobCount: 6,
    loadingItems: [...baseItems.slice(1), { id: "job-7", statusStage: "uploading" }],
  });

  assert.deepEqual(
    nodes.field.children.map((child) => child.dataset.previewLoadingOrbId),
    ["job-2", "job-3", "job-4", "job-5", "job-6", "job-7"],
  );
  assert.equal(nodes.field.children[5].dataset.previewLoadingOrbId, "job-7");
  assert.ok(nodes.field.children[5].classList.contains("is-entering"));
});

test("preview loading placeholder keeps older visible jobs when the queue stores newest first", () => {
  const runningItems = Array.from({ length: 7 }, (_, index) => ({
    id: `job-${index + 1}`,
    createdAt: `2026-06-13T00:00:0${index}.000Z`,
    statusStage: "generating",
  })).reverse();

  const state = getPreviewPlaceholderState({
    item: runningItems[0],
    runningCount: runningItems.length,
    runningItems,
    maxConcurrentTasks: 7,
  });

  assert.deepEqual(
    state.loadingItems.map((item) => item.id),
    ["job-1", "job-2", "job-3", "job-4", "job-5", "job-6"],
  );
});

test("preview loading placeholder keeps stable slots when newest-first jobs share timestamps", () => {
  const cases = [
    {
      name: "missing timestamps",
      runningItems: Array.from({ length: 7 }, (_, index) => ({
        id: `job-${index + 1}`,
        statusStage: "generating",
      })).reverse(),
    },
    {
      name: "matching timestamps",
      runningItems: Array.from({ length: 7 }, (_, index) => ({
        id: `job-${index + 1}`,
        createdAt: "2026-06-13T00:00:00.000Z",
        statusStage: "generating",
      })).reverse(),
    },
  ];

  for (const { name, runningItems } of cases) {
    const state = getPreviewPlaceholderState({
      item: runningItems[0],
      runningCount: runningItems.length,
      runningItems,
      maxConcurrentTasks: 7,
    });

    assert.deepEqual(
      state.loadingItems.map((item) => item.id),
      ["job-1", "job-2", "job-3", "job-4", "job-5", "job-6"],
      name,
    );
  }
});
