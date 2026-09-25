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

### Requirement: Long-term prompt history backfills Prompt Kit templates

The browser SHALL treat only reusable ordinary image-to-prompt history as a source for missing automatic Prompt Kit templates. Newly persisted Prompt Agent history SHALL retain an explicit analysis-mode discriminator. A record with an explicit ordinary image-to-prompt mode MAY be imported, while records with reference orchestration, Creation reference analysis, Portrait reference analysis, another non-ordinary mode, or an unknown explicit mode SHALL remain excluded. A legacy record without a mode SHALL be eligible only when its result matches the recognized five-group image-to-prompt structure or the recognizable legacy reverse-analysis structure; ambiguous objects and `prompts[]` orchestration results SHALL remain excluded. Reading legacy history or appending a new record SHALL preserve the absence of the discriminator instead of synthesizing an empty mode on old records. When Prompt Kit opens or Prompt Agent history is successfully refreshed, each eligible item with reusable text SHALL map to an automatic template ID derived from its stable history ID. Existing templates with the same ID SHALL remain unchanged, and the browser SHALL NOT delete or mutate the server-side history record.

#### Scenario: Prompt Kit opens with ordinary image-to-prompt history

- **WHEN** the user opens Prompt Kit and the history endpoint returns reusable records explicitly identified as ordinary image-to-prompt analysis
- **THEN** each missing eligible record appears as a `prompt-agent-*` template using the history display name and reusable text
- **AND** the existing user-authored templates remain in the list

#### Scenario: Prompt Kit opens with existing long-term history

- **WHEN** the user opens Prompt Kit and the history endpoint returns reusable image-to-prompt records
- **THEN** each missing history record appears as a `prompt-agent-*` template using the history display name and reusable text
- **AND** the existing user-authored templates remain in the list

#### Scenario: History contains an explicitly non-ordinary analysis

- **WHEN** history contains a reference-orchestration or another explicitly non-ordinary record with reusable text or a non-empty `prompts[]` array
- **THEN** no Prompt Kit template is created from that record
- **AND** the complete record remains available in Prompt Agent history

#### Scenario: Legacy ordinary reverse-prompt history has no mode

- **WHEN** a legacy record without an analysis-mode discriminator contains either the recognized `subject`, `framing`, `scene`, `visual`, and `avoid` groups or a non-empty prompt with recognizable legacy reverse-analysis fields
- **THEN** the record remains eligible for the same automatic template mapping as an explicitly ordinary record

#### Scenario: Legacy mode-less history is ambiguous

- **WHEN** a legacy record without an analysis-mode discriminator contains only `prompts[]`, an unknown object shape, or reusable-looking text without recognizable ordinary reverse-analysis structure
- **THEN** the record remains in history without creating a Prompt Kit template

#### Scenario: A new record is appended beside mode-less legacy history
- **WHEN** storage reads legacy entries without a discriminator and appends a newly identified ordinary record
- **THEN** the new record stores the normalized ordinary mode
- **AND** each legacy entry remains persisted without a synthesized empty mode field

#### Scenario: History is loaded more than once

- **WHEN** the same eligible history records are loaded again or the response contains duplicate IDs
- **THEN** Prompt Kit contains one template for each eligible history ID
- **AND** existing template order and content are not duplicated or rewritten

#### Scenario: User edited an automatically mapped template

- **WHEN** a `prompt-agent-*` template already has a user-edited name or prompt
- **THEN** loading the matching eligible history record preserves the edited name and prompt

#### Scenario: User deletes a mapped template

- **WHEN** the user deletes a template created from eligible long-term history
- **THEN** the template is removed from Prompt Kit
- **AND** the corresponding long-term history record remains available in the image-to-prompt history
- **AND** a later automatic history refresh does not recreate the dismissed template

#### Scenario: Eligible history has no reusable text

- **WHEN** an eligible history item has neither a structured reusable result nor a non-empty prompt
- **THEN** the item remains visible only in long-term history
- **AND** no empty Prompt Kit template is created

#### Scenario: History has no reusable text

- **WHEN** a history item has neither a structured reusable result nor a non-empty prompt
- **THEN** the item remains visible only in long-term history
- **AND** no empty Prompt Kit template is created

### Requirement: Prompt Kit defaults cover common image workflows
The browser SHALL initialize Prompt Kit with ten built-in templates named `证件照`, `商务个人头像`, `电商白底主图`, `电商生活方式图`, `自然人像写真`, `时尚穿搭图`, `美食摄影`, `室内家居效果图`, `旅行城市纪实`, and `社媒营销海报`. Each built-in template SHALL contain non-empty reusable prompt text within the existing 3000-character template-editor limit. The built-in IDs SHALL use the versioned `default-template-v2-*` prefix. The certificate-photo template SHALL express a professional portrait treatment with a soft gray-to-white gradient background, natural soft lighting, centered medium framing, realistic skin tone, and a relaxed confident expression.

