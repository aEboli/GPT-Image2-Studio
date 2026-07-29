## ADDED Requirements

### Requirement: Local mask editing is available after source upload
The system SHALL provide a local mask workflow inside Image Edit Mode after the user uploads exactly one source image.

#### Scenario: User uploads a source image
- **WHEN** the user uploads one valid source image in `#image-edit`
- **THEN** the system displays a source-image canvas editor
- **AND** it displays brush, eraser, undo, redo, brush size, add region, region list, and execution strategy controls
- **AND** it keeps the existing whole-image edit instruction and generation preview available

#### Scenario: User has not uploaded a source image
- **WHEN** the user opens `#image-edit` without a source image
- **THEN** the system does not allow local-mask generation
- **AND** it prompts the user to upload one source image first

### Requirement: Users can manage multiple editable regions
The system SHALL let users create, select, clear, hide, show, and delete multiple painted regions, with each region retaining a stable id, stable index, color, instruction, mask state, and visibility state.

#### Scenario: User creates a region
- **WHEN** the user clicks the add-region control
- **THEN** the system creates a new region with a stable id
- **AND** the region receives the next stable index and a visible color swatch
- **AND** the new region becomes the active painting target

#### Scenario: User selects a region
- **WHEN** the user selects a region from the region list
- **THEN** the system makes that region active
- **AND** brush and eraser strokes affect only that region's mask

#### Scenario: User clears a region
- **WHEN** the user clears the active region
- **THEN** the system removes that region's mask pixels
- **AND** it keeps the region card and instruction text

#### Scenario: User deletes a region
- **WHEN** the user deletes the active region
- **THEN** the system removes the region's mask, instruction, and region card
- **AND** it selects the nearest remaining region when one exists
- **AND** it does not renumber previously created regions

### Requirement: Brush tools edit alpha masks on the original image canvas
The system SHALL let users paint and erase circular strokes on the active region while previewing colored overlays on the source image.

#### Scenario: User paints on the canvas
- **WHEN** the user drags the brush across the source image canvas
- **THEN** the system adds editable mask pixels to the active region at the corresponding source-image coordinates
- **AND** it displays a semi-transparent overlay in that region's color
- **AND** it marks the active region as having a mask

#### Scenario: User erases on the canvas
- **WHEN** the user drags the eraser across the source image canvas
- **THEN** the system removes mask pixels from the active region at the corresponding source-image coordinates
- **AND** it updates the region's has-mask state based on remaining pixels

#### Scenario: User changes brush size
- **WHEN** the user changes the brush size control
- **THEN** subsequent brush and eraser strokes use the selected circular radius
- **AND** the canvas layout does not resize or shift

#### Scenario: User uses undo or redo
- **WHEN** the user triggers undo or redo
- **THEN** the system restores the active region's previous or next mask state
- **AND** it does not alter any other region's mask

### Requirement: Local mask jobs validate regions before generation
The system SHALL submit local-mask Image Edit jobs only when there is one source image, at least one painted region, and every painted region has a non-empty instruction.

#### Scenario: User submits with valid painted regions
- **WHEN** the user has one source image and one or more painted regions with non-empty instructions
- **THEN** the local-mask generation action can be enabled when queue limits allow
- **AND** the generated job contains only painted regions with non-empty instructions

#### Scenario: User submits without a painted region
- **WHEN** the user requests local-mask generation without any painted region
- **THEN** the system rejects the request with visible feedback
- **AND** no upstream image edit request is sent

#### Scenario: Painted region is missing instruction
- **WHEN** a painted region has an empty instruction
- **THEN** the system rejects the request with visible feedback naming that region
- **AND** no upstream image edit request is sent

#### Scenario: Empty unpainted region exists
- **WHEN** a region has no mask pixels
- **THEN** the system excludes that region from local-mask generation
- **AND** it does not require an instruction for that empty region

