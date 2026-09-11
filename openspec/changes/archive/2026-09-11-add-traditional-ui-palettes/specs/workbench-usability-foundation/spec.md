## ADDED Requirements

### Requirement: Traditional interface palettes
The configuration drawer SHALL expose an allowlisted traditional-colour palette, persist the selected palette locally, and apply it to the shared interface tokens without changing the existing dark/light theme contract.

#### Scenario: Select and restore a palette
- **WHEN** a user selects a named palette and reloads the workbench
- **THEN** the same palette is applied before the first stylesheet paint and its radio control is marked selected.

### Requirement: Optional floral accents
The configuration drawer SHALL let users enable one of the supported floral accent motifs, and the motif SHALL remain decorative and non-interactive.

#### Scenario: Decorative motif does not block work
- **WHEN** floral accents are enabled
- **THEN** the motif uses existing palette tokens, is hidden from assistive technology, and does not cover the configuration form or generation log.
