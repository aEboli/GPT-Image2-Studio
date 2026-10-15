## MODIFIED Requirements

### Requirement: Public direct configuration never exposes raw credentials

Public configuration responses, browser-public state, model-picker feedback, and generation logs SHALL expose only channel endpoint/model metadata, configured booleans, and masked API keys. They MUST NOT include the raw image or text/vision API Key. 生图任务公开快照 SHALL 在解析配置后记录实际使用的 `baseUrl`、`imageRoute` 和 `endpointPath`，并在后续状态更新及失败时保留。日志 SHALL 只从任务自身的配置快照或生成结果读取接口地址；无地址的更新 SHALL 沿用已有日志地址，且 SHALL NOT 从当前选择的连接配置推断历史地址。

#### Scenario: Public config is read after saving both channel keys

- **WHEN** private configuration contains non-empty image and text/vision API Keys
- **THEN** `/api/config` and browser-public configuration report both keys as configured with masks
- **AND** neither response contains either raw key

#### Scenario: Private request payload remains channel-specific

- **WHEN** a browser generation request includes direct private configuration
- **THEN** the request may carry the selected channel's raw key to the local service for the current operation
- **AND** the server does not copy that key into a public response, log message, or unrelated channel

#### Scenario: 切换 API 后轮询历史任务

- **WHEN** 用户从 API A 切换到 API B，轮询再次返回 API A 的成功或失败任务
- **THEN** 日志继续显示任务快照或结果中的 API A 地址
- **AND** 若旧快照没有地址则保留日志原值，既没有快照地址也没有原值时不显示 URL
- **AND** 序列化并重新读取日志后上述规则保持一致

#### Scenario: 服务端任务在配置解析后失败

- **WHEN** 服务端已解析生图配置，之后校验失败或上游请求失败
- **THEN** 任务公开快照仍带有本次请求的接口地址、路由与协议后缀
- **AND** 任务不包含原始 API Key
