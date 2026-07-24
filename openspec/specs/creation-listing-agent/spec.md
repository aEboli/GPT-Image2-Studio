# creation-listing-agent Specification

## Purpose
TBD - created by archiving change add-creation-listing-agent. Update Purpose after archive.
## Requirements
### Requirement: Listing output uses SKU subjects for variants and quantity
The system SHALL generate one parent listing draft for the Creation set, using distinct sellable SKU subjects as variant metadata and quantity evidence. If no SKU subjects exist, the system SHALL generate one main-product listing draft.

#### Scenario: Creation set has SKU subjects
- **WHEN** a Creation set manifest contains three `skuSubjects`
- **THEN** the Listing Agent generates one parent listing draft
- **AND** the draft preserves the three SKU subjects as variant metadata
- **AND** the draft title does not fall back to `1 Pack` when the subjects indicate three complete sellable units

#### Scenario: Creation set has no SKU subjects
- **WHEN** a Creation set manifest has no distinct SKU subjects
- **THEN** the Listing Agent generates one main-product listing draft

### Requirement: Listing generation degrades when generated images fail
The system SHALL use completed generated images when available and SHALL fall back to product inputs and manifest metadata when images are missing or failed.

#### Scenario: Relevant generated images are available
- **WHEN** the Creation set has completed generated images relevant to a SKU
- **THEN** the Listing Agent uses those images as visual evidence
- **AND** the saved draft marks `evidenceMode` as `image-backed` or `mixed`

#### Scenario: Generated images fail
- **WHEN** all generated images for a Creation set fail or are missing
- **THEN** the Listing Agent still generates conservative listing drafts from product name, description, selling points, dimensions, category path, SKU subjects, reference-role notes, planned prompts, and saved copy metadata
- **AND** each saved draft marks `evidenceMode` as `input-only`
- **AND** the draft includes a warning that generated images were unavailable

### Requirement: Listing fields obey strict length limits
The system SHALL enforce a maximum of 500 characters for every generated field and every generated bullet item.

#### Scenario: Model returns overlong copy
- **WHEN** the model returns a title, description, backend search terms, selling point, pain point, keyword item, or bullet longer than 500 characters
- **THEN** the validator rejects or rewrites the output
- **AND** the final visible draft does not show any generated field or bullet over 500 characters

### Requirement: Listing drafts are reviewable and exportable
The system SHALL display listing drafts in Creation record details and SHALL provide copy and export actions without exposing local absolute paths or secrets.

#### Scenario: User reviews generated listings
- **WHEN** listing drafts exist for a Creation set
- **THEN** the Creation record detail shows each listing draft with title, selling points, pain points, five bullets, description, backend search terms, keyword buckets, evidence mode, warnings, and missing information

#### Scenario: User exports listing drafts
- **WHEN** the user exports listing drafts
- **THEN** the app downloads a structured JSON file for the selected Creation set
- **AND** the export excludes API keys and local absolute paths

### Requirement: Creation Mode supports direct Listing generation for every platform
The system SHALL allow Listing generation for all 19 canonical platforms and legacy manifests. Each request SHALL resolve the saved platform and locale, use that platform's Listing policy, and return one directly usable draft without publishing to any marketplace or changing the Creation image result.

#### Scenario: User enables Listing Agent before generation
- **WHEN** the user enables the Listing Agent switch before generating a Creation Mode set
- **THEN** the system attempts to generate a Listing draft after the Creation set finishes
- **AND** Listing generation does not block or fail the image-generation workflow

#### Scenario: User runs Listing Agent from a saved record
- **WHEN** the user opens a saved Creation set record and starts Listing generation
- **THEN** the system generates or rewrites a Listing draft for that selected set
- **AND** the generated draft is saved with the Creation set manifest

#### Scenario: User generates Listing for a supported platform
- **WHEN** the user enables Listing generation or starts it from a saved Creation record
- **THEN** the system uses that record's resolved platform, locale and current Listing policy
- **AND** platform-specific guidance changes the generated content rather than the outward field structure
- **AND** Listing failure does not turn a usable image set into a failed set

#### Scenario: User generates Listing for a legacy or unknown platform record
- **WHEN** platform metadata is missing or cannot be resolved
- **THEN** the system uses the conservative universal content policy
- **AND** it still returns the same old-style Listing field contract

