# Creation Listing Agent Design

## Status

Draft for user review. OpenSpec source files live under `openspec/changes/add-creation-listing-agent/`.

## Scope

Add an optional Listing Agent to Creation Mode. The first version targets Amazon US English listing drafts only. It generates one parent listing package for the Creation set, uses SKU subjects as variants and quantity evidence, and also supports manual generation or rewrite from Creation records.

## Confirmed Requirements

- The recommended integration is approved: attach Listing Agent to Creation Mode generation and Creation record detail.
- The feature is optional and disabled unless the user enables it or manually runs it.
- Listing count follows SKU count from `skuSubjects`; if no SKU subjects exist, generate one main product listing.
- Each generated field and each generated bullet must be no longer than 500 characters.
- Titles must start with quantity, must not fall back to `1 Pack` when grouped SKU subject metadata indicates multiple complete sellable units, and must keep size, weight, hook size, model specs, and measurement values out of the title. Then add core search terms, long-tail terms, traffic terms, and descriptive terms.
- Selling points, pain points, and five bullets should use generated images when available.
- If image generation fails, automatically degrade to writing listings from typed product inputs, SKU metadata, dimensions, category path, reference-role notes, planned prompts, and saved copy metadata.
- Fallback listings must clearly mark that they are input-only and avoid visual claims that require generated image evidence.

## Design

The Listing Agent reads the Creation set manifest and builds one parent source package for the set. SKU subjects stay in that source as variant metadata and quantity evidence. A source package can be image-backed, mixed, or input-only. Image-backed packages include completed generated images for the SKU subjects or set. Mixed packages include some images plus missing or failed image warnings. Input-only packages are used when generated images failed or are unavailable.

The model returns strict JSON for each SKU. The app validates the JSON before display, retries once with validation feedback if needed, and saves successful drafts into the Creation set manifest as `listingDrafts`.

Each draft contains title, selling points, pain points, five bullets, description, backend search terms, keyword buckets, evidence, missing information, warnings, status, marketplace, language, SKU subject ID, and evidence mode.

## UI

Creation Mode gets a compact Listing Agent switch near generation options. Creation record detail gets a Listing section with generate, rewrite, copy, and export actions. Each listing card shows the listing fields plus evidence mode, warnings, and missing information so the user can judge whether the result is image-backed or input-only.

## Validation

Validation blocks or rewrites output when a field or bullet exceeds 500 characters, title order is wrong, keywords are duplicated, competitor brand terms appear, or unsupported claims are present. Claims about material, certification, warranty, compatibility, medical effect, safety rating, or performance must come from explicit user input or SKU metadata, not image inference alone.

## Out Of Scope

This first version does not publish to Amazon, does not generate A+ Content, does not support non-US marketplaces, and does not guarantee category-specific legal compliance. It produces structured drafts for human review.
