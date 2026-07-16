## Context

套图模式的平台 select 当前把用户选择包装为可取消事务：先保存旧平台和相关表单快照，再调用 `window.confirm`；确认后清除平台规划覆盖并重算，取消则把 select 和旧状态恢复。截图反馈表明目标是移除这个平台切换确认弹窗，而不是修改参考分析的“应用建议”流程。

现有平台 change handler 已内联清空 `platformSetOverrides`、`platformItemOverrides`、冻结 payload、`effectivePlan`、当前 set 和手工 role 标记，然后调用 `renderCreationView` 并等待 `previewCreationPlan` 重新规划。商品、类目、尺寸、参考图、Logo、SKU、输出格式和配置不属于这段平台状态清理范围。参考分析另有请求版本及平台/类目快照 guard，必须继续阻止旧响应写回。

## Goals / Non-Goals

**Goals:**

- 平台 select 发生用户 change 时直接接受规范化后的新平台，不显示任何确认弹窗。
- 保留 handler 现有的内联平台状态清理、冻结计划清理、界面刷新和 `previewCreationPlan` 重算路径。
- 删除仅为取消操作服务的平台回滚分支，同时精确保留商品证据和生成配置。
- 保持参考分析竞态保护和“应用建议”交互不变。

**Non-Goals:**

- 修改平台 profile、resolver、Creation planner、硬规则或默认计划。
- 修改预览/生成 API、Local/Worker 行为、manifest 或队列冻结语义。
- 移除应用内其他确认弹窗，或修改参考分析建议的显式应用流程。
- 保存每个平台的历史覆盖，或在重新选择旧平台时恢复先前覆盖。

## Decisions

### 1. 平台 select change 直接提交新平台

用户选择与当前平台不同的有效值后，change handler 立即把该值作为当前平台，不调用 `window.confirm`，也不建立可取消的旧状态事务。无效值继续按现有规范化回退处理；与当前平台相同的值不产生额外重置。

选择直接提交而不是用非阻断 toast 或自定义对话框替代，是因为用户要求移除确认步骤本身，而不只是替换浏览器弹窗样式。

### 2. 保留现有内联清理和重算路径

平台值接受后，handler 继续按当前顺序内联清空 `platformSetOverrides`、`platformItemOverrides`、冻结 payload、`effectivePlan`、当前 set 和手工 role 标记，再调用 `renderCreationView` 刷新界面并等待 `previewCreationPlan` 按新平台重新规划。

选择保留现有内联路径而不是新增清理 helper 或调用额外 preview reset，是为了把实现限制在删除确认/回滚分支，并避免改变当前平台切换的清理时序或误清商品名称、描述、卖点、类目、尺寸、参考图及元数据、Logo、SKU、输出格式、模型/API 配置。

### 3. 删除取消回滚，不引入平台历史状态

不再保存仅供 `confirm=false` 使用的旧平台选择和表单回滚快照，也不再提供取消分支。用户若误选，可在 select 中重新选择原平台；该操作会再次执行相同重置并按原平台当前规则重新规划，不恢复原平台先前的套图或逐图覆盖。

选择这一行为是为了让平台选择保持确定、即时且无隐藏历史。为每个平台缓存覆盖会引入新的状态模型，超出本变更范围。

### 4. 保留参考分析竞态与应用流程

平台变化仍应中止可中止的旧参考分析请求或推进请求版本，并使旧平台/类目快照响应无法写回。参考分析完成后展示待应用建议及“应用建议”动作的现有流程保持原样；平台 change handler 不调用、替代或自动确认该动作。

### 5. 浏览器交互变化不下沉到规划与 API

本变更只改变浏览器平台 select 的提交时机。平台值、覆盖字段、预览和生成 payload 保持现有结构，Local/Worker 继续调用相同 resolver、planner 和校验路径。

## Risks / Trade-offs

- [误触平台后立即丢失平台覆盖] -> 界面保留平台下拉框以便重新选择，但明确不承诺恢复旧覆盖；测试固定只清平台相关状态。
- [清理范围扩大导致商品数据丢失] -> 保持 handler 现有内联清理字段不变，以字段级断言覆盖商品、类目、尺寸、参考图、Logo、SKU、输出格式和配置。
- [旧分析响应污染新平台] -> 保留 abort/request-version 与平台/类目 snapshot guard，并增加切换后的迟到响应测试。
- [误删其他确认流程] -> 静态和交互测试只禁止平台 select 调用 `window.confirm`，同时断言“应用建议”仍存在并保持原行为。
- [浏览器与规划结果漂移] -> 不修改 payload 和规划模块，针对同一新平台比较切换前后的既有 resolver/planner 输出契约。

## Migration Plan

1. 先增加失败测试，固定无确认直切、精确重置、保留字段、陈旧响应和“应用建议”边界。
2. 简化平台 select change handler，只删除确认/取消回滚路径，保留现有内联清理、`renderCreationView` 和 `previewCreationPlan` 调用顺序。
3. 运行平台切换、参考分析、浏览器 UI、预览/生成和 Local/Worker 回归测试，并检查生产 diff 未扩展到规划或 API。
4. 回滚时恢复原确认事务与取消快照；无需迁移 manifest、队列或服务端数据。

## Open Questions

- 无。重新选择旧平台会按当前规则重新规划，而不是恢复该平台先前的覆盖状态。
