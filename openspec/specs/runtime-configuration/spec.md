# runtime-configuration Specification

## Purpose
TBD - created by archiving change harden-project-maintenance. Update Purpose after archive.
## Requirements
### Requirement: Runtime defaults use one model source
The system SHALL resolve the default Responses model and direct text/vision model from one shared source, and both defaults SHALL be `gpt-5.4-mini` across the local Node service and browser-private configuration.

#### Scenario: A runtime starts without an explicit text model
- **WHEN** local or browser configuration has no non-empty Responses or direct text/vision model
- **THEN** the effective model is `gpt-5.4-mini`
- **AND** the runtime does not select a different fallback based only on its deployment type

#### Scenario: Browser shared modules are synchronized
- **WHEN** the public-library synchronization check runs
- **THEN** the shared model-default module is included in the checked registry
- **AND** browser and source copies contain identical defaults

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

### Requirement: Direct mode has independent image and text/vision provider configurations

直接调用模式 SHALL expose and persist two independent provider configurations. The image channel SHALL have a Base URL, API Key, endpoint path, and image model; the text/vision channel SHALL have its own Base URL, API Key, endpoint path, and text/vision model. A non-empty value in one channel MUST NOT overwrite or silently replace the corresponding value in the other channel.

#### Scenario: User configures different direct providers

- **WHEN** the user enters an image Base URL/key/endpoint/model and a different text/vision Base URL/key/endpoint/model in direct mode
- **THEN** image-generation requests use only the image channel values
- **AND** text/vision requests use only the text/vision channel values
- **AND** saving and reopening the configuration preserves both channel selections

#### Scenario: Route B Responses image generation uses the image model

- **WHEN** direct mode sends an image-generation request through a `responses` endpoint
- **THEN** the request uses the direct image channel's Base URL, API Key, endpoint, and image model
- **AND** it does not fall back to the direct text/vision model merely because the protocol path is `responses`

#### Scenario: Channel-specific model discovery and connection test

- **WHEN** the user fetches models or tests the connection from the direct image or direct text/vision control
- **THEN** the request uses that control's channel-specific Base URL, endpoint, API Key, and current model
- **AND** the other channel's credentials and model are not sent as a substitute

### Requirement: Legacy direct configuration migrates through bounded fallbacks

The runtime SHALL continue to read legacy `directBaseUrl`, `directApiKey`, `directEndpointPath`, `directImageModel`, and `directResponsesModel` values. Explicit canonical image/text channel fields MUST take precedence. When canonical fields are absent, legacy common provider fields MAY seed the missing channels for compatibility, while `directImageModel` maps to the image model and `directResponsesModel` maps to the text/vision model. A legacy endpoint MUST be validated for the target channel before use.

#### Scenario: Existing saved direct configuration remains usable

- **WHEN** a saved configuration contains only the legacy direct fields and no new channel-specific fields
- **THEN** both direct channels resolve to the legacy provider where that provider is valid for the target protocol
- **AND** the image model comes from `directImageModel`
- **AND** the text/vision model comes from `directResponsesModel` or its existing default

#### Scenario: Explicit channel values override legacy values independently

- **WHEN** a legacy direct provider exists and only one new channel supplies a non-empty Base URL, API Key, endpoint, or model
- **THEN** that new value is effective for its channel
- **AND** the other channel retains its explicit value or legacy fallback
- **AND** an empty API Key input does not erase the previously saved private key

#### Scenario: An incompatible legacy endpoint is not reused across purposes

- **WHEN** the legacy `directEndpointPath` is an image endpoint but the text channel has no explicit endpoint
- **THEN** the text channel uses its valid text endpoint default
- **AND** the runtime does not send a text/vision request to `images/generations` or `images/edits`

### Requirement: Public direct configuration never exposes raw credentials

Public configuration responses, browser-public state, model-picker feedback, and generation logs SHALL expose only channel endpoint/model metadata, configured booleans, and masked API keys. They MUST NOT include the raw image or text/vision API Key.

#### Scenario: Public config is read after saving both channel keys

- **WHEN** private configuration contains non-empty image and text/vision API Keys
- **THEN** `/api/config` and browser-public configuration report both keys as configured with masks
- **AND** neither response contains either raw key

