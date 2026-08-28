import assert from "node:assert/strict";
import { performance } from "node:perf_hooks";
import { mkdtemp, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { createConfigStore } from "../lib/config-store.mjs";
import {
  appendBrowserConfigToFormData,
  getBrowserPrivateConfigRequestPayload,
  normalizeBrowserPrivateConfig,
  readBrowserPrivateConfig,
  saveBrowserPrivateConfig,
  toPublicBrowserConfig,
} from "../lib/browser-config.mjs";
import {
  GENERATION_START_DELAY_FIELD,
  normalizeGenerationStartDelayMs,
  resolveGenerationStartDelayMs,
} from "../lib/generation-start-delay.mjs";
import { runWithConcurrency } from "../lib/limited-concurrency.mjs";
import {
  DEFAULT_GENERATION_START_DELAY_MS,
  MAX_GENERATION_START_DELAY_MS,
  MIN_GENERATION_START_DELAY_MS,
} from "../lib/studio-constants.mjs";

function createMemoryStorage(initial = {}) {
  const map = new Map(Object.entries(initial));
  return {
    getItem: (key) => (map.has(key) ? map.get(key) : null),
    setItem: (key, value) => map.set(key, value),
  };
}

test("generation start delay defaults to 800ms and clamps to its bounds", () => {
  assert.equal(DEFAULT_GENERATION_START_DELAY_MS, 800);
  assert.equal(MIN_GENERATION_START_DELAY_MS, 0);
  assert.equal(MAX_GENERATION_START_DELAY_MS, 10_000);

  assert.equal(normalizeGenerationStartDelayMs(undefined), 800);
  assert.equal(normalizeGenerationStartDelayMs(null), 800);
  assert.equal(normalizeGenerationStartDelayMs(""), 800);
  assert.equal(normalizeGenerationStartDelayMs("   "), 800);
  assert.equal(normalizeGenerationStartDelayMs("not-a-number"), 800);

  // Zero is a real choice, not an absent value.
  assert.equal(normalizeGenerationStartDelayMs(0), 0);
  assert.equal(normalizeGenerationStartDelayMs("0"), 0);

  assert.equal(normalizeGenerationStartDelayMs(-1), 0);
  assert.equal(normalizeGenerationStartDelayMs(20_000), 10_000);
  assert.equal(normalizeGenerationStartDelayMs("450.6"), 451);
  assert.equal(normalizeGenerationStartDelayMs("1200"), 1200);
});

test("generation start delay resolves the request value over the saved default", () => {
  const savedConfig = { defaults: { [GENERATION_START_DELAY_FIELD]: 300 } };

  assert.equal(resolveGenerationStartDelayMs({ [GENERATION_START_DELAY_FIELD]: "1200" }, savedConfig), 1200);
  assert.equal(resolveGenerationStartDelayMs({ [GENERATION_START_DELAY_FIELD]: "0" }, savedConfig), 0);
  assert.equal(resolveGenerationStartDelayMs({}, savedConfig), 300);
  assert.equal(resolveGenerationStartDelayMs({ [GENERATION_START_DELAY_FIELD]: "" }, savedConfig), 300);
  assert.equal(resolveGenerationStartDelayMs({}, {}), 800);

  const formData = new FormData();
  formData.set(GENERATION_START_DELAY_FIELD, "1500");
  assert.equal(resolveGenerationStartDelayMs(formData, savedConfig), 1500);
});

test("bounded concurrency honours the configured start delay", async () => {
  const zeroDelayStarts = [];
  const zeroDelayStart = performance.now();
  await runWithConcurrency([1, 2, 3, 4], 4, async () => {
    zeroDelayStarts.push(performance.now() - zeroDelayStart);
  }, { startDelayMs: 0 });
  assert.equal(zeroDelayStarts.length, 4);
  // With no launch gate every worker starts in the same tick window.
  assert.ok(zeroDelayStarts[3] < 200, `expected an immediate fourth start, got ${zeroDelayStarts[3]}ms`);

  const spacedStarts = [];
  const spacedStart = performance.now();
  await runWithConcurrency([1, 2, 3], 3, async () => {
    spacedStarts.push(performance.now() - spacedStart);
  }, { startDelayMs: 300 });
  assert.equal(spacedStarts.length, 3);
  assert.ok(spacedStarts[1] - spacedStarts[0] >= 250, `expected a ~300ms gap, got ${spacedStarts[1] - spacedStarts[0]}ms`);
  assert.ok(spacedStarts[2] - spacedStarts[1] >= 250, `expected a ~300ms gap, got ${spacedStarts[2] - spacedStarts[1]}ms`);
});

test("bounded concurrency falls back to the default delay without an option", async () => {
  const source = await readFile(new URL("../lib/limited-concurrency.mjs", import.meta.url), "utf8");
  assert.match(source, /normalizeGenerationStartDelayMs\(startDelayMs\)/);
  assert.doesNotMatch(source, /const WORKER_START_DELAY_MS/);

  const starts = [];
  const startedAt = performance.now();
  await runWithConcurrency([1, 2], 2, async () => {
    starts.push(performance.now() - startedAt);
  });
  assert.ok(starts[1] - starts[0] >= 700, `expected the 800ms default, got ${starts[1] - starts[0]}ms`);
});

test("config store persists and normalizes the generation start delay", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "generation-start-delay-config-"));
  const store = createConfigStore({ rootDir });

  const initial = await store.readPublicConfig();
  assert.equal(initial.defaults[GENERATION_START_DELAY_FIELD], 800);

  const saved = await store.saveConfig({ defaults: { [GENERATION_START_DELAY_FIELD]: 1500 } });
  assert.equal(saved.defaults[GENERATION_START_DELAY_FIELD], 1500);
  assert.equal((await store.readPublicConfig()).defaults[GENERATION_START_DELAY_FIELD], 1500);

  const zeroed = await store.saveConfig({ defaults: { [GENERATION_START_DELAY_FIELD]: 0 } });
  assert.equal(zeroed.defaults[GENERATION_START_DELAY_FIELD], 0);

  const clamped = await store.saveConfig({ defaults: { [GENERATION_START_DELAY_FIELD]: 999_999 } });
  assert.equal(clamped.defaults[GENERATION_START_DELAY_FIELD], 10_000);

  const junk = await store.saveConfig({ defaults: { [GENERATION_START_DELAY_FIELD]: "abc" } });
  assert.equal(junk.defaults[GENERATION_START_DELAY_FIELD], 800);
});

