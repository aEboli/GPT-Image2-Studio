# local-server-security Specification

## Purpose
TBD - created by archiving change harden-project-maintenance. Update Purpose after archive.
## Requirements
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
The local Node service SHALL preserve its existing trusted-loopback behavior only when both the direct client address and request `Host` identify a loopback origin. A non-loopback `Host` SHALL require a valid access token even when the socket peer is loopback, and an explicitly configured listen host SHALL NOT make arbitrary request hosts trusted.

#### Scenario: Local browser opens the workbench
- **WHEN** a client connected from a loopback address requests page, API, or output resources with a loopback `Host`
- **THEN** existing loopback GET and same-origin browser behavior remains available without an authentication prompt
- **AND** existing request-token support remains valid

#### Scenario: DNS-rebound request reaches loopback
- **WHEN** a request reaches the service from a loopback address but presents a non-loopback `Host` without a valid token
- **THEN** the service does not return page, API, or output content
- **AND** matching Origin or same-site browser headers do not authorize the request

#### Scenario: Malformed Host text can be reinterpreted as loopback
- **WHEN** a loopback request presents a `Host` containing userinfo, path, query, or fragment syntax without a valid token
- **THEN** the service rejects the malformed authority before hostname interpretation
- **AND** URL parser reinterpretation cannot grant trusted-loopback behavior

#### Scenario: Service listens only on loopback
- **WHEN** the host is not explicitly configured for non-loopback access
- **THEN** the server continues to listen on `127.0.0.1`
- **AND** no remote-access authentication changes the desktop or normal local workflow

### Requirement: Generated remote credentials remain operable
When `IMAGE_STUDIO_REQUEST_TOKEN` is not configured, the local Node service SHALL generate a fresh access token and expose the current Basic username and token only in local startup output so an operator can configure a TLS reverse proxy or authenticate a directly connected remote browser. A TLS reverse proxy SHALL perform external authentication and inject the current token into backend requests; it SHALL NOT depend on the backend issuing a Basic challenge for a loopback socket carrying a non-loopback `Host`.

#### Scenario: Operator starts the loopback service without a fixed token
- **WHEN** startup generates a random request token while listening on loopback
- **THEN** local startup output identifies the Basic username and current token
- **AND** non-loopback Host requests can use that token through a documented authentication method
- **AND** proxy documentation distinguishes proxy-injected credentials from direct-browser Basic authentication

### Requirement: Plain HTTP remote binding requires explicit unsafe opt-in
The local Node service SHALL refuse to bind directly to a non-loopback address over plain HTTP unless the operator explicitly enables the documented insecure compatibility option. The recommended remote deployment SHALL keep the Node service on loopback behind a TLS reverse proxy, and proxied requests with a non-loopback `Host` SHALL still require the configured access token.

#### Scenario: Operator configures a non-loopback host without unsafe opt-in
- **WHEN** startup receives a non-loopback listen host without the insecure compatibility option
- **THEN** startup fails before listening
- **AND** the error directs the operator to a TLS reverse proxy or the explicit compatibility option

#### Scenario: Operator explicitly enables plain HTTP compatibility
- **WHEN** startup receives a non-loopback listen host and the insecure compatibility option is enabled
- **THEN** the service may listen on that address with token authentication
- **AND** startup emits a clear warning that credentials and private content are not transport-encrypted
