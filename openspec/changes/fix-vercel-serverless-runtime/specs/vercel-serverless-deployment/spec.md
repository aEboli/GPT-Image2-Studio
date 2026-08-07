## ADDED Requirements

### Requirement: Vercel builds exclude desktop-only dependencies and entrypoints
The Vercel deployment SHALL install only locked production dependencies and SHALL exclude the Electron desktop entrypoint directory from the deployment input. The function build SHALL retain runtime dependencies required by `server.mjs`.

#### Scenario: Vercel installs the project
- **WHEN** Vercel prepares a deployment from the repository
- **THEN** it runs the configured production-only locked dependency installation
- **AND** Electron and Electron Builder are not installed as function dependencies
- **AND** required Node runtime dependencies remain available

#### Scenario: Vercel discovers function entrypoints
- **WHEN** Vercel scans the deployment input for Node functions
- **THEN** the `desktop/` directory is excluded
- **AND** `server.mjs` remains the configured function entrypoint

### Requirement: Serverless requests do not wait for a local listener
The service SHALL export a standard Node request handler for Vercel and SHALL complete module initialization when Vercel captures the local `listen()` call. The normal local runtime SHALL continue to await and own its real listener.

#### Scenario: Vercel captures the listener during import
- **WHEN** Vercel imports `server.mjs` and intercepts its first listener registration
- **THEN** the module initialization completes without waiting for the uncalled local listener callback
- **AND** the default export is callable as a Node request handler
- **AND** a request for the workbench can receive a successful response

#### Scenario: Local Node starts the service
- **WHEN** the application starts through the normal local Node runtime
- **THEN** it opens its configured loopback listener before reporting readiness
- **AND** the local server lifecycle remains available to desktop callers

### Requirement: Serverless proxy requests do not weaken local service security
The service SHALL bypass local Host and peer-address authorization only for the confirmed Vercel listener-capture runtime. All normal local Node requests SHALL retain the existing local security policy.

#### Scenario: Vercel proxy uses an internal loopback peer with a public Host
- **WHEN** the confirmed Vercel Serverless handler receives a request through Vercel's internal proxy
- **THEN** it serves the existing public route rather than rejecting the proxy as a local DNS-rebinding attempt

#### Scenario: A local listener receives a non-loopback Host without credentials
- **WHEN** the normal local Node listener receives the request without the configured token
- **THEN** it continues to reject the request according to the local-server-security specification
