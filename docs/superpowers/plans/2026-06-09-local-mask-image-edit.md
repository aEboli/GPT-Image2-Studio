# Local Mask Image Edit Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an optional local-mask workflow to Image Edit so users can paint multiple regions on one source image, write one instruction per region, and choose merge or sequential execution.

**Architecture:** Keep the feature inside `#image-edit`. The browser owns canvas painting and exports a normalized PNG source plus same-size PNG alpha masks; local server and Cloudflare Worker validate local-mask form fields and reuse `requestImageEdit` for one or many `/images/edits` calls.

**Tech Stack:** Node ESM, native `node:test`, plain HTML/CSS/JavaScript, browser canvas, native `FormData`/`File`/`Blob`, existing SSE generation queue, existing gallery-store metadata flow, Cloudflare Pages Worker module.

---

## File Structure

- Create `lib/image-edit-local-mask.mjs`: shared constants, strategy normalization, region instruction parsing, prompt builders, metadata builder.
- Create `public/lib/image-edit-local-mask.mjs`: synced public copy used by the browser view.
- Create `test/image-edit-local-mask.test.mjs`: helper-level tests for parsing, prompt building, and metadata.
- Modify `scripts/sync-public-lib.mjs`: add `image-edit-local-mask.mjs` to `PUBLIC_LIB_SYNC_TARGETS`.
- Modify `test/responses-workflow.test.mjs`: prove `requestImageEdit` appends optional `mask`.
- Modify `lib/responses-workflow.mjs`: add optional `mask` support to `createImageEditFormData` and `requestImageEdit`.
- Modify `public/index.html`: add local-mask editor markup in the existing `#image-edit` view.
- Modify `public/styles.css`: style the source canvas, toolbar, strategy selector, and region cards.
- Modify `public/app.js`: add `state.imageEdit.localEdit` defaults and append local-mask fields during image-edit form-data creation.
- Modify `lib/views/image-edit-view.mjs`: implement canvas loading, region management, painting, validation, source PNG export, mask export, and local-mask job creation.
- Modify `public/lib/views/image-edit-view.mjs`: synced public copy.
- Modify `lib/image-edit-shell-bridge.mjs` and `public/lib/image-edit-shell-bridge.mjs`: preserve local-mask state cleanup and fallback rendering if needed.
- Modify `server.mjs`: parse and execute local-mask image-edit jobs.
- Modify `cloudflare-pages-worker.mjs`: mirror local server behavior.
- Modify `lib/gallery-store.mjs`: preserve new local-mask metadata fields in saved/listed gallery items if the current metadata allowlist drops them.
- Modify tests: `test/image-edit-layout.test.mjs`, `test/browser-shell-modules.test.mjs`, `test/image-edit-server.test.mjs`, `test/cloudflare-pages-worker.test.mjs`, `test/public-lib-sync.test.mjs`.
- Modify `openspec/changes/add-local-mask-image-edit/tasks.md`: mark tasks complete as implementation lands.

---

### Task 1: Shared Local-Mask Helper and Request Contract

**Files:**
- Create: `test/image-edit-local-mask.test.mjs`
- Create: `lib/image-edit-local-mask.mjs`
- Modify: `scripts/sync-public-lib.mjs`
- Modify: `test/responses-workflow.test.mjs`
- Modify: `lib/responses-workflow.mjs`
- Modify: `openspec/changes/add-local-mask-image-edit/tasks.md`

- [ ] **Step 1: Write the failing helper tests**

Create `test/image-edit-local-mask.test.mjs`:

