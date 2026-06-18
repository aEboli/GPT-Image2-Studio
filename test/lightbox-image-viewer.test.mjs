import test from "node:test";
import assert from "node:assert/strict";

import { createLightboxImageViewer, createLightboxViewerState } from "../lib/lightbox-image-viewer.mjs";

function createStyleDeclaration() {
  const properties = new Map();
  return {
    width: "",
    height: "",
    transform: "",
    setProperty(name, value) {
      properties.set(name, String(value));
    },
    getPropertyValue(name) {
      return properties.get(name) || "";
    },
    removeProperty(name) {
      properties.delete(name);
    },
  };
}

function createClassList() {
  const names = new Set();
  return {
    add(...nextNames) {
      nextNames.forEach((name) => names.add(name));
    },
    contains(name) {
      return names.has(name);
    },
    remove(...nextNames) {
      nextNames.forEach((name) => names.delete(name));
    },
    toggle(name, force) {
      const shouldAdd = force ?? !names.has(name);
      if (shouldAdd) {
        names.add(name);
      } else {
        names.delete(name);
      }
    },
  };
}

function createEventTarget(extra = {}) {
  const listeners = {};
  return {
    listeners,
    addEventListener(type, handler) {
      listeners[type] = handler;
    },
    ...extra,
  };
}

function createButton() {
  return {
    disabled: false,
    textContent: "",
    addEventListener() {},
  };
}

function createViewerHarness({ shellWidth = 600, shellHeight = 400 } = {}) {
  const imageStyle = createStyleDeclaration();
  const refs = {
    lightbox: { classList: createClassList() },
    lightboxActualSizeButton: createButton(),
    lightboxFitButton: createButton(),
    lightboxImage: createEventTarget({
      naturalWidth: 1800,
      naturalHeight: 1200,
      style: imageStyle,
    }),
    lightboxImageShell: createEventTarget({
      clientWidth: shellWidth,
      clientHeight: shellHeight,
      classList: createClassList(),
      setPointerCapture() {},
      releasePointerCapture() {},
      getBoundingClientRect() {
        return { left: 0, top: 0, width: shellWidth, height: shellHeight };
      },
    }),
    lightboxMediaStage: { classList: createClassList() },
    lightboxViewerControls: { classList: createClassList() },
    lightboxZoomInButton: createButton(),
    lightboxZoomLabel: { textContent: "" },
    lightboxZoomOutButton: createButton(),
  };
  const state = { lightboxViewer: createLightboxViewerState() };
  const controller = createLightboxImageViewer({ refs, state });
  return { controller, imageStyle, refs, state };
}

test("lightbox viewer writes a concrete transform for the current scale", () => {
  const { controller, imageStyle } = createViewerHarness();

  controller.syncMetrics();

  assert.equal(imageStyle.getPropertyValue("--lightbox-scale"), "0.3333");
  assert.equal(imageStyle.transform, "translate(-50%, -50%) translate3d(0px, 0px, 0) scale(0.3333)");
});

test("lightbox fitted mode can scale below the interactive minimum on narrow viewports", () => {
  const { controller, imageStyle, refs, state } = createViewerHarness({ shellWidth: 300, shellHeight: 200 });

  controller.syncMetrics();

  assert.equal(state.lightboxViewer.fitScale.toFixed(4), "0.1667");
  assert.equal(imageStyle.getPropertyValue("--lightbox-scale"), "0.1667");
  assert.equal(imageStyle.transform, "translate(-50%, -50%) translate3d(0px, 0px, 0) scale(0.1667)");
  assert.equal(refs.lightboxZoomOutButton.disabled, true);
});

test("lightbox viewer starts in plain view mode until the user double-clicks the image", () => {
  const { controller, imageStyle, refs, state } = createViewerHarness();
  const previousWindow = globalThis.window;
  globalThis.window = { addEventListener() {} };
  try {
    controller.bindEvents();
  } finally {
    if (previousWindow === undefined) {
      delete globalThis.window;
    } else {
      globalThis.window = previousWindow;
    }
  }
  controller.syncMetrics();

  let wheelPrevented = false;
  refs.lightboxImageShell.listeners.wheel({
    clientX: 300,
    clientY: 200,
    deltaY: -100,
    preventDefault() {
      wheelPrevented = true;
    },
  });
  refs.lightboxImageShell.listeners.pointerdown({
    button: 0,
    clientX: 300,
    clientY: 200,
    pointerId: 1,
    preventDefault() {},
  });

  assert.equal(state.lightboxViewer.mode, "view");
  assert.equal(imageStyle.getPropertyValue("--lightbox-scale"), "0.3333");
  assert.equal(refs.lightboxViewerControls.classList.contains("hidden"), true);
  assert.equal(refs.lightboxMediaStage.classList.contains("is-viewer-inspecting"), false);
  assert.equal(refs.lightboxZoomInButton.disabled, true);
  assert.equal(wheelPrevented, false);
  assert.equal(state.lightboxViewer.dragging, false);

  let doubleClickPrevented = false;
  refs.lightboxImageShell.listeners.dblclick({
    clientX: 300,
    clientY: 200,
    preventDefault() {
      doubleClickPrevented = true;
    },
  });

  assert.equal(doubleClickPrevented, true);
  assert.equal(state.lightboxViewer.mode, "inspect");
  assert.equal(imageStyle.getPropertyValue("--lightbox-scale"), "1");
  assert.equal(refs.lightboxViewerControls.classList.contains("hidden"), false);
  assert.equal(refs.lightboxMediaStage.classList.contains("is-viewer-inspecting"), true);
  assert.equal(refs.lightboxZoomInButton.disabled, false);

  let inspectWheelPrevented = false;
  refs.lightboxImageShell.listeners.wheel({
    clientX: 300,
    clientY: 200,
    deltaY: -100,
    preventDefault() {
      inspectWheelPrevented = true;
    },
  });

  assert.equal(inspectWheelPrevented, true);
  assert.equal(imageStyle.getPropertyValue("--lightbox-scale"), "1.12");

  refs.lightboxImageShell.listeners.dblclick({
    clientX: 300,
    clientY: 200,
    preventDefault() {},
  });

  assert.equal(state.lightboxViewer.mode, "view");
  assert.equal(refs.lightboxViewerControls.classList.contains("hidden"), true);
  assert.equal(refs.lightboxMediaStage.classList.contains("is-viewer-inspecting"), false);
});
