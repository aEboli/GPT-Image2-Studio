## ADDED Requirements

### Requirement: 参考图分类准确覆盖功能卖点

Creation Mode 参考图角色 SHALL 包含稳定内部 ID `feature`，并显示中文标签“功能卖点”。`feature` SHALL 用于可见的功能机制、功能效果、控制件和卖点证据；`material` SHALL 仅用于材质、纹理、表面、外观结构和工艺细节；`usage` SHALL 仅用于安装、装配、操作、充电、连接和注意事项流程。功能卖点参考图 SHALL NOT 被创建为独立 SKU 主体。

#### Scenario: 功能拆解图获得准确角色

- **WHEN** 参考图主要展示加热、发光、按键、续航或其他可见功能效果与卖点标注
- **THEN** 分析和手工分类可以选择 `feature`
- **AND** 规划 prompt 把它作为功能证据使用
- **AND** 不把该图归入商品主体、尺寸规格或使用说明，也不创建 SKU 主体

#### Scenario: 材质和使用说明保持边界

- **WHEN** 参考图主要展示纹理、缝线、表面或外观结构
- **THEN** 角色为 `material`
- **WHEN** 参考图主要展示步骤、接线、充电或注意事项
- **THEN** 角色为 `usage`
- **AND** 两者不会因为出现功能词而被错误升级为另一角色

### Requirement: 变体尺寸事实按主体组保留

尺寸参考图 SHALL 支持可选的 `dimension_groups`。每组 SHALL 保留变体/尺码标签、逐项可辨认的原始规格事实，并可通过 `reference_indexes` 或 `filenames` 指向对应商品主体。规划器 SHALL 在尺寸轮播和 SKU prompt 中按组保留字段标签和值；存在多个组时 MUST NOT 把不同组的 Length、Width、Height、Weight 或其他允许事实交叉组合，也 MUST NOT 把 Width 重命名为 Length。公制与英制换算副本 SHALL 视为同一事实，不得重复计数。

#### Scenario: 同一尺寸卡展示多个颜色或尺码

- **WHEN** 一张尺寸参考图包含黑色小码、黑色大码或其他不同主体组
- **THEN** 每组独立输出自身的标签和尺寸行
- **AND** 22 cm/11 cm 只绑定到显示该组的主体，24 cm/12 cm 只绑定到另一组主体
- **AND** 生成提示词要求每个主体旁只渲染自身组的 Length/Width，不生成额外的交叉尺寸

#### Scenario: 尺寸组按 SKU 参考索引绑定

- **WHEN** 尺寸组的 `reference_indexes` 或 `filenames` 与一个 SKU 主体匹配
- **THEN** 该 SKU prompt 只接收匹配的尺寸组
- **AND** 不匹配的颜色、尺码或主体规格不会出现在该 SKU 的尺寸说明中

#### Scenario: 无可靠绑定时保持公共规格

- **WHEN** 多个 SKU 存在但尺寸组没有稳定索引、文件名或唯一主体匹配
- **THEN** 规划器将这些事实标记为公共/未分组规格
- **AND** 不把整组事实复制到每个 SKU
- **AND** 不根据颜色、尺码或数值相似性猜测归属

#### Scenario: 旧扁平尺寸输入继续工作

- **WHEN** 历史请求只有扁平 `dimensionSpecs` 或参考图 `note`，没有 `dimension_groups`
- **THEN** 系统继续生成兼容的扁平 `dimensionSpecs`
- **AND** 单一参考条目可作为一个回退尺寸组
- **AND** 历史计划和保存记录无需迁移即可执行

#### Scenario: 历史尺寸组在参考图重传后保持绑定

- **WHEN** 历史尺寸组通过参考索引或文件名绑定商品主体，且用户以不同顺序或新文件名重传参考图
- **THEN** 系统依据明确的历史参考图绑定把旧索引和旧文件名改写为当前索引和文件名
- **AND** 未重传、重复或多候选的绑定保持未绑定状态
- **AND** 系统不得按当前数组位置猜测尺寸组归属
