## ADDED Requirements

### Requirement: Creation Mode shows set-level generation queue
The Creation Mode workbench SHALL show a compact queue strip for submitted image sets when a set is running or waiting.

#### Scenario: A set is currently generating
- **WHEN** a Creation Mode set is generating
- **THEN** the output panel shows that set in the queue strip as the current generation
- **AND** the main image grid displays that set's item-level progress

#### Scenario: Another set is queued
- **WHEN** the user submits a second Creation Mode set while one is already generating
- **THEN** the second set is added behind the active set
- **AND** the queue strip shows the waiting set as a compact pill labeled by queue order, such as "队列一" and "队列二"
- **AND** the queued set preview includes any SKU image cards derived from the submitted SKU subjects

### Requirement: Creation Mode keeps one set visible in the main grid
The Creation Mode main result grid SHALL display one selected set at a time instead of merging images from multiple queued sets.

#### Scenario: User selects a queued set
- **WHEN** the user clicks a queued set in the queue strip
- **THEN** the main grid switches to that set's queued preview cards
- **AND** the active generation continues without changing order

#### Scenario: A queued set finishes while another set starts
- **WHEN** one queued set completes and the next queued set starts generating
- **THEN** the completed set remains visible in the queue strip for the current browser session
- **AND** the user can switch back to the completed set without refreshing the page

### Requirement: Creation Mode can enqueue during generation
The Creation Mode primary generation action SHALL remain available for valid set submissions while another set is running, up to the configured queue limit.

#### Scenario: User submits while another set is running
- **WHEN** a Creation Mode set is already running
- **AND** the user submits valid product inputs for another set
- **THEN** the button communicates the queue action
- **AND** the app stores a snapshot of that set's form data for later execution
- **AND** the queued set starts after the active set finishes
