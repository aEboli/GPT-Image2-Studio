import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer as createHttpServer } from "node:http";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";

const serverPath = new URL("../server.mjs", import.meta.url);
const galleryStorePath = new URL("../lib/gallery-store.mjs", import.meta.url);
const creationStorePath = new URL("../lib/creation-store.mjs", import.meta.url);
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
  if (!server || server.exitCode !== null || server.signalCode) return;
  server.kill("SIGTERM");
  await Promise.race([
    once(server, "exit"),
    delay(1500).then(() => {
      if (server.exitCode === null && !server.signalCode) server.kill("SIGKILL");
    }),
  ]);
}

function collectDiagnostics(server) {
  const diagnostics = { stdout: "", stderr: "" };
  server.stdout?.setEncoding("utf8");
  server.stderr?.setEncoding("utf8");
  server.stdout?.on("data", (chunk) => { diagnostics.stdout += chunk; });
  server.stderr?.on("data", (chunk) => { diagnostics.stderr += chunk; });
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
      const response = await fetch(`${baseUrl}/api/config`);
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

test("server exposes independent creation generation and record endpoints", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /createCreationSetStore/);
  assert.match(server, /async function handleCreationGenerate/);
  assert.match(server, /async function handleCreationLogoBatchGenerate/);
  assert.match(server, /async function handleCreationSetsGet/);
  assert.match(server, /url\.pathname === "\/api\/creation\/generate"/);
  assert.match(server, /url\.pathname === "\/api\/creation\/logo-batch"/);
  assert.match(server, /url\.pathname === "\/api\/creation\/sets"/);
  assert.doesNotMatch(server, /mode=creation/);
});

test("creation record list responses are not cacheable", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /async function handleCreationSetsGet\(response\) \{/);
  assert.match(server, /function sendJson\(response, statusCode, payload, headers = \{\}\) \{/);
  assert.match(server, /const sets = await creationSetStore\.listManifests\(\);/);
  assert.match(server, /sendJson\(response, 200, sets\.map\(hydrateCreationListingDimensionsForRead\), \{\s*"Cache-Control": "no-store"/);
});

test("local static assets revalidate instead of being downloaded from scratch", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /function buildStaticEtag\(fileStat\) \{/);
  assert.match(server, /function isFreshStaticRequest\(request, etag, lastModified\) \{/);
  assert.match(server, /return isPublicAsset \|\| isLibraryAsset \? "no-cache" : null;/);
  assert.match(server, /"ETag": etag,/);
  assert.match(server, /"Last-Modified": lastModified,/);
  assert.match(server, /response\.writeHead\(304, headers\);/);
  assert.doesNotMatch(server, /isPublicAsset \|\| isLibraryAsset \? "no-store" : null;/);
});

test("static revalidation treats a stale etag as modified even when last-modified matches", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "static-etag-precedence-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const port = await getFreePort();
  const baseUrl = `http://127.0.0.1:${port}`;
  const server = spawn(process.execPath, ["server.mjs"], {
    cwd: rootDir,
    env: { ...process.env, PORT: String(port), VERCEL: "1", TMP: tempRoot, TEMP: tempRoot, IMAGE_STUDIO_OUTPUT_DIR: outputDir, IMAGE_STUDIO_LOCAL_DATA_DIR: localDataRootDir },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);
  t.after(async () => { await stopServer(server); await rm(tempRoot, { recursive: true, force: true }); });
  await waitForServer(baseUrl, server, diagnostics);
  const initialResponse = await fetch(`${baseUrl}/app.js?etag-precedence`);
  assert.equal(initialResponse.status, 200);
  await initialResponse.arrayBuffer();
  const etag = initialResponse.headers.get("etag");
  const lastModified = initialResponse.headers.get("last-modified");
  assert.ok(etag);
  assert.ok(lastModified);
  const staleEtagResponse = await fetch(`${baseUrl}/app.js?etag-precedence`, { headers: { "If-None-Match": `W/"stale-${etag}"`, "If-Modified-Since": lastModified } });
  assert.equal(staleEtagResponse.status, 200);
  await staleEtagResponse.arrayBuffer();
});

test("gallery API excludes historical generated images whose actual size is 1x1", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "invalid-gallery-result-"));
  const outputDir = join(tempRoot, "output");
  const localDataRootDir = join(tempRoot, "local-data");
  const { saveGeneratedAsset } = await import(galleryStorePath);
  await saveGeneratedAsset({
    outputDir,
    filename: "historical-white-result.png",
    imageBuffer: Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVQIHWP4////fwAJ+wP9KobjigAAAABJRU5ErkJggg==",
      "base64",
    ),
    metadata: {
      createdAt: "2026-08-21T11:07:36.000Z",
      size: "1024x1024",
      format: "png",
    },
  });

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

  const response = await fetch(`${baseUrl}/api/gallery`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), []);
});

