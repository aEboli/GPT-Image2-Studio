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
Every new or explicitly rewritten Listing SHALL contain `title`, `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, and a structurally corresponding Simplified Chinese `zhDisplay`. `keywordBuckets` SHALL contain `exact`, `longTail`, `traffic`, and `descriptive` arrays in both languages.

#### Scenario: A new Listing is generated
- **WHEN** Listing generation completes from model, mock or deterministic fallback
- **THEN** English content is stored in the top-level old-style fields
- **AND** Simplified Chinese content is stored in matching `zhDisplay` fields with the same value types and item order
- **AND** the status is `completed`

#### Scenario: A historical V2 draft is opened
- **WHEN** a stored draft uses `buyerObjections`, `highlights` or `searchTerms`
- **THEN** the reader maps those values to `painPoints`, `fiveBullets` and `backendSearchTerms` for display, copy and export
- **AND** the historical stored draft is not rewritten automatically

### Requirement: Listing generation completes without validation or review gates
The system SHALL make one upstream model request. It SHALL NOT perform validator-driven retries, manual review, `needs-review`, failed rewrite gates, or status-based copy/export blocking. If the model request or response parsing fails, the system SHALL directly return a deterministic old-style fallback with status `completed`. Missing required API configuration MAY remain an explicit configuration error.

#### Scenario: Model returns usable old-style JSON
- **WHEN** the single model response can be normalized
- **THEN** the system returns the normalized draft as `completed`
- **AND** no second model request or validator review occurs

#### Scenario: Model request or parsing fails
- **WHEN** the upstream returns a rate limit, server error, unusable JSON or incompatible shape
- **THEN** the system immediately builds a deterministic old-style bilingual fallback
- **AND** returns it as `completed` without `needs-review` or a rewrite requirement

#### Scenario: User copies or exports a completed draft
- **WHEN** any old-style draft is visible
- **THEN** single-field copy, full copy and structured export are available directly
- **AND** those actions do not inspect validation, review or access-gate state

### Requirement: All newly generated Listing content is brand-free
The system SHALL remove brand names, trademarks, store names, seller names and platform names from every English and Chinese content field. This requirement SHALL apply to model, mock and deterministic fallback outputs as a product output transformation, not as a platform claim or review workflow.

#### Scenario: Source data contains prohibited identity terms
- **WHEN** product input, SKU data, reference notes or manifest text contains a prohibited identity term
- **THEN** source processing excludes the term from model-ready product facts
- **AND** the prompt instructs the model not to output it

#### Scenario: Generated output contains a prohibited identity term
- **WHEN** model, mock or deterministic fallback content contains a prohibited identity term
- **THEN** the shared sanitizer removes or neutrally rewrites it before the draft is returned
- **AND** the final English and Chinese content fields do not contain the term
- **AND** the draft remains a direct `completed` result rather than entering review

#### Scenario: Platform metadata is retained
- **WHEN** a draft is saved for a named platform
- **THEN** canonical platform ID and policy version may remain in non-content metadata
- **AND** the platform name does not appear in any Listing content field or Chinese counterpart

### Requirement: Local service and Cloudflare Worker share Listing semantics
The local service and Cloudflare Worker SHALL use the same policy resolver, source builder, old-style schema, prompt builder, normalizer, sanitizer and deterministic fallback.

#### Scenario: Equivalent normalized inputs use different runtimes
- **WHEN** local and Worker paths receive equivalent normalized Creation sets and configuration
- **THEN** they resolve the same platform policy and old-style field contract
- **AND** they use the same one-request and direct-fallback behavior
- **AND** neither runtime fetches platform rule URLs during generation

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

### Requirement: Platform V1 non-title Listing fields provide complete objective information

The system SHALL instruct platform V1 generation to make `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, and their Simplified Chinese counterparts complete, distinct, useful, natural, and buyer-facing while retaining the objective, attribute-only content boundary. Public copy SHALL state product facts directly and SHALL NOT expose internal record, evidence, generation, selection-state, or parent-draft terminology. When traceable evidence supports enough distinct decision points, selling points SHALL contain four to five complete entries and pain points SHALL contain three to four concise declarative statements, each directly presenting one positive supplied pre-purchase fact rather than using missing-information, evidence-provenance, interrogative, rhetorical, or question-and-answer wording. English and Chinese `painPoints` SHALL NOT contain question marks or begin with question constructions. The five bullets SHALL retain the fixed `PRODUCT TYPE`, `PACK DETAILS`, `VISIBLE DETAILS`, `SPECIFICATIONS`, and `PACKAGE CONTENTS` labels, with one unique responsibility per bullet and a direct factual body. The description SHALL organize supported identity, visible construction, specifications, variants, quantity, and package facts as connected product prose without narrating how those facts were obtained or repeating text merely to increase length. When evidence supports a fuller English description, the prompt SHALL target 350 to 500 characters and SHALL never exceed the existing 500-character universal limit or a stricter platform limit. Backend search terms and keyword buckets SHALL remain publishable keyword phrases and SHALL broaden directly relevant objective search coverage while removing case, punctuation, mechanical singular/plural, and semantic duplicates within and across buckets. A model, core, SKU, or variant identifier visible only in image or reference evidence SHALL be qualified as a visible marking and SHALL NOT be presented as a confirmed selection or available option. Evidence scarcity and platform hard limits SHALL take precedence over recommended completeness; the system SHALL omit unsupported content rather than inventing or repeating it. The existing title rules SHALL remain unchanged.

