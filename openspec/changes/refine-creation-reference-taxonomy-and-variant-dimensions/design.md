## Decisions

### 功能卖点单独分类

使用 `feature` 作为内部稳定 role，中文标签为“功能卖点”。它表示图片中可见的功能机制、效果路径、控制件或卖点证据；`material` 只表示材质、纹理、表面、外观结构和工艺；`usage` 只表示安装、操作、充电、连接和注意事项流程。套图中的 `effect-comparison` 仍保持原有 role ID，用于以一个完整主体呈现功能效果，二者不是同一层级的分类。

### 尺寸分组的数据边界

尺寸参考角色可以提供 `dimension_groups`。每组包含一个可读的 `label`、一组原文 `facts`，以及可选的 `reference_indexes` 和 `filenames`。索引和文件名只用于把该组绑定到对应商品主体或 SKU；它们不能覆盖有效稳定索引。

规划器先把每个结构化组独立解析为允许的尺寸事实，组内按字段去重并保留字段标签；没有结构化组时，每个尺寸参考条目形成一个回退组。输入框提供的扁平规格仍生成历史 `dimensionSpecs`，但在多变体场景只作为未分组公共规格。

尺寸轮播 prompt 在存在多个组时逐组输出 `label` 与规格行，并要求每个主体只使用自身组的事实。`spec-table` 的 key spec 选择在组内执行，不再在全局按 Length/Width 只保留第一项。所有 prompt 都要求按原始字段名渲染，禁止把 Width 当作 Length，也禁止将同一数值的公制和英制副本当作两条规格。

SKU prompt 只接收与当前 SKU 的 `reference_indexes` 或 `filenames` 匹配的尺寸组。只有一个 SKU 或只有一个尺寸组时可使用该组；多个 SKU 且尺寸组未绑定时，将其标记为公共/未分组事实，不复制到每个变体，不制造跨组组合。

### 兼容与降级

旧的 `reference_roles`、`sku_subjects` 和扁平 notes 保持原字段形状。未知或损坏的分组字段被忽略并回退到现有 note 解析；历史计划不需要迁移。前端分析结果和手工编辑会保留分组字段，再提交给服务端规划器。

## Verification

- 参考图分析 schema/prompt 测试包含 `feature` 和 `dimension_groups`。
- 规划器测试覆盖两个不同颜色/尺码组、按索引/文件名绑定、不绑定时不复制、字段标签保持和旧扁平输入兼容。
- 运行 Node 语法检查、Creation 聚焦测试、`git diff --check` 和 OpenSpec 严格校验。