#### Scenario: Private request payload remains channel-specific

- **WHEN** a browser generation request includes direct private configuration
- **THEN** the request may carry the selected channel's raw key to the local service for the current operation
- **AND** the server does not copy that key into a public response, log message, or unrelated channel

### Requirement: Browser and local configuration remain synchronized and testable

The local Node service and browser-private configuration SHALL use the same canonical direct image/text fields and defaults. Browser-loaded shared modules SHALL remain byte-synchronized with their `public/lib` copies.

#### Scenario: Browser configuration round-trips both channels

- **WHEN** the browser saves direct image and text/vision channel settings and reloads them from private storage
- **THEN** both channel objects round-trip without cross-channel key or model substitution
- **AND** FormData helpers include the corresponding channel fields for model discovery and generation

#### Scenario: Public-library synchronization check runs

- **WHEN** the repository synchronization check runs
- **THEN** every browser-loaded shared module used by this change has an identical source and `public/lib` copy
- **AND** the check reports no unsynchronized direct-configuration implementation

### Requirement: 批量生成调度参数可配置且范围统一

系统 SHALL 把批量生成的并发数量和任务提交间隔作为配置项暴露给用户。并发数量默认值 SHALL 为 `20`，有效范围 SHALL 为 `1` 到 `50`；提交间隔默认值 SHALL 为 `1000` 毫秒，有效范围 SHALL 为 `200` 到 `5000` 毫秒。空值、非数值、小数、零、负数或越界输入 SHALL 收敛为默认值或最近的合法边界，且 SHALL NOT 使生成请求失败。

#### Scenario: 配置值在浏览器与服务端一致

- **WHEN** 用户保存或提交并发数量与提交间隔
- **THEN** 浏览器请求携带归一化后的两个字段
- **AND** 服务端使用相同范围再次归一化
- **AND** 套图、Logo 批量、写真生成和写真补图读取对应值

#### Scenario: 非法输入不阻止其他配置保存

- **WHEN** 用户在配置表单中输入越界调度值并同时修改其他配置
- **THEN** 其他配置照常保存
- **AND** 调度值被收敛并回显

### Requirement: 发车闸门按会话与板块共享

提交间隔的发车闸门 SHALL 按 `clientSessionId + generationScope` 共享。同一会话同一板块内，不论同时存在多少个并发扇出，上游相邻两次新的生成提交 SHALL 遵守同一个配置间隔。不同板块 SHALL 使用独立闸门。闸门 SHALL 位于会话任务槽位取得之后、真实上游生成调用之前；等待被中止的条目 SHALL NOT 消耗发车许可。

#### Scenario: 同一板块的多套请求共享节奏

- **WHEN** 同一会话同时运行两套套图，提交间隔为 `1000` 毫秒
- **THEN** 两套合计的上游新提交不会各自独立计时
- **AND** 相邻提交按共享闸门间隔发车

#### Scenario: 不同板块互不阻塞

- **WHEN** 套图和写真同时运行
- **THEN** 两者分别使用 `creation` 与 `portrait` scope 的闸门
- **AND** 一方不会消耗另一方的提交许可

### Requirement: 活跃 scope 的并发上限唯一且稳定

会话任务槽位限流器 SHALL 按 `clientSessionId + generationScope` 维护一个活跃桶。桶首次取得 slot 时绑定该请求的归一化并发上限；桶仍有活跃任务时，后续请求 SHALL 共享该上限，不能通过更大的前端值扩容。所有五处并发扇出 SHALL 同时把归一化并发值用于 worker 上限和 slot 上限。桶空闲后，下一次请求才可绑定新的并发值。

#### Scenario: 重叠请求不叠加并发预算

- **WHEN** 同一会话同一板块已有请求以并发 `3` 运行，第二个请求携带并发 `20`
- **THEN** 活跃 scope 的总 slot 上限仍为 `3`
- **AND** 第二个请求不能创建独立的 `20` 个 slot

#### Scenario: scope 空闲后接受新配置

- **WHEN** scope 的全部任务释放 slot 后再次发起请求
- **THEN** 新请求可以绑定其自身的归一化并发值

### Requirement: 生成期间锁定调度控件

