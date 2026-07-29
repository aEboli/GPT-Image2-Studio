## MODIFIED Requirements

### Requirement: Listing drafts expose sourced or estimated weight fields

Every newly generated or explicitly test-mocked Listing SHALL contain non-empty `packageWeight` and `productWeight` strings and matching Simplified Chinese fields under `zhDisplay`. Explicit package/gross/shipping weight evidence SHALL populate `packageWeight`; explicit product/net/item weight evidence SHALL populate `productWeight`. When the corresponding evidence is absent, the English field SHALL start with `Estimated:` and the Chinese field SHALL start with `预估：`. Weight fields SHALL follow the selected metric, imperial, or both unit mode and SHALL NOT be placed in the title.

#### Scenario: Product weight is supplied and package weight is absent
- **WHEN** source facts contain a product or net weight but no package, gross, packed, or shipping weight
- **THEN** `productWeight` reproduces the supplied weight in the selected unit mode without an estimate marker
- **AND** `packageWeight` contains a numeric conservative estimate marked `Estimated:`
- **AND** `zhDisplay.packageWeight` contains the same estimate marked `预估：`

#### Scenario: Package and product weights are supplied
- **WHEN** source facts explicitly identify both weight types
- **THEN** each field reproduces its corresponding source weight
- **AND** package weight is not copied into product weight or vice versa

#### Scenario: Neither weight type is supplied
- **WHEN** source facts provide no traceable weight value
- **THEN** both weight fields contain conservative numeric estimates
- **AND** both English values use `Estimated:` and both Chinese values use `预估：`

#### Scenario: Historical Listing predates weight fields
- **WHEN** a completed stored Listing lacks one or more weight fields
- **THEN** the read response fills the missing fields from set-level weight evidence or explicit estimates
- **AND** the stored historical Listing is not rewritten automatically

#### Scenario: Weight is copied or exported
- **WHEN** a Listing is displayed, copied as full text, or exported as structured JSON
- **THEN** package dimensions and package weight appear in one package specification section
- **AND** product dimensions and product weight appear in one product specification section
- **AND** each section places dimensions before weight in English and Simplified Chinese
- **AND** structured JSON retains `packageDimensions`, `packageWeight`, `productDimensions`, and `productWeight` as independent fields with matching Simplified Chinese fields
- **AND** no combined display string replaces those source fields
