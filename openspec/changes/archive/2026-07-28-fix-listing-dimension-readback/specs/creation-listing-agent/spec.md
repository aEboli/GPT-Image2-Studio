## MODIFIED Requirements

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

#### Scenario: A historical draft without dimension fields is opened
- **WHEN** a completed stored draft predates the two dimension fields
- **THEN** the reader fills the missing response fields from corresponding set-level physical dimension evidence when available
- **AND** if the historical buyer-facing copy contains component-labeled product dimensions whose complete numeric-unit tokens exist in the source product evidence, the reader presents those dimensions as concise component groups in English and Simplified Chinese
- **AND** it does not concatenate an ambiguous sequence of detached Length and Width measurements or infer component pairings from their order
- **AND** it provides explicitly marked numeric estimates for dimension types without corresponding evidence
- **AND** display, copy and export receive package dimensions followed by product dimensions
- **AND** the historical stored draft is not rewritten automatically

#### Scenario: A historical V2 draft is opened
- **WHEN** a stored draft uses `buyerObjections`, `highlights` or `searchTerms`
- **THEN** the reader maps historical values for display, copy and export without rejecting the draft
- **AND** the historical stored draft is not rewritten automatically

#### Scenario: An old service returns a dimensionless success payload
- **WHEN** the browser receives a successful Listing generation response with any missing English or Simplified Chinese dimension field
- **THEN** the browser reports that the Image Studio service may require restart
- **AND** it does not accept that response into current frontend state as a completed generation
