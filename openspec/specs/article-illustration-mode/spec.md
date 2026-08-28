# article-illustration-mode Specification

## Purpose
TBD - created by archiving change add-article-illustration-mode. Update Purpose after archive.
## Requirements
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

The system SHALL generate key character and scene reference cards and SHALL use completed
cards as references for later storyboard images when relevant. The article illustration
generation request SHALL be issued as a single image generation call per item that carries
no mask and no local-mask execution strategy, because Article Illustration exposes no
mask editing. The request options SHALL be built only from values already in scope at the
call site.

#### Scenario: User generates formal illustrations

- **WHEN** storyboard items reference completed reference cards
- **THEN** the server passes those card images as `referenceImages` to the image generation request.

#### Scenario: An article item issues one unmasked generation call

- **WHEN** the server generates any article illustration item
- **THEN** exactly one image generation call is issued for that item
- **AND** the call carries no `mask` and no `sourceImage`
- **AND** the request options resolve `endpointPath` from the selected route configuration

#### Scenario: Article generation does not fail on a scope error

- **WHEN** a user generates article illustrations or reference cards with a reachable upstream
- **THEN** no item reports `item_failed` with a `ReferenceError` message
- **AND** completed items are saved with their asset and appear in the set manifest

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

### Requirement: Article illustration generation endpoints carry regression coverage

The article illustration generation endpoints SHALL be covered by automated end-to-end
tests that exercise the real request handler against a stub upstream, so a scope or wiring
defect in the generation path fails the test suite rather than only failing at runtime.

#### Scenario: Storyboard generation is covered end to end

- **WHEN** the test suite runs
- **THEN** a test posts to `/api/article-illustration/generate` against a stub upstream
- **AND** asserts the upstream received the expected prompt and reference images
- **AND** asserts the saved item and set manifest reflect the generated asset

#### Scenario: Reference card generation is covered end to end

- **WHEN** the test suite runs
- **THEN** a test posts to `/api/article-illustration/generate-references` against a stub upstream
- **AND** asserts the reference card items complete and are saved
