## ADDED Requirements

### Requirement: Deterministic Listing fallbacks preserve traceable evidence

When Platform V1 falls back after an upstream failure or rejected response, every public English and Simplified Chinese field SHALL use only traceable product facts, explicit translated aliases, or bounded buyer-decision evidence. A specialized fallback SHALL gate every optional mode, control, component, use-context, and package statement on the evidence that supports that exact statement. Sparse fallback copy SHALL prefer shorter fact-only fields over generic attribute-group filler. Specialized five bullets SHALL cover distinct buyer-decision roles and shall use confirmed variant, quantity, or package facts for the final role when available. The English and Chinese fallback fields SHALL preserve corresponding facts, quantities, and ordering.

#### Scenario: Localized specialized fallback omits absent optional aliases

- **WHEN** a recognized localized product has core aliases but lacks an optional viewing mode, component, reticle control, or structured search-and-detail evidence
- **THEN** the English and Chinese fallback fields do not state that absent optional fact
- **AND** they retain only supported core aliases, controls, fields of view, or display values

#### Scenario: Localized specialized fallback uses confirmed decision roles

- **WHEN** a recognized localized product has translated aliases and a confirmed package quantity
- **THEN** its five fallback bullets cover primary value, differentiating mode, supported use context, supported settings, and package quantity in that order
- **AND** English and Chinese bullets preserve the same supported decision facts

#### Scenario: Sparse fallback avoids generic attribute filler

- **WHEN** a fallback source supplies only product identity and package quantity
- **THEN** public copy states only those supported facts
- **AND** it does not claim listed color, shape, dimensions, variants, package contents, or other unsupplied attribute groups

#### Scenario: Fallback preserves the parent product identity over a generic SKU title

- **WHEN** a fallback source supplies a trusted parent `productName` but a SKU subject title contains only generic wording such as `1 SKU 1 SKU`
- **THEN** the English and Chinese fallback titles use the parent product identity
- **AND** specialized evidence-bound copy is selected from the parent identity when its aliases are present
- **AND** no generic SKU placeholder is published as the product name

#### Scenario: Localized motorcycle-goggle fallback explains supported buyer value

- **WHEN** a recognized localized motorcycle-goggle product supplies exact aliases for its viewing, lens, airflow, fog, fit, option, or quantity details
- **THEN** its fallback selling points explain why the supported product details matter in natural storefront language
- **AND** its pain points state real category shopping or use friction as declarative sentences without alleging competitor failure
- **AND** its five bullets assign distinct supported facts to viewing value, lens construction, fit, airflow or fog details, and option or quantity clarity
- **AND** English and Simplified Chinese fields preserve corresponding facts, order, quantities, and units

#### Scenario: Localized motorcycle-goggle fallback omits each absent detail

- **WHEN** the localized motorcycle-goggle evidence omits an optional viewing, lens, vent, anti-fog, headband, frame, or nose-pad alias
- **THEN** the English and Chinese fallback fields do not state that absent detail or a benefit derived from it
- **AND** remaining fields use only other supplied aliases, variants, and package quantities
- **AND** mixed saved quantities such as one-unit and four-unit SKU subjects remain separate readable pack options rather than a merged numeric claim

#### Scenario: Localized fallback sanitization preserves natural Chinese punctuation

- **WHEN** forbidden identity terms are normalized and removed from a fallback that contains Simplified Chinese prose
- **THEN** Chinese commas, semicolons, and bullet-label colons remain locale-appropriate in the completed `zhDisplay` fields
- **AND** the sanitization still removes full-width or half-width forms of forbidden identities
- **AND** ASCII punctuation in numeric ratios or technical identifiers without adjacent Chinese text is not rewritten
