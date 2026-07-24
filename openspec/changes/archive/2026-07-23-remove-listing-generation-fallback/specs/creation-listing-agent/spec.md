## MODIFIED Requirements

### Requirement: New Listing drafts use the old-style bilingual field contract
Every successfully generated or explicitly test-mocked Listing SHALL contain `title`, `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, and a structurally corresponding Simplified Chinese `zhDisplay`. `keywordBuckets` SHALL contain `exact`, `longTail`, `traffic`, and `descriptive` arrays in both languages. A failed real generation SHALL NOT create a Listing draft.

#### Scenario: A new Listing is generated
- **WHEN** the model returns a Listing that passes parsing, normalization, structure, evidence, and safety checks
- **THEN** English content is stored in the top-level old-style fields
- **AND** Simplified Chinese content is stored in matching `zhDisplay` fields with the same value types and item order
- **AND** the status is `completed`

#### Scenario: Explicit test mock mode is used
- **WHEN** a test directly enables the explicit mock mode
- **THEN** the mock uses the old-style bilingual field contract
- **AND** a real request failure never enables that mode implicitly

#### Scenario: A historical V2 draft is opened
- **WHEN** a stored draft uses `buyerObjections`, `highlights` or `searchTerms`
- **THEN** the reader maps those values to `painPoints`, `fiveBullets` and `backendSearchTerms` for display, copy and export
- **AND** the historical stored draft is not rewritten automatically

### Requirement: Listing generation completes without validation or review gates
The system SHALL make one upstream model request for Platform V1. It SHALL NOT perform validator-driven retries, manual review, `needs-review`, failed rewrite gates, or status-based copy/export blocking. If the real model request, response parsing, normalization, structural validation, evidence validation, or safety validation fails, the system SHALL return an explicit generation error and SHALL NOT create a mock, deterministic fallback, or `completed` draft. Missing required API configuration SHALL remain an explicit configuration error.

#### Scenario: Model returns usable old-style JSON
- **WHEN** the single model response can be normalized and passes all required checks
- **THEN** the system returns the normalized draft as `completed`
- **AND** no second Platform V1 model request or validator review occurs

#### Scenario: Model request or parsing fails
- **WHEN** the upstream returns a rate limit, server error, empty response, unusable JSON or incompatible shape
- **THEN** the system returns an explicit non-success error
- **AND** it does not return a mock, deterministic fallback or `completed` draft

#### Scenario: Model content fails acceptance
- **WHEN** parsed model content fails structure, evidence, high-risk-claim, title, or buyer-facing content checks
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

#### Scenario: Source cannot support a title benefit or pain resolution
- **WHEN** no traceable source evidence supports a differentiating benefit or resolved buyer pain point
- **THEN** the prompt instructs the model to omit that unsupported relationship
- **AND** the returned title remains limited to supported identity, quantity, search intent, and other title-eligible facts

#### Scenario: Platform hard title limit applies
- **WHEN** the resolved platform has a hard character or UTF-8 byte limit
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
- **THEN** the direct model response is rejected with an explicit generation error
- **AND** no deterministic or mock replacement draft is returned

#### Scenario: Title contains a high-risk claim
- **WHEN** a title contains an unsupported ranking, certification, medical, price, guarantee, refund, material, compatibility, performance, or other high-risk claim
- **THEN** the response is rejected with an explicit generation error
- **AND** no deterministic or mock replacement draft is returned

#### Scenario: Transient upstream failure retains a safe recognized product identity
- **WHEN** a localized Listing request receives a transient upstream failure
- **THEN** the failure is returned to the caller without deriving a product identity or title
- **AND** no generic or recognized-product fallback Listing is created

#### Scenario: Evidence-rich title reaches the explicit English lower bound
- **WHEN** the source supplies enough distinct traceable title facts to express a natural title of at least 120 English characters
- **AND** the resolved platform has no hard character or UTF-8 byte title limit below 120
- **THEN** the trimmed English title contains at least 120 characters
- **AND** the existing quantity, product identity, selling point, and pain-resolution core remains before the added details
- **AND** supported product details and a supported use context extend the title without repeated synonyms or generic filler
- **AND** `zhDisplay.title` preserves the same facts in the same order without mechanical character padding

#### Scenario: A short evidence-rich model title is not retained
- **WHEN** a platform V1 model response supplies fewer than 120 English title characters for a source that qualifies for the lower bound
- **THEN** the short model title is rejected with an explicit generation error
- **AND** no deterministic or mock replacement draft is returned

#### Scenario: Platform hard title limit is below the lower bound
- **WHEN** the resolved platform hard character or UTF-8 byte title limit is below 120
- **THEN** the platform hard limit takes precedence
- **AND** a title is not rejected solely because it contains fewer than 120 English characters

#### Scenario: Evidence cannot support 120 characters naturally
- **WHEN** the source supplies too few distinct title facts to reach 120 characters without repetition, padding, or invention
- **THEN** the system may return a shorter title
- **AND** it does not invent use contexts, attributes, benefits, package facts, or performance claims to satisfy the lower bound

### Requirement: Platform V1 non-title Listing fields provide complete objective information

The system SHALL instruct platform V1 generation to make `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, and their Simplified Chinese counterparts complete, distinct, useful, natural, buyer-facing, and evidence-backed. Product facts SHALL remain traceable to supplied product inputs, SKU and package facts, reference notes, visible image evidence, or structured buyer-decision evidence whose stated value is supported by its evidence focus. Public copy SHALL NOT expose internal record, evidence, generation, selection-state, or parent-draft terminology. When traceable evidence supports enough distinct decision points, selling points SHALL contain four to five entries using `supplied feature -> practical buyer relevance -> supplied proof`, and pain points SHALL contain three to four concise declarative entries using `specific category friction -> supplied product response -> supplied proof`. A category friction MAY be conservatively inferred from the exact product category, but it SHALL NOT be stated as a competitor failure, comparative superiority, universal category fact, or proven product outcome. English and Chinese `painPoints` SHALL NOT contain questions or question-and-answer construction. The five bullets SHALL use five unique product-relevant lead labels and distinct decision roles ordered by primary value, differentiating feature, use context or fit, specification or construction, and variant or package clarity. The description SHALL connect product identity, intended context, supported value, relevant details, selection guidance, and package contents as natural prose. Search terms SHALL broaden directly relevant coverage without unsupported outcomes or duplicates. Evidence scarcity and platform hard limits SHALL take precedence over recommended completeness, and the existing title rules SHALL remain unchanged.

