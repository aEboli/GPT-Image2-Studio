# creation-image-module-options Specification

## Purpose
TBD - created by archiving change configure-creation-image-modules. Update Purpose after archive.
## Requirements
### Requirement: Creation Mode 提供一致的附加图片模块开关

系统 SHALL 在 Creation Mode 的生成选项中显示“SKU 图”“信息图重构”和“Listing”三个同样样式的复选模块开关，并 SHALL 支持键盘和指针切换。

#### Scenario: 用户查看新建表单
- **WHEN** 用户进入新的 Creation Mode 任务
- **THEN** “SKU 图”开关显示为开启
- **AND** “信息图重构”开关显示为关闭
- **AND** 两个开关与“Listing”使用相同的模块开关布局

### Requirement: SKU 图开关控制追加 SKU 项

系统 SHALL 将 `skuGenerationEnabled` 作为追加 SKU 图的显式开关。关闭时，计划、预览、队列和生成请求 SHALL 不包含追加 SKU 项，`skuImageCount` SHALL 为 0，`totalPlannedItemCount` SHALL 仅统计其他启用项。平台轮播中的 SKU 选择或变体比较项 SHALL 不受该开关影响。

#### Scenario: 用户保持 SKU 图默认开启
- **WHEN** 用户提供可识别的 SKU 主体并使用新建表单的默认设置
- **THEN** 计划在轮播项后为每个去重 SKU 主体追加一个 SKU 项
- **AND** `skuImageCount` 与实际追加 SKU 项数量一致

#### Scenario: 用户关闭 SKU 图
- **WHEN** 用户关闭“SKU 图”后预览、排队或直接生成套图
- **THEN** 计划和请求不包含追加 SKU 项
- **AND** `skuImageCount` 为 0
- **AND** 轮播项与其他已启用模块保持不变

### Requirement: 信息图重构默认关闭并可显式开启

系统 SHALL 对新的 Creation Mode 任务默认关闭 `infographicRebuildEnabled`。用户显式开启后，系统 SHALL 按现有来源识别和提示词规则追加信息图重构项。用户选择 0 张轮播的专用重构模式时，系统 SHALL 强制开启该模块。

#### Scenario: 新建任务使用默认设置
- **WHEN** 用户上传可作为信息图重构来源的参考图但未开启“信息图重构”
- **THEN** 计划、队列和生成请求不包含信息图重构项
- **AND** `infographicRebuildCount` 为 0

#### Scenario: 用户开启信息图重构
- **WHEN** 用户显式开启“信息图重构”并提供有效来源图
- **THEN** 系统按每个有效来源追加信息图重构项
- **AND** `infographicRebuildCount` 与实际追加项数量一致

#### Scenario: 用户选择专用重构模式
- **WHEN** 用户将轮播图数量设为 0
- **THEN** 系统强制开启“信息图重构”
- **AND** `carouselImageCount` 为 0
- **AND** 追加 SKU 项仍由“SKU 图”开关独立控制

### Requirement: 保存与恢复保留显式模块选择

系统 SHALL 在草稿、队列快照、set manifest 和修复参数中保存两个模块开关。恢复包含显式值的对象时 SHALL 原样还原；历史对象缺少 `skuGenerationEnabled` 时 SHALL 采用开启的兼容默认值。

#### Scenario: 恢复显式关闭 SKU 的任务
- **WHEN** 已保存任务包含 `skuGenerationEnabled: false`
- **THEN** 表单和有效计划保持 SKU 图关闭
- **AND** 修复或重试不追加 SKU 项

#### Scenario: 恢复显式开启信息图重构的任务
- **WHEN** 已保存任务包含 `infographicRebuildEnabled: true`
- **THEN** 表单和有效计划保持信息图重构开启
- **AND** 修复或重试保留已保存的信息图重构项

#### Scenario: 读取没有 SKU 开关的历史任务
- **WHEN** 历史任务不存在 `skuGenerationEnabled` 字段
- **THEN** 系统按开启处理追加 SKU 图
- **AND** 不重写其他已保存计划字段
