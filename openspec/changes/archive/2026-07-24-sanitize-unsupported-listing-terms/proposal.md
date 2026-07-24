## Why

Platform V1 当前会因模型文案包含未在输入中逐字出现的低风险属性词，或因标题长度、Bullet 标签、问句形式、双语数组数量等展示规则不完全符合模板，而直接丢弃整份本可使用的 Listing。需要把这些可恢复问题改为自动清理或宽容接收，使 Listing 继续生成，同时保留解析失败、空主体和高风险声明的必要阻断。

## What Changes

- 对模型输出中的未支持低风险具体属性、材质、颜色、形状、结构、模式和使用场景词执行字段级自动清理，并在清理后继续返回 Listing。
- 将 Platform V1 的结构验收收窄为可展示双语 Listing 所需的最小完整性，不再把标题推荐长度、固定 Bullet 标签、痛点句式、双语数组等长或关键词桶非空当作生成失败条件。
- 保留无法解析的响应、缺失英中标题或主要内容以及未支持高风险声明的明确失败行为。
- 增加直接模型响应的回归测试，覆盖截图中的 `adjustable`、`gray`、`black`、`rechargeable` 类词和宽容结构验收。

## Capabilities

### New Capabilities

无。

### Modified Capabilities

- `creation-listing-agent`: 将可恢复的低风险证据词和非关键格式偏差从硬失败改为清理后完成，同时明确最小结构与高风险失败边界。

## Impact

- 影响 `lib/creation-listing-agent.mjs` 的 Platform V1 单次响应验收流程。
- 影响 `lib/creation-listing-draft.mjs` 的低风险证据词识别与内容净化能力。
- 更新 Listing Agent 回归测试和 `creation-listing-agent` 行为规格；不改变外部 API 字段名、持久化位置或平台发布行为。
