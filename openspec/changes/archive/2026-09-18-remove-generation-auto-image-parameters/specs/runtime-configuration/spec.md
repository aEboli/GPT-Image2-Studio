## ADDED Requirements

### Requirement: Image resolution values are always concrete

The system SHALL expose only concrete image-resolution values for GPT/Grok pixel-size routes and Gemini model-protocol size routes. GPT/Grok SHALL use a concrete pixel-size option for the selected aspect ratio, and Gemini SHALL use one of 512, 1K, 2K, or 4K. The system MUST NOT display or send resolution auto.

#### Scenario: Resolution controls have no automatic option

- **WHEN** the user opens the image-generation controls for any supported route
- **THEN** the resolution selector contains only concrete pixel sizes or Gemini size tiers
- **AND** neither the value auto nor the label “自动适配” is available

#### Scenario: Legacy automatic resolution is migrated

- **WHEN** a saved configuration, browser cache, task snapshot, queue retry, manifest, sidecar, or preview metadata contains resolution auto, an empty value, or an invalid value
- **THEN** GPT/Grok data is normalized to the first concrete size for its ratio
- **AND** Gemini data is normalized to 1K
- **AND** a known measured image size may be retained when migrating a missing historical field
- **AND** the migrated value is the one used for subsequent requests and persistence

#### Scenario: Upstream requests never receive automatic resolution

- **WHEN** any image-generation entry point builds a new request, including a browser retry or server mock request
- **THEN** the request contains a concrete route-appropriate size
- **AND** no resolution field contains the string auto

### Requirement: Non-resolution automatic behaviors remain compatible

The system SHALL preserve existing automatic semantics for non-resolution fields such as article content type, automatic repair, and automatic collapse. Removing automatic resolution SHALL NOT rename, remove, or rewrite those unrelated fields.

#### Scenario: Non-resolution automatic fields remain readable

- **WHEN** an article record, creation repair request, or UI layout contains its existing automatic field
- **THEN** the field keeps its existing value and behavior
- **AND** resolution migration changes no unrelated field
