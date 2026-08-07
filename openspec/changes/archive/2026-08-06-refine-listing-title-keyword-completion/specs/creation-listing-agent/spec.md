## MODIFIED Requirements

### Requirement: Short generated Listing titles reuse safe response content

After a newly generated or regenerated Listing response has completed no-brand, unsupported-evidence, blocking-claim, and internal-part-number cleanup, the system SHALL extend an English title that remains below the resolved platform recommendation when same-language sanitized response content supplies distinct supported information. The extension SHALL extract title-appropriate keywords or short phrases from cleaned selling points, five bullets, pain points, description, backend search terms, and keyword buckets; SHALL remove field labels and sentence punctuation; SHALL avoid copying an unbroken prose paragraph when a shorter sentence, clause, word, or phrase boundary is available; and SHALL avoid repeated title concepts. Appended English content SHALL preserve complete word boundaries, while Simplified Chinese content SHALL use cleaned `zhDisplay` text and Chinese punctuation or bounded phrase boundaries. The result SHALL obey the platform hard character and UTF-8 byte limits plus the universal field ceiling. A lack of safe extension content SHALL NOT fail, retry, or replace the accepted response. The Simplified Chinese reference title SHALL NOT use the evidence-rich 120-English-character target.

#### Scenario: Safe response content can complete a short title

- **WHEN** a model returns a usable title below the platform recommended minimum
- **AND** cleaned selling points, bullets, pain points, description, or search fields contain distinct same-language supported product information
- **THEN** the completed title appends enough non-duplicate safe keywords or short phrases to reach the applicable target when possible
- **AND** the result does not exceed a platform character or UTF-8 byte hard limit

#### Scenario: Prose fields are converted to title phrases

- **WHEN** a completion source contains a bullet label, a long English sentence, or consecutive Chinese clauses without spaces
- **THEN** the system removes the label and sentence punctuation and extracts bounded title phrases
- **AND** it does not copy the complete source paragraph into the title when a shorter boundary is available
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
