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
- **THEN** the Creation record detail shows each listing draft with title, selling points, pain points, five bullets, description, backend search terms, keyword buckets, package dimensions, product dimensions, evidence mode, warnings, and missing information
- **AND** package dimensions and product dimensions appear after keyword buckets at the bottom of the Listing

#### Scenario: User exports listing drafts
- **WHEN** the user exports listing drafts
- **THEN** the app downloads a structured JSON file for the selected Creation set
- **AND** each newly generated exported draft retains `packageDimensions`, `productDimensions`, and their Simplified Chinese counterparts
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
The system SHALL keep one versioned Listing policy for each canonical platform and SHALL use platform-specific title emphasis, conversion order, search intent, locale guidance and field content. Platform rules SHALL NOT rename, remove or reorder the shared outward fields. The existing title-through-keyword field order SHALL remain stable, followed by `packageDimensions` and `productDimensions` in that order.

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
- **AND** both results expose identical shared field names and bilingual structure, including the two appended dimension fields

#### Scenario: Low-evidence platform policy is used
- **WHEN** a platform lacks reliable public evidence for an exact rule
- **THEN** the policy uses conservative writing guidance
- **AND** no validation or review state blocks the generated draft

### Requirement: New Listing drafts use the old-style bilingual field contract

The system SHALL request the existing old-style bilingual Listing contract for every successfully generated or explicitly test-mocked Listing. After a real upstream response is parsed as a usable Listing object and normalized, the system SHALL retain and display the resulting draft as `completed` even when local field, bilingual, dimension, weight, content, provenance, length, or policy validation finds differences from that contract. A usable Listing object SHALL be a non-null, non-array JSON object with at least one non-empty known Listing content field at the top level or under `zhDisplay`. Local validation SHALL NOT discard, fail, retry, or prevent persistence of a successfully generated Listing. Existing output normalization and sanitization MAY transform public content without blocking the draft. If the first real response is empty, malformed, non-object, or lacks recognizable Listing content, the system SHALL make one retry for the Listing JSON shape. A failed real request, timeout, or second empty, malformed, non-object, or unrecognized Listing response SHALL NOT create a Listing draft.

#### Scenario: A new Listing is generated

- **WHEN** the model returns a parsed JSON object with old-style Listing fields
- **THEN** English content is stored in the available top-level old-style fields
- **AND** Simplified Chinese content is stored in available `zhDisplay` fields
- **AND** package dimensions precede product dimensions in display, full copy, and export when both fields are present
- **AND** the status is `completed`

#### Scenario: Local contract validation finds differences

- **WHEN** a parsed and normalized Listing differs from local bilingual, dimension, weight, provenance, content, length, or policy validation expectations
- **THEN** the system retains the generated draft as `completed`
- **AND** it does not return a Listing generation validation error
- **AND** it does not replace the response with a mock or deterministic Listing

#### Scenario: A response without Listing content is retried

- **WHEN** the first model response is empty, malformed, non-object, or has only unrecognized or empty fields
- **THEN** the system makes one additional upstream request that asks for the required Listing JSON shape
- **AND** it does not use local draft-validation findings as retry instructions

#### Scenario: A second response without Listing content fails

- **WHEN** the retry response is empty, malformed, non-object, or has no non-empty recognized Listing content
- **THEN** the system returns an explicit non-success error
- **AND** it does not normalize that response into a `completed` draft

#### Scenario: Low-risk terms are removed from generated content

- **WHEN** normalization finds an unsupported low-risk concrete attribute, material, color, shape, construction, mode, or use-context term
- **THEN** the system removes that term from public Listing fields before returning the draft
- **AND** empty search terms or keyword entries do not make the generation fail

#### Scenario: Blocking claim terms are removed from generated content

- **WHEN** a normalized Platform V1 response contains an unsupported compatibility, certification, ranking, social-proof, medical, safety, warranty, material, performance, price, discount, refund, or competitor-comparison match
- **THEN** the system removes the matched content from public Listing fields before returning the draft
- **AND** it preserves a match whose rule permits exact evidence and whose exact evidence exists in the source
- **AND** the matched keyword or claim does not cause Listing generation to fail

#### Scenario: Explicit test mock mode is used

