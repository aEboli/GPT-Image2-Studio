## ADDED Requirements

### Requirement: SKU color labels cover visible characteristic component colors
Each reliable complete visible SKU unit SHALL have one ordered characteristic-color label. The label SHALL include every clear subject color, including neutral parts shared by variants, and a short part name when needed. Multiple colors for one unit SHALL remain one structured value. Backgrounds, shadows, highlights, reflections, source-card text, and uncertain colors SHALL NOT be evidence. The SKU prompt SHALL render the whole label below its unit in the target language.

#### Scenario: One subject has several characteristic component colors
- **WHEN** one complete SKU subject visibly has a brown exterior, a black strap, and silver lenses
- **THEN** reference analysis returns one color-label value for that product unit covering brown, black, and silver lenses
- **AND** the planned SKU prompt requests one complete label below the subject containing all three characteristic colors

#### Scenario: Grouped subjects each have multi-color labels
- **WHEN** one SKU subject image contains multiple complete visible product units and each unit has several characteristic component colors
- **THEN** reference analysis returns exactly one ordered label value per complete product unit
- **AND** commas or component qualifiers inside one label do not create additional product-unit labels
- **AND** two units with the same characteristic colors retain two ordered label values instead of being deduplicated
- **AND** the planned SKU prompt places each complete label below its corresponding unit

#### Scenario: A visible neutral component is shared across variants
- **WHEN** each visible variant uses the same black strap or gray frame as a physical part of the sellable subject
- **THEN** the shared neutral component color remains eligible for every applicable characteristic-color label
- **AND** it is not discarded merely because all variants share it

#### Scenario: Color evidence is unsafe
- **WHEN** a possible color comes only from the background, shadow, highlight, environmental reflection, source-card text, or an unclear region
- **THEN** reference analysis excludes that possible color from the characteristic-color label
- **AND** if no reliable subject color remains, the planner does not request a guessed color label
