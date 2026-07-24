## Context

现有平台规划已经把 19 个平台的图片类型、顺序、比例、文字、场景和 Logo 规则结构化，并通过 `effectivePlan` 保存最终逐图提示词。规划器也有固定的 `SHOPPER QUESTION` 和 `BUYER DECISION STRATEGY`，但这些内容只按图片 role 区分，没有本次商品的目标人群、购买动机、购买顾虑和平台购买路径，因此不同平台最终仍可能得到相近的营销表达。

套图参考图分析当前只返回商品名、类目、参考图用途、SKU 和风险。浏览器会深冻结预览计划，但正式生成 FormData 没有提交完整 `effectivePlan`，Local 与 Worker 会根据当时表单再次运行规划器。这个断点会使受众策略、逐图分工和提示词在排队、表单编辑或策略版本变化后漂移。

本变更必须在现有大量未提交的平台规划实现上增量工作，不覆盖无关用户改动。平台官方硬规则、旧 manifest 兼容、Local/Worker 一致性和 R2 自定义元数据上限继续作为边界。

## Goals / Non-Goals

**Goals:**

- 让参考图分析输出可归一化、可追踪来源的非敏感受众与转化建议。
- 让不同平台、类目和购买语境得到结构化、可测试的营销策略，而不是只依赖自由文本。
- 让每张图承担不同的购买决策任务，并只使用现有商品事实和参考证据支撑提示词。
- 让严格主图和平台硬规则始终高于受众与营销策略。
- 让预览、正式生成、队列、manifest、记录和修复执行同一份服务端复验的冻结计划。
- 保持旧请求、旧记录和缺少参考分析时的兼容回退。

**Non-Goals:**

- 新增受众配置面板、重做套图界面或建立复杂营销工作台。
- 从人物外观推断年龄、性别、种族、宗教、健康、收入等敏感属性。
- 自动投放广告、自动发布、自动生成平台 Listing 或验证真实转化率。
- 使用文化或地域刻板印象描述平台人群。
- 建立 Worker 跨刷新 Creation 记录、云端修复或把完整策略复制到每张图的 R2 自定义元数据。
- 增加生成后视觉/OCR 质检。

## Decisions

### 1. 使用三层结构化转化契约

原始分析或调用方输入使用 `audienceStrategy`：

- `targetAudience`：产品使用或购买语境，例如通勤使用者、初次购买者、送礼购买者；不得是模型推断的敏感人口属性。
- `purchaseMotivations`：最多若干条购买动机。
- `purchaseObjections`：最多若干条购买顾虑。
- `desiredOutcome`：买家期望获得的结果。
- `evidenceBasis`：对应用户商品信息或参考图事实的依据。
- `confidence` 与 `source`：区分用户输入、分析建议和平台回退。

解析后的 `effectiveAudienceStrategy` 保存平台、类目、分析和用户输入合并后的最终值及 provenance。每个 item 保存 `conversionIntent`，至少包含 `audienceFocus`、`motivationFocus`、`objectionFocus`、`conversionGoal` 和 `evidenceFocus`。

选择三层契约而不是把受众文字直接拼进 prompt，是为了能测试优先级、冻结来源、逐图分工和安全边界。第一版不让它改变图片类型、顺序或官方硬规则，避免营销优化破坏平台合规。

### 2. 平台 profile 增加结构化 `marketingContext`

通用电商及 18 个平台 profile 增加：

- `shopperIntent`：搜索核验、价值比较、内容发现、生活方式或品牌信任等购买路径。
- `proofStyle`：平台买家更适合的证据表达方式。
- `copyStyle`：允许文字的图片应采用的信息密度与语气。
- `defaultMotivations` 与 `defaultObjections`：无分析结果时的保守回退。

这些字段是可编辑策略建议，不自动升级为官方规则。平台规则来源、证据等级和 blocking constraints 仍由现有 policy 契约管理。

### 3. 解析优先级和逐图分配保持确定性

合并顺序为：

`通用基线 < 平台 marketingContext < 类目语境 < 参考分析建议 < 用户套图输入 < 用户逐图覆盖`

数组字段去重并限制长度；空值不覆盖已有事实。类目只提供使用语境和决策问题，不推断人口属性。逐图分配按 role、imageType 和 slot 顺序确定：首图负责识别与核心动机，卖点/用法图负责收益，场景图负责使用代入，细节/参数/多角度图消除真实性与适配顾虑，包装/SKU 图降低完整度与选择顾虑，售后图只使用用户已提供的服务事实。

选择确定性分配而不是再次调用模型，是为了保证 Local/Worker 一致、队列可冻结、测试可重复，并避免新增延迟和费用。

### 4. 提示词只改变表达角度，不创造商品事实

