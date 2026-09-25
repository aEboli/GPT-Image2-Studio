## MODIFIED Requirements

### Requirement: Prompt Kit provides a layered static template library

Prompt Kit SHALL provide a static library with exactly three top-level filter dimensions: “使用场景”, “风格” and “主体”. Their second-level labels SHALL match the user-provided screenshot: 使用场景 SHALL contain 10 labels, 风格 SHALL contain 16 labels, and 主体 SHALL contain 15 labels. Each source-backed template SHALL have one stable ID, one non-empty name, one complete non-empty prompt and one unique local raster preview. Each template SHALL map to exactly one second-level category in each top-level dimension. The library SHALL be shipped with the application and SHALL NOT request the referenced third-party site at runtime. The all-items view SHALL contain each stable template ID once.

#### Scenario: User opens the template library

- **WHEN** the user opens Prompt Kit
- **THEN** the library shows the three top-level dimensions and all 41 screenshot labels under their matching dimension
- **AND** the default selected dimension is 使用场景 with no second-level filter selected
- **AND** the all-items result contains 41 unique paired templates

#### Scenario: User filters a paired template by each dimension

- **WHEN** the user selects the matching second-level category under 使用场景, 风格 or 主体
- **THEN** the same stable template ID, local image and prompt are returned for every matching dimension
- **AND** the template is not duplicated within any one dimension

#### Scenario: User selects a second-level category

- **WHEN** the user selects a second-level category under one of the three dimensions
- **THEN** the library shows exactly the source-backed entries mapped to that category before search filtering
- **AND** each result exposes its stable name, complete prompt and paired local preview

#### Scenario: A category has no matching source-backed template

- **WHEN** the user selects a second-level category with no verified matching entry
- **THEN** the library shows no matching template
- **AND** the system does not fill the category with an unrelated or generated preview

### Requirement: Prompt library images and prompts remain paired

Every library entry SHALL use exactly one local preview image and the complete prompt belonging to that same record. Every displayed entry SHALL have a unique stable ID and preview path. The library SHALL omit entries without either a local image or non-empty prompt, and SHALL NOT use positional cycling, generic generated previews or unrelated fallback images. Existing YouMind source records SHALL retain their source attribution. User-provided source material SHALL retain the provided image and prompt as one local record.

#### Scenario: User browses YouMind-backed profile templates

- **WHEN** the user opens a category containing a YouMind-backed entry
- **THEN** each local preview maps to its matching source name and prompt
- **AND** the image and prompt retain their source detail-page attribution
- **AND** no preview path is reused by another entry

#### Scenario: User browses the supplied kitchen example

- **WHEN** the user selects personal avatar, photography or portrait/selfie filters
- **THEN** the kitchen apron image appears with the complete supplied kitchen prompt
- **AND** the entry appears only once in the all-items view

#### Scenario: User browses an offline non-profile template

- **WHEN** the user browses the supplied kitchen example while the source website is unavailable
- **THEN** its local preview remains paired with the complete supplied prompt
- **AND** the library does not substitute a generated preview

#### Scenario: The library loads offline

- **WHEN** the application runs without access to the source website
- **THEN** all 41 verified image and prompt records remain available from bundled local files
