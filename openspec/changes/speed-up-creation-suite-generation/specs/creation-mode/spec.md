## ADDED Requirements

### Requirement: Creation platform profiles default to the 1K resolution tier

Every built-in Creation platform profile SHALL declare `1K` as its automatic `resolutionTier`, and the planner fallback tier for appended SKU and infographic rebuild items SHALL also be `1K`. An explicit user resolution selection SHALL still be stored as a set-level override and SHALL still take precedence over the profile default for every planned item, frozen effective plan, queue snapshot, and per-item generation request.

#### Scenario: Automatic plan uses 1K

- **WHEN** the user plans a Creation set on any built-in platform without explicitly choosing a resolution
- **THEN** every planned carousel, SKU, and infographic rebuild item carries the `1K` resolution tier
- **AND** the resolved per-item generation size is the 1K size for that item's aspect ratio
- **AND** the platform profile does not raise any item above 1K

#### Scenario: Explicit resolution still overrides the 1K default

- **WHEN** the user explicitly selects the 2K resolution for the current set
- **THEN** the browser stores `resolutionTier` as a set-level override
- **AND** the plan preview, frozen effective plan, queue snapshot, and per-item generation requests all use 2K
- **AND** the 1K profile default does not re-override that selection

### Requirement: Creation generation runs at twenty parallel tasks across generation and repair

The Creation parallel task limit SHALL be 20. The server SHALL apply that same limit to suite generation item fan-out, to the Creation session task-slot scope, and to repair and auto-repair item fan-out. The shared bounded-concurrency helper SHALL permit up to 20 concurrent workers so the limit is not silently clamped lower. The browser SHALL compute its Creation queue parallel budget from that same limit rather than from the general per-session task limit, so a queued suite is only started when the server can actually run its items.

#### Scenario: Twenty-item suite runs in one wave

- **WHEN** a queued Creation suite contains 20 unfinished items
- **THEN** the server starts all 20 items without holding any of them in the session task-slot wait loop
- **AND** the bounded-concurrency helper does not reduce the worker count below 20

#### Scenario: Repair uses the same limit

- **WHEN** repair or automatic repair re-runs 20 incomplete items of a Creation set
- **THEN** those repair items fan out under the same 20-task Creation limit
- **AND** they claim task slots from the same Creation session scope as suite generation

#### Scenario: Browser budget matches the server limit

- **WHEN** the browser decides whether to start the next queued Creation suite
- **THEN** it reserves against the 20-task Creation limit
- **AND** it does not use the general per-session task limit for Creation mode

### Requirement: Creation reference images are uploaded once per suite request

Within one Creation generation or repair request the system SHALL register every supplied reference image and Logo image under a content fingerprint and SHALL reuse one registered descriptor for every planned item that references those bytes. Identical bytes supplied more than once SHALL produce one registry entry. The registry SHALL be scoped to the request so no reference bytes leak between suites, sessions, or users.

#### Scenario: Duplicate reference bytes are registered once

- **WHEN** a Creation request supplies two reference files whose bytes are identical
- **THEN** the request registers one reference entry
- **AND** every planned item that uses either filename resolves to that one entry

#### Scenario: Registry does not cross requests

- **WHEN** two Creation requests supply the same reference bytes
- **THEN** each request builds its own registry
- **AND** neither request reads reference bytes registered by the other

### Requirement: Responses route reuses uploaded reference file identifiers

On the Responses image route the system SHALL upload each registered Creation reference image to the upstream Files API once per suite request and SHALL send `file_id` references on each per-item request instead of repeating the inline base64 payload. When upload is unsupported, rejected, or returns no usable identifier, the system SHALL fall back to the existing inline base64 input for the affected image and SHALL still complete the generation. Upload failure SHALL NOT fail an item, and SHALL NOT be retried per item once the request has fallen back. The direct image route and the model-protocol route SHALL keep sending inline reference payloads.

#### Scenario: Twenty items share one upload per reference

- **WHEN** a 20-item Creation suite on the Responses route supplies three reference images
- **THEN** the request uploads three reference images once
- **AND** each of the 20 per-item requests carries `file_id` references rather than inline base64 for those images

#### Scenario: Upstream without Files support still generates

- **WHEN** the configured upstream rejects the reference upload or returns no usable file identifier
- **THEN** the request falls back to inline base64 reference input
- **AND** every item still generates
- **AND** the request does not retry the upload for each subsequent item

#### Scenario: Other routes keep inline references

- **WHEN** a Creation suite runs on the direct image route or the model-protocol route
- **THEN** the per-item requests carry inline reference payloads
- **AND** no reference upload is attempted

## MODIFIED Requirements

### Requirement: Creation generation uses per-item effective parameters consistently
The system SHALL include effective ratio, resolution tier, resolved size, and target language on each planned item. Local generation SHALL resolve and submit those values per item, and the same planning payload SHALL produce a deterministic effective plan. The automatic resolution tier for every built-in platform profile SHALL be `1K`, and an explicit user resolution override SHALL take precedence over it.

#### Scenario: Per-item parameters reach the upstream request
- **WHEN** a Creation set is generated from a resolved plan
- **THEN** each item's upstream request uses that item's ratio, resolved size, and target language
- **AND** the saved item records the effective values that were used
- **AND** an item without an explicit user resolution override uses the 1K tier
