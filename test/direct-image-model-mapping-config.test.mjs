import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import {
  appendBrowserConfigToFormData, BROWSER_CONFIG_STORAGE_KEY,
  getBrowserPrivateConfigRequestPayload, normalizeBrowserPrivateConfig,
  readBrowserPrivateConfig, restoreDesktopBrowserConfig,
  saveBrowserPrivateConfig, toPublicBrowserConfig,
} from "../lib/browser-config.mjs";
import { createConfigStore, DEFAULT_CONFIG } from "../lib/config-store.mjs";
import { buildCreationGenerationSnapshot } from "../lib/creation-generation-snapshot.mjs";
import { resolveCreationRepairGenerationConfig } from "../lib/creation-repair.mjs";
import { mergeRequestPrivateConfig } from "../lib/request-private-config.mjs";
import { getSelectedImageGenerationConfig } from "../lib/image-route-config.mjs";

const mappings = [{ source: "gpt-image-2.6-sunburst", target: "IMAGE-2.6" }];
const drafts = [{ source: " gpt-image-2.6-sunburst ", target: " IMAGE-2.6 " }, { source: " ", target: "" }];

function memoryStorage() {
  const values = new Map();
  return { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

async function configStore(t) {
  const rootDir = await mkdtemp(join(tmpdir(), "direct-image-mapping-config-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  return createConfigStore({ rootDir });
}

test("mapping config defaults to empty in browser and local private/public config", async (t) => {
  const store = await configStore(t);
  for (const config of [DEFAULT_CONFIG, normalizeBrowserPrivateConfig(), toPublicBrowserConfig({}),
    getBrowserPrivateConfigRequestPayload({}), await store.readPrivateConfig(), await store.readPublicConfig()]) {
    assert.deepEqual(config.directImageModelMappings, []);
  }
});

test("browser mappings survive storage, partial saves, JSON/public roundtrip and explicit clear", () => {
  const storage = memoryStorage();
  const saved = saveBrowserPrivateConfig({
    imageRoute: "b", directImageModel: mappings[0].source, directImageModelMappings: drafts,
    directImageApiKey: "synthetic-image-key", directTextApiKey: "synthetic-text-key",
    directTextModel: "independent-text-model", includeImageToolModel: false, imageOptions: { complexity: "low" },
  }, storage);
  assert.deepEqual(saved.directImageModelMappings, mappings);
  assert.deepEqual(JSON.parse(storage.getItem(BROWSER_CONFIG_STORAGE_KEY)).directImageModelMappings, mappings);
  assert.deepEqual(readBrowserPrivateConfig(storage).directImageModelMappings, mappings);
  const partial = saveBrowserPrivateConfig({ directImageStream: true }, storage);
  assert.deepEqual(partial.directImageModelMappings, mappings);
  assert.equal(partial.directImageModel, mappings[0].source);
  assert.equal(partial.directTextModel, "independent-text-model");
  assert.equal(partial.directImageApiKey, "synthetic-image-key");
  assert.equal(partial.directTextApiKey, "synthetic-text-key");
  assert.equal(partial.includeImageToolModel, false);
  assert.deepEqual(partial.imageOptions, { complexity: "low" });
  const payload = getBrowserPrivateConfigRequestPayload(() => partial);
  assert.deepEqual(JSON.parse(JSON.stringify(payload)).directImageModelMappings, mappings);
  const publicConfig = toPublicBrowserConfig(partial, { unrelatedMetadata: "keep" });
  assert.deepEqual(publicConfig.directImageModelMappings, mappings);
  assert.equal(publicConfig.unrelatedMetadata, "keep");
  assert.equal("directImageApiKey" in publicConfig, false);
  assert.equal("directTextApiKey" in publicConfig, false);
  payload.directImageModelMappings[0].target = "changed-request-only";
  publicConfig.directImageModelMappings[0].target = "changed-public-only";
  assert.deepEqual(partial.directImageModelMappings, mappings);
  assert.deepEqual(saveBrowserPrivateConfig({ directImageModelMappings: [] }, storage).directImageModelMappings, []);
  assert.deepEqual(saveBrowserPrivateConfig({}, storage).directImageModelMappings, []);
  assert.deepEqual(readBrowserPrivateConfig(storage).directImageModelMappings, []);
});

test("desktop restore and migration retain normalized mapping rules", async () => {
  const storage = memoryStorage();
  await restoreDesktopBrowserConfig(storage, { readConfig: async () => ({ directImageModelMappings: drafts }) });
  assert.deepEqual(readBrowserPrivateConfig(storage).directImageModelMappings, mappings);
  let migrated;
  await restoreDesktopBrowserConfig(storage, {
    readConfig: async () => null, saveConfig: async (config) => { migrated = config; },
  });
  assert.deepEqual(migrated.directImageModelMappings, mappings);
});

test("local mappings survive disk reload, partial save and explicit clear without losing config keys", async (t) => {
  const store = await configStore(t);
  await store.saveConfig({
    imageRoute: "b", directImageModel: mappings[0].source, directImageModelMappings: JSON.stringify(drafts),
    directImageApiKey: "synthetic-image-key", directTextApiKey: "synthetic-text-key",
    directTextModel: "independent-text-model", unrelatedConfig: { retain: true }, defaults: { unrelatedDefault: "keep" },
  });
  const saved = await store.saveConfig({ directImageStream: true });
  const disk = JSON.parse(await readFile(store.configPath, "utf8"));
  for (const config of [saved, disk, await store.readPrivateConfig(), await store.readPublicConfig()]) {
    assert.deepEqual(config.directImageModelMappings, mappings);
    assert.equal(config.directImageModel, mappings[0].source);
    assert.equal(config.directTextModel, "independent-text-model");
  }
  assert.deepEqual(saved.unrelatedConfig, { retain: true });
  assert.equal(saved.defaults.unrelatedDefault, "keep");
  assert.equal(saved.directImageApiKey, "synthetic-image-key");
  assert.equal(saved.directTextApiKey, "synthetic-text-key");
  assert.equal("directImageApiKey" in await store.readPublicConfig(), false);
  assert.equal("directTextApiKey" in await store.readPublicConfig(), false);
  await store.saveConfig({ directImageModelMappings: [] });
  await store.saveConfig({ directImageStream: false });
  assert.deepEqual((await store.readPrivateConfig()).directImageModelMappings, []);
  assert.deepEqual((await store.readPublicConfig()).directImageModelMappings, []);
  assert.deepEqual(JSON.parse(await readFile(store.configPath, "utf8")).directImageModelMappings, []);
});

for (const mode of ["JSON", "FormData"]) {
  function request(fields) {
    if (mode === "JSON") return fields;
    const form = new FormData();
    for (const [key, value] of Object.entries(fields)) form.set(key, typeof value === "string" ? value : JSON.stringify(value));
    return form;
  }

  test(mode + " mapping-only overrides normalize, preserve omission, and allow explicit clear", () => {
    const fallback = normalizeBrowserPrivateConfig({ imageRoute: "b", directImageModelMappings: mappings,
      directImageApiKey: "synthetic-server-image-key", directTextApiKey: "synthetic-server-text-key" });
    const replacement = [{ source: " other-image ", target: " OTHER-IMAGE " }];
    const resolved = mergeRequestPrivateConfig(request({ directImageModelMappings: replacement }), fallback);
    assert.deepEqual(resolved.directImageModelMappings, [{ source: "other-image", target: "OTHER-IMAGE" }]);
    assert.deepEqual(mergeRequestPrivateConfig(request({}), fallback).directImageModelMappings, mappings);
    assert.deepEqual(mergeRequestPrivateConfig(request({ directImageModelMappings: [] }), fallback).directImageModelMappings, []);
    assert.equal(resolved.directImageApiKey, fallback.directImageApiKey);
    assert.equal(resolved.directTextApiKey, fallback.directTextApiKey);
    assert.equal(resolved.directImageBaseUrl, fallback.directImageBaseUrl);
    assert.deepEqual(fallback.directImageModelMappings, mappings);
    resolved.directImageModelMappings[0].target = "request-only";
    assert.equal(replacement[0].target, " OTHER-IMAGE ");
  });

  test(mode + " full browser request carries the same validated rules through private merge", () => {
    const browser = normalizeBrowserPrivateConfig({ imageRoute: "b", directImageApiKey: "synthetic-browser-image-key", directImageModelMappings: mappings });
    const payload = mode === "JSON" ? getBrowserPrivateConfigRequestPayload(browser) : appendBrowserConfigToFormData(new FormData(), browser);
    const merged = mergeRequestPrivateConfig(payload, normalizeBrowserPrivateConfig());
    assert.deepEqual(merged.directImageModelMappings, mappings);
    assert.equal(merged.directImageApiKey, browser.directImageApiKey);
    assert.deepEqual(mergeRequestPrivateConfig(request({ imageRoute: "b" }), {}).directImageModelMappings, []);
  });
}

test("browser FormData preserves unrelated fields and honors saved, override and empty mappings", () => {
  const browser = normalizeBrowserPrivateConfig({ directImageModelMappings: mappings });
  for (const [override, expected] of [[{}, mappings], [{ directImageModelMappings: [] }, []], [{ directImageModelMappings: JSON.stringify(drafts) }, mappings]]) {
    const form = new FormData();
    form.set("prompt", "keep prompt");
    appendBrowserConfigToFormData(form, browser, override);
    assert.deepEqual(JSON.parse(form.get("directImageModelMappings")), expected);
    assert.equal(form.get("prompt"), "keep prompt");
  }
  const form = appendBrowserConfigToFormData(new FormData(), null, { directImageModelMappings: drafts });
  assert.deepEqual(JSON.parse(form.get("directImageModelMappings")), mappings);
  assert.deepEqual(browser.directImageModelMappings, mappings);
});

for (const [label, invalid] of [
  ["duplicate source", [mappings[0], { source: " gpt-image-2.6-sunburst ", target: "other" }]],
  ["missing target", [{ source: "image", target: " " }]],
  ["missing source", [{ source: "", target: "image" }]],
  ["malformed JSON", "[{"], ["non-array", { source: "image", target: "alias" }],
]) {
  test("mapping validation rejects " + label + " across config, requests and snapshots", async (t) => {
    const storage = memoryStorage();
    saveBrowserPrivateConfig({ directImageModelMappings: mappings }, storage);
    const savedBrowser = storage.getItem(BROWSER_CONFIG_STORAGE_KEY);
    const config = { directImageModelMappings: invalid };
    assert.throws(() => normalizeBrowserPrivateConfig(config));
    assert.throws(() => saveBrowserPrivateConfig(config, storage));
    assert.equal(storage.getItem(BROWSER_CONFIG_STORAGE_KEY), savedBrowser);
    assert.throws(() => toPublicBrowserConfig(config));
    assert.throws(() => getBrowserPrivateConfigRequestPayload(config));
    assert.throws(() => appendBrowserConfigToFormData(new FormData(), null, config));
    assert.throws(() => mergeRequestPrivateConfig(config, {}));
    const form = new FormData();
    form.set("directImageModelMappings", typeof invalid === "string" ? invalid : JSON.stringify(invalid));
    assert.throws(() => mergeRequestPrivateConfig(form, {}));
    assert.throws(() => buildCreationGenerationSnapshot({ generationConfig: config }));
    assert.throws(() => resolveCreationRepairGenerationConfig(config));
    const store = await configStore(t);
    await store.saveConfig({ directImageModelMappings: mappings });
    const savedLocal = await readFile(store.configPath, "utf8");
    await assert.rejects(() => store.saveConfig(config));
    assert.equal(await readFile(store.configPath, "utf8"), savedLocal);
  });
}

test("creation snapshot freezes normalized rules without sharing config or credentials", () => {
  const generationConfig = { imageRoute: "b", imageModel: mappings[0].source,
    directImageModelMappings: structuredClone(drafts), apiKey: "synthetic-key-never-in-snapshot" };
  const snapshot = buildCreationGenerationSnapshot({ generationConfig });
  assert.deepEqual(snapshot.directImageModelMappings, mappings);
  assert.equal(snapshot.imageModel, mappings[0].source);
  generationConfig.directImageModelMappings[0].target = "new-global-rule";
  assert.deepEqual(snapshot.directImageModelMappings, mappings);
  assert.equal(JSON.stringify(snapshot).includes(generationConfig.apiKey), false);
  assert.deepEqual(buildCreationGenerationSnapshot().directImageModelMappings, []);
});

test("repair and followup configs freeze saved mappings and keep legacy or explicit empty rules empty", () => {
  const snapshot = buildCreationGenerationSnapshot({ generationConfig: {
    imageRoute: "b", imageModel: mappings[0].source, directImageModelMappings: mappings,
  } });
  const current = { imageRoute: "b", apiKey: "current-credential",
    directImageModelMappings: [{ source: mappings[0].source, target: "CURRENT-ALIAS" }] };
  const resolved = resolveCreationRepairGenerationConfig(snapshot, current);
  assert.deepEqual(resolved.directImageModelMappings, mappings);
  assert.equal(resolved.apiKey, current.apiKey);
  resolved.directImageModelMappings[0].target = "only-this-retry";
  assert.deepEqual(snapshot.directImageModelMappings, mappings);
  assert.equal(current.directImageModelMappings[0].target, "CURRENT-ALIAS");
  for (const saved of [{}, { directImageModelMappings: [] }]) {
    assert.deepEqual(resolveCreationRepairGenerationConfig(saved, current).directImageModelMappings, []);
  }
  const followup = resolveCreationRepairGenerationConfig(JSON.parse(JSON.stringify(snapshot)), current);
  const form = appendBrowserConfigToFormData(new FormData(), current, followup);
  assert.deepEqual(JSON.parse(form.get("directImageModelMappings")), mappings);
});

test("snapshots and retries freeze selected and outbound models separately from capability models", () => {
  const snapshot = buildCreationGenerationSnapshot({ generationConfig: {
    imageRoute: "b", imageModel: "gpt-image-2.6-sunburst",
    selectedImageModel: "CUSTOM-IMAGE", requestImageModel: "gpt-image-2.6-sunburst",
    directImageModelMappings: [{ source: "CUSTOM-IMAGE", target: "gpt-image-2.6-sunburst" }],
  } });
  assert.equal(snapshot.selectedImageModel, "CUSTOM-IMAGE");
  assert.equal(snapshot.requestImageModel, "gpt-image-2.6-sunburst");
  const current = { imageModel: "current-model", selectedImageModel: "current-selection",
    requestImageModel: "current-alias", directImageModelMappings: mappings };
  const retry = resolveCreationRepairGenerationConfig(snapshot, current);
  assert.equal(retry.imageModel, snapshot.imageModel);
  assert.equal(retry.selectedImageModel, snapshot.selectedImageModel);
  assert.equal(retry.requestImageModel, snapshot.requestImageModel);
  for (const item of [{ imageModel: "legacy-image" }, { imageModel: "legacy-image", directImageModelMappings: [] }]) {
    const legacyRetry = resolveCreationRepairGenerationConfig(item, current);
    assert.deepEqual(legacyRetry.directImageModelMappings, []);
    assert.equal("selectedImageModel" in legacyRetry, false);
    assert.equal("requestImageModel" in legacyRetry, false);
  }
});

const capabilityCases = [
  { model: "CUSTOM-IMAGE", target: "gpt-image-2.6-sunburst", extended: true },
  { model: "gpt-image-2.6-sunburst", target: "CHANNEL-ALIAS", extended: true },
  { model: "gpt-image-2", target: "gpt-image-2.6-sunburst", extended: false },
  { model: "UNKNOWN-IMAGE", target: "UNKNOWN-ALIAS", extended: false },
  { model: "CUSTOM-IMAGE", target: "gpt-image-2.6-sunburst", route: "a", extended: false },
];

test("browser public quality uses resolved direct capability while preserving selected model and route isolation", () => {
  for (const entry of capabilityCases) {
    for (const quality of ["xhigh", "max", "auto"]) {
      const config = toPublicBrowserConfig({
        imageRoute: entry.route || "b", imageToolModel: "gpt-image-2",
        directImageModel: entry.model,
        directImageModelMappings: [{ source: entry.model, target: entry.target }],
      }, { defaults: { quality } });
      assert.equal(config.defaults.quality, entry.extended ? quality : "high", entry.model + " / " + quality);
      assert.equal(config.directImageModel, entry.model);
    }
  }
});

test("local quality persists resolved direct capability without upgrading known sources or other routes", async (t) => {
  const store = await configStore(t);
  for (const entry of capabilityCases) {
    for (const quality of ["xhigh", "max", "auto"]) {
      const saved = await store.saveConfig({
        imageRoute: entry.route || "b", imageToolModel: "gpt-image-2",
        directImageModel: entry.model,
        directImageModelMappings: [{ source: entry.model, target: entry.target }],
        defaults: { quality },
      });
      const expected = entry.extended ? quality : "high";
      assert.equal(saved.defaults.quality, expected, entry.model + " / " + quality);
      assert.equal((await store.readPrivateConfig()).defaults.quality, expected);
      assert.equal((await store.readPublicConfig()).defaults.quality, expected);
      assert.equal(saved.directImageModel, entry.model);
    }
  }
});

test("selected direct config carries frozen mappings and model names through snapshot and retry", () => {
  for (const entry of capabilityCases.slice(0, 2)) {
    const rules = [{ source: entry.model, target: entry.target }];
    const generationConfig = getSelectedImageGenerationConfig({
      imageRoute: "b", directImageModel: entry.model, directImageModelMappings: rules,
    });
    const snapshot = buildCreationGenerationSnapshot({ generationConfig, quality: "max" });
    assert.deepEqual(snapshot.directImageModelMappings, rules);
    assert.equal(snapshot.selectedImageModel, entry.model);
    assert.equal(snapshot.requestImageModel, entry.target);
    assert.equal(snapshot.imageModel, "gpt-image-2.6-sunburst");
    assert.equal(snapshot.quality, "max");
    const retry = resolveCreationRepairGenerationConfig(JSON.parse(JSON.stringify(snapshot)), {
      directImageModelMappings: [{ source: entry.model, target: "CURRENT-ALIAS" }],
      requestImageModel: "CURRENT-ALIAS", selectedImageModel: entry.model,
    });
    assert.deepEqual(retry.directImageModelMappings, rules);
    assert.equal(retry.requestImageModel, entry.target);
    rules[0].target = "LATER-CHANGE";
    assert.equal(snapshot.directImageModelMappings[0].target, entry.target);
  }
});
