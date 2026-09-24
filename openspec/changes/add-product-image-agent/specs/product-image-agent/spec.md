# product-image-agent Specification

## ADDED Requirements

### Requirement: Agent analyzes product groups for visual marketing opportunities
The system SHALL accept a group of product reference images and return evidence-based product facts, pain points, selling points, target audiences, usage scenarios, risks, and image plans.

#### Scenario: User analyzes a product group
- **WHEN** the user uploads product images and starts analysis
- **THEN** the system returns structured marketing insights and 3–6 image plans
- **AND** unsupported claims are surfaced as risks instead of being invented

### Requirement: Image plans provide bilingual prompts
Each image plan SHALL provide a directly usable pure-English prompt and a faithful Simplified Chinese counterpart, plus reference image indexes and concrete avoid terms.

#### Scenario: User reviews a plan
- **WHEN** an image plan is displayed
- **THEN** the English prompt contains no Chinese or other non-Latin script
- **AND** the Chinese counterpart describes the same visible constraints

### Requirement: Agent uses the default text model configuration
The product-image-agent analysis SHALL use the saved default text-vision API key and model rather than the image-generation model-protocol configuration.

#### Scenario: User analyzes while an image route is selected
- **WHEN** the saved image route is Route C and a default text-vision configuration is available
- **THEN** product-image-agent analysis uses the default text-vision endpoint, API key, and model

### Requirement: Plans can generate images with references
The browser SHALL allow generating one plan or all plans through the existing image generation endpoint, passing the plan prompt and selected uploaded references.

#### Scenario: User generates one planned image
- **WHEN** the user clicks “生成此图” on an image plan
- **THEN** the browser sends that plan's English prompt and selected reference images to `/api/generate`
- **AND** the final image is shown with a download action

### Requirement: The workbench expands a source plan into routed image tasks
The browser SHALL let the user select one or more workspaces, channels, and content directions, then materialize a bounded task matrix from the analyzed image plans.

#### Scenario: User selects multiple spaces and channels
- **WHEN** the user selects compatible workspaces, channels, and content directions
- **THEN** the workbench shows one task card for each compatible combination
- **AND** each task card identifies its workspace, channel, direction, aspect ratio, and source references
- **AND** the task prompt adapts the base plan to that target without changing the product identity

#### Scenario: User changes routing after analysis
- **WHEN** the user changes a workspace, channel, or content direction selection
- **THEN** the task matrix is rebuilt from the current selections
- **AND** previous task previews are cleared so a result cannot be mistaken for a different target
