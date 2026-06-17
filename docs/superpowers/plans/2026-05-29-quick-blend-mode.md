# Quick Blend Mode Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a `快速溶图` Create mode that pairs A/B uploads by order and queues one generated A-above-B cutout composition per pair.

**Architecture:** Add `mode=quick-blend` to the existing single-image `/api/generate` path instead of creating a new route. Browser state owns A/B upload order and pair previews; local server and Cloudflare Worker validate exactly two references per queued job and share one prompt helper.

**Tech Stack:** Node ESM, native `node:test`, plain HTML/CSS/JavaScript, existing SSE generation protocol, existing gallery-store metadata flow, Cloudflare Pages Worker module.

---

## File Structure

- Create `lib/quick-blend-prompt.mjs`: shared constants, reference labels, metadata field names, and prompt builder.
- Create `test/quick-blend-prompt.test.mjs`: helper-level tests.
- Create `test/quick-blend-server.test.mjs`: local `/api/generate` Quick Blend tests.
- Modify `server.mjs`: import the helper, allow `quick-blend`, validate two references, build prompt, persist metadata, and label references.
- Modify `cloudflare-pages-worker.mjs`: mirror local validation, prompt, labels, and metadata.
- Modify `lib/gallery-store.mjs`: route Quick Blend files into `quick-blend` folders and expose Quick Blend metadata in saved/listed items.
- Modify `public/index.html`: add navigation and the `#quick-blend` view shell.
- Modify `public/app.js`: add state, refs, upload handling, pair validation, job creation, form-data fields, task polling integration, generated preview keys, and cleanup.
- Modify `public/styles.css`: add Quick Blend layout and responsive styling.
- Modify `lib/view-mode-loader.mjs`, `lib/views/quick-blend-view.mjs`, and `test/view-mode-loader.test.mjs`: register the lazy view module.
- Modify `test/studio-preview-layout.test.mjs`: cover static UI, mode registration, and frontend request shape.
- Modify `openspec/changes/add-quick-blend-mode/tasks.md`: mark completed tasks as implementation lands.

---

### Task 1: Prompt Helper

**Files:**
- Create: `test/quick-blend-prompt.test.mjs`
- Create: `lib/quick-blend-prompt.mjs`
- Modify: `openspec/changes/add-quick-blend-mode/tasks.md`

- [ ] **Step 1: Write the failing helper test**

Create `test/quick-blend-prompt.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  QUICK_BLEND_ASSET_KIND,
  QUICK_BLEND_METADATA_FIELDS,
  QUICK_BLEND_MODE,
  QUICK_BLEND_REFERENCE_LABELS,
  buildQuickBlendPrompt,
  normalizeQuickBlendPairIndex,
} from "../lib/quick-blend-prompt.mjs";

test("quick blend helper defines mode, asset kind, labels, and metadata fields", () => {
  assert.equal(QUICK_BLEND_MODE, "quick-blend");
  assert.equal(QUICK_BLEND_ASSET_KIND, "quick-blend");
  assert.deepEqual(QUICK_BLEND_METADATA_FIELDS, [
    "quickBlendPairIndex",
    "quickBlendAImageName",
    "quickBlendBImageName",
  ]);
  assert.equal(QUICK_BLEND_REFERENCE_LABELS.length, 2);
  assert.match(QUICK_BLEND_REFERENCE_LABELS[0], /Reference image 1: A image/i);
  assert.match(QUICK_BLEND_REFERENCE_LABELS[1], /Reference image 2: B image/i);
});

test("quick blend prompt extracts visible subjects and stacks A above B", () => {
  const result = buildQuickBlendPrompt({
    pairIndex: "2",
    aImageName: "A dress.png",
    bImageName: "B shoe.png",
  });

  assert.equal(result.pairIndex, "2");
  assert.equal(result.aImageName, "A dress.png");
  assert.equal(result.bImageName, "B shoe.png");
  assert.match(result.prompt, /first reference image as A/i);
  assert.match(result.prompt, /second reference image as B/i);
  assert.match(result.prompt, /A subject group above the B subject group/i);
  assert.match(result.prompt, /remove or neutralize the original backgrounds/i);
  assert.match(result.prompt, /preserve subject shape, colors, materials, markings, proportions, and identity cues/i);
  assert.match(result.prompt, /Do not add text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements/i);
  assert.doesNotMatch(result.prompt, /grid of all uploaded images/i);
  assert.doesNotMatch(result.prompt, /every possible combination/i);
});

test("quick blend pair index normalization stays positive and string based", () => {
  assert.equal(normalizeQuickBlendPairIndex(1), "1");
  assert.equal(normalizeQuickBlendPairIndex("03"), "3");
  assert.equal(normalizeQuickBlendPairIndex("0"), "1");
  assert.equal(normalizeQuickBlendPairIndex("abc"), "1");
});
```

- [ ] **Step 2: Run the helper test and verify RED**

Run: `node --test test\quick-blend-prompt.test.mjs`

Expected: FAIL with module-not-found for `lib/quick-blend-prompt.mjs`.

- [ ] **Step 3: Implement the helper**

Create `lib/quick-blend-prompt.mjs`:

```js
export const QUICK_BLEND_MODE = "quick-blend";
export const QUICK_BLEND_ASSET_KIND = "quick-blend";
export const QUICK_BLEND_METADATA_FIELDS = Object.freeze([
  "quickBlendPairIndex",
  "quickBlendAImageName",
  "quickBlendBImageName",
]);

export const QUICK_BLEND_REFERENCE_LABELS = Object.freeze([
  "Reference image 1: A image. Use only the visible A subject or subjects. Preserve identity cues, shape, color, material, markings, and proportions. Do not render this label.",
  "Reference image 2: B image. Use only the visible B subject or subjects. Preserve identity cues, shape, color, material, markings, and proportions. Do not render this label.",
]);

export function normalizeQuickBlendPairIndex(value = 1) {
  const parsed = Number.parseInt(String(value || "1").trim(), 10);
  return String(Number.isFinite(parsed) && parsed > 0 ? parsed : 1);
}

export function buildQuickBlendPrompt({ pairIndex = 1, aImageName = "", bImageName = "" } = {}) {
  const normalizedPairIndex = normalizeQuickBlendPairIndex(pairIndex);
  const normalizedAImageName = String(aImageName || "").trim();
  const normalizedBImageName = String(bImageName || "").trim();
  const sourceLine = [
    `Quick Blend pair ${normalizedPairIndex}.`,
    normalizedAImageName ? `A filename: ${normalizedAImageName}.` : "",
    normalizedBImageName ? `B filename: ${normalizedBImageName}.` : "",
  ].filter(Boolean).join(" ");

  return {
    prompt: [
      sourceLine,
      "Use the first reference image as A and the second reference image as B.",
      "Extract the visible main subject or subjects from A and B. Remove or neutralize the original backgrounds so the final image reads like clean cutout composition work.",
      "Arrange the A subject group above the B subject group in one vertical image. Keep both groups centered, separated by clean spacing, and scaled so both are easy to inspect.",
      "Preserve subject shape, colors, materials, markings, proportions, pose, and identity cues from each source image. Do not redesign, recolor, relabel, or merge the two subjects into one object.",
      "Use a clean neutral studio background or transparent-looking neutral surface. Keep the composition product-like and uncluttered.",
      "Do not add text, labels, watermarks, unrelated objects, invented logos, or decorative scene elements.",
      "Do not create a grid of all uploaded images and do not create every possible combination. Generate only this matched A/B pair.",
    ].join(" "),
    pairIndex: normalizedPairIndex,
    aImageName: normalizedAImageName,
    bImageName: normalizedBImageName,
  };
}
```

