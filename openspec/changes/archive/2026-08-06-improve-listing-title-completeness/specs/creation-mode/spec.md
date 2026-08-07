## ADDED Requirements

### Requirement: Browser and queue preserve safe SKU filename tokens

For each newly planned or locally queued SKU image, the system SHALL create a `filenameToken` from only the stable SKU sequence and an optional reliable normalized color label. Browser normalization SHALL preserve this token through generation and repair submissions. Local and Worker filename builders SHALL use the preserved token before any display title fallback. The token and new output filename MUST NOT contain the raw SKU title, SKU ID, product part number, or reference filename. Association metadata and generation prompts SHALL remain unchanged.

#### Scenario: Queued SKU has a part-number filename and no reliable color

- **WHEN** a newly queued SKU references `260526-SKU-151142-5714.png` and supplies no reliable color label
- **THEN** its display title is `SKU image 1`
- **AND** its `filenameToken` is `sku-1`
- **AND** browser normalization preserves `sku-1` for the generation request

#### Scenario: Queued SKU has a reliable color

- **WHEN** a newly queued second SKU supplies the reliable color label `blue`
- **THEN** its `filenameToken` is `sku-2-blue`
- **AND** the token contains no raw SKU title, ID, or reference filename

#### Scenario: Existing association metadata is retained

- **WHEN** a safe filename token is generated for a SKU item
- **THEN** the SKU ID, original reference filename, reference index, prompt, and image association remain available unchanged
