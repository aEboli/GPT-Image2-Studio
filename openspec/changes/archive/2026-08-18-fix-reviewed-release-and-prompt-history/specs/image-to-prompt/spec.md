## MODIFIED Requirements

### Requirement: Long-term prompt history backfills Prompt Kit templates

The browser SHALL treat only reusable ordinary image-to-prompt history as a source for missing automatic Prompt Kit templates. Newly persisted Prompt Agent history SHALL retain an explicit analysis-mode discriminator. A record with an explicit ordinary image-to-prompt mode MAY be imported, while records with reference orchestration, Creation reference analysis, Portrait reference analysis, another non-ordinary mode, or an unknown explicit mode SHALL remain excluded. A legacy record without a mode SHALL be eligible only when its result matches the recognized five-group image-to-prompt structure or the recognizable legacy reverse-analysis structure; ambiguous objects and `prompts[]` orchestration results SHALL remain excluded. Reading legacy history or appending a new record SHALL preserve the absence of the discriminator instead of synthesizing an empty mode on old records. When Prompt Kit opens or Prompt Agent history is successfully refreshed, each eligible item with reusable text SHALL map to an automatic template ID derived from its stable history ID. Existing templates with the same ID SHALL remain unchanged, and the browser SHALL NOT delete or mutate the server-side history record.

#### Scenario: Prompt Kit opens with ordinary image-to-prompt history

- **WHEN** the user opens Prompt Kit and the history endpoint returns reusable records explicitly identified as ordinary image-to-prompt analysis
- **THEN** each missing eligible record appears as a `prompt-agent-*` template using the history display name and reusable text
- **AND** the existing user-authored templates remain in the list

#### Scenario: Prompt Kit opens with existing long-term history

- **WHEN** the user opens Prompt Kit and the history endpoint returns reusable image-to-prompt records
- **THEN** each missing history record appears as a `prompt-agent-*` template using the history display name and reusable text
- **AND** the existing user-authored templates remain in the list

#### Scenario: History contains an explicitly non-ordinary analysis

- **WHEN** history contains a reference-orchestration or another explicitly non-ordinary record with reusable text or a non-empty `prompts[]` array
- **THEN** no Prompt Kit template is created from that record
- **AND** the complete record remains available in Prompt Agent history

#### Scenario: Legacy ordinary reverse-prompt history has no mode

- **WHEN** a legacy record without an analysis-mode discriminator contains either the recognized `subject`, `framing`, `scene`, `visual`, and `avoid` groups or a non-empty prompt with recognizable legacy reverse-analysis fields
- **THEN** the record remains eligible for the same automatic template mapping as an explicitly ordinary record

#### Scenario: Legacy mode-less history is ambiguous

- **WHEN** a legacy record without an analysis-mode discriminator contains only `prompts[]`, an unknown object shape, or reusable-looking text without recognizable ordinary reverse-analysis structure
- **THEN** the record remains in history without creating a Prompt Kit template

#### Scenario: A new record is appended beside mode-less legacy history
- **WHEN** storage reads legacy entries without a discriminator and appends a newly identified ordinary record
- **THEN** the new record stores the normalized ordinary mode
- **AND** each legacy entry remains persisted without a synthesized empty mode field

#### Scenario: History is loaded more than once

- **WHEN** the same eligible history records are loaded again or the response contains duplicate IDs
- **THEN** Prompt Kit contains one template for each eligible history ID
- **AND** existing template order and content are not duplicated or rewritten

#### Scenario: User edited an automatically mapped template

- **WHEN** a `prompt-agent-*` template already has a user-edited name or prompt
- **THEN** loading the matching eligible history record preserves the edited name and prompt

#### Scenario: User deletes a mapped template

- **WHEN** the user deletes a template created from eligible long-term history
- **THEN** the template is removed from Prompt Kit
- **AND** the corresponding long-term history record remains available in the image-to-prompt history
- **AND** a later automatic history refresh does not recreate the dismissed template

#### Scenario: Eligible history has no reusable text

- **WHEN** an eligible history item has neither a structured reusable result nor a non-empty prompt
- **THEN** the item remains visible only in long-term history
- **AND** no empty Prompt Kit template is created

#### Scenario: History has no reusable text

- **WHEN** a history item has neither a structured reusable result nor a non-empty prompt
- **THEN** the item remains visible only in long-term history
- **AND** no empty Prompt Kit template is created
