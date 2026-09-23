## Modified Requirements

### Requirement: Prompt Kit supports list and image views

The browser SHALL filter the static library by category name, template name and prompt text, and SHALL provide list and image views only. Image-view previews SHALL preserve each source image's intrinsic aspect ratio without cropping or distortion.

#### Scenario: User switches to image view

- **WHEN** the user selects image view
- **THEN** result cards primarily show preview images without the full prompt text
- **AND** each preview keeps its intrinsic width-to-height ratio
- **AND** hovering or focusing a card exposes its name and apply action

### Requirement: Prompt library images and prompts remain paired

Every source-backed library entry SHALL use the preview image, display name and reusable prompt from the same source record. A library entry SHALL NOT receive an unrelated image through positional cycling or a reused fallback image.

#### Scenario: User browses YouMind-backed profile templates

- **WHEN** the user opens the profile/avatar category
- **THEN** each local preview image maps to the matching source title and prompt
- **AND** no local preview path is reused by another profile/avatar entry
