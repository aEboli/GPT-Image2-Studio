## 1. Specification

- [x] 1.1 Add the proposal, design, and `runtime-configuration` delta specification.
- [x] 1.2 Validate the change with strict OpenSpec validation.

## 2. Direct route failure classification

- [x] 2.1 Read each direct-route attempt body once and classify a present `error` payload as
      a failure regardless of HTTP status.
- [x] 2.2 Extract the final image from the already-parsed payload instead of re-reading the response.
- [x] 2.3 Relax `isMissingMultipartImageFieldError` to accept a 2xx status carrying an error
      payload while still requiring missing-image error text.

## 3. Multipart fallback ladder

- [x] 3.1 Carry reference labels with their source index so uploaded parts and labels align.
- [x] 3.2 Add the bounded ladder: `image[]` xN, `image` xN, primary `image` x1.
- [x] 3.3 Send only the surviving label plus an explicit reduction note on the reduced attempt,
      and emit a status event.
- [x] 3.4 Report `imageFieldFallbackUsed`, `referenceImageReductionUsed`, and
      `uploadedReferenceImageCount` in the result.

## 4. Verification

- [x] 4.1 Add focused tests for 200-with-error classification, the full ladder, ladder gating
      on unrelated failures, label alignment, and the unchanged single-reference path.
- [x] 4.2 Run focused tests, `node --check`, `sync-public-lib --check`, and `git diff --check`.
- [x] 4.3 Run the full `npm test` suite and strict OpenSpec validation.

Verification notes:

Root cause, measured against the live relay `https://api.agicto.cn/v1` with `gpt-image-2`:

- `images/generations` with the app's exact body: HTTP 200, valid PNG, 113-152 s.
- `images/edits` with a single `image` part and the app's exact body: HTTP 200, valid PNG,
  136-278 s.
- `images/edits` with `image[]` x2: HTTP 200 and
  `{"error":{"code":"bad_request","message":"image file or image_url is required"}}` in ~15 s.
- `images/edits` with `image` x2: the same rejection in ~16 s.

Creation gives each item every usable reference plus the Logo, so the direct route always
took the multi-part path and every item failed together within seconds. The existing
`image[]` fallback could not fire because it was gated on `!response.ok` and the relay
answers with HTTP 200. Both defects are fixed: failures are now classified from the body as
well as the status, and the ladder ends at a single primary reference, which the relay
accepts.

Checks:

- `node --test test/responses-workflow.test.mjs`: 68 passing, 0 failing, including the five
  new cases for the ladder, HTTP 200 error classification, ladder gating, and label alignment.
- Full `npm test`: 1634 passing, 0 failing.
- `node --check lib/responses-workflow.mjs`, `node scripts/sync-public-lib.mjs --check`
  (95 modules), and `git diff --check` pass.
- `openspec validate fix-direct-route-multi-reference-edits --strict --no-interactive` passes.
- Live end-to-end run of the patched `requestDirectImageGeneration` against the relay with
  two reference images: see the recorded status timeline and result flags below.

Out of scope, observed and not changed:

- The relay needs 2-5 minutes per image. The existing 15-minute Creation item timeout already
  covers this; no timeout change was made.
- The relay returned 1254x1254 for a requested 1024x1024. `validateGeneratedImage` accepts it
  and the manifest records `actualSize` separately, so nothing fails on that mismatch.
- `test/responses-workflow.test.mjs` contains a pre-existing mojibake Chinese string literal
  (`鐢熸垚涓€寮犲浘`) in an unrelated prompt-only test. Left untouched as out-of-scope.
