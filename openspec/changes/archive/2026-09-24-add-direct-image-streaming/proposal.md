## Why

直连模式目前只在 Images API 返回完整图片后才显示结果。用户希望能在连接配置中控制 Images API 流式输出，并默认启用，以便生成过程中更早看到预览。

## What Changes

- 在直连图像模型配置中增加默认开启的“流式输出”开关，并保存在浏览器私有配置中。
- 仅当直连图像端点为原生 `images/generations` 或 `images/edits` 时，按开关请求 SSE 流；直连 `responses`、`chat/completions` 与其他路由保持原样。
- 将 Images API 的中途预览和最终图片事件接入现有预览流程。
- 当上游明确不支持 SSE 且尚未返回任何流事件时，回退到一次普通 JSON 请求；流已经开始后不重新 POST，避免重复生成。

## Capabilities

### Modified Capabilities

- `runtime-configuration`: 新增直连 Images API 流式输出开关配置及作用范围。
- `generation-loading`: 直连 Images API 的中途图片事件复用现有局部预览流程。
