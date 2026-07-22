## ADDED Requirements

### Requirement: Creation set records can be filtered by creation time
The system SHALL let users filter Creation set records by the manifest `createdAt` value using All, Today, Recent 7 days, Older, or one exact local calendar date. Time filtering SHALL combine with keyword search, and the record count, empty state, detail selection, visible list, and filtered deletion target SHALL derive from the same complete filtered collection before the visible list rendering limit is applied.

#### Scenario: User selects a quick time window
- **WHEN** the user selects Today, Recent 7 days, or Older
- **THEN** the system matches records created today, from today through six local calendar days ago, or at least seven local calendar days ago respectively
- **AND** invalid or future creation timestamps do not match a bounded time window
- **AND** selecting a non-default quick window clears an exact-date filter

#### Scenario: User selects an exact date
- **WHEN** the user enters a valid exact calendar date
- **THEN** the system matches records whose `createdAt` falls on that local calendar date
- **AND** the quick time window returns to All so the exact date is the only active time condition

#### Scenario: Keyword and time filters are combined
- **WHEN** the user enters a keyword and selects an explicit time condition
- **THEN** only records matching both the existing keyword search text and the time condition are included
- **AND** counts and detail fallback use the complete combined result even when more than 60 records match

#### Scenario: User clears Creation record filters
- **WHEN** the user activates Clear filters
- **THEN** the keyword, quick time, and exact-date controls return to their defaults
- **AND** all Creation set records, including records with missing or invalid creation timestamps, are available again

## MODIFIED Requirements

### Requirement: Creation set records can be deleted individually or in explicit batches
The system SHALL let users permanently delete the current Creation set record, an explicitly checked group of Creation set records, or every Creation set record matching the current explicit keyword and time filters. Each deletion SHALL remove the set manifest, its dedicated generated-image directory, and its corresponding JSON metadata directory without deleting another set or an output root.

#### Scenario: User deletes the current set record
- **WHEN** the user chooses Delete current for a selected Creation set record and confirms the action
- **THEN** the browser submits exactly that set ID to the batch deletion endpoint
- **AND** the Local store deletes that set manifest, its dedicated generated images, and its corresponding JSON sidecars
- **AND** the record list and detail selection refresh without the deleted set

#### Scenario: User checks and deletes multiple set records
- **WHEN** the user checks two or more Creation set records and chooses Delete selected
- **THEN** checking records does not change the single record opened in the detail view
- **AND** the confirmation identifies the number of checked sets
- **AND** the browser submits the distinct checked set IDs in one request
- **AND** successful deletion clears those checked IDs and refreshes the record list

#### Scenario: User deletes all records matching a search filter
- **WHEN** the user enters a non-empty Creation record search query, optionally combines it with a time condition, and chooses Delete filtered with matching sets
- **THEN** the confirmation identifies the full number of matching sets and summarizes the active keyword and time filters
- **AND** the deletion target includes every matching set in the complete filtered collection, including matches beyond the visible list rendering limit
- **AND** records outside the filtered collection are preserved

#### Scenario: User deletes all records matching a time filter
- **WHEN** the user selects a non-default quick time window or an exact date with matching sets and chooses Delete filtered
- **THEN** the confirmation identifies the full number of matching sets and summarizes the active time filter
- **AND** the deletion target includes every matching set in the complete filtered collection, including matches beyond the visible list rendering limit
- **AND** records outside the filtered collection are preserved

#### Scenario: Search filter is empty or has no matches
- **WHEN** the keyword is empty, the quick time window is All, and the exact date is empty, or when the active keyword and time filters match no sets
- **THEN** Delete filtered is disabled
- **AND** the default filter state cannot be used as an implicit Delete all action