- [ ] **Step 4: Run the helper test and verify GREEN**

Run: `node --test test\quick-blend-prompt.test.mjs`

Expected: PASS.

- [ ] **Step 5: Update OpenSpec task progress**

Change `openspec/changes/add-quick-blend-mode/tasks.md`:

```md
- [x] 2.1 Add failing tests for Quick Blend mode constants, reference labels, prompt constraints, and metadata field names.
- [x] 2.2 Implement the shared Quick Blend prompt helper.
```

- [ ] **Step 6: Commit Task 1**

Run:

```bash
git add lib/quick-blend-prompt.mjs test/quick-blend-prompt.test.mjs openspec/changes/add-quick-blend-mode/tasks.md
git commit -m "feat: add quick blend prompt helper"
```

---

### Task 2: Local API And Gallery Metadata

**Files:**
- Create: `test/quick-blend-server.test.mjs`
- Modify: `server.mjs`
- Modify: `lib/gallery-store.mjs`
- Modify: `openspec/changes/add-quick-blend-mode/tasks.md`

- [ ] **Step 1: Write the failing local API test**

Create `test/quick-blend-server.test.mjs`. Copy these helper functions unchanged from `test/image-decomposition-server.test.mjs`: `getFreePort`, `stopServer`, `collectDiagnostics`, `waitForServer`, `parseSseEvents`, and `findJsonFiles`. Then add this Quick Blend-specific form builder and tests:

```js
import test from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { File } from "node:buffer";
import { mkdtemp, readdir, readFile, rm } from "node:fs/promises";
import { createServer as createTcpServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { once } from "node:events";
import { setTimeout as delay } from "node:timers/promises";

const rootDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function makeQuickBlendForm(overrides = {}) {
  const formData = new FormData();
  formData.set("jobId", "quick-blend-local");
  formData.set("mode", "quick-blend");
  formData.set("quickBlendPairIndex", "2");
  formData.set("quickBlendAImageName", "a-dress.png");
  formData.set("quickBlendBImageName", "b-shoe.png");
  formData.set("ratio", "4:5");
  formData.set("size", "auto");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "http://127.0.0.1:9/v1");
  formData.set("apiKey", "test-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.set("clientSessionId", "quick-blend-session");
  formData.append("referenceImages", new File(["a"], "a-dress.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["b"], "b-shoe.png", { type: "image/png" }));

  for (const [key, value] of Object.entries(overrides.fields || {})) {
    formData.set(key, value);
  }
  if (overrides.referenceFiles) {
    formData.delete("referenceImages");
    for (const file of overrides.referenceFiles) {
      formData.append("referenceImages", file);
    }
  }

  return formData;
}

test("local generate accepts quick blend without a user prompt and saves pair metadata", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "quick-blend-"));
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

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeQuickBlendForm(),
  });
  const text = await response.text();
  const events = parseSseEvents(text);
  const saved = events.find((event) => event.eventName === "saved");

  assert.equal(response.status, 200);
  assert.deepEqual(events.filter((event) => event.eventName === "error"), [], text);
  assert.ok(saved, "expected saved SSE event");
  assert.equal(saved.payload.item.generationMode, "quick-blend");
  assert.equal(saved.payload.item.assetKind, "quick-blend");
  assert.equal(saved.payload.item.quickBlendPairIndex, "2");
  assert.equal(saved.payload.item.quickBlendAImageName, "a-dress.png");
  assert.equal(saved.payload.item.quickBlendBImageName, "b-shoe.png");
  assert.deepEqual(saved.payload.item.referenceImageNames, ["a-dress.png", "b-shoe.png"]);
  assert.match(saved.payload.item.prompt, /A subject group above the B subject group/i);
  assert.match(saved.payload.item.relativePath, /quick-blend/);

  const jsonFiles = await findJsonFiles(join(outputDir, "json"));
  const metadata = await Promise.all(jsonFiles.map(async (filePath) => JSON.parse(await readFile(filePath, "utf8"))));
  assert.ok(metadata.some((entry) =>
    entry.assetKind === "quick-blend" &&
    entry.quickBlendPairIndex === "2" &&
    entry.quickBlendAImageName === "a-dress.png" &&
    entry.quickBlendBImageName === "b-shoe.png"
  ));
});

test("local generate rejects quick blend when reference image count is not exactly two", async (t) => {
  const tempRoot = await mkdtemp(join(tmpdir(), "quick-blend-count-"));
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
      IMAGE_STUDIO_OUTPUT_DIR: join(tempRoot, "output"),
      IMAGE_STUDIO_LOCAL_DATA_DIR: join(tempRoot, "local-data"),
    },
    stdio: ["ignore", "pipe", "pipe"],
  });
  const diagnostics = collectDiagnostics(server);

  t.after(async () => {
    await stopServer(server);
    await rm(tempRoot, { recursive: true, force: true });
  });

  await waitForServer(baseUrl, server, diagnostics);

  const response = await fetch(`${baseUrl}/api/generate`, {
    method: "POST",
    body: makeQuickBlendForm({
      referenceFiles: [new File(["a"], "a-only.png", { type: "image/png" })],
    }),
  });
  const events = parseSseEvents(await response.text());
  const error = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.ok(error, "expected error SSE event");
  assert.match(error.payload.message, /Quick Blend|快速溶图|exactly two|两张/);
});
```

- [ ] **Step 2: Run the local API test and verify RED**

Run: `node --test test\quick-blend-server.test.mjs`

