## MODIFIED Requirements

### Requirement: Evidence gates apply to appended SKU and package images

The system SHALL require at least two distinct, sourced sellable variants before enabling or generating appended SKU images. A grouped pair or multiple views of one sellable SKU SHALL count as one variant. The system SHALL require a verifiable included-items list or package fact for the `accessory-gift` item. Missing evidence SHALL mark the item skipped and MUST NOT enter upstream generation, automatic retry, repair generation, or item-specific reference upload.

#### Scenario: Single SKU disables appended SKU images

- **WHEN** the product has one sourced SKU, including one paired product with multiple units or multiple views
- **THEN** the SKU image control is disabled and unchecked
- **AND** the plan contains no appended SKU generation item
- **AND** a submitted or frozen plan cannot restore the item by changing `skuGenerationEnabled` alone

#### Scenario: Multiple sourced SKUs enable appended SKU images

- **WHEN** the product has at least two distinct sourced sellable variants
- **THEN** the SKU image control can be selected
- **AND** each verified variant may receive one appended SKU image

#### Scenario: Package image needs actual included-item evidence

- **WHEN** the product has no confirmed package fact and no explicit included-items list naming an item
- **THEN** `accessory-gift` is marked skipped with a package evidence requirement
- **AND** the image is excluded from generation and repair

### Requirement: Multi-angle and scene-fit roles have distinct visual duties

The multi-angle role SHALL request three or four clearly separated product views with identical product identity and complete sellable-unit part count. Scene-fit roles SHALL each describe one distinct use duty: environment fit and scale, one concrete hands or partial-body action, or a wider contextual use moment. Scene-fit and `brand-story` roles MUST require visible interaction, an observable active product state, or a concrete use action. They MUST NOT fall back to a product-only display, tabletop still life, flat lay, or centered unused product when an action or working-position description is available.

#### Scenario: Multi-angle image exposes more than front and back

- **WHEN** a multi-angle item is planned
- **THEN** its prompt requests a separated front three-quarter, rear three-quarter, side, and product-appropriate top, underside, or interface view
- **AND** every view preserves the same product and complete paired unit

#### Scenario: Scene-fit images are not duplicate still lifes

- **WHEN** multiple scene-fit items are planned
- **THEN** each item carries a distinct environment, core action, or framing duty
- **AND** the first scene-fit prompt does not describe a tabletop or staged still-life display

#### Scenario: Brand-story image carries brand feeling through use

- **WHEN** a `brand-story` item is planned
- **THEN** its prompt requires a real ownership or use moment with hands, a partial body, or an observable active product state
- **AND** its prompt forbids a product-only decorative display or tabletop still life

### Requirement: Saved creation records show analyst conclusions

The creation output detail area SHALL present saved product analysis as decision-oriented conclusions. When available, it SHALL show buyer motivation or concern, pain points, selling points, applicable scenarios, confirmed evidence, and unresolved information. It SHALL not use the primary detail area for reference filenames, reference-role summaries, platform, or generation metadata.

#### Scenario: Analyst conclusions replace record metadata

- **WHEN** a saved creation set contains `productInsights`
- **THEN** the output detail area is headed `分析师分析`
- **AND** it shows at least the available pain points, selling points, and usage scenarios
- **AND** it identifies the analysis basis and unresolved information when present

#### Scenario: Missing analysis is explicit

- **WHEN** a saved creation set has no usable product analysis
- **THEN** the output detail area explains that reference analysis must be run before those conclusions can be shown