### Requirement: Local mask requests use same-size PNG source and alpha masks
The system SHALL submit local-mask edit requests with a normalized PNG source image and PNG alpha masks that match the source image's natural pixel dimensions.

#### Scenario: Browser builds a merge request
- **WHEN** the user submits a local-mask job with `executionStrategy=merge`
- **THEN** the browser appends `editMode=local-mask`
- **AND** it appends `executionStrategy=merge`
- **AND** it appends one normalized PNG source image as the only reference image
- **AND** it appends one merged PNG alpha mask as `mask`
- **AND** it appends `regionInstructions` JSON for every included region

#### Scenario: Browser builds a sequential request
- **WHEN** the user submits a local-mask job with `executionStrategy=sequential`
- **THEN** the browser appends `editMode=local-mask`
- **AND** it appends `executionStrategy=sequential`
- **AND** it appends one normalized PNG source image as the only reference image
- **AND** it appends one PNG alpha mask per included region as `masks[]`
- **AND** it appends `regionInstructions` JSON in the same order as the masks

#### Scenario: Backend receives invalid local-mask files
- **WHEN** the backend receives a local-mask request with missing masks, a non-image mask, a mask over 50 MB, or an unsupported execution strategy
- **THEN** the backend rejects the request with visible feedback
- **AND** no upstream image edit request is sent

### Requirement: Merge strategy performs one local edit request
The system SHALL perform one upstream image edit request for local-mask jobs using the merge strategy.

#### Scenario: Backend runs merge strategy
- **WHEN** `/api/generate` receives `mode=image-edit`, `editMode=local-mask`, `executionStrategy=merge`, one normalized source image, one merged mask, and valid region instructions
- **THEN** the backend sends one request to `/v1/images/edits`
- **AND** the request includes `model=gpt-image-2`
- **AND** the request includes the normalized source image as `image`
- **AND** the request includes the merged alpha mask as `mask`
- **AND** the prompt instructs the model to edit only masked regions and preserve unmasked areas
- **AND** the prompt includes each region instruction with its region index

### Requirement: Sequential strategy performs ordered local edit requests
The system SHALL perform one upstream image edit request per included region for local-mask jobs using the sequential strategy.

#### Scenario: Backend runs sequential strategy
- **WHEN** `/api/generate` receives `mode=image-edit`, `editMode=local-mask`, `executionStrategy=sequential`, one normalized source image, ordered masks, and ordered region instructions
- **THEN** the backend sends one request to `/v1/images/edits` for each included region
- **AND** the first request uses the normalized source image
- **AND** each later request uses the previous request's output image as its source image
- **AND** each request includes the matching region alpha mask and region instruction
- **AND** only the final output image is emitted as the completed gallery asset

#### Scenario: Sequential request fails at a region
- **WHEN** an upstream request fails during sequential local-mask editing
- **THEN** the system emits an error through the existing SSE error path
- **AND** it identifies the current region in the task feedback when available
- **AND** it does not save partial intermediate outputs as gallery assets

### Requirement: Local mask results are saved with region metadata
The system SHALL save completed local-mask Image Edit outputs as normal gallery assets with local-mask metadata.

#### Scenario: Local mask generation completes
- **WHEN** a local-mask Image Edit job saves successfully
- **THEN** the result appears in the normal gallery
- **AND** saved metadata includes `generationMode: image-edit`
- **AND** saved metadata includes `assetKind: image-edit`
- **AND** saved metadata includes `editMode: local-mask`
- **AND** saved metadata includes `executionStrategy`
- **AND** saved metadata includes `regionCount`
- **AND** saved metadata includes `regionInstructions`
- **AND** saved metadata includes `sourceImageName`
- **AND** saved metadata includes `editInstruction`

#### Scenario: Gallery item is deleted or history is cleared
- **WHEN** the user deletes a local-mask Image Edit gallery item or clears history
- **THEN** Image Edit preview state no longer points to the removed saved asset
- **AND** source image and local mask editor state remain independent from other Create modes
