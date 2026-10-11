## ADDED Requirements

### Requirement: 当前参数摘要显示请求发起 IP

服务端配置响应 SHALL 返回当前请求的 `requestIp` 字段。桌面端或浏览器端的当前生图参数摘要 SHALL 在现有模型信息之后显示该地址；若服务端没有可用地址，界面 SHALL 显示“未记录”。该字段 SHALL NOT 写入浏览器私有 API 配置。

#### Scenario: 配置接口返回当前请求地址

- **WHEN** 客户端请求 `/api/config`
- **THEN** 响应包含当前请求的 `requestIp` 字符串字段

#### Scenario: 当前摘要显示地址

- **WHEN** 客户端加载配置并渲染生图参数摘要
- **THEN** 摘要显示请求发起 IP
