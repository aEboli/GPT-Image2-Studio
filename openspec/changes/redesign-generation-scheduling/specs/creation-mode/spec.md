## ADDED Requirements

### Requirement: 套图队列按整套串行

浏览器套图队列 SHALL 在任一套图处于 `running` 时保持其他套图为 `queued`。当前套图的 SSE 流、自动补图请求和终态结算全部完成后，调度器才可启动下一套。套图中途的单项完成、失败或流事件 SHALL NOT 提前放行下一套。

#### Scenario: 单套完成前不重叠下一套

- **WHEN** 第一套套图仍有运行中项目或正在进行自动补图，第二套已排队
- **THEN** 第二套不发起 `/api/creation/generate` 或 `/api/creation/repair`
- **AND** 第一套终态结算完成后第二套才开始

### Requirement: 套图自动路径限制上游尝试次数

套图生成、套图 Logo 批量和套图补图 SHALL 不在同一轮对失败项立即队尾重排。套图条目 SHALL 持久化 `generationAttemptCount`；自动补图 SHALL 只选择未完成且次数小于 `2` 的条目，并在真实上游调用前递增计数。达到 `2` 次的条目 SHALL 保持失败或未完成状态，且 SHALL NOT 因自动补图再次发起请求。用户明确触发的手动补图 SHALL 不受该自动过滤器限制。

#### Scenario: 暂时性 402 最多获得一次自动补图

- **WHEN** 条目首轮因暂时性 402 失败，`generationAttemptCount` 为 `1`
- **THEN** 该条目可进入一次自动补图
- **AND** 自动补图发起前计数变为 `2`

#### Scenario: 耗尽条目被自动补图跳过

- **WHEN** 条目未完成且 `generationAttemptCount` 已为 `2`
- **THEN** 自动补图不为该条目发起上游请求
- **AND** 其他未耗尽条目仍可进入一次自动补图

### Requirement: 套图调度使用共享会话控制

套图生成、套图 Logo 批量和套图补图 SHALL 使用 `creation` scope 的共享任务 slot 与发车闸门。并发值 SHALL 同时作为 worker 上限和 slot 上限；提交间隔 SHALL 在每个真实上游生成调用之前生效。

#### Scenario: Logo 批量与普通套图共用预算

- **WHEN** 同一会话同时运行普通套图和 Logo 批量
- **THEN** 两者不各自创建独立的 creation 并发桶或提交计时器

### Requirement: 已创建 Responses 任务的临时失败只回查原任务

Responses 流或 HTTP 错误已经提供可识别的原任务 ID，且错误明确表示临时容量或限流失败（包括此类 HTTP `402`）时，系统 SHALL 仅通过 GET 回查该原任务，SHALL NOT 为该已知任务自动再次发起 POST。回查取得完成结果时，系统 SHALL 复用原任务的最终图片。认证、真实账单、余额或配额失败，以及没有可识别原任务 ID 的失败，SHALL 保持直接失败语义。

#### Scenario: 已创建任务遇到临时 402 时复用原图

- **WHEN** 套图条目已取得 Responses 原任务 ID，随后收到明确表示临时容量不可用的 HTTP `402`
- **THEN** 系统只对该原任务发起 GET 回查，不自动再次 POST 生成请求
- **AND** 原任务回查完成后复用其最终图片

#### Scenario: 非可恢复 402 保持直接失败

- **WHEN** HTTP `402` 没有可识别的原任务 ID，或错误表示认证、真实账单、余额或配额失败
- **THEN** 系统保持直接失败，且不进入原任务 GET 回查
