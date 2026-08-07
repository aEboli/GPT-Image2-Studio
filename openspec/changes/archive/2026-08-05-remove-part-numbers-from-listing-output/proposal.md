## Why

Listing 标题和 SKU 图文件名会复用商品名、SKU 标识或参考图原始文件名中的内部货号，导致这些内部编码出现在买家可见标题和交付图片名称中。新生成结果需要排除货号，同时保留 SKU 与参考图之间的稳定关联。

## What Changes

- Listing 生成提示词禁止在英文标题和中文参考标题中使用内部商品货号、SKU 货号或仅用于关联的标识符。
- Listing 响应规范化阶段从结构化商品与 SKU 来源提取货号候选，并对 `title` 与 `zhDisplay.title` 执行确定性清理。
- 新计划中的 SKU 图用户可见名称只使用可靠颜色标签；没有可靠颜色时使用 `SKU image {序号}`，不再回退到原始标题、ID 或参考文件名。
- 新生成 SKU 图的文件名短标识只使用安全颜色或稳定序号，不包含参考图文件名或货号。
- 保留原始 SKU ID、参考文件名、参考索引和关联元数据；不迁移历史记录。

## Capabilities

### New Capabilities

<!-- 无新增能力。 -->

### Modified Capabilities

- `creation-listing-agent`: 新生成或重新生成的中英文 Listing 标题排除结构化来源中的内部货号。
- `creation-mode`: 新计划和队列中的 SKU 图名称与输出文件名不再暴露货号，同时保持关联元数据不变。

## Impact

- 影响 Listing 来源构建、提示词和响应规范化逻辑。
- 影响 Creation SKU 计划项的显示名称、`filenameToken` 和服务端文件名来源。
- 需要更新对应单元测试、静态服务测试以及浏览器镜像同步验证。
- 不改变 SKU 标识、参考图匹配、导出字段、历史 manifest 或已有图片文件。
