## 1. Ratio Definition and UI

- [x] 1.1 Remove descriptive labels from shared ratio option objects and keep browser ratio summaries and selector options numeric.
- [x] 1.2 Update focused UI assertions for the selected ratio summary and Creation/Portrait selectors.

## 2. Generation and Records

- [x] 2.1 Build at most one concise ratio prompt hint from the selected ratio value.
- [x] 2.2 Store numeric `ratioLabel` values in generation jobs, tasks, sidecars, and gallery records.
- [x] 2.3 Normalize legacy task, cache, gallery, and Creation record presentation to prefer the numeric ratio.
- [x] 2.4 Add focused assertions that descriptive labels do not enter generated prompts or displayed record parameters.

## 3. Verification

- [x] 3.1 Run focused aspect-ratio, generation-task, metadata, formatter, studio-layout, and generation workflow tests.
- [x] 3.2 Run `node scripts/sync-public-lib.mjs --check`, `git diff --check`, and strict OpenSpec validation.

Verification: 78 focused ratio, metadata, formatter, task, and Creation-store tests passed; the ratio-focused studio UI tests passed; 5 image-edit and lazy-loader tests passed; and 191 Creation, article illustration, portrait, and preview-save workflow tests passed. `studio-preview-layout.test.mjs` also has an unrelated existing static CSS cache-version assertion: it expects `20260926-route-tool-model-toggle-1`, while the working tree's `public/index.html` already uses `20260928-nav-version-flyout-sizing-1`.
