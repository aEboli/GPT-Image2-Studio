## ADDED Requirements

### Requirement: Repair rejected marketing directions before returning a partial plan
The system SHALL include rejected or absent marketing image positions in the existing bounded local repair loop, using only confirmed product facts and preserving accepted tasks and user constraints.

#### Scenario: Invalid fact references in multiple directions
- **WHEN** a draft contains image directions referencing unavailable product fact IDs
- **THEN** the system SHALL request replacements for their original positions using the confirmed analysis
- **AND** unsupported directions SHALL be rewritten rather than having their fact IDs silently substituted
- **AND** accepted prompts SHALL remain unchanged

#### Scenario: Missing positions or no accepted images
- **WHEN** a parseable draft has missing positions or every optional image is rejected
- **THEN** the system SHALL allow those positions to be repaired within the same maximum of two repair rounds
- **AND** an exhausted plan without usable images SHALL fail with a specific diagnostic

#### Scenario: Bounded repair preserves constraints
- **WHEN** local repair replaces rejected positions
- **THEN** original positions, selected image types, locked content, platform requirements and factual source validation SHALL remain enforced
- **AND** invalid replacement responses SHALL NOT displace already accepted tasks

## MODIFIED Requirements

### Requirement: AI 营销规划隔离不可用条目并同步有效数量

系统 SHALL 在完整营销规划响应解析成功后独立校验每条任务。普通条目的事实失效、分析引用错误、无效或重复 ID／提示词／营销目标、空提示词或标题、图型错误、用户所选普通图型不匹配、参考图编号错误、单图参考数量或字节超限 SHALL 标记为条目错误并从生图计划移除。系统 SHALL 保留原始序号、可用的 ID／标题和原因，将请求范围内的被拒位置和未返回位置纳入现有最多两轮局部修复。修复 SHALL 复用服务端已确认分析，缺乏证据的方向 SHALL 重写为有依据的任务，MUST NOT 仅删除未知引用、替换事实 ID 或虚构证据来放行原有无依据画面。合格条目、选型、锁定内容和平台硬约束 SHALL 保留。修复仍未通过的条目 MUST NOT 排队、补图或计入未完成数量；失败条目 MUST NOT 占用有效条目的去重键，也 MUST NOT 任意裁剪依据图来绕过预算。

系统 SHALL 显示请求数、最终实际可用数和移除／缺少数量。完整 JSON 少条 SHALL 先修复未返回位置，再保留有效条目并标记剩余缺少数量；多条 SHALL 将原请求范围外的任务标记为超范围并移除，MUST NOT 为超范围位置补规划或生成。当前表单的“套图数量” SHALL 保持用户选择，不因资料不足、少返回或移除无效条目而自动减少；显式平台数量覆盖、普通轮播计数、有效总数、队列和保存记录 SHALL 与保留的启用任务一致。SKU 和源图重构 SHALL 继续独立计数。

#### Scenario: 第十三条事实失效
- **WHEN** 用户请求 18 条且模型完整返回 18 条，其中只有第 13 条引用失效事实
- **THEN** 系统保留其它 17 条，并局部请求修复第 13 条，成功时返回 18 条有效任务
- **AND** 最多两轮后仍失败时，第 13 条显示“缺失”及具体原因，实际可生成数量为 17
- **AND** 当前表单数量保持 18，不重新请求整套规划，不创建无效项的补图任务

#### Scenario: 无效条目不占用独立任务标识
- **WHEN** 被拒条目复用了其它有效条目的 ID
- **THEN** 系统使用不冲突的修复 ID 和原始位置修复被拒条目
- **AND** 保留已有有效条目的 ID、位置、提示词和参考分配

#### Scenario: 完整响应少条或多条
- **WHEN** 请求 18 条但完整响应仅返回 16 条，或返回 20 条
- **THEN** 少条时系统仅修复第 17、18 个位置，失败后显示剩余缺少数量
- **AND** 多条时系统标记并移除第 19、20 条，不为它们修复或生成

#### Scenario: 单图参考预算超限
- **WHEN** 只有一个普通条目所需的可信参考图超过单图数量或字节预算
- **THEN** 系统在现有局部修复预算内要求有据的替代任务，仍超限时移除该条目
- **AND** 不随意丢弃该条目的依据参考图来绕过预算，其余有效任务保持不变

#### Scenario: 独立追加任务不影响轮播减量
- **WHEN** 18 条普通轮播最终移除 1 条，同时存在启用的 2 条 SKU 和 1 条源图重构
- **THEN** 普通轮播数为 17、SKU 数为 2、重构数为 1、总数为 20

#### Scenario: 用户选择二十张但仅十五张有效
- **WHEN** 用户选择 20 张，局部修复结束后只有 15 条有效普通任务
- **THEN** 数量选择框保持 20，预览显示实际可生成 15 张及缺失原因
- **AND** 再次规划仍请求 20 张，确认生成仅提交这 15 条有效任务
- **AND** 加入队列不修改当前表单的数量选择

### Requirement: 错误隔离保留整套阻断边界

无法完整解析的响应、缺少非空顶层 items 且已有协议修复仍失败、全部普通营销任务在最多两轮局部修复后仍无效、共享主体无效、用户锁定项被更改／遗漏／移除或平台必需项被破坏时，系统 SHALL 明确报告整套阻断原因且不提交图片请求。初稿全部普通条目被拒但整套硬约束未被破坏时 SHALL 允许局部修复，不在修复前直接终止。部分接收的流式内容 MUST NOT 作为最终计划生图。已确认的账号级错误 SHALL 沿用现有停止规则；单张上游暂时性失败 SHALL 沿用现有单张失败和重试机制，MUST NOT 因本次规划剔除策略删除已生成结果。

#### Scenario: 全部条目无效
- **WHEN** 完整响应中所有普通营销条目均未通过校验
- **THEN** 系统使用已确认事实和原始位置进行最多两轮局部修复
- **AND** 仍无有效条目时显示零条可用及错误原因，不报告成功，也不发出生图请求

#### Scenario: 必需或锁定条目不可用
- **WHEN** 待移除或遗漏条目破坏平台必需图要求或用户锁定内容
- **THEN** 系统阻止本次生图并解释受影响约束，不静默缩减成不符合要求的计划

#### Scenario: 响应截断或账号级错误
- **WHEN** 规划响应中途截断，或生图确认发生账号级认证／计费错误
- **THEN** 截断规划沿用完整解析与已有重试边界，账号级错误沿用既有停止规则
- **AND** 系统不把半份响应当作成功计划，也不删除已完成图片
