import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createServer as createHttpServer } from "node:http";
import { mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { File } from "node:buffer";
import { setTimeout as delay } from "node:timers/promises";

import { validateCreationListingDraft } from "../lib/creation-listing-draft.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

async function getFreePort() {
  const server = createTcpServer();
  await new Promise((resolveListen, reject) => {
    server.once("error", reject);
    server.listen(0, "127.0.0.1", resolveListen);
  });
  const address = server.address();
  await new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
  return address.port;
}

async function stopServer(server) {
  if (!server || server.exitCode !== null || server.signalCode) {
    return;
  }

  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    delay(1500).then(() => {
      if (server.exitCode === null && !server.signalCode) {
        server.kill("SIGKILL");
      }
    }),
  ]);
}

async function stopHttpServer(server) {
  if (!server?.listening) {
    return;
  }
  await new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

function collectDiagnostics(server) {
  const diagnostics = {
    stdout: "",
    stderr: "",
  };
  server.stdout?.setEncoding("utf8");
  server.stderr?.setEncoding("utf8");
  server.stdout?.on("data", (chunk) => {
    diagnostics.stdout += chunk;
  });
  server.stderr?.on("data", (chunk) => {
    diagnostics.stderr += chunk;
  });
  return diagnostics;
}

async function waitForServer(baseUrl, server, diagnostics) {
  const deadline = Date.now() + 7000;
  let lastError = null;

  while (Date.now() < deadline) {
    if (server.exitCode !== null) {
      throw new Error(`server exited early (${server.exitCode})\n${diagnostics.stderr}\n${diagnostics.stdout}`);
    }

    try {
      const response = await fetch(`${baseUrl}/api/creation/sets`);
      if (response.status < 500) {
        await response.arrayBuffer();
        return;
      }
    } catch (error) {
      lastError = error;
    }

    await delay(100);
  }

  throw new Error(`server did not start: ${lastError?.message || "timeout"}\n${diagnostics.stderr}`);
}

function parseSseEvents(text) {
  return text
    .split(/\r?\n\r?\n/)
    .map((chunk) => {
      const eventName = chunk.match(/^event:\s*(.+)$/m)?.[1] || "";
      const data = [...chunk.matchAll(/^data:\s?(.*)$/gm)].map((match) => match[1]).join("\n");
      return eventName && data ? { eventName, payload: JSON.parse(data) } : null;
    })
    .filter(Boolean);
}

function escapeRegExp(value) {
  return String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function makeReferenceFile(filename = "front.png") {
  return new File(["front-reference"], filename, { type: "image/png" });
}

function makeCreationForm(overrides = {}) {
  const formData = new FormData();
  formData.set("productName", "Regression Serum");
  formData.set("productDescription", "Lightweight serum for reusable creation workflow regression");
  formData.set("sellingPoints", "hydrating\ntravel friendly\nsmooth texture");
  formData.set("targetLanguage", "en");
  formData.set("imageCount", "4");
  formData.set("scenario", "detail-page");
  formData.set("visualLanguage", "lifestyle-editorial");
  formData.set("industryTemplate", "beauty");
  formData.set("selectedRoles", JSON.stringify(["hero", "benefit", "accessory-gift", "after-sales"]));
  formData.set(
    "referenceImageRoles",
    JSON.stringify([{ filename: "front.png", role: "product", note: "manual historical binding" }]),
  );

  if (overrides.includeReferenceImage !== false) {
    formData.append("referenceImages", makeReferenceFile(), "front.png");
  }

  formData.set("ratio", "1:1");
  formData.set("size", "1024x1024");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "http://127.0.0.1:9/v1");
  formData.set("apiKey", "test-key");
  formData.set("responsesModel", "gpt-5.4");
  formData.set("clientSessionId", "creation-e2e-session");

  for (const [key, value] of Object.entries(overrides.fields || {})) {
    formData.set(key, value);
  }

  return formData;
}

function makeLogoBatchForm(overrides = {}) {
  const formData = new FormData();
  formData.set("title", "Logo batch invalid settings");
  formData.set("ratio", "1:1");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "http://127.0.0.1:9/v1");
  formData.set("apiKey", "test-key");
  formData.set("responsesModel", "gpt-5.4");
  formData.set("clientSessionId", "creation-logo-batch-e2e-session");
  formData.append("sourceImages", new File(["front-reference"], "front.png", { type: "image/png" }));
  formData.append("logoImage", new File(["logo-reference"], "brand-mark.png", { type: "image/png" }));

  for (const [key, value] of Object.entries(overrides.fields || {})) {
    formData.set(key, value);
  }

  return formData;
}

