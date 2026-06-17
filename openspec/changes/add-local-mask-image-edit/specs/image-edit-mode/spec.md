## ADDED Requirements

### Requirement: Image Edit offers optional local mask editing
The system SHALL keep whole-image Image Edit as the default workflow and SHALL offer local mask editing as an optional workflow inside the same `#image-edit` view.

#### Scenario: User opens Image Edit controls
- **WHEN** the user opens `#image-edit`
- **THEN** the system displays source upload, edit instruction, ratio, resolution, output format, preview, and thumbnail controls
- **AND** it can display local mask controls after a source image is uploaded
- **AND** users who do not create painted regions can still use the whole-image edit workflow

#### Scenario: User submits whole-image edit
- **WHEN** the user starts Image Edit without `editMode=local-mask`
- **THEN** the backend uses the existing whole-image edit request behavior
- **AND** no mask is required

#### Scenario: User submits local-mask edit
- **WHEN** the user starts Image Edit with `editMode=local-mask`
- **THEN** the backend applies local-mask validation and execution behavior
- **AND** existing whole-image Image Edit requirements still apply unless superseded by local-mask requirements

## REMOVED Requirements

### Requirement: Image Edit v1 excludes masks
**Reason**: Image Edit now supports an optional local mask workflow with brush, eraser, and alpha-mask generation controls.

**Migration**: Users can continue whole-image editing without painted regions. Local-mask jobs use `editMode=local-mask` and follow the new local-mask requirements.
