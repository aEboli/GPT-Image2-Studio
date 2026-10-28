## ADDED Requirements

### Requirement: Listing request protocol follows the configured endpoint

Listing Agent SHALL send a Responses API request when the configured endpoint is `responses` and SHALL send a Chat Completions request with a `messages` array when the configured endpoint is `chat/completions`.

#### Scenario: Chat Completions Listing generation

- **WHEN** a Listing request uses `endpointPath = chat/completions`
- **THEN** the upstream request contains `messages[0].role = user`
- **AND** the request contains Chat Completions `response_format.json_schema`
- **AND** the request does not depend on a Responses-only `input` field
