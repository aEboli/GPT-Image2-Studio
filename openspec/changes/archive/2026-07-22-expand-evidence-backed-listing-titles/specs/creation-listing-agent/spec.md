## MODIFIED Requirements

### Requirement: Platform V1 Listing titles communicate evidence-backed value
The system SHALL use the restored platform V1 Listing rules for the old-style bilingual fields. Selling points, pain points, five bullets, description, backend search terms, and keyword buckets SHALL retain the prior objective, attribute-only generation rules. The title and `zhDisplay.title` SHALL place the product identity early and SHALL include one supplied differentiating selling point plus the directly supported buyer pain point or purchase concern that the selling point resolves. After this required core, when traceable evidence and platform hard limits allow, the title SHALL add two to four distinct search-relevant or purchase-decision attributes selected from supplied quantity, visible construction, visible components, shape, color, variant, or package facts. Platform hard character and byte limits SHALL always take precedence; recommended length ranges SHALL remain readability targets rather than hard validation limits. Traceable title evidence SHALL include explicit product inputs and compact structured Creation planning evidence whose buyer motivation or use context is directly supported by its evidence focus or reference-image notes. Objections that only identify missing, disputed, or unverified information SHALL NOT become title evidence. The title SHALL NOT repeat concepts to fill space or invent a problem, result, function, effect, performance claim, or other fact that is absent from traceable product evidence.

#### Scenario: Platform V1 prompt restores the prior field rules
- **WHEN** a platform V1 Listing request is built
- **THEN** the prompt contains the prior Listing SEO, objective-attribute, fixed five-bullet, bilingual and platform-policy rules
- **AND** the objective-attribute and functional-wording restrictions explicitly apply to non-title fields while preserving the title-only value requirement

#### Scenario: Title communicates supplied value and a resolved pain point
- **WHEN** product evidence supplies a differentiating selling point and the buyer problem or purchase concern that it directly addresses
- **THEN** the title places the core product phrase near the beginning
- **AND** the title includes the supplied selling point and a concise statement of the directly supported pain point resolution
- **AND** a title containing only quantity, structure, color, model, or variant attributes is not considered compliant while such value evidence exists
- **AND** `zhDisplay.title` preserves the same facts and meaning

#### Scenario: Title adds supported decision attributes after the value phrase
- **WHEN** product evidence supplies at least two distinct search-relevant or purchase-decision attributes in addition to the required title value
- **AND** the resolved platform hard limits leave enough space
- **THEN** the title appends two to four of the strongest supplied attributes after the required core
- **AND** each appended attribute represents a different decision point
- **AND** the title does not repeat synonyms, restate the same value, add unsupported filler, or include prohibited dimensions and specifications
- **AND** `zhDisplay.title` preserves the same appended facts in the same order

#### Scenario: Platform length guidance conflicts with title completeness
- **WHEN** a platform supplies a hard title limit and a recommended title range
- **THEN** the generated title never exceeds the hard character or byte limit
- **AND** the recommended range guides readability but does not override required evidence-backed title content
- **AND** lower-priority appended attributes are omitted before product identity or the supported value relationship is removed

#### Scenario: Structured suite evidence supplies title value when manual fields are empty
- **WHEN** product description and manual selling points are empty
- **AND** saved Creation items contain structured motivation, audience or use context, and supporting evidence focus
- **THEN** the Listing source includes a bounded, deduplicated title-only evidence block with the source role
- **AND** it excludes objection text that only describes missing, disputed, or unverified facts
- **AND** the prompt requires the title to select only a candidate directly supported by product or reference evidence

#### Scenario: Evidence does not support a product outcome
- **WHEN** product evidence does not supply a functional problem or outcome
- **THEN** the title does not invent one
- **AND** it may instead express a purchase concern resolved by supplied quantity, option, variant, or package facts without adding title-prohibited dimensions or specifications

#### Scenario: Functional wording appears outside the title
- **WHEN** a platform V1 response contains functional or effect wording outside `title` and `zhDisplay.title`
- **THEN** the response is not retained as the direct result
- **AND** the deterministic conservative fallback is returned

#### Scenario: Title contains a high-risk claim
- **WHEN** a title contains an unsupported ranking, certification, medical, price, guarantee, refund, material, compatibility, performance, or other high-risk claim
- **THEN** the response is not retained as the direct result
- **AND** the deterministic conservative fallback is returned

#### Scenario: Transient upstream failure retains a safe recognized product identity
- **WHEN** a Chinese folding-wagon Listing request falls back after an upstream failure
- **AND** SKU or reference notes contain a disputed numeric claim such as `300KG`
- **THEN** the deterministic title identifies the product as a folding wagon cart
- **AND** it does not use the disputed numeric claim as the product identity or a title fact
