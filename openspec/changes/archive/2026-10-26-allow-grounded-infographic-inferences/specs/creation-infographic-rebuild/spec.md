## MODIFIED Requirements

### Requirement: Infographic rebuild faithfully reconstructs only its source image
Each `infographic-rebuild` item SHALL use its corresponding source infographic as the only visual and information authority, except for the selected target language, output format, resolution, and aspect ratio. The source SHALL be treated as a closed inventory of allowable content. Every output heading, label, caption, specification, badge, icon, arrow, callout, list, and grouping SHALL map to one or more source elements with the same meaning and scope, or to a high-confidence inference directly supported by at least two readable source facts with one unambiguous relationship. Inferred numeric values SHALL be marked approximate or estimated in the selected target language and conservatively rounded; weak, conflicting, or ambiguous inferences and information from outside the source SHALL be omitted. Product appearance SHALL guide product identity and depiction, but SHALL NOT by itself substantiate a written property or benefit. Unreadable source text SHALL be omitted rather than guessed. Text physically printed, engraved, embossed, or embroidered on the depicted product or packaging SHALL remain in its original characters and language. The source image's visible product identity and variant, brand names, model names, spelling of non-translatable identifiers, numbers, units, parameters, claims, steps, lists, and the semantic relationships expressed by icons, arrows, callouts, and groupings SHALL be preserved when readable.

The prompt SHALL also require a substantial visual reconstruction. It SHALL require a new overall layout and information architecture and SHALL require materially changing at least three additional visual dimensions among composition and subject placement, background treatment, typography system, color treatment, spacing and grouping, and the design of cards, icons, arrows, callouts, or other information components. The result SHALL be immediately recognizable as a newly designed infographic while communicating only the source image's information.

The prompt SHALL be phrased as positive design and preservation requirements and SHALL NOT contain `Do not`, `Avoid`, `Never`, `never`, or `不要`. It SHALL contain at most 1700 characters excluding the appended runtime output controls.

#### Scenario: One source infographic creates one faithful rebuild prompt
- **WHEN** the plan appends an `infographic-rebuild` item for a dimensions, usage, package, material, scene, or other reference
- **THEN** that item uses the canonical source-only reconstruction base prompt
- **AND** generation appends only the selected target language, output format, resolution, and aspect ratio as runtime output controls
- **AND** the prompt requires preserving the source product identity and all reliably readable factual content and logical relationships
- **AND** the prompt requires a new layout and information architecture plus material changes across at least three additional visual dimensions
- **AND** the prompt states that a valid rebuild needs a different grid and arrangement rather than an upscaled, cleaned, or lightly restyled source
- **AND** the prompt requires the same product, the same readable facts, and the same readable text content
- **AND** if the configured output canvas differs from the source, the prompt requires reflowing all readable source content into the new canvas with the product kept at its true proportions and every readable information element retained

#### Scenario: Rebuild prompt is compressed and positive
- **WHEN** the canonical reconstruction base prompt is built
- **THEN** it contains at most 1700 characters before runtime output controls are appended
- **AND** it contains no `Do not`, `Avoid`, `Never`, `never`, or `不要` phrasing

#### Scenario: Suite context changes without changing the rebuild prompt
- **WHEN** the user changes product information, subject references, Logo, platform, category, scenario, visual language, reference analysis notes, audience strategy, or conversion intent while the same source infographic and four output controls remain selected
- **THEN** the `infographic-rebuild` item runtime prompt remains unchanged
- **AND** none of those suite fields is inserted into the reconstruction prompt

#### Scenario: Visual freedom does not permit information drift
- **WHEN** the canonical prompt allows a new layout, hierarchy, composition, background, typography, colors, spacing, or component styling
- **THEN** those changes apply only to visual presentation
- **AND** the visible product identity, variant, parts, quantities, reliably readable text meaning, brand names, model names, numbers, units, parameters, claims, steps, lists, and logical relationships remain constrained to the single source infographic, except for qualifying labeled inferences

#### Scenario: Runtime prompt honors selected target language
- **WHEN** an `infographic-rebuild` item is generated with a selected target language
- **THEN** the runtime prompt requires all reliably readable translatable surrounding layout text to be rendered completely in that language
- **AND** it preserves existing text on the depicted physical product or packaging in its original language
- **AND** it preserves reliably readable brand names, model names, numbers, units, parameters, claims, steps, lists, and logical relationships, while marking qualifying derived numeric values approximate
- **AND** it limits its content authority to that single source infographic

#### Scenario: Output controls do not weaken source isolation
- **WHEN** the target language, output format, resolution, or aspect ratio differs from the source infographic
- **THEN** the runtime prompt identifies only those four values as selected output controls
- **AND** all reliably readable source content and qualifying labeled inferences are reflowed into the selected canvas with the product kept at its true proportions
- **AND** subject references, other infographics, Logo, product fields, platform, audience, marketing, and visual-style context remain excluded

#### Scenario: Appearance alone does not support a feature claim
- **WHEN** the source shows a product control, display, material, or shape without source text or a qualifying derivation supporting a related benefit
- **THEN** the rebuild preserves that visible product detail
- **AND** the rebuild adds no written feature or benefit based only on appearance

#### Scenario: Every information component maps to the source
- **WHEN** the rebuild changes the layout, typography, color, icons, callouts, or grouping
- **THEN** every output information component corresponds to source element(s) or a qualifying derivation with the same meaning and scope
- **AND** visual symbols express only the source meaning

#### Scenario: Strongly supported numeric inference is marked approximate
- **WHEN** the source states 45°C for approximately six hours, 55°C for approximately three hours, and that the product has three temperature settings
- **THEN** a rebuild MAY include an approximate middle setting of 50°C for approximately four hours
- **AND** it labels inferred values approximate or estimated in the selected target language and rounds them conservatively
- **AND** it presents no inferred value as directly measured source text

#### Scenario: Weak or ambiguous inferences are omitted
- **WHEN** a proposed inference relies on one source fact, outside product-category knowledge, conflicting values, or more than one plausible relationship
- **THEN** the rebuild omits that inference rather than presenting it as a product fact

#### Scenario: Unreadable source text is omitted
- **WHEN** text in the source infographic cannot be read reliably
- **THEN** the rebuild leaves that text out and uses clean space in its place
- **AND** it does not guess, complete, or replace the unreadable wording with a new claim
