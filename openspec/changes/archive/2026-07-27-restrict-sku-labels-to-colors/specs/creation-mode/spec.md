## MODIFIED Requirements

### Requirement: SKU color labels cover visible characteristic component colors
Each reliable complete visible SKU unit SHALL have one ordered pure-color label. The label SHALL contain only reliable color names and the separators required between multiple colors. It MUST NOT contain part names, materials, finishes, styles, model identifiers, product names, sizes, marketing words, or any other non-color text. Neutral colors shared by variants SHALL remain eligible, but the associated part names SHALL be removed. Multiple colors for one unit SHALL remain one structured value. Backgrounds, shadows, highlights, reflections, source-card text, and uncertain colors SHALL NOT be evidence. The system SHALL normalize analyzed, submitted, and historical labels before planning, and the SKU prompt SHALL render only the normalized color label below its unit in the target language.

#### Scenario: One subject has several characteristic component colors
- **WHEN** one complete SKU subject visibly has a brown exterior, a black strap, and silver lenses
- **THEN** reference analysis returns one color-label value `brown, black, silver` for that product unit
- **AND** the planned SKU prompt requests that pure-color label below the subject without `exterior`, `strap`, `lenses`, or other non-color words

#### Scenario: Grouped subjects each have multi-color labels
- **WHEN** one SKU subject image contains multiple complete visible product units and each unit has several characteristic colors
- **THEN** reference analysis returns exactly one ordered pure-color label value per complete product unit
- **AND** separators between multiple colors inside one label do not create additional product-unit labels
- **AND** two units with the same colors retain two ordered label values instead of being deduplicated
- **AND** the planned SKU prompt places each complete pure-color label below its corresponding unit

#### Scenario: A visible neutral component is shared across variants
- **WHEN** each visible variant uses the same black strap or gray frame as a physical part of the sellable subject
- **THEN** `black` or `gray` remains eligible for every applicable color label
- **AND** `strap`, `frame`, and other part names do not appear in the visible label

#### Scenario: Submitted label contains non-color qualifiers
- **WHEN** analysis, browser input, or a historical record supplies a label such as `matte brown leather, black strap, silver lenses`
- **THEN** the system normalizes the label to `brown, black, silver` before building the SKU prompt
- **AND** no removed material, finish, or part word is rendered below the subject

#### Scenario: Color evidence is unsafe
- **WHEN** a possible color comes only from the background, shadow, highlight, environmental reflection, source-card text, an unclear region, or a value that cannot be reliably normalized as a color
- **THEN** reference analysis and local normalization exclude that possible color from the label
- **AND** if no reliable subject color remains, the planner does not request a guessed or fallback label
