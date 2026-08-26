## ADDED Requirements

### Requirement: Creation upstream work is bounded and cancellable

Creation Mode SHALL limit active upstream image-generation items to ten per client session scope, while prompt mode SHALL retain its ten-task limit and unrelated modes SHALL retain the existing fallback limit. Each Creation generation, repair, or Logo batch item SHALL have a bounded upstream lifetime and SHALL release its session slot when the lifetime expires or the client stream closes.

#### Scenario: Creation does not exceed its dedicated concurrency limit

- **WHEN** a Creation plan has more items than the active Creation limit
- **THEN** no more than ten items concurrently call the upstream image-generation workflow
- **AND** later items remain queued until an earlier item completes or fails
- **AND** prompt-mode tasks continue to use their independent ten-task scope

#### Scenario: A stalled Creation item times out

- **WHEN** an upstream Creation request does not return or complete before its configured item timeout
- **THEN** the current item is marked failed with an explicit timeout message
- **AND** its upstream request is aborted
- **AND** its Creation session slot is released so a queued item can start
- **AND** the system does not issue an additional generation POST for that timed-out item

#### Scenario: The Creation client disconnects

- **WHEN** the HTTP client that owns a Creation SSE stream closes before the set completes
- **THEN** in-flight upstream work for that Creation request is aborted
- **AND** no further SSE writes are attempted to the closed response
- **AND** already started items do not receive an automatic retry solely because of the disconnect

#### Scenario: A long upstream wait keeps the SSE observable

- **WHEN** a Creation item is waiting for upstream headers or final stream data longer than the heartbeat interval but shorter than the item timeout
- **THEN** the server emits periodic status heartbeat events
- **AND** the heartbeat does not extend the item timeout
- **AND** an existing retrying-upstream status is not overwritten by a generic waiting status

#### Scenario: Existing Creation item semantics remain intact

- **WHEN** one Creation item fails from an HTTP error, explicit provider failure, invalid image, timeout, or disconnect
- **THEN** completed sibling items remain saved
- **AND** the set remains repairable through the existing Creation repair path
- **AND** the manifest continues to expose item-level status and error text

