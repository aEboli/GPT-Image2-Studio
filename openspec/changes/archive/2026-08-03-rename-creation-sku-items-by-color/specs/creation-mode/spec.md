## ADDED Requirements

### Requirement: 套图 SKU 项名称使用可靠颜色标签

Creation Mode SHALL 将新计划和本地队列中的 SKU 项命名为 `SKU image {序号} - {颜色名称}`，其中 `{颜色名称}` 来自与 SKU 图内颜色标签相同的可靠颜色解析和目标语言本地化规则。一个完整商品主体内的多个颜色 SHALL 保持为一个以单个空格连接的标签；一个分组 SKU 中多个完整主体的颜色标签 SHALL 按其稳定主体顺序以 ` / ` 连接。系统 MUST NOT 从背景、阴影、高光、环境反射、源卡片覆盖文字或无法安全规范化的文本推测颜色。

当没有可靠颜色标签时，系统 SHALL 保留现有的原始 SKU 标题、ID、参考文件名降级顺序，以避免猜测性名称。该名称变化 SHALL 不改变 SKU 项序号、排序、ID、`filenameToken`、生成提示词、Listing、导出字段或已持久化历史项。

#### Scenario: 单一 SKU 使用本地化颜色名称

- **WHEN** 一个新计划的 SKU 主体提供可靠颜色标签 `brown black silver` 且目标语言为简体中文
- **THEN** 该 SKU 项名称为 `SKU image 1 - 棕色 黑色 银色`
- **AND** SKU 图内的颜色标签使用相同的颜色值

#### Scenario: 分组 SKU 保留多个主体颜色顺序

- **WHEN** 一个新计划或本地队列中的 SKU 主体按稳定顺序提供 `blue` 和 `gray` 两个完整主体颜色标签
- **THEN** 该 SKU 项名称使用 `SKU image {序号} - blue / gray`
- **AND** 系统不把两个标签去重、重排或合并为一个颜色词

#### Scenario: 无可靠颜色时不猜测

- **WHEN** 一个 SKU 主体没有可靠的结构化、显式或可安全识别的颜色标签
- **THEN** 该 SKU 项名称继续使用原始 SKU 标题、ID 或参考文件名的降级顺序
- **AND** 系统不显示猜测性颜色名称

#### Scenario: 已保存的历史项保持不变

- **WHEN** 用户查看在本变更前已保存的套图记录
- **THEN** 系统保留该记录中已经保存的 SKU 项名称
- **AND** 不迁移其文件名、`filenameToken` 或下游数据