test("browser config round-trips the generation start delay", () => {
  assert.equal(normalizeBrowserPrivateConfig({})[GENERATION_START_DELAY_FIELD], 800);
  assert.equal(normalizeBrowserPrivateConfig({ [GENERATION_START_DELAY_FIELD]: 0 })[GENERATION_START_DELAY_FIELD], 0);

  const storage = createMemoryStorage();
  const saved = saveBrowserPrivateConfig({ [GENERATION_START_DELAY_FIELD]: 1500 }, storage);
  assert.equal(saved[GENERATION_START_DELAY_FIELD], 1500);
  assert.equal(readBrowserPrivateConfig(storage)[GENERATION_START_DELAY_FIELD], 1500);

  // An absent field keeps the stored value instead of resetting to the default.
  assert.equal(saveBrowserPrivateConfig({}, storage)[GENERATION_START_DELAY_FIELD], 1500);
  // An explicit zero overwrites it.
  assert.equal(saveBrowserPrivateConfig({ [GENERATION_START_DELAY_FIELD]: 0 }, storage)[GENERATION_START_DELAY_FIELD], 0);

  const publicConfig = toPublicBrowserConfig(readBrowserPrivateConfig(storage), {});
  assert.equal(publicConfig.defaults[GENERATION_START_DELAY_FIELD], 0);

  const payload = getBrowserPrivateConfigRequestPayload(() => readBrowserPrivateConfig(storage));
  assert.equal(payload[GENERATION_START_DELAY_FIELD], 0);

  const formData = appendBrowserConfigToFormData(new FormData(), () => readBrowserPrivateConfig(storage));
  assert.equal(formData.get(GENERATION_START_DELAY_FIELD), "0");
});

