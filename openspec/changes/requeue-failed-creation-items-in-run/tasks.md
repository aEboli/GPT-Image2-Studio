## 1. 并发原语

- [x] 1.1 `lib/limited-concurrency.mjs` 的 worker 回调新增第三参 `controls`，提供 `enqueue(item)`：受理时压入队尾并返回 `true`，收车后返回 `false` 且不改动队列。
- [x] 1.2 保证 worker 池不因初始列表长度提前收车：入队发生在某个 worker 仍在执行期间，该 worker 循环回头即可取到新项。
- [x] 1.3 `results` 随入队增长，返回顺序为实际执行顺序，不破坏现有按下标取值的调用方。
  - 同时把入参列表改为浅拷贝后再消费，重排只动内部队列，不再回写调用方的 `plan.items` / `repairItems`。
  - 收车标记放在 `finally` 里，worker 抛错导致整个扇出 reject 时同样不再受理入队。
- [x] 1.4 该模块不在 `public/lib` 同步清单内（仅服务端使用），确认无需同步。

## 2. 重试策略模块

- [x] 2.1 新增 `lib/generation-item-retry.mjs`：`IN_RUN_MAX_RETRIES = 1`、`createInRunRetryLedger`（按 itemId 计数、判定可否重排、产出带次数后缀的 taskId）、`getRequeueNotice`。
- [x] 2.2 重试计数存在本次请求作用域内，不写入 manifest。
- [x] 2.3 同步到 `public/lib/generation-item-retry.mjs`。

## 3. 服务端五条路径

- [x] 3.1 `handleCreationGenerate` 失败分支：仍有额度且响应可写时改 `queued` + `enqueue` + 下发 `item_requeued`；否则维持现有 `failed` 语义。
- [x] 3.2 `handleCreationLogoBatchGenerate` 同上。
- [x] 3.3 `handleCreationRepair` 同上。
- [x] 3.4 `handlePortraitGenerate` 同上。
- [x] 3.5 `handlePortraitRepair` 同上。
- [x] 3.6 每次尝试使用 ledger 产出的独立 `taskId`，确认 `finally` 释放的是本次尝试自己的标识。
  - 五条路径共用 `requeueFailedSetItem` 与 `buildSetItemFailureEvent` 两个辅助函数，避免同一段判定复制五遍。
- [x] 3.7 确认重排项写入 manifest 的状态为 `queued` 且清掉上一轮的 `error`，不动其余既有快照字段。
  - `getCreationSetStatus` / `getPortraitSetStatus` 只按 `completed` 与 `failed` 计数，`queued` 项让整套保持 `generating`，不会提前收敛成 `partial_failed`。

## 4. 客户端

- [x] 4.1 套图 SSE 分发新增 `item_requeued`：恢复排队态、保留中途预览、记生成日志、反馈用 `busy` 语气。
  - 实际只有一个 `handleCreationStreamEvent` 分发器，主流程、队列作业、套图记录补图三种场景通过 `context` 复用它，所以改一处即覆盖三条路径。
- [x] 4.2 写真 SSE 分发新增 `item_requeued`，同样语义。
- [x] 4.3 套图 `item_failed` 的"完成后将自动补图"文案改为仅在无 in-run 额度时出现。
  - 无需改动：`item_failed` 现在只在额度耗尽时下发，原有条件已等价于该语义。
- [x] 4.4 确认排队态经过创作视图与写真视图的字段白名单，重试原因走生成日志。
  - 预览保留由既有 `mergeCreationSetPreviews` 覆盖：重排项没有落盘资产，会继续沿用上一轮预览。

## 5. 验证

- [x] 5.1 `test/limited-concurrency.test.mjs` 补：运行中入队被同一批 worker 取走；只剩一个 worker 时入队仍被执行；收车后入队返回 `false`；worker 抛错收车后同样拒绝；不改动调用方列表。
- [x] 5.2 新增 `test/generation-item-retry.test.mjs` 覆盖额度判定与 taskId 生成。
- [x] 5.3 服务端五条路径的重排接线用 `test/creation-server-static.test.mjs` 与 `test/portrait-server-static.test.mjs` 的源码断言覆盖；客户端两个分发器与预览保留用新增 `test/generation-item-requeue-stream.test.mjs` 覆盖。
- [x] 5.4 跑 `npm test`：失败集合与 `HEAD` 基线逐项一致（18 项），全部是 `creation-planner` 提示词措辞断言与一条 e2e 提示词断言，属于工作树里在进行的提示词压缩改动，与本次无关。本次新增与改动的测试全绿。
- [x] 5.5 用真实 `runWithConcurrency` + 真实 ledger 组合验证顺位与时机：5 项并发 5，第 2 项失败后作为第 6 个任务启动，且启动时第 1、3、4、5 项仍在生成中。
  - 未做全链路 e2e 注入：mock 生成器没有失败注入开关，加一个需要改动生产代码，超出本次范围。改动本身的接线由上述源码断言覆盖。
