## ADDED Requirements

### Requirement: Prompt mode limits total queued tasks and shared generation concurrency

提示词模式 SHALL 在当前页面最多保留 15 个未完成任务，其中包括正在生成和排队中的任务；已完成、失败或取消并从任务状态移除的任务不再占用容量。提示词模式 SHALL 最多同时让 10 个任务进入生成流程。Route A、Route B、Route C 的提示词任务 SHALL 共享这 10 个并发槽位，而不是按路由分别创建并发池。其他生成模式 SHALL 保持既有的 15 并发和模式/路由隔离行为。

#### Scenario: Ten prompt tasks generate while later tasks wait

- **WHEN** 用户在提示词模式连续提交 15 个有效任务
- **THEN** 前 10 个任务进入生成流程
- **AND** 其余 5 个任务保留在本地队列并处于“排队中”状态
- **AND** 在前序任务释放槽位前，排队任务不得发起上游生成请求

#### Scenario: The prompt queue rejects the sixteenth task

- **WHEN** 当前已有 15 个提示词任务，且其中任意数量处于生成中或排队中
- **THEN** 新的提示词提交被拒绝
- **AND** 页面说明提示词模式最多保留 15 个任务
- **AND** 已有 15 个任务及其排队顺序不被清空或重排

#### Scenario: Prompt routes share the same ten slots

- **WHEN** 用户在 Route A、Route B 和 Route C 之间切换并提交提示词任务
- **THEN** 三个路由的提示词生成中任务总数不得超过 10
- **AND** 切换路由不得为提示词模式创建新的并发池
- **AND** 某个任务完成、失败或取消后，最早的排队提示词任务获得释放的槽位

#### Scenario: Other modes retain their existing limit

- **WHEN** 用户提交非提示词模式的生成任务
- **THEN** 该任务继续使用该模式既有的并发上限和路由作用域
- **AND** 提示词模式的 10 并发限制不改变其他模式的调度行为

### Requirement: Prompt queue cards remain visible independently from preview orb slots

提示词模式的底部胶片条 SHALL 展示当前任务窗口内最多 15 个生成任务，包括生成中和排队中的任务。排队任务 SHALL 使用现有的“排队中”状态文案或等价的本地化文案。主预览区域 SHALL 继续最多渲染 6 个加载 orb；该 orb 上限与胶片条的 15 个任务卡片上限是独立边界。

#### Scenario: Five queued tasks remain visible beside six preview orbs

- **WHEN** 提示词模式已有 10 个生成中任务和 5 个排队任务
- **THEN** 底部胶片条最多显示这 15 个任务卡片
- **AND** 5 个排队卡片显示“排队中”状态
- **AND** 主预览区域仍最多显示 6 个加载 orb

#### Scenario: Completed tasks release both queue capacity and filmstrip slots

- **WHEN** 一个提示词任务完成并从未完成任务集合移除
- **THEN** 一个最早排队任务可以进入可用生成槽位
- **AND** 新提交任务可以使用释放出的 15 个任务窗口容量
- **AND** 胶片条不再把已移除任务作为排队卡片保留