当任意生成板块存在运行中或排队任务时，浏览器 SHALL 禁用并发数量和提交间隔控件，并回显已保存值。锁定期间保存其他配置 SHALL NOT 改写这两个调度值。所有任务结束后控件 SHALL 恢复可编辑。

#### Scenario: 未保存编辑不会混入运行中的请求

- **WHEN** 用户修改调度控件但未保存，随后开始或排队生成
- **THEN** 控件回显已保存值并保持禁用
- **AND** 请求只使用入队快照或已保存值

### Requirement: 排队套图冻结调度参数

套图任务 SHALL 在入队时保存并发数量与提交间隔快照。只要同一批队列仍有 `queued` 或 `running` 任务，后续入队套图 SHALL 复用首个快照；任务实际启动时 SHALL NOT 再依据当时界面状态选择另一份调度值。队列清空后快照 SHALL 被清除。

#### Scenario: 连续入队使用同一份快照

- **WHEN** 用户在未保存编辑状态下连续入队三套套图
- **THEN** 三套任务的 FormData 使用同一并发数量和提交间隔
- **AND** 该值等于首套入队时的值

### Requirement: 提示词生图可按任务选择输出背景

系统 SHALL 在提示词生图参数区提供透明背景控制，默认关闭。该控制 SHALL 只在提示词生图中可见，且 SHALL NOT 出现在风格迁移、图片编辑、套图、写真、文章插图或 PPT 生成中。浏览器 SHALL 将每个提示词任务选择快照为独立的 `imageBackground` 字段；该字段 MUST NOT 复用后台队列的 `background` 或 `backgroundGeneration` 字段。

服务端 SHALL 只接受 `transparent` 作为透明值，并将缺失、非法或不属于提示词任务的值归一化为 `opaque`。支持图像背景参数的上游请求 SHALL 使用归一化结果；提示词结果的任务和保存元数据 SHALL 记录实际使用的值。

#### Scenario: 用户使用默认不透明背景生成提示词图像

- **WHEN** 用户不启用透明背景并提交提示词生图
- **THEN** 浏览器任务快照和服务端上游请求使用 `imageBackground` / `background` 的 `opaque` 语义
- **AND** 现有后台队列控制仍使用其独立的 `background=1` 信号
- **AND** 输出格式继续使用用户原先选择的格式

#### Scenario: 用户启用透明背景

- **WHEN** 用户在提示词生图参数区开启透明背景
- **THEN** 当前任务快照携带 `imageBackground=transparent`
- **AND** 输出格式被固定为 PNG
- **AND** 支持该参数的上游图像请求携带 `background=transparent`
- **AND** 保存的提示词结果记录实际使用的 `transparent` 值

#### Scenario: 非提示词模式或非法输入请求透明背景

- **WHEN** 风格迁移、图片编辑、套图、写真、文章插图或 PPT 请求携带 `imageBackground=transparent`，或提示词请求携带非白名单背景值
- **THEN** 服务端将该请求的有效背景收敛为 `opaque`
- **AND** 其他模式的既有请求参数和输出行为保持不变

#### Scenario: 模型协议通道不支持该控制

- **WHEN** 用户选择模型协议图像通道
- **THEN** 提示词参数区不展示透明背景控制
- **AND** 该通道不会因为该控制添加不受支持的背景参数

### Requirement: Image quality values are explicit and route-safe

The system SHALL expose only explicit supported image-quality tiers. GPT and Gemini image routes SHALL use `low`, `medium`, `high`, and model-supported `xhigh`/`max`; Grok SHALL use only `low` or `medium`. The default quality for existing GPT/Gemini behavior SHALL remain `high`, and the Grok default SHALL be `medium`. Incoming legacy `auto`, empty, or unsupported values SHALL be normalized to the applicable concrete default before they are displayed, stored, or sent upstream.

#### Scenario: Legacy quality values are migrated

- **WHEN** a saved configuration, browser state, task snapshot, gallery record, or request contains quality `auto`
- **THEN** GPT/Gemini values become `high`
- **AND** Grok values become `medium`
- **AND** no image-generation request sends `auto`

#### Scenario: Grok sends only supported quality values

