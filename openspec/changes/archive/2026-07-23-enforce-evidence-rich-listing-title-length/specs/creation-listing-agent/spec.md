## MODIFIED Requirements

### Requirement: Platform V1 Listing titles communicate evidence-backed value

The system SHALL preserve the existing platform V1 title behavior and old-style bilingual field contract. The title and `zhDisplay.title` SHALL place the product identity early and SHALL include one supplied differentiating selling point plus the directly supported buyer pain point or purchase concern that the selling point resolves. After this required core, when traceable evidence and platform hard limits allow, the title SHALL add distinct search-relevant or purchase-decision attributes selected from supplied quantity, visible construction, visible components, shape, color, variant, package, or use-context facts. When the resolved platform has no hard title limit below 120 English characters and the source supplies enough distinct traceable title facts to write naturally without repetition, the English title SHALL contain at least 120 characters after trimming. The system SHALL retain the existing quantity, identity, value, and pain-resolution core before using supported product details and a supported use context to reach that lower bound. Platform hard character and byte limits and factual support SHALL always take precedence; recommended length ranges SHALL remain readability targets rather than hard validation limits. Traceable title evidence SHALL include explicit product inputs and compact structured Creation planning evidence whose buyer motivation or use context is directly supported by its evidence focus or reference-image notes. Objections that only identify missing, disputed, or unverified information SHALL NOT become title evidence. The title SHALL NOT repeat concepts to fill space or invent a scene, problem, result, function, effect, performance claim, or other fact that is absent from traceable product evidence. `zhDisplay.title` SHALL preserve the same facts and order naturally but SHALL NOT be padded to reproduce the English character count. Non-title fields SHALL use the separate evidence-backed buyer-value requirement below instead of the former attribute-only restriction.

#### Scenario: Platform V1 prompt restores the prior field rules

- **WHEN** a platform V1 Listing request is built
- **THEN** the prompt retains the existing title ordering, evidence, completeness, bilingual, and platform-policy rules
- **AND** it applies evidence-backed buyer-value rules to non-title fields instead of the former objective-only and fixed-label restrictions
- **AND** title and `zhDisplay.title` remain aligned in identity, value, facts, quantity, and order

#### Scenario: Title communicates supplied value and a resolved pain point

- **WHEN** product evidence supplies a differentiating selling point and the buyer problem or purchase concern that it directly addresses
- **THEN** the title places the core product phrase near the beginning
- **AND** the title includes the supplied selling point and a concise statement of the directly supported pain point resolution
- **AND** a title containing only quantity, structure, color, model, or variant attributes is not considered compliant while such value evidence exists
- **AND** `zhDisplay.title` preserves the same facts and meaning

#### Scenario: Title adds supported decision attributes after the value phrase

- **WHEN** product evidence supplies at least two distinct search-relevant or purchase-decision attributes in addition to the required title value
- **AND** the resolved platform hard limits leave enough space
- **THEN** the title normally appends two to four of the strongest supplied attributes after the required core
- **AND** an evidence-rich title that qualifies for the 120-character lower bound may append additional distinct supplied facts until the lower bound is met
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
- **THEN** the Listing source includes a bounded, deduplicated evidence block with the source role
- **AND** it excludes objection text that only describes missing, disputed, or unverified facts
- **AND** the prompt requires the title to select only a candidate directly supported by product or reference evidence

#### Scenario: Evidence does not support a product outcome

- **WHEN** product evidence does not supply a functional problem or outcome
- **THEN** the title does not invent one
- **AND** it may instead express a purchase concern resolved by supplied quantity, option, variant, or package facts without adding title-prohibited dimensions or specifications

#### Scenario: Functional wording appears outside the title

- **WHEN** supplied evidence directly supports a conservative feature-to-benefit relationship outside `title` and `zhDisplay.title`
- **THEN** the Platform V1 response is not rejected solely because it contains that supported functional or benefit wording
- **AND** unsupported outcomes, performance claims, and existing high-risk claims still cause the direct response to be rejected

#### Scenario: Concrete low-risk attribute is not supplied

- **WHEN** a Platform V1 response adds a concrete attribute, construction detail, color, shape, material, or specific use context that is absent from traceable product and buyer-decision evidence
- **THEN** the direct model response is not retained
- **AND** a deterministic evidence-bound draft is returned without that unsupported detail

#### Scenario: Title contains a high-risk claim

- **WHEN** a title contains an unsupported ranking, certification, medical, price, guarantee, refund, material, compatibility, performance, or other high-risk claim
- **THEN** the response is not retained as the direct result
- **AND** the deterministic conservative fallback is returned

#### Scenario: Transient upstream failure retains a safe recognized product identity

- **WHEN** a localized Listing request falls back after an upstream failure
- **AND** SKU or reference notes contain a disputed numeric claim
- **THEN** a recognized product uses a conservative English identity alias that remains traceable to the supplied product identity
- **AND** it does not use the disputed numeric claim as the product identity or a title fact
- **AND** an unknown localized category falls back to a single generic `Product` identity without adjacent duplicate `Product` title segments

#### Scenario: Evidence-rich title reaches the explicit English lower bound

- **WHEN** the source supplies enough distinct traceable title facts to express a natural title of at least 120 English characters
- **AND** the resolved platform has no hard character or UTF-8 byte title limit below 120
- **THEN** the trimmed English title contains at least 120 characters
- **AND** the existing quantity, product identity, selling point, and pain-resolution core remains before the added details
- **AND** supported product details and a supported use context extend the title without repeated synonyms or generic filler
- **AND** `zhDisplay.title` preserves the same facts in the same order without mechanical character padding

#### Scenario: A short evidence-rich model title is not retained

- **WHEN** a platform V1 model response supplies fewer than 120 English title characters for a source that qualifies for the lower bound
- **THEN** the short model title is not retained as the completed Listing
- **AND** the system returns the evidence-bound deterministic fallback without another model retry
- **AND** the resulting English title satisfies the lower bound when the fallback evidence can do so

#### Scenario: Platform hard title limit is below the lower bound

- **WHEN** the resolved platform hard character or UTF-8 byte title limit is below 120
- **THEN** the platform hard limit takes precedence
- **AND** a title is not rejected solely because it contains fewer than 120 English characters

#### Scenario: Evidence cannot support 120 characters naturally

- **WHEN** the source supplies too few distinct title facts to reach 120 characters without repetition, padding, or invention
- **THEN** the system may return a shorter title
- **AND** it does not invent use contexts, attributes, benefits, package facts, or performance claims to satisfy the lower bound