async function postForm(baseUrl, pathname, formData) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    body: formData,
  });
  const text = await response.text();
  return {
    response,
    text,
    events: parseSseEvents(text),
  };
}

async function postJson(baseUrl, pathname, payload) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
  return {
    response,
    body: await response.json(),
  };
}

async function findCreationManifestPath(outputDir, setId) {
  const manifestsDir = join(outputDir, "json", "creation-sets");
  const entries = await readdir(manifestsDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) {
      continue;
    }

    const candidatePath = join(manifestsDir, entry.name);
    const candidate = JSON.parse(await readFile(candidatePath, "utf8"));
    if (candidate.setId === setId) {
      return candidatePath;
    }
  }

  throw new Error(`Missing creation manifest for ${setId}`);
}

function getCompleteSet(events) {
  const complete = events.find((event) => event.eventName === "complete");
  assert.ok(complete, "expected complete SSE event");
  assert.ok(complete.payload.set, "complete event should include the set manifest");
  return complete.payload.set;
}

function summarizeCreationEvents(events = []) {
  return events
    .map((event) => ({
      eventName: event.eventName,
      itemId: event.payload.itemId || event.payload.item?.itemId || "",
      message: event.payload.message || event.payload.item?.error || "",
      setStatus: event.payload.set?.status || "",
      itemStatus: event.payload.item?.status || "",
    }))
    .filter((entry) => entry.eventName !== "item_partial_image" && entry.eventName !== "item_final_image");
}

function summarizeCreationItems(set = {}) {
  return (set.items || []).map((item) => ({
    itemId: item.itemId,
    status: item.status,
    filename: item.filename,
    relativePath: item.relativePath,
    error: item.error,
  }));
}

test("logo batch validation errors do not create empty completed set records", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-logo-batch-invalid-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      VERCEL: "1",
      TMP: tempRoot,
      TEMP: tempRoot,
      IMAGE_STUDIO_MOCK_IMAGE_GENERATION: "1",
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const result = await postForm(baseUrl, "/api/creation/logo-batch", makeLogoBatchForm());
  assert.equal(result.response.status, 200);
  assert.match(result.text, /不支持分辨率 1024x1280/);
  assert.equal(result.events.some((event) => event.eventName === "complete"), false);

  const setsResponse = await fetch(`${baseUrl}/api/creation/sets`);
  assert.equal(setsResponse.status, 200);
  assert.deepEqual(await setsResponse.json(), []);
});