### Requirement: Platform policies produce different content without changing fields
The system SHALL keep one versioned Listing policy for each canonical platform and SHALL use platform-specific title emphasis, conversion order, search intent, locale guidance and field content. Platform rules SHALL NOT rename, remove, add or reorder the old-style outward fields.

#### Scenario: Title includes quantity but excludes dimensions
- **WHEN** an Amazon US Listing draft is generated from product input with a known quantity and dimension
- **THEN** the title begins with the quantity
- **AND** the title does not include size, dimensions, weight, hook size, model specs, or measurement values
- **AND** remaining title terms prioritize core search terms, long-tail terms, traffic terms, and descriptive terms

#### Scenario: Keyword output is generated
- **WHEN** backend search terms and keyword buckets are generated
- **THEN** backend search terms are non-empty and include relevant core, long-tail, traffic, and descriptive terms
- **AND** keyword buckets include exact, long-tail, traffic, and descriptive groups
- **AND** keywords are deduplicated case-insensitively
- **AND** competitor brand terms and unsupported claims are removed

#### Scenario: Two platforms receive the same product facts
- **WHEN** the same normalized product source is generated for two different canonical platforms
- **THEN** their prompts include different platform policy instructions
- **AND** their resulting field content may differ according to those policies
- **AND** both results expose the identical old-style field names and bilingual structure

#### Scenario: Low-evidence platform policy is used
- **WHEN** a platform lacks reliable public evidence for an exact rule
- **THEN** the policy uses conservative writing guidance
- **AND** no validation or review state blocks the generated draft

