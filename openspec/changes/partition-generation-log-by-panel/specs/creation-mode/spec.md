## MODIFIED Requirements

### Requirement: Creation Mode tab is independent
The system SHALL expose Creation Mode as a separate tab under the creation workspace and SHALL NOT share prompt text, reference-image selections, prompt templates, queued jobs, or prompt-mode generated state with Creation Mode. Creation Mode SHALL write its generation log into its own `creation` log partition grouped by set, and SHALL NOT write into the prompt-mode log partition.

#### Scenario: User switches from prompt mode to Creation Mode
- **WHEN** the user opens the Creation Mode tab
- **THEN** the system displays Creation Mode-specific inputs and does not prefill them from the prompt-mode prompt, reference images, or Prompt Kit templates

#### Scenario: Creation Mode receives generated results
- **WHEN** a Creation Mode set saves generated images
- **THEN** the prompt-mode log partition and default gallery-visible history are not updated as if the images were prompt-mode single-image jobs
- **AND** the `creation` log partition records the set as one grouped row

#### Scenario: Creation Mode set writes its own grouped log
- **WHEN** a Creation Mode set generates images
- **THEN** the settings generation log panel, scoped to the `creation` board, shows one collapsed group row for that set with its total, completed, failed, and running counts and its relay URL
- **AND** expanding the row lists per-image entries for that set
