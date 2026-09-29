## MODIFIED Requirements

### Requirement: Target language controls marketing prompts

For ordinary Creation carousel and SKU items, when an assigned supporting reference image or note contains source-language facts, the runtime prompt SHALL treat them as evidence for the assigned role only and require supported facts used as new canvas text to be translated into the selected target language rather than copied verbatim. It SHALL require a newly composed output canvas with fresh typography and graphics. Existing text physically on the supplied product or packaging remains protected by the subject-content rule.

#### Scenario: English ordinary item uses a Chinese dimension card as evidence

- **WHEN** an English Creation item receives a dimension reference whose surrounding canvas contains Chinese labels
- **THEN** the item prompt treats the reference image and note as dimension facts only
- **AND** new labels and captions on the generated canvas use English
- **AND** the Chinese source card's wording and visual layout do not become output copy or a layout template

## ADDED Requirements

### Requirement: Explicit submitted target language overrides stale frozen language

When Creation generation submits an effective frozen plan together with an explicit target language, the submitted plan SHALL apply that language to the plan and every item. Ordinary item prompts SHALL replace generated canvas-language guidance from the frozen prompt with the explicit language. If the field is absent, the frozen plan remains authoritative. Dedicated `infographic-rebuild` items SHALL continue to execute the canonical source-only prompt with their resolved technical controls.

#### Scenario: English request replaces a Chinese frozen plan

- **WHEN** a frozen Creation plan stores Simplified Chinese and the generation request explicitly submits English
- **THEN** all submitted item target-language metadata resolves to English
- **AND** ordinary runtime prompts contain English canvas-language guidance without stale Chinese guidance
- **AND** item roles, references, and technical generation parameters remain unchanged

