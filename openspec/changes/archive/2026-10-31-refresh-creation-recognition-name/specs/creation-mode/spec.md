## MODIFIED Requirements

### Requirement: Creation Mode grounds product fidelity in the primary reference

Newly planned Creation Mode prompts SHALL express product appearance through one `PRODUCT FIDELITY` instruction grounded in the reference applicable to the image task. Ordinary single-product carousel items SHALL follow the selected primary product reference. Independent SKU items SHALL follow their own exact source references. Variant comparison and grouped size or specification items SHALL preserve each assigned variant from its matching source rather than copying the default product over all groups. The system MUST NOT request, normalize, inject, or display analysis-derived `APPEARANCE LOCK` text as an independent instruction. Legacy analysis payloads containing `appearance_locks` SHALL be accepted without allowing that field to affect new plans. Supporting references MAY contribute facts assigned to their roles, but MUST NOT replace the applicable product reference as the visual authority. Appearance facts assigned to ordinary detail tasks SHALL be scoped using the explicit primary-reference role, not analysis-derived appearance locks.

识别成功并应用当前参考图建议时，系统 SHALL 用有效的识别商品主体名称直接覆盖当前商品名称，包括手动名称和上一轮自动名称；直接名称缺失时 MAY 使用有效的 SKU 主体名称。类目标签、类目路径、文件名、“商品”等泛称及 F2J14 这类独立货号、型号或纯数字编码 SHALL NOT 单独用于自动填写。含有具体商品描述的名称 MAY 保留其型号信息。没有有效新名称时 SHALL 保留当前名称。修改参考图 SHALL 保留当前名称直到新的有效识别结果替换，旧自动名称 SHALL NOT 作为下一次识别的用户事实。修改商品名称或描述 SHALL 使规划草稿失效，但 SHALL NOT 单独取消当前参考图识别、剔除已应用的参考图分析或阻止当前文件批次的新识别结果覆盖名称。系统 SHALL 继续按当前输入校验用户来源事实；文件、平台或请求版本已变化的过期响应 SHALL NOT 修改名称或发布成功反馈。显式清空参考图仍 SHALL 沿用原有重置流程。

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

- **WHEN** reference analysis offers only a category label as a name suggestion without a valid identified product or SKU subject name
- **THEN** applying reference roles and category recommendations leaves the product-name field unchanged
- **AND** the inferred category label remains available as a suggestion for the user to review

#### Scenario: 新识别直接覆盖已有名称

- **WHEN** 当前参考图识别返回有效名称，当前字段已有手动名称或上一轮自动名称
- **THEN** 成功应用识别结果直接覆盖名称，并显示已自动填写的成功反馈
- **AND** 识别期间修改名称或描述不会仅因此丢弃当前文件批次的识别结果

#### Scenario: 自动补全空商品名称

- **WHEN** 当前名称为空或只含空白，识别返回有效的商品主体名称或 SKU 主体名称
- **THEN** 名称输入框自动填入该名称，成功反馈显示已自动填写并提醒核对

#### Scenario: 缺少有效名称或识别已过期

- **WHEN** 识别只有类目、文件名或泛称，或者文件、平台或请求版本在异步识别期间发生变化
- **THEN** 无效名称不覆盖或清空已有名称，过期响应不修改名称或发布成功反馈

#### Scenario: 识别名称只有货号或型号

- **WHEN** 识别直接名称或 SKU 名称为 F2J14、SKU-001、纯数字或带货号／型号前缀的独立编码
- **THEN** 系统不把该编码自动填写为商品名称，也不提示该编码已自动填写
- **AND** 若其它 SKU 提供有效的商品描述名称，则使用该有效名称；仅有编码时字段保持原值
- **AND** 无有效识别名称时用户已有输入保持原文，带具体商品描述的有效新名称仍覆盖当前名称

#### Scenario: 修改参考图不清空商品名称

- **WHEN** 参考图变更使旧分析失效，但新的识别尚未成功
- **THEN** 商品名称保持现值，旧自动名称不作为新识别的用户事实
- **AND** 新的有效名称成功返回后覆盖现值；识别失败或没有有效名称时继续保留现值

#### Scenario: 编辑商品文字保留参考图分析

- **WHEN** 用户在同一参考图批次下修改商品名称或描述
- **THEN** 规划草稿失效，参考图分析仍保留并进入下次规划载荷
- **AND** 当前用户文字不再支持的用户来源事实仍被原有来源校验过滤
