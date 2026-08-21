## MODIFIED Requirements

### Requirement: Maintained runtime support is local Node/Electron

The project SHALL maintain the local Node/Electron runtime and its existing Node-compatible deployment path. Cloudflare Pages, Cloudflare Worker, R2, and Queue deployment artifacts SHALL NOT be presented as active build targets, runtime capability options, or CI requirements.

#### Scenario: Maintainer validates the active runtime

- **WHEN** package scripts, CI, current documentation, or capability metadata describe supported runtimes
- **THEN** they identify the local Node/Electron path and do not require a Cloudflare Pages build or Worker artifact

### Requirement: Route A preserves the original Responses task

For a Route A Responses streaming request, the system SHALL capture the upstream `response.id` from a `response.*` event when one is provided. If the stream ends or is interrupted before a final image, the system SHALL query the same Response resource with `GET /responses/{response_id}` and SHALL use an extractable final image from that original resource when available.

#### Scenario: Stream interruption followed by completed original response

- **WHEN** the first `POST /responses` emits `response.created` with an ID and a partial image, then the stream is interrupted, and `GET /responses/{id}` returns a completed image-generation result
- **THEN** the application saves the image from that GET response
- **AND** it sends no second image-generation POST

#### Scenario: Original response remains in progress

- **WHEN** retrieval returns `in_progress`, `queued`, or another explicitly active status
- **THEN** the application performs only bounded GET polling for the same response ID
- **AND** it does not create a new generation request

#### Scenario: Original response cannot be confirmed

- **WHEN** no response ID was captured, retrieval is unsupported, retrieval returns an authorization/transient/schema error, or the bounded wait ends without a final image
- **THEN** the application reports that the original result is unknown or unavailable
- **AND** it does not automatically create a second generation request
- **AND** a partial image is not reported as the final image

#### Scenario: Original response explicitly failed

- **WHEN** retrieval reports `failed`, `incomplete`, or `cancelled`
- **THEN** the application reports the original task failure
- **AND** it does not automatically create a second generation request

### Requirement: Route-specific isolation

The original-Response recovery behavior SHALL apply only to Route A Responses streaming. Route B direct image generation, Route C/Gemini, Chat Completions, image editing, and other non-Responses protocols SHALL retain their existing request and retry behavior.

#### Scenario: Non-Route-A request is interrupted

- **WHEN** a Route B, Route C, Chat Completions, or image-edit request is processed
- **THEN** the request does not construct a `/responses/{id}` retrieval URL
- **AND** Route A recovery state is not emitted