test("creation workflow reuses history, reuploads references, tweaks prompts, repairs items, and exposes asset paths", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-e2e-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      VERCEL: "1",
      TMP: tempRoot,
      TEMP: tempRoot,
      IMAGE_STUDIO_MOCK_IMAGE_GENERATION: "1",
      IMAGE_STUDIO_MOCK_LISTING_AGENT: "1",
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const planResponse = await fetch(`${baseUrl}/api/creation/plan`, {
    method: "POST",
    body: makeCreationForm({ includeReferenceImage: false }),
  });
  assert.equal(planResponse.status, 200);
  const planBody = await planResponse.json();
  assert.equal(planBody.ok, true);
  assert.equal(planBody.plan.industryTemplate, "beauty");
  assert.equal(planBody.plan.visualLanguage, "lifestyle-editorial");
  assert.equal(planBody.plan.items.length, 4);
  assert.equal(planBody.plan.items[0].itemId, "1-hero");
  assert.match(planBody.plan.items[0].prompt, /manual historical binding/);
  assert.match(planBody.plan.items[0].prompt, /Industry template:/);
  assert.match(planBody.plan.items[1].prompt, /Shared visual language:/);
  assert.match(planBody.plan.items[1].prompt, /lifestyle magazine editorial/);

  const generateResult = await postForm(
    baseUrl,
    "/api/creation/generate",
    makeCreationForm({
      fields: {
        planOverrides: JSON.stringify([{ itemId: "1-hero", prompt: "Custom hero prompt from regression." }]),
      },
    }),
  );
  assert.equal(generateResult.response.status, 200);
  assert.deepEqual(
    generateResult.events.filter((event) => event.eventName === "error"),
    [],
    generateResult.text,
  );
  const generatedSet = getCompleteSet(generateResult.events);
  assert.equal(generatedSet.status, "completed");
  assert.equal(generatedSet.industryTemplate, "beauty");
  assert.equal(generatedSet.visualLanguage, "lifestyle-editorial");
  assert.equal(generatedSet.visualLanguageLabel, "生活方式杂志");
  assert.equal(generatedSet.referenceImageRoles[0].filename, "front.png");
  assert.equal(generatedSet.referenceImageRoles[0].note, "manual historical binding");
  assert.equal(generatedSet.items.length, 4);
  assert.equal(generatedSet.items.filter((item) => item.status === "completed").length, 4);
  assert.equal(generatedSet.items[0].prompt, "Custom hero prompt from regression.");
  assert.match(generatedSet.items[1].prompt, /Shared visual language:/);
  assert.match(generatedSet.items[1].prompt, /lifestyle magazine editorial/);
  assert.ok(generatedSet.items[0].relativePath);
  assert.match(generatedSet.items[0].filename, /^01-首屏主视觉-\d{6}-[^-]+-\d{6}-[a-z0-9]{4}\.png$/u);
  assert.match(generatedSet.items[1].filename, /^02-核心卖点图-\d{6}-[^-]+-\d{6}-[a-z0-9]{4}\.png$/u);
  assert.match(generatedSet.items[2].filename, /^03-配件赠品图-\d{6}-[^-]+-\d{6}-[a-z0-9]{4}\.png$/u);
  assert.match(generatedSet.items[3].filename, /^04-售后保障图-\d{6}-[^-]+-\d{6}-[a-z0-9]{4}\.png$/u);
  assert.doesNotMatch(generatedSet.items.map((item) => item.filename).join("\n"), /\b(?:hero|benefit|accessory|gift|after|sales)\b/i);

  const listResponse = await fetch(`${baseUrl}/api/creation/sets`);
  assert.equal(listResponse.status, 200);
  const sets = await listResponse.json();
  assert.ok(sets.some((set) => set.setId === generatedSet.setId), "generated set should appear in records");

  const listingResponse = await postJson(baseUrl, "/api/creation/listings", { setId: generatedSet.setId });
  assert.equal(listingResponse.response.status, 200);
  assert.equal(listingResponse.body.ok, true);
  assert.equal(listingResponse.body.set.setId, generatedSet.setId);
  assert.equal(listingResponse.body.set.listingDrafts.length, 1);
  assert.equal(listingResponse.body.set.listingDrafts[0].evidenceMode, "image-backed");

  const listedAfterListingsResponse = await fetch(`${baseUrl}/api/creation/sets`);
  assert.equal(listedAfterListingsResponse.status, 200);
  const listedAfterListings = await listedAfterListingsResponse.json();
  const listedSet = listedAfterListings.find((set) => set.setId === generatedSet.setId);
  assert.equal(listedSet.listingDrafts.length, 1);

  const manifestPath = await findCreationManifestPath(outputDir, generatedSet.setId);
  const persistedListingManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(persistedListingManifest.listingDrafts.length, 1);
  assert.equal(persistedListingManifest.listingDrafts[0].evidenceMode, "image-backed");

  const initialPathReport = await postJson(baseUrl, "/api/creation/sets/paths", { setId: generatedSet.setId });
  assert.equal(initialPathReport.response.status, 200);
  assert.ok(
    initialPathReport.body.absoluteDir.startsWith(outputDir),
    `expected ${initialPathReport.body.absoluteDir} to stay under ${outputDir}`,
  );

  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  manifest.items[1] = {
    ...manifest.items[1],
    status: "failed",
    filename: "",
    relativePath: "",
    imageUrl: "",
    thumbnailUrl: "",
    error: "forced regression gap",
  };
  manifest.status = "partial_failed";
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");

  const repairIncompleteResult = await postForm(
    baseUrl,
    "/api/creation/repair",
    makeCreationForm({
      fields: {
        setId: generatedSet.setId,
        scope: "incomplete",
      },
    }),
  );
  assert.equal(repairIncompleteResult.response.status, 200);
  assert.deepEqual(
    repairIncompleteResult.events.filter((event) => event.eventName === "error"),
    [],
    repairIncompleteResult.text,
  );
  const repairedSet = getCompleteSet(repairIncompleteResult.events);
  assert.equal(
    repairedSet.status,
    "completed",
    JSON.stringify(
      {
        events: summarizeCreationEvents(repairIncompleteResult.events),
        items: summarizeCreationItems(repairedSet),
      },
      null,
      2,
    ),
  );
  assert.equal(repairedSet.items[1].status, "completed");
  assert.ok(repairedSet.items[1].relativePath);

  const regenerateResult = await postForm(
    baseUrl,
    "/api/creation/repair",
    makeCreationForm({
      fields: {
        setId: generatedSet.setId,
        itemId: generatedSet.items[0].itemId,
        promptOverride: "Regenerated hero prompt from regression.",
      },
    }),
  );
  assert.equal(regenerateResult.response.status, 200);
  assert.deepEqual(
    regenerateResult.events.filter((event) => event.eventName === "error"),
    [],
    regenerateResult.text,
  );
  const regeneratedSet = getCompleteSet(regenerateResult.events);
  assert.equal(regeneratedSet.status, "completed");
  assert.equal(regeneratedSet.items[0].prompt, "Regenerated hero prompt from regression.");

  const pathReport = await postJson(baseUrl, "/api/creation/sets/paths", { setId: generatedSet.setId });
  assert.equal(pathReport.response.status, 200);
  assert.equal(pathReport.body.setId, generatedSet.setId);
  assert.equal(pathReport.body.items.length, 4);
  assert.ok(pathReport.body.absoluteDir.startsWith(outputDir));
  assert.ok(pathReport.body.items.every((item) => item.absolutePath.startsWith(outputDir)));

  const postRepairManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(postRepairManifest.listingDrafts.length, 1);
  assert.equal(postRepairManifest.listingDrafts[0].id, listingResponse.body.set.listingDrafts[0].id);
});

