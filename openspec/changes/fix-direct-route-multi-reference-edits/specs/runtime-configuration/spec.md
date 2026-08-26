## ADDED Requirements

### Requirement: The direct image route classifies upstream failures independently of HTTP status

The direct image route SHALL treat an upstream response as failed when the HTTP status
indicates an error **or** when the response body carries an `error` payload, including a
2xx response. Each attempt SHALL read its response body once and reuse the parsed payload
to extract the final image. A failure classified this way SHALL be eligible for the same
bounded recovery as an HTTP error status.

#### Scenario: A relay reports refusal with a success status

- **WHEN** a direct image request receives HTTP 200 whose body contains an `error` object
- **THEN** the attempt is treated as a failure rather than as a successful result
- **AND** the surfaced message includes the upstream error code and message
- **AND** the response body is not read a second time for the same attempt

#### Scenario: A successful response is unaffected

- **WHEN** a direct image request receives a response with image data and no `error` payload
- **THEN** the final image is extracted from the already-parsed payload
- **AND** no additional upstream request is issued

### Requirement: Multi-reference direct edits degrade through a bounded fallback ladder

When the direct image route sends an `images/edits` request with more than one usable
reference image, it SHALL attempt the official `image[]` multipart shape first, then
repeated singular `image` parts, then the primary reference alone. The route SHALL advance
to the next attempt only when the previous rejection names a missing image field. Any other
failure SHALL stop the ladder immediately. A request with one usable reference SHALL issue
no fallback attempts.

#### Scenario: A relay accepts only one image part

- **WHEN** an `images/edits` request with three usable references is rejected for a missing
  image field on both the `image[]` and repeated `image` attempts
- **THEN** the route retries with the primary reference as a single `image` part
- **AND** that attempt sends only the primary reference's label
- **AND** the prompt states that the provider accepted one reference and how many were dropped
- **AND** a status event reports the reduction
- **AND** the result reports the multipart field fallback, the reference reduction, and the
  uploaded reference count

#### Scenario: An unrelated upstream failure does not walk the ladder

- **WHEN** an `images/edits` request with multiple references fails for an authentication,
  quota, moderation, or other reason that does not name a missing image field
- **THEN** the route fails that item immediately
- **AND** no further upstream generation request is issued for that item

#### Scenario: A relay that accepts the official shape is unchanged

- **WHEN** an `images/edits` request with multiple references succeeds on the `image[]` attempt
- **THEN** no fallback attempt is issued
- **AND** the result reports no multipart field fallback and no reference reduction

#### Scenario: A single-reference edit has no ladder

- **WHEN** an `images/edits` request has exactly one usable reference image
- **THEN** it is sent as a single `image` part
- **AND** a failure is surfaced without a reduced retry

### Requirement: Direct multipart reference labels match the uploaded parts

The direct image route SHALL pair each reference label with the reference image actually
uploaded in that attempt. Labels for inputs that were filtered out as unusable, or dropped
by the fallback ladder, MUST NOT be sent.

#### Scenario: An unusable reference is filtered out

- **WHEN** a direct edit request is given reference images where one input carries no usable bytes
- **THEN** the uploaded parts exclude that input
- **AND** the labels sent describe only the uploaded parts in their uploaded order