```js
import test from "node:test";
import assert from "node:assert/strict";

import {
  IMAGE_EDIT_LOCAL_MASK_MODE,
  IMAGE_EDIT_LOCAL_MASK_STRATEGIES,
  buildLocalMaskMetadata,
  buildLocalMaskMergedPrompt,
  buildLocalMaskRegionPrompt,
  normalizeLocalMaskExecutionStrategy,
  parseLocalMaskRegionInstructions,
} from "../lib/image-edit-local-mask.mjs";

test("local mask helper normalizes strategies", () => {
  assert.equal(IMAGE_EDIT_LOCAL_MASK_MODE, "local-mask");
  assert.deepEqual([...IMAGE_EDIT_LOCAL_MASK_STRATEGIES], ["merge", "sequential"]);
  assert.equal(normalizeLocalMaskExecutionStrategy("sequential"), "sequential");
  assert.equal(normalizeLocalMaskExecutionStrategy("merge"), "merge");
  assert.equal(normalizeLocalMaskExecutionStrategy("bad"), "merge");
});

test("local mask helper parses valid painted region instructions", () => {
  const regions = parseLocalMaskRegionInstructions(JSON.stringify([
    { id: "region-1", index: 1, color: "#f5506e", instruction: "把杯子改成红色陶瓷质感", hasMask: true },
    { id: "region-2", index: 2, color: "#14b8a6", instruction: "替换成木质桌面纹理", hasMask: true },
  ]));

  assert.deepEqual(regions.map((region) => region.index), [1, 2]);
  assert.equal(regions[0].instruction, "把杯子改成红色陶瓷质感");
  assert.equal(regions[1].color, "#14b8a6");
});

test("local mask helper rejects malformed region instruction payloads", () => {
  assert.throws(() => parseLocalMaskRegionInstructions("not-json"), /regionInstructions/);
  assert.throws(() => parseLocalMaskRegionInstructions("{}"), /array/);
  assert.throws(
    () => parseLocalMaskRegionInstructions(JSON.stringify([{ id: "r1", index: 1, instruction: "" }])),
    /Region 1/,
  );
});

test("local mask helper builds preservation prompts", () => {
  const regions = parseLocalMaskRegionInstructions(JSON.stringify([
    { id: "region-1", index: 1, color: "#f5506e", instruction: "去掉这段反光", hasMask: true },
    { id: "region-2", index: 2, color: "#14b8a6", instruction: "把背景改成浅灰摄影棚", hasMask: true },
  ]));

  const merged = buildLocalMaskMergedPrompt(regions);
  assert.match(merged, /Edit only the transparent masked areas/i);
  assert.match(merged, /Keep all opaque unmasked areas unchanged/i);
  assert.match(merged, /Region 1: 去掉这段反光/);
  assert.match(merged, /Region 2: 把背景改成浅灰摄影棚/);

  const single = buildLocalMaskRegionPrompt(regions[0], { total: 2 });
  assert.match(single, /Region 1 of 2/);
  assert.match(single, /去掉这段反光/);
});

test("local mask helper builds saved metadata", () => {
  const regions = parseLocalMaskRegionInstructions(JSON.stringify([
    { id: "region-1", index: 1, color: "#f5506e", instruction: "去掉这段反光", hasMask: true },
  ]));

  assert.deepEqual(buildLocalMaskMetadata({
    executionStrategy: "sequential",
    regions,
    sourceImageName: "source.png",
  }), {
    editMode: "local-mask",
    executionStrategy: "sequential",
    regionCount: 1,
    regionInstructions: regions,
    sourceImageName: "source.png",
    editInstruction: "Region 1: 去掉这段反光",
  });
});
```

- [ ] **Step 2: Run the helper test and verify it fails**

Run:

```powershell
npm test -- test/image-edit-local-mask.test.mjs
```

Expected: FAIL because `lib/image-edit-local-mask.mjs` does not exist.

- [ ] **Step 3: Create the shared helper**

Create `lib/image-edit-local-mask.mjs`:

```js
export const IMAGE_EDIT_LOCAL_MASK_MODE = "local-mask";
export const IMAGE_EDIT_LOCAL_MASK_STRATEGIES = new Set(["merge", "sequential"]);

export function normalizeLocalMaskExecutionStrategy(value) {
  const normalized = String(value || "").trim().toLowerCase();
  return IMAGE_EDIT_LOCAL_MASK_STRATEGIES.has(normalized) ? normalized : "merge";
}

export function parseLocalMaskRegionInstructions(value) {
  let parsed;
  try {
    parsed = JSON.parse(String(value || "[]"));
  } catch (_error) {
    throw new Error("regionInstructions must be valid JSON.");
  }
  if (!Array.isArray(parsed)) {
    throw new Error("regionInstructions must be an array.");
  }

  return parsed.map((region, position) => {
    const index = Number.parseInt(String(region?.index || position + 1), 10);
    const instruction = String(region?.instruction || "").trim();
    if (!instruction) {
      throw new Error(`Region ${Number.isFinite(index) ? index : position + 1} is missing an edit instruction.`);
    }

    return {
      id: String(region?.id || `region-${index || position + 1}`).trim(),
      index: Number.isFinite(index) && index > 0 ? index : position + 1,
      color: String(region?.color || "#f5506e").trim(),
      instruction,
      hasMask: region?.hasMask !== false,
    };
  });
}

export function buildLocalMaskMergedPrompt(regions = []) {
  const lines = [
    "Edit only the transparent masked areas. Keep all opaque unmasked areas unchanged.",
    "Preserve the original image geometry, camera angle, lighting continuity, and all areas outside the mask.",
    "",
    "Region instructions:",
    ...regions.map((region) => `Region ${region.index}: ${region.instruction}`),
  ];
  return lines.join("\n").trim();
}

export function buildLocalMaskRegionPrompt(region, { total = 1 } = {}) {
  return [
    `Region ${region.index} of ${total}.`,
    "Edit only the transparent masked area for this region.",
    "Keep every opaque unmasked area unchanged, including layout, camera angle, lighting, and nearby objects.",
    `Instruction: ${region.instruction}`,
  ].join("\n");
}

export function buildLocalMaskMetadata({ executionStrategy, regions = [], sourceImageName = "" } = {}) {
  return {
    editMode: IMAGE_EDIT_LOCAL_MASK_MODE,
    executionStrategy: normalizeLocalMaskExecutionStrategy(executionStrategy),
    regionCount: regions.length,
    regionInstructions: regions,
    sourceImageName,
    editInstruction: regions.map((region) => `Region ${region.index}: ${region.instruction}`).join("\n"),
  };
}
```

