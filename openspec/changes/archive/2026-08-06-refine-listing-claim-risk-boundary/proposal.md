## Why

短标题补全目前把所有 `标签：正文` 的标签都当作格式噪声删除，导致 `PORTABILITY`、`USB CHARGING`、`便携设计`、`USB充电` 等有业务含义的安全关键词无法进入标题。同时，高功率、高亮和防水等可能触发平台资质或性能证明要求的词缺少统一、明确的精确证据门禁。

## What Changes

- 保留有商品语义且有来源支持的五点/卖点标签，将其作为标题补全关键词候选。
- 继续丢弃 `PRODUCT TYPE`、`PACK DETAILS`、`产品类型`、`包装内容` 等纯结构标签。
- 将高功率、高亮、防水及对应英文表达纳入高风险性能声明规则；无论普通商品来源是否重复这些词都确定性删除。
- 普通属性仍需通过事实来源门禁，但不再因为属于普通便携、供电或充电描述而被风控词规则误删。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-listing-agent`: 区分普通商品属性、语义标签与可能要求资质或性能证明的高风险声明。

## Impact

- `lib/creation-listing-agent.mjs` 的标题补全标签候选提取。
- `lib/creation-listing-draft.mjs` 的中英文事实门禁和 V1/V2 高风险性能声明规则。
- Listing 中英文标题补全、证据清理和阻断声明测试。
- 不修改 Listing JSON 结构、模型请求次数、历史记录或非 Listing 工作流。