Expected: FAIL because `quick-blend` is not an allowed generation mode and metadata is missing.

- [ ] **Step 3: Extend gallery metadata and output routing**

In `lib/gallery-store.mjs`, add the Quick Blend metadata fields to `STORED_STRING_METADATA_FIELDS`, `normalizeStoredMetadata()`, and listed gallery item construction:

```js
"quickBlendPairIndex",
"quickBlendAImageName",
"quickBlendBImageName",
```

Add `quick-blend` output routing in `resolveDefaultImageOutputDirName()`:

```js
if (generationMode === "quick-blend" || assetKind === "quick-blend") {
  return "quick-blend";
}
```

In `normalizeStoredMetadata()`, add:

```js
quickBlendPairIndex: String(metadata.quickBlendPairIndex || ""),
quickBlendAImageName: String(metadata.quickBlendAImageName || ""),
quickBlendBImageName: String(metadata.quickBlendBImageName || ""),
```

In gallery item construction near `styleTransferStylePreset`, add:

```js
quickBlendPairIndex: normalizedMetadata.quickBlendPairIndex || "",
quickBlendAImageName: normalizedMetadata.quickBlendAImageName || "",
quickBlendBImageName: normalizedMetadata.quickBlendBImageName || "",
```

- [ ] **Step 4: Extend local generate support**

In `server.mjs`, import the helper:

```js
import {
  QUICK_BLEND_ASSET_KIND,
  QUICK_BLEND_MODE,
  QUICK_BLEND_REFERENCE_LABELS,
  buildQuickBlendPrompt,
  normalizeQuickBlendPairIndex,
} from "./lib/quick-blend-prompt.mjs";
```

Add `QUICK_BLEND_MODE` to `GENERATION_MODES`.

Rename `getStyleTransferReferenceImageLabels()` to `getGenerationReferenceImageLabels()` or keep the existing name and add this branch:

```js
if (generationMode === QUICK_BLEND_MODE) {
  return QUICK_BLEND_REFERENCE_LABELS;
}
```

Inside `handleGenerate()`, read fields after `styleTransferStylePreset`:

```js
const quickBlendPairIndex = normalizeQuickBlendPairIndex(formData.get("quickBlendPairIndex") || "1");
const quickBlendAImageName = String(formData.get("quickBlendAImageName") || "").trim();
const quickBlendBImageName = String(formData.get("quickBlendBImageName") || "").trim();
const isQuickBlend = generationMode === QUICK_BLEND_MODE;
```

Change the empty prompt guard:

```js
if (!prompt && !isImageDecomposition && !isQuickBlend) {
```

After image-decomposition validation, add:

```js
if (isQuickBlend && referenceImages.length !== 2) {
  generationTaskStore.failTask(clientSessionId, taskId, {
    errorMessage: "快速溶图模式每个任务必须且只支持两张参考图：一张 A 图和一张 B 图。",
  });
  writeSseEvent(response, "error", {
    message: "快速溶图模式每个任务必须且只支持两张参考图：一张 A 图和一张 B 图。",
  });
  return;
}

if (isQuickBlend) {
  const quickBlendPrompt = buildQuickBlendPrompt({
    pairIndex: quickBlendPairIndex,
    aImageName: quickBlendAImageName || referenceImages[0]?.filename || "",
    bImageName: quickBlendBImageName || referenceImages[1]?.filename || "",
  });
  prompt = quickBlendPrompt.prompt;
  assetKind = QUICK_BLEND_ASSET_KIND;
  generationTaskStore.updateTask(clientSessionId, taskId, {
    prompt,
    assetKind,
    quickBlendPairIndex: quickBlendPrompt.pairIndex,
    quickBlendAImageName: quickBlendPrompt.aImageName,
    quickBlendBImageName: quickBlendPrompt.bImageName,
  });
}
```

Add the three Quick Blend metadata fields to every `generationTaskStore.updateTask()`, `saveGeneratedAsset({ metadata })`, and `buildSavedItem()` payload in `handleGenerate()`.

Update `buildSavedItem()` parameters and returned object:

```js
quickBlendPairIndex = "",
quickBlendAImageName = "",
quickBlendBImageName = "",
```

```js
quickBlendPairIndex,
quickBlendAImageName,
quickBlendBImageName,
```

- [ ] **Step 5: Run focused tests and verify GREEN**

Run:

```bash
node --test test\quick-blend-prompt.test.mjs test\quick-blend-server.test.mjs
```

Expected: PASS.

- [ ] **Step 6: Update OpenSpec task progress**

Change `openspec/changes/add-quick-blend-mode/tasks.md`:

```md
- [x] 3.1 Add failing local `/api/generate` tests for `mode=quick-blend`, exactly-two-reference validation, prompt replacement, output folder routing, and saved metadata.
- [x] 3.2 Implement local server support using the shared prompt helper and gallery metadata.
```

- [ ] **Step 7: Commit Task 2**

Run:

```bash
git add server.mjs lib/gallery-store.mjs test/quick-blend-server.test.mjs openspec/changes/add-quick-blend-mode/tasks.md
git commit -m "feat: support quick blend generation locally"
```

---

### Task 3: Cloudflare Worker Parity

**Files:**
- Modify: `cloudflare-pages-worker.mjs`
- Modify: `test/cloudflare-pages-worker.test.mjs`
- Modify: `openspec/changes/add-quick-blend-mode/tasks.md`

- [ ] **Step 1: Write the failing Worker test**

Append to `test/cloudflare-pages-worker.test.mjs`:

