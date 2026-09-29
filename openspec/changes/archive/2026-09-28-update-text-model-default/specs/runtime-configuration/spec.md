# runtime-configuration

## MODIFIED Requirements

### Requirement: Runtime defaults use one model source

The system SHALL resolve the default Responses model and direct text/vision model from one shared source, and both defaults SHALL be `gpt-6-luna` across the local Node service and browser-private configuration.

#### Scenario: A runtime starts without an explicit text model

- **WHEN** local or browser configuration has no non-empty Responses or direct text/vision model
- **THEN** the effective model is `gpt-6-luna`
- **AND** the runtime does not select a different fallback based only on its deployment type

#### Scenario: Browser shared modules are synchronized

- **WHEN** the public-library synchronization check runs
- **THEN** the shared model-default module is included in the checked registry
- **AND** browser and source copies contain identical defaults

### Requirement: Explicit model choices remain authoritative

The system SHALL apply the shared model only as a fallback and SHALL preserve non-empty environment, persisted local, browser-private, and request-level model selections.

#### Scenario: User has an existing custom model

- **WHEN** a saved configuration or request supplies a non-empty Responses or direct text/vision model
- **THEN** that value remains the effective model
- **AND** the application does not rewrite it to `gpt-6-luna`

#### Scenario: Other generation channels resolve defaults

- **WHEN** direct image generation or the model-protocol channel has no explicit model
- **THEN** direct image generation keeps `gpt-image-2`
- **AND** the model-protocol channel keeps its existing protocol-specific default
