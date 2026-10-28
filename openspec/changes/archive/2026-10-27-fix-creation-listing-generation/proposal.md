# Why

套图记录中的 Listing 生成在使用 Chat Completions 接口时把 Responses API 的 `input` 请求体发给上游，导致上游返回 `field messages is required`。同时记录页只能逐套生成，无法一次补齐历史记录中缺少 Listing 的套图。

# What Changes

- Listing Agent 按配置的文本接口路径发送 Responses 或 Chat Completions 对应请求体。
- 套图记录页增加“批量生成 Listing”，按顺序生成所有缺少 Listing 的记录，并跳过已有 Listing。
- 批量生成中的单条失败不阻断后续记录，完成后反馈成功和失败数量。

# Non-Goals

- 不改变 Listing 字段、平台策略、提示词事实边界或已有 Listing 内容。
- 不重新生成已有 Listing，不改变套图图片生成流程。

# Capabilities

### Modified Capabilities

- `creation-listing-agent`: 文本接口协议与 Listing 请求体保持一致。
- `creation-mode`: 套图记录支持批量补齐缺失 Listing。
