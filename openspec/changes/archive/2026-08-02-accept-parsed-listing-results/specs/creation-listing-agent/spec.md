## MODIFIED Requirements

### Requirement: New Listing drafts use the old-style bilingual field contract

The system SHALL request the existing old-style bilingual Listing contract for every successfully generated or explicitly test-mocked Listing. After a real upstream response is parsed as a usable Listing object and normalized, the system SHALL retain and display the resulting draft as `completed` even when local field, bilingual, dimension, weight, content, provenance, length, or policy validation finds differences from that contract. A usable Listing object SHALL be a non-null, non-array JSON object with at least one non-empty known Listing content field at the top level or under `zhDisplay`. Local validation SHALL NOT discard, fail, retry, or prevent persistence of a successfully generated Listing. Existing output normalization and sanitization MAY transform public content without blocking the draft. If the first real response is empty, malformed, non-object, or lacks recognizable Listing content, the system SHALL make one retry for the Listing JSON shape. A failed real request, timeout, or second empty, malformed, non-object, or unrecognized Listing response SHALL NOT create a Listing draft.

#### Scenario: A new Listing is generated

- **WHEN** the model returns a parsed JSON object with old-style Listing fields
- **THEN** English content is stored in the available top-level old-style fields
- **AND** Simplified Chinese content is stored in available `zhDisplay` fields
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

### Requirement: Listing generation completes without validation or review gates

The system SHALL make one upstream model request for Platform V1 and MAY make exactly one additional request only when the first response cannot be parsed as a usable Listing object. It SHALL NOT perform validator-driven retries, manual review, `needs-review`, failed rewrite gates, status-based copy/export blocking, or local acceptance failures after a usable Listing response is normalized. After parsing and normalization, it SHALL remove unsupported low-risk evidence terms and every unsupported match from the blocking claim rules, then SHALL repair an emptied required title or description from remaining safe public content, a sanitized source product identity, or a neutral product identity. It SHALL accept local validation differences in title length, Bullet format, pain-point form, bilingual content or counts, keyword population, dimensions, weights, provenance, and policy content. If the real model request, timeout handling, two response-shape attempts, parsing, or normalization cannot produce a usable Listing response, the system SHALL return an explicit generation error and SHALL NOT create a mock or deterministic replacement Listing. Missing required API configuration SHALL remain an explicit configuration error.

#### Scenario: Model returns usable old-style JSON

- **WHEN** the first or retry model response can be parsed as a usable Listing object and normalized into a Listing draft
- **THEN** the system returns the normalized, sanitized, and minimally repaired draft as `completed`
- **AND** no local validator review or rejection occurs
- **AND** no second Platform V1 model request occurs after a usable first response

#### Scenario: Local validation differs from the response

- **WHEN** the parsed model response would previously fail an old-style or V2 local validation rule
- **THEN** the system returns the normalized draft as `completed`
- **AND** the validation result does not produce an upstream retry or a generation error

#### Scenario: Unsupported low-risk terms are recoverable

- **WHEN** the model response contains low-risk concrete attributes, materials, colors, shapes, construction details, modes, or use contexts that are absent from traceable source evidence
- **THEN** the system removes those terms from public Listing content
- **AND** it returns the remaining usable draft as `completed` without another model request

#### Scenario: Compatibility claim is recoverable

- **WHEN** a Platform V1 response contains an unsupported phrase such as `compatible with ...`, `works with every ...`, `兼容...`, or an equivalent configured compatibility match
- **THEN** the system removes the complete matched compatibility phrase in that language
- **AND** it returns the remaining direct response as `completed` without another model request
- **AND** it does not return `content contains unsupported claim "compatibility claim"`

#### Scenario: Blocking claim cleanup empties required text

- **WHEN** blocking-claim cleanup empties an English or Chinese title or description
- **THEN** the system fills the field from remaining safe same-language content, a sanitized source product identity, or `Product` / `商品`
- **AND** the cleanup does not cause Listing generation to fail
- **AND** the system does not reconstruct the removed claim or invent a replacement fact

#### Scenario: Non-critical formatting differs from the prompt target

- **WHEN** the normalized response uses a shorter title, legacy or non-unique Bullet labels, a non-five Bullet count, interrogative pain-point copy, unequal bilingual list counts, empty keyword buckets, unmarked estimates, incomplete non-package physical fields, or unmatched source-dimension tuples
- **THEN** the system returns the draft as `completed`
- **AND** none of those format differences produces a generation error

#### Scenario: Model request or parsing fails

- **WHEN** the upstream returns a rate limit, server error, timeout, or two empty, malformed, non-object, or unrecognized Listing responses
- **THEN** the system returns an explicit non-success error
- **AND** it does not return a mock, deterministic fallback or `completed` draft

#### Scenario: Model content fails acceptance

- **WHEN** two parsed model responses are empty, non-object, malformed, or contain no non-empty recognized Listing field
- **THEN** the system returns an explicit non-success error describing the unusable Listing response
- **AND** it does not return a mock, deterministic fallback or `completed` draft

#### Scenario: Regeneration fails for a record with an existing Listing

- **WHEN** a record already has `listingDrafts` and a regeneration request fails for an upstream or parsing error
- **THEN** the API returns the generation error
- **AND** the existing stored `listingDrafts` are not overwritten by mock, deterministic, partial, or empty output

#### Scenario: User copies or exports a completed draft

- **WHEN** any old-style draft is visible
- **THEN** single-field copy, full copy and structured export are available directly
- **AND** those actions do not inspect validation, review or access-gate state
