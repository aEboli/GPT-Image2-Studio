## ADDED Requirements

### Requirement: Platform V1 non-title Listing fields provide complete objective information
The system SHALL instruct platform V1 generation to make `sellingPoints`, `painPoints`, `fiveBullets`, `description`, `backendSearchTerms`, `keywordBuckets`, and their Simplified Chinese counterparts complete, distinct, and useful while retaining the objective, attribute-only content boundary. When traceable evidence supports enough distinct decision points, selling points SHALL contain four to five complete entries and pain points SHALL contain three to four objective pre-purchase checks, each answered by a positive supplied fact rather than missing-information filler. The five bullets SHALL retain the fixed `PRODUCT TYPE`, `PACK DETAILS`, `VISIBLE DETAILS`, `SPECIFICATIONS`, and `PACKAGE CONTENTS` labels, with one unique responsibility per bullet. The description SHALL organize supported identity, visible construction, specifications, variants, quantity, and package facts without repeating text merely to increase length. When evidence supports a fuller English description, the prompt SHALL target 350 to 500 characters and SHALL never exceed the existing 500-character universal limit or a stricter platform limit. Backend search terms and keyword buckets SHALL broaden directly relevant objective search coverage while removing case, punctuation, mechanical singular/plural, and semantic duplicates within and across buckets. Evidence scarcity and platform hard limits SHALL take precedence over recommended completeness; the system SHALL omit unsupported content rather than inventing or repeating it. The existing title rules SHALL remain unchanged.

#### Scenario: Evidence supports multiple non-title decision points
- **WHEN** platform V1 product evidence contains at least four distinct objective facts across identity, visible construction, specifications, variants, quantity, or package contents
- **THEN** the prompt requests four to five distinct selling points and three to four objective pre-purchase checks
- **AND** each entry uses a complete, specific statement rather than an isolated label or generic adjective
- **AND** every pain point question is answered with a supplied fact instead of saying that information is unknown, missing, or not specified
- **AND** no entry introduces a function, effect, performance result, benefit, or problem-solution claim

#### Scenario: Fixed bullets divide supported facts by responsibility
- **WHEN** a platform V1 Listing is generated
- **THEN** the prompt retains the fixed five-bullet labels in their existing order
- **AND** product identity, pack or variant details, visible construction, supplied specifications, and package contents are assigned to their matching bullet
- **AND** the same sentence or decision point is not repeated under multiple labels

#### Scenario: Description uses supported facts without padding
- **WHEN** evidence and platform limits permit a fuller description
- **THEN** the prompt organizes facts in the order of product identity, visible construction, specifications, variants, quantity, and package contents
- **AND** it uses short natural paragraphs rather than a list of disconnected fragments
- **AND** it targets 350 to 500 English characters when the evidence supports that range
- **AND** it never exceeds the existing 500-character universal field limit or a stricter platform limit
- **AND** it does not repeat the title or other fields merely to meet a target length

#### Scenario: Search terms and keyword buckets have distinct coverage
- **WHEN** backend search terms and keyword buckets are generated
- **THEN** the prompt assigns exact category phrases, objective attribute long tails, broader directly relevant categories, and descriptive attribute phrases to distinct search surfaces
- **AND** it removes case-only, punctuation-only, mechanical singular/plural, and semantic duplicates within and across keyword buckets
- **AND** it excludes functions, effects, competitors, unsupported claims, and irrelevant traffic terms

#### Scenario: English and Chinese non-title fields correspond
- **WHEN** the bilingual platform V1 result is returned
- **THEN** corresponding arrays preserve the same item counts, order, facts, quantities, and units
- **AND** Chinese content translates the matching English meaning without adding or removing claims

#### Scenario: Product evidence is insufficient for recommended completeness
- **WHEN** the source does not support the recommended number of distinct facts or the platform hard limit is smaller
- **THEN** the prompt instructs the model to return fewer supported entries or shorter content
- **AND** it does not duplicate, paraphrase, infer, or invent facts to reach a count or length target
- **AND** title generation continues to use the existing title rules without modification