### Requirement: New Listing drafts use the old-style bilingual field contract
Every successfully generated or explicitly test-mocked Listing SHALL contain `title`, `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, and a Simplified Chinese `zhDisplay` with the same field value types. `keywordBuckets` SHALL contain `exact`, `longTail`, `traffic`, and `descriptive` arrays in both languages. The system SHALL allow keyword strings or buckets to become empty and bilingual list counts to differ when normalization or low-risk term removal deletes unusable content. A failed real generation SHALL NOT create a Listing draft.

#### Scenario: A new Listing is generated
- **WHEN** the model returns a Listing that passes parsing, normalization, minimum bilingual structure, low-risk term sanitization, and high-risk safety checks
- **THEN** English content is stored in the top-level old-style fields
- **AND** Simplified Chinese content is stored in matching `zhDisplay` field types
- **AND** the status is `completed`

#### Scenario: Low-risk terms are removed from generated content
- **WHEN** normalization finds an unsupported low-risk concrete attribute, material, color, shape, construction, mode, or use-context term
- **THEN** the system removes that term from public Listing fields before returning the draft
- **AND** empty search terms or keyword entries do not make the generation fail

#### Scenario: Explicit test mock mode is used
- **WHEN** a test directly enables the explicit mock mode
- **THEN** the mock uses the old-style bilingual field contract
- **AND** a real request failure never enables that mode implicitly

#### Scenario: A historical V2 draft is opened
- **WHEN** a stored draft uses `buyerObjections`, `highlights` or `searchTerms`
- **THEN** the reader maps those values to `painPoints`, `fiveBullets` and `backendSearchTerms` for display, copy and export
- **AND** the historical stored draft is not rewritten automatically

### Requirement: Listing generation completes without validation or review gates
The system SHALL make one upstream model request for Platform V1. It SHALL NOT perform validator-driven retries, manual review, `needs-review`, failed rewrite gates, or status-based copy/export blocking. After parsing and normalization, it SHALL remove unsupported low-risk evidence terms and SHALL accept non-critical title-length, Bullet-format, pain-point-form, bilingual-count, and keyword-population differences when the minimum bilingual Listing structure remains usable. If the real model request, response parsing, normalization, minimum bilingual structure, or high-risk safety validation fails, the system SHALL return an explicit generation error and SHALL NOT create a mock, deterministic fallback, or `completed` draft. Missing required API configuration SHALL remain an explicit configuration error.

#### Scenario: Model returns usable old-style JSON
- **WHEN** the single model response can be normalized and retains non-empty English and Chinese titles and descriptions
- **THEN** the system returns the normalized and sanitized draft as `completed`
- **AND** no second Platform V1 model request or validator review occurs

#### Scenario: Unsupported low-risk terms are recoverable
- **WHEN** the model response contains low-risk concrete attributes, materials, colors, shapes, construction details, modes, or use contexts that are absent from traceable source evidence
- **THEN** the system removes those terms from public Listing content
- **AND** it returns the remaining usable draft as `completed` without another model request

#### Scenario: Non-critical formatting differs from the prompt target
- **WHEN** the normalized response uses a shorter title, legacy or non-unique Bullet labels, a non-five Bullet count, interrogative pain-point copy, unequal bilingual list counts, or empty keyword buckets
- **AND** the minimum bilingual Listing structure remains usable
- **THEN** the system returns the draft as `completed`
- **AND** none of those format differences produces a generation error

#### Scenario: Model request or parsing fails
- **WHEN** the upstream returns a rate limit, server error, empty response, unusable JSON or incompatible shape
- **THEN** the system returns an explicit non-success error
- **AND** it does not return a mock, deterministic fallback or `completed` draft

#### Scenario: Model content fails acceptance
- **WHEN** parsed model content lacks a non-empty English or Chinese title or description, or retains an unsupported high-risk claim after sanitization
- **THEN** the system returns an explicit non-success error describing the failed acceptance boundary
- **AND** it does not return a sanitized mock or deterministic replacement draft

#### Scenario: Regeneration fails for a record with an existing Listing
- **WHEN** a record already has `listingDrafts` and a regeneration request fails
- **THEN** the API returns the generation error
- **AND** the existing stored `listingDrafts` are not overwritten by mock, deterministic, partial, or empty output

#### Scenario: User copies or exports a completed draft
- **WHEN** any old-style draft is visible
- **THEN** single-field copy, full copy and structured export are available directly
- **AND** those actions do not inspect validation, review or access-gate state

### Requirement: All newly generated Listing content is brand-free
The system SHALL remove brand names, trademarks, store names, seller names and platform names from every English and Chinese content field. This requirement SHALL apply to accepted model outputs and explicitly test-mocked outputs as a product output transformation, not as a platform claim or review workflow.

#### Scenario: Source data contains prohibited identity terms
- **WHEN** product input, SKU data, reference notes or manifest text contains a prohibited identity term
- **THEN** source processing excludes the term from model-ready product facts
- **AND** the prompt instructs the model not to output it

#### Scenario: Generated output contains a prohibited identity term
- **WHEN** accepted model content or explicitly test-mocked content contains a prohibited identity term
- **THEN** the shared sanitizer removes or neutrally rewrites it before the draft is returned
- **AND** the final English and Chinese content fields do not contain the term
- **AND** the draft remains a direct `completed` result rather than entering review

#### Scenario: Platform metadata is retained
- **WHEN** a draft is saved for a named platform
- **THEN** canonical platform ID and policy version may remain in non-content metadata
- **AND** the platform name does not appear in any Listing content field or Chinese counterpart

### Requirement: Local service and Cloudflare Worker share Listing semantics
The local service and Cloudflare Worker SHALL use the same policy resolver, source builder, old-style schema, prompt builder, normalizer, sanitizer, acceptance checks, and explicit failure behavior.

#### Scenario: Equivalent normalized inputs use different runtimes
- **WHEN** local and Worker paths receive equivalent normalized Creation sets and configuration
- **THEN** they resolve the same platform policy and old-style field contract
- **AND** both return a completed draft only for accepted model output and otherwise return a non-success error without automatic fallback
- **AND** neither runtime fetches platform rule URLs during generation

### Requirement: Platform V1 Listing titles communicate evidence-backed value

The system SHALL preserve the existing platform V1 title prompt behavior and old-style bilingual field contract. The prompt SHALL ask the title and `zhDisplay.title` to place product identity early and include one supplied differentiating selling point plus the directly supported buyer pain point or purchase concern that the selling point resolves. After this required core, when traceable evidence and platform hard limits allow, the prompt SHALL ask for distinct search-relevant or purchase-decision attributes selected from supplied quantity, visible construction, visible components, shape, color, variant, package, or use-context facts. When the resolved platform has no hard title limit below 120 English characters and the source supplies enough distinct traceable title facts to write naturally without repetition, the prompt SHALL target at least 120 English characters after trimming. Platform hard character and byte limits and factual support SHALL take precedence over this target. Traceable title evidence SHALL include explicit product inputs and compact structured Creation planning evidence whose buyer motivation or use context is directly supported by its evidence focus or reference-image notes. Objections that only identify missing, disputed, or unverified information SHALL NOT become title evidence. The prompt SHALL prohibit repeated padding and invented facts. The system SHALL sanitize unsupported low-risk title terms and SHALL NOT reject an otherwise usable direct response solely because it is shorter than the title target. `zhDisplay.title` SHALL preserve the same facts naturally when the model follows the prompt, without mechanical character padding.

#### Scenario: Platform V1 prompt restores the prior field rules
- **WHEN** a platform V1 Listing request is built
- **THEN** the prompt retains the existing title ordering, evidence, completeness, bilingual, and platform-policy rules
- **AND** it applies evidence-backed buyer-value rules to non-title fields instead of the former objective-only and fixed-label restrictions
- **AND** it requests alignment between title and `zhDisplay.title` in identity, value, facts, quantity, and order

#### Scenario: Title communicates supplied value and a resolved pain point
- **WHEN** product evidence supplies a differentiating selling point and the buyer problem or purchase concern that it directly addresses
- **THEN** the prompt places the core product phrase near the beginning
- **AND** it requests the supplied selling point and a concise statement of the directly supported pain point resolution
- **AND** it does not treat quantity, structure, color, model, or variant attributes alone as the preferred result while value evidence exists

#### Scenario: Title adds supported decision attributes after the value phrase
- **WHEN** product evidence supplies at least two distinct search-relevant or purchase-decision attributes in addition to the required title value
- **AND** the resolved platform hard limits leave enough space
- **THEN** the prompt requests two to four of the strongest supplied attributes after the required core
- **AND** it may request additional distinct facts to reach the 120-character target
- **AND** it prohibits repeated synonyms, restated value, unsupported filler, and prohibited dimensions or specifications

#### Scenario: Platform length guidance conflicts with title completeness
- **WHEN** a platform supplies a hard title limit and a recommended title range
- **THEN** the prompt gives the hard character or byte limit precedence
- **AND** the recommended range remains readability guidance rather than a direct-response acceptance gate

#### Scenario: Source cannot support a title benefit or pain resolution
- **WHEN** no traceable source evidence supports a differentiating benefit or resolved buyer pain point
- **THEN** the prompt instructs the model to omit that unsupported relationship
- **AND** the returned title may remain limited to supported identity, quantity, search intent, and other title-eligible facts

#### Scenario: Platform hard title limit applies
- **WHEN** the resolved platform has a hard character or UTF-8 byte limit
- **THEN** the prompt requires the generated title to remain within that limit
- **AND** lower-priority appended attributes are omitted before product identity or a supported value relationship

#### Scenario: Structured suite evidence supplies title value when manual fields are empty
- **WHEN** product description and manual selling points are empty
- **AND** saved Creation items contain structured motivation, audience or use context, and supporting evidence focus
- **THEN** the Listing source includes a bounded, deduplicated evidence block with the source role
- **AND** it excludes objection text that only describes missing, disputed, or unverified facts
- **AND** the prompt requires the title to select only a candidate directly supported by product or reference evidence

#### Scenario: Evidence does not support a product outcome
- **WHEN** product evidence does not supply a functional problem or outcome
- **THEN** the prompt prohibits inventing one
- **AND** it may instead express a purchase concern resolved by supplied quantity, option, variant, or package facts without adding title-prohibited dimensions or specifications

#### Scenario: Functional wording appears outside the title
- **WHEN** supplied evidence directly supports a conservative feature-to-benefit relationship outside `title` and `zhDisplay.title`
- **THEN** the Platform V1 response is not rejected solely because it contains that supported functional or benefit wording
- **AND** unsupported outcomes, performance claims, and existing high-risk claims still cause the direct response to be rejected

#### Scenario: Concrete low-risk attribute is not supplied
- **WHEN** a Platform V1 response adds a concrete attribute, construction detail, color, shape, material, or specific use context that is absent from traceable product and buyer-decision evidence
- **THEN** the system removes the unsupported term from the public Listing content
- **AND** it returns the remaining usable direct response without a deterministic or mock replacement

#### Scenario: Title contains a high-risk claim
- **WHEN** a title contains an unsupported ranking, certification, medical, price, guarantee, refund, compatibility, performance, or other high-risk claim
- **THEN** the response is rejected with an explicit generation error
- **AND** no deterministic or mock replacement draft is returned

#### Scenario: Transient upstream failure retains a safe recognized product identity
- **WHEN** a localized Listing request receives a transient upstream failure
- **THEN** the failure is returned to the caller without deriving a product identity or title
- **AND** no generic or recognized-product fallback Listing is created

#### Scenario: Evidence-rich title uses the explicit English target
- **WHEN** the source supplies enough distinct traceable title facts to express a natural title of at least 120 English characters
- **AND** the resolved platform has no hard character or UTF-8 byte title limit below 120
- **THEN** the prompt targets at least 120 English characters
- **AND** it requests supported product details and use context without repeated synonyms or generic filler

#### Scenario: A short evidence-rich model title remains usable
- **WHEN** a platform V1 model response supplies fewer than 120 English title characters for a source that qualifies for the target
- **AND** the normalized draft retains the minimum bilingual structure and passes high-risk safety checks
- **THEN** the short title does not cause a generation error
- **AND** the direct model draft is returned without a fallback

#### Scenario: Platform hard title limit is below the target
- **WHEN** the resolved platform hard character or UTF-8 byte title limit is below 120
- **THEN** the platform hard limit takes precedence in the prompt
- **AND** a title is not rejected solely because it contains fewer than 120 English characters

#### Scenario: Evidence cannot support 120 characters naturally
- **WHEN** the source supplies too few distinct title facts to reach 120 characters without repetition, padding, or invention
- **THEN** the system may return a shorter title
- **AND** it does not invent use contexts, attributes, benefits, package facts, or performance claims to satisfy the target

### Requirement: Platform V1 non-title Listing fields provide complete objective information

The system SHALL instruct platform V1 generation to make `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, and their Simplified Chinese counterparts complete, distinct, useful, natural, buyer-facing, and evidence-backed. Product facts SHALL remain traceable to supplied product inputs, SKU and package facts, reference notes, visible image evidence, or structured buyer-decision evidence whose stated value is supported by its evidence focus. The prompt SHALL prohibit internal workflow language, unsupported competitor comparisons, high-risk claims, question-and-answer pain points, duplicate decision points, and unsupported outcomes. It SHALL request four to five selling points, three to four declarative pain points, five unique product-relevant Bullet labels, natural description prose, and distinct search coverage when evidence and platform limits permit. These count, label, sentence-form, bilingual-count, and keyword-population rules SHALL be generation quality targets rather than direct-response failure gates. The system SHALL remove unsupported low-risk evidence terms before returning a usable response, while unsupported high-risk claims SHALL remain rejection conditions.

