## 1. Edit Request Contract

- [x] 1.1 Add failing tests for Image API edit request body construction and final image extraction in `test/responses-workflow.test.mjs`.
- [x] 1.2 Implement a shared `requestImageEdit` helper in `lib/responses-workflow.mjs` that posts one uploaded image to `/images/edits` with `model=gpt-image-2`, prompt, size, quality, and output format.
- [x] 1.3 Update edit response parsing to accept non-stream JSON and edit stream event names without regressing existing image generation parsing.
- [x] 1.4 Run `node --test ./test/responses-workflow.test.mjs` and confirm the new edit tests pass.

## 2. Local Server Image Edit Mode

- [x] 2.1 Add failing local server tests for `mode=image-edit`: no image, multiple images, empty prompt, valid request, saved metadata, output folder routing, and SSE completion.
- [x] 2.2 Add image-edit mode constants, validation, metadata fields, and request branching in `server.mjs`.
- [x] 2.3 Ensure saved gallery items include `generationMode`, `assetKind`, `sourceImageName`, and `editInstruction` for Image Edit outputs.
- [x] 2.4 Run the new local server tests and related generation task/gallery tests.

## 3. Cloudflare Worker Parity

- [x] 3.1 Add failing Worker tests for image-edit mode validation, upstream edit request construction, queued task metadata, and saved item metadata.
- [x] 3.2 Mirror image-edit mode support in `cloudflare-pages-worker.mjs`.
- [x] 3.3 Update any shared API contract or route capability tests needed for Worker/local parity.
- [x] 3.4 Run `node --test ./test/cloudflare-pages-worker.test.mjs ./test/api-contract.test.mjs`.

## 4. Frontend View Integration

- [x] 4.1 Add failing layout and lazy-loader tests for `#image-edit`, the Create menu entry, HTML panel, view module registration, source upload controls, instruction input, preview area, and absence of mask controls.
- [x] 4.2 Add `lib/views/image-edit-view.mjs` with single-image upload, preview/remove, validation, generation job creation, thumbnail rendering, and cleanup.
- [x] 4.3 Add minimal app-shell hooks in `public/app.js` for `image-edit` state, Create view routing, renderer registration, `buildGenerationFormData`, queue cancellation cleanup, and gallery deletion cleanup.
- [x] 4.4 Add `public/index.html` and `public/styles.css` updates matching existing Studio visual patterns.
- [x] 4.5 Run `npm run sync:public-lib` and verify `public/lib/views/image-edit-view.mjs` and `public/lib/view-mode-loader.mjs` stay in sync with `lib/`.
- [x] 4.6 Run the new layout tests plus `node --test ./test/view-mode-loader.test.mjs ./test/public-lib-sync.test.mjs ./test/browser-shell-modules.test.mjs`.

## 5. End-to-End Verification

- [x] 5.1 Run the full test suite with `npm test`.
- [x] 5.2 Start the local Studio server with `npm run dev` and open `#image-edit` in the in-app browser.
- [x] 5.3 Verify the real UI shows one upload area, edit instruction input, ratio/size/output controls, generated preview panel, thumbnail strip, and no mask controls.
- [x] 5.4 Verify client-side validation blocks generation when the source image or edit instruction is missing.
- [x] 5.5 Stop the local server and record any unavailable live OpenAI verification constraints.

### Verification Notes

- 2026-06-09: `npm test` passed with 784/784 tests after adding the visible Image Edit output-format control.
- 2026-06-09: In-app browser opened `http://127.0.0.1:3601/?codexVerify=image-edit-output#image-edit`; verified one source upload, edit instruction, ratio/size/output controls, preview panel, thumbnail strip, and no mask/brush/erase controls.
- 2026-06-09: Client gate verified in the live page: with an edit instruction and `0 / 1` source images, the generate button stayed disabled; after clearing the instruction, the button stayed disabled. The in-app browser documented API did not provide a file-upload helper, so the source-present/missing-instruction browser upload branch was not exercised manually; automated local/Worker/client tests cover that validation path.
- 2026-06-09: No live OpenAI image edit call was made; endpoint request construction, response parsing, SSE completion, and metadata persistence are covered by mocked tests.
