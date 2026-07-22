## Why

Listing 字段当前把英文与中文参考合并到同一个点击复制结果中，用户无法直接从可见内容中只取所需语言。需要让屏幕上每种语言的内容与剪贴板结果保持一致，减少粘贴后再次删改。

## What Changes

- Listing 顶部英文标题、字段标题和每条英文内容只复制对应英文内容。
- 每条 `中文参考` 作为独立点击目标，只复制对应中文内容。
- 列表字段按单条信息点复制，字段标题仍支持一次复制该字段的全部英文。
- 保留“复制 Listing”与结构化导出的完整双语映射，不修改 Listing 数据结构、生成流程或接口。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-mode`: 将 Listing 的单字段复制从中英合并结果调整为与所点击语言一致的独立复制，同时保留整条 Listing 的双语复制和导出。

## Impact

- 浏览器 UI：`lib/creation-listing-view.mjs` 及其 `public/lib` 同步副本。
- 样式：Listing 英文与中文内容的可点击、聚焦和已复制状态。
- 测试：Listing 渲染数据、语言独立复制和浏览器模块同步回归。
- API、持久化和生成模型：无变化。
