# Context

`/api/creation/listings` 会使用所选文本视觉通道的 `endpointPath`。Listing Agent 目前无条件发送 Responses API 的 `input` 和 `text.format`，因此配置为 `chat/completions` 的上游会在请求校验阶段拒绝它。

# Decisions

## 协议分支

当 `endpointPath` 为 `chat/completions` 时，发送单条 user `messages`，并使用 Chat Completions 的 `response_format.json_schema` 结构；Responses 路径继续使用现有 `input`、`text.format` 结构。两种响应都沿用现有 Listing JSON 提取和校验逻辑。

## 批量生成

记录页控制器从当前已加载的套图记录中筛选 `listingDrafts` 为空的记录，按顺序调用现有单条 `generate` 流程。每条失败都保存为失败计数并继续处理，避免一条坏记录阻断整批。批量运行期间复用已有多记录生成状态集合，保持删除、Temu 导出和单条生成的互斥状态。