#### Scenario: Evidence supports multiple non-title decision points

- **WHEN** platform V1 product evidence contains at least four distinct objective facts across identity, visible construction, specifications, variants, quantity, or package contents
- **THEN** the prompt requests four to five distinct selling points and three to four objective pre-purchase statements
- **AND** each entry uses a complete, specific statement rather than an isolated label or generic adjective
- **AND** every pain point directly states one supplied fact instead of asking a question or saying that information is unknown, missing, or not specified
- **AND** no entry introduces a function, effect, performance result, benefit, or problem-solution claim

#### Scenario: Buyer-visible copy does not expose internal workflow language

- **WHEN** Platform V1 generates non-title English and Chinese content
- **THEN** selling points, pain points, fixed bullets, and descriptions state product facts directly in natural storefront language
- **AND** they do not mention parent listings, parent products, saved Creation sets, supplied configurations, reference labels, source evidence, selected quantities, confirmed selections, or equivalent Chinese workflow terms
- **AND** each pain point uses a declarative sentence such as a direct quantity, dimension, variant, visible-detail, or package statement
- **AND** pain points contain neither `?` nor `？`, do not begin with interrogative constructions, and do not combine a question with its answer

#### Scenario: Interrogative model output is not accepted

- **WHEN** a Platform V1 model response contains an English or Chinese pain point with a question mark, rhetorical question, or interrogative opening
- **THEN** the response is not accepted as the completed Listing
- **AND** the system returns the existing deterministic objective fallback whose pain points are declarative statements
- **AND** it does not add another model retry or manual review state

#### Scenario: Fixed bullets divide supported facts by responsibility

- **WHEN** a platform V1 Listing is generated
- **THEN** the prompt retains the fixed five-bullet labels in their existing order
- **AND** product identity, pack or variant details, visible construction, supplied specifications, and package contents are assigned to their matching bullet
- **AND** each bullet body states its product fact directly without evidence-provenance narration
- **AND** the same sentence or decision point is not repeated under multiple labels

#### Scenario: Description uses supported facts without padding

- **WHEN** evidence and platform limits permit a fuller description
- **THEN** the prompt organizes facts in the order of product identity, visible construction, specifications, variants, quantity, and package contents
- **AND** it uses short natural paragraphs rather than a list of disconnected fragments
- **AND** it targets 350 to 500 English characters when the evidence supports that range
- **AND** it never exceeds the existing 500-character universal field limit or a stricter platform limit
- **AND** it does not repeat the title or other fields merely to meet a target length
- **AND** it does not describe the Listing record, source provenance, or generation process

#### Scenario: Image-only identifiers remain qualified

- **WHEN** a model, core, SKU, or variant identifier appears only as visible text or a reference annotation
- **THEN** non-title copy may say that visible markings include that identifier
- **AND** it does not call the identifier a selected, confirmed, included, or available option without structured product or SKU evidence

#### Scenario: Search terms and keyword buckets have distinct coverage

- **WHEN** backend search terms and keyword buckets are generated
- **THEN** the prompt assigns exact category phrases, objective attribute long tails, broader directly relevant categories, and descriptive attribute phrases to distinct search surfaces
- **AND** it removes case-only, punctuation-only, mechanical singular/plural, and semantic duplicates within and across keyword buckets
- **AND** it excludes functions, effects, competitors, unsupported claims, irrelevant traffic terms, and internal evidence or generation terminology

#### Scenario: English and Chinese non-title fields correspond

- **WHEN** the bilingual platform V1 result is returned
- **THEN** corresponding arrays preserve the same item counts, order, facts, quantities, and units
- **AND** Chinese content translates the matching English meaning naturally without adding or removing claims
- **AND** neither language exposes internal workflow terminology or uses question-and-answer pain points

#### Scenario: Product evidence is insufficient for recommended completeness

- **WHEN** the source does not support the recommended number of distinct facts or the platform hard limit is smaller
- **THEN** the prompt instructs the model to return fewer supported entries or shorter content
- **AND** it does not duplicate, paraphrase, infer, or invent facts to reach a count or length target
- **AND** title generation continues to use the existing title rules without modification
