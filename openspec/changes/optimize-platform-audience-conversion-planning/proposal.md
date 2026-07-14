## Why

当前套图模式已经能按平台生成不同图片类型和参数，也包含通用的买家决策提示，但参考图分析没有形成结构化受众、购买动机和购买顾虑，逐图提示词仍对所有平台和人群复用相近的转化逻辑。同时，浏览器虽然冻结了预览计划，正式生成仍会重新规划，导致新策略可能在排队或表单变化后漂移。

## What Changes

- 套图参考图分析增加结构化 `audienceStrategy`，只描述与商品使用和购买决策相关的非敏感人群语境、购买动机、购买顾虑、证据依据和置信度。
- 为通用电商及 18 个平台增加结构化营销语境，区分搜索核验、价值比较、内容发现、生活方式与品牌信任等购买路径，不使用地域或文化刻板印象。
- 按“通用基线 < 平台语境 < 类目语境 < 参考分析建议 < 用户套图覆盖 < 用户逐图覆盖”解析 `effectiveAudienceStrategy`，并确定性地为每张图分配 `conversionIntent`。
- 逐图提示词使用目标人群、动机、顾虑和转化任务调整构图、证明方式、场景与文案重点，但只能引用用户商品信息和参考图证据，不得编造性能、认证、价格、销量、保证、评价或其他事实。
- 平台官方硬规则和逐图 `textPolicy`、`logoPolicy`、`scenePolicy`、blocking constraints 始终优先；严格主图不得因受众或营销策略增加文字、拼贴、外部 Logo、场景或未经支持的承诺。
- 将原始 `audienceStrategy`、解析后的 `effectiveAudienceStrategy` 和逐图 `conversionIntent` 写入完整 `effectivePlan`，供预览、生成、队列、manifest、记录和修复共同冻结。
- 修复正式生成未提交完整冻结计划的断点：Local 与 Cloudflare Worker 对合法 `effectivePlan` 快照优先执行，对旧请求回退重新规划；服务端限制快照大小和条目数，并重新校验平台硬规则，不信任客户端的 `canGenerate`。
- 保持 Worker 当前无跨刷新 Creation 记录和修复能力的边界，不把完整受众策略写入单图 R2 自定义元数据。
- 不增加广告投放、自动上架、敏感人群推断、文化或地域刻板画像、生成后视觉/OCR 质检，也不重做现有套图界面。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-mode`: 套图分析、平台规划和逐图提示词增加可验证的受众与转化策略，并让正式生成、队列、存储和修复执行同一份经过服务端复验的冻结计划。

## Impact

- 平台与规划：`lib/creation-platform-policies.mjs`、`lib/creation-platform-resolver.mjs`、`lib/creation-planner.mjs`。
- 参考分析：`lib/prompt-agent.mjs`，以及 Local/Worker 的 Creation reference analysis 上下文与 schema 归一化。
- 浏览器与队列：`public/app.js`、`lib/creation-suite-queue.mjs`；沿用现有分析结果和计划界面，不新增独立受众配置面板。
- 生成与一致性：`server.mjs`、`cloudflare-pages-worker.mjs`，新增冻结计划提交、大小/数量限制、共享归一化与硬规则复验。
- 存储与修复：`lib/creation-store.mjs`、`lib/creation-repair.mjs`，保留逐图转化字段并继续以 `effectivePlan` 为唯一完整事实源。
- 测试：平台营销语境、分析 schema、安全边界、解析优先级、逐图提示词、严格主图、冻结快照、队列/存储/修复、本地与 Worker 一致性及回归测试。
- 兼容性：旧请求和旧 manifest 缺少受众或冻结计划字段时保持现有行为；无 API breaking change。
