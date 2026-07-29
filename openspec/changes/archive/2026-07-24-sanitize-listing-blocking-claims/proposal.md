## Why

Platform V1 已能自动清理低风险属性词，但未支持的兼容性、认证、排名、保证、性能、材质或竞品声明仍会触发硬失败，导致一份其余字段可用的 Listing 被整单丢弃。用户要求任何此类关键词都不能再阻断 Listing 生成，应删除问题片段并继续返回结果。

## What Changes

- 将 Platform V1 当前所有会触发 `unsupported claim` 硬失败的声明模式统一改为自动清理，包括兼容性、认证、排名、社会证明、医疗/安全、终身质保、材质、性能、价格/折扣/退款和竞品比较。
- 对有精确来源证据的声明保留原文；只删除缺少所需证据或规则规定不得使用的匹配片段。
- 当清理使英中标题或描述为空时，从清理后的剩余公开内容或安全商品主体补齐最小可展示文本，避免关键词清理间接造成失败。
- 保留上游请求失败、空响应、不可解析 JSON 和无法形成任何商品主体等非关键词错误。
- 增加兼容性截图场景、全部阻断声明类别、多语言清理和本地/Worker 一致性回归测试。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-listing-agent`: Platform V1 的阻断型声明从硬失败改为证据感知的字段清理与最小内容修复。

## Impact

- 影响 `lib/creation-listing-draft.mjs` 的声明模式匹配与内容净化。
- 影响 `lib/creation-listing-agent.mjs` 的 Platform V1 单次响应验收顺序。
- 更新 Listing Agent、三路径一致性测试和当前行为规格；不改变 API 字段名、模型请求次数、存储位置或发布能力。
