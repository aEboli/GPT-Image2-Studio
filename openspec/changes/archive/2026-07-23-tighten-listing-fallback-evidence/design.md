## Context

Platform V1 falls back to deterministic copy when an upstream Listing request fails or validation rejects output. The fallback can use translated aliases from saved Chinese reference notes and bounded buyer-decision evidence, but it cannot treat optional observations as implied by product identity.

## Decisions

### 1. Alias-gated specialized fallback

The localized thermal-scope profile is selected only for a recognized product identity and its core aliases. Optional mode names, control names, and search/detail language are emitted only when their own alias or structured buyer-decision evidence is present.

### 2. Evidence-first sparse fallback

When no buyer-decision profile exists, fallback fields use the supplied identity, quantity, variants, dimensions, or package detail only. They do not insert generic attribute categories to make the copy look complete.

### 3. Stable buyer-decision order

Specialized five-bullet fallback copy follows primary value, differentiating mode, supported use context, supported settings, then variant, quantity, or package clarity. English and Chinese use corresponding facts and ordering.

### 4. Parent identity precedence

Fallback identity resolution first uses an explicit parent/set product name (including the normalized `productName` field), then known identity aliases, and only then a SKU subject title. Values that contain only generic SKU or placeholder wording are not accepted as the product identity when a trusted parent identity is present. This keeps the specialized profile selectable even when generated SKU metadata is sparse or mislabeled.

### 5. Natural localized motorcycle-goggle copy

The motorcycle-goggle profile is selected only when the trusted product identity and its localized identity alias are both present. The 180-degree viewing window, PC lens, indirect vents, anti-fog coating, adjustable headband, soft frame, and nose pad are tested independently. Selling points explain the practical relevance of the supported details, pain points use concise declarative category friction without claiming competitor failure, and the five bullets assign supported facts to distinct viewing, lens, fit, airflow, and option or quantity decisions. Mixed saved quantities remain readable as separate pack choices such as `1 Pack / 4 Pack`.

### 6. Locale-safe forbidden-term normalization

Forbidden-term matching remains width-insensitive through Unicode compatibility normalization. After forbidden identities are removed, punctuation adjacent to Chinese text is restored to locale-appropriate commas, semicolons, and colons. Numeric ratios and other ASCII punctuation without adjacent Chinese text remain unchanged.

## Risks

- Less evidence can produce shorter copy. This is intentional: factual support overrides completeness targets.
- Alias detection can miss an unfamiliar translation. The generic evidence-bound fallback remains available rather than expanding claims.

## Verification

- Run focused Listing fallback tests and the serial full suite.
- Regenerate the saved localized motorcycle-goggle record after restart and inspect both languages.
