## 1. 规格与边界

- [x] 1.1 明确默认 `20`、范围 `1`–`60`，以及非法输入收敛而不使请求失败。
- [x] 1.2 明确双向权威语义：低于原有默认时收窄，高于原有默认时真正放宽，不再按路径夹回去。
- [x] 1.3 明确控件与「任务提交间隔」并列于「生成调度」卡片，且不改变任务容量与提交间隔语义。
- [x] 1.4 明确调度参数说明改为悬停/聚焦标题时浮层显示，并保留 `aria-describedby` 关联。

## 2. 常量与归一化

- [x] 2.1 在 `lib/studio-constants.mjs` 增加默认值与上下界常量。
- [x] 2.2 新增 `lib/generation-concurrency.mjs`，提供归一化与从请求/配置解析的函数，并同步到 `public/lib`。
  - `0`、负数与小数向最近的合法整数边界收敛；`0` 收敛为 `1` 而不是关闭扇出。
  - 不再按路径取小：`resolveGenerationConcurrencyForLimit` 直接返回配置值，界面显示的数值不会在某个板块静默变成另一个值。
- [x] 2.3 让 `lib/limited-concurrency.mjs` 的兜底硬顶引用同一最大值常量，去掉重复字面量。
- [x] 2.4 `lib/generation-task-slots.mjs` 接受按请求传入的槽位上限，取它与 scope 默认值的较大者。
  - 这是放宽并发能真正生效的前提；缺了它，多出来的 worker 会卡在 `250ms` 槽位等待轮询里空转。

## 3. 配置读写

- [x] 3.1 `lib/config-store.mjs` 持久化并在公共配置中暴露该值。
- [x] 3.2 `lib/browser-config.mjs` 在私有配置、公共配置、请求负载和 FormData 中带上该值。
- [x] 3.3 `public/app.js` 读取控件、写入请求负载、保存后回显、`change` 时收敛。

## 4. 服务端扇出

- [x] 4.1 五处 `runWithConcurrency`（套图生成、套图补图、套图 Logo 批量、写真生成、写真补图）在各自 handler 内解析一次并发数量，同时用作 worker 上限。
- [x] 4.2 同五处的槽位申请把该值作为 `maxParallelTasks` 覆写传入。文章插图与提示词模式为串行/逐任务路径，不传覆写。

## 5. 界面

- [x] 5.1 在「生成调度」卡片内新增数字输入，带标签、范围说明与默认值说明；不使用原生 `min`/`max`/`step`，上下界写进 `data-*` 并由 JS 收敛。
- [x] 5.2 补齐中英界面文案，并在两个调度参数的说明里写明它们会互相掩盖。
- [x] 5.4 移除两个调度参数常驻的 `.field-hint`，改为悬停/键盘聚焦标题时显示的 `.scheduling-hint-tooltip` 浮层。
  - `aria-describedby` 从 input 移到标题触发器上，辅助技术仍可读到说明。
  - 沿用仓库既有的 `visibility`/`opacity` 浮层惯例（`.mega-menu-description-tooltip`），并复用已定义的 `--flyout-*` 变量。
- [x] 5.3 生成或排队进行中时禁用两个调度控件、显示锁定说明、回显已保存值；结束后自动恢复。锁定期间保存不改变这两个值，也不阻止其他配置项保存。
  - 锁定判定 `hasPendingGenerationWork()` 覆盖提示词模式运行中与排队任务、套图、写真、文章插图（含参考图生成）和 PPT。
  - 同步点接在 `updateGenerateButton`、四个视图 render 的挂载守卫之前，以及 `setDrawerOpen`（抽屉可能在生成开始后才打开）。
  - 两个 getter 在锁定时直接返回已保存值，不读控件，避免锁定前未保存的编辑被后续保存写入。

## 6. 验证与交付

- [x] 6.1 新增/更新测试：归一化边界、双向生效、槽位上限覆写、配置往返、控件与浮层契约、五处扇出一致性、锁定行为。
  - `test/generation-concurrency.test.mjs`（15 项），含槽位限流器覆写与浮层说明契约。
  - 更新既有断言：`test/config-store.test.mjs`、`test/browser-shell-modules.test.mjs`（`defaults` 精确形状）、`test/studio-limits.test.mjs` 与 `test/creation-server-static.test.mjs`（扇出写法与槽位签名）、`test/generation-start-delay.test.mjs`（浮层改动后的标签契约）、`test/limited-concurrency.test.mjs`（硬顶断言改为引用常量而非字面量 `20`）。
- [x] 6.2 运行 `node scripts/sync-public-lib.mjs --check`、`node --check public/app.js`、`node --check server.mjs`、`git diff --check` 和完整 `npm test`。
  - `sync-public-lib --check` 检查 102 个公共模块通过；语法检查与 `git diff --check` 均通过。
  - 完整 `npm test`：`1817` 项中 `1798` 通过、`19` 失败。这 19 项全为套图 planner 与提示词文案断言，与本次改动无关，属工作区内另一处在飞的 prompt 压缩改动的既有基线失败（改动前后同一集合）。
- [x] 6.3 运行 `openspec validate configure-generation-concurrency --strict --no-interactive`。
  - 通过。
- [x] 6.4 Electron 探针人工验收锁定行为：MutationObserver 记录 `disabled` 翻转，实测锁定窗口仅约 15ms（mock 生成近乎瞬时，轮询会漏）。
  - 空闲：两控件可编辑、提示隐藏、回显 `20`/`800`。
  - 提交生成后：两控件同时 `disabled`、提示显示。
  - 生成结束：两控件恢复可编辑、提示重新隐藏。
- [x] 6.5 慢上游探针实测并发真的生效（假上游按请求计数峰值，每请求挂 `1500ms`）。
  - 写真路径 25 项（原硬上限 `15`）：并发 `3` → 峰值 `3`、`13.7s`；`20` → 峰值 `20`、`3.1s`；`30` → 峰值 `25`（项数用尽）、`1.7s`。`20` 与 `30` 都突破了原来的 `15`，证明槽位覆写生效。
  - 套图路径 12 项：并发 `3` → 峰值 `3`、`2.96s`；`20` → 峰值 `12`、`0.89s`。
- [x] 6.6 记录并发被提交间隔掩盖的现象：默认 `800ms` 间隔配 `700ms` 单张耗时，并发 `3` 与 `20` 的观测峰值都是 `1`。已写进两个控件的说明文案与 proposal 的 Notes。
