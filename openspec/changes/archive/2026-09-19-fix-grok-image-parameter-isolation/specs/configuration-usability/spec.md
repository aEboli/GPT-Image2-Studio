## ADDED Requirements

### Requirement: Configuration controls reflect the selected image route

The generation parameter panel SHALL show the reasoning-effort control only for image routes that support GPT reasoning. When Grok is selected, the control SHALL be hidden and disabled, and the quality selector SHALL be rebuilt from the Grok-only options. Returning to GPT SHALL restore the GPT reasoning control and its route-specific quality value.

#### Scenario: Grok parameters are targeted

- **WHEN** the user selects Grok in the configuration drawer
- **THEN** the main image reasoning control is hidden and disabled
- **AND** the quality selector shows only `low` and `medium`
- **AND** the tool does not display a GPT-only quality tier as the current Grok value

#### Scenario: Returning to GPT restores controls

- **WHEN** the user switches from Grok back to GPT
- **THEN** the reasoning control becomes visible and enabled
- **AND** the GPT quality value last selected for the active GPT route is restored
