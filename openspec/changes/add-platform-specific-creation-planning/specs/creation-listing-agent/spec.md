## MODIFIED Requirements

### Requirement: Creation Mode supports optional Listing generation for every platform
The system SHALL allow users to run the Listing Agent for Creation Mode sets from all 19 canonical platforms and from legacy manifests without platform metadata. Listing generation SHALL remain best-effort and SHALL NOT publish directly to any marketplace, fail an otherwise usable image-generation set, disable actions solely because of platform, or delete previously saved drafts.

#### Scenario: User enables Listing Agent before generation on any platform
- **WHEN** the user selects any supported platform and enables the Listing Agent switch before generating a Creation Mode set
- **THEN** the system attempts to generate a platform-specific Listing draft after the Creation set finishes
- **AND** Listing failure does not change a completed or partially usable image-generation result into a failed set

#### Scenario: User runs Listing Agent from any saved record
- **WHEN** the user opens a saved Creation set record from any supported platform and starts Listing generation
- **THEN** the system generates or rewrites a draft using that set's resolved platform, locale and current Listing policy
- **AND** the generated draft is saved with the Creation set manifest

#### Scenario: User opens a legacy record without platform metadata
- **WHEN** a saved Creation set predates platform metadata
- **THEN** the user can generate, rewrite, review, copy, and export its Listing drafts
- **AND** the resolver uses a visible conservative fallback without treating normalized `platform=universal` as proof of an earlier explicit selection

### Requirement: Listing fields obey platform policy limits
The system SHALL apply the resolved Listing policy's character, UTF-8 byte, item-count, language and field-purpose rules while preserving a bounded universal safety ceiling for every generated field.

#### Scenario: Platform publishes an official exact field limit
- **WHEN** the selected platform policy cites a current official source for a title, highlight or search-term limit
- **THEN** the validator enforces that limit as a blocking rule
- **AND** the saved draft records the policy version used for validation

#### Scenario: Platform has no verified exact limit
- **WHEN** no current official source establishes an exact limit for a field
- **THEN** the policy uses a configurable conservative recommendation
- **AND** violating that recommendation does not get presented as violating an official platform hard rule

#### Scenario: Official field limit has a future effective date
- **WHEN** an official source announces an exact field limit with a future `effectiveFrom` date
- **THEN** validation before that date reports the limit as a recommendation warning rather than a blocking error
- **AND** validation on or after that date enforces the limit as a blocking rule
- **AND** an invalid explicit validation date is handled deterministically using the conservative blocking interpretation

### Requirement: Listing drafts follow platform and locale guardrails
The system SHALL resolve one versioned Listing policy for each draft and SHALL apply that policy to title structure, highlights, description, search surface, variant treatment, locale and publishable fields instead of applying Amazon US rules globally.

#### Scenario: Amazon draft is generated
- **WHEN** the frozen set resolves to Amazon
- **THEN** the draft uses the current sourced Amazon title and highlight rules
- **AND** Amazon-specific quantity, Rufus, highlight and backend-search guidance is not applied to other platforms unless their own policy explicitly declares equivalent behavior

#### Scenario: Platform uses a different search surface
- **WHEN** Etsy uses tags or another platform uses visible search phrases instead of Amazon backend terms
- **THEN** the V2 draft stores the terms in the shared `searchTerms` field
- **AND** the UI labels their platform-specific purpose rather than calling every search surface "backend search terms"

#### Scenario: Frozen target language differs from platform default
- **WHEN** the saved effective plan contains an explicit target language supported by the Listing pipeline
- **THEN** that frozen locale takes precedence over the platform default
- **AND** title, highlights, description, search terms and validation use the same resolved locale

### Requirement: Listing drafts use a versioned V2 superset with V1 compatibility
The system SHALL save new drafts with `schemaVersion`, canonical platform metadata, Listing policy version, language, title, selling points, buyer objections, highlights, description, search terms, keyword buckets, evidence, missing information, warnings, status and timestamps. The reader SHALL continue to accept V1 field aliases without rewriting historical content.

#### Scenario: New platform draft is saved
- **WHEN** Listing generation succeeds or returns a reviewable fallback under the V2 contract
- **THEN** the manifest freezes `platformId`, `marketplace`, `listingPolicyVersion` and `language` with the generated content
- **AND** future policy changes do not mutate that saved draft on read

#### Scenario: Old Amazon draft is opened
- **WHEN** a saved draft contains `marketplace=amazon-us`, `fiveBullets`, `backendSearchTerms`, `painPoints` or `zhDisplay` but no V2 version
- **THEN** the reader maps those values through compatibility aliases for display, copy and export
- **AND** it preserves the original fields and content until the user explicitly rewrites or regenerates the draft

### Requirement: Listing generation uses shared cross-category playbooks and fact gating
The system SHALL use platform-independent playbooks for product identity, factual benefits, real usage, purchase-objection handling, size or fit, variants, package clarity and missing-evidence disclosure. Every public claim SHALL be grounded in allowed Creation inputs or removed, warned or blocked.

#### Scenario: Source supports an ordinary product benefit
- **WHEN** a benefit is supported by user product data, SKU metadata, reference-role notes or traceable manifest facts
- **THEN** the platform playbook may express that benefit in the resolved locale and platform structure
- **AND** it does not require a platform-by-category static template

#### Scenario: Generated image appears to imply a high-risk claim
- **WHEN** an image appears to imply material, certification, medical or health effect, safety, compatibility, durability, performance, sales, ranking, review, price, discount, warranty or refund information that is not supported by allowed source facts
- **THEN** the system does not publish that claim as fact
- **AND** it removes the claim or records it in warnings or missing information

#### Scenario: Model remains invalid after retry
- **WHEN** the model output still fails the resolved policy and fact validator after the permitted retry
- **THEN** the system returns only a `needs-review` or `failed` input-only placeholder
- **AND** it does not label mock or generic fallback text as ready to publish

### Requirement: Listing drafts are reviewable, exportable and parity-safe
The system SHALL display platform-aware Listing fields in Creation record details, copy only policy-declared publishable fields by default, export structured metadata without secrets, and use the same source, policy, schema, prompt, normalization, validation and fallback logic in local and Cloudflare environments.

#### Scenario: User reviews and copies a V2 draft
- **WHEN** a V2 Listing draft exists for a Creation set
- **THEN** the record detail shows platform, locale, policy version, publishable fields, internal strategy fields, evidence mode, warnings and missing information with platform-correct labels
- **AND** the default full-copy action excludes internal buyer-objection and keyword-planning fields unless the policy marks them publishable

#### Scenario: Local and Worker receive the same normalized set
- **WHEN** the local endpoint and Cloudflare Worker process the same normalized set and Listing configuration
- **THEN** they produce equivalent upstream request bodies, resolved policy metadata, validation results and fallback status
- **AND** neither endpoint fetches marketplace rule URLs at runtime

#### Scenario: User evaluates compliance or conversion
- **WHEN** a draft passes current machine validation
- **THEN** the UI presents it as a reviewable draft rather than proof of platform approval, legal compliance, ranking or conversion performance
