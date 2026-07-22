## 1. Regression Coverage

- [x] 1.1 Add rendering assertions that English Listing values and Chinese references expose separate copy payloads.
- [x] 1.2 Update existing field-copy assertions to require English-only field-title and header copy while retaining bilingual full-copy coverage.

## 2. Listing View Implementation

- [x] 2.1 Render each visible English scalar/list value as an accessible copy target with an English-only payload.
- [x] 2.2 Render each visible Chinese reference as an accessible copy target with a Chinese-only payload.
- [x] 2.3 Preserve field-title copy, full Listing copy, export behavior, delegated event handling, and copied feedback states.
- [x] 2.4 Add focused styles for value targets, localized targets, hover/focus states, and copied states without changing field order or counts.

## 3. Verification and Handoff

- [x] 3.1 Synchronize `public/lib/creation-listing-view.mjs` from `lib/creation-listing-view.mjs` and verify no drift.
- [x] 3.2 Run focused Listing tests, the complete test suite, page build, and OpenSpec validation.
- [x] 3.3 Review the final diff for unrelated changes and archive this change with the updated main specification.
