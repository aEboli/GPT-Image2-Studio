## ADDED Requirements

### Requirement: Listing deadlines include response body consumption

Listing 上游请求的超时 SHALL 覆盖连接、响应头和正文读取，并在成功或失败后释放计时器。

#### Scenario: Provider sends headers and stalls the body
- **WHEN** 提供方先返回响应头但正文读取超过请求期限
- **THEN** 上游读取被取消且任务返回明确超时错误
- **AND** 不无限等待正文
