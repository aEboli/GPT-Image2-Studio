import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { createServer as createHttpServer } from "node:http";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import test from "node:test";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath, pathToFileURL } from "node:url";

import { handleApiRequest } from "../cloudflare-pages-worker.mjs";
import {
  generateCreationListingDrafts,
  makeMockCreationListingDraft,
} from "../lib/creation-listing-agent.mjs";
import {
  buildCreationListingSources,
  validateCreationListingDraft,
} from "../lib/creation-listing-draft.mjs";
import { CREATION_LISTING_SOURCE_REGISTER } from "../lib/creation-listing-policies.mjs";
import { normalizeCreationSetManifest } from "../lib/creation-store.mjs";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const fetchGuardUrl = new URL("./helpers/creation-listing-fetch-guard.mjs", import.meta.url);
const createdAt = "2026-07-15T00:00:00.000Z";

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

async function stopChildProcess(child) {
  if (!child || child.exitCode !== null || child.signalCode) return;
  child.kill("SIGTERM");
  await Promise.race([
    once(child, "exit"),
    delay(1500).then(() => {
      if (child.exitCode === null && !child.signalCode) child.kill("SIGKILL");
    }),
  ]);
}

async function stopHttpServer(server) {
  if (!server?.listening) return;
  await new Promise((resolveClose, reject) => {
    server.close((error) => (error ? reject(error) : resolveClose()));
  });
}

function collectDiagnostics(child) {
  const diagnostics = { stdout: "", stderr: "" };
  child.stdout?.setEncoding("utf8");
  child.stderr?.setEncoding("utf8");
  child.stdout?.on("data", (chunk) => { diagnostics.stdout += chunk; });
  child.stderr?.on("data", (chunk) => { diagnostics.stderr += chunk; });
  return diagnostics;
}

async function waitForLocalServer(baseUrl, child, diagnostics) {
  const deadline = Date.now() + 8000;
  let lastError;
  while (Date.now() < deadline) {
    if (child.exitCode !== null) {
      throw new Error(`server exited early (${child.exitCode})\n${diagnostics.stderr}\n${diagnostics.stdout}`);
    }
    try {
      const response = await fetch(`${baseUrl}/api/creation/sets`);
      await response.arrayBuffer();
      if (response.status < 500) return;
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw new Error(`server did not start: ${lastError?.message || "timeout"}\n${diagnostics.stderr}`);
}

async function readJsonBody(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function makeInjectedFetch(expectedUrl, outputs, requests) {
  let index = 0;
  return async (url, init) => {
    assert.equal(String(url), expectedUrl);
    requests.push(JSON.parse(init.body));
    const output = outputs[Math.min(index, outputs.length - 1)];
    index += 1;
    return new Response(JSON.stringify({ output_text: JSON.stringify(output) }), {
      status: 200,
      headers: { "content-type": "application/json" },
    });
  };
}

function withoutVolatileTimestamps(value) {
  if (Array.isArray(value)) return value.map(withoutVolatileTimestamps);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([key]) => !["createdAt", "updatedAt"].includes(key))
      .map(([key, nested]) => [key, withoutVolatileTimestamps(nested)]),
  );
}

function makeNormalizedSet({ id, platform, targetLanguage, legacyMissing = false }) {
  const raw = {
    setId: id,
    productName: "Blue Storage Box",
    productDescription: "Blue storage box with a supplied 2 L capacity and stackable shape.",
    sellingPoints: ["Supplied 2 L capacity", "Stackable shape"],
    dimensionSpecs: "20 x 12 x 10 cm",
    dimensionUnitMode: "metric",
    status: "completed",
    createdAt,
    updatedAt: createdAt,
    items: [{ itemId: "1-hero", role: "hero", status: "failed", prompt: "Saved prompt" }],
  };
  if (!legacyMissing) {
    Object.assign(raw, {
      platform,
      platformPolicyId: platform,
      platformProvenance: "explicit",
      targetLanguage,
      effectivePlan: {
        platform,
        platformPolicyId: platform,
        platformProvenance: "explicit",
        targetLanguage,
      },
    });
  }
  // Match the stable shape seen after a persisted manifest is read by the local handler.
  return normalizeCreationSetManifest(normalizeCreationSetManifest(raw));
}

function makeValidV1Draft(source) {
  return makeMockCreationListingDraft({
    ...source,
    schemaVersion: "",
    forceV1: true,
    forceV2: false,
  });
}

function makeIncompatibleV1Draft(source) {
  return {
    ...makeValidV1Draft(source),
    zhDisplay: null,
  };
}

function validationSnapshot(draft, set) {
  const source = buildCreationListingSources(set)[0];
  return withoutVolatileTimestamps(validateCreationListingDraft(draft, {
    policy: source.listingPolicy,
    sourceFacts: source,
    source,
    dimensionUnitMode: source.dimensionUnitMode,
  }));
}

async function postJson(baseUrl, pathname, payload) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  return { response, body: await response.json() };
}

