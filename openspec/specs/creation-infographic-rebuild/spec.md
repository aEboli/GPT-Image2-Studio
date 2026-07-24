# creation-infographic-rebuild Specification

## Purpose
TBD - created by archiving change add-creation-infographic-rebuild. Update Purpose after archive.
## Requirements
### Requirement: Creation Mode can append infographic rebuild items
The system SHALL provide an `infographicRebuildEnabled` option in Creation Mode that defaults to disabled. When explicitly enabled, or when the zero-carousel dedicated rebuild flow requires it, the Creation Mode plan SHALL append one `infographic-rebuild` item after the selected carousel roles and after any SKU items for every uploaded Creation reference image whose role is not `product` or `reference-product`.

#### Scenario: Enabled rebuild appends non-subject references
- **WHEN** the user plans a Creation set with 3 subject references and 5 non-subject references
- **THEN** the plan includes the selected carousel role items
- **AND** the plan includes 5 additional `infographic-rebuild` items after the carousel and SKU items
- **AND** each additional item records the source infographic filename and role

#### Scenario: Disabled rebuild preserves existing plan shape
- **WHEN** the user turns off infographic rebuild before previewing or generating
- **THEN** the plan includes only the selected carousel role items and SKU items
- **AND** no `infographic-rebuild` items are appended

### Requirement: Infographic rebuild faithfully reconstructs only its source image
Each `infographic-rebuild` item SHALL use its corresponding source infographic as the only visual and information authority, except for the selected target language, output format, resolution, and aspect ratio. The runtime prompt MUST reproduce all visible source text completely in the selected target language without summarization or invention. It MUST preserve the source image's visible product identity and variant, brand names, model names, spelling of non-translatable identifiers, numbers, units, parameters, claims, steps, lists, and the semantic relationships expressed by icons, arrows, callouts, and groupings.

The prompt MUST also require a substantial visual reconstruction rather than a near-copy. It SHALL require a new overall layout and information architecture and SHALL require materially changing at least three additional visual dimensions among composition and subject placement, background treatment, typography system, color treatment, spacing and grouping, and the design of cards, icons, arrows, callouts, or other information components. The result MUST be immediately recognizable as a newly designed infographic while communicating only the source image's information. Upscaling, cleanup, sharpening, small spacing adjustments, a minor color shift, or restyling the same grid MUST NOT satisfy the reconstruction requirement.

#### Scenario: One source infographic creates one faithful rebuild prompt
- **WHEN** the plan appends an `infographic-rebuild` item for a dimensions, usage, package, material, scene, or other reference
- **THEN** that item uses the canonical source-only reconstruction base prompt
- **AND** generation appends only the selected target language, output format, resolution, and aspect ratio as runtime output controls
- **AND** the prompt requires preserving the source product identity and all visible factual content and logical relationships
- **AND** the prompt requires a new layout and information architecture plus material changes across at least three additional visual dimensions
- **AND** the prompt forbids near-copying the source layout or treating cleanup, sharpening, minor spacing, or minor color changes as reconstruction
- **AND** the prompt forbids replacing the product, changing facts, summarizing text, or adding and removing content
- **AND** if the configured output canvas differs from the source, the prompt requires reflowing the complete content into the new canvas without stretching the product, clipping information, or placing an unchanged source composition on extended margins

#### Scenario: Suite context changes without changing the rebuild prompt
- **WHEN** the user changes product information, subject references, Logo, platform, category, scenario, visual language, reference analysis notes, audience strategy, or conversion intent while the same source infographic and four output controls remain selected
- **THEN** the `infographic-rebuild` item runtime prompt remains unchanged
- **AND** none of those suite fields is inserted into the reconstruction prompt

#### Scenario: Visual freedom does not permit information drift
- **WHEN** the canonical prompt allows a new layout, hierarchy, composition, background, typography, colors, spacing, or component styling
- **THEN** those changes apply only to visual presentation
- **AND** the visible product identity, variant, parts, quantities, text meaning, brand names, model names, numbers, units, parameters, claims, steps, lists, and logical relationships remain constrained to the single source infographic

#### Scenario: Runtime prompt honors selected target language
- **WHEN** an `infographic-rebuild` item is generated with a selected target language
- **THEN** the runtime prompt requires all translatable visible source text to be rendered completely in that language
- **AND** it preserves brand names, model names, numbers, units, parameters, claims, steps, lists, and logical relationships
- **AND** it does not import any other suite content or visual context

