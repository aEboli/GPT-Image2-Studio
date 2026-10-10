## ADDED Requirements

### Requirement: Server credentials remain bound to their configured provider

系统 SHALL 仅将服务端凭据发送到对应配置的归一化地址和接口。请求改变直连图像、直连文本、Gemini 或 Grok 的有效目标时 SHALL 显式提供所用密钥；没有请求凭据的目标覆盖 SHALL 在发起上游请求前失败。请求携带的密钥与兼容旧字段 SHALL 继续支持合法提供方切换。

Serverless 运行时 SHALL 拒绝通过 HTTP 修改服务端私有配置，浏览器私有配置保存 SHALL 继续可用。

#### Scenario: Request redirects a saved provider without supplying its key
- **WHEN** 请求覆盖提供方地址或接口但继续复用服务端凭据
- **THEN** 配置合并拒绝请求且没有上游请求
- **AND** 错误消息不包含密钥

#### Scenario: Public deployment receives a private configuration write
- **WHEN** Serverless 部署收到 `/api/config` 写入请求
- **THEN** 请求返回拒绝状态且服务端配置保持不变
- **AND** 请求不能先重写提供方地址再转发已保存密钥

#### Scenario: Request supplies its own provider credentials
- **WHEN** 请求显式提供所用密钥与提供方地址
- **THEN** 该请求使用请求中的提供方配置
- **AND** 其他通道的已保存配置保持不变

### Requirement: Running task snapshots survive history trimming

会话任务存储 SHALL 保留全部运行中任务，容量限制 SHALL 只裁剪最旧的已结束任务。

#### Scenario: Multiple modes exceed the history capacity
- **WHEN** 同一会话的运行中任务总数超过历史容量
- **THEN** 每个运行中任务仍可更新与完成
- **AND** 每个完成任务的终态可供前端轮询
