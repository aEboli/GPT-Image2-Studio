import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const serverPath = new URL("../server.mjs", import.meta.url);
const galleryStorePath = new URL("../lib/gallery-store.mjs", import.meta.url);
const portraitStorePath = new URL("../lib/portrait-store.mjs", import.meta.url);
const cloudflareWorkerPath = new URL("../cloudflare-pages-worker.mjs", import.meta.url);

test("server exposes independent portrait generation and record endpoints", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /createPortraitSetStore/);
  assert.match(server, /async function handlePortraitReferenceAnalyze/);
  assert.match(server, /async function handlePortraitPlan/);
  assert.match(server, /async function handlePortraitGenerate/);
  assert.match(server, /async function handlePortraitRepair/);
  assert.match(server, /selectedShotTypes:\s*formData\.get\("selectedShotTypes"\)/);
  assert.match(server, /selectedActions:\s*formData\.get\("selectedActions"\)/);
  assert.match(server, /selectedShotTypes:\s*plan\.selectedShotTypes/);
  assert.match(server, /selectedActions:\s*plan\.selectedActions/);
  assert.match(server, /locationSelection:\s*plan\.locationSelection/);
  assert.match(server, /locationPrompt:\s*plan\.locationPrompt/);
  assert.match(server, /url\.pathname === "\/api\/portrait\/reference\/analyze"/);
  assert.match(server, /url\.pathname === "\/api\/portrait\/plan"/);
  assert.match(server, /url\.pathname === "\/api\/portrait\/generate"/);
  assert.match(server, /url\.pathname === "\/api\/portrait\/repair"/);
  assert.match(server, /url\.pathname === "\/api\/portrait\/sets"/);
  assert.doesNotMatch(server, /\/api\/creation\/portrait/);
});

test("portrait reference analysis defaults to low reasoning effort on server runtimes", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");

  for (const source of [server, worker]) {
    assert.match(source, /const PORTRAIT_REFERENCE_ANALYSIS_REASONING_EFFORT = "low";/);
    assert.match(
      source,
      /formData\.get\("reasoningEffort"\)\s*\|\|\s*PORTRAIT_REFERENCE_ANALYSIS_REASONING_EFFORT/,
    );
  }
});

test("portrait runtime keeps person references separate from styling accessory references", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");
  const analyzeHandler =
    server.match(/async function handlePortraitReferenceAnalyze[\s\S]*?\r?\n}\r?\n\r?\nasync function handlePortraitPlan/)?.[0] || "";
  const generateHandler =
    server.match(/async function handlePortraitGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationGenerate/)?.[0] || "";
  const repairHandler =
    server.match(/async function handlePortraitRepair[\s\S]*?\r?\n}\r?\n\r?\nasync function handleCreationRepair/)?.[0] || "";
  const workerAnalyzeHandler =
    worker.match(/async function handlePortraitReferenceAnalyze[\s\S]*?\r?\n}\r?\n\r?\nasync function handlePortraitPlan/)?.[0] || "";
  const workerGenerateHandler =
    worker.match(/async function runPortraitGenerate[\s\S]*?\r?\n}\r?\n\r?\nasync function runCreationLogoBatchGenerate/)?.[0] || "";

  assert.match(server, /MAX_PORTRAIT_PERSON_REFERENCE_IMAGES/);
  assert.match(server, /MAX_PORTRAIT_ACTION_REFERENCE_IMAGES/);
  assert.match(server, /MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES/);
  assert.match(worker, /MAX_PORTRAIT_PERSON_REFERENCE_IMAGES/);
  assert.match(worker, /MAX_PORTRAIT_ACTION_REFERENCE_IMAGES/);
  assert.match(worker, /MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES/);
  assert.match(analyzeHandler, /personReferenceImages\.length > MAX_PORTRAIT_PERSON_REFERENCE_IMAGES/);
  assert.match(analyzeHandler, /formData\.getAll\("portraitActionReferenceImages"\)/);
  assert.match(analyzeHandler, /formData\.getAll\("portraitAccessoryReferenceImages"\)/);
  assert.match(analyzeHandler, /actionReferenceImages\.length > MAX_PORTRAIT_ACTION_REFERENCE_IMAGES/);
  assert.match(analyzeHandler, /accessoryReferenceImages\.length > MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES/);
  assert.match(analyzeHandler, /(?:const\s+)?referenceImages = \[\.\.\.personReferenceImages, \.\.\.actionReferenceImages, \.\.\.accessoryReferenceImages\]/);
  assert.match(generateHandler, /formData\.getAll\("portraitActionReferenceImages"\)/);
  assert.match(generateHandler, /formData\.getAll\("portraitAccessoryReferenceImages"\)/);
  assert.doesNotMatch(generateHandler, /if \(personReferenceImages\.length === 0\)/);
  assert.match(generateHandler, /actionReferenceImages\.length > MAX_PORTRAIT_ACTION_REFERENCE_IMAGES/);
  assert.match(generateHandler, /accessoryReferenceImages\.length > MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES/);
  assert.match(generateHandler, /(?:const\s+)?referenceImages = \[\.\.\.personReferenceImages, \.\.\.actionReferenceImages, \.\.\.accessoryReferenceImages\]/);
  assert.match(repairHandler, /formData\.getAll\("portraitActionReferenceImages"\)/);
  assert.match(repairHandler, /formData\.getAll\("portraitAccessoryReferenceImages"\)/);
  assert.match(repairHandler, /actionReferenceImages\.length > MAX_PORTRAIT_ACTION_REFERENCE_IMAGES/);
  assert.match(repairHandler, /accessoryReferenceImages\.length > MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES/);
  assert.match(repairHandler, /(?:const\s+)?referenceImages = \[\.\.\.personReferenceImages, \.\.\.actionReferenceImages, \.\.\.accessoryReferenceImages\]/);
  assert.match(repairHandler, /referenceImageLabels/);
  assert.match(workerAnalyzeHandler, /personReferenceImages\.length > MAX_PORTRAIT_PERSON_REFERENCE_IMAGES/);
  assert.match(workerAnalyzeHandler, /formData\.getAll\("portraitActionReferenceImages"\)/);
  assert.match(workerAnalyzeHandler, /formData\.getAll\("portraitAccessoryReferenceImages"\)/);
  assert.match(workerAnalyzeHandler, /actionReferenceImages\.length > MAX_PORTRAIT_ACTION_REFERENCE_IMAGES/);
  assert.match(workerAnalyzeHandler, /accessoryReferenceImages\.length > MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES/);
  assert.match(workerAnalyzeHandler, /(?:const\s+)?referenceImages = \[\.\.\.personReferenceImages, \.\.\.actionReferenceImages, \.\.\.accessoryReferenceImages\]/);
  assert.match(workerGenerateHandler, /formData\.getAll\("portraitActionReferenceImages"\)/);
  assert.match(workerGenerateHandler, /formData\.getAll\("portraitAccessoryReferenceImages"\)/);
  assert.doesNotMatch(workerGenerateHandler, /if \(personReferenceImages\.length === 0\)/);
  assert.match(workerGenerateHandler, /actionReferenceImages\.length > MAX_PORTRAIT_ACTION_REFERENCE_IMAGES/);
  assert.match(workerGenerateHandler, /accessoryReferenceImages\.length > MAX_PORTRAIT_ACCESSORY_REFERENCE_IMAGES/);
  assert.match(workerGenerateHandler, /(?:const\s+)?referenceImages = \[\.\.\.personReferenceImages, \.\.\.actionReferenceImages, \.\.\.accessoryReferenceImages\]/);
});

