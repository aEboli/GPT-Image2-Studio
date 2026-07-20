## 1. Specification And Planning

- [x] 1.1 Validate this OpenSpec change against the current Creation Mode data model and API routes.
- [x] 1.2 Create the implementation plan after the user reviews and approves this spec.

## 2. Listing Schema And Validation

- [x] 2.1 Add tests for the Listing Agent output schema, SKU grouping, evidence modes, and 500-character field and bullet limits.
- [x] 2.2 Implement listing draft normalization and validation helpers.
- [x] 2.3 Add tests for title rules: quantity first, no title size/spec values, grouped SKU subject counts do not fall back to `1 Pack`, then search and descriptive terms.
- [x] 2.4 Implement keyword de-duplication, warning generation, and one-retry rewrite feedback.

## 3. Source Assembly And Fallback

- [x] 3.1 Add tests for image-backed, mixed, and input-only source packages.
- [x] 3.2 Build source assembly from Creation set manifests, SKU subjects, generated image items, reference-role notes, category path, dimensions, prompts, and saved copy.
- [x] 3.3 Ensure failed or missing generated images degrade to input-only listing generation rather than blocking the listing workflow.

## 4. Local API And Persistence

- [x] 4.1 Add tests for a local listing-generation endpoint that resolves Creation sets by manifest ID.
- [x] 4.2 Implement the local endpoint, model request, validator, retry-once path, and manifest persistence.
- [x] 4.3 Keep listing failures isolated from Creation image-generation status.

## 5. Frontend

- [x] 5.1 Add layout tests for the optional Listing Agent switch and Creation record Listing section.
- [x] 5.2 Implement automatic post-generation trigger when enabled.
- [x] 5.3 Implement manual generate, rewrite, copy, and export actions from Creation records.
- [x] 5.4 Render evidence mode, warnings, missing information, and failed fallback states.

## 6. Worker, Docs, And Verification

- [x] 6.1 Align Cloudflare Worker contracts where possible, with explicit input-only fallback when local images are inaccessible.
- [x] 6.2 Update README and relevant Creation Mode docs.
- [x] 6.3 Run targeted tests, full tests, Pages build, and Chinese text encoding checks.
