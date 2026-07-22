## Context

`generateCreationListingDrafts` 当前为每个 Listing source 使用 `forceV1` 请求。`buildPlatformV1ListingPrompt` 仍拼接旧的 Amazon SEO、固定五点标签和全量功能词禁用规则；V1 响应还会因为任意 functional wording 被直接丢弃。这样平台策略虽然进入请求，却没有真正决定表达方式。

## Decisions

### 1. 以证据约束收益，而不是一律禁止收益

模型先在内部整理商品身份、搜索意图、购买顾虑、变体和可追溯事实，再输出文案。由明确商品事实直接支持的保守收益可以保留；视觉印象不能升级为材料、性能、认证或安全声明。绝对排名、社会证明、价格/折扣、保证/退款、医疗和未经证实的材料/兼容性/性能声明继续由结果门禁拦截。

### 2. V1 使用统一旧式字段，但按平台 archetype 改变写法

提示词保留 `title`、`sellingPoints`、`painPoints`、`fiveBullets`、`description`、`backendSearchTerms`、`keywordBuckets` 和同构 `zhDisplay`。搜索型、价值型、内容型和 editorial/DTC 型平台只改变字段内容策略，不改变外部字段名和顺序；解析后的平台 policy 及其硬限制优先于通用建议。

### 3. 五点按商品决策问题生成

仍输出恰好五条以兼容现有旧式字段，但每条使用来自商品本身的短标签，分别覆盖价值、差异化特征、使用语境、规格/适配和变体/包装，禁止复制固定 `PRODUCT TYPE` 等模板。

### 4. 保留直接完成和回退语义

V1 仍只发起一次模型请求；结构不可用或包含高风险声明时继续使用确定性保守 fallback。仅有证据支持的 functional wording 不再触发 fallback。旧的无显式平台兼容路径和 V2 历史路径保持原行为。

## Verification

- 定向测试确认新提示词包含目标、证据收益、平台适配、字段规则、双语合同和真实 source/policy 数据。
- 定向测试确认带有 `helps/supports` 等证据支持收益的 V1 草稿被保留，而 `best seller` 等高风险声明仍回退。
- 运行 Listing、Worker/Local parity、完整测试、public 同步、Pages 构建和 OpenSpec strict validation。
