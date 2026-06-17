## Purpose

Image Edit Mode provides a focused GPT Image 2 workflow for editing exactly one uploaded source image with a text instruction while reusing the Studio generation queue, preview, and gallery persistence flows.

## Requirements

### Requirement: Image Edit Mode is an independent Create view
The system SHALL expose Image Edit Mode through the Create menu at `#image-edit` and SHALL keep its uploaded source image, edit instruction, generated preview state, thumbnail state, and feedback independent from prompt mode, style transfer, reference analysis, image decomposition, quick blend, Creation Mode, Portrait Mode, Article Illustration, and PPT generation.

#### Scenario: User opens Image Edit
- **WHEN** the user opens `#image-edit`
- **THEN** the system displays a single-image upload area
- **AND** it displays an edit instruction input
- **AND** it displays ratio, resolution, and output format controls consistent with other Create modes
- **AND** it displays a generated preview area and thumbnail strip
- **AND** it does not prefill the source image from any other Create mode

### Requirement: Image Edit accepts exactly one source image
The system SHALL require exactly one valid image file when `mode=image-edit` is submitted to `/api/generate`.

#### Scenario: User submits one source image
- **WHEN** the user starts Image Edit with one valid source image and a non-empty edit instruction
- **THEN** the browser submits that file as the only generation reference
- **AND** the backend accepts the request

#### Scenario: User submits no source image
- **WHEN** the user starts Image Edit without a source image
- **THEN** the browser or backend rejects the request with visible feedback
- **AND** no image edit request is sent upstream

#### Scenario: User submits multiple source images
- **WHEN** the backend receives `mode=image-edit` with more than one reference image
- **THEN** the backend rejects the request with visible feedback
- **AND** no image edit request is sent upstream

#### Scenario: User submits a non-image source
- **WHEN** the backend receives `mode=image-edit` with a reference file whose MIME type is not an image type
- **THEN** the backend rejects the request with visible feedback
- **AND** no image edit request is sent upstream

### Requirement: Image Edit requires an edit instruction
The system SHALL require a non-empty edit instruction for Image Edit jobs and SHALL preserve that instruction in queued job data and saved metadata.

#### Scenario: User enters an edit instruction
- **WHEN** the user uploads one source image and enters an edit instruction
- **THEN** the generation action can be enabled when queue limits allow
- **AND** the queued job contains the edit instruction as the prompt

#### Scenario: Edit instruction is empty
- **WHEN** the user uploads a source image but leaves the edit instruction empty
- **THEN** the generation action is disabled or rejected with visible feedback
- **AND** no image edit request is sent upstream

### Requirement: Image Edit calls the GPT Image 2 edits endpoint
The system SHALL call the Image API edits endpoint for Image Edit jobs using `model=gpt-image-2`, the uploaded source image, the edit instruction prompt, normalized size, configured quality, and configured output format.

#### Scenario: Backend submits an image edit
- **WHEN** `/api/generate` receives `mode=image-edit` with one valid source image and a non-empty edit instruction
- **THEN** the backend sends a request to `/v1/images/edits`
- **AND** the request includes `model=gpt-image-2`
- **AND** the request includes the uploaded image as the edit source
- **AND** the request includes the edit instruction as `prompt`
- **AND** the request includes the selected size, quality, and output format

#### Scenario: Upstream returns a final edited image
- **WHEN** the upstream edit request returns base64 image data
- **THEN** the system emits the edited image through the existing final-image SSE path
- **AND** the system saves the edited image to the gallery
- **AND** the system completes the generation task

#### Scenario: Upstream rejects the edit request
- **WHEN** the upstream edit request returns an error
- **THEN** the system emits an error through the existing SSE error path
- **AND** the generation task is marked failed
- **AND** other Create modes remain usable

### Requirement: Image Edit results are saved as gallery assets
The system SHALL save completed Image Edit outputs into the normal gallery with image-edit metadata.

#### Scenario: Image Edit generation completes
- **WHEN** an Image Edit job saves successfully
- **THEN** the result appears in the normal gallery
- **AND** saved metadata includes `generationMode: image-edit`
- **AND** saved metadata includes `assetKind: image-edit`
- **AND** saved metadata includes `sourceImageName`
- **AND** saved metadata includes `editInstruction`
- **AND** the output path uses the dated `image-edit` image folder

#### Scenario: Gallery item is deleted or history is cleared
- **WHEN** the user deletes an Image Edit gallery item or clears history
- **THEN** Image Edit preview state no longer points to the removed saved asset
- **AND** other Create modes remain unaffected

### Requirement: Image Edit v1 excludes masks
The system SHALL treat Image Edit v1 as whole-image editing and SHALL NOT expose mask painting or mask upload controls.

#### Scenario: User opens Image Edit controls
- **WHEN** the user opens `#image-edit`
- **THEN** the system displays source upload and edit instruction controls
- **AND** it does not display brush, erase, mask upload, or alpha-mask controls
