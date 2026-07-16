## 1. 基线与分析契约

- [x] 1.1 记录所有受影响文件的当前脏工作树差异与现有定向测试结果，确保后续只做增量修改且不覆盖用户已有平台规划改动。
- [x] 1.2 增加失败的 prompt-agent 与归一化测试，覆盖 `audience_strategy` schema、商品事实上下文、来源/置信度、保守回退和敏感属性禁止推断。
- [x] 1.3 扩展 Creation reference analysis 的 Local/Worker 上下文、JSON schema 和 normalizer，使已应用且未失效的分析建议可序列化为 `audienceStrategy`。

## 2. 平台营销语境与解析

- [x] 2.1 增加失败的平台 policy 测试，要求通用电商及 18 个平台 profile 都具有合法、非阻断性的结构化 `marketingContext`。
- [x] 2.2 增加失败的 resolver 测试，覆盖通用 < 平台 < 类目 < 分析 < 用户套图 < 用户逐图的优先级、数组去重、provenance 和确定性逐图 `conversionIntent`。
- [x] 2.3 实现平台 `marketingContext`、`audienceStrategy`/`effectiveAudienceStrategy` 归一化与逐图转化任务分配，不改变平台图片类型、顺序和官方硬规则。

## 3. 规划器与提示词

- [x] 3.1 增加失败的 planner 测试，证明不同平台和非敏感人群策略会生成不同逐图转化任务与提示词，且同套图不同 role 不重复同一营销板式。
- [x] 3.2 增加失败的证据与合规测试，证明无依据时不编造性能、认证、价格、销量、保证、评价或效果，Amazon 等严格主图不注入营销文字、拼贴、外部 Logo 或场景。
- [x] 3.3 将有效受众策略和逐图 `conversionIntent` 接入 carousel、SKU 与信息图重构计划和提示词，并在所有覆盖后继续执行平台硬规则校验。

## 4. 冻结计划执行

- [x] 4.1 增加失败的浏览器、Local 与 Worker 测试，复现预览已冻结但正式生成重新规划的问题，并覆盖完整 `effectivePlan` 提交。
- [x] 4.2 实现共享提交快照解析：限制序列化字节数和 item 数量，规范化必需字段，重算计数与 validation，不信任客户端 `canGenerate`，合法快照优先且旧请求回退重算。
- [x] 4.3 让浏览器正式生成与队列提交完整冻结计划，并让 Local/Worker 执行完全相同的冻结 items、提示词、转化意图、比例、尺寸和语言。

## 5. 队列、存储与修复

- [x] 5.1 增加失败的 queue/store/repair 测试，覆盖提交后表单变化不影响快照、manifest round-trip、旧 manifest 兼容和 repair 不按当前策略重算。
- [x] 5.2 扩展浏览器/set/item normalizer、queue、store 和 repair 的必要白名单字段，以 `effectivePlan` 为唯一完整事实源，并保持 Worker 单图 R2 metadata 小于既有上限。

## 6. 验证与验收

- [x] 6.1 运行 prompt、policy、resolver、planner、browser、preview/generation、queue、store、repair、Worker 与端到端定向测试，修复全部回归且不弱化断言。
- [x] 6.2 运行完整 `npm test`、`npm run sync:public-lib -- --check`、`npm run build:pages`、OpenSpec strict validation 和新增中文乱码扫描，并记录环境限制。
- [x] 6.3 请求独立只读验收 agent 复核受众安全、事实边界、严格主图、冻结快照安全、Local/Worker 一致性、队列/修复漂移和脏工作树保留；处理所有确认问题后完成本 change。
