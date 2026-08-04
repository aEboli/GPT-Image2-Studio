## Why

当前中文 SKU 项名称会把每个颜色完整写成 `红色 黑色 蓝色`，同一名称中重复出现“色”字，视觉上不够紧凑。英文名称应保持原有 `red black blue` 形式，中文名称则需要压缩为更自然的 `红黑蓝色`，同时不能影响 SKU 图内的完整颜色标签。

## What Changes

- 仅压缩套图 SKU 计划项和队列项名称中的中文多颜色标签：`red black blue` 显示为 `红黑蓝色`。
- 英文名称及其他非中文目标语言名称保持现有格式。
- SKU 图内仍使用完整、带空格的颜色标签，例如 `红色 黑色 蓝色`。
- 分组 SKU 的不同主体仍使用 ` / ` 分隔，不把不同主体的标签合并。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-mode`: 中文 SKU 项名称采用紧凑的多颜色显示格式，同时保持图内颜色标签完整。

## Impact

- `lib/creation-sku-colors.mjs` 增加仅供名称显示使用的中文格式化函数。
- `lib/creation-planner.mjs` 和 `lib/creation-suite-queue.mjs` 使用该格式化函数。
- 同步 `public/lib` 镜像、更新计划器/队列回归测试，并更新 `creation-mode` 增量规格。
