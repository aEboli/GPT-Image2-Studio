## Why

平台 V1 当前已经稳定生成旧版双语 Listing 结构，并把证据支持的价值表达限制在标题中。但标题以外的字段只规定了合规边界，没有明确的信息量、字段分工和去重方法，模型经常返回过短的单句卖点、重复的五点描述，以及彼此重叠的搜索词，导致 Listing 虽然安全但不够完整。

## What Changes

- 在不修改标题规则的前提下，为 `sellingPoints`、`painPoints`、`fiveBullets`、`description`、`backendSearchTerms` 和 `keywordBuckets` 增加独立的完整度规则。
- 证据充足时要求卖点和购买前核对项覆盖多个不同决策点，并用完整、具体的客观表述代替短标签。
- 保留五点描述的固定标签，同时明确每个标签的唯一职责和建议内容顺序。
- 描述按商品身份、可见结构、规格/变体和包装事实组织，充分利用已提供事实，但不通过重复或无证据填充来拉长。
- 后台搜索词和四类关键词桶扩大有用语义覆盖，并在字段内及跨桶去除大小写、单复数和同义重复。
- 保持英文与简体中文字段的数组长度、顺序、事实、数量和单位严格对应。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-listing-agent`: 平台 V1 标题以外的字段在保持客观属性边界时，应提供更完整、分工清晰且去重的商品信息。

## Impact

- 平台 V1 Listing 提示词及其回归测试。
- `creation-listing-agent` 当前行为规格。
- 不修改 JSON 结构、页面显示、复制行为、平台政策或现有标题逻辑；历史记录只在用户重新生成 Listing 后更新。