test("shared, local, and Worker Listing paths keep successful output and explicit failures equivalent", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "creation-listing-parity-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const fetchLogPath = join(tempRoot, "fetch-log.jsonl");
  const manifestsDir = join(outputDir, "json", "creation-sets");
  await mkdir(manifestsDir, { recursive: true });

  const localUpstream = { outputs: [], requests: [] };
  const upstreamServer = createHttpServer(async (request, response) => {
    if (request.method !== "POST" || request.url !== "/v1/responses") {
      response.writeHead(404, { "content-type": "application/json" });
      response.end(JSON.stringify({ message: "unexpected upstream route" }));
      return;
    }
    localUpstream.requests.push(await readJsonBody(request));
    const output = localUpstream.outputs.shift();
    assert.ok(output, "local upstream output queue must not be empty");
    response.writeHead(200, { "content-type": "application/json" });
    response.end(JSON.stringify({ output_text: JSON.stringify(output) }));
  });
  await new Promise((resolveListen, reject) => {
    upstreamServer.once("error", reject);
    upstreamServer.listen(0, "127.0.0.1", resolveListen);
  });
  const upstreamPort = upstreamServer.address().port;
  const responsesUrl = `http://127.0.0.1:${upstreamPort}/v1/responses`;
  const config = {
    baseUrl: `http://127.0.0.1:${upstreamPort}/v1`,
    apiKey: "parity-key",
    responsesModel: "parity-model",
    reasoningEffort: "low",
  };

  const appPort = await getFreePort();
  const localBaseUrl = `http://127.0.0.1:${appPort}`;
  const appServer = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: {
      ...process.env,
      PORT: String(appPort),
      VERCEL: "1",
      TMP: tempRoot,
      TEMP: tempRoot,
      IMAGE_STUDIO_OUTPUT_DIR: outputDir,
      IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir,
      CREATION_LISTING_ALLOWED_FETCH_URL: responsesUrl,
      CREATION_LISTING_FETCH_LOG: fetchLogPath,
      NODE_OPTIONS: `${process.env.NODE_OPTIONS || ""} --import=${pathToFileURL(fileURLToPath(fetchGuardUrl)).href}`.trim(),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(appServer);

  t.after(async () => {
    await stopChildProcess(appServer);
    await stopHttpServer(upstreamServer);
    await rm(tempRoot, { recursive: true, force: true });
  });
  await waitForLocalServer(localBaseUrl, appServer, diagnostics);

  async function compareThreePaths(set, outputs) {
    await writeFile(join(manifestsDir, `${set.setId}.json`), `${JSON.stringify(set, null, 2)}\n`, "utf8");
    const directRequests = [];
    const workerRequests = [];
    const localRequestStart = localUpstream.requests.length;
    localUpstream.outputs.push(...outputs.map((output) => structuredClone(output)));

    const directDrafts = await generateCreationListingDrafts({
      set,
      config,
      fetchImpl: makeInjectedFetch(responsesUrl, outputs, directRequests),
    });
    const workerResponse = await handleApiRequest(new Request("https://studio.example/api/creation/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, set }),
    }), {
      fetchImpl: makeInjectedFetch(responsesUrl, outputs, workerRequests),
    });
    const workerBody = await workerResponse.json();
    const localResult = await postJson(localBaseUrl, "/api/creation/listings", { setId: set.setId, ...config });
    const localRequests = localUpstream.requests.slice(localRequestStart);

    assert.equal(workerResponse.status, 200);
    assert.equal(localResult.response.status, 200, JSON.stringify(localResult.body));
    assert.deepEqual(withoutVolatileTimestamps(workerRequests), withoutVolatileTimestamps(directRequests));
    assert.deepEqual(withoutVolatileTimestamps(localRequests), withoutVolatileTimestamps(directRequests));

    const drafts = [directDrafts[0], workerBody.listingDrafts[0], localResult.body.listingDrafts[0]];
    assert.deepEqual(withoutVolatileTimestamps(drafts[1]), withoutVolatileTimestamps(drafts[0]));
    assert.deepEqual(withoutVolatileTimestamps(drafts[2]), withoutVolatileTimestamps(drafts[0]));
    const validations = drafts.map((draft) => validationSnapshot(draft, set));
    assert.deepEqual(validations[1], validations[0]);
    assert.deepEqual(validations[2], validations[0]);
    return { draft: drafts[0], requests: directRequests, validation: validations[0] };
  }

  async function compareThreePathFailures(set, output) {
    await writeFile(join(manifestsDir, `${set.setId}.json`), `${JSON.stringify(set, null, 2)}\n`, "utf8");
    const directRequests = [];
    const workerRequests = [];
    const localRequestStart = localUpstream.requests.length;
    localUpstream.outputs.push(structuredClone(output));
    let directError;

    await assert.rejects(
      generateCreationListingDrafts({
        set,
        config,
        fetchImpl: makeInjectedFetch(responsesUrl, [output], directRequests),
      }),
      (error) => {
        directError = error;
        return /Listing generation failed validation/i.test(error?.message || "");
      },
    );
    const workerResponse = await handleApiRequest(new Request("https://studio.example/api/creation/listings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...config, set }),
    }), {
      fetchImpl: makeInjectedFetch(responsesUrl, [output], workerRequests),
    });
    const workerBody = await workerResponse.json();
    const localResult = await postJson(localBaseUrl, "/api/creation/listings", { setId: set.setId, ...config });
    const localRequests = localUpstream.requests.slice(localRequestStart);

    assert.equal(workerResponse.status, 502);
    assert.equal(localResult.response.status, 502);
    assert.equal(workerBody.message, directError.message);
    assert.equal(localResult.body.message, directError.message);
    assert.deepEqual(withoutVolatileTimestamps(workerRequests), withoutVolatileTimestamps(directRequests));
    assert.deepEqual(withoutVolatileTimestamps(localRequests), withoutVolatileTimestamps(directRequests));

    return JSON.parse(await readFile(join(manifestsDir, `${set.setId}.json`), "utf8"));
  }

  const cases = [
    ["amazon", "English", "A", "en-US"],
    ["etsy", "English", "A", "en-US"],
    ["temu", "English", "C", "en-US"],
    ["jd", "简体中文", "B", "zh-CN"],
    ["rakuten", "日本語", "B", "ja-JP"],
    ["coupang", "한국어", "A", "ko-KR"],
    ["mercado-libre", "Español", "C", "es-419"],
  ];
  for (const [platform, targetLanguage, evidenceLevel, expectedLocale] of cases) {
    const set = makeNormalizedSet({ id: `parity-${platform}`, platform, targetLanguage });
    const source = buildCreationListingSources(set)[0];
    const result = await compareThreePaths(set, [makeValidV1Draft(source)]);
    assert.equal(source.listingPolicy.evidenceLevel, evidenceLevel, platform);
    assert.equal(result.draft.platformId, platform, platform);
    assert.equal(result.draft.language, expectedLocale, platform);
    assert.equal(result.draft.schemaVersion, undefined, platform);
    assert.ok(result.draft.fiveBullets.length > 0, platform);
    assert.equal(result.draft.status, "completed", platform);
    assert.ok(result.draft.title, platform);
    assert.ok(result.draft.zhDisplay?.title, platform);
  }

  const legacySet = makeNormalizedSet({ id: "parity-legacy-missing", legacyMissing: true });
  const legacySource = buildCreationListingSources(legacySet)[0];
  const legacyResult = await compareThreePaths(legacySet, [makeValidV1Draft(legacySource)]);
  assert.equal(legacyResult.draft.platformId, "universal");
  assert.equal(legacyResult.draft.language, "en-US");
  assert.equal(Object.prototype.hasOwnProperty.call(legacyResult.draft, "warnings"), false);
  assert.ok(legacyResult.draft.fiveBullets.length > 0);

  const sanitizationSet = makeNormalizedSet({
    id: "parity-etsy-low-risk-sanitization",
    platform: "etsy",
    targetLanguage: "English",
  });
  const sanitizationSource = buildCreationListingSources(sanitizationSet)[0];
  const sanitizationOutput = makeValidV1Draft(sanitizationSource);
  Object.assign(sanitizationOutput, {
    title: `${sanitizationOutput.title} Adjustable Gray Black Rechargeable Compatible with Reel X.`,
    description: `${sanitizationOutput.description} Adjustable gray black rechargeable details. Compatible with Reel X.`,
    painPoints: ["Need a clear option? Review the supplied package."],
    fiveBullets: sanitizationOutput.fiveBullets.slice(0, 3),
    backendSearchTerms: "adjustable gray black rechargeable",
    keywordBuckets: {
      exact: ["adjustable"],
      longTail: ["gray"],
      traffic: ["black"],
      descriptive: ["rechargeable"],
    },
    zhDisplay: {
      ...sanitizationOutput.zhDisplay,
      title: `${sanitizationOutput.zhDisplay.title}兼容 Reel X。`,
      description: `${sanitizationOutput.zhDisplay.description}兼容 Reel X。`,
    },
  });
  const sanitizationResult = await compareThreePaths(sanitizationSet, [sanitizationOutput]);
  const sanitizedEnglish = [
    sanitizationResult.draft.title,
    sanitizationResult.draft.description,
    sanitizationResult.draft.backendSearchTerms,
    ...Object.values(sanitizationResult.draft.keywordBuckets).flat(),
  ].join("\n");
  assert.doesNotMatch(sanitizedEnglish, /\b(?:adjustable|gray|black|rechargeable)\b/i);
  assert.doesNotMatch(sanitizedEnglish, /compatible\s+with|Reel X/iu);
  assert.doesNotMatch(
    `${sanitizationResult.draft.zhDisplay.title}\n${sanitizationResult.draft.zhDisplay.description}`,
    /兼容|Reel X/u,
  );
  assert.equal(sanitizationResult.draft.backendSearchTerms, "");
  assert.deepEqual(Object.values(sanitizationResult.draft.keywordBuckets).flat(), []);

  const failureSet = makeNormalizedSet({
    id: "parity-temu-failure",
    platform: "temu",
    targetLanguage: "English",
  });
  const failureSource = buildCreationListingSources(failureSet)[0];
  const existingDraft = makeValidV1Draft(failureSource);
  failureSet.listingDrafts = [existingDraft];
  const persistedFailureSet = await compareThreePathFailures(
    failureSet,
    makeIncompatibleV1Draft(failureSource),
  );
  assert.deepEqual(persistedFailureSet.listingDrafts, [existingDraft]);

  const fetchLog = (await readFile(fetchLogPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(fetchLog.length, cases.length + 1 + 1 + 1);
  assert.ok(fetchLog.every(({ url }) => url === responsesUrl));
});

test("local and Worker Listing endpoints delegate policy behavior without copying the registry", async () => {
  const [serverSource, workerSource] = await Promise.all([
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../cloudflare-pages-worker.mjs", import.meta.url), "utf8"),
  ]);
  for (const [label, source] of [["server", serverSource], ["Worker", workerSource]]) {
    assert.match(source, /import\s*\{[^}]*\bgenerateCreationListingDrafts\b[^}]*\}\s*from\s*["']\.\/lib\/creation-listing-agent\.mjs["']/);
    assert.doesNotMatch(source, /creation-listing-policies|CREATION_LISTING_(?:SOURCE|PLATFORM)|listing-policy-2026/i, label);
    for (const { url } of Object.values(CREATION_LISTING_SOURCE_REGISTER)) {
      assert.doesNotMatch(source, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), label);
    }
  }
});