#### Scenario: A first-time user opens Prompt Kit
- **WHEN** the prompt-template storage key is absent
- **THEN** Prompt Kit loads the ten current built-in templates
- **AND** the first built-in template is `证件照`
- **AND** every built-in ID uses the `default-template-v2-*` prefix

#### Scenario: Default templates replace the former daily-life set
- **WHEN** the current source bundle is inspected
- **THEN** it contains the ten common workflow names above
- **AND** it does not retain `清晨通勤`, `家庭早餐`, `居家阅读`, `厨房做饭`, `超市采购`, `午后办公`, `健身运动`, `朋友聚会`, `亲子手作`, or `夜晚学习` as built-in names

### Requirement: Legacy built-in templates migrate without discarding user templates
When the browser reads a valid saved template array containing one or more legacy built-in IDs matching `default-template-数字`, it SHALL remove all legacy built-in entries and duplicate current v2 built-in entries, preserve every other normalized entry and its relative order, append the current ten built-in templates, and persist the migrated array under `image-studio-prompt-templates-v2` when storage permits. User-authored templates and `prompt-agent-*` history templates SHALL retain their IDs and remain available; existing template normalization and Prompt Agent compatibility rules remain in force.

#### Scenario: An existing user upgrades from the former defaults
- **WHEN** saved templates contain legacy built-ins, a custom template, and a `prompt-agent-*` template
- **THEN** the loaded list contains the custom and Prompt Agent entries available with their normalized content
- **AND** no legacy `default-template-数字` entry remains
- **AND** the current `default-template-v2-*` built-ins are present once each

#### Scenario: An explicitly empty list remains empty
- **WHEN** the saved template value is a valid empty array
- **THEN** loading templates returns an empty list
- **AND** the browser does not silently repopulate defaults

#### Scenario: Migration persistence is unavailable
- **WHEN** migration detects legacy built-ins but `localStorage.setItem` throws
- **THEN** the current session still uses the migrated in-memory list
- **AND** user and Prompt Agent entries remain available

#### Scenario: No legacy built-in is present
- **WHEN** the saved array contains only user-authored or current-version templates
- **THEN** loading templates does not rewrite or duplicate those entries

### Requirement: Prompt Kit provides a layered static template library

Prompt Kit SHALL provide a static library with exactly three top-level filter dimensions: “使用场景”, “风格” and “主体”. Their second-level labels SHALL match the user-provided screenshot: 使用场景 SHALL contain 10 labels, 风格 SHALL contain 16 labels, and 主体 SHALL contain 15 labels. Each source-backed template SHALL have one stable ID, one non-empty name, one complete non-empty prompt and one local raster preview. The catalog SHALL use the official YouMind GPT Image 2 prompt snapshot, retaining each record's CMS media URL, YouMind detail page and CC BY 4.0 attribution. A canonical source-backed template MAY be reused by multiple second-level categories within a dimension, while each second-level category SHALL expose at least 20 distinct canonical template IDs before search filtering. The library SHALL be shipped with the application and SHALL NOT request the referenced third-party site at runtime. The all-items view SHALL contain each canonical stable template ID once.

#### Scenario: User opens the template library

- **WHEN** the user opens Prompt Kit
- **THEN** the library shows the three top-level dimensions and all 41 screenshot labels under their matching dimension
- **AND** the default selected dimension is 使用场景 with no second-level filter selected
- **AND** the all-items result contains 126 unique paired templates

#### Scenario: User filters a paired template by each dimension

- **WHEN** the user selects the matching second-level category under 使用场景, 风格 or 主体
- **THEN** the same stable template ID, local image and prompt are returned for every matching dimension
- **AND** each matching second-level category shows the canonical pair at most once

#### Scenario: User selects a second-level category

- **WHEN** the user selects a second-level category under one of the three dimensions
- **THEN** the library shows at least 20 distinct source-backed entries mapped to that category before search filtering
- **AND** each result exposes its stable name, complete prompt and paired local preview

#### Scenario: Every screenshot category has source-backed coverage

- **WHEN** the user selects any of the 41 second-level categories
- **THEN** the library shows at least 20 distinct canonical image-prompt pairs
- **AND** reused entries retain the same source image, prompt and attribution

### Requirement: Prompt Kit supports search and two browsing views

The browser SHALL support filtering the current library scope by category name, template name and prompt text, and SHALL provide list and image views only. The selected view SHALL remain stable while the user changes category or search text until the user explicitly changes it. Image-view previews SHALL preserve each source image's intrinsic aspect ratio without cropping or distortion.

#### Scenario: User switches to list view

- **WHEN** the user selects list view
- **THEN** each result shows a thumbnail on the left, a wrapping prompt on the right and an apply action
- **AND** the prompt text remains inside its card without horizontal overflow

#### Scenario: User adjusts list text size

- **WHEN** the user changes the list text-size control
- **THEN** the list prompt text changes size
- **AND** card columns and controls retain stable dimensions

