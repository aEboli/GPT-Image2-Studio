## ADDED Requirements

### Requirement: Prompt Kit cards avoid incomplete text and gaps

The Prompt Kit SHALL omit the card-level “复制到我的模板” action. In list view, a title or category that does not fit completely on one line SHALL be hidden, and a prompt that does not fit completely within the card SHALL be hidden. In image view, cards SHALL preserve image proportions, pack into a masonry layout, and show the full title and category below each image. The card-level “应用” action SHALL remain visible and visually prominent. Template-detail lightbox copy and apply actions SHALL remain available.

#### Scenario: Browse list cards with limited space

- **WHEN** a list card has a title, category, or prompt that cannot fit in its available area
- **THEN** the affected text is hidden in full instead of being clipped or truncated
- **AND** no copy-to-personal-template button is shown on the card

#### Scenario: Browse image cards

- **WHEN** the library is shown in image view
- **THEN** cards preserve their source image proportions and fill the columns without row-sized blank gaps
- **AND** each card shows its full title and category beneath the image
- **AND** its “应用” button is clearly visible

#### Scenario: Use template detail actions

- **WHEN** a user opens a template in the detail lightbox
- **THEN** the existing copy and apply actions remain available
