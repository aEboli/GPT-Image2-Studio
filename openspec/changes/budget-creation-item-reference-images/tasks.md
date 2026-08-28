## 1. 参考图预算表

- [x] 1.1 在 `lib/creation-reference-labels.mjs` 用 `ITEM_REFERENCE_BUDGETS`（有序支撑角色 + 支撑上限）替换平铺的 `ITEM_SUPPORTING_REFERENCE_ROLES` 与 `SINGLE_PRODUCT_REFERENCE_ITEM_ROLES`。
- [x] 1.2 `size-capacity-fit` 与 `spec-table` 的支撑角色收敛为尺寸规格、上限 1。
- [x] 1.3 `multi-angle` 移除 `product` 支撑角色；`series-showcase` 保留 `product` 但上限 2。
- [x] 1.4 `human-handheld` 与 `human-wearable` 补上预算条目，消除落进"返回全部上传图"兜底的扇出。
- [x] 1.5 确认两个改动文件均为服务端专用，不在 `public/lib` 镜像清单内，无需同步。

## 2. 选图逻辑

- [x] 2.1 新增 `selectBudgetedSupportingImages`：按声明顺序入选、按上传顺序附加、排除主体锚点以免占用支撑额度。
- [x] 2.2 角色过滤分支改为按预算取图并在支撑上限处截断。
- [x] 2.3 coverage 分支应用同一支撑上限，与角色过滤分支保持一致上界。
- [x] 2.4 角色元数据为空时只返回主体锚点，替换返回全部上传图的兜底。
- [x] 2.5 保持 `infographic-rebuild` 与 `sku` 两条既有分支行为不变。

## 3. 套图 Logo 完整移除

- [x] 3.1 删除 `lib/creation-reference-labels.mjs` 的 `appendCreationItemLogoReference`。
- [x] 3.2 删除 `lib/creation-planner.mjs` 的 `buildCreationLogoGuidance` 及其轮播图与 SKU 两处调用；保留 `normalizeCreationLogoOptions`。
- [x] 3.3 `server.mjs` 的 `handleCreationGenerate`、`handleCreationRepair`、`handleCreationPlan` 移除 Logo 读取、注入与 import。
- [x] 3.4 `createCreationReferenceUploadRegistry` 移除失去调用方的 `logoImage` 参数；删除死代码 `appendCreationLogoReference`。
- [x] 3.5 `public/index.html` 给 `.creation-logo-block` 加 `data-creation-logo-batch-only`。
- [x] 3.6 `public/app.js` 的套图生成、计划预览、补图三个表单不再提交 `logoImage` 与 `logoOptions`。
- [x] 3.7 确认"上传图加 Logo"链路完整保留：`handleCreationLogoBatchGenerate`、`buildCreationLogoBatchPlan`、`readCreationLogoImage`、`buildCreationLogoOptionsFromFormData`、批量表单仍提交 Logo 字段。
- [x] 3.8 确认 `logoPolicy` 字段、`forbid-overlay` 提示词与 `ITEM_OVERRIDE_FIELDS` 覆写校验全部保留。

## 4. 测试

- [x] 4.1 更新 `test/creation-reference-labels.test.mjs` 中固化三图行为与 Logo 附加的断言。
- [x] 4.2 `test/creation-server-static.test.mjs` 的 Logo 附加断言反转为"不存在"。
- [x] 4.3 修正该测试的 `handleCreationGenerate` 切片边界：原正则越过 `handleCreationLogoBatchGenerate` 切到 `handleCreationRepair`，把合法保留 Logo 的批量分支纳入了断言范围。
- [x] 4.4 `test/creation-reference-labels.test.mjs` 19/19、`test/creation-server-static.test.mjs` 34/34 通过。
- [x] 4.5 确认 `test/creation-planner.test.mjs` 的 11 项失败与本次改动无关：stash 到 HEAD 复测同为 137/126/11。
- [x] 4.6 更新 `test/creation-planner.test.mjs` 两条 Logo 断言：SKU 提示词不含 Logo 文件名；"注入 Logo 指导"一条反转为"永不注入放置指令"。
- [x] 4.7 全量 `npm test`：1817 项 / 1798 通过 / 19 失败，失败集合与 HEAD 基线（1769 / 1750 / 19）逐条一致，无新增失败。

## 5. 验证

- [x] 5.1 探针复核 Amazon 8 图套图：尺寸图恒为 2 张，全套总附加 13 次，即使传入 `logoOptions.enabled` 也不附加 Logo，`plan.logo` 不进入任何提示词放置指令。
- [x] 5.2 确认提示词中剩余的 Logo 字样只有策略声明与"保留商品上已有 Logo"，无放置指令；`allow-supplied` 项均带"不得超出供图品牌标记"的护栏。
- [x] 5.3 `openspec validate budget-creation-item-reference-images --strict` 通过。
- [ ] 5.4 界面人工验收：套图分支看不到 Logo 控件，"上传图加 Logo"分支照常可用。
