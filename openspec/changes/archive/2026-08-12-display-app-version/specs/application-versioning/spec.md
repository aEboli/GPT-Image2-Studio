## ADDED Requirements

### Requirement: The workbench displays the current application version

The system SHALL display the current main application version as `v<version>` at the lower-left edge of the workbench in every supported browser, cloud, and desktop runtime. The displayed version SHALL match the root package version, remain visible inside viewport safe areas, remain non-interactive, and SHALL NOT introduce horizontal overflow or block primary controls.

#### Scenario: User opens the workbench

- **WHEN** the workbench is rendered in any supported main application runtime
- **THEN** exactly one current version label is visible at the lower-left edge
- **AND** its value equals `v` followed by the root `package.json` version

#### Scenario: User opens the workbench on a compact or inset viewport

- **WHEN** the version label is rendered on a phone-sized viewport or a viewport with safe-area insets
- **THEN** the label remains within the left and bottom safe areas
- **AND** it does not receive pointer input, create horizontal overflow, or obstruct primary controls
