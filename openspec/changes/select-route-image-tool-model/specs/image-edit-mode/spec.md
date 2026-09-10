# image-edit-mode

## MODIFIED Requirements

### Requirement: Image Edit calls the GPT Image 2 edits endpoint
The system SHALL call the Image API edits endpoint for Image Edit jobs using the configured route-mode image tool model, the uploaded source image, the edit instruction prompt, normalized size, configured quality, and configured output format. The model SHALL be the same normalized value route-mode image generation uses, and SHALL default to `gpt-image-2` when the user has not selected another allowlisted option.

#### Scenario: Backend submits an image edit
- **WHEN** `/api/generate` receives `mode=image-edit` with one valid source image and a non-empty edit instruction
- **THEN** the backend sends a request to `/v1/images/edits`
- **AND** the request includes the configured image tool model as `model`
- **AND** the request includes the uploaded image as the edit source
- **AND** the request includes the edit instruction as `prompt`
- **AND** the request includes the selected size, quality, and output format

#### Scenario: Image edit follows a changed tool model
- **WHEN** the image tool model is set to `gpt-image-2.5-sunburst` and an image edit is submitted
- **THEN** the `/v1/images/edits` request carries `model=gpt-image-2.5-sunburst`

#### Scenario: Image edit keeps the default model when unconfigured
- **WHEN** the user has not changed the image tool model
- **THEN** the `/v1/images/edits` request carries `model=gpt-image-2`
