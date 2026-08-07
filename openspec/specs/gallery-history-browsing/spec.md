# Gallery History Browsing Specification

## Purpose

Define how Waterfall Gallery history is paginated and laid out for efficient image inspection across desktop and compact viewports.

## Requirements

### Requirement: Gallery history pages contain five complete dates
The system SHALL paginate ordinary Waterfall Gallery history by five consecutive non-empty date sections and SHALL keep every image from each displayed date on the same page.

#### Scenario: User opens ordinary Gallery history
- **WHEN** filtered Gallery history contains images from six or more dates and no keyword search is active
- **THEN** the current page displays the next five non-empty dates in descending order
- **AND** every image belonging to those five dates is displayed
- **AND** the sixth and later dates are available through Gallery pagination

#### Scenario: Final history page contains fewer than five dates
- **WHEN** one to five date sections remain on the final page
- **THEN** the system displays every remaining complete date section
- **AND** Next page is unavailable

### Requirement: Desktop Gallery pages maximize thumbnail inspection within three-row date pairs
The system SHALL calculate desktop thumbnail density in stable consecutive two-date groups across the complete filtered history, independently of the five-date page boundary. Each two-date group SHALL automatically allocate up to three total image rows and choose a bounded column count for each section, preserving the thumbnail size that the same date would receive under two-date browsing.

#### Scenario: Five-date page preserves two-date thumbnail sizing
- **WHEN** a desktop history page displays five dates
- **THEN** the first and second dates use one shared three-row layout calculation
- **AND** the third and fourth dates use the next shared three-row layout calculation
- **AND** the fifth date uses the layout calculated with the following chronological date when that date exists
- **AND** changing the page boundary does not change a date section's calculated column count

#### Scenario: Two dates fit in three rows
- **WHEN** a consecutive two-date group can fit all of its images within three total rows
- **THEN** the system reserves at least one row for each date and assigns any remaining row to the denser date
- **AND** each date section uses the smallest bounded column count needed for its allocated rows

#### Scenario: A complete date cannot fit in three rows
- **WHEN** a two-date group still requires more than three total rows at the configured maximum column count
- **THEN** the affected section uses the supported maximum column count
- **AND** it preserves every image and does not split or truncate either date

### Requirement: Gallery search and compact layouts preserve their specialized behavior
The system SHALL keep keyword search results unpaginated by the five-date rule and SHALL retain the established responsive column behavior for tablet and phone layouts.

#### Scenario: User searches Gallery history
- **WHEN** a non-empty keyword query is active
- **THEN** all matching date sections are available in the search result view without five-date history pagination
- **AND** the fixed column-count controls remain available for search density

#### Scenario: User opens Gallery on a compact viewport
- **WHEN** the Gallery uses tablet or phone layout
- **THEN** it uses the established compact responsive column count
- **AND** the document does not gain page-level horizontal overflow
