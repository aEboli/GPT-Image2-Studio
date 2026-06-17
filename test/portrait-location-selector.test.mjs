import test from "node:test";
import assert from "node:assert/strict";

import { PORTRAIT_LOCATION_FALLBACK_PROVINCES } from "../lib/portrait-location-presets.mjs";
import {
  createDefaultPortraitLocationState,
  createPortraitLocationSelectorController,
} from "../lib/portrait-location-selector.mjs";

test("portrait location selector keeps fallback province coverage when remote list is partial", async () => {
  const state = { portrait: { location: createDefaultPortraitLocationState() } };
  const controller = createPortraitLocationSelectorController({
    documentRef: {
      createElement: () => ({ appendChild() {}, value: "", textContent: "" }),
      querySelector: () => null,
    },
    fetchImpl: async () => ({
      ok: true,
      json: async () => [{ name: "北京市", code: "11" }],
    }),
    refs: {},
    renderPortraitView: () => {},
    state,
  });

  await controller.loadProvinces();

  assert.ok(state.portrait.location.provinces.length >= PORTRAIT_LOCATION_FALLBACK_PROVINCES.length);
  assert.ok(state.portrait.location.provinces.some((entry) => entry.name === "台湾省"));
});