test("creation listing endpoint degrades to input-only when images failed", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-listing-e2e-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      VERCEL: "1",
      TMP: tempRoot,
      TEMP: tempRoot,
      IMAGE_STUDIO_MOCK_LISTING_AGENT: "1",
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const manifestsDir = join(outputDir, "json", "creation-sets");
  await mkdir(manifestsDir, { recursive: true });
  await writeFile(
    join(manifestsDir, "creation-set-failed.json"),
    `${JSON.stringify({
      setId: "creation-set-failed",
      productName: "Blue Fishing Lure",
      productDescription: "Compact lure for freshwater fishing.",
      dimensionSpecs: "3.5 in",
      skuBundleCount: 2,
      status: "failed",
      items: [{ itemId: "1-hero", role: "hero", status: "failed", error: "upstream failed" }],
    }, null, 2)}\n`,
    "utf8",
  );

  const listingResponse = await postJson(baseUrl, "/api/creation/listings", { setId: "creation-set-failed" });
  assert.equal(listingResponse.response.status, 200);
  assert.equal(listingResponse.body.set.listingDrafts.length, 1);
  assert.equal(listingResponse.body.set.listingDrafts[0].evidenceMode, "input-only");
  assert.match(listingResponse.body.set.listingDrafts[0].warnings.join("\n"), /Generated images were unavailable/);

  const persistedManifest = JSON.parse(await readFile(join(manifestsDir, "creation-set-failed.json"), "utf8"));
  assert.equal(persistedManifest.listingDrafts.length, 1);
  assert.equal(persistedManifest.listingDrafts[0].evidenceMode, "input-only");
});

