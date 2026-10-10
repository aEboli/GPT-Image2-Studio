## ADDED Requirements

### Requirement: Reverse prompt preserves explicit style-lock vocabulary

普通图片反推 SHALL keep the existing five top-level groups and SHALL make `visual` a reusable style-lock segment beginning with `风格锁定：` (or an equivalent target-language marker when the mode supports another language). The segment SHALL preserve concrete, image-grounded terms for applicable overall aesthetic or genre, medium/rendering, palette and contrast, lighting, material and surface finish, lens/depth treatment, and post-processing or atmosphere. It SHALL use specific words that can affect rendered pixels instead of a short generic quality summary.

#### Scenario: Source image has a distinct visual identity

- **WHEN** the uploaded image has a recognizable medium, aesthetic, palette, lighting setup, material finish, or photographic treatment
- **THEN** `visual` contains a deduplicated style-lock segment covering the applicable cues
- **AND** those cues remain separate from the subject facts while staying in the same reusable JSON result
- **AND** the segment does not replace observed style with a hard-coded unrelated preset

#### Scenario: Source image is used for a second generation

- **WHEN** the user copies the structured result into the Studio prompt field
- **THEN** the style-lock segment is explicit enough for the downstream image model to retain the source medium, aesthetic, palette, lighting, material response, and depth treatment
- **AND** `avoid` includes image-specific style drift such as an incorrect medium, time-of-day lighting, palette, or surface finish when those deviations are plausible

#### Scenario: Style cues are uncertain

- **WHEN** a style dimension cannot be reliably inferred from visible evidence
- **THEN** the model leaves that dimension out or describes it conservatively
- **AND** it does not invent a named artist, brand, era, camera metadata, or unrelated style preset
