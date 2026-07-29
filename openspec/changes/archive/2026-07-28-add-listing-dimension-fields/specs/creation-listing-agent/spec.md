## MODIFIED Requirements

### Requirement: Listing drafts are reviewable and exportable
The system SHALL display listing drafts in Creation record details and SHALL provide copy and export actions without exposing local absolute paths or secrets.

#### Scenario: User reviews generated listings
- **WHEN** listing drafts exist for a Creation set
- **THEN** the Creation record detail shows each listing draft with title, selling points, pain points, five bullets, description, backend search terms, keyword buckets, package dimensions, product dimensions, evidence mode, warnings, and missing information
- **AND** package dimensions and product dimensions appear after keyword buckets at the bottom of the Listing

#### Scenario: User exports listing drafts
- **WHEN** the user exports listing drafts
- **THEN** the app downloads a structured JSON file for the selected Creation set
- **AND** each newly generated exported draft retains `packageDimensions`, `productDimensions`, and their Simplified Chinese counterparts
- **AND** the export excludes API keys and local absolute paths

### Requirement: Platform policies produce different content without changing fields
The system SHALL keep one versioned Listing policy for each canonical platform and SHALL use platform-specific title emphasis, conversion order, search intent, locale guidance and field content. Platform rules SHALL NOT rename, remove or reorder the shared outward fields. The existing title-through-keyword field order SHALL remain stable, followed by `packageDimensions` and `productDimensions` in that order.

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
- **AND** both results expose identical shared field names and bilingual structure, including the two appended dimension fields

#### Scenario: Low-evidence platform policy is used
- **WHEN** a platform lacks reliable public evidence for an exact rule
- **THEN** the policy uses conservative writing guidance
- **AND** no validation or review state blocks the generated draft

### Requirement: New Listing drafts use the old-style bilingual field contract
Every successfully generated or explicitly test-mocked Listing SHALL contain `title`, `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, `packageDimensions`, `productDimensions`, and a Simplified Chinese `zhDisplay` with the same field value types. `keywordBuckets` SHALL contain `exact`, `longTail`, `traffic`, and `descriptive` arrays in both languages. The two dimension fields SHALL be non-empty strings containing numeric physical dimensions. The system SHALL allow keyword strings or buckets to become empty and bilingual list counts to differ when normalization, low-risk evidence cleanup, or blocking-claim cleanup deletes unusable content. A failed real generation SHALL NOT create a Listing draft.

#### Scenario: A new Listing is generated
- **WHEN** the model returns a Listing that passes parsing, normalization, minimum bilingual structure, dimension provenance checks, evidence-term sanitization, and blocking-claim sanitization
- **THEN** English content is stored in the top-level old-style fields
- **AND** Simplified Chinese content is stored in matching `zhDisplay` field types
- **AND** package dimensions precede product dimensions in display, full copy, and export
- **AND** the status is `completed`

#### Scenario: Low-risk terms are removed from generated content
- **WHEN** normalization finds an unsupported low-risk concrete attribute, material, color, shape, construction, mode, or use-context term
- **THEN** the system removes that term from public Listing fields before returning the draft
- **AND** empty search terms or keyword entries do not make the generation fail

#### Scenario: Blocking claim terms are removed from generated content
- **WHEN** a normalized Platform V1 response contains an unsupported compatibility, certification, ranking, social-proof, medical, safety, warranty, material, performance, price, discount, refund, or competitor-comparison match
- **THEN** the system removes the matched content from public Listing fields before returning the draft
- **AND** it preserves a match whose rule permits exact evidence and whose exact evidence exists in the source
- **AND** the matched keyword or claim does not cause Listing generation to fail

#### Scenario: Explicit test mock mode is used
- **WHEN** a test directly enables the explicit mock mode
- **THEN** the mock uses the old-style bilingual field contract including package and product dimensions
- **AND** a real request failure never enables that mode implicitly

#### Scenario: A historical V2 draft is opened
- **WHEN** a stored draft uses `buyerObjections`, `highlights` or `searchTerms`, or predates the two dimension fields
- **THEN** the reader maps historical values for display, copy and export without rejecting the draft
- **AND** the historical stored draft is not rewritten automatically

## ADDED Requirements

### Requirement: Listing dimensions distinguish sourced facts from estimates
Every newly generated Listing SHALL provide package and product physical dimensions. The system SHALL reproduce corresponding explicit source dimensions without changing their factual meaning. When corresponding evidence is absent, it SHALL provide a conservative numeric estimate and SHALL mark the English value with `Estimated:` and the Simplified Chinese value with `预估：`. Product dimensions MUST NOT be presented as sourced package dimensions. Image pixel resolution MUST NOT be treated as a physical product or package dimension.

#### Scenario: Product dimensions are supplied but package dimensions are absent
- **WHEN** source product facts contain a physical product length, width, height, depth or diameter but no explicit packaging, packed, carton, color-box or outer-box dimensions
- **THEN** `productDimensions` reproduces the supplied physical dimension facts without an estimate marker
- **AND** `packageDimensions` contains a numeric conservative estimate marked `Estimated:`
- **AND** `zhDisplay.packageDimensions` contains the same estimate marked `预估：`

#### Scenario: Both dimension types are supplied
- **WHEN** source facts explicitly identify both product dimensions and package dimensions
- **THEN** both output fields reproduce the corresponding sourced values
- **AND** neither field relabels the other dimension type

#### Scenario: Neither dimension type is supplied
- **WHEN** source facts provide no physical product or package dimensions
- **THEN** both fields contain conservative numeric estimates
- **AND** both English values use `Estimated:` and both Simplified Chinese values use `预估：`

#### Scenario: Unit mode is selected
- **WHEN** Listing generation receives metric, imperial or both as the dimension unit mode
- **THEN** sourced and estimated dimension fields follow that selected mode
- **AND** the dimensions remain within the shared 500-character field ceiling