test("local model list route returns structured errors for malformed request bodies", async () => {
  const server = await readFile(serverPath, "utf8");
  const handler = server.match(/async function handleModelListPost\(request, response\) \{[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGalleryGet/)?.[0] || "";
  assert.match(handler, /try\s*\{\s*const formData = await readFormDataBody\(request\);/);
  assert.match(handler, /sendJson\(response,\s*hasApiKey\s*\?\s*502\s*:\s*400/);
  assert.doesNotMatch(handler, /const formData = await readFormDataBody\(request\);\s*const config = mergeRequestPrivateConfig[\s\S]*?try\s*\{/);
});

test("model list route uses independent direct image and text provider settings", async (t) => {
  const upstreamRequests = [];
  const upstream = createHttpServer((request, response) => {
    upstreamRequests.push({
      pathname: new URL(request.url || "/", "http://localhost").pathname,
      authorization: request.headers.authorization || "",
    });
    response.writeHead(200, { "Content-Type": "application/json" });
    response.end(JSON.stringify({ data: [{ id: request.url?.includes("/image/") ? "image-model" : "text-model" }] }));
  });
  await new Promise((resolveListen, rejectListen) => {
    upstream.once("error", rejectListen);
    upstream.listen(0, "127.0.0.1", resolveListen);
  });
  const upstreamAddress = upstream.address();
  const upstreamBaseUrl = `http://127.0.0.1:${upstreamAddress.port}`;

  const tempRoot = await mkdtemp(join(tmpdir(), "direct-model-list-routing-"));
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
    await new Promise((resolveClose, rejectClose) => {
      upstream.close((error) => (error ? rejectClose(error) : resolveClose()));
    });
  });
  await waitForServer(baseUrl, server, diagnostics);

  const buildRequest = (modelTarget) => {
    const formData = new FormData();
    formData.set("modelTarget", modelTarget);
    formData.set("imageRoute", "b");
    formData.set("directImageBaseUrl", `${upstreamBaseUrl}/image/v1`);
    formData.set("directImageApiKey", "synthetic-image-key");
    formData.set("directImageEndpointPath", "images/generations");
    formData.set("directImageModel", "image-model");
    formData.set("directTextBaseUrl", `${upstreamBaseUrl}/text/v1`);
    formData.set("directTextApiKey", "synthetic-text-key");
    formData.set("directTextEndpointPath", "responses");
    formData.set("directTextModel", "text-model");
    return formData;
  };

  const imageResponse = await fetch(`${baseUrl}/api/models`, {
    method: "POST",
    body: buildRequest("direct"),
  });
  assert.equal(imageResponse.status, 200);
  assert.deepEqual(await imageResponse.json(), { ok: true, models: ["image-model"] });

  const textResponse = await fetch(`${baseUrl}/api/models`, {
    method: "POST",
    body: buildRequest("direct-responses"),
  });
  assert.equal(textResponse.status, 200);
  assert.deepEqual(await textResponse.json(), { ok: true, models: ["text-model"] });

  assert.deepEqual(upstreamRequests, [
    { pathname: "/image/v1/models", authorization: "Bearer synthetic-image-key" },
    { pathname: "/text/v1/models", authorization: "Bearer synthetic-text-key" },
  ]);
});

test("creation listing uses an independent medium reasoning default", async () => {
  const server = await readFile(serverPath, "utf8");
  const localHandler = server.match(/async function handleCreationListingsGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handlePortraitSetsGet/)?.[0] || "";
  assert.match(server, /const DEFAULT_CREATION_LISTING_REASONING_EFFORT = "medium";/);
  assert.match(localHandler, /payload\?\.reasoningEffort \|\| DEFAULT_CREATION_LISTING_REASONING_EFFORT/);
  assert.doesNotMatch(localHandler, /config\.defaults\?\.reasoningEffort/);
});

test("server saves creation assets into a dated creation folder and hides them from gallery", async () => {
  const server = await readFile(serverPath, "utf8");
  const galleryStore = await readFile(galleryStorePath, "utf8");
  const creationStore = await readFile(creationStorePath, "utf8");
  assert.match(server, /buildCreationRelativeDir/);
  assert.match(creationStore, /\$\{dateFolder\}-creation/);
  assert.match(server, /relativeDir:\s*creationRelativeDir/);
  assert.match(server, /assetKind:\s*"creation-image"/);
  assert.match(server, /galleryVisible:\s*false/);
  assert.match(galleryStore, /creationSetId/);
  assert.match(galleryStore, /creationItemId/);
  assert.match(galleryStore, /targetLanguage/);
});

test("daily output opener prepares separated mode folders", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /`\$\{todayDateFolder\}-prompt`/);
  assert.match(server, /`\$\{todayDateFolder\}-style-transfer`/);
  assert.match(server, /`\$\{todayDateFolder\}-reference-analysis`/);
  assert.match(server, /`\$\{todayDateFolder\}-image-decomposition`/);
  assert.match(server, /`\$\{todayDateFolder\}-ppt`/);
  assert.match(server, /`\$\{todayDateFolder\}-creation`/);
  assert.match(server, /`\$\{todayDateFolder\}-article`/);
});

test("server opens a selected creation set folder by manifest id", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /async function handleCreationSetFolderOpen/);
  assert.match(server, /url\.pathname === "\/api\/creation\/sets\/open-folder"/);
  assert.match(server, /creationSetStore\.readManifest\(setId\)/);
  assert.match(server, /set\.relativeDir/);
  assert.match(server, /resolveSafeOutputSubdirectory\(set\.relativeDir\)/);
  assert.match(server, /openDirectory\(targetDir\)/);
});

