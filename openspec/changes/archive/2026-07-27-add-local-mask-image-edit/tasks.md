## 1. Contract and Layout Tests

- [x] 1.1 Add failing layout assertions for the Image Edit local-mask section in `test/image-edit-layout.test.mjs`: source canvas editor, brush/eraser buttons, undo/redo buttons, brush size input, add-region button, region list, execution strategy selector, and local-mask generation button text.
- [x] 1.2 Add failing browser-shell module tests in `test/browser-shell-modules.test.mjs` for local-mask job construction: whole-image jobs remain unchanged, merge jobs append one `mask`, sequential jobs append ordered `masks[]`, and `regionInstructions` JSON is preserved.
- [x] 1.3 Add failing request helper tests in `test/responses-workflow.test.mjs` proving `requestImageEdit` includes optional `mask` in multipart `/images/edits` requests without changing unmasked edit requests.

## 2. Frontend Local Mask Editor

- [x] 2.1 Extend `public/index.html` with local-mask editor markup inside `#image-edit`, including source canvas, overlay canvas, toolbar controls, execution strategy selector, region list container, and local-mask status text.
- [x] 2.2 Extend `public/styles.css` for stable editor layout, non-shifting canvas dimensions, responsive source canvas sizing, toolbar controls, region cards, visible color swatches, active-region state, and touch-safe pointer interaction.
- [x] 2.3 Extend `state.imageEdit` in `public/app.js` with `localEdit` defaults: enabled state, active region id, brush size, tool, execution strategy, stable next index, regions, and per-region undo/redo data.
- [x] 2.4 Implement canvas image loading and normalized PNG source export in `lib/views/image-edit-view.mjs`, using the uploaded source image natural dimensions and preserving the existing source upload lifecycle.
- [x] 2.5 Implement region creation, selection, visibility, clear, delete, stable numbering, and per-region instruction editing in `lib/views/image-edit-view.mjs`.
- [x] 2.6 Implement circular brush, eraser, brush size, pointer coordinate scaling, active-region undo/redo, has-mask detection, and colored overlay rendering in `lib/views/image-edit-view.mjs`.
- [x] 2.7 Implement local-mask validation in `lib/views/image-edit-view.mjs`: require one source image, at least one painted region, and non-empty instructions for painted regions while ignoring empty unpainted regions.
- [x] 2.8 Implement merge and sequential mask export in `lib/views/image-edit-view.mjs`: transparent pixels for editable regions, opaque pixels elsewhere, same pixel dimensions as normalized source PNG, and ordered `regionInstructions` JSON.
- [x] 2.9 Extend `lib/image-edit-shell-bridge.mjs` and `public/app.js` job building so local-mask jobs submit `editMode`, `executionStrategy`, `regionInstructions`, `mask` or `masks[]`, and the normalized PNG source image while whole-image edit jobs keep current fields.

Task 2.9 note: No shell bridge field change was needed; view job creation and app FormData serialization own local-mask payloads.

## 3. Backend Local Mask Execution

- [x] 3.1 Add failing local server tests in `test/image-edit-server.test.mjs` for local-mask validation: no source image, multiple source images, missing mask, non-image mask, invalid execution strategy, no painted instructions, and painted region missing instruction.
- [x] 3.2 Add failing local server tests in `test/image-edit-server.test.mjs` for merge execution: one upstream `/images/edits` request with `model=gpt-image-2`, normalized source image, merged mask, combined prompt, size, quality, output format, and saved local-mask metadata.
- [x] 3.3 Add failing local server tests in `test/image-edit-server.test.mjs` for sequential execution: one upstream `/images/edits` request per region, previous output reused as next source, region-specific masks and prompts in order, final image saved, and failed intermediate requests do not save gallery assets.
- [x] 3.4 Extend `lib/responses-workflow.mjs` so `requestImageEdit` accepts an optional `mask` file/blob and appends it to multipart edit requests.
- [x] 3.5 Extend `server.mjs` image-edit parsing to read `editMode`, `executionStrategy`, `regionInstructions`, `mask`, and `masks[]`, then validate local-mask requests separately from whole-image edit requests.
- [x] 3.6 Implement merge prompt construction and single-call local-mask execution in `server.mjs`.
- [x] 3.7 Implement sequential prompt construction and ordered multi-call local-mask execution in `server.mjs`, converting each returned base64 image into the next source file/blob and emitting region-aware progress/error text.
- [x] 3.8 Extend gallery save metadata in `server.mjs` and `lib/gallery-store.mjs` as needed for `editMode`, `executionStrategy`, `regionCount`, `regionInstructions`, and combined `editInstruction`.

## 4. Cloudflare Worker Parity

- [x] 4.1 Add failing Worker tests in `test/cloudflare-pages-worker.test.mjs` for local-mask validation, merge request construction, sequential request construction, queued task metadata, and saved metadata.
- [x] 4.2 Mirror local-mask form parsing, validation, prompt construction, merge execution, sequential execution, and metadata persistence in `cloudflare-pages-worker.mjs`.
- [x] 4.3 Confirm Worker local-mask code uses Web `File`/`Blob` compatible data and does not depend on Node-only file primitives.

## 5. Sync, Verification, and Browser QA

- [x] 5.1 Run `npm run sync:public-lib` and verify `public/lib/views/image-edit-view.mjs`, `public/lib/image-edit-shell-bridge.mjs`, and `public/lib/view-mode-loader.mjs` remain in sync with `lib/`.
- [x] 5.2 Run focused tests for image edit, request helper, browser shell modules, Worker parity, and public-lib sync.
- [x] 5.3 Run the full test suite with `npm test`.
- [x] 5.4 Run `git diff --check` and fix any whitespace or encoding issues introduced by the change.
- [x] 5.5 Start the local Studio server on the current workspace port and open `#image-edit` in the in-app browser.
- [x] 5.6 In the in-app browser, verify the local-mask UI path: upload source image, add two regions, paint and erase, enter two region instructions, switch merge/sequential strategy, and confirm no text or controls overlap at desktop and narrow viewport widths.
- [x] 5.7 Verify whole-image Image Edit still works visually without painted regions and still does not require mask fields.

Task 5.6/5.7 note: The in-app browser automation API does not expose file upload. Desktop and narrow layout were checked in the in-app browser with no visible control overlap or console errors; upload/paint/erase/undo/redo/strategy/whole-image payload behavior is covered by automated frontend and server tests.
