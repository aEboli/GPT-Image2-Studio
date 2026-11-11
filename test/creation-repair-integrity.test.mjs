import test, { before, after } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { buildCreationPlan } from "../lib/creation-planner.mjs";
import { createCreationSetStore } from "../lib/creation-store.mjs";

const png = "iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAIAAAD91JpzAAAADklEQVR4nGP4DwUMMAYAj4IP8TylVlEAAAAASUVORK5CYII=";
const requests = [];
const held = new Map();
let app;
let upstream;
let root;
let baseUrl;
let store;
const plan = buildCreationPlan({
  productName: "Review mug", productDescription: "A blue ceramic mug", imageCount: 2,
  selectedRoles: ["hero", "multi-angle"], skuGenerationEnabled: false, infographicRebuildEnabled: false,
  ratio: "1:1", size: "1024x1024", targetLanguage: "en",
});

function finishImage(response) {
  if (response.writableEnded || response.destroyed) return;
  response.writeHead(200, { "content-type": "application/json" });
  response.end(JSON.stringify({ data: [{ b64_json: png }] }));
}

before(async () => {
  root = await mkdtemp(join(tmpdir(), "creation-repair-integrity-"));
  upstream = createServer(async (request, response) => {
    const chunks = [];
    for await (const chunk of request) chunks.push(chunk);
    const body = JSON.parse(Buffer.concat(chunks).toString());
    requests.push({ body, authorization: request.headers.authorization, response });
    const marker = [...held.keys()].find((key) => body.prompt.includes(key));
    if (marker) held.set(marker, response);
    else if (body.prompt.includes("fail-upstream")) {
      response.writeHead(401, { "content-type": "application/json" });
      response.end(JSON.stringify({ error: { code: "invalid_api_key", message: "Invalid API key" } }));
    } else finishImage(response);
  });
  await new Promise((resolve) => upstream.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${upstream.address().port}/v1`;
  Object.assign(process.env, {
    HOST: "127.0.0.1", PORT: "0", IMAGE_STUDIO_OUTPUT_DIR: join(root, "output"),
    IMAGE_STUDIO_LOCAL_DATA_DIR: join(root, "config"), IMAGE_STUDIO_REQUEST_TOKEN: "repair-test-local-token",
  });
  for (const key of ["VERCEL", "VERCEL_REGION", "VERCEL_URL", "VERCEL_ENV", "IMAGE_STUDIO_MOCK_IMAGE_GENERATION", "IMAGE_STUDIO_MOCK_LISTING_AGENT"]) delete process.env[key];
  app = await import("../server.mjs");
  store = createCreationSetStore({ outputDir: join(root, "output") });
});

after(async () => {
  for (const entry of requests) finishImage(entry.response);
  await app?.closeStudioServer();
  upstream?.closeAllConnections();
  if (upstream?.listening) await new Promise((resolve) => upstream.close(resolve));
  if (root) await rm(root, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
});

async function seed(setId) {
  return store.saveManifest({
    ...plan, setId, effectivePlan: plan, createdAt: "2026-11-11T00:00:00Z",
    relativeDir: `2026-11/11-11/2026-11-11-creation/${setId}`, status: "failed",
    items: plan.items.map((item) => ({
      ...item, status: "failed", baseUrl, imageRoute: "b", imageModel: "gpt-image-2", responsesModel: "gpt-image-2",
      endpointPath: "/images/generations", ratio: "1:1", size: "1024x1024", format: "png",
    })),
  });
}

async function repair(set, index, marker, { fields = {}, signal } = {}) {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    setId: set.setId, itemId: set.items[index].itemId, promptOverride: marker, imageRoute: "b",
    directImageBaseUrl: baseUrl, directImageApiKey: "matching-provider-key",
    directImageEndpointPath: "/images/generations", directImageModel: "gpt-image-2",
    clientSessionId: marker, ratio: "1:1", size: "1024x1024", format: "png",
    generationStartDelayMs: 200, generationConcurrency: 2, ...fields,
  })) data.set(key, String(value));
  const response = await fetch(`${app.studioServerUrl}/api/creation/repair`, {
    method: "POST", body: data, signal: signal || AbortSignal.timeout(15000),
  });
  const wire = await response.text();
  return wire.split(/\r?\n\r?\n/).flatMap((block) => {
    const name = block.match(/^event:\s*(.+)$/m)?.[1];
    const value = block.match(/^data:\s*(.+)$/m)?.[1];
    return name && value ? [{ name, data: JSON.parse(value) }] : [];
  });
}

async function waitFor(check) {
  for (let i = 0; i < 200; i++) {
    if (check()) return;
    await delay(10);
  }
  throw new Error("Timed out waiting for local upstream");
}

function assertSaved(events) {
  assert.ok(events.some((event) => event.name === "item_saved"), JSON.stringify(events));
}

test("repair rejects a different provider before sending credentials or changing the saved set", async () => {
  const set = await seed("provider-mismatch");
  const original = await readFile(store.manifestPath(set.setId), "utf8");
  const start = requests.length;
  const events = await repair(set, 0, "mismatched-provider", { fields: {
    directImageBaseUrl: "http://127.0.0.1:9/v1", directImageApiKey: "other-provider-key",
  } });
  assert.ok(events.some((event) => event.name === "error"), JSON.stringify(events));
  assert.equal(requests.length, start, "the saved provider must not receive the other provider's key");
  assert.equal(await readFile(store.manifestPath(set.setId), "utf8"), original);
});

test("concurrent repairs retain both completed images in one set", async () => {
  const set = await seed("concurrent");
  const marker = "hold-concurrent-first";
  held.set(marker, null);
  const first = repair(set, 0, marker);
  await waitFor(() => held.get(marker));
  const second = repair(set, 1, "concurrent-second");
  await Promise.race([second, delay(350)]);
  finishImage(held.get(marker));
  held.delete(marker);
  for (const events of await Promise.all([first, second])) assertSaved(events);
  const saved = await store.readManifest(set.setId);
  assert.ok(saved.items.every((item) => item.status === "completed" && item.filename && item.relativePath), JSON.stringify(saved.items));
  for (const item of saved.items) assert.ok((await readFile(join(root, "output", item.relativePath))).length > 0);
});

test("a cancelled queued repair makes no upstream request and later repairs can continue", async () => {
  const set = await seed("cancel-queued");
  const marker = "hold-cancel-first";
  held.set(marker, null);
  const first = repair(set, 0, marker);
  await waitFor(() => held.get(marker));
  const controller = new AbortController();
  const cancelled = repair(set, 1, "cancelled-queued", { signal: controller.signal });
  const cancelledResult = cancelled.then(() => null, (error) => error);
  await delay(50);
  controller.abort();
  await delay(50);
  finishImage(held.get(marker));
  held.delete(marker);
  assertSaved(await first);
  assert.equal((await cancelledResult)?.name, "AbortError");
  assertSaved(await repair(set, 1, "after-cancel"));
  assert.equal(requests.some((entry) => entry.body.prompt.includes("cancelled-queued")), false);
});

test("failed upstream requests release the set for another repair", async () => {
  const set = await seed("failure-release");
  const failed = await repair(set, 0, "fail-upstream");
  assert.equal(failed.some((event) => event.name === "item_saved"), false);
  assertSaved(await repair(set, 0, "after-failure"));
});

test("repairs for different sets can reach the upstream concurrently", async () => {
  const firstSet = await seed("independent-first");
  const secondSet = await seed("independent-second");
  const markers = ["hold-independent-first", "hold-independent-second"];
  for (const marker of markers) held.set(marker, null);
  const repairs = [repair(firstSet, 0, markers[0]), repair(secondSet, 0, markers[1])];
  await waitFor(() => markers.every((marker) => held.get(marker)));
  for (const marker of markers) { finishImage(held.get(marker)); held.delete(marker); }
  for (const events of await Promise.all(repairs)) assertSaved(events);
});

test("repair retains Temu data, export history and unchanged image cache", async () => {
  const set = await seed("temu-metadata");
  assertSaved(await repair(set, 1, "unchanged-image"));
  const initial = await store.readManifest(set.setId);
  const unchangedItem = initial.items[1];
  await store.saveManifest({
    ...initial, temuExport: { stock: 42, declaredPrice: 12.5 },
    temuExcelExportState: {
      version: 1, mode: "strict", exportedAt: new Date().toISOString(),
      sourceUpdatedAt: initial.updatedAt, rowCount: 1, issueCount: 0,
    },
  });
  await store.mergeTemuExcelImageCache(set.setId, new Map([[unchangedItem.itemId, {
    sourceRelativePath: unchangedItem.relativePath,
    sourceSha256: `sha256:${createHash("sha256").update(await readFile(join(root, "output", unchangedItem.relativePath))).digest("hex")}`,
    cloudName: "review", secureUrl: "https://res.cloudinary.com/review/image/upload/test.png",
  }]]));
  const beforeRepair = await store.readManifest(set.setId);
  assertSaved(await repair(set, 0, "repair-other-image"));
  const afterRepair = await store.readManifest(set.setId);
  for (const key of ["temuExport", "temuExcelExportState", "temuExcelImageCache"]) {
    assert.deepEqual(afterRepair[key], beforeRepair[key], key);
  }
  assert.equal(afterRepair.items[1].relativePath, unchangedItem.relativePath);
  assert.notEqual(afterRepair.updatedAt, beforeRepair.temuExcelExportState.sourceUpdatedAt);
});