test("server returns safe full image paths for a selected creation set", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /function resolveSafeOutputPath\(relativePathValue\) \{/);
  assert.match(server, /async function handleCreationSetPathsGet/);
  assert.match(server, /url\.pathname === "\/api\/creation\/sets\/paths"/);
  assert.match(server, /creationSetStore\.readManifest\(setId\)/);
  assert.match(server, /resolveSafeOutputPath\(item\.relativePath\)/);
  assert.match(server, /absolutePath/);
  assert.match(server, /relativePath/);
});

test("local server has an isolated mock image path for creation regression tests", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /process\.env\.IMAGE_STUDIO_OUTPUT_DIR/);
  assert.match(server, /process\.env\.IMAGE_STUDIO_LOCAL_DATA_DIR/);
  assert.match(server, /process\.env\.IMAGE_STUDIO_MOCK_IMAGE_GENERATION === "1"/);
  assert.match(server, /process\.env\.IMAGE_STUDIO_ENABLE_TEST_MOCKS === "1"/);
  assert.match(server, /async function requestStudioImageGeneration/);
  assert.match(server, /decodeAndValidateGeneratedImage\(event\.base64, "上游生成结果"\)/);
  assert.match(server, /decodeAndValidateGeneratedImage\(finalBase64/);
  assert.match(server, /\.filter\(\(item\) => !isInvalidGeneratedImageMetadata\(item\)\)/);
  assert.doesNotMatch(server, /imageBuffer:\s*Buffer\.from\(normalizeBase64\(finalBase64\)/);
  assert.match(server, /type:\s*"final_image"/);
  assert.match(server, /finalImageBase64:\s*MOCK_IMAGE_BASE64/);
});

