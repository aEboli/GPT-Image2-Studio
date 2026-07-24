## 1. Regression Coverage

- [x] 1.1 Add Platform V1 tests proving upstream, parse, and content-validation failures reject instead of returning completed mock drafts.
- [x] 1.2 Add non-V1 and application-level coverage proving exhausted failures propagate without deterministic output.
- [x] 1.3 Confirm failed regeneration does not enter the successful persistence response path.

## 2. Fail-Closed Generation

- [x] 2.1 Replace Platform V1 HTTP, parse, structure, evidence, and safety fallback branches with readable errors.
- [x] 2.2 Replace non-V1 transient and exhausted-validation fallback branches with readable errors.
- [x] 2.3 Keep explicit test mock mode separate from all real-request failure handling.

## 3. Verification

- [x] 3.1 Run focused Listing tests, shared-library sync checks, serial full tests, Pages build, strict OpenSpec validation, encoding checks, and `git diff --check`.
- [x] 3.2 Start the local service and verify through the Listing UI that a forced real-generation failure is reported and no mock draft is saved.

## 4. Archive

- [x] 4.1 Merge the fail-closed requirements into the current Listing specification and archive the completed change.