- [ ] **Step 4: Sync the helper to public lib**

Modify `scripts/sync-public-lib.mjs` by adding the helper near `image-edit-shell-bridge.mjs`:

```js
  "image-edit-local-mask.mjs",
  "image-edit-shell-bridge.mjs",
```

Run:

```powershell
npm run sync:public-lib
```

Expected: `public/lib/image-edit-local-mask.mjs` exists and matches `lib/image-edit-local-mask.mjs`.

- [ ] **Step 5: Extend response workflow tests for optional mask**

Add this test to `test/responses-workflow.test.mjs` near existing image edit tests:

```js
test("requestImageEdit appends optional mask to edit requests", async () => {
  const requests = [];
  await requestImageEdit({
    baseUrl: "https://image-edit.example.test/v1",
    apiKey: "key",
    prompt: "Replace the masked area with a clean product label",
    sourceImage: { filename: "source.png", mimeType: "image/png", buffer: new Uint8Array([1, 2, 3]) },
    mask: { filename: "mask.png", mimeType: "image/png", buffer: new Uint8Array([4, 5, 6]) },
    size: "1024x1024",
    quality: "high",
    format: "png",
    fetchImpl: async (url, init) => {
      requests.push({ url, init, body: await init.body.text() });
      return new Response(JSON.stringify({ data: [{ b64_json: "ZmFrZQ==" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    },
  });

  assert.equal(requests[0].url, "https://image-edit.example.test/v1/images/edits");
  assert.match(requests[0].body, /name="image"/);
  assert.match(requests[0].body, /name="mask"/);
  assert.match(requests[0].body, /mask.png/);
});
```

- [ ] **Step 6: Implement optional mask in `lib/responses-workflow.mjs`**

Change the `createImageEditFormData` signature and body:

```js
function createImageEditFormData({
  prompt,
  sourceImage,
  mask,
  size,
  quality,
  format = "png",
  imageModel = "gpt-image-2",
}) {
  const formData = new FormData();
  const filename = String(sourceImage?.filename || "source-image.png").trim() || "source-image.png";
  const mimeType = String(sourceImage?.mimeType || "image/png").trim() || "image/png";
  const imageBytes = sourceImage?.buffer || sourceImage?.bytes || base64ToUint8Array(sourceImage?.base64);
  const imageBlob = new Blob([imageBytes], { type: mimeType });

  formData.set("model", imageModel || "gpt-image-2");
  formData.set("prompt", prompt);
  formData.set("size", size);
  formData.set("quality", quality);
  formData.set("output_format", format);
  formData.set("image", imageBlob, filename);

  if (mask) {
    const maskFilename = String(mask.filename || "mask.png").trim() || "mask.png";
    const maskMimeType = String(mask.mimeType || "image/png").trim() || "image/png";
    const maskBytes = mask.buffer || mask.bytes || base64ToUint8Array(mask.base64);
    formData.set("mask", new Blob([maskBytes], { type: maskMimeType }), maskFilename);
  }

  return formData;
}
```

Add `mask` to `requestImageEdit` parameters and pass it through to `createImageEditFormData`.

- [ ] **Step 7: Run focused helper and request tests**

Run:

```powershell
node --test test/image-edit-local-mask.test.mjs test/responses-workflow.test.mjs
```

Expected: PASS for the new helper tests and all response workflow tests.

---

### Task 2: Frontend Local-Mask UI and Canvas Behavior

**Files:**
- Modify: `test/image-edit-layout.test.mjs`
- Modify: `test/browser-shell-modules.test.mjs`
- Modify: `public/index.html`
- Modify: `public/styles.css`
- Modify: `public/app.js`
- Modify: `lib/views/image-edit-view.mjs`
- Modify: `openspec/changes/add-local-mask-image-edit/tasks.md`

- [ ] **Step 1: Add failing layout tests**

Extend `test/image-edit-layout.test.mjs` with assertions that `public/index.html` contains:

