## 1. Analysis contract and source selection

- [x] 1.1 Remove `appearance_locks` from the reference-analysis instructions and strict response schema; keep legacy input compatibility by ignoring the field.
- [x] 1.2 Stop appending analysis locks to normalized reference-role notes.
- [x] 1.3 Select primary-reference appearance facts using the explicit reference role index.
- [x] 1.4 Keep visually inferred product names as suggestions without automatically replacing the user field.

## 2. Prompt and UI paths

- [x] 2.1 Keep one primary-reference `PRODUCT FIDELITY` instruction in generated carousel and AI marketing prompts; remove analysis-derived lock prefixes and contracts.
- [x] 2.2 Remove SKU lock injection, `promptContext.subjectLock`, and lock injection from generation reference labels.
- [x] 2.3 Remove the separate subject-lock evidence-chain row while keeping the marketing evidence chain.

## 3. Regression and verification

- [x] 3.1 Add tests proving incorrect legacy analysis locks cannot enter new prompts, labels, or normalized plan state.
- [x] 3.2 Verify template, AI marketing, SKU, reference-label, saved-plan, and repair paths retain the primary-reference fidelity contract.
- [x] 3.3 Synchronize shared browser modules and run focused tests, full tests, required checks, and strict OpenSpec validation.
