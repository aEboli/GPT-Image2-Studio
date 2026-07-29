## ADDED Requirements

### Requirement: Checked deletion is bounded by the current filtered collection
Article, Portrait, and PPT Delete selected actions SHALL derive their confirmation count and deletion targets from the intersection of checked record IDs and the same complete filtered collection used by the visible view. Checked records outside that collection SHALL remain stored and SHALL NOT be deleted by the current action.

#### Scenario: A checked record becomes hidden by a filter
- **WHEN** a user checks a record, applies a filter that excludes it, and activates Delete selected
- **THEN** the hidden record is not included in the confirmation count or deletion request
- **AND** clearing the filter can expose its preserved checked state again
