## 1. 账号级错误判定模块

- [ ] 1.1 新增 `lib/upstream-fatal-error.mjs`：`isFatalUpstreamError(message)` 从已格式化文案解析 `HTTP <status>` 与 `错误码 <code>`，按 401/402 与账号级错误码清单判定；`getFatalUpstreamAbortMessage(reason)` 产出被中止条目的失败文案。
- [ ] 1.2 判定口径保守：403、429、5xx、连接类错误、内容审核拒绝、无可识别状态码的文案一律不判定为账号级；非字符串与空值收敛为 `false` 且不抛错。
- [ ] 1.3 中止文案本身包含原始原因，因此对中止文案再判定仍为账号级（浏览器侧靠条目错误文案判定，必须自洽）。
- [ ] 1.4 同步到 `public/lib/upstream-fatal-error.mjs`（加入 `PUBLIC_LIB_SYNC_TARGETS`）。

## 2. 并发原语支持中止

- [ ] 2.1 `lib/limited-concurrency.mjs` 的 worker `controls` 新增 `abortRemaining(reason)` 与 `getAbortReason()`；首个原因胜出，重复调用幂等。
- [ ] 2.2 中止后 `enqueue` 返回 `false`，失败项不再重排。
- [ ] 2.3 中止后剩余条目跳过 `waitForLaunchTurn()`，不再各自等一个提交间隔。
- [ ] 2.4 worker 仍会被调用一次，使每个被中止的条目走各自既有的失败上报路径；不新增事件名。

## 3. 服务端五条路径

- [ ] 3.1 `requeueFailedSetItem` 增加账号级判定：命中即 `controls.abortRemaining(message)` 并返回 0，不消耗 in-run 重试额度。
- [ ] 3.2 新增 `throwIfFanOutAborted(controls)`，在五处 worker 开头调用；已中止时抛出带原始原因的中止文案，复用各路径既有 `catch` 的失败上报与清单落盘。
- [ ] 3.3 `handleCreationGenerate`、`handleCreationRepair`、`handleCreationLogoBatchGenerate`、`handlePortraitGenerate`、`handlePortraitRepair` 五处都接上，且被中止的条目不申请也不释放会话槽位。
- [ ] 3.4 中止不写入清单额外字段，不跨请求记忆。

## 4. 客户端短路

- [ ] 4.1 `lib/creation-auto-repair.mjs` 新增 `getCreationFatalUpstreamError(set)`；`shouldAutoRepairCreationSet` 命中账号级错误时返回 `false`。
- [ ] 4.2 `lib/creation-suite-queue.mjs`：整套结束仍有未完成项时，抛出的错误优先携带账号级原因而不是通用文案。
- [ ] 4.3 `lib/creation-suite-queue.mjs` 新增 `failPendingCreationQueueJobs`，套图因账号级错误失败时把队列中所有排队套图与其条目落为失败并携带同一原因。
- [ ] 4.4 确认调度器随之停止发车（无 `queued` job 可取），且已在跑的套图不受影响。

## 5. 测试与验证

- [ ] 5.1 新增 `test/upstream-fatal-error.test.mjs`：用真实 `formatHttpErrorMessage` 组装文案再判定，保证产出方与解析方不脱钩；覆盖 402/401/错误码命中与 403/429/5xx/审核类不命中。
- [ ] 5.2 `test/limited-concurrency.test.mjs` 补中止用例：中止后不再发起 worker 上游动作、`enqueue` 返回 `false`、剩余条目不再等提交间隔。
- [ ] 5.3 `test/creation-auto-repair.test.mjs` 补账号级短路；`test/creation-suite-queue.test.mjs` 补排队套图一并失败与非账号级不受影响。
- [ ] 5.4 服务端静态断言：五处扇出都调用 `throwIfFanOutAborted`，`requeueFailedSetItem` 携带 `message`。
- [ ] 5.5 `npm run sync:public-lib` 后跑全量 `npm test`。
