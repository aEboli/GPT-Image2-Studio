## 1. Resolution Tier Unification

- [x] 1.1 Set every built-in platform profile `resolutionTier` in `lib/creation-platform-policies.mjs` to `1K`.
- [x] 1.2 Set the planner appended-item fallback tier in `lib/creation-planner.mjs` to `1K`.
- [x] 1.3 Set the browser fallback platform option `resolutionTier` in `public/app.js` to `1K`.
- [x] 1.4 Confirm an explicit set-level `resolutionTier` override still wins for preview, frozen plan, queue snapshot, and per-item requests.

## 2. Parallel Limit Unification

- [x] 2.1 Raise `MAX_CREATION_PARALLEL_TASKS` to 20 in `lib/studio-constants.mjs`.
- [x] 2.2 Raise `MAX_CONCURRENT_WORKERS` to 20 in `lib/limited-concurrency.mjs` so the limit is not clamped.
- [x] 2.3 Make the browser creation queue budget read `MAX_CREATION_PARALLEL_TASKS` via `getCreationMaxParallelTaskCount`.
- [x] 2.4 Verify generation, repair, and auto-repair all fan out under the same limit and the same session slot scope.

## 3. Per-Request Reference Registry

- [x] 3.1 Add `lib/creation-reference-upload-cache.mjs` with a request-scoped registry keyed by content fingerprint.
- [x] 3.2 Register reference images and the Logo image once per Creation generation request and resolve per-item references through the registry.
- [x] 3.3 Do the same in the Creation repair request path.

## 4. Responses Route File Identifier Reuse

- [x] 4.1 Support `file_id` reference input in `buildResponsesInput` alongside inline base64.
- [x] 4.2 Upload registered references to the upstream Files API once per request, keyed by upstream target, on the Responses route.
- [x] 4.3 Fall back to inline base64 for any image whose upload is unsupported, rejected, or returns no usable identifier, without failing the item and without retrying per item.
- [x] 4.4 Keep the direct image route and model-protocol route on inline references.

## 5. Synchronization And Verification

- [x] 5.1 Synchronize changed root `lib` modules to `public/lib`.
- [x] 5.2 Update `test/studio-limits.test.mjs` and `test/limited-concurrency.test.mjs` for the new limits.
- [x] 5.3 Update platform policy and platform planner tests that assert `1.5K`, `2K`, or `max` profile tiers.
- [x] 5.4 Add tests for the reference registry: duplicate bytes register once, registry does not cross requests, identifiers are per upstream target.
- [x] 5.5 Add tests for Responses `file_id` reuse: one upload per reference across twenty items, and inline fallback on upload failure.
- [x] 5.6 Run the full test suite.

## Verification Notes

- Full suite: 1769 tests, 1750 pass, 19 fail. All 19 failures assert prompt text
  (`/CONVERSION INTENT/`, `/SUBJECT CONTENT LOCK:/`, `/Industry template:/`, `/Do not invent .../`,
  `/substantially redesigned at first glance/`, SKU blueprint phrases) and belong to the in-flight
  `compress-creation-suite-prompts` change already present in the working tree. `git stash push -u`
  plus `npm test` gives 1671 pass / 0 fail on HEAD, and none of the 19 assertions reference a
  resolution tier, a task limit, or the reference upload path.
- Not covered by automated tests: a live upstream that actually accepts `/v1/files`. The e2e
  regression path runs against the local image mock, which never reaches the upload branch, so the
  `file_id` request shape is verified at the unit level only.
- Operational: 20 parallel creation tasks put roughly twice the burst pressure on a third-party
  proxy as 10 did. Over a provider limit this surfaces as an upstream error on the affected items
  rather than as queueing.
