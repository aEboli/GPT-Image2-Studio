## 1. Regression Coverage

- [x] 1.1 Update Listing render tests to require all seven fields on one page in fixed order, no content/language view controls, and English-then-Chinese DOM order.
- [x] 1.2 Add coverage for missing localized values while retaining language-specific item and field copy payloads.
- [x] 1.3 Update layout/source assertions to require a single-column bilingual pair at every viewport and reject removed view state, controls, hidden-section selectors, and side-by-side grids.

## 2. Listing View Implementation

- [x] 2.1 Remove Listing language/content mode state, segmented controls, and delegated view-control handling.
- [x] 2.2 Render all seven fields as continuous children of one content frame while preserving their fixed order and independent bilingual copy targets.
- [x] 2.3 Replace responsive side-by-side comparison styles with one fixed English-above-Chinese layout and remove obsolete control/section styles.
- [x] 2.4 Synchronize `public/lib/creation-listing-view.mjs` from the shared source and verify no public-module drift.

## 3. Verification

- [x] 3.1 Run focused Listing view and layout tests.
- [x] 3.2 Run the full test suite, Pages build, strict OpenSpec validation, encoding checks, and `git diff --check`.
- [x] 3.3 Start the local app and inspect a real Listing record at desktop and narrow viewport widths.

## 4. Archive

- [x] 4.1 Merge the updated Creation Listing behavior into the main specification, archive this change, and rerun strict OpenSpec validation.
