## ADDED Requirements

### Requirement: Gallery history pages contain two complete dates
The system SHALL paginate ordinary Waterfall Gallery history by two consecutive non-empty date sections and SHALL keep every image from each displayed date on the same page.

#### Scenario: User opens ordinary Gallery history
- **WHEN** filtered Gallery history contains images from three or more dates and no keyword search is active
- **THEN** the current page displays the next two non-empty dates in descending order
- **AND** every image belonging to those two dates is displayed
- **AND** the third and later dates are available through Gallery pagination

#### Scenario: Final history page contains one date
- **WHEN** only one date section remains on the final page
- **THEN** the system displays that complete date section
- **AND** Next page is unavailable

### Requirement: Desktop Gallery pages maximize thumbnail inspection within three rows
The system SHALL automatically allocate up to three total desktop image rows across the displayed date sections and choose a bounded column count for each section that enlarges sparse recent rows while preserving every image whenever the maximum supported column count makes that possible.

#### Scenario: Two dates fit in three rows
- **WHEN** the current desktop page contains two date sections whose image counts can fit within three total rows
- **THEN** the system reserves at least one row for each displayed date and assigns any remaining row to the denser date
- **AND** each date section uses the smallest bounded column count needed for its allocated rows
- **AND** the first row thumbnails are larger than they would be at an unnecessarily denser fixed layout

#### Scenario: A complete date cannot fit in three rows
- **WHEN** the current page still requires more than three total rows at the configured maximum column count
- **THEN** the affected section uses the supported maximum column count
- **AND** it preserves every image and does not split or truncate either displayed date

### Requirement: Gallery search and compact layouts preserve their specialized behavior
The system SHALL keep keyword search results unpaginated by the two-date rule and SHALL retain the established responsive column behavior for tablet and phone layouts.

#### Scenario: User searches Gallery history
- **WHEN** a non-empty keyword query is active
- **THEN** all matching date sections are available in the search result view without two-date history pagination
- **AND** the fixed column-count controls remain available for search density

#### Scenario: User opens Gallery on a compact viewport
- **WHEN** the Gallery uses tablet or phone layout
- **THEN** it uses the established compact responsive column count
- **AND** the document does not gain page-level horizontal overflow
