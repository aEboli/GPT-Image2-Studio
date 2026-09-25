# image-to-prompt Specification

## MODIFIED Requirements

### Requirement: Prompt Kit provides a layered static template library

Prompt Kit SHALL provide exactly three top-level filter dimensions: “使用场景”, “风格” and “主体”, with the 41 second-level labels from the supplied screenshot. Every second-level category SHALL expose at least 20 distinct canonical source-backed template IDs before search filtering. A canonical source-backed template MAY appear in multiple second-level categories, but the same ID SHALL appear at most once in one filtered result and the all-items view SHALL contain each canonical ID once.

#### Scenario: User opens a populated screenshot category

- **WHEN** the user selects any of the 41 second-level categories
- **THEN** the library shows at least 20 distinct image-prompt pairs before search filtering
- **AND** every preview uses the complete prompt belonging to that same canonical source record

#### Scenario: User opens all items after category reuse

- **WHEN** the user clears the second-level filter
- **THEN** reused category placements collapse to one result per canonical ID
- **AND** the all-items view remains limited to the 41 canonical local pairs

### Requirement: Prompt library images and prompts remain paired

Every displayed placement SHALL reference one canonical local image and its complete matching prompt. Reusing a preview path across category scopes is allowed only when the stable ID and prompt are the same; no generated or unrelated fallback image may be used to satisfy category coverage.

#### Scenario: A canonical pair appears in multiple categories

- **WHEN** the same source-backed template is selected through two different second-level categories
- **THEN** both results use the same stable ID, local preview path and complete prompt
- **AND** the pair is still listed only once in the all-items view
