## 1. Repair stable source binding

- [x] 1.1 Freeze the primary reference before model analysis and retain it through normalization and preview reuse.
- [x] 1.2 Restore only validated primary and fact-source references omitted by the model; preserve order labels and reference budgets.
- [x] 1.3 Avoid adding a second copy of the generated subject lock when assembling the prompt.

## 2. Reject incomplete batch responses

- [x] 2.1 Require a complete top-level marketing item set; do not accept a nested child object from a truncated response.
- [x] 2.2 Retry an incomplete whole-set response once with the complete requested schema and exact item count.
- [x] 2.3 Keep the final empty/incomplete response visible as an actionable error.

## 3. Verification

- [x] 3.1 Add reference-binding, primary-identity, budget, truncation, retry, and frozen-prompt regression tests.
- [x] 3.2 Validate the nine-reference/20-item flow against a local mock upstream and run targeted regressions.
- [x] 3.3 Validate and archive this OpenSpec change; validate the canonical creation-mode specification.

## Verification record (2026-10-27)

- `test/creation-marketing-plan.mjs`, `test/creation-marketing-e2e.test.mjs`, `test/prompt-agent.test.mjs`, and the targeted integration group passed: 450/450. Marketing and parser-specific suite: 83/83.
- E2E sends 9 references and requests 20 prompts; the fixture omits the primary and fact-source indexes, returns analysis without `items` on the first response, and succeeds after one complete-plan retry. Frozen generation reuses the preview and each image request carries references 9, 2, and 3 with original numbering.
- `git diff --check`, JavaScript syntax checks, public-module sync (127 modules), and the canonical `creation-mode` strict validation passed.
- No real external model or paid image generation was used.
