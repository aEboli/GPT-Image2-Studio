## ADDED Requirements

### Requirement: Style transfer preset preview preserves before and after semantics
The system SHALL present the shared unstyled source image as the before image and the selected preset result image as the after image for every style transfer preset that provides a complete comparison pair.

#### Scenario: Cinematic photoreal preset is selected
- **WHEN** the user selects the cinematic photoreal preset
- **THEN** the image previously displayed as the cinematic photoreal after image is displayed as the shared 风格前 source image
- **AND** the image previously displayed as the shared before image is displayed as the cinematic photoreal 风格后 result image
- **AND** the before image appears before the after image in reading order

#### Scenario: Another built-in style preset is selected
- **WHEN** the user selects a built-in style other than cinematic photoreal
- **THEN** the shared source image is the same image used as the cinematic photoreal preset's before image
- **AND** the selected style result image is displayed as 风格后

### Requirement: Either preset preview opens one two-image comparison
The system SHALL open the same two-image comparison surface when the user activates either the before image or the after image of a complete style transfer preset pair.

#### Scenario: User activates either comparison image
- **WHEN** the user activates the before image or the after image
- **THEN** one comparison surface opens
- **AND** both the before image and the after image are visible at the same time
- **AND** the opened content does not depend on which of the two images was activated

### Requirement: Preset comparison surface is image-only
The system SHALL limit the preset comparison surface to the two comparison images and the control required to close the modal.

#### Scenario: User views a preset comparison
- **WHEN** the style transfer preset comparison surface is open
- **THEN** both comparison images are visible
- **AND** model, time, ID, prompt, parameters, file information, download actions, and single-image viewer controls are not displayed
- **AND** the user can close the surface with the visible close control or Escape

#### Scenario: User uses the keyboard
- **WHEN** the user opens the comparison from a focused preset image control
- **THEN** focus moves to the comparison close control
- **AND** closing the comparison restores focus to the surviving trigger
