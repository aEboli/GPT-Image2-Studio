## ADDED Requirements

### Requirement: Platformless AI marketing plans enforce confirmed restricted terms

Creation Mode SHALL include confirmed restricted terms in the existing AI marketing request and SHALL validate generated ordinary marketing items locally before generation. Because Creation Mode has no marketplace selector and new plans use the universal ecommerce profile, these restrictions SHALL apply regardless of legacy platform metadata. The current confirmed list SHALL include the standalone English word `safe`, based on user feedback about SHEIN. Matching SHALL be case-insensitive in the final prompt, title, marketing goal, and creative brief fields, after system subject-lock text is assembled. A matching ordinary item SHALL be removed with a diagnostic naming its source index, field, and matched term; it MUST NOT be submitted for image generation. This check MUST NOT add a model request. Existing user-locked and required-item failure behavior SHALL remain authoritative.

#### Scenario: Restricted term is filtered in the universal plan

- **WHEN** an AI marketing item contains standalone `safe` in any letter case
- **THEN** the server removes that item before generation
- **AND** the diagnostic identifies the source item, field, and matched term
- **AND** the planner does not issue an automatic repair request

#### Scenario: Match boundaries avoid unrelated words

- **WHEN** a marketing item contains `unsafe` or `safely` but not standalone `safe`
- **THEN** the restricted-term validator does not remove it for this rule

#### Scenario: Legacy platform metadata does not change filtering

- **WHEN** a request contains legacy marketplace metadata or the normal `universal` value
- **THEN** the same confirmed restricted terms are included and enforced
