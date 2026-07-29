## 1. Specification And Regression

- [x] 1.1 Add planner regression coverage for a foreign-language package subject with a different selected output language.
- [x] 1.2 Add runtime regression coverage for current and historical ordinary prompts while preserving the `infographic-rebuild` translation branch.

## 2. Minimal Implementation

- [x] 2.1 Add one shared subject-content protection instruction covering graphics, marks, exact text, writing system, original language, placement, and colors.
- [x] 2.2 Scope target-language guidance to newly added text outside the physical subject in carousel and SKU planning prompts.
- [x] 2.3 Apply the same protection in ordinary Local, Worker, and repair runtime prompts without duplicating it in current plans or appending it to `infographic-rebuild`.

## 3. Verification And Archive

- [x] 3.1 Run focused planner and generation tests, public-lib synchronization, and the Pages build.
- [x] 3.2 Run the serial full test suite and strict OpenSpec validation, and inspect changed Chinese text and the final diff.
- [x] 3.3 Archive the completed OpenSpec change and confirm the delta is merged into the main `creation-mode` specification.