- **WHEN** a Grok image request is built from an empty, legacy, or GPT-specific quality value
- **THEN** the request body contains either `low` or `medium`
- **AND** the request does not contain any GPT-only quality tier

### Requirement: Grok image configuration is independent and masked

The system SHALL support route D as a Grok image channel with canonical `grokBaseUrl`, `grokEndpointPath`, `grokApiKey`, and `grokImageModel` fields. Defaults SHALL be `https://api.x.ai/v1`, `images/generations`, an empty key, and `grok-imagine-image-2.0`. Grok fields MUST NOT be populated from GPT, direct, or Gemini credentials, and public configuration MUST expose only endpoint/model metadata plus configured and masked key fields.

#### Scenario: Grok defaults are available

- **WHEN** the runtime starts without a Grok configuration
- **THEN** route D resolves to the documented xAI base URL, generation endpoint, and default model
- **AND** its API key is empty

#### Scenario: Grok credentials remain isolated

- **WHEN** GPT, direct, or Gemini keys are configured but Grok is not
- **THEN** the effective Grok key remains empty
- **AND** selecting route D does not replace another channel's key

#### Scenario: Public config masks Grok credentials

- **WHEN** a Grok key is saved
- **THEN** public config reports Grok key configured state and a mask
- **AND** public config does not contain the raw key

### Requirement: Grok requests use the xAI JSON contract

Route D SHALL send JSON to `images/generations` without references and to `images/edits` with references. The request SHALL use the configured model and prompt, `response_format: b64_json`, and only documented Grok controls. It MUST NOT send OpenAI-only `size`, `output_format`, `background`, multipart image fields, or mask fields.

#### Scenario: Grok text-to-image request

- **WHEN** route D generates without a reference image
- **THEN** it posts JSON to `images/generations`
- **AND** the body contains Grok model, prompt, aspect ratio, resolution, quality, response format, and `n: 1`

#### Scenario: Grok reference edit request

- **WHEN** route D receives one or more usable reference images
- **THEN** it posts JSON to `images/edits`
- **AND** one image uses the singular `image` object while multiple images use the `images` array
- **AND** each edit contains no more than five reference images
- **AND** each image is represented as an `image_url` data URI

#### Scenario: Too many Grok reference images

- **WHEN** route D receives more than five reference images
- **THEN** the request is rejected before an upstream call is made
- **AND** the error identifies the five-image limit

#### Scenario: Grok response formats

- **WHEN** Grok returns `b64_json` or a public image URL
- **THEN** the workflow resolves it to the existing final base64 image event

#### Scenario: Grok output format follows returned bytes

- **WHEN** route D returns a valid PNG or JPEG image
- **THEN** the server detects its actual format from the image bytes
- **AND** the final image MIME type and saved extension use that format regardless of the requested studio format

#### Scenario: Unsupported Grok mask

- **WHEN** a route D request includes a local mask
- **THEN** the request fails with a clear unsupported-mask message before an upstream request is sent

### Requirement: Existing route configuration remains compatible

The system SHALL continue to resolve legacy route A/B/C values and snapshots. Route aliases `grok` and `route-d` SHALL normalize to D. Route D SHALL participate in task snapshots, activity labels, queue scope keys, model discovery, and request payloads without being treated as route A.

#### Scenario: Legacy route snapshot

- **WHEN** a historical snapshot contains route A, B, or C
- **THEN** it remains readable and displays its original channel
- **AND** the new Grok fields do not alter its effective provider

### Requirement: Image resolution values are always concrete

The system SHALL expose only concrete image-resolution values for GPT/Grok pixel-size routes and Gemini model-protocol size routes. GPT/Grok SHALL use a concrete pixel-size option for the selected aspect ratio, and Gemini SHALL use one of 512, 1K, 2K, or 4K. The system MUST NOT display or send resolution auto.

#### Scenario: Resolution controls have no automatic option

- **WHEN** the user opens the image-generation controls for any supported route
- **THEN** the resolution selector contains only concrete pixel sizes or Gemini size tiers
- **AND** neither the value auto nor the label “自动适配” is available

#### Scenario: Legacy automatic resolution is migrated

