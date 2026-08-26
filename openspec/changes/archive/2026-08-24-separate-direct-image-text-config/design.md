## Context

直接调用模式（Route B）当前把生图和文本/视觉请求绑定到同一组 `directBaseUrl`、`directApiKey`、`directEndpointPath`，同时只在模型名层面区分 `directImageModel` 和 `directResponsesModel`。服务端的 `getSelectedImageGenerationConfig` 与 `getSelectedTextVisionConfig` 因此会共享 provider，模型列表控制器也会把同一个 direct API 发送给两个用途。

本变更需要扩展配置契约，同时兼容已经写入 `.local/config.json`、浏览器 localStorage、环境变量和请求 FormData 的旧字段。API Key 的现有安全边界必须保持：私有存储可以保存原始值以完成请求，公共配置、日志和 UI 状态只能暴露 configured 标志或 mask。

## Decisions

### 1. Canonical direct channel fields

Route B 使用以下扁平字段作为新的规范字段。它们采用现有 `splitApiEndpointUrl` 规则分别归一化，Base URL 可以是根地址，也可以是包含已知 endpoint 的完整 URL。

| 用途 | Base URL | API Key | endpoint path | model |
| --- | --- | --- | --- | --- |
| 生图 | `directImageBaseUrl` | `directImageApiKey` | `directImageEndpointPath` | `directImageModel` |
| 文本/视觉 | `directTextBaseUrl` | `directTextApiKey` | `directTextEndpointPath` | `directTextModel` |

`directTextModel` 是文本/视觉用途的规范模型名；实现可以在内部继续使用 `directResponsesModel`，但对外的配置、浏览器 payload 和文档必须明确它是文本/视觉模型，而不是生图模型。

生图 endpoint 允许 `images/generations`、`images/edits` 或 `responses` 等现有图片请求协议；文本/视觉 endpoint 只允许 `responses` 或 `chat/completions`。每个用途的 endpoint 校验和默认值独立执行，不能因为另一用途的 endpoint 是 `images/generations` 而把文本请求发送到图片 endpoint。

### 2. Legacy fallback and precedence

读取配置时按以下顺序解析每个用途的每个字段：

1. 对应用途的新字段（例如 `directImageApiKey` 或 `directTextBaseUrl`）。
2. 旧版通用 direct 字段：`directBaseUrl`、`directApiKey`、`directEndpointPath`。
3. 现有默认值或对应 Route A 兼容 fallback（仅在既有归一化逻辑允许时）。

模型字段的兼容映射为：旧 `directImageModel` 继续作为生图模型；旧 `directResponsesModel` 作为 `directTextModel` 的 fallback。新字段一旦非空，旧字段不得覆盖它；生图通道和文本/视觉通道也不得互相覆盖。

旧 `directBaseUrl` 与 `directApiKey` 在新字段均缺失时同时作为两套通道的兼容种子，以保证已保存配置继续可用。若只配置了一套新的 channel，另一套仍可读取旧通用字段或已有持久化值，但不得从已配置的新 channel 静默复制凭据。空白 API Key 继续表示“保留已保存值”的 UI 行为，不得清除私有凭据。

旧 `directEndpointPath` 迁移到两个用途时必须经过用途校验：它是合法文本 endpoint 时可作为文本 fallback；它是图片 endpoint 时可作为生图 fallback，文本用途改用文本默认值。实现不得把一个已知的图片 endpoint 直接当作文本 endpoint 使用。

### 3. Request routing by purpose

- `getSelectedImageGenerationConfig`、图片编辑和所有直接图片生成调用使用生图四元组。
- `getSelectedTextVisionConfig`、Listing、提示词/参考图分析、图片拆解以及其他文本/视觉调用使用文本/视觉四元组。
- Route B 的 `responses` 图片请求也使用生图 model 和生图 API；不能因为协议名称是 Responses 就回退到文本模型。
- `/api/models` 的 direct image target 和 direct text target 分别使用各自的 Base URL、endpoint、API Key 和当前 model。连接测试同样必须依据当前 target 选择对应通道。
- Route A 和 Route C 的字段、默认值、协议选择和已有兼容 fallback 不因本变更被重命名或改为共享 Route B 凭据。

### 4. Persistence, browser payloads, and public data

本地私有配置和浏览器私有配置保存两套新字段，并保留现有 API Key 的“空输入保留已保存值”行为。请求覆盖应只覆盖本次请求明确提供的用途字段；只提供生图凭据时不得抹掉文本凭据，反之亦然。

公共 `/api/config` 和 `toPublicBrowserConfig` 可以返回两套 channel 的 Base URL、endpoint、model、`apiKeyConfigured` 和 `apiKeyMask`，但绝不能返回 `directImageApiKey` 或 `directTextApiKey` 原文。模型列表、连接测试反馈、生成日志和错误消息也不得打印完整凭据。

环境变量应提供两套规范前缀（`DIRECT_IMAGE_*` 和 `DIRECT_TEXT_*`），并把旧 `DIRECT_*` 变量作为兼容 fallback；文档必须标明旧变量只用于迁移，不优先于显式用途变量。若实现继续接受 `DIRECT_RESPONSES_MODEL`，应将其记录为文本/视觉模型的旧别名。

### 5. UI and model picker

直接调用模式设置面板应以“生图 API”和“文本/视觉 API”两个明确分组展示各自的 endpoint、API Key 和 model。两个模型选择器必须使用对应分组的 API 请求；切换用途或通道时不得共用上一组的模型列表状态。保存、刷新和重新打开配置面板后，两组非密钥字段应恢复，密钥只显示脱敏状态。

## Verification strategy

- 用单元测试覆盖配置默认值、环境变量优先级、旧字段迁移、新字段互不覆盖、空白密钥保留和公共脱敏。
- 用路由测试验证图片与文本/视觉选择器分别返回不同的 `baseUrl`、`endpointPath`、`apiKey` 和 `model`，并覆盖 Route B `responses` 图片请求的生图模型。
- 用浏览器配置和模型选择器测试验证 FormData/localStorage 字段及两套 fetch target；用静态 UI 测试验证两个分组和标签存在。
- 运行公共库同步、聚焦测试、全量 Node 测试、严格 OpenSpec 和 `git diff --check`；真实第三方 API 和真实密钥不属于自动化验收范围。

