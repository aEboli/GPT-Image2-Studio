## MODIFIED Requirements

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

## ADDED Requirements

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
