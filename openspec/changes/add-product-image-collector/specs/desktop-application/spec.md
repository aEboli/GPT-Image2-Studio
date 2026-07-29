## ADDED Requirements

### Requirement: Desktop application exposes only purpose-bound collector support
The desktop application SHALL make the local product-image proxy and extension-package endpoint available through the existing loopback Studio origin without enabling Node.js integration, a preload script, general-purpose IPC, a fixed port, arbitrary external navigation, or arbitrary remote URL fetching. Direct Windows file-clipboard copy SHALL remain outside the desktop runtime in the extension's dedicated Native Messaging host.

#### Scenario: Desktop user imports a collector manifest
- **WHEN** the desktop workbench resolves a confirmed trusted collector image
- **THEN** the request stays on the dynamically assigned loopback Studio origin
- **AND** the renderer receives only the validated image response rather than filesystem or Electron capabilities

#### Scenario: Desktop user previews a collector candidate
- **WHEN** the Studio batch review lazily requests a candidate thumbnail through the current loopback origin
- **THEN** the GET request uses the same source, host, redirect, type, timeout, and size validation as confirmed POST import
- **AND** the renderer receives only validated image bytes without remote credentials or Electron capabilities

#### Scenario: Desktop user downloads the collector package
- **WHEN** the user invokes the product-image collector tools action
- **THEN** the package downloads from the current loopback Studio origin
- **AND** the desktop window does not navigate to a file, command, custom, or unapproved external scheme

#### Scenario: Untrusted page attempts to use collector support
- **WHEN** a request supplies an unsupported source page, image host, redirect, payload, or path
- **THEN** the local service rejects it within bounded work
- **AND** the desktop security boundary remains unchanged
