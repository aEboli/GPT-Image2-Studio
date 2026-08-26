## Why

直接调用模式目前只有一套 `directBaseUrl`、`directApiKey` 和 `directEndpointPath`，虽然已经允许分别填写生图模型和视觉/文本模型，但两类请求仍然必须共用同一个服务。用户无法让生图请求和文本/视觉请求分别连接不同的 API、使用不同的凭据，或选择各自的协议后缀。

这会阻止常见的组合，例如使用一个图片网关生成图片、使用另一个 OpenAI-compatible 网关执行提示词分析、商品 Listing、图片拆解和其他视觉/文本任务。现有本地私有配置、浏览器私有配置、模型列表请求和服务端路由都必须在保持旧配置可用的前提下支持这个分离边界。

## What Changes

- 为直接调用模式建立两套独立配置：生图和文本/视觉各自拥有 Base URL、API Key、endpoint path 和 model。
- 直接调用模式的图片生成、图片编辑和其他图片请求只使用生图配置；Listing、提示词分析、图片拆解及其他文本/视觉请求只使用文本/视觉配置。
- 模型列表和连接测试按当前用途提交对应的一套 API 和模型配置，不再把生图请求的凭据隐式复用于文本请求，或反向复用。
- 读取旧版 `directBaseUrl`、`directApiKey`、`directEndpointPath`、`directImageModel` 和 `directResponsesModel` 时执行有界兼容迁移：显式的新字段优先，缺少的新字段才使用旧字段作为对应通道的 fallback。
- 本地 `.local/config.json`、浏览器私有配置和请求覆盖保存两套配置；公共 `/api/config` 只返回 endpoint、model、配置状态和脱敏 mask，不返回任一原始 API Key。
- 更新直接调用模式设置界面、模型选择器、环境变量说明、README 和相关回归测试；Route A 和 Gemini/模型协议通道的现有配置边界保持不变。

## Capabilities

### Modified Capabilities

- `runtime-configuration`: 直接调用模式从单一 provider 配置改为独立的生图 provider 和文本/视觉 provider，并定义旧字段迁移与公共脱敏边界。

## Impact

- 配置归一化、环境变量读取、私有配置持久化和浏览器配置序列化会增加按用途分组的字段。
- 图片生成、图片编辑、文本/视觉工作流、`/api/models` 和连接测试需要按用途选择配置。
- 设置 UI 需要展示两组 API、endpoint 和 model 控件，并保持保存时的密钥保留语义。
- 共享的 `lib/` 模块若被浏览器直接加载，必须通过 `public/lib/` 同步检查；不改变 Route A/Route C 的请求协议。

