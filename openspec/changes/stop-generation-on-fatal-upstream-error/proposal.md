## Why

上游返回账号级错误时，整批生成会把同一个注定失败的请求发满一轮再重试一轮。实测一次 402：

```
生成请求失败：HTTP 402，错误码 insufficient_quota，Model capacity is temporarily unavailable.
```

这类错误是账号/计费层状态（余额耗尽、key 失效、中转池无容量），跟单条目的提示词或参考图无关，**每个兄弟条目都会以同样的方式失败**。但当前 `requeueFailedSetItem` 只看还有没有重试额度，不看错误类型，于是 18 项的套图会发 36 次注定失败的上游请求；再叠加浏览器侧自动补图（自带一份新的重试额度），单条目最多打上游 4 次。全仓没有任何熔断：失败越快，`scheduleCreationGenerationQueue` 的占位释放越快，队列里的后续套图被拉进来跑得越猛，用户看到的是"所有卡片同时爆同一个错误"。

除了浪费上游调用和把失败面放大，这还会掩盖真正的原因：用户以为是自己设的并发数把上游打满了，实际是账号没额度。

## What Changes

- **新增账号级错误判定。** 新增 `lib/upstream-fatal-error.mjs`，从已格式化的上游错误文案中解析 HTTP 状态码与错误码，判定该错误是否为账号级。判定口径刻意保守：只认 `HTTP 401`、`HTTP 402` 与一份明确的账号级错误码清单（`insufficient_quota`、`invalid_api_key`、`account_deactivated`、`billing_hard_limit_reached` 等）。`HTTP 403`、`429`、`5xx` 与内容审核类错误 **不** 视为账号级，避免把单条目问题误判成整批熔断。
- **命中账号级错误即中止本批剩余任务。** `lib/limited-concurrency.mjs` 的 worker `controls` 新增 `abortRemaining(reason)` / `getAbortReason()`。中止后：不再受理 `enqueue`（失败项不再重排）、剩余条目跳过任务提交间隔立即收敛、每个未发车的条目落为失败并携带中止原因，**不再发起上游请求**。
- **账号级错误不消耗 in-run 重试额度。** `requeueFailedSetItem` 命中账号级错误时直接返回 0 并触发中止，不再排队重试一次注定失败的请求。
- **自动补图对账号级错误短路。** 套图整套结束后，若任一未完成条目的错误是账号级，`shouldAutoRepairCreationSet` 返回 `false`，不再发起 `/api/creation/repair`。
- **队列里排队中的套图不再被拉进来。** 某个套图因账号级错误失败时，队列中所有 `queued` 套图立即落为失败并携带同一原因，`scheduleCreationGenerationQueue` 随之停止发车。用户修好额度后重新入队即可。
- **五条扇出路径口径一致。** 套图生成、套图补图、套图 Logo 批量、写真生成、写真补图共用同一判定与同一中止路径。

## Non-Goals

- 不做自动降额、自动切换路线或自动重试排程。账号级错误需要用户去处理额度或 key，程序层面能做的就是尽早停手并把原因说清楚。
- 不改任何可配置项的语义、默认值或范围。并发数量与提交间隔的行为不变。
- 不新增熔断状态的跨请求记忆。判定与中止都在单次运行作用域内，下一次生成从干净状态开始重试，避免"额度已恢复但界面还在拒绝发车"。
- 不改上游错误文案本身，只在其之上做判定。

## Capabilities

### Modified Capabilities

- `creation-mode`: 套图生成、补图、Logo 批量在遇到账号级上游错误时中止本批剩余任务、跳过 in-run 重试与自动补图，并让队列中排队的套图一并落为失败。
- `portrait-mode`: 写真生成与写真补图遵循同一中止口径。

## Impact

- 新增 `lib/upstream-fatal-error.mjs`（判定 + 中止文案），并同步到 `public/lib`（浏览器侧自动补图与队列判定要用）。
- 并发原语：`lib/limited-concurrency.mjs` 新增 `controls.abortRemaining` / `controls.getAbortReason`，现有调用方不传不受影响。
- 服务端：`server.mjs` 的 `requeueFailedSetItem` 增加账号级判定，五处扇出 worker 开头增加"已中止则直接失败"的分支（复用各自既有的失败上报路径，不新增事件名）。
- 客户端：`lib/creation-auto-repair.mjs` 增加账号级短路；`lib/creation-suite-queue.mjs` 在套图失败时把排队中的套图一并落为失败。
- 契约：不新增 SSE 事件名，被中止的条目走既有 `item_failed`，旧客户端无需改动。
- 上游成本：账号级错误下的上游请求数从"条目数 × 4"降到"1 + 已在飞的条目数"。
- 测试：新增 `test/upstream-fatal-error.test.mjs`；`test/limited-concurrency.test.mjs` 补中止用例；`test/creation-auto-repair.test.mjs`、`test/creation-suite-queue.test.mjs` 补账号级短路用例；服务端静态断言覆盖五处扇出。
