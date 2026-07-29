## ADDED Requirements

### Requirement: Article Illustration is independent

The system SHALL expose Article Illustration as a separate Create entry and SHALL NOT reuse ecommerce Creation Mode fixed image counts.

#### Scenario: User opens Article Illustration

- **WHEN** the user opens `#article-illustration`
- **THEN** the app shows article input, file input, content type, style preset, style bible, reference cards, and storyboard areas.

### Requirement: Article planning uses a confirmation gate

The system SHALL first generate a structured article illustration plan before generating final images.

#### Scenario: User plans an article

- **WHEN** the user submits pasted text or uploaded text files
- **THEN** `/api/article-illustration/plan` returns a saved set manifest with style bible, characters, scenes, reference cards, storyboard items, prompts, captions, and model text hints.

### Requirement: Reference cards support consistency

The system SHALL generate key character and scene reference cards and SHALL use completed cards as references for later storyboard images when relevant.

#### Scenario: User generates formal illustrations

- **WHEN** storyboard items reference completed reference cards
- **THEN** the server passes those card images as `referenceImages` to the image generation request.

### Requirement: Article records are set-based

The system SHALL store article illustration records under `Pictures/json/article-illustration-sets/`.

#### Scenario: User opens Article Illustration Records

- **WHEN** article sets exist
- **THEN** the record page lists sets, displays output order, and allows copying prompts and captions.

### Requirement: Captions stay accurate

The system SHALL preserve exact caption text separately from optional image text hints.

#### Scenario: User copies captions

- **WHEN** the user copies captions from an article record
- **THEN** the copied text uses saved `captionText` or original source text, not image OCR output.
