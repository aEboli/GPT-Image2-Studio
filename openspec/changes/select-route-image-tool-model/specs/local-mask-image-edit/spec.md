# local-mask-image-edit

## MODIFIED Requirements

### Requirement: Merge strategy performs one local edit request
The system SHALL perform one upstream image edit request for local-mask jobs using the merge strategy. That request SHALL carry the configured route-mode image tool model, which SHALL default to `gpt-image-2` when the user has not selected another allowlisted option.

#### Scenario: Backend runs merge strategy
- **WHEN** `/api/generate` receives `mode=image-edit`, `editMode=local-mask`, `executionStrategy=merge`, one normalized source image, one merged mask, and valid region instructions
- **THEN** the backend sends one request to `/v1/images/edits`
- **AND** the request includes the configured image tool model as `model`
- **AND** the request includes the normalized source image as `image`
- **AND** the request includes the merged alpha mask as `mask`
- **AND** the prompt instructs the model to edit only masked regions and preserve unmasked areas
- **AND** the prompt includes each region instruction with its region index

#### Scenario: Merge strategy follows a changed tool model
- **WHEN** the image tool model is set to `gpt-image-2.5-sunburst` and a merge-strategy local-mask edit is submitted
- **THEN** the `/v1/images/edits` request carries `model=gpt-image-2.5-sunburst`
