## 1. Specification

- [x] 1.1 Add the `add-image-decomposition-mode` OpenSpec change with scope, design decisions, and acceptance scenarios.

## 2. Prompt Helper

- [x] 2.1 Add failing tests for mode constants, language normalization, custom language fallback, visible-only/no-fabrication prompt constraints, no rendered meta/source disclaimer wording, optional side feature card guidance, and plain descriptor punctuation guidance.
- [x] 2.2 Implement `lib/image-decomposition-prompt.mjs`.
- [x] 2.3 Strengthen the decomposition prompt so normal output uses detailed callout boxes and enabled side feature cards are required left/right elements.

## 3. Local API

- [x] 3.1 Add failing local `/api/generate` tests for `mode=image-decomposition` metadata and single-image validation.
- [x] 3.2 Implement local server support using the shared prompt helper and gallery metadata.

## 4. Cloudflare Worker

- [x] 4.1 Add failing Worker tests for single-reference image generation, target-language prompt injection, reference labels, saved metadata, and API-key safety.
- [x] 4.2 Implement Worker parity with the local server.

## 5. Frontend

- [x] 5.1 Add failing static UI/layout tests for `#image-decomposition`, independent state, upload controls, language controls, ratio/size controls, generation preview, and responsive constraints.
- [x] 5.2 Implement the Create menu entry, isolated view state, upload/preview handling, generation submit flow, SSE result handling, deletion/clear-history preservation, and scoped CSS.

## 6. Verification

- [x] 6.1 Run syntax checks, test suite, Pages build, UTF-8/mojibake checks, and browser layout verification.
