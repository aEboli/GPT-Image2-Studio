## 1. Regression Coverage

- [x] 1.1 Add Listing render assertions for default English/product-copy views, the two content groups, and removal of the duplicate title.
- [x] 1.2 Add interaction assertions for language/content view state, language-specific field and item copy payloads, and the secondary generation control.
- [x] 1.3 Update layout assertions for the sticky toolbar, unframed field sections, secondary character counts, and responsive compare layout.

## 2. Listing Workspace Implementation

- [x] 2.1 Restructure the record Listing header into a sticky workspace toolbar with regenerate, full-copy, and JSON-export actions.
- [x] 2.2 Render language and content segmented controls from session state and preserve the seven-field Listing contract.
- [x] 2.3 Render single-language and responsive comparison values while keeping English and Chinese field/item copy targets independent.
- [x] 2.4 Remove the duplicated title and nested field-card treatment, and reduce character-count emphasis without changing Listing content.
- [x] 2.5 Reuse the existing generation controller and concurrent-generation guard for both record generation entry points.
- [x] 2.6 Keep the mobile Creation record header in normal flow so its filter area cannot cover Listing view controls.

## 3. Verification

- [x] 3.1 Synchronize `public/lib/creation-listing-view.mjs` and verify the public-module registry has no drift.
- [x] 3.2 Run focused Listing/layout tests, the full serial suite, Pages build, strict OpenSpec validation, encoding checks, and `git diff --check`.
- [x] 3.3 Restart port `3600` and verify desktop and mobile language/content switching, copying, sticky actions, and non-overlapping layout against the saved baseline screenshot.

## 4. Archive

- [x] 4.1 Merge the delta requirement into the main `creation-mode` specification and archive the completed change after all tasks pass.