```js
assert.match(html, /id="imageEditLocalMaskPanel"/);
assert.match(html, /id="imageEditSourceCanvas"/);
assert.match(html, /id="imageEditMaskOverlayCanvas"/);
assert.match(html, /id="imageEditBrushToolButton"/);
assert.match(html, /id="imageEditEraserToolButton"/);
assert.match(html, /id="imageEditUndoMaskButton"/);
assert.match(html, /id="imageEditRedoMaskButton"/);
assert.match(html, /id="imageEditBrushSizeInput"/);
assert.match(html, /id="imageEditAddRegionButton"/);
assert.match(html, /id="imageEditRegionList"/);
assert.match(html, /id="imageEditExecutionStrategyInput"/);
```

Run:

```powershell
node --test test/image-edit-layout.test.mjs
```

Expected: FAIL because the markup is not present.

- [ ] **Step 2: Add local-mask markup**

Insert this panel in `public/index.html` inside `.image-edit-upload-panel`, after the source upload block and before the main edit instruction field:

```html
<section class="image-edit-local-mask-panel hidden" id="imageEditLocalMaskPanel" aria-label="局部编辑">
  <div class="image-edit-local-mask-stage" id="imageEditLocalMaskStage">
    <canvas id="imageEditSourceCanvas" class="image-edit-source-canvas" width="1" height="1"></canvas>
    <canvas id="imageEditMaskOverlayCanvas" class="image-edit-mask-overlay-canvas" width="1" height="1"></canvas>
  </div>
  <div class="image-edit-local-mask-toolbar" aria-label="局部编辑工具">
    <button class="toolbar-button" id="imageEditBrushToolButton" type="button" aria-pressed="true" title="画笔">画笔</button>
    <button class="toolbar-button" id="imageEditEraserToolButton" type="button" aria-pressed="false" title="橡皮">橡皮</button>
    <button class="toolbar-button" id="imageEditUndoMaskButton" type="button" title="撤销">撤销</button>
    <button class="toolbar-button" id="imageEditRedoMaskButton" type="button" title="重做">重做</button>
    <label class="compact-field image-edit-brush-size-field">
      <span>笔刷</span>
      <input id="imageEditBrushSizeInput" type="range" min="8" max="160" step="2" value="48" />
    </label>
    <button class="toolbar-button" id="imageEditAddRegionButton" type="button">新增区域</button>
  </div>
  <label class="compact-field image-edit-strategy-field">
    <span>执行策略</span>
    <select id="imageEditExecutionStrategyInput">
      <option value="merge">一次合并（快）</option>
      <option value="sequential">逐区精修（准）</option>
    </select>
  </label>
  <div class="image-edit-region-list" id="imageEditRegionList"></div>
  <p class="image-edit-local-mask-status" id="imageEditLocalMaskStatus" aria-live="polite"></p>
</section>
```

- [ ] **Step 3: Add stable CSS for the editor**

Add CSS blocks in `public/styles.css` near other `.image-edit-*` styles:

```css
.image-edit-local-mask-panel {
  display: grid;
  gap: 0.75rem;
}

.image-edit-local-mask-stage {
  position: relative;
  width: 100%;
  aspect-ratio: 1 / 1;
  min-height: 280px;
  overflow: hidden;
  border: 1px solid var(--panel-border);
  background: #111827;
  touch-action: none;
}

.image-edit-source-canvas,
.image-edit-mask-overlay-canvas {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.image-edit-mask-overlay-canvas {
  cursor: crosshair;
}

.image-edit-local-mask-toolbar {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  align-items: center;
}

.image-edit-brush-size-field {
  min-width: 160px;
}

.image-edit-region-list {
  display: grid;
  gap: 0.5rem;
}

.image-edit-region-card {
  display: grid;
  gap: 0.5rem;
  padding: 0.75rem;
  border: 1px solid var(--panel-border);
  background: var(--panel-surface);
}

.image-edit-region-card.is-active {
  border-color: var(--accent-color);
}

.image-edit-region-card-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.image-edit-region-swatch {
  width: 0.85rem;
  height: 0.85rem;
  flex: 0 0 auto;
  border-radius: 999px;
}

.image-edit-region-instruction {
  min-height: 4.5rem;
  resize: vertical;
}
```

- [ ] **Step 4: Add state defaults in `public/app.js`**

Inside `state.imageEdit`, add:

```js
    localEdit: {
      enabled: false,
      activeRegionId: "",
      brushSize: 48,
      tool: "brush",
      executionStrategy: "merge",
      nextRegionIndex: 1,
      regions: [],
    },
```

- [ ] **Step 5: Import helper constants in `lib/views/image-edit-view.mjs`**

Add:

```js
import {
  IMAGE_EDIT_LOCAL_MASK_MODE,
  buildLocalMaskMergedPrompt,
  normalizeLocalMaskExecutionStrategy,
} from "../image-edit-local-mask.mjs";
```

Extend `getImageEditRefs()` with every new DOM id from Step 2.

- [ ] **Step 6: Add local-mask region creation and rendering**

