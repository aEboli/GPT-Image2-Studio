## 1. Specification And Regression

- [x] 1.1 Add analysis-contract tests requiring pure color names and forbidding component, material, finish, style, model, and product words.
- [x] 1.2 Add payload and planner regressions for single-unit, grouped, repeated, historical, and unavailable color labels.

## 2. Minimal Implementation

- [x] 2.1 Add one shared pure-color vocabulary and deterministic label normalizer.
- [x] 2.2 Apply normalization to prompt-agent responses, browser SKU payloads, and planner inputs without changing structured per-unit ordering.
- [x] 2.3 Update analysis and generation prompt instructions so visible labels contain colors only, then sync the browser module mirror.

## 3. Verification And Archive

- [x] 3.1 Run focused SKU, planner, and prompt-agent tests plus public-lib synchronization checks.
- [x] 3.2 Run the serial full test suite, build/check commands, strict OpenSpec validation, and inspect changed Chinese text and the final diff.
- [x] 3.3 Archive the completed OpenSpec change and confirm the delta is merged into the main `creation-mode` specification.
