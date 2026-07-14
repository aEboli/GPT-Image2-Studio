## ADDED Requirements

### Requirement: Structured non-sensitive audience analysis
The system SHALL let Creation reference analysis return a normalized `audienceStrategy` containing a product-use or purchase-context audience, purchase motivations, purchase objections, desired outcome, evidence basis, confidence, and source. The analysis MUST use only supplied product facts, visible product/use evidence, platform context, and category context, and MUST NOT infer protected or sensitive personal attributes from people in reference images.

#### Scenario: Analysis returns evidence-backed audience guidance
- **WHEN** the user analyzes product references with a selected platform, category, and supplied product facts
- **THEN** the response includes a normalized audience strategy whose motivations and objections cite supplied or visible evidence and whose source and confidence are explicit

#### Scenario: Sensitive attributes are not inferred
- **WHEN** a reference image contains a person but the user did not explicitly provide demographic targeting
- **THEN** the analysis does not infer age, sex, gender identity, race, ethnicity, nationality, religion, health, disability, pregnancy, sexual orientation, income, or other sensitive attributes and falls back to a non-sensitive product-use context

#### Scenario: Uncertain audience stays conservative
- **WHEN** the product facts and references do not support a specific usage or buying context
- **THEN** the analysis returns a generic category buyer suggestion with low confidence instead of inventing a precise persona

### Requirement: Versioned platform marketing context
The system SHALL define a structured `marketingContext` for the universal profile and every supported platform profile, including shopper intent, proof style, copy style, default motivations, and default objections. Marketing context MUST remain advisory and MUST NOT be represented as an official platform rule unless independently covered by the existing sourced constraint model.

#### Scenario: Every platform has structured marketing context
- **WHEN** the platform policy registry is loaded
- **THEN** all supported platform profiles expose valid structured marketing context in addition to their existing sourced image policies

#### Scenario: Platform advice does not become a hard rule
- **WHEN** a profile marketing context has no official blocking source
- **THEN** it affects planning guidance only and does not create a blocking validation constraint

### Requirement: Deterministic audience strategy resolution
The system SHALL resolve `effectiveAudienceStrategy` using `universal fallback < platform marketing context < category context < reference-analysis suggestion < user set input < user item override`. Empty values MUST NOT erase lower-priority evidence, list fields MUST be normalized and de-duplicated, and the resolved result MUST record provenance.

#### Scenario: Reference analysis overrides platform fallback
- **WHEN** a platform default describes value-comparison shoppers and an applied reference analysis provides evidence for a gift-buying context
- **THEN** the effective strategy uses the evidence-backed gift context while retaining compatible platform proof and copy guidance

#### Scenario: User input overrides analysis suggestion
- **WHEN** a caller explicitly supplies a non-sensitive target audience or purchase objection after applying an analysis suggestion
- **THEN** the explicit user value becomes effective and its provenance is recorded as user input

#### Scenario: Item override affects one slot only
- **WHEN** a caller supplies a valid per-item conversion override
- **THEN** only the matching item changes and all other items keep their deterministic effective strategy

### Requirement: Per-item conversion intent
The system SHALL deterministically assign each planned item a `conversionIntent` containing audience focus, motivation focus, objection focus, conversion goal, and evidence focus. Different roles SHALL cover distinct buyer-decision jobs so the suite does not repeat the same generic selling-point board.

#### Scenario: Suite roles cover different decision jobs
- **WHEN** a suite contains hero, benefit, scene, detail, size, package, and SKU items
- **THEN** the hero handles recognition and the primary motivation, benefit and scene items show outcomes and use relevance, detail and size items reduce evidence or fit uncertainty, and package and SKU items reduce completeness or choice uncertainty

#### Scenario: Conversion intent is deterministic
- **WHEN** Local and Worker resolve the same normalized platform, category, audience strategy, overrides, and product evidence
- **THEN** they produce deeply equivalent effective audience strategies and per-item conversion intents in the same order

### Requirement: Evidence-bounded conversion prompts
The system SHALL include the effective per-item conversion intent in generated prompts while limiting every product claim, proof, outcome, and reassurance to supplied product facts or reference evidence. Missing evidence MUST produce a conservative question or visual emphasis instead of an invented fact.

#### Scenario: Prompt uses supplied motivation evidence
- **WHEN** the supplied facts support quick setup and the effective audience values convenience
- **THEN** the assigned benefit or usage prompt connects quick setup to convenience without adding unsupported setup time, performance numbers, certifications, reviews, or guarantees