test("creation logo batch uses each uploaded image with the shared logo reference", async () => {
  const server = await readFile(serverPath, "utf8");
  const localHandler = server.match(/async function handleCreationLogoBatchGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  assert.match(server, /CREATION_LOGO_BATCH_REFERENCE_LABELS/);
  assert.match(localHandler, /formData\.getAll\("sourceImages"\)/);
  assert.match(localHandler, /readCreationLogoImage\(formData\)/);
  assert.match(localHandler, /buildCreationLogoBatchPlan/);
  assert.match(localHandler, /referenceImages:\s*\[sourceImage,\s*logoImage\]/);
  assert.match(localHandler, /referenceImageLabels:\s*CREATION_LOGO_BATCH_REFERENCE_LABELS/);
  assert.match(localHandler, /assetKind:\s*"creation-logo-batch-image"/);
});

test("local creation generation accepts references image count, marketing scenario, and industry template", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /formData\.get\("imageCount"\)/);
  assert.match(server, /formData\.get\("scenario"\)/);
  assert.match(server, /formData\.get\("industryTemplate"\)/);
  assert.match(server, /dimensionSpecs:\s*formData\.get\("dimensionSpecs"\)/);
  assert.match(server, /dimensionUnitMode:\s*formData\.get\("dimensionUnitMode"\)/);
  assert.match(server, /dimensionSpecs:\s*plan\.dimensionSpecs/);
  assert.match(server, /dimensionUnitMode:\s*plan\.dimensionUnitMode/);
  assert.match(server, /industryTemplatePath:\s*plan\.industryTemplatePath/);
  assert.match(server, /industryTemplate:\s*plan\.industryTemplate/);
  assert.match(server, /creationIndustryTemplate:\s*plan\.industryTemplate/);
  assert.match(server, /const referenceImages = await toReferenceImages/);
  assert.match(server, /referenceImageNames:\s*referenceImages\.map/);
  assert.match(server, /referenceImages,/);
  assert.match(server, /formData\.getAll\("logoImage"\)/);
  assert.match(server, /logoOptions:/);
  assert.doesNotMatch(server, /handleCreationGenerate[\s\S]*referenceImages:\s*\[\]/);
});

test("local creation generation labels uploaded reference image order", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /buildCreationItemReferenceImages/);
  assert.match(server, /buildCreationGenerationReferenceImageLabels/);
  assert.match(server, /const itemReferenceImages = buildCreationItemReferenceImages\(item,\s*referenceImages,\s*referenceImageRoles\);[\s\S]*referenceImageLabels:\s*buildCreationGenerationReferenceImageLabels\(\s*itemReferenceImages,\s*referenceImageRoles,\s*item,/);
  assert.match(server, /skuGenerationRule:\s*formData\.get\("skuGenerationRule"\)/);
});

test("local creation generation has no removed style-reference request path", async () => {
  const server = await readFile(serverPath, "utf8");
  const generateHandler = server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const repairHandler = server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";
  assert.doesNotMatch(server, /MAX_CREATION_STYLE_REFERENCE_IMAGES|styleReferenceImages|appendCreationStyleReferences/);
  assert.match(generateHandler, /appendCreationItemLogoReference\(\s*item,\s*itemReferenceImages,\s*logoImage/);
  assert.match(repairHandler, /appendCreationItemLogoReference\(\s*repairItem,\s*itemReferenceImages,\s*logoImage/);
  assert.match(generateHandler, /buildCreationItemGenerationPrompt\(item\.prompt,\s*itemGenerationParameters,\s*item\)/);
  assert.match(repairHandler, /buildCreationItemGenerationPrompt\(repairItem\.prompt,\s*itemGenerationParameters,\s*repairItem\)/);
});

test("local creation generation passes SKU subjects through planning", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /formData\.get\("visualLanguage"\)/);
  assert.match(server, /formData\.get\("skuSubjects"\)/);
  assert.match(server, /formData\.get\("skuBundleCount"\)/);
  assert.match(server, /skuSubjects:\s*plan\.skuSubjects/);
  assert.match(server, /skuBundleCount:\s*plan\.skuBundleCount/);
  assert.match(server, /visualLanguage:\s*plan\.visualLanguage/);
  assert.match(server, /visualLanguageLabel:\s*plan\.visualLanguageLabel/);
});

