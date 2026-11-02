## 1. Filtering behavior

- [x] 1.1 Add a pure severe-failure filter using the agreed terminal-state and 10-success threshold rules.
- [x] 1.2 Add a quick filter control and include its state in combined filtering, active-filter detection, filter labels, list signatures, and Clear filters.
- [x] 1.3 Keep counts, list/detail selection, checked selection, and Delete filtered targets aligned with the complete combined result set.
- [x] 1.4 Keep existing confirmation and per-set deletion semantics; confirm images, JSON metadata, and the manifest are removed only for matched sets.

## 2. Verification

- [x] 2.1 Add tests for successful-count boundaries, in-progress exclusion, failed-item presence, and minimum planned count.
- [x] 2.2 Add or update tests for keyword/time composition, clear filters, and filtered deletion targets and confirmation count.
- [x] 2.3 Run the focused Creation record filter, delete, and view tests; run `npm run sync:public-lib -- --check` if a shared module changes.
- [x] 2.4 Run `npx --no-install openspec validate filter-severely-failed-creation-sets --strict`, `git diff --check`, and inspect added Chinese text for encoding issues.
