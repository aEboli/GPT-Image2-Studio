## RENAMED Requirements

- FROM: `### Requirement: Creation Mode supports optional Amazon listing generation`
- TO: `### Requirement: Creation Mode supports direct Listing generation for every platform`
- FROM: `### Requirement: Listing drafts follow Amazon US title and keyword guardrails`
- TO: `### Requirement: Platform policies produce different content without changing fields`

## MODIFIED Requirements

### Requirement: Creation Mode supports direct Listing generation for every platform
The system SHALL allow Listing generation for all 19 canonical platforms and legacy manifests. Each request SHALL resolve the saved platform and locale, use that platform's Listing policy, and return one directly usable draft without publishing to any marketplace or changing the Creation image result.

#### Scenario: User enables Listing Agent before generation
- **WHEN** the user enables the Listing Agent switch before generating a Creation Mode set
- **THEN** the system attempts to generate a Listing draft after the Creation set finishes
- **AND** Listing generation does not block or fail the image-generation workflow

#### Scenario: User runs Listing Agent from a saved record
- **WHEN** the user opens a saved Creation set record and starts Listing generation
- **THEN** the system generates or rewrites a Listing draft for that selected set
- **AND** the generated draft is saved with the Creation set manifest

#### Scenario: User generates Listing for a supported platform
- **WHEN** the user enables Listing generation or starts it from a saved Creation record
- **THEN** the system uses that record's resolved platform, locale and current Listing policy
- **AND** platform-specific guidance changes the generated content rather than the outward field structure
- **AND** Listing failure does not turn a usable image set into a failed set

#### Scenario: User generates Listing for a legacy or unknown platform record
- **WHEN** platform metadata is missing or cannot be resolved
- **THEN** the system uses the conservative universal content policy
- **AND** it still returns the same old-style Listing field contract

### Requirement: Platform policies produce different content without changing fields
The system SHALL keep one versioned Listing policy for each canonical platform and SHALL use platform-specific title emphasis, conversion order, search intent, locale guidance and field content. Platform rules SHALL NOT rename, remove, add or reorder the old-style outward fields.

#### Scenario: Title includes quantity but excludes dimensions
- **WHEN** an Amazon US Listing draft is generated from product input with a known quantity and dimension
- **THEN** the title begins with the quantity
- **AND** the title does not include size, dimensions, weight, hook size, model specs, or measurement values
- **AND** remaining title terms prioritize core search terms, long-tail terms, traffic terms, and descriptive terms

#### Scenario: Keyword output is generated
- **WHEN** backend search terms and keyword buckets are generated
- **THEN** backend search terms are non-empty and include relevant core, long-tail, traffic, and descriptive terms
- **AND** keyword buckets include exact, long-tail, traffic, and descriptive groups
- **AND** keywords are deduplicated case-insensitively
- **AND** competitor brand terms and unsupported claims are removed

#### Scenario: Two platforms receive the same product facts
- **WHEN** the same normalized product source is generated for two different canonical platforms
- **THEN** their prompts include different platform policy instructions
- **AND** their resulting field content may differ according to those policies
- **AND** both results expose the identical old-style field names and bilingual structure

#### Scenario: Low-evidence platform policy is used
- **WHEN** a platform lacks reliable public evidence for an exact rule
- **THEN** the policy uses conservative writing guidance
- **AND** no validation or review state blocks the generated draft

## ADDED Requirements

### Requirement: New Listing drafts use the old-style bilingual field contract
Every new or explicitly rewritten Listing SHALL contain `title`, `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, and a structurally corresponding Simplified Chinese `zhDisplay`. `keywordBuckets` SHALL contain `exact`, `longTail`, `traffic`, and `descriptive` arrays in both languages.

#### Scenario: A new Listing is generated
- **WHEN** Listing generation completes from model, mock or deterministic fallback
- **THEN** English content is stored in the top-level old-style fields
- **AND** Simplified Chinese content is stored in matching `zhDisplay` fields with the same value types and item order
- **AND** the status is `completed`

#### Scenario: A historical V2 draft is opened
- **WHEN** a stored draft uses `buyerObjections`, `highlights` or `searchTerms`
- **THEN** the reader maps those values to `painPoints`, `fiveBullets` and `backendSearchTerms` for display, copy and export
- **AND** the historical stored draft is not rewritten automatically

### Requirement: Listing generation completes without validation or review gates
The system SHALL make one upstream model request. It SHALL NOT perform validator-driven retries, manual review, `needs-review`, failed rewrite gates, or status-based copy/export blocking. If the model request or response parsing fails, the system SHALL directly return a deterministic old-style fallback with status `completed`. Missing required API configuration MAY remain an explicit configuration error.

#### Scenario: Model returns usable old-style JSON
- **WHEN** the single model response can be normalized
- **THEN** the system returns the normalized draft as `completed`
- **AND** no second model request or validator review occurs

#### Scenario: Model request or parsing fails
- **WHEN** the upstream returns a rate limit, server error, unusable JSON or incompatible shape
- **THEN** the system immediately builds a deterministic old-style bilingual fallback
- **AND** returns it as `completed` without `needs-review` or a rewrite requirement

#### Scenario: User copies or exports a completed draft
- **WHEN** any old-style draft is visible
- **THEN** single-field copy, full copy and structured export are available directly
- **AND** those actions do not inspect validation, review or access-gate state

### Requirement: All newly generated Listing content is brand-free
The system SHALL remove brand names, trademarks, store names, seller names and platform names from every English and Chinese content field. This requirement SHALL apply to model, mock and deterministic fallback outputs as a product output transformation, not as a platform claim or review workflow.

#### Scenario: Source data contains prohibited identity terms
- **WHEN** product input, SKU data, reference notes or manifest text contains a prohibited identity term
- **THEN** source processing excludes the term from model-ready product facts
- **AND** the prompt instructs the model not to output it

#### Scenario: Generated output contains a prohibited identity term
- **WHEN** model, mock or deterministic fallback content contains a prohibited identity term
- **THEN** the shared sanitizer removes or neutrally rewrites it before the draft is returned
- **AND** the final English and Chinese content fields do not contain the term
- **AND** the draft remains a direct `completed` result rather than entering review

#### Scenario: Platform metadata is retained
- **WHEN** a draft is saved for a named platform
- **THEN** canonical platform ID and policy version may remain in non-content metadata
- **AND** the platform name does not appear in any Listing content field or Chinese counterpart

### Requirement: Local service and Cloudflare Worker share Listing semantics
The local service and Cloudflare Worker SHALL use the same policy resolver, source builder, old-style schema, prompt builder, normalizer, sanitizer and deterministic fallback.

#### Scenario: Equivalent normalized inputs use different runtimes
- **WHEN** local and Worker paths receive equivalent normalized Creation sets and configuration
- **THEN** they resolve the same platform policy and old-style field contract
- **AND** they use the same one-request and direct-fallback behavior
- **AND** neither runtime fetches platform rule URLs during generation
