## MODIFIED Requirements

### Requirement: Creation Mode isolates Route A recovery per item

When Creation Mode generates a set whose item uses Route A Responses, each item SHALL use the shared original-Response recovery behavior independently. A stream interruption in one item SHALL NOT regenerate that item automatically, restart completed items, or rerun the entire set.

#### Scenario: One Route A item loses its stream

- **WHEN** one Creation Mode item receives a partial image, loses its upstream stream, and its original Response cannot be confirmed
- **THEN** that item is marked with an unknown/original-unavailable result
- **AND** no second generation POST is sent for that item
- **AND** other completed or still-running set items are not restarted

#### Scenario: One Route A item is recovered

- **WHEN** an interrupted item’s original Response is retrieved with a final image
- **THEN** that item is saved from the retrieved original result
- **AND** the set continues to track other items without creating a duplicate generation for the recovered item

#### Scenario: A non-Route-A Creation item runs

- **WHEN** a Creation Mode item is configured for Route B or Route C
- **THEN** it does not enter Route A original-Response retrieval
