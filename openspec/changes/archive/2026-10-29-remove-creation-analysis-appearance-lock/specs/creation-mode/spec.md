## ADDED Requirements

### Requirement: Creation Mode grounds product fidelity in the primary reference

Newly planned Creation Mode carousel and SKU prompts SHALL express product appearance through one `PRODUCT FIDELITY` instruction grounded in the selected primary product reference when one exists. The system MUST NOT request, normalize, inject, or display analysis-derived `APPEARANCE LOCK` text as an independent instruction. Legacy analysis payloads containing `appearance_locks` SHALL be accepted without allowing that field to affect new plans. Supporting references MAY contribute facts assigned to their roles, but MUST NOT replace the primary reference as the visual product authority. Appearance facts assigned to detail tasks SHALL be scoped using the explicit primary-reference role, not analysis-derived appearance locks.

Reference analysis SHALL NOT automatically replace the user's product-name field with a visually inferred product name, category name, or SKU title; such values MAY be shown as suggestions for review.

#### Scenario: Analysis returns an incorrect appearance lock

- **WHEN** a legacy or upstream analysis payload includes an `appearance_locks` entry that conflicts with the primary product reference
- **THEN** normalization and newly planned prompts ignore that entry
- **AND** the generated prompt retains `PRODUCT FIDELITY` grounded in the primary product reference

#### Scenario: AI marketing planning uses primary-reference fidelity

- **WHEN** Creation Mode builds an AI marketing plan with a primary product reference
- **THEN** the planner context does not include an analysis-derived subject-lock contract
- **AND** each unlocked final item prompt contains the primary-reference `PRODUCT FIDELITY` instruction without a separate `APPEARANCE LOCK`

#### Scenario: SKU and generation reference labels omit analysis locks

- **WHEN** a new SKU item or carousel item is planned from product analysis containing legacy appearance locks
- **THEN** its prompt context and generation reference labels contain no analysis-derived subject lock
- **AND** the SKU's own selected references and product-fidelity instruction remain in effect

#### Scenario: Evidence-chain preview omits the separate lock row

- **WHEN** the user opens an AI-planned item's evidence chain
- **THEN** the preview shows its task, facts, recommendations, and sources without a separate subject-lock value

#### Scenario: Primary-reference appearance facts remain scoped

- **WHEN** primary and supporting references contain different appearance facts
- **THEN** detail-task appearance facts are selected by the explicit primary-reference role index
- **AND** removing `appearance_locks` does not promote supporting-reference appearance facts to primary-reference facts

#### Scenario: Visually inferred product name remains a suggestion

- **WHEN** reference analysis recommends a product name that differs from the name entered by the user
- **THEN** applying reference roles and category recommendations leaves the product-name field unchanged
- **AND** the inferred name remains available in analysis feedback for the user to review

## MODIFIED Requirements

### Requirement: Product insights distinguish evidence from creative inference

智能识别 SHALL 在同一次视觉请求中提供带参考来源的外观及商品事实、买点、痛点、使用场景、未知项和冲突项，MUST NOT 请求或生成独立的分析外观锁。使用场景 SHALL 作为创意建议，MUST NOT 自动转化为参数或性能承诺。没有来源的温度、档位、续航、材质成分、认证和防护等级 MUST NOT 进入画布文案。

同一商品不同参考图提供的可读事实 SHALL 作为互补信息保留。冲突 SHALL 仅指同一商品、同一属性、相同条件存在互斥值；新分析 SHALL 为冲突提供商品、属性、条件和值的可比较项。无法独立核实、信息分布在不同图片、属性不同、变体不同或操作条件不同 MUST NOT 单独成为排除事实的理由。无法确认的关联 SHALL 保留为非阻断待确认项，MUST NOT 由独立事实合成未提供的性能承诺。

#### Scenario: 手套用途分析不虚构性能