#### Scenario: Evidence supports multiple non-title decision points
- **WHEN** Platform V1 product evidence contains at least four distinct supported facts or buyer-decision relationships
- **THEN** the prompt requests four to five distinct selling points and three to four declarative pain-point entries when limits permit
- **AND** each requested item connects supplied facts to supported buyer relevance without unsupported praise

#### Scenario: Buyer-visible copy does not expose internal workflow language
- **WHEN** Platform V1 generation instructions are built
- **THEN** they prohibit parent-listing, saved-record, supplied-configuration, reference-label, source-evidence, selected-quantity, and confirmed-selection narration
- **AND** they request natural storefront language in both languages

#### Scenario: Interrogative model output remains usable
- **WHEN** a Platform V1 model response contains an English or Chinese pain point with a question mark, rhetorical question, or interrogative opening
- **AND** the minimum bilingual structure and high-risk safety checks pass
- **THEN** the sentence form alone does not cause a generation error
- **AND** the direct model response is returned without a deterministic or mock replacement

#### Scenario: Bullet guidance divides supported facts by responsibility
- **WHEN** a Platform V1 prompt is built
- **THEN** it requests exactly five unique, product-relevant lead labels rather than the former fixed label script
- **AND** it assigns primary value, differentiating feature, use context or fit, supplied specification or construction, and variant, quantity, or package clarity to distinct bullets