#### Scenario: Evidence supports multiple non-title decision points
- **WHEN** Platform V1 product evidence contains at least four distinct supported facts or buyer-decision relationships
- **THEN** the prompt requests four to five distinct selling points and three to four declarative pain-point entries when limits permit
- **AND** each selling point connects one supplied feature to practical buyer relevance and concrete supplied proof
- **AND** each pain point states one specific category friction, the supplied product response, and supporting proof
- **AND** no entry is merely an isolated label, generic adjective, product introduction, or paraphrase of another field

#### Scenario: Buyer-visible copy does not expose internal workflow language
- **WHEN** Platform V1 generates non-title English and Chinese content
- **THEN** selling points, pain points, bullets, and descriptions state supported product value in natural storefront language
- **AND** they do not mention parent listings, saved Creation sets, supplied configurations, reference labels, source evidence, selected quantities, confirmed selections, or equivalent Chinese workflow terms
- **AND** pain points contain no ASCII or full-width question mark, do not begin with interrogative constructions, and do not combine a question with its answer

#### Scenario: Interrogative model output is not accepted
- **WHEN** a Platform V1 model response contains an English or Chinese pain point with a question mark, rhetorical question, or interrogative opening
- **THEN** the response is rejected with an explicit generation error
- **AND** no deterministic or mock replacement draft is returned

#### Scenario: Fixed bullets divide supported facts by responsibility
- **WHEN** a Platform V1 Listing is generated
- **THEN** it contains exactly five bullets with five unique, product-relevant lead labels rather than the former fixed label script
- **AND** primary value, differentiating feature, use context or fit, supplied specification or construction, and variant, quantity, or package clarity are assigned to distinct bullets
- **AND** each bullet body front-loads its decision point and connects supported facts without evidence-provenance narration
- **AND** the same sentence or decision point is not repeated under multiple labels

#### Scenario: Description uses supported facts without padding
- **WHEN** evidence and platform limits permit a fuller description
- **THEN** the prompt organizes product identity, intended context, supported value, relevant details, selection guidance, and package contents as connected natural prose
- **AND** it uses short paragraphs rather than disconnected fragments
- **AND** it never exceeds the applicable platform hard limit or the existing 500-character universal field limit
- **AND** it does not repeat the title or other fields merely to meet a target length
- **AND** it does not describe the Listing record, source provenance, or generation process

