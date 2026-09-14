## ADDED Requirements

### Requirement: Configuration sections keep route and theme fields isolated

The configuration drawer SHALL expose four mutually exclusive sections named `路由模式`, `直连模式`, `Gemini`, and `主题`. The first three sections SHALL show only their matching connection fields. The `主题` section SHALL show the existing interface-palette card as a standalone region and SHALL hide and disable all route-specific connection fields. The existing palette identifiers and custom colour controls SHALL remain available.

#### Scenario: Theme section is selected

- **WHEN** the user selects the `主题` section
- **THEN** the palette card is visible as the only section-specific content
- **AND** route-specific connection fields are hidden and disabled

#### Scenario: Narrow theme section

- **WHEN** the `主题` section is narrower than the combined minimum width of the palette options
- **THEN** every palette option remains on one horizontal row
- **AND** the palette region can be scrolled horizontally without wrapping

### Requirement: Default palette uses the legacy indigo colours

The default palette SHALL retain the persisted identifier `default`, display the concise name `经典靛蓝` (Classic indigo), and use the v0.2.6 dark-blue values for its dark surface and accent. The independent light/dark theme setting SHALL continue to be persisted and synchronized with the Temu workbench.

#### Scenario: Existing stored palette and theme

- **WHEN** local storage contains an existing palette identifier or theme value
- **THEN** the workbench restores both values without discarding custom colours
