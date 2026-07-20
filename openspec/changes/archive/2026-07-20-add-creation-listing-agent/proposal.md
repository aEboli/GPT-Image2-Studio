## Why

Creation Mode can already produce ecommerce image sets and SKU supplement images, but users still need to manually turn those visual outputs into Amazon listing copy. The workflow should optionally continue after image generation and create SKU-level listing drafts from the completed images, SKU metadata, product inputs, reference analysis, category path, and dimension fields.

Image generation can partially or fully fail. Listing generation must therefore degrade gracefully: when generated images are unavailable, the system should still produce a conservative listing draft from the user-provided product information and saved SKU metadata, while clearly marking that the result is input-only rather than image-backed.

## What Changes

- Add an optional Amazon US English Listing Agent to Creation Mode.
- Allow automatic listing generation after a Creation Mode set finishes, and manual generation or rewrite from the Creation record detail.
- Generate one parent listing package for the Creation set, using SKU subjects as variants and as quantity evidence; if no SKU subject exists, generate one main-product listing package.
- Use completed generated images when available; if images fail or are missing, fall back to product inputs, SKU subjects, dimensions, category path, reference-role notes, planned prompts, and saved copy metadata.
- Enforce a hard limit of 500 characters for every generated field and every bullet item.
- Require titles to begin with quantity, keep size/dimension/spec values out of the title, then use core search terms, long-tail terms, traffic terms, and descriptive terms without keyword stuffing.
- Persist generated listing drafts with the Creation set manifest and expose copy/export actions.
- Validate listing output before showing it, rewrite once on validation failure, and surface blocking warnings or missing information when safe output cannot be produced.

## Non-Goals

- Direct publishing to Amazon Seller Central.
- Amazon Ads, A+ Content, Brand Story, or storefront copy.
- Marketplace support beyond Amazon US in the first version.
- Non-English listing output in the first version.
- Claims verification against external databases.

## Impact

- Frontend: Creation Mode settings and Creation record detail need Listing Agent controls, status, listing output cards, copy actions, and export actions.
- Backend: local Creation set endpoints need a listing-generation route that can read saved manifests and generated images when available.
- Libraries: add isolated listing prompt, schema normalization, validation, rewrite feedback, keyword formatting, and manifest persistence helpers.
- Cloudflare Worker: keep request/response contracts aligned where possible; local-only image-file reading must degrade to explicit payload metadata when the Worker cannot access local output files.
- Storage: Creation set manifests will gain versioned listing draft metadata without changing generated image paths.
- Tests: add schema, validator, fallback, manifest persistence, API, and layout coverage.
