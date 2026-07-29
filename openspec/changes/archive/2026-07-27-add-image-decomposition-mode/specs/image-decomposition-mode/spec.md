## ADDED Requirements

### Requirement: Image Decomposition Mode is an independent Create view
The system SHALL expose Image Decomposition Mode through the Create menu at `#image-decomposition` and SHALL keep its uploaded source image, selected language, generated preview, and thumbnail state independent from prompt mode, reference analysis, style transfer, and Creation Mode.

#### Scenario: User opens the Image Decomposition view
- **WHEN** the user opens `#image-decomposition`
- **THEN** the system displays a single-image upload area, source preview, target-language controls, ratio controls, resolution controls, generation button, generated preview, and thumbnail strip
- **AND** it does not prefill source images from any other Create mode

### Requirement: Image Decomposition accepts exactly one source image
The system SHALL require exactly one reference image when `mode=image-decomposition` is submitted to `/api/generate`.

#### Scenario: User submits one source image
- **WHEN** the user starts Image Decomposition with one valid source image
- **THEN** the system submits that file as the only generation reference
- **AND** the backend accepts the request

#### Scenario: User submits no source image
- **WHEN** the user starts Image Decomposition without a source image
- **THEN** the browser or backend rejects the request with a visible error
- **AND** no generation job is started

#### Scenario: User submits multiple source images
- **WHEN** the backend receives `mode=image-decomposition` with more than one reference image
- **THEN** the backend rejects the request
- **AND** no generation job is started

### Requirement: Target language controls image labels
The system SHALL normalize the selected label language to Simplified Chinese by default, support English, Japanese, Korean, French, German, Spanish, and custom language input, and SHALL include the final target language in the image-decomposition prompt.

#### Scenario: User selects a preset language
- **WHEN** the user selects English, 日本語, 한국어, Français, Deutsch, or Español
- **THEN** the generated prompt instructs the model to write decomposition labels in that target language

#### Scenario: User enters a custom language
- **WHEN** the user selects custom language and enters a non-empty language name
- **THEN** the generated prompt uses that custom target language

#### Scenario: Custom language is empty
- **WHEN** the user selects custom language without entering a language name
- **THEN** the generated prompt falls back to Simplified Chinese

### Requirement: Image Decomposition prompt uses visible evidence only
The system SHALL build a dedicated prompt that asks the image model to create one decomposition infographic from the uploaded source image, label real visible components, use readable typography and connector lines, and avoid invented brands, identities, hidden internals, or unverifiable details. The prompt SHALL keep task/source/factuality constraints internal so the rendered image does not add generic explanatory headings, source-reference captions, or disclaimer-style subtitles. The prompt SHALL request detailed callout boxes with numbered markers, part names, and short visible-feature explanations. The prompt SHALL support an optional side feature-card setting. When disabled, the prompt SHALL instruct the model not to render side feature cards. When enabled, the prompt SHALL require left and right side feature cards for concise visible-feature notes. The prompt SHALL ask for plain descriptor phrases without punctuation-heavy wrappers such as parentheses, colons, or dash subtitles.

#### Scenario: Backend builds the prompt
- **WHEN** `/api/generate` receives `mode=image-decomposition`
- **THEN** the backend replaces the browser prompt with the dedicated image-decomposition prompt
- **AND** the prompt includes visible-only and no-fabrication constraints

#### Scenario: Prompt discourages rendered meta explanations
- **WHEN** the backend builds the image-decomposition prompt
- **THEN** the prompt tells the model not to render task explanations, source-reference captions, analysis disclaimers, or generic poster subtitles
- **AND** the prompt supports a side feature-card setting that defaults off and only allows optional cards when enabled
- **AND** enabled side feature cards are described as required left/right elements
- **AND** detailed callout boxes include short visible-feature explanations
- **AND** descriptor text stays plain rather than punctuation-heavy

### Requirement: Image Decomposition results are saved as gallery assets
The system SHALL save completed Image Decomposition outputs into the normal gallery with `generationMode: image-decomposition`, `assetKind: image-decomposition`, `targetLanguage`, `sourceImageName`, ratio, size, and generated prompt metadata.

#### Scenario: Generation completes
- **WHEN** an Image Decomposition generation saves successfully
- **THEN** the result appears in the normal gallery
- **AND** the Image Decomposition view shows the generated preview and thumbnail
- **AND** the saved item metadata contains the target language and source image filename

#### Scenario: Gallery item is deleted or history is cleared
- **WHEN** the user deletes an Image Decomposition gallery item or clears history
- **THEN** the Image Decomposition preview and thumbnail state no longer point to the removed saved asset
- **AND** other Create modes remain unaffected