```js
test("Cloudflare quick blend uses exactly two references, generated prompt, labels, and saved metadata", async () => {
  const seenRequests = [];
  const imageBucket = makeImageBucket();
  const formData = new FormData();
  formData.set("jobId", "job-quick-blend");
  formData.set("mode", "quick-blend");
  formData.set("quickBlendPairIndex", "3");
  formData.set("quickBlendAImageName", "a-chair.png");
  formData.set("quickBlendBImageName", "b-table.png");
  formData.set("ratio", "4:5");
  formData.set("size", "1024x1280");
  formData.set("format", "png");
  formData.set("reasoningEffort", "low");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["a"], "a-chair.png", { type: "image/png" }));
  formData.append("referenceImages", new File(["b"], "b-table.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    imageBucket,
    async fetchImpl(url, init) {
      seenRequests.push({
        url,
        auth: init.headers.Authorization,
        body: JSON.parse(init.body),
      });
      return makeSseResponse();
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const savedEvent = events.find((event) => event.eventName === "saved");
  const requestText = JSON.stringify(seenRequests[0]?.body || {});
  const inputImages = seenRequests[0]?.body.input[0].content.filter((item) => item.type === "input_image") || [];

  assert.equal(response.status, 200);
  assert.equal(seenRequests.length, 1);
  assert.equal(inputImages.length, 2);
  assert.match(requestText, /Reference image 1: A image/);
  assert.match(requestText, /Reference image 2: B image/);
  assert.match(requestText, /A subject group above the B subject group/);
  assert.equal(savedEvent.payload.item.generationMode, "quick-blend");
  assert.equal(savedEvent.payload.item.assetKind, "quick-blend");
  assert.equal(savedEvent.payload.item.quickBlendPairIndex, "3");
  assert.equal(savedEvent.payload.item.quickBlendAImageName, "a-chair.png");
  assert.equal(savedEvent.payload.item.quickBlendBImageName, "b-table.png");
  assert.doesNotMatch(text, /test-browser-key/);
});

test("Cloudflare quick blend rejects malformed reference count", async () => {
  const formData = new FormData();
  formData.set("mode", "quick-blend");
  formData.set("baseUrl", "https://example.test/v1");
  formData.set("apiKey", "test-browser-key");
  formData.set("responsesModel", "gpt-5.5");
  formData.append("referenceImages", new File(["a"], "a-only.png", { type: "image/png" }));

  const response = await handleApiRequest(new Request("https://studio.example/api/generate", {
    method: "POST",
    body: formData,
  }), {
    async fetchImpl() {
      throw new Error("quick blend validation must stop before upstream fetch");
    },
  });

  const text = await response.text();
  const events = parseSseEvents(text);
  const error = events.find((event) => event.eventName === "error");

  assert.equal(response.status, 200);
  assert.ok(error, "expected validation error");
  assert.match(error.payload.message, /快速溶图|Quick Blend|两张|exactly two/);
});
```

- [ ] **Step 2: Run the Worker test and verify RED**

Run: `node --test test\cloudflare-pages-worker.test.mjs`

Expected: FAIL on Quick Blend mode support.

- [ ] **Step 3: Implement Worker parity**

In `cloudflare-pages-worker.mjs`, mirror the `server.mjs` helper import, `GENERATION_MODES` addition, reference-label branch, prompt replacement, two-reference validation, task metadata fields, saved metadata fields, and saved item fields.

Use this validation message:

```js
"快速溶图模式每个任务必须且只支持两张参考图：一张 A 图和一张 B 图。"
```

Use `requestImageGeneration({ referenceImageLabels: getGenerationReferenceImageLabels(generationMode, styleTransferStylePreset), ... })` after adding the Quick Blend label branch.

- [ ] **Step 4: Run Worker and local focused tests**

Run:

```bash
node --test test\quick-blend-prompt.test.mjs test\quick-blend-server.test.mjs test\cloudflare-pages-worker.test.mjs
```

Expected: PASS.

- [ ] **Step 5: Update OpenSpec task progress**

Change `openspec/changes/add-quick-blend-mode/tasks.md`:

```md
- [x] 4.1 Add failing Worker tests for Quick Blend reference validation, prompt helper usage, reference labels, saved metadata, and browser-private config safety.
- [x] 4.2 Implement Worker parity with the local server.
```

- [ ] **Step 6: Commit Task 3**

Run:

```bash
git add cloudflare-pages-worker.mjs test/cloudflare-pages-worker.test.mjs openspec/changes/add-quick-blend-mode/tasks.md
git commit -m "feat: add quick blend worker parity"
```

---

### Task 4: Frontend Shell And Static Contracts

