## ADDED Requirements

### Requirement: SKU color recognition is context-safe and target-localized
The SKU color normalizer SHALL reject ambiguous token occurrences inside unrelated words or conjunction phrases and SHALL emit canonical color-only values. When one unit has multiple recognized colors, the planner SHALL localize every color into the selected supported target language before composing the exact visible label.

#### Scenario: Product text contains ambiguous CJK substrings
- **WHEN** product text contains `青少年防紫外线` without reliable visible color evidence
- **THEN** the normalizer does not infer blue, cyan, or purple labels from those substrings

#### Scenario: English conjunction resembles a foreign color token
- **WHEN** an English value contains `black or rose`
- **THEN** the normalizer does not emit `black or rose` as one color-only label
- **AND** conjunction text is never preserved as a color name

#### Scenario: Chinese target receives a multi-color English label
- **WHEN** a reliable unit label is `brown black silver` and the selected target language is Simplified Chinese
- **THEN** the planned exact visible label contains the corresponding Chinese color names in the same order
- **AND** no English color token remains in that label

### Requirement: Product-name category matching requires reliable category semantics
Automatic fourth-level category matching from a product name SHALL use exact category identity, explicit aliases, or existing scored context that reliably identifies the category path. A unique but broad leaf-name suffix alone SHALL NOT select or write a category.

#### Scenario: Unrelated products share a broad leaf suffix
- **WHEN** a product name is `钢琴支架`, `硬盘支架`, `相机支架`, or `投影仪支架` without mobile-accessory context
- **THEN** the system does not assign `数码电子 > 手机通讯 > 手机配件 > 支架`
- **AND** automatic selection falls back without overwriting a manual category
