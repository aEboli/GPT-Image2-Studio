## ADDED Requirements

### Requirement: 套图参考图识别失败自动重试

套图模式执行参考图智能识别时，客户端 SHALL 在初次识别失败后自动重试最多 3 次，总尝试次数 SHALL 不超过 4 次。HTTP 非成功响应、请求异常和可解析但不包含非空 `recommendations` 或 `reference_roles` 数组的响应 SHALL 视为识别失败。

#### Scenario: 临时失败后识别成功

- **WHEN** 初次识别或某次重试失败，后续一次请求返回 HTTP 成功且包含非空识别结果
- **THEN** 客户端继续现有识别结果应用流程
- **AND** 不再发送后续识别请求

#### Scenario: 连续失败达到重试上限

- **WHEN** 初次识别和 3 次自动重试都失败
- **THEN** 客户端不再发送识别请求
- **AND** 识别界面显示最后一次错误

#### Scenario: 空识别结果继续重试

- **WHEN** 服务端返回 HTTP 成功但 `recommendations` 与 `reference_roles` 都为空或缺失
- **THEN** 客户端将该响应视为识别失败
- **AND** 在达到上限前继续自动重试

#### Scenario: 识别上下文发生变化

- **WHEN** 重试期间用户修改参考图或发起新的识别请求
- **THEN** 旧识别流程停止应用结果
- **AND** 旧流程不得覆盖新的识别状态