test("the start delay control sits in the config form above the generation log panel", async () => {
  const html = await readFile(new URL("../public/index.html", import.meta.url), "utf8");

  const inputIndex = html.indexOf('id="generationStartDelayInput"');
  const logPanelIndex = html.indexOf('id="configGenerationLogPanel"');
  const actionBarIndex = html.indexOf('class="config-action-bar"');
  const configFormIndex = html.indexOf('id="configForm"');
  const configFormEndIndex = html.indexOf("</form>", configFormIndex);

  assert.ok(inputIndex > 0, "the start delay input must exist");
  assert.ok(inputIndex < logPanelIndex, "the control must render before the generation log panel");
  assert.ok(inputIndex < actionBarIndex, "the control must render before the save action bar");
  assert.ok(
    inputIndex > configFormIndex && inputIndex < configFormEndIndex,
    "the control must live inside the config form",
  );

  // Programmatic label, bounds, and unit are part of the contract. The label is
  // also the hover trigger for the explanation, which is now a tooltip.
  assert.match(html, /class="scheduling-hint-trigger"[^>]*data-ui-i18n="startDelayLabel">任务提交间隔<\/span>/);
  assert.match(html, /<small data-ui-i18n="startDelayUnit">毫秒<\/small>/);
  assert.match(
    html,
    /<input id="generationStartDelayInput" name="generationStartDelayMs" type="number" step="any"[^>]*placeholder="800"/,
  );
  // Native min/max/step would fail form validation and silently block saving
  // every other config field: step="100" rejects 850, min="0" rejects a typed
  // negative. The bounds are documented in data attributes and enforced in JS.
  assert.doesNotMatch(html, /id="generationStartDelayInput"[^>]*\smax="/);
  assert.doesNotMatch(html, /id="generationStartDelayInput"[^>]*\smin="/);
  assert.doesNotMatch(html, /id="generationStartDelayInput"[^>]*step="100"/);
  assert.match(html, /id="generationStartDelayInput"[^>]*data-min-delay-ms="0"/);
  assert.match(html, /id="generationStartDelayInput"[^>]*data-max-delay-ms="10000"/);
  // The description moved onto the hover trigger with the hint, so the input no
  // longer carries aria-describedby.
  assert.match(html, /aria-describedby="generationStartDelayHint"[^>]*data-ui-i18n="startDelayLabel"/);
  assert.match(html, /id="generationStartDelayHint" role="tooltip"[^>]*data-ui-i18n="startDelayHint"[^>]*>[^<]*800 毫秒，最大 10000 毫秒/);
});

test("the browser reads the start delay control into the request payload", async () => {
  const app = await readFile(new URL("../public/app.js", import.meta.url), "utf8");

  assert.match(app, /generationStartDelayInput:\s*document\.querySelector\("#generationStartDelayInput"\),/);
  assert.match(app, /\[GENERATION_START_DELAY_FIELD\]:\s*getConfiguredGenerationStartDelayMs\(browserPayload\),/);
  assert.match(app, /function getConfiguredGenerationStartDelayMs\(browserPayload = \{\}\) \{[\s\S]*?normalizeGenerationStartDelayMs\(refs\.generationStartDelayInput\?\.value, fallback\)/);
  assert.match(app, /refs\.generationStartDelayInput\.value = String\(\s*normalizeGenerationStartDelayMs\(config\.defaults\?\.\[GENERATION_START_DELAY_FIELD\]/);
  // Clamp on the field's own commit and again on submit, because Enter can
  // submit the form without firing change.
  assert.match(app, /refs\.generationStartDelayInput\?\.addEventListener\("change", \(\) => \{[\s\S]*normalizeGenerationStartDelayMs\(refs\.generationStartDelayInput\.value/);
  assert.match(app, /refs\.generationStartDelayInput\.value = String\(payload\[GENERATION_START_DELAY_FIELD\]\);/);
  assert.match(app, /startDelayLabel: "任务提交间隔"/);
  assert.match(app, /startDelayLabel: "Task Submit Interval"/);
});

test("every server concurrency fan-out passes the resolved start delay", async () => {
  const server = await readFile(new URL("../server.mjs", import.meta.url), "utf8");

  const scopeDeclarations = server.match(/const generationStartDelayMs = resolveGenerationStartDelayMs\(formData, config\);/g) || [];
  const callSites = server.match(/\}, \{ startDelayMs: generationStartDelayMs \}\);/g) || [];
  const fanOutCalls = server.match(/await runWithConcurrency\(/g) || [];

  assert.equal(fanOutCalls.length, 5, "creation generate/repair/logo-batch and portrait generate/repair fan out");
  assert.equal(callSites.length, 5, "every fan-out must receive the configured delay");
  assert.equal(scopeDeclarations.length, 5);
});

test("browser and server keep the delay out of masked credential surfaces", () => {
  const storage = createMemoryStorage();
  saveBrowserPrivateConfig({ apiKey: "sk-secret-value", [GENERATION_START_DELAY_FIELD]: 1200 }, storage);
  const publicConfig = toPublicBrowserConfig(readBrowserPrivateConfig(storage), {});

  assert.equal(publicConfig.defaults[GENERATION_START_DELAY_FIELD], 1200);
  assert.equal("apiKey" in publicConfig, false);
  assert.doesNotMatch(JSON.stringify(publicConfig), /sk-secret-value/);
});
