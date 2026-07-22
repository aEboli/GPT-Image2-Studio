## ADDED Requirements

### Requirement: Hard-information images use decision-meaningful visual structures

The system SHALL keep complete supplied dimension and package facts in the effective Creation plan while composing the specification-table image as a product-led explanation of no more than four distinct, purchase-relevant specification attributes and composing the accessory/gift image as an unpacked inventory of confirmed included items. It MUST NOT invent values, items, quantities, packaging, or containers.

#### Scenario: Specification evidence contains many or repeated measurements

- **WHEN** a Creation plan includes the specification-table role and the supplied dimension evidence contains many values or repeated attribute labels
- **THEN** the specification-table prompt selects no more than four different specification attributes for visible use
- **AND** the product remains the dominant visual subject with selected values anchored through measurement lines, local callouts, or compact explanatory modules
- **AND** the prompt forbids a full-canvas spreadsheet, database-like table, dense rows, and repeated same-label filler
- **AND** the effective plan retains the complete normalized dimension facts for records and other dimension roles

#### Scenario: A visible key specification is rendered

- **WHEN** the specification-table image uses a selected supplied value
- **THEN** its digits, decimal point, units, and selected metric/imperial mode remain exact
- **AND** the image does not add unsupported parameters or explain the value with an unsupported performance claim

#### Scenario: Included items are shown without packaging evidence

- **WHEN** a Creation plan includes the accessory/gift or platform `in-box` role and supplied facts identify the product and included accessories but do not prove retail packaging
- **THEN** the prompt requires an unpacked flat lay with the product and every confirmed item fully visible outside any container
- **AND** it forbids adding a cardboard box, shipping carton, paper tray, blister tray, molded insert, or other invented packaging
- **AND** quantities remain readable and no supplied item is hidden, cropped, merged, or omitted

#### Scenario: Packaging is a confirmed included item

- **WHEN** supplied input or an applied package reference explicitly proves that packaging, a storage case, or a gift box is included
- **THEN** the prompt may show that packaging as a separate secondary inventory item beside the unpacked contents
- **AND** it does not use the container as the default frame or place all products and accessories inside it unless the user explicitly requests that internal arrangement