- **WHEN** 主图只清晰显示卡其手套、掌心纹理和手背控制器
- **THEN** 分析保留这些外观依据，并可以提出与用途相符的冬季通勤、摄影或垂钓场景
- **AND** 不从这些场景推断防水等级、续航、温度或加热档位

#### Scenario: 辅助资料有矛盾

- **WHEN** 同一商品同一条件的辅助图同时出现三档与五档说明
- **THEN** 分析把差异列为冲突并要求补充确认
- **AND** 不同时或随机把两种档位写入新图片

#### Scenario: 跨图参数补充

- **WHEN** 图1和图2标示3000mAh，图3标示45°C续航6小时，且没有相反的同属性信息
- **THEN** 分析和计划保留电池容量、温度和续航及其各自来源，不产生商品资料冲突警告
- **AND** 不要求每张图重复所有参数，也不从这些信息推算额外性能

#### Scenario: 不同条件的参数并存

- **WHEN** 资料分别标示45°C续航6小时和55°C续航3小时，或不同款式分别标示不同电池容量
- **THEN** 分析按条件或款式保留各自事实，不将差异视为同一属性在相同条件下的冲突

#### Scenario: 旧分析仅表示无法核实

- **WHEN** 旧分析因资料位于不同图片、对应关系无法独立核实而报告冲突，且没有明确的互斥值说明
- **THEN** 规范化将该提示保留为非阻断待确认项，并保留已识别的独立事实
- **AND** 旧分析中明确的真实矛盾继续排除相关宣称

### Requirement: 可选 AI 整套营销提示词一次规划全部图片

套图 SHALL 提供默认开启且可记忆的“AI 整套营销提示词”开关。开启后 SHALL 由电商视觉营销专家在正常成功路径的一次规划请求中返回全部 N 条可直接用于生图的提示词，并提供每项的图片类型、营销目标、受众、卖点/痛点、营销建议和参考图分配。缺少有效分析时 SHALL 在同一次请求中按现有契约补齐商品分析与参考用途。系统 MUST NOT 为每张图单独发出一次提示词规划请求。

AI 模式普通营销轮播 SHALL 支持 1–20 张，并以独立 ID 标识同一图型下不同的营销任务，MUST NOT 被现有 18 个固定槽位裁剪。SKU 与独立源图重构 SHALL 保持现有单独计数和执行规则。开关关闭时 SHALL 使用原有本地规划，0 张普通轮播 MUST NOT 发起空的 AI 规划请求。

系统 SHALL 在图片生成前校验返回数量、ID、图型、非空提示词、策略与事实引用、参考图编号和商品主体绑定。对于商品分析已确认的主主体和事实来源，若模型仅漏写其参考编号，系统 SHALL 将对应的可信原始上传编号补入逐图分配，再执行数量和字节预算校验。用户手动锁定的主体优先；否则主体索引 SHALL 在分析请求前确定，分析响应 MUST NOT 通过重排或修改辅助图角色悄然更换全套主体。MUST NOT 猜测未知来源、静默丢弃无效编号，或在补齐后超过单图参考上限和字节预算。真正缺少来源或无效的结果 MUST NOT 进入图片生成。

营销规划响应 SHALL 包含非空的顶层 `items`。系统 MUST NOT 将截断的整套对象解析为其内部的任意 JSON 子对象。首次响应缺少整套条目时，系统 MAY 对全套做一次携带完整规划 schema 和所需条目数量的重试；若重试仍不完整，SHALL 显示明确错误，MUST NOT 把它报告为成功的零条计划或发出图片请求。

预览 SHALL 使用户能够核对逐图营销任务、最终提示词和参考分配。生成、队列、保存和补图 SHALL 使用同一份冻结的最终提示词与参考分配。系统生成的 `PRODUCT FIDELITY` SHALL 在新预览最终提示词中只出现一次，不附加分析外观锁；同一有效计划提交生成时 MUST 保持提示词字节内容不变。已有有效预览、普通重试和补图 MUST NOT 自动重新规划整套提示词；输入发生相关变化后 SHALL 使新草稿计划失效，并拒绝陈旧响应覆盖当前结果。

