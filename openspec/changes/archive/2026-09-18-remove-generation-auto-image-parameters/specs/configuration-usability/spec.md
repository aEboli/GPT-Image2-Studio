## ADDED Requirements

### Requirement: Resolution labels describe concrete output choices

The configuration drawer SHALL present a concrete resolution label and value for every image route. It SHALL NOT present a placeholder or automatic-resolution choice, and switching aspect ratios or image routes SHALL immediately replace a historical automatic value with the applicable concrete default.

#### Scenario: Changing ratio replaces a legacy value

- **WHEN** the selected aspect ratio changes while the current resolution value is missing, invalid, or historically auto
- **THEN** the control selects the first concrete size for the new ratio
- **AND** the generated form data contains that concrete size

#### Scenario: Switching to Gemini uses a concrete tier

- **WHEN** the user switches from GPT or Grok to Gemini
- **THEN** the resolution control selects 1K when the previous value is not a valid Gemini tier
- **AND** the Gemini request does not contain auto
