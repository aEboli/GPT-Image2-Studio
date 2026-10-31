## ADDED Requirements

### Requirement: 批量营销方案使用两个独立规划槽位

系统 SHALL 按方案序号领取批量营销任务，并同时执行最多两个方案。任一方案完成规划及自身副本入队后 SHALL 立即补充下一方案，而不等待另一活动方案。每个方案 SHALL 使用独立变化种子、规划请求、SSE 进度与冻结结果；每个副本 SHALL 具有独立队列快照与任务标识。并行结果 MUST NOT 通过共享预览草稿交接或互相覆盖。

#### Scenario: 较快方案先完成
- **WHEN** 五个方案每个需要生成两套，方案 1 尚未完成而方案 2 已完成
- **THEN** 方案 2 的两个副本按自身顺序加入现有套图队列，并启动方案 3
- **AND** 任意时刻同时执行的方案数不超过 2，全部完成后共计 10 个不同队列任务

#### Scenario: 乱序结果不串用
- **WHEN** 方案 2 的结果先于方案 1 返回
- **THEN** 每个任务的提示词、变化种子、参考文件与营销进度均来自所属方案及批量启动快照
- **AND** 后续表单编辑不改变已开始批量操作的输入与图片质量设置

### Requirement: 并发规划暂停与取消保留可恢复进度

系统 SHALL 在不可恢复规划错误或重试耗尽后停止领取新方案及提交新副本。已发出的另一规划 MAY 收尾，但其有效冻结结果 SHALL 保存为暂停计划，继续时 SHALL 仅补充尚未入队的副本。重试等待后 SHALL 再次检查暂停和取消状态。取消后迟到响应或异常 MUST NOT 恢复执行或覆盖取消状态。已实际入队任务 SHALL 继续保留。

#### Scenario: 同伴规划在失败后返回
- **WHEN** 方案 1 失败暂停，方案 2 已发出且随后返回有效结果
- **THEN** 不启动方案 3，不自动提交方案 2 副本，保存方案 2 冻结结果
- **AND** 用户继续后复用该结果，不重复请求方案 2

#### Scenario: 取消发生在两个规划期间
- **WHEN** 用户取消剩余方案且两个规划随后分别成功或失败
- **THEN** 批量状态保持已取消，未入队副本不再创建，未开始方案不发请求

### Requirement: 套图队列支持两套同时生成

系统 SHALL 同时执行最多两个套图队列任务，并遵守启动时冻结的全局图片请求并发与提交间隔。全局图片请求上限为 1 时 SHALL 只运行一套。自动补图结束前 SHALL 保留所属套图槽位。任务和图片进度 SHALL 按各自队列标识隔离，当前选中套图 MUST NOT 被另一任务更新覆盖。

#### Scenario: 两套运行时补充下一套
- **WHEN** 两套已开始生成，第二套完成而第一套仍在生成或自动补图
- **THEN** 第三套可以开始，任意时刻运行套图数不超过 2
- **AND** 图片上游总请求仍受同一会话的全局上限与提交间隔限制

#### Scenario: 全局图片并发为一
- **WHEN** 批量快照中的全局图片请求并发为 1
- **THEN** 套图队列逐套执行，包括完成自动补图后才释放槽位

## MODIFIED Requirements

### Requirement: Creation Mode can enqueue during generation
The Creation Mode primary generation action SHALL remain available for valid set submissions while another set is running, up to the configured queue limit. New suites SHALL start when one of at most two suite slots is free, subject to the frozen global image-request concurrency limit.

#### Scenario: User submits while another set is running
- **WHEN** a Creation Mode set is already running
- **AND** the user submits valid product inputs for another set
- **THEN** the button communicates the queue action
- **AND** the app stores a snapshot of that set's form data
- **AND** the queued set may start alongside the active set if a suite slot is free, otherwise it waits for a slot