#### Scenario: AI 遗漏主体和事实来源编号

- **WHEN** 20 条完整计划已引用有效商品事实，但部分条目的参考索引遗漏事实来源图或预先确定的主主体图
- **THEN** 系统将分析已确认的来源编号补入逐图参考分配并保留原始上传编号
- **AND** 相同参考分配进入预览与后续图片请求
- **AND** 若补齐会超过 8 张或现有字节预算，系统明确拒绝，不静默删图

#### Scenario: 辅助图分析响应尝试更换主主体

- **WHEN** 规划前图 1 已被选作主主体，模型响应将图 2 提为商品主体或重排参考图
- **THEN** 系统仍将图 1 用作本套图主体，且图 2 不会被提升为整体主主体

#### Scenario: 流式规划响应被截断

- **WHEN** 模型响应只包含一个完整的内部商品事实对象，而整套 JSON 在 `items` 返回前被截断
- **THEN** 系统不将内部对象识别成完整套图计划
- **AND** 系统最多重试一次完整整套规划，之后仍不完整则显示明确错误，且不发出生图请求

#### Scenario: 已预览提示词包含参考图保真约束

- **WHEN** 用户提交一份已包含 `PRODUCT FIDELITY` 的有效预览计划
- **THEN** 冻结和生成阶段保留相同提示词且不重复插入同一保真约束

#### Scenario: 一次规划 20 张营销图

- **WHEN** 用户开启开关并选择 20 张普通营销轮播，且当前资料足以支持计划
- **THEN** 正常路径的一次规划请求返回 20 个唯一且完整的条目
- **AND** 计划、预览和生图不将条目裁剪为 18，也不逐图重复请求提示词

#### Scenario: 分配落实到实际图片请求

- **WHEN** 某条提示词选择主主体图及一张功能说明图作为依据
- **THEN** 该项图片请求使用计划中相同的提示词、图型和已校验参考分配
- **AND** 不只在文案中提到这两张图却发送其他无关参考或错误编号

#### Scenario: 生成直接使用已预览计划

- **WHEN** 用户核对过有效的 AI 整套预览后开始生成
- **THEN** 系统直接使用相同的最终提示词与参考图分配
- **AND** 不再次调用模型生成另一套内容

#### Scenario: 规划条目不完整

- **WHEN** 用户选择 20 张，模型完整响应只返回 18 条，或部分普通条目返回空提示词、重复 ID 或不存在的参考图
- **THEN** 系统标明缺少数量或移除对应无效条目，重新计算实际可生成数量
- **AND** 剩余任务有效且未破坏整套硬约束时可以生成，不静默填入模板条目
- **AND** 响应截断、没有可用营销条目或破坏平台必需项／用户锁定项时阻止生成

#### Scenario: 用户补图

- **WHEN** 某个已保存的 AI 规划图片生成失败并执行补图
- **THEN** 补图继续采用原记录中的最终提示词和参考分配
- **AND** 不重新生成整套提示词，也不使用当前其他商品的分析

#### Scenario: 用户修改商品或规划条件

- **WHEN** 商品资料、参考图、分析、语言、张数、平台、视觉风格、图型约束或开关发生影响规划的变化
- **THEN** 新草稿旧计划失效，需要重新规划
- **AND** 旧异步响应不能覆盖当前草稿，已排队和历史记录保留各自冻结计划

#### Scenario: 用户锁定单图提示词

- **WHEN** 用户在规划前明确锁定某张图的提示词或图型
- **THEN** 整套规划保留该项约束，并为其余图片安排互补的营销任务
- **AND** 用户手动内容不会被新规划静默覆盖

