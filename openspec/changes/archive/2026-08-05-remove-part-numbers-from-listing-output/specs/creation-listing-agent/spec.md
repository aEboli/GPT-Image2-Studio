## ADDED Requirements

### Requirement: Listing titles exclude internal part numbers
Newly generated and regenerated Listing drafts SHALL exclude internal product part numbers, SKU part numbers, and reference-only identifiers from `title` and `zhDisplay.title`. The generation prompt SHALL prohibit these identifiers in both titles, and normalization SHALL deterministically remove candidates derived from structured product and SKU sources before the completed draft is returned. This cleanup SHALL NOT remove or rewrite SKU IDs, reference filenames, associations, non-title Listing fields, or stored historical drafts.

#### Scenario: Product name contains an internal part number
- **WHEN** the source product name is `电动仿生米诺鱼饵 F4J16` and a generated response includes `F4J16` in both titles
- **THEN** the completed English `title` and Simplified Chinese `zhDisplay.title` do not contain `F4J16`
- **AND** the remaining product identity is retained and normalized without stray separators

#### Scenario: SKU metadata contains a reference-only identifier
- **WHEN** a SKU subject supplies an internal ID or reference filename containing a part-number token
- **THEN** the Listing prompt identifies that token as prohibited title content
- **AND** post-response normalization removes the token from both titles if the model returns it
- **AND** the SKU subject ID and reference filename remain available for internal association

#### Scenario: Historical Listing is opened
- **WHEN** a stored historical Listing title already contains an internal part number
- **THEN** merely opening or exporting that historical record does not rewrite the stored draft

#### Scenario: Part-number cleanup empties a generated title
- **WHEN** a generated title contains only a structured part number, including a compound identifier such as `F4J-16`
- **THEN** the system removes the complete identifier without leaving a numeric fragment
- **AND** it repairs the empty title from a sanitized source product identity or `Product` / `商品`
