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