test("portrait runtime labels clothing references as mandatory wardrobe authorities", async () => {
  const server = await readFile(serverPath, "utf8");
  const worker = await readFile(cloudflareWorkerPath, "utf8");

  for (const source of [server, worker]) {
    assert.match(source, /Portrait clothing, prop, and accessory reference/);
    assert.match(source, /WARDROBE LOCK/);
    assert.match(source, /must wear the supplied outfit/);
    assert.match(source, /Do not replace it with a generic blazer, suit, dress, or everyday outfit/);
    assert.match(source, /do not treat it as another person identity/);
  }
});

test("portrait record list responses are not cacheable", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /async function handlePortraitSetsGet\(response\) \{/);
  assert.match(server, /sendJson\(response, 200, await portraitSetStore\.listManifests\(\), \{\s*"Cache-Control": "no-store"/);
});

test("server saves portrait assets into a dated portrait folder and hides them from gallery", async () => {
  const server = await readFile(serverPath, "utf8");
  const galleryStore = await readFile(galleryStorePath, "utf8");
  const portraitStore = await readFile(portraitStorePath, "utf8");

  assert.match(server, /buildPortraitRelativeDir/);
  assert.match(portraitStore, /\$\{dateFolder\}-portrait/);
  assert.match(server, /relativeDir:\s*portraitRelativeDir/);
  assert.match(server, /assetKind:\s*"portrait-image"/);
  assert.match(server, /generationMode:\s*"portrait"/);
  assert.match(server, /galleryVisible:\s*false/);
  assert.match(galleryStore, /portraitSetId/);
  assert.match(galleryStore, /portraitItemId/);
  assert.match(galleryStore, /portraitStyle/);
  assert.match(server, /portraitAction:\s*item\.action/);
  assert.match(galleryStore, /subjectSummary/);
});

test("daily output opener prepares portrait folders", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /`\$\{todayDateFolder\}-portrait`/);
});

test("server opens and reports safe paths for selected portrait set folders", async () => {
  const server = await readFile(serverPath, "utf8");

  assert.match(server, /async function handlePortraitSetFolderOpen/);
  assert.match(server, /async function handlePortraitSetPathsGet/);
  assert.match(server, /portraitSetStore\.readManifest\(setId\)/);
  assert.match(server, /resolveSafeOutputSubdirectory\(set\.relativeDir\)/);
  assert.match(server, /resolveSafeOutputPath\(item\.relativePath\)/);
  assert.match(server, /url\.pathname === "\/api\/portrait\/sets\/open-folder"/);
  assert.match(server, /url\.pathname === "\/api\/portrait\/sets\/paths"/);
});

test("cloudflare worker exposes portrait generate routes and unsupported local record actions", async () => {
  const worker = await readFile(cloudflareWorkerPath, "utf8");

  assert.match(worker, /buildPortraitPlan/);
  assert.match(worker, /async function runPortraitGenerate/);
  assert.match(worker, /selectedActions:\s*formData\.get\("selectedActions"\)/);
  assert.match(worker, /selectedActions:\s*plan\.selectedActions/);
  assert.match(worker, /portraitLocationSelection/);
  assert.match(worker, /locationName:\s*plan\.locationName/);
  assert.match(worker, /url\.pathname === "\/api\/portrait\/reference\/analyze"/);
  assert.match(worker, /url\.pathname === "\/api\/portrait\/plan"/);
  assert.match(worker, /url\.pathname === "\/api\/portrait\/generate"/);
  assert.match(worker, /url\.pathname === "\/api\/portrait\/sets"/);
  assert.match(worker, /\/api\/portrait\/repair/);
  assert.match(worker, /buildUnsupportedRuntimeCapabilityPayload\("cloudflare", request\.method, url\.pathname\)/);
});
