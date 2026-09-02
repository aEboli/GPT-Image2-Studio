## ADDED Requirements

### Requirement: Windows browser launcher locates a Studio port efficiently
The Windows browser launcher SHALL collect the local TCP listening ports once per launch attempt, reuse an occupied port only after the Studio health endpoint succeeds, and otherwise select the first available candidate port in its existing bounded range.

#### Scenario: The default port already hosts Studio
- **WHEN** the requested port appears in the local listener snapshot and its Studio health endpoint returns success
- **THEN** the launcher opens that existing Studio port
- **AND** it does not start a second Node service

#### Scenario: The default port hosts a different service
- **WHEN** the requested port appears in the local listener snapshot but its Studio health endpoint does not return success
- **THEN** the launcher selects the first available subsequent candidate port within its existing range
- **AND** it starts Studio only on that selected port

#### Scenario: The requested port is available
- **WHEN** the requested port does not appear in the local listener snapshot
- **THEN** the launcher starts Studio on the requested port
- **AND** it confirms availability through the existing health check before reporting a timeout
