## ADDED Requirements

### Requirement: Non-loopback clients authenticate every local-server request
The local Node service SHALL require its configured or generated access token for every request received directly from a non-loopback network address, including the workbench page, static assets, API routes, and generated output files. A same-origin header SHALL NOT replace authentication for a non-loopback client.

#### Scenario: Remote browser opens the workbench without credentials
- **WHEN** a non-loopback client requests the workbench without a valid token
- **THEN** the service responds with HTTP `401`
- **AND** it supplies an HTTP Basic authentication challenge
- **AND** it does not return page, API, or output content

#### Scenario: Remote browser supplies Basic credentials
- **WHEN** a non-loopback client supplies Basic credentials with username `studio` and the current access token as its password
- **THEN** the request is authorized
- **AND** subsequent same-origin resources can use the browser-managed credentials

#### Scenario: Remote command-line client supplies a token
- **WHEN** a non-loopback client supplies the current token through Bearer authorization or `X-Image-Studio-Token`
- **THEN** the request is authorized for both read and write routes

#### Scenario: Remote same-origin request omits credentials
- **WHEN** a non-loopback request presents a matching Origin or same-site browser header but no valid token
- **THEN** the request remains unauthorized

### Requirement: Loopback behavior remains compatible
The local Node service SHALL preserve its existing trusted-loopback behavior while applying remote authentication.

#### Scenario: Local browser opens the workbench
- **WHEN** a client connected from a loopback address requests page, API, or output resources
- **THEN** existing loopback GET and same-origin browser behavior remains available without an authentication prompt
- **AND** existing request-token support remains valid

#### Scenario: Service listens only on loopback
- **WHEN** the host is not explicitly configured for non-loopback access
- **THEN** the server continues to listen on `127.0.0.1`
- **AND** no remote-access authentication changes the desktop or normal local workflow
