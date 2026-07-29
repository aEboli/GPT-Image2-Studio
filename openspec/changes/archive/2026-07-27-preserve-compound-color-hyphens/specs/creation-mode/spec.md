## MODIFIED Requirements

### Requirement: SKU color labels cover visible characteristic component colors
Each reliable complete visible SKU unit SHALL have one ordered pure-color label. The label SHALL contain only reliable color names. Its characters MUST be limited to Unicode letters, numbers, spaces, and a single hyphen located between letters or numbers inside a recognized compound color name. Multiple separate colors inside one unit label SHALL be separated by single spaces only. A hyphen MUST NOT separate independent colors. The label MUST NOT contain commas, quotation marks, slashes, brackets, list markers, or any other punctuation, and it MUST NOT contain part names, materials, finishes, styles, model identifiers, product names, sizes, marketing words, or any other non-color text. Neutral colors shared by variants SHALL remain eligible, but the associated part names SHALL be removed. Multiple colors for one unit SHALL remain one structured value, while separate complete units SHALL remain separate ordered array values. Backgrounds, shadows, highlights, reflections, source-card text, and uncertain colors SHALL NOT be evidence. The system SHALL normalize analyzed, submitted, and historical labels before planning, and the SKU prompt SHALL render only the normalized color label below its unit in the target language.

#### Scenario: One subject has several characteristic component colors
- **WHEN** one complete SKU subject visibly has a brown exterior, a black strap, and silver lenses
- **THEN** reference analysis returns one color-label value `brown black silver` for that product unit
- **AND** the planned SKU prompt requests that exact color-only label below the subject without `exterior`, `strap`, `lenses`, quotation marks, commas, or other non-color characters

#### Scenario: A color name originally contains a hyphen
- **WHEN** a reliable recognized compound SKU color is supplied as `off-white`
- **THEN** the system preserves the visible label as `off-white`
- **AND** the internal hyphen remains because it belongs to the color name
- **AND** a hyphen used only between separate colors is removed and replaced by the normal single-space separator

#### Scenario: Grouped subjects each have multi-color labels
- **WHEN** one SKU subject image contains multiple complete visible product units and each unit has several characteristic colors
- **THEN** reference analysis returns exactly one ordered color-only label value per complete product unit
- **AND** each array value uses spaces between separate colors while retaining any recognized compound color's internal hyphen
- **AND** two units with the same colors retain two ordered label values instead of being deduplicated
- **AND** the planned SKU prompt places each complete label below its corresponding product unit without adding quotes, commas, bullets, indexes, or brackets to the visible text

#### Scenario: A visible neutral component is shared across variants
- **WHEN** each visible variant uses the same black strap or gray frame as a physical part of the sellable subject
- **THEN** `black` or `gray` remains eligible for every applicable color label
- **AND** `strap`, `frame`, and other part names do not appear in the visible label

#### Scenario: Submitted label contains non-color qualifiers
- **WHEN** analysis, browser input, or a historical record supplies a label such as `matte brown leather, black strap, silver lenses`
- **THEN** the system normalizes the label to `brown black silver` before building the SKU prompt
- **AND** no removed word or disallowed punctuation is rendered below the subject

#### Scenario: Color evidence is unsafe
- **WHEN** a possible color comes only from the background, shadow, highlight, environmental reflection, source-card text, an unclear region, or a value that cannot be reliably normalized as a color
- **THEN** reference analysis and local normalization exclude that possible color from the label
- **AND** if no reliable subject color remains, the planner does not request a guessed or fallback label
