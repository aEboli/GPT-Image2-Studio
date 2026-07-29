## ADDED Requirements

### Requirement: PPT generation supports selectable PPTX export modes
The system SHALL allow the user to choose between the existing full-slide image PPTX export and a local editable reconstruction PPTX export before starting PPT generation. The system SHALL default to the existing full-slide image export.

#### Scenario: User uses the default export mode
- **WHEN** the user starts PPT generation without changing the export mode
- **THEN** the system generates the same ordinary PPTX format as before
- **AND** no editable reconstruction step is required

#### Scenario: User selects editable reconstruction
- **WHEN** the user selects editable reconstruction and starts PPT generation
- **THEN** the system first generates the ordinary slide images and ordinary PPTX
- **AND** the system then attempts to generate an additional editable reconstruction PPTX in local environments that support the Presentations artifact-tool runtime

### Requirement: Editable reconstruction preserves ordinary PPTX availability
The system SHALL always keep the ordinary full-slide image PPTX available when PPT generation succeeds, even if editable reconstruction is unavailable, partially degraded, or fails.

#### Scenario: Editable runtime is unavailable
- **WHEN** editable reconstruction is requested but the local Presentations artifact-tool runtime cannot be found or loaded
- **THEN** the system returns a visible warning
- **AND** the ordinary PPTX remains downloadable
- **AND** the deck record does not claim an editable PPTX was produced

#### Scenario: Editable reconstruction fails after ordinary export
- **WHEN** ordinary PPTX export succeeds and editable reconstruction fails
- **THEN** the system records the reconstruction failure as a warning or error state
- **AND** the ordinary PPTX remains downloadable

### Requirement: Editable reconstruction prefers artifact-tool slide modules
The system SHALL first attempt to reconstruct each generated slide image as a local artifact-tool slide module. The module SHALL be validated before execution and SHALL be limited to the local Presentations helper context.

#### Scenario: Slide image is rebuilt as an artifact module
- **WHEN** the system analyzes a generated slide image for editable reconstruction
- **THEN** it first requests a `slide-XX.mjs` artifact-tool module for that page
- **AND** the module uses editable text, shapes, image objects, and icon helpers where safe
- **AND** the module creates exactly one PowerPoint slide

#### Scenario: Artifact module uses blocked local code
- **WHEN** a generated artifact module imports modules, calls `require`, accesses `process`, uses filesystem or network APIs, or uses dynamic code execution
- **THEN** the system rejects that module
- **AND** the slide falls back to the safer reconstruction path

#### Scenario: Artifact module build fails
- **WHEN** one or more generated artifact modules fail during Presentations artifact-tool build
- **THEN** the system retries the editable deck using the element-level fallback modules
- **AND** it records a warning for the module-level failure

### Requirement: Editable reconstruction uses a structured slide manifest as fallback
The system SHALL create a reconstruction manifest for a generated slide image when artifact module reconstruction is unavailable or invalid. The manifest SHALL describe slide canvas size, source image, elements, element bounding boxes, editable type, confidence, and warnings.

#### Scenario: Slide image is analyzed for reconstruction
- **WHEN** the system analyzes a generated slide image through the fallback reconstruction path
- **THEN** it produces a manifest with `slideNumber`, `sourceImage`, `canvas`, and `elements`
- **AND** each element has a supported type, bounding box, confidence score, and editable strategy

#### Scenario: Element confidence is low
- **WHEN** a text, table, chart, or diagram element has low confidence
- **THEN** the system SHALL fall back to an image-region or fallback-image strategy for that element
- **AND** it SHALL NOT write uncertain OCR text as a high-confidence editable text box

### Requirement: Editable reconstruction builds a PowerPoint-editable deck
The system SHALL use the local Presentations artifact-tool workflow to generate the editable reconstruction PPTX. The generated deck SHALL attempt to use editable PowerPoint objects for high-confidence text, tables, shapes, lines, and simple structures, while using independent image layers for complex or uncertain regions.

#### Scenario: High-confidence text is reconstructed
- **WHEN** a manifest contains high-confidence text with a valid bounding box
- **THEN** the editable PPTX contains a PowerPoint text object at the corresponding position
- **AND** the text object can be selected and edited in PowerPoint

#### Scenario: Complex visual region is reconstructed
- **WHEN** a manifest contains a complex image, screenshot, illustration, low-confidence chart, or uncertain region
- **THEN** the editable PPTX contains an independently selectable image object for that region
- **AND** the region can be moved, resized, or deleted in PowerPoint

#### Scenario: Page cannot be safely decomposed
- **WHEN** a slide page cannot be safely decomposed into reliable elements
- **THEN** the editable PPTX SHALL include that slide as a fallback image slide
- **AND** the system SHALL record a warning for that slide

### Requirement: PPT records expose ordinary and editable downloads
The system SHALL store editable reconstruction PPTX metadata in the deck manifest when the editable PPTX is produced. PPT records SHALL show an editable download action only when the editable PPTX exists.

#### Scenario: Deck has both PPTX files
- **WHEN** a PPT record includes ordinary and editable PPTX metadata
- **THEN** the record view shows download actions for both files

#### Scenario: Deck has only ordinary PPTX
- **WHEN** a PPT record has no editable PPTX metadata
- **THEN** the record view shows the ordinary PPTX download
- **AND** it does not show a broken editable download link

### Requirement: Cloud deployments remain safe without artifact-tool
The system SHALL NOT require the Presentations artifact-tool runtime in Cloudflare Worker, Cloudflare Pages, or Vercel deployment paths. Cloud environments SHALL preserve ordinary PPTX output and either ignore editable reconstruction or return a clear unsupported warning.

#### Scenario: Worker receives editable reconstruction request
- **WHEN** the Cloudflare Worker receives a PPT generation request with editable reconstruction selected
- **THEN** it generates the ordinary PPTX using the existing cloud-safe path
- **AND** it does not attempt to load artifact-tool
- **AND** it reports that editable reconstruction is a local-only capability when needed
