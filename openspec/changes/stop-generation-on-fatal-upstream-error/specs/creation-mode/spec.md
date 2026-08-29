## ADDED Requirements

### Requirement: 账号级上游错误的判定口径

系统 SHALL 提供统一的账号级上游错误判定，供服务端扇出与浏览器侧队列共用。判定 SHALL 从已格式化的上游错误文案中解析 HTTP 状态码、上游错误码与详情文本。`HTTP 401`、`HTTP 402` SHALL 判定为账号级；下列上游错误码 SHALL 判定为账号级，与 HTTP 状态码无关：`insufficient_quota`、`invalid_api_key`、`invalid_authentication`、`account_deactivated`、`billing_hard_limit_reached`、`billing_not_active`、`quota_exceeded`。

详情文本中的暂时性表述 SHALL 一票否决上述状态码与错误码判定：当文案包含 `temporarily`、`temporary`、`capacity`、`try again`、`retry`、`overloaded`、`busy`、`no available channel`、`暂时`、`稍后`、`重试`、`容量` 等暂时性标记之一时，该错误 SHALL NOT 判定为账号级。中转站普遍复用 `insufficient_quota` 与 `402` 承载"模型池暂时没容量"，详情文本比状态码和错误码更具体；误判导致整批熔断，比多花几次上游调用糟糕得多。

`HTTP 403`、`HTTP 429`、`HTTP 5xx`、连接类错误、内容审核拒绝以及不含可识别状态码与错误码的文案 SHALL NOT 判定为账号级。判定 SHALL NOT 抛错，非字符串、空值与任意文案 SHALL 收敛为"非账号级"。

#### Scenario: 额度耗尽判定为账号级

- **WHEN** 上游返回 `HTTP 402` 且错误码为 `insufficient_quota`，详情为 `You exceeded your current quota, please check your plan and billing details.`
- **THEN** 该错误判定为账号级

#### Scenario: 暂时性容量不足不判定为账号级

- **WHEN** 上游返回 `HTTP 402` 且错误码为 `insufficient_quota`，但详情为 `Model capacity is temporarily unavailable.`
- **THEN** 该错误 SHALL NOT 判定为账号级
- **AND** 本批其余条目继续生成
- **AND** 该条目保留既有的 in-run 重试与自动补图语义

#### Scenario: 限流与服务端错误不判定为账号级

- **WHEN** 上游返回 `HTTP 429` 或 `HTTP 500`
- **THEN** 该错误 SHALL NOT 判定为账号级
- **AND** 该条目保留既有的 in-run 重试与自动补图语义

#### Scenario: 内容审核拒绝不判定为账号级

- **WHEN** 某条目因内容审核被拒绝且文案不含账号级状态码或错误码
- **THEN** 该错误 SHALL NOT 判定为账号级
- **AND** 本批其余条目继续生成

### Requirement: 账号级上游错误中止本批剩余套图任务

套图生成、套图补图与套图 Logo 批量在某条目失败且该错误判定为账号级时，SHALL 中止本次运行的剩余任务：SHALL NOT 为该条目消耗 in-run 重试额度，SHALL NOT 再受理任何条目的重排，且本次运行中尚未发起上游请求的条目 SHALL NOT 再发起上游请求。已在飞的条目 SHALL 按其自身结果收敛，SHALL NOT 被强制取消。

被中止的条目 SHALL 落为失败并携带包含原始上游错误原因的文案，SHALL 通过既有的条目失败事件下发，SHALL NOT 引入新的流式事件名。中止后的剩余条目 SHALL NOT 继续等待任务提交间隔。

中止状态 SHALL 只作用于本次运行，SHALL NOT 记忆到后续请求或写入套图清单的额外字段。

#### Scenario: 额度耗尽时不再发起剩余请求

- **WHEN** 一套 18 项的套图在第 2 项返回 `HTTP 402` 错误码 `insufficient_quota`，此时另有 3 项在飞、13 项尚未发车
- **THEN** 那 13 项不再发起上游请求，直接落为失败并携带该 402 原因
- **AND** 第 2 项不再重排重试
- **AND** 3 项在飞的条目按各自结果收敛
- **AND** 本次运行的上游请求总数 SHALL NOT 超过已发起的条目数

#### Scenario: 中止后剩余条目不再等待提交间隔

- **WHEN** 任务提交间隔为 800ms 且本次运行因账号级错误中止，仍有 13 项未发车
- **THEN** 这 13 项立即收敛为失败，不各自再等 800ms

#### Scenario: 下一次生成不受上一次中止影响

- **WHEN** 用户处理完额度后重新发起同一套图
- **THEN** 本次运行从干净状态开始，所有条目照常发起上游请求

### Requirement: 账号级上游错误短路自动补图与排队套图

套图整套结束后，若任一未完成条目的错误判定为账号级，系统 SHALL NOT 发起自动补图请求。

某个套图因账号级错误失败时，队列中所有处于排队状态的套图 SHALL 立即落为失败并携带同一原因，其条目 SHALL 一并落为失败，队列调度 SHALL NOT 再为本次账号级错误发车新的套图。已在运行的套图 SHALL 按其自身结果收敛。

#### Scenario: 账号级错误不触发自动补图

- **WHEN** 某套图因 `insufficient_quota` 中止且仍有未完成条目
- **THEN** 系统不发起 `/api/creation/repair`
- **AND** 用户仍可在额度恢复后手动补图

#### Scenario: 排队中的套图一并落为失败

- **WHEN** 队列中有 1 个正在跑的套图和 3 个排队中的套图，正在跑的那个因账号级错误失败
- **THEN** 3 个排队中的套图立即落为失败并显示同一原因
- **AND** 队列调度不再发车
- **AND** 用户重新入队后可以正常重试

#### Scenario: 非账号级失败不影响排队套图

- **WHEN** 某套图因单条目内容审核或限流而部分失败
- **THEN** 队列中排队的套图照常依次发车
- **AND** 自动补图照常触发
