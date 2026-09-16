## MODIFIED Requirements

### Requirement: Portrait Mode 写真模式 is independent

The system SHALL expose Portrait Mode as a separate Create entry at `#portrait` and SHALL NOT reuse ecommerce Creation Mode business state or `/api/creation/*` routes. Portrait Mode SHALL expose its own thinking-effort and image-quality selectors alongside its existing output parameters; these selectors SHALL not read the current Prompt Mode control values.

#### Scenario: User opens Portrait Mode

- **WHEN** the user opens `#portrait`
- **THEN** the app shows person reference upload, analysis controls, editable subject summary, portrait count, style presets, custom style input, photography notes, output parameters, plan preview, and generated portrait cards.
- **AND** the active generation route is `/api/portrait/generate`.
- **AND** the output parameters include independent thinking-effort and image-quality selectors.

#### Scenario: User submits portrait-specific generation settings

- **WHEN** the user selects a thinking effort and quality in Portrait Mode before planning, generating, or repairing a set
- **THEN** the corresponding request submits those Portrait Mode values
- **AND** the selected quality is normalized for the active image model before the upstream request is made.
