## Why

套图 Listing 的真实模型请求失败或返回不合格内容时，当前实现会把确定性 mock 草稿保存成 `completed`，导致内部提示语和占位商品信息被误当成真实 Listing。生成失败必须保持为失败，不能伪装成已完成内容。

## What Changes

- **BREAKING**：真实 Listing 请求发生 HTTP 错误、响应解析错误或内容验收失败时，接口返回明确错误，不再生成或保存 mock/确定性兜底草稿。
- 成功结果仍使用现有旧式双语字段结构，并继续执行结构、证据和安全校验。
- 重新生成失败时保留记录中原有的 Listing，不用失败产物覆盖它。
- 显式 `mock: true` 仅保留为测试能力，不得被真实请求的失败处理自动选择。
- 本地服务与 Cloudflare Worker 保持相同的失败闭合语义。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-listing-agent`：把真实 Listing 的失败处理从确定性兜底改为明确失败，并删除所有与自动兜底相冲突的行为要求。

## Impact

- `lib/creation-listing-agent.mjs` 的请求、解析和验收失败出口。
- `/api/creation/listings` 的本地与 Worker 错误响应语义；成功响应结构不变。
- Listing 生成回归测试与 OpenSpec 当前行为规格。
- 不迁移、不自动删除历史 Listing 记录。
