import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import vm from "node:vm";
import { resolveCreationPlatformImageCountState } from "../lib/creation-browser-plan-state.mjs";

const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");
const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");
const expectedCounts = [0, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];

function createCountControl({ aiMarketing = true, value = "18" } = {}) {
  const select = {
    value, dataset: {}, options: [],
    replaceChildren(...options) { this.options = options; },
  };
  const context = vm.createContext({
    refs: { creationImageCountInput: select },
    document: { createElement: () => ({}) },
    isCreationAiMarketingEnabled: () => aiMarketing,
    getCreationPlatformImageCountProfile: () => ({ recommendedImageCount: 18, slots: Array.from({ length: 18 }) }),
    getCreationSelectedPlatform: () => ({ value: "universal" }),
    normalizeCreationPlatform: () => ({ recommendedImageCount: 18 }),
    resolveCreationPlatformImageCountState,
  });
  const constant = app.match(/^const CREATION_IMAGE_COUNT_OPTIONS = .*;$/m)?.[0];
  assert.ok(constant);
  const selectedStart = app.indexOf("function getCreationSelectedImageCount()");
  const selectedEnd = app.indexOf("function createEmptyCreationReferenceAnalysisState()", selectedStart);
  const syncStart = app.indexOf("function syncCreationPlatformImageCountOptions(");
  const syncEnd = app.indexOf("function setCreationResolutionTierValue(", syncStart);
  assert.ok(selectedStart >= 0 && selectedEnd > selectedStart && syncStart >= 0 && syncEnd > syncStart);
  vm.runInContext([constant, app.slice(selectedStart, selectedEnd), app.slice(syncStart, syncEnd)].join("\n"), context);
  return { select, context };
}

test("套图静态选项仅提供 0 张或 6–20 张，默认仍为 18 张", () => {
  const markup = html.match(/<select id="creationImageCountInput"[^>]*>([\s\S]*?)<\/select>/)?.[1];
  assert.ok(markup);
  assert.deepEqual([...markup.matchAll(/<option value="(\d+)"/g)].map((match) => Number(match[1])), expectedCounts);
  assert.match(markup, /<option value="18" selected>18 张<\/option>/);
});

test("动态重建选项遵循最少 6 张，并保留各模式的上限", () => {
  for (const aiMarketing of [true, false]) {
    const { select, context } = createCountControl({ aiMarketing });
    const state = context.syncCreationPlatformImageCountOptions();
    const expected = expectedCounts.filter((count) => aiMarketing || count <= 18);
    assert.deepEqual(select.options.map((option) => Number(option.value)), expected);
    assert.deepEqual(select.options.map((option) => option.textContent), expected.map((count) => `${count} 张`));
    assert.equal(state.maxImageCount, aiMarketing ? 20 : 18);
    for (const count of expected) {
      context.syncCreationPlatformImageCountOptions({ preferredValue: count });
      assert.equal(select.value, String(count));
      assert.equal(context.getCreationSelectedImageCount(), count);
    }
  }
});

test("旧表单的 1–5 张不会重新成为可选数量", () => {
  for (const aiMarketing of [true, false]) {
    for (const count of [1, 2, 3, 4, 5]) {
      const { select, context } = createCountControl({ aiMarketing, value: String(count) });
      assert.equal(context.getCreationSelectedImageCount(), 18);
      context.syncCreationPlatformImageCountOptions({ preferredValue: count });
      assert.equal(select.value, "18");
      assert.ok(select.options.every((option) => Number(option.value) === 0 || Number(option.value) >= 6));
    }
  }
});

test("0 张仍进入专用重构模式，6 张为普通套图模式", () => {
  const { select, context } = createCountControl({ value: "0" });
  context.syncCreationPlatformImageCountOptions();
  assert.equal(select.value, "0");
  assert.equal(context.isCreationZeroImageCountMode(), true);
  assert.equal(context.isCreationInfographicRebuildRequired(), true);
  context.syncCreationPlatformImageCountOptions({ preferredValue: 6 });
  assert.equal(context.isCreationZeroImageCountMode(), false);
  assert.equal(context.isCreationInfographicRebuildRequired(), false);
});

test("快捷套图试水套餐同步使用 6 张", () => {
  const presets = [...html.matchAll(/<input name="quickSuitePreset"[^>]*data-count="(\d+)"/g)].map((match) => Number(match[1]));
  assert.deepEqual(presets, [6, 8, 18]);
  assert.match(html, /<span>试水 6 张<\/span>/);
});
