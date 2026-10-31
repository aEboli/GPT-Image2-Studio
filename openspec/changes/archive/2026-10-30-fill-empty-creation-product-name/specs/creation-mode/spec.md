## MODIFIED Requirements

### Requirement: Creation Mode grounds product fidelity in the primary reference

Newly planned Creation Mode prompts SHALL express product appearance through one `PRODUCT FIDELITY` instruction grounded in the reference applicable to the image task. Ordinary single-product carousel items SHALL follow the selected primary product reference. Independent SKU items SHALL follow their own exact source references. Variant comparison and grouped size or specification items SHALL preserve each assigned variant from its matching source rather than copying the default product over all groups. The system MUST NOT request, normalize, inject, or display analysis-derived `APPEARANCE LOCK` text as an independent instruction. Legacy analysis payloads containing `appearance_locks` SHALL be accepted without allowing that field to affect new plans. Supporting references MAY contribute facts assigned to their roles, but MUST NOT replace the applicable product reference as the visual authority. Appearance facts assigned to ordinary detail tasks SHALL be scoped using the explicit primary-reference role, not analysis-derived appearance locks.

识别成功并应用参考图建议时，系统 SHALL 仅在商品名称为空或只含空白时，自动填写有效的识别商品主体名称；直接名称缺失时 MAY 使用有效的 SKU 主体名称。类目标签、类目路径、文件名和“商品”等泛称 SHALL NOT 单独用于自动填写。已有非空名称 SHALL 保持原文，识别名称 MAY 作为建议显示。反馈 SHALL 明确区分名称已自动填写与仅提供建议；过期识别响应 SHALL NOT 修改名称或发布成功反馈。

#### Scenario: Analysis returns an incorrect appearance lock

- **WHEN** a legacy or upstream analysis payload includes an `appearance_locks` entry that conflicts with the applicable product reference
- **THEN** normalization and newly planned prompts ignore that entry
- **AND** the generated prompt retains `PRODUCT FIDELITY` grounded in the task's product reference

#### Scenario: AI marketing planning uses primary-reference fidelity

- **WHEN** Creation Mode builds an AI marketing plan with a primary product reference
- **THEN** the planner context does not include an analysis-derived subject-lock contract and identifies the default fidelity contract as applying to ordinary single-product images
- **AND** each unlocked final item prompt contains a task-scoped `PRODUCT FIDELITY` instruction without a separate `APPEARANCE LOCK`

#### Scenario: SKU and generation reference labels omit analysis locks

- **WHEN** a new SKU item or carousel item is planned from product analysis containing legacy appearance locks
- **THEN** its prompt context and generation reference labels contain no analysis-derived subject lock
- **AND** the SKU's own selected references and product-fidelity instruction remain in effect

#### Scenario: Evidence-chain preview omits the separate lock row

- **WHEN** the user opens an AI-planned item's evidence chain
- **THEN** the preview shows its task, facts, recommendations, and sources without a separate subject-lock value

#### Scenario: Primary-reference appearance facts remain scoped

- **WHEN** primary and supporting references contain different appearance facts
- **THEN** ordinary detail-task appearance facts are selected by the explicit primary-reference role index
- **AND** removing `appearance_locks` does not promote supporting-reference appearance facts to primary-reference facts

#### Scenario: Visually inferred product name remains a suggestion

- **WHEN** reference analysis recommends a product name that differs from the name entered by the user
- **THEN** applying reference roles and category recommendations leaves the product-name field unchanged
- **AND** the inferred name remains available in analysis feedback for the user to review

#### Scenario: 自动补全空商品名称

- **WHEN** 当前名称为空或只含空白，识别返回有效的商品主体名称或 SKU 主体名称
- **THEN** 名称输入框自动填入该名称，成功反馈显示已自动填写并提醒核对

#### Scenario: 缺少有效名称或识别已过期

- **WHEN** 识别只有类目、文件名或泛称，或者用户在异步识别期间修改了输入
- **THEN** 系统不使用无效名称填充字段，且过期响应不覆盖用户输入或发布成功反馈
