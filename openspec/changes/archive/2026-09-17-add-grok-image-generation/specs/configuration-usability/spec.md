## ADDED Requirements

### Requirement: Configuration sections group GPT modes and expose Grok

The configuration drawer SHALL present top-level sections in the order `GPT`, `Gemini`, `Grok`, and `配色`. The GPT section SHALL show a route-mode/direct-mode selector immediately below the top-level selector. Gemini and Grok sections SHALL show only their own provider settings.

#### Scenario: GPT section shows nested mode switch

- **WHEN** the user selects GPT
- **THEN** the route-mode/direct-mode switch is visible directly below the top-level configuration selector
- **AND** selecting either option activates only the corresponding GPT panel

#### Scenario: Gemini and Grok section selection

- **WHEN** the user selects Gemini or Grok
- **THEN** the GPT nested switch is hidden
- **AND** the selected section activates route C or D respectively

#### Scenario: Palette section

- **WHEN** the user selects 配色
- **THEN** no image provider route is changed
- **AND** the palette controls remain available
