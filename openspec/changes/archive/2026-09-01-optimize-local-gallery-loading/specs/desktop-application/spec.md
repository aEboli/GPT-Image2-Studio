## ADDED Requirements

### Requirement: Workbench initial document does not require third-party fonts
The system SHALL render the primary workbench initial document using locally available system font fallbacks and SHALL NOT request third-party font stylesheets or font files during initial document load.

#### Scenario: User opens the local workbench without internet access
- **WHEN** the primary workbench document loads while third-party font hosts are unavailable
- **THEN** its stylesheets and text render using the configured system font stack
- **AND** the document does not wait for a third-party font request