#### Scenario: User switches to image view

- **WHEN** the user selects image view
- **THEN** the result cards primarily show preview images without the full prompt text
- **AND** each preview keeps its intrinsic width-to-height ratio and is not forced into a square crop
- **AND** hovering or focusing a card exposes its name and apply action

### Requirement: Prompt library images and prompts remain paired

Every library entry SHALL use exactly one local preview image and the complete prompt belonging to that same record. Every current filtered scope SHALL contain each stable ID at most once. A preview path MAY appear in multiple category scopes only when it is the same canonical source record; it SHALL NOT be paired with a different prompt. The library SHALL omit entries without either a local image or non-empty prompt, and SHALL NOT use generic generated previews or unrelated fallback images. Existing YouMind source records SHALL retain their source attribution. User-provided source material SHALL retain the provided image and prompt as one local record.

#### Scenario: User browses YouMind-backed profile templates

- **WHEN** the user opens a category containing a YouMind-backed entry
- **THEN** each local preview maps to its matching source name and prompt
- **AND** the image and prompt retain their source detail-page attribution
- **AND** a reused preview path always refers to the same canonical source ID and prompt

#### Scenario: User browses a YouMind kitchen record

- **WHEN** the user selects personal avatar, photography or portrait/selfie filters
- **THEN** the official YouMind kitchen image appears with its complete website prompt
- **AND** the entry appears only once in the all-items view

#### Scenario: User browses an offline YouMind template

- **WHEN** the user browses a YouMind template while the source website is unavailable
- **THEN** its local preview remains paired with the complete website prompt
- **AND** the library does not substitute a generated or unrelated preview

#### Scenario: The library loads offline

- **WHEN** the application runs without access to the source website
- **THEN** all 126 canonical image and prompt records remain available from bundled local files
- **AND** every screenshot category still exposes at least 20 placements without network access

### Requirement: Prompt library list view follows preview image geometry

In list view, each template card SHALL use the preview image's intrinsic aspect ratio and rendered media width to determine its height. The text content area SHALL occupy the same vertical height as the image, wrap within its column, and truncate excess prompt text with a visible multiline ellipsis. Image view SHALL continue to preserve each image's intrinsic ratio independently.

#### Scenario: A list prompt is longer than its paired image

- **WHEN** a template prompt exceeds the available height beside its preview image
- **THEN** the card height remains determined by the image ratio
- **AND** the prompt remains inside the text column with a multiline ellipsis

### Requirement: Returning from a template preview restores the template library

When a Prompt Kit preview is open, the left “返回模板库” action SHALL close only the preview lightbox and SHALL keep the template library open with the active category, subcategory, search, view and scroll position. The separate top-right “关闭” action MAY close the template library as its existing behavior.

#### Scenario: User returns from a template preview

- **WHEN** the user activates “返回模板库”
- **THEN** the preview lightbox closes
- **AND** the Prompt Kit list returns at the previous scroll position
- **AND** the active category and subcategory remain selected

#### Scenario: User clicks the preview backdrop

- **WHEN** the user clicks the blank backdrop or presses Escape while a template preview is open
- **THEN** only the preview lightbox closes
- **AND** the Prompt Kit list remains open at the previous scroll position

#### Scenario: User explicitly closes the template library

- **WHEN** the user activates the top-right “关闭” action in the preview surface
- **THEN** both the preview and Prompt Kit library close

### Requirement: Prompt library templates can be previewed and applied

The browser SHALL open an enlarged preview when a library image is clicked or activated. The enlarged preview SHALL display the complete template prompt beside the image and SHALL offer a copy action. Applying a library template SHALL place its prompt in the existing prompt input and update its character counter without adding the template to user storage.

#### Scenario: User opens a library image

- **WHEN** the user clicks a library preview image
- **THEN** the existing image viewer opens with the preview image and complete prompt visible
- **AND** the viewer does not add a gallery record or change generation history

#### Scenario: User applies a library template

- **WHEN** the user activates the template's apply action
- **THEN** the template prompt is inserted into the main prompt input
- **AND** the prompt counter is updated
- **AND** the template library remains unchanged

#### Scenario: User copies a library template to personal templates

- **WHEN** the user chooses copy to personal templates
- **THEN** a new ordinary user template is created with the library name and prompt
- **AND** it is editable and removable through the existing template editor

### Requirement: Existing Prompt Kit templates remain available beside the library

The expanded library SHALL preserve the existing default templates, user-authored templates and Prompt Agent history templates, including their current insert, edit, save, delete and dismissal behavior. Library filtering and view changes SHALL NOT mutate or persist the user template array.

#### Scenario: User edits a personal template after browsing the library

- **WHEN** the user opens the personal template section and edits or deletes a template
- **THEN** the existing storage and Prompt Agent history rules continue to apply
- **AND** browsing the static library does not rewrite that personal template