Add these constants and helpers near the top of `createImageEditController`:

```js
const LOCAL_MASK_COLORS = ["#f5506e", "#14b8a6", "#f59e0b", "#6366f1", "#22c55e", "#ec4899"];

function ensureLocalEditState() {
  state.imageEdit.localEdit ||= {
    enabled: false,
    activeRegionId: "",
    brushSize: 48,
    tool: "brush",
    executionStrategy: "merge",
    nextRegionIndex: 1,
    regions: [],
  };
  return state.imageEdit.localEdit;
}

function createLocalMaskRegion() {
  const localEdit = ensureLocalEditState();
  const index = localEdit.nextRegionIndex || 1;
  const region = {
    id: `region-${index}-${Date.now().toString(36)}`,
    index,
    color: LOCAL_MASK_COLORS[(index - 1) % LOCAL_MASK_COLORS.length],
    instruction: "",
    hasMask: false,
    visible: true,
    maskCanvas: null,
    undoStack: [],
    redoStack: [],
  };
  localEdit.nextRegionIndex = index + 1;
  localEdit.regions.push(region);
  localEdit.activeRegionId = region.id;
  return region;
}
```

In `renderImageEditView()`, call `renderImageEditLocalMaskEditor()` after `renderImageEditSource()`.

- [ ] **Step 7: Implement source canvas loading and repainting**

Add functions that load `state.imageEdit.source.previewUrl` into an `Image`, set source and overlay canvas dimensions to `image.naturalWidth` and `image.naturalHeight`, and draw the source image. Use CSS to scale the canvas while pointer coordinates are scaled from `getBoundingClientRect()` to natural dimensions.

Key coordinate conversion:

```js
function getCanvasPoint(event) {
  const rect = refs.imageEditMaskOverlayCanvas.getBoundingClientRect();
  const scaleX = refs.imageEditMaskOverlayCanvas.width / rect.width;
  const scaleY = refs.imageEditMaskOverlayCanvas.height / rect.height;
  return {
    x: (event.clientX - rect.left) * scaleX,
    y: (event.clientY - rect.top) * scaleY,
  };
}
```

- [ ] **Step 8: Implement brush, eraser, undo, redo, and mask export**

Use one hidden mask canvas per region with same pixel size as source canvas. Brush strokes clear alpha in the exported API mask semantics by first tracking selected pixels as opaque in the region mask canvas, then composing API masks at export time.

Required export function shape:

```js
async function buildLocalMaskPayload() {
  const validRegions = getValidLocalMaskRegions();
  const sourceFile = await exportSourceCanvasFile();
  const regionInstructions = validRegions.map((region) => ({
    id: region.id,
    index: region.index,
    color: region.color,
    instruction: region.instruction.trim(),
    hasMask: true,
  }));

  if (normalizeLocalMaskExecutionStrategy(refs.imageEditExecutionStrategyInput.value) === "sequential") {
    return {
      editMode: IMAGE_EDIT_LOCAL_MASK_MODE,
      executionStrategy: "sequential",
      sourceFile,
      masks: await Promise.all(validRegions.map(exportRegionApiMaskFile)),
      regionInstructions,
      prompt: regionInstructions.map((region) => `Region ${region.index}: ${region.instruction}`).join("\n"),
    };
  }

  return {
    editMode: IMAGE_EDIT_LOCAL_MASK_MODE,
    executionStrategy: "merge",
    sourceFile,
    mask: await exportMergedApiMaskFile(validRegions),
    regionInstructions,
    prompt: buildLocalMaskMergedPrompt(regionInstructions),
  };
}
```

- [ ] **Step 9: Create local-mask jobs from the view**

Change `startImageEditGeneration()` so that when valid painted regions exist, it awaits `buildLocalMaskPayload()` and passes the result into `createImageEditJob(payload)`. Whole-image edit keeps the existing path when there are no painted regions.

Add fields to the returned job:

```js
editMode: payload?.editMode || "",
executionStrategy: payload?.executionStrategy || "",
regionInstructions: payload?.regionInstructions || [],
localMask: payload
  ? { mask: payload.mask || null, masks: payload.masks || [] }
  : null,
referenceFiles: payload?.sourceFile ? [payload.sourceFile] : [sourceItem.generationFile || sourceItem.file],
prompt: payload?.prompt || prompt,
editInstruction: payload?.prompt || prompt,
```

- [ ] **Step 10: Append local-mask form data in `public/app.js`**

Extend `appendImageEditReferencesToFormData(formData, job)`:

```js
  if (job.editMode === "local-mask") {
    formData.set("editMode", "local-mask");
    formData.set("executionStrategy", job.executionStrategy || "merge");
    formData.set("regionInstructions", JSON.stringify(job.regionInstructions || []));
    if (job.localMask?.mask) {
      formData.set("mask", job.localMask.mask);
    }
    for (const mask of job.localMask?.masks || []) {
      formData.append("masks[]", mask);
    }
  }
```