test("creation listing endpoint preserves grouped mixed pack wording through validation and persistence", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-listing-mixed-packs-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      VERCEL: "1",
      TMP: tempRoot,
      TEMP: tempRoot,
      IMAGE_STUDIO_MOCK_LISTING_AGENT: "1",
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const manifestsDir = join(outputDir, "json", "creation-sets");
  await mkdir(manifestsDir, { recursive: true });

  const writeGroupedManifest = async ({ setId, skuBundleCount }) => {
    await writeFile(
      join(manifestsDir, `${setId}.json`),
      `${JSON.stringify({
        setId,
        productName: "Electronic Fishing Lure",
        productDescription: "Two grouped SKU subjects represent two-pack and three-pack choices.",
        sellingPoints: ["propeller action", "multi-color grouped choices"],
        skuBundleCount,
        status: "completed",
        skuSubjects: [
          {
            id: "two-lures",
            title: "Two lure colorways",
            filenames: ["two-lures.png"],
            subjectUnitCount: 2,
            note: "2 complete visible product units in one grouped SKU subject.",
          },
          {
            id: "three-lures",
            title: "Three lure colorways",
            filenames: ["three-lures.png"],
            subjectUnitCount: 3,
            note: "3 complete visible product units in one grouped SKU subject.",
          },
        ],
        items: [{ itemId: "1-hero", role: "hero", status: "failed", error: "upstream failed" }],
      }, null, 2)}\n`,
      "utf8",
    );
  };

  const assertListingPackText = async ({ setId, expectedPackText }) => {
    const listingResponse = await postJson(baseUrl, "/api/creation/listings", { setId });
    assert.equal(listingResponse.response.status, 200);
    assert.equal(listingResponse.body.ok, true);
    assert.equal(listingResponse.body.listingDrafts.length, 1);
    assert.equal(listingResponse.body.set.listingDrafts.length, 1);

    const responseDraft = listingResponse.body.listingDrafts[0];
    const setDraft = listingResponse.body.set.listingDrafts[0];
    const validationOptions = {
      expectedQuantity: expectedPackText,
      forbidTitleSpecs: true,
    };
    assert.match(responseDraft.title, new RegExp(`^${escapeRegExp(expectedPackText)} Electronic Fishing Lure\\b`));
    assert.equal(setDraft.title, responseDraft.title);
    assert.deepEqual(validateCreationListingDraft(responseDraft, validationOptions).errors, []);

    const persistedManifest = JSON.parse(await readFile(join(manifestsDir, `${setId}.json`), "utf8"));
    assert.equal(persistedManifest.listingDrafts.length, 1);
    assert.equal(persistedManifest.listingDrafts[0].title, responseDraft.title);
    assert.deepEqual(validateCreationListingDraft(persistedManifest.listingDrafts[0], validationOptions).errors, []);
  };

  await writeGroupedManifest({ setId: "creation-set-mixed-pack-plain", skuBundleCount: 1 });
  await assertListingPackText({
    setId: "creation-set-mixed-pack-plain",
    expectedPackText: "2 Pack / 3 Pack",
  });

  await writeGroupedManifest({ setId: "creation-set-mixed-pack-bundled", skuBundleCount: 2 });
  await assertListingPackText({
    setId: "creation-set-mixed-pack-bundled",
    expectedPackText: "4 Pack / 6 Pack",
  });
});