**Files:**
- Create: `lib/views/quick-blend-view.mjs`
- Modify: `lib/view-mode-loader.mjs`
- Modify: `test/view-mode-loader.test.mjs`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`
- Modify: `test/studio-preview-layout.test.mjs`
- Modify: `openspec/changes/add-quick-blend-mode/tasks.md`

- [ ] **Step 1: Write failing static tests**

Append to `test/studio-preview-layout.test.mjs`:

```js
test("quick blend mode exposes independent A and B upload groups", async () => {
  const html = await readFile(indexPath, "utf8");
  const styles = await readFile(stylesPath, "utf8");
  const app = await readFile(appPath, "utf8");

  assert.match(html, /href="#quick-blend"[\s\S]*快速溶图/);
  assert.match(html, /data-view-panel="quick-blend"/);
  assert.match(html, /id="quickBlendAInput"[\s\S]*id="quickBlendBInput"/);
  assert.match(html, /id="quickBlendPairList"/);
  assert.match(html, /id="quickBlendGenerateButton"/);
  assert.match(styles, /\.quick-blend-view\s*\{/);
  assert.match(styles, /\.quick-blend-upload-grid\s*\{/);
  assert.match(styles, /\.quick-blend-pair-list\s*\{/);
  assert.match(app, /quickBlend:\s*\{/);
  assert.match(app, /quickBlendAInput:\s*document\.querySelector\("#quickBlendAInput"\)/);
  assert.match(app, /function getQuickBlendPairs\(\) \{/);
  assert.match(app, /function validateQuickBlendPairs\(\) \{/);
  assert.match(app, /function createQuickBlendJobs\(\) \{/);
  assert.match(app, /mode:\s*"quick-blend"/);
  assert.match(app, /formData\.set\("quickBlendPairIndex", job\.quickBlendPairIndex\);/);
});
```

Update the existing CREATE_VIEW_IDS assertion so it includes `"quick-blend"` between `"image-decomposition"` and `"image-compress"`.

In `test/view-mode-loader.test.mjs`, add:

```js
["quick-blend", "quickBlend", "../lib/views/quick-blend-view.mjs"],
```

- [ ] **Step 2: Run static tests and verify RED**

Run:

```bash
node --test test\studio-preview-layout.test.mjs test\view-mode-loader.test.mjs
```

Expected: FAIL because Quick Blend HTML, view module, state, and functions do not exist.

- [ ] **Step 3: Add lazy view module registration**

Create `lib/views/quick-blend-view.mjs`:

```js
import { createViewRendererController } from "./view-renderer.mjs";

export function mountView(options = {}) {
  return createViewRendererController({
    ...options,
    view: options.view || "quick-blend",
    rendererKey: "quickBlend",
  });
}
```

Add to `lib/view-mode-loader.mjs`:

```js
"quick-blend": "/lib/views/quick-blend-view.mjs",
```

- [ ] **Step 4: Add HTML shell**

In `public/index.html`, add a Create menu link after image decomposition:

```html
<a class="mega-menu-link" href="#quick-blend">快速溶图</a>
```

Add this view after the image decomposition section and before image compress:

```html
<section class="view-panel quick-blend-view hidden" data-view-panel="quick-blend">
  <div class="quick-blend-workspace">
    <section class="studio-panel quick-blend-upload-panel">
      <form id="quickBlendForm" class="settings-form quick-blend-form">
        <div class="quick-blend-upload-grid">
          <div class="field-group quick-blend-upload-group">
            <div class="field-heading">
              <div><span>A 组图片</span></div>
              <small id="quickBlendACount">0</small>
            </div>
            <label class="reference-dropzone quick-blend-dropzone" id="quickBlendADropzone">
              <input id="quickBlendAInput" name="quickBlendAImages" type="file" accept="image/*" multiple />
              <div class="reference-icon" aria-hidden="true"></div>
              <strong>上传 A 组</strong>
              <em>按上传顺序配对</em>
            </label>
            <div class="reference-grid quick-blend-grid hidden" id="quickBlendAGrid"></div>
          </div>
          <div class="field-group quick-blend-upload-group">
            <div class="field-heading">
              <div><span>B 组图片</span></div>
              <small id="quickBlendBCount">0</small>
            </div>
            <label class="reference-dropzone quick-blend-dropzone" id="quickBlendBDropzone">
              <input id="quickBlendBInput" name="quickBlendBImages" type="file" accept="image/*" multiple />
              <div class="reference-icon" aria-hidden="true"></div>
              <strong>上传 B 组</strong>
              <em>必须与 A 数量一致</em>
            </label>
            <div class="reference-grid quick-blend-grid hidden" id="quickBlendBGrid"></div>
          </div>
        </div>
        <section class="field-group quick-blend-pair-panel">
          <div class="field-heading">
            <div><span>配对预览</span></div>
            <small id="quickBlendPairCount">0 对</small>
          </div>
          <div class="quick-blend-pair-list" id="quickBlendPairList"></div>
        </section>
        <button class="generate-button quick-blend-generate-button" id="quickBlendGenerateButton" type="button">
          开始快速溶图
        </button>
        <details class="field-group parameter-settings adaptive-section quick-blend-parameter-settings" id="quickBlendParameterAdaptiveSection" data-adaptive-section="quick-blend-parameters" data-compact-open="false">
          <summary class="field-heading adaptive-section-summary">
            <div><span>参数</span></div>
          </summary>
          <div class="ratio-grid" id="quickBlendRatioGrid"></div>
          <input id="quickBlendRatioInput" type="hidden" value="4:5" />
          <label class="compact-field quick-blend-size-field">
            <span>分辨率</span>
            <select id="quickBlendSizeInput" name="quickBlendSize"></select>
          </label>
        </details>
        <p class="prompt-agent-feedback quick-blend-feedback" id="quickBlendFeedback"></p>
      </form>
    </section>
    <section class="studio-panel preview-panel quick-blend-preview-panel">
      <div class="preview-stage quick-blend-generation" id="quickBlendGenerationPanel">
        <div class="preview-meta quick-blend-preview-meta">
          <span>快速溶图预览</span>
          <span id="quickBlendGenerationMeta">等待生成</span>
        </div>
        <div class="preview-canvas quick-blend-generation-canvas" id="quickBlendGenerationCanvas">
          <div class="quick-blend-generation-empty" id="quickBlendGenerationEmpty">生成后显示最新结果</div>
          <img id="quickBlendGenerationImage" alt="快速溶图生成结果" />
        </div>
        <div class="preview-toolbar quick-blend-preview-toolbar">
          <div class="zoom-controls quick-blend-preview-status" aria-live="polite">
            <span id="quickBlendPreviewStatus">等待任务</span>
          </div>
          <a class="toolbar-button disabled" id="quickBlendGenerationDownloadButton" href="#" download aria-disabled="true">下载</a>
          <button class="toolbar-button" id="quickBlendGenerationLightboxButton" type="button" disabled>查看</button>
        </div>
      </div>
      <div class="filmstrip-row quick-blend-filmstrip-row">
        <div class="filmstrip quick-blend-generation-strip hidden" id="quickBlendGenerationStrip" aria-label="快速溶图结果缩略图"></div>
        <div class="reference-analysis-thumbnail-empty quick-blend-thumbnail-empty" id="quickBlendThumbnailEmpty">等待生成结果</div>
      </div>
    </section>
  </div>
</section>
```

- [ ] **Step 5: Add frontend registration skeleton**

In `public/app.js`:

Add `"quick-blend"` to `CREATE_VIEW_IDS`, `getViewFromHash()`, `syncHash()`, `setActiveView()`, `renderers`, and studio height sync logic.

Add state:

```js
quickBlend: {
  aFiles: [],
  bFiles: [],
  feedback: "",
  generationKeys: [],
  generationItems: {},
  previewKey: "",
},
quickBlendPreviewItem: null,
```

Add refs for every `quickBlend*` ID from the HTML shell.

Add empty functions so static tests can find them:

```js
function getQuickBlendPairs() {
  return [];
}

function validateQuickBlendPairs() {
  return { ok: false, message: "请先上传 A 组和 B 组图片。", pairs: [] };
}

function createQuickBlendJobs() {
  return [];
}
```

- [ ] **Step 6: Add CSS shell**

In `public/styles.css`, add:

```css
.quick-blend-view {
  height: 100%;
  overflow: hidden;
}

.quick-blend-workspace {
  display: grid;
  grid-template-columns: minmax(360px, 0.85fr) minmax(420px, 1.15fr);
  gap: var(--space-4);
  height: 100%;
  min-height: 0;
}

.quick-blend-form {
  display: grid;
  gap: var(--space-4);
}

.quick-blend-upload-grid {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: var(--space-3);
}

.quick-blend-grid {
  grid-template-columns: repeat(3, minmax(0, 1fr));
}

.quick-blend-pair-list {
  display: grid;
  gap: var(--space-2);
  max-height: 240px;
  overflow: auto;
}

.quick-blend-pair-row {
  display: grid;
  grid-template-columns: auto minmax(0, 1fr) auto minmax(0, 1fr);
  gap: var(--space-2);
  align-items: center;
  min-height: 44px;
}

.quick-blend-generation img {
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
}

html[data-ui-layout="tablet"] .quick-blend-workspace,
html[data-ui-layout="mobile"] .quick-blend-workspace,
html[data-ui-layout="mobile"] .quick-blend-upload-grid {
  grid-template-columns: minmax(0, 1fr);
}
```

- [ ] **Step 7: Run static tests and verify GREEN**

Run:

```bash
node --test test\studio-preview-layout.test.mjs test\view-mode-loader.test.mjs
```

Expected: PASS.

- [ ] **Step 8: Update OpenSpec task progress**

Change `openspec/changes/add-quick-blend-mode/tasks.md`:

```md
- [x] 5.1 Add failing static UI/layout tests for `#quick-blend`, Create menu navigation, A/B upload controls, pair preview, validation feedback, and responsive constraints.
```

- [ ] **Step 9: Commit Task 4**

Run:

```bash
git add public/index.html public/app.js public/styles.css lib/view-mode-loader.mjs lib/views/quick-blend-view.mjs test/studio-preview-layout.test.mjs test/view-mode-loader.test.mjs openspec/changes/add-quick-blend-mode/tasks.md
git commit -m "feat: add quick blend view shell"
```

---

### Task 5: Frontend Upload, Queue, Preview, And Cleanup

**Files:**
- Modify: `public/app.js`
- Modify: `public/styles.css`
- Modify: `test/studio-preview-layout.test.mjs`
- Modify: `openspec/changes/add-quick-blend-mode/tasks.md`

- [ ] **Step 1: Add failing frontend behavior static tests**

Append to `test/studio-preview-layout.test.mjs`:

```js
test("quick blend frontend validates matching pairs and submits one job per pair", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function createQuickBlendItem\(group, file\) \{/);
  assert.match(app, /function applyQuickBlendFiles\(group, fileList\) \{/);
  assert.match(app, /function removeQuickBlendFile\(group, itemId\) \{/);
  assert.match(app, /function getQuickBlendPairs\(\) \{[\s\S]*const maxCount = Math\.max\(state\.quickBlend\.aFiles\.length, state\.quickBlend\.bFiles\.length\);/);
  assert.match(app, /function validateQuickBlendPairs\(\) \{[\s\S]*state\.quickBlend\.aFiles\.length !== state\.quickBlend\.bFiles\.length/);
  assert.match(app, /function createQuickBlendJobs\(\) \{[\s\S]*return getQuickBlendPairs\(\)\.map\(\(pair, index\) =>/);
  assert.match(app, /quickBlendPairIndex:\s*String\(index \+ 1\)/);
  assert.match(app, /quickBlendAImageName:\s*pair\.a\.file\.name/);
  assert.match(app, /quickBlendBImageName:\s*pair\.b\.file\.name/);
  assert.match(app, /function appendQuickBlendReferencesToFormData\(formData, job\) \{/);
  assert.match(app, /formData\.set\("mode", "quick-blend"\);/);
  assert.match(app, /formData\.append\("referenceImages", job\.quickBlendAFile\);/);
  assert.match(app, /formData\.append\("referenceImages", job\.quickBlendBFile\);/);
  assert.match(app, /function startQuickBlendGeneration\(\) \{/);
  assert.match(app, /jobs\.forEach\(\(job\) => state\.jobs\.unshift\(job\)\);/);
});

test("quick blend cleanup reacts to gallery deletion and task polling snapshots", async () => {
  const app = await readFile(appPath, "utf8");

  assert.match(app, /function storeQuickBlendGenerationItem\(item\) \{/);
  assert.match(app, /function removeQuickBlendGenerationKey\(targetKey\) \{/);
  assert.match(app, /function renderQuickBlendGenerationPreview\(\) \{/);
  assert.match(app, /if \(task\.mode === "quick-blend"\) \{/);
  assert.match(app, /if \(job\.mode === "quick-blend"\) \{/);
  assert.match(app, /item\.mode === "quick-blend" \|\|[\s\S]*item\.generationMode === "quick-blend" \|\|[\s\S]*item\.assetKind === "quick-blend"/);
});
```

- [ ] **Step 2: Run the behavior static tests and verify RED**

Run: `node --test test\studio-preview-layout.test.mjs`

Expected: FAIL because Quick Blend behavior functions are missing.

- [ ] **Step 3: Implement upload item helpers**

In `public/app.js`, add:

```js
function createQuickBlendItem(group, file) {
  return {
    id: `quick-blend-${group}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    group,
    fingerprint: buildReferenceFingerprint(file),
    file,
    generationFile: file,
    generationFilePromise: null,
    generationCompressed: false,
    previewUrl: URL.createObjectURL(file),
  };
}

function startQuickBlendGenerationCompression(item) {
  if (!item?.file) {
    return null;
  }
  item.generationFile = item.file;
  item.generationCompressed = false;
  item.generationFilePromise = prepareGenerationReferenceImageFile(item.file)
    .then((preparedFile) => {
      item.generationFile = preparedFile || item.file;
      item.generationCompressed = Boolean(preparedFile && preparedFile !== item.file);
      return item.generationFile;
    })
    .catch(() => {
      item.generationFile = item.file;
      item.generationCompressed = false;
      return item.file;
    })
    .finally(() => {
      item.generationFilePromise = null;
      renderQuickBlendView();
    });
  renderQuickBlendView();
  return item.generationFilePromise;
}

function getQuickBlendGenerationFile(item) {
  return getGenerationReferenceFile(item);
}
```

- [ ] **Step 4: Implement A/B upload mutation**

Add:

```js
function getQuickBlendGroupFiles(group) {
  return group === "b" ? state.quickBlend.bFiles : state.quickBlend.aFiles;
}

function setQuickBlendGroupFiles(group, files) {
  if (group === "b") {
    state.quickBlend.bFiles = files;
  } else {
    state.quickBlend.aFiles = files;
  }
}

function applyQuickBlendFiles(group, fileList) {
  const incomingFiles = [...(fileList || [])].filter((file) => file.type.startsWith("image/"));
  if (incomingFiles.length === 0) {
    setQuickBlendFeedback("请选择图片文件。", "error");
    return;
  }

  const next = [...getQuickBlendGroupFiles(group)];
  const fingerprints = new Set(next.map((item) => item.fingerprint));
  for (const file of incomingFiles) {
    const fingerprint = buildReferenceFingerprint(file);
    if (fingerprints.has(fingerprint)) {
      continue;
    }
    const item = createQuickBlendItem(group, file);
    next.push(item);
    fingerprints.add(fingerprint);
    startQuickBlendGenerationCompression(item);
  }
  setQuickBlendGroupFiles(group, next);
  if (group === "b") {
    refs.quickBlendBInput.value = "";
  } else {
    refs.quickBlendAInput.value = "";
  }
  renderQuickBlendView();
}

function removeQuickBlendFile(group, itemId) {
  const current = getQuickBlendGroupFiles(group);
  const target = current.find((item) => item.id === itemId);
  if (state.quickBlendPreviewItem?.id === target?.id) {
    closeReferencePreview();
  }
  revokeReferencePreview(target);
  setQuickBlendGroupFiles(group, current.filter((item) => item.id !== itemId));
  renderQuickBlendView();
}
```

- [ ] **Step 5: Implement pair validation and rendering**

Replace the skeletons with:

```js
function getQuickBlendPairs() {
  const maxCount = Math.max(state.quickBlend.aFiles.length, state.quickBlend.bFiles.length);
  return Array.from({ length: maxCount }, (_, index) => ({
    index,
    a: state.quickBlend.aFiles[index] || null,
    b: state.quickBlend.bFiles[index] || null,
  }));
}

function hasPendingQuickBlendGenerationFiles() {
  return [...state.quickBlend.aFiles, ...state.quickBlend.bFiles].some((item) => item.generationFilePromise);
}

async function ensureQuickBlendGenerationFilesReady() {
  const pending = [...state.quickBlend.aFiles, ...state.quickBlend.bFiles]
    .map((item) => item.generationFilePromise)
    .filter(Boolean);
  if (pending.length === 0) {
    return;
  }
  try {
    await Promise.allSettled(pending);
  } finally {
    renderQuickBlendView();
  }
}

function validateQuickBlendPairs() {
  const pairs = getQuickBlendPairs();
  if (state.quickBlend.aFiles.length === 0 && state.quickBlend.bFiles.length === 0) {
    return { ok: false, message: "请上传 A 组和 B 组图片。", pairs };
  }
  if (state.quickBlend.aFiles.length === 0) {
    return { ok: false, message: "A 组不能为空。", pairs };
  }
  if (state.quickBlend.bFiles.length === 0) {
    return { ok: false, message: "B 组不能为空。", pairs };
  }
  if (state.quickBlend.aFiles.length !== state.quickBlend.bFiles.length) {
    return { ok: false, message: "A 组和 B 组数量必须一致。", pairs };
  }
  return { ok: true, message: `${pairs.length} 对图片已准备。`, pairs };
}
```

Add `renderQuickBlendView()` that updates counts, grids, pair rows, feedback, button disabled state, ratio/size controls, preview, and thumbnails.

Each pair row should use `quick-blend-pair-row` and set missing rows with `is-missing`.

- [ ] **Step 6: Implement job creation and FormData**

Add:

```js
function createQuickBlendJobs() {
  const ratioOption = getRatioOption(refs.quickBlendRatioInput.value || DEFAULT_UI_RATIO);
  const sizeSetting = normalizeGenerationSize(ratioOption.value, refs.quickBlendSizeInput.value || "auto");
  const size = sizeSetting === "auto" ? ratioOption?.baseSize || getDefaultGenerationSize(ratioOption?.value) : sizeSetting;
  return getQuickBlendPairs().map((pair, index) => ({
    id: `job-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    createdAt: nowIso(),
    mode: "quick-blend",
    prompt: `快速溶图 ${index + 1}`,
    ratio: ratioOption?.value || DEFAULT_UI_RATIO,
    ratioLabel: ratioOption?.label || DEFAULT_UI_RATIO_LABEL,
    sizeSetting,
    size,
    quality: state.config?.defaults?.quality || "high",
    format: normalizeOutputFormat(refs.outputFormatInput.value || state.config?.defaults?.format || "png"),
    baseUrl: state.config?.baseUrl || refs.baseUrlInput.value.trim(),
    responsesModel: state.config?.responsesModel || refs.responsesModelInput.value.trim() || "gpt-5.4",
    imageModel: "gpt-image-2",
    reasoningEffort: refs.reasoningEffortInput.value || state.config?.defaults?.reasoningEffort || "xhigh",
    requestRetryCount: 0,
    quickBlendPairIndex: String(index + 1),
    quickBlendAImageName: pair.a.file.name,
    quickBlendBImageName: pair.b.file.name,
    quickBlendAFile: getQuickBlendGenerationFile(pair.a),
    quickBlendBFile: getQuickBlendGenerationFile(pair.b),
    referenceFiles: [getQuickBlendGenerationFile(pair.a), getQuickBlendGenerationFile(pair.b)].filter(Boolean),
    hasReferenceImage: true,
    referenceImageName: pair.a.file.name,
    referenceImageNames: [pair.a.file.name, pair.b.file.name],
    isRunning: false,
    started: false,
    statusStage: "queued",
    statusText: "等待并发槽位",
    previewUrl: "",
  }));
}

function appendQuickBlendReferencesToFormData(formData, job) {
  formData.set("mode", "quick-blend");
  formData.set("quickBlendPairIndex", job.quickBlendPairIndex);
  formData.set("quickBlendAImageName", job.quickBlendAImageName);
  formData.set("quickBlendBImageName", job.quickBlendBImageName);
  formData.append("referenceImages", job.quickBlendAFile);
  formData.append("referenceImages", job.quickBlendBFile);
}
```

In `buildGenerationFormData(job)`, add the Quick Blend branch before image decomposition:

```js
if (job.mode === "quick-blend") {
  appendQuickBlendReferencesToFormData(formData, job);
} else if (job.mode === "style-transfer") {
```

- [ ] **Step 7: Implement generation start and SSE integration**

Add:

```js
async function startQuickBlendGeneration() {
  clearError();
  const validation = validateQuickBlendPairs();
  if (!validation.ok) {
    setQuickBlendFeedback(validation.message, "error");
    return;
  }
  if (getQueuedJobCount() + validation.pairs.length > getMaxQueuedJobCount()) {
    setQuickBlendFeedback(`当前队列最多还能加入 ${Math.max(0, getMaxQueuedJobCount() - getQueuedJobCount())} 个任务。`, "error");
    return;
  }
  await ensureQuickBlendGenerationFilesReady();
  const jobs = createQuickBlendJobs();
  jobs.forEach((job) => state.jobs.unshift(job));
  const firstJob = jobs[0];
  state.quickBlend.previewKey = makeJobPreviewKey(firstJob.id);
  jobs.forEach(recordJobQueued);
  setQuickBlendFeedback(`已加入 ${jobs.length} 个快速溶图任务。`, "busy");
  renderAll();
  setActiveView("quick-blend");
  scheduleGenerationQueue();
}
```

In SSE saved/error/cancel/task snapshot handling, mirror image decomposition and reference analysis:

```js
if (job.mode === "quick-blend") {
  payload.item.mode = "quick-blend";
  storeQuickBlendGenerationItem(payload.item);
  replaceQuickBlendGenerationKey(makeJobPreviewKey(job.id), makeGalleryPreviewKey(payload.item.filename));
  state.quickBlend.previewKey = makeGalleryPreviewKey(payload.item.filename);
  setQuickBlendFeedback("快速溶图已生成。", "success");
}
```

Add `storeQuickBlendGenerationItem`, `replaceQuickBlendGenerationKey`, `removeQuickBlendGenerationKey`, `getQuickBlendGenerationEntries`, `renderQuickBlendGenerationPreview`, `openQuickBlendGeneratedPreview`, and thumbnail click handling using the image-decomposition functions as the pattern with `quickBlend` names.

- [ ] **Step 8: Bind events**

In the event binding section, add:

```js
refs.quickBlendAInput.addEventListener("change", (event) => applyQuickBlendFiles("a", event.target.files));
refs.quickBlendBInput.addEventListener("change", (event) => applyQuickBlendFiles("b", event.target.files));
bindQuickBlendDropzone(refs.quickBlendADropzone, "a");
bindQuickBlendDropzone(refs.quickBlendBDropzone, "b");
refs.quickBlendGenerateButton.addEventListener("click", () => {
  startQuickBlendGeneration().catch((error) => setQuickBlendFeedback(error.message, "error"));
});
refs.quickBlendSizeInput.addEventListener("change", (event) => syncQuickBlendSize(event.target.value));
refs.quickBlendGenerationLightboxButton.addEventListener("click", openQuickBlendGeneratedPreview);
refs.quickBlendGenerationCanvas.addEventListener("click", openQuickBlendGeneratedPreview);
refs.quickBlendGenerationStrip.addEventListener("click", (event) => {
  const target = event.target.closest("[data-quick-blend-generation-key]");
  if (!target) {
    return;
  }
  setQuickBlendGenerationPreviewKey(target.dataset.quickBlendGenerationKey);
});
```

- [ ] **Step 9: Run focused frontend tests**

Run:

```bash
node --test test\studio-preview-layout.test.mjs test\view-mode-loader.test.mjs
```

Expected: PASS.

- [ ] **Step 10: Update OpenSpec task progress**

Change `openspec/changes/add-quick-blend-mode/tasks.md`:

```md
- [x] 5.2 Add client-side Quick Blend state, upload handling, pair preview rendering, batch queue submission, generated preview updates, and cleanup after gallery deletion or clear-history.
- [x] 5.3 Style the Quick Blend view for desktop, tablet, and mobile layouts without nesting cards or relying on hover-only controls.
```

- [ ] **Step 11: Commit Task 5**

Run:

```bash
git add public/app.js public/styles.css test/studio-preview-layout.test.mjs openspec/changes/add-quick-blend-mode/tasks.md
git commit -m "feat: implement quick blend frontend flow"
```

---

### Task 6: Final Verification And Browser QA

**Files:**
- Modify: `openspec/changes/add-quick-blend-mode/tasks.md`

- [ ] **Step 1: Run focused Quick Blend tests**

Run:

```bash
node --test test\quick-blend-prompt.test.mjs test\quick-blend-server.test.mjs test\cloudflare-pages-worker.test.mjs test\studio-preview-layout.test.mjs test\view-mode-loader.test.mjs
```

Expected: PASS.

- [ ] **Step 2: Run full test suite**

Run: `cmd /c npm test`

Expected: PASS with all `node:test` files complete.

- [ ] **Step 3: Check public-lib sync only if a browser-imported lib was added**

If `public/app.js` imports a new `/lib/*.mjs` module, run:

```bash
cmd /c npm run sync:public-lib -- --check
```

Expected: PASS. If Quick Blend prompt helper stays server-only, record that this check was not needed because no browser-imported module was added.

- [ ] **Step 4: Run Pages build**

Run: `cmd /c npm run build:pages`

Expected: PASS.

- [ ] **Step 5: Run diff checks and mojibake scan**

Run:

```bash
git diff --check
node -e "const fs=require('fs'); const files=['openspec/changes/add-quick-blend-mode/proposal.md','openspec/changes/add-quick-blend-mode/design.md','openspec/changes/add-quick-blend-mode/specs/quick-blend-mode/spec.md','docs/superpowers/plans/2026-05-29-quick-blend-mode.md','lib/quick-blend-prompt.mjs','test/quick-blend-prompt.test.mjs','test/quick-blend-server.test.mjs']; const bad=new RegExp(['\\\\uFFFD','\\\\u934e','\\\\u6d93','\\\\u747e','\\\\u978f','\\\\u5e3d'].join('|')); let failed=false; for (const file of files) { if (!fs.existsSync(file)) continue; const text=fs.readFileSync(file,'utf8'); if (bad.test(text)) { console.error('BAD '+file); failed=true; } } process.exit(failed?1:0);"
```

Expected: `git diff --check` exits 0. The Node command prints no `BAD` lines and exits 0.

- [ ] **Step 6: Browser verification**

Start the app:

```bash
cmd /c npm start
```

Open the local URL shown by the server in the Codex in-app browser. Navigate to `#quick-blend`.

Manual checks:

- Upload one A image and zero B images. Expected: button disabled or visible validation says B is missing.
- Upload one B image. Expected: pair preview shows `A1+B1` and the button enables after compression finishes.
- Upload a second A image only. Expected: pair preview marks the missing `B2` and the button disables.
- Remove the extra A image. Expected: button enables again.
- Use the browser console to confirm there are no uncaught errors during upload and removal.

- [ ] **Step 7: Update verification task**

Change `openspec/changes/add-quick-blend-mode/tasks.md`:

```md
- [x] 6.1 Run focused tests for Quick Blend, full `npm test`, public-lib sync check if a shared browser module is added, `npm run build:pages`, `git diff --check`, and browser verification of upload validation and pair preview.
```

- [ ] **Step 8: Commit verification updates**

Run:

```bash
git add openspec/changes/add-quick-blend-mode/tasks.md
git commit -m "test: verify quick blend mode"
```

---

## Self-Review Checklist

- Spec requirement "independent Create view" maps to Tasks 4 and 5.
- Spec requirement "pair by order" maps to Task 5 steps 5 and 6.
- Spec requirement "validate pair completeness" maps to Task 5 steps 1, 5, and browser QA.
- Spec requirement "dedicated two-reference prompt" maps to Tasks 1, 2, and 3.
- Spec requirement "saved gallery assets" maps to Tasks 2, 3, and 5.
- The plan uses one `/api/generate` path, matching the approved design.
- The plan does not introduce a Creation Mode set manifest or cross-pair generation.