- **WHEN** a test directly enables the explicit mock mode
- **THEN** the mock uses the old-style bilingual field contract including package and product dimensions
- **AND** a real request failure never enables that mode implicitly

#### Scenario: A historical draft without dimension fields is opened

- **WHEN** a completed stored draft predates the two dimension fields
- **THEN** the reader fills the missing response fields from corresponding set-level physical dimension evidence when available
- **AND** if the historical buyer-facing copy contains component-labeled product dimensions whose complete numeric-unit tokens exist in the source product evidence, the reader presents those dimensions as concise component groups in English and Simplified Chinese
- **AND** it does not concatenate an ambiguous sequence of detached Length and Width measurements or infer component pairings from their order
- **AND** it provides explicitly marked numeric estimates for dimension types without corresponding evidence
- **AND** display, copy and export receive package dimensions followed by product dimensions
- **AND** the historical stored draft is not rewritten automatically

#### Scenario: A historical V2 draft is opened

- **WHEN** a stored draft uses `buyerObjections`, `highlights` or `searchTerms`
- **THEN** the reader maps historical values for display, copy and export without rejecting the draft
- **AND** the historical stored draft is not rewritten automatically

#### Scenario: An old service returns a dimensionless success payload

- **WHEN** the browser receives a successful Listing generation response with missing English or Simplified Chinese dimension or weight fields
- **THEN** the browser accepts the response into current frontend state as a completed generation
- **AND** it does not report that the response must be discarded or that the service must be restarted

#### Scenario: A sourced package measurement has fewer than three axes

- **WHEN** package, packaging, packed, shipping, carton, color-box, outer-box, or visible package-box source evidence supplies only a length or a length and width
- **THEN** the system retains every supplied axis in order and derives only the missing package axes
- **AND** English and Simplified Chinese `packageDimensions` display length x width x height in the selected unit mode
- **AND** neither field receives `Estimated:` or `预估：`
- **AND** the completion does not make an accepted Listing retry, fail, or enter review

#### Scenario: Package evidence is absent

- **WHEN** no traceable package-scoped physical evidence exists, whether or not the usable Listing response supplies numeric package axes
- **THEN** the system supplies an `Estimated:` / `预估：` three-axis package dimension
- **AND** it retains a complete upstream tuple as accepted Listing content while adding the estimate marker or formatting it for the selected unit mode
- **AND** it bases a generated or completed estimate on available product dimensions, category, material, package contents, visible package-form evidence, and reference comparison-size evidence instead of a single generic size
- **AND** the estimate does not create another upstream request or reject the Listing

#### Scenario: An upstream package tuple has no traceable source evidence

- **WHEN** a usable Listing response contains an unmarked one-, two-, or three-axis `packageDimensions` value but no traceable package-scoped measurement exists in the Creation source
- **THEN** the system preserves a complete supplied tuple or completes a partial tuple to length x width x height
- **AND** it marks the English and Simplified Chinese package fields with `Estimated:` and `预估：`
- **AND** the marker and completion do not retry, fail, review, or prevent persistence of the accepted Listing

#### Scenario: A historical package value is incomplete

- **WHEN** a stored completed Listing contains a one- or two-axis `packageDimensions` value
- **THEN** the read response completes it to length x width x height using the same source-aware rules
- **AND** the stored Listing draft remains unchanged

### Requirement: Listing generation completes without validation or review gates

The system SHALL make one upstream model request for Platform V1 and MAY make exactly one additional request only when the first response cannot be parsed as a usable Listing object. It SHALL NOT perform validator-driven retries, manual review, `needs-review`, failed rewrite gates, status-based copy/export blocking, or local acceptance failures after a usable Listing response is normalized. After parsing and normalization, it SHALL remove unsupported low-risk evidence terms and every unsupported match from the blocking claim rules, then SHALL repair an emptied required title or description from remaining safe public content, a sanitized source product identity, or a neutral product identity. It SHALL accept local validation differences in title length, Bullet format, pain-point form, bilingual content or counts, keyword population, dimensions, weights, provenance, and policy content. If the real model request, timeout handling, two response-shape attempts, parsing, or normalization cannot produce a usable Listing response, the system SHALL return an explicit generation error and SHALL NOT create a mock or deterministic replacement Listing. Missing required API configuration SHALL remain an explicit configuration error.

