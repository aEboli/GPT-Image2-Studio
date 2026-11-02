## ADDED Requirements

### Requirement: Listing generation includes complete German translations

The system SHALL request and preserve a `deDisplay` object alongside existing Listing content and `zhDisplay` for every platform and generation entry point. German translations SHALL cover title, selling points, pain points, five bullets, description, backend search terms, all keyword buckets, package dimensions and weight, product dimensions and weight, warnings, and missing information. Translations SHALL preserve source facts, numeric values, list correspondence, and German characters without changing the selected marketplace. Existing nonblocking acceptance of usable model responses SHALL remain in effect.

#### Scenario: Generate and reload a trilingual Listing

- **WHEN** a model returns Listing content with German and Chinese translations
- **THEN** normalization, sanitization, persistence, reload, and supported schema conversion preserve the complete `deDisplay` mapping
- **AND** German umlauts and ß remain readable

#### Scenario: Historical Listing lacks German

- **WHEN** the system reads a historical draft without `deDisplay`
- **THEN** existing content remains available without an automatic model request or invented German content
- **AND** explicit regeneration requests German translations using the new contract

## MODIFIED Requirements

### Requirement: New Listing drafts use the old-style bilingual field contract

The system SHALL request the old-style Listing contract with English content and German `deDisplay` and Simplified Chinese `zhDisplay` translations for every successfully generated or explicitly test-mocked Listing. After a real upstream response is parsed as a usable Listing object and normalized, the system SHALL retain and display the resulting draft as `completed` even when local field, bilingual, dimension, weight, content, provenance, length, or policy validation finds differences from that contract. A usable Listing object SHALL be a non-null, non-array JSON object with at least one non-empty known Listing content field at the top level or under `zhDisplay`. Local validation SHALL NOT discard, fail, retry, or prevent persistence of a successfully generated Listing. Existing output normalization and sanitization MAY transform public content without blocking the draft. If the first real response is empty, malformed, non-object, or lacks recognizable Listing content, the system SHALL make one retry for the Listing JSON shape. A failed real request, timeout, or second empty, malformed, non-object, or unrecognized Listing response SHALL NOT create a Listing draft.

#### Scenario: A new Listing is generated

- **WHEN** the model returns a parsed JSON object with old-style Listing fields
- **THEN** English content is stored in the available top-level old-style fields
- **AND** German content is stored in available `deDisplay` fields and Simplified Chinese content in available `zhDisplay` fields
- **AND** package dimensions precede product dimensions in display, full copy, and export when both fields are present
- **AND** the status is `completed`

#### Scenario: Local contract validation finds differences

- **WHEN** a parsed and normalized Listing differs from local bilingual, dimension, weight, provenance, content, length, or policy validation expectations
- **THEN** the system retains the generated draft as `completed`
- **AND** it does not return a Listing generation validation error
- **AND** it does not replace the response with a mock or deterministic Listing

#### Scenario: A response without Listing content is retried

- **WHEN** the first model response is empty, malformed, non-object, or has only unrecognized or empty fields
- **THEN** the system makes one additional upstream request that asks for the required Listing JSON shape
- **AND** it does not use local draft-validation findings as retry instructions

#### Scenario: A second response without Listing content fails

- **WHEN** the retry response is empty, malformed, non-object, or has no non-empty recognized Listing content
- **THEN** the system returns an explicit non-success error
- **AND** it does not normalize that response into a `completed` draft

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

- **WHEN** the browser receives a successful Listing generation response with missing English or Simplified Chinese dimension or weight fields
- **THEN** the browser accepts the response into current frontend state as a completed generation
- **AND** it does not report that the response must be discarded or that the service must be restarted

#### Scenario: A sourced package measurement has fewer than three axes

- **WHEN** package, packaging, packed, shipping, carton, color-box, outer-box, or visible package-box source evidence supplies only a length or a length and width
- **THEN** the system retains every supplied axis in order and derives only the missing package axes
- **AND** English and Simplified Chinese `packageDimensions` display length x width x height in the selected unit mode
- **AND** neither field receives `Estimated:` or `预估：`
- **AND** the completion does not make an accepted Listing retry, fail, or enter review

#### Scenario: Package evidence is absent

- **WHEN** no traceable package-scoped physical evidence exists, whether or not the usable Listing response supplies numeric package axes
- **THEN** the system supplies an `Estimated:` / `预估：` three-axis package dimension
- **AND** it retains a complete upstream tuple as accepted Listing content while adding the estimate marker or formatting it for the selected unit mode
- **AND** it bases a generated or completed estimate on available product dimensions, category, material, package contents, visible package-form evidence, and reference comparison-size evidence instead of a single generic size
- **AND** the estimate does not create another upstream request or reject the Listing

#### Scenario: An upstream package tuple has no traceable source evidence

- **WHEN** a usable Listing response contains an unmarked one-, two-, or three-axis `packageDimensions` value but no traceable package-scoped measurement exists in the Creation source
- **THEN** the system preserves a complete supplied tuple or completes a partial tuple to length x width x height
- **AND** it marks the English and Simplified Chinese package fields with `Estimated:` and `预估：`
- **AND** the marker and completion do not retry, fail, review, or prevent persistence of the accepted Listing

#### Scenario: A historical package value is incomplete

- **WHEN** a stored completed Listing contains a one- or two-axis `packageDimensions` value
- **THEN** the read response completes it to length x width x height using the same source-aware rules
- **AND** the stored Listing draft remains unchanged