test("creation listing endpoint merges drafts into latest manifest after upstream delay", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-listing-merge-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const appServer = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      VERCEL: "1",
      TMP: tempRoot,
      TEMP: tempRoot,
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(appServer);
  let upstreamServer = null;

  t.after(async () => {
    await stopHttpServer(upstreamServer);
    await stopServer(appServer);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, appServer, diagnostics);

  const manifestsDir = join(outputDir, "json", "creation-sets");
  const manifestPath = join(manifestsDir, "creation-set-merge.json");
  const originalManifest = {
    setId: "creation-set-merge",
    productName: "Original Fishing Lure",
    productDescription: "Compact lure for freshwater fishing.",
    dimensionSpecs: "3.5 in",
    skuBundleCount: 1,
    status: "completed",
    items: [{ itemId: "1-hero", role: "hero", status: "completed", prompt: "old prompt", relativePath: "x/hero.png" }],
  };
  await mkdir(manifestsDir, { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(originalManifest, null, 2)}\n`, "utf8");

  upstreamServer = createHttpServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/responses") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: "not found" }));
      return;
    }

    for await (const _chunk of request) {
      // Drain the request body so the client can finish cleanly.
    }

    await writeFile(
      manifestPath,
      `${JSON.stringify({
        ...originalManifest,
        productName: "Updated Fishing Lure",
        status: "partial_failed",
        items: [{ ...originalManifest.items[0], status: "failed", prompt: "new prompt", error: "repair changed item" }],
      }, null, 2)}\n`,
      "utf8",
    );
    await delay(50);
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({
      output_text: JSON.stringify({
        title: "1 Pack Blue Fishing Lure Bass Freshwater Bait Compact Tackle",
        sellingPoints: ["Blue profile helps organize fishing lure variants."],
        painPoints: ["Flat lure movement can be ignored in stained water; the blue profile helps the bait stay noticeable."],
        fiveBullets: [
          "CORE VALUE: 1 Pack 8.89 cm (3.5 in) size keeps quantity and dimensions visible.",
          "BUILT TO LAST: Blue lure profile supports clear SKU identification.",
          "REAL-LIFE USE: Compact design works for bass fishing presentations.",
          "SIZE & FIT: Compact profile keeps size and color details easy to compare.",
          "PACKAGE SNAPSHOT: Keyword-focused copy keeps listing language concise.",
        ],
        description: "Blue fishing lure option for US marketplace shoppers comparing compact freshwater tackle.",
        backendSearchTerms: "blue fishing lure bass bait compact lure",
        keywordBuckets: {
          exact: ["blue fishing lure"],
          longTail: ["3.5 in bass lure"],
          traffic: ["freshwater bait"],
          descriptive: ["compact blue lure"],
        },
        missingInfo: [],
        warnings: [],
      }),
    }));
  });
  await new Promise((resolveListen, reject) => {
    upstreamServer.once("error", reject);
    upstreamServer.listen(0, "127.0.0.1", resolveListen);
  });
  const upstreamAddress = upstreamServer.address();

  const listingResponse = await postJson(baseUrl, "/api/creation/listings", {
    setId: "creation-set-merge",
    baseUrl: `http://127.0.0.1:${upstreamAddress.port}/v1`,
    apiKey: "test-key",
    responsesModel: "gpt-5.4",
    reasoningEffort: "low",
  });
  assert.equal(listingResponse.response.status, 200);
  assert.equal(listingResponse.body.set.productName, "Updated Fishing Lure");
  assert.equal(listingResponse.body.set.items[0].prompt, "new prompt");
  assert.equal(listingResponse.body.set.items[0].status, "failed");
  assert.equal(listingResponse.body.set.listingDrafts.length, 1);

  const persistedManifest = JSON.parse(await readFile(manifestPath, "utf8"));
  assert.equal(persistedManifest.productName, "Updated Fishing Lure");
  assert.equal(persistedManifest.items[0].prompt, "new prompt");
  assert.equal(persistedManifest.items[0].status, "failed");
  assert.equal(persistedManifest.listingDrafts.length, 1);
});

test("creation listing endpoint returns JSON error when API key is missing outside mock mode", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-listing-missing-key-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(port),
      VERCEL: "1",
      TMP: tempRoot,
      TEMP: tempRoot,
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const manifestsDir = join(outputDir, "json", "creation-sets");
  await mkdir(manifestsDir, { recursive: true });
  await writeFile(
    join(manifestsDir, "creation-set-needs-key.json"),
    `${JSON.stringify({
      setId: "creation-set-needs-key",
      productName: "Blue Fishing Lure",
      status: "completed",
      items: [{ itemId: "1-hero", role: "hero", status: "completed", relativePath: "x/hero.png" }],
    }, null, 2)}\n`,
    "utf8",
  );

  const listingResponse = await postJson(baseUrl, "/api/creation/listings", { setId: "creation-set-needs-key" });
  assert.equal(listingResponse.response.status, 400);
  assert.match(listingResponse.body.message, /API key/i);
});
