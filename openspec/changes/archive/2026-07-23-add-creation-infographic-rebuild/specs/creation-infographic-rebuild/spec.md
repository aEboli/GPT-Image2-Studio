## ADDED Requirements

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
Each `infographic-rebuild` item SHALL use its corresponding source infographic as the only visual and information authority. The prompt MUST preserve the source image's visible product, text and language, numbers, units, parameters, claims, hierarchy, typography, colors, background, icons, arrows, callouts, layout, crop, proportions, relative positions, and reading order without replacement, translation, reinterpretation, omission, addition, or restyling.

#### Scenario: One source infographic creates one faithful rebuild prompt
- **WHEN** the plan appends an `infographic-rebuild` item for a dimensions, usage, package, material, scene, or other reference
- **THEN** that item uses the canonical source-only reconstruction prompt
- **AND** the prompt requires keeping every visible source element unchanged
- **AND** the prompt forbids replacing the visible product, translating or rewriting text, redesigning the layout, or adding and removing content
- **AND** if the configured output canvas differs from the source, the prompt allows only extending the existing background or margins without cropping, stretching, rearranging, or redesigning source content

#### Scenario: Suite context changes without changing the rebuild prompt
- **WHEN** the user changes product information, subject references, Logo, platform, category, scenario, visual language, target language, reference analysis notes, audience strategy, or conversion intent while the same source infographic remains selected
- **THEN** the `infographic-rebuild` item prompt remains unchanged
- **AND** none of those suite fields is inserted into the reconstruction prompt

### Requirement: Infographic rebuild uses scoped reference images
Generation requests for an `infographic-rebuild` item SHALL attach exactly that item's corresponding original uploaded source infographic file. Subject references, other non-subject references, Logo references, removed standalone style-reference inputs, and generation-compressed JPEG proxies MUST NOT be attached. If the source metadata cannot be matched to an uploaded image, the system MUST fail closed without falling back to the complete uploaded reference set.

#### Scenario: Rebuild generation sends only relevant references
- **WHEN** a Creation set has 3 subject references and 5 non-subject references
- **THEN** each `infographic-rebuild` generation request includes exactly the one non-subject reference that owns the current rebuild item
- **AND** it does not include the 3 subject references, the other 4 non-subject references, or an uploaded Logo
- **AND** the matching source is not downscaled or re-encoded by the browser's general generation-reference compression path

### Requirement: Infographic rebuild imports only technical generation parameters
The system SHALL continue passing the rebuild item's frozen model route, model, ratio, size, quality, format, and reasoning parameters to the image-generation API. It MUST NOT turn target language, platform, product, reference-analysis, visual-style, Logo, audience, or conversion fields into reconstruction prompt instructions or additional image inputs.

#### Scenario: Rebuild generation uses saved technical parameters
- **WHEN** an `infographic-rebuild` item is generated or repaired with saved technical parameters
- **THEN** the request sends those technical parameters through the existing API fields
- **AND** the final reconstruction prompt remains the canonical source-only prompt
- **AND** the reference image collection contains only the matching source infographic

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
