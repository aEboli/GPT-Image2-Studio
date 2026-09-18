## ADDED Requirements

### Requirement: Grok image configuration is independent and masked

The system SHALL support route D as a Grok image channel with canonical `grokBaseUrl`, `grokEndpointPath`, `grokApiKey`, and `grokImageModel` fields. Defaults SHALL be `https://api.x.ai/v1`, `images/generations`, an empty key, and `grok-imagine-image-2.0`. Grok fields MUST NOT be populated from GPT, direct, or Gemini credentials, and public configuration MUST expose only endpoint/model metadata plus configured and masked key fields.

#### Scenario: Grok defaults are available

- **WHEN** the runtime starts without a Grok configuration
- **THEN** route D resolves to the documented xAI base URL, generation endpoint, and default model
- **AND** its API key is empty

#### Scenario: Grok credentials remain isolated

- **WHEN** GPT, direct, or Gemini keys are configured but Grok is not
- **THEN** the effective Grok key remains empty
- **AND** selecting route D does not replace another channel's key

#### Scenario: Public config masks Grok credentials

- **WHEN** a Grok key is saved
- **THEN** public config reports Grok key configured state and a mask
- **AND** public config does not contain the raw key

### Requirement: Grok requests use the xAI JSON contract

Route D SHALL send JSON to `images/generations` without references and to `images/edits` with references. The request SHALL use the configured model and prompt, `response_format: b64_json`, and only documented Grok controls. It MUST NOT send OpenAI-only `size`, `output_format`, `background`, multipart image fields, or mask fields.

#### Scenario: Grok text-to-image request

- **WHEN** route D generates without a reference image
- **THEN** it posts JSON to `images/generations`
- **AND** the body contains Grok model, prompt, aspect ratio, resolution, quality, response format, and `n: 1`

#### Scenario: Grok reference edit request

- **WHEN** route D receives one or more usable reference images
- **THEN** it posts JSON to `images/edits`
- **AND** one image uses the singular `image` object while multiple images use the `images` array
- **AND** each edit contains no more than five reference images
- **AND** each image is represented as an `image_url` data URI

#### Scenario: Too many Grok reference images

- **WHEN** route D receives more than five reference images
- **THEN** the request is rejected before an upstream call is made
- **AND** the error identifies the five-image limit

#### Scenario: Grok response formats

- **WHEN** Grok returns `b64_json` or a public image URL
- **THEN** the workflow resolves it to the existing final base64 image event

#### Scenario: Grok output format follows returned bytes

- **WHEN** route D returns a valid PNG or JPEG image
- **THEN** the server detects its actual format from the image bytes
- **AND** the final image MIME type and saved extension use that format regardless of the requested studio format

#### Scenario: Unsupported Grok mask

- **WHEN** a route D request includes a local mask
- **THEN** the request fails with a clear unsupported-mask message before an upstream request is sent

### Requirement: Existing route configuration remains compatible

The system SHALL continue to resolve legacy route A/B/C values and snapshots. Route aliases `grok` and `route-d` SHALL normalize to D. Route D SHALL participate in task snapshots, activity labels, queue scope keys, model discovery, and request payloads without being treated as route A.

#### Scenario: Legacy route snapshot

- **WHEN** a historical snapshot contains route A, B, or C
- **THEN** it remains readable and displays its original channel
- **AND** the new Grok fields do not alter its effective provider