#### Scenario: Output controls do not weaken source isolation
- **WHEN** the target language, output format, resolution, or aspect ratio differs from the source infographic
- **THEN** the runtime prompt identifies only those four values as selected output controls
- **AND** the complete source content is reflowed into the selected canvas without stretching the product, clipping information, or adding filler content
- **AND** subject references, other infographics, Logo, product fields, platform, audience, marketing, and visual-style context remain excluded

### Requirement: Infographic rebuild uses scoped reference images
Generation requests for an `infographic-rebuild` item SHALL attach exactly that item's corresponding original uploaded source infographic file. Subject references, other non-subject references, Logo references, removed standalone style-reference inputs, and generation-compressed JPEG proxies MUST NOT be attached. If the source metadata cannot be matched to an uploaded image, the system MUST fail closed without falling back to the complete uploaded reference set.

#### Scenario: Rebuild generation sends only relevant references
- **WHEN** a Creation set has 3 subject references and 5 non-subject references
- **THEN** each `infographic-rebuild` generation request includes exactly the one non-subject reference that owns the current rebuild item
- **AND** it does not include the 3 subject references, the other 4 non-subject references, or an uploaded Logo
- **AND** the matching source is not downscaled or re-encoded by the browser's general generation-reference compression path

### Requirement: Infographic rebuild imports only technical generation parameters
The system SHALL continue passing the rebuild item's frozen model route, model, ratio, size, quality, format, and reasoning parameters to the image-generation API. The selected target language SHALL be the only suite field added as a reconstruction prompt instruction, and it SHALL control only faithful translation of visible source text. The system MUST NOT turn platform, product, reference-analysis, visual-style, Logo, audience, marketing, or conversion fields into reconstruction prompt instructions or additional image inputs.

#### Scenario: Rebuild generation uses saved technical parameters
- **WHEN** an `infographic-rebuild` item is generated or repaired with saved output and technical parameters
- **THEN** the request sends those technical parameters through the existing API fields
- **AND** the runtime reconstruction prompt contains the saved target language, output format, resolution, and aspect ratio
- **AND** the reference image collection contains only the matching source infographic
- **AND** no other suite field is inserted into the reconstruction prompt

### Requirement: Infographic rebuild is persisted and repairable
The system SHALL persist `infographicRebuildEnabled` and appended `infographic-rebuild` items in Creation set manifests. Repair requests SHALL preserve the original setting and rebuild items unless the user explicitly submits a new plan.

#### Scenario: Saved set records include rebuild items
- **WHEN** a Creation set with infographic rebuild completes or partially fails
- **THEN** its manifest stores `infographicRebuildEnabled`
- **AND** each rebuild item stores its role, title, prompt, source infographic filename, source role, status, and saved image path when available

#### Scenario: Repair keeps rebuild items
- **WHEN** the user repairs a failed or missing `infographic-rebuild` item and re-uploads the matching source references when the saved record no longer has browser file objects
- **THEN** the repair request regenerates that item from the saved set metadata and source infographic reference metadata
- **AND** it does not drop the rebuild item because it is outside the selected 16 carousel roles
- **AND** generation uses the canonical runtime reconstruction prompt even if the saved item prompt predates source-only isolation
- **AND** the request fails closed when the matching source file is not available

### Requirement: Infographic rebuild honors selected output controls
The system SHALL apply the selected target language, output format, resolution, and aspect ratio to every `infographic-rebuild` generation request. Target language SHALL control visible translatable text through the runtime prompt. Output format, effective resolution, and aspect ratio SHALL be sent through the existing image-generation API parameters. Generation records SHALL persist the resolved values, and repair SHALL reuse the saved item values.

#### Scenario: Local and Worker generation use four selected controls
- **WHEN** an `infographic-rebuild` item is generated through Local or Worker
- **THEN** its runtime prompt contains the resolved target language, output format, requested/effective resolution, and aspect ratio
- **AND** the API request uses the matching output format, effective size, and aspect ratio
- **AND** the generation record stores those same resolved values

#### Scenario: Repair preserves four selected controls
- **WHEN** a saved `infographic-rebuild` item is repaired
- **THEN** repair rebuilds the runtime prompt from the saved target language, output format, resolution, and aspect ratio
- **AND** it sends those saved values through the image-generation API
- **AND** it still attaches only the matching original source infographic
