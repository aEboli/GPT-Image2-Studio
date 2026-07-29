## ADDED Requirements

### Requirement: Article, Portrait, and PPT records can be filtered by creation time
The system SHALL let users filter Article Illustration sets, Portrait sets, and PPT records by their exposed `createdAt` value using All, Today, Recent 7 days, Older, or one exact local calendar date. All SHALL retain records regardless of missing or invalid timestamps, while bounded quick windows and exact dates SHALL use local calendar-day semantics.

#### Scenario: User selects a quick time window
- **WHEN** the user selects Today, Recent 7 days, or Older on an Article, Portrait, or PPT record page
- **THEN** the system matches records created today, from today through six local calendar days ago, or at least seven local calendar days ago respectively
- **AND** invalid or future timestamps do not match a bounded quick window
- **AND** selecting a non-default quick window clears an exact-date filter

#### Scenario: User selects an exact date
- **WHEN** the user enters a valid exact calendar date
- **THEN** the system matches records whose `createdAt` falls on that local calendar date
- **AND** the quick time window returns to All so the exact date is the only active time condition

#### Scenario: User returns to All
- **WHEN** the user clears all time conditions or activates Clear filters
- **THEN** all loaded records, including records with missing or invalid timestamps, are available again

### Requirement: Asset record filters drive one consistent view collection
The system SHALL derive the record count, empty state, current detail, visible list, and deletion selection order from the same complete filtered collection. Article and Portrait keyword searches SHALL combine with time filters using AND semantics, while PPT SHALL apply its time filter to the complete loaded deck collection.

#### Scenario: Keyword and time filters are combined
- **WHEN** an Article or Portrait user enters a keyword and selects an explicit time condition
- **THEN** only records matching both the keyword and the time condition are visible and counted
- **AND** the current detail belongs to that same combined result

#### Scenario: Current record leaves the filtered collection
- **WHEN** a filter change excludes the current Article, Portrait, or PPT record
- **THEN** the first surviving filtered record becomes current
- **AND** the detail becomes empty when no filtered record survives

#### Scenario: Active filters have no matches
- **WHEN** the active keyword and time conditions match no records
- **THEN** the page reports a filtered no-results state instead of an unfiltered no-data state
- **AND** the total loaded collection remains unchanged

#### Scenario: User clears page filters
- **WHEN** the user activates Clear filters
- **THEN** the keyword where present, quick time, and exact date controls return to their defaults
- **AND** the complete loaded collection becomes available without a server reload

### Requirement: Time filter controls remain operable across supported layouts
The system SHALL expose the same named time choices, native date input, and Clear filters command on Article, Portrait, and PPT record pages without hiding the existing Delete current and Delete selected commands.

#### Scenario: User opens an asset page on a narrow viewport
- **WHEN** the Article, Portrait, or PPT record page is rendered in the mobile layout
- **THEN** all quick time choices, the date input, and Clear filters remain inside the viewport and operable
- **AND** Delete current and Delete selected remain discoverable in the page actions