#### Scenario: Description uses supported facts without padding
- **WHEN** evidence and platform limits permit a fuller description
- **THEN** the prompt organizes product identity, intended context, supported value, relevant details, selection guidance, and package contents as connected natural prose
- **AND** it prohibits repeated padding, provenance narration, and content beyond the applicable hard limit

#### Scenario: Image-only identifiers remain qualified
- **WHEN** a model, core, SKU, or variant identifier appears only as visible text or a reference annotation
- **THEN** the prompt permits describing it only as a visible marking
- **AND** it prohibits presenting it as a confirmed option without structured product or SKU evidence

#### Scenario: Search terms and keyword buckets have distinct coverage
- **WHEN** backend search terms and keyword buckets are generated
- **THEN** the prompt assigns exact category phrases, supported attribute long tails, broader directly relevant categories, and supported descriptive phrases to distinct search surfaces
- **AND** it excludes competitors, unsupported claims, irrelevant traffic terms, duplicates, and internal workflow terminology

#### Scenario: English and Chinese non-title fields correspond
- **WHEN** the bilingual Platform V1 prompt is built
- **THEN** it requests corresponding item counts, order, facts, quantities, units, buyer relevance, and proof
- **AND** normalization or low-risk term removal may leave different list counts without rejecting an otherwise usable response

