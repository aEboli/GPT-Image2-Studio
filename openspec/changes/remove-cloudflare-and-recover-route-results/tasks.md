## 1. Specification

- [x] Record the retired Cloudflare runtime boundary.
- [x] Specify Route A original-response retrieval and the no-automatic-regeneration rule.

## 2. Cloudflare retirement

- [x] Remove Worker, R2, Wrangler, Pages build, and Worker-only test artifacts.
- [x] Remove current CI, package, capability-matrix, README, Windows-documentation, and active-spec references.
- [x] Preserve historical release/archive records unless they are executable current support claims.

## 3. Route A recovery

- [x] Capture `response.id` in the SSE parser and return it only inside the helper result.
- [x] Add bounded GET retrieval/polling and image extraction for the original Response.
- [x] Remove automatic Route A generation fallback/retry POSTs while preserving non-Route-A branches.
- [x] Add status messages distinguishing recovery, waiting, recovered, failed, and unknown original state.

## 4. Verification

- [x] Add fake-fetch tests for completed recovery, GET-only polling, failed/unknown/no-ID cases, and no second POST.
- [x] Keep final-image-tail-error and Route B/C regression coverage.
- [x] Run focused tests, full Node test suite, public-lib sync check, OpenSpec strict validation, and diff checks.
