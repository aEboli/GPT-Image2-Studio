## ADDED Requirements

### Requirement: Prompt Kit provides a layered static template library

Prompt Kit SHALL provide a static library organized as一级分类、二级分类和模板条目三级结构。每个二级分类 SHALL contain exactly ten reusable prompt templates, each with a stable ID, non-empty name, non-empty prompt text and a preview image URL. The library SHALL be shipped with the application and SHALL NOT require a request to the referenced third-party site at runtime.

#### Scenario: User opens the template library

- **WHEN** the user opens Prompt Kit
- **THEN** the library shows the top-level categories and their second-level categories
- **AND** the default selected view is the waterfall view
- **AND** the current category contains ten or more visible reusable templates

#### Scenario: User selects a second-level category

- **WHEN** the user selects a second-level category
- **THEN** the library shows exactly the ten templates belonging to that category before search filtering
- **AND** each template exposes a stable name, prompt and preview image

### Requirement: Prompt Kit supports search and three browsing views

The browser SHALL support filtering the current library scope by category name, template name and prompt text, and SHALL provide waterfall, list and image views. The selected view SHALL remain stable while the user changes category or search text until the user explicitly changes it.

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
- **AND** hovering or focusing a card exposes its name and apply action

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
