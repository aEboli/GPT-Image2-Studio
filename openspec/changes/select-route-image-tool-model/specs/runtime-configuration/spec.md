# runtime-configuration

## ADDED Requirements

### Requirement: 路由模式的生图工具模型可选且只能从固定集合中选择

路由模式（`imageRoute` 为 `a`）的生图工具模型 SHALL 作为配置项暴露给用户，可选集合 SHALL 为 `gpt-image-2`、`gpt-image-2.5-sunburst`、`gpt-image-2.5-flare`，默认值 SHALL 为 `gpt-image-2`。配置界面 SHALL 只提供下拉选择控件，SHALL NOT 提供该项的自由文本输入。

系统 SHALL 在本地配置、环境变量、浏览器私有配置、请求字段和公开配置投影中统一使用同一个白名单归一化该值：任何空值、非白名单值或已弃用的旧模型 ID SHALL 收敛为 `gpt-image-2`，且 SHALL NOT 因此使配置保存或生成请求失败。路由模式发出的 `image_generation` 工具请求 SHALL 使用归一化后的该模型。

直接调用模式的生图模型与模型协议通道的图像模型 SHALL NOT 受该项影响。

#### Scenario: 用户在配置区切换生图工具模型

- **WHEN** 用户在配置区把生图工具模型选为 `gpt-image-2.5-sunburst` 并保存
- **THEN** 路由模式的生成请求在 `image_generation` 工具上使用 `gpt-image-2.5-sunburst`
- **AND** 提示词页参数区的「工具模型」显示 `gpt-image-2.5-sunburst`
- **AND** 重新打开配置区时下拉框回显该选择

#### Scenario: 未配置时保持既有默认值

- **WHEN** 本地配置、环境变量与浏览器私有配置都没有提供生图工具模型
- **THEN** 有效值是 `gpt-image-2`
- **AND** 请求体与该项引入之前一致

#### Scenario: 非白名单值被收敛

- **WHEN** 保存的配置、环境变量或请求字段提供了 `gpt-image-2.5`、`gpt-image-1.5` 或任意自定义模型名
- **THEN** 有效值收敛为 `gpt-image-2`
- **AND** 该自定义模型名不会出现在上游请求里
- **AND** 其他配置项照常保存

#### Scenario: 其他通道不受影响

- **WHEN** 生图工具模型被设为 `gpt-image-2.5-flare`，且用户切换到直接调用模式或模型协议通道
- **THEN** 直接调用模式使用其自身的生图模型
- **AND** 模型协议通道使用其自身的图像模型

### Requirement: 出图质量档可选且按模型能力收敛

系统 SHALL 把出图质量作为可选参数暴露给用户，可选集合 SHALL 为 `auto`、`low`、`medium`、`high`、`xhigh`、`max`，默认值 SHALL 为 `high`。其中 `xhigh` 与 `max` SHALL 仅在生图工具模型为 GPT Image 2.5 变体时可用。

当生效的生图工具模型不支持扩展档时，系统 SHALL 把 `xhigh` 与 `max` 收敛为 `high`，且 SHALL NOT 因此使配置保存或生成请求失败。该收敛 SHALL 同时作用于保存的配置、环境变量、请求字段与补图条目自带的质量值。质量控件的可选项 SHALL 随所选工具模型变化。非白名单质量值 SHALL 收敛为 `high`。

#### Scenario: 用户在 2.5 模型上选择 max

- **WHEN** 生图工具模型为 `gpt-image-2.5-sunburst`，用户把质量选为 `max`
- **THEN** 上游生成与编辑请求携带 `quality=max`
- **AND** 保存并重新打开后质量仍回显 `max`

#### Scenario: 切回旧模型时扩展档降级

- **WHEN** 已保存 `max`，随后生图工具模型被改为 `gpt-image-2`
- **THEN** 生效质量为 `high`
- **AND** 保存后的配置里质量是 `high`
- **AND** 质量控件不再提供 `xhigh` 与 `max`

#### Scenario: 补图条目按自身模型收敛

- **WHEN** 补图条目记录的质量为 `max`，而该条目的上游目标模型不支持扩展档
- **THEN** 该条目的请求使用 `high`
- **AND** 同一批次里目标模型支持扩展档的条目仍使用 `max`

#### Scenario: 未指定质量时保持既有默认

- **WHEN** 配置、环境变量与请求都没有提供质量
- **THEN** 生效质量是 `high`

### Requirement: 生成记录反映实际使用的生图工具模型

画廊记录、灯箱参数、PPT 清单和客户端即时展示项 SHALL 记录并显示本次生成实际使用的生图工具模型，SHALL NOT 展示一个未被使用的固定模型名。已知的工具模型 ID SHALL 显示为统一风格的标签。

#### Scenario: 用 2.5 模型生成后查看记录

- **WHEN** 生图工具模型为 `gpt-image-2.5-flare`，用户完成一次生成、快速溶图、图片编辑或 PPT 生成
- **THEN** 对应记录里的图像模型是 `gpt-image-2.5-flare`
- **AND** 界面显示的模型标签与该模型一致

## MODIFIED Requirements

### Requirement: Explicit model choices remain authoritative

The system SHALL apply the shared model only as a fallback and SHALL preserve non-empty environment, persisted local, browser-private, and request-level model selections.

#### Scenario: User has an existing custom model

- **WHEN** a saved configuration or request supplies a non-empty Responses or direct text/vision model
- **THEN** that value remains the effective model
- **AND** the application does not rewrite it to `gpt-5.4-mini`

#### Scenario: Other generation channels resolve defaults

- **WHEN** direct image generation or the model-protocol channel has no explicit model
- **THEN** direct image generation keeps `gpt-image-2`
- **AND** the model-protocol channel keeps its existing protocol-specific default
- **AND** the route-mode image tool model keeps `gpt-image-2` unless the user selected another allowlisted option
