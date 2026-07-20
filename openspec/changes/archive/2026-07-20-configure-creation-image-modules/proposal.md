## Why

Creation Mode 目前会始终追加 SKU 图，并且“信息图重构”默认开启，用户无法在生成前按任务需要控制这两类附加图片。需要把二者统一为清晰的模块开关，让默认行为更符合常用的商品套图工作流，同时保留已保存任务的显式选择。

## What Changes

- 在 Creation Mode 生成选项中增加与“信息图重构”和“Listing”相同样式的“SKU 图”开关。
- 新建流程默认开启“SKU 图”；关闭后不规划、不计数也不生成追加 SKU 项。
- 将新建流程的“信息图重构”默认值改为关闭；用户仍可主动开启。
- 恢复草稿、队列任务、记录和修复上下文时保留已保存的显式布尔值，避免把历史选择重置为新默认值。

## Capabilities

### New Capabilities

- `creation-image-module-options`: 定义 Creation Mode 中 SKU 图与信息图重构模块的开关、默认值、计划计数、持久化和恢复行为。

### Modified Capabilities

无。

## Impact

- Creation Mode 表单与浏览器状态同步。
- 套图计划、队列快照、提交参数和修复参数中的附加图片开关与计数。
- 浏览器布局、计划/队列及服务端与 Cloudflare 路径的回归测试。
