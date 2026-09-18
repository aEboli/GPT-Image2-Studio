## ADDED Requirements

### Requirement: Configuration density adapts to available width

The configuration drawer SHALL use a compact two-column arrangement for compatible provider fields when the available viewport is at least 600px. Endpoint fields SHALL remain full width, and the drawer SHALL fall back to a single-column arrangement below that threshold. The layout MUST preserve all existing form controls and their saved field names.

#### Scenario: Medium-width provider configuration

- **WHEN** a provider configuration is opened at a viewport at least 600px wide
- **THEN** compatible credentials and model fields share rows
- **AND** endpoint fields remain full width
- **AND** every existing provider control remains available

#### Scenario: Narrow provider configuration

- **WHEN** a provider configuration is opened below 600px wide
- **THEN** its fields remain in one readable column
- **AND** controls retain the existing touch target sizing

### Requirement: Configuration navigation remains reachable

The configuration drawer SHALL keep the top-level provider selector reachable while the form scrolls. When GPT is selected, its nested route/direct selector SHALL remain reachable with the provider selector. The selectors SHALL continue to control the existing route state without changing persisted configuration keys.

#### Scenario: Scroll a long provider form

- **WHEN** the user scrolls a provider configuration form
- **THEN** the provider selector remains available at the top of the form viewport
- **AND** the GPT nested selector remains available when GPT is active

### Requirement: Wide desktop configuration and log are independent columns

At a viewport at least 1120px wide, the configuration drawer SHALL present the form and generation log as independent columns. The log SHALL retain its minimum usable height and its own vertical scrolling. Narrower layouts SHALL retain the existing stacked arrangement.

#### Scenario: Wide desktop drawer

- **WHEN** the configuration drawer opens on a wide desktop viewport
- **THEN** the form and generation log are visible in parallel columns
- **AND** scrolling one column does not move the other column