#### Scenario: Product evidence is insufficient for recommended completeness
- **WHEN** the source cannot support a direct benefit, category-friction response, recommended item count, or target length
- **THEN** the prompt instructs the model to state only the supplied attribute, return fewer entries, or shorten the content
- **AND** it prohibits duplication, invented technical outcomes, competitor comparisons, and generic filler

#### Scenario: Selling points explain why and where the product is useful
- **WHEN** product evidence supplies multiple differentiating features and directly supported buyer relevance
- **THEN** the prompt asks every selling point to identify one supplied feature, explain its practical relevance, and include concrete supplied proof
- **AND** it prohibits isolated labels, generic adjectives, and cross-field paraphrases

#### Scenario: Pain points resolve real category friction
- **WHEN** the exact product category and supplied evidence support a specific shopping or use friction
- **THEN** the prompt requests the friction, supplied product response, and supporting feature or specification in one natural declarative entry
- **AND** question form remains a quality target rather than a direct-response failure gate

#### Scenario: Comparative failure is unsupported
- **WHEN** generated copy says or implies that competitors fail or that this product is better than alternatives without exact comparative evidence
- **THEN** the response is treated as containing an unsupported high-risk comparison
- **AND** it is rejected unless the unsupported claim is absent from the final sanitized content

#### Scenario: Comparative failure is implied through a generic competitor class
- **WHEN** generated copy says that most alternatives, typical products, standard models, ordinary products, or an equivalent Chinese competitor class lacks, struggles, leaves a problem, or offers only a limitation
- **AND** exact comparative evidence is absent
- **THEN** the response is treated as an unsupported competitor comparison

#### Scenario: Five bullets follow Amazon-style buyer decisions
- **WHEN** a Platform V1 prompt is built
- **THEN** it requests five unique product-relevant uppercase English lead labels followed by colons
- **AND** a different Bullet count or label format in the direct response does not alone cause a generation error

#### Scenario: Model reuses the legacy fixed Bullet script
- **WHEN** five bullets use the complete former `PRODUCT TYPE`, `PACK DETAILS`, `VISIBLE DETAILS`, `SPECIFICATIONS`, and `PACKAGE CONTENTS` label set
- **AND** the minimum bilingual structure and high-risk safety checks pass
- **THEN** the label choice alone does not cause a generation error
- **AND** the direct response is returned without a deterministic or mock replacement

#### Scenario: Deterministic fallback has buyer-decision evidence
- **WHEN** the model response is unavailable or fails a non-recoverable acceptance condition
- **AND** bounded buyer-decision evidence contains otherwise usable supported facts
- **THEN** the system returns an explicit generation error
- **AND** it does not convert that evidence into a deterministic or mock Listing

#### Scenario: English fallback receives localized product evidence
- **WHEN** an English Listing request fails and the saved evidence contains Simplified Chinese
- **THEN** the system returns the generation error without constructing localized fallback copy
- **AND** no translated, generic, deterministic, or mock Listing is saved

#### Scenario: Fallback preserves the parent identity over a generic SKU title
- **WHEN** a failed request supplies a trusted parent `productName` and a generic SKU subject title
- **THEN** neither identity is used to construct a fallback Listing
- **AND** the caller receives the original generation error
