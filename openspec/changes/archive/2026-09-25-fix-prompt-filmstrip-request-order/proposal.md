## Why

提示词生图的运行中任务当前按提交时间正序排列，导致最新请求出现在胶片条右侧，旧请求反而靠左。用户连续提交任务时，新占位没有落在最左侧，阅读顺序与历史缩略图的最新在前顺序相反。

## What Changes

- 运行中请求按提交时间倒序排列，最新请求固定在左侧，较早请求依次向右。
- 相同提交时间的请求保留当前队列顺序，状态轮询不会改变条目位置。
- 补充胶片条顺序规范和覆盖时间顺序及并列时间的回归测试。

## Capabilities

### Modified Capabilities

- `creation-mode`: 明确提示词模式运行中请求的左到右顺序。

## Impact

- 更新 `lib/preview-placeholder-state.mjs` 及浏览器镜像 `public/lib/preview-placeholder-state.mjs`。
- 更新 `public/app.js` 中模块缓存版本。
- 更新运行中预览排序和胶片条集成回归测试。
