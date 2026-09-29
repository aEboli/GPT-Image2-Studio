## ADDED Requirements

### Requirement: Aspect-ratio controls display only the selected ratio

The system SHALL display only the numeric ratio value in selected-ratio summaries and ratio selector options. Explanatory use-case copy MAY remain in browser-side localization resources, but SHALL NOT be exposed in shared aspect-ratio options or generation configuration responses.

#### Scenario: Selected ratio summary

- **WHEN** the user selects `1:1`
- **THEN** the selected-ratio summary displays `1:1`
- **AND** it does not display use-case or orientation descriptions

#### Scenario: Ratio selectors

- **WHEN** a ratio selector lists supported values
- **THEN** each option displays only its numeric ratio value

### Requirement: Generation prompts use only a concise ratio value

Generated prompts SHALL NOT include explanatory ratio labels, use cases, localized UI copy, or lengthy composition instructions. When a prompt needs an explicit ratio hint, it SHALL use only one concise `Aspect ratio: W:H.` instruction derived from the selected ratio value.

#### Scenario: Prompt receives a ratio hint

- **WHEN** the selected ratio is `4:5` and the prompt does not already contain its ratio hint
- **THEN** the generated prompt contains `Aspect ratio: 4:5.`
- **AND** it contains no ratio use-case or orientation description

#### Scenario: Prompt already contains the selected ratio hint

- **WHEN** the prompt already contains `Aspect ratio: 4:5.`
- **THEN** generation does not append a second ratio hint

### Requirement: Ratio metadata contains and displays only the ratio value

New generation tasks, image records, and Creation snapshots SHALL set `ratioLabel` to the numeric `ratio` value. Record and task presentation SHALL prefer the numeric `ratio` field over a legacy descriptive `ratioLabel`.

#### Scenario: New generation metadata

- **WHEN** an image is generated with ratio `1:1`
- **THEN** task and image metadata store `ratioLabel` as `1:1`

#### Scenario: Legacy descriptive ratio label

- **WHEN** a task or image record contains `ratio: 4:5` and an older descriptive `ratioLabel`
- **THEN** its parameter display shows `4:5`
- **AND** it does not show the old descriptive label

### Requirement: Structured ratio behavior remains unchanged

Generation requests SHALL continue to send the selected numeric ratio through the existing structured request field, and ratio-specific size resolution SHALL remain unchanged.

#### Scenario: Structured ratio request

- **WHEN** generation runs with ratio `4:5`
- **THEN** the structured request continues to use `4:5`
- **AND** the existing size resolution for `4:5` is preserved
