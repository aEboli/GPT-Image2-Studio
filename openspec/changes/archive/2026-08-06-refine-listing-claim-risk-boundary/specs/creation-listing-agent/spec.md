## ADDED Requirements

### Requirement: Listing claim filtering separates ordinary attributes from qualification-sensitive performance terms

The system SHALL treat sourced ordinary product attributes such as portable design and USB charging as usable Listing facts rather than configured blocking claims. These ordinary attributes SHALL still be removed from public English and Simplified Chinese Listing fields when they are absent from traceable source evidence. The evidence gate SHALL recognize configured conservative English and Simplified Chinese equivalents for these ordinary attributes. The system SHALL remove qualification-sensitive high-power, high-brightness, and waterproof wording and configured equivalents from every public V1 and V2 English and Simplified Chinese Listing field even when ordinary product text repeats that wording, because the system has no verified qualification-evidence object. Removing any such content SHALL NOT retry, reject, or replace an otherwise usable Listing response.

#### Scenario: Sourced ordinary attributes remain usable

- **WHEN** traceable English or Simplified Chinese source evidence supplies portable design or USB charging
- **THEN** the corresponding configured English and Simplified Chinese ordinary attribute may remain in public Listing content
- **AND** the attribute is not removed as a qualification-sensitive claim

#### Scenario: Unsupplied ordinary attribute remains unsupported

- **WHEN** a model response introduces portable design or USB charging without traceable source evidence
- **THEN** the unsupported concrete attribute is removed from English and Simplified Chinese content by the factual evidence gate
- **AND** it is not retained merely because the term is outside the qualification-sensitive list

#### Scenario: Qualification-sensitive performance wording is removed

- **WHEN** any public V1 or V2 Listing field contains high-power, high-brightness, waterproof, or a configured equivalent
- **THEN** the system removes the complete matched wording from English and Simplified Chinese content
- **AND** ordinary product text repeating the wording does not bypass the rule
- **AND** the remaining usable response is returned without another model request

## MODIFIED Requirements

### Requirement: Short generated Listing titles reuse safe response content

After a newly generated or regenerated Listing response has completed no-brand, unsupported-evidence, blocking-claim, and internal-part-number cleanup, the system SHALL extend an English title that remains below the resolved platform recommendation when same-language sanitized response content supplies distinct supported information. The extension SHALL extract title-appropriate keywords or short phrases from cleaned selling points, five bullets, pain points, description, backend search terms, and keyword buckets; SHALL omit generic structural field labels; SHALL allow a concise same-language lead label only when the label itself expresses a traceably supported product attribute; SHALL remove sentence punctuation; SHALL avoid copying an unbroken prose paragraph when a shorter sentence, clause, word, or phrase boundary is available; and SHALL avoid repeated title concepts. Appended English content SHALL preserve complete word boundaries, while Simplified Chinese content SHALL use cleaned `zhDisplay` text and Chinese punctuation or bounded phrase boundaries. The result SHALL obey the platform hard character and UTF-8 byte limits plus the universal field ceiling. A lack of safe extension content SHALL NOT fail, retry, or replace the accepted response. The Simplified Chinese reference title SHALL NOT use the evidence-rich 120-English-character target.

#### Scenario: Safe response content can complete a short title

- **WHEN** a model returns a usable title below the platform recommended minimum
- **AND** cleaned selling points, bullets, pain points, description, or search fields contain distinct same-language supported product information
- **THEN** the completed title appends enough non-duplicate safe keywords or short phrases to reach the applicable target when possible
- **AND** the result does not exceed a platform character or UTF-8 byte hard limit

#### Scenario: Prose fields are converted to title phrases

- **WHEN** a completion source contains a traceably supported semantic lead label, a generic structural label, a long English sentence, or consecutive Chinese clauses without spaces
- **THEN** the supported semantic lead label may remain eligible while the generic structural label and sentence punctuation are removed
- **AND** a semantic lead label without traceable source support is omitted
- **AND** the system does not copy the complete source paragraph into the title when a shorter boundary is available
- **AND** an English phrase is not truncated inside a word

#### Scenario: Evidence-rich English response is shorter than 120 characters

- **WHEN** the source supplies at least six distinct Listing evidence aliases
- **AND** the platform has no hard title limit below 120
- **AND** the cleaned accepted response contains enough distinct English content
- **THEN** the completed English title reaches at least 120 characters without another model request
- **AND** its appended content contains no internal part number

#### Scenario: Safe extension content is unavailable

- **WHEN** a short accepted title has no distinct cleaned same-language response content that can extend it
- **THEN** the system retains the shorter title as completed
- **AND** it does not retry, invent filler, or fail the Listing

#### Scenario: Low title limit takes precedence

- **WHEN** the resolved platform hard title limit is below the general completeness target
- **THEN** title completion stops at that hard limit
- **AND** lower-priority candidate content is omitted
