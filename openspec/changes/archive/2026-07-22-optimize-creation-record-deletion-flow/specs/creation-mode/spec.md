## ADDED Requirements

### Requirement: Creation record deletion updates the open view in place
The system SHALL update the current Creation record view from the successful batch deletion result without automatically reloading the complete Creation set collection. The update SHALL preserve active keyword and time filters, surviving checked records, and the current list scroll context, while manual Refresh SHALL remain available for explicit reconciliation with external changes.

#### Scenario: Successful deletion does not reload all records
- **WHEN** the Creation record batch deletion endpoint successfully processes the submitted set IDs
- **THEN** the browser removes those deleted or already-absent records from its current set collection
- **AND** it does not automatically request the complete Creation set list
- **AND** count, filter options, list, detail, checked selection, queue, and deletion controls update in one final render

#### Scenario: Current detail survives a batch deletion
- **WHEN** a checked or filtered batch is deleted without including the record open in the detail view
- **THEN** the open detail record remains selected
- **AND** surviving checked records and active filters remain unchanged

#### Scenario: Current detail is deleted
- **WHEN** the record open in the detail view is included in a successful deletion
- **THEN** the browser selects the next surviving record in the complete filtered order
- **AND** it selects the previous surviving record when there is no next record
- **AND** it shows an empty filtered result when no matching record remains

#### Scenario: User explicitly refreshes records
- **WHEN** the user activates Refresh after records may have changed in another window or outside the application
- **THEN** the browser requests the complete Creation set list and reconciles its local record state
