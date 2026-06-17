import test from "node:test";
import assert from "node:assert/strict";

import {
  PORTRAIT_LOCATION_DATA_SOURCE,
  PORTRAIT_LOCATION_FALLBACK_PROVINCES,
  buildPortraitLocationPrompt,
  getPortraitLocationFeatureProfile,
  normalizePortraitLocationSelection,
} from "../lib/portrait-location-presets.mjs";

test("portrait location data source is province-sliced for nationwide selection", () => {
  assert.match(PORTRAIT_LOCATION_DATA_SOURCE.provinceListUrl, /province\.json$/);
  assert.match(PORTRAIT_LOCATION_DATA_SOURCE.provinceDetailUrlBase, /China\/$/);
  assert.ok(PORTRAIT_LOCATION_FALLBACK_PROVINCES.length >= 34);
  assert.ok(PORTRAIT_LOCATION_FALLBACK_PROVINCES.some((entry) => entry.name === "北京市" && entry.code === "11"));
  assert.ok(PORTRAIT_LOCATION_FALLBACK_PROVINCES.some((entry) => entry.name === "新疆维吾尔自治区" && entry.code === "65"));
});

test("portrait location prompt uses selected province city district and town", () => {
  const selection = normalizePortraitLocationSelection({
    enabled: true,
    province: { name: "云南省", code: "53" },
    city: { name: "大理白族自治州", code: "532900000000" },
    district: { name: "大理市", code: "532901000000" },
    town: { name: "喜洲镇", code: "532901101000" },
  });

  assert.equal(selection.enabled, true);
  assert.equal(selection.fullName, "云南省 · 大理白族自治州 · 大理市 · 喜洲镇");
  assert.equal(selection.featureTitle, "大理白族风物");
  assert.deepEqual(selection.featureObjects, ["扎染布", "白族木窗", "洱海风", "鲜花篮"]);

  const prompt = buildPortraitLocationPrompt(selection);
  assert.match(prompt, /Selected location portrait setting: 云南省 · 大理白族自治州 · 大理市 · 喜洲镇/);
  assert.match(prompt, /tie-dye textile|white walls|Erhai lake breeze/i);
  assert.match(prompt, /LOCATION LOCK/);
  assert.match(prompt, /Keep the person as the clear portrait subject/);
});

test("portrait location feature profile falls back to province-level cues", () => {
  const profile = getPortraitLocationFeatureProfile({
    enabled: true,
    province: { name: "北京市", code: "11" },
    city: { name: "市辖区", code: "110100000000" },
    district: { name: "东城区", code: "110101000000" },
    town: { name: "东华门街道", code: "110101001000" },
  });

  assert.equal(profile.label, "北京城市胡同");
  assert.ok(profile.objects.includes("灰砖胡同"));
});