普通 carousel item 和 SKU item 在现有 `sourceFocus` 和平台指导之后增加结构化 `CONVERSION INTENT`。`evidenceFocus` 必须从当前 item 已分配的商品描述、卖点、尺寸、SKU、参考图或平台允许的保守回退中产生；没有事实时只能提出需要证明的问题，不能生成性能、认证、价格、销量、保证、评价或效果承诺。`infographic-rebuild` 是 source-only 重构项，可以保留兼容元数据，但不得把 `conversionIntent` 或任何受众策略拼入最终提示词。

严格主图只允许受众策略影响缩略图识别和商品优先级，不得增加营销文字、拼贴、外部 Logo、场景、道具或承诺。最终仍在所有覆盖之后运行 `validateCreationPlatformPlan`，`textPolicy`、`logoPolicy`、`scenePolicy` 和 blocking constraints 始终优先。

### 5. 参考分析提供建议，浏览器沿用现有确认流程

Creation reference analysis schema 增加 `audience_strategy`，分析上下文同时接收用户已填写的商品名称、描述和卖点。模型必须把输出标记为建议和置信度，只能从显式商品事实、可见使用语境和平台/类目上下文推导。

浏览器沿用现有“应用建议”流程：只有已应用且未失效的分析结果会进入 plan 请求；不新增独立配置面板。现有分析摘要继续作为用户确认入口。直接 API 调用仍可显式提供 `audienceStrategy` 和逐图覆盖。

### 6. 正式生成优先执行合法冻结快照

浏览器正式生成 FormData 增加完整 `effectivePlan` JSON；队列同时冻结该 FormData 和用于展示的 set/items。Local 与 Worker 共用 planner 导出的提交快照解析函数：

1. 限制序列化字节数和 item 数量。
2. 解析并规范化必需的 plan/item 字段，拒绝缺少 itemId、prompt 或生成参数的损坏快照。
3. 忽略客户端 `canGenerate`、`validation`、计数字段和内部标记，按 items 重新计算计数并运行 `validateCreationPlatformPlan`。
4. 在复验后应用最终 prompt override，再次校验并执行冻结 items。
5. 没有 `effectivePlan` 的旧请求继续调用 `buildCreationPlan`。

选择提交完整快照而不是只提交受众字段，是因为提示词、顺序、比例、语言和营销意图必须作为一个原子版本执行。快照不替代服务端校验，也不信任客户端声明。

### 7. `effectivePlan` 是唯一完整持久化事实源

manifest 顶层只保留现有查询和兼容字段；完整 `audienceStrategy`、`effectiveAudienceStrategy` 和逐图 `conversionIntent` 位于 `effectivePlan`。item normalizer 仅保留修复和展示需要的逐图转化字段，repair 优先复用保存的 item，不根据当前平台或当前表单重算。

Worker 只在 SSE set 的 `effectivePlan` 返回完整结构，不把它复制到每张图 R2 custom metadata，避免触发 8,192 字节上限。Worker 当前没有 Creation 记录与 repair，本变更不扩展该能力。

## Risks / Trade-offs

- [模型输出的受众建议过度推断] -> schema、系统指令和 normalizer 同时限制敏感属性；不确定时使用通用类目买家并标记低置信度。
- [营销意图编造产品事实] -> `conversionIntent` 只能绑定现有 `sourceFocus`/参考证据，提示词加入明确事实边界，测试覆盖无证据输入。
- [严格主图被转化文案污染] -> policy-dominant slot 使用专用保守指导，并在所有覆盖后复验 blocking constraints。
- [客户端伪造或放大快照] -> 服务端限制字节数和 item 数，重新规范化、计算和校验，不信任客户端状态字段。
- [完整快照增加请求体大小] -> 只随一次正式生成请求提交，设置明确上限；不复制到单图元数据。
- [旧记录缺少新字段] -> normalizer 使用平台/类目低置信度回退，不重写历史 manifest；只有显式重新规划才生成新策略。
- [脏工作树中的现有平台实现被覆盖] -> 只做局部增量修改，测试前后检查相关 diff，不格式化或重写无关代码。

## Migration Plan

1. 先增加 policy、analysis schema、resolver/planner 的纯数据契约和单元测试。
2. 增加浏览器、Local、Worker 的字段透传和冻结快照复验，保留无快照回退。
3. 扩展队列、store 和 repair 的保留字段与回归测试。
4. 运行定向测试、完整测试、public/lib 同步检查、Pages 构建和 OpenSpec strict validation。
5. 回滚时移除新字段解析和快照优先分支；旧请求路径仍可独立工作，不需要数据迁移。

## Open Questions

- 首版不增加显式受众输入控件；若真实使用证明分析建议不够可控，再通过独立 UI change 增加套图级和逐图级编辑器。
- 平台 `marketingContext` 是版本化产品策略，不宣称代表平台官方转化数据；未来若引入真实投放/成交数据，需要独立的数据治理与实验 change。
