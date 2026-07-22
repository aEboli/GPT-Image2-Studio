## ADDED Requirements

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
