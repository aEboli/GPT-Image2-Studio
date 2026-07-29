## ADDED Requirements

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
The system SHALL instruct the analysis model to return one complete Chinese generation prompt that retains concrete visible details that materially affect the rendered image, avoids vague quality language and near-synonym adjective stacking, and does not include ecommerce-use recommendations or repeat the same detail in multiple phrasings.

#### Scenario: Model receives reverse-prompt instructions
- **WHEN** the system constructs an ordinary image-to-prompt analysis request
- **THEN** the instruction prioritizes concrete subject, state, environment, composition, lighting/color, medium/camera, and aspect-ratio details
- **AND** the instruction rejects vague quality adjectives, near-synonym stacking, use-case advice, and synonymous repetition

#### Scenario: Structured analysis fields are returned
- **WHEN** the model returns both `prompt` and supporting structured analysis fields
- **THEN** `prompt` remains one standalone generation prompt
- **AND** the system does not append the supporting fields to `prompt`

### Requirement: One prompt is the primary reusable result
The system SHALL display, copy, map, and automatically save `json.prompt` as the single primary generation text while retaining the complete structured JSON as an explicit secondary copy format.

#### Scenario: New analysis completes
- **WHEN** an image-to-prompt analysis returns a non-empty `json.prompt`
- **THEN** the main result field shows that prompt once
- **AND** the primary copy action copies only that prompt
- **AND** the automatically created prompt template stores only that prompt

#### Scenario: User needs structured analysis
- **WHEN** the user invokes the explicit JSON copy action
- **THEN** the system copies the complete stored analysis JSON without changing the primary prompt result

### Requirement: Legacy reverse-prompt templates avoid duplicate application
The system SHALL recognize legacy automatically saved image-to-prompt templates whose content is a structured analysis object and SHALL use their non-empty `prompt` field as the template's generation text without rewriting unrelated user-authored JSON templates.

#### Scenario: Legacy automatic template is loaded
- **WHEN** a stored `prompt-agent-*` template contains JSON with a non-empty `prompt`
- **THEN** the normalized template content equals that `prompt` text

#### Scenario: Unrelated JSON template is loaded
- **WHEN** a user-authored template contains JSON that is not identifiable as an image-to-prompt analysis result
- **THEN** the template content remains unchanged
