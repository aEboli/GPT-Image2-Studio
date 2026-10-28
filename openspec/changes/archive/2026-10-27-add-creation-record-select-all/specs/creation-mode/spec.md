## ADDED Requirements

### Requirement: Select all filtered Creation records

The Creation records view SHALL provide a select-all control that selects every record in the current complete filtered result set, including records beyond the current rendered page. Toggling the control off SHALL remove only matching filtered record IDs and preserve selections outside the current filter.

#### Scenario: Select all records across pages

- **WHEN** the user activates select all while the current filter matches more records than are currently rendered
- **THEN** every record matching the current search and time filters is selected
- **AND** matching records beyond the current page are included

#### Scenario: Clear only the current filtered selection

- **WHEN** every record in the current filtered result set is selected and the user activates the control again
- **THEN** the current filtered records are deselected
- **AND** selections outside the current filter remain selected
