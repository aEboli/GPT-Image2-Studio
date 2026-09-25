## ADDED Requirements

### Requirement: Creation Mode uses one product information field

Creation Mode SHALL present one 商品描述 textarea for product description, selling points, and size specifications. The textarea SHALL retain the existing product-description height and placeholder, and controls below it SHALL follow the normal document flow. New plans SHALL use the complete textarea value as product description and SHALL continue extracting supported measurements from that value for dimension and specification roles. Reusing a historical set SHALL place its saved product description, selling points, and dimension specifications in the textarea without losing non-empty values.

#### Scenario: User enters combined product information

- **WHEN** the user submits a product description containing product facts, selling points, or supported measurements
- **THEN** the complete text is used as product information for planning
- **AND** supported measurements continue to populate the planned dimension specifications

#### Scenario: User reuses a historical set

- **WHEN** the user reuses a set that has separate saved product description, selling points, or dimension specifications
- **THEN** each non-empty value appears in the single 商品描述 textarea
- **AND** the original saved set remains unchanged
