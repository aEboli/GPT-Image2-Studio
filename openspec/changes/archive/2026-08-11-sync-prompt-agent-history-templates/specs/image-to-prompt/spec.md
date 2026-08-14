## ADDED Requirements

### Requirement: Long-term prompt history backfills Prompt Kit templates

The browser SHALL treat reusable image-to-prompt history as a source for missing automatic Prompt Kit templates. When Prompt Kit opens or Prompt Agent history is successfully refreshed, each history item with reusable text SHALL map to an automatic template ID derived from its stable history ID. Existing templates with the same ID SHALL remain unchanged, and the browser SHALL NOT delete or mutate the server-side history record.

#### Scenario: Prompt Kit opens with existing long-term history

- **WHEN** the user opens Prompt Kit and the history endpoint returns reusable image-to-prompt records
- **THEN** each missing history record appears as a `prompt-agent-*` template using the history display name and reusable text
- **AND** the existing user-authored templates remain in the list

#### Scenario: History is loaded more than once

- **WHEN** the same history records are loaded again or the response contains duplicate IDs
- **THEN** Prompt Kit contains one template for each history ID
- **AND** existing template order and content are not duplicated or rewritten

#### Scenario: User edited an automatically mapped template

- **WHEN** a `prompt-agent-*` template already has a user-edited name or prompt
- **THEN** loading the matching history record preserves the edited name and prompt

#### Scenario: User deletes a mapped template

- **WHEN** the user deletes a template created from long-term history
- **THEN** the template is removed from Prompt Kit
- **AND** the corresponding long-term history record remains available in the image-to-prompt history
- **AND** a later automatic history refresh does not recreate the dismissed template

#### Scenario: History has no reusable text

- **WHEN** a history item has neither a structured reusable result nor a non-empty prompt
- **THEN** the item remains visible only in long-term history
- **AND** no empty Prompt Kit template is created
