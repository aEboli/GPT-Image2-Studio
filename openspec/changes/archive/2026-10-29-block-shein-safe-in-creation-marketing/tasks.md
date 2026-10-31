- [x] 1.1 Add failing regression tests for global matching, field diagnostics, legacy metadata independence, and one-call behavior.
- [x] 1.2 Add a confirmed restricted-term context and standalone-word detector.
- [x] 1.3 Enforce restricted terms on final marketing item fields after subject-lock assembly, preserving existing locked/required item boundaries.
- [x] 1.4 Run focused marketing tests, strict OpenSpec validation, and diff/encoding checks; record results.
- [x] 1.5 Archive the completed OpenSpec change and sync the current creation-mode specification.

## Verification

- `node --test test/creation-marketing-plan.test.mjs test/creation-marketing-partial.test.mjs test/creation-marketing-missing-card.test.mjs`: 60/60 passed.
- `npx --no-install openspec validate block-shein-safe-in-creation-marketing --strict --no-interactive`: passed.
- `node --check lib/creation-marketing-plan.mjs` and `git diff --check`: passed.
- `node --test test/creation-marketing-e2e.test.mjs`: 1/1 passed after the mock upstream gained an explicit 404 response for its `GET /` probe.
