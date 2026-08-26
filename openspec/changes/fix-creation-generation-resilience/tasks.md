## 1. Specification and baseline

- [x] 1.1 Add the Creation resilience proposal, design, and delta specification.
- [x] 1.2 Record current focused test commands and preserve unrelated dirty changes.

## 2. Shared request lifecycle

- [x] 2.1 Add optional signal propagation to all image-generation fetch paths.
- [x] 2.2 Make Responses SSE reads abortable and preserve existing buffered-image recovery behavior.
- [x] 2.3 Add focused unit tests for abort, timeout, recovery, and heartbeat behavior.

## 3. Creation server behavior

- [x] 3.1 Add a dedicated Creation concurrency constant and use it for Creation generation, repair, and Logo batch workers.
- [x] 3.2 Add per-item timeout and response-close cancellation around Creation upstream requests.
- [x] 3.3 Pass the Creation heartbeat interval and preserve item-level failure/manifest semantics.
- [x] 3.4 Add static and mock E2E regression assertions for the new lifecycle.

## 4. Verification and handoff

- [x] 4.1 Run focused tests, syntax checks, `sync-public-lib --check`, and `git diff --check`.
- [x] 4.2 Run strict OpenSpec validation and the full `npm test` suite.
- [x] 4.3 Restart only the current local `node server.mjs` process after verification; confirm PID/start time, port 3600, and HTTP 200.

Verification notes:

- Focused regression command passed with 128/128 tests, including Creation queue/E2E, server static checks, image validation, Responses abort/recovery, and retry-heartbeat state.
- `node --check` passed for `server.mjs`, `lib/responses-workflow.mjs`, `lib/studio-constants.mjs`, and `lib/generated-image-validation.mjs`.
- `node scripts/sync-public-lib.mjs --check`, `git diff --check`, and `openspec validate fix-creation-generation-resilience --strict --no-interactive` passed.
- Full `npm test` now completes with 1617 passing and 0 failing tests. The previously recorded 9 failures in the browser/config worktree changes no longer reproduce. `openspec validate fix-creation-generation-resilience --strict --no-interactive` passes.
- Review follow-up: the JPEG branch of `validateGeneratedImage` scanned entropy-coded data as a marker stream, so 0xff00 stuffing was misread as a segment header and 7 of the 8 real JPEG assets in `docs/images` were rejected as `malformed-image`. Because the check runs in the `final_image` handler, selecting JPG output failed the whole request after the upstream image was already produced and billed. `parseJpeg` now hands the post-SOS scan to a stuffing-aware skipper, and the tests cover every repository JPEG plus truncated inputs instead of a single sample.
- Review follow-up: the unknown-result retry gate excluded only `failed`, so a recovery poll timeout against a task the provider still reported as `in_progress` issued a second billable generation POST. The gate now retries only on a genuinely unknown outcome, and unreadable bodies are classified by HTTP status so the 404 "not retained" retry still works.
- Review follow-up: `consumeResponsesSse` never cancelled its reader when it stopped reading early, so a terminal upstream error, an `onEvent` rejection, a `[DONE]` sentinel, or a buffered-image recovery left the upstream socket open until the provider closed it. The new image validation added a frequent trigger for that path. The reader is now cancelled whenever the stream was not drained.
- Review follow-up: `createCreationRequestLifecycle` attached its close listener after the worker had already waited for a session slot, so a client that disconnected during that wait left the item running to its full 15-minute timeout. An already-closed response now aborts immediately. `getError` also relabelled any late error with the lifecycle reason, reporting an unrelated upstream failure as a timeout; only abort-shaped errors are relabelled now.
- Review follow-up: `decodeAndValidateGeneratedImage` remembers the last accepted payload, so the save-time call no longer re-decodes and re-scans a multi-megabyte buffer that the `final_image` handler just validated.
- Review follow-up: `IMAGE_STUDIO_CREATION_UPSTREAM_TIMEOUT_MS` and `IMAGE_STUDIO_ENABLE_TEST_MOCKS` are now documented in `.env.example` and the README environment table.
- Restart verification: the previous PID 156892 was stopped only after confirming it was the Node process serving `127.0.0.1:3600`; PID 122332 now runs `node server.mjs`, listens on `127.0.0.1:3600`, responds to `/` with HTTP 200, and reports `Responding: True`. The Creation default upstream timeout is 15 minutes (900000 ms).
