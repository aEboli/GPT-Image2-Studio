## Context

直连生图统一经过 `requestDirectImageGeneration`。该入口既处理 Images API，也处理 `responses` 与 `chat/completions`；带参考图时会将 generations 自动改为 edits。开关需随浏览器连接配置和每个排队任务快照传递。

## Decisions

### 仅对原生 Images API 启用 SSE

当启用开关且有效端点为 `images/generations` 或 `images/edits` 时，在 Images 请求体设置 `stream: true`、`partial_images: 2` 并以 `Accept: text/event-stream` 请求。Images 事件使用专用解析器，不复用会把任意 `b64_json` 事件识别为最终图的 Responses 解析器。每个 partial 事件映射为现有 `partial_image`，completed 事件映射为 `final_image`。

常规直连参考图编辑由 `requestDirectImageGeneration` 的 edits 路径处理。独立图片编辑与局部蒙版工作流走 `requestImageEdit`；只有选中直连路由时才向该 Images API 编辑请求启用同一开关，其他路由继续使用原请求行为。

### 回退必须避免重复计费

只有上游在 SSE 建立前明确返回不支持流式的 HTTP 错误，才以普通请求重试。若 SSE 响应已建立，则继续解析或报告错误；即便流随后中断，也不重复 POST。多图 multipart 字段兼容重试继续受原有缺失字段错误门控约束。

### 配置是浏览器私有配置

开关以 `directImageStream` 字段存入浏览器私有设置并随每个请求发送；缺失字段（旧版配置）按 `true` 处理。服务端采用请求字段中明确的 `true`/`false`，无字段则使用开启默认值。该字段不影响直连文本/视觉端点。