- [ ] **Step 11: Run focused frontend tests**

Run:

```powershell
node --test test/image-edit-layout.test.mjs test/browser-shell-modules.test.mjs
```

Expected: PASS once the DOM, job shape, and form-data assertions match.

---

### Task 3: Local Server Execution

**Files:**
- Modify: `test/image-edit-server.test.mjs`
- Modify: `server.mjs`
- Modify: `lib/gallery-store.mjs`
- Modify: `openspec/changes/add-local-mask-image-edit/tasks.md`

- [ ] **Step 1: Add failing local server tests**

Add helpers to `test/image-edit-server.test.mjs`:

```js
const LOCAL_MASK_REGION_JSON = JSON.stringify([
  { id: "region-1", index: 1, color: "#f5506e", instruction: "去掉这段反光", hasMask: true },
  { id: "region-2", index: 2, color: "#14b8a6", instruction: "把背景改成浅灰摄影棚", hasMask: true },
]);

function makeLocalMaskImageEditForm({ executionStrategy = "merge", maskCount = 1, fields = {}, baseUrl } = {}) {
  const formData = makeImageEditForm({
    baseUrl,
    referenceFiles: [new File(["source-png"], "source-normalized.png", { type: "image/png" })],
    fields: {
      editMode: "local-mask",
      executionStrategy,
      regionInstructions: LOCAL_MASK_REGION_JSON,
      ...fields,
    },
  });

  if (executionStrategy === "sequential") {
    for (let index = 0; index < maskCount; index += 1) {
      formData.append("masks[]", new File([`mask-${index}`], `mask-${index + 1}.png`, { type: "image/png" }));
    }
  } else {
    formData.set("mask", new File(["merged-mask"], "merged-mask.png", { type: "image/png" }));
  }

  return formData;
}
```

Add tests for merge and sequential behavior:

```js
test("local generate runs merged local-mask image edit and saves metadata", async (t) => {
  const context = await startImageEditTestServer(t);
  const response = await fetch(`${context.baseUrl}/api/generate`, {
    method: "POST",
    body: makeLocalMaskImageEditForm({ baseUrl: context.upstream.baseUrl }),
  });
  const events = parseSseEvents(await response.text());
  const saved = events.find((event) => event.eventName === "saved");

  assert.equal(context.upstream.requests.length, 1);
  assert.match(context.upstream.requests[0].body, /name="mask"/);
  assert.match(context.upstream.requests[0].body, /Region 1: 去掉这段反光/);
  assert.equal(saved.payload.item.editMode, "local-mask");
  assert.equal(saved.payload.item.executionStrategy, "merge");
  assert.equal(saved.payload.item.regionCount, 2);
});

test("local generate runs sequential local-mask image edit in region order", async (t) => {
  const context = await startImageEditTestServer(t);
  const response = await fetch(`${context.baseUrl}/api/generate`, {
    method: "POST",
    body: makeLocalMaskImageEditForm({
      executionStrategy: "sequential",
      maskCount: 2,
      baseUrl: context.upstream.baseUrl,
    }),
  });
  const events = parseSseEvents(await response.text());
  const saved = events.find((event) => event.eventName === "saved");

  assert.equal(context.upstream.requests.length, 2);
  assert.match(context.upstream.requests[0].body, /Region 1 of 2/);
  assert.match(context.upstream.requests[1].body, /Region 2 of 2/);
  assert.equal(saved.payload.item.executionStrategy, "sequential");
  assert.equal(saved.payload.item.regionCount, 2);
});
```

Use the existing server-start pattern in the file. Extracting `startImageEditTestServer(t)` is allowed only from duplicated setup already in `test/image-edit-server.test.mjs`.

- [ ] **Step 2: Run the server tests and verify they fail**

Run:

```powershell
node --test test/image-edit-server.test.mjs
```

Expected: FAIL because `editMode`, masks, and metadata are not parsed yet.

- [ ] **Step 3: Import helper functions in `server.mjs`**

Add:

```js
import {
  IMAGE_EDIT_LOCAL_MASK_MODE,
  buildLocalMaskMergedPrompt,
  buildLocalMaskMetadata,
  buildLocalMaskRegionPrompt,
  normalizeLocalMaskExecutionStrategy,
  parseLocalMaskRegionInstructions,
} from "./lib/image-edit-local-mask.mjs";
```

- [ ] **Step 4: Parse and validate local-mask form fields**

Near the existing image-edit branch in `server.mjs`, read:

```js
const imageEditMode = String(formData.get("editMode") || "").trim();
const isLocalMaskImageEdit = isImageEdit && imageEditMode === IMAGE_EDIT_LOCAL_MASK_MODE;
const executionStrategy = normalizeLocalMaskExecutionStrategy(formData.get("executionStrategy"));
const regionInstructions = isLocalMaskImageEdit
  ? parseLocalMaskRegionInstructions(formData.get("regionInstructions"))
  : [];
const imageEditMask = formData.get("mask");
const imageEditMasks = formData.getAll("masks[]").length > 0
  ? formData.getAll("masks[]")
  : formData.getAll("masks");
```

Validation rules:

```js
if (isLocalMaskImageEdit && regionInstructions.length === 0) {
  throwGenerationError("请先涂抹至少一个要修改的区域。");
}
if (isLocalMaskImageEdit && executionStrategy === "merge" && !(imageEditMask instanceof File)) {
  throwGenerationError("局部编辑需要一张合并 mask。");
}
if (isLocalMaskImageEdit && executionStrategy === "sequential" && imageEditMasks.length !== regionInstructions.length) {
  throwGenerationError("逐区精修需要为每个区域提供一张 mask。");
}
```

If the existing request handler does not have `throwGenerationError`, use its current `generationTaskStore.failTask` plus `writeSseEvent(response, "error", { message })` pattern.

- [ ] **Step 5: Implement merge and sequential execution**

Where image-edit currently calls `requestImageEdit`, branch:

```js
if (isLocalMaskImageEdit && executionStrategy === "merge") {
  const metadata = buildLocalMaskMetadata({
    executionStrategy,
    regions: regionInstructions,
    sourceImageName,
  });
  prompt = buildLocalMaskMergedPrompt(regionInstructions);
  editInstruction = metadata.editInstruction;
  generationResult = await requestImageEdit({
    ...generationConfig,
    prompt,
    sourceImage: referenceImages[0],
    mask: await toReferenceImage(imageEditMask),
    size: finalSize,
    quality: finalQuality,
    format: finalFormat,
    imageModel: generationConfig.imageModel,
    onEvent,
  });
  localMaskMetadata = metadata;
}
```

For sequential:

```js
let currentSource = referenceImages[0];
let finalBase64 = "";
for (let index = 0; index < regionInstructions.length; index += 1) {
  const region = regionInstructions[index];
  const result = await requestImageEdit({
    ...generationConfig,
    prompt: buildLocalMaskRegionPrompt(region, { total: regionInstructions.length }),
    sourceImage: currentSource,
    mask: await toReferenceImage(imageEditMasks[index]),
    size: finalSize,
    quality: finalQuality,
    format: finalFormat,
    imageModel: generationConfig.imageModel,
    onEvent,
  });
  finalBase64 = result.finalImageBase64;
  currentSource = {
    filename: `local-mask-region-${region.index}.png`,
    mimeType: "image/png",
    buffer: Buffer.from(normalizeBase64(finalBase64), "base64"),
  };
}
generationResult = {
  finalImageBase64: finalBase64,
  responseCompleted: true,
  fallbackUsed: false,
  streamFallbackUsed: false,
  sizeFallbackUsed: false,
  requestedSize: finalSize,
  effectiveSize: finalSize,
  format: finalFormat,
  imageModel: generationConfig.imageModel,
  imageRoute: "edit",
};
localMaskMetadata = buildLocalMaskMetadata({ executionStrategy, regions: regionInstructions, sourceImageName });
editInstruction = localMaskMetadata.editInstruction;
```

- [ ] **Step 6: Save local-mask metadata**

In the image edit save metadata object, spread local-mask metadata only when present:

```js
...(localMaskMetadata || {}),
```

If `lib/gallery-store.mjs` filters metadata fields, add:

```js
"editMode",
"executionStrategy",
"regionCount",
"regionInstructions",
```

- [ ] **Step 7: Run server tests**

Run:

```powershell
node --test test/image-edit-server.test.mjs
```

Expected: PASS.

---

### Task 4: Cloudflare Worker Parity

**Files:**
- Modify: `test/cloudflare-pages-worker.test.mjs`
- Modify: `cloudflare-pages-worker.mjs`
- Modify: `openspec/changes/add-local-mask-image-edit/tasks.md`

- [ ] **Step 1: Add Worker parity tests**

Mirror the local server merge and sequential assertions in `test/cloudflare-pages-worker.test.mjs`. Assert:

```js
assert.equal(upstream.requests.length, 1);
assert.match(upstream.requests[0].body, /name="mask"/);
assert.equal(savedEvent.payload.item.editMode, "local-mask");
assert.equal(savedEvent.payload.item.executionStrategy, "merge");
```

For sequential:

```js
assert.equal(upstream.requests.length, 2);
assert.match(upstream.requests[0].body, /Region 1 of 2/);
assert.match(upstream.requests[1].body, /Region 2 of 2/);
assert.equal(savedEvent.payload.item.executionStrategy, "sequential");
```

