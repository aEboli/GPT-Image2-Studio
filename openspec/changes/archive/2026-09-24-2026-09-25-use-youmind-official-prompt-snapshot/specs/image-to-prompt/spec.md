# image-to-prompt Specification

## MODIFIED Requirements

### Requirement: The static Prompt Kit catalog uses official YouMind pairs

The static catalog SHALL contain the official YouMind GPT Image 2 snapshot records with one stable ID, one complete prompt, one local raster preview, one CMS media URL and one YouMind detail page per record. The shipped catalog SHALL not request YouMind at runtime. Every screenshot second-level category SHALL expose exactly 20 distinct canonical IDs before search filtering, and the all-items view SHALL expose each canonical ID once.

#### Scenario: User opens a second-level category

- **WHEN** the user selects any of the 41 screenshot second-level categories
- **THEN** the library shows 20 distinct official YouMind image-prompt pairs
- **AND** each pair uses the prompt and image from the same canonical record

#### Scenario: User opens all items

- **WHEN** the user clears the second-level filter
- **THEN** reused category placements collapse to one result per canonical ID
- **AND** all 126 official snapshot records remain available

#### Scenario: User browses offline

- **WHEN** the source website is unavailable after the catalog has been built
- **THEN** all official records remain available from bundled local modules and image files
- **AND** no generated or unrelated fallback image is inserted