test("creation infographic rebuild option is passed through local planning, generation, repair, and manifests", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /handleCreationPlan[\s\S]*buildCreationPlan\(\{[\s\S]*skuGenerationEnabled:\s*formData\.get\("skuGenerationEnabled"\),[\s\S]*infographicRebuildEnabled:\s*formData\.get\("infographicRebuildEnabled"\)/);
  assert.match(server, /handleCreationGenerate[\s\S]*buildCreationSubmittedPlan\(\{[\s\S]*skuGenerationEnabled:\s*formData\.get\("skuGenerationEnabled"\),[\s\S]*infographicRebuildEnabled:\s*formData\.get\("infographicRebuildEnabled"\)/);
  assert.match(server, /skuGenerationEnabled:\s*plan\.skuGenerationEnabled/);
  assert.match(server, /infographicRebuildEnabled:\s*plan\.infographicRebuildEnabled/);
  const repairHandler = server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";
  assert.match(repairHandler, /repairPlan = buildCreationRepairPlan\(existingSet\)/);
  assert.doesNotMatch(repairHandler, /skuGenerationEnabled:\s*formData\.get|infographicRebuildEnabled:\s*formData\.get/);
});

test("creation record deletion exposes one validated batch endpoint", async () => {
  const server = await readFile(serverPath, "utf8");
  const store = await readFile(creationStorePath, "utf8");
  assert.match(server, /async function handleCreationSetsDelete\(request, response\)/);
  assert.match(server, /normalizeCreationRecordDeleteSetIds\(payload\.setIds\)/);
  assert.match(server, /creationSetStore\.deleteManifests\(setIds\)/);
  assert.match(server, /request\.method === "POST" && url\.pathname === "\/api\/creation\/sets\/delete"/);
  assert.match(store, /async function deleteManifests\(setIds/);
  assert.match(store, /enqueueManifestSave\(setId/);
  assert.match(store, /skippedUnsafePaths/);
});

test("creation saved filenames prefer SKU filename tokens over display titles", async () => {
  const server = await readFile(serverPath, "utf8");
  const conditionalTokenPattern = /const filenameTokenSource =\s*item\.role === "sku"\s*\? item\.filenameToken \|\| item\.title\s*: item\.title \|\| item\.filenameToken;[\s\S]*const filenameToken = sanitizeCreationFilenameToken\(filenameTokenSource \|\| item\.role \|\| item\.itemId,\s*"creation"\);/;
  assert.match(server, conditionalTokenPattern);
  assert.doesNotMatch(server, /sanitizeCreationFilenameToken\(item\.title \|\| item\.filenameToken/);
});

test("local creation reference uploads use the dedicated twelve-image limit", async () => {
  const server = await readFile(serverPath, "utf8");
  const analyzeHandler = server.match(/async function handleCreationReferenceAnalyze[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationPlan/)?.[0] || "";
  const generateHandler = server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const repairHandler = server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";
  assert.match(server, /MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(analyzeHandler, /referenceImages\.length > MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(generateHandler, /referenceImages\.length > MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(repairHandler, /referenceImages\.length > MAX_CREATION_REFERENCE_IMAGES/);
  assert.match(server, /sourceImages\.length > MAX_REFERENCE_IMAGES/);
});

test("local creation batch generation runs items with the configured parallel limit", async () => {
  const server = await readFile(serverPath, "utf8");
  const generateHandler = server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const logoBatchHandler = server.match(/async function handleCreationLogoBatchGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const repairHandler = server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";
  assert.match(server, /runWithConcurrency/);
  assert.match(generateHandler, /await runWithConcurrency\(\s*plan\.items,\s*MAX_CREATION_PARALLEL_TASKS,/);
  assert.match(logoBatchHandler, /await runWithConcurrency\(\s*plan\.items,\s*MAX_CREATION_PARALLEL_TASKS,/);
  assert.match(repairHandler, /await runWithConcurrency\(\s*repairItems,\s*MAX_CREATION_PARALLEL_TASKS,/);
});

test("local creation generation cancels bounded upstream work when the SSE lifecycle ends", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /const CREATION_UPSTREAM_TIMEOUT_MS = \(\(\) =>/);
  assert.match(server, /function createCreationRequestLifecycle\(response\) \{/);
  assert.match(server, /套图上游请求超时/);
  assert.match(server, /套图客户端连接已断开，已取消上游请求/);
  assert.match(server, /!response\.writableEnded && !response\.writableFinished/);
  assert.match(server, /statusHeartbeatMs: CREATION_STATUS_HEARTBEAT_MS/);
  assert.match(server, /signal: lifecycle\.signal/);
  assert.match(server, /async function requestCreationStudioImageGeneration\(response, options\)/);
  assert.match(server, /requestCreationStudioImageGeneration\(response, \{/);
  // A worker attaches its close listener only after winning a session slot, so an
  // already-closed response must abort immediately instead of waiting for a close
  // event that has already fired.
  assert.match(server, /if \(!isResponseWritable\(response\)\) \{\s*abort\("套图客户端连接已断开，已取消上游请求。"\);/);
  // Only abort-shaped errors may be relabelled with the lifecycle reason.
  assert.match(server, /if \(!abortMessage \|\| error\?\.name !== "AbortError"\) \{/);
});

test("local generation requests wait for a session slot instead of failing at the parallel cap", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /const SESSION_TASK_SLOT_RETRY_DELAY_MS = \d+;/);
  assert.match(server, /createSessionTaskSlotLimiter\(/);
  assert.match(server, /async function waitForSessionTaskSlot\(sessionId, taskId, requestScope, options = \{\}\) \{/);
  assert.match(server, /async function waitForResponseSessionTaskSlot\(sessionId, taskId, requestScope, response\) \{/);
  assert.match(server, /isActive: \(\) => isResponseWritable\(response\)/);
  assert.match(server, /await waitForResponseSessionTaskSlot\(clientSessionId, taskId, generationRequestScope, response\);/);
  assert.doesNotMatch(server, /if \(!claimSessionTaskSlot\(clientSessionId, taskId, generationRequestScope\)\) \{\s*throw new Error/);
});

test("local creation generation accepts reference role metadata", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /normalizeCreationReferenceRoles/);
  assert.match(server, /formData\.get\("referenceImageRoles"\)/);
  assert.match(server, /referenceImageRoles:\s*plan\.referenceImageRoles/);
  assert.match(server, /referenceImageRoles,/);
  assert.match(server, /metadata:\s*\{[\s\S]*referenceImageRoles,/);
});

test("local creation reference analysis has an independent route and does not write prompt history", async () => {
  const server = await readFile(serverPath, "utf8");
  const handler = server.match(/async function handleCreationReferenceAnalyze[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationGenerate/)?.[0] || "";
  assert.match(server, /CREATION_REFERENCE_ANALYSIS_MODE/);
  assert.match(server, /async function handleCreationReferenceAnalyze/);
  assert.match(server, /url\.pathname === "\/api\/creation\/reference\/analyze"/);
  assert.match(handler, /requestPromptAgentAnalysis/);
  assert.match(handler, /formData\.get\("platformLabel"\)/);
  assert.match(handler, /normalizeCreationPlatform/);
  assert.match(handler, /contextPrompt:/);
  assert.match(handler, /normalizeCreationReferenceAnalysis/);
  assert.doesNotMatch(handler, /promptAgentStore\.append/);
});

test("generic prompt agent routes do not inject Creation Mode context", async () => {
  const server = await readFile(serverPath, "utf8");
  const localHandler = server.match(/async function handlePromptAgentAnalyze[\s\S]*?\r?\n}\r?\n\r?\nfunction buildSavedItem/)?.[0] || "";
  assert.doesNotMatch(localHandler, /套图分析上下文|平台选择：|商品类目：|主图、详情页信息|SKU 对比|移动端缩略图/);
});

test("local creation reference analysis defaults to low reasoning effort", async () => {
  const server = await readFile(serverPath, "utf8");
  const localHandler = server.match(/async function handleCreationReferenceAnalyze[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationPlan/)?.[0] || "";
  assert.match(server, /CREATION_REFERENCE_ANALYSIS_REASONING_EFFORT/);
  assert.match(localHandler, /formData\.get\("reasoningEffort"\) \|\| CREATION_REFERENCE_ANALYSIS_REASONING_EFFORT/);
  assert.doesNotMatch(localHandler, /formData\.get\("reasoningEffort"\) \|\| config\.defaults\?\.reasoningEffort \|\| DEFAULT_REASONING_EFFORT/);
});

test("local creation generation accepts selected creation roles", async () => {
  const server = await readFile(serverPath, "utf8");
  assert.match(server, /formData\.get\("selectedRoles"\)/);
  assert.match(server, /selectedRoles:\s*formData\.get\("selectedRoles"\)/);
});

test("local creation plan preview exposes an independent route and shared overrides", async () => {
  const server = await readFile(serverPath, "utf8");
  const previewHandler = server.match(/async function handleCreationPlan[\s\S]*?\r?\n}\r?\n\r?\nasync function handle(?:PortraitGenerate|CreationGenerate)/)?.[0] || "";
  const generateHandler = server.match(/async function handleCreationGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  assert.match(server, /applyCreationPlanOverrides/);
  assert.match(server, /async function handleCreationPlan/);
  assert.match(server, /url\.pathname === "\/api\/creation\/plan"/);
  assert.match(server, /dimensionSpecs:\s*plan\.dimensionSpecs/);
  assert.match(server, /dimensionUnitMode:\s*plan\.dimensionUnitMode/);
  assert.match(previewHandler, /buildCreationPlan/);
  assert.match(previewHandler, /dimensionSpecs:\s*formData\.get\("dimensionSpecs"\)/);
  assert.match(previewHandler, /dimensionUnitMode:\s*formData\.get\("dimensionUnitMode"\)/);
  assert.match(previewHandler, /formData\.get\("planOverrides"\)/);
  assert.match(previewHandler, /sendJson\(response,\s*200,\s*\{\s*ok:\s*true,\s*plan/);
  assert.doesNotMatch(previewHandler, /mergeRequestPrivateConfig/);
  assert.match(generateHandler, /dimensionSpecs:\s*formData\.get\("dimensionSpecs"\)/);
  assert.match(generateHandler, /dimensionUnitMode:\s*formData\.get\("dimensionUnitMode"\)/);
  assert.match(generateHandler, /formData\.get\("planOverrides"\)/);
  assert.match(generateHandler, /buildCreationSubmittedPlan/);
});

test("creation repair route regenerates selected set items", async () => {
  const server = await readFile(serverPath, "utf8");
  const repair = await readFile(new URL("../lib/creation-repair.mjs", import.meta.url), "utf8");
  const repairHandler = server.match(/async function handleCreationRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleGenerate/)?.[0] || "";
  assert.match(server, /selectCreationRepairItems/);
  assert.match(server, /async function handleCreationRepair/);
  assert.match(server, /url\.pathname === "\/api\/creation\/repair"/);
  assert.match(server, /creationSetStore\.readManifest\(setId\)/);
  assert.match(server, /formData\.get\("itemId"\)/);
  assert.match(server, /formData\.get\("scope"\)/);
  assert.match(server, /formData\.get\("promptOverride"\)/);
  assert.match(server, /formData\.get\("marketingCopyOverride"\)/);
  assert.match(server, /hydrateCreationRepairSkuSubjects/);
  assert.match(server, /(const|let) repairItems = hydrateCreationRepairSkuSubjects\(\s*selectCreationRepairItems/);
  assert.match(repair, /dimensionSpecs:\s*creationSet\.dimensionSpecs/);
  assert.match(repair, /industryTemplatePath:\s*creationSet\.industryTemplatePath/);
  assert.match(server, /applyCreationRepairOverrides/);
  assert.match(server, /const filename = buildCreationImageFilename\(\{\s*item:\s*repairItem,/);
  assert.match(server, /prompt:\s*repairItem\.prompt/);
  assert.match(server, /buildCreationItemReferenceImages\(repairItem,\s*referenceImages,\s*referenceImageRoles\)/);
});
