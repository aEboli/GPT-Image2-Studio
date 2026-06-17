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
    contains(name) {
      return names.has(name);
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
    lightboxImage: {
      naturalWidth: 1800,
      naturalHeight: 1200,
      style: imageStyle,
      addEventListener() {},
    },
    lightboxImageShell: {
      clientWidth: shellWidth,
      clientHeight: shellHeight,
      classList: createClassList(),
      addEventListener() {},
      getBoundingClientRect() {
        return { left: 0, top: 0, width: shellWidth, height: shellHeight };
      },
    },
    lightboxMediaStage: { classList: createClassList() },
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
  assert.equal(imageStyle.transform, "translate3d(0px, 0px, 0) scale(0.3333)");
});

test("lightbox fitted mode can scale below the interactive minimum on narrow viewports", () => {
  const { controller, imageStyle, refs, state } = createViewerHarness({ shellWidth: 300, shellHeight: 200 });

  controller.syncMetrics();

  assert.equal(state.lightboxViewer.fitScale.toFixed(4), "0.1667");
  assert.equal(imageStyle.getPropertyValue("--lightbox-scale"), "0.1667");
  assert.equal(imageStyle.transform, "translate3d(0px, 0px, 0) scale(0.1667)");
  assert.equal(refs.lightboxZoomOutButton.disabled, true);
});
