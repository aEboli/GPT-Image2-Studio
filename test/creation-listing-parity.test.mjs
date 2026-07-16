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
import { generateCreationListingDrafts } from "../lib/creation-listing-agent.mjs";
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

const localizedCopy = {
  "en-US": {
    title: "Blue Storage Box 2 L Stackable Home Organizer",
    highlights: [
      "Supplied 2 L capacity keeps the size clear.",
      "Blue finish makes this supplied option easy to identify.",
      "Stackable shape supports tidy everyday storage.",
    ],
    description: "Blue storage box with the supplied 2 L capacity, stackable shape, and supplied dimensions.",
    searchTerms: ["blue storage box", "2 L organizer", "stackable storage"],
  },
  "zh-CN": {
    title: "蓝色2升可叠放家用收纳盒",
    highlights: ["已提供的2升容量便于核对规格。", "蓝色外观便于识别当前选项。", "可叠放造型适合日常收纳。"],
    description: "蓝色收纳盒采用已提供的2升容量、可叠放造型和尺寸信息。",
    searchTerms: ["蓝色收纳盒", "2升整理盒", "可叠放收纳"],
  },
  "ja-JP": {
    title: "青い2リットル積み重ね収納ボックス",
    highlights: ["提供された2リットル容量を確認できます。", "青色で選択肢を識別しやすくします。", "積み重ね形状で日常収納に使えます。"],
    description: "提供された2リットル容量、積み重ね形状、寸法情報を備えた青い収納ボックスです。",
    searchTerms: ["青い収納ボックス", "2リットル収納", "積み重ね収納"],
  },
  "ko-KR": {
    title: "파란색 2리터 적층형 수납 상자",
    highlights: ["제공된 2리터 용량을 확인할 수 있습니다.", "파란색으로 선택 옵션을 쉽게 구분합니다.", "적층형 모양으로 일상 수납에 사용합니다."],
    description: "제공된 2리터 용량과 적층형 모양 및 치수 정보를 담은 파란색 수납 상자입니다.",
    searchTerms: ["파란색 수납 상자", "2리터 정리함", "적층형 수납"],
  },
  "es-419": {
    title: "Caja azul apilable de 2 litros para organizar",
    highlights: ["La capacidad indicada de 2 litros aclara el tamaño.", "El acabado azul permite identificar la opción.", "La forma apilable facilita la organización diaria."],
    description: "Caja azul con la capacidad indicada de 2 litros, forma apilable y dimensiones proporcionadas.",
    searchTerms: ["caja azul apilable", "organizador 2 litros", "caja para organizar"],
  },
};

function makeValidV2Draft(source) {
  const policy = source.listingPolicy;
  const copy = localizedCopy[source.language] || localizedCopy["en-US"];
  return {
    schemaVersion: "2",
    platformId: source.platformId,
    platformLabel: source.platformLabel,
    marketplace: source.marketplace,
    listingPolicyVersion: source.listingPolicyVersion,
    language: source.language,
    title: copy.title,
    sellingPoints: [copy.highlights[0]],
    buyerObjections: ["Review the supplied dimensions before purchase."],
    highlights: copy.highlights,
    description: copy.description,
    searchTerms: copy.searchTerms,
    keywordBuckets: {
      exact: [copy.searchTerms[0]],
      longTail: [copy.searchTerms[1]],
      traffic: [copy.searchTerms[2]],
      descriptive: [copy.title],
    },
    evidence: ["product-input"],
    missingInfo: [],
    warnings: policy.warnings || [],
    status: "completed",
  };
}

function makeInvalidV2Draft(source) {
  return {
    ...makeValidV2Draft(source),
    title: "FDA Certified Miracle Cure Box",
    highlights: [],
    description: "Guaranteed best seller with a lifetime warranty and refund.",
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

test("shared, local, and Worker Listing paths keep policy requests, drafts, validation, and fallback equivalent", async (t) => {
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
    const result = await compareThreePaths(set, [makeValidV2Draft(source)]);
    assert.equal(source.listingPolicy.evidenceLevel, evidenceLevel, platform);
    assert.equal(result.draft.platformId, platform, platform);
    assert.equal(result.draft.language, expectedLocale, platform);
    assert.equal(result.draft.listingPolicyVersion, source.listingPolicyVersion, platform);
    assert.equal(result.validation.ok, true, `${platform}: ${result.validation.errors.join("; ")}`);
  }

  const legacySet = makeNormalizedSet({ id: "parity-legacy-missing", legacyMissing: true });
  const legacySource = buildCreationListingSources(legacySet)[0];
  const legacyResult = await compareThreePaths(legacySet, [makeValidV2Draft(legacySource)]);
  assert.equal(legacyResult.draft.platformId, "universal");
  assert.equal(legacyResult.draft.language, "en-US");
  assert.match(legacyResult.draft.warnings.join("\n"), /legacy-missing/i);

  const fallbackSet = makeNormalizedSet({
    id: "parity-temu-fallback",
    platform: "temu",
    targetLanguage: "English",
  });
  const fallbackSource = buildCreationListingSources(fallbackSet)[0];
  const invalidOutput = makeInvalidV2Draft(fallbackSource);
  const fallbackResult = await compareThreePaths(fallbackSet, [invalidOutput, invalidOutput]);
  assert.equal(fallbackResult.requests.length, 2);
  assert.equal(fallbackResult.draft.schemaVersion, "2");
  assert.equal(fallbackResult.draft.platformId, "temu");
  assert.equal(fallbackResult.draft.evidenceMode, "input-only");
  assert.ok(["needs-review", "failed"].includes(fallbackResult.draft.status));
  assert.match(fallbackResult.draft.warnings.join("\n"), /manual review|invalid/i);

  const fetchLog = (await readFile(fetchLogPath, "utf8"))
    .trim()
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => JSON.parse(line));
  assert.equal(fetchLog.length, cases.length + 1 + 2);
  assert.ok(fetchLog.every(({ url }) => url === responsesUrl));
});

test("local and Worker Listing endpoints delegate policy behavior without copying the registry", async () => {
  const [serverSource, workerSource] = await Promise.all([
    readFile(new URL("../server.mjs", import.meta.url), "utf8"),
    readFile(new URL("../cloudflare-pages-worker.mjs", import.meta.url), "utf8"),
  ]);
  for (const [label, source] of [["server", serverSource], ["Worker", workerSource]]) {
    assert.match(source, /import\s*\{\s*generateCreationListingDrafts\s*\}\s*from\s*["']\.\/lib\/creation-listing-agent\.mjs["']/);
    assert.doesNotMatch(source, /creation-listing-policies|CREATION_LISTING_(?:SOURCE|PLATFORM)|listing-policy-2026/i, label);
    for (const { url } of Object.values(CREATION_LISTING_SOURCE_REGISTER)) {
      assert.doesNotMatch(source, new RegExp(url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), label);
    }
  }
});
