import test from "node:test";
import assert from "node:assert/strict";
import { fitCreationReadingPanel } from "../lib/text-model-client.mjs";

function createPanel({ analyst, viewportWidth = 1920 } = {}) {
  const listeners = [];
  const area = {
    getBoundingClientRect() {
      return { left: 320, right: 1800, top: 120, width: 1480 };
    },
  };
  const document = {
    querySelector(selector) {
      return selector === ".creation-output-panel" ? area : null;
    },
    defaultView: {
      innerWidth: viewportWidth,
      innerHeight: 1080,
      addEventListener(type, listener) {
        listeners.push([type, listener]);
      },
    },
  };
  return {
    ownerDocument: document,
    hidden: false,
    style: {},
    matches(selector) {
      return analyst && selector === "#creationRecordDetail.creation-analyst-floating";
    },
    listeners,
  };
}

test("analyst panel uses a compact right-side desktop footprint", () => {
  const panel = createPanel({ analyst: true });
  fitCreationReadingPanel(panel);

  assert.equal(panel.style.width, "560px");
  assert.equal(panel.style.left, "1240px");
  assert.equal(panel.style.right, "auto");
  assert.equal(panel.style.top, "132px");
});

test("analyst panel stays within a narrow viewport", () => {
  const panel = createPanel({ analyst: true, viewportWidth: 760 });
  fitCreationReadingPanel(panel);

  assert.equal(panel.style.width, "736px");
  assert.equal(panel.style.left, "12px");
});

test("marketing progress keeps its wide centered footprint", () => {
  const panel = createPanel({ analyst: false });
  fitCreationReadingPanel(panel);

  assert.equal(panel.style.width, "1302.4px");
  assert.ok(Math.abs(Number.parseFloat(panel.style.left) - 408.8) < 0.001);
});
