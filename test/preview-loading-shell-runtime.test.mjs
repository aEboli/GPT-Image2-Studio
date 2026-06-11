import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import {
  getPreviewLoadingOrbLimit,
  getPreviewLoadingOrbRenderState,
  getPreviewLoadingShellItems,
  getPreviewLoadingShellTheme,
} from "../lib/preview-loading-shell.mjs";

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
