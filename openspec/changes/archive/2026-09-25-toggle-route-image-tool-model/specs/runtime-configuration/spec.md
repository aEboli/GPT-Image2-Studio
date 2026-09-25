## ADDED Requirements

### Requirement: 路由模式可控制是否发送生图工具模型

路由模式 SHALL 提供一个独立开关，控制 Responses `image_generation` 工具请求是否包含 `tools[].model`。该设置 SHALL 使用 `includeImageToolModel` 持久化，默认值 SHALL 为 `true`；旧配置缺少该字段时 SHALL 归一化为 `true`。

开关开启时，路由模式的 `image_generation` 请求 SHALL 在 `tools[].model` 中发送当前生图工具模型下拉框所选的白名单模型。开关关闭时，请求 SHALL 完全省略 `tools[].model`，且 SHALL 保留模型下拉框当前选择。开关状态 SHALL 随配置保存，并在浏览器私有配置载荷中传递到服务端。

该开关 SHALL 使用与「流式输出」相同的 switch 控件样式，但 SHALL NOT 改变 Responses 请求的流式行为。直连模式、Gemini、Grok 和 `/images/edits` 请求 SHALL NOT 受该设置影响。

路由配置界面 SHALL 在有足够宽度时并排显示 Responses 文本模型与生图工具模型，并在两者下方显示全宽开关；窄屏布局 SHALL 将两个模型控件纵向排列。

#### Scenario: 新配置默认发送所选工具模型

- **WHEN** 用户首次使用路由模式，或载入的旧配置没有 `includeImageToolModel`
- **THEN** 开关默认开启
- **AND** Responses `image_generation` 请求的 `tools[].model` 等于当前选择的白名单模型

#### Scenario: 用户关闭工具模型字段

- **WHEN** 用户关闭「发送 `tools[].model`」并保存配置
- **THEN** 路由模式的 Responses `image_generation` 请求不包含 `tools[].model`
- **AND** 生图工具模型下拉框继续显示并保留当前选择
- **AND** 重新打开配置后该开关仍为关闭状态

#### Scenario: 用户重新启用工具模型字段

- **WHEN** 用户重新开启「发送 `tools[].model`」
- **THEN** 后续路由模式请求在 `tools[].model` 中发送下拉框当前选择的白名单模型

#### Scenario: 工具模型设置不影响其他路线

- **WHEN** 用户关闭路由模式的 `includeImageToolModel`
- **THEN** 直连模式仍按自身图像模型和流式配置发送请求
- **AND** Gemini、Grok 与图片编辑仍按其既有协议发送请求

#### Scenario: 模型控件响应式对齐

- **WHEN** 路由配置面板有足够横向空间
- **THEN** Responses 文本模型和生图工具模型位于同一行
- **AND** 开关位于两者下方并横跨整行
- **WHEN** 路由配置面板处于窄屏布局
- **THEN** 两个模型控件改为纵向排列
