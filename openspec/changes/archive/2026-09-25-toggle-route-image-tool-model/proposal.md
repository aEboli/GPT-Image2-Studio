## Why

路由模式已经允许选择 Responses 外层文本模型与生图工具模型，但用户无法控制是否把生图工具模型 ID 传给上游。部分兼容服务会自行选择图像模型，因此需要一个明确开关：默认发送所选模型，也允许用户省略 `tools[].model`。

配置面板还应把文本模型和生图工具模型放在同一行，便于对照两个模型值。这个开关沿用「流式输出」控件的开关样式，但只控制请求字段，不控制流式行为。

## What Changes

- 路由模式新增「发送 `tools[].model`」开关，默认开启；旧配置缺少该值时也按开启处理。
- 开启时，Responses 的 `image_generation` 工具请求发送当前白名单归一化后的生图工具模型；关闭时完全省略 `tools[].model`。
- 开关状态随路由配置持久化，并在浏览器配置请求中传至服务端。
- 桌面端将 Responses 文本模型和生图工具模型并排显示；窄屏下改为上下排列。
- 该开关复用现有 switch 视觉样式，不增加路由模式的流式输出设置，也不改变直连模式的流式控制。

## Capabilities

### Modified Capabilities

- `runtime-configuration`: 增加路由模式工具模型字段的默认值、持久化、开关行为、请求体与响应式布局要求。

## Impact

- 配置：`lib/config-store.mjs`、`lib/browser-config.mjs`、`lib/request-private-config.mjs`、`lib/image-route-config.mjs` 和 `server.mjs`。
- 请求：`lib/responses-workflow.mjs` 将所选模型与开关状态用于 `tools[].model`。
- 界面：`public/index.html`、`public/app.js`、`public/styles.css`；浏览器配置共享模块需同步到 `public/lib/`。
- 验证：配置默认值与往返、开关对请求体的影响、服务端路由传递，以及桌面/窄屏布局。

## Out of Scope

- 不改变 Responses 流式行为。
- 不改变直连、Gemini、Grok 或图片编辑请求。
- 不改变图像模型选择集合、质量档或生成记录格式。