- [ ] **Step 2: Run Worker tests and verify they fail**

Run:

```powershell
node --test test/cloudflare-pages-worker.test.mjs
```

Expected: FAIL because Worker local-mask parsing and execution are not implemented.

- [ ] **Step 3: Import helper functions in Worker**

Add the same helper import used in `server.mjs`:

```js
import {
  IMAGE_EDIT_LOCAL_MASK_MODE,
  buildLocalMaskMergedPrompt,
  buildLocalMaskMetadata,
  buildLocalMaskRegionPrompt,
  normalizeLocalMaskExecutionStrategy,
  parseLocalMaskRegionInstructions,
} from "./lib/image-edit-local-mask.mjs";
```

- [ ] **Step 4: Mirror parsing, validation, execution, and metadata**

Copy the local server behavior using Worker-compatible `File` and `Blob` values. When converting sequential output to the next source, use:

```js
currentSource = {
  filename: `local-mask-region-${region.index}.png`,
  mimeType: "image/png",
  buffer: base64ToUint8Array(finalBase64),
};
```

Use the Worker file conversion helper already present near its image upload parsing, rather than importing Node `Buffer`.

- [ ] **Step 5: Run Worker tests**

Run:

```powershell
node --test test/cloudflare-pages-worker.test.mjs
```

Expected: PASS.

---

### Task 5: Sync, Full Verification, and Browser QA

**Files:**
- Modify: `public/lib/image-edit-local-mask.mjs`
- Modify: `public/lib/image-edit-shell-bridge.mjs`
- Modify: `public/lib/views/image-edit-view.mjs`
- Modify: `openspec/changes/add-local-mask-image-edit/tasks.md`

- [ ] **Step 1: Sync public lib**

Run:

```powershell
npm run sync:public-lib
```

Expected: public lib files are copied without errors.

- [ ] **Step 2: Run focused test group**

Run:

```powershell
node --test test/image-edit-local-mask.test.mjs test/responses-workflow.test.mjs test/image-edit-layout.test.mjs test/browser-shell-modules.test.mjs test/image-edit-server.test.mjs test/cloudflare-pages-worker.test.mjs test/public-lib-sync.test.mjs
```

Expected: PASS.

- [ ] **Step 3: Run full tests**

Run:

```powershell
npm test
```

Expected: PASS for the full suite.

- [ ] **Step 4: Run diff and encoding checks**

Run:

```powershell
git diff --check
$pattern = "TB" + "D|TO" + "DO|待" + "定|占" + "位|不确" + "定|\?\?|" + [char]0xFFFD
rg -n $pattern openspec\changes\add-local-mask-image-edit docs\superpowers\plans\2026-06-09-local-mask-image-edit.md public\index.html public\styles.css public\app.js lib test server.mjs cloudflare-pages-worker.mjs
```

Expected: `git diff --check` exits 0, and `rg` finds no placeholder text or replacement characters in files changed for this feature.

- [ ] **Step 5: Start the local Studio server**

Run on an unused port:

```powershell
$env:PORT="3601"; npm run dev
```

Expected: server starts and serves `http://127.0.0.1:3601/#image-edit`.

- [ ] **Step 6: Browser QA in the in-app browser**

Use the Browser plugin to open:

```text
http://127.0.0.1:3601/#image-edit
```

Verify:

- Uploading one source image shows the local-mask canvas.
- Add two regions; each gets a stable numbered card and color.
- Brush paints only the active region; eraser removes only the active region.
- Undo and redo affect only the active region.
- Region instruction textareas accept separate instructions.
- Strategy selector switches between `一次合并（快）` and `逐区精修（准）`.
- The generation action is disabled or shows feedback when a painted region has no instruction.
- Whole-image Image Edit still works when no regions are painted.
- Desktop and narrow viewport layouts have no overlapping controls or clipped text.

- [ ] **Step 7: Update OpenSpec task statuses**

Mark completed items in `openspec/changes/add-local-mask-image-edit/tasks.md` with `[x]` only after the corresponding tests or browser QA pass.

---

## Self-Review Checklist

- Spec coverage: tasks cover local-mask UI, region management, brush/erase/undo/redo, validation, PNG source and alpha masks, merge strategy, sequential strategy, saved metadata, Worker parity, and whole-image compatibility.
- Placeholder scan: run the `rg` command in Task 5 Step 4 before execution handoff.
- Type consistency: use `editMode`, `executionStrategy`, `regionInstructions`, `mask`, `masks[]`, `localMask`, `sourceImageName`, and `editInstruction` consistently across browser jobs, form data, server parsing, Worker parsing, and saved metadata.
- Git discipline: do not commit unless the user explicitly asks for a commit.
