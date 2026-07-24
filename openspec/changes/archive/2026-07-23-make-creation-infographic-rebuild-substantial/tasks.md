## 1. Prompt Contract Tests

- [x] 1.1 Add focused assertions that the canonical prompt requires a new layout and information architecture plus material changes across at least three additional visual dimensions.
- [x] 1.2 Add assertions that near-copy cleanup, sharpening, minor spacing, minor color changes, and unchanged-grid restyling are explicitly rejected while source facts remain locked.
- [x] 1.3 Keep Local generation, Worker generation, and Local repair tests proving the new canonical prompt is used with exactly one matching original source image.

## 2. Canonical Reconstruction Prompt

- [x] 2.1 Replace the faithful-copy prompt with labeled source-fact, redesign, preservation, failure-condition, and canvas instructions.
- [x] 2.2 Verify planner, submitted-plan, runtime, queue, and repair paths continue resolving to the same canonical prompt without suite-context decoration.

## 3. Verification And Deployment

- [x] 3.1 Run focused infographic rebuild tests and inspect the resolved prompt text.
- [x] 3.2 Run the serialized full test suite, public library sync check, Pages build, encoding scan, `git diff --check`, and strict OpenSpec validation.
- [x] 3.3 Restart the current workspace service on port `3600` and verify the live planning endpoint returns the new canonical redesign prompt.
- [x] 3.4 Run one real rebuild from `7.jpg`, verify the request uses only that source image and the new canonical prompt, and inspect that the result is visibly redesigned while source facts remain intact.