- **WHEN** a saved configuration, browser cache, task snapshot, queue retry, manifest, sidecar, or preview metadata contains resolution auto, an empty value, or an invalid value
- **THEN** GPT/Grok data is normalized to the first concrete size for its ratio
- **AND** Gemini data is normalized to 1K
- **AND** a known measured image size may be retained when migrating a missing historical field
- **AND** the migrated value is the one used for subsequent requests and persistence

#### Scenario: Upstream requests never receive automatic resolution

- **WHEN** any image-generation entry point builds a new request, including a browser retry or server mock request
- **THEN** the request contains a concrete route-appropriate size
- **AND** no resolution field contains the string auto

### Requirement: Non-resolution automatic behaviors remain compatible

The system SHALL preserve existing automatic semantics for non-resolution fields such as article content type, automatic repair, and automatic collapse. Removing automatic resolution SHALL NOT rename, remove, or rewrite those unrelated fields.

#### Scenario: Non-resolution automatic fields remain readable

- **WHEN** an article record, creation repair request, or UI layout contains its existing automatic field
- **THEN** the field keeps its existing value and behavior
- **AND** resolution migration changes no unrelated field

### Requirement: Image generation controls are isolated by route

The system SHALL resolve image-generation quality from the selected image route and SHALL keep the selected quality value independently for GPT, Gemini, and Grok routes. GPT and Gemini SHALL expose only explicit supported quality tiers (`low`, `medium`, `high`, and model-supported `xhigh`/`max`); Grok SHALL expose and send only `low` or `medium`, with an empty or legacy `auto` Grok value defaulting to `medium`. Legacy `auto` values for GPT and Gemini SHALL migrate to the existing `high` default. GPT-only quality values sent to route D SHALL be reduced to `medium` instead of being forwarded unchanged.

#### Scenario: Grok uses its own quality vocabulary

- **WHEN** the selected image route is Grok and no quality is supplied
- **THEN** the effective quality is `medium`
- **AND** the browser quality control contains only `low` and `medium`

#### Scenario: GPT quality does not leak into Grok

- **WHEN** GPT quality is `high`, `xhigh`, or `max` and the user switches to Grok
- **THEN** the Grok request uses a supported value, with GPT-only tiers mapped to `medium`
- **AND** the saved Grok selection does not overwrite the GPT selection

#### Scenario: Route quality choices survive switching

- **WHEN** the user selects one quality for GPT, another for Gemini, and another for Grok, then switches between routes
- **THEN** each route restores its own last valid quality
- **AND** a route switch does not reuse the previous route's unsupported option

### Requirement: GPT reasoning effort is excluded from Grok image requests

Route D image-generation and image-edit requests SHALL NOT send `reasoningEffort`. Grok image task snapshots, preview metadata, saved image metadata, and suite snapshots SHALL omit the GPT-only reasoning field. Text/vision requests that remain on GPT SHALL continue to accept and persist their reasoning effort independently from image-route controls.

#### Scenario: Grok image request omits reasoning

- **WHEN** a Grok image request is created while the GPT reasoning control contains any value
- **THEN** the upstream request does not contain `reasoningEffort`
- **AND** the resulting image record does not claim a GPT reasoning level

#### Scenario: PPT text planning keeps GPT reasoning

- **WHEN** a PPT outline is generated through the GPT text/vision channel while image pages use Grok
- **THEN** the outline request retains its selected GPT reasoning effort
- **AND** the Grok page-image requests omit `reasoningEffort`

### Requirement: Direct Images API streaming is configurable

直连图像配置 SHALL 提供默认关闭的流式输出布尔开关，并在浏览器保存、读取和请求快照中保留该值。只有有效端点为 `images/generations` 或 `images/edits` 时，该设置 SHALL 控制上游 Images API SSE 请求，并请求两张中间预览；`responses`、`chat/completions`、文本/视觉请求及其他路由 SHALL 保持既有行为。旧配置没有该字段时 SHALL 视为关闭。

#### Scenario: Streaming is disabled by default

- **WHEN** 用户首次使用直连模式或读取没有该字段的旧浏览器配置
- **THEN** 流式输出开关显示为关闭
- **AND** 直连 Images API 请求使用普通 JSON 响应

#### Scenario: User keeps direct image streaming disabled

- **WHEN** 用户保持流式输出关闭并保存或提交直连图像任务
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
