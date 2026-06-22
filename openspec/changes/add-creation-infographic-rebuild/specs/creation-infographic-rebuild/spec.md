## ADDED Requirements

### Requirement: Creation Mode can append infographic rebuild items
The system SHALL provide an `infographicRebuildEnabled` option in Creation Mode that defaults to enabled. When enabled, the Creation Mode plan SHALL append one `infographic-rebuild` item after the selected carousel roles and after any SKU items for every uploaded Creation reference image whose role is not `product` or `reference-product`.

#### Scenario: Enabled rebuild appends non-subject references
- **WHEN** the user plans a Creation set with 3 subject references and 5 non-subject references
- **THEN** the plan includes the selected carousel role items
- **AND** the plan includes 5 additional `infographic-rebuild` items after the carousel and SKU items
- **AND** each additional item records the source infographic filename and role

#### Scenario: Disabled rebuild preserves existing plan shape
- **WHEN** the user turns off infographic rebuild before previewing or generating
- **THEN** the plan includes only the selected carousel role items and SKU items
- **AND** no `infographic-rebuild` items are appended

### Requirement: Infographic rebuild preserves source information with product subjects
Each `infographic-rebuild` item SHALL instruct generation to use its source infographic reference as the information and layout blueprint while using the subject reference images as the product subject. The prompt MUST preserve the original source information, hierarchy, labels, steps, dimensions, package contents, scenarios, and callout intent without adding unsupported facts or changing the provided information.

#### Scenario: One source infographic creates one faithful rebuild prompt
- **WHEN** the plan appends an `infographic-rebuild` item for a dimensions, usage, package, material, scene, style, or other reference
- **THEN** that item prompt names the source infographic filename
- **AND** the prompt requires keeping the source information unchanged
- **AND** the prompt requires replacing or recomposing the visible product subject with the uploaded subject reference
- **AND** the prompt forbids unsupported new parameters, claims, certifications, sizes, steps, accessories, materials, or guarantees

### Requirement: Infographic rebuild uses scoped reference images
Generation requests for an `infographic-rebuild` item SHALL attach only the selected subject reference images, that item's source infographic reference image, style reference images, and optional Logo reference. Other non-subject infographic references MUST NOT be attached to that item.

#### Scenario: Rebuild generation sends only relevant references
- **WHEN** a Creation set has 3 subject references and 5 non-subject references
- **THEN** each `infographic-rebuild` generation request includes the 3 subject references
- **AND** it includes only the one non-subject reference that owns the current rebuild item
- **AND** it does not include the other 4 non-subject references

### Requirement: Infographic rebuild is persisted and repairable
The system SHALL persist `infographicRebuildEnabled` and appended `infographic-rebuild` items in Creation set manifests. Repair requests SHALL preserve the original setting and rebuild items unless the user explicitly submits a new plan.

#### Scenario: Saved set records include rebuild items
- **WHEN** a Creation set with infographic rebuild completes or partially fails
- **THEN** its manifest stores `infographicRebuildEnabled`
- **AND** each rebuild item stores its role, title, prompt, source infographic filename, source role, status, and saved image path when available

#### Scenario: Repair keeps rebuild items
- **WHEN** the user repairs a failed or missing `infographic-rebuild` item
- **THEN** the repair request regenerates that item from the saved set metadata and source infographic reference metadata
- **AND** it does not drop the rebuild item because it is outside the selected 16 carousel roles
