## ADDED Requirements

### Requirement: Creation set records can be deleted individually or in explicit batches
The system SHALL let users permanently delete the current Creation set record, an explicitly checked group of Creation set records, or every Creation set record matching the current non-empty search query. Each deletion SHALL remove the set manifest, its dedicated generated-image directory, and its corresponding JSON metadata directory without deleting another set or an output root.

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
- **WHEN** the user enters a non-empty Creation record search query with matching sets and chooses Delete filtered
- **THEN** the confirmation identifies the full number of matching sets and the search query
- **AND** the deletion target includes every matching set in the complete filtered collection, including matches beyond the visible list rendering limit
- **AND** records outside the filtered collection are preserved

#### Scenario: Search filter is empty or has no matches
- **WHEN** the Creation record search query is empty or matches no sets
- **THEN** Delete filtered is disabled
- **AND** an empty query cannot be used as an implicit Delete all action

### Requirement: Creation record deletion is confirmed and path-safe
The system SHALL present an application-modal confirmation before any Creation record deletion, SHALL send a bounded non-empty list of distinct set IDs, and SHALL resolve every recursive filesystem deletion as a non-root descendant of the configured output directory. Deletion SHALL be idempotent for records that no longer exist and SHALL NOT race a browser-known active Creation generation or planning operation.

#### Scenario: User cancels deletion
- **WHEN** the deletion confirmation is dismissed, cancelled, or closed with Escape
- **THEN** no deletion request is sent
- **AND** all records, generated files, metadata, selection, and filters remain unchanged

#### Scenario: Requested ID does not exactly match its manifest
- **WHEN** a requested set ID resolves through filename sanitization to a manifest whose stored set ID is different
- **THEN** the store does not delete that manifest or any referenced directory
- **AND** the requested ID is reported as not found

#### Scenario: Manifest contains an unsafe output directory
- **WHEN** a manifest has an empty, root, absolute, traversing, or otherwise out-of-root `relativeDir`
- **THEN** the store does not recursively delete that directory
- **AND** no other output directory is affected

#### Scenario: Creation work is active
- **WHEN** Creation planning, generation, or another record deletion is active in the browser
- **THEN** all Creation record deletion commands are disabled
- **AND** the browser does not start a competing delete request

#### Scenario: Cloudflare receives a record deletion request
- **WHEN** the Cloudflare runtime receives a valid Creation set deletion request but has no server-side Creation record store
- **THEN** it returns an idempotent success for the submitted distinct set IDs
- **AND** the browser removes matching current-session records without assuming local filesystem deletion