#### Scenario: Prompt does not invent proof
- **WHEN** the effective audience has a durability objection but no material, test, warranty, or durability evidence is supplied
- **THEN** no item prompt invents durability proof, test results, warranty terms, ratings, sales, testimonials, or performance claims

### Requirement: Platform hard rules override conversion strategy
The system MUST apply official sourced blocking constraints and effective `textPolicy`, `logoPolicy`, and `scenePolicy` after all audience, conversion, set, item, and prompt overrides. A strict main image MUST NOT gain text, collage, external Logo, scene props, or unsupported claims from conversion guidance.

#### Scenario: Amazon main image remains strict
- **WHEN** an Amazon plan has a persuasive audience strategy and an Amazon main image slot
- **THEN** the main image remains a compliant white-background product image with no added marketing text, collage, external Logo, scene, or unsupported claim while later eligible images may use the conversion strategy

#### Scenario: Invalid item override remains blocked
- **WHEN** a per-item conversion or prompt override conflicts with a sourced blocking constraint
- **THEN** validation reports the conflict and generation is rejected

### Requirement: Audience strategy is part of the frozen effective plan
The system SHALL include original `audienceStrategy`, resolved `effectiveAudienceStrategy`, and every item's `conversionIntent` and final prompt in the versioned `effectivePlan`. Queue snapshots, Local manifests, record reuse, and repair MUST preserve these values without recomputing them from current form or current platform defaults.

#### Scenario: Queue submission freezes audience decisions
- **WHEN** a user previews a plan, submits it to the queue, and then changes platform, category, product fields, or reference analysis
- **THEN** the queued job retains the submitted audience strategy, item conversion intents, order, parameters, and prompts

#### Scenario: Saved set round-trips conversion fields
- **WHEN** a completed Local set is saved and loaded
- **THEN** its effective plan and item conversion fields are deeply equivalent to the submitted frozen values

#### Scenario: Repair reuses saved item intent
- **WHEN** a saved item is retried or repaired after current strategy defaults change
- **THEN** repair reuses the saved conversion intent, prompt, ratio, size, language, and platform constraints unless the user explicitly edits that item

### Requirement: Generation submits and validates the frozen plan
The browser SHALL submit the complete frozen `effectivePlan` for formal Creation generation. Local and Worker SHALL prefer a valid submitted snapshot over replanning, SHALL limit snapshot byte size and item count, SHALL normalize required fields, and SHALL recompute counts and validation from snapshot items without trusting client-supplied `canGenerate`, validation, or count fields.

#### Scenario: Formal generation uses previewed items
- **WHEN** a valid frozen plan is submitted after preview
- **THEN** Local and Worker execute the submitted item order, prompts, conversion intents, ratios, sizes, and languages without calling the current platform strategy to rebuild them

#### Scenario: Client cannot bypass hard-rule validation
- **WHEN** a submitted snapshot declares `canGenerate=true` but an item violates a sourced platform constraint
- **THEN** the server recomputes validation, rejects generation, and does not trust the client declaration

#### Scenario: Oversized or malformed snapshot is rejected
- **WHEN** a submitted snapshot exceeds the allowed byte or item limit or lacks required item identifiers, prompts, or generation parameters
- **THEN** Local and Worker reject the request with a compact validation error before image generation

#### Scenario: Legacy request replans
- **WHEN** an older client submits a generation request without `effectivePlan`
- **THEN** Local and Worker continue to build and validate a plan from the legacy fields

### Requirement: Runtime and metadata boundaries remain compatible
The system SHALL keep Local and Worker plan/generation results equivalent for the same normalized payload and SHALL keep full audience structures inside the set-level effective plan rather than per-image R2 custom metadata. Old manifests without audience fields MUST remain readable and MUST NOT be rewritten solely to add fallback strategy fields.

#### Scenario: Local and Worker remain equivalent
- **WHEN** the same audience-aware preview or generation payload is processed in Local and Worker environments
- **THEN** the effective audience strategy, per-item conversion intents, prompts, counts, validation, and generation parameters are deeply equivalent

#### Scenario: R2 metadata stays bounded
- **WHEN** Worker emits generated image metadata for an audience-aware suite
- **THEN** the full audience strategy is not copied into each image's R2 custom metadata and the existing metadata size limit remains satisfied

#### Scenario: Legacy manifest remains readable
- **WHEN** a Local manifest lacks `audienceStrategy`, `effectiveAudienceStrategy`, and `conversionIntent`
- **THEN** it loads with its historical items and prompts intact and only explicit replanning creates new audience-aware fields
