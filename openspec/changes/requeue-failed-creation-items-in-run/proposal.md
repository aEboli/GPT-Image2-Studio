## Why

套图某项失败后，用户要等整批第一轮全部跑完，客户端才在 `complete` 事件里发起 `/api/creation/repair` 补图。18 项、20 并发的情况下，一个在第 3 秒就失败的项，要等最慢的兄弟项走完 15 分钟超时才轮到重试，还要额外付一次 HTTP 往返和一次完整的参考图/计划重建。

失败项和未开始项本来就该抢同一个并发池。当前 `runWithConcurrency` 拿的是固定长度列表，`nextIndex < list.length` 一旦跑完就退出，没有任何机会把失败项塞回队尾，于是"重试"只能降级成"整批结束后再来一轮"。

## What Changes

- **`runWithConcurrency` 支持运行中追加任务。** worker 回调新增第三个参数 `controls`，提供 `controls.enqueue(item)` 把新任务压到队尾并返回是否受理。worker 池大小不变，空出来的 worker 自然顺位取走队尾新项。收车后 `enqueue` 返回 `false` 且不改变队列，避免出现"队列还有项但所有 worker 已退出"的悬挂。
- **失败项就地重排，不等整批。** 套图生成、套图补图、套图 Logo 批量、写真生成、写真补图五条路径的失败分支改为：仍有 in-run 重试额度时把该项重新入队（队尾），标记回 `queued` 并下发新的 `item_requeued` 事件；额度用尽才落 `failed`。
- **每项 in-run 重试额度为 1 次。** 即单项最多两次尝试。整套结束后的自动补图保留为最后兜底，额度不变。
- **重排项使用独立槽位标识。** 会话槽位以 `taskId` 入 Set，重排项的 `taskId` 追加 `-r{次数}` 后缀，避免与刚释放的原任务标识撞车导致漏记或错放。
- **卡片显示"排队重试"而不是先红一下。** 客户端三处套图 SSE 分发新增 `item_requeued` 处理，把该项恢复成排队态、保留上一轮中途预览，并在生成日志里记一条重试原因；反馈文案不再报 `error`。

## Capabilities

### Modified Capabilities

- `creation-mode`: 套图失败项的重试时机由"整套结束后补图"改为"运行中就地重排到队尾"，并新增对应的流式事件与卡片状态。
- `portrait-mode`: 写真生成与写真补图的失败项同样在本次运行内重排，与套图口径一致。

## Impact

- 并发原语：`lib/limited-concurrency.mjs` 新增 `controls.enqueue`，现有两参 worker 调用保持兼容（文章插图为串行循环，不涉及）。
- 服务端：`server.mjs` 的 `handleCreationGenerate`、`handleCreationLogoBatchGenerate`、`handleCreationRepair`、`handlePortraitGenerate`、`handlePortraitRepair` 五处失败分支。
- 新增 `lib/generation-item-retry.mjs` 承载"是否还能重排 / 下一个 taskId / 重排提示文案"，套图与写真共用，并同步到 `public/lib`。
- 客户端：`public/app.js` 三处套图 SSE 分发与写真 SSE 分发新增 `item_requeued`；套图 `item_failed` 的"完成后将自动补图"文案改为只在真正耗尽额度时出现。
- 契约：新增 SSE 事件名，旧客户端收到未知事件会忽略，仍按 `complete` 时的清单收敛，不会卡死。
- 上游成本：失败项提前重试会让单套图的上游请求峰值更贴近并发上限，总请求数不变（额度仍是每项两次）。
- 测试：`test/limited-concurrency.test.mjs` 补运行中入队用例，新增 `test/generation-item-retry.test.mjs`，套图与写真流式相关测试补 `item_requeued`。
