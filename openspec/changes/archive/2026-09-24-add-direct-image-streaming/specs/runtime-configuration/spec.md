## ADDED Requirements

### Requirement: Direct Images API streaming is configurable

直连图像配置 SHALL 提供默认开启的流式输出布尔开关，并在浏览器保存、读取和请求快照中保留该值。只有有效端点为 `images/generations` 或 `images/edits` 时，该设置 SHALL 控制上游 Images API SSE 请求，并请求两张中间预览；`responses`、`chat/completions`、文本/视觉请求及其他路由 SHALL 保持既有行为。旧配置没有该字段时 SHALL 视为开启。

#### Scenario: Streaming is enabled by default

- **WHEN** 用户首次使用直连模式或读取没有该字段的旧浏览器配置
- **THEN** 流式输出开关显示为开启
- **AND** 直连 Images API 请求要求 SSE 输出

#### Scenario: User disables direct image streaming

- **WHEN** 用户关闭流式输出并保存或提交直连图像任务
- **THEN** 原生 Images API 请求使用普通 JSON 响应
- **AND** 直连文本/视觉请求保持不变

#### Scenario: Non-Images direct endpoint is selected

- **WHEN** 直连图像端点选择 `responses` 或 `chat/completions`
- **THEN** 流式开关不改变该协议原有请求体与响应处理

### Requirement: Direct Images API stream events deliver previews and one final image

启用流式输出后，直连 Images API SHALL 将 `image_generation.partial_image` / `image_edit.partial_image` 的图像内容作为 `partial_image` 事件发布，并将 completed 事件中的最终图像作为 `final_image` 发布。流中图片事件必须依据事件类型区分预览与最终图片。

#### Scenario: Generation or edit emits partial images

- **WHEN** Images API SSE 返回一个或多个 partial image 事件，随后返回 completed 事件
- **THEN** 每张中间图按顺序进入现有预览流程
- **AND** completed 图片只作为最终结果交付一次

#### Scenario: Provider rejects streaming before an SSE response starts

- **WHEN** 上游在返回任何 SSE 事件前明确拒绝流式请求
- **THEN** 系统改用普通 JSON 请求重试一次
- **AND** 记录发生过流式回退

#### Scenario: Stream disconnects after it starts

- **WHEN** 至少一个 SSE 事件已收到后连接中断且没有最终图像
- **THEN** 系统报告本次请求失败或中断
- **AND** 系统不会重新 POST 生成请求
