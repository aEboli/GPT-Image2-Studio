## ADDED Requirements

### Requirement: Article Illustration Mode has independent generation controls

Article Illustration Mode SHALL expose its own thinking-effort and image-quality selectors in its input controls. Planning, reference-image generation, illustration generation, and regeneration SHALL use the Article Illustration Mode thinking-effort value; image-generation requests SHALL use its quality value after normalization for the active image model. The controls SHALL NOT read Prompt Mode's current selections.

#### Scenario: User generates article illustrations with selected controls

- **WHEN** the user selects a thinking effort and quality before parsing an article and generating illustrations
- **THEN** article planning receives the selected thinking effort
- **AND** illustration and reference-image generation receive the selected thinking effort and normalized quality.

#### Scenario: Active model does not support a selected extended quality

- **WHEN** the active image model does not support the Article Illustration Mode's selected extended quality tier
- **THEN** the control and request use the supported normalized quality tier
- **AND** the upstream request does not receive an unsupported quality value.
