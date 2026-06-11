import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

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
    attributes: new Map(),
    appendChild(child) {
      element.children.push(child);
      return child;
    },
    append(...nodes) {
      nodes.forEach((node) => element.appendChild(node));
    },
    setAttribute(name, value) {
      element.attributes.set(name, String(value));
    },
  };
  return element;
}

test("preview loading shell can be created before any preview item exists", async () => {
  const app = await readFile(appPath, "utf8");
  const createPreviewMotionNode = extractFunctionBefore(app, "createPreviewMotionNode", "createPreviewLoadingShellNodes");
  const createPreviewLoadingShellNodes = extractFunctionBefore(app, "createPreviewLoadingShellNodes", "syncPreviewLoadingSteps");
  const document = {
    createElement: createTestElement,
  };
  const createNodes = new Function(
    "document",
    `${createPreviewMotionNode}\n${createPreviewLoadingShellNodes}\nreturn createPreviewLoadingShellNodes();`,
  );

  assert.doesNotThrow(() => createNodes(document));
});
