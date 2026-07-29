## Why

套图模式切换平台时会弹出浏览器 `window.confirm`，用户必须额外确认才能完成已经在下拉框中明确选择的平台变更。该阻断步骤打断连续配置，也使平台选择与其他即时生效的套图参数行为不一致。

## What Changes

- 用户在套图平台下拉框选择新平台后，系统直接接受该平台，不再显示 `window.confirm` 或其他确认弹窗。
- 平台变更继续执行 handler 现有的内联平台状态清理、冻结 payload 与 `effectivePlan` 清理、界面刷新和 `previewCreationPlan` 重算路径。
- 移除平台切换的取消与旧选择回滚分支；用户若要恢复原平台，可在平台下拉框中重新选择。
- 平台切换继续保留商品名称、描述、卖点、类目、尺寸、参考图及其元数据、Logo、SKU、输出格式和模型/API 配置。
- 保留参考分析陈旧响应拦截和现有“应用建议”流程。
- 不修改平台规划器、平台规则、生成/预览 API、Local/Worker 生成逻辑或保存格式。

## Capabilities

### New Capabilities

- 无。

### Modified Capabilities

- `creation-mode`: 将平台切换从可取消确认事务改为下拉选择后直接接受并执行现有平台规划重置。

## Impact

- 浏览器交互：套图平台 select 的 change 处理、平台切换状态辅助逻辑和草稿预览刷新。
- 测试：平台切换、浏览器静态交互、参考分析竞态和保留字段回归覆盖。
- API 与规划：无字段或接口变化；平台 resolver、Creation planner、Local/Worker 路径保持兼容。