完整返回数量偏差和普通条目错误 SHALL 按“AI 营销规划隔离不可用条目并同步有效数量”处理；这些错误本身 MUST NOT 使其它有效条目失效。上述完整解析、来源真实性、冻结一致性和整套硬约束要求 SHALL 继续有效。

### Requirement: 套图提示词使用分层事实预算

新套图计划 SHALL 按图片任务向每张提示词提供主参考图保真约束、本图任务和已分配事实。每张图 SHALL 保留本图所需的保真约束、事实、数值条件、平台边界和用户手写提示词，MUST NOT 额外注入分析外观锁；不得因字符长度而拒绝或截断已通过来源校验的 AI 营销提示词。模板首图、普通图及 SKU SHALL 完整保留已选提示词段落，去除空段和重复段落；MUST NOT 使用整条提示词字符压缩目标省略段落或产生长度超标警告。其它整套分析 MUST NOT 因为已被识别就重复注入每张图或附图标签。

#### Scenario: 长分析不淹没参考图保真约束

- **WHEN** 商品分析返回多个事实、场景、卖点和营销建议
- **THEN** 首图和普通图只携带与本图任务匹配的有限事实
- **AND** 每张提示词仍保留以主参考图为准的 `PRODUCT FIDELITY`
- **AND** 已选的保真约束、逐图事实、数值条件和辅助段落完整保留，仅合并重复段落

#### Scenario: 必需内容较长

- **WHEN** 保真约束或完整规格使 AI 营销提示词较长
- **THEN** 系统保留其完整内容，并继续执行来源、主体和图型校验
- **AND** 系统不得仅因字符长度拒绝该计划或截断未知语义

#### Scenario: 模板提示词超过旧字符目标

- **WHEN** 模板首图超过 1200 字符，或普通图及 SKU 超过 1000 字符
- **THEN** 系统保留已选的完整段落，包括购买理由和 SKU 系列一致性要求
- **AND** 新计划不产生 `creation-prompt-budget` 警告

#### Scenario: SKU外观不得串到另一款式

- **WHEN** 主主体是黑色手套，另一个有来源的SKU是红色手套
- **THEN** 每个SKU的保真约束只绑定自身参考图，不注入分析外观锁
- **AND** 红色SKU使用自身来源的外观说明，不复制黑色款的控制器或表面标识

#### Scenario: 已冻结记录保持兼容

- **WHEN** 新计划经过预览、冻结、保存和补图
- **THEN** 实际提示词和参考图保真约束保持一致
- **AND** 缺少新版本标记的旧冻结计划仍可读取，读取时不重写历史提示词

### Requirement: 营销任务区分真实使用价值并保持商品身份

整套营销规划 SHALL 明确每图用途、主要购买问题、适用场景或证据焦点，并优先安排有事实支持的不同使用任务。系统 SHALL 提示只更换近义标题、背景或色调的重复风险，不为诊断额外自动调用模型或擅自删图。主参考图保真约束 SHALL 保护商品身份、部件和表面归属、标识、数量及参考支持的状态，MUST NOT 以分析外观锁作为第二外观依据；场景适应 MAY 改变参考支持的姿态、动作、环境和光照，但 MUST NOT 创造商品能力。

#### Scenario: 白底图和到手清单姿态相似
- **WHEN** 两图主体姿态相似但分别回答商品外观和实际包装内容两个有据可核对的问题
- **THEN** 系统保留两项独立用途而不只凭姿态相似删除任务

#### Scenario: 两张雪景图只换近义标语
- **WHEN** 两项购买问题、动作和证据表达相同，仅背景或标题近义改写
- **THEN** 规划视图提示重复风险并显示可供核对的任务分工
- **AND** 生成前仍遵守平台必需项、用户锁定项和原有事实校验

#### Scenario: 手套从静物改为骑行佩戴
- **WHEN** 商品事实与参考支持骑行握持表现
- **THEN** 场景和姿态可适应握持动作
- **AND** 掌面防滑区域、手背控制部件和标识保持正确归属
