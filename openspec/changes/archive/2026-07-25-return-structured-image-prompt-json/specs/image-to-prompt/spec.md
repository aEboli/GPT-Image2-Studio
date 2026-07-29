## ADDED Requirements

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

## MODIFIED Requirements

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

## REMOVED Requirements

### Requirement: One prompt is the primary reusable result
**Reason**: The approved workflow requires the non-repeating five-group JSON itself to be the primary reusable generation prompt; extracting only `json.prompt` removes framing controls needed for reliable reconstruction.

**Migration**: New analyses display, copy, map, and save formatted structured JSON. Existing records remain readable, and legacy automatic templates that contain an old `prompt` continue to normalize to that string.

#### Scenario: New analysis completes
- **WHEN** an image-to-prompt analysis returns the new five-group JSON
- **THEN** the removed single-`prompt` primary-result behavior is not used

#### Scenario: User needs structured analysis
- **WHEN** the user views or copies a new image-to-prompt result
- **THEN** the complete structured JSON is already the primary result instead of a secondary copy format