#### Scenario: Model returns usable old-style JSON

- **WHEN** the first or retry model response can be parsed as a usable Listing object and normalized into a Listing draft
- **THEN** the system returns the normalized, sanitized, and minimally repaired draft as `completed`
- **AND** no local validator review or rejection occurs
- **AND** no second Platform V1 model request occurs after a usable first response

#### Scenario: Local validation differs from the response

- **WHEN** the parsed model response would previously fail an old-style or V2 local validation rule
- **THEN** the system returns the normalized draft as `completed`
- **AND** the validation result does not produce an upstream retry or a generation error

#### Scenario: Unsupported low-risk terms are recoverable

- **WHEN** the model response contains low-risk concrete attributes, materials, colors, shapes, construction details, modes, or use contexts that are absent from traceable source evidence
- **THEN** the system removes those terms from public Listing content
- **AND** it returns the remaining usable draft as `completed` without another model request

#### Scenario: Compatibility claim is recoverable

- **WHEN** a Platform V1 response contains an unsupported phrase such as `compatible with ...`, `works with every ...`, `兼容...`, or an equivalent configured compatibility match
- **THEN** the system removes the complete matched compatibility phrase in that language
- **AND** it returns the remaining direct response as `completed` without another model request
- **AND** it does not return `content contains unsupported claim "compatibility claim"`

#### Scenario: Blocking claim cleanup empties required text

- **WHEN** blocking-claim cleanup empties an English or Chinese title or description
- **THEN** the system fills the field from remaining safe same-language content, a sanitized source product identity, or `Product` / `商品`
- **AND** the cleanup does not cause Listing generation to fail
- **AND** the system does not reconstruct the removed claim or invent a replacement fact

#### Scenario: Non-critical formatting differs from the prompt target

- **WHEN** the normalized response uses a shorter title, legacy or non-unique Bullet labels, a non-five Bullet count, interrogative pain-point copy, unequal bilingual list counts, empty keyword buckets, unmarked estimates, incomplete non-package physical fields, or unmatched source-dimension tuples
- **THEN** the system returns the draft as `completed`
- **AND** none of those format differences produces a generation error

#### Scenario: Model request or parsing fails

- **WHEN** the upstream returns a rate limit, server error, timeout, or two empty, malformed, non-object, or unrecognized Listing responses
- **THEN** the system returns an explicit non-success error
- **AND** it does not return a mock, deterministic fallback or `completed` draft

#### Scenario: Model content fails acceptance

- **WHEN** two parsed model responses are empty, non-object, malformed, or contain no non-empty recognized Listing field
- **THEN** the system returns an explicit non-success error describing the unusable Listing response
- **AND** it does not return a mock, deterministic fallback or `completed` draft

#### Scenario: Regeneration fails for a record with an existing Listing

- **WHEN** a record already has `listingDrafts` and a regeneration request fails for an upstream or parsing error
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

### Requirement: Platform V1 Listing titles communicate evidence-backed value

The system SHALL preserve the existing platform V1 title prompt behavior and old-style bilingual field contract. The prompt SHALL ask the title and `zhDisplay.title` to place product identity early and include supplied evidence-backed value and decision attributes within platform limits. It SHALL prohibit unsupported ranking, certification, medical, price, guarantee, refund, compatibility, performance, comparison, padding, and invented facts. Before acceptance, the system SHALL remove unsupported low-risk title terms and every unsupported blocking-claim match. A supported exact-evidence match SHALL remain when its rule permits exact evidence. The system SHALL repair a title emptied by cleanup with safe product identity text and SHALL NOT reject an otherwise normalizable direct response solely because of a removed title claim or title length.

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
- **AND** any separate unsupported blocking-claim match is removed before the direct response is returned

#### Scenario: Concrete low-risk attribute is not supplied
- **WHEN** a Platform V1 response adds a concrete attribute, construction detail, color, shape, material, or specific use context that is absent from traceable product and buyer-decision evidence
- **THEN** the system removes the unsupported term from the public Listing content
- **AND** it returns the remaining usable direct response without a deterministic or mock replacement

