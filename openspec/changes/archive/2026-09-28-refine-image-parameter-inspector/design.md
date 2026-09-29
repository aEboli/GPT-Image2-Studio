# Design

## Context

图片详情由 `buildParameterEntries()` 提供结构化参数，浏览器界面使用 `dt/dd` 两列渲染。生成记录分散保存在服务端 Gallery 元数据、浏览器缓存和 Creation 记录快照中，传输开关需要在这些持久化边界保留显式 `false`。

## Decisions

- 参数视图保留结构化条目，固定标签列，数值列使用 `overflow-wrap: anywhere`，避免长 URL 和文件名撑宽检查器。
- 透明背景采用 `imageBackground` 的 `transparent`/`opaque` 语义；历史字段缺失时显示“未记录”。Creation 当前不提供透明背景选择，因此快照明确记录 `opaque`。
- 工具传输与流传输只展示对应路由的开关，并接受布尔值及 `1/0`、`on/off`、`yes/no`、`enabled/disabled` 的存储表示。
- 文件信息区仅显示文件名，不再提供 `relativePath` 参数；已有绝对本地文件参数保持原样。`relativePath` 继续保存在内部数据模型中，用于图片服务、资源定位和删除安全校验。

## Risks

- 旧 Gallery 元数据可能没有新增字段；详情使用“未记录”避免伪造历史值。
- 用户配置中的字符串布尔值需要归一化，避免字符串 `"false"` 被误判为真。
