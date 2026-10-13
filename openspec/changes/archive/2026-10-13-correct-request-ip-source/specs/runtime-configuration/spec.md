## MODIFIED Requirements

### Requirement: 当前参数摘要显示请求发起 IP

服务端配置响应 SHALL 返回当前的 `requestIp` 字符串字段。该字段 SHALL 表示 Studio 服务端通过上游 HTTP transport 查询到的公网出口 IP，MUST NOT 从浏览器请求头或入站 socket 地址推导。若查询失败，服务端 SHALL 返回空字符串，界面 SHALL 显示“未记录”。桌面端或浏览器端的当前生图参数摘要 SHALL 在现有模型信息之后显示该值；该字段 SHALL NOT 写入浏览器私有 API 配置。

#### Scenario: 配置接口返回当前请求地址

- **WHEN** 客户端请求 `/api/config`
- **THEN** 响应包含服务端查询到的公网出口 IP，或在查询不可用时包含空字符串
- **AND** 响应值不取自浏览器请求头或浏览器到 Studio 的连接地址

#### Scenario: 当前摘要显示地址

- **WHEN** 客户端加载配置并渲染生图参数摘要
- **THEN** 摘要显示 Studio 本机当前公网出口 IP
- **AND** 若 IP 查询不可用则显示“未记录”