#### Scenario: Title contains a high-risk claim
- **WHEN** a title contains an unsupported ranking, certification, medical, price, guarantee, refund, compatibility, performance, comparison, or other configured blocking claim
- **THEN** the system removes the complete matched content and repairs the title if needed
- **AND** it returns the remaining direct model draft without a generation error, deterministic fallback, or mock replacement

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
- **AND** the normalized draft retains the minimum bilingual shape after claim sanitization
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

The system SHALL instruct platform V1 generation to make `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, and their Simplified Chinese counterparts complete, distinct, useful, natural, buyer-facing, and evidence-backed. The prompt SHALL prohibit internal workflow language, unsupported competitor comparisons, blocking claims, question-and-answer pain points, duplicate decision points, and unsupported outcomes. Count, label, sentence-form, bilingual-count, and keyword-population rules SHALL remain generation quality targets rather than direct-response failure gates. Before returning a usable response, the system SHALL remove unsupported low-risk evidence terms and every unsupported match from the configured blocking claim rules. A blocking-claim keyword, phrase, or emptied keyword field SHALL NOT reject the response.

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
- **AND** the minimum bilingual shape remains after claim sanitization
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
- **AND** normalization or claim removal may leave different list counts without rejecting an otherwise usable response

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
- **THEN** the system removes the configured unsupported-comparison match from the final public content
- **AND** the comparison does not cause the remaining normalizable direct response to fail

#### Scenario: Comparative failure is implied through a generic competitor class
- **WHEN** generated copy says that most alternatives, typical products, standard models, ordinary products, or an equivalent Chinese competitor class lacks, struggles, leaves a problem, or offers only a limitation
- **AND** exact comparative evidence is absent
- **THEN** the system removes the configured unsupported-comparison match before returning the response
- **AND** it does not fail the Listing solely because of that comparison

#### Scenario: Five bullets follow Amazon-style buyer decisions
- **WHEN** a Platform V1 prompt is built
- **THEN** it requests five unique product-relevant uppercase English lead labels followed by colons
- **AND** a different Bullet count or label format in the direct response does not alone cause a generation error

#### Scenario: Model reuses the legacy fixed Bullet script
- **WHEN** five bullets use the complete former `PRODUCT TYPE`, `PACK DETAILS`, `VISIBLE DETAILS`, `SPECIFICATIONS`, and `PACKAGE CONTENTS` label set
- **AND** the minimum bilingual shape remains after claim sanitization
- **THEN** the label choice alone does not cause a generation error
- **AND** the direct response is returned without a deterministic or mock replacement

#### Scenario: Deterministic fallback has buyer-decision evidence
- **WHEN** the model response is unavailable or fails a non-recoverable parsing or shape condition
- **AND** bounded buyer-decision evidence contains otherwise usable supported facts
- **THEN** the system returns an explicit generation error
- **AND** it does not convert that evidence into a deterministic or mock Listing

#### Scenario: English fallback receives localized product evidence
- **WHEN** an English Listing request fails for a non-recoverable upstream, parsing, or shape condition and the saved evidence contains Simplified Chinese
- **THEN** the system returns the generation error without constructing localized fallback copy
- **AND** no translated, generic, deterministic, or mock Listing is saved

#### Scenario: Fallback preserves the parent identity over a generic SKU title
- **WHEN** a failed request supplies a trusted parent `productName` and a generic SKU subject title
- **THEN** neither identity is used to construct a fallback Listing
- **AND** the caller receives the original generation error

### Requirement: Listing dimensions distinguish sourced facts from estimates
Every newly generated Listing SHALL provide package and product physical dimensions. The system SHALL reproduce corresponding explicit source dimensions without changing their factual meaning. When corresponding evidence is absent, it SHALL provide a conservative numeric estimate and SHALL mark the English value with `Estimated:` and the Simplified Chinese value with `预估：`. Product dimensions MUST NOT be presented as sourced package dimensions. Image pixel resolution MUST NOT be treated as a physical product or package dimension.

#### Scenario: Product dimensions are supplied but package dimensions are absent
- **WHEN** source product facts contain a physical product length, width, height, depth or diameter but no explicit packaging, packed, carton, color-box or outer-box dimensions
- **THEN** `productDimensions` reproduces the supplied physical dimension facts without an estimate marker
- **AND** `packageDimensions` contains a numeric conservative estimate marked `Estimated:`
- **AND** `zhDisplay.packageDimensions` contains the same estimate marked `预估：`

#### Scenario: Both dimension types are supplied
- **WHEN** source facts explicitly identify both product dimensions and package dimensions
- **THEN** both output fields reproduce the corresponding sourced values
- **AND** neither field relabels the other dimension type

#### Scenario: Neither dimension type is supplied
- **WHEN** source facts provide no physical product or package dimensions
- **THEN** both fields contain conservative numeric estimates
- **AND** both English values use `Estimated:` and both Simplified Chinese values use `预估：`

#### Scenario: Unit mode is selected
- **WHEN** Listing generation receives metric, imperial or both as the dimension unit mode
- **THEN** sourced and estimated dimension fields follow that selected mode
- **AND** the dimensions remain within the shared 500-character field ceiling

### Requirement: Listing drafts expose sourced or estimated weight fields

Every newly generated or explicitly test-mocked Listing SHALL contain non-empty `packageWeight` and `productWeight` strings and matching Simplified Chinese fields under `zhDisplay`. Explicit package/gross/shipping weight evidence SHALL populate `packageWeight`; explicit product/net/item weight evidence SHALL populate `productWeight`. When the corresponding evidence is absent, the system SHALL preserve a valid upstream numeric estimate when one is supplied; otherwise it SHALL generate a conservative product-aware numeric estimate derived from available category, construction/material, size, quantity, and package-context signals. The English field SHALL start with `Estimated:` and the Chinese field SHALL start with `预估：` for either estimated path. Weight fields SHALL follow the selected metric, imperial, or both unit mode and SHALL NOT be placed in the title.

#### Scenario: Product weight is supplied and package weight is absent
- **WHEN** source facts contain a product or net weight but no package, gross, packed, or shipping weight
- **THEN** `productWeight` reproduces the supplied weight in the selected unit mode without an estimate marker
- **AND** `packageWeight` contains a numeric conservative product-aware estimate marked `Estimated:`
- **AND** `zhDisplay.packageWeight` contains the same estimate marked `预估：`

#### Scenario: Package and product weights are supplied
- **WHEN** source facts explicitly identify both weight types
- **THEN** each field reproduces its corresponding source weight
- **AND** package weight is not copied into product weight or vice versa

#### Scenario: Neither weight type is supplied
- **WHEN** source facts provide no traceable weight value
- **THEN** both weight fields contain numeric estimates derived from the available product category, construction/material, size, quantity, and packaging signals
- **AND** the estimates are not required to equal one global constant across different product profiles
- **AND** both English values use `Estimated:` and both Chinese values use `预估：`

#### Scenario: Upstream supplies a valid estimated weight
- **WHEN** the parsed Listing contains a numeric `Estimated:` or `预估：` weight and no corresponding explicit source evidence exists
- **THEN** normalization preserves that estimate and does not replace it with the default baseline

#### Scenario: Historical Listing predates weight fields
- **WHEN** a completed stored Listing lacks one or more weight fields
- **THEN** the read response fills the missing fields from set-level weight evidence or the same product-aware estimate function
- **AND** the stored historical Listing is not rewritten automatically

#### Scenario: Weight is copied or exported
- **WHEN** a Listing is displayed, copied as full text, or exported as structured JSON
- **THEN** package dimensions and package weight appear in one package specification section
- **AND** product dimensions and product weight appear in one product specification section
- **AND** each section places dimensions before weight in English and Simplified Chinese
- **AND** structured JSON retains `packageDimensions`, `packageWeight`, `productDimensions`, and `productWeight` as independent fields with matching Simplified Chinese fields
- **AND** no combined display string replaces those source fields

### Requirement: Dimension evidence is label-scoped and tuple-complete
The system SHALL associate sourced package and product dimensions only with a non-negated clause containing the corresponding label and physical length tuple. Every unmarked generated dimension tuple SHALL match a complete corresponding source tuple, including every axis and any displayed unit conversion; sharing one numeric token SHALL NOT establish provenance.

#### Scenario: Package evidence is explicitly absent beside product dimensions
- **WHEN** source text says package dimensions are not provided and separately supplies product dimensions
- **THEN** the product tuple is accepted only as product evidence
- **AND** package dimensions remain an explicitly marked estimate

#### Scenario: A generated tuple changes sourced axes
- **WHEN** source evidence is `10 x 5 x 3 cm` and a generated field contains `10 x 999 x 999 cm`
- **THEN** validation rejects the generated field
- **AND** matching the first numeric token does not satisfy provenance

### Requirement: Dimension validation uses length units and the shared field ceiling
Dimension unit-mode validation SHALL count only physical length units, and every English and Simplified Chinese package or product dimension field SHALL remain within the shared 500-character ceiling on every generation path.

#### Scenario: Weight accompanies one length system
- **WHEN** both-unit mode receives `20 cm, 2 lb` without an imperial length
- **THEN** validation reports the missing imperial length system

#### Scenario: Legacy Platform V1 returns an overlong dimension
- **WHEN** an English or Simplified Chinese dimension field exceeds 500 characters
- **THEN** the Platform V1 response is rejected before it is returned or stored

### Requirement: Historical grouped dimensions retain every axis
The historical read compatibility layer SHALL recognize grouped `N x N [x N] unit` dimensions with a shared trailing unit and SHALL retain every axis while deriving concise component groups. It SHALL change only the read model and SHALL NOT rewrite stored history.

#### Scenario: Component dimensions share trailing units
- **WHEN** historical evidence contains `Main body: 194 x 35 mm; Keeper: 46 x 34 mm`
- **THEN** the hydrated display retains `194 x 35 mm` and `46 x 34 mm`
- **AND** neither leading axis is discarded

### Requirement: Listing review exposes unresolved generation context
Creation record details SHALL render non-empty Listing `warnings` and `missingInfo` after the public copy fields so reviewers can distinguish generated copy from unresolved evidence gaps.

#### Scenario: A saved Listing contains warnings and missing information
- **WHEN** the user opens that Listing in Creation record details
- **THEN** each non-empty warning and missing-information item is visible
- **AND** the fields remain excluded when their arrays are empty

### Requirement: Listing titles exclude internal part numbers

Newly generated and regenerated Listing drafts SHALL exclude internal product part numbers, SKU part numbers, and reference-only identifiers from `title` and `zhDisplay.title`. The generation prompt SHALL prohibit these identifiers in both titles, and normalization SHALL deterministically remove candidates derived from structured product and SKU sources before the completed draft is returned. This cleanup SHALL NOT remove or rewrite SKU IDs, reference filenames, associations, non-title Listing fields, or stored historical drafts.

#### Scenario: Product name contains an internal part number

- **WHEN** the source product name is `电动仿生米诺鱼饵 F4J16` and a generated response includes `F4J16` in both titles
- **THEN** the completed English `title` and Simplified Chinese `zhDisplay.title` do not contain `F4J16`
- **AND** the remaining product identity is retained and normalized without stray separators

#### Scenario: SKU metadata contains a reference-only identifier

- **WHEN** a SKU subject supplies an internal ID or reference filename containing a part-number token
- **THEN** the Listing prompt identifies that token as prohibited title content
- **AND** post-response normalization removes the token from both titles if the model returns it
- **AND** the SKU subject ID and reference filename remain available for internal association

#### Scenario: Historical Listing is opened

- **WHEN** a stored historical Listing title already contains an internal part number
- **THEN** merely opening or exporting that historical record does not rewrite the stored draft

#### Scenario: Part-number cleanup empties a generated title

- **WHEN** a generated title contains only a structured part number, including a compound identifier such as `F4J-16`
- **THEN** the system removes the complete identifier without leaving a numeric fragment
- **AND** it repairs the empty title from a sanitized source product identity or `Product` / `商品`

### Requirement: Short generated Listing titles reuse safe response content

After a newly generated or regenerated Listing response has completed no-brand, unsupported-evidence, blocking-claim, and internal-part-number cleanup, the system SHALL extend an English title that remains below the resolved platform recommendation when same-language sanitized response content supplies distinct supported information. The extension SHALL extract title-appropriate keywords or short phrases from cleaned selling points, five bullets, pain points, description, backend search terms, and keyword buckets; SHALL omit generic structural field labels; SHALL allow a concise same-language lead label only when the label itself expresses a traceably supported product attribute; SHALL remove sentence punctuation; SHALL avoid copying an unbroken prose paragraph when a shorter sentence, clause, word, or phrase boundary is available; and SHALL avoid repeated title concepts. Appended English content SHALL preserve complete word boundaries, while Simplified Chinese content SHALL use cleaned `zhDisplay` text and Chinese punctuation or bounded phrase boundaries. The result SHALL obey the platform hard character and UTF-8 byte limits plus the universal field ceiling. A lack of safe extension content SHALL NOT fail, retry, or replace the accepted response. The Simplified Chinese reference title SHALL NOT use the evidence-rich 120-English-character target.

#### Scenario: Safe response content can complete a short title

- **WHEN** a model returns a usable title below the platform recommended minimum
- **AND** cleaned selling points, bullets, pain points, description, or search fields contain distinct same-language supported product information
- **THEN** the completed title appends enough non-duplicate safe keywords or short phrases to reach the applicable target when possible
- **AND** the result does not exceed a platform character or UTF-8 byte hard limit

#### Scenario: Prose fields are converted to title phrases

- **WHEN** a completion source contains a traceably supported semantic lead label, a generic structural label, a long English sentence, or consecutive Chinese clauses without spaces
- **THEN** the supported semantic lead label may remain eligible while the generic structural label and sentence punctuation are removed
- **AND** a semantic lead label without traceable source support is omitted
- **AND** the system does not copy the complete source paragraph into the title when a shorter boundary is available
- **AND** an English phrase is not truncated inside a word

#### Scenario: Evidence-rich English response is shorter than 120 characters

- **WHEN** the source supplies at least six distinct Listing evidence aliases
- **AND** the platform has no hard title limit below 120
- **AND** the cleaned accepted response contains enough distinct English content
- **THEN** the completed English title reaches at least 120 characters without another model request
- **AND** its appended content contains no internal part number

#### Scenario: Safe extension content is unavailable

- **WHEN** a short accepted title has no distinct cleaned same-language response content that can extend it
- **THEN** the system retains the shorter title as completed
- **AND** it does not retry, invent filler, or fail the Listing

#### Scenario: Low title limit takes precedence

- **WHEN** the resolved platform hard title limit is below the general completeness target
- **THEN** title completion stops at that hard limit
- **AND** lower-priority candidate content is omitted

### Requirement: Listing claim filtering separates ordinary attributes from qualification-sensitive performance terms

The system SHALL treat sourced ordinary product attributes such as portable design and USB charging as usable Listing facts rather than configured blocking claims. These ordinary attributes SHALL still be removed from public English and Simplified Chinese Listing fields when they are absent from traceable source evidence. The evidence gate SHALL recognize configured conservative English and Simplified Chinese equivalents for these ordinary attributes. The system SHALL remove qualification-sensitive high-power, high-brightness, and waterproof wording and configured equivalents from every public V1 and V2 English and Simplified Chinese Listing field even when ordinary product text repeats that wording, because the system has no verified qualification-evidence object. Removing any such content SHALL NOT retry, reject, or replace an otherwise usable Listing response.

#### Scenario: Sourced ordinary attributes remain usable

- **WHEN** traceable English or Simplified Chinese source evidence supplies portable design or USB charging
- **THEN** the corresponding configured English and Simplified Chinese ordinary attribute may remain in public Listing content
- **AND** the attribute is not removed as a qualification-sensitive claim

#### Scenario: Unsupplied ordinary attribute remains unsupported

- **WHEN** a model response introduces portable design or USB charging without traceable source evidence
- **THEN** the unsupported concrete attribute is removed from English and Simplified Chinese content by the factual evidence gate
- **AND** it is not retained merely because the term is outside the qualification-sensitive list

#### Scenario: Qualification-sensitive performance wording is removed

- **WHEN** any public V1 or V2 Listing field contains high-power, high-brightness, waterproof, or a configured equivalent
- **THEN** the system removes the complete matched wording from English and Simplified Chinese content
- **AND** ordinary product text repeating the wording does not bypass the rule
- **AND** the remaining usable response is returned without another model request
