## ADDED Requirements

### Requirement: Portrait Mode 写真模式 is independent

The system SHALL expose Portrait Mode as a separate Create entry at `#portrait` and SHALL NOT reuse ecommerce Creation Mode business state or `/api/creation/*` routes.

#### Scenario: User opens Portrait Mode

- **WHEN** the user opens `#portrait`
- **THEN** the app shows person reference upload, analysis controls, editable subject summary, portrait count, style presets, custom style input, photography notes, output parameters, plan preview, and generated portrait cards.
- **AND** the active generation route is `/api/portrait/generate`.

### Requirement: Portrait reference analysis is safe and editable

The system SHALL analyze uploaded person reference images only into visible, editable, generation-relevant fields.

#### Scenario: User analyzes references

- **WHEN** the user uploads one or more person reference images and clicks analysis
- **THEN** `/api/portrait/reference/analyze` returns visible presentation, height impression, body build impression, pose, clothing, hair, face visibility, distinct visible features, reference roles, safety notes, and confidence.
- **AND** the result does not assert real identity, age, race, nationality, religion, health, disability, pregnancy, sexuality, or other sensitive traits.
- **AND** the user must apply or edit the draft before it becomes the subject summary used for generation.

### Requirement: Analysis can be skipped

The system SHALL allow users to skip image analysis and write a subject summary manually.

#### Scenario: User plans manually

- **WHEN** the user writes a subject summary without running analysis
- **THEN** `/api/portrait/plan` can return a portrait plan without requiring API credentials.

### Requirement: Portrait planning supports clamped 1-100 images

The system SHALL clamp portrait image count to 1 through 100 and SHALL produce one item per effective requested image.

#### Scenario: User previews a portrait plan

- **WHEN** the user requests 12 portrait images with preset styles
- **THEN** the planner returns 12 items with deterministic style, shot type, lens, aperture, depth-of-field, lighting, scene, and prompt fields.

#### Scenario: User requests the maximum count

- **WHEN** the user requests 100 portrait images
- **THEN** the planner returns 100 ordered items with `001` through `100` slot prefixes.

#### Scenario: User enters an out-of-range count

- **WHEN** the user enters a count lower than 1 or higher than 100
- **THEN** the UI and planner use 1 for lower values and 100 for higher values.

### Requirement: Portrait shot sizes are selectable

The system SHALL allow users to choose which portrait shot sizes participate in the plan.

#### Scenario: User chooses selected shot sizes

- **WHEN** the user selects only close-up and extreme close-up shot sizes
- **THEN** the planner cycles planned items only across those selected shot sizes.

#### Scenario: User does not select a shot size

- **WHEN** no shot size is selected
- **THEN** the planner falls back to the full long-shot, full-body, medium-shot, close-up, and extreme-close-up matrix.

### Requirement: Portrait prompts use photography vocabulary

The system SHALL include professional photography guidance in each portrait prompt.

#### Scenario: Planner creates item prompts

- **WHEN** a portrait item is planned
- **THEN** its prompt includes style direction, shot size, lens, aperture, depth of field, lighting, scene/background, subject summary, visible profile context, and safety constraints.

### Requirement: Portrait generation is set-based

The system SHALL generate portrait items through an SSE set workflow and preserve partial results.

#### Scenario: User generates a portrait set

- **WHEN** the user submits Portrait Mode generation
- **THEN** `/api/portrait/generate` emits set started, plan, item progress, saved item, failed item, and complete/error SSE events.
- **AND** successful items are saved in the portrait output folder and added to the portrait manifest.

### Requirement: Portrait storage is separate

The system SHALL store portrait manifests under `Pictures/json/portrait-sets/` and images under a portrait-specific dated folder.

#### Scenario: Local portrait image is saved

- **WHEN** a portrait item is saved locally
- **THEN** its relative output path starts with `YYYY-MM/MM-DD/YYYY-MM-DD-portrait/HHMM-<subject>-<id>/`.
- **AND** the filename uses a `001` through `100` prefix.

### Requirement: Portrait records support asset actions

The system SHALL expose portrait records at `#portrait-record` with search, preview, prompt copy/export, manifest export, path copy, folder opening, and explicit reuse.

#### Scenario: User opens Portrait Records

- **WHEN** saved portrait sets exist
- **THEN** the record page lists sets, displays status/progress and generated images, and allows copying prompts or paths.

#### Scenario: User reuses a portrait record

- **WHEN** the user clicks reuse
- **THEN** the app restores subject summary, analysis draft, selected styles, custom style, notes, output parameters, and planned prompts into `#portrait`.
- **AND** reference image file inputs remain empty and require reupload before generation or repair.

### Requirement: Local repair supports failed or selected portrait items

The system SHALL allow local repair for incomplete portrait items and single-item regeneration.

#### Scenario: User repairs incomplete portraits

- **WHEN** a local portrait set has failed or missing items and the user reuploads reference images
- **THEN** `/api/portrait/repair` regenerates only selected or incomplete items and updates the same manifest.

### Requirement: Cloudflare unsupported actions return a stable contract

The Cloudflare worker SHALL support portrait analysis, planning, and generation, and SHALL return an unsupported capability payload for local-only actions.

#### Scenario: User calls a local-only portrait route on Cloudflare

- **WHEN** the request targets `/api/portrait/repair`, `/api/portrait/sets/open-folder`, or `/api/portrait/sets/paths`
- **THEN** the worker returns a JSON unsupported capability response instead of a missing route.
