## 1. 基线与失败测试

- [x] 1.1 记录平台切换相关生产与测试文件的当前脏工作树差异，并运行现有平台切换、参考分析和浏览器 UI 定向测试，确保只做增量修改。
- [x] 1.2 增加失败的交互测试，证明平台 select 选择新值后直接接受且不调用 `window.confirm`，不再存在取消或旧选择回滚分支。
- [x] 1.3 增加失败的状态测试，证明直接切换保留现有内联平台状态与冻结计划清理、`renderCreationView` 刷新和 `previewCreationPlan` 重算路径。
- [x] 1.4 增加失败的字段级回归测试，证明商品名称、描述、卖点、类目、尺寸、参考图及元数据、Logo、SKU、输出格式和模型/API 配置在直接切换后保持不变。
- [x] 1.5 增加失败的边界测试，证明旧参考分析响应仍被忽略，且参考分析摘要与“应用建议”动作保持现有行为。

## 2. 平台切换交互

- [x] 2.1 简化 Creation 平台 select 的 change handler：规范化并直接接受新平台，删除该流程中的 `window.confirm` 调用、取消分支和仅供回滚使用的旧状态快照。
- [x] 2.2 在新平台接受后保留现有内联 `platformSetOverrides`、`platformItemOverrides`、冻结 payload、`effectivePlan`、当前 set 和手工 role 标记清理，以及 `renderCreationView`、`previewCreationPlan` 和参考分析请求失效路径；不新增清理抽象。
- [x] 2.3 保持相同平台选择与程序化初始化/记录复用不产生多余重置，并只清理由本次修改造成的未使用平台回滚代码。
- [x] 2.4 确认重新选择先前平台会按当前规则直接重算，不恢复已清除的平台套图/逐图覆盖，也不影响保留字段。

## 3. 兼容性与验收

- [x] 3.1 运行平台切换、浏览器状态/静态 UI、参考分析竞态、计划预览、队列、Local/Worker 生成相关定向测试，修复全部回归且不弱化断言。
- [x] 3.2 检查实现 diff，确认“应用建议”流程、平台 policy/resolver、Creation planner、预览/生成 API、manifest 和服务端执行路径没有行为修改。
- [x] 3.3 在真实套图界面切换至少两个平台，验证无弹窗、计划立即刷新、保留字段不丢失，并验证重新选择原平台的行为。
- [x] 3.4 运行完整 `npm test`、`npm run sync:public-lib -- --check`、`npm run build:pages`、OpenSpec strict validation 和新增中文 UTF-8/乱码扫描，并记录任何环境限制。
- [x] 3.5 请求独立只读验收 agent 复核无确认直切、精确重置、保留字段、陈旧响应、“应用建议”隔离、规划/API 边界和脏工作树保留；处理所有确认问题后完成本 change。
