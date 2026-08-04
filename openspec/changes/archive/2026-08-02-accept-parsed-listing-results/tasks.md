## 1. Acceptance Regressions

- [x] 1.1 Replace Platform V1 rejection coverage for local dimension and bilingual validation differences with acceptance coverage for the returned draft.
- [x] 1.2 Add or update the non-V1 Listing regression so local validation findings neither retry nor reject a parsed response object.
- [x] 1.3 Add a browser controller regression proving a successful API response with incomplete physical fields is kept in current state.
- [x] 1.4 Cover both Listing contracts accepting incomplete Listing content directly while retrying once for empty, non-object, or unrecognized responses.

## 2. Implementation

- [x] 2.1 Remove validator-driven Listing rejection after a Platform V1 response is parsed and normalized, while preserving upstream and parsing errors.
- [x] 2.2 Return normalized non-V1 response objects without validator-driven retries or errors.
- [x] 2.3 Remove the browser-side dimensions and weights completeness gate before the successful response is upserted.
- [x] 2.4 Recognize a minimal non-empty Listing response only to trigger one response-shape retry; do not apply local draft-validation gates after either usable response.

## 3. Package Dimension Normalization

- [x] 3.1 Normalize sourced one- and two-axis `packageDimensions` to length x width x height while preserving source axes and estimate status.
- [x] 3.2 Generate source-informed three-axis package estimates from product size, category, material, package contents, visible package-form signals, and reference comparison-size signals when package evidence is absent.
- [x] 3.3 Apply the same non-persistent package-axis completion when historical Listing drafts are read.
- [x] 3.4 Mark an unmarked complete upstream package tuple as an estimate when no traceable package evidence exists, without another request or Listing failure.
- [x] 3.5 Cover visible package-box evidence, V1/V2 direct response completion, historical readback, source-axis provenance, comparison-size-aware estimate variation, and no-retry behavior.

## 4. Verification

- [x] 4.1 Run focused Listing agent, V2, browser-shell, and creation end-to-end regressions. Listing Agent: 80/80; combined Listing draft/V2/acceptance/view/parity suites: 104/104; creation end-to-end: 7/7. Browser-shell: 16/17, with the unrelated `public/app.js` shell-budget check failing while the Listing controller acceptance test passes.
- [x] 4.2 Run `npm test`, `npm run sync:public-lib -- --check`, `npm run check:release`, OpenSpec strict validation, and `git diff --check`. `npm test`: 1536 passed, 1 skipped, 2 unrelated failures (`public/app.js` is 17419 lines against the 17400 shell budget; `public/lib/api-contract.mjs` is out of sync with the already-dirty `lib/api-contract.mjs`). Public-lib check reports the same pre-existing `api-contract` mismatch; release check, OpenSpec strict validation, and scoped diff check pass.
