## MODIFIED Requirements

### Requirement: SKU color labels cover visible characteristic component colors
Each reliable complete visible SKU unit SHALL have one ordered pure-color label. The label SHALL contain only reliable color names, and its characters MUST be limited to Unicode letters, numbers, and spaces. Multiple colors inside one unit label SHALL be separated by single spaces only. The label MUST NOT contain commas, quotation marks, hyphens, slashes, brackets, list markers, or any other punctuation, and it MUST NOT contain part names, materials, finishes, styles, model identifiers, product names, sizes, marketing words, or any other non-color text. Neutral colors shared by variants SHALL remain eligible, but the associated part names SHALL be removed. Multiple colors for one unit SHALL remain one structured value, while separate complete units SHALL remain separate ordered array values. Backgrounds, shadows, highlights, reflections, source-card text, and uncertain colors SHALL NOT be evidence. The system SHALL normalize analyzed, submitted, and historical labels before planning, and the SKU prompt SHALL render only the normalized punctuation-free color label below its unit in the target language.

#### Scenario: One subject has several characteristic component colors
- **WHEN** one complete SKU subject visibly has a brown exterior, a black strap, and silver lenses
- **THEN** reference analysis returns one color-label value `brown black silver` for that product unit
- **AND** the planned SKU prompt requests that exact punctuation-free color label below the subject without `exterior`, `strap`, `lenses`, quotation marks, commas, or other non-color characters

#### Scenario: A color name originally contains a hyphen
- **WHEN** a reliable SKU color is supplied as `off-white` or another recognized hyphenated alias
- **THEN** the system normalizes the visible label to `off white`
- **AND** no hyphen or replacement punctuation is rendered

#### Scenario: Grouped subjects each have multi-color labels
- **WHEN** one SKU subject image contains multiple complete visible product units and each unit has several characteristic colors
- **THEN** reference analysis returns exactly one ordered punctuation-free color-label value per complete product unit
- **AND** each array value uses spaces only between its color words
- **AND** two units with the same colors retain two ordered label values instead of being deduplicated
- **AND** the planned SKU prompt places each complete label below its corresponding product unit without adding quotes, commas, bullets, indexes, or brackets to the visible text

#### Scenario: A visible neutral component is shared across variants
- **WHEN** each visible variant uses the same black strap or gray frame as a physical part of the sellable subject
- **THEN** `black` or `gray` remains eligible for every applicable color label
- **AND** `strap`, `frame`, and other part names do not appear in the visible label

#### Scenario: Submitted label contains non-color qualifiers
- **WHEN** analysis, browser input, or a historical record supplies a label such as `matte brown leather, black strap, silver lenses`
- **THEN** the system normalizes the label to `brown black silver` before building the SKU prompt
- **AND** no removed word or punctuation is rendered below the subject

#### Scenario: Color evidence is unsafe
- **WHEN** a possible color comes only from the background, shadow, highlight, environmental reflection, source-card text, an unclear region, or a value that cannot be reliably normalized as a color
- **THEN** reference analysis and local normalization exclude that possible color from the label
- **AND** if no reliable subject color remains, the planner does not request a guessed or fallback label
