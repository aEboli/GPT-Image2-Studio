## ADDED Requirements

### Requirement: PPT generation has independent image-generation controls

PPT generation SHALL expose its own thinking-effort and image-quality selectors. Initial deck generation, missing-slide completion, and single-slide editing SHALL preserve the selected values for the associated deck operation. The server SHALL normalize quality for the selected image model before each slide request and SHALL store the effective quality in saved slide metadata.

#### Scenario: User generates a deck with selected controls

- **WHEN** the user chooses a thinking effort and quality before generating a PPT deck
- **THEN** outline generation receives that thinking effort
- **AND** every generated slide receives the normalized selected quality and thinking effort.

#### Scenario: User completes missing slides

- **WHEN** a deck has missing slides and the user requests completion
- **THEN** the completion request reuses the deck operation's selected thinking effort and normalized quality
- **AND** missing slides do not silently fall back to the global quality default.

#### Scenario: User edits a generated slide

- **WHEN** the user edits a PPT slide
- **THEN** the edit request uses the PPT Mode thinking effort and normalized quality
- **AND** the saved replacement slide records the effective quality.
