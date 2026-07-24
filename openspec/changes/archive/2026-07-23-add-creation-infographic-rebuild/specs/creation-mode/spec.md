## ADDED Requirements

### Requirement: Source-only infographic rebuild overrides suite-wide prompt decoration
Creation Mode SHALL treat `infographic-rebuild` as a source-only reconstruction item. Requirements that normally apply shared visual language, marketing scenario, target language, reference-analysis notes, platform or category guidance, audience strategy, conversion intent, product facts, subject references, or Logo references to every planned item SHALL apply only to eligible carousel and SKU items and SHALL NOT alter an `infographic-rebuild` prompt or its reference-image collection.

Requirements that normally execute a frozen or saved item prompt unchanged SHALL preserve the stored item metadata for record compatibility, but generation and repair MUST replace an `infographic-rebuild` runtime prompt with the canonical source-only reconstruction prompt. Its saved technical parameters remain frozen and MUST NOT be recomputed from the current form.

#### Scenario: Shared Creation settings change
- **WHEN** a user changes any shared Creation setting while an information source image and its rebuild item remain the same
- **THEN** eligible carousel and SKU prompts may reflect the changed setting
- **AND** the infographic rebuild prompt and its one-image source collection remain unchanged
- **AND** the rebuild item continues using its own frozen technical generation parameters

#### Scenario: Historical saved prompt contains suite decoration
- **WHEN** a frozen plan or saved record contains an `infographic-rebuild` prompt with product, platform, language, visual-style, Logo, audience, conversion, or reference-note instructions
- **THEN** Local generation, Worker generation, and Local repair execute the canonical source-only reconstruction prompt instead
- **AND** they retain the item's saved model route, model, ratio, size, quality, format, reasoning, source identity, and compatible conversion metadata
