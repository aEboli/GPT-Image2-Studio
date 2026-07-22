# 恢复 Listing 规则并优化标题

## Why

上一轮将平台 V1 Listing 整体替换为收益导向提示词，同时改变了五点标签和结果门禁。实机重新生成后，字段写法与此前稳定结果差异过大。当前需要恢复原有 Listing 结构和约束，只对标题增加更明确的购买价值表达。

## What Changes

- 恢复平台 V1 原有 SEO、客观属性、固定五点标签和直接 fallback 规则。
- 标题在商品核心词之后加入一个已提供的核心卖点，以及该卖点直接解决的痛点或购买顾虑。
- 仅 `title` 与 `zhDisplay.title` 允许有证据支持的简短结果表达；其他字段继续禁止功能、效果和结果承诺。
- 标题中的排名、认证、医疗、价格、保证、退款及其他高风险声明继续触发保守 fallback。
- 不改变旧式双语 JSON 字段、平台策略解析、SKU 父 Listing、无品牌净化、页面展示或历史 Listing 记录。

## Impact

- Listing 生成语义：`lib/creation-listing-agent.mjs`
- Listing 风险检查：`lib/creation-listing-draft.mjs`
- 回归覆盖：`test/creation-listing-agent.test.mjs`
- 行为规格：`openspec/specs/creation-listing-agent/spec.md`
