## ADDED Requirements

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
