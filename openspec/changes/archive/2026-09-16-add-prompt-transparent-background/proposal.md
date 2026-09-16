## Why

提示词生图的 Responses 图像工具当前把背景固定为不透明，用户无法为贴图、商品抠图等场景请求透明通道。需要在不改变既有默认结果的前提下，让用户按单次提示词任务选择透明背景。

## What Changes

- 在提示词生图参数区新增默认关闭的透明背景开关，不出现在风格迁移、图片编辑、套图、写真、文章插图或 PPT 等其他生成模式中。
- 透明背景开启时固定使用 PNG 输出；关闭时保留用户此前选择的输出格式。
- 为提示词任务新增独立的 `imageBackground` 请求字段，服务端将其白名单归一化为 `opaque` 或 `transparent`，且不复用现有后台队列的 `background` 字段。
- 将归一化后的背景值透传到支持该参数的图像生成请求；未选择或非法值继续使用 `opaque`。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `runtime-configuration`: 提示词生图增加按任务选择输出背景的参数契约和 PNG 兼容性约束。

## Impact

- 前端：`public/index.html`、`public/app.js`、`public/styles.css`。
- 服务端与请求构造：`server.mjs`、`lib/responses-workflow.mjs`。
- 验证：Responses 请求体测试、提示词后台任务集成测试，以及 OpenSpec 严格校验。
