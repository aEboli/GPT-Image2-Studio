## ADDED Requirements

### Requirement: Image generation controls are isolated by route

The system SHALL resolve image-generation quality from the selected image route and SHALL keep the selected quality value independently for GPT, Gemini, and Grok routes. GPT and Gemini SHALL expose only explicit supported quality tiers (`low`, `medium`, `high`, and model-supported `xhigh`/`max`); Grok SHALL expose and send only `low` or `medium`, with an empty or legacy `auto` Grok value defaulting to `medium`. Legacy `auto` values for GPT and Gemini SHALL migrate to the existing `high` default. GPT-only quality values sent to route D SHALL be reduced to `medium` instead of being forwarded unchanged.

#### Scenario: Grok uses its own quality vocabulary

- **WHEN** the selected image route is Grok and no quality is supplied
- **THEN** the effective quality is `medium`
- **AND** the browser quality control contains only `low` and `medium`

#### Scenario: GPT quality does not leak into Grok

- **WHEN** GPT quality is `high`, `xhigh`, or `max` and the user switches to Grok
- **THEN** the Grok request uses a supported value, with GPT-only tiers mapped to `medium`
- **AND** the saved Grok selection does not overwrite the GPT selection

#### Scenario: Route quality choices survive switching

- **WHEN** the user selects one quality for GPT, another for Gemini, and another for Grok, then switches between routes
- **THEN** each route restores its own last valid quality
- **AND** a route switch does not reuse the previous route's unsupported option

### Requirement: GPT reasoning effort is excluded from Grok image requests

Route D image-generation and image-edit requests SHALL NOT send `reasoningEffort`. Grok image task snapshots, preview metadata, saved image metadata, and suite snapshots SHALL omit the GPT-only reasoning field. Text/vision requests that remain on GPT SHALL continue to accept and persist their reasoning effort independently from image-route controls.

#### Scenario: Grok image request omits reasoning

- **WHEN** a Grok image request is created while the GPT reasoning control contains any value
- **THEN** the upstream request does not contain `reasoningEffort`
- **AND** the resulting image record does not claim a GPT reasoning level

#### Scenario: PPT text planning keeps GPT reasoning

- **WHEN** a PPT outline is generated through the GPT text/vision channel while image pages use Grok
- **THEN** the outline request retains its selected GPT reasoning effort
- **AND** the Grok page-image requests omit `reasoningEffort`
