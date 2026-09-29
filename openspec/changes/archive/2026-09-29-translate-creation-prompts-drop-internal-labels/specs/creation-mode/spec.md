## ADDED Requirements

### Requirement: Creation prompts are free of internal planning labels and translated to the target language

Creation item prompts SHALL NOT contain internal planning metadata labels, including `Category template:`, `Ecommerce category path:`, a `Product category:` line naming a category code, `Scenario:` labels, and `Role focus:` or `Role category focus:` labels. Selected category and scenario values SHALL remain available in the plan parameters. For a fourth-level category template, each role SHALL contribute only its most specific category guidance once.

The dimension and size-capacity image SHALL render only the listed specification values as canvas labels; other wording printed on the reference images SHALL stay off that canvas.

When a Creation set is submitted for generation and an item's target language is not Chinese, the system SHALL translate the Chinese segments of that item's prompt into the target language with the configured text model in one request per language before generation. Infographic rebuild items and Chinese-target items SHALL keep their prompts unchanged. When no text model is configured or translation fails, generation SHALL continue with the original prompts and the client SHALL show a translation warning.

#### Scenario: Category template metadata stays out of prompts

- **WHEN** the user plans a set with a fourth-level category template
- **THEN** no item prompt contains the category template name label, the category path label, the category code, or a role category focus label
- **AND** each role prompt still contains that role's category-specific visual guidance

#### Scenario: Scenario labels stay out of prompts

- **WHEN** the user plans a set for any marketing scenario
- **THEN** no item prompt contains a `Scenario:` label

#### Scenario: English set translates Chinese prompt segments at generation

- **WHEN** the user submits an English-target set whose prompts contain Chinese product name, description, selling points, or reference notes
- **THEN** the server sends one translation request to the configured text model
- **AND** generation uses prompts with those segments replaced by English translations

#### Scenario: Translation is unavailable

- **WHEN** the user submits an English-target set with Chinese prompt segments and no text model is configured or the translation request fails
- **THEN** generation continues with the original prompts
- **AND** the client shows a prompt translation warning
