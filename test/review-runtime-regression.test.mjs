import test from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import vm from "node:vm";

import { createCreationSetStore } from "../lib/creation-store.mjs";
import { createPortraitSetStore } from "../lib/portrait-store.mjs";
import { createArticleIllustrationSetStore } from "../lib/article-illustration-store.mjs";
import { createPptDeckStore } from "../lib/ppt-deck-store.mjs";
import { createPromptAgentStore } from "../lib/prompt-agent-store.mjs";
import { createGenerationTaskStore } from "../lib/generation-task-store.mjs";
import { mergeRequestPrivateConfig } from "../lib/request-private-config.mjs";
import { requestCreationListingDraft } from "../lib/creation-listing-agent.mjs";

const savedProviders = {
  imageRoute: "a",
  baseUrl: "https://route.example.test/v1",
  apiKey: "saved-route-key",
  directBaseUrl: "https://image.example.test/v1",
  directApiKey: "saved-legacy-key",
  directImageBaseUrl: "https://image.example.test/v1",
  directImageEndpointPath: "images/generations",
  directImageApiKey: "saved-image-key",
  directTextBaseUrl: "https://text.example.test/v1",
  directTextEndpointPath: "responses",
  directTextApiKey: "saved-text-key",
  protocolBaseUrl: "https://gemini.example.test/v1",
  protocolApiKey: "saved-gemini-key",
  grokBaseUrl: "https://grok.example.test/v1",
  grokEndpointPath: "images/generations",
  grokApiKey: "saved-grok-key",
};

for (const [route, baseField, keyField, endpointField] of [
  ["b", "directImageBaseUrl", "directImageApiKey", "directImageEndpointPath"],
  ["b", "directTextBaseUrl", "directTextApiKey", "directTextEndpointPath"],
  ["c", "protocolBaseUrl", "protocolApiKey", ""],
  ["d", "grokBaseUrl", "grokApiKey", "grokEndpointPath"],
]) {
  test(`saved credentials cannot follow a request override of ${baseField}`, () => {
    assert.throws(() => mergeRequestPrivateConfig({
      imageRoute: route,
      [baseField]: "https://untrusted.example.test/v1",
    }, savedProviders), (error) => {
      assert.match(error.message, /API Key/);
      assert.doesNotMatch(error.message, /saved-.*-key/);
      return true;
    });
    const ownConfig = mergeRequestPrivateConfig({
      imageRoute: route,
      [baseField]: "https://request.example.test/v1",
      [keyField]: "request-owned-key",
    }, savedProviders);
    assert.equal(ownConfig[baseField], "https://request.example.test/v1");
    assert.equal(ownConfig[keyField], "request-owned-key");
    const sameConfig = mergeRequestPrivateConfig({
      imageRoute: route,
      [baseField]: savedProviders[baseField],
    }, savedProviders);
    assert.equal(sameConfig[keyField], savedProviders[keyField]);
    if (endpointField) {
      assert.throws(() => mergeRequestPrivateConfig({
        imageRoute: route,
        [baseField]: savedProviders[baseField],
        [endpointField]: endpointField === "directTextEndpointPath" ? "chat/completions" : "images/edits",
      }, savedProviders), /API Key/);
    }
  });
}

test("legacy direct provider overrides cannot redirect a saved fallback key", () => {
  const legacy = { baseUrl: savedProviders.baseUrl, apiKey: "saved-route-key", directApiKey: "saved-legacy-key", directBaseUrl: "https://legacy.example.test/v1" };
  assert.throws(() => mergeRequestPrivateConfig({
    imageRoute: "b",
    directBaseUrl: "https://untrusted.example.test/v1",
  }, legacy), /API Key/);
  const config = mergeRequestPrivateConfig({
    imageRoute: "b",
    directBaseUrl: "https://request.example.test/v1",
    directApiKey: "request-owned-key",
  }, legacy);
  assert.equal(config.directImageApiKey, "request-owned-key");
  assert.equal(config.directTextApiKey, "request-owned-key");
});

