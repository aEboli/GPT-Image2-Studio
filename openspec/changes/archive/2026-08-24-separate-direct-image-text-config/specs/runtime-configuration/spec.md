## ADDED Requirements

### Requirement: Direct mode has independent image and text/vision provider configurations

直接调用模式 SHALL expose and persist two independent provider configurations. The image channel SHALL have a Base URL, API Key, endpoint path, and image model; the text/vision channel SHALL have its own Base URL, API Key, endpoint path, and text/vision model. A non-empty value in one channel MUST NOT overwrite or silently replace the corresponding value in the other channel.

#### Scenario: User configures different direct providers

- **WHEN** the user enters an image Base URL/key/endpoint/model and a different text/vision Base URL/key/endpoint/model in direct mode
- **THEN** image-generation requests use only the image channel values
- **AND** text/vision requests use only the text/vision channel values
- **AND** saving and reopening the configuration preserves both channel selections

#### Scenario: Route B Responses image generation uses the image model

- **WHEN** direct mode sends an image-generation request through a `responses` endpoint
- **THEN** the request uses the direct image channel's Base URL, API Key, endpoint, and image model
- **AND** it does not fall back to the direct text/vision model merely because the protocol path is `responses`

#### Scenario: Channel-specific model discovery and connection test

- **WHEN** the user fetches models or tests the connection from the direct image or direct text/vision control
- **THEN** the request uses that control's channel-specific Base URL, endpoint, API Key, and current model
- **AND** the other channel's credentials and model are not sent as a substitute

### Requirement: Legacy direct configuration migrates through bounded fallbacks

The runtime SHALL continue to read legacy `directBaseUrl`, `directApiKey`, `directEndpointPath`, `directImageModel`, and `directResponsesModel` values. Explicit canonical image/text channel fields MUST take precedence. When canonical fields are absent, legacy common provider fields MAY seed the missing channels for compatibility, while `directImageModel` maps to the image model and `directResponsesModel` maps to the text/vision model. A legacy endpoint MUST be validated for the target channel before use.

#### Scenario: Existing saved direct configuration remains usable

- **WHEN** a saved configuration contains only the legacy direct fields and no new channel-specific fields
- **THEN** both direct channels resolve to the legacy provider where that provider is valid for the target protocol
- **AND** the image model comes from `directImageModel`
- **AND** the text/vision model comes from `directResponsesModel` or its existing default

#### Scenario: Explicit channel values override legacy values independently

- **WHEN** a legacy direct provider exists and only one new channel supplies a non-empty Base URL, API Key, endpoint, or model
- **THEN** that new value is effective for its channel
- **AND** the other channel retains its explicit value or legacy fallback
- **AND** an empty API Key input does not erase the previously saved private key

#### Scenario: An incompatible legacy endpoint is not reused across purposes

- **WHEN** the legacy `directEndpointPath` is an image endpoint but the text channel has no explicit endpoint
- **THEN** the text channel uses its valid text endpoint default
- **AND** the runtime does not send a text/vision request to `images/generations` or `images/edits`

### Requirement: Public direct configuration never exposes raw credentials

Public configuration responses, browser-public state, model-picker feedback, and generation logs SHALL expose only channel endpoint/model metadata, configured booleans, and masked API keys. They MUST NOT include the raw image or text/vision API Key.

#### Scenario: Public config is read after saving both channel keys

- **WHEN** private configuration contains non-empty image and text/vision API Keys
- **THEN** `/api/config` and browser-public configuration report both keys as configured with masks
- **AND** neither response contains either raw key

#### Scenario: Private request payload remains channel-specific

- **WHEN** a browser generation request includes direct private configuration
- **THEN** the request may carry the selected channel's raw key to the local service for the current operation
- **AND** the server does not copy that key into a public response, log message, or unrelated channel

### Requirement: Browser and local configuration remain synchronized and testable

The local Node service and browser-private configuration SHALL use the same canonical direct image/text fields and defaults. Browser-loaded shared modules SHALL remain byte-synchronized with their `public/lib` copies.

#### Scenario: Browser configuration round-trips both channels

- **WHEN** the browser saves direct image and text/vision channel settings and reloads them from private storage
- **THEN** both channel objects round-trip without cross-channel key or model substitution
- **AND** FormData helpers include the corresponding channel fields for model discovery and generation

#### Scenario: Public-library synchronization check runs

- **WHEN** the repository synchronization check runs
- **THEN** every browser-loaded shared module used by this change has an identical source and `public/lib` copy
- **AND** the check reports no unsynchronized direct-configuration implementation

