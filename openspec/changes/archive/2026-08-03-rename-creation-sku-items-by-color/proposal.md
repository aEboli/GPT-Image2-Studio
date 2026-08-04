## Why

套图 SKU 卡片目前把参考图文件名或分析标题直接放在 `SKU image {序号} - ...` 后面，名称常包含无关文件名，无法快速识别色款。套图已经维护可靠、可本地化的颜色标签，因此应将这一用户可见名称改为颜色命名，同时保留没有可靠颜色时的可追溯降级行为。

## What Changes

- 计划器和本地队列中的 SKU 项名称改为 `SKU image {序号} - {颜色名称}`。
- 使用与 SKU 图内颜色标签相同的规范化、目标语言本地化和安全识别规则；同一分组 SKU 的多个主体颜色按稳定顺序以 ` / ` 分隔。
- 没有可靠颜色时保留原始 SKU 标题、ID 或参考文件名的现有降级顺序，不猜测颜色。
- 保持 SKU 项序号、排序、ID、`filenameToken`、生成提示词、历史记录和导出字段不变。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-mode`: 套图 SKU 计划项和本地队列项的用户可见名称改用可靠颜色标签。

## Impact

- `lib/creation-sku-colors.mjs` 负责共享颜色名称解析。
- `lib/creation-planner.mjs` 和 `lib/creation-suite-queue.mjs` 使用同一名称来源。
- 对应 `public/lib` 镜像、计划器测试和队列测试需要同步更新。