#### Scenario: Image-only identifiers remain qualified
- **WHEN** a model, core, SKU, or variant identifier appears only as visible text or a reference annotation
- **THEN** non-title copy may say that visible markings include that identifier
- **AND** it does not call the identifier a selected, confirmed, included, or available option without structured product or SKU evidence

#### Scenario: Search terms and keyword buckets have distinct coverage
- **WHEN** backend search terms and keyword buckets are generated
- **THEN** the prompt assigns exact category phrases, supported attribute long tails, broader directly relevant categories, and supported descriptive phrases to distinct search surfaces
- **AND** it removes case-only, punctuation-only, mechanical singular/plural, and semantic duplicates within and across keyword buckets
- **AND** it excludes competitors, unsupported claims, irrelevant traffic terms, and internal evidence or generation terminology

#### Scenario: English and Chinese non-title fields correspond
- **WHEN** the bilingual Platform V1 result is returned
- **THEN** corresponding arrays preserve the same item counts, order, facts, quantities, units, buyer relevance, and proof
- **AND** Chinese content translates the matching English meaning naturally without adding or removing claims
- **AND** neither language exposes internal workflow terminology, uses question-and-answer pain points, or asserts unsupported competitor failure

#### Scenario: Product evidence is insufficient for recommended completeness
- **WHEN** the source cannot support a direct benefit, category-friction response, recommended item count, or target length
- **THEN** the prompt instructs the model to state only the supplied attribute, return fewer entries, or shorten the content
- **AND** it does not duplicate, infer a technical outcome, invent a competitor comparison, or add generic filler
- **AND** title generation continues to use the existing title rules without modification

#### Scenario: Selling points explain why and where the product is useful
- **WHEN** product evidence supplies multiple differentiating features and directly supported buyer relevance
- **THEN** every selling point identifies one supplied feature, explains its practical relevance, and includes a concrete supplied proof detail
- **AND** no item is merely a product introduction, isolated attribute label, generic adjective, or paraphrase of another field

#### Scenario: Pain points resolve real category friction
- **WHEN** the exact product category and supplied evidence support a specific shopping or use friction
- **THEN** each pain point states the friction, the supplied product response, and the supporting feature or specification in one natural declarative entry
- **AND** it does not use a question mark, interrogative opening, rhetorical question, or question-plus-answer format
- **AND** it does not use quantity, option selection, or package checking as filler when stronger product-specific friction is supported

#### Scenario: Comparative failure is unsupported
- **WHEN** generated copy says or implies that other products cannot solve a problem, that competitors fail, or that this product is better than alternatives
- **AND** the source does not contain exact comparative test evidence
- **THEN** the prompt prohibits the claim
- **AND** the completed copy frames the issue as a buyer or use friction without asserting competitor performance

#### Scenario: Comparative failure is implied through a generic competitor class
- **WHEN** generated copy says that most alternatives, typical products, standard models, ordinary products, or an equivalent Chinese competitor class lacks, struggles, leaves a problem, or offers only a limitation
- **AND** exact comparative evidence is absent
- **THEN** the response is treated as an unsupported competitor comparison

#### Scenario: Five bullets follow Amazon-style buyer decisions
- **WHEN** a Platform V1 Listing is generated
- **THEN** it contains exactly five bullets with five unique, product-relevant, one-to-three-word uppercase English lead labels followed by colons
- **AND** the bullets cover primary value, differentiating feature and supported benefit, use context or fit, supplied specification or construction, and variant, quantity, or package contents
- **AND** each bullet front-loads its decision point, connects a feature to supported buyer relevance where applicable, and adds concrete proof
- **AND** no bullet repeats another bullet, the title, or another field merely to add length

#### Scenario: Structurally valid bullets reuse the legacy fixed script
- **WHEN** five bullets use the complete former `PRODUCT TYPE`, `PACK DETAILS`, `VISIBLE DETAILS`, `SPECIFICATIONS`, and `PACKAGE CONTENTS` label set
- **THEN** the response is rejected with an explicit generation error
- **AND** no deterministic or mock replacement draft is returned

#### Scenario: Deterministic fallback has buyer-decision evidence
- **WHEN** the model response is unavailable or rejected
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

## REMOVED Requirements

### Requirement: Deterministic Listing fallbacks preserve traceable evidence

**Reason**: 真实 Listing 请求失败后不得再生成任何确定性或 mock 草稿；失败必须对调用方可见。

**Migration**: 删除所有真实请求失败分支对确定性草稿构造器的调用。历史已保存草稿不迁移；测试如需固定草稿必须显式使用 mock 能力。
