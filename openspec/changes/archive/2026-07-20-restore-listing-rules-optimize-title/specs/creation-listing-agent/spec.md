## REMOVED Requirements

### Requirement: Platform V1 Listing generation uses evidence-bounded conversion rules
The system SHALL use the evidence-bounded Listing prompt for platform V1 requests. The prompt SHALL adapt title, selling points, buyer objections, five highlights, description, search terms, and keyword buckets to the resolved platform policy and archetype while preserving the old-style bilingual field contract. The prompt SHALL allow a conservative benefit only when it follows directly from supplied product evidence, and SHALL instruct the model to omit unsupported facts rather than invent them.

#### Scenario: Evidence-backed benefit is retained
- **WHEN** a platform V1 response contains a conservative benefit directly supported by the product evidence
- **THEN** the completed draft preserves that benefit instead of replacing the response with the attribute-only fallback
- **AND** the five highlights use product-specific labels and cover distinct buyer decision questions

#### Scenario: High-risk claim is not retained
- **WHEN** a platform V1 response contains an unsupported ranking, certification, medical, price, guarantee, refund, or other high-risk claim
- **THEN** the response is rejected for the direct V1 result and the deterministic conservative fallback is returned

#### Scenario: Platform policy changes expression
- **WHEN** the same source is submitted for two platform archetypes
- **THEN** the prompt includes the resolved policy, locale, archetype guidance, and field-specific limits
- **AND** the outward old-style field names and bilingual structure remain unchanged

## ADDED Requirements

### Requirement: Platform V1 Listing titles communicate evidence-backed value
The system SHALL use the restored platform V1 Listing rules for the old-style bilingual fields. Selling points, pain points, five bullets, description, backend search terms, and keyword buckets SHALL retain the prior objective, attribute-only generation rules. The title and `zhDisplay.title` SHALL place the product identity early and SHALL include one supplied differentiating selling point plus the directly supported buyer pain point or purchase concern that the selling point resolves. The title SHALL NOT invent a problem, result, function, effect, performance claim, or other fact that is absent from traceable product evidence.

#### Scenario: Platform V1 prompt restores the prior field rules
- **WHEN** a platform V1 Listing request is built
- **THEN** the prompt contains the prior Listing SEO, objective-attribute, fixed five-bullet, bilingual and platform-policy rules
- **AND** non-title fields remain subject to the prior functional and effect wording restrictions

#### Scenario: Title communicates supplied value and a resolved pain point
- **WHEN** product evidence supplies a differentiating selling point and the buyer problem or purchase concern that it directly addresses
- **THEN** the title places the core product phrase near the beginning
- **AND** the title includes the supplied selling point and a concise statement of the directly supported pain point resolution
- **AND** `zhDisplay.title` preserves the same facts and meaning

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
