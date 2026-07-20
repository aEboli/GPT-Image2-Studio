## ADDED Requirements

### Requirement: Creation Mode supports optional Amazon listing generation
The system SHALL allow users to optionally run a Listing Agent for Creation Mode sets. The first version SHALL target Amazon US English listing drafts and SHALL NOT publish directly to Amazon.

#### Scenario: User enables Listing Agent before generation
- **WHEN** the user enables the Listing Agent switch before generating a Creation Mode set
- **THEN** the system attempts to generate listing drafts after the Creation set finishes
- **AND** listing generation does not block or fail the image-generation workflow

#### Scenario: User runs Listing Agent from a saved record
- **WHEN** the user opens a saved Creation set record and starts listing generation
- **THEN** the system generates or rewrites listing drafts for that selected set
- **AND** the generated drafts are saved with the Creation set manifest

### Requirement: Listing output uses SKU subjects for variants and quantity
The system SHALL generate one parent listing draft for the Creation set, using distinct sellable SKU subjects as variant metadata and quantity evidence. If no SKU subjects exist, the system SHALL generate one main-product listing draft.

#### Scenario: Creation set has SKU subjects
- **WHEN** a Creation set manifest contains three `skuSubjects`
- **THEN** the Listing Agent generates one parent listing draft
- **AND** the draft preserves the three SKU subjects as variant metadata
- **AND** the draft title does not fall back to `1 Pack` when the subjects indicate three complete sellable units

#### Scenario: Creation set has no SKU subjects
- **WHEN** a Creation set manifest has no distinct SKU subjects
- **THEN** the Listing Agent generates one main-product listing draft

### Requirement: Listing generation degrades when generated images fail
The system SHALL use completed generated images when available and SHALL fall back to product inputs and manifest metadata when images are missing or failed.

#### Scenario: Relevant generated images are available
- **WHEN** the Creation set has completed generated images relevant to a SKU
- **THEN** the Listing Agent uses those images as visual evidence
- **AND** the saved draft marks `evidenceMode` as `image-backed` or `mixed`

#### Scenario: Generated images fail
- **WHEN** all generated images for a Creation set fail or are missing
- **THEN** the Listing Agent still generates conservative listing drafts from product name, description, selling points, dimensions, category path, SKU subjects, reference-role notes, planned prompts, and saved copy metadata
- **AND** each saved draft marks `evidenceMode` as `input-only`
- **AND** the draft includes a warning that generated images were unavailable

### Requirement: Listing fields obey strict length limits
The system SHALL enforce a maximum of 500 characters for every generated field and every generated bullet item.

#### Scenario: Model returns overlong copy
- **WHEN** the model returns a title, description, backend search terms, selling point, pain point, keyword item, or bullet longer than 500 characters
- **THEN** the validator rejects or rewrites the output
- **AND** the final visible draft does not show any generated field or bullet over 500 characters

### Requirement: Listing drafts follow Amazon US title and keyword guardrails
The system SHALL generate conservative Amazon US English listing drafts with quantity-first titles, no title size/specification values, strengthened search terms, deduplicated keywords, and warnings for unsupported claims.

#### Scenario: Title includes quantity but excludes dimensions
- **WHEN** a listing draft is generated from product input with a known quantity and dimension
- **THEN** the title begins with the quantity
- **AND** the title does not include size, dimensions, weight, hook size, model specs, or measurement values
- **AND** remaining title terms prioritize core search terms, long-tail terms, traffic terms, and descriptive terms

#### Scenario: Keyword output is generated
- **WHEN** backend search terms and keyword buckets are generated
- **THEN** backend search terms are non-empty and include relevant core, long-tail, traffic, and descriptive terms
- **AND** keyword buckets include exact, long-tail, traffic, and descriptive groups
- **AND** keywords are deduplicated case-insensitively
- **AND** competitor brand terms and unsupported claims are surfaced as warnings or removed

### Requirement: Listing drafts are reviewable and exportable
The system SHALL display listing drafts in Creation record details and SHALL provide copy and export actions without exposing local absolute paths or secrets.

#### Scenario: User reviews generated listings
- **WHEN** listing drafts exist for a Creation set
- **THEN** the Creation record detail shows each listing draft with title, selling points, pain points, five bullets, description, backend search terms, keyword buckets, evidence mode, warnings, and missing information

#### Scenario: User exports listing drafts
- **WHEN** the user exports listing drafts
- **THEN** the app downloads a structured JSON file for the selected Creation set
- **AND** the export excludes API keys and local absolute paths