test("PPT manifest traversal IDs cannot overwrite files outside the store", async (t) => {
  const root = await mkdtemp(join(tmpdir(), "studio-ppt-id-regression-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const outputDir = join(root, "output");
  const store = createPptDeckStore({ outputDir });
  const protectedFile = join(root, "protected.json");
  await writeFile(protectedFile, "protected", "utf8");
  for (const deckId of ["../../../protected", "..\\..\\..\\protected", "C:\\protected", "nested/deck", "deck:stream"]) {
    await assert.rejects(store.saveManifest({ deckId, title: "probe", slides: [] }), /deckId|清单|路径/);
    assert.equal(await readFile(protectedFile, "utf8"), "protected");
  }
  await store.saveManifest({ deckId: "ppt-deck-valid", title: "valid" });
  assert.equal(JSON.parse(await readFile(store.manifestPath("ppt-deck-valid"), "utf8")).deckId, "ppt-deck-valid");
});

const manifestCases = [
  ["creation", createCreationSetStore, (marker) => ({ setId: "race", productName: marker, productDescription: marker.repeat(20000), items: [], listingDrafts: [] }), (record) => record.productName],
  ["portrait", createPortraitSetStore, (marker) => ({ setId: "race", subjectName: marker, subjectSummary: marker.repeat(20000), items: [] }), (record) => record.subjectName],
  ["article", createArticleIllustrationSetStore, (marker) => ({ setId: "race", title: marker, articleBundle: { sourceText: marker.repeat(20000) }, items: [] }), (record) => record.title],
  ["ppt", createPptDeckStore, (marker) => ({ deckId: "race", title: marker, outline: { summary: marker.repeat(20000) }, slides: [] }), (record) => record.title],
];

for (const [name, createStore, manifest, markerOf] of manifestCases) {
  test(`${name} manifests stay readable during concurrent saves and retain the last save`, async (t) => {
    const outputDir = await mkdtemp(join(tmpdir(), `studio-${name}-atomic-`));
    t.after(() => rm(outputDir, { recursive: true, force: true }));
    const store = createStore({ outputDir });
    await store.saveManifest(manifest("seed"));
    const writes = Array.from({ length: 18 }, (_, index) => store.saveManifest(manifest(`record-${index}`)));
    const reads = (async () => {
      for (let index = 0; index < 40; index += 1) {
        await store.listManifests();
      }
    })();
    const outcomes = await Promise.allSettled([...writes, reads]);
    for (const outcome of outcomes) assert.equal(outcome.status, "fulfilled", outcome.reason?.message);
    const records = await store.listManifests();
    assert.equal(records.length, 1);
    assert.equal(markerOf(records[0]), "record-17");
  });
}

test("concurrent prompt history appends retain every successful entry across store instances", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "studio-history-transaction-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const store = createPromptAgentStore({ rootDir });
  const secondStore = createPromptAgentStore({ rootDir });
  await store.append({ id: "seed", json: {} });
  await Promise.all(Array.from({ length: 10 }, (_, index) => (index % 2 ? store : secondStore).append({
    id: `history-${index}`,
    json: { prompt: "probe" },
  })));
  assert.equal((await store.list()).length, 11);
});

test("failed history write releases the transaction for a subsequent append", async (t) => {
  const rootDir = await mkdtemp(join(tmpdir(), "studio-history-recovery-"));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const store = createPromptAgentStore({ rootDir });
  await mkdir(join(rootDir, ".local"));
  await writeFile(store.historyPath, "invalid JSON", "utf8");
  await assert.rejects(store.append({ id: "fails" }));
  await rm(store.historyPath);
  await store.append({ id: "recovers" });
  assert.equal((await store.list())[0].id, "recovers");
});

test("running tasks beyond the history capacity remain updateable until completion", () => {
  const store = createGenerationTaskStore({ maxTasksPerSession: 2 });
  for (let index = 0; index < 25; index += 1) {
    store.upsertTask("session", { id: `running-${index}`, status: "running" });
  }
  assert.equal(store.listTasks("session").length, 25);
  assert.equal(store.completeTask("session", "running-0").status, "completed");
  store.completeTask("session", "running-1");
  store.completeTask("session", "running-2");
  const records = store.listTasks("session");
  assert.equal(records.filter((task) => task.status === "running").length, 22);
  assert.equal(records.filter((task) => task.status === "completed").length, 2);
});

test("serialized extension invocations use only the supplied page and version arguments", async () => {
  const source = (await readFile(new URL("../extensions/product-image-collector/service-worker.mjs", import.meta.url), "utf8")).replace(/\r\n/g, "\n");
  const start = source.indexOf("function collectInjectedPage(");
  const end = source.indexOf("\n\nasync function injectPanel", start);
  const workerContext = vm.createContext({});
  vm.runInContext(`const EXTENSION_VERSION = '1.1.33'; ${source.slice(start, end)}`, workerContext);
  for (const name of ["collectInjectedPage", "openInjectedPanel"]) {
    let calls = 0;
    const controller = { version: "1.1.33", collect: () => { calls += 1; return { ok: true }; }, open: () => { calls += 1; } };
    const pageContext = vm.createContext({
      location: { href: "https://detail.1688.com/offer/123.html" },
      __gptImage2StudioProductImageCollectorController: controller,
      __gptImage2StudioProductImagePanelController: controller,
    });
    const fn = vm.runInContext(name, workerContext).toString();
    assert.equal(vm.runInContext(`(${fn})(location.href, '1.1.33')`, pageContext).ok, true);
    assert.equal(calls, 1);
    assert.equal(vm.runInContext(`(${fn})(location.href, '1.1.32')`, pageContext).ok, false);
    assert.equal(calls, 1);
  }
});

test("Listing timeout aborts a stalled body after response headers arrive", async (t) => {
  const server = createServer((request, response) => {
    request.resume();
    response.writeHead(503, { "Content-Type": "application/json" });
    response.flushHeaders();
    const timer = setTimeout(() => response.end('{"error":{"message":"late body"}}'), 600);
    response.on("close", () => clearTimeout(timer));
  });
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  await assert.rejects(requestCreationListingDraft({
    baseUrl: `http://127.0.0.1:${server.address().port}/v1`,
    apiKey: "probe-key",
    responsesModel: "probe-model",
    requestTimeoutMs: 100,
    source: { setId: "probe", productName: "Fishing Lure", skuTitle: "Blue Lure", skuBundleCount: 2, dimensionSpecs: "3.5 in", evidenceMode: "input-only" },
  }), /timed out after 100ms/);
});
