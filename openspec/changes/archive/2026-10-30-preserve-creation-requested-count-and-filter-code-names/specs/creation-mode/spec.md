## MODIFIED Requirements

### Requirement: AI 营销规划隔离不可用条目并同步有效数量

系统 SHALL 在完整营销规划响应解析成功后独立校验每条任务。普通条目的事实失效、分析引用错误、无效或重复 ID／提示词／营销目标、空提示词或标题、图型错误、用户所选普通图型不匹配、参考图编号错误、单图参考数量或字节超限 SHALL 标记为条目错误并从生图计划移除。系统 SHALL 保留原始序号、可用的 ID／标题和原因以供用户查看。失败条目 MUST NOT 占用有效条目的去重键，MUST NOT 排队、补图或计入未完成数量。系统 MUST NOT 通过删除未知事实、虚构证据或任意裁剪参考图放行无效任务。

系统 SHALL 显示请求数、实际可用数和移除／缺少数量。完整 JSON 少条 SHALL 在保留有效条目的同时标记缺少数量；多条 SHALL 将原请求范围外的任务标记为超范围并移除，MUST NOT 超过用户请求范围生成。当前表单的“套图数量” SHALL 保持用户选择，不因资料不足、少返回或移除无效条目而自动减少；显式平台数量覆盖、普通轮播计数、有效总数、队列和保存记录 SHALL 与保留的启用任务一致。SKU 和源图重构 SHALL 继续独立计数。

#### Scenario: 第十三条事实失效

- **WHEN** 用户请求 18 条且模型完整返回 18 条，其中只有第 13 条引用失效事实
- **THEN** 系统保留其它 17 条，并在第 13 条的图片框中显示“缺失”及具体原因
- **AND** 当前表单的“套图数量”保持 18，实际可生成数量为 17，生图只提交这 17 条
- **AND** 系统不重新请求整套规划，也不创建无效项的补图任务

#### Scenario: 无效条目不占用独立任务标识

- **WHEN** 一个条目因失效事实被移除，后续有相同 ID 但其它内容完整有效的条目
- **THEN** 后续条目不因前一个无效条目而误判重复
- **AND** 已接受条目之间的重复仍被标记并移除

#### Scenario: 完整响应少条或多条

- **WHEN** 请求 18 条但完整响应仅返回 16 条，或返回 20 条
- **THEN** 少条时系统显示缺少 2 条并仅保留 16 条中的有效条目
- **AND** 多条时系统标记并移除请求范围外的第 19、20 条，生成不超过请求范围

#### Scenario: 单图参考预算超限

- **WHEN** 只有一个普通条目所需的可信参考图超过单图数量或字节预算
- **THEN** 系统标明并移除该条目，其余有效任务继续
- **AND** 不随意丢弃该条目的依据参考图来绕过预算

#### Scenario: 独立追加任务不影响轮播减量

- **WHEN** 18 条普通轮播移除 1 条，同时存在启用的 2 条 SKU 和 1 条源图重构
- **THEN** 普通轮播数为 17、SKU 数为 2、重构数为 1、总数为 20

#### Scenario: 用户选择二十张但仅十五张有效

- **WHEN** 用户选择 20 张，规划后只有 15 条有效普通任务
- **THEN** 数量选择框保持 20，预览显示实际可生成 15 张及缺失原因
- **AND** 再次规划仍请求 20 张，确认生成仅提交这 15 条有效任务
- **AND** 加入队列不修改当前表单的数量选择


### Requirement: 部分可用计划保持冻结与进度一致

存在可用任务且未破坏整套硬约束时，规划 SHALL 以部分可用终态展示通过数量，并在对应图片框直接展示缺失及原因，MUST NOT 报告为整套失败。预览、冻结提交、服务端复验、队列、保存和补图 SHALL 保留相同的有效条目 ID、最终提示词、参考分配和问题诊断；原始位置 SHALL 可用于锁定／平台约束复验。实际任务减量 SHALL 保留用户的数量选择；冻结生成提交 SHALL 使用实际轮播数量匹配有效输入指纹，MUST NOT 导致刚确认的计划因所选数量与有效数量不同而失效，MUST NOT 触发额外规划请求。后续真实输入变更及陈旧响应隔离 SHALL 继续有效。

#### Scenario: 部分可用计划进入队列

- **WHEN** 18 条规划保留 17 条后，用户确认预览并加入队列
- **THEN** 队列和生图复验采用同一份 17 条冻结计划，进度分母与保存结果一致
- **AND** 17 条最终提示词与参考分配保持不变，不因数量调整要求重新规划

#### Scenario: 图片框直接展示缺失

- **WHEN** 本次规划移除了一个或多个条目
- **THEN** 状态入口显示部分可用，对应原始位置的图片框直接显示“缺失”、原标题及原因
- **AND** 诊断按普通文本渲染，展示框没有加载动画或重试按钮，不写入任务数组，不影响生图、补图或未完成计数
- **AND** 少返回的任务同样显示缺失框，超出请求范围的额外任务不增加图片框

#### Scenario: 生图失败后显示缺失

- **WHEN** 已接受的图片任务在生图阶段失败且没有可展示的图片
- **THEN** 图片框显示“缺失”和具体错误原因
- **AND** 该真实任务保留现有重试机制，已生成或保留的图片不会被缺失框覆盖

### Requirement: Creation Mode grounds product fidelity in the primary reference

Newly planned Creation Mode prompts SHALL express product appearance through one `PRODUCT FIDELITY` instruction grounded in the reference applicable to the image task. Ordinary single-product carousel items SHALL follow the selected primary product reference. Independent SKU items SHALL follow their own exact source references. Variant comparison and grouped size or specification items SHALL preserve each assigned variant from its matching source rather than copying the default product over all groups. The system MUST NOT request, normalize, inject, or display analysis-derived `APPEARANCE LOCK` text as an independent instruction. Legacy analysis payloads containing `appearance_locks` SHALL be accepted without allowing that field to affect new plans. Supporting references MAY contribute facts assigned to their roles, but MUST NOT replace the applicable product reference as the visual authority. Appearance facts assigned to ordinary detail tasks SHALL be scoped using the explicit primary-reference role, not analysis-derived appearance locks.

识别成功并应用参考图建议时，系统 SHALL 仅在商品名称为空或只含空白时，自动填写有效的识别商品主体名称；直接名称缺失时 MAY 使用有效的 SKU 主体名称。类目标签、类目路径、文件名、“商品”等泛称及 F2J14 这类独立货号、型号或纯数字编码 SHALL NOT 单独用于自动填写。含有具体商品描述的名称 MAY 保留其型号信息。已有非空名称 SHALL 保持原文，识别名称 MAY 作为建议显示。反馈 SHALL 明确区分名称已自动填写与仅提供建议；过期识别响应 SHALL NOT 修改名称或发布成功反馈。

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

#### Scenario: 识别名称只有货号或型号

- **WHEN** 识别直接名称或 SKU 名称为 F2J14、SKU-001、纯数字或带货号／型号前缀的独立编码
- **THEN** 系统不把该编码自动填写为商品名称，也不提示该编码已自动填写
- **AND** 若其它 SKU 提供有效的商品描述名称，则使用该有效名称；仅有编码时字段保持为空
- **AND** 用户已有输入保持原文，带具体商品描述的名称仍可自动填写
