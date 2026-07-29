# image-to-prompt Specification

## Purpose
Define image-to-prompt analysis boundaries and reusable output behavior so ordinary reverse prompting stays visually grounded, concise, and free from duplicate generation text or unrelated Creation Mode context.
## Requirements
### Requirement: Image-to-prompt analysis uses isolated visual context
The system SHALL analyze an image-to-prompt request using only the image and reverse-prompt instructions, and SHALL NOT inject Creation Mode platform, category, main-image, detail-page, SKU, live-content, or thumbnail-use context into that request.

#### Scenario: User analyzes one image in the image-to-prompt tool
- **WHEN** the user submits an image through the image-to-prompt tool
- **THEN** the upstream analysis input contains the reverse-prompt instruction and the submitted image
- **AND** the input does not contain Creation Mode platform, category, or ecommerce image-use guidance

#### Scenario: Creation reference analysis uses ecommerce context
- **WHEN** the user analyzes references through the dedicated Creation Mode reference-analysis route
- **THEN** the upstream analysis input continues to contain the selected platform and category context

### Requirement: Reverse prompt is concise and visually effective
The system SHALL instruct the analysis model to return one structured Chinese generation JSON that retains concrete visible details that materially affect the rendered image, avoids vague quality language and near-synonym adjective stacking, does not include ecommerce-use recommendations, and records each visual fact only once in its most appropriate field.

#### Scenario: Model receives reverse-prompt instructions
- **WHEN** the system constructs an ordinary image-to-prompt analysis request
- **THEN** the instruction prioritizes detailed subject and framing controls plus concise scene, visual treatment, and image-specific avoidance constraints
- **AND** the instruction rejects vague quality adjectives, near-synonym stacking, use-case advice, and synonymous repetition

#### Scenario: Structured analysis fields are returned
- **WHEN** the model returns ordinary image-to-prompt analysis
- **THEN** the result uses `subject`, `framing`, `scene`, `visual`, and `avoid` without legacy summary or metadata fields
- **AND** no visual detail is repeated through an additional complete prompt

### Requirement: Legacy reverse-prompt templates avoid duplicate application
The system SHALL recognize legacy automatically saved image-to-prompt templates whose content is an old structured analysis object and SHALL use their non-empty `prompt` field as the template's generation text, while preserving new five-group structured JSON and unrelated user-authored JSON templates without rewriting them.

#### Scenario: Legacy automatic template is loaded
- **WHEN** a stored `prompt-agent-*` template contains old JSON with a non-empty `prompt`
- **THEN** the normalized template content equals that `prompt` text

#### Scenario: New structured template is loaded
- **WHEN** a stored `prompt-agent-*` template contains `subject`, `framing`, `scene`, `visual`, and `avoid` without a `prompt`
- **THEN** the formatted JSON remains the template's generation text

#### Scenario: Unrelated JSON template is loaded
- **WHEN** a user-authored template contains JSON that is not identifiable as a legacy image-to-prompt analysis result
- **THEN** the template content remains unchanged

### Requirement: Structured reverse prompt preserves reproducible framing
The system SHALL return ordinary image-to-prompt analysis as one strict JSON object with exactly the top-level groups `subject`, `framing`, `scene`, `visual`, and `avoid`. `subject` and `framing` SHALL retain detailed reproduction controls while `scene` and `visual` remain concise, and the object SHALL NOT contain a duplicate summary `prompt`.

#### Scenario: Image contains a person or primary object
- **WHEN** the model constructs the ordinary reverse-prompt result
- **THEN** `subject` contains `type`, `pose`, `expression`, `appearance`, `clothing`, and `interaction`
- **AND** unavailable or inapplicable values use an empty string or empty array instead of invented detail

#### Scenario: Framing must remain stable during regeneration
- **WHEN** the model describes the source composition
- **THEN** `framing` contains `aspect_ratio`, `shot_size`, `subject_scale`, `placement`, `negative_space`, `foreground_frame`, `camera`, `angle`, `crop`, `perspective`, and `depth_of_field`
- **AND** subject scale, placement, negative space, and crop describe measurable or visually checkable relationships

#### Scenario: Source image has no reliable EXIF
- **WHEN** a concrete camera setup would improve visual reproduction but source metadata is unavailable
- **THEN** `framing.camera` selects one explicit recommended full-frame-equivalent focal length together with a compatible shooting distance, aperture, and focus target
- **AND** the recommendation is not represented as verified source EXIF

### Requirement: Reverse prompt records and templates use grounded descriptive names

The system SHALL present each image-to-prompt result with one concise display name shared by its history row and automatically saved prompt template. An existing non-empty `json.title` SHALL remain authoritative. Otherwise, a new five-group structured result SHALL derive a grounded Chinese name from available time or weather, subject action or visible prop, subject type, and representative environment details; missing dimensions SHALL be skipped, repeated details SHALL be removed, and the result SHALL NOT exceed 40 Unicode characters. If no structured name can be derived, the system SHALL use the uploaded filename without its image extension, followed by `图片反推 JSON` only when no usable filename stem exists.

#### Scenario: Structured result contains complementary visual details

- **WHEN** a five-group result describes a young woman holding an umbrella at night in rain with courtyard lights
- **THEN** its history row and automatic template use the same short name combining the grounded night, rain, umbrella action, woman, and representative environment details
- **AND** the name does not contain an image filename extension

#### Scenario: Existing result has a title

- **WHEN** a historical analysis contains a non-empty `json.title`
- **THEN** that title remains the display name ahead of any derived structured name or filename

#### Scenario: Structured details are unavailable

- **WHEN** a result has no existing title and cannot produce a structured name
- **THEN** the display name uses the uploaded filename stem without `.jpg`, `.jpeg`, `.png`, `.webp`, or another supported image extension
- **AND** `图片反推 JSON` is used only when that stem is also empty

### Requirement: Automatic template names migrate without overwriting custom names

The system SHALL normalize a stored template name only when the template ID identifies an automatic `prompt-agent-*` template and its current name remains filename-like with an image extension. A new five-group JSON template SHALL derive the same grounded display name used by history. A legacy JSON template with a non-empty `title` SHALL retain that title. If neither is available, normalization SHALL remove only the image extension. A non-filename custom template name SHALL remain unchanged.

#### Scenario: Stored automatic template still uses an image filename

- **WHEN** a `prompt-agent-*` template named `image-analysis.jpg` contains a new five-group structured JSON prompt
- **THEN** loading templates replaces the filename-like name with the grounded structured display name

#### Scenario: User renamed an automatic template

- **WHEN** a `prompt-agent-*` template has a non-filename custom name
- **THEN** loading templates preserves that name unchanged

### Requirement: Legacy Prompt Agent templates require legacy structure
The browser SHALL extract the single `prompt` value from a `prompt-agent-*` JSON template only when the object also contains the recognizable legacy reverse-analysis structure. An ID prefix and non-empty `prompt` alone SHALL NOT classify unrelated user-authored JSON as legacy.

#### Scenario: User edits an automatic template into unrelated JSON
- **WHEN** a retained `prompt-agent-*` ID contains JSON such as `{"prompt":"literal","metadata":"keep"}` without legacy analysis fields
- **THEN** template normalization preserves the complete JSON text
- **AND** reloading does not collapse it to `literal`

#### Scenario: Stored legacy reverse analysis is opened
- **WHEN** a `prompt-agent-*` template contains a non-empty prompt and recognizable legacy title, negative-prompt, style, subject, scene, composition, lighting, palette, camera, ratio, or notes fields
- **THEN** normalization continues to expose its single reusable prompt
