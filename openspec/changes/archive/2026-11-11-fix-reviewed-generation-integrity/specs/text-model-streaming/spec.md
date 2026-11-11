## ADDED Requirements

### Requirement: 文本缓冲与文件输入适配完整
系统 SHALL 将 Chat Completions 的缓冲完整响应转换为业务解析器可读取的统一回答契约，并将 PDF 文件内容转换为该接口的嵌套 `file` 结构。Responses 请求原有结构 SHALL 保持有效。

#### Scenario: Chat 网关返回完整业务 JSON
- **WHEN** PPT 大纲、文档分析或文章规划通过 Chat 接口收到有效完整回答
- **THEN** 回答 SHALL 与同内容的 Responses 响应得到相同有效业务结果

#### Scenario: Chat 请求包含 PDF
- **WHEN** 用户上传 PDF 并选择 Chat Completions 端点
- **THEN** 文件内容使用 `type=file` 以及嵌套的 `file.filename`、`file.file_data`

### Requirement: 文本调用在明确鉴权失败后立即结束
PPT 大纲、PPT 文档分析和文章规划 SHALL 保留上游错误分类，HTTP 401、403 和明确账号权限错误及取消 MUST NOT 触发自动重试。可恢复错误仍 SHALL 遵守现有请求预算。

#### Scenario: 上游拒绝凭据
- **WHEN** 首次文本请求返回 HTTP 401 或 403
- **THEN** 逻辑操作立即失败且仅发生一次上游请求
