## MODIFIED Requirements

### Requirement: Platform V1 Listing titles communicate evidence-backed value

The system SHALL preserve the existing platform V1 title behavior and old-style bilingual field contract. The title and `zhDisplay.title` SHALL place the product identity early and SHALL include one supplied differentiating selling point plus the directly supported buyer pain point or purchase concern that the selling point resolves. After this required core, when traceable evidence and platform hard limits allow, the title SHALL add two to four distinct search-relevant or purchase-decision attributes selected from supplied quantity, visible construction, visible components, shape, color, variant, or package facts. Platform hard character and byte limits SHALL always take precedence; recommended length ranges SHALL remain readability targets rather than hard validation limits. Traceable title evidence SHALL include explicit product inputs and compact structured Creation planning evidence whose buyer motivation or use context is directly supported by its evidence focus or reference-image notes. Objections that only identify missing, disputed, or unverified information SHALL NOT become title evidence. The title SHALL NOT repeat concepts to fill space or invent a problem, result, function, effect, performance claim, or other fact that is absent from traceable product evidence. Non-title fields SHALL use the separate evidence-backed buyer-value requirement below instead of the former attribute-only restriction.

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
- **THEN** the response is not accepted as the completed Listing
- **AND** the system returns an evidence-bound deterministic fallback whose pain points are declarative statements
- **AND** it does not add another model retry or manual review state

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
- **THEN** the response is not accepted as product-relevant Amazon-style copy
- **AND** the completed draft uses five distinct decision roles instead

#### Scenario: Deterministic fallback has buyer-decision evidence

- **WHEN** the model response is unavailable or rejected
- **AND** bounded buyer-decision evidence contains a supported value, category friction, buyer context, and proof focus
- **THEN** fallback selling points communicate the supported product value
- **AND** fallback pain points state the category friction and supplied product response declaratively
- **AND** fallback bullets cover five distinct buyer decisions with product-relevant labels

#### Scenario: English fallback receives localized product evidence

- **WHEN** the target public language is English
- **AND** the saved product identity, reference notes, or buyer-decision evidence contain Simplified Chinese
- **THEN** explicit product identity and reference facts MAY be represented by conservative English evidence aliases
- **AND** the English title, selling points, pain points, bullets, description, and search fields contain no CJK text
- **AND** Chinese buyer-decision prose is not copied into English public fields
- **AND** a recognized localized product uses only aliased facts that remain traceable to the saved source
- **AND** an unknown localized category falls back to a single generic `Product` identity without adjacent duplicate `Product` title segments
