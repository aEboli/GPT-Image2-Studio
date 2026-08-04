## MODIFIED Requirements

### Requirement: 套图 SKU 项名称使用可靠颜色标签

Creation Mode SHALL 将新计划和本地队列中的 SKU 项命名为 `SKU image {序号} - {颜色名称}`，其中 `{颜色名称}` 来自与 SKU 图内颜色标签相同的可靠颜色解析和目标语言本地化规则。对于简体中文目标语言，同一完整商品主体内的多颜色名称 SHALL 在用户界面名称中压缩显示：除最后一个颜色词外，前面颜色词末尾的“色” SHALL 被省略，颜色词之间不加空格，例如 `red black blue` SHALL 显示为 `红黑蓝色`。英文颜色名称 SHALL 保持 `red black blue` 的空格形式不变。没有结构化 `colorNames` 或 `color_names` 数组时，同一 SKU 主体可靠解析出的多个颜色 SHALL 默认作为一个名称标签处理；只有明确的 `subjectUnitCount` 与可靠颜色数相等时，才 SHALL 视为多个完整主体并保留标签边界。一个完整商品主体内的多个颜色在 SKU 图内 SHALL 仍保持为一个以单个空格连接的完整标签。结构化数组中的多个标签 SHALL 表示分组 SKU 的多个完整主体，并按稳定主体顺序各自格式化后以 ` / ` 连接。系统 MUST NOT 从背景、阴影、高光、环境反射、源卡片覆盖文字或无法安全规范化的文本推测颜色。

名称中的中文压缩 SHALL 只作用于计划项和队列项的用户可见名称，不得改变 SKU 图内提示词标签。单个复合颜色如 `深蓝色`、`玫瑰金色` 或 `米白色` SHALL 保持完整，不得因没有多个独立颜色而去掉末尾“色”。

当没有可靠颜色标签时，系统 SHALL 保留现有的原始 SKU 标题、ID、参考文件名降级顺序，以避免猜测性名称。该名称变化 SHALL 不改变 SKU 项序号、排序、ID、`filenameToken`、生成提示词、Listing、导出字段或已持久化历史项。

#### Scenario: 单一 SKU 使用本地化颜色名称

- **WHEN** 一个新计划的 SKU 主体提供可靠颜色标签 `brown black silver` 且目标语言为简体中文
- **THEN** 该 SKU 项名称为 `SKU image 1 - 棕黑银色`
- **AND** SKU 图内的颜色标签仍为 `棕色 黑色 银色`

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
- **AND** 不迁移其文件名、`filenameToken`、提示词、Listing、导出字段或下游数据

#### Scenario: 中文多颜色名称压缩显示

- **WHEN** 一个新计划的 SKU 主体提供可靠颜色标签 `red black blue` 且目标语言为简体中文
- **THEN** 该 SKU 项名称为 `SKU image 1 - 红黑蓝色`
- **AND** SKU 图内对应的颜色标签仍为 `红色 黑色 蓝色`

#### Scenario: 英文名称保持原格式

- **WHEN** 一个新计划的 SKU 主体提供可靠颜色标签 `red black blue` 且目标语言为 English
- **THEN** 该 SKU 项名称为 `SKU image 1 - red black blue`
- **AND** 系统不删除英文颜色之间的空格

#### Scenario: 分组主体边界保持不变

- **WHEN** 一个本地队列中的分组 SKU 按稳定顺序提供 `red` 和 `black` 两个完整主体颜色标签且目标语言为简体中文
- **THEN** 该 SKU 项名称使用 `SKU image {序号} - 红色 / 黑色`
- **AND** 系统不把两个主体合并成 `红黑色`

#### Scenario: 单一复合颜色保持完整

- **WHEN** 一个 SKU 主体只有一个可靠复合颜色 `navy blue` 且目标语言为简体中文
- **THEN** 该 SKU 项名称使用 `SKU image {序号} - 深蓝色`
- **AND** 系统不把它压缩为 `深蓝`
