## Context

路由模式的 `imageToolModel` 已贯通配置、模型选择和生成元数据；Responses 请求构造器只在收到非空 `imageModel` 时添加 `tools[].model`。路由模式的配置界面把 Responses 模型和工具模型上下排列，现有直连模式则用 switch 控件呈现「流式输出」。

本变更把“是否发送工具模型 ID”作为独立的布尔配置保存，并沿现有私有配置传递链送到图片请求。默认值为 `true`，旧配置缺少该字段时按开启处理，显式指定当前所选工具模型。

## Decisions

### Use `includeImageToolModel` as the setting

该字段表达请求行为，而不是所选模型本身是否有效。配置、浏览器载荷和生成配置统一使用 `includeImageToolModel`。字段缺失、空值或旧配置迁移时归一化为 `true`；显式 `false` 才关闭。

### Apply the flag at the Responses image tool body

路由配置解析继续返回归一化后的 `imageModel`，并同时返回 `includeImageToolModel`。路由生成把两者传入 `requestImageGeneration`；`createResponsesRequestBody` 在开关开启时加入所选 `model`，关闭时不创建该键。模型下拉值和其他工具参数保持原值。

图片编辑使用 `/images/edits`，不读取该开关。直连模式已有独立的 `directImageStream` 设置，不与本字段共享状态。

### Align the two route model controls

在路由配置面板的桌面网格中，将 Responses 模型放在左列、工具模型放在右列，并在两项下方放置全宽 switch。可用宽度不足时恢复单列。工具模型选择器始终可见，关闭开关只改变上游请求体。

### Preserve private configuration behavior

该布尔值和现有私有路由配置一起在本地配置及浏览器配置中往返。公开配置只包含布尔值，不涉及凭据。服务端对请求值再次归一化，确保缺省为开启。

## Risks

- 如果某个兼容端点关闭开关后无法自动选择图像模型，生成会由上游报错；用户可重新开启并使用已选择的模型。
- 配置需覆盖本地存储和浏览器私有存储的缺省迁移，避免旧配置被解释成关闭。
- 断点样式应限定在路由 A，不能改变直连模式中两个通道的排列或流式开关位置。
