## Why

加载动画当前把进度源绑定在最后一个挂载的 DOM 节点上。用户切换创作界面或队列时，仍在运行的任务会暂时没有加载节点，导致返回后动画、估算百分比和心跳图标重新开始，无法反映任务的连续状态。

## What Changes

- 将运行中任务的共享加载进度源与临时 DOM 卸载解耦。
- 切换界面、预览项或队列后，重新挂载同一 `loadingKey` 时恢复原百分比和心跳图标，并按原时序继续推进。
- 新任务仍从 `0%` 开始；完成、失败、取消或被真正替换的任务继续释放其进度源，避免下一轮同 key 误继承状态。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `generation-loading`: 明确临时失焦与任务终结的加载进度源生命周期，并保证返回运行中任务时恢复状态。

## Impact

- 影响 `lib/generation-loading.mjs` 中共享进度源的卸载与恢复语义。
- 影响 `lib/creation-card-loading.mjs` 和创作队列的 key 切换路径。
- 增加加载状态机与套图队列切换的回归测试，并同步浏览器可访问的 `public/lib` 镜像文件。
